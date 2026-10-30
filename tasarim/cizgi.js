// Kenar Notu: çizgi roman okuyucu (OZELLIKLER-5 bölüm 3, TASARIM-3 9.1 ve nüans 9).
// Ekran modülü sözleşmesi: ac(kap, belge, sayfa, mod, { ara, konum }), git({ sayfa }), kaydet(), kapat().
// Kabuk belge.tur === "cizgi" ya da belge.cizgi için açar. Sayfa numaraları dışarıda 1'den, içeride 0'dan.
//
// Düzen: sahnede en çok üç "yuva" durur (önceki, şimdiki, sonraki yayılım); çevirme yalnız transform ile
// kayar, komşu yuvalar çevirme bittikten sonra boşta hazırlanır. Her yuvada bir "kamera" var: sayfa
// görünümünde sığdırır, Genişlik'te ekran enine büyütür, Panel'de panele yakınlaşır (translate + scale).
// Görsel tuvali gerektiği kadar çözünürlükte çizilir (sayfa css boyu x dpr x yakınlık, en çok 3072 px).
//
// Kalem: S Pen sayfaya doğrudan yazar (araç seçmeden); parmak çevirir ve yakınlaştırır. Yan tuş ya da silgi
// ucu siler. Canlı çizgi ekran boyu tek tuvalde (kalem.js CanliKatman), kalkınca sayfanın kendi mürekkep
// tuvaline geçer. Veri:
//   belge.veri.cizgi = { cizgiler: { "<sayfa sırası>": [kalem.js çizgisi] }, gorunum, renk, konum: { sayfa, panel } }
//     çizgiler sayfa biriminde: genişlik 800, yükseklik 800 / (en / boy); yani oransal
//   belge.veri.izler: İzler sözleşmesi { id, tur, zaman, renk, metin: "", sayfa (1'den), kutu: [x, y, w, h] 0..1,
//     cizgiIdleri, kaynak: "cizgi" }
//   belge.yon: "ltr" | "rtl", belge.sayfa (1'den), belge.ilerleme, belge.sayfaSayisi

import { h, icon, bus, hareketAz, yeniId, yanTusSilgiMi, basincUygula } from "./ortak.js";
import * as ortak from "./ortak.js";   // bosta ve parmakGeriBildirim: kabukta yoksa yerel yedek
import { cizgiAc } from "./cizgi-belge.js";
import { hepsiniCiz, cizgiCiz, CanliKatman, islakBitir, islakAktar, silgi as silgiUygula, cizgilerKutusu } from "./kalem.js";

const PB = 800;               // sayfa birimi genişliği (kalem.js ile aynı)
const ARALIK = 48;            // komşu yuvalar arası boşluk
const KENAR = 16;             // sayfa görünümünde ekran kenarı
const EN_F = 3;               // en çok bu kadar yakınlık için çözünürlük
const GORSEL_SINIR = 3072;    // görsel tuvalinin uzun kenarı
const MUREKKEP_SINIR = 4096;
const CEVIR_MS = 220, PANEL_MS = 380, SAYFA_GOR_MS = 600, SON_MS = 1000;
const AVUC_MS = 600;          // kalemden sonra dokunma yok sayılır
const KALEM_MM = 0.6;
const RENKLER = [["Mürekkep mavisi", "#24407A"], ["Siyah", "#1C1B19"], ["Bordo", "#8C2B38"], ["Kızıl", "#C2502E"], ["Yeşil", "#2F6B4F"]];
const GORUNUMLER = [["sayfa", "Sayfa"], ["genislik", "Genişlik"], ["panel", "Panel"]];
const YONLER = [["ltr", "Soldan sağa"], ["rtl", "Manga"]];
const IPUCU_ANAHTAR = "kn:cizgi-ipucu";
const PANEL_IPUCU = "kn:cizgi-panel-ipucu";
// Dikey telefon (TASARIM-4 2.8): kullanıcı görünüm seçmemişse Panel; yatay telefonda ve genişte Sayfa
const dikeyTelefon = () => matchMedia("(max-width: 599px)").matches;

let S = null;
let acilisNo = 0;

const sinirla = (v, a, b) => (v < a ? a : v > b ? b : v);
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
// Boşta çalıştır: kabuğun ortak.bosta'sı (Safari'de requestIdleCallback yok), yoksa yerel yedek
const bosta = (fn, ms = 400) => (typeof ortak.bosta === "function" ? ortak.bosta(fn, { timeout: ms })
  : typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: ms }) : setTimeout(fn, 40));

// ---------- dışa açık ----------

export async function ac(kap, belge, sayfa, mod, ek = {}) {
  if (S) kapat();
  const no = ++acilisNo;
  const kok = h("div", { class: "cizgi yukleniyor", tabindex: "-1" },
    h("div", { class: "cizgi-bekle", role: "status" }, h("div", { class: "cizgi-bekle-kagit" }), h("p", {}, "Açılıyor")));
  kap.replaceChildren(kok);
  await cssYukle();
  if (no !== acilisNo) return;
  let motor = null;
  try {
    const blob = await kaynakAl(belge);
    if (no !== acilisNo) return;
    if (!blob) throw new Error("Dosyanın kayıtlı kopyası bulunamadı.");
    motor = await cizgiAc(blob);
    if (no !== acilisNo) { motor.kapat(); return; }
  } catch (e) {
    motor?.kapat();
    if (no !== acilisNo) return;
    console.warn("[cizgi] açılamadı:", e);
    hataGoster(kok, e);
    return;
  }
  kur(kap, kok, belge, motor, sayfa, ek);
}

export function git({ sayfa = null, iz = null } = {}) {
  if (!S) return;
  if (sayfa == null && iz) sayfa = S.veri.izler.find((x) => x?.id === iz)?.sayfa ?? null;
  if (sayfa == null) return;
  const i = sinirla((sayfa | 0) - 1, 0, S.n - 1);
  S.akis++;
  yayilimaGec(yayBul(i), { anim: false, panel: "bas" });
}

export function kaydet() {
  if (!S) return;
  islakAktar();
  konumYaz(true);
}

export function kapat() {
  acilisNo++;
  if (!S) return;
  const s = S;
  try { islakAktar(); } catch { /* boş */ }
  try { konumYaz(true); } catch { /* boş */ }
  s.akis++;
  for (const f of s.temizlik) { try { f(); } catch { /* boş */ } }
  for (const z of s.z) clearTimeout(z);
  cancelAnimationFrame(s.raf);
  s.ro?.disconnect();
  s.io?.disconnect();
  for (const y of s.yuvalar.values()) yuvaBirak(y);
  if (s.canliCv) s.canliCv.width = s.canliCv.height = 0;
  for (const t of s.kucukler) { t.cv.width = t.cv.height = 0; }
  delete document.documentElement.dataset.kalem;
  document.body.classList.remove("yaziyor");
  s.geriFis?.remove();
  s.kap.replaceChildren();
  S = null;
  try { s.motor.kapat(); } catch { /* boş */ }
  bus.emit("belgeler", { tur: "sayfa", id: s.belge.id });
}

// ---------- kaynak ve hazırlık ----------

function cssYukle() {
  if (document.querySelector('link[href$="cizgi.css"]')) return Promise.resolve();
  const l = h("link", { rel: "stylesheet", href: new URL("./cizgi.css", import.meta.url).href });
  const yuklendi = new Promise((r) => { l.onload = l.onerror = () => r(); });
  document.head.append(l);
  return Promise.race([yuklendi, bekle(1500)]);
}

async function kaynakAl(belge) {
  const { dosyaGetir, dosyaKaydet } = await import("./kayit.js");
  let blob = await dosyaGetir(belge.id).catch(() => null);
  if (!blob) {
    // Örnek çizgi roman: dosyası silinmiş ya da hiç yazılmamışsa yeniden üretilir
    const ornek = await import("./cizgi-ornek.js");
    if (belge.id === ornek.ORNEK_CIZGI.id) {
      blob = await ornek.ornekCizgiRoman();
      dosyaKaydet(belge.id, blob).catch(() => {});
    }
  }
  return blob;
}

function hataGoster(kok, e) {
  const bilinen = /CBR|Arşiv|görsel|kopyası/.test(e?.message || "");
  kok.classList.remove("yukleniyor");
  kok.replaceChildren(h("div", { class: "cizgi-hata", role: "alert" },
    h("p", { class: "cizgi-hata-baslik" }, "Bu çizgi roman açılamadı."),
    h("p", {}, bilinen ? e.message : "Dosya bozuk ya da desteklenmiyor."),
    h("button", { class: "cizgi-metin-dugme", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, "Kitaplığa dön")));
}

// Belgenin çizgi roman verisi. PDF'te Masa'nın verisi (sayfalar vb.) olduğu gibi kalır.
function veriHazirla(belge) {
  if (!belge.veri || typeof belge.veri !== "object") belge.veri = {};
  const v = belge.veri;
  if (!v.cizgi || typeof v.cizgi !== "object") v.cizgi = {};
  if (!v.cizgi.cizgiler || typeof v.cizgi.cizgiler !== "object") v.cizgi.cizgiler = {};
  if (!Array.isArray(v.izler)) v.izler = [];
  return v;
}

function kur(kap, kok, belge, motor, sayfaArg, ek) {
  const veri = veriHazirla(belge);
  const n = motor.sayfaSayisi;
  const yon = belge.yon === "rtl" || belge.yon === "ltr" ? belge.yon : motor.bilgi.yon === "rtl" ? "rtl" : "ltr";
  motor.bilgi.yon = yon;
  belge.yon = yon;
  belge.sayfaSayisi = n;
  S = {
    kap, kok, belge, motor, n, veri, yon,
    gorunum: GORUNUMLER.some(([g]) => g === veri.cizgi.gorunum) ? veri.cizgi.gorunum : dikeyTelefon() ? "panel" : "sayfa",
    gorunumKayitli: GORUNUMLER.some(([g]) => g === veri.cizgi.gorunum),   // kayıt yoksa varsayılan saklanmaz
    vw: 0, vh: 0, dpr: Math.min(3, devicePixelRatio || 1), yatay: true,
    yay: [], yi: 0, yuvalar: new Map(),
    panel: null, panelSonu: false,
    noktalar: new Map(), jest: null, sonDokunus: null,
    aktif: null, kalemZ: -1e9, kalemVar: false,
    arac: "oku", renk: RENKLER.some(([, r]) => r === veri.cizgi.renk) ? veri.cizgi.renk : RENKLER[0][1],
    gecmis: [], izSon: null,
    z: new Set(), raf: 0, temizlik: [], akis: 0,
    kucukler: [], el: {},
    canli: null, canliCv: null,
    sonYer: -1, degisZ: 0, konumZ: 0, cubukZ: 0,
    kuyruk: Promise.resolve(), sirada: 0, beklemeBitir: null,
  };
  kok.classList.remove("yukleniyor");
  kok.replaceChildren();
  arayuzKur(kok);
  olcuAl();
  yayilimlariKur();
  // İzler listesinden gelindiyse izin sayfası açılır
  const hedefIz = ek?.iz ? veri.izler.find((x) => x?.id === ek.iz) : null;
  if (sayfaArg == null && Number.isFinite(Number(hedefIz?.sayfa))) sayfaArg = Number(hedefIz.sayfa);
  let ilk = sayfaArg != null ? (sayfaArg | 0) - 1 : Number.isInteger(veri.cizgi.konum?.sayfa) ? veri.cizgi.konum.sayfa : (belge.sayfa || 1) - 1;
  ilk = sinirla(ilk, 0, n - 1);
  const panelK = sayfaArg == null && veri.cizgi.konum?.sayfa === ilk ? veri.cizgi.konum.panel : null;
  olaylariKur();
  yayilimaGec(yayBul(ilk), { anim: false, panel: Number.isInteger(panelK) ? panelK : "bas", ilk: true });
  // Ölçüler arkada tamamlanınca çift sayfalar değişmiş olabilir: yayılımlar yeniden kurulur
  Promise.resolve(motor.boyutlarHazir).then(() => { if (S?.motor === motor) duzeniYenile(); }).catch(() => {});
  // Açılışta çubuklar kapalı, sayfa bütün ekranda; ilk dokunuşta gelir (TASARIM-4 2.8)
  cubukGizle();
  if (S.gorunum === "panel") panelIpucu(); else ipucuGoster();
  kok.focus({ preventScroll: true });
}

// ---------- arayüz ----------

function dugme(ad, etiket, onclick, ek = {}) {
  return h("button", { class: "cizgi-dugme", type: "button", "aria-label": etiket, title: etiket, onclick, ...ek }, icon(ad));
}

function anahtar(sinif, secenekler, secili, sec) {
  const kap = h("div", { class: "cizgi-anahtar " + sinif, role: "radiogroup" });
  for (const [id, ad] of secenekler) {
    kap.append(h("button", { type: "button", role: "radio", "aria-checked": String(id === secili), dataset: { id },
      onclick: () => sec(id) }, ad));
  }
  return kap;
}
function anahtarGuncelle(kap, secili) {
  for (const b of kap.querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.id === secili));
}

function arayuzKur(kok) {
  const b = S.motor.bilgi, belge = S.belge;
  const meta = [b.seri && b.seri !== (b.baslik || belge.ad) ? b.seri : "", b.sayi ? "Sayı " + b.sayi : ""].filter(Boolean).join(" · ");
  const el = S.el;
  el.sahne = h("div", { class: "cizgi-sahne" });
  el.perde = h("div", { class: "cizgi-panel-perde", "aria-hidden": "true" },
    ...["ust", "alt", "sol", "sag"].map((k) => h("i", { class: "pp-" + k })));
  el.kare = h("div", { class: "cizgi-kare", "aria-hidden": "true" });
  el.cerceve = h("div", { class: "cizgi-cerceve", "aria-hidden": "true" });   // Panel'de karenin kenarında ince ışık
  el.son = h("div", { class: "cizgi-son", "aria-hidden": "true" }, "Son.");
  el.halka = h("div", { class: "kalem-halka cizgi-halka", "aria-hidden": "true" });
  el.ipucu = h("div", { class: "cizgi-ipucu", "aria-hidden": "true" }, h("i", { class: "ip-sol" }), h("i", { class: "ip-sag" }));
  el.duyuru = h("div", { class: "cizgi-duyuru", "aria-live": "polite" });

  // üst çubuk
  el.renkler = h("div", { class: "cizgi-renkler", role: "radiogroup", "aria-label": "Kalem rengi" },
    ...RENKLER.map(([ad, renk]) => {
      const d = h("button", { type: "button", role: "radio", "aria-label": ad, title: ad, dataset: { renk },
        "aria-checked": String(renk === S.renk), onclick: () => renkSec(renk) });
      d.style.setProperty("--r", renk);
      return d;
    }));
  el.kalem = dugme("kalem-ucu", "Parmakla ya da fareyle çiz", () => aracSec(S.arac === "kalem" ? "oku" : "kalem"), { "aria-pressed": "false" });
  el.silgi = dugme("silgi", "Silgi", () => aracSec(S.arac === "silgi" ? "oku" : "silgi"), { "aria-pressed": "false" });
  el.geriAl = dugme("geri-al", "Geri al", geriAl, { disabled: true });
  el.ust = h("header", { class: "cizgi-ust" },
    dugme("geri", "Kitaplığa dön", () => bus.emit("git", { ekran: "kitaplik" })),
    h("div", { class: "cizgi-baslik" }, h("b", {}, belge.ad || b.baslik || "Çizgi roman"), meta ? h("span", {}, meta) : null),
    h("div", { class: "cizgi-araclar" }, el.renkler, h("span", { class: "cizgi-ayrac" }), el.kalem, el.silgi, el.geriAl));

  // alt çubuk
  el.serit = h("div", { class: "cizgi-serit", role: "list", "aria-label": "Sayfalar", dir: S.yon === "rtl" ? "rtl" : "ltr" });
  // Konum: telefonda dokununca küçük resim şeridi açılır (şerit kendiliğinden yer kaplamaz)
  el.konum = h("button", { type: "button", class: "cizgi-konum", "aria-label": "Sayfalar", "aria-expanded": "false",
    onclick: () => { const a = S.kok.classList.toggle("serit-acik"); el.konum.setAttribute("aria-expanded", String(a)); if (a) { seritGuncelle(true); kucukleriIste(); } } });
  el.yon = anahtar("cizgi-yon", YONLER, S.yon, yonSec);
  el.gorunum = anahtar("cizgi-gorunum", GORUNUMLER, S.gorunum, gorunumSec);
  // Telefonda yön anahtarı yer kaplamaz: tek düğme iki yön arasında geçer (yalnız dar ekranda görünür)
  el.yonTel = dugme(S.yon === "rtl" ? "sol" : "sag", "", () => yonSec(S.yon === "rtl" ? "ltr" : "rtl"), { class: "cizgi-dugme cizgi-yon-tel" });
  yonTelGuncelle();
  el.alt = h("footer", { class: "cizgi-alt" },
    el.serit,
    h("div", { class: "cizgi-alt-satir" }, el.konum, h("span", { class: "cizgi-bosluk" }), el.yon, el.yonTel, el.gorunum));

  kok.dataset.gorunum = S.gorunum;
  kok.dataset.yon = S.yon;
  kok.append(el.sahne, el.perde, el.cerceve, el.kare, el.son, el.ipucu, el.halka, el.ust, el.alt, el.duyuru);
  kucukResimleriKur();
}

// ---------- ölçü ve yayılımlar ----------

// Boyut dönüşümsüz ölçülür: kabuk açılış geçişinde kabı ölçekliyor olabilir
function olcuAl() {
  S.vw = Math.max(1, S.kok.clientWidth);
  S.vh = Math.max(1, S.kok.clientHeight);
  kokYeri();
  S.yatay = S.vw > S.vh;
  S.dpr = Math.min(3, devicePixelRatio || 1);
}

const oran = (i) => { const o = S.motor.boyut(i) || { w: 2, h: 3 }; return o.w > 0 && o.h > 0 ? o.w / o.h : 2 / 3; };
const sayfaBoyu = (i) => PB / oran(i);   // sayfa birimi yükseklik

// Yatayda sayfa görünümü: iki sayfa yan yana; kapak, çift sayfalık görsel ve sonda kalan tek.
// Dikeyde, Genişlik'te ve Panel'de hep tek sayfa.
function yayilimlariKur() {
  const { n, motor } = S;
  const iki = S.yatay && S.gorunum === "sayfa";
  const y = [];
  for (let i = 0; i < n;) {
    if (!iki || i === 0 || motor.ciftMi(i) || i + 1 >= n || motor.ciftMi(i + 1)) { y.push([i]); i++; }
    else { y.push([i, i + 1]); i += 2; }
  }
  S.yay = y;
}
const yayBul = (i) => Math.max(0, S.yay.findIndex((y) => y.includes(i)));

// Yayılımın sığdırılmış yerleşimi: sayfalar ekran sırasında (Manga'da sağdan sola)
function yerlesim(yi) {
  const sira = S.yay[yi].map((i) => ({ i, r: oran(i) }));
  const goster = S.yon === "rtl" ? sira.slice().reverse() : sira;
  const toplam = goster.reduce((t, p) => t + p.r, 0);
  const aw = Math.max(40, S.vw - 2 * KENAR), ah = Math.max(40, S.vh - 2 * KENAR);
  const bh = Math.min(ah, aw / toplam), bw = bh * toplam;
  let x = 0;
  for (const p of goster) { p.x = x; p.w = bh * p.r; p.h = bh; x += p.w; }
  return { sayfalar: goster, bw, bh, L: (S.vw - bw) / 2, T: (S.vh - bh) / 2 };
}

// ---------- kamera ----------

function kamSinirla(cam, lay) {
  const cw = lay.bw * cam.s, ch = lay.bh * cam.s;
  const x = cw <= S.vw ? (S.vw - cw) / 2 - lay.L : sinirla(cam.x, S.vw - lay.L - cw, -lay.L);
  const y = ch <= S.vh ? (S.vh - ch) / 2 - lay.T : sinirla(cam.y, S.vh - lay.T - ch, -lay.T);
  return { s: cam.s, x, y };
}
// Dinlenme kamerası: sayfa görünümünde sığdır, Genişlik'te ekran eni (üstten ya da alttan)
function dinlenik(lay, alttan = false) {
  if (S.gorunum === "genislik") {
    const s = Math.max(1, Math.min(EN_F, S.vw / lay.bw));
    return kamSinirla({ s, x: -lay.L, y: alttan ? -1e9 : 1e9 }, lay);
  }
  return { s: 1, x: 0, y: 0 };
}
const dinlenikS = (lay) => dinlenik(lay).s;

// Panelin kamera kutusu (kamera koordinatı) ve ona yakınlaşan kamera
function panelKutusu(y, q) {
  const p = y.lay.sayfalar[0];
  return { x: p.x + q.x * p.w, y: q.y * p.h, w: q.w * p.w, h: q.h * p.h };
}
function kutuyaKamera(lay, r, pay = 20) {
  const s = Math.max(1, Math.min((S.vw - 2 * pay) / r.w, (S.vh - 2 * pay) / r.h, 8));
  return { s, x: S.vw / 2 - lay.L - s * (r.x + r.w / 2), y: S.vh / 2 - lay.T - s * (r.y + r.h / 2) };
}

function kameraUygula(y, cam, ms = 0, egri = "var(--egri-murekkep, cubic-bezier(.62,0,.32,1))") {
  y.cam = cam;
  const st = y.kamera.style;
  st.transition = ms ? `transform ${ms}ms ${egri}` : "none";
  st.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`;
}
async function kameraAnim(y, cam, ms = PANEL_MS) {
  if (hareketAz()) ms = Math.min(ms, 120);
  kameraUygula(y, cam, ms);
  await bekle(ms + 16);
}

// Ekrandaki kutu (kamera koordinatı -> kök koordinatı)
function ekranKutusu(y, r, cam = y.cam) {
  return { x: y.lay.L + cam.x + cam.s * r.x, y: y.lay.T + cam.y + cam.s * r.y, w: cam.s * r.w, h: cam.s * r.h };
}

// ---------- panel perdesi (dört parça, yalnız transform) ----------

function perdeYerlestir(k, ms = 0) {
  const [ust, alt, sol, sag] = S.el.perde.children;
  const { vw, vh } = S, x0 = k.x - 0.5, y0 = k.y - 0.5, x1 = k.x + k.w + 0.5, y1 = k.y + k.h + 0.5;
  const gecis = ms && !hareketAz() ? `transform ${ms}ms var(--egri-murekkep, cubic-bezier(.62,0,.32,1))` : "none";
  const ayarla = (e, t) => { e.style.transition = gecis; e.style.transform = t; };
  ayarla(ust, `translate3d(0, ${y0 - vh}px, 0)`);
  ayarla(alt, `translate3d(0, ${y1}px, 0)`);
  ayarla(sol, `translate3d(${x0 - vw}px, ${y0}px, 0) scaleY(${Math.max(0, y1 - y0) / vh})`);
  ayarla(sag, `translate3d(${x1}px, ${y0}px, 0) scaleY(${Math.max(0, y1 - y0) / vh})`);
}
function perdeAc(k, ms) {
  const acikti = S.el.perde.classList.contains("acik");
  perdeYerlestir(k, acikti ? ms : 0);
  S.el.perde.classList.add("acik");
}
function perdeKapat() { S.el.perde.classList.remove("acik"); S.el.cerceve?.classList.remove("acik"); }

// Nüans 9: yeni kareye varınca kenarında bir an mürekkep çizgisi
function kareCizgisi(k) {
  const e = S.el.kare;
  e.classList.remove("parla");
  Object.assign(e.style, { left: k.x + "px", top: k.y + "px", width: k.w + "px", height: k.h + "px" });
  void e.offsetWidth;
  e.classList.add("parla");
}

// ---------- yuvalar ----------

const ileriIsaret = () => (S.yon === "rtl" ? -1 : 1);

function yuvaKur(yi) {
  const lay = yerlesim(yi);
  const el = h("div", { class: "cizgi-yuva" });
  const kamera = h("div", { class: "cizgi-kamera", style: { left: lay.L + "px", top: lay.T + "px", width: lay.bw + "px", height: lay.bh + "px" } });
  const yayEl = h("div", { class: "cizgi-yayilim" + (lay.sayfalar.length === 1 ? " tek" : "") });
  const sayfalar = lay.sayfalar.map((p) => {
    const sel = h("div", { class: "cizgi-sayfa bekliyor", dataset: { i: p.i },
      style: { left: p.x + "px", width: p.w + "px", height: p.h + "px" } });
    const gorsel = h("canvas", { class: "cizgi-gorsel", width: 1, height: 1 });
    sel.append(gorsel);
    return { ...p, el: sel, gorsel, murekkep: null, f: 0, istek: 0 };
  });
  yayEl.append(...sayfalar.map((p) => p.el));
  kamera.append(yayEl);
  el.append(kamera);
  const y = { yi, el, kamera, lay, sayfalar, cam: { s: 1, x: 0, y: 0 }, olu: false, f: 1, hazir: null };
  S.el.sahne.append(el);
  kameraUygula(y, dinlenik(lay));
  S.yuvalar.set(yi, y);
  return y;
}

function yuvaBirak(y) {
  y.olu = true;
  for (const p of y.sayfalar) {
    p.istek++;
    p.gorsel.width = p.gorsel.height = 0;
    if (p.murekkep) p.murekkep.width = p.murekkep.height = 0;
  }
  y.el.remove();
}

function yuvaKonumla(y, sira, ms = 0, dx = 0) {
  const x = sira * ileriIsaret() * (S.vw + ARALIK) + dx;
  y.el.style.transition = ms ? `transform ${ms}ms var(--egri-kagit, cubic-bezier(.22,.8,.24,1))` : "none";
  y.el.style.transform = `translate3d(${x}px, 0, 0)`;
  y.sira = sira;
}

// Yuvanın sayfaları gereken çözünürlükte çizilir. Panel görünümünde en yakın panel kadar.
async function yuvaHazirla(y) {
  if (y.olu) return;
  let f = Math.max(1, y.f || 1);
  if (S.gorunum === "genislik") f = Math.max(f, dinlenikS(y.lay));
  if (S.gorunum === "panel") {
    const liste = await panelleriAl(y.sayfalar[0].i).catch(() => null);
    if (!S || y.olu) return;
    if (liste) for (const q of liste) f = Math.max(f, kutuyaKamera(y.lay, panelKutusu(y, q)).s);
  }
  y.f = Math.min(EN_F, f);
  await Promise.all(y.sayfalar.map((p) => sayfaCiz(y, p, y.f)));
}

async function sayfaCiz(y, p, f) {
  const uzun = Math.max(p.w, p.h);
  let hedef = Math.min(GORSEL_SINIR, Math.round(uzun * S.dpr * f));
  // Doğal boy hedefe yakınsa küçültülmeden çözülür: küçültmeli çözme ana iş parçacığını tutuyor
  const o = S.motor.boyut(p.i), dogal = o ? Math.max(o.w, o.h) : 0;
  if (dogal > hedef && dogal <= Math.min(GORSEL_SINIR, hedef * 1.4)) hedef = dogal;
  if (p.gorsel.width > 1 && p.hedef >= hedef) { murekkepCiz(p, f); return; }
  const no = ++p.istek;
  let bmp;
  for (let deneme = 0; deneme < 2; deneme++) {
    try { bmp = await S.motor.gorsel(p.i, { enFazla: hedef }); } catch { return; }
    if (!S || y.olu || no !== p.istek) return;
    if (bmp.width) break;   // motor bu arada kovduysa bir kez daha istenir
  }
  if (!bmp?.width) return;
  p.gorsel.width = bmp.width;
  p.gorsel.height = bmp.height;
  p.gorsel.getContext("2d").drawImage(bmp, 0, 0);
  p.hedef = hedef;
  p.f = f;
  p.el.classList.remove("bekliyor");
  p.el.classList.add("hazir");
  murekkepCiz(p, f);
}

// ---------- mürekkep ----------

const cizgilerAl = (i, yarat = false) => {
  const c = S.veri.cizgi.cizgiler;
  if (!Array.isArray(c[i])) { if (!yarat) return []; c[i] = []; }
  return c[i];
};
function murekkepBoyu(p, f) {
  let W = Math.round(p.w * S.dpr * Math.max(1, f));
  let H = Math.round(W * p.h / p.w);
  const k = Math.min(1, MUREKKEP_SINIR / Math.max(W, H));
  return [Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k))];
}
function murekkepCiz(p, f = p.f || 1) {
  const liste = cizgilerAl(p.i);
  if (!liste.length && !p.murekkep) return;
  if (!p.murekkep) { p.murekkep = h("canvas", { class: "cizgi-murekkep" }); p.el.append(p.murekkep); }
  const [W, H] = murekkepBoyu(p, f);
  if (p.murekkep.width !== W) p.murekkep.width = W;
  if (p.murekkep.height !== H) p.murekkep.height = H;
  p.mf = f;
  hepsiniCiz(p.murekkep.getContext("2d"), liste, W / PB);
}
// Sayfa bütün yuvalarda yeniden çizilir (silgi, geri al)
function sayfaMurekkebiniYenile(i) {
  for (const y of S.yuvalar.values()) for (const p of y.sayfalar) if (p.i === i) murekkepCiz(p, p.mf || p.f || 1);
  kucukMurekkep(i);
}
function cizgiyiEkle(i, c) {
  for (const y of S.yuvalar.values()) for (const p of y.sayfalar) {
    if (p.i !== i) continue;
    if (!p.murekkep) { murekkepCiz(p); continue; }
    const ctx = p.murekkep.getContext("2d"), k = p.murekkep.width / PB;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    cizgiCiz(ctx, c);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  kucukMurekkep(i);
}

// ---------- gezinme ----------

function aktifYuva() { return S.yuvalar.get(S.yi); }

async function yayilimaGec(hedef, { anim = true, panel = "bas", alttan = false, ilk = false } = {}) {
  if (!S) return;
  hedef = sinirla(hedef, 0, S.yay.length - 1);
  islakAktar();
  sonGizle();
  const eski = aktifYuva();
  const fark = hedef - S.yi;
  if (eski && fark === 0 && !ilk) return;
  const yonu = Math.sign(fark) || 1;
  let yeni = S.yuvalar.get(hedef);
  if (!yeni) { yeni = yuvaKur(hedef); yuvaKonumla(yeni, eski ? yonu : 0); }
  if (S.gorunum !== "panel" || panel == null) kameraUygula(yeni, dinlenik(yeni.lay, alttan));
  yeni.hazir ||= yuvaHazirla(yeni);
  if (S.gorunum === "panel") perdeKapat();
  if (eski && eski !== yeni && anim && Math.abs(fark) === 1 && !hareketAz()) {
    S.ceviriyor = true;
    yuvaKonumla(yeni, yonu);
    void yeni.el.offsetWidth;
    yuvaKonumla(eski, -yonu, CEVIR_MS);
    yuvaKonumla(yeni, 0, CEVIR_MS);
    await bekle(CEVIR_MS + 20);
    S && (S.ceviriyor = false);
    if (!S) return;
  } else {
    if (eski && eski !== yeni) yuvaKonumla(eski, -yonu);
    yuvaKonumla(yeni, 0);
  }
  S.yi = hedef;
  S.panel = null;
  S.panelSonu = false;
  // Uzak yuvalar bırakılır; komşular boşta hazırlanır (çevirme sırasında ağır iş yok)
  for (const [yi, y] of S.yuvalar) if (Math.abs(yi - hedef) > 1) { yuvaBirak(y); S.yuvalar.delete(yi); }
  for (const [yi, y] of S.yuvalar) if (yi !== hedef) yuvaKonumla(y, Math.sign(yi - hedef));
  zamanla(() => bosta(komsulariHazirla), ilk ? 300 : 80);
  konumYaz();
  seritGuncelle();
  if (S.gorunum === "panel" && panel != null) {
    await yeni.hazir;
    if (!S || S.yi !== hedef) return;
    const liste = await panelleriAl(yeni.sayfalar[0].i);
    if (!S || S.yi !== hedef) return;
    const k = panel === "son" ? liste.length - 1 : panel === "bas" ? 0 : sinirla(panel, 0, liste.length - 1);
    await panelaGit(yeni, liste, k, ilk ? 0 : PANEL_MS);
  }
  sonKontrol();
}

function komsulariHazirla() {
  if (!S || S.ceviriyor || S.aktif || S.jest) { if (S) zamanla(() => bosta(komsulariHazirla), 200); return; }
  const yi = S.yi;
  for (const k of [yi + 1, yi - 1]) {
    if (k < 0 || k >= S.yay.length || S.yuvalar.has(k)) continue;
    const y = yuvaKur(k);
    yuvaKonumla(y, Math.sign(k - yi));
    y.hazir = yuvaHazirla(y);
  }
  // Panel görünümünde sonraki sayfanın panelleri de önceden bulunur
  const sonraki = S.yay[yi + 1];
  if (sonraki) panelleriAl(sonraki[0]).catch(() => {});
}

// adim: +1 okuma yönünde ileri, -1 geri. Adımlar sıraya girer: geçiş sürerken gelen dokunuş kaybolmaz,
// bir sonraki geçiş öncekinin ortasında başlamaz (en çok iki adım bekler).
function ileri(adim) {
  if (!S) return;
  // Sayfa sonu beklemesinde ileri: bekleme kısalır, hemen çevrilir
  if (S.gorunum === "panel" && adim > 0 && S.panelSonu) { S.beklemeBitir?.(); return; }
  if (S.sirada >= 2) return;
  const s = S;
  s.sirada++;
  s.kuyruk = s.kuyruk.then(() => (S === s ? ileriAsil(adim) : null)).catch((e) => console.warn("[cizgi]", e)).finally(() => { s.sirada--; });
  return s.kuyruk;
}
async function ileriAsil(adim) {
  if (S.gorunum === "panel") return panelAdim(adim);
  const y = aktifYuva();
  if (!y) return;
  if (S.gorunum === "genislik") {
    // Sayfa ekrandan uzunsa önce kaydırılır
    const ch = y.lay.bh * y.cam.s, alt = S.vh - y.lay.T - ch, ust = -y.lay.T;
    if (ch > S.vh + 2) {
      if (adim > 0 && y.cam.y > alt + 2) return kameraAnim(y, kamSinirla({ ...y.cam, y: y.cam.y - S.vh * 0.85 }, y.lay), 260);
      if (adim < 0 && y.cam.y < ust - 2) return kameraAnim(y, kamSinirla({ ...y.cam, y: y.cam.y + S.vh * 0.85 }, y.lay), 260);
    }
  }
  const hedef = S.yi + adim;
  if (hedef < 0) return sekme(-1);
  if (hedef >= S.yay.length) { sekme(1); sonGoster(0); return; }
  S.akis++;
  await yayilimaGec(hedef, { alttan: adim < 0 });
}

// Sonda ya da başta: yayılım hafifçe esner, yerine döner
async function sekme(adim) {
  const y = aktifYuva();
  if (!y || hareketAz()) return;
  yuvaKonumla(y, 0, 120, -adim * ileriIsaret() * 18);
  await bekle(130);
  if (S && aktifYuva() === y) yuvaKonumla(y, 0, 200);
}

// ---------- panel görünümü ----------

// Kapak bütün sayfa: kapakta kare yok, algılama kapağın şeridini kare sanıyordu (ilk kare yarım ve karanlık)
function panelleriAl(i) {
  if (i === 0) return Promise.resolve([{ x: 0, y: 0, w: 1, h: 1 }]);
  return S.motor.paneller(i, { yon: S.yon }).then((l) => (l && l.length ? l : [{ x: 0, y: 0, w: 1, h: 1 }]));
}

async function panelaGit(y, liste, k, ms = PANEL_MS) {
  const r = panelKutusu(y, liste[k]);
  const cam = kutuyaKamera(y.lay, r);
  S.panel = { i: y.sayfalar[0].i, liste, k };
  S.panelSonu = false;
  konumYaz(true);
  S.el.cerceve.classList.remove("acik");
  perdeAc(ekranKutusu(y, r, cam), ms);
  if (ms) await kameraAnim(y, cam, ms); else kameraUygula(y, cam);
  if (!S || aktifYuva() !== y || S.panel?.k !== k) return;
  const kutu = ekranKutusu(y, r, cam);
  kareCizgisi(kutu);
  // Kare yüzmesin, çerçevelensin: kenarında 0,5 px ışık (tam sayfa karede yok)
  if (liste.length > 1 || liste[k].w < 0.98 || liste[k].h < 0.98) {
    Object.assign(S.el.cerceve.style, { left: kutu.x + "px", top: kutu.y + "px", width: kutu.w + "px", height: kutu.h + "px" });
    S.el.cerceve.classList.add("acik");
  }
  duyur(`Sayfa ${y.sayfalar[0].i + 1}, kare ${k + 1} / ${liste.length}`);
  // Çözünürlük yetmiyorsa (yuva panellerden önce hazırlandıysa) yükseltilir
  if (cam.s > y.f * 1.15 && y.f < EN_F) { y.f = Math.min(EN_F, cam.s); bosta(() => y.olu || y.sayfalar.forEach((p) => sayfaCiz(y, p, y.f))); }
}

async function panelAdim(adim) {
  const no = ++S.akis;
  const y = aktifYuva();
  if (!y) return;
  const i = y.sayfalar[0].i;
  const liste = await panelleriAl(i);
  if (!S || no !== S.akis || aktifYuva() !== y) return;
  let k = S.panel?.i === i ? S.panel.k : adim > 0 ? -1 : liste.length;
  k += adim;
  if (k >= 0 && k < liste.length) return panelaGit(y, liste, k);
  if (adim < 0) {
    if (S.yi === 0) return tumSayfa(y);
    return yayilimaGec(S.yi - 1, { panel: "son" });
  }
  // Tek karelik sayfa (kapak) zaten bütün görünüyor: bekleme yok, doğrudan sonraki sayfa
  if (liste.length === 1 && liste[0].w >= 0.98 && liste[0].h >= 0.98 && S.yi < S.yay.length - 1) return yayilimaGec(S.yi + 1, { panel: "bas" });
  // Sayfa sonu: bütün sayfa bir an görünür, sonra çevrilir
  await tumSayfa(y);
  if (!S || no !== S.akis) return;
  if (S.yi >= S.yay.length - 1) { sonGoster(0); return; }
  S.panelSonu = true;
  S.panel = { i, liste, k: liste.length };
  await new Promise((r) => { S.beklemeBitir = r; zamanla(r, hareketAz() ? 200 : SAYFA_GOR_MS); });
  if (!S) return;
  S.beklemeBitir = null;
  if (no !== S.akis || !S.panelSonu) return;
  S.panelSonu = false;
  await yayilimaGec(S.yi + 1, { panel: "bas" });
}

async function tumSayfa(y) {
  perdeKapat();
  S.el.kare.classList.remove("parla");
  await kameraAnim(y, { s: 1, x: 0, y: 0 }, PANEL_MS);
}

// ---------- son ----------

function sonKontrol() {
  if (S.yi === S.yay.length - 1 && S.gorunum !== "panel") sonGoster(SON_MS);
}
function sonGoster(gecikme = SON_MS) {
  const y = aktifYuva();
  if (!y) return;
  clearTimeout(S.sonZ);
  S.sonZ = zamanla(() => {
    if (!S || aktifYuva() !== y || S.yi !== S.yay.length - 1) return;
    const son = S.el.son, p = y.lay.sayfalar[y.lay.sayfalar.length - 1];
    const sayfaKutusu = ekranKutusu(y, { x: p.x, y: 0, w: p.w, h: p.h });
    const asagi = S.vh - (sayfaKutusu.y + sayfaKutusu.h);
    son.classList.toggle("icerde", asagi < 44);
    const sag = Math.max(16, S.vw - (sayfaKutusu.x + sayfaKutusu.w));
    son.style.right = (asagi < 44 ? sag + 12 : sag) + "px";
    son.style.top = (asagi < 44 ? sayfaKutusu.y + sayfaKutusu.h - 52 : sayfaKutusu.y + sayfaKutusu.h + 4) + "px";
    son.classList.add("gorunur");
  }, gecikme);
}
function sonGizle() { clearTimeout(S?.sonZ); S?.el.son.classList.remove("gorunur"); }

// ---------- dokunma, kaydırma, yakınlaştırma ----------

function olaylariKur() {
  const k = S.kok;
  const on = (hedef, ad, fn, sec) => { hedef.addEventListener(ad, fn, sec); S.temizlik.push(() => hedef.removeEventListener(ad, fn, sec)); };
  on(k, "pointerdown", isaretciBasti);
  on(k, "pointermove", isaretciOynadi);
  on(k, "pointerup", isaretciKalkti);
  on(k, "pointercancel", isaretciKalkti);
  on(k, "pointerleave", (e) => { if (e.pointerType === "pen") halkaGizle(); });
  on(k, "contextmenu", (e) => e.preventDefault());
  on(k, "wheel", tekerlek, { passive: false });
  on(k, "keydown", tus);
  on(k, "dblclick", (e) => e.preventDefault());
  // Çubuklara dokunmak onları açık tutar
  for (const c of [S.el.ust, S.el.alt]) on(c, "pointerdown", () => cubukGoster(true));
  S.ro = new ResizeObserver(() => {
    clearTimeout(S.boyZ);
    S.boyZ = zamanla(() => {
      if (!S) return;
      const eskiW = S.vw, eskiH = S.vh;
      olcuAl();
      if (Math.abs(eskiW - S.vw) > 1 || Math.abs(eskiH - S.vh) > 1) duzeniYenile();
    }, 140);
  });
  S.ro.observe(k);
}

// Ekran boyu, yön ya da görünüm değişince: aynı sayfada (ve panelde) kalınır
function duzeniYenile() {
  if (!S) return;
  islakAktar();
  const y = aktifYuva();
  const i = S.panel?.i ?? (y ? Math.min(...y.sayfalar.map((p) => p.i)) : 0);
  const k = S.panel && S.panel.k < S.panel.liste.length ? S.panel.k : null;
  const eskiYay = JSON.stringify(S.yay);
  olcuAl();
  yayilimlariKur();
  if (y && JSON.stringify(S.yay) === eskiYay && y.lay.bw === yerlesim(S.yi).bw && y.lay.T === yerlesim(S.yi).T) return;
  for (const yy of S.yuvalar.values()) yuvaBirak(yy);
  S.yuvalar.clear();
  perdeKapat();
  S.akis++;
  S.yi = -1;
  yayilimaGec(yayBul(i), { anim: false, panel: k ?? "bas", ilk: true });
}

function sayfaBul(x, y) {
  const yv = aktifYuva();
  if (!yv) return null;
  for (const p of yv.sayfalar) {
    const r = p.el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { y: yv, p, r };
  }
  return null;
}
// Silgi ucu her zaman siler; yan tuş Ayarlar'daki "Yan tuş silgi" açıksa
const silgiTusu = (e) => e.pointerType === "pen" && (!!(e.buttons & 32) || (!!(e.buttons & 2) && yanTusSilgiMi()));
const kokX = (e) => e.clientX - S.ox, kokY = (e) => e.clientY - S.oy;
function kokYeri() { const r = S.kok.getBoundingClientRect(); S.ox = r.left; S.oy = r.top; }

function isaretciBasti(e) {
  if (!S || e.target.closest?.(".cizgi-ust, .cizgi-alt")) return;
  if (!S.noktalar.size) kokYeri();
  const simdi = performance.now();
  if (e.pointerType === "pen") { S.kalemZ = simdi; S.kalemVar = true; }
  if (e.pointerType === "touch" && (simdi - S.kalemZ < AVUC_MS || S.aktif?.tur === "pen")) return;   // avuç içi
  if (e.pointerType === "mouse" && e.button !== 0) return;
  // Parmakla yazarken ikinci parmak hemen gelirse az önce başlayan çizgi iptal: iki parmak jestine (geri al, kıstır) döner
  const a = S.aktif;
  if (a && e.pointerType === "touch" && a.tur === "touch" && simdi - a.t0 < 260 && !a.silinen.length) {
    S.canli.temizle();
    S.aktif = null;
    S.kok.classList.remove("yaziyor");
    delete document.documentElement.dataset.kalem;
    S.noktalar.set(a.id, { x: a.x0, y: a.y0 });
  }
  if (S.aktif) return;   // çizim sırasında yalnız ilk işaretçi
  // Kalem her zaman yazar; parmak ve fare yalnız kalem ya da silgi seçiliyse (kalem algılanmadıysa parmak da)
  const yazar = e.pointerType === "pen" || (S.arac !== "oku" && S.noktalar.size === 0 && !(e.pointerType === "touch" && S.kalemVar));
  if (yazar) {
    if (e.pointerType === "pen") jestIptal();
    const hit = sayfaBul(e.clientX, e.clientY);
    if (hit) { e.preventDefault(); kalemBasla(e, hit); return; }
    if (e.pointerType === "pen" && S.arac !== "oku") return;
  }
  try { S.kok.setPointerCapture(e.pointerId); } catch { /* boş */ }
  S.noktalar.set(e.pointerId, { x: kokX(e), y: kokY(e) });
  const y = aktifYuva();
  if (!y) return;
  islakAktar();
  if (S.noktalar.size === 1) {
    S.jest = { tur: "bekle", id: e.pointerId, x0: kokX(e), y0: kokY(e), t0: simdi, cam0: { ...y.cam }, son: [], dx: 0 };
  } else if (S.noktalar.size === 2) {
    if (S.jest?.tur === "cevir") suruklemeBirak(S.jest, false);
    jestBasladi();
    const [a, b] = [...S.noktalar.values()];
    S.jest = { tur: "kistir", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam0: { ...y.cam },
      t0: simdi, ilk: [[a.x + S.ox, a.y + S.oy], [b.x + S.ox, b.y + S.oy]] };
    sonDokunusIptal();
    perdeKapat();
    S.el.kare.classList.remove("parla");
  }
}

// Kalem inince süren parmak hareketi biter: sayfa yerinde durur, çizimin dönüşümü kaymaz
function jestIptal() {
  if (!S.noktalar.size && !S.jest) return;
  const j = S.jest;
  for (const id of S.noktalar.keys()) { try { S.kok.releasePointerCapture(id); } catch { /* boş */ } }
  S.noktalar.clear();
  S.jest = null;
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
  const b = S.bekleyenKam;
  S.bekleyenKam = null;
  if (b && !b.y.olu) kameraUygula(b.y, b.cam);
  if (j?.tur === "cevir") for (const [yi, y] of S.yuvalar) yuvaKonumla(y, Math.sign(yi - S.yi), 0);
}

function isaretciOynadi(e) {
  if (!S) return;
  if (e.pointerType === "pen") {
    S.kalemZ = performance.now();
    if (!e.buttons) halkaGoster(e); else if (!S.aktif) halkaGizle();
  }
  if (S.aktif && e.pointerId === S.aktif.id) return kalemOynat(e);
  const nk = S.noktalar.get(e.pointerId);
  if (!nk) return;
  nk.x = kokX(e); nk.y = kokY(e);
  const j = S.jest, y = aktifYuva();
  if (!j || !y) return;
  if (j.tur === "kistir") {
    const [a, b] = [...S.noktalar.values()];
    if (!b) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s = sinirla(j.cam0.s * d / j.d0, dinlenikS(y.lay) * 0.7, 8);
    const ux = (j.m0.x - y.lay.L - j.cam0.x) / j.cam0.s, uy = (j.m0.y - y.lay.T - j.cam0.y) / j.cam0.s;
    kareyeYaz(y, { s, x: m.x - y.lay.L - s * ux, y: m.y - y.lay.T - s * uy });
    return;
  }
  const dx = nk.x - j.x0, dy = nk.y - j.y0;
  j.son.push({ x: nk.x, y: nk.y, t: e.timeStamp });
  if (j.son.length > 6) j.son.shift();
  if (j.tur === "bekle") {
    if (Math.hypot(dx, dy) < 10) return;
    const rest = dinlenik(y.lay);
    const yakin = y.cam.s > rest.s * 1.02 || S.gorunum === "panel";
    const dikeyPay = S.gorunum === "genislik" && y.lay.bh * y.cam.s > S.vh + 2;
    if (yakin && S.gorunum !== "panel") j.tur = "kaydir";
    else if (S.gorunum === "panel" && y.cam.s > 1.02) j.tur = "kaydir";
    else if (Math.abs(dx) > Math.abs(dy) * 1.2) j.tur = "cevir";
    else j.tur = dikeyPay ? "kaydir" : "cevir";
    if (j.tur === "kaydir") { perdeKapat(); S.el.kare.classList.remove("parla"); }
    jestBasladi();
    sonGizle();
  }
  if (j.tur === "kaydir") {
    const cam = { s: j.cam0.s, x: j.cam0.x + dx, y: j.cam0.y + dy };
    kareyeYaz(y, S.gorunum === "panel" ? cam : kamSinirla(cam, y.lay));
  } else if (j.tur === "cevir") {
    j.dx = dx;
    let etki = dx;
    // Başta ya da sonda direnç
    const ileriYon = -Math.sign(dx) * ileriIsaret();
    if (!S.yuvalar.has(S.yi + ileriYon)) etki = dx * 0.25;
    cevirmeSurukle(etki);
  }
}

// Parmak sürüklemeye ya da kıstırmaya başladı: süren panel akışı ve sayfa sonu beklemesi bırakılır
function jestBasladi() {
  S.akis++;
  S.panelSonu = false;
  S.beklemeBitir?.();
}

// Kamera ve sürükleme rAF'ta bir kez yazılır
function kareyeYaz(y, cam) {
  S.bekleyenKam = { y, cam };
  if (S.raf) return;
  S.raf = requestAnimationFrame(() => {
    S.raf = 0;
    const b = S.bekleyenKam;
    S.bekleyenKam = null;
    if (b && !b.y.olu) kameraUygula(b.y, b.cam);
  });
}
function cevirmeSurukle(dx) {
  for (const [yi, y] of S.yuvalar) yuvaKonumla(y, Math.sign(yi - S.yi), 0, dx);
}
function suruklemeBirak(j, cevir) {
  const adim = cevir ? -Math.sign(j.dx) * ileriIsaret() : 0;
  const hedef = S.yi + adim;
  if (adim && S.yuvalar.has(hedef)) {
    // Sürüklemeden devam: kalan yolu çevirme süresiyle
    const eski = aktifYuva(), yeni = S.yuvalar.get(hedef);
    yuvaKonumla(eski, -adim, CEVIR_MS);
    yuvaKonumla(yeni, 0, CEVIR_MS);
    S.ceviriyor = true;
    zamanla(() => { if (!S) return; S.ceviriyor = false; S.yi = hedef; yayilimaGecTamamla(adim); }, CEVIR_MS + 20);
    return;
  }
  if (adim && hedef >= S.yay.length) sonGoster(0);
  for (const [yi, y] of S.yuvalar) yuvaKonumla(y, Math.sign(yi - S.yi), 200);
}
// Sürüklemeyle çevrilen yayılımın ardından: yayilimaGec'in kalan işleri
function yayilimaGecTamamla(adim) {
  const y = aktifYuva();
  kameraUygula(y, dinlenik(y.lay, adim < 0 && S.gorunum === "genislik"));
  S.panel = null;
  for (const [yi, yy] of S.yuvalar) if (Math.abs(yi - S.yi) > 1) { yuvaBirak(yy); S.yuvalar.delete(yi); }
  for (const [yi, yy] of S.yuvalar) if (yi !== S.yi) yuvaKonumla(yy, Math.sign(yi - S.yi));
  zamanla(() => bosta(komsulariHazirla), 80);
  konumYaz();
  seritGuncelle();
  if (S.gorunum === "panel") {
    const yi = S.yi;
    y.hazir.then(() => panelleriAl(y.sayfalar[0].i)).then((liste) => {
      if (S && S.yi === yi) panelaGit(y, liste, adim < 0 ? liste.length - 1 : 0);
    });
  }
  sonKontrol();
}

function isaretciKalkti(e) {
  if (!S) return;
  if (S.aktif && e.pointerId === S.aktif.id) return kalemKalkti(e);
  if (!S.noktalar.has(e.pointerId)) return;
  const nk = S.noktalar.get(e.pointerId);
  S.noktalar.delete(e.pointerId);
  const j = S.jest, y = aktifYuva();
  if (!j || !y) { S.jest = null; return; }
  if (j.tur === "kistir") {
    if (S.noktalar.size >= 1) {
      // Bir parmak kaldı: dokunuş sayılmaz, kaydırma olarak sürer
      const [id, kalan] = [...S.noktalar.entries()][0];
      S.jest = { tur: "kaydir", id, x0: kalan.x, y0: kalan.y, t0: performance.now(), cam0: { ...y.cam }, son: [],
        iki: { t0: j.t0, cam0: j.cam0, ilk: j.ilk }, iptal: j.iptal || e.type === "pointercancel" };   // hızlı iki parmak dokunuşu mu, son parmak kalkınca bakılır
      return;
    }
    S.jest = null;
    yakinlikBitti(y);
    return;
  }
  if (e.pointerId !== j.id) return;
  S.jest = null;
  if (j.tur === "bekle" && e.type === "pointerup") {
    if (performance.now() - j.t0 < 450) dokunus(nk.x, nk.y, e.pointerType);
    return;
  }
  if (j.tur === "cevir") {
    const s = j.son, hiz = s.length > 1 ? (s[s.length - 1].x - s[0].x) / Math.max(1, s[s.length - 1].t - s[0].t) : 0;
    suruklemeBirak(j, e.type === "pointerup" && (Math.abs(j.dx) > S.vw * 0.16 || (Math.abs(hiz) > 0.45 && Math.sign(hiz) === Math.sign(j.dx))));
    return;
  }
  // İki parmakla kısa dokunuş (yakınlaşmadan, kaymadan): geri al (OZELLIKLER-7 §3, her platformda)
  if (j.tur === "kaydir" && j.iki && !j.iptal && e.type === "pointerup" && performance.now() - j.iki.t0 < 320
    && Math.abs(y.cam.s / j.iki.cam0.s - 1) < 0.04 && Math.hypot(nk.x - j.x0, nk.y - j.y0) < 14) {
    kameraUygula(y, j.iki.cam0);
    parmakGeriAl(j.iki.ilk);
    return;
  }
  if (j.tur === "kaydir") yakinlikBitti(y);
}

// Halka ve fiş: ne olduğu görünsün (TASARIM-4 4.6). Kabuğun ortak bir yardımcısı varsa o.
function parmakGeriAl(noktalar) {
  const bos = !S.gecmis.length;
  if (!bos) geriAl();
  if (typeof ortak.parmakGeriBildirim === "function") {
    try { ortak.parmakGeriBildirim({ noktalar, yineleme: false, bos }); return; } catch { /* yerel */ }
  }
  for (const [x, y] of noktalar || []) {
    const r = h("i", { class: "parmak-halka" + (bos ? " bos" : ""), "aria-hidden": "true", style: `left:${x}px;top:${y}px` });
    document.body.append(r);
    setTimeout(() => r.remove(), 400);
  }
  S.geriFis?.remove();
  const f = S.geriFis = h("div", { class: "geri-fis cizgi-geri-fis", role: "status" }, bos ? "Geri alınacak bir şey yok" : "Geri alındı");
  document.body.append(f);
  zamanla(() => f.remove(), 1200);
}

// Kıstırma ya da kaydırma bitti: sığdırmanın altına inildiyse geri döner; büyüdüyse çözünürlük artar
function yakinlikBitti(y) {
  const rest = dinlenik(y.lay);
  if (y.cam.s < rest.s * 1.02) {
    kameraAnim(y, rest, 240);
    if (S.gorunum === "panel") S.panel = S.panel && { ...S.panel, k: -1 };
    return;
  }
  if (S.gorunum !== "panel") kameraUygula(y, kamSinirla(y.cam, y.lay));
  const f = Math.min(EN_F, y.cam.s);
  if (f > y.f * 1.15) {
    y.f = f;
    zamanla(() => bosta(() => { if (S && !y.olu) y.sayfalar.forEach((p) => sayfaCiz(y, p, y.f)); }), 120);
  }
}

function sonDokunusIptal() { if (S.sonDokunus) { clearTimeout(S.sonDokunus.z); S.sonDokunus = null; } }

// Tek dokunuş biraz bekler: çift dokunuşsa panele yakınlaşılır
function dokunus(x, y, tur) {
  const t = performance.now(), o = S.sonDokunus;
  if (o && t - o.t < 300 && Math.hypot(x - o.x, y - o.y) < 44) { sonDokunusIptal(); ciftDokunus(x, y); return; }
  sonDokunusIptal();
  const z = setTimeout(() => { if (S) { S.sonDokunus = null; tekDokunus(x, y); } }, tur === "mouse" ? 220 : 260);
  S.sonDokunus = { t, x, y, z };
}

function tekDokunus(x) {
  const bolge = x < S.vw * 0.3 ? "sol" : x > S.vw * 0.7 ? "sag" : "orta";
  if (bolge === "orta") return cubukAcKapa();
  if (!S.kok.classList.contains("cubuk-kapali")) cubukGizle();
  const adim = (bolge === "sag") === (S.yon === "ltr") ? 1 : -1;
  ileri(adim);
}

async function ciftDokunus(x, yy) {
  const y = aktifYuva();
  if (!y) return;
  S.akis++;
  const rest = dinlenik(y.lay);
  if (y.cam.s > rest.s * 1.05 && S.gorunum !== "panel") { kameraAnim(y, rest, 300); return; }
  // Dokunulan sayfa ve panel
  const ux = (x - y.lay.L - y.cam.x) / y.cam.s, uy = (yy - y.lay.T - y.cam.y) / y.cam.s;
  const p = y.lay.sayfalar.find((q) => ux >= q.x && ux <= q.x + q.w) || y.lay.sayfalar[0];
  const liste = await panelleriAl(p.i);
  if (!S || aktifYuva() !== y) return;
  const qx = (ux - p.x) / p.w, qy = uy / p.h;
  let k = liste.findIndex((q) => qx >= q.x && qx <= q.x + q.w && qy >= q.y && qy <= q.y + q.h);
  if (k < 0) k = liste.reduce((en, q, j) => {
    const d = Math.hypot(q.x + q.w / 2 - qx, q.y + q.h / 2 - qy);
    return d < en.d ? { d, j } : en;
  }, { d: Infinity, j: 0 }).j;
  if (S.gorunum === "panel") {
    if (S.panel?.k === k && y.cam.s > 1.02) { S.panel = { ...S.panel, k: -1 }; return tumSayfa(y); }
    return panelaGit(y, liste, k);
  }
  const q = liste[k];
  const r = { x: p.x + q.x * p.w, y: q.y * p.h, w: q.w * p.w, h: q.h * p.h };
  const cam = kutuyaKamera(y.lay, r, 24);
  await kameraAnim(y, cam, PANEL_MS);
  if (S && aktifYuva() === y) { kareCizgisi(ekranKutusu(y, r, cam)); yakinlikBitti(y); }
}

let tekerlekZ = 0;
function tekerlek(e) {
  if (!S || e.target.closest?.(".cizgi-alt .cizgi-serit")) return;
  e.preventDefault();
  const y = aktifYuva();
  if (!y) return;
  if (e.ctrlKey) {
    // Dokunmatik yüzeyde kıstırma ya da Ctrl + tekerlek: imlecin altı yerinde kalır
    const s = sinirla(y.cam.s * Math.exp(-e.deltaY * 0.01), dinlenikS(y.lay), 8);
    const x = e.clientX - S.ox, yy = e.clientY - S.oy;
    const ux = (x - y.lay.L - y.cam.x) / y.cam.s, uy = (yy - y.lay.T - y.cam.y) / y.cam.s;
    kareyeYaz(y, kamSinirla({ s, x: x - y.lay.L - s * ux, y: yy - y.lay.T - s * uy }, y.lay));
    clearTimeout(S.tekZ);
    S.tekZ = zamanla(() => yakinlikBitti(y), 200);
    return;
  }
  const yakin = y.cam.s > dinlenikS(y.lay) * 1.02 || (S.gorunum === "genislik" && y.lay.bh * y.cam.s > S.vh + 2);
  if (yakin && S.gorunum !== "panel") {
    kareyeYaz(y, kamSinirla({ ...y.cam, x: y.cam.x - e.deltaX, y: y.cam.y - e.deltaY }, y.lay));
    // Genişlik'te sayfanın sonunda tekerlek sonraki sayfaya geçer
    if (S.gorunum !== "genislik") return;
    const alt = S.vh - y.lay.T - y.lay.bh * y.cam.s;
    const sonda = e.deltaY > 0 && y.cam.y <= alt + 1, basta = e.deltaY < 0 && y.cam.y >= -y.lay.T - 1;
    if (!sonda && !basta) return;
  }
  const t = performance.now();
  if (t - tekerlekZ < 380 || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
  tekerlekZ = t;
  ileri((Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX * ileriIsaret()) > 0 ? 1 : -1);
}

function tus(e) {
  if (!S || e.target.closest?.("input, textarea")) return;
  const sag = S.yon === "ltr" ? 1 : -1;
  const eylem = {
    ArrowRight: () => ileri(sag), ArrowLeft: () => ileri(-sag), " ": () => ileri(e.shiftKey ? -1 : 1),
    PageDown: () => ileri(1), PageUp: () => ileri(-1),
    Home: () => yayilimaGec(0, { anim: false }), End: () => yayilimaGec(S.yay.length - 1, { anim: false }),
    Escape: () => cubukAcKapa(),
  }[e.key];
  if (eylem) { e.preventDefault(); eylem(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); geriAl(); }
}

// ---------- kalem ----------

function canliHazirla() {
  if (!S.canliCv) {
    S.canliCv = h("canvas", { class: "cizgi-canli", "aria-hidden": "true" });
    S.kok.insertBefore(S.canliCv, S.el.perde.nextSibling);
    S.canli = new CanliKatman(S.canliCv);
  }
}
const basinc = (e) => (e.pointerType === "pen" ? basincUygula(e.pressure || 0.5) : 0.5);

function kalemBasla(e, { y, p, r }) {
  canliHazirla();
  islakAktar();
  sonDokunusIptal();
  S.akis++;
  const k = r.width / PB;   // sayfa birimi başına css pikseli (yakınlık dahil)
  S.canli.boyutla(S.vw, S.vh, k * S.dpr, { dpr: S.dpr });
  const ox = (r.left - S.ox) / k, oy = (r.top - S.oy) / k;   // kök biriminde sayfanın sol üstü
  const silgi = !!silgiTusu(e) || S.arac === "silgi";
  S.aktif = { id: e.pointerId, tur: e.pointerType, y, p, k, ox, oy, silgi, silinen: [], onceki: null, cizgi: null,
    t0: performance.now(), x0: kokX(e), y0: kokY(e) };
  try { S.kok.setPointerCapture(e.pointerId); } catch { /* boş */ }
  S.kok.classList.add("yaziyor");
  document.documentElement.dataset.kalem = "temas";
  halkaGizle();
  const n = nokta(e);
  if (silgi) silgiOynat(n);
  else {
    S.aktif.cizgi = { id: yeniId("c"), tur: "dolma", renk: S.renk, w: KALEM_MM * 5, p: [n] };
    S.canli.ciz(S.aktif.cizgi);
  }
}
function nokta(q) {
  const a = S.aktif;
  return [(q.clientX - S.ox) / a.k, (q.clientY - S.oy) / a.k, basinc(q)];
}
function kalemOynat(e) {
  const a = S.aktif;
  const birlesik = e.getCoalescedEvents?.() || [];
  const olaylar = birlesik.length ? birlesik : [e];
  if (!a.silgi && silgiTusu(e)) {   // çizerken yan tuşa basıldı: çizgi biter, silgi başlar
    cizgiBitir();
    a.silgi = true;
    a.cizgi = null;
  }
  if (a.silgi) { for (const q of olaylar) silgiOynat(nokta(q)); return; }
  const c = a.cizgi;
  for (const q of olaylar) c.p.push(nokta(q));
  const tahmin = (e.getPredictedEvents?.() || []).slice(0, 2).map(nokta);
  S.canli.ciz(c, tahmin);
}
function kalemKalkti(e) {
  const a = S.aktif;
  if (a.silgi) silgiBitti();
  else if (e.type === "pointerup") cizgiBitir();
  else S.canli.temizle();
  S.aktif = null;
  if (a.tur === "pen") S.kalemZ = performance.now();
  delete document.documentElement.dataset.kalem;
  zamanla(() => { if (S && !S.aktif) S.kok.classList.remove("yaziyor"); }, 150);
}
function cizgiBitir() {
  const a = S.aktif, c = a.cizgi;
  if (!c) return;
  a.cizgi = null;
  const { ox, oy, p } = a, i = p.i;
  islakBitir(S.canli, c, (bitmis) => {
    if (!S) return;
    const kayit = { id: bitmis.id, tur: bitmis.tur, renk: bitmis.renk, w: bitmis.w, p: bitmis.p.map((q) => [q[0] - ox, q[1] - oy, q[2]]) };
    if (bitmis.duz) kayit.duz = true;
    cizgilerAl(i, true).push(kayit);
    cizgiyiEkle(i, kayit);
    gecmisEkle({ tur: "ekle", i, cizgi: kayit });
    izEkle(i, kayit);
    degisti();
  });
}
function silgiOynat(n) {
  const a = S.aktif;
  const x = n[0] - a.ox, y = n[1] - a.oy;
  const liste = cizgilerAl(a.p.i);
  const onceki = a.onceki;
  a.onceki = [x, y];
  if (!liste.length) return;
  const silinen = silgiUygula(liste, x, y, 12 / a.k, { onceki });
  if (!silinen.length) return;
  a.silinen.push(...silinen);
  sayfaMurekkebiniYenile(a.p.i);
}
function silgiBitti() {
  const a = S.aktif;
  if (!a.silinen.length) return;
  // Etkilenen izlerin kopyası geçmişe girer: geri alınca aynı kimlik, not ve gruplama döner
  const ids = new Set(a.silinen.map((c) => c.id));
  const izler = S.veri.izler.filter((iz) => iz?.kaynak === "cizgi" && iz.sayfa === a.p.i + 1
    && Array.isArray(iz.cizgiIdleri) && iz.cizgiIdleri.some((id) => ids.has(id)))
    .map((iz) => JSON.parse(JSON.stringify(iz)));
  gecmisEkle({ tur: "sil", i: a.p.i, cizgiler: a.silinen, izler });
  izleriEsle(a.p.i);
  degisti();
}

function gecmisEkle(g) {
  S.gecmis.push(g);
  if (S.gecmis.length > 100) S.gecmis.shift();
  S.el.geriAl.disabled = false;
}
function geriAl() {
  islakAktar();
  const g = S.gecmis.pop();
  S.el.geriAl.disabled = !S.gecmis.length;
  if (!g) return;
  const liste = cizgilerAl(g.i, true);
  if (g.tur === "ekle") {
    const j = liste.findIndex((c) => c.id === g.cizgi.id);
    if (j >= 0) liste.splice(j, 1);
    izleriEsle(g.i);
  } else {
    liste.push(...g.cizgiler);
    if (g.izler) {
      const izler = S.veri.izler;
      for (const kopya of g.izler) {
        const j = izler.findIndex((x) => x?.id === kopya.id);
        if (j >= 0) izler[j] = kopya; else izler.push(kopya);
      }
      // Kopyada olmayan çizgi (eski geçmiş) yine ize bağlanır
      const bagli = new Set(g.izler.flatMap((iz) => iz.cizgiIdleri));
      for (const c of g.cizgiler) if (!bagli.has(c.id)) izEkle(g.i, c, false);
      S.izSon = null;
    } else for (const c of g.cizgiler) izEkle(g.i, c, false);
  }
  sayfaMurekkebiniYenile(g.i);
  degisti();
}

// ---------- izler ----------
// Kalem kalkınca çizgi bir ize bağlanır: kısa arayla yakına çizilenler tek iz (yıldız, el yazısı).

function izTuru(cizgiler, k) {
  const bw = k.x1 - k.x0, bh = k.y1 - k.y0, m = Math.max(bw, bh);
  if (cizgiler.length === 1) {
    const p = cizgiler[0].p, a = p[0], z = p[p.length - 1];
    let yol = 0;
    for (let j = 1; j < p.length; j++) yol += Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]);
    if (m > 30 && Math.hypot(z[0] - a[0], z[1] - a[1]) < m * 0.3 && yol > m * 2.2 && Math.min(bw, bh) > m * 0.25) return "daire";
    if (bw > 50 && bh < bw * 0.25) return "alt";
  }
  if (m < 64) return "isaret";
  return "serbest";
}
function izKutusu(i, liste) {
  const k = cizgilerKutusu(liste);
  if (!k) return null;
  const H = sayfaBoyu(i), y4 = (v) => Math.round(sinirla(v, 0, 1) * 1e4) / 1e4;
  return { k, kutu: [y4(k.x0 / PB), y4(k.y0 / H), y4((k.x1 - k.x0) / PB), y4((k.y1 - k.y0) / H)] };
}
function izEkle(i, c, birlestir = true) {
  const izler = S.veri.izler, t = Date.now();
  const kc = cizgilerKutusu([c]);
  const son = S.izSon;
  let iz = null;
  if (birlestir && son && son.i === i && t - son.t < 1500 && izler.includes(son.iz)) {
    const a = son.k, pay = 24;
    if (kc.x0 < a.x1 + pay && kc.x1 > a.x0 - pay && kc.y0 < a.y1 + pay && kc.y1 > a.y0 - pay) iz = son.iz;
  }
  if (iz) iz.cizgiIdleri.push(c.id);
  else {
    iz = { id: yeniId("iz"), tur: "serbest", zaman: t, renk: c.renk, metin: "", sayfa: i + 1, kutu: [0, 0, 0, 0], cizgiIdleri: [c.id], kaynak: "cizgi" };
    izler.push(iz);
  }
  const liste = cizgilerAl(i).filter((x) => iz.cizgiIdleri.includes(x.id));
  const kk = izKutusu(i, liste);
  if (kk) { iz.kutu = kk.kutu; iz.tur = izTuru(liste, kk.k); }
  S.izSon = { i, t, iz, k: kk?.k || kc };
}
// Silgi ve geri al sonrası: çizgisi kalmayan iz düşer, kalanın kutusu ve türü yenilenir
function izleriEsle(i) {
  const varolan = new Map(cizgilerAl(i).map((c) => [c.id, c]));
  const izler = S.veri.izler;
  for (let j = izler.length - 1; j >= 0; j--) {
    const iz = izler[j];
    if (iz?.kaynak !== "cizgi" || iz.sayfa !== i + 1 || !Array.isArray(iz.cizgiIdleri)) continue;
    const kalan = iz.cizgiIdleri.filter((id) => varolan.has(id));
    if (!kalan.length) { izler.splice(j, 1); if (S.izSon?.iz === iz) S.izSon = null; continue; }
    if (kalan.length === iz.cizgiIdleri.length) continue;
    iz.cizgiIdleri = kalan;
    const liste = kalan.map((id) => varolan.get(id));
    const kk = izKutusu(i, liste);
    if (kk) { iz.kutu = kk.kutu; iz.tur = izTuru(liste, kk.k); }
  }
}

function degisti() {
  clearTimeout(S.degisZ);
  const id = S.belge.id;
  S.degisZ = zamanla(() => bus.emit("belge:degisti", { belgeId: id }), 300);
}

// ---------- kalem halkası ----------

function halkaGoster(e) {
  const hl = S.el.halka, a = S.arac === "silgi" || silgiTusu(e);
  const k = (() => { const r = sayfaBul(e.clientX, e.clientY); return r ? r.r.width / PB : 0; })();
  if (!k && !a) return halkaGizle();
  const boy = a ? 24 : Math.max(6, KALEM_MM * 5 * k * 1.4);
  hl.dataset.arac = a ? "silgi" : "kalem";
  hl.style.setProperty("--c", boy.toFixed(1) + "px");
  hl.classList.add("gorunur");
  S.hx = e.clientX - S.ox; S.hy = e.clientY - S.oy;
  if (S.halkaRaf) return;
  S.halkaRaf = requestAnimationFrame(() => {
    if (!S) return;
    S.halkaRaf = 0;
    hl.style.transform = `translate3d(${S.hx}px, ${S.hy}px, 0)`;
  });
}
function halkaGizle() { S?.el.halka.classList.remove("gorunur"); }

// ---------- çubuklar ----------

function cubukGoster(sure = false) {
  S.kok.classList.remove("cubuk-kapali");
  clearTimeout(S.cubukZ);
  if (sure) S.cubukZ = zamanla(() => { if (S && !S.kok.querySelector(".cizgi-ust:hover, .cizgi-alt:hover")) cubukGizle(); }, 4000);
  seritGuncelle(true);
  kucukleriIste();
}
function cubukGizle() { clearTimeout(S.cubukZ); S.kok.classList.add("cubuk-kapali"); }
function cubukAcKapa() { S.kok.classList.contains("cubuk-kapali") ? cubukGoster(true) : cubukGizle(); }

function aracSec(arac) {
  S.arac = arac;
  S.el.kalem.setAttribute("aria-pressed", String(arac === "kalem"));
  S.el.silgi.setAttribute("aria-pressed", String(arac === "silgi"));
  S.kok.dataset.arac = arac;
}
function renkSec(renk) {
  S.renk = renk;
  S.veri.cizgi.renk = renk;
  for (const b of S.el.renkler.children) b.setAttribute("aria-checked", String(b.dataset.renk === renk));
  if (S.arac === "silgi") aracSec("oku");
}

function yonSec(yon) {
  if (yon === S.yon) return;
  S.yon = S.belge.yon = S.motor.bilgi.yon = yon;
  S.kok.dataset.yon = yon;
  anahtarGuncelle(S.el.yon, yon);
  yonTelGuncelle();
  S.el.serit.dir = yon === "rtl" ? "rtl" : "ltr";
  S.panel = null;
  // Aynı yerleşimde de sayfa sırası tersine döner: yuvalar baştan kurulur
  zorlaYenile(S.gorunum === "panel" ? "bas" : null);
  ipucuGoster(true);
  bus.emit("belgeler", { tur: "guncelle", id: S.belge.id });
  degisti();
}
function yonTelGuncelle() {
  const b = S.el.yonTel, ad = S.yon === "rtl" ? "Manga: sağdan sola" : "Soldan sağa";
  b.setAttribute("aria-label", "Okuma yönü: " + ad);
  b.title = "Okuma yönü: " + ad;
  b.replaceChildren(icon(S.yon === "rtl" ? "sol" : "sag"));
}
function gorunumSec(g) {
  if (g === S.gorunum) return;
  S.gorunum = g;
  S.gorunumKayitli = true;
  S.veri.cizgi.gorunum = g;
  S.kok.dataset.gorunum = g;
  anahtarGuncelle(S.el.gorunum, g);
  const k = g === "panel" ? "bas" : null;
  S.panel = null;
  perdeKapat();
  zorlaYenile(k);
  degisti();
}
function zorlaYenile(panel = "bas") {
  const y = aktifYuva();
  const i = y ? Math.min(...y.sayfalar.map((p) => p.i)) : 0;
  olcuAl();
  yayilimlariKur();
  for (const yy of S.yuvalar.values()) yuvaBirak(yy);
  S.yuvalar.clear();
  S.akis++;
  S.yi = -1;
  yayilimaGec(yayBul(i), { anim: false, panel, ilk: true });
}

// Telefonda Panel ilk kez: altta cam fiş, 3 sn ya da dokununca kaybolur (TASARIM-4 2.8)
function panelIpucu() {
  try { if (localStorage.getItem(PANEL_IPUCU) === "1") return; localStorage.setItem(PANEL_IPUCU, "1"); } catch { return; }
  const f = h("div", { class: "cizgi-fis", role: "status" }, "Kareden kareye geçmek için sağa dokun. Bütün sayfa için iki kez dokun.");
  S.kok.append(f);
  const git = () => { f.classList.add("gidiyor"); setTimeout(() => f.remove(), 220); };
  f.addEventListener("pointerdown", git, { once: true });
  zamanla(git, 3000);
}
function ipucuGoster(zorla = false) {
  let gosterildi = false;
  try { gosterildi = localStorage.getItem(IPUCU_ANAHTAR) === "1"; } catch { /* boş */ }
  if (gosterildi && !zorla) return;
  try { localStorage.setItem(IPUCU_ANAHTAR, "1"); } catch { /* boş */ }
  const e = S.el.ipucu;
  e.classList.remove("gorunur");
  void e.offsetWidth;
  e.classList.add("gorunur");
  zamanla(() => S?.el.ipucu.classList.remove("gorunur"), 1200);
}

// ---------- küçük resim şeridi ----------

function kucukResimleriKur() {
  const n = S.n, serit = S.el.serit;
  S.io = new IntersectionObserver((girdiler) => {
    for (const g of girdiler) if (g.isIntersecting) { const t = S.kucukler[+g.target.dataset.i]; if (t) t.gorunur = true; }
    kucukleriIste();
  }, { root: serit, rootMargin: "0px 240px" });
  for (let i = 0; i < n; i++) {
    const cv = h("canvas", { width: 1, height: 1 });
    const b = h("button", { type: "button", class: "cizgi-kucuk", role: "listitem", "aria-label": `Sayfa ${i + 1}`, dataset: { i },
      onclick: () => { S.akis++; yayilimaGec(yayBul(i), { anim: Math.abs(yayBul(i) - S.yi) === 1, panel: "bas" }); cubukGoster(true); } },
    cv, h("span", {}, String(i + 1)));
    b.style.setProperty("--r", oran(i).toFixed(4));
    serit.append(b);
    S.kucukler.push({ i, b, cv, cizildi: false, gorunur: false });
    S.io.observe(b);
  }
}
let kucukSuruyor = false;
async function kucukleriIste() {
  if (!S || kucukSuruyor || S.kok.classList.contains("cubuk-kapali")) return;
  kucukSuruyor = true;
  const motor = S.motor;
  try {
    for (;;) {
      if (!S || S.motor !== motor || S.kok.classList.contains("cubuk-kapali")) break;
      const t = S.kucukler.find((x) => x.gorunur && !x.cizildi);
      if (!t) break;
      if (S.aktif || S.ceviriyor || S.jest) { await bekle(200); continue; }
      t.cizildi = true;
      await new Promise((r) => bosta(r, 300));
      if (!S || S.motor !== motor) break;
      const r = oran(t.i), boy = 64 * S.dpr;
      let bmp;
      try { bmp = await motor.gorsel(t.i, { enFazla: Math.round(Math.max(boy, boy * r)) }); } catch { continue; }
      if (!S || S.motor !== motor || !bmp.width) { t.cizildi = false; continue; }
      t.cv.width = Math.max(1, Math.round(boy * r)); t.cv.height = Math.max(1, Math.round(boy));
      const ctx = t.cv.getContext("2d");
      ctx.drawImage(bmp, 0, 0, t.cv.width, t.cv.height);
      t.b.style.setProperty("--r", oran(t.i).toFixed(4));
      t.b.classList.add("hazir");
      kucukMurekkep(t.i, true);
    }
  } finally { kucukSuruyor = false; }
}
// Küçük resmin üstünde kalem izleri: ayrı bir katman değil, aynı tuvale ölçekli
function kucukMurekkep(i, ilk = false) {
  const t = S.kucukler[i];
  if (!t || !t.cizildi || !t.b.classList.contains("hazir")) return;
  const liste = cizgilerAl(i);
  if (!liste.length) return;
  if (!ilk) { t.cizildi = false; kucukleriIste(); return; }   // silinen iz için görsel baştan
  const ctx = t.cv.getContext("2d"), k = t.cv.width / PB;
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
  for (const c of liste) cizgiCiz(ctx, c);
  ctx.restore();
}

function seritGuncelle(kaydir = false) {
  if (!S) return;
  const y = S.yay[S.yi] || [];
  for (const t of S.kucukler) {
    if (y.includes(t.i)) t.b.setAttribute("aria-current", "page"); else t.b.removeAttribute("aria-current");
  }
  const ilk = Math.min(...y) + 1, son = Math.max(...y) + 1;
  S.el.konum.textContent = (ilk === son ? String(ilk) : `${ilk}-${son}`) + " / " + S.n;
  if (kaydir || !S.kok.classList.contains("cubuk-kapali")) {
    const t = S.kucukler[y[0]];
    if (t) {
      const sr = S.el.serit.getBoundingClientRect(), br = t.b.getBoundingClientRect();
      S.el.serit.scrollLeft += br.left + br.width / 2 - (sr.left + sr.width / 2);
    }
  }
}

function duyur(metin) { S.el.duyuru.textContent = metin; }

// ---------- konum kaydı ----------

function konumYaz(hemen = false) {
  if (!S) return;
  const y = S.yay[S.yi];
  if (!y) return;
  const b = S.belge, ilk = Math.min(...y), son = Math.max(...y);
  b.sayfa = ilk + 1;
  b.sayfaSayisi = S.n;
  b.ilerleme = (son + 1) / S.n;
  b.yon = S.yon;
  S.veri.cizgi.konum = { sayfa: ilk, panel: S.panel && S.panel.k >= 0 && S.panel.k < S.panel.liste.length ? S.panel.k : null };
  if (S.gorunumKayitli) S.veri.cizgi.gorunum = S.gorunum;   // telefon varsayılanı (Panel) kayda geçmez
  if (hemen) return;
  if (S.sonYer === ilk) return;
  S.sonYer = ilk;
  duyur(`Sayfa ${ilk === son ? ilk + 1 : `${ilk + 1} ve ${son + 1}`} / ${S.n}`);
  clearTimeout(S.konumZ);
  const id = b.id;
  S.konumZ = zamanla(() => bus.emit("belge:degisti", { belgeId: id }), 800);
}

function zamanla(fn, ms) {
  const s = S;
  const z = setTimeout(() => { s?.z.delete(z); fn(); }, ms);
  s?.z.add(z);
  return z;
}
