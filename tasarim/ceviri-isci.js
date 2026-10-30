// Çeviri işçisi: Bergamot (Firefox Translations) WASM motoru burada çalışır, ana iş parçacığı hiç beklemez.
// Klasik işçi (importScripts için). ceviri.js açar; ilk çeviride yüklenir, açılışta değil.
// Model dosyalarını kendisi okur: "kenar-notu-ceviri" > "dosyalar" deposu, anahtar "<cift>/<tur>" (Blob).
// İleti: { id, tur: "kur" | "hazirla" | "yukle" | "cevir" | "bosalt" | "katalog" | "indir" | "durdur", ... }
// Cevap: { id, sonuc } ya da { id, hata: { ad, mesaj, tur } }; indirirken ara ileti { id, ara: alınan bayt }

/* global importScripts */
var Module = {};

const YAPI = { vt: null, motorYolu: "../lib/ceviri/", modul: null, servis: null, modeller: new Map(), sira: [] };
const EN_FAZLA_MODEL = 3;   // bellekte aynı anda tutulan yön sayısı (her biri ~20 MB)

// Motorun kendi gemm uçları: wasm içindeki yedek uygulamalara bağlanır (Firefox'un yerel gemm'i burada yok)
const GEMM = {
  int8_prepare_a: "int8PrepareAFallback",
  int8_prepare_b: "int8PrepareBFallback",
  int8_prepare_b_from_transposed: "int8PrepareBFromTransposedFallback",
  int8_prepare_b_from_quantized_transposed: "int8PrepareBFromQuantizedTransposedFallback",
  int8_prepare_bias: "int8PrepareBiasFallback",
  int8_multiply_and_add_bias: "int8MultiplyAndAddBiasFallback",
  int8_select_columns_of_b: "int8SelectColumnsOfBFallback",
};

/* ---------- motoru yükle ---------- */
let modulSoz = null;
function modulYukle() {
  modulSoz ||= new Promise((tamam, hata) => {
    const wasmUrl = new URL(YAPI.motorYolu + "bergamot-translator-worker.wasm", self.location).href;
    const gemm = () => Object.fromEntries(Object.entries(GEMM).map(([k, ad]) => [k, (...a) => Module.asm[ad](...a)]));
    Object.assign(Module, {
      instantiateWasm(info, kabul) {
        const ithal = { ...info, wasm_gemm: gemm() };
        fetch(wasmUrl, { credentials: "same-origin" })
          .then((y) => {
            if (!y.ok) throw new Error("motor dosyası gelmedi: " + y.status);
            // Yanlış MIME türünde akışlı derleme düşer: arabellekten derlenir
            return WebAssembly.instantiateStreaming(y.clone(), ithal).catch(() => y.arrayBuffer().then((b) => WebAssembly.instantiate(b, ithal)));
          })
          .then(({ instance, module }) => kabul(instance, module))
          .catch(hata);
        return {};
      },
      onRuntimeInitialized() { tamam(Module); },
      print() {}, printErr() {},
    });
    try {
      self.Module = Module;
      importScripts(new URL(YAPI.motorYolu + "bergamot-translator-worker.js", self.location).href);
    } catch (e) { hata(e); }
  }).catch((e) => { modulSoz = null; throw e; });
  return modulSoz;
}

// Eşzamanlı iki yükleme tek servis kurar
let servisSoz = null;
function servisHazir() {
  servisSoz ||= modulYukle().then((m) => {
    YAPI.modul = m;
    YAPI.servis ||= new m.BlockingService({ cacheSize: 0 });
  }).catch((e) => { servisSoz = null; throw e; });
  return servisSoz;
}

// Paket kurulurken motor dosyaları önbelleğe alınır: ilk çeviri internetsiz de açılsın.
// Ad sw.js'teki MOTOR_ONBELLEK ile aynı olmalı.
const MOTOR_ONBELLEK = "kn-tasarim-ceviri-motor";
async function motorIsit() {
  const adlar = ["bergamot-translator-worker.js", "bergamot-translator-worker.wasm"];
  const c = self.caches ? await self.caches.open(MOTOR_ONBELLEK).catch(() => null) : null;
  for (const ad of adlar) {
    const u = new URL(YAPI.motorYolu + ad, self.location).href;
    if (c && (await c.match(u, { ignoreSearch: true }))) continue;
    let y;
    try { y = await fetch(u, { credentials: "same-origin" }); } catch { throw hataYap("ag", "motor dosyası alınamadı"); }
    if (!y.ok) throw hataYap("ag", "motor dosyası gelmedi: " + y.status);
    if (c) await c.put(u, y);
    else await y.arrayBuffer();   // önbellek yoksa en azından HTTP önbelleği dolsun
  }
  return true;
}

/* ---------- IndexedDB ---------- */
// Bağlantı açık tutulur; ana taraf sürüm yükseltirse yol verir
let vtSoz = null;
function vtAc() {
  vtSoz ||= new Promise((tamam, hata) => {
    const q = indexedDB.open(YAPI.vt.ad, YAPI.vt.surum);
    q.onupgradeneeded = () => { q.transaction.abort(); };   // şemayı ana taraf kurar; işçi kurmaz
    q.onsuccess = () => { const db = q.result; db.onversionchange = () => { db.close(); vtSoz = null; }; tamam(db); };
    q.onerror = () => { vtSoz = null; hata(q.error || new Error("veritabanı açılamadı")); };
  });
  return vtSoz;
}
async function islem(depo, kip, fn) {
  const db = await vtAc();
  return new Promise((tamam, hata) => {
    const t = db.transaction(depo, kip);
    const r = fn(t.objectStore(depo));
    t.oncomplete = () => tamam(Array.isArray(r) ? r.map((x) => x.result) : r?.result);
    t.onerror = () => hata(t.error);
    t.onabort = () => hata(t.error || new Error("işlem düştü"));
  });
}
const aralik = (on) => IDBKeyRange.bound(on, on + "\uffff");
// Blob yazılamayan IndexedDB'de (eski Safari, bazı gizli pencereler) aynı veri ArrayBuffer olarak yazılır; okurken ikisi de olur
async function blobYaz(depo, deger, anahtar, sar = (x) => x) {
  try { return await islem(depo, "readwrite", (d) => d.put(sar(deger), anahtar)); }
  catch (e) {
    if (e?.name === "QuotaExceededError") throw e;
    const tampon = await deger.arrayBuffer();
    return islem(depo, "readwrite", (d) => d.put(sar(tampon), anahtar));
  }
}
const blobYap = (x) => (x instanceof Blob ? x : x ? new Blob([x]) : x);
async function dosyalariOku(cift, turler) {
  const r = await islem("dosyalar", "readonly", (d) => turler.map((t) => d.get(`${cift}/${t}`)));
  return Object.fromEntries(turler.map((t, i) => [t, r[i] || null]));
}

/* ---------- paket dosyası indirme ---------- */
// Ağ, gzip açma ve sha256 burada: 13 MB'lık yanıtın bitişi bile ana iş parçacığına uğramaz.
// Her dosya 2 MB'lık dilimlerle "yarim" deposuna yazılır; kesilirse aynı adresten Range ile sürer.
const DILIM = 2 * 1024 * 1024;
const isler = new Map();   // iş kimliği -> AbortController
const hataYap = (tur, mesaj, ek = {}) => Object.assign(new Error(mesaj), { name: "CeviriHatasi", tur, ...ek });

async function yarimSil(anahtar) {
  const ks = await islem("yarim", "readonly", (d) => d.getAllKeys(aralik(anahtar + "#")));
  if (ks?.length) await islem("yarim", "readwrite", (d) => { ks.forEach((k) => d.delete(k)); });
}
async function parcaliIndir(anahtar, url, signal, ilerle) {
  const onceki = [];
  try {
    const ks = (await islem("yarim", "readonly", (d) => d.getAllKeys(aralik(anahtar + "#")))).sort((a, b) => Number(a.split("#")[1]) - Number(b.split("#")[1]));
    for (const k of ks) {
      const v = await islem("yarim", "readonly", (d) => d.get(k));
      if (!v || v.url !== url) { onceki.length = 0; break; }
      onceki.push(blobYap(v.blob));
    }
  } catch { onceki.length = 0; }
  let alinan = onceki.reduce((t, b) => t + b.size, 0);
  let res;
  try { res = await fetch(url, { signal, credentials: "omit", headers: alinan ? { Range: `bytes=${alinan}-` } : {} }); } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw hataYap("ag", "adres açılmadı", { adresHatasi: !alinan });
  }
  if (!res.ok) throw hataYap("ag", String(res.status), { adresHatasi: true });
  if (alinan && res.status !== 206) { await yarimSil(anahtar); onceki.length = 0; alinan = 0; }   // sunucu baştan gönderdi
  ilerle(alinan);
  const okuyucu = res.body.getReader();
  let tampon = [], boy = 0, sira = onceki.length;
  const bosalt = async () => {
    if (!boy) return;
    const b = new Blob(tampon);
    onceki.push(b);
    tampon = []; boy = 0;
    const k = `${anahtar}#${sira++}`;
    await blobYaz("yarim", b, k, (x) => ({ blob: x, url }));
  };
  try {
    for (;;) {
      const { value, done } = await okuyucu.read();
      if (done) break;
      tampon.push(value);
      boy += value.byteLength;
      alinan += value.byteLength;
      ilerle(alinan);
      if (boy >= DILIM) await bosalt();
    }
  } catch (e) {
    await bosalt().catch(() => {});   // kesilen iniş kaldığı yerden sürsün
    throw e;
  }
  await bosalt();
  return new Blob(onceki);
}
async function dogrula(blob, gz, boyut, sha256) {
  const acik = gz ? await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob() : blob;
  if (acik.size !== boyut) return null;
  const ozet = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await acik.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return ozet === sha256 ? new Blob([acik], { type: "application/octet-stream" }) : null;
}
// adresler: [{ url, gz }] sırayla denenir. Adres hiç cevap vermezse ya da dosya tutmazsa sıradakine geçilir;
// iniş ortasında kopan bağlantıda yarım dilimler kalır ve hata döner (yeniden denenince sürer).
async function indir({ anahtar, adresler, boyut, sha256, ad }, isId) {
  const denetci = new AbortController();
  isler.set(isId, denetci);
  const signal = denetci.signal;
  let son = null, sonGonderim = 0;
  const ilerle = (n) => {
    const t = performance.now();
    if (t - sonGonderim < 100) return;   // ana tarafa saniyede en çok 10 ileti
    sonGonderim = t;
    self.postMessage({ id: isId, ara: n });
  };
  try {
    for (const a of adresler) {
      try {
        const ham = await parcaliIndir(anahtar, a.url, signal, ilerle);
        const blob = await dogrula(ham, a.gz, boyut, sha256);
        if (!blob) { await yarimSil(anahtar); throw hataYap("bozuk", `${ad} doğrulanamadı`); }
        await blobYaz("dosyalar", blob, anahtar);
        await yarimSil(anahtar);
        return { tamam: true };
      } catch (e) {
        if (e?.name === "AbortError" || signal.aborted) throw Object.assign(new Error("İptal edildi"), { name: "AbortError" });
        if (!e?.adresHatasi && e?.tur !== "bozuk") throw e?.name === "CeviriHatasi" ? e : hataYap("ag", "İndirme kesildi");
        son = e;
        await yarimSil(anahtar);
      }
    }
    throw son || hataYap("ag", "Paket indirilemedi");
  } finally { isler.delete(isId); }
}

function hizaliBellek(veri, hiza) {
  const bayt = new Int8Array(veri);
  const m = new YAPI.modul.AlignedMemory(bayt.byteLength, hiza);
  m.getByteArrayView().set(bayt);
  return m;
}

// Basit YAML: yalnız düz anahtar: değer
const yaml = (o) => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n";

// Aynı yön için iki istek gelirse ikincisi ilkini bekler
const yuklemeler = new Map();
function modelYukle(m) {
  if (YAPI.modeller.has(m.cift)) { siraOne(m.cift); return Promise.resolve(); }
  if (!yuklemeler.has(m.cift)) yuklemeler.set(m.cift, modelKur(m).finally(() => yuklemeler.delete(m.cift)));
  return yuklemeler.get(m.cift);
}
async function modelKur({ cift, dosyalar }) {
  await servisHazir();
  // dosyalar: { model: "model", lex: "lex", vocab: ["vocab"] | ["srcvocab", "trgvocab"], modelAd }
  const turler = ["model", "lex", ...dosyalar.vocab];
  const okunan = await dosyalariOku(cift, turler);
  for (const t of turler) if (!okunan[t]) throw Object.assign(new Error(`paket eksik: ${cift}/${t}`), { name: "PaketEksik" });
  const tampon = async (x) => (x instanceof Blob ? x.arrayBuffer() : x);
  const model = hizaliBellek(await tampon(okunan.model), 256);
  const lex = hizaliBellek(await tampon(okunan.lex), 64);
  const sozluk = new YAPI.modul.AlignedMemoryList();
  const tekil = [...new Set(dosyalar.vocab)];
  for (const t of tekil) sozluk.push_back(hizaliBellek(await tampon(okunan[t]), 64));
  const ayar = {
    "beam-size": 1, normalize: 1.0, "word-penalty": 0, "cpu-threads": 0,
    "gemm-precision": /alphas/.test(dosyalar.modelAd || "") ? "int8shiftAlphaAll" : "int8shiftAll",
    "skip-cost": true, alignment: "soft", quiet: true, "quiet-translation": true,
    "max-length-break": 128, "mini-batch-words": 1024, workspace: 128, "max-length-factor": 2.0,
  };
  const tm = new YAPI.modul.TranslationModel(yaml(ayar), model, lex, sozluk, null);
  YAPI.modeller.set(cift, tm);
  siraOne(cift);
  // En eski kullanılan yön bellekten çıkar
  while (YAPI.sira.length > EN_FAZLA_MODEL) bosalt(YAPI.sira.pop());
}
function siraOne(cift) {
  YAPI.sira = [cift, ...YAPI.sira.filter((c) => c !== cift)];
}
function bosalt(cift) {
  const m = YAPI.modeller.get(cift);
  if (!m) return;
  YAPI.modeller.delete(cift);
  YAPI.sira = YAPI.sira.filter((c) => c !== cift);
  try { m.delete(); } catch { /* zaten silinmiş */ }
}

// modeller verilirse eksik olan önce yüklenir (bellekten çıkarılmış yön yeniden gelir)
async function cevir({ ciftler, modeller, metinler }) {
  if (modeller) { for (const m of modeller) await modelYukle(m); ciftler = modeller.map((m) => m.cift); }
  const ms = ciftler.map((c) => {
    const m = YAPI.modeller.get(c);
    if (!m) throw Object.assign(new Error("model yüklü değil: " + c), { name: "PaketEksik" });
    siraOne(c);
    return m;
  });
  const girdi = new YAPI.modul.VectorString();
  const secenek = new YAPI.modul.VectorResponseOptions();
  for (const t of metinler) {
    girdi.push_back(t);
    secenek.push_back({ alignment: false, html: false, qualityScores: false });
  }
  const yanit = ms.length > 1
    ? YAPI.servis.translateViaPivoting(ms[0], ms[1], girdi, secenek)
    : YAPI.servis.translate(ms[0], girdi, secenek);
  girdi.delete();
  secenek.delete();
  const cikti = metinler.map((_, i) => yanit.get(i).getTranslatedText());
  yanit.delete();
  return cikti;
}

/* ---------- ileti ---------- */
const ISLER = {
  kur({ vt, motorYolu }) { YAPI.vt = vt; if (motorYolu) YAPI.motorYolu = motorYolu; return true; },
  async hazirla() { const t0 = performance.now(); await servisHazir(); return { sure: Math.round(performance.now() - t0) }; },
  async yukle({ modeller }) {
    const t0 = performance.now();
    for (const m of modeller) await modelYukle(m);
    return { sure: Math.round(performance.now() - t0) };
  },
  cevir,
  motorIsit,
  bosalt({ cift }) { bosalt(cift); return true; },
  // Paket kataloğu: Mozilla kayıtlarındaki sha256 ile aynadaki dosyalar eşlenir; yalnız eksiksiz ve
  // bu motorla uyumlu kuşak (surum deseni) listelenir. Yayındaki sürüm gecelikten, büyük sürüm küçükten üstün.
  async katalog({ rs, hf, surum }) {
    const json = (u) => fetch(u, { credentials: "omit" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("katalog " + r.status))));
    const [kayit, ayna] = await Promise.all([json(rs), json(hf)]);
    const desen = new RegExp(surum);
    const dosyalar = new Map(), gzBoyut = new Map();
    for (const s of ayna.siblings || []) {
      if (s.rfilename.endsWith(".gz")) gzBoyut.set(s.rfilename.slice(0, -3), s.lfs?.size || s.size || 0);
      else if (s.lfs?.sha256) dosyalar.set(s.lfs.sha256, s);
    }
    const gruplar = new Map();
    for (const r of kayit.data || []) {
      const s = dosyalar.get(r.attachment?.hash);
      if (!s || !desen.test(r.version || "")) continue;
      const sur = String(r.version).replace(/a\d*$/, "");
      const a = `${r.fromLang}-${r.toLang}|${sur}`;
      const g = gruplar.get(a) || { kaynak: r.fromLang, hedef: r.toLang, surum: sur, yayin: false, dosyalar: new Map() };
      g.yayin ||= !r.filter_expression;
      g.dosyalar.set(r.fileType, { tur: r.fileType, ad: r.name, yol: s.rfilename, boyut: r.attachment.size, gz: gzBoyut.get(s.rfilename) || 0, sha256: r.attachment.hash });
      gruplar.set(a, g);
    }
    const enIyi = new Map();
    for (const g of gruplar.values()) {
      const t = g.dosyalar;
      if (!t.has("model") || !t.has("lex") || !(t.has("vocab") || (t.has("srcvocab") && t.has("trgvocab")))) continue;
      const a = `${g.kaynak}-${g.hedef}`;
      const o = enIyi.get(a);
      if (!o || (g.yayin && !o.yayin) || (g.yayin === o.yayin && parseFloat(g.surum) > parseFloat(o.surum))) enIyi.set(a, g);
    }
    return [...enIyi.values()].map((g) => ({ kaynak: g.kaynak, hedef: g.hedef, surum: g.surum, dosyalar: [...g.dosyalar.values()] }));
  },
  indir,
  durdur({ is: hedef }) { isler.get(hedef)?.abort(); return true; },
};

self.addEventListener("message", async (e) => {
  const { id, tur, ...veri } = e.data || {};
  try {
    const is = ISLER[tur];
    if (!is) throw new Error("bilinmeyen iş: " + tur);
    const sonuc = await is(veri, id);
    self.postMessage({ id, sonuc });
  } catch (h) {
    self.postMessage({ id, hata: { ad: h?.name || "Error", mesaj: String(h?.message || h), tur: h?.tur || "" } });
  }
});
