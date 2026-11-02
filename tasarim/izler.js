// Kenar Notu: izler (OZELLIKLER-5 "İzler", TASARIM-3 10). Kalemin değdiği yerler bir arada:
// kitabın cep defteri, Notlar panelinin İzler sekmesi, bütün kitaplığın "İzlerim" ekranı ve derlemeler.
//
//   izleriTopla(belge, kaynak?)  -> [{ id, tur, metin, konum: { sayfa } | { p, oran }, zaman, renk, onizleme, ... }]
//                                   belge.veri.izler + vurgular + Active Canvas boşlukları + notlar + kenar notları
//                                   kaynak: arama.js govdeKaynagi (EPUB'da vurgu metni ve bölüm adı için)
//   izlerPaneli(kap, belge)      Notlar panelinin "İzler" sekmesi: süzgeç ve bölüm ya da sayfaya göre gruplu liste
//   izlerPaneliAc(belge, { kap }) "izler:ac" olayı: kap verilirse onun içine, yoksa açık ekranın üstünde kendi panelinde
//   defterAc(belge)              cep defteri ("defter:ac"); alıntılar, kısa not, Markdown ve PDF
//   ac(kap), kapat()             İzlerim ekranı (#izler): defter rafı, bütün izler, derlemeler
//   izSayisi(belge)              Koltuk ve Masa üst çubuğundaki defter simgesinin sayısı
// İze dokununca bus.emit("git", { ekran: "belge", belgeId, sayfa | konum, izId }); kabuk belge açılınca
// "iz:goster" yayınlar, ekranı açan modül izi bir an parlatır (TASARIM-3 7.8).
// Veriyi yalnız okur; yazdığı tek şey izin ve vurgunun yanındaki kısa not (iz.not, vurgu.not) ve store.derlemeler.
//
// 7.0 (TASARIM-5 11.6):
//   Etiketler: iz notunda ve yapışkan not metninde "#kelime" (iz-bag.js etiketleriOku). Ayrı alan yok, x.etiketler hesaplanır.
//     İzlerim'de etiket çipleri süzer (çoklu seçim: hepsini taşıyan izler), satırdaki etikete dokunmak onu seçer.
//   Bağlar: iz kaydında baglar: [{ tur: "iz" | "sayfa" | "belge" | "url", hedef, ad }] (yazdığı ikinci alan).
//     hedef: iz { belgeId, izId }, sayfa { belgeId, sayfa }, belge { belgeId }, url "https://...". İzin "Bağla" fişi
//     (bagFisiAc) bağ ekler ve çıkarır, "Geri bağlantılar"ı bütün izleri tarayarak gösterir (kaydedilmez).
//     Hedefi silinmiş bağ soluk çiptir ve "Bulunamadı" der.
//   İçe aktarılan alıntılar (Kindle, Readwise): veri.izler içinde tur: "alinti" { id, tur, metin, not?, zaman, kaynakKonum,
//     sira, iceAktarim, notMu?, cizgiler: [], bas: { p: -1, o: 0 } }. Konumsuzdur: İzlerim ve cep defterinde görünür,
//     okuma ekranında çizilmez. cizgiler: [] ve bas.p = -1, Koltuk'un iz süzgecinin (cizgiler dizisi şart) kaydı silmemesi
//     ve geçersiz konum diye çizmemesi içindir; Masa sayfaId'siz kaydı olduğu gibi bırakır.

import { $, $$, h, icon, bus, store, belgeBul, yeniId, toast, kartEkle, hareketAz, cizgiMi, EPUB_VURGULARI, vurguRengi,
  exLibrisSvg, exLibrisVar, odakla, simgeEkle, kisayolEkle } from "./ortak.js";
import { etiketleriOku, disariAc } from "./iz-bag.js";
import { matematikCiz, matematikVarMi, mathmlCiz } from "./matematik.js";
import { t, yerel, ingilizceMi } from "./dil.js";

/* ================= Yardımcılar ================= */
const SUZGECLER = [["tumu", t("Tümü")], ["alt", t("Altı çizili")], ["daire", t("Yuvarlak")], ["kenar", t("Kenar")], ["isaret", t("İşaret")], ["vurgu", t("Vurgu")], ["not", t("Not")], ["alinti", t("İçe aktarılan")]];
const TUR_ADI = { alt: t("Altı çizili"), ustu: t("Üstü çizili"),daire: t("Yuvarlak içinde"), kenar: t("Kenar işareti"), isaret: t("İşaret"), serbest: t("Kalem izi"), vurgu: t("Vurgu"), not: t("Not"), alinti: t("Alıntı") };

// 7.0 simgeleri: bağ (iki halka), etiket (kare etiket), içe aktar (aşağı ok ve tepsi)
simgeEkle("bag", '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>');
simgeEkle("etiket", '<path class="d" d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0Z"/><circle cx="8" cy="8" r="1.4"/>');
simgeEkle("ice-aktar", '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>');
// Kısayol listesi (kabuğun Kısayollar sayfası); tuşları bu dosya dinler
kisayolEkle({ tus: "Enter", ad: t("Seçili ize git"), alan: "izler" });
kisayolEkle({ tus: "Esc", ad: t("İzler panelini ya da cep defterini kapat"), alan: "izler" });
kisayolEkle({ tus: "Ctrl Shift I", ad: t("Vurguları içe aktar (Kindle, Readwise)"), alan: "izler" });
kisayolEkle({ tus: "Ctrl Shift E", ad: t("Etiket süzgecini temizle"), alan: "izler" });
const IZ_TURLERI = new Set(["alt", "daire", "kenar", "isaret", "serbest"]);
const MAKS_METIN = 280;

const sade = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const kirp = (s, n = MAKS_METIN) => { const t = sade(s); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const harfsiz = (s) => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const VURGU_HEX = Object.fromEntries(EPUB_VURGULARI.map(([ad, hex]) => [harfsiz(ad), hex]));
const vurguHex = (r) => (typeof r === "string" && r.startsWith("#") ? vurguRengi(r) : VURGU_HEX[harfsiz(r)] || "#F4D63E");

function neZaman(z) {
  if (!z) return "";
  const simdi = new Date(), fark = simdi - z;
  if (fark < 6e4) return t("az önce");
  if (fark < 36e5) return t("{n} dk önce", { n: Math.round(fark / 6e4) });
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const gun = Math.ceil((bugun - z) / 864e5);
  if (gun <= 0) return t("{n} saat önce", { n: Math.round(fark / 36e5) });
  if (gun === 1) return t("dün");
  if (gun < 7) return t("{n} gün önce", { n: gun });
  return tarih(z);
}
// Biçimleyici bir kez kurulur: her satırda toLocaleDateString çağırmak 5000 izde 1 sn'yi aşıyordu
const TARIH_BICIM = new Intl.DateTimeFormat(yerel, { day: "numeric", month: "short", year: "numeric" });
const tarih = (t) => (t ? TARIH_BICIM.format(new Date(t)) : "");

/* ================= Önizleme: izin kendi mürekkep yolu ================= */
// Çizgiler 48x32'lik kutuya en-boy oranı korunarak sığdırılır; yol çizildiği gibi kalır (el titremesi dahil)
const KUTU_W = 48, KUTU_H = 32, PAY = 3;
function yolKur(cizgiler) {
  const izler = (cizgiler || []).map((c) => (Array.isArray(c?.p) ? c.p : Array.isArray(c) ? c : null)).filter((p) => p && p.length);
  if (!izler.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of izler) for (const q of p) {
    if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue;
    if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
  }
  if (!Number.isFinite(x0)) return null;
  const w = Math.max(x1 - x0, 1e-6), hY = Math.max(y1 - y0, 1e-6);
  const o = Math.min((KUTU_W - 2 * PAY) / w, (KUTU_H - 2 * PAY) / hY);
  const dx = (KUTU_W - w * o) / 2 - x0 * o, dy = (KUTU_H - hY * o) / 2 - y0 * o;
  const r = (v) => Math.round(v * 10) / 10;
  return izler.map((p) => {
    const adim = Math.max(1, Math.floor(p.length / 90));   // uzun izde nokta seyreltilir: yol kısa kalır
    let d = "";
    for (let i = 0; i < p.length; i += adim) d += `${i ? "L" : "M"}${r(p[i][0] * o + dx)} ${r(p[i][1] * o + dy)}`;
    const s = p[p.length - 1];
    d += p.length === 1 ? "l.1 0" : `L${r(s[0] * o + dx)} ${r(s[1] * o + dy)}`;
    return d;
  }).join("");
}
// Çizgisi bulunamayan iz için türünün el yapımı simgesi
const GLIF = {
  alt: "M5 21.5C12 20.2 18 22.6 25 21.4S37 20.4 43 21.8",
  daire: "M26 6.5C37 6.4 44 11 44 16.5S36 26.5 24 26.6 4 22.5 4.2 16.2 12.5 5.8 27.5 7.4",
  kenar: "M24 3.5C23.2 12 24.6 20 23.6 28.5",
  isaret: "M24 5L26.8 12.6 35 13 28.6 18.2 31 26.4 24 21.8 17 26.4 19.4 18.2 13 13 21.2 12.6Z",
  serbest: "M5 20C10 9 15 9 18 17S27 25 30 14 39 8 43 18",
};
function svgOnizleme(d, renk, sinif = "") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${KUTU_W} ${KUTU_H}`);
  svg.setAttribute("aria-hidden", "true");
  if (sinif) svg.setAttribute("class", sinif);
  if (renk) svg.style.setProperty("--iz-renk", renk);
  const yol = document.createElementNS(ns, "path");
  yol.setAttribute("d", d);
  yol.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(yol);
  return svg;
}

/* ================= Toplama ================= */
// Masa ve çizgi roman izinin çizgileri sayfanın kendi listesinde: sayfa kimliğiyle ya da ekrandaki numarayla bulunur
function sayfaCizgileri(v, iz) {
  if (!Array.isArray(iz.cizgiIdleri) || !iz.cizgiIdleri.length) return null;
  const idler = new Set(iz.cizgiIdleri);
  // Çizgi roman (cizgi.js): veri.cizgi.cizgiler["<sayfa sırası, 0'dan>"]
  // Yalnız çizgi roman izi bu depoya bakar; aynı PDF'in Masa izi sayfanın kendi çizgilerinde
  const cz = v?.cizgi?.cizgiler;
  if (iz.kaynak === "cizgi") {
    const l = cz && typeof cz === "object" && Number.isFinite(Number(iz.sayfa)) ? cz[String(Number(iz.sayfa) - 1)] : null;
    return Array.isArray(l) ? l.filter((c) => idler.has(c.id)) : null;
  }
  const ss = v?.sayfalar;
  if (!Array.isArray(ss)) return null;
  let s = iz.sayfaId ? ss.find((x) => x?.id === iz.sayfaId) : null;
  if (!s && Number.isFinite(Number(iz.sayfa))) s = ss[Number(iz.sayfa) - (v.ilkNo || 1)];
  if (!Array.isArray(s?.cizgiler)) return null;
  return s.cizgiler.filter((c) => idler.has(c.id));
}
const sayfaNo = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// EPUB vurgusunun formülleri (okuma.js vurgu.formuller: { p, a, b, ml }): alıntı metin ve formül parçalarıyla
// kurulur, satırda formül MathML olarak çizilir. Boşluklar ve uzunluk sınırı kirp ile aynı. Formülsüzse null.
// Paragraf metni arama dizininden; dizin yoksa tek paragraflık vurguda kaydın kendi metninden (bas.o kaydırmasıyla).
function formulluParcalar(vg, kaynak) {
  const fs = Array.isArray(vg.formuller) ? vg.formuller : null;
  if (!fs?.length) return null;
  const ham = [];
  for (let p = vg.bas.p; p <= vg.son.p; p++) {
    let pm = kaynak?.metin(p) ?? null, kay = 0;
    if (pm == null && vg.bas.p === vg.son.p && typeof vg.metin === "string") { pm = vg.metin; kay = vg.bas.o || 0; }
    if (pm == null) return null;
    const dilim = (a, b) => pm.slice(Math.max(0, a - kay), Math.max(0, b - kay));
    const a0 = p === vg.bas.p ? vg.bas.o || 0 : 0, b0 = p === vg.son.p ? vg.son.o : pm.length + kay;
    if (ham.length) ham.push(" ");
    let k = a0;
    for (const f of fs) {
      if (f.p !== p || f.b <= a0 || f.a >= b0 || f.b <= k) continue;
      if (f.a > k) ham.push(dilim(k, f.a));
      ham.push({ ml: f.ml, duz: dilim(f.a, f.b) });
      k = f.b;
    }
    if (k < b0) ham.push(dilim(k, b0));
  }
  const out = [];
  let n = 0;
  for (const [i, x] of ham.entries()) {
    if (typeof x !== "string") { out.push(x); n += x.duz.length; continue; }
    let t = x.replace(/\s+/g, " ");
    if (!out.length) t = t.trimStart();
    if (i === ham.length - 1) t = t.trimEnd();
    if (n + t.length > MAKS_METIN) { out.push(t.slice(0, Math.max(0, MAKS_METIN - 1 - n)).trimEnd() + "…"); break; }
    if (t) out.push(t);
    n += t.length;
  }
  return out.some((x) => typeof x !== "string") ? out : null;
}

// İçe aktarılan alıntının kayıtlı konumu Türkçe yazılır ("Konum 180-182", "s. 12"); kayıt aynen kalır,
// İngilizce arayüzde yalnız görüntü çevrilir
function iceYer(konum) {
  const s = String(konum || "");
  return ingilizceMi ? s.replace(/^Konum /, "Location ").replace(/^s\. /, "p. ") : s;
}

export function izleriTopla(belge, kaynak = null) {
  const v = belge?.veri;
  if (!v || typeof v !== "object") return [];
  const liste = [];
  const metinAl = (bas, son) => {
    if (!kaynak || !bas || !son) return "";
    let m = "";
    for (let p = bas.p; p <= son.p && m.length < MAKS_METIN + 40; p++) {
      const pm = kaynak.metin(p);
      if (pm == null) return "";
      m += (m ? " " : "") + pm.slice(p === bas.p ? bas.o || 0 : 0, p === son.p ? son.o : pm.length);
    }
    return kirp(m);
  };
  const oran = (p, o) => { const m = kaynak?.metin(p); return m && m.length ? Math.max(0, Math.min(1, (o || 0) / m.length)) : 0; };
  const epubKonum = (p, o = 0, oranVar = null) => ({ p, oran: oranVar ?? oran(p, o) });
  const ortak = { belgeId: belge.id };

  // 1) Kalem izleri (Koltuk metne, Masa ve çizgi roman sayfaya bağlı)
  for (const iz of Array.isArray(v.izler) ? v.izler : []) {
    if (!iz?.id) continue;
    // İçe aktarılan alıntı (Kindle, Readwise): metinli, konumsuz; yer etiketi kaynağın konumu ("Konum 180-182", "s. 12")
    if (iz.tur === "alinti") {
      liste.push({ ...ortak, id: iz.id, kaynak: "alinti", tur: iz.notMu ? "not" : "alinti", metin: kirp(iz.metin), not: iz.not || "", zaman: iz.zaman || 0,
        renk: "", konum: { sayfa: null }, ice: iceYer(iz.kaynakKonum), iceSira: Number(iz.sira) || 0, onizleme: null, kayit: iz });
      continue;
    }
    // Masa'nın fosforlu kalemi (arac: "fosforlu") listede vurgudur; kurşun kalem izi soluk ve "kurşun" etiketli
    const tur = iz.arac === "fosforlu" ? "vurgu" : IZ_TURLERI.has(iz.tur) ? iz.tur : "serbest";
    const metne = iz.bas && Number.isInteger(iz.bas.p);
    const cizgiler = metne ? iz.cizgiler : sayfaCizgileri(v, iz) || iz.cizgiler;
    liste.push({
      ...ortak, id: iz.id, kaynak: "iz", tur, metin: kirp(iz.metin), not: iz.not || "", zaman: iz.zaman || 0, renk: iz.renk || "",
      kursun: iz.kursun || iz.kalem === "kursun" || iz.arac === "kursun" || undefined,
      konum: metne ? epubKonum(iz.bas.p, iz.bas.o) : { sayfa: sayfaNo(iz.sayfa) },
      kutu: Array.isArray(iz.kutu) ? iz.kutu : null,
      onizleme: yolKur(cizgiler) || GLIF[tur], kayit: iz,
    });
  }
  // 2) EPUB vurguları ve kenar notları
  for (const vg of Array.isArray(v.vurgular) ? v.vurgular : []) {
    if (!vg?.bas) continue;
    liste.push({
      ...ortak, id: vg.id || `v-${vg.bas.p}-${vg.bas.o}`, kaynak: "vurgu", tur: "vurgu", metin: kirp(vg.metin) || metinAl(vg.bas, vg.son),
      not: vg.not || "", zaman: vg.zaman || 0, renk: vurguHex(vg.renk), konum: epubKonum(vg.bas.p, vg.bas.o), onizleme: null, kayit: vg,
      parcalar: formulluParcalar(vg, kaynak),
    });
  }
  // 3) Active Canvas: satır arasına açılan el yazısı boşlukları
  for (const t of Array.isArray(v.tuvaller) ? v.tuvaller : []) {
    if (!t || !Number.isInteger(t.p) || !t.cizgiler?.length) continue;
    liste.push({
      ...ortak, id: t.id || `t-${t.p}`, kaynak: "tuval", tur: "not", metin: "", not: "", zaman: t.zaman || 0, renk: t.cizgiler[0]?.renk || "",
      konum: epubKonum(t.p, 0, Number(t.oran) || 0), onizleme: yolKur(t.cizgiler) || GLIF.serbest, bolumAdi: t.bolum || "", kayit: t,
    });
  }
  // 4) Asistanın kenara yazdığı notlar (Koltuk)
  for (const n of Array.isArray(v.asistanNotlari) ? v.asistanNotlari : []) {
    if (!n?.metin) continue;
    const metne = Number.isInteger(n.p) && n.p >= 0;
    liste.push({ ...ortak, id: n.id || `an-${n.p}`, kaynak: "asistan", tur: "not", metin: kirp(n.metin), not: "", zaman: n.zaman || 0, renk: "",
      konum: metne ? epubKonum(n.p, 0, 0) : { sayfa: sayfaNo(n.sayfa) }, onizleme: null, kayit: n });
  }
  // 5) Masa: yapışkan notlar ve metin kutuları (damga ölçü işaretidir, iz sayılmaz)
  if (Array.isArray(v.sayfalar)) {
    const ilk = v.ilkNo || 1;
    v.sayfalar.forEach((s, j) => {
      if (!s) return;
      const sayfa = ilk + j;
      for (const [k, n] of (s.notlar || []).entries()) {
        if (!n || !sade(n.metin)) continue;
        liste.push({ ...ortak, id: n.id || `n-${s.id || j}-${k}`, kaynak: "not", tur: "not", metin: kirp(n.metin), not: "", zaman: n.zaman || 0,
          renk: n.renk || "", konum: { sayfa }, onizleme: null, kayit: n });
      }
      for (const [k, m] of (s.metinler || []).entries()) {
        if (!m || m.tur === "damga" || !sade(m.metin)) continue;
        liste.push({ ...ortak, id: m.id || `m-${s.id || j}-${k}`, kaynak: m.tur === "asistan" ? "asistan" : "metin", tur: "not", metin: kirp(m.metin), not: "",
          zaman: m.zaman || 0, renk: m.renk || "", konum: { sayfa }, onizleme: null, kayit: m });
      }
    });
  }
  // Konum etiketi ve grup: EPUB'da bölüm ve kitapta yüzde, sayfalılarda sayfa
  for (const x of liste) {
    // Etiketler: notun (ve yapışkan notla metin kutusunun kendi metninin) #kelime yazımları; bağlar kaydın kendisinden
    x.etiketler = etiketleriOku([x.not, x.kaynak === "not" || x.kaynak === "metin" ? x.kayit?.metin : ""].filter(Boolean).join(" "));
    x.baglar = Array.isArray(x.kayit?.baglar) ? x.kayit.baglar.filter((b) => b && b.tur) : [];
    if (x.kaynak === "alinti") { x.yer = x.ice; x.grup = t("İçe aktarılan"); x.sira = 1e7 + x.iceSira; continue; }
    if (x.konum.p != null) {
      const yuzde = kaynak?.adet ? Math.round((x.konum.p / kaynak.adet) * 100) : null;
      x.bolum = x.bolumAdi || kaynak?.bolum(x.konum.p) || "";
      x.yer = yuzde != null ? (ingilizceMi ? `${yuzde}%` : `%${yuzde}`) : "";
      x.grup = x.bolum || t("Kitap");
      x.sira = x.konum.p + (x.konum.oran || 0);
    } else {
      x.yer = x.konum.sayfa != null ? t("s. {n}", { n: x.konum.sayfa }) : "";
      x.grup = x.yer || t("Sayfasız");
      x.sira = (x.konum.sayfa ?? 1e6) + (x.kutu ? x.kutu[1] || 0 : 0);
    }
  }
  liste.sort((a, b) => a.sira - b.sira || (a.zaman || 0) - (b.zaman || 0));
  return liste;
}

// Üst çubuktaki defter simgesinin sayısı: cep defterine düşen alıntılar (izler ve vurgular)
export function izSayisi(belge) {
  const v = belge?.veri;
  if (!v) return 0;
  return (Array.isArray(v.izler) ? v.izler.length : 0) + (Array.isArray(v.vurgular) ? v.vurgular.length : 0);
}

// EPUB'da metin ve bölüm adı arama dizininden gelir; dizin hazır değilse metinsiz döner (önizleme yine görünür)
async function kaynakAl(belge) {
  if (belge?.tur !== "epub") return null;
  try { return await (await import("./arama.js")).govdeKaynagi(belge.id); } catch { return null; }
}
async function hazirla(belge) { return izleriTopla(belge, await kaynakAl(belge)); }

const suzgecUyar = (x, f) => f === "tumu" || x.tur === f || (f === "not" && !!sade(x.not)) || (f === "alinti" && x.kaynak === "alinti");
const defterde = (x) => x.kaynak === "iz" || x.kaynak === "vurgu" || x.kaynak === "alinti";
// Etiket süzgeci: seçili etiketlerin hepsini taşıyan izler
const etiketUyar = (x, secili) => !secili?.size || [...secili].every((e) => x.etiketler?.includes(e));
function etiketSay(liste) {
  const m = new Map();
  for (const x of liste) for (const e of x.etiketler || []) m.set(e, (m.get(e) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], yerel));
}

/* ================= Eylemler ================= */
function gitIz(x, { kapat } = {}) {
  const b = belgeBul(x.belgeId);
  if (!b) { toast(t("Bu belge kitaplıkta yok.")); return; }
  const o = { ekran: "belge", belgeId: b.id, izId: x.id };
  if (x.konum.p != null) o.konum = { p: x.konum.p, oran: x.konum.oran || 0 };
  else if (x.konum.sayfa != null) o.sayfa = x.konum.sayfa;
  kapat?.();
  bus.emit("git", o);
}

function kartaCevir(x) {
  const b = belgeBul(x.belgeId);
  if (!x.metin) { toast(t("Bu izin altında metin yok; karta çevrilemez.")); return; }
  const yer = [x.yer, x.bolum].filter(Boolean).join(", ");
  kartEkle({
    tur: "soru", on: { metin: `“${x.metin}”` }, arka: { metin: sade(x.not) || [b?.ad, yer].filter(Boolean).join(" · ") },
    belgeId: x.belgeId, belgeAd: b?.ad || "", sayfa: x.konum.sayfa ?? 1, izId: x.id,
  });
  toast(t("Karta çevrildi"), { etiket: t("Tekrar’a git"), calistir: () => bus.emit("git", { ekran: "tekrar" }) });
}

// İzin ve vurgunun kısa notu kendi kaydına yazılır (vurguda zaten "Kenar notu" alanı)
// Zamanlayıcı belge başına: iki belgenin notu art arda yazılınca ilki düşmesin
const notZaman = new Map();
function notYaz(x, deger) {
  if (!x.kayit || (x.kaynak !== "iz" && x.kaynak !== "vurgu" && x.kaynak !== "alinti")) return;
  const t = String(deger || "").slice(0, 600);
  if (t.trim()) x.kayit.not = t; else delete x.kayit.not;
  x.not = t;
  x.etiketler = etiketleriOku(t);
  clearTimeout(notZaman.get(x.belgeId));
  notZaman.set(x.belgeId, setTimeout(() => { notZaman.delete(x.belgeId); bus.emit("belge:degisti", { belgeId: x.belgeId }); }, 400));
}

/* ---------- küçük fiş (deftere ekle) ---------- */
let acikFis = null;
function fisAc(capa, icerik, { sinif = "", rol = "menu", etiket = null } = {}) {
  fisKapat();
  const el = h("div", { class: ("izler-fis cam-yuzey " + sinif).trim(), role: rol, "aria-label": etiket }, icerik);
  document.body.append(el);
  // İçerik değişince (bağ fişinde sekme) yeniden yerleşir: tetikleyicinin altı, sığmazsa üstü, o da olmazsa ekranın içi
  const konumla = () => {
    const r = capa.isConnected ? capa.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3 };
    const w = el.offsetWidth, y = el.offsetHeight;
    el.style.left = `${Math.round(Math.min(Math.max(8, r.right - w), innerWidth - w - 8))}px`;
    const alt = r.bottom + 6, ust = r.top - y - 6;
    el.style.top = `${Math.round(alt + y <= innerHeight - 8 ? alt : ust >= 8 ? ust : Math.max(8, innerHeight - y - 8))}px`;
  };
  konumla();
  const disari = (e) => { if (!el.contains(e.target) && !capa.contains(e.target)) fisKapat(); };
  const tus = (e) => { if (e.key === "Escape") { e.stopPropagation(); fisKapat(); } };
  setTimeout(() => document.addEventListener("pointerdown", disari, true), 0);
  document.addEventListener("keydown", tus, true);
  acikFis = { el, konumla, kapat: () => { document.removeEventListener("pointerdown", disari, true); document.removeEventListener("keydown", tus, true); el.remove(); } };
  $("button, input", el)?.focus({ preventScroll: true });
  return acikFis;
}
function fisKapat() { acikFis?.kapat(); acikFis = null; }

function derlemeyeEkleFisi(capa, x) {
  const ekle = (d) => {
    if (d.girdiler.some((g) => g.belgeId === x.belgeId && g.izId === x.id)) { toast(t("Zaten “{ad}” içinde", { ad: d.ad })); fisKapat(); return; }
    d.girdiler.push({ belgeId: x.belgeId, izId: x.id });
    bus.emit("derlemeler", { tur: "guncelle", id: d.id });
    toast(t("“{ad}” derlemesine eklendi", { ad: d.ad }));
    fisKapat();
  };
  const ad = h("input", { class: "izler-girdi", placeholder: t("Yeni derlemenin adı"), "aria-label": t("Yeni derlemenin adı"), maxlength: "80", enterkeyhint: "done" });
  const form = h("form", { class: "izler-fis__form" }, ad, h("button", { class: "hayalet", type: "submit" }, t("Oluştur")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = derlemeOlustur(ad.value.trim() || t("Adsız derleme"), []);
    ekle(d);
  });
  fisAc(capa, [
    h("p", { class: "izler-fis__baslik" }, t("Deftere ekle")),
    ...store.derlemeler.map((d) => h("button", { class: "izler-fis__satir", type: "button", role: "menuitem", onclick: () => ekle(d) },
      icon("izler", "i-20"), h("span", {}, d.ad), h("small", {}, String(d.girdiler.length)))),
    form,
  ]);
}

function derlemeOlustur(ad, girdiler) {
  const d = { id: yeniId("dr"), ad: ad.slice(0, 80), olusturma: Date.now(), girdiler };
  store.derlemeler.unshift(d);
  bus.emit("derlemeler", { tur: "ekle", id: d.id });
  return d;
}

/* ================= Satır (panel ve İzlerim ortak) ================= */
// Alıntı ve notta $...$ varsa gerçek formül (Temml yalnız gerekince yüklenir); çizilemezse metin kalır
function formullu(el) {
  if (el && matematikVarMi(el.textContent)) matematikCiz(el).catch(() => {});
  return el;
}
// Alıntının metni: EPUB vurgusunda kaydedilmiş formüller MathML (x.parcalar), yoksa düz metin ve $...$
function alintiMetni(el, x, bos) {
  if (x.parcalar) el.append(...x.parcalar.map((p) => (typeof p === "string" ? p : mathmlCiz(p.ml, p.duz))));
  else el.append(x.metin || bos);
  return formullu(el);
}
function onizlemeEl(x, sinif = "iz-onizleme") {
  const kap = h("span", { class: sinif + (x.kursun ? " kursun" : ""), "aria-hidden": "true" });
  if (x.tur === "vurgu") kap.append(h("i", { class: "iz-vurgu-serit", style: `--iz-renk:${x.renk}` }));
  else if (x.onizleme) kap.append(svgOnizleme(x.onizleme, x.renk || null));
  else kap.append(icon(x.kaynak === "asistan" ? "sor" : x.kaynak === "alinti" ? "ice-aktar" : "notlar", "i-20"));
  return kap;
}
function eylemler(x) {
  const kart = h("button", { class: "simge-dugme karta-cevir", type: "button", "aria-label": t("Karta çevir"), title: t("Karta çevir"), disabled: !x.metin || null }, icon("karta-cevir", "i-20"));
  kart.addEventListener("click", (e) => { e.stopPropagation(); kartaCevir(x); });
  const defter = h("button", { class: "simge-dugme deftere-ekle", type: "button", "aria-label": t("Deftere ekle"), title: t("Deftere ekle") }, icon("arti", "i-20"));
  defter.addEventListener("click", (e) => { e.stopPropagation(); derlemeyeEkleFisi(defter, x); });
  const alinti = x.metin ? h("button", { class: "simge-dugme alinti-karti", type: "button", "aria-label": t("Alıntı kartı"), title: t("Alıntı kartı") }, icon("paylas", "i-20")) : null;
  alinti?.addEventListener("click", (e) => { e.stopPropagation(); alintiKartiAc(x); });
  const bag = h("button", { class: "simge-dugme iz-bagla", type: "button", "aria-label": t("Bağla ve bağlar"), title: t("Bağla"), "aria-haspopup": "dialog" }, icon("bag", "i-20"));
  bag.addEventListener("click", (e) => { e.stopPropagation(); bagFisiAc(bag, x); });
  return h("span", { class: "iz-eylemler" }, alinti, kart, bag, defter);
}

/* ================= Etiket ve bağ çipleri (7.0 Y3, Y4) ================= */
// Satırın altındaki çip dizisi: #etiketler, bağlar ve (İzlerim'de) geri bağlantı sayısı. Çipe dokunmak satırın
// kendi tıklamasını (ize git) tetiklemez.
function izCipleri(x, { etiketSec, seciliEtiketler, geriSay = 0, kapat } = {}) {
  const parcalar = [];
  for (const e of x.etiketler || []) {
    const secili = !!seciliEtiketler?.has(e);
    const d = h("button", { class: "iz-cip etiket-cip", type: "button", "aria-pressed": etiketSec ? String(secili) : null,
      title: etiketSec ? (secili ? t("Süzgeçten çıkar") : t("Bu etiketle süz")) : t("İzlerim’de bu etiketle süz") }, h("span", { class: "iz-cip__diyez", "aria-hidden": "true" }, "#"), e);
    d.addEventListener("click", (ev) => { ev.stopPropagation(); if (etiketSec) etiketSec(e); else etiketeGit(e, kapat); });
    parcalar.push(d);
  }
  for (const b of x.baglar || []) {
    const durum = bagDurumu(b);
    const d = h("button", { class: "iz-cip bag-cip" + (durum === "yok" ? " yok" : ""), type: "button", dataset: { tur: b.tur },
      title: durum === "yok" ? t("Hedef bulunamadı") : b.tur === "url" ? String(b.hedef) : t("Bağa git"), "aria-label": durum === "yok" ? t("Bağ: {ad}, bulunamadı", { ad: bagAdi(b) }) : t("Bağ: {ad}", { ad: bagAdi(b) }) },
      icon(BAG_SIMGE[b.tur] || "bag", "i-16"), h("span", { class: "iz-cip__ad" }, bagAdi(b)), durum === "yok" ? h("small", {}, t("Bulunamadı")) : null);
    d.addEventListener("click", (ev) => { ev.stopPropagation(); if (durum !== "yok") bagaGit(b, { kapat }); else toast(t("Bağın hedefi bulunamadı: silinmiş olabilir.")); });
    parcalar.push(d);
  }
  if (geriSay) {
    const d = h("button", { class: "iz-cip geri-cip", type: "button", title: t("Bu ize bağlanan izler") }, icon("bag", "i-16"), t("{n} geri bağlantı", { n: geriSay }));
    d.addEventListener("click", (ev) => { ev.stopPropagation(); bagFisiAc(d, x, { kapat }); });
    parcalar.push(d);
  }
  return parcalar.length ? h("span", { class: "iz-cipler" }, parcalar) : null;
}
// Panelden ya da cep defterinden etikete dokunulunca İzlerim o etiketle açılır (Ctrl+K "Etiket: #x" de buradan)
let bekleyenEtiket = null;
export const etiketleIzlerimAc = (e) => etiketeGit(e);
function etiketeGit(e, kapat) {
  if (E) { E.etiketler = new Set([e]); E.secim = "hepsi"; E.govde.scrollTop = 0; ciz(); return; }
  bekleyenEtiket = e;
  kapat?.();
  bus.emit("git", { ekran: "izler" });
}

/* ================= Bağlar (7.0 Y4) ================= */
const BAG_SIMGE = { iz: "izler", sayfa: "sayfalar", belge: "kitap", url: "bag" };
const BAG_TUR_ADI = { iz: t("İz"), sayfa: t("Sayfa"), belge: t("Belge"), url: t("Adres") };
function bagAdi(b) {
  if (b.tur === "url") { try { return b.ad || new URL(String(b.hedef)).hostname.replace(/^www\./, ""); } catch { return String(b.hedef || t("Adres")); } }
  const belge = belgeBul(b.hedef?.belgeId);
  if (b.tur === "belge") return belge?.ad || b.ad || t("Belge");
  if (b.tur === "sayfa") return t("{ad}, s. {n}", { ad: belge?.ad || b.ad || t("Belge"), n: b.hedef?.sayfa ?? "?" });
  return b.ad || t("İz");
}
// Bir belgenin bütün iz kimlikleri (kısa süre önbellekte: satır başına izleriTopla pahalı)
const kimlikOnbellek = new WeakMap();
function izKimlikleri(b) {
  if (!b?.veri) return null;
  const o = kimlikOnbellek.get(b.veri);
  if (o && performance.now() - o.t < 600) return o.k;
  const k = new Set(izleriTopla(b).map((x) => x.id));
  kimlikOnbellek.set(b.veri, { t: performance.now(), k });
  return k;
}
// "var" | "yok": verisi henüz yüklenmemiş belgenin izi var sayılır (yüklenince liste yenilenir)
function bagDurumu(b) {
  if (b.tur === "url") return /^https?:\/\//i.test(String(b.hedef || "")) ? "var" : "yok";
  const belge = belgeBul(b.hedef?.belgeId);
  if (!belge) return "yok";
  if (b.tur === "iz") { const k = izKimlikleri(belge); return !k || k.has(b.hedef.izId) ? "var" : "yok"; }
  return "var";
}
function bagaGit(b, { kapat } = {}) {
  fisKapat();
  if (b.tur === "url") { if (!disariAc(String(b.hedef))) toast(t("Çevrimdışı: adres bağlantı gelince açılır.")); return; }
  const belge = belgeBul(b.hedef?.belgeId);
  if (!belge) { toast(t("Bağın hedefi bulunamadı.")); return; }
  if (b.tur === "iz") {
    const y = belge.veri ? izleriTopla(belge).find((z) => z.id === b.hedef.izId) : null;
    if (y) { gitIz(y, { kapat }); return; }
    if (belge.veri) { toast(t("Bağlı iz bulunamadı: silinmiş olabilir.")); return; }
  }
  kapat?.();
  const o = { ekran: "belge", belgeId: belge.id };
  if (b.tur === "sayfa" && Number.isFinite(Number(b.hedef.sayfa))) o.sayfa = Number(b.hedef.sayfa);
  if (b.tur === "iz") o.izId = b.hedef.izId;
  bus.emit("git", o);
}
// Bütün izler taranır: bu ize bağ veren izler (kaydedilmez, her açılışta hesaplanır)
function geriBaglantilar(x, kaynak = null) {
  const out = [];
  const liste = kaynak || store.belgeler.filter((b) => b.veri).flatMap((b) => izleriTopla(b));
  for (const y of liste) if (y.baglar?.some((g) => g.tur === "iz" && g.hedef?.belgeId === x.belgeId && g.hedef?.izId === x.id)) out.push(y);
  return out;
}
function bagYaz(x, baglar) {
  if (!x.kayit) return;
  if (baglar.length) x.kayit.baglar = baglar; else delete x.kayit.baglar;
  x.baglar = baglar.slice();
  bus.emit("belge:degisti", { belgeId: x.belgeId });
}
function bagEkle(x, bag) {
  const var_ = (x.baglar || []).some((g) => g.tur === bag.tur && JSON.stringify(g.hedef) === JSON.stringify(bag.hedef));
  if (var_) { toast(t("Bu bağ zaten var.")); return false; }
  bagYaz(x, [...(x.baglar || []), bag]);
  toast(t("Bağlandı: {ad}", { ad: bagAdi(bag) }));
  return true;
}
const belgeSecenekleri = (secili) => store.belgeler.filter((b) => !b.dizgi).slice().sort((a, b) => (b.acilis || 0) - (a.acilis || 0))
  .map((b) => h("option", { value: b.id, selected: b.id === secili || null }, b.ad));
// İzin bağ fişi: var olan bağlar (çıkarılabilir), "Bağla" (iz, sayfa, belge, adres) ve geri bağlantılar
export function bagFisiAc(capa, x, { kapat: disKapat } = {}) {
  let sekme = "iz";
  const govde = h("div", { class: "bag-fis__govde" });
  const listeEl = h("div", { class: "bag-fis__liste", role: "list" });
  const listeCiz = () => {
    const bs = x.baglar || [];
    listeEl.replaceChildren(...(bs.length ? bs.map((b, i) => {
      const durum = bagDurumu(b);
      const git = h("button", { class: "bag-fis__bag" + (durum === "yok" ? " yok" : ""), type: "button", role: "listitem" },
        icon(BAG_SIMGE[b.tur] || "bag", "i-20"), h("span", {}, h("b", {}, bagAdi(b)), h("small", {}, durum === "yok" ? t("Bulunamadı") : BAG_TUR_ADI[b.tur])));
      git.addEventListener("click", () => { if (durum !== "yok") bagaGit(b, { kapat: disKapat }); });
      const sil = h("button", { class: "simge-dugme", type: "button", "aria-label": t("{ad} bağını kaldır", { ad: bagAdi(b) }), title: t("Bağı kaldır") }, icon("kapat", "i-20"));
      sil.addEventListener("click", () => { const l = (x.baglar || []).slice(); l.splice(i, 1); bagYaz(x, l); listeCiz(); acikFis?.konumla(); });
      return h("div", { class: "bag-fis__satir" }, git, sil);
    }) : [h("p", { class: "bag-fis__bos" }, t("Henüz bağ yok. Başka bir ize, bir sayfaya, belgeye ya da adrese bağla."))]));
  };
  const sekmeler = h("div", { class: "izler-parcali bag-fis__sekme", role: "tablist", "aria-label": t("Bağın türü") },
    ...Object.entries(BAG_TUR_ADI).map(([id, ad]) => {
      const d = h("button", { type: "button", role: "tab", "aria-selected": String(id === sekme), "aria-pressed": String(id === sekme), dataset: { id } }, ad);
      d.addEventListener("click", () => { sekme = id; for (const b of sekmeler.children) { b.setAttribute("aria-selected", String(b === d)); b.setAttribute("aria-pressed", String(b === d)); } govdeCiz(); acikFis?.konumla(); });
      return d;
    }));
  const ekle = (bag) => { if (bagEkle(x, bag)) { listeCiz(); govdeCiz(); acikFis?.konumla(); } };
  const govdeCiz = () => {
    if (sekme === "iz") {
      const ara = h("input", { class: "izler-girdi", type: "search", placeholder: t("İzlerde ara: alıntı, not ya da #etiket"), "aria-label": t("Bağlanacak izi ara"), enterkeyhint: "search" });
      const sonuc = h("div", { class: "bag-fis__sonuc", role: "list", "aria-label": t("İzler") });
      const havuz = (E?.veri?.length ? E.veri.flatMap((k) => k.izler) : store.belgeler.filter((b) => b.veri).flatMap((b) => izleriTopla(b)))
        .filter((y) => !(y.belgeId === x.belgeId && y.id === x.id));
      const bul = () => {
        const q = harfsiz(ara.value.trim());
        const l = havuz.filter((y) => !q || harfsiz(`${y.metin} ${y.not} ${belgeBul(y.belgeId)?.ad || ""}`).includes(q))
          .sort((a, b) => (b.zaman || 0) - (a.zaman || 0)).slice(0, 8);
        sonuc.replaceChildren(...(l.length ? l.map((y) => {
          const d = h("button", { class: "bag-fis__aday", type: "button", role: "listitem" },
            h("span", { class: "bag-fis__aday-metin" }, kirp(y.metin || y.not || TUR_ADI[y.tur] || t("İz"), 90)),
            h("small", {}, [belgeBul(y.belgeId)?.ad, y.yer].filter(Boolean).join(" · ")));
          d.addEventListener("click", () => ekle({ tur: "iz", hedef: { belgeId: y.belgeId, izId: y.id }, ad: kirp(y.metin || y.not || TUR_ADI[y.tur] || t("İz"), 60) }));
          return d;
        }) : [h("p", { class: "bag-fis__bos" }, havuz.length ? t("Eşleşen iz yok.") : t("Bağlanacak başka iz yok."))]));
      };
      ara.addEventListener("input", bul);
      bul();
      govde.replaceChildren(ara, sonuc);
      requestAnimationFrame(() => ara.focus({ preventScroll: true }));
      return;
    }
    if (sekme === "url") {
      const adres = h("input", { class: "izler-girdi", type: "url", inputmode: "url", placeholder: "https://", "aria-label": t("Adres"), enterkeyhint: "done", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
      const form = h("form", { class: "izler-fis__form", novalidate: true }, adres, h("button", { class: "birincil kucuk", type: "submit" }, t("Bağla")));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        let u = adres.value.trim();
        if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
        let url = null;
        try { url = new URL(u); } catch { url = null; }
        if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) { toast(t("Geçerli bir web adresi yaz (https://...).")); adres.focus(); return; }
        ekle({ tur: "url", hedef: url.href, ad: url.hostname.replace(/^www\./, "") });
      });
      govde.replaceChildren(form);
      requestAnimationFrame(() => adres.focus({ preventScroll: true }));
      return;
    }
    const secim = h("select", { class: "izler-girdi", "aria-label": t("Belge") }, belgeSecenekleri(x.belgeId));
    const sayfa = sekme === "sayfa" ? h("input", { class: "izler-girdi bag-fis__sayfa", type: "number", inputmode: "numeric", min: "1", value: "1", "aria-label": t("Sayfa numarası") }) : null;
    const form = h("form", { class: "izler-fis__form bag-fis__form" }, secim, sayfa, h("button", { class: "birincil kucuk", type: "submit" }, t("Bağla")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const b = belgeBul(secim.value);
      if (!b) return;
      if (sekme === "belge") { ekle({ tur: "belge", hedef: { belgeId: b.id }, ad: b.ad }); return; }
      const n = Math.max(1, Math.round(Number(sayfa.value) || 1));
      ekle({ tur: "sayfa", hedef: { belgeId: b.id, sayfa: n }, ad: `${b.ad}, s. ${n}` });
    });
    govde.replaceChildren(form);
  };
  const geri = geriBaglantilar(x, E?.veri?.length ? E.veri.flatMap((k) => k.izler) : null);
  const geriEl = h("div", { class: "bag-fis__liste", role: "list", "aria-label": t("Geri bağlantılar") },
    ...(geri.length ? geri.map((y) => {
      const d = h("button", { class: "bag-fis__bag", type: "button", role: "listitem" }, icon("izler", "i-20"),
        h("span", {}, h("b", {}, kirp(y.metin || y.not || TUR_ADI[y.tur] || t("İz"), 80)), h("small", {}, [belgeBul(y.belgeId)?.ad, y.yer].filter(Boolean).join(" · "))));
      d.addEventListener("click", () => { fisKapat(); gitIz(y, { kapat: disKapat }); });
      return d;
    }) : [h("p", { class: "bag-fis__bos" }, t("Bu ize henüz bağlanan yok."))]));
  listeCiz();
  govdeCiz();
  fisAc(capa, [
    h("p", { class: "izler-fis__baslik" }, t("Bağlar")), listeEl,
    h("p", { class: "izler-fis__baslik" }, t("Bağla")), sekmeler, govde,
    h("p", { class: "izler-fis__baslik" }, t("Geri bağlantılar"), h("span", { class: "sayi" }, String(geri.length))), geriEl,
  ], { sinif: "bag-fis", rol: "dialog", etiket: t("Bağlar") });
}
function izSatiri(x, { kapat, etiketSec, seciliEtiketler } = {}) {
  const meta = [x.yer, neZaman(x.zaman), x.kursun ? t("kurşun") : ""].filter(Boolean).join(" · ");
  const el = h("div", { class: "iz-satir", role: "listitem", tabindex: "0", "aria-label": `${TUR_ADI[x.tur] || t("İz")}, ${x.metin || t("metinsiz")}, ${x.yer || ""}` },
    onizlemeEl(x),
    h("span", { class: "iz-govde" },
      alintiMetni(h("span", { class: "iz-metin" + (x.kaynak === "not" || x.kaynak === "metin" ? " el" : "") }), x, ""),
      x.not && x.kaynak !== "not" ? formullu(h("span", { class: "iz-satir__not" }, x.not)) : null,
      izCipleri(x, { etiketSec, seciliEtiketler, kapat }),
      h("span", { class: "iz-meta" }, meta)),
    eylemler(x));
  el.addEventListener("click", () => gitIz(x, { kapat }));
  el.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); gitIz(x, { kapat }); } });
  // Uzun basma eylemleri açık bırakır (dokunmatikte odak halkası yok)
  let zaman = 0;
  el.addEventListener("pointerdown", () => { zaman = setTimeout(() => el.classList.add("acik"), 450); });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, () => clearTimeout(zaman));
  return el;
}

function suzgecCipleri(sayac, secili, sec, sinif = "izler-suzgec") {
  const kap = h("div", { class: sinif, role: "group", "aria-label": t("İz süzgeci") });
  for (const [id, ad] of SUZGECLER) {
    const n = sayac[id] || 0;
    if (id !== "tumu" && !n && id !== secili) continue;
    const d = h("button", { class: "cip", type: "button", "aria-pressed": String(id === secili) }, ad, h("span", { class: "sayi" }, String(n)));
    d.addEventListener("click", () => sec(id));
    kap.append(d);
  }
  return kap;
}
// Etiket süzgeci çipleri (sayılarla, çoklu seçim). Etiket yoksa hiç görünmez.
function etiketCipleri(sayilar, secili, sec, temizle) {
  if (!sayilar.length) return null;
  return h("div", { class: "etiket-cipler", role: "group", "aria-label": t("Etiket süzgeci") },
    h("span", { class: "etiket-cipler__baslik" }, icon("etiket", "i-16"), t("Etiketler")),
    ...sayilar.map(([e, n]) => {
      const d = h("button", { class: "cip etiket-suzgec", type: "button", "aria-pressed": String(secili.has(e)), dataset: { etiket: e } },
        h("span", { class: "iz-cip__diyez", "aria-hidden": "true" }, "#"), e, h("span", { class: "sayi" }, String(n)));
      d.addEventListener("click", () => sec(e));
      return d;
    }),
    secili.size ? h("button", { class: "metin-dugme etiket-cipler__temizle", type: "button", onclick: temizle }, t("Temizle")) : null);
}
function say(liste) {
  const s = { tumu: liste.length };
  for (const x of liste) { s[x.tur] = (s[x.tur] || 0) + 1; if (x.tur !== "not" && sade(x.not)) s.not = (s.not || 0) + 1; }
  return s;
}

/* ================= İzler sekmesi (Notlar paneli) ================= */
export function izlerPaneli(kap, belge) {
  let suzgec = "tumu", liste = [], bitti = false;
  const etiketler = new Set();
  const etiketSec = (e) => { if (etiketler.has(e)) etiketler.delete(e); else etiketler.add(e); ciz(); };
  kap.classList.add("izler-paneli");
  const govde = h("div", { class: "izler-liste", role: "list", "aria-label": t("İzler") });
  const ciz = () => {
    if (bitti) return;
    const sayac = say(liste);
    for (const e of [...etiketler]) if (!liste.some((x) => x.etiketler.includes(e))) etiketler.delete(e);
    const gorunen = liste.filter((x) => suzgecUyar(x, suzgec) && etiketUyar(x, etiketler));
    const gruplar = new Map();
    for (const x of gorunen) { if (!gruplar.has(x.grup)) gruplar.set(x.grup, []); gruplar.get(x.grup).push(x); }
    govde.replaceChildren(...(gruplar.size ? [...gruplar].map(([ad, xs]) =>
      h("section", { class: "izler-grup" }, h("h3", {}, ad), ...xs.map((x) => izSatiri(x, { etiketSec, seciliEtiketler: etiketler }))))
      : [bosDurum(liste.length ? t("Bu süzgeçte iz yok.") : t("Henüz bir iz yok."), liste.length ? t("Başka bir süzgeç seç.") : bosAciklama(belge))]));
    kap.replaceChildren(...[suzgecCipleri(sayac, suzgec, (id) => { suzgec = id; ciz(); }), etiketCipleri(etiketSay(liste), etiketler, etiketSec, () => { etiketler.clear(); ciz(); }), govde].filter(Boolean));
  };
  const yenile = async () => { liste = await hazirla(belge); ciz(); };
  let plan = 0;
  const degisti = (o) => { if (o?.belgeId === belge.id) { clearTimeout(plan); plan = setTimeout(yenile, 300); } };
  const coz = bus.on("belge:degisti", degisti);
  kap.replaceChildren(govde);
  yenile();
  return { yenile, kapat: () => { bitti = true; coz(); clearTimeout(plan); kap.classList.remove("izler-paneli"); } };
}
const bosAciklama = (b) => (b?.tur === "epub" ? t("Koltuk’ta bir satırın altını kalemle çiz; burada belirir.")
  : cizgiMi(b) ? t("Sayfanın üstüne kalemle işaret koy; burada belirir.") : t("Sayfada bir satırın altını kalemle çiz ya da yuvarlak içine al; burada belirir."));
// Boş durum ne yapılacağını söyler; eylem verilirse tek düğme (TASARIM-4 3.5)
function bosDurum(baslik, aciklama, eylem = null) {
  return h("div", { class: "izler-bos" }, h("p", { class: "izler-bos__baslik" }, baslik), h("p", { class: "izler-bos__aciklama" }, aciklama),
    eylem ? h("button", { class: "birincil izler-bos__dugme", type: "button", onclick: eylem.calistir }, eylem.etiket) : null);
}
// Okumaya dönmek için son açılan kitap (yoksa son belge)
const sonKitap = () => [...store.belgeler].filter((b) => b.tur === "epub").sort((a, b) => (b.acilis || 0) - (a.acilis || 0))[0]
  || [...store.belgeler].sort((a, b) => (b.acilis || 0) - (a.acilis || 0))[0] || null;

// "izler:ac": kap verilirse içine çizilir; yoksa açık ekranın sağında kendi paneli
let yanPanel = null;
export function izlerPaneliAc(belge, { kap } = {}) {
  if (kap instanceof Element) return izlerPaneli(kap, belge);
  yanPanel?.kapat(true);
  const ic = h("div", { class: "izler-yan__ic" });
  const defterD = h("button", { class: "hayalet", type: "button" }, icon("izler", "i-20"), t("Cep defteri"));
  const kapatD = h("button", { class: "simge-dugme", type: "button", "aria-label": t("İzleri kapat") }, icon("kapat", "i-20"));
  const el = h("aside", { class: "izler-yan", role: "complementary", "aria-label": t("{ad}: izler", { ad: belge.ad }) },
    h("header", { class: "panel-ust" }, h("h2", {}, t("İzler")), h("span", { class: "izler-yan__ad" }, belge.ad), defterD, kapatD), ic);
  document.body.append(el);
  const panel = izlerPaneli(ic, belge);
  const tus = (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open], .cep-defter")) { e.stopPropagation(); kapat(); } };
  document.addEventListener("keydown", tus, true);
  // Belge kapanınca (kitaplığa dönüş) panel de gider
  const coz = bus.on("git", (o) => { if (o?.ekran !== "belge" || o.belgeId !== belge.id) kapat(true); });
  const kapat = (hemen = false) => {
    if (yanPanel?.el !== el) return;
    yanPanel = null;
    panel.kapat(); coz();
    document.removeEventListener("keydown", tus, true);
    if (hemen || hareketAz()) el.remove();
    else { el.classList.add("gidiyor"); setTimeout(() => el.remove(), 200); }
  };
  defterD.addEventListener("click", () => defterAc(belge));
  kapatD.addEventListener("click", () => kapat());
  yanPanel = { el, kapat };
  kapatD.focus({ preventScroll: true });
  return panel;
}

/* ================= Cep defteri ================= */
// Kâğıt cep defteri: köşeli kapak, lastik bant, çizgili yaprak. Her alıntı: altındaki metin serifli,
// solda işaretin kendi mürekkebi, altında yer ve tarih; yanına kısa not yazılır.
let acikDefter = null;
let defterIstek = 0;
export async function defterAc(belge) {
  if (!belge) return;
  // Hızlı çift dokunuşta yalnız son istek pencere açar
  const istek = ++defterIstek;
  acikDefter?.kapat(true);
  const liste = (await hazirla(belge)).filter(defterde);
  if (istek !== defterIstek) return;
  acikDefter?.kapat(true);
  const sayac = h("span", { class: "cep-defter__sayi" }, t("{n} alıntı", { n: liste.length }));
  const sayfa = h("div", { class: "cep-defter__yaprak", role: "list", "aria-label": t("Alıntılar") });
  const md = h("button", { class: "hayalet genis-eylem", type: "button" }, "Markdown");
  const pdf = h("button", { class: "hayalet genis-eylem", type: "button" }, "PDF");
  const kapatD = h("button", { class: "simge-dugme", type: "button", "aria-label": t("Defteri kapat") }, icon("kapat", "i-20"));
  const kapak = h("div", { class: "cep-defter__kapak", style: `--c:${belge.kapak || "#24324F"}` },
    h("div", { class: "cep-defter__ust" },
      h("div", {}, h("h2", { id: "cepDefterBaslik" }, belge.ad), h("p", {}, t("Cep defteri") + " · ", sayac)),
      h("div", { class: "cep-defter__eylem" }, md, pdf, kopruDugmesi(() => [{ belge, izler: liste, kirpinti: "kitap" }], belge.ad, [md, pdf]), kapatD)),
    sayfa, h("i", { class: "cep-defter__bant", "aria-hidden": "true" }));
  const perde = h("div", { class: "cep-defter", role: "dialog", "aria-modal": "true", "aria-labelledby": "cepDefterBaslik", tabindex: "-1" }, kapak);

  const ciz = () => {
    if (!liste.length) {
      sayfa.replaceChildren(bosDurum(t("Cep defteri boş."), t("Altını çizdiğin alıntılar buraya iner.") + " " + bosAciklama(belge),
        { etiket: t("Okumaya dön"), calistir: () => { kapat(); bus.emit("git", { ekran: "belge", belgeId: belge.id }); } }));
      return;
    }
    sayfa.replaceChildren(...liste.map((x) => alintiEl(x, { kapat: () => kapat() })));
  };
  const kapat = (hemen = false) => {
    if (acikDefter?.el !== perde) return;
    acikDefter = null;
    document.removeEventListener("keydown", tus, true);
    if (hemen || hareketAz()) perde.remove();
    else { perde.classList.add("gidiyor"); setTimeout(() => perde.remove(), 200); }
  };
  const tus = (e) => { if (e.key === "Escape" && !acikFis) { e.stopPropagation(); kapat(); } };
  perde.addEventListener("pointerdown", (e) => { if (e.target === perde) kapat(); });
  kapatD.addEventListener("click", () => kapat());
  md.addEventListener("click", () => markdownPaylas(belge, liste));
  pdf.addEventListener("click", async () => {
    pdf.disabled = true; pdf.textContent = t("Hazırlanıyor");
    try { await pdfPaylas(belge, liste); } catch (hata) { console.warn("[izler] PDF hazırlanamadı:", hata); toast(t("Defter PDF olarak hazırlanamadı.")); }
    finally { pdf.disabled = false; pdf.textContent = "PDF"; }
  });
  document.addEventListener("keydown", tus, true);
  ciz();
  document.body.append(perde);
  acikDefter = { el: perde, kapat };
  perde.focus({ preventScroll: true });
}

function alintiEl(x, { kapat, kaynakAdi } = {}) {
  const meta = [kaynakAdi, [x.yer, x.bolum].filter(Boolean).join(", "), tarih(x.zaman)].filter(Boolean).join(" · ");
  const metin = alintiMetni(h("blockquote", { class: "alinti__metin" }), x, h("span", { class: "metinsiz" }, t("Metinsiz iz")));
  const notAlani = h("textarea", { class: "alinti__not", rows: "1", placeholder: t("Not ekle"), "aria-label": t("Alıntının yanına not"), maxlength: "600" });
  notAlani.value = x.not || "";
  const boyutla = () => { notAlani.style.height = "auto"; notAlani.style.height = `${notAlani.scrollHeight}px`; };
  // Notta formül varsa alanın altında çizilmiş hâli görünür (alan yazı olarak kalır)
  const notFormul = h("p", { class: "alinti__not-formul", "aria-hidden": "true", hidden: true });
  let notZ = 0;
  const notFormulCiz = () => {
    const v = notAlani.value;
    notFormul.hidden = !matematikVarMi(v);
    if (notFormul.hidden) return;
    notFormul.textContent = v;
    matematikCiz(notFormul).then((n) => { if (!n) notFormul.hidden = true; }).catch(() => { notFormul.hidden = true; });
  };
  notFormulCiz();
  notAlani.addEventListener("input", () => { notYaz(x, notAlani.value); boyutla(); clearTimeout(notZ); notZ = setTimeout(notFormulCiz, 300); });
  requestAnimationFrame(boyutla);
  const git = h("button", { class: "alinti__git", type: "button", "aria-label": x.yer ? t("{yer} git", { yer: x.yer }) : t("Yerine git") }, metin, h("span", { class: "alinti__meta" }, meta));
  git.addEventListener("click", () => gitIz(x, { kapat }));
  if (x.metin) uzunBas(git, () => alintiKartiAc(x));
  return h("article", { class: "alinti", role: "listitem" },
    h("div", { class: "alinti__kenar" }, onizlemeEl(x, "alinti__iz")),
    h("div", { class: "alinti__govde" }, git, notAlani, notFormul),
    eylemler(x));
}

/* ---------- dışa aktarma ---------- */
const dosyaAdi = (b, uz) => `${String(b?.ad || t("Defter")).replace(/[\\/:*?"<>|]+/g, " ").trim()} (${t("cep defteri")}).${uz}`;
function markdownMetni(baslik, liste, { kaynakAdi } = {}) {
  const satirlar = [`# ${baslik}`, "", `_${t("{n} alıntı, Kenar Notu cep defteri", { n: liste.length })}_`, ""];
  for (const x of liste) {
    satirlar.push(`> ${(x.metin || t("(metinsiz iz)")).replace(/\n/g, "\n> ")}`, "");
    const yer = [kaynakAdi?.(x), [x.yer, x.bolum].filter(Boolean).join(", "), tarih(x.zaman)].filter(Boolean).join(" · ");
    if (yer) satirlar.push(`<small>${yer}</small>`, "");
    if (sade(x.not)) satirlar.push(t("Not: {not}", { not: sade(x.not) }), "");
  }
  return satirlar.join("\n");
}
async function paylas(blob, ad) {
  try {
    const m = await import("./disa-aktar.js");
    if (typeof m.paylas === "function") return await m.paylas(blob, ad);
  } catch (hata) { if (hata?.name === "AbortError") return; }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: ad, hidden: true });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function markdownPaylas(belge, liste, opt) {
  paylas(new Blob([markdownMetni(belge.ad, liste, opt)], { type: "text/markdown" }), dosyaAdi(belge, "md"));
}

// Köprüler (OZELLIKLER-8 §4.2): Readwise CSV ve Obsidian zip. kitaplar: [{ belge, izler, kirpinti }]
// kirpinti "kitap": bütün kitap aktarılıyor, kitabın bütün kırpıntıları; "ilgili": seçili izlerin yanındakiler (disa-kopru.js)
const kopruAdi = (ad, ek, uz) => `${String(ad || "Kenar Notu").replace(/[\\/:*?"<>|]+/g, " ").trim()} (${ek}).${uz}`;
async function kopruAktar(tur, kitaplar, ad) {
  fisKapat();
  try {
    const m = await import("./disa-kopru.js");
    if (!kitaplar.some((k) => k.izler.length) && !(tur === "obsidian" && kitaplar.some((k) => m.kirpintilariSec(k).length))) {
      toast(t("Aktarılacak alıntı yok."));
      return;
    }
    if (tur === "readwise") await paylas(m.readwiseCsv(kitaplar), kopruAdi(ad, "Readwise", "csv"));
    else await paylas(await m.obsidianZip(kitaplar), kopruAdi(ad, "Obsidian", "zip"));
  } catch (hata) {
    console.warn("[izler] dışa aktarılamadı:", hata);
    toast(t("Dışa aktarılamadı."));
  }
}
// gizliler: dar ekranda CSS'le gizlenen düğmeler (cep defterinin Markdown ve PDF'i); görünmüyorlarsa fişe satır olarak girer
function kopruFisi(capa, kitaplar, ad, gizliler = []) {
  const satir = (baslik, alt, calistir) => h("button", { class: "izler-fis__satir", type: "button", role: "menuitem", onclick: calistir },
    icon("disa-aktar", "i-20"), h("span", {}, baslik), h("small", {}, alt));
  const ekler = gizliler.filter((d) => !d.getClientRects().length).map((d) => satir(d.textContent, "", () => { fisKapat(); d.click(); }));
  fisAc(capa, [h("p", { class: "izler-fis__baslik" }, ekler.length ? t("Dışa aktar") : t("Başka uygulamaya aktar")), ...ekler,
    satir("Readwise", "CSV", () => kopruAktar("readwise", kitaplar, ad)), satir("Obsidian", "Markdown zip", () => kopruAktar("obsidian", kitaplar, ad))]);
}
function kopruDugmesi(kitaplar, ad, gizliler) {
  const d = h("button", { class: "hayalet", type: "button", "aria-haspopup": "menu", title: t("Readwise ya da Obsidian") }, t("Aktar"));
  d.addEventListener("click", (e) => { e.stopPropagation(); if (acikFis) fisKapat(); else kopruFisi(d, kitaplar(), ad, gizliler); });
  return d;
}

// PDF: her yaprak tuvalde dizilir (Türkçe harfler standart PDF yazı tiplerinde yok), A5 sayfaya görüntü olarak konur
async function pdfPaylas(belge, liste, { kaynakAdi } = {}) {
  const { PDFDocument } = await import("../lib/pdf-lib.esm.min.js");
  try { await Promise.all(["400 20px Literata", "italic 400 16px Literata", "400 11px \"IBM Plex Mono\"", "500 18px Caveat"].map((f) => document.fonts.load(f))); } catch { /* yedek yazı tipi */ }
  const W = 420, H = 595, Z = 3, KENAR = 64, SAG = 36, UST = 64, ALT = 48;   // punto; kenar boşluğu solda geniş (kenar çizgisi)
  const doc = await PDFDocument.create();
  doc.setTitle(t("{ad}: cep defteri", { ad: belge.ad }));
  let cv, g, y;
  const yeniSayfa = async (ilk = false) => {
    if (cv) await sayfaKoy();
    cv = Object.assign(document.createElement("canvas"), { width: W * Z, height: H * Z });
    g = cv.getContext("2d");
    g.scale(Z, Z);
    g.fillStyle = "#FBF8F1"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#2B4A7E1F"; g.lineWidth = 0.5;
    for (let yy = UST + 18; yy < H - ALT; yy += 18) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    g.strokeStyle = "#8C2B3866"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(KENAR - 12, 0); g.lineTo(KENAR - 12, H); g.stroke();
    y = UST;
    if (ilk) {
      g.fillStyle = "#1C1B19"; g.font = "500 20px Literata, Georgia, serif";
      g.fillText(belge.ad.slice(0, 48), KENAR, y); y += 18;
      g.fillStyle = "#6C655C"; g.font = "400 9px \"IBM Plex Mono\", monospace";
      g.fillText(t("CEP DEFTERİ · {n} ALINTI", { n: liste.length }), KENAR, y); y += 30;
    }
  };
  const sayfaKoy = async () => {
    const png = await doc.embedPng(await (await new Promise((r) => cv.toBlob(r, "image/png"))).arrayBuffer());
    doc.addPage([W, H]).drawImage(png, { x: 0, y: 0, width: W, height: H });
  };
  const satirla = (metin, font, maxW) => {
    g.font = font;
    const out = [];
    for (const para of String(metin).split("\n")) {
      let s = "";
      for (const k of para.split(/\s+/)) {
        if (!k) continue;
        if (g.measureText(s ? s + " " + k : k).width <= maxW) s = s ? s + " " + k : k;
        else { if (s) out.push(s); s = k; }
      }
      out.push(s);
    }
    return out;
  };
  await yeniSayfa(true);
  const genis = W - KENAR - SAG;
  for (const x of liste) {
    const govdeFont = "400 13px Literata, Georgia, serif";
    const satirlar = satirla(x.metin || t("Metinsiz iz"), govdeFont, genis);
    const notSatir = sade(x.not) ? satirla(sade(x.not), "500 15px Caveat, cursive", genis) : [];
    const yuk = satirlar.length * 18 + notSatir.length * 18 + 30;
    if (y + Math.min(yuk, H - UST - ALT) > H - ALT) await yeniSayfa();
    // Kenarda işaretin rengi: küçük mürekkep çizgisi
    g.strokeStyle = x.tur === "vurgu" ? x.renk : (x.renk || "#24407A"); g.lineWidth = x.tur === "vurgu" ? 4 : 1.4; g.lineCap = "round";
    g.beginPath(); g.moveTo(KENAR - 24, y - 9); g.lineTo(KENAR - 24, y - 9 + Math.max(10, satirlar.length * 18 - 6)); g.stroke();
    g.fillStyle = "#1C1B19"; g.font = govdeFont;
    for (const s of satirlar) { if (y > H - ALT) { await yeniSayfa(); g.fillStyle = "#1C1B19"; g.font = govdeFont; } g.fillText(s, KENAR, y); y += 18; }
    g.fillStyle = "#6C655C"; g.font = "400 8.5px \"IBM Plex Mono\", monospace";
    g.fillText([kaynakAdi?.(x), [x.yer, x.bolum].filter(Boolean).join(", "), tarih(x.zaman)].filter(Boolean).join(" · "), KENAR, y - 3); y += 12;
    if (notSatir.length) {
      g.fillStyle = "#24407A"; g.font = "500 15px Caveat, cursive";
      for (const s of notSatir) { if (y > H - ALT) { await yeniSayfa(); g.fillStyle = "#24407A"; g.font = "500 15px Caveat, cursive"; } g.fillText(s, KENAR, y + 2); y += 18; }
    }
    y += 18;
  }
  await sayfaKoy();
  cv = null;
  const bayt = await doc.save();
  await paylas(new Blob([bayt], { type: "application/pdf" }), dosyaAdi(belge, "pdf"));
}

/* ================= İzlerim ekranı ================= */
// Kitap sayfası düzeni: solda süzgeç, defterler ve derlemeler; gövdede kenarında mürekkep izi olan alıntılar
let E = null;
export async function ac(kap) {
  kapat();
  E = { kap, suzgec: "tumu", secim: "hepsi", birlestir: null, kaynaklar: new Map(), dizinIstek: new Set(), veri: [], cozuculer: [],
    etiketler: new Set(bekleyenEtiket ? [bekleyenEtiket] : []), geri: new Map() };
  bekleyenEtiket = null;
  kap.classList.add("izlerim");
  E.yan = h("nav", { class: "izlerim-yan", "aria-label": t("İz süzgeci ve defterler") });
  E.govde = h("div", { class: "izlerim-govde" });
  kap.append(E.yan, E.govde);
  E.cozuculer.push(bus.on("belge:degisti", () => yenilePlanla()), bus.on("belgeler", () => yenilePlanla()), bus.on("derlemeler", () => { if (!E?.sessiz) ciz(); }));
  // Kısayollar: Ctrl+Shift+I içe aktar, Ctrl+Shift+E etiket süzgecini temizle
  const tus = (e) => {
    if (!E || !(e.ctrlKey || e.metaKey) || !e.shiftKey || document.querySelector("dialog[open]")) return;
    const k = e.key.toLocaleLowerCase("tr");
    if (k === "i" || k === "ı") { e.preventDefault(); vurgulariIceAktar(); }
    else if (k === "e" && E.etiketler.size) { e.preventDefault(); E.etiketler.clear(); ciz(); }
  };
  document.addEventListener("keydown", tus);
  E.cozuculer.push(() => document.removeEventListener("keydown", tus));
  await topla();
  ciz();
}
export function kapat() {
  if (!E) return;
  fisKapat();
  for (const c of E.cozuculer) c();
  for (const g of E.gozlemciler || []) g.disconnect();
  clearTimeout(E.plan);
  E.kap.classList.remove("izlerim");
  E = null;
}
function yenilePlanla() { if (!E) return; clearTimeout(E.plan); E.plan = setTimeout(async () => { if (!E) return; await topla(); ciz(); }, 300); }

async function topla() {
  const veri = [];
  for (const b of store.belgeler) {
    if (!b.veri) continue;
    if (b.tur === "epub" && !E.kaynaklar.has(b.id)) {
      const k = await kaynakAl(b);
      if (!E) return;
      E.kaynaklar.set(b.id, k);
      // Dizin henüz yoksa vurgu metni "Vurgu" diye kalmasın: belge öne alınıp bitince liste yenilenir
      if (!k && !E.dizinIstek.has(b.id)) {
        E.dizinIstek.add(b.id);
        import("./arama.js").then((m) => m.dizinle?.(b.id)).then(() => { if (!E) return; E.kaynaklar.delete(b.id); yenilePlanla(); }).catch(() => {});
      }
    }
    if (!E) return;
    const izler = izleriTopla(b, E.kaynaklar.get(b.id) || null);
    if (izler.length) veri.push({ belge: b, izler });
  }
  veri.sort((a, b) => (b.belge.acilis || 0) - (a.belge.acilis || 0));
  E.veri = veri;
  // Geri bağlantı sayıları: hedef iz -> ona bağ veren izler
  E.geri = new Map();
  for (const k of veri) for (const y of k.izler) for (const g of y.baglar) {
    if (g.tur !== "iz" || !g.hedef) continue;
    const a = g.hedef.belgeId + "\u0000" + g.hedef.izId;
    if (!E.geri.has(a)) E.geri.set(a, []);
    E.geri.get(a).push(y);
  }
}
const tumIzler = () => E.veri.flatMap((k) => k.izler);
const izBul = (belgeId, izId) => E.veri.find((k) => k.belge.id === belgeId)?.izler.find((x) => x.id === izId) || null;

function ciz() {
  if (!E) return;
  const y = E.govde.scrollTop;
  yanCiz();
  if (E.secim.startsWith("derleme:")) derlemeCiz(E.secim.slice(8));
  else govdeCiz();
  // Yerleşim yalnız gerekiyorsa zorlanır (en üstteyken binlerce satır için boşa yerleşim olurdu)
  if (y) E.govde.scrollTop = y;
}

function yanCiz() {
  const hepsi = tumIzler(), sayac = say(hepsi);
  const secenek = (id, ad, n, onEk = null) => {
    const d = h("button", { type: "button", "aria-pressed": String(E.secim === "hepsi" && E.suzgec === id) }, onEk, h("span", { class: "ad" }, ad), h("span", { class: "sayi" }, String(n || 0)));
    d.addEventListener("click", () => { E.secim = "hepsi"; E.suzgec = id; E.govde.scrollTop = 0; ciz(); });
    return d;
  };
  const geri = h("button", { class: "izlerim-geri hayalet", type: "button" }, icon("geri", "i-20"), t("Kitaplık"));
  geri.addEventListener("click", () => bus.emit("git", { ekran: "kitaplik" }));
  const kitaplar = E.veri.map(({ belge, izler }) => {
    const d = h("button", { type: "button", "aria-pressed": String(E.secim === "kitap:" + belge.id) },
      h("i", { class: "sirt", style: `--kapak-renk:${belge.kapak || "#7D1D2C"}` }), h("span", { class: "ad" }, belge.ad), h("span", { class: "sayi" }, String(izler.length)));
    d.addEventListener("click", () => { E.secim = "kitap:" + belge.id; E.govde.scrollTop = 0; ciz(); });
    return d;
  });
  const derlemeler = store.derlemeler.map((dr) => {
    const d = h("button", { type: "button", "aria-pressed": String(E.secim === "derleme:" + dr.id) }, icon("izler", "i-20"), h("span", { class: "ad" }, dr.ad), h("span", { class: "sayi" }, String(dr.girdiler.length)));
    d.addEventListener("click", () => { E.secim = "derleme:" + dr.id; E.govde.scrollTop = 0; ciz(); });
    return d;
  });
  E.yan.replaceChildren(
    geri,
    h("p", { class: "izlerim-yan__baslik" }, t("Süzgeç")),
    h("div", { class: "izlerim-yan__liste" }, SUZGECLER.filter(([id]) => id === "tumu" || sayac[id]).map(([id, ad]) => secenek(id, ad, sayac[id]))),
    ...(kitaplar.length ? [h("p", { class: "izlerim-yan__baslik" }, t("Defterler"))] : []),   // null "null" yazısına dönerdi
    h("div", { class: "izlerim-yan__liste" }, kitaplar),
    h("p", { class: "izlerim-yan__baslik" }, t("Derlemeler")),
    h("div", { class: "izlerim-yan__liste" }, derlemeler,
      h("button", { class: "izlerim-yan__yeni", type: "button", onclick: () => birlestirBasla() }, icon("arti", "i-20"), h("span", { class: "ad" }, t("Defterleri birleştir")))));
}

function ustCiz(baslik, sayacMetni, ...ek) {
  return h("header", { class: "izlerim-ust" }, h("h1", {}, baslik), h("span", { class: "izlerim-sayac" }, sayacMetni), h("span", { class: "izlerim-ust__bosluk" }), ...ek);
}
// İzlerim ⋯ menüsü: içe aktarma
function dahaDugmesi() {
  const d = h("button", { class: "simge-dugme izlerim-daha", type: "button", "aria-label": t("Daha fazla"), title: t("Daha fazla"), "aria-haspopup": "menu" }, icon("daha", "i-20"));
  d.addEventListener("click", (e) => {
    e.stopPropagation();
    if (acikFis) { fisKapat(); return; }
    fisAc(d, [h("p", { class: "izler-fis__baslik" }, t("İzlerim")),
      h("button", { class: "izler-fis__satir", type: "button", role: "menuitem", onclick: () => { fisKapat(); vurgulariIceAktar(); } },
        icon("ice-aktar", "i-20"), h("span", {}, t("Vurguları içe aktar"), h("small", { class: "izler-fis__alt" }, t("Kindle My Clippings.txt ya da Readwise CSV"))), h("small", {}, "Ctrl ⇧ I"))]);
  });
  return d;
}

// Binlerce iz tek seferde kurulmaz (5000 izde 7 sn donuyordu): ilk satırlar hemen, kalanı kaydırdıkça
// parça parça eklenir. Her listenin sonundaki işaret görünüme yaklaşınca sıradaki parça gelir.
const ILK_SATIR = 120, PARCA = 150;
function satirListesi(gorunen, butce) {
  const liste = h("div", { role: "list" });
  let i = 0;
  const ekle = (n) => {
    const son = Math.min(gorunen.length, i + n), yeni = [];
    for (; i < son; i++) yeni.push(izlerimSatiri(gorunen[i]));
    liste.append(...yeni);
  };
  ekle(butce);
  if (i >= gorunen.length) return [liste];
  const devam = h("div", { class: "izlerim-devam", "aria-hidden": "true" });
  const g = new IntersectionObserver((girdiler) => {
    if (!girdiler.some((x) => x.isIntersecting)) return;
    ekle(PARCA);
    if (i >= gorunen.length) { g.disconnect(); devam.remove(); }
  }, { root: E.govde, rootMargin: "1200px 0px" });
  g.observe(devam);
  E.gozlemciler.push(g);
  return [liste, devam];
}

function govdeCiz() {
  for (const g of E.gozlemciler || []) g.disconnect();
  E.gozlemciler = [];
  let butce = ILK_SATIR;
  const hepsi = tumIzler();
  const kitapSecili = E.secim.startsWith("kitap:") ? E.secim.slice(6) : null;
  const kitaplar = E.veri.filter((k) => !kitapSecili || k.belge.id === kitapSecili);
  const birlestirD = h("button", { class: "ikincil", type: "button" }, icon("izler", "i-20"), t("Birleştir"));
  birlestirD.addEventListener("click", () => birlestirBasla());
  const aktarAd = kitapSecili ? kitaplar[0]?.belge.ad : t("İzlerim");
  // Aktar görüneni alır: süzgeçsiz bütün kitap ve kırpıntıları, süzgeçliyken yalnız görünen izler ve yanlarındaki kırpıntılar
  const suzgecli = E.suzgec !== "tumu" || E.etiketler.size > 0;
  const uyar = (x) => suzgecUyar(x, E.suzgec) && etiketUyar(x, E.etiketler);
  const aktarilan = () => kitaplar.map(({ belge, izler }) => (!suzgecli ? { belge, izler, kirpinti: "kitap" }
    : { belge, izler: izler.filter(uyar), kirpinti: "ilgili" }));
  const parcalar = [ustCiz(t("İzlerim"), t("{n} iz · {k} kitap", { n: hepsi.length, k: E.veri.length }), E.veri.length > 1 ? birlestirD : null, hepsi.length ? kopruDugmesi(aktarilan, aktarAd) : null, dahaDugmesi())];
  if (!hepsi.length) {
    const b = sonKitap();
    const ice = h("button", { class: "ikincil izler-bos__dugme", type: "button", onclick: () => vurgulariIceAktar() }, icon("ice-aktar", "i-20"), t("Kindle ya da Readwise’tan aktar"));
    parcalar.push(h("div", { class: "izlerim-bos" }, h("p", { class: "izlerim-bos__baslik" }, t("Henüz bir iz yok.")),
      h("p", { class: "izlerim-bos__aciklama" }, t("Okurken bir satırın altını çiz ya da kenara yaz; hepsi burada toplanır. Kindle’daki vurgularını da getirebilirsin.")),
      h("div", { class: "izlerim-bos__eylem" }, b ? h("button", { class: "birincil izler-bos__dugme", type: "button", onclick: () => bus.emit("git", { ekran: "belge", belgeId: b.id }) }, t("Okumaya başla")) : null, ice)));
    E.govde.replaceChildren(...parcalar);
    return;
  }
  // Etiket süzgeci: seçili kitabın (ya da hepsinin) etiketleri; artık hiçbir izde olmayan seçim düşer
  const kapsam = kitaplar.flatMap((k) => k.izler);
  for (const e of [...E.etiketler]) if (!kapsam.some((x) => x.etiketler.includes(e))) E.etiketler.delete(e);
  const etiketSatiri = etiketCipleri(etiketSay(kapsam), E.etiketler, (e) => etiketDegistir(e), () => { E.etiketler.clear(); ciz(); });
  if (etiketSatiri) parcalar.push(etiketSatiri);
  // Defter rafı: her kitabın cep defteri, sırtı kitabın rengi; birleştirirken seçilir
  if (!kitapSecili) parcalar.push(defterRafi());
  if (E.birlestir) parcalar.push(birlestirCubugu());
  const sabit2 = parcalar.length;
  for (const { belge, izler } of kitaplar) {
    const gorunen = izler.filter(uyar);
    if (!gorunen.length) continue;
    const defterD = h("button", { class: "hayalet", type: "button" }, t("Cep defteri"));
    defterD.addEventListener("click", () => defterAc(belge));
    parcalar.push(h("section", { class: "izlerim-kitap", "aria-label": belge.ad },
      h("header", {}, h("i", { class: "sirt", style: `--kapak-renk:${belge.kapak || "#7D1D2C"}` }), h("h2", {}, belge.ad),
        h("span", { class: "izlerim-sayac" }, t("{n} iz", { n: gorunen.length })), h("span", { class: "izlerim-ust__bosluk" }), defterD),
      ...satirListesi(gorunen, butce)));
    butce = Math.max(0, butce - gorunen.length);
  }
  if (parcalar.length === sabit2) parcalar.push(bosDurum(t("Bu süzgeçte iz yok."), t("Başka bir süzgeç seç."),
    { etiket: t("Tümünü göster"), calistir: () => { E.secim = "hepsi"; E.suzgec = "tumu"; E.etiketler.clear(); ciz(); } }));
  E.govde.replaceChildren(...parcalar);
}

// Satır: solda kenar sütunu (izin mürekkebi ve yeri), sağda alıntı; tam bir kenar notu
function izlerimSatiri(x, { kaynakAdi, ekEylem } = {}) {
  const meta = [kaynakAdi, x.bolum, neZaman(x.zaman), x.kursun ? t("kurşun") : ""].filter(Boolean).join(" · ");
  const el = h("div", { class: "izlerim-satir", role: "listitem", tabindex: "0" },
    h("div", { class: "izlerim-kenar" }, onizlemeEl(x, "kenar-iz"), h("span", { class: "konum" }, x.yer || TUR_ADI[x.tur])),
    h("div", { class: "izlerim-satir__govde" },
      alintiMetni(h("blockquote", { class: x.kaynak === "not" || x.kaynak === "metin" ? "el" : "" }), x, h("span", { class: "metinsiz" }, TUR_ADI[x.tur] || t("Metinsiz iz"))),
      x.not && x.kaynak !== "not" ? formullu(h("p", { class: "izlerim-satir__not" }, x.not)) : null,
      izCipleri(x, { etiketSec: (e) => etiketDegistir(e), seciliEtiketler: E?.etiketler, geriSay: E?.geri.get(x.belgeId + "\u0000" + x.id)?.length || 0 }),
      h("p", { class: "izlerim-satir__meta" }, meta)),
    h("div", { class: "izlerim-satir__eylem" }, ekEylem || null, eylemler(x)));
  el.addEventListener("click", (e) => { if (!e.target.closest("button")) gitIz(x); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) gitIz(x); });
  if (x.metin) uzunBas(el, () => alintiKartiAc(x));
  return el;
}

function etiketDegistir(e) {
  if (!E) return;
  if (E.etiketler.has(e)) E.etiketler.delete(e); else E.etiketler.add(e);
  E.govde.scrollTop = 0;
  ciz();
}

function defterRafi() {
  const raf = h("div", { class: "defter-raf", role: "list", "aria-label": t("Cep defterleri") });
  for (const { belge, izler } of E.veri) {
    const alinti = izler.filter(defterde).length;
    const secili = E.birlestir?.has(belge.id);
    const d = h("button", { class: "defter-raf__defter", type: "button", role: "listitem", style: `--c:${belge.kapak || "#24324F"}`,
      "aria-pressed": E.birlestir ? String(!!secili) : null, "aria-label": t("{ad} cep defteri, {n} alıntı", { ad: belge.ad, n: alinti }) },
      // b'nin dili: uzun kelime ("Lighthouse") harf ortasından değil hecesinden bölünür
      h("span", { class: "defter-raf__kapak" }, h("b", { lang: belge.dil || null }, belge.ad), h("small", {}, t("{n} alıntı", { n: alinti })), h("i", { class: "defter-raf__bant", "aria-hidden": "true" })),
      E.birlestir ? h("span", { class: "defter-raf__tik", "aria-hidden": "true" }, icon("tik", "i-16")) : null);
    d.addEventListener("click", () => {
      if (!E.birlestir) { defterAc(belge); return; }
      if (secili) E.birlestir.delete(belge.id); else E.birlestir.add(belge.id);
      ciz();
    });
    raf.append(d);
  }
  return h("section", { class: "izlerim-raf" }, h("h2", { class: "izlerim-bolum" }, t("Cep defterleri"), h("span", { class: "t-aside" }, E.birlestir ? t("Birleştirmek için seç") : t("Defteri açmak için dokun"))), raf);
}

/* ---------- birleştirme ve derlemeler ---------- */
function birlestirBasla() {
  if (!E) return;
  E.secim = "hepsi";
  E.birlestir = new Set();
  E.govde.scrollTop = 0;
  ciz();
}
function birlestirCubugu() {
  const n = E.birlestir.size;
  const ad = h("input", { class: "izler-girdi", placeholder: t("Derlemenin adı, ör. Sınav: Kardiyoloji"), "aria-label": t("Derlemenin adı"), maxlength: "80", enterkeyhint: "done" });
  const sira = { deger: "kitap" };
  const siraSec = h("div", { class: "izler-parcali", role: "group", "aria-label": t("Sıra") },
    ...[["kitap", t("Kitap sırası")], ["tarih", t("Tarih sırası")]].map(([v, a]) => {
      const d = h("button", { type: "button", "aria-pressed": String(sira.deger === v) }, a);
      d.addEventListener("click", () => { sira.deger = v; for (const b of d.parentElement.children) b.setAttribute("aria-pressed", String(b === d)); });
      return d;
    }));
  const olustur = h("button", { class: "birincil", type: "button", disabled: n < 1 || null }, t("Derleme oluştur"));
  const vazgec = h("button", { class: "hayalet", type: "button" }, t("Vazgeç"));
  vazgec.addEventListener("click", () => { E.birlestir = null; ciz(); });
  olustur.addEventListener("click", () => {
    const secilen = E.veri.filter((k) => E.birlestir.has(k.belge.id));
    let girdiler = secilen.flatMap((k) => k.izler.filter(defterde).map((x) => ({ x, belgeId: k.belge.id })));
    if (sira.deger === "tarih") girdiler.sort((a, b) => (a.x.zaman || 0) - (b.x.zaman || 0));
    const d = derlemeOlustur(ad.value.trim() || secilen.map((k) => k.belge.ad).slice(0, 2).join(" + ") || t("Derleme"), girdiler.map(({ x, belgeId }) => ({ belgeId, izId: x.id })));
    E.birlestir = null;
    E.secim = "derleme:" + d.id;
    toast(t("“{ad}” derlemesi oluştu: {n} alıntı. Asıl defterler yerinde.", { ad: d.ad, n: d.girdiler.length }));
    ciz();
  });
  return h("div", { class: "birlestir-cubugu cam-yuzey", role: "group", "aria-label": t("Defterleri birleştir") },
    h("span", { class: "birlestir-cubugu__sayi" }, n ? t("{n} defter seçili", { n }) : t("Defter seç")), ad, siraSec, vazgec, olustur);
}

function derlemeCiz(id) {
  const d = store.derlemeler.find((x) => x.id === id);
  if (!d) { E.secim = "hepsi"; govdeCiz(); return; }
  // Kitaptan silinen iz derlemeden de düşer (belge verisi yüklüyse; yüklenmemiş kitabın girdisi bekler)
  const once = d.girdiler.length;
  d.girdiler = d.girdiler.filter((g) => { const b = belgeBul(g.belgeId); return b && (!b.veri || izBul(g.belgeId, g.izId)); });
  if (d.girdiler.length !== once) { E.sessiz = true; try { bus.emit("derlemeler", { tur: "guncelle", id: d.id }); } finally { E.sessiz = false; } }
  const ogeler = d.girdiler.map((g, gi) => ({ g, gi, x: izBul(g.belgeId, g.izId), b: belgeBul(g.belgeId) })).filter((o) => o.x);

  const adlandir = h("button", { class: "hayalet", type: "button" }, t("Yeniden adlandır"));
  adlandir.addEventListener("click", () => {
    const girdi = h("input", { class: "izler-girdi izlerim-ad-girdi", value: d.ad, "aria-label": t("Derlemenin adı"), maxlength: "80", enterkeyhint: "done" });
    const bitir = (kaydet) => {
      if (kaydet && girdi.value.trim() && girdi.value.trim() !== d.ad) { d.ad = girdi.value.trim(); bus.emit("derlemeler", { tur: "guncelle", id: d.id }); }
      else ciz();
    };
    girdi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bitir(true); } else if (e.key === "Escape") { e.stopPropagation(); bitir(false); } });
    girdi.addEventListener("blur", () => bitir(true), { once: true });
    $("h1", E.govde)?.replaceWith(girdi);
    girdi.focus(); girdi.select();
  });
  const md = h("button", { class: "hayalet", type: "button" }, "Markdown");
  const kaynakAdi = (x) => belgeBul(x.belgeId)?.ad || "";
  md.addEventListener("click", () => paylas(new Blob([markdownMetni(d.ad, ogeler.map((o) => o.x), { kaynakAdi })], { type: "text/markdown" }), dosyaAdi({ ad: d.ad }, "md")));
  const pdf = h("button", { class: "hayalet", type: "button" }, "PDF");
  pdf.addEventListener("click", () => pdfPaylas({ ad: d.ad }, ogeler.map((o) => o.x), { kaynakAdi }).catch(() => toast(t("Derleme PDF olarak hazırlanamadı."))));
  // Silme anında yapılır ve geri alınabilir: iki dokunuşla onay gerekmez (TASARIM-4 3.6)
  const sil = h("button", { class: "hayalet tehlike", type: "button" }, t("Derlemeyi sil"));
  sil.addEventListener("click", () => {
    const i = store.derlemeler.indexOf(d);
    if (i >= 0) store.derlemeler.splice(i, 1);
    E.secim = "hepsi";
    bus.emit("derlemeler", { tur: "sil", id: d.id });
    toast(t("“{ad}” silindi; asıl defterler yerinde", { ad: d.ad }), { etiket: t("Geri al"), calistir: () => { store.derlemeler.splice(Math.max(0, i), 0, d); bus.emit("derlemeler", { tur: "ekle", id: d.id }); } });
  });
  const siraDugme = (ad, fn) => { const b = h("button", { class: "cip", type: "button" }, ad); b.addEventListener("click", () => { fn(); bus.emit("derlemeler", { tur: "guncelle", id: d.id }); }); return b; };
  const tarihSira = siraDugme(t("Tarihe göre"), () => d.girdiler.sort((a, b) => (izBul(a.belgeId, a.izId)?.zaman || 0) - (izBul(b.belgeId, b.izId)?.zaman || 0)));
  const kitapSira = siraDugme(t("Kitaba göre"), () => {
    const sira = new Map(E.veri.map((k, i) => [k.belge.id, i]));
    d.girdiler.sort((a, b) => (sira.get(a.belgeId) ?? 1e6) - (sira.get(b.belgeId) ?? 1e6) || (izBul(a.belgeId, a.izId)?.sira || 0) - (izBul(b.belgeId, b.izId)?.sira || 0));
  });

  const liste = h("div", { class: "derleme-liste", role: "list" });
  for (const { x, b, gi } of ogeler) {
    const cikar = h("button", { class: "simge-dugme", type: "button", "aria-label": t("Derlemeden çıkar"), title: t("Derlemeden çıkar") }, icon("kapat", "i-20"));
    cikar.addEventListener("click", (e) => {
      e.stopPropagation();
      d.girdiler = d.girdiler.filter((g) => !(g.belgeId === x.belgeId && g.izId === x.id));
      bus.emit("derlemeler", { tur: "guncelle", id: d.id });
    });
    const tutamak = h("button", { class: "simge-dugme tutamak", type: "button", "aria-label": t("Sürükleyerek sırala"), title: t("Sürükle") }, icon("tutamak", "i-20"));
    const satir = izlerimSatiri(x, { kaynakAdi: b?.ad, ekEylem: [tutamak, cikar] });
    satir.dataset.sira = String(gi);   // girdinin derlemedeki sırası (görünmeyen girdiler de sayılır)
    surukle(tutamak, satir, liste, d);
    liste.append(satir);
  }
  E.govde.replaceChildren(
    ustCiz(d.ad, t("{n} alıntı · {k} kitap", { n: ogeler.length, k: new Set(ogeler.map((o) => o.x.belgeId)).size }), adlandir, md, pdf, kopruDugmesi(() => {
      const gruplar = new Map();
      for (const { x, b } of ogeler) { if (!b) continue; if (!gruplar.has(b)) gruplar.set(b, []); gruplar.get(b).push(x); }
      return [...gruplar].map(([belge, izler]) => ({ belge, izler, kirpinti: "ilgili" }));
    }, d.ad)),
    h("div", { class: "derleme-arac" }, h("span", { class: "t-aside" }, t("Sırala")), tarihSira, kitapSira, h("span", { class: "izlerim-ust__bosluk" }), sil),
    ogeler.length ? liste : bosDurum(t("Derleme boş."), t("Bir alıntının yanındaki artıya dokun ve Deftere ekle’den bu derlemeyi seç.")));
}

// Sürükleyerek sıralama: tutamaktan tutulan satır parmağı izler, bırakılınca yeni sırasına oturur
function surukle(tutamak, satir, liste, d) {
  let bas = 0, satirlar = [], hedef = -1;
  tutamak.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { tutamak.setPointerCapture(e.pointerId); } catch { /* işaretçi çoktan kalktı */ }
    bas = e.clientY;
    satirlar = [...liste.children];
    hedef = satirlar.indexOf(satir);
    satir.classList.add("suruklenen");
  });
  tutamak.addEventListener("pointermove", (e) => {
    if (!satir.classList.contains("suruklenen")) return;
    const dy = e.clientY - bas;
    satir.style.transform = `translateY(${dy}px)`;
    const orta = satir.getBoundingClientRect().top + satir.offsetHeight / 2;
    hedef = satirlar.findIndex((s) => s !== satir && orta < s.getBoundingClientRect().top + s.offsetHeight / 2);
    if (hedef < 0) hedef = satirlar.length;
    for (const s of satirlar) s.classList.toggle("buraya", s !== satir && satirlar.indexOf(s) === hedef);
  });
  const birak = () => {
    if (!satir.classList.contains("suruklenen")) return;
    satir.classList.remove("suruklenen");
    satir.style.transform = "";
    for (const s of satirlar) s.classList.remove("buraya");
    // Hedef satırın girdisinin önüne (en sona bırakılırsa sona) taşınır
    const i = Number(satir.dataset.sira);
    const hedefSatir = satirlar[hedef];
    let j = hedefSatir ? Number(hedefSatir.dataset.sira) : d.girdiler.length;
    if (j > i) j--;
    if (j === i || !(i >= 0)) return;
    const [g] = d.girdiler.splice(i, 1);
    d.girdiler.splice(j, 0, g);
    bus.emit("derlemeler", { tur: "guncelle", id: d.id });
  };
  tutamak.addEventListener("pointerup", birak);
  tutamak.addEventListener("pointercancel", birak);
  tutamak.addEventListener("click", (e) => e.stopPropagation());
}

// Uzun basma (500 ms): dokunmatikte alıntı kartı; sonraki tıklama yutulur, kaydırınca iptal
function uzunBas(el, ac) {
  let zaman = 0, x0 = 0, y0 = 0, tetik = false;
  el.addEventListener("pointerdown", (e) => {
    tetik = false;
    clearTimeout(zaman);
    if (e.pointerType === "mouse" || e.button !== 0) return;
    if (e.target.closest?.(".formul-tex, .formul-kap")) return;   // formülün uzun basışı formül menüsü (matematik.js)
    x0 = e.clientX; y0 = e.clientY;
    clearTimeout(zaman);
    zaman = setTimeout(() => { tetik = true; ac(); }, 500);
  });
  el.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) clearTimeout(zaman); });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, () => clearTimeout(zaman));
  el.addEventListener("click", (e) => { if (tetik) { tetik = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  el.addEventListener("contextmenu", (e) => { if (tetik) e.preventDefault(); });
}

/* ================= Vurguları içe aktar: Kindle ve Readwise (7.0 Y6) ================= */
// Dosya seçilir, disa-kopru.js kitaplara ayırır, pencerede her kitap kitaplıktaki bir belgeyle eşleşir (ad ve yazar
// benzerliği; elle değişir ya da "Atla"). Onayda eşleşen belgenin veri.izler'ine tur: "alinti" izler eklenir.
// Aynı vurgu ikinci kez gelmez: anahtar metin ve kaynak konumu.
const kelimeler = (s) => harfsiz(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((w) => w.length > 1);
function benzerlik(kitap, belge) {
  const ana = (s) => String(s || "").split(/[:(\[]/)[0];
  const a = new Set(kelimeler(ana(kitap.baslik))), b = new Set(kelimeler(ana(belge.ad)));
  if (!a.size || !b.size) return 0;
  let ortak = 0;
  for (const w of a) if (b.has(w)) ortak++;
  let ad = (2 * ortak) / (a.size + b.size);
  const ka = [...a].join(" "), kb = [...b].join(" ");
  if (ka === kb) ad = 1; else if (ka.includes(kb) || kb.includes(ka)) ad = Math.max(ad, 0.85);
  const ya = new Set(kelimeler(kitap.yazar).filter((w) => w.length > 2)), yb = kelimeler(belge.yazar).filter((w) => w.length > 2);
  const yazar = ya.size && yb.some((w) => ya.has(w)) ? 1 : 0;
  return 0.8 * ad + 0.2 * yazar + (ad > 0 && yazar ? 0.05 : 0);
}
// Masa verisi olmayan belgeye iz eklenemez (Masa ilk açılışta sayfaları kurar ve veriyi baştan yazar)
const iceAlabilir = (b) => !!b && (b.tur === "epub" || !!b.veri || b.tur === "cizgi");
const alintiAnahtari = (metin, konum) => harfsiz(sade(metin)).slice(0, 400) + "|" + String(konum || "");

export function vurgulariIceAktar() {
  const girdi = h("input", { type: "file", accept: ".txt,.csv,text/plain,text/csv", hidden: true });
  document.body.append(girdi);
  girdi.addEventListener("change", async () => {
    const f = girdi.files?.[0];
    girdi.remove();
    if (!f) return;
    try { await vurguMetniniAc(await f.text(), f.name); }
    catch (hata) { console.warn("[izler] içe aktarılamadı:", hata); toast(t("Dosya okunamadı.")); }
  }, { once: true });
  girdi.click();
}
// Metin ve dosya adıyla pencere (sınama ve sürükle bırak için de)
export async function vurguMetniniAc(metin, ad = "") {
  const m = await import("./disa-kopru.js");
  const csv = /\.csv$/i.test(ad) || /^\uFEFF?"?(highlight|text)"?\s*,/i.test(String(metin).slice(0, 300));
  const kitaplar = csv ? m.readwiseCsvOku(metin) : m.kindleClippingsOku(metin);
  if (!kitaplar.length) { toast(t("Bu dosyada vurgu bulunamadı. Kindle’ın My Clippings.txt dosyasını ya da Readwise CSV’sini seç.")); return null; }
  return iceAktarPenceresi(kitaplar, { ad, kaynak: csv ? "readwise" : "kindle" });
}

let icePencere = null;
function iceAktarPenceresi(kitaplar, { ad, kaynak }) {
  icePencere?.close();
  const belgeler = store.belgeler.filter((b) => !b.dizgi);
  const toplam = kitaplar.reduce((t, k) => t + k.vurgular.length, 0);
  const durum = h("p", { class: "ice-aktar__durum", role: "status" });
  const onay = h("button", { class: "birincil", type: "button" }, icon("ice-aktar", "i-20"), t("İçe aktar"));
  const vazgec = h("button", { class: "hayalet", type: "button" }, t("Vazgeç"));
  const secimler = [];
  const satirlar = kitaplar.map((k, i) => {
    const puanli = belgeler.map((b) => [b, benzerlik(k, b)]).sort((a, b) => b[1] - a[1]);
    const enIyi = puanli[0] && puanli[0][1] >= 0.5 && iceAlabilir(puanli[0][0]) ? puanli[0][0].id : "";
    const sec = h("select", { class: "izler-girdi ice-aktar__secim", "aria-label": t("{ad}: eşleşen belge", { ad: k.baslik }), dataset: { i: String(i) } },
      h("option", { value: "" }, t("Atla")),
      ...puanli.map(([b]) => h("option", { value: b.id, disabled: !iceAlabilir(b) || null, selected: b.id === enIyi || null },
        b.ad + (b.yazar ? ` · ${b.yazar}` : "") + (!iceAlabilir(b) ? " " + t("(önce bir kez aç)") : ""))));
    secimler.push(sec);
    sec.addEventListener("change", ozet);
    return h("li", { class: "ice-aktar__kitap" },
      h("span", { class: "ice-aktar__sirt", "aria-hidden": "true" }, icon("kitap", "i-20")),
      h("span", { class: "ice-aktar__ad" }, h("b", {}, k.baslik), h("small", {}, [k.yazar, t("{n} vurgu", { n: k.vurgular.length })].filter(Boolean).join(" · "))),
      h("span", { class: "ice-aktar__ok", "aria-hidden": "true" }, icon("sag", "i-16")), sec);
  });
  function ozet() {
    const n = secimler.filter((s) => s.value).length;
    const v = secimler.reduce((t, s, i) => t + (s.value ? kitaplar[i].vurgular.length : 0), 0);
    durum.textContent = n ? t("{n} kitap eşleşti, {v} vurgu eklenecek.", { n, v }) : t("Eşleşen kitap yok. Listeden bir belge seç.");
    onay.disabled = !n;
  }
  const dlg = h("dialog", { class: "pencere ice-aktar-pencere", "aria-labelledby": "iceAktarBaslik" },
    h("header", { class: "ice-aktar__ust" },
      h("span", { class: "ice-aktar__simge", "aria-hidden": "true" }, icon("ice-aktar", "i-20")),
      h("div", {}, h("h2", { id: "iceAktarBaslik", tabindex: "-1" }, t("Vurguları içe aktar")),
        h("p", { class: "ice-aktar__meta" }, [kaynak === "readwise" ? "Readwise" : "Kindle", t("{n} vurgu", { n: toplam }), t("{n} kitap", { n: kitaplar.length }), ad].filter(Boolean).join(" · "))),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    h("p", { class: "ice-aktar__aciklama" }, t("Her kitabı kitaplığındaki belgeyle eşleştir. Vurgular İzlerim’de ve kitabın cep defterinde görünür; sayfada konumlanmaz.")),
    h("ul", { class: "ice-aktar__liste" }, satirlar),
    h("footer", { class: "ice-aktar__alt" }, durum, vazgec, onay));
  vazgec.addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { dlg.remove(); if (icePencere === dlg) icePencere = null; });
  onay.addEventListener("click", async () => {
    onay.disabled = true;
    try {
      const sonuc = await alintilariEkle(secimler.map((s, i) => [kitaplar[i], s.value]).filter(([, id]) => id), kaynak);
      dlg.close();
      const metin = !sonuc.eklenen ? (sonuc.kopya ? t("Yeni vurgu yok: {n} vurgu zaten vardı.", { n: sonuc.kopya }) : t("Eklenecek vurgu yok."))
        : sonuc.kopya ? t("{n} vurgu {k} kitaba eklendi, {c} vurgu zaten vardı.", { n: sonuc.eklenen, k: sonuc.kitap, c: sonuc.kopya })
        : t("{n} vurgu {k} kitaba eklendi.", { n: sonuc.eklenen, k: sonuc.kitap });
      toast(metin, sonuc.eklenen && !E ? { etiket: t("İzlerim’e git"), calistir: () => bus.emit("git", { ekran: "izler" }) } : undefined);
    } catch (hata) {
      console.warn("[izler] içe aktarma:", hata);
      toast(t("İçe aktarılamadı."));
      onay.disabled = false;
    }
  });
  document.body.append(dlg);
  ozet();
  dlg.showModal();
  icePencere = dlg;
  odakla($("#iceAktarBaslik", dlg));
  return dlg;
}
// eslesmeler: [[kitap, belgeId]]. Dönen: { eklenen, kopya, kitap }
export async function alintilariEkle(eslesmeler, kaynak = "kindle") {
  let eklenen = 0, kopya = 0, kitap = 0;
  const kayit = await import("./kayit.js").catch(() => null);
  for (const [k, id] of eslesmeler) {
    const b = belgeBul(id);
    if (!b) continue;
    try { await kayit?.veriBekle?.(b.id); } catch { /* yüklenemedi: bellekteki kullanılır */ }
    if (!b.veri) {
      if (b.tur !== "epub") continue;
      // Hiç açılmamış kitap: Koltuk'un kurduğu biçim (kurulmadi yok: Koltuk açılışta veriyi baştan kurmasın, izler kalsın)
      b.veri = { vurgular: [], cizgiler: [], yerImleri: [], konum: null, asistanNotlari: [], izler: [] };
    }
    if (!Array.isArray(b.veri.izler)) b.veri.izler = [];
    const var_ = new Set(b.veri.izler.filter((z) => z?.tur === "alinti").map((z) => alintiAnahtari(z.metin, z.kaynakKonum)));
    let n = 0;
    for (const v of k.vurgular) {
      const a = alintiAnahtari(v.metin, v.konum);
      if (var_.has(a)) { kopya++; continue; }
      var_.add(a);
      const iz = { id: yeniId("al"), tur: "alinti", metin: String(v.metin).slice(0, 4000), zaman: v.zaman || Date.now(), kaynakKonum: v.konum || "",
        sira: v.sira || 0, iceAktarim: kaynak, cizgiler: [], bas: { p: -1, o: 0 } };
      if (v.not) iz.not = String(v.not).slice(0, 600);
      if (v.notMu) iz.notMu = true;
      b.veri.izler.push(iz);
      n++;
    }
    if (n) { eklenen += n; kitap++; bus.emit("belge:degisti", { belgeId: b.id }); }
  }
  return { eklenen, kopya, kitap };
}

/* ================= Alıntı kartı (OZELLIKLER-7 §6.2, TASARIM-4 4.2) ================= */
// Alıntı, mürekkep izi ve kitap adı kâğıt bir kartta görüntü olur. Kare 1080x1080 ya da hikâye 1080x1920; açık ya da koyu kâğıt.
// Paylaş (navigator.share dosyayla) ya da indir. Değerler tuvale yazılır, CSS değil; önizleme aynı tuvali gösterir.
const ALINTI_KAGIT = {
  acik: { zemin: "#F6F1E7", yazi: "#1C1B19", ikincil: "#6C655C", gren: 0.05, kurdele: "#8C2B38" },
  koyu: { zemin: "#1B1A17", yazi: "#ECE6DA", ikincil: "#9C958A", gren: 0.03, kurdele: "#A8424F" },
};
const ALINTI_BOYUT = { kare: [1080, 1080], hikaye: [1080, 1920] };
let grenDeseni = null;
function grenTuvali() {
  if (grenDeseni) return grenDeseni;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d"), v = g.createImageData(160, 160);
  let t = 2463534242;
  for (let i = 0; i < v.data.length; i += 4) {
    t ^= t << 13; t ^= t >>> 17; t ^= t << 5;   // sabit tohumlu gürültü: her kart aynı doku
    const n = (t >>> 0) % 255;
    v.data[i] = v.data[i + 1] = v.data[i + 2] = n; v.data[i + 3] = 255;
  }
  g.putImageData(v, 0, 0);
  return (grenDeseni = c);
}
// Metni genişliğe göre satırlara böler; en çok n satır, taşarsa son satır "…" ile biter
function satirlaKes(g, metin, maxW, n) {
  const kelimeler = sade(metin).split(" ");
  const satirlar = [];
  let s = "";
  for (let i = 0; i < kelimeler.length; i++) {
    const k = kelimeler[i];
    const dene = s ? s + " " + k : k;
    if (g.measureText(dene).width <= maxW || !s) { s = dene; continue; }
    satirlar.push(s);
    s = k;
    if (satirlar.length === n) return { satirlar: kesik(g, satirlar, maxW), tasti: true };
  }
  if (s) satirlar.push(s);
  if (satirlar.length > n) return { satirlar: kesik(g, satirlar.slice(0, n), maxW), tasti: true };
  return { satirlar, tasti: false };
}
function kesik(g, satirlar, maxW) {
  let son = satirlar[satirlar.length - 1];
  while (son.length > 1 && g.measureText(son + "…").width > maxW) son = son.slice(0, -1).trimEnd();
  satirlar[satirlar.length - 1] = son.replace(/[\s,.;:]+$/, "") + "…";
  return satirlar;
}
// Rengi beyaza doğru açar (t: 0..1)
function acikTon(hex, t) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16), k = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  return `#${k(n >> 16)}${k((n >> 8) & 255)}${k(n & 255)}`;
}
function svgGorsel(svg) {
  return new Promise((coz) => {
    if (!svg) return coz(null);
    const img = new Image();
    img.onload = () => coz(img);
    img.onerror = () => coz(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

async function alintiKartiCiz(x, { bicim = "kare", kagit = "acik", iz = true } = {}) {
  const [W, H] = ALINTI_BOYUT[bicim] || ALINTI_BOYUT.kare;
  const K = ALINTI_KAGIT[kagit] || ALINTI_KAGIT.acik;
  const hikaye = bicim === "hikaye";
  try { await Promise.all(["400 52px Literata", "italic 400 30px Literata", "500 22px Inter", "400 24px Inter", "400 22px \"IBM Plex Mono\""].map((f) => document.fonts.load(f))); } catch { /* yedek yazı tipi */ }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  // Zemin: düz renk, ince gren ve kenarlara doğru hafif kararma
  g.fillStyle = K.zemin; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = K.gren; g.globalCompositeOperation = kagit === "koyu" ? "screen" : "multiply";
  g.fillStyle = g.createPattern(grenTuvali(), "repeat"); g.fillRect(0, 0, W, H); g.restore();
  const kararma = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  kararma.addColorStop(0, "#00000000"); kararma.addColorStop(1, "#00000014");
  g.fillStyle = kararma; g.fillRect(0, 0, W, H);
  // Kurdele: sol üstte kartın kenarından sarkar, ucu çentikli
  const kw = hikaye ? 32 : 28, kh = hikaye ? 120 : 96, kx = 96;
  g.fillStyle = K.kurdele;
  g.beginPath(); g.moveTo(kx, 0); g.lineTo(kx + kw, 0); g.lineTo(kx + kw, kh); g.lineTo(kx + kw / 2, kh - kw * 0.45); g.lineTo(kx, kh); g.closePath(); g.fill();

  const KENAR = 96, ALT = hikaye ? 200 : 96, maxW = W - 2 * KENAR;
  const b = belgeBul(x.belgeId);
  // Alt satırlar: kitap adı, yazar, sayfa
  const alt = [];
  if (b?.ad) alt.push(["italic 400 30px Literata, Georgia, serif", K.yazi, b.ad, 40]);
  if (b?.yazar) alt.push(["400 24px Inter, system-ui, sans-serif", K.ikincil, b.yazar, 34]);
  const yer = [x.yer, x.bolum].filter(Boolean).join(" · ");
  if (yer) alt.push(["400 22px \"IBM Plex Mono\", monospace", K.ikincil, yer, 30]);
  const altYuk = alt.reduce((t, a) => t + a[3], 0);
  const altBas = H - ALT - altYuk + 30;
  // Alıntı: sığmazsa yazı küçülür, en sonda "…"
  const ust = (hikaye ? 220 : kh + 72);
  const alanAlt = altBas - 30 - 56;
  let boy = hikaye ? 60 : 52, satirlar, araliklar;
  for (const deneme of (hikaye ? [60, 52, 44] : [52, 44, 38])) {
    boy = deneme;
    g.font = `400 ${boy}px Literata, Georgia, serif`;
    const n = hikaye ? 12 : 8;
    araliklar = Math.round(boy * (hikaye ? 1.34 : 1.32));
    const s = satirlaKes(g, x.metin, maxW, n);
    satirlar = s.satirlar;
    if (!s.tasti && satirlar.length * araliklar <= alanAlt - ust) break;
  }
  const blokYuk = satirlar.length * araliklar;
  const y0 = Math.max(ust, ust + (alanAlt - ust - blokYuk) / 2);
  // Koyu kâğıtta mürekkep açılır: lacivert iz siyah zeminde kaybolmasın
  const ham = x.tur === "vurgu" ? vurguHex(x.renk) : (x.renk || "#24407A");
  const renk = kagit === "koyu" && x.tur !== "vurgu" ? acikTon(ham, 0.5) : ham;
  const satirGen = satirlar.map((s) => g.measureText(s).width);
  // Vurgu: satırların arkasında fosfor şerit
  if (iz && x.tur === "vurgu") {
    g.save(); g.globalAlpha = kagit === "koyu" ? 0.38 : 0.55; g.fillStyle = renk;
    satirlar.forEach((s, i) => g.fillRect(KENAR - 6, y0 + i * araliklar + boy * 0.2, satirGen[i] + 12, boy * 0.72));
    g.restore();
  }
  g.fillStyle = K.yazi; g.textBaseline = "alphabetic";
  g.font = `400 ${boy}px Literata, Georgia, serif`;
  satirlar.forEach((s, i) => g.fillText(s, KENAR, y0 + i * araliklar + boy));
  // Mürekkep izi: kullanıcının kendi vuruşu (önizleme yolu), alıntının üstünde aynı bağıl yerde, kalınlık 2,2 kat
  if (iz && x.onizleme && x.tur !== "vurgu") {
    let r;
    const sonY = y0 + (satirlar.length - 1) * araliklar + boy;
    if (x.tur === "alt") r = [KENAR - 8, sonY + boy * 0.02, satirGen[satirGen.length - 1] + 16, boy * 0.42];
    else if (x.tur === "kenar") r = [KENAR - 64, y0 + boy * 0.1, 36, blokYuk];
    else if (x.tur === "daire") r = [KENAR - 40, y0 - boy * 0.25, Math.max(...satirGen) + 80, blokYuk + boy * 0.6];
    else r = [KENAR - 72, y0, 56, Math.min(blokYuk, boy * 1.6)];
    try {
      // Yol 48x32'lik kutuda; noktalar hedef dikdörtgene taşınır, çizgi kalınlığı ölçekten bağımsız kalır
      // yolKur izi kutunun PAY'lı iç alanına sığdırır: o iç alan hedefe eşlenir
      const sx = r[2] / (KUTU_W - 2 * PAY), sy = r[3] / (KUTU_H - 2 * PAY);
      const yol = new Path2D();
      yol.addPath(new Path2D(x.onizleme), new DOMMatrix([sx, 0, 0, sy, r[0] - PAY * sx, r[1] - PAY * sy]));
      g.save();
      g.lineWidth = 7; g.strokeStyle = renk; g.lineCap = "round"; g.lineJoin = "round"; g.globalAlpha = 0.9;
      g.stroke(yol);
      g.restore();
    } catch { /* yol çizilemedi: iz olmadan */ }
  }
  // Alt satırlar
  let ay = altBas;
  for (const [font, rk, metin, adim] of alt) {
    g.font = font; g.fillStyle = rk;
    let m = metin;
    while (m.length > 4 && g.measureText(m).width > maxW - 200) m = m.slice(0, -2).trimEnd() + "…";
    g.fillText(m, KENAR, ay);
    ay += adim;
  }
  // İmza: sağ altta ∫ ve "Kenar Notu"; ex libris varsa onun yerine mühür
  const exKayit = store.ayarlar.exLibris;
  const ex = exLibrisVar() ? await svgGorsel(exLibrisSvg(96, kagit === "koyu" ? { ...exKayit, renk: "#ECE6DA" } : exKayit, { aci: -4 })) : null;
  if (ex) { g.save(); g.globalAlpha = kagit === "koyu" ? 0.7 : 0.9; g.drawImage(ex, W - KENAR - 96, H - ALT - 96 + 8, 96, 96); g.restore(); }
  else {
    g.save(); g.globalAlpha = 0.55; g.fillStyle = K.yazi; g.textAlign = "right";
    g.font = "500 22px Inter, system-ui, sans-serif"; g.fillText("Kenar Notu", W - KENAR, H - ALT);
    g.font = "italic 400 40px Literata, Georgia, serif"; g.fillText("∫", W - KENAR - g.measureText("Kenar Notu").width - 132, H - ALT + 4);
    g.restore();
  }
  return c;
}

let alintiPenceresi = null;
// Koltuk ve Masa da çağırabilir (ör. seçim menüsünden): x = { metin, belgeId, tur, onizleme?, renk?, yer?, bolum? }
export async function alintiKartiAc(x) {
  if (!x?.metin) return;
  alintiPenceresi?.close();
  const secim = { bicim: "kare", kagit: document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches) ? "koyu" : "acik", iz: true };
  const onizleme = h("div", { class: "alinti-onizleme yer-tutucu", role: "img", "aria-label": t("Alıntı kartı önizlemesi") });
  const parcaliKur = (etiket, secenekler, alan) => {
    const el = h("div", { class: "parcali", role: "group", "aria-label": etiket });
    const tazele = () => { for (const b of el.children) b.setAttribute("aria-pressed", String(b.dataset.v === secim[alan])); };
    for (const [v, ad] of secenekler) {
      const b = h("button", { type: "button", dataset: { v } }, ad);
      b.addEventListener("click", () => { secim[alan] = v; tazele(); ciz(); });
      el.append(b);
    }
    tazele();
    return el;
  };
  const izAnahtar = h("button", { class: "anahtar-satir", type: "button", role: "switch", "aria-checked": "true" },
    h("span", {}, t("Mürekkep izimi göster"), h("small", {}, t("Alt çizgi, daire ya da vurgu kartta da görünür"))), h("span", { class: "anahtar", "aria-hidden": "true" }));
  izAnahtar.addEventListener("click", () => { secim.iz = !secim.iz; izAnahtar.setAttribute("aria-checked", String(secim.iz)); ciz(); });
  const paylasD = h("button", { class: "birincil", type: "button", hidden: true }, icon("paylas", "i-20"), t("Paylaş"));
  const indirD = h("button", { class: "ikincil", type: "button" }, icon("indir", "i-20"), t("İndir"));
  const dlg = h("dialog", { class: "pencere alinti-pencere", "aria-labelledby": "alintiBaslik" },
    h("header", { class: "alinti-pencere__ust" }, h("h2", { id: "alintiBaslik", tabindex: "-1" }, t("Alıntı kartı")),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kapat"), onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "alinti-pencere__govde" }, onizleme,
      h("div", { class: "alinti-pencere__secenek" },
        h("span", { class: "t-etiket" }, t("Biçim")), parcaliKur(t("Biçim"), [["kare", t("Kare")], ["hikaye", t("Hikâye")]], "bicim"),
        h("span", { class: "t-etiket" }, t("Kâğıt")), parcaliKur(t("Kâğıt"), [["acik", ingilizceMi ? "Light" : "Açık"], ["koyu", t("Koyu")]], "kagit"),
        x.onizleme || x.tur === "vurgu" ? izAnahtar : null,
        h("div", { class: "pencere-alt" }, indirD, paylasD))));
  let blob = null, sira = 0;
  const dosyaAdi = () => {
    const b = belgeBul(x.belgeId), g = new Date();
    const ad = String(b?.ad || "Kenar Notu").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").slice(0, 40);
    return `${t("Alinti")}-${ad}-${g.getFullYear()}${String(g.getMonth() + 1).padStart(2, "0")}${String(g.getDate()).padStart(2, "0")}.png`;
  };
  async function ciz() {
    const benim = ++sira;
    blob = null;
    paylasD.disabled = indirD.disabled = true;
    const gecikme = setTimeout(() => onizleme.classList.add("yer-tutucu"), 300);
    const c = await alintiKartiCiz(x, secim);
    clearTimeout(gecikme);
    if (benim !== sira || !dlg.isConnected) return;
    onizleme.classList.remove("yer-tutucu");
    onizleme.dataset.bicim = secim.bicim;
    c.className = "alinti-tuval";
    onizleme.replaceChildren(c);
    blob = await new Promise((r) => c.toBlob(r, "image/png"));
    if (benim !== sira) return;
    const dosya = blob && new File([blob], dosyaAdi(), { type: "image/png" });
    paylasD.hidden = !(dosya && navigator.canShare?.({ files: [dosya] }));
    paylasD.disabled = indirD.disabled = !blob;
  }
  paylasD.addEventListener("click", async () => {
    if (!blob) return;
    try { await navigator.share({ files: [new File([blob], dosyaAdi(), { type: "image/png" })], title: belgeBul(x.belgeId)?.ad || t("Alıntı") }); }
    catch (hata) { if (hata?.name !== "AbortError") toast(t("Paylaşılamadı; İndir ile kaydedebilirsin.")); }
  });
  indirD.addEventListener("click", () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: dosyaAdi(), hidden: true });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  dlg.addEventListener("close", () => { if (alintiPenceresi === dlg) alintiPenceresi = null; dlg.remove(); });
  dlg.addEventListener("click", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  document.body.append(dlg);
  fisKapat();
  dlg.showModal();
  alintiPenceresi = dlg;
  odakla($("#alintiBaslik", dlg));
  ciz();
}
