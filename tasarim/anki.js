// Tekrar kartlarını dışarı verme (OZELLIKLER-8 1.2 ve 1.3): Anki paketi (.apkg), TSV + görseller zip, takvim (.ics).
// Sözleşme: ankiAktar(kartlar, { bicim: "apkg" | "tsv" }), takvimAktar(), ankiPaketi(kartlar), ankiTsvZip(kartlar), takvimIcs().
// sql.js (1.14.2, MIT, lib/sql-wasm.*) ve JSZip yalnız aktarırken yüklenir.
//
// .apkg: Anki 2.1'in eski şeması (collection.anki2, şema 11) + "media" JSON ({ "0": "ad.png" }) + numaralı medya dosyaları.
// Her kart iki alanlı (Ön, Arka) bir not; deste "Kenar Notu::<belge adı>". Not guid'i kart kimliğinden türer:
// aynı kart yeniden aktarılınca Anki onu çoğaltmaz, günceller. Kartlar Anki'ye yeni kart olarak girer.

import { store, belgeBul, gunBasi } from "./ortak.js";
import { texParcala } from "./matematik.js";

const AYRAC = String.fromCharCode(31);     // Anki alan ayracı (US)
const MODEL_ID = 1730419200000;            // sabit not türü kimliği: yeniden aktarımda aynı tür kullanılır
const DESTE_KOK = "Kenar Notu";

// ---------- tembel yükleme ----------
function betikYukle(yol, ad) {
  if (window[ad]) return Promise.resolve(window[ad]);
  return new Promise((tamam, hata) => {
    const s = document.createElement("script");
    s.src = new URL(yol, import.meta.url).href;
    s.onload = () => (window[ad] ? tamam(window[ad]) : hata(new Error(ad + " yüklenemedi")));
    s.onerror = () => { s.remove(); hata(new Error(ad + " yüklenemedi")); };
    document.head.append(s);
  });
}
const jszip = () => betikYukle("../lib/jszip.min.js", "JSZip");
let sqlYukleniyor = null;
function sqlJs() {
  sqlYukleniyor ||= betikYukle("../lib/sql-wasm.js", "initSqlJs")
    .then((init) => init({ locateFile: (f) => new URL("../lib/" + f, import.meta.url).href }))
    .catch((e) => { sqlYukleniyor = null; throw e; });
  return sqlYukleniyor;
}

// ---------- kart içeriği ----------
const kacis = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const satirHtml = (s) => kacis(s).replace(/\r?\n/g, "<br>").replace(/\t/g, " ");
// Formüller Anki'nin MathJax sınırlayıcılarına çevrilir: \(...\) satır içi, \[...\] blok
const metinHtml = (s) => texParcala(s).map((p) => (p.tex == null ? satirHtml(p.metin)
  : p.blok ? `\\[${kacis(p.tex)}\\]` : `\\(${kacis(p.tex)}\\)`)).join("");
export const belgeAdi = (k) => belgeBul(k.belgeId)?.ad || k.belgeAd || "Genel";
// Deste adında "::" alt deste demektir; belge adındaki iki nokta tek nokta olur
export const desteAdi = (k) => `${DESTE_KOK}::${belgeAdi(k).replace(/:{2,}/g, ":").trim() || "Genel"}`;
const UZANTI = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

// Kartların görsellerini toplar: { ad, blob } listesi ve her kart için iki alanın HTML'i
async function alanlar(kartlar) {
  const medya = [], adlar = new Map();
  async function gorsel(src, ad) {
    if (adlar.has(src)) return adlar.get(src);
    let blob;
    try { blob = await (await fetch(src)).blob(); } catch { return null; }
    const dosya = `kenar-notu-${ad}.${UZANTI[blob.type] || "png"}`.replace(/[^\w.-]/g, "_");
    medya.push({ ad: dosya, blob });
    adlar.set(src, dosya);
    return dosya;
  }
  async function yuz(y, ad) {
    const parca = [];
    if (y?.gorsel) { const d = await gorsel(y.gorsel, ad); if (d) parca.push(`<img src="${kacis(d)}">`); }
    if (y?.metin) parca.push(`<div>${metinHtml(y.metin)}</div>`);
    return parca.join("");
  }
  const notlar = [];
  for (const k of kartlar) {
    const on = await yuz(k.on, `${k.id}-on`);
    let arka = await yuz(k.arka, `${k.id}-arka`);
    const kaynak = [belgeAdi(k), k.sayfa ? `s. ${k.sayfa}` : ""].filter(Boolean).join(" · ");
    if (kaynak) arka += `<div class="kaynak">${kacis(kaynak)}</div>`;
    notlar.push({ k, on: on || "&nbsp;", arka, deste: desteAdi(k), etiketler: ["Kenar_Notu", k.tur || "kart"] });
  }
  return { notlar, medya };
}

// ---------- SHA-1 (Anki'nin csum alanı ve kararlı kimlikler için; crypto.subtle güvensiz bağlamda yok) ----------
export function sha1Hex(metin) {
  const b = new TextEncoder().encode(metin);
  const n = ((b.length + 8) >> 6) + 1, w = new Uint32Array(n * 16);
  for (let i = 0; i < b.length; i++) w[i >> 2] |= b[i] << (24 - (i % 4) * 8);
  w[b.length >> 2] |= 0x80 << (24 - (b.length % 4) * 8);
  w[n * 16 - 1] = b.length * 8;
  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const x = new Uint32Array(80), rol = (v, s) => (v << s) | (v >>> (32 - s));
  for (let o = 0; o < w.length; o += 16) {
    for (let t = 0; t < 80; t++) x[t] = t < 16 ? w[o + t] : rol(x[t - 3] ^ x[t - 8] ^ x[t - 14] ^ x[t - 16], 1);
    let [a, bb, c, d, e] = [h0, h1, h2, h3, h4];
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const g = (rol(a, 5) + f + e + k + x[t]) >>> 0;
      e = d; d = c; c = rol(bb, 30) >>> 0; bb = a; a = g;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((v) => v.toString(16).padStart(8, "0")).join("");
}
// Anki stripHTMLMedia: görselin dosya adı kalır, etiketler gider (sıralama alanı ve csum bundan)
const duzMetin = (html) => html.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, " $1 ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
const guid = (k) => "kn" + sha1Hex("kenar-notu:" + k.id).slice(0, 14);
// Deste kimliği adından: aynı belge her aktarımda aynı desteye gider
const desteId = (ad) => 1e12 + parseInt(sha1Hex(ad).slice(0, 10), 16);

// ---------- collection.anki2 ----------
const SEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null,
  dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null,
  dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null,
  tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null,
  usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null,
  reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null,
  flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null,
  lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);`;

const KART_CSS = `.card { font-family: Georgia, serif; font-size: 20px; text-align: center; color: #1B1B1F; background: #FBF8F1; }
.card img { max-width: 100%; height: auto; }
.kaynak { margin-top: 1em; font: 12px/1.4 ui-monospace, monospace; color: #8A8578; text-transform: uppercase; }
.nightMode.card, .night_mode .card { color: #ECE8DF; background: #1E1D1B; }`;

function koleksiyonJson(desteler, simdiSn) {
  const deste = (id, name) => ({ id, name, mod: simdiSn, usn: -1, desc: "", dyn: 0, conf: 1, collapsed: false, browserCollapsed: false,
    extendNew: 0, extendRev: 50, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0] });
  const decks = { 1: deste(1, "Default") };
  for (const [ad, id] of desteler) decks[id] = deste(id, ad);
  const ilkDeste = desteler.values().next().value || 1;
  const fld = (name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] });
  const models = { [MODEL_ID]: {
    id: MODEL_ID, name: "Kenar Notu (Ön/Arka)", type: 0, mod: simdiSn, usn: -1, sortf: 0, did: ilkDeste, tags: [], vers: [],
    flds: [fld("Ön", 0), fld("Arka", 1)],
    tmpls: [{ name: "Kart 1", ord: 0, qfmt: "{{Ön}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Arka}}", bqfmt: "", bafmt: "", did: null, bfont: "", bsize: 0 }],
    css: KART_CSS, req: [[0, "any", [0]]],
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
  } };
  const dconf = { 1: { id: 1, name: "Default", mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
    new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 } } };
  const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true,
    curModel: String(MODEL_ID), nextPos: 1, sortType: "noteFld", sortBackwards: false, addToCur: true };
  return { conf, models, decks, dconf };
}

// Kartlardan .apkg Blob'u
export async function ankiPaketi(kartlar) {
  const [SQL, JSZip, { notlar, medya }] = await Promise.all([sqlJs(), jszip(), alanlar(kartlar)]);
  const simdi = Date.now(), simdiSn = Math.floor(simdi / 1000);
  const desteler = new Map();
  for (const n of notlar) if (!desteler.has(n.deste)) desteler.set(n.deste, desteId(n.deste));
  const { conf, models, decks, dconf } = koleksiyonJson(desteler, simdiSn);

  const db = new SQL.Database();
  try {
    db.run(SEMA);
    // Büyük tam sayılar (ms kimlikler) SQL metnine sayı olarak yazılır: bağlanan JS sayıları REAL olarak girebilir
    const tam = (v) => String(Math.trunc(v));
    db.run(`INSERT INTO col VALUES (1, ${tam(gunBasi(simdi) / 1000)}, ${tam(simdi)}, ${tam(simdi)}, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`,
      [JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf)]);
    notlar.forEach((n, i) => {
      const id = simdi + i, sfld = duzMetin(n.on);
      const csum = parseInt(sha1Hex(sfld).slice(0, 8), 16);
      db.run(`INSERT INTO notes VALUES (${tam(id)}, ?, ${MODEL_ID}, ${simdiSn}, -1, ?, ?, ?, ${csum}, 0, '')`,
        [guid(n.k), ` ${n.etiketler.join(" ")} `, n.on + AYRAC + n.arka, sfld]);
      db.run(`INSERT INTO cards VALUES (${tam(id)}, ${tam(id)}, ${tam(desteler.get(n.deste))}, 0, ${simdiSn}, -1, 0, 0, ${i + 1}, 0, 0, 0, 0, 0, 0, 0, 0, '')`);
    });
    const zip = new JSZip();
    zip.file("collection.anki2", db.export());
    const harita = {};
    medya.forEach((m, i) => { harita[i] = m.ad; zip.file(String(i), m.blob); });
    zip.file("media", JSON.stringify(harita));
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/octet-stream" });
  } finally { db.close(); }
}

// Yedek yol: Anki metin içe aktarma başlıklı TSV + görseller. Görseller Anki'nin collection.media klasörüne kopyalanır.
export async function ankiTsvZip(kartlar) {
  const [JSZip, { notlar, medya }] = await Promise.all([jszip(), alanlar(kartlar)]);
  // Anki ayrıştırıcısı tırnağı alan sınırı sayar: tırnaklı alan tırnak içine alınır, iç tırnak ikilenir
  const alan = (s) => { const t = String(s).replace(/[\t\r\n]+/g, " "); return /"/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const satirlar = ["#separator:tab", "#html:true", "#notetype:Basic", "#deck column:3", "#tags column:4", "#guid column:5"];
  for (const n of notlar) satirlar.push([n.on, n.arka, n.deste, n.etiketler.join(" "), guid(n.k)].map(alan).join("\t"));
  const zip = new JSZip();
  zip.file("kartlar.txt", satirlar.join("\n") + "\n");
  zip.file("OKU.txt", [
    "Kenar Notu kartları (Anki metin içe aktarma)",
    "",
    "1. medya klasöründeki görselleri Anki'nin collection.media klasörüne kopyala",
    "   (Anki masaüstü: Araçlar > Medyayı denetle > Medya klasörünü aç).",
    "2. Anki'de Dosya > İçe aktar ile kartlar.txt dosyasını seç.",
    "Deste, etiket ve not türü dosyanın başındaki satırlardan okunur.",
  ].join("\n") + "\n");
  for (const m of medya) zip.file("medya/" + m.ad, m.blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/zip" });
}

// ---------- takvim (.ics) ----------
// Önümüzdeki gun gün için her güne bir etkinlik: o gün vakti gelen kart sayısı (FSRS tarihlerinden, bugün gecikenler dahil).
// Kart varsa etkinlik başında hatırlatma (VALARM). UID güne bağlı: yeniden eklenen takvim eski etkinlikleri günceller.
export function takvimGunleri(kartlar = store.kartlar, { gun = 14, simdi = Date.now() } = {}) {
  const sonuc = [];
  for (let i = 0; i < gun; i++) {
    const bas = gunBasi(simdi, i), son = gunBasi(simdi, i + 1);
    sonuc.push({ bas, sayi: kartlar.filter((k) => k.sonraki < son && (i === 0 || k.sonraki >= bas)).length });
  }
  return sonuc;
}
const iki = (n) => String(n).padStart(2, "0");
const yerelTarih = (t) => { const d = new Date(t); return `${d.getFullYear()}${iki(d.getMonth() + 1)}${iki(d.getDate())}`; };
const utcAn = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const icsMetin = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// RFC 5545 3.1: satır 75 sekizliyi geçmez, devamı boşlukla başlar (UTF-8 karakteri bölünmez)
function katla(satir) {
  const enc = new TextEncoder(), parca = [];
  let cur = "", boy = 0, sinir = 75;
  for (const ch of satir) {
    const n = enc.encode(ch).length;
    if (boy + n > sinir) { parca.push(cur); cur = " "; boy = 1; sinir = 75; }
    cur += ch; boy += n;
  }
  parca.push(cur);
  return parca.join("\r\n");
}
export function takvimIcs({ kartlar = store.kartlar, gun = 14, saat = 9, sure = 15, simdi = Date.now() } = {}) {
  const st = utcAn(simdi);
  const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kenar Notu//Tekrar//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Kenar Notu tekrar"];
  for (const { bas, sayi } of takvimGunleri(kartlar, { gun, simdi })) {
    const tarih = yerelTarih(bas);
    const dk = Math.max(1, Math.round((sayi * 30) / 60));
    const ozet = sayi ? `Kenar Notu: ${sayi} kart tekrar` : "Kenar Notu: tekrar yok";
    const aciklama = sayi ? `Bugün ${sayi} kart bekliyor, yaklaşık ${dk} dk.` : "Bugün vakti gelen kart yok.";
    // Yerel saat (TZID'siz "kayan" saat): cihaz hangi saat dilimindeyse sabah 9
    satirlar.push("BEGIN:VEVENT", `UID:kenar-notu-tekrar-${tarih}@kenar-notu`, `DTSTAMP:${st}`,
      `DTSTART:${tarih}T${iki(saat)}0000`, `DURATION:PT${sure}M`, `SUMMARY:${icsMetin(ozet)}`, `DESCRIPTION:${icsMetin(aciklama)}`,
      "TRANSP:TRANSPARENT");
    if (sayi) satirlar.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsMetin(ozet)}`, "TRIGGER:PT0M", "END:VALARM");
    satirlar.push("END:VEVENT");
  }
  satirlar.push("END:VCALENDAR");
  return satirlar.map(katla).join("\r\n") + "\r\n";
}

// ---------- paylaş ya da indir ----------
const dosyaAdi = (kartlar, uzanti) => {
  const adlar = new Set(kartlar.map(belgeAdi));
  return `${adlar.size === 1 ? `${DESTE_KOK} ${[...adlar][0]}` : DESTE_KOK} (Anki).${uzanti}`;
};
// Döner: disa-aktar.js paylas sonucu ("paylasildi" | "indirildi" | "kaydedildi" | "iptal" | "bekliyor")
export async function ankiAktar(kartlar, { bicim = "apkg" } = {}) {
  if (!kartlar?.length) throw new Error("Aktarılacak kart yok");
  const [{ paylas }, blob] = await Promise.all([import("./disa-aktar.js"), bicim === "tsv" ? ankiTsvZip(kartlar) : ankiPaketi(kartlar)]);
  return paylas(blob, dosyaAdi(kartlar, bicim === "tsv" ? "zip" : "apkg"));
}
export async function takvimAktar(secenek = {}) {
  const { paylas } = await import("./disa-aktar.js");
  return paylas(new Blob([takvimIcs(secenek)], { type: "text/calendar" }), "Kenar Notu tekrar takvimi.ics");
}
