// Dışa aktarım köprüleri (OZELLIKLER-8 §4.2): İzlerim ve cep defterindeki izler başka uygulamalara.
//
//   readwiseCsv(kitaplar)   -> Blob   Readwise içe aktarma CSV'si: Highlight, Title, Author, Note, Location, Date, Tags
//   obsidianZip(kitaplar)   -> Blob   Obsidian kasası için zip: kitap başına .md (YAML ön bilgi, iz etiketleri tags'te), kırpıntılar ekler/ içinde
//   kitaplar: [{ belge, izler, kirpinti? }]   izler: izler.js izleriTopla çıktısı (aynı sırayla)
//   kirpintilariSec(kitap)  -> [kırpıntı]   Obsidian'a girecek kırpıntılar
//
// Kırpıntı seçimi (kirpinti): "kitap" bütün kitap aktarılırken (cep defteri, İzlerim süzgeçsiz) kitabın bütün
// kırpıntıları; "ilgili" (varsayılan) seçili izler aktarılırken (derleme, süzgeçli İzlerim) yalnız o izlerin
// yanındakiler: sayfalı belgede aynı sayfa, EPUB'da kırpıntının bağlandığı paragraf izin paragraflarına iki
// paragraf yakın. Koltuk kırpıntısının sayfası sanal sayfadır (250 kelime), izinki paragraf: sayfa karşılaştırılmaz.
//
// Yalnız okur; paylaşma ya da indirme çağıranın işi (disa-aktar.js paylas).
//
// İçe aktarma (7.0, TASARIM-5 11.6 Y6): dosya metnini kitaplara ayırır, kitaplığa yazmaz (izler.js "Vurguları içe aktar").
//   kindleClippingsOku(metin) -> [kitap]   Kindle "My Clippings.txt" (İngilizce ve Türkçe Kindle biçimleri)
//   readwiseCsvOku(metin)     -> [kitap]   Readwise dışa aktarma CSV'si (ve bizim readwiseCsv çıktımız)
//   kitap: { baslik, yazar, vurgular: [{ metin, not, konum: "Konum 180-182" | "s. 12" | "", sira, zaman, notMu? }] }
//   konum dilden bağımsız Türkçe yazılır; gösterirken iceKonumMetni(konum) arayüz diline çevirir.
//   Kindle'da not, aynı kitabın konumu tutan vurgusuna bağlanır; vurgusuz not kendi başına durur (notMu).
//   Yer işaretleri ve boş girdiler atlanır. Readwise etiketleri (Tags) nota "#etiket" olarak eklenir.

import { store, KLASORLER } from "./ortak.js";
import { jszip } from "./epub-belge.js";
import { t, ingilizceMi } from "./dil.js";

const sade = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const iki = (n) => String(n).padStart(2, "0");
const gun = (t) => { const d = new Date(t); return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; };
const saat = (t) => { const d = new Date(t); return `${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`; };
const TUR_ADI = { alt: t("Altı çizili"), daire: t("Yuvarlak içinde"), kenar: t("Kenar işareti"), isaret: t("İşaret"), serbest: t("Kalem izi"), vurgu: t("Vurgu"), not: t("Not") };
// Sayfa kısaltması: "s. 12" (İngilizcede "p. 12")
const sayfaYaz = (n) => t("s. {n}", { n });

// İzin tam metni: listede 280 harfe kırpılır, kaydında tamamı durur
const tamMetin = (x) => String(x.kayit?.metin ?? "").trim() || String(x.metin || "").trim();
// Readwise "Location" sayıdır: sayfalı belgede sayfa, EPUB'da paragraf sırası (kitap içinde sıralar)
const konumSayisi = (x) => (x.konum?.sayfa != null ? x.konum.sayfa : Number.isInteger(x.konum?.p) ? x.konum.p + 1 : "");
// İzin etiketleri (izler.js izleriTopla x.etiketler: notundaki #kelime yazımları)
const izEtiketleri = (x) => (Array.isArray(x.etiketler) ? x.etiketler : []);

/* ================= Readwise CSV ================= */
const csvAlan = (v) => `"${String(v ?? "").replace(/\r\n?/g, "\n").replace(/"/g, '""')}"`;
export function readwiseCsv(kitaplar) {
  const satirlar = [["Highlight", "Title", "Author", "Note", "Location", "Date", "Tags"].join(",")];
  for (const { belge, izler } of kitaplar) {
    for (const x of izler) {
      const metin = tamMetin(x);
      if (!metin) continue;   // Readwise vurgusuz satırı kabul etmez (el yazısı boşluğu, metinsiz iz)
      const not = x.kaynak === "asistan" ? "" : sade(x.not);
      const tarih = x.zaman ? `${gun(x.zaman)} ${saat(x.zaman)}` : "";
      satirlar.push([metin, belge.ad || t("Adsız"), belge.yazar || "", not, konumSayisi(x), tarih, izEtiketleri(x).join(", ")].map(csvAlan).join(","));
    }
  }
  return new Blob([satirlar.join("\r\n") + "\r\n"], { type: "text/csv" });
}

/* ================= Obsidian Markdown zip ================= */
const dosyaAdi = (s) => String(s || t("Adsız")).replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || t("Adsız");
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

const TUR_ETIKETI_EN = { defter: "notebook", cizgi: "comic" };
function etiketler(belge, izler = []) {
  const e = ["kenar-notu"];
  // Tür etiketi kimlikten gelir; İngilizce arayüzde Türkçe kimlik yerine İngilizce ad (pdf, epub aynı)
  if (belge.tur) e.push(ingilizceMi ? TUR_ETIKETI_EN[belge.tur] || belge.tur : belge.tur);
  const k = KLASORLER.find((x) => x.id === belge.klasor);
  if (k?.ad) e.push(etiket(k.ad));
  for (const x of izler) for (const t of izEtiketleri(x)) e.push(etiket(t));
  return [...new Set(e.filter(Boolean))];
}

const YAKIN = 2;
const tamsayi = Number.isInteger;
function izeYakin(k, x) {
  if (tamsayi(k.okuma?.ap) && tamsayi(x.konum?.p)) {
    const bas = tamsayi(x.kayit?.bas?.p) ? x.kayit.bas.p : x.konum.p;
    const son = tamsayi(x.kayit?.son?.p) ? Math.max(bas, x.kayit.son.p) : bas;
    return k.okuma.ap >= bas - YAKIN && k.okuma.ap <= son + YAKIN;
  }
  return !k.okuma && x.konum?.sayfa != null && Number(k.sayfa) === x.konum.sayfa;
}
export function kirpintilariSec({ belge, izler = [], kirpinti = "ilgili" }) {
  const hepsi = (store.kirpintilar || []).filter((k) => k?.belgeId === belge?.id);
  return kirpinti === "kitap" ? hepsi : hepsi.filter((k) => izler.some((x) => izeYakin(k, x)));
}

function kitapMd(belge, izler, kirpintilar, ekAdi) {
  const ad = belge.ad || t("Adsız");
  const s = ["---", `title: ${yaml(ad)}`];
  if (belge.yazar) s.push(`author: ${yaml(belge.yazar)}`);
  s.push(`date: ${gun(Date.now())}`, "tags:", ...etiketler(belge, izler).map((e) => `  - ${e}`), "source: Kenar Notu", "---", "", `# ${ad}`);
  if (belge.yazar) s.push("", belge.yazar);
  let grup = null;
  for (const x of izler) {
    if (x.grup !== grup) { grup = x.grup; s.push("", `## ${grup || t("Kitap")}`); }
    const metin = tamMetin(x);
    const meta = [TUR_ADI[x.tur] || t("İz"), [x.yer, x.bolum !== x.grup ? x.bolum : ""].filter(Boolean).join(", "), x.zaman ? gun(x.zaman) : ""].filter(Boolean).join(" · ");
    if (x.kaynak === "iz" || x.kaynak === "vurgu") s.push("", metin ? alinti(metin) : `> ${t("(metinsiz iz)")}`);
    else if (x.kaynak === "tuval") s.push("", t("(el yazısı not)"));
    else if (x.kaynak === "asistan") s.push("", `${t("Asistan")}: ${metin}`);
    else s.push("", metin);
    if (sade(x.not) && x.kaynak !== "not" && x.kaynak !== "metin") s.push("", `${t("Kenar notu")}: ${sade(x.not)}`);
    s.push("", `*${meta}*`);
  }
  if (kirpintilar.length) {
    s.push("", `## ${t("Kırpıntılar")}`);
    for (const k of kirpintilar) {
      s.push("", `![[${ekAdi(k)}]]`);
      const yer = [k.sayfa ? sayfaYaz(k.sayfa) : "", k.zaman ? gun(k.zaman) : ""].filter(Boolean).join(" · ");
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
  for (const kitap of kitaplar) {
    const { belge, izler } = kitap;
    const ad = dosyaAdi(belge.ad);
    const kirpintilar = [];
    const ekler = new Map();
    for (const k of kirpintilariSec(kitap)) {
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

/* ================= İçe aktarma: Kindle ve Readwise (7.0 Y6) ================= */
const AYLAR = { ocak: 0, subat: 1, şubat: 1, mart: 2, nisan: 3, mayis: 4, mayıs: 4, haziran: 5, temmuz: 6, agustos: 7, ağustos: 7,
  eylul: 8, eylül: 8, ekim: 9, kasim: 10, kasım: 10, aralik: 11, aralık: 11 };
// "Monday, March 4, 2019 10:15:30 PM" (Date.parse anlar) ya da "4 Mart 2019 Pazartesi 22:15:30"
function kindleTarih(s) {
  const t = String(s || "").trim();
  if (!t) return 0;
  const tr = /(\d{1,2})\s+([\p{L}]+)\s+(\d{4})(?:\s+[\p{L}]+)?(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/u.exec(t);
  if (tr) {
    const ay = AYLAR[tr[2].toLocaleLowerCase("tr")];
    if (ay != null) return new Date(+tr[3], ay, +tr[1], +(tr[4] || 0), +(tr[5] || 0), +(tr[6] || 0)).getTime();
  }
  const en = Date.parse(t.replace(/^[A-Za-z]+,\s*/, ""));
  return Number.isFinite(en) ? en : 0;
}
// "Başlık (Yazar)": yazar son parantezdir; "Soyad, Ad" olduğu gibi kalır
function baslikYazar(satir) {
  const s = String(satir || "").replace(/^\uFEFF/, "").trim();
  const m = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(s);
  return m ? { baslik: m[1].trim(), yazar: m[2].trim() } : { baslik: s, yazar: "" };
}
// İçe aktarılan konum kayıtta Türkçe durur ("Konum 180-182", "s. 12"; alıntı anahtarı buna bağlı).
// Gösterirken arayüz diline çevrilir: iceKonumMetni("Konum 180-182") -> "Location 180-182"
export function iceKonumMetni(s) {
  const m = /^(Konum|s\.) (.+)$/.exec(String(s || ""));
  return !m ? String(s || "") : m[1] === "Konum" ? t("Konum {n}", { n: m[2] }) : sayfaYaz(m[2]);
}
const konumAraligi = (s) => { const m = /(\d+)(?:\s*-\s*(\d+))?/.exec(String(s || "")); return m ? [+m[1], +(m[2] || m[1])] : null; };

export function kindleClippingsOku(metin) {
  const kitaplar = new Map();
  const girdiler = String(metin || "").replace(/\r\n?/g, "\n").split(/\n?={8,}\s*\n?/);
  let sira = 0;
  for (const g of girdiler) {
    const satirlar = g.split("\n");
    while (satirlar.length && !satirlar[0].replace(/^\uFEFF/, "").trim()) satirlar.shift();
    if (satirlar.length < 2) continue;
    const { baslik, yazar } = baslikYazar(satirlar[0]);
    const bilgi = satirlar[1].trim();
    if (!bilgi.startsWith("-") || !baslik) continue;
    const govde = satirlar.slice(2).join("\n").trim();
    // Tür: İngilizce "Highlight / Note / Bookmark", Türkçe "Vurgu(lama) / Not / Yer işareti"
    const kucuk = bilgi.toLocaleLowerCase("tr");
    const tur = /bookmark|yer işaret|yer imi/.test(kucuk) ? "imi" : /\bnote\b|\bnot(unuz|u)?\b|notunuz/.test(kucuk) ? "not" : /highlight|vurgu/.test(kucuk) ? "vurgu" : "vurgu";
    if (tur === "imi" || !govde) continue;
    const parcalar = bilgi.replace(/^-\s*/, "").split("|").map((x) => x.trim());
    let sayfa = "", konum = "", tarih = 0;
    for (const p of parcalar) {
      const pk = p.toLocaleLowerCase("tr");
      const ss = /(?:page|sayfa)\s*([\divxlc-]+)/i.exec(p);
      if (ss && !sayfa) sayfa = ss[1];
      const kk = /(?:location|loc\.|konum)\s*([\d]+(?:\s*-\s*\d+)?)/i.exec(p);
      if (kk && !konum) konum = kk[1].replace(/\s+/g, "");
      if (/added on|eklenme|eklendi|tarih/.test(pk)) tarih = kindleTarih(p.replace(/^.*?(added on|eklenme tarihi|eklenme|eklendi|tarihi)\s*:?\s*/i, ""));
    }
    const anahtar = (baslik + "\u0000" + yazar).toLocaleLowerCase("tr");
    if (!kitaplar.has(anahtar)) kitaplar.set(anahtar, { baslik, yazar, vurgular: [] });
    const k = kitaplar.get(anahtar);
    const yer = konum ? `Konum ${konum}` : sayfa ? `s. ${sayfa}` : "";
    if (tur === "not") {
      // Not, konumu tutan son vurguya bağlanır (Kindle notu vurgunun bittiği konuma yazar)
      const nk = konumAraligi(konum);
      const v = nk && [...k.vurgular].reverse().find((x) => !x.notMu && x._aralik && nk[0] >= x._aralik[0] && nk[0] <= x._aralik[1] + 1);
      if (v) { v.not = v.not ? v.not + "\n" + govde : govde; continue; }
      k.vurgular.push({ metin: govde, not: "", konum: yer, sira: sira++, zaman: tarih, notMu: true, _aralik: nk });
      continue;
    }
    // Kindle aynı vurguyu genişletince eskisini de yazar: aynı başlangıçtan yeni ve uzun olan eskinin yerine geçer
    const ar = konumAraligi(konum);
    const eski = ar && k.vurgular.find((x) => !x.notMu && x._aralik && x._aralik[0] === ar[0] && (govde.includes(x.metin) || x.metin.includes(govde)));
    if (eski) { if (govde.length > eski.metin.length) Object.assign(eski, { metin: govde, konum: yer, _aralik: ar, zaman: tarih || eski.zaman }); continue; }
    k.vurgular.push({ metin: govde, not: "", konum: yer, sira: sira++, zaman: tarih, _aralik: ar });
  }
  const out = [...kitaplar.values()].filter((k) => k.vurgular.length);
  for (const k of out) for (const v of k.vurgular) delete v._aralik;
  return out;
}

// RFC 4180 CSV: tırnaklı alanlar, alan içinde satır sonu ve "" kaçışı
function csvSatirlar(metin) {
  const s = String(metin || "").replace(/^\uFEFF/, "");
  const satirlar = [];
  let alan = "", satir = [], tirnak = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (tirnak) {
      if (c === '"') { if (s[i + 1] === '"') { alan += '"'; i++; } else tirnak = false; }
      else alan += c;
    } else if (c === '"') tirnak = true;
    else if (c === ",") { satir.push(alan); alan = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      satir.push(alan); alan = "";
      if (satir.some((x) => x !== "")) satirlar.push(satir);
      satir = [];
    } else alan += c;
  }
  satir.push(alan);
  if (satir.some((x) => x !== "")) satirlar.push(satir);
  return satirlar;
}
export function readwiseCsvOku(metin) {
  const [bas, ...satirlar] = csvSatirlar(metin);
  if (!bas) return [];
  const sutun = (...adlar) => bas.findIndex((x) => adlar.includes(x.trim().toLowerCase()));
  const iV = sutun("highlight", "text"), iB = sutun("book title", "title"), iY = sutun("book author", "author"), iN = sutun("note"),
    iK = sutun("location"), iKT = sutun("location type"), iT = sutun("highlighted at", "date"), iE = sutun("tags");
  if (iV < 0 || iB < 0) return [];
  const kitaplar = new Map();
  let sira = 0;
  for (const r of satirlar) {
    const metin = String(r[iV] || "").trim(), baslik = String(r[iB] || "").trim();
    if (!metin || !baslik) continue;
    const yazar = iY >= 0 ? String(r[iY] || "").trim() : "";
    const anahtar = (baslik + "\u0000" + yazar).toLocaleLowerCase("tr");
    if (!kitaplar.has(anahtar)) kitaplar.set(anahtar, { baslik, yazar, vurgular: [] });
    const konumHam = iK >= 0 ? String(r[iK] || "").trim() : "";
    const tip = iKT >= 0 ? String(r[iKT] || "").toLowerCase() : "";
    const konum = !konumHam ? "" : /page/.test(tip) ? `s. ${konumHam}` : `Konum ${konumHam}`;
    const etiketler = iE >= 0 ? String(r[iE] || "").split(/[,;]/).map((x) => x.trim().replace(/^#/, "").replace(/\s+/g, "-")).filter(Boolean) : [];
    let not = iN >= 0 ? String(r[iN] || "").trim() : "";
    const eksik = etiketler.filter((e) => !not.toLocaleLowerCase("tr").includes("#" + e.toLocaleLowerCase("tr")));
    if (eksik.length) not = [not, eksik.map((e) => "#" + e).join(" ")].filter(Boolean).join(" ");
    const t = iT >= 0 ? Date.parse(String(r[iT] || "").trim().replace(" ", "T")) : NaN;
    kitaplar.get(anahtar).vurgular.push({ metin, not, konum, sira: sira++, zaman: Number.isFinite(t) ? t : 0 });
  }
  return [...kitaplar.values()];
}
