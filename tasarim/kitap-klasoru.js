// Kitap klasörü (13. tur): bilgisayardaki kitapları tanıyan içe aktarma.
// Kullanıcı bir klasör seçer (showDirectoryPicker, yalnız okunur); alt klasörlerle birlikte PDF, EPUB ve CBZ bulunur,
// listede seçilenler kayit.js'in içe aktarma yolundan (belgeIceAktar, app.js sarar) kopyalanarak alınır.
// Kaynak klasöre hiçbir zaman yazılmaz: izin yalnız "read" istenir.
// Klasör tutamacı kayit.js "kitapKlasoru" kaydında kalır. Sonraki açılışlarda izin varsa boşta taranır, yeni kitap varsa
// kitaplıkta kapatılabilir fiş çıkar. İzin yoksa açılışta istenmez (tarayıcı dokunuş ister): fişe ya da düğmeye dokununca.
// Kitaplığa bırakılan klasör de (getAsFileSystemHandle, yoksa webkitGetAsEntry) aynı listeyle sunulur.
// app.js bu modülü ilk gerektiğinde yükler ve baglan() ile kendi parçalarını verir.

import { h, icon, toast, bus, hareketAz } from "./ortak.js";
import * as kayit from "./kayit.js";

const KITAP_ADI = /\.(pdf|epub|cbz)$/i;
// Gizli ve sistem klasörleri taranmaz; çok derin ya da çok kalabalık klasörde tarama sınırda durur
const ATLA = /^(\.|\$|__MACOSX$|node_modules$|System Volume Information$)/i;
const EN_DERIN = 12, EN_COK = 5000;
const TUR_ADI = { pdf: "PDF", epub: "EPUB", cbz: "CBZ" };
const BILINEN_EN_COK = 20000;

// app.js'ten: { pencereKur, boyutMetni, neZaman, iceAktar(file) -> { b, vardi }, belgeAc(b), bitince(eklenen), fisKabi() }
let B = null;
export function baglan(b) { B = b; }

export const destek = () => kayit.klasorDestegi();

/* ---------- tarama ---------- */
// Her girdi: { file, ad, yol (seçilen klasöre göre alt klasör yolu), boyut, tur, anahtar, durum: "yeni" | "var" | "kopya" }
const nefes = () => new Promise((r) => setTimeout(r, 0));
function oge(file, yol) {
  const ad = file.name;
  return { file, ad, yol, boyut: file.size, tur: (KITAP_ADI.exec(ad)?.[1] || "pdf").toLowerCase(), anahtar: `${yol}/${ad}|${file.size}`, durum: "yeni" };
}
const kitapMi = (ad) => KITAP_ADI.test(ad) && !ad.startsWith(".");
const altYol = (yol, ad) => (yol ? `${yol}/${ad}` : ad);
// Ara sıra olay döngüsüne dönülür: yüzlerce dosyada ekran donmaz, ilerleme yazılır
async function say(durum, sonuc) {
  if (++durum.sayi % 48) return;
  durum.ilerleme?.(durum.sayi, sonuc.length);
  await nefes();
}

// File System Access tutamacı (seçici ya da Chromium'da bırakılan klasör)
async function tutamacTara(dizin, yol, derinlik, sonuc, durum) {
  try {
    for await (const t of dizin.values()) {
      if (durum.iptal || sonuc.length >= EN_COK) { durum.sinir ||= sonuc.length >= EN_COK; return; }
      await say(durum, sonuc);
      if (t.kind === "directory") {
        if (derinlik < EN_DERIN && !ATLA.test(t.name)) await tutamacTara(t, altYol(yol, t.name), derinlik + 1, sonuc, durum);
      } else if (kitapMi(t.name)) {
        try { sonuc.push(oge(await t.getFile(), yol)); } catch { /* okunamayan dosya atlanır */ }
      }
    }
  } catch (hata) { console.warn("[kenar-notu] Klasör okunamadı:", yol || dizin.name, hata); }
}

// Eski girdi API'si (webkitGetAsEntry): Safari ve Firefox'ta bırakılan klasör
const girdiDosyasi = (g) => new Promise((t, r) => g.file(t, r));
const girdileriOku = (o) => new Promise((t, r) => o.readEntries(t, r));
async function girdiTara(g, yol, derinlik, sonuc, durum) {
  if (durum.iptal || sonuc.length >= EN_COK) { durum.sinir ||= sonuc.length >= EN_COK; return; }
  await say(durum, sonuc);
  if (g.isFile) {
    if (kitapMi(g.name)) { try { sonuc.push(oge(await girdiDosyasi(g), yol)); } catch { /* okunamadı */ } }
    return;
  }
  if (!g.isDirectory || derinlik > EN_DERIN) return;
  const okuyucu = g.createReader();
  const alt = derinlik === 0 ? yol : altYol(yol, g.name);
  try {
    // readEntries bir seferde en çok 100 girdi verir: boş dönene kadar
    for (let parca = await girdileriOku(okuyucu); parca.length; parca = await girdileriOku(okuyucu)) {
      for (const c of parca) {
        if (c.isDirectory && ATLA.test(c.name)) continue;
        await girdiTara(c, alt, derinlik + 1, sonuc, durum);
      }
    }
  } catch (hata) { console.warn("[kenar-notu] Klasör okunamadı:", g.fullPath, hata); }
}

// Kitaplıkta olan ("var") ve listede ikinci kez geçen ("kopya") dosyalar işaretlenir. Ad ve boyut kitaplıktakiyle
// aynıysa okunmaz; boyutu kitaplıkta ya da listede başka bir dosyayla aynı olanın ilk 64 KB'ı okunur (içe aktarmanın imzası).
async function siniflandir(liste) {
  const { imza, adBoyut, boyutlar } = kayit.kitaplikImzalari();
  const boyutSay = new Map();
  for (const o of liste) boyutSay.set(o.boyut, (boyutSay.get(o.boyut) || 0) + 1);
  const ilk = new Map();
  let okunan = 0;
  for (const o of liste) {
    o.durum = "yeni";
    if (adBoyut.has(`${o.ad}|${o.boyut}`)) { o.durum = "var"; continue; }
    if (!boyutlar.has(o.boyut) && boyutSay.get(o.boyut) < 2) continue;
    try { o.imza = await kayit.dosyaImzasi(o.file); } catch { continue; }
    if (++okunan % 16 === 0) await nefes();
    if (imza.has(o.imza)) { o.durum = "var"; continue; }
    const once = ilk.get(o.imza);
    if (once) { o.durum = "kopya"; o.kopyasi = once; } else ilk.set(o.imza, o);
  }
  return liste;
}
const sirala = (liste) => liste.sort((a, b) => a.yol.localeCompare(b.yol, "tr") || a.ad.localeCompare(b.ad, "tr", { numeric: true }));

/* ---------- kayıt ve izin ---------- */
async function izinDurumu(t) {
  try { return await t.queryPermission({ mode: "read" }); } catch { return "prompt"; }
}
// Dokunuşla çağrılmalı (tarayıcı izni yalnız kullanıcı jestiyle sorar)
async function izinIste(t) {
  if ((await izinDurumu(t)) === "granted") return true;
  try { return (await t.requestPermission({ mode: "read" })) === "granted"; } catch { return false; }
}
async function bilinenEkle(liste) {
  const k = await kayit.kitapKlasoruOku();
  if (!k?.tutamac) return;
  const bilinen = new Set(k.bilinen || []);
  for (const o of liste) bilinen.add(o.anahtar);
  const dizi = [...bilinen];
  await kayit.kitapKlasoruYaz({ ...k, bilinen: dizi.slice(-BILINEN_EN_COK), son: Date.now() }).catch(() => {});
  bus.emit("kitap-klasoru", { tur: "bakildi", ad: k.tutamac.name });
}

// Seçiciyle yeni klasör (Yeni menüsü, Ayarlar > Değiştir, boş başlangıç ipucu). Vazgeçilirse sessiz.
export async function sec() {
  if (!destek()) return;
  const eski = await kayit.kitapKlasoruOku();
  let tutamac;
  try {
    tutamac = await globalThis.showDirectoryPicker({ id: "kenar-notu-kitaplar", mode: "read", startIn: eski?.tutamac || "documents" });
  } catch (hata) {
    if (hata?.name !== "AbortError") { console.warn("[kenar-notu] Kitap klasörü seçilemedi:", hata); toast("Klasör açılamadı."); }
    return;
  }
  // Aynı klasör yeniden seçildiyse daha önce gösterilenler bilinir kalır
  const ayni = eski?.tutamac && (await eski.tutamac.isSameEntry?.(tutamac).catch(() => false));
  await kayit.kitapKlasoruYaz({ tutamac, bilinen: ayni ? eski.bilinen || [] : [], son: 0 });
  bus.emit("kitap-klasoru", { tur: "secildi", ad: tutamac.name });
  fisKapat();
  return goster({ tutamac, bilinen: ayni ? new Set(eski.bilinen || []) : null, ilk: !ayni });
}

// Kayıtlı klasör varsa ona bakılır (izin gerekiyorsa şimdi istenir), yoksa seçici açılır
export async function ac() {
  const k = await kayit.kitapKlasoruOku();
  if (!k?.tutamac) return sec();
  if (!(await izinIste(k.tutamac))) { toast(`“${k.tutamac.name}” klasörüne izin verilmedi.`); return; }
  fisKapat();
  if (k.izinFisiKapali) await kayit.kitapKlasoruYaz({ ...k, izinFisiKapali: false }).catch(() => {});
  return goster({ tutamac: k.tutamac, bilinen: new Set(k.bilinen || []) });
}

export async function unut() {
  await kayit.kitapKlasoruSil().catch(() => {});
  fisKapat();
  bus.emit("kitap-klasoru", { tur: "birakildi" });
}

/* ---------- açılışta sessiz bakış ---------- */
// İzin varsa taranır; yeni kitap varsa fiş. İzin "prompt" ise oturumda bir kez dokunuşla izin isteyen fiş
// (kapatma düğmesiyle kapatılırsa bir daha çıkmaz, kullanıcı klasöre kendi bakınca yeniden açılır).
const IZIN_FISI = "kn-tasarim:kitap-klasoru-izin";
export async function acilisTaramasi() {
  const k = await kayit.kitapKlasoruOku();
  if (!k?.tutamac || !destek()) return { durum: "yok" };
  const izin = await izinDurumu(k.tutamac);
  const ad = k.tutamac.name;
  if (izin === "granted") {
    const t0 = performance.now();
    const durum = { sayi: 0 };
    const liste = [];
    await tutamacTara(k.tutamac, "", 0, liste, durum);
    await siniflandir(sirala(liste));
    const bilinen = new Set(k.bilinen || []);
    const yeni = liste.filter((o) => o.durum === "yeni" && !bilinen.has(o.anahtar));
    const sure = Math.round(performance.now() - t0);
    if (yeni.length) {
      fisGoster(`${ad} klasöründe ${yeni.length} yeni kitap var.`, "Göster",
        () => goster({ tutamac: k.tutamac, liste, bilinen, sinir: durum.sinir }),
        () => bilinenEkle(yeni));
    }
    return { durum: "tarandi", sayi: liste.length, yeni: yeni.length, sure };
  }
  if (izin !== "prompt" || k.izinFisiKapali) return { durum: "izin-yok" };
  try { if (sessionStorage.getItem(IZIN_FISI)) return { durum: "izin-yok" }; sessionStorage.setItem(IZIN_FISI, "1"); } catch { /* gizli pencere */ }
  fisGoster(`${ad} klasöründe yeni kitap var mı, bakalım mı?`, "Bak", () => ac(),
    () => kayit.kitapKlasoruOku().then((x) => x?.tutamac && kayit.kitapKlasoruYaz({ ...x, izinFisiKapali: true })).catch(() => {}));
  return { durum: "izin-fisi" };
}

// Kitaplığın başındaki küçük fiş (app.js'in verdiği yerde). kapaninca yalnız kapatma düğmesiyle çağrılır.
function fisGoster(metin, etiket, calistir, kapaninca) {
  const kab = B?.fisKabi?.();
  if (!kab) return;
  const el = h("div", { class: "klasor-fisi", role: "status" },
    icon("klasor", "i-20"),
    h("span", {}, metin),
    h("button", { class: "metin-dugme vurgulu", type: "button", onclick: () => { fisKapat(); calistir(); } }, etiket),
    h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kapat", onclick: () => { fisKapat(); kapaninca?.(); } }, icon("kapat", "i-20")));
  kab.replaceChildren(el);
  kab.hidden = false;
}
function fisKapat() {
  const kab = B?.fisKabi?.();
  if (!kab) return;
  kab.replaceChildren();
  kab.hidden = true;
}

/* ---------- bırakılan klasör ---------- */
// app.js drop olayında her öğe için webkitGetAsEntry() ve getAsFileSystemHandle() sözünü alır (olaydan sonra geçersizleşir)
export async function birakilanlar({ girdiler = [], tutamaclar = [] } = {}) {
  const t = await Promise.all(tutamaclar.map((p) => Promise.resolve(p).catch(() => null)));
  const tutamacla = t.length && t.every(Boolean);
  const klasorler = tutamacla ? t.filter((x) => x.kind === "directory") : girdiler.filter((g) => g?.isDirectory);
  const tekKlasor = klasorler.length === 1 && (tutamacla ? t : girdiler.filter(Boolean)).length === 1;
  const baslik = tekKlasor ? klasorler[0].name : "Bırakılan klasörler";
  return goster({
    baslik,
    tara: async (durum, liste) => {
      if (tutamacla) {
        for (const x of t) {
          if (x.kind === "directory") await tutamacTara(x, tekKlasor ? "" : x.name, 0, liste, durum);
          else if (kitapMi(x.name)) { try { liste.push(oge(await x.getFile(), "")); } catch { /* okunamadı */ } }
        }
      } else {
        for (const g of girdiler) if (g) await girdiTara(g, tekKlasor ? "" : (g.isDirectory ? g.name : ""), 0, liste, durum);
      }
    },
  });
}

/* ---------- liste penceresi ---------- */
// tutamac: kayıtlı ya da yeni seçilen kitap klasörü (bilinen kümesi oradan); liste verilirse yeniden taranmaz.
// Seçili gelenler: kitaplıkta olmayan ve daha önce gösterilmemiş dosyalar (ilk seçimde hepsi).
async function goster({ tutamac = null, baslik = tutamac?.name || "Klasör", liste = null, bilinen = null, tara = null, sinir = false, ilk = false }) {
  const durum = { sayi: 0, iptal: false, sinir };
  const p = pencere(baslik, { klasor: !!tutamac, durum });
  if (!liste) {
    liste = [];
    durum.ilerleme = (n, k) => p.tarama(n, k);
    if (tutamac) await tutamacTara(tutamac, "", 0, liste, durum);
    else await tara(durum, liste);
    if (durum.iptal) return;
    p.tarama(durum.sayi, liste.length);
    await siniflandir(sirala(liste));
  }
  if (!p.acik()) return;
  p.doldur(liste, { bilinen: ilk ? null : bilinen, sinir: durum.sinir });
  if (tutamac) bilinenEkle(liste);
}

function pencere(baslik, { klasor, durum }) {
  const dlg = h("dialog", { class: "pencere kitap-klasoru", "aria-labelledby": "kkBaslik" });
  const alt = h("p", { class: "kk-ozet", role: "status" }, "Klasör taranıyor…");
  const govde = h("div", { class: "kk-govde" }, h("div", { class: "kk-bekle" }, h("span", { class: "cv-ilerleme kk-cizgi", "aria-hidden": "true" }, h("b"))));
  const kapat = h("button", { class: "metin-dugme", type: "button", onclick: () => dlg.close() }, "Kapat");
  const altSatir = h("div", { class: "pencere-alt" }, kapat);
  dlg.append(
    h("h2", { class: "t-b2", id: "kkBaslik" }, icon("klasor", "i-22"), h("span", {}, baslik)),
    h("p", { class: "kk-aciklama" }, "Alt klasörlerle birlikte PDF, EPUB ve CBZ. Seçtiklerin kitaplığa kopyalanır; klasördeki dosyalara dokunulmaz."),
    alt, govde, altSatir);
  let aktariliyor = null;
  dlg.addEventListener("close", () => { durum.iptal = true; });
  B.pencereKur(dlg);

  const tarama = (n, k) => { alt.textContent = `Klasör taranıyor… ${n} dosyaya bakıldı, ${k} kitap.`; };

  function doldur(liste, { bilinen, sinir }) {
    const sayac = { var: 0, kopya: 0, yeni: 0 };
    for (const o of liste) {
      if (o.durum !== "yeni") sayac[o.durum]++;
      else if (bilinen && !bilinen.has(o.anahtar)) sayac.yeni++;
    }
    const secilebilir = liste.filter((o) => o.durum === "yeni");
    // Yeniden bakışta yalnız yeniler seçili gelir; ilk bakışta kitaplıkta olmayan hepsi
    const secili = new Set(secilebilir.filter((o) => !bilinen || !bilinen.has(o.anahtar)));
    alt.textContent = !liste.length ? "Bu klasörde PDF, EPUB ya da CBZ bulunamadı."
      : [`${liste.length} kitap`, sayac.var ? `${sayac.var} tanesi kitaplıkta` : "", sayac.kopya ? `${sayac.kopya} kopya` : "",
        bilinen && sayac.yeni ? `${sayac.yeni} yeni` : ""].filter(Boolean).join(" · ") + (sinir ? `. İlk ${EN_COK} dosya listelendi.` : ".");
    if (!liste.length) {
      govde.replaceChildren();
      if (klasor) altSatir.prepend(h("button", { class: "ikincil", type: "button", onclick: () => { dlg.close(); sec(); } }, "Başka klasör seç"));
      return;
    }
    const listeEl = h("div", { class: "kk-liste", role: "list" });
    const satirlar = new Map();
    const aktar = h("button", { class: "birincil", type: "button" });
    const hepsi = h("button", { class: "metin-dugme", type: "button" }, "Hepsini seç");
    const hicbiri = h("button", { class: "metin-dugme", type: "button" }, "Hiçbiri");
    const ara = liste.length > 12 ? h("input", { class: "kk-ara", type: "search", placeholder: "Listede ara", "aria-label": "Listede ara", autocomplete: "off", spellcheck: "false" }) : null;
    const katla = (s) => s.toLocaleLowerCase("tr");
    let q = "";
    const gorunur = (o) => !q || katla(`${o.yol}/${o.ad}`).includes(q);
    const guncelle = () => {
      const toplam = [...secili].reduce((t, o) => t + o.boyut, 0);
      aktar.textContent = secili.size ? `${secili.size} kitabı içe aktar · ${B.boyutMetni(toplam)}` : "İçe aktar";
      aktar.disabled = !secili.size || !!aktariliyor;
    };
    const kutuYaz = (o) => { const s = satirlar.get(o); if (s) s.kutu.checked = secili.has(o); };

    const satirKur = (o) => {
      const secilemez = o.durum !== "yeni";
      const kutu = h("input", { type: "checkbox", class: "kk-kutu", disabled: secilemez });
      kutu.checked = secili.has(o);
      const etiket = o.durum === "var" ? "Kitaplıkta" : o.durum === "kopya" ? "Kopya" : bilinen && !bilinen.has(o.anahtar) ? "Yeni" : "";
      const durumEl = h("span", { class: "kk-durum" + (o.durum === "yeni" && etiket ? " yeni" : "") }, etiket);
      const meta = [B.boyutMetni(o.boyut), o.yol || null, o.durum === "kopya" ? `aynısı: ${altYol(o.kopyasi.yol, o.kopyasi.ad)}` : null].filter(Boolean).join(" · ");
      const el = h("label", { class: "kk-satir" + (secilemez ? " kk-pasif" : ""), role: "listitem", hidden: !gorunur(o) },
        kutu, h("span", { class: `kk-tur kk-${o.tur}` }, TUR_ADI[o.tur]),
        h("span", { class: "kk-ad" }, h("b", {}, o.ad), h("small", {}, meta)), durumEl);
      kutu.addEventListener("change", () => { if (kutu.checked) secili.add(o); else secili.delete(o); guncelle(); });
      satirlar.set(o, { el, kutu, durumEl });
      return el;
    };
    // Yüzlerce satır parça parça kurulur: pencere hemen açılır, ekran donmaz
    let i = 0;
    const parca = () => {
      if (!dlg.isConnected) return;
      const f = document.createDocumentFragment();
      for (const son = Math.min(liste.length, i + 120); i < son; i++) f.append(satirKur(liste[i]));
      listeEl.append(f);
      if (i < liste.length) requestAnimationFrame(parca);
    };
    parca();
    hepsi.addEventListener("click", () => { for (const o of secilebilir) if (gorunur(o) && !o.sonuc) secili.add(o); secilebilir.forEach(kutuYaz); guncelle(); });
    hicbiri.addEventListener("click", () => { for (const o of [...secili]) if (gorunur(o)) secili.delete(o); secilebilir.forEach(kutuYaz); guncelle(); });
    let araZaman = 0;
    ara?.addEventListener("input", () => {
      clearTimeout(araZaman);
      araZaman = setTimeout(() => { q = katla(ara.value.trim()); for (const [o, s] of satirlar) s.el.hidden = !gorunur(o); }, 120);
    });
    const araclar = h("div", { class: "kk-araclar" }, ara, h("div", { class: "kk-secim" }, hepsi, hicbiri));
    govde.replaceChildren(araclar, listeEl);
    aktar.addEventListener("click", () => iceAktar(liste.filter((o) => secili.has(o))));
    altSatir.replaceChildren(kapat, aktar);
    guncelle();

    // Sırayla alınır (bellek bir dosyayla sınırlı). Pencere kapansa da sürer, bitince bildirim söyler; Durdur sıradakini bırakır.
    async function iceAktar(secilenler) {
      if (aktariliyor || !secilenler.length) return;
      const cizgi = h("span", { class: "cv-ilerleme kk-cizgi", "aria-hidden": "true" }, h("b"));
      const yazi = h("span", { class: "kk-ilerleme__yazi" });
      const durdur = h("button", { class: "metin-dugme", type: "button" }, "Durdur");
      aktariliyor = { durdu: false };
      durdur.addEventListener("click", () => { aktariliyor.durdu = true; durdur.disabled = true; durdur.textContent = "Duruyor…"; });
      altSatir.replaceChildren(h("div", { class: "kk-ilerleme", role: "status" }, yazi, cizgi), durdur);
      for (const s of satirlar.values()) s.kutu.disabled = true;
      hepsi.disabled = hicbiri.disabled = true;
      const sonuc = { eklendi: [], vardi: 0, hata: 0 };
      for (const [n, o] of secilenler.entries()) {
        if (aktariliyor.durdu) break;
        yazi.textContent = `${n + 1} / ${secilenler.length} · ${o.ad}`;
        cizgi.firstChild.style.transform = `scaleX(${n / secilenler.length})`;
        const s = satirlar.get(o);
        if (s) { s.durumEl.className = "kk-durum suruyor"; s.durumEl.textContent = "Aktarılıyor"; if (dlg.open) s.el.scrollIntoView({ block: "nearest", behavior: hareketAz() ? "auto" : "smooth" }); }
        try {
          const { b, vardi } = await B.iceAktar(o.file);
          o.sonuc = vardi ? "vardi" : "eklendi";
          if (vardi) sonuc.vardi++; else sonuc.eklendi.push(b);
          if (s) { s.durumEl.className = "kk-durum tamam"; s.durumEl.textContent = vardi ? "Kitaplıkta" : "Eklendi"; s.el.classList.add("kk-pasif"); }
        } catch (hata) {
          o.sonuc = "hata";
          sonuc.hata++;
          console.warn("[kenar-notu] Klasörden içe aktarılamadı:", o.ad, hata);
          const m = hataMetni(hata);
          if (s) { s.durumEl.className = "kk-durum hata"; s.durumEl.textContent = "Açılamadı"; s.durumEl.title = m; s.el.querySelector(".kk-ad small").textContent = m; }
        }
        secili.delete(o);
      }
      cizgi.firstChild.style.transform = "scaleX(1)";
      const n = sonuc.eklendi.length;
      const ozet = [n ? `${n} kitap eklendi` : "Yeni kitap eklenmedi", sonuc.vardi ? `${sonuc.vardi} zaten vardı` : "", sonuc.hata ? `${sonuc.hata} açılamadı` : "",
        aktariliyor.durdu ? "durduruldu" : ""].filter(Boolean).join(", ") + ".";
      aktariliyor = null;
      B.bitince?.(n);
      for (const [o, s] of satirlar) s.kutu.disabled = o.durum !== "yeni" || !!o.sonuc;
      hepsi.disabled = hicbiri.disabled = false;
      if (dlg.open) {
        alt.textContent = ozet;
        const ac = n === 1 ? h("button", { class: "ikincil", type: "button", onclick: () => { dlg.close(); B.belgeAc(sonuc.eklendi[0]); } }, "Aç") : null;
        // replaceChildren null'u "null" yazısına çevirir: olmayan düğme eklenmez
        altSatir.replaceChildren(...[kapat, ac, aktar].filter(Boolean));
        guncelle();
        (ac || kapat).focus({ preventScroll: true });
      } else if (n === 1) toast(`“${sonuc.eklendi[0].ad}” kitaplığa eklendi`, { etiket: "Aç", calistir: () => B.belgeAc(sonuc.eklendi[0]) });
      else toast(ozet);
    }
  }
  return { tarama, doldur, acik: () => dlg.open, dlg };
}

const hataMetni = (hata) => (hata?.kod === "bozuk" || hata?.kod === "cbr" ? hata.message
  : hata?.kod === "yedek" ? "Bu bir Kenar Notu yedeği; Yedekten yükle ile aç."
    : hata?.kod === "tur" ? "Yalnız PDF, EPUB ve CBZ açılır."
      : hata?.name === "NotReadableError" || hata?.name === "NotFoundError" ? "Dosya değişmiş ya da taşınmış; klasöre yeniden bak."
        : "İçe aktarılamadı.");

/* ---------- Ayarlar ---------- */
// Ayarlar'da klasörün durumu: seçili klasör adı, son bakış, Şimdi bak, Değiştir, Unut
export function ayarDenetimi(el) {
  const ciz = async () => {
    const k = await kayit.kitapKlasoruOku();
    if (!el.isConnected && el.dataset.cizildi) { coz(); return; }
    el.dataset.cizildi = "1";
    const secD = h("button", { class: "ikincil", type: "button", onclick: () => sec() }, icon("klasor", "i-20"), k?.tutamac ? "Değiştir" : "Kitap klasörü seç");
    if (!k?.tutamac) {
      el.replaceChildren(h("p", { class: "ayar-not" }, "Bir klasör seç: içindeki PDF, EPUB ve CBZ dosyaları alt klasörlerle birlikte listelenir, seçtiklerin kitaplığa kopyalanır. Klasöre hiç yazılmaz."),
        h("div", { class: "ayar-yedek__dugmeler" }, secD));
      return;
    }
    const izin = await izinDurumu(k.tutamac);
    const alt = izin !== "granted" ? "Bakmak için izin gerekir" : k.son ? `Son bakış: ${B.neZaman(k.son)}` : "Henüz bakılmadı";
    el.replaceChildren(
      h("p", { class: "oto-yedek__klasor" }, icon("klasor", "i-20"), h("span", {}, k.tutamac.name, h("small", {}, alt))),
      h("div", { class: "ayar-yedek__dugmeler" },
        h("button", { class: "ikincil", type: "button", onclick: () => ac() }, icon("yeniden", "i-20"), "Şimdi bak"), secD,
        h("button", { class: "metin-dugme", type: "button", onclick: () => unut().then(() => toast("Kitap klasörü unutuldu; klasördeki dosyalar ve kitaplık yerinde.")) }, "Unut")));
  };
  const coz = bus.on("kitap-klasoru", () => ciz());
  ciz();
  return el;
}
