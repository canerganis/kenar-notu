// Kenar Notu 7.0 (TASARIM-5 11.6): iz etiketleri ve web araması. Küçük ve bağımsız: izler.js, arama.js,
// disa-kopru.js ve ceviri.js (Koltuk ve Masa'nın çeviri fişi) aynı yardımcıları kullanır.
//
//   etiketleriOku(metin)        -> ["sınav", "kardiyo-2"]   "#kelime" yazımları; küçük harfe (tr) çevrilmiş, tekrarsız, sırayla
//   etiketAnahtari(s)           "#Sınav" ya da "Sınav" -> "sınav"
//   ETIKET_SORGU                 "#etiket" biçimindeki tek kelimelik sorgu
//   vikipediAdresi(metin, dil)  belgenin diline göre tr ya da en Vikipedi araması
//   webAramaAdresi(metin)       varsayılan DuckDuckGo; store.ayarlar.yardimciAramaMotoru === "google" ise Google
//   webAraDugmeleri({ metin, dil, sinif })  "Vikipedi" ve "Web'de ara" düğmeleri; yalnız dokununca, yeni sekmede.
//                                Çevrimdışıyken ikisi de devre dışı ve yanlarında "Çevrimdışı" yazar.
//
// Etiket kuralı: "#" ve ardından harf (Türkçe harfler dahil), rakam, "-" ya da "_". En az bir harf gerekir ("#3" etiket
// değildir: "soru #3"). "#" bir kelimenin ortasında olamaz ("C#", "a#b" etiket değil), sondaki "-" ve "_" atılır.

import { h, store } from "./ortak.js";
import { t, dil as arayuzDili } from "./dil.js";

const ETIKET = /(^|[^\p{L}\p{N}_&#/\\-])#([\p{L}\p{N}_-]+)/gu;
export const ETIKET_SORGU = /^#([\p{L}\p{N}_-]*\p{L}[\p{L}\p{N}_-]*)$/u;
export const etiketAnahtari = (s) => String(s || "").replace(/^#/, "").replace(/[-_]+$/, "").toLocaleLowerCase("tr");

export function etiketleriOku(metin) {
  const s = String(metin || "");
  if (!s.includes("#")) return [];
  const out = [];
  for (const m of s.matchAll(ETIKET)) {
    const e = etiketAnahtari(m[2]);
    if (e && /\p{L}/u.test(e) && !out.includes(e)) out.push(e);
  }
  return out;
}

/* ================= Vikipedi ve web araması (Y5) ================= */
export const ARAMA_MOTORLARI = { duckduckgo: { ad: "DuckDuckGo", adres: "https://duckduckgo.com/?q=" }, google: { ad: "Google", adres: "https://www.google.com/search?q=" } };
export const aramaMotoru = () => (store.ayarlar.yardimciAramaMotoru === "google" ? "google" : "duckduckgo");
const sadeMetin = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 300);
// Belgenin dili bilinmiyorsa arayüzün dili
export function vikipediAdresi(metin, dil = arayuzDili) {
  const d = /^tr/i.test(String(dil || arayuzDili)) ? "tr" : "en";
  return `https://${d}.wikipedia.org/w/index.php?search=${encodeURIComponent(sadeMetin(metin))}&ns0=1`;
}
export const webAramaAdresi = (metin) => ARAMA_MOTORLARI[aramaMotoru()].adres + encodeURIComponent(sadeMetin(metin));
export function disariAc(url) {
  if (!navigator.onLine) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

// Stil bir kez: düğmeler her fişte (Koltuk, Masa, asistan, palet) aynı görünür; renkler token
let stilVar = false;
function stilYukle() {
  if (stilVar || document.getElementById("web-ara-stil")) { stilVar = true; return; }
  stilVar = true;
  document.head.append(h("style", { id: "web-ara-stil" }, `
.web-ara { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.web-ara__dugme { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: var(--r-tam, 999px);
  font: 560 13px/1 var(--sans, Inter, system-ui, sans-serif); letter-spacing: -.005em; color: var(--accent); background: transparent;
  box-shadow: inset 0 0 0 .5px var(--line-strong); position: relative; }
.web-ara__dugme::after { content: ""; position: absolute; inset: -4px 0; }
.web-ara__dugme svg { width: 15px; height: 15px; flex: none; }
@media (hover: hover) and (pointer: fine) { .web-ara__dugme:not(:disabled):hover { background: var(--accent-soft); } }
.web-ara__dugme:disabled { color: var(--muted); opacity: .7; }
.web-ara__durum { font: 500 12px/16px var(--sans, Inter, system-ui, sans-serif); color: var(--muted); }
`));
}
const SVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const W_IZI = SVG('<path d="M3.5 6.5l4 11 4.5-10 4.5 10 4-11"/>');
const KURE = SVG('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5Z"/>');

export function webAraDugmeleri({ metin, dil = arayuzDili, sinif = "" } = {}) {
  stilYukle();
  const m = sadeMetin(metin);
  const vik = h("button", { class: "web-ara__dugme", type: "button", title: t("Vikipedi’de “{m}”", { m: m.slice(0, 40) }) });
  vik.innerHTML = W_IZI;
  vik.append(t("Vikipedi"));
  const web = h("button", { class: "web-ara__dugme", type: "button", title: t("{ad} ile ara", { ad: ARAMA_MOTORLARI[aramaMotoru()].ad }) });
  web.innerHTML = KURE;
  web.append(t("Web’de ara"));
  const durum = h("span", { class: "web-ara__durum", role: "status" });
  vik.addEventListener("click", (e) => { e.stopPropagation(); disariAc(vikipediAdresi(m, dil)); });
  web.addEventListener("click", (e) => { e.stopPropagation(); disariAc(webAramaAdresi(m)); });
  const kap = h("div", { class: ("web-ara " + sinif).trim(), role: "group", "aria-label": t("Dışarıda ara") }, vik, web, durum);
  const guncelle = () => {
    if (!kap.isConnected && kap._bagli) { removeEventListener("online", guncelle); removeEventListener("offline", guncelle); return; }
    const yok = !navigator.onLine;
    vik.disabled = web.disabled = yok || !m;
    durum.textContent = yok ? t("Çevrimdışı") : "";
  };
  addEventListener("online", guncelle);
  addEventListener("offline", guncelle);
  guncelle();
  requestAnimationFrame(() => { kap._bagli = true; });
  return kap;
}
