// Tekrar kartlarını dışarı verme (OZELLIKLER-8 1.2 ve 1.3): Anki paketi (.apkg), TSV + görseller zip, takvim (.ics).
// Sözleşme: ankiAktar(kartlar, { bicim: "apkg" | "tsv" }), takvimAktar({ saat: "HH:MM" }), ankiPaketi(kartlar), ankiTsvZip(kartlar), takvimIcs().
// sql.js (1.14.2, MIT, lib/sql-wasm.*) ve JSZip yalnız aktarırken yüklenir; ikisi de sw.js kabuğunda, çevrimdışı çalışır.
//
// .apkg: Anki 2.1'in eski şeması (collection.anki2, şema 11) + "media" JSON ({ "0": "ad.png" }) + numaralı medya dosyaları.
// Her kart iki alanlı (Ön, Arka) bir not; deste "Kenar Notu::<belge adı>". Not guid'i kart kimliğinden türer:
// aynı kart yeniden aktarılınca Anki onu çoğaltmaz, notu günceller (Anki'de zaten olan kartın takvimine dokunmaz).
// Takvim: hiç cevaplanmamış kart yeni kart (type 0) girer. Tekrar edilmiş kart tekrar kartıdır (type 2, queue 2):
// ivl gün, due koleksiyonun crt gününden sayılan gün, reps, lapses, SM-2 factor, gecmis'ten revlog (type 1, ease 1 ya da 3).
// Bilemedim sonrası kart bugün vadeli tekrar olur (ivl 1). FSRS bellek durumu cards.data içinde JSON:
// {"s","d","decay","lrt"} (Anki rslib storage/card/data.rs CardData; Anki 23.10 öncesi bu alanı okumaz, dokunmaz).
// Eski şema ve v1 zamanlayıcı bilerek seçildi: Anki 2.1.x de açar; yeni Anki içe alırken v2'ye yükseltir,
// yalnız tekrar kartı ve type 1 revlog olduğundan yükseltme hiçbir şeyi değiştirmez (v2_upgrade.sql yalnız type 0 ve 2'ye dokunur).
// Yeni Anki takvimi yalnız içe aktarma ekranında "Import any learning progress" açıksa alır; kapalıysa kartlar yeni girer.

import { store, belgeBul, gunBasi, gunFarki, fsrsHesapla, KUTU_ARALIK } from "./ortak.js";
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

// ---------- Anki zamanlaması ----------
const ANKI_DONUM = 4;          // Anki günü sabah 4'te döner; crt de Anki'nin kurduğu gibi bir günün saat 4'ü
const UNUTMA_IVL = -600;       // revlog'da bilemedim: eksi değer saniyedir, Anki'nin 10 dakikalık yeniden öğrenme adımı gibi
const faktor = (lapses) => Math.max(1300, 2500 - 200 * lapses);
const yuvarla = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

// Kartın Anki takvimi. Hiç cevaplanmamış kartta null (yeni kart kalır).
// fark: vadeye kalan takvim günü (bugün 0, gecikmişte eksi). revlog geçmiş FSRS ile yeniden oynatılarak kurulur.
export function ankiTakvim(k, simdi = Date.now()) {
  const gecmis = (Array.isArray(k.gecmis) ? k.gecmis : []).filter((g) => g && Number.isFinite(g.zaman)).sort((a, b) => a.zaman - b.zaman);
  const kutu = Math.min(5, Math.max(1, k.kutu || 1));
  if (!gecmis.length && !(k.fsrs?.s > 0) && kutu === 1) return null;
  const revlog = [];
  let durum = { kutu: 1, gecmis: [] }, lapses = 0, basarili = false, onceki = 0;
  for (const g of gecmis) {
    const c = fsrsHesapla(durum, g.bildi, g.zaman);
    if (!g.bildi && basarili) lapses++;
    if (g.bildi) basarili = true;
    const ivl = g.bildi ? c.aralik : UNUTMA_IVL;
    revlog.push({ zaman: g.zaman, ease: g.bildi ? 3 : 1, ivl, lastIvl: onceki, factor: faktor(lapses) });
    onceki = ivl;
    durum = { kutu: c.kutu, fsrs: c.fsrs };
  }
  const son = gecmis.length ? gecmis[gecmis.length - 1] : null;
  const sonZaman = son?.zaman ?? k.fsrs?.son;
  const sonraki = Number.isFinite(k.sonraki) ? k.sonraki : simdi;
  // Tekrar kartında aralık en az 1 gün: bilemedim sonrası kart bugün vadeli, 1 günlük tekrar olur
  const ivl = Number.isFinite(sonZaman) ? Math.max(1, gunFarki(sonraki, sonZaman)) : KUTU_ARALIK[kutu];
  // Son cevap "bildim" ise revlog'daki aralık kartın gerçek aralığıdır (eski Leitner kartında yeniden oynatma farklı çıkabilir)
  if (son?.bildi) revlog[revlog.length - 1].ivl = ivl;
  const f = k.fsrs;
  const data = f?.s > 0 && f.d > 0 ? JSON.stringify({ s: yuvarla(f.s, 4), d: yuvarla(f.d, 3), decay: 0.5,
    ...(Number.isFinite(f.son) ? { lrt: Math.floor(f.son / 1000) } : {}) }) : "";
  return { fark: gunFarki(sonraki, simdi), ivl, reps: gecmis.length, lapses, factor: faktor(lapses), data, revlog };
}

// Koleksiyonun oluşturulma anı (sn): Anki'nin bugününün saat 4'ü, gecikmiş kart eksi vadeye düşmesin diye geriGun gün önce
function koleksiyonCrt(simdi, geriGun) {
  const d = new Date(simdi);
  if (d.getHours() < ANKI_DONUM) d.setDate(d.getDate() - 1);
  d.setHours(ANKI_DONUM, 0, 0, 0);
  d.setDate(d.getDate() - geriGun);
  return Math.floor(d.getTime() / 1000);
}

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
    // Vade günleri crt'den sayılır: en çok gecikmiş kart koleksiyonun ilk günü (0) olur, bugün geriGun'dür
    const takvimler = notlar.map((n) => ankiTakvim(n.k, simdi));
    const geriGun = Math.max(0, ...takvimler.map((t) => (t ? -t.fark : 0)));
    db.run(`INSERT INTO col VALUES (1, ${tam(koleksiyonCrt(simdi, geriGun))}, ${tam(simdi)}, ${tam(simdi)}, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`,
      [JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf)]);
    const revlogIdler = new Set();
    let yeniSira = 0;
    notlar.forEach((n, i) => {
      const id = simdi + i, sfld = duzMetin(n.on), t = takvimler[i];
      const csum = parseInt(sha1Hex(sfld).slice(0, 8), 16);
      db.run(`INSERT INTO notes VALUES (${tam(id)}, ?, ${MODEL_ID}, ${simdiSn}, -1, ?, ?, ?, ${csum}, 0, '')`,
        [guid(n.k), ` ${n.etiketler.join(" ")} `, n.on + AYRAC + n.arka, sfld]);
      const did = tam(desteler.get(n.deste));
      if (!t) {
        db.run(`INSERT INTO cards VALUES (${tam(id)}, ${tam(id)}, ${did}, 0, ${simdiSn}, -1, 0, 0, ${++yeniSira}, 0, 0, 0, 0, 0, 0, 0, 0, '')`);
        return;
      }
      // Tekrar kartı: type 2, queue 2, due crt gününden sayılan gün
      db.run(`INSERT INTO cards VALUES (${tam(id)}, ${tam(id)}, ${did}, 0, ${simdiSn}, -1, 2, 2, ${geriGun + t.fark}, ${t.ivl}, ${t.factor},
        ${t.reps}, ${t.lapses}, 0, 0, 0, 0, ?)`, [t.data]);
      for (const r of t.revlog) {
        let rid = Math.trunc(r.zaman);
        while (revlogIdler.has(rid)) rid++;
        revlogIdler.add(rid);
        db.run(`INSERT INTO revlog VALUES (${tam(rid)}, ${tam(id)}, -1, ${r.ease}, ${r.ivl}, ${r.lastIvl}, ${r.factor}, 0, 1)`);
      }
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
  // Not türü başlığı yok: Anki hazır türün adını dile göre koyar (Türkçede "Basic" değil "Temel"), ad tutmazsa başlık boşa düşer.
  // Türü içe aktarma ekranı seçer (son kullanılan, çoğunlukla iki alanlı Temel); ilk iki sütun sırayla Ön ve Arka alanına gider.
  const satirlar = ["#separator:tab", "#html:true", "#deck column:3", "#tags column:4", "#guid column:5"];
  for (const n of notlar) satirlar.push([n.on, n.arka, n.deste, n.etiketler.join(" "), guid(n.k)].map(alan).join("\t"));
  const zip = new JSZip();
  zip.file("kartlar.txt", satirlar.join("\n") + "\n");
  zip.file("OKU.txt", [
    "Kenar Notu kartları (Anki metin içe aktarma)",
    "",
    "1. medya klasöründeki görselleri Anki'nin collection.media klasörüne kopyala",
    "   (Anki masaüstü: Araçlar > Medyayı denetle > Medya klasörünü aç).",
    "2. Anki'de Dosya > İçe aktar ile kartlar.txt dosyasını seç.",
    "3. Not türü olarak iki alanlı Temel (İngilizcede Basic) türünü seç.",
    "Deste ve etiketler dosyadaki sütunlardan okunur.",
  ].join("\n") + "\n");
  for (const m of medya) zip.file("medya/" + m.ad, m.blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/zip" });
}

// ---------- takvim (.ics) ----------
// Önümüzdeki gun gün için her güne bir etkinlik: o gün vakti gelen kart sayısı (FSRS tarihlerinden, bugün gecikenler dahil).
// Yalnız kartlı günler etkinlik olur, başında hatırlatma (VALARM). UID güne bağlı: yeniden eklenen takvim eski etkinlikleri günceller.
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
// Saat "07:30" ya da 7 gibi gelir; bozuksa 09:00
export const TAKVIM_SAAT = "09:00";
export function saatCoz(saat) {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(saat ?? "").trim());
  const s = m ? +m[1] : NaN, d = m ? +(m[2] || 0) : NaN;
  return s >= 0 && s < 24 && d >= 0 && d < 60 ? { s, d } : saatCoz(TAKVIM_SAAT);
}
// Kart olmayan güne etkinlik yazılmaz
export function takvimIcs({ kartlar = store.kartlar, gun = 14, saat = TAKVIM_SAAT, sure = 15, simdi = Date.now() } = {}) {
  const st = utcAn(simdi), { s: sa, d: dak } = saatCoz(saat);
  const satirlar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kenar Notu//Tekrar//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Kenar Notu tekrar"];
  for (const { bas, sayi } of takvimGunleri(kartlar, { gun, simdi })) {
    if (!sayi) continue;
    const tarih = yerelTarih(bas);
    const dk = Math.max(1, Math.round((sayi * 30) / 60));
    const ozet = `Kenar Notu: ${sayi} kart tekrar`;
    // Yerel saat (TZID'siz "kayan" saat): cihaz hangi saat dilimindeyse seçilen saat
    satirlar.push("BEGIN:VEVENT", `UID:kenar-notu-tekrar-${tarih}@kenar-notu`, `DTSTAMP:${st}`,
      `DTSTART:${tarih}T${iki(sa)}${iki(dak)}00`, `DURATION:PT${sure}M`, `SUMMARY:${icsMetin(ozet)}`,
      `DESCRIPTION:${icsMetin(`Bugün ${sayi} kart bekliyor, yaklaşık ${dk} dk.`)}`, "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsMetin(ozet)}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT");
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
