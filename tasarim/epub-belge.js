// Gerçek EPUB'u okuma.js'in metin modeline çevirir (OZELLIKLER-3 §4). epub.js gerekmez: JSZip + DOMParser.
//
// epubAc(blob, { surum, bekle, kapak }) -> { baslik, yazar, kapak?, dil?, bolumler: [{ no, baslik, paragraflar: [string | "***"] }] }
// epubCoz(id, blobGetir, { surum, bekle }) -> epubAc sonucu, belge başına paylaşılan önbellekten (okuma.js + arama.js)
// epubBilgi(blob) -> { baslik, yazar, kapak }   (kitaplığa alırken: yalnız OPF ve kapak, metin okunmaz)
//
// Paragraf metni düz yazıdır, okuma-metni.js ile aynı biçim. Tek ek: italik *böyle*, kalın **böyle**,
// metindeki gerçek yıldız ve ters bölü \* ve \\ olarak kaçırılır. okuma.js gösterirken bunu çözer.
// MathML (sürüm 2): paragraf metninde düz karşılığı (alttext ya da TeX) durur; bölümün matematik alanı
// { [paragraf sırası]: [{ a, b, ml }] } bu düz metnin [a, b) aralığını ve kitaptaki MathML'i verir (okuma.js çizer).
// Metin, ofsetler ve sayfalama MathML'den etkilenmez.
//
// 7.0 (TASARIM-5 11.3 C2, C3): görsel, tablo, liste, bağlantı ve dipnot.
// KARAR: yeni bloklar paragraf numarası SAYMAZ. Hepsi bölümün yanındaki süs alanlarıdır ve paragraf sırasına
// (j: bölüm.paragraflar dizisindeki yer, sahne ayracı dahil) bağlanır; paragraf metinleri değişmez:
//   ekler:    { [j]: [görsel] }   j. paragraftan önce çizilen görseller (j = paragraf sayısı: bölümün sonu).
//             görsel: { tur: "gorsel", yol, alt, en, boy } (zip içindeki dosya, gorselAl(yol) ile) ya da
//                     { tur: "svg", svg, alt, en, boy } (satır içi SVG, <img> içinde çizilir: betik ve stil sızmaz).
//             en ve boy ayrıştırırken ölçülür (başlıktan, olmazsa createImageBitmap): sayfa sonradan yeniden akmaz.
//   liste:    { [j]: { d, i? } }  liste maddesi: derinlik ve imi ("3.", "b.", "•"); imsiz olan aynı maddenin devamı.
//   tablolar: [{ ilk, baslik, satirlar: [[{ p: [j], th, cs, rs }]] }]  hücreler yine paragraftır (vurgu, iz, arama).
//   baglar:   { [j]: [{ a, b, h?, dis?, not? }] }  düz metindeki [a, b) aralığı; h: "dosya#kimlik", dis: dış adres.
//   altyazi:  { [j]: 1 }  figür altyazısı.
// Kitap düzeyinde: hedefler { "dosya#kimlik": [bölüm sırası, j] }, notlar { "dosya#kimlik": [paragraf] } (dipnot kartı)
// ve gorselAl(yol) -> Promise<Blob | null>. Böylece eski sürümle açılmış kitaplar da görsel, tablo ve listeyi
// kendi paragraf numaralarıyla alır. Tek numara değiştiren yenilik dipnotun akıştan çıkmasıdır: o EPUB_SURUM 3'tedir,
// daha önce açılmış kitaplar epubSurumu ile eski sürümde kalır (dipnotları akışta durur, kart yine açılır).

import { t } from "./dil.js";

export const SAHNE = "***";

// Ayrıştırma sürümü. Paragraf numaraları (vurgu, çizgi, tuval, konum) ayrıştırmaya bağlı olduğu için
// daha önce açılmış kitap eski sürümle ayrışmaya devam eder; yeni kitap son sürümle açılır.
// 2: NFC, <math> metni, <pre> satırları, yalnız bilinen sahne ayraçları, içindekilerde büyük-küçük harf duyarsız yol
// 3: dipnot ve son not (epub:type footnote, endnote, rearnote, note; role doc-footnote, doc-endnote; noteref
//    hedefi olan <aside>) ana akıştan çıkar, yalnız dipnot kartında görünür
export const EPUB_SURUM = 3;
export function epubSurumu(belge) {
  const v = belge?.veri;
  if (!v || v.kurulmadi) return EPUB_SURUM;
  return v.epubSurum || 1;
}

// ---------- JSZip ----------
// index.html klasik script olarak yüklemediyse bir kez buradan yüklenir
let zipYukleniyor = null;
export function jszip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  zipYukleniyor ||= new Promise((tamam, hata) => {
    const s = document.createElement("script");
    s.src = new URL("../lib/jszip.min.js", import.meta.url).href;
    s.onload = () => (window.JSZip ? tamam(window.JSZip) : hata(new Error("JSZip yüklenemedi")));
    s.onerror = () => { zipYukleniyor = null; hata(new Error("JSZip yüklenemedi")); };
    document.head.append(s);
  });
  return zipYukleniyor;
}

// ---------- yol ve XML yardımcıları ----------
const klasorOf = (yol) => yol.slice(0, yol.lastIndexOf("/") + 1);
function coz(taban, href, kendi = "") {
  // taban klasörüne göre göreli yolu çözer: "OEBPS/metin/" + "../resim/a.jpg" -> "OEBPS/resim/a.jpg"
  // Yalnız "#bolum-2" gibi bağlantı, bulunduğu dosyayı (kendi) gösterir
  let h = href.split("#")[0];
  try { h = decodeURIComponent(h); } catch { /* bozuk kaçış: olduğu gibi */ }
  if (!h) return kendi;
  const parca = (h.startsWith("/") ? h.slice(1) : taban + h).split("/");
  const sonuc = [];
  for (const p of parca) {
    if (p === "..") sonuc.pop();
    else if (p !== "." && p !== "") sonuc.push(p);
  }
  return sonuc.join("/");
}
const parcaOf = (href) => { const i = href.indexOf("#"); return i < 0 ? "" : href.slice(i + 1); };

// Ad alanından bağımsız arama: getElementsByTagNameNS("*", ad)
const etiketler = (kok, ad) => [...kok.getElementsByTagNameNS("*", ad)];
const ilkEtiket = (kok, ad) => kok.getElementsByTagNameNS("*", ad)[0] || null;
const bosluk = (s) => (s || "").replace(/\s+/g, " ").trim();

function xmlAc(metin, tur = "application/xml") {
  const d = new DOMParser().parseFromString(metin, tur);
  if (d.getElementsByTagName("parsererror").length) return null;
  return d;
}
// XHTML sıkı ayrıştırılır; bozuksa (kapanmamış etiket, &nbsp;) HTML olarak denenir
function htmlAc(metin) {
  return xmlAc(metin, "application/xhtml+xml") || new DOMParser().parseFromString(metin, "text/html");
}

// XML ve XHTML baytları kendi kodlamasıyla çözülür: JSZip "string" hep UTF-8 sanır, UTF-16 kitap bozulurdu.
// Sıra: BOM, UTF-16'nın ilk "<" baytları, XML bildirimi ya da meta charset, yoksa UTF-8.
// Tek metin dosyası en çok 64 MB açılır: 300 KB'lık zip bombası 300 MB'a açılıp sekmeyi düşürmesin
const METIN_SINIRI = 64 * 2 ** 20;
async function metinOku(dosya) {
  if (dosya?._data?.uncompressedSize > METIN_SINIRI) throw Object.assign(new Error(t("EPUB içinde aşırı büyük bölüm")), { kod: "buyuk" });
  const b = await dosya.async("uint8array");
  if (b.length > METIN_SINIRI) throw Object.assign(new Error(t("EPUB içinde aşırı büyük bölüm")), { kod: "buyuk" });
  let kod = "utf-8", bas = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) bas = 3;
  else if (b[0] === 0xff && b[1] === 0xfe) { kod = "utf-16le"; bas = 2; }
  else if (b[0] === 0xfe && b[1] === 0xff) { kod = "utf-16be"; bas = 2; }
  else if (b[0] === 0x3c && b[1] === 0) kod = "utf-16le";
  else if (b[0] === 0 && b[1] === 0x3c) kod = "utf-16be";
  else {
    const ust = new TextDecoder("latin1").decode(b.subarray(0, 1024));
    const m = ust.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i) || ust.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i);
    if (m && !/^utf-?16/i.test(m[1])) kod = m[1];
  }
  try { return new TextDecoder(kod).decode(b.subarray(bas)); }
  catch { return new TextDecoder("utf-8").decode(b.subarray(bas)); }   // bilinmeyen kodlama adı
}

function zipDosya(zip, yol) {
  if (!yol) return null;
  return zip.file(yol) || zip.file(new RegExp("^" + yol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"))[0] || null;
}

// ---------- paket (OPF) ----------
async function paketOku(blob) {
  const JSZip = await jszip();
  const zip = await JSZip.loadAsync(blob);
  // DRM: içerik şifreliyse metin çöp karakter olarak görünürdü. Yazı tipi karartması (font obfuscation) DRM değildir.
  const sifre = zipDosya(zip, "META-INF/encryption.xml");
  if (sifre) {
    const d = xmlAc(await metinOku(sifre));
    const yontemler = d ? etiketler(d, "EncryptionMethod").map((e) => e.getAttribute("Algorithm") || "") : [];
    if (yontemler.some((a) => !/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/.test(a))) {
      throw Object.assign(new Error(t("EPUB DRM ile korunuyor")), { kod: "drm" });
    }
  }
  const kap = zipDosya(zip, "META-INF/container.xml");
  let opfYol = "";
  if (kap) {
    const d = xmlAc(await metinOku(kap));
    opfYol = d ? ilkEtiket(d, "rootfile")?.getAttribute("full-path") || "" : "";
  }
  if (!opfYol || !zipDosya(zip, opfYol)) opfYol = Object.keys(zip.files).find((y) => /\.opf$/i.test(y)) || "";
  if (!opfYol) throw new Error(t("EPUB paket dosyası (OPF) bulunamadı"));
  const opf = xmlAc(await metinOku(zipDosya(zip, opfYol)));
  if (!opf) throw new Error(t("EPUB paket dosyası okunamadı"));
  const taban = klasorOf(opfYol);

  const meta = ilkEtiket(opf, "metadata") || opf;
  const baslik = bosluk(ilkEtiket(meta, "title")?.textContent) || t("Adsız kitap");
  const yazarlar = etiketler(meta, "creator").map((e) => bosluk(e.textContent)).filter(Boolean);
  const dil = bosluk(ilkEtiket(meta, "language")?.textContent) || "";

  const ogeler = new Map();   // id -> { id, yol, href, tur, ozellik }
  for (const e of etiketler(opf, "item")) {
    const href = e.getAttribute("href") || "";
    ogeler.set(e.getAttribute("id"), {
      id: e.getAttribute("id"), href, yol: coz(taban, href),
      tur: (e.getAttribute("media-type") || "").toLowerCase(), ozellik: e.getAttribute("properties") || "",
    });
  }
  const spineEl = ilkEtiket(opf, "spine");
  const sira = etiketler(opf, "itemref")
    .filter((r) => r.getAttribute("linear") !== "no")
    .map((r) => ogeler.get(r.getAttribute("idref")))
    .filter((o) => o && /html|xml/.test(o.tur || "html"));
  // linear="no" olanlar (dipnot sayfaları vb.) sona eklenmez; okuma akışında yer almazlar
  // Okuma sırasında zip'te gerçekten bulunan bölüm yoksa kitap açılamaz
  if (!sira.some((o) => zipDosya(zip, o.yol))) throw Object.assign(new Error(t("EPUB'da okunacak bölüm yok")), { kod: "bos" });
  // Aşırı büyük bölüm içe aktarırken yakalanır (açılınca sekmeyi düşürmeden önce)
  if (sira.some((o) => zipDosya(zip, o.yol)?._data?.uncompressedSize > METIN_SINIRI)) throw Object.assign(new Error(t("EPUB içinde aşırı büyük bölüm")), { kod: "buyuk" });

  return { zip, opf, taban, baslik, yazar: yazarlar.join(", "), dil, ogeler, sira, ncxId: spineEl?.getAttribute("toc") || "" };
}

// ---------- kapak ----------
function kapakOgesi(pk) {
  const { opf, ogeler } = pk;
  const resim = (o) => o && /^image\//.test(o.tur);
  for (const o of ogeler.values()) if (/\bcover-image\b/.test(o.ozellik) && resim(o)) return o;
  const m = etiketler(opf, "meta").find((e) => e.getAttribute("name") === "cover");
  if (m) {
    const o = ogeler.get(m.getAttribute("content"));
    if (resim(o)) return o;
    for (const x of ogeler.values()) if (resim(x) && x.href === m.getAttribute("content")) return x;
  }
  const ref = etiketler(opf, "reference").find((e) => /cover/i.test(e.getAttribute("type") || ""));
  if (ref) {
    const yol = coz(pk.taban, ref.getAttribute("href") || "");
    for (const o of ogeler.values()) if (resim(o) && o.yol === yol) return o;
  }
  for (const o of ogeler.values()) if (resim(o) && /cover|kapak/i.test(o.id + " " + o.href)) return o;
  return null;
}
// İlk sayfadaki ilk görsel (kapak bildirilmemiş kitaplar)
async function ilkSayfaGorseli(pk) {
  const ilk = pk.sira[0];
  const dosya = ilk && zipDosya(pk.zip, ilk.yol);
  if (!dosya) return null;
  const d = htmlAc(await metinOku(dosya));
  const img = d.querySelector("img[src], image");
  if (!img) return null;
  const src = img.getAttribute("src") || img.getAttribute("href") || img.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
  const yol = coz(klasorOf(ilk.yol), src);
  for (const o of pk.ogeler.values()) if (o.yol === yol) return o;
  return { yol, tur: "image/" + (/\.png$/i.test(yol) ? "png" : "jpeg") };
}

// Kapak küçültülerek saklanır: kitaplık kaydına MB'lık dataURL girmesin
async function kapakUret(pk, genislik = 360) {
  try {
    const o = kapakOgesi(pk) || (await ilkSayfaGorseli(pk));
    const dosya = o && zipDosya(pk.zip, o.yol);
    if (!dosya) return null;
    const blob = new Blob([await dosya.async("arraybuffer")], { type: o.tur || "image/jpeg" });
    // Safari SVG kapağı createImageBitmap ile çözemez: <img> yedeği (OZELLIKLER-7 §3)
    const bmp = await createImageBitmap(blob).catch(() => new Promise((tamam, hata) => {
      const img = new Image(), url = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); tamam(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); hata(e); };
      img.src = url;
    }));
    const olcek = Math.min(1, genislik / bmp.width);
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(bmp.width * olcek));
    cv.height = Math.max(1, Math.round(bmp.height * olcek));
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close?.();
    return cv.toDataURL("image/jpeg", 0.84);
  } catch (hata) {
    console.warn("[epub] kapak üretilemedi:", hata);
    return null;
  }
}

// ---------- içindekiler (nav ya da NCX) ----------
// -> [{ yol, parca, baslik }] belge sırasında
async function icindekilerOku(pk) {
  const { zip, ogeler } = pk;
  const nav = [...ogeler.values()].find((o) => /\bnav\b/.test(o.ozellik));
  if (nav && zipDosya(zip, nav.yol)) {
    const d = htmlAc(await metinOku(zipDosya(zip, nav.yol)));
    const navlar = etiketler(d, "nav");
    const toc = navlar.find((n) => /\btoc\b/.test(n.getAttribute("epub:type") || n.getAttributeNS("http://www.idpf.org/2007/ops", "type") || n.getAttribute("role") || "")) || navlar[0];
    if (toc) {
      const liste = etiketler(toc, "a")
        .filter((a) => a.getAttribute("href"))
        .map((a) => ({ yol: coz(klasorOf(nav.yol), a.getAttribute("href"), nav.yol), parca: parcaOf(a.getAttribute("href")), baslik: bosluk(a.textContent) }))
        .filter((x) => x.yol && x.baslik);
      if (liste.length) return liste;
    }
  }
  const ncx = ogeler.get(pk.ncxId) || [...ogeler.values()].find((o) => o.tur === "application/x-dtbncx+xml");
  if (ncx && zipDosya(zip, ncx.yol)) {
    const d = xmlAc(await metinOku(zipDosya(zip, ncx.yol)));
    if (d) {
      return etiketler(d, "navPoint").map((np) => {
        const src = ilkEtiket(np, "content")?.getAttribute("src") || "";
        const etiket = ilkEtiket(np, "navLabel");
        return { yol: coz(klasorOf(ncx.yol), src, ncx.yol), parca: parcaOf(src), baslik: bosluk(etiket ? ilkEtiket(etiket, "text")?.textContent || etiket.textContent : "") };
      }).filter((x) => x.yol && x.baslik);
    }
  }
  return [];
}

// ---------- HTML -> paragraflar ----------
const BLOK = new Set(["p", "div", "section", "article", "aside", "header", "footer", "main", "blockquote", "li", "ul", "ol", "dl", "dt", "dd",
  "h1", "h2", "h3", "h4", "h5", "h6", "pre", "figure", "figcaption", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "address", "center", "hgroup", "nav"]);
const ATLA = new Set(["script", "style", "head", "title", "noscript", "svg", "math", "img", "image", "video", "audio", "object", "iframe", "rt", "rp"]);
const ITALIK = new Set(["em", "i", "cite", "dfn", "var"]);
const KALIN = new Set(["strong", "b"]);
const BASLIK = /^h[1-6]$/;
// Sahne ayracı gibi duran paragraflar: harf ya da rakam içermeyen kısa simge dizileri (* * *, ⁂, ~, ◆◆◆)
const AYRAC_ESKI = /^[^\p{L}\p{N}]{1,12}$/u;
// Sürüm 2: yalnız bilinen süs simgeleri ya da en az üç tire. Tek "…", "—", "?!" cevap paragrafı metin olarak kalır.
const AYRAC = /^(?:[*⁂✱-✿❀-❋❡-❧◆◇◈◊❖♦♢★☆•●○◦∙⋄~#§¤°=_·]{1,12}|[-–—]{3,12})$/u;
const kacir = (s) => s.replace(/[\\*]/g, (c) => "\\" + c);
// İşaretleri atar, kaçışları çözer: okurun gördüğü düz metin
const duzMetin = (m) => m.replace(/\\(.)|\*/g, (t, c) => c || "");
const SATIR_SONU = "\u2028";   // <br>: paragraf içinde satır sonu (gösterirken "\n")
// Formülün (FA, FB) ve bağlantının (BA, BB) düz karşılığının sınırları: yalnız ayrıştırırken satırda durur, paragraf metnine girmez
const FA = "\uE000", FB = "\uE001", BA = "\uE002", BB = "\uE003";
const sinirsiz = (s) => s.replace(/[\uE000-\uE003]/g, "");
// Sınırlı paragraftan formül ve bağlantı aralıkları (bicimCoz düz metnine göre). Formül sayısı tutmazsa formüller null.
function isaretAraliklari(isaretli, formuller, baglar) {
  const { metin } = bicimCoz(isaretli);
  const mat = [], bag = [];
  let fa = -1, ba = -1, bi = -1, n = 0;
  for (let j = 0; j < metin.length; j++) {
    const c = metin[j];
    if (c === FA) { fa = n; continue; }
    if (c === FB) { if (fa >= 0 && n > fa) mat.push({ a: fa, b: n, ml: formuller[mat.length] }); fa = -1; continue; }
    if (c === BA) { ba = n; bi++; continue; }
    if (c === BB) { if (ba >= 0 && n > ba && baglar[bi]) bag.push({ a: ba, b: n, ...baglar[bi] }); ba = -1; continue; }
    n++;
  }
  return { mat: formuller.length && mat.length === formuller.length ? mat : null, bag: bag.length ? bag : null };
}

// epub:type ve role birlikte: "noteref", "footnote", "doc-noteref" gibi sözcükler aranır
const OPS = "http://www.idpf.org/2007/ops";
const tur = (el) => `${el.getAttribute("epub:type") || el.getAttributeNS?.(OPS, "type") || ""} ${el.getAttribute("role") || ""}`;
const notrefMi = (a) => /\bnoteref\b|\bdoc-noteref\b/.test(tur(a));
const DIS = /^[a-z][a-z0-9+.-]*:/i;
// Liste imleri: ol type (1, a, A, i, I), ul derinliğe göre
function romen(n) {
  const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [d, h] of t) while (n >= d) { s += h; n -= d; }
  return s;
}
function harfSira(n) { let s = ""; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
function imMetni(l, n, d) {
  if (l.tur === "ul") return ["•", "◦", "▪"][(d - 1) % 3];
  const t = l.tip;
  const s = t === "a" ? harfSira(n) : t === "A" ? harfSira(n).toUpperCase() : t === "i" ? romen(n) : t === "I" ? romen(n).toUpperCase() : String(n);
  return s + ".";
}

// Bir HTML belgesini bloklara ayırır. Bloklar: { metin, baslik?, idler: [id], mat?, baglar?, li?, altyazi?, gorseller?,
// tablo?, tabloIci? } ya da { sahne, idler }. idler: bu bloğun içindeki ya da önündeki öğe kimlikleri (içindekiler
// parçaları bölüm başlatır, bağlantılar hedef bulur).
// yeni: sürüm 2 ve sonrası. b: { surum, klasor, yol, notHedef, notEkle(kimlik, metinler), gorselYol(src), kapakYol,
// bekleyen: görseller (dosyalar arasında taşınır), alt: dipnotun kendi metni ayrıştırılıyor }
function bloklaraAyir(govde, yeni, b = {}) {
  const bloklar = [];
  const surum = b.surum || (yeni ? 2 : 1);
  const bekleyen = b.bekleyen || [];
  let satir = "", ital = 0, kalin = 0, idler = [], baslik = false, pre = 0, formuller = [], baglar = [];
  const listeler = [], maddeler = [];   // ol/ul ve li yığınları
  let tablo = null, tabloDerin = 0, altyazi = 0;
  const isle = (ham) => {
    // Sürüm 2'de satır başındaki bölünmez boşluk kalır: <pre> girintisi
    let m = ham.replace(yeni ? /[ \t ]*\u2028[ \t]*/g : /[ \t ]*\u2028[ \t ]*/g, "\n").replace(/[ \t]+/g, " ").replace(/­/g, "");
    m = m.replace(/^[\s\n]+|[\s\n]+$/g, "");
    // Ayrışık harf (s + U+0327) tek harf olur: klavyeden yazılan arama ve vurgu ofsetleri tutsun
    if (yeni) m = m.normalize("NFC");
    return m;
  };
  // İşaretli satır: sınırlar boşluk dizisinin sonuna taşınır, uçlardaki boşluk sınırları aşarak kırpılır.
  // Sınırsız hâli isle(sınırsız satır) ile aynı olmalı; değilse aralıklar alınmaz (metin hiç değişmez).
  const isleIsaretli = (ham) => {
    let m = isle(ham.replace(/([\uE000-\uE003]+)([ \t ]+)/g, "$2$1"));
    m = m.replace(/^([\uE000-\uE003]*)[\s\n]+/, "$1").replace(/[\s\n]+([\uE000-\uE003]*)$/, "$1");
    return m;
  };
  const bitir = () => {
    // Metin sınırsız satırdan kurulur (sınırsız hâliyle aynı); sınırlı hâli aynı metne iniyorsa aralıklar alınır
    const isaretVar = formuller.length || baglar.length;
    const m = isle(isaretVar ? sinirsiz(satir) : satir);
    let mat = null, bag = null;
    if (isaretVar) {
      const isaretli = isleIsaretli(satir);
      if (sinirsiz(isaretli) === m) ({ mat, bag } = isaretAraliklari(isaretli, formuller, baglar));
      formuller = []; baglar = [];
    }
    const duz = duzMetin(m).replace(/\s/g, "");
    if (duz) {
      if ((yeni ? AYRAC : AYRAC_ESKI).test(duz)) bloklar.push({ sahne: true, idler });
      else {
        // Bölüm içi ara başlıklar kalın paragraf olur
        const blok = { metin: baslik && !m.startsWith("**") ? "**" + m + "**" : m, baslik, idler, mat };
        if (bag) blok.baglar = bag;
        if (bekleyen.length) blok.gorseller = bekleyen.splice(0);
        const madde = maddeler[maddeler.length - 1];
        if (madde) { blok.li = madde.kullanildi ? { d: madde.d } : { d: madde.d, i: madde.i }; madde.kullanildi = true; }
        if (altyazi) blok.altyazi = true;
        if (tablo) {
          if (tablo.yakala) { tablo.baslik ||= blok; blok.tabloIci = true; }
          else if (tablo.hucre) { tablo.hucre.ps.push(blok); blok.tabloIci = true; }
          if (blok.tabloIci && !tablo.ilk) tablo.ilk = blok;
        }
        bloklar.push(blok);
      }
      idler = [];
    }
    satir = ""; baslik = false;
  };
  const yuru = (dugum) => {
    if (dugum.nodeType === 3) {
      // <pre>: satırlar ve girinti korunur
      if (pre) satir += kacir(dugum.data.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/ /g, " ").replace(/\n/g, SATIR_SONU));
      else satir += kacir(dugum.data.replace(/\s+/g, " "));
      return;
    }
    if (dugum.nodeType !== 1) return;
    const ad = dugum.localName.toLowerCase();
    // MathML silinmez: yazarın verdiği metin karşılığı (alttext, yoksa TeX açıklaması) yazılır
    if (yeni && ad === "math") {
      const ek = dugum.getAttribute("alttext") || [...dugum.getElementsByTagName("*")].find((e) => e.localName === "annotation")?.textContent || dugum.textContent;
      const t = (ek || "").replace(/\s+/g, " ").trim();
      if (t) {
        satir += FA + kacir(t) + FB;
        formuller.push(new XMLSerializer().serializeToString(dugum));
      }
      return;
    }
    // Görseller paragraf saymaz: sıradaki bloğun önüne çizilir (bekleyen)
    if (!b.alt && b.gorselYol && (ad === "img" || ad === "svg" || ad === "image")) {
      const g = gorselOku(dugum, ad, b);
      if (g) bekleyen.push(g);
      return;
    }
    if (ATLA.has(ad)) return;
    const id = dugum.getAttribute("id");
    // Dipnot: metni kart için ayrıca alınır. Sürüm 3'te ana akışa girmez (kimliği nota gider)
    if (!b.alt && b.notEkle && dugumNotMu(dugum, ad, b)) {
      const ic = bloklaraAyir(dugum, yeni, { surum, alt: true }).filter((x) => x.metin).map((x) => x.metin);
      if (ic.length) {
        if (id) b.notEkle(id, ic);
        for (const e of dugum.querySelectorAll?.("[id]") || []) b.notEkle(e.getAttribute("id"), ic);
      }
      if (surum >= 3 && ic.length) return;
    }
    if (id) idler.push(id);
    if (ad === "br") { satir += SATIR_SONU; return; }
    if (ad === "hr") { bitir(); bloklar.push({ sahne: true, idler }); idler = []; return; }
    const blok = BLOK.has(ad);
    if (blok) bitir();
    const preMi = yeni && ad === "pre";
    if (preMi) pre++;
    if (BASLIK.test(ad)) baslik = true;
    const stil = dugum.getAttribute("style") || "";
    const i = ITALIK.has(ad) || /font-style:\s*italic/.test(stil);
    const k = KALIN.has(ad) || /font-weight:\s*(bold|[6-9]00)/.test(stil);
    // Bağlantı: aralığı düz metinde işaretlenir (dipnotun içindeki geri bağlantı alınmaz)
    const href = ad === "a" && !b.alt ? (dugum.getAttribute("href") || dugum.getAttributeNS?.("http://www.w3.org/1999/xlink", "href") || "").trim() : "";
    const bag = href && href !== "#" ? bagCoz(href, dugum, b) : null;
    // Liste, tablo ve figür bağlamı
    let liste = null, madde = null, tabloAc = false, hucre = null, baslikYakala = false;
    if (ad === "ul" || ad === "ol") {
      const bas = parseInt(dugum.getAttribute("start"), 10);
      liste = { tur: ad, n: ad === "ol" && isFinite(bas) ? bas - 1 : 0, tip: dugum.getAttribute("type") || "" };
      listeler.push(liste);
    } else if (ad === "li" || ad === "dd") {
      const l = listeler[listeler.length - 1];
      const d = Math.max(1, listeler.length);
      if (ad === "li") {
        const deger = parseInt(dugum.getAttribute("value"), 10);
        const ust = l || { tur: "ul", n: 0 };
        ust.n = isFinite(deger) ? deger : ust.n + 1;
        madde = { d, i: imMetni(ust, ust.n, d), kullanildi: false };
      } else madde = { d: Math.max(1, listeler.length), i: "", kullanildi: true };
      maddeler.push(madde);
    } else if (ad === "table") {
      tabloDerin++;
      if (tabloDerin === 1) { tablo = { satirlar: [], baslik: null, hucre: null, yakala: false, ilk: null }; tabloAc = true; }
    } else if (tablo && tabloDerin === 1 && ad === "tr") {
      tablo.satirlar.push([]);
      tablo.hucre = null;
    } else if (tablo && tabloDerin === 1 && (ad === "td" || ad === "th")) {
      if (!tablo.satirlar.length) tablo.satirlar.push([]);
      const sayi = (x) => Math.min(64, Math.max(1, parseInt(dugum.getAttribute(x), 10) || 1));
      hucre = { ps: [], th: ad === "th", cs: sayi("colspan"), rs: sayi("rowspan") };
      tablo.satirlar[tablo.satirlar.length - 1].push(hucre);
      tablo.hucre = hucre;
    } else if (tablo && tabloDerin === 1 && ad === "caption") {
      tablo.yakala = true; baslikYakala = true;
    } else if (ad === "figcaption") altyazi++;
    if (bag) { satir += BA; baglar.push(bag); }
    // Açılış ve kapanış işareti yalnız en dıştaki italik/kalın öğede yazılır
    if (i && ital++ === 0) satir += "*";
    if (k && kalin++ === 0) satir += "**";
    for (let c = dugum.firstChild; c; c = c.nextSibling) yuru(c);
    if (k && --kalin === 0) satir += "**";
    if (i && --ital === 0) satir += "*";
    if (bag) satir += BB;
    if (preMi) pre--;
    if (blok) bitir();
    if (liste) listeler.pop();
    if (madde) maddeler.pop();
    if (hucre && tablo) tablo.hucre = null;
    if (baslikYakala && tablo) tablo.yakala = false;
    if (ad === "figcaption") altyazi--;
    if (ad === "table") {
      tabloDerin--;
      if (tabloAc) {
        if (tablo.ilk) tablo.ilk.tablo = tablo;
        delete tablo.hucre; delete tablo.yakala;
        tablo = null;
      }
    }
  };
  yuru(govde);
  bitir();
  return bloklar;
}

// Dipnot mu: epub:type ya da role; ya da noteref bağlantısının hedefi olan <aside>
function dugumNotMu(el, ad, b) {
  const t = tur(el);
  if (/\b(footnote|endnote|rearnote)\b|\bdoc-(footnote|endnote)\b/.test(t)) return true;
  if (ad === "aside" && /\bnote\b/.test(t)) return true;
  const id = el.getAttribute("id");
  return ad === "aside" && !!id && !!b.notHedef?.has(b.anahtar(b.yol, id));
}
// href -> { h: "dosya#kimlik" } ya da { dis: adres }; noteref ise not: true
function bagCoz(href, a, b) {
  if (DIS.test(href)) return /^(https?|mailto):/i.test(href) ? { dis: href } : null;
  if (!b.yol) return null;
  const yol = coz(b.klasor, href, b.yol), parca = parcaOf(href);
  const x = { h: b.anahtar(yol, parca) };
  if (notrefMi(a)) x.not = true;
  return x;
}
// <img>, <image> ve satır içi <svg>. Görsel yalnız kaynağıyla; ölçüler sonra (gorselleriOlc)
function gorselOku(el, ad, b) {
  const xl = "http://www.w3.org/1999/xlink";
  const alt = (el.getAttribute("alt") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  const sayi = (x) => { const v = parseFloat(el.getAttribute(x)); return isFinite(v) && v > 0 ? v : 0; };
  if (ad === "img" || ad === "image") {
    const src = el.getAttribute("src") || el.getAttribute("href") || el.getAttributeNS(xl, "href") || "";
    if (!src || DIS.test(src)) return null;
    const yol = b.gorselYol(src);
    if (!yol || yol === b.kapakYol) return null;
    return { tur: "gorsel", yol, alt, en: sayi("width"), boy: sayi("height") };
  }
  // SVG: tek <image> taşıyorsa (kapak, tam sayfa resim) o resim; yoksa SVG'nin kendisi
  const vb = (el.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const en = sayi("width") || (vb.length === 4 ? vb[2] : 0), boy = sayi("height") || (vb.length === 4 ? vb[3] : 0);
  const ciz = [...el.getElementsByTagName("*")].filter((e) => /^(path|rect|circle|ellipse|line|polyline|polygon|text|use|g)$/.test(e.localName));
  const resim = [...el.getElementsByTagName("*")].find((e) => e.localName === "image");
  const baslikEl = [...el.childNodes].find((e) => e.localName === "title");
  const ad2 = alt || (baslikEl?.textContent || "").replace(/\s+/g, " ").trim();
  if (resim && !ciz.some((e) => e.localName !== "g")) {
    const g = gorselOku(resim, "image", b);
    if (g) { g.alt ||= ad2; if (!g.en && en) { g.en = en; g.boy = boy; } }
    return g;
  }
  if (!ciz.length) return null;
  let svg = new XMLSerializer().serializeToString(el);
  if (!/xmlns=/.test(svg.slice(0, 200))) svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (svg.length > 512 * 1024) return null;   // aşırı büyük satır içi SVG atlanır
  return { tur: "svg", svg, alt: ad2, en: en || 300, boy: boy || 150 };
}

// ---------- görsel ölçüleri ----------
// Başlıktan okunur (PNG, GIF, JPEG, WebP, SVG): bütün resmi çözmeden. Olmazsa createImageBitmap.
function baslikOlcusu(b) {
  const u32 = (i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return { en: u32(16), boy: u32(20) };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { en: b[6] | b[7] << 8, boy: b[8] | b[9] << 8 };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const boy = b[i + 2] << 8 | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { boy: b[i + 5] << 8 | b[i + 6], en: b[i + 7] << 8 | b[i + 8] };
      i += 2 + boy;
    }
    return null;
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {   // RIFF....WEBP
    const k = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (k === "VP8X") return { en: 1 + (b[24] | b[25] << 8 | b[26] << 16), boy: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
    if (k === "VP8L") { const v = b[21] | b[22] << 8 | b[23] << 16 | b[24] << 24; return { en: 1 + (v & 0x3fff), boy: 1 + ((v >> 14) & 0x3fff) }; }
    if (k === "VP8 ") return { en: (b[26] | b[27] << 8) & 0x3fff, boy: (b[28] | b[29] << 8) & 0x3fff };
  }
  const ust = new TextDecoder().decode(b.subarray(0, 2048));
  const s = ust.match(/<svg\b[^>]*>/i)?.[0];
  if (s) {
    const oz = (x) => { const m = s.match(new RegExp(`\\b${x}\\s*=\\s*["']([\\d.]+)(px)?["']`)); return m ? +m[1] : 0; };
    const vb = s.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]?.split(/[\s,]+/).map(Number) || [];
    const en = oz("width") || vb[2] || 0, boy = oz("height") || vb[3] || 0;
    if (en && boy) return { en, boy };
  }
  return null;
}
const TURLER = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp" };
const resimTuru = (yol, ogeler) => {
  for (const o of ogeler.values()) if (o.yol === yol && /^image\//.test(o.tur)) return o.tur;
  return TURLER[(yol.match(/\.(\w+)$/)?.[1] || "").toLowerCase()] || "image/jpeg";
};
async function gorselleriOlc(pk, gorseller, bekle) {
  const olcu = new Map();
  let n = 0;
  for (const g of gorseller) {
    if (g.tur !== "gorsel") continue;
    if (!olcu.has(g.yol)) {
      let o = null;
      const f = zipDosya(pk.zip, g.yol);
      if (f) {
        try {
          const b = await f.async("uint8array");
          o = baslikOlcusu(b);
          if (!o && typeof createImageBitmap === "function") {
            const bmp = await createImageBitmap(new Blob([b], { type: resimTuru(g.yol, pk.ogeler) }));
            o = { en: bmp.width, boy: bmp.height };
            bmp.close?.();
          }
        } catch { o = null; }
      }
      olcu.set(g.yol, o && o.en > 0 && o.boy > 0 ? o : null);
      if (bekle && ++n % 12 === 0) await bekle();
    }
    const o = olcu.get(g.yol);
    if (o) { g.en = o.en; g.boy = o.boy; }
    else if (!(g.en > 0 && g.boy > 0)) { g.en = 800; g.boy = 600; }   // ölçülemeyen: 4:3 yer ayrılır
  }
}

const kelime = (s) => (s.match(/\S+/g) || []).length;

// ---------- dışa açık ----------
export async function epubBilgi(blob) {
  const pk = await paketOku(blob);
  return { baslik: pk.baslik, yazar: pk.yazar, kapak: await kapakUret(pk) };
}

// surum: ayrıştırma sürümü (epubSurumu). bekle: dosyalar arasında beklenir (dizinleme kalemi bekletmesin).
// kapak: false ise kapak çözülmez (okuma ve dizinleme kullanmıyor). gorsel: false ise görseller ölçülmez.
export async function epubAc(blob, { surum = EPUB_SURUM, bekle = null, kapak: kapakIste = true, gorsel: gorselOlcIste = true } = {}) {
  const yeni = surum >= 2;
  const pk = await paketOku(blob);
  const [toc, kapak] = await Promise.all([icindekilerOku(pk), kapakIste ? kapakUret(pk) : null]);

  // Dosya -> o dosyadaki içindekiler girdileri (parça kimliğiyle).
  // Sürüm 2'de yol büyük-küçük harf duyarsız: nav "text/ch1.xhtml", manifest "Text/ch1.xhtml" diyebilir.
  const yolAnahtar = (y) => (yeni ? y.toLowerCase() : y);
  const anahtar = (yol, parca) => `${yolAnahtar(yol)}#${parca || ""}`;
  const tocDosya = new Map();
  for (const t of toc) {
    const a = yolAnahtar(t.yol);
    if (!tocDosya.has(a)) tocDosya.set(a, []);
    tocDosya.get(a).push(t);
  }

  const bolumler = [];   // { baslik, paragraflar: [blok | SAHNE], kelime, tocVar }
  let simdiki = null;
  const yeniBolum = (baslik, tocVar) => { simdiki = { baslik, paragraflar: [], kelime: 0, tocVar }; bolumler.push(simdiki); };

  // Bağlantı hedefleri ve dipnotlar. Kimlik -> blok; paragraf sırasına çevrilmesi en sonda (birleştirme sırayı bozmaz)
  const hedefBlok = new Map(), notlar = {}, notHedef = new Set();
  const bekleyen = [];          // sıradaki bloğa bağlanacak görseller (dosyalar arasında taşınır)
  let tasinanId = [];           // atlanan bloğun (tekrarlanan bölüm başlığı, sahne) kimlikleri sıradakine
  const tasinanGorselOn = [];   // atlanan başlığın görselleri sıradaki paragrafın önüne
  const kapakYol = kapakOgesi(pk)?.yol || "";

  for (const oge of pk.sira) {
    const dosya = zipDosya(pk.zip, oge.yol);
    if (!dosya) continue;
    if (bekle) await bekle();
    const d = htmlAc(await metinOku(dosya));
    const govde = d.body || ilkEtiket(d, "body") || d.documentElement;
    const klasor = klasorOf(oge.yol);
    // Ön tarama: noteref hedefleri (hedefi <aside> olan dipnot bu dosyada da, sonraki dosyada da tanınır)
    for (const a of etiketler(d, "a")) {
      const href = a.getAttribute("href") || "";
      if (href && !DIS.test(href) && notrefMi(a)) notHedef.add(anahtar(coz(klasor, href, oge.yol), parcaOf(href)));
    }
    const bloklar = bloklaraAyir(govde, yeni, {
      surum, yol: oge.yol, klasor, notHedef, anahtar, kapakYol, bekleyen,
      gorselYol: (src) => coz(klasor, src),
      notEkle: (id, ic) => { const k = anahtar(oge.yol, id); if (!notlar[k]) notlar[k] = ic; },
    });
    const girdiler = tocDosya.get(yolAnahtar(oge.yol)) || [];
    const parcasiz = girdiler.find((g) => !g.parca);
    const parcali = new Map(girdiler.filter((g) => g.parca).map((g) => [g.parca, g]));
    // Dosyanın başı: parçasız girdi varsa ya da ilk parçalı girdi ilk bloğu işaret ediyorsa yeni bölüm
    if (parcasiz) yeniBolum(parcasiz.baslik, true);
    else if (!toc.length) yeniBolum("", false);           // içindekiler yok: her dosya bir bölüm
    else if (!simdiki) yeniBolum("", false);               // içindekilerden önceki sayfalar (kapak, künye)
    let ilkBlok = true, dosyaBasi = anahtar(oge.yol, "");
    for (const b of bloklar) {
      const g = b.idler.map((id) => parcali.get(id)).find(Boolean);
      if (g) {
        // Aynı dosyada yeni bölüm başlar; henüz boş olan bölüm bu girdiyi üstlenir
        const bos = simdiki && !simdiki.paragraflar.length;
        if (bos && (!simdiki.tocVar || simdiki.baslik === g.baslik)) { simdiki.baslik = g.baslik; simdiki.tocVar = true; }
        else if (!(parcasiz && ilkBlok)) yeniBolum(g.baslik, true);
        for (const id of b.idler) parcali.delete(id);
      }
      ilkBlok = false;
      if (b.sahne) {
        const ps = simdiki.paragraflar;
        if (ps.length && ps[ps.length - 1] !== SAHNE) ps.push(SAHNE);
        tasinanId.push(...b.idler.map((id) => anahtar(oge.yol, id)));
        continue;
      }
      // Bölümün ilk başlığı bölüm adıyla aynıysa (ya da bölümün adı yoksa) tekrar yazılmaz
      if (b.baslik && !simdiki.paragraflar.length) {
        const duz = duzMetin(b.metin).replace(/\n/g, " ");
        let atla = false;
        if (!simdiki.baslik) { simdiki.baslik = duz; atla = true; }
        else {
          const a = duz.toLocaleLowerCase("tr").replace(/\s+/g, " "), bb = simdiki.baslik.toLocaleLowerCase("tr").replace(/\s+/g, " ");
          atla = a === bb || bb.includes(a) || a.includes(bb);
        }
        if (atla) {
          // Atlanan başlığın görselleri ve kimlikleri sıradaki paragrafa geçer
          if (b.gorseller) tasinanGorselOn.push(...b.gorseller);
          tasinanId.push(...b.idler.map((id) => anahtar(oge.yol, id)));
          continue;
        }
      }
      if (tasinanGorselOn.length) { b.gorseller = [...tasinanGorselOn.splice(0), ...(b.gorseller || [])]; }
      simdiki.paragraflar.push(b);
      simdiki.kelime += kelime(duzMetin(b.metin));
      for (const k of tasinanId) if (!hedefBlok.has(k)) hedefBlok.set(k, b);
      tasinanId = [];
      if (dosyaBasi) { if (!hedefBlok.has(dosyaBasi)) hedefBlok.set(dosyaBasi, b); dosyaBasi = ""; }
      for (const id of b.idler) { const k = anahtar(oge.yol, id); if (!hedefBlok.has(k)) hedefBlok.set(k, b); }
    }
    if (dosyaBasi) tasinanId.push(dosyaBasi);   // metinsiz dosya: başı sıradaki paragraf
    // Dosyanın sonunda kalan görseller bölümün son paragrafından sonra (paragraf yoksa sıradaki paragrafın önüne)
    const son = simdiki && [...simdiki.paragraflar].reverse().find((x) => x !== SAHNE);
    if (son) {
      if (tasinanGorselOn.length) (son.sonra ||= []).push(...tasinanGorselOn.splice(0));
      if (bekleyen.length) (son.sonra ||= []).push(...bekleyen.splice(0));
    }
  }
  if (bekleyen.length) tasinanGorselOn.push(...bekleyen.splice(0));

  // Akış dışındaki (linear="no") dosyalardaki dipnotlar: noteref hedefi varsa kart için okunur
  const eksik = [...notHedef].filter((k) => !notlar[k] && !hedefBlok.has(k));
  if (eksik.length) {
    const akis = new Set(pk.sira.map((o) => yolAnahtar(o.yol)));
    const dosyalar = new Map();
    for (const k of eksik) {
      const y = k.slice(0, k.indexOf("#"));
      if (akis.has(y)) continue;
      if (!dosyalar.has(y)) dosyalar.set(y, []);
      dosyalar.get(y).push(k);
    }
    for (const [y, anahtarlar] of dosyalar) {
      const o = [...pk.ogeler.values()].find((x) => yolAnahtar(x.yol) === y);
      const dosya = o && zipDosya(pk.zip, o.yol);
      if (!dosya) continue;
      try {
        const d = htmlAc(await metinOku(dosya));
        const kimlikli = new Map([...d.getElementsByTagName("*")].filter((e) => e.getAttribute("id")).map((e) => [e.getAttribute("id"), e]));
        for (const k of anahtarlar) {
          const el = kimlikli.get(k.slice(k.indexOf("#") + 1));
          if (!el) continue;
          const ic = bloklaraAyir(el, yeni, { surum, alt: true }).filter((x) => x.metin).map((x) => x.metin);
          if (ic.length) notlar[k] = ic;
        }
      } catch { /* bozuk not dosyası: kart açılmaz */ }
    }
  }

  // Sahne ayracı bölümün başında ya da sonunda kalmaz; boş bölümler atılır
  for (const b of bolumler) {
    while (b.paragraflar[0] === SAHNE) b.paragraflar.shift();
    while (b.paragraflar[b.paragraflar.length - 1] === SAHNE) b.paragraflar.pop();
  }
  // Atılan (metinsiz) bölümün görselleri sıradaki dolu bölümün başına
  let tasinanGorsel = [];
  for (const b of bolumler) {
    if (b.kelime > 0) {
      const ilk = b.paragraflar.find((x) => x !== SAHNE);
      if (tasinanGorsel.length && ilk) { ilk.gorseller = [...tasinanGorsel, ...(ilk.gorseller || [])]; tasinanGorsel = []; }
      continue;
    }
    for (const x of b.paragraflar) if (x !== SAHNE) tasinanGorsel.push(...(x.gorseller || []), ...(x.sonra || []));
  }
  tasinanGorsel.push(...tasinanGorselOn.splice(0));
  let dolu = bolumler.filter((b) => b.kelime > 0);
  // Çok kısa bölümler (kapak, künye, ithaf) komşusuyla birleşir: başta olanlar sonrakine, ötekiler öncekine
  const KISA = 40;
  const birlesik = [];
  let bekleyenB = [];
  for (const b of dolu) {
    if (b.kelime < KISA && dolu.length > 1) {
      if (birlesik.length) {
        const o = birlesik[birlesik.length - 1];
        o.paragraflar.push(SAHNE, ...b.paragraflar);
        o.kelime += b.kelime;
      } else bekleyenB.push(b);
      continue;
    }
    if (bekleyenB.length) {
      const on = bekleyenB.flatMap((x, i) => (i ? [SAHNE, ...x.paragraflar] : x.paragraflar));
      b.paragraflar = [...on, SAHNE, ...b.paragraflar];
      b.kelime += bekleyenB.reduce((t, x) => t + x.kelime, 0);
      bekleyenB = [];
    }
    birlesik.push(b);
  }
  if (bekleyenB.length) birlesik.push(...bekleyenB);
  dolu = birlesik;

  // Bloklar paragraf dizgisine ve bölümün süs alanlarına çevrilir (j: paragraf dizisindeki yer)
  const yer = new Map();   // blok -> [bölüm sırası, j]
  dolu.forEach((b, bi) => b.paragraflar.forEach((x, j) => { if (x !== SAHNE) yer.set(x, [bi, j]); }));
  const tumGorseller = [];
  let n = 0;
  const cikti = dolu.map((b, bi) => {
    const ps = b.paragraflar;
    const bolum = { no: ++n, baslik: (yeni ? b.baslik.normalize("NFC") : b.baslik) || t("{n}. kısım", { n }), paragraflar: ps.map((x) => (x === SAHNE ? SAHNE : x.metin)) };
    const matematik = {}, ekler = {}, liste = {}, baglar = {}, altyazi = {}, tablolar = [];
    const ekle = (j, gs) => { if (gs?.length) { (ekler[j] ||= []).push(...gs); tumGorseller.push(...gs); } };
    ps.forEach((x, j) => {
      if (x === SAHNE) return;
      if (x.mat) matematik[j] = x.mat;
      ekle(j, x.gorseller);
      ekle(j + 1, x.sonra);
      if (x.li) liste[j] = x.li;
      if (x.baglar) baglar[j] = x.baglar;
      if (x.altyazi) altyazi[j] = 1;
      if (x.tablo) {
        const t = x.tablo, burada = (p) => yer.get(p)?.[0] === bi;
        const satirlar = t.satirlar.map((s) => s.map((c) => ({ p: c.ps.filter(burada).map((p) => yer.get(p)[1]), th: c.th, cs: c.cs, rs: c.rs })));
        if (satirlar.some((s) => s.some((c) => c.p.length))) {
          tablolar.push({ ilk: j, baslik: t.baslik && burada(t.baslik) ? yer.get(t.baslik)[1] : null, satirlar });
        }
      }
    });
    const dolum = (o, ad) => { if (Object.keys(o).length) bolum[ad] = o; };
    dolum(matematik, "matematik"); dolum(ekler, "ekler"); dolum(liste, "liste"); dolum(baglar, "baglar"); dolum(altyazi, "altyazi");
    if (tablolar.length) bolum.tablolar = tablolar;
    return bolum;
  });
  // Yerleşecek bölüm bulamayan görseller son bölümün sonuna
  if (tasinanGorsel.length && cikti.length) {
    const s = cikti[cikti.length - 1], j = s.paragraflar.length;
    ((s.ekler ||= {})[j] ||= []).push(...tasinanGorsel);
    tumGorseller.push(...tasinanGorsel);
  }
  if (gorselOlcIste && tumGorseller.length) await gorselleriOlc(pk, tumGorseller, bekle);

  const hedefler = {};
  for (const [k, blok] of hedefBlok) { const y = yer.get(blok); if (y) hedefler[k] = y; }
  // Görsel dosyası ancak istenince açılır (okuma.js görünür olunca); zip, kitap çözümü yaşadıkça tutulur
  const gorselAl = async (yol) => {
    const f = zipDosya(pk.zip, yol);
    if (!f) return null;
    return new Blob([await f.async("arraybuffer")], { type: resimTuru(yol, pk.ogeler) });
  };
  return {
    baslik: pk.baslik,
    yazar: pk.yazar,
    kapak: kapak || undefined,
    dil: pk.dil || undefined,
    bolumler: cikti,
    hedefler, notlar, gorselAl,
  };
}

// Belge başına paylaşılan çözüm: kitap eklenip hemen açılınca okuma.js ile arama.js aynı dosyayı iki kez çözmesin.
// Okuma beklemesiz ister; dizinleme başlattıysa okuma katılınca bekleme kalkar (acele).
// Bırakılan çözüm 15 sn tutulur: mod ya da sayfa değişince belge yeniden açılabilir.
const COZUMLER = new Map();   // `${id}:${surum}` -> { soz, kullanan, acele, z }
export function epubCoz(id, blobGetir, { surum = EPUB_SURUM, bekle = null } = {}) {
  const anahtar = `${id}:${surum}`;
  let g = COZUMLER.get(anahtar);
  if (!g) {
    g = { soz: null, kullanan: 0, acele: !bekle, z: 0 };
    g.soz = (async () => {
      const blob = await blobGetir();
      if (!blob) throw new Error("EPUB dosyası bulunamadı: " + id);
      return epubAc(blob, { surum, kapak: false, bekle: bekle && (() => (g.acele ? null : bekle())) });
    })();
    g.soz.catch(() => { if (COZUMLER.get(anahtar) === g) COZUMLER.delete(anahtar); });
    COZUMLER.set(anahtar, g);
  }
  if (!bekle) g.acele = true;
  clearTimeout(g.z);
  g.kullanan++;
  let birakildi = false;
  const birak = () => {
    if (birakildi) return;
    birakildi = true;
    if (--g.kullanan > 0) return;
    g.z = setTimeout(() => { if (!g.kullanan && COZUMLER.get(anahtar) === g) COZUMLER.delete(anahtar); }, 15000);
  };
  return { soz: g.soz, birak };
}

// Paragraf dizgisini okurun gördüğü düz metne ve biçim aralıklarına ayırır.
// Vurgu ofsetleri (okuma.js belge.veri.vurgular) bu düz metne göredir; dışa aktarma da bunu kullanmalı.
// -> { metin, bicim: [{ a, b, i, k }] | null }   i: italik, k: kalın
export function bicimCoz(ham) {
  if (!/[*\\]/.test(ham)) return { metin: ham, bicim: null };
  let metin = "", i = false, k = false, bas = 0;
  const bicim = [];
  const kes = () => { if ((i || k) && metin.length > bas) bicim.push({ a: bas, b: metin.length, i, k }); bas = metin.length; };
  for (let j = 0; j < ham.length; j++) {
    const c = ham[j];
    if (c === "\\" && j + 1 < ham.length) { metin += ham[++j]; continue; }
    if (c !== "*") { metin += c; continue; }
    kes();
    if (ham[j + 1] === "*") { k = !k; j++; } else i = !i;
  }
  kes();
  return { metin, bicim: bicim.length ? bicim : null };
}
