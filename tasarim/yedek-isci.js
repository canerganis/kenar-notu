// Yedek işçisi (OZELLIKLER-8 §3.3): .kenar arşivini kurar ve okur. Ağır iş (JSON, CRC, sıkıştırma, ayrıştırma)
// burada döner, ekran kilitlenmez. Aynı modül kayit.js'ten de içe alınır: arşiv okuyucu (arsivAc) ortaktır,
// işçi açılamayan tarayıcıda yedek aynı kodla ana iş parçacığında kurulur.
//
// Biçim değişmedi (bicim: 1): sıkıştırılmamış (STORE) zip; dosyalar/<id>, ekler/<id>/<ad>, en sonda durum.json
// (deflate-raw, tarayıcı desteklemezse saklanır). zip64 yok.
//
// İşçi mesajları (her işin kendi "is" numarası var):
//   ana -> işçi  { tur: "yaz", durum, girdiler: [[yol, Blob]] }          durumun büyük dizileri boş gelir
//                { tur: "parca", alan: "belgeler" | "kartlar" | "kirpintilar", liste }   sırayla eklenir
//                { tur: "bitir" }                                          arşiv kurulur
//                { tur: "oku", dosya }                                     durum.json ayrıştırılır
//                { tur: "onceki", id, eskiZaman, gun, simdi }              belgenin önceki hâli kopyalanır
//   işçi -> ana  { tur: "hazir" } (açılışta), { tur: "ilerleme", oran: 0..1 },
//                { tur: "parca", alan, liste } (okurken), { tur: "tamam", blob | durum | tanimadi }, { tur: "hata", kod, mesaj }

/* ---------- CRC-32 ---------- */
// Sekizli tablo (slicing-by-8): bayt bayt tablodan dört beş kat hızlı
const CRC = (() => {
  const t = new Uint32Array(256 * 8);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  for (let n = 0; n < 256; n++) { let c = t[n]; for (let k = 1; k < 8; k++) { c = t[c & 0xff] ^ (c >>> 8); t[k * 256 + n] = c >>> 0; } }
  return t;
})();
export function crcEkle(crc, b) {
  let c = (crc ^ 0xffffffff) >>> 0, i = 0;
  const n = b.length, T = CRC;
  for (; i + 8 <= n; i += 8) {
    const a = (c ^ (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24))) >>> 0;
    c = T[1792 + (a & 0xff)] ^ T[1536 + ((a >>> 8) & 0xff)] ^ T[1280 + ((a >>> 16) & 0xff)] ^ T[1024 + (a >>> 24)]
      ^ T[768 + b[i + 4]] ^ T[512 + b[i + 5]] ^ T[256 + b[i + 6]] ^ T[b[i + 7]];
  }
  for (; i < n; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function blobCrc(blob, ilerle) {
  let crc = 0;
  const okuyucu = blob.stream().getReader();
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) return crc;
    crc = crcEkle(crc, value);
    ilerle?.(value.length);
  }
}

/* ---------- zip yazıcı ---------- */
// Dosyalar sıkıştırılmadan (PDF, EPUB, ses ve JPEG zaten sıkışık) eklenir ve arşiv Blob'ların kendisinden kurulur:
// içerik belleğe kopyalanmaz, yalnız CRC için parça parça okunur.
export async function zipYaz(girdiler, durumBayt, ilerleme = () => {}) {
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
  // İlerleme bayta göre: dosyaların CRC'si ve durum.json'un sıkışması
  const toplam = girdiler.reduce((s, [, b]) => s + b.size, 0) + durumBayt.length * 2 + 1;
  let biten = 0;
  const ilerle = (n) => { biten += n; ilerleme(Math.min(1, biten / toplam)); };
  for (const [yol, blob] of girdiler) ekle(yol, blob, 0, await blobCrc(blob, ilerle), blob.size);
  // durum.json 4 MB'lık dilimlerle: ilerleme yüzdesi takılmadan akar
  const DILIM = 4 * 2 ** 20;
  let durumCrc = 0;
  for (let i = 0; i < durumBayt.length; i += DILIM) {
    const p = durumBayt.subarray(i, i + DILIM);
    durumCrc = crcEkle(durumCrc, p);
    ilerle(p.length);
  }
  let durumVeri = new Blob([durumBayt]), yontem = 0;
  try {
    const cs = new CompressionStream("deflate-raw");
    const cikti = new Response(cs.readable).blob();
    const yazici = cs.writable.getWriter();
    for (let i = 0; i < durumBayt.length; i += DILIM) {
      const p = durumBayt.subarray(i, i + DILIM);
      await yazici.write(p);
      ilerle(p.length);
    }
    await yazici.close();
    durumVeri = await cikti;
    yontem = 8;
  } catch { durumVeri = new Blob([durumBayt]); yontem = 0; }
  ekle("durum.json", durumVeri, yontem, durumCrc, durumBayt.length);
  const dizinBoyut = dizin.reduce((s, p) => s + p.byteLength, 0);
  const son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true);
  son.setUint16(8, girdiler.length + 1, true);
  son.setUint16(10, girdiler.length + 1, true);
  son.setUint32(12, dizinBoyut, true);
  son.setUint32(16, konum, true);
  return new Blob([...parcalar, ...dizin, son.buffer], { type: "application/zip" });
}

// Bütün yedek: durum JSON'a çevrilir, dosyalarla birlikte arşivlenir. ilerleme(oran): 0..1
export async function yedekUret({ durum, girdiler }, ilerleme = () => {}) {
  const bayt = new TextEncoder().encode(JSON.stringify(durum));
  ilerleme(0.1);
  return zipYaz(girdiler, bayt, (o) => ilerleme(0.1 + o * 0.9));
}

/* ---------- arşiv okuyucu ---------- */
// Arşiv dosya belleğe alınmadan okunur: içerik dizini sondan, saklanan (STORE) dosyalar Blob.slice ile dilim
// olarak gelir, deflate-raw olanlar açılır. Kenar Notu'nun ürettiği biçim içindir (zip64 yok); tanımazsa null
// döner (kayit.js JSZip'i dener). Dosya türü tanımada da kullanılır (EPUB ve CBZ zip'leri).
export async function arsivAc(file) {
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
// Biçim hatası ile okuma ya da bellek hatası ayrılır (ikincisinde dosya yedek olabilir ama açılamadı)
export const okumaHatasi = (hata) => hata?.name === "NotReadableError" || hata?.name === "NotFoundError" || hata instanceof RangeError || /memory|allocation|bellek/i.test(hata?.message || "");

// Yedeğin durum.json'u: { durum } ya da { tanimadi: true } (Kenar Notu biçimi değil, JSZip denenir)
export async function yedekOku(file) {
  let arsiv = null;
  try { arsiv = await arsivAc(file); }
  catch (hata) {
    if (okumaHatasi(hata)) throw Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma" });
    arsiv = null;
  }
  if (!arsiv) return { tanimadi: true };
  try { return { durum: arsiv.var("durum.json") ? JSON.parse(await (await arsiv.blob("durum.json")).text()) : null }; }
  catch (hata) {
    if (okumaHatasi(hata)) throw Object.assign(new Error("Yedek dosyası okunamadı."), { kod: "okuma" });
    return { durum: null };
  }
}

/* ---------- belgenin önceki hâli (OZELLIKLER-8 §3.2) ---------- */
// Kayıttaki veri (veri:<id>) onceki:<id>:<zaman> anahtarına kopyalanır, oncekiDizin:<id> listesi güncellenir.
// Büyük belgede okuma ve yazma saniyeler sürer: kayit.js bunu işçide yaptırır, o belgenin yazması kopya bitince gider.
export const ONCEKI_EN_COK = 7;
const ONCEKI_BUYUK = 24 * 2 ** 20, ONCEKI_SINIR = 96 * 2 ** 20;   // tahmini boyut: büyükte 2 kopya, sınırın üstünde hiç
export const oncekiAnahtari = (id, t) => `onceki:${id}:${String(t).padStart(13, "0")}`;
export const oncekiDizinAnahtari = (id) => "oncekiDizin:" + id;
export function dizinTemizle(x) {
  const liste = Array.isArray(x?.liste) ? x.liste.filter((g) => g && typeof g.anahtar === "string" && g.anahtar.startsWith("onceki:")) : [];
  return { liste, buyuk: !!x?.buyuk };
}
// Kısa özet: sayfa, çizgi (kalem izi) ve iz (vurgu, not, bant, cep defteri girdisi) sayısı
export function ozetCikar(v) {
  const say = (a) => (Array.isArray(a) ? a.length : 0);
  const sayfalar = Array.isArray(v?.sayfalar) ? v.sayfalar : [];
  let cizgi = say(v?.cizgiler), iz = say(v?.izler) + say(v?.vurgular) + say(v?.asistanNotlari);
  for (const s of sayfalar) { cizgi += say(s?.cizgiler); iz += say(s?.notlar) + say(s?.metinler) + say(s?.bantlar); }
  return { sayfa: sayfalar.length, cizgi, iz };
}
// Kabaca bayt: uzun dizilerden 16 örnek alınır (5000 çizgili belgede de birkaç ms)
function boyutTahmini(x) {
  let t = 0;
  const yigin = [[x, 1]];
  while (yigin.length) {
    const [o, c] = yigin.pop();
    if (typeof o === "string") t += o.length * c;
    else if (!o || typeof o !== "object") t += 8 * c;
    else if (Array.isArray(o)) {
      if (o.length > 32) { const adim = o.length / 16; for (let i = 0; i < 16; i++) yigin.push([o[Math.floor(i * adim)], (c * o.length) / 16]); }
      else for (const v of o) yigin.push([v, c]);
    } else for (const k in o) { t += k.length * c; yigin.push([o[k], c]); }
  }
  return t;
}
// En yeni en çok enCok kopya kalır; fazlası silinir
export function oncekiBuda(d, id, liste, enCok = ONCEKI_EN_COK) {
  liste.sort((a, b) => (b.alindi || 0) - (a.alindi || 0));
  for (const g of liste.slice(enCok)) d.delete(g.anahtar);
  d.put({ liste: liste.slice(0, enCok), buyuk: false }, oncekiDizinAnahtari(id));
}
// db: açık "kenar-notu-tasarim" bağlantısı. Kayıtta veri yoksa, bugün zaten alındıysa ya da son kopyadan beri
// değişmediyse (eskiZaman: belgenin son değişim damgası) yeni kopya yok. Dönen: kopya alındı mı.
export function oncekiKopyaAl(db, { id, eskiZaman = 0, gun, simdi = Date.now() }) {
  return new Promise((tamam) => {
    let t, sonuc = false;
    try { t = db.transaction("durum", "readwrite"); } catch { tamam(false); return; }
    const d = t.objectStore("durum");
    const qd = d.get(oncekiDizinAnahtari(id));
    const qv = d.get("veri:" + id);
    qv.onsuccess = () => {
      const dizin = dizinTemizle(qd.result), veri = qv.result;
      if (veri == null || dizin.liste.some((g) => g.gun === gun && !g.donus)) return;
      if (eskiZaman && dizin.liste.some((g) => g.zaman === eskiZaman)) return;
      const boyut = boyutTahmini(veri);
      if (boyut > ONCEKI_SINIR) { if (!dizin.buyuk) d.put({ ...dizin, buyuk: true }, oncekiDizinAnahtari(id)); return; }
      const g = { anahtar: oncekiAnahtari(id, simdi), gun, zaman: eskiZaman, alindi: simdi, ozet: ozetCikar(veri), boyut: Math.round(boyut) };
      d.put(veri, g.anahtar);
      oncekiBuda(d, id, [g, ...dizin.liste], boyut > ONCEKI_BUYUK ? 2 : ONCEKI_EN_COK);
      sonuc = true;
    };
    t.oncomplete = () => tamam(sonuc);
    t.onerror = t.onabort = () => tamam(false);
  });
}
// İşçinin kendi bağlantısı: sürüm verilmez (var olan veritabanı); yoksa kurulmaz, yükseltme gelirse yol verir
function vtAcIsci() {
  return new Promise((tamam, hata) => {
    const q = indexedDB.open("kenar-notu-tasarim");
    q.onupgradeneeded = () => q.transaction.abort();
    q.onsuccess = () => { const db = q.result; db.onversionchange = () => db.close(); tamam(db); };
    q.onerror = () => hata(q.error);
    q.onblocked = () => hata(new Error("engellendi"));
  });
}

/* ---------- işçi ---------- */
// Büyük diziler parça parça gider: tek mesajın kopyası ana iş parçacığını uzun tutmasın
export const PARCALI = ["belgeler", "kartlar", "kirpintilar"];
const isciMi = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (isciMi) {
  const isler = new Map();
  const gonder = (m, aktar) => self.postMessage(m, aktar || []);
  self.onmessage = async (e) => {
    const m = e.data || {};
    const is = m.is;
    try {
      if (m.tur === "yaz") {
        const durum = m.durum || {};
        for (const alan of PARCALI) if (Array.isArray(durum[alan])) durum[alan] = [];
        isler.set(is, { durum, girdiler: m.girdiler || [] });
      } else if (m.tur === "parca") {
        const j = isler.get(is);
        if (j && Array.isArray(m.liste)) for (const x of m.liste) j.durum[m.alan].push(x);
      } else if (m.tur === "bitir") {
        const j = isler.get(is);
        isler.delete(is);
        let son = 0;
        const blob = await yedekUret(j, (oran) => {
          if (oran - son < 0.02 && oran < 1) return;
          son = oran;
          gonder({ is, tur: "ilerleme", oran });
        });
        gonder({ is, tur: "tamam", blob });
      } else if (m.tur === "oku") {
        const s = await yedekOku(m.dosya);
        if (!s.durum || typeof s.durum !== "object") { gonder({ is, tur: "tamam", tanimadi: !!s.tanimadi, durum: null }); return; }
        const durum = s.durum;
        // Ayrıştırılan büyük diziler parça parça döner; her parça ana tarafta ayrı bir iş olur
        for (const alan of PARCALI) {
          const liste = durum[alan];
          if (!Array.isArray(liste)) continue;
          durum[alan] = [];
          for (let i = 0; i < liste.length; i += 20) gonder({ is, tur: "parca", alan, liste: liste.slice(i, i + 20) });
        }
        gonder({ is, tur: "tamam", durum });
      } else if (m.tur === "onceki") {
        const db = await vtAcIsci();
        try { gonder({ is, tur: "tamam", sonuc: await oncekiKopyaAl(db, m) }); } finally { db.close(); }
      }
    } catch (hata) {
      isler.delete(is);
      gonder({ is, tur: "hata", kod: hata?.kod || (okumaHatasi(hata) ? "okuma" : ""), mesaj: String(hata?.message || hata) });
    }
  };
  gonder({ tur: "hazir" });
}
