// Ortak parçalar: bütün ekran modülleri (app.js, duzenleyici.js, okuma.js) bunu kullanır.
// Burada sadece paylaşılan durum, olay yolu, küçük DOM yardımcıları ve sabit paletler var.
// Görsel kurallar için TASARIM.md'ye bak.

// ---------- DOM ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h("button", { class: "ikon-dugme", onclick, "aria-label": "Kapat" }, icon("kapat"), "metin")
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// index.html başındaki SVG sprite'tan simge: icon("ara") -> <svg class="i"><use href="#i-ara"/></svg>
export function icon(name, cls = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", ("i " + cls).trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#i-" + name);
  svg.append(use);
  return svg;
}

// ---------- hareket ----------
const azHareketMedya = matchMedia("(prefers-reduced-motion: reduce)");
export const hareketAz = () => azHareketMedya.matches || document.documentElement.dataset.hareket === "sade";

// ---------- olay yolu ----------
// Olaylar: "belgeler" (belge listesi değişti), "kirpintilar" (kırpıntı eklendi/silindi/notu değişti),
// "ayarlar" (store.ayarlar değişti), "git" ({ ekran: "kitaplik" | "belge", belgeId }),
// "tema" ({ koyu }: etkin tema açıktan koyuya ya da tersine döndü; ayar ya da sistem)
const dinleyiciler = new Map();
export const bus = {
  on(ad, fn) {
    if (!dinleyiciler.has(ad)) dinleyiciler.set(ad, new Set());
    dinleyiciler.get(ad).add(fn);
    return () => dinleyiciler.get(ad).delete(fn);
  },
  emit(ad, veri) {
    for (const fn of dinleyiciler.get(ad) || []) fn(veri);
  },
};

// ---------- sabit paletler (TASARIM.md 2.5) ----------
export const MUREKKEPLER = [
  ["Mürekkep mavisi", "#1F3A68"], ["Gece siyahı", "#1B1B1F"], ["Grafit", "#5C5F66"], ["Bordo", "#7D1D2C"],
  ["Vermilyon", "#C2412D"], ["Kiremit", "#B5652B"], ["Hardal", "#B8871B"], ["Zeytin", "#5F6B2A"],
  ["Zümrüt", "#1F6B52"], ["Petrol", "#1C6E7D"], ["Çivit", "#2F4FA2"], ["Gül", "#B8507A"],
];
export const KOYU_SAYFA_ESLEME = {
  "#1F3A68": "#9FB6DC", "#1B1B1F": "#E9E2D6", "#5C5F66": "#B9B2A8", "#7D1D2C": "#D98A90",
  "#1F6B52": "#7FC4A8", "#2F4FA2": "#9DB1EA", "#5F6B2A": "#B5C27A", "#1C6E7D": "#7CC3CF",
};
// Fosfor ve vurgu: kâğıtta soluk, harfin üstünde okunur tonlar (sentez 5). Limon değişmez.
// EPUB_VURGULARI'nda adı "Pembe" kalır: okuma.js vurgu kimliğini addan türetir ("pembe"), kayıtlı vurgular kopmasın.
export const FOSFORLAR = [["Limon", "#F4D63E"], ["Kayısı", "#F2B27A"], ["Gül kurusu", "#E9A79C"], ["Nane", "#9CCFAE"], ["Gök", "#9DBEE0"]];
export const EPUB_VURGULARI = [["Limon", "#F4D63E"], ["Pembe", "#E9A79C"], ["Nane", "#9CCFAE"], ["Gök", "#9DBEE0"]];
// Eski kayıtlardaki parlak tonlar yeni tonla çizilir: vurguRengi("#F49CC0") -> "#E9A79C"
const ESKI_YENI = { "#F49CC0": "#E9A79C", "#7FD3A0": "#9CCFAE", "#86C3F2": "#9DBEE0", "#F7A65A": "#F2B27A" };
export const vurguRengi = (hex) => (typeof hex === "string" && ESKI_YENI[hex.toUpperCase()]) || hex;
export const NOT_RENKLERI = [["Tereyağı", "#F8E7A1"], ["Gül kurusu", "#F2C6BE"], ["Adaçayı", "#D3E2C4"], ["Buz mavisi", "#CDE0EF"], ["Kayısı", "#F6D3A8"]];
// Bant: dört soluk ton (tasarim.css --bant-*). Kimlikler eski kayıtlarla aynı kalır, yalnız ton ve ad değişti.
export const BANTLAR = [["Lacivert", "murekkep"], ["Gül", "bordo"], ["Pirinç", "hardal"], ["Adaçayı", "adacayi"]];
export const BANT_TONLARI = { murekkep: "--bant-lacivert", bordo: "--bant-gul", hardal: "--bant-pirinc", adacayi: "--bant-adacayi" };
export const KAPAK_RENKLERI = [
  ["Lacivert", "#24324F"], ["Bordo", "#6E1F2A"], ["Çam", "#2F4A3E"], ["Zeytin", "#5B5F36"],
  ["Hardal", "#B0822A", true], ["Kiremit", "#A5502F"], ["Kum", "#CDBB96", true], ["Mürekkep", "#232428"],
];
export const CILT_RENKLERI = ["#5A1A22", "#34442A", "#24324F", "#5B4A2E", "#2E4A4A", "#4A2E46"];
export const KLASORLER = [
  { id: "kalkulus", ad: "Kalkülüs II", renk: "#1F3A68" },
  { id: "statik", ad: "Statik", renk: "#B8871B" },
  { id: "anatomi", ad: "Anatomi", renk: "#9E3B4A" },
];
// Kalınlık mm olarak saklanır; çizim genişliği (sayfa birimi) = mm × 5.
export const VARSAYILAN_KALEMLER = [
  { tur: "dolma", renk: "#1F3A68", mm: 0.6 },
  { tur: "tukenmez", renk: "#C2412D", mm: 0.5 },
  { tur: "kursun", renk: "#5C5F66", mm: 0.7 },
];

// ---------- paylaşılan durum ----------
// Belge: { id, tur: "pdf" | "epub" | "defter" | "cizgi", ad, yazar?, klasor?, sayfaSayisi, sayfa (kaldığı sayfa),
//          ilerleme (0..1), favori, acilis (zaman damgası), kapak (renk), kagit? (defterde TEMPLATES id),
//          veri: null }  // veri: düzenleyici/okuyucu modülünün kendi durumu, ilk açılışta modül doldurur
// Kırpıntı: { id, gorsel (dataURL), belgeId, belgeAd, sayfa, not, zaman }
const saat = 3600e3;
const simdi = Date.now();
export const store = {
  belgeler: [
    { id: "kalkulus", tur: "pdf", ad: "Kalkülüs II Ders Notları", yazar: "Bölüm 3, Türev", klasor: "kalkulus", sayfaSayisi: 312, sayfa: 47, ilerleme: 47 / 312, favori: true, acilis: simdi - 2 * saat, kapak: "#1F3A68", veri: null },
    { id: "statik", tur: "pdf", ad: "Statik: Çözümlü Problemler", yazar: "Kirişler ve mesnetler", klasor: "statik", sayfaSayisi: 188, sayfa: 23, ilerleme: 23 / 188, favori: false, acilis: simdi - 26 * saat, kapak: "#B8871B", veri: null },
    { id: "anatomi", tur: "pdf", ad: "Üst Ekstremite Anatomisi", yazar: "Kas ve sinirler", klasor: "anatomi", sayfaSayisi: 96, sayfa: 61, ilerleme: 61 / 96, favori: false, acilis: simdi - 3 * 24 * saat, kapak: "#9E3B4A", veri: null },
    { id: "sucveceza", tur: "epub", ad: "Suç ve Ceza", yazar: "Fyodor Dostoyevski", sayfaSayisi: 0, sayfa: 0, ilerleme: 0.34, favori: true, acilis: simdi - 5 * saat, kapak: "#5A1A22", veri: null },
    { id: "kagit", tur: "epub", ad: "Kâğıdın Hafızası", yazar: "Deneme", sayfaSayisi: 0, sayfa: 0, ilerleme: 0.18, favori: true, acilis: simdi - 1 * saat, kapak: "#24324F", veri: null },
    { id: "donusum", tur: "epub", ad: "Dönüşüm", yazar: "Franz Kafka", sayfaSayisi: 0, sayfa: 0, ilerleme: 0.12, favori: false, acilis: simdi - 14 * 24 * saat, kapak: "#34442A", veri: null },
    { id: "difdenk", tur: "defter", ad: "Diferansiyel Denklemler", klasor: "kalkulus", sayfaSayisi: 14, sayfa: 1, ilerleme: 0, favori: false, acilis: simdi - 30 * saat, kapak: "#24324F", kagit: "grid", veri: null },
    { id: "fizyoloji", tur: "defter", ad: "Fizyoloji Notları", klasor: "anatomi", sayfaSayisi: 22, sayfa: 1, ilerleme: 0, favori: true, acilis: simdi - 4 * 24 * saat, kapak: "#2F4A3E", kagit: "lined", veri: null },
    { id: "fikirler", tur: "defter", ad: "Proje Fikirleri", sayfaSayisi: 5, sayfa: 1, ilerleme: 0, favori: false, acilis: simdi - 20 * 24 * saat, kapak: "#B0822A", kagit: "dotted", veri: null },
  ],
  kirpintilar: [],
  ayarlar: {
    tema: "oto",          // "oto" | "acik" | "koyu"  -> html[data-theme]
    sayfaRengi: "oto",    // "oto" | "beyaz" | "sepya" | "koyu" | "tahta"; okurken sayfaCoz() ile çözülür
    sadeHareket: false,   // html[data-hareket="sade"]
    parmaklaCiz: true,    // kalem algılanınca düzenleyici bunu false yapar
  },
};

export const belgeBul = (id) => store.belgeler.find((b) => b.id === id);

// ---------- örnek veri sürümü ----------
// Örnek belgelerin sayfaları, süsleri, örnek kırpıntılar ya da kartlar değişince ORNEK_SURUM artırılır,
// değişen parça ORNEK_DEGISIM'de o sürüme çekilir, örnek PDF'lerin sayfa düzeni ORNEK_SAYFALAR'a eklenir.
// Açılışta app.js eski sürümdeki kayıtlı örneği yeniler: kullanıcı bir şey eklemediyse baştan kurar,
// eklediyse sayfa eşlemesini taşır ve eklediklerini korur. Kitaplık kaydı sürümü "ornekSurum" alanında tutar.
//   1: 7. turdan önce (üç örnek PDF de aynı üç sayfayı gösteriyordu), 2: 7. tur (her örnek PDF kendi üç sayfası)
export const ORNEK_SURUM = 2;
// Parçanın en son değiştiği sürüm: kayıttaki örnek bundan eskiyse yenilenir
export const ORNEK_DEGISIM = { kalkulus: 2, statik: 2, anatomi: 2, difdenk: 2, kirpintilar: 2, kartlar: 2 };
// Örnek PDF'te veri.sayfalar[].pdf sırasının o sürümde gösterdiği sayfa: sayfalar.js çizim fonksiyonunun adı
// (eski sürümün sayfası bugün hangi fonksiyonsa o). Fonksiyon adı değişirse buradaki adlar da değişmeli.
const ESKI_UCLU = ["kalkulus1", "kalkulus2", "statik3"];
export const ORNEK_SAYFALAR = {
  1: { kalkulus: ESKI_UCLU, statik: ESKI_UCLU, anatomi: ESKI_UCLU },
  2: { kalkulus: ["kalkulus1", "kalkulus2", "kalkulus3"], statik: ["statik1", "statik2", "statik3"], anatomi: ["anatomi1", "anatomi2", "anatomi3"] },
};

// ---------- sayfa rengi "oto" ----------
// Etkin tema: html[data-theme] ayarı varsa o, yoksa sistem. Tema değişince app.js bus.emit("tema", { koyu }) yayınlar.
const koyuMedya = matchMedia("(prefers-color-scheme: dark)");
export const temaKoyu = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : koyuMedya.matches; };
// "oto" Koltuk'ta temayı izler (koyu temada koyu sayfa), Masa'da hep beyaz kalır: PDF yeniden çizilmez, mürekkep bozulmaz.
// Öbür değerler olduğu gibi döner. sayfaCoz("koltuk") | sayfaCoz("masa")
export function sayfaCoz(baglam = "koltuk") {
  const r = store.ayarlar.sayfaRengi || "oto";
  if (r !== "oto") return r;
  return baglam === "koltuk" && temaKoyu() ? "koyu" : "beyaz";
}

// Panoya yazar. Güvenli olmayan bağlantıda (http://192.168...) navigator.clipboard yoktur:
// gizli metin alanı ve execCommand("copy") ile denenir. Yazıldıysa true döner.
export async function panoyaYaz(metin) {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(metin); return true; }
  } catch { /* yedek yola geç */ }
  const odak = document.activeElement;
  const t = h("textarea", { readonly: true, "aria-hidden": "true", style: { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" } });
  t.value = metin;
  document.body.append(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  t.remove();
  odak?.focus?.({ preventScroll: true });
  return ok;
}

let sayac = 0;
export const yeniId = (on = "x") => on + (simdi % 1e6).toString(36) + (++sayac).toString(36);

export function kirpintiEkle({ gorsel, belgeId, belgeAd, sayfa, not = "" }) {
  const k = { id: yeniId("k"), gorsel, belgeId, belgeAd, sayfa, not, zaman: Date.now() };
  store.kirpintilar.unshift(k);
  bus.emit("kirpintilar", { tur: "ekle", kirpinti: k });
  return k;
}
export function kirpintiSil(id) {
  const i = store.kirpintilar.findIndex((k) => k.id === id);
  if (i >= 0) store.kirpintilar.splice(i, 1);
  bus.emit("kirpintilar", { tur: "sil", id });
}

export function ayarla(degisiklik) {
  Object.assign(store.ayarlar, degisiklik);
  bus.emit("ayarlar", store.ayarlar);
}

// ---------- bildirim ve onay ----------
// app.js #bildirim öğesini oluşturur ve bu fonksiyonu gerçek görünümle doldurur (setBildirimGosterici).
let bildirimGosterici = (metin) => console.log("[bildirim]", metin);
export const setBildirimGosterici = (fn) => (bildirimGosterici = fn);
// toast("Kırpılanlar'a kaydedildi", { etiket: "Göster", calistir: () => ... })
export const toast = (metin, eylem) => bildirimGosterici(metin, eylem);

// İki dokunuşla onay: ilk dokunuşta düğme "Emin misin?" olur ve 3 sn bekler, ikincide çalışır.
export function ikiDokunus(dugme, onayMetni, fn) {
  let zamanlayici = null;
  const asil = dugme.innerHTML;
  dugme.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dugme.dataset.onay === "1") {
      clearTimeout(zamanlayici);
      dugme.dataset.onay = "";
      dugme.innerHTML = asil;
      fn();
      return;
    }
    dugme.dataset.onay = "1";
    dugme.textContent = onayMetni;
    zamanlayici = setTimeout(() => { dugme.dataset.onay = ""; dugme.innerHTML = asil; }, 3000);
  });
}

// ---------- v2: Koltuk ve Masa modları ----------
// belge.mod: "koltuk" (okuma) | "masa" (çalışma). Alan yoksa türe göre varsayılan.
export const varsayilanMod = (b) => b.mod || (b.tur === "epub" ? "koltuk" : "masa");

// ---------- 9. tur: çizgi roman (OZELLIKLER-5) ----------
// Belge: { tur: "cizgi", sayfaSayisi, sayfa, yon: "ltr" | "rtl", seri?, sayi?, yazar?, dosya: true, ... }
// Bir PDF de çizgi roman olarak okunabilir: belge.cizgi = true. İkisi de cizgi.js ile açılır.
export const cizgiMi = (b) => !!b && (b.tur === "cizgi" || (b.tur === "pdf" && !!b.dosya && !!b.cizgi));

// ---------- 9. tur: izler ve derlemeler (OZELLIKLER-5 "İzler") ----------
// belge.veri.izler: [{ id, tur: "alt" | "daire" | "kenar" | "isaret" | "serbest", zaman, renk, metin,
//   bas?, son?, cizgiler? (Koltuk, metne bağlı) | sayfa?, kutu?, cizgiIdleri? (Masa ve çizgi roman, sayfaya bağlı),
//   not? (cep defterinde yanına yazılan kısa not) }]
// store.derlemeler: [{ id, ad, olusturma, girdiler: [{ belgeId, izId }] }] (kayit.js "derlemeler"; olay "derlemeler")
// Olaylar: "izler:ac" ({ belgeId }: Notlar panelinin İzler sekmesi), "defter:ac" ({ belgeId }: cep defteri),
//   "iz:goster" ({ belgeId, izId }: belge açıldıktan sonra hedef iz bir an parlar; ekranı açan modül dinler).
store.derlemeler = [];

// ---------- 9. tur: S Pen ayarları ----------
// store.ayarlar.yanTusSilgi: false ise yan tuş silgi olmaz (varsayılan açık).
// store.ayarlar.basincEgrisi: "yumusak" | "orta" | "sert" (varsayılan "orta"). Kalem basıncı çizgiye girmeden önce
// basincUygula(e.pressure) ile eğriden geçer: yumuşakta hafif dokunuş kalın, sertte bastırmak gerekir.
export const yanTusSilgiMi = () => store.ayarlar.yanTusSilgi !== false;
const EGRI_US = { yumusak: 0.6, orta: 1, sert: 1.7 };
export function basincUygula(p) {
  const us = EGRI_US[store.ayarlar.basincEgrisi] || 1;
  if (!Number.isFinite(p) || p <= 0) return p;
  return us === 1 ? p : Math.pow(Math.min(1, p), us);
}
// Mod değiştirme: belge.mod = yeni; bus.emit("git", { ekran: "belge", belgeId, mod: yeni })

// ---------- v2: Tekrar kartları (Leitner kutuları) ----------
// Kart: { id, tur: "bant" | "kirpinti" | "kelime" | "soru",
//         on: { metin?, gorsel? }, arka: { metin?, gorsel? },
//         belgeId, belgeAd, sayfa, kutu (1..5), sonraki (zaman damgası), gecmis: [{ zaman, bildi }] }
// Olay: "kartlar" ({ tur: "ekle" | "guncelle" | "sil", kart })
store.kartlar = [];
const GUN = 24 * 3600e3;
export const KUTU_ARALIK = [0, 1, 3, 7, 16, 35]; // kutu n -> n. aralık (gün)
export function kartEkle(alanlar) {
  const k = { id: yeniId("t"), kutu: 1, sonraki: Date.now(), gecmis: [], on: {}, arka: {}, ...alanlar };
  store.kartlar.unshift(k);
  bus.emit("kartlar", { tur: "ekle", kart: k });
  return k;
}
export function kartGuncelle(id, degisiklik) {
  const k = store.kartlar.find((x) => x.id === id);
  if (!k) return null;
  Object.assign(k, degisiklik);
  bus.emit("kartlar", { tur: "guncelle", kart: k });
  return k;
}
export function kartSil(id) {
  const i = store.kartlar.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [k] = store.kartlar.splice(i, 1);
  bus.emit("kartlar", { tur: "sil", kart: k });
}
// Takvim günü: yerel gece yarısı. setDate yaz saati geçişinde de günü doğru kurar.
export function gunBasi(t = Date.now(), ekGun = 0) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (ekGun) d.setDate(d.getDate() + ekGun);
  return d.getTime();
}
// İki an arasındaki takvim günü farkı (bugün 0, yarın 1)
export const gunFarki = (t, simdi = Date.now()) => Math.round((gunBasi(t) - gunBasi(simdi)) / GUN);
// Bugünün sonuna kadar vakti gelen kartlar: Leitner takvimi saatle değil günle işler
export const bugunTekrar = () => { const sinir = gunBasi(Date.now(), 1); return store.kartlar.filter((k) => k.sonraki < sinir); };
// Bildiyse bir üst kutuya, bilemediyse 1. kutuya döner. Bildiyse n gün sonrasının sabahı düşer.
export function kartCevapla(id, bildi) {
  const k = store.kartlar.find((x) => x.id === id);
  if (!k) return null;
  k.kutu = bildi ? Math.min(5, k.kutu + 1) : 1;
  k.sonraki = bildi ? gunBasi(Date.now(), KUTU_ARALIK[k.kutu]) : Date.now();
  k.gecmis.push({ zaman: Date.now(), bildi });
  bus.emit("kartlar", { tur: "guncelle", kart: k });
  return k;
}

// ---------- v2: Yapay zekâ asistanı ----------
// Varsayılan yol "hesap": soru, kullanıcının zaten giriş yaptığı ChatGPT / Gemini / Claude uygulamasına
// paylaş menüsüyle ya da hazır bağlantıyla gider, cevap orada gelir. Anahtar gerekmez.
// "q" parametreleri resmi değil (özellikle Gemini); çalışmazsa metin panoya kopyalanır, kullanıcı yapıştırır.
export const YZ_UYGULAMALAR = [
  { id: "chatgpt", ad: "ChatGPT", url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { id: "gemini", ad: "Gemini", url: (q) => `https://gemini.google.com/app?q=${encodeURIComponent(q)}` },
  { id: "claude", ad: "Claude", url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
];
// Gelişmiş yol "anahtar": kendi API anahtarıyla cevap uygulamanın içinde akar. Model adı düzenlenebilir.
export const YZ_SAGLAYICILAR = [
  { id: "deneme", ad: "Deneme (çevrimdışı)", varsayilanModel: "deneme" }, // anahtarsız, hazır cevaplar
  { id: "gemini", ad: "Gemini", varsayilanModel: "gemini-3.8-flash" },
  { id: "claude", ad: "Claude", varsayilanModel: "claude-opus-5-5" },
  { id: "openai", ad: "ChatGPT", varsayilanModel: "gpt-6-astra" },
];
store.ayarlar.yz = {
  yol: "hesap",          // "hesap" | "anahtar"
  uygulama: "chatgpt",   // hesap yolunda hangi uygulama
  saglayici: "deneme",   // anahtar yolunda hangi sağlayıcı
  anahtarlar: { gemini: "", claude: "", openai: "" },
  modeller: Object.fromEntries(YZ_SAGLAYICILAR.map((s) => [s.id, s.varsayilanModel])),
};
// Sormak için: bus.emit("sor", { soru?, metin?, gorsel? (PNG dataURL), hazir?: "acikla" | "ozetle" | "anlam" | "soru-uret",
//                                 belgeId, belgeAd, sayfa, kaynak: "koltuk" | "masa" })
// asistan.js dinler, kendi panelini açar. Hesap yolunda cevap dış uygulamada gelir; panelde "Cevabı getir"
// (panodan yapıştır) ile geri alınır. Cevaptan "Kenara not" -> bus.emit("asistan:not", { belgeId, sayfa, metin }),
// "Karta çevir" -> kartEkle({ tur: "soru", ... }).

// ---------- ekran modülü sözleşmesi ----------
// duzenleyici.js (PDF, defter), okuma.js (EPUB) ve cizgi.js (çizgi roman: tur "cizgi" ya da belge.cizgi) şunu dışa aktarır:
//   export function ac(kap, belge, sayfa, mod)   // kap: boş bir <section>; mod: "koltuk" | "masa" (yoksa varsayilanMod)
// tekrar.js: export function ac(kap) ve kapat(). asistan.js: export function kur() (bir kez, app.js açılışta çağırır).
//   export function kapat()          // dinleyicileri ve zamanlayıcıları temizler
// Kitaplığa dönmek için: bus.emit("git", { ekran: "kitaplik" })
