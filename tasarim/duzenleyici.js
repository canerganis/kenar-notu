// Kenar Notu: PDF ve defter düzenleyicisi.
// Sözleşme (ortak.js sonu): ac(kap, belge) ve kapat(). Belgenin bütün durumu belge.veri içinde kalır.
// Koordinatlar sayfa birimindedir (sayfa 800 birim); ekranda k = sayfa pikseli / 800.
// Görsel kurallar TASARIM.md 3.10 ile 3.26 ve 6. bölümde.

import { h, icon, hareketAz, bus, store, yeniId, toast, ayarla, kirpintiEkle,
  MUREKKEPLER, KOYU_SAYFA_ESLEME, FOSFORLAR, NOT_RENKLERI, BANTLAR, VARSAYILAN_KALEMLER,
  belgeBul, varsayilanMod, kartEkle, kartGuncelle, kartSil, KUTU_ARALIK, panoyaYaz, YZ_UYGULAMALAR, YZ_SAGLAYICILAR } from "./ortak.js";
// Kabukla aynı anda gelen yardımcılar (sayfaCoz, temaKoyu, vurguRengi): ad alanından okunur, yoksa yerel yedek çalışır
import * as ORTAK from "./ortak.js";
import { PW, PH, PDF_PAGES, drawTemplate } from "./sayfalar.js";
import * as SAYFALAR from "./sayfalar.js";
import { cizgiCiz, hepsiniCiz, CanliKatman, islakBitir, islakAktar, silgi, kementSec, sinirKutusu, tasi,
  duzlestir, Gecmis, bolgeYakala, ornekDalga, sekilTani, cizgiyeDokunuyor, bolgeyiCiz, cizgilerKutusu, izSinifla, satirlaraTopla } from "./kalem.js";

// ---------- sabitler ----------
const KW = 272, TW = PW + KW;                 // kenar alanı genişliği, kenarlı toplam
const sinirla = (v, a, b) => (v < a ? a : v > b ? b : v);
const kSinirla = (k) => sinirla(k, 0.6, 3);
const EGRI_KAGIT = "cubic-bezier(.22,.8,.24,1)";
const EGRI_MUREKKEP = "cubic-bezier(.62,0,.32,1)";
const EGRI_CEKIL = "cubic-bezier(.4,0,1,1)";
const KALEM_ADLARI = { dolma: "Dolma kalem", tukenmez: "Tükenmez", kursun: "Kurşun kalem" };
const HIZLI_MM = [[0.3, 4], [0.6, 7], [1.2, 11]];
const HIZLI_FOSFOR = [[14, 6], [22, 10], [32, 16]];
const HIZLI_SILGI = [[8, 6], [16, 10], [32, 16]];
const HIZLI_METIN = [[14, 14], [18, 18], [24, 24]];
const CIZGI_PX = [2, 4, 7], FOSFOR_PX = [5, 8, 12];   // bağlamdaki kalınlık örneklerinin çizgi kalınlığı
// Balondaki kaydırıcının çizgi örneği: bağlamın üç örneğinden doğrusal geçer (uçlarda aynı eğimle uzar),
// böylece 0,6 mm balonda da bağlamdaki 4px çizgidir
function ornekPx(v, hizli, px) {
  let i = 0;
  while (i < hizli.length - 2 && v > hizli[i + 1][0]) i++;
  const t = (v - hizli[i][0]) / (hizli[i + 1][0] - hizli[i][0]);
  return Math.max(1, Math.round((px[i] + (px[i + 1] - px[i]) * t) * 2) / 2);
}
const SEKILLER = [["cizgi", "Çizgi"], ["ok", "Ok"], ["dikdortgen", "Dikdörtgen"], ["elips", "Elips"]];
const KAGITLAR = [["blank", "Boş", ""], ["lined", "Çizgili", "k-cizgili"], ["grid", "Kareli", "k-kareli"], ["dotted", "Noktalı", "k-noktali"]];
const KAGIT_ADI = { blank: "Boş sayfa", lined: "Çizgili sayfa", grid: "Kareli sayfa", dotted: "Noktalı sayfa", cornell: "Cornell sayfası" };
const GLIF_ARACLAR = [
  ["silgi", "Silgi", "silgi", "E"], ["kement", "Kement", "kement", "L"], ["sekil", "Şekil", "sekil", ""],
  ["metin", "Metin", "metin", "T"], ["not", "Yapışkan not", "not", "N"], ["damga", "Damga", "damga", "S"], ["bant", "Bant", "bant", ""], ["kirp", "Kırp", "kirp", ""],
];
// Sembol damgaları (OZELLIKLER-4 4.3): dokunulan yere Literata metin nesnesi olarak düşer
const DAMGA_GRUPLARI = [
  ["Matematik", ["∫", "∑", "∏", "√", "∂", "∇", "∞", "≈", "≠", "≤", "≥", "±", "→", "⇒", "⇔", "∀", "∃", "∈", "∉", "⊂", "∪", "∩", "ℝ", "ℕ"]],
  ["Yunan", ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "π", "σ", "τ", "φ", "ω", "Δ", "Σ", "Ω"]],
  ["Tıp", ["↑", "↓", "Δ", "℞", "♂", "♀", "Ø", "⊕", "⊖", "~", "Dx", "Tx"]],
  ["Mühendislik", ["Ω", "μ", "°", "⌀", "∠", "⊥", "∥", "≅"]],
];
const DAMGA_FS = 28;
const CIZIM = new Set(["kalem0", "kalem1", "kalem2", "fosforlu"]);
const NOT_ACILARI = [-2, 1.5, -1, 2, -1.5];
// Bant tonları kabuğun --bant-* jetonlarından (kimlikler eski kayıtlarla aynı); jeton yoksa aynı ton yedekte
const BANT_RENGI = { murekkep: "var(--bant-lacivert, #8EA3C7)", bordo: "var(--bant-gul, #D9A9A0)", hardal: "var(--bant-pirinc, #D8BC7E)", adacayi: "var(--bant-adacayi, #A7BFA3)" };
const BANT_ACI = -0.8;   // varsayılan eğim (derece): hafif, elle yapıştırılmış gibi
const NOT_W = 200;

const KALEM_SVG = {
  dolma: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="altin" d="M10 .8C12.4 4 13.6 7.6 13.6 12H6.4C6.4 7.6 7.6 4 10 .8Z"/><path class="yarik" d="M10 3.2v5.4"/><circle class="delik" cx="10" cy="9.3" r=".9"/><path class="boyun" d="M6.4 12h7.2l.6 7H5.8Z"/><rect class="u" x="5.6" y="19" width="8.8" height="3.2"/><path class="g" d="M5.6 22.2h8.8V56H5.6Z"/><path class="faset" d="M7.8 26v14"/></svg>',
  tukenmez: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><circle class="u" cx="10" cy="2.4" r="1.5"/><path class="m" d="M9 3.6h2l2.6 7.4H6.4Z"/><rect class="u" x="6" y="11" width="8" height="9" rx=".8"/><path class="g" d="M6 20h8v36H6Z"/><path class="faset" d="M8.2 24v14"/></svg>',
  kursun: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="ahsap" d="M8.1 5h3.8L14 12H6Z"/><path class="u" d="M10 .9 11.9 5H8.1Z"/><path class="u" d="M6 12l1.3-1.2L8.7 12l1.3-1.2 1.3 1.2 1.4-1.2L14 12v44H6Z"/><path class="faset" d="M8.7 12v44M11.3 12v44"/></svg>',
  fosforlu: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="u yari" d="M7 10.5 13 3.5v7Z"/><path class="m" d="M5.6 10.5h8.8l.8 3.5H4.8Z"/><rect class="u" x="4" y="14" width="12" height="5"/><path class="g" d="M4 19h12v37H4Z"/></svg>',
};

// ---------- küçük yardımcılar ----------
let D = null;   // açık belgenin bütün çalışma durumu; kapat() sıfırlar
let A = null;   // araç ayarları (oturum boyunca belgeler arasında ortak)
let kalemAlgilandi = false;

const svgDen = (s) => { const t = document.createElement("template"); t.innerHTML = s; return t.content.firstElementChild; };
const etiket = (metin) => h("span", { class: "t-etiket" }, metin);
const mmYaz = (mm) => (Math.round(mm * 10) / 10).toLocaleString("tr") + " mm";
// Sayfa rengi ayarı "oto" | "beyaz" | "sepya" | "koyu" | "tahta". Masa'da "oto" hep beyaz çözülür (sayfaCoz("masa")):
// tema değişince PDF yeniden çizilmez, mürekkep renkleri değişmez. Önbellek anahtarları çözülmüş değeri kullanır.
const SAYFA_RENKLERI = new Set(["beyaz", "sepya", "koyu", "tahta"]);
const ayarRengi = () => store.ayarlar.sayfaRengi || "oto";          // menüdeki seçili disk
const hamRenk = () => {
  let r = null;
  try { r = ORTAK.sayfaCoz?.("masa"); } catch { r = null; }
  if (!SAYFA_RENKLERI.has(r)) { r = ayarRengi(); if (!SAYFA_RENKLERI.has(r)) r = "beyaz"; }
  return r;
};
// Tahta masada koyu sayfa olarak çizilir; ters çevrilen sayfanın zemini sonra tahta yeşiline açılır (tahtaPisir)
const sayfaRengi = () => { const r = hamRenk(); return r === "tahta" ? "koyu" : r; };
const temaKoyu = () => {
  try { if (ORTAK.temaKoyu) return !!ORTAK.temaKoyu(); } catch { /* yedeğe geç */ }
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
// Kullanıcı defteri (kâğıt sayfa) zemini: açıkta sıcak beyaz, koyu temada beyaz sayfa göz almasın diye krem. PDF hep #fff.
const kagitZemin = (renk = sayfaRengi()) => (renk === "beyaz" && temaKoyu() ? "#EFE9DC" : "#FCFAF4");
const vurguRengi = (c) => { try { return ORTAK.vurguRengi ? ORTAK.vurguRengi(c) : c; } catch { return c; } };
const TAHTA = "#1F2622";
function tahtaPisir(ctx) {
  if (hamRenk() !== "tahta") return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighten";   // koyu zemin tahtaya döner, açık mürekkep ve yazı olduğu gibi kalır
  ctx.fillStyle = TAHTA;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
const koyuMu = () => sayfaRengi() === "koyu";
const renkSayfaya = (c) => (koyuMu() ? KOYU_SAYFA_ESLEME[String(c).toUpperCase()] || c : c);
const dar = () => matchMedia("(max-width: 999px)").matches;
const renkAdi = (c) => {
  const u = String(c).toUpperCase();
  return ([...MUREKKEPLER, ...FOSFORLAR, ...NOT_RENKLERI].find(([, r]) => r.toUpperCase() === u) || ["Özel renk"])[0];
};
const kalinlikPx = (mm) => sinirla(Math.round(1 + mm * 3.3), 2, 7) + "px";
const yaziAlani = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
// Sprite'ta olan ilk simge; hiçbiri yoksa küçük bir yazı (yeni simgeler kabukla aynı anda geliyor)
function ikonSec(adlar, yedek, cls = "") {
  for (const ad of adlar) if (document.getElementById("i-" + ad)) return icon(ad, cls);
  return h("span", { class: "ikon-yedek", "aria-hidden": "true" }, yedek);
}

function dinle(hedef, olay, fn, sec) {
  hedef.addEventListener(olay, fn, sec);
  D.temizlik.push(() => hedef.removeEventListener(olay, fn, sec));
}
function zaman(fn, ms) {
  if (!D) return 0;
  const d = D;
  const id = setTimeout(() => { d.z.delete(id); if (D === d) fn(); }, ms);
  d.z.add(id);
  return id;
}
function zamanIptal(id) { if (id) { clearTimeout(id); D?.z.delete(id); } }
function animasyonBitince(el, sinif, ms) {
  el.classList.add(sinif);
  const bitir = () => el.classList.remove(sinif);
  el.addEventListener("animationend", bitir, { once: true });
  setTimeout(bitir, ms + 80);
}

// Cubic-bezier eğrisi (JS ile kaydırma için): x'ten y'yi ikili aramayla bulur
function egri(x1, y1, x2, y2) {
  const b = (t, a1, a2) => 3 * (1 - t) * (1 - t) * t * a1 + 3 * (1 - t) * t * t * a2 + t * t * t;
  return (x) => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) { const v = b(t, x1, x2); if (Math.abs(v - x) < 1e-4) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return b(t, y1, y2);
  };
}
const murekkepEgrisi = egri(0.62, 0, 0.32, 1);

// İlk kullanım ipuçları yalnız bir kez gösterilir
function ipucuGosterildi(ad) {
  try { return !!JSON.parse(localStorage.getItem("kn-tasarim:ipucu") || "{}")[ad]; } catch { return false; }
}
function ipucuIsaretle(ad) {
  try {
    const o = JSON.parse(localStorage.getItem("kn-tasarim:ipucu") || "{}");
    o[ad] = true;
    localStorage.setItem("kn-tasarim:ipucu", JSON.stringify(o));
  } catch { /* gizli pencere */ }
}

// ---------- araç ayarları ----------
function aracAyarlari() {
  if (store.ayarlar.araclar) return store.ayarlar.araclar;
  const sonlar = (renk) => [renk, ...["#1B1B1F", "#1F3A68", "#7D1D2C", "#C2412D", "#1F6B52", "#5C5F66"].filter((c) => c !== renk)].slice(0, 5);
  store.ayarlar.araclar = {
    etkin: "kalem0", sonKalem: 0, konum: "ust",
    kalemler: VARSAYILAN_KALEMLER.map((k) => ({ ...k, son: sonlar(k.renk) })),
    fosforlu: { renk: FOSFORLAR[0][1], w: 22, duz: false },
    silgi: { r: 16, sadeceFosforlu: false },
    sekil: "cizgi",
    metin: { fs: 18, renk: "#1B1B1F", son: sonlar("#1B1B1F") },
    not: { renk: NOT_RENKLERI[0][1] },
    bant: { desen: "murekkep" },
  };
  return store.ayarlar.araclar;
}
function renkSec(hedef, renk) {
  hedef.renk = renk;
  if (hedef.son && !hedef.son.includes(renk)) hedef.son = [renk, ...hedef.son].slice(0, 5);
}

// ---------- ilk veri ----------
function yeniSayfa(o) {
  return { id: yeniId("s"), kenar: false, yerImi: false, cizgiler: [], notlar: [], metinler: [], bantlar: [], gorseller: [], ...o };
}
// Örnek belgenin sayfa listesi: sayfalar.js ornekSayfalari(belgeId) verirse ondan, yoksa ortak PDF_PAGES
function ornekSayfalariAl(belgeId) {
  try {
    const l = typeof SAYFALAR.ornekSayfalari === "function" ? SAYFALAR.ornekSayfalari(belgeId) : null;
    return Array.isArray(l) && l.length ? l : PDF_PAGES;
  } catch (e) { console.warn("[duzenleyici] örnek sayfalar:", e); return PDF_PAGES; }
}
const ornekListe = () => D?.ornekler || PDF_PAGES;

// Sayfası olmayan önceki veri (ör. çizgi roman okuyucusunun yazdığı { cizgi, izler }) yeni sayfalarla birleşir: alanları korunur
function veriHazirla(belge, pdf = null) {
  const eski = belge.veri && typeof belge.veri === "object" ? belge.veri : null;
  const v = ilkVeri(belge, pdf);
  if (eski) for (const [k, x] of Object.entries(eski)) if (!(k in v)) v[k] = x;
  return v;
}
function ilkVeri(belge, pdf = null) {
  // Gerçek PDF: her sayfa dosyanın kendi sayfası (pdf: 0'dan sıra), kesit ve ek sayfa yok
  if (pdf) {
    const sayfalar = Array.from({ length: pdf.sayfaSayisi }, (_, i) => yeniSayfa({ tur: "pdf", pdf: i }));
    const ilk = sinirla(belge.sayfa || 1, 1, sayfalar.length);
    return { surum: 1, sayfalar, konum: { sayfa: ilk - 1, oran: 0 }, k: null, sigdir: true };
  }
  // Defter kitaplıkta yazan sayfa sayısıyla açılır (en az 3)
  const sayfalar = belge.tur === "defter"
    ? Array.from({ length: Math.max(3, belge.sayfaSayisi || 0) }, () => yeniSayfa({ tur: "kagit", kagit: belge.kagit || "lined" }))
    : [...ornekSayfalariAl(belge.id).map((_, i) => yeniSayfa({ tur: "pdf", pdf: i })), yeniSayfa({ tur: "kagit", kagit: "grid" })];
  const ilk = Math.min(Math.max(1, belge.sayfa || 1), sayfalar.length);
  const veri = { surum: 1, sayfalar, konum: { sayfa: belge.tur === "defter" ? ilk - 1 : 0, oran: 0 }, k: null, sigdir: true };
  // PDF'te prototip belgenin kaldığı yerden başlayan bir kesitini açar: etiketler belgenin kendi sayfa numarasıdır
  if (belge.tur === "pdf") {
    const toplam = Math.max(belge.sayfaSayisi || 0, sayfalar.length);
    veri.ilkNo = Math.min(Math.max(1, belge.sayfa || 1), toplam - sayfalar.length + 1);
    veri.disarida = toplam - sayfalar.length;
  }
  if (belge.id === "kalkulus") {
    kalkulusSusle(veri, ornekSayfalariAl(belge.id));
    if (!yaziHazir) { const s = veri.sayfalar[0]; yedekSus = { veri, ids: new Set([...s.cizgiler, ...s.notlar, ...s.bantlar].map((o) => o.id)) }; }
  }
  if (belge.id === "difdenk") difdenkSusle(veri);
  return veri;
}

// Örnek defter, 1. sayfa: lacivert kalemle el yazısıyla (Caveat) çözülmüş bir ADD, sonuç kırmızı tükenmezle kutulu.
// Satırlar 25 birimlik kareli kâğıda oturur (x 75 = üç kare). Metinler taban çizgisiyle yerleşir; kesir çizgisi,
// integral ve ⇒ işareti dolma kalem çizgisidir (el yazısı yazı tipinde bu glifler yok), üsler küçük ve yukarıda.
function difdenkSusle(veri) {
  const s = veri.sayfalar[0];
  if (!s) return;
  const LACIVERT = "#1F3A68", KIRMIZI = "#C2412D";
  // Caveat: yazı kutusunun üstünden taban çizgisine 0,925 em (satır yüksekliği 1,2)
  const yaz = (x, taban, metin, fs = 32) => s.metinler.push({ id: yeniId("m"), x, y: Math.round((taban - 0.925 * fs) * 10) / 10, metin, fs, renk: LACIVERT, el: true });
  const ciz = (p, w = 2.4) => s.cizgiler.push({ id: yeniId("c"), tur: "dolma", renk: LACIVERT, w, p });
  const kesirCizgisi = (x0, x1, y) => ciz([[x0, y + 0.5, 0.5], [(x0 + x1) / 2, y, 0.65], [x1, y - 0.6, 0.55]]);
  const integral = (cx, ust, alt) => {
    const H = alt - ust;
    ciz([[cx + 11, ust + 5, 0.35], [cx + 9, ust + 1, 0.45], [cx + 6, ust, 0.5], [cx + 3.5, ust + 4, 0.6], [cx + 2, ust + H * 0.25, 0.75],
      [cx, ust + H * 0.5, 0.8], [cx - 2, ust + H * 0.75, 0.75], [cx - 3.5, alt - 4, 0.6], [cx - 6, alt, 0.5], [cx - 9, alt - 1, 0.45], [cx - 11, alt - 5, 0.35]]);
  };
  const ise = (x0, x1, y) => {   // ⇒
    ciz([[x0, y - 4, 0.55], [x1 - 3, y - 4.6, 0.6]], 2.2);
    ciz([[x0, y + 4, 0.55], [x1 - 3, y + 3.4, 0.6]], 2.2);
    ciz([[x1 - 9, y - 9.5, 0.45], [x1 + 1, y, 0.7], [x1 - 9, y + 9.5, 0.45]], 2.2);
  };
  yaz(75, 100, "Örnek 2.1", 38);
  yaz(228, 100, "y′ = 2y,  y(0) = 3", 34);
  yaz(75, 175, "Değişkenlerine ayır:", 30);
  // dy/y = 2 dx
  yaz(110, 222, "dy"); kesirCizgisi(104, 140, 233); yaz(116.5, 252, "y");
  yaz(152, 239, "= 2 dx");
  // ∫ dy/y = ∫ 2 dx  ⇒  ln|y| = 2x + c
  integral(108, 288, 350);
  yaz(126, 306, "dy"); kesirCizgisi(120, 156, 318); yaz(132.5, 337, "y");
  yaz(166, 324, "= "); integral(198, 288, 350); yaz(212, 324, "2 dx");
  ise(274, 306, 318);
  // Mutlak değer çubukları dik çizgi: yazı tipinin eğik | işareti "ln/y/" gibi okunurdu
  yaz(322, 324, "ln"); ciz([[348.5, 300, 0.5], [348, 334, 0.6]], 2.2); yaz(353, 324, "y"); ciz([[370.5, 300, 0.5], [370, 334, 0.6]], 2.2);
  yaz(380, 324, "= 2x + c");
  // y = C · e^(2x)
  yaz(100, 400, "y = C · e"); yaz(190, 386, "2x", 22);
  // y(0) = 3  ⇒  C = 3
  yaz(100, 460, "y(0) = 3"); ise(208, 240, 454); yaz(256, 460, "C = 3");
  // Sonuç
  yaz(108, 540, "y = 3e", 44); yaz(201, 520, "2x", 28);
  // Sağlama, sonda onay işareti
  yaz(75, 625, "Sağlama:  y′ = 6e", 28); yaz(238, 613, "2x", 18); yaz(260, 625, "= 2y", 28);
  ciz([[312, 612, 0.4], [318, 618, 0.6], [322, 624, 0.7], [330, 610, 0.6], [340, 594, 0.4]], 2.6);
  // Başlığın altında dolma kalem çizgisi: hafif yükselen, ucu incelen
  const alt = [];
  for (let i = 0, n = 40; i <= n; i++) { const t = i / n; alt.push([72 + 368 * t, 116 - 3 * t + 0.6 * Math.sin(t * 9), 0.75 - 0.35 * t * t]); }
  s.cizgiler.push({ id: yeniId("c"), tur: "dolma", renk: LACIVERT, w: 3, p: alt });
  // Sonucun çevresinde elle çizilmiş kutu: köşelerde hafif taşma, sonda başlangıcın üstünden geçer
  const kose = [[88, 494], [250, 491], [252, 564], [86, 567], [90, 488]], kutu = [];
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = kose[k], [bx, by] = kose[k + 1], n = k % 2 ? 10 : 22;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      kutu.push([ax + (bx - ax) * t + 0.7 * Math.sin(i * 1.7 + k), ay + (by - ay) * t + 0.7 * Math.cos(i * 1.3 + k), 0.4 + 0.3 * Math.sin(Math.PI * t)]);
    }
  }
  kutu.push([106, 487, 0.3]);
  s.cizgiler.push({ id: yeniId("c"), tur: "tukenmez", renk: KIRMIZI, w: 3, p: kutu });
}

// PDF sayfasının metin satırları: sayfa bir kez sahte tuvale çizilir, fillText çağrıları konumlarıyla kaydedilir.
// Hem arama hem tanıtım süslemeleri gerçek metin konumunu bulur.
// Önbellek anahtarı sayfa nesnesidir: belgeye göre farklı örnek listeleri karışmaz
let metinOnbellegi = new WeakMap();

// Örnek sayfaların yazı tipleri (Literata, Inter) gelmeden çizilen sayfa yedek fontla ölçülür ve çizilir.
// Yazı tipleri gelince metin önbelleği boşalır, açık belgenin örnek sayfaları ve o açılışta kurulan
// Kalkülüs süsleri yeni ölçülere göre yeniden kurulur (kimlikler aynı kalır, kart bağları kopmaz).
let yaziHazir = false;
let yedekSus = null;   // { veri, ids }: yazı tipleri gelmeden kurulan süsler
Promise.resolve(SAYFALAR.yaziTipleri).catch(() => false).then(() => { yaziHazir = true; ornekleriTazele(); });
function ornekleriTazele() {
  metinOnbellegi = new WeakMap();
  if (!D || D.pdf) { yedekSus = null; return; }
  const sus = yedekSus;
  yedekSus = null;
  if (sus && sus.veri === D.veri && D.belge.id === "kalkulus") {
    const gecici = { sayfalar: [yeniSayfa({})] };
    kalkulusSusle(gecici, D.ornekler);
    const eski = sus.veri.sayfalar[0], yeni = gecici.sayfalar[0];
    for (const tur of ["cizgiler", "notlar", "bantlar"]) {
      const eskiler = eski[tur].filter((o) => sus.ids.has(o.id));
      eskiler.forEach((o, i) => { const y = yeni[tur][i]; if (y) Object.assign(o, y, { id: o.id }); });
    }
    const S0 = D.sayfalar.find((S) => S.veri === eski);
    if (S0) { nesneleriCiz(S0); S0.cizildi.murekkep = null; }
  }
  for (const S of D.sayfalar) if (S.veri.tur === "pdf") { S.cizildi.sayfa = null; S.kucukKirli = true; }
  gorunenleriCiz();
}
let olcumCtx = null;
function sayfaMetinleri(i, liste = ornekListe()) {
  const sayfa = liste[i];
  if (!sayfa) return [];
  if (metinOnbellegi.has(sayfa)) return metinOnbellegi.get(sayfa);
  const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas");
  const ctx = cv.getContext("2d");
  const kayit = [];
  ctx.fillText = function (t, x, y) {
    t = String(t);
    const w = this.measureText(t).width, hz = this.textAlign;
    const x0 = hz === "center" ? x - w / 2 : hz === "right" || hz === "end" ? x - w : x;
    const boyut = parseFloat((this.font.match(/([\d.]+)px/) || [0, 16])[1]);
    kayit.push({ t, x: x0, y, w, font: this.font, boyut });
  };
  try { sayfa.draw(ctx); } catch (e) { console.warn(e); }
  metinOnbellegi.set(sayfa, kayit);
  return kayit;
}
function altDizeOlc(r, bas, son) {
  olcumCtx ||= (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas")).getContext("2d");
  olcumCtx.font = r.font;
  return { x: r.x + olcumCtx.measureText(r.t.slice(0, bas)).width, w: olcumCtx.measureText(r.t.slice(bas, son)).width };
}

// Kalkülüs tanıtımı: teoremin üstünde fosforlu, "Örnek 1" çevresinde kırmızı halka,
// Alıştırmalar yanında kenar alanında yapışkan not, Çözüm'ün üstünde kapalı bant, 1. sayfada kenar açık.
function kalkulusSusle(veri, liste) {
  const s = veri.sayfalar[0], m = sayfaMetinleri(0, liste);
  const bul = (on) => m.find((r) => r.t.startsWith(on));
  const formul = bul("F′(x)"), ornek = bul("Örnek 1"), cozum = bul("Çözüm"), alis = bul("Alıştırmalar");
  const sonFormul = [...m].reverse().find((r) => r.t.startsWith("dy/dx = 5"));
  s.kenar = true;
  if (formul) {
    const y = formul.y - formul.boyut * 0.32, x0 = formul.x - 12, x1 = formul.x + formul.w + 12, p = [];
    for (let i = 0, n = 24; i <= n; i++) p.push([x0 + ((x1 - x0) * i) / n, y - 1.4 * (i / n) + 0.5 * Math.sin(i * 0.9), 0.5]);
    s.cizgiler.push({ id: yeniId("c"), tur: "fosforlu", renk: "#F4D63E", w: 24, p });
  }
  if (ornek) {
    // Halka kayıt kutusunun sağına en çok 4 birim taşar: hemen ardından gelen formüle değmez
    const cx = ornek.x + ornek.w / 2 - 3, cy = ornek.y - ornek.boyut * 0.36;
    const rx = (ornek.w / 2 + 7) / 1.03, ry = ornek.boyut * 1.1 + 6, e = -0.07, p = [];
    for (let i = 0, n = 72; i <= n; i++) {
      const a = -2.55 + (i / n) * (Math.PI * 2 + 0.62), s1 = 1 + 0.035 * Math.sin(i * 0.8) + 0.05 * (i / n);
      const x = rx * s1 * Math.cos(a), yy = ry * s1 * Math.sin(a);
      p.push([cx + x * Math.cos(e) - yy * Math.sin(e), cy + x * Math.sin(e) + yy * Math.cos(e), 0.32 + 0.48 * Math.sin((Math.PI * i) / n)]);
    }
    s.cizgiler.push({ id: yeniId("c"), tur: "tukenmez", renk: "#C2412D", w: 3, p });
  }
  if (alis) s.notlar.push({ id: yeniId("n"), x: 832, y: Math.round(alis.y - 34), metin: "Sınavda çıkar! İç fonksiyondan başla.", renk: "#F8E7A1", aci: -1.2, kucuk: false });
  if (cozum && sonFormul) {
    // Bant Çözüm bloğunun bütün kayıt satırlarını örter (kesir payları ve paydaları dahil): 8 birim pay,
    // eğimin uçlarda açtığı birkaç birim de eklenir. Etiket "Çözüm." solda açık kalır.
    const son = alis ? alis.y - alis.boyut : sonFormul.y + 40;
    const blok = m.filter((r) => r.y >= cozum.y - 2 && r.y < son && r.x > cozum.x + 20);
    const yazili = blok.filter((r) => r.w > 0);
    const x0 = Math.floor(Math.min(...yazili.map((r) => r.x)) - 8), x1 = Math.ceil(Math.max(...yazili.map((r) => r.x + r.w)) + 8);
    const y0 = Math.floor(Math.min(...blok.map((r) => r.y - r.boyut * 0.82)) - 10);
    const y1 = Math.ceil(Math.max(...blok.map((r) => r.y + r.boyut * 0.3)) + 12);
    s.bantlar.push({ id: yeniId("b"), x: x0, y: y0, w: x1 - x0, h: y1 - y0, desen: "murekkep", aci: BANT_ACI, acik: false });
  }
}

// Eski parlak fosfor tonları açılışta bir kez yeni tonlara çevrilir (kalem yolu her karede eşleme yapmasın)
function vurgulariTazele(veri) {
  for (const s of veri.sayfalar || []) for (const c of s.cizgiler || []) if (c.tur === "fosforlu" && c.renk) c.renk = vurguRengi(c.renk);
}

// Sayfa sırası (0'dan) ile ekranda yazan numara arasında çeviri
const etiketNo = (i, v = D.veri) => (v.ilkNo || 1) + i;
const toplamNo = (v = D.veri) => v.sayfalar.length + (v.disarida || 0);
const siraNo = (no) => no - (D.veri.ilkNo || 1);

// =====================================================================
// AÇ / KAPAT
// =====================================================================
// Sözleşme v2: ac(kap, belge, sayfa, mod). Eski biçim ac(kap, belge, { sayfa, mod }) de çalışır.
// { gomulu: true } yalnız yan yana bölmesindeki defter için: üst çubuk yok.
// 4. tur: beşinci değişken { ara, konum }; ara verilirse o sayfadaki eşleşmeler kısa süre parlar (konum EPUB'a özgü).
export function ac(kap, belge, sayfaArg = null, modArg = null, ek = null) {
  let sayfa = sayfaArg, mod = modArg, gomulu = false;
  if (sayfaArg && typeof sayfaArg === "object") { sayfa = sayfaArg.sayfa ?? null; mod = mod || sayfaArg.mod; gomulu = !!sayfaArg.gomulu; }
  if (mod !== "koltuk" && mod !== "masa") mod = varsayilanMod(belge);
  if (gomulu) mod = "masa";
  if (D) kapat();
  const no = ++acilisNo;
  // Gerçek dosyası olan PDF önce yüklenir; o sürede masada boş kâğıt ve "Açılıyor" durur
  if (belge.dosya && belge.tur === "pdf") { dosyaliAc(no, kap, belge, sayfa, mod, gomulu, ek); return; }
  kur(kap, belge, sayfa, mod, gomulu, null, ek);
}

// Açık belgede başka sayfaya ya da arama sonucuna gider (kabuk aynı belge için "git" gelince çağırır)
export function git({ sayfa = null, ara = null, iz = null } = {}) {
  if (!D) return;
  // İzler panelinden: iz kimliği verilirse o ize gidilir, çevresine kalem halkası çizilir
  if (iz && izeGit(D.veri.izler?.find((x) => x?.id === iz))) return;
  const i = sayfa == null ? -1 : sinirla(siraNo(sayfa), 0, D.sayfalar.length - 1);
  if (ara) { araGoster(ara, i >= 0 ? i : Math.max(0, D.gecerli)); return; }
  if (i >= 0) sayfayaGit(i);
}

let acilisNo = 0;   // kapat() ya da yeni ac() yarım kalan yüklemeyi geçersiz kılar
let yukleme = null; // { no, belge, mod }: yükleme sürerken gelen modDegistir burada bekler
async function dosyaliAc(no, kap, belge, sayfa, mod, gomulu, ek) {
  const t0 = performance.now();
  yukleme = { no, belge, mod };
  kap.replaceChildren(h("div", { class: "duzenleyici pdf-yukleniyor", "data-mod": mod },
    h("div", { class: "pdf-yukleniyor-kagit", "aria-hidden": "true" }),
    h("p", { class: "t-daktilo", role: "status" }, "Açılıyor")));
  let pdf = null;
  try {
    const [{ dosyaGetir }, { pdfAc }] = await Promise.all([import("./kayit.js"), import("./pdf-belge.js")]);
    const blob = await dosyaGetir(belge.id);
    if (no !== acilisNo) return;
    if (!blob) throw new Error("dosya yok");
    pdf = await pdfAc(blob);
    if (no !== acilisNo) { pdf.kapat(); return; }
    if (yukleme?.no === no) { mod = gomulu ? "masa" : yukleme.mod; yukleme = null; }
    kur(kap, belge, sayfa, mod, gomulu, pdf, ek);
    D.olcum = { acilis: performance.now() - t0 };
  } catch (e) {
    pdf?.kapat();
    if (no !== acilisNo) return;
    console.warn("[duzenleyici] PDF açılamadı:", e);
    kap.replaceChildren(h("div", { class: "duzenleyici pdf-yukleniyor hata" },
      h("p", {}, "Bu PDF açılamadı."),
      h("p", {}, e?.name === "PasswordException" ? "Dosya parolalı." : "Dosya bozuk ya da kayıtlı kopyası bulunamadı."),
      h("button", { class: "metin-dugme", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, "Kitaplığa dön")));
  }
}

function kur(kap, belge, sayfa, mod, gomulu, pdf, ek = null) {
  A = aracAyarlari();
  A.kirpBirakinca ||= "kaydet";
  A.damga ||= { secili: "∫", son: [] };
  const rx = (d) => (d === "Rx" ? "℞" : d);   // eski damga adı
  A.damga.secili = rx(A.damga.secili);
  A.damga.son = (A.damga.son || []).map(rx);
  if (A.sekilDuzelt === undefined) A.sekilDuzelt = true;
  A.fosforlu.renk = vurguRengi(A.fosforlu.renk);
  if (!belge.veri || !Array.isArray(belge.veri.sayfalar)) belge.veri = veriHazirla(belge, pdf);
  vurgulariTazele(belge.veri);
  D = {
    pdf, pdfBekleyen: new Set(), pdfSuren: new Set(), ornekler: pdf ? PDF_PAGES : ornekSayfalariAl(belge.id),
    mod, gomulu, koltuk: null, koltukKalem: false, yan: null, sonSor: null,
    kap, belge, veri: belge.veri, sayfalar: [], kapS: new WeakMap(), k: 1, gecmis: new Gecmis(200), gecerli: -1,
    jest: null, dokunmalar: new Map(), coklu: null, lastik: 0, secim: null, nesneSecim: null, sayfaMenu: null,
    balon: null, fis: null, arama: null, aramaAcik: false, okuma: false, sekme: "notlar",
    raf: {}, z: new Set(), temizlik: [], sonKalem: -1e9, yanTus: false, renk: sayfaRengi(), renkHam: hamRenk(),
    ucan: null, ipucuEl: null, ilkIpucu: null,
  };
  izKur();
  arayuzKur();
  D.k = kSinirla(D.veri.sigdir === false && D.veri.k ? D.veri.k : sigdirK());
  // Asistan yanda açıkken açılan elle yakınlaştırılmış belge de kalan genişliğe sığar (asistanYeri ile aynı kural)
  if (D.veri.sigdir === false && D.kok.classList.contains("asistan-acik")) {
    const fit = sigdirK();
    if (D.k > fit + 0.002) { D.asistanOnce = { k: D.k, gecici: fit }; D.k = fit; }
  }
  D.sutun.style.setProperty("--k", D.k);
  sayfalariKur();
  konumYukle();
  // Kırpılanlar panosundan "Sayfaya git": istenen sayfa numarası (ekranda yazan)
  const hedef = sayfa == null ? -1 : siraNo(sayfa);
  if (hedef >= 0 && hedef < D.sayfalar.length) sayfayaGit(hedef, { yumusak: false });
  gorunenleriCiz();
  sesBagla();
  if (D.veri.sesSerit && !gomulu) sesCubukDegistir();
  gozlemcileriKur();
  olaylariKur();
  aracCubuguGuncelle();
  baglamCiz();
  sayfaNoGuncelle(true);
  yuzdeYaz(false);
  geriAlDurumu();
  bantKartlariniEsle({ sessiz: true });
  izEslePlanla();   // kayıtlı izlerin imzası alınır (değiştirilmez)
  if (mod === "koltuk") koltukGir(false);
  else zaman(ilkIpucuKenar, 900);
  bekciPlanla();   // açılış geçişi (görünüm geçişi, opaklık) bitince görünen sayfalar bir kez denetlenir
  if (pdf) {
    const d = D;
    pdf.boyutlarHazir.then((tamam) => { if (tamam && D === d) pdfBoyutlariUygula(); });
  }
  if (ek?.ara) { const d = D; zaman(() => { if (D === d) araGoster(ek.ara, hedef >= 0 && hedef < D.sayfalar.length ? hedef : Math.max(0, D.gecerli)); }, 120); }
  else if (ek?.iz) { const d = D; zaman(() => { if (D === d) izeGit(D.veri.izler?.find((x) => x?.id === ek.iz)); }, 160); }
}

// app.js durumu saklamadan önce çağırır: ıslak mürekkep kalıcı katmana, konum ve sayfa belgeye yazılır
export function kaydet() {
  if (!D) return;
  islakAktar();
  try { izKuyruguBosalt(); } catch { /* boş */ }
  try { konumKaydet(); } catch { /* yerleşim yoksa geç */ }
  try { D.yan?.modul?.kaydet?.(); } catch { /* bölme yarım kurulduysa geç */ }
  D.belge.sayfaSayisi = toplamNo();
  D.belge.sayfa = etiketNo(Math.max(0, D.gecerli));
}

export function kapat() {
  acilisNo++;   // yüklenmekte olan PDF varsa yarıda bırakılır
  if (!D) return;
  const d = D;
  islakAktar();
  try { izKuyruguBosalt(); } catch (e) { console.warn("[duzenleyici] iz:", e); }
  try { konumKaydet(); } catch { /* yerleşim yoksa geç */ }
  try { odagiBirak(); } catch { /* boş */ }
  try { yanYanaKapat(); } catch { /* boş */ }
  try { d.koltuk?.kapat?.(); } catch { /* boş */ }
  try { sesKapat(d); } catch (e) { console.warn("[duzenleyici] ses:", e); }
  try { d.izlerPanel?.kapat(); } catch { /* boş */ }
  kartTazelemeBitir();
  for (const f of d.temizlik) { try { f(); } catch { /* boş */ } }
  for (const id of d.z) clearTimeout(id);
  for (const id of Object.values(d.raf)) cancelAnimationFrame(id);
  d.io?.disconnect();
  d.ro?.disconnect();
  d.ucan?.remove();
  document.body.classList.remove("yaziyor");
  for (const S of d.sayfalar) tuvalleriBosalt(S);
  d.kucukIo?.disconnect();
  d.kap.replaceChildren();
  D = null;
  d.pdf?.kapat();
  gorselleriBirak(d);
  // Sayfa sayısı ve kalınan sayfa kitaplığa yansır ("Kaldığın yerden" ve kapak bilgisi)
  d.belge.sayfaSayisi = toplamNo(d.veri);
  d.belge.sayfa = etiketNo(Math.max(0, d.gecerli), d.veri);
  bus.emit("belgeler", { tur: "sayfa", id: d.belge.id });
}

// =====================================================================
// ARAYÜZ İSKELETİ
// =====================================================================
function arayuzKur() {
  const kok = (D.kok = h("div", { class: "duzenleyici" + (D.gomulu ? " gomulu" : "") + (hamRenk() === "tahta" ? " sayfa-tahta" : "")
    + (document.querySelector(".asistan.acik") ? " asistan-acik" : ""), "data-arac-konum": A.konum, "data-mod": D.mod }));
  D.zemin = kagitZemin();
  kok.style.setProperty("--kagit-zemin", D.zemin);
  // Üst çubuk (3.10)
  D.sayfaDugme = h("button", { "aria-label": "Sayfaya git", "aria-haspopup": "dialog", onclick: (e) => sayfayaGitFisi(e.currentTarget, "ust") }, "s. 1 / 1");
  D.baslik = h("div", { class: "belge-baslik" }, h("b", { title: D.belge.ad }, D.belge.ad), D.sayfaDugme);
  const ud = (ad, ikon, fn, ek = {}) => h("button", { class: "ikon-dugme", "aria-label": ad, title: ad, onclick: fn, ...ek }, icon(ikon));
  D.ust = {
    ara: ud("Ara", "ara", () => aramaAc()),
    yerImi: ud("Yer imi", "yer-imi", () => yerImiDegistir(), { class: "ikon-dugme yer-imi", "aria-pressed": "false" }),
    sayfalar: ud("Sayfalar", "sayfalar", () => panelDegistir("sol"), { "aria-pressed": "false" }),
    notlar: ud("Notlar", "notlar", () => panelDegistir("sag"), { "aria-pressed": "false" }),
    ses: h("button", { class: "ikon-dugme ses-kayit-dugme", "aria-label": "Ses kaydı", title: "Ses kaydı", "aria-pressed": "false", onclick: () => sesCubukDegistir() },
      ikonSec(["ses-kaydi", "ses", "mikrofon", "kayit"], "●")),
    // Yan yana ve Dışa aktar "Diğer" menüsünde; 900px altında Notlar ve Ses de oraya iner (CSS ve dahaMenusu)
    daha: ud("Diğer", "daha", (e) => dahaMenusu(e.currentTarget), { "aria-haspopup": "menu" }),
  };
  D.ust.notlar.classList.add("dar-gizli");
  D.ust.ses.classList.add("dar-gizli");
  // Eski "Okuma modu" düğmesinin yerini Koltuk | Masa anahtarı aldı; okumaModu() Koltuk'un altyapısı olarak kalır
  D.modAnahtari = modAnahtariKur();
  D.ustCubuk = h("header", { class: "ust-cubuk" },
    h("button", { class: "geri", "aria-label": "Kitaplığa dön", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, icon("geri", "i-22"), h("span", {}, "Kitaplık")),
    D.baslik,
    h("div", { class: "ust-araclar" }, ...Object.values(D.ust), D.modAnahtari));

  // Masa (3.11), araç çubuğu (3.12), bilgi çipi (3.23)
  D.sutun = h("div", { class: "sutun" });
  D.masa = h("div", { class: "masa" }, D.sutun);
  D.cipNo = h("button", { class: "no", "aria-label": "Sayfaya git", onclick: (e) => sayfayaGitFisi(e.currentTarget, "cip") }, "s. 1 / 1");
  D.cipYuzde = h("button", { class: "yuzde", "aria-label": "Genişliğe sığdır", onclick: () => sigdir() }, "%100");
  D.cip = h("div", { class: "bilgi-cip" }, D.cipNo, h("span", { class: "ayrac" }), D.cipYuzde);
  D.masaKap = h("div", { class: "masa-kap" }, D.masa, aracCubuguKur(), D.cip);

  // Paneller (3.22)
  D.panelSol = h("aside", { class: "panel panel-sol", "aria-label": "Sayfalar", hidden: true });
  D.panelSag = h("aside", { class: "panel panel-sag", "aria-label": "Notlar ve kırpılanlar", hidden: true });
  D.perde = h("div", { class: "panel-perde", hidden: true, onclick: () => { panelDegistir("sol", false); panelDegistir("sag", false); } });
  D.calisma = h("div", { class: "calisma" }, D.panelSol, D.masaKap, D.panelSag, D.perde);
  // Görsel girdileri (galeri ve kamera); fişteki satırlar bunları tıklar
  D.gorselGirdi = h("input", { type: "file", accept: "image/*", multiple: true, class: "gorsel-girdi", hidden: true, "aria-hidden": "true", tabindex: "-1" });
  D.kameraGirdi = h("input", { type: "file", accept: "image/*", capture: "environment", class: "gorsel-girdi kamera-girdi", hidden: true, "aria-hidden": "true", tabindex: "-1" });
  for (const g of [D.gorselGirdi, D.kameraGirdi]) g.addEventListener("change", () => { const f = [...(g.files || [])]; g.value = ""; gorselleriEkle(f); });
  kok.append(D.calisma, D.ustCubuk, D.gorselGirdi, D.kameraGirdi);
  D.kap.replaceChildren(kok);
}

// ---------- araç çubuğu ----------
function aracCubuguKur() {
  D.aracDugme = {};
  D.geriAlDugme = h("button", { class: "arac", "aria-label": "Geri al", disabled: true, onclick: () => geriAl() }, icon("geri-al"));
  D.yineleDugme = h("button", { class: "arac", "aria-label": "Yinele", disabled: true, onclick: () => yinele() }, icon("yinele"));
  ipucuBagla(D.geriAlDugme, () => "Geri al", "Ctrl+Z");
  ipucuBagla(D.yineleDugme, () => "Yinele", "Ctrl+Y");

  const kutu = h("div", { class: "kalem-kutusu" });
  for (const id of ["kalem0", "kalem1", "kalem2", "fosforlu"]) {
    const b = h("button", { class: "kalem", "aria-pressed": "false", "data-arac": id });
    b.addEventListener("click", () => aracDokun(id, b));
    ipucuBagla(b, () => aracEtiketi(id), id === "fosforlu" ? "H" : "P");
    D.aracDugme[id] = b;
    kutu.append(b);
  }
  const glifler = h("div", { class: "grup" });
  for (const [id, ad, ikon, kisa] of GLIF_ARACLAR) {
    const b = h("button", { class: "arac", "aria-pressed": "false", "aria-label": ad, "data-arac": id }, id === "damga" ? ikonSec(["damga"], "∑") : icon(ikon));
    b.addEventListener("click", () => aracDokun(id, b));
    ipucuBagla(b, () => ad, kisa);
    D.aracDugme[id] = b;
    glifler.append(b);
  }
  // Görsel: araç değil, galeri ya da kamera fişini açar
  D.gorselDugme = h("button", { class: "arac", "aria-label": "Görsel ekle", "aria-haspopup": "menu", onclick: (e) => gorselFisi(e.currentTarget) },
    ikonSec(["gorsel", "resim", "kamera"], "▣"));
  ipucuBagla(D.gorselDugme, () => "Görsel ekle", "");
  glifler.append(D.gorselDugme);
  D.baglam = h("div", { class: "baglam" });
  D.murekkepDugme = h("button", { class: "damla murekkep-dugme", "aria-label": "Renk ve kalınlık", onclick: () => balonDegistir(A.etkin, D.murekkepDugme) }, h("i"));
  D.aracCubugu = h("div", { class: "arac-cubugu", role: "toolbar", "aria-label": "Araçlar", oncontextmenu: (e) => e.preventDefault(),
    onscroll: () => cubukTasmaGuncelle() },
    h("div", { class: "grup" }, D.geriAlDugme, D.yineleDugme), h("span", { class: "ayrac" }),
    kutu, h("span", { class: "ayrac" }), glifler, D.baglam);
  return D.aracCubugu;
}

// Çubuk masaya sığmayıp kaydığında yalnız arkasında düğme kalan kenar solar
function cubukTasmaGuncelle() {
  const c = D?.aracCubugu;
  if (!c) return;
  const yan = A.konum === "sol" || A.konum === "sag";
  const bas = yan ? c.scrollTop : c.scrollLeft;
  const fazla = yan ? c.scrollHeight - c.clientHeight : c.scrollWidth - c.clientWidth;
  c.classList.toggle("tasiyor-bas", fazla > 1 && bas > 2);
  c.classList.toggle("tasiyor-son", fazla > 1 && bas < fazla - 2);
}

function aracEtiketi(id) {
  if (id.startsWith("kalem")) {
    const k = A.kalemler[+id.slice(5)];
    return `${KALEM_ADLARI[k.tur]}, ${mmYaz(k.mm)}, ${renkAdi(k.renk)}`;
  }
  if (id === "fosforlu") return `Fosforlu, ${renkAdi(A.fosforlu.renk)}`;
  return (GLIF_ARACLAR.find((g) => g[0] === id) || [, id])[1];
}

function aracCubuguGuncelle() {
  for (let i = 0; i < 3; i++) {
    const b = D.aracDugme["kalem" + i], k = A.kalemler[i];
    if (b.dataset.tur !== k.tur) { b.replaceChildren(svgDen(KALEM_SVG[k.tur])); b.dataset.tur = k.tur; }
    b.style.setProperty("--tip", k.renk);
    b.style.setProperty("--kalinlik-px", kalinlikPx(k.mm));
    b.setAttribute("aria-label", aracEtiketi("kalem" + i));
  }
  const f = D.aracDugme.fosforlu;
  if (!f.firstChild) f.append(svgDen(KALEM_SVG.fosforlu));
  f.style.setProperty("--tip", A.fosforlu.renk);
  f.style.setProperty("--kalinlik-px", sinirla(Math.round((A.fosforlu.w / 22) * 5), 3, 8) + "px");
  f.setAttribute("aria-label", aracEtiketi("fosforlu"));
  for (const [id, b] of Object.entries(D.aracDugme)) b.setAttribute("aria-pressed", String(A.etkin === id));
  yanTusGoster();
  murekkepDugmeGuncelle();
}

function murekkepDugmeGuncelle() {
  const a = A.etkin, m = D.murekkepDugme;
  let renk = null, d = 7;
  if (a.startsWith("kalem")) { const k = A.kalemler[+a.slice(5)]; renk = k.renk; d = HIZLI_MM.reduce((s, [mm, px]) => (k.mm >= mm - 0.05 ? px : s), 4); }
  else if (a === "fosforlu") { renk = A.fosforlu.renk; d = A.fosforlu.w >= 30 ? 14 : A.fosforlu.w >= 20 ? 10 : 6; }
  else if (a === "metin") { renk = A.metin.renk; d = 7; }
  else if (a === "not") { renk = A.not.renk; d = 0; }
  else if (a === "silgi") { renk = "#E6DCCA"; d = A.silgi.r >= 28 ? 14 : A.silgi.r >= 14 ? 10 : 6; }
  else if (a === "bant") { renk = BANT_RENGI[A.bant.desen] || BANT_RENGI.murekkep; d = 0; }
  else if (a === "sekil" || a === "kirp" || a === "damga") { const k = A.kalemler[A.sonKalem]; renk = k.renk; d = 4; }
  m.classList.toggle("bos-arac", !renk || a === "kement");
  if (renk) { m.style.setProperty("--renk", renk); m.style.setProperty("--d", d + "px"); }
}

// Etkin araca tekrar dokununca ayar balonu; başka araca dokununca seçim
function aracDokun(id, b) {
  if (b.dataset.uzun) { delete b.dataset.uzun; return; }
  if (A.etkin === id) { balonDegistir(id, b); return; }
  aracSec(id, true);
}

function aracSec(id, kullanici = false) {
  if (A.etkin === id && !kullanici) return;
  A.etkin = id;
  if (id.startsWith("kalem")) A.sonKalem = +id.slice(5);
  balonKapat();
  if (id !== "kement") secimKaldir();
  silgiImleciGizle();
  aracCubuguGuncelle();
  baglamCiz();
  if (kullanici && !ipucuGosterildi("arac")) ilkIpucuArac(D.aracDugme[id]);
  // Koltukta araç kısayolu (P, H, E...) Masa'ya geçirir; okuma modunu tek başına kapatmak yarım bir durum bırakırdı
  if (D.mod === "koltuk") modSec("masa");
  else if (D.okuma) okumaModu(false);
}

// Bağlam bölgesi (3.12): etkin araca göre renkler ve kalınlıklar, genişliği hep 365px
function baglamCiz() {
  const a = A.etkin, ic = [];
  const damla = (renk, secili, ad, fn, sinif = "") =>
    h("button", { class: ("damla " + sinif).trim(), style: `--renk:${renk}`, "aria-pressed": String(secili), "aria-label": ad, onclick: fn }, h("i"));
  // cizgi: kalınlık daire yerine kısa bir çizgi örneğiyle (kalemde 2, 4, 7 px; fosforluda keski uçlu şerit)
  const kalin = (d, renk, secili, ad, fn, cizgi = "") =>
    h("button", { class: ("kalinlik " + cizgi).trim(), style: `--d:${d}px;--renk-simdi:${renk}`, "aria-pressed": String(secili), "aria-label": ad, onclick: fn }, h("i"));
  if (a.startsWith("kalem")) {
    const k = A.kalemler[+a.slice(5)];
    for (const c of k.son) ic.push(damla(c, c === k.renk, renkAdi(c), () => { k.renk = c; ayarDegisti(); }));
    HIZLI_MM.forEach(([mm], i) => ic.push(kalin(CIZGI_PX[i], k.renk, Math.abs(k.mm - mm) < 0.05, mmYaz(mm), () => { k.mm = mm; ayarDegisti(); }, "cizgi-ornek")));
  } else if (a === "fosforlu") {
    for (const [ad, c] of FOSFORLAR) ic.push(damla(c, c === A.fosforlu.renk, ad, () => { A.fosforlu.renk = c; ayarDegisti(); }, "keski"));
    HIZLI_FOSFOR.forEach(([w], i) => ic.push(kalin(FOSFOR_PX[i], A.fosforlu.renk, A.fosforlu.w === w, `Kalınlık ${w}`, () => { A.fosforlu.w = w; ayarDegisti(); }, "cizgi-ornek keski-ornek")));
  } else if (a === "silgi") {
    for (const [r, d] of HIZLI_SILGI) ic.push(kalin(d, "var(--ink-2)", A.silgi.r === r, `Silgi boyutu ${r}`, () => { A.silgi.r = r; ayarDegisti(); }));
    ic.push(h("span", { class: "baglam-ipucu" }, A.silgi.sadeceFosforlu ? "Yalnız fosforluyu siler" : "Dokunduğu çizgiyi siler"));
  } else if (a === "metin") {
    for (const c of A.metin.son) ic.push(damla(c, c === A.metin.renk, renkAdi(c), () => { A.metin.renk = c; ayarDegisti(); }));
    for (const [fs, d] of HIZLI_METIN) {
      ic.push(h("button", { class: "kalinlik", style: `--d:${d}px;--renk-simdi:${A.metin.renk}`, "aria-pressed": String(A.metin.fs === fs), "aria-label": `Yazı boyutu ${fs}`, onclick: () => { A.metin.fs = fs; ayarDegisti(); } }, h("i", { class: "aa-harf" }, "Aa")));
    }
  } else if (a === "not") {
    for (const [ad, c] of NOT_RENKLERI) ic.push(damla(c, c === A.not.renk, ad, () => { A.not.renk = c; ayarDegisti(); }, "not-damla"));
  } else if (a === "bant") {
    for (const [ad, d] of BANTLAR) {
      ic.push(h("button", { class: "damla bant-damla", "aria-pressed": String(A.bant.desen === d), "aria-label": ad, onclick: () => { A.bant.desen = d; ayarDegisti(); } },
        h("span", { class: `bant-parca bant--${d}` }, h("span", { class: "bant__dolgu" }))));
    }
  } else if (a === "sekil") {
    for (const [s, ad] of SEKILLER) {
      ic.push(h("button", { class: "kalinlik sekil-dugme", "aria-pressed": String(A.sekil === s), "aria-label": ad, onclick: () => { A.sekil = s; ayarDegisti(); } }, icon(s, "i-22")));
    }
  } else if (a === "damga") {
    // Son kullanılan 8 damga (yoksa matematiğin ilk sekizi); "Tümü" paleti açar
    const son = damgaSonlar();
    for (const d of son) ic.push(h("button", { class: "kalinlik damga-hizli", "aria-pressed": String(A.damga.secili === d), "aria-label": `Damga ${d}`,
      onclick: () => { A.damga.secili = d; ayarDegisti(); } }, h("span", { class: "damga-glif" }, d)));
    ic.push(h("button", { class: "metin-dugme damga-tumu", onclick: (e) => balonDegistir("damga", e.currentTarget) }, "Tümü"));
  } else if (a === "kement") ic.push(h("span", { class: "baglam-ipucu" }, "Seçmek için çevresini çiz"));
  else if (a === "kirp") {
    // Bırakınca ne olacağı kalem kalkmadan belli olsun: Kaydet | Sor
    const sec = (id, ad, ikon) => h("button", { type: "button", "aria-pressed": String(A.kirpBirakinca === id), onclick: () => { A.kirpBirakinca = id; ayarDegisti(); } },
      ikon ? icon(ikon) : null, ad);
    ic.push(h("span", { class: "baglam-ipucu t-daktilo birakinca-etiket" }, "Bırakınca"),
      h("div", { class: "parcali baglam-parcali", role: "group", "aria-label": "Bırakınca" }, sec("kaydet", "Kaydet"), sec("sor", "Sor", "sor")));
  }
  D.baglam.replaceChildren(h("span", { class: "ayrac" }), ...ic, D.murekkepDugme);
  murekkepDugmeGuncelle();
}

// Ayar değişince çubuk, bağlam ve açık balon tazelenir
function ayarDegisti() {
  aracCubuguGuncelle();
  baglamCiz();
  D.balon?.guncelle?.();
  if (A.etkin === "silgi") silgiImleciGizle();
}

// ---------- masaüstü ipucu ve uzun basma ----------
function ipucuBagla(b, metin, kisayol) {
  let z = 0;
  const iptal = () => { zamanIptal(z); z = 0; };
  b.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || !matchMedia("(hover: hover)").matches) return;
    iptal(); z = zaman(() => ipucuGoster(b, metin(), kisayol), 500);
  });
  b.addEventListener("pointerleave", () => { iptal(); ipucuGizle(); });
  b.addEventListener("pointerdown", (e) => {
    iptal(); ipucuGizle();
    if (e.pointerType === "mouse") return;
    z = zaman(() => { b.dataset.uzun = "1"; ipucuGoster(b, metin(), null); zaman(ipucuGizle, 1600); }, 520);
  });
  b.addEventListener("pointerup", iptal);
  b.addEventListener("pointercancel", iptal);
}
function ipucuGoster(b, metin, kisayol) {
  ipucuGizle();
  if (!D || !b.isConnected) return;
  const el = h("div", { class: "ipucu", role: "tooltip" }, metin, kisayol ? h("kbd", {}, kisayol) : null);
  D.masaKap.append(el);
  const mk = D.masaKap.getBoundingClientRect(), r = b.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
  let x, y;
  if (A.konum === "sol") { x = r.right - mk.left + 10; y = r.top - mk.top + (r.height - hh) / 2; }
  else if (A.konum === "sag") { x = r.left - mk.left - w - 10; y = r.top - mk.top + (r.height - hh) / 2; }
  else {
    x = r.left - mk.left + r.width / 2 - w / 2;
    y = A.konum === "alt" ? r.top - mk.top - hh - 10 : r.bottom - mk.top + 10;
  }
  el.style.left = sinirla(x, 8, mk.width - w - 8) + "px";
  el.style.top = y + "px";
  D.ipucuEl = el;
}
function ipucuGizle() { D?.ipucuEl?.remove(); if (D) D.ipucuEl = null; }

// =====================================================================
// SAYFALAR: DOM, tuvaller, nesneler
// =====================================================================
// Sayfa yüksekliği (sayfa birimi): gerçek PDF'te 800 × pdfH / pdfW, defter ve örneklerde 800 × 1131
function sayfaYuksekligi(veri) {
  if (!D.pdf || veri.tur !== "pdf") return PH;
  const b = D.pdf.boyut(veri.pdf);
  return b && b.w > 0 ? Math.round((PW * b.h * 100) / b.w) / 100 : PH;
}
function sayfaKur(veri) {
  veri.gorseller ||= [];
  const S = { veri, cizildi: {}, canli: null, canliAnahtar: null, dpr: 1, gorunur: false, h: sayfaYuksekligi(veri) };
  S.kenarKap = h("div", { class: "kenar-kap" }, h("div", { class: "kenar" }));
  S.tutamak = h("button", { class: "kenar-tutamak", onclick: () => { ilkIpucuKapat("kenar"); kenarDegistir(S, !S.veri.kenar); } }, icon("pilcrow"));
  S.sayfaCv = h("canvas", { width: 0, height: 0 });
  S.sayfaEl = h("div", { class: "sayfa" }, S.sayfaCv);
  S.gorselKatman = h("div", { class: "gorsel-katman" });   // sayfa ile mürekkep arası: kalem görselin üstüne yazar
  S.murekkepCv = h("canvas", { class: "katman-murekkep", width: 0, height: 0 });
  S.canliCv = h("canvas", { class: "katman-canli", width: 0, height: 0 });
  S.kurdele = h("i", { class: "yer-imi-kurdele", hidden: !veri.yerImi });
  S.nesneler = h("div", { class: "nesneler" });
  S.kap = h("div", { class: "sayfa-kap uzakta" + (veri.kenar ? " kenarli" : ""), "data-sayfa": sayfaRengi(), "data-kagit": veri.tur === "pdf" ? null : "" },
    S.kenarKap, S.tutamak, S.sayfaEl, S.gorselKatman, S.murekkepCv, S.canliCv, S.kurdele, S.nesneler);
  if (S.h !== PH) S.kap.style.setProperty("--ph", S.h);
  D.kapS.set(S.kap, S);
  tuvalDinle(S);
  tutamakGuncelle(S);
  nesneleriCiz(S);
  return S;
}

function araEkleKur() {
  const el = h("div", { class: "ara-ekle" });
  el.append(h("button", { "aria-label": "Araya sayfa ekle", onclick: (e) => {
    const onceki = el.previousElementSibling, i = D.sayfalar.findIndex((S) => S.kap === onceki);
    yelpazeAc(e.currentTarget, i + 1);
  } }, h("span", {}, icon("arti"))));
  return el;
}

// D.sayfalar'ı veri.sayfalar ile eşler; var olan sayfaların DOM'u ve tuvalleri korunur
function sayfalariKur({ yeniId: dogan = null } = {}) {
  const eski = new Map(D.sayfalar.map((S) => [S.veri.id, S]));
  const ilkKonum = new Map(D.sayfalar.map((S) => [S.veri.id, S.kap.offsetTop]));
  const st = D.masa.scrollTop, sl = D.masa.scrollLeft;
  D.sayfalar = D.veri.sayfalar.map((v) => {
    const S = eski.get(v.id) || sayfaKur(v);
    eski.delete(v.id);
    // Şablonu değişen ya da geri alınan sayfa aynı kimlikle yeni nesne olur: zemini ve nesneleri tazelenir
    if (S.veri !== v) {
      v.gorseller ||= [];
      const kagitDegisti = S.veri.kagit !== v.kagit || S.veri.tur !== v.tur;
      S.veri = v;
      if (kagitDegisti) { S.cizildi = {}; S.kucukKirli = true; }
      nesneleriCiz(S);
      tutamakGuncelle(S);
    }
    return S;
  });
  for (const S of eski.values()) { D.io?.unobserve(S.kap); tuvalleriBosalt(S); }
  const parcalar = [];
  D.sayfalar.forEach((S) => parcalar.push(S.kap, araEkleKur()));
  D.sutun.replaceChildren(...parcalar);
  D.masa.scrollTop = st; D.masa.scrollLeft = sl;
  for (const S of D.sayfalar) {
    if (D.io && !ilkKonum.has(S.veri.id)) D.io.observe(S.kap);
    tutamakGuncelle(S);
  }
  // Yeni sayfa doğar, alttakiler FLIP ile aşağı kayar (3.16)
  if (dogan && !hareketAz()) {
    const S = D.sayfalar.find((x) => x.veri.id === dogan);
    if (S) animasyonBitince(S.kap, "dogdu", 280);
    for (const x of D.sayfalar) {
      const once = ilkKonum.get(x.veri.id);
      if (once == null || !x.gorunur) continue;
      const fark = once - x.kap.offsetTop;
      if (fark) x.kap.animate([{ transform: `translateY(${fark}px)` }, { transform: "none" }], { duration: 280, easing: EGRI_KAGIT });
    }
  }
  sayfaNoGuncelle(true);
}

// Tuval bütçesi (TASARIM 7.9): iki kenar da 4096 cihaz pikselini, alan 16 milyon pikseli geçmez.
// %300 yakınlaştırmada tablet belleği (dpr 2,25) taşmasın diye dpr gerekirse düşürülür.
const EN_KENAR = 4096, EN_ALAN = 16e6;
function dprHesapla(S) {
  const w = (S.veri.kenar || S.kap.classList.contains("kenarli") ? TW : PW) * D.k, hh = Math.max(S.h, PH) * D.k;
  return Math.min(window.devicePixelRatio || 1, EN_KENAR / Math.max(1, w), EN_KENAR / Math.max(1, hh), Math.sqrt(EN_ALAN / Math.max(1, w * hh)));
}
function tuvalBoyutla(cv, cssW, cssH, dpr) {
  const w = Math.max(1, Math.round(cssW * dpr)), hh = Math.max(1, Math.round(cssH * dpr));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== hh) cv.height = hh;
}

// Sayfa içeriğini çizer ve sayfa rengini bir kez pişirir (3.14)
function sayfaIcerikCiz(ctx, veri, renk) {
  ctx.save();
  ctx.fillStyle = veri.tur === "pdf" ? "#fff" : kagitZemin(renk);
  ctx.fillRect(0, 0, PW, PH);
  try {
    if (veri.tur === "pdf") ornekListe()[veri.pdf]?.draw(ctx);
    else drawTemplate(ctx, veri.kagit);
  } catch (e) { console.warn(e); }
  if (renk === "sepya") { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#F5EDDA"; ctx.fillRect(0, 0, PW, PH); }
  ctx.restore();
  if (renk === "koyu") {
    const c = ctx.canvas, kopya = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(c.width, c.height) : Object.assign(document.createElement("canvas"), { width: c.width, height: c.height });
    kopya.getContext("2d").drawImage(c, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "invert(.92) hue-rotate(180deg)";
    ctx.drawImage(kopya, 0, 0);
    ctx.restore();
    tahtaPisir(ctx);
  }
}

function sayfaTuvaliCiz(S) {
  const renk = sayfaRengi(), dpr = (S.dpr = dprHesapla(S));
  const anahtar = `${D.k}|${dpr}|${renk}` + (S.veri.tur === "pdf" ? "" : "|" + kagitZemin(renk));
  if (S.cizildi.sayfa === anahtar && S.sayfaCv.width) return;
  // Gerçek PDF sırayla ve ayrı tamponda çizilir; yakınlaştırınca eski görüntü yenisi gelene kadar kalır
  if (pdfSayfaMi(S)) { pdfPlanla(S, S.sayfaCv.width ? 140 : 0, anahtar); return; }
  tuvalBoyutla(S.sayfaCv, PW * D.k, PH * D.k, dpr);
  const ctx = S.sayfaCv.getContext("2d");
  ctx.setTransform(D.k * dpr, 0, 0, D.k * dpr, 0, 0);
  sayfaIcerikCiz(ctx, S.veri, renk);
  S.cizildi.sayfa = anahtar;
}

// bolge: yalnız bu kutu (sayfa birimi) yeniden çizilir; tuval aynı düzende hazırsa geçerli
function murekkepCiz(S, zorla = false, bolge = null) {
  const renk = sayfaRengi(), dpr = (S.dpr = dprHesapla(S)), genis = S.kap.classList.contains("kenarli");
  const soluk = sesSolukCizgiler(S);
  const anahtar = `${D.k}|${dpr}|${renk}|${genis}` + (soluk ? `|s${D.sesSoluk.kayitId}:${soluk.size}` : "");
  if (!zorla && S.cizildi.murekkep === anahtar && S.murekkepCv.width) return;
  if (bolge && !soluk && S.cizildi.murekkep === anahtar && S.murekkepCv.width && S.veri.cizgiler.length) {
    bolgeyiCiz(S.murekkepCv.getContext("2d"), S.veri.cizgiler, D.k * dpr, bolge, { koyuSayfa: renk === "koyu" });
    return;
  }
  // Mürekkepsiz sayfa tuval tutmaz (%300'de sayfa başına 64 MB); ilk çizgi kaliciyaAktar'dan buraya gelir
  if (!S.veri.cizgiler.length) {
    if (S.murekkepCv.width) S.murekkepCv.width = S.murekkepCv.height = 0;
    S.cizildi.murekkep = anahtar;
    return;
  }
  tuvalBoyutla(S.murekkepCv, (genis ? TW : PW) * D.k, S.h * D.k, dpr);
  const ctx = S.murekkepCv.getContext("2d");
  if (!soluk) hepsiniCiz(ctx, S.veri.cizgiler, D.k * dpr, { koyuSayfa: renk === "koyu" });
  else {
    // Ses oynarken o andan sonra çizilenler soluk (sözleşme: opacity 0,25): ayrı tuvalde çizilip saydam basılır
    hepsiniCiz(ctx, S.veri.cizgiler.filter((c) => !soluk.has(c)), D.k * dpr, { koyuSayfa: renk === "koyu" });
    const t = (geciciTuval ||= document.createElement("canvas"));
    t.width = S.murekkepCv.width; t.height = S.murekkepCv.height;
    hepsiniCiz(t.getContext("2d"), [...soluk], D.k * dpr, { koyuSayfa: renk === "koyu" });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.25; ctx.drawImage(t, 0, 0); ctx.restore();
    t.width = t.height = 0;
  }
  S.cizildi.murekkep = anahtar;
}
// Silme ve taşıma sırasında karede bir kez
// bolge verilirse karede yalnız o bölgeler (birleşimi) çizilir; bölgesiz bir istek tam çizim ister
function murekkepPlanla(S, bolge = null) {
  if (!bolge) S.murekkepTam = true;
  else S.murekkepBolge = kutuBirlestir(S.murekkepBolge, bolge);
  if (S.murekkepPlan) return;
  S.murekkepPlan = requestAnimationFrame(() => {
    const b = S.murekkepTam ? null : S.murekkepBolge;
    S.murekkepPlan = 0; S.murekkepTam = false; S.murekkepBolge = null;
    if (D) murekkepCiz(S, true, b);
  });
}
const kutuBirlestir = (a, b) => (!a ? b : !b ? a
  : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

function canliHazirla(S) {
  const genis = S.kap.classList.contains("kenarli"), dpr = dprHesapla(S), koyu = koyuMu();
  const anahtar = `${D.k}|${dpr}|${genis}|${koyu}`;
  // Aynı anda yalnız bir canlı tuval bellekte durur: başka sayfaya geçince eskisi boşaltılır
  if (D.canliS && D.canliS !== S) {
    islakAktar();
    const E = D.canliS;
    E.canliCv.width = 0; E.canliCv.height = 0; E.canliAnahtar = null;
  }
  D.canliS = S;
  S.canliCv.classList.remove("carp");   // kement ve kırpmanın beyaz kenarı karışmasın; fosforlu yeniden ekler
  if (!S.canli) S.canli = new CanliKatman(S.canliCv);
  if (S.canliAnahtar !== anahtar || !S.canliCv.width) {
    S.canli.boyutla((genis ? TW : PW) * D.k, S.h * D.k, D.k * dpr, { dpr, koyuSayfa: koyu });
    S.canliAnahtar = anahtar;
  }
  return S.canli;
}

function sayfayiHazirla(S) {
  sayfaTuvaliCiz(S);
  murekkepCiz(S);
}
function tuvalleriBosalt(S) {
  if (D?.jest?.S === S) return;
  for (const cv of [S.sayfaCv, S.murekkepCv, S.canliCv]) { cv.width = 0; cv.height = 0; }
  S.cizildi = {};
  S.canliAnahtar = null;
  if (D?.pdf && S.veri.tur === "pdf") {
    D.pdfBekleyen.delete(S);
    if (S.tampon) { D.pdf.iptal(S.tampon); S.tampon.width = S.tampon.height = 0; }
    D.pdf.birak(S.veri.pdf);
  }
}

// ---------- gerçek PDF: tembel çizim kuyruğu ----------
// Yalnız görünen ve komşu sayfalar (IntersectionObserver %100 pay) çizilir. Ekranın ortasına en yakın
// sayfa önce; aynı anda en çok iki sayfa. Kalem katmanları ayrı tuvallerde: PDF çizimi kalemi beklemez.
const PDF_ESZAMAN = 2;
const kalemYaziyor = () => document.body.classList.contains("yaziyor");
// Hızlı kaydırma ve fırlatma sürerken de PDF çizimi bekler (PDF.js ana iş parçacığında çizer, kareler kaçıyordu).
// Yavaş, okuyarak kaydırmada çizim sürer; sayfa durulunca kuyruk kendiliğinden devam eder.
const HIZLI_KAYDIRMA = 1.2;   // px/ms
const hizliKaydiriyor = () => !!D && performance.now() - (D.hizliKaydirmaT || -1e9) < 150;
const pdfBeklesin = () => kalemYaziyor() || hizliKaydiriyor();
const pdfSayfaMi = (S) => !!D?.pdf && S.veri.tur === "pdf";
function pdfPlanla(S, gecikme = 0, anahtar = null) {
  // Eski ölçekteki süren çizim bırakılır: bitmesini beklemek yeni ölçeği bir tam çizim süresi geciktirirdi.
  // pdfCiz iptalde false alır, sonunda kuyruğu yeniden çalıştırır; S bekleyenlerde olduğu için yeniden çizilir.
  if (anahtar && D.pdfSuren.has(S) && S.pdfAnahtar !== anahtar && S.tampon) D.pdf.iptal(S.tampon);
  D.pdfBekleyen.add(S);
  if (!gecikme) { pdfKuyruk(); return; }
  zamanIptal(D.pdfZ);
  D.pdfZ = zaman(pdfKuyruk, gecikme);   // yakınlaştırma durulunca netleşir
}
function pdfKuyruk() {
  if (!D?.pdf) return;
  // Kalem yazarken yeni PDF çizimi başlamaz (PDF.js tuvale ana iş parçacığında çizer): kalem gecikmesi önce gelir
  if (document.body.classList.contains("yaziyor")) { zamanIptal(D.pdfZ); D.pdfZ = zaman(pdfKuyruk, 200); return; }
  if (hizliKaydiriyor()) { zamanIptal(D.pdfZ); D.pdfZ = zaman(pdfKuyruk, 120); return; }
  const mr = D.masa.getBoundingClientRect(), orta = mr.top + mr.height / 2;
  while (D.pdfSuren.size < PDF_ESZAMAN) {
    let en = null, enUzak = Infinity;
    for (const S of D.pdfBekleyen) {
      if (!S.gorunur) { D.pdfBekleyen.delete(S); continue; }
      if (D.pdfSuren.has(S)) continue;
      const r = S.kap.getBoundingClientRect(), uzak = Math.abs((r.top + r.bottom) / 2 - orta);
      if (uzak < enUzak) { enUzak = uzak; en = S; }
    }
    if (!en) return;
    D.pdfBekleyen.delete(en);
    pdfCiz(en);
  }
}
async function pdfCiz(S) {
  const d = D, renk = sayfaRengi(), dpr = (S.dpr = dprHesapla(S));
  const anahtar = `${d.k}|${dpr}|${renk}`;
  if (S.cizildi.sayfa === anahtar && S.sayfaCv.width) return;
  d.pdfSuren.add(S);
  S.pdfAnahtar = anahtar;
  const guncel = () => anahtar === `${d.k}|${dprHesapla(S)}|${sayfaRengi()}`;
  const tampon = (S.tampon ||= document.createElement("canvas"));
  const t0 = performance.now();
  const olcek = (x) => (PW * d.k * x) / d.pdf.boyut(S.veri.pdf).w;
  let tamam = false;
  try {
    // Boş sayfa büyük ölçekte (atlama, %300) önce kaba çizilir: tam çizim tablette saniyeler sürebilir
    const alan = PW * d.k * dpr * S.h * d.k * dpr;
    if (!S.sayfaCv.width && alan > 4e6) {
      const kaba = dpr * Math.sqrt(1.5e6 / alan);
      if (await d.pdf.ciz(S.veri.pdf, tampon, olcek(kaba), { bekle: pdfBeklesin }) && D === d && S.gorunur && !S.sayfaCv.width) {
        tuvalBoyutla(S.sayfaCv, PW * d.k, S.h * d.k, kaba);
        const ctx = S.sayfaCv.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(tampon, 0, 0, S.sayfaCv.width, S.sayfaCv.height);
        renkPisir(ctx, renk);
      }
    }
    if (D === d && S.gorunur && guncel()) tamam = await d.pdf.ciz(S.veri.pdf, tampon, olcek(dpr), { bekle: pdfBeklesin });
  }
  finally { d.pdfSuren.delete(S); }
  if (D !== d) return;
  // Bu arada ölçek, renk ya da görünürlük değiştiyse sonuç atılır (yenisi kuyrukta)
  if (tamam && S.gorunur && guncel()) {
    tuvalBoyutla(S.sayfaCv, PW * d.k, S.h * d.k, dpr);
    const ctx = S.sayfaCv.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tampon, 0, 0, S.sayfaCv.width, S.sayfaCv.height);
    renkPisir(ctx, renk);
    S.cizildi.sayfa = anahtar;
    if (d.olcum && d.olcum.ilkSayfa == null) d.olcum.ilkSayfa = performance.now() - t0;
  }
  tampon.width = tampon.height = 0;
  pdfKuyruk();
}
// Sayfa rengi bir kez pişirilir (3.14): sepya çarpılır, koyu sayfa ters çevrilir. Tuval piksel düzleminde.
function renkPisir(ctx, renk) {
  if (renk !== "sepya" && renk !== "koyu") return;
  const c = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (renk === "sepya") {
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#F5EDDA"; ctx.fillRect(0, 0, c.width, c.height);
  } else {
    const kopya = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(c.width, c.height) : Object.assign(document.createElement("canvas"), { width: c.width, height: c.height });
    kopya.getContext("2d").drawImage(c, 0, 0);
    ctx.filter = "invert(.92) hue-rotate(180deg)";
    ctx.drawImage(kopya, 0, 0);
  }
  ctx.restore();
  if (renk === "koyu") tahtaPisir(ctx);
}
// Sor ve bant kartı için sayfanın açık kâğıtta, istenen ölçekte (birim başına piksel) çizilmiş hâli
async function pdfZemin(S, s) {
  const cv = document.createElement("canvas");
  const tamam = await D.pdf.ciz(S.veri.pdf, cv, (PW * s) / D.pdf.boyut(S.veri.pdf).w, { bekle: kalemYaziyor }).catch(() => false);
  return tamam ? { cv, h: S.h } : null;
}
// Sayfa boyutları arka planda gelince farklı olan sayfalar yeni yüksekliğine geçer; ekrandaki yer kaymaz
function pdfBoyutlariUygula() {
  if (!D) return;
  // Hareket sürerken (yazma, kaydırma) sayfa yükseklikleri değişmez: başta alınan j.r eskir, çizgi kayardı
  if (D.jest || D.coklu) { zamanIptal(D.boyutZ); D.boyutZ = zaman(pdfBoyutlariUygula, 250); return; }
  const capa = ekranCapasi();
  let degisti = false;
  for (const S of D.sayfalar) {
    const yh = sayfaYuksekligi(S.veri);
    if (Math.abs(yh - S.h) < 0.5) continue;
    S.h = yh;
    S.kap.style.setProperty("--ph", yh);
    S.cizildi = {};
    S.canliAnahtar = null;
    S.kucukKirli = true;
    degisti = true;
  }
  if (!degisti) return;
  capaUygula(capa);
  gorunenleriCiz();
  if (!D.panelSol.hidden) solPanelCiz();
}

// Ekrana yakın sayfaları hemen çizer (yerleşim değişince IntersectionObserver'ı beklemeden)
function gorunenleriCiz() {
  const mr = D.masa.getBoundingClientRect(), pay = mr.height;
  // Önce hepsi ölçülür, sonra sınıflar yazılır: döngüde yazıp okumak her sayfada yerleşimi zorlardı
  for (const S of D.sayfalar) {
    const r = S.kap.getBoundingClientRect();
    S.gorunur = r.bottom > mr.top - pay && r.top < mr.bottom + pay;
  }
  for (const S of D.sayfalar) {
    uzaklikYaz(S);
    if (S.gorunur) sayfayiHazirla(S);
  }
}
// Uzaktaki sayfa content-visibility ile atlanır (duzenleyici.css .uzakta): ölçek değişince 300 sayfanın
// iç öğeleri baştan stillenip yerleşmez. Yakın sayfada sınıf yok, gölge ve menüler kırpılmaz.
function uzaklikYaz(S) {
  if (S.kap.classList.contains("uzakta") === !S.gorunur) return;
  S.kap.classList.toggle("uzakta", !S.gorunur);
}
// Kaydırırken sınıf değişmez (her değişim kareye bir stil ve yerleşim ekliyordu); ekrana giren uzak sayfayı
// content-visibility: auto zaten çizer. Kaydırma durulunca sınıflar bir kez düzeltilir.
function uzaklikPlanla() {
  zamanIptal(D.uzaklikZ);
  D.uzaklikZ = zaman(() => {
    if (!D) return;
    if (performance.now() - (D.kayT ?? -1e9) < 150) { uzaklikPlanla(); return; }
    for (const S of D.sayfalar) uzaklikYaz(S);
  }, 160);
}

// Bekçi: ekranda durup boş kalan sayfayı yeniden çizer. Gözlemci geri çağrısı kaçarsa (sekme arkadayken,
// geçiş sırasında), Android GPU belleği için tuval içeriğini atarsa ya da çizim yarıda kalırsa sayfa
// "çizildi" sanılıp boş kalıyordu. yokla: tuvalin ortasından bir piksel okunur (yalnız arkadan dönüşte, pahalı).
function sayfaBekci({ yokla = false } = {}) {
  if (!D || document.hidden) return;
  const mr = D.masa.getBoundingClientRect();
  if (!mr.height) return;
  for (const S of D.sayfalar) {
    const r = S.kap.getBoundingClientRect();
    const ekranda = r.bottom > mr.top && r.top < mr.bottom;
    if (!ekranda) {
      // Arkadan dönüşte komşu sayfalar da: gözlemci yeniden haber vermez, kaydırınca boş girerlerdi
      if (yokla && S.gorunur && tuvalKayip(S, true)) { S.cizildi = {}; sayfayiHazirla(S); }
      continue;
    }
    if (!S.gorunur) { S.gorunur = true; uzaklikYaz(S); }
    if (tuvalKayip(S, yokla)) S.cizildi = {};
    const pdfBekliyor = pdfSayfaMi(S) && (D.pdfBekleyen.has(S) || D.pdfSuren.has(S));
    if (!pdfBekliyor) sayfayiHazirla(S);
  }
  // Sayfalar paneli açıksa görünen küçük resimler de: boş kalan sonra yeniden çizilir
  if (D.panelSol.hidden) return;
  let kirli = false;
  for (const S of D.sayfalar) {
    if (!S.kucukGorunur || !S.kucukCv) continue;
    const cv = S.kucukCv;
    if (cv.width && yokla && ortaBos(cv)) S.kucukKirli = true;
    if (S.kucukKirli) { S.kucukDeneme = 0; kirli = true; }   // çizimi süren küçük resim kirli değildir, beklenir
  }
  if (kirli) kucukResimPlanla();
}
// Geçişten sonra yerleşim oturunca (iki kare ve kısa pay) bir kez
function bekciPlanla(sec = {}) {
  if (!D) return;
  zamanIptal(D.bekciZ);
  if (sec.yokla) D.bekciYokla = true;
  const d = D;
  D.bekciZ = zaman(() => requestAnimationFrame(() => {
    if (D !== d) return;
    if (kalemYaziyor() || D.jest) { bekciPlanla(); return; }   // kalem ve parmak hareketi beklemez
    const yokla = !!D.bekciYokla;
    D.bekciYokla = false;
    sayfaBekci({ yokla });
  }), 250);
}
function tuvalKayip(S, yokla) {
  const cv = S.sayfaCv;
  if (!cv.width || !cv.height) return !pdfSayfaMi(S);   // PDF'i boşken kuyruk çizer; örnek ve kâğıt hemen çizilir
  const ctx = cv.getContext("2d");
  if (ctx.isContextLost?.()) return true;
  return yokla && !!S.cizildi.sayfa && ortaBos(cv);
}
// Tuvalin orta pikseli saydam mı: ayrı 1x1 tuvale kopyalanıp okunur. Kaynak tuvalden doğrudan okumak
// Chrome'da onu GPU'dan çıkarabilir (willReadFrequently uyarısı).
let yoklaCtx = null;
function ortaBos(cv) {
  try {
    yoklaCtx ||= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    yoklaCtx.clearRect(0, 0, 1, 1);
    yoklaCtx.drawImage(cv, cv.width >> 1, cv.height >> 1, 1, 1, 0, 0, 1, 1);
    return yoklaCtx.getImageData(0, 0, 1, 1).data[3] === 0;
  } catch { return false; }
}
// GPU bağlamı dönünce (Android arka plandan dönüş) tuval boş gelir: sayfa çizilmemiş sayılır
function tuvalDinle(S) {
  const sifirla = () => {
    if (!D || D.kapS.get(S.kap) !== S) return;
    S.cizildi = {};
    S.canliAnahtar = null;
    if (S.gorunur) sayfayiHazirla(S);
  };
  for (const cv of [S.sayfaCv, S.murekkepCv, S.canliCv]) cv.addEventListener("contextrestored", sifirla);
}

function gozlemcileriKur() {
  D.io = new IntersectionObserver((girdiler) => {
    if (!D) return;
    for (const g of girdiler) {
      const S = D.kapS.get(g.target);
      if (!S) continue;
      S.gorunur = g.isIntersecting;
      if (g.isIntersecting) sayfayiHazirla(S);
      else tuvalleriBosalt(S);
    }
    uzaklikPlanla();
  }, { root: D.masa, rootMargin: "100% 0px" });
  for (const S of D.sayfalar) D.io.observe(S.kap);
  let plan = 0;
  D.ro = new ResizeObserver(() => {
    cancelAnimationFrame(plan);
    plan = requestAnimationFrame(() => {
      if (!D) return;
      balonKapat();
      D.perde.hidden = !(dar() && (!D.panelSol.hidden || !D.panelSag.hidden));
      sigdirGerekirse(false);
      cubukTasmaGuncelle();
      bekciPlanla();
    });
  });
  D.ro.observe(D.masaKap);
  D.temizlik.push(() => cancelAnimationFrame(plan));
  // Arkadan dönüş: tarayıcı tuvalleri boşaltmış olabilir, görünen sayfalar yoklanır
  const donus = () => { if (!document.hidden) bekciPlanla({ yokla: true }); };
  dinle(document, "visibilitychange", donus);
  dinle(window, "pageshow", donus);
  dinle(window, "focus", donus);
}

// ---------- nesne katmanı: notlar, metin kutuları, bantlar ----------
function nesneleriCiz(S) {
  S.nesneler.querySelectorAll(".not, .metin-kutusu, .bant, .asistan-notu, .damga-nesne").forEach((e) => e.remove());
  const parca = document.createDocumentFragment();
  for (const m of S.veri.metinler) parca.append(m.tur === "asistan" ? asistanNotuEl(m) : m.tur === "damga" ? damgaEl(m) : metinEl(S, m));
  for (const b of S.veri.bantlar) parca.append(bantEl(b));
  for (const n of S.veri.notlar) parca.append(notEl(S, n));
  S.nesneler.prepend(parca);
  S.gorselKatman.replaceChildren(...(S.veri.gorseller || []).map((g) => gorselEl(S, g)));
  if (D.sesSoluk) sesSolukNesneler(S);
}

function duzenlenebilir(el) {
  el.contentEditable = "plaintext-only";
  if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  el.spellcheck = false;
  return el;
}
const ilkHarf = (s) => (s || "").trim().charAt(0).toLocaleUpperCase("tr") || "·";

function notEl(S, n) {
  const yazi = duzenlenebilir(h("div", { class: "not-yazi", "data-bos": "Not yaz", "aria-label": "Yapışkan not", role: "textbox", "aria-multiline": "true" }, n.metin));
  const harf = h("span", { class: "ilk-harf", "aria-hidden": "true" }, ilkHarf(n.metin));
  const el = h("div", { class: "not" + (n.kucuk ? " kucuk" : "") + (22 * D.k < 13 ? " kucuk-yazi" : ""), "data-id": n.id,
    style: `--x:${n.x};--y:${n.y};--n:${n.renk};--aci:${n.aci || 0}deg` }, yazi, harf);
  yazi.addEventListener("focusin", () => {
    D.notDuzen = { S, n, once: structuredClone(S.veri.notlar), metin: n.metin };
    notSec(S, n, el);
  });
  yazi.addEventListener("input", () => {
    n.metin = yazi.innerText.replace(/\n$/, "");
    harf.textContent = ilkHarf(n.metin);
    sagPanelPlanla();
  });
  yazi.addEventListener("focusout", () => {
    const d = D?.notDuzen;
    if (!d || d.n !== n) return;
    D.notDuzen = null;
    if (n.metin !== d.metin) gecmisKaydet(S, { notlar: d.once }, { notlar: structuredClone(S.veri.notlar) });
    sayfaDegisti(S);
  });
  yazi.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); yazi.blur(); } });
  return el;
}

function metinEl(S, m) {
  const ic = duzenlenebilir(h("div", { class: "metin-ic", "data-bos": "Yazmaya başla", "aria-label": "Metin kutusu", role: "textbox", "aria-multiline": "true" }, m.metin));
  const el = h("div", { class: "metin-kutusu" + (m.el ? " el-yazisi" : ""), "data-id": m.id,
    style: `--x:${m.x};--y:${m.y};--fs:${m.fs};--renk:${renkSayfaya(m.renk)};--sinir:${S.veri.kenar ? TW : PW}` },
  h("button", { class: "tasi", "aria-label": "Metin kutusunu taşı", tabindex: "-1" }, icon("tutamak")), ic);
  ic.addEventListener("focusin", () => {
    el.classList.add("duzenleniyor");
    const yeni = D.metinYeni === m.id;
    D.metinDuzen = { S, m, metin: yeni ? "" : m.metin, once: structuredClone(yeni ? S.veri.metinler.filter((x) => x.id !== m.id) : S.veri.metinler) };
    D.metinYeni = null;
    nesneSecimKaldir();
    D.nesneSecim = { S, tur: "metin", id: m.id, el };
    D.sayfaMenu = sayfaMenusu(S, [silDugmesi("Sil", () => metinSil(S, m, el))], kutuPx(el, S));
  });
  ic.addEventListener("input", () => { m.metin = ic.innerText.replace(/\n$/, ""); sagPanelPlanla(); });
  ic.addEventListener("focusout", () => {
    el.classList.remove("duzenleniyor");
    const d = D?.metinDuzen;
    if (!d || d.m !== m) return;
    D.metinDuzen = null;
    if (D.nesneSecim?.el === el) nesneSecimKaldir();
    m.metin = m.metin.replace(/\s+$/, "");
    if (!m.metin.trim()) {           // boş bırakılan kutu kendiliğinden silinir
      const i = S.veri.metinler.indexOf(m);
      if (i >= 0) S.veri.metinler.splice(i, 1);
      el.remove();
      if (d.metin) gecmisKaydet(S, { metinler: d.once }, { metinler: structuredClone(S.veri.metinler) });
    } else if (m.metin !== d.metin) gecmisKaydet(S, { metinler: d.once }, { metinler: structuredClone(S.veri.metinler) });
    sayfaDegisti(S);
  });
  ic.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); ic.blur(); } });
  return el;
}

function bantEl(b) {
  const el = h("div", { class: `bant bant--${b.desen}` + (b.acik ? " acik" : ""), "data-id": b.id, role: "button", tabindex: "0",
    "aria-pressed": String(!!b.acik), "aria-label": b.acik ? "Bant, açık. Kapatmak için dokun" : "Bant, kapalı. Açmak için dokun",
    style: `--x:${b.x};--y:${b.y};--w:${b.w};--h:${b.h};--aci:${b.aci ?? BANT_ACI}deg` }, h("div", { class: "bant__dolgu" }));
  bantRozetiKoy(el, b);
  return el;
}

// Nesnenin sayfa kabına göre piksel kutusu (menü konumu için)
function kutuPx(el, S) {
  const r = el.getBoundingClientRect(), k = S.kap.getBoundingClientRect();
  return { x: r.left - k.left, y: r.top - k.top, w: r.width, h: r.height };
}

// Kenar alanında içerik varsa kapalı tutamakta altın nokta
// Çizginin en sağdaki noktası, nokta dizisine göre önbellekli: ağır sayfada her çizgi bitişinde bütün noktalar taranıyordu
const enSagX = new WeakMap();
function cizgiSagi(c) {
  const o = enSagX.get(c.p);
  if (o && o.n === c.p.length) return o.x;
  let x = -Infinity;
  for (const q of c.p) if (q[0] > x) x = q[0];
  enSagX.set(c.p, { n: c.p.length, x });
  return x;
}
function kenardaIcerik(S) {
  const v = S.veri;
  return v.cizgiler.some((c) => cizgiSagi(c) > PW + 2) || v.notlar.some((n) => n.x > PW - 40) ||
    v.metinler.some((m) => m.x > PW - 20) || v.bantlar.some((b) => b.x + b.w > PW + 20) || (v.gorseller || []).some((g) => g.x + g.w > PW + 20);
}
function tutamakGuncelle(S) {
  const acik = !!S.veri.kenar;
  S.tutamak.setAttribute("aria-label", acik ? "Kenar alanını kapat" : "Kenar alanını aç");
  S.tutamak.setAttribute("aria-expanded", String(acik));
  S.tutamak.classList.toggle("gizli-not", !acik && kenardaIcerik(S));
}

// Sayfa içeriği değişince: küçük resim, panel, tutamak noktası
function sayfaDegisti(S) {
  S.kucukKirli = true;
  tutamakGuncelle(S);
  if (!D.panelSol.hidden) kucukResimPlanla();
  sagPanelPlanla();
  bantKartlariniEsle();
  if (S.veri.bantlar.length) kartTazelePlanla(S);
}

// =====================================================================
// ÖLÇEK, KAYDIRMA, KONUM
// =====================================================================
function sigdirK() {
  let w = D.masa.clientWidth || D.masaKap.clientWidth;   // kaydırma çubuğu hariç
  if (!w) w = window.innerWidth - (D.panelSol.hidden ? 0 : 216) - (D.panelSag.hidden ? 0 : 340);
  // Sütunun yan boşlukları CSS'ten okunur: dar masada 24px, araç çubuğu yandayken o tarafta 88px
  const cs = getComputedStyle(D.sutun), pay = (parseFloat(cs.paddingLeft) || 56) + (parseFloat(cs.paddingRight) || 56);
  const kenarVar = D.veri.sayfalar.some((s) => s.kenar);
  // 1px pay: alt piksel yuvarlaması yatay kaydırma çubuğu çıkarmasın
  return kSinirla(Math.min(1.25, (w - pay - 1) / (kenarVar ? TW : PW)));
}
function sigdirGerekirse(animasyon) {
  if (D.veri.sigdir === false) return;
  const yk = sigdirK();
  if (Math.abs(yk - D.k) > 0.002) olcekUygula(yk, { animasyon });
}
// Asistan yanda açılıp kapanınca: .calisma sağdan --sag-panel kadar daralır (CSS), sayfa yeni genişliğe sığar.
// Ekranın 42% çizgisindeki satır yerinde kalır. Elle yakınlaştırılmışsa ve sayfa sığmıyorsa geçici sığdırılır,
// kapanınca eski ölçeğe döner (bu arada kullanıcı ölçeği değiştirdiyse dokunulmaz).
function asistanYeri(acik) {
  if (!D) return;
  // Asistan ile Notlar aynı yanda açılmaz: asistan gelince Notlar kapanır (ölçeği aşağıda asistanla birlikte sığdırılır)
  const notlarKapandi = acik && !D.panelSag.hidden;
  if (notlarKapandi) sagPaneliKapat();
  if (D.kok.classList.contains("asistan-acik") === acik) { if (notlarKapandi) sigdirGerekirse(true); return; }
  const capa = ekranCapasi(), onceRect = capa?.S.kap.getBoundingClientRect(), onceW = D.masa.clientWidth;
  D.kok.classList.toggle("asistan-acik", acik);
  uyandir();   // çip bir an görünür, 2 sn sonra söner (asistan yandayken tamamen: kenar notunu örtmesin)
  // Dikeyde asistan alttan çekmecedir (--sag-panel 0): masa daralmaz, ölçeğe dokunulmaz
  if (D.masa.clientWidth === onceW && !D.asistanOnce) return;
  if (capa) { const mr = D.masa.getBoundingClientRect(); capa.ex = mr.left + mr.width / 2; }   // yeni masanın ortası
  let yk = null;
  if (D.veri.sigdir !== false) yk = sigdirK();
  else if (acik) {
    const fit = sigdirK();
    if (D.k > fit + 0.002) { D.asistanOnce = { k: D.k, gecici: fit }; yk = fit; }
  } else if (D.asistanOnce) {
    if (Math.abs(D.k - D.asistanOnce.gecici) < 0.002) yk = D.asistanOnce.k;
    D.asistanOnce = null;
  }
  if (yk == null || Math.abs(yk - D.k) < 0.002) { if (capa) capaUygula(capa); return; }
  olcekUygula(yk, { capa, onceRect, animasyon: true });
  if (D.asistanOnce && acik) D.veri.k = D.asistanOnce.k;   // kayıtlı ölçek kullanıcınınki kalır
}
function sigdir() {
  D.veri.sigdir = true;
  D.veri.k = null;
  const yk = sigdirK();
  if (Math.abs(yk - D.k) > 0.002) olcekUygula(yk, { animasyon: true });
  else yuzdeYaz(true);
}

// Ekranda bir noktanın altındaki sayfa ve sayfa içi konumu
function capaAl(ex, ey) {
  let en = null, enUzak = Infinity;
  // Uzun belgede aramaya noktanın yakınından başlanır (sayfalar sırayla dizili)
  const ilk = D.sayfalar.length > 40 ? Math.max(0, yakinSayfa(ey) - 2) : 0;
  for (const S of D.sayfalar.slice(ilk)) {
    const r = S.kap.getBoundingClientRect();
    const d = ey < r.top ? r.top - ey : ey > r.bottom ? ey - r.bottom : 0;
    if (d < enUzak) { enUzak = d; en = { S, r }; }
    if (d === 0) break;
  }
  if (!en) return null;
  return { S: en.S, u: (ex - en.r.left) / D.k, v: sinirla((ey - en.r.top) / D.k, -200, en.S.h + 200), ex, ey };
}
// Ekran y'sinin üstünde kalan son sayfanın sırası (ikili arama, offsetTop sütuna göre)
function yakinSayfa(ey) {
  const y = ey - D.masa.getBoundingClientRect().top + D.masa.scrollTop;
  let i = 0, alt = 0, ust = D.sayfalar.length - 1;
  while (alt <= ust) {
    const j = (alt + ust) >> 1;
    if (D.sayfalar[j].kap.offsetTop <= y) { i = j; alt = j + 1; } else ust = j - 1;
  }
  return i;
}
function ekranCapasi() {
  const mr = D.masa.getBoundingClientRect();
  return capaAl(mr.left + mr.width / 2, mr.top + mr.height * 0.42);
}
function capaUygula(c) {
  if (!c) return;
  const r = c.S.kap.getBoundingClientRect();
  D.masa.scrollTop += r.top + c.v * D.k - c.ey;
  D.masa.scrollLeft += r.left + c.u * D.k - c.ex;
}

// k'yı uygular: --k yazılır, ekrandaki çapa yerinde kalır, görünen tuvaller yeniden çizilir.
// animasyon: .sutun üstünde FLIP (önceki görünümden yenisine scale ile, 300ms).
function olcekUygula(yeniK, { capa = null, animasyon = false, onceRect = null } = {}) {
  yeniK = kSinirla(yeniK);
  capa ||= ekranCapasi();
  const k0 = D.k, r0 = onceRect || capa?.S.kap.getBoundingClientRect();
  D.k = yeniK;
  if (D.veri.sigdir === false) D.veri.k = yeniK;
  D.sutun.style.setProperty("--k", yeniK);
  sayfaMenusuKapat();
  silgiImleciGizle();
  balonKapat();
  capaUygula(capa);
  for (const S of D.sayfalar) {
    S.canliAnahtar = null;
    S.nesneler.querySelectorAll(".not").forEach((n) => n.classList.toggle("kucuk-yazi", 22 * yeniK < 13));
  }
  if (D.secim) secimKutusuGuncelle();
  gorunenleriCiz();
  if (animasyon && !hareketAz() && capa && r0) {
    const r1 = capa.S.kap.getBoundingClientRect(), sr = D.sutun.getBoundingClientRect(), s = k0 / yeniK;
    if (Math.abs(s - 1) > 0.002 || Math.abs(r0.left - r1.left) > 1 || Math.abs(r0.top - r1.top) > 1) {
      D.sutun.style.transformOrigin = `${r1.left - sr.left}px ${r1.top - sr.top}px`;
      D.sutun.classList.add("olcekleniyor");
      const an = D.sutun.animate([{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scale(${s})` }, { transform: "none" }],
        { duration: 300, easing: EGRI_MUREKKEP });
      an.onfinish = an.oncancel = () => { D?.sutun.classList.remove("olcekleniyor"); if (D) D.sutun.style.transformOrigin = ""; };
    }
  }
  yuzdeYaz(animasyon);
  sayfaNoGuncelle();
}

// "%100": yüzde 300ms içinde yeni değerine sayar
function yuzdeYaz(animasyon) {
  const hedef = Math.round(D.k * 100), el = D.cipYuzde;
  const bas = parseInt(el.textContent.replace(/\D/g, ""), 10) || hedef;
  cancelAnimationFrame(D.raf.yuzde);
  if (!animasyon || hareketAz() || bas === hedef) { el.textContent = "%" + hedef; return; }
  const t0 = performance.now();
  const adim = (t) => {
    const p = Math.min(1, (t - t0) / 300);
    el.textContent = "%" + Math.round(bas + (hedef - bas) * murekkepEgrisi(p));
    if (p < 1) D.raf.yuzde = requestAnimationFrame(adim);
  };
  D.raf.yuzde = requestAnimationFrame(adim);
}

// Sayfa üstündeki boşluk: üst çubuk ve araç çubuğu altında kalmasın
function ustBosluk() {
  if (D.okuma) return 20;
  if (D.gomulu) return A.konum === "ust" ? 84 : 20;   // yan bölmede üst çubuk yok
  // Şeridin boyu canlı okunur: dar ekranda iki satıra inebilir (ses.js --ses-serit'i de aynı ölçüden yazar)
  const ses = D.sesCubuk ? D.sesCubuk.el?.offsetHeight || D.sesSeritH || 48 : 0;
  return (A.konum === "ust" ? 128 : 72) + ses;   // 128 = üst çubuk 56 + --arac-yuk 60 + 12 (duzenleyici.css --sutun-ust)
}
// Sayfa sayfa kaydırma adımı: yalnız çubukların arasında okunan alan kadar, bir satırlık örtüşmeyle.
// Ekranın %85'i alınsaydı ses şeridi ya da alttaki araç çubuğu açıkken arada okunmamış satırlar kalırdı.
function ekranAdimi() {
  const m = D.masa, ust = Math.max(0, ustBosluk() - 12);
  const alt = !D.okuma && !D.gomulu && A.konum === "alt" ? 84 : 0;   // 16 + 52 px çubuk + 16 boşluk
  return Math.max(120, m.clientHeight - ust - alt - 40);
}
function kaydirAnim(hedefTop, hedefLeft = D.masa.scrollLeft, sure = 420) {
  ataletDurdur();
  const m = D.masa;
  hedefTop = sinirla(hedefTop, 0, Math.max(0, m.scrollHeight - m.clientHeight));
  hedefLeft = sinirla(hedefLeft, 0, Math.max(0, m.scrollWidth - m.clientWidth));
  cancelAnimationFrame(D.raf.kaydir);
  if (hareketAz() || !sure) { m.scrollTop = hedefTop; m.scrollLeft = hedefLeft; return Promise.resolve(); }
  const y0 = m.scrollTop, x0 = m.scrollLeft, t0 = performance.now();
  return new Promise((coz) => {
    const adim = (t) => {
      if (!D) return coz();
      const p = Math.min(1, (t - t0) / sure), e = murekkepEgrisi(p);
      m.scrollTop = y0 + (hedefTop - y0) * e;
      m.scrollLeft = x0 + (hedefLeft - x0) * e;
      if (p < 1) D.raf.kaydir = requestAnimationFrame(adim); else coz();
    };
    D.raf.kaydir = requestAnimationFrame(adim);
  });
}
function sayfayaGit(i, { yumusak = true } = {}) {
  const S = D.sayfalar[sinirla(i, 0, D.sayfalar.length - 1)];
  if (!S) return Promise.resolve();
  return kaydirAnim(S.kap.offsetTop - ustBosluk(), D.masa.scrollLeft, yumusak ? 420 : 0);
}
// Sayfadaki bir alanı ekranın üst yarısına getirir ve çevresine kalem halkası çizer (6.5)
async function hedefeGit(S, r, { halka = true } = {}) {
  if (r.x + r.w / 2 > PW && !S.veri.kenar) { kenarDegistir(S, true); await new Promise((c) => setTimeout(c, 440)); if (!D) return; }
  const m = D.masa, k = D.k;
  const top = S.kap.offsetTop + (r.y + r.h / 2) * k - m.clientHeight * 0.42;
  const left = S.kap.offsetLeft + (r.x + r.w / 2) * k - m.clientWidth / 2;
  await kaydirAnim(top, left);
  if (D && halka) kalemHalkasi(S, r);
}
function kalemHalkasi(S, r) {
  const k = D.k, x = r.x * k, y = r.y * k, w = r.w * k, hh = r.h * k;
  const cx = x + w / 2, cy = y + hh / 2, rx = w * 0.8 + 12, ry = hh * 0.8 + 10, e = (-4 * Math.PI) / 180;
  let d = "";
  for (let i = 0; i <= 56; i++) {
    const a = -0.3 + (i / 56) * (Math.PI * 2 + 0.5), s = 1 + 0.035 * Math.sin(i * 1.7);
    const px = rx * s * Math.cos(a), py = ry * s * Math.sin(a);
    d += (i ? "L" : "M") + (cx + px * Math.cos(e) - py * Math.sin(e)).toFixed(1) + " " + (cy + px * Math.sin(e) + py * Math.cos(e)).toFixed(1);
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("kalem-halkasi");
  svg.innerHTML = `<path d="${d}"/>`;
  S.kap.append(svg);
  const yol = svg.firstChild;
  yol.style.setProperty("--L", yol.getTotalLength());
  setTimeout(() => svg.remove(), 1700);
}

function konumKaydet() {
  const i = Math.max(0, D.gecerli), S = D.sayfalar[i];
  if (!S) return;
  D.veri.konum = { sayfa: i, oran: (D.masa.scrollTop - S.kap.offsetTop) / Math.max(1, S.kap.offsetHeight) };
}
function konumYukle() {
  const m = D.masa;
  m.scrollLeft = Math.max(0, (m.scrollWidth - m.clientWidth) / 2);
  const { sayfa = 0, oran = 0 } = D.veri.konum || {};
  const S = D.sayfalar[Math.min(sayfa, D.sayfalar.length - 1)];
  m.scrollTop = !S || (sayfa === 0 && oran <= 0) ? 0 : S.kap.offsetTop + oran * S.kap.offsetHeight;
}

// Ekranın ortasındaki sayfa: üst çubuk, çip, küçük resimler ve yer imi düğmesi
function sayfaNoGuncelle(zorla = false) {
  if (!D || !D.sayfalar.length) return;
  if (document.body.classList.contains("yaziyor") && !zorla) { D.sayfaNoBekliyor = true; return; }
  D.sayfaNoBekliyor = false;
  const m = D.masa, orta = m.scrollTop + m.clientHeight * 0.45;
  // İkili arama: 300 sayfalık PDF'te her kaydırma olayında bütün sayfalar gezilmesin
  let i = 0, alt = 0, ust = D.sayfalar.length - 1;
  while (alt <= ust) {
    const j = (alt + ust) >> 1;
    if (D.sayfalar[j].kap.offsetTop - 20 <= orta) { i = j; alt = j + 1; } else ust = j - 1;
  }
  const n = D.sayfalar.length;
  if (i === D.gecerli && !zorla && D.sayfaSay === n) return;
  D.gecerli = i; D.sayfaSay = n;
  const no = etiketNo(i), toplam = toplamNo(), metin = `s. ${no} / ${toplam}`;
  D.sayfaDugme.textContent = metin;
  D.cipNo.textContent = metin;
  D.cipNo.setAttribute("aria-label", `Sayfa ${no} / ${toplam}. Sayfaya git`);
  const S = D.sayfalar[i];
  D.ust.yerImi.setAttribute("aria-pressed", String(!!S.veri.yerImi));
  D.ust.yerImi.setAttribute("aria-label", S.veri.yerImi ? "Yer imini kaldır" : "Yer imi ekle");
  if (!D.panelSol.hidden) for (const x of D.sayfalar) if (x.kucukBtn) {
    if (x === S) x.kucukBtn.setAttribute("aria-current", "page"); else x.kucukBtn.removeAttribute("aria-current");
  }
}

// Bilgi çipi 2 saniye hareketsizlikte söner (3.23)
function uyandir() {
  D.cip.classList.remove("dinleniyor");
  zamanIptal(D.cipZ);
  D.cipZ = zaman(() => D.cip.classList.add("dinleniyor"), 2000);
}

// ---------- parmakla kaydırma, atalet ve lastik (5.2) ----------
function kaydirBy(dx, dy) {
  const m = D.masa;
  if (dx) m.scrollLeft -= dx;
  if (!dy) return;
  const maxY = Math.max(0, m.scrollHeight - m.clientHeight);
  if (D.lastik) {
    const yeni = D.lastik + dy * 0.4;
    if (Math.sign(yeni) === Math.sign(D.lastik)) { D.lastik = sinirla(yeni, -24, 24); lastikUygula(); return; }
    D.lastik = 0; lastikUygula();
  }
  const hedef = m.scrollTop - dy;
  if (hedef < 0 && m.scrollTop <= 0.5) { D.lastik = Math.min(24, -hedef * 0.4); m.scrollTop = 0; lastikUygula(); }
  else if (hedef > maxY && m.scrollTop >= maxY - 0.5) { D.lastik = Math.max(-24, -(hedef - maxY) * 0.4); m.scrollTop = maxY; lastikUygula(); }
  else m.scrollTop = hedef;
}
function lastikUygula() { D.sutun.style.translate = D.lastik ? `0 ${D.lastik.toFixed(1)}px` : ""; }
function lastikBirak() {
  if (!D.lastik) return;
  const l = D.lastik;
  D.lastik = 0;
  lastikUygula();
  if (!hareketAz()) D.sutun.animate([{ translate: `0 ${l}px` }, { translate: "0 0" }], { duration: 300, easing: EGRI_KAGIT });
}
function ataletDurdur() { cancelAnimationFrame(D.raf.atalet); D.raf.atalet = 0; }
function ataletBasla(ornek) {
  if (ornek.length < 2) return;
  const a = ornek[0], b = ornek[ornek.length - 1], dt = b[0] - a[0];
  if (dt <= 0 || performance.now() - b[0] > 70) return;
  let vx = (b[1] - a[1]) / dt, vy = (b[2] - a[2]) / dt;
  if (Math.hypot(vx, vy) < 0.1) return;
  let son = performance.now();
  const m = D.masa;
  const adim = (t) => {
    if (!D) return;
    const d = Math.min(48, t - son); son = t;
    const y0 = m.scrollTop, x0 = m.scrollLeft;
    m.scrollTop -= vy * d; m.scrollLeft -= vx * d;
    const f = Math.pow(0.95, d / 16.67);
    vx *= f; vy *= f;
    const takildi = Math.abs(m.scrollTop - y0) < 0.1 && Math.abs(m.scrollLeft - x0) < 0.1;
    if (Math.hypot(vx, vy) < 0.05 || (takildi && d > 0)) { D.raf.atalet = 0; return; }
    D.raf.atalet = requestAnimationFrame(adim);
  };
  D.raf.atalet = requestAnimationFrame(adim);
}

// =====================================================================
// GEÇMİŞ
// =====================================================================
function gecmisKaydet(S, once, sonra) {
  D.gecmis.kaydet({ sayfa: S.veri.id, once, sonra });
  geriAlDurumu();
  icerikDegisti();
  if (once.cizgiler) izEslePlanla();
}
// Çizgi ve nesne değişiklikleri belgeyi damgalar (yedek birleşimi hangi sürümün yeni olduğuna bakar)
function icerikDegisti() { if (D) bus.emit("belge:degisti", { belgeId: D.belge.id }); }
function geriAlDurumu() {
  D.geriAlDugme.disabled = !D.gecmis.geriAlinabilir;
  D.yineleDugme.disabled = !D.gecmis.yinelenebilir;
}
// Islak (600ms) çizgi önce kalıcı katmana geçer; yoksa geri alınan çizgi canlı katmanda bir an daha görünür
function geriAl() { islakAktar(); odagiBirak(); const r = D.gecmis.geriAl(); if (r) { kayitUygula(r, "once"); icerikDegisti(); } geriAlDurumu(); }
function yinele() { islakAktar(); odagiBirak(); const r = D.gecmis.yinele(); if (r) { kayitUygula(r, "sonra"); icerikDegisti(); } geriAlDurumu(); }

function kayitUygula(r, yon) {
  const durum = r[yon];
  secimKaldir();
  nesneSecimKaldir();
  if (r.sayfa === "*" || durum.cizgiler) izEslePlanla();
  if (r.sayfa === "*") {
    D.veri.sayfalar = durum.sayfalar.slice();
    sayfalariKur();
    gorunenleriCiz();
    if (!D.panelSol.hidden) solPanelCiz();
    sagPanelPlanla();
    bantKartlariniEsle();
    if (r.dogan) {
      const i = D.sayfalar.findIndex((S) => S.veri.id === r.dogan);
      if (i >= 0) sayfayaGit(i);
    }
    return;
  }
  const S = D.sayfalar.find((x) => x.veri.id === r.sayfa);
  if (!S) return;
  if (durum.cizgiler) { S.veri.cizgiler = durum.cizgiler.slice(); if (S.gorunur) murekkepCiz(S, true); else S.cizildi.murekkep = null; }
  let nesne = false;
  for (const a of ["notlar", "metinler", "bantlar", "gorseller"]) if (durum[a]) {
    const yeni = structuredClone(durum[a]);
    // Bandın açık ya da kapalı oluşu görünüm durumudur: geri alma başka bir bandı yeniden kapatmasın
    if (a === "bantlar") { const acik = new Map(S.veri.bantlar.map((b) => [b.id, b.acik])); for (const b of yeni) if (acik.has(b.id)) b.acik = acik.get(b.id); }
    S.veri[a] = yeni; nesne = true;
  }
  if (nesne) nesneleriCiz(S);
  sayfaDegisti(S);
  // Değişen sayfa ekranda değilse oraya kayılır
  const m = D.masa, ust = S.kap.offsetTop, alt = ust + S.kap.offsetHeight;
  if (alt < m.scrollTop + 60 || ust > m.scrollTop + m.clientHeight - 60) sayfayaGit(D.sayfalar.indexOf(S));
}

// =====================================================================
// İŞARETÇİ: kalem, fare, parmak
// =====================================================================
function olaylariKur() {
  const m = D.masa;
  dinle(m, "pointerdown", onDown);
  dinle(m, "pointermove", onMove);
  dinle(m, "pointerup", onUp);
  dinle(m, "pointercancel", onCancel);
  dinle(m, "pointerleave", (e) => { if (!D.jest) { silgiImleciGizle(); yakinTemizle(); } if (e.pointerType === "pen") { halkaGizle(); if (!e.buttons) yanTusAyarla(false); } });
  // Kalemle uzun basma bağlam menüsü, seçim balonu ve büyüteç açmaz (CSS: user-select, -webkit-touch-callout)
  dinle(m, "contextmenu", (e) => { if (!yaziAlani(e.target)) e.preventDefault(); });
  dinle(m, "wheel", onWheel, { passive: false });
  dinle(m, "scroll", () => {
    uyandir();
    // Kaydırma hızı: hızlıysa PDF çizimi bekler (pdfBeklesin)
    const t = performance.now(), y = m.scrollTop;
    if (D.kayT != null && Math.abs(y - D.kayY) / Math.max(1, t - D.kayT) > HIZLI_KAYDIRMA) {
      D.hizliKaydirmaT = t;
      if (D.veri.izler?.length) { D.masaKap.classList.add("hizli-kaydir"); zamanIptal(D.hizliZ); D.hizliZ = zaman(() => D.masaKap.classList.remove("hizli-kaydir"), 450); }
    }
    D.kayY = y; D.kayT = t;
    if (D.raf.kaydirma) return;
    D.raf.kaydirma = requestAnimationFrame(() => { D.raf.kaydirma = 0; sayfaNoGuncelle(); if (D.koltuk) koltukGuncelle(); bekciPlanla(); });
  }, { passive: true });
  dinle(m, "dragstart", (e) => e.preventDefault());
  dinle(m, "selectstart", (e) => { if (!yaziAlani(e.target) && !e.target.closest?.("[contenteditable]")) e.preventDefault(); });
  // Açık balon, fiş ve sayfa menüsü dışarı dokununca kapanır
  dinle(document, "pointerdown", (e) => {
    const t = e.target;
    if (D.balon && !D.balon.el.contains(t) && !t.closest?.(".arac-cubugu")) balonKapat();
    if (D.fis && !D.fis.el.contains(t) && !(D.fis.acan && D.fis.acan.contains(t))) fisKapat();
    if (D.ilkIpucu && !D.ilkIpucu.el.contains(t)) { /* ipucu kendi dokunuşunda kapanır */ }
  }, true);
  dinle(document, "keydown", onKey);
  dinle(window, "blur", () => { if (D.jest) jestBitir(D.jest, null); D.jest = null; D.dokunmalar.clear(); D.coklu = null; });
  D.temizlik.push(bus.on("ayarlar", ayarlarDegisti));
  D.temizlik.push(bus.on("kartlar", kartlarDegisti));
  // Tema değişince yalnız kullanıcı defterinin zemini değişir (PDF ve "oto" Masa sayfası beyaz kalır, yeniden çizilmez)
  D.temizlik.push(bus.on("tema", zeminGuncelle));
  // Asistan sağdan açılınca çalışma alanı kalan genişliğe çekilir, sayfa oraya sığar (CSS: .asistan-acik)
  D.temizlik.push(bus.on("asistan:acik", (v) => asistanYeri(!!v)));
  const yanMedya = matchMedia(YAN_YANA_MEDYA), yanDegisti = () => { if (D?.yan && !yanMedya.matches) yanYanaKapat(); };
  yanMedya.addEventListener("change", yanDegisti);
  D.temizlik.push(() => yanMedya.removeEventListener("change", yanDegisti));
  D.temizlik.push(bus.on("kirpintilar", () => { if (!D.panelSag.hidden && D.sekme === "kirpilanlar" && !D.kirpintiYaziyor) sagGovdeCiz(); }));
}

const cizerMi = (e) => (e.pointerType === "pen" ? true : e.pointerType === "mouse" ? e.button === 0 : !!store.ayarlar.parmaklaCiz);
// S Pen ayarları (Ayarlar > S Pen): basınç eğrisi "yumusak" | "orta" | "sert", yan tuş silgi (varsayılan açık)
const BASINC_US = { yumusak: 0.6, orta: 1, sert: 1.7 };   // ortak.js basincUygula ile aynı
const basinc = (e) => {
  if (e.pointerType !== "pen") return 0.5;
  const p = e.pressure > 0 ? e.pressure : 0.5, us = BASINC_US[store.ayarlar.basincEgrisi] || 1;
  return us === 1 ? p : Math.round(Math.pow(p, us) * 1000) / 1000;
};
// Silgi ucu (buttons 32) her zaman, yan tuş (buttons 2) ayar kapalı değilse siler
const silgiTusu = (e) => e.pointerType === "pen" && ((e.buttons & 32) !== 0 || ((e.buttons & 2) !== 0 && store.ayarlar.yanTusSilgi !== false));
const sayfaBul = (t) => { const kap = t?.closest?.(".sayfa-kap"); return kap ? D.kapS.get(kap) : null; };
function noktaAl(e, j) {
  return [Math.round(((e.clientX - j.r.left) / D.k) * 100) / 100, Math.round(((e.clientY - j.r.top) / D.k) * 100) / 100, basinc(e)];
}
const olaylar = (e) => { const o = e.getCoalescedEvents ? e.getCoalescedEvents() : []; return o.length ? o : [e]; };

function kalemiAlgila() {
  if (kalemAlgilandi) return;
  kalemAlgilandi = true;
  if (store.ayarlar.parmaklaCiz) {
    ayarla({ parmaklaCiz: false });
    bildir("Kalem algılandı, parmakla artık sayfa kayar.");
  }
}
function bildir(metin, eylem) {
  toast(metin, eylem);
  if (A.konum === "alt") requestAnimationFrame(() => document.querySelectorAll(".bildirim").forEach((b) => b.classList.add("yukarida")));
}

function yaziyorBasla() { zamanIptal(D.yaziyorZ); document.body.classList.add("yaziyor"); }
function yaziyorBitir() {
  zamanIptal(D.yaziyorZ);
  D.yaziyorZ = zaman(() => { document.body.classList.remove("yaziyor"); if (D.sayfaNoBekliyor) sayfaNoGuncelle(); }, 150);
}

// Kalem inerken ekrandaki parmaklar (tutan başparmak, küçük avuç) avuç sayılır: hareketleri ataletsiz biter,
// büyütme geri alınır, dokunuş kayıtları silinir. Kalkana kadar onMove/onUp onları tanımaz, kalem hemen yazar.
function avucBirak() {
  const j = D.jest;
  if (j && j.tip === "touch") { D.jest = null; jestIptal(j); }
  if (D.coklu) { sikistirIptal(); D.coklu = null; }
  D.dokunmalar.clear();
}

const AVUC_MS = 600;   // kalem görüldükten (havada ya da temasta) sonra dokunuş çizmez, kaydırmaz, çevirmez
function onDown(e) {
  const tip = e.pointerType, simdi = performance.now();
  uyandir();
  if (tip === "pen") { D.sonKalem = simdi; kalemiAlgila(); halkaGizle(); if (D.coklu || D.jest?.tip === "touch") avucBirak(); }
  if (tip === "touch") {
    if (D.jest && D.jest.tip === "pen") return;                                  // kalem yazarken avuç
    if (simdi - D.sonKalem < AVUC_MS || (e.width > 44 && e.height > 44)) return;     // avuç içi reddi
    D.dokunmalar.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (D.dokunmalar.size >= 2) { e.preventDefault(); cokluBasla(); return; }
  } else if (D.jest) return;
  if (D.coklu) return;
  ataletDurdur();
  if (D.lastik) lastikBirak();

  const t = e.target;
  // Seçim kutusu ve metin kutusu tutamağı
  if (D.secim && t.closest(".secim")) { e.preventDefault(); return secimJestiBasla(e, t.closest(".tutamak") ? "olcek" : "tasi"); }
  const tasiEl = t.closest(".metin-kutusu .tasi");
  if (tasiEl) { e.preventDefault(); return nesneTasiBasla(e, sayfaBul(t), tasiEl.closest(".metin-kutusu"), "metin"); }
  if (t.closest("button, input, textarea, select, a, .sayfa-menu, .fis, .ilk-ipucu")) return;

  const S = sayfaBul(t);
  if (D.okuma) {
    e.preventDefault();
    // Koltukta S Pen dokunur dokunmaz son kalemle yazar (kâğıt kitap gibi, kalem ucunu açmak gerekmez); parmak kaydırır
    if (tip === "pen" && S && !t.closest(".bant, .not, .metin-kutusu, .asistan-notu")) {
      const yan = silgiTusu(e);
      return aracBasla(e, S, yan ? "silgi" : koltukKalemi(), yan);
    }
    // Okurken de bant soyulur: ezber için kendini sınama okuma modunda yapılır
    const b = t.closest(".bant");
    if (b && S) return bantDokunBasla(e, S, b, false);
    return kaydirBasla(e, { okuma: true });
  }
  const cizer = cizerMi(e);

  // Ses oynarken kalemle zamanı olan bir nesneye dokunmak kaydı o ana götürür (sözleşme: Masa çizgi zamanı)
  if (tip === "pen" && D.sesOynuyor && S && sesAtlaDene(e, S, t)) return;
  // Damga: parmak ve fare taşır, dokununca menü; kalem yalnız Damga aracındayken taşır, öbür araçlarda üstünden geçer
  const dmE = t.closest(".damga-nesne");
  if (dmE && S && (tip !== "pen" || A.etkin === "damga")) { e.preventDefault(); return nesneTasiBasla(e, S, dmE, "metin"); }

  // Asistan notu: dokunmak seçer, sürüklemek taşır (metin kutusu gibi)
  const asE = t.closest(".asistan-notu");
  if (asE && S) { e.preventDefault(); return nesneTasiBasla(e, S, asE, "metin"); }

  const notE = t.closest(".not");
  if (notE && S) {
    if (t.closest(".not-yazi") && !notE.classList.contains("kucuk")) {
      if (tip === "touch" && !cizer) return kaydirBasla(e, { odakla: t.closest(".not-yazi") });
      return;   // tarayıcı imleci yerleştirsin
    }
    e.preventDefault();
    return nesneTasiBasla(e, S, notE, "not");
  }
  const metinIc = t.closest(".metin-ic");
  // Kalem çizim araçlarındayken yazının üstünden geçer (Samsung Notes gibi); düzenlemek için Metin aracı
  const kalemGecer = tip === "pen" && A.etkin !== "metin" && !metinIc?.closest(".duzenleniyor");
  if (metinIc && S && !kalemGecer) {
    if (tip === "touch" && !cizer) return kaydirBasla(e, { odakla: metinIc });
    return;
  }
  const bantE = t.closest(".bant");
  if (bantE && S) { e.preventDefault(); return bantDokunBasla(e, S, bantE, cizer); }

  // Görsel: parmakla dokunmak seçer, sürüklemek sayfayı kaydırır; seçiliyken kutusundan taşınır ve boyutlanır.
  // Kalem ve fare çizim araçlarında görselin üstüne yazar (mürekkep katmanı görselin üstünde).
  const gE = t.closest(".gorsel-nesne");
  if (gE && S && (tip === "touch" ? !cizer : tip === "mouse" && !CIZIM.has(A.etkin) && A.etkin !== "silgi" && A.etkin !== "kement")) {
    e.preventDefault();
    odagiBirak();
    return kaydirBasla(e, { gorsel: { S, id: gE.dataset.id } });
  }

  // Boş yere dokunuldu: açık düzenleme kapanır
  odagiBirak();
  if (tip === "mouse" && e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  if (!S || !cizer) return kaydirBasla(e, { bos: true });
  const yanTus = tip === "pen" && silgiTusu(e);
  aracBasla(e, S, yanTus ? "silgi" : A.etkin, yanTus && A.etkin !== "silgi");
}

function aracBasla(e, S, arac, gecici = false) {
  if (D.secim && arac !== "kement") secimKaldir();
  nesneSecimKaldir();
  balonKapat();
  if (CIZIM.has(arac)) return cizimBasla(e, S, arac);
  switch (arac) {
    case "silgi": return silmeBasla(e, S, gecici);
    case "kement": return kementBasla(e, S);
    case "sekil": return sekilBasla(e, S);
    case "bant": return dikdortgenBasla(e, S, "bant");
    case "kirp": return dikdortgenBasla(e, S, "kirp");
    case "metin": case "not": case "damga": return dokunusBasla(e, S, arac);
  }
}

function yakala(e) { if (e.pointerType !== "touch") { try { D.masa.setPointerCapture(e.pointerId); } catch { /* boş */ } } }

function onMove(e) {
  const tip = e.pointerType;
  if (tip === "pen") D.sonKalem = performance.now();
  if (tip === "touch") {
    const d = D.dokunmalar.get(e.pointerId);
    if (d) { d.x = e.clientX; d.y = e.clientY; }
    if (D.coklu) { if (d) cokluHareket(); return; }
  }
  const j = D.jest;
  if (!j || j.id !== e.pointerId) { if (!j && tip !== "touch") hover(e); return; }
  switch (j.tur) {
    case "ciz": return cizimDevam(j, e);
    case "sil": return silmeDevam(j, e);
    case "kement": return kementDevam(j, e);
    case "sekil": return sekilDevam(j, e);
    case "dikdortgen": return dikdortgenDevam(j, e);
    case "kaydir": return kaydirDevam(j, e);
    case "secim": return secimJestiDevam(j, e);
    case "nesneTasi": return nesneTasiDevam(j, e);
    case "bantDokun": return bantDokunDevam(j, e);
    case "dokunus": if (Math.hypot(e.clientX - j.x0, e.clientY - j.y0) > 10) j.iptal = true; return;
  }
}

function onUp(e) {
  if (e.pointerType === "touch") {
    D.dokunmalar.delete(e.pointerId);
    if (D.coklu) { if (!D.dokunmalar.size) cokluBitir(); return; }
  }
  const j = D.jest;
  if (!j || j.id !== e.pointerId) return;
  D.jest = null;
  jestBitir(j, e);
}
function onCancel(e) {
  if (e.pointerType === "touch") {
    D.dokunmalar.delete(e.pointerId);
    if (D.coklu) {
      D.coklu.iptal = true;   // bir parmak iptal edildiyse kalanların kalkışı geri al / yinele sayılmaz
      if (!D.dokunmalar.size) { sikistirIptal(); D.coklu = null; }
      return;
    }
  }
  const j = D.jest;
  if (!j || j.id !== e.pointerId) return;
  D.jest = null;
  jestIptal(j);
}

// İptal: yarım çizim, şekil, kement ve dikdörtgen atılır; ekrana zaten uygulanmış değişiklikler (silgi, taşıma) kaydedilir
function jestIptal(j) {
  switch (j.tur) {
    case "ciz": return cizimIptal(j);
    case "kement": case "sekil": yaziyorBitir(); return j.canli.temizle();
    case "dikdortgen": yaziyorBitir(); return j.canli ? j.canli.temizle() : j.el.remove();
    case "sil": return silmeBitir(j);
    case "secim": return secimJestiBitir(j);
    case "nesneTasi": j.el.classList.remove("suruklen"); return j.oynadi ? nesneTasiBitir(j) : undefined;
    default: return jestBitir(j, null);
  }
}

function jestBitir(j, e) {
  switch (j.tur) {
    case "ciz": return cizimBitir(j);
    case "sil": return silmeBitir(j);
    case "kement": return kementBitir(j);
    case "sekil": return sekilBitir(j);
    case "dikdortgen": return dikdortgenBitir(j);
    case "kaydir": return kaydirBitir(j, e);
    case "secim": return secimJestiBitir(j);
    case "nesneTasi": return nesneTasiBitir(j);
    case "bantDokun": return bantDokunBitir(j, e);
    case "dokunus": return dokunusBitir(j, e);
  }
}

// Havadaki kalem ve fare: yan tuş, kenar tutamağı, ekleme aralığı, silgi imleci
function hover(e) {
  if (e.pointerType === "pen") yanTusAyarla(silgiTusu(e));
  const t = e.target, S = sayfaBul(t);
  if (e.pointerType === "pen") {
    yakinTemizle();
    if (S) {
      const r = S.kap.getBoundingClientRect(), u = (e.clientX - r.left) / D.k;
      if (u > PW * 0.88 && !S.veri.kenar) { S.tutamak.classList.add("yakin"); D.yakinTutamak = S.tutamak; }
    }
    const ara = t.closest?.(".ara-ekle");
    if (ara) { ara.classList.add("yakin"); D.yakinAra = ara; }
    // Kalem havadayken canlı tuval önceden açılır: büyük tuvalin ayrılması kalemin inişini geciktirmesin.
    // Koltuk'ta da: kalem orada doğrudan yazar.
    if (S && !e.buttons && !D.jest && (D.okuma || CIZIM.has(A.etkin)) && (D.canliS !== S || !S.canliCv.width || !S.canliAnahtar)) canliHazirla(S);   // yakınlaştırma anahtarı sıfırlar
    if (!e.buttons) halkaGoster(e, S, t); else halkaGizle();
  }
  const silgiMi = e.pointerType !== "pen" && !D.okuma && (A.etkin === "silgi" || D.yanTus) && S && !t.closest(".not, .metin-kutusu, .bant, .secim");
  if (silgiMi) silgiImleci(S, e.clientX, e.clientY); else silgiImleciGizle();
}

// Koltuk'ta kalem son seçilen kalemle yazar (silgi ya da başka araç seçiliyse de)
const koltukKalemi = () => (CIZIM.has(A.etkin) ? A.etkin : "kalem" + (A.sonKalem || 0));

// ---------- S Pen imleç halkası (TASARIM-3 8) ve kenarda satır çizgileri (nüans 7) ----------
// Tek bir div.kalem-halka belgede bir kez durur (kabuk ya da başka ekran koyduysa o kullanılır); havadaki
// kalemle yalnız transform değişir, rAF'ta bir kez. Boyu araç boyudur (kalınlık × yakınlaştırma, en az 6px).
function halkaGoster(e, S, t) {
  const arac = D.yanTus ? "silgi" : D.okuma ? koltukKalemi() : A.etkin;
  if (!S || (arac !== "silgi" && !CIZIM.has(arac)) || t.closest?.(".not, .metin-kutusu, .bant, .secim, .asistan-notu, .sayfa-menu")) { halkaGizle(); return; }
  let el = D.halka;
  if (!el) {
    el = document.querySelector("body > .kalem-halka");
    if (!el) { const yeni = (el = h("div", { class: "kalem-halka", "aria-hidden": "true" })); document.body.append(yeni); D.temizlik.push(() => yeni.remove()); }
    const o = el;
    D.halka = el;
    D.temizlik.push(() => o.classList.remove("gorunur"));
  }
  const tur = arac === "silgi" ? "silgi" : arac === "fosforlu" ? "fosforlu" : "kalem";
  const k = arac === "silgi" ? A.silgi.r * 2 : arac === "fosforlu" ? A.fosforlu.w : A.kalemler[+arac.slice(5)].mm * 5;
  const renk = arac === "silgi" ? "" : renkSayfaya(arac === "fosforlu" ? A.fosforlu.renk : A.kalemler[+arac.slice(5)].renk);
  const anahtar = `${tur}|${Math.round(k * D.k * 2)}|${renk}`;
  if (el.dataset.anahtar !== anahtar) {
    el.dataset.anahtar = anahtar;
    el.dataset.arac = tur;
    el.style.setProperty("--c", Math.max(6, Math.round(k * D.k)) + "px");
    if (renk) el.style.setProperty("--halka", renk); else el.style.removeProperty("--halka");
  }
  D.halkaX = e.clientX; D.halkaY = e.clientY;
  el.classList.add("gorunur");
  if (!D.raf.halka) D.raf.halka = requestAnimationFrame(() => {
    if (!D) return;
    D.raf.halka = 0;
    D.halka.style.transform = `translate3d(${D.halkaX}px, ${D.halkaY}px, 0)`;
  });
  kenarSatir(S, e);
}
function halkaGizle() {
  if (!D) return;
  D.halka?.classList.remove("gorunur");
  D.kenarSatirEl?.classList.remove("acik");
}

// Nüans 7: kalem PDF sayfasının ya da boş defter yaprağının kenar boşluğuna gelince kalemin hizasında
// üç soluk yazı çizgisi (laboratuvar defterinin silik çizgileri). Kenar sütunu zaten çizgili, orada yok.
function kenarSatir(S, e) {
  const b = kenarBosluk(S);
  const el0 = D.kenarSatirEl;
  if (!b || D.okuma) { el0?.classList.remove("acik"); return; }
  const r = S.kap.getBoundingClientRect(), u = (e.clientX - r.left) / D.k, v = (e.clientY - r.top) / D.k;
  const yan = b.find(([x0, x1]) => u >= x0 && u <= x1);
  if (!yan || v < 8 || v > S.h - 8) { el0?.classList.remove("acik"); return; }
  const el = el0 || (D.kenarSatirEl = h("div", { class: "kenar-satir gecici", "aria-hidden": "true" }));
  if (el.parentNode !== S.nesneler) S.nesneler.append(el);
  const anahtar = `${yan[0]}|${yan[1]}|${b.aralik}|${D.k}`;
  if (el.dataset.anahtar !== anahtar) {
    el.dataset.anahtar = anahtar;
    el.style.left = yan[0] * D.k + "px";
    el.style.width = (yan[1] - yan[0]) * D.k + "px";
    el.style.setProperty("--aralik", b.aralik * D.k + "px");
  }
  // Ortadaki çizgi kalemin ucunun biraz altında: yazılan satırın tabanı
  el.style.transform = `translateY(${((v - b.aralik * 1.25) * D.k).toFixed(1)}px)`;
  el.classList.add("acik");
}
// Sayfanın yazısız kenar şeritleri [[x0, x1], ...] ve satır aralığı; metin henüz ölçülmediyse ölçülür, null döner
function kenarBosluk(S) {
  const v = S.veri;
  if (v.tur === "kagit") return v.kagit === "blank" ? Object.assign([[6, PW * 0.12], [PW * 0.88, PW - 6]], { aralik: 30 }) : null;
  if (v.tur !== "pdf") return null;
  D.kenarBolge ||= new WeakMap();
  const b = D.kenarBolge.get(v);
  if (b !== undefined) return b;
  D.kenarBolge.set(v, null);
  const d = D;
  sayfaKelimeleri(S).then((kel) => {
    if (D !== d) return;
    const P = satirlaraTopla(kel);
    if (P.length < 3) return;
    const sira = (a, p) => { const x = a.slice().sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
    const sx0 = sira(P.map((p) => p.x0), 0.1), sx1 = sira(P.map((p) => p.x1), 0.9);
    const aralik = sinirla(sira(P.map((p) => p.h), 0.5) * 1.5, 18, 48);
    const seritler = [[6, sx0 - 10], [sx1 + 10, PW - 6]].filter(([a, z]) => z - a >= 28);
    D.kenarBolge.set(v, seritler.length ? Object.assign(seritler, { aralik }) : null);
  });
  return null;
}
function yakinTemizle() {
  D.yakinTutamak?.classList.remove("yakin"); D.yakinTutamak = null;
  D.yakinAra?.classList.remove("yakin"); D.yakinAra = null;
}

// S Pen yan tuşu: etkin kalem oluğa iner, silgi uyanır (3.12 madde 3)
function yanTusAyarla(v) {
  if (D.yanTus === v) return;
  D.yanTus = v;
  yanTusGoster();
}
function yanTusGoster() {
  const v = D.yanTus && A.etkin !== "silgi";
  for (const id of ["kalem0", "kalem1", "kalem2", "fosforlu"]) D.aracDugme[id].classList.toggle("dinlen", v && A.etkin === id);
  D.aracDugme.silgi.classList.toggle("gecici-etkin", v);
}

// kutu: silerken jestin başındaki sayfa kutusu (noktaAl da onu kullanır); her olayda yerleşim zorlanmaz
function silgiImleci(S, cx, cy, kutu = null) {
  if (!D.silgiEl) D.silgiEl = h("div", { class: "silgi-imlec gecici" });
  if (D.silgiEl.parentNode !== S.nesneler) S.nesneler.append(D.silgiEl);
  const r = kutu || S.kap.getBoundingClientRect();
  D.silgiEl.style.setProperty("--cap", A.silgi.r * 2 * D.k + "px");
  D.silgiEl.style.transform = `translate(${cx - r.left}px, ${cy - r.top}px)`;
}
function silgiImleciGizle() { D?.silgiEl?.remove(); }

// ---------- çok parmak: sıkıştırma, iki parmak geri al, üç parmak yinele ----------
function cokluBasla() {
  const j = D.jest;
  if (j) {
    D.jest = null;
    if (j.tur === "ciz" && performance.now() - j.bas < 250) cizimIptal(j);   // ikinci parmak hemen geldi: çizgi değil, hareket
    else if (j.tur !== "kaydir") jestBitir(j, null);
  }
  ataletDurdur();
  lastikBirak();
  const n = D.dokunmalar.size;
  D.coklu ||= { maxN: n, bas: performance.now(), hareket: 0, sik: null };
  D.coklu.maxN = Math.max(D.coklu.maxN, n);
  if (n === 2) sikistirBasla();
  else { if (D.coklu.sik) sikistirIptal(); }
}
function cokluHareket() {
  const c = D.coklu;
  for (const d of D.dokunmalar.values()) c.hareket = Math.max(c.hareket, Math.hypot(d.x - d.x0, d.y - d.y0));
  if (c.sik && D.dokunmalar.size === 2) sikistirGuncelle();
}
function cokluBitir() {
  const c = D.coklu;
  D.coklu = null;
  if (!c) return;
  const sure = performance.now() - c.bas;
  if (!c.iptal && c.hareket < 14 && sure < 400 && c.maxN >= 2) {
    sikistirIptal(c);
    if (c.maxN === 2) geriAl(); else yinele();
    return;
  }
  if (c.sik) sikistirBitir(c);
}
function sikistirBasla() {
  const c = D.coklu;
  if (c.sik) sikistirBitir(c);
  const [a, b] = [...D.dokunmalar.values()];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  sayfaMenusuKapat();
  c.sik = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx0: mx, my0: my, mx, my, k0: D.k, s: 1, sr: D.sutun.getBoundingClientRect(), capa: capaAl(mx, my) };
  D.sutun.classList.add("olcekleniyor");
  D.sutun.style.transformOrigin = "0 0";
}
function sikistirGuncelle() {
  const s0 = D.coklu.sik, [a, b] = [...D.dokunmalar.values()];
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const s = kSinirla((s0.k0 * d) / s0.d0) / s0.k0;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const tx = mx - s0.sr.left - s * (s0.mx0 - s0.sr.left), ty = my - s0.sr.top - s * (s0.my0 - s0.sr.top);
  D.sutun.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  Object.assign(s0, { s, mx, my });
}
function sikistirSifirla() {
  D.sutun.style.transform = "";
  D.sutun.style.transformOrigin = "";
  D.sutun.classList.remove("olcekleniyor");
}
function sikistirIptal(c = D.coklu) { if (c?.sik) { c.sik = null; sikistirSifirla(); } }
function sikistirBitir(c) {
  const s0 = c.sik;
  c.sik = null;
  sikistirSifirla();
  if (!s0 || !s0.capa) return;
  const yeniK = s0.k0 * s0.s;
  if (Math.abs(s0.s - 1) > 0.01) { D.veri.sigdir = false; D.veri.k = kSinirla(yeniK); }
  olcekUygula(Math.abs(s0.s - 1) > 0.01 ? yeniK : s0.k0, { capa: { ...s0.capa, ex: s0.mx, ey: s0.my } });
}

function onWheel(e) {
  uyandir();
  if (!e.ctrlKey && !e.metaKey) return;
  // Ctrl+tekerlek: imleç çevresinde yakınlaştırma; önizleme transform, durunca gerçek k
  e.preventDefault();
  let w = D.tekerlek;
  if (!w) {
    w = D.tekerlek = { k0: D.k, s: 1, capa: capaAl(e.clientX, e.clientY), sr: D.sutun.getBoundingClientRect(), mx: e.clientX, my: e.clientY };
    D.sutun.classList.add("olcekleniyor");
    D.sutun.style.transformOrigin = "0 0";
    sayfaMenusuKapat();
  }
  const carpan = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
  w.s = kSinirla(w.k0 * w.s * carpan) / w.k0;
  const tx = w.mx - w.sr.left - w.s * (w.mx - w.sr.left), ty = w.my - w.sr.top - w.s * (w.my - w.sr.top);
  D.sutun.style.transform = `translate(${tx}px, ${ty}px) scale(${w.s})`;
  zamanIptal(w.z);
  w.z = zaman(() => {
    D.tekerlek = null;
    sikistirSifirla();
    D.veri.sigdir = false;
    D.veri.k = kSinirla(w.k0 * w.s);
    olcekUygula(w.k0 * w.s, { capa: w.capa });
  }, 160);
}

// ---------- kaydırma hareketi ----------
function kaydirBasla(e, sec = {}) {
  ataletDurdur();
  D.jest = { tur: "kaydir", id: e.pointerId, tip: e.pointerType, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY,
    bas: performance.now(), hareket: 0, ornek: [[performance.now(), e.clientX, e.clientY]], ...sec };
  yakala(e);
}
function kaydirDevam(j, e) {
  j.hareket = Math.max(j.hareket, Math.hypot(e.clientX - j.x0, e.clientY - j.y0));
  if (!j.basladi && j.hareket < 6) return;
  if (!j.basladi) { j.basladi = true; j.x = e.clientX; j.y = e.clientY; }
  const dx = e.clientX - j.x, dy = e.clientY - j.y;
  j.x = e.clientX; j.y = e.clientY;
  kaydirBy(dx, dy);
  const t = performance.now();
  j.ornek.push([t, e.clientX, e.clientY]);
  while (j.ornek.length > 2 && t - j.ornek[0][0] > 90) j.ornek.shift();
}
function kaydirBitir(j, e) {
  lastikBirak();
  const dokunus = j.hareket < 8 && performance.now() - j.bas < 400;
  if (!dokunus) { if (e) ataletBasla(j.ornek); return; }
  if (!e) return;
  // Koltukta dokunma bölgelerini koltuk.js dinler; yüklenemediyse masa kendisi bakar
  if (j.okuma) { if (D.mod === "koltuk") { if (!D.koltuk) koltukDokun(e); } else cubukGoster(); return; }
  if (j.odakla) { odakla(j.odakla); return; }
  if (j.gorsel) { nesneSecimKaldir(); secimKur(j.gorsel.S, [], { gorsel: [j.gorsel.id] }); return; }
  if (j.bos) { secimKaldir(); nesneSecimKaldir(); }
}

// ---------- çizim (kalem, fosforlu) ----------
function cizimBasla(e, S, arac) {
  const ayar = arac === "fosforlu"
    ? { tur: "fosforlu", renk: A.fosforlu.renk, w: A.fosforlu.w }
    : (({ tur, renk, mm }) => ({ tur, renk, w: mm * 5 }))(A.kalemler[+arac.slice(5)]);
  const j = { tur: "ciz", id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), bas: performance.now(),
    duzMu: arac === "fosforlu" && A.fosforlu.duz, capaX: e.clientX, capaY: e.clientY, durgunZ: 0, duzlesti: false };
  j.cizgi = zamanla({ id: yeniId("c"), ...ayar, p: [noktaAl(e, j)] });
  j.canli = canliHazirla(S);
  S.canliCv.classList.toggle("carp", arac === "fosforlu");   // fosforlu canlıyken de sayfayla çarpılır
  D.jest = j;
  yakala(e);
  yaziyorBasla();
  j.canli.ciz(j.cizgi);
  if (!j.duzMu) durgunlukKur(j);
}
// Kalem durunca: şekil düzeltme açıksa 500 ms sonra çizgi şekle döner (OZELLIKLER-4 4.4), kapalıysa ya da
// fosforluda 600 ms sonra düzleşir (OZELLIKLER, araç davranışları 2). Kalem yolunda yalnız bir zaman damgası
// güncellenir; zamanlayıcı tek, süre dolunca kalan süreye göre yeniden kurulur. Tanıma kalem dururken bir kez çalışır.
function durgunlukKur(j) {
  j.durgunSure = A.sekilDuzelt && j.cizgi.tur !== "fosforlu" ? 500 : 600;
  j.sonOynama = performance.now();
  j.durgunZ = zaman(() => durgunlukBak(j), j.durgunSure);
}
function durgunlukBak(j) {
  j.durgunZ = 0;
  if (D.jest !== j || j.duzlesti) return;
  const kalan = j.durgunSure - (performance.now() - j.sonOynama);
  if (kalan > 8) { j.durgunZ = zaman(() => durgunlukBak(j), kalan); return; }
  if (j.cizgi.p.length < 4) return;
  const id = j.cizgi.id;
  if (j.durgunSure === 500) {
    const t0 = performance.now(), yeni = sekilTani(j.cizgi);
    D.sekilMs = Math.round((performance.now() - t0) * 100) / 100;   // ölçüm: tanıma süresi
    if (!yeni) return;
    j.duzlesti = true;
    j.sekilli = !yeni.duz;   // kapalı şekil ve ok yerinde kalır; düz çizginin ucu kalemi izler
    j.cizgi = { ...yeni, id };
    j.canli.ciz(j.cizgi);
    return;
  }
  const p = j.cizgi.p, a = p[0], z = p[p.length - 1];
  if (Math.hypot(z[0] - a[0], z[1] - a[1]) < 12) return;
  j.duzlesti = true;
  j.cizgi = { ...duzlestir(j.cizgi), id };
  j.canli.ciz(j.cizgi);
}
function cizimDevam(j, e) {
  if (e.pointerType === "pen" && silgiTusu(e) && j.tip === "pen") {
    // Çizerken yan tuşa basıldı: çizgi biter, silgi başlar
    D.jest = null; cizimBitir(j); yanTusAyarla(true);
    return silmeBasla(e, j.S, true);
  }
  if (j.sekilli) return;
  const ol = olaylar(e), c = j.cizgi;
  if (j.duzlesti || j.duzMu) {
    const son = noktaAl(ol[ol.length - 1], j);
    if (j.duzlesti) j.cizgi = { ...duzlestir({ ...c, p: [c.p[0], son] }), id: c.id };
    else c.p = [c.p[0], son];
    j.canli.ciz(j.cizgi);
    return;
  }
  const esik = 0.5 / D.k;
  for (const o of ol) {
    const q = noktaAl(o, j), s = c.p[c.p.length - 1];
    if (Math.abs(q[0] - s[0]) < esik && Math.abs(q[1] - s[1]) < esik) { s[2] = Math.max(s[2], q[2]); continue; }
    c.p.push(q);
  }
  const tahmin = e.getPredictedEvents ? e.getPredictedEvents().map((o) => noktaAl(o, j)) : [];
  j.canli.ciz(c, tahmin.slice(0, 3));
  if (!j.duzMu && Math.abs(e.clientX - j.capaX) + Math.abs(e.clientY - j.capaY) > 5) {
    j.capaX = e.clientX; j.capaY = e.clientY; j.sonOynama = performance.now();
    if (!j.durgunZ) j.durgunZ = zaman(() => durgunlukBak(j), j.durgunSure);
  }
}
function cizimBitir(j) {
  zamanIptal(j.durgunZ);
  const S = j.S, c = j.cizgi;
  if (c.p.length === 1) { const q = c.p[0]; c.p.push([q[0] + 0.01, q[1] + 0.01, q[2]]); }
  const once = S.veri.cizgiler.slice();
  S.veri.cizgiler.push(c);
  gecmisKaydet(S, { cizgiler: once }, { cizgiler: S.veri.cizgiler.slice() });
  islakBitir(j.canli, c, (cz) => kaliciyaAktar(S, cz));
  yaziyorBitir();
  sayfaDegisti(S);
  izKuyrugaAl(S, c, j.bas);   // boşta: biçimi ve altındaki metin
}
function cizimIptal(j) {
  zamanIptal(j.durgunZ);
  j.canli.temizle();
  yaziyorBitir();
}
// Islak mürekkep kuruyunca çizgi kalıcı katmana eklenir (tam yeniden çizim yok)
function kaliciyaAktar(S, c) {
  if (!D || !S.veri.cizgiler.includes(c)) return;
  const anahtar = `${D.k}|${S.dpr}|${sayfaRengi()}|${S.kap.classList.contains("kenarli")}`;
  if (S.cizildi.murekkep !== anahtar || !S.murekkepCv.width) return murekkepCiz(S, true);
  const ctx = S.murekkepCv.getContext("2d");
  ctx.setTransform(D.k * S.dpr, 0, 0, D.k * S.dpr, 0, 0);
  cizgiCiz(ctx, c, { koyuSayfa: koyuMu() });
}

// ---------- silgi ----------
function silmeBasla(e, S, gecici) {
  const j = { tur: "sil", id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), once: S.veri.cizgiler.slice(), silindi: false, gecici, son: null,
    yarilanan: new Set() };   // kurşun kalem bir geçişte yarıya iner (nüans 3)
  D.jest = j;
  yakala(e);
  yaziyorBasla();
  silmeDevam(j, e);
}
function silmeDevam(j, e) {
  if (j.gecici && e.pointerType === "pen" && !silgiTusu(e) && e.buttons) {
    // Yan tuş bırakıldı: silme biter, kalem kaldığı yerden yazar
    yanTusAyarla(false);
    D.jest = null; silmeBitir(j);
    if (CIZIM.has(A.etkin)) cizimBasla(e, j.S, A.etkin);
    return;
  }
  const S = j.S;
  let bu = null;   // yalnız bu olayda silinenlerin kutusu yeniden çizilir; j.silindi kalıcıdır, her karede tüm sayfayı çizdirirdi
  for (const o of olaylar(e)) {
    const [x, y] = noktaAl(o, j);
    const giden = silgi(S.veri.cizgiler, x, y, A.silgi.r, { sadeceFosforlu: A.silgi.sadeceFosforlu, onceki: j.son, yarilanan: j.yarilanan });
    j.son = [x, y];
    if (giden.length) bu = kutuBirlestir(bu, cizgilerKutusu(giden));
  }
  if (bu) { j.silindi = true; j.bolge = kutuBirlestir(j.bolge, bu); murekkepPlanla(S, bu); }
  silgiImleci(S, e.clientX, e.clientY, j.r);
}
function silmeBitir(j) {
  yaziyorBitir();
  if (!j.silindi) return;
  // Sayfanın geri kalanı zaten doğru: yalnız silinenlerin bölgesi son kez çizilir (bekleyen kare de bunu kapsar)
  if (j.S.murekkepPlan && !j.S.murekkepTam) { cancelAnimationFrame(j.S.murekkepPlan); j.S.murekkepPlan = 0; j.S.murekkepBolge = null; }
  murekkepCiz(j.S, true, j.S.murekkepPlan ? null : j.bolge);
  gecmisKaydet(j.S, { cizgiler: j.once }, { cizgiler: j.S.veri.cizgiler.slice() });
  sayfaDegisti(j.S);
}

// ---------- kement ve seçim (3.21) ----------
function kementBasla(e, S) {
  secimKaldir();
  const j = { tur: "kement", id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), canli: canliHazirla(S),
    aday: e.target?.closest?.(".gorsel-nesne, .damga-nesne") };   // kementle dokunmak görseli ya da damgayı seçer
  const q = noktaAl(e, j);
  j.cokgen = [[q[0], q[1]]];
  D.jest = j;
  yakala(e);
  yaziyorBasla();
}
function kementDevam(j, e) {
  const esik = 2 / D.k;
  for (const o of olaylar(e)) {
    const q = noktaAl(o, j), s = j.cokgen[j.cokgen.length - 1];
    if (Math.hypot(q[0] - s[0], q[1] - s[1]) >= esik) j.cokgen.push([q[0], q[1]]);
  }
  j.canli.kement(j.cokgen);
}
function kementBitir(j) {
  yaziyorBitir();
  j.canli.temizle();
  const S = j.S, c = j.cokgen;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of c) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (c.length < 5 || (x1 - x0 < 10 && y1 - y0 < 10)) {
    if (j.aday?.dataset.id) secimKur(S, [], j.aday.classList.contains("gorsel-nesne") ? { gorsel: [j.aday.dataset.id] } : { damga: [j.aday.dataset.id] });
    return;
  }
  const ind = kementSec(S.veri.cizgiler, c);
  // Görsel ve damga: merkezi kementin içinde kalanlar
  const gorsel = (S.veri.gorseller || []).filter((g) => cokgenIcinde(g.x + g.w / 2, g.y + g.h / 2, c)).map((g) => g.id);
  const damga = S.veri.metinler.filter((m) => m.tur === "damga" && (({ w, h: hh }) => cokgenIcinde(m.x + w / 2, m.y + hh / 2, c))(damgaBoyut(m))).map((m) => m.id);
  if (ind.length || gorsel.length || damga.length) secimKur(S, ind, { gorsel, damga });
}
function cokgenIcinde(x, y, P) {
  let ic = false;
  for (let i = 0, k = P.length - 1; i < P.length; k = i++) {
    const [xi, yi] = P[i], [xk, yk] = P[k];
    if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) ic = !ic;
  }
  return ic;
}

// Seçim: çizgi indeksleri, görsel ve damga kimlikleri. Hepsi birlikte taşınır, büyütülür, kopyalanır, silinir.
function secimKur(S, ind, { gorsel = [], damga = [] } = {}) {
  secimKaldir();
  const kutu = secimSiniri(S, ind, gorsel, damga);
  if (!kutu) return;
  const n = ind.length + gorsel.length + damga.length;
  const ad = n === 1 && gorsel.length ? "Görsel seçili" : n === 1 && damga.length ? "Damga seçili" : !gorsel.length && !damga.length ? `${n} çizgi seçili` : `${n} öğe seçili`;
  const el = h("div", { class: "secim", role: "group", "aria-label": ad }, h("div", { class: "tutamak", "aria-label": "Büyüt" }));
  S.nesneler.append(el);
  D.secim = { S, ind, gorsel, damga, kutu: pay(kutu, ind.length || damga.length ? 6 : 0), el };
  secimKutusuGuncelle();
  secimMenusu();
}
function secimSiniri(S, ind, gorsel, damga) {
  let k = ind.length ? sinirKutusu(S.veri.cizgiler, ind) : null;
  const ekle = (a, b, c, d) => { k = k ? { x0: Math.min(k.x0, a), y0: Math.min(k.y0, b), x1: Math.max(k.x1, c), y1: Math.max(k.y1, d) } : { x0: a, y0: b, x1: c, y1: d }; };
  for (const id of gorsel) { const g = S.veri.gorseller.find((x) => x.id === id); if (g) ekle(g.x, g.y, g.x + g.w, g.y + g.h); }
  for (const id of damga) { const m = S.veri.metinler.find((x) => x.id === id); if (m) { const b = damgaBoyut(m); ekle(m.x, m.y, m.x + b.w, m.y + b.h); } }
  return k;
}
const pay = (k, p) => ({ x0: k.x0 - p, y0: k.y0 - p, x1: k.x1 + p, y1: k.y1 + p });
function secimKutusuGuncelle() {
  const { el, kutu } = D.secim;
  el.style.cssText = `--x:${kutu.x0};--y:${kutu.y0};--w:${kutu.x1 - kutu.x0};--h:${kutu.y1 - kutu.y0}`;
}
function secimMenusu() {
  const { S, kutu } = D.secim, k = D.k;
  const kopya = h("button", { onclick: () => secimKopyala() }, "Kopyala");
  // Sor, Kopyala'dan hemen sonra: seçilen bölgenin görüntüsü asistana gider (TASARIM-2 5.2)
  const sor = h("button", { class: "sor", "aria-label": "Asistana sor", onclick: () => { const s = D.secim; if (s) sorEt(s.S, s.kutu, s.el); } }, icon("sor"), "Sor");
  const kirp = h("button", { onclick: () => { const s = D.secim; if (s) kirpEt(s.S, s.kutu, null); } }, "Kırp olarak kaydet");
  // Yalnız görsel seçiliyken: saat yönünde 90 derece döndür
  const s0 = D.secim, yalnizGorsel = s0.gorsel.length && !s0.ind.length && !s0.damga.length;
  const dondur = yalnizGorsel ? h("button", { "aria-label": "Görseli saat yönünde döndür", onclick: () => gorselDondur() }, "Döndür") : null;
  D.sayfaMenu = sayfaMenusu(S, [kopya, sor, dondur, kirp, silDugmesi("Sil", () => secimSil())].filter(Boolean),
    { x: kutu.x0 * k, y: kutu.y0 * k, w: (kutu.x1 - kutu.x0) * k, h: (kutu.y1 - kutu.y0) * k }, 12);
}
function secimKaldir() {
  if (!D?.secim) return;
  D.secim.el.remove();
  D.secim = null;
  sayfaMenusuKapat();
}
function secimJestiBasla(e, mod) {
  const s = D.secim, S = s.S;
  sayfaMenusuKapat();
  // Önceki durum referansla saklanır; taşınacak çizgiler kopyalanır ki geçmişteki nesneler değişmesin
  const once = S.veri.cizgiler.slice();
  for (const i of s.ind) S.veri.cizgiler[i] = structuredClone(S.veri.cizgiler[i]);
  const asil = s.ind.map((i) => structuredClone(S.veri.cizgiler[i]));
  // Görsel ve damgaların başlangıç hâli (geçmiş için bütün dizi, dönüşüm için seçilenler)
  const onceG = s.gorsel.length ? structuredClone(S.veri.gorseller) : null, onceM = s.damga.length ? structuredClone(S.veri.metinler) : null;
  const asilN = [...s.gorsel.map((id) => S.veri.gorseller.find((x) => x.id === id)), ...s.damga.map((id) => S.veri.metinler.find((x) => x.id === id))]
    .filter(Boolean).map((o) => ({ o, x: o.x, y: o.y, w: o.w, h: o.h, fs: o.fs, el: nesneElBul(S, o.id) }));
  D.jest = { tur: "secim", id: e.pointerId, tip: e.pointerType, S, mod, once, asil, onceG, onceM, asilN, x0: e.clientX, y0: e.clientY, kutu0: { ...s.kutu }, oynadi: false };
  s.el.classList.add("tasiniyor");
  yakala(e);
  yaziyorBasla();
}
function secimJestiDevam(j, e) {
  const s = D.secim, k = D.k, dx = (e.clientX - j.x0) / k, dy = (e.clientY - j.y0) / k, b = j.kutu0;
  if (!j.oynadi && Math.hypot(e.clientX - j.x0, e.clientY - j.y0) < 3) return;
  j.oynadi = true;
  let olcek = 1;
  if (j.mod === "tasi") {
    if (s.ind.length) tasi(j.S.veri.cizgiler, s.ind, j.asil, { dx, dy });
    s.kutu = { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy };
  } else {
    const w0 = b.x1 - b.x0, h0 = b.y1 - b.y0;
    olcek = Math.max(0.1, Math.max((w0 + dx) / w0, (h0 + dy) / h0));
    if (s.ind.length) tasi(j.S.veri.cizgiler, s.ind, j.asil, { olcek, ox: b.x0, oy: b.y0 });
    s.kutu = { x0: b.x0, y0: b.y0, x1: b.x0 + w0 * olcek, y1: b.y0 + h0 * olcek };
  }
  // Görsel ve damga: aynı dönüşüm, DOM'da yerinde
  for (const a of j.asilN) {
    const o = a.o;
    if (j.mod === "tasi") { o.x = Math.round((a.x + dx) * 10) / 10; o.y = Math.round((a.y + dy) * 10) / 10; }
    else {
      o.x = Math.round((b.x0 + (a.x - b.x0) * olcek) * 10) / 10; o.y = Math.round((b.y0 + (a.y - b.y0) * olcek) * 10) / 10;
      if (a.w != null && o.tur !== "damga") { o.w = Math.round(a.w * olcek * 10) / 10; o.h = Math.round(a.h * olcek * 10) / 10; }
      if (o.tur === "damga") o.fs = Math.round(sinirla(a.fs * olcek, 10, 240) * 10) / 10;
    }
    if (a.el) nesneStili(a.el, o);
  }
  secimKutusuGuncelle();
  if (s.ind.length) murekkepPlanla(j.S);
}
function secimJestiBitir(j) {
  yaziyorBitir();
  const s = D.secim;
  if (!s) return;
  s.el.classList.remove("tasiniyor");
  if (j.oynadi) {
    const S = j.S, once = {}, sonra = {};
    if (s.ind.length) { murekkepCiz(S, true); once.cizgiler = j.once; sonra.cizgiler = S.veri.cizgiler.slice(); }
    if (j.onceG) { once.gorseller = j.onceG; sonra.gorseller = structuredClone(S.veri.gorseller); }
    if (j.onceM) { once.metinler = j.onceM; sonra.metinler = structuredClone(S.veri.metinler); }
    gecmisKaydet(S, once, sonra);
    sayfaDegisti(S);
  }
  secimMenusu();
}
function secimKopyala() {
  const s = D.secim;
  if (!s) return;
  const S = s.S, once = {}, sonra = {};
  const kayir = (q) => [q[0] + 24, q[1] + 24, ...q.slice(2)];
  const kopyalar = s.ind.map((i) => {
    const c = structuredClone(S.veri.cizgiler[i]);
    c.id = yeniId("c");
    c.p = c.p.map(kayir);
    return c;
  });
  const bas = S.veri.cizgiler.length;
  if (kopyalar.length) { once.cizgiler = S.veri.cizgiler.slice(); S.veri.cizgiler.push(...kopyalar); murekkepCiz(S, true); sonra.cizgiler = S.veri.cizgiler.slice(); }
  const yeniG = [], yeniM = [];
  if (s.gorsel.length) {
    once.gorseller = structuredClone(S.veri.gorseller);
    for (const id of s.gorsel) { const g = S.veri.gorseller.find((x) => x.id === id); if (g) { const k = { ...structuredClone(g), id: yeniId("g"), x: g.x + 24, y: g.y + 24 }; S.veri.gorseller.push(k); yeniG.push(k.id); } }
    sonra.gorseller = structuredClone(S.veri.gorseller);
  }
  if (s.damga.length) {
    once.metinler = structuredClone(S.veri.metinler);
    for (const id of s.damga) { const m = S.veri.metinler.find((x) => x.id === id); if (m) { const k = { ...structuredClone(m), id: yeniId("m"), x: m.x + 24, y: m.y + 24 }; S.veri.metinler.push(k); yeniM.push(k.id); } }
    sonra.metinler = structuredClone(S.veri.metinler);
  }
  if (yeniG.length || yeniM.length) nesneleriCiz(S);
  gecmisKaydet(S, once, sonra);
  secimKur(S, kopyalar.map((_, i) => bas + i), { gorsel: yeniG, damga: yeniM });
  sayfaDegisti(S);
}
function secimSil() {
  const s = D.secim;
  if (!s) return;
  const S = s.S, once = {}, sonra = {}, sil = new Set(s.ind);
  if (s.ind.length) { once.cizgiler = S.veri.cizgiler.slice(); S.veri.cizgiler = S.veri.cizgiler.filter((_, i) => !sil.has(i)); sonra.cizgiler = S.veri.cizgiler.slice(); }
  if (s.gorsel.length) { once.gorseller = structuredClone(S.veri.gorseller); S.veri.gorseller = S.veri.gorseller.filter((g) => !s.gorsel.includes(g.id)); sonra.gorseller = structuredClone(S.veri.gorseller); }
  if (s.damga.length) { once.metinler = structuredClone(S.veri.metinler); S.veri.metinler = S.veri.metinler.filter((m) => !s.damga.includes(m.id)); sonra.metinler = structuredClone(S.veri.metinler); }
  secimKaldir();
  if (s.ind.length) murekkepCiz(S, true);
  if (s.gorsel.length || s.damga.length) nesneleriCiz(S);
  gecmisKaydet(S, once, sonra);
  sayfaDegisti(S);
  if (s.gorsel.length) bildir(s.gorsel.length === 1 && !s.ind.length && !s.damga.length ? "Görsel silindi" : "Seçim silindi", { etiket: "Geri al", calistir: () => D && geriAl() });
}

// ---------- şekil ----------
function sekilBasla(e, S) {
  const kl = A.kalemler[A.sonKalem];
  const j = { tur: "sekil", id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), canli: canliHazirla(S) };
  const q = noktaAl(e, j);
  j.cizgi = zamanla({ id: yeniId("c"), tur: "sekil", sekil: A.sekil, renk: kl.renk, w: Math.max(1.5, kl.mm * 5), p: [[q[0], q[1], 0.5], [q[0], q[1], 0.5]] });
  D.jest = j;
  yakala(e);
  yaziyorBasla();
}
function sekilDevam(j, e) {
  const q = noktaAl(e, j), a = j.cizgi.p[0];
  let x = q[0], y = q[1];
  if (e.shiftKey) {   // Shift: çizgi 45 dereceye, dikdörtgen kareye, elips daireye oturur
    const dx = x - a[0], dy = y - a[1];
    if (A.sekil === "cizgi" || A.sekil === "ok") {
      const aci = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy);
      x = a[0] + L * Math.cos(aci); y = a[1] + L * Math.sin(aci);
    } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); x = a[0] + Math.sign(dx || 1) * m; y = a[1] + Math.sign(dy || 1) * m; }
  }
  j.cizgi.p[1] = [x, y, 0.5];
  j.canli.ciz(j.cizgi);
}
function sekilBitir(j) {
  yaziyorBitir();
  j.canli.temizle();
  const [a, b] = j.cizgi.p;
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) return;
  const S = j.S, once = S.veri.cizgiler.slice();
  S.veri.cizgiler.push(j.cizgi);
  kaliciyaAktar(S, j.cizgi);
  gecmisKaydet(S, { cizgiler: once }, { cizgiler: S.veri.cizgiler.slice() });
  sayfaDegisti(S);
}

// ---------- bant ve kırp: sürüklenen dikdörtgen ----------
function dikdortgenBasla(e, S, tur) {
  const j = { tur: "dikdortgen", amac: tur, id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), x0: e.clientX, y0: e.clientY };
  const q = noktaAl(e, j);
  j.a = [q[0], q[1]]; j.b = [q[0], q[1]];
  if (tur === "bant") j.canli = canliHazirla(S);
  else { j.el = h("div", { class: "kirp-secim gecici" + (A.kirpBirakinca === "sor" ? " olculuyor" : "") }); S.nesneler.append(j.el); dikdortgenEl(j); }
  D.jest = j;
  yakala(e);
  yaziyorBasla();
}
function dikdortgenEl(j) {
  const k = D.k, x0 = Math.min(j.a[0], j.b[0]), y0 = Math.min(j.a[1], j.b[1]);
  Object.assign(j.el.style, { left: x0 * k + "px", top: y0 * k + "px", width: Math.abs(j.b[0] - j.a[0]) * k + "px", height: Math.abs(j.b[1] - j.a[1]) * k + "px" });
}
function dikdortgenDevam(j, e) {
  const q = noktaAl(e, j);
  j.b = [q[0], q[1]];
  if (j.amac === "bant") j.canli.dikdortgen(j.a[0], j.a[1], j.b[0], j.b[1], "bant", { desen: A.bant.desen });
  else dikdortgenEl(j);
}
function dikdortgenBitir(j) {
  yaziyorBitir();
  const kutu = { x0: Math.min(j.a[0], j.b[0]), y0: Math.min(j.a[1], j.b[1]), x1: Math.max(j.a[0], j.b[0]), y1: Math.max(j.a[1], j.b[1]) };
  const w = kutu.x1 - kutu.x0, hh = kutu.y1 - kutu.y0;
  if (j.amac === "bant") {
    j.canli.temizle();
    if (w >= 24 && hh >= 12) bantOlustur(j.S, kutu);
    else if (w < 6 && hh < 6) bantOlustur(j.S, { x0: j.a[0] - 130, y0: j.a[1] - 19, x1: j.a[0] + 130, y1: j.a[1] + 19 });   // dokunuş: hazır boyutta bant
    return;
  }
  if (w < 16 || hh < 16) { j.el.remove(); return; }
  if (A.kirpBirakinca === "sor") sorEt(j.S, kutu, j.el);
  else kirpEt(j.S, kutu, j.el);
}

function bantOlustur(S, k) {
  const once = structuredClone(S.veri.bantlar), sinir = S.veri.kenar ? TW : PW;
  const b = { id: yeniId("b"), x: Math.round(sinirla(k.x0, -20, sinir - 40)), y: Math.round(sinirla(k.y0, -10, S.h - 20)),
    w: Math.round(k.x1 - k.x0), h: Math.round(k.y1 - k.y0), desen: A.bant.desen, aci: +(BANT_ACI + Math.random() * 0.6 - 0.3).toFixed(2), acik: false,
    kartId: yeniId("t") };   // kart kimliği geçmişe girmeden önce verilir: geri al / yinele aynı kartı geri getirir
  S.veri.bantlar.push(b);
  const el = bantEl(b);
  S.nesneler.insertBefore(el, S.nesneler.querySelector(".not"));
  if (!hareketAz()) animasyonBitince(el, "seriliyor", 180);
  gecmisKaydet(S, { bantlar: once }, { bantlar: structuredClone(S.veri.bantlar) });
  sayfaDegisti(S);
}

// Banda dokunmak soyar ya da yapıştırır (6.6); sürüklemek çizime ya da kaydırmaya döner; uzun basmak menü açar
function bantDokunBasla(e, S, el, cizer) {
  const b = S.veri.bantlar.find((x) => x.id === el.dataset.id);
  if (!b) return;
  const j = { tur: "bantDokun", id: e.pointerId, tip: e.pointerType, S, el, b, cizer, x0: e.clientX, y0: e.clientY,
    ilk: { clientX: e.clientX, clientY: e.clientY, pressure: e.pressure, pointerId: e.pointerId, pointerType: e.pointerType, buttons: e.buttons } };
  j.uzunZ = zaman(() => { if (D.jest === j) { D.jest = null; bantMenusu(S, b, el); } }, 520);
  D.jest = j;
  yakala(e);
}
function bantDokunDevam(j, e) {
  if (Math.hypot(e.clientX - j.x0, e.clientY - j.y0) < 8) return;
  zamanIptal(j.uzunZ);
  D.jest = null;
  if (!j.cizer) { kaydirBasla(j.ilk, { okuma: D.okuma }); D.jest.basladi = true; return kaydirDevam(D.jest, e); }
  if (j.cizer) {
    const yanTus = j.tip === "pen" && silgiTusu(j.ilk);
    aracBasla(j.ilk, j.S, yanTus ? "silgi" : A.etkin, yanTus);
    if (D.jest) onMove(e);
  }
}
function bantDokunBitir(j, e) {
  zamanIptal(j.uzunZ);
  if (!e) return;
  bantCevir(j.S, j.b, j.el);
}
function bantCevir(S, b, el, acik = !b.acik) {
  if (!!b.acik === acik) return;
  b.acik = acik;
  el.classList.remove("soyuluyor", "yapisiyor");
  el.classList.toggle("acik", acik);
  el.setAttribute("aria-pressed", String(acik));
  el.setAttribute("aria-label", acik ? "Bant, açık. Kapatmak için dokun" : "Bant, kapalı. Açmak için dokun");
  if (!hareketAz()) { void el.offsetWidth; animasyonBitince(el, acik ? "soyuluyor" : "yapisiyor", acik ? 320 : 280); }
  S.kucukKirli = true;
  kucukResimPlanla();
}
function bantMenusu(S, b, el) {
  nesneSecimKaldir();
  el.classList.add("secili");
  D.nesneSecim = { S, tur: "bant", id: b.id, el };
  const cevir = h("button", { onclick: () => { bantCevir(S, b, el); nesneSecimKaldir(); } }, b.acik ? "Kapat" : "Aç");
  D.sayfaMenu = sayfaMenusu(S, [cevir, silDugmesi("Sil", () => {
    const once = structuredClone(S.veri.bantlar);
    S.veri.bantlar = S.veri.bantlar.filter((x) => x.id !== b.id);
    el.remove();
    nesneSecimKaldir();
    gecmisKaydet(S, { bantlar: once }, { bantlar: structuredClone(S.veri.bantlar) });
    sayfaDegisti(S);
  })], kutuPx(el, S));
}
function tumBantlar(acik) {
  let say = 0;
  for (const S of D.sayfalar) {
    for (const b of S.veri.bantlar) {
      if (!!b.acik === acik) continue;
      const el = S.nesneler.querySelector(`.bant[data-id="${b.id}"]`);
      if (!el) { b.acik = acik; continue; }
      const gecikme = S.gorunur && say < 12 ? say++ * 30 : 0;   // dalga gibi, en fazla 12 bant sırayla
      if (gecikme) zaman(() => bantCevir(S, b, el, acik), gecikme); else bantCevir(S, b, el, acik);
    }
  }
}
const bantlarAcikMi = () => { const t = D.sayfalar.flatMap((S) => S.veri.bantlar); return t.length > 0 && t.every((b) => b.acik); };

// ---------- matbaacı kırpması (6.4) ----------
// Gerçek PDF'te ekrandaki tuval henüz çizilmemiş ya da eski ölçekte olabilir: bölge ayrıca çizilir ve beklenir
function kirpEt(S, kutu, secimEl) {
  sayfaMenusuKapat();
  sayfayiHazirla(S);
  if (!pdfSayfaMi(S)) { kirpBitir(S, kutu, secimEl, S.sayfaCv); return; }
  const d = D, renk = sayfaRengi();
  pdfZemin(S, bolgeOlcek(kutu)).then((z) => {
    if (D !== d) return;
    if (z) renkPisir(z.cv.getContext("2d"), renk);
    kirpBitir(S, kutu, secimEl, z ? z.cv : S.sayfaCv);
    if (z) z.cv.width = z.cv.height = 0;
  });
}
function kirpBitir(S, kutu, secimEl, sayfaCanvas) {
  const k = D.k;
  if (S.veri.gorseller?.length) sayfaCanvas = gorselliKopya(S, sayfaCanvas);
  murekkepCiz(S);
  const gorsel = bolgeYakala({ sayfaCanvas, murekkepCanvas: S.murekkepCv, olcek: k * S.dpr,
    x0: kutu.x0, y0: kutu.y0, x1: kutu.x1, y1: kutu.y1, zemin: koyuMu() ? "#23211D" : "#FCFAF4", koyuSayfa: koyuMu() });
  const no = etiketNo(D.sayfalar.indexOf(S));
  const kp = kirpintiEkle({ gorsel, belgeId: D.belge.id, belgeAd: D.belge.ad, sayfa: no, not: "" });
  kp.bolge = { sayfaId: S.veri.id, x0: kutu.x0, y0: kutu.y0, x1: kutu.x1, y1: kutu.y1 };
  const goster = () => { panelDegistir("sag", true, "kirpilanlar"); };
  if (hareketAz()) {
    secimEl?.remove();
    bildir("Kırpılanlar'a kaydedildi", { etiket: "Göster", calistir: goster });
    return;
  }
  // (1) flaş ve karartma kalkar
  if (!secimEl) { secimEl = h("div", { class: "kirp-secim gecici" }); S.nesneler.append(secimEl); dikdortgenEl({ el: secimEl, a: [kutu.x0, kutu.y0], b: [kutu.x1, kutu.y1] }); }
  secimEl.classList.add("cakti");
  secimEl.append(h("div", { class: "kirp-flas" }));
  const ekranKutu = secimEl.getBoundingClientRect();
  zaman(() => secimEl.remove(), 340);
  // (2) baskı Kırpılanlar sekmesine ya da Notlar düğmesine uçar, (3) hedef karşılar
  zaman(() => {
    D.ucan?.remove();
    // Dar ekranda Notlar "Diğer" menüsünde: baskı Diğer düğmesine uçar
    const hedef = !D.panelSag.hidden ? D.panelSag.querySelector('[data-sekme="kirpilanlar"]') : D.ust.notlar.getClientRects().length ? D.ust.notlar : D.ust.daha;
    const hr = hedef.getBoundingClientRect();
    const en = Math.min(ekranKutu.width, 360), boy = (ekranKutu.height * en) / Math.max(1, ekranKutu.width);
    const x = ekranKutu.left + (ekranKutu.width - en) / 2, y = ekranKutu.top + (ekranKutu.height - boy) / 2;
    const ucan = h("div", { class: "kirp-ucan", style: `left:${x - 6}px;top:${y - 6}px;width:${en + 12}px;height:${boy + 12}px;` +
      `--dx:${hr.left + hr.width / 2 - (x + en / 2)}px;--dy:${hr.top + hr.height / 2 - (y + boy / 2)}px` }, h("img", { src: gorsel, alt: "" }));
    document.body.append(ucan);
    D.ucan = ucan;
    ucan.addEventListener("animationend", () => {
      ucan.remove();
      if (D?.ucan === ucan) D.ucan = null;
      if (hedef.isConnected) animasyonBitince(hedef, "karsila", 200);
    }, { once: true });
  }, 190);
  bildir("Kırpılanlar'a kaydedildi", { etiket: "Göster", calistir: goster });
}

// ---------- metin kutusu ve yapışkan not ----------
function dokunusBasla(e, S, arac) {
  const j = { tur: "dokunus", arac, id: e.pointerId, tip: e.pointerType, S, r: S.kap.getBoundingClientRect(), x0: e.clientX, y0: e.clientY };
  j.q = noktaAl(e, j);
  D.jest = j;
  yakala(e);
}
function dokunusBitir(j, e) {
  if (!e || j.iptal) return;
  if (j.arac === "metin") metinOlustur(j.S, j.q[0], j.q[1]);
  else if (j.arac === "damga") damgaKoy(j.S, j.q[0], j.q[1]);
  else notOlustur(j.S, j.q[0], j.q[1]);
}
function odakla(el) {
  el.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
function odagiBirak() {
  const a = document.activeElement;
  if (a && D?.masa.contains(a) && a !== D.masa) a.blur();
  nesneSecimKaldir();
}
function metinOlustur(S, x, y) {
  const sinir = S.veri.kenar ? TW : PW;
  const m = zamanla({ id: yeniId("m"), x: Math.round(sinirla(x, 4, sinir - 80)), y: Math.round(sinirla(y - A.metin.fs * 0.75, 0, S.h - 30)), metin: "", fs: A.metin.fs, renk: A.metin.renk });
  S.veri.metinler.push(m);
  D.metinYeni = m.id;
  const el = metinEl(S, m);
  S.nesneler.insertBefore(el, S.nesneler.querySelector(".bant, .not"));
  const ic = el.querySelector(".metin-ic");
  odakla(ic);
  // İlk odak tutmadıysa (Android klavyesi geç açılır) bir kare sonra yeniden dene; başka yere geçildiyse dokunma
  requestAnimationFrame(() => {
    const a = document.activeElement;
    if (D && D.metinYeni === m.id && ic.isConnected && (!a || a === document.body)) odakla(ic);
  });
}
function metinSil(S, m, el) {
  const once = structuredClone(S.veri.metinler);
  D.metinDuzen = null;
  S.veri.metinler = S.veri.metinler.filter((x) => x.id !== m.id);
  el.remove();
  nesneSecimKaldir();
  if (once.some((x) => x.id === m.id && x.metin)) gecmisKaydet(S, { metinler: once }, { metinler: structuredClone(S.veri.metinler) });
  sayfaDegisti(S);
}

function notOlustur(S, x, y) {
  const once = structuredClone(S.veri.notlar), sinir = S.veri.kenar ? TW : PW;
  const n = { id: yeniId("n"), x: Math.round(sinirla(x - 30, 0, sinir - NOT_W)), y: Math.round(sinirla(y - 16, 0, S.h - NOT_W)),
    metin: "", renk: A.not.renk, aci: +(Math.random() * 3 - 1.5).toFixed(2), kucuk: false };
  zamanla(n);
  S.veri.notlar.push(n);
  gecmisKaydet(S, { notlar: once }, { notlar: structuredClone(S.veri.notlar) });
  const el = notEl(S, n);
  S.nesneler.append(el);
  if (!hareketAz()) animasyonBitince(el, "konuyor", 280);
  odakla(el.querySelector(".not-yazi"));
  sayfaDegisti(S);
}
function notSec(S, n, el) {
  if (D.nesneSecim?.el === el) return;
  nesneSecimKaldir();
  el.classList.add("secili");
  D.nesneSecim = { S, tur: "not", id: n.id, el };
  const renkler = NOT_RENKLERI.map(([ad, c]) => h("button", { class: "renk-nokta", style: `--n:${c}`, "aria-label": ad, "aria-pressed": String(n.renk === c),
    onclick: (e) => {
      const once = structuredClone(S.veri.notlar);
      n.renk = c;
      el.style.setProperty("--n", c);
      e.currentTarget.parentNode.querySelectorAll(".renk-nokta").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      gecmisKaydet(S, { notlar: once }, { notlar: structuredClone(S.veri.notlar) });
      sayfaDegisti(S);
    } }, h("i")));
  const kucult = h("button", { onclick: () => notKucult(S, n, el, !n.kucuk) }, n.kucuk ? "Büyüt" : "Küçült");
  D.sayfaMenu = sayfaMenusu(S, [...renkler, kucult, silDugmesi("Sil", () => notSil(S, n, el))], kutuPx(el, S), 8);
}
function notKucult(S, n, el, kucuk) {
  const once = structuredClone(S.veri.notlar);
  n.kucuk = kucuk;
  if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
  el.classList.toggle("kucuk", kucuk);
  nesneSecimKaldir();
  gecmisKaydet(S, { notlar: once }, { notlar: structuredClone(S.veri.notlar) });
  sayfaDegisti(S);
}
function notSil(S, n, el) {
  const once = structuredClone(S.veri.notlar);
  D.notDuzen = null;
  S.veri.notlar = S.veri.notlar.filter((x) => x.id !== n.id);
  el.remove();
  nesneSecimKaldir();
  gecmisKaydet(S, { notlar: once }, { notlar: structuredClone(S.veri.notlar) });
  sayfaDegisti(S);
  bildir("Not silindi", { etiket: "Geri al", calistir: () => D && geriAl() });
}

// Not şeridinden ya da metin tutamağından sürükleme; not şeridine dokunmak notu seçer
function nesneTasiBasla(e, S, el, tur) {
  if (!S) return;
  const liste = tur === "not" ? S.veri.notlar : S.veri.metinler;
  const o = liste.find((x) => x.id === el.dataset.id);
  if (!o) return;
  sayfaMenusuKapat();
  D.jest = { tur: "nesneTasi", nesne: tur, id: e.pointerId, tip: e.pointerType, S, el, o, x0: e.clientX, y0: e.clientY, ox: o.x, oy: o.y,
    once: structuredClone(liste), oynadi: false };
  yakala(e);
}
function nesneTasiDevam(j, e) {
  const dx = (e.clientX - j.x0) / D.k, dy = (e.clientY - j.y0) / D.k;
  if (!j.oynadi && Math.hypot(e.clientX - j.x0, e.clientY - j.y0) < 5) return;
  if (!j.oynadi) { j.oynadi = true; j.el.classList.add("suruklen"); nesneSecimKaldir(); }
  const sinir = j.S.veri.kenar ? TW : PW, w = j.nesne === "not" ? (j.o.kucuk ? 44 / D.k : NOT_W) : 60;
  j.o.x = Math.round(sinirla(j.ox + dx, -w + 30, sinir - 30));
  j.o.y = Math.round(sinirla(j.oy + dy, -10, j.S.h - 30));
  j.el.style.setProperty("--x", j.o.x);
  j.el.style.setProperty("--y", j.o.y);
}
function nesneTasiBitir(j) {
  j.el.classList.remove("suruklen");
  const S = j.S, anahtar = j.nesne === "not" ? "notlar" : "metinler";
  if (j.oynadi) {
    gecmisKaydet(S, { [anahtar]: j.once }, { [anahtar]: structuredClone(S.veri[anahtar]) });
    sayfaDegisti(S);
    if (j.nesne === "metin" && !j.o.tur) odakla(j.el.querySelector(".metin-ic"));
    return;
  }
  if (j.o.tur === "asistan") return asistanNotuSec(S, j.o, j.el);
  if (j.o.tur === "damga") return damgaSec(S, j.o, j.el);
  if (j.nesne === "not") {
    if (j.o.kucuk) notKucult(S, j.o, j.el, false);
    else notSec(S, j.o, j.el);
  }
}

// ---------- sayfa menüsü (seçim, not, metin kutusu, bant) ----------
function sayfaMenusu(S, dugmeler, kutu, bosluk = 12) {
  sayfaMenusuKapat();
  for (const b of dugmeler) b.addEventListener("pointerdown", (e) => e.preventDefault());   // odak metinde kalsın
  const el = h("div", { class: "sayfa-menu", role: "toolbar", "aria-label": "Sayfa menüsü" }, ...dugmeler);
  S.kap.append(el);
  const w = el.offsetWidth, kw = S.kap.offsetWidth;
  let top = kutu.y - 44 - bosluk;
  if (top < 4) top = kutu.y + kutu.h + bosluk;
  el.style.left = sinirla(kutu.x + kutu.w / 2 - w / 2, 4, Math.max(4, kw - w - 4)) + "px";
  el.style.top = top + "px";
  return el;
}
function sayfaMenusuKapat() { D?.sayfaMenu?.remove(); if (D) D.sayfaMenu = null; }
function nesneSecimKaldir() {
  if (!D?.nesneSecim) return;
  D.nesneSecim.el.classList.remove("secili");
  D.nesneSecim = null;
  sayfaMenusuKapat();
}
// İki dokunuşla onaylı silme (tarayıcı confirm'ü yok)
function silDugmesi(metin, fn) {
  const b = h("button", { class: "sil" }, metin);
  onayla(b, fn, "Emin misin?");
  return b;
}
function onayla(dugme, fn, onayMetni = "Emin misin? Tekrar dokun") {
  let z = 0;
  const asil = [...dugme.childNodes];
  dugme.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dugme.dataset.durum === "emin") {
      zamanIptal(z);
      dugme.dataset.durum = "";
      dugme.replaceChildren(...asil);
      fn();
      return;
    }
    dugme.dataset.durum = "emin";
    dugme.textContent = onayMetni;
    z = zaman(() => { dugme.dataset.durum = ""; dugme.replaceChildren(...asil); }, 3000);
  });
}

// =====================================================================
// KENAR ALANI (3.15, imza 6.1)
// =====================================================================
function kenarDegistir(S, ac) {
  if (!!S.veri.kenar === ac) return;
  const anim = !hareketAz() && S.gorunur;
  sayfaMenusuKapat();
  if (!ac && anim && S.kap.classList.contains("kenarli")) {
    // Kapanış: önce kanat katlanır (280ms), sonra genişlik ve FLIP
    S.veri.kenar = false;
    tutamakGuncelle(S);
    S.kenarKap.classList.add("kapaniyor");
    let bitti = false;
    const bitir = () => {
      if (bitti || !D) return;
      bitti = true;
      S.kenarKap.classList.remove("kapaniyor");
      if (!S.veri.kenar) kenarUygula(S, false, true);
    };
    S.kenarKap.addEventListener("animationend", bitir, { once: true });
    setTimeout(bitir, 360);
    return;
  }
  kenarUygula(S, ac, anim);
}
function kenarUygula(S, ac, anim) {
  const once = S.kap.getBoundingClientRect();
  S.veri.kenar = ac;
  S.kap.classList.toggle("kenarli", ac);
  tutamakGuncelle(S);
  S.nesneler.querySelectorAll(".metin-kutusu").forEach((m) => m.style.setProperty("--sinir", ac ? TW : PW));
  S.canliAnahtar = null;
  const yeniK = D.veri.sigdir !== false ? sigdirK() : D.k;
  if (Math.abs(yeniK - D.k) > 0.002) {
    const mr = D.masa.getBoundingClientRect(), ey = mr.top + mr.height * 0.42;
    olcekUygula(yeniK, { capa: { S, u: PW / 2, v: (ey - once.top) / D.k, ex: mr.left + mr.width / 2, ey }, animasyon: anim, onceRect: once });
  } else {
    sayfayiHazirla(S);
    if (anim) {
      const sonra = S.kap.getBoundingClientRect();
      if (Math.abs(once.left - sonra.left) > 0.5) {
        S.kap.animate([{ transform: `translateX(${once.left - sonra.left}px)` }, { transform: "none" }],
          { duration: ac ? 420 : 280, easing: ac ? EGRI_KAGIT : EGRI_CEKIL });
      }
    }
  }
  if (ac && anim) animasyonBitince(S.kenarKap, "aciliyor", 480);
  S.kucukKirli = true;
  menuDurumu();
}
// ⋯ menüsü: Tüm sayfalarda kenar alanı (animasyon yalnız görünen sayfalarda)
function tumKenarlar(ac) {
  const mr = D.masa.getBoundingClientRect(), capa = ekranCapasi();
  const onceRect = capa?.S.kap.getBoundingClientRect();
  for (const S of D.sayfalar) {
    if (!!S.veri.kenar === ac) continue;
    S.veri.kenar = ac;
    S.kap.classList.toggle("kenarli", ac);
    tutamakGuncelle(S);
    S.canliAnahtar = null;
    S.nesneler.querySelectorAll(".metin-kutusu").forEach((m) => m.style.setProperty("--sinir", ac ? TW : PW));
    if (ac && S.gorunur && !hareketAz()) animasyonBitince(S.kenarKap, "aciliyor", 480);
  }
  const yeniK = D.veri.sigdir !== false ? sigdirK() : D.k;
  if (capa) capa.u = PW / 2;
  if (Math.abs(yeniK - D.k) > 0.002) olcekUygula(yeniK, { capa: capa && { ...capa, ex: mr.left + mr.width / 2 }, animasyon: true, onceRect });
  else gorunenleriCiz();
}

// =====================================================================
// YER İMİ, SAYFA EKLEME, OKUMA MODU
// =====================================================================
function yerImiDegistir() {
  const S = D.sayfalar[D.gecerli];
  if (!S) return;
  S.veri.yerImi = !S.veri.yerImi;
  S.kurdele.hidden = !S.veri.yerImi;
  if (S.veri.yerImi && !hareketAz()) animasyonBitince(S.kurdele, "yeni", 320);
  sayfaNoGuncelle(true);
  if (S.kucukBtn) S.kucukBtn.classList.toggle("yer-imli", S.veri.yerImi);
  sagPanelPlanla();
}

// Kâğıt yelpazesi (3.16): araya ya da sona boş, çizgili, kareli, noktalı sayfa
function yelpazeAc(capa, konum) {
  if (D.fis?.acan === capa) { fisKapat(); return; }
  const fis = h("div", { class: "fis yelpaze", role: "menu", "aria-label": "Sayfa türü" },
    ...KAGITLAR.map(([id, ad, sinif]) => h("button", { class: "mini-yaprak", role: "menuitem", onclick: () => { fisKapat(); sayfaEkle(konum, id); } },
      h("i", { class: sinif }), ad)));
  const ara = capa.closest(".ara-ekle");
  if (ara) { ara.append(fis); ara.classList.add("acik"); }
  else {
    fis.classList.add("fis-sabit");
    D.kok.append(fis);
    const r = capa.getBoundingClientRect();
    fis.style.left = sinirla(r.left + r.width / 2 - fis.offsetWidth / 2, 8, innerWidth - fis.offsetWidth - 8) + "px";
    fis.style.top = Math.max(8, r.top - fis.offsetHeight - 8) + "px";
    fis.style.transformOrigin = "bottom center";
  }
  D.fis = { el: fis, acan: capa, kapaninca: () => ara?.classList.remove("acik") };
}
function sayfaEkle(konum, kagit) {
  const once = D.veri.sayfalar.slice();
  const yeni = yeniSayfa({ tur: "kagit", kagit, kenar: D.sayfalar.length > 0 && D.sayfalar.every((S) => S.veri.kenar) });
  D.veri.sayfalar.splice(konum, 0, yeni);
  D.gecmis.kaydet({ sayfa: "*", once: { sayfalar: once }, sonra: { sayfalar: D.veri.sayfalar.slice() }, dogan: yeni.id });
  geriAlDurumu();
  icerikDegisti();
  sayfalariKur({ yeniId: yeni.id });
  gorunenleriCiz();
  if (!D.panelSol.hidden) solPanelCiz();
  sagPanelPlanla();
  const S = D.sayfalar[konum], m = D.masa;
  if (S && (S.kap.offsetTop > m.scrollTop + m.clientHeight - 120 || S.kap.offsetTop + S.kap.offsetHeight < m.scrollTop)) sayfayaGit(konum);
}

function okumaModu(ac) {
  D.okuma = ac;
  D.kok.classList.toggle("okuma-modu", ac);
  D.kok.classList.remove("cubuk-gorunur");
  D.masaKap.classList.toggle("okuma-modu", ac);
  balonKapat(); fisKapat(); secimKaldir(); odagiBirak(); silgiImleciGizle();
  if (ac && dar()) { panelDegistir("sol", false); panelDegistir("sag", false); }
}
// Okuma modunda sayfaya dokunuş üst çubuğu getirir, 3 saniye sonra yeniden çekilir
function cubukGoster() {
  const acik = D.kok.classList.toggle("cubuk-gorunur");
  zamanIptal(D.cubukZ);
  if (acik) D.cubukZ = zaman(() => D.kok.classList.remove("cubuk-gorunur"), 3000);
}

// =====================================================================
// AYAR BALONLARI (3.13)
// =====================================================================
function balonDegistir(arac, capa) {
  if (D.balon && D.balon.arac === arac) { balonKapat(); return; }
  balonAc(arac, capa);
}
function balonKapat(hemen = false) {
  if (!D?.balon) return;
  const { el, arac } = D.balon;
  D.balon = null;
  D.aracDugme[arac]?.removeAttribute("aria-expanded");
  if (hemen || hareketAz()) { el.remove(); return; }
  el.classList.add("kapaniyor");
  setTimeout(() => el.remove(), 150);
}
function balonAc(arac, capa) {
  balonKapat(true);
  ipucuGizle();
  ilkIpucuKapat("arac");
  const b = h("div", { class: "balon", role: "dialog", "aria-label": aracEtiketi(arac) + " ayarları" });
  const tur = arac.startsWith("kalem") ? "kalem" : arac;
  const guncelle = (BALONLAR[tur] || BALONLAR.kirp)(b, arac);
  D.masaKap.append(b);
  balonKonumla(b, capa && capa.offsetParent ? capa : D.aracDugme[arac]);
  D.balon = { el: b, arac, guncelle };
  D.aracDugme[arac]?.setAttribute("aria-expanded", "true");
  guncelle?.();
}
function balonKonumla(b, capa) {
  const mk = D.masaKap.getBoundingClientRect(), cr = D.aracCubugu.getBoundingClientRect(), r = capa.getBoundingClientRect();
  const W = mk.width, H = mk.height, bw = b.offsetWidth, bh = b.offsetHeight;
  const cx = r.left - mk.left + r.width / 2, cy = r.top - mk.top + r.height / 2;
  if (A.konum === "sol" || A.konum === "sag") {
    const top = sinirla(cy - 60, 64, Math.max(64, H - bh - 12));
    b.style.top = top + "px";
    b.style.setProperty("--cikis-y", cy - top + "px");
    if (A.konum === "sol") { b.classList.add("yanda-sag"); b.style.left = cr.right - mk.left + 14 + "px"; }
    else { b.classList.add("yanda-sol"); b.style.left = cr.left - mk.left - bw - 14 + "px"; }
    return;
  }
  const left = sinirla(cx - bw / 2, 12, Math.max(12, W - bw - 12));
  b.style.left = left + "px";
  b.style.setProperty("--cikis-x", cx - left + "px");
  if (A.konum === "alt") { b.classList.add("ustte"); b.style.top = cr.top - mk.top - bh - 12 + "px"; }
  else b.style.top = cr.bottom - mk.top + 12 + "px";
}

function baslikSatiri(baslik, cikti) {
  return h("div", { class: "balon-baslik" }, baslik, cikti || null);
}
// cizgi: "cizgi" ya da "keski" verilirse uçlarda nokta yerine bağlamdaki eğik çizgi örnekleri durur (kucuk, buyuk: px kalınlık)
function cetvelSatiri(min, max, adim, deger, ad, fn, kucuk = 3, buyuk = 9, cizgi = null) {
  const g = h("input", { type: "range", class: "cetvel", min: String(min), max: String(max), step: String(adim), value: String(deger), "aria-label": ad });
  g.addEventListener("input", () => fn(+g.value));
  const nokta = (d) => h("i", { style: cizgi ? `--d:${d}px` : `width:${d}px;height:${d}px`, "aria-hidden": "true" });
  const sinif = "cetvel-satir" + (cizgi ? " cizgili" + (cizgi === "keski" ? " keski" : "") : "");
  return { el: h("div", { class: sinif }, nokta(kucuk), g, nokta(buyuk)), girdi: g };
}
// Balon başlığında canlı kalınlık örneği: bağlamdaki seçili örneğin aynısı (oyuk zemin, eğik çizgi, mürekkep rengi)
function canliOrnek(keski = false) {
  const el = h("span", { class: "kalinlik cizgi-ornek canli-ornek" + (keski ? " keski-ornek" : ""), "aria-hidden": "true" }, h("i"));
  return { el, yaz: (px, renk) => { el.style.setProperty("--d", px + "px"); el.style.setProperty("--renk-simdi", renk); } };
}
function anahtarSatiri(metin, acik, fn) {
  const b = h("button", { class: "anahtar-satir", role: "switch", "aria-checked": String(!!acik) }, metin, h("span", { class: "anahtar" }));
  b.addEventListener("click", () => { const v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(v)); fn(v); });
  return b;
}
function paletKur(renkler, secili, fn, sinif = "palet") {
  const p = h("div", { class: sinif });
  for (const [ad, c] of renkler) {
    const d = h("button", { class: "damla", style: `--renk:${c}`, "aria-label": ad, "aria-pressed": String(c === secili), "data-renk": c, onclick: () => fn(c) }, h("i"));
    ipucuBagla(d, () => ad, null);
    d.addEventListener("click", (e) => { if (d.dataset.uzun) { delete d.dataset.uzun; e.stopImmediatePropagation(); } }, { capture: true });
    p.append(d);
  }
  return p;
}
const paletSecili = (p, c) => p.querySelectorAll(".damla").forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.renk === c)));

const BALONLAR = {
  kalem(b, arac) {
    const kl = () => A.kalemler[+arac.slice(5)];
    const baslik = h("h3"), cikti = h("output");
    const turlar = ["tukenmez", "dolma", "kursun"].map((t) => {
      const cv = h("canvas");
      const btn = h("button", { class: "tur", "aria-pressed": "false", onclick: () => { kl().tur = t; ayarDegisti(); } }, h("span", { class: "ornek-kagit" }, cv), KALEM_ADLARI[t]);
      return { t, btn, cv };
    });
    const px = (mm) => ornekPx(mm, HIZLI_MM, CIZGI_PX), canli = canliOrnek();
    const cetvel = cetvelSatiri(0.2, 2, 0.1, kl().mm, "Kalınlık", (v) => { kl().mm = v; ayarDegisti(); }, px(0.2), px(2), "cizgi");
    const palet = paletKur(MUREKKEPLER, kl().renk, (c) => { renkSec(kl(), c); ayarDegisti(); });
    b.append(baslikSatiri(baslik, h("span", { class: "balon-olcu" }, canli.el, cikti)), etiket("Tür"), h("div", { class: "tur-secici" }, ...turlar.map((x) => x.btn)),
      etiket("Kalınlık"), cetvel.el, etiket("Mürekkep"), palet,
      h("div", { style: "margin-top:8px" }, anahtarSatiri("Şekil düzeltme", !!A.sekilDuzelt, (v) => { A.sekilDuzelt = v; })),
      h("p", { class: "balon-not" }, "Çizip kalemi yarım saniye tut: çizgi, daire, dikdörtgen, üçgen ya da ok olur."));
    return () => {
      const k = kl();
      baslik.textContent = KALEM_ADLARI[k.tur];
      cikti.textContent = mmYaz(k.mm);
      canli.yaz(px(k.mm), k.renk);
      cetvel.el.style.setProperty("--renk-simdi", k.renk);
      for (const x of turlar) { x.btn.setAttribute("aria-pressed", String(x.t === k.tur)); ornekDalga(x.cv, { tur: x.t, renk: k.renk, w: k.mm * 5 }); }
      if (+cetvel.girdi.value !== k.mm) cetvel.girdi.value = k.mm;
      paletSecili(palet, k.renk);
    };
  },
  fosforlu(b) {
    const cikti = h("output");
    const px = (w) => ornekPx(w, HIZLI_FOSFOR, FOSFOR_PX), canli = canliOrnek(true);
    const cetvel = cetvelSatiri(10, 40, 1, A.fosforlu.w, "Kalınlık", (v) => { A.fosforlu.w = v; ayarDegisti(); }, px(10), px(40), "keski");
    const palet = paletKur(FOSFORLAR, A.fosforlu.renk, (c) => { A.fosforlu.renk = c; ayarDegisti(); }, "palet palet-fosfor");
    b.append(baslikSatiri(h("h3", {}, "Fosforlu"), h("span", { class: "balon-olcu" }, canli.el, cikti)), etiket("Kalınlık"), cetvel.el, etiket("Renk"), palet,
      h("div", { style: "margin-top:8px" }, anahtarSatiri("Düz çizgi", A.fosforlu.duz, (v) => { A.fosforlu.duz = v; })));
    return () => {
      cikti.textContent = String(A.fosforlu.w);
      canli.yaz(px(A.fosforlu.w), A.fosforlu.renk);
      cetvel.el.style.setProperty("--renk-simdi", A.fosforlu.renk);
      if (+cetvel.girdi.value !== A.fosforlu.w) cetvel.girdi.value = A.fosforlu.w;
      paletSecili(palet, A.fosforlu.renk);
    };
  },
  silgi(b) {
    const cikti = h("output");
    const cetvel = cetvelSatiri(4, 48, 1, A.silgi.r, "Boyut", (v) => { A.silgi.r = v; ayarDegisti(); }, 4, 14);
    const temizle = h("button", { class: "onayli" }, "Sayfayı temizle");
    onayla(temizle, () => { sayfayiTemizle(); balonKapat(); });
    b.append(baslikSatiri(h("h3", {}, "Silgi"), cikti), etiket("Boyut"), cetvel.el,
      h("div", { style: "margin-top:6px" }, anahtarSatiri("Sadece fosforluyu sil", A.silgi.sadeceFosforlu, (v) => { A.silgi.sadeceFosforlu = v; baglamCiz(); })),
      h("div", { class: "balon-alt" }, temizle));
    return () => { cikti.textContent = String(A.silgi.r); if (+cetvel.girdi.value !== A.silgi.r) cetvel.girdi.value = A.silgi.r; };
  },
  sekil(b) {
    const karolar = SEKILLER.map(([s, ad]) => h("button", { class: "karo", "aria-pressed": "false", "data-sekil": s, onclick: () => { A.sekil = s; ayarDegisti(); } }, icon(s), ad));
    b.append(baslikSatiri(h("h3", {}, "Şekil")), h("div", { class: "karolar", style: "margin-top:12px" }, ...karolar),
      h("p", { class: "balon-not" }, "Renk ve kalınlık son kullandığın kalemden gelir. Shift ile düz açı."));
    return () => karolar.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.sekil === A.sekil)));
  },
  metin(b) {
    const cikti = h("output");
    const cetvel = cetvelSatiri(14, 40, 1, A.metin.fs, "Boyut", (v) => { A.metin.fs = v; ayarDegisti(); }, 4, 12);
    const palet = paletKur(MUREKKEPLER, A.metin.renk, (c) => { renkSec(A.metin, c); ayarDegisti(); });
    b.append(baslikSatiri(h("h3", {}, "Metin"), cikti), etiket("Boyut"), cetvel.el, etiket("Renk"), palet);
    return () => { cikti.textContent = String(A.metin.fs); if (+cetvel.girdi.value !== A.metin.fs) cetvel.girdi.value = A.metin.fs; paletSecili(palet, A.metin.renk); };
  },
  not(b) {
    const numuneler = NOT_RENKLERI.map(([ad, c], i) => h("button", { class: "not-numune", style: `--n:${c};--aci:${NOT_ACILARI[i]}deg`, "aria-label": ad, "data-renk": c,
      "aria-pressed": "false", onclick: () => { A.not.renk = c; ayarDegisti(); } }, h("i")));
    b.append(baslikSatiri(h("h3", {}, "Yapışkan not")), h("div", { class: "not-numuneler", style: "margin-top:12px" }, ...numuneler),
      h("p", { class: "balon-not" }, "Sayfaya dokun, not oraya yapışsın. Üst şeridinden sürükle."));
    return () => numuneler.forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.renk === A.not.renk)));
  },
  bant(b) {
    const karolar = BANTLAR.map(([ad, d]) => h("button", { class: "karo", "aria-pressed": "false", "data-desen": d, onclick: () => { A.bant.desen = d; ayarDegisti(); } },
      h("span", { class: `bant-parca buyuk bant--${d}` }, h("span", { class: "bant__dolgu" })), ad));
    const toplu = h("button", { class: "metin-dugme" });
    toplu.addEventListener("click", () => { tumBantlar(!bantlarAcikMi()); zaman(() => D.balon?.guncelle?.(), 40); });
    b.append(baslikSatiri(h("h3", {}, "Bant")), h("div", { class: "karolar bantlar", style: "margin-top:12px" }, ...karolar), h("div", { class: "balon-alt" }, toplu));
    return () => {
      karolar.forEach((k) => k.setAttribute("aria-pressed", String(k.dataset.desen === A.bant.desen)));
      toplu.textContent = bantlarAcikMi() ? "Tüm bantları kapat" : "Tüm bantları aç";
    };
  },
  kirp(b) {
    // "Bırakınca" seçicisi: Kaydet (bugünkü davranış) ya da Sor (TASARIM-2 5.2)
    const not = h("p", { class: "balon-not" });
    const secenek = (id, ad, ikon) => h("button", { type: "button", "aria-pressed": "false", "data-id": id,
      onclick: () => { A.kirpBirakinca = id; ayarDegisti(); } }, ikon ? icon(ikon) : null, ad);
    const parca = h("div", { class: "parcali birakinca" }, secenek("kaydet", "Kaydet"), secenek("sor", "Sor", "sor"));
    b.append(baslikSatiri(h("h3", {}, "Kırp")), etiket("Bırakınca"), parca, not);
    return () => {
      const sor = A.kirpBirakinca === "sor";
      parca.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === A.kirpBirakinca)));
      not.textContent = sor
        ? "Sayfada bir alan sürükle. Bırakınca bölgenin görüntüsü asistana gider, soruyu orada seçersin."
        : "Sayfada bir alan sürükle. Seçtiğin bölge çizimlerle birlikte Kırpılanlar'a kaydedilir.";
    };
  },
  kement(b) {
    b.append(baslikSatiri(h("h3", {}, "Kement")), h("p", { class: "balon-not" }, "Seçmek istediğin çizgilerin çevresini çiz. Kutuyu sürükleyerek taşı, köşesinden orantılı büyüt."));
  },
};

function sayfayiTemizle() {
  const S = D.sayfalar[D.gecerli];
  if (!S) return;
  const v = S.veri;
  if (!v.cizgiler.length && !v.notlar.length && !v.metinler.length && !v.bantlar.length && !v.gorseller?.length) return;
  const once = { cizgiler: v.cizgiler.slice(), notlar: structuredClone(v.notlar), metinler: structuredClone(v.metinler), bantlar: structuredClone(v.bantlar), gorseller: structuredClone(v.gorseller || []) };
  v.cizgiler = []; v.notlar = []; v.metinler = []; v.bantlar = []; v.gorseller = [];
  secimKaldir();
  murekkepCiz(S, true);
  nesneleriCiz(S);
  gecmisKaydet(S, once, { cizgiler: [], notlar: [], metinler: [], bantlar: [], gorseller: [] });
  sayfaDegisti(S);
  bildir("Sayfa temizlendi", { etiket: "Geri al", calistir: () => D && geriAl() });
}

// =====================================================================
// FİŞLER: ⋯ menüsü, sayfaya git
// =====================================================================
function fisAc(el, acan, konum) {
  fisKapat(true);
  el.classList.add("fis-sabit");
  D.kok.append(el);
  const r = acan.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
  let left, top;
  if (konum === "sag") { left = r.right - w; top = r.bottom + 6; }
  else if (konum === "orta") { left = r.left + r.width / 2 - w / 2; top = r.bottom + 10; }
  else { left = r.right - w; top = r.top - hh - 10; el.classList.add("ustte"); el.style.transformOrigin = "bottom right"; }
  el.style.left = sinirla(left, 8, innerWidth - w - 8) + "px";
  el.style.top = sinirla(top, 8, innerHeight - hh - 8) + "px";
  D.fis = { el, acan };
  acan.setAttribute("aria-expanded", "true");
}
function fisKapat(hemen = false) {
  if (!D?.fis) return;
  const { el, acan, kapaninca } = D.fis;
  D.fis = null;
  acan?.removeAttribute("aria-expanded");
  kapaninca?.();
  if (hemen || hareketAz()) { el.remove(); return; }
  el.classList.add("kapaniyor");
  setTimeout(() => el.remove(), 150);
}

function sayfayaGitFisi(acan, nereden) {
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const n = D.sayfalar.length, a = etiketNo(0), z = etiketNo(n - 1);
  const girdi = h("input", { type: "number", inputmode: "numeric", min: String(a), max: String(z), value: String(etiketNo(Math.max(0, D.gecerli))), "aria-label": "Sayfa numarası" });
  const git = () => {
    const no = parseInt(girdi.value, 10);
    fisKapat();
    if (!(no >= 1)) return;
    // Prototipte PDF'in yalnız bir kesiti açık: dışındaki numara en yakın açık sayfaya gider
    if (no < a || no > z) bildir(`Prototipte bu belgenin s. ${a} ile ${z} arası açık.`);
    sayfayaGit(siraNo(Math.min(Math.max(no, a), z)));
  };
  girdi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); git(); } if (e.key === "Escape") fisKapat(); });
  const fis = h("div", { class: "fis sayfaya-git", role: "dialog", "aria-label": "Sayfaya git" }, girdi, h("span", {}, "/ " + toplamNo()), h("button", { class: "metin-dugme vurgulu", onclick: git }, "Git"));
  fisAc(fis, acan, nereden === "ust" ? "orta" : "ust");
  girdi.select();
  girdi.focus({ preventScroll: true });
}

function dahaMenusu(acan) {
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const fis = h("div", { class: "fis daha-menu", role: "menu", "aria-label": "Diğer" });
  const disk = (id, ad, kd, kdy, title) => h("button", { class: "kagit-disk", "aria-pressed": String(ayarRengi() === id), "data-renk": id, style: `--kd:${kd};--kdy:${kdy}`,
    title, onclick: () => ayarla({ sayfaRengi: id }) }, h("i", {}, "Aa"), ad);
  const tema = store.ayarlar.tema || "oto";
  const parca = (secenekler, secili, fn) => h("div", { class: "parcali" }, ...secenekler.map(([id, ad, ikon]) =>
    h("button", { "aria-pressed": String(secili === id), "data-id": id, onclick: (e) => { e.currentTarget.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); fn(id); } },
      ikon ? icon(ikon) : null, ad)));
  const bantSatir = h("button", { class: "fis-satir", role: "menuitem", onclick: () => { tumBantlar(!bantlarAcikMi()); fisKapat(); } }, icon("bant", "i-20"), h("span", {}, bantlarAcikMi() ? "Tüm bantları kapat" : "Tüm bantları aç"));
  // Üst çubuktan taşınanlar: yan yana her zaman, Notlar ve Ses 900px altında (ses şeridi açıksa Ses üstte kalır)
  const satir = (ikon, ad, fn, ek = null) => h("button", { class: "fis-satir", role: "menuitem", onclick: () => { fisKapat(true); fn(); } },
    typeof ikon === "string" ? icon(ikon, "i-20") : ikon, h("span", {}, ad), ek ? h("small", {}, ek) : null);
  const darUst = matchMedia("(max-width: 899px)").matches, ustSatirlar = [];
  if (darUst) ustSatirlar.push(satir("notlar", D.panelSag.hidden ? "Notlar" : "Notları kapat", () => panelDegistir("sag")));
  if (darUst && !D.sesCubuk) ustSatirlar.push(satir(ikonSec(["ses-kaydi", "ses", "mikrofon", "kayit"], "●", "i-20"), "Ses kaydı", () => sesCubukDegistir(), "Yazdıkların sese bağlanır"));
  if (!D.gomulu && D.mod !== "koltuk" && matchMedia(YAN_YANA_MEDYA).matches)
    ustSatirlar.push(satir("yan-yana", D.yan ? "Yan yana defteri kapat" : "Yan yana defter", () => yanYanaDegistir(), D.yan ? null : "Sağda bir defter açılır"));
  const no = etiketNo(Math.max(0, D.gecerli));
  // Eylemler üstte (yatayda menü uzun: dışa aktarma kaydırmadan görünsün), ayarlar altta
  fis.append(
    ...ustSatirlar,
    etiket("Dışa aktar"),
    satir("disa-aktar", "Notlu PDF", () => disaAktar({}), "Bütün sayfalar, çizgiler ve notlarla"),
    satir("pdf", "Yalnız bu sayfa", () => disaAktar({ sayfalar: [Math.max(0, D.gecerli)] }), `s. ${no}, notlu PDF`),
    satir("gonder", "Samsung Notes'a gönder", () => disaAktar({ samsung: true })),
    h("div", { class: "fis-hedera" }, svgDen('<svg viewBox="0 0 28 16" aria-hidden="true"><use href="#i-hedera"/></svg>')),
    etiket("Sayfa rengi"),
    h("div", { class: "kagit-diskler" },
      disk("oto", "Oto", "linear-gradient(135deg, #FDFBF6 50%, #24211E 50%)", "#8A7F70", "Masa'da beyaz, okurken temaya uyar"),
      disk("beyaz", "Beyaz", "#FDFBF6", "#24211E"), disk("sepya", "Sepya", "#F5EDDA", "#3B2F22"), disk("koyu", "Koyu", "#1B1A17", "#D9D0BE"), disk("tahta", "Tahta", TAHTA, "#DCD8CB")),
    etiket("Uygulama teması"),
    parca([["oto", "Otomatik", "tema-oto"], ["acik", "Açık", "tema-acik"], ["koyu", "Koyu", "tema-koyu"]], tema, temaSec),
    etiket("Araç çubuğu"),
    parca([["ust", "Üst"], ["alt", "Alt"], ["sol", "Sol"], ["sag", "Sağ"]], A.konum, konumSec),
    h("div", { class: "fis-ayrac" }),
    D.menuParmak = anahtarSatiri("Parmakla çiz", store.ayarlar.parmaklaCiz, (v) => ayarla({ parmaklaCiz: v })),
    D.menuKenar = anahtarSatiri("Tüm sayfalarda kenar alanı", D.sayfalar.every((S) => S.veri.kenar), (v) => tumKenarlar(v)),
    anahtarSatiri("Şekil düzeltme", !!A.sekilDuzelt, (v) => { A.sekilDuzelt = v; }),
    anahtarSatiri("Sade hareket", !!store.ayarlar.sadeHareket, (v) => {
      ayarla({ sadeHareket: v });
      if (v) document.documentElement.dataset.hareket = "sade"; else delete document.documentElement.dataset.hareket;
    }),
    bantSatir,
    h("button", { class: "fis-satir", role: "menuitem", onclick: () => { const i = Math.max(0, D.gecerli); fisKapat(true); sayfaMenusuAc(acan, i); } },
      icon("sayfalar", "i-20"), h("span", {}, `Bu sayfa (s. ${etiketNo(Math.max(0, D.gecerli))})`), h("small", {}, "Çoğalt, sil, şablon")));
  fisAc(fis, acan, "sag");
}
// ---------- Dışa aktar (OZELLIKLER-3 3.5): disa-aktar.js gerekince yüklenir; satırlar "Diğer" menüsünde ----------
// sayfalar: belge.veri.sayfalar sıraları (0'dan). Ad: belge adı + " (notlu).pdf"
let disaAktariliyor = false;
async function disaAktar({ sayfalar = null, samsung = false } = {}) {
  if (!D || disaAktariliyor) return;
  kaydet();
  const belge = D.belge, d = D;
  const ad = belge.ad + (sayfalar?.length === 1 ? ` s. ${etiketNo(sayfalar[0])}` : "") + " (notlu).pdf";
  disaAktariliyor = true;
  bildir(samsung ? "PDF hazırlanıyor. Paylaş menüsünde Samsung Notes'u seç." : "Notlu PDF hazırlanıyor");
  let m, blob;
  try {
    m = await import("./disa-aktar.js");
    blob = await m.pdfDisaAktar(belge, sayfalar ? { sayfalar } : {});
  } catch (e) {
    console.warn("[duzenleyici] dışa aktarma:", e);
    if (D === d) bildir("PDF hazırlanamadı.");
    disaAktariliyor = false;
    return;
  }
  disaAktariliyor = false;
  // Paylaş menüsü yoksa indirir; dokunuş süresi dolduysa paylas() bildirimde "Paylaş" düğmesi bırakır
  try { await m.paylas(blob, ad); }
  catch (e) { if (e?.name !== "AbortError" && D === d) bildir("Paylaşılamadı."); }
}

function menuDurumu() {
  if (!D?.fis || !D.menuKenar?.isConnected) return;
  D.menuKenar.setAttribute("aria-checked", String(D.sayfalar.every((S) => S.veri.kenar)));
  D.menuParmak?.setAttribute("aria-checked", String(!!store.ayarlar.parmaklaCiz));
  D.fis.el.querySelectorAll(".kagit-disk").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.renk === ayarRengi())));
}
function temaSec(t) {
  ayarla({ tema: t });
  const html = document.documentElement, hedef = t === "acik" ? "light" : t === "koyu" ? "dark" : null;
  if ((html.dataset.theme || null) !== hedef) { if (hedef) html.dataset.theme = hedef; else delete html.dataset.theme; }
}
function konumSec(k) {
  A.konum = k;
  D.kok.dataset.aracKonum = k;
  balonKapat(true);
  ipucuGizle();
  sigdirGerekirse(true);
  requestAnimationFrame(cubukTasmaGuncelle);
}

// Defter zemini temaya bağlı: değişirse yalnız kâğıt sayfaların zemin tuvali yeniden çizilir (anahtar sayfaTuvaliCiz'de)
function zeminGuncelle() {
  if (!D) return;
  const z = kagitZemin();
  D.kok.style.setProperty("--kagit-zemin", z);
  if (z === D.zemin) return;
  D.zemin = z;
  let kagitVar = false;
  for (const S of D.sayfalar) if (S.veri.tur !== "pdf") { S.kucukKirli = true; kagitVar = true; }
  if (!kagitVar) return;
  gorunenleriCiz();
  if (!D.panelSol.hidden) kucukResimPlanla();
}

// store.ayarlar değişince (menüden ya da başka ekrandan)
function ayarlarDegisti() {
  if (!D) return;
  const renk = sayfaRengi(), ham = hamRenk();
  if (renk !== D.renk || ham !== D.renkHam) {
    D.renk = renk;
    D.renkHam = ham;
    D.kok.classList.toggle("sayfa-tahta", ham === "tahta");
    for (const S of D.sayfalar) {
      S.kap.dataset.sayfa = renk;
      S.cizildi = {};
      S.canliAnahtar = null;
      S.kucukKirli = true;
      S.nesneler.querySelectorAll(".metin-kutusu, .damga-nesne").forEach((el) => {
        const m = S.veri.metinler.find((x) => x.id === el.dataset.id);
        if (m) el.style.setProperty("--renk", renkSayfaya(m.renk));
      });
    }
    gorunenleriCiz();
    if (!D.panelSol.hidden) kucukResimPlanla();
  }
  zeminGuncelle();
  menuDurumu();
}

// =====================================================================
// ARAMA (3.10 madde 2)
// =====================================================================
function aramaAc() {
  if (D.aramaAcik) { D.aramaGirdi?.focus(); return; }
  D.aramaAcik = true;
  katlaHazir();
  D.ust.ara.setAttribute("aria-pressed", "true");
  const girdi = (D.aramaGirdi = h("input", { type: "search", placeholder: "Belgede ara", "aria-label": "Belgede ara", enterkeyhint: "search", value: D.arama?.sorgu || "" }));
  D.aramaCikti = h("output", { "aria-live": "polite" });
  D.aramaOnceki = h("button", { class: "ikon-dugme onceki", "aria-label": "Önceki sonuç", disabled: true, onclick: () => sonucaGit(-1) }, icon("yukari"));
  D.aramaSonraki = h("button", { class: "ikon-dugme", "aria-label": "Sonraki sonuç", disabled: true, onclick: () => sonucaGit(1) }, icon("asagi"));
  D.aramaAlan = h("div", { class: "ust-arama", role: "search" }, girdi, D.aramaCikti, D.aramaOnceki, D.aramaSonraki,
    h("button", { class: "ikon-dugme", "aria-label": "Aramayı kapat", onclick: aramaKapat }, icon("kapat")));
  let z = 0;
  girdi.addEventListener("input", () => { zamanIptal(z); z = zaman(() => aramaYap(girdi.value, true), 180); });
  girdi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); zamanIptal(z); if (D.arama?.sorgu !== girdi.value.trim()) aramaYap(girdi.value, true); sonucaGit(e.shiftKey ? -1 : 1); }
    if (e.key === "Escape") { e.preventDefault(); aramaKapat(); }
  });
  D.baslik.replaceWith(D.aramaAlan);
  girdi.focus();
  if (D.arama?.sorgu) aramaYap(D.arama.sorgu, false);
}
function aramaKapat() {
  if (!D.aramaAcik) return;
  D.aramaAcik = false;
  D.ust.ara.setAttribute("aria-pressed", "false");
  D.aramaAlan.replaceWith(D.baslik);
}
const trKucuk = (s) => s.toLocaleLowerCase("tr");
// Belgede ara da genel aramadaki gibi eşleşir: Türkçe harfler katlanır, ks ile x birbirinin yerine geçer.
// Döner [konum, uzunluk]: eş yazımın boyu sorgununkinden farklı olabilir.
function eslesmeler(metin, sorgu) {
  return katliEslesmeler(String(metin || ""), sorguBicimleri(sorgu).ifade).sort((x, y) => x[0] - y[0]);
}
function aramaYap(sorgu, paneliAc) {
  sorgu = sorgu.trim();
  const sonuclar = [];
  if (sorgu.length >= 2) {
    D.sayfalar.forEach((S, si) => {
      if (S.veri.tur === "pdf" && !D.pdf) {
        const satirlar = sayfaMetinleri(S.veri.pdf);
        satirlar.forEach((r, ri) => {
          for (const [i, n] of eslesmeler(r.t, sorgu)) {
            const o = altDizeOlc(r, i, i + n);
            sonuclar.push({ S, si, tur: "Sayfa", metin: r.t, i, n, ek: satirlar[ri + 1]?.t || "",
              kutu: { x: o.x, y: r.y - r.boyut * 0.85, w: Math.max(8, o.w), h: r.boyut * 1.15 } });
          }
        });
      }
      for (const nt of S.veri.notlar) for (const [i, n] of eslesmeler(nt.metin, sorgu)) sonuclar.push({ S, si, tur: "Not", metin: nt.metin, i, n, kutu: { x: nt.x, y: nt.y, w: nt.kucuk ? 44 / D.k : NOT_W, h: nt.kucuk ? 44 / D.k : NOT_W } });
      for (const m of S.veri.metinler) for (const [i, n] of eslesmeler(m.metin, sorgu)) sonuclar.push({ S, si, tur: "Metin", metin: m.metin, i, n, kutu: { x: m.x, y: m.y, w: 160, h: m.fs * 1.5 } });
    });
  }
  D.arama = { sorgu, sonuclar, secili: -1 };
  if (D.pdf && sorgu.length >= 2) pdfAra(D.arama);
  aramaDurumu();
  if (paneliAc && sorgu.length >= 2) panelDegistir("sag", true, "arama");
  else if (!D.panelSag.hidden && D.sekme === "arama") sagGovdeCiz();
}
// Gerçek PDF'te sayfa metinleri sırayla okunur (PDF.js metin katmanı); sonuçlar geldikçe listeye düşer.
// Eşleşme tek metin parçası içinde aranır; satırı bölen eşleşmeler kaçabilir.
async function pdfAra(a) {
  const d = D;
  a.suruyor = true;
  const sirala = () => {
    const secili = a.sonuclar[a.secili];
    a.sonuclar.sort((x, y) => x.si - y.si || x.kutu.y - y.kutu.y || x.kutu.x - y.kutu.x);
    if (secili) a.secili = a.sonuclar.indexOf(secili);
  };
  const tazele = () => { if (D !== d || D.arama !== a) return; sirala(); aramaDurumu(); if (!D.panelSag.hidden && D.sekme === "arama") sagGovdeCiz(); };
  for (let si = 0; si < d.sayfalar.length; si++) {
    const S = d.sayfalar[si];
    if (S.veri.tur !== "pdf") continue;
    let satirlar = [];
    try { satirlar = await d.pdf.satirlar(S.veri.pdf); } catch { /* metinsiz sayfa */ }
    if (D !== d || D.arama !== a) return;
    satirlar.forEach((r, ri) => {
      for (const [i, n] of eslesmeler(r.t, a.sorgu)) {
        a.sonuclar.push({ S, si, tur: "Sayfa", metin: r.t, i, n, ek: satirlar[ri + 1]?.t || "", kutu: metinKutusu(r, i, n) });
      }
    });
    if (si % 24 === 23) tazele();
  }
  a.suruyor = false;
  tazele();
}
// Eşleşmenin kutusu: taban çizgisi metnin yönünde ilerler, döndürülmüş sayfada da dört köşeden sarılır
function metinKutusu(r, i, n) {
  const oran = r.w / Math.max(1, r.t.length), dx = r.dx ?? 1, dy = r.dy ?? 0, ux = r.ux ?? 0, uy = r.uy ?? -1;
  const bx = r.x + dx * i * oran, by = r.y + dy * i * oran, L = Math.max(8, n * oran);
  const xs = [], ys = [];
  for (const t of [0, L]) for (const u of [-0.3, 0.85]) { xs.push(bx + dx * t + ux * u * r.boyut); ys.push(by + dy * t + uy * u * r.boyut); }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function aramaDurumu() {
  const a = D.arama, n = a?.sonuclar.length || 0;
  if (D.aramaCikti) D.aramaCikti.textContent = !a || a.sorgu.length < 2 ? "" : n ? (a.secili >= 0 ? `${a.secili + 1} / ${n}` : `${n} sonuç`) : a.suruyor ? "Aranıyor" : "Sonuç yok";
  if (D.aramaOnceki) { D.aramaOnceki.disabled = !n; D.aramaSonraki.disabled = !n; }
}
function sonucaGit(yon, mutlak = null) {
  const a = D.arama;
  if (!a || !a.sonuclar.length) return;
  a.secili = mutlak ?? (a.secili < 0 ? (yon > 0 ? 0 : a.sonuclar.length - 1) : (a.secili + yon + a.sonuclar.length) % a.sonuclar.length);
  aramaDurumu();
  const r = a.sonuclar[a.secili];
  if (dar()) panelDegistir("sag", false);
  else if (!D.panelSag.hidden && D.sekme === "arama") D.sagGovde?.querySelectorAll(".dizin-satir").forEach((s, i) => s.classList.toggle("secili-sonuc", i === a.secili));
  hedefeGit(r.S, r.kutu);
}

// =====================================================================
// PANELLER (3.22)
// =====================================================================
function panelDegistir(taraf, ac = null, sekme = null) {
  const el = taraf === "sol" ? D.panelSol : D.panelSag, dugme = taraf === "sol" ? D.ust.sayfalar : D.ust.notlar;
  const acik = !el.hidden;
  if (ac === null) ac = !acik || (sekme && sekme !== D.sekme);
  if (sekme) D.sekme = sekme;
  // Dar ekranda ve iki panelle masanın kenar alanı açık sayfayı %60'ta bile sığdıramadığı genişlikte paneller tek tek açılır
  if (ac && (dar() || !ikiPanelSigar())) {
    const diger = taraf === "sol" ? D.panelSag : D.panelSol;
    if (!diger.hidden) { diger.hidden = true; (taraf === "sol" ? D.ust.notlar : D.ust.sayfalar).setAttribute("aria-pressed", "false"); }
  }
  // Notlar asistanın yerine açılır: ikisi üst üste binmez, asistan kapanır (konuşması panelde durur)
  if (ac && taraf === "sag" && document.querySelector(".asistan.acik")) bus.emit("asistan:kapat");
  if (ac === acik) { if (ac) (taraf === "sol" ? solPanelCiz : sagPanelCiz)(); return; }
  el.hidden = !ac;
  dugme.setAttribute("aria-pressed", String(ac));
  if (ac) {
    (taraf === "sol" ? solPanelCiz : sagPanelCiz)();
    if (!hareketAz()) animasyonBitince(el, "giriyor", 260);
  }
  D.perde.hidden = !(dar() && (!D.panelSol.hidden || !D.panelSag.hidden));
  balonKapat(true);
  if (!dar()) sigdirGerekirse(true);
}

// Sağ paneli ölçeğe dokunmadan kapatır: çağıran (asistanYeri) yeni genişliğe kendisi sığdırır
function sagPaneliKapat() {
  D.panelSag.hidden = true;
  D.ust.notlar?.setAttribute("aria-pressed", "false");
  D.perde.hidden = !(dar() && !D.panelSol.hidden);
}

function ikiPanelSigar() {
  const cs = getComputedStyle(D.kok);
  const sol = parseFloat(cs.getPropertyValue("--sol-panel")) || 216, sag = parseFloat(cs.getPropertyValue("--sag-panel-gen")) || 340;
  return D.kok.clientWidth - sol - sag >= Math.ceil(TW * 0.6) + 112;
}

// ---------- sol panel: küçük resimler ----------
function solPanelCiz() {
  const liste = h("div", { class: "kucuk-resimler" });
  // Küçük resimler tembel: yalnız panelde görünenler (ve yakınları) çizilir, uzaklaşan bırakılır
  D.kucukIo?.disconnect();
  D.kucukIo = new IntersectionObserver((girdiler) => {
    if (!D) return;
    for (const g of girdiler) {
      const S = D.sayfalar.find((x) => x.kucukBtn === g.target);
      if (!S) continue;
      S.kucukGorunur = g.isIntersecting;
      if (g.isIntersecting) { S.kucukDeneme = 0; if (S.kucukKirli || !S.kucukCv.width) kucukResimCiz(S); }
      else {
        if (S.kucukTampon) { D.pdf?.iptal(S.kucukTampon); S.kucukTampon = null; }
        S.kucukCv.width = S.kucukCv.height = 0; S.kucukKirli = true;
      }
    }
  }, { root: liste, rootMargin: "400px 0px" });
  D.sayfalar.forEach((S, i) => { liste.append(kucukResimKur(S, i)); D.kucukIo.observe(S.kucukBtn); });
  liste.append(h("button", { class: "sayfa-ekle", onclick: (e) => yelpazeAc(e.currentTarget, D.sayfalar.length) }, icon("arti"), "Sayfa ekle"));
  D.panelSol.replaceChildren(h("div", { class: "panel-baslik" }, h("h2", {}, "Sayfalar"),
    h("button", { class: "ikon-dugme", "aria-label": "Sayfalar panelini kapat", onclick: () => panelDegistir("sol", false) }, icon("kapat"))), liste);
  const secili = D.sayfalar[D.gecerli]?.kucukBtn;
  if (secili) requestAnimationFrame(() => secili.scrollIntoView({ block: "nearest" }));
}
function kucukResimKur(S, i) {
  // Boyut CSS'te en-boy oranıyla: çizilmemiş küçük resim bellek tutmaz ama yerini tutar
  S.kucukCv = h("canvas", { width: 0, height: 0, style: `aspect-ratio: ${PW} / ${S.h}` });
  S.kucukGorunur = false;
  S.kucukKirli = true;
  S.kucukBtn = h("button", { class: "kucuk-resim" + (S.veri.yerImi ? " yer-imli" : ""), "aria-label": `Sayfa ${etiketNo(i)}`, "aria-current": i === D.gecerli ? "page" : null,
    onclick: () => {
      if (S.kucukSurukledi) { S.kucukSurukledi = false; return; }   // sürükleme bitince gelen tıklama sayfaya gitmez
      sayfayaGit(D.sayfalar.indexOf(S)); if (dar()) panelDegistir("sol", false);
    } }, S.kucukCv, h("span", {}, String(etiketNo(i))));
  const menu = h("button", { class: "kucuk-menu", "aria-label": `Sayfa ${etiketNo(i)} menüsü`, "aria-haspopup": "menu",
    onclick: (e) => { e.stopPropagation(); sayfaMenusuAc(e.currentTarget, D.sayfalar.indexOf(S)); } }, icon("daha"));
  S.kucukKap = h("div", { class: "kucuk-oge" + (S.veri.tur === "kagit" ? " tasinir" : ""), "data-id": S.veri.id }, S.kucukBtn, menu);
  kucukSurukleKur(S);
  return S.kucukKap;
}
let geciciTuval = null;
async function kucukResimCiz(S) {
  const cv = S.kucukCv;
  if (!cv) return;
  S.kucukKirli = false;
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = 136, o = (w / PW) * dpr, renk = sayfaRengi();
  let zemin = null;
  if (pdfSayfaMi(S)) {
    // Gerçek sayfa düşük çözünürlükte; ayrı tamponda çizilir ki iptal edilen yarım kalmasın
    // Sırayla, tek tek: ana sayfaların çizimini bekletmesin; sırası gelince görünmüyorsa atlanır
    const d = D, t = document.createElement("canvas");
    S.kucukTampon = t;
    const is = (d.kucukZincir || Promise.resolve()).then(() =>
      D === d && S.kucukTampon === t && S.kucukGorunur && !kalemYaziyor() ? d.pdf.ciz(S.veri.pdf, t, (w * dpr) / d.pdf.boyut(S.veri.pdf).w, { bekle: kalemYaziyor }) : false);
    d.kucukZincir = is.catch(() => false);
    const tamam = await is.catch(() => false);
    if (D !== d || S.kucukTampon !== t || !S.kucukGorunur || S.kucukCv !== cv) return;
    // Kalem yazarken atlanan ya da yarıda kalan küçük resim sonra yeniden denenir (yoksa panelde boş kalıyordu)
    if (!tamam) { S.kucukKirli = true; if ((S.kucukDeneme = (S.kucukDeneme || 0) + 1) <= 6) kucukResimPlanla(); return; }
    S.kucukDeneme = 0;
    zemin = t;
  }
  cv.width = Math.round(w * dpr); cv.height = Math.round(((w * S.h) / PW) * dpr);
  const ctx = cv.getContext("2d");
  if (zemin) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(zemin, 0, 0, cv.width, cv.height);
    renkPisir(ctx, renk);
    zemin.width = zemin.height = 0;
    ctx.setTransform(o, 0, 0, o, 0, 0);
  } else {
    ctx.setTransform(o, 0, 0, o, 0, 0);
    sayfaIcerikCiz(ctx, S.veri, renk);
  }
  gorselleriBoya(ctx, S.veri);
  if (S.veri.cizgiler.length) {
    geciciTuval ||= document.createElement("canvas");
    geciciTuval.width = cv.width; geciciTuval.height = cv.height;
    hepsiniCiz(geciciTuval.getContext("2d"), S.veri.cizgiler, o, { koyuSayfa: renk === "koyu" });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = renk === "koyu" ? "screen" : "multiply";   // ekrandaki karışımla aynı
    ctx.drawImage(geciciTuval, 0, 0);
    ctx.restore();
  }
  // Bantlar ve notlar küçük resimde düz dikdörtgen olarak görünür
  ctx.save();
  for (const b of S.veri.bantlar) { ctx.globalAlpha = b.acik ? 0.18 : 0.9; ctx.fillStyle = { murekkep: "#34507E", bordo: "#84323F", hardal: "#C9A048", adacayi: "#87A08A" }[b.desen] || "#34507E"; ctx.fillRect(b.x, b.y, b.w, b.h); }
  ctx.globalAlpha = 1;
  for (const n of S.veri.notlar) { if (n.x > PW) continue; ctx.fillStyle = n.renk; const s = n.kucuk ? 44 / D.k : NOT_W; ctx.fillRect(n.x, n.y, s, s); }
  ctx.restore();
}
function kucukResimPlanla() {
  zamanIptal(D.kucukZ);
  D.kucukZ = zaman(() => {
    if (D.panelSol.hidden) return;
    if (kalemYaziyor()) { kucukResimPlanla(); return; }
    for (const S of D.sayfalar) if (S.kucukKirli && S.kucukGorunur && S.kucukBtn?.isConnected) kucukResimCiz(S);
  }, 450);
}

// ---------- sağ panel: Notlar, İzler, Kırpılanlar, Yer imleri, Arama ----------
const SEKMELER = [["notlar", "Notlar"], ["izler", "İzler"], ["kirpilanlar", "Kırpılanlar"], ["yerimleri", "Yer imleri"], ["arama", "Arama"]];
function sagPanelCiz() {
  const sekmeler = h("div", { class: "sekmeler", role: "tablist" }, ...SEKMELER.map(([id, ad]) =>
    h("button", { class: "sekme", role: "tab", "aria-selected": String(D.sekme === id), "data-sekme": id, onclick: () => { D.sekme = id; sagPanelCiz(); } }, ad)));
  D.sagGovde = h("div", { class: "panel-govde", role: "tabpanel" });
  D.panelSag.replaceChildren(sekmeler, D.sagGovde);
  sagGovdeCiz();
}
function sagPanelPlanla() {
  if (!D || D.panelSag.hidden || D.kirpintiYaziyor) return;
  zamanIptal(D.sagZ);
  D.sagZ = zaman(sagGovdeCiz, 300);
}
const folyo = (no) => h("span", { class: "folyo" }, "s. " + no);
function bos(ikon, baslik, aciklama) {
  return h("div", { class: "bos" + (ikon ? "" : " yalin") }, ikon ? icon(ikon) : null, h("h3", {}, baslik), aciklama ? h("p", {}, aciklama) : null);
}
function sagGovdeCiz() {
  if (!D || !D.sagGovde || D.panelSag.hidden) return;
  const g = D.sagGovde, st = g.scrollTop;
  D.izlerPanel?.kapat(); D.izlerPanel = null;
  g.replaceChildren();
  const s = D.sekme;
  // İzler sekmesi (OZELLIKLER-5): izler.js listesi panelin içine çizilir, kendi "belge:degisti" dinleyicisiyle tazelenir
  if (s === "izler") {
    const kap = h("div", { class: "izler-sekme" }), d = D;
    g.append(kap);
    import("./izler.js").then((m) => {
      if (D !== d || D.sagGovde !== g || D.sekme !== "izler" || !kap.isConnected) return;
      D.izlerPanel = m.izlerPaneli(kap, D.belge);
    }).catch((e) => console.warn("[duzenleyici] izler:", e));
    return;
  }
  if (s === "notlar") {
    const satirlar = [], sayfaNo = [];
    D.sayfalar.forEach((S, i) => {
      const ogeler = [...S.veri.notlar.map((n) => ({ n, y: n.y })), ...S.veri.metinler.filter((m) => m.tur !== "damga").map((m) => ({ m, y: m.y }))].sort((a, b) => a.y - b.y);
      for (const o of ogeler) {
        sayfaNo.push(etiketNo(i));
        if (o.n) {
          const n = o.n;
          satirlar.push(h("button", { class: "dizin-satir", onclick: () => panelHedef(S, { x: n.x, y: n.y, w: n.kucuk ? 44 / D.k : NOT_W, h: n.kucuk ? 44 / D.k : NOT_W }) },
            folyo(etiketNo(i)), h("span", { class: "el" }, h("i", { class: "renk-kare", style: `--n:${n.renk}` }), n.metin || "Boş not")));
        } else {
          const m = o.m, el = S.nesneler.querySelector(`.metin-kutusu[data-id="${m.id}"]`);
          satirlar.push(h("button", { class: "dizin-satir", onclick: () => panelHedef(S, { x: m.x, y: m.y, w: el ? el.offsetWidth / D.k : 160, h: el ? el.offsetHeight / D.k : m.fs * 1.5 }) },
            folyo(etiketNo(i)), h("span", { class: "duz" }, m.metin)));
        }
      }
    });
    if (!satirlar.length) g.append(bos(null, "Bu belgede henüz yapışkan not yok."));
    else {
      const a = sayfaNo[0], z = sayfaNo[sayfaNo.length - 1];
      g.append(h("div", { class: "dizin-ozet" }, `${satirlar.length} not · ` + (a === z ? `s. ${a}` : `s. ${a} ile ${z}`)), ...satirlar);
    }
  } else if (s === "kirpilanlar") {
    const liste = store.kirpintilar.filter((k) => k.belgeId === D.belge.id);
    if (!liste.length) g.append(bos("kirp", "Henüz kırpılmış bir şey yok.", "Kırp aracıyla sayfadan bir bölge seç."));
    else {
      g.append(h("div", { class: "dizin-ozet" }, `${liste.length} kırpıntı`));
      for (const k of liste) {
        // Uzun not kesilmesin: satır kaydıran, içeriğe göre uzayan alan
        const not = h("textarea", { class: "kirpinti-not", rows: "1", maxlength: "240", placeholder: "not ekle", "aria-label": "Kırpıntı notu" });
        not.value = k.not || "";
        not.addEventListener("focus", () => { D.kirpintiYaziyor = true; });
        not.addEventListener("input", () => { k.not = not.value; });
        not.addEventListener("blur", () => { D.kirpintiYaziyor = false; bus.emit("kirpintilar", { tur: "not", kirpinti: k }); });
        not.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); not.blur(); } });
        g.append(h("div", { class: "dizin-satir kirpinti-satir" }, folyo(k.sayfa),
          h("div", {}, h("button", { class: "satir-dugme", "aria-label": `Sayfa ${k.sayfa} kırpıntısına git`, onclick: () => {
            const S = k.bolge && D.sayfalar.find((x) => x.veri.id === k.bolge.sayfaId);
            if (S) panelHedef(S, { x: k.bolge.x0, y: k.bolge.y0, w: k.bolge.x1 - k.bolge.x0, h: k.bolge.y1 - k.bolge.y0 });
            else if (k.sayfa) { sayfayaGit(Math.min(Math.max(0, siraNo(k.sayfa)), D.sayfalar.length - 1)); if (dar()) panelDegistir("sag", false); }
          } }, h("img", { src: k.gorsel, alt: `${k.belgeAd}, sayfa ${k.sayfa} kırpıntısı` })), not)));
      }
    }
  } else if (s === "yerimleri") {
    const liste = D.sayfalar.map((S, i) => ({ S, i })).filter((x) => x.S.veri.yerImi);
    if (!liste.length) g.append(bos(null, "Henüz yer imi yok.", "Üst çubuktaki yer imi düğmesiyle bulunduğun sayfayı işaretle."));
    else {
      g.append(h("div", { class: "dizin-ozet" }, `${liste.length} yer imi`));
      for (const { S, i } of liste) {
        g.append(h("button", { class: "dizin-satir", onclick: () => { sayfayaGit(i); if (dar()) panelDegistir("sag", false); } },
          h("i", { class: "kurdele-isaret", "aria-hidden": "true" }), h("span", { class: "kilavuz" }, h("span", {}, sayfaBasligi(S)), h("b", {}, String(etiketNo(i))))));
      }
    }
  } else if (s === "arama") {
    const a = D.arama;
    if (!a || a.sorgu.length < 2) g.append(bos(null, "Aramak için üst çubuktaki büyüteci kullan."));
    else if (!a.sonuclar.length && a.suruyor) g.append(bos("ara", "Aranıyor", "Sayfalar sırayla okunuyor."));
    else if (!a.sonuclar.length) g.append(bos("ara", `“${a.sorgu}” için sonuç yok.`, "Başka bir kelime dene."));
    else {
      g.append(h("div", { class: "dizin-ozet" }, `“${a.sorgu}” için ${a.sonuclar.length} sonuç` + (a.suruyor ? ", aranıyor" : "")));
      // Çok sonuçta liste ilk 400 satırla sınırlı (önceki/sonraki düğmeleri hepsini gezer)
      a.sonuclar.slice(0, 400).forEach((r, i) => {
        const once = r.metin.slice(Math.max(0, r.i - 40), r.i), es = r.metin.slice(r.i, r.i + r.n), sonra = r.metin.slice(r.i + r.n) + (r.ek ? " " + r.ek : "");
        g.append(h("button", { class: "dizin-satir" + (i === a.secili ? " secili-sonuc" : ""), onclick: () => sonucaGit(0, i) }, folyo(etiketNo(r.si)),
          h("span", {}, h("span", { class: "tur-etiket" }, r.tur), h("span", { class: "baglam-iki" }, (r.i > 40 ? "…" : "") + once, h("mark", { class: "eslesme" }, es), sonra))));
      });
    }
  }
  g.scrollTop = st;
}
function panelHedef(S, r) {
  if (dar()) panelDegistir("sag", false);
  hedefeGit(S, r);
}
function sayfaBasligi(S) {
  if (S.veri.tur === "pdf" && D.pdf) return "Sayfa " + etiketNo(D.sayfalar.indexOf(S));
  if (S.veri.tur === "pdf") {
    const m = sayfaMetinleri(S.veri.pdf), b = m.find((r) => r.boyut >= 26);
    return b ? b.t.replace(/\s{2,}/g, " ") : "Sayfa";
  }
  return KAGIT_ADI[S.veri.kagit] || "Sayfa";
}

// =====================================================================
// İLK KULLANIM İPUÇLARI (3.25)
// =====================================================================
function ilkIpucuKenar() {
  if (ipucuGosterildi("kenar") || D.okuma || D.belge.tur === "defter") return;
  const S = D.sayfalar[Math.max(0, D.gecerli)];
  // Kenar zaten açıksa ipucu boşuna: kullanıcı alanı görüyor (bir sonraki kapalı kenarda gösterilir)
  if (!S || S.veri.kenar) return;
  ipucuIsaretle("kenar");
  const k = D.k, kr = S.kap.getBoundingClientRect(), mr = D.masa.getBoundingClientRect();
  const tx = PW * k + 22, ty = 96 * k + 32;
  const sagda = kr.left + tx + 40 + 180 < mr.right - 8;
  const el = h("div", { class: "ilk-ipucu", role: "note" }, "Kenar notu alanını aç");
  S.kap.append(el);
  if (sagda) {
    el.style.left = tx + 40 + "px";
    el.style.top = ty - 18 + "px";
    el.append(svgDen('<svg width="40" height="24" style="left:-38px;top:8px" aria-hidden="true"><path d="M36 14C26 6 14 6 4 12M4 12l7-5M4 12l8 2"/></svg>'));
  } else {
    // Sağda yer yoksa ipucu sayfanın üst boşluğuna, sekmenin sol üstüne konur (gövde metnini örtmez);
    // üst bilgi satırına (57 birim) değmesin diye küçük ölçekte masaya taşar. Ok aşağı, sekmeye iner.
    const w = el.offsetWidth, hh = el.offsetHeight, x0 = tx - w - 26, y0 = Math.min(6, 57 * k - 16 - hh);
    el.style.left = x0 + "px";
    el.style.top = y0 + "px";
    const H = Math.max(24, Math.round(ty - y0 - hh + 10));
    el.append(svgDen(`<svg width="40" height="${H}" style="left:${w - 10}px;top:${hh - 6}px" aria-hidden="true"><path d="M4 4C6 ${H * 0.5} 18 ${H - 10} 34 ${H - 4}M34 ${H - 4}l-8-1M34 ${H - 4}l-4-7"/></svg>`));
  }
  const kapat = () => ilkIpucuKapat("kenar");
  el.addEventListener("click", kapat);
  D.ilkIpucu = { ad: "kenar", el };
  zaman(kapat, 9000);
}
function ilkIpucuArac(b) {
  if (!b || ipucuGosterildi("arac")) return;
  ilkIpucuKapat();
  ipucuIsaretle("arac");
  const mk = D.masaKap.getBoundingClientRect(), r = b.getBoundingClientRect(), cr = D.aracCubugu.getBoundingClientRect();
  const el = h("div", { class: "ilk-ipucu", role: "note" }, "Ayarlar için araca tekrar dokun");
  D.masaKap.append(el);
  const w = el.offsetWidth;
  if (A.konum === "ust") {
    el.style.left = sinirla(r.left - mk.left + r.width / 2 - 24, 12, mk.width - w - 12) + "px";
    el.style.top = cr.bottom - mk.top + 30 + "px";
    el.append(svgDen('<svg width="30" height="30" style="left:14px;top:-28px" aria-hidden="true"><path d="M12 28C8 20 9 10 14 2M14 2l-6 5M14 2l3 7"/></svg>'));
  } else {
    el.style.left = sinirla(r.left - mk.left + r.width / 2 - 24, 12, mk.width - w - 12) + "px";
    el.style.top = (A.konum === "alt" ? cr.top - mk.top - 90 : r.top - mk.top + 50) + "px";
  }
  el.addEventListener("click", () => ilkIpucuKapat("arac"));
  D.ilkIpucu = { ad: "arac", el };
  zaman(() => ilkIpucuKapat("arac"), 7000);
}
function ilkIpucuKapat(ad) {
  const ip = D?.ilkIpucu;
  if (!ip || (ad && ip.ad !== ad)) return;
  D.ilkIpucu = null;
  if (hareketAz()) { ip.el.remove(); return; }
  ip.el.classList.add("gidiyor");
  setTimeout(() => ip.el.remove(), 170);
}

// =====================================================================
// KLAVYE (OZELLIKLER, dokunma ve kalem modeli 5)
// =====================================================================
function onKey(e) {
  if (!D || !D.kap.isConnected) return;
  const t = e.target;
  const ctrl = e.ctrlKey || e.metaKey, tus = e.key.length === 1 ? trKucuk(e.key) : e.key;
  if (yaziAlani(t)) {
    if (e.key === "Escape") t.blur();
    return;
  }
  if (ctrl && !e.altKey) {
    if (tus === "z" && !e.shiftKey) { e.preventDefault(); geriAl(); }
    else if (tus === "y" || (tus === "z" && e.shiftKey)) { e.preventDefault(); yinele(); }
    else if (tus === "f") { e.preventDefault(); aramaAc(); }
    else if (tus === "0") { e.preventDefault(); sigdir(); }
    return;
  }
  if (e.altKey) return;
  if (tus === "[" || tus === "]") { e.preventDefault(); izeAtla(tus === "]" ? 1 : -1); return; }
  if ((tus === " " || tus === "Enter") && t.closest?.("button, a, [role=button], [role=switch]")) return;
  const kaydir = (dy) => { e.preventDefault(); kaydirAnim(D.masa.scrollTop + dy, D.masa.scrollLeft, 220); };
  switch (tus) {
    case "p": {
      const i = A.etkin.startsWith("kalem") ? (+A.etkin.slice(5) + 1) % 3 : A.sonKalem;
      return aracSec("kalem" + i, true);
    }
    case "h": return aracSec("fosforlu", true);
    case "e": return aracSec("silgi", true);
    case "l": return aracSec("kement", true);
    case "t": return aracSec("metin", true);
    case "n": return aracSec("not", true);
    case "s": return aracSec("damga", true);
    case "Escape":
      if (D.balon) return balonKapat();
      if (D.fis) return fisKapat();
      if (D.secim || D.nesneSecim) { secimKaldir(); return nesneSecimKaldir(); }
      if (D.aramaAcik) return aramaKapat();
      if (D.mod === "koltuk") return koltukCubuk(false);
      if (D.okuma) return okumaModu(false);
      return;
    case "Delete": case "Backspace": if (D.secim) { e.preventDefault(); secimSil(); } return;
    case "PageDown": case " ": return kaydir(ekranAdimi());
    case "PageUp": return kaydir(-ekranAdimi());
    case "ArrowDown": return kaydir(80);
    case "ArrowUp": return kaydir(-80);
    case "Home": e.preventDefault(); return sayfayaGit(0);
    case "End": e.preventDefault(); return sayfayaGit(D.sayfalar.length - 1);
  }
}

// =====================================================================
// 2. TUR (TASARIM-2 bölüm 5): Koltuk | Masa, Sor, asistan notu, bant → kart, yan yana
// =====================================================================

// ---------- mod anahtarı ve yerinde geçiş (5.1) ----------
function modAnahtariKur() {
  const dugme = (mod, ad, ikon) => h("button", { type: "button", "data-mod": mod, "aria-pressed": String(D.mod === mod), "aria-label": ad, title: ad,
    onclick: () => modSec(mod) }, icon(ikon), h("span", {}, ad));
  return h("div", { class: "mod-anahtari", role: "group", "aria-label": "Okuma ya da çalışma modu", "data-mod": D.mod },
    dugme("koltuk", "Koltuk", "koltuk"), dugme("masa", "Masa", "masa"));
}
function modAnahtariGuncelle() {
  const el = D.modAnahtari;
  if (!el) return;
  el.dataset.mod = D.mod;
  el.querySelectorAll("button[data-mod]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mod === D.mod)));
}

// Koltuk ile Masa arasında belge kapanıp açılmaz, sayfa yerinde kalır (kabul 10).
// app.js "git" olayında aynı belge için bunu çağırır.
export function modDegistir(yeni) {
  if (!D && yukleme?.no === acilisNo && (yeni === "koltuk" || yeni === "masa")) { yukleme.mod = yukleme.belge.mod = yeni; return; }
  if (!D || D.gomulu || (yeni !== "koltuk" && yeni !== "masa") || D.mod === yeni) return;
  D.belge.mod = yeni;
  if (yeni === "koltuk") koltukGir(true);
  else koltukCik();
}
// Anahtardan: önce yerinde geçilir (gecikmesiz), sonra kabuk adresi ve durumu eşlesin diye haber verilir
function modSec(yeni) {
  if (!D || D.mod === yeni) return;
  modDegistir(yeni);
  if (!D.gomulu) bus.emit("git", { ekran: "belge", belgeId: D.belge.id, mod: yeni });
}

// koltuk.js başka geliştiricinin; yoksa ya da hata verirse PDF koltuğu masanın kendi çubuğuyla çalışır
let koltukModul;   // undefined: denenmedi, null: yok
async function koltukYukle() {
  if (koltukModul !== undefined) return koltukModul;
  try {
    const m = await import("./koltuk.js");
    koltukModul = typeof m.koltukKur === "function" ? m : null;
  } catch { koltukModul = null; }
  return koltukModul;
}

function koltukGir(anim) {
  D.mod = "koltuk";
  D.kok.dataset.mod = "koltuk";
  yanYanaKapat();
  okumaModu(true);
  modAnahtariGuncelle();
  bekciPlanla();
  // Geçişte masanın kenarları kararır (okuma modu lamba odağı), araç çubuğu aşağı çekilir: ikisi de CSS'te
  const d = D;
  koltukYukle().then((m) => {
    if (D !== d || D.mod !== "koltuk" || D.koltuk) return;
    if (!m) { if (anim) koltukCubuk(true); return; }
    try {
      D.koltuk = m.koltukKur(D.kok, koltukSecenekleri()) || null;
      if (D.koltuk) { D.kok.classList.add("koltuk-bagli"); if (anim) D.koltuk.cubuk?.(true); }
    } catch (hata) {
      console.warn("[kenar-notu] koltukKur çalışmadı, masanın çubuğu kullanılıyor:", hata);
      D.koltuk = null;
    }
  });
}
function koltukCik() {
  try { D.koltuk?.kalemKapat?.(); D.koltuk?.kapat?.(); } catch { /* boş */ }
  D.koltuk = null;
  zamanIptal(D.cubukZ);
  D.kok.classList.remove("koltuk-bagli", "cubuk-gorunur");
  kalemUcuKapat();
  D.mod = "masa";
  D.kok.dataset.mod = "masa";
  okumaModu(false);
  modAnahtariGuncelle();
  bekciPlanla();
}

// Dokunma bölgeleri 25 / 50 / 25 (TASARIM-2 4.1): kenarlar ekranın %85'i kadar kaydırır, orta çubukları açar
function koltukDokun(e) {
  const r = D.masaKap.getBoundingClientRect(), f = (e.clientX - r.left) / Math.max(1, r.width);
  if (f < 0.25) koltukCevir(-1);
  else if (f > 0.75) koltukCevir(1);
  else koltukCubuk();
}
function koltukCevir(yon) {
  const m = D.masa, dy = m.clientHeight * 0.85;
  if (yon > 0) koltukOlc(dy);
  kaydirAnim(m.scrollTop + yon * dy, m.scrollLeft, 320);
}
// Çubuklar 4 sn etkileşim olmazsa çekilir; odak çubuktaysa ya da fiş açıksa beklenir
function koltukCubuk(goster = !D.kok.classList.contains("cubuk-gorunur")) {
  if (D.koltuk?.cubuk) { D.koltuk.cubuk(goster); return; }
  zamanIptal(D.cubukZ);
  D.kok.classList.toggle("cubuk-gorunur", goster);
  if (goster) D.cubukZ = zaman(koltukCubukCek, 4000);
}
function koltukCubukCek() {
  if (!D) return;
  const odak = document.activeElement;
  const icerde = odak && odak !== document.body && D.kok.contains(odak) && !D.masa.contains(odak);
  if (D.fis || D.balon || icerde) { D.cubukZ = zaman(koltukCubukCek, 4000); return; }
  D.kok.classList.remove("cubuk-gorunur");
}

// Okuma hızı PDF'te sayfa birimindedir (koltuk.js, tur "pdf"): ekranın %85'i kaç sayfa ettiyse o
function koltukOlc(dy) {
  const S = D.sayfalar[Math.max(0, D.gecerli)];
  if (!D.koltuk?.sayfaBitti || !S) return;
  try { D.koltuk.sayfaBitti(dy / Math.max(1, S.kap.offsetHeight)); } catch { /* boş */ }
}
function koltukKonum() {
  const m = D.masa, i = Math.max(0, D.gecerli), S = D.sayfalar[i];
  const ic = S ? sinirla((m.scrollTop + m.clientHeight * 0.45 - S.kap.offsetTop) / Math.max(1, S.kap.offsetHeight), 0, 1) : 0;
  const toplam = toplamNo(), no = etiketNo(i);
  return { oran: sinirla((no - 1 + ic) / Math.max(1, toplam), 0, 1), sayfa: no, sayfaSayisi: toplam };
}
const oranSayfa = (oran) => { const t = toplamNo(); return sinirla(Math.floor(oran * t) + 1, 1, t); };
function koltukGit(oran) {
  const a = etiketNo(0), z = etiketNo(D.sayfalar.length - 1), hedef = oranSayfa(oran);
  if (hedef < a || hedef > z) bildir(`Prototipte bu belgenin s. ${a} ile ${z} arası açık.`);
  sayfayaGit(siraNo(sinirla(hedef, a, z)));
}
function koltukGuncelle() { try { D.koltuk?.guncelle?.(); } catch { /* boş */ } }
function koltukSecenekleri() {
  const ud = (ad, ikon, fn) => h("button", { class: "ikon-dugme", "aria-label": ad, title: ad, onclick: fn }, icon(ikon));
  const toplam = toplamNo();
  return {
    ad: D.belge.ad,
    tur: "pdf",   // defter de sayfa sayfa okunur: kalan süre sayfa hızından
    bolumler: [],
    // PDF'te bölüm yerine yer imleri cetvelde bordo çentik olur
    yerImleri: D.sayfalar.map((S, i) => (S.veri.yerImi ? (etiketNo(i) - 1) / toplam : null)).filter((x) => x != null),
    // İzler cetvelde mürekkep çentiği: yer (0..1), çentiğe dokununca o ize gidilir; önceki / sonraki iz okları
    izler: () => (D?.veri.izler || []).filter((iz) => iz?.sayfa && Array.isArray(iz.kutu))
      .map((iz) => ({ id: iz.id, oran: sinirla((iz.sayfa - 1 + iz.kutu[1] + iz.kutu[3] / 2) / toplamNo(), 0, 1) })),
    izeGit: (id) => { if (D) izeGit(D.veri.izler?.find((x) => x?.id === id)); },
    izAtla: (yon) => { if (D) izeAtla(yon); },
    konum: koltukKonum,
    git: koltukGit,
    etiket: (oran) => `s. ${oranSayfa(oran)} / ${toplamNo()}`,
    cevir: koltukCevir,
    modDegistir: modSec,
    geri: () => bus.emit("git", { ekran: "kitaplik" }),
    araclar: [ud("Sayfalar", "sayfalar", () => panelDegistir("sol"))],
    // Dokunma bölgeleri yalnız masada; bant, not ve rozet kendi dokunuşunu alır. Kalem sayfa çevirmez (yazar);
    // kalem havada görüldükten sonra 600 ms parmak da çevirmez (avuç içi)
    sahne: D.masaKap,
    dokunmaGecerli: (e) => e.pointerType !== "pen" && !(e.pointerType === "touch" && D && performance.now() - D.sonKalem < AVUC_MS)
      && !e.target.closest?.(".bant, .bant-kutu, .not, .metin-kutusu, .asistan-notu, .sayfa-menu, .ara-ekle, .kenar-tutamak"),
    kalemUcu: false,   // kalem doğrudan yazar: gizli kalem ucu düğmesi gerekmez
    mesgul: () => !!(D && (D.fis || D.balon || D.sayfaMenu || !D.panelSol.hidden || !D.panelSag.hidden)),
    // Gizli kalem açıkken S Pen son kalemle yazar (onDown)
    kalem: (acik) => { if (D) D.koltukKalem = !!acik; },
  };
}

// ---------- gizli kalem (TASARIM-2 4.9, PDF koltuğu) ----------
function kalemUcuGoster() {
  if (!D.kalemUcu) {
    D.kalemUcu = h("button", { type: "button", class: "masa-kalem-ucu", "aria-label": "Kalemle yaz", title: "Kalemle yaz", "aria-pressed": String(D.koltukKalem),
      onclick: () => kalemUcuDegistir() }, icon("kalem-ucu", "i-22"));
    D.kalemUcu.addEventListener("pointermove", (e) => { if (e.pointerType === "pen") kalemUcuGoster(); });
    D.kok.append(D.kalemUcu);
    void D.kalemUcu.offsetWidth;
  }
  D.kalemUcu.classList.add("gorunur");
  zamanIptal(D.kalemUcuZ);
  D.kalemUcuZ = zaman(() => { if (D?.kalemUcu && !D.koltukKalem) D.kalemUcu.classList.remove("gorunur"); }, 1500);
}
function kalemUcuDegistir(ac = !D.koltukKalem) {
  D.koltukKalem = ac;
  D.kalemUcu?.setAttribute("aria-pressed", String(ac));
  if (ac) bildir("Kalem açık: S Pen yazar, parmak kaydırır.");
  else zaman(() => D?.kalemUcu?.classList.remove("gorunur"), 1500);
}
function kalemUcuKapat() {
  D.koltukKalem = false;
  D.kalemUcu?.remove();
  D.kalemUcu = null;
}

// ---------- Sor ve ölçüm taraması (5.2, imza 9.2) ----------
let sonSor = null;   // son sorulan bölge: cevap notu kenarda onun hizasına düşer
function sorEt(S, kutu, el) {
  sayfaMenusuKapat();
  const no = etiketNo(D.sayfalar.indexOf(S)), d = D;
  // Görüntü her zaman açık kâğıtta üretilir: koyu sayfada da asistan formülü net okusun.
  // Gerçek PDF'te bölge ayrıca çizilir ve sayfanın metni de gider (metin alanı).
  const hazir = pdfSayfaMi(S)
    ? Promise.all([pdfZemin(S, bolgeOlcek(kutu)), D.pdf.metin(S.veri.pdf)])
      .then(([z, metin]) => ({ gorsel: bolgeGorseli(S.veri, kutu, null, z), metin }))
    : Promise.resolve({ gorsel: bolgeGorseli(S.veri, kutu) });
  sonSor = { belgeId: D.belge.id, sayfa: no, y: Math.max(0, kutu.y0) };
  const yolla = () => hazir.then(({ gorsel, metin }) => {
    if (D !== d) return;
    const veri = { gorsel, belgeId: d.belge.id, belgeAd: d.belge.ad, sayfa: no, kaynak: "masa" };
    if (metin) veri.metin = metin;
    bus.emit("sor", veri);
  });
  if (!el) { el = h("div", { class: "kirp-secim gecici" }); S.nesneler.append(el); dikdortgenEl({ el, a: [kutu.x0, kutu.y0], b: [kutu.x1, kutu.y1] }); }
  const kirpMi = el.classList.contains("kirp-secim");
  el.classList.add("olculuyor");
  const bitir = () => { if (kirpMi) el.remove(); else el.classList.remove("olculuyor"); };
  if (hareketAz()) { yolla(); zaman(bitir, 160); return; }
  const tarama = h("div", { class: "tarama", style: `--h:${el.getBoundingClientRect().height}px` });
  el.append(tarama);
  zaman(yolla, 200);          // panel 200 ms'de açılmaya başlar
  zaman(() => { tarama.remove(); bitir(); }, 400);
}

// Bölgenin görüntüsü (sayfa + mürekkep, açık kâğıtta). bant verilirse üstüne kapalı bant boyanır.
const BANT_BOYA = { murekkep: "#34507E", bordo: "#84323F", hardal: "#C9A048", adacayi: "#87A08A" };
const bolgeOlcek = (k) => Math.min(2, 1400 / Math.max(1, k.x1 - k.x0));
// zemin: gerçek PDF sayfasının açık kâğıtta çizilmiş hâli ({ cv, h }); yoksa örnek sayfa ya da şablon çizilir
function bolgeGorseli(veri, k, bant = null, zemin = null) {
  const w = Math.max(1, k.x1 - k.x0), hh = Math.max(1, k.y1 - k.y0), s = bolgeOlcek(k);
  const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(hh * s));
  const donustur = (g) => g.setTransform(s, 0, 0, s, -k.x0 * s, -k.y0 * s);
  const c = h("canvas", { width: W, height: H }), g = c.getContext("2d");
  g.fillStyle = "#FCFAF4";            // kenar alanının kâğıdı
  g.fillRect(0, 0, W, H);
  donustur(g);
  if (veri.tur === "pdf" && D?.pdf) {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, PW, zemin?.h || PH);
    if (zemin?.cv.width) g.drawImage(zemin.cv, 0, 0, PW, zemin.h);
  } else sayfaIcerikCiz(g, veri, "beyaz");
  gorselleriBoya(g, veri);
  const m = h("canvas", { width: W, height: H }), mg = m.getContext("2d");
  donustur(mg);
  for (const cz of veri.cizgiler) cizgiCiz(mg, cz, { koyuSayfa: false });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "multiply";   // ekrandaki karışımla aynı
  g.drawImage(m, 0, 0);
  g.globalCompositeOperation = "source-over";
  if (bant) { donustur(g); bantBoya(g, bant); }
  return c.toDataURL("image/png");
}
function bantBoya(g, b) {
  g.save();
  g.translate(b.x + b.w / 2, b.y + b.h / 2);
  g.rotate(((b.aci || 0) * Math.PI) / 180);
  g.translate(-b.w / 2, -b.h / 2);
  g.shadowColor = "#3C2A1440"; g.shadowBlur = 5; g.shadowOffsetY = 1.5;
  g.fillStyle = BANT_BOYA[b.desen] || BANT_BOYA.murekkep;
  g.fillRect(0, 0, b.w, b.h);
  g.shadowColor = "transparent";
  g.beginPath(); g.rect(0, 0, b.w, b.h); g.clip();
  if (b.desen === "bordo") {
    g.fillStyle = "#F6E7D8";
    for (let y = 5; y < b.h; y += 10) for (let x = 5; x < b.w; x += 10) { g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill(); }
  } else if (b.desen === "hardal") {
    g.fillStyle = "#FFFFFF33";
    for (let x = 0; x < b.w; x += 9) g.fillRect(x, 0, 3, b.h);
  } else if (b.desen === "adacayi") {
    g.fillStyle = "#FFFFFF30";
    for (let x = 0; x < b.w; x += 9) g.fillRect(x, 0, 1, b.h);
    for (let y = 0; y < b.h; y += 9) g.fillRect(0, y, b.w, 1);
  } else {
    g.strokeStyle = "#FFFFFF2E"; g.lineWidth = 5; g.beginPath();
    for (let t = -b.h; t < b.w + b.h; t += 12) { g.moveTo(t, b.h); g.lineTo(t + b.h, 0); }
    g.stroke();
  }
  g.restore();
}

// ---------- asistan notu kenarda (5.3) ----------
const ASISTAN_NOT_W = 224;
function asistanKaynakAdi(v) {
  const ad = (dizi, id) => dizi.find((x) => x.id === id)?.ad;
  if (v.kaynak && v.kaynak !== "masa" && v.kaynak !== "koltuk") return String(v.kaynak);   // asistan.js sağlayıcı adını yollar
  if (v.uygulama) return ad(YZ_UYGULAMALAR, v.uygulama) || v.uygulama;
  if (v.saglayici) return v.saglayici === "deneme" ? "Deneme" : ad(YZ_SAGLAYICILAR, v.saglayici) || v.saglayici;
  const yz = store.ayarlar.yz || {};
  if (yz.yol === "anahtar") return yz.saglayici === "deneme" ? "Deneme" : ad(YZ_SAGLAYICILAR, yz.saglayici) || "Asistan";
  return ad(YZ_UYGULAMALAR, yz.uygulama) || "Asistan";
}
const asistanNotuVerisi = (v, y) => ({ id: yeniId("m"), tur: "asistan", x: PW + 26, y: Math.round(y), w: ASISTAN_NOT_W, fs: 15, renk: "#22201D",
  metin: String(v.metin).trim(), kaynak: asistanKaynakAdi(v), soru: v.soru || "", zaman: v.zaman || Date.now() });

// $...$ içi eğik yazı (kütüphane yok); sık LaTeX komutları ve kısa üs / alt indis okunur hale gelir
const LATEX = { cdot: "·", times: "×", le: "≤", ge: "≥", leq: "≤", geq: "≥", ne: "≠", neq: "≠", approx: "≈", pm: "±", to: "→", infty: "∞",
  pi: "π", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", theta: "θ", lambda: "λ", mu: "μ", sigma: "σ", omega: "ω",
  sqrt: "√", int: "∫", sum: "Σ", partial: "∂", cdots: "⋯", ldots: "…", left: "", right: "" };
const UST = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", n: "ⁿ", "-": "⁻", "+": "⁺" };
const ALT = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", n: "ₙ", i: "ᵢ" };
const harfle = (s, tablo, t) => ([...s].every((c) => tablo[c]) ? [...s].map((c) => tablo[c]).join("") : t);
const formulYaz = (f) => f
  .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
  .replace(/\\([A-Za-z]+)\s?/g, (t, ad) => LATEX[ad] ?? ad)
  .replace(/\^\{?([0-9n+-]{1,3})\}?/g, (t, u) => harfle(u, UST, t))
  .replace(/_\{?([0-9ni]{1,2})\}?/g, (t, a) => harfle(a, ALT, t))
  .replace(/[{}]/g, "");
function formulluMetin(metin) {
  const parca = [], re = /\$([^$\n]+)\$/g;
  let son = 0, r;
  while ((r = re.exec(metin))) {
    if (r.index > son) parca.push(metin.slice(son, r.index));
    parca.push(h("span", { class: "formul" }, formulYaz(r[1])));
    son = re.lastIndex;
  }
  if (son < metin.length) parca.push(metin.slice(son));
  return parca;
}
function asistanNotuEl(m) {
  const t = new Date(m.zaman || Date.now()), iki = (n) => String(n).padStart(2, "0");
  const tarih = `${iki(t.getDate())}.${iki(t.getMonth() + 1)}`;
  const etk = ["Asistan", m.kaynak, tarih].filter(Boolean).join(" · ").toLocaleUpperCase("tr");
  return h("div", { class: "asistan-notu", "data-id": m.id, role: "note", "aria-label": "Asistan notu, " + (m.kaynak || ""),
    style: `--x:${m.x};--y:${m.y};--w:${m.w || ASISTAN_NOT_W}` },
  h("span", { class: "etiket" }, etk), h("div", { class: "asistan-metin" }, ...formulluMetin(m.metin)));
}
function asistanNotuSec(S, m, el) {
  if (D.nesneSecim?.el === el) { nesneSecimKaldir(); return; }
  nesneSecimKaldir();
  el.classList.add("secili");
  D.nesneSecim = { S, tur: "asistan", id: m.id, el };
  const govde = el.querySelector(".asistan-metin");
  const kopyala = h("button", { onclick: async () => {
    nesneSecimKaldir();
    bildir((await panoyaYaz(m.metin)) ? "Kopyalandı" : "Kopyalanamadı. Metni seçip kopyalayabilirsin.");
  } }, "Kopyala");
  const uzun = el.classList.contains("acik") || govde.scrollHeight > govde.clientHeight + 2;
  const tamami = uzun ? h("button", { onclick: () => { el.classList.toggle("acik"); nesneSecimKaldir(); } }, el.classList.contains("acik") ? "Kısalt" : "Tamamı") : null;
  // Karta çevir: ön yüz soru, arka yüz cevap; bir kez (kart silinince yeniden çevrilebilir)
  const kartVar = !!m.kartId && store.kartlar.some((k) => k.id === m.kartId);
  const karta = h("button", { disabled: kartVar, onclick: () => {
    nesneSecimKaldir();
    const no = etiketNo(D.sayfalar.indexOf(S));
    const k = kartEkle({ tur: "soru", on: { metin: m.soru || `s. ${no} için asistan notu` }, arka: { metin: m.metin }, belgeId: D.belge.id, belgeAd: D.belge.ad, sayfa: no });
    m.kartId = k.id;
    bus.emit("belge:degisti", { belgeId: D.belge.id });
    bildir("Karta çevrildi · Kutu I", { etiket: "Geri al", calistir: () => kartSil(k.id) });
  } }, kartVar ? "Tekrar'da" : "Karta çevir");
  D.sayfaMenu = sayfaMenusu(S, [kopyala, karta, tamami, silDugmesi("Sil", () => metinSil(S, m, el))].filter(Boolean), kutuPx(el, S), 8);
}
// Kenardaki öğelerle çakışmasın: üstündekilerin altına kayar
function kenarYeriAc(S, m, el) {
  const k = D.k, boy = el.offsetHeight / k + 12;
  const engeller = [...S.nesneler.children]
    .filter((x) => x !== el && x.matches(".not, .metin-kutusu, .asistan-notu"))
    .map((x) => ({ y0: x.offsetTop / k, y1: (x.offsetTop + x.offsetHeight) / k, x1: (x.offsetLeft + x.offsetWidth) / k }))
    .filter((b) => b.x1 > PW + 10)
    .sort((a, b) => a.y0 - b.y0);
  let y = m.y;
  for (const b of engeller) if (y < b.y1 + 8 && y + boy > b.y0) y = b.y1 + 12;
  m.y = Math.round(sinirla(y, 8, Math.max(8, S.h - 60)));
  el.style.setProperty("--y", m.y);
}
function asistanNotuKoy(v) {
  const no = v.sayfa ?? etiketNo(Math.max(0, D.gecerli));
  const i = sinirla(siraNo(no), 0, D.sayfalar.length - 1), S = D.sayfalar[i];
  if (!S) return;
  const once = structuredClone(S.veri.metinler);
  let y = sonSor && sonSor.belgeId === D.belge.id && sonSor.sayfa === etiketNo(i) ? sonSor.y : null;
  if (y == null) {   // ekranda görünen yerin üst kısmı
    const mr = D.masa.getBoundingClientRect(), r = S.kap.getBoundingClientRect();
    y = sinirla((mr.top + mr.height * 0.3 - r.top) / D.k, 40, S.h - 200);
  }
  const m = asistanNotuVerisi(v, y);
  S.veri.metinler.push(m);
  const el = asistanNotuEl(m);
  S.nesneler.append(el);
  const acikti = !!S.veri.kenar;
  if (!acikti) kenarDegistir(S, true);   // kapalıysa TASARIM 6.1 animasyonuyla açılır
  kenarYeriAc(S, m, el);
  gecmisKaydet(S, { metinler: once }, { metinler: structuredClone(S.veri.metinler) });
  sayfaDegisti(S);
  if (!hareketAz()) animasyonBitince(el, "konuyor", 320);
  const r = { x: m.x, y: m.y, w: m.w, h: el.offsetHeight / D.k };
  zaman(() => { if (D) hedefeGit(S, r); }, acikti || hareketAz() ? 0 : 440);   // kalem halkası notun çevresini çizer
}
// "asistan:not" olayı: { belgeId, sayfa, metin }. Belge açık değilse notu verisine yazar.
export function asistanNotuAl(v) {
  if (!v || !v.metin || !v.belgeId) return;
  const yan = D?.yan;
  if (yan?.modul && yan.belgeId === v.belgeId) return yan.modul.asistanNotuAl(v);
  if (D && D.belge.id === v.belgeId) return asistanNotuKoy(v);
  const b = belgeBul(v.belgeId);
  if (!b || (b.tur !== "pdf" && b.tur !== "defter")) return;
  if (!b.veri || !Array.isArray(b.veri.sayfalar)) b.veri = veriHazirla(b);
  const i = sinirla((v.sayfa || 1) - (b.veri.ilkNo || 1), 0, b.veri.sayfalar.length - 1), s = b.veri.sayfalar[i];
  s.kenar = true;
  const onceki = s.metinler.filter((m) => m.tur === "asistan").length;
  s.metinler.push(asistanNotuVerisi(v, 96 + onceki * 180));
  bus.emit("belgeler", { tur: "not", id: b.id });
}

// ---------- bant → Tekrar kartı (5.4) ----------
const ROMA = ["", "I", "II", "III", "IV", "V"];
const silinenKartlar = new Map();   // bantId -> kart: geri alınan bant aynı kartla (kutusu, geçmişi) döner
const kartBul = (id) => (id ? store.kartlar.find((k) => k.id === id) : null);
function bantBul(id) {
  for (const S of D.sayfalar) { const b = S.veri.bantlar.find((x) => x.id === id); if (b) return { S, b }; }
  return null;
}
// Bantlar ile kartlar eşlenir: yeni banda kart, silinen bandın kartı silinir.
// b.kartYapildi: kart bir kez üretildi; Tekrar'dan silindiyse yeniden üretilmez (tanıtım bandı da bir kez).
function bantKartlariniEsle({ sessiz = false } = {}) {
  if (!D) return;
  const bekleyenKart = (D.bekleyenKart ||= new Set());   // ekrana ait: kapanınca bekleyen iş takılı kalmaz
  const varOlan = new Map();
  for (const S of D.sayfalar) for (const b of S.veri.bantlar) varOlan.set(b.id, { S, b });
  for (const k of [...store.kartlar]) {
    if (k.tur !== "bant" || k.belgeId !== D.belge.id || !k.bantId || varOlan.has(k.bantId)) continue;
    silinenKartlar.set(k.bantId, k);
    kartSil(k.id);
  }
  for (const { S, b } of varOlan.values()) {
    if (kartBul(b.kartId)) continue;
    const eski = silinenKartlar.get(b.id);
    if (eski) { silinenKartlar.delete(b.id); kartEkle({ ...eski }); bantRozetiTazele(b.id); continue; }
    if (b.kartYapildi || bekleyenKart.has(b.id)) continue;
    // Tekrar'ın örnek verisi aynı sayfa için bantsız bir kart ürettiyse o benimsenir: iki kart yan yana durmaz
    const no = etiketNo(D.sayfalar.indexOf(S));
    const ornek = store.kartlar.find((k) => k.tur === "bant" && !k.bantId && k.belgeId === D.belge.id && Number(k.sayfa) === no);
    if (ornek) {
      b.kartId = ornek.id;
      b.kartYapildi = true;
      kartGuncelle(ornek.id, { bantId: b.id, sayfaId: S.veri.id });
      bantRozetiTazele(b.id);
      const d = D;
      zaman(() => { if (D === d && bantBul(b.id)) bantKartiYap(S, b, false); }, 700);
      continue;
    }
    b.kartId ||= yeniId("t");
    bekleyenKart.add(b.id);
    const d = D;
    // Görüntü kalem kalktıktan sonra üretilir, yazarken kare düşmesin
    zaman(() => {
      bekleyenKart.delete(b.id);
      if (D !== d) return;
      const yer = bantBul(b.id);
      if (!yer || kartBul(yer.b.kartId)) return;
      yer.b.kartId ||= b.kartId;
      bantKartiYap(yer.S, yer.b, true);
      if (!sessiz) bildir("Tekrar'a eklendi · Kutu I", { etiket: "Tekrar'da aç", calistir: () => bus.emit("git", { ekran: "tekrar", kartId: yer.b.kartId }) });
    }, sessiz ? 700 : 260);
  }
}
function kartCercevesi(b, S) {
  // Ön yüzde bağlam görünsün: bandın üstünden biraz soru metni de alınır
  // Yatayda yazı sütununun tamamı: satır başı kesilmesin (kart 5:3'e yakın dursun)
  const ust = sinirla(b.h * 0.6, 40, 160);
  return { x0: Math.max(0, Math.min(b.x - 20, 56)), y0: Math.max(0, b.y - ust),
    x1: Math.min(TW, Math.max(b.x + b.w + 20, PW - 56)), y1: Math.min(S.h, b.y + b.h + 20) };
}
function bantKartiYap(S, b, yeni) {
  const cer = kartCercevesi(b, S);
  // Gerçek PDF: sayfa önce açık kâğıtta çizilir. Beklerken bant bekleyenKart'ta durur (ikinci kez üretilmez);
  // kartYapildi ancak kart eklenince konur, yoksa belge bu arada kapanırsa kart hiç oluşmazdı.
  if (pdfSayfaMi(S)) {
    const d = D, bekleyen = (D.bekleyenKart ||= new Set());
    if (yeni) bekleyen.add(b.id);
    pdfZemin(S, bolgeOlcek(cer)).then((z) => {
      bekleyen.delete(b.id);
      if (D === d && bantBul(b.id) && !(yeni && kartBul(b.kartId))) bantKartiUret(S, b, yeni, cer, z);
    });
    return;
  }
  bantKartiUret(S, b, yeni, cer, null);
}
function bantKartiUret(S, b, yeni, cer, zemin) {
  const H = Math.max(1, cer.y1 - cer.y0);
  // bant, bantY, bantH: Tekrar'daki soyulan bant görüntüye çizilmiş bandın tam üstüne oturur
  const alan = { on: { gorsel: bolgeGorseli(S.veri, cer, b, zemin) }, arka: { gorsel: bolgeGorseli(S.veri, cer, null, zemin) },
    bant: b.desen, bantY: (b.y + b.h / 2 - cer.y0) / H, bantH: b.h / H,
    belgeId: D.belge.id, belgeAd: D.belge.ad, sayfa: etiketNo(D.sayfalar.indexOf(S)), bantId: b.id, sayfaId: S.veri.id };
  if (yeni) {
    kartEkle({ id: b.kartId, tur: "bant", ...alan });
    b.kartYapildi = true;
    bantRozetiTazele(b.id);
  } else kartGuncelle(b.kartId, alan);
}
// Sayfa değişince bandın kartındaki görüntü de tazelenir (1,5 sn sessizlikten sonra)
function kartTazelePlanla(S) {
  (D.tazeBekleyen ||= new Set()).add(S);
  zamanIptal(D.tazeZ);
  D.tazeZ = zaman(kartTazele, 1500);
}
function kartTazele() {
  if (!D?.tazeBekleyen) return;
  // Kalem havada geziniyorsa (son 3 sn'de olay geldi) yazar düşünüyordur: senkron görüntü üretimi inişi bekletmesin
  if (document.body.classList.contains("yaziyor") || performance.now() - D.sonKalem < 3000) { D.tazeZ = zaman(kartTazele, 1000); return; }
  for (const S of D.tazeBekleyen) for (const b of S.veri.bantlar) if (b.kartYapildi && kartBul(b.kartId)) bantKartiYap(S, b, false);
  D.tazeBekleyen.clear();
}
function kartTazelemeBitir() {
  if (!D?.tazeBekleyen?.size) return;
  zamanIptal(D.tazeZ);
  try { kartTazele(); } catch { /* boş */ }
}

// Bandın köşesinde kutuyu gösteren kâğıt etiket: "KART · I" (Plex Mono, kutu Roma rakamıyla)
function bantRozetiKoy(el, b) {
  const k = kartBul(b.kartId), eski = el.querySelector(".bant-kutu");
  if (!k) { eski?.remove(); return; }
  const roz = eski || h("button", { type: "button", class: "bant-kutu",
    onclick: (e) => { e.stopPropagation(); bantKartFisi(e.currentTarget, b.kartId); } });
  roz.textContent = "KART · " + (ROMA[k.kutu] || String(k.kutu));   // yerinde güncellenir: açık fiş çapasını kaybetmez
  roz.setAttribute("aria-label", `Tekrar kartı, kutu ${k.kutu}`);
  if (!eski) el.append(roz);
}
function bantRozetiTazele(bantId) {
  if (!D) return;
  const yer = bantBul(bantId);
  if (!yer) return;
  const el = yer.S.nesneler.querySelector(`.bant[data-id="${bantId}"]`);
  if (el) bantRozetiKoy(el, yer.b);
}
function kartlarDegisti(olay) {
  const k = olay?.kart;
  if (!D || !k || k.tur !== "bant" || k.belgeId !== D.belge.id || !k.bantId) return;
  bantRozetiTazele(k.bantId);
  if (D.fis?.el.classList.contains("bant-kart-fis")) fisKapat(true);
}
function bantKartFisi(acan, id) {
  const k = kartBul(id);
  if (!k) return;
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const gun = Math.ceil((k.sonraki - Date.now()) / (24 * 3600e3));
  const ne = gun <= 0 ? [" · bugün tekrarda"] : [" · ", h("b", {}, String(gun)), " gün sonra"];
  const fis = h("div", { class: "fis bant-kart-fis", role: "dialog", "aria-label": "Tekrar kartı" },
    h("p", { class: "olcum" }, "Kutu ", h("b", {}, ROMA[k.kutu] || String(k.kutu)), ...ne),
    h("button", { class: "metin-dugme vurgulu", onclick: () => { fisKapat(true); bus.emit("git", { ekran: "tekrar", kartId: id }); } }, icon("tekrar"), "Tekrar'da aç"));
  fisAc(fis, acan, "orta");
}

// ---------- yan yana: solda belge, sağda defter (5.5, basit sürüm) ----------
// Sağ bölme aynı modülün ikinci bir örneğidir: ayrı belgede (iframe) çalışır, sol masanın kalemine dokunmaz.
// Paylaşılan durum (belgeler, kartlar, kırpıntılar) aynı dizilerdir; olaylar iki yöne aktarılır.
const YAN_YANA_MEDYA = "(orientation: landscape) and (min-width: 1100px)";
const YAN_AKTAR = new Set(["sor", "kartlar", "kirpintilar", "ayarlar", "belgeler", "git", "belge:degisti"]);
const ayarSec = (a) => ({ tema: a.tema, sayfaRengi: a.sayfaRengi, parmaklaCiz: a.parmaklaCiz, sadeHareket: a.sadeHareket });

function yanYanaDegistir() { if (D.yan) yanYanaKapat(); else yanYanaAc(); }
function yanYanaAc(defterId = D.veri.yanDefter) {
  if (D.gomulu || D.mod === "koltuk" || D.yan) return;
  const defterler = store.belgeler.filter((b) => b.tur === "defter" && b.id !== D.belge.id);
  if (!defterler.length) { bildir("Yan yana açmak için kitaplıkta bir defter olmalı."); return; }
  let defter = belgeBul(defterId);
  if (!defter || defter.tur !== "defter" || defter.id === D.belge.id) {
    defter = defterler.find((b) => b.klasor && b.klasor === D.belge.klasor) || [...defterler].sort((a, b) => (b.acilis || 0) - (a.acilis || 0))[0];
  }
  D.veri.yanDefter = defter.id;
  panelDegistir("sol", false);
  panelDegistir("sag", false);
  const yan = (D.yan = { belgeId: defter.id, belge: defter, oran: sinirla(D.veri.yanOran || 0.6, 0.35, 0.75), modul: null, ortak: null, aktariyor: false, temizlik: [] });
  yan.cerceve = h("iframe", { class: "yan-cerceve", title: defter.ad });
  yan.mentese = h("div", { class: "mentese", role: "separator", "aria-orientation": "vertical", "aria-label": "Bölmeleri ayarla", tabindex: "0",
    "aria-valuemin": "35", "aria-valuemax": "75", "aria-valuenow": String(Math.round(yan.oran * 100)) }, h("span"));
  yan.bolme = h("section", { class: "yan-bolme", "aria-label": "Yan yana defter" },
    h("header", { class: "yan-ust" },
      h("button", { class: "defter-sec", "aria-haspopup": "menu", onclick: (e) => defterSecFisi(e.currentTarget) }, h("span", {}, defter.ad), icon("asagi")),
      h("button", { class: "ikon-dugme", "aria-label": "Yan yana görünümü kapat", title: "Kapat", onclick: () => yanYanaKapat() }, icon("kapat"))),
    h("div", { class: "yan-govde" }, yan.cerceve));
  D.calisma.style.setProperty("--sol", String(yan.oran));
  D.masaKap.after(yan.mentese, yan.bolme);
  D.calisma.classList.add("yan-yana");
  D.ust.yanYana?.setAttribute("aria-pressed", "true");
  menteseKur(yan);
  yanCerceveKur(yan);
}
function yanCerceveKur(yan) {
  const kok = document.documentElement;
  yan.kokEsle = (doc) => { for (const a of kok.attributes) doc.documentElement.setAttribute(a.name, a.value); };
  yan.ortakBagla = (o) => {
    yan.ortak = o;
    o.store.belgeler = store.belgeler;
    o.store.kartlar = store.kartlar;
    o.store.kirpintilar = store.kirpintilar;
    let kopya;
    try { kopya = structuredClone(store.ayarlar); } catch { kopya = JSON.parse(JSON.stringify(store.ayarlar)); }
    Object.assign(o.store.ayarlar, kopya);   // araç seçimi bölmeye özgü, kalemler aynı başlar
    o.setBildirimGosterici((m, e) => toast(m, e));
    const asil = o.bus.emit;
    o.bus.emit = (ad, v) => {
      asil.call(o.bus, ad, v);
      if (yan.aktariyor || !YAN_AKTAR.has(ad)) return;
      yan.aktariyor = true;
      try {
        if (ad === "ayarlar") { Object.assign(store.ayarlar, ayarSec(v)); bus.emit("ayarlar", store.ayarlar); }
        else bus.emit(ad, v);
      } finally { yan.aktariyor = false; }
    };
    for (const ad of ["ayarlar", "kartlar", "kirpintilar"]) {
      yan.temizlik.push(bus.on(ad, (v) => {
        if (yan.aktariyor) return;
        yan.aktariyor = true;
        try {
          if (ad === "ayarlar") { Object.assign(o.store.ayarlar, ayarSec(store.ayarlar)); asil.call(o.bus, ad, o.store.ayarlar); }
          else asil.call(o.bus, ad, v);
        } finally { yan.aktariyor = false; }
      }));
    }
  };
  yan.hazir = (m, kap) => {
    if (D?.yan !== yan) return;
    yan.modul = m;
    // Bölmenin pointerup ve input olayları ana belgeye ulaşmaz: otomatik kayıt buradan planlanır.
    // Bölmede yazarken "yaziyor" bölme öğesine yansır, kayıt modülünün mesgul denetimi onu da görür.
    const doc = yan.cerceve.contentDocument;
    if (doc) {
      const planla = () => { if (D?.yan === yan) bus.emit("belge:degisti", { belgeId: yan.belgeId }); };
      for (const t of ["pointerup", "input"]) doc.addEventListener(t, planla, { capture: true, passive: true });
      const yo = new MutationObserver(() => yan.bolme.classList.toggle("yaziyor", doc.body.classList.contains("yaziyor")));
      yo.observe(doc.body, { attributes: true, attributeFilter: ["class"] });
      yan.temizlik.push(() => yo.disconnect());
    }
    try { m.ac(kap, yan.belge, { gomulu: true }, "masa"); }
    catch (hata) { console.error("[kenar-notu] Yan defter açılamadı:", hata); bildir("Defter açılamadı."); }
  };
  // Tema ve sade hareket değişince bölmeye de geçer
  const mo = new MutationObserver(() => { const doc = yan.cerceve.contentDocument; if (doc?.documentElement) yan.kokEsle(doc); });
  mo.observe(kok, { attributes: true });
  yan.temizlik.push(() => mo.disconnect());
  window.__knYan = yan;
  const linkler = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join("");
  const sprite = document.querySelector("svg symbol")?.closest("svg")?.outerHTML || "";
  const bit = "</" + "script>";
  yan.cerceve.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${linkler}
<script>parent.__knYan && parent.__knYan.kokEsle(document);${bit}
<style>html,body{margin:0;height:100%;overflow:hidden}body{background:var(--desk)}#yan-kap{height:100%}</style></head>
<body>${sprite}<section class="ekran ekran-belge" id="yan-kap"></section>
<script type="module">
const p = parent.__knYan;
if (p) {
  const o = await import("./ortak.js");
  p.ortakBagla(o);
  const m = await import("./duzenleyici.js");
  p.hazir(m, document.getElementById("yan-kap"));
}
${bit}</body></html>`;
}
function yanYanaKapat() {
  const yan = D?.yan;
  if (!yan) return;
  D.yan = null;
  try { yan.modul?.kapat?.(); } catch (hata) { console.warn(hata); }
  for (const f of yan.temizlik) { try { f(); } catch { /* boş */ } }
  yan.mentese.remove();
  yan.bolme.remove();
  if (window.__knYan === yan) delete window.__knYan;
  D.calisma.classList.remove("yan-yana");
  D.calisma.style.removeProperty("--sol");
  D.ust.yanYana?.setAttribute("aria-pressed", "false");
}
// Menteşe: sürüklerken yalnız menteşe kayar (masa her karede yeniden sığdırılmaz), bırakınca oran uygulanır
function menteseKur(yan) {
  const m = yan.mentese;
  let j = null;
  m.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { m.setPointerCapture(e.pointerId); } catch { /* boş */ }
    j = { id: e.pointerId, r: D.calisma.getBoundingClientRect(), bas: yan.oran, oran: yan.oran };
    m.classList.add("suruklen");
  });
  m.addEventListener("pointermove", (e) => {
    if (!j || e.pointerId !== j.id) return;
    j.oran = sinirla((e.clientX - j.r.left) / Math.max(1, j.r.width), 0.35, 0.75);
    m.style.translate = `${((j.oran - j.bas) * j.r.width).toFixed(1)}px 0`;
  });
  const birak = (e) => {
    if (!j || e.pointerId !== j.id) return;
    const o = j.oran;
    j = null;
    m.classList.remove("suruklen");
    m.style.translate = "";
    yanOranUygula(yan, o);
  };
  m.addEventListener("pointerup", birak);
  m.addEventListener("pointercancel", birak);
  m.addEventListener("dblclick", () => yanOranUygula(yan, 0.6));
  m.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0;
    if (d) { e.preventDefault(); yanOranUygula(yan, yan.oran + d); }
  });
}
function yanOranUygula(yan, o) {
  if (D?.yan !== yan) return;
  yan.oran = sinirla(o, 0.35, 0.75);
  D.veri.yanOran = yan.oran;
  D.calisma.style.setProperty("--sol", String(yan.oran));
  yan.mentese.setAttribute("aria-valuenow", String(Math.round(yan.oran * 100)));
}
function defterSecFisi(acan) {
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const fis = h("div", { class: "fis defter-fis", role: "menu", "aria-label": "Defter seç" },
    ...store.belgeler.filter((b) => b.tur === "defter" && b.id !== D.belge.id).map((b) =>
      h("button", { class: "fis-satir", role: "menuitemradio", "aria-checked": String(b.id === D.yan?.belgeId),
        onclick: () => { fisKapat(true); if (b.id !== D.yan?.belgeId) { yanYanaKapat(); yanYanaAc(b.id); } } },
      h("i", { class: "kapak-nokta", style: `--kapak:${b.kapak || "#24324F"}` }), h("span", {}, b.ad))));
  fisAc(fis, acan, "orta");
}

// =====================================================================
// 4. TUR (OZELLIKLER-4 bölüm 4): sayfa yönetimi, görsel, damga, ses zamanı, arama ile açılış
// =====================================================================

// ---------- ortak: nesne öğesi ve stili ----------
function nesneElBul(S, id) {
  return S.nesneler.querySelector(`[data-id="${id}"]`) || S.gorselKatman.querySelector(`[data-id="${id}"]`);
}
function nesneStili(el, o) {
  el.style.setProperty("--x", o.x);
  el.style.setProperty("--y", o.y);
  if (o.tur === "damga") el.style.setProperty("--fs", o.fs);
  else if (o.w != null) { el.style.setProperty("--w", o.w); el.style.setProperty("--h", o.h); }
}

// ---------- sembol damgaları (4.3) ----------
// Veri: belge.veri.sayfalar[i].metinler içinde { id, tur: "damga", x, y, metin, fs, renk, t? }.
// x, y glifin sol üst köşesi (satır yüksekliği fs × 1,4, Literata); metin kutusu gibi dışa aktarılır ve aranır.
const damgaSonlar = () => {
  const son = (A.damga.son || []).slice(0, 8);
  for (const d of DAMGA_GRUPLARI[0][1]) { if (son.length >= 8) break; if (!son.includes(d)) son.push(d); }
  return son;
};
function damgaBoyut(m) {
  olcumCtx ||= (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas")).getContext("2d");
  olcumCtx.font = `400 ${m.fs || DAMGA_FS}px Literata, Georgia, serif`;
  return { w: Math.max(8, olcumCtx.measureText(m.metin || "").width), h: (m.fs || DAMGA_FS) * 1.4 };
}
function damgaEl(m) {
  const el = h("div", { class: "damga-nesne", "data-id": m.id, role: "img", "aria-label": "Damga " + m.metin }, m.metin);
  el.style.setProperty("--renk", renkSayfaya(m.renk));
  nesneStili(el, m);
  return el;
}
function damgaKoy(S, x, y) {
  const d = A.damga.secili || "∫", renk = A.kalemler[A.sonKalem].renk;
  const m = { id: yeniId("m"), tur: "damga", metin: d, fs: DAMGA_FS, renk, x: 0, y: 0 };
  const b = damgaBoyut(m), sinir = S.veri.kenar ? TW : PW;
  m.x = Math.round(sinirla(x - b.w / 2, 0, sinir - b.w));
  m.y = Math.round(sinirla(y - b.h / 2, 0, S.h - b.h));
  zamanla(m);
  const once = structuredClone(S.veri.metinler);
  S.veri.metinler.push(m);
  const el = damgaEl(m);
  S.nesneler.insertBefore(el, S.nesneler.querySelector(".bant, .not"));
  if (!hareketAz()) animasyonBitince(el, "konuyor", 200);
  gecmisKaydet(S, { metinler: once }, { metinler: structuredClone(S.veri.metinler) });
  A.damga.son = [d, ...(A.damga.son || []).filter((x) => x !== d)].slice(0, 8);
  baglamCiz();
  sayfaDegisti(S);
}
function damgaSec(S, m, el) {
  if (D.nesneSecim?.el === el) { nesneSecimKaldir(); return; }
  nesneSecimKaldir();
  el.classList.add("secili");
  D.nesneSecim = { S, tur: "damga", id: m.id, el };
  const boyut = (c) => () => {
    const once = structuredClone(S.veri.metinler);
    m.fs = Math.round(sinirla(m.fs * c, 12, 160));
    nesneStili(el, m);
    gecmisKaydet(S, { metinler: once }, { metinler: structuredClone(S.veri.metinler) });
    sayfaDegisti(S);
    nesneSecimKaldir();
    damgaSec(S, m, el);   // menü yeni boyuta göre yeniden konur
  };
  D.sayfaMenu = sayfaMenusu(S, [h("button", { onclick: boyut(0.8) }, "Küçült"), h("button", { onclick: boyut(1.25) }, "Büyüt"),
    silDugmesi("Sil", () => metinSil(S, m, el))], kutuPx(el, S), 8);
}
BALONLAR.damga = (b) => {
  const dugme = (d) => h("button", { class: "damga-karo", "aria-pressed": "false", "data-damga": d, "aria-label": "Damga " + d,
    onclick: () => { A.damga.secili = d; ayarDegisti(); balonKapat(); } }, d);
  const son = h("div", { class: "damga-izgara" }), sonEtiket = etiket("Son kullanılan");
  b.classList.add("damga-balon");
  b.append(baslikSatiri(h("h3", {}, "Damga")), sonEtiket, son,
    ...DAMGA_GRUPLARI.flatMap(([ad, liste]) => [etiket(ad), h("div", { class: "damga-izgara" }, ...liste.map(dugme))]),
    h("p", { class: "balon-not" }, "Seç, sonra sayfada dokunduğun yere düşer. Rengi son kalemden gelir."));
  return () => {
    // Son kullanılanlar varsayılanla (matematiğin ilk sekizi) aynıysa aşağıdaki Matematik satırının tekrarı: gizli
    const liste = damgaSonlar(), varsayilan = DAMGA_GRUPLARI[0][1].slice(0, liste.length);
    son.hidden = sonEtiket.hidden = liste.every((d, i) => d === varsayilan[i]);
    son.replaceChildren(...liste.map(dugme));
    b.querySelectorAll(".damga-karo").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.damga === A.damga.secili)));
  };
};

// ---------- görsel ve kamera (4.2) ----------
// Veri: belge.veri.sayfalar[i].gorseller = [{ id, ad, x, y, w, h, tur, pw, ph, t? }]. Kutu sayfa biriminde.
// Görüntü ek dosyada: kayit.js ekDosyaGetir(belge.id, ad) -> Blob (tur: "image/jpeg" ya da "image/png").
// Ek dosya API'si çalışmazsa yedek olarak src: dataURL tutulur (ad yok).
const gorselOnbellek = new Map();   // ad -> { url, nesneUrl, img, soz, belgeId }
function gorselKaynak(g) {
  const anahtar = g.ad || g.id;
  let k = gorselOnbellek.get(anahtar);
  if (k) return k;
  k = { url: null, nesneUrl: null, img: new Image(), belgeId: D.belge.id };
  k.soz = (async () => {
    let url = g.src || null;
    if (!url && g.ad) {
      const { ekDosyaGetir } = await import("./kayit.js");
      const blob = await ekDosyaGetir(k.belgeId, g.ad);
      // Bu arada belge kapandıysa girdi önbellekten çıktı: adres açılmaz, yoksa kimse bırakmazdı
      if (gorselOnbellek.get(anahtar) !== k) throw new Error("belge kapandı");
      if (blob) url = k.nesneUrl = URL.createObjectURL(blob);
    }
    if (!url) throw new Error("görsel bulunamadı");
    k.url = url;
    k.img.src = url;
    await k.img.decode().catch(() => {});
    if (D?.belge.id === k.belgeId) for (const S of D.sayfalar) if (S.veri.gorseller?.some((x) => (x.ad || x.id) === anahtar)) S.kucukKirli = true;
    return url;
  })();
  k.soz.catch(() => {});
  gorselOnbellek.set(anahtar, k);
  return k;
}
function gorselEl(S, g) {
  const img = h("img", { alt: "", draggable: "false", decoding: "async" });
  const el = h("div", { class: "gorsel-nesne", "data-id": g.id, role: "img", "aria-label": "Görsel" }, img);
  nesneStili(el, g);
  const k = gorselKaynak(g);
  if (k.url) img.src = k.url;
  else {
    el.classList.add("yukleniyor");
    k.soz.then((u) => { img.src = u; el.classList.remove("yukleniyor"); }, () => { el.classList.remove("yukleniyor"); el.classList.add("kayip"); });
  }
  return el;
}
// Küçük resim, Sor ve kart görüntüsü için: yüklenmiş görseller tuvale (ctx sayfa biriminde)
function gorselleriBoya(ctx, veri) {
  for (const g of veri.gorseller || []) {
    const img = gorselOnbellek.get(g.ad || g.id)?.img;
    if (img?.complete && img.naturalWidth) { try { ctx.drawImage(img, g.x, g.y, g.w, g.h); } catch { /* boş */ } }
  }
}
// Kırpma ekrandaki tuvalden alınır; görseller DOM'da durduğu için sayfa tuvalinin bir kopyasına basılır
function gorselliKopya(S, kaynak) {
  if (!kaynak?.width) return kaynak;
  const c = h("canvas", { width: kaynak.width, height: kaynak.height }), g = c.getContext("2d"), o = kaynak.width / PW;
  g.drawImage(kaynak, 0, 0);
  g.setTransform(o, 0, 0, o, 0, 0);
  gorselleriBoya(g, S.veri);
  return c;
}
function gorselFisi(acan) {
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const satir = (ikon, ad, aciklama, fn) => h("button", { class: "fis-satir", role: "menuitem", onclick: () => { fisKapat(true); fn(); } }, ikon, h("span", {}, ad), h("small", {}, aciklama));
  const fis = h("div", { class: "fis daha-menu gorsel-fis", role: "menu", "aria-label": "Görsel ekle" },
    etiket("Görsel ekle"),
    satir(ikonSec(["gorsel", "resim"], "▣", "i-20"), "Galeriden", "Fotoğraf ya da ekran görüntüsü", () => D.gorselGirdi.click()),
    satir(ikonSec(["kamera"], "◉", "i-20"), "Kamerayla çek", "Tahta, defter, kitap sayfası", () => D.kameraGirdi.click()));
  fisAc(fis, acan, A.konum === "alt" ? "ust" : "orta");
}
// Büyük fotoğraf 2048 px'e küçültülür ve JPEG olur; küçük PNG (ekran görüntüsü, saydam) olduğu gibi kalır.
// Telefonun döndürme bilgisi (EXIF) çizerken uygulanır: dışa aktarılan PDF'te de doğru durur.
async function gorselHazirla(file) {
  let kaynak, w, hh, birak = () => {};
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    kaynak = bmp; w = bmp.width; hh = bmp.height; birak = () => bmp.close();
  } catch {
    const url = URL.createObjectURL(file), img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); throw e; }
    kaynak = img; w = img.naturalWidth; hh = img.naturalHeight; birak = () => URL.revokeObjectURL(url);
  }
  if (!w || !hh) { birak(); throw new Error("boş görsel"); }
  const o = Math.min(1, 2048 / Math.max(w, hh));
  if (file.type === "image/png" && o === 1 && file.size < 3e6) { birak(); return { blob: file, w, h: hh, tur: "image/png" }; }
  const W = Math.max(1, Math.round(w * o)), H = Math.max(1, Math.round(hh * o));
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  c.imageSmoothingQuality = "high";
  c.drawImage(kaynak, 0, 0, W, H);
  birak();
  const blob = await new Promise((coz, red) => cv.toBlob((b) => (b ? coz(b) : red(new Error("toBlob"))), "image/jpeg", 0.86));
  cv.width = cv.height = 0;
  return { blob, w: W, h: H, tur: "image/jpeg" };
}
// Görsel 90 derece döner: pikseller yeni bir ek dosyaya döndürülmüş yazılır, kutu merkezinde en ve boy yer değiştirir.
// Böylece küçük resim, kart, dışa aktarım gibi bütün çizim yolları değişmeden doğru görüntüyü alır.
// Eski dosya belge kapanana kadar kalır (gorselleriBirak): geri alma eski adı geri getirir.
async function gorselDondur() {
  const s = D?.secim;
  if (!s?.gorsel.length) return;
  const d = D, S = s.S, ids = s.gorsel.slice(), once = structuredClone(S.veri.gorseller), yeniler = new Map();
  for (const id of ids) {
    const g = S.veri.gorseller.find((x) => x.id === id);
    if (!g) continue;
    try {
      const k = gorselKaynak(g);
      await k.soz;
      const img = k.img, w = img.naturalWidth, hh = img.naturalHeight;
      if (!w || !hh) throw new Error("boş görsel");
      const cv = document.createElement("canvas");
      cv.width = hh; cv.height = w;
      const c = cv.getContext("2d");
      c.translate(hh, 0); c.rotate(Math.PI / 2);
      c.drawImage(img, 0, 0);
      const png = g.tur === "image/png", tur = png ? "image/png" : "image/jpeg";
      const blob = await new Promise((coz, red) => cv.toBlob((b) => (b ? coz(b) : red(new Error("toBlob"))), tur, 0.9));
      cv.width = cv.height = 0;
      if (D !== d) return;
      const yeni = { pw: g.ph, ph: g.pw, w: g.h, h: g.w, x: Math.round((g.x + g.w / 2 - g.h / 2) * 10) / 10, y: Math.round((g.y + g.h / 2 - g.w / 2) * 10) / 10, tur };
      if (g.ad) {
        const ad = `gorsel-${yeniId("g")}.${png ? "png" : "jpg"}`;
        const { ekDosyaKaydet } = await import("./kayit.js");
        await ekDosyaKaydet(d.belge.id, ad, blob);
        const url = URL.createObjectURL(blob), kk = { url, nesneUrl: url, img: new Image(), belgeId: d.belge.id, soz: Promise.resolve(url) };
        kk.img.src = url;
        gorselOnbellek.set(ad, kk);
        yeni.ad = ad;
      } else { yeni.src = await blobDataURL(blob); yeni.id = yeniId("g"); }   // önbellek kimliğe bağlı: yeni kimlik, geri alma eskisini bulur
      yeniler.set(id, yeni);
    } catch (e) { console.warn("[duzenleyici] görsel döndürülemedi:", e); }
  }
  if (D !== d) return;
  if (!yeniler.size) { bildir("Görsel döndürülemedi."); return; }
  for (const g of S.veri.gorseller) if (yeniler.has(g.id)) Object.assign(g, yeniler.get(g.id));
  nesneleriCiz(S);
  gecmisKaydet(S, { gorseller: once }, { gorseller: structuredClone(S.veri.gorseller) });
  const secili = ids.map((id) => yeniler.get(id)?.id || id);
  secimKur(S, [], { gorsel: secili.filter((id) => S.veri.gorseller.some((g) => g.id === id)) });
  sayfaDegisti(S);
}
const blobDataURL = (b) => new Promise((coz, red) => { const r = new FileReader(); r.onload = () => coz(r.result); r.onerror = red; r.readAsDataURL(b); });
async function gorselleriEkle(dosyalar) {
  const liste = (dosyalar || []).filter((f) => /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|gif|bmp|heic|avif)$/i.test(f.name || ""));
  if (!liste.length) { if (dosyalar?.length) bildir("Bu dosya görsel değil."); return; }
  const d = D, S = D.sayfalar[Math.max(0, D.gecerli)];
  if (!S) return;
  const yeniler = [];
  for (const [n, f] of liste.entries()) {
    let hazir;
    try { hazir = await gorselHazirla(f); }
    catch (e) { console.warn("[duzenleyici] görsel:", e); if (D === d) bildir("Görsel açılamadı."); continue; }
    if (D !== d) return;
    const id = yeniId("g"), ad = `gorsel-${id}.${hazir.tur === "image/png" ? "png" : "jpg"}`;
    const g = { id, ad, x: 0, y: 0, w: 0, h: 0, tur: hazir.tur, pw: hazir.w, ph: hazir.h };
    try {
      const { ekDosyaKaydet } = await import("./kayit.js");
      await ekDosyaKaydet(d.belge.id, ad, hazir.blob);
      const url = URL.createObjectURL(hazir.blob), k = { url, nesneUrl: url, img: new Image(), belgeId: d.belge.id, soz: Promise.resolve(url) };
      k.img.src = url;
      gorselOnbellek.set(ad, k);
    } catch (e) {
      console.warn("[duzenleyici] ek dosya kaydedilemedi, görsel belge verisinde tutuluyor:", e);
      delete g.ad;
      g.src = await blobDataURL(hazir.blob);
    }
    if (D !== d) return;
    // Ekranda görünen yerin ortasına, sayfa genişliğinin en çok %60'ı kadar
    const mr = D.masa.getBoundingClientRect(), r = S.kap.getBoundingClientRect();
    let w = Math.min(480, Math.max(120, hazir.w / 2)), hh = (w * hazir.h) / hazir.w;
    if (hh > S.h * 0.6) { hh = S.h * 0.6; w = (hh * hazir.w) / hazir.h; }
    const cy = sinirla(((mr.top + mr.bottom) / 2 - r.top) / D.k, hh / 2 + 16, S.h - hh / 2 - 16);
    Object.assign(g, { x: Math.round((PW - w) / 2 + n * 24), y: Math.round(cy - hh / 2 + n * 24), w: Math.round(w * 10) / 10, h: Math.round(hh * 10) / 10 });
    zamanla(g);
    const once = structuredClone(S.veri.gorseller);
    S.veri.gorseller.push(g);
    const el = gorselEl(S, g);
    S.gorselKatman.append(el);
    if (!hareketAz()) animasyonBitince(el, "konuyor", 280);
    gecmisKaydet(S, { gorseller: once }, { gorseller: structuredClone(S.veri.gorseller) });
    yeniler.push(id);
  }
  if (!yeniler.length || D !== d) return;
  sayfaDegisti(S);
  secimKur(S, [], { gorsel: yeniler });
  bus.emit("belge:degisti", { belgeId: d.belge.id });
}
// Belge kapanınca: nesne adresleri bırakılır, hiçbir sayfanın göstermediği görsel dosyaları silinir
// (geri alma geçmişi belgeyle birlikte kapandı; silinen görsel artık geri gelemez)
function gorselleriBirak(d) {
  for (const [ad, k] of gorselOnbellek) if (k.belgeId === d.belge.id) { if (k.nesneUrl) URL.revokeObjectURL(k.nesneUrl); gorselOnbellek.delete(ad); }
  if (d.gomulu) return;
  const kullanilan = new Set();
  for (const s of d.veri.sayfalar) for (const g of s.gorseller || []) if (g.ad) kullanilan.add(g.ad);
  import("./kayit.js").then(async ({ ekDosyalar, ekDosyaSil }) => {
    if (!ekDosyalar || !ekDosyaSil) return;
    for (const f of await ekDosyalar(d.belge.id)) if (/^gorsel-/.test(f.ad) && !kullanilan.has(f.ad)) await ekDosyaSil(d.belge.id, f.ad);
  }).catch(() => {});
}

// ---------- sayfa yönetimi (4.1) ----------
// Defter sayfaları ve araya eklenen sayfalar (tur "kagit") taşınır, çoğaltılır, silinir, şablonu değişir.
// PDF'in kendi sayfaları yerinde kalır; aralarına sayfa eklenebilir. Hepsi geri alınabilir ("*" kaydı).
const sayfaTasinir = (v) => v?.tur === "kagit";
function sayfaKaydi(once, { dogan = null } = {}) {
  D.gecmis.kaydet({ sayfa: "*", once: { sayfalar: once }, sonra: { sayfalar: D.veri.sayfalar.slice() }, dogan });
  geriAlDurumu();
  secimKaldir();
  nesneSecimKaldir();
  sayfalariKur({ yeniId: dogan });
  gorunenleriCiz();
  if (!D.panelSol.hidden) solPanelCiz();
  sagPanelPlanla();
  bantKartlariniEsle();
  izEslePlanla();
  bus.emit("belge:degisti", { belgeId: D.belge.id });
}
function sayfaCogalt(i) {
  const v = D.veri.sayfalar[i];
  if (!sayfaTasinir(v)) return;
  islakAktar();
  const once = D.veri.sayfalar.slice(), k = structuredClone(v);
  k.id = yeniId("s");
  k.yerImi = false;
  const idEsle = new Map();
  for (const c of k.cizgiler) { const yeni = yeniId("c"); if (c.id) idEsle.set(c.id, yeni); c.id = yeni; }
  for (const n of k.notlar) n.id = yeniId("n");
  for (const m of k.metinler) { m.id = yeniId("m"); delete m.kartId; }
  for (const b of k.bantlar) { b.id = yeniId("b"); delete b.kartId; delete b.kartYapildi; }
  for (const g of k.gorseller || []) g.id = yeniId("g");   // görsel dosyası paylaşılır (ad aynı)
  D.veri.sayfalar.splice(i + 1, 0, k);
  izleriCogalt(v.id, k.id, idEsle);
  sayfaKaydi(once, { dogan: k.id });
  sayfayaGit(i + 1);
  bildir("Sayfa çoğaltıldı", { etiket: "Geri al", calistir: () => D && geriAl() });
}
function sayfaSil(i) {
  const v = D.veri.sayfalar[i];
  if (!sayfaTasinir(v)) return;
  if (D.veri.sayfalar.length <= 1) { bildir("Son sayfa silinemez."); return; }
  islakAktar();
  const once = D.veri.sayfalar.slice();
  D.veri.sayfalar.splice(i, 1);
  sayfaKaydi(once);
  bildir(`s. ${etiketNo(i)} silindi`, { etiket: "Geri al", calistir: () => D && geriAl() });
}
function sayfaSablon(i, kagit) {
  const v = D.veri.sayfalar[i];
  if (!sayfaTasinir(v) || v.kagit === kagit) return;
  const once = D.veri.sayfalar.slice();
  // yeni nesne: geri alınınca eski şablon döner. Diziler de kopyalanır; yoksa yeni çizgi ve nesneler
  // eski nesneye de girer, şablon geri alınınca geri alınmış çizgi geri gelirdi. Çizgiler değişmez, nesneler kopyalanır.
  const yeni = { ...v, kagit };
  for (const [a, d] of Object.entries(v)) if (Array.isArray(d)) yeni[a] = a === "cizgiler" ? d.slice() : structuredClone(d);
  D.veri.sayfalar[i] = yeni;
  sayfaKaydi(once);
}
// nereye: kaldırılmadan önceki dizide araya girilecek sıra (0..n)
function sayfaTasi(nereden, nereye) {
  const dizi = D.veri.sayfalar, v = dizi[nereden];
  if (!sayfaTasinir(v) || nereye === nereden || nereye === nereden + 1) return false;
  const once = dizi.slice();
  dizi.splice(nereden, 1);
  dizi.splice(nereye > nereden ? nereye - 1 : nereye, 0, v);
  sayfaKaydi(once);
  return true;
}
function sayfaMenusuAc(acan, i) {
  if (D.fis?.acan === acan) { fisKapat(); return; }
  const v = D.veri.sayfalar[i];
  if (!v) return;
  const tasinir = sayfaTasinir(v), no = etiketNo(i);
  const satir = (ikon, ad, fn) => h("button", { class: "fis-satir", role: "menuitem", onclick: () => { fisKapat(true); fn(); } }, ikon, h("span", {}, ad));
  const ekle = (konum, ad) => h("button", { class: "fis-satir", role: "menuitem",
    onclick: () => { fisKapat(true); const S = D.sayfalar[i]; yelpazeAc(S?.kucukBtn?.isConnected ? S.kucukBtn : D.cipNo, konum); } }, icon("arti", "i-20"), h("span", {}, ad));
  const parcalar = [etiket(`Sayfa ${no}`)];
  if (tasinir) {
    parcalar.push(h("div", { class: "kagit-secici", role: "group", "aria-label": "Şablon" },
      ...KAGITLAR.map(([id, ad, sinif]) => h("button", { class: "mini-yaprak", "aria-pressed": String(v.kagit === id), onclick: () => { fisKapat(true); sayfaSablon(i, id); } },
        h("i", { class: sinif }), ad))));
  }
  parcalar.push(ekle(i, "Öncesine sayfa ekle"), ekle(i + 1, "Sonrasına sayfa ekle"));
  if (tasinir) {
    parcalar.push(satir(ikonSec(["sayfa-cogalt", "cogalt", "kopyala"], "⧉", "i-20"), "Çoğalt", () => sayfaCogalt(i)));
    const sil = h("button", { class: "fis-satir sil", role: "menuitem" }, ikonSec(["sayfa-sil", "sil"], "×", "i-20"), h("span", {}, "Sayfayı sil"));
    onayla(sil, () => { fisKapat(true); sayfaSil(i); }, "Emin misin? Tekrar dokun");
    parcalar.push(sil);
  } else parcalar.push(h("p", { class: "fis-not" }, "PDF sayfası yerinde kalır; araya defter sayfası eklenebilir."));
  const fis = h("div", { class: "fis daha-menu sayfa-fis", role: "menu", "aria-label": `Sayfa ${no} menüsü` }, ...parcalar);
  fisAc(fis, acan, acan.closest(".panel-sol") ? "orta" : "sag");
}
// Küçük resim sürükleyerek sıralama: kalem ve fare 8 px kımıldayınca, parmak 380 ms basılı tutunca başlar
function kucukSurukleKur(S) {
  const btn = S.kucukBtn, kap = S.kucukKap;
  let j = null;
  const dokunmaEngel = (e) => { if (j?.basladi) e.preventDefault(); };
  const bitir = (birak) => {
    if (!j) return;
    const jj = j;
    j = null;
    clearTimeout(jj.uzun);
    if (!jj.basladi) return;
    kap.classList.remove("suruklen");
    kap.style.translate = "";
    jj.cizgi?.remove();
    removeEventListener("touchmove", dokunmaEngel, { capture: true });
    S.kucukSurukledi = true;
    setTimeout(() => { S.kucukSurukledi = false; }, 400);
    if (birak && jj.hedef != null && D) {
      const nereden = D.sayfalar.indexOf(S);
      if (!sayfaTasi(nereden, jj.hedef)) solPanelCiz();
    }
  };
  const basla = () => {
    if (!j || j.basladi || !D) return;
    j.basladi = true;
    j.liste = kap.parentNode;
    j.ogeler = [...j.liste.querySelectorAll(".kucuk-oge")].filter((x) => x !== kap);
    j.cizgi = h("div", { class: "kucuk-birak", "aria-hidden": "true" });
    j.liste.append(j.cizgi);
    kap.classList.add("suruklen");
    addEventListener("touchmove", dokunmaEngel, { passive: false, capture: true });
    try { btn.setPointerCapture(j.id); } catch { /* boş */ }
    navigator.vibrate?.(8);
  };
  const hedefBul = (y) => {
    // Bırakılacak yer: imlecin altındaki ilk ögenin ortasından önce
    const r0 = j.liste.getBoundingClientRect();
    let hedefEl = null;
    for (const o of j.ogeler) { const r = o.getBoundingClientRect(); if (y < r.top + r.height / 2) { hedefEl = o; break; } }
    j.hedef = hedefEl ? D.sayfalar.findIndex((x) => x.kucukKap === hedefEl) : D.sayfalar.length;
    const ref = hedefEl || j.ogeler[j.ogeler.length - 1];
    if (ref) {
      const rr = ref.getBoundingClientRect();
      j.cizgi.style.top = (hedefEl ? rr.top : rr.bottom) - r0.top + j.liste.scrollTop - 1 + "px";
    }
    // Kenara yaklaşınca liste kayar
    if (y < r0.top + 40) j.liste.scrollTop -= 10; else if (y > r0.bottom - 40) j.liste.scrollTop += 10;
  };
  btn.addEventListener("pointerdown", (e) => {
    if (!kap.classList.contains("tasinir") || (e.pointerType === "mouse" && e.button !== 0)) return;
    j = { id: e.pointerId, tip: e.pointerType, y0: e.clientY, x0: e.clientX, basladi: false, hedef: null };
    if (e.pointerType === "touch") j.uzun = setTimeout(() => { basla(); if (j) hedefBul(j.y0); }, 380);
  });
  btn.addEventListener("pointermove", (e) => {
    if (!j || e.pointerId !== j.id) return;
    const oyna = Math.hypot(e.clientX - j.x0, e.clientY - j.y0);
    if (!j.basladi) {
      if (j.tip === "touch") { if (oyna > 10) { clearTimeout(j.uzun); j = null; } return; }   // parmak listeyi kaydırıyor
      if (oyna < 8) return;
      basla();
    }
    kap.style.translate = `0 ${e.clientY - j.y0}px`;
    hedefBul(e.clientY);
  });
  btn.addEventListener("pointerup", () => bitir(true));
  btn.addEventListener("pointercancel", () => bitir(false));
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!j?.basladi) sayfaMenusuAc(kap.querySelector(".kucuk-menu"), D.sayfalar.indexOf(S)); });
}

// ---------- İzler: kalemin değdiği yerler (OZELLIKLER-5, İzler sözleşmesi) ----------
// Kalem kalkınca çizgi kuyruğa girer; boşta (kalem yazmıyorken) biçimi sınıflanır, altındaki metin bulunur ve
// belge.veri.izler'e yazılır: { id, tur, zaman, renk, metin, sayfa, kutu, cizgiIdleri } + sayfaId, arac.
// Çizgiler sayfanın kendi listesinde kalır; iz yalnız id'lerini tutar. Silgi, geri al / yinele ve sayfa
// sil / çoğalt / taşı sonrası izleriEsle() izleri çizgilerle eşler: çizgisi kalmayan iz bellekteki çöpe
// gider (geri alınınca çizgisiyle döner), sayfa numarası ve kutu güncellenir, taşınan iz yeniden sınıflanır.
const IZ_BIRLES_MS = 1500;   // bu süreden kısa arayla ve yakına çizilen çizgiler tek iz (yıldız, ünlem, el yazısı)
const IZ_BIRLES_ARA = 24;    // birim
const METINLI_IZ = new Set(["alt", "daire"]);
const yuvarla4 = (v) => Math.round(v * 1e4) / 1e4;
const bosta = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));

function izKur() {
  D.izKuyruk = [];
  D.izCop = new Map();      // id -> iz: çizgileri şu an sayfada olmayan izler
  D.izTam = new Map();      // id -> bütün çizgi id'leri: bir kısmı silinmiş izin geri gelebilecek çizgileri
  D.izImza = new Map();     // id -> çizgi id'leri ve kutu: değişince iz yeniden sınıflanır
  D.izSon = null;           // son yazılan iz ve zamanı (birleştirme için)
  D.kelimeler = new Map();  // sayfa verisi -> Promise<kelimeler>
  if (D.veri.izler && !Array.isArray(D.veri.izler)) D.veri.izler = [];
  // Önceki oturum kapanırken metni bulunamamış izler boşta tamamlanır
  const gecici = (D.veri.izler || []).filter((iz) => iz?.gecici && iz.sayfaId);
  if (gecici.length) { for (const iz of gecici) D.izKuyruk.push({ yenile: true, iz }); izPlanla(1500); }
}

// Sayfanın kelimeleri, sayfa biriminde: gerçek PDF'te metinKutulari, örnek sayfalarda sayfalar.js'in çizdiği metin
function sayfaKelimeleri(S) {
  const v = S.veri;
  let s = D.kelimeler.get(v);
  if (s) return s;
  if (v.tur !== "pdf") s = Promise.resolve([]);   // defter ve araya eklenen kâğıt: metin yok
  else if (D.pdf) {
    const pdf = D.pdf, H = S.h;
    s = (typeof pdf.metinKutulari === "function" ? pdf.metinKutulari(v.pdf, { kelime: true }) : Promise.resolve([]))
      .then((l) => (l || []).map((k) => ({ str: k.str, x: k.x * PW, y: k.y * H, w: k.w * PW, h: k.h * H })))
      .catch(() => []);
  } else {
    const l = [];
    for (const r of sayfaMetinleri(v.pdf)) {
      if (!r.t || !r.t.trim() || !(r.w > 0)) continue;
      const ust = r.y - r.boyut * 0.8, boy = r.boyut;
      let bas = 0;
      for (const p of r.t.split(/(\s+)/)) {
        if (p && !/^\s+$/.test(p)) { const o = altDizeOlc(r, bas, bas + p.length); l.push({ str: p, x: o.x, y: ust, w: o.w, h: boy }); }
        bas += p.length;
      }
    }
    s = Promise.resolve(l);
  }
  D.kelimeler.set(v, s);
  return s;
}

function izKuyrugaAl(S, c, bas) {
  if (!c || c.tur === "sekil" || !c.id) return;
  D.izKuyruk.push({ S, id: c.id, bas, son: performance.now(), zaman: Date.now() });
  izPlanla();
}
function izEslePlanla() { if (!D?.izKuyruk) return; D.izEsle = true; izPlanla(); }
function izPlanla(ms = 0) {
  if (!D || D.izZ) return;
  const d = D;
  D.izZ = zaman(() => bosta(() => { if (D === d) { D.izZ = 0; izIsle(); } }), ms);
}
async function izIsle() {
  const d = D;
  // Kalem yazarken ya da parmak hareketi sürerken beklenir: kalem yolunda iş yok
  const mesgul = () => kalemYaziyor() || !!D.jest;
  if (mesgul()) { izPlanla(300); return; }
  if (D.izEsle) { D.izEsle = false; izleriEsle(); }
  while (D === d && D.izKuyruk.length) {
    if (mesgul()) { izPlanla(300); return; }
    const g = D.izKuyruk.shift();
    try { await (g.yenile ? izYenile(g) : izYaz(g)); } catch (e) { console.warn("[duzenleyici] iz:", e); }
  }
}

const sayfaBilgi = (sayfaId) => { const i = D.sayfalar.findIndex((S) => S.veri.id === sayfaId); return i < 0 ? null : { S: D.sayfalar[i], i }; };
const izKutusu = (k, S) => (k ? [yuvarla4(k.x0 / PW), yuvarla4(k.y0 / S.h), yuvarla4((k.x1 - k.x0) / PW), yuvarla4((k.y1 - k.y0) / S.h)] : [0, 0, 0, 0]);
const izImzasi = (ids, k) => ids.join(",") + (k ? `|${Math.round(k.x0)},${Math.round(k.y0)},${Math.round(k.x1)},${Math.round(k.y1)}` : "");
function sayfaCizgileri(S, ids) {
  const m = new Map();
  for (const c of S.veri.cizgiler) if (c.id) m.set(c.id, c);
  return ids.map((id) => m.get(id)).filter(Boolean);
}

async function izYaz(g) {
  const S = g.S, d = D;
  if (!D.sayfalar.includes(S)) return;
  const c = S.veri.cizgiler.find((x) => x.id === g.id);
  if (!c) return;   // yazılmadan geri alındı
  const kelimeler = await sayfaKelimeleri(S);
  if (D !== d || !S.veri.cizgiler.includes(c)) return;
  izYazHemen(g, S, c, kelimeler);
}
// Belge kapanırken kuyrukta kalan çizgiler metin beklenmeden ize yazılır; gerçek PDF'te metni
// sonraki açılışta tamamlansın diye iz "gecici" işaretlenir (izKur kuyruğa geri koyar)
function izKuyruguBosalt() {
  if (!D?.izKuyruk?.length) return;
  for (const g of D.izKuyruk.splice(0)) {
    try {
      if (g.yenile) continue;
      const S = g.S;
      if (!D.sayfalar.includes(S)) continue;
      const c = S.veri.cizgiler.find((x) => x.id === g.id);
      if (!c) continue;
      const iz = izYazHemen(g, S, c, []);
      if (iz && S.veri.tur === "pdf") iz.gecici = true;
    } catch (e) { console.warn("[duzenleyici] iz:", e); }
  }
}
function izYazHemen(g, S, c, kelimeler) {
  const v = D.veri;
  v.izler ||= [];
  // Az önceki izin yanına hemen çizildiyse aynı iz (yıldızın ikinci çizgisi, ünlemin noktası, kenara yazılan söz)
  let iz = null;
  const son = D.izSon;
  if (son && son.sayfaId === S.veri.id && g.bas - son.t < IZ_BIRLES_MS && v.izler.includes(son.iz)) {
    const a = cizgilerKutusu([c]), b = cizgilerKutusu(sayfaCizgileri(S, son.iz.cizgiIdleri));
    const ara = a && b ? Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1, 0) : Infinity;
    if (ara < IZ_BIRLES_ARA) {
      // Alt çizgi ve daire kendi başına bitmiş işarettir: yanına hemen çizilen yıldız ya da yuvarlak ayrı iz.
      // Yalnız ikinci alt çizgi (çift çizgi) aynı ize katılır.
      if (!METINLI_IZ.has(son.iz.tur)) iz = son.iz;
      else if (son.iz.tur === "alt" && izSinifla([c], { kelimeler, W: PW }).tur === "alt") iz = son.iz;
    }
  }
  const ids = iz ? [...iz.cizgiIdleri, c.id] : [c.id];
  const sonuc = izSinifla(sayfaCizgileri(S, ids), { kelimeler, W: PW });
  const i = D.sayfalar.indexOf(S);
  const alanlar = { tur: sonuc.tur, metin: sonuc.metin, kutu: izKutusu(sonuc.kutu, S), cizgiIdleri: ids, sayfa: etiketNo(i), sayfaId: S.veri.id };
  if (iz) Object.assign(iz, alanlar);
  else {
    iz = { id: yeniId("iz"), zaman: g.zaman, renk: c.renk, ...alanlar, arac: c.tur };
    v.izler.push(iz);
  }
  D.izSon = { iz, sayfaId: S.veri.id, t: g.son };
  D.izImza.set(iz.id, izImzasi(ids, sonuc.kutu));
  izlerDegisti();
  return iz;
}

// Çizgileri taşınan ya da bir kısmı silinen iz yeniden sınıflanır (türü ve metni değişebilir)
async function izYenile(g) {
  const { iz } = g, d = D;
  const yer = sayfaBilgi(iz.sayfaId);
  if (!yer || !D.veri.izler?.includes(iz)) return;
  const kelimeler = await sayfaKelimeleri(yer.S);
  if (D !== d || !D.veri.izler.includes(iz)) return;
  const C = sayfaCizgileri(yer.S, iz.cizgiIdleri);
  if (!C.length) return;
  const s = izSinifla(C, { kelimeler, W: PW });
  const gecici = !!iz.gecici;
  delete iz.gecici;
  if (!gecici && s.tur === iz.tur && s.metin === iz.metin) return;
  iz.tur = s.tur; iz.metin = s.metin;
  izlerDegisti();
}

function izleriEsle() {
  const v = D.veri;
  if (!v.izler?.length && !D.izCop.size) return;
  v.izler ||= [];
  const yerler = new Map(D.sayfalar.map((S, i) => [S.veri.id, { S, i }]));
  const haritalar = new Map();
  const harita = (S) => {
    let m = haritalar.get(S);
    if (!m) { m = new Map(); for (const c of S.veri.cizgiler) if (c.id) m.set(c.id, c); haritalar.set(S, m); }
    return m;
  };
  let degisti = false, dondu = false;
  // Çöptekiler: çizgileri sayfaya geri geldiyse (geri al, yinele, silinen sayfanın geri alınması) yerine döner
  for (const [id, iz] of D.izCop) {
    const y = yerler.get(iz.sayfaId);
    if (y && (D.izTam.get(id) || iz.cizgiIdleri).some((cid) => harita(y.S).has(cid))) { D.izCop.delete(id); v.izler.push(iz); dondu = degisti = true; }
  }
  const kalan = [];
  for (const iz of v.izler) {
    if (!iz || !iz.sayfaId || !Array.isArray(iz.cizgiIdleri)) { kalan.push(iz); continue; }   // tanınmayan kayıt olduğu gibi kalır
    const y = yerler.get(iz.sayfaId);
    const tam = D.izTam.get(iz.id) || iz.cizgiIdleri;
    const m = y && harita(y.S), varolan = m ? tam.filter((cid) => m.has(cid)) : [];
    if (!varolan.length) { D.izCop.set(iz.id, iz); if (D.izSon?.iz === iz) D.izSon = null; degisti = true; continue; }
    if (varolan.length !== tam.length) D.izTam.set(iz.id, tam); else D.izTam.delete(iz.id);
    if (varolan.join() !== iz.cizgiIdleri.join()) { iz.cizgiIdleri = varolan; degisti = true; }
    const no = etiketNo(y.i);
    if (iz.sayfa !== no) { iz.sayfa = no; degisti = true; }
    const k = cizgilerKutusu(varolan.map((cid) => m.get(cid))), imza = izImzasi(varolan, k);
    const eski = D.izImza.get(iz.id);
    if (eski !== imza) {
      D.izImza.set(iz.id, imza);
      if (eski !== undefined) {   // açılıştaki ilk eşleme yalnız imzayı kaydeder
        iz.kutu = izKutusu(k, y.S);
        D.izKuyruk.push({ yenile: true, iz });
        degisti = true;
      }
    }
    kalan.push(iz);
  }
  if (dondu) kalan.sort((a, b) => (a?.zaman || 0) - (b?.zaman || 0));
  if (degisti) { v.izler.splice(0, v.izler.length, ...kalan); izlerDegisti(); }
  else izSeritleri();   // sayfalar yeniden kurulduysa (açılış, sayfa taşıma) çizgiler yerine konur
}

function izlerDegisti() {
  if (!D) return;
  izSeritleri();
  try { D.koltuk?.izleriYenile?.(); } catch { /* koltuk.js eski sürüm */ }
  bus.emit("izler", { belgeId: D.belge.id });
  icerikDegisti();
}

// Kâğıt kitabı hızlıca çevirirken kenarda kalem izlerini görmek gibi: hızlı kaydırmada izli sayfaların sol
// kenarında, izlerin hizasında ince mürekkep çizgileri belirir (CSS .hizli-kaydir). Yalnız izler değişince kurulur.
function izSeritleri() {
  const gruplar = new Map();
  for (const iz of D.veri.izler || []) if (iz?.sayfaId && Array.isArray(iz.kutu)) (gruplar.get(iz.sayfaId) || gruplar.set(iz.sayfaId, []).get(iz.sayfaId)).push(iz);
  for (const S of D.sayfalar) {
    const l = gruplar.get(S.veri.id) || [];
    const duraklar = l.slice().sort((a, b) => a.kutu[1] - b.kutu[1]).map((iz) => {
      const a = sinirla(iz.kutu[1] * 100, 0, 99), z = sinirla(Math.max(a + 1.2, (iz.kutu[1] + iz.kutu[3]) * 100), 0, 100);
      const r = renkSayfaya(iz.renk || "#1F3A68");
      return `transparent ${a.toFixed(1)}%, ${r} ${a.toFixed(1)}% ${z.toFixed(1)}%, transparent ${z.toFixed(1)}%`;
    });
    const anahtar = duraklar.join(",");
    if (S.izSeritAnahtar === anahtar && (!anahtar || S.izSerit?.parentNode === S.kap)) continue;
    S.izSeritAnahtar = anahtar;
    if (!anahtar) { S.izSerit?.remove(); continue; }
    S.izSerit ||= h("i", { class: "iz-serit", "aria-hidden": "true" });
    S.izSerit.style.setProperty("--iz-cizgileri", `linear-gradient(${duraklar.join(", ")})`);
    if (S.izSerit.parentNode !== S.kap) S.kap.append(S.izSerit);
  }
}

// İzin yerine kayar ve çevresine bir kez kalem halkası çizilir
function izeGit(iz, halka = true) {
  const yer = iz && sayfaBilgi(iz.sayfaId);
  if (!yer || !Array.isArray(iz.kutu)) return false;
  const [x, y, w, hh] = iz.kutu, S = yer.S;
  hedefeGit(S, { x: x * PW, y: y * S.h, w: Math.max(8, w * PW), h: Math.max(8, hh * S.h) }, { halka });
  return true;
}
// "[" önceki iz, "]" sonraki iz: ekranın ortasındaki konuma göre
function izeAtla(yon) {
  const l = (D.veri.izler || []).map((iz) => ({ iz, yer: iz && sayfaBilgi(iz.sayfaId) })).filter((o) => o.yer && Array.isArray(o.iz.kutu))
    .map((o) => ({ ...o, konum: o.yer.S.kap.offsetTop + (o.iz.kutu[1] + o.iz.kutu[3] / 2) * o.yer.S.h * D.k }))
    .sort((a, b) => a.konum - b.konum);
  if (!l.length) { bildir("Bu belgede henüz kalem izi yok."); return; }
  const orta = D.masa.scrollTop + D.masa.clientHeight * 0.42;
  const hedef = yon > 0 ? l.find((o) => o.konum > orta + 4) : [...l].reverse().find((o) => o.konum < orta - 4);
  if (!hedef) { bildir(yon > 0 ? "Son iz bu." : "İlk iz bu."); return; }
  izeGit(hedef.iz);
}

// Sayfa çoğaltılınca izleri de yeni sayfanın çizgileriyle çoğalır (fotokopi gibi)
function izleriCogalt(eskiId, yeniSayfaId, idEsle) {
  const v = D.veri;
  if (!v.izler?.length) return;
  for (const iz of v.izler.filter((x) => x?.sayfaId === eskiId)) {
    const ids = iz.cizgiIdleri.map((id) => idEsle.get(id)).filter(Boolean);
    if (ids.length) v.izler.push({ ...structuredClone(iz), id: yeniId("iz"), sayfaId: yeniSayfaId, cizgiIdleri: ids });
  }
}

// ---------- ses: kayıt düğmesi, çizgi zamanı, soluk gösterim (sözleşme: Masa çizgi zamanı) ----------
// Kayıt sürerken eklenen çizgi, şekil, not, metin kutusu, damga ve görsel t: { kayitId, ms } alır.
function sesT() {
  const m = D?.ses;
  if (!m?.sesZamani) return null;
  try {
    const z = m.sesZamani();
    return z && z.kayitId != null && Number.isFinite(z.ms) ? { kayitId: z.kayitId, ms: Math.round(z.ms) } : null;
  } catch { return null; }
}
function zamanla(o) { const t = sesT(); if (t) o.t = t; return o; }
function sesBagla() {
  const d = D;
  import("./ses.js").then((m) => { if (D === d) D.ses = m; }).catch(() => { if (D === d) D.ses = null; });
  D.temizlik.push(bus.on("ses:zaman", sesZamanGeldi));
}
async function sesCubukDegistir() {
  const d = D;
  if (D.sesCubuk) {
    if (D.ses?.aktifKayit?.()) { bildir("Kayıt sürüyor. Durdurmak için şeritteki düğmeye dokun."); return; }
    try { D.sesCubuk.kaldir?.(); } catch (e) { console.warn(e); }
    D.sesCubuk = null;
    delete D.veri.sesSerit;
    sesDugmeGuncelle();
    return;
  }
  const m = D.ses || (await import("./ses.js").catch(() => null));
  if (D !== d) return;
  if (!m?.cubukKur) { bildir("Ses kaydı şu an kullanılamıyor."); return; }
  D.ses = m;
  if (D.sesCubuk) return;   // açılışta kendiliğinden açılırken bu arada elle de açıldıysa
  try { D.sesCubuk = m.cubukKur(D.kok, D.belge) || { kaldir() {} }; }
  catch (e) { console.warn("[duzenleyici] ses şeridi:", e); bildir("Ses şeridi açılamadı."); return; }
  D.veri.sesSerit = true;   // belge yeniden açılınca şerit de açık gelir (kitaplıktan dönüş, uzun aradan sonra açılış)
  sesDugmeGuncelle();
}
function sesDugmeGuncelle() {
  const acik = !!D.sesCubuk;
  D.ust.ses?.setAttribute("aria-pressed", String(acik));
  D.kok.classList.toggle("ses-acik", acik);
  requestAnimationFrame(() => {
    if (!D) return;
    const el = D.sesCubuk?.el || D.kok.querySelector(".ses-serit, .ses-cubuk, [data-ses-serit]");
    D.sesSeritH = acik && el ? el.offsetHeight : 0;   // araç çubuğunu CSS iter (--ses-serit); burada yalnız sayfaya gitme payı
  });
}
function sesKapat(d) {
  const m = d.ses;
  try { d.sesCubuk?.kaldir?.(); } catch { /* boş */ }
  d.sesCubuk = null;
  try { if (m?.aktifKayit?.()) m.kayitDurdur?.()?.catch?.(() => {}); } catch { /* boş */ }
  try { m?.durdur?.(); } catch { /* boş */ }
}
function sesZamanGeldi(v) {
  if (!D || !v || v.belgeId !== D.belge.id) return;
  if (v.ms == null) {
    D.sesOynuyor = false;
    if (!D.sesSoluk) return;
    D.sesSoluk = null;
  } else {
    D.sesOynuyor = true;
    D.sesSoluk = { kayitId: v.kayitId, ms: v.ms };
  }
  // Yalnız görünen sayfalar; soluk küme değişmediyse mürekkep yeniden çizilmez (anahtar aynı kalır)
  for (const S of D.sayfalar) {
    if (S.gorunur) murekkepCiz(S);
    sesSolukNesneler(S);
  }
}
function sesSolukCizgiler(S) {
  const s = D?.sesSoluk;
  if (!s) return null;
  let kume = null;
  for (const c of S.veri.cizgiler) if (c.t && c.t.kayitId === s.kayitId && c.t.ms > s.ms) (kume ||= new Set()).add(c);
  return kume;
}
function sesSolukNesneler(S) {
  const s = D.sesSoluk, v = S.veri;
  for (const o of [...v.notlar, ...v.metinler, ...(v.gorseller || [])]) {
    if (!o.t) continue;
    const soluk = !!s && o.t.kayitId === s.kayitId && o.t.ms > s.ms;
    const el = nesneElBul(S, o.id);
    if (el && el.classList.contains("ses-soluk") !== soluk) el.classList.toggle("ses-soluk", soluk);
  }
}
// Oynatırken kalemin dokunduğu nesnenin zamanı: DOM nesnesi ya da (sondan başa) çizgi
function sesAtlaDene(e, S, t) {
  let o = null;
  const el = t.closest?.("[data-id]");
  if (el && (S.nesneler.contains(el) || S.gorselKatman.contains(el))) {
    const id = el.dataset.id, v = S.veri;
    o = v.notlar.find((x) => x.id === id) || v.metinler.find((x) => x.id === id) || (v.gorseller || []).find((x) => x.id === id);
  }
  if (!o?.t) {
    const r = S.kap.getBoundingClientRect(), x = (e.clientX - r.left) / D.k, y = (e.clientY - r.top) / D.k;
    o = null;
    for (let i = S.veri.cizgiler.length - 1; i >= 0; i--) {
      const c = S.veri.cizgiler[i];
      if (c.t && cizgiyeDokunuyor(c, x, y, 8 / D.k)) { o = c; break; }
    }
  }
  if (!o?.t) return false;
  e.preventDefault();
  bus.emit("ses:atla", { kayitId: o.t.kayitId, ms: o.t.ms });
  return true;
}

// ---------- arama ile açılış: ac(..., { ara }) ve git({ sayfa, ara }) (4.6) ----------
// Bütün kitaplık araması aksansız eşleştirir (ı/i, ş/s...) ve Latince eş yazımı da bulur ("pleksus" plexus'u):
// vurgu da aynı kuralla işaretler. Katlama arama.js'ten gelir (aramadan gelindiyse zaten yüklüdür); yüklenemezse yedeği.
const KATLA = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
const yedekKatla = (s) => s.toLocaleLowerCase("tr").replace(/[ışğüöçâîû]/g, (c) => KATLA[c]);
let katla = yedekKatla, katlaSoz = null;
const katlaHazir = () => (katlaSoz ||= import("./arama.js").then((m) => { if (typeof m.katla === "function") katla = m.katla; }).catch(() => {}));
// arama.js esYazim ile aynı kural: ks ile x birbirinin yerine geçer
function esYazimlar(w) {
  const l = [w];
  if (w.includes("ks")) l.push(w.replaceAll("ks", "x"));
  if (w.includes("x")) l.push(w.replaceAll("x", "ks"));
  return l;
}
// Sorgunun aranacak biçimleri: önce bütün ifade, o hiç geçmiyorsa tek tek kelimeler (aramadaki "hepsi geçiyor" kuralı)
function sorguBicimleri(sorgu) {
  const q = katla(String(sorgu)).replace(/\s+/g, " ").trim();
  const kelimeler = q.split(" ").filter((w) => w.length >= 2);
  return { ifade: esYazimlar(q), kelimeler: kelimeler.length > 1 ? kelimeler.flatMap(esYazimlar) : [] };
}
// Eşleşmeler [konum, uzunluk]: eş yazımın boyu sorgununkinden farklı olabilir ("pleksus" 7, "plexus" 6)
function katliEslesmeler(metin, bicimler) {
  const a = katla(metin), sonuc = [];
  if (a.length !== metin.length) return sonuc;
  for (const q of bicimler) {
    if (!q) continue;
    for (let i = a.indexOf(q); i >= 0; i = a.indexOf(q, i + q.length)) {
      if (!sonuc.some(([j, n]) => i < j + n && j < i + q.length)) sonuc.push([i, q.length]);
    }
  }
  return sonuc;
}
async function sayfaBicimleEslesmeleri(S, bicimler) {
  const kutular = [];
  if (S.veri.tur === "pdf" && D.pdf) {
    let satirlar = [];
    try { satirlar = await D.pdf.satirlar(S.veri.pdf); } catch { /* metinsiz sayfa */ }
    for (const r of satirlar) for (const [i, n] of katliEslesmeler(r.t, bicimler)) kutular.push(metinKutusu(r, i, n));
  } else if (S.veri.tur === "pdf") {
    for (const r of sayfaMetinleri(S.veri.pdf)) for (const [i, n] of katliEslesmeler(r.t, bicimler)) {
      const o = altDizeOlc(r, i, i + n);
      kutular.push({ x: o.x, y: r.y - r.boyut * 0.85, w: Math.max(8, o.w), h: r.boyut * 1.15 });
    }
  }
  for (const nt of S.veri.notlar) if (katliEslesmeler(nt.metin || "", bicimler).length) kutular.push({ x: nt.x, y: nt.y, w: nt.kucuk ? 44 / D.k : NOT_W, h: nt.kucuk ? 44 / D.k : NOT_W });
  for (const m of S.veri.metinler) if (katliEslesmeler(m.metin || "", bicimler).length) {
    const el = nesneElBul(S, m.id);
    kutular.push({ x: m.x, y: m.y, w: el ? el.offsetWidth / D.k : 160, h: el ? el.offsetHeight / D.k : (m.fs || 18) * 1.4 });
  }
  return kutular.sort((a, b) => a.y - b.y || a.x - b.x);
}
async function sayfaEslesmeleri(S, terim) {
  await katlaHazir();
  if (!D) return [];
  const b = sorguBicimleri(terim);
  const kutular = await sayfaBicimleEslesmeleri(S, b.ifade);
  return kutular.length || !b.kelimeler.length || !D ? kutular : sayfaBicimleEslesmeleri(S, b.kelimeler);
}
async function araGoster(terim, i) {
  terim = String(terim || "").trim();
  const d = D, S = D.sayfalar[i];
  if (!S || !terim) { if (S) sayfayaGit(i); return; }
  D.arama = { sorgu: terim, sonuclar: [], secili: -1 };   // Ctrl+F açılınca terim hazır durur
  const kutular = await sayfaEslesmeleri(S, terim);
  if (D !== d) return;
  if (!kutular.length) { sayfayaGit(i); return; }
  await hedefeGit(S, kutular[0], { halka: false });
  if (D !== d) return;
  const parilti = kutular.slice(0, 60).map((k) => h("div", { class: "ara-parilti gecici", style: `--x:${k.x};--y:${k.y};--w:${k.w};--h:${k.h}` }));
  S.nesneler.append(...parilti);
  zaman(() => parilti.forEach((p) => p.remove()), hareketAz() ? 2200 : 2600);
}

// Asistan cevabından "Kenara not": modül bir kez yüklenince dinlemeye başlar
bus.on("asistan:not", (v) => { try { asistanNotuAl(v); } catch (hata) { console.warn("[kenar-notu] asistan notu:", hata); } });
