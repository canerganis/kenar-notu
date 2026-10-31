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

// ---------- v2: Tekrar kartları (12. turdan beri FSRS-5; kutular görsel) ----------
// Kart: { id, tur: "bant" | "kirpinti" | "kelime" | "soru",
//         on: { metin?, gorsel? }, arka: { metin?, gorsel? },
//         belgeId, belgeAd, sayfa, kutu (1..5), sonraki (zaman damgası), gecmis: [{ zaman, bildi }],
//         fsrs?: { s: kararlılık (gün), d: zorluk 1..10, son: son tekrar zamanı } }
// Olay: "kartlar" ({ tur: "ekle" | "guncelle" | "sil", kart })
store.kartlar = [];
const GUN = 24 * 3600e3;
// Leitner dönemindeki kutu aralıkları (gün): eski kartın ilk FSRS kararlılığı buradan tahmin edilir
export const KUTU_ARALIK = [0, 1, 3, 7, 16, 35];
// Kutu artık takvimden türer: aralık KUTU_SINIR[n] günden kısaysa n. kutu (I: bugün, II: 1..2 gün, ..., V: 16 gün ve üstü)
export const KUTU_SINIR = [0, 1, 3, 7, 16];
export const aralikKutusu = (gun) => { let n = 1; while (n < 5 && gun >= KUTU_SINIR[n]) n++; return n; };
// Erişilebilir ad için: "1 ile 2 günde bir", V'te "16 günde bir ya da daha seyrek"
export const kutuAralikMetni = (n) => (n <= 1 ? "bugün yeniden" : n >= 5 ? `${KUTU_SINIR[4]} günde bir ya da daha seyrek`
  : `${KUTU_SINIR[n - 1]} ile ${KUTU_SINIR[n] - 1} günde bir`);

// FSRS-5 (open-spaced-repetition, py-fsrs 5.x varsayılan ağırlıkları). İki düğme: Bilemedim = Again (1), Bildim = Good (3).
// Unutma eğrisi R(t) = (1 + F t / S)^-0,5; F = 19/81 iken hedef 0,9 için aralık S gündür.
export const FSRS_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const FSRS_KARAR = -0.5, FSRS_F = 0.9 ** (1 / FSRS_KARAR) - 1, FSRS_HEDEF = 0.9, FSRS_EN_UZUN = 36500;
const zorlukSinirla = (d) => Math.min(10, Math.max(1, d));
const ilkZorluk = (G) => zorlukSinirla(FSRS_W[4] - Math.exp(FSRS_W[5] * (G - 1)) + 1);
export const hatirlama = (t, s) => (1 + FSRS_F * t / s) ** FSRS_KARAR;
export const fsrsAralik = (s) => Math.min(FSRS_EN_UZUN, Math.max(1, Math.round((s / FSRS_F) * (FSRS_HEDEF ** (1 / FSRS_KARAR) - 1))));
function sonrakiZorluk(d, G) {
  const ara = d + (10 - d) * (-FSRS_W[6] * (G - 3)) / 9;               // doğrusal sönüm
  return zorlukSinirla(FSRS_W[7] * ilkZorluk(4) + (1 - FSRS_W[7]) * ara);   // ortalamaya dönüş
}
function sonrakiKararlilik(d, s, r, G) {
  if (G === 1) return Math.min(
    FSRS_W[11] * d ** -FSRS_W[12] * ((s + 1) ** FSRS_W[13] - 1) * Math.exp((1 - r) * FSRS_W[14]),
    s / Math.exp(FSRS_W[17] * FSRS_W[18]));
  return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * s ** -FSRS_W[9] * (Math.exp((1 - r) * FSRS_W[10]) - 1));
}
// Kartın FSRS durumu: yoksa eski Leitner verisinden tahmin (s = kutu aralığı, d = 5, son = son cevap).
// Hiç cevaplanmamış yeni kartta null döner.
function fsrsDurumu(k) {
  if (k.fsrs && k.fsrs.s > 0) return k.fsrs;
  const kutu = Math.min(5, Math.max(1, k.kutu || 1)), gecmis = Array.isArray(k.gecmis) ? k.gecmis : [];
  if (kutu === 1 && !gecmis.length) return null;
  const son = gecmis.length ? gecmis[gecmis.length - 1].zaman : (k.sonraki || Date.now()) - KUTU_ARALIK[kutu] * GUN;
  return { s: KUTU_ARALIK[kutu], d: 5, son };
}
// Cevabın sonucu, kartı değiştirmeden: { fsrs, aralik (gün; bilemediyse 0), kutu, sonraki }.
// Tekrar ekranı "Bildim" altındaki "4 gün sonra"yı buradan yazar.
export function fsrsHesapla(k, bildi, simdi = Date.now()) {
  const G = bildi ? 3 : 1, o = fsrsDurumu(k);
  let s, d;
  if (!o) { s = Math.max(0.1, FSRS_W[G - 1]); d = ilkZorluk(G); }
  else {
    const t = Math.max(0, gunFarki(simdi, o.son));   // son tekrardan bu yana geçen takvim günü
    // Aynı gün ikinci kez görülen kart (bilemedim sonrası): kısa vadeli kararlılık
    s = t < 1 ? o.s * Math.exp(FSRS_W[17] * (G - 3 + FSRS_W[18])) : sonrakiKararlilik(o.d, o.s, hatirlama(t, o.s), G);
    d = sonrakiZorluk(o.d, G);
  }
  s = Math.min(FSRS_EN_UZUN, Math.max(0.01, s));
  const aralik = bildi ? fsrsAralik(s) : 0;
  return { fsrs: { s, d, son: simdi }, aralik, kutu: aralikKutusu(aralik), sonraki: bildi ? gunBasi(simdi, aralik) : simdi };
}
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
// Bugünün sonuna kadar vakti gelen kartlar: takvim saatle değil günle işler
export const bugunTekrar = () => { const sinir = gunBasi(Date.now(), 1); return store.kartlar.filter((k) => k.sonraki < sinir); };
// FSRS: bildiyse aralık kadar gün sonrasının sabahı düşer, bilemediyse bugün yeniden sorulur (kutu I).
export function kartCevapla(id, bildi) {
  const k = store.kartlar.find((x) => x.id === id);
  if (!k) return null;
  const simdi = Date.now(), c = fsrsHesapla(k, bildi, simdi);
  k.fsrs = c.fsrs;
  k.kutu = c.kutu;
  k.sonraki = c.sonraki;
  if (!Array.isArray(k.gecmis)) k.gecmis = [];
  k.gecmis.push({ zaman: simdi, bildi });
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

// ---------- 11. tur: platform yardımcıları (OZELLIKLER-7 §3) ----------
// Kullanıcı ajanından: iPadOS masaüstü Safari gibi görünür (Macintosh), dokunma noktası sayısıyla ayrılır.
const UA = navigator.userAgent || "";
export const ipadMi = () => /iPad/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
export const iosMu = () => /iPhone|iPod/.test(UA) || ipadMi();
export const androidMu = () => /Android/.test(UA);
export const samsungMu = () => /SM-[A-Z0-9]|Samsung/i.test(UA);
// "ios" | "android" | "masaustu"
export const platform = () => (iosMu() ? "ios" : androidMu() ? "android" : "masaustu");
// Ana ekrandan açılmış uygulama (iOS'ta navigator.standalone, öbürlerinde display-mode)
export const kuruluMu = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// Safari ve iOS'taki bütün tarayıcılar (hepsi WebKit, 7 gün kuralı hepsinde)
export const safariMi = () => iosMu() || (/Safari\//.test(UA) && !/Chrome|Chromium|Edg|OPR|Firefox|Android/.test(UA));
export const dokunmatikMi = () => matchMedia("(pointer: coarse)").matches;
export const telefonMu = () => matchMedia("(max-width: 599px), (max-height: 499px) and (orientation: landscape)").matches;

// requestIdleCallback yedeği (Safari'de yok). Dönen işlev bekleyen işi iptal eder.
export function bosta(fn, { timeout = 1000 } = {}) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const bas = performance.now();
  const id = setTimeout(() => fn({ didTimeout: performance.now() - bas >= timeout, timeRemaining: () => 8 }), 40);
  return () => clearTimeout(id);
}

// Kalem türü ipucu (rehber ve ayar başlıkları): "spen" | "pencil" | "kalem" | "parmak" | "fare".
// İlk kalem olayında değişebilir; değişince bus "kalem:tur" yayınlanır.
let kalemGoruldu = false;
export function kalemTuru() {
  if (ipadMi()) return "pencil";
  // Samsung tablet S Pen'le gelir: kalem görülmeden de S Pen metni
  if (samsungMu() && (kalemGoruldu || !/Mobile/.test(UA))) return "spen";
  if (kalemGoruldu) return "kalem";
  return matchMedia("(pointer: fine)").matches && !dokunmatikMi() ? "fare" : "parmak";
}
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "pen" || kalemGoruldu) return;
  const once = kalemTuru();
  kalemGoruldu = true;
  if (kalemTuru() !== once) bus.emit("kalem:tur", { tur: kalemTuru() });
}, { capture: true, passive: true });
export const kalemAdi = () => ({ spen: "S Pen", pencil: "Apple Pencil" })[kalemTuru()] || "Kalem";

// Programla odak (TASARIM-4 1.1.6): dokunarak açılan panelde halka çıkmaz, klavyeyle gelince çıkar.
// focusVisible desteklenmeyen tarayıcıda .odak-sessiz sınıfı halkayı gizler, ilk tuşta kalkar.
let sonGirdiKlavye = false;
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab" || e.key.startsWith("Arrow") || e.key === "Escape" || e.key === "Enter") {
    sonGirdiKlavye = true;
    document.activeElement?.classList?.remove("odak-sessiz");
  }
}, { capture: true, passive: true });
document.addEventListener("pointerdown", () => { sonGirdiKlavye = false; }, { capture: true, passive: true });
export const klavyeyleMi = () => sonGirdiKlavye;
export function odakla(el, { klavye = sonGirdiKlavye } = {}) {
  if (!el?.focus) return;
  try { el.focus({ preventScroll: true, focusVisible: klavye }); } catch { el.focus(); }
  if (!klavye) {
    el.classList.add("odak-sessiz");
    el.addEventListener("blur", () => el.classList.remove("odak-sessiz"), { once: true });
  }
}

// ---------- 11. tur: ödünç kartı (TASARIM-4 4.3) ----------
// belge.odunc = { gunler: { "2026-10-30": saniye }, bitti: zaman damgası | null }. Kitaplık kaydında durur, yedeğe girer.
// Koltuk ve Masa sayfa görünürken ve son etkileşimden beri 90 sn geçmemişken okumaSay(belgeId, ms) çağırır
// (ör. 15 sn'lik dilimlerle). Kitap son sayfaya ulaşınca okumaBitti(belgeId). Kayıt dakikada bir planlanır ("odunc").
export const gunAnahtari = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const oduncArtik = new Map();
let oduncYayin = 0;
const oduncAl = (b) => (b.odunc && typeof b.odunc === "object" && b.odunc.gunler && typeof b.odunc.gunler === "object"
  ? b.odunc : (b.odunc = { gunler: {}, bitti: null }));
export function okumaSay(belgeId, ms) {
  const b = belgeBul(belgeId);
  // Görünürlüğü çağıran denetler: gizlenirken ve kapanırken yazılan son yarım dilim de sayılır
  if (!b || !(ms > 0)) return;
  // Tek çağrıda en çok 2 dk: uykudan dönen sekme saatlerce okumuş sayılmasın
  const top = (oduncArtik.get(belgeId) || 0) + Math.min(ms, 120000);
  const sn = Math.floor(top / 1000);
  oduncArtik.set(belgeId, top - sn * 1000);
  if (!sn) return;
  const o = oduncAl(b), k = gunAnahtari();
  o.gunler[k] = (o.gunler[k] || 0) + sn;
  // Kayıt dakikada bir planlanır; sayfa gizleniyorsa hemen (sekme kapanabilir)
  if (document.hidden || Date.now() - oduncYayin > 60000) { oduncYayin = Date.now(); bus.emit("odunc", { belgeId }); }
}
export function okumaBitti(belgeId, t = Date.now()) {
  const b = belgeBul(belgeId);
  if (!b) return;
  const o = oduncAl(b);
  if (o.bitti) return;
  o.bitti = t;
  bus.emit("odunc", { belgeId, bitti: true });
}
// { gun, saniye, bitti, gunler: [["2026-10-30", 1260], ...] (eskiden yeniye) }
export function oduncOzet(b) {
  const g = b?.odunc?.gunler && typeof b.odunc.gunler === "object" ? b.odunc.gunler : {};
  const gunler = Object.entries(g).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v > 0).sort((a, c) => (a[0] < c[0] ? -1 : 1));
  return { gun: gunler.length, saniye: gunler.reduce((t, [, v]) => t + v, 0), bitti: b?.odunc?.bitti || null, gunler };
}
// 45 sn -> "1 dk", 1260 -> "21 dk", 11520 -> "3 sa 12 dk"
export function sureMetni(sn) {
  const dk = Math.max(1, Math.round(sn / 60));
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60), kalan = dk % 60;
  return kalan ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}

// ---------- 11. tur: ex libris (TASARIM-4 4.1) ----------
// store.ayarlar.exLibris = { vuruslar: [[[x, y, basınç], ...], ...] (0..1, 280'lik karede), cerceve: "daire" | "oval" | "yok",
//   renk, yazi (en çok 18 harf), surum }. Ayarlar > Ex libris'te çizilir; kaydedilince ayarla() ve bus "exlibris" yayınlanır.
// Koltuk iç kapakta, Masa ilk sayfada, disa-aktar.js notlu PDF'de exLibrisSvg(boyut, ex, { aci }) kullanır.
// Kitapta basıldı bilgisi belge.veri.exLibrisBasildi (Koltuk yazar).
export const EXLIBRIS_RENKLERI = [["Mürekkep siyahı", "#1C1B19"], ["Bordo", "#8C2B38"], ["Lacivert", "#2B4A7E"]];
export const exLibrisVar = (ex = store.ayarlar.exLibris) => !!ex && Array.isArray(ex.vuruslar) && ex.vuruslar.some((v) => Array.isArray(v) && v.length);
// Kitaba göre sabit eğim: kimlikten türetilen -6 ile -2 derece arası
export function exLibrisAci(belgeId = "") {
  let t = 7;
  for (const c of String(belgeId)) t = (t * 31 + c.charCodeAt(0)) >>> 0;
  return -6 + (t % 400) / 100;
}
let exSayac = 0;
const xmlKac = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// SVG metni döner (innerHTML ya da data URI ile kullanılır). boyut CSS px; içte 100x100 birim.
export function exLibrisSvg(boyut = 72, ex = store.ayarlar.exLibris, { aci = -4, damga = true } = {}) {
  if (!exLibrisVar(ex)) return "";
  const id = "exl" + (++exSayac).toString(36);
  const renk = /^#[0-9a-f]{6}$/i.test(ex.renk || "") ? ex.renk : EXLIBRIS_RENKLERI[0][1];
  const cerceve = ["daire", "oval", "yok"].includes(ex.cerceve) ? ex.cerceve : "daire";
  const yazi = String(ex.yazi || "").trim().toLocaleUpperCase("tr").slice(0, 18);
  const u = 100 / boyut;   // bir CSS pikseli kaç birim
  const ry = cerceve === "oval" ? 37 : 47;
  const disR = 47, icR = yazi ? disR - 11 : disR - 4.2, icRy = yazi ? ry - 11 : ry - 4.2;
  const harf = `font-family="'IBM Plex Mono', monospace" font-weight="500" font-size="${(6.5 * u).toFixed(2)}" letter-spacing="${(6.5 * u * 0.22).toFixed(2)}"`;
  let p = "";
  if (cerceve !== "yok") {
    p += `<ellipse cx="50" cy="50" rx="${disR}" ry="${ry}" fill="none" stroke-width="${(1.4 * u).toFixed(2)}"/>`;
    p += `<ellipse cx="50" cy="50" rx="${icR}" ry="${icRy}" fill="none" stroke-width="${(0.6 * u).toFixed(2)}"/>`;
    if (yazi) {
      const r = (disR + icR) / 2 - 1.6, rY = (ry + icRy) / 2 - 1.6;
      p += `<path id="${id}y" d="M${50 - r} 50a${r} ${rY} 0 1 1 ${2 * r} 0a${r} ${rY} 0 1 1 ${-2 * r} 0" fill="none" stroke="none"/>`;
      p += `<text fill="currentColor" stroke="none" ${harf}><textPath href="#${id}y" startOffset="25%" text-anchor="middle">${xmlKac(yazi)}</textPath></text>`;
    }
  } else if (yazi) {
    p += `<text x="50" y="97" fill="currentColor" stroke="none" text-anchor="middle" ${harf}>${xmlKac(yazi)}</text>`;
  }
  // Çizim karesi: Ayarlar'daki 220'lik kılavuz dairesi iç halkanın içine oturur
  const rd = cerceve === "yok" ? 42 : Math.min(icR, icRy) - 3;
  const s = (2 * rd * 280) / 220, o = 50 - s / 2;
  for (const v of ex.vuruslar) {
    if (!Array.isArray(v) || !v.length) continue;
    const ort = v.reduce((t, q) => t + (Number.isFinite(q?.[2]) ? q[2] : 0.5), 0) / v.length;
    const d = v.map((q, i) => `${i ? "L" : "M"}${(o + q[0] * s).toFixed(1)} ${(o + q[1] * s).toFixed(1)}`).join("") + (v.length === 1 ? "l.1 0" : "");
    p += `<path d="${d}" fill="none" stroke-width="${(2.2 * u * (0.65 + 0.7 * ort)).toFixed(2)}"/>`;
  }
  // Damga: kenarları hafif benekli, yer yer mürekkep eksik
  const filtre = damga ? `<filter id="${id}f" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="g"/><feDisplacementMap in="SourceGraphic" in2="g" scale=".8"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 1 1 1 1 1 .85 1"/></feComponentTransfer></filter>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${boyut}" height="${boyut}" aria-hidden="true">${filtre}<g transform="rotate(${Number(aci) || 0} 50 50)" stroke="${renk}" color="${renk}" stroke-linecap="round" stroke-linejoin="round"${damga ? ` filter="url(#${id}f)"` : ""}>${p}</g></svg>`;
}

// ---------- 11. tur: iki parmakla geri al, görsel geri bildirim (TASARIM-4 4.6) ----------
// parmakGeriBildirim({ noktalar: [[x, y]] | [{ x, y }], geri | yineleme, vardi | bos, yinele? })
// Dokunulan yerlerde sönen halkalar; altta 1,2 sn'lik cam fiş "Geri alındı" ya da "Yinelendi" (ve "Yinele").
// Masa, Koltuk ve çizgi roman aynı çağrıyı yapar; davranışın kendisi (geri alma) çağıranda.
export function parmakGeriBildirim({ noktalar = [], geri, yineleme, vardi, bos, yinele } = {}) {
  const geriMi = geri ?? !yineleme;
  const oldu = vardi ?? !bos;
  for (const n of noktalar || []) {
    const x = Array.isArray(n) ? n[0] : n?.x ?? n?.clientX, y = Array.isArray(n) ? n[1] : n?.y ?? n?.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const r = h("i", { class: "parmak-halka" + (oldu ? "" : " bos"), "aria-hidden": "true", style: `left:${x}px;top:${y}px` });
    document.body.append(r);
    setTimeout(() => r.remove(), hareketAz() ? 60 : 320);
  }
  document.querySelector(".geri-fis")?.remove();
  const fis = h("div", { class: "geri-fis", role: "status" },
    h("span", {}, !oldu ? (geriMi ? "Geri alınacak bir şey yok" : "Yinelenecek bir şey yok") : geriMi ? "Geri alındı" : "Yinelendi"));
  if (oldu && geriMi && typeof yinele === "function") fis.append(h("button", { type: "button", onclick: () => { fis.remove(); yinele(); } }, "Yinele"));
  document.body.append(fis);
  setTimeout(() => fis.remove(), oldu && geriMi && yinele ? 2000 : 1200);
}

// ---------- 11. tur: dönüş fişi (TASARIM-4 3.4) ----------
// donusFisi({ metin: "Kaldığın yer: s. 47", etiket: "Dön", calistir }): altta 4 sn'lik cam fiş; Koltuk ve Masa kullanır
export function donusFisi({ metin, etiket = "Dön", calistir, sure = 4000 } = {}) {
  document.querySelector(".donus-fis")?.remove();
  const fis = h("div", { class: "donus-fis", role: "status" }, h("span", {}, metin),
    calistir ? h("button", { type: "button", onclick: () => { fis.remove(); calistir(); } }, etiket) : null);
  document.body.append(fis);
  setTimeout(() => fis.remove(), sure);
  return fis;
}

// ---------- 11. tur: hızlı erişim komutları (TASARIM-4 3.2) ----------
// Komut: { id, ad, es ("eş sözcükler"), ikon, baglam: "her" | "belge" | "koltuk" | "masa" | "epub" | "pdf",
//          kosul?(ctx) -> bool, alt?(ctx, sorgu) -> küçük metin, calistir(ctx, sorgu) }.
// ctx: { ekran, belge, mod } (belge açık değilse belge null). arama.js boş sorguda ve yazınca listeler.
// Koltuk ve Masa kendi komutlarını (ör. "Mum ışığı", "Okuma cetveli") komutEkle ile ekler; dönen işlev çıkarır.
const KOMUTLAR = new Map();
export function komutEkle(k) {
  if (!k?.id || typeof k.calistir !== "function") return () => {};
  KOMUTLAR.set(k.id, k);
  return () => { if (KOMUTLAR.get(k.id) === k) KOMUTLAR.delete(k.id); };
}
export const komutlar = () => [...KOMUTLAR.values()];
// Açık ekran: app.js günceller ({ ekran: "kitaplik" | "belge" | "tekrar" | "arama" | "izler", belgeId, mod })
export const acikEkran = { ekran: "kitaplik", belgeId: null, mod: null };
