// EPUB okuma görünümü (TASARIM 3.27 ve 6.5, TASARIM-2 §4).
// İki mod: "koltuk" sade okuma (yalnız metin, dokunma bölgeleri, cetvel, gizli kalem; ortak parçalar koltuk.js'te)
// ve "masa" bütün araçlar (Aa, vurgular, kenar notları, kalem, fosforlu, silgi, kırp).
// Sözleşme: ac(kap, belge, sayfa, mod, { ara, konum }), git({ sayfa, ara, konum }), modDegistir(mod), kaydet() ve kapat().
//   konum: { p, oran } paragraf ve paragraf içi oran; varsa sayfadan önce gelir. ara: o yerdeki eşleşmeler kısa süre parlar.
//
// belge.veri (oturum boyunca kalır):
//   vurgular:  [{ id, renk: "limon"|"pembe"|"nane"|"gok", bas: { p, o }, son: { p, o }, not, zaman }]
//              p: paragraf sırası (sahne ayraçları sayılmaz), o: paragraf metnindeki karakter ofseti.
//              Metne bağlı oldukları için yazı tipi, boyut ve ölçü değişince de doğru yerde kalırlar.
//   cizgiler:  kalem.js çizgileri ve ap (bağlı olduğu paragraf). Birim: sütun genişliği / BIRIM.
//              x sütunun soluna, y bağlı paragrafın üstüne göredir; düzen değişince paragrafıyla kayar.
//   yerImleri: [{ id, p, zaman }]
//   konum:     { p, oran } ekrandaki ilk paragraf ve onun içindeki oran
//   asistanNotlari: [{ id, p, metin, kaynak, zaman }] asistanın "Kenara not" cevapları, paragrafa bağlı
//   tuvaller:  [{ id, p, oran, yukseklik, cizgiler, kucuk?, bolum? }] Active Canvas: satır arasına açılan el yazısı boşluğu.
//              p paragraf, oran karakter oranı (o = oran × metin uzunluğu): boşluk o'dan önceki harfin satırının altına açılır.
//              yukseklik ve çizgiler (kalem.js biçimi) sütun genişliği / BIRIM biriminde; x sütunun soluna, y boşluğun
//              üstüne göre. Yazı boyutu ya da sütun değişince boşluk metinle gider, el yazısı sütunla ölçeklenir.
//              kucuk: satır içinde simge olarak duruyor. bolum: dışa aktarma için bölüm adı (kitap açılmadan okunur).
//   izler:     [{ id, tur, zaman, renk, metin, bas, son, cizgiler, capa, bolum? }] Koltuk'ta kalemin metne bıraktığı izler
//              (OZELLIKLER-5 İzler sözleşmesi, EPUB biçimi). Ayrıntı "İzler" bölümünde. Eski kayıtta yoksa [].
//   sonOkuma:  son okuma zamanı (ms); uzun aradan dönünce son satır bir an belirir

import {
  h, icon, bus, store, ayarla, toast, hareketAz, kirpintiEkle, yeniId, belgeBul, ikiDokunus,
  varsayilanMod, kartEkle, kartSil, panoyaYaz, YZ_UYGULAMALAR, YZ_SAGLAYICILAR,
  MUREKKEPLER, FOSFORLAR, EPUB_VURGULARI, VARSAYILAN_KALEMLER,
} from "./ortak.js";
import * as ortak from "./ortak.js";   // sayfaCoz ve vurguRengi: kabuk eklemediyse yerel yedek çalışır
import { koltukKur, modAnahtari } from "./koltuk.js";
import {
  cizgiCiz, CanliKatman, islakBitir, islakAktar, silgi as silgiUygula,
  duzlestir, ornekDalga, Gecmis, anlik, genislik,
} from "./kalem.js";
import METIN, { SAHNE } from "./okuma-metni.js";
import { epubCoz, epubSurumu, bicimCoz } from "./epub-belge.js";

// ---------- sabitler ----------
const BIRIM = 640;        // sütun genişliği, mürekkep biriminde (varsayılan düzende 1 birim ≈ 1,15 px)
const KARO = 512;         // mürekkep karosunun yüksekliği (CSS px); yalnız çizgi olan karolar tuval alır
const DAKIKADA = 200;     // okuma hızı (kelime)
const SAYFADA = 250;      // sanal sayfa: kitaplık ve kırpıntılar için "s. 4"
const UST = 56;           // üst çubuk; "ekrandaki ilk paragraf" bunun altından ölçülür
const SVG_NS = "http://www.w3.org/2000/svg";

const VURGU_ID = { Limon: "limon", Pembe: "pembe", "Gül kurusu": "pembe", Nane: "nane", "Gök": "gok" };
// Eski parlak tonlar kayıtlarda kalabilir: yeni, soluk tona çevrilir (ortak.vurguRengi yoksa bu tablo)
const ESKI_VURGU = { "#F49CC0": "#E9A79C", "#7FD3A0": "#9CCFAE", "#86C3F2": "#9DBEE0", "#F7A65A": "#F2B27A" };
const vurguTon = (hex) => (typeof ortak.vurguRengi === "function" ? ortak.vurguRengi(hex) : ESKI_VURGU[String(hex).toUpperCase()] || hex);
const VURGULAR = EPUB_VURGULARI.map(([ad, renk]) => ({ id: VURGU_ID[ad] || ad.toLocaleLowerCase("tr"), ad, renk: vurguTon(renk) }));
const vurguRengi = (id) => (VURGULAR.find((v) => v.id === id) || VURGULAR[0]).renk;
const vurguSinifi = (id) => "vurgu" + (id && id !== "limon" ? " vurgu--" + id : "");

const AILELER = [
  { id: "serif", ad: "Serif", css: "var(--f-okuma)" },
  { id: "sans", ad: "Sans", css: "var(--f-arayuz)" },
  { id: "el", ad: "El yazısı", css: "var(--f-el-okuma)" },
];
const SATIRLAR = [{ deger: 1.45, ikon: "satir-dar", ad: "Sık" }, { deger: 1.62, ikon: "satir-orta", ad: "Orta" }, { deger: 1.85, ikon: "satir-genis", ad: "Geniş" }];
const OLCULER = [{ deger: 72, ikon: "olcu-genis", ad: "Dar" }, { deger: 66, ikon: "olcu-orta", ad: "Orta" }, { deger: 58, ikon: "olcu-dar", ad: "Geniş" }];
const SAYFA_RENKLERI = [
  { id: "beyaz", ad: "Beyaz", kd: "#FDFBF6", kdy: "#24211E" },
  { id: "sepya", ad: "Sepya", kd: "#F5EDDA", kdy: "#3B2F22" },
  { id: "gece", ad: "Gece", kd: "#1B1A17", kdy: "#D9D0BE" },
  { id: "tahta", ad: "Tahta", kd: "#1F2622", kdy: "#DCD8CB" },
];
const SAYFA_META = { beyaz: "#FDFBF6", sepya: "#F5EDDA", gece: "#141413", tahta: "#1F2622" };   // tarayıcı çubuğu sayfayla bir olsun
const KOYU_SAYFA = new Set(["gece", "tahta"]);
const SAYFA_ADI = { beyaz: "Beyaz", sepya: "Sepya", gece: "Gece", tahta: "Tahta" };
// Hazır okuma temaları (TASARIM-2 §4.6). Kullanıcının kaydettikleri store.ayarlar.okumaTemalari'nda.
const HAZIR_TEMALAR = [
  { id: "gunduz", ad: "Gündüz", boyut: 19, satir: 1.62, olcu: 66, aile: "serif", sayfa: "beyaz" },
  { id: "gece", ad: "Gece okuması", boyut: 20, satir: 1.7, olcu: 66, aile: "serif", sayfa: "gece" },
  { id: "sinav", ad: "Sınav haftası", boyut: 18, satir: 1.85, olcu: 58, aile: "serif", sayfa: "sepya" },
  { id: "tahta", ad: "Tahta", boyut: 19, satir: 1.62, olcu: 66, aile: "serif", sayfa: "tahta" },
];
const TEMA_DEPO = "kn-tasarim:okuma-temalari";
const KALEM_AVUC = 600;   // kalem görüldükten (temas ya da hava) sonra bu kadar ms dokunuş çizmez ve sayfa çevirmez
const KALEM_ADI = { dolma: "Dolma kalem", tukenmez: "Tükenmez", kursun: "Kurşun kalem", fosforlu: "Fosforlu" };
const KALEM_TURLERI = ["tukenmez", "dolma", "kursun"];
const KALEM_SVG = {
  dolma: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="altin" d="M10 .8C12.4 4 13.6 7.6 13.6 12H6.4C6.4 7.6 7.6 4 10 .8Z"/><path class="yarik" d="M10 3.2v5.4"/><circle class="delik" cx="10" cy="9.3" r=".9"/><path class="boyun" d="M6.4 12h7.2l.6 7H5.8Z"/><rect class="u" x="5.6" y="19" width="8.8" height="3.2"/><path class="g" d="M5.6 22.2h8.8V56H5.6Z"/><path class="faset" d="M7.8 26v14"/></svg>',
  tukenmez: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><circle class="u" cx="10" cy="2.4" r="1.5"/><path class="m" d="M9 3.6h2l2.6 7.4H6.4Z"/><rect class="u" x="6" y="11" width="8" height="9" rx=".8"/><path class="g" d="M6 20h8v36H6Z"/><path class="faset" d="M8.2 24v14"/></svg>',
  kursun: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="ahsap" d="M8.1 5h3.8L14 12H6Z"/><path class="u" d="M10 .9 11.9 5H8.1Z"/><path class="u" d="M6 12l1.3-1.2L8.7 12l1.3-1.2 1.3 1.2 1.4-1.2L14 12v44H6Z"/><path class="faset" d="M8.7 12v44M11.3 12v44"/></svg>',
  fosforlu: '<svg class="kalem-svg" viewBox="0 0 20 56" aria-hidden="true"><path class="u yari" d="M7 10.5 13 3.5v7Z"/><path class="m" d="M5.6 10.5h8.8l.8 3.5H4.8Z"/><rect class="u" x="4" y="14" width="12" height="5"/><path class="g" d="M4 19h12v37H4Z"/></svg>',
};
const KALEM_KALINLIKLARI = [[0.3, 4], [0.6, 7], [1.2, 11]];   // [mm, nokta px]
const FOSFOR_KALINLIKLARI = [[14, 6], [22, 10], [32, 16]];    // [birim, nokta px]
const SILGI_BOYLARI = [[8, 6], [14, 10], [28, 16]];           // [yarıçap birim, nokta px]
const SIK_MUREKKEP = ["#1F3A68", "#1B1B1F", "#7D1D2C", "#1F6B52", "#C2412D", "#5C5F66"];
const HEDERA = ["M26 8C23 4 20 2.4 16.6 2.6 13.2 2.8 12 5 13.6 8 12 11 13.2 13.2 16.6 13.4 20 13.6 23 12 26 8Z",
  "M13.6 8C9 8 5.5 6.6 4.4 4.4 3.6 2.8 4.8 1.6 6.2 2.2 7.4 2.8 7 4.4 5.8 4.6"];
const SAHNE_YOLU = "M6 6 9 3l3 3-3 3ZM17 6l3-3 3 3-3 3ZM28 6l3-3 3 3-3 3Z";

// "Kâğıdın Hafızası" ilk açılışta birkaç vurgu ve kenar notuyla gelir (tanıtım)
const TOHUMLAR = [
  { renk: "gok", metin: "cevabı gecikmiş bir mektuba dönüştü", not: "Son paragrafla birlikte oku." },
  { renk: "limon", metin: "Kenar boşluğu, matbaacının okura bıraktığı tek boş sandalyedir.", not: "Bütün deneme bu cümleden filizleniyor." },
  { renk: "pembe", metin: "Çığ ışığı, İğne, Öğüt, Şükür." },
  { renk: "nane", metin: "kitabın kendiliğinden açıldığı sayfa ise okurlarının en çok neye ihtiyaç duyduğunu." },
];

// ---------- küçük yardımcılar ----------
const sinirla = (v, a, b) => Math.min(b, Math.max(a, v));
const sayi = (n) => n.toLocaleString("tr");
const yuzde = (o) => "%" + Math.round(sinirla(o, 0, 1) * 100);
const mmMetni = (mm) => mm.toLocaleString("tr", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " mm";
const kars = (a, b) => a.p - b.p || a.o - b.o;
const egri = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // --egri-murekkep yaklaşığı
const kelimeSay = (s) => (s.match(/\S+/g) || []).length;
const HARF = /[\p{L}\p{N}’']/u;
// Arama için katla: Türkçe küçük harf, şapka yok sayılır. Uzunluk değişmez, ofsetler korunur.
const katla = (s) => s.toLocaleLowerCase("tr").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u").replace(/’/g, "'");
// Aksansız eşleşme (ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c); uzunluk değişmez, ofsetler metne denk kalır
const AKSAN = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" };
const aksansiz = (s) => katla(s).replace(/[ışğüöç]/g, (c) => AKSAN[c]);

function renkAdi(hex) {
  const k = String(hex).toUpperCase();
  const r = [...MUREKKEPLER, ...FOSFORLAR].find(([, x]) => x.toUpperCase() === k);
  return r ? r[0] : hex;
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- metin modeli ----------
// Açık belgeye göre kurulur (modeliKur), kapatınca bırakılır. Örnek belgeler okuma-metni.js'ten,
// dosyası olan EPUB'lar epub-belge.js'ten gelir. Diziler yerinde doldurulur: bütün kod aynı P'ye bakar.
const SIRA = ["Birinci", "İkinci", "Üçüncü", "Dördüncü", "Beşinci", "Altıncı", "Yedinci", "Sekizinci", "Dokuzuncu", "Onuncu"];
const P = [];          // { gi, b, metin, bicim, kelime, onceki }  bicim: [{ a, b, i, k }] italik/kalın aralıkları ya da null
const BOLUMLER = [];   // { i, baslik, ad, ilk, son, kelime, onceki, bloklar }
let TOPLAM = 0;
let SAYFA_SAYISI = 1;
let KITAP = null;      // { baslik, yazar, dil }

function modeliKur(kitap, { bicimli = false } = {}) {
  P.length = 0;
  BOLUMLER.length = 0;
  TOPLAM = 0;
  KITAP = { baslik: kitap.baslik, yazar: kitap.yazar, dil: kitap.dil };
  for (const b of kitap.bolumler) {
    const bi = BOLUMLER.length;
    const bolum = { i: bi, baslik: b.baslik, ad: `${SIRA[bi] || bi + 1 + "."} Bölüm`, ilk: P.length, son: P.length, kelime: 0, onceki: TOPLAM, bloklar: [] };
    for (const ham of b.paragraflar) {
      if (ham === SAHNE) { if (bolum.bloklar.length) bolum.bloklar.push(null); continue; }
      const { metin, bicim } = bicimli ? bicimCoz(ham) : { metin: ham, bicim: null };
      if (!metin.trim()) continue;
      const p = { gi: P.length, b: bi, metin, bicim, kelime: kelimeSay(metin), onceki: TOPLAM };
      P.push(p);
      bolum.bloklar.push(p);
      bolum.kelime += p.kelime;
      TOPLAM += p.kelime;
    }
    while (bolum.bloklar.length && !bolum.bloklar[bolum.bloklar.length - 1]) bolum.bloklar.pop();
    if (!bolum.bloklar.length) continue;   // boş bölüm (yalnız görsel) atlanır
    bolum.son = P.length - 1;
    BOLUMLER.push(bolum);
  }
  TOPLAM = Math.max(1, TOPLAM);
  SAYFA_SAYISI = Math.max(1, Math.ceil(TOPLAM / SAYFADA));
}
const sayfaninParagrafi = (sayfa) => {
  const hedef = Math.max(0, ((sayfa || 1) - 1) * SAYFADA);
  return (P.find((x) => x.onceki + x.kelime > hedef) || P[P.length - 1]).gi;
};
function modeliBirak() {
  P.length = 0;
  BOLUMLER.length = 0;
  TOPLAM = 0;
  SAYFA_SAYISI = 1;
  KITAP = null;
}

// Gerçek kitabın çözülmüş hâli epub-belge.js'teki paylaşılan önbellekten gelir (arama dizinlemesiyle ortak).
// Bırakılınca kısa süre tutulur: mod ya da sayfa değişince app.js belgeyi kapatıp yeniden açabilir.
let kitapTutan = null;   // epubCoz birak işlevi
async function kitapGetir(belge, surum) {
  if (!belge.dosya) return { kitap: METIN, bicimli: false };
  const c = epubCoz(belge.id, async () => (await import("./kayit.js")).dosyaGetir(belge.id), { surum });
  try { return { kitap: await c.soz, bicimli: true, birak: c.birak }; }
  catch (hata) { c.birak(); throw hata; }
}
function kitabiBirak() {
  kitapTutan?.();
  kitapTutan = null;
}

const okunanKelime = (k) => { const p = P[k.p]; return p.onceki + sinirla(k.oran, 0, 1) * p.kelime; };

// ---------- okurun tercihleri (bütün EPUB'larda ortak) ----------
// Yazı ailesi, boyut, satır aralığı, ölçü, tema ve son vurgu rengi localStorage'da kalır (Kindle gibi)
const TERCIH_DEPO = "kn-tasarim:okuma-tercih";
const tercih = {
  aile: "serif", boyut: 0, satir: 1.62, olcu: 66,   // boyut 0: varsayılan (yatay 19, dikey 18)
  sonVurgu: "limon",
  araclarAcik: false,
  kalemler: VARSAYILAN_KALEMLER.map((k) => ({ ...k, son: [k.renk, ...SIK_MUREKKEP.filter((r) => r !== k.renk)].slice(0, 5) })),
  fosforlu: { renk: FOSFORLAR[0][1], w: 22, duz: false },
  silgi: { r: 14, sadeceFosforlu: false },
  temaId: null,   // Aa'dan seçilen tema; ayar elle değişince boşalır
};
(() => {
  let k = null;
  try { k = JSON.parse(localStorage.getItem(TERCIH_DEPO)); } catch { /* gizli pencere */ }
  if (!k || typeof k !== "object") return;
  const sayi = (x, a, b) => typeof x === "number" && isFinite(x) && x >= a && x <= b;
  if (typeof k.aile === "string") tercih.aile = k.aile;   // bilinmeyen aile ayarlariUygula'da varsayılana düşer
  if (k.boyut === 0 || sayi(k.boyut, 10, 48)) tercih.boyut = k.boyut;
  if (sayi(k.satir, 1, 3)) tercih.satir = k.satir;
  if (sayi(k.olcu, 20, 140)) tercih.olcu = k.olcu;
  if (typeof k.sonVurgu === "string") tercih.sonVurgu = k.sonVurgu;
  if (typeof k.temaId === "string") tercih.temaId = k.temaId;
})();
function tercihSakla() {
  const { aile, boyut, satir, olcu, sonVurgu, temaId } = tercih;
  try { localStorage.setItem(TERCIH_DEPO, JSON.stringify({ aile, boyut, satir, olcu, sonVurgu, temaId })); } catch { /* gizli pencere */ }
}

// Kaydedilmiş okuma temaları: store.ayarlar'da yaşar, app.js dizileri saklamadığı için ayrıca burada saklanır
function temalar() {
  if (!Array.isArray(store.ayarlar.okumaTemalari)) {
    let kayitli = [];
    try { kayitli = JSON.parse(localStorage.getItem(TEMA_DEPO)) || []; } catch { /* gizli pencere */ }
    store.ayarlar.okumaTemalari = Array.isArray(kayitli) ? kayitli.filter((t) => t && t.id && t.ad) : [];
  }
  return store.ayarlar.okumaTemalari;
}
function temalariSakla() {
  try { localStorage.setItem(TEMA_DEPO, JSON.stringify(temalar())); } catch { /* gizli pencere */ }
}

function playpenYukle() {
  if (document.getElementById("playpen")) return;
  document.head.append(Object.assign(document.createElement("link"), {
    id: "playpen", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playpen+Sans:wght@300..600&display=swap",
  }));
}
// Aa balonundaki "Ağ" örneği kendi harfiyle görünsün: yalnız iki harflik alt küme (birkaç yüz bayt).
// Tam yazı tipi sonradan yüklenirse onun kuralları sonra tanımlandığı için önce o denenir.
function playpenOrnekYukle() {
  if (document.getElementById("playpen") || document.getElementById("playpen-ornek")) return;
  document.head.append(Object.assign(document.createElement("link"), {
    id: "playpen-ornek", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playpen+Sans:wght@400&text=A%C4%9F&display=swap",
  }));
}

// ---------- durum ----------
let S = null;

function yeniVeri(belge) {
  const veri = { vurgular: [], cizgiler: [], yerImleri: [], konum: null, asistanNotlari: [], izler: [] };
  // İlk açılış kitaplıktaki "Kaldığın yerden" yüzdesinden başlar (yoksa %18 yazıp baştan açılırdı)
  if (belge.ilerleme > 0 && belge.ilerleme < 1) {
    const hedef = belge.ilerleme * TOPLAM;
    const p = P.find((x) => x.onceki + x.kelime > hedef) || P[P.length - 1];
    veri.konum = { p: p.gi, oran: sinirla((hedef - p.onceki) / Math.max(1, p.kelime), 0, 1) };
  }
  if (belge.id === "kagit") {
    for (const t of TOHUMLAR) {
      const p = P.find((x) => x.metin.includes(t.metin));
      if (!p) continue;
      const o = p.metin.indexOf(t.metin);
      veri.vurgular.push({ id: yeniId("v"), renk: t.renk, bas: { p: p.gi, o }, son: { p: p.gi, o: o + t.metin.length }, not: t.not || "", zaman: Date.now() });
    }
    veri.vurgular.sort((a, b) => kars(a.bas, b.bas));
  }
  return veri;
}

// Sayfa rengi ayarı "oto" | "beyaz" | "sepya" | "koyu" | "tahta". "oto" Koltuk'ta uygulama temasını izler:
// koyu temada Gece, açıkta Beyaz (ortak.sayfaCoz). Kabuk henüz eklemediyse aynı kural burada.
const koyuTema = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
const sayfaHam = () => store.ayarlar.sayfaRengi || "oto";
function sayfaAl() {
  const ham = sayfaHam();
  const c = typeof ortak.sayfaCoz === "function" ? ortak.sayfaCoz("koltuk") : ham === "oto" ? (koyuTema() ? "koyu" : "beyaz") : ham;
  return { koyu: "gece", gece: "gece", sepya: "sepya", tahta: "tahta" }[c] || "beyaz";
}
const zamanla = (fn, ms) => { const z = setTimeout(() => { S && S.zamanlar.delete(z); fn(); }, ms); S.zamanlar.add(z); return z; };
const dar = () => matchMedia("(max-width: 999px)").matches;
const kabaIsaretci = () => matchMedia("(pointer: coarse)").matches;

// ac(kap, belge, sayfa, mod): sayfa sanal sayfa numarasıdır (kırpıntı, kart ve asistan "s. 4" der); o sayfadaki
// kırpıntı varsa onun yerine, yoksa sayfanın başladığı paragrafa gidilir. Eski çağrı ac(kap, belge, { sayfa, mod }) de olur.
// mod "koltuk": sade okuma; "masa": bütün araçlar. Yoksa belgenin son modu ya da varsayilanMod.
// Dosyası olan EPUB önce çözülür (epub-belge.js); bu arada ekranda dizgi bekleme yazısı durur.
let acilisSayaci = 0;
export async function ac(kap, belge, ucuncu, mod, ek = {}) {
  if (S) kapat();
  ek = ek || {};
  const no = ++acilisSayaci;
  let kitap = METIN, bicimli = false, birak = null;
  // Ayrıştırma sürümü veri kurulmadan önce belirlenir: daha önce açılmış kitap eski paragraf numaralarını korur
  const surum = epubSurumu(belge);
  if (belge.dosya) {
    const bekle = setTimeout(() => {
      if (no === acilisSayaci && !S) kap.replaceChildren(h("div", { class: "okuma-yukleniyor", role: "status" }, fleuron(), h("p", {}, "Kitap dizgiye giriyor")));
    }, 120);
    try { ({ kitap, bicimli, birak } = await kitapGetir(belge, surum)); }
    catch (hata) { toast("Bu EPUB açılamadı. Dosya bozuk ya da desteklenmeyen bir biçimde olabilir."); throw hata; }
    finally { clearTimeout(bekle); }
    if (no !== acilisSayaci || S) { birak(); return; }   // bu arada başka belge açıldı ya da kapatıldı
    kitabiBirak();
    kitapTutan = birak;
    kap.replaceChildren();
  }
  modeliKur(kitap, { bicimli });
  if (!P.length) { modeliBirak(); kitabiBirak(); toast("Bu EPUB'da okunacak metin bulunamadı."); throw new Error("EPUB metni boş"); }
  let sayfa = ucuncu;
  if (ucuncu && typeof ucuncu === "object") { sayfa = ucuncu.sayfa; mod = mod || ucuncu.mod; ek = { ara: ucuncu.ara, konum: ucuncu.konum, ...ek }; }
  mod = mod === "masa" || mod === "koltuk" ? mod : varsayilanMod(belge);
  belge.mod = mod;
  let veri = belge.veri || (belge.veri = yeniVeri(belge));
  // Kitap kapalıyken yalnız asistan notu düşmüşse veri şimdi kitaba göre kurulur
  if (veri.kurulmadi) veri = belge.veri = { ...yeniVeri(belge), asistanNotlari: veri.asistanNotlari || [] };
  if (belge.dosya) veri.epubSurum ||= surum;
  veri.asistanNotlari ||= [];
  // Eksik alanlı eski ya da elle yazılmış kayıt: liste yoksa boş kabul edilir
  if (!Array.isArray(veri.cizgiler)) veri.cizgiler = [];
  if (!Array.isArray(veri.vurgular)) veri.vurgular = [];
  // Paragrafı bilinmeden düşen asistan notları sanal sayfalarının başına bağlanır
  for (const n of veri.asistanNotlari) if (!(Number.isInteger(n.p) && n.p >= 0 && n.p < P.length)) n.p = sayfaninParagrafi(n.sayfa);
  let acilisKirpinti = null;
  if (sayfa > 0) {
    acilisKirpinti = store.kirpintilar.find((x) => x.belgeId === belge.id && x.sayfa === sayfa && x.okuma) || null;
    const p = P.findIndex((x) => x.onceki + x.kelime > (sayfa - 1) * SAYFADA);
    veri.konum = { p: acilisKirpinti ? acilisKirpinti.okuma.ap : Math.max(0, p), oran: 0 };
  }
  // Arama ve bağlantılardan gelen konum sayfadan önce gelir
  const hedef = konumDuzelt(ek.konum);
  if (hedef) { veri.konum = hedef; acilisKirpinti = null; }
  if (!Array.isArray(veri.tuvaller)) veri.tuvaller = [];
  veri.tuvaller = veri.tuvaller.filter((t) => t && Number.isInteger(t.p) && t.p >= 0 && t.p < P.length && Array.isArray(t.cizgiler) && t.cizgiler.length);
  for (const t of veri.tuvaller) t.yukseklik = Math.max(40, Number(t.yukseklik) || TUVAL_YUK);
  veri.izler = izleriDuzelt(veri.izler);
  const sonOkuma = Number(veri.sonOkuma) || 0;
  const iptal = new AbortController();
  const meta = document.querySelector('meta[name="theme-color"]');
  S = {
    kap, belge, veri, iptal, sinyal: iptal.signal,
    el: {}, pEl: [], yer: null, goruntu: null, karolar: new Map(),
    gecmis: new Gecmis(), anlik: null,
    arac: "okuma", sayfa: sayfaAl(), okumaModu: false,
    katman: null, menu: null, arama: null, panel: null, sekme: "notlar",
    aktif: null, parmak: null, dokunus: null, sonIsaretci: "mouse",
    zamanlar: new Set(), raf: { atalet: 0, kaydir: 0, kare: 0, yerlesim: 0 },
    kalemVar: store.ayarlar.parmaklaCiz === false,
    bus: [], meta,
    yeniYerImi: null, sonBolum: -1, acilisKirpinti,
    mod, koltuk: null, olcum: null, sonSor: null, anlam: null, anYer: "",
    tv: new Map(), tvIO: null, tvAnahtar: null, yut: null, sonKalemZ: -1e9, parla: null,
    bekleyenAra: typeof ek.ara === "string" && ek.ara.trim() ? { ara: ek.ara, hedef } : null,
    izG: new WeakMap(), izBekleyen: null, izZ: 0, sonCizimZ: -1e9, kose: null, cp: null, halka: null,
    bekleyenIz: typeof ek.iz === "string" ? ek.iz : null,
    // Kurdele ve "buradaydın": yalnız kaldığı yerden süren Koltuk açılışında
    acilisKonum: mod === "koltuk" && veri.konum && !hedef && !acilisKirpinti ? { ...veri.konum } : null,
    uzunAra: mod === "koltuk" && sonOkuma > 0 && Date.now() - sonOkuma > 8 * 3600e3,
  };
  S.anlik = durumAnlik();
  belge.sayfaSayisi = SAYFA_SAYISI;
  belge.acilis = Date.now();

  kap.classList.add("okuma-ekrani");
  for (const r of VURGULAR) kap.style.setProperty("--v-" + r.id, r.renk);   // mark.vurgu--* bu tonları okur
  kap.setAttribute("lang", KITAP.dil || "tr");
  kap.dataset.mod = mod;
  arayuzKur();
  metniKur();
  ayarlariUygula();
  sayfaUygula(S.sayfa, { gecis: false });
  aracSec("okuma", { sessiz: true });
  olaylariBagla();
  if (mod === "koltuk") koltukAc({ ilk: true });
  if (tercih.aile === "el") playpenYukle();
  // İlk ölçüm ResizeObserver'ın ilk çağrısında olur; yazı tipleri yüklenince düzen yeniden ölçülür.
  document.fonts?.ready.then(() => { if (!S) return; S.tvAnahtar = null; planla("yerlesim", yerlesimDegisti); });
}

// git({ sayfa, ara, konum }): açık kitapta yerinde gidiş. Kabuk da bus "git" de çağırabilir; aynı istek bir kez uygulanır.
export function git({ sayfa, ara, konum, iz } = {}) {
  if (!S) return;
  const imza = JSON.stringify([sayfa || 0, ara || "", konum || null, iz || ""]), t = performance.now();
  if (S.sonGit?.imza === imza && t - S.sonGit.t < 500) return;
  S.sonGit = { imza, t };
  // İzler panelinden gelen: izin yerine gidilir ve iz bir an parlar (TASARIM-3 §7.8)
  const hedefIz = (typeof iz === "string" && S.veri.izler.find((z) => z.id === iz)) || izKonumda(konum);
  if (hedefIz) {
    if (!S.yer) { S.bekleyenIz = hedefIz.id; S.veri.konum = izKonumu(hedefIz); return; }
    izeGit(hedefIz);
    return;
  }
  let hedef = konumDuzelt(konum);
  if (!hedef && sayfa > 0 && (ara || sayfa !== S.belge.sayfa)) hedef = { p: sayfaninParagrafi(sayfa), oran: 0 };
  const terim = typeof ara === "string" && ara.trim() ? ara : null;
  if (!hedef && !terim) return;
  if (!S.yer) {   // ilk yerleşim olmadan: yerleşim gelince uygulanır
    if (hedef) S.veri.konum = hedef;
    if (terim) S.bekleyenAra = { ara: terim, hedef };
    return;
  }
  S.olcum = null;
  if (terim) araParlat(terim, hedef);
  else { konumaGit(hedef); durumGuncelle(); }
}
function konumDuzelt(k) {
  if (!k || !Number.isInteger(k.p) || k.p < 0 || k.p >= P.length) return null;
  return { p: k.p, oran: sinirla(Number(k.oran) || 0, 0, 1) };
}

// Gelinen yerdeki eşleşmeler kitap içi arama vurgusuyla kısa süre parlar (OZELLIKLER-4, git.ara)
function araParlat(terim, hedef) {
  const q = aksansiz(terim.trim());
  if (q.length < 2) { if (hedef) konumaGit(hedef); return; }
  const bas = hedef ? hedef.p : konumAl().p;
  parlaTemizle();
  const parla = new Map();
  let sec = null, n = 0;
  for (let gi = Math.max(0, bas - 2); gi < Math.min(P.length, bas + 40); gi++) {
    const m = aksansiz(P[gi].metin), liste = [];
    for (let i = m.indexOf(q); i >= 0; i = m.indexOf(q, i + q.length)) liste.push({ a: i, b: i + q.length, i: n++, parla: true });
    if (!liste.length) continue;
    parla.set(gi, liste);
    // Hedef paragrafta orana en yakın, yoksa hedeften sonraki ilk eşleşme
    if (gi === bas && hedef) {
      const o = hedef.oran * P[gi].metin.length;
      const yakin = liste.reduce((x, y) => (Math.abs(y.a - o) < Math.abs(x.a - o) ? y : x));
      sec = yakin;
    } else if (!sec && gi >= bas) sec = liste[0];
  }
  if (hedef) konumaGit(hedef);
  if (!parla.size || S.arama) { durumGuncelle(); return; }   // kitap içi arama açıksa onun işaretleri kalır
  S.parla = parla;
  for (const gi of parla.keys()) paragrafCiz(gi);
  const m = sec && S.el.sutun.querySelector(`mark.parla[data-e="${sec.i}"]`);
  if (m) hedefeGit(S.el.sutun.offsetTop + m.offsetTop, () => null);
  else durumGuncelle();
  clearTimeout(S.parlaZ);
  S.parlaZ = zamanla(parlaTemizle, 2800);
}
function parlaTemizle() {
  if (!S?.parla) return;
  const gi = [...S.parla.keys()];
  S.parla = null;
  for (const g of gi) paragrafCiz(g);
}

// app.js durumu saklamadan önce çağırır: ıslak mürekkep kalıcı olur, okunan yer yazılır
export function kaydet() {
  if (!S) return;
  islakAktar();
  izleriSiniflandir();   // kalem kalkalı az olduysa bekleyen izler şimdi metne bağlanır
  if (S.yer && S.el.kaydir.scrollHeight === S.yer.kayYuk) S.veri.konum = konumAl();
  S.veri.sonOkuma = Date.now();
  vurguMetinleriniYaz();
}

// Vurguların metni ve bölümü veriye de yazılır: dışa aktarma ve yedek kitabı açmadan okuyabilsin
function vurguMetinleriniYaz() {
  for (const v of S.veri.vurgular) {
    if (!P[v.bas.p] || !P[v.son.p]) continue;
    v.metin = vurguMetni(v);
    v.bolum = BOLUMLER[P[v.bas.p].b].baslik;
  }
  for (const t of S.veri.tuvaller) if (P[t.p]) t.bolum = BOLUMLER[P[t.p].b].baslik;
  for (const z of S.veri.izler) if (P[z.bas.p]) z.bolum = BOLUMLER[P[z.bas.p].b].baslik;
}

export function kapat() {
  acilisSayaci++;
  if (!S) return;
  tercihSakla();
  const s = S;
  islakAktar();
  izleriSiniflandir();
  s.veri.sonOkuma = Date.now();
  if (s.halka) s.halka.classList.remove("gorunur");
  if (s.halkaBizim) s.halkaBizim.remove();
  if (s.yer) s.veri.konum = konumAl();
  vurguMetinleriniYaz();
  try { s.izlerPanel?.kapat(); } catch { /* boş */ }
  s.koltuk?.kapat();
  s.koltuk = null;
  s.iptal.abort();
  s.ro?.disconnect();
  s.mo?.disconnect();
  for (const z of s.zamanlar) clearTimeout(z);
  for (const r of Object.values(s.raf)) cancelAnimationFrame(r);
  for (const f of s.bus) f();
  for (const cv of s.karolar.values()) { cv.width = 0; cv.height = 0; }
  s.tvIO?.disconnect();
  for (const r of s.tv.values()) { r.cv.width = 0; r.cv.height = 0; }
  s.veri.tuvaller = s.veri.tuvaller.filter((t) => t.cizgiler.length);   // boş açılmış boşluk saklanmaz
  if (s.meta) {   // kitaplığın tema rengine dön (okurken tema değişmiş olabilir)
    const t = document.documentElement.dataset.theme;
    s.meta.content = (t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches) ? "#221E18" : "#FAF6EE";
  }
  s.kap.replaceChildren();
  s.kap.classList.remove("okuma-ekrani", "okuma-modu", "cubuk-gorunur", "tema-acik", "tema-koyu", "yaziyor", "tema-gecisi", "mod-gecisi", "kalem-yakin", "kalem-kosede");
  for (const r of VURGULAR) s.kap.style.removeProperty("--v-" + r.id);
  for (const ad of ["--aa-kay", "--sutun-x", "--sutun-g"]) s.kap.style.removeProperty(ad);
  delete s.kap.dataset.sayfa;
  delete s.kap.dataset.arac;
  delete s.kap.dataset.mod;
  S = null;
  modeliBirak();
  if (s.belge.dosya) kitabiBirak();
  // Kimlikle yayılır: kayıt kapanan belgenin verisini yazacağını bilsin
  bus.emit("belgeler", { tur: "sayfa", id: s.belge.id });
}

function planla(ad, fn) {
  if (S.raf[ad]) return;
  S.raf[ad] = requestAnimationFrame(() => { if (!S) return; S.raf[ad] = 0; fn(); });
}

// ---------- arayüz ----------
function ikonDugme(ad, etiket, fn, { sinif = "", basili, ek = {} } = {}) {
  return h("button", { type: "button", class: ("ikon-dugme " + sinif).trim(), "aria-label": etiket, "aria-pressed": basili == null ? null : String(basili), onclick: fn, ...ek }, icon(ad));
}
const etiket = (metin) => h("span", { class: "t-etiket" }, metin);
// Koltukta Aa, ⋯, Ara ve İçindekiler koltuk çubuğundadır; balonlar görünen düğmeye bağlanır
const dugme = (ad) => (S.mod === "koltuk" ? S.el["k" + ad[0].toUpperCase() + ad.slice(1)] : S.el[ad]);
const fleuron = (sinif = "fleuron") => {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("class", sinif); s.setAttribute("viewBox", "0 0 28 16"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<use href="#i-hedera"/>';
  return s;
};
const sahneSvg = () => {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("class", "sahne"); s.setAttribute("viewBox", "0 0 40 12"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<use href="#i-sahne"/>';
  return s;
};

function arayuzKur() {
  const { kap, belge } = S, el = S.el;

  // Üst çubuk (3.10): EPUB'da Ara, Yer imi, İçindekiler, Notlar, Aa, Okuma modu, ⋯
  el.altBaslik = h("span", { class: "alt" });
  el.baslik = h("div", { class: "belge-baslik" }, h("b", {}, belge.ad), el.altBaslik);
  el.ara = ikonDugme("ara", "Kitapta ara", () => aramaAc(), { basili: false });
  el.yerImi = ikonDugme("yer-imi", "Yer imi", () => yerImiDegistir(), { sinif: "yer-imi", basili: false });
  el.icindekiler = ikonDugme("icindekiler", "İçindekiler", () => panelAc("sol"), { basili: false });
  el.notlar = ikonDugme("notlar", "Notlar", () => panelAc("sag"), { basili: false });
  el.aa = h("button", { type: "button", class: "ikon-dugme aa", "aria-label": "Görünüm: yazı tipi, boyut, sayfa rengi", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: () => aaAc() }, "Aa");
  el.okumaModu = ikonDugme("okuma", "Okuma modu", () => okumaModu(!S.okumaModu), { basili: false });
  el.daha = ikonDugme("daha", "Diğer", () => dahaAc(), { ek: { "aria-haspopup": "menu", "aria-expanded": "false" } });
  el.modAnahtari = modAnahtari(S.mod, (m) => modSec(m));
  el.ust = h("header", { class: "ust-cubuk" },
    h("button", { type: "button", class: "geri", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, icon("geri", "i-22"), h("span", {}, "Kitaplık")),
    el.baslik,
    h("div", { class: "ust-araclar" }, el.ara, el.yerImi, el.icindekiler, el.notlar, el.aa, el.okumaModu, el.daha, el.modAnahtari));

  // Koltuk çubuğunun araçları (TASARIM-2 §4.2): Ara, İçindekiler, Aa, ⋯. Koltuk açılınca koltuk.js'e verilir.
  el.kAra = ikonDugme("ara", "Kitapta ara", () => aramaAc(), { basili: false });
  el.kIcindekiler = ikonDugme("icindekiler", "İçindekiler", () => panelAc("sol"), { basili: false });
  el.kAa = h("button", { type: "button", class: "ikon-dugme aa", "aria-label": "Görünüm ve okuma temaları", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: () => aaAc() }, "Aa");
  el.kDisa = ikonDugme("disa-aktar", "Dışa aktar", () => disaAktarAc(el.kDisa), { ek: { "aria-haspopup": "menu", "aria-expanded": "false" } });
  el.kDaha = ikonDugme("daha", "Diğer", () => dahaAc(), { ek: { "aria-haspopup": "menu", "aria-expanded": "false" } });

  // Okuma alanı: kaydırıcı, mürekkep karoları, canlı katman, araç çubuğu, durum satırı
  el.sutun = h("article", { class: "okuma-sutun", lang: KITAP.dil || "tr", "aria-label": belge.ad });
  el.murekkep = h("div", { class: "murekkep-katman", "aria-hidden": "true" });
  el.satirIsik = h("div", { class: "satir-isik", "aria-hidden": "true" });   // havadaki kalemin altındaki satır (TASARIM-3 §8)
  el.ic = h("div", { class: "okuma-ic" }, el.satirIsik, el.sutun, el.murekkep);
  el.kaydir = h("div", { class: "okuma-kaydir", tabindex: "-1" }, el.ic);
  el.canli = h("canvas", { class: "okuma-canli", "aria-hidden": "true" });
  el.silgiImlec = h("i", { class: "silgi-imlec", hidden: true });
  el.durumBolum = h("span", { class: "bolum" });
  el.kalan = h("span", { class: "kalan" });
  el.yuzde = h("span", { class: "yuzde" });
  el.sayfaNo = h("span", { class: "sayfa-no" });   // yalnız Koltuk'ta: çubuklar gizliyken altta ortada
  el.durum = h("div", { class: "okuma-durum", "aria-hidden": "true" }, el.durumBolum, el.kalan, el.yuzde, el.sayfaNo);
  el.ilerleme = h("div", { class: "okuma-ilerleme", role: "progressbar", "aria-label": "Kitapta ilerleme", "aria-valuemin": "0", "aria-valuemax": "100" }, h("i"));
  // Koltuk: sayfa kenarı kalınlığı (nüans 2) ve sağ üst köşe (TASARIM-3 §12)
  el.sayfaKenari = h("div", { class: "sayfa-kenari", "aria-hidden": "true" });
  el.kose = h("div", { class: "kose", "aria-hidden": "true" });
  el.koseBolge = h("div", { class: "kose-bolge", "aria-hidden": "true", "data-dokunma-yok": "" });
  el.okuma = h("div", { class: "okuma" }, el.kaydir, el.sayfaKenari, el.canli, el.silgiImlec, aracCubuguKur(), el.durum, el.ilerleme, el.kose, el.koseBolge);

  el.solPanel = h("aside", { class: "panel panel-sol okuma-icindekiler", hidden: true, "aria-label": "İçindekiler" });
  el.sagPanel = h("aside", { class: "panel panel-sag okuma-paneli", hidden: true, "aria-label": "Notlar" });
  el.perde = h("div", { class: "panel-perde", hidden: true, onclick: () => panelKapat() });
  kap.append(el.ust, h("div", { class: "calisma okuma-calisma" }, el.solPanel, el.okuma, el.sagPanel), el.perde);

  S.canli = new CanliKatman(el.canli);
}

function aracCubuguKur() {
  const el = S.el;
  const arac = (ad, ikon, etiketMetni) => h("button", { type: "button", class: "arac", "data-arac": ad, "aria-pressed": "false", "aria-label": etiketMetni, onclick: () => aracSec(ad) }, icon(ikon));
  el.okumaAraci = arac("okuma", "okuma", "Okuma: metni seç, vurgula, not ekle");
  el.geriAl = h("button", { type: "button", class: "arac", "aria-label": "Geri al", disabled: true, onclick: () => geriAl() }, icon("geri-al"));
  el.yinele = h("button", { type: "button", class: "arac", "aria-label": "Yinele", disabled: true, onclick: () => yinele() }, icon("yinele"));
  el.kalemler = [...tercih.kalemler.map((_, i) => "kalem" + i), "fosforlu"].map((ad) => {
    const b = h("button", { type: "button", class: "kalem", "data-arac": ad, "aria-pressed": "false", onclick: () => aracSec(ad) });
    kalemDugmesiGuncelle(b);
    return b;
  });
  el.silgi = arac("silgi", "silgi", "Silgi");
  el.kirp = arac("kirp", "kirp", "Kırp");
  el.baglam = h("div", { class: "baglam genis" });
  el.toplu = h("button", { type: "button", class: "arac toplu-dugme", "aria-label": "Bütün araçlar", "aria-expanded": String(tercih.araclarAcik), onclick: () => araclariAc(!tercih.araclarAcik) }, icon("asagi"));
  el.cubuk = h("div", { class: "arac-cubugu okuma-araclari" + (tercih.araclarAcik ? " acik" : ""), role: "toolbar", "aria-label": "Okuma ve kalem araçları" },
    el.okumaAraci,
    h("span", { class: "ayrac" }),
    h("div", { class: "grup genis" }, el.geriAl, el.yinele),
    h("span", { class: "ayrac genis" }),
    h("div", { class: "kalem-kutusu" }, ...el.kalemler),
    h("span", { class: "ayrac genis" }),
    h("div", { class: "grup genis" }, el.silgi, el.kirp),
    el.baglam,
    h("span", { class: "ayrac" }),
    el.toplu);
  // Masaüstünde 500 ms sonra ipucu, tablette uzun basınca (3.12.5)
  const etiketi = (b) => () => b.getAttribute("aria-label");
  ipucuBagla(el.okumaAraci, () => "Okuma: seç, vurgula, not ekle");
  ipucuBagla(el.geriAl, () => "Geri al", "Ctrl+Z");
  ipucuBagla(el.yinele, () => "Yinele", "Ctrl+Y");
  for (const b of el.kalemler) ipucuBagla(b, etiketi(b), { kalem0: "P", fosforlu: "H" }[b.dataset.arac]);
  ipucuBagla(el.silgi, () => "Silgi", "E");
  ipucuBagla(el.kirp, () => "Kırp: bir alan sürükle");
  ipucuBagla(el.toplu, etiketi(el.toplu));
  return el.cubuk;
}

function ipucuBagla(b, metin, kisayol) {
  let z = 0;
  const iptal = () => { clearTimeout(z); z = 0; }, sec = { signal: S.sinyal };
  b.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || !matchMedia("(hover: hover)").matches) return;
    iptal(); z = zamanla(() => ipucuGoster(b, metin(), kisayol), 500);
  }, sec);
  b.addEventListener("pointerleave", () => { iptal(); ipucuGizle(); }, sec);
  b.addEventListener("pointerdown", (e) => {
    iptal(); ipucuGizle();
    if (e.pointerType === "mouse") return;
    z = zamanla(() => { b.dataset.uzun = "1"; ipucuGoster(b, metin(), null); zamanla(ipucuGizle, 1600); }, 520);
  }, sec);
  b.addEventListener("pointerup", iptal, sec);
  b.addEventListener("pointercancel", iptal, sec);
  // Uzun basış ipucu içindi: ardından gelen tıklama aracı değiştirmesin
  b.addEventListener("click", (e) => { if (b.dataset.uzun) { delete b.dataset.uzun; e.stopImmediatePropagation(); } }, { capture: true, signal: S.sinyal });
}
function ipucuGoster(b, metin, kisayol) {
  ipucuGizle();
  if (!S || !b.isConnected || S.kap.classList.contains("yaziyor")) return;
  const kap = S.el.okuma, el = h("div", { class: "ipucu", role: "tooltip" }, metin, kisayol ? h("kbd", {}, kisayol) : null);
  kap.append(el);
  const kR = kap.getBoundingClientRect(), r = b.getBoundingClientRect(), w = el.offsetWidth;
  el.style.left = sinirla(r.left - kR.left + r.width / 2 - w / 2, 8, kR.width - w - 8) + "px";
  el.style.top = r.bottom - kR.top + 10 + "px";
  S.ipucuEl = el;
}
function ipucuGizle() { S?.ipucuEl?.remove(); if (S) S.ipucuEl = null; }

function araclariAc(acik) {
  tercih.araclarAcik = acik;
  S.el.cubuk.classList.toggle("acik", acik);
  S.el.toplu.setAttribute("aria-expanded", String(acik));
  S.el.toplu.setAttribute("aria-label", acik ? "Araçları topla" : "Bütün araçlar");
  katmanKapat();
}

// ---------- metin ----------
function metniKur() {
  const parca = document.createDocumentFragment();
  for (const b of BOLUMLER) {
    const bolum = h("section", { class: "bolum", "data-b": b.i, "aria-labelledby": "okuma-b" + b.i },
      h("header", { class: "bolum-acilis" }, h("div", { class: "bolum-no" }, b.ad), fleuron(), h("h2", { id: "okuma-b" + b.i }, b.baslik)));
    let ilk = true;
    for (const p of b.bloklar) {
      if (!p) { bolum.append(sahneSvg()); continue; }
      const el = h("p", { class: ilk ? "ilk" : null, "data-p": p.gi });
      S.pEl[p.gi] = el;
      bolum.append(el);
      ilk = false;
    }
    parca.append(bolum);
  }
  parca.append(h("footer", { class: "kitap-sonu" },
    fleuron(),
    h("p", { class: "son" }, "Son"),
    h("p", { class: "kunye" }, `${KITAP.baslik || S.belge.ad} · ${sayi(TOPLAM)} kelime`),
    h("button", { type: "button", class: "metin-dugme", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, "Kitaplığa dön")));
  S.el.yerImleri = h("div", { class: "yer-imi-isaretleri", "aria-hidden": "true" });
  S.el.kenarNotlari = h("div", { class: "kenar-notlari" });
  S.el.sutun.append(parca, S.el.yerImleri, S.el.kenarNotlari);
  for (const t of S.veri.tuvaller) tuvalKaydi(t);
  paragraflariCiz();   // tuvaller paragrafCiz'in sonunda yerine takılır; açıklar ilk yerleşimde satır başına oturur
}

// Paragrafı vurgu ve arama eşleşmeleriyle yeniden yazar. Metin değişmez, yalnız işaretler.
// Metnin [a, b) parçasını italik ve kalın aralıklarıyla ekler (gerçek EPUB'ta P[gi].bicim)
function metinEkle(hedef, gi, a, b) {
  const { metin, bicim } = P[gi];
  if (!bicim) { hedef.append(metin.slice(a, b)); return; }
  let k = a;
  for (const r of bicim) {
    if (r.b <= k) continue;
    if (r.a >= b) break;
    const s = Math.max(r.a, k), t = Math.min(r.b, b);
    if (s > k) hedef.append(metin.slice(k, s));
    let el = document.createTextNode(metin.slice(s, t));
    if (r.i) el = h("em", {}, el);
    if (r.k) el = h("strong", {}, el);
    hedef.append(el);
    k = t;
  }
  if (k < b) hedef.append(metin.slice(k, b));
}

function paragrafCiz(gi) {
  const p = S.pEl[gi], metin = P[gi].metin;
  const parcalar = [];
  for (const v of S.veri.vurgular) {
    if (v.son.p < gi || v.bas.p > gi) continue;
    const a = v.bas.p === gi ? v.bas.o : 0, b = v.son.p === gi ? v.son.o : metin.length;
    if (b > a) parcalar.push({ a, b, v, son: v.son.p === gi });
  }
  parcalar.sort((x, y) => x.a - y.a);
  const es = S.arama?.paragraf.get(gi) || S.parla?.get(gi) || [];
  const yaz = (hedef, a, b) => {
    let k = a;
    for (const e of es) {
      if (e.b <= a || e.a >= b) continue;
      const s = Math.max(e.a, a), t = Math.min(e.b, b);
      if (s > k) metinEkle(hedef, gi, k, s);
      const m = h("mark", { class: "eslesme" + (e.parla ? " parla" : e.i === S.arama.etkin ? " etkin" : ""), "data-e": e.i });
      metinEkle(m, gi, s, t);
      hedef.append(m);
      k = t;
    }
    if (k < b) metinEkle(hedef, gi, k, b);
  };
  const frag = document.createDocumentFragment();
  let i = 0;
  for (const q of parcalar) {
    if (q.a < i) continue;
    if (q.a > i) yaz(frag, i, q.a);
    const m = h("mark", { class: vurguSinifi(q.v.renk) + (q.son && q.v.not ? " notlu" : ""), "data-v": q.v.id });
    yaz(m, q.a, q.b);
    frag.append(m);
    i = q.b;
  }
  if (i < metin.length) yaz(frag, i, metin.length);
  p.replaceChildren(frag);
  if (S.tv.size) tuvalleriTak(gi);
}
function paragraflariCiz() {
  for (let gi = 0; gi < P.length; gi++) paragrafCiz(gi);
  S.vAnahtar = vurguAnahtarlari();
}
// Paragraf başına vurgu izi: yalnız izi değişen paragraflar yeniden yazılır (bütün kitabı yazmak tablette yarım saniye)
function vurguAnahtarlari() {
  const m = new Map();
  for (const v of S.veri.vurgular) {
    for (let gi = v.bas.p; gi <= v.son.p; gi++) {
      const a = gi === v.bas.p ? v.bas.o : 0, b = gi === v.son.p ? v.son.o : -1;
      m.set(gi, (m.get(gi) || "") + `${v.id}:${v.renk}:${a}-${b}:${v.not ? 1 : 0};`);
    }
  }
  return m;
}
function vurguParagraflariCiz() {
  const yeni = vurguAnahtarlari(), eski = S.vAnahtar || new Map();
  for (const gi of new Set([...eski.keys(), ...yeni.keys()])) if (eski.get(gi) !== yeni.get(gi) && P[gi]) paragrafCiz(gi);
  S.vAnahtar = yeni;
}

// ---------- okuma ayarları ----------
function ayarlariUygula() {
  const st = S.el.ic.style;
  st.setProperty("--okuma-aile", (AILELER.find((a) => a.id === tercih.aile) || AILELER[0]).css);
  if (tercih.boyut) st.setProperty("--okuma-boyut", tercih.boyut + "px"); else st.removeProperty("--okuma-boyut");
  st.setProperty("--okuma-satir", String(tercih.satir));
  st.setProperty("--olcu", `calc(${tercih.olcu} * var(--harf))`);   // harf sayısı (bkz. okuma.css)
  tercihSakla();
}

function sayfaUygula(id, { gecis = true } = {}) {
  const { kap, el } = S;
  if (gecis && !hareketAz()) { kap.classList.add("tema-gecisi"); zamanla(() => kap.classList.remove("tema-gecisi"), 300); }
  S.sayfa = id;
  kap.dataset.sayfa = id;
  el.okuma.dataset.sayfa = id;
  kap.classList.toggle("tema-koyu", KOYU_SAYFA.has(id));
  kap.classList.toggle("tema-acik", !KOYU_SAYFA.has(id));
  if (S.meta) S.meta.content = SAYFA_META[id];
  if (S.yer) { canliBoyutla(); karolariGuncelle(true); tuvalleriTazele(true); }
}
function sayfaSec(id, { tema = false } = {}) {
  if (!tema) tercih.temaId = null;
  ayarla({ sayfaRengi: id === "gece" ? "koyu" : id });
  const s = sayfaAl();
  if (S.sayfa !== s) sayfaUygula(s);
  katmanYenile();
}

// ---------- ölçüm, konum, düzen ----------
function yerlesimOlc() {
  const { sutun, ic } = S.el;
  const ust = sutun.offsetTop, n = P.length;
  const pUst = new Float64Array(n), pAlt = new Float64Array(n);
  for (let gi = 0; gi < n; gi++) {
    const el = S.pEl[gi];
    pUst[gi] = ust + el.offsetTop;
    pAlt[gi] = pUst[gi] + el.offsetHeight;
  }
  const cs = getComputedStyle(sutun);
  S.yer = { s: sutun.clientWidth / BIRIM, sol: sutun.offsetLeft, ust, pUst, pAlt, icGen: ic.clientWidth, icYuk: ic.offsetHeight, kayYuk: S.el.kaydir.scrollHeight,
    lh: parseFloat(cs.lineHeight) || 30, em: parseFloat(cs.fontSize) || 19, bloklar: bloklariOlc() };
  S.goruntu = null;
}
// Satır ızgarasına uymayan bloklar: bölüm açılışı (numara, hedera, başlık bölünmez), sahne ayracı, kitap sonu
// ve açık tuvaller. [üst, alt] içerik y'si, üste göre sıralı. Tuvalin satırı kenar boşluklarıyla tek parça sayılır.
function bloklariOlc() {
  const icUst = S.el.ic.getBoundingClientRect().top, b = [];
  for (const el of S.el.sutun.querySelectorAll(".bolum-acilis, .sahne, .kitap-sonu > *, .tuval:not(.kucuk)")) {
    const acilis = el.classList.contains("bolum-acilis");
    const r = acilis ? el.firstElementChild.getBoundingClientRect() : el.getBoundingClientRect();
    const alt = acilis ? el.lastElementChild.getBoundingClientRect().bottom : r.bottom;
    if (alt <= r.top) continue;
    // Sıkı satır yüksekliğinde (başlık, numara) harfin kutusu satırdan taşar: 4px pay, İ'nin noktası kesilmez
    const cs = el.classList.contains("tuval") ? getComputedStyle(el) : null;
    b.push([r.top - icUst - (cs ? parseFloat(cs.marginTop) : 4), alt - icUst + (cs ? parseFloat(cs.marginBottom) : 4)]);
  }
  return b.sort((x, y) => x[0] - y[0]);
}

// İçerik y'sinin düştüğü satır ya da blok: { ust, alt, blok }. Paragraflar arka arkaya, boşluksuz bir satır
// ızgarası kurar (p margin 0); ızgara paragraf başından ya da paragraf içindeki son tuvalin altından sayılır.
// Paragraf ve blok dışında (bölüm açılışının boşluğu) ust = alt = y.
function satirAl(y) {
  const { pUst, pAlt, lh, bloklar } = S.yer;
  let taban = -Infinity;
  for (const [u, a] of bloklar) {
    if (u > y) break;
    if (y < a) return { ust: u, alt: a, blok: true };
    taban = a;
  }
  const { p } = konumAl(y);
  if (y < pUst[p] || y >= pAlt[p]) return { ust: y, alt: y, blok: false };
  const bas = Math.max(pUst[p], taban);
  const ust = bas + Math.floor((y - bas) / lh + 1e-3) * lh;
  return { ust, alt: Math.min(ust + lh, pAlt[p]), blok: false };
}

// ---------- Koltuk sayfası (TASARIM-2 §4.1) ----------
// Sayfa penceresi: üstte sayfa başlığının bandı (KOLTUK_UST), altta sayfa numarasının bandı (KOLTUK_ALT).
// Pencerenin iki kenarı da satır sınırına oturur: kesilen satır ya da blok bütünüyle gizlenir, yarım satır görünmez.
// Kenarlar okuma.css'teki maskeye --sayfa-ust ve --sayfa-alt olarak gider; serbest kaydırmada da her karede.
const KOLTUK_UST = 60;   // okuma.css: bu bantta sütun başlığı ve sayfa numarası (TASARIM-3 6.4.1: üstte yaklaşık 64px)
const KOLTUK_ALT = 54;   // alt kenar boşluğu (TASARIM-3 6.4.1: altta yaklaşık 72px, satır sınırına oturunca)
const KAYAN_CEVIRME = 300;   // bundan çok paragraflı kitapta sayfa çevirme kaymasız, yalnız solma (koltukCevir)
// cubuk: çubuklar açıkken pencere opak çubukların altına daralır (yalnız maske; metin kaymaz, çevirme
// çubuksuz pencereye göre yapılır).
function koltukSinir(cubuk = false) {
  const kay = S.el.kaydir, st = kay.scrollTop, H = kay.clientHeight, lh = S.yer.lh;
  let UST_K = KOLTUK_UST, ALT_K = KOLTUK_ALT;
  if (cubuk) {
    const ust = S.kap.querySelector(".koltuk-ust"), alt = S.kap.querySelector(".koltuk-alt");
    UST_K = Math.max(KOLTUK_UST, ust?.offsetHeight || 0);
    ALT_K = Math.max(KOLTUK_ALT, alt?.offsetHeight || 0);
  }
  const ustY = st + UST_K, altY = st + H - ALT_K;
  const u = satirAl(ustY), a = satirAl(altY);
  // Kesilen satırın altından başla; pencereden büyük blok (uzun tuval) olduğu gibi kesilir
  let ust = ustY - u.ust > 1 && u.alt - st < H / 2 ? u.alt - st : UST_K;
  let alt = altY - a.ust > 0.5 && a.ust - st > ust + lh ? a.ust - st : H - ALT_K;
  return { ust, alt, H };
}
function koltukMaske() {
  if (!S?.yer || S.mod !== "koltuk") return;
  const s = koltukSinir(S.kap.classList.contains("cubuk-gorunur")), kay = S.el.kaydir;
  const u = s.ust.toFixed(1) + "px", a = (s.H - s.alt).toFixed(1) + "px";
  if (S.kMaske === u + a) return;
  S.kMaske = u + a;
  kay.style.setProperty("--sayfa-ust", u);
  kay.style.setProperty("--sayfa-alt", a);
}

// Ekrandaki ilk paragraf ve içindeki oran. Oran 0'ın altında olabilir (paragraf ekranın altında başlıyor).
// Okunur alanın üst sınırı: Masa'da üstte yüzen araç çubuğu (üst çubuk + 12 + kendi boyu) bir satırı kapatmasın.
// Koltukta ve okuma modunda çubuk yok, yalnız üst çubuk. Çubuğun boyu yerleşimde ölçülür (S.cubukH).
function ustPay() {
  if (!S || S.mod === "koltuk" || S.okumaModu || !S.cubukH) return UST;
  return UST + 12 + S.cubukH + 8;
}
function konumAl(y = S.el.kaydir.scrollTop + ustPay()) {
  const { pUst, pAlt } = S.yer;
  let lo = 0, hi = P.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pAlt[m] <= y) lo = m + 1; else hi = m; }
  return { p: lo, oran: (y - pUst[lo]) / Math.max(1, pAlt[lo] - pUst[lo]) };
}
function konumY(k) {
  const { pUst, pAlt } = S.yer, p = sinirla(k.p | 0, 0, P.length - 1);
  return pUst[p] + k.oran * (pAlt[p] - pUst[p]) - ustPay();
}
function konumaGit(k) {
  const kay = S.el.kaydir;
  kay.scrollTop = k ? Math.max(0, konumY(k)) : 0;
  // Konumun satırı tam görünen ilk satır olur: Koltuk'ta sayfa başlığının bandının, Masa'da araç çubuğunun altında
  if (k && S.yer) {
    const kenar = S.mod === "koltuk" ? KOLTUK_UST : ustPay();
    const y = kay.scrollTop + ustPay(), s = satirAl(y);
    if (Math.abs(s.ust - kenar - kay.scrollTop) > 0.5 && s.alt > s.ust) kay.scrollTop = Math.max(0, Math.round(s.ust - kenar));
  }
}

// Boyut, yazı tipi ya da panel değişince: son bilinen konumu al, yeniden ölç, aynı yere dön (3.27.10).
// Konum burada scrollTop'tan okunmaz: içerik kısalınca tarayıcı kaydırmayı yeni üst sınıra kırpmış olur
// (Aa ile küçültünce okur geriye fırlıyordu). durumGuncelle konumu yalnız ölçüler güncelken yazar.
function yerlesimDegisti() {
  if (!S) return;
  const ilk = !S.yer;
  const k = S.veri.konum || (S.yer ? konumAl() : null);
  tuvalleriYerlestir(false);   // satır kırılımları değiştiyse açık boşluklar yeni satır başlarına
  yerlesimOlc();
  S.cubukH = S.el.cubuk?.offsetHeight || 0;
  konumaGit(k);
  // Sütunun kenarları: Koltuk'un sayfa başlığı, ilerleme çizgisi ve sayfa kenarı sütuna hizalanır
  S.kap.style.setProperty("--sutun-x", S.yer.sol.toFixed(1) + "px");
  S.kap.style.setProperty("--sutun-g", (S.yer.s * BIRIM).toFixed(1) + "px");
  S.okumaR = S.el.okuma.getBoundingClientRect();
  if (S.el.kurdele) kurdeleKur();   // yazı boyutu değişince kurdele satırıyla gider
  if (ilk) {
    S.el.kaydir.focus({ preventScroll: true });   // klavyeyle kaydırma (boşluk, sayfa aşağı) hemen çalışsın
    const kp = S.acilisKirpinti;
    if (kp) { S.acilisKirpinti = null; zamanla(() => kirpintiyaGit(kp), hareketAz() ? 140 : 460); }
    if (S.acilisKonum) kurdeleKur();
    if (S.uzunAra) zamanla(sonSatirBelir, hareketAz() ? 200 : 700);
  }
  if (S.bekleyenIz) { const id = S.bekleyenIz; S.bekleyenIz = null; zamanla(() => { const z = S?.veri.izler.find((x) => x.id === id); if (z) izeGit(z); }, 80); }
  if (S.bekleyenAra) { const b = S.bekleyenAra; S.bekleyenAra = null; zamanla(() => S?.yer && araParlat(b.ara, b.hedef), 60); }
  tuvalleriTazele(false);
  canliBoyutla();
  kenarNotlariniCiz();
  yerImleriniCiz();
  karolariGuncelle(true);
  S.yer.kayYuk = S.el.kaydir.scrollHeight;   // ölçümden sonra eklenen tuval ve karolar da sayılır
  durumGuncelle();
  if (S.menu) menuKapat();
  if (S.panel) S.el.perde.hidden = !dar();   // döndürünce panel yanda ya da üstte: perde ona göre
}

function kaydirildi() {
  if (S.aktif?.bekleyenIslak) islakAktar();
  if (S.menu) { menuKapat(); S.menuGeri = true; }
  if (S.menuGeri) { clearTimeout(S.menuGeriZ); S.menuGeriZ = zamanla(() => { S.menuGeri = false; secimDegisti(); }, 220); }
  planla("kare", () => { durumGuncelle(); karolariGuncelle(false); });
}

// Durum satırı, ilerleme, üst çubuk alt satırı, yer imi düğmesi (3.27.6)
function durumGuncelle() {
  if (!S.yer) return;
  const kay = S.el.kaydir;
  // Düzen değişti ama henüz ölçülmedi (yazı boyutu, döndürme): eski ölçülerle konum yanlış çıkar, önce yeniden ölçülür
  if (kay.scrollHeight !== S.yer.kayYuk) { planla("yerlesim", yerlesimDegisti); return; }
  const k = konumAl();
  const p = P[k.p], bolum = BOLUMLER[p.b];
  const okunan = okunanKelime(k);
  const sonda = kay.scrollTop + kay.clientHeight >= kay.scrollHeight - 4;
  const oran = sonda ? 1 : okunan / TOPLAM;
  const kalanKelime = bolum.onceki + bolum.kelime - okunan;
  S.el.durumBolum.textContent = bolum.baslik;
  S.el.kalan.textContent = kalanKelime < DAKIKADA || (sonda && bolum.i === BOLUMLER.length - 1)
    ? "Bölüm bitmek üzere" : `Bölümün bitmesine yaklaşık ${Math.ceil(kalanKelime / DAKIKADA)} dk`;
  S.el.yuzde.textContent = yuzde(oran);
  S.el.altBaslik.textContent = `${bolum.ad} · ${yuzde(oran)}`;
  S.el.ilerleme.style.setProperty("--p", oran.toFixed(4));
  S.el.ilerleme.setAttribute("aria-valuenow", String(Math.round(oran * 100)));
  S.belge.ilerleme = oran;
  S.belge.sayfa = Math.min(SAYFA_SAYISI, Math.floor(okunan / SAYFADA) + 1);
  S.el.sayfaNo.textContent = `${S.belge.sayfa} / ${SAYFA_SAYISI}`;
  S.veri.konum = k;
  if (S.koltuk) {
    kalinlikGuncelle(oran);
    S.kKonum = { oran, bolumAd: bolum.ad, kelimeKalanBolum: Math.max(0, kalanKelime), kelimeKalanKitap: Math.max(0, TOPLAM - okunan) };
    hizOlc(okunan);
    S.koltuk.guncelle();
    koltukMaske();
  }
  yerImiDurumu();
  if (bolum.i !== S.sonBolum) { S.sonBolum = bolum.i; if (S.panel === "sol") icindekilerCiz(); }
}

// ---------- vurgular ----------
const vurguBul = (id) => S.veri.vurgular.find((v) => v.id === id);
function vurguMetni(v, ayrac = " ") {
  const parca = [];
  for (let gi = v.bas.p; gi <= v.son.p; gi++) {
    const m = P[gi].metin;
    parca.push(m.slice(gi === v.bas.p ? v.bas.o : 0, gi === v.son.p ? v.son.o : m.length));
  }
  return parca.join(ayrac);
}

// Kaydedilmiş çizgi nesneleri hiç değişmez (silgi diziden çıkarır, yerinde düzenlenmez): anlık kopyada yalnız dizi
// kopyalanır, çizgiler paylaşılır. Eskiden her çizgide bütün çizim geçmişi derin kopyalanıyordu (200 kopya bellekte).
// Vurgular yerinde değişir (renk, not), onlar derin kopyalanır. Active Canvas çizgileri de tuval başına geçmişe girer.
function durumAnlik() {
  return {
    vurgular: anlik(S.veri.vurgular),
    cizgiler: S.veri.cizgiler.slice(),
    tuvaller: S.veri.tuvaller.map((t) => [t, t.cizgiler.slice()]),
    izler: S.veri.izler.slice(),   // birleşen iz yeni nesnedir; sınıflama yerinde olur ama izi aynı yere çizer
  };
}
// Her işlem öncesi ve sonrası anlık kopya ile geçmişe yazılır (geri al / yinele)
function islem(fn) {
  const once = S.anlik;
  fn();
  const sonra = durumAnlik();
  S.anlik = sonra;
  S.gecmis.kaydet({ sayfa: "okuma", once, sonra });
  gecmisGuncelle();
}
function durumYukle(d) {
  S.veri.vurgular = anlik(d.vurgular);
  S.veri.cizgiler = d.cizgiler.slice();
  const izDegisti = !!d.izler && (d.izler.length !== S.veri.izler.length || d.izler.some((z, i) => z !== S.veri.izler[i]));
  if (d.izler) S.veri.izler = d.izler.slice();
  if (izDegisti) { S.izBekleyen = null; belgeDegisti(); izPlanla(); S.koltuk?.izleriYenile?.(); }
  let tuvalDegisti = false;
  for (const [t, cz] of d.tuvaller || []) {
    if (t.cizgiler.length === cz.length && t.cizgiler.every((c, i) => c === cz[i])) continue;
    t.cizgiler = cz.slice();
    tuvalDegisti = true;
    const r = S.tv.get(t.id);
    if (r) tuvalCiz(r);
  }
  if (tuvalDegisti) belgeDegisti();
  S.anlik = d;
  vurguParagraflariCiz();
  kenarNotlariniCiz();
  S.goruntu = null;
  karolariGuncelle(true);
  panelYenile();
}
function geriAl() {
  islakAktar();
  notDegisikliginiKaydet();
  const k = S.gecmis.geriAl();
  if (k) durumYukle(k.once);
  gecmisGuncelle();
}
function yinele() {
  const k = S.gecmis.yinele();
  if (k) durumYukle(k.sonra);
  gecmisGuncelle();
}
function gecmisGuncelle() {
  S.el.geriAl.disabled = !S.gecmis.geriAlinabilir;
  S.el.yinele.disabled = !S.gecmis.yinelenebilir;
}

function vurgulariDegistir() {
  vurguParagraflariCiz();
  kenarNotlariniCiz();
  panelYenile();
}

// Çakışan vurgular birleşir: aralık birleşir, notlar alt alta eklenir, renk yeninin rengidir
function vurguEkle({ bas, son }, renk) {
  let yeni = null;
  islem(() => {
    const cakisan = S.veri.vurgular.filter((x) => kars(x.bas, son) < 0 && kars(bas, x.son) < 0);
    let b = bas, s = son;
    const notlar = [];
    for (const x of cakisan) {
      if (kars(x.bas, b) < 0) b = x.bas;
      if (kars(x.son, s) > 0) s = x.son;
      if (x.not) notlar.push(x.not);
    }
    S.veri.vurgular = S.veri.vurgular.filter((x) => !cakisan.includes(x));
    yeni = { id: yeniId("v"), renk, bas: { ...b }, son: { ...s }, not: notlar.join("\n"), zaman: Date.now() };
    S.veri.vurgular.push(yeni);
    S.veri.vurgular.sort((x, y) => kars(x.bas, y.bas));
  });
  tercih.sonVurgu = renk;
  vurgulariDegistir();
  return yeni;
}
function vurguRenk(v, renk) {
  islem(() => { v.renk = renk; });
  tercih.sonVurgu = renk;
  vurgulariDegistir();
}
function vurguSil(v, { bildir = true } = {}) {
  islem(() => { S.veri.vurgular = S.veri.vurgular.filter((x) => x.id !== v.id); });
  vurgulariDegistir();
  if (bildir) toast(v.not ? "Vurgu ve notu kaldırıldı" : "Vurgu kaldırıldı", { etiket: "Geri al", calistir: () => {
    if (!S || vurguBul(v.id)) return;
    islem(() => { S.veri.vurgular.push(v); S.veri.vurgular.sort((x, y) => kars(x.bas, y.bas)); });
    vurgulariDegistir();
  } });
}

// Seçimi paragraf ve ofsetlere çevirir; boşluklar kırpılır, uçlar kelime sınırına genişler
function ofset(p, dugum, o) {
  const r = document.createRange();
  r.setStart(p, 0); r.setEnd(dugum, o);
  return r.toString().length;
}
function secimAraligi(r) {
  let bas = null, son = null;
  for (const p of S.pEl) {
    if (!r.intersectsNode(p)) continue;
    const gi = +p.dataset.p, metin = P[gi].metin;
    let a = p.contains(r.startContainer) ? ofset(p, r.startContainer, r.startOffset) : 0;
    let b = p.contains(r.endContainer) ? ofset(p, r.endContainer, r.endOffset) : metin.length;
    while (a < b && /\s/.test(metin[a])) a++;
    while (b > a && /\s/.test(metin[b - 1])) b--;
    if (a >= b) continue;
    if (!bas) bas = { p: gi, o: a };
    son = { p: gi, o: b };
  }
  if (!bas) return null;
  const m0 = P[bas.p].metin, m1 = P[son.p].metin;
  while (bas.o > 0 && HARF.test(m0[bas.o - 1]) && HARF.test(m0[bas.o])) bas.o--;
  while (son.o < m1.length && HARF.test(m1[son.o]) && HARF.test(m1[son.o - 1])) son.o++;
  return { bas, son };
}

// ---------- kenar notları (6.5) ----------
// Sütun her zaman ortadadır (1fr ölçü 1fr); notlar sütunun sağındaki boşluğa mutlak konumla yerleşir, metin kaymaz.
// Sağda 32 + 200px'lik yer yoksa oluk kapanır: vurgu notu satır içindeki bordo noktaya, asistan notu paragraf altına döner.
// Çakışırsa alttaki 8px aşağı iner.
const OLUK = 232;
function olukVar() {
  const ic = S.el.ic, sutun = S.el.sutun;
  const sag = ic.clientWidth - (sutun.offsetLeft + sutun.offsetWidth);   // sütunun sağından iç kenara (dolgu dahil)
  return sag >= OLUK + 8;
}
function kenarNotlariniCiz() {
  const kap = S.el.kenarNotlari;
  kap.replaceChildren();
  const oluk = olukVar();
  S.el.ic.classList.toggle("oluklu", oluk);
  asistanSatirlari(!oluk);
  if (!oluk) { S.yeniAsistanNotu = null; return; }
  const sR = S.el.sutun.getBoundingClientRect();
  const ogeler = [];
  for (const v of S.veri.vurgular) {
    if (!v.not || !v.not.trim()) continue;
    const m = S.el.sutun.querySelector(`mark[data-v="${v.id}"]`);
    const r = m && m.getClientRects()[0];
    if (!r) continue;
    ogeler.push({ y: r.top - sR.top + r.height / 2 - 11, yap: () => {
      const not = h("button", { type: "button", class: "kenar-notu", "data-v": v.id, "aria-label": "Kenar notu: " + v.not }, v.not.trim());
      not.addEventListener("click", () => notBalonuAc(v, { kaynak: not }));
      return not;
    } });
  }
  for (const n of S.veri.asistanNotlari || []) {
    const p = S.pEl[n.p];
    if (p) ogeler.push({ y: p.offsetTop + 2, yap: () => asistanNotuEl(n, false) });
  }
  ogeler.sort((a, b) => a.y - b.y);
  let alt = -Infinity;
  for (const o of ogeler) {
    const top = Math.max(o.y, alt + 8), not = o.yap();
    not.style.top = top.toFixed(1) + "px";
    kap.append(not);
    alt = top + not.offsetHeight;
  }
  S.yeniAsistanNotu = null;
}
// Dar ekran: asistan notları paragrafın hemen altında. Yalnız değişince yeniden kurulur (düzen gözlemcisi döngüye girmesin).
function asistanSatirlari(goster) {
  const notlar = S.veri.asistanNotlari || [];
  const imza = goster ? notlar.map((n) => n.id).join(",") : "";
  if (imza === S.anYer) return;
  S.anYer = imza;
  for (const e of S.el.sutun.querySelectorAll(".kenar-asistan.satir-ici")) e.remove();
  if (!goster) return;
  for (const n of [...notlar].sort((a, b) => b.zaman - a.zaman)) S.pEl[n.p]?.after(asistanNotuEl(n, true));
}

// ---------- yer imleri ----------
function gorunurAralik() {
  const kay = S.el.kaydir;
  return [kay.scrollTop + ustPay(), kay.scrollTop + kay.clientHeight];
}
function gorunenYerImleri() {
  if (!S.yer) return [];
  const [a, b] = gorunurAralik();
  return S.veri.yerImleri.filter((y) => S.yer.pAlt[y.p] > a && S.yer.pUst[y.p] < b - 40);
}
function yerImiDurumu() {
  const var_ = gorunenYerImleri().length > 0;
  if (!S.kose) S.el.kose.classList.toggle("kivrik", var_);   // Koltuk: yer imli sayfanın köşesi kıvrık
  S.el.yerImi.setAttribute("aria-pressed", String(var_));
  S.el.yerImi.setAttribute("aria-label", var_ ? "Yer imini kaldır" : "Yer imi ekle");
}
function yerImiDegistir() {
  if (!S.yer) return;
  const gorunen = gorunenYerImleri();
  if (gorunen.length) {
    S.veri.yerImleri = S.veri.yerImleri.filter((y) => !gorunen.includes(y));
    toast("Yer imi kaldırıldı", { etiket: "Geri al", calistir: () => {
      if (!S) return;
      S.veri.yerImleri.push(...gorunen);
      S.veri.yerImleri.sort((a, b) => a.p - b.p);
      yerImleriniCiz(); yerImiDurumu(); panelYenile();
    } });
  } else {
    const k = konumAl();
    const p = k.oran > 0.5 && k.p < P.length - 1 ? k.p + 1 : k.p;
    const y = { id: yeniId("y"), p, zaman: Date.now() };
    S.veri.yerImleri.push(y);
    S.veri.yerImleri.sort((a, b) => a.p - b.p);
    S.yeniYerImi = y.id;
  }
  yerImleriniCiz();
  yerImiDurumu();
  panelYenile();
}
function yerImleriniCiz() {
  const kap = S.el.yerImleri;
  kap.replaceChildren(...S.veri.yerImleri.map((y) => h("i", {
    class: "yer-imi-isaret" + (y.id === S.yeniYerImi ? " yeni" : ""), style: `top:${S.pEl[y.p].offsetTop}px`,
  })));
  S.yeniYerImi = null;
}

// ---------- seçim menüsü (3.27.5) ----------
function secimDegisti() {
  if (!S || S.arac !== "okuma" || S.basili) return;
  const sec = document.getSelection();
  if (!sec || sec.isCollapsed || !sec.rangeCount) {
    if (S.menu?.tur === "yeni" && Date.now() - (S.menuDokunus || 0) > 600) menuKapat();
    return;
  }
  const r = sec.getRangeAt(0);
  if (!S.el.sutun.contains(r.commonAncestorContainer)) return;
  const aralik = secimAraligi(r);
  if (!aralik) return;
  // Anlam kartı açıkken aynı kelimenin seçimi menü açmaz; seçim büyütülünce kart kapanır, menü gelir (Kindle gibi)
  if (S.katman?.tur === "anlam") {
    const a = S.anlam?.aralik;
    if (a && !kars(a.bas, aralik.bas) && !kars(a.son, aralik.son)) return;
    if (a && aralik.bas.p === a.bas.p && aralik.son.p === a.son.p && aralik.son.o - aralik.bas.o <= a.son.o - a.bas.o + 2) return;
    katmanKapat(false);
  }
  const m = S.menu;   // fare bırakılınca ve selectionchange ile iki kez gelir: aynı seçimde menü yeniden doğmasın
  if (m?.tur === "yeni" && !kars(m.aralik.bas, aralik.bas) && !kars(m.aralik.son, aralik.son)) return;
  secimMenusuAc({ tur: "yeni", aralik, rects: [...r.getClientRects()].filter((q) => q.width > 0) });
}

function secimMenusuAc({ tur, aralik, v, rects }) {
  menuKapat();
  katmanKapat();
  if (!rects.length) return;
  const el = h("div", { class: "secim-menusu", role: "toolbar", "aria-label": tur === "yeni" ? "Seçili metin" : "Vurgu" });
  el.addEventListener("pointerdown", (e) => { S.menuDokunus = Date.now(); if (e.pointerType === "mouse") e.preventDefault(); });
  const kapatVe = (fn) => () => { const m = S.menu; menuKapat(); fn(m); };
  for (const r of VURGULAR) {
    el.append(h("button", {
      type: "button", class: "vd", style: `--v:${r.renk}`, "aria-label": `${r.ad} vurgu`,
      "aria-pressed": tur === "vurgu" ? String(v.renk === r.id) : null,
      onclick: kapatVe(() => {
        if (tur === "vurgu") vurguRenk(v, r.id);
        else { vurguEkle(aralik, r.id); document.getSelection()?.removeAllRanges(); }
      }),
    }, h("i")));
  }
  el.append(h("span", { class: "ayrac" }));
  el.append(h("button", { type: "button", class: "yazi", onclick: kapatVe(() => {
    const hedef = tur === "vurgu" ? v : vurguEkle(aralik, tercih.sonVurgu);
    document.getSelection()?.removeAllRanges();
    notBalonuAc(hedef, { odakla: true });
  }) }, "Not ekle"));
  // Anlamı (yalnız tek kelime) ve Sor: asistana gider (TASARIM-2 §4.7)
  const kaynakAralik = tur === "vurgu" ? { bas: v.bas, son: v.son } : aralik;
  const kelime = tekKelime(kaynakAralik);
  if (kelime) el.append(h("button", { type: "button", class: "yazi ikonlu", "aria-label": "Anlamı", onclick: kapatVe(() => {
    const rs = rects;
    document.getSelection()?.removeAllRanges();
    anlamAc(kelime, kaynakAralik, rs);
  }) }, icon("anlam"), h("span", {}, "Anlamı")));
  el.append(h("button", { type: "button", class: "yazi ikonlu sor", "aria-label": "Asistana sor", onclick: kapatVe(() => {
    document.getSelection()?.removeAllRanges();
    asistanaSor(kaynakAralik);
  }) }, icon("sor"), h("span", {}, "Sor")));
  el.append(h("button", { type: "button", class: "yazi", onclick: kapatVe(() => {
    secimdenKirp(tur === "vurgu" ? { bas: v.bas, son: v.son } : aralik);
    document.getSelection()?.removeAllRanges();
  }) }, "Kırp"));
  el.append(h("button", { type: "button", class: "yazi", onclick: kapatVe(() => {
    kopyala(vurguMetni(tur === "vurgu" ? v : aralik, "\n\n"));   // aralıktan: dokunmatikte seçim menüye dokununca kaybolabilir
  }) }, "Kopyala"));
  if (tur === "vurgu") {
    // Silme her yerde iki dokunuşla: ilk dokunuş sorar, 3 sn içinde ikincisi kaldırır
    const sil = h("button", { type: "button", class: "yazi sil" }, "Vurguyu kaldır");
    let z = 0;
    sil.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sil.dataset.durum === "emin") { clearTimeout(z); kapatVe(() => vurguSil(v))(); return; }
      sil.dataset.durum = "emin";
      sil.textContent = "Emin misin?";
      z = setTimeout(() => { delete sil.dataset.durum; sil.textContent = "Vurguyu kaldır"; }, 3000);
    });
    el.append(sil);
  }
  S.kap.append(el);
  S.menu = { el, tur, aralik, v };
  menuKonumla(el, rects);
}

// Seçimin 10px üstünde; yer yoksa altında. Dokunmatikte Android'in kendi menüsü üstte çıktığı için altta.
function menuKonumla(el, rects) {
  const kR = S.kap.getBoundingClientRect(), w = el.offsetWidth, hgt = el.offsetHeight;
  const dokunmatik = S.sonIsaretci !== "mouse";
  const ilk = rects[0], son = rects[rects.length - 1];
  const ustSinir = (S.okumaModu || (S.koltuk && !S.koltuk.gorunur()) ? 8 : UST + 8) + kR.top;
  let altta = dokunmatik || ilk.top - hgt - 16 < ustSinir;
  let hedef = altta ? son : ilk;
  let top = altta ? son.bottom + 16 + (dokunmatik ? 22 : 0) : ilk.top - hgt - 16;
  if (altta && top + hgt > kR.bottom - 8) { altta = false; hedef = ilk; top = Math.max(ustSinir, ilk.top - hgt - 16); }
  const merkez = hedef.left + hedef.width / 2 - kR.left;
  const sol = sinirla(merkez - w / 2, 8, kR.width - w - 8);
  el.classList.toggle("altta", altta);
  el.style.left = sol + "px";
  el.style.top = top - kR.top + "px";
  el.style.setProperty("--ok-x", sinirla(merkez - sol, 18, w - 18) + "px");
}
function menuKapat() {
  if (!S?.menu) return;
  S.menu.el.remove();
  S.menu = null;
}

function vurguMenusuAc(v, mark) {
  const isaretler = [...S.el.sutun.querySelectorAll(`mark[data-v="${v.id}"]`)];
  const rects = isaretler.flatMap((m) => [...m.getClientRects()]).filter((q) => q.width > 0);
  secimMenusuAc({ tur: "vurgu", v, rects: rects.length ? rects : [...mark.getClientRects()] });
}

async function kopyala(metin) {
  if (!metin) return;
  toast((await panoyaYaz(metin)) ? "Kopyalandı" : "Kopyalanamadı. Metni seçip tarayıcının menüsünü kullan.");
}

// ---------- asistan: Sor ve Anlamı (TASARIM-2 §4.7, §4.8) ----------
// Sanal sayfa: kitaplık, kart ve asistan "s. 4" der (SAYFADA kelimede bir)
const sanalSayfa = (p, o = 0) => Math.min(SAYFA_SAYISI, Math.floor((P[p].onceki + (o / Math.max(1, P[p].metin.length)) * P[p].kelime) / SAYFADA) + 1);
const KELIME = /^[\p{L}][\p{L}’'-]*$/u;
// Seçim tek kelimeyse onu döndürür (başta ve sonda noktalama atılır)
function tekKelime({ bas, son }) {
  if (bas.p !== son.p || son.o - bas.o > 40) return null;
  const k = P[bas.p].metin.slice(bas.o, son.o).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  return KELIME.test(k) ? k : null;
}
// Kelimenin geçtiği cümle: anlam kartında bağlam, asistana bağlam
function baglamCumle({ bas, son }) {
  const m = P[bas.p].metin, bitis = bas.p === son.p ? son.o : m.length;
  let a = bas.o, b = bitis;
  while (a > 0 && !/[.!?…]/.test(m[a - 1])) a--;
  while (b < m.length && !/[.!?…]/.test(m[b - 1] || "")) b++;
  let c = m.slice(a, b).trim();
  if (c.length > 180) {
    const o = bas.o - a;
    const x = Math.max(0, o - 80), y = Math.min(c.length, o + 100);
    c = (x > 0 ? "…" : "") + c.slice(x, y).trim() + (y < c.length ? "…" : "");
  }
  return c;
}
// Paragraf ofsetlerinden DOM aralığı (dikdörtgenleri almak için)
function aralikRange({ bas, son }) {
  const bul = (k) => {
    const w = document.createTreeWalker(S.pEl[k.p], NodeFilter.SHOW_TEXT);
    let kalan = k.o, d, onceki = null;
    while ((d = w.nextNode())) { onceki = d; if (kalan <= d.length) return [d, kalan]; kalan -= d.length; }
    return onceki ? [onceki, onceki.length] : [S.pEl[k.p], 0];
  };
  const r = document.createRange();
  r.setStart(...bul(bas));
  r.setEnd(...bul(son));
  return r;
}
const yzAyar = () => store.ayarlar.yz || { yol: "hesap", uygulama: "chatgpt" };
const uygulamaAl = () => YZ_UYGULAMALAR.find((u) => u.id === yzAyar().uygulama) || YZ_UYGULAMALAR[0];
// Türkçe bulunma eki: "ChatGPT'de", "Claude'da"
const bulunma = (ad) => ad + ({ Claude: "'da" }[ad] || "'de");

function asistanaSor(aralik, ek = {}) {
  const sayfa = sanalSayfa(aralik.bas.p, aralik.bas.o);
  S.sonSor = { p: aralik.son.p, sayfa, zaman: Date.now() };
  sonSorlar.set(S.belge.id, S.sonSor);
  bus.emit("sor", {
    metin: vurguMetni(aralik, "\n\n"), belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa,
    kaynak: S.mod === "masa" ? "masa" : "koltuk", ...ek,
  });
}

// Anlam kartı: index kartı, her temada açık. Cevap asistandan gelir, "Kelime hazinesine ekle" Tekrar'a kart yapar.
function anlamAc(kelime, aralik, rects) {
  menuKapat();
  const sayfa = sanalSayfa(aralik.bas.p, aralik.bas.o);
  const a = {
    kelime, aralik, sayfa, baglam: baglamCumle(aralik), istek: yeniId("an"),
    anlam: "", durum: yzAyar().yol === "anahtar" ? "bekliyor" : "hesap", eklendi: false, vurgula: false,
  };
  const el = h("div", { class: "anlam-fis fis-kart satirli nesne-acik", role: "dialog", "aria-label": `Anlamı: ${kelime}`, tabindex: "-1" });
  a.el = el;
  S.anlam = a;
  katmanAc(el, { tur: "anlam", kapat: () => { if (S.anlam === a) S.anlam = null; clearTimeout(a.z); } });
  anlamCiz(a);
  // Kelimenin altında; yer yoksa üstünde
  const kR = S.kap.getBoundingClientRect();
  const rs = (rects && rects.length ? rects : [...aralikRange(aralik).getClientRects()]).filter((q) => q.width > 0);
  const son = rs[rs.length - 1] || kR, ilk = rs[0] || kR;
  const w = el.offsetWidth, hg = el.offsetHeight;
  const sol = sinirla(son.left + son.width / 2 - kR.left - w / 2, 12, kR.width - w - 12);
  const asagi = son.bottom + 12 + hg < kR.bottom - 12;
  el.style.left = sol + "px";
  el.style.top = (asagi ? son.bottom - kR.top + 12 : Math.max(12, ilk.top - kR.top - hg - 12)) + "px";
  el.focus({ preventScroll: true });
  if (a.durum === "bekliyor") anlamIste(a);
}
function anlamKapat() { if (S?.katman?.tur === "anlam") katmanKapat(false); }

// Koltukta kelimeye uzun basış: anlam kartı. Dokunmatikte tarayıcı kelimeyi de seçer; kart açıkken seçim menüsü çıkmaz.
function uzunBasisKur(e) {
  uzunBasisIptal();
  if (e.target.closest?.("mark.vurgu, .kenar-notu, .kenar-asistan, button, a, .tuval")) return;
  const u = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  u.z = zamanla(() => { if (S?.uzun === u) { S.uzun = null; uzunBasisBitti(u); } }, 520);
  S.uzun = u;
}
function uzunBasisIptal() {
  if (!S?.uzun) return;
  clearTimeout(S.uzun.z);
  S.zamanlar.delete(S.uzun.z);
  S.uzun = null;
}
function uzunBasisBitti({ x, y }) {
  const k = noktadakiKelime(x, y);
  if (!k) return;
  S.basili = false;
  if (S.aktif?.iz) { S.aktif.iptal = true; S.canli.temizle(); }   // kalemle kelimeye uzun basış iz değil, anlam kartı
  anlamAc(k.kelime, k.aralik, [...aralikRange(k.aralik).getClientRects()]);
}
function noktadakiKelime(x, y) {
  let dugum = null, ofs = 0;
  if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); if (c) { dugum = c.offsetNode; ofs = c.offset; } }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { dugum = r.startContainer; ofs = r.startOffset; } }
  if (!dugum || dugum.nodeType !== 3) return null;
  const pEl = dugum.parentElement?.closest("p[data-p]");
  if (!pEl || !S.el.sutun.contains(pEl)) return null;
  const gi = +pEl.dataset.p, m = P[gi].metin, o = ofset(pEl, dugum, ofs);
  const harf = (c) => c && /[\p{L}’'-]/u.test(c);
  let a = o, b = o;
  if (!harf(m[a]) && harf(m[a - 1])) a--, b--;   // kelimenin hemen sağına basıldıysa
  if (!harf(m[a])) return null;
  while (a > 0 && harf(m[a - 1])) a--;
  while (b < m.length && harf(m[b])) b++;
  const aralik = { bas: { p: gi, o: a }, son: { p: gi, o: b } };
  const kelime = tekKelime(aralik);
  if (!kelime) return null;
  // Basılan nokta gerçekten kelimenin üstünde mi (satır sonundaki boşluğa basılmadı)
  const rs = [...aralikRange(aralik).getClientRects()];
  if (!rs.some((q) => x >= q.left - 6 && x <= q.right + 6 && y >= q.top - 6 && y <= q.bottom + 6)) return null;
  return { kelime, aralik };
}

// Anahtar yolu ve Deneme: asistan cevabı akıtarak geri verir (cevap geri çağrısı ya da "asistan:cevap" olayı).
// Asistan bu isteği tanımıyorsa birkaç saniye sonra panodan getirme yoluna geçilir.
function anlamIste(a) {
  a.durum = "bekliyor";
  a.anlam = "";
  anlamCiz(a);
  const geri = (parca, d = {}) => anlamParca(a, { parca, ...d });
  bus.emit("sor", {
    hazir: "anlam", metin: a.kelime, baglam: a.baglam, belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: a.sayfa,
    kaynak: "koltuk", istek: a.istek, panel: false, cevap: geri,
    // asistan.js anlamSessiz: parca(parça, toplam), bitti(metin), hata(hata)
    parca: (_, toplam) => anlamParca(a, { metin: toplam }),
    bitti: (metin) => anlamParca(a, { metin, bitti: true }),
    hata: () => anlamParca(a, { hata: true }),
  });
  clearTimeout(a.z);
  a.z = setTimeout(() => { if (S?.anlam === a && a.durum === "bekliyor") { a.durum = "panelde"; anlamCiz(a); } }, 6000);
}
// Gelen parça: { parca } ekler, { metin } tümünü koyar, { bitti }, { hata }
function anlamParca(a, d) {
  if (S?.anlam !== a) return;
  clearTimeout(a.z);
  if (d.hata) a.durum = "hata";
  else {
    if (typeof d.metin === "string") a.anlam = d.metin;
    else if (typeof d.parca === "string") a.anlam += d.parca;
    a.durum = d.bitti ? "bitti" : "akiyor";
    if (d.bitti) a.anlam = a.anlam.trim();
  }
  anlamCiz(a);
}
// Panodan cevap: okunamazsa yapıştırma alanı açılır
async function anlamGetir(a) {
  let metin = "";
  try { metin = (await navigator.clipboard.readText()).trim(); } catch { /* izin yok ya da güvenli bağlantı değil */ }
  if (S?.anlam !== a) return;
  if (metin) { a.anlam = metin; a.durum = "bitti"; }
  else a.durum = "yapistir";
  anlamCiz(a);
}

function anlamCiz(a) {
  const { el } = a, uyg = uygulamaAl();
  const anlamP = h("p", { class: "anlam", "aria-live": "polite" });
  const sor = (birincil) => h("button", {
    type: "button", class: birincil ? "birincil kucuk" : "metin-dugme",
    onclick: () => {
      if (a.durum === "hesap") {   // hesap yolu: soru uygulamaya götürülür, cevap panodan geri alınır
        bus.emit("sor", { hazir: "anlam", metin: a.kelime, baglam: a.baglam, belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: a.sayfa, kaynak: "koltuk", istek: a.istek, panel: false });
        a.durum = "donus";
        anlamCiz(a);
      } else {
        katmanKapat(false);
        asistanaSor(a.aralik, { soru: `"${a.kelime}" bu cümlede ne anlama geliyor?`, metin: a.baglam });
      }
    },
  }, icon("sor"), a.durum === "hesap" ? `${bulunma(uyg.ad)} sor` : "Sor");
  const getir = () => h("button", {
    type: "button", class: "birincil kucuk" + (a.vurgula ? " vurgula" : ""), onclick: () => anlamGetir(a),
  }, icon("yapistir"), "Cevabı getir");

  let sag;
  switch (a.durum) {
    case "bekliyor":
    case "akiyor":
      anlamP.append(a.anlam, h("span", { class: "imlec", "aria-hidden": "true" }));
      sag = sor(false);
      break;
    case "bitti":
      anlamP.append(a.anlam);
      sag = sor(false);
      break;
    case "hata":
      anlamP.append("Anlam getirilemedi.");
      sag = h("button", { type: "button", class: "metin-dugme", onclick: () => anlamIste(a) }, icon("yeniden"), "Yeniden dene");
      break;
    case "hesap":
      anlamP.classList.add("ipucu-metin");
      anlamP.append(`Anlamı ${bulunma(uyg.ad)} sor, cevabı kopyalayıp buraya dön.`);
      sag = sor(true);
      break;
    case "donus":
    case "panelde":
      anlamP.classList.add("ipucu-metin");
      anlamP.append(a.durum === "panelde" ? "Cevap asistan panelinde. Oradan kopyalayıp buraya getir." : `Cevap ${bulunma(uyg.ad)}. Bitince cevabı kopyala ve buraya dön.`);
      sag = getir();
      break;
    case "yapistir": {
      const alan = h("textarea", { class: "anlam-yapistir", rows: "3", placeholder: "Cevabı buraya yapıştır", "aria-label": "Cevabı yapıştır" });
      const ekle = () => { const t = alan.value.trim(); if (!t) return alan.focus(); a.anlam = t; a.durum = "bitti"; anlamCiz(a); };
      alan.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ekle(); });
      anlamP.append(alan);
      sag = h("button", { type: "button", class: "birincil kucuk", onclick: ekle }, icon("tik"), "Ekle");
      requestAnimationFrame(() => alan.isConnected && alan.focus({ preventScroll: true }));
      break;
    }
  }
  const ekle = h("button", {
    type: "button", class: "metin-dugme vurgulu ekle", disabled: !a.anlam || a.eklendi || a.durum !== "bitti",
    onclick: () => {
      kartEkle({
        tur: "kelime", on: { metin: a.kelime, baglam: a.baglam }, arka: { metin: a.anlam },
        belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: a.sayfa,
      });
      a.eklendi = true;
      anlamCiz(a);
    },
  }, a.eklendi ? [icon("tik"), "Eklendi"] : "Kelime hazinesine ekle");
  el.replaceChildren(...[
    a.eklendi ? h("span", { class: "damga" }, "Tekrar'a eklendi · Kutu I") : null,
    h("header", {}, h("h4", {}, a.kelime), h("span", { class: "anlam-sayfa" }, `S. ${a.sayfa}`)),
    anlamP,
    a.baglam ? h("p", { class: "anlam-baglam" }, `“${a.baglam}”`) : null,
    h("footer", {}, ekle, sag)].filter(Boolean));
}

// ---------- asistanın kenar notları ----------
// "asistan:not" olayı: cevap, sorunun sorulduğu paragrafın kenarına daktilo etiketi ve Literata ile düşer.
// Belge açık değilse de veriye yazılır; açılınca görünür.
// Kitap kapalıysa P başka kitabın (ya da boş) olabilir: paragraf, sorunun sorulduğu yerden ya da açılışta sayfadan bulunur.
const sonSorlar = new Map();   // belgeId -> { p, sayfa }: kitap kapansa da cevap doğru paragrafa düşsün
bus.on("asistan:not", (o) => {
  const belge = o && belgeBul(o.belgeId);
  if (!belge || belge.tur !== "epub" || !o.metin || !String(o.metin).trim()) return;
  const acik = S && S.belge === belge;
  const veri = belge.veri || (belge.veri = acik ? yeniVeri(belge)
    : { vurgular: [], cizgiler: [], yerImleri: [], konum: null, asistanNotlari: [], kurulmadi: true });
  veri.asistanNotlari ||= [];
  const son = sonSorlar.get(belge.id);
  let p = null;
  if (son && (!o.sayfa || son.sayfa === o.sayfa)) p = son.p;
  else if (acik) p = sayfaninParagrafi(o.sayfa);
  const yz = yzAyar();
  const kaynak = yz.yol === "anahtar"
    ? (YZ_SAGLAYICILAR.find((x) => x.id === yz.saglayici) || YZ_SAGLAYICILAR[0]).ad.replace(/\s*\(.*\)$/, "")
    : uygulamaAl().ad;
  const not = { id: yeniId("an"), p, sayfa: o.sayfa || null, soru: String(o.soru || "").trim(), metin: String(o.metin).trim(), kaynak, zaman: Date.now() };
  veri.asistanNotlari.push(not);
  if (!acik) return;
  S.yeniAsistanNotu = not.id;
  kenarNotlariniCiz();
  zamanla(() => {
    const n = S?.el.sutun.querySelector(`.kenar-asistan[data-n="${not.id}"]`);
    if (!n) return;
    const r = n.getBoundingClientRect(), kR = S.el.kaydir.getBoundingClientRect();
    if (r.bottom < kR.top || r.top > kR.bottom) hedefeGit(S.el.sutun.offsetTop + S.pEl[p].offsetTop, () => sutunKutusu([n.getBoundingClientRect()]));
    else kalemHalkasi(sutunKutusu([r]));
  }, 60);
});
function asistanNotuSil(id) {
  const i = S.veri.asistanNotlari.findIndex((n) => n.id === id);
  if (i < 0) return;
  const [n] = S.veri.asistanNotlari.splice(i, 1);
  kenarNotlariniCiz();
  toast("Asistan notu kaldırıldı", { etiket: "Geri al", calistir: () => { if (!S) return; S.veri.asistanNotlari.splice(i, 0, n); kenarNotlariniCiz(); } });
}
function asistanNotuEl(n, satirIci) {
  const z = new Date(n.zaman), tarih = `${String(z.getDate()).padStart(2, "0")}.${String(z.getMonth() + 1).padStart(2, "0")}`;
  const sil = h("button", { type: "button", class: "kenar-asistan__sil", "aria-label": "Asistan notunu kaldır" }, icon("kapat"));
  ikiDokunus(sil, "Emin misin?", () => asistanNotuSil(n.id));
  const kartVar = !!n.kartId && store.kartlar.some((k) => k.id === n.kartId);
  const kart = h("button", { type: "button", class: "kenar-asistan__kart", disabled: kartVar, onclick: () => asistanNotuKarta(n) },
    icon(kartVar ? "tik" : "karta-cevir"), kartVar ? "Tekrar'da" : "Karta çevir");
  return h("aside", { class: "kenar-asistan" + (satirIci ? " satir-ici" : "") + (n.id === S.yeniAsistanNotu ? " yeni" : ""), "data-n": n.id, "aria-label": "Asistan notu" },
    h("span", { class: "etiket" }, `Asistan · ${n.kaynak || "Asistan"} · ${tarih}`, sil),
    h("span", { class: "metin" }, n.metin), kart);
}
// Asistan notu Tekrar kartı olur: ön yüz soru (yoksa paragrafın başı), arka yüz cevap
function asistanNotuKarta(n) {
  const p = P[n.p], bas = p ? (p.metin.length > 160 ? p.metin.slice(0, 160).replace(/\s+\S*$/, "") + "…" : p.metin) : "";
  const on = n.soru ? (bas ? `${n.soru}\n“${bas}”` : n.soru) : bas || "Asistan notu";
  const k = kartEkle({ tur: "soru", on: { metin: on }, arka: { metin: n.metin }, belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: p ? sanalSayfa(p.gi, 0) : n.sayfa || 1 });
  n.kartId = k.id;
  bus.emit("belge:degisti", { belgeId: S.belge.id });
  kenarNotlariniCiz();
  toast("Karta çevrildi · Kutu I", { etiket: "Geri al", calistir: () => { kartSil(k.id); if (S) kenarNotlariniCiz(); } });
}

// ---------- not balonu ----------
// Vurguya not: yazdıkça kenarda el yazısıyla belirir. Kapanınca geçmişe tek işlem olarak yazılır.
function notBalonuAc(v, { kaynak, odakla = false } = {}) {
  menuKapat();
  const alinti = vurguMetni(v);
  const alan = h("textarea", { class: "not-alani", rows: "3", placeholder: "Kenara bir not düş", "aria-label": "Kenar notu", spellcheck: "true" });
  alan.value = v.not || "";
  const boyutla = () => { alan.style.height = "auto"; alan.style.height = Math.max(84, alan.scrollHeight + 2) + "px"; };
  alan.addEventListener("input", () => {
    const vardi = !!(v.not && v.not.trim());
    v.not = alan.value;
    if (vardi !== !!v.not.trim()) paragrafCiz(v.son.p);
    kenarNotlariniCiz();
    boyutla();
  });
  alan.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) katmanKapat(); });
  const renkler = h("div", { class: "not-renkleri", role: "group", "aria-label": "Vurgu rengi" }, ...VURGULAR.map((r) => h("button", {
    type: "button", class: "vd", style: `--v:${r.renk}`, "aria-label": r.ad, "aria-pressed": String(v.renk === r.id),
    onclick: (e) => {
      vurguRenk(v, r.id);
      for (const b of renkler.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
      balon.style.setProperty("--v", r.renk);
    },
  }, h("i"))));
  const kaldir = onayliDugme("Vurguyu kaldır", () => { katmanKapat(false); vurguSil(v); });
  const balon = h("div", { class: "balon not-balonu", role: "dialog", "aria-label": "Kenar notu", style: `--v:${vurguRengi(v.renk)}` },
    h("div", { class: "balon-baslik" }, h("h3", {}, "Kenar notu"), renkler),
    h("blockquote", { class: "not-alinti" }, alinti),
    alan,
    h("div", { class: "balon-alt" }, kaldir, h("button", { type: "button", class: "birincil", onclick: () => katmanKapat() }, "Bitti")));
  katmanAc(balon, { tur: "not", kapat: () => { S.notV = null; notDegisikliginiKaydet(v); } });
  S.notV = v;

  // Konum: vurgunun altında ya da üstünde; dokunmatikte yazarken klavye kapatmasın diye üstte serbest
  const kR = S.kap.getBoundingClientRect();
  let r;
  if (kaynak) r = kaynak.getBoundingClientRect();
  else {
    const ms = [...S.el.sutun.querySelectorAll(`mark[data-v="${v.id}"]`)].flatMap((m) => [...m.getClientRects()]);
    r = ms.length ? ms[ms.length - 1] : kR;
  }
  boyutla();
  const w = balon.offsetWidth, hg = balon.offsetHeight;
  if (odakla && kabaIsaretci()) {
    balon.classList.add("serbest");
    balon.style.left = (kR.width - w) / 2 + "px";
    balon.style.top = (S.okumaModu || S.koltuk ? 12 : UST + 12) + "px";
  } else {
    const merkez = r.left + r.width / 2 - kR.left;
    const sol = sinirla(merkez - w / 2, 12, kR.width - w - 12);
    const asagi = r.bottom + 14 + hg < kR.bottom - 12;
    balon.classList.toggle("ustte", !asagi);
    balon.style.left = sol + "px";
    balon.style.top = (asagi ? r.bottom - kR.top + 14 : Math.max(UST + 8, r.top - kR.top - hg - 14)) + "px";
    balon.style.setProperty("--cikis-x", sinirla(merkez - sol, 24, w - 24) + "px");
  }
  if (odakla) { alan.focus({ preventScroll: true }); alan.setSelectionRange(alan.value.length, alan.value.length); }
}
function notDegisikliginiKaydet(v = S.notV) {
  if (!v) return;
  const temiz = (v.not || "").trim();
  if (v.not !== temiz) { v.not = temiz; paragrafCiz(v.son.p); kenarNotlariniCiz(); }
  const eski = S.anlik.vurgular.find((x) => x.id === v.id);
  if (!eski || (eski.not || "") === temiz) return;
  islem(() => {});
  panelYenile();
}

// İki dokunuşla onay (3.13): ilk dokunuşta "Emin misin? Tekrar dokun", 3 saniye bekler
function onayliDugme(metin, fn) {
  const b = h("button", { type: "button", class: "onayli" }, metin);
  let z = 0;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (b.dataset.durum === "emin") { clearTimeout(z); delete b.dataset.durum; b.textContent = metin; fn(); return; }
    b.dataset.durum = "emin";
    b.textContent = "Emin misin? Tekrar dokun";
    z = setTimeout(() => { delete b.dataset.durum; b.textContent = metin; }, 3000);
  });
  return b;
}

// ---------- balon ve menü katmanı (aynı anda bir tane) ----------
function katmanAc(el, { tur, tetik, kapat, yenile } = {}) {
  katmanKapat(false);
  S.kap.append(el);
  S.katman = { el, tur, tetik, kapat, yenile };
  tetik?.setAttribute("aria-expanded", "true");
}
function katmanKapat(animasyon = true) {
  const k = S?.katman;
  if (!k) return;
  S.katman = null;
  k.tetik?.setAttribute("aria-expanded", "false");
  k.kapat?.();
  if (animasyon && !hareketAz() && k.el.classList.contains("balon")) {
    k.el.classList.add("kapaniyor");
    setTimeout(() => k.el.remove(), 140);
  } else k.el.remove();
}
function katmanYenile() { S.katman?.yenile?.(); }

// Balonu bir düğmenin altına yerleştirir; çentik düğmenin ortasını gösterir
function balonYerlestir(balon, dugme) {
  const kR = S.kap.getBoundingClientRect(), dR = dugme.getBoundingClientRect();
  const w = balon.offsetWidth, merkez = dR.left + dR.width / 2 - kR.left;
  const sol = sinirla(merkez - w / 2, 12, kR.width - w - 12);
  balon.style.left = sol + "px";
  balon.style.top = dR.bottom - kR.top + 14 + "px";
  balon.style.setProperty("--cikis-x", sinirla(merkez - sol, 22, w - 22) + "px");
}

// ---------- Aa balonu ----------
function aaAc() {
  if (S.katman?.tur === "aa") return katmanKapat();
  menuKapat();
  playpenOrnekYukle();
  const balon = h("div", { class: "balon aa-balonu", role: "dialog", "aria-label": "Görünüm" });
  // duzen: temalar şeridinin altındaki satır, null | { tur: "yeni" | "yonet" | "adlandir", id }. ozel: "Özel" bölümü açık mı.
  const durum = { duzen: null, ozel: false };
  const ciz = () => {
    const boyut = tercih.boyut || Math.round(parseFloat(getComputedStyle(S.el.ic).fontSize)) || 19;
    // Bölmeli seçimler çip dizisi: Arama ve Asistan'daki çiplerle aynı biçim (.cip)
    const cipler = (dizi, secili, sec, etiketMetni) => h("div", { class: "cip-dizi", role: "group", "aria-label": etiketMetni },
      ...dizi.map((x) => h("button", { type: "button", class: "cip", "aria-pressed": String(x.deger === secili), onclick: () => sec(x.deger) }, icon(x.ikon), x.ad)));
    const kaydirici = h("input", { type: "range", class: "cetvel", min: "14", max: "26", step: "1", value: String(boyut), "aria-label": "Yazı boyutu" });
    const cikti = h("output", {}, boyut + " px");
    kaydirici.addEventListener("input", () => {
      cikti.textContent = kaydirici.value + " px";
      degistir({ boyut: +kaydirici.value }, false);
      temaIsaretle(balon, +kaydirici.value);
    });
    const kaydirma = balon.querySelector(".tema-numuneler")?.scrollLeft || 0;
    const ic = balon.querySelector(".aa-govde")?.scrollTop || 0;
    const ozel = h("details", { class: "aa-ozel", open: durum.ozel || null },
      h("summary", {}, h("span", {}, "Özel"), h("small", {}, `${(AILELER.find((a) => a.id === tercih.aile) || AILELER[0]).ad} · ${(OLCULER.find((o) => o.deger === tercih.olcu) || OLCULER[1]).ad} · ${sayfaHam() === "oto" ? "Oto" : SAYFA_ADI[S.sayfa] || ""}`), icon("asagi")),
      h("div", { class: "aa-bolum" }, etiket("Yazı tipi"),
        h("div", { class: "aa-yazi" }, ...AILELER.map((a) => h("button", {
          type: "button", "data-aile": a.id, "aria-pressed": String(a.id === tercih.aile),
          onclick: () => { if (a.id === "el") playpenYukle(); degistir({ aile: a.id }); },
        }, h("b", {}, "Ağ"), h("small", {}, a.ad))))),
      h("div", { class: "aa-bolum" }, etiket("Kenar boşluğu"), cipler(OLCULER, tercih.olcu, (d) => degistir({ olcu: d }), "Kenar boşluğu")),
      h("div", { class: "aa-bolum" }, etiket("Sayfa rengi"), kagitDiskleri()));
    ozel.addEventListener("toggle", () => { durum.ozel = ozel.open; requestAnimationFrame(() => aaKaydir(balon)); });
    balon.replaceChildren(
      h("div", { class: "balon-baslik" }, h("h3", {}, "Görünüm"), cikti),
      h("div", { class: "aa-govde" },
        h("div", { class: "aa-bolum" }, etiket("Temalar"), ...temaSeridi(durum, boyut, ciz)),
        h("div", { class: "aa-bolum" }, etiket("Boyut"),
          h("div", { class: "cetvel-satir aa-boyut" }, h("span", { class: "aa-harf kucuk", "aria-hidden": "true" }, "A"), kaydirici, h("span", { class: "aa-harf buyuk", "aria-hidden": "true" }, "A"))),
        h("div", { class: "aa-bolum" }, etiket("Satır aralığı"), cipler(SATIRLAR, tercih.satir, (d) => degistir({ satir: d }), "Satır aralığı")),
        ozel));
    const serit = balon.querySelector(".tema-numuneler");
    if (serit) serit.scrollLeft = kaydirma;
    const govde = balon.querySelector(".aa-govde");
    if (govde) govde.scrollTop = ic;
  };
  const degistir = (deg, yeniden = true) => {
    Object.assign(tercih, deg, { temaId: null });
    ayarlariUygula();
    planla("yerlesim", yerlesimDegisti);
    if (yeniden) ciz();
    requestAnimationFrame(() => S?.katman?.el === balon && aaKaydir(balon));   // ölçü değişince sütun yeniden yer bulur
  };
  ciz();
  katmanAc(balon, { tur: "aa", tetik: dugme("aa"), yenile: ciz, kapat: () => aaKaydir(null) });
  balonYerlestir(balon, dugme("aa"));
  aaKaydir(balon);
}
// Yatayda Aa balonu sütunun üstüne düşüyorsa sütun gerektiği kadar sola kayar (yalnız transform; sade harekette geçişsiz).
// Dikeyde balon alt fiştir, sütun yerinde kalır: üst yarıda sonuç okunur.
function aaKaydir(balon) {
  if (!S) return;
  const ic = S.el.ic, once = S.aaKay || 0;
  let dx = 0;
  if (balon?.isConnected && !matchMedia("(orientation: portrait)").matches) {
    const bR = balon.getBoundingClientRect(), sR = S.el.sutun.getBoundingClientRect(), oR = S.el.okuma.getBoundingClientRect();
    const sol = sR.left + once, sag = sR.right + once;   // kaymamış sütunun kenarları
    if (bR.bottom > oR.top && bR.left < sag + 24) dx = sinirla(Math.ceil(sag + 24 - bR.left), 0, Math.max(0, Math.floor(sol - oR.left - 16)));
  }
  if (dx === once) return;
  S.aaKay = dx;
  ic.style.transform = dx ? `translateX(${-dx}px)` : "";
}

// ---------- okuma temaları (TASARIM-2 §4.6) ----------
function temaUygula(t) {
  Object.assign(tercih, { aile: t.aile, boyut: t.boyut, satir: t.satir, olcu: t.olcu });
  if (t.aile === "el") playpenYukle();
  ayarlariUygula();
  planla("yerlesim", yerlesimDegisti);
  sayfaSec(t.sayfa, { tema: true });
  tercih.temaId = t.id;
  katmanYenile();
}
// Kart, o anki ayarlar temayla birebir aynıysa seçili görünür (temaId'ye bakılmaz: elle aynı ayara gelmek de sayılır)
const temaEslesir = (t, boyut) => t.boyut === boyut && t.satir === tercih.satir && t.olcu === tercih.olcu && t.aile === tercih.aile && t.sayfa === S.sayfa;
function temaIsaretle(balon, boyut) {
  const hepsi = [...HAZIR_TEMALAR, ...temalar()];
  for (const b of balon.querySelectorAll(".tema-numune[data-tema]")) {
    const t = hepsi.find((x) => x.id === b.dataset.tema);
    b.setAttribute("aria-pressed", String(!!t && temaEslesir(t, boyut)));
  }
}
// Numune şeridi ve altındaki kaydet / yönet satırı
function temaSeridi(durum, boyut, ciz) {
  const kayitli = temalar();
  const numune = (t, kendi) => {
    const r = SAYFA_RENKLERI.find((x) => x.id === t.sayfa) || SAYFA_RENKLERI[0];
    const aile = (AILELER.find((a) => a.id === t.aile) || AILELER[0]).css;
    const b = h("button", {
      type: "button", class: "tema-numune", "data-tema": t.id, "aria-pressed": String(temaEslesir(t, boyut)),
      "aria-label": `${t.ad}: ${t.boyut} piksel, ${SAYFA_ADI[t.sayfa] || ""} sayfa` + (kendi ? ". Değiştirmek için basılı tut" : ""),
      style: `--n-zemin:${r.kd};--n-metin:${r.kdy};--n-aile:${aile}`,
    }, h("span", { class: "tema-numune__sayfa", "aria-hidden": "true" }, "Ağ"), h("b", {}, t.ad),
    h("small", {}, `${t.boyut} · ${(SAYFA_ADI[t.sayfa] || "").toLocaleUpperCase("tr")}`));
    let z = 0, uzun = false;
    const yonet = () => { uzun = true; durum.duzen = { tur: "yonet", id: t.id }; ciz(); };
    if (kendi) {
      b.addEventListener("pointerdown", () => { uzun = false; clearTimeout(z); z = setTimeout(yonet, 520); });
      for (const ad of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ad, () => clearTimeout(z));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); clearTimeout(z); if (!uzun) yonet(); });
    }
    b.addEventListener("click", () => {
      if (uzun) { uzun = false; return; }
      durum.duzen = null;
      temaUygula(t);
    });
    return b;
  };
  const yeni = h("button", {
    type: "button", class: "tema-numune yeni", "aria-expanded": String(durum.duzen?.tur === "yeni"), "aria-label": "Şu anki görünümü tema olarak kaydet",
    onclick: () => { durum.duzen = durum.duzen?.tur === "yeni" ? null : { tur: "yeni" }; ciz(); },
  }, h("span", { class: "tema-numune__sayfa", "aria-hidden": "true" }, "+"), h("b", {}, "Kaydet"), h("small", {}, "ŞU ANKİ"));
  const serit = h("div", { class: "tema-numuneler", role: "group", "aria-label": "Okuma temaları" },
    ...HAZIR_TEMALAR.map((t) => numune(t, false)), ...kayitli.map((t) => numune(t, true)), yeni);

  const parcalar = [serit];
  const d = durum.duzen, hedef = d?.id && kayitli.find((t) => t.id === d.id);
  if (d?.tur === "yeni" || (d?.tur === "adlandir" && hedef)) {
    const girdi = h("input", { type: "text", class: "tema-ad", maxlength: "28", placeholder: "Sınav haftası", "aria-label": "Tema adı", enterkeyhint: "done", autocomplete: "off" });
    if (hedef) girdi.value = hedef.ad;
    const kaydet = () => {
      const ad = girdi.value.trim().replace(/\s+/g, " ");
      if (!ad) { girdi.focus(); return; }
      if (hedef) hedef.ad = ad;
      else {
        const t = { id: yeniId("ot"), ad, boyut, satir: tercih.satir, olcu: tercih.olcu, aile: tercih.aile, sayfa: S.sayfa };
        kayitli.push(t);
        tercih.temaId = t.id;
      }
      temalariSakla();
      durum.duzen = null;
      ciz();
      S.katman?.el.querySelector(`.tema-numune[data-tema="${hedef ? hedef.id : tercih.temaId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      toast(hedef ? "Tema yeniden adlandırıldı" : `"${ad}" teması kaydedildi`);
    };
    girdi.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); kaydet(); }
      else if (e.key === "Escape") { e.stopPropagation(); durum.duzen = null; ciz(); }
    });
    parcalar.push(h("div", { class: "tema-duzen" }, girdi,
      h("button", { type: "button", class: "metin-dugme", onclick: () => { durum.duzen = null; ciz(); } }, "Vazgeç"),
      h("button", { type: "button", class: "metin-dugme vurgulu", onclick: kaydet }, "Kaydet")));
    requestAnimationFrame(() => girdi.isConnected && girdi.focus({ preventScroll: true }));
  } else if (d?.tur === "yonet" && hedef) {
    const sil = h("button", { type: "button", class: "metin-dugme sil" }, "Sil");
    ikiDokunus(sil, "Emin misin?", () => {
      kayitli.splice(kayitli.indexOf(hedef), 1);
      if (tercih.temaId === hedef.id) tercih.temaId = null;
      temalariSakla();
      durum.duzen = null;
      ciz();
      toast("Tema silindi");
    });
    parcalar.push(h("div", { class: "tema-duzen yonet" },
      h("span", { class: "tema-duzen__ad" }, hedef.ad),
      h("button", { type: "button", class: "metin-dugme", onclick: () => { durum.duzen = { tur: "adlandir", id: hedef.id }; ciz(); } }, "Yeniden adlandır"),
      sil));
  }
  return parcalar;
}

// Oto ilk sırada: yarısı açık, yarısı koyu disk. Oto seçiliyken çözülen renk ayrıca işaretlenmez.
function kagitDiskleri() {
  const oto = sayfaHam() === "oto";
  const disk = (id, ad, stil, secili) => h("button", {
    type: "button", class: "kagit-disk" + (id === "oto" ? " kagit-disk--oto" : ""), style: stil, "aria-pressed": String(secili), onclick: () => sayfaSec(id),
    title: id === "oto" ? "Uygulama temasını izler: koyu temada Gece, açıkta Beyaz" : null,
  }, h("i", {}, "Aa"), ad);
  return h("div", { class: "kagit-diskler", role: "group", "aria-label": "Sayfa rengi" },
    disk("oto", "Oto", "--kd:linear-gradient(135deg,#FDFBF6 50%,#1B1A17 50%);--kdy:#8E8576", oto),
    ...SAYFA_RENKLERI.map((r) => disk(r.id, r.ad, `--kd:${r.kd};--kdy:${r.kdy}`, !oto && S.sayfa === r.id)));
}

// ---------- ⋯ menüsü ----------
function dahaAc() {
  if (S.katman?.tur === "daha") return katmanKapat();
  menuKapat();
  const fis = h("div", { class: "fis daha-menu okuma-daha", role: "menu", "aria-label": "Diğer" });
  const anahtar = (metin, acik, fn) => {
    const b = h("button", { type: "button", class: "anahtar-satir", role: "switch", "aria-checked": String(acik) }, metin, h("span", { class: "anahtar" }));
    b.addEventListener("click", () => { const v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(v)); fn(v); });
    return b;
  };
  const satir = (ikon, ad, aciklama, fn) => h("button", { type: "button", class: "fis-satir", role: "menuitem", onclick: fn }, icon(ikon), h("span", {}, ad), aciklama ? h("small", {}, aciklama) : null);
  const tema = store.ayarlar.tema || "oto";
  const ciz = () => fis.replaceChildren(...[
    etiket("Sayfa rengi"),
    kagitDiskleri(),
    etiket("Uygulama teması"),
    h("div", { class: "parcali", role: "group", "aria-label": "Uygulama teması" }, ...[["oto", "tema-oto", "Otomatik"], ["acik", "tema-acik", "Açık"], ["koyu", "tema-koyu", "Koyu"]].map(([id, ik, ad]) =>
      h("button", { type: "button", "aria-pressed": String((store.ayarlar.tema || "oto") === id), onclick: () => { temaSec(id); ciz(); } }, icon(ik), ad))),
    h("div", { class: "fis-ayrac" }),
    anahtar("Parmakla çiz", store.ayarlar.parmaklaCiz !== false, (v) => { ayarla({ parmaklaCiz: v }); if (v) S.kalemVar = false; }),
    anahtar("Sade hareket", !!store.ayarlar.sadeHareket, (v) => {
      ayarla({ sadeHareket: v });
      if (v) document.documentElement.dataset.hareket = "sade"; else delete document.documentElement.dataset.hareket;
    }),
    h("div", { class: "fis-hedera", "aria-hidden": "true" }, fleuron("")),
    S.mod === "koltuk" ? satir("notlar", "Notlar ve vurgular", `${S.veri.vurgular.length} vurgu, ${S.veri.yerImleri.length} yer imi`, () => { katmanKapat(); panelAc("sag", "notlar"); }) : null,
    S.mod === "koltuk" ? satir("yer-imi", gorunenYerImleri().length ? "Yer imini kaldır" : "Yer imi ekle", null, () => { katmanKapat(); yerImiDegistir(); }) : null,
    satir("disa-aktar", "Notları dışa aktar", "Vurgular ve kenar notları, Markdown dosyası", () => { katmanKapat(); notlariPaylas(); }),
    satir("gonder", "Samsung Notes'a gönder", "Paylaş menüsünde Samsung Notes'u seç", () => { katmanKapat(); notlariPaylas(); })].filter(Boolean));
  void tema;
  ciz();
  katmanAc(fis, { tur: "daha", tetik: dugme("daha"), yenile: ciz });
  const kR = S.kap.getBoundingClientRect(), dR = dugme("daha").getBoundingClientRect();
  fis.style.right = Math.max(8, kR.right - dR.right) + "px";
  fis.style.top = dR.bottom - kR.top + 6 + "px";
}
// ---------- dışa aktarma (OZELLIKLER-3 §4.4) ----------
// Koltuk çubuğundaki Dışa aktar: tek satırlık fiş, ⋯ menüsüyle aynı görünüm
function disaAktarAc(tetik) {
  if (S.katman?.tur === "disa") return katmanKapat();
  menuKapat();
  const fis = h("div", { class: "fis daha-menu okuma-daha okuma-disa", role: "menu", "aria-label": "Dışa aktar" },
    etiket("Dışa aktar"),
    h("button", { type: "button", class: "fis-satir", role: "menuitem", onclick: () => { katmanKapat(); notlariPaylas(); } },
      icon("notlar"), h("span", {}, "Vurgular ve notlar"), h("small", {}, `${S.veri.vurgular.length} vurgu${elYazisiSayisi() ? `, ${elYazisiSayisi()} el yazısı` : ""} · Markdown, paylaş menüsüyle Samsung Notes'a`)));
  katmanAc(fis, { tur: "disa", tetik });
  const kR = S.kap.getBoundingClientRect(), dR = tetik.getBoundingClientRect();
  fis.style.right = Math.max(8, kR.right - dR.right) + "px";
  fis.style.top = dR.bottom - kR.top + 6 + "px";
}

// disa-aktar.js: epubNotlariDisaAktar + paylas (paylaş menüsü, yoksa indir). Modül yoksa eski yol: Markdown indirilir.
const elYazisiSayisi = () => S.veri.tuvaller.filter((t) => t.cizgiler.length).length;
async function notlariPaylas() {
  if (!S.veri.vurgular.length && !elYazisiSayisi()) { toast("Dışa aktarılacak vurgu yok. Metni seçip bir renge dokun."); return; }
  vurguMetinleriniYaz();
  const belge = S.belge;
  let mod = null;
  try { mod = await import("./disa-aktar.js"); } catch (hata) { console.warn("[okuma] disa-aktar.js yüklenemedi:", hata); }
  if (!mod?.epubNotlariDisaAktar || !mod?.paylas) { if (S) notlariDisaAktar(); return; }
  try {
    const blob = await mod.epubNotlariDisaAktar(belge);
    await mod.paylas(blob, `${belge.ad} (notlar).md`);
  } catch (hata) {
    if (hata?.name === "AbortError") return;   // paylaş menüsü kapatıldı
    console.warn("[okuma] dışa aktarma:", hata);
    toast("Notlar dışa aktarılamadı.");
  }
}

// Vurgular, kenar notları ve el yazısı boşlukları bölüm bölüm bir Markdown dosyasına yazılır ve indirilir
function notlariDisaAktar() {
  const vs = S.veri.vurgular, tv = S.veri.tuvaller.filter((t) => t.cizgiler.length);
  if (!vs.length && !tv.length) { toast("Dışa aktarılacak vurgu yok. Metni seçip bir renge dokun."); return; }
  const tarih = new Date().toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
  const satirlar = [`# ${S.belge.ad}`, "", `${S.belge.yazar ? S.belge.yazar + " · " : ""}Kenar Notu, ${tarih}`, ""];
  const ogeler = [...vs.map((v) => ({ p: v.bas.p, o: v.bas.o, v })), ...tv.map((t) => ({ p: t.p, o: tuvalO(t), t }))].sort(kars);
  let b = -1;
  for (const { p, v } of ogeler) {
    const pb = P[p].b;
    if (pb !== b) { b = pb; satirlar.push(`## ${BOLUMLER[b].ad}: ${BOLUMLER[b].baslik}`, ""); }
    if (!v) { satirlar.push("(el yazısı not)", ""); continue; }   // Active Canvas görüntü olarak eklenmez
    const renk = VURGULAR.find((r) => r.id === v.renk)?.ad || "";
    satirlar.push(`> ${vurguMetni(v)}`, ">", `> *${renk} · ${folyo(v.bas.p, v.bas.o)}*`, "");
    if (v.not && v.not.trim()) satirlar.push(v.not.trim().split("\n").join("  \n"), "");
  }
  const ad = S.belge.ad.toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (c) => "cgiosuaiu"["çğıöşüâîû".indexOf(c)])
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kitap";
  const url = URL.createObjectURL(new Blob([satirlar.join("\n")], { type: "text/markdown;charset=utf-8" }));
  const a = h("a", { href: url, download: `${ad}-notlar.md`, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  const notlu = vs.filter((v) => v.not && v.not.trim()).length;
  toast(`${vs.length} vurgu${notlu ? `, ${notlu} kenar notu` : ""}${tv.length ? `, ${tv.length} el yazısı` : ""} indirildi`);
}

function temaSec(id) {
  ayarla({ tema: id });
  const kok = document.documentElement;
  if (id === "acik") kok.dataset.theme = "light";
  else if (id === "koyu") kok.dataset.theme = "dark";
  else delete kok.dataset.theme;
}

// ---------- okuma modu (3.27.9) ----------
function okumaModu(acik) {
  S.okumaModu = acik;
  S.kap.classList.toggle("okuma-modu", acik);
  S.kap.classList.remove("cubuk-gorunur");
  S.el.okumaModu.setAttribute("aria-pressed", String(acik));
  if (acik) {
    katmanKapat(); menuKapat(); panelKapat();
    if (S.arac !== "okuma") aracSec("okuma", { sessiz: true });
  }
}
// ---------- Koltuk ve Masa (TASARIM-2 §4) ----------
// Koltuk: yalnız metin. Ortaya dokununca çubuklar, kenarlar ekranı %85 kaydırır. Ortak parçalar koltuk.js'te.
function koltukAc({ ilk = false } = {}) {
  if (S.koltuk) return;
  const el = S.el;
  S.koltuk = koltukKur(S.kap, {
    ad: S.belge.ad, tur: "epub",
    bolumler: BOLUMLER.map((b) => ({ ad: b.baslik, oran: b.onceki / TOPLAM })),
    konum: () => S?.kKonum || { oran: S?.belge.ilerleme || 0 },
    git: (oran) => oranaGit(oran),
    etiket: (oran) => {
      const hedef = sinirla(oran, 0, 1) * TOPLAM;
      const b = BOLUMLER.find((x) => x.onceki + x.kelime > hedef) || BOLUMLER[BOLUMLER.length - 1];
      return `${yuzde(oran)} · Bölüm ${b.i + 1}`;
    },
    cevir: (yon) => koltukCevir(yon),
    modDegistir: (m) => modSec(m),
    araclar: [el.kAra, el.kIcindekiler, el.kAa, el.kDisa, el.kDaha],
    sahne: el.kaydir,
    izler: () => izOranlari(),
    izeGit: (id) => { const z = S?.veri.izler.find((x) => x.id === id); if (z) izeGit(z); },
    izAtla: (yon) => izAtla(yon),
    kalemUcu: false,   // EPUB'da kalem gizli: S Pen satır arasına inince Active Canvas açılır, araç seçimi yok
    mesgul: () => !!(S && (S.katman || S.menu || S.el.aramaSatiri || (S.panel && dar()) || S.aktif)),
    // Boşluk açan ya da içine yazan kalem sayfa çevirmez; yazarken konan nokta (ünlemin noktası) da çevirmez
    dokunmaGecerli: (e) => !S || (S.yut !== e.pointerId && !(e.pointerType === "pen" && performance.now() - S.sonCizimZ < IZ_BIRLESME * 2)),
  });
  S.olcum = null;
  if (S.yer) durumGuncelle();
  // Açılışta çubuklar bir kez görünür: nerede olduğunu ve modu gösterir, 4 sn sonra çekilir
  zamanla(() => S?.koltuk?.cubuk(true), ilk ? 360 : 0);
}
function koltukKapat() {
  S.koltuk?.kapat();
  S.koltuk = null;
  S.kKonum = null;
}

// Kenar dokunuşu: sayfa sayfa çevirir. İleride yeni sayfa, gizlenen ilk satırdan başlar; geride bir önceki sayfa
// tam şimdiki ilk satırın üstünde biter. Kaydırma anında olur (ardışık çevirmede hedef hep doğru, bekleme yok);
// his yalnız içeriğin 180 ms'lik ince kayması ve solmasıdır (transform ve opacity).
function koltukCevir(yon) {
  const kay = S.el.kaydir;
  menuKapat();
  katmanKapat();
  islakAktar();
  const st = kay.scrollTop, H = kay.clientHeight;
  let hedef = st + yon * (H - KOLTUK_UST - KOLTUK_ALT);
  if (S.yer) {
    const s = koltukSinir();
    if (yon > 0) hedef = st + s.alt - KOLTUK_UST;
    else {
      // Önceki sayfa şimdiki ilk satırda biter; üst kenarda kesilen satır aşağı, blok (başlık) yukarı oturur
      const y = st + s.ust - (H - KOLTUK_ALT - KOLTUK_UST), r = satirAl(y);
      hedef = (y - r.ust > 0.5 && !r.blok ? r.alt : r.ust) - KOLTUK_UST;
      if (hedef >= st) hedef = y - KOLTUK_UST;
    }
    if (yon > 0 && hedef <= st + S.yer.lh) hedef = st + H - KOLTUK_UST - KOLTUK_ALT;
  }
  hedef = sinirla(Math.round(hedef), 0, kay.scrollHeight - H);
  if (hedef === st) return;
  kay.scrollTop = hedef;
  koltukMaske();   // kaydırma olayını beklemeden: yeni sayfa ilk karede doğru kenarlarla
  if (hareketAz()) return;
  // Kayma Aa'nın sütun kaydırmasının üstüne eklenir (add); opaklık eklenirse 1'i aşıp kırpılır, ayrı ve yerine
  for (const a of S.cevirAnim || []) a.cancel();
  const zaman = { duration: 180, easing: "cubic-bezier(.2,.7,.25,1)" };
  S.cevirAnim = [S.el.ic.animate([{ opacity: 0.5 }, { opacity: 1 }], zaman)];
  // Kayma yalnız kısa kitapta: uzun kitapta bütün metin katmanı her çevirmede baştan boyanıyordu
  // (1500 paragrafta yavaş tablette çevirme başına yaklaşık 200 ms). Solma tek başına ucuz.
  if (P.length <= KAYAN_CEVIRME) {
    S.cevirAnim.push(S.el.ic.animate([{ transform: `translateX(${yon * 14}px)` }, { transform: "translateX(0)" }], { ...zaman, composite: "add" }));
  }
}
// Cetvelden gidiş: kitabın orana denk gelen kelimesi ekranın başına
function oranaGit(oran) {
  if (!S?.yer) return;
  const hedef = sinirla(oran, 0, 1) * TOPLAM;
  const p = P.find((x) => x.onceki + x.kelime > hedef) || P[P.length - 1];
  konumaGit({ p: p.gi, oran: sinirla((hedef - p.onceki) / Math.max(1, p.kelime), 0, 1) });
  S.olcum = null;
  durumGuncelle();
}
// Okuma hızı ölçümü: okunan kelime bir ekranın %80'ini geçince bir ölçüm. Geri dönüş ya da büyük sıçrama ölçülmez.
function hizOlc(okunan) {
  const kay = S.el.kaydir;
  const ekran = okunanKelime(konumAl(kay.scrollTop + UST + kay.clientHeight * 0.85)) - okunan;
  if (S.olcum == null || ekran <= 0) { S.olcum = okunan; S.koltuk.sifirla(); return; }
  const fark = okunan - S.olcum;
  if (fark < -5 || fark > ekran * 2.5) { S.olcum = okunan; S.koltuk.sifirla(); }
  else if (fark >= ekran * 0.8) { S.koltuk.sayfaBitti(fark); S.olcum = okunan; }
}

// Kullanıcının seçimi: yerinde geçer, sonra kabuğa haber verilir (belge kapanıp açılmaz, sayfa yerinde kalır)
function modSec(mod) {
  if (!S) return;
  modDegistir(mod);
  bus.emit("git", { ekran: "belge", belgeId: S.belge.id, mod });
}
export function modDegistir(mod) {
  if (!S || (mod !== "koltuk" && mod !== "masa") || S.mod === mod) return;
  const kap = S.kap;
  islakAktar();
  katmanKapat(false);
  menuKapat();
  aramaKapat();
  panelKapat();
  anlamKapat();
  if (S.okumaModu) okumaModu(false);
  S.mod = mod;
  S.belge.mod = mod;
  kap.dataset.mod = mod;
  S.el.modAnahtari.ayarla(mod);
  if (mod === "koltuk") {
    if (S.arac !== "okuma") aracSec("okuma", { sessiz: true });
    koltukAc();
  } else {
    koltukKapat();
    kap.classList.remove("cubuk-gorunur");
  }
  if (!hareketAz()) {
    kap.classList.remove("mod-gecisi");
    void kap.offsetWidth;
    kap.classList.add("mod-gecisi");
    zamanla(() => S?.kap.classList.remove("mod-gecisi"), 300);
  }
  planla("yerlesim", yerlesimDegisti);
}

function cubukGoster() {
  S.kap.classList.add("cubuk-gorunur");
  clearTimeout(S.cubukZ);
  S.cubukZ = zamanla(() => { if (!S.katman) S.kap.classList.remove("cubuk-gorunur"); }, 3000);
}

// ---------- araçlar ----------
function kalemAyari(ad) {
  if (ad === "fosforlu") return { tur: "fosforlu", ...tercih.fosforlu };
  return tercih.kalemler[+ad.slice(5)];
}
const kalinlikPx = (ad, k) => (ad === "fosforlu" ? 5 : k.mm <= 0.4 ? 2 : k.mm <= 0.8 ? 3 : k.mm <= 1.3 ? 4 : 5);
function kalemDugmesiGuncelle(b) {
  const ad = b.dataset.arac, k = kalemAyari(ad);
  if (b.dataset.tur !== k.tur) { b.innerHTML = KALEM_SVG[k.tur]; b.dataset.tur = k.tur; }
  b.style.setProperty("--tip", k.renk);
  b.style.setProperty("--kalinlik-px", kalinlikPx(ad, k) + "px");
  b.setAttribute("aria-label", ad === "fosforlu" ? `Fosforlu, ${renkAdi(k.renk)}` : `${KALEM_ADI[k.tur]}, ${renkAdi(k.renk)}, ${mmMetni(k.mm)}`);
}
function kalemleriGuncelle() { for (const b of S.el.kalemler) kalemDugmesiGuncelle(b); baglamCiz(); }

function aracSec(ad, { sessiz = false, klavye = false } = {}) {
  if (!sessiz && !klavye && ad === S.arac && ad !== "okuma") return ayarBalonuAc(ad);
  islakAktar();
  S.arac = ad;
  if (ad.startsWith("kalem") || ad === "fosforlu") S.sonKalem = ad;
  if (!sessiz || S.katman?.tur !== "aa") katmanKapat();
  menuKapat();
  const cizim = ad !== "okuma";
  S.kap.dataset.arac = cizim ? "cizim" : "okuma";
  if (cizim) { document.getSelection()?.removeAllRanges(); if (S.okumaModu) okumaModu(false); }
  for (const b of [S.el.okumaAraci, ...S.el.kalemler, S.el.silgi, S.el.kirp]) b.setAttribute("aria-pressed", String(b.dataset.arac === ad));
  S.el.silgiImlec.hidden = true;
  baglamCiz();
}

// Bağlam bölgesi: etkin araca göre renkler ve kalınlıklar (3.12); dar çubukta Mürekkep düğmesine katlanır
function baglamCiz() {
  const b = S.el.baglam, a = S.arac;
  const parcalar = [h("span", { class: "ayrac" })];
  const damla = (renk, secili, fn, sinif = "") => h("button", { type: "button", class: ("damla " + sinif).trim(), style: `--renk:${renk}`, "aria-label": renkAdi(renk), "aria-pressed": String(secili), onclick: fn }, h("i"));
  const kalinlik = (d, secili, etiketMetni, fn, renk) => h("button", { type: "button", class: "kalinlik", style: `--d:${d}px;--renk-simdi:${renk}`, "aria-label": etiketMetni, "aria-pressed": String(secili), onclick: fn }, h("i"));
  let simdiRenk = "transparent", simdiD = 7;
  if (a.startsWith("kalem")) {
    const k = kalemAyari(a);
    simdiRenk = k.renk;
    for (const r of k.son) parcalar.push(damla(r, r === k.renk, () => { k.renk = r; kalemleriGuncelle(); }));
    for (const [mm, d] of KALEM_KALINLIKLARI) {
      if (Math.abs(mm - k.mm) < 0.05) simdiD = d;
      parcalar.push(kalinlik(d, Math.abs(mm - k.mm) < 0.05, mmMetni(mm), () => { k.mm = mm; kalemleriGuncelle(); }, k.renk));
    }
  } else if (a === "fosforlu") {
    const f = tercih.fosforlu;
    simdiRenk = f.renk;
    for (const [, r] of FOSFORLAR) parcalar.push(damla(r, r === f.renk, () => { f.renk = r; kalemleriGuncelle(); }, "keski"));
    for (const [w, d] of FOSFOR_KALINLIKLARI) {
      if (w === f.w) simdiD = d;
      parcalar.push(kalinlik(d, w === f.w, `${w} birim`, () => { f.w = w; kalemleriGuncelle(); }, f.renk));
    }
  } else if (a === "silgi") {
    simdiRenk = "var(--ink-2)";
    for (const [r, d] of SILGI_BOYLARI) parcalar.push(kalinlik(d, r === tercih.silgi.r, `Silgi boyu ${r}`, () => { tercih.silgi.r = r; baglamCiz(); }, "var(--ink-2)"));
    parcalar.push(h("span", { class: "baglam-ipucu" }, "Dokunduğu çizgiyi siler"));
  } else if (a === "kirp") {
    parcalar.push(h("span", { class: "baglam-ipucu" }, "Kaydetmek için bir alan sürükle"));
  } else {
    parcalar.push(h("span", { class: "baglam-ipucu" }, "Metni seç: vurgula, not ekle, kırp"));
  }
  const murekkep = h("button", {
    type: "button", class: "damla murekkep-dugme" + (a === "okuma" || a === "kirp" ? " bos-arac" : ""), style: `--renk:${simdiRenk};--d:${simdiD}px`,
    "aria-label": "Renk ve kalınlık", onclick: (e) => ayarBalonuAc(a, e.currentTarget),
  }, h("i"));
  b.replaceChildren(...parcalar, murekkep);
}

// Etkin araca tekrar dokununca ayar balonu (3.13)
function ayarBalonuAc(ad, dugme) {
  if (ad === "okuma") return;
  if (S.katman?.tur === "arac:" + ad) return katmanKapat();
  menuKapat();
  const tetik = dugme || [...S.el.kalemler, S.el.silgi, S.el.kirp].find((b) => b.dataset.arac === ad);
  const balon = h("div", { class: "balon arac-balonu", role: "dialog" });
  const ciz = () => {
    if (ad.startsWith("kalem")) kalemBalonu(balon, kalemAyari(ad));
    else if (ad === "fosforlu") fosforluBalonu(balon);
    else if (ad === "silgi") silgiBalonu(balon);
    else balon.replaceChildren(h("div", { class: "balon-baslik" }, h("h3", {}, "Kırp")),
      h("p", { class: "balon-not" }, "Metinde bir alan sürükle. Seçtiğin bölge çizimlerle birlikte Kırpılanlar'a kaydedilir."));
  };
  ciz();
  katmanAc(balon, { tur: "arac:" + ad, tetik, yenile: ciz });
  balonYerlestir(balon, tetik);
  dalgalariCiz(balon);
}
function dalgalariCiz(balon) {
  for (const c of balon.querySelectorAll("canvas[data-tur]")) ornekDalga(c, { tur: c.dataset.tur, renk: c.dataset.renk, w: +c.dataset.w });
}
function cetvel({ min, max, step, deger, etiketMetni, kucuk, buyuk, fn }) {
  const g = h("input", { type: "range", class: "cetvel", min: String(min), max: String(max), step: String(step), value: String(deger), "aria-label": etiketMetni });
  g.addEventListener("input", () => fn(+g.value));
  return h("div", { class: "cetvel-satir" }, h("i", { style: `width:${kucuk}px;height:${kucuk}px` }), g, h("i", { style: `width:${buyuk}px;height:${buyuk}px` }));
}
function paletCiz(dizi, secili, fn, sinif = "") {
  return h("div", { class: ("palet " + sinif).trim(), role: "group" }, ...dizi.map(([ad, renk]) => h("button", {
    type: "button", class: "damla" + (sinif ? " keski" : ""), style: `--renk:${renk}`, "aria-label": ad, title: ad, "aria-pressed": String(renk === secili), onclick: () => fn(renk),
  }, h("i"))));
}
function kalemBalonu(balon, k) {
  const cikti = h("output", {}, mmMetni(k.mm));
  const yenile = () => { kalemleriGuncelle(); ayarBalonuYenile(balon, () => kalemBalonu(balon, k)); };
  balon.replaceChildren(
    h("div", { class: "balon-baslik" }, h("h3", {}, KALEM_ADI[k.tur]), cikti),
    etiket("Tür"),
    h("div", { class: "tur-secici" }, ...KALEM_TURLERI.map((t) => h("button", { type: "button", class: "tur", "aria-pressed": String(t === k.tur), onclick: () => { k.tur = t; yenile(); } },
      h("span", { class: "ornek-kagit" }, h("canvas", { "data-tur": t, "data-renk": k.renk, "data-w": String(k.mm * 5) })), KALEM_ADI[t]))),
    etiket("Kalınlık"),
    cetvel({ min: 0.2, max: 2, step: 0.1, deger: k.mm, etiketMetni: "Kalınlık", kucuk: 4, buyuk: 12, fn: (v) => {
      k.mm = Math.round(v * 10) / 10; cikti.textContent = mmMetni(k.mm); kalemleriGuncelle(); dalgalariCiz(balon);
      for (const c of balon.querySelectorAll("canvas[data-tur]")) c.dataset.w = String(k.mm * 5);
      dalgalariCiz(balon);
    } }),
    etiket("Mürekkep"),
    paletCiz(MUREKKEPLER, k.renk, (r) => {
      k.renk = r;
      if (!k.son.includes(r)) { k.son.unshift(r); k.son.length = 5; }
      yenile();
    }));
}
function fosforluBalonu(balon) {
  const f = tercih.fosforlu, cikti = h("output", {}, String(f.w));
  const duz = h("button", { type: "button", class: "anahtar-satir", role: "switch", "aria-checked": String(f.duz) }, "Düz çizgi", h("span", { class: "anahtar" }));
  duz.addEventListener("click", () => { f.duz = !f.duz; duz.setAttribute("aria-checked", String(f.duz)); });
  balon.replaceChildren(
    h("div", { class: "balon-baslik" }, h("h3", {}, "Fosforlu"), cikti),
    etiket("Kalınlık"),
    cetvel({ min: 10, max: 40, step: 1, deger: f.w, etiketMetni: "Kalınlık", kucuk: 6, buyuk: 16, fn: (v) => { f.w = v; cikti.textContent = String(v); kalemleriGuncelle(); } }),
    etiket("Renk"),
    paletCiz(FOSFORLAR, f.renk, (r) => { f.renk = r; kalemleriGuncelle(); ayarBalonuYenile(balon, () => fosforluBalonu(balon)); }, "palet-fosfor"),
    duz);
}
function silgiBalonu(balon) {
  const s = tercih.silgi;
  const sadece = h("button", { type: "button", class: "anahtar-satir", role: "switch", "aria-checked": String(s.sadeceFosforlu) }, "Sadece fosforluyu sil", h("span", { class: "anahtar" }));
  sadece.addEventListener("click", () => { s.sadeceFosforlu = !s.sadeceFosforlu; sadece.setAttribute("aria-checked", String(s.sadeceFosforlu)); });
  balon.replaceChildren(
    h("div", { class: "balon-baslik" }, h("h3", {}, "Silgi")),
    etiket("Boyut"),
    cetvel({ min: 6, max: 40, step: 1, deger: s.r, etiketMetni: "Silgi boyutu", kucuk: 6, buyuk: 16, fn: (v) => { s.r = v; baglamCiz(); } }),
    sadece,
    h("div", { class: "balon-alt" }, onayliDugme("Bütün çizimleri sil", () => {
      if (!S.veri.cizgiler.length) { katmanKapat(); return; }
      islem(() => { S.veri.cizgiler = []; });
      S.goruntu = null; karolariGuncelle(true); katmanKapat();
      toast("Çizimler silindi", { etiket: "Geri al", calistir: () => S && geriAl() });
    })));
}
function ayarBalonuYenile(balon, ciz) { ciz(); dalgalariCiz(balon); }

// ---------- mürekkep: karolar ve dönüşüm ----------
// Saklanan çizgiler içerik birimine çevrilir (x + sütun solu, y + paragraf üstü); kutu içerik pikselindedir.
function cevir(c) {
  const { s, sol, pUst } = S.yer;
  const dx = sol / s, dy = pUst[sinirla(c.ap | 0, 0, P.length - 1)] / s;
  const g = { id: c.id, tur: c.tur, renk: c.renk, w: c.w, p: c.p.map((q) => [q[0] + dx, q[1] + dy, q[2]]) };
  if (c.duz) g.duz = true;
  if (c.sekil) g.sekil = c.sekil;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of g.p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const pay = (c.w || 3) + 2;
  g.kutu = { x0: (x0 - pay) * s, y0: (y0 - pay) * s, x1: (x1 + pay) * s, y1: (y1 + pay) * s };
  return g;
}
function goruntuler() {
  if (!S.goruntu) S.goruntu = S.veri.cizgiler.map(cevir);
  return S.goruntu;
}
// Karoya düşen bütün mürekkep: Masa çizgileri ve [y0, y1] içerik pikseline yakın izler
function gorunenCizgiler(y0, y1) {
  const g = goruntuler();
  return S.veri.izler.length ? g.concat(izlerAraliginda(y0, y1)) : g;
}
const karoKesisir = (k, i) => k.y1 >= i * KARO && k.y0 <= (i + 1) * KARO;

function karolariGuncelle(zorla) {
  if (!S.yer) return;
  const kay = S.el.kaydir, H = kay.clientHeight, ust = kay.scrollTop;
  const bas = Math.max(0, Math.floor((ust - H * 0.5) / KARO)), son = Math.floor((ust + H * 1.5) / KARO);
  const g = gorunenCizgiler((bas - 2) * KARO, (son + 3) * KARO);
  for (const [i, cv] of S.karolar) {
    if (i < bas - 2 || i > son + 2 || !g.some((c) => karoKesisir(c.kutu, i))) { cv.width = 0; cv.height = 0; cv.remove(); S.karolar.delete(i); }
  }
  for (let i = bas; i <= son; i++) {
    if (!g.some((c) => karoKesisir(c.kutu, i))) continue;
    let cv = S.karolar.get(i);
    const yeni = !cv;
    if (yeni) { cv = h("canvas"); S.el.murekkep.append(cv); S.karolar.set(i, cv); }
    if (yeni || zorla) karoCiz(i, cv);
  }
}
function karoCiz(i, cv, yalniz) {
  const { icGen, s } = S.yer;
  const d = Math.min(globalThis.devicePixelRatio || 1, 4096 / Math.max(1, icGen));
  const W = Math.round(icGen * d), H = Math.round(KARO * d);
  const ctx = cv.getContext("2d");
  if (!yalniz) {
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.cssText = `top:${i * KARO}px;width:${icGen}px;height:${KARO}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }
  ctx.setTransform(d * s, 0, 0, d * s, 0, -i * KARO * d);
  const koyu = KOYU_SAYFA.has(S.sayfa);
  for (const c of yalniz || gorunenCizgiler(i * KARO, (i + 1) * KARO)) if (karoKesisir(c.kutu, i)) cizgiCiz(ctx, c, { koyuSayfa: koyu });
}
// Yeni çizgi: yalnız değdiği karolara eklenir (yeniden çizim yok)
function cizgiyiKarolaraEkle(g) {
  for (let i = Math.max(0, Math.floor(g.kutu.y0 / KARO)); i <= Math.floor(g.kutu.y1 / KARO); i++) {
    const cv = S.karolar.get(i);
    if (cv) karoCiz(i, cv, [g]);
  }
  karolariGuncelle(false);
}
function karolariYenile(kutular) {
  for (const [i, cv] of S.karolar) if (kutular.some((k) => karoKesisir(k, i))) karoCiz(i, cv);
  karolariGuncelle(false);
}

function canliBoyutla() {
  const o = S.el.okuma, w = o.clientWidth, hg = o.clientHeight;
  const d = Math.min(globalThis.devicePixelRatio || 1, 4096 / Math.max(1, w));
  // Boyut aynıysa dokunulmaz: boşluk açılınca gelen yerleşim yazılan çizgiyi silmesin
  const anahtar = `${w}|${hg}|${S.yer.s}|${d}|${S.sayfa}`;
  if (anahtar === S.canliAnahtar) return;
  S.canliAnahtar = anahtar;
  S.canli.boyutla(w, hg, S.yer.s * d, { dpr: d, koyuSayfa: KOYU_SAYFA.has(S.sayfa) });
}

// En yakın paragraf: çizginin ilk noktası (içerik pikseli)
function yakinParagraf(y) {
  const { pUst, pAlt } = S.yer;
  let lo = 0, hi = P.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pAlt[m] < y) lo = m + 1; else hi = m; }
  if (lo > 0 && y < pUst[lo] && y - pAlt[lo - 1] < pUst[lo] - y) lo--;
  return lo;
}

// ---------- işaretçi: okuma, kalem, silgi, kırp, parmakla kaydırma ----------
function olaylariBagla() {
  const { kaydir, sutun } = S.el, sinyal = S.sinyal;
  kaydir.addEventListener("scroll", kaydirildi, { passive: true, signal: sinyal });
  kaydir.addEventListener("pointerdown", isaretciBasti, { signal: sinyal });
  kaydir.addEventListener("pointermove", isaretciOynadi, { signal: sinyal });
  kaydir.addEventListener("pointerup", isaretciKalkti, { signal: sinyal });
  kaydir.addEventListener("pointercancel", isaretciKalkti, { signal: sinyal });
  kaydir.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") S.el.silgiImlec.hidden = true; }, { signal: sinyal });
  // Havadaki kalem: imleç halkası, Koltuk'ta satır belirmesi ve köşe ipucu. Kalem havadayken kaydırıcı dokunuşla
  // kaymaz (touch-action), yoksa S Pen'in ilk çizgisi kaydırmaya gider.
  S.el.okuma.addEventListener("pointermove", kalemHavada, { passive: true, signal: sinyal });
  S.el.okuma.addEventListener("pointerleave", (e) => { if (e.pointerType === "pen") havaBitti(); }, { signal: sinyal });
  // Kalemle uzun basış Android bağlam menüsünü, seçim balonunu ve büyüteci açmaz (S Pen 4)
  S.el.okuma.addEventListener("contextmenu", (e) => {
    if (S && (S.sonIsaretci === "pen" || performance.now() - S.sonKalemZ < 800)) e.preventDefault();
  }, { signal: sinyal });
  // Köşe kıvırma (TASARIM-3 §12)
  const kb = S.el.koseBolge;
  kb.addEventListener("pointerdown", koseBasti, { signal: sinyal });
  kb.addEventListener("pointermove", koseOynadi, { signal: sinyal });
  kb.addEventListener("pointerup", koseKalkti, { signal: sinyal });
  kb.addEventListener("pointercancel", koseKalkti, { signal: sinyal });
  kaydir.addEventListener("wheel", () => islakAktar(), { passive: true, signal: sinyal });
  sutun.addEventListener("click", vurguyaDokunuldu, { signal: sinyal });
  document.addEventListener("selectionchange", () => {
    if (!S || S.arac !== "okuma") return;
    clearTimeout(S.secimZ);
    S.secimZ = setTimeout(secimDegisti, 200);
  }, { signal: sinyal });
  document.addEventListener("pointerdown", (e) => {
    if (!S) return;
    const k = S.katman;
    if (k && !k.el.contains(e.target) && !k.tetik?.contains(e.target)) katmanKapat();
    if (S.menu && !S.menu.el.contains(e.target) && !S.el.sutun.contains(e.target)) menuKapat();
  }, { capture: true, signal: sinyal });
  document.addEventListener("keydown", tusBasildi, { signal: sinyal });
  window.addEventListener("pagehide", () => { if (S?.yer && S.el.kaydir.scrollHeight === S.yer.kayYuk) S.veri.konum = konumAl(); }, { signal: sinyal });

  S.ro = new ResizeObserver(() => planla("yerlesim", yerlesimDegisti));
  S.ro.observe(S.el.okuma);
  // Koltuk çubukları açılıp kapanınca sayfa penceresinin kenarları (maske) yeniden hesaplanır
  // (yalnız cubuk-gorunur değişince: kalemin "yaziyor" sınıfı ölçüm tetiklemesin)
  let cubukOnce = S.kap.classList.contains("cubuk-gorunur");
  S.mo = new MutationObserver(() => {
    const c = !!S?.kap.classList.contains("cubuk-gorunur");
    if (c !== cubukOnce) { cubukOnce = c; koltukMaske(); }
  });
  S.mo.observe(S.kap, { attributes: true, attributeFilter: ["class"] });
  S.ro.observe(sutun);

  const sayfaTazele = () => {
    if (!S) return;
    const s = sayfaAl();
    if (s !== S.sayfa) { sayfaUygula(s); katmanYenile(); }
    else if (S.meta) S.meta.content = SAYFA_META[S.sayfa];   // app.js temayı uygularken bunu ezer, geri yaz
  };
  S.bus.push(bus.on("ayarlar", sayfaTazele));
  // "Oto" sayfa uygulama temasını izler: kabuğun "tema" olayı ve sistem teması (kabuk yayınlamasa da)
  S.bus.push(bus.on("tema", sayfaTazele));
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(sayfaTazele, 0), { signal: sinyal });
  // Aynı belge için mod ya da sayfa isteği (kabuk belgeyi yeniden açmayabilir): yerinde uygula
  S.bus.push(bus.on("git", (g) => {
    if (!S || g?.ekran !== "belge" || g.belgeId !== S.belge.id) return;
    if (g.mod) modDegistir(g.mod);
    if (g.ara || g.konum || g.sayfa > 0 || g.iz) git(g);
  }));
  // Anlam kartına akan cevap (asistan.js, istek kimliğiyle)
  S.bus.push(bus.on("asistan:cevap", (d) => { const a = S?.anlam; if (a && d?.istek === a.istek) anlamParca(a, d); }));
  // Hesap yolunda uygulamadan dönünce "Cevabı getir" bir kez vurgulanır
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) tercihSakla();   // Android arka plandaki PWA'yı kapatırken pagehide gelmeyebilir
    const a = S?.anlam;
    if (document.hidden || !a || a.durum !== "donus" || a.vurgula) return;
    a.vurgula = true;
    anlamCiz(a);
  }, { signal: sinyal });
  S.bus.push(bus.on("kirpintilar", (e) => { if (S && e?.tur !== "not" && S.panel === "sag" && S.sekme === "kirpintilar") panelYenile(); }));
}

function vurguyaDokunuldu(e) {
  if (S.arac !== "okuma" || performance.now() - S.sonCizimZ < 400) return;
  const sec = document.getSelection();
  if (sec && !sec.isCollapsed) return;
  const m = e.target.closest("mark.vurgu");
  const v = m && vurguBul(m.dataset.v);
  if (!v) return;
  if (v.not && v.not.trim()) notBalonuAc(v, { kaynak: m });
  else vurguMenusuAc(v, m);
}

function kalemAlgilandi() {
  if (S.kalemVar) return;
  S.kalemVar = true;
  if (store.ayarlar.parmaklaCiz !== false) { ayarla({ parmaklaCiz: false }); toast("Kalem algılandı, parmakla artık sayfa kayar."); }
}

// Silgi ucu her zaman siler; yan tuş Ayarlar'daki "Yan tuş silgi" açıksa. Basınç S Pen eğrisinden geçer.
const silgiTusu = (e) => e.pointerType === "pen" && (!!(e.buttons & 32) || (!!(e.buttons & 2) && store.ayarlar.yanTusSilgi !== false));
const basinc = (q) => (q.pointerType === "pen" ? (ortak.basincUygula ? ortak.basincUygula(q.pressure || 0.5) : q.pressure || 0.5) : 0.5);
function geciciSilgi(acik) {
  S.el.silgi.classList.toggle("gecici-etkin", acik);
  for (const b of S.el.kalemler) b.classList.toggle("dinlen", acik && b.dataset.arac === S.arac);
}

function isaretciBasti(e) {
  S.sonIsaretci = e.pointerType;
  S.yut = null;
  if (e.pointerType === "pen") { kalemAlgilandi(); kalemYakin(); S.sonKalemZ = performance.now(); havaBitti(); }
  // Koltuk avuç içi reddi: kalem yazarken, kalem görüldükten 600 ms içinde (havada da) ya da geniş temasta dokunuş yok sayılır
  if (S.mod === "koltuk" && e.pointerType === "touch"
    && (S.aktif?.tur === "pen" || performance.now() - S.sonKalemZ < KALEM_AVUC || (e.width > 44 && e.height > 44))) return;
  if (S.mod === "koltuk" && e.pointerType === "touch") cokParmakBasti(e);
  if (S.mod === "koltuk" && S.arac === "okuma" && !S.okumaModu && tuvalBasti(e)) return;
  if (S.arac === "okuma" || S.okumaModu) {
    S.basili = e.pointerType === "mouse";
    S.dokunus = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (S.mod === "koltuk" && e.isPrimary && (e.pointerType !== "mouse" || e.button === 0)) uzunBasisKur(e);
    return;
  }
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.pointerType === "mouse" && e.clientX - S.el.kaydir.getBoundingClientRect().left > S.el.kaydir.clientWidth) return;   // kaydırma çubuğu
  if (e.pointerType === "touch" && (S.parmak || S.kalemVar || S.mod === "koltuk" || store.ayarlar.parmaklaCiz === false)) return parmakBasla(e);   // koltukta parmak hiç çizmez
  if (S.aktif) return;   // çizim sırasında yalnız ilk işaretçi izlenir
  // Kalem kalktıktan hemen sonra (.yaziyor sürerken) araç çubuğuna dokunuş metne düşmesin
  const cR = S.el.cubuk.getBoundingClientRect();
  if (e.clientX >= cR.left && e.clientX <= cR.right && e.clientY >= cR.top && e.clientY <= cR.bottom) return;
  // Masa'da kalemle açık bir el yazısı boşluğuna inen çizgi boşluğa yazılır
  const tvEl = S.arac.startsWith("kalem") && !silgiTusu(e) && e.target.closest?.(".tuval:not(.kucuk)");
  if (tvEl && !e.target.closest("button") && S.tv.has(tvEl.dataset.t)) { tuvalYazBasla(e, S.tv.get(tvEl.dataset.t), false); return; }
  e.preventDefault();
  cancelAnimationFrame(S.raf.atalet);
  try { S.el.kaydir.setPointerCapture(e.pointerId); } catch { /* işaretçi çoktan bırakıldıysa yakalama gerekmez */ }
  katmanKapat();
  const R = S.el.okuma.getBoundingClientRect(), s = S.yer.s;
  const arac = silgiTusu(e) ? "silgi" : S.arac;
  const nokta = [(e.clientX - R.left) / s, (e.clientY - R.top) / s, basinc(e)];
  S.aktif = { id: e.pointerId, tur: e.pointerType, arac, R, s, kaydir0: S.el.kaydir.scrollTop, bas: nokta };
  S.kap.classList.add("yaziyor");
  if (arac === "silgi") { geciciSilgi(arac !== S.arac); silgiBasla(nokta, e); }
  else if (arac === "kirp") S.canli.dikdortgen(nokta[0], nokta[1], nokta[0], nokta[1], "kirp");
  else kalemBasla(nokta);
}

function isaretciOynadi(e) {
  if (S.uzun && e.pointerId === S.uzun.id && Math.hypot(e.clientX - S.uzun.x, e.clientY - S.uzun.y) > 10) uzunBasisIptal();
  if (S.cp?.ids.has(e.pointerId)) cokParmakOynadi(e);
  if (S.parmak?.noktalar.has(e.pointerId)) return parmakOynadi(e);
  const a = S.aktif;
  if (S.arac !== "okuma" && e.pointerType === "pen" && !a) geciciSilgi(!!silgiTusu(e) && S.arac !== "silgi");
  if (S.arac === "silgi" || a?.arac === "silgi" || (S.arac !== "okuma" && silgiTusu(e))) silgiImleci(e);
  if (!a || e.pointerId !== a.id || a.iptal) return;
  const birlesik = e.getCoalescedEvents?.() || [];
  const olaylar = birlesik.length ? birlesik : [e];   // boş liste dönerse olayın kendisi
  const nok = (q) => [(q.clientX - a.R.left) / a.s, (q.clientY - a.R.top) / a.s, basinc(q)];
  if (a.arac === "kalem" && silgiTusu(e)) {   // çizim sırasında yan tuşa basıldı: çizgiyi bitir, silgiye geç
    kalemBitir();
    a.arac = "silgi";
    geciciSilgi(true);
    silgiBasla(nok(e), e);
    return;
  }
  if (a.arac === "silgi") { for (const q of olaylar) silgiOynat(nok(q)); return; }
  if (a.arac === "kirp") { const n = nok(e); S.canli.dikdortgen(a.bas[0], a.bas[1], n[0], n[1], "kirp"); a.son = n; return; }
  // kalem ve fosforlu
  const c = a.cizgi;
  if (a.duz) { c.p[1] = nok(e); S.canli.ciz(c); return; }
  if (a.bosluk && !a.karar) bosluktaKarar(a, nok(e));
  for (const q of olaylar) {
    const n = nok(q), o = c.p[c.p.length - 1];
    if (!a.tuval && !a.iz && Math.hypot(n[0] - o[0], n[1] - o[1]) > 1.5) {   // el yazısında ve izde düzeltme yok
      clearTimeout(a.bekle);
      a.bekle = setTimeout(() => duzelt(a), 600);   // kalemi basılı tut, düzelt
    }
    c.p.push(n);
  }
  const tahmin = (e.getPredictedEvents?.() || []).slice(0, 2).map(nok);
  S.canli.ciz(c, tahmin);
}

function isaretciKalkti(e) {
  if (S.cp?.ids.has(e.pointerId)) cokParmakKalkti(e);
  if (S.uzun && e.pointerId === S.uzun.id) {
    // Android uzun basışta seçime geçerken işaretçiyi iptal edebilir: süre dolmak üzereyse kart yine açılır
    const u = S.uzun;
    uzunBasisIptal();
    if (e.type === "pointercancel" && performance.now() - u.t >= 380) uzunBasisBitti(u);
  }
  if (S.parmak?.noktalar.has(e.pointerId)) return parmakKalkti(e);
  if (S.dokunus && e.pointerId === S.dokunus.id) {
    const d = S.dokunus;
    S.dokunus = null;
    S.basili = false;
    const tik = Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 350;
    // Boşluğa dokunuş: açıksa küçülür, simgeyse açılır
    const tv = tik && e.type === "pointerup" && !e.target.closest("button") && e.target.closest?.(".tuval");
    if (tv && S.tv.has(tv.dataset.t)) { const r = S.tv.get(tv.dataset.t); tuvalAcKapa(r, !r.t.kucuk); return; }
    if (S.okumaModu && tik && e.type === "pointerup" && document.getSelection()?.isCollapsed !== false && !e.target.closest("mark.vurgu, .kenar-notu, button")) cubukGoster();
    if (e.pointerType === "mouse") secimDegisti();
    return;
  }
  const a = S.aktif;
  if (!a || e.pointerId !== a.id) return;
  clearTimeout(a.bekle);
  if (a.arac === "silgi") silgiBitir();
  else if (a.arac === "kirp") {
    S.canli.temizle();
    const n = a.son || a.bas, s = a.s;
    const x0 = Math.min(a.bas[0], n[0]) * s, x1 = Math.max(a.bas[0], n[0]) * s;
    const y0 = Math.min(a.bas[1], n[1]) * s, y1 = Math.max(a.bas[1], n[1]) * s;
    if (e.type === "pointerup" && x1 - x0 > 16 && y1 - y0 > 16) kirpYap({ x: x0, y: y0 + a.kaydir0, w: x1 - x0, h: y1 - y0 });
  } else if (e.type === "pointerup") kalemBitir();
  else S.canli.temizle();
  if (a.tur === "pen") S.sonKalemZ = performance.now();
  S.aktif = null;
  geciciSilgi(false);
  if (S.arac !== "silgi") S.el.silgiImlec.hidden = true;
  zamanla(() => { if (!S.aktif) S.kap.classList.remove("yaziyor"); }, 150);
}

// Kalem ve fosforlu
function kalemBasla(nokta) {
  const a = S.aktif, k = kalemAyari(S.arac);
  a.arac = "kalem";
  const c = { id: yeniId("c"), tur: k.tur, renk: k.renk, w: S.arac === "fosforlu" ? k.w : k.mm * 5, p: [nokta] };
  if (S.arac === "fosforlu" && k.duz) c.duz = true;
  a.cizgi = c;
  S.el.canli.classList.toggle("carp", S.arac === "fosforlu");   // fosforlu canlıyken de sayfayla çarpılır
  S.canli.ciz(c);
}
function duzelt(a) {
  if (S?.aktif !== a || a.duz || a.cizgi.p.length < 3) return;
  a.cizgi = duzlestir(a.cizgi);
  a.duz = true;
  S.canli.ciz(a.cizgi);
}
function kalemBitir() {
  const a = S.aktif;
  clearTimeout(a.kararZ);
  if (a.bosluk && !a.karar) izBosluga(a);   // satır arasına kısa dokunuş: boşluk açılır, iz kalmaz
  if (a.iptal) { S.canli.temizle(); return; }
  const c = a.cizgi, kaydir0 = a.kaydir0;
  a.bekleyenIslak = true;
  if (a.iz) {
    a.kalkis = performance.now();
    clearTimeout(S.izZ);   // ıslak çizgi kaydedilince sınıflama yeniden kurulur: birleşecek çizgi beklenmeden kapanmasın
    if (izHareketli(c.p, a.s)) S.sonCizimZ = a.kalkis;   // çizginin ardından gelen tıklama vurgu menüsü açmasın
    islakBitir(S.canli, c, (bitmis) => izCizgiKaydet(bitmis, a)); }
  else if (a.tuval) islakBitir(S.canli, c, (bitmis) => tuvalCizgiKaydet(bitmis, a));
  else islakBitir(S.canli, c, (bitmis) => cizgiKaydet(bitmis, kaydir0));
}
// Canlı katman birimindeki çizgiyi en yakın paragrafa bağlar ve saklar
function cizgiKaydet(c, kaydir0) {
  if (!S || !c.p.length) return;
  const { s, sol, pUst } = S.yer;
  const ap = yakinParagraf(c.p[0][1] * s + kaydir0);
  const dx = sol / s, dy = (pUst[ap] - kaydir0) / s;
  const kayit = { id: c.id, tur: c.tur, renk: c.renk, w: c.w, ap, p: c.p.map((q) => [q[0] - dx, q[1] - dy, q[2]]) };
  if (c.duz) kayit.duz = true;
  islem(() => { S.veri.cizgiler.push(kayit); });
  const g = cevir(kayit);
  goruntuler().push(g);
  cizgiyiKarolaraEkle(g);
}

// Silgi: dokunduğu çizgiyi bütün olarak siler (kalem.js silgi), bir hareket tek geçmiş kaydıdır
function silgiBasla(n, e) {
  const a = S.aktif;
  a.once = S.anlik;
  a.silinen = [];
  a.onceki = null;
  silgiImleci(e);
  silgiOynat(n);
}
function silgiOynat(n) {
  const a = S.aktif, s = a.s;
  const x = n[0], y = n[1] + a.kaydir0 / s;
  const r = tercih.silgi.r * (a.tur === "pen" ? 1 : 1.2);
  tuvalSilgi(n, r);
  izSilgi(x, y, r, a);
  if (a.yalnizTuval) return;   // Koltuk'ta yan tuş yalnız el yazısını ve izleri siler
  const silinen = silgiUygula(goruntuler(), x, y, r, { sadeceFosforlu: tercih.silgi.sadeceFosforlu, onceki: a.onceki });
  a.onceki = [x, y];
  if (!silinen.length) return;
  const idler = new Set(silinen.map((g) => g.id));
  S.veri.cizgiler = S.veri.cizgiler.filter((c) => !idler.has(c.id));
  a.silinen.push(...silinen);
  karolariYenile(silinen.map((g) => g.kutu));
}
function silgiBitir() {
  const a = S.aktif;
  if (a.tuvalSilindi || a.izSilindi) belgeDegisti();
  if (a.izSilindi) S.koltuk?.izleriYenile?.();
  if (!a.silinen.length && !a.tuvalSilindi && !a.izSilindi) return;
  const sonra = durumAnlik();
  S.gecmis.kaydet({ sayfa: "okuma", once: a.once, sonra });
  S.anlik = sonra;
  gecmisGuncelle();
}
function silgiImleci(e) {
  const im = S.el.silgiImlec, R = S.el.okuma.getBoundingClientRect();
  im.hidden = false;
  im.style.setProperty("--cap", Math.max(10, tercih.silgi.r * 2 * (S.yer?.s || 1)) + "px");
  im.style.translate = `${e.clientX - R.left}px ${e.clientY - R.top}px`;
}

// Kalem algılanınca parmak sayfayı JS ile kaydırır (touch-action: none). İki parmak dokunuşu geri al, üç yinele.
function parmakBasla(e) {
  cancelAnimationFrame(S.raf.atalet);
  islakAktar();
  const g = S.parmak || (S.parmak = { noktalar: new Map(), enCok: 0, t0: performance.now(), yol: 0, v: 0, iz: [] });
  g.noktalar.set(e.pointerId, e.clientY);
  g.enCok = Math.max(g.enCok, g.noktalar.size);
  try { S.el.kaydir.setPointerCapture(e.pointerId); } catch { /* işaretçi çoktan bırakıldıysa yakalama gerekmez */ }
}
function parmakOynadi(e) {
  const g = S.parmak, once = g.noktalar.get(e.pointerId);
  g.noktalar.set(e.pointerId, e.clientY);
  if (e.pointerId !== g.noktalar.keys().next().value) return;   // ilk parmak kaydırır
  const dy = e.clientY - once;
  g.yol += Math.abs(dy);
  S.el.kaydir.scrollTop -= dy;
  const t = performance.now();
  g.iz.push([t, e.clientY]);
  while (g.iz.length > 2 && t - g.iz[0][0] > 80) g.iz.shift();
}
function parmakKalkti(e) {
  const g = S.parmak;
  g.noktalar.delete(e.pointerId);
  if (e.type === "pointercancel") g.iptal = true;   // iptal edilen dokunuş jest sayılmaz
  if (g.noktalar.size) return;
  S.parmak = null;
  if (g.iptal) return;
  const sure = performance.now() - g.t0;
  if (g.enCok >= 2 && sure < 300 && g.yol < 12) { if (g.enCok === 2) geriAl(); else yinele(); return; }
  if (g.iz.length < 2) return;
  const [t0, y0] = g.iz[0], [t1, y1] = g.iz[g.iz.length - 1];
  let v = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;   // px/ms
  let son = performance.now();
  const kay = S.el.kaydir;
  const adim = (t) => {
    if (!S) return;
    const dt = t - son; son = t;
    kay.scrollTop -= v * dt;
    v *= Math.pow(0.95, dt / 16.7);
    if (Math.abs(v) > 0.05) S.raf.atalet = requestAnimationFrame(adim);
  };
  if (Math.abs(v) > 0.05) S.raf.atalet = requestAnimationFrame(adim);
}

// ---------- Active Canvas: metne bağlı el yazısı (OZELLIKLER-4 §5) ----------
// Koltuk'ta S Pen iki satırın arasına inince orada bir boşluk açılır: satır başına takılan, sütun genişliğinde satır içi
// blok (.tuval). Metin aşağı kayar. Düzen değişince boşluk bağlı olduğu harfin satırının altına yeniden oturur.
// Çizim canlı katmanda (CanliKatman), bitince boşluğun kendi tuvaline. Tuvaller yalnız ekrana yakınken bellek tutar.
const TUVAL_YUK = 150;     // yeni boşluk, birim (varsayılan düzende yaklaşık beş satır)
const TUVAL_PAY = 40;      // yazı alt kenara bu kadar yaklaşınca boşluk uzar
const TUVAL_KALEM = { tur: "tukenmez", renk: "#1F3A68", w: 2.5 };   // tükenmez, 0,5 mm
const BOSLUK = /\s/;

const tuvalO = (t) => Math.round(sinirla(t.oran, 0, 1) * P[t.p].metin.length);
const belgeDegisti = () => { if (S) bus.emit("belge:degisti", { belgeId: S.belge.id }); };
const ileriHarf = (m, i) => { while (i < m.length && BOSLUK.test(m[i])) i++; return i; };
const geriHarf = (m, i) => { while (i >= 0 && BOSLUK.test(m[i])) i--; return i; };
// Boşluk aç, kapat, uza: düzen hemen ölçülür (konum oranı bozulmasın), geri kalanı sonraki karede
function duzenTazele() { yerlesimOlc(); planla("yerlesim", yerlesimDegisti); }

// Çalışma kaydı: veri ve öğeler. ix: açık boşluğun takıldığı harf (o anki düzende bir satır başı).
function tuvalKaydi(t) {
  const kucult = h("button", { type: "button", class: "tuval-dugme", "aria-label": "Küçült" }, icon("yukari"));
  const sil = h("button", { type: "button", class: "tuval-dugme", "aria-label": "El yazısı notu sil" }, icon("sil"));
  const cv = h("canvas", { class: "tuval-cv", "aria-hidden": "true" });
  const el = h("span", { class: "tuval", "data-t": t.id, "data-dokunma-yok": "" }, icon("tuval"), cv, h("span", { class: "tuval-arac" }, kucult, sil));
  const r = { t, el, cv, ix: null, gorunur: false, boyut: "", olcek: 1 };
  kucult.addEventListener("click", (e) => { e.stopPropagation(); tuvalAcKapa(r, true); });
  sil.addEventListener("click", (e) => { e.stopPropagation(); tuvalKaldir(r); });
  S.tv.set(t.id, r);
  tuvalDurumu(r);
  return r;
}
function tuvalDurumu(r) {
  const k = !!r.t.kucuk;
  r.el.classList.toggle("kucuk", k);
  r.el.setAttribute("role", k ? "button" : "group");
  r.el.setAttribute("aria-label", k ? "El yazısı not, açmak için dokun" : "El yazısı not");
  r.el.style.aspectRatio = k ? "" : `${BIRIM} / ${r.t.yukseklik}`;   // genişlikle birlikte ölçeklenir
  S.tvIO ||= new IntersectionObserver(tuvalGorunurluk, { root: S.el.kaydir, rootMargin: "60% 0px" });
  if (k) { S.tvIO.unobserve(r.el); tuvalBirak(r); } else S.tvIO.observe(r.el);
}
function tuvalGorunurluk(girdiler) {
  if (!S) return;
  for (const g of girdiler) {
    const r = S.tv.get(g.target.dataset.t);
    if (!r) continue;
    r.gorunur = g.isIntersecting;
    if (r.gorunur) tuvalCiz(r, true); else tuvalBirak(r);
  }
}
function tuvalBirak(r) { r.cv.width = 0; r.cv.height = 0; r.boyut = ""; }
// degistiyse: boyut ve sayfa rengi aynıysa yeniden çizilmez
function tuvalCiz(r, degistiyse = false) {
  if (r.t.kucuk || !r.el.isConnected) return;
  const w = r.el.clientWidth, hg = r.el.clientHeight;
  if (!w || !hg) return;
  const d = Math.min(globalThis.devicePixelRatio || 1, 4096 / w, 8192 / hg);
  const W = Math.round(w * d), H = Math.round(hg * d), boyut = `${W}x${H}|${S.sayfa}`;
  if (degistiyse && boyut === r.boyut) return;
  const cv = r.cv;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  r.olcek = (d * w) / BIRIM;
  ctx.setTransform(r.olcek, 0, 0, r.olcek, 0, 0);
  const koyu = KOYU_SAYFA.has(S.sayfa);
  for (const c of r.t.cizgiler) cizgiCiz(ctx, c, { koyuSayfa: koyu });
  r.boyut = boyut;
}
function tuvalleriTazele(zorla) {
  for (const r of S.tv.values()) if (r.gorunur && !r.t.kucuk) tuvalCiz(r, !zorla);
}

// Paragraf metninin o. harfinin önüne öğe takar (vurgu işaretinin içine düşebilir, metin ofsetleri değişmez)
function ofsetteEkle(pEl, o, el) {
  const w = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT);
  let d, k = o;
  while ((d = w.nextNode())) {
    if (k < d.length) { (k > 0 ? d.splitText(k) : d).before(el); return; }
    k -= d.length;
  }
  pEl.append(el);
}
function metinDugumleri(pEl) {
  const w = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT), dz = [];
  let a = 0, d;
  while ((d = w.nextNode())) { if (d.length) dz.push({ d, a }); a += d.length; }
  return dz;
}
function harfKutusu(dz, i) {
  if (i < 0) return null;
  let lo = 0, hi = dz.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (dz[m].a <= i) lo = m; else hi = m - 1; }
  const x = dz[lo], k = x ? i - x.a : -1;
  if (k < 0 || k >= x.d.length) return null;
  const r = document.createRange();
  r.setStart(x.d, k); r.setEnd(x.d, k + 1);
  return r.getClientRects()[0] || null;
}
// o'dan önceki harfin satırının altındaki satırın ilk harfi: boşluğun takılacağı yer. Ölçüm salt okumadır.
function satirBasi(gi, o) {
  const metin = P[gi].metin, n = metin.length;
  if (o >= n) return n;
  const a = geriHarf(metin, o - 1);
  if (a < 0) return o;
  const pEl = S.pEl[gi], dz = metinDugumleri(pEl);
  const ust = harfKutusu(dz, a)?.top;
  if (ust == null) return o;
  const esik = (parseFloat(getComputedStyle(pEl).fontSize) || 16) * 0.5;
  const altta = (i) => { const j = ileriHarf(metin, i); if (j >= n) return true; const q = harfKutusu(dz, j); return !!q && q.top > ust + esik; };
  let lo = a + 1, hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (altta(m)) hi = m; else lo = m + 1; }
  let j = ileriHarf(metin, lo);
  if (j >= n) return n;
  while (j > a + 1 && HARF.test(metin[j - 1]) && HARF.test(metin[j])) j--;   // tireyle bölünen kelime bütün iner
  return j;
}

// Paragraftaki boşlukları takar: simgeler bağlı harfin önüne, açıklar son ölçülen satır başına
function tuvalleriTak(gi) {
  const pEl = S.pEl[gi], rs = [];
  for (const r of S.tv.values()) if (r.t.p === gi) rs.push(r);
  pEl.classList.toggle("tuvalli", rs.length > 0);
  for (const r of rs) {
    r.el.remove();
    ofsetteEkle(pEl, r.t.kucuk ? tuvalO(r.t) : r.ix ?? tuvalO(r.t), r.el);
  }
}
// Satır kırılımı değiştiyse (sütun, yazı tipi, boyut, satır aralığı) açık boşluklar yeniden oturur.
// Önce hepsi sökülür, sonra art arda ölçülür (tek düzen hesabı), sonra takılır.
function tuvalleriYerlestir(zorla, yalnizP = null) {
  if (!S.tv.size) return;
  if (yalnizP == null) {
    const cs = getComputedStyle(S.el.sutun);
    const anahtar = `${S.el.sutun.clientWidth}|${cs.fontSize}|${cs.lineHeight}|${cs.fontFamily}`;
    if (!zorla && anahtar === S.tvAnahtar) return;
    S.tvAnahtar = anahtar;
  }
  const aciklar = [...S.tv.values()].filter((r) => !r.t.kucuk && (yalnizP == null || r.t.p === yalnizP));
  if (!aciklar.length) return;
  for (const r of aciklar) r.el.remove();
  for (const r of aciklar) r.ix = satirBasi(r.t.p, tuvalO(r.t));
  for (const r of aciklar) ofsetteEkle(S.pEl[r.t.p], r.ix, r.el);
}

// Kalemin indiği yer iki satırın arasıysa boşluğun yeri { p, o }; bir satırın üstündeyse ya da başlıktaysa null
function noktadakiBosluk(e) {
  const y = e.clientY;
  // Paragraf önce dokunulan öğeden (ölçü eskimiş olsa da doğru), yoksa ölçülmüş yerleşimden
  let gi = +(e.target.closest?.(".okuma-sutun p[data-p]")?.dataset.p ?? -1);
  if (!(gi >= 0 && gi < P.length)) {
    const yc = y - S.el.ic.getBoundingClientRect().top, { pUst, pAlt } = S.yer;
    let lo = 0, hi = P.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pAlt[m] <= yc) lo = m + 1; else hi = m; }
    if (yc < pUst[lo] || yc > pAlt[lo]) return null;   // bölüm başlığı, sahne ayracı
    gi = lo;
  }
  const pEl = S.pEl[gi], metin = P[gi].metin, n = metin.length, dz = metinDugumleri(pEl);
  const cs = getComputedStyle(pEl);
  const satir = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 16) * 1.6;
  const asagida = (i) => { const j = ileriHarf(metin, i); if (j >= n) return true; const q = harfKutusu(dz, j); return !!q && (q.top + q.bottom) / 2 > y; };
  let a = 0, b = n;
  while (a < b) { const m = (a + b) >> 1; if (asagida(m)) b = m; else a = m + 1; }
  let j = ileriHarf(metin, a), ustKenar, altKenar, yer;
  if (j >= n) {   // son satırın altı: sonraki paragrafla arası
    const s = P[gi + 1];
    if (!s || s.b !== P[gi].b) return null;
    ustKenar = harfKutusu(dz, geriHarf(metin, n - 1))?.bottom;
    altKenar = harfKutusu(metinDugumleri(S.pEl[gi + 1]), ileriHarf(s.metin, 0))?.top;
    yer = { p: gi, o: n };
  } else if (geriHarf(metin, j - 1) < 0) {   // ilk satırın üstü: önceki paragrafla arası
    const o = P[gi - 1];
    if (!o || o.b !== P[gi].b) return null;
    ustKenar = harfKutusu(metinDugumleri(S.pEl[gi - 1]), geriHarf(o.metin, o.metin.length - 1))?.bottom;
    altKenar = harfKutusu(dz, j)?.top;
    yer = { p: gi - 1, o: o.metin.length };
  } else {
    const i = geriHarf(metin, j - 1);
    ustKenar = harfKutusu(dz, i)?.bottom;
    altKenar = harfKutusu(dz, j)?.top;
    while (j > 0 && HARF.test(metin[j - 1]) && HARF.test(metin[j])) j--;   // tireyle bölünmüş kelime bütün iner
    yer = { p: gi, o: j };
  }
  if (ustKenar == null || altKenar == null || altKenar < ustKenar - satir * 0.5) return null;
  return Math.abs(y - (ustKenar + altKenar) / 2) <= satir * 0.4 ? yer : null;
}

function tuvalAc(yer) {
  for (const r of S.tv.values()) {
    if (r.t.p === yer.p && tuvalO(r.t) === yer.o) { if (r.t.kucuk) tuvalAcKapa(r, false); return r; }
  }
  // Aşağıdaki boş boşluklar kalkar; yukarıdakiler kalemin altındaki metni kaydırmasın diye belge kapanınca atılır
  for (const r of [...S.tv.values()]) {
    if (!r.t.cizgiler.length && (r.t.p > yer.p || (r.t.p === yer.p && tuvalO(r.t) > yer.o))) tuvalKaldir(r, { sessiz: true });
  }
  const n = P[yer.p].metin.length;
  const t = { id: yeniId("t"), p: yer.p, oran: n ? yer.o / n : 0, yukseklik: TUVAL_YUK, cizgiler: [] };
  S.veri.tuvaller.push(t);
  S.veri.tuvaller.sort((x, y) => x.p - y.p || x.oran - y.oran);
  const r = tuvalKaydi(t), pEl = S.pEl[t.p];
  pEl.classList.add("tuvalli");
  r.ix = satirBasi(t.p, yer.o);   // tuvalli paragraf "pretty" kırılımdan çıkar, satır başı yeniden ölçülür
  ofsetteEkle(pEl, r.ix, r.el);
  if (!hareketAz()) { r.el.classList.add("aciliyor"); zamanla(() => r.el.classList.remove("aciliyor"), 260); }
  duzenTazele();
  return r;
}
function tuvalAcKapa(r, kucuk) {
  islakAktar();
  if (kucuk && !r.t.cizgiler.length) { tuvalKaldir(r, { sessiz: true }); return; }
  if (kucuk) r.t.kucuk = true; else delete r.t.kucuk;
  tuvalDurumu(r);
  r.el.remove();
  if (kucuk) ofsetteEkle(S.pEl[r.t.p], tuvalO(r.t), r.el);
  tuvalleriYerlestir(true, r.t.p);   // simge satır kırılımını değiştirebilir: o paragrafın açıkları yeniden oturur
  if (!kucuk && !hareketAz()) { r.el.classList.add("aciliyor"); zamanla(() => r.el.classList.remove("aciliyor"), 260); }
  duzenTazele();
  if (!kucuk) tuvalCiz(r);
  belgeDegisti();
}
function tuvalKaldir(r, { sessiz = false } = {}) {
  islakAktar();
  const t = r.t, i = S.veri.tuvaller.indexOf(t);
  if (i >= 0) S.veri.tuvaller.splice(i, 1);
  S.tvIO?.unobserve(r.el);
  r.el.remove();
  tuvalBirak(r);
  S.tv.delete(t.id);
  tuvalleriTak(t.p);
  duzenTazele();
  belgeDegisti();
  if (sessiz || !t.cizgiler.length) return;
  const belge = S.belge;
  toast("El yazısı not silindi", { etiket: "Geri al", calistir: () => {
    if (!S || S.belge !== belge) return;
    S.veri.tuvaller.push(t);
    S.veri.tuvaller.sort((x, y) => x.p - y.p || x.oran - y.oran);
    tuvalKaydi(t);
    tuvalleriTak(t.p);
    tuvalleriYerlestir(true, t.p);
    duzenTazele();
    belgeDegisti();
  } });
}

// Kalem havadayken (S Pen yaklaşınca) kaydırıcı dokunuşla kaymaz: ilk çizgi kaydırmaya gitmesin
function kalemYakin() {
  S.kalemHava = performance.now();
  if (S.kap.classList.contains("kalem-yakin")) return;
  S.kap.classList.add("kalem-yakin");
  const bak = () => {
    if (!S) return;
    if (S.aktif || performance.now() - S.kalemHava < 1200) zamanla(bak, 400);
    else S.kap.classList.remove("kalem-yakin");
  };
  zamanla(bak, 400);
}

// Koltuk'ta kalem ya da fare: boşluğa yaz, simgeyi aç, satır arasına inince yeni boşluk; kalem metne ya da kenara
// inince iz başlar (OZELLIKLER-5 §1.1). Olayı yuttuysa true.
function tuvalBasti(e) {
  const kalem = e.pointerType === "pen", fare = e.pointerType === "mouse" && e.button === 0;
  if ((!kalem && !fare) || !S.yer) return false;
  if (S.aktif) { if (kalem) e.preventDefault(); return kalem; }   // yazarken ikinci işaretçi yok
  const tvEl = e.target.closest?.(".tuval");
  if (tvEl && e.target.closest("button")) return false;   // küçült ve sil kendi tıklamasıyla
  const r = tvEl && S.tv.get(tvEl.dataset.t);
  if (r?.t.kucuk) { e.preventDefault(); S.yut = e.pointerId; tuvalAcKapa(r, false); return true; }
  if (r) return tuvalYazBasla(e, r, false);
  if (!kalem) return false;
  if (silgiTusu(e)) return tuvalYazBasla(e, null, false);   // yan tuş: dokunduğu el yazısını ve izleri siler
  if (e.target.closest?.("button, a, input, textarea, .kenar-notu, .kenar-asistan, .kurdele")) return false;
  // Satır arası: kalem yerinde durursa ya da dokunup kalkarsa boşluk açılır, yataya akarsa alt çizgi olur (bosluktaKarar)
  const sutunda = sutunIcinde(e.clientX);
  const yer = sutunda ? noktadakiBosluk(e) : null;
  return izBasla(e, yer);
}
// acilis: boşluğu bu dokunuş açtı; yerinde kalan kısa dokunuş iz bırakmaz
function tuvalYazBasla(e, r, acilis) {
  e.preventDefault();
  S.yut = e.pointerId;
  uzunBasisIptal();
  cancelAnimationFrame(S.raf.atalet);
  try { S.el.kaydir.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
  katmanKapat();
  menuKapat();
  const R = S.el.okuma.getBoundingClientRect(), s = S.yer.s;
  const nokta = [(e.clientX - R.left) / s, (e.clientY - R.top) / s, basinc(e)];
  const a = S.aktif = {
    id: e.pointerId, tur: e.pointerType, arac: silgiTusu(e) ? "silgi" : "kalem", R, s, kaydir0: S.el.kaydir.scrollTop, bas: nokta,
    tuval: r, acilis, yalnizTuval: S.mod === "koltuk",
  };
  if (r) { const q = r.el.getBoundingClientRect(); a.tx = (q.left - R.left) / s; a.ty = (q.top - R.top) / s; }
  S.kap.classList.add("yaziyor");
  if (a.arac === "silgi") { silgiBasla(nokta, e); return true; }
  const k = S.mod === "masa" && S.arac.startsWith("kalem") ? kalemAyari(S.arac) : null;   // Masa'da seçili kalem
  a.cizgi = k ? { id: yeniId("c"), tur: k.tur, renk: k.renk, w: k.mm * 5, p: [nokta] } : { id: yeniId("c"), ...TUVAL_KALEM, p: [nokta] };
  S.el.canli.classList.remove("carp");
  S.canli.ciz(a.cizgi);
  return true;
}
// Canlı katmandaki çizgi boşluğun birimine çevrilir (aynı birim: sütun genişliği / BIRIM), yalnız o çizgi eklenir
function tuvalCizgiKaydet(c, a) {
  const r = a.tuval;
  if (!S || !c.p.length || S.tv.get(r.t.id) !== r) return;
  if (a.acilis && c.p.every((q) => Math.hypot(q[0] - c.p[0][0], q[1] - c.p[0][1]) < 3)) return;
  const kayit = { id: c.id, tur: c.tur, renk: c.renk, w: c.w, p: c.p.map((q) => [q[0] - a.tx, q[1] - a.ty, q[2]]) };
  if (c.duz) kayit.duz = true;
  // Geri al: önceki anlıkta bu tuval yoksa (yeni açıldı) o anda boştu
  if (!S.anlik.tuvaller?.some(([x]) => x === r.t)) (S.anlik.tuvaller ||= []).push([r.t, []]);
  islem(() => { r.t.cizgiler.push(kayit); });
  if (r.boyut) {
    const ctx = r.cv.getContext("2d");
    ctx.setTransform(r.olcek, 0, 0, r.olcek, 0, 0);
    cizgiCiz(ctx, kayit, { koyuSayfa: KOYU_SAYFA.has(S.sayfa) });
  } else tuvalCiz(r);
  tuvalUzat(r, kayit);
  belgeDegisti();
}
// Yazı alt kenara yaklaşınca boşluk uzar; düzen kalem kalktıktan biraz sonra değişir, yazarken değil
function tuvalUzat(r, c) {
  let alt = 0;
  for (const q of c.p) if (q[1] > alt) alt = q[1];
  alt += genislik(c.tur, c.w, 1);
  if (alt < r.t.yukseklik - TUVAL_PAY) return;
  r.t.yukseklik = Math.ceil(alt + TUVAL_PAY * 2);
  clearTimeout(S.uzatZ);
  const uygula = () => {
    if (!S || S.tv.get(r.t.id) !== r) return;
    if (S.aktif) { S.uzatZ = zamanla(uygula, 300); return; }
    tuvalDurumu(r);
    duzenTazele();
    tuvalCiz(r);
  };
  S.uzatZ = zamanla(uygula, 450);
}
// Silgi: ekrandaki açık boşlukların çizgileri (kutular hareket başında bir kez ölçülür)
function tuvalSilgi(n, yaricap) {
  const a = S.aktif;
  if (!S.tv.size) return;
  if (!a.tuvalKutular) {
    a.tuvalKutular = [];
    for (const r of S.tv.values()) {
      if (r.t.kucuk || !r.el.isConnected) continue;
      const q = r.el.getBoundingClientRect();
      if (q.bottom < a.R.top || q.top > a.R.bottom) continue;
      a.tuvalKutular.push({ r, x: (q.left - a.R.left) / a.s, y: (q.top - a.R.top) / a.s, w: q.width / a.s, h: q.height / a.s });
    }
  }
  const once = a.tOnceki;
  a.tOnceki = [n[0], n[1]];
  for (const k of a.tuvalKutular) {
    const x = n[0] - k.x, y = n[1] - k.y;
    if (x < -yaricap || y < -yaricap || x > k.w + yaricap || y > k.h + yaricap) continue;
    const silinen = silgiUygula(k.r.t.cizgiler, x, y, yaricap, { onceki: once ? [once[0] - k.x, once[1] - k.y] : null });
    if (silinen.length) { tuvalCiz(k.r); a.tuvalSilindi = true; }
  }
}

// ---------- İzler: kalemin değdiği yerler (OZELLIKLER-5 §1 ve İzler sözleşmesi, TASARIM-3 §7) ----------
// Koltuk'ta kalem araç seçmeden metnin ya da kenarın üstüne iz bırakır; parmak çevirmeye devam eder. Çizim canlı
// katmanda; kalem kalkınca iz önce bulunduğu paragrafa bağlanır (geçici, serbest gibi çizilir), kısa bir aradan sonra
// boşta sınıflanır ve metne bağlanır. Kalem yolunda ölçüm yok: sınıflama ve metin bulma kalem kalktıktan sonra.
// Kayıt: cizgiler kalem.js biçiminde ama birimi em (sütunun yazı boyutu), kalınlık w de em. Her tür kendi çapasına göre
// saklanır; düzen değişince çapa yeniden ölçülür, iz çizildiği gibi (titremesiyle) taşınır:
//   alt     x: (karakter konumu - bas.o) × capa.harf, y: satırın harf kutusunun altına göre. Satır kırılınca parçalanır.
//   daire   kapsanan metnin kutusunun ortasına göre; capa { w, h } o kutunun boyu. Kutu değişince en-boy korunarak ölçeklenir.
//   kenar   x: sütun kenarına (capa.yan "sol" | "sag"), y: metnin üstüne göre; capa.h metnin boyu, dikeyde ölçeklenir.
//   isaret  kendi ortasına göre; capa { yan, dx, dy }: ortanın sütun kenarına ve bağlı satırın ortasına uzaklığı.
//   serbest kendi ortasına göre; capa { x, oy }: ortanın sütun solundan uzaklığı (em) ve bas.p paragrafındaki oranı.
// gecici: true henüz sınıflanmadı (serbest gibi çizilir; kaydet ve kapat bekleyenleri hemen sınıflar).
const IZ_BIRLESME = 650;   // ms: kalkıştan bu kadar içinde yakına inen çizgi aynı izdir (ünlem, soru, çift alt çizgi)
const IZ_METIN = 280;
const yuvarla = (v, b = 1e3) => Math.round(v * b) / b;
const izGecerli = (z) => !!z && !!z.bas && !!z.son && Number.isInteger(z.bas.p) && Number.isInteger(z.son.p)
  && z.bas.p >= 0 && z.son.p < P.length && z.bas.p <= z.son.p && Array.isArray(z.cizgiler);
// Eski kayıtta izler yoksa []. Kitaba uymayan iz silinmez, yalnız çizilmez (ayrıştırma sürümü değişse de veri kalsın).
function izleriDuzelt(l) {
  return Array.isArray(l) ? l.filter((z) => z && typeof z === "object" && Array.isArray(z.cizgiler)) : [];
}
// Koltuk'un kalemi: Masa'da son seçilen kalem, yoksa ilk kalem (varsayılan dolma, mürekkep mavisi)
function izKalemi() {
  const ad = S.sonKalem?.startsWith("kalem") ? S.sonKalem : "kalem0";
  return kalemAyari(ad) || tercih.kalemler[0];
}
function sutunIcinde(x) {
  const R = S.el.sutun.getBoundingClientRect(), pay = S.yer.em * 0.3;
  return x >= R.left - pay && x <= R.right + pay;
}
const izHareketli = (p, s) => p.some((q) => Math.hypot(q[0] - p[0][0], q[1] - p[0][1]) * s >= 4);

// Kalem metne ya da kenara indi. bosluk: satır arasına indiyse Active Canvas'ın yeri (karar kalemin ilk hareketiyle)
function izBasla(e, bosluk) {
  e.preventDefault();
  clearTimeout(S.izZ);   // yeni çizgi bekleyen izle birleşebilir: sınıflama kalkışa kadar bekler
  uzunBasisIptal();
  cancelAnimationFrame(S.raf.atalet);
  try { S.el.kaydir.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
  katmanKapat();
  menuKapat();
  const R = S.el.okuma.getBoundingClientRect(), s = S.yer.s, k = izKalemi();
  const nokta = [(e.clientX - R.left) / s, (e.clientY - R.top) / s, basinc(e)];
  const a = S.aktif = {
    id: e.pointerId, tur: "pen", arac: "kalem", R, s, kaydir0: S.el.kaydir.scrollTop, bas: nokta,
    iz: true, bosluk, yalnizTuval: true, t0: performance.now(),
  };
  a.cizgi = { id: yeniId("c"), tur: k.tur, renk: k.renk, w: k.mm * 5, p: [nokta] };
  // Satır arasında dokunuş sayfa çevirmez; kelimeye uzun basış anlam kartını açar (iz bırakmaz)
  if (bosluk) { S.yut = e.pointerId; a.kararZ = setTimeout(() => izBosluga(a), 220); }
  else uzunBasisKur(e);
  S.kap.classList.add("yaziyor");
  S.el.canli.classList.remove("carp");
  S.canli.ciz(a.cizgi);
  return true;
}
// Satır arasına inen kalem: yataya akarsa alt çizgi (iz), başka yöne yazmaya başlarsa ya da yerinde durursa boşluk açılır
function bosluktaKarar(a, n) {
  const dx = (n[0] - a.bas[0]) * a.s, dy = (n[1] - a.bas[1]) * a.s;
  if (Math.hypot(dx, dy) < 8) return;
  if (Math.abs(dx) > 2 * Math.abs(dy)) { a.karar = "iz"; clearTimeout(a.kararZ); }
  else izBosluga(a);
}
function izBosluga(a) {
  if (S?.aktif !== a || a.karar) return;
  a.karar = "tuval";
  clearTimeout(a.kararZ);
  const r = tuvalAc(a.bosluk), q = r.el.getBoundingClientRect();
  Object.assign(a, { iz: false, tuval: r, acilis: true, tx: (q.left - a.R.left) / a.s, ty: (q.top - a.R.top) / a.s });
  a.cizgi = { id: a.cizgi.id, ...TUVAL_KALEM, p: a.cizgi.p };   // boşlukta el yazısının kalemi
  S.canli.ciz(a.cizgi);
}

// Kalkan çizgi: bekleyen izin yakınına ve kısa süre içinde indiyse ona katılır, yoksa yeni geçici iz olur.
// Çizgi çizildiği karede karolara işlenir; sınıflama IZ_BIRLESME sonra boşta.
function izCizgiKaydet(c, a) {
  if (!S?.yer || !c.p.length) return;
  const ham = { id: c.id, tur: c.tur, renk: c.renk, w: c.w, p: c.p.map((q) => [q[0], q[1] + a.kaydir0 / a.s, q[2]]) };
  const b = S.izBekleyen;
  const katil = b && b.iz.gecici && S.veri.izler.includes(b.iz) && a.t0 - b.kalkis < IZ_BIRLESME && izYakin(b.iz, ham);
  if (!katil && !izHareketli(c.p, a.s)) return;   // tek başına kısa dokunuş iz bırakmaz; izin yanındaki nokta katılır
  let iz;
  if (katil) {
    const eski = b.iz;
    iz = { ...serbestCapa([...izGoruntu(eski), ham]), id: eski.id, zaman: eski.zaman, renk: eski.renk, metin: "", gecici: true };
    islem(() => { const i = S.veri.izler.indexOf(eski); if (i >= 0) S.veri.izler[i] = iz; else S.veri.izler.push(iz); });
  } else {
    iz = { id: yeniId("iz"), zaman: Date.now(), renk: ham.renk, metin: "", ...serbestCapa([ham]), gecici: true };
    islem(() => { S.veri.izler.push(iz); });
  }
  S.izBekleyen = { iz, kalkis: a.kalkis };
  const g = izGoruntu(iz).find((x) => x.id === ham.id);
  if (g) cizgiyiKarolaraEkle(g);
  belgeDegisti();
  izPlanla();
}
// Birleşir: yakın ve ya ikisi de yatay ince çizgi (çift alt çizgi) ya da birlikte küçük bir işaret (ünlem, soru, yıldız)
function izYakin(iz, ham) {
  const { s, lh, em } = S.yer, gs = izGoruntu(iz), a = kutuNoktalar(gs.flatMap((g) => g.p)), b = kutuNoktalar(ham.p), pay = (lh * 1.2) / s;
  if (!(a.x0 - pay < b.x1 && b.x0 - pay < a.x1 && a.y0 - pay < b.y1 && b.y0 - pay < a.y1)) return false;
  const yatay = (k) => (k.x1 - k.x0) * s > 1.2 * em && (k.y1 - k.y0) * s < 0.6 * lh && k.x1 - k.x0 > 3 * (k.y1 - k.y0);
  if (yatay(b) && gs.every((g) => yatay(kutuNoktalar(g.p)))) return true;
  const enBuyuk = Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0), enUzun = Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0);
  return Math.max(enBuyuk, enUzun) * s < 2.6 * lh;
}
function kutuNoktalar(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  return { x0, y0, x1, y1 };
}
// İçerik birimindeki çizgiyi (ham ya da yerleşmiş) çapa birimine (em) çevirir; f içerik pikselini alır
function normalCizgi(c, f) {
  const { s, em } = S.yer;
  return {
    id: String(c.id).split(":")[0], tur: c.tur, renk: c.renk, w: yuvarla(((c.w || 3) * s) / em, 1e4),
    p: c.p.map((q) => { const [x, y] = f(q[0] * s, q[1] * s); return [yuvarla(x), yuvarla(y), yuvarla(q[2] ?? 0.5, 100)]; }),
  };
}
// Serbest (ve geçici) çapa: izin ortası, en yakın paragrafın içinde oranla
function serbestCapa(cizgiler) {
  const { s, em, sol, pUst, pAlt } = S.yer;
  const k = kutuNoktalar(cizgiler.flatMap((c) => c.p));
  const cx = ((k.x0 + k.x1) / 2) * s, cy = ((k.y0 + k.y1) / 2) * s, p = yakinParagraf(cy);
  const ph = Math.max(1, pAlt[p] - pUst[p]), oy = yuvarla((cy - pUst[p]) / ph, 1e5), x = yuvarla((cx - sol) / em);
  const X = sol + x * em, Y = pUst[p] + oy * ph;   // yuvarlanmış çapa: yerleşince aynı yere düşsün
  const o = Math.round(sinirla(oy, 0, 1) * P[p].metin.length);
  return { tur: "serbest", bas: { p, o }, son: { p, o }, capa: { x, oy }, cizgiler: cizgiler.map((c) => normalCizgi(c, (a, b) => [(a - X) / em, (b - Y) / em])) };
}

// ---------- izler: metin ölçümü (içerik pikseli; ölçümler yalnız kalem kalkınca ve düzen değişince) ----------
function pBag(gi, icR) {
  const pEl = S.pEl[gi];
  return { gi, dz: metinDugumleri(pEl), n: P[gi].metin.length, icR, ilk: pEl.classList.contains("ilk") };
}
// Harf kutusu (ekran koordinatı). İlk harf büyük başlangıç harfiyse ikinci harf ölçülür; boş kutuda yandaki harfe bakılır.
function hk(b, i) {
  i = sinirla(i, 0, b.n - 1);
  if (b.ilk && i === 0 && b.n > 1) i = 1;
  for (let k = i; k < Math.min(b.n, i + 4); k++) { const q = harfKutusu(b.dz, k); if (q && q.height) return q; }
  for (let k = i - 1; k >= Math.max(0, i - 4); k--) { const q = harfKutusu(b.dz, k); if (q && q.height) return q; }
  return null;
}
// i. harfin görsel satırı: { a, b, x0, x1, ust, alt } (b hariç; içerik pikseli, harf kutularından)
function satirBilgi(b, i) {
  if (!b.n) return null;
  i = sinirla(i, 0, b.n - 1);
  const r = hk(b, i);
  if (!r) return null;
  let lo = 0, hi = i;
  while (lo < hi) { const m = (lo + hi) >> 1; const q = hk(b, m); if (q && q.bottom > r.top + 1) hi = m; else lo = m + 1; }
  const a = lo;
  lo = i; hi = b.n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; const q = hk(b, m); if (q && q.top < r.bottom - 1) lo = m; else hi = m - 1; }
  const qa = hk(b, a) || r, qb = hk(b, lo) || r;
  return { a, b: lo + 1, x0: qa.left - b.icR.left, x1: qb.right - b.icR.left, ust: r.top - b.icR.top, alt: r.bottom - b.icR.top };
}
// (x, y) içerik noktasının satırı (y satır arasındaysa alttaki satır) ve o satırda x'teki harf
function harfBul(b, x, y) {
  if (!b.n) return null;
  const X = x + b.icR.left, Y = y + b.icR.top;
  let lo = 0, hi = b.n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; const q = hk(b, m); if (q && q.bottom > Y) hi = m; else lo = m + 1; }
  const L = satirBilgi(b, lo);
  if (!L) return null;
  let a = L.a, c = L.b - 1;
  while (a < c) { const m = (a + c) >> 1; const q = hk(b, m); if (q && q.right > X) c = m; else a = m + 1; }
  return { i: a, L };
}
// [a, b) harflerinin görsel satırları. tam: satırın bütün harfleri (alt çizginin oranı), değilse yalnız aralıktakiler.
function satirlar(gi, a, b, tam, icR) {
  const pb = pBag(gi, icR), son = Math.min(b, pb.n), out = [];
  let i = Math.max(0, a);
  while (i < son) {
    const L = satirBilgi(pb, i);
    if (!L || L.b <= i) break;
    if (!tam) {
      const qa = hk(pb, Math.max(L.a, a)), qb = hk(pb, Math.min(L.b, son) - 1);
      if (qa) L.x0 = qa.left - icR.left;
      if (qb) L.x1 = qb.right - icR.left;
    }
    out.push(L);
    i = L.b;
  }
  return out;
}
function aralikKutusu(bas, son, icR) {
  let k = null;
  for (let p = bas.p; p <= son.p; p++) {
    for (const L of satirlar(p, p === bas.p ? bas.o : 0, p === son.p ? son.o : P[p].metin.length, false, icR)) {
      if (!k) k = { x0: L.x0, y0: L.ust, x1: L.x1, y1: L.alt };
      else { k.x0 = Math.min(k.x0, L.x0); k.y0 = Math.min(k.y0, L.ust); k.x1 = Math.max(k.x1, L.x1); k.y1 = Math.max(k.y1, L.alt); }
    }
  }
  return k;
}
function aralikMetni(bas, son) {
  const parca = [];
  for (let p = bas.p; p <= son.p && p < P.length; p++) {
    const m = P[p].metin;
    parca.push(m.slice(p === bas.p ? bas.o : 0, p === son.p ? son.o : m.length));
  }
  const t = parca.join(" ").replace(/\s+/g, " ").trim();
  return t.length > IZ_METIN ? t.slice(0, IZ_METIN - 1).trimEnd() + "…" : t;
}
// y'deki satır; y paragraf dışındaysa (başlık, aralık) yon > 0 ile sonraki, yon < 0 ile önceki paragrafın kenar satırı
function satirBul(y, yon, icR) {
  const { pUst, pAlt, sol } = S.yer;
  let gi = konumAl(y).p;
  if (y < pUst[gi]) {
    if (yon < 0) gi--;
    if (gi < 0) return null;
    y = yon > 0 ? pUst[gi] + 1 : pAlt[gi] - 1;
  }
  if (y >= pAlt[gi]) y = pAlt[gi] - 1;
  const h = harfBul(pBag(gi, icR), sol + 2, y);
  return h ? { p: gi, L: h.L } : null;
}
const bosMu = (ch) => !ch || /\s/.test(ch);

// ---------- izler: yerleşim (çapadan içerik birimine) ----------
// Yerleşmiş izler düzen ölçüsüyle (S.yer) önbellekte: düzen değişmedikçe yeniden ölçülmez
function izGoruntu(iz) {
  const on = S.izG.get(iz);
  if (on && on.yer === S.yer) return on.g;
  let g = [];
  try { g = izYerlestir(iz); } catch { g = []; }
  S.izG.set(iz, { yer: S.yer, g });
  return g;
}
function izYerlestir(iz) {
  if (!izGecerli(iz)) return [];
  const { s, em, sol } = S.yer, sag = sol + s * BIRIM, c = iz.capa || {}, icR = S.el.ic.getBoundingClientRect();
  const kx = c.yan === "sag" ? sag : sol;
  let f = null, altSatir = null;
  switch (iz.gecici ? "serbest" : iz.tur) {
    case "alt": {
      altSatir = satirlar(iz.bas.p, iz.bas.o, iz.son.o, true, icR);
      if (!altSatir.length || !(c.harf > 0)) return [];
      break;
    }
    case "daire": {
      const k = aralikKutusu(iz.bas, iz.son, icR);
      if (!k) return [];
      const cx = (k.x0 + k.x1) / 2, cy = (k.y0 + k.y1) / 2;
      // Kutu değişince en-boy korunarak büyür ya da küçülür: daire kelimenin yeni kutusunu yine sarar
      const o = sinirla(Math.max((k.x1 - k.x0) / Math.max(1e-3, (c.w || 1) * em), (k.y1 - k.y0) / Math.max(1e-3, (c.h || 1) * em)) || 1, 0.4, 6);
      f = (q) => [cx + q[0] * em * o, cy + q[1] * em * o];
      break;
    }
    case "kenar": {
      const u = satirBilgi(pBag(iz.bas.p, icR), iz.bas.o), a = satirBilgi(pBag(iz.son.p, icR), iz.son.o - 1);
      if (!u || !a) return [];
      const H = Math.max(1, a.alt - u.ust), h0 = Math.max(1e-3, c.h || 1);
      f = (q) => [kx + q[0] * em, u.ust + (q[1] / h0) * H];
      break;
    }
    case "isaret": {
      const L = satirBilgi(pBag(iz.bas.p, icR), iz.bas.o);
      if (!L) return [];
      const cx = kx + (c.dx || 0) * em, cy = (L.ust + L.alt) / 2 + (c.dy || 0) * em;
      f = (q) => [cx + q[0] * em, cy + q[1] * em];
      break;
    }
    default: {
      const { pUst, pAlt } = S.yer, p = iz.bas.p;
      const cx = sol + (c.x || 0) * em, cy = pUst[p] + (c.oy || 0) * Math.max(1, pAlt[p] - pUst[p]);
      f = (q) => [cx + q[0] * em, cy + q[1] * em];
    }
  }
  const cikti = [];
  for (const cz of iz.cizgiler) {
    if (!cz || !Array.isArray(cz.p) || !cz.p.length) continue;
    const w = ((cz.w > 0 ? cz.w : 0.15) * em) / s;
    const parcalar = altSatir ? altParcala(cz.p, altSatir, iz.bas.o, c.harf, em) : [cz.p.map((q) => { const xy = f(q); return [xy[0], xy[1], q[2]]; })];
    parcalar.forEach((pp, j) => { if (pp.length) cikti.push(goruntuYap(j ? `${cz.id}:${j}` : cz.id, iz.id, cz, pp.map((q) => [q[0] / s, q[1] / s, q[2]]), w)); });
  }
  return cikti;
}
// Alt çizgi: her nokta karakter konumuyla kendi satırına düşer; satır kırılınca çizgi parçalara bölünür
function altParcala(p, L, bas, harf, em) {
  const parca = [];
  let son = -1, cur = null;
  for (const q of p) {
    const ch = bas + q[0] / harf;
    let i = L.findIndex((l) => ch < l.b);
    if (i < 0) i = L.length - 1;
    const l = L[i], n = Math.max(1e-3, l.b - l.a);
    if (i !== son) { cur = []; parca.push(cur); son = i; }
    cur.push([l.x0 + ((ch - l.a) / n) * (l.x1 - l.x0), l.alt + q[1] * em, q[2]]);
  }
  return parca;
}
function goruntuYap(id, iz, cz, p, w) {
  const s = S.yer.s, k = kutuNoktalar(p), pay = w + 2;
  return { id, iz, tur: cz.tur, renk: cz.renk, w, p, kutu: { x0: (k.x0 - pay) * s, y0: (k.y0 - pay) * s, x1: (k.x1 + pay) * s, y1: (k.y1 + pay) * s } };
}
// [y0, y1] içerik pikseline yakın izlerin yerleşmiş çizgileri
function izlerAraliginda(y0, y1) {
  const { pUst, pAlt, em } = S.yer, pay = 12 * em, out = [];
  for (const z of S.veri.izler) {
    if (!izGecerli(z) || pAlt[z.son.p] + pay < y0 || pUst[z.bas.p] - pay > y1) continue;
    for (const g of izGoruntu(z)) if (g.kutu.y1 >= y0 && g.kutu.y0 <= y1) out.push(g);
  }
  return out;
}

// ---------- izler: sınıflama (kalem kalktıktan sonra, boşta) ----------
function izPlanla() {
  if (!S) return;
  clearTimeout(S.izZ);
  S.izZ = zamanla(() => {
    if (!S) return;
    if (S.aktif) { izPlanla(); return; }
    const bosta = globalThis.requestIdleCallback || ((f) => setTimeout(f, 0));
    bosta(() => { if (!S) return; if (S.aktif) izPlanla(); else izleriSiniflandir(); }, { timeout: 500 });
  }, IZ_BIRLESME);
}
function izleriSiniflandir() {
  if (!S?.yer) return;
  clearTimeout(S.izZ);
  S.izBekleyen = null;
  for (const z of S.veri.izler) if (z.gecici) izSiniflandir(z);
}
// Sözleşme 1: yataya yakın ve satırın altında alt; kapalı halka daire; sütun dışında dikey kenar;
// kenarda küçük işaret (yıldız, ünlem, soru, onay) isaret; gerisi serbest. Sonra metne bağlanır.
function izSiniflandir(z) {
  const gs = izGecerli(z) ? izGoruntu(z) : [];
  if (!gs.length) { delete z.gecici; return; }
  const { s, em, lh, sol } = S.yer, sag = sol + s * BIRIM, icR = S.el.ic.getBoundingClientRect();
  const cz = gs.map((g) => g.p.map((q) => [q[0] * s, q[1] * s]));
  const k = kutuNoktalar(cz.flat());
  const W = k.x1 - k.x0, H = k.y1 - k.y0, cx = (k.x0 + k.x1) / 2;
  const disarda = k.x1 < sol - 0.3 * em || k.x0 > sag + 0.3 * em;
  const dikey = H > 1.4 * lh && H > 2.5 * W;
  const yatay = cz.every((p) => { const q = kutuNoktalar(p), w = q.x1 - q.x0, h = q.y1 - q.y0; return w > 1.2 * em && h < 0.6 * lh && w > 3 * h; });
  let tur = "serbest";
  if (disarda) tur = dikey ? "kenar" : Math.max(W, H) < 2.6 * lh ? "isaret" : "serbest";
  else if (cz.length === 1 && kapali(cz[0], W, H, em, lh)) tur = "daire";
  else if (yatay) tur = "alt";
  else if (dikey && Math.min(Math.abs(cx - sol), Math.abs(cx - sag)) < 1.5 * em) tur = "kenar";
  let sonuc = null;
  try {
    if (tur === "alt") sonuc = altCapa(gs, cz, k, icR);
    else if (tur === "daire") sonuc = daireCapa(gs, cz[0], k, icR);
    else if (tur === "kenar") sonuc = kenarCapa(gs, k, icR);
    else if (tur === "isaret") sonuc = isaretCapa(gs, k, icR);
  } catch { sonuc = null; }
  if (!sonuc) { tur = "serbest"; sonuc = { ...serbestCapa(gs), metin: disarda ? "" : altindakiMetin(k, icR) }; }
  Object.assign(z, sonuc, { tur });
  delete z.gecici;
  if (P[z.bas.p]) z.bolum = BOLUMLER[P[z.bas.p].b].baslik;
  S.izG.delete(z);
  belgeDegisti();
  S.koltuk?.izleriYenile?.();
}
// Kapalı halka: yol çevresinden uzun, ucu başına yakın ve içi dolu (zikzak değil)
function kapali(p, W, H, em, lh) {
  if (p.length < 8 || H < 0.5 * lh || W < 0.8 * em) return false;
  let L = 0, A = 0;
  for (let i = 1; i < p.length; i++) {
    L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    A += p[i - 1][0] * p[i][1] - p[i][0] * p[i - 1][1];
  }
  const D = Math.max(W, H), son = p[p.length - 1], d = Math.hypot(p[0][0] - son[0], p[0][1] - son[1]);
  return L > 2.2 * D && d < Math.max(0.35 * D, 0.8 * em) && Math.abs(A / 2) > 0.3 * W * H;
}
function altCapa(gs, cz, k, icR) {
  const { em, pUst, pAlt } = S.yer;
  const tum = cz.flat(), ym = tum.reduce((t, q) => t + q[1], 0) / tum.length;
  const y = ym - 0.4 * em, gi = konumAl(y).p;   // çizginin hemen üstündeki satır
  if (y < pUst[gi] || y >= pAlt[gi]) return null;
  const pb = pBag(gi, icR), h0 = harfBul(pb, k.x0 + 1, y), h1 = harfBul(pb, k.x1 - 1, y);
  if (!h0 || !h1) return null;
  const m = P[gi].metin, L0 = h0.L;
  let a = h0.i, b = (h1.L.a === L0.a ? h1.i : L0.b - 1) + 1;
  while (a < b && bosMu(m[a])) a++;
  while (b > a && bosMu(m[b - 1])) b--;
  if (b <= a) return null;
  while (a > L0.a && HARF.test(m[a - 1]) && HARF.test(m[a])) a--;   // yarım çizilen kelime bütün sayılır
  while (b < L0.b && HARF.test(m[b]) && HARF.test(m[b - 1])) b++;
  const L = satirBilgi(pb, a);   // yerleşimin kullandığı satır: aynı ölçü, aynı yer
  if (!L || ym - L.alt > 1.1 * em || L.ust - ym > 0.2 * em) return null;
  const gen = Math.max(1e-3, L.x1 - L.x0), n = Math.max(1, L.b - L.a);
  const harf = yuvarla(gen / n / em, 1e5), kar = (x) => L.a + ((x - L.x0) / gen) * n;
  return {
    bas: { p: gi, o: a }, son: { p: gi, o: b }, capa: { harf }, metin: aralikMetni({ p: gi, o: a }, { p: gi, o: b }),
    cizgiler: gs.map((g) => normalCizgi(g, (x, yy) => [(kar(x) - a) * harf, (yy - L.alt) / em])),
  };
}
function daireCapa(gs, poly, k, icR) {
  const { em, lh, pUst, pAlt } = S.yer;
  const icinde = (x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  let ilk = null, son = null;
  const bakildi = new Set();
  for (let y = k.y0 + 2; y <= k.y1 - 2; y += lh / 3) {
    const gi = konumAl(y).p;
    if (y < pUst[gi] || y >= pAlt[gi]) continue;
    const pb = pBag(gi, icR), h = harfBul(pb, k.x0, y);
    if (!h || bakildi.has(gi + ":" + h.L.a)) continue;
    bakildi.add(gi + ":" + h.L.a);
    for (let i = h.i; i < h.L.b; i++) {
      const q = hk(pb, i);
      if (!q) continue;
      const qx = (q.left + q.right) / 2 - icR.left, qy = (q.top + q.bottom) / 2 - icR.top;
      if (qx > k.x1) break;
      // harfin iki yanı da halkanın içinde: kelimenin yanındaki komşu harf sayılmaz
      if (bosMu(P[gi].metin[i]) || !icinde(q.left - icR.left + 1, qy) || !icinde(q.right - icR.left - 1, qy)) continue;
      const yer = { p: gi, o: i };
      if (!ilk || kars(yer, ilk) < 0) ilk = yer;
      if (!son || kars(yer, son) > 0) son = yer;
    }
  }
  if (!ilk) return null;
  const mA = P[ilk.p].metin, mB = P[son.p].metin;
  let a = ilk.o, b = son.o + 1;
  while (a > 0 && HARF.test(mA[a - 1]) && HARF.test(mA[a])) a--;
  while (b < mB.length && HARF.test(mB[b]) && HARF.test(mB[b - 1])) b++;
  const bas = { p: ilk.p, o: a }, sonY = { p: son.p, o: b }, kutu = aralikKutusu(bas, sonY, icR);
  if (!kutu) return null;
  const cx = (kutu.x0 + kutu.x1) / 2, cy = (kutu.y0 + kutu.y1) / 2;
  return {
    bas, son: sonY, capa: { w: yuvarla((kutu.x1 - kutu.x0) / em, 1e4), h: yuvarla((kutu.y1 - kutu.y0) / em, 1e4) },
    metin: aralikMetni(bas, sonY), cizgiler: gs.map((g) => normalCizgi(g, (x, y) => [(x - cx) / em, (y - cy) / em])),
  };
}
function kenarCapa(gs, k, icR) {
  const { em, lh, sol, s } = S.yer, sag = sol + s * BIRIM, cx = (k.x0 + k.x1) / 2;
  const yan = Math.abs(cx - sol) <= Math.abs(cx - sag) ? "sol" : "sag", kx = yan === "sol" ? sol : sag;
  const ust = satirBul(k.y0 + 0.25 * lh, 1, icR), alt = satirBul(k.y1 - 0.25 * lh, -1, icR);
  if (!ust || !alt) return null;
  const bas = { p: ust.p, o: ust.L.a }, son = { p: alt.p, o: alt.L.b };
  if (kars(bas, son) >= 0) return null;
  const u = satirBilgi(pBag(bas.p, icR), bas.o), a = satirBilgi(pBag(son.p, icR), son.o - 1);
  if (!u || !a) return null;
  const H = Math.max(1, a.alt - u.ust), h = yuvarla(H / em, 1e4);
  return {
    bas, son, capa: { yan, h }, metin: aralikMetni(bas, son),
    cizgiler: gs.map((g) => normalCizgi(g, (x, y) => [(x - kx) / em, ((y - u.ust) / H) * h])),
  };
}
function isaretCapa(gs, k, icR) {
  const { em, sol, s, pUst, pAlt } = S.yer, sag = sol + s * BIRIM;
  const cx = (k.x0 + k.x1) / 2, cy = (k.y0 + k.y1) / 2;
  const yan = cx < (sol + sag) / 2 ? "sol" : "sag", kx = yan === "sol" ? sol : sag;
  const gi = yakinParagraf(cy), pb = pBag(gi, icR);
  const h = harfBul(pb, sol + 2, sinirla(cy, pUst[gi] + 1, pAlt[gi] - 1));
  if (!h) return null;
  const m = P[gi].metin;
  let a = h.L.a, b = h.L.b;
  while (a < b && bosMu(m[a])) a++;
  while (b > a && bosMu(m[b - 1])) b--;
  if (b <= a) return null;
  const L = satirBilgi(pb, a);
  if (!L) return null;
  const dx = yuvarla((cx - kx) / em), dy = yuvarla((cy - (L.ust + L.alt) / 2) / em);
  const X = kx + dx * em, Y = (L.ust + L.alt) / 2 + dy * em;
  const cumle = baglamCumle({ bas: { p: gi, o: a }, son: { p: gi, o: b } });
  return {
    bas: { p: gi, o: a }, son: { p: gi, o: b }, capa: { yan, dx, dy },
    metin: cumle.length > IZ_METIN ? cumle.slice(0, IZ_METIN - 1) + "…" : cumle,
    cizgiler: gs.map((g) => normalCizgi(g, (x, y) => [(x - X) / em, (y - Y) / em])),
  };
}
// Serbest izin altındaki metin: kutunun sol üstünden sağ altına
function altindakiMetin(k, icR) {
  const { lh } = S.yer;
  const u = satirBul(k.y0 + 0.3 * lh, 1, icR), a = satirBul(k.y1 - 0.3 * lh, -1, icR);
  if (!u || !a) return "";
  const hu = harfBul(pBag(u.p, icR), k.x0, (u.L.ust + u.L.alt) / 2), ha = harfBul(pBag(a.p, icR), k.x1, (a.L.ust + a.L.alt) / 2);
  if (!hu || !ha) return "";
  const bas = { p: u.p, o: hu.i }, son = { p: a.p, o: ha.i + 1 };
  return kars(bas, son) < 0 ? aralikMetni(bas, son) : "";
}

// ---------- izler: silgi, gidiş, parlama, atlama ----------
// Silgi dokunduğu izi bütün olarak siler (geri alınır)
function izSilgi(x, y, r, a) {
  if (!S.veri.izler.length) return;
  const s = S.yer.s, aday = izlerAraliginda((y - r) * s - 40, (y + r) * s + 40);
  if (!aday.length) return;
  const vurulan = silgiUygula(aday.slice(), x, y, r, { onceki: a.izOnceki });
  a.izOnceki = [x, y];
  if (!vurulan.length) return;
  const idler = new Set(vurulan.map((g) => g.iz));
  const giden = S.veri.izler.filter((z) => idler.has(z.id));
  const kutular = giden.flatMap((z) => izGoruntu(z).map((g) => g.kutu));
  S.veri.izler = S.veri.izler.filter((z) => !idler.has(z.id));
  if (S.izBekleyen && idler.has(S.izBekleyen.iz.id)) S.izBekleyen = null;
  a.izSilindi = true;
  karolariYenile(kutular);
}
const izKonumu = (z) => ({ p: z.bas.p, oran: P[z.bas.p] ? sinirla(z.bas.o / Math.max(1, P[z.bas.p].metin.length), 0, 1) : 0 });
// İzler panelinin verdiği konum bir izin başına denk geliyorsa o iz
function izKonumda(k) {
  if (!S || !k || !Number.isInteger(k.p) || !P[k.p]) return null;
  const n = Math.max(1, P[k.p].metin.length);
  return S.veri.izler.find((z) => izGecerli(z) && z.bas.p === k.p && Math.abs(z.bas.o / n - (Number(k.oran) || 0)) < 1e-3) || null;
}
function izKutusu(z) {
  const g = izGoruntu(z);
  if (!g.length) return null;
  return { x0: Math.min(...g.map((c) => c.kutu.x0)), y0: Math.min(...g.map((c) => c.kutu.y0)), x1: Math.max(...g.map((c) => c.kutu.x1)), y1: Math.max(...g.map((c) => c.kutu.y1)) };
}
function izeGit(z) {
  darsaKapat();
  menuKapat();
  const k = izKutusu(z);
  if (!k) { konumaGit(izKonumu(z)); durumGuncelle(); return; }
  kaydirGit(k.y0 - S.el.kaydir.clientHeight * 0.35, () => izParlat(z));
}
// Seçili iz: kendi küçük tuvalinde bir kez yumuşak hale (TASARIM-3 §7.8); bütün katman değil
function izParlat(z) {
  if (!S?.yer) return;
  const k = izKutusu(z);
  if (!k) return;
  const s = S.yer.s, d = Math.min(globalThis.devicePixelRatio || 1, 2), W = k.x1 - k.x0, H = k.y1 - k.y0;
  const cv = h("canvas", { class: "iz-hedef", "aria-hidden": "true" });
  cv.width = Math.max(1, Math.ceil(W * d)); cv.height = Math.max(1, Math.ceil(H * d));
  cv.style.cssText = `left:${k.x0}px;top:${k.y0}px;width:${W}px;height:${H}px`;
  const ctx = cv.getContext("2d");
  ctx.setTransform(d * s, 0, 0, d * s, -k.x0 * d, -k.y0 * d);
  for (const c of izGoruntu(z)) cizgiCiz(ctx, c, { koyuSayfa: KOYU_SAYFA.has(S.sayfa) });
  S.el.ic.append(cv);
  zamanla(() => cv.remove(), hareketAz() ? 400 : 950);
}
// Önceki ve sonraki iz ([ ve ], cetvelin okları): ekranın dışındaki ilk iz
function izAtla(yon) {
  if (!S?.yer) return;
  const { pUst, pAlt } = S.yer, kay = S.el.kaydir;
  const ust = kay.scrollTop + (S.mod === "koltuk" ? KOLTUK_UST : ustPay()), alt = kay.scrollTop + kay.clientHeight - (S.mod === "koltuk" ? KOLTUK_ALT : 0);
  const y = (z) => pUst[z.bas.p] + izKonumu(z).oran * (pAlt[z.bas.p] - pUst[z.bas.p]);
  const l = S.veri.izler.filter(izGecerli).map((z) => [y(z), z]).sort((a, b) => a[0] - b[0]);
  const hedef = yon > 0 ? l.find(([v]) => v > alt) : l.reverse().find(([v]) => v < ust);
  if (hedef) izeGit(hedef[1]);
  else toast(l.length ? (yon > 0 ? "Sonrasında iz yok" : "Öncesinde iz yok") : "Bu kitapta henüz kalem izi yok");
}
// Cetvel çentikleri: izlerin kitaptaki oranı
function izOranlari() {
  if (!S) return [];
  return S.veri.izler.filter(izGecerli).map((z) => ({ id: z.id, oran: sinirla(okunanKelime(izKonumu(z)) / TOPLAM, 0, 1) }));
}

// ---------- havadaki kalem (TASARIM-3 §8) ----------
function kalemHavada(e) {
  if (e.pointerType !== "pen" || !S?.yer) return;
  S.sonKalemZ = performance.now();   // avuç içi: havadaki kalem de sayılır (S Pen 3)
  if (S.mod === "koltuk") kalemYakin();
  if ((e.buttons & 1) || S.aktif || S.kose) { havaBitti(); return; }
  halkaGuncelle(e);
  if (S.mod !== "koltuk") return;
  satirIsikGuncelle(e);
  const R = S.okumaR || (S.okumaR = S.el.okuma.getBoundingClientRect());
  S.kap.classList.toggle("kalem-kosede", R.right - e.clientX < 56 && e.clientY - R.top < 56 && !S.kap.classList.contains("cubuk-gorunur"));
}
function havaBitti() {
  if (!S) return;
  S.halka?.classList.remove("gorunur");
  S.el.satirIsik.classList.remove("acik");
  S.kap.classList.remove("kalem-kosede");
}
// Tek halka belgede bir kez: başka ekran eklediyse o kullanılır
function halkaAl() {
  let el = document.querySelector(".kalem-halka");
  if (!el) { el = h("div", { class: "kalem-halka", "aria-hidden": "true" }); document.body.append(el); S.halkaBizim = el; }
  return el;
}
function halkaGuncelle(e) {
  const yanTus = silgiTusu(e), s = S.yer.s;
  let arac = "kalem", cap = 8, renk = null;
  if (S.mod === "masa" && (yanTus || S.arac === "silgi" || S.arac === "okuma" || S.arac === "kirp")) { S.halka?.classList.remove("gorunur"); return; }   // Masa'da silgi kendi imleciyle
  if (yanTus) { arac = "silgi"; cap = tercih.silgi.r * 2 * s; }
  else if (S.mod === "masa" && S.arac === "fosforlu") { const k = kalemAyari("fosforlu"); arac = "fosforlu"; cap = k.w * s; renk = k.renk; }
  else { const k = S.mod === "masa" ? kalemAyari(S.arac) : izKalemi(); cap = genislik(k.tur, k.mm * 5, 0.5) * s; renk = k.renk; }
  const el = S.halka || (S.halka = halkaAl());
  const koyu = KOYU_SAYFA.has(S.sayfa), r = renk && koyu ? ortak.KOYU_SAYFA_ESLEME?.[renk.toUpperCase()] || renk : renk;
  const anahtar = `${arac}|${Math.round(cap)}|${r}`;
  if (anahtar !== S.halkaAnahtar) {
    S.halkaAnahtar = anahtar;
    el.dataset.arac = arac;
    el.style.setProperty("--c", Math.max(6, cap).toFixed(1) + "px");
    if (r) el.style.setProperty("--halka", r); else el.style.removeProperty("--halka");
  }
  S.halkaXY = [e.clientX, e.clientY];
  el.classList.add("gorunur");
  if (!S.halkaRaf) {
    S.halkaRaf = requestAnimationFrame(() => {
      if (!S) return;
      S.halkaRaf = 0;
      el.style.transform = `translate3d(${S.halkaXY[0]}px,${S.halkaXY[1]}px,0)`;
    });
  }
}
// Kalemin altındaki satırın arkası çok hafif belirir (kurşun kalemi kâğıda yaklaştırmak gibi); en çok 30 Hz
function satirIsikGuncelle(e) {
  const t = performance.now();
  if (t - (S.isikT || 0) < 33) return;
  S.isikT = t;
  const el = S.el.satirIsik, R = S.okumaR || (S.okumaR = S.el.okuma.getBoundingClientRect());
  const x = e.clientX - R.left, y = e.clientY - R.top + S.el.kaydir.scrollTop;
  const { sol, s, lh } = S.yer, sag = sol + s * BIRIM;
  const r = x > sol - lh && x < sag + lh ? satirAl(y) : null;
  if (!r || r.blok || r.alt - r.ust < lh * 0.5) { el.classList.remove("acik"); return; }
  const anahtar = r.ust.toFixed(1);
  if (anahtar !== S.isikAnahtar) {
    S.isikAnahtar = anahtar;
    el.style.cssText = `transform:translate(${(sol - 6).toFixed(1)}px,${r.ust.toFixed(1)}px);width:${(sag - sol + 12).toFixed(1)}px;height:${(r.alt - r.ust).toFixed(1)}px`;
  }
  el.classList.add("acik");
}

// ---------- köşe kıvırma (TASARIM-3 §12) ----------
// Sağ üst köşeyi çapraz aşağı çekmek köşeyi kıvırır ve yer imi koyar; kıvrık köşeyi çekmek ya da ona dokunmak düzeltir.
// Düz köşeye dokunuş sağ kenar gibi ileri çevirir.
function koseBasti(e) {
  if (S.mod !== "koltuk" || S.aktif || (e.pointerType === "mouse" && e.button !== 0)) return;
  if (e.pointerType === "touch" && performance.now() - S.sonKalemZ < KALEM_AVUC) return;
  e.preventDefault();
  e.stopPropagation();
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
  havaBitti();
  S.kose = { id: e.pointerId, R: S.el.okuma.getBoundingClientRect(), x: e.clientX, y: e.clientY, k: 0, kivrikti: S.el.kose.classList.contains("kivrik") };
  S.el.kose.classList.add("surukleniyor");
}
function koseOynadi(e) {
  const k = S?.kose;
  if (!k || e.pointerId !== k.id) return;
  k.k = sinirla((k.R.right - e.clientX + (e.clientY - k.R.top)) / 2, 0, 120);   // köşeye çapraz uzaklık
  k.oynadi ||= Math.hypot(e.clientX - k.x, e.clientY - k.y) > 8;
  if (k.oynadi) S.el.kose.style.setProperty("--k", k.k.toFixed(1) + "px");
}
function koseKalkti(e) {
  const k = S?.kose;
  if (!k || e.pointerId !== k.id) return;
  S.kose = null;
  const el = S.el.kose;
  el.classList.remove("surukleniyor");
  el.style.removeProperty("--k");
  if (e.type === "pointerup") {
    if (k.oynadi ? k.k >= 28 : k.kivrikti) yerImiDegistir();   // kıvır ya da düzelt
    else if (!k.oynadi) koltukCevir(1);
  }
  yerImiDurumu();
}

// Koltuk: iki parmakla dokunuş geri alır, üç parmakla yineler (Masa'daki gibi)
function cokParmakBasti(e) {
  if (!S.cp || !S.cp.ids.size) S.cp = { ids: new Map(), t0: performance.now(), enCok: 0, yol: 0, iptal: false };
  S.cp.ids.set(e.pointerId, [e.clientX, e.clientY]);
  S.cp.enCok = Math.max(S.cp.enCok, S.cp.ids.size);
}
function cokParmakOynadi(e) {
  const g = S.cp, o = g.ids.get(e.pointerId);
  g.yol += Math.hypot(e.clientX - o[0], e.clientY - o[1]);
  g.ids.set(e.pointerId, [e.clientX, e.clientY]);
}
function cokParmakKalkti(e) {
  const g = S.cp;
  g.ids.delete(e.pointerId);
  if (e.type === "pointercancel") g.iptal = true;
  if (g.ids.size) return;
  S.cp = null;
  if (g.iptal || g.enCok < 2 || g.yol > 16 || performance.now() - g.t0 > 350) return;
  if (g.enCok === 2) geriAl(); else yinele();
}

// ---------- Koltuk nüansları (TASARIM-3 §13) ----------
// 1: kaldığın yerde duran kurdele. Açılışta sayfanın üst kenarından sarkar, bir kez sallanır; sayfa çevrilince yerinde
// kalır (içerikle kayar). Dokununca oraya döner.
function kurdeleKur() {
  const k = S.acilisKonum;
  if (!k || !S.yer) return;
  const { sol, s, icGen } = S.yer, r = satirAl(konumY(k) + ustPay());
  let el = S.el.kurdele;
  if (!el) {
    el = S.el.kurdele = h("button", { type: "button", class: "kurdele" + (hareketAz() ? "" : " sallan"), "aria-label": "Buraya dön", title: "Buraya dön", "data-dokunma-yok": "" });
    el.addEventListener("click", () => { if (!S?.acilisKonum) return; konumaGit(S.acilisKonum); S.olcum = null; durumGuncelle(); });
    S.el.ic.append(el);
  }
  el.style.left = Math.min(sol + s * BIRIM + 20, icGen - 24).toFixed(1) + "px";
  el.style.top = (r.ust - 14).toFixed(1) + "px";
}
// 4: uzun aradan dönünce son okunan satırın altında kurşun kalem çizgisi bir an belirir ("buradaydın")
function sonSatirBelir() {
  if (!S?.yer || S.mod !== "koltuk") return;
  const r = satirAl(S.el.kaydir.scrollTop + koltukSinir().ust + 2);
  if (r.blok || r.alt <= r.ust) return;
  const { sol, s } = S.yer;
  const el = h("div", { class: "satir-isik son-satir", "aria-hidden": "true",
    style: `transform:translate(${(sol - 4).toFixed(1)}px,${r.ust.toFixed(1)}px);width:${(s * BIRIM + 8).toFixed(1)}px;height:${(r.alt - r.ust).toFixed(1)}px` });
  S.el.ic.prepend(el);
  zamanla(() => el.remove(), 1500);
}
// 2: sayfa kenarı kalınlığında ilerleme: okunan sayfalar solda, kalanlar sağda ince kâğıt çizgileri (0..6)
function kalinlikGuncelle(oran) {
  const sol = Math.round(sinirla(oran, 0, 1) * 6), d = sol + "-" + (6 - sol);
  if (S.kalinlik === d) return;
  S.kalinlik = d;
  S.el.sayfaKenari.dataset.sol = String(sol);
  S.el.sayfaKenari.dataset.sag = String(6 - sol);
}

// ---------- kırpma (3.20, 6.4) ----------
function secimdenKirp({ bas, son }) {
  const r = document.createRange();
  const bul = (k) => {   // paragraf ofsetini metin düğümüne çevir
    const w = document.createTreeWalker(S.pEl[k.p], NodeFilter.SHOW_TEXT);
    let kalan = k.o, d;
    while ((d = w.nextNode())) { if (kalan <= d.length) return [d, kalan]; kalan -= d.length; }
    return [S.pEl[k.p], S.pEl[k.p].childNodes.length];
  };
  r.setStart(...bul(bas));
  r.setEnd(...bul(son));
  const icR = S.el.ic.getBoundingClientRect(), sR = S.el.sutun.getBoundingClientRect();
  const qs = [...r.getClientRects()].filter((q) => q.width > 0);
  if (!qs.length) return;
  const y0 = Math.min(...qs.map((q) => q.top)) - icR.top - 10, y1 = Math.max(...qs.map((q) => q.bottom)) - icR.top + 10;
  kirpYap({ x: sR.left - icR.left - 16, y: y0, w: sR.width + 32, h: y1 - y0 }, bas.p);
}

// ap: bağlanacak paragraf; verilmezse alanın üst kısmındaki paragraf (düzen değişince kırpıntı onunla kayar)
function kirpYap(r, ap = yakinParagraf(r.y + Math.min(r.h / 2, 24))) {
  const gorsel = bolgeGorsel(r);
  const { s, sol, pUst } = S.yer;
  const k = kirpintiEkle({ gorsel, belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: Math.floor(P[ap].onceki / SAYFADA) + 1, not: "" });
  k.okuma = { ap, x: (r.x - sol) / s, y: (r.y - pUst[ap]) / s, w: r.w / s, h: r.h / s };
  // Flaş, baskının uçuşu, hedefin karşılaması, bildirim
  const icR = S.el.ic.getBoundingClientRect(), oR = S.el.okuma.getBoundingClientRect();
  const ekran = { left: icR.left + r.x, top: icR.top + r.y, width: r.w, height: r.h };
  if (!hareketAz()) {
    const flas = h("div", { class: "kirp-flas", style: `inset:auto;left:${ekran.left - oR.left}px;top:${ekran.top - oR.top}px;width:${r.w}px;height:${r.h}px` });
    S.el.okuma.append(flas);
    zamanla(() => flas.remove(), 340);
    zamanla(() => kirpUcur(gorsel, ekran), 190);
  }
  toast("Kırpılanlar'a kaydedildi", { etiket: "Göster", calistir: () => S && panelAc("sag", "kirpintilar", { zorla: true }) });
  if (S.panel === "sag" && S.sekme === "kirpintilar") panelYenile();
}
function kirpUcur(gorsel, ekran) {
  const hedef = (S.panel === "sag" && S.el.sagPanel.querySelector('[data-sekme="kirpintilar"]')) || S.el.notlar;
  const hR = hedef.getBoundingClientRect();
  const olcek = Math.min(1, 360 / Math.max(ekran.width, ekran.height));
  const w = ekran.width * olcek, hg = ekran.height * olcek;
  const x = ekran.left + (ekran.width - w) / 2, y = ekran.top + (ekran.height - hg) / 2;
  const ucan = h("div", { class: "kirp-ucan", style: `left:${x - 6}px;top:${y - 6}px;width:${w + 12}px;height:${hg + 12}px;--dx:${hR.left + hR.width / 2 - (x + w / 2)}px;--dy:${hR.top + hR.height / 2 - (y + hg / 2)}px` }, h("img", { src: gorsel, alt: "" }));
  document.body.append(ucan);
  setTimeout(() => {
    ucan.remove();
    hedef.classList.add("karsila");
    setTimeout(() => hedef.classList.remove("karsila"), 220);
  }, 430);
}

// Bölgenin görseli: metin, vurgular, süsler ve mürekkep tuvale yeniden dizilir (DOM ekran görüntüsü yok).
// r: .okuma-ic içinde piksel dikdörtgen. Birim başına 2 piksel.
function bolgeGorsel(r) {
  const O = 2, W = Math.max(1, Math.round(r.w * O)), H = Math.max(1, Math.round(r.h * O));
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const koyu = KOYU_SAYFA.has(S.sayfa);
  g.fillStyle = getComputedStyle(S.el.okuma).backgroundColor;
  g.fillRect(0, 0, W, H);
  const icR = S.el.ic.getBoundingClientRect();
  const E = { x: icR.left + r.x, y: icR.top + r.y, w: r.w, h: r.h };
  const kesisir = (q) => q.width > 0 && q.right > E.x && q.left < E.x + E.w && q.bottom > E.y && q.top < E.y + E.h;
  g.setTransform(O, 0, 0, O, -E.x * O, -E.y * O);

  // 1) vurgu ve eşleşme zeminleri
  const oran = koyu ? 0.3 : 0.48;   // okuma.css --vurgu-oran
  for (const m of S.el.sutun.querySelectorAll("mark")) {
    const renk = m.classList.contains("vurgu") ? rgba(vurguRengi(vurguBul(m.dataset.v)?.renk), oran) : "rgba(244,214,62,.5)";
    g.fillStyle = renk;
    for (const q of m.getClientRects()) {
      if (!kesisir(q)) continue;
      g.beginPath();
      g.roundRect(q.left - 2, q.top + q.height * 0.12, q.width + 4, q.height * 0.8, q.height * 0.25);
      g.fill();
    }
  }
  // 2) süsler: hedera ve sahne ayracı
  for (const svg of S.el.sutun.querySelectorAll("svg.fleuron, svg.sahne")) {
    const q = svg.getBoundingClientRect();
    if (!kesisir(q)) continue;
    const st = getComputedStyle(svg), hedera = svg.classList.contains("fleuron");
    g.save();
    g.translate(q.left, q.top);
    g.scale(q.width / (hedera ? 28 : 40), q.height / (hedera ? 16 : 12));
    g.fillStyle = st.fill;
    g.fill(new Path2D(hedera ? HEDERA[0] : SAHNE_YOLU));
    if (hedera) { g.strokeStyle = st.color; g.lineWidth = 1.2; g.lineCap = "round"; g.stroke(new Path2D(HEDERA[1])); }
    g.restore();
  }
  // 3) kenar notu çizgileri
  for (const n of S.el.kenarNotlari.children) {
    const q = n.getBoundingClientRect();
    if (kesisir(q)) { g.fillStyle = getComputedStyle(n).borderLeftColor; g.fillRect(q.left, q.top, 1.5, q.height); }
  }
  // 4) yazılar
  yazilariCiz(g, kesisir);
  // 5) mürekkep: ekrandaki gibi sayfayla çarpılarak
  const s = S.yer.s;
  g.setTransform(O * s, 0, 0, O * s, -r.x * O, -r.y * O);
  g.globalCompositeOperation = koyu ? "screen" : "multiply";   // ekrandaki CSS karışımıyla aynı
  for (const c of gorunenCizgiler(r.y, r.y + r.h)) {
    const k = c.kutu;
    if (k.x1 > r.x && k.x0 < r.x + r.w && k.y1 > r.y && k.y0 < r.y + r.h) cizgiCiz(g, c, { koyuSayfa: koyu });
  }
  return cv.toDataURL("image/png");
}

function yazilariCiz(g, kesisir) {
  const yuruyen = document.createTreeWalker(S.el.sutun, NodeFilter.SHOW_TEXT);
  const rng = document.createRange(), stiller = new Map();
  const stil = (el) => {
    let st = stiller.get(el);
    if (st) return st;
    const c = getComputedStyle(el);
    st = { font: `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`, renk: c.color, aralik: c.letterSpacing === "normal" ? "0px" : c.letterSpacing, buyuk: c.textTransform === "uppercase" };
    g.font = st.font;
    const m = g.measureText("Hg");
    st.ust = m.fontBoundingBoxAscent; st.yuk = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    stiller.set(el, st);
    return st;
  };
  const yaz = (st, metin, q) => {
    g.font = st.font; g.fillStyle = st.renk; g.letterSpacing = st.aralik;
    g.fillText(st.buyuk ? metin.toLocaleUpperCase("tr") : metin, q.left, q.top + (q.height - st.yuk) / 2 + st.ust);
  };
  let d;
  while ((d = yuruyen.nextNode())) {
    const el = d.parentElement;
    if (!el || el.closest("svg, button.metin-dugme")) continue;
    rng.selectNodeContents(d);
    if (!kesisir(rng.getBoundingClientRect())) continue;
    const st = stil(el), metin = d.data;
    let bas = 0;
    const pIlk = el.closest("p.ilk");
    if (pIlk && !d.previousSibling && (el === pIlk || !el.previousSibling)) bas = ilkHarfCiz(g, d, pIlk, rng, kesisir);
    for (const m of metin.slice(bas).matchAll(/\S+/g)) {
      const a = bas + m.index, b = a + m[0].length;
      rng.setStart(d, a); rng.setEnd(d, b);
      const rs = [...rng.getClientRects()].filter((q) => q.width > 0);
      if (!rs.some(kesisir)) continue;
      if (rs.length === 1) { yaz(st, m[0], rs[0]); continue; }
      // Satır sonunda hecelenmiş kelime: bölündüğü harfi bul
      let k = a + 1;
      for (; k < b; k++) {
        rng.setStart(d, k); rng.setEnd(d, k + 1);
        const q = rng.getClientRects()[0];
        if (q && Math.abs(q.top - rs[0].top) > 2) break;
      }
      yaz(st, metin.slice(a, k) + (k < b ? "-" : ""), rs[0]);
      if (k < b) yaz(st, metin.slice(k, b), rs[rs.length - 1]);
    }
  }
}
// Büyük ilk harf (initial-letter: 3). Chrome bu harfin kutusunu yanlış bildirir (tek satır yüksekliğinde),
// bu yüzden geometri satırlardan kurulur: harfin büyük harf yüksekliği ilk satırın büyük harf çizgisinden
// üçüncü satırın taban çizgisine uzanır.
function ilkHarfCiz(g, d, p, rng, kesisir) {
  if (!d.data.length) return 0;
  rng.setStart(d, 0); rng.setEnd(d, 1);
  const q = rng.getClientRects()[0];
  if (!q) return 1;
  const st = getComputedStyle(p), c = getComputedStyle(p, "::first-letter");
  const fs = parseFloat(st.fontSize), lh = parseFloat(st.lineHeight) || fs * 1.62;
  g.font = `${st.fontWeight} ${fs}px ${st.fontFamily}`;
  const govde = g.measureText("H");
  const ust = p.getBoundingClientRect().top;
  const taban1 = ust + (lh - (govde.fontBoundingBoxAscent + govde.fontBoundingBoxDescent)) / 2 + govde.fontBoundingBoxAscent;
  const capUst = taban1 - govde.actualBoundingBoxAscent, taban3 = taban1 + 2 * lh;
  g.font = `${c.fontWeight} 100px ${c.fontFamily}`;
  const boy = (taban3 - capUst) / (g.measureText("H").actualBoundingBoxAscent / 100);
  g.font = `${c.fontWeight} ${boy}px ${c.fontFamily}`;
  const harf = g.measureText(d.data[0]);
  const kutu = { left: q.left, right: q.left + harf.width, top: capUst, bottom: taban3, width: harf.width, height: taban3 - capUst };
  if (!kesisir(kutu)) return 1;
  g.letterSpacing = "0px";
  g.fillStyle = c.color;
  g.fillText(d.data[0], q.left, taban3);
  return 1;
}

// ---------- paneller (3.22) ----------
function panelAc(taraf, sekme, { zorla = false } = {}) {
  const el = taraf === "sol" ? S.el.solPanel : S.el.sagPanel;
  if (!zorla && S.panel === taraf && (taraf === "sol" || !sekme || sekme === S.sekme)) return panelKapat();
  katmanKapat(); menuKapat();
  if (S.panel && S.panel !== taraf) panelKapat(false);
  if (sekme) S.sekme = sekme;
  const yeni = el.hidden;
  el.hidden = false;
  S.panel = taraf;
  if (yeni && !hareketAz()) { el.classList.add("giriyor"); zamanla(() => el.classList.remove("giriyor"), 280); }
  S.el.perde.hidden = !dar();
  S.el.icindekiler.setAttribute("aria-pressed", String(taraf === "sol"));
  S.el.kIcindekiler.setAttribute("aria-pressed", String(taraf === "sol"));
  S.el.notlar.setAttribute("aria-pressed", String(taraf === "sag"));
  panelYenile();
}
function panelKapat() {
  if (!S.panel) return;
  S.el.solPanel.hidden = true;
  S.el.sagPanel.hidden = true;
  S.el.perde.hidden = true;
  S.panel = null;
  S.el.icindekiler.setAttribute("aria-pressed", "false");
  S.el.kIcindekiler.setAttribute("aria-pressed", "false");
  S.el.notlar.setAttribute("aria-pressed", "false");
}
function panelYenile() {
  if (S.panel === "sol") icindekilerCiz();
  else if (S.panel === "sag") sagPanelCiz();
}
const darsaKapat = () => { if (dar()) panelKapat(); };

function icindekilerCiz() {
  const k = S.yer ? konumAl() : { p: 0, oran: 0 };
  const simdi = P[k.p].b, oran = S.belge.ilerleme || 0;
  S.el.solPanel.replaceChildren(
    h("div", { class: "panel-baslik" }, h("h2", {}, "İçindekiler"),
      h("button", { type: "button", class: "ikon-dugme", "aria-label": "İçindekiler panelini kapat", onclick: () => panelKapat() }, icon("kapat"))),
    h("div", { class: "panel-govde" },
      h("div", { class: "kunye" },
        h("b", {}, S.belge.ad),
        h("span", {}, `${S.belge.yazar || "Deneme"} · ${sayi(TOPLAM)} kelime · yaklaşık ${Math.ceil(TOPLAM / DAKIKADA)} dk`),
        h("span", { class: "kunye-ilerleme", style: `--p:${oran}`, "aria-label": `Kitabın ${yuzde(oran)} okundu` }, h("i"))),
      h("nav", { "aria-label": "Bölümler" }, ...BOLUMLER.map((b) => h("button", {
        type: "button", class: "dizin-satir bolum-satir", "aria-current": b.i === simdi ? "true" : null, "data-okundu": b.i < simdi ? "" : null,
        onclick: () => { darsaKapat(); const el = S.el.sutun.querySelector(`[data-b="${b.i}"]`); kaydirGit(el.offsetTop + S.el.sutun.offsetTop - 8); },
      }, h("span", { class: "tur-etiket" }, b.ad), h("span", { class: "kilavuz" }, h("span", {}, b.baslik), h("b", {}, yuzde(b.onceki / TOPLAM))))))));
}

function sagPanelCiz() {
  const SEKMELER = [["notlar", "Notlar"], ["izler", "İzler"], ["kirpintilar", "Kırpılanlar"], ["yerimleri", "Yer imleri"], ["arama", "Arama"]];
  S.izlerPanel?.kapat(); S.izlerPanel = null;
  const govde = h("div", { class: "panel-govde", role: "tabpanel", id: "okuma-sekme-govde" });
  const sekmeler = h("div", { class: "sekmeler", role: "tablist", "aria-label": "Notlar paneli" }, ...SEKMELER.map(([id, ad]) => h("button", {
    type: "button", class: "sekme", role: "tab", "data-sekme": id, "aria-selected": String(S.sekme === id), "aria-controls": "okuma-sekme-govde",
    onclick: () => { S.sekme = id; sagPanelCiz(); },
  }, ad)));
  const kaydirma = S.el.sagPanel.querySelector(".panel-govde")?.scrollTop || 0;
  S.el.sagPanel.replaceChildren(sekmeler, govde);
  ({ notlar: notlarSekmesi, izler: izlerSekmesi, kirpintilar: kirpintilarSekmesi, yerimleri: yerImleriSekmesi, arama: aramaSekmesi })[S.sekme](govde);
  govde.scrollTop = kaydirma;
}
// İzler sekmesi (OZELLIKLER-5): izler.js listesi panelin içine çizilir, "belge:degisti" ile kendini tazeler
function izlerSekmesi(govde) {
  const kap = h("div", { class: "izler-sekme" }), s = S;
  govde.append(kap);
  import("./izler.js").then((m) => {
    if (S !== s || S.sekme !== "izler" || !kap.isConnected) return;
    S.izlerPanel = m.izlerPaneli(kap, S.belge);
  }).catch((e) => console.warn("[okuma] izler:", e));
}
const bos = (cumle, aciklama) => h("div", { class: "bos yalin" }, h("h3", {}, cumle), aciklama ? h("p", {}, aciklama) : null);
const folyo = (gi, o = 0) => yuzde((P[gi].onceki + (o / Math.max(1, P[gi].metin.length)) * P[gi].kelime) / TOPLAM);

function notlarSekmesi(govde) {
  const vs = S.veri.vurgular;
  if (!vs.length) return govde.append(bos("Henüz vurgu yok.", "Metni seç ve bir renge dokun. Not eklediğin vurgular burada ve sayfanın kenarında görünür."));
  const notlu = vs.filter((v) => v.not && v.not.trim()).length;
  govde.append(h("div", { class: "dizin-ozet" }, `${vs.length} vurgu, ${notlu} kenar notu`));
  for (const v of vs) {
    govde.append(h("button", { type: "button", class: "dizin-satir", onclick: () => vurguyaGit(v) },
      h("span", { class: "folyo" }, folyo(v.bas.p, v.bas.o)),
      h("span", { class: "satir-ic" },
        h("span", { class: "duz" }, h("i", { class: "renk-kare", style: `--n:${vurguRengi(v.renk)}` }), vurguMetni(v)),
        v.not && v.not.trim() ? h("span", { class: "el" }, v.not.trim()) : null)));
  }
}
function kirpintilarSekmesi(govde) {
  const ks = store.kirpintilar.filter((k) => k.belgeId === S.belge.id);
  if (!ks.length) return govde.append(bos("Henüz kırpılmış bir şey yok.", "Metni seçip Kırp'a dokun ya da Kırp aracıyla bir alan sürükle."));
  govde.append(h("div", { class: "dizin-ozet" }, `${ks.length} kırpıntı`));
  for (const k of ks) {
    // Uzun not kesilmesin: satır kaydıran, içeriğe göre uzayan alan
    const girdi = h("textarea", { class: "kirpinti-not", rows: "1", maxlength: "240", placeholder: "not ekle", "aria-label": "Kırpıntı notu" });
    girdi.value = k.not || "";
    girdi.addEventListener("change", () => { k.not = girdi.value; bus.emit("kirpintilar", { tur: "not", id: k.id }); });
    girdi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); girdi.blur(); } });
    govde.append(h("div", { class: "dizin-satir kirpinti-satir" },
      h("span", { class: "folyo" }, "s. " + k.sayfa),
      h("div", {}, h("button", { type: "button", class: "satir-dugme", "aria-label": "Metinde göster", onclick: () => kirpintiyaGit(k) }, h("img", { src: k.gorsel, alt: `${k.belgeAd}, sayfa ${k.sayfa} kırpıntısı` })), girdi)));
  }
}
function yerImleriSekmesi(govde) {
  const ys = S.veri.yerImleri;
  if (!ys.length) return govde.append(bos("Yer imi yok.", "Üst çubuktaki kurdeleye dokunarak okuduğun yeri işaretle."));
  govde.append(h("div", { class: "dizin-ozet" }, `${ys.length} yer imi`));
  for (const y of ys) {
    const p = P[y.p], b = BOLUMLER[p.b];
    govde.append(h("button", { type: "button", class: "dizin-satir", onclick: () => yerImineGit(y) },
      h("span", { class: "kurdele-isaret", "aria-hidden": "true" }),
      h("span", { class: "satir-ic" },
        h("span", { class: "tur-etiket" }, b.ad),
        h("span", { class: "kilavuz" }, h("span", {}, b.baslik), h("b", {}, folyo(y.p))),
        h("span", { class: "baglam-iki" }, p.metin.slice(0, 140)))));
  }
}
function aramaSekmesi(govde) {
  const a = S.arama;
  if (!a) return govde.append(bos("Kitapta ara.", "Üst çubuktaki büyütece dokun ve bir kelime yaz."));
  if (!a.sonuclar.length) return govde.append(bos(`“${a.sorgu}” için sonuç yok.`, "Başka bir kelime dene."));
  govde.append(h("div", { class: "dizin-ozet" }, `${a.sonuclar.length} sonuç · “${a.sorgu}”`));
  for (const e of a.sonuclar.slice(0, 200)) {
    // Bağlam iki satıra sığsın ve eşleşme görünsün: öncesi en çok ~36 harf, kelime başından
    const m = P[e.p].metin, son = Math.min(m.length, e.b + 90);
    let bas = Math.max(0, e.a - 36);
    if (bas > 0) { const bosluk = m.indexOf(" ", bas); bas = bosluk >= 0 && bosluk < e.a ? bosluk + 1 : bas; }
    govde.append(h("button", { type: "button", class: "dizin-satir" + (e.i === a.etkin ? " secili-sonuc" : ""), onclick: () => { darsaKapat(); eslesmeyeGit(e.i, { mutlak: true, halka: true }); } },
      h("span", { class: "folyo" }, folyo(e.p, e.a)),
      h("span", { class: "baglam-iki" }, (bas > 0 ? "… " : "") + m.slice(bas, e.a), h("mark", { class: "eslesme" }, m.slice(e.a, e.b)), m.slice(e.b, son) + (son < m.length ? " …" : ""))));
  }
}

// ---------- gezinme ve kalem halkası (6.5) ----------
function kaydirGit(hedef, sonra) {
  const kay = S.el.kaydir;
  hedef = sinirla(hedef, 0, kay.scrollHeight - kay.clientHeight);
  cancelAnimationFrame(S.raf.kaydir);
  if (hareketAz() || Math.abs(hedef - kay.scrollTop) < 2) { kay.scrollTop = hedef; if (sonra) requestAnimationFrame(() => S && sonra()); return; }
  const bas = kay.scrollTop, fark = hedef - bas, t0 = performance.now();
  const adim = (t) => {
    if (!S) return;
    const p = Math.min(1, (t - t0) / 420);
    kay.scrollTop = bas + fark * egri(p);
    if (p < 1) S.raf.kaydir = requestAnimationFrame(adim);
    else if (sonra) sonra();
  };
  S.raf.kaydir = requestAnimationFrame(adim);
}
// Sütuna göre dikdörtgenler birleşimi
function sutunKutusu(rects) {
  const sR = S.el.sutun.getBoundingClientRect();
  const x0 = Math.min(...rects.map((q) => q.left)), y0 = Math.min(...rects.map((q) => q.top));
  const x1 = Math.max(...rects.map((q) => q.right)), y1 = Math.max(...rects.map((q) => q.bottom));
  return { x: x0 - sR.left, y: y0 - sR.top, width: x1 - x0, height: y1 - y0 };
}
function hedefeGit(icerikY, kutu) {
  kaydirGit(icerikY - S.el.kaydir.clientHeight * 0.35, () => { const k = kutu(); if (k) kalemHalkasi(k); });
}
function vurguyaGit(v) {
  darsaKapat();
  const isaretler = () => [...S.el.sutun.querySelectorAll(`mark[data-v="${v.id}"]`)];
  const ilk = isaretler()[0];
  if (!ilk) return;
  hedefeGit(S.el.sutun.offsetTop + ilk.offsetTop, () => {
    const rs = isaretler().flatMap((m) => [...m.getClientRects()]).filter((q) => q.width > 0);
    return rs.length ? sutunKutusu(rs) : null;
  });
}
function yerImineGit(y) {
  darsaKapat();
  const p = S.pEl[y.p];
  hedefeGit(S.el.sutun.offsetTop + p.offsetTop, () => {
    const r = document.createRange();
    r.selectNodeContents(p);
    const q = r.getClientRects()[0];
    return q ? sutunKutusu([{ left: q.left, top: q.top, right: q.left + Math.min(p.clientWidth * 0.45, 260), bottom: q.bottom }]) : null;
  });
}
function kirpintiyaGit(k) {
  darsaKapat();
  const o = k.okuma;
  if (!o || !S.yer) return;
  const { s, sol, pUst } = S.yer;
  const y = pUst[o.ap] + o.y * s;
  hedefeGit(y, () => {
    const sR = S.el.sutun.getBoundingClientRect(), icR = S.el.ic.getBoundingClientRect();
    return { x: sol + o.x * s - (sR.left - icR.left), y: y - (sR.top - icR.top), width: o.w * s, height: o.h * s };
  });
}

// Bordo kurşun kalem halkası: hafif eğik, uçları üst üste binen elips. Geniş hedefte çok taşmasın diye sınırlı.
function kalemHalkasi(r) {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const rx = Math.min(r.width * 0.8 + 12, r.width / 2 + 40), ry = Math.min(r.height * 0.8 + 10, r.height / 2 + 24);
  const e = (-4 * Math.PI) / 180;
  let d = "";
  for (let i = 0; i <= 56; i++) {
    const a = -0.3 + (i / 56) * (Math.PI * 2 + 0.5), s = 1 + 0.035 * Math.sin(i * 1.7);
    const x = rx * s * Math.cos(a), y = ry * s * Math.sin(a);
    d += (i ? "L" : "M") + (cx + x * Math.cos(e) - y * Math.sin(e)).toFixed(1) + " " + (cy + x * Math.sin(e) + y * Math.cos(e)).toFixed(1);
  }
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "kalem-halkasi");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<path d="${d}"/>`;
  S.el.sutun.append(svg);
  const yol = svg.firstChild;
  yol.style.setProperty("--L", yol.getTotalLength());
  zamanla(() => svg.remove(), 1700);
}

// ---------- arama ----------
function aramaAc() {
  if (S.el.aramaSatiri) { S.el.aramaGirdi.focus(); return; }
  katmanKapat(); menuKapat();
  const girdi = h("input", { type: "search", placeholder: "Kitapta ara", "aria-label": "Kitapta ara", enterkeyhint: "search", autocomplete: "off" });
  const cikti = h("output", { "aria-live": "polite" });
  const onceki = ikonDugme("asagi", "Önceki sonuç", () => eslesmeyeGit(-1), { sinif: "onceki", ek: { disabled: true } });
  const sonraki = ikonDugme("asagi", "Sonraki sonuç", () => eslesmeyeGit(1), { ek: { disabled: true } });
  const satir = h("div", { class: "ust-arama", role: "search" }, girdi, cikti, onceki, sonraki, ikonDugme("kapat", "Aramayı kapat", () => aramaKapat()));
  const yer = S.mod === "koltuk" && S.koltuk ? S.koltuk.el.ad : S.el.baslik;   // koltukta kitap adının yerine
  yer.replaceWith(satir);
  Object.assign(S.el, { aramaSatiri: satir, aramaYeri: yer, aramaGirdi: girdi, aramaCikti: cikti, aramaOnceki: onceki, aramaSonraki: sonraki });
  dugme("ara").setAttribute("aria-pressed", "true");
  girdi.addEventListener("input", () => { clearTimeout(S.aramaZ); S.aramaZ = zamanla(() => aramaYap(girdi.value), 160); });
  girdi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(S.aramaZ);
      if (S.arama?.sorgu !== girdi.value.trim()) aramaYap(girdi.value);
      eslesmeyeGit(e.shiftKey ? -1 : 1);
      if (S.arama?.sonuclar.length && !dar() && S.panel !== "sag") panelAc("sag", "arama");
      else if (S.panel === "sag" && S.sekme !== "arama") { S.sekme = "arama"; panelYenile(); }
    } else if (e.key === "Escape") { e.stopPropagation(); aramaKapat(); }
  });
  girdi.focus();
}
// Arama katlaması genel aramayla aynı: ı/i ve ş/s birleşir ("it" cümle başındaki "It"i de bulur). Uzunluk korunur.
function aramaYap(sorgu) {
  const q = aksansiz(sorgu.trim());
  const once = S.arama;
  if (q.length < 2) {
    S.arama = null;
    S.el.aramaCikti.textContent = "";
  } else {
    const sonuclar = [], paragraf = new Map();
    for (const p of P) {
      const m = (p.ak ??= aksansiz(p.metin));   // katlanmış metin bir kez üretilir, her harfte değil
      for (let i = m.indexOf(q); i >= 0 && sonuclar.length < 500; i = m.indexOf(q, i + q.length)) {
        const e = { p: p.gi, a: i, b: i + q.length, i: sonuclar.length };
        sonuclar.push(e);
        if (!paragraf.has(p.gi)) paragraf.set(p.gi, []);
        paragraf.get(p.gi).push(e);
      }
    }
    S.arama = { sorgu: sorgu.trim(), sonuclar, paragraf, etkin: -1 };
    S.el.aramaCikti.textContent = sonuclar.length ? `${sonuclar.length} sonuç` : "Sonuç yok";
  }
  const var_ = !!S.arama?.sonuclar.length;
  S.el.aramaOnceki.disabled = !var_;
  S.el.aramaSonraki.disabled = !var_;
  // Yalnız eski ya da yeni eşleşmesi olan paragraflar yeniden yazılır
  const yaz = new Set([...(once?.paragraf.keys() || []), ...(S.arama?.paragraf.keys() || [])]);
  for (const gi of yaz) if (P[gi]) paragrafCiz(gi);
  if (S.panel === "sag" && S.sekme === "arama") panelYenile();
}
function eslesmeyeGit(yon, { mutlak = false, halka = false } = {}) {
  const a = S.arama;
  if (!a || !a.sonuclar.length) return;
  const n = a.sonuclar.length;
  let i;
  if (mutlak) i = yon;
  else if (a.etkin < 0) {
    const k = S.yer ? konumAl() : { p: 0 };
    i = a.sonuclar.findIndex((e) => e.p >= k.p);
    if (i < 0) i = 0;
    if (yon < 0) i = (i - 1 + n) % n;
  } else i = (a.etkin + yon + n) % n;
  const eski = a.sonuclar[a.etkin];
  a.etkin = i;
  const e = a.sonuclar[i];
  if (eski) paragrafCiz(eski.p);
  paragrafCiz(e.p);
  S.el.aramaCikti && (S.el.aramaCikti.textContent = `${i + 1} / ${n}`);
  const m = S.el.sutun.querySelector(`mark.eslesme[data-e="${i}"]`);
  if (m) hedefeGit(S.el.sutun.offsetTop + m.offsetTop, () => (halka ? sutunKutusu([...m.getClientRects()]) : null));
  if (S.panel === "sag" && S.sekme === "arama") panelYenile();
}
function aramaKapat() {
  if (!S.el.aramaSatiri) return;
  S.el.aramaSatiri.replaceWith(S.el.aramaYeri || S.el.baslik);
  S.el.aramaSatiri = null;
  S.el.aramaYeri = null;
  S.el.ara.setAttribute("aria-pressed", "false");
  S.el.kAra.setAttribute("aria-pressed", "false");
  clearTimeout(S.aramaZ);
  if (S.arama) { const eski = S.arama; S.arama = null; for (const gi of eski.paragraf.keys()) if (P[gi]) paragrafCiz(gi); }
  if (S.panel === "sag" && S.sekme === "arama") panelYenile();
}

// ---------- klavye ----------
function tusBasildi(e) {
  if (!S) return;
  const yazi = e.target.closest?.("input, textarea, [contenteditable]");
  if (e.key === "Escape") {
    if (S.katman) katmanKapat();
    else if (S.menu) { menuKapat(); document.getSelection()?.removeAllRanges(); }
    else if (S.el.aramaSatiri) aramaKapat();
    else if (S.panel) panelKapat();
    else if (S.okumaModu) okumaModu(false);
    else if (S.koltuk?.gorunur()) S.koltuk.cubuk(false);
    else if (S.koltuk?.kalemAcik()) S.koltuk.kalemKapat();
    else if (S.arac !== "okuma") aracSec("okuma");
    return;
  }
  if (yazi) return;
  const ctrl = e.ctrlKey || e.metaKey, tus = e.key.toLowerCase();
  if (S.mod === "koltuk" && !ctrl && !e.altKey) {
    // Koltuk: sağ ve sol ok, Page Up ve Page Down ekran çevirir; Enter çubukları açar. Araç kısayolları yok.
    const yon = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
    if (yon && !e.target.closest?.(".koltuk-alt, .koltuk-ust, .balon, .fis, .panel")) { e.preventDefault(); koltukCevir(yon); return; }
    if (e.key === "Enter" && e.target === S.el.kaydir) { e.preventDefault(); S.koltuk?.cubuk(!S.koltuk.gorunur()); return; }
    if (/^[phe]$/.test(tus)) return;
  }
  if (!ctrl && !e.altKey && (e.key === "[" || e.key === "]")) { e.preventDefault(); izAtla(e.key === "]" ? 1 : -1); return; }
  if (ctrl && tus === "z") { e.preventDefault(); if (e.shiftKey) yinele(); else geriAl(); return; }
  if (ctrl && tus === "y") { e.preventDefault(); yinele(); return; }
  if (ctrl && tus === "f") { e.preventDefault(); aramaAc(); return; }
  if (ctrl || e.altKey || e.repeat) return;
  const ad = { p: S.arac.startsWith("kalem") ? S.arac : "kalem0", h: "fosforlu", e: "silgi" }[tus];
  if (ad) { e.preventDefault(); aracSec(ad, { klavye: true }); }
}
