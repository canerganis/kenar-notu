// Hakkında ve açık kaynak lisansları (OZELLIKLER-8 §4.4). Ayarlar > Yardım'dan açılır.
// Geniş ekranda pencere, telefonda ve iPad dikeyde alt çekmece (cekmece.js).
// 7.0: Yenilikler bölümü ve 7.0'a ilk girişte bir kez açılan Yenilikler sheet'i (app.js çağırır).
//
//   hakkindaAc({ acan })
//   yeniliklerAc({ acan, ilk })
//
// Sürüm: etkin hizmet çalışanının önbellek adından okunur (sw.js "kn-tasarim-<VERSION>"). Önbellek yoksa
// (ilk açılış, güvenli olmayan bağlantı) sw.js dosyasındaki VERSION satırı okunur; o da yoksa "bilinmiyor".

import { h, icon, odakla } from "./ortak.js";
import { t } from "./dil.js";
import { altCekmece, cekmeceMi } from "./cekmece.js";

const DEPO = "https://github.com/canerganis/kenar-notu";

// [ad, sürüm, lisans, ne için, bağlantı]
// Sürümler lib/ içindeki dosyalardan doğrulandı: PDF.js (pdf.min.mjs Version), JSZip (başlık yorumu), Temml
// (temml.min.js version), Bergamot (lib/ceviri/KAYNAK.txt). Başlığında sürüm olmayanlar npm paketinin dist
// dosyasıyla bayt bayt karşılaştırıldı: pdf-lib 1.17.1, sql.js 1.14.2 (js ve wasm), epub.js 0.3.93.
// pako, JSZip 3.10.1'in package.json bağımlılığı (~1.0.2) ile 1.0 serisidir. Modeller sürümsüz, istenince iner.
const LISANSLAR = [
  ["PDF.js", "6.4.299", "Apache-2.0", t("PDF okuma"), "https://github.com/mozilla/pdf.js"],
  ["pdf-lib", "1.17.1", "MIT", t("Notlu PDF"), "https://github.com/Hopding/pdf-lib"],
  ["JSZip", "3.10.1", t("MIT ya da GPLv3 (çift lisans, MIT seçildi)"), t("EPUB ve yedek"), "https://github.com/Stuk/jszip"],
  [t("pako (JSZip içinde)"), "1.0", "MIT", t("Sıkıştırma"), "https://github.com/nodeca/pako"],
  ["Temml", "0.14.0", "MIT", t("Matematik"), "https://github.com/ronkok/Temml"],
  ["Bergamot translator", "0.4.9", "MPL-2.0", t("Cihazda çeviri motoru"), "https://github.com/browsermt/bergamot-translator"],
  [t("Firefox Translations modelleri"), "", "MPL-2.0", t("Çeviri paketleri, istenince iner"), "https://github.com/mozilla/firefox-translations-models"],
  ["sql.js", "1.14.2", "MIT", t("Anki'ye aktarım"), "https://github.com/sql-js/sql.js"],
  ["epub.js", "0.3.93", "BSD-2-Clause", t("Eski arayüz"), "https://github.com/futurepress/epub.js"],
];
const YAZI_TIPLERI = [
  ["Literata", "SIL OFL 1.1", t("Okuma metni")],
  ["Inter", "SIL OFL 1.1", t("Arayüz")],
  ["IBM Plex Mono", "SIL OFL 1.1", t("Ölçü ve etiketler")],
  ["Caveat", "SIL OFL 1.1", t("El yazısı notlar")],
  ["Noto Sans Math", "SIL OFL 1.1", t("Formül simgeleri")],
  ["Temml.woff2", "MIT", t("KaTeX_Script'ten türetilmiş, Temml ile gelir")],
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

// ---------- 7.0 Yenilikler (TASARIM-5 11.2 K9) ----------
// Hakkında'daki "Yenilikler" bölümü ve 7.0'a ilk girişte bir kez açılan kısa sheet aynı listeyi kullanır.
// [simge, başlık, açıklama]. "Birleştirme:" ile başlayan satır yer tutucu sayılır ve soluk çizilir.
// Metinler t() ile dile göre kurulur (dil sayfa yüklenirken sabit).
export const YENILIKLER = [
  ["ceviri", t("İngilizce arayüz"), t("Uygulama cihazın diline göre Türkçe ya da İngilizce açılır; Ayarlar > Görünüm > Dil’den değiştirebilirsin. İngilizcede örnek kitaplar ve kartlar da İngilizce.")],
  ["atmosfer", t("Sekiz atmosfer"), t("Aurora, Nebula, Okyanus, Grafit, OLED siyah, Kâğıt klasik, Sepya gece ve Orman. Ayarlar > Görünüm’den seç; vurgu rengini de değiştirebilirsin.")],
  ["yildizlar", t("Yeni logo: Yazan K"), t("Sayfa kenarı, kalem ve ışıklı mürekkep izi. Ana ekranda ve açılışta.")],
  ["raf-okunuyor", t("Okuma rafları ve sıralama"), t("Okunacak, Okunuyor ve Bitti rafları; ada, yazara, ilerlemeye ya da eklenme tarihine göre sıralama.")],
  ["sec", t("Çoklu seçim"), t("Seç’e dokun ya da kapağa uzun bas: birden çok belgeyi birlikte taşı, rafa koy, favorile ya da sil.")],
  ["sil", t("Son silinenler"), t("Silinen belge 30 gün çöpte bekler; izleri ve kartlarıyla geri yüklenir.")],
  ["kunye", t("Künye, seri ve kapak"), t("Ad, yazar, seri ve cilt numarasını düzenle, kendi kapağını seç. Belgeyi çoğalt ya da özgün dosyasını paylaş.")],
  ["kilit", t("Şifreli yedek"), t("Yedeği parolayla şifreleyebilirsin. Parola hiçbir yere kaydedilmez.")],
  ["klavye", t("Klavye kısayolları"), t("Her yerde ? tuşu bütün kısayolları gösterir.")],
  ["okuma", t("Koltuk: sesli okuma ve zengin EPUB"), t("Kitap cümle cümle sesli okunur. EPUB’da görseller, tablolar ve dipnotlar; Aa > Gelişmiş’te yaslama, heceleme, aralıklar, ışık ve sıcaklık.")],
  ["masa", t("Masa: parolalı PDF ve sayfa işlemleri"), t("Parolalı PDF’ler açılır. Kısmi silgi, metne oturan vurgu, sayfa döndürme ve silme; notlar standart PDF notu olarak dışa aktarılır.")],
  ["tekrar", t("Tekrar: boşluk kartları ve istatistik"), t("{{c1::…}} boşluk doldurma, ters kart, kart düzenleme, deste ayarları ve askıya alma. Tutma oranı, yük ve takvim; Anki .apkg içe aktarma.")],
  ["izler", t("İzler: etiketler, bağlar, içe aktarma"), t("Notta #etiket yaz, izleri birbirine bağla. Kindle ve Readwise alıntılarını içe aktar; Vikipedi ve web’de ara.")],
];
// Atmosfer şeridi: sekiz küçük önizleme (atmosfer.css .atmosfer-onizleme kendi tokenlarını alır)
const ATMOSFER_SIRA = ["aurora", "nebula", "okyanus", "grafit", "oled", "kagit", "sepya-gece", "orman"];
function atmosferSeridi() {
  const kip = document.documentElement.dataset.kip === "gece" ? "gece" : "gunduz";
  return h("div", { class: "yenilik-atmosferler", "aria-hidden": "true" }, ATMOSFER_SIRA.map((id) =>
    h("span", { class: "atmosfer-onizleme yenilik-numune", dataset: { atmosfer: id, kip: id === "oled" || id === "sepya-gece" ? "gece" : kip } }, h("i"))));
}
function yenilikListesi() {
  return h("ul", { class: "yenilik-liste" }, YENILIKLER.map(([ik, baslik, metin]) =>
    h("li", { class: "yenilik" + (baslik.startsWith(t("Birleştirme:")) ? " yer-tutucu" : "") },
      h("span", { class: "yenilik-simge", "aria-hidden": "true" }, icon(ik, "i-20")),
      h("span", {}, h("b", {}, baslik), h("small", {}, metin)))));
}

// ilk: 7.0'a ilk girişte kendiliğinden açıldı (kısa giriş cümlesi). Geniş ekranda pencere, telefonda alt çekmece
let yenilikAcik = null;
export function yeniliklerAc({ acan = document.activeElement, ilk = false } = {}) {
  if (yenilikAcik) return;
  const govde = h("div", { class: "yenilikler" },
    h("div", { class: "yenilik-ust" },
      h("img", { class: "yenilik-logo", src: new URL("./ikon/ikon.svg", import.meta.url).href, alt: "", width: "56", height: "56" }),
      h("div", {}, h("p", { class: "yenilik-surum" }, "Kenar Notu 7.1"),
        h("p", { class: "yenilik-giris" }, ilk ? t("Işıklı Kenar: sayfa sakin, kenar ışıklı. Bu sürümde neler değişti:") : t("Işıklı Kenar sürümünde gelenler")))),
    atmosferSeridi(),
    yenilikListesi());
  const kapat = () => { yenilikAcik = null; };
  if (cekmeceMi()) {
    yenilikAcik = altCekmece({ baslik: t("Yenilikler"), govde, duraklar: ["yarim", "tam"], ilk: "tam", sinif: "yenilik-cekmece", acan, kapaninca: kapat });
    return;
  }
  const dlg = h("dialog", { class: "pencere sheet yenilik-pencere", "aria-labelledby": "yenilikBaslik" },
    h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "yenilikBaslik", tabindex: "-1" }, t("Yenilikler")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "sheet-govde" }, govde),
    h("div", { class: "pencere-alt" }, h("button", { class: "birincil", type: "button", onclick: () => dlg.close() }, t("Başla"))));
  pencereAc(dlg, acan, kapat);
  yenilikAcik = dlg;
  odakla(dlg.querySelector("#yenilikBaslik"));
}
function pencereAc(dlg, acan, kapaninca) {
  dlg.addEventListener("close", () => { kapaninca?.(); dlg.remove(); acan?.focus?.({ preventScroll: true }); });
  dlg.addEventListener("click", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  document.body.append(dlg);
  dlg.showModal();
}

function govdeKur() {
  const surum = h("span", { class: "hakkinda-surum" }, t("Sürüm …"));
  surumAl().then((s) => { surum.textContent = s ? t("Sürüm {s}", { s }) : t("Sürüm bilinmiyor"); });
  const satir = ([ad, sur, lisans, ne, url]) => h("li", { class: "hakkinda-lisans" },
    h("span", {}, dis(url, ad), sur ? h("small", {}, ` ${sur}`) : null, h("small", { class: "hakkinda-ne" }, ne)),
    h("span", { class: "hakkinda-lisans__ad" }, lisans));
  // 7.0 (TASARIM-5 8.1 madde 5): ortada 96 px logo, kelime işareti, sürüm Plex Mono, atmosfer arkada
  return [
    h("div", { class: "hakkinda-ust" },
      h("img", { class: "hakkinda-logo", src: new URL("./ikon/ikon.svg", import.meta.url).href, alt: "", width: "96", height: "96" }),
      h("p", { class: "hakkinda-ad marka__yazi" }, h("b", {}, "Kenar"), h("i", {}, "Notu")), surum,
      h("p", { class: "hakkinda-ozet" }, t("Çevrimdışı çalışır. Verilerin bu cihazda kalır."))),
    h("h3", { class: "t-etiket" }, t("Yenilikler")),
    yenilikListesi(),
    h("div", { class: "hakkinda-baglantilar" },
      h("a", { class: "fis-satir", href: new URL("./gizlilik.html", import.meta.url).href, target: "_blank", rel: "noopener" },
        icon("kilit", "i-20"), h("span", {}, t("Gizlilik")), h("small", {}, t("Ne toplanır, ne dışarı gider"))),
      h("a", { class: "fis-satir", href: `${DEPO}/issues`, target: "_blank", rel: "noopener noreferrer" },
        icon("sor", "i-20"), h("span", {}, t("Sorun bildir")), h("small", {}, t("GitHub sorunlar sayfası")))),
    h("h3", { class: "t-etiket" }, t("Açık kaynak lisansları")),
    h("ul", { class: "hakkinda-liste" }, LISANSLAR.map(satir)),
    h("h3", { class: "t-etiket" }, t("Yazı tipleri")),
    h("ul", { class: "hakkinda-liste" }, YAZI_TIPLERI.map(([ad, lisans, ne]) => h("li", { class: "hakkinda-lisans" },
      h("span", {}, ad, h("small", { class: "hakkinda-ne" }, ne)), h("span", { class: "hakkinda-lisans__ad" }, lisans)))),
    h("p", { class: "hakkinda-not" }, t("Yazı tipleri Google Fonts'tan bir kez iner, sonra cihazda kalır. Lisans metinleri her projenin deposunda.")),
  ];
}

let acik = null;
export function hakkindaAc({ acan = document.activeElement } = {}) {
  if (acik) return;
  const govde = h("div", { class: "hakkinda" }, govdeKur());
  if (cekmeceMi()) {
    const c = altCekmece({ baslik: t("Hakkında"), govde, duraklar: ["yarim", "tam"], ilk: "tam", sinif: "hakkinda-cekmece", acan, kapaninca: () => { acik = null; } });
    acik = c;
    return;
  }
  const dlg = h("dialog", { class: "pencere hakkinda-pencere", "aria-labelledby": "hakkindaBaslik" },
    h("header", { class: "ayarlar-ust" }, h("h2", { class: "t-b2", id: "hakkindaBaslik", tabindex: "-1" }, t("Hakkında")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    govde);
  pencereAc(dlg, acan, () => { acik = null; });
  acik = dlg;
  odakla(dlg.querySelector("#hakkindaBaslik"));
}
