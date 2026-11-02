// Arayüz dili: "tr" ya da "en". Kaynak metin Türkçedir ve anahtar odur: t("Yedek al") İngilizce kipte
// sözlükten gelir, sözlükte yoksa Türkçe kalır (eksik çeviri hiçbir şeyi bozmaz).
// Yer tutucu: t("{n} belge", { n }). İngilizce değer işlev olabilir (çoğul için): "{n} belge": (p) => p.n === 1 ? "1 document" : `${p.n} documents`.
// Seçim localStorage "kn-dil"de durur, store.ayarlar'da değil: ayarlar IndexedDB'den geç gelir, oysa modüller
// yüklenirken (sabit listeler, örnek veri) dilin bilinmesi gerekir. İlk açılışta cihaz dili: Türkçe cihazda tr, gerisi en.
// Dil değişince sayfa yeniden yüklenir; böylece modül düzeyindeki metinler de yeni dille kurulur.
// Bu modül hiçbir modülü içe aktarmaz (ortak.js onu içe aktarır), yalnız sözlüğü.
import { EN } from "./dil/en.js";

const ANAHTAR = "kn-dil";
export const DILLER = [["tr", "Türkçe"], ["en", "English"]];

function dilBul() {
  try { const d = localStorage.getItem(ANAHTAR); if (d === "tr" || d === "en") return d; } catch { /* gizli pencere */ }
  const l = String(navigator.languages?.[0] || navigator.language || "tr").toLowerCase();
  return l.startsWith("tr") ? "tr" : "en";
}

export const dil = dilBul();
// toLocaleString, Intl ve localeCompare için
export const yerel = dil === "en" ? "en" : "tr-TR";
export const ingilizceMi = dil === "en";
try { document.documentElement.lang = dil; } catch { /* işçide document yok */ }

const doldur = (s, p) => (p ? String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] ?? m)) : s);
export function t(metin, p) {
  const s = ingilizceMi ? EN[metin] : undefined;
  if (typeof s === "function") return s(p || {});
  return doldur(s ?? metin, p);
}

// Ayarlar'daki dil seçimi buradan geçer; aynı dil seçilirse bir şey olmaz
export function dilSec(d) {
  if (d === dil || !DILLER.some(([id]) => id === d)) return;
  try { localStorage.setItem(ANAHTAR, d); } catch { /* yazılamazsa cihaz dili kalır */ }
  location.reload();
}
