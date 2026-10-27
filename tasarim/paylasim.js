// Paylaşım hedefi ve hizmet çalışanı kaydı (OZELLIKLER-3 §6).
// sw.js paylaşılanı "kenar-notu-paylasim" veritabanına koyar ve ./#paylasim'e döner; burada okunur ve silinir.
// Dosya (PDF, EPUB): içe aktarılır ve açılır. Görüntü: kırpıntı. Metin ya da adres: bekleyen asistana cevap,
// bekleyen yoksa "Gelen not" kırpıntısı.
import { bus, kirpintiEkle, toast, store } from "./ortak.js";

const PAYLASIM_DB = "kenar-notu-paylasim";
const PAYLASIM_DEPO = "bekleyen";
const GORSEL_EN_BUYUK = 1600; // kırpıntı görseli uzun kenarı (piksel)

/* ---------- hizmet çalışanı ---------- */
// localhost güvenli sayılır; düz http ile ağdan açılınca kayıt yapılmaz, uygulama yine çalışır
let kayitSozu = null;
export function swKaydet() {
  if (kayitSozu) return kayitSozu;
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return (kayitSozu = Promise.resolve(null));
  kayitSozu = new Promise((coz) => {
    const kaydet = () => navigator.serviceWorker.register(new URL("./sw.js", import.meta.url), { scope: new URL("./", import.meta.url).href })
      .then(coz, (hata) => { console.warn("[kenar-notu] hizmet çalışanı kaydedilemedi", hata); coz(null); });
    // İlk boyamayla yarışmasın
    if (document.readyState === "complete") setTimeout(kaydet, 0);
    else addEventListener("load", () => setTimeout(kaydet, 0), { once: true });
  });
  return kayitSozu;
}
swKaydet();

/* ---------- bekleyen paylaşımlar ---------- */
function dbAc() {
  return new Promise((coz, red) => {
    const r = indexedDB.open(PAYLASIM_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(PAYLASIM_DEPO, { keyPath: "id" });
    r.onsuccess = () => coz(r.result);
    r.onerror = () => red(r.error);
    r.onblocked = () => red(new Error("paylaşım deposu kilitli"));
  });
}

// Bekleyenler yalnız okunur; kayıt, içeriği kalıcı yazılınca silinir (arada sekme kapanırsa kaybolmasın)
async function bekleyenleriAl() {
  const db = await dbAc();
  try {
    return await new Promise((coz, red) => {
      const t = db.transaction(PAYLASIM_DEPO, "readonly");
      let liste = [];
      t.objectStore(PAYLASIM_DEPO).getAll().onsuccess = (e) => { liste = e.target.result || []; };
      t.oncomplete = () => coz(liste.sort((a, b) => a.zaman - b.zaman));
      t.onerror = () => red(t.error);
      t.onabort = () => red(t.error);
    });
  } finally {
    db.close();
  }
}

// Bitenler silinir, yarım kalanlar güncel hâliyle yeniden yazılır
async function bekleyenleriGuncelle(silinecek, guncel) {
  if (!silinecek.length && !guncel.length) return;
  const db = await dbAc();
  try {
    await new Promise((coz, red) => {
      const t = db.transaction(PAYLASIM_DEPO, "readwrite");
      for (const id of silinecek) t.objectStore(PAYLASIM_DEPO).delete(id);
      for (const k of guncel) t.objectStore(PAYLASIM_DEPO).put(k);
      t.oncomplete = coz;
      t.onerror = () => red(t.error);
      t.onabort = () => red(t.error);
    });
  } finally {
    db.close();
  }
}

/* ---------- açılış ---------- */
let calisiyor = null;
let kontrolEdildi = false;

export async function paylasimKontrol() {
  kontrolEdildi = true;
  if (calisiyor) return calisiyor;
  // İki sekme aynı paylaşımı iki kez almasın: kuyruk kilitle tek sekmede işlenir
  const kilitli = (fn) => (navigator.locks?.request ? navigator.locks.request("kn-paylasim", fn) : fn());
  calisiyor = kilitli(isle).finally(() => { calisiyor = null; });
  return calisiyor;
}

// Uygulama açıkken paylaşımla gelinirse (aynı pencere, yalnız adres değişti)
addEventListener("hashchange", () => {
  if (kontrolEdildi && /^#paylasim/.test(location.hash)) paylasimKontrol();
});

async function isle() {
  const hata = location.hash === "#paylasim-hata";
  // #paylasim adresi geçmişte kalmasın; yönlendirme kitaplığı görür
  if (/^#paylasim/.test(location.hash)) history.replaceState(history.state, "", location.pathname + location.search);
  if (hata) toast("Paylaşılan içerik alınamadı.");
  if (!("indexedDB" in window)) return;

  let liste;
  try { liste = await bekleyenleriAl(); } catch (e) { console.warn("[kenar-notu] paylaşım okunamadı", e); return; }
  if (!liste.length) return;

  let acilacak = null;
  let belgeSayisi = 0;
  let gorselSayisi = 0;
  let notSayisi = 0;
  let cevap = false;
  const reddedilen = [];

  const geriKoy = [], biten = [];
  // Kırpıntı kuyruk öğesinin kimliğini taşır (kaynak): kuyruk silinemeden kırpıntı kayda geçtiyse
  // bir sonraki açılışta aynı paylaşım ikinci kez eklenmez
  const alinmis = (kaynak) => store.kirpintilar.some((x) => x.kaynak === kaynak);
  for (const k of liste) {
    const metin = metniTopla(k);
    let metinKullanildi = false;
    let sorun = false;
    for (const [i, d] of (k.dosyalar || []).entries()) {
      const tur = dosyaTuru(d);
      if (!tur) { reddedilen.push(d.ad); continue; }
      try {
        if (tur === "gorsel") {
          const kaynak = `${k.id}/${d.ad || ""}/${i}`;
          if (!alinmis(kaynak)) { await gorselKirpinti(d, k.baslik || metin, kaynak); gorselSayisi++; }
          metinKullanildi = true;
        } else {
          const belge = await belgeAl(d);
          if (belge) { acilacak = belge; belgeSayisi++; }
        }
        d.alindi = true;
      } catch (e) {
        console.error("[kenar-notu] paylaşılan dosya alınamadı", d.ad, e);
        sorun = true;
      }
    }
    if (metin && !metinKullanildi && !k.metinAlindi && !alinmis(`${k.id}/metin`)) {
      try {
        // Asistan hesap yolunda cevap bekliyorsa ona gider; dinleyici alırsa alindi = true yapar
        // Yalnız başlık geldiyse başlık metnin kendisidir (iki kez yazılmaz)
        const baslik = metin === k.baslik ? "" : k.baslik || "";
        const olay = { metin, baslik, url: k.url || "", alindi: false };
        bus.emit("asistan:gelen", olay);
        if (olay.alindi) cevap = true;
        else { await metinKirpinti(metin, baslik, `${k.id}/metin`); notSayisi++; }
        k.metinAlindi = true;
      } catch (e) {
        console.error("[kenar-notu] paylaşılan metin alınamadı", e);
        sorun = true;
      }
    }
    // Hata veren kısım sonraki açılışta yeniden denenir (en çok 3 kez), alınanlar tekrar gelmez
    if (sorun) {
      k.dosyalar = (k.dosyalar || []).filter((d) => !d.alindi);
      k.deneme = (k.deneme || 0) + 1;
      if (k.deneme < 3) { geriKoy.push(k); continue; }
      reddedilen.push(...k.dosyalar.map((d) => d.ad), ...(k.metinAlindi ? [] : ["metin"]));
    }
    biten.push(k.id);
  }
  // Kırpıntılar ve yeni belgeler kalıcı yazılmadan kuyruk boşalmaz; yazılamazsa sonraki açılışta yeniden denenir
  let yazildi = false;
  try { yazildi = await (await import("./kayit.js")).hemenKaydet(); } catch { yazildi = false; }
  if (yazildi) await bekleyenleriGuncelle(biten, geriKoy).catch((e) => console.warn("[kenar-notu] paylaşım kuyruğu güncellenemedi", e));
  const yarim = geriKoy.length ? " Bir kısmı alınamadı, uygulama yeniden açılınca tekrar denenecek." : "";

  if (reddedilen.length) toast(`Açılamadı: ${reddedilen.join(", ")}. PDF, EPUB ya da görüntü paylaş.`);
  else if (yarim && !acilacak && !gorselSayisi && !notSayisi) toast(yarim.trim());
  if (acilacak) {
    if (belgeSayisi > 1 || yarim) toast(`${belgeSayisi === 1 ? "Belge" : `${belgeSayisi} belge`} kitaplığa eklendi.${yarim}`);
    bus.emit("git", { ekran: "belge", belgeId: acilacak.id });
    return;
  }
  const parca = [];
  if (gorselSayisi) parca.push(gorselSayisi === 1 ? "Görüntü kırpıntılara eklendi" : `${gorselSayisi} görüntü kırpıntılara eklendi`);
  if (notSayisi) parca.push(notSayisi === 1 ? "Gelen not kırpıntılara eklendi" : `${notSayisi} gelen not kırpıntılara eklendi`);
  if (cevap && !parca.length) return; // asistan cevabı kendi panelinde gösterir
  if (parca.length) toast(parca.join(", ") + "." + yarim, { etiket: "Göster", calistir: () => bus.emit("git", { ekran: "kitaplik", gorunum: "kirpilanlar" }) });
}

function metniTopla(k) {
  // Android çoğu zaman adresi metnin içine de koyar: aynısı iki kez yazılmaz
  const metin = k.metin || "";
  const parcalar = [metin];
  if (k.url && !metin.includes(k.url)) parcalar.push(k.url);
  const sonuc = parcalar.filter(Boolean).join("\n").trim();
  // Yalnız başlıkla gelen paylaşım kaybolmasın: başlık not olur (dosya varsa görüntünün notu olur)
  return sonuc || (k.dosyalar?.length ? "" : String(k.baslik || "").trim());
}

function dosyaTuru(d) {
  const ad = (d.ad || "").toLowerCase();
  const tur = (d.tur || "").toLowerCase();
  if (tur === "application/pdf" || ad.endsWith(".pdf")) return "pdf";
  if (tur === "application/epub+zip" || ad.endsWith(".epub")) return "epub";
  if (tur.startsWith("image/")) return "gorsel";
  return null;
}

async function belgeAl(d) {
  const { belgeIceAktar } = await import("./kayit.js");
  const blob = d.blob;
  const file = blob instanceof File ? blob : new File([blob], d.ad, { type: d.tur || blob.type });
  return belgeIceAktar(file);
}

/* ---------- kırpıntılar ---------- */
async function gorselKirpinti(d, not = "", kaynak) {
  const gorsel = await gorselKucult(d.blob, d.tur);
  kirpintiyiYaz({ gorsel, belgeId: null, belgeAd: adSadelestir(d.ad) || "Paylaşılan görüntü", sayfa: 1 }, not, kaynak);
}
// Not alanı kısa durur (240); uzun metnin tamamı "metin" alanında saklanır, büyütülünce görünür
function kirpintiyiYaz(alanlar, not, kaynak) {
  const k = kirpintiEkle({ ...alanlar, not: notKisalt(not) });
  if (not.length > 240) k.metin = not;
  if (kaynak) k.kaynak = kaynak;
  return k;
}

async function gorselKucult(blob, tur = "") {
  const bmp = await createImageBitmap(blob);
  try {
    const o = Math.min(1, GORSEL_EN_BUYUK / Math.max(bmp.width, bmp.height));
    if (o === 1 && blob.size < 1.5e6) return blobDataUrl(blob);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * o);
    c.height = Math.round(bmp.height * o);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, 0, 0, c.width, c.height);
    // Saydamlığı olabilecek türler PNG kalır, fotoğraflar JPEG
    return /png|gif|webp|svg/.test(tur) ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.86);
  } finally {
    bmp.close?.();
  }
}

const blobDataUrl = (blob) => new Promise((coz, red) => {
  const r = new FileReader();
  r.onload = () => coz(r.result);
  r.onerror = () => red(r.error);
  r.readAsDataURL(blob);
});

// Metin kırpıntısı: pano kartı görsel ister, metin kâğıt fiş olarak basılır
async function metinKirpinti(metin, baslik = "", kaynak) {
  const gorsel = await metinGorseli(metin, baslik);
  kirpintiyiYaz({ gorsel, belgeId: null, belgeAd: "Gelen not", sayfa: 1 }, baslik ? `${baslik}: ${metin}` : metin, kaynak);
}

async function metinGorseli(metin, baslik) {
  const W = 640, PAD = 36, OLC = 2;
  const govdeYazi = '400 22px "Literata", Georgia, serif';
  const baslikYazi = '600 15px "Instrument Sans", system-ui, sans-serif';
  try { await Promise.all([document.fonts.load(govdeYazi, metin), document.fonts.load(baslikYazi, "GELEN NOT")]); } catch { /* yedek yazı tipi */ }
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = govdeYazi;
  const satirlar = satirla(g, metin, W - 2 * PAD, 9);
  const H = PAD * 2 + 34 + satirlar.length * 34;
  c.width = W * OLC;
  c.height = H * OLC;
  g.scale(OLC, OLC);
  g.fillStyle = "#FFFDF8";
  g.fillRect(0, 0, W, H);
  // Kenar çizgisi: bordo, defter kenarı gibi
  g.fillStyle = "#7D1D2C";
  g.globalAlpha = 0.55;
  g.fillRect(PAD - 16, PAD - 4, 2, H - 2 * PAD + 8);
  g.globalAlpha = 1;
  g.fillStyle = "#685E51";
  g.font = baslikYazi;
  g.textBaseline = "top";
  g.fillText((baslik || "Gelen not").toLocaleUpperCase("tr").slice(0, 48), PAD, PAD);
  g.fillStyle = "#221E19";
  g.font = govdeYazi;
  satirlar.forEach((s, i) => g.fillText(s, PAD, PAD + 34 + i * 34));
  // WebP desteklenmezse tarayıcı PNG verir
  return c.toDataURL("image/webp", 0.92);
}

function satirla(g, metin, genislik, enCok) {
  const satirlar = [];
  for (const paragraf of metin.split(/\n+/)) {
    let satir = "";
    for (const kelime of paragraf.split(/\s+/).filter(Boolean)) {
      let k = kelime;
      // Uzun adresler genişliğe göre bölünür
      while (g.measureText(k).width > genislik) {
        let n = k.length - 1;
        while (n > 1 && g.measureText(k.slice(0, n)).width > genislik) n--;
        if (satir) { satirlar.push(satir); satir = ""; }
        satirlar.push(k.slice(0, n));
        k = k.slice(n);
      }
      const dene = satir ? satir + " " + k : k;
      if (g.measureText(dene).width > genislik && satir) { satirlar.push(satir); satir = k; }
      else satir = dene;
    }
    if (satir) satirlar.push(satir);
    if (satirlar.length > enCok) break;
  }
  if (satirlar.length > enCok) {
    satirlar.length = enCok;
    satirlar[enCok - 1] = satirlar[enCok - 1].replace(/\s*\S*$/, "") + " …";
  }
  return satirlar.length ? satirlar : [""];
}

const notKisalt = (s = "") => (s.length > 240 ? s.slice(0, 237).trimEnd() + "…" : s);
const adSadelestir = (ad = "") => ad.replace(/\.[a-z0-9]{2,5}$/i, "");
