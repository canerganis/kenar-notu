// Kenar Notu: çizgi roman motoru (OZELLIKLER-5 "cizgi-belge.js"). Arayüz yok; cizgi.js ve kabuk kullanır.
//
// cizgiAc(kaynak)   kaynak: CBZ Blob, PDF Blob ya da { pdf: pdfAc sonucu }
//   -> { sayfaSayisi, bilgi: { baslik, seri, sayi, yazar, yon }, boyut(i) -> { w, h }, ciftMi(i),
//        gorsel(i, { enFazla }) -> Promise<ImageBitmap>, paneller(i, { yon }?) -> Promise<[{ x, y, w, h }]>,
//        kapak({ en }) -> Promise<Blob>, boyutlarHazir: Promise, kapat() }
// cizgiBilgi(blob)  -> { sayfaSayisi, baslik, seri, sayi, yazar, yon, kapak: Blob | null }
// panelBul(imageData, { yon }) -> [{ x, y, w, h }]   saf fonksiyon; işçiye kaynak koduyla taşınır
//
// Ölçüler: boyut(i) CBZ'de piksel, PDF'te punto (oran için yeter). Paneller 0..1 oransal, okuma sırasında.
// gorsel(): enFazla en uzun kenarın piksel sınırı (varsayılan 4096; CBZ'de büyütülmez, PDF'te tam o boya çizilir).
//   Bitmap motorundur: await'ten hemen sonra çiz, saklama, kapatma. Büyükler aynı anda en çok 5 tane açık kalır,
//   yeni sayfa gelince son istenen sayfaya en uzak olan close() edilir (width 0 olur; gerekirse yeniden iste).
//   enFazla <= 512 küçük resim sayılır, ayrı ve küçük bir önbellekte durur (şerit sayfaları kovmasın).
// bilgi.yon değiştirilebilir (Soldan sağa / Manga); paneller() sırayı o anki yöne göre verir.
// kapat() yalnız kendi açtığını kapatır: { pdf } ile verilen PDF'i açan kapatır.

const BUYUK_SINIR = 5;        // aynı anda çözülmüş büyük sayfa
const KUCUK_SINIR = 40;       // küçük resim önbelleği
const KUCUK_BOY = 512;        // bu boya kadar istek küçük resim sayılır
const PANEL_BOY = 480;        // panel arama görselinin uzun kenarı
const GORSEL_UZANTI = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;

// ---------- JSZip ----------
// index.html klasik script olarak yüklemediyse bir kez buradan yüklenir
let zipYukleniyor = null;
function jszip() {
  if (globalThis.JSZip) return Promise.resolve(globalThis.JSZip);
  zipYukleniyor ||= new Promise((tamam, hata) => {
    const s = document.createElement("script");
    s.src = new URL("../lib/jszip.min.js", import.meta.url).href;
    s.onload = () => (globalThis.JSZip ? tamam(globalThis.JSZip) : hata(new Error("JSZip yüklenemedi")));
    s.onerror = () => { zipYukleniyor = null; hata(new Error("JSZip yüklenemedi")); };
    document.head.append(s);
  });
  return zipYukleniyor;
}

// ---------- küçük yardımcılar ----------
const dogal = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const bosta = (ms = 600) => new Promise((r) => (globalThis.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: ms }) : setTimeout(r, 30)));
const bosluk = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Gizli dosyalar, __MACOSX ve Thumbs.db atlanır; yalnız görsel uzantıları sayfadır
function sayfaMi(yol) {
  if (!GORSEL_UZANTI.test(yol)) return false;
  return !yol.split("/").some((p) => p.startsWith(".") || p === "__MACOSX");
}

async function basBaytlar(blob, n = 16) {
  return new Uint8Array(await blob.slice(0, n).arrayBuffer());
}
const pdfMi = (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
const rarMi = (b) => b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21;

// Görsel başlığından en ve boy. Daha fazla bayt gerekiyorsa undefined, tanınmıyorsa null.
function olcuOku(b) {
  const n = b.length;
  if (n < 24) return undefined;
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const l16 = (i) => b[i] | (b[i + 1] << 8);
  const l32 = (i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24));
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { w: u32(16), h: u32(20) };
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { w: l16(6), h: l16(8) };
  // BMP (boy eksi olabilir: yukarıdan aşağı)
  if (b[0] === 0x42 && b[1] === 0x4d) return n < 26 ? undefined : { w: Math.abs(l32(18)), h: Math.abs(l32(22)) };
  // WebP
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    if (n < 30) return undefined;
    const tur = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tur === "VP8 ") return { w: l16(26) & 0x3fff, h: l16(28) & 0x3fff };
    if (tur === "VP8L") { const v = l32(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    if (tur === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    return null;
  }
  // JPEG: SOFn işaretine kadar bölümleri atla
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < n) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: u16(i + 7), h: u16(i + 5) };
      i += 2 + u16(i + 2);
    }
    return undefined;
  }
  return null;   // AVIF ve diğerleri: çözerek ölçülür
}

// Zip girdisinin yalnız başını açar (JSZip akışı; büyük JPEG'in tamamı açılmaz)
function basOku(dosya, yeter, sinir = 1 << 20) {
  return new Promise((tamam) => {
    let birikim = new Uint8Array(0), bitti = false, akis;
    const kapa = (s) => {
      if (bitti) return;
      bitti = true;
      try { akis?.pause(); } catch { /* boş */ }
      tamam(s ?? null);
    };
    try { akis = dosya.internalStream("uint8array"); } catch { return tamam(null); }
    akis.on("data", (parca) => {
      if (bitti) return;
      const yeni = new Uint8Array(birikim.length + parca.length);
      yeni.set(birikim); yeni.set(parca, birikim.length);
      birikim = yeni;
      const s = yeter(birikim);
      if (s !== undefined) kapa(s); else if (birikim.length > sinir) kapa(null);
    }).on("error", () => kapa(null)).on("end", () => kapa(yeter(birikim))).resume();
  });
}

// ---------- ComicInfo.xml ----------
function comicInfo(metin) {
  const sonuc = { baslik: "", seri: "", sayi: "", yazar: "", yon: "ltr", kapak: -1, cift: new Set(), olcu: new Map() };
  let doc;
  try { doc = new DOMParser().parseFromString(metin, "application/xml"); } catch { return sonuc; }
  if (!doc || doc.getElementsByTagName("parsererror").length) return sonuc;
  const al = (ad) => bosluk(doc.getElementsByTagNameNS("*", ad)[0]?.textContent);
  sonuc.baslik = al("Title");
  sonuc.seri = al("Series");
  sonuc.sayi = al("Number");
  sonuc.yazar = al("Writer");
  if (al("Manga").toLowerCase() === "yesandrighttoleft") sonuc.yon = "rtl";
  for (const p of doc.getElementsByTagNameNS("*", "Page")) {
    const no = parseInt(p.getAttribute("Image"), 10);
    if (!(no >= 0)) continue;
    if (p.getAttribute("Type") === "FrontCover" && sonuc.kapak < 0) sonuc.kapak = no;
    if ((p.getAttribute("DoublePage") || "").toLowerCase() === "true") sonuc.cift.add(no);
    const w = +p.getAttribute("ImageWidth"), h = +p.getAttribute("ImageHeight");
    if (w > 0 && h > 0) sonuc.olcu.set(no, { w, h });
  }
  return sonuc;
}

// ---------- kaynaklar ----------
// Ortak yüz: { sayfaSayisi, bilgi, ipucu: { kapak, cift, olcu }, olcu(i), coz(i, enFazla), kucuk(i, boy), kapat() }

async function cbzKaynak(blob) {
  const JSZip = await jszip();
  let zip;
  try { zip = await JSZip.loadAsync(blob); } catch { throw new Error("Arşiv açılamadı. Dosya bozuk ya da CBZ değil."); }
  const adlar = [];
  let infoAd = null;
  zip.forEach((yol, d) => {
    if (d.dir) return;
    if (sayfaMi(yol)) adlar.push(yol);
    else if (/(^|\/)comicinfo\.xml$/i.test(yol) && !/(^|\/)(__MACOSX|\.)/.test(yol)) {
      // Kökteki ComicInfo öncelikli
      if (!infoAd || yol.split("/").length < infoAd.split("/").length) infoAd = yol;
    }
  });
  if (!adlar.length) throw new Error("Arşivde sayfa görseli bulunamadı.");
  adlar.sort((a, b) => dogal.compare(a, b));

  let ci = comicInfo("");
  if (infoAd) { try { ci = comicInfo(await zip.file(infoAd).async("string")); } catch { /* bilgisiz devam */ } }
  // Başlık yoksa seri ve sayı, o da yoksa tek klasörün adı
  let baslik = ci.baslik || [ci.seri, ci.sayi && "#" + ci.sayi].filter(Boolean).join(" ");
  if (!baslik) {
    const klasorler = new Set(adlar.map((a) => (a.includes("/") ? a.split("/")[0] : "")));
    if (klasorler.size === 1) baslik = [...klasorler][0];
  }
  const tur = (ad) => {
    const u = ad.split(".").pop().toLowerCase();
    return "image/" + (u === "jpg" ? "jpeg" : u);
  };
  const dosyaBlob = async (i) => {
    const d = zip.file(adlar[i]);
    return new Blob([await d.async("uint8array")], { type: tur(adlar[i]) });
  };

  return {
    tur: "cbz",
    sayfaSayisi: adlar.length,
    adlar,
    bilgi: { baslik, seri: ci.seri, sayi: ci.sayi, yazar: ci.yazar, yon: ci.yon },
    ipucu: { kapak: ci.kapak >= 0 && ci.kapak < adlar.length ? ci.kapak : 0, cift: ci.cift, olcu: ci.olcu },
    async olcu(i) {
      const o = await basOku(zip.file(adlar[i]), olcuOku);
      if (o && o.w > 0 && o.h > 0) return o;
      // Başlıktan okunamadı (AVIF vb.): çözüp ölç
      try {
        const bmp = await createImageBitmap(await dosyaBlob(i));
        const s = { w: bmp.width, h: bmp.height };
        bmp.close();
        return s;
      } catch { return null; }
    },
    async coz(i, enFazla, olcu) {
      const b = await dosyaBlob(i);
      const o = olcu || { w: 0, h: 0 };
      const uzun = Math.max(o.w, o.h);
      if (uzun > enFazla) {
        const sec = o.w >= o.h ? { resizeWidth: enFazla } : { resizeHeight: enFazla };
        return createImageBitmap(b, { ...sec, resizeQuality: enFazla <= KUCUK_BOY ? "medium" : "high" });
      }
      const bmp = await createImageBitmap(b);
      // Ölçü bilinmiyordu ve büyük çıktı: ikinci adımda küçült
      if (Math.max(bmp.width, bmp.height) > enFazla) {
        const k = enFazla / Math.max(bmp.width, bmp.height);
        const kucuk = await createImageBitmap(bmp, { resizeWidth: Math.max(1, Math.round(bmp.width * k)), resizeHeight: Math.max(1, Math.round(bmp.height * k)), resizeQuality: "high" });
        bmp.close();
        return kucuk;
      }
      return bmp;
    },
    // Panel araması için: işçi Blob'u kendisi küçülterek çözer
    async kucuk(i, w, h) {
      return { kaynak: await dosyaBlob(i), w, h };
    },
    kapat() { zip = null; },
  };
}

function pdfKaynak(pdf, sahip) {
  const ciz = async (i, olcek, arka) => {
    const cv = document.createElement("canvas");
    const tamam = await pdf.ciz(i, cv, olcek, { arka });
    if (!tamam) { cv.width = cv.height = 0; throw new Error("Sayfa çizilemedi"); }
    return cv;
  };
  return {
    tur: "pdf",
    sayfaSayisi: pdf.sayfaSayisi,
    bilgi: { baslik: "", seri: "", sayi: "", yazar: "", yon: "ltr" },
    ipucu: { kapak: 0, cift: new Set(), olcu: new Map() },
    // PDF ölçüleri pdf-belge'de arka planda dolar; beklemeden o anki bilinen verilir, önbelleğe alınmaz
    canliOlcu: (i) => pdf.boyut(i),
    olcuHazir: pdf.boyutlarHazir,
    async olcu(i) { return pdf.boyut(i); },
    async coz(i, enFazla, olcu) {
      const o = olcu || pdf.boyut(i);
      const cv = await ciz(i, enFazla / Math.max(o.w, o.h), typeof document !== "undefined" && document.hidden);
      try { return await createImageBitmap(cv); } finally { cv.width = cv.height = 0; }
    },
    async kucuk(i, w) {
      const o = pdf.boyut(i);
      const cv = await ciz(i, w / o.w, true);
      try {
        const bmp = await createImageBitmap(cv);
        return { kaynak: bmp, w: bmp.width, h: bmp.height };
      } finally { cv.width = cv.height = 0; }
    },
    kapat() { if (sahip) pdf.kapat(); },
  };
}

async function kaynakAc(kaynak) {
  if (kaynak && kaynak.pdf) return pdfKaynak(kaynak.pdf, false);
  if (!(kaynak instanceof Blob)) throw new Error("Çizgi roman kaynağı tanınmadı");
  const bas = await basBaytlar(kaynak);
  if (rarMi(bas)) throw new Error("CBR (RAR) desteklenmiyor. Dosyayı CBZ'ye çevirip tekrar dene.");
  if (pdfMi(bas)) {
    const { pdfAc } = await import("./pdf-belge.js");
    return pdfKaynak(await pdfAc(kaynak), true);
  }
  return cbzKaynak(kaynak);
}

// ---------- panel işçisi ----------
// Tek işçi bütün açık çizgi romanlara hizmet eder; son çizgi roman kapanınca sonlanır.
// Worker ya da OffscreenCanvas yoksa aynı iş ana iş parçacığında boşta yapılır.
let isci = null;          // Worker | false (kullanılamaz) | null (henüz kurulmadı)
let isciNo = 0;
let acikMotor = 0;
const isciBekleyen = new Map();   // no -> { tamam, hata }

function isciGovdesi() {
  self.onmessage = async (e) => {
    const { no, kaynak, w, h, yon } = e.data;
    try {
      const bmp = kaynak instanceof Blob
        ? await createImageBitmap(kaynak, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" })
        : kaynak;
      const oc = new OffscreenCanvas(w, h);
      const c = oc.getContext("2d", { willReadFrequently: true });
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      self.postMessage({ no, paneller: panelBul(c.getImageData(0, 0, w, h), { yon }) });
    } catch (err) {
      self.postMessage({ no, hata: String(err && err.message || err) });
    }
  };
}

function isciAl() {
  if (isci !== null) return isci;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") throw new Error("yok");
    const kod = `"use strict";\nconst panelBul = ${panelBul.toString()};\n(${isciGovdesi.toString()})();\n`;
    const url = URL.createObjectURL(new Blob([kod], { type: "text/javascript" }));
    isci = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    isci.onmessage = (e) => {
      const b = isciBekleyen.get(e.data.no);
      if (!b) return;
      isciBekleyen.delete(e.data.no);
      e.data.hata ? b.hata(new Error(e.data.hata)) : b.tamam(e.data.paneller);
    };
    isci.onerror = (e) => {
      e.preventDefault?.();
      // İşçi kurulamadı: bekleyenler ana iş parçacığında yeniden denenir
      isci?.terminate?.();
      isci = false;
      for (const b of isciBekleyen.values()) b.hata(Object.assign(new Error("işçi yok"), { isciYok: true }));
      isciBekleyen.clear();
    };
  } catch { isci = false; }
  return isci;
}

function isciyeGonder(is) {
  const w = isciAl();
  if (!w) return Promise.reject(Object.assign(new Error("işçi yok"), { isciYok: true }));
  return new Promise((tamam, hata) => {
    const no = ++isciNo;
    isciBekleyen.set(no, { tamam, hata });
    w.postMessage({ no, ...is }, is.kaynak instanceof ImageBitmap ? [is.kaynak] : []);
  });
}

async function anaIsParcacigindaBul({ kaynak, w, h, yon }) {
  const bmp = kaynak instanceof Blob ? await createImageBitmap(kaynak, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" }) : kaynak;
  await bosta();
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.fillStyle = "#fff";
  c.fillRect(0, 0, w, h);
  c.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const veri = c.getImageData(0, 0, w, h);
  cv.width = cv.height = 0;
  return panelBul(veri, { yon });
}

function isciBirak() {
  if (acikMotor > 0 || !isci) return;
  isci.terminate();
  isci = null;
  for (const b of isciBekleyen.values()) b.hata(new Error("Çizgi roman kapalı"));
  isciBekleyen.clear();
}

// ---------- motor ----------
export async function cizgiAc(kaynak) {
  const k = await kaynakAc(kaynak);
  const n = k.sayfaSayisi;
  let kapali = false;
  acikMotor++;

  // Ölçüler: ComicInfo ipuçları hemen, ilk sayfalar açılışta, kalanlar boşta
  const boyutlar = new Array(n).fill(null);
  for (const [i, o] of k.ipucu.olcu) if (i < n) boyutlar[i] = o;
  const olcuAl = async (i) => {
    if (k.canliOlcu) return k.canliOlcu(i);
    if (boyutlar[i]) return boyutlar[i];
    const o = await k.olcu(i);
    if (o) boyutlar[i] = o;
    return o;
  };
  const ilk = k.canliOlcu ? n : Math.min(n, 6);
  for (let i = 0; i < ilk && !k.canliOlcu; i++) await olcuAl(i);
  const boyutlarHazir = k.olcuHazir || (async () => {
    for (let i = ilk; i < n && !kapali; i++) {
      await olcuAl(i).catch(() => null);
      if (i % 8 === 0) await bosta(400);
    }
    return !kapali;
  })();
  const varsayilan = () => boyutlar.find(Boolean) || { w: 1000, h: 1500 };

  // Çözülmüş sayfalar. buyuk: aynı anda en çok BUYUK_SINIR; merkez son istenen sayfa.
  const buyuk = new Map();   // i -> { boy, soz, bmp }
  const kucuk = new Map();   // i -> { boy, soz, bmp }   (ekleme sırası = LRU)
  let merkez = 0;

  const kov = (harita, sinir, korunan, uzaklik) => {
    const cozulmus = [...harita.entries()].filter(([i, v]) => v.bmp && i !== korunan);
    let fazla = cozulmus.length + (harita.get(korunan)?.bmp ? 1 : 0) - sinir;
    if (fazla <= 0) return;
    cozulmus.sort((a, b) => uzaklik(b[0]) - uzaklik(a[0]));
    for (const [i, v] of cozulmus) {
      if (fazla-- <= 0) break;
      harita.delete(i);
      v.bmp.close();
    }
  };

  function gorsel(i, { enFazla = 4096 } = {}) {
    if (kapali) return Promise.reject(new Error("Çizgi roman kapalı"));
    i = Math.max(0, Math.min(n - 1, i | 0));
    enFazla = Math.max(16, Math.round(enFazla));
    const kucukMu = enFazla <= KUCUK_BOY;
    const harita = kucukMu ? kucuk : buyuk;
    if (!kucukMu) merkez = i;
    const eski = harita.get(i);
    // Eldeki yeterince büyükse (ya da sayfanın kendisi zaten küçükse) yeniden çözülmez
    if (eski && (eski.boy >= enFazla || eski.tam) && !(eski.bmp && eski.bmp.width === 0)) {
      if (kucukMu) { harita.delete(i); harita.set(i, eski); }
      return eski.soz;
    }
    const kayit = { boy: enFazla, tam: false, bmp: null, soz: null };
    kayit.soz = (async () => {
      const o = await olcuAl(i).catch(() => null);
      const bmp = await k.coz(i, enFazla, o);
      if (kapali || harita.get(i) !== kayit) {
        // Bu arada kapandı ya da daha büyüğü istendi: çağırana yine verilir, sonra bırakılır
        setTimeout(() => bmp.close(), 0);
        return bmp;
      }
      kayit.bmp = bmp;
      if (o) {
        kayit.tam = k.tur === "cbz" && Math.max(o.w, o.h) <= enFazla;
        // EXIF döndürmesi: çözülen görselin yönü başlıktakinden farklıysa ölçü düzeltilir
        if ((o.w > o.h) !== (bmp.width > bmp.height) && Math.abs(o.w - o.h) > 4) boyutlar[i] = { w: o.h, h: o.w };
      }
      if (kucukMu) kov(kucuk, KUCUK_SINIR, i, (j) => -[...kucuk.keys()].indexOf(j));
      else kov(buyuk, BUYUK_SINIR, i, (j) => Math.abs(j - merkez));
      return bmp;
    })();
    kayit.soz.catch(() => { if (harita.get(i) === kayit) harita.delete(i); });
    if (eski?.bmp) {
      // Küçüğün yerine büyüğü geliyor: eskisi yenisi hazır olunca bırakılır
      kayit.soz.finally(() => { if (eski.bmp !== kayit.bmp) eski.bmp.close(); });
    }
    harita.set(i, kayit);
    return kayit.soz;
  }

  // Paneller: sayfa ve yön başına önbellek, tek sıra, boşta
  const panelOnbellek = new Map();   // "i|yon" -> Promise
  let panelSirasi = Promise.resolve();
  function paneller(i, { yon = cizgi.bilgi.yon } = {}) {
    i = Math.max(0, Math.min(n - 1, i | 0));
    yon = yon === "rtl" ? "rtl" : "ltr";
    const anahtar = i + "|" + yon;
    if (panelOnbellek.has(anahtar)) return panelOnbellek.get(anahtar);
    const soz = (panelSirasi = panelSirasi.catch(() => {}).then(async () => {
      if (kapali) throw new Error("Çizgi roman kapalı");
      await bosta();
      // Her beklemeden sonra kapanma denetlenir: kapanmış motor yeni işçi kurmasın
      const kapandi = () => new Error("Çizgi roman kapalı");
      if (kapali) throw kapandi();
      const o = (await olcuAl(i)) || varsayilan();
      if (kapali) throw kapandi();
      const kk = PANEL_BOY / Math.max(o.w, o.h);
      const w = Math.max(8, Math.round(o.w * kk)), h = Math.max(8, Math.round(o.h * kk));
      const is = { ...(await k.kucuk(i, w, h)), yon };
      if (kapali) {
        if (is.kaynak instanceof ImageBitmap) is.kaynak.close();
        throw kapandi();
      }
      try {
        return await isciyeGonder(is);
      } catch (e) {
        if (!e.isciYok) throw e;
        // İşçi yoksa ya da kurulamadıysa aynı iş burada; ImageBitmap aktarılmadıysa elde durur
        const tekrar = is.kaynak instanceof ImageBitmap && is.kaynak.width === 0 ? { ...(await k.kucuk(i, w, h)), yon } : is;
        return anaIsParcacigindaBul(tekrar);
      }
    }));
    // Hata önbellekte kalmaz; bulunamazsa tüm sayfa tek panel
    const sonuc = soz.catch((e) => {
      panelOnbellek.delete(anahtar);
      if (kapali) throw e;
      console.warn("[cizgi-belge] panel:", e);
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    });
    panelOnbellek.set(anahtar, sonuc);
    return sonuc;
  }

  // Çift sayfa: ComicInfo DoublePage ya da yatay görsel
  function ciftMi(i) {
    if (k.ipucu.cift.has(i)) return true;
    const o = k.canliOlcu ? k.canliOlcu(i) : boyutlar[i];
    return !!o && o.w > o.h * 1.1;
  }

  // Kapak: JPEG Blob, en piksel genişlik. Sarmal kapak (çift sayfa) ise ön yüzü, yani sağ yarısı.
  async function kapak({ en = 360 } = {}) {
    const i = k.ipucu.kapak;
    const o = (await olcuAl(i)) || varsayilan();
    const cift = o.w > o.h * 1.1;
    const kaynakEn = cift ? en * 2 : en;
    const bmp = await k.coz(i, Math.round(kaynakEn * Math.max(o.w, o.h) / o.w), o);
    try {
      const sx = cift ? Math.floor(bmp.width / 2) : 0, sw = bmp.width - sx;
      const W = Math.max(1, Math.round(en)), H = Math.max(1, Math.round(bmp.height * W / sw));
      let cv, c;
      if (typeof OffscreenCanvas !== "undefined") { cv = new OffscreenCanvas(W, H); c = cv.getContext("2d"); }
      else { cv = document.createElement("canvas"); cv.width = W; cv.height = H; c = cv.getContext("2d"); }
      c.fillStyle = "#fff";
      c.fillRect(0, 0, W, H);
      c.imageSmoothingQuality = "high";
      c.drawImage(bmp, sx, 0, sw, bmp.height, 0, 0, W, H);
      const blob = cv.convertToBlob
        ? await cv.convertToBlob({ type: "image/jpeg", quality: 0.85 })
        : await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
      cv.width = cv.height = 0;
      return blob;
    } finally { bmp.close(); }
  }

  const cizgi = {
    sayfaSayisi: n,
    bilgi: { ...k.bilgi },
    boyutlarHazir,
    boyut: (i) => (k.canliOlcu ? k.canliOlcu(i) : boyutlar[i] || k.ipucu.olcu.get(i) || varsayilan()),
    ciftMi,
    gorsel,
    paneller,
    kapak,
    kapat() {
      if (kapali) return;
      kapali = true;
      for (const v of [...buyuk.values(), ...kucuk.values()]) v.bmp?.close();
      buyuk.clear(); kucuk.clear(); panelOnbellek.clear();
      try { k.kapat(); } catch { /* boş */ }
      acikMotor--;
      isciBirak();
    },
  };
  return cizgi;
}

export async function cizgiBilgi(blob) {
  const c = await cizgiAc(blob);
  try {
    let kapak = null;
    try { kapak = await c.kapak({ en: 360 }); } catch { /* kapaksız */ }
    return { sayfaSayisi: c.sayfaSayisi, ...c.bilgi, kapak };
  } finally { c.kapat(); }
}

// ---------- panel bulma ----------
// Saf fonksiyon: ImageData (yaklaşık 480 px) -> okuma sırasında paneller, 0..1 oransal.
// 1) Kenar rengi tahmini: dış çerçevede beyaz, siyah ya da baskın renk. 2) Zemin olmayan piksel mürekkeptir.
// 3) XY kesme: bölge mürekkebe kırpılır, boydan boya boş satırlarda (oluk) satırlara, yoksa boş sütunlarda
//    sütunlara bölünür; özyinelemeli. Satırlar yukarıdan aşağı, sütunlar yon'a göre. Geniş (çift) sayfada
//    ortadaki dikey oluk önce kesilir: iki sayfa ayrı okunur. 4) Kırıntı atılır, küçük parça en yakın panele katılır.
// İşçiye toString ile taşındığı için dışarıdan hiçbir şeye dayanmaz.
export function panelBul(imageData, { yon = "ltr" } = {}) {
  const W = imageData.width, H = imageData.height, d = imageData.data;
  const tum = [{ x: 0, y: 0, w: 1, h: 1 }];
  if (!W || !H || W * H < 64) return tum;
  const rtl = yon === "rtl";

  // 1) kenar rengi
  const kenar = [];
  const al = (x, y) => { const k = (y * W + x) * 4; kenar.push([d[k], d[k + 1], d[k + 2]]); };
  const kal = Math.max(1, Math.round(Math.min(W, H) * 0.006));
  for (let t = 0; t < kal; t++) {
    for (let x = 0; x < W; x++) { al(x, t); al(x, H - 1 - t); }
    for (let y = 0; y < H; y++) { al(t, y); al(W - 1 - t, y); }
  }
  const beyazSay = kenar.filter((p) => p[0] > 205 && p[1] > 205 && p[2] > 205).length;
  const siyahSay = kenar.filter((p) => p[0] < 50 && p[1] < 50 && p[2] < 50).length;
  let zemin, tol;
  if (beyazSay >= siyahSay && beyazSay >= kenar.length * 0.3) { zemin = [255, 255, 255]; tol = 50; }
  else if (siyahSay > beyazSay && siyahSay >= kenar.length * 0.3) { zemin = [0, 0, 0]; tol = 50; }
  else {
    // Baskın renk (kaba kovalarla); renkli oluklu sayfalar
    const kova = new Map();
    for (const p of kenar) { const a = (p[0] >> 5) * 64 + (p[1] >> 5) * 8 + (p[2] >> 5); kova.set(a, (kova.get(a) || 0) + 1); }
    let enA = 0, enS = -1;
    for (const [a, s] of kova) if (s > enS) { enS = s; enA = a; }
    const uyan = kenar.filter((p) => (p[0] >> 5) * 64 + (p[1] >> 5) * 8 + (p[2] >> 5) === enA);
    zemin = [0, 1, 2].map((c) => uyan.reduce((t, p) => t + p[c], 0) / uyan.length);
    tol = 34;
  }

  // 2) mürekkep maskesi
  const m = new Uint8Array(W * H);
  for (let i = 0, k = 0; i < m.length; i++, k += 4) {
    if (Math.abs(d[k] - zemin[0]) > tol || Math.abs(d[k + 1] - zemin[1]) > tol || Math.abs(d[k + 2] - zemin[2]) > tol) m[i] = 1;
  }

  const minBosluk = Math.max(2, Math.round(Math.min(W, H) * 0.005));
  const alan = W * H;

  // Bölgenin satır ve sütun mürekkep sayıları
  const profil = (x0, y0, x1, y1) => {
    const sat = new Int32Array(y1 - y0), sut = new Int32Array(x1 - x0);
    for (let y = y0; y < y1; y++) {
      let s = 0;
      const o = y * W;
      for (let x = x0; x < x1; x++) if (m[o + x]) { s++; sut[x - x0]++; }
      sat[y - y0] = s;
    }
    return { sat, sut };
  };
  // Boş sayılan çizgi: genişliğin %1'ine kadar mürekkep (balon kuyruğu, JPEG gürültüsü)
  const bosMu = (s, uzunluk) => s <= Math.max(1, uzunluk * 0.01);
  const kirp = (x0, y0, x1, y1) => {
    const { sat, sut } = profil(x0, y0, x1, y1);
    let a = 0, b = sat.length - 1, c = 0, e = sut.length - 1;
    while (a <= b && bosMu(sat[a], x1 - x0)) a++;
    while (b >= a && bosMu(sat[b], x1 - x0)) b--;
    while (c <= e && bosMu(sut[c], y1 - y0)) c++;
    while (e >= c && bosMu(sut[e], y1 - y0)) e--;
    if (a > b || c > e) return null;
    return [x0 + c, y0 + a, x0 + e + 1, y0 + b + 1];
  };
  // Profildeki oluklar: [başlangıç, bitiş) çiftleri, kenarlara değmeyen
  const oluklar = (p, uzunluk) => {
    const s = [];
    let bas = -1;
    for (let i = 0; i <= p.length; i++) {
      const bos = i < p.length && bosMu(p[i], uzunluk);
      if (bos && bas < 0) bas = i;
      else if (!bos && bas >= 0) { if (i - bas >= minBosluk && bas > 0 && i < p.length) s.push([bas, i]); bas = -1; }
    }
    return s;
  };

  const yapraklar = [];
  const bol = (x0, y0, x1, y1, derin, ilk) => {
    const r = kirp(x0, y0, x1, y1);
    if (!r) return;
    [x0, y0, x1, y1] = r;
    if (derin > 10) { yapraklar.push(r); return; }
    const { sat, sut } = profil(x0, y0, x1, y1);
    const sutOluk = oluklar(sut, y1 - y0);
    // Çift sayfa: ortadaki dikey oluk satırlardan önce
    if (ilk && (x1 - x0) > (y1 - y0) * 1.1) {
      const orta = sutOluk.find(([a, b]) => { const c = (a + b) / 2 / (x1 - x0); return c > 0.4 && c < 0.6; });
      if (orta) {
        const sol = [x0, x0 + orta[0]], sag = [x0 + orta[1], x1];
        for (const [a, b] of rtl ? [sag, sol] : [sol, sag]) bol(a, y0, b, y1, derin + 1, false);
        return;
      }
    }
    const satOluk = oluklar(sat, x1 - x0);
    if (satOluk.length) {
      let onceki = y0;
      for (const [a, b] of satOluk) { bol(x0, onceki, x1, y0 + a, derin + 1, false); onceki = y0 + b; }
      bol(x0, onceki, x1, y1, derin + 1, false);
      return;
    }
    if (sutOluk.length) {
      const parcalar = [];
      let onceki = x0;
      for (const [a, b] of sutOluk) { parcalar.push([onceki, x0 + a]); onceki = x0 + b; }
      parcalar.push([onceki, x1]);
      if (rtl) parcalar.reverse();
      for (const [a, b] of parcalar) bol(a, y0, b, y1, derin + 1, false);
      return;
    }
    yapraklar.push(r);
  };
  bol(0, 0, W, H, 0, true);
  if (!yapraklar.length) return tum;

  // 4) kırıntı ve küçük parça: alanın %0,25'inden azı atılır (sayfa no, leke), %1,5'tan azı en yakın panele katılır
  const boyut = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  let liste = yapraklar.filter((r) => boyut(r) >= alan * 0.0025);
  if (!liste.length) liste = [yapraklar.reduce((a, b) => (boyut(a) >= boyut(b) ? a : b))];
  const mesafe = (a, b) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));
  for (let dongu = 0; dongu < 50; dongu++) {
    const kucukler = liste.filter((r) => boyut(r) < alan * 0.015);
    if (!kucukler.length || liste.length < 2) break;
    const r = kucukler.reduce((a, b) => (boyut(a) <= boyut(b) ? a : b));
    let en = null, enM = Infinity;
    for (const q of liste) if (q !== r) { const mm = mesafe(r, q); if (mm < enM) { enM = mm; en = q; } }
    const bir = [Math.min(r[0], en[0]), Math.min(r[1], en[1]), Math.max(r[2], en[2]), Math.max(r[3], en[3])];
    liste = liste.filter((q) => q !== r).map((q) => (q === en ? bir : q));
  }

  const yuv = (v) => Math.round(v * 10000) / 10000;
  return liste.map(([a, b, c, e]) => ({ x: yuv(a / W), y: yuv(b / H), w: yuv((c - a) / W), h: yuv((e - b) / H) }));
}
