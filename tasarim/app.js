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
} from "./ortak.js";
import { altCekmece, cekmeceMi, gecmisYut, cekmeceleriKapat, cekmeceAcik } from "./cekmece.js";
import { rehberDavet, rehberBaslat, rehberKapat } from "./rehber.js";
import { PW, PH, PDF_PAGES, TEMPLATES } from "./sayfalar.js";
import * as SAYFALAR from "./sayfalar.js";
import * as kayit from "./kayit.js";

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
  if (kayit.baskaPencere()) { toast("Kitaplık başka bir pencerede açık. Sıfırlamak için o pencereyi kapatıp burayı yenile."); return; }
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

function ayarlariUygula(ilk = false) {
  const { tema, sadeHareket } = store.ayarlar;
  const oncekiKoyu = koyuMu();
  const yeni = tema === "acik" ? "light" : tema === "koyu" ? "dark" : "";
  if (!ilk && (kok.dataset.theme || "") !== yeni) {
    // Yalnız arayüz renkleri 240ms'de geçer, canvas'lar hariç
    kok.classList.add("tema-gecisi");
    clearTimeout(temaZaman);
    temaZaman = setTimeout(() => kok.classList.remove("tema-gecisi"), 300);
  }
  if (yeni) kok.dataset.theme = yeni; else delete kok.dataset.theme;
  if (sadeHareket) kok.dataset.hareket = "sade"; else delete kok.dataset.hareket;
  // Notlarda el yazısı kapalıysa notlar Caveat yerine düz yazıyla (3.2); bütün ekranlar CSS'ten okur
  if (store.ayarlar.elYazisi === false) kok.dataset.notYazi = "duz"; else delete kok.dataset.notYazi;
  yaziBoyutuUygula();
  temaRengi();
  if (!ilk && oncekiKoyu !== koyuMu()) bus.emit("tema", { koyu: koyuMu() });
  if (!ilk && !oncekiKoyu && koyuMu()) koyuOneri();
}
function temaRengi() { metaTema?.setAttribute("content", koyuMu() ? "#141413" : "#F7F5F0"); }

// Koyu temaya ilk geçişte bir kez: sayfa rengini de koyu yapmayı öner (3.25).
// Sayfa rengi "oto" ise Koltuk sayfası temayla zaten kararır, öneri gereksiz.
function koyuOneri() {
  const r = store.ayarlar.sayfaRengi || "oto";
  if (r === "koyu" || r === "oto" || depo.oku(ANAHTAR.koyuOneri)) return;
  depo.yaz(ANAHTAR.koyuOneri, true);
  toast("Gece için sayfa rengini Koyu yapabilirsin", { etiket: "Koyu yap", calistir: () => ayarla({ sayfaRengi: "koyu" }) });
}

// Sistem teması değişince: tema ayarı "oto" ise etkin tema da değişmiştir, sayfalar yeniden boyansın
koyuMedya.addEventListener("change", () => {
  temaRengi();
  if (!kok.dataset.theme) bus.emit("tema", { koyu: koyuMu() });
});
bus.on("ayarlar", () => {
  ayarlariUygula();
  ayarlariYaz();
  for (const d of ayarDenetimleri) d.guncelle();
});

/* ================= Bildirim (3.25) ================= */
const bildirimKabi = document.getElementById("bildirimler") || document.body.appendChild(h("div", { id: "bildirimler", "aria-live": "polite" }));
let bildirimKapat = null;

function bildirimGoster(metin, eylem) {
  bildirimKapat?.(true);
  const el = h("div", { class: "bildirim" }, h("span", {}, metin));
  let zaman = 0, bitti = false, eylemle = false;
  // eylem.kalici: kendiliğinden kapanmaz. eylem.kapaninca(eylemle): bildirim nasıl kapanırsa kapansın bir kez çağrılır
  const kapat = (hemen = false) => {
    if (bitti) return;
    bitti = true;
    clearTimeout(zaman);
    if (bildirimKapat === kapat) bildirimKapat = null;
    try { eylem?.kapaninca?.(eylemle); } catch (hata) { console.warn(hata); }
    if (hemen || hareketAz()) return el.remove();
    el.classList.add("gidiyor");
    setTimeout(() => el.remove(), 200);
  };
  if (eylem?.etiket) {
    el.append(h("button", { type: "button", onclick: () => { eylemle = true; kapat(true); eylem.calistir?.(); } }, eylem.etiket));
  }
  // Araç çubuğu alttaysa bildirim onun üstünde çıkar
  const altCubuk = $('[data-arac-konum="alt"]');
  if (altCubuk && altCubuk.getClientRects().length) el.classList.add("yukarida");
  const kur = () => { clearTimeout(zaman); if (!eylem?.kalici) zaman = setTimeout(kapat, eylem ? 6000 : 4000); };
  el.addEventListener("pointerenter", () => clearTimeout(zaman));
  el.addEventListener("pointerleave", kur);
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
  yazma: ["Kayıt yazılamadı; depo dolu olabilir. Kaybetmemek için yedek al.", "Yedek al", () => yedekPenceresi()],
  baska: ["Kenar Notu başka bir pencerede de açık. Burada yapılanlar kaydedilmez; o pencereyi kapatıp burayı yenile.", "Tamam", null],
  serbest: ["Öbür pencere kapandı. Kaydetmek için burayı yenile.", "Yenile", () => location.reload()],
  degisti: ["Kitaplık başka bir pencerede değişti; burada yapılanlar artık kaydedilmiyor. Yenile.", "Yenile", () => location.reload()],
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

// TASARIM-3 11: bordo karo, köşesi kıvrık yaprak, ölçü çentikli kenar çizgisi ve basınçlı mürekkeple ∫ (kimlikler kn- önekli)
const LOGO_SVG = `<svg viewBox="0 0 512 512" aria-hidden="true"><defs>
<linearGradient id="kn-z" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E2A38"/><stop offset="1" stop-color="#5A1520"/></linearGradient>
<linearGradient id="kn-k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF7EF"/><stop offset="1" stop-color="#F1E9DA"/></linearGradient>
<linearGradient id="kn-c" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#E4D8C2"/><stop offset="1" stop-color="#CDBD9F"/></linearGradient>
<filter id="kn-g" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#2A0A10" flood-opacity=".25"/><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#2A0A10" flood-opacity=".35"/></filter>
</defs><rect width="512" height="512" rx="112" fill="url(#kn-z)"/><g filter="url(#kn-g)">
<path d="M116 90Q116 80 126 80H326L396 150V422Q396 432 386 432H126Q116 432 116 422Z" fill="url(#kn-k)"/>
<path d="M326 80V138Q326 150 338 150H396Z" fill="url(#kn-c)"/>
<path d="M164 80V432" stroke="#A3313F" stroke-width="10"/>
<path d="M151 102h8M151 124h8M151 146h8M151 168h8M151 190h8M151 212h8M151 234h8M151 256h8M151 278h8M151 300h8M151 322h8M151 344h8M151 366h8M151 388h8M151 410h8" stroke="#A3313F" stroke-opacity=".6" stroke-width="3"/>
<g fill="#1B2A4A"><path d="M341.4 150.7L342.4 146.3L343 141.9L343.7 137.7L344.1 133.6L344.2 129.5L343.8 125.6L343.2 121.7L342.1 118.1L340.8 114.5L339.1 111.2L337 108L334.7 105.1L332 102.4L329.1 100L325.9 97.8L322.5 96L318.9 94.5L315.1 93.3L311.1 92.4L307 91.9L302.8 91.7L298.5 91.9L293.8 92.4L289.3 93.5L284.9 94.9L280.7 96.8L276.8 99.1L273.2 101.8L269.9 104.7L266.8 108L264 111.5L261.5 115.1L259.2 119L257.1 123L255.2 127.2L253.5 131.4L252 135.8L250.6 140.3L249.4 144.9L248.3 149.5L247.4 154.2L246.5 159L245.7 163.8L245 168.7L243.9 178.4L242.8 188.1L241.8 197.8L240.8 207.6L239.8 217.4L238.9 227.1L238 236.8L237.2 246.5L236.4 256L235.7 265.4L235 274.7L234.4 283.7L233.7 292.6L233.1 301.2L232.6 309.5L232 317.5L231.5 325.2L230.9 332.5L230.4 339.5L229.8 345.9L229.3 352L228.7 357.4L228.1 362L227.4 366.4L226.6 370.5L225.7 374.3L224.6 377.9L223.5 381.2L222.3 384.3L221 387.1L219.7 389.7L218.3 392L216.8 394.1L215.3 395.9L213.7 397.5L212.1 398.9L210.4 400.2L208.7 401.3L206.8 402.2L204.8 402.9L202.7 403.5L200.4 403.9L198 404L195.4 404L193 403.8L190.8 403.4L188.7 403L186.8 402.3L185.1 401.6L183.5 400.8L182.1 399.9L180.8 398.9L179.6 397.8L178.5 396.6L177.6 395.3L176.8 393.9L176 392.4L175.5 390.8L175 389.1L174.7 387.3L174.5 385.4L174.5 383.4L174.9 381.5L175.5 379.5L176.2 377.5L177.2 375.5A3.5 3.5 0 0 1 170.8 372.5L170.8 372.5L169.8 374.8L168.8 377.3L168.1 379.8L167.6 382.2L167 384.7L166.5 387.2L166.3 389.7L166.4 392.2L166.6 394.7L167.2 397.3L167.9 399.7L168.9 402.2L170.2 404.6L171.7 406.8L173.5 409L175.5 411.1L177.8 413L180.3 414.7L183.1 416.3L186 417.7L189.2 418.9L192.6 420L196.5 420.8L200.4 421.2L204.3 421.4L208.1 421.1L212 420.5L215.7 419.5L219.4 418.2L223 416.5L226.5 414.5L229.8 412.1L232.9 409.4L235.9 406.5L238.8 403.2L241.4 399.7L244 396L246.3 391.9L248.5 387.7L250.6 383.1L252.5 378.4L254.2 373.4L255.8 368.1L257.3 362.6L258.6 356.6L259.9 350.3L261.2 343.6L262.5 336.5L263.8 329L265 321.2L266.2 313.1L267.3 304.6L268.4 295.9L269.5 287L270.5 277.8L271.4 268.5L272.3 259L273.1 249.4L273.8 239.7L274.5 229.9L275.1 220L275.6 210.2L276 200.3L276.4 190.5L276.7 180.8L277 171.3L277.2 167L277.4 162.7L277.7 158.5L278.1 154.5L278.6 150.5L279.1 146.8L279.7 143.1L280.4 139.7L281.2 136.4L282.1 133.3L283.1 130.5L284.2 127.9L285.3 125.5L286.6 123.3L287.9 121.3L289.3 119.5L290.8 117.9L292.5 116.4L294.3 115.1L296.4 114L298.8 113L301.5 112.1L304.2 111.5L306.8 111.1L309.3 110.9L311.8 111L314.2 111.2L316.4 111.7L318.6 112.3L320.7 113.2L322.7 114.3L324.7 115.5L326.5 117L328.2 118.7L329.8 120.6L331.2 122.8L332.5 125.2L333.6 127.9L334.6 130.8L335.3 134L335.8 137.5L336 141.2L335.5 145.1L334.6 149.3A3.5 3.5 0 0 1 341.4 150.7Z"/><circle cx="333" cy="146" r="13"/><circle cx="179" cy="378" r="13"/></g>
</g></svg>`;
// ∫'nin doğum günü (TASARIM-3 nüans 5): 29 Ekim'de logonun altında tek satır kenar notu; kapatılınca o yıl çıkmaz
function ozelGunSatiri() {
  const t = new Date(), yil = t.getFullYear();
  if (t.getMonth() !== 9 || t.getDate() !== 29 || Number(store.ayarlar.ozelGun) === yil) return null;
  const el = h("p", { class: "ozel-gun t-aside" },
    h("span", {}, `Bugün ∫ ${yil - 1675} yaşında. Leibniz onu ilk kez 29 Ekim 1675’te bir notunda yazdı.`),
    h("button", { type: "button", "aria-label": "Kenar notunu kapat", onclick: () => { el.remove(); ayarla({ ozelGun: yil }); } }, icon("kapat", "i-16")));
  return el;
}
const ATAS_SVG = '<svg class="atas" viewBox="0 0 16 46" aria-hidden="true"><path d="M11 15v20a4.5 4.5 0 0 1-9 0V8a6 6 0 0 1 12 0v25" fill="none" stroke="url(#celik)" stroke-width="1.9" stroke-linecap="round"/></svg>';

// Göreli zaman: "az önce", "2 saat önce", "dün", "3 gün önce"
function neZaman(t) {
  const simdi = new Date(), fark = simdi - t;
  if (fark < 6e4) return "az önce";
  if (fark < 36e5) return `${Math.round(fark / 6e4)} dakika önce`;
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const gun = Math.ceil((bugun - t) / 864e5);
  if (gun <= 0) return `${Math.round(fark / 36e5)} saat önce`;
  if (gun === 1) return "dün";
  if (gun < 7) return `${gun} gün önce`;
  if (gun < 30) return `${Math.round(gun / 7)} hafta önce`;
  if (gun < 365) return `${Math.round(gun / 30)} ay önce`;
  return "bir yıldan uzun süre önce";
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
const kagitAdi = (id) => TEMPLATES.find((t) => t.id === id)?.label || "Boş";
const soyad = (yazar = "") => yazar.trim().split(/\s+/).pop() || "";
const klasorBul = (id) => KLASORLER.find((k) => k.id === id);
const turAdi = (b) => (cizgiMi(b) ? "Çizgi roman" : b.tur === "pdf" ? "PDF" : b.tur === "epub" ? "EPUB" : "Defter");
function ilerlemeOrani(b) {
  if (b.tur === "epub") return Math.min(1, b.ilerleme || 0);
  return b.sayfaSayisi ? Math.min(1, (b.sayfa || 1) / b.sayfaSayisi) : 0;
}
// Çizgi romanın künyesi: "Sayı 3" ya da "#3"; yoksa sayfa sayısı
const cizgiKunye = (b) => (b.sayi ? `Sayı ${b.sayi}` : `${b.sayfaSayisi || 1} sayfa`);
function etiketMetni(b) {
  if (cizgiMi(b)) return b.seri ? `${b.seri} · ${cizgiKunye(b)}` : `Çizgi roman · ${cizgiKunye(b)}`;
  if (b.tur === "pdf") return `PDF · ${b.sayfaSayisi} sayfa`;
  // EPUB'da türü bez cilt anlatır; dar hücrede yazarın adı kesilmesin diye yalnız soyadı
  if (b.tur === "epub") return soyad(b.yazar) || "EPUB";
  return `Defter · ${kagitAdi(b.kagit)}`;
}
function konumMetni(b) {
  if (b.tur === "epub") return `EPUB · %${Math.round(ilerlemeOrani(b) * 100)}`;
  return `${turAdi(b)} · s. ${b.sayfa || 1} / ${b.sayfaSayisi || 1}`;
}
// Tembel yüklenen ekran modülü açılamadı. SyntaxError: eksik dışa aktarım, yani sayfa eski sürümde kaldı
function modulHatasi(hata, metin) {
  if (hata instanceof SyntaxError) guncellemeVar();
  else toast(metin);
}
function guncellemeVar() {
  if (guncellemeVar.soylendi) return;
  guncellemeVar.soylendi = true;
  toast("Kenar Notu güncellendi. Yeni sürümü açmak için yenile.", {
    kalici: true, etiket: "Yenile",
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
  const kayit = { el, kapat, konumla, capa: capaEl };
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
  onayla(d, etiket, "Emin misin? Tekrar dokun", fn);
  return d;
}

// Uzun basma (500ms) ve sağ tık aynı bağlam fişini açar; uzun basıştan sonraki tıklama yutulur
function uzunBasma(el, ac) {
  let zaman = 0, x0 = 0, y0 = 0, tetik = false;
  const iptal = () => clearTimeout(zaman);
  el.addEventListener("pointerdown", (e) => {
    tetik = false;
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
    if (!tetik) { tetik = true; ac(); }
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

function kapakOlustur(b, { mini = false } = {}) {
  let el;
  if (cizgiMi(b)) {
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
        h("div", { class: "yazi" }, h("p", { class: "ad" }, b.ad), fleuron(), h("span", { class: "yazar" }, b.tur === "pdf" ? "PDF" : soyad(b.yazar))));
    }
  } else if (b.tur === "pdf") {
    el = h("div", { class: "kapak-pdf" }, h("div", { class: "yaprak" }, pdfKanvas(b.id, mini ? 72 : 200)));
    if (!mini) el.append(parca(ATAS_SVG));
  } else if (b.tur === "epub") {
    el = h("div", { class: "kapak-kitap", style: `--c:${b.kapak || ciltRengi(b.ad)}` });
    if (!mini) {
      el.append(h("div", { class: "cerceve" }),
        h("div", { class: "yazi" }, h("p", { class: "ad" }, b.ad), fleuron(), h("span", { class: "yazar" }, soyad(b.yazar))));
    }
  } else {
    const renk = KAPAK_RENKLERI.find(([, c]) => c.toLowerCase() === String(b.kapak).toLowerCase());
    el = h("div", { class: "kapak-defter" + (renk?.[2] ? " acik-renk" : ""), style: `--c:${b.kapak || KAPAK_RENKLERI[0][1]}` },
      h("div", { class: "etiket" }, h("b", {}, b.ad), h("small", {}, kagitAdi(b.kagit).toLocaleUpperCase("tr"))));
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
  { id: "tumu", ad: "Tümü", baslik: "Kitaplık", ikon: "tumu" },
  { id: "kitaplar", ad: "Kitaplar", ikon: "kitap" },
  { id: "defterler", ad: "Defterler", ikon: "defter" },
  { id: "cizgiler", ad: "Çizgi romanlar", ikon: "cizgi-roman" },
  { id: "favoriler", ad: "Favoriler", ikon: "yildiz" },
  { id: "kirpilanlar", ad: "Kırpılanlar", ikon: "kirp" },
];
const KLASOR_RENKLERI = ["#1F6B52", "#5F6B2A", "#1C6E7D", "#B8507A", "#7D1D2C", "#B5652B", "#2F4FA2"];

const tercih = Object.assign({ secim: "tumu", siralama: "son", duzen: "izgara" }, depo.oku(ANAHTAR.kitaplik) || {});
const tercihKaydet = () => depo.yaz(ANAHTAR.kitaplik, tercih);
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
  if (secim.startsWith("klasor:")) { const id = secim.slice(7); return (b) => b.klasor === id; }
  return () => true;
}
function sayilar() {
  const s = { tumu: store.belgeler.length, kitaplar: 0, defterler: 0, cizgiler: 0, favoriler: 0, kirpilanlar: store.kirpintilar.length };
  for (const b of store.belgeler) {
    if (b.tur === "defter") s.defterler++; else if (cizgiMi(b)) s.cizgiler++; else s.kitaplar++;
    if (b.favori) s.favoriler++;
    if (b.klasor) s["klasor:" + b.klasor] = (s["klasor:" + b.klasor] || 0) + 1;
  }
  return s;
}
function sirala(liste) {
  const l = [...liste];
  if (tercih.siralama === "ad") l.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  else l.sort((a, b) => (b.acilis || 0) - (a.acilis || 0));
  return l;
}
const eslesir = (metin, q) => katla(metin).includes(katla(q));

// gizli: açılış ekranı başka (adreste belge, Tekrar ya da arama). Kartlar ve kapaklar dönüşte çizilir (kitapligaDon)
function kitaplikKur({ gizli = false } = {}) {
  K.ekran = h("section", { class: "ekran ekran-kitaplik", "aria-label": "Kitaplık" });

  // Kenar çubuğu
  K.kenar = h("nav", { class: "kenar-cubugu", id: "kenar-cubugu", "aria-label": "Kitaplık bölümleri" });
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
  K.ayarlarDugme = h("button", { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, icon("ayarlar"), h("span", { class: "ad" }, "Ayarlar"));
  K.ayarlarDugme.addEventListener("click", () => ayarlarAc({ acan: K.ayarlarDugme }));
  // Tekrar girişi (TASARIM-2 3.3): logonun altında, bugün bekleyen kart sayısı yuvarlanan camda
  K.tekrarAlt = h("small");
  K.tekrarHaneler = [0, 1].map(() => h("i", { style: "--n:0" }, "0123456789"));
  K.tekrarCam = h("span", { class: "cam sayac soluk", "aria-hidden": "true" }, K.tekrarHaneler.map((i) => h("span", { class: "hane" }, i)));
  K.tekrar = h("a", { class: "tekrar-giris", href: "#tekrar" },
    icon("tekrar", "i-20"), h("span", {}, h("b", {}, "Tekrar"), K.tekrarAlt), K.tekrarCam);
  K.tekrar.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "tekrar" }); });
  // Her yerde ara (OZELLIKLER-4 §1.3): bütün belgelerin metni ve notları
  K.araGiris = h("a", { class: "ara-giris", href: "#arama", title: "Her yerde ara (Ctrl+K)" },
    icon("ara"), h("span", { class: "ad" }, "Ara"), h("kbd", { class: "kisayol", "aria-hidden": "true" }, "Ctrl K"));
  K.araGiris.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "arama", terim: arama.trim() || undefined }); });
  // İzlerim (OZELLIKLER-5): bütün kitaplarda kalemin değdiği yerler, cep defterleri ve derlemeler
  K.izlerGiris = h("a", { class: "izler-giris", href: "#izler" }, icon("izler"), h("span", { class: "ad" }, "İzlerim"));
  K.izlerGiris.addEventListener("click", (e) => { e.preventDefault(); bus.emit("git", { ekran: "izler" }); });
  K.kenar.append(
    h("div", { class: "kenar-cubugu__ic" },
      h("div", { class: "logo" }, parca(LOGO_SVG), h("b", {}, "Kenar Notu")),
      ozelGunSatiri(),
      K.tekrar,
      h("div", { class: "gezinme gezinme-ara" }, K.araGiris, K.izlerGiris),
      h("div", { class: "gezinme" }, GORUNUMLER.map((g) => navOgesi(g.id, icon(g.ikon), g.ad))),
      h("div", { class: "bolum-basi" },
        h("span", { class: "t-etiket" }, "Klasörler"),
        h("button", { type: "button", "aria-label": "Yeni klasör", onclick: yeniKlasor }, icon("arti", "i-20"))),
      K.klasorListe),
    h("div", { class: "kenar-cubugu__alt gezinme" },
      h("button", { type: "button", onclick: () => yedekPenceresi() }, icon("yedekle"), h("span", { class: "ad" }, "Yedekle")),
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
  K.menuDugme = h("button", { class: "ikon-dugme menu-dugme", type: "button", "aria-label": "Menü", "aria-controls": "kenar-cubugu", "aria-expanded": "false", onclick: cekmeceAc }, icon("menu"));
  K.baslik = h("h1", { class: "t-b1" });
  K.altBaslik = h("p");
  K.aramaGirdi = h("input", { type: "search", placeholder: "Kitaplıkta ara", "aria-label": "Kitaplıkta ara", enterkeyhint: "search", autocomplete: "off", spellcheck: "false" });
  K.aramaTemizle = h("button", { class: "arama-temizle", type: "button", "aria-label": "Aramayı temizle", hidden: true }, icon("kapat"));
  K.arama = h("label", { class: "arama" }, icon("ara"), K.aramaGirdi, K.aramaTemizle);
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

  const sirBtn = (deger) => {
    const d = h("button", { type: "button", "aria-pressed": "false" });
    d.addEventListener("click", () => { tercih.siralama = deger; tercihKaydet(); araclarGuncelle(); sonucCiz(true); });
    return d;
  };
  K.sirSon = sirBtn("son");
  K.sirAd = sirBtn("ad");
  K.siralama = h("div", { class: "siralama", role: "group", "aria-label": "Sıralama" }, K.sirSon, h("span", { "aria-hidden": "true" }, "·"), K.sirAd);

  const duzBtn = (deger, ad, ik) => {
    const d = h("button", { class: "ikon-dugme", type: "button", "aria-pressed": "false", "aria-label": ad }, icon(ik, "i-22"));
    d.addEventListener("click", () => { tercih.duzen = deger; tercihKaydet(); araclarGuncelle(); sonucCiz(true); });
    return d;
  };
  K.duzIzgara = duzBtn("izgara", "Izgara", "izgara");
  K.duzListe = duzBtn("liste", "Liste", "liste");
  K.duzen = h("div", { class: "gorunum-sec", role: "group", "aria-label": "Görünüm" }, K.duzIzgara, K.duzListe);

  K.yeni = h("button", { class: "birincil", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" }, icon("arti", "i-20"), "Yeni");
  K.yeni.addEventListener("click", (e) => yeniMenusu(e.detail === 0));
  // Telefonda ve rayda kenar çubuğu yok: Ayarlar başlığın sağında (TASARIM-4 2.4)
  K.basAyarlar = h("button", { class: "ikon-dugme baslik-ayarlar", type: "button", "aria-label": "Ayarlar", "aria-haspopup": "dialog" }, icon("ayarlar"));
  K.basAyarlar.addEventListener("click", () => ayarlarAc({ acan: K.basAyarlar }));
  // Kenar çubuğundaki süzgeçler ve klasörler dar ekranda başlığın altında çip satırı
  K.suzgec = h("div", { class: "suzgec-cipler", role: "group", "aria-label": "Kitaplık bölümleri" });

  K.sonuclar = h("div", { class: "sonuclar" });
  K.icerik = h("div", { class: "icerik" },
    h("div", { class: "icerik__ic" },
      h("div", { class: "baslik-satiri" },
        K.menuDugme,
        h("div", { class: "baslik-metin" }, K.baslik, K.altBaslik),
        K.basAyarlar,
        h("div", { class: "araclar" }, K.arama, K.siralama, K.duzen, K.yeni)),
      K.suzgec,
      h("div", { class: "oxford", "aria-hidden": "true" }),
      K.sonuclar));
  K.icerik.addEventListener("scroll", () => { if (aktifFis && !aktifFis.el.classList.contains("ayarlar-fis")) fisKapat(); }, { passive: true });

  // Masaüstünde dosya bırakma
  K.birak = h("div", { class: "birak", hidden: true, "aria-hidden": "true" }, "Bırak, kitaplığa ekleyelim.", fleuron());

  K.kok = h("div", { class: "kitaplik" }, K.kenar, K.perde, K.icerik, K.birak);
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
}

/* ---------- 11. tur: sekme çubuğu (telefon), ray (600 ile 999, yatay telefon), süzgeç çipleri ---------- */
const KABUK_SEKMELERI = [["kitaplik", "Kitaplık", "tumu", "#"], ["izler", "İzlerim", "izler", "#izler"], ["tekrar", "Tekrar", "tekrar", "#tekrar"], ["arama", "Ara", "ara", "#arama"]];
function gezinmeKur() {
  const oge = (yer) => KABUK_SEKMELERI.map(([id, ad, ik, href]) => {
    const rozet = id === "tekrar" ? h("b", { class: "sekme-rozet" }) : null;
    const a = h("a", { class: "sekme", href, dataset: { ekran: id }, title: yer === "ray" ? ad : null }, icon(ik), h("span", {}, ad), rozet);
    a.addEventListener("click", (e) => { e.preventDefault(); sekmeDokun(id); });
    return a;
  });
  K.sekmeCubugu = h("nav", { class: "sekme-cubugu", "aria-label": "Ana bölümler" }, oge("sekme"));
  const rayAyarlar = h("button", { class: "sekme ayarlar", type: "button", "aria-haspopup": "dialog", title: "Ayarlar" }, icon("ayarlar"), h("span", {}, "Ayarlar"));
  rayAyarlar.addEventListener("click", () => ayarlarAc({ acan: rayAyarlar }));
  K.ray = h("nav", { class: "ray", "aria-label": "Ana bölümler" }, h("div", { class: "logo", "aria-hidden": "true" }, parca(LOGO_SVG)), oge("ray"), rayAyarlar);
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
    if (bekleyen) r.setAttribute("aria-label", `${bekleyen} kart bekliyor`); else r.removeAttribute("aria-label");
  }
}
function suzgecCiz(s = sayilar()) {
  if (!K.suzgec) return;
  const ogeler = [...GORUNUMLER.map((g) => [g.id, g.ad, icon(g.ikon, "i-20")]),
    ...KLASORLER.map((k) => ["klasor:" + k.id, k.ad, h("i", { class: "kumas-sekme", style: `--c:${k.renk}` })])]
    .filter(([id]) => id !== "cizgiler" || s.cizgiler || tercih.secim === "cizgiler");
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
  const alt = n ? `${bekleyen} kart bekliyor` : store.kartlar.length ? "Bugünlük bitti" : "Henüz kart yok";
  K.tekrarAlt.textContent = alt;
  K.tekrar.setAttribute("aria-label", `Tekrar, ${alt.toLocaleLowerCase("tr")}`);
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
    if (!s.tumu) return { baslik: "Kitaplık", alt: "Masa henüz boş" };
    const cizgi = s.cizgiler ? `, ${s.cizgiler} çizgi roman` : "";
    return { baslik: "Kitaplık", alt: `${s.kitaplar} belge, ${s.defterler} defter${cizgi} · son açılan ${neZaman(enSon)}` };
  }
  if (tercih.secim === "kitaplar") {
    const pdf = store.belgeler.filter((b) => b.tur === "pdf" && !cizgiMi(b)).length, epub = s.kitaplar - pdf;
    const son = sirala(store.belgeler.filter(secimFiltresi("kitaplar")))[0];
    return { baslik: g.ad, alt: `${pdf} PDF, ${epub} EPUB` + (son ? ` · en son ${son.ad}` : "") };
  }
  if (tercih.secim === "cizgiler") {
    const seri = new Set(store.belgeler.filter(cizgiMi).map((b) => b.seri).filter(Boolean)).size;
    return { baslik: g.ad, alt: s.cizgiler ? `${s.cizgiler} sayı` + (seri ? `, ${seri} seri` : "") : "Raf boş" };
  }
  if (tercih.secim === "defterler") {
    const sayfa = store.belgeler.filter((b) => b.tur === "defter").reduce((t, b) => t + (b.sayfaSayisi || 0), 0);
    return { baslik: g.ad, alt: s.defterler ? `${s.defterler} defter, toplam ${sayfa} sayfa` : "Henüz defter yok" };
  }
  if (tercih.secim === "favoriler") return { baslik: g.ad, alt: s.favoriler ? `${s.favoriler} belge kurdeleli` : "Kurdeleli belge yok" };
  if (tercih.secim === "kirpilanlar") {
    const kaynak = new Set(store.kirpintilar.map((k) => k.belgeId)).size;
    return { baslik: g.ad, alt: s.kirpilanlar ? `${s.kirpilanlar} kırpıntı, ${kaynak} belgeden` : "Pano boş" };
  }
  const klasor = klasorBul(tercih.secim.slice(7));
  const icinde = store.belgeler.filter(secimFiltresi(tercih.secim));
  const defter = icinde.filter((b) => b.tur === "defter").length;
  return { baslik: klasor?.ad || "Klasör", alt: icinde.length ? `${icinde.length - defter} belge, ${defter} defter` : "Klasör boş" };
}

function baslikGuncelle() {
  const { baslik, alt } = gorunumBilgisi();
  K.baslik.textContent = baslik;
  K.altBaslik.textContent = alt;
  if (!K.ekran.hidden) document.title = tercih.secim === "tumu" ? "Kenar Notu" : `${baslik} · Kenar Notu`;
}

function araclarGuncelle() {
  const pano = tercih.secim === "kirpilanlar";
  K.sirSon.textContent = pano ? "En yeni" : "Son açılan";
  K.sirAd.textContent = pano ? "Belge" : "Ad";
  K.sirSon.setAttribute("aria-pressed", String(tercih.siralama !== "ad"));
  K.sirAd.setAttribute("aria-pressed", String(tercih.siralama === "ad"));
  K.duzen.hidden = pano;
  K.duzIzgara.setAttribute("aria-pressed", String(tercih.duzen !== "liste"));
  K.duzListe.setAttribute("aria-pressed", String(tercih.duzen === "liste"));
  K.aramaGirdi.placeholder = pano ? "Kırpıntılarda ara" : "Kitaplıkta ara";
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

function gorunumSec(secim) {
  fisKapat(true);
  if (tercih.secim !== secim) { tercih.secim = secim; tercihKaydet(); }
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
    h("span", {}, "Her yerde ara: ", h("b", {}, `“${q}”`), h("small", {}, "Sayfa metinleri, notlar, kartlar")),
    h("kbd", { class: "kisayol", "aria-hidden": "true" }, "Enter"));
  d.addEventListener("click", () => herYerdeAra(q));
  return d;
}

function sonucCiz(gel = false) {
  const q = arama.trim();
  K.sonuclar.replaceChildren(...(q ? [herYerdeSatiri(q)] : []), tercih.secim === "kirpilanlar" ? panoCiz() : belgelerCiz());
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
const DOSYA_AC = { etiket: "Dosya aç", ikon: "pdf", calistir: () => dosyaSec() };
const YENI_DEFTER = { etiket: "Yeni defter", calistir: () => yeniDefterPenceresi() };
function bolumBaslik(ad, sayi, ek = "") {
  return h("h2", { class: `bolum-baslik t-b2 ${ek}`.trim() }, ad, sayi != null ? h("span", { class: "t-eski" }, String(sayi)) : null);
}

function belgelerCiz() {
  const f = document.createDocumentFragment();
  const q = arama.trim();
  // İçe aktarılan dosyaların dizgi kartları gideceği rafta yer tutar (aramada görünmez)
  const kume = [...(q ? [] : dizgiler), ...store.belgeler].filter(secimFiltresi(tercih.secim));
  const liste = sirala(q ? kume.filter((b) => eslesir(`${b.ad} ${b.yazar || ""}`, q)) : kume);

  if (!store.belgeler.length && !dizgiler.length) return bos("tumu", "Masan boş.", `Bir PDF, EPUB ya da çizgi roman aç, ya da boş bir defterle başla. ${dosyaIpucu()}`, DOSYA_AC, YENI_DEFTER);
  if (q && !liste.length) return bos("ara", `“${q}” bu kitaplıkta yok.`, "Kitapların içinde de aranabilir.", { etiket: "Her yerde ara", ikon: "ara", calistir: () => herYerdeAra(q) });
  if (!liste.length) {
    if (tercih.secim === "favoriler") return bos("yildiz", "Favori yok.", "Bir kapağın altındaki yıldıza dokun.", { etiket: "Tümünü göster", calistir: () => gorunumSec("tumu") });
    if (tercih.secim === "defterler") return bos("defter", "Henüz defter yok.", "Çizgili, kareli, noktalı ya da Cornell kâğıdı seç.", YENI_DEFTER);
    if (tercih.secim === "kitaplar") return bos("kitap", "Rafta kitap yok.", "EPUB ya da PDF kitaplarını buraya ekleyebilirsin.", DOSYA_AC);
    if (tercih.secim === "cizgiler") return bos("cizgi-roman", "Çizgi roman rafı boş.", "CBZ dosyası aç; telefonda kare kare okunur. Bir PDF de menüsünden çizgi roman olarak okunur.", DOSYA_AC);
    return bos("klasor", "Bu klasör boş.", "Bir kapağı uzun basıp Klasöre taşı’yı seçebilirsin.", { etiket: "Tümünü göster", calistir: () => gorunumSec("tumu") });
  }

  if (q) {
    f.append(bolumBaslik(`“${q}” için sonuçlar`, liste.length), belgeKumesi(liste));
  } else if (tercih.secim === "favoriler") {
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
      bolumUst("cizgi-b", "Çizgi roman rafı", "", `${liste.length} sayı`), belgeKumesi(liste));
  }
  const raf = h("div", { class: "cizgi-raf", role: "list", "aria-label": "Çizgi roman rafı" }, liste.map(cizgiOge), h("div", { class: "cizgi-raf-bos", "aria-hidden": "true" }));
  return h("section", { class: "cizgi-bolum", "aria-labelledby": "cizgi-b" },
    bolumUst("cizgi-b", "Çizgi roman rafı", "", `${liste.length} sayı`), raf);
}
function cizgiOge(b) {
  if (b.dizgi) return h("div", { class: "cizgi-oge dizgi", role: "listitem", "aria-busy": "true", dataset: { id: b.id } },
    h("div", { class: "kapak" }, dizgiKapak(b)), h("span", { class: "etiket" }, "Dizgide"), h("div", { class: "ad" }, b.ad));
  const kapak = kapakOlustur(b);
  // Okunmakta olan sayı: poşetin sağ üst köşesinde bordo kurdele ucu
  const okunuyor = (b.sayfa || 1) > 1 && (b.sayfa || 1) < (b.sayfaSayisi || 1);
  const bag = h("a", { class: "kapak" + (okunuyor ? " okunuyor" : ""), href: `#belge/${b.id}`, draggable: "false", "aria-label": `${b.ad}, ${konumMetni(b)}, aç` }, kapak);
  bag.addEventListener("click", (e) => { e.preventDefault(); belgeAcIstegi(b, kapak); });
  uzunBasma(bag, () => belgeFisi(b, kapak));
  return h("div", { class: "cizgi-oge belge", role: "listitem", dataset: { id: b.id } },
    bag,
    h("span", { class: "etiket" }, b.sayi ? `#${b.sayi}` : `${b.sayfaSayisi || 1} s.`),
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
    : h("div", { class: "raf-kap" }, h("div", { class: "raf", role: "list", "aria-label": "Okuma rafı" }, liste.map((b) => belgeHucre(b, "raf-oge"))));
  return h("section", { class: "raf-bolum", "aria-labelledby": "raf-b" },
    bolumUst("raf-b", "Okuma rafı", "Raf I · Koltuk", `${liste.length} ${kitap ? "kitap" : "belge"}`), govde);
}

// Çalışma masası: ders (klasör) başına kareli şerit, altında ızgara; klasörsüzler en sonda
function masaCiz(liste) {
  const gruplar = KLASORLER.map((k) => [k, liste.filter((b) => b.klasor === k.id)]).filter(([, l]) => l.length);
  const klasorsuz = liste.filter((b) => !klasorBul(b.klasor));
  if (klasorsuz.length) gruplar.push([null, klasorsuz]);
  return h("section", { class: "masa-bolum", "aria-labelledby": "masa-b" },
    bolumUst("masa-b", "Çalışma masası", "Raf II · Masa", `${liste.length} belge`),
    gruplar.map(([k, l]) => dersCiz(k, l)));
}

function dersCiz(klasor, liste) {
  const idler = new Set(liste.map((b) => b.id));
  const kart = store.kartlar.filter((c) => idler.has(c.belgeId)).length;
  const serit = h("div", { class: "ders-serit kareli" + (klasor ? "" : " klasorsuz") },
    klasor ? h("i", { class: "kumas-sekme", style: `--c:${klasor.renk}`, "aria-hidden": "true" }) : null,
    h("h3", {}, klasor ? klasor.ad : "Klasörsüz"),
    h("span", { class: "t-deger-k" }, `${liste.length} belge · ${kart} kart`));
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
    const a = h("a", { href: `#belge/${b.id}`, draggable: "false", "aria-label": `${b.ad}, ${konumMetni(b)}, kaldığın yerden aç` },
      h("div", { class: "mini kapak-sahne" }, kapak),
      h("div", {}, h("div", { class: "ad" }, b.ad), h("div", { class: "meta" }, konumMetni(b))),
      h("div", { class: "ilerleme", "aria-hidden": "true" }, h("i", { style: `--p:${(ilerlemeOrani(b) * 100).toFixed(1)}%` })));
    a.addEventListener("click", (e) => { e.preventDefault(); belgeAcIstegi(b, kapak); });
    uzunBasma(a, () => belgeFisi(b, kapak));
    kap.append(a);
  }
  return h("section", { class: "kaldigin-bolum", "aria-labelledby": "kaldiginBaslik" }, h("h2", { class: "bolum-baslik t-b2", id: "kaldiginBaslik" }, "Kaldığın yerden"), kap);
}

function belgeHucre(b, ekSinif = "") {
  if (b.dizgi) return dizgiHucre(b, ekSinif);
  const kapak = kapakOlustur(b);
  const sahneEl = h("a", { class: "kapak-sahne", href: `#belge/${b.id}`, draggable: "false", "aria-label": `${b.ad}, aç` }, kapak);
  sahneEl.addEventListener("click", (e) => { e.preventDefault(); belgeAcIstegi(b, kapak); });
  uzunBasma(sahneEl, () => belgeFisi(b, kapak));
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
    ? `Bitti · ${new Date(o.bitti).toLocaleDateString("tr", { day: "2-digit", month: "2-digit" })}`
    : `${o.gun} gün · ${sureMetni(o.saniye)}`;
  return h("p", { class: "odunc-sayac", title: o.gun ? `${o.gun} gün okundu, toplam ${sureMetni(o.saniye)}` : null }, metin);
}

function belgeSatir(b) {
  if (b.dizgi) return dizgiSatir(b);
  const kapak = kapakOlustur(b, { mini: true });
  const bag = h("a", { class: "satir-bag", href: `#belge/${b.id}`, draggable: "false", "aria-label": `${b.ad}, aç` });
  bag.addEventListener("click", (e) => { e.preventDefault(); belgeAcIstegi(b, kapak); });
  uzunBasma(bag, () => belgeFisi(b, kapak));
  const klasor = klasorBul(b.klasor);
  const q = arama.trim();
  const altEslesme = q && b.yazar && !eslesir(b.ad, q) && eslesir(b.yazar, q);
  return h("div", { class: "belge-satir", role: "listitem", dataset: { id: b.id } },
    h("div", { class: "mini kapak-sahne" }, kapak),
    h("div", { style: "min-width:0" },
      h("div", { class: "ad" }, vurgula(b.ad, arama)),
      h("div", { class: "t-kucuk" }, konumMetni(b) + (klasor ? ` · ${klasor.ad}` : ""), altEslesme ? [" · ", vurgula(b.yazar, arama)] : null)),
    h("span", { class: "ne-zaman" }, b.acilis ? `${neZaman(b.acilis)} açıldı` : "henüz açılmadı"),
    yildizDugme(b),
    bag);
}

function yildizDugme(b) {
  const d = h("button", { class: "yildiz", type: "button", "aria-pressed": String(!!b.favori), "aria-label": b.favori ? "Favorilerden çıkar" : "Favorilere ekle" }, icon("yildiz"));
  d.addEventListener("click", () => favoriDegistir(b, d));
  return d;
}

function favoriDegistir(b, dugme) {
  b.favori = !b.favori;
  sessiz = true;
  try { bus.emit("belgeler", { tur: "favori", id: b.id }); } finally { sessiz = false; }
  if (tercih.secim === "favoriler") {
    kitaplikYenile();
    if (!b.favori) toast("Favorilerden çıkarıldı", { etiket: "Geri al", calistir: () => favoriDegistir(b) });
    return;
  }
  // Yerinde güncelle: yıldız dolar, kurdele kapağın üstünden sarkar
  for (const satir of $$(`[data-id="${CSS.escape(b.id)}"]`, K.sonuclar)) {
    const y = $(".yildiz", satir);
    if (y) {
      y.setAttribute("aria-pressed", String(b.favori));
      y.setAttribute("aria-label", b.favori ? "Favorilerden çıkar" : "Favorilere ekle");
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

/* ---------- Bağlam fişi: belge ---------- */
function belgeFisi(b, capa) {
  const icerik = h("div");
  const anaMenu = () => {
    const klasor = klasorBul(b.klasor);
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, b.ad),
      fisSatir("yildiz", b.favori ? "Favorilerden çıkar" : "Favorilere ekle", null, () => { fisKapat(); favoriDegistir(b); }),
      fisSatir("metin", "Yeniden adlandır", null, adlandir),
      fisSatir("klasor", "Klasöre taşı", klasor ? `Şu an: ${klasor.ad}` : "Klasörsüz", klasorSec),
      // Kitabın dili (OZELLIKLER-6 §2): çeviri düğmeleri hedef dilden farklıysa görünür
      ...(dilDestekli(b) ? [fisSatir("ceviri", "Kitabın dili", dilOzet(b), dilSec)] : []),
      // Cep defteri: altı çizilen, yuvarlak içine alınan ve kenarına işaret konan yerler (OZELLIKLER-5)
      fisSatir("izler", "Cep defteri", "Kalemin değdiği yerler", () => { fisKapat(true); bus.emit("defter:ac", { belgeId: b.id }); }),
      // Bir PDF çizgi roman olarak da okunabilir: sayfa sayfa, panel panel (cizgi.js)
      // replaceChildren null'u "null" yazısına çevirir: satır yoksa hiç eklenmez
      ...(b.tur === "pdf" && b.dosya ? [fisSatir("cizgi-roman", b.cizgi ? "Belge olarak oku" : "Çizgi roman olarak oku",
        b.cizgi ? "Masa ve Koltuk’ta açılır" : "Sayfa ve panel görünümü, karanlık zemin", () => cizgiDegistir(b))] : []),
      // Belge değiştikçe günde bir kez saklanan önceki hâller (OZELLIKLER-8 §3.2)
      fisSatir("geri-al", "Önceki hâline dön", "Son 7 günün kayıtları", oncekiSec),
      h("div", { class: "fis-ayrac" }),
      silSatiri("Sil", () => { fisKapat(true); belgeSil(b); }));
  };
  const oncekiSec = async () => {
    const baslik = h("div", { class: "fis-baslik" }, "Önceki hâline dön");
    icerik.replaceChildren(baslik, h("p", { class: "onceki-not" }, "Bakılıyor"));
    aktifFis?.konumla();
    const { liste, buyuk } = await kayit.oncekiHaller(b.id);
    if (!icerik.isConnected) return;
    const satirlar = liste.map((g) => h("button", { class: "fis-satir onceki-satir", type: "button", role: "menuitem", onclick: () => oncekiyeDon(b, g) },
      icon(g.donus ? "geri-al" : "kronometre", "i-20"), h("span", {}, oncekiTarih(g)),
      h("small", {}, (g.donus ? "Dönmeden önceki hâl · " : "") + oncekiOzet(g.ozet))));
    icerik.replaceChildren(baslik,
      ...(satirlar.length ? satirlar : [h("p", { class: "onceki-not" }, "Henüz önceki hâl yok. Belge değiştikçe günde bir kez saklanır.")]),
      ...(buyuk ? [h("p", { class: "onceki-not" }, "Belge çok büyük; yeni önceki hâller saklanmıyor.")] : []),
      h("div", { class: "fis-ayrac" }),
      h("button", { class: "fis-satir", type: "button", role: "menuitem", onclick: () => { anaMenu(); aktifFis?.konumla(); } }, icon("sol", "i-20"), h("span", {}, "Geri")));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
  };
  const adlandir = () => {
    const girdi = h("input", { class: "ad-alani kucuk", value: b.ad, "aria-label": "Belgenin yeni adı", maxlength: "120", autocomplete: "off", enterkeyhint: "done" });
    const form = h("form", { class: "fis-form" },
      h("span", { class: "t-etiket" }, "Yeni ad"), girdi,
      h("div", { class: "fis-form-alt" },
        h("button", { class: "metin-dugme", type: "button", onclick: () => { anaMenu(); aktifFis?.konumla(); } }, "Vazgeç"),
        h("button", { class: "metin-dugme vurgulu", type: "submit" }, "Kaydet")));
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
      toast(id ? `${klasorBul(id).ad} klasörüne taşındı` : "Klasörden çıkarıldı");
    };
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, "Klasöre taşı"),
      ...KLASORLER.map((k) => secenekSatir(h("i", { class: "kumas-sekme", style: `--c:${k.renk}` }), k.ad, b.klasor === k.id, () => tasi(k.id))),
      h("div", { class: "fis-ayrac" }),
      secenekSatir(icon("kapat", "i-20"), "Klasörsüz", !b.klasor, () => tasi(undefined)));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
  };
  const dilSec = () => {
    const otoAlt = h("small", {}, b.dilElle ? "Metinden bulunur" : b.dil ? `Bulunan: ${dilAdi(b.dil)}` : b.dil === null ? "Bulunamadı" : "Bakılıyor");
    const sec = (kod) => { fisKapat(); dilAyarla(b, kod); };
    const oto = h("button", { class: "fis-satir secenek", type: "button", role: "menuitemradio", "aria-checked": String(!b.dilElle), onclick: () => sec("oto") },
      icon("tema-oto", "i-20"), h("span", {}, "Otomatik", otoAlt), !b.dilElle ? icon("tik", "i-20") : h("span"));
    const listede = KITAP_DILLERI.includes(b.dil) || !b.dil ? KITAP_DILLERI : [b.dil, ...KITAP_DILLERI];
    icerik.replaceChildren(
      h("div", { class: "fis-baslik" }, "Kitabın dili"),
      oto,
      h("div", { class: "fis-ayrac" }),
      ...listede.map((k) => secenekSatir(h("span", { class: "dil-kod" }, anaDil(k).toUpperCase()), dilAdi(k), !!b.dilElle && b.dil === k, () => sec(k))));
    aktifFis?.konumla();
    $("button", icerik)?.focus();
    // Daha bakılmadıysa şimdi bakılır; menü açıkken sonuç alt satıra yazılır
    if (!b.dilElle && b.dil === undefined) dilBak(b).then((dil) => { if (otoAlt.isConnected) otoAlt.textContent = dil ? `Bulunan: ${dilAdi(dil)}` : "Bulunamadı"; });
  };
  anaMenu();
  fisAc(capa, icerik, { hiza: "yan", etiket: `${b.ad} seçenekleri` });
}

// Önceki hâl satırı: o hâlin son değiştiği an (bilinmiyorsa kopyanın alındığı günden önce) ve kısa özet
function oncekiTarih(g) {
  if (g.zaman) return new Date(g.zaman).toLocaleString("tr", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return `${new Date(g.alindi).toLocaleDateString("tr", { day: "numeric", month: "long" })} öncesi`;
}
const oncekiOzet = (o) => [o?.sayfa ? `${o.sayfa} sayfa` : null, `${o?.cizgi || 0} çizgi`, `${o?.iz || 0} iz`].filter(Boolean).join(" · ");
// Seçilen hâle döner: şimdiki hâl de önceki hâller listesine girer (aynı menüden ona dönülür), belge yeniden açılır
async function oncekiyeDon(b, g) {
  fisKapat(true);
  const yan = window.__knYan;
  if ((acik.ekran === "belge" && acik.belgeId === b.id) || (yan?.belgeId === b.id && yan.cerceve?.isConnected)) { toast("Önce belgeyi kapat."); return; }
  try {
    const donus = await kayit.oncekiHaleDon(b.id, g.anahtar);
    toast(`“${b.ad}” ${oncekiTarih(g)} hâline döndü.${donus ? " Şimdiki hâli de saklandı." : ""}`);
    belgeAcIstegi(b, kapakBul(b.id));
  } catch (hata) {
    console.warn("[kenar-notu] Önceki hâle dönülemedi:", hata);
    toast(hata?.kod === "kilit" ? "Kayıt bu pencerede kapalı; dönülemedi." : "Önceki hâline dönülemedi; belge değişmedi.");
  }
}

// "Çizgi roman olarak oku": belge.cizgi kaydedilir ve belge yeni görünümünde açılır; geri dönmek aynı satırdan
function cizgiDegistir(b) {
  fisKapat(true);
  if (b.cizgi) delete b.cizgi; else b.cizgi = true;
  bus.emit("belgeler", { tur: "cizgi", id: b.id });
  if (b.cizgi) belgeAcIstegi(b, kapakBul(b.id));
  else toast(`“${b.ad}” yeniden belge olarak açılacak`);
}

// Belgenin kartları da gider; dosyası, verisi ve ekleri bildirim geri alınmadan kapanınca kayit.js'te silinir
// (bildirim üstünde beklenirken süre durur; geri alınan belgenin dosyası yerinde kalmalı)
function belgeSil(b) {
  const i = store.belgeler.indexOf(b);
  if (i < 0) return;
  store.belgeler.splice(i, 1);
  const kartlariGeri = kayit.belgeKartlariniKaldir(b.id);
  bus.emit("belgeler", { tur: "sil", id: b.id });
  toast(`“${b.ad}” silindi`, {
    etiket: "Geri al",
    calistir: () => {
      store.belgeler.splice(Math.min(i, store.belgeler.length), 0, b);
      bus.emit("belgeler", { tur: "ekle", belge: b });
      kartlariGeri();
    },
    kapaninca: (geriAlindi) => { if (!geriAlindi) kayit.silinmisBelgeyiTemizle(b.id); },
  });
}

/* ---------- Kırpılanlar panosu (3.7) ---------- */
function panoCiz() {
  const q = arama.trim();
  if (!store.kirpintilar.length) {
    const pdf = sirala(store.belgeler.filter((b) => b.tur === "pdf" && !cizgiMi(b)))[0];
    return bos("kirp", "Kırpılmış bir şey yok.", "Masa’da Kırp aracıyla bir bölge seç, buraya düşer.", pdf ? { etiket: "Masa’ya git", calistir: () => bus.emit("git", { ekran: "belge", belgeId: pdf.id, mod: "masa" }) } : null);
  }
  let liste = q ? store.kirpintilar.filter((k) => eslesir(`${k.not} ${k.metin || ""} ${k.belgeAd}`, q)) : [...store.kirpintilar];
  if (!liste.length) return bos("ara", `“${q}” için sonuç yok.`, "Kırpıntılarda yok. Yukarıdan bütün kitaplıkta ara.");
  if (tercih.siralama === "ad") liste.sort((a, b) => a.belgeAd.localeCompare(b.belgeAd, "tr") || a.sayfa - b.sayfa);
  else liste.sort((a, b) => b.zaman - a.zaman);
  return h("div", { class: "pano", role: "list" }, liste.map(kirpintiKart));
}

// Paylaş menüsünden gelen görüntü ve not bir belgeye bağlı değil (belgeId boş): sayfa yazılmaz, dokununca büyür
const sayfaEki = (k) => (k.belgeId ? ` · s. ${k.sayfa}` : "");
function kirpintiKart(k) {
  const baski = h("button", { class: "kirpinti-baski", type: "button", "aria-label": k.belgeId ? `${k.belgeAd}, s. ${k.sayfa}: belgede göster` : `${k.belgeAd}: büyüt` },
    h("img", { src: k.gorsel, alt: k.belgeId ? `${k.belgeAd}, sayfa ${k.sayfa} kırpıntısı` : `${k.belgeAd} kırpıntısı`, draggable: "false" }));
  const altyazi = h("figcaption");
  const not = notAlani(k, altyazi);
  const daha = h("button", { class: "kirpinti-daha", type: "button", "aria-label": "Kırpıntı seçenekleri", "aria-haspopup": "menu" }, icon("daha"));
  const kart = h("div", { class: "kirpinti", role: "listitem", dataset: { id: k.id } },
    h("figure", {}, baski, altyazi),
    // Uzun ad kısalır, sayfa numarası her zaman okunur
    h("div", { class: "kaynak" }, h("span", {}, k.belgeAd), k.belgeId ? h("b", {}, `· s. ${k.sayfa}`) : null, daha));
  baski.addEventListener("click", () => kirpintiAc(k));
  uzunBasma(baski, () => kirpintiFisi(k, baski, kart, not));
  daha.addEventListener("click", () => kirpintiFisi(k, daha, kart, not));
  return kart;
}

// Not satırı: dokununca yerinde düzenlenir, Enter ya da dışarı dokunmak kaydeder
function notAlani(k, altyazi) {
  const goster = () => {
    const d = h("button", { class: "not-yaz" + (k.not ? "" : " bos-not"), type: "button", "aria-label": k.not ? `Notu düzenle: ${k.not}` : "Not ekle" },
      k.not ? vurgula(k.not, arama) : "not ekle");
    d.addEventListener("click", duzenle);
    altyazi.replaceChildren(d);
  };
  const duzenle = () => {
    const t = h("textarea", { class: "not-girdi", rows: "1", maxlength: "240", "aria-label": "Kırpıntı notu", placeholder: "not ekle" });
    t.value = k.not || "";
    let vazgec = false;
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); t.blur(); }
      else if (e.key === "Escape") { e.stopPropagation(); vazgec = true; t.blur(); }
    });
    t.addEventListener("blur", () => {
      const yeni = t.value.trim();
      if (!vazgec && yeni !== (k.not || "")) {
        k.not = yeni;
        sessiz = true;
        try { bus.emit("kirpintilar", { tur: "not", id: k.id }); } finally { sessiz = false; }
      }
      goster();
    });
    // field-sizing olmayan Safari'de (17, 26.2 öncesi) alan yazdıkça büyüsün
    if (!CSS.supports?.("field-sizing", "content")) {
      const boyutla = () => { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; };
      t.addEventListener("input", boyutla);
      requestAnimationFrame(boyutla);
    }
    altyazi.replaceChildren(t);
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  };
  goster();
  return { duzenle };
}

function kirpintiFisi(k, capa, kart, not) {
  kart.classList.add("secili");
  fisAc(capa, [
    h("div", { class: "fis-baslik" }, k.belgeAd + sayfaEki(k)),
    k.belgeId ? fisSatir("sayfalar", "Belgede göster", null, () => { fisKapat(true); kirpintiAc(k); }) : null,
    fisSatir("notlar", k.not ? "Notu düzenle" : "Not ekle", null, () => { fisKapat(true); not.duzenle(); }),
    h("div", { class: "fis-ayrac" }),
    silSatiri("Sil", () => { fisKapat(true); kirpintiyiSil(k, kart); }),
  ], { hiza: "yan", etiket: "Kırpıntı seçenekleri", kapaninca: () => kart.classList.remove("secili") });
}

function kirpintiAc(k) {
  if (!k.belgeId) { kirpintiBuyut(k); return; }
  if (!belgeBul(k.belgeId)) { toast("Bu kırpıntının belgesi artık kitaplıkta yok."); return; }
  sonKaynak = null;
  bus.emit("git", { ekran: "belge", belgeId: k.belgeId, sayfa: k.sayfa });
}

function kirpintiBuyut(k) {
  const dlg = h("dialog", { class: "pencere kirpinti-buyuk", "aria-label": k.belgeAd },
    h("img", { src: k.gorsel, alt: k.belgeAd }),
    k.not ? h("p", {}, k.not) : null,
    // Paylaşımla gelen uzun metnin tamamı (not alanı kısaltılmış hâlini tutar)
    k.metin ? h("p", { style: "white-space: pre-wrap; max-height: 40vh; overflow: auto; user-select: text" }, k.metin) : null,
    h("div", { class: "pencere-alt" }, h("button", { class: "metin-dugme vurgulu", type: "button", onclick: () => dlg.close() }, "Kapat")));
  pencereKur(dlg);
  $(".pencere-alt button", dlg)?.focus();
}

async function kirpintiyiSil(k, kart) {
  const i = store.kirpintilar.indexOf(k);
  if (!hareketAz()) await bitince(kart.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.96)" }], { duration: 160, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }), 160);
  kirpintiSil(k.id);
  toast("Kırpıntı silindi", {
    etiket: "Geri al",
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
  const girdi = h("input", { placeholder: "Klasör adı", "aria-label": "Yeni klasörün adı", maxlength: "40", autocomplete: "off", enterkeyhint: "done" });
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
    toast(`${ad} klasörü hazır. Kapaklara uzun basıp taşıyabilirsin.`);
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
    fisSatir("pdf", "Dosya aç", `PDF, EPUB, CBZ ya da .kenar yedeği. ${dosyaIpucu()}`, () => { fisKapat(true); dosyaSec(); }),
    fisSatir("yeni-defter", "Yeni defter", "Boş, çizgili, kareli, noktalı ya da Cornell", () => { fisKapat(true); yeniDefterPenceresi(); }),
  ], { hiza: "alt-sag", etiket: "Yeni", klavye, kapaninca: () => K.yeni.setAttribute("aria-expanded", "false") });
}

/* ---------- İçe aktarma (OZELLIKLER-3 §1) ---------- */
// Belge almanın öbür yolu, platforma göre (iOS'ta paylaş hedefi yok)
const dosyaIpucu = () => (iosMu() ? (ipadMi() ? "Dosyalar uygulamasından sürükleyip de bırakabilirsin." : "Dosyalar uygulamasından seçersin.")
  : platform() === "android" ? "Başka bir uygulamadan Paylaş > Kenar Notu da olur."
  : "Dosyayı pencereye sürükleyip de bırakabilirsin.");
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
    return { id: yeniId("dz"), dizgi: true, tur, ad: f.name.replace(/\.(pdf|epub|cbz|cbr|zip)$/i, "") || "Adsız", klasor: tur === "pdf" ? klasor : undefined, acilis: Date.now() };
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
        : hata?.kod === "tur" ? `“${f.name}” açılamadı: yalnız PDF, EPUB ve CBZ.` : `“${f.name}” içe aktarılamadı.`);
    } finally {
      const j = dizgiler.indexOf(yerler[i]);
      if (j >= 0) dizgiler.splice(j, 1);
      kitaplikYenile();
    }
  }
  if (sonuclar.some((s) => !s.vardi)) depoUyarisiBirKez();
  if (sonuclar.length === 1) {
    const { b, vardi } = sonuclar[0];
    if (vardi) { toast(`“${b.ad}” zaten kitaplıkta, açılıyor.`); belgeAcIstegi(b, kapakBul(b.id)); }
    else toast(`“${b.ad}” kitaplığa eklendi`, { etiket: "Aç", calistir: () => belgeAcIstegi(b, kapakBul(b.id)) });
  } else if (sonuclar.length > 1) {
    const yeni = sonuclar.filter((s) => !s.vardi).length;
    toast(yeni ? `${yeni} belge kitaplığa eklendi` : "Bu dosyalar zaten kitaplıkta.");
  }
  return sonuclar.map((s) => s.b);
}
const kapakBul = (id) => (K.sonuclar ? $(`.belge[data-id="${CSS.escape(id)}"] :is(a.kapak-sahne, a.kapak) > *`, K.sonuclar) : null);

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
    h("div", { class: "belge-meta" }, h("span", { class: "t-etiket" }, h("span", {}, "Dizgide"))));
}
function dizgiSatir(d) {
  return h("div", { class: "belge-satir dizgi", role: "listitem", "aria-busy": "true", dataset: { id: d.id } },
    h("div", { class: "mini kapak-sahne" }, dizgiKapak(d, true)),
    h("div", { style: "min-width:0" }, h("div", { class: "ad" }, d.ad), h("div", { class: "t-kucuk" }, "Dizgide · kapak hazırlanıyor")));
}

/* ---------- Yeni defter penceresi (3.8) ---------- */
function yeniDefterPenceresi() {
  const d = { renk: KAPAK_RENKLERI[0], kagit: "grid" };
  const etiketAd = h("b", {}, "Adsız defter");
  const etiketTur = h("small");
  const kapak = h("div", { class: "kapak-defter" }, h("div", { class: "etiket" }, etiketAd, etiketTur));
  const yaprak = h("i", { class: "onizleme-yaprak" });
  const girdi = h("input", { class: "ad-alani", placeholder: "Defterin adı", "aria-label": "Defterin adı", maxlength: "80", autocomplete: "off", enterkeyhint: "done" });

  const numuneler = KAPAK_RENKLERI.map((r) => {
    const n = h("button", { class: "numune" + (r[2] ? " acik-renk" : ""), type: "button", style: `--c:${r[1]}`, "aria-label": r[0], "aria-pressed": "false" });
    n.addEventListener("click", () => { d.renk = r; guncelle(); });
    return n;
  });
  const yapraklar = TEMPLATES.map((t) => {
    const y = h("button", { class: "mini-yaprak", type: "button", "aria-pressed": "false" }, h("i", { class: KAGIT_SINIF[t.id] }), t.label);
    y.addEventListener("click", () => { d.kagit = t.id; guncelle(); });
    return y;
  });

  const guncelle = () => {
    kapak.style.setProperty("--c", d.renk[1]);
    kapak.classList.toggle("acik-renk", !!d.renk[2]);
    etiketAd.textContent = girdi.value.trim() || "Adsız defter";
    etiketTur.textContent = kagitAdi(d.kagit).toLocaleUpperCase("tr");
    yaprak.className = `onizleme-yaprak ${KAGIT_SINIF[d.kagit]}`;
    numuneler.forEach((n, i) => n.setAttribute("aria-pressed", String(KAPAK_RENKLERI[i] === d.renk)));
    yapraklar.forEach((y, i) => y.setAttribute("aria-pressed", String(TEMPLATES[i].id === d.kagit)));
  };
  girdi.addEventListener("input", guncelle);

  const form = h("form", { method: "dialog" },
    h("h2", { class: "t-b1", id: "ydBaslik" }, "Yeni defter"),
    girdi,
    h("span", { class: "t-etiket", id: "ydKapak" }, "Kapak"),
    h("div", { class: "numuneler", role: "group", "aria-labelledby": "ydKapak" }, numuneler),
    h("span", { class: "t-etiket", id: "ydKagit" }, "Kâğıt"),
    h("div", { class: "kagit-turu", role: "group", "aria-labelledby": "ydKagit" }, yapraklar),
    h("div", { class: "pencere-alt" },
      h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, "Vazgeç"),
      h("button", { class: "birincil", type: "submit" }, icon("yeni-defter", "i-20"), "Oluştur")));

  const dlg = h("dialog", { class: "pencere", "aria-labelledby": "ydBaslik" },
    h("div", { class: "yeni-defter" }, h("div", { class: "onizleme", "aria-hidden": "true" }, yaprak, kapak), form));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const klasor = tercih.secim.startsWith("klasor:") ? tercih.secim.slice(7) : undefined;
    const b = {
      id: yeniId("d"), tur: "defter", ad: girdi.value.trim() || "Adsız defter", klasor,
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
      h("button", { class: eylem ? "metin-dugme" : "metin-dugme vurgulu", type: "button", onclick: () => dlg.close() }, eylem ? "Kapat" : "Tamam"),
      eylem ? h("button", { class: "birincil", type: "button", onclick: () => { dlg.close(); eylem.calistir(); } }, eylem.etiket) : null));
  pencereKur(dlg);
  odakla($(".pencere-alt button:last-child", dlg));
}

/* ---------- Yedek ve depo (OZELLIKLER-3 §2) ---------- */
function boyutMetni(n) {
  const mb = n / 1048576;
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("tr", { maximumFractionDigits: 1 })} GB`;
  if (mb >= 1) return `${mb.toLocaleString("tr", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
// Depo göstergesi: "Kullanılan 84 MB · kalıcı", ölçü camın arkasında
function depoGostergesi() {
  const cam = h("span", { class: "cam cam-k depo-cam" }, "··");
  const durum = h("span", {}, "");
  const el = h("div", { class: "depo-gosterge", role: "status" }, h("span", {}, "Kullanılan"), cam, durum);
  kayit.depoDurumu().then((d) => {
    if (!d.olculdu) {   // güvenli olmayan bağlantıda navigator.storage yoktur
      cam.textContent = "?";
      durum.textContent = "· geçici";
      el.title = "Bu bağlantıda tarayıcı depo bilgisini vermez ve kalıcılık istenemez; localhost ya da https ile aç";
      return;
    }
    cam.textContent = boyutMetni(d.kullanilan);
    durum.textContent = d.kalici ? "· kalıcı" : "· geçici";
    el.title = d.kalici ? "Tarayıcı bu verileri kendiliğinden silmez" : "Yer daralırsa tarayıcı silebilir; ilk kayıtta kalıcılık istenir";
    if (d.kota) el.setAttribute("aria-label", `Kullanılan ${boyutMetni(d.kullanilan)}, ${boyutMetni(d.kota)} yerin içinden, ${d.kalici ? "kalıcı" : "geçici"}`);
  });
  return el;
}
const yedekAdi = () => {
  const t = new Date();
  const iki = (n) => String(n).padStart(2, "0");
  return `Kenar Notu yedeği ${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}.kenar`;
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
async function yedekAlIstegi(dugme) {
  if (yedekSuruyor) return;
  yedekSuruyor = true;
  const asil = dugme ? [...dugme.childNodes] : null;
  if (dugme) { dugme.disabled = true; dugme.textContent = "Hazırlanıyor"; }
  else toast("Yedek hazırlanıyor", { kalici: true });
  // Ağır iş işçide: ekran kilitlenmez, düğme yüzdeyi gösterir
  const ilerleme = (o) => { if (dugme) dugme.textContent = `Yedek hazırlanıyor %${Math.round(o * 100)}`; };
  try {
    const blob = await kayit.yedekAl({ ilerleme });
    await dosyaPaylas(blob, yedekAdi());
    ayarla({ sonYedek: Date.now() });
    toast(`Yedek hazır: ${boyutMetni(blob.size)}`);
  } catch (hata) {
    console.warn("[kenar-notu] Yedek alınamadı:", hata);
    toast(hata?.kod === "eksik" || hata?.kod === "buyuk" ? hata.message : "Yedek alınamadı.");
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
async function yedekYukleIstegi(f) {
  toast("Yedek yükleniyor…");
  try { await kayit.yedekYukle(f); }   // bitince sayfa yenilenir
  catch (hata) {
    console.warn("[kenar-notu] Yedek yüklenemedi:", hata);
    toast(hata?.kod === "bicim" ? "Bu bir Kenar Notu yedeği değil."
      : hata?.kod === "okuma" ? "Yedek dosyası okunamadı: dosyaya erişilemedi ya da bellek yetmedi. Kitaplık değişmedi."
      : hata?.kod === "baska" ? "Kitaplık başka bir pencerede açık. Yüklemek için o pencereyi kapatıp burayı yenile."
      : "Yedek yüklenemedi; kitaplık değişmedi.");
  }
}
// Otomatik yedek (OZELLIKLER-8 §3.1). Ayarlar'da klasör seçimi ve son yazılan yedek; kayit.js günde bir yazar.
// Klasöre yazamayan tarayıcıda (iOS, Firefox) yedek 7 günde bir sessizce hatırlatılır.
function otoYedekDenetimi() {
  const el = h("div", { class: "oto-yedek" });
  if (!kayit.klasorDestegi()) {
    el.append(h("p", { class: "ayar-not" }, "Bu tarayıcı klasöre kendiliğinden yazamıyor; haftada bir yedek almayı hatırlatırız."));
    return { el, guncelle: () => {} };
  }
  let yaziyor = "";
  const ciz = async () => {
    const k = await kayit.yedekKlasoru().catch(() => null);
    const sec = h("button", { class: "ikincil", type: "button" }, icon("klasor", "i-20"), k ? "Klasörü değiştir" : "Otomatik yedek klasörü seç");
    sec.addEventListener("click", () => klasorSecIstegi(sec));
    if (!k) {
      el.replaceChildren(h("p", { class: "ayar-not" }, "Bir klasör seç: Kenar Notu oraya günde bir yedek yazar, son 7 tanesi kalır."),
        h("div", { class: "ayar-yedek__dugmeler" }, sec));
      return;
    }
    const durum = yaziyor || (k.izin !== "granted" ? "İzin bekliyor" : k.hata ? k.hata : k.son ? `Son otomatik yedek: ${neZaman(k.son)}` : "Henüz yazılmadı");
    const izin = k.izin !== "granted"
      ? h("button", { class: "ikincil", type: "button", onclick: () => kayit.yedekKlasoruIzinIste().then((ok) => { if (!ok) toast("İzin verilmedi; otomatik yedek bekliyor."); ciz(); }) }, "İzin ver")
      : null;
    const kapat = h("button", { class: "metin-dugme", type: "button", onclick: () => kayit.yedekKlasoruBirak().then(() => toast("Otomatik yedek kapandı; klasördeki dosyalar duruyor.")) }, "Otomatik yedeği kapat");
    el.replaceChildren(
      h("p", { class: "oto-yedek__klasor" }, icon("klasor", "i-20"), h("span", {}, k.ad, h("small", { class: k.hata && !yaziyor ? "hata" : null }, durum))),
      h("div", { class: "ayar-yedek__dugmeler" }, izin, sec, kapat));
  };
  const coz = bus.on("yedek:klasor", (o) => {
    if (!el.isConnected && el.dataset.cizildi) { coz(); return; }
    yaziyor = o?.tur === "yaziyor" ? "Yedek yazılıyor" : "";
    ciz();
  });
  ciz().then(() => { el.dataset.cizildi = "1"; });
  return { el, guncelle: () => {} };
}
async function klasorSecIstegi(dugme) {
  const asil = [...dugme.childNodes];
  try {
    const ilerleme = (o) => { dugme.disabled = true; dugme.textContent = `Yedek hazırlanıyor %${Math.round(o * 100)}`; };
    const ok = await kayit.yedekKlasoruSec({ ilerleme });
    toast(ok ? "Otomatik yedek açık: ilk yedek klasöre yazıldı." : "Klasör seçildi ama yedek yazılamadı.");
  } catch (hata) {
    if (hata?.name !== "AbortError") {
      console.warn("[kenar-notu] Yedek klasörü seçilemedi:", hata);
      toast(hata?.kod === "baska" ? "Kitaplık başka bir pencerede açık; klasörü orada seç." : "Klasör seçilemedi.");
    }
  } finally {
    if (dugme.isConnected) { dugme.disabled = false; dugme.replaceChildren(...asil); }
  }
}
// İzin düşünce (tarayıcı yeniden açılınca çoğu zaman) dokunuşla izin isteyen sessiz fiş; oturumda bir kez
let klasorIzniSoruldu = false;
bus.on("yedek:klasor", (o) => {
  if (o?.tur === "izin-gerek" && !klasorIzniSoruldu) {
    klasorIzniSoruldu = true;
    toast("Yedek klasörüne izin ver", { etiket: "İzin ver", kalici: true,
      calistir: () => kayit.yedekKlasoruIzinIste().then((ok) => { if (!ok) toast("İzin verilmedi; otomatik yedek bekliyor."); }) });
  } else if (o?.tur === "yazildi") ayarla({ sonYedek: o.son });
  else if (o?.tur === "hata") toast(`Otomatik yedek: ${o.mesaj}`);
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
  toast("Son yedeğin üstünden bir hafta geçti.", { etiket: "Yedeği kaydet", kalici: true, calistir: () => yedekAlIstegi() });
}

// Kenar çubuğundaki Yedekle ve bırakılan .kenar dosyası buraya gelir
function yedekPenceresi(dosya = null) {
  cekmeceKapat();
  const s = sayilar();
  const dlg = h("dialog", { class: "pencere bilgi yedek-pencere", "aria-labelledby": "yedekBaslik" });
  const al = h("button", { class: "birincil", type: "button" }, "Yedek al");
  const yukle = h("button", { class: "metin-dugme", type: "button" }, dosya ? "Yükle" : "Yedekten yükle");
  al.addEventListener("click", () => yedekAlIstegi(al));
  yukle.addEventListener("click", () => { dlg.close(); if (dosya) yedekYukleIstegi(dosya); else yedekSec(); });
  dlg.append(
    icon("yedekle", "bilgi-simge"),
    h("h2", { class: "t-b2", id: "yedekBaslik" }, dosya ? `“${dosya.name}”` : "Yedekle"),
    h("p", {}, dosya
      ? "Yedekteki belgeler, kalem izleri, notlar, kartlar ve kırpıntılar bu kitaplıkla birleştirilir. İkisinde de olan belgede son açılan kalır."
      : "Her şey tek bir .kenar dosyasına yazılır: belgeler, çizgi romanlar ve dosyaları, kalem izleri ve cep defterleri, derlemeler, notlar, bantlar, kartlar ve kırpıntılar. API anahtarları yedeğe girmez."),
    h("dl", { class: "kilavuzlar" }, [["Kitaplar", s.kitaplar], ["Defterler", s.defterler], ...(s.cizgiler ? [["Çizgi romanlar", s.cizgiler]] : []),
      ["Klasörler", KLASORLER.length], ["Kırpıntılar", s.kirpilanlar], ["Kartlar", store.kartlar.length],
      ["İzler", store.belgeler.reduce((t, b) => t + (Array.isArray(b.veri?.izler) ? b.veri.izler.length : 0), 0)]]
      .map(([ad, deger]) => h("div", { class: "kilavuz-satir" }, h("dt", {}, ad), h("dd", {}, String(deger))))),
    depoGostergesi(),
    h("div", { class: "fis-hedera", "aria-hidden": "true" }, parca('<svg viewBox="0 0 28 16"><use href="#i-hedera"/></svg>')),
    h("div", { class: "pencere-alt" },
      h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, "Kapat"),
      dosya ? null : yukle, dosya ? yukle : al));
  if (dosya) yukle.className = "birincil";
  pencereKur(dlg);
  odakla($(".pencere-alt button:last-child", dlg));
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
    const dosyalar = [...(e.dataTransfer.files || [])];
    if (!dosyalar.length) return;
    // .kenar yedeği bırakılırsa yedekten yükleme sorulur; tür adından tanınmazsa içeriğinden
    dosyalariAyir(dosyalar).then(({ belgeler, yedek }) => {
      if (yedek) { yedekPenceresi(yedek); return; }
      if (belgeler.length) { dosyalariAl(belgeler); return; }
      bilgiPenceresi({ ikon: "pdf", baslik: `“${dosyalar[0].name}”`, metin: "Kenar Notu PDF, EPUB ve CBZ (çizgi roman) dosyalarını açar. Not almak için yeni bir defter de açabilirsin." });
    });
  });
}

/* ---------- Ayarlar denetimleri ---------- */
function parcali(secenekler, etiket, deger, sec) {
  const dugmeler = secenekler.map(([v, ad, ik]) => h("button", { type: "button", "aria-pressed": "false", onclick: () => sec(v) }, ik ? icon(ik) : null, ad));
  const el = h("div", { class: "parcali", role: "group", "aria-label": etiket }, dugmeler);
  const guncelle = () => { const d = deger(); dugmeler.forEach((b, i) => b.setAttribute("aria-pressed", String(secenekler[i][0] === d))); };
  guncelle();
  return { el, guncelle };
}
function kagitDiskleri() {
  // Oto: Koltuk'ta temayı izler, Masa'da beyaz kalır (ortak.js sayfaCoz). Disk yarı açık yarı koyu.
  const SAYFA = [["oto", "Oto", "linear-gradient(90deg, #FDFBF6 50%, #1B1A17 50%)", "#24211E"], ["beyaz", "Beyaz", "#FDFBF6", "#24211E"],
    ["sepya", "Sepya", "#F5EDDA", "#3B2F22"], ["koyu", "Koyu", "#1B1A17", "#D9D0BE"], ["tahta", "Tahta", "#1F2622", "#DCD8CB"], ["mum", "Mum", "#1E1710", "#E6CFA5"]];
  const dugmeler = SAYFA.map(([v, ad, kd, kdy]) =>
    h("button", { class: "kagit-disk" + (v === "oto" ? " oto" : ""), type: "button", "aria-pressed": "false", style: `--kd:${kd};--kdy:${kdy}`, onclick: () => ayarla({ sayfaRengi: v }) },
      h("i", {}, v === "oto" ? h("span", {}, "Aa") : "Aa"), ad));
  const el = h("div", { class: "kagit-diskler", role: "group", "aria-label": "Sayfa rengi" }, dugmeler);
  const guncelle = () => dugmeler.forEach((b, i) => b.setAttribute("aria-pressed", String(SAYFA[i][0] === (store.ayarlar.sayfaRengi || "oto"))));
  guncelle();
  return { el, guncelle };
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
  const c = h("canvas", { class: "spen-onizleme", width: String(W * dpr), height: String(H * dpr), role: "img", "aria-label": "Basınç eğrisi önizlemesi" });
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
const kalemBaslik = () => ({ spen: "S Pen", pencil: "Apple Pencil" })[kalemTuru()] || "Kalem";
let ayarlarAcik = null;
function ayarlarAc({ acan = null, bolum = null } = {}) {
  if (ayarlarAcik) { ayarlarAcik.git(bolum); return; }
  rehberKapat();
  fisKapat(true);
  cekmeceKapat();
  const tema = parcali([["oto", "Otomatik", "tema-oto"], ["acik", "Açık", "tema-acik"], ["koyu", "Koyu", "tema-koyu"]],
    "Uygulama teması", () => store.ayarlar.tema, (v) => ayarla({ tema: v }));
  const sayfa = kagitDiskleri();
  const yazi = parcali([["kucuk", "Küçük"], ["orta", "Orta"], ["buyuk", "Büyük"]], "Arayüz yazı boyutu",
    () => store.ayarlar.arayuzYazi || "orta", (v) => ayarla({ arayuzYazi: v }));
  const sade = anahtarSatiri("Sade hareket", "Dönüş ve uçuş yerine kısa geçişler", () => store.ayarlar.sadeHareket, (v) => ayarla({ sadeHareket: v }));
  const elYazisi = anahtarSatiri("Notlarda el yazısı", "Kapalıyken notlar düz yazıyla", () => store.ayarlar.elYazisi !== false, (v) => ayarla({ elYazisi: v }));
  const parmak = anahtarSatiri("Parmakla çiz", "Kalem algılanınca kendiliğinden kapanır", () => store.ayarlar.parmaklaCiz, (v) => ayarla({ parmaklaCiz: v }));
  // Masa'nın ayarı araç ayarlarında (araclar.sekilDuzelt); araçlar ilk belge açılınca kurulur, o zamana kadar bekler
  const sekil = anahtarSatiri("Şekil düzeltme", "Çizip bir an bekleyince çizgi, daire ve kutu düzelir", sekilDuzeltAcik,
    (v) => { const a = store.ayarlar.araclar; if (a) { a.sekilDuzelt = v; ayarla({}); } else ayarla({ sekilDuzelt: v }); });
  const yanTus = anahtarSatiri("Yan tuş silgi", "Yan tuş basılıyken kalem siler", () => store.ayarlar.yanTusSilgi !== false, (v) => ayarla({ yanTusSilgi: v }));
  const egri = parcali([["yumusak", "Yumuşak"], ["orta", "Orta"], ["sert", "Sert"]], "Basınç eğrisi",
    () => store.ayarlar.basincEgrisi || "orta", (v) => ayarla({ basincEgrisi: v }));
  const onizleme = basincOnizleme();
  const kalemD = { el: null, guncelle: () => { yanTus.guncelle(); egri.guncelle(); onizleme.ciz(); } };
  const sonBelge = anahtarSatiri("Açılışta son belgeyle başla", "Uygulama doğrudan son okuduğun yerde açılır", () => !!store.ayarlar.sonBelgeyleBasla, (v) => ayarla({ sonBelgeyleBasla: v }));
  const exGoster = anahtarSatiri("Ex libris", "Kitabın iç kapağında senin mührün", () => store.ayarlar.exLibrisGoster !== false, (v) => ayarla({ exLibrisGoster: v }));
  const odunc = anahtarSatiri("Ödünç kartı", "Kitabın sonunda okuduğun günler ve toplam süre", () => store.ayarlar.oduncKarti !== false, (v) => ayarla({ oduncKarti: v }));
  const mum = anahtarSatiri("Mum ışığı önerisi", "Saat 22’den sonra bir kez, nazikçe", () => store.ayarlar.mumOneri !== false, (v) => ayarla({ mumOneri: v }));
  const exDisa = anahtarSatiri("Dışa aktarırken ex libris ekle", "Notlu PDF’in ilk sayfasında, sağ altta", () => store.ayarlar.exLibrisDisa !== false, (v) => ayarla({ exLibrisDisa: v }));
  // Yapay zekâ ve Çeviri: alt satırda seçili yol, dokununca ayrı pencere
  const yzAlt = h("small", {}, yzOzet());
  const yzSatir = h("button", { class: "fis-satir yz-satir", type: "button", "aria-haspopup": "dialog", onclick: () => yzPenceresi() },
    icon("sor", "i-20"), h("span", {}, "Yapay zekâ"), yzAlt);
  const cvAlt = h("small", {}, ceviriOzet());
  const cvSatir = h("button", { class: "fis-satir yz-satir", type: "button", "aria-haspopup": "dialog", onclick: () => ceviriPenceresi() },
    icon("ceviri", "i-20"), h("span", {}, "Çeviri"), cvAlt);
  const metinler = { el: null, guncelle: () => { yzAlt.textContent = yzOzet(); cvAlt.textContent = ceviriOzet(); } };
  // Yedek ve depolama
  const sonYedek = h("p", { class: "ayar-not" });
  const sonYedekYaz = () => {
    const t = Number(store.ayarlar.sonYedek) || 0;
    sonYedek.textContent = t ? `Son yedek: ${neZaman(t)}.` : "Henüz yedek alınmadı.";
  };
  sonYedekYaz();
  const yedekAl = h("button", { class: "ikincil", type: "button" }, icon("yedekle", "i-20"), "Şimdi yedekle");
  yedekAl.addEventListener("click", () => yedekAlIstegi(yedekAl));
  const yedekYukle = h("button", { class: "metin-dugme", type: "button", onclick: () => yedekSec() }, "Yedekten yükle");
  const otoYedek = otoYedekDenetimi();
  const sifirEtiket = h("span", {}, "Örnek verilere dön");
  const sifir = h("button", { class: "fis-satir onayli sifirla", type: "button" }, icon("sil", "i-20"),
    h("span", {}, sifirEtiket, h("small", {}, "Çizimler, notlar, içe aktarılan dosyalar silinir; API anahtarları kalır")));
  onayla(sifir, sifirEtiket, "Emin misin? Tekrar dokun", () => durumuSifirla());
  const temizEtiket = h("span", {}, "Her şeyi temizle");
  const temiz = h("button", { class: "fis-satir onayli sifirla", type: "button" }, icon("sil", "i-20"),
    h("span", {}, temizEtiket, h("small", {}, "Örnekler dahil her şey ve API anahtarları silinir; boş bir defterle başlar")));
  onayla(temiz, temizEtiket, "Emin misin? Tekrar dokun", () => durumuSifirla({ hepsi: true }));
  const exDuz = exLibrisDuzenleyici();
  const rehberD = h("button", { class: "fis-satir", type: "button", onclick: () => { kapat(); rehberBaslat(); } },
    icon("sor", "i-20"), h("span", {}, "Rehberi yeniden göster"), h("small", {}, "Üç kısa ipucu, gerçek ekranın üstünde"));
  const kurulumD = iosMu() && !kuruluMu()
    ? h("button", { class: "fis-satir", type: "button", onclick: () => iosKurulumFisi({ zorla: true }) }, icon("paylas", "i-20"), h("span", {}, "Ana ekrana ekle"), h("small", {}, "Tam ekran açılır, verilerin kalıcı olur"))
    : null;

  const kalemIpucu = { spen: "Kalem havadayken yan tuş Samsung menüsünü açar. Önce ekrana değdir, sonra bas.",
    pencil: "Silgi kalem tepsisinde. İki parmakla dokunmak geri alır, üç parmakla dokunmak yineler.",
  }[kalemTuru()] || "İki parmakla dokunmak geri alır, üç parmakla dokunmak yineler.";
  const kisayollar = dokunmatikMiYalniz() ? null : h("dl", { class: "kilavuzlar ayar-kisayol" },
    [["Ctrl K", "Hızlı erişim: belge, ekran ve komut"], ["/", "Kitaplıkta ara"], ["Ctrl Z", "Geri al"], ["Esc", "Pencereyi ya da paneli kapat"]]
      .map(([t, a]) => h("div", { class: "kilavuz-satir" }, h("dt", {}, h("kbd", { class: "kisayol" }, t)), h("dd", {}, a))));

  const BOLUMLER = [
    ["gorunum", "Görünüm", [h("span", { class: "t-etiket" }, "Uygulama teması"), tema.el, h("span", { class: "t-etiket" }, "Sayfa rengi"), sayfa.el,
      h("span", { class: "t-etiket" }, "Arayüz yazı boyutu"), yazi.el, sade.el, elYazisi.el]],
    ["kalem", kalemBaslik(), [parmak.el, sekil.el,
      h("div", { class: "spen-kart" },
        samsungMu() ? yanTus.el : null,
        h("div", { class: "spen-egri" }, h("span", { class: "spen-egri__ad" }, "Basınç eğrisi", h("small", {}, kalemTuru() === "fare" || kalemTuru() === "parmak" ? "Kalemin varsa önizlemeye yaz" : "Önizlemeye kalemle yaz")), egri.el, onizleme.el),
        h("p", { class: "spen-ipucu" }, kalemIpucu))]],
    ["okuma", "Okuma", [sonBelge.el, h("span", { class: "t-etiket" }, "Küçük sürprizler"), exGoster.el, odunc.el, mum.el]],
    ["ceviri", "Çeviri ve yapay zekâ", [cvSatir, yzSatir]],
    ["yedek", "Yedek ve depolama", [depoUyarisi(), h("div", { class: "ayar-yedek" }, depoGostergesi(), sonYedek,
      h("div", { class: "ayar-yedek__dugmeler" }, yedekAl, yedekYukle)), otoYedek.el, kurulumD, h("div", { class: "fis-ayrac" }), sifir, temiz]],
    ["exlibris", "Ex libris", [exDuz.el, exDisa.el]],
    ["yardim", "Yardım", [rehberD,
      h("button", { class: "fis-satir", type: "button", "aria-haspopup": "dialog", onclick: (e) => { const acan = e.currentTarget; import("./hakkinda.js").then((m) => m.hakkindaAc({ acan })); } },
        icon("kitap", "i-20"), h("span", {}, "Hakkında"), h("small", {}, "Sürüm, gizlilik, açık kaynak lisansları")),
      kisayollar,
      h("div", { class: "ayarlar-alt" }, parca('<svg viewBox="0 0 28 16" aria-hidden="true"><use href="#i-hedera"/></svg>'), "Kenar Notu, tasarım prototipi")]],
  ];
  ayarDenetimleri = [tema, sayfa, yazi, sade, parmak, elYazisi, sekil, kalemD, sonBelge, exGoster, odunc, mum, exDisa, metinler, exDuz, { guncelle: sonYedekYaz }];
  const bolumler = BOLUMLER.map(([id, ad, ogeler]) => h("section", { class: "ayar-bolum", id: "ayar-" + id, "aria-labelledby": "ayar-b-" + id },
    h("h3", { class: "ayar-bolum__baslik", id: "ayar-b-" + id }, ad), ...ogeler.filter(Boolean)));
  const navDugmeler = BOLUMLER.map(([id, ad]) => h("button", { class: "cip", type: "button", dataset: { bolum: id }, "aria-pressed": "false" }, ad));
  const nav = h("nav", { class: "ayarlar-nav", "aria-label": "Ayarlar bölümleri" }, navDugmeler);
  const icerik = h("div", { class: "ayarlar-icerik" }, bolumler);

  let kaydirici, kapat, kok;
  const bitir = () => { ayarDenetimleri = []; ayarlarAcik = null; for (const d of [K.ayarlarDugme, K.basAyarlar]) d?.setAttribute("aria-expanded", "false"); };
  if (cekmeceMi()) {
    const c = altCekmece({ baslik: "Ayarlar", govde: [nav, icerik], duraklar: ["tam"], ilk: "tam", sinif: "ayarlar-sayfa", acan, kapaninca: bitir });
    kaydirici = c.govde; kapat = () => c.kapat(); kok = c.kok;
  } else {
    const dlg = h("dialog", { class: "pencere ayarlar-sayfa", "aria-labelledby": "ayarlarBaslik" },
      h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "ayarlarBaslik", tabindex: "-1" }, "Ayarlar"),
        h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => dlg.close() }, icon("kapat"))),
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

// Safari 7 gün kuralı (OZELLIKLER-7 §3): kurulu değilse ve tarayıcı kalıcılık vermediyse kısa uyarı
function depoUyarisi() {
  if (!safariMi() || kuruluMu()) return null;
  const el = h("div", { class: "ayar-uyari", role: "note" }, icon("kilit", "i-20"),
    h("p", {}, "Safari, ana ekrana eklenmemiş sitelerin verisini 7 gün açılmayınca silebilir. ",
      iosMu() ? "Ana ekrana ekle ya da düzenli yedek al." : "Düzenli yedek al."));
  navigator.storage?.persisted?.().then((k) => { if (k) el.remove(); }).catch(() => {});
  return el;
}
// İlk belge eklenince bir kez: Safari'de kalıcılık yoksa yedek önerisi
async function depoUyarisiBirKez() {
  if (!safariMi() || kuruluMu() || depo.oku(ANAHTAR.depoUyari)) return;
  try { if (await navigator.storage?.persisted?.()) return; } catch { /* bilinmiyor: uyar */ }
  depo.yaz(ANAHTAR.depoUyari, Date.now());
  setTimeout(() => toast("Safari bu verileri 7 gün açılmayınca silebilir. Ana ekrana ekle ya da yedek al.", { etiket: "Yedekle", calistir: () => yedekPenceresi() }), 4500);
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
  const kapatD = h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat" }, icon("kapat", "i-20"));
  const el = h("div", { class: "kurulum-fis", role: "note", "aria-label": "Ana ekrana ekle" },
    h("span", { class: "kurulum-fis__simge", "aria-hidden": "true" }, icon("paylas")),
    h("p", {}, h("b", {}, "Ana ekrana ekle"),
      h("span", {}, ipadMi() ? "Üstteki Paylaş simgesine, sonra Ana Ekrana Ekle’ye dokun." : "Alttaki Paylaş simgesine, sonra Ana Ekrana Ekle’ye dokun.",
        " Tam ekran açılır, verilerin kalıcı olur.")),
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
  const c = h("canvas", { class: "exlibris-tuval", width: String(W * dpr), height: String(W * dpr), role: "img", "aria-label": "Ex libris çizim alanı. Kalemle ya da parmakla imzanı ya da monogramını çiz." });
  const g = c.getContext("2d");
  const onizleme = h("div", { class: "exlibris-onizleme", "aria-label": "Mühür önizlemesi", role: "img" });
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
  const onizle = () => { onizleme.innerHTML = exLibrisSvg(96, taslak, { aci: -4 }) || '<span class="exlibris-bos">Mühür burada görünür</span>'; };
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
  const cerceve = parcali([["daire", "Daire"], ["oval", "Oval"], ["yok", "Yok"]], "Çerçeve", () => taslak.cerceve, (v) => { taslak.cerceve = v; cerceve.guncelle(); onizle(); });
  const renkler = h("div", { class: "exlibris-renkler", role: "group", "aria-label": "Mürekkep" }, EXLIBRIS_RENKLERI.map(([ad, hex]) => {
    const d = h("button", { class: "renk-secim", type: "button", "aria-label": ad, title: ad, "aria-pressed": String(taslak.renk === hex), style: `--renk:${hex}` });
    d.addEventListener("click", () => { taslak.renk = hex; for (const x of renkler.children) x.setAttribute("aria-pressed", String(x === d)); ciz(); onizle(); });
    return d;
  }));
  const yaziGirdi = h("input", { class: "exlibris-yazi", type: "text", maxlength: "18", placeholder: "EX LİBRİS · CAN", "aria-label": "Mühürdeki yazı (isteğe bağlı)", autocomplete: "off", enterkeyhint: "done" });
  yaziGirdi.value = taslak.yazi;
  yaziGirdi.addEventListener("input", () => { taslak.yazi = yaziGirdi.value.slice(0, 18); onizle(); durum(); });
  const geriD = h("button", { class: "metin-dugme", type: "button" }, "Geri al");
  geriD.addEventListener("click", () => { taslak.vuruslar.pop(); ciz(); onizle(); durum(); });
  const temizleD = h("button", { class: "metin-dugme", type: "button" }, "Temizle");
  temizleD.addEventListener("click", () => {
    const eski = taslak.vuruslar.slice();
    taslak.vuruslar.length = 0; ciz(); onizle(); durum();
    if (eski.length) toast("Çizim temizlendi", { etiket: "Geri al", calistir: () => { taslak.vuruslar.push(...eski); ciz(); onizle(); durum(); } });
  });
  const kaydetD = h("button", { class: "birincil", type: "button" }, "Kaydet");
  kaydetD.addEventListener("click", () => {
    const eski = store.ayarlar.exLibris || null;
    const ex = { vuruslar: taslak.vuruslar.map((v) => v.map((q) => [...q])), cerceve: taslak.cerceve, renk: taslak.renk, yazi: taslak.yazi.trim(), surum: (Number(eski?.surum) || 0) + 1 };
    ayarla({ exLibris: exLibrisVar(ex) ? ex : null });
    bus.emit("exlibris", store.ayarlar.exLibris);
    toast(exLibrisVar(ex) ? "Ex libris kaydedildi. Kitapların iç kapağında görünür." : "Ex libris kaldırıldı",
      eski ? { etiket: "Geri al", calistir: () => { ayarla({ exLibris: eski }); bus.emit("exlibris", eski); } } : undefined);
    durum();
  });
  const durum = () => {
    geriD.disabled = !taslak.vuruslar.length;
    temizleD.disabled = !taslak.vuruslar.length;
  };
  const el = h("div", { class: "exlibris" },
    h("p", { class: "ayar-not" }, "Kendi kitap mührünü çiz: imza, monogram ya da küçük bir resim. Her kitabın iç kapağında küçük bir mühür olarak durur."),
    h("div", { class: "exlibris-alan" }, h("div", { class: "exlibris-kagit" }, c), onizleme),
    h("span", { class: "t-etiket" }, "Çerçeve"), cerceve.el,
    h("span", { class: "t-etiket" }, "Mürekkep"), renkler,
    h("span", { class: "t-etiket" }, "Yazı"), yaziGirdi,
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
    return s.id === "deneme" ? "Deneme, çevrimdışı" : `${s.ad}, kendi anahtarınla`;
  }
  const u = YZ_UYGULAMALAR.find((x) => x.id === yz.uygulama) || YZ_UYGULAMALAR[0];
  return `${u.ad} ile, hesabınla`;
}

// asistan.js'in baglantiDene() sonucunu cam şeritteki yazıya çevirir.
// Beklenen: { ok: true, ms } ya da { ok: false, durum: 401 | 403 | 404 | 429 | "ag" | "anahtar-yok", mesaj }; atılan hata da olur.
function denemeSonucu(s, ms) {
  if (s === true || (s && !(s instanceof Error) && (s.ok === true || s.tamam === true))) {
    return { tamam: true, metin: `BAĞLI · ${Math.round(s?.ms ?? ms)} ms` };
  }
  const kod = s?.durum ?? s?.status ?? s?.kod ?? s?.code ?? (s instanceof TypeError ? "ag" : null);
  const n = Number(kod);
  if (n === 401 || n === 403) return { metin: `${n} · ANAHTAR` };
  if (n === 404) return { metin: "404 · MODEL" };
  if (n === 429) return { metin: "429 · SINIR" };
  if (kod === "ag" || kod === "network" || n === 0) return { metin: "AĞ YOK" };
  if (kod === "anahtar-yok" || kod === "anahtar") return { metin: "ANAHTAR YOK" };
  if (kod === "hazir-degil") return { metin: "HAZIR DEĞİL" };
  if (typeof s?.mesaj === "string" && s.mesaj) return { metin: s.mesaj.toLocaleUpperCase("tr") };
  return { metin: Number.isFinite(n) && n ? `${n} · HATA` : "HATA" };
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
  const uygulamaSec = h("div", { class: "uygulama-sec", role: "radiogroup", "aria-label": "Uygulama" }, karolar);
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
    h("span", {}, h("b", {}, "Hesabımla sor"), h("span", { class: "etiket-serit" }, "Önerilen")),
    h("p", {}, "Telefonda o uygulamaya giriş yaptıysan yeter, anahtar gerekmez. Cevap o uygulamada gelir."),
    uygulamaSec);

  // 2. yol: Kendi anahtarımla (gelişmiş)
  const anahtarRadyo = h("input", { type: "radio", name: "yz-yol", value: "anahtar" });
  const anahtarKart = h("label", { class: "yol-kart ic" },
    anahtarRadyo, h("b", {}, "Anahtarla sor"),
    h("p", {}, "Cevap uygulamanın içinde akar. Anahtarı sağlayıcının sitesinden alırsın."));
  for (const r of [hesapRadyo, anahtarRadyo]) r.addEventListener("change", () => { if (r.checked) { yz.yol = r.value; kaydet(); guncelle(); } });

  const satirlar = YZ_SAGLAYICILAR.map((s) => {
    const r = h("input", { type: "radio", name: "yz-saglayici", value: s.id });
    const lamba = h("span", { class: "lamba", "aria-hidden": "true" });
    const model = h("span", { class: "t-deger-k" });
    r.addEventListener("change", () => { if (!r.checked) return; yz.saglayici = s.id; kaydet(); sonucTemizle(); guncelle(); });
    return { s, r, lamba, model, el: h("label", { class: "saglayici" }, r, lamba, h("b", {}, s.ad), model) };
  });

  // Anahtar alanı: gizli yazılır, "Göster" ile açılır
  const anahtarGirdi = h("input", { type: "password", autocomplete: "off", spellcheck: "false", autocapitalize: "off", "aria-label": "API anahtarı", placeholder: "Anahtarı buraya yapıştır" });
  const gosterYazi = h("span", {}, "Göster");
  const gosterSimge = icon("goz");
  const gosterDugme = h("button", { class: "metin-dugme", type: "button", "aria-pressed": "false" }, gosterSimge, gosterYazi);
  gosterDugme.addEventListener("click", () => {
    const acikMi = anahtarGirdi.type === "password";
    anahtarGirdi.type = acikMi ? "text" : "password";
    gosterYazi.textContent = acikMi ? "Gizle" : "Göster";
    gosterSimge.firstChild.setAttribute("href", acikMi ? "#i-goz-kapali" : "#i-goz");
    gosterDugme.setAttribute("aria-pressed", String(acikMi));
  });
  anahtarGirdi.addEventListener("input", () => { yz.anahtarlar[yz.saglayici] = anahtarGirdi.value.trim(); delete yz.denemeler[yz.saglayici]; sonucTemizle(); lambalar(); });
  // Anahtar girilince yol kendiliğinden "anahtar" olur (OZELLIKLER-2 5.1.7)
  anahtarGirdi.addEventListener("change", () => { if (anahtarGirdi.value.trim()) yz.yol = "anahtar"; kaydet(); guncelle(); });
  const anahtarAlan = h("label", { class: "yz-alan" }, h("span", {}, "API anahtarı"), h("div", { class: "anahtar-alan" }, anahtarGirdi, gosterDugme));

  // Model adı: düzenlenebilir, "Varsayılan" YZ_SAGLAYICILAR değerine döner
  const modelGirdi = h("input", { type: "text", autocomplete: "off", spellcheck: "false", autocapitalize: "off", "aria-label": "Model adı" });
  const varsayilanYazi = h("p", { class: "t-kucuk" });
  const varsayilanDugme = h("button", { class: "metin-dugme", type: "button" }, "Varsayılan");
  varsayilanDugme.addEventListener("click", () => { modelGirdi.value = saglayici().varsayilanModel; modelGirdi.dispatchEvent(new Event("input")); kaydet(); });
  modelGirdi.addEventListener("input", () => {
    yz.modeller[yz.saglayici] = modelGirdi.value.trim() || saglayici().varsayilanModel;
    delete yz.denemeler[yz.saglayici];
    sonucTemizle();
    lambalar();
  });
  modelGirdi.addEventListener("change", kaydet);
  const modelAlan = h("label", { class: "yz-alan" }, h("span", {}, "Model"), h("div", { class: "anahtar-alan" }, modelGirdi, varsayilanDugme), varsayilanYazi);
  const denemeNotu = h("p", { class: "t-kucuk yz-alan" }, "Hazır cevaplarla dener, internet gerekmez.");

  // Bağlantıyı dene: sonuç cam şeritte yazıyla
  const deneDugme = h("button", { class: "metin-dugme", type: "button" }, "Bağlantıyı dene");
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
      camYazi.textContent = "DENEME · HAZIR";
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
    h("summary", {}, icon("anahtar"), "Kendi anahtarımla (gelişmiş)", icon("asagi")),
    anahtarKart,
    h("div", { class: "saglayicilar", role: "radiogroup", "aria-label": "Sağlayıcı" }, satirlar.map((x) => x.el)),
    denemeNotu, anahtarAlan, modelAlan,
    h("div", { class: "baglanti-dene" }, deneDugme, cam),
    h("p", { class: "yz-uyari" }, icon("kilit"), h("span", {}, "Anahtar yalnız bu cihazda saklanır. İstek doğrudan sağlayıcıya gider.")));
  if (yz.yol === "anahtar") gelismis.open = true;

  const dlg = h("dialog", { class: "pencere yz-pencere", "aria-labelledby": "yzBaslik" },
    h("div", { class: "yz-ust" },
      h("h2", { class: "t-b1", id: "yzBaslik" }, "Yapay zekâ"),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => dlg.close() }, icon("kapat"))),
    hesapKart, gelismis);

  // Sağlayıcı satırı lambası: seçili ve bağlı, seçili denenmemiş, Deneme ya da boş halka
  function lambalar() {
    for (const { s, r, lamba, model } of satirlar) {
      r.checked = s.id === yz.saglayici;
      model.textContent = s.id === "deneme" ? "deneme" : yz.modeller[s.id] || s.varsayilanModel;
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
    varsayilanYazi.textContent = `Varsayılan: ${s.varsayilanModel}`;
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
const CEVIRI_MOTORLARI = [["otomatik", "Otomatik"], ["cihaz", "Cihazda"], ["paket", "Paket"], ["anahtar", "Anahtarla"], ["hesap", "Hesabımla"]];
// Hedef dil seçenekleri ve "Kitabın dili" listesi (kısa kod); adları tarayıcı Türkçe verir
const HEDEF_DILLER = ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "uk", "ar", "fa", "el", "bg", "cs", "da", "fi", "hu", "ro", "sv", "ja", "ko", "zh-Hans", "hi"];
const KITAP_DILLERI = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "ru", "ar", "ja", "zh-Hans"];
let dilAdlari = null;
function dilAdi(kod) {
  if (!kod) return "";
  let ad = kod;
  try { ad = (dilAdlari ||= new Intl.DisplayNames(["tr"], { type: "language" })).of(kod) || kod; } catch { /* eski tarayıcı: kod */ }
  return ad.charAt(0).toLocaleUpperCase("tr") + ad.slice(1);
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
  const motor = CEVIRI_MOTORLARI.find(([id]) => id === c.motor)?.[1] || "Otomatik";
  return `${dilAdi(c.hedef)}, ${motor === "Otomatik" ? "motor otomatik" : motor.toLocaleLowerCase("tr")}`;
}
const paketAdi = (p) => `${dilAdi(p.kaynak)} → ${dilAdi(p.hedef)}`;
function ceviriHataMetni(e) {
  return { ag: "Bağlantı yok; internet gelince yeniden dene.", sunucu: "Paket sunucusu şu an cevap vermiyor; biraz sonra yeniden dene.", yer: "Cihazda yer yetmiyor.", bozuk: "İnen dosya doğrulanamadı; yeniden dene.",
    "paket-yok": "Bu dil çifti için paket bulunamadı.", "motor-yok": "Bu Chrome bu dili cihazda çeviremiyor.",
    hareket: "İndirme için düğmeye yeniden dokun." }[e?.tur] || "İndirilemedi.";
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
  const hedefSec = h("select", { "aria-label": "Hedef dil" });
  const secenekleriKur = () => {
    const liste = HEDEF_DILLER.includes(ayar.hedef) ? HEDEF_DILLER : [ayar.hedef, ...HEDEF_DILLER];
    const [ilk, ...diger] = liste;
    hedefSec.replaceChildren(...[ilk, ...diger.sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : dilAdi(a).localeCompare(dilAdi(b), "tr")))]
      .map((k) => h("option", { value: k }, dilAdi(k))));
    hedefSec.value = ayar.hedef;
  };
  secenekleriKur();
  hedefSec.addEventListener("change", () => { kaydet({ hedef: hedefSec.value }); tazele(true); });
  const hedefAlan = h("label", { class: "cv-secim" }, hedefSec, icon("asagi"));

  // Motor tercihi
  const motor = parcali(CEVIRI_MOTORLARI, "Motor", () => ayar.motor || "otomatik", (v) => { kaydet({ motor: v }); motor.guncelle(); tazele(); });
  const anahtarDugme = motor.el.children[3];
  const motorNotu = h("p", { class: "cv-not", role: "status" }, " ");

  // Cihaz motoru (Chrome Translator API)
  const cihazDurum = h("span", {}, "Bakılıyor");
  const cihazIlerleme = h("i", { class: "cv-ilerleme", hidden: true }, h("b"));
  const cihazDugme = h("button", { class: "metin-dugme cv-dugme", type: "button", hidden: true });
  cihazDugme.addEventListener("click", () => {
    if (!M) return;
    const k = ornekKaynak(), hd = ayar.hedef;
    cihazInisi = { kaynak: k, hedef: hd, oran: 0 };
    // create tıklamanın içinde çağrılır: Chrome indirmeyi kullanıcı hareketiyle başlatır
    M.cihazIndir(k, hd, { ilerleme: (o) => { if (cihazInisi) cihazInisi.oran = o; } })
      .then(() => toast(`${dilAdi(k)} cihazda hazır`), (e) => { if (e?.name !== "AbortError") toast(ceviriHataMetni(e)); })
      .finally(() => { cihazInisi = null; if (dlg.isConnected) tazele(); });
    tazele();
  });
  // Tarayıcının yerleşik çevirisi yalnız Chrome'da (Translator API); Safari ve Firefox'ta kart hiç görünmez
  const cihazVar = "Translator" in self;
  const cihazKart = h("div", { class: "cv-kart", hidden: !cihazVar }, icon("ceviri", "cv-kart__ikon"),
    h("div", { class: "cv-kart__govde" }, h("b", {}, "Chrome’un yerleşik çevirisi"), cihazDurum, cihazIlerleme), cihazDugme);

  // Paketler
  const toplamYer = h("span", { class: "cv-toplam" });
  const paketListe = h("div", { class: "cv-paketler", role: "list" });
  const digerSayi = h("span", { class: "cv-sayi" });
  const digerListe = h("div", { class: "cv-paketler", role: "list" });
  const diger = h("details", { class: "yz-gelismis cv-diger" }, h("summary", {}, "Diğer dil çiftleri", digerSayi, icon("asagi")), digerListe);
  const satirlar = new Map();   // "en-tr" -> { el, ilerleme, yuzde }
  let sonPaketler = [];

  const paketSatiri = (p) => {
    const id = `${p.kaynak}-${p.hedef}`;
    const yuzde = h("span", { class: "cv-yuzde" });
    const ilerleme = h("i", { class: "cv-ilerleme" }, h("b"));
    const bilgi = p.durum === "yuklu" ? `Yüklü · ${boyutMetni(p.boyut)}` : `${boyutMetni(p.indirme || p.boyut)} indirilir`;
    let eylem;
    if (p.durum === "yuklu") {
      // Paket yeniden indirilebilir: onay sorulmaz (TASARIM-4 3.6)
      eylem = h("button", { class: "metin-dugme cv-dugme cv-sil", type: "button",
        onclick: () => M?.paketSil(p.kaynak, p.hedef).then(() => toast(`${paketAdi(p)} paketi silindi. Yeniden indirilebilir.`)).catch(() => toast("Silinemedi.")) }, "Sil");
    } else if (p.durum === "iniyor") {
      const dc = paketInisleri.get(id);
      eylem = h("button", { class: "metin-dugme cv-dugme", type: "button", hidden: !dc, onclick: () => paketInisleri.get(id)?.abort() }, "İptal");
    } else {
      eylem = h("button", { class: "metin-dugme cv-dugme", type: "button", disabled: !navigator.onLine,
        title: navigator.onLine ? null : "İnternet gelince indirilir", onclick: () => paketYukle(p) }, icon("indir"), "Yükle");
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
    s.yuzde.textContent = `%${Math.floor(oran * 100)}`;
  };
  const paketYukle = (p) => {
    if (!M) return;
    const id = `${p.kaynak}-${p.hedef}`;
    if (paketInisleri.has(id)) return;
    const dc = new AbortController();
    paketInisleri.set(id, dc);
    M.paketIndir(p.kaynak, p.hedef, { signal: dc.signal })
      .then(() => toast(`${paketAdi(p)} paketi yüklendi; artık internetsiz çevrilir`),
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
    if (!ust.length) paketListe.append(h("p", { class: "cv-not" }, "Bu dile çeviren paket yok; Cihazda ya da Hesabımla çevrilir."));
    digerSayi.textContent = alt.length ? String(alt.length) : "";
    diger.hidden = !alt.length;
    // Uzun liste yalnız açılınca çizilir
    if (diger.open) digerListe.replaceChildren(...alt.map(paketSatiri));
    else digerListe.replaceChildren();
    yerYaz();
  }
  diger.addEventListener("toggle", () => { if (diger.open) paketleriCiz(); });

  // Önbellek
  const onbellekYazi = h("small", {}, "Çevrilen paragraflar burada saklanır; gerekince yeniden çevrilir.");
  const onbellekEtiket = h("span", {}, "Çeviri önbelleğini temizle");
  const onbellekDugme = h("button", { class: "fis-satir onayli cv-onbellek", type: "button" }, icon("sil", "i-20"), h("span", {}, onbellekEtiket, onbellekYazi));
  onbellekDugme.addEventListener("click", () => {
    M?.ceviriOnbellekTemizle().then(() => { toast("Çeviri önbelleği temizlendi. Gerekince yeniden çevrilir."); yerYaz(); }).catch(() => toast("Temizlenemedi."));
  });
  async function yerYaz() {
    if (!M) return;
    const y = await M.ceviriYeri().catch(() => null);
    if (!y || !dlg.isConnected) return;
    toplamYer.textContent = y.paket ? `Toplam ${boyutMetni(y.paket)}` : "";
    onbellekYazi.textContent = y.onbellek ? `Çevrilen paragraflar, ${boyutMetni(y.onbellek)}. Gerekince yeniden çevrilir.` : "Önbellek boş.";
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
    let not = !s ? `${yon}: hazır motor yok. Aşağıdan paketi yükle.`
      : `${yon}: ${s.ad}, ${s.cevrimdisi ? "internetsiz" : "metin internete gider"}.`;
    if (tercih !== "otomatik" && d.secilen !== tercih) not += " Seçtiğin motor hazır değil, sıradaki kullanılıyor.";
    motorNotu.textContent = not;
    // Cihaz kartı
    const c = m("cihaz")?.durum || "yok";
    const iniyor = cihazInisi && cihazInisi.hedef === hd;
    cihazIlerleme.hidden = !(c === "iniyor" || iniyor);
    if (!cihazIlerleme.hidden) cihazIlerleme.firstChild.style.transform = `scaleX(${cihazInisi?.oran || 0})`;
    cihazDugme.hidden = c !== "indirilebilir" || iniyor;
    cihazDugme.textContent = `${dilAdi(k)} paketini indir`;
    cihazKart.dataset.durum = c;
    cihazDurum.textContent = c === "hazir" ? `Bu cihazda var. ${yon} hazır, internetsiz.`
      : c === "indirilebilir" ? `Bu cihazda var. ${dilAdi(k)} paketi Chrome’dan bir kez iner.`
      : c === "iniyor" || iniyor ? "Chrome paketi indiriyor."
      : "Bu Chrome’da yok. Çeviri paketleri aynı işi internetsiz görür.";
    anahtarDugme.disabled = !anahtarVar() && tercih !== "anahtar";
    anahtarDugme.title = anahtarVar() ? "" : "Asistanda kayıtlı API anahtarı yok";
  }
  function tazele(hepsi = false) {
    durumYaz();
    if (hepsi) paketleriCiz();
  }

  const dlg = h("dialog", { class: "pencere yz-pencere ceviri-pencere", "aria-labelledby": "cvBaslik" },
    h("div", { class: "yz-ust" },
      h("h2", { class: "t-b1", id: "cvBaslik" }, "Çeviri"),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "cv-ikili" },
      h("div", {}, h("span", { class: "t-etiket" }, "Hedef dil"), hedefAlan),
      h("div", {}, h("span", { class: "t-etiket" }, "Motor"), motor.el)),
    motorNotu,
    cihazVar ? h("span", { class: "t-etiket" }, "Cihazda") : null, cihazKart,
    h("div", { class: "cv-baslik" }, h("span", { class: "t-etiket" }, "Çeviri paketleri"), toplamYer),
    paketListe, diger,
    h("p", { class: "yz-uyari" }, icon("kilit"), h("span", {}, "Paketler Mozilla’nın açık çeviri modelleridir. Bir kez iner, sonra internetsiz çalışır; metin cihazdan çıkmaz.")),
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
  }, () => { motorNotu.textContent = "Çeviri yüklenemedi."; });
}

// Kitabın dili: belge.dil (kısa kod; null: bakıldı, bulunamadı), belge.dilElle (kullanıcı seçti)
const dilDestekli = (b) => b.tur !== "cizgi" && !b.cizgi;
function dilOzet(b) {
  if (b.dilElle && b.dil) return dilAdi(b.dil);
  if (b.dil) return `${dilAdi(b.dil)}, otomatik`;
  return b.dil === null ? "Otomatik, bulunamadı" : "Otomatik";
}
// İlk sayfaların metninden (EPUB'da paket bilgisinden) dil bulunur. Örnek belgeler Türkçedir.
async function dilBelirle(b) {
  if (!dilDestekli(b)) return null;
  if (b.tur === "defter") {
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
  const { pdfAc } = await import("./pdf-belge.js");
  const pdf = await pdfAc(blob);
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
    dilBak(b).then((dil) => toast(dil ? `Kitabın dili: ${dilAdi(dil)}` : "Dil bulunamadı; elle seçebilirsin"));
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
  // iz: İzler listesinden gelen iz kimliği; modül o ize gider ve izi bir an parlatır
  const ek = { ara: ara || undefined, konum: konum || undefined, iz: iz || undefined };
  const belge = belgeBul(id);
  if (!belge) {
    acikPencere?.close();
    toast("Bu belge kitaplıkta yok.");
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
    modulHatasi(hata, cizgi ? "Çizgi roman okuyucu henüz hazır değil." : belge.tur === "epub" ? "Okuma görünümü henüz hazır değil." : "Düzenleyici henüz hazır değil.");
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
    toast("Bu belge açılırken bir sorun çıktı.");
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
    modulHatasi(hata, "Tekrar ekranı henüz hazır değil.");
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "tekrar" }, "#tekrar");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-tekrar", "aria-label": "Tekrar" });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "tekrar", mod: null });
  document.title = "Tekrar · Kenar Notu";
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
    toast("Tekrar ekranı açılırken bir sorun çıktı.");
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
  if (gorunsun) await soldur(kap, hareketAz() ? 120 : 200);
  eski?.kap.remove();
  if (kitaplikGorunur) kitaplikGizle();
}

// Arama ekranı (arama.js: ac(kap, { terim }) ve kapat()). Tekrar gibi kitaplığın ya da açık ekranın üstüne gelir.
async function aramaAc({ gecmis = "it", terim } = {}) {
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
    modulHatasi(hata, "Arama ekranı henüz hazır değil.");
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "arama" }, "#arama");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-arama", "aria-label": "Ara" });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "arama", mod: null });
  document.title = "Ara · Kenar Notu";
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
    toast("Arama ekranı açılırken bir sorun çıktı.");
    setTimeout(() => bus.emit("git", { ekran: "kitaplik" }), 0);
  }
  if (gorunsun) await soldur(kap, hareketAz() ? 120 : 200);
  eski?.kap.remove();
  if (kitaplikGorunur) kitaplikGizle();
}

// İzlerim ekranı (izler.js: ac(kap) ve kapat()). Arama gibi kitaplığın ya da açık ekranın üstüne gelir.
async function izlerAc({ gecmis = "it" } = {}) {
  if (acik.ekran === "izler" && acik.kap) return;
  fisKapat(true);
  cekmeceKapat();
  let modul;
  try {
    modul = await import("./izler.js");
    if (typeof modul.ac !== "function") throw new Error("ac() dışa aktarılmamış");
  } catch (hata) {
    console.warn("[kenar-notu] İzler modülü yüklenemedi:", hata);
    modulHatasi(hata, "İzlerim ekranı açılamadı.");
    if (K.ekran.hidden && !acik.kap) return kitapligaDon({ gecmis: "degistir", animasyon: false });
    return;
  }
  gecmisYaz(gecmis, { ekran: "izler" }, "#izler");

  const eski = acik.kap ? { ...acik } : null;
  const kitaplikGorunur = !K.ekran.hidden;
  const kap = h("section", { class: "ekran ekran-belge ekran-izler", "aria-label": "İzlerim" });
  Object.assign(acik, { modul, kap, belgeId: null, ekran: "izler", mod: null });
  document.title = "İzlerim · Kenar Notu";
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
    toast("İzlerim ekranı açılırken bir sorun çıktı.");
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
  izlerModulu().then((m) => m.defterAc(b)).catch((hata) => { console.warn("[kenar-notu] Cep defteri açılamadı:", hata); modulHatasi(hata, "Cep defteri açılamadı."); });
});
bus.on("izler:ac", (o) => {
  const b = belgeBul(o?.belgeId);
  if (!b) return;
  izlerModulu().then((m) => m.izlerPaneliAc(b, o)).catch((hata) => { console.warn("[kenar-notu] İzler açılamadı:", hata); modulHatasi(hata, "İzler açılamadı."); });
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
  if (document.querySelector("dialog[open], .karsilama")) return;
  if (e.key === "Escape" && K.kenar.classList.contains("acik")) { cekmeceKapat(); return; }
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

/* ---------- Hızlı erişim komutları (kabuğun komutları; Koltuk ve Masa kendi komutlarını ekler) ---------- */
const sonIz = (b) => {
  const izler = Array.isArray(b?.veri?.izler) ? b.veri.izler : [];
  return izler.reduce((m, x) => ((x?.zaman || 0) > (m?.zaman || 0) ? x : m), null);
};
function komutlarKur() {
  const git = (ekran) => () => bus.emit("git", { ekran });
  [
    { id: "git-kitaplik", grup: "git", ad: "Kitaplık", es: "ana ekran raf", ikon: "tumu", calistir: git("kitaplik") },
    { id: "git-izler", grup: "git", ad: "İzlerim", es: "iz altını çizdiklerim alıntı cep defteri", ikon: "izler", calistir: git("izler") },
    { id: "git-tekrar", grup: "git", ad: "Tekrar", es: "kart çalış leitner", ikon: "tekrar", alt: () => { const n = bugunTekrar().length; return n ? `${n} kart` : ""; }, calistir: git("tekrar") },
    { id: "ayarlar", grup: "git", ad: "Ayarlar", es: "tercihler seçenekler", ikon: "ayarlar", calistir: () => ayarlarAc() },
    { id: "dosya-ac", ad: "Dosya aç", es: "içe aktar pdf epub cbz ekle kitap", ikon: "pdf", calistir: () => dosyaSec() },
    { id: "yeni-defter", ad: "Yeni defter", es: "defter not defteri kâğıt", ikon: "yeni-defter", calistir: () => yeniDefterPenceresi() },
    { id: "yedekle", ad: "Yedekle", es: "yedek kenar dışa aktar", ikon: "yedekle", calistir: () => yedekAlIstegi() },
    { id: "yedekten-yukle", ad: "Yedekten yükle", es: "geri yükle kenar", ikon: "yedekle", calistir: () => yedekSec() },
    { id: "tema-acik", ad: "Tema: Açık", es: "aydınlık gündüz beyaz", ikon: "tema-acik", calistir: () => ayarla({ tema: "acik" }) },
    { id: "tema-koyu", ad: "Tema: Koyu", es: "karanlık gece siyah", ikon: "tema-koyu", calistir: () => ayarla({ tema: "koyu" }) },
    { id: "tema-oto", ad: "Tema: Otomatik", es: "sistem", ikon: "tema-oto", calistir: () => ayarla({ tema: "oto" }) },
    { id: "kart-calis", ad: "Kart çalış", es: "tekrar kart leitner", ikon: "tekrar", calistir: git("tekrar") },
    { id: "rehber", ad: "Rehberi yeniden göster", es: "yardım nasıl ipucu", ikon: "sor", calistir: () => rehberBaslat(0) },
    { id: "ex-libris", ad: "Ex libris çiz", es: "mühür imza monogram", ikon: "damga", calistir: () => ayarlarAc({ bolum: "exlibris" }) },
    { id: "ceviri-ayar", ad: "Çeviri ayarları", es: "çeviri paket dil translate", ikon: "ceviri", calistir: () => ceviriPenceresi() },
    { id: "son-iz", baglam: "belge", ad: "Son izime git", es: "iz altını çizdiğim", ikon: "izler", kosul: (c) => !!sonIz(c.belge),
      calistir: (c) => bus.emit("git", { ekran: "belge", belgeId: c.belge.id, izId: sonIz(c.belge).id }) },
    { id: "sayfaya-git", baglam: "pdf", sayi: true, ad: (c, q) => (/^\d+$/.test(q || "") ? `Sayfaya git: ${q}` : "Sayfaya git"), es: "sayfa git", ikon: "sayfalar",
      calistir: (c, q) => { const n = parseInt(q, 10); if (n > 0) bus.emit("git", { ekran: "belge", belgeId: c.belge.id, sayfa: Math.min(n, c.belge.sayfaSayisi || n) }); } },
    { id: "masada-ac", baglam: "belge", ad: "Masa’da aç", es: "çalış masa mod", ikon: "masa", kosul: (c) => c.mod === "koltuk" && !cizgiMi(c.belge),
      calistir: (c) => bus.emit("git", { ekran: "belge", belgeId: c.belge.id, mod: "masa" }) },
    { id: "koltukta-ac", baglam: "belge", ad: "Koltuk’ta aç", es: "oku koltuk mod", ikon: "koltuk", kosul: (c) => c.mod === "masa" && !cizgiMi(c.belge),
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
const ORNEK_KIRPINTILAR = [
  { s: 0, b: [62, 268, 676, 176], belgeId: "kalkulus", not: "Zincir kuralı: dış türev çarpı iç türev", dk: 35 },
  { s: 1, b: [200, 282, 400, 348], belgeId: "kalkulus", not: "Teğet, yarıçapa diktir. Eğimler çarpımı -1", dk: 3 * 60 },
  { s: 2, b: [96, 300, 620, 232], belgeId: "statik", not: "Önce serbest cisim diyagramı, sonra A’ya göre moment", dk: 26 * 60 },
  { s: 0, b: [62, 455, 676, 100], belgeId: "kalkulus", not: "Leibniz: du’lar sadeleşiyormuş gibi düşün", dk: 50 * 60 },
  { s: 0, b: [62, 540, 676, 200], belgeId: "kalkulus", not: "", dk: 4 * 24 * 60 },
];
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
  const ad = (id) => belgeBul(id)?.ad || (id === "statik" ? "Statik" : "Kalkülüs II");
  // PDF düzenleyicide kaldığı sayfadan başlayan bir kesitle açılır; kırpıntının numarası o kesitteki numaradır
  const no = (id, i) => (belgeBul(id)?.sayfa || 1) + i;
  const t = Date.now();
  store.kirpintilar.push(...ORNEK_KIRPINTILAR.map((o, i) => ({
    id: yeniId("k"), gorsel: gorseller[i], belgeId: o.belgeId, belgeAd: ad(o.belgeId), sayfa: no(o.belgeId, o.s), not: o.not,
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
// Dosyası olan (dosya: true) belgeye ve EPUB'lara dokunulmaz (EPUB örnek metni sürümler boyunca aynı).
const SUS = { lacivert: "#1F3A68", kirmizi: "#C2412D", not: "Sınavda çıkar! İç fonksiyondan başla." };
// Diferansiyel Denklemler defterinin 1. sayfasındaki hazır çözüm: 6. turdaki düz metin ve 7. turdaki el yazısı (el: true)
const DIFDENK_ESKI = new Set(["Örnek 2.1    y′ = 2y,   y(0) = 3", "Değişkenlerine ayır:", "dy / y = 2 dx", "∫ dy / y = ∫ 2 dx    ⇒    ln |y| = 2x + c",
  "y = C · e²ˣ", "y(0) = 3    ⇒    C = 3", "y = 3 e²ˣ", "Sağlama: y′ = 6 e²ˣ = 2y"]);
const DIFDENK_YENI = new Set(["Örnek 2.1", "y′ = 2y,  y(0) = 3", "Değişkenlerine ayır:", "dy", "y", "= 2 dx", "= ", "2 dx", "ln", "= 2x + c",
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
    if (alan === "notlar") return o.metin === SUS.not;
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
  kayit.ornekSurumAyarla(Math.max(kayitSurumu || 0, ORNEK_SURUM));
  // Sürüm damgası da yazılsın: bir dahaki açılış yeniden tahmin etmesin
  if (degisti || kayitSurumu !== ORNEK_SURUM) kayit.kaydetPlanla();
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
  if (i < 0 && k.not) i = ORNEK_KIRPINTILAR.findIndex((o) => o.not === k.not && o.belgeId === k.belgeId);
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
    id: yeniId("d"), tur: "defter", ad: "İlk defter", sayfaSayisi: 3, sayfa: 1, ilerleme: 0, favori: false,
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
      icon(ikon), h("b", {}, ad), h("small", {}, aciklama), birincil ? h("span", { class: "onerilen" }, "Önerilen") : null);
    d.addEventListener("click", () => sec(fn));
    return d;
  };
  const ornek = secenek("tumu", "Örneklerle başla", "Ders notları, kitaplar, defterler, bir çizgi roman ve kartlarla dolu bir masa. İstediğinde Ayarlar’dan temizlersin.", ornekleBasla, true);
  const bosD = secenek("yeni-defter", "Boş başla", "Yalnız boş bir defter. Kendi PDF, EPUB ve CBZ dosyalarını içe aktarırsın.", () => {
    bosBasla();
    klasorlerCiz();
    setTimeout(() => toast("Boş bir defter hazır. Yeni düğmesinden PDF, EPUB ya da CBZ içe aktarabilirsin."), 400);
  });
  // Alt satır platforma göre (TASARIM-4 1.2): telefonda çoğu kişinin kalemi yok, masaüstünde satır yok
  const ipucu = { spen: "S Pen yazar, parmak kaydırır. Ayarlar’dan değişir.", pencil: "Apple Pencil yazar, parmak kaydırır. Ayarlar’dan değişir.",
    kalem: "Kalem yazar, parmak kaydırır. Ayarlar’dan değişir.", parmak: "Parmağınla kaydır, kalem simgesiyle yaz." }[kalemTuru()] || null;
  // TASARIM-3 6.1: logo vitrinde, altında tek cümle ve bir kenar notu satırı (edebiyat solda, bilim sağda)
  // Kart seçili görünmesin: odak pencerenin kendisine gider, halka yalnız klavyeyle gezince kartta çıkar
  const el = h("div", { class: "karsilama", role: "dialog", "aria-modal": "true", "aria-labelledby": "karsilamaBaslik", tabindex: "-1" },
    h("div", { class: "karsilama__ic" },
      h("div", { class: "logo" }, parca(LOGO_SVG)),
      h("h1", { class: "t-vitrin", id: "karsilamaBaslik" }, "Kenar Notu"),
      h("p", {}, "PDF, kitap ve defterlerin kalemle yazılan bir masada. Yazdıkların yalnız bu cihazda kalır."),
      h("p", { class: "karsilama__kenar" }, h("i", {}, "Kitabın kenarı, düşüncenin yeri.")),
      h("p", { class: "karsilama__tarih t-deger-k", title: "Leibniz ∫ işaretini ilk kez 29 Ekim 1675’te yazdı" }, "∫ 29.10.1675"),
      h("div", { class: "karsilama__secenekler" }, ornek, bosD),
      ipucu ? h("p", { class: "karsilama__ipucu" }, ipucu) : null));
  let secildi = false;
  async function sec(fn) {
    if (secildi) return;
    secildi = true;
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
  setTimeout(() => bosta(yukle, { timeout: 4000 }), 3000);
}

/* ================= Başlat ================= */
ayarlariUygula(true);
// Kayıtlı durum varsa örneklerin yerine geçer; yoksa karşılama sorar (ya da sıfırlamadan gelen istek)
const ilkDurum = await durumGeriYukle();
const baslangic = baslangicIstegi();
let karsilama = false;
if (ilkDurum.geri) {
  // Eski sürümün örnek verisi belge açılmadan yeni düzene geçer; görüntüleri boş bir anda yeniden kesilir
  try { ornekVeriyiTasi(ilkDurum.ornekSurum || 0); } catch (hata) { console.warn("[kenar-notu] Örnek veri taşınamadı:", hata); }
  setTimeout(() => ornekGorselleriTazele().catch((hata) => console.warn("[kenar-notu] Örnek görüntüler yenilenemedi:", hata)), 2000);
  // Kayıtta kart alanı hiç yoksa örnek kartlar bir kez istenir
  if (!ilkDurum.kartlarVar) ornekKartlar();
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
  ? "Kayıt okunamadı; bu oturumda yapılanlar saklanmaz. Sayfayı yenilemeyi dene."
  : "Kitaplık başka bir sekmede açık; kayıt için onu kapatıp yenile.", { kalici: true, etiket: "Tamam" });
// Yedekten yüklenip yenilendiyse sonucu söyle
try {
  const y = JSON.parse(sessionStorage.getItem("kn-tasarim:yedek-sonuc") || "null");
  sessionStorage.removeItem("kn-tasarim:yedek-sonuc");
  const eksik = y?.eksik ? ` Dosyası yedekte olmayan ${y.eksik} belge alınmadı.` : "";
  if (y) toast((y.eklenen || y.guncellenen ? `Yedek yüklendi: ${y.eklenen} belge eklendi, ${y.guncellenen} güncellendi.` : "Yedek yüklendi; belgeler zaten güncel.") + eksik);
} catch { /* gizli pencere */ }
// Karşılama açıksa seçim yapılınca başlar (silinecek örnekler dizinlenmesin)
if (!karsilama) aramaDizininiBaslat();
// iOS'ta Safari sekmesinde bir kez kurulum fişi
if (!karsilama) setTimeout(() => iosKurulumFisi(), 3000);
// Yeni sürüm devreye girdi (sw.js skipWaiting ve claim): açık sayfa eski modüllerle kalır, sonradan yüklenen
// ekranlar eski ortak.js ile uyuşmaz. Kullanıcıya yenilemesi söylenir; yenilemeden önce her şey yazılır.
const ilkDenetci = navigator.serviceWorker?.controller;
navigator.serviceWorker?.addEventListener("controllerchange", () => { if (ilkDenetci) guncellemeVar(); });
// Hizmet çalışanı önbelleğe yazamadı (depo dolu): çevrimdışı açılış eksik kalabilir
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e.data?.tur === "kota") toast("Cihazda yer azaldı; çevrimdışı açılış eksik kalabilir. Yer aç ya da yedek al.", { etiket: "Yedekle", calistir: () => yedekPenceresi() });
});
// "Açılışta son belgeyle başla" (TASARIM-4 3.4): kitaplık geçmişte kalır, geri hareketi oraya döner
if (!karsilama && store.ayarlar.sonBelgeyleBasla && konumuOku().ekran === "kitaplik" && !location.hash) {
  const son = store.belgeler.reduce((m, b) => ((b.acilis || 0) > (m?.acilis || 0) ? b : m), null);
  if (son) belgeAcIstegi(son, null);
}
// Önceki turlarda alınmış EPUB'ların dili (çeviri düğmeleri için) boşta tamamlanır
setTimeout(eskiDilleriTamamla, 6000);
// İçe aktarırken kapağı çıkmamış belgeler sırayla tamamlanır (açılışı yavaşlatmadan)
setTimeout(async () => {
  for (const b of store.belgeler.filter((x) => x.dosya && !x.kapakGorsel && !x.kapakDenendi)) {
    try { await kayit.kapakTamamla(b); } catch { /* bir dahaki açılışa */ }
  }
}, 2500);
// Paylaş menüsüyle gelen dosya ya da metin (PWA); paylasim.js yoksa sessiz geçilir.
// Asistan önce kurulur: paylaşılan metin bekleyen soruya cevap olarak gidebilsin.
asistanHazir.then(() => import("./paylasim.js")).then((m) => m.paylasimKontrol?.()).catch(() => {});
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
  if (!soylendi) setTimeout(() => toast("Güvenli bağlantı değil: çevrimdışı açılış ve paylaş menüsü kapalı. Tam sürüm için localhost ya da https ile aç."), 1200);
}
