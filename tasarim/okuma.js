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
//   exLibrisBasildi: true  ex libris mührü iç kapağa bir kez basıldı (OZELLIKLER-7 §6.1)
// Ödünç kartının okuma süresi belge.odunc'ta (kitaplık kaydı, ortak.okumaSay); kabuk yoksa yedek olarak veri.odunc'ta.

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
import { epubFormul, formulGoruntusu } from "./matematik.js";

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
  { id: "mum", ad: "Mum", kd: "#1E1710", kdy: "#E6CFA5" },   // mum ışığı (TASARIM-4 4.4): sıcak, mavi ışığı az
];
const SAYFA_META = { beyaz: "#FDFBF6", sepya: "#F5EDDA", gece: "#141413", tahta: "#1F2622", mum: "#1E1710" };   // tarayıcı çubuğu sayfayla bir olsun
const KOYU_SAYFA = new Set(["gece", "tahta", "mum"]);
const SAYFA_ADI = { beyaz: "Beyaz", sepya: "Sepya", gece: "Gece", tahta: "Tahta", mum: "Mum" };
// Hazır okuma temaları (TASARIM-2 §4.6). Kullanıcının kaydettikleri store.ayarlar.okumaTemalari'nda.
const HAZIR_TEMALAR = [
  { id: "gunduz", ad: "Gündüz", boyut: 19, satir: 1.62, olcu: 66, aile: "serif", sayfa: "beyaz" },
  { id: "gece", ad: "Gece okuması", boyut: 20, satir: 1.7, olcu: 66, aile: "serif", sayfa: "gece" },
  { id: "mum", ad: "Mum ışığı", boyut: 20, satir: 1.7, olcu: 62, aile: "serif", sayfa: "mum" },
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
const P = [];          // { gi, b, metin, bicim, kelime, onceki, mat }  bicim: [{ a, b, i, k }] italik/kalın aralıkları ya da null
                       // mat: [{ a, b, ml }] metnin MathML olarak çizilen aralıkları (EPUB <math>) ya da null
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
    for (const [j, ham] of b.paragraflar.entries()) {
      if (ham === SAHNE) { if (bolum.bloklar.length) bolum.bloklar.push(null); continue; }
      const { metin, bicim } = bicimli ? bicimCoz(ham) : { metin: ham, bicim: null };
      if (!metin.trim()) continue;
      const p = { gi: P.length, b: bi, metin, bicim, kelime: kelimeSay(metin), onceki: TOPLAM, mat: (bicimli && b.matematik?.[j]) || null };
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
  cetvel: false, cetvelKalem: true,   // okuma cetveli ve havadaki kalemi izlemesi (TASARIM-4 4.5)
  satirAltiNot: false,                // dar ekranda notlar satırın altında kâğıt şerit (TASARIM-4 2.6)
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
  for (const ad of ["cetvel", "cetvelKalem", "satirAltiNot"]) if (typeof k[ad] === "boolean") tercih[ad] = k[ad];
})();
function tercihSakla() {
  const { aile, boyut, satir, olcu, sonVurgu, temaId, cetvel, cetvelKalem, satirAltiNot } = tercih;
  try { localStorage.setItem(TERCIH_DEPO, JSON.stringify({ aile, boyut, satir, olcu, sonVurgu, temaId, cetvel, cetvelKalem, satirAltiNot })); } catch { /* gizli pencere */ }
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
  return { koyu: "gece", gece: "gece", sepya: "sepya", tahta: "tahta", mum: "mum" }[c] || "beyaz";
}
const zamanla = (fn, ms) => { const z = setTimeout(() => { S && S.zamanlar.delete(z); fn(); }, ms); S.zamanlar.add(z); return z; };
const dar = () => matchMedia("(max-width: 999px)").matches;
const kabaIsaretci = () => matchMedia("(pointer: coarse)").matches;
// Telefon düzeni (TASARIM-4 2.1): 600 px altı ya da yatay telefon. Paneller alt çekmece, çubuk iki kat.
const telefon = () => matchMedia("(max-width: 599px), (max-height: 499px) and (orientation: landscape)").matches;
// iPhone ve iPad (iPadOS kendini Macintosh diye tanıtır). Sistem seçim balonu seçimin yanında açılır: menü şeride iner.
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
// S Pen'in yan tuşu silgidir; başka kalemde (Apple Pencil) silgi kalem tepsisinden seçilir
const SAMSUNG = /SM-|Samsung/i.test(navigator.userAgent);
// Boşta çalıştır: kabuğun ortak.bosta'sı varsa o, yoksa Safari için küçük yedek (requestIdleCallback yok)
const bosta = (fn, ms = 500) => (typeof ortak.bosta === "function" ? ortak.bosta(fn, { timeout: ms })
  : typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: ms }) : setTimeout(fn, 16));
// Güvenli alan (çentik, ana ekran çubuğu): env() CSS'te; JS'in hesabı için bir kez ölçülür, döndürünce yeniden
let gaOlcu = null;
function guvenliAlan() {
  if (gaOlcu) return gaOlcu;
  const el = h("div", { style: "position:fixed;visibility:hidden;pointer-events:none;inset:0 auto auto 0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)" });
  document.body.append(el);
  const cs = getComputedStyle(el);
  gaOlcu = { ust: parseFloat(cs.paddingTop) || 0, sag: parseFloat(cs.paddingRight) || 0, alt: parseFloat(cs.paddingBottom) || 0, sol: parseFloat(cs.paddingLeft) || 0 };
  el.remove();
  return gaOlcu;
}
addEventListener("resize", () => { gaOlcu = null; }, { passive: true });

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
    co: null, cf: null, dilTahmin: "",   // çeviri: Çeviriyle oku, çeviri fişi, dili bilinmeyen kitabın tahmini
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
  if (!kitapDili()) zamanla(dilTahminEt, 1500);   // dc:language yoksa çeviri düğmeleri metnin dilinden karar verir
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
  oduncYaz();   // birikmiş okuma süresi kayıtla birlikte gider (yenilemede kaybolmasın)
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
  oduncYaz();   // birikmiş okuma süresi (15 sn dolmamış olsa da)
  s.tepsi?.birak?.();
  s.geriFis?.remove();
  s.veri.sonOkuma = Date.now();
  if (s.halka) s.halka.classList.remove("gorunur");
  if (s.halkaBizim) s.halkaBizim.remove();
  if (s.yer) s.veri.konum = konumAl();
  vurguMetinleriniYaz();
  try { s.izlerPanel?.kapat(); } catch { /* boş */ }
  s.koltuk?.kapat();
  s.koltuk = null;
  s.co?.is?.ctrl.abort();
  s.cf?.ctrl.abort();
  s.anlam?.kIptal?.abort();   // anlam kartındaki karşılık çevirisi (API isteği olabilir)
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
  s.kap.classList.remove("okuma-ekrani", "okuma-modu", "cubuk-gorunur", "tema-acik", "tema-koyu", "yaziyor", "tema-gecisi", "mod-gecisi", "kalem-yakin", "kalem-kosede", "ceviriyle", "parmak-kalem");
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
  // Telefonda üst çubukta yalnız geri, ad, Aa ve ⋯ kalır; Ara, İçindekiler, İzler ve Kalem alt çubuğun ikinci katına iner
  // (TASARIM-4 2.6). Üstteki eşleri telefonda CSS ile gizlenir (.tel-gizle), mod anahtarı ⋯ içinde "Masa'da aç" olur.
  const altDugme = (ik, ad, fn, ek = {}) => h("button", { type: "button", class: "koltuk-alt-dugme", onclick: fn, ...ek }, icon(ik), h("span", {}, ad));
  el.tIcindekiler = altDugme("icindekiler", "İçindekiler", () => panelAc("sol"));
  el.tAra = altDugme("ara", "Ara", () => aramaAc());
  el.tRozet = h("b", { class: "rozet", hidden: true });
  el.tIzler = altDugme("izler", "İzler",() => panelAc("sag", S.veri.izler.length ? "izler" : "notlar"));
  el.tIzler.append(el.tRozet);
  el.tKalem = altDugme("kalem-ucu", "Kalem", () => { S.koltuk?.cubuk(false); kalemTepsisi({ parmak: !S.kalemVar }); }, { "aria-pressed": "false" });
  for (const b of [el.kAra, el.kIcindekiler, el.kDisa]) b.classList.add("tel-gizle");

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
      h("header", { class: "bolum-acilis" }, h("div", { class: "bolum-no", lang: "tr" }, b.ad), fleuron(), h("h2", { id: "okuma-b" + b.i }, b.baslik)));
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
    (S.el.odunc = h("div", { class: "odunc-yer" })),   // arka kapağın içi: ödünç kartı (oduncGuncelle)
    h("button", { type: "button", class: "metin-dugme", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, "Kitaplığa dön")));
  S.el.yerImleri = h("div", { class: "yer-imi-isaretleri", "aria-hidden": "true" });
  S.el.kenarNotlari = h("div", { class: "kenar-notlari" });
  S.el.sutun.append(parca, S.el.yerImleri, S.el.kenarNotlari);
  for (const t of S.veri.tuvaller) tuvalKaydi(t);
  // Formül alanı gelmeden önce çizilmiş vurgular: formülleri bir kez eklenir (cep defteri onları çizer)
  for (const v of S.veri.vurgular) if (!v.formuller && P[v.bas.p]) vurguFormulleri(v);
  paragraflariCiz();   // tuvaller paragrafCiz'in sonunda yerine takılır; açıklar ilk yerleşimde satır başına oturur
  exLibrisKur();
  oduncGuncelle();
}

// Paragrafı vurgu ve arama eşleşmeleriyle yeniden yazar. Metin değişmez, yalnız işaretler.
// Metnin [a, b) parçasını italik ve kalın aralıklarıyla ekler (gerçek EPUB'ta P[gi].bicim).
// Tamamı parçanın içinde kalan formül MathML olarak çizilir. Vurgu ve eşleşme formülü bölmez: paragrafCiz
// onların uçlarını formulUclari ile formülün uçlarına genişletir (formül tek parça, kayıtlı ofsetler değişmez).
function formulUclari(gi, a, b) {
  for (const f of P[gi].mat || []) {
    if (f.a < a && a < f.b) a = f.a;
    if (f.a < b && b < f.b) b = f.b;
  }
  return [a, b];
}
function metinEkle(hedef, gi, a, b) {
  const mat = P[gi].mat;
  if (!mat) return bicimliEkle(hedef, gi, a, b);
  let k = a;
  for (const f of mat) {
    if (f.a < k || f.b > b) continue;
    if (f.a > k) bicimliEkle(hedef, gi, k, f.a);
    hedef.append(epubFormul(P[gi].metin.slice(f.a, f.b), f.ml));
    k = f.b;
  }
  if (k < b) bicimliEkle(hedef, gi, k, b);
}
function bicimliEkle(hedef, gi, a, b) {
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
  const p = S.pEl[gi], metin = P[gi].metin, mat = !!P[gi].mat;
  const parcalar = [];
  for (const v of S.veri.vurgular) {
    if (v.son.p < gi || v.bas.p > gi) continue;
    let a = v.bas.p === gi ? v.bas.o : 0, b = v.son.p === gi ? v.son.o : metin.length;
    if (mat) [a, b] = formulUclari(gi, a, b);
    if (b > a) parcalar.push({ a, b, v, son: v.son.p === gi });
  }
  parcalar.sort((x, y) => x.a - y.a);
  let es = S.arama?.paragraf.get(gi) || S.parla?.get(gi) || [];
  if (mat && es.length) es = es.map((e) => { const [a, b] = formulUclari(gi, e.a, e.b); return a === e.a && b === e.b ? e : { ...e, a, b }; });
  const yaz = (hedef, a, b) => {
    let k = a;
    for (const e of es) {
      if (e.b <= a || e.a >= b) continue;
      const s = Math.max(e.a, a, k), t = Math.min(e.b, b);
      if (t <= s) continue;
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
    const a = Math.max(q.a, i);   // aynı formüle değen iki vurgu: ikincisi formülden sonra başlar
    if (q.b <= a) continue;
    if (a > i) yaz(frag, i, a);
    const m = h("mark", { class: vurguSinifi(q.v.renk) + (q.son && q.v.not ? " notlu" : ""), "data-v": q.v.id });
    yaz(m, a, q.b);
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
// Satır altı çeviri de bloktur ama kendi satır ızgarasıyla ([üst, alt, { ust, alt, lh }]): sayfa sonunda yalnız
// kesilen satırı sonraki sayfaya geçer, bütün çeviri değil (yoksa sayfanın altında büyük boşluk kalıyordu).
function bloklariOlc() {
  const icUst = S.el.ic.getBoundingClientRect().top, b = [];
  for (const el of S.el.sutun.querySelectorAll(".bolum-acilis, .sahne, .kitap-sonu > *, .tuval:not(.kucuk), .ceviri-satir, .satir-alti-not")) {
    const acilis = el.classList.contains("bolum-acilis");
    const r = acilis ? el.firstElementChild.getBoundingClientRect() : el.getBoundingClientRect();
    const alt = acilis ? el.lastElementChild.getBoundingClientRect().bottom : r.bottom;
    if (alt <= r.top) continue;
    // Sıkı satır yüksekliğinde (başlık, numara) harfin kutusu satırdan taşar: 4px pay, İ'nin noktası kesilmez
    const cs = el.classList.contains("tuval") || el.classList.contains("ceviri-satir") ? getComputedStyle(el) : null;
    const ic = el.classList.contains("ceviri-satir")
      ? { ust: r.top - icUst, alt: r.bottom - icUst, lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 24 } : null;
    b.push([r.top - icUst - (cs ? parseFloat(cs.marginTop) : 4), alt - icUst + (cs ? parseFloat(cs.marginBottom) : 4), ic]);
  }
  // Büyük ilk harf üç satırı birlikte tutar: sayfa sınırı bu üç satırın ortasından geçmez (yatay telefonda harf bölünüyordu).
  // Satırlar ızgarada kalır (kalem ışığı, cetvel); yalnız sayfa kesimi grubu bütün sayar (kesim()).
  const lh = parseFloat(getComputedStyle(S.el.sutun).lineHeight) || 30;
  for (const p of S.el.sutun.querySelectorAll("p.ilk")) {
    const r = p.getBoundingClientRect(), ust = r.top - icUst, alt = ust + Math.min(r.height, 3 * lh);
    if (alt - ust > lh * 1.5) b.push([ust, alt, { ust, alt, lh, grup: true }]);
  }
  return b.sort((x, y) => x[0] - y[0]);
}

// İçerik y'sinin düştüğü satır ya da blok: { ust, alt, blok }. Paragraflar arka arkaya, boşluksuz bir satır
// ızgarası kurar (p margin 0); ızgara paragraf başından ya da paragraf içindeki son tuvalin altından sayılır.
// Paragraf ve blok dışında (bölüm açılışının boşluğu) ust = alt = y.
function satirAl(y) {
  const { pUst, pAlt, lh, bloklar } = S.yer;
  let taban = -Infinity;
  for (const [u, a, ic] of bloklar) {
    if (u > y) break;
    if (y < a) {
      if (!ic) return { ust: u, alt: a, blok: true };
      if (y < ic.ust || y >= ic.alt) return { ust: y, alt: y, blok: false };   // çevirinin kenar boşluğu
      const ust = ic.ust + Math.floor((y - ic.ust) / ic.lh + 1e-3) * ic.lh;
      return { ust, alt: Math.min(ust + ic.lh, ic.alt), blok: false, grup: ic.grup ? [u, a] : null };
    }
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
const KOLTUK_UST_T = 60;   // okuma.css: bu bantta sütun başlığı ve sayfa numarası (TASARIM-3 6.4.1: üstte yaklaşık 64px)
const KOLTUK_ALT_T = 54;   // alt kenar boşluğu (TASARIM-3 6.4.1: altta yaklaşık 72px, satır sınırına oturunca)
// Bantlar güvenli alanı da içerir (çentik ve ana ekran çubuğu metni örtmesin; okuma.css aynı env değerleriyle)
const kUst = () => KOLTUK_UST_T + guvenliAlan().ust;
const kAlt = () => KOLTUK_ALT_T + guvenliAlan().alt;
const KAYAN_CEVIRME = 300;   // bundan çok paragraflı kitapta sayfa çevirme kaymasız, yalnız solma (koltukCevir)
// cubuk: çubuklar açıkken pencere opak çubukların altına daralır (yalnız maske; metin kaymaz, çevirme
// çubuksuz pencereye göre yapılır).
function koltukSinir(cubuk = false) {
  const kay = S.el.kaydir, st = kay.scrollTop, H = kay.clientHeight, lh = S.yer.lh;
  let UST_K = kUst(), ALT_K = kAlt();
  if (cubuk) {
    const ust = S.kap.querySelector(".koltuk-ust"), alt = S.kap.querySelector(".koltuk-alt");
    UST_K = Math.max(kUst(), ust?.offsetHeight || 0);
    ALT_K = Math.max(kAlt(), alt?.offsetHeight || 0);
  }
  const ustY = st + UST_K, altY = st + H - ALT_K;
  const u = kesim(satirAl(ustY)), a = kesim(satirAl(altY));
  // Kesilen satırın altından başla; pencereden büyük blok (uzun tuval) olduğu gibi kesilir
  let ust = ustY - u.ust > 1 && u.alt - st < H / 2 ? u.alt - st : UST_K;
  let alt = altY - a.ust > 0.5 && a.ust - st > ust + lh ? a.ust - st : H - ALT_K;
  return { ust, alt, H };
}
// Sayfa kesimi için satır: bölünmez grubun (büyük ilk harf) içindeyse grubun tamamı tek blok sayılır
const kesim = (r) => (r.grup ? { ust: r.grup[0], alt: r.grup[1], blok: true } : r);
// sinir: önceden ölçülmüş pencere (durumGuncelle yazmadan önce ölçer, yazılardan sonra yerleşim zorlanmaz)
const koltukSinirCubuklu = () => koltukSinir(S.kap.classList.contains("cubuk-gorunur"));
function koltukMaske(sinir) {
  if (!S?.yer || S.mod !== "koltuk") return;
  const s = sinir || koltukSinirCubuklu(), kay = S.el.kaydir;
  const u = s.ust.toFixed(1) + "px", a = (s.H - s.alt).toFixed(1) + "px";
  if (S.kMaske === u + a) return;
  S.kMaske = u + a;
  kay.style.setProperty("--sayfa-ust", u);
  kay.style.setProperty("--sayfa-alt", a);
}

// Ekrandaki ilk paragraf ve içindeki oran. Oran 0'ın altında olabilir (paragraf ekranın altında başlıyor).
// Okunur alanın üst sınırı: Masa'da üstte yüzen araç çubuğu (üst çubuk + 12 + kendi boyu) bir satırı kapatmasın.
// Koltukta ve okuma modunda çubuk yok, yalnız üst çubuk. Çubuğun boyu yerleşimde ölçülür (S.cubukH).
// Koltuk'ta sayfanın ilk tam satırı KOLTUK_UST'tedir: konum onun içinden alınır. UST (56) bir önceki sayfanın son
// satırına düşüyordu ve her yeniden yerleşim (Aa, satır altı çeviri) sayfayı bir satır geri kaydırıyordu.
function ustPay() {
  if (S?.mod === "koltuk") return kUst() + 1;
  if (!S || S.okumaModu || !S.cubukH) return UST;
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
    const kenar = S.mod === "koltuk" ? kUst() : ustPay();
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
  if (tercih.cetvel) { if (S.el.cetvel) cetvelIlkSatir(); else cetvelKur(); }
  karolariGuncelle(true);
  S.yer.kayYuk = S.el.kaydir.scrollHeight;   // ölçümden sonra eklenen tuval ve karolar da sayılır
  durumGuncelle();
  if (S.menu) menuKapat();
  if (S.panel) S.el.perde.hidden = !dar();   // döndürünce panel yanda ya da üstte: perde ona göre
  if (ilk && coKayitli().has(S.belge.id) && ceviriVar()) ceviriyleOku(true, { sessiz: true });
  if (S.co) planla("ceviri", coGuncelle);
}

function kaydirildi() {
  if (S.aktif?.bekleyenIslak) islakAktar();
  if (S.menu) { menuKapat(); S.menuGeri = true; }
  if (S.menuGeri) { clearTimeout(S.menuGeriZ); S.menuGeriZ = zamanla(() => { S.menuGeri = false; secimDegisti(); }, 220); }
  // Karolar önce: ölçüleri durumGuncelle'nin yazılarından önce okunur (yazıdan sonra okuma yerleşimi zorlar)
  planla("kare", () => { karolariGuncelle(false); durumGuncelle(); if (S.el.cetvel && S.cetvelY != null) cetvelYerlestir(S.cetvelY); });
  if (S.co) planla("ceviri", coGuncelle);   // kapalıyken hiç iş yok
}

// Durum satırı, ilerleme, üst çubuk alt satırı, yer imi düğmesi (3.27.6)
function durumGuncelle() {
  if (!S.yer) return;
  const kay = S.el.kaydir;
  // Düzen değişti ama henüz ölçülmedi (yazı boyutu, döndürme): eski ölçülerle konum yanlış çıkar, önce yeniden ölçülür
  if (kay.scrollHeight !== S.yer.kayYuk) { planla("yerlesim", yerlesimDegisti); return; }
  // Önce bütün ölçüler, sonra yazılar: yazıdan sonra okunan her ölçü yerleşimi yeniden zorlar
  // (7500 paragraflı kitapta her biri 5 ile 25 ms, sayfa çevirme başına üç kez)
  const st = kay.scrollTop, H = kay.clientHeight;
  const k = konumAl(st + ustPay());
  const p = P[k.p], bolum = BOLUMLER[p.b], sonBolum = bolum.i === BOLUMLER.length - 1;
  const okunan = okunanKelime(k);
  const sonda = st + H >= S.yer.kayYuk - 4;
  const oduncGorunur = !!S.koltuk && sonBolum && st + H > S.el.odunc.offsetTop + S.el.sutun.offsetTop + 40;
  const sinir = S.koltuk ? koltukSinirCubuklu() : null;
  const yerImli = gorunenYerImleri(st, H).length > 0;
  const oran = sonda ? 1 : okunan / TOPLAM;
  const kalanKelime = bolum.onceki + bolum.kelime - okunan;
  metinYaz(S.el.durumBolum, bolum.baslik);
  metinYaz(S.el.kalan, kalanKelime < DAKIKADA || (sonda && sonBolum)
    ? "Bölüm bitmek üzere" : `Bölümün bitmesine yaklaşık ${Math.ceil(kalanKelime / DAKIKADA)} dk`);
  metinYaz(S.el.yuzde, yuzde(oran));
  metinYaz(S.el.altBaslik, `${bolum.ad} · ${yuzde(oran)}`);
  S.el.ilerleme.style.setProperty("--p", oran.toFixed(4));
  S.el.ilerleme.setAttribute("aria-valuenow", String(Math.round(oran * 100)));
  S.belge.ilerleme = oran;
  S.belge.sayfa = Math.min(SAYFA_SAYISI, Math.floor(okunan / SAYFADA) + 1);
  metinYaz(S.el.sayfaNo, `${S.belge.sayfa} / ${SAYFA_SAYISI}`);
  S.veri.konum = k;
  if (S.koltuk) {
    // Ödünç kartı: son sayfaya varınca bitiş günü; kitabın sonu görünürken kart tazelenir (günün damgası bir kez basılır)
    if (sonda && sonBolum && !S.oduncBittiDendi) { S.oduncBittiDendi = true; oduncBitti(); }
    if (sonBolum) oduncGuncelle(oduncGorunur);
    if (S.exBekliyor) exLibrisBas();
    const n = S.veri.vurgular.length + S.veri.izler.length;   // alt çubuktaki İzler rozeti
    if (S.el.tRozet.textContent !== String(n)) { S.el.tRozet.textContent = String(n); S.el.tRozet.hidden = !n; }
    kalinlikGuncelle(oran);
    S.kKonum = { oran, bolumAd: bolum.ad, kelimeKalanBolum: Math.max(0, kalanKelime), kelimeKalanKitap: Math.max(0, TOPLAM - okunan) };
    hizOlc(okunan, st, H);
    S.koltuk.guncelle();
    koltukMaske(sinir);
  }
  yerImiDurumu(yerImli);
  if (bolum.i !== S.sonBolum) { S.sonBolum = bolum.i; if (S.panel === "sol") icindekilerCiz(); }
}
// Yazı aynıysa dokunulmaz (aynı metni yeniden yazmak da yerleşimi kirletir). Değişince var olan metin düğümü
// güncellenir: textContent düğümü söküp takar, bu da kabuktaki :has() kurallarının bütün belgeyi yeniden
// taramasına yol açıyordu (uzun kitapta her yazıda yaklaşık 5 ms).
function metinYaz(el, t) {
  const d = el.firstChild;
  if (d && d.nodeType === 3 && !d.nextSibling) { if (d.data !== t) d.data = t; }
  else if (el.textContent !== t) el.textContent = t;
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

// Vurgunun değdiği formüller vurguyla saklanır: { p, a, b, ml }. Cep defteri ve İzlerim kitabı açmadan
// formülü MathML olarak çizer (izler.js). Formülsüz vurguda alan yazılmaz.
function vurguFormulleri(v) {
  const out = [];
  for (let gi = v.bas.p; gi <= v.son.p; gi++) {
    const a = gi === v.bas.p ? v.bas.o : 0, b = gi === v.son.p ? v.son.o : Infinity;
    for (const f of P[gi]?.mat || []) if (f.b > a && f.a < b) out.push({ p: gi, a: f.a, b: f.b, ml: f.ml });
  }
  if (out.length) v.formuller = out;
  else delete v.formuller;
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
    vurguFormulleri(yeni);
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
  // Formül tek parça: uç formülün içine düştüyse formülün ucuna
  if (P[bas.p].mat) bas.o = formulUclari(bas.p, bas.o, bas.o)[0];
  if (P[son.p].mat) son.o = formulUclari(son.p, son.o, son.o)[1];
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
  if (!oluk) { S.yeniAsistanNotu = null; kenarIsaretleri(); return; }
  kap.classList.remove("isaretli");
  satirAltiNotlar(false);
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
    if (!p) continue;
    // Kenara yazılan çeviri seçimin satırı hizasında durur; asistan notu paragrafın başında
    let y = p.offsetTop + 2;
    if (n.tur === "ceviri" && Number.isInteger(n.o) && n.o > 0 && n.o < P[n.p].metin.length) {
      const r = aralikRange({ bas: { p: n.p, o: n.o }, son: { p: n.p, o: n.o + 1 } }).getClientRects()[0];
      if (r) y = r.top - sR.top + 2;
    }
    ogeler.push({ y, yap: () => asistanNotuEl(n, false) });
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
  // Kart durumu da imzada: karta çevrilince satır içi not "Tekrar'da" desin
  const imza = goster ? notlar.map((n) => n.id + (n.kartId && store.kartlar.some((k) => k.id === n.kartId) ? "+k" : "")).join(",") : "";
  if (imza === S.anYer) return;
  S.anYer = imza;
  for (const e of S.el.sutun.querySelectorAll(".kenar-asistan.satir-ici")) e.remove();
  if (!goster) return;
  // Çeviriyle okurken paragrafın çevirisi hemen altında kalır, not onun altına
  for (const n of [...notlar].sort((a, b) => b.zaman - a.zaman)) (S.co?.bloklar.get(n.p)?.el || S.pEl[n.p])?.after(asistanNotuEl(n, true));
}

// ---------- yer imleri ----------
// st, H: önceden okunmuş kaydırma ve yükseklik (durumGuncelle), yoksa şimdi okunur
function gorunurAralik(st = S.el.kaydir.scrollTop, H = S.el.kaydir.clientHeight) {
  return [st + ustPay(), st + H];
}
function gorunenYerImleri(st, H) {
  if (!S.yer) return [];
  const [a, b] = gorunurAralik(st, H);
  return S.veri.yerImleri.filter((y) => S.yer.pAlt[y.p] > a && S.yer.pUst[y.p] < b - 40);
}
function yerImiDurumu(var_ = gorunenYerImleri().length > 0) {
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
  // Çevir: kitabın dili hedef dilden farklıysa (OZELLIKLER-6 §3.1)
  if (ceviriVar()) {
    ceviriIkonu();
    el.append(h("button", { type: "button", class: "yazi ikonlu cevir", "aria-label": "Çevir", onclick: kapatVe(() => {
      const rs = rects;
      document.getSelection()?.removeAllRanges();
      ceviriFisiAc(kaynakAralik, rs);
    }) }, icon("cevir"), h("span", {}, "Çevir")));
  }
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
    // Kaldırma anında olur; bildirimdeki "Geri al" geri getirir (TASARIM-4 3.6)
    el.append(h("button", { type: "button", class: "yazi sil", onclick: (e) => { e.stopPropagation(); kapatVe(() => vurguSil(v))(); } }, "Vurguyu kaldır"));
  }
  S.kap.append(el);
  S.menu = { el, tur, aralik, v };
  menuKonumla(el, rects);
}

// Seçimin 10px üstünde; yer yoksa altında. Dokunmatikte Android'in kendi menüsü üstte çıktığı için altta.
// iOS'ta sistemin seçim balonu seçimin üstünde ya da altında açılır ve menünün düğmelerini örtebilir; telefonda menü
// ekrana sığmaz. Bu ikisinde menü ekranın altında (seçim alttaysa üstünde) kenardan kenara kayan bir şerittir.
function menuKonumla(el, rects) {
  const kR = S.kap.getBoundingClientRect(), w = el.offsetWidth, hgt = el.offsetHeight;
  const dokunmatik = S.sonIsaretci !== "mouse";
  const ilk = rects[0], son = rects[rects.length - 1];
  if ((dokunmatik && (IOS || telefon())) || w > kR.width - 16) {
    const ustte = (ilk.top + son.bottom) / 2 - kR.top > kR.height * 0.55;
    el.classList.add("serit");
    el.classList.toggle("serit-ust", ustte);
    el.style.left = el.style.top = "";
    if (S.koltuk?.gorunur()) S.koltuk.cubuk(false);   // şerit alt çubuğun yerinde
    return;
  }
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
  // Kitabın dili hedeften farklıysa kartın başında kelimenin karşılığı (en hızlı hazır motordan, OZELLIKLER-6 §3.2)
  if (ceviriVar() && motorBilgi.get(ciftAnahtari()) !== false) { a.karsilik = { durum: "bekliyor", metin: "" }; a.kIptal = new AbortController(); }
  const el = h("div", { class: "anlam-fis fis-kart satirli nesne-acik", role: "dialog", "aria-label": `Anlamı: ${kelime}`, tabindex: "-1" });
  a.el = el;
  S.anlam = a;
  katmanAc(el, { tur: "anlam", kapat: () => { if (S.anlam === a) S.anlam = null; clearTimeout(a.z); a.kIptal?.abort(); } });
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
  if (a.karsilik) anlamKarsilik(a);
  if (a.durum === "bekliyor") anlamIste(a);
}
async function anlamKarsilik(a) {
  const kaynak = kitapDili(), hedef = hedefDil();
  try {
    const m = await ceviriAl();
    const d = await m.ceviriDurumu({ kaynak, hedef });
    if (S?.anlam !== a) return;
    const motor = satirMotoru(d.motorlar);
    motorBilgi.set(ciftAnahtari(), !!motor);
    if (!motor) throw new Error("motor yok");
    const r = await m.cevir(a.kelime, { kaynak, hedef, motor: motor.id, signal: a.kIptal.signal, belgeId: S.belge.id });
    if (S?.anlam !== a) return;
    const mm = d.motorlar.find((x) => x.id === r.motor) || motor;
    a.karsilik = { durum: "bitti", metin: tekSatir(r.metin), motorAd: mm.ad, internet: !mm.cevrimdisi };
  } catch (e) {
    if (e?.name === "AbortError" || S?.anlam !== a) return;
    a.karsilik = null;   // motor yoksa satır hiç görünmez; asistan cevabı eskisi gibi
  }
  anlamCiz(a);
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
    // Karşılık geldiyse asistan cevabı beklenmeden de eklenir: arka yüzde önce karşılık, varsa altında anlam
    type: "button", class: "metin-dugme vurgulu ekle", disabled: a.eklendi || !((a.anlam && a.durum === "bitti") || a.karsilik?.durum === "bitti"),
    onclick: () => {
      const karsilik = a.karsilik?.durum === "bitti" ? a.karsilik.metin : "", anlam = a.durum === "bitti" ? a.anlam : "";
      kartEkle({
        tur: "kelime", on: { metin: a.kelime, baglam: a.baglam }, arka: { metin: [karsilik, anlam].filter(Boolean).join("\n\n") },
        belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: a.sayfa,
      });
      a.eklendi = true;
      anlamCiz(a);
    },
  }, a.eklendi ? [icon("tik"), "Eklendi"] : "Kelime hazinesine ekle");
  el.replaceChildren(...[
    a.eklendi ? h("span", { class: "damga" }, "Tekrar'a eklendi · Kutu I") : null,
    h("header", {}, h("h4", {}, a.kelime), h("span", { class: "anlam-sayfa" }, `S. ${a.sayfa}`)),
    a.karsilik ? h("p", { class: "anlam-karsilik" + (a.karsilik.durum === "bitti" ? "" : " bekliyor"), title: a.karsilik.motorAd || null },
      h("span", { class: "dil" }, hedefDil()), h("span", { class: "k", lang: hedefDil() }, a.karsilik.metin),
      a.karsilik.internet ? h("small", {}, "internetten") : null) : null,
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
  belgeDegisti();
  toast(n.tur === "ceviri" ? "Çeviri notu kaldırıldı" : "Asistan notu kaldırıldı", { etiket: "Geri al", calistir: () => { if (!S) return; S.veri.asistanNotlari.splice(i, 0, n); kenarNotlariniCiz(); } });
}
function asistanNotuEl(n, satirIci) {
  const z = new Date(n.zaman), tarih = `${String(z.getDate()).padStart(2, "0")}.${String(z.getMonth() + 1).padStart(2, "0")}`;
  // Silme anında olur, bildirimde "Geri al" var (TASARIM-4 3.6): iki dokunuşla onay yalnız geri alınamayan işlerde
  const sil = h("button", { type: "button", class: "kenar-asistan__sil", "aria-label": "Asistan notunu kaldır", onclick: (e) => { e.stopPropagation(); asistanNotuSil(n.id); } }, icon("kapat"));
  const kartVar = !!n.kartId && store.kartlar.some((k) => k.id === n.kartId);
  const kart = h("button", { type: "button", class: "kenar-asistan__kart", disabled: kartVar, onclick: () => asistanNotuKarta(n) },
    icon(kartVar ? "tik" : "karta-cevir"), kartVar ? "Tekrar'da" : "Karta çevir");
  // Kenara yazılan çeviri: kurşun kalemle yazılmış karşılık (asistan notuyla aynı kayıt, tur: "ceviri")
  const ceviri = n.tur === "ceviri";
  if (ceviri) sil.setAttribute("aria-label", "Çeviri notunu kaldır");
  return h("aside", { class: "kenar-asistan" + (ceviri ? " kenar-ceviri" : "") + (satirIci ? " satir-ici" : "") + (n.id === S.yeniAsistanNotu ? " yeni" : ""), "data-n": n.id, lang: "tr", "aria-label": ceviri ? "Çeviri notu" : "Asistan notu" },
    h("span", { class: "etiket" }, ceviri ? `Çeviri · ${tarih}` : `Asistan · ${n.kaynak || "Asistan"} · ${tarih}`, sil),
    h("span", { class: "metin", lang: ceviri ? n.dil || null : null }, n.metin), kart);
}
// Asistan notu Tekrar kartı olur: ön yüz soru (yoksa paragrafın başı), arka yüz cevap. Çeviri notunda ön yüz asıl metin.
function asistanNotuKarta(n) {
  const p = P[n.p], bas = p ? (p.metin.length > 160 ? p.metin.slice(0, 160).replace(/\s+\S*$/, "") + "…" : p.metin) : "";
  const on = n.tur === "ceviri" && n.asil ? n.asil : n.soru ? (bas ? `${n.soru}\n“${bas}”` : n.soru) : bas || "Asistan notu";
  const k = kartEkle({ tur: "soru", on: { metin: on }, arka: { metin: n.metin }, belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: p ? sanalSayfa(p.gi, 0) : n.sayfa || 1 });
  n.kartId = k.id;
  bus.emit("belge:degisti", { belgeId: S.belge.id });
  kenarNotlariniCiz();
  toast("Karta çevrildi · Kutu I", { etiket: "Geri al", calistir: () => { kartSil(k.id); if (S) kenarNotlariniCiz(); } });
}

// ---------- çeviri (OZELLIKLER-6 §3) ----------
// ceviri.js yalnız gerektiğinde yüklenir: Çevir'e basınca, anlam kartında, Çeviriyle oku açılınca ya da kitabın dili
// bilinmiyorsa dil tahmininde. Motor ceviri.js'in işi; burada yalnız etiketi (ad) görünür.
let ceviriSoz = null, CV = null;   // CV: yüklenmiş modül (kullanıcı hareketinde beklemeden çağrılsın: cihazIndir, hesap yolu)
const ceviriAl = () => (ceviriSoz ||= import("./ceviri.js").then((m) => (CV = m), (e) => { ceviriSoz = null; throw e; }));
const kisaKod = (k) => String(k || "").trim().toLowerCase().split(/[-_]/)[0];
const hedefDil = () => kisaKod(store.ayarlar.ceviri?.hedef) || "tr";
// Kitabın dili: belge kaydındaki elle seçim, yoksa EPUB'un dc:language'i, yoksa metinden tahmin. Örnek kitap Türkçe.
function kitapDili() {
  const b = S.belge.dil;
  if (typeof b === "string" && b && b !== "oto" && b !== "otomatik") return b;
  return KITAP.dil || S.dilTahmin || (S.belge.dosya ? "" : "tr");
}
const ceviriVar = () => { const k = kisaKod(kitapDili()); return !!k && k !== hedefDil(); };
// Dil çiftinde satır içi motor var mı (son bilinen): yoksa anlam kartı karşılık satırına yer açıp sonra kapatmaz
const motorBilgi = new Map();
const ciftAnahtari = () => kisaKod(kitapDili()) + "|" + hedefDil();
const dilAdlari = {};
const dilAdiTr = (kod) => { try { return (dilAdlari.tr ||= new Intl.DisplayNames(["tr"], { type: "language" })).of(kod) || kod; } catch { return kod; } };
// Türkçe dil adına ek: İngilizce -> İngilizceden, Türkçe -> Türkçeye (ünlü uyumu, sert ünsüz)
function dilEki(ad, tur) {
  const sesli = [...ad.toLocaleLowerCase("tr")].reverse().find((c) => "aeıioöuü".includes(c)) || "e", kalin = "aıou".includes(sesli);
  if (tur === "den") return ad + (/[çfhkpsşt]$/i.test(ad) ? "t" : "d") + (kalin ? "an" : "en");
  return ad + ("aeıioöuü".includes(ad.slice(-1).toLocaleLowerCase("tr")) ? "y" : "") + (kalin ? "a" : "e");
}
const motorYokMetni = (k, hd) => `Bu cihazda ${dilEki(dilAdiTr(kisaKod(k)), "den")} ${dilEki(dilAdiTr(hd), "e")} çeviri motoru yok.`;
const indirMetni = (sec) => (sec.tur === "cihaz" ? "Dil paketini indir" : `Paketi indir · ${boyutMetni(sec.boyut)}`);
const tekSatir = (t) => String(t || "").replace(/\s+/g, " ").trim().replace(/^[\s"“”'‘’]+|[\s"“”'‘’.]+$/g, "");
const boyutMetni = (b) => (b >= 1e6 ? Math.round(b / 1e6).toLocaleString("tr") + " MB" : Math.max(1, Math.round(b / 1e3)).toLocaleString("tr") + " kB");

async function dilTahminEt() {
  if (!S || kitapDili()) return;
  const s = S, bas = Math.min(P.length - 1, Math.floor(P.length * 0.1));   // kapak ve künye sayfaları atlanır
  let t = "";
  for (let gi = bas; gi < P.length && t.length < 1500; gi++) t += P[gi].metin + " ";
  try { const d = await (await ceviriAl()).dilBul(t); if (S !== s) return; S.dilTahmin = d || ""; } catch { return; }
  if (S.yer && !S.co && coKayitli().has(S.belge.id) && ceviriVar()) ceviriyleOku(true, { sessiz: true });
}

// Satır içi çeviri veren motor: ayardaki tercih hazırsa o, yoksa otomatik sıra (çevrimdışı önce). Hesap yolu satıra çeviri getirmez.
const SATIR_MOTORLARI = ["sahte", "cihaz", "paket", "anahtar"];
function satirMotoru(motorlar = []) {
  const hazir = (id) => motorlar.find((m) => m.id === id && m.durum === "hazir");
  const t = store.ayarlar.ceviri?.motor;
  return (SATIR_MOTORLARI.includes(t) && hazir(t)) || SATIR_MOTORLARI.map(hazir).find(Boolean) || null;
}
function hataMetni(e) {
  return {
    ag: "İnternete ulaşılamadı.", sunucu: "Çeviri sunucusu şu an cevap vermiyor.", anahtar: "API anahtarı geçersiz ya da süresi dolmuş.", sinir: "Sağlayıcının sınırına takıldı. Biraz sonra yeniden dene.",
    "motor-yok": "Çeviri motoru hazır değil.", "paket-yok": "Çeviri paketi yüklü değil.", bozuk: "Çeviri paketi bozuk. Ayarlar'dan silip yeniden indir.",
    yer: "Cihazda yer kalmadı.", dil: "Kitabın dili bulunamadı.", hareket: "İndirmek için düğmeye yeniden dokun.",
  }[e?.tur] || "Çeviri yapılamadı.";
}
// Kabuk sprite'ına eklemediyse Çevir simgesi buradan: A ve yazı işareti (24'lük ızgara, 1,6 çizgi)
function ceviriIkonu() {
  if (document.getElementById("i-cevir")) return;
  const sprite = document.querySelector("svg symbol")?.parentNode;
  if (!sprite) return;
  const s = document.createElementNS(SVG_NS, "symbol");
  s.id = "i-cevir";
  s.setAttribute("viewBox", "0 0 24 24");
  s.innerHTML = '<path d="M3.5 20 7.6 9.5 11.7 20M5.1 16.2h5"/><path d="M12.5 5.5h8M16.5 3.5v2M14 5.5c.7 2.5 2.7 4.5 6 5.4M19 5.5c-.7 2.5-2.6 4.5-5.5 5.4"/>';
  sprite.append(s);
}

// İndirilebilecek şey: Chrome'un kendi dil paketi (cihaz) ya da çeviri paketleri (doğrudan çift ya da İngilizce üzerinden iki ayak)
async function ceviriIndirSecenegi(kaynak, hedef) {
  const m = await ceviriAl(), d = await m.ceviriDurumu({ kaynak, hedef });
  const durum = (id) => d.motorlar.find((x) => x.id === id)?.durum;
  if (durum("cihaz") === "indirilebilir") return { tur: "cihaz", boyut: 0 };
  if (!["indirilebilir", "iniyor"].includes(durum("paket"))) return null;
  const liste = await m.paketler({ bekleme: 3000 }), k = m.kisaDil(kaynak), hd = m.kisaDil(hedef);
  const bul = (a, b) => liste.find((x) => x.kaynak === a && x.hedef === b);
  const ayaklar = bul(k, hd) ? [bul(k, hd)] : [bul(k, "en"), bul("en", hd)].filter(Boolean);
  const eksik = ayaklar.filter((x) => x.durum !== "yuklu");
  return eksik.length ? { tur: "paket", ayaklar: eksik, boyut: eksik.reduce((t, x) => t + (x.indirme || x.boyut || 0), 0) } : null;
}
// Kullanıcı hareketinde çağrılır (cihaz paketi hareket ister). İniş arka planda sürer, fiş kapansa da.
function ceviriIndir(sec, kaynak, hedef, ilerleme) {
  if (!CV) return Promise.reject(new Error("modül yok"));
  if (sec.tur === "cihaz") return CV.cihazIndir(kaynak, hedef, { ilerleme });
  return sec.ayaklar.reduce((soz, a, i) => soz.then(() => CV.paketIndir(a.kaynak, a.hedef, {
    ilerleme: (o) => ilerleme?.((i + o) / sec.ayaklar.length),
  })), Promise.resolve());
}

// ----- seçip çevir: seçimin altında kâğıt fiş -----
// c.durum: bekliyor | akiyor | bitti | hata | yok (motor yok) | iniyor | hesap | donus | yapistir
function ceviriFisiAc(aralik, rects) {
  menuKapat();
  const c = {
    aralik, metin: vurguMetni(aralik, "\n\n"), kelime: tekKelime(aralik), sayfa: sanalSayfa(aralik.bas.p, aralik.bas.o),
    kaynak: kitapDili(), hedef: hedefDil(), durum: "bekliyor", ceviri: "", motorAd: "", internet: false,
    ctrl: new AbortController(), notId: null, kartId: null,
  };
  c.el = h("div", { class: "ceviri-fis nesne-acik", role: "dialog", "aria-label": "Çeviri", tabindex: "-1" });
  S.cf = c;
  katmanAc(c.el, { tur: "ceviri", kapat: () => { c.ctrl.abort(); if (S?.cf === c) S.cf = null; } });
  cfCiz(c);
  cfKonumla(c, rects);
  c.el.focus({ preventScroll: true });
  cfCevir(c);
}
// Sütunla hizalı (fişin metni sütunun metniyle aynı kenarda). Yer: seçili paragrafın altı (paragraf okunur kalır);
// sığmazsa seçimin altı; o da sığmazsa seçimin üstü (fiş yukarı büyür).
function cfKonumla(c, rects) {
  const el = c.el, kR = S.kap.getBoundingClientRect(), sR = S.el.sutun.getBoundingClientRect();
  const rs = (rects?.length ? rects : [...aralikRange(c.aralik).getClientRects()]).filter((q) => q.width > 0);
  const son = rs[rs.length - 1] || sR, ilk = rs[0] || sR;
  const ga = guvenliAlan(), solK = Math.max(12, ga.sol + 8), sagK = Math.max(12, ga.sag + 8);   // yatay telefonda çentik dışı
  const w = Math.min(sR.width + 40, 560, kR.width - solK - sagK);
  el.style.width = w + "px";
  el.style.left = sinirla(sR.left - kR.left - 20, solK, kR.width - w - sagK) + "px";
  // Çevirinin boyu kaynağınkine yakın: satır sayısı tahmini (16/26 Literata), başlık ve düğmelerle
  const satir = Math.min(12, Math.ceil((c.metin.length * 1.08) / Math.max(20, (w - 40) / (16 * 0.47))));
  const hg = Math.max(el.offsetHeight, 108 + satir * 26), taban = kR.bottom - (S.mod === "koltuk" ? kAlt() : 12);
  const pAlt = S.pEl[c.aralik.son.p].getBoundingClientRect().bottom;
  const y = [pAlt + 12, son.bottom + 12].find((v) => v + hg < taban);
  el.classList.toggle("ustte", y == null);
  if (y != null) el.style.top = y - kR.top + "px";
  else el.style.bottom = Math.max(12, kR.bottom - ilk.top + 12) + "px";
}
async function cfCevir(c) {
  Object.assign(c, { durum: "bekliyor", ceviri: "", hata: "" });
  cfCiz(c);
  let m, d;
  try { m = await ceviriAl(); d = await m.ceviriDurumu({ kaynak: c.kaynak, hedef: c.hedef }); }
  catch { if (S?.cf !== c) return; c.durum = "hata"; c.hata = "Çeviri açılamadı."; cfCiz(c); return; }
  if (S?.cf !== c) return;
  const hesap = d.motorlar.some((x) => x.id === "hesap" && x.durum === "hazir");
  const motor = store.ayarlar.ceviri?.motor === "hesap" && hesap ? null : satirMotoru(d.motorlar);
  if (!motor) {
    c.indir = await ceviriIndirSecenegi(c.kaynak, c.hedef).catch(() => null);
    if (S?.cf !== c) return;
    c.durum = hesap ? "hesap" : "yok";
    cfCiz(c);
    return;
  }
  Object.assign(c, { motorAd: motor.ad, internet: !motor.cevrimdisi });
  try {
    const r = await m.cevir(c.metin, {
      kaynak: c.kaynak, hedef: c.hedef, motor: motor.id, signal: c.ctrl.signal, belgeId: S.belge.id,
      parca: (kismi) => {
        if (S?.cf !== c) return;
        const ilk = c.durum !== "akiyor";
        c.ceviri = kismi; c.durum = "akiyor";
        if (ilk || !c.metinEl?.isConnected) cfCiz(c);
        else c.metinEl.replaceChildren(kismi, h("span", { class: "imlec", "aria-hidden": "true" }));
      },
    });
    if (S?.cf !== c) return;
    const mm = d.motorlar.find((x) => x.id === r.motor) || motor;
    Object.assign(c, { durum: "bitti", ceviri: r.metin, motorAd: mm.ad, internet: !mm.cevrimdisi });
  } catch (e) {
    if (e?.name === "AbortError" || S?.cf !== c) return;
    Object.assign(c, { durum: "hata", hata: hataMetni(e) });
  }
  cfCiz(c);
}
function cfCiz(c) {
  const uyg = uygulamaAl();
  const dugme = (metin, ikon, fn, { birincil = false, kapali = false } = {}) => h("button", {
    type: "button", class: birincil ? "birincil kucuk" : "metin-dugme", disabled: kapali || null, onclick: fn,
  }, ikon ? icon(ikon) : null, metin);
  const not = (metin) => h("p", { class: "cf-not" }, metin);
  const indir = () => c.indir ? dugme(indirMetni(c.indir), null, () => cfIndir(c), { birincil: c.durum === "yok" }) : null;
  const govde = h("div", { class: "cf-govde" });
  let alt = [];
  c.metinEl = null;
  switch (c.durum) {
    case "bekliyor":
      govde.append(h("p", { class: "cf-metin bekliyor", "aria-busy": "true", "aria-label": "Çevriliyor" }, h("i"), h("i"), h("i")));
      break;
    case "akiyor":
    case "bitti": {
      c.metinEl = h("p", { class: "cf-metin", lang: c.hedef, "aria-live": "polite" }, c.ceviri);
      if (c.durum === "akiyor") c.metinEl.append(h("span", { class: "imlec", "aria-hidden": "true" }));
      govde.append(c.metinEl);
      if (c.durum === "bitti") {
        const kartVar = !!c.kartId && store.kartlar.some((k) => k.id === c.kartId);
        alt = [
          dugme("Kopyala", "kopyala", () => kopyala(c.ceviri)),
          dugme(c.notId ? "Kenarda" : "Kenara yaz", c.notId ? "tik" : "kenara-not", () => cfKenaraYaz(c), { kapali: !!c.notId }),
          dugme(kartVar ? "Tekrar'da" : "Karta çevir", kartVar ? "tik" : "karta-cevir", () => cfKarta(c), { kapali: kartVar }),
        ];
      }
      break;
    }
    case "hata":
      govde.append(not(c.hata || "Çeviri yapılamadı."));
      alt = [dugme("Yeniden dene", "yeniden", () => cfCevir(c))];
      break;
    case "yok":
      govde.append(not(motorYokMetni(c.kaynak, c.hedef) +
        (c.indir ? " Paketi bir kez indirince internetsiz çevrilir." : " Ayarlar'daki Çeviri kartından bir paket indir.")));
      alt = [indir()].filter(Boolean);
      break;
    case "iniyor":
      govde.append(not("Çeviri paketi iniyor. Fişi kapatsan da arka planda sürer."),
        h("div", { class: "cf-ilerleme", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round((c.oran || 0) * 100)) },
          h("i", { style: `--o:${(c.oran || 0).toFixed(3)}` }), h("span", {}, yuzde(c.oran || 0))));
      break;
    case "hesap":
      govde.append(not(`Bu cihazda internetsiz çeviri yok. Metni ${uyg.ad} ile ya da Google Çeviri'de çevir, sonucu kopyalayıp buraya dön.`));
      alt = [indir(), dugme("Google Çeviri", null, () => cfHesap(c, "google")), dugme(`${bulunma(uyg.ad)} çevir`, "sor", () => cfHesap(c, uyg.id), { birincil: true })].filter(Boolean);
      break;
    case "donus":
      govde.append(not(`Çeviri ${bulunma(c.motorAd)}. Bitince kopyala ve buraya dön.`));
      alt = [dugme("Elle yapıştır", null, () => { c.durum = "yapistir"; cfCiz(c); }),
        h("button", { type: "button", class: "birincil kucuk" + (c.vurgula ? " vurgula" : ""), onclick: () => cfGetir(c) }, icon("yapistir"), "Çeviriyi getir")];
      break;
    case "yapistir": {
      const alan = h("textarea", { class: "cf-yapistir", rows: "3", placeholder: "Çeviriyi buraya yapıştır", "aria-label": "Çeviriyi yapıştır", lang: c.hedef });
      const ekle = () => { const t = alan.value.trim(); if (!t) return alan.focus(); Object.assign(c, { ceviri: t, durum: "bitti" }); cfCiz(c); };
      alan.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ekle(); });
      govde.append(alan);
      alt = [dugme("Ekle", "tik", ekle, { birincil: true })];
      requestAnimationFrame(() => alan.isConnected && alan.focus({ preventScroll: true }));
      break;
    }
  }
  const yon = `${kisaKod(c.kaynak)} → ${c.hedef}`;
  c.el.replaceChildren(...[
    h("header", {}, h("span", { class: "cf-yon", "aria-label": `${dilAdiTr(kisaKod(c.kaynak))} → ${dilAdiTr(c.hedef)}` }, yon),
      c.motorAd ? h("span", { class: "cf-motor" }, c.motorAd) : null,
      c.internet ? h("span", { class: "cf-internet" }, "internetten") : null),
    govde,
    alt.length ? h("footer", {}, ...alt) : null].filter(Boolean));
}
function cfIndir(c) {
  const sec = c.indir;
  if (!sec) return;
  Object.assign(c, { durum: "iniyor", oran: 0 });
  cfCiz(c);
  ceviriIndir(sec, c.kaynak, c.hedef, (o) => {
    c.oran = o;
    const b = S?.cf === c && c.el.querySelector(".cf-ilerleme");
    if (b) { b.firstChild.style.setProperty("--o", o.toFixed(3)); b.lastChild.textContent = yuzde(o); b.setAttribute("aria-valuenow", String(Math.round(o * 100))); }
  }).then(() => {
    if (S?.cf === c) cfCevir(c); else toast("Çeviri paketi indi. Artık internetsiz çevrilir.");
  }, (e) => {
    if (S?.cf !== c) return;
    Object.assign(c, { durum: "hata", hata: e?.name === "AbortError" ? "İndirme durdu." : hataMetni(e) });
    cfCiz(c);
  });
}
// Hesap yolu: soru uygulamaya ya da Google Çeviri'ye gider (kullanıcı hareketinde, beklemeden), cevap panodan döner
function cfHesap(c, uygulama) {
  if (!CV) return;
  if (uygulama === "google") { CV.googleCeviriAc(c.metin, { kaynak: c.kaynak, hedef: c.hedef }); c.motorAd = "Google Çeviri"; }
  else { CV.hesapIleCevir(c.metin, { kaynak: c.kaynak, hedef: c.hedef, uygulama }).catch(() => {}); c.motorAd = uygulamaAl().ad; }
  Object.assign(c, { durum: "donus", internet: true, vurgula: false });
  cfCiz(c);
}
async function cfGetir(c) {
  let t = "";
  try { t = (await navigator.clipboard.readText()).trim(); } catch { /* izin yok */ }
  if (S?.cf !== c) return;
  // Panoda hâlâ bizim istem duruyorsa (cevap kopyalanmadı) yapıştırma alanı açılır
  if (t && !t.startsWith("Şu metni") && t !== c.metin.trim()) Object.assign(c, { ceviri: t, durum: "bitti" });
  else c.durum = "yapistir";
  cfCiz(c);
}
// Kenara yaz: asistan notlarıyla aynı yerde, kurşun kalem görünümünde (tur: "ceviri"); seçimin satırı hizasında
function cfKenaraYaz(c) {
  if (c.notId || !c.ceviri.trim()) return;
  const asil = c.metin.length > 400 ? c.metin.slice(0, 400).replace(/\s+\S*$/, "") + "…" : c.metin;
  const n = { id: yeniId("an"), tur: "ceviri", p: c.aralik.bas.p, o: c.aralik.bas.o, sayfa: c.sayfa, asil, metin: c.ceviri.trim(), dil: c.hedef, kaynak: c.motorAd, zaman: Date.now() };
  if (c.kartId) n.kartId = c.kartId;   // fişten karta çevrildiyse kenardaki not da "Tekrar'da" der
  S.veri.asistanNotlari.push(n);
  c.notId = n.id;
  S.yeniAsistanNotu = n.id;
  kenarNotlariniCiz();
  belgeDegisti();
  cfCiz(c);
  toast("Kenara yazıldı", { etiket: "Geri al", calistir: () => {
    if (!S) return;
    const i = S.veri.asistanNotlari.findIndex((x) => x.id === n.id);
    if (i >= 0) { S.veri.asistanNotlari.splice(i, 1); kenarNotlariniCiz(); belgeDegisti(); }
    if (S.cf === c) { c.notId = null; cfCiz(c); }
  } });
}
// Karta çevir: ön yüz asıl metin, arka yüz çeviri. Tek kelime kelime kartı olur (bağlam cümlesiyle).
function cfKarta(c) {
  const ortakAlan = { belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: c.sayfa };
  const k = kartEkle(c.kelime
    ? { tur: "kelime", on: { metin: c.kelime, baglam: baglamCumle(c.aralik) }, arka: { metin: c.ceviri.trim() }, ...ortakAlan }
    : { tur: "soru", on: { metin: c.metin }, arka: { metin: c.ceviri.trim() }, ...ortakAlan });
  c.kartId = k.id;
  const n = c.notId && S.veri.asistanNotlari.find((x) => x.id === c.notId);
  if (n) { n.kartId = k.id; belgeDegisti(); kenarNotlariniCiz(); }
  cfCiz(c);
  toast("Karta çevrildi · Kutu I", { etiket: "Geri al", calistir: () => {
    kartSil(k.id);
    if (S && n) kenarNotlariniCiz();
    if (S?.cf === c) { c.kartId = null; cfCiz(c); }
  } });
}

// ----- Çeviriyle oku: her paragrafın altında soluk, küçük çevirisi (eski iki dilli baskılar gibi) -----
// Yalnız görünen ve sıradaki sayfanın paragrafları çevrilir (sırayla, görünen önce). Gelmemiş çevirinin yeri
// tahmini yükseklikle ayrılır ve ince yer tutucu çizgilerle durur: çeviri gelince sayfa zıplamaz. Kapalıyken hiç iş yok.
// Çeviri satırları paragrafın kardeşidir (p'nin içinde değil): vurgu ofsetleri, izler ve seçim yalnız asıl metni görür.
// S.co: { kaynak, hedef, durum: "hazirlaniyor"|"hazir"|"motor-yok", motor, motorAd, bloklar: Map(gi -> { el, durum, metin }), ... }
const CO_DEPO = "kn-tasarim:ceviriyle-oku";
function coKayitli() {
  try { const d = JSON.parse(localStorage.getItem(CO_DEPO)); return new Set(Array.isArray(d) ? d : []); } catch { return new Set(); }
}
function coKaydet(acik) {
  const s = coKayitli();
  if (acik) s.add(S.belge.id); else s.delete(S.belge.id);
  try { localStorage.setItem(CO_DEPO, JSON.stringify([...s].slice(-200))); } catch { /* gizli pencere */ }
}
const aaYenile = () => { if (S?.katman?.tur === "aa") katmanYenile(); };

async function ceviriyleOku(acik, { sessiz = false } = {}) {
  if (!S) return;
  if (!acik) { coKapat(); coKaydet(false); aaYenile(); return; }
  if (S.co || !ceviriVar()) return;
  const co = S.co = {
    kaynak: kitapDili(), hedef: hedefDil(), tercih: store.ayarlar.ceviri?.motor || "otomatik", durum: "hazirlaniyor",
    bloklar: new Map(), kuyruk: [], is: null, yazilacak: new Set(), yazZ: 0, olcu: "", hataSay: 0,
  };
  if (!sessiz) coKaydet(true);
  S.kap.classList.add("ceviriyle");
  aaYenile();
  await coMotorBul(co);
}
async function coMotorBul(co) {
  try {
    const m = await ceviriAl();
    const d = await m.ceviriDurumu({ kaynak: co.kaynak, hedef: co.hedef });
    if (S?.co !== co) return;
    const motor = satirMotoru(d.motorlar);
    motorBilgi.set(ciftAnahtari(), !!motor);
    if (motor) {
      Object.assign(co, { durum: "hazir", motor: motor.id, motorAd: motor.ad, internet: !motor.cevrimdisi, hata: "" });
      if (motor.id === "paket") m.hazirla({ kaynak: co.kaynak, hedef: co.hedef }).catch(() => {});   // WASM ve model işçide önceden
    } else {
      co.durum = "motor-yok";
      co.indir = await ceviriIndirSecenegi(co.kaynak, co.hedef).catch(() => null);
    }
  } catch { co.durum = "motor-yok"; }
  if (S?.co !== co) return;
  aaYenile();
  if (co.durum === "hazir") planla("ceviri", coGuncelle);
}
function coKapat() {
  const co = S?.co;
  if (!co) return;
  // Sayfanın başı bir çeviri satırındaysa okur bir sonraki paragrafın başında kalır (kapanınca geri fırlamaz)
  if (S.yer && S.el.kaydir.scrollHeight === S.yer.kayYuk) { const k = konumAl(); S.veri.konum = k.oran < 0 ? { p: k.p, oran: 0 } : k; }
  S.co = null;
  co.is?.ctrl.abort();
  for (const k of co.bloklar.values()) k.el.remove();
  S.kap.classList.remove("ceviriyle");
  S.anYer = null;   // satır içi asistan notları çevirinin altından paragrafın altına döner
  if (S.yer) kenarNotlariniCiz();
}
// Görünen ve sıradaki sayfa: eksik bloklar yer tutucuyla eklenir, bekleyenler sıraya girer, aralık dışına düşen iş durur
function coGuncelle() {
  const co = S?.co;
  if (!co || co.durum !== "hazir" || !S.yer) return;
  // Kalem yazarken yer tutucu eklenmez, boyut değişmez: metin kalemin altında kaymasın
  if (S.aktif) { co.guncelZ ||= zamanla(() => { co.guncelZ = 0; if (S?.co === co) planla("ceviri", coGuncelle); }, 250); return; }
  const kay = S.el.kaydir, st = kay.scrollTop, H = kay.clientHeight;
  const a = konumAl(st).p, b = konumAl(st + 2 * H).p;
  const olcu = `${S.yer.em}|${S.yer.s}`;
  if (co.olcu !== olcu) {   // yazı boyutu ya da sütun değişti: bekleyenlerin ayrılan yeri yeniden tahmin edilir
    co.olcu = olcu;
    for (const [gi, k] of co.bloklar) if (k.durum !== "bitti" && k.durum !== "hata") k.el.style.minHeight = coTahmin(gi);
  }
  let eklendi = false;
  for (let gi = a; gi <= b; gi++) {
    if (co.bloklar.has(gi)) continue;
    const el = h("div", { class: "ceviri-satir bekliyor", "data-cp": gi, lang: co.hedef, style: `min-height:${coTahmin(gi)}` });
    el.addEventListener("click", () => coYeniden(gi));
    co.bloklar.set(gi, { el, durum: "bekliyor", metin: "" });
    S.pEl[gi].after(el);
    eklendi = true;
  }
  if (eklendi) S.anYer = null;   // satır içi asistan notları çevirinin altına yeniden dizilir (yerleşimde)
  co.kuyruk = [];
  for (let gi = a; gi <= b; gi++) if (co.bloklar.get(gi)?.durum === "bekliyor") co.kuyruk.push(gi);
  if (co.is && (co.is.gi < a || co.is.gi > b)) co.is.ctrl.abort();
  coSiradaki();
}
// Ayrılan yer: çeviri satırının yazısı .84em, satırı 1.5; Türkçe İngilizceden biraz uzun. Birim bloğun kendi em'i.
function coTahmin(gi) {
  const { em, s } = S.yer, gen = s * BIRIM, f = em * 0.84;
  const harf = Math.max(12, gen / (f * 0.47));
  const n = Math.max(1, Math.ceil((P[gi].metin.length * 1.08) / harf));
  return (n * 1.5).toFixed(2) + "em";
}
function coYeniden(gi) {
  const co = S?.co, k = co?.bloklar.get(gi);
  if (!k || k.durum !== "hata") return;
  k.durum = "bekliyor";
  co.hataSay = 0;
  k.el.style.minHeight = coTahmin(gi);
  coYaz(co, gi);
  planla("ceviri", coGuncelle);
}
async function coSiradaki() {
  const co = S?.co;
  if (!co || co.is || co.durum !== "hazir") return;
  const gi = co.kuyruk.shift();
  if (gi == null) return;
  const k = co.bloklar.get(gi);
  if (!k || k.durum !== "bekliyor") { coSiradaki(); return; }
  const ctrl = new AbortController();
  co.is = { gi, ctrl };
  k.durum = "akiyor";
  try {
    const m = await ceviriAl();
    const r = await m.cevir(P[gi].metin, {
      kaynak: co.kaynak, hedef: co.hedef, motor: co.motor, signal: ctrl.signal, belgeId: S.belge.id,
      parca: (kismi) => { if (S?.co === co && !ctrl.signal.aborted) { k.metin = kismi; coYaz(co, gi); } },
    });
    if (S?.co !== co) return;
    Object.assign(k, { durum: "bitti", metin: r.metin });
    co.hataSay = 0;
  } catch (e) {
    if (S?.co !== co) return;
    if (e?.name === "AbortError") Object.assign(k, { durum: "bekliyor", metin: "" });
    else if (["motor-yok", "paket-yok", "hesap"].includes(e?.tur)) {   // motor gitti: çeviri bekler, Aa'da durum yazar
      Object.assign(k, { durum: "bekliyor", metin: "" });
      co.durum = "motor-yok";
      co.hata = hataMetni(e);
      aaYenile();
    } else {
      Object.assign(k, { durum: "hata", metin: "" });
      // Art arda üç hata (ağ, anahtar): sıra durur; satıra dokununca yeniden denenir
      if (++co.hataSay >= 3) { co.kuyruk = []; toast("Çeviri durdu: " + hataMetni(e)); }
    }
  } finally {
    if (S?.co === co && co.is?.gi === gi) co.is = null;
  }
  coYaz(co, gi);
  if (S?.co === co && co.hataSay < 3) zamanla(coSiradaki, 0);
}
// Satırlar toplu yazılır (bir düzen hesabı); kalem yazarken düzen değişmez, kalkınca yazılır
function coYaz(co, gi) {
  co.yazilacak.add(gi);
  if (!co.yazZ) co.yazZ = zamanla(() => coBosalt(co), 60);
}
function coBosalt(co) {
  co.yazZ = 0;
  if (S?.co !== co) return;
  if (S.aktif) { co.yazZ = zamanla(() => coBosalt(co), 250); return; }
  for (const gi of co.yazilacak) {
    const k = co.bloklar.get(gi);
    if (!k) continue;
    const bekliyor = !k.metin && (k.durum === "bekliyor" || k.durum === "akiyor");
    k.el.classList.toggle("bekliyor", bekliyor);
    k.el.classList.toggle("hata", k.durum === "hata");
    k.el.textContent = k.durum === "hata" ? "Çevrilemedi. Yeniden denemek için dokun." : bekliyor ? "" : k.metin;
    if (k.durum === "bitti" || k.durum === "hata") k.el.style.minHeight = "";
  }
  co.yazilacak.clear();
}
// Aa'daki "Çeviri" bölümü: anahtar ve motorun durumu
function aaCeviriBolumu() {
  if (!ceviriVar()) return null;
  const co = S.co, hd = hedefDil();
  const b = h("button", { type: "button", class: "anahtar-satir", role: "switch", "aria-checked": String(!!co) },
    h("span", {}, "Çeviriyle oku", h("small", {}, `Her paragrafın altında ${dilAdiTr(hd)} çevirisi`)), h("span", { class: "anahtar" }));
  b.addEventListener("click", () => ceviriyleOku(!S.co));
  let durum = null;
  if (co?.durum === "hazirlaniyor") durum = h("p", { class: "aa-ceviri-durum" }, "Çeviri hazırlanıyor");
  else if (co?.durum === "hazir") durum = h("p", { class: "aa-ceviri-durum" }, co.motorAd, h("span", {}, co.internet ? "internetten" : "bu cihazda"));
  else if (co?.durum === "motor-yok") {
    durum = h("div", { class: "aa-ceviri-durum yok" },
      h("p", {}, co.hata || motorYokMetni(co.kaynak, hd)),
      co.iniyor ? h("p", { class: "aa-ceviri-oran" }, `Paket iniyor · ${yuzde(co.oran || 0)}`)
        : co.indir ? h("button", { type: "button", class: "ikincil", onclick: () => coIndir(co) }, indirMetni(co.indir))
          : h("p", {}, "Ayarlar'daki Çeviri kartından bir paket indir."));
  }
  return h("div", { class: "aa-bolum aa-ceviri" }, etiket("Çeviri"), b, durum);
}
function coIndir(co) {
  if (!co.indir || co.iniyor) return;
  Object.assign(co, { iniyor: true, oran: 0 });
  aaYenile();
  ceviriIndir(co.indir, co.kaynak, co.hedef, (o) => {
    co.oran = o;
    const el = S?.katman?.el.querySelector(".aa-ceviri-oran");
    if (el) el.textContent = `Paket iniyor · ${yuzde(o)}`;
  }).then(() => { co.iniyor = false; if (S?.co === co) coMotorBul(co); },
    (e) => { co.iniyor = false; if (S?.co === co) { co.hata = e?.name === "AbortError" ? "İndirme durdu." : hataMetni(e); aaYenile(); } });
}
// Hedef dil, motor tercihi ya da kitabın dili değişti: satır altı çeviri yeniden kurulur ya da kapanır
function ceviriAyarDegisti() {
  const co = S?.co;
  if (!co) return;
  if (kitapDili() === co.kaynak && hedefDil() === co.hedef && (store.ayarlar.ceviri?.motor || "otomatik") === co.tercih) return;
  coKapat();
  if (ceviriVar()) ceviriyleOku(true, { sessiz: true });
  else aaYenile();
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
  const kaldir = h("button", { type: "button", class: "onayli", onclick: () => { katmanKapat(false); vurguSil(v); } }, "Vurguyu kaldır");   // geri alınabilir: anında
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
        aaCeviriBolumu(),
        // Okurken: okuma cetveli (TASARIM-4 4.5) ve dar ekranda notların yeri (2.6)
        h("div", { class: "aa-bolum aa-okurken" }, etiket("Okurken"),
          anahtarSatir("Okuma cetveli", !!tercih.cetvel, (v) => { cetvelAc(v); ciz(); }, "Okunan satırı bir bantla öne çıkarır"),
          tercih.cetvel ? anahtarSatir("Kalemi izlesin", tercih.cetvelKalem !== false, (v) => { tercih.cetvelKalem = v; tercihSakla(); }) : null,
          S.el.ic.classList.contains("oluklu") ? null
            : anahtarSatir("Notları satır altında göster", !!tercih.satirAltiNot, (v) => { tercih.satirAltiNot = v; tercihSakla(); kenarNotlariniCiz(); })),
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
  const tetik = dugme("aa");
  katmanAc(balon, { tur: "aa", tetik, yenile: ciz, kapat: () => aaKaydir(null) });
  balonYerlestir(balon, tetik);
  aaKaydir(balon);
  // Dikeyde Aa alt çekmecedir: Koltuk'un alt çubuğu (cetvel) çekmecenin altında kalmasın, çubuklar çekilir
  if (matchMedia("(orientation: portrait)").matches && S.koltuk?.gorunur()) S.koltuk.cubuk(false);
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
    // Tema silme anında, "Geri al" ile döner (TASARIM-4 3.6)
    const sil = h("button", { type: "button", class: "metin-dugme sil", onclick: () => {
      const i = kayitli.indexOf(hedef);
      if (i < 0) return;
      kayitli.splice(i, 1);
      if (tercih.temaId === hedef.id) tercih.temaId = null;
      temalariSakla();
      durum.duzen = null;
      ciz();
      toast("Tema silindi", { etiket: "Geri al", calistir: () => {
        if (kayitli.includes(hedef)) return;
        kayitli.splice(Math.min(i, kayitli.length), 0, hedef);
        temalariSakla();
        if (S?.katman?.tur === "aa") katmanYenile();
      } });
    } }, "Sil");
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

// Açılır kapanır satır (Aa ve ⋯): role switch, 44 px
function anahtarSatir(metin, acik, fn, aciklama) {
  const b = h("button", { type: "button", class: "anahtar-satir", role: "switch", "aria-checked": String(acik) },
    aciklama ? h("span", { class: "anahtar-metin" }, metin, h("small", {}, aciklama)) : metin, h("span", { class: "anahtar" }));
  b.addEventListener("click", () => { const v = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(v)); fn(v); });
  return b;
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
    // Telefonda mod anahtarı üst çubukta yer kaplamaz: burada (TASARIM-4 2.6)
    S.mod === "koltuk" && telefon() ? satir("masa", "Masa'da aç", "Vurgu, kalem ve kırpma araçları", () => { katmanKapat(); modSec("masa"); }) : null,
    S.mod === "koltuk" ? satir("notlar", "Notlar ve vurgular", `${S.veri.vurgular.length} vurgu, ${S.veri.yerImleri.length} yer imi`, () => { katmanKapat(); panelAc("sag", "notlar"); }) : null,
    S.mod === "koltuk" ? satir("yer-imi", gorunenYerImleri().length ? "Yer imini kaldır" : "Yer imi ekle", null, () => { katmanKapat(); yerImiDegistir(); }) : null,
    // Kaldığın yer (OZELLIKLER-7 §7.3): son iz; iz yoksa satır yok
    sonIz() ? satir("izler", "Son izime git", sonIzMetni(), () => { katmanKapat(); izeGit(sonIz()); }) : null,
    satir("disa-aktar", "Notları dışa aktar", "Vurgular ve kenar notları, Markdown dosyası", () => { katmanKapat(); notlariPaylas(); }),
    // Samsung Notes yalnız Samsung'da; başka yerde sistemin paylaş menüsü
    SAMSUNG ? satir("gonder", "Samsung Notes'a gönder", "Paylaş menüsünde Samsung Notes'u seç", () => { katmanKapat(); notlariPaylas(); })
      : navigator.share ? satir("paylas", "Notları paylaş", "Sistemin paylaş menüsü", () => { katmanKapat(); notlariPaylas(); }) : null].filter(Boolean));
  void tema;
  ciz();
  katmanAc(fis, { tur: "daha", tetik: dugme("daha"), yenile: ciz });
  const kR = S.kap.getBoundingClientRect(), dR = dugme("daha").getBoundingClientRect();
  fis.style.right = Math.max(8, kR.right - dR.right) + "px";
  fis.style.top = dR.bottom - kR.top + 6 + "px";
  // Kısa ekranda (telefon, yatay) menü ekrandan taşmaz, içinde kayar
  fis.style.maxHeight = `calc(100% - ${Math.round(dR.bottom - kR.top + 6)}px - 12px - env(safe-area-inset-bottom, 0px))`;
  fis.style.overflowY = "auto";
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
  // Kısa ekranda (telefon, yatay) menü ekrandan taşmaz, içinde kayar
  fis.style.maxHeight = `calc(100% - ${Math.round(dR.bottom - kR.top + 6)}px - 12px - env(safe-area-inset-bottom, 0px))`;
  fis.style.overflowY = "auto";
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
    git: (oran) => { const d = donusHazirla(); oranaGit(oran); d?.(); },
    etiket: (oran) => {
      const hedef = sinirla(oran, 0, 1) * TOPLAM;
      const b = BOLUMLER.find((x) => x.onceki + x.kelime > hedef) || BOLUMLER[BOLUMLER.length - 1];
      return `${yuzde(oran)} · Bölüm ${b.i + 1}`;
    },
    cevir: (yon) => koltukCevir(yon),
    modDegistir: (m) => modSec(m),
    araclar: [el.kAra, el.kIcindekiler, el.kAa, el.kDisa, el.kDaha],
    altAraclar: [el.tIcindekiler, el.tAra, el.tIzler, el.tKalem],
    anahtarDaha: true,   // telefonda mod anahtarı ⋯ içinde
    sahne: el.kaydir,
    izler: () => izOranlari(),
    izeGit: (id) => { const z = S?.veri.izler.find((x) => x.id === id); if (z) izeGit(z); },
    izAtla: (yon) => izAtla(yon),
    // EPUB'da kalem araç seçmeden yazar. S Pen'de yan tuş siler; başka kalemde (Apple Pencil) kalem ucu düğmesi kalem
    // görülünce belirir ve tepsiyi açar: tek dokunuşla silgi (OZELLIKLER-7 §3).
    kalemUcu: !SAMSUNG,
    kalem: (acik) => { if (acik) kalemTepsisi({ parmak: false }); else kalemTepsisiKapat({ sessiz: true }); },
    sure: (sn) => oduncSay(sn),
    mesgul: () => !!(S && (S.katman || S.menu || S.el.aramaSatiri || (S.panel && dar()) || S.aktif || S.tepsi)),
    // Boşluk açan ya da içine yazan kalem sayfa çevirmez; yazarken konan nokta (ünlemin noktası) da çevirmez.
    // Parmakla yazarken (telefonda Kalem) dokunuş sayfa çevirmez: parmak yazar, çıkış tepsideki "Bitti".
    dokunmaGecerli: (e) => !S || (S.yut !== e.pointerId && !(S.parmakKalem && e.pointerType === "touch")
      && !(e.pointerType === "pen" && performance.now() - S.sonCizimZ < IZ_BIRLESME * 2)),
  });
  S.olcum = null;
  if (S.yer) durumGuncelle();
  // Açılışta çubuklar bir kez görünür: nerede olduğunu ve modu gösterir, 4 sn sonra çekilir
  zamanla(() => S?.koltuk?.cubuk(true), ilk ? 360 : 0);
}
function koltukKapat() {
  kalemTepsisiKapat({ sessiz: true, birak: true });
  oduncYaz();
  S.koltuk?.kapat();
  S.koltuk = null;
  S.kKonum = null;
}

// Kenar dokunuşu: sayfa sayfa çevirir. İleride yeni sayfa, gizlenen ilk satırdan başlar; geride bir önceki sayfa
// tam şimdiki ilk satırın üstünde biter. Kaydırma anında olur (ardışık çevirmede hedef hep doğru, bekleme yok);
// his yalnız içeriğin 180 ms'lik ince kayması ve solmasıdır (transform ve opacity).
// Solma metnin üstündeki zemin renkli bir perdeyle olur, görünüşü aynı: metin katmanının kendi opaklığı her
// çevirmede bütün ağacın boyama özelliklerini yeniden yürütüyordu (7500 paragrafta iki karede 45'er ms).
function cevirPerdesi() {
  if (!S.el.cevirPerde?.isConnected) {
    S.el.cevirPerde = h("div", { class: "cevir-perde", "aria-hidden": "true",
      style: "position:absolute;inset:0;z-index:0;pointer-events:none;background:var(--zemin);opacity:0" });
    S.el.kaydir.after(S.el.cevirPerde);   // kaydırıcının üstünde, sayfa kenarı ve çubukların altında
  }
  return S.el.cevirPerde;
}
function koltukCevir(yon) {
  const kay = S.el.kaydir;
  menuKapat();
  katmanKapat();
  islakAktar();
  const st = kay.scrollTop, H = kay.clientHeight;
  let hedef = st + yon * (H - kUst() - kAlt());
  if (S.yer) {
    const s = koltukSinir();
    if (yon > 0) hedef = st + s.alt - kUst();
    else {
      // Önceki sayfa şimdiki ilk satırda biter; üst kenarda kesilen satır aşağı, blok (başlık) yukarı oturur
      const y = st + s.ust - (H - kAlt() - kUst()), r = kesim(satirAl(y));
      hedef = (y - r.ust > 0.5 && !r.blok ? r.alt : r.ust) - kUst();
      if (hedef >= st) hedef = y - kUst();
    }
    if (yon > 0 && hedef <= st + S.yer.lh) hedef = st + H - kUst() - kAlt();
  }
  hedef = sinirla(Math.round(hedef), 0, kay.scrollHeight - H);
  if (hedef === st) return;
  kay.scrollTop = hedef;
  koltukMaske();   // kaydırma olayını beklemeden: yeni sayfa ilk karede doğru kenarlarla
  cetvelIlkSatir();   // okuma cetveli yeni sayfanın ilk satırına
  if (hareketAz()) return;
  // Kayma Aa'nın sütun kaydırmasının üstüne eklenir (add); opaklık eklenirse 1'i aşıp kırpılır, ayrı ve yerine
  for (const a of S.cevirAnim || []) a.cancel();
  const zaman = { duration: 180, easing: "cubic-bezier(.2,.7,.25,1)" };
  S.cevirAnim = [cevirPerdesi().animate([{ opacity: 0.5 }, { opacity: 0 }], zaman)];
  // Kayma yalnız kısa kitapta: uzun kitapta bütün metin katmanı her çevirmede baştan boyanıyordu
  // (1500 paragrafta yavaş tablette çevirme başına yaklaşık 200 ms). Solma tek başına ucuz.
  if (P.length <= KAYAN_CEVIRME) {
    S.cevirAnim.push(S.el.ic.animate([{ transform: `translateX(${yon * 14}px)` }, { transform: "translateX(0)" }], { ...zaman, composite: "add" }));
  }
}
// Kaldığın yer (TASARIM-4 3.4): içindekilerden ya da cetvelden uzağa atlayınca altta 4 sn "Kaldığın yer" ve "Dön".
// Atlamadan önce çağrılır, dönen işlev atlamadan sonra.
function donusHazirla() {
  if (!S?.yer || typeof ortak.donusFisi !== "function") return null;
  const k = konumAl(), y0 = S.el.kaydir.scrollTop;
  return () => {
    if (!S?.yer || Math.abs(S.el.kaydir.scrollTop - y0) < S.el.kaydir.clientHeight * 1.5) return;
    ortak.donusFisi({ metin: `Kaldığın yer: ${folyo(k.p, Math.round(sinirla(k.oran, 0, 1) * P[k.p].metin.length))}`,
      calistir: () => { if (!S) return; konumaGit(k); S.olcum = null; durumGuncelle(); } });
  };
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
function hizOlc(okunan, st, H) {
  const ekran = okunanKelime(konumAl(st + UST + H * 0.85)) - okunan;
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
    if (document.hidden) { tercihSakla(); oduncYaz(); }   // Android arka plandaki PWA'yı kapatırken pagehide gelmeyebilir
    const c = S?.cf;
    if (!document.hidden && c?.durum === "donus" && !c.vurgula) { c.vurgula = true; cfCiz(c); }
    const a = S?.anlam;
    if (document.hidden || !a || a.durum !== "donus" || a.vurgula) return;
    a.vurgula = true;
    anlamCiz(a);
  }, { signal: sinyal });
  // Çeviri: hedef dil, motor tercihi ya da kitabın dili değişince; paket inince bekleyen satır altı çeviri başlar
  S.bus.push(bus.on("ayarlar", () => ceviriAyarDegisti()));
  S.bus.push(bus.on("belgeler", () => ceviriAyarDegisti()));
  S.bus.push(bus.on("ceviri", (o) => {
    if (o?.durum === "yuklu") motorBilgi.clear();
    const co = S?.co;
    if (co?.durum === "motor-yok" && !co.iniyor && o?.durum === "yuklu") coMotorBul(co);
  }));
  S.bus.push(bus.on("kirpintilar", (e) => { if (S && e?.tur !== "not" && S.panel === "sag" && S.sekme === "kirpintilar") panelYenile(); }));
  // Ex libris Ayarlar'da yeniden çizilince iç kapaktaki mühür de yenilenir (yeniden basılmaz)
  S.bus.push(bus.on("exlibris", () => { if (S) { exLibrisKur(); S.exBekliyor = false; } }));
  S.bus.push(bus.on("ayarlar", () => { if (S && (!!S.el.exLibris) !== (store.ayarlar.exLibrisGoster !== false)) { exLibrisKur(); S.exBekliyor = false; } }));
  // Hızlı erişim (Ctrl+K) komutları: kabuğun listesine eklenir, kitap kapanınca çıkar (TASARIM-4 3.2)
  if (typeof ortak.komutEkle === "function") {
    const mumGec = () => {
      if (!S) return;
      if (S.sayfa === "mum") sayfaSec(S.mumOncesi || "oto");
      else { S.mumOncesi = sayfaHam() === "koyu" ? "gece" : sayfaHam(); sayfaSec("mum"); }
    };
    for (const k of [
      { id: "koltuk-mum", ad: "Mum ışığı", es: "gece okuması sıcak sayfa rengi", ikon: "tema-koyu", baglam: "epub", calistir: mumGec },
      { id: "koltuk-cetvel", ad: "Okuma cetveli", es: "satır bandı odak disleksi", ikon: "satir-orta", baglam: "epub", calistir: () => S && cetvelAc(!tercih.cetvel) },
      { id: "koltuk-son-iz", ad: "Son izime git", es: "kaldığın yer iz", ikon: "izler", baglam: "epub", kosul: () => !!sonIz(), calistir: () => { const z = sonIz(); if (z) izeGit(z); } },
    ]) {
      try { S.bus.push(ortak.komutEkle(k)); } catch { /* komut listesi yok */ }
    }
  }
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
// Koltuk'ta kalem tepsisinden silgi seçildiyse (Apple Pencil) kalem siler; parmakla yazarken tepsinin silgisi parmağı siler.
const silgiTusu = (e) => (e.pointerType === "pen" && (!!(e.buttons & 32) || (!!(e.buttons & 2) && store.ayarlar.yanTusSilgi !== false)
  || (S?.mod === "koltuk" && !!S.kalemSilgi))) || (e.pointerType === "touch" && S?.mod === "koltuk" && S.parmakKalem === "silgi");
const basinc = (q) => (q.pointerType === "pen" ? (ortak.basincUygula ? ortak.basincUygula(q.pressure || 0.5) : q.pressure || 0.5) : 0.5);
function geciciSilgi(acik) {
  S.el.silgi.classList.toggle("gecici-etkin", acik);
  for (const b of S.el.kalemler) b.classList.toggle("dinlen", acik && b.dataset.arac === S.arac);
}

function isaretciBasti(e) {
  S.sonIsaretci = e.pointerType;
  S.yut = null;
  if (e.pointerType === "pen") { kalemAlgilandi(); kalemYakin(); S.sonKalemZ = performance.now(); havaBitti(); }
  // Telefonda parmakla yazma (kalem tepsisi): ilk parmak yazar. İkinci parmak gelirse az önce başlayan çizgi iptal olur,
  // iki parmak dokunuşu geri al olarak sayılır.
  if (S.mod === "koltuk" && e.pointerType === "touch" && S.parmakKalem) {
    cokParmakBasti(e);
    const a = S.aktif;
    if (a) {
      if (a.parmak && performance.now() - a.t0 < 260) { a.iptal = true; a.karar = "iptal"; clearTimeout(a.kararZ); S.canli.temizle(); }
      e.preventDefault();
      return;
    }
    if (e.isPrimary) tuvalBasti(e, true);
    return;
  }
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
  const g = S.parmak || (S.parmak = { noktalar: new Map(), ilk: new Map(), enCok: 0, t0: performance.now(), yol: 0, v: 0, iz: [] });
  g.noktalar.set(e.pointerId, e.clientY);
  g.ilk.set(e.pointerId, [e.clientX, e.clientY]);
  (g.son || (g.son = new Map())).set(e.pointerId, [e.clientX, e.clientY]);
  g.enCok = Math.max(g.enCok, g.noktalar.size);
  try { S.el.kaydir.setPointerCapture(e.pointerId); } catch { /* işaretçi çoktan bırakıldıysa yakalama gerekmez */ }
}
function parmakOynadi(e) {
  const g = S.parmak, once = g.noktalar.get(e.pointerId);
  g.noktalar.set(e.pointerId, e.clientY);
  // Jest için her parmağın iki eksendeki hareketi: ilk parmak dururken ikincisiyle kıstırma geri al sayılmasın
  const o = g.son?.get(e.pointerId);
  if (o) { g.hareket = (g.hareket || 0) + Math.hypot(e.clientX - o[0], e.clientY - o[1]); g.son.set(e.pointerId, [e.clientX, e.clientY]); }
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
  if (g.enCok >= 2 && sure < 300 && (g.hareket ?? g.yol) < 12) {
    if (S.mod === "koltuk") return;   // Koltuk'ta çok parmak jestini yalnız cokParmakKalkti tanır: iki kez geri alınmasın
    if (!parmakGeriBildirim([...(g.ilk?.values() || [])], g.enCok > 2)) { if (g.enCok === 2) geriAl(); else yinele(); }
    return;
  }
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
    // Formülün görünmez düz metnine düşen öğe formülün önüne konur (içinde görünmezdi)
    const kap = k < d.length && d.parentElement?.closest(".formul-kap");
    if (kap) { kap.before(el); return; }
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
function tuvalBasti(e, parmak = false) {
  const kalem = e.pointerType === "pen" || parmak, fare = e.pointerType === "mouse" && e.button === 0;
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
    tuval: r, acilis, yalnizTuval: S.mod === "koltuk", t0: performance.now(), parmak: e.pointerType === "touch",
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
  const parmak = e.pointerType === "touch";   // telefonda parmakla yazma
  const a = S.aktif = {
    id: e.pointerId, tur: parmak ? "touch" : "pen", arac: "kalem", R, s, kaydir0: S.el.kaydir.scrollTop, bas: nokta,
    iz: true, bosluk, yalnizTuval: true, t0: performance.now(), parmak,
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
  if (S?.aktif !== a || a.karar || a.iptal) return;
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
    bosta(() => { if (!S) return; if (S.aktif) izPlanla(); else izleriSiniflandir(); }, 500);
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
  const ust = kay.scrollTop + (S.mod === "koltuk" ? kUst() : ustPay()), alt = kay.scrollTop + kay.clientHeight - (S.mod === "koltuk" ? kAlt() : 0);
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

// Son bırakılan iz (⋯ "Son izime git", OZELLIKLER-7 §7.3)
function sonIz() {
  if (!S) return null;
  let son = null;
  for (const z of S.veri.izler) if (izGecerli(z) && (!son || (z.zaman || 0) >= (son.zaman || 0))) son = z;
  return son;
}
function sonIzMetni() {
  const z = sonIz();
  if (!z) return null;
  const m = (z.metin || "").trim();
  return m ? `“${m.length > 36 ? m.slice(0, 36) + "…" : m}”` : `Kitapta ${folyo(z.bas.p, z.bas.o || 0)}`;
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
  // Okuma cetveli havadaki kalemin satırını izler (Aa > "Kalemi izlesin")
  if (S.el.cetvel && tercih.cetvelKalem !== false) cetvelYerlestir((r.ust + r.alt) / 2 - S.el.kaydir.scrollTop, { oturt: false });
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
  if (!S.cp || !S.cp.ids.size) S.cp = { ids: new Map(), ilk: new Map(), t0: performance.now(), enCok: 0, yol: 0, iptal: false };
  S.cp.ids.set(e.pointerId, [e.clientX, e.clientY]);
  S.cp.ilk.set(e.pointerId, [e.clientX, e.clientY]);
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
  // Halka ve fiş: ne olduğu görünsün (TASARIM-4 4.6); geri alınacak bir şey yoksa halkalar soluk
  const bos = parmakGeriBildirim([...g.ilk.values()], g.enCok > 2);
  if (bos) return;
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
  // Telefonda sütunun sağında 20 px var: kurdele metne değmesin, çentiğin içine de girmesin (TASARIM-4 2.6)
  el.style.left = Math.min(sol + s * BIRIM + 20, icGen - (telefon() ? 12 + guvenliAlan().sag : 24)).toFixed(1) + "px";
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
  // Formülün görünen kutusu gölge DOM'da; ışık DOM'daki düz metni 1 px'liktir
  for (const k of S.el.sutun.querySelectorAll(".formul-kap")) if (r.intersectsNode(k)) qs.push(k.getBoundingClientRect());
  if (!qs.length) return;
  const y0 = Math.min(...qs.map((q) => q.top)) - icR.top - 10, y1 = Math.max(...qs.map((q) => q.bottom)) - icR.top + 10;
  kirpYap({ x: sR.left - icR.left - 16, y: y0, w: sR.width + 32, h: y1 - y0 }, bas.p);
}

// ap: bağlanacak paragraf; verilmezse alanın üst kısmındaki paragraf (düzen değişince kırpıntı onunla kayar)
// Görsel formül varsa bir an sonra hazır olur (formulGoruntusu): kırpıntı o zaman eklenir, flaş hemen çakar.
async function kirpYap(r, ap = yakinParagraf(r.y + Math.min(r.h / 2, 24))) {
  const S0 = S, { s, sol, pUst } = S.yer;
  const alan = { belgeId: S.belge.id, belgeAd: S.belge.ad, sayfa: Math.floor(P[ap].onceki / SAYFADA) + 1, not: "" };
  const okuma = { ap, x: (r.x - sol) / s, y: (r.y - pUst[ap]) / s, w: r.w / s, h: r.h / s };
  // Flaş, baskının uçuşu, hedefin karşılaması, bildirim
  const icR = S.el.ic.getBoundingClientRect(), oR = S.el.okuma.getBoundingClientRect();
  const ekran = { left: icR.left + r.x, top: icR.top + r.y, width: r.w, height: r.h };
  const t0 = performance.now();
  if (!hareketAz()) {
    const flas = h("div", { class: "kirp-flas", style: `inset:auto;left:${ekran.left - oR.left}px;top:${ekran.top - oR.top}px;width:${r.w}px;height:${r.h}px` });
    S.el.okuma.append(flas);
    zamanla(() => flas.remove(), 340);
  }
  const gorsel = await bolgeGorsel(r);
  const k = kirpintiEkle({ gorsel, ...alan });
  k.okuma = okuma;
  if (S !== S0) return;
  if (!hareketAz()) zamanla(() => kirpUcur(gorsel, ekran), Math.max(0, 190 - (performance.now() - t0)));
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
// r: .okuma-ic içinde piksel dikdörtgen. Birim başına 2 piksel. Formüller (gölge DOM'daki MathML) görüntüye
// çevrilip yerine konur; olmazsa düz karşılıkları yazılır. Ölçümler beklemeden önce alınır.
async function bolgeGorsel(r) {
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
  // 5) formüller
  const formuller = [];
  for (const kap of S.el.sutun.querySelectorAll(".formul-kap")) {
    const m = kap.shadowRoot?.querySelector("math"), q = m?.getBoundingClientRect();
    if (!q || !kesisir(q)) continue;
    const st = getComputedStyle(kap);
    formuller.push({ m, q, duz: kap.textContent, renk: st.color, boyut: parseFloat(st.fontSize) || 16, font: `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}` });
  }
  const s = S.yer.s, cizgiler = gorunenCizgiler(r.y, r.y + r.h);
  if (formuller.length) {
    const resimler = await Promise.all(formuller.map((f) => formulGoruntusu(f.m, { w: f.q.width, h: f.q.height, renk: f.renk, boyut: f.boyut, olcek: O })));
    formuller.forEach((f, i) => {
      if (resimler[i]) { g.drawImage(resimler[i], f.q.left, f.q.top, f.q.width, f.q.height); return; }
      g.font = f.font; g.fillStyle = f.renk; g.letterSpacing = "0px"; g.textBaseline = "middle";
      g.fillText(f.duz, f.q.left, f.q.top + f.q.height / 2, Math.max(f.q.width, 8));
      g.textBaseline = "alphabetic";
    });
  }
  // 6) mürekkep: ekrandaki gibi sayfayla çarpılarak
  g.setTransform(O * s, 0, 0, O * s, -r.x * O, -r.y * O);
  g.globalCompositeOperation = koyu ? "screen" : "multiply";   // ekrandaki CSS karışımıyla aynı
  for (const c of cizgiler) {
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
    if (!el || el.closest("svg, button.metin-dugme, .formul-kap")) continue;   // formülün görünmez düz metni: bolgeGorsel 5
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

// ---------- kalem tepsisi (OZELLIKLER-7 §3 ve §4, TASARIM-4 2.6) ----------
// Apple Pencil'da yan tuş yok: silgi buradan tek dokunuşla seçilir, seçim oturum boyunca kalır. Telefonda (kalem yoksa)
// tepsi parmakla yazmayı açar: o sırada parmak sayfa çevirmez ve kaydırmaz, iki parmak geri alır, çıkış "Bitti".
const izKalemAdi = () => (S.sonKalem?.startsWith("kalem") ? S.sonKalem : "kalem0");
function kalemTepsisi({ parmak = false } = {}) {
  if (S.tepsi && S.tepsi.parmak === parmak && !parmak) return kalemTepsisiKapat();
  if (S.tepsi?.parmak && !parmak) { S.koltuk?.kalemKapat?.(); return; }   // parmakla yazarken tepsi zaten açık
  katmanKapat(); menuKapat();
  S.tepsi?.el.remove();
  const el = h("div", { class: "kalem-tepsi" + (parmak ? " parmak" : ""), role: "toolbar", "aria-label": parmak ? "Parmakla yaz" : "Kalem ucu" });
  S.tepsi = { el, parmak };
  if (parmak) {
    S.parmakKalem ||= "kalem";
    S.kap.classList.add("parmak-kalem");
    S.el.tKalem.setAttribute("aria-pressed", "true");
  }
  const sec = (fn) => () => { fn(); kalemUcuGuncelle(); ciz(); if (!parmak) zamanla(() => kalemTepsisiKapat(), 160); };
  const ciz = () => {
    const silgi = parmak ? S.parmakKalem === "silgi" : !!S.kalemSilgi, secili = izKalemAdi();
    el.replaceChildren(
      ...tercih.kalemler.map((k, i) => {
        const ad = "kalem" + i;
        const b = h("button", { type: "button", class: "tepsi-kalem", "aria-pressed": String(!silgi && secili === ad), "aria-label": KALEM_ADI[k.tur] || "Kalem",
          onclick: sec(() => { S.sonKalem = ad; if (parmak) S.parmakKalem = "kalem"; else S.kalemSilgi = false; }) });
        b.innerHTML = KALEM_SVG[k.tur] || KALEM_SVG.tukenmez;
        b.style.setProperty("--tip", k.renk);
        return b;
      }),
      h("span", { class: "ayrac", "aria-hidden": "true" }),
      h("button", { type: "button", class: "tepsi-silgi", "aria-pressed": String(silgi), "aria-label": "Silgi",
        onclick: sec(() => { if (parmak) S.parmakKalem = "silgi"; else S.kalemSilgi = true; }) }, icon("silgi")),
      ...(parmak ? [h("button", { type: "button", class: "metin-dugme tepsi-bitti", onclick: () => kalemTepsisiKapat({ birak: true }) }, "Bitti")] : []));
  };
  ciz();
  S.kap.append(el);
  if (!parmak) {   // kalem ucu düğmesinin üstünde; dışarı dokununca kapanır, seçim kalır
    const kapat = (e) => { if (!S?.tepsi || S.tepsi.el !== el) return; if (!el.contains(e.target) && !e.target.closest?.(".kalem-ucu")) kalemTepsisiKapat(); };
    document.addEventListener("pointerdown", kapat, { capture: true, signal: S.sinyal });
    S.tepsi.birak = () => document.removeEventListener("pointerdown", kapat, { capture: true });
  }
}
// birak: parmakla yazma da biter. sessiz: koltuk.js'e haber verilmez (kapatan o).
function kalemTepsisiKapat({ birak = false, sessiz = false } = {}) {
  if (!S) return;
  const t = S.tepsi;
  if (t) { t.birak?.(); t.el.remove(); S.tepsi = null; }
  if (birak || (t && !t.parmak)) {
    if (birak && S.parmakKalem) {
      S.parmakKalem = null;
      S.kap.classList.remove("parmak-kalem");
      S.el.tKalem?.setAttribute("aria-pressed", "false");
    }
  }
  if (!sessiz && t && !t.parmak) S.koltuk?.kalemKapat?.();
}
// Kalem ucu düğmesi seçili ucu gösterir: silgi seçiliyse silgi simgesi (kalem kâğıda değmeden ne yapacağı bilinsin)
function kalemUcuGuncelle() {
  const b = S.koltuk?.el?.kalemUcu;
  if (!b) return;
  const silgi = !!S.kalemSilgi;
  if (b.dataset.uc !== String(silgi)) { b.dataset.uc = String(silgi); b.replaceChildren(icon(silgi ? "silgi" : "kalem-ucu")); }
  b.classList.toggle("silgide", silgi);
  b.title = silgi ? "Kalem silgide. Kalem için dokun." : "Kalem ucu";
}

// ---------- iki ve üç parmak: görsel geri bildirim (TASARIM-4 4.6) ----------
// Dokunulan yerlerde söner halkalar ve altta kısa fiş. Kabuğun sınıfları (.parmak-halka, .geri-fis); okuma.css'te yedek.
function parmakGeriBildirim(noktalar, yineleme) {
  const bos = yineleme ? !S.gecmis.yinelenebilir : !S.gecmis.geriAlinabilir;
  if (typeof ortak.parmakGeriBildirim === "function") {   // kabuk ortak bir tane verirse o
    try { ortak.parmakGeriBildirim({ noktalar, yineleme, bos, yinele: () => S && yinele() }); return bos; } catch { /* yerel yedek */ }
  }
  for (const [x, y] of noktalar) {
    const r = h("i", { class: "parmak-halka" + (bos ? " bos" : ""), "aria-hidden": "true", style: `left:${x}px;top:${y}px` });
    document.body.append(r);
    setTimeout(() => r.remove(), 400);
  }
  S.geriFis?.remove();
  const metin = bos ? (yineleme ? "Yinelenecek bir şey yok" : "Geri alınacak bir şey yok") : yineleme ? "Yinelendi" : "Geri alındı";
  const fis = S.geriFis = h("div", { class: "geri-fis", role: "status" }, h("span", {}, metin));
  if (!bos && !yineleme) fis.append(h("button", { type: "button", class: "metin-dugme", onclick: () => { fis.remove(); if (S) yinele(); } }, "Yinele"));
  document.body.append(fis);
  zamanla(() => fis.remove(), bos || yineleme ? 1200 : 2400);
  return bos;
}

// ---------- ödünç kartı (OZELLIKLER-7 §6.3, TASARIM-4 4.3) ----------
// Okuma süresi koltuk.js'in saatinden gelir: sayfa görünür ve son etkileşimden 90 sn geçmemişken. 15 sn'de bir kabuğun
// sayacına (ortak.okumaSay: belge.odunc, kitaplık kartındaki sayaçla aynı kayıt) yazılır; kabuk yoksa veri.odunc'a.
// Kitabın sonunda, arka kapağın içinde eski kütüphane kartı: her okuma günü bir damga, toplam süre, bittiyse bordo damga.
const AYLAR = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"];
const gunAnahtari = (t = new Date()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const GUN_DESEN = /^\d{4}-\d\d-\d\d$/;
const kabukOdunc = () => typeof ortak.okumaSay === "function";
// Yedek kayıt (kabuk sayacı yoksa)
function oduncVeri() {
  const o = S.veri.odunc;
  if (o && typeof o === "object" && o.gunler && typeof o.gunler === "object") return o;
  return (S.veri.odunc = { gunler: {}, bitti: o?.bitti || null });
}
// { gunler: [[gün, sn]] eskiden yeniye, bitti: "YYYY-AA-GG" | null }
function oduncOku() {
  const o = kabukOdunc() && typeof ortak.oduncOzet === "function" ? ortak.oduncOzet(S.belge) : null;
  const ham = o ? { gunler: Object.fromEntries(o.gunler), bitti: o.bitti } : S.veri.odunc || {};
  const gunler = Object.entries(ham.gunler || {}).filter(([k, sn]) => GUN_DESEN.test(k) && sn > 0).sort(([x], [y]) => (x < y ? -1 : 1));
  const b = ham.bitti;
  return { gunler, bitti: typeof b === "number" && b > 0 ? gunAnahtari(b) : typeof b === "string" && GUN_DESEN.test(b) ? b : null };
}
function oduncSay(sn) {
  if (!S || store.ayarlar.oduncKarti === false) return;
  S.oduncBirikim = (S.oduncBirikim || 0) + sn;
  if (S.oduncBirikim >= 15) oduncYaz();
}
function oduncYaz() {
  if (!S || !(S.oduncBirikim > 0)) return;
  if (kabukOdunc()) {
    try { ortak.okumaSay(S.belge.id, S.oduncBirikim * 1000); S.oduncBirikim = 0; return; } catch { /* yedek kayda */ }
  }
  const n = Math.floor(S.oduncBirikim);
  if (n < 1) return;
  S.oduncBirikim -= n;
  const g = oduncVeri().gunler, k = gunAnahtari();
  g[k] = (g[k] || 0) + n;
}
function oduncBitti() {
  if (typeof ortak.okumaBitti === "function") { if (!S.belge.odunc?.bitti) ortak.okumaBitti(S.belge.id); }
  else oduncVeri().bitti ||= gunAnahtari();
}
// Kimlik ve tarihten türeyen sabit küçük sapma: damgalar her açılışta aynı yerde, el basmış gibi
function sapma(metin, a, b) {
  let x = 2166136261;
  for (let i = 0; i < metin.length; i++) x = Math.imul(x ^ metin.charCodeAt(i), 16777619);
  return a + ((x >>> 0) % 1000) / 1000 * (b - a);
}
function sureDamga(sn) {
  const dk = Math.max(1, Math.round(sn / 60));
  return dk < 60 ? `${dk} DK` : `${Math.floor(dk / 60)} SA ${dk % 60} DK`;
}
function oduncKarti({ gunler: hepsi, bitti }) {
  const gunler = hepsi.filter(([, sn]) => sn >= 30);
  const toplam = gunler.reduce((t, [, sn]) => t + sn, 0), bugun = gunAnahtari();
  const damga = (k, metin) => h("span", { class: "odunc-damga" + (k === bugun && S.oduncBas ? " basiliyor" : ""),
    style: `--a:${sapma(S.belge.id + k, -1.5, 1.5).toFixed(2)}deg;--x:${sapma(k + S.belge.id, -3, 3).toFixed(1)}px;--o:${sapma(k, 0.7, 0.92).toFixed(2)}` }, metin);
  const satir = ([k, sn]) => { const [y, a, g] = k.split("-"); return [damga(k, `${g} ${AYLAR[+a - 1]} ${y}`), damga(k, sureDamga(sn))]; };
  const liste = gunler.length > 12 ? [...gunler.slice(0, 6).map(satir), [h("span", { class: "odunc-ara" }, "· · ·"), h("span")], ...gunler.slice(-5).map(satir)] : gunler.map(satir);
  return h("div", { class: "odunc-cep", role: "group", "aria-label": `Kitap kartı: ${gunler.length} gün, toplam ${sureDamga(toplam).toLocaleLowerCase("tr")}` },
    h("div", { class: "odunc-kart" },
      h("h4", {}, "Kitap kartı"),
      h("p", { class: "kitap" }, KITAP.baslik || S.belge.ad),
      gunler.length ? h("div", { class: "odunc-satirlar" }, ...liste.flat())
        : h("p", { class: "odunc-bos" }, "Okudukça günler buraya damgalanır."),
      gunler.length ? h("div", { class: "odunc-toplam" }, h("span", {}, "Toplam"), h("span", {}, sureDamga(toplam))) : null,
      bitti ? h("span", { class: "odunc-bitti" }, `BİTTİ ${bitti.slice(8, 10)}.${bitti.slice(5, 7)}.${bitti.slice(2, 4)}`) : null));
}
// Kart yalnız içeriği değişince yeniden kurulur (dakika, gün, bitiş); kitabın sonu görünürken günün damgası bir kez basılır
function oduncGuncelle(gorunur = false) {
  const yer = S.el.odunc;
  if (!yer) return;
  if (store.ayarlar.oduncKarti === false || S.mod !== "koltuk") { if (yer.firstChild) { yer.replaceChildren(); S.oduncImza = ""; } return; }
  const o = oduncOku(), bugun = o.gunler.find(([k]) => k === gunAnahtari())?.[1] || 0;
  if (gorunur && !S.oduncBasildi && bugun >= 30 && !hareketAz()) { S.oduncBasildi = true; S.oduncBas = true; S.oduncImza = ""; }
  const imza = `${o.gunler.length}|${Math.round(bugun / 60)}|${o.bitti || ""}|${S.oduncBas ? 1 : 0}`;
  if (imza === S.oduncImza) return;
  S.oduncImza = imza;
  yer.replaceChildren(oduncKarti(o));
  S.oduncBas = false;
}

// ---------- ex libris: iç kapakta kitap mührü (OZELLIKLER-7 §6.1, TASARIM-4 4.1) ----------
// Mührü kabuk çizdirir (Ayarlar > Ex libris) ve ortak.exLibrisSvg verir. Kitabın ilk sayfasında, bölüm açılışının
// boşluğunda durur; kitap ilk açıldığında ve o sayfa göründüğünde bir kez basılır (belge.veri.exLibrisBasildi).
function exLibrisKur() {
  S.el.exLibris?.remove();
  S.el.exLibris = null;
  const ex = store.ayarlar.exLibris;
  const var_ = typeof ortak.exLibrisVar === "function" ? ortak.exLibrisVar(ex) : !!ex?.vuruslar?.length;
  if (!var_ || typeof ortak.exLibrisSvg !== "function" || store.ayarlar.exLibrisGoster === false) return;
  const aci = typeof ortak.exLibrisAci === "function" ? ortak.exLibrisAci(S.belge.id) : sapma(S.belge.id, -6, -2);
  let svg = "";
  try { svg = ortak.exLibrisSvg(72, ex, { aci: 0 }); } catch (e) { console.warn("[kenar-notu] ex libris çizilemedi:", e); return; }
  const el = h("span", { class: "ex-libris", "aria-hidden": "true" });
  if (typeof svg === "string" && svg) el.innerHTML = svg; else if (svg instanceof Node) el.append(svg); else return;
  el.style.setProperty("--aci", aci.toFixed(2) + "deg");   // eğim CSS'te: basılma animasyonu aynı açıyla oturur
  const acilis = S.el.sutun.querySelector(".bolum-acilis");
  if (!acilis) return;
  acilis.append(el);
  S.el.exLibris = el;
  S.exBekliyor = !S.veri.exLibrisBasildi;
}
function exLibrisBas() {
  if (!S.exBekliyor || !S.el.exLibris || S.el.kaydir.scrollTop > S.el.kaydir.clientHeight * 0.5) return;
  S.exBekliyor = false;
  S.veri.exLibrisBasildi = true;
  if (hareketAz()) return;
  S.el.exLibris.classList.add("basiliyor");
  zamanla(() => S?.el.exLibris?.classList.remove("basiliyor"), 700);
}

// ---------- okuma cetveli (OZELLIKLER-7 §6.5, TASARIM-4 4.5) ----------
// Okunan satır bir bantla öne çıkar, üstü ve altı hafifçe solar. Tutamaktan parmak ya da kalemle sürüklenir, bırakınca
// en yakın satıra oturur; sayfa çevrilince sayfanın ilk satırına döner; havadaki kalem satırların üstünde gezerken onu
// izler. Kalem temastayken kıpırdamaz, altına yazılabilir (pointer-events yok, yalnız tutamak dokunulur).
function cetvelAc(acik) {
  tercih.cetvel = !!acik;
  tercihSakla();
  if (acik) cetvelKur(); else { S.el.cetvel?.remove(); S.el.cetvel = null; }
}
function cetvelKur() {
  if (!tercih.cetvel || S.el.cetvel || !S.yer) return;
  const tut = h("span", { class: "tutamak", role: "slider", tabindex: "0", "aria-label": "Okuma cetveli: yukarı ve aşağı oklarla satır satır", "aria-orientation": "vertical" });
  const el = S.el.cetvel = h("div", { class: "okuma-cetveli" }, h("i", { class: "bant", "aria-hidden": "true" }), tut);
  S.el.okuma.append(el);
  tut.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try { tut.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
    const R = S.el.okuma.getBoundingClientRect(), id = e.pointerId;
    el.classList.add("surukleniyor");
    const oyna = (q) => { if (q.pointerId === id) cetvelYerlestir(q.clientY - R.top, { oturt: false }); };
    const birak = (q) => {
      if (q.pointerId !== id) return;
      el.classList.remove("surukleniyor");
      cetvelYerlestir(q.clientY - R.top);
      tut.removeEventListener("pointermove", oyna);
      tut.removeEventListener("pointerup", birak);
      tut.removeEventListener("pointercancel", birak);
    };
    tut.addEventListener("pointermove", oyna);
    tut.addEventListener("pointerup", birak);
    tut.addEventListener("pointercancel", birak);
  }, { signal: S.sinyal });
  tut.addEventListener("keydown", (e) => {
    const yon = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!yon) return;
    e.preventDefault();
    e.stopPropagation();
    cetvelYerlestir((S.cetvelY ?? 0) + yon * S.yer.lh);
  }, { signal: S.sinyal });
  cetvelIlkSatir();
}
// y: bandın ortası, .okuma'ya göre. oturt: en yakın satırın ortasına (blok ve paragraf arası olduğu gibi kalır)
function cetvelYerlestir(y, { oturt = true } = {}) {
  const el = S.el.cetvel;
  if (!el || !S.yer) return;
  const kay = S.el.kaydir, H = kay.clientHeight;
  let yy = sinirla(y, 0, H);
  if (oturt) {
    const r = satirAl(yy + kay.scrollTop);
    if (!r.blok && r.alt - r.ust > S.yer.lh * 0.5) yy = (r.ust + r.alt) / 2 - kay.scrollTop;
  }
  if (S.cetvelY === yy && el.style.getPropertyValue("--satir-yuk")) return;
  S.cetvelY = yy;
  el.style.setProperty("--cetvel-y", yy.toFixed(1) + "px");
  el.style.setProperty("--satir-yuk", S.yer.lh.toFixed(1) + "px");
}
function cetvelIlkSatir() {
  if (!S.el.cetvel || !S.yer) return;
  const ust = S.mod === "koltuk" ? koltukSinir().ust : ustPay();
  cetvelYerlestir(ust + S.yer.lh / 2);
}

// ---------- dar ekranda kenar notları (TASARIM-4 2.6) ----------
// Kenar yoksa notlu satırın sağında ince bir kenar işareti (dokununca not açılır) ya da Aa'dan seçilirse not
// paragrafın hemen altında küçük bir kâğıt şerit. Şeritler yalnız değişince yeniden kurulur.
function kenarIsaretleri() {
  const kap = S.el.kenarNotlari, altinda = !!tercih.satirAltiNot;
  kap.classList.toggle("isaretli", !altinda);
  satirAltiNotlar(altinda);
  if (altinda) return;
  const sR = S.el.sutun.getBoundingClientRect();
  for (const v of S.veri.vurgular) {
    if (!v.not || !v.not.trim()) continue;
    const m = S.el.sutun.querySelector(`mark[data-v="${v.id}"]`);
    const r = m && m.getClientRects()[0];
    if (!r) continue;
    const b = h("button", { type: "button", class: "kenar-isaret", "data-dokunma-yok": "", "aria-label": "Not: " + v.not.trim().slice(0, 40),
      style: `top:${(r.top - sR.top + r.height / 2 - 8).toFixed(1)}px;--v:${vurguRengi(v.renk)}` });
    b.addEventListener("click", () => notBalonuAc(v, { kaynak: m }));
    kap.append(b);
  }
}
function satirAltiNotlar(goster) {
  const notlu = goster ? S.veri.vurgular.filter((v) => v.not && v.not.trim()) : [];
  const imza = notlu.map((v) => v.id + ":" + v.not.length + v.renk).join(",");
  if (imza === S.notYer) return;
  S.notYer = imza;
  for (const e of S.el.sutun.querySelectorAll(".satir-alti-not")) e.remove();
  for (const v of [...notlu].reverse()) {
    const p = S.pEl[v.son.p];
    if (!p) continue;
    const el = h("button", { type: "button", class: "satir-alti-not", "data-dokunma-yok": "", style: `--v:${vurguRengi(v.renk)}`, "aria-label": "Kenar notu: " + v.not.trim() }, v.not.trim());
    el.addEventListener("click", () => notBalonuAc(v, { kaynak: el }));
    (S.co?.bloklar.get(v.son.p)?.el || p).after(el);
  }
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
  delete S.el.solPanel.dataset.durak;
  delete S.el.sagPanel.dataset.durak;
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
// Telefonda ve dar dikey ekranda paneller alt çekmecedir (okuma.css, TASARIM-4 2.5): tutamaktan sürüklenir; yukarı
// çekince tam açılır, aşağı çekince ya da hızlı fırlatınca kapanır. Hareket yalnız translate.
function cekmeceTutamak(panel) {
  const t = h("div", { class: "cekmece-tutamak", role: "button", tabindex: "0", "aria-label": panel.dataset.durak === "tam" ? "Çekmeceyi küçült" : "Çekmeceyi büyüt" });
  const durak = (tam) => { if (tam) panel.dataset.durak = "tam"; else delete panel.dataset.durak; t.setAttribute("aria-label", tam ? "Çekmeceyi küçült" : "Çekmeceyi büyüt"); };
  t.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { t.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
    const y0 = e.clientY, iz = [[performance.now(), e.clientY]];
    let dy = 0;
    panel.classList.add("suruklen");
    const oyna = (q) => {
      dy = q.clientY - y0;
      iz.push([performance.now(), q.clientY]);
      while (iz.length > 2 && iz[iz.length - 1][0] - iz[0][0] > 80) iz.shift();
      panel.style.translate = `0 ${dy < 0 ? dy * 0.35 : dy}px`;   // yukarıda direnç
    };
    const birak = () => {
      for (const [ad, f] of [["pointermove", oyna], ["pointerup", birak], ["pointercancel", birak]]) t.removeEventListener(ad, f);
      panel.classList.remove("suruklen");
      panel.style.translate = "";
      const [a, b] = [iz[0], iz[iz.length - 1]], hiz = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0;   // px/ms
      if (dy > 120 || hiz > 0.5) { if (panel.dataset.durak === "tam" && dy < 240 && hiz <= 0.5) durak(false); else panelKapat(); }
      else if (dy < -24 || hiz < -0.5) durak(true);
    };
    t.addEventListener("pointermove", oyna);
    t.addEventListener("pointerup", birak);
    t.addEventListener("pointercancel", birak);
  });
  t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); durak(panel.dataset.durak !== "tam"); } });
  return t;
}

function icindekilerCiz() {
  const k = S.yer ? konumAl() : { p: 0, oran: 0 };
  const simdi = P[k.p].b, oran = S.belge.ilerleme || 0;
  S.el.solPanel.replaceChildren(
    cekmeceTutamak(S.el.solPanel),
    h("div", { class: "panel-baslik" }, h("h2", {}, "İçindekiler"),
      h("button", { type: "button", class: "ikon-dugme", "aria-label": "İçindekiler panelini kapat", onclick: () => panelKapat() }, icon("kapat"))),
    h("div", { class: "panel-govde" },
      h("div", { class: "kunye" },
        h("b", {}, S.belge.ad),
        h("span", {}, `${S.belge.yazar || "Deneme"} · ${sayi(TOPLAM)} kelime · yaklaşık ${Math.ceil(TOPLAM / DAKIKADA)} dk`),
        h("span", { class: "kunye-ilerleme", style: `--p:${oran}`, "aria-label": `Kitabın ${yuzde(oran)} okundu` }, h("i"))),
      h("nav", { "aria-label": "Bölümler" }, ...BOLUMLER.map((b) => h("button", {
        type: "button", class: "dizin-satir bolum-satir", "aria-current": b.i === simdi ? "true" : null, "data-okundu": b.i < simdi ? "" : null,
        onclick: () => { const d = donusHazirla(); darsaKapat(); const el = S.el.sutun.querySelector(`[data-b="${b.i}"]`); kaydirGit(el.offsetTop + S.el.sutun.offsetTop - 8, d); },
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
  S.el.sagPanel.replaceChildren(cekmeceTutamak(S.el.sagPanel), sekmeler, govde);
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
  if (!vs.length) return govde.append(bos("Bu kitapta henüz not yok.", "Bir satırın altını çiz ya da metni seçip bir renge dokun. Not eklediğin vurgular burada ve sayfanın kenarında görünür."));
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
