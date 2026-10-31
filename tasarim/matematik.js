// Düzgün matematik (OZELLIKLER-8 §4.1): LaTeX'ten MathML (Temml, lib/temml), EPUB MathML'inin süzülmesi
// ve formüle uzun basınca ya da sağ tıklayınca "LaTeX olarak kopyala".
//
//   matematikVarMi(metin)        -> boolean   metinde $...$, $$...$$, \(...\) ya da \[...\] olabilir mi (ucuz ön eleme)
//   texParcala(metin)            -> [{ metin } | { tex, blok, ham }]   para birimi ("5$ ve 10$") formül sayılmaz
//   matematikYukle()             -> Promise    Temml bir kez, tembel yüklenir (klasik betik + CSS)
//   texMathml(tex, { blok })     -> <math> | null   Temml yüklüyse süzülmüş kopya; hatalı TeX null
//   matematikCiz(kok)            -> Promise<number>   kok içindeki metin düğümlerinde formülleri çizer (kartlar, cep defteri)
//   formulleriCiz(kok)           -> Promise    [data-tex] yer tutucularını çizer (asistan cevabı); çizilemeyen yedek yazıyla kalır
//   mathmlSuz(kaynak)            -> <math> | null   yalnız MathML öğeleri ve güvenli nitelikler (href, on*, url() yok)
//   epubFormul(duz, mathml)      -> Node     Koltuk: düz metin ışık DOM'da (ofsetler için), formül gölge DOM'da
//   mathmlCiz(mathml, duz)       -> Node     kaydedilmiş EPUB MathML'i (vurgu.formuller) satır içi formül; olmazsa düz metin
//   formulGoruntusu(math, o)     -> Promise<img | null>   kırpma için formülün görüntüsü (SVG foreignObject)
//   matematikStili()                         Temml yazı tipi CSS'i (Temml betiği yüklenmeden)
//   latexAl(el)                -> string   formülün TeX'i (annotation application/x-tex)
//
// Hata olursa metin olduğu gibi kalır. Temml çıktısı da EPUB'unki gibi süzülür: DOM'a ham HTML girmez.

import { h, toast, panoyaYaz } from "./ortak.js";

const MATHML = "http://www.w3.org/1998/Math/MathML";

/* ================= Ayrıştırma ================= */
export const matematikVarMi = (s) => typeof s === "string" && (s.includes("$") || s.includes("\\(") || s.includes("\\["));

const bosMu = (c) => c === undefined || /\s/.test(c);
// Kapanan "$" ardından rakam gelmez ("$5 ve $6"), önünde boşluk ya da ters bölü olmaz
function tekKapanis(s, i) {
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "\n" && s[j + 1] === "\n") return -1;   // paragraf geçmez
    if (c !== "$") continue;
    if (s[j + 1] === "$") return -1;
    if (bosMu(s[j - 1]) || /\d/.test(s[j + 1] || "")) continue;
    return j;
  }
  return -1;
}
function kapanisBul(s, ac, kapa) {
  for (let j = ac; j < s.length; j++) {
    if (s[j] === "\\" && s.startsWith(kapa, j)) return j;
    if (kapa === "$$" && s.startsWith("$$", j) && s[j - 1] !== "\\") return j;
  }
  return -1;
}
export function texParcala(s) {
  const out = [];
  if (!matematikVarMi(s)) return [{ metin: String(s ?? "") }];
  let duz = "", i = 0;
  const formul = (tex, blok, ham) => {
    if (!tex.trim()) { duz += ham; return; }
    if (duz) out.push({ metin: duz });
    duz = "";
    out.push({ tex: tex.trim(), blok, ham });
  };
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && (s[i + 1] === "(" || s[i + 1] === "[")) {
      const kapa = s[i + 1] === "(" ? "\\)" : "\\]";
      const j = kapanisBul(s, i + 2, kapa);
      if (j > i) { formul(s.slice(i + 2, j), kapa === "\\]", s.slice(i, j + 2)); i = j + 2; continue; }
    }
    if (c === "\\" && s[i + 1] === "$") { duz += "\\$"; i += 2; continue; }
    if (c === "$" && s[i + 1] === "$") {
      const j = kapanisBul(s, i + 2, "$$");
      if (j > i + 2) { formul(s.slice(i + 2, j), true, s.slice(i, j + 2)); i = j + 2; continue; }
      duz += "$$"; i += 2; continue;
    }
    if (c === "$" && !bosMu(s[i + 1])) {
      const j = tekKapanis(s, i);
      if (j > i) { formul(s.slice(i + 1, j), false, s.slice(i, j + 1)); i = j + 1; continue; }
    }
    duz += c;
    i++;
  }
  if (duz) out.push({ metin: duz });
  return out;
}

/* ================= Temml (tembel) ================= */
let yukleniyor = null;
export function matematikStili() {
  if (document.querySelector("link[data-temml]")) return;
  document.head.append(h("link", { rel: "stylesheet", href: new URL("../lib/temml/Temml-Local.css", import.meta.url).href, "data-temml": "" }));
}
export function matematikYukle() {
  if (window.temml) return Promise.resolve(window.temml);
  yukleniyor ||= new Promise((tamam, hata) => {
    matematikStili();
    const s = document.createElement("script");
    s.src = new URL("../lib/temml/temml.min.js", import.meta.url).href;
    s.onload = () => (window.temml ? tamam(window.temml) : hata(new Error("Temml yüklenemedi")));
    s.onerror = () => { yukleniyor = null; hata(new Error("Temml yüklenemedi")); };
    document.head.append(s);
  });
  return yukleniyor;
}

// Aynı formül her karede yeniden çizilir (akan cevap): süzülmüş sonuç önbellekte, her kullanımda kopyası
const TEX_ONBELLEK = new Map();
const ONBELLEK_SINIRI = 600;
function onbellekYaz(m, k, v) {
  if (m.size >= ONBELLEK_SINIRI) m.delete(m.keys().next().value);
  m.set(k, v);
}
export function texMathml(tex, { blok = false } = {}) {
  const t = window.temml;
  if (!t || typeof tex !== "string" || !tex.trim() || tex.length > 4000) return null;
  const k = (blok ? "B" : "S") + tex;
  if (!TEX_ONBELLEK.has(k)) {
    let el = null;
    try {
      const ham = t.renderToString(tex, { displayMode: blok, annotate: true, throwOnError: true, trust: false });
      const kap = new DOMParser().parseFromString(`<!doctype html><body>${ham}`, "text/html").body;
      el = mathmlSuz(kap.querySelector("math"));
    } catch { el = null; }
    onbellekYaz(TEX_ONBELLEK, k, el);
  }
  const el = TEX_ONBELLEK.get(k);
  return el ? el.cloneNode(true) : null;
}

/* ================= Süzgeç ================= */
const OGELER = new Set(["math", "semantics", "annotation", "mrow", "mi", "mn", "mo", "ms", "mtext", "mspace", "msub", "msup", "msubsup",
  "munder", "mover", "munderover", "mmultiscripts", "mprescripts", "none", "mfrac", "msqrt", "mroot", "mstyle", "merror", "mpadded",
  "mphantom", "mtable", "mtr", "mtd", "mlabeledtr", "menclose", "mfenced", "maligngroup", "malignmark"]);
const NITELIKLER = new Set(["display", "displaystyle", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "mathvariant", "mathsize",
  "mathcolor", "mathbackground", "dir", "fence", "separator", "stretchy", "symmetric", "maxsize", "minsize", "largeop", "movablelimits",
  "accent", "accentunder", "lspace", "rspace", "form", "width", "height", "depth", "voffset", "linethickness", "numalign", "denomalign",
  "bevelled", "columnalign", "rowalign", "columnspacing", "rowspacing", "columnlines", "rowlines", "frame", "framespacing", "equalrows",
  "equalcolumns", "columnspan", "rowspan", "notation", "align", "side", "encoding", "alttext", "open", "close", "separators", "class", "style"]);
const STIL = new Set(["color", "background-color", "font-weight", "font-style", "font-size", "font-family", "text-align", "vertical-align",
  "padding", "padding-left", "padding-right", "padding-top", "padding-bottom", "margin", "margin-left", "margin-right", "margin-top", "margin-bottom",
  "width", "height", "min-width", "border", "border-top", "border-bottom", "border-left", "border-right", "border-color", "border-style",
  "border-width", "letter-spacing", "line-height", "white-space", "text-decoration", "math-style", "math-depth", "math-shift", "display"]);
const TEHLIKE = /url\s*\(|expression|javascript:|vbscript:|data:|@import|behavior|image-set|var\s*\(|[<>\\]/i;
const DUGUM_SINIRI = 6000, DERINLIK_SINIRI = 60;

function stilSuz(deger) {
  const temiz = [];
  for (const parca of String(deger).split(";")) {
    const i = parca.indexOf(":");
    if (i < 0) continue;
    const ad = parca.slice(0, i).trim().toLowerCase(), v = parca.slice(i + 1).trim();
    if (!STIL.has(ad) || !v || TEHLIKE.test(v)) continue;
    if (ad === "display" && !/^(inline|block|inline-block|block math|inline math)$/i.test(v)) continue;
    temiz.push(`${ad}: ${v}`);
  }
  return temiz.join("; ");
}

// kaynak: Element (herhangi bir ad alanı) ya da MathML dizgisi. Her düğüm MathML ad alanında yeniden kurulur.
export function mathmlSuz(kaynak) {
  let kok = kaynak;
  if (typeof kaynak === "string") {
    let d = new DOMParser().parseFromString(kaynak, "application/xml");
    if (d.getElementsByTagName("parsererror").length) d = new DOMParser().parseFromString(`<!doctype html><body>${kaynak}`, "text/html");
    kok = d.querySelector ? [...d.getElementsByTagNameNS("*", "math")][0] || null : null;
  }
  if (!kok || kok.nodeType !== 1 || kok.localName !== "math") return null;
  let sayac = 0;
  const kur = (el, derin) => {
    if (++sayac > DUGUM_SINIRI || derin > DERINLIK_SINIRI) throw new Error("MathML çok büyük");
    const ad = el.localName.toLowerCase();
    if (!OGELER.has(ad)) return null;
    // annotation yalnız düz metin taşır; annotation-xml (HTML ya da SVG taşıyabilir) hiç alınmaz
    const yeni = document.createElementNS(MATHML, ad);
    for (const n of [...el.attributes]) {
      const na = n.localName.toLowerCase();
      if (n.namespaceURI && n.namespaceURI !== MATHML) continue;
      if (!NITELIKLER.has(na) || na.startsWith("on")) continue;
      let v = n.value;
      if (na === "style") { v = stilSuz(v); if (!v) continue; }
      else if (na === "class") { v = v.split(/\s+/).filter((c) => /^[\w-]{1,40}$/.test(c)).join(" "); if (!v) continue; }
      else if (na !== "alttext" && TEHLIKE.test(v)) continue;
      yeni.setAttribute(na, v.slice(0, 4000));
    }
    if (ad === "annotation") { yeni.textContent = el.textContent.slice(0, 4000); return yeni; }
    for (const c of el.childNodes) {
      if (c.nodeType === 3) yeni.append(c.data);
      else if (c.nodeType === 1) { const k = kur(c, derin + 1); if (k) yeni.append(k); }
    }
    return yeni;
  };
  try { return kur(kok, 0); } catch { return null; }
}

/* ================= Çizim: metin düğümleri ve yer tutucular ================= */
const ATLA = "textarea, input, script, style, code, pre, math, kbd, .formul-tex, .formul-kap, [contenteditable]:not([contenteditable=false])";

function formulSarmali(el, tex, blok) {
  const kap = h("span", { class: "formul-tex" + (blok ? " blok" : ""), "data-tex": tex });
  kap.append(el);
  formulMenusuKur();
  return kap;
}

export async function matematikCiz(kok) {
  if (!kok || !matematikVarMi(kok.textContent)) return 0;
  const dugumler = [];
  const w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
  for (let d = w.nextNode(); d; d = w.nextNode()) {
    if (!matematikVarMi(d.data) || d.parentElement?.closest(ATLA)) continue;
    const parcalar = texParcala(d.data);
    if (parcalar.some((p) => p.tex)) dugumler.push([d, parcalar]);
  }
  if (!dugumler.length) return 0;
  try { await matematikYukle(); } catch { return 0; }
  let n = 0;
  for (const [d, parcalar] of dugumler) {
    if (!d.isConnected && !kok.contains(d)) continue;
    const frag = document.createDocumentFragment();
    for (const p of parcalar) {
      if (!p.tex) { frag.append(p.metin); continue; }
      const el = texMathml(p.tex, { blok: p.blok });
      if (el) { frag.append(formulSarmali(el, p.tex, p.blok)); n++; } else frag.append(p.ham);
    }
    d.replaceWith(frag);
  }
  return n;
}

// Asistan cevabı HTML olarak yazılır: formül yerinde <span data-tex data-blok?>yedek</span> durur
export async function formulleriCiz(kok) {
  const yerler = kok ? [...kok.querySelectorAll("[data-tex]:not(.formul-tex)")] : [];
  if (!yerler.length) return;
  if (!window.temml) {
    try { await matematikYukle(); } catch { return; }
  }
  for (const y of yerler) {
    if (!y.isConnected && !kok.contains(y)) continue;
    const blok = y.hasAttribute("data-blok");
    const el = texMathml(y.dataset.tex, { blok });
    if (el) y.replaceWith(formulSarmali(el, y.dataset.tex, blok));
  }
}

/* ================= Koltuk: EPUB MathML ================= */
// Paragraf metninin ofsetleri (vurgu, iz, arama) düz metne göredir. Formülün düz metni (alttext ya da TeX)
// ışık DOM'da tek metin düğümü olarak kalır, satırın ortasında 1 px'lik görünmez yazıyla durur:
// ofsetler ve satır ölçümü bozulmaz. Görünen formül gölge DOM'dadır, metin ölçümüne girmez.
const EPUB_ONBELLEK = new Map();
const GOLGE_STIL = `:host { position: relative; -webkit-touch-callout: none; }
:host([blok]) { display: block; margin: .4em 0; text-align: center; }
.g { display: inline; }
math { font-family: "Cambria Math", "STIX Two Math", "Noto Sans Math", math; font-style: normal; font-weight: normal; letter-spacing: normal; text-indent: 0; }
math[display="block"] { display: block math; }
.m { position: absolute; left: 0; top: 50%; max-width: 100%; overflow: hidden; font: 1px/1 sans-serif; color: transparent;
  white-space: nowrap; pointer-events: none; -webkit-user-select: none; user-select: none; }`;
let golgeStil = null;
export function epubFormul(duz, mathml) {
  if (!duz || !mathml || typeof Element.prototype.attachShadow !== "function") return document.createTextNode(duz || "");
  let ml = EPUB_ONBELLEK.get(mathml);
  if (ml === undefined) { ml = mathmlSuz(mathml); onbellekYaz(EPUB_ONBELLEK, mathml, ml); }
  if (!ml) return document.createTextNode(duz);
  const blok = ml.getAttribute("display") === "block";
  const kap = document.createElement("span");
  kap.className = "formul-kap";
  if (blok) kap.setAttribute("blok", "");
  kap.append(duz);
  const kok = kap.attachShadow({ mode: "open" });
  if ("adoptedStyleSheets" in kok && typeof CSSStyleSheet === "function") {
    try {
      if (!golgeStil) { golgeStil = new CSSStyleSheet(); golgeStil.replaceSync(GOLGE_STIL); }
      kok.adoptedStyleSheets = [golgeStil];
    } catch { kok.append(h("style", {}, GOLGE_STIL)); }
  } else kok.append(h("style", {}, GOLGE_STIL));
  kok.append(h("span", { class: "g" }, ml.cloneNode(true)), h("span", { class: "m", "aria-hidden": "true" }, document.createElement("slot")));
  formulMenusuKur();
  return kap;
}

// İzlerim ve cep defteri: vurguyla kaydedilmiş EPUB MathML'i. TeX yoksa kopyalama menüsü düz metni verir.
export function mathmlCiz(mathml, duz = "") {
  let ml = typeof mathml === "string" ? EPUB_ONBELLEK.get(mathml) : undefined;
  if (ml === undefined && typeof mathml === "string") { ml = mathmlSuz(mathml); onbellekYaz(EPUB_ONBELLEK, mathml, ml); }
  if (!ml) return document.createTextNode(duz);
  const el = ml.cloneNode(true);
  const kap = formulSarmali(el, latexAl(el), el.getAttribute("display") === "block");
  if (!kap.dataset.tex) kap.removeAttribute("data-tex");
  if (duz) kap.dataset.duz = duz;
  matematikStili();
  return kap;
}

/* ================= Kırpma: formülün görüntüsü ================= */
// MathML, SVG foreignObject içinde görüntüye çevrilir (cihazın matematik yazı tipiyle). Tuvali kirleten
// tarayıcıda (foreignObject'i güvensiz sayan Safari sürümleri) ya da yüklenemezse null: çağıran düz metni yazar.
// o: { w, h } CSS piksel kutu, renk, boyut (px), olcek (görüntü pikseli / CSS pikseli)
export async function formulGoruntusu(math, { w, h: y, renk = "#000", boyut = 16, olcek = 2 } = {}) {
  if (!math || !(w > 0) || !(y > 0) || typeof XMLSerializer !== "function") return null;
  try {
    const ml = new XMLSerializer().serializeToString(math);
    const stil = `math{font-family:"Cambria Math","STIX Two Math","Noto Sans Math",math;font-size:${boyut}px;color:${renk};`
      + "font-style:normal;font-weight:normal;letter-spacing:normal;text-indent:0;line-height:normal;margin:0}";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * olcek)}" height="${Math.ceil(y * olcek)}" viewBox="0 0 ${w} ${y}">`
      + `<foreignObject x="0" y="0" width="${w}" height="${y}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:0;line-height:0;white-space:nowrap">`
      + `<style>${stil}</style>${ml}</div></foreignObject></svg>`;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await (img.decode ? img.decode() : new Promise((tamam, hata) => { img.onload = tamam; img.onerror = hata; }));
    // Kirlenme denemesi: görüntü tuvali kirletiyorsa getImageData hata verir
    const dene = document.createElement("canvas");
    dene.width = dene.height = 1;
    const g = dene.getContext("2d");
    g.drawImage(img, 0, 0);
    g.getImageData(0, 0, 1, 1);
    return img;
  } catch { return null; }
}

/* ================= LaTeX olarak kopyala ================= */
export function latexAl(el) {
  if (!el) return "";
  const kap = el.closest?.(".formul-tex, .formul-kap, [data-tex]") || el;
  if (kap.dataset?.tex) return kap.dataset.tex;
  const math = kap.localName === "math" ? kap : kap.querySelector?.("math") || kap.shadowRoot?.querySelector("math");
  const not = math ? [...math.getElementsByTagNameNS("*", "annotation")].find((a) => /tex/i.test(a.getAttribute("encoding") || "")) : null;
  return (not?.textContent || "").trim();
}
// Olayın yolundaki formül: gölge DOM'daki <math> konağına (formul-kap) çıkar
function formulBul(e) {
  for (const el of e.composedPath?.() || []) {
    if (el.nodeType !== 1) continue;
    if (el.classList?.contains("formul-kap") || el.classList?.contains("formul-tex")) return el;
    if (el.localName === "math" && !(el.getRootNode() instanceof ShadowRoot)) return el;
  }
  return null;
}
let menu = null;
function menuKapat() { menu?.kapat(); menu = null; }
function menuAc(f, x, y) {
  menuKapat();
  const tex = latexAl(f);
  const k = f.closest?.(".formul-tex, .formul-kap") || f;
  const duz = k.dataset?.duz || (k.classList.contains("formul-kap") ? k.textContent : "");
  if (!tex && !duz) return;
  const d = h("button", { class: "izler-fis__satir", type: "button", role: "menuitem" }, h("span", {}, tex ? "LaTeX olarak kopyala" : "Metin olarak kopyala"));
  d.addEventListener("click", async () => {
    menuKapat();
    toast((await panoyaYaz(tex || duz)) ? (tex ? "LaTeX kopyalandı" : "Kopyalandı") : "Kopyalanamadı");
  });
  const el = h("div", { class: "izler-fis formul-menu", role: "menu", "aria-label": "Formül" }, d);
  document.body.append(el);
  const w = el.offsetWidth, hY = el.offsetHeight;
  el.style.left = `${Math.round(Math.min(Math.max(8, x - w / 2), innerWidth - w - 8))}px`;
  el.style.top = `${Math.round(y + 12 + hY > innerHeight - 8 ? Math.max(8, y - hY - 12) : y + 12)}px`;
  const disari = (e) => { if (!el.contains(e.target)) menuKapat(); };
  const tus = (e) => { if (e.key === "Escape") { e.stopPropagation(); menuKapat(); } };
  setTimeout(() => document.addEventListener("pointerdown", disari, true), 0);
  document.addEventListener("keydown", tus, true);
  addEventListener("scroll", menuKapat, { capture: true, once: true, passive: true });
  menu = { kapat: () => { document.removeEventListener("pointerdown", disari, true); document.removeEventListener("keydown", tus, true); el.remove(); } };
  d.focus({ preventScroll: true });
}
// Sağ tık ve Android'de uzun basış "contextmenu" verir; iOS vermez: parmakla 550 ms basış da açar.
// Kalemle uzun basış Koltuk'un anlam kartına kalır. Dokunulabilir satırın (İzlerim, cep defteri) içindeki
// formülde de uzun basış formül menüsüdür: satırın kendi uzun basışı formülü atlar (izler.js uzunBas),
// parmak kalkınca gelen tıklama yutulur, satır yerine gitmez.
let menuKuruldu = false, sonIsaretci = "", basili = null, tiklamaYut = false;
export function formulMenusuKur() {
  if (menuKuruldu) return;
  menuKuruldu = true;
  document.addEventListener("pointerdown", (e) => {
    sonIsaretci = e.pointerType;
    tiklamaYut = false;
    clearTimeout(basili?.z);
    basili = null;
    if (e.pointerType !== "touch") return;
    const f = formulBul(e);
    if (!f) return;
    const x = e.clientX, y = e.clientY;
    basili = { x, y, z: setTimeout(() => { basili = null; tiklamaYut = true; menuAc(f, x, y); }, 550) };
  }, true);
  document.addEventListener("click", (e) => {
    if (!tiklamaYut) return;
    tiklamaYut = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointermove", (e) => { if (basili && Math.hypot(e.clientX - basili.x, e.clientY - basili.y) > 8) { clearTimeout(basili.z); basili = null; } }, { capture: true, passive: true });
  for (const t of ["pointerup", "pointercancel"]) document.addEventListener(t, () => {
    clearTimeout(basili?.z);
    basili = null;
    if (tiklamaYut) setTimeout(() => { tiklamaYut = false; }, 400);
  }, true);
  document.addEventListener("contextmenu", (e) => {
    if (sonIsaretci === "pen") return;
    const f = formulBul(e);
    if (!f) return;
    e.preventDefault();
    clearTimeout(basili?.z);
    basili = null;
    if (sonIsaretci === "touch") tiklamaYut = true;
    menuAc(f, e.clientX, e.clientY);
  }, true);
}
