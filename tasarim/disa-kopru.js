// Dışa aktarım köprüleri (OZELLIKLER-8 §4.2): İzlerim ve cep defterindeki izler başka uygulamalara.
//
//   readwiseCsv(kitaplar)   -> Blob   Readwise içe aktarma CSV'si: Highlight, Title, Author, Note, Location, Date
//   obsidianZip(kitaplar)   -> Blob   Obsidian kasası için zip: kitap başına .md (YAML ön bilgi), kırpıntılar ekler/ içinde
//   kitaplar: [{ belge, izler }]   izler: izler.js izleriTopla çıktısı (aynı sırayla)
//
// Yalnız okur; paylaşma ya da indirme çağıranın işi (disa-aktar.js paylas).

import { store, KLASORLER } from "./ortak.js";
import { jszip } from "./epub-belge.js";

const sade = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const iki = (n) => String(n).padStart(2, "0");
const gun = (t) => { const d = new Date(t); return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; };
const saat = (t) => { const d = new Date(t); return `${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`; };
const TUR_ADI = { alt: "Altı çizili", daire: "Yuvarlak içinde", kenar: "Kenar işareti", isaret: "İşaret", serbest: "Kalem izi", vurgu: "Vurgu", not: "Not" };

// İzin tam metni: listede 280 harfe kırpılır, kaydında tamamı durur
const tamMetin = (x) => String(x.kayit?.metin ?? "").trim() || String(x.metin || "").trim();
// Readwise "Location" sayıdır: sayfalı belgede sayfa, EPUB'da paragraf sırası (kitap içinde sıralar)
const konumSayisi = (x) => (x.konum?.sayfa != null ? x.konum.sayfa : Number.isInteger(x.konum?.p) ? x.konum.p + 1 : "");

/* ================= Readwise CSV ================= */
const csvAlan = (v) => `"${String(v ?? "").replace(/\r\n?/g, "\n").replace(/"/g, '""')}"`;
export function readwiseCsv(kitaplar) {
  const satirlar = [["Highlight", "Title", "Author", "Note", "Location", "Date"].join(",")];
  for (const { belge, izler } of kitaplar) {
    for (const x of izler) {
      const metin = tamMetin(x);
      if (!metin) continue;   // Readwise vurgusuz satırı kabul etmez (el yazısı boşluğu, metinsiz iz)
      const not = x.kaynak === "asistan" ? "" : sade(x.not);
      const tarih = x.zaman ? `${gun(x.zaman)} ${saat(x.zaman)}` : "";
      satirlar.push([metin, belge.ad || "Adsız", belge.yazar || "", not, konumSayisi(x), tarih].map(csvAlan).join(","));
    }
  }
  return new Blob([satirlar.join("\r\n") + "\r\n"], { type: "text/csv" });
}

/* ================= Obsidian Markdown zip ================= */
const dosyaAdi = (s) => String(s || "Adsız").replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Adsız";
const etiket = (s) => String(s || "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}_/-]+/gu, "-").replace(/^-+|-+$/g, "");
// YAML çift tırnaklı dizgi: JSON dizgisi geçerli YAML'dır
const yaml = (s) => JSON.stringify(String(s ?? ""));
const alinti = (s) => String(s).split("\n").map((x) => "> " + x.trim()).join("\n");
const uzanti = (mime) => ({ "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" })[mime] || "png";

function dataUrlBayt(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(url || ""));
  if (!m) return null;
  try {
    if (!m[2]) return { tur: m[1] || "text/plain", bayt: new TextEncoder().encode(decodeURIComponent(m[3])) };
    const ikili = atob(m[3]);
    const bayt = new Uint8Array(ikili.length);
    for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
    return { tur: m[1] || "image/png", bayt };
  } catch { return null; }
}

function etiketler(belge) {
  const e = ["kenar-notu"];
  if (belge.tur) e.push(belge.tur);
  const k = KLASORLER.find((x) => x.id === belge.klasor);
  if (k?.ad) e.push(etiket(k.ad));
  return [...new Set(e.filter(Boolean))];
}

function kitapMd(belge, izler, kirpintilar, ekAdi) {
  const s = ["---", `title: ${yaml(belge.ad || "Adsız")}`];
  if (belge.yazar) s.push(`author: ${yaml(belge.yazar)}`);
  s.push(`date: ${gun(Date.now())}`, "tags:", ...etiketler(belge).map((t) => `  - ${t}`), "source: Kenar Notu", "---", "", `# ${belge.ad || "Adsız"}`);
  if (belge.yazar) s.push("", belge.yazar);
  let grup = null;
  for (const x of izler) {
    if (x.grup !== grup) { grup = x.grup; s.push("", `## ${grup || "Kitap"}`); }
    const metin = tamMetin(x);
    const meta = [TUR_ADI[x.tur] || "İz", [x.yer, x.bolum !== x.grup ? x.bolum : ""].filter(Boolean).join(", "), x.zaman ? gun(x.zaman) : ""].filter(Boolean).join(" · ");
    if (x.kaynak === "iz" || x.kaynak === "vurgu") s.push("", metin ? alinti(metin) : "> (metinsiz iz)");
    else if (x.kaynak === "tuval") s.push("", "(el yazısı not)");
    else if (x.kaynak === "asistan") s.push("", `Asistan: ${metin}`);
    else s.push("", metin);
    if (sade(x.not) && x.kaynak !== "not" && x.kaynak !== "metin") s.push("", `Kenar notu: ${sade(x.not)}`);
    s.push("", `*${meta}*`);
  }
  if (kirpintilar.length) {
    s.push("", "## Kırpıntılar");
    for (const k of kirpintilar) {
      s.push("", `![[${ekAdi(k)}]]`);
      const yer = [k.sayfa ? `s. ${k.sayfa}` : "", k.zaman ? gun(k.zaman) : ""].filter(Boolean).join(" · ");
      if (sade(k.not)) s.push("", sade(k.not));
      if (yer) s.push("", `*${yer}*`);
    }
  }
  return s.join("\n") + "\n";
}

export async function obsidianZip(kitaplar) {
  const JSZip = await jszip();
  const zip = new JSZip();
  const adlar = new Set();
  const benzersiz = (ad, uz) => {
    let a = `${ad}.${uz}`, n = 2;
    while (adlar.has(a.toLocaleLowerCase("tr"))) a = `${ad} (${n++}).${uz}`;
    adlar.add(a.toLocaleLowerCase("tr"));
    return a;
  };
  for (const { belge, izler } of kitaplar) {
    const ad = dosyaAdi(belge.ad);
    const kirpintilar = [];
    const ekler = new Map();
    for (const k of store.kirpintilar || []) {
      if (k?.belgeId !== belge.id) continue;
      const v = dataUrlBayt(k.gorsel);
      if (!v) continue;
      const yol = "ekler/" + benzersiz(`${ad} ${kirpintilar.length + 1}`, uzanti(v.tur));
      zip.file(yol, v.bayt);
      ekler.set(k, yol);
      kirpintilar.push(k);
    }
    if (!izler.length && !kirpintilar.length) continue;
    zip.file(benzersiz(ad, "md"), kitapMd(belge, izler, kirpintilar, (k) => ekler.get(k)));
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "DEFLATE" });
}
