// Hakkında ve açık kaynak lisansları (OZELLIKLER-8 §4.4). Ayarlar > Yardım'dan açılır.
// Geniş ekranda pencere, telefonda ve iPad dikeyde alt çekmece (cekmece.js).
//
//   hakkindaAc({ acan })
//
// Sürüm: etkin hizmet çalışanının önbellek adından okunur (sw.js "kn-tasarim-<VERSION>"). Önbellek yoksa
// (ilk açılış, güvenli olmayan bağlantı) sw.js dosyasındaki VERSION satırı okunur; o da yoksa "bilinmiyor".

import { h, icon } from "./ortak.js";
import { altCekmece, cekmeceMi } from "./cekmece.js";

const DEPO = "https://github.com/canerganis/kenar-notu";

// [ad, sürüm, lisans, ne için, bağlantı]
const LISANSLAR = [
  ["PDF.js", "6.4.299", "Apache-2.0", "PDF okuma", "https://github.com/mozilla/pdf.js"],
  ["pdf-lib", "", "MIT", "Notlu PDF", "https://github.com/Hopding/pdf-lib"],
  ["JSZip", "3.10.1", "MIT ya da GPLv3 (çift lisans, MIT seçildi)", "EPUB ve yedek", "https://github.com/Stuk/jszip"],
  ["pako (JSZip içinde)", "", "MIT", "Sıkıştırma", "https://github.com/nodeca/pako"],
  ["Temml", "0.14.0", "MIT", "Matematik", "https://github.com/ronkok/Temml"],
  ["Bergamot translator", "0.4.9", "MPL-2.0", "Cihazda çeviri motoru", "https://github.com/browsermt/bergamot-translator"],
  ["Firefox Translations modelleri", "", "MPL-2.0", "Çeviri paketleri, istenince iner", "https://github.com/mozilla/firefox-translations-models"],
  ["sql.js", "", "MIT", "Anki'ye aktarım", "https://github.com/sql-js/sql.js"],
  ["epub.js", "0.3.93", "BSD-2-Clause", "Eski arayüz", "https://github.com/futurepress/epub.js"],
];
const YAZI_TIPLERI = [
  ["Literata", "SIL OFL 1.1", "Okuma metni"],
  ["Inter", "SIL OFL 1.1", "Arayüz"],
  ["IBM Plex Mono", "SIL OFL 1.1", "Ölçü ve etiketler"],
  ["Caveat", "SIL OFL 1.1", "El yazısı notlar"],
  ["Noto Sans Math", "SIL OFL 1.1", "Formül simgeleri"],
  ["Temml.woff2", "MIT", "KaTeX_Script'ten türetilmiş, Temml ile gelir"],
];

export async function surumAl() {
  try {
    const adlar = (await caches.keys()).map((a) => /^kn-tasarim-(\d[\w.-]*)$/.exec(a)?.[1]).filter(Boolean);
    if (adlar.length) return adlar.sort((a, b) => b.localeCompare(a, "en", { numeric: true }))[0];
  } catch { /* önbellek yok */ }
  try {
    const metin = await (await fetch(new URL("./sw.js", import.meta.url), { cache: "no-cache" })).text();
    return /VERSION\s*=\s*"([^"]+)"/.exec(metin)?.[1] || "";
  } catch { return ""; }
}

const dis = (href, ...icerik) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, ...icerik);

function govdeKur() {
  const surum = h("span", { class: "hakkinda-surum" }, "Sürüm …");
  surumAl().then((s) => { surum.textContent = s ? `Sürüm ${s}` : "Sürüm bilinmiyor"; });
  const satir = ([ad, sur, lisans, ne, url]) => h("li", { class: "hakkinda-lisans" },
    h("span", {}, dis(url, ad), sur ? h("small", {}, ` ${sur}`) : null, h("small", { class: "hakkinda-ne" }, ne)),
    h("span", { class: "hakkinda-lisans__ad" }, lisans));
  return [
    h("div", { class: "hakkinda-ust" },
      h("p", { class: "hakkinda-ad" }, "Kenar Notu"), surum,
      h("p", { class: "hakkinda-ozet" }, "Kâğıt kitap gibi oku, kalemle not al. Hesap yok, izleme yok; notların bu cihazda kalır.")),
    h("div", { class: "hakkinda-baglantilar" },
      h("a", { class: "fis-satir", href: new URL("./gizlilik.html", import.meta.url).href, target: "_blank", rel: "noopener" },
        icon("kilit", "i-20"), h("span", {}, "Gizlilik"), h("small", {}, "Ne toplanır, ne dışarı gider")),
      h("a", { class: "fis-satir", href: `${DEPO}/issues`, target: "_blank", rel: "noopener noreferrer" },
        icon("sor", "i-20"), h("span", {}, "Sorun bildir"), h("small", {}, "GitHub sorunlar sayfası"))),
    h("h3", { class: "t-etiket" }, "Açık kaynak lisansları"),
    h("ul", { class: "hakkinda-liste" }, LISANSLAR.map(satir)),
    h("h3", { class: "t-etiket" }, "Yazı tipleri"),
    h("ul", { class: "hakkinda-liste" }, YAZI_TIPLERI.map(([ad, lisans, ne]) => h("li", { class: "hakkinda-lisans" },
      h("span", {}, ad, h("small", { class: "hakkinda-ne" }, ne)), h("span", { class: "hakkinda-lisans__ad" }, lisans)))),
    h("p", { class: "hakkinda-not" }, "Yazı tipleri Google Fonts'tan bir kez iner, sonra cihazda kalır. Lisans metinleri her projenin deposunda."),
  ];
}

let acik = null;
export function hakkindaAc({ acan = document.activeElement } = {}) {
  if (acik) return;
  const govde = h("div", { class: "hakkinda" }, govdeKur());
  if (cekmeceMi()) {
    const c = altCekmece({ baslik: "Hakkında", govde, duraklar: ["yarim", "tam"], ilk: "tam", sinif: "hakkinda-cekmece", acan, kapaninca: () => { acik = null; } });
    acik = c;
    return;
  }
  const dlg = h("dialog", { class: "pencere hakkinda-pencere", "aria-labelledby": "hakkindaBaslik" },
    h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "hakkindaBaslik", tabindex: "-1" }, "Hakkında"),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => dlg.close() }, icon("kapat"))),
    govde);
  dlg.addEventListener("close", () => { acik = null; dlg.remove(); acan?.focus?.({ preventScroll: true }); });
  dlg.addEventListener("click", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  document.body.append(dlg);
  dlg.showModal();
  acik = dlg;
  dlg.querySelector("#hakkindaBaslik")?.focus({ preventScroll: true });
}
