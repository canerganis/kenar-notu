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

import { $, $$, h, icon, bus, store, belgeBul, yeniId, toast, kartEkle, hareketAz, cizgiMi, EPUB_VURGULARI, vurguRengi,
  exLibrisSvg, exLibrisVar, odakla } from "./ortak.js";

/* ================= Yardımcılar ================= */
const SUZGECLER = [["tumu", "Tümü"], ["alt", "Altı çizili"], ["daire", "Yuvarlak"], ["kenar", "Kenar"], ["isaret", "İşaret"], ["vurgu", "Vurgu"], ["not", "Not"]];
const TUR_ADI = { alt: "Altı çizili", daire: "Yuvarlak içinde", kenar: "Kenar işareti", isaret: "İşaret", serbest: "Kalem izi", vurgu: "Vurgu", not: "Not" };
const IZ_TURLERI = new Set(["alt", "daire", "kenar", "isaret", "serbest"]);
const MAKS_METIN = 280;

const sade = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const kirp = (s, n = MAKS_METIN) => { const t = sade(s); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const harfsiz = (s) => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const VURGU_HEX = Object.fromEntries(EPUB_VURGULARI.map(([ad, hex]) => [harfsiz(ad), hex]));
const vurguHex = (r) => (typeof r === "string" && r.startsWith("#") ? vurguRengi(r) : VURGU_HEX[harfsiz(r)] || "#F4D63E");

function neZaman(t) {
  if (!t) return "";
  const simdi = new Date(), fark = simdi - t;
  if (fark < 6e4) return "az önce";
  if (fark < 36e5) return `${Math.round(fark / 6e4)} dk önce`;
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const gun = Math.ceil((bugun - t) / 864e5);
  if (gun <= 0) return `${Math.round(fark / 36e5)} saat önce`;
  if (gun === 1) return "dün";
  if (gun < 7) return `${gun} gün önce`;
  return tarih(t);
}
const tarih = (t) => (t ? new Date(t).toLocaleDateString("tr", { day: "numeric", month: "short", year: "numeric" }) : "");

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
    if (x.konum.p != null) {
      const yuzde = kaynak?.adet ? Math.round((x.konum.p / kaynak.adet) * 100) : null;
      x.bolum = x.bolumAdi || kaynak?.bolum(x.konum.p) || "";
      x.yer = yuzde != null ? `%${yuzde}` : "";
      x.grup = x.bolum || "Kitap";
      x.sira = x.konum.p + (x.konum.oran || 0);
    } else {
      x.yer = x.konum.sayfa != null ? `s. ${x.konum.sayfa}` : "";
      x.grup = x.yer || "Sayfasız";
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

const suzgecUyar = (x, f) => f === "tumu" || x.tur === f || (f === "not" && !!sade(x.not));
const defterde = (x) => x.kaynak === "iz" || x.kaynak === "vurgu";

/* ================= Eylemler ================= */
function gitIz(x, { kapat } = {}) {
  const b = belgeBul(x.belgeId);
  if (!b) { toast("Bu belge kitaplıkta yok."); return; }
  const o = { ekran: "belge", belgeId: b.id, izId: x.id };
  if (x.konum.p != null) o.konum = { p: x.konum.p, oran: x.konum.oran || 0 };
  else if (x.konum.sayfa != null) o.sayfa = x.konum.sayfa;
  kapat?.();
  bus.emit("git", o);
}

function kartaCevir(x) {
  const b = belgeBul(x.belgeId);
  if (!x.metin) { toast("Bu izin altında metin yok; karta çevrilemez."); return; }
  const yer = [x.yer, x.bolum].filter(Boolean).join(", ");
  kartEkle({
    tur: "soru", on: { metin: `“${x.metin}”` }, arka: { metin: sade(x.not) || [b?.ad, yer].filter(Boolean).join(" · ") },
    belgeId: x.belgeId, belgeAd: b?.ad || "", sayfa: x.konum.sayfa ?? 1, izId: x.id,
  });
  toast("Karta çevrildi", { etiket: "Tekrar’a git", calistir: () => bus.emit("git", { ekran: "tekrar" }) });
}

// İzin ve vurgunun kısa notu kendi kaydına yazılır (vurguda zaten "Kenar notu" alanı)
// Zamanlayıcı belge başına: iki belgenin notu art arda yazılınca ilki düşmesin
const notZaman = new Map();
function notYaz(x, deger) {
  if (!x.kayit || (x.kaynak !== "iz" && x.kaynak !== "vurgu")) return;
  const t = String(deger || "").slice(0, 600);
  if (t.trim()) x.kayit.not = t; else delete x.kayit.not;
  x.not = t;
  clearTimeout(notZaman.get(x.belgeId));
  notZaman.set(x.belgeId, setTimeout(() => { notZaman.delete(x.belgeId); bus.emit("belge:degisti", { belgeId: x.belgeId }); }, 400));
}

/* ---------- küçük fiş (deftere ekle) ---------- */
let acikFis = null;
function fisAc(capa, icerik) {
  fisKapat();
  const el = h("div", { class: "izler-fis cam-yuzey", role: "menu" }, icerik);
  document.body.append(el);
  const r = capa.getBoundingClientRect();
  const w = el.offsetWidth, y = el.offsetHeight;
  el.style.left = `${Math.round(Math.min(Math.max(8, r.right - w), innerWidth - w - 8))}px`;
  el.style.top = `${Math.round(r.bottom + 6 + y > innerHeight - 8 ? Math.max(8, r.top - y - 6) : r.bottom + 6)}px`;
  const disari = (e) => { if (!el.contains(e.target) && !capa.contains(e.target)) fisKapat(); };
  const tus = (e) => { if (e.key === "Escape") { e.stopPropagation(); fisKapat(); } };
  setTimeout(() => document.addEventListener("pointerdown", disari, true), 0);
  document.addEventListener("keydown", tus, true);
  acikFis = { el, kapat: () => { document.removeEventListener("pointerdown", disari, true); document.removeEventListener("keydown", tus, true); el.remove(); } };
  $("button, input", el)?.focus({ preventScroll: true });
}
function fisKapat() { acikFis?.kapat(); acikFis = null; }

function derlemeyeEkleFisi(capa, x) {
  const ekle = (d) => {
    if (d.girdiler.some((g) => g.belgeId === x.belgeId && g.izId === x.id)) { toast(`Zaten “${d.ad}” içinde`); fisKapat(); return; }
    d.girdiler.push({ belgeId: x.belgeId, izId: x.id });
    bus.emit("derlemeler", { tur: "guncelle", id: d.id });
    toast(`“${d.ad}” derlemesine eklendi`);
    fisKapat();
  };
  const ad = h("input", { class: "izler-girdi", placeholder: "Yeni derlemenin adı", "aria-label": "Yeni derlemenin adı", maxlength: "80", enterkeyhint: "done" });
  const form = h("form", { class: "izler-fis__form" }, ad, h("button", { class: "hayalet", type: "submit" }, "Oluştur"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = derlemeOlustur(ad.value.trim() || "Adsız derleme", []);
    ekle(d);
  });
  fisAc(capa, [
    h("p", { class: "izler-fis__baslik" }, "Deftere ekle"),
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
function onizlemeEl(x, sinif = "iz-onizleme") {
  const kap = h("span", { class: sinif + (x.kursun ? " kursun" : ""), "aria-hidden": "true" });
  if (x.tur === "vurgu") kap.append(h("i", { class: "iz-vurgu-serit", style: `--iz-renk:${x.renk}` }));
  else if (x.onizleme) kap.append(svgOnizleme(x.onizleme, x.renk || null));
  else kap.append(icon(x.kaynak === "asistan" ? "sor" : "notlar", "i-20"));
  return kap;
}
function eylemler(x) {
  const kart = h("button", { class: "simge-dugme karta-cevir", type: "button", "aria-label": "Karta çevir", title: "Karta çevir", disabled: !x.metin || null }, icon("karta-cevir", "i-20"));
  kart.addEventListener("click", (e) => { e.stopPropagation(); kartaCevir(x); });
  const defter = h("button", { class: "simge-dugme deftere-ekle", type: "button", "aria-label": "Deftere ekle", title: "Deftere ekle" }, icon("arti", "i-20"));
  defter.addEventListener("click", (e) => { e.stopPropagation(); derlemeyeEkleFisi(defter, x); });
  const alinti = x.metin ? h("button", { class: "simge-dugme alinti-karti", type: "button", "aria-label": "Alıntı kartı", title: "Alıntı kartı" }, icon("paylas", "i-20")) : null;
  alinti?.addEventListener("click", (e) => { e.stopPropagation(); alintiKartiAc(x); });
  return h("span", { class: "iz-eylemler" }, alinti, kart, defter);
}
function izSatiri(x, { kapat } = {}) {
  const meta = [x.yer, neZaman(x.zaman), x.kursun ? "kurşun" : ""].filter(Boolean).join(" · ");
  const el = h("div", { class: "iz-satir", role: "listitem", tabindex: "0", "aria-label": `${TUR_ADI[x.tur] || "İz"}, ${x.metin || "metinsiz"}, ${x.yer || ""}` },
    onizlemeEl(x),
    h("span", { class: "iz-govde" },
      h("span", { class: "iz-metin" + (x.kaynak === "not" || x.kaynak === "metin" ? " el" : "") }, x.metin),
      x.not && x.kaynak !== "not" ? h("span", { class: "iz-satir__not" }, x.not) : null,
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
  const kap = h("div", { class: sinif, role: "group", "aria-label": "İz süzgeci" });
  for (const [id, ad] of SUZGECLER) {
    const n = sayac[id] || 0;
    if (id !== "tumu" && !n && id !== secili) continue;
    const d = h("button", { class: "cip", type: "button", "aria-pressed": String(id === secili) }, ad, h("span", { class: "sayi" }, String(n)));
    d.addEventListener("click", () => sec(id));
    kap.append(d);
  }
  return kap;
}
function say(liste) {
  const s = { tumu: liste.length };
  for (const x of liste) { s[x.tur] = (s[x.tur] || 0) + 1; if (x.tur !== "not" && sade(x.not)) s.not = (s.not || 0) + 1; }
  return s;
}

/* ================= İzler sekmesi (Notlar paneli) ================= */
export function izlerPaneli(kap, belge) {
  let suzgec = "tumu", liste = [], bitti = false;
  kap.classList.add("izler-paneli");
  const govde = h("div", { class: "izler-liste", role: "list", "aria-label": "İzler" });
  const ciz = () => {
    if (bitti) return;
    const sayac = say(liste);
    const gorunen = liste.filter((x) => suzgecUyar(x, suzgec));
    const gruplar = new Map();
    for (const x of gorunen) { if (!gruplar.has(x.grup)) gruplar.set(x.grup, []); gruplar.get(x.grup).push(x); }
    govde.replaceChildren(...(gruplar.size ? [...gruplar].map(([ad, xs]) =>
      h("section", { class: "izler-grup" }, h("h3", {}, ad), ...xs.map((x) => izSatiri(x))))
      : [bosDurum(liste.length ? "Bu süzgeçte iz yok." : "Henüz bir iz yok.", liste.length ? "Başka bir süzgeç seç." : bosAciklama(belge))]));
    kap.replaceChildren(suzgecCipleri(sayac, suzgec, (id) => { suzgec = id; ciz(); }), govde);
  };
  const yenile = async () => { liste = await hazirla(belge); ciz(); };
  let plan = 0;
  const degisti = (o) => { if (o?.belgeId === belge.id) { clearTimeout(plan); plan = setTimeout(yenile, 300); } };
  const coz = bus.on("belge:degisti", degisti);
  kap.replaceChildren(govde);
  yenile();
  return { yenile, kapat: () => { bitti = true; coz(); clearTimeout(plan); kap.classList.remove("izler-paneli"); } };
}
const bosAciklama = (b) => (b?.tur === "epub" ? "Koltuk’ta bir satırın altını kalemle çiz; burada belirir."
  : cizgiMi(b) ? "Sayfanın üstüne kalemle işaret koy; burada belirir." : "Sayfada bir satırın altını kalemle çiz ya da yuvarlak içine al; burada belirir.");
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
  const defterD = h("button", { class: "hayalet", type: "button" }, icon("izler", "i-20"), "Cep defteri");
  const kapatD = h("button", { class: "simge-dugme", type: "button", "aria-label": "İzleri kapat" }, icon("kapat", "i-20"));
  const el = h("aside", { class: "izler-yan", role: "complementary", "aria-label": `${belge.ad}: izler` },
    h("header", { class: "panel-ust" }, h("h2", {}, "İzler"), h("span", { class: "izler-yan__ad" }, belge.ad), defterD, kapatD), ic);
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
  const sayac = h("span", { class: "cep-defter__sayi" }, `${liste.length} alıntı`);
  const sayfa = h("div", { class: "cep-defter__yaprak", role: "list", "aria-label": "Alıntılar" });
  const md = h("button", { class: "hayalet", type: "button" }, "Markdown");
  const pdf = h("button", { class: "hayalet", type: "button" }, "PDF");
  const kapatD = h("button", { class: "simge-dugme", type: "button", "aria-label": "Defteri kapat" }, icon("kapat", "i-20"));
  const kapak = h("div", { class: "cep-defter__kapak", style: `--c:${belge.kapak || "#24324F"}` },
    h("div", { class: "cep-defter__ust" },
      h("div", {}, h("h2", { id: "cepDefterBaslik" }, belge.ad), h("p", {}, "Cep defteri · ", sayac)),
      h("div", { class: "cep-defter__eylem" }, md, pdf, kapatD)),
    sayfa, h("i", { class: "cep-defter__bant", "aria-hidden": "true" }));
  const perde = h("div", { class: "cep-defter", role: "dialog", "aria-modal": "true", "aria-labelledby": "cepDefterBaslik", tabindex: "-1" }, kapak);

  const ciz = () => {
    if (!liste.length) {
      sayfa.replaceChildren(bosDurum("Cep defteri boş.", "Altını çizdiğin alıntılar buraya iner. " + bosAciklama(belge),
        { etiket: "Okumaya dön", calistir: () => { kapat(); bus.emit("git", { ekran: "belge", belgeId: belge.id }); } }));
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
    pdf.disabled = true; pdf.textContent = "Hazırlanıyor";
    try { await pdfPaylas(belge, liste); } catch (hata) { console.warn("[izler] PDF hazırlanamadı:", hata); toast("Defter PDF olarak hazırlanamadı."); }
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
  const metin = h("blockquote", { class: "alinti__metin" }, x.metin || h("span", { class: "metinsiz" }, "Metinsiz iz"));
  const notAlani = h("textarea", { class: "alinti__not", rows: "1", placeholder: "Not ekle", "aria-label": "Alıntının yanına not", maxlength: "600" });
  notAlani.value = x.not || "";
  const boyutla = () => { notAlani.style.height = "auto"; notAlani.style.height = `${notAlani.scrollHeight}px`; };
  notAlani.addEventListener("input", () => { notYaz(x, notAlani.value); boyutla(); });
  requestAnimationFrame(boyutla);
  const git = h("button", { class: "alinti__git", type: "button", "aria-label": `${x.yer || "Yerine"} git` }, metin, h("span", { class: "alinti__meta" }, meta));
  git.addEventListener("click", () => gitIz(x, { kapat }));
  if (x.metin) uzunBas(git, () => alintiKartiAc(x));
  return h("article", { class: "alinti", role: "listitem" },
    h("div", { class: "alinti__kenar" }, onizlemeEl(x, "alinti__iz")),
    h("div", { class: "alinti__govde" }, git, notAlani),
    eylemler(x));
}

/* ---------- dışa aktarma ---------- */
const dosyaAdi = (b, uz) => `${String(b?.ad || "Defter").replace(/[\\/:*?"<>|]+/g, " ").trim()} (cep defteri).${uz}`;
function markdownMetni(baslik, liste, { kaynakAdi } = {}) {
  const satirlar = [`# ${baslik}`, "", `_${liste.length} alıntı, Kenar Notu cep defteri_`, ""];
  for (const x of liste) {
    satirlar.push(`> ${(x.metin || "(metinsiz iz)").replace(/\n/g, "\n> ")}`, "");
    const yer = [kaynakAdi?.(x), [x.yer, x.bolum].filter(Boolean).join(", "), tarih(x.zaman)].filter(Boolean).join(" · ");
    if (yer) satirlar.push(`<small>${yer}</small>`, "");
    if (sade(x.not)) satirlar.push(`Not: ${sade(x.not)}`, "");
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

// PDF: her yaprak tuvalde dizilir (Türkçe harfler standart PDF yazı tiplerinde yok), A5 sayfaya görüntü olarak konur
async function pdfPaylas(belge, liste, { kaynakAdi } = {}) {
  const { PDFDocument } = await import("../lib/pdf-lib.esm.min.js");
  try { await Promise.all(["400 20px Literata", "italic 400 16px Literata", "400 11px \"IBM Plex Mono\"", "500 18px Caveat"].map((f) => document.fonts.load(f))); } catch { /* yedek yazı tipi */ }
  const W = 420, H = 595, Z = 3, KENAR = 64, SAG = 36, UST = 64, ALT = 48;   // punto; kenar boşluğu solda geniş (kenar çizgisi)
  const doc = await PDFDocument.create();
  doc.setTitle(`${belge.ad}: cep defteri`);
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
      g.fillText(`CEP DEFTERİ · ${liste.length} ALINTI`, KENAR, y); y += 30;
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
    const satirlar = satirla(x.metin || "Metinsiz iz", govdeFont, genis);
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
  E = { kap, suzgec: "tumu", secim: "hepsi", birlestir: null, kaynaklar: new Map(), dizinIstek: new Set(), veri: [], cozuculer: [] };
  kap.classList.add("izlerim");
  E.yan = h("nav", { class: "izlerim-yan", "aria-label": "İz süzgeci ve defterler" });
  E.govde = h("div", { class: "izlerim-govde" });
  kap.append(E.yan, E.govde);
  E.cozuculer.push(bus.on("belge:degisti", () => yenilePlanla()), bus.on("belgeler", () => yenilePlanla()), bus.on("derlemeler", () => { if (!E?.sessiz) ciz(); }));
  await topla();
  ciz();
}
export function kapat() {
  if (!E) return;
  fisKapat();
  for (const c of E.cozuculer) c();
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
}
const tumIzler = () => E.veri.flatMap((k) => k.izler);
const izBul = (belgeId, izId) => E.veri.find((k) => k.belge.id === belgeId)?.izler.find((x) => x.id === izId) || null;

function ciz() {
  if (!E) return;
  const y = E.govde.scrollTop;
  yanCiz();
  if (E.secim.startsWith("derleme:")) derlemeCiz(E.secim.slice(8));
  else govdeCiz();
  E.govde.scrollTop = y;
}

function yanCiz() {
  const hepsi = tumIzler(), sayac = say(hepsi);
  const secenek = (id, ad, n, onEk = null) => {
    const d = h("button", { type: "button", "aria-pressed": String(E.secim === "hepsi" && E.suzgec === id) }, onEk, h("span", { class: "ad" }, ad), h("span", { class: "sayi" }, String(n || 0)));
    d.addEventListener("click", () => { E.secim = "hepsi"; E.suzgec = id; E.govde.scrollTop = 0; ciz(); });
    return d;
  };
  const geri = h("button", { class: "izlerim-geri hayalet", type: "button" }, icon("geri", "i-20"), "Kitaplık");
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
    h("p", { class: "izlerim-yan__baslik" }, "Süzgeç"),
    h("div", { class: "izlerim-yan__liste" }, SUZGECLER.filter(([id]) => id === "tumu" || sayac[id]).map(([id, ad]) => secenek(id, ad, sayac[id]))),
    ...(kitaplar.length ? [h("p", { class: "izlerim-yan__baslik" }, "Defterler")] : []),   // null "null" yazısına dönerdi
    h("div", { class: "izlerim-yan__liste" }, kitaplar),
    h("p", { class: "izlerim-yan__baslik" }, "Derlemeler"),
    h("div", { class: "izlerim-yan__liste" }, derlemeler,
      h("button", { class: "izlerim-yan__yeni", type: "button", onclick: () => birlestirBasla() }, icon("arti", "i-20"), h("span", { class: "ad" }, "Defterleri birleştir"))));
}

function ustCiz(baslik, sayacMetni, ...ek) {
  return h("header", { class: "izlerim-ust" }, h("h1", {}, baslik), h("span", { class: "izlerim-sayac" }, sayacMetni), h("span", { class: "izlerim-ust__bosluk" }), ...ek);
}

function govdeCiz() {
  const hepsi = tumIzler();
  const kitapSecili = E.secim.startsWith("kitap:") ? E.secim.slice(6) : null;
  const kitaplar = E.veri.filter((k) => !kitapSecili || k.belge.id === kitapSecili);
  const birlestirD = h("button", { class: "ikincil", type: "button" }, icon("izler", "i-20"), "Birleştir");
  birlestirD.addEventListener("click", () => birlestirBasla());
  const parcalar = [ustCiz("İzlerim", `${hepsi.length} iz · ${E.veri.length} kitap`, E.veri.length > 1 ? birlestirD : null)];
  if (!hepsi.length) {
    const b = sonKitap();
    parcalar.push(h("div", { class: "izlerim-bos" }, h("p", { class: "izlerim-bos__baslik" }, "Henüz bir iz yok."),
      h("p", { class: "izlerim-bos__aciklama" }, "Okurken bir satırın altını çiz ya da kenara yaz; hepsi burada toplanır."),
      b ? h("button", { class: "birincil izler-bos__dugme", type: "button", onclick: () => bus.emit("git", { ekran: "belge", belgeId: b.id }) }, "Okumaya başla") : null));
    E.govde.replaceChildren(...parcalar);
    return;
  }
  // Defter rafı: her kitabın cep defteri, sırtı kitabın rengi; birleştirirken seçilir
  if (!kitapSecili) parcalar.push(defterRafi());
  if (E.birlestir) parcalar.push(birlestirCubugu());
  for (const { belge, izler } of kitaplar) {
    const gorunen = izler.filter((x) => suzgecUyar(x, E.suzgec));
    if (!gorunen.length) continue;
    const defterD = h("button", { class: "hayalet", type: "button" }, "Cep defteri");
    defterD.addEventListener("click", () => defterAc(belge));
    parcalar.push(h("section", { class: "izlerim-kitap", "aria-label": belge.ad },
      h("header", {}, h("i", { class: "sirt", style: `--kapak-renk:${belge.kapak || "#7D1D2C"}` }), h("h2", {}, belge.ad),
        h("span", { class: "izlerim-sayac" }, `${gorunen.length} iz`), h("span", { class: "izlerim-ust__bosluk" }), defterD),
      h("div", { role: "list" }, gorunen.map((x) => izlerimSatiri(x)))));
  }
  if (parcalar.length === 1 + (kitapSecili ? 0 : 1) + (E.birlestir ? 1 : 0)) parcalar.push(bosDurum("Bu süzgeçte iz yok.", "Başka bir süzgeç seç.",
    { etiket: "Tümünü göster", calistir: () => { E.secim = "hepsi"; E.suzgec = "tumu"; ciz(); } }));
  E.govde.replaceChildren(...parcalar);
}

// Satır: solda kenar sütunu (izin mürekkebi ve yeri), sağda alıntı; tam bir kenar notu
function izlerimSatiri(x, { kaynakAdi, ekEylem } = {}) {
  const meta = [kaynakAdi, x.bolum, neZaman(x.zaman), x.kursun ? "kurşun" : ""].filter(Boolean).join(" · ");
  const el = h("div", { class: "izlerim-satir", role: "listitem", tabindex: "0" },
    h("div", { class: "izlerim-kenar" }, onizlemeEl(x, "kenar-iz"), h("span", { class: "konum" }, x.yer || TUR_ADI[x.tur])),
    h("div", { class: "izlerim-satir__govde" },
      h("blockquote", { class: x.kaynak === "not" || x.kaynak === "metin" ? "el" : "" }, x.metin || h("span", { class: "metinsiz" }, TUR_ADI[x.tur] || "Metinsiz iz")),
      x.not && x.kaynak !== "not" ? h("p", { class: "izlerim-satir__not" }, x.not) : null,
      h("p", { class: "izlerim-satir__meta" }, meta)),
    h("div", { class: "izlerim-satir__eylem" }, ekEylem || null, eylemler(x)));
  el.addEventListener("click", (e) => { if (!e.target.closest("button")) gitIz(x); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) gitIz(x); });
  if (x.metin) uzunBas(el, () => alintiKartiAc(x));
  return el;
}

function defterRafi() {
  const raf = h("div", { class: "defter-raf", role: "list", "aria-label": "Cep defterleri" });
  for (const { belge, izler } of E.veri) {
    const alinti = izler.filter(defterde).length;
    const secili = E.birlestir?.has(belge.id);
    const d = h("button", { class: "defter-raf__defter", type: "button", role: "listitem", style: `--c:${belge.kapak || "#24324F"}`,
      "aria-pressed": E.birlestir ? String(!!secili) : null, "aria-label": `${belge.ad} cep defteri, ${alinti} alıntı` },
      h("span", { class: "defter-raf__kapak" }, h("b", {}, belge.ad), h("small", {}, `${alinti} alıntı`), h("i", { class: "defter-raf__bant", "aria-hidden": "true" })),
      E.birlestir ? h("span", { class: "defter-raf__tik", "aria-hidden": "true" }, icon("tik", "i-16")) : null);
    d.addEventListener("click", () => {
      if (!E.birlestir) { defterAc(belge); return; }
      if (secili) E.birlestir.delete(belge.id); else E.birlestir.add(belge.id);
      ciz();
    });
    raf.append(d);
  }
  return h("section", { class: "izlerim-raf" }, h("h2", { class: "izlerim-bolum" }, "Cep defterleri", h("span", { class: "t-aside" }, E.birlestir ? "Birleştirmek için seç" : "Defteri açmak için dokun")), raf);
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
  const ad = h("input", { class: "izler-girdi", placeholder: "Derlemenin adı, ör. Sınav: Kardiyoloji", "aria-label": "Derlemenin adı", maxlength: "80", enterkeyhint: "done" });
  const sira = { deger: "kitap" };
  const siraSec = h("div", { class: "izler-parcali", role: "group", "aria-label": "Sıra" },
    ...[["kitap", "Kitap sırası"], ["tarih", "Tarih sırası"]].map(([v, a]) => {
      const d = h("button", { type: "button", "aria-pressed": String(sira.deger === v) }, a);
      d.addEventListener("click", () => { sira.deger = v; for (const b of d.parentElement.children) b.setAttribute("aria-pressed", String(b === d)); });
      return d;
    }));
  const olustur = h("button", { class: "birincil", type: "button", disabled: n < 1 || null }, "Derleme oluştur");
  const vazgec = h("button", { class: "hayalet", type: "button" }, "Vazgeç");
  vazgec.addEventListener("click", () => { E.birlestir = null; ciz(); });
  olustur.addEventListener("click", () => {
    const secilen = E.veri.filter((k) => E.birlestir.has(k.belge.id));
    let girdiler = secilen.flatMap((k) => k.izler.filter(defterde).map((x) => ({ x, belgeId: k.belge.id })));
    if (sira.deger === "tarih") girdiler.sort((a, b) => (a.x.zaman || 0) - (b.x.zaman || 0));
    const d = derlemeOlustur(ad.value.trim() || secilen.map((k) => k.belge.ad).slice(0, 2).join(" + ") || "Derleme", girdiler.map(({ x, belgeId }) => ({ belgeId, izId: x.id })));
    E.birlestir = null;
    E.secim = "derleme:" + d.id;
    toast(`“${d.ad}” derlemesi oluştu: ${d.girdiler.length} alıntı. Asıl defterler yerinde.`);
    ciz();
  });
  return h("div", { class: "birlestir-cubugu cam-yuzey", role: "group", "aria-label": "Defterleri birleştir" },
    h("span", { class: "birlestir-cubugu__sayi" }, n ? `${n} defter seçili` : "Defter seç"), ad, siraSec, vazgec, olustur);
}

function derlemeCiz(id) {
  const d = store.derlemeler.find((x) => x.id === id);
  if (!d) { E.secim = "hepsi"; govdeCiz(); return; }
  // Kitaptan silinen iz derlemeden de düşer (belge verisi yüklüyse; yüklenmemiş kitabın girdisi bekler)
  const once = d.girdiler.length;
  d.girdiler = d.girdiler.filter((g) => { const b = belgeBul(g.belgeId); return b && (!b.veri || izBul(g.belgeId, g.izId)); });
  if (d.girdiler.length !== once) { E.sessiz = true; try { bus.emit("derlemeler", { tur: "guncelle", id: d.id }); } finally { E.sessiz = false; } }
  const ogeler = d.girdiler.map((g, gi) => ({ g, gi, x: izBul(g.belgeId, g.izId), b: belgeBul(g.belgeId) })).filter((o) => o.x);

  const adlandir = h("button", { class: "hayalet", type: "button" }, "Yeniden adlandır");
  adlandir.addEventListener("click", () => {
    const girdi = h("input", { class: "izler-girdi izlerim-ad-girdi", value: d.ad, "aria-label": "Derlemenin adı", maxlength: "80", enterkeyhint: "done" });
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
  pdf.addEventListener("click", () => pdfPaylas({ ad: d.ad }, ogeler.map((o) => o.x), { kaynakAdi }).catch(() => toast("Derleme PDF olarak hazırlanamadı.")));
  // Silme anında yapılır ve geri alınabilir: iki dokunuşla onay gerekmez (TASARIM-4 3.6)
  const sil = h("button", { class: "hayalet tehlike", type: "button" }, "Derlemeyi sil");
  sil.addEventListener("click", () => {
    const i = store.derlemeler.indexOf(d);
    if (i >= 0) store.derlemeler.splice(i, 1);
    E.secim = "hepsi";
    bus.emit("derlemeler", { tur: "sil", id: d.id });
    toast(`“${d.ad}” silindi; asıl defterler yerinde`, { etiket: "Geri al", calistir: () => { store.derlemeler.splice(Math.max(0, i), 0, d); bus.emit("derlemeler", { tur: "ekle", id: d.id }); } });
  });
  const siraDugme = (ad, fn) => { const b = h("button", { class: "cip", type: "button" }, ad); b.addEventListener("click", () => { fn(); bus.emit("derlemeler", { tur: "guncelle", id: d.id }); }); return b; };
  const tarihSira = siraDugme("Tarihe göre", () => d.girdiler.sort((a, b) => (izBul(a.belgeId, a.izId)?.zaman || 0) - (izBul(b.belgeId, b.izId)?.zaman || 0)));
  const kitapSira = siraDugme("Kitaba göre", () => {
    const sira = new Map(E.veri.map((k, i) => [k.belge.id, i]));
    d.girdiler.sort((a, b) => (sira.get(a.belgeId) ?? 1e6) - (sira.get(b.belgeId) ?? 1e6) || (izBul(a.belgeId, a.izId)?.sira || 0) - (izBul(b.belgeId, b.izId)?.sira || 0));
  });

  const liste = h("div", { class: "derleme-liste", role: "list" });
  for (const { x, b, gi } of ogeler) {
    const cikar = h("button", { class: "simge-dugme", type: "button", "aria-label": "Derlemeden çıkar", title: "Derlemeden çıkar" }, icon("kapat", "i-20"));
    cikar.addEventListener("click", (e) => {
      e.stopPropagation();
      d.girdiler = d.girdiler.filter((g) => !(g.belgeId === x.belgeId && g.izId === x.id));
      bus.emit("derlemeler", { tur: "guncelle", id: d.id });
    });
    const tutamak = h("button", { class: "simge-dugme tutamak", type: "button", "aria-label": "Sürükleyerek sırala", title: "Sürükle" }, icon("tutamak", "i-20"));
    const satir = izlerimSatiri(x, { kaynakAdi: b?.ad, ekEylem: [tutamak, cikar] });
    satir.dataset.sira = String(gi);   // girdinin derlemedeki sırası (görünmeyen girdiler de sayılır)
    surukle(tutamak, satir, liste, d);
    liste.append(satir);
  }
  E.govde.replaceChildren(
    ustCiz(d.ad, `${ogeler.length} alıntı · ${new Set(ogeler.map((o) => o.x.belgeId)).size} kitap`, adlandir, md, pdf),
    h("div", { class: "derleme-arac" }, h("span", { class: "t-aside" }, "Sırala"), tarihSira, kitapSira, h("span", { class: "izlerim-ust__bosluk" }), sil),
    ogeler.length ? liste : bosDurum("Derleme boş.", "Bir alıntının yanındaki artıya dokun ve Deftere ekle’den bu derlemeyi seç."));
}

// Sürükleyerek sıralama: tutamaktan tutulan satır parmağı izler, bırakılınca yeni sırasına oturur
function surukle(tutamak, satir, liste, d) {
  let bas = 0, satirlar = [], hedef = -1;
  tutamak.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tutamak.setPointerCapture(e.pointerId);
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
    if (e.pointerType === "mouse" || e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY;
    clearTimeout(zaman);
    zaman = setTimeout(() => { tetik = true; ac(); }, 500);
  });
  el.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) clearTimeout(zaman); });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, () => clearTimeout(zaman));
  el.addEventListener("click", (e) => { if (tetik) { tetik = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  el.addEventListener("contextmenu", (e) => { if (tetik) e.preventDefault(); });
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
  const onizleme = h("div", { class: "alinti-onizleme yer-tutucu", role: "img", "aria-label": "Alıntı kartı önizlemesi" });
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
    h("span", {}, "Mürekkep izimi göster", h("small", {}, "Alt çizgi, daire ya da vurgu kartta da görünür")), h("span", { class: "anahtar", "aria-hidden": "true" }));
  izAnahtar.addEventListener("click", () => { secim.iz = !secim.iz; izAnahtar.setAttribute("aria-checked", String(secim.iz)); ciz(); });
  const paylasD = h("button", { class: "birincil", type: "button", hidden: true }, icon("paylas", "i-20"), "Paylaş");
  const indirD = h("button", { class: "ikincil", type: "button" }, icon("indir", "i-20"), "İndir");
  const dlg = h("dialog", { class: "pencere alinti-pencere", "aria-labelledby": "alintiBaslik" },
    h("header", { class: "alinti-pencere__ust" }, h("h2", { id: "alintiBaslik", tabindex: "-1" }, "Alıntı kartı"),
      h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => dlg.close() }, icon("kapat"))),
    h("div", { class: "alinti-pencere__govde" }, onizleme,
      h("div", { class: "alinti-pencere__secenek" },
        h("span", { class: "t-etiket" }, "Biçim"), parcaliKur("Biçim", [["kare", "Kare"], ["hikaye", "Hikâye"]], "bicim"),
        h("span", { class: "t-etiket" }, "Kâğıt"), parcaliKur("Kâğıt", [["acik", "Açık"], ["koyu", "Koyu"]], "kagit"),
        x.onizleme || x.tur === "vurgu" ? izAnahtar : null,
        h("div", { class: "pencere-alt" }, indirD, paylasD))));
  let blob = null, sira = 0;
  const dosyaAdi = () => {
    const b = belgeBul(x.belgeId), t = new Date();
    const ad = String(b?.ad || "Kenar Notu").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "-").slice(0, 40);
    return `Alinti-${ad}-${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}.png`;
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
    try { await navigator.share({ files: [new File([blob], dosyaAdi(), { type: "image/png" })], title: belgeBul(x.belgeId)?.ad || "Alıntı" }); }
    catch (hata) { if (hata?.name !== "AbortError") toast("Paylaşılamadı; İndir ile kaydedebilirsin."); }
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
