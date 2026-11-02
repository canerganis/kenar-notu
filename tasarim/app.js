// Kenar Notu prototipi: uygulama kabuğu ve kitaplık.
// Burada: dokular, tema ve sade hareket, bildirim, yönlendirme (kitaplık ve belge),
// kitap açılış anı (TASARIM 6.3) ve kitaplık ekranının tamamı.
// Görsel sözleşme TASARIM.md, paylaşılan durum ve yardımcılar ortak.js.

import {
  $, $$, h, icon, hareketAz, bus, store, belgeBul, yeniId, kirpintiSil, ayarla,
  setBildirimGosterici, toast, KAPAK_RENKLERI, CILT_RENKLERI, KLASORLER,
  varsayilanMod, bugunTekrar, YZ_UYGULAMALAR, YZ_SAGLAYICILAR,
  kartGuncelle, ORNEK_SURUM, ORNEK_DEGISIM, ORNEK_SAYFALAR, cizgiMi, basincUygula,
  bosta, platform, iosMu, ipadMi, samsungMu, safariMi, kuruluMu, kalemTuru, kalemAdi, odakla, telefonMu,
  oduncOzet, sureMetni, exLibrisSvg, exLibrisVar, EXLIBRIS_RENKLERI, komutEkle, acikEkran,
  ATMOSFERLER, VURGULAR, atmosferBul, etkinAtmosfer, simgeEkle, kisayolEkle, kisayollar,
} from "./ortak.js";
import { altCekmece, cekmeceMi, gecmisYut, cekmeceleriKapat, cekmeceAcik } from "./cekmece.js";
import { rehberDavet, rehberBaslat, rehberKapat } from "./rehber.js";
import { PW, PH, PDF_PAGES, TEMPLATES } from "./sayfalar.js";
import * as SAYFALAR from "./sayfalar.js";
import * as kayit from "./kayit.js";
import { ornekKitapKartlari, ornekKunyeDile } from "./okuma-metni.js";
import { t, yerel, ingilizceMi } from "./dil.js";

const kok = document.documentElement;
const sahne = document.getElementById("sahne");

/* ================= Dokular (TASARIM 2.4) ================= */
const doku = (ad, svg) =>
  kok.style.setProperty(ad, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);

const gren = (matris) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='${matris}'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`;

// Kâğıt greni: açıkta kahve benek, koyuda açık benek
doku("--doku-kagit-acik", gren("0 0 0 0 .24  0 0 0 0 .16  0 0 0 0 .07  0 0 0 .7 -.26"));
doku("--doku-kagit-koyu", gren("0 0 0 0 .95  0 0 0 0 .9  0 0 0 0 .8  0 0 0 .4 -.17"));

// 7.0 atmosfer greni (TASARIM-5 3.3): nötr, renksiz; yoğunluğu --atmosfer-gren-opak verir. Büyük yumuşak gradyanlardaki
// bantlaşmayı da kırar. Yalnız #atmosfer::after katmanında, karıştırma kipi olmadan (yalnız alfa)
// Alfa satırı TASARIM-5 3.3'tekinin üçte biri kadar: tam yoğunlukta koyu zeminde kum gibi görünüyordu
doku("--doku-gren", gren("0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .52  0 0 0 .4 -.17"));
// Okyanus dalgaları: 640x320 karoda üç yumuşak sinüs konturu, 1 px. Her dalga karoda tam dönem sayısı kadar kıvrılır,
// böylece karo yan yana dikişsiz birleşir. Renk %4 ile %6 arası: süs, göze batmaz
const dalga = (renk) => {
  const yollar = [[64, 14, 1, 0, .05], [168, 20, 1, 2.1, .06], [262, 12, 2, .7, .04]].map(([y, genlik, donem, faz, opak]) => {
    let d = "";
    for (let x = 0; x <= 640; x += 8) d += `${x ? "L" : "M"}${x} ${(y + genlik * Math.sin((x / 640) * donem * 2 * Math.PI + faz)).toFixed(1)}`;
    return `<path d='${d}' stroke-opacity='${opak}'/>`;
  }).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='320'><g fill='none' stroke='${renk}' stroke-width='1' stroke-linejoin='round'>${yollar}</g></svg>`;
};
doku("--doku-dalga", dalga("#0A1518"));
doku("--doku-dalga-gece", dalga("#E6F2F4"));

// Seyrek, yatay kâğıt lifleri: kitaplık zemini (yalnız açık tema), kenar alanı, yapışkan not. Opaklık yarıda: süs, göze batmaz
doku("--doku-lif", "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.012 .32' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .26  0 0 0 0 .14  0 0 0 .3 -.18'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>");

// Kabartmalı deri: yalnız defter kapağında, soft-light ile
doku("--doku-deri", "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='d'><feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='3' seed='9' stitchTiles='stitch'/><feDiffuseLighting lighting-color='#fff' surfaceScale='1.4'><feDistantLight azimuth='225' elevation='35'/></feDiffuseLighting></filter><rect width='100%' height='100%' filter='url(#d)'/></svg>");

// Ebru: yalnız EPUB açılışındaki forza (imza anı 6.3)
doku("--ebru", "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='240'><defs><linearGradient id='b' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='0' y2='56' spreadMethod='repeat'><stop offset='0' stop-color='#1F3A68'/><stop offset='.2' stop-color='#1F3A68'/><stop offset='.23' stop-color='#F4EEE3'/><stop offset='.45' stop-color='#F4EEE3'/><stop offset='.48' stop-color='#7D1D2C'/><stop offset='.6' stop-color='#7D1D2C'/><stop offset='.63' stop-color='#C9A14E'/><stop offset='.7' stop-color='#C9A14E'/><stop offset='.73' stop-color='#E6DCCA'/><stop offset='1' stop-color='#E6DCCA'/></linearGradient><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.005 .014' numOctaves='2' seed='7' result='t'/><feDisplacementMap in='SourceGraphic' in2='t' scale='140' xChannelSelector='R' yChannelSelector='G'/></filter></defs><rect x='-80' y='-80' width='640' height='400' fill='url(#b)' filter='url(#m)'/></svg>");

// Maskeler: el yapımı kâğıt kenarı (kenar alanı) ve yırtık bant uçları
doku("--maske-deste", "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='160'><path d='M0 0H5.2L6.6 7 4.9 15 7.1 24 5.3 33 7.4 41 5 50 6.8 59 4.6 68 7 77 5.2 86 7.3 95 5.1 104 6.5 113 4.8 122 7.2 131 5.4 140 6.7 149 5.2 160H0Z'/></svg>");
const yirtik = "M7 0H2.4L3.9 3.2 1.1 6.6 3.4 10 .7 13.5 2.9 17.1 1.3 20.6 3.6 24.2 .9 27.7 3.1 31.1 1.2 34.8 3.5 38.2 1.6 41.3 2.4 44H7Z";
doku("--yirtik-sol", `<svg xmlns='http://www.w3.org/2000/svg' width='7' height='44'><path d='${yirtik}'/></svg>`);
doku("--yirtik-sag", `<svg xmlns='http://www.w3.org/2000/svg' width='7' height='44'><path transform='matrix(-1 0 0 1 7 0)' d='${yirtik}'/></svg>`);

// Anahtarın içindeki onay işareti (maske olarak kullanılır, rengi CSS verir)
doku("--ikon-tik", "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 12.5 10 17.5 19 7' fill='none' stroke='#000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>");

// 7.0 seçim kipindeki kapak işareti (K6): vurgu dolgusunun üstünde açık ve koyu tik (kip başına tasarim.css seçer)
for (const [ad, renk] of [["--ikon-tik-acik", "#fff"], ["--ikon-tik-koyu", "#0B0C11"]]) {
  doku(ad, `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 12.5 10 17.5 19 7' fill='none' stroke='${renk}' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`);
}

// 2. tur dokuları (TASARIM-2 §2.4)
// Benek maskesi: alfa gürültüsü. esik büyüdükçe daha az delik açılır.
const benekMaske = (tohum, egim, esik) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='${tohum}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${egim} ${esik}'/></filter><rect width='100%' height='100%' filter='url(#b)'/></svg>`;
doku("--maske-tebesir", benekMaske(4, -2.6, 2.15));   // harfin yaklaşık yüzde 12'si kemirilir
doku("--maske-damga", benekMaske(8, -3.2, 2.9));      // damga kenarında seyrek boşluk
// Silinmiş formüller: tahtada yüzde 5 opaklıkta, sürtülmüş hayalet. data URI webfont yükleyemez, sistem serifi kullanılır.
doku("--doku-silinmis", "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='.02 .4' numOctaves='2' seed='11' result='n'/><feDisplacementMap in='SourceGraphic' in2='n' scale='9'/><feGaussianBlur stdDeviation='.7'/></filter><g filter='url(#s)' fill='#E8E4D8' fill-opacity='.035' font-family='Georgia,serif' font-style='italic'><text x='40' y='90' font-size='38'>R&#956;&#957; &#8722; &#189;g&#956;&#957;R = 8&#960;GT&#956;&#957;</text><text x='330' y='210' font-size='32'>i&#295;&#947;&#956;&#8706;&#956;&#968; = mc&#968;</text><text x='70' y='330' font-size='30'>&#8711;&#183;E = &#961;/&#949;&#8320;</text><text x='420' y='380' font-size='26'>&#916;x&#916;p &#8805; &#295;/2</text></g></svg>");

// Osiloskop izi (TASARIM-2 §2.6): bekliyor, dusunuyor, akiyor, bitti, hata
function izOlustur() {
  const tepe = "M0 8Q12.5 2 25 8" + Array.from({ length: 15 }, (_, i) => `T${50 + i * 25} 8`).join("");  // 50 birim periyot, 400 birim
  const el = h("div", { class: "iz", "aria-hidden": "true", dataset: { durum: "bekliyor" } });
  el.innerHTML = `<i><svg viewBox="0 0 400 16" preserveAspectRatio="none"><path class="iz-golge" d="${tepe}"/><path class="iz-cizgi" d="${tepe}"/></svg></i><span class="iz-not"></span>`;
  return el;
}

/* ================= Kalıcı tercihler ================= */
// Ayarlar ve kitaplık görünümü localStorage'da; belgeler, çizimler ve kırpıntılar aşağıda IndexedDB'de.
const ANAHTAR = { ayarlar: "kn-tasarim:ayarlar", kitaplik: "kn-tasarim:kitaplik", koyuOneri: "kn-tasarim:koyu-oneri",
  depoUyari: "kn-tasarim:depo-uyari", iosKurulum: "kn-tasarim:ios-kurulum", rehber: "kn-tasarim:rehber" };
const depo = {
  oku(anahtar) { try { return JSON.parse(localStorage.getItem(anahtar)); } catch { return null; } },
  yaz(anahtar, deger) { try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch { /* gizli pencere */ } },
};
{
  const kayitli = depo.oku(ANAHTAR.ayarlar);
  if (kayitli && typeof kayitli === "object") {
    for (const [k, v] of Object.entries(kayitli)) if (v === null || typeof v !== "object") store.ayarlar[k] = v;
    // Düzenleyicinin araç ayarları (kalem renkleri, araç çubuğu konumu) yapısı tamsa geri gelir
    const a = kayitli.araclar;
    if (a && Array.isArray(a.kalemler) && a.kalemler.length === 3 && a.fosforlu && a.silgi && a.metin && a.not && a.bant) store.ayarlar.araclar = a;
    // Çeviri seçimleri (OZELLIKLER-6 §5): hedef dil ve motor tercihi
    const c = kayitli.ceviri;
    if (c && typeof c === "object") {
      store.ayarlar.ceviri = {
        hedef: typeof c.hedef === "string" && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(c.hedef) ? c.hedef : "tr",
        motor: ["otomatik", "cihaz", "paket", "anahtar", "hesap"].includes(c.motor) ? c.motor : "otomatik",
      };
    }
    // Ex libris (11. tur): vuruşlar 0..1 arası sayı üçlüleri; bozuk kayıt yok sayılır
    const ex = kayitli.exLibris;
    if (ex && typeof ex === "object" && Array.isArray(ex.vuruslar)) {
      const vuruslar = ex.vuruslar.filter(Array.isArray).map((v) => v.filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]))).filter((v) => v.length);
      store.ayarlar.exLibris = { vuruslar, cerceve: String(ex.cerceve || "daire"), renk: String(ex.renk || ""), yazi: String(ex.yazi || "").slice(0, 18), surum: Number(ex.surum) || 1 };
    }
  }
}
// Arayüz yazı boyutu (TASARIM-4 3.7): html[data-yazi] --fs-* tokenlarını büyütür
const yaziBoyutuUygula = () => { const y = store.ayarlar.arayuzYazi; if (y === "buyuk" || y === "kucuk") kok.dataset.yazi = y; else delete kok.dataset.yazi; };
yaziBoyutuUygula();
// Yapay zekâ ayarları (anahtarlar dahil) localStorage'a yazılmaz, IndexedDB'de ayrı kayıtta durur
let ayarYazma = true;   // "Her şeyi temizle" sonrası yenilenirken eski ayarlar geri yazılmasın
const ayarlariYaz = () => { if (!ayarYazma) return; const { yz, ...digerleri } = store.ayarlar; depo.yaz(ANAHTAR.ayarlar, digerleri); };
// Düzenleyici araç ayarlarını olay yaymadan da değiştirir; sayfa gizlenirken ya da kapanırken son hâli yazılır.
// Android arka plandaki PWA'yı kapatırken pagehide çoğu zaman gelmez; son güvenilir olay gizlenmedir.
addEventListener("pagehide", ayarlariYaz);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") ayarlariYaz(); });

/* ================= Belgelerin kalıcılığı ================= */
// Düzen kayit.js'te: kitaplık listesi bir kayıt, her belgenin verisi ayrı kayıt, dosyalar ayrı depo.
// Yalnız değişen belgenin verisi yazılır; sekme gizlenince her şey hemen yazılır.
// Yapay zekâ ayarları kitaplıktan ayrı anahtarda: "Örnek verilere dön" anahtarları silmez.
// Eski ya da eksik kayıt varsayılanların üstüne yazılır; bilinmeyen değerler varsayılanda kalır
function yzBirlestir(kayitli) {
  if (!kayitli || typeof kayitli !== "object") return;
  const yz = store.ayarlar.yz;
  if (kayitli.yol === "hesap" || kayitli.yol === "anahtar") yz.yol = kayitli.yol;
  if (YZ_UYGULAMALAR.some((u) => u.id === kayitli.uygulama)) yz.uygulama = kayitli.uygulama;
  if (YZ_SAGLAYICILAR.some((s) => s.id === kayitli.saglayici)) yz.saglayici = kayitli.saglayici;
  for (const alan of ["anahtarlar", "modeller"]) {
    const k = kayitli[alan];
    if (!k || typeof k !== "object") continue;
    for (const [ad, deger] of Object.entries(k)) if (typeof deger === "string" && (alan === "anahtarlar" || deger.trim())) yz[alan][ad] = deger;
  }
  // Son bağlantı denemesinin sonucu (lamba için): { saglayici: { tamam, zaman } }
  if (kayitli.denemeler && typeof kayitli.denemeler === "object") yz.denemeler = kayitli.denemeler;
}
// Açılışta: kayıt varsa örnek durumun yerine geçer (eski tek kayıt bir kez yeni düzene taşınır).
// Dönen değer: { geri: geri yüklendi mi, kartlarVar: kayıtta kart alanı var mı, engel: veritabanı açılamadı mı }
async function durumGeriYukle() {
  const s = await kayit.durumYukle();
  yzBirlestir(s.yz);
  return s;
}
// Açık ekran ve yan yana defter kendi konumunu belgeye yazar; verileri yazılacak belgeler döner
function acikBelgeler() {
  try { acik.modul?.kaydet?.(); } catch { /* açık ekran kendi konumunu yazamadıysa son hâli yeter */ }
  const idler = [];
  if (acik.ekran === "belge" && acik.belgeId) idler.push(acik.belgeId);
  const yan = window.__knYan;
  if (yan?.belgeId && yan.cerceve?.isConnected) idler.push(yan.belgeId);
  return idler;
}
// S Pen ekranın üstünde havada (basılı değil) en son ne zaman görüldü: kalem inmek üzereyse kayıt bekler
let kalemHavada = -1e9;
document.addEventListener("pointermove", (e) => { if (e.pointerType === "pen" && !e.buttons) kalemHavada = e.timeStamp; }, { capture: true, passive: true });
kayit.kayitKur({
  oncesi: acikBelgeler,
  mesgul: () => document.body.classList.contains("yaziyor") || !!document.querySelector(".yaziyor"),
  yakinda: () => performance.now() - kalemHavada < 800,
});
/* ================= Sanal klavye ================= */
// Android Chrome'da klavye yalnız görsel alanı daraltır: sabit paneller ve pencereler altında kalır.
// Klavye yüksekliği --klavye, görünen alanın üstü --vv-ust, yüksekliği --vv-yuk olarak yazılır;
// odaktaki yazı alanı kaydırılabilir atalarıyla klavyenin üstüne getirilir.
const yaziAlaniMi = (el) => !!el && (el.isContentEditable || el.matches?.("textarea, input:not([type=button], [type=submit], [type=checkbox], [type=radio], [type=range], [type=file], [type=color])"));
function klavyeKur() {
  const vv = window.visualViewport;
  if (!vv) return;
  let onceki = 0;
  const gorunurYap = () => {
    const el = document.activeElement;
    if (!yaziAlaniMi(el)) return;
    let r = el.getBoundingClientRect();
    // Uzun alanda imlecin olduğu yer (contenteditable'da seçimden), yoksa alanın ilk 120px'i
    if (el.isContentEditable) {
      const sr = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
      if (sr && sr.height) r = sr;
    }
    const hedefAlt = Math.min(r.bottom, r.top + Math.min(r.height, 120));
    let fark = hedefAlt - (vv.offsetTop + vv.height - 12);
    for (let a = el.parentElement; a && fark > 0; a = a.parentElement) {
      if (a.scrollHeight <= a.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(a).overflowY)) continue;
      const once = a.scrollTop;
      a.scrollTop = once + fark;
      fark -= a.scrollTop - once;
    }
  };
  const guncelle = () => {
    const alt = Math.round(innerHeight - vv.height - vv.offsetTop);
    // Yakınlaştırılmış sayfa ya da adres çubuğu farkı klavye sayılmaz; klavye yalnız yazı alanı odaktayken
    const kb = Math.abs(vv.scale - 1) < 0.01 && alt > 80 && yaziAlaniMi(document.activeElement) ? alt : 0;
    kok.style.setProperty("--klavye", kb + "px");
    kok.style.setProperty("--vv-ust", (kb ? Math.max(0, Math.round(vv.offsetTop)) : 0) + "px");
    kok.style.setProperty("--vv-yuk", (kb ? Math.round(vv.height) : innerHeight) + "px");
    kok.classList.toggle("klavye-acik", kb > 0);
    if (kb > onceki) setTimeout(gorunurYap, 0);   // panel yeni yerine oturduktan sonra
    onceki = kb;
  };
  // visualViewport olayları zaten kare başına bir kez gelir; ayrıca planlamaya gerek yok
  vv.addEventListener("resize", guncelle);
  vv.addEventListener("scroll", guncelle);
  document.addEventListener("focusin", guncelle);
  document.addEventListener("focusout", () => setTimeout(guncelle, 0));
  // Yazdıkça alt satıra inen imleç klavyenin altında kalmasın
  document.addEventListener("input", () => { if (onceki) gorunurYap(); }, { passive: true });
}
klavyeKur();

// Yenilendikten sonra karşılama sorulmaz: "ornek" örneklerle, "bos" boş defterle açılır
const BASLANGIC = "kn-tasarim:baslangic";
function baslangicIstegi() {
  try { const v = sessionStorage.getItem(BASLANGIC); sessionStorage.removeItem(BASLANGIC); return v; }
  catch { return null; }
}
// hepsi: "Her şeyi temizle". Yerel ayarlar (tema, görünüm, ipuçları) ve API anahtarları da silinir.
function durumuSifirla({ hepsi = false } = {}) {
  if (kayit.baskaPencere()) { toast(t("Kitaplık başka bir pencerede açık. Sıfırlamak için o pencereyi kapatıp burayı yenile.")); return; }
  try { sessionStorage.setItem(BASLANGIC, hepsi ? "bos" : "ornek"); } catch { /* gizli pencere: karşılama sorar */ }
  // Asistanın bekleyen sorusu oturum deposunda: kaynağı silinen belgeye bağlı kalmasın, yenilenince panel açılmasın
  try { sessionStorage.removeItem("kn-tasarim:asistan-bekleme"); } catch { /* gizli pencere */ }
  if (hepsi) {
    ayarYazma = false;
    store.sifirlaniyor = true;   // koltuk.js okuma verisini pagehide'da geri yazmasın
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("kn-tasarim:") || k.startsWith("kenar-notu-arama")) localStorage.removeItem(k); } catch { /* gizli pencere */ }
  }
  kayit.sifirla({ hepsi }).finally(() => {
    history.replaceState(null, "", location.pathname + location.search);
    location.reload();
  });
}

/* ================= Tema ve sade hareket ================= */
const koyuMedya = matchMedia("(prefers-color-scheme: dark)");
const metaTema = document.querySelector('meta[name="theme-color"]');
const koyuMu = () => (kok.dataset.theme ? kok.dataset.theme === "dark" : koyuMedya.matches);
let temaZaman = 0;

// Yalnız arayüz renkleri 240ms'de geçer, canvas'lar hariç (tasarim.css .tema-gecisi)
function temaGecisi() {
  kok.classList.add("tema-gecisi");
  clearTimeout(temaZaman);
  temaZaman = setTimeout(() => kok.classList.remove("tema-gecisi"), 300);
}
// 7.0 görünüm (TASARIM-5 4.1): çözülmüş kip, etkin atmosfer, vurgu ve canlı zemin html niteliklerine yazılır.
// Dönen imza değişince ("kip|atmosfer|vurgu|canlı") çağıran geçişi oynatır ve bus "atmosfer" yayınlar.
function gorunumYaz() {
  const kip = koyuMu() ? "gece" : "gunduz";
  const secim = atmosferBul(store.ayarlar.atmosfer) ? store.ayarlar.atmosfer : "aurora";
  const atmosfer = etkinAtmosfer(secim, kip);
  const vurgu = VURGULAR.some((v) => v.id === store.ayarlar.vurgu) ? store.ayarlar.vurgu : null;
  kok.dataset.kip = kip;
  kok.dataset.atmosfer = atmosfer;
  if (vurgu) kok.dataset.vurgu = vurgu; else delete kok.dataset.vurgu;
  // Sade hareket ya da sistemde azaltılmış hareket varken canlı zemin hiç açılmaz (CSS de ayrıca durdurur)
  if (store.ayarlar.canliZemin && !hareketAz()) kok.dataset.canliZemin = ""; else delete kok.dataset.canliZemin;
  return { secim, atmosfer, vurgu, kip, imza: [kip, atmosfer, vurgu, "canliZemin" in kok.dataset].join("|") };
}
let gorunumImza = "";

function ayarlariUygula(ilk = false) {
  const { tema, sadeHareket } = store.ayarlar;
  const oncekiKoyu = koyuMu();
  const yeni = tema === "acik" ? "light" : tema === "koyu" ? "dark" : "";
  const temaDegisti = (kok.dataset.theme || "") !== yeni;
  if (yeni) kok.dataset.theme = yeni; else delete kok.dataset.theme;
  if (sadeHareket) kok.dataset.hareket = "sade"; else delete kok.dataset.hareket;
  const g = gorunumYaz();
  const gorunumDegisti = g.imza !== gorunumImza;
  gorunumImza = g.imza;
  if (!ilk && (temaDegisti || gorunumDegisti)) temaGecisi();
  // Notlarda el yazısı kapalıysa notlar Caveat yerine düz yazıyla (3.2); bütün ekranlar CSS'ten okur
  if (store.ayarlar.elYazisi === false) kok.dataset.notYazi = "duz"; else delete kok.dataset.notYazi;
  yaziBoyutuUygula();
  temaRengi();
  if (!ilk && oncekiKoyu !== koyuMu()) bus.emit("tema", { koyu: koyuMu() });
  if (!ilk && gorunumDegisti) bus.emit("atmosfer", { secim: g.secim, atmosfer: g.atmosfer, vurgu: g.vurgu, kip: g.kip });
  if (!ilk && !oncekiKoyu && koyuMu()) koyuOneri();
}
// Tarayıcı çubuğunun rengi etkin atmosferin zemininden (--tema-rengi). Okuyucu Gece sayfasında kendisi değiştirir,
// kitaplığa dönünce burası geri yazar.
function temaRengi() {
  const renk = getComputedStyle(kok).getPropertyValue("--tema-rengi").trim();
  metaTema?.setAttribute("content", renk || (koyuMu() ? "#141413" : "#F7F5F0"));
}

// Koyu temaya ilk geçişte bir kez: sayfa rengini de koyu yapmayı öner (3.25).
// Sayfa rengi "oto" ise Koltuk sayfası temayla zaten kararır, öneri gereksiz.
function koyuOneri() {
  const r = store.ayarlar.sayfaRengi || "oto";
  if (r === "koyu" || r === "oto" || depo.oku(ANAHTAR.koyuOneri)) return;
  depo.yaz(ANAHTAR.koyuOneri, true);
  toast(t("Gece için sayfa rengini Koyu yapabilirsin"), { etiket: t("Koyu yap"), calistir: () => ayarla({ sayfaRengi: "koyu" }) });
}

// Sistem teması değişince: tema ayarı "oto" ise etkin tema da değişmiştir, sayfalar yeniden boyansın
// Kip değişince etkin atmosfer de değişebilir (OLED gündüzde Grafit olur): data-kip ve data-atmosfer yeniden yazılır.
koyuMedya.addEventListener("change", () => {
  if (!kok.dataset.theme) {
    const g = gorunumYaz();
    if (g.imza !== gorunumImza) { gorunumImza = g.imza; temaGecisi(); bus.emit("atmosfer", { secim: g.secim, atmosfer: g.atmosfer, vurgu: g.vurgu, kip: g.kip }); }
  }
  temaRengi();
  if (!kok.dataset.theme) bus.emit("tema", { koyu: koyuMu() });
  for (const d of ayarDenetimleri) d.guncelle();
});
// Sistemde azaltılmış hareket açılıp kapanınca canlı zemin niteliği de güncellenir
matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => { gorunumImza = gorunumYaz().imza; for (const d of ayarDenetimleri) d.guncelle(); });
bus.on("ayarlar", () => {
  ayarlariUygula();
  ayarlariYaz();
  for (const d of ayarDenetimleri) d.guncelle();
});

/* ================= Bildirim (3.25) ================= */
const bildirimKabi = document.getElementById("bildirimler") || document.body.appendChild(h("div", { id: "bildirimler", "aria-live": "polite" }));
let bildirimKapat = null;
const LISTE_EKRANLARI = /^(kitaplik|izler|tekrar|arama)$/;

function bildirimGoster(metin, eylem) {
  bildirimKapat?.(true);
  const el = h("div", { class: "bildirim" }, h("span", {}, metin));
  let zaman = 0, bitti = false, eylemle = false, elle = false;
  const kaydirinca = () => { if (LISTE_EKRANLARI.test(kok.dataset.ekran || "")) kapat(); };
  // eylem.kalici: kendiliğinden kapanmaz. eylem.kapatilir: yanında kapatma düğmesi olur.
  // eylem.kapaninca(eylemle, elle): bildirim nasıl kapanırsa kapansın bir kez çağrılır (elle: kapatma düğmesiyle)
  const kapat = (hemen = false) => {
    if (bitti) return;
    bitti = true;
    clearTimeout(zaman);
    removeEventListener("wheel", kaydirinca);
    removeEventListener("touchmove", kaydirinca);
    if (bildirimKapat === kapat) bildirimKapat = null;
    try { eylem?.kapaninca?.(eylemle, elle); } catch (hata) { console.warn(hata); }
    if (hemen || hareketAz()) return el.remove();
    el.classList.add("gidiyor");
    setTimeout(() => el.remove(), 200);
  };
  if (eylem?.etiket) {
    el.append(h("button", { type: "button", onclick: () => { eylemle = true; kapat(true); eylem.calistir?.(); } }, eylem.etiket));
  }
  // Kendiliğinden kapanmayan bildirim alttaki kartları örtüp durmasın: her zaman kapatılabilir
  if (eylem?.kapatilir ?? eylem?.kalici) {
    el.append(h("button", { class: "bildirim-kapat", type: "button", "aria-label": t("Kapat"), onclick: () => { elle = true; kapat(true); } }, icon("kapat", "i-20")));
  }
  // Araç çubuğu alttaysa bildirim onun üstünde çıkar
  const altCubuk = $('[data-arac-konum="alt"]');
  if (altCubuk && altCubuk.getClientRects().length) el.classList.add("yukarida");
  const kur = () => { clearTimeout(zaman); if (!eylem?.kalici) zaman = setTimeout(kapat, eylem ? 6000 : 4000); };
  // Süre yalnız fare üstündeyken durur; parmak ya da kalem dokunuşu bildirimi ekranda tutmaz
  el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") clearTimeout(zaman); });
  el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") kur(); });
  // Liste ekranlarında eylemsiz bildirim, okur kaydırmaya başlayınca çekilir: alttaki kartlar örtülü kalmaz.
  // Eylemli olan (örn. Geri al) kalır; düğmeleri dışında dokunuşu alttaki karta geçirir (tasarim.css)
  if (!eylem) {
    addEventListener("wheel", kaydirinca, { passive: true });
    addEventListener("touchmove", kaydirinca, { passive: true });
  }
  el.addEventListener("focusin", () => clearTimeout(zaman));
  el.addEventListener("focusout", kur);
  bildirimKabi.append(el);
  bildirimKapat = kapat;
  kur();
}
setBildirimGosterici(bildirimGoster);

// Kayıt uyarıları kendiliğinden kapanmaz: yazılamayan değişiklik sessizce kaybolmasın.
// Aynı uyarı bir dakika içinde yeniden çıkmaz (her kayıt denemesi yeniden haber verir).
const KAYIT_UYARILARI = {
  yazma: [t("Kayıt yazılamadı; depo dolu olabilir. Kaybetmemek için yedek al."), t("Yedek al"), () => yedekPenceresi()],
  baska: [t("Kenar Notu başka bir pencerede de açık. Burada yapılanlar kaydedilmez; o pencereyi kapatıp burayı yenile."), t("Tamam"), null],
  serbest: [t("Öbür pencere kapandı. Kaydetmek için burayı yenile."), t("Yenile"), () => location.reload()],
  degisti: [t("Kitaplık başka bir pencerede değişti; burada yapılanlar artık kaydedilmiyor. Yenile."), t("Yenile"), () => location.reload()],
  okuma: [t("Kayıt okunamadı; bu oturumda yapılanlar saklanmaz. Sayfayı yenile."), t("Yenile"), () => location.reload()],
};
const kayitUyariZamani = {};
function kayitUyarisi(kod) {
  const u = KAYIT_UYARILARI[kod];
  if (!u || Date.now() - (kayitUyariZamani[kod] || 0) < 60000) return;
  kayitUyariZamani[kod] = Date.now();
  bildirimGoster(u[0], { etiket: u[1], calistir: u[2], kalici: true });
}
bus.on("kayit:uyari", (o) => kayitUyarisi(o?.kod));

/* ================= Küçük yardımcılar ================= */
const sablon = document.createElement("template");
const parca = (html) => { sablon.innerHTML = html.trim(); return sablon.content.firstElementChild; };
const fleuron = () => parca('<svg class="fleuron" viewBox="0 0 28 16" aria-hidden="true"><use href="#i-hedera"/></svg>');
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
// Animasyonun bitişini bekler; sekme çizim yapmıyorsa (arka planda) en geç süre dolunca devam eder
const bitince = (anim, ms) => Promise.race([anim.finished.catch(() => {}), bekle(ms + 250)]);
const yaziAlani = (el) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// 7.0 "Yazan K" (TASARIM-5 7.2): gövde sayfa kenarı, üst kol kalem, alt kol ışıklı mürekkep izi. ikon/ikon.svg ile aynı
// çizim; kimlikler knl- önekli (sayfada aynı anda tek satır içi logo durur: karşılama ya da Hakkında).
// .logo-iz maskesindeki çizgi karşılamada bir kez soldan sağa çizilir (TASARIM-5 7.4; tasarim.css .ilk-acilis)
const LOGO_SVG = `<svg class="logo-svg" viewBox="0 0 512 512" aria-hidden="true"><defs>
<path id="knl-sq" d="M326.4 0c64.97 0 97.45 0 122.26 12.64a116 116 0 0 1 50.69 50.69c12.64 24.81 12.64 57.3 12.64 122.26V326.4c0 64.97 0 97.45 -12.64 122.26a116 116 0 0 1 -50.69 50.69c-24.81 12.64 -57.3 12.64 -122.26 12.64H185.6c-64.97 0 -97.45 0 -122.26 -12.64a116 116 0 0 1 -50.69 -50.69c-12.64 -24.81 -12.64 -57.3 -12.64 -122.26V185.6c0 -64.97 0 -97.45 12.64 -122.26a116 116 0 0 1 50.69 -50.69c24.81 -12.64 57.3 -12.64 122.26 -12.64Z"/>
<clipPath id="knl-kirp"><use href="#knl-sq"/></clipPath>
<linearGradient id="knl-zemin" x1=".32" y1="0" x2=".68" y2="1"><stop offset="0" stop-color="#17153A"/><stop offset="1" stop-color="#0B0C11"/></linearGradient>
<radialGradient id="knl-tepe" cx=".18" cy="-.04" r=".62"><stop offset="0" stop-color="#8B7CFF" stop-opacity=".16"/><stop offset="1" stop-color="#8B7CFF" stop-opacity="0"/></radialGradient>
<radialGradient id="knl-isik" cx=".7" cy=".72" r=".5"><stop offset="0" stop-color="#5B4CF0" stop-opacity=".22"/><stop offset="1" stop-color="#5B4CF0" stop-opacity="0"/></radialGradient>
<linearGradient id="knl-kenar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".04"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".07"/></linearGradient>
<g id="knl-kalem-sekil"><path d="M0 -20H164.25V20H0A20 20 0 0 1 0 -20Z"/><path d="M170.25 -17C194.17 -17 208.25 -7.82 222.25 0C208.25 7.82 194.17 17 170.25 17Z"/></g>
<path id="knl-iz-yol" d="M196.57 284.5C200.47 286.72 211.96 292.73 219.97 297.87C227.99 303.01 236.33 309.07 244.69 315.34C253.04 321.6 261.58 328.55 270.1 335.46C278.62 342.36 287.24 349.71 295.82 356.78C304.39 363.85 313.01 371.13 321.55 377.89C330.09 384.66 338.62 391.39 347.05 397.37C355.48 403.36 367.94 411.08 372.12 413.82A7 7 0 0 0 379.88 402.18C376.23 399.11 365.4 390.45 357.99 383.8C350.57 377.16 343.03 369.79 335.41 362.31C327.79 354.83 320.07 346.83 312.29 338.94C304.51 331.04 296.65 322.84 288.74 314.95C280.82 307.05 272.85 299.06 264.81 291.57C256.76 284.08 248.69 276.69 240.46 270.02C232.23 263.34 219.6 254.59 215.43 251.5A19 19 0 0 0 196.57 284.5Z"/>
<linearGradient id="knl-govde" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCD8FF"/></linearGradient>
<linearGradient id="knl-kalem" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="-20"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F4F3FF"/><stop offset="1" stop-color="#CFCAF7"/></linearGradient>
<linearGradient id="knl-iz" gradientUnits="userSpaceOnUse" x1="206" y1="268" x2="376" y2="408"><stop offset="0" stop-color="#8B7CFF"/><stop offset="1" stop-color="#38C6F0"/></linearGradient>
<filter id="knl-isima" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<mask id="knl-yarik" maskUnits="userSpaceOnUse" x="-40" y="-40" width="320" height="80"><rect x="-40" y="-40" width="320" height="80" fill="#fff"/><g fill="#000"><path d="M188.25 -3H224.25V3H188.25Z"/><circle cx="188.25" cy="0" r="7"/></g></mask>
<mask id="knl-iz-maske" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/><g transform="translate(364 112) rotate(137.55)" fill="#000" stroke="#000" stroke-width="10" stroke-linejoin="round"><use href="#knl-kalem-sekil"/></g></mask>
<mask id="knl-ciz" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><path class="logo-iz" d="M200 262L382 412" pathLength="1" fill="none" stroke="#fff" stroke-width="72" stroke-linecap="round"/></mask>
</defs>
<use href="#knl-sq" fill="url(#knl-zemin)"/><use href="#knl-sq" fill="url(#knl-tepe)"/><use href="#knl-sq" fill="url(#knl-isik)"/>
<use href="#knl-sq" fill="none" stroke="url(#knl-kenar)" stroke-width="3" clip-path="url(#knl-kirp)"/>
<g mask="url(#knl-ciz)"><use href="#knl-iz-yol" fill="url(#knl-iz)" opacity=".45" filter="url(#knl-isima)"/></g>
<rect x="136" y="104" width="40" height="304" rx="20" fill="url(#knl-govde)"/>
<g transform="translate(364 112) rotate(137.55)" fill="url(#knl-kalem)" mask="url(#knl-yarik)"><use href="#knl-kalem-sekil"/></g>
<g mask="url(#knl-ciz)"><use href="#knl-iz-yol" fill="url(#knl-iz)" mask="url(#knl-iz-maske)"/></g>
</svg>`;
// ∫'nin doğum günü (TASARIM-3 nüans 5): 29 Ekim'de logonun altında tek satır kenar notu; kapatılınca o yıl çıkmaz
function ozelGunSatiri() {
  const bugun = new Date(), yil = bugun.getFullYear();
  if (bugun.getMonth() !== 9 || bugun.getDate() !== 29 || Number(store.ayarlar.ozelGun) === yil) return null;
  const el = h("p", { class: "ozel-gun t-aside" },
    h("span", {}, t("Bugün ∫ {yas} yaşında. Leibniz onu ilk kez 29 Ekim 1675’te bir notunda yazdı.", { yas: yil - 1675 })),
    h("button", { type: "button", "aria-label": t("Kenar notunu kapat"), onclick: () => { el.remove(); ayarla({ ozelGun: yil }); } }, icon("kapat", "i-16")));
  return el;
}
const ATAS_SVG = '<svg class="atas" viewBox="0 0 16 46" aria-hidden="true"><path d="M11 15v20a4.5 4.5 0 0 1-9 0V8a6 6 0 0 1 12 0v25" fill="none" stroke="url(#celik)" stroke-width="1.9" stroke-linecap="round"/></svg>';

// Göreli zaman: "az önce", "2 saat önce", "dün", "3 gün önce"
function neZaman(an) {
  const simdi = new Date(), fark = simdi - an;
  if (fark < 6e4) return t("az önce");
  if (fark < 36e5) return t("{n} dakika önce", { n: Math.round(fark / 6e4) });
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const gun = Math.ceil((bugun - an) / 864e5);
  if (gun <= 0) return t("{n} saat önce", { n: Math.round(fark / 36e5) });
  if (gun === 1) return t("dün");
  if (gun < 7) return t("{n} gün önce", { n: gun });
  if (gun < 30) return t("{n} hafta önce", { n: Math.round(gun / 7) });
  if (gun < 365) return t("{n} ay önce", { n: Math.round(gun / 30) });
  return t("bir yıldan uzun süre önce");
}

// Türkçe ve aksan duyarsız arama: her harf tek harfe katlanır, böylece eşleşme konumları korunur
function katla(s) {
  let o = "";
  for (const c of String(s).split("")) {
    const k = c.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
    o += k === "ı" ? "i" : (k[0] || c);
  }
  return o;
}
function vurgula(metin, sorgu) {
  const f = document.createDocumentFragment();
  const q = katla(sorgu.trim());
  if (!q) { f.append(metin); return f; }
  const k = katla(metin);
  let i = 0, j;
  while ((j = k.indexOf(q, i)) !== -1) {
    if (j > i) f.append(metin.slice(i, j));
    f.append(h("mark", { class: "eslesme" }, metin.slice(j, j + q.length)));
    i = j + q.length;
  }
  if (i < metin.length) f.append(metin.slice(i));
  return f;
}

// Belge bilgileri
const KAGIT_SINIF = { blank: "k-bos", lined: "k-cizgili", grid: "k-kareli", dotted: "k-noktali", cornell: "k-cornell" };
const kagitAdi = (id) => t(TEMPLATES.find((x) => x.id === id)?.label || "Boş");
// Çok anlamlı kısa adlar sözlükte başka kolla çakışabilir (tekrar.js "Tekrar" = Again, okuma.js "Bitti" = Done),
// bu yüzden alan ve raf adı burada dil ile dallanır
const TEKRAR_ADI = ingilizceMi ? "Review" : "Tekrar";
const BITTI_RAF = ingilizceMi ? "Finished" : "Bitti";
const soyad = (yazar = "") => yazar.trim().split(/\s+/).pop() || "";
const klasorBul = (id) => KLASORLER.find((k) => k.id === id);
const turAdi = (b) => (cizgiMi(b) ? t("Çizgi roman") : b.tur === "pdf" ? "PDF" : b.tur === "epub" ? "EPUB" : t("Defter"));
function ilerlemeOrani(b) {
  if (b.tur === "epub") return Math.min(1, b.ilerleme || 0);
  return b.sayfaSayisi ? Math.min(1, (b.sayfa || 1) / b.sayfaSayisi) : 0;
}
// Çizgi romanın künyesi: "Sayı 3" ya da "#3"; yoksa sayfa sayısı
const cizgiKunye = (b) => (b.sayi ? t("Sayı {n}", { n: b.sayi }) : t("{n} sayfa", { n: b.sayfaSayisi || 1 }));
function etiketMetni(b) {
  if (cizgiMi(b)) return b.seri ? `${b.seri} · ${cizgiKunye(b)}` : `${t("Çizgi roman")} · ${cizgiKunye(b)}`;
  // Serideki kitap (K8): seri adı ve cilt numarası
  if (b.seri && b.tur !== "defter") return `${b.seri}${b.cilt ? ` · ${b.cilt}` : ""}`;
  if (b.tur === "pdf") return `PDF · ${t("{n} sayfa", { n: b.parolali ? "?" : String(b.sayfaSayisi) })}`;
  // EPUB'da türü bez cilt anlatır; dar hücrede yazarın adı kesilmesin diye yalnız soyadı
  if (b.tur === "epub") return soyad(b.yazar) || "EPUB";
  return `${t("Defter")} · ${kagitAdi(b.kagit)}`;
}
function konumMetni(b) {
  if (b.tur === "epub") return `EPUB · ${t("%{n}", { n: Math.round(ilerlemeOrani(b) * 100) })}`;
  if (b.parolali) return t("PDF · parolalı · ? sayfa");
  return t("{tur} · s. {sayfa} / {toplam}", { tur: turAdi(b), sayfa: b.sayfa || 1, toplam: b.sayfaSayisi || 1 });
}
// Tembel yüklenen ekran modülü açılamadı. SyntaxError: eksik dışa aktarım, yani sayfa eski sürümde kaldı
function modulHatasi(hata, metin) {
  if (hata instanceof SyntaxError) guncellemeVar();
  else toast(metin);
}
function guncellemeVar() {
  if (guncellemeVar.soylendi) return;
  guncellemeVar.soylendi = true;
  toast(t("Kenar Notu güncellendi. Yeni sürümü açmak için yenile."), {
    kalici: true, etiket: t("Yenile"),
    calistir: async () => { await kayit.hemenKaydet({ tam: true }); location.reload(); },
  });
}
function ciltRengi(ad = "") {
  let t = 0;
  for (const c of String(ad ?? "")) t = (t * 31 + c.charCodeAt(0)) >>> 0;
  return CILT_RENKLERI[t % CILT_RENKLERI.length];
}

/* ================= Fiş yöneticisi ================= */
// Yeni menüsü, bağlam menüleri ve Ayarlar aynı kâğıt fişi kullanır; ekrana sabitlenir.
let aktifFis = null;
let ayarDenetimleri = [];

function fisAc(capa, icerik, { hiza = "alt-sag", sinif = "", rol = "menu", etiket, klavye = false, kapaninca } = {}) {
  fisKapat(true);
  const el = h("div", { class: `fis fis-sabit ${sinif}`.trim(), role: rol, tabindex: "-1", "aria-label": etiket });
  el.append(...[icerik].flat().filter((x) => x != null && x !== false));
  document.body.append(el);
  const capaEl = capa instanceof Element ? capa : null;

  const konumla = () => {
    const r = capaEl ? capaEl.getBoundingClientRect() : capa;
    const w = el.offsetWidth, y = el.offsetHeight, vw = innerWidth, vh = innerHeight, b = 8;
    let x, t, ox = "left", oy = "top";
    if (hiza === "yan") {
      x = r.right + 10; t = r.top;
      if (x + w > vw - b) { x = r.left - w - 10; ox = "right"; }
      if (x < b) { x = r.left + (r.width - w) / 2; t = r.bottom + 8; ox = "center"; }
    } else if (hiza === "ust-sol") {
      x = r.left; t = r.top - y - 8; oy = "bottom";
      if (t < b) { t = r.bottom + 8; oy = "top"; }
    } else {
      x = hiza === "alt-sag" ? r.right - w : r.left;
      ox = hiza === "alt-sag" ? "right" : "left";
      t = r.bottom + 8;
      if (t + y > vh - b && r.top - y - 8 > b) { t = r.top - y - 8; oy = "bottom"; }
    }
    x = Math.min(Math.max(b, x), vw - w - b);
    t = Math.min(Math.max(b, t), vh - y - b);
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(t)}px`;
    el.style.transformOrigin = `${ox} ${oy}`;
  };

  // Dışarı dokunmak fişi kapatır ve o dokunuşu yutar (Android menüleri gibi)
  const disari = (e) => {
    if (el.contains(e.target) || capaEl?.contains(e.target)) return;
    tiklamaYut();
    kapat();
  };
  const tus = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); kapat(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const ogeler = $$("button:not([disabled]), input, [href]", el).filter((o) => o.getClientRects().length);
    if (!ogeler.length) return;
    e.preventDefault();
    const i = ogeler.indexOf(document.activeElement);
    const yon = e.key === "ArrowDown" ? 1 : -1;
    ogeler[(i + yon + ogeler.length) % ogeler.length].focus();
  };
  const kapat = (hemen = false) => {
    if (aktifFis !== kayit) return;
    aktifFis = null;
    document.removeEventListener("pointerdown", disari, true);
    document.removeEventListener("keydown", tus, true);
    removeEventListener("resize", konumla);
    const odakIcerde = el.contains(document.activeElement);
    kapaninca?.();
    if (hemen || hareketAz()) el.remove();
    else { el.classList.add("kapaniyor"); setTimeout(() => el.remove(), 140); }
    if (odakIcerde && capaEl?.isConnected) capaEl.focus({ preventScroll: true });
  };
  const kayit = { el, kapat, konumla, capa: capaEl, kaydirma: K.icerik?.scrollTop };
  aktifFis = kayit;
  konumla();
  document.addEventListener("pointerdown", disari, true);
  document.addEventListener("keydown", tus, true);
  addEventListener("resize", konumla);
  el.focus({ preventScroll: true });
  if (klavye) $("button, input, [href]", el)?.focus({ preventScroll: true });
  return kayit;
}
function fisKapat(hemen = false) { aktifFis?.kapat(hemen); }

function tiklamaYut() {
  const yut = (e) => { e.stopPropagation(); e.preventDefault(); };
  document.addEventListener("click", yut, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", yut, true), 450);
}

function fisSatir(ikonAdi, ad, aciklama, fn) {
  return h("button", { class: "fis-satir", type: "button", role: "menuitem", onclick: fn },
    icon(ikonAdi, "i-20"), h("span", {}, ad), aciklama ? h("small", {}, aciklama) : null);
}
function secenekSatir(onEk, ad, secili, fn) {
  return h("button", { class: "fis-satir secenek", type: "button", role: "menuitemradio", "aria-checked": String(secili), onclick: fn },
    onEk, h("span", {}, ad), secili ? icon("tik", "i-20") : h("span"));
}
// İki dokunuşla onay: ilk dokunuşta "Emin misin?" ve 3 sn geri sayım çizgisi (3.13)
function onayla(dugme, etiket, onayMetni, fn) {
  let zaman = 0;
  const asil = etiket.textContent;
  const sifirla = () => { delete dugme.dataset.durum; etiket.textContent = asil; };
  dugme.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dugme.dataset.durum === "emin") { clearTimeout(zaman); sifirla(); fn(); return; }
    dugme.dataset.durum = "emin";
    etiket.textContent = onayMetni;
    zaman = setTimeout(sifirla, 3000);
  });
}
function silSatiri(ad, fn) {
  const etiket = h("span", {}, ad);
  const d = h("button", { class: "fis-satir onayli", type: "button", role: "menuitem" }, icon("sil", "i-20"), etiket);
  onayla(d, etiket, t("Emin misin? Tekrar dokun"), fn);
  return d;
}

// Uzun basma (500ms) ve sağ tık aynı bağlam fişini açar; uzun basıştan sonraki tıklama yutulur
// sagTik: sağ tık başka iş yapacaksa (kapaklarda uzun basma seçim kipini açar, sağ tık bağlam fişini)
function uzunBasma(el, ac, sagTik = ac) {
  let zaman = 0, x0 = 0, y0 = 0, tetik = false, sonTur = "";
  const iptal = () => clearTimeout(zaman);
  el.addEventListener("pointerdown", (e) => {
    tetik = false;
    sonTur = e.pointerType;
    if (e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY;
    iptal();
    zaman = setTimeout(() => {
      tetik = true;
      try { navigator.vibrate?.(8); } catch { /* titreşim yok */ }
      ac();
    }, 500);
  });
  el.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) iptal(); });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, iptal);
  el.addEventListener("keydown", () => { tetik = false; });
  el.addEventListener("click", (e) => {
    if (!tetik) return;
    tetik = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    iptal();
    // Dokunmatikte tarayıcının kendi uzun basma olayı da contextmenu'dur: o zaman uzun basma sayılır
    if (!tetik) { tetik = true; (sonTur && sonTur !== "mouse" ? ac : sagTik)(); }
  });
  el.addEventListener("dragstart", (e) => e.preventDefault());
}

/* ================= Kapaklar (3.6) ================= */
// PDF kapağı: üstteki yaprak belgenin kendi ilk örnek sayfasının küçük resmi, bir kez çizilip önbellekte tutulur.
// Sayfalar Literata ile dizilir: yazı tipleri gelmeden çizilen kapaklar gelince yeniden çizilir.
const ornekListe = (id) => (typeof SAYFALAR.ornekSayfalari === "function" && SAYFALAR.ornekSayfalari(id)) || PDF_PAGES;
const kapakOnbellek = new Map();
let kapakYaziHazir = false;
Promise.resolve(SAYFALAR.yaziTipleri).catch(() => false).then(() => {
  kapakYaziHazir = kapakCizilebilir = true;
  kapakPlanla();
  if (!kapakOnbellek.size) return;
  kapakOnbellek.clear();
  kitaplikYenile();
});
// Kapaklar ilk boyamayı bekletmez: tuval boş yaprak olarak hemen yerine konur, sayfa boş anda kapak kapak çizilir.
// Yazı tipleri gelmeden çizilmez (yedek fontla çizip yeniden çizmek iki kat sürüyordu); en çok 3 sn beklenir.
let kapakCizilebilir = false;
setTimeout(() => { kapakCizilebilir = true; kapakPlanla(); }, 3000);
const kapakBekleyen = new Map();   // anahtar -> { id, w, tuvaller }
let kapakPlan = 0;
const kapakAnahtari = (id, w) => `${id}:${w}:${devicePixelRatio}:${kapakYaziHazir}`;

function pdfKapakCiz(canvas, id, w) {
  const dpr = devicePixelRatio || 1, yuk = Math.round(w * PH / PW);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(yuk * dpr);
  const ctx = canvas.getContext("2d");
  // Küçük kapak, büyüğü çizildiyse ondan küçültülür: sayfa bir kez daha baştan çizilmez
  const buyuk = w < 200 && kapakOnbellek.get(kapakAnahtari(id, 200));
  if (buyuk) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buyuk, 0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.scale(dpr * w / PW, dpr * w / PW);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, PW, PH);
  ornekListe(id)[0]?.draw(ctx);
}
const kapakKopyala = (kaynak, c) => {
  c.width = kaynak.width; c.height = kaynak.height;
  c.getContext("2d").drawImage(kaynak, 0, 0);
  delete c.dataset.bekliyor;   // kâğıt yer tutucusu söner
};
function pdfKanvas(id, w) {
  const anahtar = kapakAnahtari(id, w), kaynak = kapakOnbellek.get(anahtar);
  const c = document.createElement("canvas");
  if (kaynak) { kapakKopyala(kaynak, c); return c; }
  const dpr = devicePixelRatio || 1;
  c.width = Math.round(w * dpr); c.height = Math.round(Math.round(w * PH / PW) * dpr);
  c.dataset.bekliyor = "";     // çizilene kadar kâğıt dokusunda soluk satırlar (tasarim.css)
  if (!kapakBekleyen.has(anahtar)) kapakBekleyen.set(anahtar, { id, w, tuvaller: [] });
  kapakBekleyen.get(anahtar).tuvaller.push(c);
  kapakPlanla();
  return c;
}
// Boş anda bir kapak: önce büyükler (küçükler onlardan küçültülür)
function kapakPlanla() {
  if (kapakPlan || !kapakCizilebilir || !kapakBekleyen.size) return;
  const isle = () => {
    kapakPlan = 0;
    if (!kapakCizilebilir || !kapakBekleyen.size) return;
    const [anahtar, is] = [...kapakBekleyen].sort((a, b) => b[1].w - a[1].w)[0];
    kapakBekleyen.delete(anahtar);
    // Yazı tipleri bu arada geldiyse eski anahtarlı istek yenisiyle çizilir
    const guncel = kapakAnahtari(is.id, is.w);
    let kaynak = kapakOnbellek.get(guncel);
    if (!kaynak) {
      kaynak = document.createElement("canvas");
      pdfKapakCiz(kaynak, is.id, is.w);
      kapakOnbellek.set(guncel, kaynak);
    }
    for (const c of is.tuvaller) kapakKopyala(kaynak, c);
    kapakPlanla();
  };
  kapakPlan = bosta(isle, { timeout: 120 });
}

// Kapak başlığı büyük harf ve geniş aralıkla dizilir: tek uzun sözcük (İngilizce "METAMORPHOSIS") kapaktan taşmasın diye küçülür
function kapakAdi(ad) {
  const enUzun = Math.max(0, ...String(ad || "").split(/\s+/).map((s) => s.length));
  return h("p", { class: "ad", "data-uzun": enUzun >= 12 ? "2" : enUzun >= 9 ? "1" : null }, ad);
}
function kapakOlustur(b, { mini = false } = {}) {
  let el;
  if (b.kapakElle && b.kapakGorsel && !cizgiMi(b)) {
    // Künyede seçilen kapak (K8): her türde bez cildin yerinde
    el = h("div", { class: "kapak-kitap gorselli", style: `--c:${b.kapak || ciltRengi(b.ad)}` },
      h("img", { class: "kapak-gorsel", src: b.kapakGorsel, alt: "", decoding: "async", draggable: "false" }));
  } else if (b.parolali && !b.kapakGorsel) {
    // Parolalı PDF (K11): kilitli, adla basılmış cilt; parola girilince Masa sayfaları açar
    el = h("div", { class: "kapak-kitap kilitli", style: `--c:${b.kapak || ciltRengi(b.ad)}` });
    if (!mini) el.append(h("div", { class: "cerceve" }), h("div", { class: "yazi" }, kapakAdi(b.ad), fleuron(), h("span", { class: "yazar" }, "PDF")));
    el.append(h("span", { class: "kapak-kilit" }, icon("kilit", mini ? "i-16" : "i-20")));
  } else if (cizgiMi(b)) {
    // Çizgi roman: kapak görseli mylar poşette; görsel yoksa adla basılmış renkli kapak
    el = h("div", { class: "kapak-cizgi" + (b.kapakGorsel ? " gorselli" : ""), style: `--c:${b.kapak || ciltRengi(b.ad)}` },
      b.kapakGorsel ? h("img", { class: "kapak-gorsel", src: b.kapakGorsel, alt: "", decoding: "async", draggable: "false" })
        : mini ? null : h("div", { class: "yazi" }, h("b", {}, b.ad), b.sayi ? h("small", {}, `#${b.sayi}`) : null));
  } else if (b.dosya && b.tur === "pdf" && b.kapakGorsel) {
    // İçe aktarılan PDF: ilk sayfanın küçük görüntüsü
    el = h("div", { class: "kapak-pdf" }, h("div", { class: "yaprak" }, h("img", { class: "kapak-gorsel", src: b.kapakGorsel, alt: "", decoding: "async", draggable: "false" })));
    if (!mini) el.append(parca(ATAS_SVG));
  } else if (b.dosya && b.tur === "epub" && b.kapakGorsel) {
    el = h("div", { class: "kapak-kitap gorselli", style: `--c:${b.kapak || ciltRengi(b.ad)}` },
      h("img", { class: "kapak-gorsel", src: b.kapakGorsel, alt: "", decoding: "async", draggable: "false" }));
  } else if (b.dosya) {
    // Kapak görseli yoksa adla basılmış kumaş cilt (PDF de)
    el = h("div", { class: "kapak-kitap", style: `--c:${b.kapak || ciltRengi(b.ad)}` });
    if (!mini) {
      el.append(h("div", { class: "cerceve" }),
        h("div", { class: "yazi" }, kapakAdi(b.ad), fleuron(), h("span", { class: "yazar" }, b.tur === "pdf" ? "PDF" : soyad(b.yazar))));
    }
  } else if (b.tur === "pdf") {
    el = h("div", { class: "kapak-pdf" }, h("div", { class: "yaprak" }, pdfKanvas(b.id, mini ? 72 : 200)));
    if (!mini) el.append(parca(ATAS_SVG));
  } else if (b.tur === "epub") {
    el = h("div", { class: "kapak-kitap", style: `--c:${b.kapak || ciltRengi(b.ad)}` });
    if (!mini) {
      el.append(h("div", { class: "cerceve" }),
        h("div", { class: "yazi" }, kapakAdi(b.ad), fleuron(), h("span", { class: "yazar" }, soyad(b.yazar))));
    }
  } else {
    const renk = KAPAK_RENKLERI.find(([, c]) => c.toLowerCase() === String(b.kapak).toLowerCase());
    el = h("div", { class: "kapak-defter" + (renk?.[2] ? " acik-renk" : ""), style: `--c:${b.kapak || KAPAK_RENKLERI[0][1]}` },
      h("div", { class: "etiket" }, h("b", {}, b.ad), h("small", {}, kagitAdi(b.kagit).toLocaleUpperCase(yerel))));
  }
  el.setAttribute("aria-hidden", "true");
  if (b.favori && !mini) el.append(h("i", { class: "fav" }));
  // Sık açılan kitabın bez cildi aşınır: 4, 12 ve 30 açılışta bir basamak (TASARIM-3 nüans 8)
  const n = Number(b.acilma) || 0;
  if (n >= 4) el.dataset.asinma = n >= 30 ? "3" : n >= 12 ? "2" : "1";
  return el;
}

/* ================= Kitaplık ================= */
const GORUNUMLER = [
  { id: "tumu", ad: t("Tümü"), baslik: t("Kitaplık"), ikon: "tumu" },
  { id: "kitaplar", ad: t("Kitaplar"), ikon: "kitap" },
  { id: "defterler", ad: t("Defterler"), ikon: "defter" },
  { id: "cizgiler", ad: t("Çizgi romanlar"), ikon: "cizgi-roman" },
  { id: "favoriler", ad: t("Favoriler"), ikon: "yildiz" },
  { id: "kirpilanlar", ad: t("Kırpılanlar"), ikon: "kirp" },
  // 7.0 okuma rafları (K7) ve çöp kutusu (K5): kenar çubuğunda ayrı bölümlerde
  { id: "okunacak", ad: t("Okunacak"), ikon: "raf-okunacak", raf: true },
  { id: "okunuyor", ad: t("Okunuyor"), ikon: "raf-okunuyor", raf: true },
  { id: "bitti", ad: BITTI_RAF, ikon: "raf-bitti", raf: true },
  { id: "cop", ad: t("Son silinenler"), ikon: "sil" },
];
const ANA_GORUNUMLER = GORUNUMLER.filter((g) => !g.raf && g.id !== "cop");
const COP_GUN_METNI = t("{n} gün sonra kalıcı silinir", { n: kayit.COP_GUN });
const YENILIK_SURUMU = "7.1";
const RAF_GORUNUMLER = GORUNUMLER.filter((g) => g.raf);
// 7.0 kabuk simgeleri (TASARIM-5 6.12): raflar, seçim, künye; kapalı şekiller ikili ton (class="d")
simgeEkle("raf-okunacak", '<path class="d" d="M7 3.5h10v17l-5-3.9-5 3.9Z"/><path d="M10 9h4"/>');
simgeEkle("raf-okunuyor", '<path class="d" d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5V6.5Z"/><path d="M12 6.5c2-1.5 5-2 8.5-1.5v13c-3.5-.5-6.5 0-8.5 1.5M15 10.5h3"/>');
simgeEkle("raf-bitti", '<circle class="d" cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9"/>');
simgeEkle("sec", '<rect class="d" x="4" y="4" width="16" height="16" rx="4"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>');
simgeEkle("kunye", '<path class="d" d="M6 3.5h9l3.5 3.5v13.5H6Z"/><path d="M15 3.5V7h3.5M9 11h6M9 14h6M9 17h3.5"/>');
simgeEkle("sirala", '<path d="M7 5v14M4 16l3 3 3-3M13 7h7M13 12h5M13 17h3"/>');
simgeEkle("klavye", '<rect class="d" x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 12.5h.01M18 12.5h.01M8.5 15h7"/>');
simgeEkle("yildizlar", '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle class="d" cx="12" cy="12" r="2.6"/>');
const KLASOR_RENKLERI = ["#1F6B52", "#5F6B2A", "#1C6E7D", "#B8507A", "#7D1D2C", "#B5652B", "#2F4FA2"];

const tercih = Object.assign({ secim: "tumu", siralama: "son", duzen: "izgara" }, depo.oku(ANAHTAR.kitaplik) || {});
const tercihKaydet = () => depo.yaz(ANAHTAR.kitaplik, tercih);
// 7.0 sıralama (K7): store.ayarlar.kitaplikSiralama. Eski kayıtta kitaplık tercihindeki "son" ya da "ad" taşınır
const SIRALAMALAR = [["son", t("Son açılan")], ["ad", t("Ad")], ["yazar", t("Yazar")], ["ilerleme", t("İlerleme")], ["eklenme", t("Eklenme")]];
const siralamaAl = () => {
  const s = store.ayarlar.kitaplikSiralama ?? tercih.siralama;
  return SIRALAMALAR.some(([id]) => id === s) ? s : "son";
};
// Okuma rafı (K7): elle seçilen (b.raf) ya da ilerlemeden türetilen. Defter rafta durmaz.
// Ders notu (bir derse bağlı ya da elle Masa'ya geçirilmiş PDF) okunmak için eklenmemiştir: başlanmamışsa
// Okunacak'ta sayılmaz. Yalnız açık işarete bakılır; b.mod'suz PDF kitap eskisi gibi raflarda kalır
const RAFLAR = ["okunacak", "okunuyor", "bitti"];
const calismaBelgesi = (b) => b.tur === "pdf" && !cizgiMi(b) && (!!klasorBul(b.klasor) || b.mod === "masa");
function rafIlerleme(b) {
  if (b.tur === "epub") return Math.min(1, b.ilerleme || 0);
  return (b.sayfa || 1) <= 1 || !b.sayfaSayisi ? 0 : Math.min(1, b.sayfa / b.sayfaSayisi);
}
function rafAl(b) {
  if (b.tur === "defter") return null;
  if (RAFLAR.includes(b.raf)) return b.raf;
  const p = rafIlerleme(b);
  if (b.odunc?.bitti || p > 0.98) return "bitti";
  if (p > 0) return "okunuyor";
  return calismaBelgesi(b) ? null : "okunacak";
}
let arama = "";
let kitaplikKirli = false;
let sessiz = false;   // kendi yaptığımız yerinde güncellemelerde yeniden çizimi atla
const K = {};         // kitaplık öğeleri

const darMedya = matchMedia("(max-width: 999px)");

function secimFiltresi(secim) {
  if (secim === "kitaplar") return (b) => b.tur !== "defter" && !cizgiMi(b);
  if (secim === "defterler") return (b) => b.tur === "defter";
  if (secim === "cizgiler") return cizgiMi;
  if (secim === "favoriler") return (b) => b.favori;
  if (RAFLAR.includes(secim)) return (b) => !b.dizgi && rafAl(b) === secim;
  if (secim.startsWith("klasor:")) { const id = secim.slice(7); return (b) => b.klasor === id; }
  return () => true;
}
function sayilar() {
  const s = { tumu: store.belgeler.length, kitaplar: 0, defterler: 0, cizgiler: 0, favoriler: 0, kirpilanlar: store.kirpintilar.length,
    okunacak: 0, okunuyor: 0, bitti: 0, cop: store.cop.length };
  for (const b of store.belgeler) {
    if (b.tur === "defter") s.defterler++; else if (cizgiMi(b)) s.cizgiler++; else s.kitaplar++;
    if (b.favori) s.favoriler++;
    if (b.klasor) s["klasor:" + b.klasor] = (s["klasor:" + b.klasor] || 0) + 1;
    const r = rafAl(b);
    if (r) s[r]++;
  }
  return s;
}
// Sıralama kararlıdır: aynı değerde ikincil ölçüt ad (K7 kabul 5). Aynı serideki kitaplar ilk üyenin yerinde,
// cilt sırasıyla yan yana durur (K8)
const adSirasi = (a, b) => String(a.ad || "").localeCompare(String(b.ad || ""), yerel, { sensitivity: "base", numeric: true }) || String(a.id).localeCompare(String(b.id));
const ekZamani = (b) => b.eklenme ?? b.acilis ?? 0;
function sirala(liste, siralama = siralamaAl()) {
  const l = [...liste];
  const olcut = {
    son: (a, b) => (b.acilis || 0) - (a.acilis || 0),
    ad: () => 0,
    yazar: (a, b) => { const x = soyad(a.yazar), y = soyad(b.yazar); return (!x - !y) || x.localeCompare(y, yerel, { sensitivity: "base" }); },
    ilerleme: (a, b) => ilerlemeOrani(b) - ilerlemeOrani(a),
    eklenme: (a, b) => ekZamani(b) - ekZamani(a),
  }[siralama] || (() => 0);
  l.sort((a, b) => olcut(a, b) || adSirasi(a, b));
  return seriyeDiz(l);
}
// Seri: ilk görülen üyenin yerine bütün seri cilt sırasıyla gelir (dizgi kartları serisiz)
function seriyeDiz(l) {
  const seriler = new Map();
  for (const b of l) if (b.seri && !b.dizgi && !cizgiMi(b)) { const k = katla(b.seri); seriler.set(k, [...(seriler.get(k) || []), b]); }
  if (![...seriler.values()].some((x) => x.length > 1)) return l;
  const sonuc = [], konan = new Set();
  for (const b of l) {
    if (konan.has(b)) continue;
    const uyeler = b.seri && !b.dizgi && !cizgiMi(b) ? seriler.get(katla(b.seri)) : null;
    if (!uyeler || uyeler.length < 2) { sonuc.push(b); konan.add(b); continue; }
    for (const u of [...uyeler].sort((x, y) => (Number(x.cilt) || 1e9) - (Number(y.cilt) || 1e9) || adSirasi(x, y))) { sonuc.push(u); konan.add(u); }
  }
  return sonuc;
}
const eslesir = (metin, q) => katla(metin).includes(katla(q));

// gizli: açılış ekranı başka (adreste belge, Tekrar ya da arama). Kartlar ve kapaklar dönüşte çizilir (kitapligaDon)
function kitaplikKur({ gizli = false } = {}) {
  K.ekran = h("section", { class: "ekran ekran-kitaplik", "aria-label": t("Kitaplık") });

  // Kenar çubuğu
  K.kenar = h("nav", { class: "kenar-cubugu", id: "kenar-cubugu", "aria-label": t("Kitaplık bölümleri") });
  K.navOgeler = new Map();
  const navOgesi = (secim, onEk, ad) => {
    const sayi = h("span", { class: "sayi" });
    const a = h("a", { href: `#kitaplik/${secim}` }, onEk, h("span", { class: "ad" }, ad), sayi);
    a.addEventListener("click", (e) => { e.preventDefault(); gorunumSec(secim); });
    K.navOgeler.set(secim, { a, sayi });
    return a;
  };
  K.klasorListe = h("div", { class: "gezinme" });
  K.navOgesi = navOgesi;
  K.ayarlarDugme = h("button", { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, icon("ayarlar"), h("span", { class: "ad" }, t("Ayarlar")));
  K.ayarlarDugme.addEventListener("click", () => ayarlarAc({ acan: K.ayarlarDugme }));
  // Tekrar girişi (TASARIM-2 3.3): logonun altında, bugün bekleyen kart sayısı yuvarlanan camda
  K.tekrarAlt = h("small");
  K.tekrarHaneler = [0, 1].map(() => h("i", { style: "--n:0" }, "0123456789"));
  K.tekrarCam = h("span", { class: "cam sayac soluk", "aria-hidden": "true" }, K.tekrarHaneler.map((i) => h("span", { class: "hane" }, i)));
  K.tekrar = h("a", { class: "tekrar-giris", href: "#tekrar" },
    icon("tekrar", "i-20"), h("span", {}, h("b", {}, TEKRAR_ADI), K.tekrarAlt), K.tekrarCam);
  K.tekrar.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "tekrar" }); });
  // Her yerde ara (OZELLIKLER-4 §1.3): bütün belgelerin metni ve notları
  K.araGiris = h("a", { class: "ara-giris", href: "#arama", title: t("Her yerde ara (Ctrl+K)") },
    icon("ara"), h("span", { class: "ad" }, t("Ara")), h("kbd", { class: "kisayol", "aria-hidden": "true" }, "Ctrl K"));
  K.araGiris.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "arama", terim: arama.trim() || undefined }); });
  // İzlerim (OZELLIKLER-5): bütün kitaplarda kalemin değdiği yerler, cep defterleri ve derlemeler
  K.izlerGiris = h("a", { class: "izler-giris", href: "#izler" }, icon("izler"), h("span", { class: "ad" }, t("İzlerim")));
  K.izlerGiris.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "izler" }); });
  // 7.0 (TASARIM-5 7.3, 8.1): üstte 28 px simge ve kelime işareti; etkin öğenin solunda kayan ışık çizgisi
  K.isik = h("i", { class: "gezinme-isik", "aria-hidden": "true", hidden: true });
  K.kenarIc = h("div", { class: "kenar-cubugu__ic" },
    K.isik,
    markaOgesi(),
    ozelGunSatiri(),
    K.tekrar,
    h("div", { class: "gezinme gezinme-ara" }, K.araGiris, K.izlerGiris),
    h("div", { class: "gezinme" }, ANA_GORUNUMLER.map((g) => navOgesi(g.id, icon(g.ikon), g.ad))),
    h("div", { class: "bolum-basi" }, h("span", { class: "t-etiket" }, t("Okuma rafları"))),
    h("div", { class: "gezinme gezinme-raf" }, RAF_GORUNUMLER.map((g) => navOgesi(g.id, icon(g.ikon), g.ad))),
    h("div", { class: "bolum-basi" },
      h("span", { class: "t-etiket" }, t("Klasörler")),
      h("button", { type: "button", "aria-label": t("Yeni klasör"), onclick: yeniKlasor }, icon("arti", "i-20"))),
    K.klasorListe,
    h("div", { class: "gezinme gezinme-cop" }, navOgesi("cop", icon("sil"), t("Son silinenler"))));
  K.kenar.append(
    K.kenarIc,
    h("div", { class: "kenar-cubugu__alt gezinme" },
      h("button", { type: "button", onclick: () => yedekPenceresi() }, icon("yedekle"), h("span", { class: "ad" }, t("Yedekle"))),
      K.ayarlarDugme));
  klasorlerCiz();

  // Çekmece (dar ekran): perde, kaydırarak kapatma
  K.perde = h("div", { class: "cekmece-perde", hidden: true, onclick: cekmeceKapat });
  let x0 = null, y0 = 0;
  K.kenar.addEventListener("pointerdown", (e) => { if (darMedya.matches && e.pointerType !== "mouse") { x0 = e.clientX; y0 = e.clientY; } });
  K.kenar.addEventListener("pointerup", (e) => {
    if (x0 !== null && x0 - e.clientX > 56 && Math.abs(e.clientY - y0) < x0 - e.clientX) cekmeceKapat();
    x0 = null;
  });
  K.kenar.addEventListener("pointercancel", () => { x0 = null; });

  // Başlık satırı
  K.menuDugme = h("button", { class: "ikon-dugme menu-dugme", type: "button", "aria-label": t("Menü"), "aria-controls": "kenar-cubugu", "aria-expanded": "false", onclick: cekmeceAc }, icon("menu"));
  K.baslik = h("h1", { class: "t-b1" });
  K.altBaslik = h("p");
  K.aramaGirdi = h("input", { type: "search", placeholder: t("Kitaplıkta ara"), "aria-label": t("Kitaplıkta ara"), enterkeyhint: "search", autocomplete: "off", spellcheck: "false" });
  K.aramaTemizle = h("button", { class: "arama-temizle", type: "button", "aria-label": t("Aramayı temizle"), hidden: true }, icon("kapat"));
  // Sağda kısayol ipucu (6.7; yalnız fare ve klavyede): "/" kitaplıkta arar
  K.arama = h("label", { class: "arama" }, icon("ara"), K.aramaGirdi, K.aramaTemizle, h("kbd", { class: "kisayol arama-ipucu", "aria-hidden": "true" }, "/"));
  // Hızlı yazarken her harfte bütün kitaplık yeniden kurulmaz: yazma durunca (büyük kitaplıkta harf başına 350 ms)
  let aramaZaman = 0;
  K.aramaGirdi.addEventListener("input", () => {
    clearTimeout(aramaZaman);
    aramaZaman = setTimeout(() => aramaYap(K.aramaGirdi.value), store.belgeler.length > 60 ? 140 : 0);
  });
  K.aramaGirdi.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && K.aramaGirdi.value) { e.stopPropagation(); aramaYap(""); }
    // Enter: yazılı terim varsa bütün kitaplıkta aranır, yoksa yalnız klavye kapanır
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      const q = K.aramaGirdi.value.trim();
      K.aramaGirdi.blur();
      if (q) herYerdeAra(q);
    }
  });
  K.aramaTemizle.addEventListener("click", (e) => { e.preventDefault(); aramaYap(""); K.aramaGirdi.focus(); });

  // 7.0 sıralama (K7): beş ölçüt; araç satırında yer kaplamasın diye seçili ölçütü gösteren düğme ve menü.
  // Kırpılanlar panosunda iki ölçüt: En yeni, Belge
  K.sirAd = h("span", { class: "siralama__ad" });
  K.siralama = h("button", { class: "siralama-dugme", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" },
    icon("sirala", "i-20"), K.sirAd, icon("asagi", "i-16"));
  K.siralama.addEventListener("click", (e) => siralamaMenusu(e.detail === 0));

  const duzBtn = (deger, ad, ik) => {
    const d = h("button", { class: "ikon-dugme", type: "button", "aria-pressed": "false", "aria-label": ad }, icon(ik, "i-22"));
    d.addEventListener("click", () => { tercih.duzen = deger; tercihKaydet(); araclarGuncelle(); sonucCiz(true); });
    return d;
  };
  K.duzIzgara = duzBtn("izgara", t("Izgara"), "izgara");
  K.duzListe = duzBtn("liste", t("Liste"), "liste");
  // Kayan topuz (6.5): seçili parçanın altında tek kâğıt parça, transform ile kayar
  K.duzTopuz = h("i", { class: "parcali-topuz", "aria-hidden": "true" });
  K.duzen = h("div", { class: "gorunum-sec", role: "group", "aria-label": t("Görünüm") }, K.duzTopuz, K.duzIzgara, K.duzListe);
  new ResizeObserver(() => topuzYerlestir(K.duzen, K.duzTopuz)).observe(K.duzen);
  // Çoklu seçim (K6)
  K.secDugme = h("button", { class: "ikincil sec-dugme", type: "button", "aria-pressed": "false" }, icon("sec", "i-20"), h("span", {}, t("Seç")));
  K.secDugme.addEventListener("click", () => secimKipi(!secim.acik));

  K.yeni = h("button", { class: "birincil", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" }, icon("arti", "i-20"), t("Yeni"));
  K.yeni.addEventListener("click", (e) => yeniMenusu(e.detail === 0));
  // Telefonda ve rayda kenar çubuğu yok: Ayarlar başlığın sağında (TASARIM-4 2.4)
  K.basAyarlar = h("button", { class: "ikon-dugme baslik-ayarlar", type: "button", "aria-label": t("Ayarlar"), "aria-haspopup": "dialog" }, icon("ayarlar"));
  K.basAyarlar.addEventListener("click", () => ayarlarAc({ acan: K.basAyarlar }));
  // Kenar çubuğundaki süzgeçler ve klasörler dar ekranda başlığın altında çip satırı
  K.suzgec = h("div", { class: "suzgec-cipler", role: "group", "aria-label": t("Kitaplık bölümleri") });

  K.sonuclar = h("div", { class: "sonuclar" });
  K.icerik = h("div", { class: "icerik" },
    h("div", { class: "icerik__ic" },
      h("div", { class: "baslik-satiri" },
        K.menuDugme,
        h("div", { class: "baslik-metin" }, K.baslik, K.altBaslik),
        K.basAyarlar,
        h("div", { class: "araclar" }, K.arama, K.siralama, K.duzen, K.secDugme, K.yeni)),
      K.suzgec,
      // İlk kullanım daveti "Üç kısa ipucu" (rehber.js doldurur): kartların akışında şerit, onları örtmez
      h("div", { class: "rehber-yeri", hidden: true }),
      // Kitap klasöründe yeni kitap fişi (kitap-klasoru.js doldurur)
      K.klasorFisi = h("div", { class: "klasor-fisi-yeri", hidden: true }),
      h("div", { class: "oxford", "aria-hidden": "true" }),
      K.sonuclar));
  // Kaydırınca açık fiş kapanır; tıklanan kapağı görünür yapan küçük kaydırma (odak, yarım görünen kapak) kapatmaz
  K.icerik.addEventListener("scroll", () => {
    if (!aktifFis || aktifFis.el.classList.contains("ayarlar-fis")) return;
    if (Math.abs(K.icerik.scrollTop - (aktifFis.kaydirma ?? K.icerik.scrollTop)) > 32) fisKapat();
  }, { passive: true });

  // Masaüstünde dosya bırakma
  K.birak = h("div", { class: "birak", hidden: true, "aria-hidden": "true" }, t("Bırak, kitaplığa ekleyelim."), fleuron());

  K.secimCubugu = secimCubuguKur();
  K.kok = h("div", { class: "kitaplik" }, K.kenar, K.perde, K.icerik, K.birak, K.secimCubugu);
  K.ekran.append(K.kok);
  sahne.append(K.ekran);
  gezinmeKur();

  dosyaBirakma();
  darMedya.addEventListener("change", cekmeceDurumu);
  cekmeceDurumu();
  if (gizli) kitaplikKirli = true;
  else kitaplikCiz();
}

function klasorlerCiz() {
  for (const k of [...K.navOgeler.keys()]) if (k.startsWith("klasor:")) K.navOgeler.delete(k);
  K.klasorListe.replaceChildren(...KLASORLER.map((k) => K.navOgesi("klasor:" + k.id, h("i", { class: "kumas-sekme", style: `--c:${k.renk}` }), k.ad)));
  kenarGuncelle();
}

function kenarGuncelle() {
  const s = sayilar();
  const tekrarda = acik.ekran === "tekrar" || acik.ekran === "izler";
  for (const [secim, { a, sayi }] of K.navOgeler) {
    sayi.textContent = String(s[secim] || 0);
    if (tercih.secim === secim && !tekrarda) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  // Çizgi roman yoksa süzgeç görünmez (kitaplık sade kalır)
  K.navOgeler.get("cizgiler")?.a.toggleAttribute("hidden", !s.cizgiler && tercih.secim !== "cizgiler");
  if (acik.ekran === "izler") K.izlerGiris?.setAttribute("aria-current", "page"); else K.izlerGiris?.removeAttribute("aria-current");
  suzgecCiz(s);
  tekrarGuncelle();
  isikYerlestir();
}
// Kayan etkin göstergesi (TASARIM-5 6.19, 8.1): etkin öğenin solunda 2x20 ışık çizgisi, öğeden öğeye translateY ile kayar.
// İlk yerleşimde ve sade harekette kaymadan yerine konur
let isikIlk = true;
function isikYerlestir() {
  if (!K.isik) return;
  requestAnimationFrame(() => {
    const etkin = $('[aria-current="page"]', K.kenarIc);
    if (!etkin || !etkin.getClientRects().length) { K.isik.hidden = true; return; }
    const r = etkin.getBoundingClientRect(), k = K.kenarIc.getBoundingClientRect();
    const y = Math.round(r.top - k.top + K.kenarIc.scrollTop + r.height / 2 - 10);
    if (isikIlk || K.isik.hidden) K.isik.classList.add("aninda");
    K.isik.hidden = false;
    K.isik.style.transform = `translateY(${y}px)`;
    if (K.isik.classList.contains("aninda")) requestAnimationFrame(() => K.isik.classList.remove("aninda"));
    isikIlk = false;
  });
}
// 7.0 kelime işareti (TASARIM-5 7.3): 28 px simge, "Kenar" Inter 640 ve "Notu" Literata italik
function markaOgesi(etiket = true) {
  return h("div", { class: "logo marka" },
    h("img", { class: "marka__simge", src: "ikon/ikon-kucuk.svg", alt: "", width: "28", height: "28", decoding: "async", draggable: "false" }),
    etiket ? h("span", { class: "marka__yazi" }, h("b", {}, "Kenar"), h("i", {}, "Notu")) : null);
}

/* ---------- 11. tur: sekme çubuğu (telefon), ray (600 ile 999, yatay telefon), süzgeç çipleri ---------- */
const KABUK_SEKMELERI = [["kitaplik", t("Kitaplık"), "tumu", "#"], ["izler", t("İzlerim"), "izler", "#izler"], ["tekrar", TEKRAR_ADI, "tekrar", "#tekrar"], ["arama", t("Ara"), "ara", "#arama"]];
function gezinmeKur() {
  const oge = (yer) => KABUK_SEKMELERI.map(([id, ad, ik, href]) => {
    const rozet = id === "tekrar" ? h("b", { class: "sekme-rozet" }) : null;
    const a = h("a", { class: "sekme", href, dataset: { ekran: id }, title: yer === "ray" ? ad : null }, icon(ik), h("span", {}, ad), rozet);
    a.addEventListener("click", (e) => { e.preventDefault(); sekmeDokun(id); });
    return a;
  });
  K.sekmeCubugu = h("nav", { class: "sekme-cubugu", "aria-label": t("Ana bölümler") }, oge("sekme"));
  const rayAyarlar = h("button", { class: "sekme ayarlar", type: "button", "aria-haspopup": "dialog", title: t("Ayarlar") }, icon("ayarlar"), h("span", {}, t("Ayarlar")));
  rayAyarlar.addEventListener("click", () => ayarlarAc({ acan: rayAyarlar }));
  K.ray = h("nav", { class: "ray", "aria-label": t("Ana bölümler") }, h("div", { class: "logo", "aria-hidden": "true" }, markaOgesi(false)), oge("ray"), rayAyarlar);
  document.body.append(K.sekmeCubugu, K.ray);
  sekmeleriIsaretle(kok.dataset.ekran || "kitaplik");
}
// Seçili sekmeye yeniden dokunmak listeyi başa kaydırır; Ara'da girdiyi odaklar
function sekmeDokun(id) {
  const simdi = acik.ekran || "kitaplik";
  if (simdi !== id || (id === "kitaplik" && acik.kap)) {
    if (id === "kitaplik") bus.emit("git", { ekran: "kitaplik" });
    else bus.emit("git", { ekran: id });
    return;
  }
  if (id === "arama") { const g = $(".arama-girdi", acik.kap); g?.focus(); g?.select?.(); return; }
  const kaydirici = id === "kitaplik" ? K.icerik : $(".izlerim-govde, .tekrar, .arama-govde", acik.kap) || acik.kap;
  kaydirici?.scrollTo?.({ top: 0, behavior: hareketAz() ? "auto" : "smooth" });
}
// Açık ekran: html[data-ekran], ortak.acikEkran ve sekmelerin aria-current'ı
let ekranPlan = false;
function ekranBildir() {
  ekranPlan = false;
  const ekran = acik.ekran || "kitaplik";
  Object.assign(acikEkran, { ekran, belgeId: acik.belgeId || null, mod: acik.mod || null });
  kok.dataset.ekran = ekran;
  sekmeleriIsaretle(ekran);
}
function sekmeleriIsaretle(ekran) {
  for (const nav of [K.sekmeCubugu, K.ray]) {
    if (!nav) continue;
    for (const a of nav.querySelectorAll("a.sekme")) {
      if (a.dataset.ekran === ekran) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
  }
}
const ekranBildirPlanla = () => { if (!ekranPlan) { ekranPlan = true; queueMicrotask(ekranBildir); } };
function rozetGuncelle(bekleyen) {
  for (const r of document.querySelectorAll(".sekme-rozet")) {
    r.textContent = bekleyen ? String(Math.min(99, bekleyen)) : "";
    if (bekleyen) r.setAttribute("aria-label", t("{n} kart bekliyor", { n: bekleyen })); else r.removeAttribute("aria-label");
  }
}
function suzgecCiz(s = sayilar()) {
  if (!K.suzgec) return;
  const ogeler = [...GORUNUMLER.map((g) => [g.id, g.ad, icon(g.ikon, "i-20")]),
    ...KLASORLER.map((k) => ["klasor:" + k.id, k.ad, h("i", { class: "kumas-sekme", style: `--c:${k.renk}` })])]
    .filter(([id]) => (id !== "cizgiler" || s.cizgiler || tercih.secim === "cizgiler") && (id !== "cop" || s.cop || tercih.secim === "cop"));
  const imza = ogeler.map(([id, ad]) => id + ":" + ad + ":" + (s[id] || 0)).join("|") + "#" + tercih.secim;
  if (K.suzgec.dataset.imza === imza) return;
  K.suzgec.dataset.imza = imza;
  K.suzgec.replaceChildren(...ogeler.map(([id, ad, onEk]) => {
    const d = h("button", { class: "cip", type: "button", "aria-pressed": String(tercih.secim === id) }, onEk, h("span", {}, ad), h("span", { class: "sayi" }, String(s[id] || 0)));
    d.addEventListener("click", () => gorunumSec(id));
    return d;
  }));
  // Seçili çip görünür alanda
  requestAnimationFrame(() => { const sec = $('[aria-pressed="true"]', K.suzgec); if (sec && K.suzgec.scrollWidth > K.suzgec.clientWidth) sec.scrollIntoView({ block: "nearest", inline: "nearest" }); });
}

// Kenar çubuğundaki Tekrar camı: bugün bekleyen kart, en az iki hane, 99 üstü "99"
function tekrarGuncelle() {
  if (!K.tekrar) return;
  const bekleyen = bugunTekrar().length, n = Math.min(99, bekleyen);
  rozetGuncelle(bekleyen);
  const alt = n ? t("{n} kart bekliyor", { n: bekleyen }) : store.kartlar.length ? t("Bugünlük bitti") : t("Henüz kart yok");
  K.tekrarAlt.textContent = alt;
  K.tekrar.setAttribute("aria-label", t("Tekrar, {durum}", { durum: alt.toLocaleLowerCase(yerel) }));
  K.tekrarCam.classList.toggle("soluk", !n);
  const haneler = String(n).padStart(2, "0");
  K.tekrarHaneler.forEach((i, k) => i.style.setProperty("--n", haneler[k]));
  K.tekrarHaneler[0].parentElement.classList.toggle("sifir", n > 0 && n < 10);
  if (acik.ekran === "tekrar") K.tekrar.setAttribute("aria-current", "page"); else K.tekrar.removeAttribute("aria-current");
}

function gorunumBilgisi() {
  const s = sayilar();
  const g = GORUNUMLER.find((x) => x.id === tercih.secim);
  if (tercih.secim === "tumu") {
    const enSon = store.belgeler.reduce((m, b) => Math.max(m, b.acilis || 0), 0);
    if (!s.tumu) return { baslik: t("Kitaplık"), alt: t("Masa henüz boş") };
    const p = { belge: s.kitaplar, defter: s.defterler, cizgi: s.cizgiler, zaman: neZaman(enSon) };
    return { baslik: t("Kitaplık"), alt: s.cizgiler ? t("{belge} belge, {defter} defter, {cizgi} çizgi roman · son açılan {zaman}", p) : t("{belge} belge, {defter} defter · son açılan {zaman}", p) };
  }
  if (tercih.secim === "kitaplar") {
    const pdf = store.belgeler.filter((b) => b.tur === "pdf" && !cizgiMi(b)).length, epub = s.kitaplar - pdf;
    const son = sirala(store.belgeler.filter(secimFiltresi("kitaplar")))[0];
    return { baslik: g.ad, alt: son ? t("{pdf} PDF, {epub} EPUB · en son {ad}", { pdf, epub, ad: son.ad }) : `${pdf} PDF, ${epub} EPUB` };
  }
  if (tercih.secim === "cizgiler") {
    const seri = new Set(store.belgeler.filter(cizgiMi).map((b) => b.seri).filter(Boolean)).size;
    return { baslik: g.ad, alt: !s.cizgiler ? t("Raf boş") : seri ? t("{n} sayı, {seri} seri", { n: s.cizgiler, seri }) : t("{n} sayı", { n: s.cizgiler }) };
  }
  if (tercih.secim === "defterler") {
    const sayfa = store.belgeler.filter((b) => b.tur === "defter").reduce((t, b) => t + (b.sayfaSayisi || 0), 0);
    return { baslik: g.ad, alt: s.defterler ? t("{n} defter, toplam {sayfa} sayfa", { n: s.defterler, sayfa }) : t("Henüz defter yok") };
  }
  if (tercih.secim === "favoriler") return { baslik: g.ad, alt: s.favoriler ? t("{n} belge kurdeleli", { n: s.favoriler }) : t("Kurdeleli belge yok") };
  if (RAFLAR.includes(tercih.secim)) {
    const alt = { okunacak: t("Henüz başlanmamış"), okunuyor: t("Yarıda kalanlar"), bitti: t("Sonuna gelinenler") }[tercih.secim];
    const yok = { okunacak: t("Henüz başlanmamış yok"), okunuyor: t("Yarıda kalanlar yok"), bitti: t("Sonuna gelinenler yok") }[tercih.secim];
    return { baslik: g.ad, alt: s[tercih.secim] ? t("{n} belge · {durum}", { n: s[tercih.secim], durum: alt.toLocaleLowerCase(yerel) }) : yok };
  }
  if (tercih.secim === "cop") return { baslik: g.ad, alt: s.cop ? t("{n} belge · {durum}", { n: s.cop, durum: COP_GUN_METNI }) : t("Çöp kutusu boş") };
  if (tercih.secim === "kirpilanlar") {
    const kaynak = new Set(store.kirpintilar.map((k) => k.belgeId)).size;
    return { baslik: g.ad, alt: s.kirpilanlar ? t("{n} kırpıntı, {kaynak} belgeden", { n: s.kirpilanlar, kaynak }) : t("Pano boş") };
  }
  const klasor = klasorBul(tercih.secim.slice(7));
  const icinde = store.belgeler.filter(secimFiltresi(tercih.secim));
  const defter = icinde.filter((b) => b.tur === "defter").length;
  return { baslik: klasor?.ad || t("Klasör"), alt: icinde.length ? t("{belge} belge, {defter} defter", { belge: icinde.length - defter, defter }) : t("Klasör boş") };
}

function baslikGuncelle() {
  const { baslik, alt } = gorunumBilgisi();
  K.baslik.textContent = baslik;
  K.altBaslik.textContent = alt;
  if (!K.ekran.hidden) document.title = tercih.secim === "tumu" ? "Kenar Notu" : `${baslik} · Kenar Notu`;
}

function araclarGuncelle() {
  const pano = tercih.secim === "kirpilanlar", cop = tercih.secim === "cop";
  K.icerik.dataset.gorunum = tercih.secim.startsWith("klasor:") ? "klasor" : tercih.secim;
  const s = siralamaAl();
  K.sirAd.textContent = pano ? (s === "ad" ? t("Belge") : t("En yeni")) : (SIRALAMALAR.find(([id]) => id === s)?.[1] || t("Son açılan"));
  K.siralama.setAttribute("aria-label", t("Sıralama: {ad}", { ad: K.sirAd.textContent }));
  K.siralama.hidden = cop;
  K.duzen.hidden = pano || cop;
  K.secDugme.hidden = pano || cop || !store.belgeler.length;
  K.duzIzgara.setAttribute("aria-pressed", String(tercih.duzen !== "liste"));
  K.duzListe.setAttribute("aria-pressed", String(tercih.duzen === "liste"));
  topuzYerlestir(K.duzen, K.duzTopuz);
  K.aramaGirdi.placeholder = pano ? t("Kırpıntılarda ara") : cop ? t("Silinenlerde ara") : t("Kitaplıkta ara");
}
// Parçalı düğmenin kayan topuzu: seçili parçanın yerine ve genişliğine transform ile oturur (TASARIM-5 6.5).
// Grup görünmüyorsa (gizli ekran) ölçü sonra alınır
function topuzYerlestir(grup, topuz) {
  if (!grup || !topuz) return;
  const yerlestir = () => {
    const sec = $('button[aria-pressed="true"], button[aria-checked="true"]', grup);
    if (!sec || !sec.offsetWidth) { topuz.hidden = !sec; return; }
    topuz.hidden = false;
    const ilk = !topuz.style.width;
    if (ilk) topuz.classList.add("aninda");
    topuz.style.width = `${sec.offsetWidth}px`;
    topuz.style.transform = `translateX(${sec.offsetLeft - grup.clientLeft}px)`;
    if (ilk) requestAnimationFrame(() => topuz.classList.remove("aninda"));
  };
  if (grup.isConnected && grup.offsetWidth) yerlestir(); else requestAnimationFrame(yerlestir);
}
// Sıralama menüsü: seçenek satırları (menuitemradio), seçilen kitaplikSiralama ayarına yazılır
function siralamaMenusu(klavye) {
  if (aktifFis?.capa === K.siralama) { fisKapat(); return; }
  const pano = tercih.secim === "kirpilanlar";
  const secenekler = pano ? [["son", t("En yeni")], ["ad", t("Belge")]] : SIRALAMALAR;
  const simdi = siralamaAl(), seciliPano = simdi === "ad" ? "ad" : "son";
  K.siralama.setAttribute("aria-expanded", "true");
  fisAc(K.siralama, [h("div", { class: "fis-baslik" }, t("Sırala")),
    ...secenekler.map(([id, ad]) => secenekSatir(icon(id === "ad" ? "metin" : id === "yazar" ? "kitap" : id === "ilerleme" ? "okuma" : id === "eklenme" ? "arti" : "kronometre", "i-20"), ad,
      (pano ? seciliPano : simdi) === id, () => { fisKapat(); ayarla({ kitaplikSiralama: id }); tercih.siralama = id; tercihKaydet(); araclarGuncelle(); sonucCiz(true); }))],
  { hiza: "alt-sag", etiket: t("Sırala"), klavye, kapaninca: () => K.siralama.setAttribute("aria-expanded", "false") });
}

function kitaplikCiz() {
  kenarGuncelle();
  baslikGuncelle();
  araclarGuncelle();
  sonucCiz();
}
// Olaylardan sonra: kitaplık gizliyse dönüşte çizilir
function kitaplikYenile() {
  if (!K.ekran || K.ekran.hidden) { kitaplikKirli = true; return; }
  const y = K.icerik.scrollTop;
  kitaplikCiz();
  K.icerik.scrollTop = y;
}

function gorunumSec(secimId) {
  fisKapat(true);
  if (secim.acik) secimKipi(false);
  if (tercih.secim !== secimId) { tercih.secim = secimId; tercihKaydet(); }
  kenarGuncelle();
  baslikGuncelle();
  araclarGuncelle();
  K.icerik.scrollTop = 0;
  sonucCiz(true);
  cekmeceKapat();
}

function aramaYap(deger) {
  arama = deger;
  if (K.aramaGirdi.value !== deger) K.aramaGirdi.value = deger;
  K.arama.classList.toggle("dolu", !!deger);
  K.aramaTemizle.hidden = !deger;
  sonucCiz();
}

// Kitaplık süzgecinden arama ekranına; dönüşte süzgeç yerinde kalır
function herYerdeAra(q) {
  bus.emit("git", { ekran: "arama", terim: q });
}
// Süzülen kitaplığın başında: "Her yerde ara: …" satırı (sayfa metinleri, notlar, kartlar)
function herYerdeSatiri(q) {
  const d = h("button", { class: "her-yerde", type: "button" },
    icon("ara", "i-20"),
    h("span", {}, `${t("Her yerde ara")}: `, h("b", {}, `“${q}”`), h("small", {}, t("Sayfa metinleri, notlar, kartlar"))),
    h("kbd", { class: "kisayol", "aria-hidden": "true" }, "Enter"));
  d.addEventListener("click", () => herYerdeAra(q));
  return d;
}

function sonucCiz(gel = false) {
  const q = arama.trim();
  K.sonuclar.replaceChildren(...(q && tercih.secim !== "cop" ? [herYerdeSatiri(q)] : []),
    tercih.secim === "kirpilanlar" ? panoCiz() : tercih.secim === "cop" ? copCiz() : belgelerCiz());
  if (secim.acik) secimIsaretle();
  if (gel && !hareketAz()) {
    K.sonuclar.classList.remove("gel");
    void K.sonuclar.offsetWidth;
    K.sonuclar.classList.add("gel");
  }
}

// Boş durum (TASARIM-4 3.5): ne yapılacağını söyler ve tek düğme verir. eylem: { etiket, calistir, ikon? }, ikinci: metin düğmesi
function bos(ikon, baslik, aciklama, eylem = null, ikinci = null) {
  const dugmeler = eylem ? h("div", { class: "bos-eylem" },
    h("button", { class: "birincil", type: "button", onclick: eylem.calistir }, eylem.ikon ? icon(eylem.ikon, "i-20") : null, eylem.etiket),
    ikinci ? h("button", { class: "metin-dugme", type: "button", onclick: ikinci.calistir }, ikinci.etiket) : null) : null;
  return h("div", { class: "bos" }, icon(ikon), h("h3", {}, baslik), h("p", {}, aciklama), dugmeler, eylem ? null : fleuron());
}
const DOSYA_AC = { etiket: t("Dosya aç"), ikon: "pdf", calistir: () => dosyaSec() };
const YENI_DEFTER = { etiket: t("Yeni defter"), calistir: () => yeniDefterPenceresi() };
function bolumBaslik(ad, sayi, ek = "") {
  return h("h2", { class: `bolum-baslik t-b2 ${ek}`.trim() }, ad, sayi != null ? h("span", { class: "t-eski" }, String(sayi)) : null);
}

function belgelerCiz() {
  const f = document.createDocumentFragment();
  const q = arama.trim();
  // İçe aktarılan dosyaların dizgi kartları gideceği rafta yer tutar (aramada görünmez)
  const kume = [...(q ? [] : dizgiler), ...store.belgeler].filter(secimFiltresi(tercih.secim));
  const liste = sirala(q ? kume.filter((b) => eslesir(`${b.ad} ${b.yazar || ""}`, q)) : kume);

  if (!store.belgeler.length && !dizgiler.length) return bos("tumu", t("Masan boş."), t("Bir PDF, EPUB ya da çizgi roman aç, ya da boş bir defterle başla. {ipucu}", { ipucu: dosyaIpucu() }), DOSYA_AC, YENI_DEFTER);
  if (q && !liste.length) return bos("ara", t("“{q}” bu kitaplıkta yok.", { q }), t("Kitapların içinde de aranabilir."), { etiket: t("Her yerde ara"), ikon: "ara", calistir: () => herYerdeAra(q) });
  if (!liste.length) {
    if (tercih.secim === "favoriler") return bos("yildiz", t("Favori yok."), t("Bir kapağın altındaki yıldıza dokun."), { etiket: t("Tümünü göster"), calistir: () => gorunumSec("tumu") });
    if (tercih.secim === "defterler") return bos("defter", t("Henüz defter yok."), t("Çizgili, kareli, noktalı ya da Cornell kâğıdı seç."), YENI_DEFTER);
    if (tercih.secim === "kitaplar") return bos("kitap", t("Rafta kitap yok."), t("EPUB ya da PDF kitaplarını buraya ekleyebilirsin."), DOSYA_AC);
    if (tercih.secim === "cizgiler") return bos("cizgi-roman", t("Çizgi roman rafı boş."), t("CBZ dosyası aç; telefonda kare kare okunur. Bir PDF de menüsünden çizgi roman olarak okunur."), DOSYA_AC);
    if (tercih.secim === "okunacak") return bos("raf-okunacak", t("Okunacak rafı boş."), t("Başlamadığın kitaplar burada durur. Bir kapağı seçip Rafa koy ile de ekleyebilirsin."), { etiket: t("Tümünü göster"), calistir: () => gorunumSec("tumu") });
    if (tercih.secim === "okunuyor") return bos("raf-okunuyor", t("Yarıda kalan kitap yok."), t("Okumaya başladığın kitaplar kendiliğinden buraya gelir."), { etiket: t("Tümünü göster"), calistir: () => gorunumSec("tumu") });
    if (tercih.secim === "bitti") return bos("raf-bitti", t("Henüz biten kitap yok."), t("Son sayfaya gelince kitap bu rafa geçer."), { etiket: t("Tümünü göster"), calistir: () => gorunumSec("tumu") });
    return bos("klasor", t("Bu klasör boş."), t("Seç ile kapakları işaretleyip Klasöre taşı’yı seçebilirsin."), { etiket: t("Tümünü göster"), calistir: () => gorunumSec("tumu") });
  }

  if (q) {
    f.append(bolumBaslik(t("“{q}” için sonuçlar", { q }), liste.length), belgeKumesi(liste));
  } else if (tercih.secim === "favoriler" || RAFLAR.includes(tercih.secim)) {
    f.append(belgeKumesi(liste));
  } else if (tercih.secim === "cizgiler") {
    f.append(cizgiRafCiz(liste));
  } else {
    // Okuma rafı (Koltuk) ve Çalışma masası (Masa): ayrım belgenin moduyla (TASARIM-2 3.1)
    if (tercih.secim === "tumu") f.append(kaldiginCiz());
    // Çizgi romanlar kendi rafında (TASARIM-3 9.2); klasördeki çizgi roman PDF'i dersinin şeridinde kalır
    const cizgiRafta = (b) => cizgiMi(b) && !klasorBul(b.klasor);
    const cizgi = liste.filter(cizgiRafta);
    // Bir derse bağlı belge koltukta okunsa da masada, dersinin şeridinde kalır
    const masada = (b) => !!klasorBul(b.klasor) || varsayilanMod(b) !== "koltuk";
    const raf = liste.filter((b) => !cizgiRafta(b) && !masada(b));
    const masa = liste.filter((b) => !cizgiRafta(b) && masada(b));
    // Son açılan belge Masa'daysa Çalışma masası üste gelir: dönünce kaldığın masa ilk ekranda görünür
    const son = store.belgeler.reduce((m, b) => ((b.acilis || 0) > (m?.acilis || 0) ? b : m), null);
    const bolumler = [raf.length && rafCiz(raf), masa.length && masaCiz(masa)].filter(Boolean);
    if (son && !cizgiRafta(son) && varsayilanMod(son) === "masa") bolumler.reverse();
    // Çizgi roman rafı en altta; son açılan çizgi romansa okuma rafının altına gelir
    if (cizgi.length) {
      const cr = cizgiRafCiz(cizgi);
      if (son && cizgiRafta(son) && bolumler.length > 1) bolumler.splice(1, 0, cr); else bolumler.push(cr);
    }
    f.append(...bolumler);
  }
  return f;
}

// Çizgi roman rafı (TASARIM-3 9.2): dükkân rafı, kapaklar önü dönük ve mylar poşette, ceviz raf dudağına yaslı
function cizgiRafCiz(liste) {
  if (tercih.duzen === "liste") {
    return h("section", { class: "cizgi-bolum", "aria-labelledby": "cizgi-b" },
      bolumUst("cizgi-b", t("Çizgi roman rafı"), "", t("{n} sayı", { n: liste.length })), belgeKumesi(liste));
  }
  const raf = h("div", { class: "cizgi-raf", role: "list", "aria-label": t("Çizgi roman rafı") }, liste.map(cizgiOge), h("div", { class: "cizgi-raf-bos", "aria-hidden": "true" }));
  return h("section", { class: "cizgi-bolum", "aria-labelledby": "cizgi-b" },
    bolumUst("cizgi-b", t("Çizgi roman rafı"), "", t("{n} sayı", { n: liste.length })), raf);
}
function cizgiOge(b) {
  if (b.dizgi) return h("div", { class: "cizgi-oge dizgi", role: "listitem", "aria-busy": "true", dataset: { id: b.id } },
    h("div", { class: "kapak" }, dizgiKapak(b)), h("span", { class: "etiket" }, t("Dizgide")), h("div", { class: "ad" }, b.ad));
  const kapak = kapakOlustur(b);
  // Okunmakta olan sayı: poşetin sağ üst köşesinde bordo kurdele ucu
  const okunuyor = (b.sayfa || 1) > 1 && (b.sayfa || 1) < (b.sayfaSayisi || 1);
  const bag = h("a", { class: "kapak" + (okunuyor ? " okunuyor" : ""), href: `#belge/${b.id}`, draggable: "false", "aria-label": t("{ad}, {konum}, aç", { ad: b.ad, konum: konumMetni(b) }) }, kapak);
  kapakBagla(bag, b, kapak);
  return h("div", { class: "cizgi-oge belge", role: "listitem", dataset: { id: b.id } },
    bag,
    h("span", { class: "etiket" }, b.sayi ? `#${b.sayi}` : t("{n} s.", { n: b.sayfaSayisi || 1 })),
    h("div", { class: "ad" }, vurgula(b.ad, arama)),
    b.seri || b.yazar ? h("div", { class: "seri" }, b.seri || b.yazar) : null);
}

function bolumUst(id, ad, etiket, sayi) {
  return h("header", { class: "bolum-ust" },
    h("h2", { class: "t-b2", id }, ad), etiket ? h("span", { class: "etiket-serit" }, etiket) : null, h("span", { class: "bolum-ust__sayi t-kucuk" }, sayi));
}

// Okuma rafı: kapaklar ceviz rafta dikili, raf ve çentikler sabit, kapaklar yatay kayar
function rafCiz(liste) {
  const kitap = liste.every((b) => b.tur === "epub");
  const govde = tercih.duzen === "liste"
    ? belgeKumesi(liste)
    : h("div", { class: "raf-kap" }, h("div", { class: "raf", role: "list", "aria-label": t("Okuma rafı") }, liste.map((b) => belgeHucre(b, "raf-oge"))));
  return h("section", { class: "raf-bolum", "aria-labelledby": "raf-b" },
    bolumUst("raf-b", t("Okuma rafı"), t("Raf I · Koltuk"), kitap ? t("{n} kitap", { n: liste.length }) : t("{n} belge", { n: liste.length })), govde);
}

// Çalışma masası: ders (klasör) başına kareli şerit, altında ızgara; klasörsüzler en sonda
function masaCiz(liste) {
  const gruplar = KLASORLER.map((k) => [k, liste.filter((b) => b.klasor === k.id)]).filter(([, l]) => l.length);
  const klasorsuz = liste.filter((b) => !klasorBul(b.klasor));
  if (klasorsuz.length) gruplar.push([null, klasorsuz]);
  return h("section", { class: "masa-bolum", "aria-labelledby": "masa-b" },
    bolumUst("masa-b", t("Çalışma masası"), t("Raf II · Masa"), t("{n} belge", { n: liste.length })),
    gruplar.map(([k, l]) => dersCiz(k, l)));
}

function dersCiz(klasor, liste) {
  const idler = new Set(liste.map((b) => b.id));
  const kart = store.kartlar.filter((c) => idler.has(c.belgeId)).length;
  const serit = h("div", { class: "ders-serit kareli" + (klasor ? "" : " klasorsuz") },
    klasor ? h("i", { class: "kumas-sekme", style: `--c:${klasor.renk}`, "aria-hidden": "true" }) : null,
    h("h3", {}, klasor ? klasor.ad : t("Klasörsüz")),
    h("span", { class: "t-deger-k" }, t("{n} belge · {kart} kart", { n: liste.length, kart })));
  return h("div", { class: "ders", style: klasor ? `--c:${klasor.renk}` : null }, serit, belgeKumesi(liste));
}

function belgeKumesi(liste) {
  if (tercih.duzen === "liste") return h("div", { class: "liste", role: "list" }, liste.map(belgeSatir));
  return h("div", { class: "izgara", role: "list" }, liste.map((b) => belgeHucre(b)));
}

// Kaldığın yerden: son açılan üç belge (3.4)
function kaldiginCiz() {
  const son = [...store.belgeler].sort((a, b) => (b.acilis || 0) - (a.acilis || 0)).slice(0, 3);
  const kap = h("div", { class: "kaldigin" });
  for (const b of son) {
    const kapak = kapakOlustur(b, { mini: true });
    const a = h("a", { href: `#belge/${b.id}`, draggable: "false", "aria-label": t("{ad}, {konum}, kaldığın yerden aç", { ad: b.ad, konum: konumMetni(b) }) },
      h("div", { class: "mini kapak-sahne" }, kapak),
      h("div", {}, h("div", { class: "ad" }, b.ad), h("div", { class: "meta" }, konumMetni(b))),
      h("div", { class: "ilerleme", "aria-hidden": "true" }, h("i", { style: `--p:${(ilerlemeOrani(b) * 100).toFixed(1)}%` })));
    a.addEventListener("click", (e) => { e.preventDefault(); belgeAcIstegi(b, kapak); });
    uzunBasma(a, () => belgeFisi(b, kapak));
    kap.append(a);
  }
  return h("section", { class: "kaldigin-bolum", "aria-labelledby": "kaldiginBaslik" }, h("h2", { class: "bolum-baslik t-b2", id: "kaldiginBaslik" }, t("Kaldığın yerden")), kap);
}

function belgeHucre(b, ekSinif = "") {
  if (b.dizgi) return dizgiHucre(b, ekSinif);
  const kapak = kapakOlustur(b);
  const sahneEl = h("a", { class: "kapak-sahne", href: `#belge/${b.id}`, draggable: "false", "aria-label": t("{ad}, aç", { ad: b.ad }) }, kapak);
  kapakBagla(sahneEl, b, kapak);
  const klasor = klasorBul(b.klasor);
  // Arama yalnız alt başlıkta eşleştiyse meta satırı onu fosforlu gösterir: sonucun nedeni görünür
  const q = arama.trim();
  const altEslesme = q && b.yazar && !eslesir(b.ad, q) && eslesir(b.yazar, q);
  return h("div", { class: `belge ${ekSinif}`.trim(), role: "listitem", dataset: { id: b.id } },
    sahneEl,
    h("h3", { class: "belge-ad" }, vurgula(b.ad, arama)),
    h("div", { class: "belge-meta" },
      h("span", { class: "t-etiket" }, klasor ? h("i", { class: "kumas-sekme", style: `--c:${klasor.renk}`, title: klasor.ad }) : null,
        h("span", {}, altEslesme ? vurgula(b.yazar, arama) : etiketMetni(b))),
      yildizDugme(b)),
    ekSinif.includes("raf-oge") ? oduncSayaci(b) : null);
}
// Ödünç kartı sayacı (TASARIM-4 4.3): okuma rafında kapak altında "4 gün · 3 sa 12 dk" ya da "Bitti · 30.10"
function oduncSayaci(b) {
  if (store.ayarlar.oduncKarti === false) return null;
  const o = oduncOzet(b);
  if (!o.gun && !o.bitti) return null;
  const metin = o.bitti
    ? `${BITTI_RAF} · ${new Date(o.bitti).toLocaleDateString(yerel, { day: "2-digit", month: "2-digit" })}`
    : t("{gun} gün · {sure}", { gun: o.gun, sure: sureMetni(o.saniye) });
  return h("p", { class: "odunc-sayac", title: o.gun ? t("{gun} gün okundu, toplam {sure}", { gun: o.gun, sure: sureMetni(o.saniye) }) : null }, metin);
}

function belgeSatir(b) {
  if (b.dizgi) return dizgiSatir(b);
  const kapak = kapakOlustur(b, { mini: true });
  const bag = h("a", { class: "satir-bag", href: `#belge/${b.id}`, draggable: "false", "aria-label": t("{ad}, aç", { ad: b.ad }) });
  kapakBagla(bag, b, kapak);
  const klasor = klasorBul(b.klasor);
  const q = arama.trim();
  const altEslesme = q && b.yazar && !eslesir(b.ad, q) && eslesir(b.yazar, q);
  return h("div", { class: "belge-satir", role: "listitem", dataset: { id: b.id } },
    h("div", { class: "mini kapak-sahne" }, kapak),
    h("div", { style: "min-width:0" },
      h("div", { class: "ad" }, vurgula(b.ad, arama)),
      h("div", { class: "t-kucuk" }, konumMetni(b) + (klasor ? ` · ${klasor.ad}` : ""), altEslesme ? [" · ", vurgula(b.yazar, arama)] : null)),
    h("span", { class: "ne-zaman" }, b.acilis ? t("{zaman} açıldı", { zaman: neZaman(b.acilis) }) : t("henüz açılmadı")),
    yildizDugme(b),
    bag);
}

function yildizDugme(b) {
  const d = h("button", { class: "yildiz", type: "button", "aria-pressed": String(!!b.favori), "aria-label": b.favori ? t("Favorilerden çıkar") : t("Favorilere ekle") }, icon("yildiz"));
  d.addEventListener("click", () => favoriDegistir(b, d));
  return d;
}

function favoriDegistir(b, dugme) {
  b.favori = !b.favori;
  sessiz = true;
  try { bus.emit("belgeler", { tur: "favori", id: b.id }); } finally { sessiz = false; }
  if (tercih.secim === "favoriler") {
    kitaplikYenile();
    if (!b.favori) toast(t("Favorilerden çıkarıldı"), { etiket: t("Geri al"), calistir: () => favoriDegistir(b) });
    return;
  }
  // Yerinde güncelle: yıldız dolar, kurdele kapağın üstünden sarkar
  for (const satir of $$(`[data-id="${CSS.escape(b.id)}"]`, K.sonuclar)) {
    const y = $(".yildiz", satir);
    if (y) {
      y.setAttribute("aria-pressed", String(b.favori));
      y.setAttribute("aria-label", b.favori ? t("Favorilerden çıkar") : t("Favorilere ekle"));
      if (y === dugme && b.favori && !hareketAz()) { y.classList.remove("basildi"); void y.offsetWidth; y.classList.add("basildi"); }
    }
    const kapak = $("a.kapak-sahne > *", satir);
    if (!kapak) continue;
    $(".fav", kapak)?.remove();
    if (b.favori) kapak.append(h("i", { class: "fav yeni" }));
  }
  kenarGuncelle();
  baslikGuncelle();
}

/* ---------- Çoklu seçim ve toplu işlem (K6) ---------- */
// "Seç" düğmesi, kapağa uzun basma ya da masaüstünde Ctrl/Shift tıklaması seçim kipini açar. Seçim kipinde kapaklar
// role="button" ve aria-pressed taşır; Esc, Bitti ve geri hareketi kipi kapatır (kip açılınca geçmişe bir adım itilir).
const secim = { acik: false, idler: new Set(), capa: null, gecmis: false };
// Seçim kipini kapatan düğme: Türkçede raf adıyla aynı "Bitti", İngilizcede "Done" (raf adı "Finished")
const BITTI_DUGME = ingilizceMi ? "Done" : "Bitti";
let secimGeriYut = false;
const seciliBelgeler = () => store.belgeler.filter((b) => secim.idler.has(b.id));
// Görünen sırayla seçilebilir belge kimlikleri (dizgi kartları hariç)
const gorunenIdler = () => [...new Set($$(".belge[data-id], .belge-satir[data-id], .cizgi-oge.belge[data-id]", K.sonuclar)
  .filter((x) => !x.classList.contains("cop-satir") && !x.closest(".kaldigin")).map((x) => x.dataset.id))].filter((id) => belgeBul(id));

function kapakBagla(el, b, kapak) {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    const ek = (e.ctrlKey || e.metaKey || e.shiftKey) && matchMedia("(pointer: fine)").matches;
    if (secim.acik || ek) {
      if (!secim.acik) secimKipi(true);
      if (e.shiftKey && secim.capa) aralikSec(secim.capa, b.id); else secimDegistir(b.id);
      return;
    }
    belgeAcIstegi(b, kapak);
  });
  // Seçim kipinde Boşluk da seçer (role="button")
  el.addEventListener("keydown", (e) => { if (secim.acik && e.key === " ") { e.preventDefault(); secimDegistir(b.id); } });
  uzunBasma(el, () => { if (!secim.acik) secimKipi(true); secim.idler.add(b.id); secim.capa = b.id; secimIsaretle(); }, () => belgeFisi(b, kapak));
}

function secimKipi(ac, { gecmisle = true } = {}) {
  ac = !!ac;
  if (ac === secim.acik) return;
  fisKapat(true);
  secim.acik = ac;
  if (!ac) { secim.idler.clear(); secim.capa = null; }
  K.kok.classList.toggle("secim-kipi", ac);
  K.secDugme.setAttribute("aria-pressed", String(ac));
  $("span", K.secDugme).textContent = ac ? BITTI_DUGME : t("Seç");
  K.secimCubugu.hidden = !ac;
  if (ac) {
    history.pushState({ ...(history.state || {}), secimKipi: true }, "", location.href);
    secim.gecmis = true;
    if (!hareketAz()) { K.secimCubugu.classList.remove("gel"); void K.secimCubugu.offsetWidth; K.secimCubugu.classList.add("gel"); }
  } else if (secim.gecmis) {
    secim.gecmis = false;
    if (gecmisle && history.state?.secimKipi) { secimGeriYut = true; history.back(); }
  }
  secimIsaretle();
}
function secimDegistir(id) {
  if (secim.idler.has(id)) secim.idler.delete(id); else secim.idler.add(id);
  secim.capa = id;
  secimIsaretle();
}
function aralikSec(a, b) {
  const ids = gorunenIdler(), i = ids.indexOf(a), j = ids.indexOf(b);
  if (i < 0 || j < 0) { secimDegistir(b); return; }
  for (const id of ids.slice(Math.min(i, j), Math.max(i, j) + 1)) secim.idler.add(id);
  secim.capa = b;
  secimIsaretle();
}
function tumunuSec() {
  const ids = gorunenIdler();
  if (ids.length && ids.every((id) => secim.idler.has(id))) secim.idler.clear();
  else for (const id of ids) secim.idler.add(id);
  secimIsaretle();
}
// Kapaklar ve satırlar: seçim kipinde düğme (aria-pressed), değilse bağlantı
function secimIsaretle() {
  for (const kap of $$(".belge[data-id], .belge-satir[data-id], .cizgi-oge.belge[data-id]", K.sonuclar)) {
    if (kap.classList.contains("cop-satir") || kap.closest(".kaldigin")) continue;
    const bag = $(":scope > a.kapak-sahne, :scope > .satir-bag, :scope > a.kapak", kap);
    const sec = secim.acik && secim.idler.has(kap.dataset.id);
    kap.classList.toggle("secili", sec);
    if (!bag) continue;
    if (secim.acik) { bag.setAttribute("role", "button"); bag.setAttribute("aria-pressed", String(sec)); }
    else { bag.removeAttribute("role"); bag.removeAttribute("aria-pressed"); }
  }
  K.secimCubugu?._guncelle();
}

function secimCubuguKur() {
  const sayi = h("span", { class: "secim-sayi", role: "status" });
  const eylem = (ik, ad, fn) => {
    const d = h("button", { class: "secim-eylem", type: "button" }, icon(ik, "i-20"), h("span", {}, ad));
    d.addEventListener("click", (e) => fn(d, e.detail === 0));
    return d;
  };
  const tasi = eylem("klasor", t("Klasöre taşı"), topluKlasor);
  const raf = eylem("raf-okunuyor", t("Rafa koy"), topluRaf);
  const fav = eylem("yildiz", t("Favori"), () => topluFavori());
  const daha = eylem("daha", t("Seçenekler"), (d) => { const [b] = seciliBelgeler(); if (b) belgeFisi(b, d); });
  const silEtiket = h("span", {}, t("Sil"));
  const sil = h("button", { class: "secim-eylem tehlikeli", type: "button" }, icon("sil", "i-20"), silEtiket);
  onayla(sil, silEtiket, t("Emin misin?"), topluSil);
  const tumu = eylem("sec", t("Tümünü seç"), () => tumunuSec());
  const bitti = h("button", { class: "secim-bitti", type: "button", onclick: () => secimKipi(false) }, BITTI_DUGME);
  const el = h("div", { class: "secim-cubugu", role: "toolbar", "aria-label": t("Seçilenler"), hidden: true },
    sayi, h("i", { class: "secim-ayrac", "aria-hidden": "true" }), tasi, raf, fav, daha, sil,
    h("i", { class: "secim-ayrac", "aria-hidden": "true" }), tumu, bitti);
  el._guncelle = () => {
    const l = seciliBelgeler(), n = l.length;
    sayi.textContent = n ? t("{n} seçildi", { n }) : t("Seç");
    for (const d of [tasi, raf, fav, sil]) d.disabled = !n;
    daha.hidden = n !== 1;
    $("span", fav).textContent = n && l.every((b) => b.favori) ? t("Favoriden çıkar") : t("Favori");
    fav.setAttribute("aria-pressed", String(!!n && l.every((b) => b.favori)));
    const ids = gorunenIdler();
    $("span", tumu).textContent = ids.length && ids.every((id) => secim.idler.has(id)) ? t("Seçimi kaldır") : t("Tümünü seç");
  };
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const d = $$("button", el).filter((x) => !x.disabled && !x.hidden && x.getClientRects().length);
    const i = d.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    d[(i + (e.key === "ArrowRight" ? 1 : -1) + d.length) % d.length].focus();
  });
  return el;
}
// Toplu işlemler tek geri alınabilir işlem (K6 kabul 4): eski değerler saklanır, "Geri al" hepsini döndürür
function topluUygula(l, alan, deger, metin) {
  const eski = l.map((b) => [b, b[alan]]);
  for (const b of l) { if (deger === undefined) delete b[alan]; else b[alan] = deger; }
  bus.emit("belgeler", { tur: "toplu" });
  secimKipi(false);
  toast(metin, { etiket: t("Geri al"), calistir: () => {
    for (const [b, v] of eski) { if (v === undefined) delete b[alan]; else b[alan] = v; }
    bus.emit("belgeler", { tur: "toplu" });
  } });
}
function topluKlasor(capa, klavye) {
  const l = seciliBelgeler();
  if (!l.length) return;
  const uygula = (id) => { fisKapat(true); topluUygula(l, "klasor", id, id ? t("{n} belge {klasor} klasörüne taşındı", { n: l.length, klasor: klasorBul(id).ad }) : t("{n} belge klasörden çıkarıldı", { n: l.length })); };
  fisAc(capa, [h("div", { class: "fis-baslik" }, t("{n} belgeyi taşı", { n: l.length })),
    ...KLASORLER.map((k) => secenekSatir(h("i", { class: "kumas-sekme", style: `--c:${k.renk}` }), k.ad, l.every((b) => b.klasor === k.id), () => uygula(k.id))),
    h("div", { class: "fis-ayrac" }),
    secenekSatir(icon("kapat", "i-20"), t("Klasörsüz"), l.every((b) => !b.klasor), () => uygula(undefined))],
  { hiza: "ust-sol", etiket: t("Klasöre taşı"), klavye });
}
const RAF_ADLARI = { okunacak: t("Okunacak"), okunuyor: t("Okunuyor"), bitti: t("Bitti") };
function rafSecenekleri(l, uygula) {
  return [...RAFLAR.map((r) => secenekSatir(icon("raf-" + r, "i-20"), RAF_ADLARI[r], l.every((b) => b.raf === r), () => uygula(r))),
    h("div", { class: "fis-ayrac" }),
    secenekSatir(icon("tema-oto", "i-20"), t("İlerlemeye göre"), l.every((b) => !b.raf), () => uygula(undefined))];
}
function topluRaf(capa, klavye) {
  const l = seciliBelgeler().filter((b) => b.tur !== "defter");
  if (!l.length) { toast(t("Defterler rafa konmaz; seçimde kitap yok.")); return; }
  fisAc(capa, [h("div", { class: "fis-baslik" }, t("Rafa koy")), ...rafSecenekleri(l, (r) => {
    fisKapat(true);
    topluUygula(l, "raf", r, r ? t("{n} belge {raf} rafına kondu", { n: l.length, raf: RAF_ADLARI[r] }) : t("{n} belgenin rafı ilerlemeye göre", { n: l.length }));
  })], { hiza: "ust-sol", etiket: t("Rafa koy"), klavye });
}
function topluFavori() {
  const l = seciliBelgeler();
  if (!l.length) return;
  const yeni = !l.every((b) => b.favori);
  topluUygula(l, "favori", yeni, yeni ? t("{n} belge favorilere eklendi", { n: l.length }) : t("{n} belge favorilerden çıkarıldı", { n: l.length }));
}
function topluSil() {
  const l = seciliBelgeler();
  if (!l.length) return;
  const giden = l.map((b) => kayit.copaAt(b, { yay: false })).filter(Boolean);
  bus.emit("belgeler", { tur: "sil" });
  secimKipi(false);
  toast(t("{n} belge çöpe taşındı", { n: giden.length }), { etiket: t("Geri al"), calistir: () => {
    for (const g of [...giden].reverse()) kayit.coptenGeriAl(g.belge.id, { yay: false });
    bus.emit("belgeler", { tur: "ekle" });
  } });
}

/* ---------- Künye penceresi (K8) ---------- */
// Ad, yazar, seri, cilt no ve kapak (görsel seç ya da üretilen kapağa dön). Telefonda alt çekmece
function kunyeAc(b, acan = document.activeElement) {
  fisKapat(true);
  const alan = (ad, deger, ek = {}) => {
    const girdi = h("input", { class: "girdi", value: deger ?? "", autocomplete: "off", ...ek });
    return [h("label", { class: "kunye-alan" }, h("span", { class: "t-etiket" }, ad), girdi), girdi];
  };
  const [adA, adG] = alan(t("Ad"), b.ad, { maxlength: "200", required: true, enterkeyhint: "next" });
  const [yazarA, yazarG] = alan(b.tur === "defter" ? t("Alt başlık") : t("Yazar"), b.yazar, { maxlength: "160", enterkeyhint: "next" });
  const [seriA, seriG] = alan(t("Seri"), b.seri, { maxlength: "120", enterkeyhint: "next", list: "kunye-seriler" });
  const [ciltA, ciltG] = alan(t("Cilt"), b.cilt, { type: "number", min: "0", step: "any", inputmode: "decimal", enterkeyhint: "done" });
  ciltA.classList.add("kunye-cilt");
  const seriler = [...new Set(store.belgeler.map((x) => x.seri).filter(Boolean))];
  const liste = h("datalist", { id: "kunye-seriler" }, seriler.map((s) => h("option", { value: s })));
  let yeniKapak = null, kapakSifirla = false;
  const onizleme = h("div", { class: "kunye-kapak kapak-sahne" }, kapakOlustur(b));
  const kapakGirdi = h("input", { type: "file", accept: "image/*", hidden: true });
  const kapakSec = h("button", { class: "ikincil", type: "button" }, icon("gorsel", "i-20"), t("Görsel seç"));
  const kapakGeri = h("button", { class: "metin-dugme", type: "button", hidden: !b.kapakElle }, t("Üretilen kapağa dön"));
  kapakSec.addEventListener("click", () => kapakGirdi.click());
  kapakGirdi.addEventListener("change", () => {
    const f = kapakGirdi.files[0];
    kapakGirdi.value = "";
    if (!f || !/^image\//.test(f.type)) return;
    yeniKapak = f; kapakSifirla = false;
    const url = URL.createObjectURL(f);
    onizleme.replaceChildren(h("div", { class: "kapak-kitap gorselli", "aria-hidden": "true" }, h("img", { class: "kapak-gorsel", src: url, alt: "" })));
    kapakGeri.hidden = false;
  });
  kapakGeri.addEventListener("click", () => {
    yeniKapak = null; kapakSifirla = true; kapakGeri.hidden = true;
    const { kapakElle, kapakGorsel, ...geri } = b;
    onizleme.replaceChildren(kapakOlustur(b.dosya ? { ...geri, kapakGorsel: b.kapakElle ? null : kapakGorsel } : geri));
  });
  const form = h("form", { class: "kunye-form" },
    h("div", { class: "kunye-ust" }, onizleme, h("div", { class: "kunye-kapak-eylem" }, kapakSec, kapakGeri, kapakGirdi)),
    adA, yazarA, h("div", { class: "kunye-seri" }, seriA, ciltA), liste);
  const kaydet = async () => {
    const ad = adG.value.trim();
    if (!ad) { adG.focus(); toast(t("Belgenin bir adı olmalı.")); return false; }
    b.ad = ad;
    const yaz = (k, v) => { if (v === "" || v == null) delete b[k]; else b[k] = v; };
    yaz("yazar", yazarG.value.trim());
    yaz("seri", seriG.value.trim().slice(0, 120));
    const c = Number.parseFloat(ciltG.value);
    yaz("cilt", b.seri && Number.isFinite(c) && c > 0 ? c : "");
    for (const k of store.kirpintilar) if (k.belgeId === b.id) k.belgeAd = ad;
    bus.emit("belgeler", { tur: "kunye", id: b.id });
    try {
      if (yeniKapak) await kayit.kapakDegistir(b, yeniKapak);
      else if (kapakSifirla) await kayit.kapakDegistir(b, null);
    } catch (hata) { console.warn("[kenar-notu] Kapak kaydedilemedi:", hata); toast(t("Kapak görseli okunamadı.")); }
    toast(t("“{ad}” künyesi güncellendi", { ad }));
    return true;
  };
  const alt = (kapat) => h("div", { class: "pencere-alt" },
    h("button", { class: "metin-dugme", type: "button", onclick: kapat }, t("Vazgeç")),
    h("button", { class: "birincil", type: "submit" }, t("Kaydet")));
  if (cekmeceMi()) {
    let c = null;
    form.append(alt(() => c?.kapat()));
    form.addEventListener("submit", async (e) => { e.preventDefault(); if (await kaydet()) c?.kapat(); });
    c = altCekmece({ baslik: t("Künye"), govde: form, duraklar: ["tam"], ilk: "tam", sinif: "kunye-cekmece", acan });
    setTimeout(() => adG.focus({ preventScroll: true }), 300);
    return;
  }
  const dlg = h("dialog", { class: "pencere kunye-pencere", "aria-labelledby": "kunyeBaslik" },
    h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "kunyeBaslik" }, t("Künye")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    form);
  form.append(alt(() => dlg.close()));
  form.addEventListener("submit", async (e) => { e.preventDefault(); if (await kaydet()) dlg.close(); });
  dlg.addEventListener("close", () => acan?.isConnected && acan.focus?.({ preventScroll: true }));
  pencereKur(dlg);
  adG.focus();
  adG.select();
}

// Çoğalt (K8): dosya paylaşılır, veri kopyalanır
async function belgeCogalt(b) {
  fisKapat(true);
  try {
    const yeni = await kayit.belgeCogalt(b);
    toast(t("“{ad}” hazır", { ad: yeni.ad }), { etiket: t("Aç"), calistir: () => belgeAcIstegi(yeni, kapakBul(yeni.id)) });
  } catch (hata) {
    console.warn("[kenar-notu] Çoğaltılamadı:", hata);
    toast(t("Belge çoğaltılamadı."));
  }
}
// Özgün dosyayı paylaş (K8): notsuz, içe aktarıldığı hâliyle (disa-aktar.js paylas)
async function ozgunPaylas(b) {
  fisKapat(true);
  const blob = await kayit.dosyaGetir(b.id);
  if (!blob) { toast(t("Dosya okunamadı.")); return; }
  const uzanti = { pdf: "pdf", epub: "epub", cizgi: "cbz" }[b.tur] || "bin";
  const ad = `${String(b.ad).replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 120) || t("belge")}.${uzanti}`;
  await dosyaPaylas(blob, ad);
}

/* ---------- Bağlam fişi: belge ---------- */
function belgeFisi(b, capa) {
  const icerik = h("div");
  const anaMenu = () => {
    const klasor = klasorBul(b.klasor);
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, b.ad),
      fisSatir("yildiz", b.favori ? t("Favorilerden çıkar") : t("Favorilere ekle"), null, () => { fisKapat(); favoriDegistir(b); }),
      fisSatir("metin", t("Yeniden adlandır"), null, adlandir),
      // 7.0 (K8): künye penceresi; ad, yazar, seri, cilt ve kapak
      fisSatir("kunye", t("Künyeyi düzenle"), b.seri ? `${b.seri}${b.cilt ? ` · ${t("{n}. cilt", { n: b.cilt })}` : ""}` : t("Ad, yazar, seri, kapak"), () => kunyeAc(b, capa)),
      fisSatir("klasor", t("Klasöre taşı"), klasor ? t("Şu an: {ad}", { ad: klasor.ad }) : t("Klasörsüz"), klasorSec),
      ...(b.tur !== "defter" ? [fisSatir("raf-" + (rafAl(b) || "okunacak"), t("Rafa koy"), rafAl(b) ? `${RAF_ADLARI[rafAl(b)]}${b.raf ? "" : ` · ${t("ilerlemeye göre")}`}` : t("Çalışma belgesi, rafta değil"), rafSec)] : []),
      fisSatir("cogalt", t("Çoğalt"), t("Notlarıyla birlikte ikinci kopya"), () => belgeCogalt(b)),
      ...(b.dosya ? [fisSatir("paylas", t("Özgün dosyayı paylaş"), t("Notsuz, içe aktarıldığı hâliyle"), () => ozgunPaylas(b))] : []),
      fisSatir("sec", t("Seç"), t("Birden çok belgeyle işlem"), () => { fisKapat(true); secimKipi(true); secim.idler.add(b.id); secim.capa = b.id; secimIsaretle(); }),
      // Kitabın dili (OZELLIKLER-6 §2): çeviri düğmeleri hedef dilden farklıysa görünür
      ...(dilDestekli(b) ? [fisSatir("ceviri", t("Kitabın dili"), dilOzet(b), dilSec)] : []),
      // Cep defteri: altı çizilen, yuvarlak içine alınan ve kenarına işaret konan yerler (OZELLIKLER-5)
      fisSatir("izler", t("Cep defteri"), t("Kalemin değdiği yerler"), () => { fisKapat(true); bus.emit("defter:ac", { belgeId: b.id }); }),
      // Bir PDF çizgi roman olarak da okunabilir: sayfa sayfa, panel panel (cizgi.js)
      // replaceChildren null'u "null" yazısına çevirir: satır yoksa hiç eklenmez
      ...(b.tur === "pdf" && b.dosya ? [fisSatir("cizgi-roman", b.cizgi ? t("Belge olarak oku") : t("Çizgi roman olarak oku"),
        b.cizgi ? t("Masa ve Koltuk’ta açılır") : t("Sayfa ve panel görünümü, karanlık zemin"), () => cizgiDegistir(b))] : []),
      // Belge değiştikçe günde bir kez saklanan önceki hâller (OZELLIKLER-8 §3.2)
      fisSatir("geri-al", t("Önceki hâline dön"), t("Son 7 günün kayıtları"), oncekiSec),
      h("div", { class: "fis-ayrac" }),
      silSatiri(t("Sil"), () => { fisKapat(true); belgeSil(b); }));
  };
  const oncekiSec = async () => {
    const baslik = h("div", { class: "fis-baslik" }, t("Önceki hâline dön"));
    icerik.replaceChildren(baslik, h("p", { class: "onceki-not" }, t("Bakılıyor")));
    aktifFis?.konumla();
    const { liste, buyuk } = await kayit.oncekiHaller(b.id);
    if (!icerik.isConnected) return;
    const satirlar = liste.map((g) => h("button", { class: "fis-satir onceki-satir", type: "button", role: "menuitem", onclick: () => oncekiyeDon(b, g) },
      icon(g.donus ? "geri-al" : "kronometre", "i-20"), h("span", {}, oncekiTarih(g)),
      h("small", {}, (g.donus ? `${t("Dönmeden önceki hâl")} · ` : "") + oncekiOzet(g.ozet))));
    icerik.replaceChildren(baslik,
      ...(satirlar.length ? satirlar : [h("p", { class: "onceki-not" }, t("Henüz önceki hâl yok. Belge değiştikçe günde bir kez saklanır."))]),
      ...(buyuk ? [h("p", { class: "onceki-not" }, t("Belge çok büyük; yeni önceki hâller saklanmıyor."))] : []),
      h("div", { class: "fis-ayrac" }),
      h("button", { class: "fis-satir", type: "button", role: "menuitem", onclick: () => { anaMenu(); aktifFis?.konumla(); } }, icon("sol", "i-20"), h("span", {}, t("Geri"))));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
  };
  const adlandir = () => {
    const girdi = h("input", { class: "ad-alani kucuk", value: b.ad, "aria-label": t("Belgenin yeni adı"), maxlength: "120", autocomplete: "off", enterkeyhint: "done" });
    const form = h("form", { class: "fis-form" },
      h("span", { class: "t-etiket" }, t("Yeni ad")), girdi,
      h("div", { class: "fis-form-alt" },
        h("button", { class: "metin-dugme", type: "button", onclick: () => { anaMenu(); aktifFis?.konumla(); } }, t("Vazgeç")),
        h("button", { class: "metin-dugme vurgulu", type: "submit" }, t("Kaydet"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ad = girdi.value.trim();
      fisKapat();
      if (!ad || ad === b.ad) return;
      b.ad = ad;
      for (const k of store.kirpintilar) if (k.belgeId === b.id) k.belgeAd = ad;
      bus.emit("belgeler", { tur: "ad", id: b.id });
    });
    icerik.replaceChildren(form);
    aktifFis?.konumla();
    girdi.focus();
    girdi.select();
  };
  const klasorSec = () => {
    const tasi = (id) => {
      fisKapat();
      if (b.klasor === id) return;
      b.klasor = id;
      bus.emit("belgeler", { tur: "tasi", id: b.id });
      toast(id ? t("{klasor} klasörüne taşındı", { klasor: klasorBul(id).ad }) : t("Klasörden çıkarıldı"));
    };
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, t("Klasöre taşı")),
      ...KLASORLER.map((k) => secenekSatir(h("i", { class: "kumas-sekme", style: `--c:${k.renk}` }), k.ad, b.klasor === k.id, () => tasi(k.id))),
      h("div", { class: "fis-ayrac" }),
      secenekSatir(icon("kapat", "i-20"), t("Klasörsüz"), !b.klasor, () => tasi(undefined)));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
  };
  const rafSec = () => {
    icerik.replaceChildren(h("div", { class: "fis-baslik" }, t("Rafa koy")), ...rafSecenekleri([b], (r) => {
      fisKapat();
      if ((b.raf || undefined) === r) return;
      const eski = b.raf;
      if (r) b.raf = r; else delete b.raf;
      bus.emit("belgeler", { tur: "raf", id: b.id });
      toast(r ? t("{raf} rafına kondu", { raf: RAF_ADLARI[r] }) : t("Raf ilerlemeye göre"), { etiket: t("Geri al"), calistir: () => { if (eski) b.raf = eski; else delete b.raf; bus.emit("belgeler", { tur: "raf", id: b.id }); } });
    }));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
  };
  const dilSec = () => {
    const otoAlt = h("small", {}, b.dilElle ? t("Metinden bulunur") : b.dil ? t("Bulunan: {dil}", { dil: dilAdi(b.dil) }) : b.dil === null ? t("Bulunamadı") : t("Bakılıyor"));
    const sec = (kod) => { fisKapat(); dilAyarla(b, kod); };
    const oto = h("button", { class: "fis-satir secenek", type: "button", role: "menuitemradio", "aria-checked": String(!b.dilElle), onclick: () => sec("oto") },
      icon("tema-oto", "i-20"), h("span", {}, t("Otomatik"), otoAlt), !b.dilElle ? icon("tik", "i-20") : h("span"));
    const listede = KITAP_DILLERI.includes(b.dil) || !b.dil ? KITAP_DILLERI : [b.dil, ...KITAP_DILLERI];
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, t("Kitabın dili")),
      oto,
      h("div", { class: "fis-ayrac" }),
      ...listede.map((k) => secenekSatir(h("span", { class: "dil-kod" }, anaDil(k).toUpperCase()), dilAdi(k), !!b.dilElle && b.dil === k, () => sec(k))));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
    // Daha bakılmadıysa şimdi bakılır; menü açıkken sonuç alt satıra yazılır
    if (!b.dilElle && b.dil === undefined) dilBak(b).then((dil) => { if (otoAlt.isConnected) otoAlt.textContent = dil ? t("Bulunan: {dil}", { dil: dilAdi(dil) }) : t("Bulunamadı"); });
  };
  anaMenu();
  fisAc(capa, icerik, { hiza: "yan", etiket: t("{ad} seçenekleri", { ad: b.ad }) });
}

// Önceki hâl satırı: o hâlin son değiştiği an (bilinmiyorsa kopyanın alındığı günden önce) ve kısa özet
function oncekiTarih(g) {
  if (g.zaman) return new Date(g.zaman).toLocaleString(yerel, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return t("{tarih} öncesi", { tarih: new Date(g.alindi).toLocaleDateString(yerel, { day: "numeric", month: "long" }) });
}
const oncekiOzet = (o) => [o?.sayfa ? t("{n} sayfa", { n: o.sayfa }) : null, t("{n} çizgi", { n: o?.cizgi || 0 }), t("{n} iz", { n: o?.iz || 0 })].filter(Boolean).join(" · ");
// Seçilen hâle döner: şimdiki hâl de önceki hâller listesine girer (aynı menüden ona dönülür), belge yeniden açılır
async function oncekiyeDon(b, g) {
  fisKapat(true);
  const yan = window.__knYan;
  if ((acik.ekran === "belge" && acik.belgeId === b.id) || (yan?.belgeId === b.id && yan.cerceve?.isConnected)) { toast(t("Önce belgeyi kapat.")); return; }
  try {
    const donus = await kayit.oncekiHaleDon(b.id, g.anahtar);
    toast(t("“{ad}” {tarih} hâline döndü.", { ad: b.ad, tarih: oncekiTarih(g) }) + (donus ? ` ${t("Şimdiki hâli de saklandı.")}` : ""));
    belgeAcIstegi(b, kapakBul(b.id));
  } catch (hata) {
    console.warn("[kenar-notu] Önceki hâle dönülemedi:", hata);
    toast(hata?.kod === "kilit" ? t("Kayıt bu pencerede kapalı; dönülemedi.")
      : hata?.kod === "okuma" ? t("Önceki hâline dönüldü ama okunamadı; sayfayı yenile.")
        : t("Önceki hâline dönülemedi; belge değişmedi."));
  }
}

// "Çizgi roman olarak oku": belge.cizgi kaydedilir ve belge yeni görünümünde açılır; geri dönmek aynı satırdan
function cizgiDegistir(b) {
  fisKapat(true);
  if (b.cizgi) delete b.cizgi; else b.cizgi = true;
  bus.emit("belgeler", { tur: "cizgi", id: b.id });
  if (b.cizgi) belgeAcIstegi(b, kapakBul(b.id));
  else toast(t("“{ad}” yeniden belge olarak açılacak", { ad: b.ad }));
}

// 7.0 (K5): silinen belge çöpe gider (store.cop), kartları çöp kaydına taşınır. Dosyası, verisi ve ekleri 30 gün
// yerinde durur; "Son silinenler"den geri yüklenir ya da kalıcı silinir. "Geri al" bildirimi bugünkü gibi kalır.
function belgeSil(b) {
  if (store.belgeler.indexOf(b) < 0) return;
  // Açık yan yana defter ya da açık belge silinmez (kitaplıktan silinir, ekran zaten kapalı)
  if (!kayit.copaAt(b)) return;
  toast(t("“{ad}” çöpe taşındı", { ad: b.ad }), {
    etiket: t("Geri al"),
    calistir: () => kayit.coptenGeriAl(b.id),
  });
}

/* ---------- Son silinenler (K5) ---------- */
function copCiz() {
  const q = arama.trim();
  if (!store.cop.length) return bos("sil", t("Çöp kutusu boş."), t("Sildiğin belgeler burada {n} gün durur; o sürede geri yükleyebilirsin.", { n: kayit.COP_GUN }));
  const liste = q ? store.cop.filter((g) => eslesir(`${g.belge.ad} ${g.belge.yazar || ""}`, q)) : store.cop;
  if (!liste.length) return bos("ara", t("“{q}” silinenlerde yok.", { q }), t("Başka bir ad dene."));
  const bosaltEtiket = h("span", {}, t("Çöpü boşalt"));
  const bosalt = h("button", { class: "ikincil tehlikeli cop-bosalt", type: "button" }, icon("sil", "i-20"), bosaltEtiket);
  onayla(bosalt, bosaltEtiket, t("Emin misin? Tekrar dokun"), async () => {
    const n = store.cop.length;
    await kayit.copuBosalt();
    toast(t("{n} belge kalıcı silindi", { n }));
  });
  const satirlar = liste.map((g) => {
    const b = g.belge, kalan = kayit.copKalanGun(g);
    const geri = h("button", { class: "ikincil", type: "button" }, icon("geri-al", "i-20"), t("Geri yükle"));
    geri.addEventListener("click", () => {
      kayit.coptenGeriAl(b.id);
      toast(t("“{ad}” kitaplığa geri döndü", { ad: b.ad }), { etiket: t("Aç"), calistir: () => belgeAcIstegi(b, kapakBul(b.id)) });
    });
    const silEtiket = h("span", {}, t("Kalıcı sil"));
    const sil = h("button", { class: "metin-dugme tehlikeli", type: "button" }, silEtiket);
    onayla(sil, silEtiket, t("Emin misin?"), async () => { await kayit.copKaliciSil(b.id); toast(t("“{ad}” kalıcı silindi", { ad: b.ad })); });
    return h("div", { class: "belge-satir cop-satir", role: "listitem", dataset: { id: b.id } },
      h("div", { class: "mini kapak-sahne" }, kapakOlustur(b, { mini: true })),
      h("div", { style: "min-width:0" },
        h("div", { class: "ad" }, vurgula(b.ad, arama)),
        h("div", { class: "t-kucuk" }, `${turAdi(b)} · ${t("{zaman} silindi", { zaman: neZaman(g.silindi) })}`)),
      h("span", { class: "cop-kalan" + (kalan <= 3 ? " az" : ""), title: COP_GUN_METNI }, kalan ? t("{n} gün kaldı", { n: kalan }) : t("Bugün silinecek")),
      h("div", { class: "cop-eylem" }, geri, sil));
  });
  return h("section", { class: "cop-bolum", "aria-labelledby": "cop-b" },
    h("header", { class: "bolum-ust" }, h("h2", { class: "t-b2", id: "cop-b" }, t("Çöp kutusu")),
      h("span", { class: "bolum-ust__sayi t-kucuk" }, `${t("{n} belge", { n: liste.length })} · ${COP_GUN_METNI}`), bosalt),
    h("div", { class: "liste cop-liste", role: "list" }, satirlar));
}

/* ---------- Kırpılanlar panosu (3.7) ---------- */
function panoCiz() {
  const q = arama.trim();
  if (!store.kirpintilar.length) {
    const pdf = sirala(store.belgeler.filter((b) => b.tur === "pdf" && !cizgiMi(b)))[0];
    return bos("kirp", t("Kırpılmış bir şey yok."), t("Masa’da Kırp aracıyla bir bölge seç, buraya düşer."), pdf ? { etiket: t("Masa’ya git"), calistir: () => bus.emit("git", { ekran: "belge", belgeId: pdf.id, mod: "masa" }) } : null);
  }
  let liste = q ? store.kirpintilar.filter((k) => eslesir(`${k.not} ${k.metin || ""} ${k.belgeAd}`, q)) : [...store.kirpintilar];
  if (!liste.length) return bos("ara", t("“{q}” için sonuç yok.", { q }), t("Kırpıntılarda yok. Yukarıdan bütün kitaplıkta ara."));
  if (siralamaAl() === "ad") liste.sort((a, b) => a.belgeAd.localeCompare(b.belgeAd, yerel) || a.sayfa - b.sayfa);
  else liste.sort((a, b) => b.zaman - a.zaman);
  return h("div", { class: "pano", role: "list" }, liste.map(kirpintiKart));
}

// Paylaş menüsünden gelen görüntü ve not bir belgeye bağlı değil (belgeId boş): sayfa yazılmaz, dokununca büyür
const sayfaEki = (k) => (k.belgeId ? ` · ${t("s. {n}", { n: k.sayfa })}` : "");
function kirpintiKart(k) {
  const baski = h("button", { class: "kirpinti-baski", type: "button", "aria-label": k.belgeId ? t("{ad}, s. {n}: belgede göster", { ad: k.belgeAd, n: k.sayfa }) : t("{ad}: büyüt", { ad: k.belgeAd }) },
    h("img", { src: k.gorsel, alt: k.belgeId ? t("{ad}, sayfa {n} kırpıntısı", { ad: k.belgeAd, n: k.sayfa }) : t("{ad} kırpıntısı", { ad: k.belgeAd }), draggable: "false" }));
  const altyazi = h("figcaption");
  const not = notAlani(k, altyazi);
  const daha = h("button", { class: "kirpinti-daha", type: "button", "aria-label": t("Kırpıntı seçenekleri"), "aria-haspopup": "menu" }, icon("daha"));
  const kart = h("div", { class: "kirpinti", role: "listitem", dataset: { id: k.id } },
    h("figure", {}, baski, altyazi),
    // Uzun ad kısalır, sayfa numarası her zaman okunur
    h("div", { class: "kaynak" }, h("span", {}, k.belgeAd), k.belgeId ? h("b", {}, `· ${t("s. {n}", { n: k.sayfa })}`) : null, daha));
  baski.addEventListener("click", () => kirpintiAc(k));
  uzunBasma(baski, () => kirpintiFisi(k, baski, kart, not));
  daha.addEventListener("click", () => kirpintiFisi(k, daha, kart, not));
  return kart;
}

// Not satırı: dokununca yerinde düzenlenir, Enter ya da dışarı dokunmak kaydeder
function notAlani(k, altyazi) {
  const goster = () => {
    const d = h("button", { class: "not-yaz" + (k.not ? "" : " bos-not"), type: "button", "aria-label": k.not ? t("Notu düzenle: {not}", { not: k.not }) : t("Not ekle") },
      k.not ? vurgula(k.not, arama) : t("not ekle"));
    d.addEventListener("click", duzenle);
    altyazi.replaceChildren(d);
  };
  const duzenle = () => {
    // Alanın adı "t" değil: t() çeviri işlevini gölgelemesin
    const alan = h("textarea", { class: "not-girdi", rows: "1", maxlength: "240", "aria-label": t("Kırpıntı notu"), placeholder: t("not ekle") });
    alan.value = k.not || "";
    let vazgec = false;
    alan.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); alan.blur(); }
      else if (e.key === "Escape") { e.stopPropagation(); vazgec = true; alan.blur(); }
    });
    alan.addEventListener("blur", () => {
      const yeni = alan.value.trim();
      if (!vazgec && yeni !== (k.not || "")) {
        k.not = yeni;
        sessiz = true;
        try { bus.emit("kirpintilar", { tur: "not", id: k.id }); } finally { sessiz = false; }
      }
      goster();
    });
    // field-sizing olmayan Safari'de (17, 26.2 öncesi) alan yazdıkça büyüsün
    if (!CSS.supports?.("field-sizing", "content")) {
      const boyutla = () => { alan.style.height = "auto"; alan.style.height = `${alan.scrollHeight}px`; };
      alan.addEventListener("input", boyutla);
      requestAnimationFrame(boyutla);
    }
    altyazi.replaceChildren(alan);
    alan.focus();
    alan.setSelectionRange(alan.value.length, alan.value.length);
  };
  goster();
  return { duzenle };
}

function kirpintiFisi(k, capa, kart, not) {
  kart.classList.add("secili");
  fisAc(capa, [
    h("div", { class: "fis-baslik" }, k.belgeAd + sayfaEki(k)),
    k.belgeId ? fisSatir("sayfalar", t("Belgede göster"), null, () => { fisKapat(true); kirpintiAc(k); }) : null,
    fisSatir("notlar", k.not ? t("Notu düzenle") : t("Not ekle"), null, () => { fisKapat(true); not.duzenle(); }),
    h("div", { class: "fis-ayrac" }),
    silSatiri(t("Sil"), () => { fisKapat(true); kirpintiyiSil(k, kart); }),
  ], { hiza: "yan", etiket: t("Kırpıntı seçenekleri"), kapaninca: () => kart.classList.remove("secili") });
}

function kirpintiAc(k) {
  if (!k.belgeId) { kirpintiBuyut(k); return; }
  if (!belgeBul(k.belgeId)) { toast(t("Bu kırpıntının belgesi artık kitaplıkta yok.")); return; }
  sonKaynak = null;
  bus.emit("git", { ekran: "belge", belgeId: k.belgeId, sayfa: k.sayfa });
}

function kirpintiBuyut(k) {
  const dlg = h("dialog", { class: "pencere kirpinti-buyuk", "aria-label": k.belgeAd },
    h("img", { src: k.gorsel, alt: k.belgeAd }),
    k.not ? h("p", {}, k.not) : null,
    // Paylaşımla gelen uzun metnin tamamı (not alanı kısaltılmış hâlini tutar)
    k.metin ? h("p", { style: "white-space: pre-wrap; max-height: 40vh; overflow: auto; user-select: text" }, k.metin) : null,
    h("div", { class: "pencere-alt" }, h("button", { class: "metin-dugme vurgulu", type: "button", onclick: () => dlg.close() }, t("Kapat"))));
  pencereKur(dlg);
  $(".pencere-alt button", dlg)?.focus();
}

async function kirpintiyiSil(k, kart) {
  const i = store.kirpintilar.indexOf(k);
  if (!hareketAz()) await bitince(kart.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.96)" }], { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }), 160);
  kirpintiSil(k.id);
  toast(t("Kırpıntı silindi"), {
    etiket: t("Geri al"),
    calistir: () => {
      store.kirpintilar.splice(Math.min(i, store.kirpintilar.length), 0, k);
      bus.emit("kirpintilar", { tur: "ekle", kirpinti: k });
    },
  });
}

/* ---------- Klasörler ---------- */
function yeniKlasor() {
  const varOlan = $(".klasor-yeni input", K.kenar);
  if (varOlan) { varOlan.focus(); return; }
  const renk = KLASOR_RENKLERI[KLASORLER.length % KLASOR_RENKLERI.length];
  const girdi = h("input", { placeholder: t("Klasör adı"), "aria-label": t("Yeni klasörün adı"), maxlength: "40", autocomplete: "off", enterkeyhint: "done" });
  const satir = h("div", { class: "klasor-yeni" }, h("i", { class: "kumas-sekme", style: `--c:${renk}` }), girdi);
  let bitti = false;
  const bitir = (kaydet) => {
    if (bitti) return;
    bitti = true;
    const ad = girdi.value.trim();
    satir.remove();
    if (!kaydet || !ad) return;
    const k = { id: yeniId("f"), ad, renk };
    KLASORLER.push(k);
    klasorlerCiz();
    gorunumSec("klasor:" + k.id);
    toast(t("{ad} klasörü hazır. Kapaklara uzun basıp taşıyabilirsin.", { ad }));
  };
  girdi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); bitir(true); }
    else if (e.key === "Escape") { e.stopPropagation(); bitir(false); }
  });
  girdi.addEventListener("blur", () => bitir(true));
  K.klasorListe.append(satir);
  girdi.focus();
}

/* ---------- Yeni menüsü ---------- */
function yeniMenusu(klavye) {
  if (aktifFis?.capa === K.yeni) { fisKapat(); return; }
  K.yeni.setAttribute("aria-expanded", "true");
  // Dosya açmak ilk satır (TASARIM-4 3.1); alt satır platforma göre başka yolu söyler
  fisAc(K.yeni, [
    fisSatir("pdf", t("Dosya aç"), `${t("PDF, EPUB, CBZ ya da .kenar yedeği.")} ${dosyaIpucu()}`, () => { fisKapat(true); dosyaSec(); }),
    // Klasör seçici olmayan tarayıcıda (Android, iOS) görünmez; orada "Dosya aç" çoklu seçer
    kayit.klasorDestegi() ? fisSatir("klasor", t("Bilgisayardaki kitaplar"),
      kitapKlasoruAdi ? t("{ad} klasöründe yeni kitaplara bak", { ad: kitapKlasoruAdi }) : t("Bir klasör seç; içindeki PDF, EPUB ve CBZ’ler listelenir"),
      () => { fisKapat(true); kitapKlasoruAc(); }) : null,
    fisSatir("yeni-defter", t("Yeni defter"), t("Boş, çizgili, kareli, noktalı ya da Cornell"), () => { fisKapat(true); yeniDefterPenceresi(); }),
  ], { hiza: "alt-sag", etiket: t("Yeni"), klavye, kapaninca: () => K.yeni.setAttribute("aria-expanded", "false") });
}

/* ---------- İçe aktarma (OZELLIKLER-3 §1) ---------- */
// Belge almanın öbür yolu, platforma göre (iOS'ta paylaş hedefi yok)
const dosyaIpucu = () => (iosMu() ? (ipadMi() ? t("Dosyalar uygulamasından sürükleyip de bırakabilirsin.") : t("Dosyalar uygulamasından seçersin."))
  : platform() === "android" ? t("Başka bir uygulamadan Paylaş > Kenar Notu da olur.")
  : t("Dosyayı pencereye sürükleyip de bırakabilirsin."));
// Kapak hazırlanırken rafta yer tutan dizgi kartları: { id, dizgi: true, tur, ad, klasor }
const dizgiler = [];
let dosyaGirdisi = null;
function dosyaSec() {
  if (!dosyaGirdisi) {
    // iOS dosya seçicisi uzantıları tür kimliğine çevirir; türler de verilir ki Android'de EPUB gri kalmasın
    // application/octet-stream: uzantısız dosya da seçilebilsin (tür içerikten tanınır)
    dosyaGirdisi = h("input", { type: "file", accept: ".pdf,.epub,.cbz,.cbr,.zip,.kenar,application/pdf,application/epub+zip,application/vnd.comicbook+zip,application/octet-stream", multiple: true, hidden: true });
    dosyaGirdisi.addEventListener("change", () => {
      const dosyalar = [...dosyaGirdisi.files];
      dosyaGirdisi.value = "";
      const yedek = dosyalar.find((f) => /\.kenar$/i.test(f.name));
      if (yedek) { yedekPenceresi(yedek); return; }
      if (dosyalar.length) dosyalariAl(dosyalar);
    });
    document.body.append(dosyaGirdisi);
  }
  dosyaGirdisi.click();
}
const tahminiTur = (f) => (/\.epub$/i.test(f.name) || f.type === "application/epub+zip" ? "epub"
  : /\.(cbz|cbr|zip)$/i.test(f.name) || /comicbook/.test(f.type) ? "cizgi" : "pdf");
// Kitaplığın açtığı dosyalar: PDF, EPUB, CBZ (ve içinde yalnız görsel olan zip). CBR'yi kayit.js nedeniyle reddeder.
const uygunDosya = (f) => /\.(pdf|epub|cbz|cbr|zip)$/i.test(f.name) || /^application\/(pdf|epub\+zip|vnd\.comicbook\+zip|vnd\.comicbook-rar)$/.test(f.type);
// Adından tanınmayan dosya içeriğinden tanınır (OZELLIKLER-8 §3.3): uzantısız PDF, adı değişmiş .kenar yedeği
async function dosyalariAyir(dosyalar) {
  const s = { belgeler: [], yedek: null };
  for (const f of dosyalar) {
    if (/\.kenar$/i.test(f.name)) { s.yedek ||= f; continue; }
    if (uygunDosya(f)) { s.belgeler.push(f); continue; }
    let tur = null;
    try { tur = await kayit.dosyaTuru(f); } catch { tur = null; }
    if (tur === "yedek") s.yedek ||= f;
    else if (tur) s.belgeler.push(f);
  }
  return s;
}
// Klasör görünümündeyken gelen PDF o klasöre düşer
const secimKlasoru = () => (tercih.secim.startsWith("klasor:") && klasorBul(tercih.secim.slice(7)) ? tercih.secim.slice(7) : undefined);

// Dosyalar sırayla alınır: bellek bir dosyayla sınırlı kalır. Tek dosyada var olan açılır, yeni olan bildirilir.
async function dosyalariAl(dosyalar, { klasor = secimKlasoru() } = {}) {
  const yerler = dosyalar.map((f) => {
    const tur = tahminiTur(f);
    return { id: yeniId("dz"), dizgi: true, tur, ad: f.name.replace(/\.(pdf|epub|cbz|cbr|zip)$/i, "") || t("Adsız"), klasor: tur === "pdf" ? klasor : undefined, acilis: Date.now() };
  });
  dizgiler.unshift(...yerler);
  kitaplikYenile();
  const sonuclar = [];
  for (const [i, f] of dosyalar.entries()) {
    const once = new Set(store.belgeler.map((b) => b.id));
    try {
      const b = await kayit.belgeIceAktar(f, { klasor });
      sonuclar.push({ b, vardi: once.has(b.id) });
    } catch (hata) {
      // Adı ne olursa olsun içi Kenar Notu yedeği: yedekten yükleme sorulur
      if (hata?.kod === "yedek") { yedekPenceresi(f); continue; }
      console.warn("[kenar-notu] İçe aktarılamadı:", f.name, hata);
      toast(hata?.kod === "cbr" || hata?.kod === "bozuk" ? hata.message
        : hata?.kod === "tur" ? t("“{ad}” açılamadı: yalnız PDF, EPUB ve CBZ.", { ad: f.name }) : t("“{ad}” içe aktarılamadı.", { ad: f.name }));
    } finally {
      const j = dizgiler.indexOf(yerler[i]);
      if (j >= 0) dizgiler.splice(j, 1);
      kitaplikYenile();
    }
  }
  if (sonuclar.some((s) => !s.vardi)) depoUyarisiBirKez();
  if (sonuclar.length === 1) {
    const { b, vardi } = sonuclar[0];
    if (vardi) { toast(t("“{ad}” zaten kitaplıkta, açılıyor.", { ad: b.ad })); belgeAcIstegi(b, kapakBul(b.id)); }
    else toast(t("“{ad}” kitaplığa eklendi", { ad: b.ad }), { etiket: t("Aç"), calistir: () => belgeAcIstegi(b, kapakBul(b.id)) });
  } else if (sonuclar.length > 1) {
    const yeni = sonuclar.filter((s) => !s.vardi).length;
    toast(yeni ? t("{n} belge kitaplığa eklendi", { n: yeni }) : t("Bu dosyalar zaten kitaplıkta."));
  }
  return sonuclar.map((s) => s.b);
}
const kapakBul = (id) => (K.sonuclar ? $(`.belge[data-id="${CSS.escape(id)}"] :is(a.kapak-sahne, a.kapak) > *`, K.sonuclar) : null);

// Kitap klasörü (13. tur, kitap-klasoru.js): bilgisayardaki klasörden toplu içe aktarma. Modül ilk gerektiğinde yüklenir.
let kitapKlasoruSoz = null, kitapKlasoruAdi = null;
const kitapKlasoruModulu = () => (kitapKlasoruSoz ||= import("./kitap-klasoru.js").then((m) => {
  m.baglan({ pencereKur, boyutMetni, neZaman, iceAktar: klasordenAl, belgeAc: (b) => belgeAcIstegi(b, kapakBul(b.id)),
    bitince: (n) => { if (n) depoUyarisiBirKez(); }, fisKabi: () => K.klasorFisi });
  return m;
}).catch((hata) => { kitapKlasoruSoz = null; throw hata; }));
const kitapKlasoruHatasi = (hata) => { console.warn("[kenar-notu] Kitap klasörü açılamadı:", hata); toast(t("Kitap klasörü açılamadı.")); };
// Dokunuşla çağrılır: kayıtlı klasör varsa ona bakılır, yoksa seçici açılır
function kitapKlasoruAc() { kitapKlasoruModulu().then((m) => m.ac()).catch(kitapKlasoruHatasi); }
function kitapKlasoruSec() { kitapKlasoruModulu().then((m) => m.sec()).catch(kitapKlasoruHatasi); }
bus.on("kitap-klasoru", (o) => { if (o?.tur === "birakildi") kitapKlasoruAdi = null; else if (o?.ad) kitapKlasoruAdi = o.ad; });
// Klasörden tek dosya: Dosya aç ile aynı kayıt yolu ve aynı dizgi kartı; hata fırlatır (liste satırında gösterilir)
async function klasordenAl(f) {
  const tur = tahminiTur(f), klasor = secimKlasoru();
  const yer = { id: yeniId("dz"), dizgi: true, tur, ad: f.name.replace(/\.(pdf|epub|cbz)$/i, "") || t("Adsız"), klasor: tur === "pdf" ? klasor : undefined, acilis: Date.now() };
  dizgiler.unshift(yer);
  kitaplikYenile();
  const once = new Set(store.belgeler.map((b) => b.id));
  try {
    const b = await kayit.belgeIceAktar(f, { klasor });
    return { b, vardi: once.has(b.id) };
  } finally {
    const j = dizgiler.indexOf(yer);
    if (j >= 0) dizgiler.splice(j, 1);
    kitaplikYenile();
  }
}

// Dizgi kartı: kapak gelene kadar kurşun harf satırları ve camda çalışan iz
function dizgiKapak(d, mini = false) {
  const el = h("div", { class: `dizgi-kapak ${d.tur}`, "aria-hidden": "true" });
  if (!mini) {
    el.append(h("div", { class: "dizgi-satirlar" }, [62, 88, 74, 92, 50, 80, 68].map((w) => h("i", { style: `--w:${w}%` }))));
    const iz = izOlustur();
    iz.dataset.durum = "dusunuyor";
    el.append(h("span", { class: "cam cam-k dizgi-cam" }, d.tur === "epub" ? "EPUB" : d.tur === "cizgi" ? "CBZ" : "PDF", iz));
  }
  return el;
}
function dizgiHucre(d, ekSinif = "") {
  return h("div", { class: `belge dizgi ${ekSinif}`.trim(), role: "listitem", "aria-busy": "true", dataset: { id: d.id } },
    h("div", { class: "kapak-sahne" }, dizgiKapak(d)),
    h("h3", { class: "belge-ad" }, d.ad),
    h("div", { class: "belge-meta" }, h("span", { class: "t-etiket" }, h("span", {}, t("Dizgide")))));
}
function dizgiSatir(d) {
  return h("div", { class: "belge-satir dizgi", role: "listitem", "aria-busy": "true", dataset: { id: d.id } },
    h("div", { class: "mini kapak-sahne" }, dizgiKapak(d, true)),
    h("div", { style: "min-width:0" }, h("div", { class: "ad" }, d.ad), h("div", { class: "t-kucuk" }, t("Dizgide · kapak hazırlanıyor"))));
}

/* ---------- Yeni defter penceresi (3.8) ---------- */
function yeniDefterPenceresi() {
  const d = { renk: KAPAK_RENKLERI[0], kagit: "grid" };
  const etiketAd = h("b", {}, t("Adsız defter"));
  const etiketTur = h("small");
  const kapak = h("div", { class: "kapak-defter" }, h("div", { class: "etiket" }, etiketAd, etiketTur));
  const yaprak = h("i", { class: "onizleme-yaprak" });
  const girdi = h("input", { class: "ad-alani", placeholder: t("Defterin adı"), "aria-label": t("Defterin adı"), maxlength: "80", autocomplete: "off", enterkeyhint: "done" });

  const numuneler = KAPAK_RENKLERI.map((r) => {
    const n = h("button", { class: "numune" + (r[2] ? " acik-renk" : ""), type: "button", style: `--c:${r[1]}`, "aria-label": t(r[0]), "aria-pressed": "false" });
    n.addEventListener("click", () => { d.renk = r; guncelle(); });
    return n;
  });
  const yapraklar = TEMPLATES.map((sb) => {
    const y = h("button", { class: "mini-yaprak", type: "button", "aria-pressed": "false" }, h("i", { class: KAGIT_SINIF[sb.id] }), t(sb.label));
    y.addEventListener("click", () => { d.kagit = sb.id; guncelle(); });
    return y;
  });

  const guncelle = () => {
    kapak.style.setProperty("--c", d.renk[1]);
    kapak.classList.toggle("acik-renk", !!d.renk[2]);
    etiketAd.textContent = girdi.value.trim() || t("Adsız defter");
    etiketTur.textContent = t(kagitAdi(d.kagit)).toLocaleUpperCase(yerel);
    yaprak.className = `onizleme-yaprak ${KAGIT_SINIF[d.kagit]}`;
    numuneler.forEach((n, i) => n.setAttribute("aria-pressed", String(KAPAK_RENKLERI[i] === d.renk)));
    yapraklar.forEach((y, i) => y.setAttribute("aria-pressed", String(TEMPLATES[i].id === d.kagit)));
  };
  girdi.addEventListener("input", guncelle);

  const form = h("form", { method: "dialog" },
    h("h2", { class: "t-b1", id: "ydBaslik" }, t("Yeni defter")),
    girdi,
    h("span", { class: "t-etiket", id: "ydKapak" }, t("Kapak")),
    h("div", { class: "numuneler", role: "group", "aria-labelledby": "ydKapak" }, numuneler),
    h("span", { class: "t-etiket", id: "ydKagit" }, t("Kâğıt")),
    h("div", { class: "kagit-turu", role: "group", "aria-labelledby": "ydKagit" }, yapraklar),
    h("div", { class: "pencere-alt" },
      h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, t("Vazgeç")),
      h("button", { class: "birincil", type: "submit" }, icon("yeni-defter", "i-20"), t("Oluştur"))));

  const dlg = h("dialog", { class: "pencere", "aria-labelledby": "ydBaslik" },
    h("div", { class: "yeni-defter" }, h("div", { class: "onizleme", "aria-hidden": "true" }, yaprak, kapak), form));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const klasor = tercih.secim.startsWith("klasor:") ? tercih.secim.slice(7) : undefined;
    const b = {
      id: yeniId("d"), tur: "defter", ad: girdi.value.trim() || t("Adsız defter"), klasor,
      sayfaSayisi: 3, sayfa: 1, ilerleme: 0, favori: false, acilis: Date.now(),
      kapak: d.renk[1], kagit: d.kagit, veri: null,
    };
    store.belgeler.unshift(b);
    bus.emit("belgeler", { tur: "ekle", belge: b });
    // Önizlemedeki kapak ilk sayfaya dönüşür (6.3)
    acikPencere = dlg;
    sonKaynak = kapak;
    bus.emit("git", { ekran: "belge", belgeId: b.id });
  });
  pencereKur(dlg);
  guncelle();
  girdi.focus();
}

// Pencere ortak davranışı: perdeye dokununca kapanır, kapanınca DOM'dan çıkar
function pencereKur(dlg) {
  dlg.addEventListener("close", () => { if (acikPencere === dlg) acikPencere = null; dlg.remove(); });
  dlg.addEventListener("click", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  document.body.append(dlg);
  fisKapat(true);
  dlg.showModal();
}

/* ---------- Bilgi pencereleri: Yedekle ve İçe aktar ---------- */
function bilgiPenceresi({ ikon, baslik, metin, satirlar, not, eylem }) {
  const dlg = h("dialog", { class: "pencere bilgi", "aria-labelledby": "bilgiBaslik", "aria-describedby": "bilgiMetin" });
  dlg.append(
    icon(ikon, "bilgi-simge"),
    h("h2", { class: "t-b2", id: "bilgiBaslik" }, baslik),
    h("p", { id: "bilgiMetin" }, metin),
    // append null'u "null" yazısına çevirir: olmayan parça hiç eklenmez
    ...(satirlar ? [h("dl", { class: "kilavuzlar" }, satirlar.map(([ad, deger]) => h("div", { class: "kilavuz-satir" }, h("dt", {}, ad), h("dd", {}, String(deger)))))] : []),
    ...(not ? [h("p", { class: "bilgi-not" }, not)] : []),
    h("div", { class: "fis-hedera", "aria-hidden": "true" }, parca('<svg viewBox="0 0 28 16"><use href="#i-hedera"/></svg>')),
    h("div", { class: "pencere-alt" },
      h("button", { class: eylem ? "metin-dugme" : "metin-dugme vurgulu", type: "button", onclick: () => dlg.close() }, eylem ? t("Kapat") : t("Tamam")),
      eylem ? h("button", { class: "birincil", type: "button", onclick: () => { dlg.close(); eylem.calistir(); } }, eylem.etiket) : null));
  pencereKur(dlg);
  odakla($(".pencere-alt button:last-child", dlg));
}

/* ---------- Yedek ve depo (OZELLIKLER-3 §2) ---------- */
function boyutMetni(n) {
  const mb = n / 1048576;
  if (mb >= 1024) return `${(mb / 1024).toLocaleString(yerel, { maximumFractionDigits: 1 })} GB`;
  if (mb >= 1) return `${mb.toLocaleString(yerel, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
// Depo göstergesi: "Kullanılan 84 MB · kalıcı", ölçü camın arkasında
function depoGostergesi() {
  const cam = h("span", { class: "cam cam-k depo-cam" }, "··");
  const durum = h("span", {}, "");
  const el = h("div", { class: "depo-gosterge", role: "status" }, h("span", {}, t("Kullanılan")), cam, durum);
  kayit.depoDurumu().then((d) => {
    if (!d.olculdu) {   // güvenli olmayan bağlantıda navigator.storage yoktur
      cam.textContent = "?";
      durum.textContent = `· ${t("geçici")}`;
      el.title = t("Bu bağlantıda tarayıcı depo bilgisini vermez ve kalıcılık istenemez; localhost ya da https ile aç");
      return;
    }
    cam.textContent = boyutMetni(d.kullanilan);
    durum.textContent = `· ${d.kalici ? t("kalıcı") : t("geçici")}`;
    el.title = d.kalici ? t("Tarayıcı bu verileri kendiliğinden silmez") : t("Yer daralırsa tarayıcı silebilir; ilk kayıtta kalıcılık istenir");
    if (d.kota) el.setAttribute("aria-label", t("Kullanılan {kullanilan}, {kota} yerin içinden, {durum}", { kullanilan: boyutMetni(d.kullanilan), kota: boyutMetni(d.kota), durum: d.kalici ? t("kalıcı") : t("geçici") }));
  });
  return el;
}
const yedekAdi = () => {
  const z = new Date();
  const iki = (n) => String(n).padStart(2, "0");
  return `${t("Kenar Notu yedeği")} ${z.getFullYear()}-${iki(z.getMonth() + 1)}-${iki(z.getDate())}.kenar`;
};
// Paylaş menüsü varsa orada (Drive, Samsung Notes...), yoksa indirilir. disa-aktar.js yoksa kendi yolumuz.
async function dosyaPaylas(blob, ad) {
  try {
    const m = await import("./disa-aktar.js");
    if (typeof m.paylas === "function") return await m.paylas(blob, ad);
  } catch (hata) { if (hata?.name === "AbortError") return; }
  const dosya = new File([blob], ad, { type: blob.type || "application/octet-stream" });
  if (navigator.canShare?.({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya], title: ad }); return; }
    catch (hata) { if (hata?.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: ad, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
let yedekSuruyor = false;
// parola: şifreli yedek (10.5). Parola hiçbir yere yazılmaz, yalnız bu çağrıda kullanılır
async function yedekAlIstegi(dugme, { parola = null } = {}) {
  if (yedekSuruyor) return;
  yedekSuruyor = true;
  const asil = dugme ? [...dugme.childNodes] : null;
  if (dugme) { dugme.disabled = true; dugme.textContent = t("Hazırlanıyor"); }
  else toast(t("Yedek hazırlanıyor"), { kalici: true });
  // Ağır iş işçide: ekran kilitlenmez, düğme yüzdeyi gösterir
  const ilerleme = (o) => { if (dugme) dugme.textContent = t("Yedek hazırlanıyor %{n}", { n: Math.round(o * 100) }); };
  try {
    const blob = await kayit.yedekAl({ ilerleme, parola });
    await dosyaPaylas(blob, yedekAdi());
    ayarla({ sonYedek: Date.now() });
    toast(parola ? t("Şifreli yedek hazır: {boyut}", { boyut: boyutMetni(blob.size) }) : t("Yedek hazır: {boyut}", { boyut: boyutMetni(blob.size) }));
  } catch (hata) {
    console.warn("[kenar-notu] Yedek alınamadı:", hata);
    toast(hata?.kod === "eksik" || hata?.kod === "buyuk" || hata?.kod === "sifre-yok" ? hata.message : t("Yedek alınamadı."));
  } finally {
    yedekSuruyor = false;
    if (dugme) { dugme.disabled = false; dugme.replaceChildren(...asil); }
  }
}
let yedekGirdisi = null;
function yedekSec() {
  if (!yedekGirdisi) {
    yedekGirdisi = h("input", { type: "file", accept: ".kenar,application/zip", hidden: true });
    yedekGirdisi.addEventListener("change", () => {
      const f = yedekGirdisi.files[0];
      yedekGirdisi.value = "";
      if (f) yedekYukleIstegi(f);
    });
    document.body.append(yedekGirdisi);
  }
  yedekGirdisi.click();
}
// Şifreli yedekte parola sorulur; yanlışsa anlaşılır iletiyle yeniden sorulur (10.5 madde 3). Vazgeçilirse kitaplık değişmez
async function yedekYukleIstegi(f) {
  let parola = null, hataMetni = "";
  for (;;) {
    if (parola !== null || !hataMetni) toast(parola ? t("Yedek açılıyor…") : t("Yedek yükleniyor…"));
    try { await kayit.yedekYukle(f, { parola }); return; }   // bitince sayfa yenilenir
    catch (hata) {
      if (hata?.kod === "parola" || hata?.kod === "parola-yanlis") {
        hataMetni = hata.kod === "parola-yanlis" ? t("Parola yanlış. Büyük küçük harfe dikkat edip yeniden dene.") : "";
        parola = await parolaSor({ hata: hataMetni });
        if (parola === null) { toast(t("Yedek yüklenmedi; kitaplık değişmedi.")); return; }
        continue;
      }
      yedekYuklemeHatasi(hata);
      return;
    }
  }
}
function yedekYuklemeHatasi(hata) {
  {
    console.warn("[kenar-notu] Yedek yüklenemedi:", hata);
    toast(hata?.kod === "sifre-yok" ? hata.message : hata?.kod === "bicim" ? t("Bu bir Kenar Notu yedeği değil.")
      : hata?.kod === "okuma" ? t("Yedek dosyası okunamadı: dosyaya erişilemedi ya da bellek yetmedi. Kitaplık değişmedi.")
      : hata?.kod === "baska" ? t("Kitaplık başka bir pencerede açık. Yüklemek için o pencereyi kapatıp burayı yenile.")
      : t("Yedek yüklenemedi; kitaplık değişmedi."));
  }
}
// Otomatik yedek (OZELLIKLER-8 §3.1). Ayarlar'da klasör seçimi ve son yazılan yedek; kayit.js günde bir yazar.
// Klasöre yazamayan tarayıcıda (iOS, Firefox) yedek 7 günde bir sessizce hatırlatılır.
function otoYedekDenetimi() {
  const el = h("div", { class: "oto-yedek" });
  if (!kayit.klasorDestegi()) {
    el.append(h("p", { class: "ayar-not" }, t("Bu tarayıcı klasöre kendiliğinden yazamıyor; haftada bir yedek almayı hatırlatırız.")));
    return { el, guncelle: () => {} };
  }
  let yaziyor = "";
  const ciz = async () => {
    const k = await kayit.yedekKlasoru().catch(() => null);
    const sec = h("button", { class: "ikincil", type: "button" }, icon("klasor", "i-20"), k ? t("Klasörü değiştir") : t("Otomatik yedek klasörü seç"));
    sec.addEventListener("click", () => klasorSecIstegi(sec));
    if (!k) {
      el.replaceChildren(h("p", { class: "ayar-not" }, t("Bir klasör seç: Kenar Notu oraya günde bir yedek yazar, son 7 tanesi kalır.")),
        h("div", { class: "ayar-yedek__dugmeler" }, sec));
      return;
    }
    // k.hata kayıtta Türkçe durabilir (kayit.js yazar): görüntülerken çevrilir
    const durum = yaziyor || (k.izin !== "granted" ? t("İzin bekliyor") : k.hata ? t(k.hata) : k.son ? t("Son otomatik yedek: {zaman}", { zaman: neZaman(k.son) }) : t("Henüz yazılmadı"));
    const izin = k.izin !== "granted"
      ? h("button", { class: "ikincil", type: "button", onclick: () => kayit.yedekKlasoruIzinIste().then((ok) => { if (!ok) toast(t("İzin verilmedi; otomatik yedek bekliyor.")); ciz(); }) }, t("İzin ver"))
      : null;
    const kapat = h("button", { class: "metin-dugme", type: "button", onclick: () => kayit.yedekKlasoruBirak().then(() => toast(t("Otomatik yedek kapandı; klasördeki dosyalar duruyor."))) }, t("Otomatik yedeği kapat"));
    el.replaceChildren(
      h("p", { class: "oto-yedek__klasor" }, icon("klasor", "i-20"), h("span", {}, k.ad, h("small", { class: k.hata && !yaziyor ? "hata" : null }, durum))),
      h("div", { class: "ayar-yedek__dugmeler" }, izin, sec, kapat));
  };
  const coz = bus.on("yedek:klasor", (o) => {
    if (!el.isConnected && el.dataset.cizildi) { coz(); return; }
    yaziyor = o?.tur === "yaziyor" ? t("Yedek yazılıyor") : "";
    ciz();
  });
  ciz().then(() => { el.dataset.cizildi = "1"; });
  return { el, guncelle: () => {} };
}
async function klasorSecIstegi(dugme) {
  const asil = [...dugme.childNodes];
  try {
    const ilerleme = (o) => { dugme.disabled = true; dugme.textContent = t("Yedek hazırlanıyor %{n}", { n: Math.round(o * 100) }); };
    const ok = await kayit.yedekKlasoruSec({ ilerleme });
    toast(ok ? t("Otomatik yedek açık: ilk yedek klasöre yazıldı.") : t("Klasör seçildi ama yedek yazılamadı."));
  } catch (hata) {
    if (hata?.name !== "AbortError") {
      console.warn("[kenar-notu] Yedek klasörü seçilemedi:", hata);
      toast(hata?.kod === "baska" ? t("Kitaplık başka bir pencerede açık; klasörü orada seç.") : t("Klasör seçilemedi."));
    }
  } finally {
    if (dugme.isConnected) { dugme.disabled = false; dugme.replaceChildren(...asil); }
  }
}
// İzin düşünce (tarayıcı yeniden açılınca çoğu zaman) dokunuşla izin isteyen sessiz fiş. kayit.js açılıştan
// birkaç saniye sonra sorar. Kapatılan ya da cevaplanan fiş sayfa yenilense de bu oturumda (sekmede) yeniden çıkmaz.
// Başka bir bildirim fişi itip yerini aldıysa kullanıcı onu görmemiş olabilir: sonraki yedek denemesinde yine çıkar.
const IZIN_FISI = "kn-tasarim:klasor-izni-kapandi";
let klasorIzniSoruldu = false;
try { klasorIzniSoruldu = sessionStorage.getItem(IZIN_FISI) === "1"; } catch { /* gizli pencere */ }
bus.on("yedek:klasor", (o) => {
  if (o?.tur === "izin-gerek" && !klasorIzniSoruldu) {
    klasorIzniSoruldu = true;
    toast(t("Yedek klasörüne izin ver"), { etiket: t("İzin ver"), kalici: true, kapatilir: true,
      calistir: () => kayit.yedekKlasoruIzinIste().then((ok) => { if (!ok) toast(t("İzin verilmedi; otomatik yedek bekliyor.")); }),
      kapaninca: (eylemle, elle) => {
        if (!eylemle && !elle) { klasorIzniSoruldu = false; return; }
        try { sessionStorage.setItem(IZIN_FISI, "1"); } catch { /* gizli pencere */ }
      } });
  } else if (o?.tur === "yazildi") ayarla({ sonYedek: o.son });
  else if (o?.tur === "hata") toast(t("Otomatik yedek: {mesaj}", { mesaj: t(o.mesaj || "") }));
  else if (o?.tur === "hatirlat") yedekHatirlat();
});
// Klasöre yazamayan tarayıcıda: son yedekten (ya da son hatırlatmadan) 7 gün geçtiyse "Yedeği kaydet".
// Kitaplıkta yalnız dokunulmamış örnekler varsa hatırlatılmaz.
function yedekHatirlat() {
  const simdi = Date.now(), son = Math.max(Number(store.ayarlar.sonYedek) || 0, Number(store.ayarlar.yedekHatirlatma) || 0);
  if (!store.belgeler.some((b) => !ORNEK_IDLER.has(b.id) || b.degisim)) return;
  if (!son) { ayarla({ yedekHatirlatma: simdi }); return; }
  if (simdi - son < 7 * 864e5) return;
  ayarla({ yedekHatirlatma: simdi });
  toast(t("Son yedeğin üstünden bir hafta geçti."), { etiket: t("Yedeği kaydet"), kalici: true, calistir: () => yedekAlIstegi() });
}

const izSayisi = () => store.belgeler.reduce((t, b) => t + (Array.isArray(b.veri?.izler) ? b.veri.izler.length : 0), 0);
// Kenar çubuğundaki Yedekle ve bırakılan .kenar dosyası buraya gelir
function yedekPenceresi(dosya = null) {
  cekmeceKapat();
  const s = sayilar();
  const dlg = h("dialog", { class: "pencere bilgi yedek-pencere", "aria-labelledby": "yedekBaslik" });
  const al = h("button", { class: "birincil", type: "button" }, t("Yedek al"));
  const yukle = h("button", { class: "metin-dugme", type: "button" }, dosya ? t("Yükle") : t("Yedekten yükle"));
  // Şifreli yedek (10.5 madde 3): anahtar ve iki kez yazılan parola. yedek-isci.js şifreyi bilmiyorsa anahtar görünmez
  const sifre = !dosya && kayit.sifreliYedekVar() ? sifreDenetimi() : null;
  al.addEventListener("click", () => {
    if (!sifre?.acik()) { yedekAlIstegi(al); return; }
    const p = sifre.parola();
    if (p) yedekAlIstegi(al, { parola: p });
  });
  yukle.addEventListener("click", () => { dlg.close(); if (dosya) yedekYukleIstegi(dosya); else yedekSec(); });
  dlg.append(
    icon("yedekle", "bilgi-simge"),
    h("h2", { class: "t-b2", id: "yedekBaslik" }, dosya ? `“${dosya.name}”` : t("Yedekle")),
    h("p", {}, dosya
      ? t("Yedekteki belgeler, kalem izleri, notlar, kartlar ve kırpıntılar bu kitaplıkla birleştirilir. İkisinde de olan belgede son açılan kalır.")
      : t("Her şey tek bir .kenar dosyasına yazılır: belgeler, çizgi romanlar ve dosyaları, kalem izleri ve cep defterleri, derlemeler, notlar, bantlar, kartlar ve kırpıntılar. API anahtarları yedeğe girmez.")),
    // Satır adları Türkçe kalır (İzler satırı adıyla tanınır), görüntülerken çevrilir
    h("dl", { class: "kilavuzlar" }, [["Kitaplar", s.kitaplar], ["Defterler", s.defterler], ...(s.cizgiler ? [["Çizgi romanlar", s.cizgiler]] : []),
      ["Klasörler", KLASORLER.length], ["Kırpıntılar", s.kirpilanlar], ["Kartlar", store.kartlar.length],
      ["İzler", izSayisi()]]
      .map(([ad, deger]) => h("div", { class: "kilavuz-satir" }, h("dt", {}, t(ad)), h("dd", ad === "İzler" ? { "data-iz-sayisi": "" } : {}, String(deger))))),
    depoGostergesi(),
    ...(sifre ? [sifre.el] : []),
    h("div", { class: "fis-hedera", "aria-hidden": "true" }, parca('<svg viewBox="0 0 28 16"><use href="#i-hedera"/></svg>')),
    h("div", { class: "pencere-alt" },
      h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, t("Kapat")),
      dosya ? null : yukle, dosya ? yukle : al));
  if (dosya) yukle.className = "birincil";
  // Belge verileri açılışta kitaplıktan sonra gelir: iz sayısı onlar gelince yeniden yazılır
  kayit.veriBekle().then(() => { const dd = $("[data-iz-sayisi]", dlg); if (dd) dd.textContent = String(izSayisi()); });
  pencereKur(dlg);
  odakla($(".pencere-alt button:last-child", dlg));
}

// "Parolayla şifrele" anahtarı ve iki parola alanı. parola(): eşleşiyorsa parola, değilse uyarı ve null
function sifreDenetimi() {
  let acik = false;
  const p1 = h("input", { class: "girdi", type: "password", autocomplete: "new-password", "aria-label": t("Parola"), placeholder: t("Parola"), enterkeyhint: "next" });
  const p2 = h("input", { class: "girdi", type: "password", autocomplete: "new-password", "aria-label": t("Parola yeniden"), placeholder: t("Parola yeniden"), enterkeyhint: "done" });
  const uyari = h("p", { class: "parola-hata", role: "alert", hidden: true });
  const alanlar = h("div", { class: "sifre-alanlar", hidden: true }, p1, p2, uyari,
    h("p", { class: "ayar-not" }, t("Parola hiçbir yere kaydedilmez; unutursan yedek açılmaz. Klasöre otomatik yedek şifresiz kalır.")));
  const anahtar = anahtarSatiri(t("Parolayla şifrele"), t("AES-256; yedek yalnız parolayla açılır"), () => acik, (v) => {
    acik = v; anahtar.guncelle(); alanlar.hidden = !v; uyari.hidden = true;
    if (v) p1.focus();
  });
  for (const g of [p1, p2]) g.addEventListener("input", () => { uyari.hidden = true; });
  return {
    el: h("div", { class: "sifre-denetim" }, anahtar.el, alanlar),
    acik: () => acik,
    parola: () => {
      const hata = !p1.value ? t("Bir parola yaz.") : p1.value.length < 6 ? t("Parola en az 6 karakter olmalı.") : p1.value !== p2.value ? t("İki parola aynı değil.") : "";
      if (hata) { uyari.textContent = hata; uyari.hidden = false; (p1.value && p1.value.length >= 6 ? p2 : p1).focus(); return null; }
      return p1.value;
    },
  };
}

// Masaüstünde dosya sürükleyip bırakma
function dosyaBirakma() {
  let sayac = 0;
  const dosyaMi = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  K.kok.addEventListener("dragenter", (e) => { if (!dosyaMi(e)) return; e.preventDefault(); sayac++; K.birak.hidden = false; });
  K.kok.addEventListener("dragover", (e) => { if (!dosyaMi(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  K.kok.addEventListener("dragleave", (e) => { if (!dosyaMi(e)) return; if (--sayac <= 0) { sayac = 0; K.birak.hidden = true; } });
  K.kok.addEventListener("drop", (e) => {
    if (!dosyaMi(e)) return;
    e.preventDefault();
    sayac = 0;
    K.birak.hidden = true;
    // Klasör bırakıldıysa (13. tur) içindeki kitaplar listeyle sunulur. Girdi ve tutamaç olay içinde alınır
    // (olaydan sonra DataTransfer boşalır); getAsFileSystemHandle yalnız Chromium'da, webkitGetAsEntry her yerde.
    const ogeler = [...(e.dataTransfer.items || [])].filter((o) => o.kind === "file");
    const girdiler = ogeler.map((o) => { try { return o.webkitGetAsEntry?.() || null; } catch { return null; } });
    if (girdiler.some((g) => g?.isDirectory)) {
      const tutamaclar = ogeler.map((o) => { try { return o.getAsFileSystemHandle?.() ?? null; } catch { return null; } });
      kitapKlasoruModulu().then((m) => m.birakilanlar({ girdiler, tutamaclar: tutamaclar.every(Boolean) ? tutamaclar : [] })).catch(kitapKlasoruHatasi);
      return;
    }
    const dosyalar = [...(e.dataTransfer.files || [])];
    if (!dosyalar.length) return;
    // .kenar yedeği bırakılırsa yedekten yükleme sorulur; tür adından tanınmazsa içeriğinden
    dosyalariAyir(dosyalar).then(({ belgeler, yedek }) => {
      if (yedek) { yedekPenceresi(yedek); return; }
      if (belgeler.length) { dosyalariAl(belgeler); return; }
      bilgiPenceresi({ ikon: "pdf", baslik: `“${dosyalar[0].name}”`, metin: t("Kenar Notu PDF, EPUB ve CBZ (çizgi roman) dosyalarını açar. Not almak için yeni bir defter de açabilirsin.") });
    });
  });
}

/* ---------- Ayarlar denetimleri ---------- */
function parcali(secenekler, etiket, deger, sec) {
  const dugmeler = secenekler.map(([v, ad, ik]) => h("button", { type: "button", "aria-pressed": "false", onclick: () => sec(v) }, ik ? icon(ik) : null, ad));
  // 7.0 (6.5): seçili parçanın altında kayan tek topuz; seçenekler arasında atlamaz, transform ile kayar
  const topuz = h("i", { class: "parcali-topuz", "aria-hidden": "true" });
  const el = h("div", { class: "parcali", role: "group", "aria-label": etiket }, topuz, dugmeler);
  const guncelle = () => { const d = deger(); dugmeler.forEach((b, i) => b.setAttribute("aria-pressed", String(secenekler[i][0] === d))); topuzYerlestir(el, topuz); };
  // Pencere açılıp ölçü belli olunca bir kez daha
  new ResizeObserver(() => topuzYerlestir(el, topuz)).observe(el);
  guncelle();
  return { el, guncelle };
}
function kagitDiskleri() {
  // Oto: Koltuk'ta temayı izler, Masa'da beyaz kalır (ortak.js sayfaCoz). Disk yarı açık yarı koyu.
  const SAYFA = [["oto", t("Oto"), "linear-gradient(90deg, #FDFBF6 50%, #1B1A17 50%)", "#24211E"], ["beyaz", t("Beyaz"), "#FDFBF6", "#24211E"],
    ["sepya", t("Sepya"), "#F5EDDA", "#3B2F22"], ["koyu", t("Koyu"), "#1B1A17", "#D9D0BE"], ["tahta", t("Tahta"), "#1F2622", "#DCD8CB"], ["mum", t("Mum"), "#1E1710", "#E6CFA5"]];
  const dugmeler = SAYFA.map(([v, ad, kd, kdy]) =>
    h("button", { class: "kagit-disk" + (v === "oto" ? " oto" : ""), type: "button", "aria-pressed": "false", style: `--kd:${kd};--kdy:${kdy}`, onclick: () => ayarla({ sayfaRengi: v }) },
      h("i", {}, v === "oto" ? h("span", {}, "Aa") : "Aa"), ad));
  const el = h("div", { class: "kagit-diskler", role: "group", "aria-label": t("Sayfa rengi") }, dugmeler);
  const guncelle = () => dugmeler.forEach((b, i) => b.setAttribute("aria-pressed", String(SAYFA[i][0] === (store.ayarlar.sayfaRengi || "oto"))));
  guncelle();
  return { el, guncelle };
}
// Radyo grubu: oklar seçimi taşır ve uygular, Boşluk ve Enter seçer (düğmenin kendi tıklaması). Gezici tabindex.
function radyoGrubu(el, dugmeler, sec) {
  el.addEventListener("keydown", (e) => {
    const i = dugmeler.indexOf(document.activeElement);
    if (i < 0) return;
    const ileri = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let j = ileri ? (i + ileri + dugmeler.length) % dugmeler.length : e.key === "Home" ? 0 : e.key === "End" ? dugmeler.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    dugmeler[j].focus();
    sec(j);
  });
}
const radyoIsaretle = (dugmeler, seciliIndis) => dugmeler.forEach((b, i) => {
  b.setAttribute("aria-checked", String(i === seciliIndis));
  b.tabIndex = i === Math.max(0, seciliIndis) ? 0 : -1;
});
const kipSimdi = () => (koyuMu() ? "gece" : "gunduz");

// 7.0 Atmosfer ızgarası (TASARIM-5 4.5): her kart o atmosferin canlı önizlemesi (.atmosfer-onizleme kendi tokenlarını alır).
// Kart etkin kipte çizilir; yalnız gece olanlar her zaman gece. Seçim anında uygulanır.
function atmosferIzgarasi() {
  const dugmeler = ATMOSFERLER.map((a) => {
    const onizleme = h("span", { class: "atmosfer-onizleme", "aria-hidden": "true", dataset: { atmosfer: a.id } },
      h("i", { class: "o-izgara" }), h("i", { class: "o-kapsul" }), h("i", { class: "o-kart" }), h("i", { class: "o-disk" }));
    const ad = h("span", {});
    const etiket = a.yalnizGece ? h("small", {}, t("Gece")) : null;
    const b = h("button", { class: "atmosfer-kart", type: "button", role: "radio", "aria-checked": "false", tabindex: "-1",
      onclick: () => ayarla({ atmosfer: a.id }) }, onizleme, h("span", { class: "atmosfer-kart__ad" }, ad, etiket));
    b._kur = () => {
      const kip = a.yalnizGece ? "gece" : kipSimdi();
      onizleme.dataset.kip = kip;
      // Nebula'nın gündüz yüzü Lavanta: kartın adı da ona döner, ekran okuyucu ikisini birden söyler
      const asilAd = t(a.ad);
      const gorunenAd = kip === "gunduz" && a.gunduzAd ? t(a.gunduzAd) : asilAd;
      ad.textContent = gorunenAd;
      b.setAttribute("aria-label", gorunenAd === asilAd ? (a.yalnizGece ? t("{ad}, yalnız gece", { ad: asilAd }) : asilAd) : t("{ad}, gündüz yüzü {gunduz}", { ad: asilAd, gunduz: gorunenAd }));
    };
    return b;
  });
  const el = h("div", { class: "atmosfer-izgara", role: "radiogroup", "aria-label": t("Atmosfer") }, dugmeler);
  radyoGrubu(el, dugmeler, (i) => ayarla({ atmosfer: ATMOSFERLER[i].id }));
  const guncelle = () => {
    for (const b of dugmeler) b._kur();
    const secim = atmosferBul(store.ayarlar.atmosfer) ? store.ayarlar.atmosfer : "aurora";
    radyoIsaretle(dugmeler, ATMOSFERLER.findIndex((a) => a.id === secim));
  };
  guncelle();
  return { el, guncelle };
}

// 7.0 Vurgu rengi (TASARIM-5 4.5): "Atmosferin rengi" ve sekiz hazır numune. Serbest renk yok: AA garanti kalsın.
function vurguDiskleri() {
  const SECENEK = [{ id: null, ad: "Atmosferin rengi" }, ...VURGULAR];
  const dugmeler = SECENEK.map((v) => h("button", { class: "vurgu-disk" + (v.id ? "" : " atmosferin"), type: "button", role: "radio",
    "aria-checked": "false", tabindex: "-1", "aria-label": t(v.ad), title: t(v.ad), onclick: () => ayarla({ vurgu: v.id }) }, h("i", {}, icon("tik"))));
  const el = h("div", { class: "vurgu-diskler", role: "radiogroup", "aria-label": t("Vurgu rengi") }, dugmeler);
  const secili = h("p", { class: "vurgu-secili-ad", "aria-hidden": "true" });
  radyoGrubu(el, dugmeler, (i) => ayarla({ vurgu: SECENEK[i].id }));
  const guncelle = () => {
    const kip = kipSimdi();
    const etkin = atmosferBul(kok.dataset.atmosfer) || ATMOSFERLER[0];
    dugmeler.forEach((b, i) => {
      const [d1, d2] = SECENEK[i].id ? SECENEK[i][kip] : etkin.onizleme[kip].slice(1);
      b.style.setProperty("--d1", d1);
      b.style.setProperty("--d2", d2);
      b.style.setProperty("--d-yazi", kip === "gece" ? "#0B0C11" : "#FFFFFF");
    });
    const v = VURGULAR.find((x) => x.id === store.ayarlar.vurgu);
    radyoIsaretle(dugmeler, v ? SECENEK.indexOf(v) : 0);
    secili.textContent = v ? t(v.ad) : t("Atmosferin rengi ({ad})", { ad: t((atmosferBul(store.ayarlar.atmosfer) || ATMOSFERLER[0]).ad) });
  };
  guncelle();
  return { el: h("div", {}, el, secili), guncelle };
}

// Canlı zemin: sade hareket (ayar ya da sistem) açıkken devre dışı görünür, açıklaması değişir
function canliZeminSatiri() {
  const s = anahtarSatiri(t("Canlı zemin"), t("Zemin ışığı çok yavaş kayar. Pil için kapalı."), () => !!store.ayarlar.canliZemin && !hareketAz(),
    (v) => { if (!hareketAz()) ayarla({ canliZemin: v }); });
  const aciklama = s.el.querySelector("small");
  const ilk = s.guncelle;
  const guncelle = () => {
    ilk();
    const kapali = hareketAz();
    if (kapali) s.el.setAttribute("aria-disabled", "true"); else s.el.removeAttribute("aria-disabled");
    aciklama.textContent = kapali ? t("Sade hareket açıkken kapalı") : t("Zemin ışığı çok yavaş kayar. Pil için kapalı.");
  };
  guncelle();
  return { el: s.el, guncelle };
}

const sekilDuzeltAcik = () => (store.ayarlar.araclar?.sekilDuzelt ?? store.ayarlar.sekilDuzelt) !== false;
// Araçlar kurulmadan seçilen şekil düzeltme, araçlar kurulunca onlara geçer
function sekilDuzeltAktar() {
  const a = store.ayarlar.araclar;
  if (!a || store.ayarlar.sekilDuzelt === undefined) return;
  a.sekilDuzelt = store.ayarlar.sekilDuzelt;
  delete store.ayarlar.sekilDuzelt;
  ayarlariYaz();
}

function anahtarSatiri(ad, aciklama, deger, sec) {
  const el = h("button", { class: "anahtar-satir", type: "button", role: "switch", "aria-checked": "false" },
    h("span", {}, ad, h("small", {}, aciklama)), h("span", { class: "anahtar", "aria-hidden": "true" }));
  el.addEventListener("click", () => sec(!deger()));
  const guncelle = () => el.setAttribute("aria-checked", String(!!deger()));
  guncelle();
  return { el, guncelle };
}

// Basınç eğrisi önizlemesi (240x48): eğri seçilince hafiften serte basılmış örnek iz, üstüne kalemle denenir.
// Kalınlık basincUygula'dan: kalem.js de aynı eğriyi kullanınca önizleme ile kâğıt aynı çıkar.
function basincOnizleme() {
  const W = 240, H = 48, dpr = Math.min(3, devicePixelRatio || 1);
  const c = h("canvas", { class: "spen-onizleme", width: String(W * dpr), height: String(H * dpr), role: "img", "aria-label": t("Basınç eğrisi önizlemesi") });
  const g = c.getContext("2d");
  const renk = () => getComputedStyle(c).color || "#1C1B19";
  const nokta = (x, y, p) => {
    const r = 0.6 + 3.4 * Math.max(0, basincUygula(p));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  const ciz = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // Ölçü çentikleri: basınç ekseni (soldan sağa 0..1)
    g.fillStyle = renk();
    g.globalAlpha = 0.18;
    for (let i = 0; i <= 10; i++) g.fillRect(8 + i * 22.4, H - (i % 5 ? 4 : 7), 1, i % 5 ? 4 : 7);
    g.globalAlpha = 0.9;
    // Örnek iz: soldan sağa artan basınçla tek dalga
    for (let x = 8; x <= W - 8; x += 0.75) {
      const u = (x - 8) / (W - 16);
      nokta(x, H / 2 - 4 + Math.sin(u * Math.PI * 3) * 7, 0.04 + u * 0.96);
    }
    g.globalAlpha = 1;
  };
  let son = null;
  c.addEventListener("pointerdown", (e) => { c.setPointerCapture?.(e.pointerId); son = e; ciz(); });
  c.addEventListener("pointermove", (e) => {
    if (!son || !e.buttons) return;
    const r = c.getBoundingClientRect(), olcek = W / r.width;
    g.fillStyle = renk();
    for (const o of e.getCoalescedEvents?.() || [e]) {
      const p = o.pointerType === "pen" ? o.pressure : 0.5;
      nokta((o.clientX - r.left) * olcek, (o.clientY - r.top) * olcek, p);
    }
  });
  for (const t of ["pointerup", "pointercancel"]) c.addEventListener(t, () => { son = null; });
  requestAnimationFrame(ciz);
  return { el: c, ciz };
}

/* ---------- Ayarlar sayfası (TASARIM-4 1.2) ---------- */
// Geniş ekranda 760 px'lik pencere: solda bölüm listesi, sağda kayan içerik. Telefonda ve iPad dikeyde tam alt çekmece,
// bölümler üstte kayan çip satırı. Bölüm değişince içerik o başlığa kayar.
const kalemBaslik = () => ({ spen: "S Pen", pencil: "Apple Pencil" })[kalemTuru()] || t("Kalem");
// Arayüz dili seçimi (dil.js). Yerel adlar başka adlarla karışmasın diye takma adla alınır
import { dil as arayuzDili, DILLER, dilSec as arayuzDiliSec } from "./dil.js";
let ayarlarAcik = null;
function ayarlarAc({ acan = null, bolum = null } = {}) {
  if (ayarlarAcik) { ayarlarAcik.git(bolum); return; }
  rehberKapat();
  fisKapat(true);
  cekmeceKapat();
  // Dil: her seçenek kendi dilinde yazılır; seçilince sayfa yeniden yüklenir
  const dilD = parcali(DILLER, t("Dil"), () => arayuzDili, (v) => arayuzDiliSec(v));
  dilD.el.querySelectorAll("button").forEach((b, i) => { b.lang = DILLER[i][0]; });
  const tema = parcali([["oto", t("Otomatik"), "tema-oto"], ["acik", t("Açık"), "tema-acik"], ["koyu", t("Koyu"), "tema-koyu"]],
    t("Uygulama teması"), () => store.ayarlar.tema, (v) => ayarla({ tema: v }));
  const atmosferD = atmosferIzgarasi();
  const vurguD = vurguDiskleri();
  const canliD = canliZeminSatiri();
  const sayfa = kagitDiskleri();
  const yazi = parcali([["kucuk", t("Küçük")], ["orta", t("Orta")], ["buyuk", t("Büyük")]], t("Arayüz yazı boyutu"),
    () => store.ayarlar.arayuzYazi || "orta", (v) => ayarla({ arayuzYazi: v }));
  const sade = anahtarSatiri(t("Sade hareket"), t("Dönüş ve uçuş yerine kısa geçişler"), () => store.ayarlar.sadeHareket, (v) => ayarla({ sadeHareket: v }));
  const elYazisi = anahtarSatiri(t("Notlarda el yazısı"), t("Kapalıyken notlar düz yazıyla"), () => store.ayarlar.elYazisi !== false, (v) => ayarla({ elYazisi: v }));
  const parmak = anahtarSatiri(t("Parmakla çiz"), t("Kalem algılanınca kendiliğinden kapanır"), () => store.ayarlar.parmaklaCiz, (v) => ayarla({ parmaklaCiz: v }));
  // Masa'nın ayarı araç ayarlarında (araclar.sekilDuzelt); araçlar ilk belge açılınca kurulur, o zamana kadar bekler
  const sekil = anahtarSatiri(t("Şekil düzeltme"), t("Çizip bir an bekleyince çizgi, daire ve kutu düzelir"), sekilDuzeltAcik,
    (v) => { const a = store.ayarlar.araclar; if (a) { a.sekilDuzelt = v; ayarla({}); } else ayarla({ sekilDuzelt: v }); });
  const yanTus = anahtarSatiri(t("Yan tuş silgi"), t("Yan tuş basılıyken kalem siler"), () => store.ayarlar.yanTusSilgi !== false, (v) => ayarla({ yanTusSilgi: v }));
  const egri = parcali([["yumusak", t("Yumuşak")], ["orta", t("Orta")], ["sert", t("Sert")]], t("Basınç eğrisi"),
    () => store.ayarlar.basincEgrisi || "orta", (v) => ayarla({ basincEgrisi: v }));
  const onizleme = basincOnizleme();
  const kalemD = { el: null, guncelle: () => { yanTus.guncelle(); egri.guncelle(); onizleme.ciz(); } };
  const sonBelge = anahtarSatiri(t("Açılışta son belgeyle başla"), t("Uygulama doğrudan son okuduğun yerde açılır"), () => !!store.ayarlar.sonBelgeyleBasla, (v) => ayarla({ sonBelgeyleBasla: v }));
  const exGoster = anahtarSatiri(t("Ex libris"), t("Kitabın iç kapağında senin mührün"), () => store.ayarlar.exLibrisGoster !== false, (v) => ayarla({ exLibrisGoster: v }));
  const odunc = anahtarSatiri(t("Ödünç kartı"), t("Kitabın sonunda okuduğun günler ve toplam süre"), () => store.ayarlar.oduncKarti !== false, (v) => ayarla({ oduncKarti: v }));
  const mum = anahtarSatiri(t("Mum ışığı önerisi"), t("Saat 22’den sonra bir kez, nazikçe"), () => store.ayarlar.mumOneri !== false, (v) => ayarla({ mumOneri: v }));
  const exDisa = anahtarSatiri(t("Dışa aktarırken ex libris ekle"), t("Notlu PDF’in ilk sayfasında, sağ altta"), () => store.ayarlar.exLibrisDisa !== false, (v) => ayarla({ exLibrisDisa: v }));
  // Yapay zekâ ve Çeviri: alt satırda seçili yol, dokununca ayrı pencere
  const yzAlt = h("small", {}, yzOzet());
  const yzSatir = h("button", { class: "fis-satir yz-satir", type: "button", "aria-haspopup": "dialog", onclick: () => yzPenceresi() },
    icon("sor", "i-20"), h("span", {}, t("Yapay zekâ")), yzAlt);
  const cvAlt = h("small", {}, ceviriOzet());
  const cvSatir = h("button", { class: "fis-satir yz-satir", type: "button", "aria-haspopup": "dialog", onclick: () => ceviriPenceresi() },
    icon("ceviri", "i-20"), h("span", {}, t("Çeviri")), cvAlt);
  const metinler = { el: null, guncelle: () => { yzAlt.textContent = yzOzet(); cvAlt.textContent = ceviriOzet(); } };
  // Yedek ve depolama
  const sonYedek = h("p", { class: "ayar-not" });
  const sonYedekYaz = () => {
    const son = Number(store.ayarlar.sonYedek) || 0;
    sonYedek.textContent = son ? t("Son yedek: {zaman}.", { zaman: neZaman(son) }) : t("Henüz yedek alınmadı.");
  };
  sonYedekYaz();
  const yedekAl = h("button", { class: "ikincil", type: "button" }, icon("yedekle", "i-20"), t("Şimdi yedekle"));
  yedekAl.addEventListener("click", () => yedekAlIstegi(yedekAl));
  const yedekYukle = h("button", { class: "metin-dugme", type: "button", onclick: () => yedekSec() }, t("Yedekten yükle"));
  const otoYedek = otoYedekDenetimi();
  // Kitap klasörü (13. tur): modül tembel yüklenir, durum sonradan yazılır
  const kitapKlasoruD = kayit.klasorDestegi() ? h("div", { class: "oto-yedek kitap-klasoru-ayar" }) : null;
  if (kitapKlasoruD) kitapKlasoruModulu().then((m) => m.ayarDenetimi(kitapKlasoruD)).catch(() => kitapKlasoruD.remove());
  const sifirEtiket = h("span", {}, t("Örnek verilere dön"));
  const sifir = h("button", { class: "fis-satir onayli sifirla", type: "button" }, icon("sil", "i-20"),
    h("span", {}, sifirEtiket, h("small", {}, t("Çizimler, notlar, içe aktarılan dosyalar silinir; API anahtarları kalır"))));
  onayla(sifir, sifirEtiket, t("Emin misin? Tekrar dokun"), () => durumuSifirla());
  const temizEtiket = h("span", {}, t("Her şeyi temizle"));
  const temiz = h("button", { class: "fis-satir onayli sifirla", type: "button" }, icon("sil", "i-20"),
    h("span", {}, temizEtiket, h("small", {}, t("Örnekler dahil her şey ve API anahtarları silinir; boş bir defterle başlar"))));
  onayla(temiz, temizEtiket, t("Emin misin? Tekrar dokun"), () => durumuSifirla({ hepsi: true }));
  const exDuz = exLibrisDuzenleyici();
  const rehberD = h("button", { class: "fis-satir", type: "button", onclick: () => { kapat(); rehberBaslat(); } },
    icon("sor", "i-20"), h("span", {}, t("Rehberi yeniden göster")), h("small", {}, t("Üç kısa ipucu, gerçek ekranın üstünde")));
  const kurulumD = iosMu() && !kuruluMu()
    ? h("button", { class: "fis-satir", type: "button", onclick: () => iosKurulumFisi({ zorla: true }) }, icon("paylas", "i-20"), h("span", {}, t("Ana ekrana ekle")), h("small", {}, t("Tam ekran açılır, verilerin kalıcı olur")))
    : null;

  const kalemIpucu = { spen: t("Kalem havadayken yan tuş Samsung menüsünü açar. Önce ekrana değdir, sonra bas."),
    pencil: t("Silgi kalem tepsisinde. İki parmakla dokunmak geri alır, üç parmakla dokunmak yineler."),
  }[kalemTuru()] || t("İki parmakla dokunmak geri alır, üç parmakla dokunmak yineler.");
  // 7.0 (K9): kısayollar ve yenilikler kendi sheet'lerinde
  const kisayolSatir = h("button", { class: "fis-satir", type: "button", "aria-haspopup": "dialog", onclick: (e) => kisayollarAc(e.currentTarget) },
    icon("klavye", "i-20"), h("span", {}, t("Klavye kısayolları")), h("small", {}, dokunmatikMiYalniz() ? t("Klavye bağlıyken") : t("Her yerde ? tuşu")));
  const yenilikSatir = h("button", { class: "fis-satir", type: "button", "aria-haspopup": "dialog",
    onclick: (e) => { const acan = e.currentTarget; import("./hakkinda.js").then((m) => m.yeniliklerAc({ acan })); } },
    icon("yildizlar", "i-20"), h("span", {}, t("Yenilikler")), h("small", {}, t("Kenar Notu 7.0’da neler var")));

  const BOLUMLER = [
    // Ayarlar bölüm adı: "Görünüm" anahtarı başka yerde görünüm seçicisi (View), burada Appearance
    ["gorunum", ingilizceMi ? "Appearance" : "Görünüm", [h("span", { class: "t-etiket" }, t("Dil")), dilD.el,
      h("span", { class: "t-etiket" }, t("Uygulama teması")), tema.el,
      h("span", { class: "t-etiket" }, t("Atmosfer")), atmosferD.el, h("span", { class: "t-etiket" }, t("Vurgu rengi")), vurguD.el, canliD.el,
      h("span", { class: "t-etiket" }, t("Sayfa rengi")), sayfa.el,
      h("span", { class: "t-etiket" }, t("Arayüz yazı boyutu")), yazi.el, sade.el, elYazisi.el]],
    ["kalem", kalemBaslik(), [parmak.el, sekil.el,
      h("div", { class: "spen-kart" },
        samsungMu() ? yanTus.el : null,
        h("div", { class: "spen-egri" }, h("span", { class: "spen-egri__ad" }, t("Basınç eğrisi"), h("small", {}, kalemTuru() === "fare" || kalemTuru() === "parmak" ? t("Kalemin varsa önizlemeye yaz") : t("Önizlemeye kalemle yaz"))), egri.el, onizleme.el),
        h("p", { class: "spen-ipucu" }, kalemIpucu))]],
    ["okuma", t("Okuma"), [sonBelge.el, h("span", { class: "t-etiket" }, t("Küçük sürprizler")), exGoster.el, odunc.el, mum.el]],
    ["ceviri", t("Çeviri ve yapay zekâ"), [cvSatir, yzSatir]],
    ...(kitapKlasoruD ? [["klasor", t("Kitap klasörü"), [kitapKlasoruD]]] : []),
    ["yedek", t("Yedek ve depolama"), [depoUyarisi(), h("div", { class: "ayar-yedek" }, depoGostergesi(), sonYedek,
      h("div", { class: "ayar-yedek__dugmeler" }, yedekAl, yedekYukle)), otoYedek.el, kurulumD, h("div", { class: "fis-ayrac" }), sifir, temiz]],
    ["exlibris", t("Ex libris"), [exDuz.el, exDisa.el]],
    ["yardim", t("Yardım"), [rehberD,
      h("button", { class: "fis-satir", type: "button", "aria-haspopup": "dialog", onclick: (e) => { const acan = e.currentTarget; import("./hakkinda.js").then((m) => m.hakkindaAc({ acan })); } },
        icon("kitap", "i-20"), h("span", {}, t("Hakkında")), h("small", {}, t("Sürüm, gizlilik, açık kaynak lisansları"))),
      yenilikSatir, kisayolSatir,
      h("div", { class: "ayarlar-alt" }, markaOgesi(), h("span", { class: "ayarlar-alt__not" }, t("Çevrimdışı çalışır. Verilerin bu cihazda kalır.")))]],
  ];
  ayarDenetimleri = [tema, atmosferD, vurguD, canliD, sayfa, yazi, sade, parmak, elYazisi, sekil, kalemD, sonBelge, exGoster, odunc, mum, exDisa, metinler, exDuz, { guncelle: sonYedekYaz }];
  const bolumler = BOLUMLER.map(([id, ad, ogeler]) => h("section", { class: "ayar-bolum", id: "ayar-" + id, "aria-labelledby": "ayar-b-" + id },
    h("h3", { class: "ayar-bolum__baslik", id: "ayar-b-" + id }, ad), ...ogeler.filter(Boolean)));
  const navDugmeler = BOLUMLER.map(([id, ad]) => h("button", { class: "cip", type: "button", dataset: { bolum: id }, "aria-pressed": "false" }, ad));
  const nav = h("nav", { class: "ayarlar-nav", "aria-label": t("Ayarlar bölümleri") }, navDugmeler);
  const icerik = h("div", { class: "ayarlar-icerik" }, bolumler);

  let kaydirici, kapat, kok;
  const bitir = () => { ayarDenetimleri = []; ayarlarAcik = null; for (const d of [K.ayarlarDugme, K.basAyarlar]) d?.setAttribute("aria-expanded", "false"); };
  if (cekmeceMi()) {
    const c = altCekmece({ baslik: t("Ayarlar"), govde: [nav, icerik], duraklar: ["tam"], ilk: "tam", sinif: "ayarlar-sayfa", acan, kapaninca: bitir });
    kaydirici = c.govde; kapat = () => c.kapat(); kok = c.kok;
  } else {
    const dlg = h("dialog", { class: "pencere ayarlar-sayfa", "aria-labelledby": "ayarlarBaslik" },
      h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "ayarlarBaslik", tabindex: "-1" }, t("Ayarlar")),
        h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
      h("div", { class: "ayarlar-govde" }, nav, icerik));
    dlg.addEventListener("close", bitir);
    pencereKur(dlg);
    odakla($("#ayarlarBaslik", dlg));
    kaydirici = icerik; kapat = () => dlg.close(); kok = dlg;
  }
  acan?.setAttribute("aria-expanded", "true");
  // Bölüm seçimi ve kaydırınca seçili çip
  const secili = (id) => navDugmeler.forEach((d) => d.setAttribute("aria-pressed", String(d.dataset.bolum === id)));
  let kendiKaydirma = 0;
  const git = (id) => {
    const hedef = id && $("#ayar-" + id, icerik);
    if (!hedef) return;
    secili(id);
    kendiKaydirma = Date.now();
    const ust = hedef.getBoundingClientRect().top - kaydirici.getBoundingClientRect().top + kaydirici.scrollTop - (cekmeceMi() ? nav.offsetHeight + 8 : 0);
    kaydirici.scrollTo({ top: Math.max(0, ust), behavior: hareketAz() ? "auto" : "smooth" });
    const d = navDugmeler.find((x) => x.dataset.bolum === id);
    if (nav.scrollWidth > nav.clientWidth) d?.scrollIntoView({ inline: "nearest", block: "nearest" });
  };
  for (const d of navDugmeler) d.addEventListener("click", () => git(d.dataset.bolum));
  kaydirici.addEventListener("scroll", () => {
    if (Date.now() - kendiKaydirma < 700) return;
    const ust = kaydirici.getBoundingClientRect().top + (cekmeceMi() ? nav.offsetHeight + 24 : 24);
    let id = BOLUMLER[0][0];
    for (const b of bolumler) if (b.getBoundingClientRect().top <= ust) id = b.id.slice(5);
    if (kaydirici.scrollTop + kaydirici.clientHeight >= kaydirici.scrollHeight - 4) id = BOLUMLER[BOLUMLER.length - 1][0];
    secili(id);
  }, { passive: true });
  secili(BOLUMLER[0][0]);
  ayarlarAcik = { git, kapat, kok };
  if (bolum) requestAnimationFrame(() => git(bolum));
}
// Fare ve klavyesi olmayan cihazda kısayol listesi gösterilmez
const dokunmatikMiYalniz = () => matchMedia("(hover: none) and (pointer: coarse)").matches;

/* ---------- Sheet: geniş ekranda pencere, telefonda alt çekmece (TASARIM-5 6.11) ---------- */
// govde: öğe ya da dizi. Dönen { kapat }. sinif hem pencereye hem çekmeceye verilir
function sheetAc({ baslik, govde, sinif = "", acan = document.activeElement, kapaninca, duraklar = ["yarim", "tam"], ilk = "tam" }) {
  if (cekmeceMi()) {
    const c = altCekmece({ baslik, govde, duraklar, ilk, sinif, acan, kapaninca });
    return { kapat: () => c.kapat(), kok: c.kok };
  }
  const id = "sheet-" + Math.random().toString(36).slice(2, 8);
  const dlg = h("dialog", { class: `pencere sheet ${sinif}`.trim(), "aria-labelledby": id },
    h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id, tabindex: "-1" }, baslik),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "sheet-govde" }, govde));
  dlg.addEventListener("close", () => { kapaninca?.(); if (acan?.isConnected) acan.focus?.({ preventScroll: true }); });
  pencereKur(dlg);
  odakla($("#" + id, dlg));
  return { kapat: () => dlg.close(), kok: dlg };
}

/* ---------- Klavye kısayolları (K9) ---------- */
// kisayollar() kaydını alana göre gruplar; tuşlar Plex Mono kapsül. Mac'te Ctrl yerine ⌘
const ALAN_ADLARI = { genel: t("Genel"), koltuk: t("Koltuk"), masa: t("Masa"), tekrar: t("Tekrar"), izler: t("İzlerim"), arama: t("Arama") };
const macMi = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function tusKapsulleri(tus) {
  const parcalar = String(tus).split(/\s+(?=\S)/).filter(Boolean);
  return h("span", { class: "tuslar" }, parcalar.map((p) => h("kbd", { class: "tus" }, macMi() && p === "Ctrl" ? "⌘" : p)));
}
let kisayolAcik = null;
function kisayollarAc(acan = document.activeElement) {
  if (kisayolAcik) return;
  fisKapat(true);
  const gruplar = new Map();
  for (const k of kisayollar()) gruplar.set(k.alan, [...(gruplar.get(k.alan) || []), k]);
  const sira = [...Object.keys(ALAN_ADLARI), ...[...gruplar.keys()].filter((a) => !ALAN_ADLARI[a])].filter((a) => gruplar.has(a));
  const govde = h("div", { class: "kisayol-sayfa" },
    dokunmatikMiYalniz() ? h("p", { class: "ayar-not" }, t("Klavye bağlıyken çalışır: kılıf klavyesi ya da Bluetooth klavye.")) : null,
    sira.map((a) => h("section", { class: "kisayol-grup", "aria-labelledby": "ks-" + a },
      h("h3", { class: "t-etiket", id: "ks-" + a }, ALAN_ADLARI[a] || a),
      // Kısayol adları kaydeden modülden gelir; çevrilmediyse burada çevrilir
      h("dl", { class: "kisayol-liste" }, gruplar.get(a).map((k) => h("div", { class: "kisayol-satir" }, h("dt", {}, tusKapsulleri(k.tus)), h("dd", {}, t(k.ad))))))));
  kisayolAcik = sheetAc({ baslik: t("Klavye kısayolları"), govde, sinif: "kisayol-sheet", acan, kapaninca: () => { kisayolAcik = null; } });
}

/* ---------- Parola sorusu (şifreli yedek, 10.5) ---------- */
// Dönen söz: parola ya da vazgeçilince null. hata: önceki deneme yanlışsa gösterilen satır
function parolaSor({ baslik = t("Yedeğin parolası"), metin = t("Bu yedek parolayla şifreli. Parolayı yaz."), hata = "", dugme = t("Aç") } = {}) {
  return new Promise((coz) => {
    const girdi = h("input", { class: "girdi", type: "password", autocomplete: "current-password", "aria-label": t("Parola"), enterkeyhint: "go", required: true });
    const goz = h("button", { class: "ikon-dugme parola-goz", type: "button", "aria-label": t("Parolayı göster"), "aria-pressed": "false" }, icon("goz", "i-20"));
    goz.addEventListener("click", () => { const ac = girdi.type === "password"; girdi.type = ac ? "text" : "password"; goz.setAttribute("aria-pressed", String(ac)); girdi.focus(); });
    let sonuc = null;
    const dlg = h("dialog", { class: "pencere bilgi parola-pencere", "aria-labelledby": "parolaBaslik" });
    const form = h("form", { class: "parola-form", method: "dialog" },
      icon("kilit", "bilgi-simge"),
      h("h2", { class: "t-b2", id: "parolaBaslik" }, baslik),
      h("p", {}, metin),
      h("label", { class: "parola-alan" }, girdi, goz),
      hata ? h("p", { class: "parola-hata", role: "alert" }, hata) : null,
      h("div", { class: "pencere-alt" },
        h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, t("Vazgeç")),
        h("button", { class: "birincil", type: "submit" }, dugme)));
    form.addEventListener("submit", (e) => { e.preventDefault(); if (!girdi.value) return; sonuc = girdi.value; dlg.close(); });
    dlg.append(form);
    dlg.addEventListener("close", () => coz(sonuc));
    pencereKur(dlg);
    girdi.focus();
  });
}

// Safari 7 gün kuralı (OZELLIKLER-7 §3): kurulu değilse ve tarayıcı kalıcılık vermediyse kısa uyarı
function depoUyarisi() {
  if (!safariMi() || kuruluMu()) return null;
  const el = h("div", { class: "ayar-uyari", role: "note" }, icon("kilit", "i-20"),
    h("p", {}, `${t("Safari, ana ekrana eklenmemiş sitelerin verisini 7 gün açılmayınca silebilir.")} `,
      iosMu() ? t("Ana ekrana ekle ya da düzenli yedek al.") : t("Düzenli yedek al.")));
  navigator.storage?.persisted?.().then((k) => { if (k) el.remove(); }).catch(() => {});
  return el;
}
// İlk belge eklenince bir kez: Safari'de kalıcılık yoksa yedek önerisi
async function depoUyarisiBirKez() {
  if (!safariMi() || kuruluMu() || depo.oku(ANAHTAR.depoUyari)) return;
  try { if (await navigator.storage?.persisted?.()) return; } catch { /* bilinmiyor: uyar */ }
  depo.yaz(ANAHTAR.depoUyari, Date.now());
  setTimeout(() => toast(t("Safari bu verileri 7 gün açılmayınca silebilir. Ana ekrana ekle ya da yedek al."), { etiket: t("Yedekle"), calistir: () => yedekPenceresi() }), 4500);
}

// iOS'ta kurulum fişi (OZELLIKLER-7 §3): Safari sekmesinde bir kez, sessiz; kapatılınca bir daha çıkmaz
function iosKurulumFisi({ zorla = false, deneme = 0 } = {}) {
  if (!iosMu() || kuruluMu() || $(".kurulum-fis")) return;
  // Altta bir bildirim varsa üst üste binmesin: biraz sonra bir kez daha denenir
  if (!zorla && document.getElementById("bildirimler")?.children.length) { if (deneme < 2) setTimeout(() => iosKurulumFisi({ deneme: deneme + 1 }), 6000); return; }
  if (!zorla && (depo.oku(ANAHTAR.iosKurulum) || $(".karsilama"))) return;
  // Okurken çıkmaz (cetvelin ve kalem tepsisinin üstüne biner); işaret yazılmaz, sonraki açılışta yeniden denenir
  if (!zorla && !["kitaplik", "izler", "tekrar", "arama"].includes(document.documentElement.dataset.ekran)) return;
  if (!zorla && $("dialog[open], .alt-cekmece")) return;   // açık pencere ya da çekmecenin üstüne binmesin
  depo.yaz(ANAHTAR.iosKurulum, Date.now());
  const kapatD = h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat") }, icon("kapat", "i-20"));
  const el = h("div", { class: "kurulum-fis", role: "note", "aria-label": t("Ana ekrana ekle") },
    h("span", { class: "kurulum-fis__simge", "aria-hidden": "true" }, icon("paylas")),
    h("p", {}, h("b", {}, t("Ana ekrana ekle")),
      h("span", {}, ipadMi() ? t("Üstteki Paylaş simgesine, sonra Ana Ekrana Ekle’ye dokun.") : t("Alttaki Paylaş simgesine, sonra Ana Ekrana Ekle’ye dokun."),
        ` ${t("Tam ekran açılır, verilerin kalıcı olur.")}`)),
    kapatD);
  let zaman = 0;
  const kapat = () => { clearTimeout(zaman); if (hareketAz()) el.remove(); else { el.classList.add("gidiyor"); setTimeout(() => el.remove(), 200); } };
  kapatD.addEventListener("click", kapat);
  document.body.append(el);
  zaman = setTimeout(kapat, zorla ? 20000 : 14000);
}

/* ---------- Ex libris çizimi (TASARIM-4 4.1) ---------- */
// 280'lik kâğıt kare, ortada 220'lik kesik kılavuz dairesi. Kalem, parmak ya da fareyle; basınç vuruşun kalınlığına girer.
function exLibrisDuzenleyici() {
  const W = 280, dpr = Math.min(3, devicePixelRatio || 1);
  const kayitli = store.ayarlar.exLibris;
  const taslak = {
    vuruslar: exLibrisVar(kayitli) ? kayitli.vuruslar.map((v) => v.map((q) => [...q])) : [],
    cerceve: kayitli?.cerceve || "daire", renk: kayitli?.renk || EXLIBRIS_RENKLERI[0][1], yazi: kayitli?.yazi || "",
  };
  const c = h("canvas", { class: "exlibris-tuval", width: String(W * dpr), height: String(W * dpr), role: "img", "aria-label": t("Ex libris çizim alanı. Kalemle ya da parmakla imzanı ya da monogramını çiz.") });
  const g = c.getContext("2d");
  const onizleme = h("div", { class: "exlibris-onizleme", "aria-label": t("Mühür önizlemesi"), role: "img" });
  const ciz = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    g.save();
    g.setLineDash([3, 5]);
    g.strokeStyle = getComputedStyle(c).getPropertyValue("--line-strong") || "#1C1B1929";
    g.lineWidth = 1;
    g.beginPath(); g.arc(W / 2, W / 2, 110, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.strokeStyle = taslak.renk; g.lineCap = "round"; g.lineJoin = "round";
    for (const v of taslak.vuruslar) for (let i = 0; i < v.length; i++) {
      const a = v[Math.max(0, i - 1)], b = v[i];
      g.lineWidth = 3 + 5 * (Number.isFinite(b[2]) ? b[2] : 0.5);
      g.beginPath(); g.moveTo(a[0] * W, a[1] * W); g.lineTo(b[0] * W + (i ? 0 : 0.1), b[1] * W); g.stroke();
    }
  };
  const onizle = () => { onizleme.innerHTML = exLibrisSvg(96, taslak, { aci: -4 }) || `<span class="exlibris-bos">${t("Mühür burada görünür")}</span>`; };
  let vurus = null;
  c.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch { /* yapay olay */ }
    vurus = [];
    taslak.vuruslar.push(vurus);
    ekle(e);
  });
  const ekle = (e) => {
    const r = c.getBoundingClientRect();
    const birlesik = e.getCoalescedEvents?.();
    for (const o of birlesik?.length ? birlesik : [e]) {
      const x = (o.clientX - r.left) / r.width, y = (o.clientY - r.top) / r.height;
      const son = vurus[vurus.length - 1];
      if (son && Math.hypot((x - son[0]) * W, (y - son[1]) * W) < 1.5) continue;
      const p = o.pointerType === "pen" && o.pressure > 0 ? o.pressure : 0.5;
      vurus.push([Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000, Math.round(Math.min(1, Math.max(0, y)) * 1000) / 1000, Math.round(p * 100) / 100]);
    }
    ciz();
  };
  c.addEventListener("pointermove", (e) => { if (vurus && e.buttons) ekle(e); });
  const bitir = () => { if (!vurus) return; if (!vurus.length) taslak.vuruslar.pop(); vurus = null; onizle(); durum(); };
  c.addEventListener("pointerup", bitir);
  c.addEventListener("pointercancel", bitir);
  const cerceve = parcali([["daire", t("Daire")], ["oval", t("Oval")], ["yok", t("Yok")]], t("Çerçeve"), () => taslak.cerceve, (v) => { taslak.cerceve = v; cerceve.guncelle(); onizle(); });
  const renkler = h("div", { class: "exlibris-renkler", role: "group", "aria-label": t("Mürekkep") }, EXLIBRIS_RENKLERI.map(([ad, hex]) => {
    const d = h("button", { class: "renk-secim", type: "button", "aria-label": t(ad), title: t(ad), "aria-pressed": String(taslak.renk === hex), style: `--renk:${hex}` });
    d.addEventListener("click", () => { taslak.renk = hex; for (const x of renkler.children) x.setAttribute("aria-pressed", String(x === d)); ciz(); onizle(); });
    return d;
  }));
  const yaziGirdi = h("input", { class: "exlibris-yazi", type: "text", maxlength: "18", placeholder: t("EX LİBRİS · CAN"), "aria-label": t("Mühürdeki yazı (isteğe bağlı)"), autocomplete: "off", enterkeyhint: "done" });
  yaziGirdi.value = taslak.yazi;
  yaziGirdi.addEventListener("input", () => { taslak.yazi = yaziGirdi.value.slice(0, 18); onizle(); durum(); });
  const geriD = h("button", { class: "metin-dugme", type: "button" }, t("Geri al"));
  geriD.addEventListener("click", () => { taslak.vuruslar.pop(); ciz(); onizle(); durum(); });
  const temizleD = h("button", { class: "metin-dugme", type: "button" }, t("Temizle"));
  temizleD.addEventListener("click", () => {
    const eski = taslak.vuruslar.slice();
    taslak.vuruslar.length = 0; ciz(); onizle(); durum();
    if (eski.length) toast(t("Çizim temizlendi"), { etiket: t("Geri al"), calistir: () => { taslak.vuruslar.push(...eski); ciz(); onizle(); durum(); } });
  });
  const kaydetD = h("button", { class: "birincil", type: "button" }, t("Kaydet"));
  kaydetD.addEventListener("click", () => {
    const eski = store.ayarlar.exLibris || null;
    const ex = { vuruslar: taslak.vuruslar.map((v) => v.map((q) => [...q])), cerceve: taslak.cerceve, renk: taslak.renk, yazi: taslak.yazi.trim(), surum: (Number(eski?.surum) || 0) + 1 };
    ayarla({ exLibris: exLibrisVar(ex) ? ex : null });
    bus.emit("exlibris", store.ayarlar.exLibris);
    toast(exLibrisVar(ex) ? t("Ex libris kaydedildi. Kitapların iç kapağında görünür.") : t("Ex libris kaldırıldı"),
      eski ? { etiket: t("Geri al"), calistir: () => { ayarla({ exLibris: eski }); bus.emit("exlibris", eski); } } : undefined);
    durum();
  });
  const durum = () => {
    geriD.disabled = !taslak.vuruslar.length;
    temizleD.disabled = !taslak.vuruslar.length;
  };
  const el = h("div", { class: "exlibris" },
    h("p", { class: "ayar-not" }, t("Kendi kitap mührünü çiz: imza, monogram ya da küçük bir resim. Her kitabın iç kapağında küçük bir mühür olarak durur.")),
    h("div", { class: "exlibris-alan" }, h("div", { class: "exlibris-kagit" }, c), onizleme),
    h("span", { class: "t-etiket" }, t("Çerçeve")), cerceve.el,
    h("span", { class: "t-etiket" }, t("Mürekkep")), renkler,
    h("span", { class: "t-etiket" }, t("Yazı")), yaziGirdi,
    h("div", { class: "exlibris-alt" }, geriD, temizleD, h("span", { class: "bosluk" }), kaydetD));
  requestAnimationFrame(() => { ciz(); onizle(); durum(); });
  return { el, guncelle: () => {} };
}

/* ---------- Ayarlar: Yapay zekâ (TASARIM-2 3.4, OZELLIKLER-2 1.4) ---------- */
const MONOGRAM = { chatgpt: "Ch", gemini: "Ge", claude: "Cl" };

function yzOzet() {
  const yz = store.ayarlar.yz;
  if (yz.yol === "anahtar") {
    const s = YZ_SAGLAYICILAR.find((x) => x.id === yz.saglayici) || YZ_SAGLAYICILAR[0];
    return s.id === "deneme" ? t("Deneme, çevrimdışı") : t("{ad}, kendi anahtarınla", { ad: s.ad });
  }
  const u = YZ_UYGULAMALAR.find((x) => x.id === yz.uygulama) || YZ_UYGULAMALAR[0];
  return t("{ad} ile, hesabınla", { ad: u.ad });
}

// asistan.js'in baglantiDene() sonucunu cam şeritteki yazıya çevirir.
// Beklenen: { ok: true, ms } ya da { ok: false, durum: 401 | 403 | 404 | 429 | "ag" | "anahtar-yok", mesaj }; atılan hata da olur.
function denemeSonucu(s, ms) {
  if (s === true || (s && !(s instanceof Error) && (s.ok === true || s.tamam === true))) {
    return { tamam: true, metin: t("BAĞLI · {ms} ms", { ms: Math.round(s?.ms ?? ms) }) };
  }
  const kod = s?.durum ?? s?.status ?? s?.kod ?? s?.code ?? (s instanceof TypeError ? "ag" : null);
  const n = Number(kod);
  if (n === 401 || n === 403) return { metin: t("{n} · ANAHTAR", { n }) };
  if (n === 404) return { metin: "404 · MODEL" };
  if (n === 429) return { metin: t("429 · SINIR") };
  if (kod === "ag" || kod === "network" || n === 0) return { metin: t("AĞ YOK") };
  if (kod === "anahtar-yok" || kod === "anahtar") return { metin: t("ANAHTAR YOK") };
  if (kod === "hazir-degil") return { metin: t("HAZIR DEĞİL") };
  if (typeof s?.mesaj === "string" && s.mesaj) return { metin: s.mesaj.toLocaleUpperCase(yerel) };
  return { metin: Number.isFinite(n) && n ? t("{n} · HATA", { n }) : t("HATA") };
}

function yzPenceresi() {
  cekmeceKapat();
  const yz = store.ayarlar.yz;
  yz.denemeler ||= {};
  const kaydet = () => ayarla({ yz });
  const saglayici = () => YZ_SAGLAYICILAR.find((s) => s.id === yz.saglayici) || YZ_SAGLAYICILAR[0];

  // 1. yol: Hesabımla sor
  const hesapRadyo = h("input", { type: "radio", name: "yz-yol", value: "hesap" });
  const karolar = YZ_UYGULAMALAR.map((u) => h("button", { class: "element", type: "button", role: "radio", "aria-label": u.ad, "aria-checked": "false", tabindex: "-1", dataset: { id: u.id } },
    h("b", { "aria-hidden": "true" }, MONOGRAM[u.id] || u.ad.slice(0, 2)), h("small", { "aria-hidden": "true" }, u.ad)));
  const uygulamaSec = h("div", { class: "uygulama-sec", role: "radiogroup", "aria-label": t("Uygulama") }, karolar);
  const uygulamaSecildi = (id, odak = false) => {
    yz.uygulama = id;
    yz.yol = "hesap";   // uygulama seçmek bu yolu seçmektir
    kaydet();
    guncelle();
    if (odak) karolar.find((k) => k.dataset.id === id)?.focus();
  };
  karolar.forEach((k, i) => {
    k.addEventListener("click", () => uygulamaSecildi(k.dataset.id));
    k.addEventListener("keydown", (e) => {
      const yon = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!yon) return;
      e.preventDefault();
      uygulamaSecildi(karolar[(i + yon + karolar.length) % karolar.length].dataset.id, true);
    });
  });
  const hesapKart = h("label", { class: "yol-kart" },
    hesapRadyo,
    h("span", {}, h("b", {}, t("Hesabımla sor")), h("span", { class: "etiket-serit" }, t("Önerilen"))),
    h("p", {}, t("Telefonda o uygulamaya giriş yaptıysan yeter, anahtar gerekmez. Cevap o uygulamada gelir.")),
    uygulamaSec);

  // 2. yol: Kendi anahtarımla (gelişmiş)
  const anahtarRadyo = h("input", { type: "radio", name: "yz-yol", value: "anahtar" });
  const anahtarKart = h("label", { class: "yol-kart ic" },
    anahtarRadyo, h("b", {}, t("Anahtarla sor")),
    h("p", {}, t("Cevap uygulamanın içinde akar. Anahtarı sağlayıcının sitesinden alırsın.")));
  for (const r of [hesapRadyo, anahtarRadyo]) r.addEventListener("change", () => { if (r.checked) { yz.yol = r.value; kaydet(); guncelle(); } });

  const satirlar = YZ_SAGLAYICILAR.map((s) => {
    const r = h("input", { type: "radio", name: "yz-saglayici", value: s.id });
    const lamba = h("span", { class: "lamba", "aria-hidden": "true" });
    const model = h("span", { class: "t-deger-k" });
    r.addEventListener("change", () => { if (!r.checked) return; yz.saglayici = s.id; kaydet(); sonucTemizle(); guncelle(); });
    return { s, r, lamba, model, el: h("label", { class: "saglayici" }, r, lamba, h("b", {}, t(s.ad)), model) };
  });

  // Anahtar alanı: gizli yazılır, "Göster" ile açılır
  const anahtarGirdi = h("input", { type: "password", autocomplete: "off", spellcheck: "false", autocapitalize: "off", "aria-label": t("API anahtarı"), placeholder: t("Anahtarı buraya yapıştır") });
  const gosterYazi = h("span", {}, t("Göster"));
  const gosterSimge = icon("goz");
  const gosterDugme = h("button", { class: "metin-dugme", type: "button", "aria-pressed": "false" }, gosterSimge, gosterYazi);
  gosterDugme.addEventListener("click", () => {
    const acikMi = anahtarGirdi.type === "password";
    anahtarGirdi.type = acikMi ? "text" : "password";
    gosterYazi.textContent = acikMi ? t("Gizle") : t("Göster");
    gosterSimge.firstChild.setAttribute("href", acikMi ? "#i-goz-kapali" : "#i-goz");
    gosterDugme.setAttribute("aria-pressed", String(acikMi));
  });
  anahtarGirdi.addEventListener("input", () => { yz.anahtarlar[yz.saglayici] = anahtarGirdi.value.trim(); delete yz.denemeler[yz.saglayici]; sonucTemizle(); lambalar(); });
  // Anahtar girilince yol kendiliğinden "anahtar" olur (OZELLIKLER-2 5.1.7)
  anahtarGirdi.addEventListener("change", () => { if (anahtarGirdi.value.trim()) yz.yol = "anahtar"; kaydet(); guncelle(); });
  const anahtarAlan = h("label", { class: "yz-alan" }, h("span", {}, t("API anahtarı")), h("div", { class: "anahtar-alan" }, anahtarGirdi, gosterDugme));

  // Model adı: düzenlenebilir, "Varsayılan" YZ_SAGLAYICILAR değerine döner
  const modelGirdi = h("input", { type: "text", autocomplete: "off", spellcheck: "false", autocapitalize: "off", "aria-label": t("Model adı") });
  const varsayilanYazi = h("p", { class: "t-kucuk" });
  const varsayilanDugme = h("button", { class: "metin-dugme", type: "button" }, t("Varsayılan"));
  varsayilanDugme.addEventListener("click", () => { modelGirdi.value = saglayici().varsayilanModel; modelGirdi.dispatchEvent(new Event("input")); kaydet(); });
  modelGirdi.addEventListener("input", () => {
    yz.modeller[yz.saglayici] = modelGirdi.value.trim() || saglayici().varsayilanModel;
    delete yz.denemeler[yz.saglayici];
    sonucTemizle();
    lambalar();
  });
  modelGirdi.addEventListener("change", kaydet);
  const modelAlan = h("label", { class: "yz-alan" }, h("span", {}, "Model"), h("div", { class: "anahtar-alan" }, modelGirdi, varsayilanDugme), varsayilanYazi);
  const denemeNotu = h("p", { class: "t-kucuk yz-alan" }, t("Hazır cevaplarla dener, internet gerekmez."));

  // Bağlantıyı dene: sonuç cam şeritte yazıyla
  const deneDugme = h("button", { class: "metin-dugme", type: "button" }, t("Bağlantıyı dene"));
  const camLamba = h("span", { class: "lamba", "aria-hidden": "true" });
  const camIz = izOlustur();
  const camYazi = h("span");
  const cam = h("span", { class: "cam", role: "status", "aria-live": "polite" }, camLamba, camIz, camYazi);
  function sonucTemizle() {
    cam.className = "cam soluk";
    camLamba.removeAttribute("data-durum");
    camIz.dataset.durum = "bekliyor";
    camIz.hidden = false;
    camYazi.textContent = "";
    camYazi.hidden = true;
  }
  deneDugme.addEventListener("click", async () => {
    const id = yz.saglayici;
    deneDugme.disabled = true;
    cam.className = "cam";
    camLamba.dataset.durum = "deniyor";
    camIz.hidden = false;
    camIz.dataset.durum = "dusunuyor";
    camYazi.hidden = true;
    const t0 = performance.now();
    let sonuc;
    try {
      const m = await import("./asistan.js");
      if (typeof m.baglantiDene !== "function") throw { kod: "hazir-degil" };
      sonuc = await m.baglantiDene(id);
    } catch (hata) { sonuc = hata; }
    const r = denemeSonucu(sonuc, performance.now() - t0);
    if (!dlg.isConnected) return;
    deneDugme.disabled = false;
    camIz.dataset.durum = "bitti";
    camIz.hidden = true;
    camYazi.hidden = false;
    if (id === "deneme" && r.tamam) {
      cam.className = "cam kehribar";
      camLamba.dataset.durum = "deneme";
      camYazi.textContent = t("DENEME · HAZIR");
    } else {
      cam.className = r.tamam ? "cam" : "cam kehribar";
      camLamba.dataset.durum = r.tamam ? "bagli" : "hata";
      camYazi.textContent = r.metin;
    }
    yz.denemeler[id] = { tamam: !!r.tamam, zaman: Date.now() };
    kaydet();
    lambalar();
  });

  const gelismis = h("details", { class: "yz-gelismis" },
    h("summary", {}, icon("anahtar"), t("Kendi anahtarımla (gelişmiş)"), icon("asagi")),
    anahtarKart,
    h("div", { class: "saglayicilar", role: "radiogroup", "aria-label": t("Sağlayıcı") }, satirlar.map((x) => x.el)),
    denemeNotu, anahtarAlan, modelAlan,
    h("div", { class: "baglanti-dene" }, deneDugme, cam),
    h("p", { class: "yz-uyari" }, icon("kilit"), h("span", {}, t("Anahtar yalnız bu cihazda saklanır. İstek doğrudan sağlayıcıya gider."))));
  if (yz.yol === "anahtar") gelismis.open = true;

  const dlg = h("dialog", { class: "pencere yz-pencere", "aria-labelledby": "yzBaslik" },
    h("div", { class: "yz-ust" },
      h("h2", { class: "t-b1", id: "yzBaslik" }, t("Yapay zekâ")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    hesapKart, gelismis);

  // Sağlayıcı satırı lambası: seçili ve bağlı, seçili denenmemiş, Deneme ya da boş halka
  function lambalar() {
    for (const { s, r, lamba, model } of satirlar) {
      r.checked = s.id === yz.saglayici;
      model.textContent = s.id === "deneme" ? t("deneme") : yz.modeller[s.id] || s.varsayilanModel;
      if (!r.checked) { lamba.removeAttribute("data-durum"); continue; }
      lamba.dataset.durum = s.id === "deneme" ? "deneme" : yz.denemeler[s.id]?.tamam ? "bagli" : "denenmedi";
    }
  }
  function guncelle() {
    hesapRadyo.checked = yz.yol === "hesap";
    anahtarRadyo.checked = yz.yol === "anahtar";
    karolar.forEach((k) => {
      const secili = k.dataset.id === yz.uygulama;
      k.setAttribute("aria-checked", String(secili));
      k.tabIndex = secili ? 0 : -1;
    });
    const s = saglayici();
    const deneme = s.id === "deneme";
    denemeNotu.hidden = !deneme;
    anahtarAlan.hidden = deneme;
    modelAlan.hidden = deneme;
    if (document.activeElement !== anahtarGirdi) anahtarGirdi.value = yz.anahtarlar[s.id] || "";
    if (document.activeElement !== modelGirdi) modelGirdi.value = yz.modeller[s.id] || s.varsayilanModel;
    varsayilanYazi.textContent = t("Varsayılan: {model}", { model: s.varsayilanModel });
    lambalar();
  }
  sonucTemizle();
  guncelle();
  pencereKur(dlg);
  (yz.yol === "anahtar" ? anahtarRadyo : hesapRadyo).focus();
}

/* ---------- Çeviri: ayarlar ve kitabın dili (OZELLIKLER-6 §2, §5) ---------- */
// ceviri.js ilk kullanımda yüklenir (Çeviri penceresi, kitabın dili); açılışta değil
let ceviriSoz = null;
const ceviriModulu = () => (ceviriSoz ||= import("./ceviri.js").catch((e) => { ceviriSoz = null; throw e; }));
const CEVIRI_MOTORLARI = [["otomatik", t("Otomatik")], ["cihaz", t("Cihazda")], ["paket", t("Paket")], ["anahtar", t("Anahtarla")], ["hesap", t("Hesabımla")]];
// Hedef dil seçenekleri ve "Kitabın dili" listesi (kısa kod); adları tarayıcı Türkçe verir
const HEDEF_DILLER = ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "uk", "ar", "fa", "el", "bg", "cs", "da", "fi", "hu", "ro", "sv", "ja", "ko", "zh-Hans", "hi"];
const KITAP_DILLERI = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "ru", "ar", "ja", "zh-Hans"];
let dilAdlari = null;
function dilAdi(kod) {
  if (!kod) return "";
  let ad = kod;
  // Dil adları arayüz dilinde (Türkçede "tr", İngilizcede "en")
  try { ad = (dilAdlari ||= new Intl.DisplayNames([ingilizceMi ? "en" : "tr"], { type: "language" })).of(kod) || kod; } catch { /* eski tarayıcı: kod */ }
  return ad.charAt(0).toLocaleUpperCase(ingilizceMi ? "en" : "tr") + ad.slice(1);
}
const anaDil = (k) => String(k || "").toLowerCase().split("-")[0];
function ceviriAyari() {
  const c = (store.ayarlar.ceviri ||= {});
  c.hedef ||= "tr";
  c.motor ||= "otomatik";
  return c;
}
const anahtarVar = () => YZ_SAGLAYICILAR.some((s) => s.id !== "deneme" && String(store.ayarlar.yz?.anahtarlar?.[s.id] || "").trim());
function ceviriOzet() {
  const c = ceviriAyari();
  // Etiket çevrilmiş olabilir: otomatik mi, kimlikten anlaşılır
  const m = CEVIRI_MOTORLARI.find(([id]) => id === c.motor);
  return `${dilAdi(c.hedef)}, ${!m || m[0] === "otomatik" ? t("motor otomatik") : m[1].toLocaleLowerCase(yerel)}`;
}
const paketAdi = (p) => `${dilAdi(p.kaynak)} → ${dilAdi(p.hedef)}`;
function ceviriHataMetni(e) {
  return t({ ag: "Bağlantı yok; internet gelince yeniden dene.", sunucu: "Paket sunucusu şu an cevap vermiyor; biraz sonra yeniden dene.", yer: "Cihazda yer yetmiyor.", bozuk: "İnen dosya doğrulanamadı; yeniden dene.",
    "paket-yok": "Bu dil çifti için paket bulunamadı.", "motor-yok": "Bu Chrome bu dili cihazda çeviremiyor.",
    hareket: "İndirme için düğmeye yeniden dokun." }[e?.tur] || "İndirilemedi.");
}

// İndirmeler pencere kapansa da sürer; iptal denetçileri burada durur
const paketInisleri = new Map();   // "en-tr" -> AbortController
let cihazInisi = null;             // { kaynak, hedef, oran }

function ceviriPenceresi() {
  cekmeceKapat();
  const ayar = ceviriAyari();
  const kaydet = (d) => { Object.assign(ayar, d); ayarla({ ceviri: ayar }); };
  let M = null;   // ceviri.js; "İndir" tıklaması kullanıcı hareketi düşmeden çağırabilsin diye önceden yüklenir
  const ornekKaynak = () => (anaDil(ayar.hedef) === "en" ? "tr" : "en");

  // Hedef dil
  const hedefSec = h("select", { "aria-label": t("Hedef dil") });
  const secenekleriKur = () => {
    const liste = HEDEF_DILLER.includes(ayar.hedef) ? HEDEF_DILLER : [ayar.hedef, ...HEDEF_DILLER];
    const [ilk, ...diger] = liste;
    hedefSec.replaceChildren(...[ilk, ...diger.sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : dilAdi(a).localeCompare(dilAdi(b), yerel)))]
      .map((k) => h("option", { value: k }, dilAdi(k))));
    hedefSec.value = ayar.hedef;
  };
  secenekleriKur();
  hedefSec.addEventListener("change", () => { kaydet({ hedef: hedefSec.value }); tazele(true); });
  const hedefAlan = h("label", { class: "cv-secim" }, hedefSec, icon("asagi"));

  // Motor tercihi
  const motor = parcali(CEVIRI_MOTORLARI, t("Motor"), () => ayar.motor || "otomatik", (v) => { kaydet({ motor: v }); motor.guncelle(); tazele(); });
  const anahtarDugme = motor.el.children[3];
  const motorNotu = h("p", { class: "cv-not", role: "status" }, " ");

  // Cihaz motoru (Chrome Translator API)
  const cihazDurum = h("span", {}, t("Bakılıyor"));
  const cihazIlerleme = h("i", { class: "cv-ilerleme", hidden: true }, h("b"));
  const cihazDugme = h("button", { class: "metin-dugme cv-dugme", type: "button", hidden: true });
  cihazDugme.addEventListener("click", () => {
    if (!M) return;
    const k = ornekKaynak(), hd = ayar.hedef;
    cihazInisi = { kaynak: k, hedef: hd, oran: 0 };
    // create tıklamanın içinde çağrılır: Chrome indirmeyi kullanıcı hareketiyle başlatır
    M.cihazIndir(k, hd, { ilerleme: (o) => { if (cihazInisi) cihazInisi.oran = o; } })
      .then(() => toast(t("{dil} cihazda hazır", { dil: dilAdi(k) })), (e) => { if (e?.name !== "AbortError") toast(ceviriHataMetni(e)); })
      .finally(() => { cihazInisi = null; if (dlg.isConnected) tazele(); });
    tazele();
  });
  // Tarayıcının yerleşik çevirisi yalnız Chrome'da (Translator API); Safari ve Firefox'ta kart hiç görünmez
  const cihazVar = "Translator" in self;
  const cihazKart = h("div", { class: "cv-kart", hidden: !cihazVar }, icon("ceviri", "cv-kart__ikon"),
    h("div", { class: "cv-kart__govde" }, h("b", {}, t("Chrome’un yerleşik çevirisi")), cihazDurum, cihazIlerleme), cihazDugme);

  // Paketler
  const toplamYer = h("span", { class: "cv-toplam" });
  const paketListe = h("div", { class: "cv-paketler", role: "list" });
  const digerSayi = h("span", { class: "cv-sayi" });
  const digerListe = h("div", { class: "cv-paketler", role: "list" });
  const diger = h("details", { class: "yz-gelismis cv-diger" }, h("summary", {}, t("Diğer dil çiftleri"), digerSayi, icon("asagi")), digerListe);
  const satirlar = new Map();   // "en-tr" -> { el, ilerleme, yuzde }
  let sonPaketler = [];

  const paketSatiri = (p) => {
    const id = `${p.kaynak}-${p.hedef}`;
    const yuzde = h("span", { class: "cv-yuzde" });
    const ilerleme = h("i", { class: "cv-ilerleme" }, h("b"));
    const bilgi = p.durum === "yuklu" ? t("Yüklü · {boyut}", { boyut: boyutMetni(p.boyut) }) : t("{boyut} indirilir", { boyut: boyutMetni(p.indirme || p.boyut) });
    let eylem;
    if (p.durum === "yuklu") {
      // Paket yeniden indirilebilir: onay sorulmaz (TASARIM-4 3.6)
      eylem = h("button", { class: "metin-dugme cv-dugme cv-sil", type: "button",
        onclick: () => M?.paketSil(p.kaynak, p.hedef).then(() => toast(t("{paket} paketi silindi. Yeniden indirilebilir.", { paket: paketAdi(p) }))).catch(() => toast(t("Silinemedi."))) }, t("Sil"));
    } else if (p.durum === "iniyor") {
      const dc = paketInisleri.get(id);
      eylem = h("button", { class: "metin-dugme cv-dugme", type: "button", hidden: !dc, onclick: () => paketInisleri.get(id)?.abort() }, t("İptal"));
    } else {
      eylem = h("button", { class: "metin-dugme cv-dugme", type: "button", disabled: !navigator.onLine,
        title: navigator.onLine ? null : t("İnternet gelince indirilir"), onclick: () => paketYukle(p) }, icon("indir"), ingilizceMi ? "Install" : "Yükle");   // "Yükle" başka yerde "Load" olabilir
    }
    const el = h("div", { class: "cv-paket", role: "listitem", dataset: { durum: p.durum } },
      h("span", { class: "cv-paket__ad" }, h("b", {}, paketAdi(p)), h("small", {}, bilgi)),
      p.durum === "iniyor" ? h("span", { class: "cv-paket__inis" }, ilerleme, yuzde) : null, eylem);
    satirlar.set(id, { el, ilerleme, yuzde });
    if (p.durum === "iniyor") ilerlemeYaz(id, p.ilerleme || 0);
    return el;
  };
  const ilerlemeYaz = (id, oran) => {
    const s = satirlar.get(id);
    if (!s) return;
    s.ilerleme.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, oran))})`;
    s.yuzde.textContent = t("%{n}", { n: Math.floor(oran * 100) });
  };
  const paketYukle = (p) => {
    if (!M) return;
    const id = `${p.kaynak}-${p.hedef}`;
    if (paketInisleri.has(id)) return;
    const dc = new AbortController();
    paketInisleri.set(id, dc);
    M.paketIndir(p.kaynak, p.hedef, { signal: dc.signal })
      .then(() => toast(t("{paket} paketi yüklendi; artık internetsiz çevrilir", { paket: paketAdi(p) })),
        (e) => { if (e?.name !== "AbortError") toast(ceviriHataMetni(e)); })
      .finally(() => { if (paketInisleri.get(id) === dc) paketInisleri.delete(id); if (dlg.isConnected) paketleriCiz(); });
    paketleriCiz();
  };
  const onde = (p) => p.durum !== "indirilebilir" || (anaDil(p.kaynak) === "en" && anaDil(p.hedef) === anaDil(ayar.hedef))
    || (anaDil(p.kaynak) === anaDil(ayar.hedef) && anaDil(p.hedef) === "en");
  // Üst üste gelen istekler birleşir: çizim sürerken gelen istek bitince bir kez daha çizer
  let cizim = null, yeniden = false;
  function paketleriCiz(bekleme = 0) {
    if (cizim) { yeniden = true; return cizim; }
    cizim = paketleriCizAsil(bekleme).finally(() => { cizim = null; if (yeniden) { yeniden = false; paketleriCiz(); } });
    return cizim;
  }
  async function paketleriCizAsil(bekleme) {
    if (!M) return;
    let liste;
    try { liste = await M.paketler({ bekleme }); } catch { liste = sonPaketler; }
    if (!dlg.isConnected) return;
    sonPaketler = liste;
    satirlar.clear();
    const ust = liste.filter(onde), alt = liste.filter((p) => !onde(p));
    paketListe.replaceChildren(...ust.map(paketSatiri));
    if (!ust.length) paketListe.append(h("p", { class: "cv-not" }, t("Bu dile çeviren paket yok; Cihazda ya da Hesabımla çevrilir.")));
    digerSayi.textContent = alt.length ? String(alt.length) : "";
    diger.hidden = !alt.length;
    // Uzun liste yalnız açılınca çizilir
    if (diger.open) digerListe.replaceChildren(...alt.map(paketSatiri));
    else digerListe.replaceChildren();
    yerYaz();
  }
  diger.addEventListener("toggle", () => { if (diger.open) paketleriCiz(); });

  // Önbellek
  const onbellekYazi = h("small", {}, t("Çevrilen paragraflar burada saklanır; gerekince yeniden çevrilir."));
  const onbellekEtiket = h("span", {}, t("Çeviri önbelleğini temizle"));
  const onbellekDugme = h("button", { class: "fis-satir onayli cv-onbellek", type: "button" }, icon("sil", "i-20"), h("span", {}, onbellekEtiket, onbellekYazi));
  onbellekDugme.addEventListener("click", () => {
    M?.ceviriOnbellekTemizle().then(() => { toast(t("Çeviri önbelleği temizlendi. Gerekince yeniden çevrilir.")); yerYaz(); }).catch(() => toast(t("Temizlenemedi.")));
  });
  async function yerYaz() {
    if (!M) return;
    const y = await M.ceviriYeri().catch(() => null);
    if (!y || !dlg.isConnected) return;
    toplamYer.textContent = y.paket ? t("Toplam {boyut}", { boyut: boyutMetni(y.paket) }) : "";
    onbellekYazi.textContent = y.onbellek ? t("Çevrilen paragraflar, {boyut}. Gerekince yeniden çevrilir.", { boyut: boyutMetni(y.onbellek) }) : t("Önbellek boş.");
  }

  // Motor durumu: örnek yön (İngilizceden hedefe) için hangi motorun çalışacağı
  async function durumYaz() {
    if (!M) return;
    const k = ornekKaynak(), hd = ayar.hedef;
    let d;
    try { d = await M.ceviriDurumu({ kaynak: k, hedef: hd }); } catch { return; }
    if (!dlg.isConnected) return;
    const m = (id) => d.motorlar.find((x) => x.id === id);
    const yon = `${dilAdi(k)} → ${dilAdi(hd)}`;
    const s = m(d.secilen);
    const tercih = ayar.motor || "otomatik";
    let not = !s ? t("{yon}: hazır motor yok. Aşağıdan paketi yükle.", { yon })
      : s.cevrimdisi ? t("{yon}: {motor}, internetsiz.", { yon, motor: s.ad }) : t("{yon}: {motor}, metin internete gider.", { yon, motor: s.ad });
    if (tercih !== "otomatik" && d.secilen !== tercih) not += " " + t("Seçtiğin motor hazır değil, sıradaki kullanılıyor.");
    motorNotu.textContent = not;
    // Cihaz kartı
    const c = m("cihaz")?.durum || "yok";
    const iniyor = cihazInisi && cihazInisi.hedef === hd;
    cihazIlerleme.hidden = !(c === "iniyor" || iniyor);
    if (!cihazIlerleme.hidden) cihazIlerleme.firstChild.style.transform = `scaleX(${cihazInisi?.oran || 0})`;
    cihazDugme.hidden = c !== "indirilebilir" || iniyor;
    cihazDugme.textContent = t("{dil} paketini indir", { dil: dilAdi(k) });
    cihazKart.dataset.durum = c;
    cihazDurum.textContent = c === "hazir" ? t("Bu cihazda var. {yon} hazır, internetsiz.", { yon })
      : c === "indirilebilir" ? t("Bu cihazda var. {dil} paketi Chrome’dan bir kez iner.", { dil: dilAdi(k) })
      : c === "iniyor" || iniyor ? t("Chrome paketi indiriyor.")
      : t("Bu Chrome’da yok. Çeviri paketleri aynı işi internetsiz görür.");
    anahtarDugme.disabled = !anahtarVar() && tercih !== "anahtar";
    anahtarDugme.title = anahtarVar() ? "" : t("Asistanda kayıtlı API anahtarı yok");
  }
  function tazele(hepsi = false) {
    durumYaz();
    if (hepsi) paketleriCiz();
  }

  const dlg = h("dialog", { class: "pencere yz-pencere ceviri-pencere", "aria-labelledby": "cvBaslik" },
    h("div", { class: "yz-ust" },
      h("h2", { class: "t-b1", id: "cvBaslik" }, t("Çeviri")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "cv-ikili" },
      h("div", {}, h("span", { class: "t-etiket" }, t("Hedef dil")), hedefAlan),
      h("div", {}, h("span", { class: "t-etiket" }, t("Motor")), motor.el)),
    motorNotu,
    cihazVar ? h("span", { class: "t-etiket" }, t("Cihazda")) : null, cihazKart,
    h("div", { class: "cv-baslik" }, h("span", { class: "t-etiket" }, t("Çeviri paketleri")), toplamYer),
    paketListe, diger,
    h("p", { class: "yz-uyari" }, icon("kilit"), h("span", {}, t("Paketler Mozilla’nın açık çeviri modelleridir. Bir kez iner, sonra internetsiz çalışır; metin cihazdan çıkmaz."))),
    h("div", { class: "fis-ayrac" }),
    onbellekDugme);

  // İlerleme olayları: satır yerinde güncellenir; bitince ya da silinince liste yeniden çizilir
  let durumZaman = 0;
  const dinle = bus.on("ceviri", (o) => {
    if (!o || !dlg.isConnected) return;
    if (o.tur === "paket") {
      const id = `${o.kaynak}-${o.hedef}`;
      if (o.durum === "iniyor" && satirlar.get(id)?.el.dataset.durum === "iniyor") ilerlemeYaz(id, o.ilerleme || 0);
      else { paketleriCiz(); clearTimeout(durumZaman); durumZaman = setTimeout(durumYaz, 120); }
    } else if (o.tur === "cihaz") {
      if (o.durum === "iniyor") { if (cihazInisi) cihazInisi.oran = o.ilerleme || 0; cihazIlerleme.hidden = false; cihazIlerleme.firstChild.style.transform = `scaleX(${o.ilerleme || 0})`; }
      else durumYaz();
    } else if (o.tur === "onbellek") yerYaz();
  });
  const agDegisti = () => { tazele(true); };
  addEventListener("online", agDegisti);
  addEventListener("offline", agDegisti);
  dlg.addEventListener("close", () => { dinle(); removeEventListener("online", agDegisti); removeEventListener("offline", agDegisti); });

  pencereKur(dlg);
  hedefSec.focus();
  ceviriModulu().then((m) => {
    M = m;
    if (!dlg.isConnected) return;
    tazele(true);
    // Uzak katalog (101 çift) ilk kez geliyorsa biraz sonra liste tamamlanır
    setTimeout(() => { if (dlg.isConnected) paketleriCiz(6000); }, 400);
  }, () => { motorNotu.textContent = t("Çeviri yüklenemedi."); });
}

// Kitabın dili: belge.dil (kısa kod; null: bakıldı, bulunamadı), belge.dilElle (kullanıcı seçti)
const dilDestekli = (b) => b.tur !== "cizgi" && !b.cizgi;
function dilOzet(b) {
  if (b.dilElle && b.dil) return dilAdi(b.dil);
  if (b.dil) return t("{dil}, otomatik", { dil: dilAdi(b.dil) });
  return b.dil === null ? t("Otomatik, bulunamadı") : t("Otomatik");
}
// İlk sayfaların metninden (EPUB'da paket bilgisinden) dil bulunur. Örnek belgeler Türkçedir.
async function dilBelirle(b) {
  if (!dilDestekli(b)) return null;
  if (b.tur === "defter") {
    await kayit.veriBekle([b.id]);
    let metin = "";
    for (const v of (b.veri?.sayfalar || []).slice(0, 8)) {
      for (const m of v.metinler || []) if (m.metin && m.tur !== "damga" && m.tur !== "asistan") metin += m.metin + "\n";
      for (const n of v.notlar || []) if (n.metin) metin += n.metin + "\n";
    }
    if (metin.trim().length < 40) return null;
    return (await ceviriModulu()).dilBul(metin);
  }
  if (!b.dosya) return "tr";
  const blob = await kayit.dosyaGetir(b.id);
  if (!blob) return null;
  if (b.tur === "epub") return kayit.epubDili(blob);
  if (b.tur !== "pdf") return null;
  const { pdfAc, parolaAl } = await import("./pdf-belge.js");
  const pdf = await pdfAc(blob, { parola: parolaAl(b.id) });   // parolası bu oturumda girilmediyse hata: dil bilinmez kalır
  try {
    let metin = "";
    for (let i = 0; i < Math.min(3, pdf.sayfaSayisi) && metin.length < 2500; i++) {
      metin += (await pdf.metinKutulari(i)).map((k) => k.str).join(" ") + "\n";
    }
    return metin.trim().length < 40 ? null : (await ceviriModulu()).dilBul(metin);
  } finally { pdf.kapat(); }
}
const dilBakilan = new Map();   // belgeId -> Promise
function dilBak(b) {
  if (!dilBakilan.has(b.id)) {
    const soz = dilBelirle(b).catch(() => null).then((dil) => {
      if (!b.dilElle && !b.dil && belgeBul(b.id)) {
        b.dil = dil || null;
        bus.emit("belgeler", { tur: "dil", id: b.id });
      }
      return b.dil;
    }).finally(() => dilBakilan.delete(b.id));
    dilBakilan.set(b.id, soz);
  }
  return dilBakilan.get(b.id);
}
function dilAyarla(b, kod) {
  if (kod === "oto") {
    if (!b.dilElle) return;
    delete b.dilElle;
    b.dil = undefined;
    bus.emit("belgeler", { tur: "dil", id: b.id });
    dilBak(b).then((dil) => toast(dil ? t("Kitabın dili: {dil}", { dil: dilAdi(dil) }) : t("Dil bulunamadı; elle seçebilirsin")));
    return;
  }
  b.dil = kod;
  b.dilElle = true;
  bus.emit("belgeler", { tur: "dil", id: b.id });
}
// Önceki turlarda içe aktarılan EPUB'ların dili açılıştan sonra boşta, birer birer okunur (yalnız paket bilgisi)
function eskiDilleriTamamla() {
  const sira = store.belgeler.filter((b) => b.tur === "epub" && b.dosya && b.dil === undefined && !b.dilElle).slice(0, 12);
  const sonraki = () => {
    const b = sira.shift();
    if (!b) return;
    if (acik.ekran === "belge") { sira.unshift(b); setTimeout(sonraki, 10000); return; }   // okurken beklenir
    const calis = () => (belgeBul(b.id) && b.dil === undefined ? dilBak(b) : Promise.resolve()).finally(() => setTimeout(sonraki, 400));
    if (typeof requestIdleCallback === "function") requestIdleCallback(calis, { timeout: 4000 }); else calis();
  };
  sonraki();
}

/* ---------- Çekmece (dikey ve dar ekran) ---------- */
let perdeZaman = 0;
function cekmeceAc() {
  clearTimeout(perdeZaman);
  K.perde.classList.remove("gidiyor");
  K.perde.hidden = false;
  K.kenar.inert = false;
  K.kenar.classList.add("acik");
  K.menuDugme.setAttribute("aria-expanded", "true");
  ($('a[aria-current="page"]', K.kenar) || $("a", K.kenar))?.focus({ preventScroll: true });
}
function cekmeceKapat() {
  if (!K.kenar?.classList.contains("acik")) return;
  K.kenar.classList.remove("acik");
  K.menuDugme.setAttribute("aria-expanded", "false");
  const odak = K.kenar.contains(document.activeElement);
  if (darMedya.matches) K.kenar.inert = true;
  if (odak) K.menuDugme.focus({ preventScroll: true });
  if (hareketAz()) { K.perde.hidden = true; return; }
  K.perde.classList.add("gidiyor");
  perdeZaman = setTimeout(() => { K.perde.hidden = true; K.perde.classList.remove("gidiyor"); }, 240);
}
function cekmeceDurumu() {
  if (!darMedya.matches) {
    K.kenar.classList.remove("acik");
    K.perde.hidden = true;
    K.kenar.inert = false;
  } else {
    K.kenar.inert = !K.kenar.classList.contains("acik");
  }
}

/* ================= Yönlendirme ve kitabı açmak (6.3) ================= */
// Kitaplık her zaman DOM'da durur (gizlenir); belge ekranı üstüne ayrı bir <section> olarak gelir.
// Tarayıcı geçmişi kullanılır: Android'de geri hareketi belgeden kitaplığa döner.
let sonKaynak = null;     // açılışın başlayacağı kapak öğesi
let acikPencere = null;   // açılışta kapanacak pencere (Yeni defter)
// ekran: "belge" | "tekrar" | "arama"; mod: açık belgenin modu ("koltuk" | "masa")
// Ekran, mod ya da belge değişince sekmeler ve ortak.acikEkran bir mikro görevde güncellenir
const acik = new Proxy({ modul: null, kap: null, belgeId: null, ekran: null, mod: null }, {
  set(o, k, v) { o[k] = v; if (k === "ekran" || k === "mod" || k === "belgeId") ekranBildirPlanla(); return true; },
});
let sonAramaTerim = "";   // arama ekranından belgeye gidip geri dönünce arama aynı terimle açılır
let bekleyenGorunum = null;
let sira = Promise.resolve();
const siraya = (fn) => (sira = sira.then(fn).catch((hata) => console.error("[kenar-notu]", hata)));

function belgeAcIstegi(b, kaynakEl) {
  sonKaynak = kaynakEl || null;
  bus.emit("git", { ekran: "belge", belgeId: b.id });
}

function konumuOku() {
  if (location.hash === "#tekrar") return { ekran: "tekrar" };
  if (location.hash === "#arama") return { ekran: "arama" };
  if (location.hash === "#izler") return { ekran: "izler" };
  const m = location.hash.match(/^#belge\/(.+)$/);
  if (m) return { ekran: "belge", belgeId: decodeURIComponent(m[1]) };
  const g = location.hash.match(/^#kitaplik\/(.+)$/);
  return { ekran: "kitaplik", gorunum: g ? decodeURIComponent(g[1]) : null };
}

// Geçmişte kitaplığın üstüne kaç adım itildi: arama -> belge iki adımdır (geri hareketi önce aramaya döner)
const gecmisAdim = () => history.state?.adim ?? (history.state?.itildi ? 1 : 0);
function gecmisYaz(gecmis, durum, url) {
  if (gecmis === "it") history.pushState({ ...durum, itildi: true, adim: gecmisAdim() + 1 }, "", url);
  else if (gecmis === "degistir") history.replaceState({ ...durum, itildi: !!history.state?.itildi, adim: gecmisAdim() }, "", url);
}

// Geçmiş kararı sıra gelince verilir: önceki geçiş (ör. geri hareketi) bitmeden açık ekran bilinmez
bus.on("git", (hedef) => {
  if (!hedef) return;
  // Açık alt çekmece önce kapanır ve geçmiş adımı geri alınır
  if (cekmeceAcik()) siraya(() => cekmeceleriKapat());
  // Seçim kipi başka ekrana geçerken kapanır; geçmiş adımı yerinde kalır (geri hareketi yine kitaplığa döner)
  if (secim.acik) secimKipi(false, { gecmisle: false });
  if (hedef.ekran === "belge") {
    const kaynak = sonKaynak;
    sonKaynak = null;
    const { sayfa, mod, ara, konum, izId } = hedef;
    // Aramadan ve İzlerim'den belgeye: geçmişe itilir, geri hareketi listeye döner
    const listeden = acik.ekran === "arama" || acik.ekran === "izler";
    siraya(async () => {
      await belgeyeGit(hedef.belgeId, { sayfa, mod, ara, konum, iz: izId, kaynak, gecmis: acik.kap && !listeden ? "degistir" : "it" });
      // İz listesinden gelindiyse hedef iz bir an parlar: ekranı açan modül "iz:goster"i dinler
      if (izId && acik.belgeId === hedef.belgeId) setTimeout(() => bus.emit("iz:goster", { belgeId: hedef.belgeId, izId }), 120);
    });
  } else if (hedef.ekran === "izler") {
    siraya(() => izlerAc({ gecmis: acik.kap ? "degistir" : "it" }));
  } else if (hedef.ekran === "tekrar") {
    siraya(() => tekrarAc({ gecmis: acik.kap ? "degistir" : "it", sinav: hedef.sinav, kartId: hedef.kartId }));
  } else if (hedef.ekran === "arama") {
    siraya(() => aramaAc({ gecmis: acik.kap ? "degistir" : "it", terim: hedef.terim }));
  } else if (hedef.ekran === "kitaplik") {
    if (hedef.gorunum) bekleyenGorunum = hedef.gorunum;
    // Ekranı biz açtıysak geri git: geçmiş yığını temiz kalır, popstate kitaplığı getirir
    siraya(() => {
      const adim = gecmisAdim();
      if (acik.kap && adim > 0) history.go(-adim);
      else return kitapligaDon({ gecmis: "degistir" });
    });
  }
});

addEventListener("popstate", () => {
  // Alt çekmece kendi geçmiş adımını geri alırken ekran değişmez
  if (gecmisYut()) return;
  if (history.state?.cekmece) return;
  // Seçim kipi (K6): kendi geçmiş adımı. Bitti ile kapanınca adım geri alınır; geri hareketi kipi kapatır
  if (secimGeriYut) { secimGeriYut = false; return; }
  if (secim.acik && !history.state?.secimKipi) { secim.gecmis = false; secimKipi(false); return; }
  const k = konumuOku();
  siraya(async () => {
    if (k.ekran === "belge") return belgeyeGit(k.belgeId, { gecmis: null });
    if (k.ekran === "tekrar") return tekrarAc({ gecmis: null });
    if (k.ekran === "arama") return aramaAc({ gecmis: null, terim: sonAramaTerim });
    if (k.ekran === "izler") return izlerAc({ gecmis: null });
    await kitapligaDon();
    // Elle yazılan #kitaplik/... adresi görünümü seçer
    if (k.gorunum && (GORUNUMLER.some((g) => g.id === k.gorunum) || klasorBul(k.gorunum.slice(7)))) gorunumSec(k.gorunum);
  });
});

// ek: { ara, konum } (OZELLIKLER-4): ekran modülüne beşinci değişkenle gider
async function belgeyeGit(id, { sayfa, mod, ara, konum, iz, kaynak = null, gecmis = "it" } = {}) {
  // Açılışta belge verileri sonradan gelir: bu belgeninki sırasını beklemeden okunur (kayit.js veriBekle).
  // PDF ve defterde defterler de beklenir (yükleme sırasında öndeler): düzenleyici yan yana açtığı defterin verisine bakar.
  const defterler = belgeBul(id)?.tur === "epub" ? [] : store.belgeler.filter((b) => !b.dosya).map((b) => b.id);
  await Promise.all([kayit.veriBekle(id), kayit.veriBekle(defterler)]);
  // iz: İzler listesinden gelen iz kimliği; modül o ize gider ve izi bir an parlatır
  const ek = { ara: ara || undefined, konum: konum || undefined, iz: iz || undefined };
  const belge = belgeBul(id);
  if (!belge) {
    acikPencere?.close();
    toast(t("Bu belge kitaplıkta yok."));
    return kitapligaDon({ gecmis: "degistir", animasyon: false });
  }
  // İstekle gelen mod belgeye yazılır; yoksa kayıtlı mod, o da yoksa türün varsayılanı
  if ((mod === "koltuk" || mod === "masa") && belge.mod !== mod) {
    belge.mod = mod;
    sessiz = true;
    try { bus.emit("belgeler", { tur: "mod", id }); } finally { sessiz = false; }
    kitaplikKirli = true;
  }
  const hedefMod = varsayilanMod(belge);
  if (acik.ekran === "belge" && acik.belgeId === id && acik.kap) {
    const gidilecek = sayfa != null || ek.ara || ek.konum || ek.iz;
    if (acik.mod === hedefMod && !gidilecek) return;
    // Aynı belge, aynı mod: modül yerinde gider (git dışa aktarılmışsa); yoksa yeniden açılır
    if (acik.mod === hedefMod && typeof acik.modul.git === "function") {
      try { await acik.modul.git({ sayfa, ...ek }); return; }
      catch (hata) { console.warn("[kenar-notu] git():", hata); }
    }
    return yerindeAc(belge, hedefMod, sayfa, ek);
  }
  fisKapat(true);
  cekmeceKapat();

  let modul;
  // Çizgi roman (CBZ ya da "Çizgi roman olarak oku" denmiş PDF) kendi okuyucusunda açılır
  const cizgi = cizgiMi(belge);
  try {
    modul = await import(cizgi ? "./cizgi.js" : belge.tur === "epub" ? "./okuma.js" : "./duzenleyici.js");
    if (typeof modul.ac !== "function") throw new Error("ac() dışa aktarılmamış");
  } catch (hata) {
    console.warn("[kenar-notu] Ekran modülü yüklenemedi:", hata);
    acikPencere?.close();
    modulHatasi(hata, cizgi ? t("Çizgi roman okuyucu henüz hazır değil.") : belge.tur === "epub" ? t("Okuma görünümü henüz hazır değil.") : t("Düzenleyici henüz hazır değil."));
    if (K.ekran.hidden) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }

  if (acik.kap) belgeyiKapat();
  gecmisYaz(gecmis, { ekran: "belge", belgeId: id }, `#belge/${encodeURIComponent(id)}`);

  belge.acilis = Date.now();
  // Açılma sayısı: sık açılan kitabın cildi kitaplıkta hafifçe aşınır (TASARIM-3 nüans 8)
  belge.acilma = (Number(belge.acilma) || 0) + 1;
  kitaplikKirli = true;
  const kap = h("section", { class: "ekran ekran-belge" + (cizgi ? " ekran-cizgi" : ""), "aria-label": belge.ad, dataset: { mod: hedefMod } });
  Object.assign(acik, { modul, kap, belgeId: id, ekran: "belge", mod: hedefMod });
  document.title = `${belge.ad} · Kenar Notu`;
  await acilisOynat({ belge, kap, modul, sayfa, ek, kaynak });
  sekilDuzeltAktar();
}

// Açık belgede mod ya da sayfa değişti. Modül yerinde geçiş biliyorsa (modDegistir) o çağrılır;
// bilmiyorsa belge aynı yerde yeniden kurulur: eski görüntü yeni ekran hazır olana kadar altta kalır.
async function yerindeAc(belge, mod, sayfa, ek = {}) {
  const { modul, kap: eski } = acik;
  if (sayfa == null && acik.mod !== mod && typeof modul.modDegistir === "function") {
    try {
      await modul.modDegistir(mod);
      acik.mod = mod;
      eski.dataset.mod = mod;
      if ((ek.ara || ek.konum) && typeof modul.git === "function") await modul.git({ ...ek });
      return;
    } catch (hata) { console.warn("[kenar-notu] modDegistir:", hata); }
  }
  try { modul.kaydet?.(); } catch { /* son kayıtlı konum yeter */ }
  try { modul.kapat?.(); } catch (hata) { console.error("[kenar-notu] kapat() hatası:", hata); }
  eski.inert = true;
  const kap = h("section", { class: "ekran ekran-belge", "aria-label": belge.ad, dataset: { mod } });
  kap.style.opacity = "0";
  Object.assign(acik, { kap, mod });
  sahne.append(kap);
  await modulAc(modul, kap, belge, sayfa, mod, ek);
  await soldur(kap, hareketAz() ? 120 : 160);
  eski.remove();
}

// Ekran modülü sözleşmesi (ortak.js, OZELLIKLER-4): ac(kap, belge, sayfa, mod, { ara, konum })
async function modulAc(modul, kap, belge, sayfa, mod = varsayilanMod(belge), ek = {}) {
  try { await modul.ac(kap, belge, sayfa ?? undefined, mod, { ara: ek.ara, konum: ek.konum, iz: ek.iz }); }
  catch (hata) {
    // Yarım kurulmuş ekranda kalınmaz: açılış bitince kitaplığa dönülür
    console.error("[kenar-notu] Ekran açılırken hata:", hata);
    toast(t("Bu belge açılırken bir sorun çıktı."));
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
}

function kitaplikGizle() {
  K.kaydirma = K.icerik.scrollTop;
  fisKapat(true);
  K.ekran.hidden = true;
}

async function soldur(el, sure) {
  const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: sure, easing: "cubic-bezier(.22,.8,.24,1)" });
  el.style.opacity = "";
  await bitince(a, sure);
}

async function acilisOynat({ belge, kap, modul, sayfa, ek, kaynak }) {
  const kitaplikGorunur = !K.ekran.hidden;
  const kaynakVar = !!kaynak?.isConnected && kaynak.getClientRects().length > 0;

  // İlk yüklemede ya da belgeden belgeye: doğrudan
  if (!kitaplikGorunur) {
    sahne.append(kap);
    await modulAc(modul, kap, belge, sayfa, undefined, ek);
    return;
  }
  // Sade hareket: yalnız 120ms opaklık
  if (hareketAz()) {
    acikPencere?.close();
    kap.style.opacity = "0";
    sahne.append(kap);
    await modulAc(modul, kap, belge, sayfa, undefined, ek);
    await soldur(kap, 120);
    kitaplikGizle();
    return;
  }
  if (belge.tur === "epub" && kaynakVar && kaynak.classList.contains("kapak-kitap")) return kitapAcilisi({ belge, kap, modul, sayfa, ek, kaynak });
  // Çizgi roman galeri karanlığında açılır: kapak dönüşmez, karanlık sade opaklıkla gelir
  if (document.startViewTransition && kaynakVar && !cizgiMi(belge)) return gorunumGecisi({ belge, kap, modul, sayfa, ek, kaynak });

  // Yedek: 200ms opaklık
  acikPencere?.close();
  kap.style.opacity = "0";
  sahne.append(kap);
  await modulAc(modul, kap, belge, sayfa, undefined, ek);
  await soldur(kap, 200);
  kitaplikGizle();
}

// EPUB: yaldızlı bez kapak sırtı etrafında açılır, arkasında ebru forza; okuma sayfası üstünde belirir
async function kitapAcilisi({ belge, kap, modul, sayfa, ek, kaynak }) {
  const r = kaynak.getBoundingClientRect();
  const kopya = kaynak.cloneNode(true);
  $(".fav", kopya)?.remove();
  const katman = h("div", { class: "acilis", "aria-hidden": "true", style: `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px` },
    h("div", { class: "acilis-ebru" }), kopya);
  sahne.append(katman);
  kaynak.style.visibility = "hidden";
  kap.style.opacity = "0";
  sahne.append(kap);
  const acma = modulAc(modul, kap, belge, sayfa, undefined, ek);

  kopya.animate([
    { transform: "perspective(1200px) rotateY(0deg)", opacity: 1 },
    { opacity: 1, offset: 0.4 },
    { transform: "perspective(1200px) rotateY(-100deg)", opacity: 0 },
  ], { duration: 300, easing: "cubic-bezier(.62,0,.32,1)", fill: "forwards" });
  await bekle(180);
  const gorun = kap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "cubic-bezier(.22,.8,.24,1)", fill: "forwards" });
  await bitince(gorun, 240);
  kap.style.opacity = "";
  gorun.cancel();
  katman.remove();
  kaynak.style.visibility = "";
  kitaplikGizle();
  await acma;
}

// PDF ve defter: kapak View Transition ile görünen ilk sayfaya dönüşür
async function gorunumGecisi({ belge, kap, modul, sayfa, ek, kaynak }) {
  const ad = "acilan";
  const sayfaKaynak = kaynak.classList.contains("kapak-pdf") ? $(".yaprak", kaynak) || kaynak : kaynak;
  sayfaKaynak.style.viewTransitionName = ad;
  let hedef = null, basladi = false;
  const gecis = document.startViewTransition(async () => {
    basladi = true;
    sayfaKaynak.style.viewTransitionName = "";
    acikPencere?.close();
    sahne.append(kap);
    await modulAc(modul, kap, belge, sayfa, undefined, ek);
    kitaplikGizle();
    hedef = gorunurSayfa(kap);
    if (hedef) hedef.style.viewTransitionName = ad;
  });
  gecis.ready.catch(() => {});   // atlanan geçişte "ready" reddedilir, hata sayılmaz
  // Sayfa çizim yapmıyorsa geçiş görüntü yakalamayı bekleyip takılır: atlanır, belge yine açılır
  const bekci = setTimeout(() => { if (!basladi) gecis.skipTransition(); }, 500);
  await Promise.race([gecis.finished.catch(() => {}), gecis.updateCallbackDone.catch(() => {}).then(() => bekle(700))]);
  clearTimeout(bekci);
  sayfaKaynak.style.viewTransitionName = "";
  if (hedef) hedef.style.viewTransitionName = "";
}

function gorunurSayfa(kap) {
  return $$(".sayfa", kap).find((s) => {
    const r = s.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  }) || null;
}

// Arama ekranı kapanırken kutudaki terim saklanır (geri dönüşte aynı sonuçlar)
function aramaTeriminiSakla(kap) {
  const g = kap?.querySelector('input[type="search"], input:not([type]), input[type="text"]');
  if (g) sonAramaTerim = g.value;
}
function belgeyiKapat() {
  if (acik.ekran === "arama") aramaTeriminiSakla(acik.kap);
  try { acik.modul?.kapat?.(); } catch (hata) { console.error("[kenar-notu] kapat() hatası:", hata); }
  acik.kap?.remove();
  Object.assign(acik, { modul: null, kap: null, belgeId: null, ekran: null, mod: null });
}

// Tekrar ekranı (tekrar.js: ac(kap, secenek?) ve kapat()). Kitaplığın ya da açık belgenin üstüne opaklıkla gelir.
async function tekrarAc({ gecmis = "it", sinav, kartId } = {}) {
  await kayit.veriBekle();   // kartın sayfası belgenin verisinde
  const secenek = sinav || kartId ? { sinav, kartId } : undefined;
  if (acik.ekran === "tekrar" && acik.kap) {
    // Açık Tekrar'a gelen kart ya da sınav isteği ekran yerinde yeniden kurularak uygulanır
    if (secenek) {
      try { acik.modul?.kapat?.(); await acik.modul.ac(acik.kap, secenek); }
      catch (hata) { console.error("[kenar-notu] Tekrar açılırken hata:", hata); }
    }
    return;
  }
  fisKapat(true);
  cekmeceKapat();
  let modul;
  try {
    modul = await import("./tekrar.js");
    if (typeof modul.ac !== "function") throw new Error("ac() dışa aktarılmamış");
  } catch (hata) {
    console.warn("[kenar-notu] Tekrar modülü yüklenemedi:", hata);
    modulHatasi(hata, t("Tekrar ekranı henüz hazır değil."));
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "tekrar" }, "#tekrar");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-tekrar", "aria-label": TEKRAR_ADI });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "tekrar", mod: null });
  document.title = `${TEKRAR_ADI} · Kenar Notu`;
  tekrarGuncelle();
  const gorunsun = kitaplikGorunur || eski;
  if (gorunsun) kap.style.opacity = "0";
  sahne.append(kap);
  // Önce eski ekranın dinleyicileri kapanır; görüntüsü yeni ekran gelene kadar altta kalır
  if (eski) {
    if (eski.ekran === "arama") aramaTeriminiSakla(eski.kap);
    try { eski.modul?.kapat?.(); } catch (hata) { console.error("[kenar-notu] kapat() hatası:", hata); }
    eski.kap.inert = true;
  }
  try { await modul.ac(kap, secenek); }
  catch (hata) {
    console.error("[kenar-notu] Tekrar açılırken hata:", hata);
    toast(t("Tekrar ekranı açılırken bir sorun çıktı."));
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
  if (gorunsun) await soldur(kap, hareketAz() ? 120 : 200);
  eski?.kap.remove();
  if (kitaplikGorunur) kitaplikGizle();
}

// Arama ekranı (arama.js: ac(kap, { terim }) ve kapat()). Tekrar gibi kitaplığın ya da açık ekranın üstüne gelir.
async function aramaAc({ gecmis = "it", terim } = {}) {
  await kayit.veriBekle();   // notlar ve izler belge verilerinde
  terim = typeof terim === "string" ? terim.trim() : "";
  if (terim) sonAramaTerim = terim;
  if (acik.ekran === "arama" && acik.kap) {
    // Açık aramaya gelen yeni terim: ekran yerinde yeniden kurulur
    if (terim) {
      try { acik.modul?.kapat?.(); acik.kap.replaceChildren(); await acik.modul.ac(acik.kap, { terim }); }
      catch (hata) { console.error("[kenar-notu] Arama açılırken hata:", hata); }
    }
    return;
  }
  fisKapat(true);
  cekmeceKapat();
  let modul;
  try {
    modul = await import("./arama.js");
    if (typeof modul.ac !== "function") throw new Error("ac() dışa aktarılmamış");
  } catch (hata) {
    console.warn("[kenar-notu] Arama modülü yüklenemedi:", hata);
    modulHatasi(hata, t("Arama ekranı henüz hazır değil."));
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "arama" }, "#arama");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-arama", "aria-label": t("Ara") });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "arama", mod: null });
  document.title = `${t("Ara")} · Kenar Notu`;
  const gorunsun = kitaplikGorunur || eski;
  if (gorunsun) kap.style.opacity = "0";
  sahne.append(kap);
  if (eski) {
    try { eski.modul?.kapat?.(); } catch (hata) { console.error("[kenar-notu] kapat() hatası:", hata); }
    eski.kap.inert = true;
  }
  try { await modul.ac(kap, { terim: terim || sonAramaTerim || undefined }); }
  catch (hata) {
    console.error("[kenar-notu] Arama açılırken hata:", hata);
    toast(t("Arama ekranı açılırken bir sorun çıktı."));
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
  if (gorunsun) await soldur(kap, hareketAz() ? 120 : 200);
  eski?.kap.remove();
  if (kitaplikGorunur) kitaplikGizle();
}

// İzlerim ekranı (izler.js: ac(kap) ve kapat()). Arama gibi kitaplığın ya da açık ekranın üstüne gelir.
async function izlerAc({ gecmis = "it" } = {}) {
  await kayit.veriBekle();
  if (acik.ekran === "izler" && acik.kap) return;
  fisKapat(true);
  cekmeceKapat();
  let modul;
  try {
    modul = await import("./izler.js");
    if (typeof modul.ac !== "function") throw new Error("ac() dışa aktarılmamış");
  } catch (hata) {
    console.warn("[kenar-notu] İzler modülü yüklenemedi:", hata);
    modulHatasi(hata, t("İzlerim ekranı açılamadı."));
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "izler" }, "#izler");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-izler", "aria-label": t("İzlerim") });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "izler", mod: null });
  document.title = `${t("İzlerim")} · Kenar Notu`;
  kenarGuncelle();
  const gorunsun = kitaplikGorunur || eski;
  if (gorunsun) kap.style.opacity = "0";
  sahne.append(kap);
  if (eski) {
    if (eski.ekran === "arama") aramaTeriminiSakla(eski.kap);
    try { eski.modul?.kapat?.(); } catch (hata) { console.error("[kenar-notu] kapat() hatası:", hata); }
    eski.kap.inert = true;
  }
  try { await modul.ac(kap); }
  catch (hata) {
    console.error("[kenar-notu] İzlerim açılırken hata:", hata);
    toast(t("İzlerim ekranı açılırken bir sorun çıktı."));
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
  if (gorunsun) await soldur(kap, hareketAz() ? 120 : 200);
  eski?.kap.remove();
  if (kitaplikGorunur) kitaplikGizle();
}

// Geri dönüşte ters animasyon yok: kitaplık 200ms opaklıkla gelir
async function kitapligaDon({ gecmis = null, animasyon = true } = {}) {
  const oncekiId = acik.belgeId;
  const tekrardan = acik.ekran === "tekrar";
  if (acik.kap) belgeyiKapat();
  temaRengi();   // okuyucu Gece sayfasında theme-color'ı değiştirmiş olabilir
  if (gecmis === "degistir") history.replaceState({ ekran: "kitaplik" }, "", location.pathname + location.search);
  if (bekleyenGorunum) {
    tercih.secim = bekleyenGorunum;
    bekleyenGorunum = null;
    tercihKaydet();
    kitaplikKirli = true;
  }
  const gizliydi = K.ekran.hidden;
  K.ekran.hidden = false;
  if (kitaplikKirli || gizliydi) {
    kitaplikKirli = false;
    kitaplikCiz();
  }
  if (gizliydi) K.icerik.scrollTop = K.kaydirma || 0;
  baslikGuncelle();
  if (gizliydi && animasyon) soldur(K.ekran, hareketAz() ? 120 : 200);
  if (oncekiId) {
    const id = CSS.escape(oncekiId);
    $(`.belge[data-id="${id}"] a.kapak-sahne, .belge-satir[data-id="${id}"] .satir-bag`, K.sonuclar)?.focus({ preventScroll: true });
  }
  kenarGuncelle();
  if (tekrardan && !darMedya.matches) K.tekrar.focus({ preventScroll: true });
}

/* ================= Olaylar ve kısayollar ================= */
// Asistanın "Ayarları aç" eylemi: belge açıkken de doğrudan Yapay zekâ penceresi
// Başka bölümler (ör. "exlibris", "yedek") Ayarlar sayfasını o bölümde açar
bus.on("ayarlar:ac", (o) => {
  if (o?.bolum === "ceviri") ceviriPenceresi();
  else if (!o?.bolum || o.bolum === "yz") yzPenceresi();
  else ayarlarAc({ bolum: o.bolum === "ayarlar" ? null : o.bolum });
});
bus.on("yedek:ac", () => yedekPenceresi());
// Ödünç kartı sayacı: kayıt planlanır, kitaplık dönüşte yeni sayıyla çizilir
bus.on("odunc", () => { kayit.kaydetPlanla(); kitaplikKirli = true; });
// İzler (OZELLIKLER-5): Koltuk ve Masa üst çubuğundaki defter simgesi "defter:ac", Notlar panelinin
// İzler sekmesi "izler:ac" yayınlar; izler.js kendi defterini ya da panelini açık ekranın üstünde açar.
const izlerModulu = () => import("./izler.js");
bus.on("defter:ac", (o) => {
  const b = belgeBul(o?.belgeId);
  if (!b) return;
  kayit.veriBekle().then(izlerModulu).then((m) => m.defterAc(b)).catch((hata) => { console.warn("[kenar-notu] Cep defteri açılamadı:", hata); modulHatasi(hata, t("Cep defteri açılamadı.")); });
});
bus.on("izler:ac", (o) => {
  const b = belgeBul(o?.belgeId);
  if (!b) return;
  kayit.veriBekle().then(izlerModulu).then((m) => m.izlerPaneliAc(b, o)).catch((hata) => { console.warn("[kenar-notu] İzler açılamadı:", hata); modulHatasi(hata, t("İzler açılamadı.")); });
});
bus.on("belgeler", (o) => { if (!sessiz && o?.tur !== "dil") kitaplikYenile(); });
bus.on("kirpintilar", () => { if (!sessiz) kitaplikYenile(); });
// Kart eklenince camın son hanesi yuvarlanır (imza anı 9.7); ders şeritlerindeki kart sayısı da değişir
bus.on("kartlar", (olay) => {
  tekrarGuncelle();
  if (olay?.tur !== "guncelle") kitaplikYenile();
});
// Gün dönünce bekleyen kartlar değişir: uygulamaya dönüldüğünde ve uygulama önde açıkken gece yarısında sayaç yenilenir
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tekrarGuncelle(); });
(function geceYarisi() {
  const gece = new Date();
  gece.setHours(24, 0, 5, 0);
  setTimeout(() => { tekrarGuncelle(); geceYarisi(); }, gece.getTime() - Date.now());
})();

document.addEventListener("keydown", (e) => {
  if (!K.ekran || K.ekran.hidden || e.defaultPrevented) return;
  if (document.querySelector("dialog[open], .karsilama, .alt-cekmece")) return;
  if (e.key === "Escape" && K.kenar.classList.contains("acik")) { cekmeceKapat(); return; }
  // Seçim kipi (K6): Esc kapatır, Ctrl A görünenlerin hepsini seçer
  if (secim.acik && e.key === "Escape") { e.preventDefault(); secimKipi(false); return; }
  if (secim.acik && (e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && !yaziAlani(e.target)) { e.preventDefault(); tumunuSec(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === "f" || e.key === "F")) {
    e.preventDefault();
    bus.emit("git", { ekran: "arama", terim: arama.trim() || undefined });
    return;
  }
  if (e.key === "/" && !yaziAlani(e.target) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    K.aramaGirdi.focus();
    K.aramaGirdi.select();
  }
});

// Hızlı erişim (TASARIM-4 3.2): Ctrl+K her ekranda; Ara ekranı açıksa arama.js kendi girdisini odaklar
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key !== "k" && e.key !== "K")) return;
  if (document.querySelector("dialog[open], .karsilama") || acik.ekran === "arama") return;
  e.preventDefault();
  import("./arama.js").then((m) => m.paletAc?.()).catch((hata) => console.warn("[kenar-notu] Hızlı erişim açılamadı:", hata));
});
// Klavye kısayolları (K9): "?" her ekranda, girdi odakta değilken ve pencere açık değilken
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || yaziAlani(e.target)) return;
  if (document.querySelector("dialog[open], .karsilama, .alt-cekmece")) return;
  e.preventDefault();
  kisayollarAc();
});
// Kabuğun kısayolları (10.4): yalnız liste kaydı; tuşları yukarıda kabuk kendisi dinler
for (const [tus, ad] of [["Ctrl K", t("Hızlı erişim: belge, ekran ve komut")], ["Ctrl F", t("Her yerde ara")], ["/", t("Kitaplıkta ara")],
  ["?", t("Klavye kısayolları")], ["Esc", t("Pencereyi, paneli ya da seçimi kapat")], [t("Ctrl Tık"), t("Seçime ekle ya da çıkar")],
  [t("Shift Tık"), t("Aralığı seç")], ["Ctrl A", t("Seçim kipinde hepsini seç")]]) kisayolEkle({ tus, ad, alan: "genel" });

/* ---------- Hızlı erişim komutları (kabuğun komutları; Koltuk ve Masa kendi komutlarını ekler) ---------- */
const sonIz = (b) => {
  const izler = Array.isArray(b?.veri?.izler) ? b.veri.izler : [];
  return izler.reduce((m, x) => ((x?.zaman || 0) > (m?.zaman || 0) ? x : m), null);
};
// Görünüm komutlarının simgeleri (7.0): atmosfer = ufukta doğan ışık, vurgu = ışıyan damla
simgeEkle("atmosfer", '<path class="d" d="M7 15a5 5 0 0 1 10 0Z"/><path d="M3.5 15h17M6.5 18.5h11M9.5 21.5h5M12 4v2.5M5.6 7.6l1.7 1.7M18.4 7.6l-1.7 1.7"/>');
simgeEkle("vurgu", '<path class="d" d="M12 3.5c3.2 3.6 5.5 6.6 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-9.6Z"/><path d="M9.5 13.5a2.6 2.6 0 0 0 2.5 2.5"/>');
function komutlarKur() {
  const git = (ekran) => () => bus.emit("git", { ekran });
  const secili = (evet) => (evet ? t("Seçili") : "");
  // "Açık" sözlükte tema adı ("Light") olarak da geçer: anahtar paylaşılmasın diye dile göre seçilir
  const acikKapali = ingilizceMi ? ["On", "Off"] : ["Açık", "Kapalı"];
  // es: aramada eşleşen ek sözcükler; arayüz dilinde verilir (İngilizce kullanıcı İngilizce arar)
  [
    { id: "git-kitaplik", grup: "git", ad: t("Kitaplık"), es: t("ana ekran raf"), ikon: "tumu", calistir: git("kitaplik") },
    { id: "git-izler", grup: "git", ad: t("İzlerim"), es: t("iz altını çizdiklerim alıntı cep defteri"), ikon: "izler", calistir: git("izler") },
    { id: "git-tekrar", grup: "git", ad: TEKRAR_ADI, es: t("kart çalış leitner"), ikon: "tekrar", alt: () => { const n = bugunTekrar().length; return n ? t("{n} kart", { n }) : ""; }, calistir: git("tekrar") },
    { id: "ayarlar", grup: "git", ad: t("Ayarlar"), es: t("tercihler seçenekler"), ikon: "ayarlar", calistir: () => ayarlarAc() },
    { id: "dosya-ac", ad: t("Dosya aç"), es: t("içe aktar pdf epub cbz ekle kitap"), ikon: "pdf", calistir: () => dosyaSec() },
    { id: "kitap-klasoru", ad: t("Kitap klasörü"), es: t("bilgisayardaki kitaplar klasör tara içe aktar pdf epub cbz"), ikon: "klasor",
      kosul: () => kayit.klasorDestegi(), alt: () => kitapKlasoruAdi || "", calistir: () => kitapKlasoruAc() },
    { id: "yeni-defter", ad: t("Yeni defter"), es: t("defter not defteri kâğıt"), ikon: "yeni-defter", calistir: () => yeniDefterPenceresi() },
    { id: "yedekle", ad: t("Yedekle"), es: t("yedek kenar dışa aktar"), ikon: "yedekle", calistir: () => yedekAlIstegi() },
    { id: "yedekten-yukle", ad: t("Yedekten yükle"), es: t("geri yükle kenar"), ikon: "yedekle", calistir: () => yedekSec() },
    // Görünüm (TASARIM-5 4.1 madde 6): seçili olanın alt satırında "Seçili"
    { id: "tema-acik", ad: t("Tema: Açık"), es: t("aydınlık gündüz beyaz"), ikon: "tema-acik", alt: () => secili(store.ayarlar.tema === "acik"), calistir: () => ayarla({ tema: "acik" }) },
    { id: "tema-koyu", ad: t("Tema: Koyu"), es: t("karanlık gece siyah"), ikon: "tema-koyu", alt: () => secili(store.ayarlar.tema === "koyu"), calistir: () => ayarla({ tema: "koyu" }) },
    { id: "tema-oto", ad: t("Tema: Otomatik"), es: t("sistem"), ikon: "tema-oto", alt: () => secili((store.ayarlar.tema || "oto") === "oto"), calistir: () => ayarla({ tema: "oto" }) },
    ...ATMOSFERLER.map((a) => ({ id: "atmosfer-" + a.id, ad: t("Atmosfer: {ad}", { ad: a.ad }), ikon: "atmosfer",
      es: `${t("tema zemin renk arka plan görünüm")} ${a.gunduzAd || ""} ${a.yalnizGece ? t("gece karanlık") : ""}`.trim(),
      alt: () => secili((atmosferBul(store.ayarlar.atmosfer) ? store.ayarlar.atmosfer : "aurora") === a.id), calistir: () => ayarla({ atmosfer: a.id }) })),
    { id: "vurgu-atmosfer", ad: t("Vurgu: Atmosferin rengi"), es: t("vurgu renk ışık varsayılan"), ikon: "vurgu",
      alt: () => secili(!VURGULAR.some((v) => v.id === store.ayarlar.vurgu)), calistir: () => ayarla({ vurgu: null }) },
    ...VURGULAR.map((v) => ({ id: "vurgu-" + v.id, ad: t("Vurgu: {ad}", { ad: v.ad }), es: t("vurgu renk ışık tema"), ikon: "vurgu",
      alt: () => secili(store.ayarlar.vurgu === v.id), calistir: () => ayarla({ vurgu: v.id }) })),
    { id: "canli-zemin", ad: t("Canlı zemin"), es: t("hareketli zemin arka plan ışık animasyon"), ikon: "atmosfer",
      alt: () => (hareketAz() ? t("Sade hareket açıkken kapalı") : store.ayarlar.canliZemin ? acikKapali[0] : acikKapali[1]),
      calistir: () => { if (hareketAz()) toast(t("Sade hareket açıkken canlı zemin kapalı")); else ayarla({ canliZemin: !store.ayarlar.canliZemin }); } },
    { id: "kart-calis", ad: t("Kart çalış"), es: t("tekrar kart leitner"), ikon: "tekrar", calistir: git("tekrar") },
    { id: "rehber", ad: t("Rehberi yeniden göster"), es: t("yardım nasıl ipucu"), ikon: "sor", calistir: () => rehberBaslat(0) },
    { id: "ex-libris", ad: t("Ex libris çiz"), es: t("mühür imza monogram"), ikon: "damga", calistir: () => ayarlarAc({ bolum: "exlibris" }) },
    { id: "ceviri-ayar", ad: t("Çeviri ayarları"), es: t("çeviri paket dil translate"), ikon: "ceviri", calistir: () => ceviriPenceresi() },
    { id: "son-iz", baglam: "belge", ad: t("Son izime git"), es: t("iz altını çizdiğim"), ikon: "izler", kosul: (c) => !!sonIz(c.belge),
      calistir: (c) => bus.emit("git", { ekran: "belge", belgeId: c.belge.id, izId: sonIz(c.belge).id }) },
    { id: "sayfaya-git", baglam: "pdf", sayi: true, ad: (c, q) => (/^\d+$/.test(q || "") ? t("Sayfaya git: {q}", { q }) : t("Sayfaya git")), es: t("sayfa git"), ikon: "sayfalar",
      calistir: (c, q) => { const n = parseInt(q, 10); if (n > 0) bus.emit("git", { ekran: "belge", belgeId: c.belge.id, sayfa: Math.min(n, c.belge.sayfaSayisi || n) }); } },
    { id: "masada-ac", baglam: "belge", ad: t("Masa’da aç"), es: t("çalış masa mod"), ikon: "masa", kosul: (c) => c.mod === "koltuk" && !cizgiMi(c.belge),
      calistir: (c) => bus.emit("git", { ekran: "belge", belgeId: c.belge.id, mod: "masa" }) },
    { id: "koltukta-ac", baglam: "belge", ad: t("Koltuk’ta aç"), es: t("oku koltuk mod"), ikon: "koltuk", kosul: (c) => c.mod === "masa" && !cizgiMi(c.belge),
      calistir: (c) => bus.emit("git", { ekran: "belge", belgeId: c.belge.id, mod: "koltuk" }) },
  ].forEach(komutEkle);
}
komutlarKur();

/* ================= Örnek kırpıntılar ================= */
// Panonun ilk açılışta boş görünmemesi için örnek sayfalardan birkaç bölge kırpılır.
// Görüntüler kalıcı kaydedilir: örnek sayfaların yazı tipleri beklenir (en çok 3 sn, sonra yedek fontla).
// s: PDF_PAGES sırası (kırpıntının sayfa numarası da belgenin kaldığı sayfadan bu kadar ileri), b: bölge (x, y, gen, yük).
// Bölgeler sayfalar.js düzeninden ölçüldü: altta komşu satırın ucu görünmez.
// Kayıtta ornekSira bu listedeki sırayı tutar: örnek sürümü değişince görüntü aynı sıradan yeniden kesilir.
// notlar: { tr, en }; yeni örnek arayüz dilinde kurulur, eski kayıttaki örnek iki dilde de tanınır (ornekKirpintiSirasi)
const ORNEK_KIRPINTILAR = [
  { s: 0, b: [62, 268, 676, 176], belgeId: "kalkulus", notlar: { tr: "Zincir kuralı: dış türev çarpı iç türev", en: "Chain rule: outer derivative times inner derivative" }, dk: 35 },
  { s: 1, b: [200, 282, 400, 348], belgeId: "kalkulus", notlar: { tr: "Teğet, yarıçapa diktir. Eğimler çarpımı -1", en: "The tangent is perpendicular to the radius. Product of slopes is -1" }, dk: 3 * 60 },
  { s: 2, b: [96, 300, 620, 232], belgeId: "statik", notlar: { tr: "Önce serbest cisim diyagramı, sonra A’ya göre moment", en: "Free body diagram first, then moments about A" }, dk: 26 * 60 },
  { s: 0, b: [62, 455, 676, 100], belgeId: "kalkulus", notlar: { tr: "Leibniz: du’lar sadeleşiyormuş gibi düşün", en: "Leibniz: think of the du’s as if they cancel" }, dk: 50 * 60 },
  { s: 0, b: [62, 540, 676, 200], belgeId: "kalkulus", notlar: { tr: "", en: "" }, dk: 4 * 24 * 60 },
];
const ornekNot = (o) => o.notlar[ingilizceMi ? "en" : "tr"];
const KIRPINTI_OLCEK = 1.5;   // görüntü ölçeği: kenar boşluklu sütunda keskin kalsın
const yaziBekle = () => Promise.race([Promise.resolve(SAYFALAR.yaziTipleri).catch(() => false), new Promise((r) => setTimeout(r, 3000))]);

// ORNEK_KIRPINTILAR sırasıyla PNG görüntüler. ara: her kesitten önce beklenir (sonradan yenilerken boş an)
async function ornekKirpintiGorselleri(ara = null) {
  const O = KIRPINTI_OLCEK, cizilen = new Map();
  const sayfaCiz = (i) => {
    if (cizilen.has(i)) return cizilen.get(i);
    const c = document.createElement("canvas");
    c.width = PW * O; c.height = PH * O;
    const x = c.getContext("2d");
    x.scale(O, O);
    x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);
    PDF_PAGES[i].draw(x);
    cizilen.set(i, c);
    return c;
  };
  const gorseller = [];
  for (const { s, b: [x, y, w, yuk] } of ORNEK_KIRPINTILAR) {
    if (ara) await ara();
    const c = document.createElement("canvas");
    c.width = Math.round(w * O); c.height = Math.round(yuk * O);
    c.getContext("2d").drawImage(sayfaCiz(s), x * O, y * O, w * O, yuk * O, 0, 0, c.width, c.height);
    gorseller.push(c.toDataURL("image/png"));
  }
  return gorseller;
}

async function ornekKirpintilar() {
  if (store.kirpintilar.length) return;
  await yaziBekle();
  if (store.kirpintilar.length) return;
  // Kesit kesit, her biri ayrı boş anda: ilk boyamayı ve kalemi bekletmesin
  const gorseller = await ornekKirpintiGorselleri(bosAn);
  if (store.kirpintilar.length) return;
  const ad = (id) => belgeBul(id)?.ad || (id === "statik" ? (ingilizceMi ? "Statics" : "Statik") : (ingilizceMi ? "Calculus II" : "Kalkülüs II"));
  // PDF düzenleyicide kaldığı sayfadan başlayan bir kesitle açılır; kırpıntının numarası o kesitteki numaradır
  const no = (id, i) => (belgeBul(id)?.sayfa || 1) + i;
  const t = Date.now();
  store.kirpintilar.push(...ORNEK_KIRPINTILAR.map((o, i) => ({
    id: yeniId("k"), gorsel: gorseller[i], belgeId: o.belgeId, belgeAd: ad(o.belgeId), sayfa: no(o.belgeId, o.s), not: ornekNot(o),
    zaman: t - o.dk * 6e4, ornekSira: i, ornekSurum: ORNEK_DEGISIM.kirpintilar,
  })));
  bus.emit("kirpintilar", { tur: "ornek" });   // pano çizilir ve kayda yazılır
}

/* ================= İlk açılış (OZELLIKLER-4 §1.5) ================= */
// Kayıt yoksa: "Örneklerle başla" (ortak.js örnekleri) ya da "Boş başla" (yalnız boş bir defter).
// Seçilene kadar örnek durum kayda yazılmaz; seçmeden çıkan bir dahaki açılışta yine görür.
const ORNEK_IDLER = new Set(store.belgeler.map((b) => b.id));

// Örnek Tekrar kartlarını tekrar.js üretir (TASARIM-2 6.8). Görüntülü örnekler sürümle işaretlenir.
function ornekKartlar() {
  // Kart görüntüleri örnek sayfadan kesilir: yazı tipleri (en çok 3 sn) ve tek parça üretim için boş bir an beklenir
  Promise.all([import("./tekrar.js"), yaziBekle()])
    .then(async ([m]) => {
      if (!store.kartlar.length) await bosAn();
      if (!store.kartlar.length) {
        (m.ornekKartlariHazirla || m.ornekKartlar)?.();
        for (const k of store.kartlar) if (ornekKartSirasi(k) >= 0) k.ornekSurum ??= ORNEK_DEGISIM.kartlar;
      }
      tekrarGuncelle();
    })
    .catch(() => { /* tekrar.js henüz yok */ });
}

/* ================= Örnek veri sürümü (ortak.js ORNEK_SURUM) ================= */
// Önceki sürümlerde kaydedilmiş örnek belgeler eski sayfa sıralarını (veri.sayfalar[].pdf) ve eski süsleri,
// örnek kırpıntılar ve kartlar eski sayfa görüntülerini tutar. Açılışta bir kez:
// kullanıcı bir şey eklemediyse örnek belge baştan kurulur (veri bırakılır, açılınca düzenleyici yeniden kurar);
// eklediyse eski süsler kalkar, sayfalar yeni düzene taşınır, kullanıcının eklediği her şey kalır.
// Dosyası olan (dosya: true) belgeye dokunulmaz. Örnek EPUB'ları ornekEpubTasi taşır (3. sürümde kendi metinleri).
// Örnek süsler kurulduğu dilde kalır (duzenleyici.js t() ile kurar), dil sonradan değişebilir: eşleştirme iki dili de tanır.
// Sözlük doğrudan okunur, t() yalnız şu anki dili verirdi. (import bildirimi modülün başına çıkar, burada durabilir.)
import { EN } from "./dil/en.js";
const ikiDilde = (dizi) => new Set(dizi.flatMap((s) => (typeof EN[s] === "string" ? [s, EN[s]] : [s])));
const SUS = { lacivert: "#1F3A68", kirmizi: "#C2412D", notlar: ikiDilde(["Sınavda çıkar! İç fonksiyondan başla."]) };
// Diferansiyel Denklemler defterinin 1. sayfasındaki hazır çözüm: 6. turdaki düz metin ve 7. turdaki el yazısı (el: true)
const DIFDENK_ESKI = ikiDilde(["Örnek 2.1    y′ = 2y,   y(0) = 3", "Değişkenlerine ayır:", "dy / y = 2 dx", "∫ dy / y = ∫ 2 dx    ⇒    ln |y| = 2x + c",
  "y = C · e²ˣ", "y(0) = 3    ⇒    C = 3", "y = 3 e²ˣ", "Sağlama: y′ = 6 e²ˣ = 2y"]);
const DIFDENK_YENI = ikiDilde(["Örnek 2.1", "y′ = 2y,  y(0) = 3", "Değişkenlerine ayır:", "dy", "y", "= 2 dx", "= ", "2 dx", "ln", "= 2x + c",
  "y = C · e", "2x", "y(0) = 3", "C = 3", "y = 3e", "Sağlama:  y′ = 6e", "= 2y"]);
// 2. sürümün yazılmaya başladığı an (6. tur kaydı): son açılışı bundan önce olan belge kesin 1. sürümdedir
const ORNEK_2_ONCESI = Date.parse("2026-10-27T03:36:29Z");
const NESNE_ALANLARI = ["cizgiler", "notlar", "metinler", "bantlar", "gorseller"];

// Düzenleyicinin ilk açılışta kendiliğinden kurduğu süs mü (duzenleyici.js kalkulusSusle, difdenkSusle)
function otoSus(belgeId, alan, o) {
  if (!o) return false;
  const n = Array.isArray(o.p) ? o.p.length : 0;
  if (belgeId === "kalkulus") {
    if (alan === "cizgiler") return (o.tur === "fosforlu" && o.w === 24 && n === 25) || (o.tur === "tukenmez" && o.renk === SUS.kirmizi && o.w === 3 && n === 73);
    if (alan === "notlar") return SUS.notlar.has(o.metin);
    // Kullanıcının bandı rastgele eğimle (BANT_ACI ± 0,3) doğar; örnek bant tam -0,8
    if (alan === "bantlar") return o.desen === "murekkep" && o.aci === -0.8;
  }
  if (belgeId === "difdenk") {
    if (alan === "metinler") return o.renk === SUS.lacivert && (o.el ? DIFDENK_YENI : DIFDENK_ESKI).has(o.metin);
    if (alan === "cizgiler") {
      return (o.tur === "dolma" && o.renk === SUS.lacivert && ((o.w === 3 && n === 41) || ([2.2, 2.4, 2.6].includes(o.w) && n <= 11)))
        || (o.tur === "tukenmez" && o.renk === SUS.kirmizi && o.w === 3 && n === 65);
    }
  }
  return false;
}
// Süslerin durduğu sayfa: Kalkülüs'te ilk PDF sayfası, defterde hazır çözümün olduğu ilk sayfa
// (kâğıt sayfa çoğaltılabilir: kopyadaki süs kullanıcınındır)
function susSayfasi(b, v) {
  if (b.id === "kalkulus") return v.sayfalar.find((s) => s?.tur === "pdf" && s.pdf === 0) || null;
  if (b.id === "difdenk") return v.sayfalar.find((s) => (s?.metinler || []).some((m) => otoSus(b.id, "metinler", m))) || null;
  return null;
}
const sayfadaEkleme = (s, susS = null, belgeId = "") =>
  !!s.yerImi || NESNE_ALANLARI.some((a) => (s[a] || []).some((o) => !(s === susS && otoSus(belgeId, a, o))));
// Kullanıcının eklediği şey: çizgi, şekil, not, metin kutusu, damga, bant, görsel, yer imi ya da ses kaydı
const kullaniciEklemesi = (b, v, susS) => (Array.isArray(v.sesler) && v.sesler.length > 0) || v.sayfalar.some((s) => s && sayfadaEkleme(s, susS, b.id));

// Sürümü kayıtlı olmayan (ORNEK_SURUM'dan önceki) kayıtta belgenin hangi sürümde kurulduğu tahmin edilir
function ornekSurumTahmini(b, susS, ipucu) {
  if (b.id === "kalkulus") {
    const bant = susS?.bantlar?.find((o) => otoSus(b.id, "bantlar", o));
    if (bant) return bant.x === 150 && bant.w === 510 ? 1 : 2;   // 1. sürümün bandı sabit ölçülüydü
  }
  if (b.id === "difdenk") return susS?.metinler?.some((m) => m.el && otoSus(b.id, "metinler", m)) ? 2 : 1;
  if (b.acilis && b.acilis < ORNEK_2_ONCESI) return 1;
  return ipucu();
}
// Kitaplığın örnekleri hangi sürümde kuruldu: örnek kırpıntının görüntü yüksekliği (1. sürüm 279, 2. sürüm 264 piksel)
function kirpintiIpucu() {
  const k = store.kirpintilar.find((x) => ornekKirpintiSirasi(x) === 0);
  if (!k) return 1;
  if (Number.isInteger(k.ornekSurum)) return k.ornekSurum;
  return pngOlcu(k.gorsel)[1] === 264 ? 2 : 1;
}

const bosPdfSayfasi = (pdf) => ({ id: yeniId("s"), kenar: false, yerImi: false, cizgiler: [], notlar: [], metinler: [], bantlar: [], gorseller: [], tur: "pdf", pdf });
// Örnek PDF'in sayfaları yeni düzene: aynı içerikli sayfa yeni sırasına geçer (kimliği ve eklenenleriyle),
// yeni düzende olmayan eski sayfa eklenen bir şey taşıyorsa boş kâğıda döner ve sona gider, yoksa kalkar.
// Araya eklenmiş kâğıt sayfalar önlerindeki PDF sayfasıyla birlikte gider.
function sayfalariTasi(b, v, eskiAd) {
  const yeniAd = (SAYFALAR.ornekSayfalari?.(b.id) || PDF_PAGES).map((s) => s?.draw?.name || "");
  const once = v.sayfalar.filter(Boolean), konumdaki = once[v.konum?.sayfa | 0];
  const yerinde = yeniAd.map(() => null), artan = [], bas = [], ardindan = new Map();
  let capa = null;
  for (const s of once) {
    if (s.tur !== "pdf") { (capa ? ardindan.get(capa) : bas).push(s); continue; }
    capa = s;
    ardindan.set(s, []);
    const j = eskiAd[s.pdf] ? yeniAd.indexOf(eskiAd[s.pdf]) : -1;
    if (j >= 0 && !yerinde[j]) { s.pdf = j; yerinde[j] = s; } else artan.push(s);
  }
  const sonra = [...bas];
  yerinde.forEach((s, j) => { if (s) sonra.push(s, ...ardindan.get(s)); else sonra.push(bosPdfSayfasi(j)); });
  for (const s of artan) {
    if (sayfadaEkleme(s)) { s.tur = "kagit"; s.kagit = "blank"; delete s.pdf; sonra.push(s); }
    sonra.push(...ardindan.get(s));
  }
  v.sayfalar = sonra;
  // Kaldığı sayfa yerinde kaldıysa oradan açılır; kâğıda dönen ya da kalkan sayfadaysa baştan
  const i = artan.includes(konumdaki) ? -1 : sonra.indexOf(konumdaki);
  v.konum = i >= 0 ? { ...v.konum, sayfa: i } : { sayfa: 0, oran: 0 };
}
// Kalkan örnek bantların kartları serbest kalır: belge açılınca yeni örnek bant aynı sayfanın kartını
// benimser, kart silinmez (duzenleyici.js bantKartlariniEsle). Kullanıcı bantlarının kartlarına dokunulmaz.
function kartBaglariniCoz(b, kalkanlar) {
  if (!kalkanlar.size) return;
  for (const k of store.kartlar) {
    if (k.belgeId !== b.id || !k.bantId || !kalkanlar.has(k.bantId)) continue;
    delete k.bantId;
    delete k.sayfaId;
    kartGuncelle(k.id, {});
  }
}

// Açılışta, kayıt geri yüklenince bir kez (kayitSurumu: kayıttaki ornekSurum, 0 bilinmiyor)
function ornekVeriyiTasi(kayitSurumu) {
  let ipucu = null, degisti = false;
  const ipucuAl = () => (ipucu ??= kirpintiIpucu());
  for (const b of store.belgeler) {
    const v = b.veri;
    if (b.dosya || !Array.isArray(v?.sayfalar)) continue;
    // Eski yedekten gelen belge kendi sürümünü taşır (kayit.js yedekYukle); işi bitince silinir
    const yedekten = Number.isInteger(v.ornekSurum) ? v.ornekSurum : null;
    if ("ornekSurum" in v) { delete v.ornekSurum; degisti = true; bus.emit("belge:degisti", { belgeId: b.id }); }
    if (!ORNEK_IDLER.has(b.id)) continue;
    const degisim = ORNEK_DEGISIM[b.id];
    if (!degisim) continue;
    if (yedekten == null && kayitSurumu >= degisim) continue;
    const susS = susSayfasi(b, v);
    // Belgenin kendi işareti kitaplığınkinden önce gelir; 0 bilinmiyor demektir
    const surum = (yedekten ?? kayitSurumu) || ornekSurumTahmini(b, susS, ipucuAl);
    if (surum >= degisim) continue;
    degisti = true;
    if (!kullaniciEklemesi(b, v, susS)) {
      // Eklenen bir şey yok: bantların hepsi örneğindir
      const bantlar = new Set(v.sayfalar.flatMap((s) => (s?.bantlar || []).map((x) => x.id)));
      kayit.ornekVeriSifirla(b);
      kartBaglariniCoz(b, bantlar);
      console.info("[kenar-notu] Örnek yenilendi:", b.id, "sürüm", surum, "->", ORNEK_SURUM);
      continue;
    }
    const kalkanBantlar = new Set((susS?.bantlar || []).filter((o) => otoSus(b.id, "bantlar", o)).map((x) => x.id));
    if (susS) for (const a of NESNE_ALANLARI) if (Array.isArray(susS[a])) susS[a] = susS[a].filter((o) => !otoSus(b.id, a, o));
    const eskiAd = ORNEK_SAYFALAR[surum]?.[b.id];
    if (b.tur === "pdf" && eskiAd) sayfalariTasi(b, v, eskiAd);
    kartBaglariniCoz(b, kalkanBantlar);
    bus.emit("belge:degisti", { belgeId: b.id });
    console.info("[kenar-notu] Örnek taşındı, eklenenler korundu:", b.id, "sürüm", surum, "->", ORNEK_SURUM);
  }
  if (ornekEpubTasi(kayitSurumu)) degisti = true;
  kayit.ornekSurumAyarla(Math.max(kayitSurumu || 0, ORNEK_SURUM));
  // Sürüm damgası da yazılsın: bir dahaki açılış yeniden tahmin etmesin
  if (degisti || kayitSurumu !== ORNEK_SURUM) kayit.kaydetPlanla();
}

// 3. sürüm: örnek EPUB'lar (Suç ve Ceza, Dönüşüm) ortak deneme yerine kendi metnini açar. Eski kayıttaki verileri
// denemenin paragraf numaralarını tutar: kullanıcı bir şey eklemediyse yalnız kaldığı yer bırakılır (yeni metnin
// başından açılır, okuma süresi kalır); eklediyse notları kaymasın diye kitap denemede kalır (veri.ornekMetin,
// okuma-metni.js ornekKitap). Eski örnek kelime kartları metinde olmayan sayfalara (34, 112, 287) bağlıydı:
// her açılışta bakılır, okunan metindeki sayfaya çekilir (yeni sayfalar küçük, ikinci kez eşleşmez).
const ESKI_KELIME_SAYFALARI = [34, 112, 287];
// Örnek içeriğin dili (okuma-metni.js ORNEK_KITAPLAR): arayüz diliyle aynı; o dilde örnek yoksa okuma-metni.js Türkçeye düşer
const ORNEK_DIL = ingilizceMi ? "en" : "tr";
const EPUB_ALANLARI = ["vurgular", "cizgiler", "tuvaller", "izler", "yerImleri", "asistanNotlari"];
const eskiKelimeKarti = (k) => k.belgeId === "sucveceza" && k.tur === "kelime" ? ESKI_KELIME_SAYFALARI.indexOf(Number(k.sayfa)) : -1;
const epubEklemesi = (b) => EPUB_ALANLARI.some((a) => Array.isArray(b.veri[a]) && b.veri[a].length)
  || store.kirpintilar.some((k) => k.belgeId === b.id)
  || store.kartlar.some((k) => k.belgeId === b.id && eskiKelimeKarti(k) < 0);
function ornekEpubTasi(kayitSurumu) {
  let degisti = false;
  for (const b of store.belgeler) {
    if (b.dosya || b.tur !== "epub") continue;
    // Kitaplık künyesi kayıtta durur: dil değişince kullanıcının değiştirmediği ad ve yazar seçilen dile çekilir
    if (ORNEK_IDLER.has(b.id) && ornekKunyeDile(b, ORNEK_DIL)) degisti = true;
    const v = b.veri;
    // Eski yedekten gelen örnek EPUB kendi sürümünü taşır (kayit.js yedekYukle); işi bitince silinir
    const yedekten = Number.isInteger(v?.ornekSurum) ? v.ornekSurum : null;
    if (v && "ornekSurum" in v) { delete v.ornekSurum; degisti = true; bus.emit("belge:degisti", { belgeId: b.id }); }
    const degisim = ORNEK_DEGISIM[b.id];
    if (!degisim || !v || v.ornekMetin || !ORNEK_IDLER.has(b.id) || (yedekten ?? kayitSurumu) >= degisim) continue;
    degisti = true;
    if (epubEklemesi(b)) v.ornekMetin = "kagit";
    else v.konum = null;
    bus.emit("belge:degisti", { belgeId: b.id });
    console.info("[kenar-notu] Örnek EPUB:", b.id, v.ornekMetin ? "notlar için denemede kaldı" : "kendi metnine geçti");
  }
  const sucKartlari = ornekKitapKartlari(belgeBul("sucveceza") || "sucveceza");
  for (const k of store.kartlar) {
    const sayfa = sucKartlari[eskiKelimeKarti(k)]?.sayfa;
    if (!sayfa) continue;
    kartGuncelle(k.id, { sayfa });
    degisti = true;
  }
  return degisti;
}

// PNG dataURL'ün piksel ölçüsü (IHDR başlığından): [genişlik, yükseklik]
function pngOlcu(src) {
  try {
    if (typeof src !== "string" || !src.startsWith("data:image/png;base64,")) return [0, 0];
    const b = atob(src.slice(22, 54));
    const u = (i) => ((b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) | (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3)) >>> 0;
    return [u(16), u(20)];
  } catch { return [0, 0]; }
}
// Kayıttaki örnek kırpıntının ORNEK_KIRPINTILAR sırası (-1: kullanıcınınki). Eski kayıtlarda ornekSira yok:
// belge ve görüntü ölçüsüyle (1. ve 2. sürüm bölgeleri), olmazsa örnek notuyla tanınır. Notu değiştirilmiş örnek de tanınır.
const KIRPINTI_OLCULERI = [["1014x279", "1014x264"], ["600x540", "600x522"], ["930x390", "930x348"], ["1014x96", "1014x150"], ["1014x300"]];
const ESKI_KIRPINTI_NOTLARI = { "Önce serbest cisim diyagramı, sonra A'ya göre moment": 2, "Leibniz: du'lar sadeleşiyormuş gibi düşün": 3 };
function ornekKirpintiSirasi(k) {
  if (!k || k.okuma) return -1;
  if (Number.isInteger(k.ornekSira)) return ORNEK_KIRPINTILAR[k.ornekSira] ? k.ornekSira : -1;
  const olcu = pngOlcu(k.gorsel).join("x");
  let i = KIRPINTI_OLCULERI.findIndex((l, j) => l.includes(olcu) && ORNEK_KIRPINTILAR[j].belgeId === k.belgeId);
  if (i < 0 && k.not) i = ORNEK_KIRPINTILAR.findIndex((o) => (o.notlar.tr === k.not || o.notlar.en === k.not) && o.belgeId === k.belgeId);
  if (i < 0 && ESKI_KIRPINTI_NOTLARI[k.not] != null && ORNEK_KIRPINTILAR[ESKI_KIRPINTI_NOTLARI[k.not]].belgeId === k.belgeId) i = ESKI_KIRPINTI_NOTLARI[k.not];
  return i;
}
// Örnek görüntülü kartın sırası (tekrar.js ornekKartlariHazirla: Kalkülüs s. 47, 52, 61 bant kartları; -1: değil).
// Bir banda bağlı kart o bandın sayfasından üretilir, örnek sayılmaz.
const ORNEK_BANT_KARTLARI = [[47, "murekkep"], [52, "hardal"], [61, "bordo"]];
const ornekKartSirasi = (k) => (k?.tur !== "bant" || k.belgeId !== "kalkulus" || k.bantId ? -1
  : ORNEK_BANT_KARTLARI.findIndex(([s, d]) => Number(k.sayfa) === s && k.bant === d));
// Tekrar'ın örnek kartları kayda dokunmadan yeniden üretilir: geçici boş listeye, olaylar susturulmuş
async function ornekKartGorselleri() {
  const m = await import("./tekrar.js");
  const asil = store.kartlar, yay = bus.emit;
  store.kartlar = [];
  bus.emit = () => {};
  try { m.ornekKartlariHazirla?.(); return store.kartlar; }
  finally { store.kartlar = asil; bus.emit = yay; }
}
// Kalem yazarken ya da ekranın üstünde havadayken beklenir: görüntü üretimi ana iş parçacığını tutar
function bosAn() {
  const mesgul = () => document.body.classList.contains("yaziyor") || !!document.querySelector(".yaziyor") || performance.now() - kalemHavada < 800;
  return new Promise((tamam) => {
    const dene = () => {
      if (mesgul()) { setTimeout(dene, 1500); return; }
      bosta(() => (mesgul() ? setTimeout(dene, 1500) : tamam()), { timeout: 3000 });
    };
    dene();
  });
}
// Eski görüntülü örnek kırpıntı ve kartlar yeni sayfalardan yeniden kesilir. Kimlik, not, kutu, sıradaki gün
// ve geçmiş kalır; kullanıcının sildiği örnek geri gelmez. Yarıda kalırsa bir dahaki açılışta sürer.
async function ornekGorselleriTazele() {
  const eski = (x, alan) => !(Number(x.ornekSurum) >= ORNEK_DEGISIM[alan]);
  const kirpintilar = () => store.kirpintilar.filter((k) => ornekKirpintiSirasi(k) >= 0 && eski(k, "kirpintilar"));
  const kartlar = () => store.kartlar.filter((k) => ornekKartSirasi(k) >= 0 && eski(k, "kartlar"));
  if (!kirpintilar().length && !kartlar().length) return;
  await yaziBekle();
  if (kirpintilar().length) {
    // Kesit kesit, her biri ayrı boş anda (yavaş tablette tek parça yarım saniyeyi bulur)
    const gorseller = await ornekKirpintiGorselleri(bosAn), liste = kirpintilar();
    for (const k of liste) { const i = ornekKirpintiSirasi(k); Object.assign(k, { gorsel: gorseller[i], ornekSira: i, ornekSurum: ORNEK_DEGISIM.kirpintilar }); }
    if (liste.length) bus.emit("kirpintilar", { tur: "ornek" });
  }
  if (kartlar().length) {
    await bosAn();
    const yeni = await ornekKartGorselleri().catch(() => []);
    for (const k of kartlar()) {
      // Örnek görüntü üretilemediyse (tekrar.js yedek soru kartına düştü) kart olduğu gibi kalır
      const y = yeni.find((x) => ornekKartSirasi(x) === ornekKartSirasi(k));
      if (y?.on?.gorsel) kartGuncelle(k.id, { on: y.on, arka: y.arka, bantY: y.bantY, bantH: y.bantH, ornekSurum: ORNEK_DEGISIM.kartlar });
    }
  }
}
function ornekleBasla() {
  ornekKirpintilar();
  ornekKartlar();
  ornekCizgiRoman();
}

// Örnek çizgi roman (9. tur): cizgi-ornek.js tuvalde çizer ve CBZ olarak paketler; dosyasıyla saklanır.
// Yeni kurulan örneklerde ve eski kayıtta bir kez (kayit.js ornekCizgi işareti); kullanıcı silerse geri gelmez.
// Üretim kalem yazarken beklemez ama boş bir anda başlar; cizgi-ornek.js yoksa bir dahaki açılışa kalır.
let ornekCizgiSuruyor = false;
async function ornekCizgiRoman() {
  if (ornekCizgiSuruyor || kayit.ornekCizgiVar() || kayit.baskaPencere()) return;
  ornekCizgiSuruyor = true;
  try {
    // Üretim ana iş parçacığında yaklaşık bir saniye sürer: açık bir belgede kalem yazarken başlamasın,
    // belge kapanınca (kitaplık, Tekrar, arama) yapılır
    while (acik.ekran === "belge") await new Promise((r) => setTimeout(r, 2000));
    await bosAn();
    const m = await import("./cizgi-ornek.js");
    const sonuc = await m.ornekCizgiRoman();
    const blob = sonuc instanceof Blob ? sonuc : sonuc?.blob || sonuc?.cbz || null;
    if (!blob) throw new Error("ornekCizgiRoman() CBZ vermedi");
    await bosAn();
    if (kayit.ornekCizgiVar()) return;
    await kayit.ornekCizgiEkle(blob, { alanlar: m.ORNEK_CIZGI || {} });
  } catch (hata) {
    console.warn("[kenar-notu] Örnek çizgi roman eklenemedi:", hata);
  } finally { ornekCizgiSuruyor = false; }
}
// Örnek belgeler, klasörler, kırpıntılar ve kartlar çıkar; o arada paylaşımla gelen dosya kalır
function bosBasla() {
  const kalan = store.belgeler.filter((b) => !ORNEK_IDLER.has(b.id));
  store.belgeler.splice(0, store.belgeler.length, ...kalan);
  KLASORLER.splice(0, KLASORLER.length);
  store.kirpintilar.splice(0, store.kirpintilar.length);
  store.kartlar.splice(0, store.kartlar.length);
  store.belgeler.unshift({
    id: yeniId("d"), tur: "defter", ad: ingilizceMi ? "First notebook" : "İlk defter", sayfaSayisi: 3, sayfa: 1, ilerleme: 0, favori: false,
    acilis: Date.now(), kapak: KAPAK_RENKLERI[0][1], kagit: "grid", veri: null,
  });
  // Boş başlayana örnek çizgi roman sonradan da eklenmez
  kayit.ornekCizgiAyarla(true);
  tercih.secim = "tumu";
  tercihKaydet();
}

function karsilamaAc() {
  kayit.kayitBeklet(true);
  K.ekran.inert = true;
  const secenek = (ikon, ad, aciklama, fn, birincil = false) => {
    const d = h("button", { class: "karsilama-secenek" + (birincil ? " birincil-secenek" : ""), type: "button" },
      icon(ikon), h("b", {}, ad), h("small", {}, aciklama), birincil ? h("span", { class: "onerilen" }, t("Önerilen")) : null);
    d.addEventListener("click", () => sec(fn));
    return d;
  };
  const ornek = secenek("tumu", t("Örneklerle başla"), t("Ders notları, kitaplar, defterler, bir çizgi roman ve kartlarla dolu bir masa. İstediğinde Ayarlar’dan temizlersin."), ornekleBasla, true);
  const bosD = secenek("yeni-defter", t("Boş başla"), t("Yalnız boş bir defter. Kendi PDF, EPUB ve CBZ dosyalarını içe aktarırsın."), () => {
    bosBasla();
    klasorlerCiz();
    // Klasör seçebilen tarayıcıda bilgisayardaki kitaplar da önerilir (seçici dokunuşla açılır)
    setTimeout(() => (kayit.klasorDestegi()
      ? toast(t("Boş bir defter hazır. Bilgisayardaki kitaplarını bir klasörden toplu alabilirsin."), { etiket: t("Klasör seç"), calistir: () => kitapKlasoruSec() })
      : toast(t("Boş bir defter hazır. Yeni düğmesinden PDF, EPUB ya da CBZ içe aktarabilirsin."))), 400);
  });
  // Alt satır platforma göre (TASARIM-4 1.2): telefonda çoğu kişinin kalemi yok, masaüstünde satır yok
  const ipucu = { spen: t("S Pen yazar, parmak kaydırır. Ayarlar’dan değişir."), pencil: t("Apple Pencil yazar, parmak kaydırır. Ayarlar’dan değişir."),
    kalem: t("Kalem yazar, parmak kaydırır. Ayarlar’dan değişir."), parmak: t("Parmağınla kaydır, kalem simgesiyle yaz.") }[kalemTuru()] || null;
  // TASARIM-3 6.1: logo vitrinde, altında tek cümle ve bir kenar notu satırı (edebiyat solda, bilim sağda)
  // Kart seçili görünmesin: odak pencerenin kendisine gider, halka yalnız klavyeyle gezince kartta çıkar
  // 7.0 (TASARIM-5 7.4): logo 64 px büyür, mürekkep izi bir kez soldan sağa çizilir; yalnız hareket serbestse
  const el = h("div", { class: "karsilama" + (hareketAz() ? "" : " ilk-acilis"), role: "dialog", "aria-modal": "true", "aria-labelledby": "karsilamaBaslik", tabindex: "-1" },
    h("div", { class: "karsilama__ic" },
      h("div", { class: "logo" }, parca(LOGO_SVG)),
      h("h1", { class: "t-vitrin", id: "karsilamaBaslik" }, "Kenar Notu"),
      h("p", {}, t("PDF, kitap ve defterlerin kalemle yazılan bir masada. Yazdıkların yalnız bu cihazda kalır.")),
      h("p", { class: "karsilama__kenar" }, h("i", {}, t("Kitabın kenarı, düşüncenin yeri."))),
      h("p", { class: "karsilama__tarih t-deger-k", title: t("Leibniz ∫ işaretini ilk kez 29 Ekim 1675’te yazdı") }, t("∫ 29.10.1675")),
      h("div", { class: "karsilama__secenekler" }, ornek, bosD),
      ipucu ? h("p", { class: "karsilama__ipucu" }, ipucu) : null));
  let secildi = false;
  async function sec(fn) {
    if (secildi) return;
    secildi = true;
    // Yeni kurulumda Yenilikler sheet'i çıkmaz: her şey zaten yeni
    ayarla({ yeniliklerSurum: YENILIK_SURUMU });
    try { fn(); } catch (hata) { console.error("[kenar-notu] Başlangıç:", hata); }
    K.ekran.inert = false;
    kitaplikKirli = true;
    kitaplikYenile();
    kayit.kayitBeklet(false);
    aramaDizininiBaslat();
    if (!hareketAz()) await bitince(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" }), 200);
    el.remove();
    ($(".belge a.kapak-sahne", K.sonuclar) || K.yeni)?.focus({ preventScroll: true });
    // Örneklerle başlayana üç kısa ipucu önerilir (Atla her an); iOS'ta sonra kurulum fişi
    if (fn === ornekleBasla) setTimeout(() => rehberDavet(), 700);
    else setTimeout(() => iosKurulumFisi(), 2500);
  }
  sahne.append(el);
  el.focus({ preventScroll: true });
}

// Arama modülü yüklenince arka plan dizinlemesi kendiliğinden başlar; ilk aramayı beklemesin diye boşta bir kez yüklenir
let aramaYuklendi = false;
function aramaDizininiBaslat() {
  if (aramaYuklendi) return;
  aramaYuklendi = true;
  const yukle = () => import("./arama.js").catch((hata) => console.warn("[kenar-notu] Arama dizini başlatılamadı:", hata));
  kayit.veriBekle().then(() => setTimeout(() => bosta(yukle, { timeout: 4000 }), 3000));
}

/* ================= Başlat ================= */
ayarlariUygula(true);
// Kayıtlı durum varsa örneklerin yerine geçer; yoksa karşılama sorar (ya da sıfırlamadan gelen istek)
const ilkDurum = await durumGeriYukle();
const baslangic = baslangicIstegi();
let karsilama = false;
// Belge verileri kitaplık çizildikten sonra gelir (kayit.js veriBekle). Bütün ekran geçişleri sıradan geçer;
// belge açılışı kendi verisini, Tekrar, İzlerim ve arama hepsini bekler. Sıranın ilk işi örnek belgeler:
// eski sürümün örnek verisi belge açılmadan yeni düzene geçer (öbür belgelerde yalnız yedekten kalan sürüm işareti
// silinir; verisi o an gelmemişse işaret bir dahaki açılışa kalır, zararsız). Örnek görüntüleri ondan sonra boş bir
// anda yeniden kesilir; kayıtta kart alanı hiç yoksa örnek kartlar bir kez istenir (sırayı bekletmez).
siraya(async () => {
  if (!ilkDurum.geri) return;
  await kayit.veriBekle(store.belgeler.filter((b) => !b.dosya && ORNEK_IDLER.has(b.id)).map((b) => b.id));
  try { ornekVeriyiTasi(ilkDurum.ornekSurum || 0); } catch (hata) { console.warn("[kenar-notu] Örnek veri taşınamadı:", hata); }
  setTimeout(() => ornekGorselleriTazele().catch((hata) => console.warn("[kenar-notu] Örnek görüntüler yenilenemedi:", hata)), 2000);
  if (!ilkDurum.kartlarVar) ornekKartlar();
});
if (ilkDurum.geri) {
  // 9. turun yeni örneği (çizgi roman) mevcut kitaplığa da bir kez girer; açılıştan sonra, boş bir anda
  if (!kayit.ornekCizgiVar()) setTimeout(ornekCizgiRoman, 4000);
} else if (ilkDurum.engel || baslangic === "ornek") ornekleBasla();
else if (baslangic === "bos") bosBasla();
else karsilama = true;
// Sıfırlamadan gelen başlangıç hemen kayda geçer (kullanıcı hiçbir şeye dokunmadan çıkarsa da)
if (!ilkDurum.geri && !ilkDurum.engel && baslangic) kayit.kaydetPlanla();
if (!GORUNUMLER.some((g) => g.id === tercih.secim) && !(tercih.secim.startsWith("klasor:") && klasorBul(tercih.secim.slice(7)))) tercih.secim = "tumu";
{
  const ilk = konumuOku();
  if (ilk.ekran === "kitaplik" && ilk.gorunum && (GORUNUMLER.some((g) => g.id === ilk.gorunum) || klasorBul(ilk.gorunum.slice(7)))) tercih.secim = ilk.gorunum;
  // Sekme çubuğu adresteki ekranla başlar (belge açılırken bir an görünmesin)
  kok.dataset.ekran = ilk.ekran;
  kitaplikKur({ gizli: (ilk.ekran === "belge" && !!belgeBul(ilk.belgeId)) || ilk.ekran === "tekrar" || ilk.ekran === "arama" || ilk.ekran === "izler" });
  if (ilk.ekran === "belge" && belgeBul(ilk.belgeId)) {
    // Sayfa yenilenince açık belge yeniden açılır; geri düğmesi kitaplığa döner
    K.ekran.hidden = true;
    history.replaceState({ ekran: "belge", belgeId: ilk.belgeId, itildi: false }, "", location.href);
    siraya(() => belgeyeGit(ilk.belgeId, { gecmis: null }));
  } else if (ilk.ekran === "tekrar") {
    K.ekran.hidden = true;
    history.replaceState({ ekran: "tekrar", itildi: false }, "", location.href);
    siraya(() => tekrarAc({ gecmis: null }));
  } else if (ilk.ekran === "arama") {
    // Altına kitaplık girdisi konur: aramadan açılan belgede "kitaplığa dön" ve geri hareketi kitaplığa ulaşır
    K.ekran.hidden = true;
    const adres = location.href;
    history.replaceState({ ekran: "kitaplik" }, "", location.pathname + location.search);
    history.pushState({ ekran: "arama", itildi: true, adim: 1 }, "", adres);
    siraya(() => aramaAc({ gecmis: null }));
  } else if (ilk.ekran === "izler") {
    // Arama gibi: altında kitaplık girdisi, geri hareketi kitaplığa döner
    K.ekran.hidden = true;
    const adres = location.href;
    history.replaceState({ ekran: "kitaplik" }, "", location.pathname + location.search);
    history.pushState({ ekran: "izler", itildi: true, adim: 1 }, "", adres);
    siraya(() => izlerAc({ gecmis: null }));
  } else {
    history.replaceState({ ekran: "kitaplik" }, "", location.pathname + location.search);
  }
  if (karsilama) {
    // Adreste belge ya da Tekrar varsa (paylaşılan bağlantı) örneklerle doğrudan açılır
    if (ilk.ekran === "kitaplik") karsilamaAc(); else { ornekleBasla(); aramaDizininiBaslat(); }
  }
}
// Asistan paneli kendi dinleyicilerini kurar ("sor" olayı); yüklenemezse uygulama yine çalışır
const asistanHazir = import("./asistan.js").then((m) => m.kur?.()).catch((hata) => console.warn("[kenar-notu] Asistan yüklenemedi:", hata));

// Kayıt açılamadıysa (eski sürüm başka sekmede açık) ya da okunamadıysa yazılanlar bu oturumda kalır
if (ilkDurum.baska) kayitUyarisi("baska");
else if (ilkDurum.engel) toast(ilkDurum.kod === "okuma"
  ? t("Kayıt okunamadı; bu oturumda yapılanlar saklanmaz. Sayfayı yenilemeyi dene.")
  : t("Kitaplık başka bir sekmede açık; kayıt için onu kapatıp yenile."), { kalici: true, etiket: t("Tamam") });
// Yedekten yüklenip yenilendiyse sonucu söyle
try {
  const y = JSON.parse(sessionStorage.getItem("kn-tasarim:yedek-sonuc") || "null");
  sessionStorage.removeItem("kn-tasarim:yedek-sonuc");
  const eksik = y?.eksik ? " " + t("Dosyası yedekte olmayan {n} belge alınmadı.", { n: y.eksik }) : "";
  if (y) toast((y.eklenen || y.guncellenen ? t("Yedek yüklendi: {eklenen} belge eklendi, {guncellenen} güncellendi.", { eklenen: y.eklenen, guncellenen: y.guncellenen }) : t("Yedek yüklendi; belgeler zaten güncel.")) + eksik);
} catch { /* gizli pencere */ }
// Karşılama açıksa seçim yapılınca başlar (silinecek örnekler dizinlenmesin)
if (!karsilama) aramaDizininiBaslat();
// iOS'ta Safari sekmesinde bir kez kurulum fişi
if (!karsilama) setTimeout(() => iosKurulumFisi(), 3000);
// 7.0'a ilk girişte bir kez Yenilikler (K9): kitaplık açıkken, başka pencere yokken
if (!karsilama && store.ayarlar.yeniliklerSurum !== YENILIK_SURUMU) {
  setTimeout(() => {
    if (acik.ekran && acik.ekran !== "kitaplik") return;
    if (document.querySelector("dialog[open], .alt-cekmece, .karsilama, .rehber-balon, .rehber-serit")) return;
    ayarla({ yeniliklerSurum: YENILIK_SURUMU });
    import("./hakkinda.js").then((m) => m.yeniliklerAc({ ilk: true })).catch(() => {});
  }, 1600);
}
// Testler ve konsol için küçük kanca (üretimde zararsız): görünüm, seçim, sheet'ler
window.__kn = { gorunumSec, secimKipi, kunye: (b) => b && kunyeAc(b), kisayollar: () => kisayollarAc(),
  yenilikler: () => import("./hakkinda.js").then((m) => m.yeniliklerAc({})), parolaSor };
// Yeni sürüm devreye girdi (sw.js skipWaiting ve claim): açık sayfa eski modüllerle kalır, sonradan yüklenen
// ekranlar eski ortak.js ile uyuşmaz. Kullanıcıya yenilemesi söylenir; yenilemeden önce her şey yazılır.
const ilkDenetci = navigator.serviceWorker?.controller;
navigator.serviceWorker?.addEventListener("controllerchange", () => { if (ilkDenetci) guncellemeVar(); });
// Hizmet çalışanı önbelleğe yazamadı (depo dolu): çevrimdışı açılış eksik kalabilir
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e.data?.tur === "kota") toast(t("Cihazda yer azaldı; çevrimdışı açılış eksik kalabilir. Yer aç ya da yedek al."), { etiket: t("Yedekle"), calistir: () => yedekPenceresi() });
});
// "Açılışta son belgeyle başla" (TASARIM-4 3.4): kitaplık geçmişte kalır, geri hareketi oraya döner
if (!karsilama && store.ayarlar.sonBelgeyleBasla && konumuOku().ekran === "kitaplik" && !location.hash) {
  const son = store.belgeler.reduce((m, b) => ((b.acilis || 0) > (m?.acilis || 0) ? b : m), null);
  if (son) belgeAcIstegi(son, null);
}
// Önceki turlarda alınmış EPUB'ların dili (çeviri düğmeleri için) boşta tamamlanır
setTimeout(eskiDilleriTamamla, 6000);
// Kitap klasörü (13. tur): kayıt varsa açılış yükü ve belge verileri bittikten sonra boş bir anda bakılır.
// İzin varsa sessizce taranır (yeni kitap varsa kitaplıkta fiş); izin yoksa istenmez, dokunuşla isteyen fiş çıkar.
if (!karsilama && kayit.klasorDestegi()) {
  kayit.veriBekle().then(() => setTimeout(() => bosta(async () => {
    const k = await kayit.kitapKlasoruOku();
    if (!k?.tutamac) return;
    kitapKlasoruAdi = k.tutamac.name;
    try { await (await kitapKlasoruModulu()).acilisTaramasi(); } catch (hata) { console.warn("[kenar-notu] Kitap klasörüne bakılamadı:", hata); }
  }, { timeout: 8000 }), 5000));
}
// İçe aktarırken kapağı çıkmamış belgeler sırayla tamamlanır (açılışı yavaşlatmadan)
setTimeout(async () => {
  for (const b of store.belgeler.filter((x) => x.dosya && !x.kapakGorsel && !x.kapakDenendi)) {
    try { await kayit.kapakTamamla(b); } catch { /* bir dahaki açılışa */ }
  }
}, 2500);
// Paylaş menüsüyle gelen dosya ya da metin (PWA); paylasim.js yoksa sessiz geçilir.
// Asistan önce kurulur: paylaşılan metin bekleyen soruya cevap olarak gidebilsin.
asistanHazir.then(() => kayit.veriBekle()).then(() => import("./paylasim.js")).then((m) => m.paylasimKontrol?.()).catch(() => {});
// Kurulu uygulamayla açılan dosya (manifest file_handlers; masaüstü Chrome): PDF, EPUB, CBZ kitaplığa alınır
if ("launchQueue" in window) {
  window.launchQueue.setConsumer(async (p) => {
    try {
      const dosyalar = await Promise.all((p?.files || []).map((f) => f.getFile()));
      const { belgeler, yedek } = await dosyalariAyir(dosyalar);
      if (yedek) yedekPenceresi(yedek);
      else if (belgeler.length) dosyalariAl(belgeler, { klasor: undefined });
    } catch (hata) { console.warn("[kenar-notu] Açılan dosya alınamadı:", hata); }
  });
}
// Ağ adresinden düz http ile açıldı (http://192.168...): hizmet çalışanı, paylaş menüsü ve pano yok.
// Uygulama çalışır; oturumda bir kez nedeni söylenir.
if (!window.isSecureContext) {
  let soylendi = false;
  try { soylendi = sessionStorage.getItem("kn:guvensiz") === "1"; sessionStorage.setItem("kn:guvensiz", "1"); } catch { /* yoksa her açılışta */ }
  if (!soylendi) setTimeout(() => toast(t("Güvenli bağlantı değil: çevrimdışı açılış ve paylaş menüsü kapalı. Tam sürüm için localhost ya da https ile aç.")), 1200);
}
