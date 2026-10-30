// Kenar Notu (prototip) hizmet çalışanı. Dosya listesi ya da davranış değişince VERSION artırılır.
// Ağ önce, yoksa önbellek: tablet çevrimiçiyken hep son sürümü alır, internetsizken son görüleni açar.
// Paylaşım hedefi: ./paylas POST'u yakalanır, içerik IndexedDB'ye konur, ./#paylasim adresine 303 ile dönülür.
const VERSION = "6.0.2";
const ONBELLEK = `kn-tasarim-${VERSION}`;
const YAZI_ONBELLEK = "kn-tasarim-yazi"; // yazı tipleri sürümden bağımsız: adresleri değişmez
// Çeviri motoru (lib/ceviri, wasm 5 MB): kabuğa girmez, ilk kullanımda alınır; sürüm artınca yeniden inmesin diye ayrı önbellekte
const MOTOR_ONBELLEK = "kn-tasarim-ceviri-motor";
// Çeviri paketleri (model dosyaları) ceviri.js'in kendi veritabanında durur; bu adresler SW önbelleğine hiç girmez
const PAKET_KAYNAKLARI = /(^|\.)(huggingface\.co|hf\.co|services\.mozilla\.com)$/;
// Paket dosyası uzantıları: ayna bu sitede olsa bile (?ceviriPaket=) önbelleğe girmez
const PAKET_DOSYASI = /\.(bin|spm|gz)$/i;
// lib/ceviri altında yalnız motorun kendi dosyaları önbelleğe girer
const MOTOR_DOSYALARI = ["bergamot-translator-worker.js", "bergamot-translator-worker.wasm"];

const KABUK = [
  "./", "./index.html", "./manifest.webmanifest",
  "./tasarim.css", "./duzenleyici.css", "./okuma.css", "./koltuk.css", "./tekrar.css", "./asistan.css", "./arama.css", "./ses.css", "./izler.css", "./cizgi.css",
  "./app.js", "./ortak.js", "./kalem.js", "./sayfalar.js",
  "./duzenleyici.js", "./okuma.js", "./okuma-metni.js", "./koltuk.js", "./tekrar.js", "./asistan.js",
  "./kayit.js", "./pdf-belge.js", "./epub-belge.js", "./disa-aktar.js", "./paylasim.js",
  "./arama.js", "./ses.js", "./izler.js", "./cizgi.js", "./cizgi-belge.js", "./cizgi-ornek.js",
  "./cekmece.js", "./rehber.js",
  "./ceviri.js", "./ceviri-isci.js",
  "./ikon/ikon.svg", "./ikon/ikon-192.png", "./ikon/ikon-512.png",
  "./ikon/ikon-maskable-192.png", "./ikon/ikon-maskable-512.png", "./ikon/apple-touch-icon.png",
  "../lib/jszip.min.js", "../lib/epub.min.js",
  "../lib/pdf.min.mjs", "../lib/pdf.worker.min.mjs", "../lib/pdf-lib.esm.min.js",
];

// Paylaşılan içerik bu veritabanında bekler; paylasim.js okuyup siler. Uygulamanın kendi deposundan ayrı.
const PAYLASIM_DB = "kenar-notu-paylasim";
const PAYLASIM_DEPO = "bekleyen";

self.addEventListener("install", (e) => {
  // Kabuğun hepsi gelmezse kurulum düşer: eski sürüm ve onun eksiksiz önbelleği yerinde kalır.
  // Yarım kalan yeni önbellek silinir, bir sonraki açılışta yeniden denenir.
  // Yer yoksa (QuotaExceededError) açık sayfalara söylenir: eski sürüm çevrimdışı çalışmaya devam eder
  e.waitUntil(caches.open(ONBELLEK)
    .then((c) => c.addAll(KABUK.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting(), (hata) => caches.delete(ONBELLEK).then(() => { kotaBildir(hata); throw hata; })));
});

// Önbelleğe yazılamadı: depo dolu. Sayfalar bir kez uyarır (app.js "kota" iletisi)
let kotaZamani = 0;
function kotaBildir(hata) {
  if (hata?.name !== "QuotaExceededError" || Date.now() - kotaZamani < 600000) return;
  kotaZamani = Date.now();
  self.clients.matchAll({ type: "window" }).then((l) => l.forEach((c) => c.postMessage({ tur: "kota" }))).catch(() => {});
}

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((adlar) => Promise.all(adlar
      .filter((a) => a.startsWith("kn-tasarim-") && a !== ONBELLEK && a !== YAZI_ONBELLEK && a !== MOTOR_ONBELLEK)
      .map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const istek = e.request;
  const url = new URL(istek.url);

  if (istek.method === "POST" && url.origin === location.origin && url.pathname === new URL("./paylas", self.registration.scope).pathname) {
    e.respondWith(paylasimAl(istek));
    return;
  }
  if (istek.method !== "GET") return;
  // Paket kaynakları ve parçalı (Range) indirmeler doğrudan ağa: önbelleğe girmez, başlık kaybolmaz
  if (PAKET_KAYNAKLARI.test(url.hostname) || istek.headers.has("range") || PAKET_DOSYASI.test(url.pathname)) return;

  // Yazı tipleri: önce önbellek (Google Fonts adresleri sabit), yoksa ağ
  if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    e.respondWith(yaziGetir(istek, url.hostname === "fonts.googleapis.com"));
    return;
  }
  if (url.origin !== location.origin) return;
  // Uygulama kabuğu ve ../lib: yalnız bu klasör ile lib altı
  const kapsam = new URL(self.registration.scope).pathname;
  const lib = new URL("../lib/", self.registration.scope).pathname;
  if (!url.pathname.startsWith(kapsam) && !url.pathname.startsWith(lib)) return;
  if (url.pathname.startsWith(lib + "ceviri/")) {
    if (MOTOR_DOSYALARI.includes(url.pathname.slice((lib + "ceviri/").length))) e.respondWith(agOnce(istek, false, MOTOR_ONBELLEK));
    return;
  }
  e.respondWith(agOnce(istek, istek.mode === "navigate"));
});

async function agOnce(istek, gezinme, onbellek = ONBELLEK) {
  const c = await caches.open(onbellek);
  const kok = new URL("./", self.registration.scope);
  const yol = new URL(istek.url).pathname;
  // index.html ile kök aynı kayıtta tutulur; kapsamdaki başka sayfalar kendi adresiyle
  const anahtar = gezinme && (yol === kok.pathname || yol === kok.pathname + "index.html") ? kok.href : istek;
  try {
    // no-cache: tarayıcının HTTP önbelleği de sunucuya sorar (değişmediyse 304, ucuz); yoksa eski dosya "ağdan" gelebiliyor
    const yanit = await fetch(istek.url, { cache: "no-cache", credentials: "same-origin" });
    if (yanit.ok && yanit.type === "basic") c.put(anahtar, yanit.clone()).catch(kotaBildir);
    return yanit;
  } catch (hata) {
    const eski = (await c.match(anahtar, { ignoreSearch: true }))
      || (gezinme ? (await c.match(kok.href)) || (await c.match(new URL("index.html", kok).href)) : null);
    if (eski) return eski;
    throw hata;
  }
}

// Yazı tipi CSS'i ağ önce (Google tarayıcıya göre içerik verir), dosyaları önbellek önce
async function yaziGetir(istek, css) {
  const c = await caches.open(YAZI_ONBELLEK);
  if (!css) {
    const eski = await c.match(istek);
    if (eski) return eski;
  }
  try {
    const yanit = await fetch(istek);
    if (yanit.ok || yanit.type === "opaque") c.put(istek, yanit.clone()).catch(() => {});
    return yanit;
  } catch (hata) {
    const eski = await c.match(istek);
    if (eski) return eski;
    throw hata;
  }
}

/* ---------- paylaşım hedefi ---------- */
function dbAc() {
  return new Promise((coz, red) => {
    const r = indexedDB.open(PAYLASIM_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(PAYLASIM_DEPO, { keyPath: "id" });
    r.onsuccess = () => coz(r.result);
    r.onerror = () => red(r.error);
  });
}

async function paylasimAl(istek) {
  const don = Response.redirect(new URL("./#paylasim", self.registration.scope).href, 303);
  try {
    const form = await istek.formData();
    const yazi = (ad) => String(form.get(ad) || "").trim();
    // File nesnesi IndexedDB'ye olduğu gibi yazılabilir; ad ve tür ayrıca saklanır
    const dosyalar = form.getAll("dosya")
      .filter((f) => f && typeof f === "object" && f.size > 0)
      .map((f) => ({ ad: f.name || "paylasilan", tur: f.type || "", boyut: f.size, blob: f }));
    const kayit = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), zaman: Date.now(),
      baslik: yazi("title"), metin: yazi("text"), url: yazi("url"), dosyalar };
    if (!dosyalar.length && !kayit.baslik && !kayit.metin && !kayit.url) return don;
    const db = await dbAc();
    await new Promise((coz, red) => {
      const t = db.transaction(PAYLASIM_DEPO, "readwrite");
      t.objectStore(PAYLASIM_DEPO).put(kayit);
      t.oncomplete = coz;
      t.onerror = () => red(t.error);
      t.onabort = () => red(t.error);
    });
    db.close();
  } catch (hata) {
    console.error("[kenar-notu sw] paylaşım alınamadı", hata);
    return Response.redirect(new URL("./#paylasim-hata", self.registration.scope).href, 303);
  }
  return don;
}
