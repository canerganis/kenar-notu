// Alt çekmece (TASARIM-4 2.5): telefonda ve iPad dikeyde paneller ve uzun menüler bu bileşenle açılır.
// Kullanan: kabuk (Ayarlar, alıntı kartı), Koltuk (Aa, İçindekiler, Notlar), Masa (⋯, kalem ucu, asistan).
//
//   altCekmece({ baslik, govde, duraklar: ["yarim", "tam"], ilk: "yarim", modal: true, sinif, acan, kapaninca })
//     -> { kok, govde, durak(ad), kapat(hemen) }
//   cekmeceMi()  -> bu ekran boyutunda çekmece mi kullanılmalı (geniş ekranda sahip kendi panelini ya da fişini açar)
//
// Duraklar: "yarim" (ekranın yarısı), "tam" (üstte 8 px kalır), "icerik" (içerik kadar, en çok tam).
// Hareket yalnız transform: çekmece hep tam yükseklikte, durak translateY ile seçilir.
// Kapanış: perde, Escape, kapat düğmesi, Android geri hareketi (geçmişe bir adım itilir), aşağı fırlatma.

import { h, icon, odakla, hareketAz } from "./ortak.js";

const CEKMECE_MEDYA = matchMedia("(max-width: 599px), (max-width: 999px) and (orientation: portrait)");
export const cekmeceMi = () => CEKMECE_MEDYA.matches;

// Çekmecenin kendi geçmiş adımı geri alınırken app.js popstate'i yok sayar
let yutulacak = 0;
export const gecmisYut = () => { if (yutulacak > 0) { yutulacak--; return true; } return false; };

const acikCekmeceler = [];
let sayac = 0;

export function altCekmece({ baslik = "", govde, duraklar = ["yarim", "tam"], ilk, modal = true, sinif = "", acan = document.activeElement, kapaninca } = {}) {
  const id = "cekmece-" + (++sayac);
  const baslikEl = h("h2", { id: id + "-b", tabindex: "-1" }, baslik);
  const kapatD = h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat" }, icon("kapat"));
  const tutamak = h("div", { class: "cekmece-tutamak", role: "button", tabindex: "0", "aria-label": "Çekmeceyi büyüt" });
  const bas = h("header", { class: "cekmece-bas" }, baslikEl, kapatD);
  const govdeEl = h("div", { class: "cekmece-govde" });
  if (govde) govdeEl.append(...[govde].flat().filter(Boolean));
  const kok = h("div", { class: `alt-cekmece ${sinif}`.trim(), role: "dialog", "aria-modal": modal ? "true" : null, "aria-labelledby": baslikEl.id },
    tutamak, bas, govdeEl);
  const perde = h("div", { class: "alt-cekmece-perde", "aria-hidden": "true" });
  let durakAd = duraklar.includes(ilk) ? ilk : duraklar[0];
  let kapandi = false;

  const yuk = () => kok.getBoundingClientRect().height || innerHeight;
  const durakKonum = (ad) => {
    // translateY değeri (px): 0 tam açık; yükseklik - durak
    const H = yuk();
    if (ad === "tam") return 0;
    if (ad === "icerik") {
      const icerik = tutamak.offsetHeight + bas.offsetHeight + govdeEl.scrollHeight;
      return Math.max(0, H - Math.min(H, icerik));
    }
    return Math.max(0, H - innerHeight * 0.5);
  };
  const durak = (ad) => {
    if (!duraklar.includes(ad)) return;
    durakAd = ad;
    kok.dataset.durak = ad;
    perde.dataset.durak = ad;
    if (ad === "icerik") kok.style.setProperty("--icerik-yuk", `${yuk() - durakKonum("icerik")}px`);
    kok.style.setProperty("--surukle", "0px");
    tutamak.setAttribute("aria-label", ad === "tam" ? "Çekmeceyi küçült" : "Çekmeceyi büyüt");
  };

  // Modal: uygulamanın geri kalanı inert
  const inertler = [];
  if (modal) {
    for (const el of document.body.children) {
      if (el === kok || el === perde || el.inert || el.tagName === "SCRIPT" || el.matches("#bildirimler")) continue;
      el.inert = true;
      inertler.push(el);
    }
  }

  /* ---------- sürükleme (tutamak ve başlık) ---------- */
  let surukle = null, tikYut = false;   // sürüklemeden sonra gelen click dokunuş sayılmaz
  const basla = (y) => { surukle = { y0: y, bas: durakKonum(durakAd), izler: [[performance.now(), y]] }; kok.classList.add("suruklen"); };
  const tasi = (y) => {
    if (!surukle) return;
    let dy = y - surukle.y0;
    const hedef = surukle.bas + dy;
    if (hedef < 0) dy = -surukle.bas + hedef * 0.35;   // en üst durağın ötesinde direnç
    kok.style.setProperty("--surukle", `${dy}px`);
    surukle.dy = dy;
    surukle.izler.push([performance.now(), y]);
    if (surukle.izler.length > 8) surukle.izler.shift();
  };
  const birak = () => {
    if (!surukle) return;
    kok.classList.remove("suruklen");
    const { izler, bas: b0, dy = 0 } = surukle;
    surukle = null;
    tikYut = Math.abs(dy) > 6;
    const son = izler[izler.length - 1], ilkIz = izler.find((x) => son[0] - x[0] <= 80) || izler[0];
    const hiz = son[0] > ilkIz[0] ? (son[1] - ilkIz[1]) / (son[0] - ilkIz[0]) : 0;   // px/ms, aşağı artı
    const sirali = duraklar.map((ad) => [ad, durakKonum(ad)]).sort((a, c) => c[1] - a[1]);   // alttan üste
    const konum = b0 + dy;
    const simdiki = sirali.findIndex(([ad]) => ad === durakAd);
    if (hiz > 0.5) {
      if (simdiki <= 0) return kapat(); else return durak(sirali[simdiki - 1][0]);
    }
    if (hiz < -0.5) return durak(sirali[Math.min(sirali.length - 1, simdiki + 1)][0]);
    // En alt durağın yarısından aşağıda bırakılırsa kapanır
    const en = sirali[0][1], H = yuk();
    if (konum > en + (H - en) / 2) return kapat();
    let yakin = sirali[0];
    for (const d of sirali) if (Math.abs(d[1] - konum) < Math.abs(yakin[1] - konum)) yakin = d;
    durak(yakin[0]);
  };
  for (const el of [tutamak, bas]) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* yapay olay */ }
      tikYut = false;
      basla(e.clientY);
    });
    el.addEventListener("pointermove", (e) => { if (surukle) tasi(e.clientY); });
    el.addEventListener("pointerup", birak);
    el.addEventListener("pointercancel", birak);
  }
  tutamak.addEventListener("click", () => {
    if (tikYut) { tikYut = false; return; }
    if (surukle) return;
    const sira = duraklar.filter((d) => d !== "icerik");
    durak(sira[(sira.indexOf(durakAd) + 1) % sira.length] || durakAd);
  });
  tutamak.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tutamak.click(); } });

  /* ---------- gövde: yarım durakta yukarı kaydırma önce çekmeceyi büyütür ---------- */
  let dokunY = null, govdeSurukle = false;
  govdeEl.addEventListener("touchstart", (e) => { dokunY = e.touches[0].clientY; govdeSurukle = false; }, { passive: true });
  govdeEl.addEventListener("touchmove", (e) => {
    if (dokunY == null) return;
    const y = e.touches[0].clientY, dy = y - dokunY;
    if (durakAd !== "tam" && duraklar.includes("tam") && dy < -8) { dokunY = null; durak("tam"); return; }
    if (durakAd === "tam" && govdeEl.scrollTop <= 0 && dy > 6) {
      if (!govdeSurukle) { govdeSurukle = true; basla(dokunY); }
      if (e.cancelable) e.preventDefault();
      tasi(y);
    }
  }, { passive: false });
  const dokunBitti = () => { dokunY = null; if (govdeSurukle) { govdeSurukle = false; birak(); } };
  govdeEl.addEventListener("touchend", dokunBitti);
  govdeEl.addEventListener("touchcancel", dokunBitti);
  govdeEl.addEventListener("wheel", (e) => { if (durakAd !== "tam" && duraklar.includes("tam") && e.deltaY > 0) durak("tam"); }, { passive: true });
  // Klavye açılırken girdi görünür kalsın
  govdeEl.addEventListener("focusin", (e) => {
    if (!e.target.matches?.("input, textarea, [contenteditable]")) return;
    if (duraklar.includes("tam")) durak("tam");
    setTimeout(() => e.target.scrollIntoView?.({ block: "nearest" }), 260);
  });

  /* ---------- kapanış ---------- */
  const tus = (e) => {
    if (e.key !== "Escape" || acikCekmeceler[acikCekmeceler.length - 1] !== kayit) return;
    if (document.querySelector("dialog[open]")) return;
    e.preventDefault(); e.stopPropagation();
    kapat();
  };
  const geri = () => { if (history.state?.cekmece !== id) kapat(true, true); };
  function kapat(hemen = false, gecmistenGeldi = false) {
    if (kapandi) return;
    kapandi = true;
    document.removeEventListener("keydown", tus, true);
    removeEventListener("popstate", geri);
    const i = acikCekmeceler.indexOf(kayit);
    if (i >= 0) acikCekmeceler.splice(i, 1);
    for (const el of inertler) el.inert = false;
    if (!gecmistenGeldi && history.state?.cekmece === id) { yutulacak++; history.back(); }
    try { kapaninca?.(); } catch (hata) { console.warn("[kenar-notu] çekmece kapanırken:", hata); }
    const odakIcerde = kok.contains(document.activeElement);
    const sok = () => { kok.remove(); perde.remove(); };
    if (hemen || hareketAz()) sok();
    else {
      kok.classList.add("cikis"); perde.classList.add("cikis");
      setTimeout(sok, 260);
    }
    if (odakIcerde && acan?.isConnected) acan.focus?.({ preventScroll: true });
  }
  perde.addEventListener("click", () => kapat());
  kapatD.addEventListener("click", () => kapat());
  document.addEventListener("keydown", tus, true);

  const kayit = { kok, govde: govdeEl, baslik: baslikEl, durak, kapat, get durakAd() { return durakAd; } };
  acikCekmeceler.push(kayit);
  kok.classList.add("giris"); perde.classList.add("giris");
  document.body.append(perde, kok);
  durak(durakAd);
  // Bir kare sonra giriş sınıfı kalkar: Safari 17.0'da @starting-style yok
  requestAnimationFrame(() => requestAnimationFrame(() => { kok.classList.remove("giris"); perde.classList.remove("giris"); if (durakAd === "icerik") durak("icerik"); }));
  // Android geri hareketi çekmeceyi kapatır
  const st = history.state || {};
  const adim = (st.adim ?? (st.itildi ? 1 : 0)) + 1;
  history.pushState({ ...st, cekmece: id, itildi: true, adim }, "", location.href);
  addEventListener("popstate", geri);
  odakla(baslikEl);
  return kayit;
}

// Açık çekmecelerin hepsi (ekran değişirken). Dönen söz çekmecenin geçmiş adımı geri alınınca çözülür:
// ekran değiştiren kod ondan sonra geçmişe yazar, yoksa geri alma yeni adımı silerdi.
export function cekmeceleriKapat() {
  const bekle = history.state?.cekmece
    ? new Promise((coz) => { const f = () => { removeEventListener("popstate", f); coz(); }; addEventListener("popstate", f); setTimeout(f, 400); })
    : Promise.resolve();
  for (const c of [...acikCekmeceler]) c.kapat(true);
  return bekle;
}
export const cekmeceAcik = () => acikCekmeceler.length > 0;
