// Kenar Notu: sesli okuma (TASARIM-5 11.3 C5). Tarayıcının kendi sesleriyle (speechSynthesis), çevrimdışı da çalışır
// (yerel ses kuruluysa). Metin cümle cümle okunur; okunan cümleyi kaynak sayfada sakin bir alt çizgiyle belirtir.
//
// sesliOkumaKur(kaynak) -> denetim { oynat(), duraklat(), degistir(), sonraki(), onceki(), kapat(), okuyor(), acik() }
// kaynak (bağdaştırıcı; EPUB'unki okuma.js'te, PDF'inki pdfKaynagi ile):
//   kok          şeridin ekleneceği öğe (okuma ekranı)
//   dil()        belgenin dili ("tr", "en-US"); bilinmiyorsa ""
//   ad()         { baslik, bolum } kilit ekranı (MediaSession) için
//   baslangic()  okunacak ilk yer: kaynağın kendi konum nesnesi (EPUB: paragraf ve oran; PDF: sayfa)
//   parca(konum) -> Promise<{ cumleler: [{ metin, ... }], sonraki: konum | null }>  sıradaki cümleler
//   isaretle(cumle | null, { kelime? })  okunan cümle (ve okunan kelimenin ofseti) sayfada; taşınca sayfayı çevirir
//   bitti()      okuma sona erdi (isteğe bağlı)
//   degisti()    durum değişti: oynuyor ya da durdu (uyanık kilidi, düğme durumu)
// Ayarlar store.ayarlar'da: okumaSesHiz (0,75 ile 2), okumaSes (voiceURI).
// Okurken ekran uyanık kalır (Wake Lock), sekme gizlenince ve kapanınca durur. MediaSession ile kilit ekranından duraklatılır.
// sesDurumu() -> "var" | "yok" | "bekliyor": düğmeyi devre dışı bırakmak için ("Bu cihazda okuma sesi yok").

import { h, icon, store, ayarla, toast, hareketAz } from "./ortak.js";
import * as ortak from "./ortak.js";
import { t, dil as arayuzDili, yerel, ingilizceMi } from "./dil.js";

// ---------- simgeler (TASARIM-5 10.4: kendi dosyasından, ikili ton için kapalı şekil class="d") ----------
const simge = typeof ortak.simgeEkle === "function" ? ortak.simgeEkle : () => {};
simge("sesli-oku", '<path class="d" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>');
simge("duraklat", '<rect class="d" x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect class="d" x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.5"/>');
simge("oynat-dolu", '<path class="d" d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>');
simge("cumle-geri", '<path d="M6 5.5v13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="d" d="M18.5 6.2v11.6a.7.7 0 0 1-1.1.6L9.6 12.6a.7.7 0 0 1 0-1.2l7.8-5.8a.7.7 0 0 1 1.1.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>');
simge("cumle-ileri", '<path d="M18 5.5v13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="d" d="M5.5 6.2v11.6a.7.7 0 0 0 1.1.6l7.8-5.8a.7.7 0 0 0 0-1.2L6.6 5.6a.7.7 0 0 0-1.1.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>');

// index.html bağlamadıysa stil dosyası (okuma.css şeridin stilini taşır; PDF'te de yüklü olsun diye)
if (!document.querySelector('link[href$="okuma.css"]') && document.querySelector('link[href$="tasarim.css"]')) {
  document.head.append(h("link", { rel: "stylesheet", href: new URL("./okuma.css", import.meta.url).href }));
}

export const HIZLAR = [0.75, 1, 1.25, 1.5, 1.75, 2];
const sentez = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);
const kisaDil = (d) => String(d || "").toLowerCase().split(/[-_]/)[0];
const hizAl = () => { const v = Number(store.ayarlar.okumaSesHiz); return HIZLAR.includes(v) ? v : 1; };
const hizMetni = (v) => v.toLocaleString(yerel, { maximumFractionDigits: 2 }) + "×";
const DIL_ADI = { tr: "Türkçe", en: "İngilizce", de: "Almanca", fr: "Fransızca", es: "İspanyolca", it: "İtalyanca", ru: "Rusça", ar: "Arapça", ja: "Japonca", zh: "Çince", pt: "Portekizce", nl: "Felemenkçe", el: "Yunanca", fa: "Farsça", ko: "Korece" };
// İngilizce arayüzde dil adları tarayıcıdan (Intl.DisplayNames), yoksa kodun büyük harfi
let enAdlar = null;
const enDilAdi = (k) => { try { return (enAdlar ||= new Intl.DisplayNames(["en"], { type: "language" })).of(k) || ""; } catch { return ""; } };
const dilAdi = (d) => (ingilizceMi && d ? enDilAdi(kisaDil(d)) || d.toUpperCase() : DIL_ADI[kisaDil(d)] || (d ? d.toUpperCase() : t("bilinmeyen dil")));

// ---------- sesler ----------
// Çevrimdışıyken yalnız cihazdaki (localService) sesler: ağ sesi seçilirse hiç ses çıkmaz.
let sesler = [], sesHazir = false;
const sesBekleyen = new Set();
function sesleriOku() {
  const s = sentez();
  if (!s) { sesler = []; sesHazir = true; return; }
  let v = [];
  try { v = s.getVoices() || []; } catch { v = []; }
  sesler = v;
  if (v.length) sesHazir = true;
  for (const f of sesBekleyen) f();
}
if (sentez()) {
  sesleriOku();
  try { sentez().addEventListener("voiceschanged", sesleriOku); } catch { try { sentez().onvoiceschanged = sesleriOku; } catch { /* yok */ } }
  // Bazı tarayıcılar voiceschanged yollamaz: kısa süre sonra hâlâ yoksa "yok" sayılır
  setTimeout(() => { sesleriOku(); sesHazir = true; for (const f of sesBekleyen) f(); }, 1800);
} else sesHazir = true;
export const kullanilabilirSesler = () => (navigator.onLine === false ? sesler.filter((x) => x.localService) : sesler);
export function sesDurumu() {
  if (!sentez()) return "yok";
  if (kullanilabilirSesler().length) return "var";
  return sesHazir ? "yok" : "bekliyor";
}
export function sesDegisince(fn) { sesBekleyen.add(fn); return () => sesBekleyen.delete(fn); }
// Belgenin dilindeki sesler önce, sonra arayüz dili (Türkçe ya da İngilizce), sonra öbürleri; aynı dilde cihazdaki ses ve varsayılan önce
export function siraliSesler(dil) {
  const d = kisaDil(dil);
  const puan = (v) => (kisaDil(v.lang) === d && d ? 0 : kisaDil(v.lang) === arayuzDili ? 1 : 2) * 4 + (v.localService ? 0 : 2) + (v.default ? 0 : 1);
  return [...kullanilabilirSesler()].sort((a, b) => puan(a) - puan(b) || a.name.localeCompare(b.name, yerel));
}
function sesSec(dil) {
  const liste = siraliSesler(dil), kayitli = store.ayarlar.okumaSes;
  return liste.find((v) => v.voiceURI === kayitli) || liste[0] || null;
}

// ---------- cümleler ----------
// Intl.Segmenter varsa dilin kurallarıyla; yoksa nokta, soru ve ünlemden (kısaltma payıyla) bölünür.
// -> [{ a, b }] metnin [a, b) aralıkları, baştaki ve sondaki boşluk dışarıda
export function cumlelereBol(metin, dil = "tr") {
  const out = [];
  const ekle = (a, b) => {
    while (a < b && /\s/.test(metin[a])) a++;
    while (b > a && /\s/.test(metin[b - 1])) b--;
    if (b > a && /[\p{L}\p{N}]/u.test(metin.slice(a, b))) out.push({ a, b });
  };
  try {
    if (typeof Intl?.Segmenter === "function") {
      const seg = new Intl.Segmenter(dil || "tr", { granularity: "sentence" });
      for (const s of seg.segment(metin)) ekle(s.index, s.index + s.segment.length);
      return birlestir(out, metin);
    }
  } catch { /* desteklenmeyen dil */ }
  const re = /[^.!?…]+(?:[.!?…]+["'”’»)]*|$)/g;
  let m;
  while ((m = re.exec(metin)) && m[0]) ekle(m.index, m.index + m[0].length);
  return birlestir(out, metin);
}
// Çok kısa parçalar (madde numarası, "s." gibi kısaltma) öncekiyle birleşir; çok uzun cümle virgülde bölünür (Chrome uzun
// söyleyişi yarıda kesebiliyor)
function birlestir(liste, metin) {
  const out = [];
  for (const c of liste) {
    const son = out[out.length - 1];
    if (son && (c.b - c.a < 4 || son.b - son.a < 4)) { son.b = c.b; continue; }
    out.push({ ...c });
  }
  const sonuc = [];
  for (const c of out) {
    if (c.b - c.a <= 260) { sonuc.push(c); continue; }
    let a = c.a;
    while (c.b - a > 260) {
      const parca = metin.slice(a, a + 260);
      const k = Math.max(parca.lastIndexOf(", "), parca.lastIndexOf("; "), parca.lastIndexOf(" "));
      const b = k > 60 ? a + k + 1 : a + 260;
      sonuc.push({ a, b });
      a = b;
      while (a < c.b && /\s/.test(metin[a])) a++;
    }
    if (a < c.b) sonuc.push({ a, b: c.b });
  }
  return sonuc;
}

// ---------- denetim ve şerit ----------
export function sesliOkumaKur(k) {
  const s = sentez();
  const D = { durum: "durdu", kuyruk: [], i: 0, sonraki: null, utt: null, no: 0, menu: null, uyari: false, bitti: false };
  const iptal = new AbortController(), sinyal = { signal: iptal.signal };

  // Şerit: önceki, oynat/duraklat, sonraki, hız ve ses, kapat (cam kapsül, okuma ekranının altında)
  const el = {};
  el.onceki = h("button", { type: "button", class: "ikon-dugme", "aria-label": t("Önceki cümle"), title: `${t("Önceki cümle")} (Shift+←)`, onclick: () => onceki() }, icon("cumle-geri"));
  el.oynat = h("button", { type: "button", class: "ikon-dugme sesli-oynat", "aria-label": t("Oynat"), title: `${t("Oynat")} (S)`, onclick: () => degistir() }, icon("oynat-dolu"));
  el.sonraki = h("button", { type: "button", class: "ikon-dugme", "aria-label": t("Sonraki cümle"), title: `${t("Sonraki cümle")} (Shift+→)`, onclick: () => sonraki() }, icon("cumle-ileri"));
  el.hiz = h("button", { type: "button", class: "sesli-hiz", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": t("Hız ve ses"), onclick: () => menuAc() }, hizMetni(hizAl()));
  el.durum = h("span", { class: "sesli-durum", role: "status", "aria-live": "polite" });
  el.kapat = h("button", { type: "button", class: "ikon-dugme", "aria-label": t("Sesli okumayı kapat"), onclick: () => kapat() }, icon("kapat"));
  el.serit = h("div", { class: "sesli-serit cam-kapsul", role: "toolbar", "aria-label": t("Sesli okuma") },
    el.onceki, el.oynat, el.sonraki, h("span", { class: "ayrac" }), el.hiz, el.durum, h("span", { class: "ayrac" }), el.kapat);
  el.serit.addEventListener("pointerdown", (e) => e.stopPropagation());   // şerit dokunuşu sayfa çevirmez
  k.kok.append(el.serit);
  if (!hareketAz()) el.serit.classList.add("giris");

  const durumYaz = () => {
    const okuyor = D.durum === "okuyor";
    el.oynat.replaceChildren(icon(okuyor ? "duraklat" : "oynat-dolu"));
    el.oynat.setAttribute("aria-label", okuyor ? t("Duraklat") : t("Oynat"));
    el.oynat.title = `${okuyor ? t("Duraklat") : t("Oynat")} (S)`;
    el.oynat.setAttribute("aria-pressed", String(okuyor));
    el.serit.classList.toggle("okuyor", okuyor);
    el.onceki.disabled = !D.kuyruk.length || D.i === 0;
    el.hiz.textContent = hizMetni(hizAl());
    if ("mediaSession" in navigator) { try { navigator.mediaSession.playbackState = okuyor ? "playing" : "paused"; } catch { /* yok */ } }
    k.degisti?.();
  };

  // ---------- konuşma ----------
  const ses = () => sesSec(k.dil?.() || "");
  function soyle() {
    const c = D.kuyruk[D.i];
    if (!c || !s) return;
    const no = ++D.no;
    const u = new SpeechSynthesisUtterance(c.metin);
    const v = ses();
    if (v) { u.voice = v; u.lang = v.lang; } else if (k.dil?.()) u.lang = k.dil();
    u.rate = hizAl();
    u.onend = () => { if (no === D.no && D.durum === "okuyor") ilerle(); };
    u.onerror = (e) => {
      if (no !== D.no || /interrupted|canceled/.test(e.error || "")) return;
      D.durum = "durdu";
      el.durum.textContent = t("Okunamadı");
      durumYaz();
    };
    // Kelime sınırı (destekleyen seste): okunan kelime sayfadan taşınca sayfa çevrilir
    u.onboundary = (e) => { if (no === D.no && e.name !== "sentence") k.isaretle?.(c, { kelime: e.charIndex }); };
    D.utt = u;
    k.isaretle?.(c, {});
    try { s.cancel(); } catch { /* yok */ }
    s.speak(u);
  }
  async function ilerle() {
    if (D.i + 1 < D.kuyruk.length) { D.i++; soyle(); durumYaz(); return; }
    if (await doldur()) { D.i++; soyle(); durumYaz(); return; }
    // Kitabın (belgenin) sonu
    D.durum = "durdu"; D.bitti = true;
    k.isaretle?.(null);
    el.durum.textContent = t("Sona gelindi");
    durumYaz();
    k.bitti?.();
  }
  // Kuyruğun sonuna sıradaki parça; yeni cümle yoksa false
  async function doldur() {
    let konum = D.sonraki;
    for (let deneme = 0; konum != null && deneme < 40; deneme++) {
      const p = await k.parca(konum);
      konum = p?.sonraki ?? null;
      if (p?.cumleler?.length) {
        // Geride en çok 20 cümle tutulur (Önceki cümle için); D.i aynı cümleyi göstermeye devam eder
        const at = Math.max(0, D.i - 20);
        if (at) D.oncekiVar = true;
        D.kuyruk = D.kuyruk.slice(at).concat(p.cumleler);
        D.i -= at;
        D.sonraki = konum;
        return true;
      }
    }
    D.sonraki = null;
    return false;
  }

  async function oynat() {
    if (!s) { toast(t("Bu tarayıcıda sesli okuma yok.")); return; }
    if (sesDurumu() === "yok") { toast(t("Bu cihazda okuma sesi yok. Sistem ayarlarından bir metin okuma sesi kurabilirsin.")); return; }
    if (!D.kuyruk.length || D.bitti) {
      D.kuyruk = []; D.i = 0; D.bitti = false; D.oncekiVar = false;
      D.sonraki = k.baslangic();
      if (!(await doldur())) { el.durum.textContent = t("Okunacak metin yok"); return; }
      // Belgenin dilinde ses yoksa bir kez uyarılır (başka dilde ses yine okur)
      const dil = kisaDil(k.dil?.() || ""), v = ses();
      if (dil && v && kisaDil(v.lang) !== dil && !D.uyari) {
        D.uyari = true;
        toast(t("Bu cihazda {dil} okuma sesi yok; {ses} sesle okunuyor.", { dil: dilAdi(dil), ses: dilAdi(v.lang) }));
      }
    }
    D.durum = "okuyor";
    el.durum.textContent = "";
    medyaKur();
    soyle();
    durumYaz();
  }
  function duraklat() {
    if (D.durum !== "okuyor") return;
    D.durum = "durdu";
    D.no++;
    try { s?.cancel(); } catch { /* yok */ }
    durumYaz();
  }
  const degistir = () => (D.durum === "okuyor" ? duraklat() : oynat());
  async function sonraki() {
    if (!D.kuyruk.length) return oynat();
    if (D.i + 1 >= D.kuyruk.length && !(await doldur())) return;
    D.i++;
    if (D.durum === "okuyor") soyle(); else k.isaretle?.(D.kuyruk[D.i], {});
    durumYaz();
  }
  function onceki() {
    if (!D.kuyruk.length || D.i === 0) return;
    D.i--;
    if (D.durum === "okuyor") soyle(); else k.isaretle?.(D.kuyruk[D.i], {});
    durumYaz();
  }
  // Hız ve ses değişince okunan cümle yeni ayarla baştan
  function yeniden() { if (D.durum === "okuyor") soyle(); durumYaz(); }

  // ---------- hız ve ses fişi ----------
  function menuKapat() {
    if (!D.menu) return;
    D.menu.remove(); D.menu = null;
    el.hiz.setAttribute("aria-expanded", "false");
  }
  function menuAc() {
    if (D.menu) return menuKapat();
    const dil = k.dil?.() || "";
    const liste = siraliSesler(dil), secili = ses();
    const belgeDili = kisaDil(dil);
    const sesSatir = (v) => h("button", { type: "button", role: "menuitemradio", class: "sesli-ses", "aria-checked": String(v === secili),
      onclick: () => { ayarla({ okumaSes: v.voiceURI }); menuKapat(); yeniden(); } },
    h("span", {}, v.name.replace(/\s*\(.*\)\s*$/, "")), h("small", {}, `${dilAdi(v.lang)}${v.localService ? "" : " · " + t("ağ")}`));
    const uyar = belgeDili && !liste.some((v) => kisaDil(v.lang) === belgeDili);
    D.menu = h("div", { class: "sesli-menu sheet", role: "dialog", "aria-label": t("Okuma hızı ve ses") },
      h("span", { class: "t-etiket" }, t("Hız")),
      h("div", { class: "cip-dizi metin-cipler", role: "group", "aria-label": t("Okuma hızı"), style: "--n:3" }, ...HIZLAR.map((x) => h("button", {
        type: "button", class: "cip", "aria-pressed": String(x === hizAl()), onclick: () => { ayarla({ okumaSesHiz: x }); menuKapat(); yeniden(); },
      }, hizMetni(x)))),
      // "Ses" başka yerde "ses kaydı" anlamında: sözlüğe girmez, burada dallanır
      h("span", { class: "t-etiket" }, ingilizceMi ? "Voice" : "Ses"),
      uyar ? h("p", { class: "sesli-uyari" }, t("Bu cihazda {dil} ses yok. Başka dildeki ses okur; sistem ayarlarından {dil} ses kurabilirsin.", { dil: dilAdi(belgeDili) })) : null,
      liste.length ? h("div", { class: "sesli-sesler", role: "menu" }, ...liste.slice(0, 40).map(sesSatir)) : h("p", { class: "sesli-uyari" }, t("Bu cihazda okuma sesi yok.")));
    k.kok.append(D.menu);
    el.hiz.setAttribute("aria-expanded", "true");
    const sR = el.serit.getBoundingClientRect(), kR = k.kok.getBoundingClientRect();
    D.menu.style.left = Math.max(8, Math.min(kR.width - D.menu.offsetWidth - 8, sR.left - kR.left + sR.width / 2 - D.menu.offsetWidth / 2)) + "px";
    D.menu.style.bottom = Math.max(8, kR.bottom - sR.top + 8) + "px";
    D.menu.querySelector('[aria-pressed="true"], [aria-checked="true"], button')?.focus({ preventScroll: true });
  }
  document.addEventListener("pointerdown", (e) => { if (D.menu && !D.menu.contains(e.target) && !el.hiz.contains(e.target)) menuKapat(); }, { capture: true, ...sinyal });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && D.menu) { e.stopImmediatePropagation(); menuKapat(); el.hiz.focus(); }
  }, { capture: true, ...sinyal });

  // ---------- kilit ekranı, sekme ----------
  function medyaKur() {
    if (!("mediaSession" in navigator)) return;
    try {
      const a = k.ad?.() || {};
      if (typeof MediaMetadata === "function") navigator.mediaSession.metadata = new MediaMetadata({ title: a.bolum || a.baslik || t("Sesli okuma"), artist: a.baslik || "", album: "Kenar Notu" });
      navigator.mediaSession.setActionHandler("play", () => oynat());
      navigator.mediaSession.setActionHandler("pause", () => duraklat());
      navigator.mediaSession.setActionHandler("stop", () => duraklat());
      navigator.mediaSession.setActionHandler("nexttrack", () => sonraki());
      navigator.mediaSession.setActionHandler("previoustrack", () => onceki());
    } catch { /* desteklenmeyen eylem */ }
  }
  // Sekme gizlenince ve sayfadan çıkınca okuma durur (sayfa çevirmesi görünmeden ilerlemesin)
  document.addEventListener("visibilitychange", () => { if (document.hidden) duraklat(); }, sinyal);
  addEventListener("pagehide", () => duraklat(), sinyal);

  function kapat() {
    if (D.kapali) return;
    D.kapali = true;
    D.durum = "durdu";
    D.no++;
    try { s?.cancel(); } catch { /* yok */ }
    menuKapat();
    iptal.abort();
    k.isaretle?.(null);
    el.serit.remove();
    if ("mediaSession" in navigator) {
      try { for (const e of ["play", "pause", "stop", "nexttrack", "previoustrack"]) navigator.mediaSession.setActionHandler(e, null); navigator.mediaSession.metadata = null; } catch { /* yok */ }
    }
    k.degisti?.();
    k.kapandi?.();
  }

  durumYaz();
  return {
    el, oynat, duraklat, degistir, sonraki, onceki, kapat,
    okuyor: () => D.durum === "okuyor" && !D.kapali,
    acik: () => !D.kapali,
    simdiki: () => D.kuyruk[D.i] || null,
  };
}

// ---------- PDF bağdaştırıcısı ----------
// Koltuk'ta PDF okunurken (duzenleyici.js) metin katmanı olan sayfalar okunur:
//   sesliOkumaKur(pdfKaynagi(pdf, { kok, sayfa: () => simdikiSayfa, git: (i) => sayfayaGit(i), ad, dil }))
// pdf: pdf-belge.js pdfAc sonucu (satirlar(i) metin parçalarını verir). İşaretleme sayfa düzeyindedir: okunan cümlenin
// sayfası ekranda değilse o sayfaya gidilir. Metin katmanı olmayan (taranmış) sayfa atlanır.
export function pdfKaynagi(pdf, { kok, sayfa, git, ad, dil = () => "" }) {
  const sayfaMetni = async (i) => {
    const satirlar = await pdf.satirlar(i).catch(() => []);
    let m = "";
    for (const s of satirlar) { m += s.t; m += s.eol ? "\n" : ""; }
    return m.replace(/-\n(?=\p{Ll})/gu, "").replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  };
  return {
    kok, ad, dil,
    baslangic: () => sayfa(),
    async parca(i) {
      if (i == null || i >= pdf.sayfaSayisi) return { cumleler: [], sonraki: null };
      const m = await sayfaMetni(i);
      return { cumleler: cumlelereBol(m, dil()).map((c) => ({ sayfa: i, metin: m.slice(c.a, c.b) })), sonraki: i + 1 < pdf.sayfaSayisi ? i + 1 : null };
    },
    isaretle(c) { if (c && c.sayfa !== sayfa()) git(c.sayfa); },
  };
}
