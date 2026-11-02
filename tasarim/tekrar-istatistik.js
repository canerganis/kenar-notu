// Tekrar istatistikleri (TASARIM-5 11.5 R5): son 30 günün tutma oranı, önümüzdeki 30 günün yükü,
// çalışma takvimi (son 20 hafta) ve kutu dağılımı. Grafikler SVG, renkler token (CSS sınıfları tekrar.css'te), sayılar tnum.
// Oyunlaştırma yok: seri, rozet, konfeti yok. Yalnız ölçü.
//
//   istatistikOzeti(kartlar, simdi) -> { toplam, yeni, askida, bugun, cevap30, bildi30, oran30, yuk: [30], gunluk: Map, kutular: [6] }
//   istatistikOlustur(kartlar = store.kartlar, simdi) -> HTMLElement   (0 kartta boş durum)
//
// Başarım: her kart ve her cevap bir kez gezilir (500 kart, 10 000 cevap birkaç ms). Gün anahtarı yerel gece yarısıdır.

import { h, icon, store, gunBasi, gunFarki, kutuAralikMetni, hedefHatirlama } from "./ortak.js";
import { t, yerel, ingilizceMi } from "./dil.js";

const GUN = 24 * 3600e3;
const ROMA = ["", "I", "II", "III", "IV", "V"];
const AYLAR = ingilizceMi ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  : ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const GUN_ADLARI = ingilizceMi ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const HAFTA = 20;
const SVG = "http://www.w3.org/2000/svg";
const yuzde = (x) => t("%{n}", { n: Math.round(x * 100) });
const sayi = (n) => n.toLocaleString(yerel);
// Türkçede "4 Mar", İngilizcede "Mar 4"
const tarihMetni = (z) => { const d = new Date(z); return ingilizceMi ? `${AYLAR[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${AYLAR[d.getMonth()]}`; };
const yeniMi = (k) => !(k.fsrs && k.fsrs.s > 0) && !(Array.isArray(k.gecmis) && k.gecmis.length) && (k.kutu || 1) <= 1;

function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids) if (c != null) el.append(c);
  return el;
}

// ---------- hesap ----------
export function istatistikOzeti(kartlar = store.kartlar, simdi = Date.now()) {
  const bugun = gunBasi(simdi), otuzOnce = gunBasi(simdi, -29), takvimBas = takvimBaslangici(simdi);
  const yuk = new Array(30).fill(0), kutular = [0, 0, 0, 0, 0, 0], gunluk = new Map();
  let yeni = 0, askida = 0, cevap30 = 0, bildi30 = 0;
  for (const k of kartlar) {
    if (k.askida) askida++;
    else {
      kutular[Math.min(5, Math.max(1, k.kutu || 1))]++;
      if (yeniMi(k)) yeni++;
      // Yük: askıdaki kart sayılmaz; gecikmiş kart bugünün yüküdür
      const g = Number.isFinite(k.sonraki) ? Math.max(0, gunFarki(k.sonraki, simdi)) : 0;
      if (g < 30) yuk[g]++;
    }
    if (!Array.isArray(k.gecmis)) continue;
    for (const c of k.gecmis) {
      const z = c?.zaman;
      if (!Number.isFinite(z) || z < takvimBas) continue;
      const gb = gunBasi(z);
      gunluk.set(gb, (gunluk.get(gb) || 0) + 1);
      if (gb >= otuzOnce) { cevap30++; if (c.bildi || (c.derece ?? 0) >= 2) bildi30++; }
    }
  }
  return { toplam: kartlar.length, yeni, askida, bugun: yuk[0], cevap30, bildi30, oran30: cevap30 ? bildi30 / cevap30 : null,
    yuk, gunluk, kutular, bugunBas: bugun, takvimBas };
}
// Takvim pazartesiden başlar: 20 haftanın ilk pazartesi
function takvimBaslangici(simdi) {
  const bugun = new Date(gunBasi(simdi));
  const haftaGunu = (bugun.getDay() + 6) % 7;   // pazartesi 0
  return gunBasi(bugun.getTime(), -haftaGunu - (HAFTA - 1) * 7);
}

// ---------- ipucu balonu (her işaret için; dokununca ya da üstüne gelince) ----------
function ipucuKur(kap) {
  const balon = h("div", { class: "tk-ist-balon", role: "status", "aria-live": "polite", hidden: true });
  kap.append(balon);
  let sabit = null;
  const goster = (hedef) => {
    const metin = hedef?.dataset?.ipucu;
    if (!metin) { balon.hidden = true; return; }
    balon.textContent = metin;
    balon.hidden = false;
    const r = hedef.getBoundingClientRect(), k = kap.getBoundingClientRect();
    const bw = balon.offsetWidth;
    const x = Math.min(k.width - bw - 4, Math.max(4, r.left - k.left + r.width / 2 - bw / 2));
    balon.style.left = `${x}px`;
    balon.style.top = `${r.top - k.top - balon.offsetHeight - 8}px`;
  };
  kap.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse" && !sabit) goster(e.target.closest("[data-ipucu]")); });
  kap.addEventListener("pointerleave", () => { if (!sabit) balon.hidden = true; });
  kap.addEventListener("click", (e) => { const t = e.target.closest("[data-ipucu]"); sabit = t && t !== sabit ? t : null; goster(sabit); });
  kap.addEventListener("focusin", (e) => goster(e.target.closest("[data-ipucu]")));
  kap.addEventListener("focusout", () => { if (!sabit) balon.hidden = true; });
}

// ---------- parçalar ----------
function karo(etiket, deger, alt, { buyuk = true } = {}) {
  return h("div", { class: "tk-ist-karo" },
    h("span", { class: "tk-ist-etiket" }, etiket),
    h("b", { class: "tk-ist-sayi" + (buyuk ? "" : " kucuk") }, deger),
    alt ? h("small", {}, alt) : null);
}

function panel(baslik, aciklama, ...icerik) {
  const id = "tk-ist-" + Math.random().toString(36).slice(2, 8);
  return h("section", { class: "tk-ist-panel", "aria-labelledby": id },
    h("header", {}, h("h3", { id }, baslik), aciklama ? h("p", {}, aciklama) : null), ...icerik);
}

// Önümüzdeki 30 gün: gün başına vadesi gelen kart. Tek seri, çubuk; bugün vurgulu. Izgara çizgisi yalnız en yüksek değerde.
function yukGrafigi(o) {
  const W = 600, H = 168, ust = 18, alt = 26, sol = 4, sag = 4;
  const enCok = Math.max(1, ...o.yuk);
  const adim = (W - sol - sag) / 30, gen = Math.max(4, adim - 4);
  const olcek = (v) => ((H - ust - alt) * v) / enCok;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "tk-ist-svg", role: "img", preserveAspectRatio: "none",
    "aria-label": t("Önümüzdeki 30 gün: toplam {n} kart, en yoğun gün {en} kart", { n: o.yuk.reduce((a, b) => a + b, 0), en: enCok }) });
  const tabanY = H - alt;
  svg.append(s("line", { class: "tk-ist-eksen", x1: 0, x2: W, y1: tabanY + 0.5, y2: tabanY + 0.5 }));
  svg.append(s("line", { class: "tk-ist-izgara", x1: 0, x2: W, y1: ust + 0.5, y2: ust + 0.5 }));
  const kap = h("div", { class: "tk-ist-grafik tk-ist-yuk" });
  o.yuk.forEach((v, i) => {
    const x = sol + i * adim + (adim - gen) / 2, yuk = olcek(v);
    const z = gunBasi(o.bugunBas, i);
    const ad = i === 0 ? t("Bugün") : i === 1 ? t("Yarın") : tarihMetni(z);
    const ipucu = t("{ad}: {n} kart", { ad, n: v });
    // Uçları 4 px yuvarlak, tabana oturan çubuk (yol: alt köşeler düz)
    if (v > 0) {
      const r = Math.min(4, gen / 2, yuk);
      const y = tabanY - yuk;
      svg.append(s("path", { class: "tk-ist-cubuk" + (i === 0 ? " bugun" : ""),
        d: `M${x} ${tabanY}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + gen - r}Q${x + gen} ${y} ${x + gen} ${y + r}V${tabanY}Z` }));
    } else svg.append(s("rect", { class: "tk-ist-sifir", x, y: tabanY - 2, width: gen, height: 2, rx: 1 }));
    // Dokunma hedefi işaretten büyük: sütunun tamamı
    svg.append(s("rect", { class: "tk-ist-hedef", x: sol + i * adim, y: 0, width: adim, height: H, "data-ipucu": ipucu, tabindex: i % 7 === 0 ? "0" : null, "aria-label": ipucu }));
  });
  kap.append(svg);
  // Eksen yazıları HTML'de: SVG esnerken yazı esnemesin
  const yazi = h("div", { class: "tk-ist-eksen-yazi", "aria-hidden": "true" });
  for (const i of [0, 7, 14, 21, 29]) yazi.append(h("span", { style: `left:${((i + 0.5) / 30) * 100}%` }, i === 0 ? t("Bugün") : `+${i}`));
  const enYazi = h("span", { class: "tk-ist-en", "aria-hidden": "true" }, `${enCok}`);
  kap.append(yazi, enYazi);
  ipucuKur(kap);
  return kap;
}

// Çalışma takvimi: 20 hafta x 7 gün. Tek vurgu tonunun 4 adımı; boş gün kıl çerçeveli
function takvimGrafigi(o) {
  const enCok = Math.max(0, ...o.gunluk.values());
  const esik = (v) => (v <= 0 ? 0 : enCok <= 4 ? Math.min(4, v) : Math.min(4, 1 + Math.floor((v / enCok) * 3.999)));
  const kare = 12, ara = 3, solPay = 28, ustPay = 16;
  const W = solPay + HAFTA * (kare + ara), H = ustPay + 7 * (kare + ara);
  let toplamGun = 0, toplamCevap = 0;
  // Kareler sabit ölçekte (en çok 1,3 kat): geniş panelde dev karelere dönüşmez
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "tk-ist-svg tk-ist-takvim", role: "img", style: `width:${Math.round(W * 1.3)}px;max-width:100%;height:auto` });
  const bugun = o.bugunBas;
  let oncekiAy = -1;
  for (let hft = 0; hft < HAFTA; hft++) {
    for (let g = 0; g < 7; g++) {
      const z = gunBasi(o.takvimBas, hft * 7 + g);
      if (z > bugun) continue;
      const d = new Date(z);
      if (g === 0 && d.getMonth() !== oncekiAy) {
        // Ay adı o ayın ilk haftasının üstünde
        if (hft < HAFTA - 1) svg.append(s("text", { class: "tk-ist-ay", x: solPay + hft * (kare + ara), y: 10 }, AYLAR[d.getMonth()]));
        oncekiAy = d.getMonth();
      }
      const v = o.gunluk.get(z) || 0;
      if (v) { toplamGun++; toplamCevap += v; }
      const ipucu = `${tarihMetni(z)}: ${v ? t("{n} cevap", { n: v }) : t("çalışılmadı")}`;
      svg.append(s("rect", { class: `tk-ist-gun a${esik(v)}` + (z === bugun ? " bugun" : ""), x: solPay + hft * (kare + ara), y: ustPay + g * (kare + ara),
        width: kare, height: kare, rx: 3, "data-ipucu": ipucu }));
    }
  }
  for (const g of [0, 2, 4]) svg.append(s("text", { class: "tk-ist-gunad", x: 0, y: ustPay + g * (kare + ara) + 10 }, GUN_ADLARI[g]));
  svg.setAttribute("aria-label", t("Son {h} hafta: {g} gün çalışıldı, {n} cevap", { h: HAFTA, g: toplamGun, n: toplamCevap }));
  const lejant = h("div", { class: "tk-ist-lejant", "aria-hidden": "true" }, h("span", {}, t("Az")),
    ...[0, 1, 2, 3, 4].map((a) => h("i", { class: "a" + a })), h("span", {}, t("Çok")));
  const kap = h("div", { class: "tk-ist-grafik tk-takvim-kap" }, svg);
  ipucuKur(kap);
  return [kap, lejant, { toplamGun, toplamCevap }];
}

// Kutu dağılımı: yatay çubuklar, I..V; kutu = FSRS aralığından türeyen hafıza basamağı
function kutuGrafigi(o) {
  const enCok = Math.max(1, ...o.kutular.slice(1));
  const liste = h("ol", { class: "tk-ist-kutular" });
  for (let n = 1; n <= 5; n++) {
    const c = o.kutular[n];
    liste.append(h("li", { "aria-label": t("{r}. kutu: {n} kart, {aralik}", { r: ROMA[n], n: c, aralik: kutuAralikMetni(n) }) },
      h("span", { class: "tk-ist-roma", "aria-hidden": "true" }, ROMA[n]),
      h("span", { class: "tk-ist-ray", "aria-hidden": "true" }, h("i", { style: `--oran:${c / enCok}` })),
      h("b", { "aria-hidden": "true" }, sayi(c))));
  }
  return liste;
}

// ---------- ekran ----------
export function istatistikOlustur(kartlar = store.kartlar, simdi = Date.now()) {
  const kok = h("div", { class: "tk-istatistik" });
  if (!kartlar.length) {
    kok.classList.add("bos");
    kok.append(h("div", { class: "tk-bos", role: "status" },
      h("span", { class: "tk-bos-simge", "aria-hidden": "true" }, icon("istatistik")),
      h("h2", {}, t("Henüz istatistik yok")),
      h("p", {}, t("İlk kartları çalıştıkça tutma oranın, önümüzdeki günlerin yükü ve çalışma takvimin burada belirir."))));
    return kok;
  }
  const o = istatistikOzeti(kartlar, simdi);
  const [takvim, lejant, top] = takvimGrafigi(o);
  const yarin = o.yuk[1], hafta = o.yuk.slice(0, 7).reduce((a, b) => a + b, 0);
  // Sayılar sayi() ile biçimlenir, sonra yer tutucuya girer
  const karolar = h("div", { class: "tk-ist-karolar" },
    karo(t("Tutma oranı"), o.oran30 == null ? "—" : yuzde(o.oran30),
      o.cevap30 ? `${t("son 30 günde {b} / {n} bildin", { b: sayi(o.bildi30), n: sayi(o.cevap30) })} · ${t("hedef {y}", { y: yuzde(hedefHatirlama()) })}` : t("son 30 günde cevap yok")),
    karo(t("Bugün"), sayi(o.bugun), yarin ? `${t("yarın {n}", { n: sayi(yarin) })} · ${t("7 günde {n}", { n: sayi(hafta) })}` : t("7 günde {n}", { n: sayi(hafta) })),
    karo(t("Kartlar"), sayi(o.toplam), [o.yeni ? t("{n} yeni", { n: sayi(o.yeni) }) : null, o.askida ? t("{n} askıda", { n: sayi(o.askida) }) : null].filter(Boolean).join(" · ") || t("hepsi çalışılmış")),
    karo(t("Çalışılan gün"), sayi(top.toplamGun), `${t("son {h} haftada", { h: HAFTA })} · ${t("{n} cevap", { n: sayi(top.toplamCevap) })}`));
  kok.append(karolar,
    panel(t("Önümüzdeki 30 gün"), t("Gün başına vadesi gelen kart"), yukGrafigi(o)),
    h("div", { class: "tk-ist-izgara-2" },
      panel(t("Çalışma takvimi"), t("Son {h} hafta, gün başına cevap", { h: HAFTA }), takvim, lejant),
      panel(t("Kutular"), t("Kartların hafıza basamağı"), kutuGrafigi(o))));
  return kok;
}
