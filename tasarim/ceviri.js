// Çeviri: tek kapı (OZELLIKLER-6 §1, §2). Arayüz motoru bilmez, yalnız etiketini (ad) gösterir.
//
//   ceviriDurumu({ kaynak, hedef }) -> { motorlar: [{ id, ad, durum, cevrimdisi }], secilen }
//   cevir(metin, { kaynak, hedef, motor, signal, parca, belgeId, imza }) -> { metin, motor, sure, onbellek? }
//       parca(kismi, ek): kismi şimdiye kadarki çeviri (birikimli), ek yeni gelen parça
//   dilBul(metin) -> "en" | "tr" | ... | null
//   paketler() / paketIndir(kaynak, hedef, { ilerleme, signal }) / paketSil(kaynak, hedef)
//   ceviriOnbellekSil(belgeId), ceviriOnbellekTemizle(), ceviriYeri(), cihazIndir(), hazirla()
//   hesap yolu (arayüz değil): hesapMetni, hesapIleCevir, googleCeviriAdresi, googleCeviriAc
//
// Motorlar, otomatik sırayla: cihaz (Chrome Translator API), paket (Bergamot WASM, ceviri-isci.js),
// anahtar (asistandaki API anahtarı), hesap (ChatGPT/Gemini/Claude ya da Google Çeviri'ye götürür).
// Çevrimdışı motor hazırken metin internete gitmez. ?ceviri=sahte sahte motoru açar.
//
// Veritabanı "kenar-notu-ceviri" (yedeğe girmez, yeniden üretilebilir):
//   onbellek: "<belgeId>|<imza>|<motor>|<kaynak>|<hedef>" -> { belgeId, metin, zaman }   (dizin: belge)
//   paketler: "<kaynak>-<hedef>" -> { kaynak, hedef, surum, dosyalar, boyut, zaman }    (yalnız tam inenler)
//   dosyalar: "<kaynak>-<hedef>/<tur>" -> Blob (sha256'sı Mozilla kaydıyla doğrulanmış)
//   yarim:    "<kaynak>-<hedef>/<tur>#<sıra>" -> { blob, url }  (yarıda kalan indirme, kaldığı yerden sürer)
//   meta:     "katalog" -> { zaman, ciftler }
// Paket indirme, doğrulama ve WASM çeviri işçide (ceviri-isci.js); ana iş parçacığı yalnız ileti taşır.
// Paket dosyaları Mozilla Firefox Translations modelleridir (MPL 2.0). Kayıt ve sha256 Mozilla'nın Remote Settings
// sunucusundan gelir; dosyaların kendisi CORS izni olan bir aynadan (Hugging Face) iner ve sha256 ile doğrulanır.

import { store, bus, panoyaYaz, YZ_UYGULAMALAR, YZ_SAGLAYICILAR } from "./ortak.js";

const VT = { ad: "kenar-notu-ceviri", surum: 1 };
const SIRA = ["cihaz", "paket", "anahtar", "hesap"];
const SAHTE = (() => { try { return new URLSearchParams(location.search).get("ceviri") === "sahte"; } catch { return false; } })();
const MOTOR_YOLU = "../lib/ceviri/";   // ceviri-isci.js'e göre

// Paket kaynakları. Kayıt ve sha256: Mozilla. Dosya: önce (varsa) kendi aynamız, sonra Hugging Face aynası.
const RS_KAYIT = "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models/records";
const HF_DEPO = "TiberiuCristianLeon/Bergamot";
const HF_LISTE = `https://huggingface.co/api/models/${HF_DEPO}?blobs=true`;
const HF_TABAN = `https://huggingface.co/${HF_DEPO}/resolve/main/`;
// Kendi ayna: "<taban>/<kaynak>-<hedef>/<dosya adı>[.gz]". ?ceviriPaket=<taban> ile denenebilir.
const AYNA = (() => { try { return new URLSearchParams(location.search).get("ceviriPaket") || ""; } catch { return ""; } })();
const KATALOG_OMRU = 7 * 24 * 3600e3;
const MOTOR_SURUMU = /^[12]\./;   // bu WASM motoruyla denenen model kuşakları (1.x tiny, 2.x base-memory)

// Yerleşik katalog: İngilizce ile Türkçe arası iki yön, internetsiz de listelenir (Mozilla kayıtları, sürüm 1.0)
const KATALOG_YERLESIK = [
  { kaynak: "en", hedef: "tr", surum: "1.0", dosyalar: [
    { tur: "model", ad: "model.entr.intgemm.alphas.bin", yol: "tiny/entr/model.entr.intgemm.alphas.bin", boyut: 17141051, gz: 13159314, sha256: "ea3cd4ee09de190df265c78d84260e277a9a8a3ddff05eb55d72afe7fc0fdbf4" },
    { tur: "lex", ad: "lex.50.50.entr.s2t.bin", yol: "tiny/entr/lex.50.50.entr.s2t.bin", boyut: 3261300, gz: 1546258, sha256: "3aba0be842bd4c192659c781e6fdce8eb9b2b1fff29a40d22f75da369d59f46f" },
    { tur: "vocab", ad: "vocab.entr.spm", yol: "tiny/entr/vocab.entr.spm", boyut: 798793, gz: 395473, sha256: "a220363d60391f7ce3df8ec9785424dbc00c24d5786d1a4308cf8ca3ed3385c2" },
  ] },
  { kaynak: "tr", hedef: "en", surum: "1.0", dosyalar: [
    { tur: "model", ad: "model.tren.intgemm.alphas.bin", yol: "tiny/tren/model.tren.intgemm.alphas.bin", boyut: 17140836, gz: 12362908, sha256: "bd18594ac5a7f1d9997e7ea5bd80272082219cf8b1ce604766e4f207eb86abbf" },
    { tur: "lex", ad: "lex.50.50.tren.s2t.bin", yol: "tiny/tren/lex.50.50.tren.s2t.bin", boyut: 4662492, gz: 2470683, sha256: "d3374ab5267a73ee1aa1d926a298bd349426835f40856991ee959bc5cd4f9fce" },
    { tur: "vocab", ad: "vocab.tren.spm", yol: "tiny/tren/vocab.tren.spm", boyut: 811353, gz: 409060, sha256: "ed328e589a3ccd70fd3ce7773fc3c01d8b7b18c687464cacf17fd40a8c0daadd" },
  ] },
];

export class CeviriHatasi extends Error {
  // tur: "motor-yok" | "hesap" | "dil" | "paket-yok" | "bozuk" | "yer" | "ag" | "anahtar" | "sinir" | "sunucu" | "istek" | "motor" | "hareket"
  constructor(tur, mesaj = "") { super(mesaj || tur); this.name = "CeviriHatasi"; this.tur = tur; }
}
const iptalHatasi = () => new DOMException("İptal edildi", "AbortError");
const iptalMi = (e) => e?.name === "AbortError";
const ayar = () => store.ayarlar.ceviri || {};
const varsayilanHedef = () => kisaDil(ayar().hedef) || "tr";
const ciftId = (k, h) => `${k}-${h}`;
const cevrimici = () => navigator.onLine !== false;
const yay = (veri) => { durumBellek.clear(); try { bus.emit("ceviri", veri); } catch { /* dinleyici hatası çeviriyi düşürmez */ } };

/* ================= Dil ================= */
export function kisaDil(kod) {
  const s = String(kod || "").trim().replace(/_/g, "-");
  if (!s) return "";
  const [ana, ...geri] = s.split("-");
  const a = ana.toLowerCase();
  if (a === "zh") { const yazi = geri.find((x) => /^han[st]$/i.test(x)); return yazi ? `zh-${yazi[0].toUpperCase()}${yazi.slice(1).toLowerCase()}` : "zh-Hans"; }
  return a === "nb" || a === "nn" ? a : a === "no" ? "nb" : a;
}
const adlar = {};
export function dilAdi(kod, arayuz = "tr") {
  try { return (adlar[arayuz] ||= new Intl.DisplayNames([arayuz], { type: "language" })).of(kod) || kod; } catch { return kod; }
}

let saptayici = null;
export async function dilBul(metin) {
  const t = String(metin || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  if (t.length < 12) return null;
  if (typeof self.LanguageDetector?.create === "function") {
    try {
      // İndirme kullanıcı hareketi ister: yalnız hazırsa kullanılır, değilse sezgiye düşülür
      if (!saptayici) {
        const durum = await self.LanguageDetector.availability();
        if (durum === "available") saptayici = self.LanguageDetector.create();
      }
      if (saptayici) {
        const [ilk] = await (await saptayici).detect(t);
        if (ilk && ilk.detectedLanguage !== "und" && ilk.confidence >= 0.5) return kisaDil(ilk.detectedLanguage);
      }
    } catch { saptayici = null; }
  }
  return dilSez(t);
}

// Sezgi: önce yazı sistemi, Latin yazıda en sık kelimeler ve Türkçe harfler
const SIK = {
  en: "the of and to in is that it for was with as his he on be at by this had not are but from or have an they which you were her she there been one all we their has would when who will more if no out so what up its about into than them can only other could".split(" "),
  tr: "ve bir bu da de için ile ne çok daha gibi o ama ki sonra kadar olarak olan değil var her en ya şey ben sen biz onun bunu diye mi ancak çünkü yine şu ise hem nasıl".split(" "),
  de: "der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat dass sie nach wird bei einer um am sind noch wie".split(" "),
  fr: "de la le et les des en un du une que est pour qui dans par sur au pas plus ne ce il se sont avec son elle mais nous vous comme ou si leur".split(" "),
  es: "de la que el en y los del se las por un para con no una su al es lo como más pero sus le ya o fue este ha sí porque esta entre cuando muy sin sobre".split(" "),
  it: "di e il la che in un per è non una del le si da con sono al lo della ma come più gli ha anche nel se questo era alla io".split(" "),
  pt: "de a o que e do da em um para é com não uma os no se na por mais as dos como mas foi ao ele das tem à seu sua ou ser quando muito".split(" "),
  nl: "de en van het een in is dat op te zijn met voor niet aan er maar om ook als dan bij nog door wat hij ze uit naar kan".split(" "),
};
function dilSez(t) {
  const say = (re) => (t.match(re) || []).length;
  const harf = say(/\p{L}/gu) || 1;
  const yazi = [["ru", /\p{Script=Cyrillic}/gu], ["ar", /\p{Script=Arabic}/gu], ["el", /\p{Script=Greek}/gu], ["he", /\p{Script=Hebrew}/gu],
    ["ja", /[\p{Script=Hiragana}\p{Script=Katakana}]/gu], ["ko", /\p{Script=Hangul}/gu], ["zh-Hans", /\p{Script=Han}/gu], ["th", /\p{Script=Thai}/gu]];
  for (const [d, re] of yazi) if (say(re) / harf > 0.3) return d;
  const kelimeler = t.toLocaleLowerCase().match(/\p{L}+/gu) || [];
  if (kelimeler.length < 4) return null;
  const puan = {};
  for (const [d, liste] of Object.entries(SIK)) {
    const k = new Set(liste);
    puan[d] = kelimeler.reduce((n, w) => n + (k.has(w) ? 1 : 0), 0) / kelimeler.length;
  }
  puan.tr += (say(/[ğışİĞŞ]/g) / harf) * 8;   // Türkçeye özgü harfler
  const [ilk, ikinci] = Object.entries(puan).sort((a, b) => b[1] - a[1]);
  if (ilk[1] < 0.08 || ilk[1] < ikinci[1] * 1.3) return null;
  return ilk[0];
}

/* ================= Veritabanı ================= */
let vtSoz = null;
function vtAc() {
  vtSoz ||= new Promise((tamam, hata) => {
    const q = indexedDB.open(VT.ad, VT.surum);
    q.onupgradeneeded = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains("onbellek")) db.createObjectStore("onbellek").createIndex("belge", "belgeId");
      for (const ad of ["paketler", "dosyalar", "yarim", "meta"]) if (!db.objectStoreNames.contains(ad)) db.createObjectStore(ad);
    };
    q.onsuccess = () => { const db = q.result; db.onversionchange = () => { db.close(); vtSoz = null; }; tamam(db); };
    q.onerror = () => { vtSoz = null; hata(q.error); };
    q.onblocked = () => { vtSoz = null; hata(new Error("engellendi")); };
  });
  return vtSoz;
}
// fn(depo | depolar) istek(ler) açar; işlem bitince sonuçları döner
async function islem(depolar, kip, fn) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    const t = db.transaction(depolar, kip);
    const d = Array.isArray(depolar) ? Object.fromEntries(depolar.map((a) => [a, t.objectStore(a)])) : t.objectStore(depolar);
    const r = fn(d);
    t.oncomplete = () => tamam(Array.isArray(r) ? r.map((x) => x?.result) : r?.result);
    t.onerror = () => hata(t.error);
    t.onabort = () => hata(t.error || new Error("işlem düştü"));
  });
}
const al = (depo, k) => islem(depo, "readonly", (d) => d.get(k));
const koy = (depo, k, v) => islem(depo, "readwrite", (d) => d.put(v, k));
const onEkAraligi = (on) => IDBKeyRange.bound(on, on + "\uffff");
const anahtarlar = (depo, on) => islem(depo, "readonly", (d) => d.getAllKeys(onEkAraligi(on)));

/* ================= Önbellek ================= */
// Paragraf imzası: uzunluk + iki FNV-1a (çakışma pratikte yok)
export function imzaHesapla(metin) {
  const s = String(metin || "");
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13);
  }
  return s.length.toString(36) + (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
const onbellekAnahtari = ({ belgeId, imza, motor, kaynak, hedef }) => [belgeId || "-", imza, motor, kaynak, hedef].join("|");
async function onbellekAl(k) { try { return (await al("onbellek", k))?.metin ?? null; } catch { return null; } }
async function onbellekYaz(k, belgeId, metin) { try { await koy("onbellek", k, { belgeId: belgeId || "-", metin, zaman: Date.now() }); } catch { /* dolu depo: önbelleksiz sürer */ } }

export async function ceviriOnbellekSil(belgeId) {
  if (!belgeId) return 0;
  return islem("onbellek", "readwrite", (d) => {
    const q = d.index("belge").openKeyCursor(IDBKeyRange.only(belgeId));
    let n = 0;
    q.onsuccess = () => { const c = q.result; if (!c) return; d.delete(c.primaryKey); n++; c.continue(); };
    return { get result() { return n; } };
  });
}
export const ceviriOnbellekTemizle = () => islem("onbellek", "readwrite", (d) => d.clear()).then(() => yay({ tur: "onbellek" }));

// Belge silinince önbelleği de gider; "Geri al" süresi beklenir
const silinecek = new Map();
bus.on("belgeler", (o) => {
  if (o?.tur === "sil" && o.id) {
    clearTimeout(silinecek.get(o.id));
    silinecek.set(o.id, setTimeout(() => { silinecek.delete(o.id); ceviriOnbellekSil(o.id).catch(() => {}); }, 20000));
  } else if (o?.tur === "ekle" && o.belge?.id && silinecek.has(o.belge.id)) {
    clearTimeout(silinecek.get(o.belge.id));
    silinecek.delete(o.belge.id);
  }
});

// Kapladığı yer (bayt): paketler kayıtlı boyuttan, önbellek metin uzunluğundan (UTF-16)
export async function ceviriYeri() {
  let paket = 0, onbellek = 0;
  try {
    const [pk] = await islem(["paketler"], "readonly", (d) => [d.paketler.getAll()]);
    paket = (pk || []).reduce((t, p) => t + (p.boyut || 0), 0);
    await islem("onbellek", "readonly", (d) => {
      const q = d.openCursor();
      q.onsuccess = () => { const c = q.result; if (!c) return; onbellek += 2 * ((c.value?.metin?.length || 0) + c.key.length) + 64; c.continue(); };
    });
  } catch { /* veritabanı yoksa sıfır */ }
  return { paket, onbellek, toplam: paket + onbellek };
}

/* ================= Metni böl ================= */
// Paragraflar ve cümleler; her parçanın ardındaki boşluk korunur ki çeviri aynı düzende birleşsin
export function cumleler(metin, dil = "en") {
  const s = String(metin || "");
  const sonuc = [];
  let seg = null;
  try { seg = new Intl.Segmenter(dil, { granularity: "sentence" }); } catch { seg = null; }
  for (const blok of s.split(/(\n+)/)) {
    if (!blok) continue;
    if (/^\n+$/.test(blok)) { if (sonuc.length) sonuc[sonuc.length - 1].ara += blok; continue; }
    const parcalar = seg ? [...seg.segment(blok)].map((x) => x.segment) : blok.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*\s*|$)/g) || [blok];
    let bekleyen = "";
    for (const p of parcalar) {
      const govde = p.trim();
      const ara = p.slice(p.trimEnd().length);
      if (!govde) { if (sonuc.length) sonuc[sonuc.length - 1].ara += p; continue; }
      // Kısaltmadan bölünen kırıntılar ("Dr.", "St.", "e.g.") sonrakine eklenir
      if (/^[\p{L}.]{1,4}\.$/u.test(govde) && govde.length <= 4) { bekleyen += govde + (ara || " "); continue; }
      sonuc.push({ metin: bekleyen + govde, ara });
      bekleyen = "";
    }
    if (bekleyen) sonuc.push({ metin: bekleyen.trim(), ara: "" });
  }
  return sonuc;
}
const birlestir = (parcalar, ceviriler) => parcalar.map((p, i) => (ceviriler[i] ?? "") + (/\n/.test(p.ara) ? p.ara : p.ara ? " " : "")).join("").trimEnd();

/* ================= Motor: cihaz (Chrome Translator API) ================= */
const cihazVar = () => typeof self.Translator?.availability === "function" && typeof self.Translator?.create === "function";
const cihazCevirmen = new Map();   // "en-tr" -> Promise<Translator>
const cihazInis = new Map();       // "en-tr" -> ilerleme (0..1)
const cihazBozuk = new Set();      // "var" denip açılamayan yönler: bu oturumda atlanır
async function cihazDurumu(k, h) {
  if (!cihazVar() || cihazBozuk.has(ciftId(k, h))) return "yok";
  if (cihazInis.has(ciftId(k, h))) return "iniyor";
  try {
    const a = await self.Translator.availability({ sourceLanguage: k, targetLanguage: h });
    return { available: "hazir", downloadable: "indirilebilir", downloading: "iniyor" }[a] || "yok";
  } catch { return "yok"; }
}
// "İndir" düğmesinin tıklamasında çağrılır: create ilk satırda, kullanıcı hareketi düşmeden
export function cihazIndir(kaynak, hedef = varsayilanHedef(), { ilerleme, signal } = {}) {
  if (!cihazVar()) return Promise.reject(new CeviriHatasi("motor-yok", "Bu Chrome'da cihaz çevirisi yok"));
  const k = kisaDil(kaynak), h = kisaDil(hedef), id = ciftId(k, h);
  if (cihazCevirmen.has(id)) return cihazCevirmen.get(id);
  cihazInis.set(id, 0);
  const soz = self.Translator.create({
    sourceLanguage: k, targetLanguage: h, signal,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const oran = e.total ? e.loaded / e.total : e.loaded;
        cihazInis.set(id, oran);
        ilerleme?.(oran);
        yay({ tur: "cihaz", kaynak: k, hedef: h, durum: "iniyor", ilerleme: oran });
      });
    },
  }).then((t) => { cihazInis.delete(id); cihazBozuk.delete(id); yay({ tur: "cihaz", kaynak: k, hedef: h, durum: "hazir" }); return t; },
    (e) => {
      cihazInis.delete(id); cihazCevirmen.delete(id);
      yay({ tur: "cihaz", kaynak: k, hedef: h, durum: "hata" });
      if (iptalMi(e)) throw e;
      // NotAllowedError: kullanıcı hareketi dışında çağrıldı; NotSupportedError: bu yön cihazda yok
      throw new CeviriHatasi(e?.name === "NotAllowedError" ? "hareket" : e?.name === "NotSupportedError" ? "motor-yok" : "motor", String(e?.message || e));
    });
  cihazCevirmen.set(id, soz);
  return soz;
}
async function cihazCevir(parcalar, { kaynak, hedef, signal }, ekle) {
  const t = await cihazIndir(kaynak, hedef);
  const ceviriler = [];
  for (const p of parcalar) {
    if (signal?.aborted) throw iptalHatasi();
    const c = await t.translate(p.metin, { signal });
    ceviriler.push(c);
    ekle(ceviriler);
  }
  return ceviriler;
}

/* ================= Motor: paket (Bergamot, işçide) ================= */
let isci = null, isciSayac = 0;
const isciBekleyen = new Map();
const yuklenen = new Map();   // "en-tr+..." -> Promise (işçide model hazır)
function isciAl() {
  if (isci) return isci;
  isci = new Worker(new URL("./ceviri-isci.js", import.meta.url));
  isci.onmessage = (e) => {
    const { id, sonuc, hata, ara } = e.data || {};
    const b = isciBekleyen.get(id);
    if (!b) return;
    if (ara !== undefined) { b.ara?.(ara); return; }
    isciBekleyen.delete(id);
    if (!hata) b.tamam(sonuc);
    else if (hata.ad === "AbortError") b.hata(iptalHatasi());
    else b.hata(new CeviriHatasi(hata.tur || (hata.ad === "PaketEksik" ? "paket-yok" : "motor"), hata.mesaj));
  };
  // İşçi düşerse (bellek, wasm) bekleyenler hatayla döner, bir sonraki istekte yeniden açılır
  isci.onerror = (e) => {
    e.preventDefault?.();
    const hata = new CeviriHatasi("motor", "çeviri motoru durdu" + (e.message ? ": " + e.message : ""));
    for (const b of isciBekleyen.values()) b.hata(hata);
    isciBekleyen.clear();
    yuklenen.clear();
    try { isci.terminate(); } catch { /* zaten kapalı */ }
    isci = null;
  };
  isci.postMessage({ id: 0, tur: "kur", vt: VT, motorYolu: MOTOR_YOLU });
  return isci;
}
// ara: işin ara iletileri (indirme ilerlemesi); signal: işçideki işi durdurur
function isciIs(tur, veri = {}, { ara, signal } = {}) {
  const w = isciAl();
  const id = ++isciSayac;
  return new Promise((tamam, hata) => {
    // Zaten iptal edilmişse iş hiç gönderilmez (geçmiş "abort" olayı dinleyiciye gelmez)
    if (signal?.aborted) { hata(iptalHatasi()); return; }
    isciBekleyen.set(id, { tamam, hata, ara });
    w.postMessage({ id, tur, ...veri });
    signal?.addEventListener("abort", () => { if (isciBekleyen.has(id)) w.postMessage({ id: ++isciSayac, tur: "durdur", is: id }); }, { once: true });
  });
}

async function yukluPaket(k, h) {
  try { return (await al("paketler", ciftId(k, h))) || null; } catch { return null; }
}
// Doğrudan yön ya da İngilizce üzerinden iki adım
async function paketYolu(k, h) {
  const d = await yukluPaket(k, h);
  if (d) return [d];
  if (k !== "en" && h !== "en") {
    const [a, b] = await Promise.all([yukluPaket(k, "en"), yukluPaket("en", h)]);
    if (a && b) return [a, b];
  }
  return null;
}
const isciModeli = (p) => {
  const turler = p.dosyalar.map((d) => d.tur);
  return {
    cift: ciftId(p.kaynak, p.hedef),
    dosyalar: {
      vocab: turler.includes("srcvocab") ? ["srcvocab", "trgvocab"] : ["vocab"],
      modelAd: p.dosyalar.find((d) => d.tur === "model")?.ad || "",
    },
  };
};
function paketYukle(yol) {
  const anahtar = yol.map((p) => ciftId(p.kaynak, p.hedef)).join("+");
  if (!yuklenen.has(anahtar)) {
    const soz = isciIs("yukle", { modeller: yol.map(isciModeli) });
    soz.catch(() => yuklenen.delete(anahtar));
    yuklenen.set(anahtar, soz);
  }
  return yuklenen.get(anahtar);
}
async function paketCevir(parcalar, { kaynak, hedef, signal }, ekle) {
  const yol = await paketYolu(kaynak, hedef);
  if (!yol) throw new CeviriHatasi("paket-yok", `${kaynak}-${hedef} paketi yüklü değil`);
  await paketYukle(yol);
  const modeller = yol.map(isciModeli);
  const ceviriler = [];
  // Cümle cümle: her biri kısa sürer, iptal araya girer, parça akışı olur
  for (const p of parcalar) {
    if (signal?.aborted) throw iptalHatasi();
    const [c] = await isciIs("cevir", { modeller, metinler: [p.metin] });
    ceviriler.push(c);
    ekle(ceviriler);
  }
  return ceviriler;
}

/* ================= Motor: anahtar (asistandaki API anahtarı) ================= */
// asistan.js sağlayıcı adaptörlerini dışa açmadığından burada kısa, yalnız metinlik bir akış var.
// Anahtar hiçbir yerde loglanmaz.
function anahtarSaglayici() {
  const yz = store.ayarlar.yz || {};
  const anahtarOku = (id) => String(yz.anahtarlar?.[id] || "").trim();
  const sirali = [yz.saglayici, ...YZ_SAGLAYICILAR.map((s) => s.id)];
  for (const id of sirali) {
    const s = YZ_SAGLAYICILAR.find((x) => x.id === id);
    if (!s || s.id === "deneme") continue;
    const anahtar = anahtarOku(s.id);
    if (!anahtar) continue;
    const model = String(yz.modeller?.[s.id] || s.varsayilanModel).trim().replace(/^models\//, "");
    return { id: s.id, ad: s.ad, model, anahtar };
  }
  return null;
}
async function* sseSatirlari(res) {
  const okuyucu = res.body.getReader();
  const coz = new TextDecoder();
  let tampon = "";
  try {
    for (;;) {
      const { value, done } = await okuyucu.read();
      if (done) break;
      tampon += coz.decode(value, { stream: true });
      let i;
      while ((i = tampon.indexOf("\n")) >= 0) {
        const satir = tampon.slice(0, i).trim();
        tampon = tampon.slice(i + 1);
        if (!satir.startsWith("data:")) continue;
        const veri = satir.slice(5).trim();
        if (!veri || veri === "[DONE]") continue;
        try { yield JSON.parse(veri); } catch { /* yarım satır */ }
      }
    }
  } finally { okuyucu.cancel().catch(() => {}); }
}
async function istekAt(url, secenek) {
  if (!cevrimici()) throw new CeviriHatasi("ag", "Bağlantı yok");
  let res;
  try { res = await fetch(url, secenek); } catch (e) { if (iptalMi(e)) throw e; throw new CeviriHatasi("ag", "Bağlantı yok"); }
  if (!res.ok) {
    const d = res.status;
    throw new CeviriHatasi(d === 401 || d === 403 ? "anahtar" : d === 429 ? "sinir" : d === 400 || d === 404 ? "istek" : "sunucu", `${d}`);
  }
  return res;
}
const ANAHTAR_AKIS = {
  async gemini({ sistem, istem, model, anahtar, signal }, yaz) {
    const res = await istekAt(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": anahtar },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sistem }] }, contents: [{ role: "user", parts: [{ text: istem }] }] }),
    });
    for await (const j of sseSatirlari(res)) {
      if (j.error) throw new CeviriHatasi("sunucu", String(j.error.status || ""));
      const p = (j.candidates?.[0]?.content?.parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join("");
      if (p) yaz(p);
    }
  },
  async claude({ sistem, istem, model, anahtar, signal }, yaz) {
    const res = await istekAt("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: {
        "x-api-key": anahtar, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json", "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({ model, max_tokens: 8000, stream: true, fallbacks: "default", system: sistem, messages: [{ role: "user", content: istem }] }),
    });
    for await (const j of sseSatirlari(res)) {
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta") yaz(j.delta.text);
      else if (j.type === "error") throw new CeviriHatasi("sunucu", String(j.error?.type || ""));
    }
  },
  async openai({ sistem, istem, model, anahtar, signal }, yaz) {
    const res = await istekAt("https://api.openai.com/v1/responses", {
      method: "POST", signal, headers: { Authorization: `Bearer ${anahtar}`, "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true, instructions: sistem, input: [{ role: "user", content: [{ type: "input_text", text: istem }] }] }),
    });
    for await (const j of sseSatirlari(res)) {
      if (j.type === "response.output_text.delta") yaz(j.delta || "");
      else if (j.type === "error" || j.type === "response.failed") throw new CeviriHatasi("sunucu", String(j.code || ""));
    }
  },
};
async function anahtarCevir(metin, { kaynak, hedef, signal }, akit) {
  const sg = anahtarSaglayici();
  if (!sg) throw new CeviriHatasi("anahtar", "Anahtar yok");
  const sistem = `You are a literary translator. Translate the user's text from ${dilAdi(kaynak, "en")} to ${dilAdi(hedef, "en")}. ` +
    "Keep the meaning, tone and paragraph breaks. Output only the translation, with no notes, quotes or explanations.";
  let toplam = "";
  await ANAHTAR_AKIS[sg.id]({ sistem, istem: metin, model: sg.model, anahtar: sg.anahtar, signal }, (p) => { toplam += p; akit(toplam, p); });
  return toplam.trim();
}

/* ================= Motor: sahte (?ceviri=sahte) ================= */
async function sahteCevir(parcalar, { hedef, signal, metin }, ekle) {
  const hata = String(metin).match(/#(ag|anahtar|motor|bozuk)\b/);
  const bekle = (ms) => new Promise((tamam, red) => {
    if (signal?.aborted) return red(iptalHatasi());
    const z = setTimeout(tamam, ms);
    signal?.addEventListener("abort", () => { clearTimeout(z); red(iptalHatasi()); }, { once: true });
  });
  await bekle(180);
  if (hata) throw new CeviriHatasi(hata[1], "sahte hata");
  const ceviriler = [];
  for (const [i, p] of parcalar.entries()) {
    await bekle(140);
    ceviriler.push((i === 0 ? `[${hedef}] ` : "") + p.metin);
    ekle(ceviriler);
  }
  return ceviriler;
}

/* ================= Durum ve seçim ================= */
const MOTOR_ADI = { cihaz: "Cihazda", paket: "Çeviri paketi", hesap: "Hesabımla", sahte: "Sahte motor" };

async function paketDurumu(k, h) {
  if (typeof WebAssembly !== "object" || typeof Worker !== "function") return "yok";
  if (await paketYolu(k, h)) return "hazir";
  if (SAHTE) { const s = sahtePaketler.get(ciftId(k, h)); if (s) return s.durum === "yuklu" ? "hazir" : "iniyor"; }
  const iniyor = (a, b) => inisler.has(ciftId(a, b));
  if (iniyor(k, h) || (k !== "en" && h !== "en" && (iniyor(k, "en") || iniyor("en", h)))) return "iniyor";
  const katalog = await katalogAl({ bekleme: 0 });
  const katalogda = (a, b) => katalog.some((c) => c.kaynak === a && c.hedef === b);
  if (katalogda(k, h) || (k !== "en" && h !== "en" && katalogda(k, "en") && katalogda("en", h))) return "indirilebilir";
  return "yok";
}

// Çeviriyle okurken her paragraf durumu sorar: kısa süre aynı cevap kullanılır, bir olay gelince tazelenir
const durumBellek = new Map();
export function ceviriDurumu({ kaynak, hedef } = {}) {
  const k = kisaDil(kaynak), h = kisaDil(hedef) || varsayilanHedef();
  const a = `${k}|${h}|${ayar().motor || ""}|${cevrimici()}|${anahtarSaglayici()?.id || ""}`;
  const b = durumBellek.get(a);
  if (b && performance.now() - b.zaman < 3000) return b.soz;
  const soz = durumHesapla(k, h);
  durumBellek.set(a, { zaman: performance.now(), soz });
  soz.catch(() => durumBellek.delete(a));
  return soz;
}
async function durumHesapla(k, h) {
  const motorlar = [];
  if (SAHTE) motorlar.push({ id: "sahte", ad: MOTOR_ADI.sahte, durum: "hazir", cevrimdisi: true });
  const [cihaz, paket] = await Promise.all([k ? cihazDurumu(k, h) : cihazVar() ? "indirilebilir" : "yok", k ? paketDurumu(k, h) : "indirilebilir"]);
  motorlar.push({ id: "cihaz", ad: MOTOR_ADI.cihaz, durum: cihaz, cevrimdisi: true });
  motorlar.push({ id: "paket", ad: MOTOR_ADI.paket, durum: paket, cevrimdisi: true });
  const sg = anahtarSaglayici();
  if (sg) motorlar.push({ id: "anahtar", ad: `${sg.ad} anahtarı`, durum: cevrimici() ? "hazir" : "yok", cevrimdisi: false });
  motorlar.push({ id: "hesap", ad: MOTOR_ADI.hesap, durum: cevrimici() ? "hazir" : "yok", cevrimdisi: false });
  return { motorlar, secilen: motorSec(motorlar, ayar().motor) };
}
// Tercih hazırsa o; değilse otomatik sıra (önce çevrimdışı motorlar). Hesap satır içi çeviri vermez, en sonda.
function motorSirasi(motorlar, tercih = "otomatik") {
  const hazir = (id) => motorlar.some((m) => m.id === id && m.durum === "hazir");
  const sira = [...(tercih && tercih !== "otomatik" ? [tercih] : []), ...(SAHTE ? ["sahte"] : []), ...SIRA];
  return [...new Set(sira)].filter(hazir);
}
const YEREL = new Set(["cihaz", "paket", "sahte"]);   // metni cihazdan çıkarmayan motorlar
const motorSec = (motorlar, tercih) => motorSirasi(motorlar, tercih)[0] || null;

/* ================= cevir ================= */
export async function cevir(metin, { kaynak, hedef, motor, signal, parca, belgeId, imza, onbellek = true } = {}) {
  const t0 = performance.now();
  const yazi = String(metin ?? "");
  if (signal?.aborted) throw iptalHatasi();
  if (!yazi.trim()) return { metin: "", motor: null, sure: 0 };
  const k = kisaDil(kaynak) || (await dilBul(yazi));
  if (!k) throw new CeviriHatasi("dil", "Kaynak dil bulunamadı");
  const h = kisaDil(hedef) || varsayilanHedef();
  if (k === h) return { metin: yazi, motor: null, sure: 0 };

  const durum = await ceviriDurumu({ kaynak: k, hedef: h });
  const sira = motorSirasi(durum.motorlar, motor || ayar().motor || "otomatik");
  if (!sira.length) throw new CeviriHatasi("motor-yok", "Hazır çeviri motoru yok");
  if (sira[0] === "hesap") throw new CeviriHatasi("hesap", "Bu çeviri hesap yoluyla yapılır");
  const imz = imza || imzaHesapla(yazi);
  const parcalar = cumleler(yazi, k);
  const s = { kaynak: k, hedef: h, signal, metin: yazi };

  // İlk motor tutmazsa (ör. Chrome "var" deyip açamazsa) ve henüz parça gelmediyse sıradakine geçilir
  let son = null, yerelDenendi = false;
  for (const secilen of sira) {
    if (secilen === "hesap") break;
    // Yerel motor denendiyse metin internete gitmez; çevrimiçi çeviri ayrı bir kullanıcı eylemidir
    if (yerelDenendi && !YEREL.has(secilen)) break;
    if (YEREL.has(secilen)) yerelDenendi = true;
    // API çevirisi sağlayıcı ve modelle anahtarlanır: model değişince eski sonuç dönmez
    const sg = secilen === "anahtar" ? anahtarSaglayici() : null;
    const kimlik = sg ? `anahtar:${sg.id}:${sg.model}` : secilen;
    const anahtar = onbellek && onbellekAnahtari({ belgeId, imza: imz, motor: kimlik, kaynak: k, hedef: h });
    if (anahtar) {
      const eski = await onbellekAl(anahtar);
      if (eski != null) { parca?.(eski, eski); return { metin: eski, motor: secilen, sure: Math.round(performance.now() - t0), onbellek: true }; }
    }
    let onceki = "";
    const ekle = (ceviriler) => {
      const kismi = birlestir(parcalar.slice(0, ceviriler.length), ceviriler);
      const ek = kismi.slice(onceki.length);
      onceki = kismi;
      parca?.(kismi, ek);
    };
    try {
      let sonuc;
      if (secilen === "anahtar") sonuc = await anahtarCevir(yazi, s, (kismi, ek) => { onceki = kismi; parca?.(kismi, ek); });
      else {
        let f = { sahte: sahteCevir, cihaz: cihazCevir, paket: paketCevir }[secilen];
        if (SAHTE && secilen === "paket" && !(await paketYolu(k, h))) f = sahteCevir;   // sahte inen paket
        sonuc = birlestir(parcalar, await f(parcalar, s, ekle));
      }
      if (signal?.aborted) throw iptalHatasi();
      if (anahtar && sonuc) onbellekYaz(anahtar, belgeId, sonuc);
      return { metin: sonuc, motor: secilen, sure: Math.round(performance.now() - t0) };
    } catch (e) {
      if (iptalMi(e) || signal?.aborted) throw iptalHatasi();
      if (secilen === "cihaz") { cihazBozuk.add(ciftId(k, h)); durumBellek.clear(); }
      son = e instanceof CeviriHatasi ? e : new CeviriHatasi("motor", String(e?.message || e));
      // Yalnız yerel motorun kendi arızasında geçilir; ağ ve anahtar hataları olduğu gibi döner
      const gecilir = (secilen === "cihaz" || secilen === "paket") && ["motor", "motor-yok", "paket-yok", "hareket"].includes(son.tur);
      if (!gecilir || onceki) throw son;
    }
  }
  throw son || new CeviriHatasi("hesap", "Bu çeviri hesap yoluyla yapılır");
}

// "Çeviriyle oku" açılınca: paket motorunu (WASM + model) önceden yükler; çeviri beklemesi kısalır
export async function hazirla({ kaynak, hedef } = {}) {
  const k = kisaDil(kaynak), h = kisaDil(hedef) || varsayilanHedef();
  const yol = k && (await paketYolu(k, h));
  if (yol) await paketYukle(yol);
  return !!yol;
}

/* ================= Hesap yolu yardımcıları (arayüz değil) ================= */
// Türkçe dil adına ek: İngilizce -> İngilizceden / İngilizceye
function dilEki(ad, tur) {
  const sesli = [...ad.toLocaleLowerCase("tr")].reverse().find((c) => "aeıioöuü".includes(c)) || "e";
  const kalin = "aıou".includes(sesli);
  const sonSesli = "aeıioöuü".includes(ad.slice(-1).toLocaleLowerCase("tr"));
  if (tur === "den") return ad + (/[çfhkpsşt]$/i.test(ad) ? "t" : "d") + (kalin ? "an" : "en");
  return ad + (sonSesli ? "y" : "") + (kalin ? "a" : "e");
}
export function hesapMetni(metin, { kaynak, hedef } = {}) {
  const h = dilAdi(kisaDil(hedef) || varsayilanHedef());
  const k = kisaDil(kaynak);
  const yon = k ? `${dilEki(dilAdi(k), "den")} ${dilEki(h, "e")}` : dilEki(h, "e");
  return `Şu metni ${yon} çevir. Anlamı ve üslubu koru, yalnız çeviriyi yaz:\n\n${String(metin || "").trim()}`;
}
// Kullanıcı hareketinde çağrılır: önce pano, sonra uygulama (açılır pencere engellenmesin).
// uygulama: "chatgpt" | "gemini" | "claude" | "paylas" (paylaş menüsü). Dönen söz: { kopyalandi, uygulama, metin }
export async function hesapIleCevir(metin, { kaynak, hedef, uygulama } = {}) {
  const istem = hesapMetni(metin, { kaynak, hedef });
  if (uygulama === "paylas" && navigator.share) {
    const kopya = panoyaYaz(istem);
    try { await navigator.share({ text: istem }); } catch (e) { if (iptalMi(e)) throw e; }
    return { kopyalandi: await kopya, uygulama: "paylas", metin: istem };
  }
  const u = YZ_UYGULAMALAR.find((x) => x.id === (uygulama || store.ayarlar.yz?.uygulama)) || YZ_UYGULAMALAR[0];
  const kopya = panoyaYaz(istem);
  window.open(u.url(istem.length > 1800 ? "" : istem), "_blank", "noopener");
  return { kopyalandi: await kopya, uygulama: u.id, metin: istem };
}
export function googleCeviriAdresi(metin, { kaynak, hedef } = {}) {
  let t = String(metin || "").trim();
  if (t.length > 4800) t = t.slice(0, 4800).replace(/\s+\S*$/, "");   // bağlantıya sığmayan kısım kesilir
  const q = new URLSearchParams({ sl: kisaDil(kaynak) || "auto", tl: kisaDil(hedef) || varsayilanHedef(), text: t, op: "translate" });
  return `https://translate.google.com/?${q}`;
}
export function googleCeviriAc(metin, secenek) {
  window.open(googleCeviriAdresi(metin, secenek), "_blank", "noopener");
}

/* ================= Paketler ================= */
const inisler = new Map();   // "en-tr" -> { soz, ilerleme, dinleyiciler:Set }
const bitisler = new Map();  // "en-tr" -> son inişin (iptal dahil) tam bitişi
const sahtePaketler = new Map();   // ?ceviri=sahte: bellekte "yüklü" sayılan çiftler

let katalogSoz = null, katalogHata = 0;
// Yerleşik + uzak katalog. Uzak liste önbellekte durur; yoksa ya da eskidiyse internetten tazelenir.
// Tazeleme düşerse on dakika yeniden denenmez (her durum sorusunda ağa gidilmesin).
async function katalogAl({ bekleme = 5000 } = {}) {
  let kayit = null;
  try { kayit = await al("meta", "katalog"); } catch { kayit = null; }
  const eski = !kayit || Date.now() - kayit.zaman > KATALOG_OMRU;
  if (eski && cevrimici() && (katalogSoz || Date.now() - katalogHata > 600e3)) {
    katalogSoz ||= katalogYenile().catch((e) => { katalogHata = Date.now(); throw e; }).finally(() => { katalogSoz = null; });
    if (!kayit && bekleme > 0) {
      const sinir = new Promise((r) => setTimeout(r, bekleme, null));
      kayit = (await Promise.race([katalogSoz.catch(() => null), sinir])) || null;
    } else katalogSoz.catch(() => {});
  }
  const liste = [...KATALOG_YERLESIK];
  for (const c of kayit?.ciftler || []) if (!liste.some((x) => x.kaynak === c.kaynak && x.hedef === c.hedef)) liste.push(c);
  return liste;
}
// Mozilla kayıtlarındaki sha256 ile aynadaki dosyalar eşlenir; yalnız eksiksiz ve bu motorla uyumlu kuşak listelenir
// İşçide: iki büyük JSON (~650 KB) ana iş parçacığında ayrıştırılmaz, yalnız kısa liste döner
async function katalogYenile() {
  const ciftler = await isciIs("katalog", { rs: RS_KAYIT, hf: HF_LISTE, surum: MOTOR_SURUMU.source });
  const kayit = { zaman: Date.now(), ciftler: ciftler.map((c) => ({ ...c, kaynak: kisaDil(c.kaynak), hedef: kisaDil(c.hedef) })) };
  await koy("meta", "katalog", kayit);
  return kayit;
}

const toplamBoyut = (c) => c.dosyalar.reduce((t, d) => t + d.boyut, 0);
const indirmeBoyutu = (c) => c.dosyalar.reduce((t, d) => t + (d.gz || d.boyut), 0);

// [{ kaynak, hedef, boyut, indirme, durum: "yuklu" | "indirilebilir" | "iniyor", ilerleme }]
// Sıra: İngilizce ile hedef dil arası önce, sonra hedef dile çevirenler, sonra diğerleri.
export async function paketler({ bekleme = 5000 } = {}) {
  const [katalog, yuklu] = await Promise.all([
    katalogAl({ bekleme }),
    islem("paketler", "readonly", (d) => d.getAll()).catch(() => []),
  ]);
  const h = varsayilanHedef();
  const satirlar = new Map();
  for (const c of katalog) {
    satirlar.set(ciftId(c.kaynak, c.hedef), { kaynak: c.kaynak, hedef: c.hedef, boyut: toplamBoyut(c), indirme: indirmeBoyutu(c), durum: "indirilebilir", ilerleme: 0 });
  }
  for (const p of yuklu || []) {
    satirlar.set(ciftId(p.kaynak, p.hedef), { kaynak: p.kaynak, hedef: p.hedef, boyut: p.boyut, indirme: p.indirme || p.boyut, durum: "yuklu", ilerleme: 1 });
  }
  for (const [id, i] of inisler) { const s = satirlar.get(id); if (s && s.durum !== "yuklu") { s.durum = "iniyor"; s.ilerleme = i.ilerleme; } }
  if (SAHTE) for (const [id, i] of sahtePaketler) { const s = satirlar.get(id); if (s) { s.durum = i.durum; s.ilerleme = i.ilerleme; } }
  const derece = (s) => ((s.kaynak === "en" && s.hedef === h) || (s.kaynak === h && s.hedef === "en") ? 0 : s.hedef === h ? 1 : s.kaynak === h ? 2 : 3);
  return [...satirlar.values()].sort((a, b) => derece(a) - derece(b) || dilAdi(a.kaynak).localeCompare(dilAdi(b.kaynak), "tr") || dilAdi(a.hedef).localeCompare(dilAdi(b.hedef), "tr"));
}

// İndirme: dosya dosya, her dosya 2 MB'lık dilimlerle kaydedilir; kesilirse kaldığı yerden sürer (Range).
// İner inmez sha256 doğrulanır; tutmazsa dosya atılır ve "bozuk" hatası verilir.
export function paketIndir(kaynak, hedef, { ilerleme, signal } = {}) {
  const k = kisaDil(kaynak), h = kisaDil(hedef), id = ciftId(k, h);
  if (SAHTE) return sahteIndir(id, { ilerleme, signal });
  let i = inisler.get(id);
  if (!i) {
    const denetci = new AbortController();
    i = { ilerleme: 0, dinleyiciler: new Set(), denetci, istekler: 0 };
    inisler.set(id, i);
    const bildir = (oran) => {
      i.ilerleme = oran;
      for (const f of i.dinleyiciler) { try { f(oran); } catch { /* arayüz hatası inişi düşürmez */ } }
      yay({ tur: "paket", kaynak: k, hedef: h, durum: "iniyor", ilerleme: oran });
    };
    // İptal edilen önceki iniş işçide dilimini yazıp bitmeden yenisi başlamaz (dilimler karışmasın)
    const onceki = bitisler.get(id) || Promise.resolve();
    i.soz = onceki.then(() => paketIndirAsil(k, h, denetci.signal, bildir))
      .then(() => yay({ tur: "paket", kaynak: k, hedef: h, durum: "yuklu", ilerleme: 1 }),
        (e) => { yay({ tur: "paket", kaynak: k, hedef: h, durum: iptalMi(e) ? "iptal" : "hata", hata: e?.tur || e?.name }); throw e; })
      .finally(() => { if (inisler.get(id) === i) inisler.delete(id); });
    const bitis = i.soz.catch(() => {});
    bitisler.set(id, bitis);
    bitis.then(() => { if (bitisler.get(id) === bitis) bitisler.delete(id); });
  }
  // Aynı çifti isteyen her çağıran kendi ilerleme ve iptaline sahip; hepsi vazgeçince iniş durur
  i.istekler++;
  if (ilerleme) { i.dinleyiciler.add(ilerleme); ilerleme(i.ilerleme); }
  return new Promise((tamam, red) => {
    let bitti = false;
    const vazgec = () => {
      if (bitti) return;
      bitti = true;
      if (ilerleme) i.dinleyiciler.delete(ilerleme);
      if (--i.istekler <= 0) {
        i.denetci.abort();
        if (inisler.get(id) === i) inisler.delete(id);   // liste hemen "indirilebilir" göstersin
        durumBellek.clear();
      }
      red(iptalHatasi());
    };
    if (signal?.aborted) return vazgec();
    signal?.addEventListener("abort", vazgec, { once: true });
    i.soz.then((v) => { if (!bitti) { bitti = true; tamam(v); } }, (e) => { if (!bitti) { bitti = true; red(e); } });
  });
}

async function paketIndirAsil(k, h, signal, bildir) {
  if (await yukluPaket(k, h)) { bildir(1); return; }
  const bul = (liste) => liste.find((x) => x.kaynak === k && x.hedef === h);
  const c = bul(KATALOG_YERLESIK) || bul(await katalogAl({ bekleme: 8000 }));
  if (!c) throw new CeviriHatasi("paket-yok", `${k}-${h} için paket yok`);
  if (!cevrimici()) throw new CeviriHatasi("ag", "Bağlantı yok");
  // Yer: yarım kalanlar düşülerek bakılır; kalıcı depo istenir (kurulu uygulamada sessizce verilir)
  try {
    const { quota, usage } = (await navigator.storage?.estimate?.()) || {};
    if (quota && quota - usage < toplamBoyut(c) * 1.1) throw new CeviriHatasi("yer", "Yer yetmiyor");
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) { if (e instanceof CeviriHatasi) throw e; }

  const id = ciftId(k, h);
  const toplam = indirmeBoyutu(c);
  let biten = 0;
  for (const d of c.dosyalar) {
    if (signal.aborted) throw iptalHatasi();
    const anahtar = `${id}/${d.tur}`;
    const mevcut = await al("dosyalar", anahtar).catch(() => null);
    if (mevcut && mevcut.size === d.boyut) { biten += d.gz || d.boyut; bildir(biten / toplam); continue; }
    await dosyaIndir(id, d, signal, (n) => bildir(Math.min(0.999, (biten + n) / toplam)));
    biten += d.gz || d.boyut;
    bildir(Math.min(0.999, biten / toplam));
  }
  // Motor dosyaları (JS + WASM) da internetsiz açılabilmeli; yoksa paket "yüklü" sayılmaz
  if (signal.aborted) throw iptalHatasi();
  await isciIs("motorIsit", {}, { signal });
  if (signal.aborted) throw iptalHatasi();
  await koy("paketler", id, {
    kaynak: k, hedef: h, surum: c.surum, boyut: toplamBoyut(c), indirme: toplam, zaman: Date.now(),
    dosyalar: c.dosyalar.map(({ tur, ad, boyut, sha256 }) => ({ tur, ad, boyut, sha256 })),
  });
  bildir(1);
}

function adresler(id, d) {
  const liste = [];
  if (AYNA) {
    const taban = AYNA.replace(/\/?$/, "/");
    if (d.gz) liste.push({ url: `${taban}${id}/${d.ad}.gz`, gz: true });
    liste.push({ url: `${taban}${id}/${d.ad}`, gz: false });
  }
  if (d.gz) liste.push({ url: HF_TABAN + d.yol + ".gz", gz: true });
  liste.push({ url: HF_TABAN + d.yol, gz: false });
  return liste;
}
// İndirme, gzip açma, sha256 ve kayıt işçide (ceviri-isci.js "indir"); burada yalnız ilerleme sayılır
function dosyaIndir(id, d, signal, ilerle) {
  return isciIs("indir", { anahtar: `${id}/${d.tur}`, adresler: adresler(id, d), boyut: d.boyut, sha256: d.sha256, ad: d.ad }, { ara: ilerle, signal });
}

export async function paketSil(kaynak, hedef) {
  const k = kisaDil(kaynak), h = kisaDil(hedef), id = ciftId(k, h);
  if (SAHTE && sahtePaketler.has(id)) { sahtePaketler.delete(id); yay({ tur: "paket", kaynak: k, hedef: h, durum: "silindi" }); return; }
  inisler.get(id)?.denetci.abort();
  const dosyaKeys = await anahtarlar("dosyalar", id + "/").catch(() => []);
  const yarimKeys = await anahtarlar("yarim", id + "/").catch(() => []);
  await islem(["paketler", "dosyalar", "yarim"], "readwrite", (d) => {
    d.paketler.delete(id);
    dosyaKeys.forEach((x) => d.dosyalar.delete(x));
    yarimKeys.forEach((x) => d.yarim.delete(x));
  });
  for (const a of [...yuklenen.keys()]) if (a.split("+").includes(id)) yuklenen.delete(a);
  if (isci) isciIs("bosalt", { cift: id }).catch(() => {});
  yay({ tur: "paket", kaynak: k, hedef: h, durum: "silindi" });
}

// ?ceviri=sahte: indirme ilerlemesi ve iptal taklidi, gerçek dosya inmez
function sahteIndir(id, { ilerleme, signal }) {
  const [k, h] = id.split("-");
  return new Promise((tamam, red) => {
    const s = { durum: "iniyor", ilerleme: 0 };
    sahtePaketler.set(id, s);
    let n = 0;
    const z = setInterval(() => {
      n++;
      s.ilerleme = Math.min(1, n / 20);
      ilerleme?.(s.ilerleme);
      yay({ tur: "paket", kaynak: k, hedef: h, durum: "iniyor", ilerleme: s.ilerleme });
      if (n >= 20) { clearInterval(z); s.durum = "yuklu"; yay({ tur: "paket", kaynak: k, hedef: h, durum: "yuklu", ilerleme: 1 }); tamam(); }
    }, 120);
    signal?.addEventListener("abort", () => { clearInterval(z); sahtePaketler.delete(id); red(iptalHatasi()); }, { once: true });
  });
}
