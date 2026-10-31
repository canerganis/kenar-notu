// Kalıcı kayıt: IndexedDB düzeni, içe aktarma, yedek.
// Sözleşme OZELLIKLER-3 "kayit.js". Ek olarak app.js'in kullandığı kayitKur, durumYukle, kaydetPlanla, hemenKaydet, sifirla, kayitBeklet; ek dosya API'si OZELLIKLER-4.
//
// Veritabanı "kenar-notu-tasarim" (sürüm 2):
//   durum:    "kitaplik"     -> { surum: 2, zaman, belgeler (veri ve kapakGorsel olmadan), klasorler,
//                                 ornekSurum (örnek verinin sürümü, ortak.js ORNEK_SURUM; yoksa bilinmiyor) }
//             "veri:<id>"    -> belgenin düzenleyici/okuyucu verisi
//             "kapak:<id>"   -> içe aktarılan belgenin kapak görseli (dataURL)
//             "kart:<id>"    -> Tekrar kartı, kart başına (12. tur); "kartSira" -> kart id'lerinin sırası
//             "kartlar"      -> 12. turdan önceki tek kart kaydı; açılışta okunur, ilk yazmada kart başına bölünüp silinir
//             "kirpintilar", "yz" (yapay zekâ ayarları, anahtarlar dahil; yedeğe girmez)
//             "onceki:<id>:<zaman>" -> belgenin önceki hâli (veri kopyası); "oncekiDizin:<id>" -> { liste: [{ anahtar, gun, zaman, alindi, ozet, boyut, donus }], buyuk }
//             "yedekKlasoru" -> otomatik yedek klasörü: { tutamac (FileSystemDirectoryHandle), son, dosya, hata }
//             "derlemeler"   -> İzlerim'de birleştirilen defterler: [{ id, ad, olusturma, girdiler: [{ belgeId, izId }] }]
//   Belge kaydında dil (10. tur): belge.dil kısa dil kodu ("en"; null: bakıldı, bulunamadı), belge.dilElle kullanıcı seçtiyse true.
//   Çeviri önbelleği ve paketleri ceviri.js'in kendi veritabanında ("kenar-notu-ceviri"); yedeğe girmez.
//   dosyalar: <id>           -> ham PDF/EPUB/CBZ (Blob)
//             "ek/<id>/<ad>" -> belgenin ek dosyaları (ses kaydı, görsel; OZELLIKLER-4)
// 1. sürümde bütün kitaplık "kitaplik" altında tek kayıttı (surum: 1); ilk açılışta bir kez bölünür.

import { bus, store, belgeBul, yeniId, kartEkle, kartSil, KLASORLER, CILT_RENKLERI, ORNEK_SURUM } from "./ortak.js";
import { arsivAc, okumaHatasi, yedekUret, PARCALI, oncekiAnahtari, oncekiDizinAnahtari, dizinTemizle, ozetCikar,
  oncekiBuda, oncekiKopyaAl } from "./yedek-isci.js";

const VT = { ad: "kenar-notu-tasarim", surum: 2 };
const LISTE = "kitaplik", YZ = "yz";
const veriAnahtari = (id) => "veri:" + id;
const kapakAnahtari = (id) => "kapak:" + id;
const KART = "kart:", KART_SIRA = "kartSira", ESKI_KARTLAR = "kartlar";
const kartAnahtari = (id) => KART + id;
const TUR_MIME = { pdf: "application/pdf", epub: "application/epub+zip", cizgi: "application/vnd.comicbook+zip" };

/* ---------- veritabanı ---------- */
let vtSoz = null;
function vtAc() {
  vtSoz ||= new Promise((tamam, hata) => {
    let bitti = false;
    const q = indexedDB.open(VT.ad, VT.surum);
    // Eski sürüm başka sekmede açıkken yükseltme bekler (bazen "blocked" bile gelmez); açılış takılı kalmasın
    const engel = () => {
      if (bitti) return;
      bitti = true;
      vtSoz = null;
      hata(Object.assign(new Error("engellendi"), { kod: "engel" }));
    };
    const sure = setTimeout(engel, 8000);
    q.onupgradeneeded = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains("durum")) db.createObjectStore("durum");
      if (!db.objectStoreNames.contains("dosyalar")) db.createObjectStore("dosyalar");
    };
    q.onsuccess = () => {
      clearTimeout(sure);
      const db = q.result;
      // Yeni sürüm başka sekmede açılırsa bu bağlantı yol verir
      db.onversionchange = () => { db.close(); vtSoz = null; };
      if (bitti) { db.close(); return; }   // geç geldi: bu oturum kayıtsız sürüyor
      bitti = true;
      tamam(db);
    };
    q.onerror = () => { clearTimeout(sure); if (bitti) return; bitti = true; vtSoz = null; hata(q.error); };
    q.onblocked = () => { clearTimeout(sure); engel(); };
  });
  return vtSoz;
}
// fn(depolar) içinde istekler açılır; dönen istek (ya da dizi) işlem bitince sonuçlanır
async function islem(depolar, kip, fn) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    const t = db.transaction(depolar, kip);
    const d = Object.fromEntries([].concat(depolar).map((ad) => [ad, t.objectStore(ad)]));
    const q = fn(d, t);
    t.oncomplete = () => tamam(Array.isArray(q) ? q.map((x) => x?.result) : q?.result);
    t.onerror = t.onabort = () => hata(t.error);
  });
}
const aralik = (on) => IDBKeyRange.bound(on, on + "￿");

/* ---------- dosyalar ---------- */
export async function dosyaKaydet(belgeId, blob) {
  await islem("dosyalar", "readwrite", (d) => d.dosyalar.put(blob, belgeId));
}
export async function dosyaGetir(belgeId) {
  try { return (await islem("dosyalar", "readonly", (d) => d.dosyalar.get(belgeId))) || null; }
  catch { return null; }
}
export async function dosyaSil(belgeId) {
  await islem(["dosyalar", "durum"], "readwrite", (d) => [
    d.dosyalar.delete(belgeId), d.durum.delete(veriAnahtari(belgeId)), d.durum.delete(kapakAnahtari(belgeId)),
    d.dosyalar.delete(aralik(ekOnEki(belgeId))),
    d.durum.delete(aralik(`onceki:${belgeId}:`)), d.durum.delete(oncekiDizinAnahtari(belgeId)),
  ]);
}

/* ---------- ek dosyalar (OZELLIKLER-4 §1.4) ---------- */
// Belgeye bağlı ses kayıtları, görseller: "dosyalar" deposunda "ek/<belgeId>/<ad>" anahtarıyla
const ekOnEki = (belgeId) => `ek/${belgeId}/`;
const ekAnahtari = (belgeId, ad) => ekOnEki(belgeId) + String(ad);
const ekBelgesi = (anahtar) => String(anahtar).slice(3, String(anahtar).indexOf("/", 3));
const ekMi = (anahtar) => typeof anahtar === "string" && anahtar.startsWith("ek/");

export async function ekDosyaKaydet(belgeId, ad, blob) {
  if (!belgeId || !ad || !(blob instanceof Blob)) throw new Error("ekDosyaKaydet: belgeId, ad ve Blob gerekir");
  await islem("dosyalar", "readwrite", (d) => d.dosyalar.put(blob, ekAnahtari(belgeId, ad)));
  kaliciIste();
}
export async function ekDosyaGetir(belgeId, ad) {
  try { return (await islem("dosyalar", "readonly", (d) => d.dosyalar.get(ekAnahtari(belgeId, ad)))) || null; }
  catch { return null; }
}
export async function ekDosyaSil(belgeId, ad) {
  await islem("dosyalar", "readwrite", (d) => d.dosyalar.delete(ekAnahtari(belgeId, ad)));
}
// -> [{ ad, boyut, tur }]
export async function ekDosyalar(belgeId) {
  try {
    const on = ekOnEki(belgeId);
    const [anahtarlar, bloblar] = await islem("dosyalar", "readonly", (d) =>
      [d.dosyalar.getAllKeys(aralik(on)), d.dosyalar.getAll(aralik(on))]);
    return anahtarlar.map((k, i) => ({ ad: k.slice(on.length), boyut: bloblar[i]?.size || 0, tur: bloblar[i]?.type || "" }));
  } catch { return []; }
}

/* ---------- kayıt düzeni ---------- */
const kirli = new Set();          // verisi yazılacak belgeler
const degisen = new Set();        // içeriği açıkça değişen belgeler (degisim damgası; yedek birleşiminde kullanılır)
const kirliKartlar = new Set();   // yazılacak ya da silinecek kartlar (kartlarKirli: hepsi)
let kartSiraKirli = false;
let kartlarKirli = false, kirpintilarKirli = false, yzKirli = false, derlemelerKirli = false, hepsiKirli = false;
let kilit = false, zaman = 0;
let ayar = { oncesi: () => [], mesgul: () => false, yakinda: () => false };
let bekleyenBas = 0;   // yazılmamış ilk değişikliğin zamanı (kalem havadayken erteleme sınırı)
// app.js bildirim olarak gösterir: kod "yazma" | "baska" | "serbest" | "degisti"
const uyar = (kod) => bus.emit("kayit:uyari", { kod });

/* ---------- tek yazan sekme ---------- */
// Aynı anda tek sekme yazar: PWA penceresi ve bir sekme açıkken eski liste yeni belgeleri silmesin.
// Kilidi alamayan sekme kaydı okur ama yazmaz (kilit); öbür pencere kapanınca yenilemesi söylenir.
let yazarDegil = false, kilitBizde = false;
export const baskaPencere = () => yazarDegil;
function yazarKilidiAl() {
  if (!navigator.locks?.request) return Promise.resolve(true);
  return new Promise((tamam) => {
    navigator.locks.request("kn-yazar", { ifAvailable: true }, (l) => {
      tamam(!!l);
      kilitBizde = !!l;
      if (l) return new Promise(() => {});   // sayfa kapanana kadar tutulur
    }).catch(() => tamam(true));
  });
}
function serbestBekle() {
  navigator.locks.request("kn-yazar", () => uyar("serbest")).catch(() => {});
}
// Liste damgası: yazmadan önce kayıttaki "zaman" bu sekmenin yüklediği ya da yazdığı bir değer mi diye bakılır.
// Kilit yoksa (düz http) ya da bir şey ters giderse son güvence: başka sekme yazdıysa bu sekme durur.
const izinli = new Set();
let listeVardi = false;
function damgaEkle(z) {
  izinli.add(z);
  if (izinli.size > 50) izinli.delete(izinli.values().next().value);
}

// Belgenin liste kaydı: veri ve kapak görseli ayrı anahtarlarda durur
const listeBelgesi = ({ veri, kapakGorsel, ...b }) => b;
// Kayıttaki örnek verinin sürümü: yeni kurulan örnek güncel sürümdedir. Geri yüklenen kayıt kendi sürümünü
// getirir (yoksa 0, bilinmiyor); app.js eski örneği taşıyınca ornekSurumAyarla(ORNEK_SURUM) der.
let ornekSurumu = ORNEK_SURUM;
export const ornekSurumAyarla = (n) => { ornekSurumu = Number(n) || 0; };
// Örnek çizgi roman (9. tur) kitaplığa bir kez girer: eklenince ya da "Boş başla" seçilince işaretlenir,
// kullanıcı silerse geri gelmez. Sıfırlamada kayıtla birlikte gider.
let ornekCizgi = false;
export const ornekCizgiVar = () => ornekCizgi;
export const ornekCizgiAyarla = (v = true) => { ornekCizgi = !!v; };
function listeKaydi(belgeler = store.belgeler, klasorler = KLASORLER) {
  const k = { surum: VT.surum, zaman: Date.now(), klasorler, belgeler: belgeler.map(listeBelgesi), ornekSurum: ornekSurumu };
  if (ornekCizgi) k.ornekCizgi = true;
  damgaEkle(k.zaman);
  return k;
}

// Açılışta: kayıt varsa örnek durumun yerine geçer.
// Dönen: { geri: geri yüklendi mi, kartlarVar: kayıtta kart alanı var mı, engel: veritabanı açılamadı mı,
//          kod: "okuma" (kayıt okunamadı), baska: kitaplık başka pencerede açık, bu sekme yazmaz,
//          ornekSurum: geri yüklenen örnek verinin sürümü (0: bilinmiyor, ORNEK_SURUM'dan önceki kayıt) }
export async function durumYukle() {
  // Yenilemede eski sayfanın kilidi bir an sürebilir: bir kez daha denenir
  let yazar = await yazarKilidiAl();
  if (!yazar) { await new Promise((r) => setTimeout(r, 400)); yazar = await yazarKilidiAl(); }
  if (!yazar) { yazarDegil = kilit = true; serbestBekle(); }
  const baska = yazarDegil;
  let liste, yz, kartlar, kirpintilar, derlemeler;
  try {
    [liste, yz, kartlar, kirpintilar, derlemeler] = await islem("durum", "readonly", (d) =>
      [d.durum.get(LISTE), d.durum.get(YZ), d.durum.get("kartlar"), d.durum.get("kirpintilar"), d.durum.get("derlemeler")]);
  } catch (hata) {
    console.warn("[kenar-notu] Kayıt açılamadı:", hata);
    // Örnek durum gerçek kaydın üstüne yazılmasın: bu oturumda kitaplık yazılmaz
    kilit = true;
    return { geri: false, kartlarVar: false, engel: true, yz: null };
  }
  try {
    if (!liste || !Array.isArray(liste.belgeler)) { hepsiKirli = !baska; return { geri: false, kartlarVar: false, yz, baska }; }

    if (liste.surum === 1) {
      if (baska) return { geri: false, kartlarVar: false, engel: true, baska, yz };
      return await tasi(liste, yz);
    }
    if (liste.surum !== VT.surum) { hepsiKirli = !baska; return { geri: false, kartlarVar: false, yz, baska }; }

    const [veriAnahtarlar, veriler, kapakAnahtarlar, kapaklar, kartAnahtarlar, kartKayitlari, kartSira] = await islem("durum", "readonly", (d) => [
      d.durum.getAllKeys(aralik("veri:")), d.durum.getAll(aralik("veri:")),
      d.durum.getAllKeys(aralik("kapak:")), d.durum.getAll(aralik("kapak:")),
      d.durum.getAllKeys(aralik(KART)), d.durum.getAll(aralik(KART)), d.durum.get(KART_SIRA),
    ]);
    const veriMap = new Map(veriAnahtarlar.map((k, i) => [k.slice(5), veriler[i]]));
    const kapakMap = new Map(kapakAnahtarlar.map((k, i) => [k.slice(6), kapaklar[i]]));
    for (const b of liste.belgeler) {
      b.veri = veriMap.get(b.id) ?? null;
      if (kapakMap.has(b.id)) b.kapakGorsel = kapakMap.get(b.id);
    }
    store.belgeler.splice(0, store.belgeler.length, ...liste.belgeler);
    if (Array.isArray(liste.klasorler)) KLASORLER.splice(0, KLASORLER.length, ...liste.klasorler);
    store.kirpintilar.splice(0, store.kirpintilar.length, ...(Array.isArray(kirpintilar) ? kirpintilar : []));
    const kartlarVar = Array.isArray(kartlar) || Array.isArray(kartSira) || kartAnahtarlar.length > 0;
    if (kartlarVar) store.kartlar.splice(0, store.kartlar.length, ...kartlariKur(kartAnahtarlar, kartKayitlari, kartSira, kartlar, baska));
    store.derlemeler.splice(0, store.derlemeler.length, ...derlemeTemizle(derlemeler));
    damgaEkle(liste.zaman);
    listeVardi = true;
    ornekSurumAyarla(liste.ornekSurum);
    ornekCizgi = !!liste.ornekCizgi;
    // Silinmiş belgelerden kalan veri, kapak ve dosyalar sessizce temizlenir
    const idler = new Set(liste.belgeler.map((b) => b.id));
    setTimeout(() => yetimleriSil(idler, [...veriMap.keys(), ...kapakMap.keys()]), 4000);
    // Otomatik yedek kayıtlı kitaplıkla başlar (karşılama ve okunamayan kayıtta değil)
    if (!baska) setTimeout(otoYedekKur, 0);
    return { geri: true, kartlarVar, yz, baska, ornekSurum: ornekSurumu };
  } catch (hata) {
    // Okunamayan kayıt örneklerle ezilmesin: bu oturum yazmaz, uygulama yine açılır
    console.warn("[kenar-notu] Kayıt okunamadı:", hata);
    kilit = true;
    return { geri: false, kartlarVar: false, engel: true, kod: "okuma", yz };
  }
}

// 1. sürüm tek kaydı bölünür; işlem tek seferde, yarım kalırsa eski kayıt yerinde durur
async function tasi(eski, yz) {
  const belgeler = eski.belgeler;
  const kartlarVar = Array.isArray(eski.kartlar);
  ornekSurumAyarla(0);   // 1. sürüm kayıt örnek sürümünden önce: app.js eski örneği taşır
  await islem("durum", "readwrite", (d) => {
    for (const b of belgeler) if (b.veri != null) d.durum.put(b.veri, veriAnahtari(b.id));
    d.durum.put(eski.kirpintilar || [], "kirpintilar");
    if (kartlarVar) kartlariYaz(d.durum, { hepsi: true, kartlar: eski.kartlar.filter((k) => k && k.id) })();
    return d.durum.put(listeKaydi(belgeler.map(({ veri, ...b }) => b), eski.klasorler || KLASORLER), LISTE);
  });
  listeVardi = true;
  store.belgeler.splice(0, store.belgeler.length, ...belgeler.map((b) => ({ ...b, veri: b.veri ?? null })));
  store.kirpintilar.splice(0, store.kirpintilar.length, ...(eski.kirpintilar || []));
  if (Array.isArray(eski.klasorler)) KLASORLER.splice(0, KLASORLER.length, ...eski.klasorler);
  if (kartlarVar) store.kartlar.splice(0, store.kartlar.length, ...eski.kartlar.filter((k) => k && k.id));
  console.info("[kenar-notu] Kayıt yeni düzene taşındı:", belgeler.length, "belge");
  return { geri: true, kartlarVar, yz, tasindi: true, ornekSurum: 0 };
}

// Bozuk ya da eksik derleme kaydı yok sayılır; girdisi olmayan derleme de kalır (adı var)
function derlemeTemizle(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.filter((d) => d && d.id && typeof d.ad === "string")
    .map((d) => ({ ...d, girdiler: Array.isArray(d.girdiler) ? d.girdiler.filter((g) => g && g.belgeId && g.izId) : [] }));
}

// Kartlar kart başına kayıtlı (sıra ayrı anahtarda). Eski tek "kartlar" kaydı varsa (12. turdan önce ya da eski
// sürüm sonradan yazdıysa) birleştirilir: kart başına kayıtta olmayan kart eklenir, ikisinde de olanda geçmişi
// uzun olan kalır. Bu sekme yazıyorsa ilk yazmada hepsi kart başına yazılır ve eski kayıt aynı işlemde silinir.
const kayitliKartlar = new Set();   // kayıtta "kart:<id>" anahtarı olan kartlar
function kartlariKur(anahtarlar, kayitlar, sira, eski, baska) {
  const harita = new Map();
  anahtarlar.forEach((a, i) => {
    const k = kayitlar[i];
    kayitliKartlar.add(a.slice(KART.length));
    if (k && k.id) harita.set(k.id, k);
  });
  const sonuc = [];
  const goruldu = new Set();
  for (const id of Array.isArray(sira) ? sira : []) {
    const k = harita.get(id);
    if (k && !goruldu.has(id)) { sonuc.push(k); goruldu.add(id); }
  }
  // Sırada olmayan kayıtlı kart da kaybolmaz: sona eklenir
  for (const [id, k] of harita) if (!goruldu.has(id)) { sonuc.push(k); goruldu.add(id); }
  if (!Array.isArray(eski)) return sonuc;
  const yer = new Map(sonuc.map((k, i) => [k.id, i]));
  const yeniler = [];
  for (const k of eski) {
    if (!k || !k.id) continue;
    const i = yer.get(k.id);
    if (i == null) { yer.set(k.id, -1); yeniler.push(k); }
    else if (i >= 0 && (k.gecmis?.length || 0) > (sonuc[i].gecmis?.length || 0)) sonuc[i] = k;
  }
  if (!baska) { kartlarKirli = true; setTimeout(kaydetPlanla, 0); }
  return [...yeniler, ...sonuc];
}

async function yetimleriSil(idler, anahtarIdler) {
  if (kilit) return;
  try {
    // Kayıttaki güncel liste de sayılır: arada başka sekmenin eklediği belge silinmesin
    const guncel = await islem("durum", "readonly", (d) => d.durum.get(LISTE));
    for (const b of guncel?.belgeler || []) idler.add(b.id);
    const anahtarlar = await islem("dosyalar", "readonly", (d) => d.dosyalar.getAllKeys());
    const oncekiler = await islem("durum", "readonly", (d) => d.durum.getAllKeys(aralik("oncekiDizin:")));
    anahtarIdler = [...anahtarIdler, ...oncekiler.map((k) => k.slice("oncekiDizin:".length))];
    // Ek dosyalar belgesine göre: belgesi yaşıyorsa kalır
    const dosyaIdler = anahtarlar.map((k) => (ekMi(k) ? ekBelgesi(k) : k));
    // "Geri al" bildirimi açık duran belge de kalır
    const silinecek = [...new Set([...anahtarIdler, ...dosyaIdler])].filter((id) => !idler.has(id) && !belgeBul(id) && !silBekleyen.has(id));
    for (const id of silinecek) await dosyaSil(id);
  } catch { /* bir dahaki açılışa */ }
}

// app.js bir kez çağırır. oncesi(): açık ekranlara kaydet() dedirir, verisi yazılacak belge id'lerini döner.
// mesgul(): kalem sayfadayken true; yazma kalkana kadar ertelenir.
// yakinda(): S Pen ekranın üstünde havadayken true; yazma en çok 20 sn ertelenir (büyük belgede
// yapılandırılmış kopya tablette yüzlerce ms sürebilir, kalem inince beklemesin).
export function kayitKur({ oncesi, mesgul, yakinda } = {}) {
  if (oncesi) ayar.oncesi = oncesi;
  if (mesgul) ayar.mesgul = mesgul;
  if (yakinda) ayar.yakinda = yakinda;
  bus.on("belgeler", (o) => {
    const id = o?.id || o?.belge?.id;
    if (id && o?.tur !== "sil") kirli.add(id);
    if (id && o?.tur === "sil") silBekleyen.add(id);
    if (id && o?.tur === "ekle") silBekleyen.delete(id);
    if (id && o?.tur === "not") { degisen.add(id); goruntuIste(id); }
    if (o?.tur !== "sayfa" && o?.tur !== "kapak") yedekDegisti = true;
    // Ekran kapanınca ("sayfa") hemen yazılır: kitaplığa dönüp uygulamadan çıkan yazdığını kaybetmesin
    if (o?.tur === "sayfa" && id) hemenKaydet();
    else kaydetPlanla();
  });
  const icerik = (o) => { if (o?.belgeId) { kirli.add(o.belgeId); degisen.add(o.belgeId); goruntuIste(o.belgeId); } yedekDegisti = true; kaydetPlanla(); };
  bus.on("belge:degisti", icerik);
  bus.on("asistan:not", icerik);
  bus.on("kirpintilar", () => { kirpintilarKirli = true; yedekDegisti = true; kaydetPlanla(); });
  // Kart başına yazılır: bir cevap yalnız o kartı yazar. Kartı belli olmayan olay bütün kartları yazdırır.
  bus.on("kartlar", (o) => {
    const id = o?.kart?.id;
    if (id && (o.tur === "ekle" || o.tur === "guncelle" || o.tur === "sil")) {
      kirliKartlar.add(id);
      if (o.tur !== "guncelle") kartSiraKirli = true;
    } else kartlarKirli = true;
    yedekDegisti = true;
    kaydetPlanla();
  });
  bus.on("derlemeler", () => { derlemelerKirli = true; yedekDegisti = true; kaydetPlanla(); });
  bus.on("ayarlar", () => { yzKirli = true; kaydetPlanla(); });
  document.addEventListener("pointerup", kaydetPlanla, { capture: true, passive: true });
  document.addEventListener("input", kaydetPlanla, { capture: true, passive: true });
  // Android Chrome arka plandaki sekmeyi kapatabilir: gizlenince her şey hemen yazılır
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") cikisKaydi = hemenKaydet({ tam: true, cikis: true }); });
  addEventListener("pagehide", () => hemenKaydet({ tam: true, cikis: true }));
}

export function kaydetPlanla() {
  if (kilit || beklet) return;
  clearTimeout(zaman);
  // Kalem sayfadayken yazılmaz; kalkınca 1,5 sn sonra
  bekleyenBas ||= Date.now();
  zaman = setTimeout(() => {
    if (ayar.mesgul() || (ayar.yakinda() && Date.now() - bekleyenBas < 20000)) return kaydetPlanla();
    // Tarayıcı boş bir an bulunca (en geç 1 sn): bir kare çizimiyle çakışmasın
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => { if (!zaman) (ayar.mesgul() ? kaydetPlanla() : hemenKaydet()); }, { timeout: 1000 });
    else hemenKaydet();
    zaman = 0;
  }, 1500);
}

// tam: liste dışındaki kartlar ve kırpıntılar da değişmemiş olsa yazılır (sekme gizlenirken)
// Dönen söz yazıldıysa true, yazılamadıysa false olur (hata fırlatmaz)
// cikis: sayfa gidiyor (yenileme, kapanış). Yazar kilidi bu sekmedeyse damga okunmadan hemen yazılır:
// okumanın cevabını beklerken sayfa kapanır ve yazma hiç gitmez (son 2 sn'nin izi kaybolurdu)
export function hemenKaydet({ tam = false, cikis = false } = {}) {
  clearTimeout(zaman);
  zaman = 0;
  bekleyenBas = 0;
  if (kilit || beklet) return Promise.resolve(false);
  let acikIdler = [];
  try { acikIdler = ayar.oncesi() || []; } catch { /* açık ekran kendi konumunu yazamadıysa son hâli yeter */ }
  const idler = new Set([...kirli, ...acikIdler]);
  kirli.clear();
  const hepsi = hepsiKirli, kirpY = tam || hepsi || kirpintilarKirli, yzY = tam || hepsi || yzKirli;
  const derY = tam || hepsi || derlemelerKirli;
  // Kartlar gizlenirken de yalnız değişenler yazılır (bin görselli kartı her çıkışta yazmak yarım saniye sürer)
  const kartHepsi = hepsi || kartlarKirli, kartIdler = kartHepsi ? [] : [...kirliKartlar], siraY = kartHepsi || kartSiraKirli;
  const kartY = kartHepsi || kartIdler.length > 0 || siraY;
  hepsiKirli = kartlarKirli = kirpintilarKirli = yzKirli = derlemelerKirli = kartSiraKirli = false;
  kirliKartlar.clear();
  // Bugün ilk kez değişen belgenin kayıttaki hâli önce kopyalanır (önceki hâl); o belgenin verisi kopyadan sonra
  // yazılır. Çıkışta beklenmez: veri önce gider, kopya bir dahaki yazmaya kalır.
  const kopyalar = new Map();
  if (!cikis && goruntuBekleyen.size) {
    for (const id of goruntuBekleyen) kopyalar.set(id, goruntuAl(id));
    goruntuBekleyen.clear();
  }
  // İçeriği değişen belge damgalanır: yedekten yüklerken hangi sürümün yeni olduğu buna bakar
  const simdi = Date.now();
  for (const id of degisen) { const b = belgeBul(id); if (b) b.degisim = simdi; }
  degisen.clear();
  // Ayrı işlemler: liste önce ve tek başına gider. Büyük bir belgenin ya da kırpıntıların kota hatası
  // ilerlemeyi, yeni belgeleri ve öbür belgelerin verisini götürmez. put kopyayı işlem sırası gelince alır.
  const hizli = cikis && kilitBizde;
  const yaz = (fn, geri, tamam) => denetliYaz(fn, hizli).then(() => { tamam?.(); return true; }, (hata) => { geri(); return hata; });
  const isler = [yaz((d) => d.put(listeKaydi(), LISTE), () => {})];
  let kartSonuc = null;
  const kartGeri = () => {
    kartlarKirli ||= kartHepsi;
    for (const id of kartIdler) kirliKartlar.add(id);
    kartSiraKirli ||= siraY;
    yzKirli ||= yzY;
    derlemelerKirli ||= derY;
  };
  const kartIsi = (atla) => yaz((d) => {
    if (kartY) kartSonuc = kartlariYaz(d, { hepsi: kartHepsi, idler: kartIdler, sira: siraY, atla });
    if (derY) d.put(store.derlemeler, "derlemeler");
    if (yzY) { try { d.put(store.ayarlar.yz, YZ); } catch { /* kopyalanamayan alan */ } }
  }, kartGeri, () => kartSonuc?.());
  // Bütün kartlar yazılacaksa (göç, toplu değişiklik) ve sayfa gitmiyorsa önce küçük işlemlerle: bin görselli kartın
  // tek kopyası ekranı saniyelerce tutardı. Son işlem kalanları, sırayı ve silinenleri yazar.
  const parcali = kartHepsi && !hizli && store.kartlar.length > KART_PARCA * 2;
  if (kartY || yzY || derY) isler.push(parcali ? kartlariParcaParca().then(kartIsi, (hata) => { kartGeri(); return hata; }) : kartIsi(null));
  // Büyük kopyalar (kırpıntı görselleri, belge verisi) işlem sırası gelince alınır: o arada kalem indiyse
  // yazılmaz, kalem kalkınca yeniden planlanır (gizlenirken beklenmez)
  const kalemInik = () => !tam && ayar.mesgul();
  if (kirpY) isler.push(yaz((d) => { if (kalemInik()) return false; d.put(store.kirpintilar, "kirpintilar"); }, () => { kirpintilarKirli = true; }));
  for (const id of idler) {
    const b = belgeBul(id);
    if (b && b.veri == null && veriSilinecek.has(id)) {
      // Baştan kurulacak örnek: eski verisi silinir, belge açılınca güncel örnekle kurulur
      isler.push(yaz((d) => { d.delete(veriAnahtari(id)); }, () => kirli.add(id)));
      continue;
    }
    if (b?.veri == null) continue;
    const veriYaz = () => yaz((d) => {
      if (kalemInik()) return false;
      try { d.put(b.veri, veriAnahtari(id)); } catch (hata) { console.warn("[kenar-notu] Veri yazılamadı:", id, hata); }
    }, () => kirli.add(id));
    isler.push(kopyalar.has(id) ? kopyalar.get(id).then(veriYaz, veriYaz) : veriYaz());
  }
  return Promise.all(isler).then((sonuclar) => {
    const ertelenen = sonuclar.some((s) => s?.kod === "ertele");
    const hatalar = sonuclar.filter((s) => s !== true && s?.kod !== "ertele");
    if (ertelenen && !kilit) kaydetPlanla();
    if (!hatalar.length) { yazmaHatasi = false; kaliciIste(); return !ertelenen; }
    if (hatalar.some((h) => h?.kod === "degisti")) {
      // Başka sekme yazmış: bu sekmenin eski hâli onun üstüne yazılmaz
      kilit = true;
      clearTimeout(zaman);
      uyar("degisti");
    } else {
      console.warn("[kenar-notu] Kayıt yazılamadı:", hatalar[0]);
      yazmaHatasi = true;
      uyar("yazma");
    }
    return false;
  });
}
let yazmaHatasi = false;
export const yazmaHatasiVar = () => yazmaHatasi;

// Eski sürümdeki örnek belgenin verisi bırakılır (app.js örnek taşıması): kayıttaki veri bir sonraki yazmada
// silinir. Bu arada belge açılırsa yeni veri kurulur ve onun üstüne yazılır.
const veriSilinecek = new Set();
export function ornekVeriSifirla(belge) {
  belge.veri = null;
  veriSilinecek.add(belge.id);
  kirli.add(belge.id);
}

// Kartları açık bir "durum" işlemine yazar. hepsi: bütün kartlar yazılır, kayıtta kalıp listede olmayanlar ve eski tek
// kayıt silinir. Değilse yalnız idler: listede varsa yazılır, yoksa silinir. Dönen işlev işlem bitince çağrılır
// (kayıtlı kart kümesi ancak yazma kesinleşince güncellenir).
function kartlariYaz(d, { hepsi = false, idler = [], sira = false, kartlar = store.kartlar, atla = null } = {}) {
  const yazilan = [], silinen = [];
  if (hepsi) {
    const canli = new Set();
    for (const k of kartlar) {
      if (!k?.id || canli.has(k.id)) continue;
      if (atla?.has(k.id)) { canli.add(k.id); continue; }
      d.put(k, kartAnahtari(k.id));
      canli.add(k.id);
      yazilan.push(k.id);
    }
    for (const id of kayitliKartlar) if (!canli.has(id)) { d.delete(kartAnahtari(id)); silinen.push(id); }
    d.delete(ESKI_KARTLAR);
  } else if (idler.length) {
    const harita = idler.length > 4 ? new Map(kartlar.map((k) => [k?.id, k])) : null;
    for (const id of idler) {
      const k = harita ? harita.get(id) : kartlar.find((x) => x?.id === id);
      if (k) { d.put(k, kartAnahtari(id)); yazilan.push(id); } else { d.delete(kartAnahtari(id)); silinen.push(id); }
    }
  }
  if (hepsi || sira) d.put(kartlar.filter((k) => k?.id).map((k) => k.id), KART_SIRA);
  return () => {
    for (const id of yazilan) kayitliKartlar.add(id);
    for (const id of silinen) kayitliKartlar.delete(id);
  };
}

// Bütün kartlar parça parça (her parça ayrı işlem, arada ekran çizilir; kalem yazarken beklenir).
// Dönen: yazılan kart id'leri. Bu arada silinen kart yazılmaz; değişen kart kendi olayıyla yeniden yazılır.
const KART_PARCA = 25;
async function kartlariParcaParca() {
  const atla = new Set(), kopya = store.kartlar.slice();
  for (let i = 0; i < kopya.length; i += KART_PARCA) {
    for (let n = 0; ayar.mesgul() && n < 40; n++) await new Promise((r) => setTimeout(r, 500));
    const parca = kopya.slice(i, i + KART_PARCA);
    let yazilan = [];
    await denetliYaz((d) => {
      const canli = new Set(store.kartlar.map((k) => k?.id));
      yazilan = parca.filter((k) => k?.id && canli.has(k.id));
      for (const k of yazilan) d.put(k, kartAnahtari(k.id));
    });
    for (const k of yazilan) { atla.add(k.id); kayitliKartlar.add(k.id); }
    await new Promise((r) => setTimeout(r, 0));
  }
  return atla;
}

// Tek "durum" işlemi; önce liste damgası denetlenir, başka sekme yazdıysa iptal edilir (kod "degisti").
// fn false dönerse işlem yazmadan biter (kod "ertele")
async function denetliYaz(fn, hizli = false) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    let yabanci = false, ertele = false;
    const t = db.transaction("durum", "readwrite");
    const d = t.objectStore("durum");
    t.oncomplete = () => { listeVardi = true; tamam(true); };
    t.onerror = t.onabort = () => hata(yabanci ? Object.assign(new Error("Kitaplık başka pencerede değişti"), { kod: "degisti" })
      : ertele ? Object.assign(new Error("kalem"), { kod: "ertele" }) : t.error);
    if (hizli) {
      // Tek yazan bu sekme (Web Locks): damga denetimine gerek yok, istekler hemen kuyruğa girer
      try { fn(d); } catch (e) { console.warn("[kenar-notu] Kayıt hazırlanamadı:", e); }
      try { t.commit?.(); } catch { /* eski tarayıcı: işlem kendiliğinden biter */ }
      return;
    }
    const q = d.get(LISTE);
    q.onsuccess = () => {
      const k = q.result;
      yabanci = k ? !izinli.has(k.zaman) : listeVardi;
      if (yabanci) { t.abort(); return; }
      try { if (fn(d) === false) { ertele = true; t.abort(); } } catch (e) { console.warn("[kenar-notu] Kayıt hazırlanamadı:", e); }
    };
  });
}

// Silinen belgenin dosyası, verisi ve ekleri app.js'teki "Geri al" bildirimi geri alınmadan kapanınca silinir.
// Önce belgesiz liste yazılır: yazılamazsa dosya kalır (listede duran belge dosyasız kalmasın).
// Sayfa o arada kapanırsa açılıştaki temizlik siler.
const silBekleyen = new Set();
export async function silinmisBelgeyiTemizle(id) {
  silBekleyen.delete(id);
  if (!id || kilit || belgeBul(id)) return;
  if (!(await hemenKaydet()) || belgeBul(id)) return;
  dosyaSil(id).catch(() => {});
  ceviriTemizle({ belgeId: id });
}

// Çeviri önbelleği (ceviri.js): belge silinince o belgeninki, sıfırlamada hepsi; "Her şeyi temizle" paketleri de siler.
// Veritabanı hiç açılmadıysa dokunulmaz (ceviri.js boşuna yüklenmesin, boş veritabanı kurulmasın).
const CEVIRI_VT = "kenar-notu-ceviri";
async function ceviriTemizle({ belgeId = null, hepsi = false } = {}) {
  try {
    if (typeof indexedDB.databases === "function" && !(await indexedDB.databases()).some((d) => d.name === CEVIRI_VT)) return;
    if (hepsi) { indexedDB.deleteDatabase(CEVIRI_VT); return; }
    const m = await import("./ceviri.js");
    await (belgeId ? m.ceviriOnbellekSil(belgeId) : m.ceviriOnbellekTemizle());
  } catch { /* önbellek yeniden üretilebilir; silinemezse de olur */ }
}

// "Örnek verilere dön": kitaplık, veriler, dosyalar ve ekler silinir; yapay zekâ ayarları (anahtarlar) kalır.
// "Her şeyi temizle" (hepsi): anahtarlar da gider. Arama dizini (arama.js'in ayrı veritabanı) iki durumda da silinir.
export async function sifirla({ hepsi = false } = {}) {
  // Öbür pencere yazmayı sürdürür: altından kayıt silinmez
  if (yazarDegil) throw Object.assign(new Error("Kitaplık başka pencerede açık"), { kod: "baska" });
  kilit = true;
  clearTimeout(zaman);
  try {
    await islem(["durum", "dosyalar"], "readwrite", (d) => {
      d.dosyalar.clear();
      if (hepsi) return d.durum.clear();
      const q = d.durum.getAllKeys();
      q.onsuccess = () => { for (const k of q.result) if (k !== YZ) d.durum.delete(k); };
      return q;
    });
  } catch (hata) { console.warn("[kenar-notu] Sıfırlanamadı:", hata); }
  // Açık bağlantı varsa silme sayfa yenilenince tamamlanır; beklenmez
  try { indexedDB.deleteDatabase("kenar-notu-arama"); } catch { /* yoksa da olur */ }
  await ceviriTemizle({ hepsi });
}

// İlk açılış karşılaması seçilene kadar örnek durum yazılmaz (seçmeden çıkan bir dahaki açılışta yine görür)
let beklet = false;
export function kayitBeklet(d) {
  beklet = !!d;
  if (!beklet) kaydetPlanla();
}

/* ---------- belgenin önceki hâli (OZELLIKLER-8 §3.2) ---------- */
// Belge bugün ilk kez değişince kayıttaki hâli (son yazılan, yani dünkü ya da son oturumdaki) kopyalanır:
// belge başına günde en çok bir kez, en çok 7 kopya. Kopya bellekteki değişmiş hâlden değil kayıttan alınır.
// Kopya işçide alınır (5000 çizgili belgede okuma ve yazma ana iş parçacığını iki saniyeden uzun tutuyordu);
// o belgenin yeni verisi kopya bitince yazılır. İşçi açılamazsa kopya burada, yine yazmadan önce açılan işlemle alınır
// (IndexedDB işlemleri açıldıkları sırayla işler). Çok büyük belgede kopya sayısı düşer ya da hiç alınmaz (yedek-isci.js).
const ikiHane = (n) => String(n).padStart(2, "0");
const gunAnahtari = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${ikiHane(d.getMonth() + 1)}-${ikiHane(d.getDate())}`; };
const bugunMu = (t) => !!t && gunAnahtari(t) === gunAnahtari();
const goruntuBekleyen = new Set();   // ilk değişikliği gelen, kopyası bir sonraki yazmada alınacak belgeler
const goruntuBakilan = new Set();    // "id|gün": bu oturumda bakıldı
function goruntuIste(id) {
  if (kilit || !id) return;
  const k = id + "|" + gunAnahtari();
  if (goruntuBakilan.has(k)) return;
  goruntuBakilan.add(k);
  goruntuBekleyen.add(id);
}
// Dönen söz kopya işlemi bitince (alınsın alınmasın) çözülür, hata fırlatmaz
async function goruntuAl(id) {
  const b = belgeBul(id);
  if (!b || kilit) return false;
  const is = { id, eskiZaman: Number(b.degisim) || 0, gun: gunAnahtari(), simdi: Date.now() };
  try {
    const w = await isciAc();
    if (w) return (await isciIsi(w, () => w.postMessage({ is: 1, tur: "onceki", ...is }))).sonuc;
  } catch (hata) { console.warn("[kenar-notu] Önceki hâl işçide alınamadı:", hata); }
  try { return await oncekiKopyaAl(await vtAc(), is); } catch { return false; }
}

// Belge menüsü: { liste: [{ anahtar, zaman, alindi, ozet, donus }] en yeni önce, buyuk: kopya alınamayacak kadar büyük }
// zaman: kopyalanan hâlin son değiştiği an (0: bilinmiyor), alindi: kopyanın alındığı an, donus: geri dönerken saklanan
export async function oncekiHaller(belgeId) {
  try {
    const z = dizinTemizle(await islem("durum", "readonly", (d) => d.durum.get(oncekiDizinAnahtari(belgeId))));
    z.liste.sort((a, b) => (b.alindi || 0) - (a.alindi || 0));
    return z;
  } catch { return { liste: [], buyuk: false }; }
}
// Seçilen hâle döner. Önce bellekteki son hâl yazılır, sonra o hâl de kopya olarak saklanır ve seçilen kopya
// belgenin verisi olur (tek işlem). Dönen: saklanan şimdiki hâlin anahtarı ("Geri al" için; veri yoksa null).
// Belge açıkken çağrılmamalı (app.js yalnız kitaplıktan çağırır).
export async function oncekiHaleDon(belgeId, anahtar) {
  if (kilit || yazarDegil) throw Object.assign(new Error("Kayıt kapalı"), { kod: "kilit" });
  const b = belgeBul(belgeId);
  if (!b || typeof anahtar !== "string" || !anahtar.startsWith("onceki:" + belgeId + ":")) throw Object.assign(new Error("Önceki hâl bulunamadı"), { kod: "yok" });
  if (!(await hemenKaydet())) throw Object.assign(new Error("Kayıt yazılamadı"), { kod: "yazma" });
  const simdi = Date.now();
  let hedef = null, donus = null;
  await islem("durum", "readwrite", (d) => {
    const ds = d.durum;
    const qd = ds.get(oncekiDizinAnahtari(belgeId)), qh = ds.get(anahtar), qv = ds.get(veriAnahtari(belgeId));
    qv.onsuccess = () => {
      if (qh.result == null) return;
      hedef = qh.result;
      const liste = dizinTemizle(qd.result).liste;
      if (qv.result != null) {
        const g = { anahtar: oncekiAnahtari(belgeId, simdi), gun: gunAnahtari(simdi), zaman: Number(b.degisim) || 0, alindi: simdi, ozet: ozetCikar(qv.result), donus: true };
        ds.put(qv.result, g.anahtar);
        liste.unshift(g);
        donus = g.anahtar;
      }
      ds.put(hedef, veriAnahtari(belgeId));
      oncekiBuda(ds, belgeId, liste);
    };
    return qv;
  });
  if (hedef == null) throw Object.assign(new Error("Önceki hâl bulunamadı"), { kod: "yok" });
  // Bellek de kayıtla aynı olur; bu dönüş bugünün kopyası sayılmaz
  goruntuBakilan.add(belgeId + "|" + gunAnahtari());
  b.veri = hedef;
  bus.emit("belge:degisti", { belgeId });
  bus.emit("belgeler", { tur: "geri", id: belgeId });
  return donus;
}

/* ---------- klasöre otomatik yedek (OZELLIKLER-8 §3.1) ---------- */
// Kullanıcının seçtiği klasöre (showDirectoryPicker) günde bir .kenar yazılır: kenar-notu-YYYY-AA-GG.kenar,
// aynı gün yeniden yazılırsa üstüne. Bu adla başlayan en yeni 7 dosya kalır, eskiler silinir; başka dosyaya dokunulmaz.
// Klasör tutamacı "durum" deposunda; "Örnek verilere dön" ile gider (sıfırlanmış kitaplık bugünkü yedeğin üstüne yazılmasın).
// Ne zaman: açılıştan sonra (bugün yedek yoksa), açıkken gün değişince ve sayfa gizlenirken (değişiklik varsa ve
// son yedekten 2 saat geçtiyse; önce kayıt biter). İzin yoksa "yedek:klasor" { tur: "izin-gerek" } olayı:
// app.js dokunuşla izin isteyen fişi gösterir (tarayıcı izni yalnız dokunuşla verir).
const KLASOR = "yedekKlasoru";
const OTO_EN_COK = 7;
const OTO_AD = /^kenar-notu-\d{4}-\d{2}-\d{2}\.kenar$/;
let yedekDegisti = false;   // son otomatik yedekten beri kitaplıkta değişiklik oldu mu
export const klasorDestegi = () => typeof globalThis.showDirectoryPicker === "function";
async function klasorKaydi() {
  try { return (await islem("durum", "readonly", (d) => d.durum.get(KLASOR))) || null; } catch { return null; }
}
const klasorKaydiYaz = (k) => islem("durum", "readwrite", (d) => d.durum.put(k, KLASOR));
async function klasorIzni(tutamac) {
  try { return await tutamac.queryPermission({ mode: "readwrite" }); } catch { return "prompt"; }
}
// -> null ya da { ad, son, dosya, hata, izin: "granted" | "prompt" | "denied" }
export async function yedekKlasoru() {
  const k = await klasorKaydi();
  if (!k?.tutamac) return null;
  return { ad: k.tutamac.name, son: k.son || 0, dosya: k.dosya || "", hata: k.hata || "", izin: await klasorIzni(k.tutamac) };
}
// Dokunuşla çağrılır. Vazgeçilirse AbortError fırlar. Seçilince ilk yedek hemen yazılır.
export async function yedekKlasoruSec({ ilerleme } = {}) {
  if (yazarDegil) throw Object.assign(new Error("Kitaplık başka pencerede açık"), { kod: "baska" });
  const tutamac = await globalThis.showDirectoryPicker({ id: "kenar-notu-yedek", mode: "readwrite" });
  await klasorKaydiYaz({ tutamac, son: 0, dosya: "", hata: "" });
  bus.emit("yedek:klasor", { tur: "secildi", ad: tutamac.name });
  return klasoreYedekYaz({ ilerleme });
}
// Dokunuşla çağrılır; izin verilirse bugünün yedeği yoksa yazılır
export async function yedekKlasoruIzinIste() {
  const k = await klasorKaydi();
  if (!k?.tutamac) return false;
  let izin = "denied";
  try { izin = await k.tutamac.requestPermission({ mode: "readwrite" }); } catch { /* reddedildi */ }
  if (izin !== "granted") return false;
  bus.emit("yedek:klasor", { tur: "izin" });
  if (!bugunMu(k.son) || yedekDegisti) klasoreYedekYaz();
  return true;
}
// Otomatik yedek kapanır; klasördeki dosyalara dokunulmaz
export async function yedekKlasoruBirak() {
  await islem("durum", "readwrite", (d) => d.durum.delete(KLASOR));
  bus.emit("yedek:klasor", { tur: "birakildi" });
}
let otoSoz = null;
export const otoYedekSuruyor = () => !!otoSoz;
// Aynı anda tek yazma; sürerken çağıran aynı sözü alır. Dönen söz yazıldıysa true.
export function klasoreYedekYaz({ ilerleme } = {}) {
  otoSoz ||= klasoreYaz(ilerleme).finally(() => { otoSoz = null; });
  return otoSoz;
}
async function klasoreYaz(ilerleme) {
  if (yazarDegil || kilit) return false;
  const k = await klasorKaydi();
  if (!k?.tutamac) return false;
  if ((await klasorIzni(k.tutamac)) !== "granted") { bus.emit("yedek:klasor", { tur: "izin-gerek" }); return false; }
  yedekDegisti = false;
  bus.emit("yedek:klasor", { tur: "yaziyor" });
  const ad = `kenar-notu-${gunAnahtari()}.kenar`;
  try {
    const blob = await yedekAl({ ilerleme });
    const fh = await k.tutamac.getFileHandle(ad, { create: true });
    // createWritable geçici dosyaya yazar, close() ile yerine koyar: yarıda kalırsa eski dosya bozulmaz
    const w = await fh.createWritable();
    try { await w.write(blob); await w.close(); }
    catch (hata) { await w.abort?.().catch(() => {}); throw hata; }
    await eskiYedekleriSil(k.tutamac, ad);
    const son = Date.now();
    await klasorKaydiYaz({ ...k, son, dosya: ad, hata: "" }).catch(() => {});
    bus.emit("yedek:klasor", { tur: "yazildi", son, dosya: ad, boyut: blob.size });
    return true;
  } catch (hata) {
    yedekDegisti = true;
    console.warn("[kenar-notu] Klasöre yedek yazılamadı:", hata);
    const mesaj = hata?.kod === "eksik" || hata?.kod === "buyuk" ? hata.message
      : hata?.name === "NotAllowedError" ? "Klasöre yazma izni yok."
        : hata?.name === "NotFoundError" ? "Yedek klasörü bulunamadı; yeniden seç."
          : hata?.name === "QuotaExceededError" ? "Diskte yer kalmadı."
            : "Yedek klasöre yazılamadı.";
    await klasorKaydiYaz({ ...k, hata: mesaj }).catch(() => {});
    bus.emit("yedek:klasor", { tur: "hata", mesaj });
    return false;
  }
}
async function eskiYedekleriSil(dizin, yeni) {
  const adlar = [];
  try { for await (const [ad, t] of dizin.entries()) if (t.kind === "file" && OTO_AD.test(ad)) adlar.push(ad); }
  catch { return; }
  // Tarih adda: ters sıralı ilk 7 en yenileri
  adlar.sort().reverse();
  for (const ad of adlar.slice(OTO_EN_COK)) if (ad !== yeni) await dizin.removeEntry(ad).catch(() => {});
}
// Kayıt yüklenince bir kez. Klasöre yazamayan tarayıcıda app.js'e hatırlatma sırası gelip gelmediği sorulur.
let cikisKaydi = Promise.resolve(), otoKuruldu = false;
function otoYedekKur() {
  if (otoKuruldu || yazarDegil || kilit) return;
  otoKuruldu = true;
  if (!klasorDestegi()) { setTimeout(() => bus.emit("yedek:klasor", { tur: "hatirlat" }), 20000); return; }
  const dene = async (gizli = false) => {
    if (otoSoz || kilit) return;
    const k = await klasorKaydi();
    if (!k?.tutamac) return;
    const gunlu = !bugunMu(k.son);
    if (gizli ? !(yedekDegisti && (gunlu || Date.now() - (k.son || 0) > 2 * 36e5)) : !gunlu) return;
    klasoreYedekYaz();
  };
  // Açılış yükü bitince, boş bir anda
  setTimeout(() => (typeof requestIdleCallback === "function" ? requestIdleCallback(() => dene(), { timeout: 10000 }) : dene()), 15000);
  setInterval(() => { if (document.visibilityState === "visible") dene(); }, 30 * 60e3);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { dene(); return; }
    // Gizlenirken önce kitaplık kaydı biter; yedek ondan sonra işçide hazırlanır
    cikisKaydi.then(() => dene(true));
  });
}

/* ---------- içe aktarma ---------- */
// İlk 64 KB için FNV-1a; ad ve boyutla birlikte aynı dosyayı tanır
function ozet(bayt) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bayt.length; i++) { h1 ^= bayt[i]; h1 = Math.imul(h1, 0x01000193); }
  return (h1 >>> 0).toString(36);
}
// Tür içerikten tanınır, uzantı yalnız son çare (OZELLIKLER-8 §3.3): uzantısız ya da yanlış uzantılı dosya da açılır.
// "zip": içine bakılmadan karar verilemeyen zip (zipTuru bakar)
const CIZGI_MIME = /^application\/(vnd\.comicbook\+zip|x-cbz)$/i;
const CBR_HATA = "CBR (RAR) desteklenmiyor. Dosyayı CBZ'ye çevirip tekrar dene.";
function turBul(ad, mime, bas) {
  if (bas[0] === 0x25 && bas[1] === 0x50 && bas[2] === 0x44 && bas[3] === 0x46) return "pdf";   // %PDF
  if (bas[0] === 0x50 && bas[1] === 0x4b && bas[2] === 3 && bas[3] === 4) {
    // EPUB: zip'in ilk girdisi "mimetype", içeriği application/epub+zip (kurala uyan EPUB'da içine bakmak gerekmez)
    const bas60 = new TextDecoder("latin1").decode(bas.subarray(30, 90));
    if (bas60.startsWith("mimetype") && bas60.includes("application/epub+zip")) return "epub";
    return "zip";
  }
  // RAR ("Rar!") ya da .cbr: açılamaz, nedeni söylenir (.cbr adlı ama zip olan dosya yukarıda CBZ diye açılır)
  if ((bas[0] === 0x52 && bas[1] === 0x61 && bas[2] === 0x72 && bas[3] === 0x21) || /\.cbr$/i.test(ad) || /comicbook-rar|x-cbr/i.test(mime || "")) {
    throw Object.assign(new Error(CBR_HATA), { kod: "cbr" });
  }
  // %PDF başta değilse (önünde çöp bayt olan PDF'ler) ilk 1 KB'ta aranır
  if (new TextDecoder("latin1").decode(bas.subarray(0, 1024)).includes("%PDF-")) return "pdf";
  if (/\.pdf$/i.test(ad) || mime === "application/pdf") return "pdf";
  return null;
}
// Zip'in içine bakılır: "mimetype" girdisi application/epub+zip ise EPUB, Kenar Notu yedeğinin düzeni (durum.json,
// dosyalar/, ekler/) ise "yedek", yalnız görsel (ve ComicInfo.xml) varsa çizgi roman (gizli dosyalar ve __MACOSX
// atlanır), paket dosyası (container.xml ya da .opf) varsa EPUB. Karar verilemezse uzantıya ve türe bakılır.
const GORSEL_ADI = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
async function zipTuru(file, ad, mime) {
  let arsiv = null;
  try { arsiv = await arsivAc(file); } catch { arsiv = null; }
  if (!arsiv && file.size <= 512 * 2 ** 20) {
    try { arsiv = jszipArsivi(await (await jszipYukle()).loadAsync(file)); } catch { arsiv = null; }
  }
  const yollar = arsiv?.yollar() || [];
  if (arsiv?.var("mimetype")) {
    let tur = "";
    try { tur = (await (await arsiv.blob("mimetype")).slice(0, 200).text()).trim(); } catch { tur = ""; }
    if (tur === "application/epub+zip") return "epub";
  }
  if (yollar.includes("durum.json") && yollar.every((y) => y === "durum.json" || /^(dosyalar|ekler)\//.test(y))) return "yedek";
  const anlamli = yollar.filter((y) => !/(^|\/)(__MACOSX\/|\.)/.test(y) && !/(^|\/)(Thumbs\.db|desktop\.ini)$/i.test(y));
  const gorsel = anlamli.filter((y) => GORSEL_ADI.test(y));
  if (gorsel.length > 0 && anlamli.every((y) => GORSEL_ADI.test(y) || /(^|\/)ComicInfo\.xml$/i.test(y))) return "cizgi";
  if (yollar.some((y) => /^META-INF\/container\.xml$/i.test(y) || /\.opf$/i.test(y))) return "epub";
  if (/\.epub$/i.test(ad) || mime === "application/epub+zip") return "epub";
  if (/\.cbz$/i.test(ad) || CIZGI_MIME.test(mime || "")) return "cizgi";
  if (/\.kenar$/i.test(ad) && yollar.includes("durum.json")) return "yedek";
  return null;
}
// Dosyanın türü içeriğinden: "pdf" | "epub" | "cizgi" | "yedek" (.kenar) | null. CBR için kod "cbr" ile hata fırlar.
export async function dosyaTuru(file) {
  const ad = String(file?.name || "");
  const bas = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const tur = turBul(ad, file.type, bas);
  return tur === "zip" ? zipTuru(file, ad, file.type) : tur;
}
const zamanAsimi = (soz, ms) => Promise.race([soz, new Promise((_, h) => setTimeout(() => h(new Error("zaman aşımı")), ms))]);

// Kapak listede küçük durur: en çok 360 piksel genişlik, JPEG
// createImageBitmap: img.decode() arka plandaki sekmede beklemede kalabiliyor
async function kapakKucult(src, genislik = 360) {
  const img = await createImageBitmap(src instanceof Blob ? src : await (await fetch(src)).blob());
  try {
    if (img.width <= genislik && typeof src === "string" && /^data:image\/jpe?g/.test(src)) return src;
    const o = Math.min(1, genislik / img.width);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * o));
    c.height = Math.max(1, Math.round(img.height * o));
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { img.close?.(); }
}
function renkSec(ad) {
  let t = 0;
  for (const c of ad) t = (t * 31 + c.charCodeAt(0)) >>> 0;
  return CILT_RENKLERI[t % CILT_RENKLERI.length];
}

let kaliciIstendi = false;
async function kaliciIste() {
  if (kaliciIstendi || !navigator.storage?.persist) return;
  kaliciIstendi = true;
  try { if (!(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* tarayıcı vermezse de çalışır */ }
}

// pdf-belge.js / epub-belge.js yoksa ya da takılırsa { hata: true }: belge adla basılmış kapakla yine alınır
async function belgeBilgisi(tur, blob) {
  try {
    if (tur === "pdf") return await zamanAsimi(import("./pdf-belge.js").then((m) => m.pdfBilgi(blob)), 30000);
    if (tur === "cizgi") return await zamanAsimi(import("./cizgi-belge.js").then((m) => m.cizgiBilgi(blob)), 30000);
    return await zamanAsimi(import("./epub-belge.js").then((m) => m.epubBilgi(blob)), 30000);
  } catch (hata) {
    console.warn("[kenar-notu] Belge bilgisi okunamadı, adla basılıyor:", hata);
    return { hata: true, neden: hata };
  }
}
// Kapak: dataURL (pdf-belge, epub-belge) ya da Blob (cizgi-belge)
async function kapakHazirla(kapak) {
  if (!(kapak instanceof Blob && kapak.size) && (typeof kapak !== "string" || !kapak.startsWith("data:image"))) return null;
  try { return await kapakKucult(kapak); } catch { return null; }
}

// İçe aktarırken bilgi okunamamış belgenin kapağı ve sayfa sayısı sonradan tamamlanır
export async function kapakTamamla(belge) {
  if (!belge?.dosya || belge.kapakGorsel || belge.kapakDenendi) return false;
  const blob = await dosyaGetir(belge.id);
  if (!blob) return false;
  const bilgi = (await belgeBilgisi(belge.tur, blob)) || {};
  if (bilgi.hata || !belgeBul(belge.id)) return false;
  belge.kapakDenendi = true;
  if ((belge.tur === "pdf" || belge.tur === "cizgi") && Number(bilgi.sayfaSayisi) > 0) belge.sayfaSayisi = Math.floor(Number(bilgi.sayfaSayisi));
  if (belge.tur === "cizgi") cizgiBilgisiYaz(belge, bilgi);
  if (belge.tur === "epub" && !belge.yazar && bilgi.yazar) belge.yazar = String(bilgi.yazar).trim();
  const kapakGorsel = await kapakHazirla(bilgi.kapak);
  if (kapakGorsel) {
    belge.kapakGorsel = kapakGorsel;
    await islem("durum", "readwrite", (d) => d.durum.put(kapakGorsel, kapakAnahtari(belge.id))).catch(() => {});
  }
  bus.emit("belgeler", { tur: "kapak", id: belge.id });
  return true;
}

// Çizgi romanın künyesi (ComicInfo.xml): seri, sayı, yazar ve okuma yönü
function cizgiBilgisiYaz(belge, bilgi) {
  const yazi = (v) => String(v ?? "").trim() || undefined;
  belge.yon = bilgi.yon === "rtl" ? "rtl" : "ltr";
  belge.seri = yazi(bilgi.seri);
  belge.sayi = yazi(bilgi.sayi);
  if (!belge.yazar && yazi(bilgi.yazar)) belge.yazar = yazi(bilgi.yazar);
}

export async function belgeIceAktar(file, { klasor } = {}) {
  const ad = String(file?.name || "Adsız");
  const bas = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  let tur = turBul(ad, file.type, bas);
  if (tur === "zip") tur = await zipTuru(file, ad, file.type);
  // Kenar Notu yedeği (adı ne olursa olsun): app.js yedekten yüklemeyi sorar
  if (tur === "yedek") throw Object.assign(new Error("Kenar Notu yedeği: " + ad), { kod: "yedek" });
  if (!tur) throw Object.assign(new Error("Desteklenmeyen dosya: " + ad), { kod: "tur" });
  const iz = `${ad}|${file.size}|${ozet(bas)}`;
  const vardi = store.belgeler.find((b) => b.parmakIzi === iz);
  if (vardi) return vardi;

  const bilgi = (await belgeBilgisi(tur, file)) || {};
  // Okunamayan dosya kitaplığa girmez (açılınca yine hata verirdi). Zaman aşımı bozukluk sayılmaz:
  // büyük ya da yavaş dosya eklenir, bilgisi sonra tamamlanır.
  if (bilgi.hata && bilgi.neden?.message !== "zaman aşımı") {
    const n = bilgi.neden, kod = n?.kod || (n?.name === "PasswordException" ? "parola" : "bozuk");
    throw Object.assign(new Error(
      kod === "drm" ? `“${ad}” DRM ile korunuyor; Kenar Notu korumalı kitapları açamıyor.`
        : kod === "parola" ? `“${ad}” parolalı; parolasız bir kopyasını ekle.`
          : kod === "buyuk" ? `“${ad}” açılamadı: içinde aşırı büyük bir bölüm var.`
            : `“${ad}” okunamadı; dosya bozuk ya da yarım inmiş olabilir.`), { kod: "bozuk" });
  }
  const kapakGorsel = await kapakHazirla(bilgi.kapak);
  const dosyaAd = ad.replace(/\.(pdf|epub|cbz|zip)$/i, "").trim() || "Adsız";
  const belgeAd = ((tur !== "pdf" && String(bilgi.baslik || "").replace(YON_DENETIM, "").trim()) || dosyaAd).replace(YON_DENETIM, "");
  const sayfali = tur === "pdf" || tur === "cizgi";
  const belge = {
    id: yeniId("b"), tur, ad: belgeAd.slice(0, 200),
    yazar: String(bilgi.yazar || "").replace(YON_DENETIM, "").trim() || undefined,
    klasor: tur === "pdf" && klasor ? klasor : undefined,
    sayfaSayisi: sayfali ? Math.max(1, Math.floor(Number(bilgi.sayfaSayisi)) || 1) : 0,
    sayfa: sayfali ? 1 : 0, ilerleme: 0, favori: false, acilis: Date.now(),
    kapak: renkSec(belgeAd), dosya: true, parmakIzi: iz, boyut: file.size, eklenme: Date.now(), veri: null,
  };
  if (tur === "cizgi") cizgiBilgisiYaz(belge, bilgi);
  if (tur === "epub") { const dil = await zamanAsimi(epubDili(file), 8000).catch(() => null); if (dil) belge.dil = dil; }
  if (!bilgi.hata) belge.kapakDenendi = true;   // bilgi okunamadıysa kapak sonraki açılışta yeniden denenir
  if (kapakGorsel) belge.kapakGorsel = kapakGorsel;
  // Dosya türü sabitlenir: Android bazen EPUB'u türsüz verir
  const blob = file.type === TUR_MIME[tur] ? file : new Blob([file], { type: TUR_MIME[tur] });
  await dosyaliBelgeYaz(belge, blob, kapakGorsel);
  return belge;
}

// Dosya, kapak ve kitaplık girdisi tek işlemde: arada sekme kapanırsa ya hepsi vardır ya hiçbiri
async function dosyaliBelgeYaz(belge, blob, kapakGorsel) {
  await islem(["dosyalar", "durum"], "readwrite", (d) => {
    if (kapakGorsel) d.durum.put(kapakGorsel, kapakAnahtari(belge.id));
    if (!kilit && !beklet) d.durum.put(listeKaydi([belge, ...store.belgeler]), LISTE);
    return d.dosyalar.put(blob, belge.id);
  });
  if (!kilit && !beklet) listeVardi = true;
  kaliciIste();
  store.belgeler.unshift(belge);
  bus.emit("belgeler", { tur: "ekle", belge });
}

// Örnek çizgi roman (cizgi-ornek.js üretir): içe aktarılmış CBZ gibi dosyasıyla saklanır (dosya: true),
// örnek sürüm taşımasına girmez. Bir kez eklenir; kitaplıkta zaten varsa yalnız işaretlenir.
// alanlar: cizgi-ornek.js ORNEK_CIZGI (id, ad, seri, sayi, yazar, yon); ComicInfo.xml okunamazsa bunlar kullanılır
export async function ornekCizgiEkle(blob, { alanlar = {}, acilis = Date.now() - 6 * 3600e3 } = {}) {
  const id = String(alanlar.id || "ornek-cizgi");
  if (!(blob instanceof Blob) || !blob.size) throw new Error("ornekCizgiEkle: CBZ Blob gerekir");
  if (kilit) throw new Error("Kayıt kapalı: örnek çizgi roman bir dahaki açılışa kaldı");
  if (belgeBul(id)) { ornekCizgi = true; kaydetPlanla(); return belgeBul(id); }
  const bilgi = (await belgeBilgisi("cizgi", blob)) || {};
  if (belgeBul(id)) return belgeBul(id);
  const kapakGorsel = await kapakHazirla(bilgi.kapak);
  for (const k of ["seri", "sayi", "yazar", "yon"]) if (!bilgi[k] && alanlar[k]) bilgi[k] = alanlar[k];
  const ad = String(bilgi.baslik || "").trim() || String(alanlar.ad || "").trim() || "Örnek çizgi roman";
  const belge = {
    id, tur: "cizgi", ad: ad.slice(0, 200), yazar: String(bilgi.yazar || "").trim() || undefined,
    sayfaSayisi: Math.max(1, Math.floor(Number(bilgi.sayfaSayisi)) || 1), sayfa: 1, ilerleme: 0, favori: false, acilis,
    kapak: renkSec(ad), dosya: true, ornek: true, boyut: blob.size, eklenme: Date.now(), veri: null,
  };
  cizgiBilgisiYaz(belge, bilgi);
  if (!bilgi.hata) belge.kapakDenendi = true;
  if (kapakGorsel) belge.kapakGorsel = kapakGorsel;
  // İşaret listeyle aynı işlemde yazılır: yarıda kalırsa bir dahaki açılışta yeniden denenir
  ornekCizgi = true;
  try { await dosyaliBelgeYaz(belge, blob.type === TUR_MIME.cizgi ? blob : new Blob([blob], { type: TUR_MIME.cizgi }), kapakGorsel); }
  catch (hata) { ornekCizgi = false; throw hata; }
  return belge;
}

/* ---------- depo ---------- */
export async function depoDurumu() {
  const s = { kullanilan: 0, kota: 0, kalici: false, olculdu: false };
  try {
    const t = await navigator.storage?.estimate?.();
    if (t) { s.kullanilan = t.usage || 0; s.kota = t.quota || 0; s.olculdu = true; }
    s.kalici = !!(await navigator.storage?.persisted?.());
  } catch { /* desteklenmiyor */ }
  return s;
}

// EPUB'un dili (OPF dc:language), kısa koda indirgenmiş: "en-US" -> "en". Yalnız paket dosyası okunur.
export async function epubDili(blob) {
  const JSZip = await jszipYukle();
  const zip = await JSZip.loadAsync(blob);
  const oku = (yol) => zip.file(yol)?.async("string");
  const kap = (await oku("META-INF/container.xml")) || "";
  let opfYol = kap.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  if (!opfYol || !zip.file(opfYol)) opfYol = Object.keys(zip.files).find((y) => /\.opf$/i.test(y)) || "";
  const opf = opfYol ? (await oku(opfYol)) || "" : "";
  const ham = opf.match(/<(?:[\w-]+:)?language(?:\s[^>]*)?>\s*([^<\s]+)\s*</i)?.[1] || "";
  return dilKisalt(ham);
}
// "en-US" -> "en", "zh-Hant-TW" -> "zh-Hant", "und" ve bozuk değer -> null
export function dilKisalt(kod) {
  const s = String(kod || "").trim().replace(/_/g, "-");
  const [ana, ...geri] = s.split("-");
  const a = (ana || "").toLowerCase();
  if (!/^[a-z]{2,3}$/.test(a) || a === "und" || a === "mul" || a === "zxx") return null;
  if (a === "zh") { const y = geri.find((x) => /^han[st]$/i.test(x)); return y ? "zh-" + y[0].toUpperCase() + y.slice(1).toLowerCase() : "zh-Hans"; }
  return a === "no" ? "nb" : a;
}

/* ---------- yedek ---------- */
let jszipSoz = null;
function jszipYukle() {
  if (globalThis.JSZip) return Promise.resolve(globalThis.JSZip);
  jszipSoz ||= new Promise((tamam, hata) => {
    const s = document.createElement("script");
    s.src = new URL("../lib/jszip.min.js", import.meta.url).href;
    s.onload = () => (globalThis.JSZip ? tamam(globalThis.JSZip) : hata(new Error("JSZip yok")));
    s.onerror = () => { jszipSoz = null; hata(new Error("JSZip yüklenemedi")); };
    document.head.append(s);
  });
  return jszipSoz;
}

// Yapay zekâ ayarlarından yalnız seçimler; anahtarlar ve deneme sonuçları yedeğe girmez
function ayarlarYedegi() {
  const { yz, araclar, ...digerleri } = store.ayarlar;
  const kopya = JSON.parse(JSON.stringify(digerleri));
  if (araclar) kopya.araclar = JSON.parse(JSON.stringify(araclar));
  if (yz) kopya.yz = { yol: yz.yol, uygulama: yz.uygulama, saglayici: yz.saglayici, modeller: { ...yz.modeller } };
  return kopya;
}

// Cihazda localStorage'da duran okuma ve görünüm tercihleri de yedeğe girer (yazı boyutu, tema, cetvel...)
const YEREL_TERCIHLER = ["okuma-tercih", "okuma-temalari", "ceviriyle-oku", "ses-hiz"];
function yerelTercihler() {
  const o = {};
  try { for (const k of YEREL_TERCIHLER) { const v = localStorage.getItem("kn-tasarim:" + k); if (v != null) o[k] = v; } } catch { /* gizli pencere */ }
  return o;
}
function yerelTercihleriYaz(o) {
  if (!o || typeof o !== "object") return;
  try { for (const k of YEREL_TERCIHLER) if (typeof o[k] === "string" && o[k].length < 200000) localStorage.setItem("kn-tasarim:" + k, o[k]); } catch { /* yer yok */ }
}

// ilerleme(oran): 0..1, ekranda "Yedek hazırlanıyor %40" için
export async function yedekAl({ ilerleme = () => {} } = {}) {
  try { ayar.oncesi(); } catch { /* son hâl yeter */ }
  const durum = {
    uygulama: "Kenar Notu", bicim: 1, surum: VT.surum, ornekSurum: ornekSurumu, zaman: Date.now(),
    belgeler: store.belgeler, kirpintilar: store.kirpintilar, kartlar: store.kartlar, klasorler: KLASORLER,
    derlemeler: store.derlemeler, ornekCizgi: ornekCizgi || undefined,
    ayarlar: ayarlarYedegi(), yerel: yerelTercihler(),
  };
  const girdiler = [];   // [yol, Blob]
  // Ek dosyaların türleri durum.json'da durur (zip türü saklamaz): { belgeId: { ad: tür } }
  durum.ekler = {};
  // Dosyası okunamayan belge varsa yedek eksik çıkmasın: durulur ve hangi belge olduğu söylenir
  for (const b of store.belgeler) {
    if (!b.dosya) continue;
    let blob = null;
    try { blob = await islem("dosyalar", "readonly", (d) => d.dosyalar.get(b.id)); } catch (hata) { console.warn("[kenar-notu] Dosya okunamadı:", b.id, hata); }
    if (!blob) throw Object.assign(new Error(`“${b.ad}” belgesinin dosyası okunamadı; yedek alınmadı.`), { kod: "eksik", belgeId: b.id });
    girdiler.push([`dosyalar/${b.id}`, blob]);
  }
  // Ek dosyalar (ses, görsel): ekler/<belgeId>/<ad>.
  // Okunamayan ek varsa yedek eksik çıkmasın: belge verisi o eke bakıyor olabilir
  for (const b of store.belgeler) {
    const on = ekOnEki(b.id);
    let anahtarlar, bloblar;
    try {
      [anahtarlar, bloblar] = await islem("dosyalar", "readonly", (d) => [d.dosyalar.getAllKeys(aralik(on)), d.dosyalar.getAll(aralik(on))]);
    } catch (hata) {
      console.warn("[kenar-notu] Ek dosyalar okunamadı:", b.id, hata);
      throw Object.assign(new Error(`“${b.ad}” belgesinin ses ya da görsel ekleri okunamadı; yedek alınmadı.`), { kod: "eksik", belgeId: b.id });
    }
    anahtarlar.forEach((k, i) => {
      if (!bloblar[i]) return;
      const ad = k.slice(on.length);
      (durum.ekler[b.id] ||= {})[ad] = bloblar[i].type || "";
      girdiler.push([`ekler/${b.id}/${ad}`, bloblar[i]]);
    });
  }
  // zip64 yazılmaz: 4 GB'ı geçen arşiv bozuk çıkar, baştan söylenir
  const toplam = girdiler.reduce((t, [, b]) => t + b.size, 0);
  if (toplam > YEDEK_SINIR) throw Object.assign(new Error("Kitaplık 4 GB'ı geçiyor; yedek tek dosyada en çok 4 GB olabilir."), { kod: "buyuk" });
  // JSON, CRC ve sıkıştırma işçide (deneme turunda büyük kitaplıkta ekran 10 ile 26 sn kilitleniyordu).
  // İşçi açılamazsa aynı kod burada çalışır.
  const w = await isciAc();
  if (!w) return yedekUret({ durum, girdiler }, ilerleme);
  // Büyük diziler önce sabitlenir (o arada eklenen kart iki kez girmesin), sonra öğe öğe kopyalanır:
  // her kopya kısa bir iş, arada ekran çizilir. Sayfa gizliyken beklenmez (zamanlayıcılar yavaşlar).
  const diziler = Object.fromEntries(PARCALI.map((a) => [a, Array.isArray(durum[a]) ? durum[a].slice() : null]));
  const bas = { ...durum };
  for (const a of PARCALI) if (diziler[a]) bas[a] = [];
  const adet = PARCALI.reduce((t, a) => t + (diziler[a]?.length || 0), 0) || 1;
  const sonuc = await isciIsi(w, async () => {
    w.postMessage({ is: 1, tur: "yaz", durum: bas, girdiler });
    let giden = 0, dilim = performance.now();
    for (const alan of PARCALI) for (const x of diziler[alan] || []) {
      try { w.postMessage({ is: 1, tur: "parca", alan, liste: [x] }); }
      catch { w.postMessage({ is: 1, tur: "parca", alan, liste: [JSON.parse(JSON.stringify(x))] }); }
      giden++;
      if (performance.now() - dilim > 12) {
        ilerleme((0.15 * giden) / adet);
        if (document.visibilityState !== "hidden") await new Promise((r) => setTimeout(r, 0));
        dilim = performance.now();
      }
    }
    w.postMessage({ is: 1, tur: "bitir" });
  }, { ilerleme: (o) => ilerleme(0.15 + o * 0.85) });
  return sonuc.blob;
}
const YEDEK_SINIR = 4 * 2 ** 30 - 64 * 2 ** 20;

/* ---------- yedek işçisi ---------- */
// Her iş için bir işçi açılır, iş bitince kapanır (büyük metinler bellekte kalmasın).
// Modül işçisi açılamazsa (eski tarayıcı) ya da 5 sn'de hazır olmazsa null: iş ana iş parçacığında yapılır.
function isciAc() {
  return new Promise((tamam) => {
    let w;
    try { w = new Worker(new URL("./yedek-isci.js", import.meta.url), { type: "module" }); }
    catch { tamam(null); return; }
    const birak = () => { clearTimeout(sure); w.terminate(); tamam(null); };
    const sure = setTimeout(birak, 5000);
    w.onmessage = (e) => {
      if (e.data?.tur !== "hazir") return;
      clearTimeout(sure);
      w.onmessage = w.onerror = null;
      tamam(w);
    };
    w.onerror = (e) => { e.preventDefault?.(); birak(); };
  });
}
// İşçiyle tek iş: gonder() mesajları yollar. "tamam" ile çözülür, "hata" ya da çöken işçiyle reddedilir.
function isciIsi(w, gonder, { ilerleme, parca } = {}) {
  return new Promise((tamam, hata) => {
    let bitti = false;
    const son = (fn, x) => { if (bitti) return; bitti = true; w.terminate(); fn(x); };
    w.onmessage = (e) => {
      const m = e.data || {};
      if (m.tur === "ilerleme") ilerleme?.(m.oran);
      else if (m.tur === "parca") parca?.(m);
      else if (m.tur === "tamam") son(tamam, m);
      else if (m.tur === "hata") son(hata, Object.assign(new Error(m.mesaj || "Yedek işçisi hata verdi"), { kod: m.kod || "" }));
    };
    w.onerror = (e) => { e.preventDefault?.(); son(hata, Object.assign(new Error("Yedek işçisi durdu"), { kod: "isci" })); };
    Promise.resolve().then(gonder).catch((x) => son(hata, x));
  });
}

function jszipArsivi(zip) {
  return {
    var: (yol) => !!zip.file(yol),
    blob: (yol) => zip.file(yol).async("blob"),
    yollar: () => Object.keys(zip.files).filter((y) => !zip.files[y].dir),
  };
}
const okumaHatasiOlustur = (hata) => Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma", neden: hata });
// Arşivin içerik dizini burada okunur (dosyalar dilim olarak buradan alınır), durum.json işçide ayrıştırılır
async function yedekArsivi(file) {
  let arsiv = null;
  try { arsiv = await arsivAc(file); }
  catch (hata) {
    if (okumaHatasi(hata)) throw okumaHatasiOlustur(hata);
    arsiv = null;
  }
  if (arsiv) {
    const durum = arsiv.var("durum.json") ? await durumOku(file, arsiv) : null;
    if (!durum || !Array.isArray(durum.belgeler)) throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
    return { arsiv, durum };
  }
  // Tanınmayan biçim: JSZip bütün dosyayı belleğe alır, büyük dosyada denenmez
  if (file.size > 512 * 2 ** 20) throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
  const JSZip = await jszipYukle();
  try { arsiv = jszipArsivi(await JSZip.loadAsync(file)); }
  catch (hata) {
    if (okumaHatasi(hata)) throw okumaHatasiOlustur(hata);
    throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
  }
  let durum = null;
  try { durum = arsiv.var("durum.json") ? JSON.parse(await (await arsiv.blob("durum.json")).text()) : null; }
  catch (hata) {
    if (okumaHatasi(hata)) throw okumaHatasiOlustur(hata);
  }
  if (!durum || !Array.isArray(durum.belgeler)) throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
  return { arsiv, durum };
}
// durum.json işçide ayrıştırılır, büyük diziler parça parça döner. İşçi yoksa burada. Bozuk JSON: null.
async function durumOku(file, arsiv) {
  const w = await isciAc();
  if (!w) {
    try { return JSON.parse(await (await arsiv.blob("durum.json")).text()); }
    catch (hata) { if (okumaHatasi(hata)) throw okumaHatasiOlustur(hata); return null; }
  }
  const parcalar = Object.fromEntries(PARCALI.map((a) => [a, []]));
  let m;
  try {
    m = await isciIsi(w, () => w.postMessage({ is: 1, tur: "oku", dosya: file }),
      { parca: (p) => { if (parcalar[p.alan]) for (const x of p.liste) parcalar[p.alan].push(x); } });
  } catch (hata) {
    // Çöken işçi çoğunlukla bellek: dosya yedek olabilir ama açılamadı
    if (hata?.kod === "okuma" || hata?.kod === "isci") throw okumaHatasiOlustur(hata);
    return null;
  }
  const durum = m?.durum;
  if (!durum || typeof durum !== "object") return null;
  for (const a of PARCALI) if (Array.isArray(durum[a])) durum[a] = parcalar[a];
  return durum;
}
// Yedekteki sürüm alınır mı: yerelde veri yoksa her zaman; ikisinde de değişim damgası varsa ona,
// yalnız yedekte varsa yedek alınır (yerel hiç düzenlenmemiş); hiçbirinde yoksa son açılışa bakılır
function yedektekiYeni(yerel, y) {
  if (yerel.veri == null && y.veri != null) return true;
  if (yerel.degisim && y.degisim) return y.degisim > yerel.degisim;
  if (y.degisim && !yerel.degisim) return true;
  if (yerel.degisim && !y.degisim) return false;
  return (y.acilis || 0) > (yerel.acilis || 0);
}

// Birleştirir: yedekte olup burada olmayan eklenir; ikisinde de olan belgede yeni olan kalır (yedektekiYeni).
// Kartlar, kırpıntılar ve klasörler id ile birleşir. Sonra sayfa yenilenir.
// Yedek dışarıdan gelir: görsel alanları yalnız data:image ya da blob: olabilir (yoksa uygulama her açılışta
// yabancı adrese istek atar, izleme pikseli), renk alanları yalnız renk (style özniteliğine CSS girmesin)
const GORSEL_ALAN = /(gorsel|Gorsel|src|resim)$/;
const RENK_ALAN = /^(renk|kapak|cilt|zemin)$|Renk$/;
const RENK_DEGER = /^(#[0-9a-f]{3,8}|(rgba?|hsla?)\([\d\s.,%/]+\)|var\(--[\w-]+\)|[a-z][a-z0-9-]{0,30})$/i;   // ad: "limon", "transparent" (yalnız harf, rakam, tire)
const GORSEL_DEGER = /^(data:image\/(png|jpe?g|webp|gif|avif|svg\+xml)[;,]|blob:)/i;
// U+202A..U+202E ve U+2066..U+2069: metnin yönünü değiştiren görünmez karakterler
const YON_DENETIM = new RegExp("[" + String.fromCharCode(0x202A) + "-" + String.fromCharCode(0x202E)
  + String.fromCharCode(0x2066) + "-" + String.fromCharCode(0x2069) + "]", "g");
function yedegiTemizle(x, derinlik = 0) {
  if (!x || typeof x !== "object" || derinlik > 40) return;
  if (Array.isArray(x)) { for (const o of x) yedegiTemizle(o, derinlik + 1); return; }
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (typeof v === "string") {
      if (GORSEL_ALAN.test(k) && !GORSEL_DEGER.test(v)) delete x[k];
      else if (RENK_ALAN.test(k) && !RENK_DEGER.test(v.trim())) delete x[k];
      // Yön değiştiren denetim karakterleri adı ters gösterip aldatabilir
      else if (k === "ad" || k === "yazar") x[k] = v.replace(YON_DENETIM, "");
    } else if (v && typeof v === "object") yedegiTemizle(v, derinlik + 1);
  }
}
const BELGE_TURLERI = new Set(["pdf", "epub", "defter", "cizgi"]);
// Yedekteki belge verisi türüne uymalı: EPUB verisi sayfasız, PDF ve defter verisi sayfalı. Uymayan veri bırakılır
// (belge baştan açılır), listelerdeki boş ya da nesne olmayan girdiler atılır: açılışta ekranı düşürmesinler.
const EPUB_LISTELERI = ["vurgular", "cizgiler", "yerImleri", "asistanNotlari", "izler"];
const SAYFA_LISTELERI = ["cizgiler", "notlar", "metinler", "bantlar", "gorseller"];
const nesneMi = (o) => !!o && typeof o === "object" && !Array.isArray(o);
function veriDuzelt(y) {
  const v = y.veri;
  if (v == null) return;
  if (!nesneMi(v)) { y.veri = null; return; }
  if (y.tur === "epub") {
    if ("sayfalar" in v) { y.veri = null; return; }
    for (const k of EPUB_LISTELERI) if (k in v) v[k] = Array.isArray(v[k]) ? v[k].filter(nesneMi) : [];
  } else if (y.tur === "pdf" || y.tur === "defter") {
    if (!Array.isArray(v.sayfalar)) { y.veri = null; return; }
    v.sayfalar = v.sayfalar.filter(nesneMi);
    if (!v.sayfalar.length) { y.veri = null; return; }
    for (const sf of v.sayfalar) for (const k of SAYFA_LISTELERI) sf[k] = Array.isArray(sf[k]) ? sf[k].filter((o) => o != null) : [];
  }
}

export async function yedekYukle(file) {
  if (yazarDegil) throw Object.assign(new Error("Kitaplık başka pencerede açık"), { kod: "baska" });
  const { arsiv, durum } = await yedekArsivi(file);
  for (const alan of ["belgeler", "kirpintilar", "kartlar", "klasorler", "derlemeler"]) yedegiTemizle(durum[alan]);

  try { ayar.oncesi(); } catch { /* son hâl yeter */ }
  // Birleşim kopyalar üstünde hazırlanır; canlı durum ancak her şey yazılınca değişir (yarıda kalırsa eskisi durur)
  // birlestir öğeleri değiştirmez, yerine koyar: dizilerin sığ kopyası yeter (bin görselli kartı kopyalamak saniyeler sürerdi)
  const kopya = (x) => JSON.parse(JSON.stringify(x));
  const belgeler = store.belgeler.map((b) => ({ ...b }));
  const kirpintilar = store.kirpintilar.slice(), kartlar = store.kartlar.slice(), klasorler = KLASORLER.map((k) => ({ ...k }));
  const derlemeler = (store.derlemeler || []).slice();
  const sonuc = { eklenen: 0, guncellenen: 0, eksik: 0 };
  const dosyaYaz = [], alinan = new Set();
  // Eski yedekten gelen dosyasız belge verisi kendi örnek sürümünü taşır: açılışta app.js örnekse onu yeni düzene çeker
  const yedekOrnek = Number(durum.ornekSurum) || 0;
  for (const y of durum.belgeler) {
    if (!y || typeof y.id !== "string" || !y.id || !BELGE_TURLERI.has(y.tur)) continue;
    // Belge verisi düz bir nesne olmalı (başka türün dizisi ya da metni açılışta ekranı düşürür)
    veriDuzelt(y);
    if (typeof y.kapak !== "string") y.kapak = renkSec(y.ad || "");
    // Bozuk ad tek kayıtla bütün kitaplığı düşürmesin
    if (typeof y.ad !== "string" || !y.ad.trim()) y.ad = "Adsız belge";
    const i = belgeler.findIndex((b) => b.id === y.id);
    if (i >= 0 && !yedektekiYeni(belgeler[i], y)) continue;
    // Dosyası yedekte olmayan belge alınmaz (açılamazdı); burada da varsa yerel hâli kalır
    const g = y.dosya ? `dosyalar/${y.id}` : null;
    if (g && !arsiv.var(g)) { sonuc.eksik++; continue; }
    y.veri ??= null;
    if (!y.dosya && yedekOrnek < ORNEK_SURUM && Array.isArray(y.veri?.sayfalar)) y.veri.ornekSurum = yedekOrnek;
    if (i >= 0) { belgeler[i] = y; sonuc.guncellenen++; } else { belgeler.push(y); sonuc.eklenen++; }
    if (g) dosyaYaz.push([y, g]);
    alinan.add(y.id);
  }
  // Alınan belgelerin ek dosyaları (ses, görsel) da gelir
  const ekYaz = [];
  for (const yol of arsiv.yollar()) {
    const m = /^ekler\/([^/]+)\/(.+)$/.exec(yol);
    if (m && alinan.has(m[1])) ekYaz.push([m[1], m[2], yol]);
  }
  const birlestir = (hedef, kaynak, yeniMi = () => false) => {
    if (!Array.isArray(kaynak)) return 0;
    let n = 0;
    for (const x of kaynak) {
      if (!x || !x.id) continue;
      const i = hedef.findIndex((v) => v.id === x.id);
      if (i < 0) { hedef.push(x); n++; } else if (yeniMi(hedef[i], x)) hedef[i] = x;
    }
    return n;
  };
  birlestir(klasorler, durum.klasorler);
  sonuc.kirpinti = birlestir(kirpintilar, durum.kirpintilar);
  sonuc.kart = birlestir(kartlar, durum.kartlar, (a, b) => (b.gecmis?.length || 0) > (a.gecmis?.length || 0));
  // Derleme: yedektekinin girdisi fazlaysa onunki (ad ve sıra da onunla gelir)
  birlestir(derlemeler, derlemeTemizle(durum.derlemeler), (a, b) => b.girdiler.length > a.girdiler.length);
  if (durum.ornekCizgi) ornekCizgi = true;
  kirpintilar.sort((a, b) => (b.zaman || 0) - (a.zaman || 0));
  let yzKopya = null;
  try { yzKopya = store.ayarlar.yz ? kopya(store.ayarlar.yz) : null; } catch { /* kopyalanamayan alan */ }
  let ayarlar = null;
  if (durum.ayarlar && typeof durum.ayarlar === "object") {
    const { yz, ...digerleri } = durum.ayarlar;
    // Bilinen ayar yalnız aynı türdeyse alınır (tema: 42 gibi bozuk değer uygulamaya girmesin)
    const tur = (v) => (Array.isArray(v) ? "dizi" : v === null ? "bos" : typeof v);
    ayarlar = Object.fromEntries(Object.entries(digerleri)
      .filter(([k, v]) => store.ayarlar[k] == null || tur(store.ayarlar[k]) === tur(v)));
    if (yz && yzKopya) {
      for (const k of ["yol", "uygulama", "saglayici"]) if (typeof yz[k] === "string") yzKopya[k] = yz[k];
      if (yz.modeller && typeof yz.modeller === "object") Object.assign(yzKopya.modeller ||= {}, yz.modeller);
    }
  }

  // Otomatik kayıt baştan durur: eski liste yeni kaydın üstüne yazılmasın
  kilit = true;
  clearTimeout(zaman);
  try {
    // Dosyalar tek tek yazılır (arşivden dilim olarak, belleğe alınmadan).
    // Burada zaten olan dosyanın üstüne yazılmaz: aynı kimlik aynı dosyadır, yarıda kesilirse
    // eski notlar başka bir dosyayla eşleşmez. Liste yazılmadan kesilirse yeni dosyalar listede
    // olmadığı için açılıştaki temizlik siler.
    const varMi = (anahtar) => islem("dosyalar", "readonly", (d) => d.dosyalar.count(anahtar)).then((n) => n > 0, () => false);
    for (const [b, yol] of dosyaYaz) {
      if (await varMi(b.id)) continue;
      const ham = await arsiv.blob(yol);
      await dosyaKaydet(b.id, new Blob([ham], { type: TUR_MIME[b.tur] || "" }));
    }
    for (const [belgeId, ad, yol] of ekYaz) {
      if (await varMi(ekAnahtari(belgeId, ad))) continue;
      const ham = await arsiv.blob(yol);
      const tur = durum.ekler?.[belgeId]?.[ad];
      await islem("dosyalar", "readwrite", (d) => d.dosyalar.put(new Blob([ham], { type: typeof tur === "string" ? tur : "" }), ekAnahtari(belgeId, ad)));
    }
    await islem("durum", "readwrite", (d) => {
      for (const b of belgeler) {
        if (b.veri != null) d.durum.put(b.veri, veriAnahtari(b.id));
        if (b.kapakGorsel) d.durum.put(b.kapakGorsel, kapakAnahtari(b.id));
      }
      // Kartlar kart başına; burada silinmiş ama henüz yazılmamış kart geri gelmesin diye kayıtta kalan fazlası da silinir
      kartlariYaz(d.durum, { hepsi: true, kartlar });
      d.durum.put(kirpintilar, "kirpintilar");
      d.durum.put(derlemeler, "derlemeler");
      if (yzKopya) d.durum.put(yzKopya, YZ);
      return d.durum.put(listeKaydi(belgeler, klasorler), LISTE);
    });
  } catch (hata) {
    // Kitaplık değişmedi: otomatik kayıt yeniden açılır
    kilit = false;
    kaydetPlanla();
    console.warn("[kenar-notu] Yedek yazılamadı:", hata);
    throw Object.assign(new Error("Yedek yüklenemedi; kitaplık değişmedi."), { kod: "yazma" });
  }
  // Yazıldı: yenilenene kadar kilit kalır. Ayarların localStorage kısmı app.js'te pagehide ile yazılır.
  if (ayarlar) Object.assign(store.ayarlar, ayarlar);
  if (yzKopya) store.ayarlar.yz = yzKopya;
  yerelTercihleriYaz(durum.yerel);
  try { sessionStorage.setItem("kn-tasarim:yedek-sonuc", JSON.stringify(sonuc)); } catch { /* bildirim çıkmaz */ }
  bus.emit("kayit:yuklendi", sonuc);
  setTimeout(() => location.reload(), 0);
  return sonuc;
}

// Silinen belgenin kartları kaldırılır, "Geri al" ile aynı kimlikleriyle döner
export function belgeKartlariniKaldir(belgeId) {
  const giden = store.kartlar.filter((k) => k.belgeId === belgeId);
  for (const k of giden) kartSil(k.id);
  return () => { for (const k of giden.reverse()) if (!store.kartlar.some((x) => x.id === k.id)) kartEkle({ ...k }); };
}
