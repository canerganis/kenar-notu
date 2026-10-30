// Bütün kitaplıkta arama (OZELLIKLER-4 §3, sözleşme "arama.js").
//   ac(kap, { terim })  ekran modülü; kapat(); dizinle(belgeId) tek belgeyi yeniden dizinler.
//
// Dizin kendi IndexedDB'sinde, "kenar-notu-arama" (kayit.js'e dokunmaz):
//   meta:  <belgeId> -> { imza, eksik?, adet, zaman }   eksik: yarım kalan PDF'te sıradaki sayfa (0'dan)
//   govde: <belgeId> -> { tur, parcalar, bolumler? }
//     PDF:  parcalar [{ i (dosyadaki sayfa, 0'dan), m (metin, NFC), k (katlanmış m, aynı uzunlukta) }]
//     EPUB: parcalar [{ p (okuma.js paragraf no), m, k }], bolumler [{ ad, ilk (ilk paragraf no) }]
// Ağır gövde (sayfa metinleri, paragraflar) arka planda, boşta ve dilim dilim dizinlenir; kalem yazarken durur.
// Belge notları, kırpıntılar ve kartlar zaten bellekte ve küçük: her aramada belge verisinden okunur, hep günceldir.
// Ekran sayfa numarasını açılışta belgenin o anki sayfa düzeninden çözer (Masa'da araya sayfa eklenmiş olabilir).

import { h, icon, bus, store, belgeBul, komutlar, acikEkran, odakla, cizgiMi } from "./ortak.js";
import { dosyaGetir } from "./kayit.js";
import * as SAYFALAR from "./sayfalar.js";
import METIN, { SAHNE } from "./okuma-metni.js";
import { epubSurumu } from "./epub-belge.js";

const SURUM = 4;   // dizin biçimi değişirse artır: bütün gövdeler yeniden dizinlenir (2: PDF satır sonu tireleri, 3: belgeye göre örnek sayfalar, 4: örnek metin tek kitapta, şekil etiketleri sonda)
const VT_AD = "kenar-notu-arama";
const SON_ANAHTAR = "kenar-notu-arama:son";
const SAYFA_PAKETI = 40;   // yarım PDF bu kadar sayfada bir kaydedilir

// =====================================================================
// Türkçe katlama: her UTF-16 birimi tek birime katlanır, eşleşme konumları asıl metinde aynen geçerli kalır.
// toLocaleLowerCase("tr") + aksan atma (NFD) + ı/i; tırnaklar ve boşluklar sadeleşir.
// =====================================================================
const TABLO = new Uint16Array(65536);   // 0: henüz hesaplanmadı
const OZEL = { "ı": "i", "’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"', "–": "-", "—": "-", "−": "-",
  "\n": " ", "\r": " ", "\t": " ", " ": " ", " ": " ", " ": " " };
function harfKatla(c) {
  let k = c;
  if (c < 0xd800 || c > 0xdfff) {
    const ch = String.fromCharCode(c);
    const l = ch.toLocaleLowerCase("tr");
    let b = (l.length === 1 ? l : ch).normalize("NFD")[0] || ch;
    b = OZEL[b] ?? b;
    k = b.charCodeAt(0);
  }
  TABLO[c] = k || 32;
  return TABLO[c];
}
const cozucu = new TextDecoder("utf-16le");
export function katla(s) {
  s = String(s ?? "");
  const n = s.length, o = new Uint16Array(n);
  for (let i = 0; i < n; i++) { const c = s.charCodeAt(i); o[i] = TABLO[c] || harfKatla(c); }
  return cozucu.decode(o);
}
const nfc = (s) => String(s ?? "").normalize("NFC");
// PDF satır sonunda tireyle bölünmüş kelime birleşir: "kelime-" + satır sonu + "ler" -> "kelimeler".
// Sonraki harf büyükse (Türk-Alman) gerçek tiredir, kalır. Gövde metni (m) ayrı saklandığı için ofset sorunu çıkmaz.
const pdfMetni = (s) => nfc(s).replace(/(\p{L})[-\u00AD]\n(\p{Ll})/gu, "$1$2");

// Not metinleri her aramada katlanır; aynı metin ikinci kez katlanmaz
const notKatlari = new Map();
function notKatla(m) {
  let k = notKatlari.get(m);
  if (k === undefined) {
    if (notKatlari.size > 6000) notKatlari.clear();
    k = katla(m);
    notKatlari.set(m, k);
  }
  return k;
}

// =====================================================================
// IndexedDB
// =====================================================================
let vtSoz = null;
function vtAc() {
  vtSoz ||= new Promise((tamam, hata) => {
    const q = indexedDB.open(VT_AD, 1);
    q.onupgradeneeded = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("govde")) db.createObjectStore("govde");
    };
    q.onsuccess = () => {
      const db = q.result;
      db.onversionchange = () => { db.close(); vtSoz = null; };
      tamam(db);
    };
    q.onerror = () => { vtSoz = null; hata(q.error); };
    q.onblocked = () => { vtSoz = null; hata(new Error("arama dizini engellendi")); };
  });
  return vtSoz;
}
async function islem(depolar, kip, fn) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    const t = db.transaction(depolar, kip);
    const d = Object.fromEntries([].concat(depolar).map((ad) => [ad, t.objectStore(ad)]));
    const q = fn(d);
    t.oncomplete = () => tamam(Array.isArray(q) ? q.map((x) => x?.result) : q?.result);
    t.onerror = t.onabort = () => hata(t.error);
  });
}

// =====================================================================
// Bellekteki dizin
// =====================================================================
const META = new Map();     // belgeId -> meta
const GOVDE = new Map();    // belgeId -> govde (yalnız ekran ilk açılınca yüklenir)
let metaSoz = null, govdeSoz = null, govdeHazir = false;

function metaYukle() {
  metaSoz ||= islem("meta", "readonly", (d) => [d.meta.getAllKeys(), d.meta.getAll()])
    .then(([anahtarlar, degerler]) => { anahtarlar.forEach((a, i) => { if (!META.has(a)) META.set(a, degerler[i]); }); })
    .catch((e) => console.warn("[arama] dizin açılamadı:", e));
  return metaSoz;
}
// Gövdeler belge belge ve boşta yüklenir: tek getAll büyük kitaplıkta saniyelerce donduruyordu (kitap başına MB'lar).
// Her belge gelince govdeBildir çağrılır, açık arama sonuçları kademeli dolar.
let govdeBildir = null;
function govdeYukle() {
  govdeSoz ||= (async () => {
    try {
      const anahtarlar = await islem("govde", "readonly", (d) => d.govde.getAllKeys());
      for (const a of anahtarlar) {
        if (GOVDE.has(a)) continue;
        await sira();
        const g = await islem("govde", "readonly", (d) => d.govde.get(a)).catch(() => null);
        if (g && !GOVDE.has(a)) { GOVDE.set(a, g); govdeBildir?.(); }
      }
    } catch (e) { console.warn("[arama] dizin okunamadı:", e); }
    govdeHazir = true;
  })();
  return govdeSoz;
}
async function govdeYaz(id, meta, govde) {
  META.set(id, meta);
  if (govdeHazir || govde.tamam) GOVDE.set(id, govde);
  try { await islem(["meta", "govde"], "readwrite", (d) => [d.meta.put(meta, id), d.govde.put(govde, id)]); }
  catch (e) { console.warn("[arama] dizin yazılamadı:", e); }
}
async function govdeSil(id) {
  META.delete(id);
  GOVDE.delete(id);
  try { await islem(["meta", "govde"], "readwrite", (d) => [d.meta.delete(id), d.govde.delete(id)]); } catch { /* bir dahaki taramada */ }
}

// Örnek PDF metni değişince (sayfalar.js) dizin kendiliğinden yenilenir: sayfa sayısı ve çizim kaynağının uzunluğu.
// Metnin kendisine bakılmaz: text her sayfayı çizerek çıkarır, açılışta yarım saniyelik görev kalemi donduruyordu.
const ornekSayfalariAl = (b) => (typeof SAYFALAR.ornekSayfalari === "function" && SAYFALAR.ornekSayfalari(b.id)) || SAYFALAR.PDF_PAGES;
const kaynakBoyu = new WeakMap();
const ornekImza = (b) => {
  const l = ornekSayfalariAl(b);
  return `${l.length}.k${l.reduce((t, x) => {
    if (!kaynakBoyu.has(x)) kaynakBoyu.set(x, String(x.draw || "").length);
    return t + kaynakBoyu.get(x);
  }, 0)}`;
};

// Belgenin gövdesi için beklenen imza; null: gövdesi yok (defter)
function imzaAl(b) {
  if (b.tur === "pdf") return b.dosya ? `pdf:${SURUM}:${b.sayfaSayisi || 0}` : `ornek-pdf:${SURUM}:${ornekImza(b)}`;
  // EPUB ayrıştırma sürümü değişirse (okuma.js ile aynı paragraf numaraları için) yeniden dizinlenir; sürüm 1 eski imzayı korur
  if (b.tur === "epub") { const es = epubSurumu(b); return b.dosya ? `epub:${SURUM}${es > 1 ? ":e" + es : ""}` : `ornek-epub:${SURUM}:${METIN.bolumler.length}`; }
  return null;
}
const dizinli = (b) => { const im = imzaAl(b); return !im || (META.get(b.id)?.imza === im && META.get(b.id)?.eksik == null); };

// =====================================================================
// Arka plan dizinleme: boşta, dilim dilim, kalem yazarken bekler
// =====================================================================
let sonKalem = -1e9;
const kalemIzle = (e) => { if (e.pointerType === "pen") sonKalem = performance.now(); };
addEventListener("pointerdown", kalemIzle, { capture: true, passive: true });
addEventListener("pointerup", kalemIzle, { capture: true, passive: true });
// S Pen ekranın üstünde havadayken de (basmadan hareket) yazmak üzere sayılır: dilim tam o an başlamasın
addEventListener("pointermove", (e) => { if (e.pointerType === "pen" && !e.buttons) sonKalem = performance.now(); }, { capture: true, passive: true });
const kalemMesgul = () => document.body.classList.contains("yaziyor") || !!document.querySelector(".yaziyor") || performance.now() - sonKalem < 1200;

const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
const bosta = () => new Promise((r) => (window.requestIdleCallback
  ? requestIdleCallback(r, { timeout: 1500 })
  : setTimeout(() => { const t0 = performance.now(); r({ didTimeout: false, timeRemaining: () => Math.max(0, 8 - (performance.now() - t0)) }); }, 40)));
// Boşta ve kalem serbestken döner: dönen süre sınırı içinde iş yapılır
async function sira() {
  for (;;) {
    const d = await bosta();
    if (!kalemMesgul()) return d;
    await uyu(400);
  }
}

const kuyruk = [];            // belgeId
const bekleyenler = new Map(); // belgeId -> [çöz]
const hatali = new Set();     // bu oturumda dizinlenemeyenler (yeniden denenmez)
const durum = { calisiyor: false, belgeId: null, sayfa: 0, sayfaSayisi: 0 };
const izleyiciler = new Set();   // ekranın durum çizicisi
const bildir = (bitti = null) => { for (const f of izleyiciler) f(bitti); };

function kuyrugaEkle(id, { one = false } = {}) {
  const i = kuyruk.indexOf(id);
  if (i >= 0) { if (!one) return; kuyruk.splice(i, 1); }
  one ? kuyruk.unshift(id) : kuyruk.push(id);
  calis();
}

let taramaZamani = 0;
// Gövdesi eksik ya da eski olan belgeleri sıraya koyar; silinmiş belgelerin dizinini atar
async function taramaPlanla() {
  await sira();
  await metaYukle();
  if (store.belgeler.length) {
    for (const id of [...META.keys()]) if (!belgeBul(id)) govdeSil(id);
  }
  for (const b of store.belgeler) if (!dizinli(b) && !hatali.has(b.id)) kuyrugaEkle(b.id);
  bildir();
}
function taramaErtele(ms = 600) {
  clearTimeout(taramaZamani);
  taramaZamani = setTimeout(taramaPlanla, ms);
}

async function calis() {
  if (durum.calisiyor) return;
  durum.calisiyor = true;
  try {
    await metaYukle();
    while (kuyruk.length) {
      const id = kuyruk[0];
      const b = belgeBul(id);
      let sonuc = false;
      if (b && !dizinli(b)) {
        durum.belgeId = id; durum.sayfa = 0; durum.sayfaSayisi = 0;
        bildir();
        try { sonuc = await govdeDizinle(b); }
        catch (e) { console.warn("[arama] dizinlenemedi:", b.ad, e); hatali.add(id); }
      }
      if (kuyruk[0] === id) kuyruk.shift();
      durum.belgeId = null;
      for (const coz of bekleyenler.get(id) || []) coz(sonuc);
      bekleyenler.delete(id);
      bildir(id);
    }
  } finally {
    durum.calisiyor = false;
    durum.belgeId = null;
    bildir();
  }
}

// Belge sırada silinirse ya da yeniden dizinleme istenirse iş yarıda bırakılır
const iptalMi = (b, imza) => !belgeBul(b.id) || imzaAl(b) !== imza;

async function govdeDizinle(b) {
  const imza = imzaAl(b);
  if (!imza) return true;
  if (b.tur === "pdf") return b.dosya ? pdfDizinle(b, imza) : ornekPdfDizinle(b, imza);
  return epubDizinle(b, imza);
}

async function ornekPdfDizinle(b, imza) {
  // Satır sonu hecelemesi yazı tipine bağlı; imza artık metne bakmadığı için metin yazı tipleriyle çıkarılır
  await SAYFALAR.yaziTipleri;
  // Sayfa sayfa ve boşta: her text bir sayfa çizimi
  const parcalar = [];
  for (const [i, s] of ornekSayfalariAl(b).entries()) {
    await sira();
    if (iptalMi(b, imza)) return false;
    const m = nfc(s.text);
    parcalar.push({ i, m, k: katla(m) });
  }
  await govdeYaz(b.id, { imza, adet: parcalar.length, zaman: Date.now() }, { tur: "pdf", parcalar, tamam: true });
  return true;
}

async function pdfDizinle(b, imza) {
  const blob = await dosyaGetir(b.id);
  if (!blob) {   // dosyası yok: boş dizin, yeniden denenmez
    await govdeYaz(b.id, { imza, adet: 0, zaman: Date.now() }, { tur: "pdf", parcalar: [], tamam: true });
    return true;
  }
  const { pdfAc } = await import("./pdf-belge.js");
  await sira();
  if (iptalMi(b, imza)) return false;
  const pdf = await pdfAc(blob);
  try {
    const n = pdf.sayfaSayisi;
    durum.sayfaSayisi = n;
    // Yarım kalmış dizin kaldığı yerden sürer
    const eski = META.get(b.id);
    let parcalar = [], i = 0;
    if (eski?.imza === imza && eski.eksik != null) {
      const g = GOVDE.get(b.id) || await islem("govde", "readonly", (d) => d.govde.get(b.id)).catch(() => null);
      if (g?.parcalar) { parcalar = g.parcalar.filter((x) => x.i < eski.eksik); i = eski.eksik; }
    }
    // Metin işçide çıkarılır; sıradaki sayfa biz katlarken hazırlanır
    let sonraki = i < n ? pdf.metin(i) : null;
    let paket = 0;
    while (i < n) {
      const ham = await sonraki;
      sonraki = i + 1 < n ? pdf.metin(i + 1) : null;
      const d = await sira();
      if (iptalMi(b, imza)) return false;
      const m = pdfMetni(ham);
      if (m.trim()) parcalar.push({ i, m, k: katla(m) });
      i++;
      durum.sayfa = i;
      // Bu boşlukta süre kaldıysa bekleyen sayfa da alınır
      while (i < n && d.timeRemaining() > 8 && !kalemMesgul()) {
        const hazir = await Promise.race([sonraki, null]);
        if (hazir == null) break;
        sonraki = i + 1 < n ? pdf.metin(i + 1) : null;
        const m2 = pdfMetni(hazir);
        if (m2.trim()) parcalar.push({ i, m: m2, k: katla(m2) });
        i++;
        durum.sayfa = i;
      }
      bildir();
      if (++paket >= SAYFA_PAKETI && i < n) {
        paket = 0;
        await sira();
        await govdeYaz(b.id, { imza, eksik: i, adet: parcalar.length, zaman: Date.now() }, { tur: "pdf", parcalar: parcalar.slice(), tamam: false });
      }
    }
    await sira();
    if (iptalMi(b, imza)) return false;
    await govdeYaz(b.id, { imza, adet: parcalar.length, zaman: Date.now() }, { tur: "pdf", parcalar, tamam: true });
    return true;
  } finally {
    pdf.kapat();
  }
}

async function epubDizinle(b, imza) {
  let kitap = METIN, bicimli = false, bicimCoz = null;
  if (b.dosya) {
    const blob = await dosyaGetir(b.id);
    if (!blob) {
      await govdeYaz(b.id, { imza, adet: 0, zaman: Date.now() }, { tur: "epub", parcalar: [], bolumler: [], tamam: true });
      return true;
    }
    const mod = await import("./epub-belge.js");
    bicimCoz = mod.bicimCoz;
    await sira();
    if (iptalMi(b, imza)) return false;
    // okuma.js ile aynı çözüm ve aynı ayrıştırma sürümü: paragraf numaraları tutsun.
    // Dosyalar arasında boşta beklenir, kalem yazarken çözüm durur.
    const c = mod.epubCoz(b.id, async () => blob, { surum: epubSurumu(b), bekle: sira });
    try { kitap = await c.soz; } finally { c.birak(); }
    if (iptalMi(b, imza)) return false;
    bicimli = true;
  }
  // Dosyasız örnek kitapların hepsi aynı deneme metnini gösterir (okuma-metni.js). Metin yalnız kendi adını
  // taşıyan kitapta dizinlenir; "Suç ve Ceza" aramada "Kâğıdın Hafızası"nın paragraflarıyla çıkmaz.
  if (!b.dosya && METIN.baslik && b.ad !== METIN.baslik && store.belgeler.some((x) => !x.dosya && x.tur === "epub" && x.ad === METIN.baslik)) {
    await govdeYaz(b.id, { imza, adet: 0, zaman: Date.now() }, { tur: "epub", parcalar: [], bolumler: [], tamam: true });
    return true;
  }
  // okuma.js modeliKur ile aynı numaralama: sahne ayracı ve boş paragraf sayılmaz
  const parcalar = [], bolumler = [];
  let gi = 0, d = await sira();
  for (const bol of kitap.bolumler || []) {
    const ilk = gi;
    for (const ham of bol.paragraflar || []) {
      if (ham === SAHNE) continue;
      const metin = bicimli ? bicimCoz(ham).metin : ham;
      if (!metin.trim()) continue;
      const m = nfc(metin);
      parcalar.push({ p: gi++, m, k: katla(m) });
      if (d.timeRemaining() < 2 || kalemMesgul()) {
        d = await sira();
        if (iptalMi(b, imza)) return false;
      }
    }
    if (gi > ilk) bolumler.push({ ad: String(bol.baslik || "").trim(), ilk });
  }
  await govdeYaz(b.id, { imza, adet: parcalar.length, zaman: Date.now() }, { tur: "epub", parcalar, bolumler, tamam: true });
  return true;
}

// İzler (izler.js) için EPUB paragraf kaynağı: vurgunun metni ve izin bölüm adı dizinden okunur.
// Gövde belleğe alınmadıysa yalnız o belgeninki ayrıca okunur (aramanın kendi önbelleğine konmaz).
// -> { metin(p), bolum(p), adet } ya da dizin yoksa null
const izGovde = new Map();
export async function govdeKaynagi(belgeId) {
  let g = GOVDE.get(belgeId) || izGovde.get(belgeId);
  if (!g) {
    g = await islem("govde", "readonly", (d) => d.govde.get(belgeId)).catch(() => null);
    if (!g?.parcalar) return null;
    if (izGovde.size > 8) izGovde.delete(izGovde.keys().next().value);
    izGovde.set(belgeId, g);
  }
  if (!g?.parcalar) return null;
  const sira = new Map(g.parcalar.map((x) => [x.p, x.m]));
  return { metin: (p) => sira.get(p) ?? null, bolum: (p) => bolumAdi(g, p), adet: g.parcalar.length };
}
bus.on("belgeler", (o) => { if (o?.tur === "sil" && o.id) izGovde.delete(o.id); });

// Tek belgeyi (yeniden) dizinler; bitince true
export async function dizinle(belgeId) {
  const b = belgeBul(belgeId);
  if (!b) { await govdeSil(belgeId); return false; }
  hatali.delete(belgeId);
  await metaYukle();
  const m = META.get(belgeId);
  if (m) META.set(belgeId, { ...m, imza: "eski" });
  return new Promise((coz) => {
    if (!bekleyenler.has(belgeId)) bekleyenler.set(belgeId, []);
    bekleyenler.get(belgeId).push(coz);
    kuyrugaEkle(belgeId, { one: true });
  });
}

// Kitaplık değişince ilgili belge dizinlenir ya da dizini silinir
bus.on("belgeler", (o) => {
  if (o?.tur === "sil" && o.id) { govdeSil(o.id); bildir(o.id); return; }
  if (o?.tur === "ekle" && o.belge?.id) { metaYukle().then(() => { if (!dizinli(o.belge)) kuyrugaEkle(o.belge.id); }); return; }
  taramaErtele();
});
bus.on("belge:degisti", (o) => {
  const b = o?.belgeId && belgeBul(o.belgeId);
  if (b) metaYukle().then(() => { if (!dizinli(b) && !hatali.has(b.id)) kuyrugaEkle(b.id); });
  if (D && D.sorgu) aramaPlanla(400);
});
bus.on("kartlar", () => { if (D && D.sorgu) aramaPlanla(400); });
bus.on("kirpintilar", () => { if (D && D.sorgu) aramaPlanla(400); });
// Açılıştan sonra kitaplık yüklenince ilk tarama (ekran hiç açılmasa da)
setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => taramaPlanla(), { timeout: 5000 }) : taramaPlanla()), 2500);

// =====================================================================
// Belge notları: duzenleyici.js ve okuma.js veri biçimlerinden okunur (değiştirilmez)
// =====================================================================
// Ekranda yazan sayfa numarası: duzenleyici.js etiketNo = (veri.ilkNo || 1) + sıra
function ornekIlkNo(b) {
  const uzunluk = ornekSayfalariAl(b).length + 1;   // ilkVeri: örnek sayfalar + bir kareli sayfa
  const toplam = Math.max(b.sayfaSayisi || 0, uzunluk);
  return Math.min(Math.max(1, b.sayfa || 1), toplam - uzunluk + 1);
}
function pdfSayfaCozucu(b) {
  const v = b.veri;
  if (v && Array.isArray(v.sayfalar) && v.sayfalar.length) {
    const ilk = v.ilkNo || 1, harita = new Map();
    v.sayfalar.forEach((s, j) => { if (s.tur === "pdf" && !harita.has(s.pdf)) harita.set(s.pdf, ilk + j); });
    // Örnek PDF'te de s.pdf belgenin kendi listesindeki sıradır (duzenleyici ornekSayfalari ile kurar)
    return (i) => harita.get(i) ?? null;
  }
  if (b.dosya) return (i) => i + 1;
  const ilk = ornekIlkNo(b);
  return (i) => ilk + i;
}

function masaNotlari(b, cikti) {
  const v = b.veri;
  if (!v || !Array.isArray(v.sayfalar)) return;
  const ilk = v.ilkNo || 1;
  v.sayfalar.forEach((s, j) => {
    const sayfa = ilk + j;
    for (const n of s.notlar || []) {
      if (n?.metin && String(n.metin).trim()) cikti.push({ kaynak: "Yapışkan not", m: nfc(n.metin), sayfa, renk: n.renk });
    }
    for (const t of s.metinler || []) {
      if (!t?.metin || !String(t.metin).trim()) continue;
      if (t.tur === "asistan") cikti.push({ kaynak: "Asistan notu", m: nfc(t.metin), sayfa, ek: t.soru ? nfc(t.soru) : "" });
      else if (t.tur === "damga") cikti.push({ kaynak: "Damga", m: nfc(t.metin), sayfa });
      else cikti.push({ kaynak: "Metin kutusu", m: nfc(t.metin), sayfa });
    }
  });
}

function koltukNotlari(b, cikti) {
  const v = b.veri;
  if (!v || v.kurulmadi && !v.asistanNotlari?.length) return;
  const g = GOVDE.get(b.id);
  const pm = (p) => g?.parcalar?.[p]?.p === p ? g.parcalar[p].m : g?.parcalar?.find((x) => x.p === p)?.m;
  for (const vg of v.vurgular || []) {
    if (!vg?.bas) continue;
    const konum = { p: vg.bas.p, oran: oranAl(pm(vg.bas.p), vg.bas.o) };
    // Vurgulanan metin gövdeden çıkarılır (okuma.js vurgu metni gibi)
    let metin = "";
    for (let p = vg.bas.p; p <= vg.son.p && metin.length < 600; p++) {
      const m = pm(p);
      if (m == null) { metin = ""; break; }
      metin += (metin ? " " : "") + m.slice(p === vg.bas.p ? vg.bas.o : 0, p === vg.son.p ? vg.son.o : m.length);
    }
    if (metin.trim()) cikti.push({ kaynak: "Vurgu", m: nfc(metin), konum, renk: vg.renk, vurgu: true });
    if (vg.not && String(vg.not).trim()) cikti.push({ kaynak: "Kenar notu", m: nfc(vg.not), konum });
  }
  for (const n of v.asistanNotlari || []) {
    if (!n?.metin || !String(n.metin).trim()) continue;
    const konum = Number.isInteger(n.p) && n.p >= 0 ? { p: n.p, oran: 0 } : null;
    cikti.push({ kaynak: "Asistan notu", m: nfc(n.metin), konum, sayfa: konum ? null : n.sayfa || null, ek: n.soru ? nfc(n.soru) : "" });
  }
}
function oranAl(m, o) { return m && m.length ? Math.max(0, Math.min(1, (o || 0) / m.length)) : 0; }

// Ses kayıtlarının adları (ses.js: belge.veri.sesler); dokununca belge açılır
function sesNotlari(b, cikti) {
  for (const k of b.veri?.sesler || []) {
    if (k?.ad && String(k.ad).trim()) cikti.push({ kaynak: "Ses kaydı", m: nfc(k.ad), sayfa: null });
  }
}

// Kalem izleri (OZELLIKLER-5: belge.veri.izler): altındaki metin ve cep defterinde yanına yazılan not "Notlarım" altında.
// Koltuk izi paragrafa (bas), Masa ve çizgi roman izi ekranda yazan sayfa numarasına bağlıdır.
const IZ_KAYNAK = { alt: "Altı çizili", daire: "Yuvarlak içinde", kenar: "Kenar işareti", isaret: "İşaret", serbest: "Kalem izi" };
function izNotlari(b, cikti) {
  const izler = b.veri?.izler;
  if (!Array.isArray(izler) || !izler.length) return;
  const g = GOVDE.get(b.id);
  const pm = (p) => g?.parcalar?.find((x) => x.p === p)?.m;
  for (const iz of izler) {
    if (!iz) continue;
    const yer = iz.bas && Number.isInteger(iz.bas.p) ? { konum: { p: iz.bas.p, oran: oranAl(pm(iz.bas.p), iz.bas.o) } }
      : { sayfa: Number.isFinite(Number(iz.sayfa)) ? Number(iz.sayfa) : null };
    const kaynak = IZ_KAYNAK[iz.tur] || "Kalem izi";
    if (iz.metin && String(iz.metin).trim()) cikti.push({ kaynak, m: nfc(iz.metin), ...yer, renk: iz.renk, iz: iz.id });
    if (iz.not && String(iz.not).trim()) cikti.push({ kaynak: "İz notu", m: nfc(iz.not), ...yer, iz: iz.id });
  }
}

function belgeNotlari(b) {
  const cikti = [];
  try {
    if (b.tur === "epub") koltukNotlari(b, cikti);
    else masaNotlari(b, cikti);
    izNotlari(b, cikti);
    sesNotlari(b, cikti);
  } catch (e) { console.warn("[arama] notlar okunamadı:", b.id, e); }
  for (const x of cikti) x.k = notKatla(x.m);
  return cikti;
}

// =====================================================================
// Arama
// =====================================================================
const CIPLER = [
  { id: "tumu", ad: "Tümü" }, { id: "pdf", ad: "PDF" }, { id: "epub", ad: "Kitap" },
  { id: "defter", ad: "Defter" }, { id: "cizgi", ad: "Çizgi roman" }, { id: "not", ad: "Notlarım" }, { id: "kart", ad: "Kartlar" },
];
const TUR_ETIKET = { pdf: "PDF", epub: "Kitap", defter: "Defter", cizgi: "Çizgi roman" };

// Sorguda Türkçe harf (ç ğ ı ö ş ü) varsa harf katlamasının bulduğu "kırışık" gibi eşleşmeler "benzer" sayılır:
// birebir geçenler önce gelir. Birebir denetim yalnız eşleşen parçada, küçük harfe çevrilmiş metinde yapılır.
const TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;
const kucukTr = (s) => s.toLocaleLowerCase("tr");
function sorguCoz(q) {
  const k = katla(nfc(q)).replace(/\s+/g, " ").trim();
  const kelimeler = [...new Set(k.split(" ").filter(Boolean))].sort((a, b) => b.length - a.length);
  const birebir = TR_HARF.test(q) ? [...new Set(kucukTr(nfc(q)).split(/\s+/).filter(Boolean))] : null;
  const esler = kelimeler.map(esYazim);
  return { k, kelimeler, esler, tum: esler.flat(), birebir };
}
// Latince terimin Türkçe yazımı da bulunur: "pleksus" plexus'u, "fleksör" flexor'u bulur (ks ile x)
function esYazim(w) {
  const l = [w];
  if (w.includes("ks")) l.push(w.replaceAll("ks", "x"));
  if (w.includes("x")) l.push(w.replaceAll("x", "ks"));
  return l;
}
// İlk sorgu kelimesinin (ya da eş yazımının) metindeki ilk yeri
const ilkYer = (k, s) => { for (const w of s.esler[0] || []) { const i = k.indexOf(w); if (i >= 0) return i; } return -1; };
const benzerMi = (s, m) => !!s.birebir && !s.birebir.every((w) => kucukTr(m).includes(w));
// Bütün kelimeler geçiyorsa ilk kelimenin geçiş sayısını döner (en çok 999)
function eslesir(k, s) {
  let ilkW = null;
  for (const grup of s.esler) {
    const w = grup.find((x) => k.indexOf(x) >= 0);
    if (!w) return 0;
    ilkW ??= w;
  }
  const w = s.kelimeler.length > 1 && k.includes(s.k) ? s.k : ilkW;
  let n = 0, i = 0;
  while ((i = k.indexOf(w, i)) !== -1 && n < 999) { n++; i += w.length; }
  return n;
}

// En az iki harf; tek başına sembol ya da Yunan harfi (damga: ∫, π, Ω) da aranabilir
const yeterli = (k) => { const t = String(k || "").replace(/\s/g, ""); return t.length >= 2 || /[^\p{Script=Latin}\p{Nd}]/u.test(t); };

function ara(q) {
  const t0 = performance.now();
  const s = sorguCoz(q);
  const gruplar = [];
  const sayilar = Object.fromEntries(CIPLER.map((c) => [c.id, 0]));
  if (!yeterli(s.k)) return null;
  const say = (x) => { sayilar.tumu++; for (const c of x.kumeler) sayilar[c]++; };

  for (const b of store.belgeler) {
    const sonuclar = [];
    const tur = b.tur;
    // Notlar önce: kullanıcının kendi sözleri
    for (const n of belgeNotlari(b)) {
      const adet = eslesir(n.k, s);
      if (!adet) continue;
      sonuclar.push({ ...n, adet, kumeler: [tur, "not"], not: true, belge: b });
    }
    for (const kp of store.kirpintilar) {
      if (kp.belgeId !== b.id || !kp.not || !String(kp.not).trim()) continue;
      const m = nfc(kp.not), adet = eslesir(notKatla(m), s);
      if (adet) sonuclar.push({ kaynak: "Kırpıntı notu", m, k: notKatla(m), sayfa: kp.sayfa || null, adet, kumeler: [tur, "not"], not: true, belge: b, kirpinti: kp });
    }
    const g = GOVDE.get(b.id);
    if (g?.parcalar && imzaAl(b)) {
      const sayfaNo = tur === "pdf" ? pdfSayfaCozucu(b) : null;
      for (const pr of g.parcalar) {
        const adet = eslesir(pr.k, s);
        if (!adet) continue;
        if (tur === "pdf") sonuclar.push({ kaynak: "Sayfa", m: pr.m, k: pr.k, sayfa: sayfaNo(pr.i), i: pr.i, adet, kumeler: [tur], belge: b, govde: true });
        else sonuclar.push({ kaynak: "Metin", m: pr.m, k: pr.k, konum: { p: pr.p, oran: oranAl(pr.m, ilkYer(pr.k, s)) }, adet, kumeler: [tur], belge: b, govde: true, bolum: bolumAdi(g, pr.p) });
      }
    }
    const baslik = eslesir(katla(nfc(`${b.ad} ${b.yazar || ""}`)), s) > 0;
    if (!sonuclar.length && !baslik) continue;
    for (const x of sonuclar) if (benzerMi(s, x.m)) x.benzer = true;
    sonuclar.forEach(say);
    if (!sonuclar.length) { sayilar.tumu++; sayilar[tur]++; }   // yalnız adı eşleşti
    const notSay = sonuclar.filter((x) => x.not && !x.benzer).length, birebirSay = sonuclar.filter((x) => !x.benzer).length;
    // Yalnız benzer eşleşmesi olan belge, birebir eşleşmesi olanların altına iner
    const puan = (baslik ? 1e6 : 0) + notSay * 3 + birebirSay + (sonuclar.length - birebirSay) * 0.01;
    gruplar.push({ anahtar: b.id, belge: b, sonuclar, baslik, puan, acilis: b.acilis || 0 });
  }

  // Belgesi silinmiş kırpıntılar ve kartlar kendi gruplarında
  const yetim = [];
  for (const kp of store.kirpintilar) {
    if (!kp.not || belgeBul(kp.belgeId)) continue;
    const m = nfc(kp.not), adet = eslesir(notKatla(m), s);
    if (adet) yetim.push({ kaynak: "Kırpıntı notu", m, k: notKatla(m), sayfa: kp.sayfa || null, adet, kumeler: ["not"], not: true, kirpinti: kp, belgeAd: kp.belgeAd });
  }
  if (yetim.length) { yetim.forEach(say); gruplar.push({ anahtar: "_kirpinti", ozel: "kirpinti", sonuclar: yetim, puan: yetim.length * 3, acilis: 0 }); }
  const kartlar = [];
  for (const kt of store.kartlar) {
    const m = nfc([kt.on?.metin, kt.arka?.metin].filter((x) => x && String(x).trim()).join("\n"));
    if (!m) continue;
    const k = notKatla(m), adet = eslesir(k, s);
    if (adet) kartlar.push({ kaynak: "Kart", m, k, adet, kumeler: ["kart"], kart: kt, sayfa: kt.sayfa || null, belgeAd: kt.belgeAd });
  }
  if (kartlar.length) { kartlar.forEach(say); gruplar.push({ anahtar: "_kart", ozel: "kart", sonuclar: kartlar, puan: kartlar.length * 2, acilis: 0 }); }

  gruplar.sort((a, b) => b.puan - a.puan || b.acilis - a.acilis);
  for (const g of gruplar) {
    g.sonuclar.sort((a, b) => (a.benzer ? 1 : 0) - (b.benzer ? 1 : 0) || (b.not ? 1 : 0) - (a.not ? 1 : 0) || siraAl(a) - siraAl(b));
  }
  return { sorgu: s, gruplar, sayilar, sure: performance.now() - t0 };
}
const siraAl = (x) => (x.konum ? x.konum.p : x.sayfa ?? 1e9);
function bolumAdi(g, p) {
  const bs = g.bolumler;
  if (!bs?.length) return "";
  let lo = 0, hi = bs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (bs[m].ilk <= p) lo = m; else hi = m - 1; }
  return bs[lo].ad;
}

// Eşleşmenin çevresinden kısa bağlam: iki yanında `pencere` kadar karakter; bütün kelimeler işaretlenir
function baglam(m, k, s, { pencere = 40, once, sonra } = {}) {
  const tamGrup = s.kelimeler.length > 1 && k.includes(s.k);
  let ilk = tamGrup ? k.indexOf(s.k) : Math.min(...s.tum.map((w) => { const i = k.indexOf(w); return i < 0 ? 1e9 : i; }));
  let boy = tamGrup ? s.k.length : (s.tum.find((w) => k.indexOf(w) === ilk) || "").length;
  // Türkçe harfli sorguda bağlam birebir geçen ilk yerden açılır (katlamayla bulunan benzeri öne geçmesin)
  if (s.birebir && !tamGrup) {
    const km = kucukTr(m), i = km.length === m.length ? km.indexOf(s.birebir[0]) : -1;
    if (i >= 0) { ilk = i; boy = s.birebir[0].length; }
  }
  let bas = Math.max(0, ilk - (once ?? pencere)), son = Math.min(m.length, ilk + boy + (sonra ?? pencere));
  // Kelime ortasından başlamasın, kelime ortasında bitmesin
  if (bas > 0) { const b = k.indexOf(" ", bas); if (b > 0 && b < ilk) bas = b + 1; }
  if (son < m.length) { const e = k.lastIndexOf(" ", son); if (e > ilk + boy) son = e; }
  const parca = k.slice(bas, son), araliklar = [];
  for (const w of s.tum) {
    let i = 0;
    while ((i = parca.indexOf(w, i)) !== -1) { araliklar.push([i, i + w.length]); i += w.length; }
  }
  araliklar.sort((a, b) => a[0] - b[0]);
  const f = document.createDocumentFragment();
  if (bas > 0) f.append("…");
  let j = 0;
  for (const [a, z] of araliklar) {
    if (z <= j) continue;
    const a2 = Math.max(a, j);
    if (a2 > j) f.append(m.slice(bas + j, bas + a2));
    f.append(h("mark", { class: "eslesme" }, m.slice(bas + a2, bas + z)));
    j = z;
  }
  if (j < parca.length) f.append(m.slice(bas + j, son));
  if (son < m.length) f.append("…");
  return f;
}
function vurgula(metin, s) {
  const m = nfc(metin), k = katla(m);
  if (!s.tum.some((w) => k.includes(w))) return m;
  return baglam(m, k, s, { pencere: 1e6 });
}

// =====================================================================
// Ekran
// =====================================================================
let D = null;

function cssYukle() {
  if (document.querySelector('link[href$="arama.css"]')) return;
  document.head.append(h("link", { rel: "stylesheet", href: new URL("./arama.css", import.meta.url).href }));
}

function sonAramalar() {
  try { const x = JSON.parse(localStorage.getItem(SON_ANAHTAR) || "[]"); return Array.isArray(x) ? x.filter((s) => typeof s === "string") : []; }
  catch { return []; }
}
function sonAramaEkle(q) {
  q = String(q || "").trim();
  if (!yeterli(q)) return;
  const kq = katla(q);
  const liste = [q, ...sonAramalar().filter((x) => katla(x) !== kq)].slice(0, 8);
  try { localStorage.setItem(SON_ANAHTAR, JSON.stringify(liste)); } catch { /* özel pencere */ }
}

export function ac(kap, { terim } = {}) {
  if (D && D.kap === kap) {
    if (terim != null) { D.girdi.value = terim; aramaYap(); }
    return;
  }
  if (D) kapat();
  cssYukle();

  const girdi = h("input", { type: "search", class: "arama-girdi", placeholder: "Bütün kitaplıkta ara", "aria-label": "Bütün kitaplıkta ara",
    enterkeyhint: "search", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const temizle = h("button", { class: "ikon-dugme arama-temizle", type: "button", "aria-label": "Aramayı temizle", hidden: true }, icon("kapat"));
  const sonucSayi = h("b", { class: "t-deger" }, "0");
  const sureDeger = h("span", {}, "0");
  // Sonuç sayısı öne çıkar; arama süresi yanında küçük ve soluk durur
  const olcu = h("div", { class: "arama-olcu", "aria-live": "polite", hidden: true },
    h("span", { class: "olcu-kalem" }, h("span", { class: "etiket-sayfa" }, "Sonuç"), sonucSayi,
      h("small", { class: "olcu-sure", "aria-label": "arama süresi" }, sureDeger, " ms")));
  const ust = h("header", { class: "arama-ust" },
    h("button", { class: "ikon-dugme arama-geri", type: "button", "aria-label": "Kitaplığa dön", onclick: geri }, icon("geri")),
    h("label", { class: "arama-alan" }, icon("ara"), girdi, temizle),
    olcu);
  const cipler = h("div", { class: "arama-cipler", role: "group", "aria-label": "Süzgeç" });
  const durumCam = h("span", { class: "cam cam-k arama-dizin", role: "status", hidden: true });
  const serit = h("div", { class: "arama-serit" }, cipler, h("span", { class: "bosluk" }), durumCam);
  const liste = h("div", { class: "arama-liste" });
  // Geniş ekranda sağ sütun: seçili sonucun sayfası ve "Sayfaya git"
  const onizleme = h("aside", { class: "arama-onizleme", "aria-label": "Önizleme", hidden: true });
  const govde = h("div", { class: "arama-govde" }, h("div", { class: "arama-icerik" }, liste, onizleme));
  const kok = h("div", { class: "arama-ekrani", lang: "tr" }, ust, serit, govde);

  D = { kap, kok, girdi, temizle, olcu, sonucSayi, sureDeger, cipler, durumCam, liste, onizleme, govde,
    filtre: "tumu", sorgu: "", sonuc: null, secili: null, acik: new Map(), zaman: 0, sonKayit: 0, durumZaman: 0, temizlik: [] };
  const genisMq = matchMedia(GENIS);
  const genisDegisti = () => onizlemeCiz();
  genisMq.addEventListener("change", genisDegisti);
  D.temizlik.push(() => genisMq.removeEventListener("change", genisDegisti));

  for (const c of CIPLER) {
    const d = h("button", { class: "cip arama-cip", type: "button", "aria-pressed": String(c.id === D.filtre), dataset: { id: c.id } },
      h("span", {}, c.ad), h("b", { class: "cip-sayi" }));
    d.addEventListener("click", () => { D.filtre = c.id; ciz(); });
    cipler.append(d);
  }

  girdi.addEventListener("input", () => aramaPlanla(140));
  girdi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); aramaYap(); sonAramaEkle(girdi.value); girdi.blur(); }
    else if (e.key === "Escape") {
      e.stopPropagation();
      if (girdi.value) { girdi.value = ""; aramaYap(); } else geri();
    } else if (e.key === "ArrowDown") {
      const ilk = liste.querySelector(".arama-fis, .grup-bas");
      if (ilk) { e.preventDefault(); ilk.focus(); }
    }
  });
  temizle.addEventListener("click", (e) => { e.preventDefault(); girdi.value = ""; aramaYap(); girdi.focus(); });
  const tus = (e) => {
    if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "f"))) && document.activeElement !== girdi) {
      e.preventDefault(); girdi.focus(); girdi.select();
    }
  };
  document.addEventListener("keydown", tus);
  D.temizlik.push(() => document.removeEventListener("keydown", tus));
  const izle = (bitti) => {
    durumCiz();
    // Biten belgenin sonuçları gelsin; sık dizinlemede en çok saniyede bir
    if (bitti && D?.sorgu) aramaPlanla(Math.max(200, 1000 - (performance.now() - D.sonKayit)));
  };
  izleyiciler.add(izle);
  D.temizlik.push(() => izleyiciler.delete(izle));
  D.temizlik.push(bus.on("belgeler", () => { if (D?.sorgu) aramaPlanla(300); }));

  kap.append(kok);
  girdi.value = terim || "";
  if (terim) sonAramaEkle(terim);
  aramaYap();
  durumCiz();
  // Yüklenen gövdeler sonuçlara en çok 300 ms'de bir eklenir
  let govdeZ = 0;
  govdeBildir = () => { if (!govdeZ && D?.sorgu) govdeZ = setTimeout(() => { govdeZ = 0; if (D) aramaYap(); }, 300); };
  D.temizlik.push(() => { clearTimeout(govdeZ); govdeBildir = null; });
  govdeYukle().then(() => { if (D) { aramaYap(); durumCiz(); } });
  taramaPlanla();
  if (!terim) requestAnimationFrame(() => D?.girdi.focus({ preventScroll: true }));
}

export function kapat() {
  if (!D) return;
  clearTimeout(D.zaman);
  for (const f of D.temizlik) { try { f(); } catch { /* boş */ } }
  D.kok.remove();
  D = null;
}

function geri() {
  if (D?.girdi.value.trim()) sonAramaEkle(D.girdi.value);
  bus.emit("git", { ekran: "kitaplik" });
}

function aramaPlanla(ms) {
  if (!D) return;
  clearTimeout(D.zaman);
  D.zaman = setTimeout(aramaYap, ms);
}
function aramaYap() {
  if (!D) return;
  clearTimeout(D.zaman);
  const q = D.girdi.value;
  D.temizle.hidden = !q;
  D.sorgu = q.trim();
  if (D.sorgu !== D.sonuc?.ham) D.acik.clear();
  D.sonuc = D.sorgu ? ara(D.sorgu) : null;
  if (D.sonuc) D.sonuc.ham = D.sorgu;
  D.sonKayit = performance.now();
  ciz();
}

function durumCiz() {
  if (!D) return;
  const toplam = store.belgeler.length;
  const biten = store.belgeler.filter((b) => dizinli(b) || hatali.has(b.id)).length;
  const suruyor = biten < toplam && (durum.calisiyor || kuyruk.length > 0);
  const c = D.durumCam;
  c.hidden = !suruyor && !!D.sorgu;
  c.classList.toggle("soluk", !suruyor);
  const b = durum.belgeId && belgeBul(durum.belgeId);
  const ayrinti = suruyor && b && durum.sayfaSayisi ? `${b.ad}: sayfa ${durum.sayfa}/${durum.sayfaSayisi}` : "";
  c.title = ayrinti;
  c.setAttribute("aria-label", suruyor ? `Dizinleniyor, ${biten} / ${toplam} belge${ayrinti ? ", " + ayrinti : ""}` : `Dizin hazır, ${toplam} belge`);
  c.replaceChildren(h("span", { class: "lamba", dataset: { durum: suruyor ? "deniyor" : "bagli" } }),
    h("span", { class: "dizin-yazi" }, suruyor ? "Dizinleniyor" : "Dizin hazır"), h("b", {}, `${biten}/${toplam}`));
  if (!D.sorgu) {
    const bilgi = D.liste.querySelector(".dizin-ayrinti");
    if (bilgi) bilgi.textContent = ayrinti;
  }
}

function ciz() {
  if (!D) return;
  for (const d of D.cipler.children) {
    const id = d.dataset.id;
    d.setAttribute("aria-pressed", String(id === D.filtre));
    const n = D.sonuc?.sayilar[id] || 0;
    d.querySelector(".cip-sayi").textContent = D.sonuc ? n.toLocaleString("tr") : "";
    // Sonucu olmayan çip gizlenir (seçili olan kalır ki geri dönülebilsin)
    d.hidden = !!D.sonuc && id !== "tumu" && !n && id !== D.filtre;
  }
  D.olcu.hidden = !D.sonuc;
  durumCiz();
  if (!D.sorgu || !D.sonuc) { D.secili = null; onizlemeCiz(); }
  if (!D.sorgu) return bosCiz();
  if (!D.sonuc) {
    D.liste.replaceChildren(h("div", { class: "bos arama-bos-durum" }, h("p", {}, "En az iki harf yaz.")));
    return;
  }
  const { gruplar, sayilar, sorgu: s, sure } = D.sonuc;
  const f = D.filtre;
  const gorunen = [];
  for (const g of gruplar) {
    const sonuclar = f === "tumu" ? g.sonuclar : g.sonuclar.filter((x) => x.kumeler.includes(f));
    const baslikGorunur = g.baslik && (f === "tumu" || f === g.belge?.tur);
    if (sonuclar.length || baslikGorunur) gorunen.push({ g, sonuclar });
  }
  const toplam = f === "tumu" ? sayilar.tumu : sayilar[f];
  D.sonucSayi.textContent = toplam.toLocaleString("tr");
  D.sureDeger.textContent = sure < 10 ? sure.toFixed(1).replace(".", ",") : String(Math.round(sure));

  // Komutlar ve belge adları metin sonuçlarının üstünde (TASARIM-4 3.2)
  const hizli = hizliGrup(D.sorgu);
  if (!gorunen.length) {
    D.secili = null;
    onizlemeCiz();
    const eksik = store.belgeler.some((b) => !dizinli(b) && !hatali.has(b.id));
    D.liste.replaceChildren(...(hizli ? [hizli] : []), h("div", { class: "bos arama-bos-durum" }, icon("ara"),
      h("h3", {}, `“${D.sorgu}” için sonuç yok.`),
      h("p", {}, eksik ? "Yazımı kontrol et ya da daha kısa bir kelime dene. Dizinleme sürüyor, sonuçlar gelir." : "Yazımı kontrol et ya da daha kısa bir kelime dene.")));
    return;
  }
  const tek = gorunen.length === 1;
  // Seçili sonuç görünür listede yoksa ilk sonuç seçilir (önizleme yalnız geniş ekranda)
  const hepsi = gorunen.flatMap((x) => x.sonuclar);
  if (!D.secili || !hepsi.includes(D.secili)) D.secili = hepsi[0] || null;
  D.liste.replaceChildren(...(hizli ? [hizli] : []), ...gorunen.map(({ g, sonuclar }) => grupCiz(g, sonuclar, s, tek)));
  onizlemeCiz();
}

function grupCiz(g, sonuclar, s, tek) {
  const b = g.belge;
  let bas;
  if (b) {
    const sirt = h("span", { class: "grup-sirt", style: `--kapak:${b.kapak || "var(--accent)"}` });
    if (b.kapakGorsel) sirt.style.backgroundImage = `url("${b.kapakGorsel}")`;
    bas = h("button", { class: "grup-bas", type: "button", "aria-label": `${b.ad}: belgeyi aç` },
      sirt,
      h("span", { class: "grup-baslik" },
        h("span", { class: "grup-ad" }, g.baslik ? vurgula(b.ad, s) : b.ad),
        h("span", { class: "grup-alt" }, h("span", { class: "etiket-sayfa" }, TUR_ETIKET[b.tur] || "Belge"), b.yazar ? h("span", { class: "grup-yazar" }, g.baslik ? vurgula(b.yazar, s) : b.yazar) : null)),
      h("span", { class: "grup-sayi t-deger-k" }, sonuclar.length ? sonuclar.length.toLocaleString("tr") : ""));
    bas.addEventListener("click", () => git({ belge: b }));
  } else {
    const kart = g.ozel === "kart";
    bas = h("div", { class: "grup-bas ozel" },
      h("span", { class: "grup-sirt ozel" }, icon(kart ? "tekrar" : "kirp")),
      h("span", { class: "grup-baslik" }, h("span", { class: "grup-ad" }, kart ? "Kartlar" : "Kırpılanlar"),
        h("span", { class: "grup-alt" }, h("span", { class: "grup-yazar" }, kart ? "Tekrar destesi" : "Belgesi silinmiş kırpıntılar"))),
      h("span", { class: "grup-sayi t-deger-k" }, sonuclar.length.toLocaleString("tr")));
  }
  const ilkSayi = tek ? 12 : 3;
  const kac = D.acik.get(g.anahtar) || ilkSayi;
  const fisler = h("div", { class: "grup-fisler" }, ...sonuclar.slice(0, kac).map((x) => fisCiz(x, s)));
  const kalan = sonuclar.length - kac;
  const daha = kalan > 0 ? h("button", { class: "metin-dugme grup-daha", type: "button" },
    icon("asagi"), `${kalan.toLocaleString("tr")} sonuç daha`) : null;
  daha?.addEventListener("click", () => {
    const yeni = Math.min(sonuclar.length, kac + 20);
    D.acik.set(g.anahtar, yeni);
    fisler.append(...sonuclar.slice(kac, yeni).map((x) => fisCiz(x, s)));
    const k2 = sonuclar.length - yeni;
    if (k2 > 0) daha.replaceChildren(icon("asagi"), `${k2.toLocaleString("tr")} sonuç daha`);
    else daha.remove();
  });
  return h("section", { class: "arama-grup", dataset: { anahtar: g.anahtar } }, bas, fisler, daha);
}

function konumEtiketi(x) {
  if (x.sayfa != null) return `S. ${x.sayfa}`;
  if (x.konum) {
    const g = x.belge && GOVDE.get(x.belge.id), n = g?.parcalar?.length || 0;
    return n ? `%${Math.max(0, Math.min(100, Math.round((x.konum.p / n) * 100)))}` : "";
  }
  return "";
}

function fisCiz(x, s) {
  const etiket = konumEtiketi(x);
  const ust = h("span", { class: "fis-ust" },
    etiket ? h("span", { class: "fis-yer etiket-sayfa" }, etiket) : null,
    h("span", { class: "fis-kaynak etiket-sayfa" }, x.kaynak + (x.kart ? ` · Kutu ${x.kart.kutu || 1}` : x.belgeAd && !x.belge ? ` · ${x.belgeAd}` : "")),
    x.benzer ? h("span", { class: "fis-adet etiket-sayfa", title: "Türkçe harfler katlanarak bulundu" }, "Benzer") : x.adet > 1 ? h("span", { class: "fis-adet etiket-sayfa" }, `${x.adet} eşleşme`) : null);
  // Bölüm başlığı ayrı satırda
  const bolum = x.bolum ? h("span", { class: "fis-bolum etiket-sayfa" }, x.bolum) : null;
  const metin = h("span", { class: "fis-metin" + (x.not && !x.vurgu ? " el" : "") }, baglam(x.m, x.k, s));
  // Kâğıt fiş görünümü (her temada açık kâğıt) yalnız kırpıntı notunda; öbür fişler temanın yüzeyini kullanır
  const d = h("button", { class: "arama-fis" + (x.kirpinti ? " kirpinti-fis" : "") + (x.not ? " not" : "") + (x.vurgu ? " vurgu" : ""), type: "button",
    "aria-current": D.secili === x && genis() ? "true" : null, style: x.renk ? `--not-renk:${x.renk}` : null }, ust, bolum, metin);
  d._sonuc = x;
  // Geniş ekranda ilk dokunuş seçer (önizleme), seçiliye dokunmak sayfaya götürür; dar ekranda doğrudan gider
  d.addEventListener("click", () => {
    if (!genis() || D.secili === x) return git(x);
    D.secili = x;
    for (const f of D.liste.querySelectorAll(".arama-fis[aria-current]")) f.removeAttribute("aria-current");
    d.setAttribute("aria-current", "true");
    onizlemeCiz();
  });
  return d;
}

// =====================================================================
// Önizleme (1100px üstü): seçili sonucun sayfası, eşleşen satırlar işaretli
// =====================================================================
const GENIS = "(min-width: 1101px)";
const genis = () => matchMedia(GENIS).matches;
const ONIZLEME_G = 312;   // önizleme kâğıdının CSS genişliği

function onizlemeCiz() {
  if (!D) return;
  const x = D.secili, kutu = D.onizleme;
  kutu.hidden = !x || !genis();
  D.kok.classList.toggle("onizlemeli", !kutu.hidden);
  if (kutu.hidden) { kutu.replaceChildren(); kutu._x = null; return; }
  if (kutu._x === x) return;
  kutu._x = x;
  const s = D.sonuc.sorgu;
  const b = x.belge || (x.kirpinti && belgeBul(x.kirpinti.belgeId)) || null;
  const baslik = b?.ad || (x.kart ? "Kart" : x.belgeAd || "Kırpıntı");
  const yer = [konumEtiketi(x), x.bolum].filter(Boolean).join(" · ");
  let kagit;
  // Örnek PDF'te sayfa çizilir; sayfa numarası olan not ve kırpıntılar da o sayfayı gösterir
  let i = x.i;
  if (i == null && x.sayfa != null && b?.tur === "pdf" && !b.dosya) {
    const no = pdfSayfaCozucu(b), n = ornekSayfalariAl(b).length;
    for (let j = 0; j < n; j++) if (no(j) === x.sayfa) { i = j; break; }
  }
  if (b?.tur === "pdf" && !b.dosya && i != null && ornekSayfa(b, i)) kagit = sayfaResmi(ornekSayfa(b, i), s);
  else kagit = h("div", { class: "onizleme-metin" + (x.not && !x.vurgu ? " el" : "") }, baglam(x.m, x.k, s, { once: 220, sonra: 420 }));
  const gitDugme = h("button", { class: "birincil onizleme-git", type: "button" }, x.kart ? "Karta git" : "Sayfaya git", icon("sag", "i-20"));
  gitDugme.addEventListener("click", () => git(x));
  kutu.replaceChildren(
    h("div", { class: "onizleme-ust" }, h("span", { class: "onizleme-ad" }, baslik), yer ? h("span", { class: "etiket-sayfa" }, yer) : null),
    h("div", { class: "onizleme-kagit" }, kagit),
    gitDugme);
}

// Örnek PDF sayfası: sayfalar.js çizimi küçük tuvale; eşleşen satırın altı sarı şeritle işaretlenir
function ornekSayfa(b, i) {
  return ornekSayfalariAl(b)?.[i] || null;
}
function sayfaResmi(sayfa, s) {
  const PW = SAYFALAR.PW || 800, PH = SAYFALAR.PH || 1131;
  const oran = Math.min(2, devicePixelRatio || 1), olcek = (ONIZLEME_G / PW) * oran;
  const c = h("canvas", { class: "onizleme-tuval", width: String(Math.round(PW * olcek)), height: String(Math.round(PH * olcek)),
    role: "img", "aria-label": "Sayfa önizlemesi" });
  const g = c.getContext("2d");
  g.scale(olcek, olcek);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, PW, PH);
  const asil = g.fillText.bind(g);
  g.fillText = (t, x0, y, ...r) => {
    const k = katla(nfc(String(t)));
    if (s.tum.some((w) => k.includes(w))) {
      const boy = parseFloat((g.font.match(/(\d+(?:\.\d+)?)px/) || [])[1]) || 16;
      const w = g.measureText(String(t)).width, hiza = g.textAlign;
      const sol = hiza === "center" ? x0 - w / 2 : hiza === "right" || hiza === "end" ? x0 - w : x0;
      g.save();
      g.fillStyle = "#F4D63E73";
      g.fillRect(sol - 2, y - boy * .45, w + 4, boy * .7);
      g.restore();
    }
    return asil(t, x0, y, ...r);
  };
  try { sayfa.draw(g); } catch (e) { console.warn("[arama] önizleme çizilemedi:", e); }
  return c;
}

function git(x, aramaTerimi = null) {
  const ara = aramaTerimi ?? (D?.sorgu || "");
  sonAramaEkle(ara);
  if (x.kart) { bus.emit("git", { ekran: "tekrar", kartId: x.kart.id }); return; }
  const b = x.belge || (x.kirpinti && belgeBul(x.kirpinti.belgeId));
  if (!b) { bus.emit("git", { ekran: "kitaplik", gorunum: "kirpilanlar" }); return; }
  const o = { ekran: "belge", belgeId: b.id, ara };
  if (x.konum) o.konum = x.konum;
  if (x.sayfa != null) o.sayfa = x.sayfa;
  if (x.iz) o.izId = x.iz;   // kalem izi: belge açılınca iz bir an parlar
  bus.emit("git", o);
}

function bosCiz() {
  const son = sonAramalar();
  const parca = [];
  parca.push(h("div", { class: "arama-giris" },
    h("h2", { class: "arama-giris__baslik" }, "Her şeyi buradan bulursun."),
    h("p", { class: "arama-tanim" }, "Kitap adı, sayfadaki bir kelime, notun ya da bir komut yaz."),
    h("p", { class: "dizin-ayrinti t-kucuk" })));
  // Hızlı erişim: son belgeler ve sık komutlar (Ctrl K penceresiyle aynı liste)
  const devam = sonBelgeler(3);
  if (devam.length) parca.push(h("section", { class: "hizli-bolum" }, h("h2", { class: "t-daktilo" }, "Devam et"),
    h("div", { class: "hizli-liste" }, devam.map((b) => satirDugme(belgeSatiri(b), () => satirCalistir(belgeSatiri(b)))))));
  const sik = ["dosya-ac", "yeni-defter", "yedekle", "kart-calis", "rehber"].map((id) => komutlar().find((k) => k.id === id)).filter(Boolean);
  if (sik.length) parca.push(h("section", { class: "hizli-bolum" }, h("h2", { class: "t-daktilo" }, "Komutlar"),
    h("div", { class: "hizli-liste" }, sik.map((k) => { const r = komutSatiri(k, baglamAl(), ""); return satirDugme(r, () => satirCalistir(r)); }))));
  if (son.length) {
    const temizleDugme = h("button", { class: "metin-dugme", type: "button" }, "Temizle");
    temizleDugme.addEventListener("click", () => { try { localStorage.removeItem(SON_ANAHTAR); } catch { /* boş */ } bosCiz(); });
    parca.push(h("section", { class: "son-aramalar" },
      h("div", { class: "son-bas" }, h("h2", { class: "t-daktilo" }, "Son aramalar"), temizleDugme),
      h("div", { class: "son-liste" }, ...son.map((q) => {
        const d = h("button", { class: "son-arama", type: "button" }, icon("ara"), h("span", {}, q));
        d.addEventListener("click", () => { D.girdi.value = q; aramaYap(); });
        return d;
      }))));
  }
  D.liste.replaceChildren(...parca);
  durumCiz();
}

// Deneme ve ölçüm için (konsoldan): dizinin durumu
export const _dizinDurumu = () => ({ ...durum, kuyruk: [...kuyruk], meta: Object.fromEntries(META), govde: GOVDE.size });

// =====================================================================
// Hızlı erişim (TASARIM-4 3.2): komutlar, belgeler ve metin sonuçları tek listede.
// Ara ekranında (boş sorguda ve sonuçların üstünde) ve Ctrl+K penceresinde (paletAc). Komutlar ortak.js komutEkle ile gelir.
// =====================================================================
const KOMUT_SAYAC = "kenar-notu-arama:komut";
const TUR_IKON = { pdf: "pdf", epub: "kitap", defter: "defter", cizgi: "cizgi-roman" };
const baglamAl = () => {
  const b = acikEkran.ekran === "belge" && acikEkran.belgeId ? belgeBul(acikEkran.belgeId) : null;
  return { ekran: acikEkran.ekran, belge: b, mod: acikEkran.mod };
};
function komutUyar(k, c) {
  const bg = k.baglam || "her";
  if (bg !== "her") {
    if (!c.belge) return false;
    if ((bg === "koltuk" || bg === "masa") && c.mod !== bg) return false;
    if (bg === "epub" && c.belge.tur !== "epub") return false;
    if (bg === "pdf" && (!(c.belge.tur === "pdf" || c.belge.tur === "defter") || cizgiMi(c.belge))) return false;
  }
  try { return !k.kosul || !!k.kosul(c); } catch { return false; }
}
const komutSayaci = () => { try { return JSON.parse(localStorage.getItem(KOMUT_SAYAC) || "{}") || {}; } catch { return {}; } };
function sayacArtir(id) {
  const s = komutSayaci();
  s[id] = (s[id] || 0) + 1;
  try { localStorage.setItem(KOMUT_SAYAC, JSON.stringify(s)); } catch { /* özel pencere */ }
}
// Sıralama: tam başlangıç > kelime başı > içinde > eş sözcük; bağlama uyan önce; eşitlikte sık kullanılan
function komutPuan(k, c, q, sayac) {
  if (!q) return 1;
  if (k.sayi && /^\d+$/.test(q)) return 10;
  const ad = katla(typeof k.ad === "function" ? k.ad(c, "") : k.ad), es = katla(k.es || "");
  let p = ad.startsWith(q) ? 6 : (" " + ad).includes(" " + q) ? 5 : ad.includes(q) ? 4 : (" " + es).includes(" " + q) ? 3 : es.includes(q) ? 2 : 0;
  if (!p) return 0;
  if ((k.baglam || "her") !== "her") p += 0.5;
  return p + Math.min(0.4, (sayac[k.id] || 0) / 50);
}
function komutSatiri(k, c, q) {
  return { tur: "komut", id: "k-" + k.id, ikon: k.ikon || "ok", ad: typeof k.ad === "function" ? k.ad(c, q) : k.ad, alt: k.alt?.(c, q) || "",
    calistir: () => { sayacArtir(k.id); k.calistir(c, q); } };
}
const sonBelgeler = (n) => [...store.belgeler].filter((b) => !b.dizgi).sort((a, b) => (b.acilis || 0) - (a.acilis || 0)).slice(0, n);
function belgeSatiri(b) {
  const alt = b.tur === "epub" ? `%${Math.round(Math.min(1, b.ilerleme || 0) * 100)}` : `s. ${b.sayfa || 1}`;
  return { tur: "belge", id: "b-" + b.id, ikon: cizgiMi(b) ? "cizgi-roman" : TUR_IKON[b.tur] || "kitap", ad: b.ad, alt,
    calistir: () => bus.emit("git", { ekran: "belge", belgeId: b.id }) };
}
function belgeAra(q, n) {
  const puan = (b) => {
    const ad = katla(b.ad || ""), yz = katla(b.yazar || "");
    return ad.startsWith(q) ? 4 : (" " + ad).includes(" " + q) ? 3 : ad.includes(q) ? 2 : yz.includes(q) ? 1 : 0;
  };
  return store.belgeler.filter((b) => !b.dizgi).map((b) => [b, puan(b)]).filter(([, p]) => p)
    .sort((a, b) => b[1] - a[1] || (b[0].acilis || 0) - (a[0].acilis || 0)).slice(0, n).map(([b]) => b);
}
// { komutlar, belgeler, yalnizKomut }: ">" ile başlayan sorgu yalnız komut arar
export function hizliErisim(sorgu, { komutSiniri = 5, belgeSiniri = 5 } = {}) {
  const c = baglamAl();
  let ham = String(sorgu || "").trim();
  const yalnizKomut = ham.startsWith(">");
  if (yalnizKomut) ham = ham.slice(1).trim();
  const q = katla(ham);
  const sayac = komutSayaci();
  const kl = komutlar().filter((k) => komutUyar(k, c)).map((k) => [k, komutPuan(k, c, q, sayac)]).filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, komutSiniri).map(([k]) => komutSatiri(k, c, ham));
  const bl = !q || yalnizKomut ? [] : belgeAra(q, belgeSiniri).map(belgeSatiri);
  return { komutlar: kl, belgeler: bl, yalnizKomut, ham };
}
// Ara ekranında sonuçların üstünde: en çok üç komut ve üç belge
function hizliGrup(sorgu) {
  const { komutlar: kl, belgeler: bl } = hizliErisim(sorgu, { komutSiniri: 3, belgeSiniri: 3 });
  if (!kl.length && !bl.length) return null;
  return h("section", { class: "hizli-bolum hizli-ust" }, h("h2", { class: "t-daktilo" }, "Komutlar ve belgeler"),
    h("div", { class: "hizli-liste" }, [...kl, ...bl].map((r) => satirDugme(r, () => satirCalistir(r)))));
}
function satirDugme(r, fn, ekSinif = "") {
  const d = h("button", { class: `hizli-satir ${ekSinif}`.trim(), type: "button", dataset: { tur: r.tur } },
    icon(r.ikon || "ok", "i-20"), h("span", { class: "hizli-ad" }, r.adEl || r.ad), r.alt ? h("small", {}, r.alt) : h("small"));
  d.addEventListener("click", fn);
  return d;
}
function satirCalistir(r) {
  if (r.tur !== "komut" && D?.girdi.value.trim()) sonAramaEkle(D.girdi.value);
  r.calistir();
}

/* ---------- Ctrl+K penceresi ---------- */
let P = null;
export function paletAc({ terim = "" } = {}) {
  if (P) { P.girdi.focus(); P.girdi.select(); return; }
  // Telefonda (klavyesiz) Ara ekranının kendisi açılır
  if (matchMedia("(max-width: 599px)").matches && !document.querySelector(".ekran-belge:not([hidden])")) { bus.emit("git", { ekran: "arama", terim: terim || undefined }); return; }
  cssYukle();
  // Açık rehber balonu pencerenin üstünde kalmasın
  import("./rehber.js").then((m) => m.rehberKapat?.()).catch(() => {});
  const acan = document.activeElement;
  const girdi = h("input", { type: "search", class: "palet-alan", role: "combobox", "aria-expanded": "true", "aria-controls": "paletListe",
    "aria-autocomplete": "list", "aria-label": "Hızlı erişim: belge, ekran ya da komut", placeholder: "Belge, ekran ya da komut ara",
    enterkeyhint: "go", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  girdi.value = terim;
  const liste = h("div", { class: "palet-liste", id: "paletListe", role: "listbox", "aria-label": "Sonuçlar" });
  const kutu = h("div", { class: "palet", role: "dialog", "aria-modal": "true", "aria-label": "Hızlı erişim" },
    h("div", { class: "palet-girdi" }, icon("ara", "i-20"), girdi, h("kbd", {}, "Esc")),
    liste,
    h("div", { class: "palet-alt", "aria-hidden": "true" }, h("span", {}, "↑↓ seç"), h("span", {}, "Enter aç"), h("span", {}, "Esc kapat"), h("span", {}, "> komut")));
  const perde = h("div", { class: "palet-perde", "aria-hidden": "true" });
  let satirlar = [], secili = 0;

  const kapat = () => {
    if (!P) return;
    document.removeEventListener("keydown", tus, true);
    P = null;
    perde.remove(); kutu.remove();
    for (const el of inertler) el.inert = false;
    if (acan?.isConnected) acan.focus?.({ preventScroll: true });
  };
  const calistir = (r) => { kapat(); try { r.calistir(); } catch (hata) { console.warn("[kenar-notu] Komut çalışmadı:", hata); } };
  const sec = (i, kaydir = true) => {
    if (!satirlar.length) return;
    secili = (i + satirlar.length) % satirlar.length;
    satirlar.forEach((s, j) => s.el.setAttribute("aria-selected", String(j === secili)));
    girdi.setAttribute("aria-activedescendant", satirlar[secili].el.id);
    if (kaydir) satirlar[secili].el.scrollIntoView({ block: "nearest" });
  };
  const ciz = () => {
    const q = girdi.value;
    const gruplar = [];
    if (!q.trim()) {
      const c = baglamAl();
      const tum = komutlar().filter((k) => komutUyar(k, c));
      gruplar.push(["Devam et", sonBelgeler(3).map(belgeSatiri)]);
      gruplar.push(["Git", tum.filter((k) => k.grup === "git").map((k) => komutSatiri(k, c, ""))]);
      if (c.belge) gruplar.push(["Bu belgede", tum.filter((k) => (k.baglam || "her") !== "her").slice(0, 6).map((k) => komutSatiri(k, c, ""))]);
      gruplar.push(["Son aramalar", sonAramalar().slice(0, 5).map((s) => ({ tur: "son", id: "s-" + s, ikon: "ara", ad: s, alt: "",
        calistir: () => bus.emit("git", { ekran: "arama", terim: s }) }))]);
    } else {
      const { komutlar: kl, belgeler: bl, yalnizKomut, ham } = hizliErisim(q);
      gruplar.push(["Komutlar", kl], ["Belgeler", bl]);
      if (!yalnizKomut && yeterli(katla(ham))) {
        const s = ara(ham);
        if (s) {
          const ilk = s.gruplar.flatMap((g) => g.sonuclar).slice(0, 3);
          const metin = ilk.map((x, i) => ({ tur: "metin", id: "m-" + i, ikon: "ara", adEl: baglam(x.m, x.k, s.sorgu, { pencere: 28 }),
            alt: [x.belge?.ad || x.belgeAd || x.kaynak, konumEtiketi(x)].filter(Boolean).join(" · "), calistir: () => git(x, ham) }));
          if (s.sayilar.tumu > ilk.length) metin.push({ tur: "tumu", id: "m-tumu", ikon: "sag", ad: `Bütün sonuçlar: ${s.sayilar.tumu.toLocaleString("tr")}`, alt: "",
            calistir: () => { sonAramaEkle(ham); bus.emit("git", { ekran: "arama", terim: ham }); } });
          gruplar.push(["Metinde", metin]);
        }
      }
    }
    satirlar = [];
    const parcalar = [];
    for (const [ad, rs] of gruplar) {
      if (!rs.length) continue;
      parcalar.push(h("div", { class: "palet-grup", role: "presentation" }, ad));
      for (const r of rs) {
        const el = h("div", { class: "palet-satir", role: "option", id: "palet-" + satirlar.length, "aria-selected": "false" },
          icon(r.ikon || "ok", "i-20"), h("span", { class: "palet-ad" }, r.adEl || r.ad), r.alt ? h("small", {}, r.alt) : h("small"));
        const i = satirlar.length;
        el.addEventListener("pointermove", () => { if (secili !== i) sec(i, false); });
        el.addEventListener("click", () => calistir(r));
        satirlar.push({ el, r });
        parcalar.push(el);
      }
    }
    if (!satirlar.length) parcalar.push(h("p", { class: "palet-bos" }, q.trim() ? `“${q.trim()}” için bir şey yok. Enter ile bütün kitaplıkta ara.` : "Henüz bir şey yok."));
    liste.replaceChildren(...parcalar);
    sec(0);
  };
  function tus(e) {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (girdi.value) { girdi.value = ""; ciz(); } else kapat();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sec(secili + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Tab") {
      // Tab grubun ilk satırına atlar
      e.preventDefault();
      const ileri = !e.shiftKey;
      for (let j = 1; j <= satirlar.length; j++) {
        const k = (secili + (ileri ? j : -j) + satirlar.length) % satirlar.length;
        if (satirlar[k].el.previousElementSibling?.classList.contains("palet-grup")) { sec(k); break; }
      }
    } else if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      const r = satirlar[secili]?.r;
      if (r) calistir(r);
      else if (girdi.value.trim()) { const t = girdi.value.trim(); kapat(); bus.emit("git", { ekran: "arama", terim: t }); }
    }
  }
  let zaman = 0;
  girdi.addEventListener("input", () => { clearTimeout(zaman); zaman = setTimeout(ciz, 80); });
  perde.addEventListener("pointerdown", (e) => { e.preventDefault(); kapat(); });
  document.addEventListener("keydown", tus, true);
  // Modal: arka plan ekran okuyucuya ve odağa kapalı (focus girdide kalır, Tab gruplar arasında gezer)
  const inertler = [];
  for (const el of document.body.children) {
    if (el.inert || el.tagName === "SCRIPT" || el.matches("#bildirimler")) continue;
    el.inert = true;
    inertler.push(el);
  }
  document.body.append(perde, kutu);
  P = { girdi, kapat };
  ciz();
  odakla(girdi, { klavye: true });
  girdi.select();
}
export const paletKapat = () => P?.kapat();
