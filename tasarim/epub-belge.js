// Gerçek EPUB'u okuma.js'in metin modeline çevirir (OZELLIKLER-3 §4). epub.js gerekmez: JSZip + DOMParser.
//
// epubAc(blob, { surum, bekle, kapak }) -> { baslik, yazar, kapak?, dil?, bolumler: [{ no, baslik, paragraflar: [string | "***"] }] }
// epubCoz(id, blobGetir, { surum, bekle }) -> epubAc sonucu, belge başına paylaşılan önbellekten (okuma.js + arama.js)
// epubBilgi(blob) -> { baslik, yazar, kapak }   (kitaplığa alırken: yalnız OPF ve kapak, metin okunmaz)
//
// Paragraf metni düz yazıdır, okuma-metni.js ile aynı biçim. Tek ek: italik *böyle*, kalın **böyle**,
// metindeki gerçek yıldız ve ters bölü \* ve \\ olarak kaçırılır. okuma.js gösterirken bunu çözer.
// Bilinen sınır: görseller ve tablolar düz metne iner (görsel atlanır, tablo hücreleri paragraf olur).

export const SAHNE = "***";

// Ayrıştırma sürümü. Paragraf numaraları (vurgu, çizgi, tuval, konum) ayrıştırmaya bağlı olduğu için
// daha önce açılmış kitap eski sürümle ayrışmaya devam eder; yeni kitap son sürümle açılır.
// 2: NFC, <math> metni, <pre> satırları, yalnız bilinen sahne ayraçları, içindekilerde büyük-küçük harf duyarsız yol
export const EPUB_SURUM = 2;
export function epubSurumu(belge) {
  const v = belge?.veri;
  if (!v || v.kurulmadi) return EPUB_SURUM;
  return v.epubSurum || 1;
}

// ---------- JSZip ----------
// index.html klasik script olarak yüklemediyse bir kez buradan yüklenir
let zipYukleniyor = null;
function jszip() {
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
async function metinOku(dosya) {
  const b = await dosya.async("uint8array");
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
  const kap = zipDosya(zip, "META-INF/container.xml");
  let opfYol = "";
  if (kap) {
    const d = xmlAc(await metinOku(kap));
    opfYol = d ? ilkEtiket(d, "rootfile")?.getAttribute("full-path") || "" : "";
  }
  if (!opfYol || !zipDosya(zip, opfYol)) opfYol = Object.keys(zip.files).find((y) => /\.opf$/i.test(y)) || "";
  if (!opfYol) throw new Error("EPUB paket dosyası (OPF) bulunamadı");
  const opf = xmlAc(await metinOku(zipDosya(zip, opfYol)));
  if (!opf) throw new Error("EPUB paket dosyası okunamadı");
  const taban = klasorOf(opfYol);

  const meta = ilkEtiket(opf, "metadata") || opf;
  const baslik = bosluk(ilkEtiket(meta, "title")?.textContent) || "Adsız kitap";
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

// Bir HTML belgesini bloklara ayırır. Bloklar: { metin, baslik?, idler: [id] } ya da { sahne }.
// idler: bu bloğun içindeki ya da önündeki öğe kimlikleri (içindekiler parçaları bölüm başlatır).
// yeni: s\u00FCr\u00FCm 2 ve sonras\u0131 (EPUB_SURUM)
function bloklaraAyir(govde, yeni) {
  const bloklar = [];
  let satir = "", ital = 0, kalin = 0, idler = [], baslik = false, pre = 0;
  const bitir = () => {
    // S\u00FCr\u00FCm 2'de sat\u0131r ba\u015F\u0131ndaki b\u00F6l\u00FCnmez bo\u015Fluk kal\u0131r: <pre> girintisi
    let m = satir.replace(yeni ? /[ \t\u00A0]*\u2028[ \t]*/g : /[ \t\u00A0]*\u2028[ \t\u00A0]*/g, "\n").replace(/[ \t]+/g, " ").replace(/\u00AD/g, "");
    m = m.replace(/^[\s\n]+|[\s\n]+$/g, "");
    // Ayr\u0131\u015F\u0131k harf (s + U+0327) tek harf olur: klavyeden yaz\u0131lan arama ve vurgu ofsetleri tutsun
    if (yeni) m = m.normalize("NFC");
    const duz = duzMetin(m).replace(/\s/g, "");
    if (duz) {
      if ((yeni ? AYRAC : AYRAC_ESKI).test(duz)) bloklar.push({ sahne: true, idler });
      // Bölüm içi ara başlıklar kalın paragraf olur
      else bloklar.push({ metin: baslik && !m.startsWith("**") ? "**" + m + "**" : m, baslik, idler });
      idler = [];
    }
    satir = ""; baslik = false;
  };
  const yuru = (dugum) => {
    if (dugum.nodeType === 3) {
      // <pre>: satırlar ve girinti korunur
      if (pre) satir += kacir(dugum.data.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/ /g, "\u00A0").replace(/\n/g, SATIR_SONU));
      else satir += kacir(dugum.data.replace(/\s+/g, " "));
      return;
    }
    if (dugum.nodeType !== 1) return;
    const ad = dugum.localName.toLowerCase();
    // MathML silinmez: yazarın verdiği metin karşılığı (alttext, yoksa TeX açıklaması) yazılır
    if (yeni && ad === "math") {
      const ek = dugum.getAttribute("alttext") || [...dugum.getElementsByTagName("*")].find((e) => e.localName === "annotation")?.textContent || dugum.textContent;
      const t = (ek || "").replace(/\s+/g, " ").trim();
      if (t) satir += kacir(t);
      return;
    }
    if (ATLA.has(ad)) return;
    const id = dugum.getAttribute("id");
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
    // Açılış ve kapanış işareti yalnız en dıştaki italik/kalın öğede yazılır
    if (i && ital++ === 0) satir += "*";
    if (k && kalin++ === 0) satir += "**";
    for (let c = dugum.firstChild; c; c = c.nextSibling) yuru(c);
    if (k && --kalin === 0) satir += "**";
    if (i && --ital === 0) satir += "*";
    if (preMi) pre--;
    if (blok) bitir();
  };
  yuru(govde);
  bitir();
  return bloklar;
}

const kelime = (s) => (s.match(/\S+/g) || []).length;

// ---------- dışa açık ----------
export async function epubBilgi(blob) {
  const pk = await paketOku(blob);
  return { baslik: pk.baslik, yazar: pk.yazar, kapak: await kapakUret(pk) };
}

// surum: ayrıştırma sürümü (epubSurumu). bekle: dosyalar arasında beklenir (dizinleme kalemi bekletmesin).
// kapak: false ise kapak çözülmez (okuma ve dizinleme kullanmıyor).
export async function epubAc(blob, { surum = EPUB_SURUM, bekle = null, kapak: kapakIste = true } = {}) {
  const yeni = surum >= 2;
  const pk = await paketOku(blob);
  const [toc, kapak] = await Promise.all([icindekilerOku(pk), kapakIste ? kapakUret(pk) : null]);

  // Dosya -> o dosyadaki içindekiler girdileri (parça kimliğiyle).
  // Sürüm 2'de yol büyük-küçük harf duyarsız: nav "text/ch1.xhtml", manifest "Text/ch1.xhtml" diyebilir.
  const yolAnahtar = (y) => (yeni ? y.toLowerCase() : y);
  const tocDosya = new Map();
  for (const t of toc) {
    const a = yolAnahtar(t.yol);
    if (!tocDosya.has(a)) tocDosya.set(a, []);
    tocDosya.get(a).push(t);
  }

  const bolumler = [];   // { baslik, paragraflar, kelime, tocVar }
  let simdiki = null;
  const yeniBolum = (baslik, tocVar) => { simdiki = { baslik, paragraflar: [], kelime: 0, tocVar }; bolumler.push(simdiki); };

  for (const oge of pk.sira) {
    const dosya = zipDosya(pk.zip, oge.yol);
    if (!dosya) continue;
    if (bekle) await bekle();
    const d = htmlAc(await metinOku(dosya));
    const govde = d.body || ilkEtiket(d, "body") || d.documentElement;
    const bloklar = bloklaraAyir(govde, yeni);
    const girdiler = tocDosya.get(yolAnahtar(oge.yol)) || [];
    const parcasiz = girdiler.find((g) => !g.parca);
    const parcali = new Map(girdiler.filter((g) => g.parca).map((g) => [g.parca, g]));
    // Dosyanın başı: parçasız girdi varsa ya da ilk parçalı girdi ilk bloğu işaret ediyorsa yeni bölüm
    if (parcasiz) yeniBolum(parcasiz.baslik, true);
    else if (!toc.length) yeniBolum("", false);           // içindekiler yok: her dosya bir bölüm
    else if (!simdiki) yeniBolum("", false);               // içindekilerden önceki sayfalar (kapak, künye)
    let ilkBlok = true;
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
        continue;
      }
      // Bölümün ilk başlığı bölüm adıyla aynıysa (ya da bölümün adı yoksa) tekrar yazılmaz
      if (b.baslik && !simdiki.paragraflar.length) {
        const duz = duzMetin(b.metin).replace(/\n/g, " ");
        if (!simdiki.baslik) { simdiki.baslik = duz; continue; }
        const a = duz.toLocaleLowerCase("tr").replace(/\s+/g, " "), bb = simdiki.baslik.toLocaleLowerCase("tr").replace(/\s+/g, " ");
        if (a === bb || bb.includes(a) || a.includes(bb)) continue;
      }
      simdiki.paragraflar.push(b.metin);
      simdiki.kelime += kelime(duzMetin(b.metin));
    }
  }

  // Sahne ayracı bölümün başında ya da sonunda kalmaz; boş bölümler atılır
  for (const b of bolumler) {
    while (b.paragraflar[0] === SAHNE) b.paragraflar.shift();
    while (b.paragraflar[b.paragraflar.length - 1] === SAHNE) b.paragraflar.pop();
  }
  let dolu = bolumler.filter((b) => b.kelime > 0);
  // Çok kısa bölümler (kapak, künye, ithaf) komşusuyla birleşir: başta olanlar sonrakine, ötekiler öncekine
  const KISA = 40;
  const birlesik = [];
  let bekleyen = [];
  for (const b of dolu) {
    if (b.kelime < KISA && dolu.length > 1) {
      if (birlesik.length) {
        const o = birlesik[birlesik.length - 1];
        o.paragraflar.push(SAHNE, ...b.paragraflar);
        o.kelime += b.kelime;
      } else bekleyen.push(b);
      continue;
    }
    if (bekleyen.length) {
      const on = bekleyen.flatMap((x, i) => (i ? [SAHNE, ...x.paragraflar] : x.paragraflar));
      b.paragraflar = [...on, SAHNE, ...b.paragraflar];
      b.kelime += bekleyen.reduce((t, x) => t + x.kelime, 0);
      bekleyen = [];
    }
    birlesik.push(b);
  }
  if (bekleyen.length) birlesik.push(...bekleyen);
  dolu = birlesik;

  let n = 0;
  return {
    baslik: pk.baslik,
    yazar: pk.yazar,
    kapak: kapak || undefined,
    dil: pk.dil || undefined,
    bolumler: dolu.map((b) => ({ no: ++n, baslik: (yeni ? b.baslik.normalize("NFC") : b.baslik) || `${n}. kısım`, paragraflar: b.paragraflar })),
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
