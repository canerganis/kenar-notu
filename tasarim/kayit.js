// Kalıcı kayıt: IndexedDB düzeni, içe aktarma, yedek.
// Sözleşme OZELLIKLER-3 "kayit.js". Ek olarak app.js'in kullandığı kayitKur, durumYukle, kaydetPlanla, hemenKaydet, sifirla, kayitBeklet; ek dosya API'si OZELLIKLER-4.
//
// Veritabanı "kenar-notu-tasarim" (sürüm 2):
//   durum:    "kitaplik"     -> { surum: 2, zaman, belgeler (veri ve kapakGorsel olmadan), klasorler,
//                                 ornekSurum (örnek verinin sürümü, ortak.js ORNEK_SURUM; yoksa bilinmiyor) }
//             "veri:<id>"    -> belgenin düzenleyici/okuyucu verisi
//             "kapak:<id>"   -> içe aktarılan belgenin kapak görseli (dataURL)
//             "kartlar", "kirpintilar", "yz" (yapay zekâ ayarları, anahtarlar dahil; yedeğe girmez)
//             "derlemeler"   -> İzlerim'de birleştirilen defterler: [{ id, ad, olusturma, girdiler: [{ belgeId, izId }] }]
//   Belge kaydında dil (10. tur): belge.dil kısa dil kodu ("en"; null: bakıldı, bulunamadı), belge.dilElle kullanıcı seçtiyse true.
//   Çeviri önbelleği ve paketleri ceviri.js'in kendi veritabanında ("kenar-notu-ceviri"); yedeğe girmez.
//   dosyalar: <id>           -> ham PDF/EPUB/CBZ (Blob)
//             "ek/<id>/<ad>" -> belgenin ek dosyaları (ses kaydı, görsel; OZELLIKLER-4)
// 1. sürümde bütün kitaplık "kitaplik" altında tek kayıttı (surum: 1); ilk açılışta bir kez bölünür.

import { bus, store, belgeBul, yeniId, kartEkle, kartSil, KLASORLER, CILT_RENKLERI, ORNEK_SURUM } from "./ortak.js";

const VT = { ad: "kenar-notu-tasarim", surum: 2 };
const LISTE = "kitaplik", YZ = "yz";
const veriAnahtari = (id) => "veri:" + id;
const kapakAnahtari = (id) => "kapak:" + id;
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
let kartlarKirli = false, kirpintilarKirli = false, yzKirli = false, derlemelerKirli = false, hepsiKirli = false;
let kilit = false, zaman = 0;
let ayar = { oncesi: () => [], mesgul: () => false, yakinda: () => false };
let bekleyenBas = 0;   // yazılmamış ilk değişikliğin zamanı (kalem havadayken erteleme sınırı)
// app.js bildirim olarak gösterir: kod "yazma" | "baska" | "serbest" | "degisti"
const uyar = (kod) => bus.emit("kayit:uyari", { kod });

/* ---------- tek yazan sekme ---------- */
// Aynı anda tek sekme yazar: PWA penceresi ve bir sekme açıkken eski liste yeni belgeleri silmesin.
// Kilidi alamayan sekme kaydı okur ama yazmaz (kilit); öbür pencere kapanınca yenilemesi söylenir.
let yazarDegil = false;
export const baskaPencere = () => yazarDegil;
function yazarKilidiAl() {
  if (!navigator.locks?.request) return Promise.resolve(true);
  return new Promise((tamam) => {
    navigator.locks.request("kn-yazar", { ifAvailable: true }, (l) => {
      tamam(!!l);
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

    const [veriAnahtarlar, veriler, kapakAnahtarlar, kapaklar] = await islem("durum", "readonly", (d) => [
      d.durum.getAllKeys(aralik("veri:")), d.durum.getAll(aralik("veri:")),
      d.durum.getAllKeys(aralik("kapak:")), d.durum.getAll(aralik("kapak:")),
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
    const kartlarVar = Array.isArray(kartlar);
    if (kartlarVar) store.kartlar.splice(0, store.kartlar.length, ...kartlar.filter((k) => k && k.id));
    store.derlemeler.splice(0, store.derlemeler.length, ...derlemeTemizle(derlemeler));
    damgaEkle(liste.zaman);
    listeVardi = true;
    ornekSurumAyarla(liste.ornekSurum);
    ornekCizgi = !!liste.ornekCizgi;
    // Silinmiş belgelerden kalan veri, kapak ve dosyalar sessizce temizlenir
    const idler = new Set(liste.belgeler.map((b) => b.id));
    setTimeout(() => yetimleriSil(idler, [...veriMap.keys(), ...kapakMap.keys()]), 4000);
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
    if (kartlarVar) d.durum.put(eski.kartlar, "kartlar");
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

async function yetimleriSil(idler, anahtarIdler) {
  if (kilit) return;
  try {
    // Kayıttaki güncel liste de sayılır: arada başka sekmenin eklediği belge silinmesin
    const guncel = await islem("durum", "readonly", (d) => d.durum.get(LISTE));
    for (const b of guncel?.belgeler || []) idler.add(b.id);
    const anahtarlar = await islem("dosyalar", "readonly", (d) => d.dosyalar.getAllKeys());
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
    if (id && o?.tur === "not") degisen.add(id);
    // Ekran kapanınca ("sayfa") hemen yazılır: kitaplığa dönüp uygulamadan çıkan yazdığını kaybetmesin
    if (o?.tur === "sayfa" && id) hemenKaydet();
    else kaydetPlanla();
  });
  const icerik = (o) => { if (o?.belgeId) { kirli.add(o.belgeId); degisen.add(o.belgeId); } kaydetPlanla(); };
  bus.on("belge:degisti", icerik);
  bus.on("asistan:not", icerik);
  bus.on("kirpintilar", () => { kirpintilarKirli = true; kaydetPlanla(); });
  bus.on("kartlar", () => { kartlarKirli = true; kaydetPlanla(); });
  bus.on("derlemeler", () => { derlemelerKirli = true; kaydetPlanla(); });
  bus.on("ayarlar", () => { yzKirli = true; kaydetPlanla(); });
  document.addEventListener("pointerup", kaydetPlanla, { capture: true, passive: true });
  document.addEventListener("input", kaydetPlanla, { capture: true, passive: true });
  // Android Chrome arka plandaki sekmeyi kapatabilir: gizlenince her şey hemen yazılır
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") hemenKaydet({ tam: true }); });
  addEventListener("pagehide", () => hemenKaydet({ tam: true }));
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
export function hemenKaydet({ tam = false } = {}) {
  clearTimeout(zaman);
  zaman = 0;
  bekleyenBas = 0;
  if (kilit || beklet) return Promise.resolve(false);
  let acikIdler = [];
  try { acikIdler = ayar.oncesi() || []; } catch { /* açık ekran kendi konumunu yazamadıysa son hâli yeter */ }
  const idler = new Set([...kirli, ...acikIdler]);
  kirli.clear();
  const hepsi = hepsiKirli, kartY = tam || hepsi || kartlarKirli, kirpY = tam || hepsi || kirpintilarKirli, yzY = tam || hepsi || yzKirli;
  const derY = tam || hepsi || derlemelerKirli;
  hepsiKirli = kartlarKirli = kirpintilarKirli = yzKirli = derlemelerKirli = false;
  // İçeriği değişen belge damgalanır: yedekten yüklerken hangi sürümün yeni olduğu buna bakar
  const simdi = Date.now();
  for (const id of degisen) { const b = belgeBul(id); if (b) b.degisim = simdi; }
  degisen.clear();
  // Ayrı işlemler: liste önce ve tek başına gider. Büyük bir belgenin ya da kırpıntıların kota hatası
  // ilerlemeyi, yeni belgeleri ve öbür belgelerin verisini götürmez. put kopyayı işlem sırası gelince alır.
  const yaz = (fn, geri) => denetliYaz(fn).then(() => true, (hata) => { geri(); return hata; });
  const isler = [yaz((d) => d.put(listeKaydi(), LISTE), () => {})];
  if (kartY || yzY || derY) isler.push(yaz((d) => {
    if (kartY) d.put(store.kartlar, "kartlar");
    if (derY) d.put(store.derlemeler, "derlemeler");
    if (yzY) { try { d.put(store.ayarlar.yz, YZ); } catch { /* kopyalanamayan alan */ } }
  }, () => { kartlarKirli ||= kartY; yzKirli ||= yzY; derlemelerKirli ||= derY; }));
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
    isler.push(yaz((d) => {
      if (kalemInik()) return false;
      try { d.put(b.veri, veriAnahtari(id)); } catch (hata) { console.warn("[kenar-notu] Veri yazılamadı:", id, hata); }
    }, () => kirli.add(id)));
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

// Tek "durum" işlemi; önce liste damgası denetlenir, başka sekme yazdıysa iptal edilir (kod "degisti").
// fn false dönerse işlem yazmadan biter (kod "ertele")
async function denetliYaz(fn) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    let yabanci = false, ertele = false;
    const t = db.transaction("durum", "readwrite");
    const d = t.objectStore("durum");
    const q = d.get(LISTE);
    q.onsuccess = () => {
      const k = q.result;
      yabanci = k ? !izinli.has(k.zaman) : listeVardi;
      if (yabanci) { t.abort(); return; }
      try { if (fn(d) === false) { ertele = true; t.abort(); } } catch (e) { console.warn("[kenar-notu] Kayıt hazırlanamadı:", e); }
    };
    t.oncomplete = () => { listeVardi = true; tamam(true); };
    t.onerror = t.onabort = () => hata(yabanci ? Object.assign(new Error("Kitaplık başka pencerede değişti"), { kod: "degisti" })
      : ertele ? Object.assign(new Error("kalem"), { kod: "ertele" }) : t.error);
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

/* ---------- içe aktarma ---------- */
// İlk 64 KB için FNV-1a; ad ve boyutla birlikte aynı dosyayı tanır
function ozet(bayt) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bayt.length; i++) { h1 ^= bayt[i]; h1 = Math.imul(h1, 0x01000193); }
  return (h1 >>> 0).toString(36);
}
// "zip": içine bakılmadan karar verilemeyen zip (belgeIceAktar bakar: yalnız görsel varsa çizgi roman)
const CIZGI_MIME = /^application\/(vnd\.comicbook\+zip|x-cbz)$/i;
const CBR_HATA = "CBR (RAR) desteklenmiyor. Dosyayı CBZ'ye çevirip tekrar dene.";
function turBul(ad, mime, bas) {
  if (bas[0] === 0x25 && bas[1] === 0x50 && bas[2] === 0x44 && bas[3] === 0x46) return "pdf";   // %PDF
  // RAR ("Rar!") ya da .cbr: açılamaz, nedeni söylenir
  if ((bas[0] === 0x52 && bas[1] === 0x61 && bas[2] === 0x72 && bas[3] === 0x21) || /\.cbr$/i.test(ad) || /comicbook-rar|x-cbr/i.test(mime || "")) {
    throw Object.assign(new Error(CBR_HATA), { kod: "cbr" });
  }
  if (bas[0] === 0x50 && bas[1] === 0x4b && bas[2] === 3 && bas[3] === 4) {
    // EPUB: zip'in ilk girdisi "mimetype", içeriği application/epub+zip
    const bas60 = new TextDecoder("latin1").decode(bas.subarray(30, 90));
    if (bas60.includes("epub")) return "epub";
    if (/\.epub$/i.test(ad)) return "epub";
    if (/\.cbz$/i.test(ad) || CIZGI_MIME.test(mime || "")) return "cizgi";
    return "zip";
  }
  // %PDF başta değilse (önünde çöp bayt olan PDF'ler) ilk 1 KB'ta aranır
  if (new TextDecoder("latin1").decode(bas.subarray(0, 1024)).includes("%PDF-")) return "pdf";
  if (/\.pdf$/i.test(ad) || mime === "application/pdf") return "pdf";
  return null;
}
// Zip'in içinde yalnız görsel (ve ComicInfo.xml) varsa çizgi roman sayılır; gizli dosyalar ve __MACOSX atlanır
const GORSEL_ADI = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
async function yalnizGorselMi(file) {
  let yollar = null;
  try { yollar = (await arsivAc(file))?.yollar() || null; } catch { yollar = null; }
  if (!yollar && file.size <= 512 * 2 ** 20) {
    try { const z = await (await jszipYukle()).loadAsync(file); yollar = Object.keys(z.files).filter((y) => !z.files[y].dir); }
    catch { yollar = null; }
  }
  if (!yollar) return false;
  const anlamli = yollar.filter((y) => !/(^|\/)(__MACOSX\/|\.)/.test(y) && !/(^|\/)(Thumbs\.db|desktop\.ini)$/i.test(y));
  const gorsel = anlamli.filter((y) => GORSEL_ADI.test(y));
  return gorsel.length > 0 && anlamli.every((y) => GORSEL_ADI.test(y) || /(^|\/)ComicInfo\.xml$/i.test(y));
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
    return { hata: true };
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
  if (tur === "zip") tur = (await yalnizGorselMi(file)) ? "cizgi" : null;
  if (!tur) throw Object.assign(new Error("Desteklenmeyen dosya: " + ad), { kod: "tur" });
  const iz = `${ad}|${file.size}|${ozet(bas)}`;
  const vardi = store.belgeler.find((b) => b.parmakIzi === iz);
  if (vardi) return vardi;

  const bilgi = (await belgeBilgisi(tur, file)) || {};
  const kapakGorsel = await kapakHazirla(bilgi.kapak);
  const dosyaAd = ad.replace(/\.(pdf|epub|cbz|zip)$/i, "").trim() || "Adsız";
  const belgeAd = (tur !== "pdf" && String(bilgi.baslik || "").trim()) || dosyaAd;
  const sayfali = tur === "pdf" || tur === "cizgi";
  const belge = {
    id: yeniId("b"), tur, ad: belgeAd.slice(0, 200),
    yazar: String(bilgi.yazar || "").trim() || undefined,
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

export async function yedekAl() {
  try { ayar.oncesi(); } catch { /* son hâl yeter */ }
  const durum = {
    uygulama: "Kenar Notu", bicim: 1, surum: VT.surum, ornekSurum: ornekSurumu, zaman: Date.now(),
    belgeler: store.belgeler, kirpintilar: store.kirpintilar, kartlar: store.kartlar, klasorler: KLASORLER,
    derlemeler: store.derlemeler, ornekCizgi: ornekCizgi || undefined,
    ayarlar: ayarlarYedegi(),
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
  return zipYaz(girdiler, new TextEncoder().encode(JSON.stringify(durum)));
}
const YEDEK_SINIR = 4 * 2 ** 30 - 64 * 2 ** 20;

/* ---------- zip yazıcı ---------- */
// Dosyalar sıkıştırılmadan (STORE; PDF, EPUB, ses ve JPEG zaten sıkışık) eklenir ve arşiv Blob'ların
// kendisinden kurulur: içerik belleğe kopyalanmaz, yalnız CRC için parça parça okunur.
// durum.json deflate-raw ile sıkışır (tarayıcı desteklemezse saklanır).
const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crcEkle(crc, bayt) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < bayt.length; i++) c = CRC_TABLO[(c ^ bayt[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function blobCrc(blob) {
  let crc = 0;
  const okuyucu = blob.stream().getReader();
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) return crc;
    crc = crcEkle(crc, value);
  }
}
async function zipYaz(girdiler, durumBayt) {
  const parcalar = [], dizin = [];
  const kodla = new TextEncoder();
  const t = new Date();
  const saat = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
  const tarih = ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
  let konum = 0;
  const ekle = (yol, veri, yontem, crc, ham) => {
    const ad = kodla.encode(yol);
    const yerel = new DataView(new ArrayBuffer(30));
    yerel.setUint32(0, 0x04034b50, true);
    yerel.setUint16(4, 20, true);
    yerel.setUint16(6, 0x0800, true);   // UTF-8 ad
    yerel.setUint16(8, yontem, true);
    yerel.setUint16(10, saat, true);
    yerel.setUint16(12, tarih, true);
    yerel.setUint32(14, crc, true);
    yerel.setUint32(18, veri.size, true);
    yerel.setUint32(22, ham, true);
    yerel.setUint16(26, ad.length, true);
    parcalar.push(yerel.buffer, ad, veri);
    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true);
    m.setUint16(4, 20, true);
    m.setUint16(6, 20, true);
    for (let i = 6; i < 28; i++) m.setUint8(i + 2, yerel.getUint8(i));   // bayraktan ad uzunluğuna kadar aynı
    m.setUint32(42, konum, true);
    dizin.push(m.buffer, ad);
    konum += 30 + ad.length + veri.size;
  };
  for (const [yol, blob] of girdiler) ekle(yol, blob, 0, await blobCrc(blob), blob.size);
  const durumCrc = crcEkle(0, durumBayt);
  let durumVeri = new Blob([durumBayt]), yontem = 0;
  try {
    durumVeri = await new Response(durumVeri.stream().pipeThrough(new CompressionStream("deflate-raw"))).blob();
    yontem = 8;
  } catch { durumVeri = new Blob([durumBayt]); }
  ekle("durum.json", durumVeri, yontem, durumCrc, durumBayt.length);
  const dizinBoyut = dizin.reduce((t, p) => t + p.byteLength, 0);
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true);
  son.setUint16(8, girdiler.length + 1, true);
  son.setUint16(10, girdiler.length + 1, true);
  son.setUint32(12, dizinBoyut, true);
  son.setUint32(16, konum, true);
  return new Blob([...parcalar, ...dizin, son.buffer], { type: "application/zip" });
}

// Yedek arşivi dosya belleğe alınmadan okunur: içerik dizini sondan, saklanan (STORE) dosyalar
// Blob.slice ile dilim olarak gelir. Yalnız durum.json açılır (deflate-raw). Kenar Notu'nun ürettiği
// biçim içindir (zip64 yok); tanımazsa null döner ve JSZip denenir.
async function arsivAc(file) {
  const oku = async (bas, son) => new DataView(await file.slice(bas, son).arrayBuffer());
  const n = file.size;
  if (n < 22) return null;
  const kuyrukBas = Math.max(0, n - 65557);
  const kuyruk = await oku(kuyrukBas, n);
  let e = -1;
  for (let i = kuyruk.byteLength - 22; i >= 0; i--) if (kuyruk.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return null;
  const adet = kuyruk.getUint16(e + 10, true), dizinBoyut = kuyruk.getUint32(e + 12, true), dizinBas = kuyruk.getUint32(e + 16, true);
  if (adet === 0xffff || dizinBas === 0xffffffff || dizinBas + dizinBoyut > n) return null;
  const dz = await oku(dizinBas, dizinBas + dizinBoyut);
  const cozucu = new TextDecoder();
  const girdiler = new Map();
  for (let i = 0, p = 0; i < adet; i++) {
    if (p + 46 > dz.byteLength || dz.getUint32(p, true) !== 0x02014b50) return null;
    const yontem = dz.getUint16(p + 10, true), boyut = dz.getUint32(p + 20, true);
    const adUz = dz.getUint16(p + 28, true), ekUz = dz.getUint16(p + 30, true), yorumUz = dz.getUint16(p + 32, true);
    const yerel = dz.getUint32(p + 42, true);
    const ad = cozucu.decode(new Uint8Array(dz.buffer, dz.byteOffset + p + 46, adUz));
    if (!ad.endsWith("/")) girdiler.set(ad, { yontem, boyut, yerel });
    p += 46 + adUz + ekUz + yorumUz;
  }
  const blob = async (yol) => {
    const g = girdiler.get(yol);
    const y = await oku(g.yerel, g.yerel + 30);
    if (y.getUint32(0, true) !== 0x04034b50) throw Object.assign(new Error("Bozuk girdi: " + yol), { kod: "bicim" });
    const bas = g.yerel + 30 + y.getUint16(26, true) + y.getUint16(28, true);
    const dilim = file.slice(bas, bas + g.boyut);
    if (g.yontem === 0) return dilim;
    if (g.yontem === 8) return new Response(dilim.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    throw Object.assign(new Error("Desteklenmeyen sıkıştırma: " + yol), { kod: "bicim" });
  };
  return { var: (yol) => girdiler.has(yol), blob, yollar: () => [...girdiler.keys()] };
}
function jszipArsivi(zip) {
  return {
    var: (yol) => !!zip.file(yol),
    blob: (yol) => zip.file(yol).async("blob"),
    yollar: () => Object.keys(zip.files).filter((y) => !zip.files[y].dir),
  };
}
// Biçim hatası ile okuma ya da bellek hatası ayrılır (ikincisinde dosya yedek olabilir ama açılamadı)
const okumaHatasi = (hata) => hata?.name === "NotReadableError" || hata?.name === "NotFoundError" || hata instanceof RangeError || /memory|allocation|bellek/i.test(hata?.message || "");
async function yedekArsivi(file) {
  let arsiv = null;
  try { arsiv = await arsivAc(file); }
  catch (hata) {
    if (okumaHatasi(hata)) throw Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma", neden: hata });
    arsiv = null;
  }
  if (!arsiv) {
    // Tanınmayan biçim: JSZip bütün dosyayı belleğe alır, büyük dosyada denenmez
    if (file.size > 512 * 2 ** 20) throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
    const JSZip = await jszipYukle();
    try { arsiv = jszipArsivi(await JSZip.loadAsync(file)); }
    catch (hata) {
      if (okumaHatasi(hata)) throw Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma", neden: hata });
      throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
    }
  }
  let durum = null;
  try { durum = arsiv.var("durum.json") ? JSON.parse(await (await arsiv.blob("durum.json")).text()) : null; }
  catch (hata) {
    if (okumaHatasi(hata)) throw Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma", neden: hata });
  }
  if (!durum || !Array.isArray(durum.belgeler)) throw Object.assign(new Error("Bu bir Kenar Notu yedeği değil."), { kod: "bicim" });
  return { arsiv, durum };
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
export async function yedekYukle(file) {
  if (yazarDegil) throw Object.assign(new Error("Kitaplık başka pencerede açık"), { kod: "baska" });
  const { arsiv, durum } = await yedekArsivi(file);

  try { ayar.oncesi(); } catch { /* son hâl yeter */ }
  // Birleşim kopyalar üstünde hazırlanır; canlı durum ancak her şey yazılınca değişir (yarıda kalırsa eskisi durur)
  const kopya = (x) => JSON.parse(JSON.stringify(x));
  const belgeler = store.belgeler.map((b) => ({ ...b }));
  const kirpintilar = kopya(store.kirpintilar), kartlar = kopya(store.kartlar), klasorler = kopya(KLASORLER);
  const derlemeler = kopya(store.derlemeler || []);
  const sonuc = { eklenen: 0, guncellenen: 0, eksik: 0 };
  const dosyaYaz = [], alinan = new Set();
  // Eski yedekten gelen dosyasız belge verisi kendi örnek sürümünü taşır: açılışta app.js örnekse onu yeni düzene çeker
  const yedekOrnek = Number(durum.ornekSurum) || 0;
  for (const y of durum.belgeler) {
    if (!y || !y.id || !y.tur) continue;
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
    ayarlar = digerleri;
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
      d.durum.put(kartlar, "kartlar");
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
