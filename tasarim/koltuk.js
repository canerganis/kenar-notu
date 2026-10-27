// Koltuk: sade okuma görünümünün ortak parçaları (TASARIM-2 §4).
// EPUB (okuma.js) ve PDF/defter (duzenleyici.js) aynı parçaları kullanır: dokunma bölgeleri, üst çubuk,
// sürgülü cetvel, okuma hızından kalan süre, okuma ritmi, gizli kalem ucu ve mod anahtarı.
//
// koltukKur(kok, secenekler) -> { guncelle(), sayfaBitti(miktar), sifirla(), cubuk(goster), kapat(), el }
// secenekler:
//   ad, tur: "epub" | "pdf"
//   bolumler: [{ ad, oran }]            cetvelde uzun çentik (EPUB)
//   yerImleri: [oran]                    cetvelde bordo çentik (PDF)
//   konum: () => ({ oran, sayfa?, sayfaSayisi?, bolumAd?, kelimeKalanBolum?, kelimeKalanKitap? })
//   git: (oran) => void                  cetvelden gidiş
//   etiket: (oran) => string             sürüklerken camdaki yazı ("%42 · Bölüm 5", "s. 147 / 312")
//   cevir: (yon: -1 | 1) => void         kenar dokunuşu
//   modDegistir: (mod) => void           mod anahtarı
//   araclar: [öğeler]                    Ara, İçindekiler, Aa, ⋯ (ritimden sonra, anahtardan önce)
//   sahne: öğe                           dokunma bölgelerinin dinlendiği alan (varsayılan kok)
//   kalem: (acik) => void                gizli kalem açıldı / kapandı
//   kalemUcu: false                      kalem ucu düğmesi hiç gösterilmez (EPUB: kalem Active Canvas'a yazar)
//   mesgul: () => bool                   balon, fiş ya da panel açık mı (çubuk çekilmez, saat durur)
//   dokunmaGecerli: (e) => bool          false dönerse dokunuş bölge sayılmaz
//   geri: () => void                     varsayılan kitaplığa dönüş

import { h, icon, bus, store, ayarla, hareketAz } from "./ortak.js";

// index.html bağlamadıysa stil dosyası buradan eklenir
if (!document.querySelector('link[href$="koltuk.css"]')) {
  document.head.append(h("link", { rel: "stylesheet", href: new URL("./koltuk.css", import.meta.url).href }));
}

// ---------- kalıcı okuma verisi (kitaplar arasında ortak, okurundur) ----------
const DEPO = "kn-tasarim:koltuk";
const kayit = (() => { try { return JSON.parse(localStorage.getItem(DEPO)) || {}; } catch { return {}; } })();
const dizi = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === "number" && isFinite(v)) : []);
const A = store.ayarlar;
if (!Array.isArray(A.okumaHizi)) A.okumaHizi = dizi(kayit.okumaHizi);   // kelime / saniye
if (!Array.isArray(A.sayfaHizi)) A.sayfaHizi = dizi(kayit.sayfaHizi);   // sayfa / saniye (PDF)
if (!A.okumaRitmi || typeof A.okumaRitmi !== "object") {
  const r = kayit.okumaRitmi;
  A.okumaRitmi = r && typeof r === "object" && r.gunler ? r : { hedef: 30, gunler: {} };
}
if (kayit.koltukIpucu) A.koltukIpucu = true;
function depoYaz() {
  if (store.sifirlaniyor) return;   // "Her şeyi temizle" sonrası yenilenirken
  try {
    localStorage.setItem(DEPO, JSON.stringify({
      okumaHizi: A.okumaHizi, sayfaHizi: A.sayfaHizi, okumaRitmi: A.okumaRitmi, koltukIpucu: !!A.koltukIpucu,
    }));
  } catch { /* gizli pencere */ }
}
addEventListener("pagehide", depoYaz);

// ---------- okuma hızı ----------
const hizDizisi = (birim) => (birim === "sayfa" ? A.sayfaHizi : A.okumaHizi);
export const OLCUM_ESIGI = 8;
// Medyan: tek tük hızlı çevirme ya da dalıp gitme sonucu bozmaz. 8 ölçümden önce sayı uydurulmaz.
export function hiz(birim = "kelime") {
  const d = hizDizisi(birim);
  if (d.length < OLCUM_ESIGI) return null;
  const s = [...d].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// Sayılar Plex Mono (<b>), birimler arayüz yazısıyla
export function sureHtml(miktar, birim = "kelime") {
  const v = hiz(birim);
  if (!v) return null;
  const dk = Math.max(1, Math.round(miktar / v / 60));
  return dk < 60 ? `<b>${dk}</b> dk` : `<b>${Math.floor(dk / 60)}</b> sa <b>${dk % 60}</b> dk`;
}

// ---------- okuma ritmi ----------
const gunAnahtari = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
const GUN_KISA = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
const GUN_UZUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const bugunSn = () => A.okumaRitmi.gunler[gunAnahtari()] || 0;
function ritimEkle(sn) {
  const g = A.okumaRitmi.gunler, k = gunAnahtari();
  g[k] = (g[k] || 0) + sn;
  const anahtarlar = Object.keys(g);
  if (anahtarlar.length > 40) for (const x of anahtarlar.sort().slice(0, anahtarlar.length - 40)) delete g[x];
}

// ---------- mod anahtarı: Koltuk ve Masa'da aynı yerde, aynı biçimde (TASARIM-2 §2.3) ----------
export function modAnahtari(mod, sec) {
  const el = h("div", { class: "mod-anahtari", role: "group", "aria-label": "Görünüm", dataset: { mod } });
  const dugme = (m, ad, ik, aciklama) => h("button", {
    type: "button", "data-m": m, "aria-pressed": String(m === mod), "aria-label": aciklama, title: aciklama,
    onclick: () => { if (el.dataset.mod !== m) sec(m); },
  }, icon(ik), h("span", {}, ad));
  el.append(dugme("koltuk", "Koltuk", "koltuk", "Koltuk: sade okuma"), dugme("masa", "Masa", "masa", "Masa: çalışma araçları"));
  el.ayarla = (m) => {
    el.dataset.mod = m;
    for (const b of el.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.m === m));
  };
  return el;
}

// ---------- koltuk ----------
export function koltukKur(kok, s) {
  const iptal = new AbortController(), sinyal = { signal: iptal.signal };
  const sahne = s.sahne || kok;
  const birim = s.tur === "pdf" ? "sayfa" : "kelime";
  const zamanlar = new Set();
  const zamanla = (fn, ms) => { const z = setTimeout(() => { zamanlar.delete(z); fn(); }, ms); zamanlar.add(z); return z; };
  const iptalEt = (z) => { clearTimeout(z); zamanlar.delete(z); };
  const el = {};
  let gorunur = false, cekZ = 0, oturdu = false, fis = null, surukle = null;
  let aktifSn = 0, sonTik = performance.now(), sonEtkilesim = Date.now(), sonDk = -1, depoZ = 0;

  // Üst çubuk (4.2): Geri, ad, boşluk, ritim, araçlar, mod anahtarı
  el.ritimYay = h("i", { "aria-hidden": "true" });
  el.ritimDk = h("span", { class: "olcum" });
  el.ritim = h("button", { type: "button", class: "ritim", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: () => ritimFisi() }, el.ritimYay, el.ritimDk);
  el.ad = h("span", { class: "ad" }, s.ad || "");
  el.anahtar = modAnahtari("koltuk", (m) => s.modDegistir?.(m));
  el.ust = h("header", { class: "koltuk-ust" },
    h("button", { type: "button", class: "ikon-dugme", "aria-label": "Kitaplığa dön", onclick: () => (s.geri ? s.geri() : bus.emit("git", { ekran: "kitaplik" })) }, icon("geri", "i-22")),
    el.ad, el.ritim, ...(s.araclar || []), el.anahtar);

  // Alt çubuk (4.3): ölçüm uçları ve sürgülü cetvel
  el.sol = h("span", { class: "sol olcum" });
  el.sag = h("span", { class: "sag olcum" });
  el.etiket = h("span", { class: "cetvel-etiket cam cam-k" });
  el.iz = h("div", { class: "cetvel-iz" }, h("i", { class: "cetvel-imlec" }), el.etiket);
  el.dolu = h("i", { class: "cetvel-dolu" });
  el.cetvel = h("div", {
    class: "koltuk-cetvel", role: "slider", tabindex: "0", "aria-label": s.tur === "pdf" ? "Belgede konum" : "Kitapta konum",
    "aria-valuemin": "0", "aria-valuemax": "100",
  },
  ...(s.bolumler || []).filter((b) => b.oran > 0.001).map((b) => h("i", { class: "cetvel-bolum", style: `left:${(b.oran * 100).toFixed(3)}%`, title: b.ad })),
  ...(s.yerImleri || []).map((o) => h("i", { class: "cetvel-yer-imi", style: `left:${(o * 100).toFixed(3)}%` })),
  el.dolu, el.iz);
  el.alt = h("div", { class: "koltuk-alt" }, el.sol, el.sag, el.cetvel);
  el.cizgi = h("div", { class: "koltuk-cizgi", "aria-hidden": "true" }, h("i"));

  // Gizli kalem (4.9)
  el.kalemUcu = h("button", { type: "button", class: "kalem-ucu", "aria-label": "Kalemle yaz", "aria-pressed": "false", onclick: () => kalemAc(el.kalemUcu.getAttribute("aria-pressed") !== "true") }, icon("kalem-ucu"));

  const ucVar = s.kalemUcu !== false;
  kok.append(el.cizgi, el.ust, el.alt);
  if (ucVar) kok.append(el.kalemUcu);

  // İlk açılışta bölgeler bir kez gösterilir (4.1.4)
  if (!A.koltukIpucu) {
    el.ipucu = h("div", { class: "koltuk-ipucu", "aria-hidden": "true" }, h("span", {}, "geri"), h("span", {}, "çubuklar"), h("span", {}, "ileri"));
    kok.append(el.ipucu);
    zamanla(() => { el.ipucu?.remove(); el.ipucu = null; }, 2400);
    A.koltukIpucu = true;
    ayarla({ koltukIpucu: true });
    depoYaz();
  }

  // ---------- çubuklar ----------
  const odakIcerde = () => el.ust.contains(document.activeElement) || el.alt.contains(document.activeElement) || (fis && fis.contains(document.activeElement));
  const tutuluyor = () => !!(fis || surukle || odakIcerde() || s.mesgul?.());
  function cubuk(goster) {
    gorunur = goster;
    kok.classList.toggle("cubuk-gorunur", goster);
    iptalEt(cekZ);
    if (!goster) { fisKapat(); return; }
    guncelle();
    if (!oturdu) {   // 9.1: oturumda ilk açılışta imleç camı soldan yerine kayar
      oturdu = true;
      if (!hareketAz()) {
        el.iz.classList.remove("kayiyor");
        el.iz.style.setProperty("--p", "0");
        void el.iz.offsetWidth;
        requestAnimationFrame(() => {
          el.iz.classList.add("kayiyor");
          el.iz.style.removeProperty("--p");
          zamanla(() => el.iz.classList.remove("kayiyor"), 460);
        });
      }
    }
    cekmeyiKur();
  }
  // 4 sn etkileşim yoksa çekilir; odak içerideyse, balon ya da fiş açıksa bekler
  function cekmeyiKur() {
    iptalEt(cekZ);
    cekZ = zamanla(() => { if (!gorunur) return; if (tutuluyor()) cekmeyiKur(); else cubuk(false); }, 4000);
  }
  for (const b of [el.ust, el.alt]) {
    b.addEventListener("pointerdown", () => { if (gorunur) cekmeyiKur(); }, sinyal);
    b.addEventListener("focusin", () => { if (!gorunur) cubuk(true); }, sinyal);
  }

  // ---------- dokunma bölgeleri (4.1) ----------
  let bas = null, fareZ = 0, sonKalem = -1e9, kalemBasili = 0;
  addEventListener("pointerdown", (e) => {
    sonEtkilesim = Date.now();
    // Avuç içi reddi: kalem yazarken, kalemden hemen sonra ya da geniş temasta dokunuş sayılmaz
    if (e.pointerType === "pen") { sonKalem = performance.now(); kalemBasili++; }
    else if (e.pointerType === "touch" && (kalemBasili > 0 || performance.now() - sonKalem < 400 || (e.width > 44 && e.height > 44))) {
      if (bas) bas.gecersiz = true;
      return;
    }
    if (fis && !fis.contains(e.target) && !el.ritim.contains(e.target)) { fisKapat(); bas = null; return; }
    if (!sahne.contains(e.target) || !e.isPrimary) { bas = null; return; }
    if (e.pointerType === "mouse" && e.button !== 0) { bas = null; return; }
    iptalEt(fareZ);
    const sec = document.getSelection();
    // Pencere yakalamasında, ekranın kendi "dışarı dokununca kapat" işinden önce bakılır
    bas = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), tur: e.pointerType,
      gecersiz: !!(s.mesgul?.() || (sec && !sec.isCollapsed)) };
  }, { capture: true, ...sinyal });
  const kalemBirak = (e) => { if (e.pointerType === "pen") { sonKalem = performance.now(); kalemBasili = Math.max(0, kalemBasili - 1); } };
  addEventListener("pointerup", kalemBirak, { capture: true, ...sinyal });
  addEventListener("pointercancel", kalemBirak, { capture: true, ...sinyal });
  addEventListener("pointerup", (e) => {
    const b = bas;
    if (!b || e.pointerId !== b.id) return;
    bas = null;
    if (b.gecersiz || !(e.target instanceof Node) || !sahne.contains(e.target)) return;
    if (Math.hypot(e.clientX - b.x, e.clientY - b.y) >= 10 || performance.now() - b.t >= 300) return;
    if (b.tur === "pen" && kalemAcik()) return;
    if (e.target.closest?.("a, button, input, textarea, select, label, mark, [contenteditable], .kenar-notu, .kenar-asistan, [data-dokunma-yok]")) return;
    if (s.dokunmaGecerli && s.dokunmaGecerli(e) === false) return;
    const R = sahne.getBoundingClientRect(), x = (e.clientX - R.left) / Math.max(1, R.width);
    const calistir = () => {
      if (x < 0.25) { if (gorunur) cubuk(false); s.cevir?.(-1); }
      else if (x > 0.75) { if (gorunur) cubuk(false); s.cevir?.(1); }
      else cubuk(!gorunur);
    };
    // Farede çift tıklama kelime seçer: tek tıklama biraz bekler
    if (b.tur === "mouse") fareZ = zamanla(() => { const sc = document.getSelection(); if (!sc || sc.isCollapsed) calistir(); }, 230);
    else calistir();
  }, { capture: true, ...sinyal });
  addEventListener("dblclick", () => iptalEt(fareZ), sinyal);
  addEventListener("pointercancel", (e) => { if (bas && e.pointerId === bas.id) bas = null; }, sinyal);
  for (const ad of ["keydown", "wheel"]) addEventListener(ad, () => { sonEtkilesim = Date.now(); }, { passive: true, ...sinyal });
  sahne.addEventListener("scroll", () => { sonEtkilesim = Date.now(); }, { passive: true, capture: true, ...sinyal });

  // ---------- sürgülü cetvel ----------
  const cetvelOrani = (e) => { const R = el.cetvel.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - R.left) / Math.max(1, R.width))); };
  function surukleGoster(oran) {
    el.iz.classList.remove("kayiyor");
    el.iz.style.setProperty("--p", oran.toFixed(4));
    el.etiket.textContent = s.etiket ? s.etiket(oran) : "%" + Math.round(oran * 100);
  }
  el.cetvel.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { el.cetvel.setPointerCapture(e.pointerId); } catch { /* bırakılmış işaretçi */ }
    surukle = { id: e.pointerId, oran: cetvelOrani(e) };
    el.cetvel.classList.add("suruklen");
    surukleGoster(surukle.oran);
  }, sinyal);
  el.cetvel.addEventListener("pointermove", (e) => {
    if (!surukle || e.pointerId !== surukle.id) return;
    surukle.oran = cetvelOrani(e);
    surukleGoster(surukle.oran);
  }, sinyal);
  const birak = (e) => {
    if (!surukle || e.pointerId !== surukle.id) return;
    const oran = surukle.oran;
    surukle = null;
    el.cetvel.classList.remove("suruklen");
    if (e.type === "pointerup") {
      el.cetvel.style.setProperty("--p", oran.toFixed(4));   // gidilen yer beklemeden görünsün
      s.git?.(oran);
      sifirla();
    }
    el.iz.style.removeProperty("--p");
    cekmeyiKur();
  };
  el.cetvel.addEventListener("pointerup", birak, sinyal);
  el.cetvel.addEventListener("pointercancel", birak, sinyal);
  el.cetvel.addEventListener("keydown", (e) => {
    const adim = { ArrowRight: 0.01, ArrowUp: 0.01, ArrowLeft: -0.01, ArrowDown: -0.01, PageUp: 0.1, PageDown: -0.1 }[e.key];
    const uc = { Home: 0, End: 1 }[e.key];
    if (adim == null && uc == null) return;
    e.preventDefault();
    e.stopPropagation();
    const k = s.konum?.() || { oran: 0 };
    s.git?.(uc != null ? uc : Math.min(1, Math.max(0, k.oran + adim)));
    sifirla();
    cekmeyiKur();
  }, sinyal);

  // ---------- gizli kalem ----------
  let ucZ = 0;
  const kalemAcik = () => el.kalemUcu.getAttribute("aria-pressed") === "true";
  function kalemAc(acik) {
    el.kalemUcu.setAttribute("aria-pressed", String(acik));
    el.kalemUcu.setAttribute("aria-label", acik ? "Kalemi kapat" : "Kalemle yaz");
    el.kalemUcu.classList.add("gorunur");
    s.kalem?.(acik);
    iptalEt(ucZ);
    if (!acik) ucZ = zamanla(() => { if (!kalemAcik()) el.kalemUcu.classList.remove("gorunur"); }, 1500);
  }
  kok.addEventListener("pointermove", (e) => {
    if (!ucVar || e.pointerType !== "pen" || e.buttons !== 0) return;
    el.kalemUcu.classList.add("gorunur");
    iptalEt(ucZ);
    ucZ = zamanla(() => { if (!kalemAcik()) el.kalemUcu.classList.remove("gorunur"); }, 1500);
  }, { passive: true, ...sinyal });

  // ---------- ritim fişi (4.5) ----------
  function ritimFisi() {
    if (fis) return fisKapat();
    const r = A.okumaRitmi, bugun = new Date();
    const gunler = Array.from({ length: 7 }, (_, i) => {
      const t = new Date(bugun); t.setDate(bugun.getDate() - 6 + i);
      return { t, dk: Math.floor((r.gunler[gunAnahtari(t)] || 0) / 60), bugun: i === 6 };
    });
    const tepe = Math.max(r.hedef, ...gunler.map((g) => g.dk), 1);
    const govde = h("div", { class: "fis ritim-fis", role: "dialog", "aria-label": "Okuma ritmi" });
    const ciz = () => {
      const dk = Math.floor(bugunSn() / 60);
      govde.replaceChildren(
        h("p", { class: "ritim-ozet olcum" }, ...htmlParca(`Bugün <b>${dk}</b> dk okudun · Hedef <b>${r.hedef}</b> dk`)),
        h("div", { class: "ritim-gunler", role: "img", "aria-label": "Son yedi gün: " + gunler.map((g) => `${GUN_UZUN[g.t.getDay()]} ${g.dk} dakika`).join(", ") },
          ...gunler.map((g) => h("span", { class: "ritim-gun" + (g.bugun ? " bugun" : "") },
            h("small", { class: "ritim-sayi" }, String(g.dk)),
            h("span", { class: "ritim-cubuk" }, h("i", { style: `--o:${Math.min(1, g.dk / tepe).toFixed(3)}` })),
            h("small", {}, GUN_KISA[g.t.getDay()])))),
        h("span", { class: "t-etiket" }, "Günlük hedef"),
        h("div", { class: "parcali", role: "group", "aria-label": "Günlük hedef" }, ...[15, 30, 45, 60].map((d) => h("button", {
          type: "button", "aria-pressed": String(r.hedef === d),
          onclick: () => { r.hedef = d; depoYaz(); ritimGuncelle(true); ciz(); },
        }, `${d} dk`))));
    };
    ciz();
    fis = govde;
    kok.append(govde);
    el.ritim.setAttribute("aria-expanded", "true");
    const kR = kok.getBoundingClientRect(), dR = el.ritim.getBoundingClientRect();
    govde.style.left = Math.min(Math.max(8, dR.left + dR.width / 2 - kR.left - govde.offsetWidth / 2), kR.width - govde.offsetWidth - 8) + "px";
    govde.style.top = dR.bottom - kR.top + 6 + "px";
  }
  function fisKapat() {
    if (!fis) return;
    fis.remove();
    fis = null;
    el.ritim.setAttribute("aria-expanded", "false");
    if (gorunur) cekmeyiKur();
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && fis) { e.stopImmediatePropagation(); fisKapat(); el.ritim.focus(); } }, { capture: true, ...sinyal });

  function ritimGuncelle(zorla = false) {
    const dk = Math.floor(bugunSn() / 60), hedef = A.okumaRitmi.hedef || 30;
    if (!zorla && dk === sonDk) return;
    sonDk = dk;
    el.ritim.hidden = dk < 1;   // ilk dakika dolmadan "0 dk" halkası gösterilmez
    el.ritimYay.style.setProperty("--oran", Math.min(1, dk / hedef).toFixed(3));
    el.ritimDk.innerHTML = `<b>${dk}</b> dk`;
    if (dk >= hedef) el.ritim.dataset.tamam = ""; else delete el.ritim.dataset.tamam;
    el.ritim.setAttribute("aria-label", `Okuma ritmi: bugün ${dk} dakika, hedef ${hedef} dakika`);
  }

  // ---------- saat: ölçüm ve ritim yalnız ekran görünürken ilerler ----------
  const tik = setInterval(() => {
    const t = performance.now(), dt = Math.min(2, (t - sonTik) / 1000);
    sonTik = t;
    if (document.hidden) return;
    if (!s.mesgul?.() && !fis) aktifSn += dt;
    if (Date.now() - sonEtkilesim < 120e3) {   // son dokunuştan beri 2 dakikadan az geçtiyse okunuyor sayılır
      ritimEkle(dt);
      ritimGuncelle();
    }
    iptalEt(depoZ);
    depoZ = zamanla(depoYaz, 15e3);
  }, 1000);
  document.addEventListener("visibilitychange", () => { sonTik = performance.now(); if (document.hidden) depoYaz(); }, sinyal);

  function sayfaBitti(miktar) {
    const sn = aktifSn;
    aktifSn = 0;
    if (sn < 4 || sn > 300) return;                   // hızlı çevirme ve ara verme atılır
    if (birim === "kelime" && (miktar < 30 || miktar / sn > 20)) return;
    const d = hizDizisi(birim);
    d.push(miktar / sn);
    if (d.length > 30) d.shift();
    guncelle();
  }
  function sifirla() { aktifSn = 0; }

  // ---------- görünüm ----------
  let sonSol = "", sonSag = "";
  function guncelle() {
    const k = s.konum?.();
    if (!k) return;
    const p = Math.min(1, Math.max(0, k.oran || 0));
    el.cetvel.style.setProperty("--p", p.toFixed(4));
    el.cizgi.style.setProperty("--p", p.toFixed(4));
    el.cetvel.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    el.cetvel.setAttribute("aria-valuetext", s.etiket ? s.etiket(p) : "%" + Math.round(p * 100));
    if (!gorunur && !surukle) return;   // yazılar yalnız çubuk açıkken
    // Kalan süre okuma hızı ölçülene kadar (OLCUM_ESIGI sayfa) hiç yazılmaz: "0 dk" ya da "ölçülüyor 0/8" görünmez
    let sol, sag;
    if (s.tur === "pdf") {
      sol = `s. <b>${k.sayfa || 1}</b> / ${k.sayfaSayisi || 1}`;
      const sure = sureHtml(Math.max(0, (k.sayfaSayisi || 1) - (k.sayfa || 1) + 1), "sayfa");
      sag = sure ? `Belge sonuna ${sure}` : "";
    } else {
      const b = sureHtml(Math.max(0, k.kelimeKalanBolum || 0)), t = sureHtml(Math.max(0, k.kelimeKalanKitap || 0));
      sol = b ? `Bölüm sonuna ${b}` : "";
      sag = t ? `Kitapta ${t}` : `Kitapta <b>%${Math.round(p * 100)}</b>`;
    }
    if (sol !== sonSol) { el.sol.innerHTML = sol; sonSol = sol; }
    if (sag !== sonSag) { el.sag.innerHTML = sag; sonSag = sag; }
  }
  ritimGuncelle(true);

  function kapat() {
    depoYaz();
    clearInterval(tik);
    iptal.abort();
    for (const z of zamanlar) clearTimeout(z);
    zamanlar.clear();
    fisKapat();
    if (kalemAcik()) s.kalem?.(false);
    for (const x of [el.cizgi, el.ust, el.alt, el.kalemUcu, el.ipucu]) x?.remove();
    kok.classList.remove("cubuk-gorunur");
  }

  return {
    el, guncelle, sayfaBitti, sifirla, cubuk, kapat,
    gorunur: () => gorunur,
    kalemAcik,
    kalemKapat: () => { if (kalemAcik()) kalemAc(false); },
  };
}

// Güvenilir, sabit HTML parçasını düğümlere çevirir (yalnız bu dosyanın ürettiği metin için)
function htmlParca(html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  return [...t.content.childNodes];
}
