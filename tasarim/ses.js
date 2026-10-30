// Ses kaydı: ders sesini belgeyle birlikte saklar, Masa'daki çizgileri kayıt zamanına bağlar.
// Sözleşme OZELLIKLER-4 "ses.js". Meta veri belge.veri.sesler, ses verisi kayit.js ek dosyası "ses-<id>.webm" (Safari: "ses-<id>.m4a").
// Kalem önce gelir: dalga izi en fazla 15 fps, kalem yazarken 4 fps; kayıt ve oynatma ayrı iş parçacığında.

import { h, icon, bus, belgeBul, store, yeniId, toast, ikiDokunus, hareketAz } from "./ortak.js";

/* ---------- stil ---------- */
// ses.css index.html'e eklenmemişse bir kez buradan yüklenir
if (!document.querySelector('link[href$="ses.css"]')) {
  document.head.append(h("link", { rel: "stylesheet", href: new URL("./ses.css", import.meta.url).href }));
}

/* ---------- ek dosya deposu ---------- */
// kayit.js ek dosya API'si yoksa (henüz yazılmadıysa) kayıtlar yalnız bu oturumda bellekte durur
const bellek = new Map();
let bellekUyarildi = false;
let depoSoz = null;
function depo() {
  depoSoz ||= import("./kayit.js").then((m) => (typeof m.ekDosyaKaydet === "function" ? m : null), () => null);
  return depoSoz;
}
async function sesYaz(belgeId, ad, blob) {
  const m = await depo();
  if (m) return m.ekDosyaKaydet(belgeId, ad, blob);
  bellek.set(belgeId + "/" + ad, blob);
  if (!bellekUyarildi) { bellekUyarildi = true; toast("Ses kaydı yalnız bu oturumda tutuluyor: kalıcı kayıt hazır değil."); }
}
async function sesGetir(belgeId, ad) {
  const m = await depo();
  if (m) return (await m.ekDosyaGetir(belgeId, ad)) || bellek.get(belgeId + "/" + ad) || null;
  return bellek.get(belgeId + "/" + ad) || null;
}
async function sesSilDosya(belgeId, ad) {
  bellek.delete(belgeId + "/" + ad);
  const m = await depo();
  if (m) await m.ekDosyaSil(belgeId, ad);
}
// Dosya adı türe göre: Safari audio/mp4 kaydeder (.m4a), öbürleri WebM. Türü yazılmamış eski kayıtlar .webm kalır.
const uzantiTur = (tur) => (/mp4|aac|m4a/i.test(tur || "") ? "m4a" : "webm");
const dosyaAdi = (id, tur) => `ses-${id}.${uzantiTur(tur)}`;
const metaDosyasi = (m) => dosyaAdi(m.id, m.tur);

/* ---------- meta veri ---------- */
// kayit: { id, belgeId, baslangic, sure, ad, tur?, boyut?, yarim? }  (yarim: kayıt sürüyor ya da kapanmadan kesildi)
// olustur yoksa veri boşken boş dizi döner (belge.veri'yi açan modülden önce yaratmaz)
function sesler(belge, olustur = false) {
  if (!belge || (!belge.veri && !olustur)) return [];
  belge.veri ||= {};
  return (belge.veri.sesler ||= []);
}
function metaBul(kayitId) {
  for (const b of store.belgeler) {
    const k = b.veri?.sesler?.find((x) => x.id === kayitId);
    if (k) return k;
  }
  return null;
}
const degisti = (belgeId) => bus.emit("belge:degisti", { belgeId });

/* ---------- durum ---------- */
const S = {
  kayit: null,    // { id, belgeId, baslangic, t0, rec, akis, parcalar, tur, ctx, analiz, kilit, meta }
  oynat: null,    // { kayitId, belgeId, sure }
  hata: null,     // { kod, metin }
  hiz: 1,
};
try { S.hiz = Number(localStorage.getItem("kn-tasarim:ses-hiz")) || 1; } catch { /* yoksa 1x */ }
const izleyiciler = new Set();   // açık şeritler: durum değişince yeniden kurulur
const haber = () => { for (const fn of izleyiciler) fn(); };
const durumYay = () => bus.emit("ses:durum", { belgeId: S.kayit?.belgeId ?? S.oynat?.belgeId ?? null, durum: S.kayit ? "kayit" : S.oynat ? "oynat" : "bos" });

/* ---------- kayıt ---------- */
// Hata metinleri: şerit bunları aynen gösterir
function hataOlustur(kod, e) {
  const metinler = {
    guvensiz: `Mikrofon yalnız güvenli bağlantıda açılır. Bu adres (${location.origin}) güvenli değil: tablette localhost ya da https ile aç.`,
    destek: "Bu tarayıcı ses kaydını desteklemiyor.",
    izin: "Mikrofon izni verilmedi. Adres çubuğundaki simgeden Mikrofon > İzin ver, sonra yeniden dene.",
    yok: "Mikrofon bulunamadı.",
    mesgul: "Mikrofon başka bir uygulamada kullanılıyor.",
    baska: "Kayıt başlatılamadı" + (e?.message ? `: ${e.message}` : "."),
  };
  return Object.assign(new Error(metinler[kod]), { kod, neden: e });
}
function mimeSec() {
  // Safari (iOS ve macOS) yalnız audio/mp4 kaydeder; yeni Safari WebM'i de "destekliyorum" der ama çalarken mp4 daha güvenli
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const adaylar = safari ? ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus"] : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return adaylar.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

export async function kayitBaslat(belge) {
  if (S.kayit) {
    if (S.kayit.belgeId === belge?.id) return aktifKayit();
    await kayitDurdur();
  }
  if (!belge) throw hataOlustur("baska");
  durdur();
  S.hata = null;
  try {
    if (!window.isSecureContext) throw hataOlustur("guvensiz");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw hataOlustur("destek");
    let akis;
    try {
      akis = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const ad = e?.name;
      throw hataOlustur(ad === "NotAllowedError" || ad === "SecurityError" ? "izin" : ad === "NotFoundError" || ad === "OverconstrainedError" ? "yok" : ad === "NotReadableError" ? "mesgul" : "baska", e);
    }
    const tur = mimeSec();
    let rec;
    try { rec = new MediaRecorder(akis, { ...(tur ? { mimeType: tur } : {}), audioBitsPerSecond: 32000 }); }
    catch { rec = new MediaRecorder(akis); }
    const id = yeniId("s");
    const liste = sesler(belge, true);
    const no = liste.reduce((m, k) => Math.max(m, Number(/^Kayıt (\d+)$/.exec(k.ad)?.[1]) || 0), 0) + 1;
    // Meta hemen yazılır: sekme kapanırsa ara kayıt yeniden açılışta listede kalır
    const meta = { id, belgeId: belge.id, baslangic: Date.now(), sure: 0, ad: `Kayıt ${no}`, tur: rec.mimeType || tur || "audio/webm", yarim: true };
    meta.tur = meta.tur.split(";")[0] || "audio/webm";   // dosya adı ve Blob türü için kodek eki gerekmez
    const K = { id, belgeId: belge.id, baslangic: meta.baslangic, t0: performance.now(), rec, akis, parcalar: [], tur: meta.tur, meta, ctx: null, analiz: null, kilit: null };
    rec.ondataavailable = (e) => { if (e.data?.size) K.parcalar.push(e.data); };
    const basladi = new Promise((tamam) => { rec.onstart = tamam; setTimeout(tamam, 1500); });
    rec.start(1000);   // saniyede bir parça: ara kayıt için
    await basladi;
    K.t0 = performance.now();
    K.baslangic = meta.baslangic = Date.now();
    // Dalga izi için çözümleyici; hoparlöre bağlanmaz
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      K.ctx = new AC({ latencyHint: "playback" });
      K.analiz = K.ctx.createAnalyser();
      K.analiz.fftSize = 512;
      K.ctx.createMediaStreamSource(akis).connect(K.analiz);
      K.ctx.resume?.().catch(() => {});
    } catch { K.ctx = K.analiz = null; }
    // Ders boyunca ekran sönmesin (sönerse tarayıcı kaydı durdurabilir)
    try { K.kilit = await navigator.wakeLock?.request("screen"); } catch { K.kilit = null; }
    liste.push(meta);
    S.kayit = K;
    degisti(belge.id);
    haber();
    durumYay();
    return aktifKayit();
  } catch (e) {
    S.hata = { kod: e.kod || "baska", metin: e.kod ? e.message : hataOlustur("baska", e).message };
    haber();
    throw e;
  }
}

function kayitTemizle(K) {
  try { K.akis.getTracks().forEach((t) => t.stop()); } catch { /* zaten durmuş */ }
  try { K.ctx?.close(); } catch { /* yok */ }
  try { K.kilit?.release(); } catch { /* yok */ }
}

export async function kayitDurdur() {
  const K = S.kayit;
  if (!K) return null;
  S.kayit = null;
  const sure = Math.round(performance.now() - K.t0);
  if (K.rec.state !== "inactive") {
    await new Promise((tamam) => { K.rec.onstop = tamam; try { K.rec.stop(); } catch { tamam(); } setTimeout(tamam, 2000); });
  }
  kayitTemizle(K);
  const blob = new Blob(K.parcalar, { type: K.tur });
  const meta = K.meta;
  Object.assign(meta, { sure, boyut: blob.size });
  haber();
  durumYay();
  // "yarim" ancak ses diske yazılınca kalkar: yazılamazsa ses bellekte kalır, oturum boyunca çalınabilir,
  // sekme gizlenince yeniden yazılmaya çalışılır, istenirse dosya olarak indirilir
  let yazildi = true;
  try {
    await sesYaz(K.belgeId, metaDosyasi(meta), blob);
  } catch (e) {
    yazildi = false;
    console.error("[ses] kayıt yazılamadı:", e);
    bellek.set(K.belgeId + "/" + metaDosyasi(meta), blob);
    yazilamayan.set(K.id, { belgeId: K.belgeId, ad: metaDosyasi(meta), blob, meta });
  }
  if (yazildi) delete meta.yarim;
  degisti(K.belgeId);
  haber();
  if (yazildi) toast(`${meta.ad} kaydedildi · ${sureYaz(sure)}`);
  else toast("Ses kaydı saklanamadı; depo dolu olabilir. Uygulamayı kapatmadan indir.", { etiket: "İndir", calistir: () => sesIndir(blob, meta), kalici: true });
  return kayitDisari(meta);
}
// Diske yazılamamış kayıtlar: { belgeId, ad, blob, meta }
const yazilamayan = new Map();
async function yazilamayanlariDene() {
  for (const [id, y] of yazilamayan) {
    try {
      const m = await depo();
      if (!m) return;
      await m.ekDosyaKaydet(y.belgeId, y.ad, y.blob);
      yazilamayan.delete(id);
      delete y.meta.yarim;
      degisti(y.belgeId);
    } catch { return; /* depo hâlâ dolu: sonraki gizlenmede */ }
  }
}
function sesIndir(blob, meta) {
  const uzanti = uzantiTur(blob.type || meta?.tur);
  const a = h("a", { href: URL.createObjectURL(blob), download: `${meta.ad || "Ses kaydı"}.${uzanti}` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const kayitDisari = (m) => ({ ...m });

export function aktifKayit() {
  return S.kayit ? { id: S.kayit.id, baslangic: S.kayit.baslangic } : null;
}
export function sesZamani() {
  return S.kayit ? { kayitId: S.kayit.id, ms: Math.round(performance.now() - S.kayit.t0) } : null;
}

export async function kayitlar(belgeId) {
  const b = belgeBul(belgeId);
  return (b?.veri?.sesler || []).map(kayitDisari);
}

// Sekme gizlenince o ana kadarki ses yazılır: tarayıcı sekmeyi öldürse de kayıt kaybolmaz
async function araKayit() {
  const K = S.kayit;
  if (!K || !K.parcalar.length) return;
  try { K.rec.requestData(); } catch { /* yok */ }
  K.meta.sure = Math.round(performance.now() - K.t0);
  const blob = new Blob(K.parcalar, { type: K.tur });
  K.meta.boyut = blob.size;
  degisti(K.belgeId);
  try { await sesYaz(K.belgeId, metaDosyasi(K.meta), blob); } catch { /* sonraki denemede */ }
}
// Kayıt sürerken dakikada bir de yazılır: sekme çökerse ya da pil biterse ders sesi gitmesin.
// Kalem yazarken beklenir, tarayıcı boş bir an bulunca yazılır.
const ARA_KAYIT_MS = 60000;
setInterval(() => {
  const K = S.kayit;
  if (!K || performance.now() - (K.sonAra || K.t0) < ARA_KAYIT_MS - 1000) return;
  const dene = () => {
    if (S.kayit !== K) return;
    if (document.body.classList.contains("yaziyor")) return setTimeout(dene, 2000);
    K.sonAra = performance.now();
    araKayit();
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(dene, { timeout: 5000 }); else dene();
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { araKayit(); yazilamayanlariDene(); return; }
  // Geri gelince ekran kilidi yeniden istenir
  if (S.kayit && (!S.kayit.kilit || S.kayit.kilit.released)) navigator.wakeLock?.request("screen").then((k) => { if (S.kayit) S.kayit.kilit = k; }, () => {});
});
addEventListener("pagehide", () => { araKayit(); });

/* ---------- oynatma ---------- */
const ses = new Audio();
ses.preload = "auto";
let sesUrl = null, sesKayitId = null, zamanAraligi = 0, sureAraniyor = false;

function zamanYay() {
  if (!S.oynat) return;
  bus.emit("ses:zaman", { belgeId: S.oynat.belgeId, kayitId: S.oynat.kayitId, ms: Math.round(ses.currentTime * 1000) });
}
function zamanlayiciKur(acik) {
  clearInterval(zamanAraligi);
  zamanAraligi = 0;
  if (acik) zamanAraligi = setInterval(() => { zamanYay(); for (const fn of izleyiciler) fn.tik?.(); }, 100);
}
// MediaRecorder WebM dosyasında süre yazmaz (Infinity): sona atlayıp süreyi tarayıcıya buldurur
async function sureyiBul() {
  if (Number.isFinite(ses.duration)) return;
  sureAraniyor = true;
  await new Promise((tamam) => {
    const bitti = () => { sureAraniyor = false; ses.removeEventListener("durationchange", bak); clearTimeout(z); tamam(); };
    const bak = () => { if (Number.isFinite(ses.duration)) bitti(); };
    const z = setTimeout(bitti, 3000);
    ses.addEventListener("durationchange", bak);
    try { ses.currentTime = 1e7; } catch { bitti(); }
  });
}
async function yukle(meta) {
  if (sesKayitId === meta.id && sesUrl) return true;
  const blob = await sesGetir(meta.belgeId, metaDosyasi(meta));
  if (!blob) return false;
  if (sesUrl) URL.revokeObjectURL(sesUrl);
  sesUrl = URL.createObjectURL(blob);
  sesKayitId = meta.id;
  ses.src = sesUrl;
  await new Promise((tamam) => {
    const t = () => { ses.removeEventListener("loadedmetadata", t); ses.removeEventListener("error", t); tamam(); };
    ses.addEventListener("loadedmetadata", t); ses.addEventListener("error", t);
  });
  await sureyiBul();
  return true;
}

export async function oynat(kayitId, ms = 0) {
  if (S.kayit) { toast("Kayıt sürerken oynatılamaz."); return; }
  const meta = metaBul(kayitId);
  if (!meta) return;
  const yuklendi = await yukle(meta);
  if (!yuklendi) { toast("Bu kaydın sesi bulunamadı."); return; }
  const sure = Number.isFinite(ses.duration) ? ses.duration * 1000 : meta.sure;
  S.oynat = { kayitId, belgeId: meta.belgeId, sure: Math.max(sure, meta.sure || 0) };
  ses.playbackRate = S.hiz;
  ses.currentTime = Math.max(0, Math.min(ms, S.oynat.sure - 50)) / 1000;
  try { await ses.play(); } catch (e) { console.warn("[ses] oynatılamadı:", e); }
  zamanlayiciKur(true);
  zamanYay();
  haber();
  durumYay();
}
function duraklat() {
  ses.pause();
  zamanlayiciKur(false);
  zamanYay();
  haber();
}
function devam() {
  if (!S.oynat) return;
  if (ses.ended || ses.currentTime * 1000 >= S.oynat.sure - 50) ses.currentTime = 0;
  ses.play().catch(() => {});
  zamanlayiciKur(true);
  haber();
}
function atla(ms) {
  if (!S.oynat) return;
  ses.currentTime = Math.max(0, Math.min(ms, S.oynat.sure)) / 1000;
  zamanYay();
  for (const fn of izleyiciler) fn.tik?.();
}
export function durdur() {
  if (!S.oynat) return;
  const { belgeId, kayitId } = S.oynat;
  ses.pause();
  S.oynat = null;
  zamanlayiciKur(false);
  bus.emit("ses:zaman", { belgeId, kayitId, ms: null });
  haber();
  durumYay();
}
ses.addEventListener("ended", () => {
  if (!S.oynat || sureAraniyor) return;
  zamanlayiciKur(false);
  const { belgeId, kayitId } = S.oynat;
  bus.emit("ses:zaman", { belgeId, kayitId, ms: null });
  haber();
});
// Düğme simgesi her zaman gerçek duruma uyar (sistem duraklatsa da)
ses.addEventListener("play", () => { if (S.oynat) haber(); });
ses.addEventListener("pause", () => { if (S.oynat && !sureAraniyor) haber(); });
function hizSec(v) {
  S.hiz = v;
  ses.playbackRate = v;
  try { localStorage.setItem("kn-tasarim:ses-hiz", String(v)); } catch { /* yok */ }
  haber();
}

// Masa'da bir çizgiye dokununca o ana atlanır
bus.on("ses:atla", (o) => {
  if (!o?.kayitId) return;
  if (S.oynat?.kayitId === o.kayitId) { atla(o.ms || 0); if (ses.paused) devam(); return; }
  oynat(o.kayitId, o.ms || 0);
});
// Başka belgeye ya da kitaplığa gidilince kayıt kaydedilip durur
bus.on("git", (o) => {
  if (S.kayit && (o?.ekran !== "belge" || o.belgeId !== S.kayit.belgeId)) kayitDurdur();
  if (S.oynat && (o?.ekran !== "belge" || o.belgeId !== S.oynat.belgeId)) durdur();
});

export async function kayitSil(kayitId) {
  if (S.kayit?.id === kayitId) await kayitDurdur();
  if (S.oynat?.kayitId === kayitId) durdur();
  const meta = metaBul(kayitId);
  if (!meta) return;
  const liste = sesler(belgeBul(meta.belgeId));
  const i = liste.findIndex((k) => k.id === kayitId);
  if (i >= 0) liste.splice(i, 1);
  if (sesKayitId === kayitId) { ses.removeAttribute("src"); if (sesUrl) URL.revokeObjectURL(sesUrl); sesUrl = sesKayitId = null; }
  try { await sesSilDosya(meta.belgeId, metaDosyasi(meta)); } catch (e) { console.warn("[ses] dosya silinemedi:", e); }
  degisti(meta.belgeId);
  haber();
}
function yenidenAdlandir(kayitId, ad) {
  const meta = metaBul(kayitId);
  ad = ad.trim().slice(0, 80);
  if (!meta || !ad || ad === meta.ad) return;
  meta.ad = ad;
  degisti(meta.belgeId);
  haber();
}
// Yarım kalmış meta: sesi hiç yazılamadıysa listeden düşer, yazıldıysa kayıt olarak kalır
async function yarimlariToparla(belge) {
  const liste = sesler(belge);
  let degisen = false;
  for (const k of [...liste]) {
    // Diske yazılamamış kayıt yalnız bellekte: yarım kalır (kapanınca listeden düşer)
    if (!k.yarim || S.kayit?.id === k.id || yazilamayan.has(k.id)) continue;
    const blob = await sesGetir(belge.id, metaDosyasi(k)).catch(() => null);
    if (blob) { delete k.yarim; k.boyut = blob.size; }
    else liste.splice(liste.indexOf(k), 1);
    degisen = true;
  }
  if (degisen) { degisti(belge.id); haber(); }
}

/* ---------- biçim ---------- */
function sureYaz(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const sa = Math.floor(s / 3600), dk = Math.floor((s % 3600) / 60), sn = s % 60;
  const iki = (n) => String(n).padStart(2, "0");
  return sa ? `${sa}:${iki(dk)}:${iki(sn)}` : `${iki(dk)}:${iki(sn)}`;
}
const tarihYaz = (t) => new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hizYaz = (v) => String(v).replace(".", ",") + "x";
const HIZLAR = [1, 1.5, 2];

// Küçük çizimler: sprite'ta karşılığı olmayabilir, burada çizilir
function sekil(ad) {
  const yol = {
    kaydet: '<circle cx="12" cy="12" r="6"/>',
    durdur: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    oynat: '<path d="M8.5 6.5v11l9-5.5z"/>',
    duraklat: '<rect x="7" y="6.5" width="3.5" height="11" rx="1"/><rect x="13.5" y="6.5" width="3.5" height="11" rx="1"/>',
    ses: '<rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  }[ad];
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "i ses-sekil");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("fill", "currentColor");
  s.innerHTML = yol;
  return s;
}

// Yuvarlanan sayaç (TASARIM-2 .sayac): metin değişince haneler yeniden dizilir, rakam değişince yalnız --n
function sayacKur() {
  const el = h("span", { class: "cam sayac ses-sayac", "aria-hidden": "true" });
  let onceki = "";
  el.yaz = (metin) => {
    if (metin === onceki) return;
    if (metin.length !== onceki.length || metin.replace(/\d/g, "0") !== onceki.replace(/\d/g, "0")) {
      el.replaceChildren(...[...metin].map((c) => {
        if (!/\d/.test(c)) return h("span", { class: "ayrac" }, c);
        const i = h("i", {}, "0123456789");
        i.style.setProperty("--n", c);   // özel değişken style nesnesine atanamaz
        return h("span", { class: "hane" }, i);
      }));
    } else {
      [...metin].forEach((c, i) => { if (c !== onceki[i]) el.children[i].firstChild.style.setProperty("--n", c); });
    }
    onceki = metin;
  };
  return el;
}

/* ---------- şerit ---------- */
export function cubukKur(kap, belge) {
  const ust = kap.matches?.(".ust-cubuk") ? kap : kap.querySelector?.(":scope > .ust-cubuk");
  const ev = ust?.parentElement || kap;
  let listeAcik = false, adlandirilan = null, kaldirildi = false, izZaman = 0, izinDurumu = null;

  const serit = h("div", { class: "ses-serit", role: "region", "aria-label": "Ses kaydı" });
  const canli = h("span", { class: "ses-canli", "aria-live": "polite" });
  const liste = h("div", { class: "ses-liste fis", role: "dialog", "aria-label": "Kayıtlar", hidden: true });
  ev.classList.add("ses-serit-acik");
  ev.append(serit, liste);
  // Şeridin gerçek yüksekliği kökte --ses-serit'te durur (Masa'da araç çubuğu ve sayfa buna göre aşağı iner); kapanınca 0
  const kokStil = document.documentElement.style;
  const yukseklikYaz = () => { if (!kaldirildi) kokStil.setProperty("--ses-serit", `${Math.round(serit.getBoundingClientRect().height) || 48}px`); };
  const boyGozlem = new ResizeObserver(yukseklikYaz);
  boyGozlem.observe(serit);
  yukseklikYaz();

  // Kalıcı parçalar (yeniden kurulumda korunur, sayaç ve iz kayıt boyunca aynı öğe)
  const sayac = sayacKur();
  const izYol = document.createElementNS("http://www.w3.org/2000/svg", "path");
  izYol.setAttribute("class", "iz-cizgi");
  const izSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  izSvg.setAttribute("viewBox", "0 0 64 16");
  izSvg.setAttribute("preserveAspectRatio", "none");
  izSvg.append(izYol);
  const izKap = h("span", { class: "cam ses-iz", "aria-hidden": "true" }, izSvg);
  // Boştayken de ölçü aleti görünür: sönük düz iz ve 00:00 (iz yalnız kayıtta akar)
  const bostaCam = h("span", { class: "cam ses-bosta", "aria-hidden": "true" });
  bostaCam.innerHTML = '<svg viewBox="0 0 64 16" preserveAspectRatio="none"><path d="M0 8L64 8"/></svg><span>00:00</span>';
  const tampon = new Uint8Array(256);

  const listeDugme = () => {
    const n = sesler(belge).filter((k) => !k.yarim).length;
    return h("button", { class: "ses-dugme ses-liste-dugme", type: "button", "aria-expanded": String(listeAcik), "aria-label": `Kayıtlar, ${n} kayıt`, onclick: () => listeDegistir() },
      icon("liste"), h("span", { class: "t-deger-k" }, String(n)));
  };

  // Dalga izi: kalem yazarken seyrek, sekme gizliyken hiç
  function izCiz() {
    clearTimeout(izZaman);
    const K = S.kayit;
    if (!K || kaldirildi || K.belgeId !== belge.id) return;
    const yaziyor = document.body.classList.contains("yaziyor");
    if (!document.hidden) {
      sayac.yaz(sureYaz(performance.now() - K.t0));
      if (K.analiz && !hareketAz()) {
        K.analiz.getByteTimeDomainData(tampon);
        const adim = tampon.length / 64;
        let d = "";
        for (let i = 0; i <= 64; i++) {
          const v = (tampon[Math.min(tampon.length - 1, Math.floor(i * adim))] - 128) / 128;
          const y = 8 - 7 * Math.tanh(v * 5);   // yumuşak kırpma: sessizlik düz, bağırış taşmaz
          d += (i ? "L" : "M") + i + " " + y.toFixed(1);
        }
        izYol.setAttribute("d", d);
      } else izYol.setAttribute("d", "M0 8L64 8");
    }
    izZaman = setTimeout(izCiz, yaziyor ? 250 : 66);
  }

  // Oynatma ilerlemesi: cetvel ve sayaç (10 Hz)
  let cetvel = null, zamanCam = null, suruklen = false;
  function tik() {
    if (!S.oynat || !cetvel || suruklen) return;
    const ms = ses.currentTime * 1000;
    cetvel.style.setProperty("--p", Math.min(1, ms / (S.oynat.sure || 1)).toFixed(4));
    zamanCam.yaz(sureYaz(ms));
  }

  function cetvelKur() {
    const etiket = h("span", { class: "cam cam-k ses-cetvel-etiket" });
    const el = h("div", { class: "ses-cetvel", role: "slider", tabindex: "0", "aria-label": "Kayıt konumu", "aria-valuemin": "0", "aria-valuemax": "100" },
      h("span", { class: "ses-cetvel-dolu" }), h("span", { class: "ses-cetvel-iz" }, h("span", { class: "ses-cetvel-imlec" }), etiket));
    const oran = (e) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    const goster = (p) => { el.style.setProperty("--p", p.toFixed(4)); etiket.textContent = sureYaz(p * S.oynat.sure); };
    el.addEventListener("pointerdown", (e) => {
      if (!S.oynat) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* işaretçi bu arada kalktı */ }
      suruklen = true;
      el.classList.add("suruklen");
      goster(oran(e));
    });
    el.addEventListener("pointermove", (e) => { if (suruklen) goster(oran(e)); });
    const birak = (e) => {
      if (!suruklen) return;
      suruklen = false;
      el.classList.remove("suruklen");
      atla(oran(e) * S.oynat.sure);
    };
    el.addEventListener("pointerup", birak);
    el.addEventListener("pointercancel", () => { suruklen = false; el.classList.remove("suruklen"); });
    el.addEventListener("keydown", (e) => {
      if (!S.oynat) return;
      const adim = e.key === "ArrowRight" ? 5000 : e.key === "ArrowLeft" ? -5000 : 0;
      if (adim) { e.preventDefault(); atla(ses.currentTime * 1000 + adim); }
    });
    return el;
  }

  function kur() {
    if (kaldirildi) return;
    clearTimeout(izZaman);
    cetvel = zamanCam = null;
    const K = S.kayit?.belgeId === belge.id ? S.kayit : null;
    const O = S.oynat?.belgeId === belge.id ? S.oynat : null;
    const baskaKayit = S.kayit && !K;
    serit.dataset.durum = K ? "kayit" : O ? "oynat" : S.hata ? "hata" : "bos";
    let parcalar;
    if (K) {
      sayac.yaz(sureYaz(performance.now() - K.t0));
      parcalar = [
        h("button", { class: "ses-dugme ses-ana durdur", type: "button", "aria-label": "Durdur", onclick: () => kayitDurdur() }, sekil("durdur"), h("span", {}, "Durdur")),
        h("span", { class: "ses-gosterge" }, h("span", { class: "lamba", "data-durum": "kayit" }), h("span", { class: "t-daktilo" }, "Kayıt"), sayac),
        izKap,
        h("span", { class: "ses-ad" }, K.meta.ad),
        listeDugme(),
      ];
      izCiz();
    } else if (O) {
      const meta = metaBul(O.kayitId);
      zamanCam = sayacKur();
      cetvel = cetvelKur();
      const calar = !ses.paused && !ses.ended;
      parcalar = [
        h("button", { class: "ses-dugme ses-ana", type: "button", "aria-label": calar ? "Duraklat" : "Oynat", onclick: () => (ses.paused || ses.ended ? devam() : duraklat()) }, sekil(calar ? "duraklat" : "oynat")),
        zamanCam,
        cetvel,
        h("span", { class: "cam cam-k soluk ses-toplam" }, sureYaz(O.sure)),
        h("button", { class: "ses-dugme ses-hiz t-deger-k", type: "button", "aria-label": `Hız ${hizYaz(S.hiz)}`,
          onclick: () => hizSec(HIZLAR[(HIZLAR.indexOf(S.hiz) + 1) % HIZLAR.length]) }, hizYaz(S.hiz)),
        h("span", { class: "ses-ad" }, meta?.ad || ""),
        listeDugme(),
        h("button", { class: "ikon-dugme", type: "button", "aria-label": "Oynatmayı bitir", onclick: () => durdur() }, sekil("durdur")),
      ];
      tik();
    } else {
      let not;
      if (S.hata) not = h("span", { class: "ses-not hata" }, h("span", { class: "lamba", "data-durum": "hata" }), h("span", {}, S.hata.metin));
      else if (baskaKayit) not = h("span", { class: "ses-not" }, "Başka bir belgede kayıt sürüyor.");
      else if (izinDurumu === "denied") not = h("span", { class: "ses-not hata" }, h("span", { class: "lamba", "data-durum": "hata" }), h("span", {}, hataOlustur("izin").message));
      else if (!window.isSecureContext) not = h("span", { class: "ses-not hata" }, h("span", { class: "lamba", "data-durum": "hata" }), h("span", {}, hataOlustur("guvensiz").message));
      else not = h("span", { class: "ses-not ses-ipucu" }, "Kayıtta yazdıkların sese bağlanır. Çizgiye dokun, o ana dön.");
      parcalar = [
        h("button", { class: "ses-dugme ses-ana kaydet", type: "button", "aria-label": "Kaydet", disabled: !!baskaKayit,
          onclick: () => kayitBaslat(belge).catch((e) => console.warn("[ses]", e.message)) },
          h("span", { class: "ses-kayit-lamba", "aria-hidden": "true" }), h("span", {}, "Kaydet")),
        bostaCam,
        not,
        listeDugme(),
      ];
    }
    canli.textContent = K ? "Kayıt sürüyor" : O ? "Oynatılıyor" : S.hata?.metin || "";
    serit.replaceChildren(...parcalar, canli);
    if (listeAcik) listeKur();
  }
  kur.tik = tik;

  function listeDegistir(acik = !listeAcik) {
    listeAcik = acik;
    liste.hidden = !acik;
    serit.querySelector(".ses-liste-dugme")?.setAttribute("aria-expanded", String(acik));
    if (acik) listeKur();
    else adlandirilan = null;
  }
  function listeKur() {
    const kayitlarim = [...sesler(belge)].sort((a, b) => b.baslangic - a.baslangic);
    const satirlar = kayitlarim.map((k) => {
      const kaydediliyor = S.kayit?.id === k.id;
      const caliyor = S.oynat?.kayitId === k.id;
      let adEl;
      if (adlandirilan === k.id) {
        adEl = h("input", { class: "ses-ad-girdi", type: "text", value: k.ad, maxlength: "80", "aria-label": "Kayıt adı" });
        const bitir = (kaydet) => { if (adlandirilan !== k.id) return; adlandirilan = null; if (kaydet) yenidenAdlandir(k.id, adEl.value); listeKur(); };
        adEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); bitir(true); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); bitir(false); }
        });
        adEl.addEventListener("blur", () => bitir(true));
        queueMicrotask(() => { adEl.focus(); adEl.select(); });
      } else adEl = h("b", {}, k.ad);
      const alt = kaydediliyor ? "Kaydediliyor" : `${tarihYaz(k.baslangic)} · ${sureYaz(k.sure)}${k.yarim ? " · yarım kaldı" : ""}`;
      const sil = h("button", { class: "ikon-dugme ses-sil", type: "button", "aria-label": "Kaydı sil", disabled: kaydediliyor }, icon("sil"));
      ikiDokunus(sil, "Emin misin?", () => kayitSil(k.id));
      return h("li", { class: "ses-satir" + (caliyor ? " caliyor" : "") },
        h("button", { class: "ikon-dugme", type: "button", "aria-label": `${k.ad} oynat`, disabled: kaydediliyor || !!S.kayit,
          onclick: () => { listeDegistir(false); oynat(k.id, 0); } }, sekil(caliyor && !ses.paused ? "duraklat" : "oynat")),
        h("span", { class: "ses-satir-metin" }, adEl, h("small", {}, alt)),
        h("button", { class: "ikon-dugme", type: "button", "aria-label": "Yeniden adlandır", disabled: kaydediliyor,
          onclick: () => { adlandirilan = k.id; listeKur(); } }, icon("kalem-ucu")),
        sil);
    });
    liste.replaceChildren(
      h("div", { class: "fis-baslik ses-liste-baslik" }, h("span", { class: "t-daktilo" }, "Kayıtlar"),
        h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => listeDegistir(false) }, icon("kapat"))),
      satirlar.length ? h("ul", { class: "ses-satirlar" }, satirlar)
        : h("p", { class: "ses-bos" }, "Henüz kayıt yok. Kaydet'e basınca ders sesi bu belgeyle birlikte saklanır."));
  }
  // Dışarı dokununca liste kapanır
  const disari = (e) => { if (listeAcik && !liste.contains(e.target) && !serit.contains(e.target)) listeDegistir(false); };
  document.addEventListener("pointerdown", disari, true);

  // Mikrofon izni önceden reddedildiyse şerit baştan söyler; dinleyici şerit kalkınca bırakılır
  let izin = null;
  navigator.permissions?.query({ name: "microphone" }).then((p) => {
    if (kaldirildi) return;
    izin = p;
    izinDurumu = p.state;
    p.onchange = () => { izinDurumu = p.state; if (p.state !== "denied" && S.hata?.kod === "izin") S.hata = null; kur(); };
    kur();
  }, () => {});

  izleyiciler.add(kur);
  if (S.hata && !S.kayit) S.hata = null;   // eski hata yeni şeritte kalmasın
  kur();
  yarimlariToparla(belge);

  return {
    el: serit,
    baslat: () => kayitBaslat(belge),
    // Belge kapanınca: kayıt durur ve kaydedilir, oynatma biter
    kaldir() {
      if (kaldirildi) return;
      kaldirildi = true;
      clearTimeout(izZaman);
      izleyiciler.delete(kur);
      if (izin) izin.onchange = null;
      document.removeEventListener("pointerdown", disari, true);
      if (S.kayit?.belgeId === belge.id) kayitDurdur();
      if (S.oynat?.belgeId === belge.id) durdur();
      serit.remove();
      liste.remove();
      boyGozlem.disconnect();
      kokStil.removeProperty("--ses-serit");
      ev.classList.remove("ses-serit-acik");
    },
  };
}
