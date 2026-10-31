// Tekrar ekranı: günlük deste, kutu göstergesi, sınav ve kart listesi (Anki ve takvim aktarımı anki.js).
// İş tanımı OZELLIKLER-2 §4, görünüm TASARIM-2 §6. Sözleşme: ac(kap), kapat().
import {
  h, icon, bus, store, belgeBul, hareketAz, toast, KLASORLER, BANTLAR,
  kutuAralikMetni, fsrsHesapla, kartEkle, kartSil, kartCevapla, bugunTekrar, gunBasi, gunFarki,
} from "./ortak.js";
import { PW, PH, PDF_PAGES } from "./sayfalar.js";
import { matematikVarMi, matematikCiz } from "./matematik.js";

const ROMA = ["", "I", "II", "III", "IV", "V"];
const GUN = 24 * 3600e3;
const KART_SN = 30;                       // tahmini süre: kart başına 30 sn
const ITME_ESIGI = 80;                    // kalemle itme eşiği (px)
const TURLER = [["tumu", "Tümü"], ["bant", "Bant"], ["kirpinti", "Kırpıntı"], ["kelime", "Kelime"], ["soru", "Soru"]];
const TUR_AD = Object.fromEntries(TURLER);
const SURELER = [[0, "Yok"], [10, "10 dk"], [20, "20 dk"], [30, "30 dk"]];
const BANT_IDLER = new Set(BANTLAR.map(([, id]) => id));

const ust = (s) => String(s).toLocaleUpperCase("tr");
const kartBul = (id) => store.kartlar.find((k) => k.id === id);
const sureMetni = (ms) => { const s = Math.round(ms / 1000), d = Math.floor(s / 60); return d ? `${d} dk ${s % 60} sn` : `${s} sn`; };
const saatMetni = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const karistir = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Kartın dersi: belgesinin klasörü. Klasörsüz kartlar "Okuma rafı"nda toplanır.
const kartKlasoru = (k) => belgeBul(k.belgeId)?.klasor || null;
function kaynakAd(k) {
  const b = belgeBul(k.belgeId), kl = b?.klasor && KLASORLER.find((x) => x.id === b.klasor);
  return kl?.ad || b?.ad || k.belgeAd || "";
}
function kaynakSatiri(k, { tur = true } = {}) {
  const parca = [];
  if (tur) parca.push(TUR_AD[k.tur] || "Kart");
  const ad = kaynakAd(k);
  if (ad) parca.push(ad);
  if (k.sayfa) parca.push(`S. ${k.sayfa}`);
  return ust(parca.join(" · "));
}

// TASARIM-2 §6.1: açıkta kareli, koyuda tahta
const koyuMu = () => {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
};

let D = null;   // açık ekranın durumu

// ======================================================================
// Açma ve kapatma
// secenek (isteğe bağlı): { sinav: klasörId | true } sınav fişini açar; { kartId } o kartı destenin başına alır.
// ======================================================================
export function ac(kap, secenek = {}) {
  if (D) kapat();
  // Örnek kartları yalnız app.js kurar (kayıtta kart alanı yoksa); burada kurmak "Boş başla"yı ve silinen kartları geri getirirdi

  const kok = h("div", { class: "tekrar", lang: "tr", dataset: { gorunum: "deste" } });
  D = {
    kap, kok, gorunum: "deste", temizle: [], zamanlayicilar: new Set(),
    deste: null, sinav: null, sonuc: null, liste: { tur: "tumu", kutu: null }, fis: null,
  };

  // Üst şerit
  const geri = h("button", { class: "ikon-dugme tekrar-geri", type: "button", onclick: geriBas }, icon("geri"));
  const baslik = h("h1", {}, "Bugünün destesi");
  const alt = h("span", { class: "olcum tekrar-alt" });
  const gostergeKap = h("div", { class: "leitner-kap" });
  const sinavDugme = h("button", { class: "metin-dugme tekrar-sinav", type: "button", onclick: sinavDugmesi },
    icon("kronometre", "i-20"), h("span", {}, "Sınav"));
  const listeDugme = h("button", { class: "ikon-dugme", type: "button", "aria-label": "Kart listesi", "aria-pressed": "false",
    onclick: () => (D.gorunum === "liste" ? desteyeDon() : listeyiAc()) }, icon("liste"));
  const bosluk = h("span", { class: "bosluk" });
  const ustSerit = h("header", { class: "tekrar-ust" },
    geri, h("div", { class: "tekrar-baslik" }, baslik, alt), bosluk, gostergeKap, sinavDugme, listeDugme);
  const govde = h("div", { class: "tekrar-govde" });
  kok.append(ustSerit, govde);
  Object.assign(D, { geri, baslik, alt, bosluk, gostergeKap, sinavDugme, listeDugme, govde });

  leitnerKur();
  zeminUygula();
  kap.append(kok);

  // Tema: data-theme değişimi, sistem teması ve ayarlar olayı
  const mo = new MutationObserver(zeminUygula);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", zeminUygula);
  D.temizle.push(() => mo.disconnect(), () => mq.removeEventListener("change", zeminUygula));
  D.temizle.push(bus.on("ayarlar", () => requestAnimationFrame(zeminUygula)));
  D.temizle.push(bus.on("kartlar", kartlarDegisti));
  document.addEventListener("keydown", tus);
  D.temizle.push(() => document.removeEventListener("keydown", tus));
  // Ekran açık kalırken gün dönerse ya da sekmeye dönülürse sayaçlar ve deste tazelenir
  document.addEventListener("visibilitychange", gunKontrol);
  D.temizle.push(() => document.removeEventListener("visibilitychange", gunKontrol));

  const ilk = secenek?.kartId && kartBul(secenek.kartId);
  D.ilkKart = ilk ? ilk.id : null;
  if (ilk) desteBaslat([ilk.id, ...bugunTekrar().sort(desteSirasi).map((k) => k.id).filter((id) => id !== ilk.id)]);
  else desteBaslat();
  geceYarisiKur();
  if (secenek?.sinav) requestAnimationFrame(() => D && sinavFisiAc(typeof secenek.sinav === "string" ? secenek.sinav : null));
}

export function kapat() {
  if (!D) return;
  fisKapat(true);
  for (const z of D.zamanlayicilar) { clearTimeout(z); clearInterval(z); }
  if (D.sinav?.saat) clearInterval(D.sinav.saat);
  D.kartGozlem?.disconnect();
  for (const fn of D.temizle) try { fn(); } catch {}
  D.kok.remove();
  D = null;
}

function sonra(fn, ms) {
  if (!D) return 0;   // kapat() sonrası biten animasyon zamanlayıcı kurmasın
  const z = setTimeout(() => { D?.zamanlayicilar.delete(z); fn(); }, ms);
  D.zamanlayicilar.add(z);
  return z;
}

// TASARIM-3 6.5: zemin her temada düz kâğıt; kareli kâğıt yalnız kartın içinde, tahta ve tebeşir kalktı
function zeminUygula() {
  if (!D) return;
  D.kok.classList.remove("tahta", "kareli");
  D.baslik.classList.remove("tebesir");
  for (const b of D.kok.querySelectorAll(".bitis")) b.classList.remove("tahta", "tahta--cerceve");
}

// ======================================================================
// Üst şerit
// ======================================================================
function ustGuncelle() {
  const { gorunum } = D;
  const sinavda = gorunum === "sinav";
  D.kok.dataset.gorunum = gorunum;
  D.listeDugme.setAttribute("aria-pressed", String(gorunum === "liste"));
  D.listeDugme.hidden = sinavda;
  D.sinavDugme.lastChild.textContent = sinavda ? "Bitir" : "Sınav";
  D.sinavDugme.setAttribute("aria-label", sinavda ? "Sınavı bitir" : "Sınav");
  D.geri.setAttribute("aria-label", gorunum === "deste" ? "Kitaplığa dön" : sinavda ? "Sınavı bırak" : "Desteye dön");

  if (gorunum === "liste") {
    D.baslik.textContent = "Kart listesi";
    const n = store.kartlar.length, b = bugunTekrar().length;
    olcumYaz(D.alt, `${n} kart · bugün ${b}`);
  } else if (sinavda || gorunum === "sonuc") {
    const s = sinavda ? D.sinav : D.sonuc;
    D.baslik.textContent = `${s.ad} · Sınav`;
    olcumYaz(D.alt, sinavda
      ? `${s.ids.length} kart · ${s.sinir ? `süre sınırı ${s.sinir / 60e3} dk` : "süre sınırı yok"}`
      : `${s.ids.length} kart · bitti`);
  } else {
    const d = D.deste;
    D.baslik.textContent = d?.ad || "Bugünün destesi";
    const kalan = d ? d.ids.length - d.sira : 0, bekleyen = bugunTekrar().length;
    // Kitaplıktaki sayaçla aynı dil: bekleyen varsa sayısı, yoksa "Bugünlük bitti"
    olcumYaz(D.alt, kalan > 0
      ? `${kalan} kart · yaklaşık ${Math.max(1, Math.round((kalan * KART_SN) / 60))} dk`
      : bekleyen ? `${bekleyen} kart bekliyor` : store.kartlar.length ? "Bugünlük bitti" : "Henüz kart yok");
  }
  D.gostergeKap.replaceChildren(sinavda ? D.sinav.cam : D.leitnerEl);
}

// Sayılar Plex, birimler Inter (TASARIM-2 §2.1 kural 3): "5 kart · yaklaşık 3 dk"
function olcumYaz(el, metin) {
  el.replaceChildren(...metin.split(/(\d+)/).map((p, i) => (i % 2 ? h("b", {}, p) : p)).filter((p) => p !== ""));
}

function geriBas() {
  if (D.gorunum === "deste") return bus.emit("git", { ekran: "kitaplik" });
  if (D.gorunum === "sinav") sinavDurdur();
  desteyeDon();
}

// ======================================================================
// Leitner göstergesi: beş kanallı cam (§6.2)
// ======================================================================
function leitnerKur() {
  const kanallar = [];
  const cam = h("div", { class: "leitner cam", role: "group", "aria-label": "Leitner kutuları" });
  for (let n = 1; n <= 5; n++) {
    const b = h("b", {}, "0");
    const k = h("button", { class: "kanal", type: "button", onclick: () => listeyiAc({ kutu: n }) }, h("i"), b);
    kanallar.push({ el: k, b });
    cam.append(k);
  }
  const olcek = h("div", { class: "leitner-olcek", "aria-hidden": "true" }, ...ROMA.slice(1).map((r) => h("span", {}, r)));
  D.kanallar = kanallar;
  D.leitnerEl = h("div", { class: "leitner-ic" }, cam, olcek);
  gostergeGuncelle();
}

function gostergeGuncelle() {
  if (!D) return;
  const say = [0, 0, 0, 0, 0, 0];
  for (const k of store.kartlar) say[Math.min(5, Math.max(1, k.kutu || 1))]++;
  const enCok = Math.max(1, ...say.slice(1));
  const simdi = D.gorunum === "deste" ? kartBul(D.deste?.ids[D.deste.sira])?.kutu : null;
  D.kanallar.forEach(({ el, b }, i) => {
    const n = i + 1, c = say[n];
    el.firstChild.style.setProperty("--dolu", c ? Math.ceil((c / enCok) * 6) / 6 : 0);
    el.firstChild.style.setProperty("--n", Math.min(7, c));   // kutudaki kart çizgileri: sayı kadar, en çok 7
    if (c > 7) el.dataset.cok = ""; else delete el.dataset.cok;
    b.textContent = c;
    el.setAttribute("aria-label", `${ROMA[n]}. kutu, ${c} kart, ${kutuAralikMetni(n)}`);
    if (n === simdi) el.dataset.simdi = ""; else delete el.dataset.simdi;
  });
}

// İmza anı 9.5: fosfor noktası eski kutudan yeni kutuya geçer, yeni kanal bir an parlar
function fosforKalicilik(eski, yeni, bildi) {
  if (hareketAz() || !D.kanallar[eski - 1]) return;
  const kaynak = D.kanallar[eski - 1].el, hedef = D.kanallar[yeni - 1].el;
  const isik = h("span", { class: "kanal-isik" + (bildi ? "" : " kehribar"), "aria-hidden": "true" });
  kaynak.append(isik);
  const dx = hedef.offsetLeft - kaynak.offsetLeft;
  const a = isik.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }],
    { duration: dx ? 240 : 120, easing: "cubic-bezier(.62, 0, .32, 1)", fill: "forwards" });
  a.onfinish = () => {
    isik.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = () => isik.remove();
    hedef.classList.remove("kalici");
    void hedef.offsetWidth;
    hedef.classList.add("kalici");
    sonra(() => hedef.classList.remove("kalici"), 440);
  };
}

// ======================================================================
// Günlük deste
// ======================================================================
const desteSirasi = (a, b) => (a.kutu - b.kutu) || (a.sonraki - b.sonraki);

function desteBaslat(ids = null, ad = null) {
  const kartlar = ids ? ids.map(kartBul).filter(Boolean) : bugunTekrar().sort(desteSirasi);
  D.deste = { ids: kartlar.map((k) => k.id), sira: 0, cevap: [], ad, ozel: !!ad, gun: gunBasi() };
  D.gorunum = "deste";
  sahneCiz();
}

function desteyeDon() {
  fisKapat(true);
  D.gorunum = "deste";
  // Deste bittiyse ya da hiç başlamadıysa bugünün destesini yeniden kur (yeni kart gelmiş olabilir)
  const d = D.deste;
  if (!d || (d.sira >= d.ids.length && !d.cevap.length)) return desteBaslat();
  sahneCiz();
}

function sahneCiz() {
  if (!D) return;
  D.kartGozlem?.disconnect();
  D.kart = null;
  if (D.gorunum === "liste" || D.gorunum === "sonuc") {
    D.bosluk.after(D.gostergeKap);
    ustGuncelle(); gostergeGuncelle();
    return D.gorunum === "liste" ? listeCiz() : sonucCiz();
  }

  // Cevaplanan kartla birlikte odak da gider: sahnedeyse yeni karta (ya da bitiş düğmesine) taşınır
  const odakTasi = D.odakTasi || D.govde.contains(document.activeElement);
  D.odakTasi = false;
  const akis = D.gorunum === "sinav" ? D.sinav : D.deste;
  // Silinmiş kartları atla
  while (akis.sira < akis.ids.length && !kartBul(akis.ids[akis.sira])) akis.ids.splice(akis.sira, 1);
  ustGuncelle();
  gostergeGuncelle();

  const sahne = h("div", { class: "tekrar-sahne" });
  // Gösterge kartla aynı sütunda, kartın üstünde (destede ve sınavda); liste ve sonuçta üst şeritte
  sahne.append(D.gostergeKap);
  if (akis.sira >= akis.ids.length) {
    if (D.gorunum === "sinav") return sinavBitir();
    sahne.append(...bitisOlustur());
  } else {
    const k = kartBul(akis.ids[akis.sira]);
    const kart = kartOlustur(k, { sinav: D.gorunum === "sinav" });
    const cevap = cevapDugmeleri(k);
    const ipucu = h("p", { class: "tekrar-ipucu", "aria-live": "polite" });
    sahne.append(kart.el, cevap.el, ipucu);
    D.kart = { ...kart, k, cevap, ipucu, acik: false, kilit: false };
    ipucuYaz();
  }
  D.govde.replaceChildren(sahne);
  zeminUygula();
  if (D.kart) {
    girisOynat(D.kart.el);
    // Kart boyu değişince (döndürme, pencere, sonradan çizilen formül) bant yeniden oturur; ilk bildirim de
    // yerleştirir. Bir sonraki karede: gözlemci içinde düzen değişirse WebKit "ResizeObserver loop" hatası verir
    D.kartGozlem = new ResizeObserver(() => requestAnimationFrame(bantYerlestir));
    D.kartGozlem.observe(D.kart.yuz);
  }
  if (odakTasi) (D.kart?.el || sahne.querySelector("button"))?.focus({ preventScroll: true });
}

function ipucuYaz() {
  const c = D.kart;
  if (!c) return;
  const klavye = matchMedia("(hover: hover)").matches;
  // Ön yüzde düğme ne yapılacağını zaten söyler; ipucu yalnız çevrilince itme yönünü anlatır
  c.ipucu.textContent = !c.acik ? ""
    : (klavye ? "Sola it ya da 1: Bilemedim · Sağa it ya da 2: Bildim" : "Sola it: Bilemedim · Sağa it: Bildim");
}

// ---------- kart ----------
function yuzIcerik(yuz, sinif) {
  const parca = [];
  if (yuz?.gorsel) parca.push(h("img", { class: "kart-gorsel", src: yuz.gorsel, alt: "", draggable: "false" }));
  if (yuz?.metin) {
    const m = h("div", { class: "kart-metin" + (yuz.metin.length > 140 ? " uzun" : "") }, yuz.metin);
    // $...$ formülleri MathML olur; Temml yalnız formül varsa yüklenir, hata olursa metin kalır
    if (matematikVarMi(yuz.metin)) matematikCiz(m).catch(() => {});
    parca.push(m);
  }
  return h("div", { class: sinif }, ...parca);
}

function kartOlustur(k, { sinav = false, kucuk = false } = {}) {
  const gorselli = !!k.on?.gorsel && !k.on?.metin;
  const el = h("div", {
    class: "tekrar-kart fis-kart nesne-acik" + (gorselli ? " gorselli" : " satirli"),
    tabindex: "0", role: "group", "aria-roledescription": "kart",
    "aria-label": `${TUR_AD[k.tur] || "Kart"} kartı, ${ROMA[k.kutu]}. kutu`,
  });
  // Kaynak satırı: düğme, belgeyi o sayfada açar. Sınavda yalnız tür yazar.
  const kaynak = sinav
    ? h("span", { class: "kart-kaynak etiket-sayfa" }, ust(TUR_AD[k.tur] || "Kart"))
    : h("button", { class: "kart-kaynak etiket-sayfa", type: "button", "aria-label": `Kaynağa git: ${kaynakSatiri(k, { tur: false })}`,
        onclick: (e) => { e.stopPropagation(); kaynagaGit(k); } }, kaynakSatiri(k));

  const desen = BANT_IDLER.has(k.bant) ? k.bant : "murekkep";
  const bantKap = h("div", { class: "kart-bant-kap", "aria-hidden": "true" },
    h("div", { class: "kart-bant", dataset: { bant: desen } }), h("div", { class: "kart-bant-uc" }));

  let yuz;
  if (gorselli) {
    // Görsel kart: ön ve arka aynı yerde üst üste, açılınca çapraz geçer
    const on = h("img", { class: "kart-on", src: k.on.gorsel, alt: "Ön yüz", draggable: "false" });
    const arka = k.arka?.gorsel && !k.arka?.metin
      ? h("img", { class: "kart-cevap", src: k.arka.gorsel, alt: "Arka yüz", draggable: "false" })
      : yuzIcerik(k.arka, "kart-cevap");
    yuz = h("div", { class: "kart-yuz gorsel" }, on, arka, bantKap);
    for (const img of yuz.querySelectorAll("img")) img.addEventListener("load", bantYerlestir);
  } else {
    // Metin kartı: üstte soru, altta bantla örtülü cevap
    const soru = yuzIcerik(k.on, "kart-soru");
    if (k.tur === "kelime") soru.querySelector(".kart-metin")?.classList.replace("kart-metin", "kart-kelime");
    const cevap = yuzIcerik(k.arka, "kart-cevap");
    yuz = h("div", { class: "kart-yuz metinli" }, soru, h("div", { class: "kart-cevap-alan" }, cevap, bantKap));
  }
  el.append(kaynak, yuz);
  if (!kucuk) kartEtkilesim(el);
  return { el, yuz, bantKap, gorselli };
}

// Görsel kartta bant, görüntünün içindeki örtülü şeride oturur (k.bantY, k.bantH: 0..1)
function bantYerlestir() {
  const c = D?.kart;
  if (!c) return;
  const kap = c.bantKap;
  if (c.gorselli) {
    const img = c.yuz.querySelector(".kart-on");
    if (!img.complete || !img.offsetWidth) return;
    const w = img.offsetWidth, hh = img.offsetHeight;
    const y = c.k.bantY ?? 0.5;
    const bh = c.k.bantH != null ? Math.max(32, c.k.bantH * hh + 14) : Math.min(hh, Math.max(36, Math.min(64, hh * 0.3)));
    Object.assign(kap.style, {
      left: `${img.offsetLeft - 8}px`, width: `${w + 16}px`, right: "auto",
      top: `${img.offsetTop + y * hh - bh / 2}px`, height: `${bh}px`,
    });
  }
  kap.style.setProperty("--bant-w", `${kap.offsetWidth}px`);
}

// Dokun: çevir. Kalemle (ya da parmakla) 80px'ten uzun yatay itme: cevap.
function kartEtkilesim(el) {
  let bas = null, surukle = false, sonSurukleme = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.target.closest(".kart-kaynak")) return;
    bas = { x: e.clientX, y: e.clientY, id: e.pointerId };
    surukle = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (!bas || e.pointerId !== bas.id) return;
    const dx = e.clientX - bas.x, dy = e.clientY - bas.y;
    if (!surukle) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      surukle = true;
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add("itiliyor");
    }
    const acik = D?.kart?.acik;
    el.style.transform = `translateX(${dx * (acik ? 0.7 : 0.25)}px) rotate(${dx * (acik ? 0.012 : 0.004)}deg)`;
    el.dataset.yon = acik && Math.abs(dx) > ITME_ESIGI ? (dx > 0 ? "bildim" : "bilemedim") : "";
  });
  const birak = (e) => {
    if (!bas || e.pointerId !== bas.id) return;
    const dx = e.clientX - bas.x;
    bas = null;
    el.classList.remove("itiliyor");
    delete el.dataset.yon;
    if (!surukle) return;
    sonSurukleme = Date.now();
    if (D?.kart?.acik && Math.abs(dx) > ITME_ESIGI && e.type === "pointerup") return cevapla(dx > 0, { itme: true });
    // Yerine dön
    const simdi = el.style.transform;
    el.style.transform = "";
    if (simdi && !hareketAz()) el.animate([{ transform: simdi }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.22, .8, .24, 1)" });
    if (!D?.kart?.acik && Math.abs(dx) > ITME_ESIGI) cevir();
  };
  el.addEventListener("pointerup", birak);
  el.addEventListener("pointercancel", birak);
  el.addEventListener("click", (e) => {
    if (Date.now() - sonSurukleme < 350 || e.target.closest(".kart-kaynak")) return;
    cevir();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target === el) { e.preventDefault(); cevir(); }
  });
}

// İmza anı 9.4: bant sağdan sola soyulur, cevap belirir
function cevir() {
  const c = D?.kart;
  if (!c || c.acik) return;
  c.acik = true;
  c.el.classList.add("acik");
  sonra(() => c.el.classList.add("bitti"), hareketAz() ? 120 : 360);
  const odakGosterde = document.activeElement === c.cevap.goster;
  c.cevap.el.classList.add("acik");
  c.cevap.goster.inert = true;
  for (const b of [c.cevap.bilemedim, c.cevap.bildim]) { b.inert = false; b.disabled = false; }
  if (odakGosterde) c.cevap.bildim.focus({ preventScroll: true });
  c.el.setAttribute("aria-label", c.el.getAttribute("aria-label") + ", açık");
  ipucuYaz();
}

// Ön yüzde tek düğme: Cevabı göster. Çevrilince yerine Bildim ve Bilemedim gelir (yalnız opaklık, 240ms).
function cevapDugmeleri(k) {
  const sinav = D.gorunum === "sinav";
  // FSRS: "Bildim"in gerçek aralığı (kart değişmeden hesaplanır)
  const g = fsrsHesapla(k, true).aralik;
  const klavye = matchMedia("(hover: hover)").matches;
  const goster = h("button", { class: "goster", type: "button", onclick: () => cevir() },
    h("span", {}, "Cevabı göster"), klavye ? h("small", {}, "Boşluk") : null);
  const bilemedim = h("button", { class: "bilemedim", type: "button", disabled: true, inert: true, onclick: () => cevapla(false) },
    h("span", {}, "Bilemedim"), h("small", {}, sinav ? "Kutu I'e döner" : "Bugün yeniden"));
  const bildim = h("button", { class: "bildim", type: "button", disabled: true, inert: true, onclick: () => cevapla(true) },
    h("span", {}, "Bildim"), h("small", {}, sinav ? "Takvim değişmez" : g === 1 ? "Yarın" : `${g} gün sonra`));
  return { el: h("div", { class: "tekrar-cevap" }, goster, bilemedim, bildim), goster, bilemedim, bildim };
}

// Deste: FSRS takvimini günceller. Sınav: yalnız bilinemeyen kart I. kutuya döner, bilinenin takvimi değişmez.
function cevapla(bildi, { itme = false } = {}) {
  const c = D?.kart;
  if (!c || !c.acik || c.kilit) return;
  c.kilit = true;
  const sinav = D.gorunum === "sinav";
  const akis = sinav ? D.sinav : D.deste;
  const eski = c.k.kutu || 1;
  if (!sinav || !bildi) kartCevapla(c.k.id, bildi);
  const yeni = c.k.kutu || 1;   // FSRS aralığından türeyen kutu
  akis.cevap.push({ id: c.k.id, bildi });
  akis.sira++;
  if (!sinav) fosforKalicilik(eski, yeni, bildi);
  D.odakTasi = D.govde.contains(document.activeElement);
  for (const b of c.cevap.el.querySelectorAll("button")) b.disabled = true;
  // TASARIM-3 nüans 10: düğmeyle "Bildim" denince kartın köşesine kurşun kalemle tik ve yeni kutu yazılır, kart 300ms sonra çekilir.
  // İtmede (parmak kartı sürüklerken) ve sade harekette beklenmez.
  const tik = bildi && !sinav && !itme && !hareketAz();
  if (tik) c.el.append(h("span", { class: "kart-tik", "aria-hidden": "true" },
    svgTik(), h("b", {}, "→ " + ROMA[yeni])));
  const cik = () => cikisOynat(c.el, bildi ? 1 : -1, itme).then(() => { if (D && D.kart === c) sahneCiz(); });
  if (tik) sonra(cik, 300); else cik();
}
function svgTik() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg"), yol = document.createElementNS(ns, "path");
  svg.setAttribute("viewBox", "0 0 14 14");
  yol.setAttribute("d", "M2 7.6 5.4 11 12 2.8");
  yol.setAttribute("pathLength", "1");
  svg.append(yol);
  return svg;
}

function girisOynat(el) {
  if (hareketAz()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  el.animate([{ opacity: 0, transform: "translateY(10px) scale(.985)" }, { opacity: 1, transform: "none" }],
    { duration: 240, easing: "cubic-bezier(.22, .8, .24, 1)" });
}
function cikisOynat(el, yon, itme) {
  const bas = el.style.transform || "none";
  const a = hareketAz()
    ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" })
    : el.animate([{ transform: bas, opacity: 1 },
        { transform: `translateX(${yon * (itme ? 220 : 56)}px) rotate(${yon * (itme ? 4 : 1.5)}deg)`, opacity: 0 }],
        { duration: itme ? 180 : 200, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
  // Sekme arka plandayken animasyon zamanı ilerlemez: süre dolunca yine de devam edilir
  return Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, 260))]);
}

// ---------- deste bitti (§6.6; TASARIM-3: tahta yerine sade kart) ----------

function yarinSayisi() {
  const sinir = gunBasi(Date.now(), 2);
  return store.kartlar.filter((k) => k.sonraki < sinir).length;
}

function kartSilGeriAlinir(k) {
  const i = store.kartlar.indexOf(k);
  if (i < 0) return;
  kartSil(k.id);
  toast("Kart silindi", { etiket: "Geri al", calistir: () => {
    store.kartlar.splice(Math.min(i, store.kartlar.length), 0, k);
    bus.emit("kartlar", { tur: "ekle", kart: k });
  } });
}

function bitisOlustur() {
  const d = D.deste, oturum = d.cevap.length > 0;
  const bildi = d.cevap.filter((x) => x.bildi).length;
  const yarin = yarinSayisi();
  // Bilinemeyenler bugün yeniden bekler: o zaman "bugünlük bu kadar" denmez
  const kalan = bugunTekrar().length;
  let baslik = kalan ? "Bu tur bitti." : "Bugünlük bu kadar.", satir;
  if (oturum) satir = `${d.cevap.length} kart · ${bildi} bildin · ${yarin ? `yarın ${yarin}` : "yarın boş"}`;
  else if (!store.kartlar.length) { baslik = "Henüz kart yok."; satir = "Masa’da bir cevabın üstüne bant koy ya da Koltuk’ta bir kelimeyi karta ekle."; }
  else {
    const en = Math.min(...store.kartlar.map((k) => k.sonraki));
    const g = Math.max(1, gunFarki(en));
    satir = yarin ? `Bugün kart yok · yarın ${yarin}` : `Sıradaki kart ${g} gün sonra`;
  }
  const tahta = h("div", { class: "bitis", role: "status" },
    h("h2", {}, baslik), h("p", {}, satir));
  // Yazılıyor duygusu: örtü sağa çekilir (yalnız oturum bitince)
  if (oturum && !hareketAz()) tahta.append(h("div", { class: "ortu", "aria-hidden": "true" }));
  // Boş durum tek düğme verir (TASARIM-4 3.5): kart yoksa "Nasıl yapılır", bugünlük bittiyse "Yine de çalış"
  const kartYok = !store.kartlar.length;
  const birincil = kartYok
    ? h("button", { class: "birincil", type: "button", onclick: () => import("./rehber.js").then((m) => m.rehberBaslat(0)) }, "Nasıl yapılır")
    : !oturum && !kalan ? h("button", { class: "birincil", type: "button", onclick: () => desteBaslat(store.kartlar.slice().sort((a, b) => a.sonraki - b.sonraki).slice(0, 20).map((k) => k.id), "Erken çalışma") }, "Yine de çalış")
    : null;
  if (!kartYok && !oturum && !kalan) satir += ". İstersen erken çalışabilirsin.";
  tahta.querySelector("p").textContent = satir;
  const eylem = h("div", { class: "bitis-eylem" }, birincil,
    kartYok ? null : h("button", { class: "metin-dugme", type: "button", onclick: () => listeyiAc() }, icon("liste", "i-20"), "Kart listesi"),
    h("button", { class: "metin-dugme", type: "button", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, "Kitaplığa dön"));
  // Bilinemeyenler I. kutuda, bugün yeniden bekliyor
  if (oturum && kalan) eylem.prepend(h("button", { class: "metin-dugme vurgulu", type: "button", onclick: () => desteBaslat() },
    icon("yeniden", "i-20"), d.ozel ? `Bugünün ${kalan} kartını çalış` : `${kalan} kartı yeniden çalış`));
  return [tahta, eylem];
}

// ======================================================================
// Sınav (§6.5)
// ======================================================================
function sinavDugmesi() {
  if (D.gorunum === "sinav") return sinavBitir();
  sinavFisiAc();
}

function dersler() {
  const gruplar = KLASORLER.map((kl) => ({ id: kl.id, ad: kl.ad, renk: kl.renk, ids: [] }));
  const raf = { id: "raf", ad: "Okuma rafı", renk: "#5A1A22", ids: [] };
  for (const k of store.kartlar) {
    const g = gruplar.find((x) => x.id === kartKlasoru(k)) || raf;
    g.ids.push(k.id);
  }
  if (raf.ids.length) gruplar.push(raf);
  gruplar.push({ id: "hepsi", ad: "Bütün kartlar", renk: null, ids: store.kartlar.map((k) => k.id) });
  return gruplar;
}

function sinavFisiAc(dersId = null) {
  if (D.fis) return fisKapat();
  const gruplar = dersler();
  let secili = gruplar.find((g) => g.id === dersId && g.ids.length) || gruplar.find((g) => g.ids.length && g.id !== "hepsi") || gruplar[gruplar.length - 1];
  let sure = 0;
  const baslat = h("button", { class: "birincil", type: "button" }, icon("kronometre", "i-20"), "Sınavı başlat");
  const satirlar = gruplar.map((g) => {
    const s = h("button", { class: "fis-satir sinav-ders", type: "button", role: "radio", disabled: !g.ids.length,
      "aria-checked": String(g === secili), onclick: () => { secili = g; guncelle(); s.focus(); } },
      g.renk ? h("i", { class: "kumas-sekme", style: `--c:${g.renk}` }) : icon("tumu", "i-20"),
      h("span", {}, g.ad), h("span", { class: "t-deger-k" }, `${g.ids.length} kart`));
    s._g = g;
    return s;
  });
  // Görsel durum CSS'te aria-pressed'e bağlı; radyo anlamı için aria-checked de yazılır
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": "Süre sınırı" },
    ...SURELER.map(([dk, ad]) => h("button", { type: "button", role: "radio", "aria-checked": String(dk === sure), "aria-pressed": String(dk === sure),
      tabindex: dk === sure ? "0" : "-1", onclick: (e) => {
        sure = dk;
        for (const b of parcali.children) {
          const sec = b === e.currentTarget;
          b.setAttribute("aria-pressed", String(sec));
          b.setAttribute("aria-checked", String(sec));
          b.tabIndex = sec ? 0 : -1;
        }
        e.currentTarget.focus();
      } }, ad)));
  const guncelle = () => {
    for (const s of satirlar) { s.setAttribute("aria-checked", String(s._g === secili)); s.tabIndex = s._g === secili ? 0 : -1; }
    baslat.disabled = !secili?.ids.length;
  };
  baslat.onclick = () => { fisKapat(true); sinavBaslat(secili, sure); };
  guncelle();

  const dersGrup = h("div", { role: "radiogroup", "aria-label": "Ders" }, ...satirlar);
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis", role: "dialog", "aria-modal": "true", "aria-label": "Sınav", tabindex: "-1" },
    h("div", { class: "fis-baslik" }, "Hangi dersten?"),
    dersGrup,
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, "Süre sınırı"), parcali),
    h("div", { class: "fis-form-alt" }, baslat));
  radyoOklari(dersGrup);
  radyoOklari(parcali);
  fisGoster(fis, D.sinavDugme);
  (satirlar.find((s) => s._g === secili) || fis).focus();
}

// Fiş açan düğmenin altına, sağa hizalı açılır. Odak fişin içinde kalır: arka plan erişilemez, Tab fişin içinde döner.
function fisGoster(fis, acan) {
  const perde = h("div", { class: "perde tekrar-perde", onclick: () => fisKapat() });
  fis.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const odaklanir = [...fis.querySelectorAll("button:not([disabled])")].filter((b) => b.tabIndex >= 0);
    if (!odaklanir.length) return;
    const ilk = odaklanir[0], son = odaklanir[odaklanir.length - 1];
    if (e.shiftKey && (document.activeElement === ilk || document.activeElement === fis)) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  });
  D.kok.inert = true;
  document.body.append(perde, fis);
  const r = acan.getBoundingClientRect();
  const genislik = Math.min(360, innerWidth - 32);
  fis.style.width = `${genislik}px`;
  fis.style.top = `${Math.max(8, Math.min(r.bottom + 8, innerHeight - Math.max(120, fis.offsetHeight + 8)))}px`;
  fis.style.left = `${Math.max(16, Math.min(r.right - genislik, innerWidth - genislik - 16))}px`;
  acan.setAttribute("aria-expanded", "true");
  D.fis = { fis, perde, acan };
}

function fisKapat(hemen = false) {
  if (!D?.fis) return;
  const { fis, perde, acan } = D.fis;
  D.fis = null;
  D.kok.inert = false;
  acan.setAttribute("aria-expanded", "false");
  if (hemen || hareketAz()) { fis.remove(); perde.remove(); return; }
  fis.classList.add("kapaniyor");
  perde.classList.add("gidiyor");
  setTimeout(() => { fis.remove(); perde.remove(); }, 160);
  acan.focus();
}

// Radyo grubu: ok tuşları seçimi gezdirir (asistan.js uygulama seçicisindeki gibi), kapalı seçenek atlanır
function radyoOklari(grup) {
  grup.addEventListener("keydown", (e) => {
    const yon = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!yon) return;
    const ogeler = [...grup.querySelectorAll('[role="radio"]:not([disabled])')];
    if (!ogeler.length) return;
    e.preventDefault();
    const i = Math.max(0, ogeler.indexOf(document.activeElement));
    ogeler[(i + yon + ogeler.length) % ogeler.length].click();
  });
}

function sinavBaslat(grup, dk) {
  const ids = karistir([...grup.ids]);
  const cam = h("div", { class: "kronometre cam kehribar", role: "timer", "aria-label": "Sınav süresi" });
  const gosterge = h("span", { class: "t-gosterge" }, "00:00");
  const sira = h("span", { class: "sira" });
  const son = h("span", { class: "t-daktilo son-dakika", hidden: true }, "Son dakika");
  const kalan = h("span", { class: "kalan", hidden: !dk });
  cam.append(gosterge, son, sira, kalan);
  D.sinav = { ad: grup.ad, ids, sira: 0, cevap: [], baslangic: Date.now(), sinir: dk * 60e3, cam, gosterge, siraEl: sira, son, kalan };
  D.sinav.saat = setInterval(saatTik, 1000);
  D.gorunum = "sinav";
  saatTik();
  sahneCiz();
}

function saatTik() {
  const s = D?.sinav;
  if (!s) return;
  const gecen = Date.now() - s.baslangic;
  s.gosterge.textContent = saatMetni(gecen);
  s.siraEl.textContent = `${Math.min(s.sira + 1, s.ids.length)} / ${s.ids.length}`;
  if (s.sinir) {
    const kalan = Math.max(0, s.sinir - gecen);
    s.kalan.style.setProperty("--kalan", (kalan / s.sinir).toFixed(4));
    s.son.hidden = kalan > 60e3;
    if (kalan <= 0 && D.gorunum === "sinav") sinavBitir({ sureDoldu: true });
  }
}

function sinavDurdur() {
  if (D.sinav?.saat) clearInterval(D.sinav.saat);
  if (D.sinav) D.sinav.saat = null;
}

function sinavBitir({ sureDoldu = false } = {}) {
  const s = D.sinav;
  if (!s) return;
  sinavDurdur();
  const sure = Date.now() - s.baslangic;
  const bildi = s.cevap.filter((x) => x.bildi).length;
  const cevaplanan = new Set(s.cevap.map((x) => x.id));
  const bilemedi = [...s.cevap.filter((x) => !x.bildi).map((x) => x.id), ...s.ids.filter((id) => !cevaplanan.has(id))];
  // Sınavda yalnız yanlış cevaplanan kart I. kutuya döner (cevapsız kalanın takvimi değişmez)
  const donen = s.cevap.filter((x) => !x.bildi).length;
  D.sonuc = { ad: s.ad, ids: s.ids, bildi, bilemedi, donen, sure: Math.min(sure, s.sinir || sure), sureDoldu, cevapsiz: s.ids.length - s.cevap.length };
  D.sinav = null;
  D.gorunum = "sonuc";
  sahneCiz();
}

// Galvanometre (§6.5): 0..100 ölçek, pirinç dış yay, ölçeğin altında ayna şeridi (paralaks okuması için),
// her 10'da ana çentik, 75..100 fosfor bölge, karşı ağırlıklı ibre ve pirinç göbek. 220x132.
function galvanometre(oran) {
  const cx = 110, cy = 112, r = 88;
  const n = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy - rr * Math.sin(a)).toFixed(2)}`;
  const yay = (rr, a0, a1) => `M${n(a0, rr)}A${rr} ${rr} 0 0 1 ${n(a1, rr)}`;
  let ana = "", ara = "";
  for (let i = 0; i <= 50; i++) {
    const a = Math.PI * (1 - i / 50);
    if (i % 5) ara += `M${n(a, r)}L${n(a, r - 5)}`;
    else ana += `M${n(a, r)}L${n(a, r - 10)}`;
  }
  const yuzde = Math.round(oran * 100);
  return `<svg class="galvanometre" viewBox="0 0 220 132" role="img" aria-label="Skor yüzde ${yuzde}">
    <path class="g-dis" d="${yay(r + 7, Math.PI, 0)}"/>
    <path class="g-bolge" d="${yay(r - 4, Math.PI * .25, 0)}"/>
    <path class="g-ara" d="${ara}"/><path class="g-ana" d="${ana}"/>
    <path class="g-ayna" d="${yay(r - 16, Math.PI, 0)}"/>
    <text x="${cx - r}" y="${cy + 15}">0</text><text x="${cx}" y="${cy - r + 26}">50</text><text x="${cx + r}" y="${cy + 15}">100</text>
    <g class="g-ibre" style="--aci:${(oran * 180 - 90).toFixed(1)}deg">
      <path class="g-kol" d="M${cx} ${cy + 16}V${cy - r + 4}"/><rect class="g-agirlik" x="${cx - 4}" y="${cy + 12}" width="8" height="6" rx="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="4"/></g></svg>`;
}

function sonucCiz() {
  const s = D.sonuc, top = s.ids.length, oran = top ? s.bildi / top : 0;
  const fis = h("div", { class: "sonuc-fis nesne-acik", role: "region", "aria-label": `${s.ad} sınavının sonucu` });
  fis.insertAdjacentHTML("beforeend", galvanometre(oran));
  fis.append(h("p", { class: "sonuc-yuzde" }, `%${Math.round(oran * 100)}`),
    h("p", { class: "sonuc-alt" }, `${s.bildi} / ${top} doğru · ${sureMetni(s.sure)}`));
  const notlar = [];
  if (s.cevapsiz) notlar.push(`${s.sureDoldu ? "Süre doldu" : "Erken bitirdin"}, ${s.cevapsiz} kart cevapsız kaldı.`);
  if (s.donen) notlar.push(`${s.donen} kart Kutu I'e döndü.`);
  for (const t of notlar) fis.append(h("p", { class: "sonuc-not" }, t));
  const yanlis = s.bilemedi.map(kartBul).filter(Boolean);
  if (yanlis.length) {
    // Satırın tamamı kaynağa giden tek düğme
    fis.append(h("p", { class: "etiket-sayfa sonuc-etiket" }, "Bilemediklerin"),
      h("ul", { class: "sonuc-liste" }, ...yanlis.map((k) => h("li", {},
        h("button", { class: "sonuc-satir", type: "button", onclick: () => kaynagaGit(k), "aria-label": `${onMetni(k)}. Kaynağa git: ${kaynakSatiri(k, { tur: false })}` },
          h("span", { class: "on" }, onMetni(k)), h("span", { class: "etiket-sayfa kaynak" }, kaynakKisa(k)), icon("sag", "i-20"))))));
  } else fis.append(h("p", { class: "sonuc-not" }, "Hepsini bildin."));
  const eylem = h("div", { class: "sonuc-eylem" });
  if (yanlis.length) eylem.append(h("button", { class: "birincil", type: "button",
    onclick: () => desteBaslat(yanlis.map((k) => k.id), "Bilemediklerin") }, icon("yeniden", "i-20"), "Bilemediklerini tekrar et"));
  eylem.append(h("button", { class: "metin-dugme" + (yanlis.length ? "" : " vurgulu"), type: "button", onclick: () => desteBaslat() }, "Desteye dön"));
  fis.append(eylem);
  D.govde.replaceChildren(h("div", { class: "tekrar-sahne sonuc" }, fis));
  girisOynat(fis);
}

// ======================================================================
// Kart listesi (§6.7)
// ======================================================================
function listeyiAc({ kutu = null } = {}) {
  if (D.gorunum === "sinav") return;
  fisKapat(true);
  D.liste = { tur: "tumu", kutu };
  D.gorunum = "liste";
  sahneCiz();
}

function onMetni(k) {
  if (k.on?.metin) return k.on.metin;
  if (k.arka?.metin) return k.arka.metin;
  return `${kaynakAd(k) || "Belge"} ${k.tur === "kirpinti" ? "kırpıntısı" : "bandı"}`;
}
// Listedeki küçük fiş: görsel kartta ön yüz, metin kartında çizgili boş fiş
function miniOlustur(k) {
  const gorsel = k.on?.gorsel || k.arka?.gorsel;
  return gorsel ? h("img", { class: "mini", src: gorsel, alt: "", loading: "lazy" }) : h("span", { class: "mini mini-metin", "aria-hidden": "true" });
}
const kaynakKisa = (k) => [kaynakAd(k), k.sayfa ? `s. ${k.sayfa}` : ""].filter(Boolean).join(" · ");

function listeCiz() {
  const { tur, kutu } = D.liste;
  const tumu = store.kartlar.filter((k) => kutu == null || (k.kutu || 1) === kutu);
  const sekmeler = h("div", { class: "sekmeler tekrar-sekmeler", role: "tablist", "aria-label": "Kart türü" },
    ...TURLER.map(([id, ad]) => {
      const n = id === "tumu" ? tumu.length : tumu.filter((k) => k.tur === id).length;
      return h("button", { class: "sekme", type: "button", role: "tab", "aria-selected": String(id === tur),
        onclick: () => { D.liste.tur = id; listeCiz(); } }, ad, h("span", { class: "sekme-sayi" }, String(n)));
    }));
  if (kutu != null) sekmeler.append(h("button", { class: "metin-dugme kutu-suzgec", type: "button",
    "aria-label": `${ROMA[kutu]}. kutu süzgecini kaldır`, onclick: () => { D.liste.kutu = null; listeCiz(); } },
    h("span", { class: "cam cam-k" }, ROMA[kutu]), "Kutu", icon("kapat", "i-20")));

  const kartlar = tumu.filter((k) => tur === "tumu" || k.tur === tur).sort((a, b) => a.sonraki - b.sonraki);
  const simdi = Date.now();
  const liste = h("div", { class: "kart-liste", role: "tabpanel" });
  const ic = h("ul", { class: "kart-liste-ic" });
  for (const k of kartlar) {
    const mini = miniOlustur(k);
    const kalanGun = gunFarki(k.sonraki, simdi);
    // Silme anında yapılır, "Geri al" bildirimiyle geri gelir (TASARIM-4 3.6)
    const sil = h("button", { class: "ikon-dugme kart-sil", type: "button", "aria-label": "Kartı sil" }, icon("sil", "i-20"));
    sil.addEventListener("click", (e) => { e.stopPropagation(); kartSilGeriAlinir(k); });
    ic.append(h("li", { class: "kart-satir" },
      mini,
      h("span", { class: "on-kap" }, h("span", { class: "on", title: onMetni(k) }, onMetni(k)),
        h("small", {}, [TUR_AD[k.tur] || "Kart", k.on?.metin || k.arka?.metin ? kaynakAd(k) : null,
          kalanGun <= 0 ? "bugün" : kalanGun === 1 ? "yarın" : `${kalanGun} gün sonra`].filter(Boolean).join(" · "))),
      h("button", { class: "kaynak", type: "button", onclick: () => kaynagaGit(k), "aria-label": `Kaynağa git: ${kaynakSatiri(k, { tur: false })}` }, k.sayfa ? `s. ${k.sayfa}` : "Aç"),
      h("span", { class: "cam cam-k", role: "img", "aria-label": `${ROMA[k.kutu || 1]}. kutu` }, ROMA[k.kutu || 1]),
      sil));
  }
  if (!kartlar.length) ic.append(h("li", { class: "kart-liste-bos" }, kutu != null ? `${ROMA[kutu]}. kutuda bu türde kart yok.` : "Bu türde kart yok."));
  // Dışarı: Anki (listedeki ya da bütün kartlar) ve önümüzdeki 14 günün takvimi
  const eylem = store.kartlar.length ? h("div", { class: "kart-liste-eylem" },
    h("button", { class: "metin-dugme", type: "button", "aria-haspopup": "dialog", onclick: (e) => ankiFisiAc(e.currentTarget, kartlar) },
      icon("disa-aktar", "i-20"), "Anki’ye aktar"),
    h("button", { class: "metin-dugme", type: "button", "aria-haspopup": "dialog", onclick: (e) => takvimFisiAc(e.currentTarget) },
      icon("indir", "i-20"), "Takvime ekle")) : null;
  liste.append(...[eylem, ic].filter(Boolean));
  const kaydirma = D.govde.querySelector(".kart-liste")?.scrollTop || 0;
  D.govde.replaceChildren(h("div", { class: "tekrar-liste" }, sekmeler, liste));
  liste.scrollTop = kaydirma;
  zeminUygula();
}

// ---------- Anki ve takvim (OZELLIKLER-8 1.2, 1.3) ----------
const BICIMLER = [["apkg", "Anki paketi"], ["tsv", "TSV ve görseller"]];
const BICIM_NOT = {
  apkg: "Anki, AnkiDroid ve AnkiMobile açar. Görseller pakete girer. Takvim de gelsin diye içe aktarırken “Import any learning progress” seçeneğini aç.",
  tsv: "Anki’de Dosya > İçe aktar. Görseller zip içinde, OKU.txt yolu anlatır.",
};

function ankiFisiAc(acan, listedekiler) {
  if (D.fis) return fisKapat();
  const hepsi = store.kartlar.slice();
  const secenekler = [];
  if (listedekiler.length && listedekiler.length !== hepsi.length) secenekler.push({ ad: "Bu listedekiler", ikon: "liste", kartlar: listedekiler.slice() });
  secenekler.push({ ad: "Bütün kartlar", ikon: "tumu", kartlar: hepsi });
  let secili = secenekler[0], bicim = "apkg";
  const aktar = h("button", { class: "birincil", type: "button" }, icon("disa-aktar", "i-20"), h("span", {}, "Aktar"));
  const not = h("p", { class: "tekrar-fis-not" }, BICIM_NOT[bicim]);
  const satirlar = secenekler.map((o) => {
    const s = h("button", { class: "fis-satir sinav-ders", type: "button", role: "radio", "aria-checked": String(o === secili),
      tabindex: o === secili ? "0" : "-1", onclick: () => { secili = o; guncelle(); s.focus(); } },
      icon(o.ikon, "i-20"), h("span", {}, o.ad), h("span", { class: "t-deger-k" }, `${o.kartlar.length} kart`));
    s._o = o;
    return s;
  });
  const guncelle = () => {
    for (const s of satirlar) { s.setAttribute("aria-checked", String(s._o === secili)); s.tabIndex = s._o === secili ? 0 : -1; }
    not.textContent = BICIM_NOT[bicim];
  };
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": "Biçim" },
    ...BICIMLER.map(([id, ad]) => h("button", { type: "button", role: "radio", "aria-checked": String(id === bicim), "aria-pressed": String(id === bicim),
      tabindex: id === bicim ? "0" : "-1", onclick: (e) => {
        bicim = id;
        for (const b of parcali.children) {
          const sec = b === e.currentTarget;
          b.setAttribute("aria-pressed", String(sec));
          b.setAttribute("aria-checked", String(sec));
          b.tabIndex = sec ? 0 : -1;
        }
        guncelle();
        e.currentTarget.focus();
      } }, ad)));
  aktar.onclick = async () => {
    if (aktar.disabled) return;
    aktar.disabled = true;
    aktar.lastChild.textContent = "Hazırlanıyor";
    try {
      const { ankiAktar } = await import("./anki.js");
      const sonuc = await ankiAktar(secili.kartlar, { bicim });
      fisKapat(true);
      aktarimBildir(sonuc, bicim === "tsv" ? "Anki dosyaları indirildi" : "Anki paketi indirildi");
    } catch (hata) {
      console.error("[tekrar] Anki aktarımı:", hata);
      toast("Anki dosyası hazırlanamadı");
      aktar.disabled = false;
      aktar.lastChild.textContent = "Aktar";
    }
  };
  const kartGrup = h("div", { role: "radiogroup", "aria-label": "Kartlar" }, ...satirlar);
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis tekrar-anki-fis", role: "dialog", "aria-modal": "true", "aria-label": "Anki’ye aktar", tabindex: "-1" },
    h("div", { class: "fis-baslik" }, "Anki’ye aktar"),
    kartGrup,
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, "Biçim"), parcali, not),
    h("div", { class: "fis-form-alt" }, aktar));
  radyoOklari(kartGrup);
  radyoOklari(parcali);
  fisGoster(fis, acan);
  (satirlar.find((s) => s._o === secili) || fis).focus();
}

// Takvim fişi: hatırlatma saati seçilir, seçim cihazda hatırlanır. Yalnız kartlı günler takvime girer.
const SAAT_ANAHTAR = "kn-tasarim:takvim-saat";
const HAZIR_SAATLER = ["07:00", "09:00", "12:00", "18:00", "21:00"];
const saatGecerli = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");
function takvimSaati() {
  try { const s = localStorage.getItem(SAAT_ANAHTAR); if (saatGecerli(s)) return s; } catch {}
  return "09:00";
}

async function takvimFisiAc(acan) {
  if (D.fis) return fisKapat();
  if (acan.disabled) return;
  let A;
  acan.disabled = true;
  try { A = await import("./anki.js"); }
  catch (hata) { console.error("[tekrar] takvim:", hata); toast("Takvim dosyası hazırlanamadı"); return; }
  finally { acan.disabled = false; }
  if (D.fis || !acan.isConnected) return;
  const gunSayisi = A.takvimGunleri().filter((g) => g.sayi).length;
  let saat = takvimSaati();
  const ekle = h("button", { class: "birincil", type: "button", disabled: !gunSayisi }, icon("indir", "i-20"), h("span", {}, "Takvime ekle"));
  const saatGir = h("input", { class: "tekrar-saat", type: "time", step: "300", value: saat, "aria-label": "Başka saat" });
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": "Hazır saatler" },
    ...HAZIR_SAATLER.map((s) => h("button", { type: "button", role: "radio", onclick: (e) => { sec(s); e.currentTarget.focus(); } }, s)));
  const sec = (yeni) => {
    saat = yeni;
    const butonlar = [...parcali.children], secili = butonlar.find((b) => b.textContent === saat);
    for (const b of butonlar) {
      const evet = b === secili;
      b.setAttribute("aria-pressed", String(evet));
      b.setAttribute("aria-checked", String(evet));
      b.tabIndex = evet || (!secili && b === butonlar[0]) ? 0 : -1;
    }
    if (saatGir.value !== saat) saatGir.value = saat;
    try { localStorage.setItem(SAAT_ANAHTAR, saat); } catch {}
  };
  saatGir.addEventListener("change", () => { if (saatGecerli(saatGir.value)) sec(saatGir.value); });
  sec(saat);
  ekle.onclick = async () => {
    if (ekle.disabled) return;
    ekle.disabled = true;
    try {
      const sonuc = await A.takvimAktar({ saat });
      fisKapat(true);
      aktarimBildir(sonuc, `Takvim dosyası indirildi. Açınca ${gunSayisi} güne saat ${saat} hatırlatması eklenir.`);
    } catch (hata) {
      console.error("[tekrar] takvim:", hata);
      toast("Takvim dosyası hazırlanamadı");
      ekle.disabled = false;
    }
  };
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis tekrar-takvim-fis", role: "dialog", "aria-modal": "true", "aria-label": "Takvime ekle", tabindex: "-1" },
    h("div", { class: "fis-baslik" }, "Takvime ekle"),
    h("p", { class: "tekrar-fis-not tekrar-takvim-ozet" }, gunSayisi
      ? `Önümüzdeki 14 günde ${gunSayisi} gün tekrar var. Yalnız o günlere hatırlatma yazılır.`
      : "Önümüzdeki 14 günde vakti gelen kart yok."),
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, "Hatırlatma saati"), parcali,
      h("label", { class: "tekrar-saat-satir" }, h("span", {}, "Başka saat"), saatGir)),
    h("div", { class: "fis-form-alt" }, ekle));
  radyoOklari(parcali);
  fisGoster(fis, acan);
  (parcali.querySelector('[tabindex="0"]') || fis).focus();
}

// paylas() sonucu: paylaşıldıysa ya da vazgeçildiyse sessiz; "bekliyor"da bildirimi paylas kendisi gösterir
function aktarimBildir(sonuc, indirildi) {
  if (sonuc === "indirildi") toast(indirildi);
  else if (sonuc === "kaydedildi") toast("Kaydedildi");
}

function kaynagaGit(k) {
  const b = k.belgeId && belgeBul(k.belgeId);
  if (!b) return;
  // Bant kartı sayfa kimliğini taşır: sayfa eklenip taşındıysa güncel numara oradan çözülür
  let sayfa = k.sayfa;
  const sayfalar = b.veri?.sayfalar;
  if (k.sayfaId && Array.isArray(sayfalar)) {
    const i = sayfalar.findIndex((s) => s?.id === k.sayfaId);
    if (i >= 0) sayfa = (b.veri.ilkNo || 1) + i;
  }
  bus.emit("git", { ekran: "belge", belgeId: k.belgeId, sayfa });
}

// Gün dönünce biten ya da boş deste yeniden kurulur; aynı gün içinde yalnız sayaçlar tazelenir
function gunKontrol() {
  if (!D || document.hidden) return;
  gostergeGuncelle();
  if (D.gorunum !== "deste" || D.kart) return;
  if (D.deste?.gun !== gunBasi() || (!D.deste?.cevap.length && bugunTekrar().length)) return desteBaslat();
  ustGuncelle();
  if (!D.deste?.cevap.length) sahneCiz();   // oturumsuz bitiş tahtasındaki "yarın N" de tazelensin
}
function geceYarisiKur() {
  sonra(() => { gunKontrol(); geceYarisiKur(); }, gunBasi(Date.now(), 1) - Date.now() + 1000);
}

// ======================================================================
// Olaylar
// ======================================================================
function kartlarDegisti(v) {
  if (!D) return;
  gostergeGuncelle();
  if (D.gorunum === "liste") { ustGuncelle(); listeCiz(); return; }
  // Gösterilen kart başka yerden silindiyse sıradakine geç
  if (v?.tur === "sil" && D.kart && v.kart?.id === D.kart.k.id && !D.kart.kilit) return sahneCiz();
  // Açılışta örnek kartlar deste kurulduktan sonra (birer birer) gelebilir. Oturum başlamadıysa ve kart çevrilmediyse
  // bugün bekleyen her kart destede olsun; yoksa başlık "5 kart bekliyor" derken gövde "Henüz kart yok" kalırdı.
  if (D.gorunum === "deste" && !D.deste?.cevap.length && !D.deste?.ozel && !D.kart?.acik) {
    const destede = new Set(D.deste?.ids || []);
    if (bugunTekrar().some((k) => !destede.has(k.id))) return desteTazelePlanla();
  }
  if (D.gorunum === "deste" && !D.kart) {
    // Bitiş ekranındayken gelen kart: başlık sayısı güncellensin
    ustGuncelle();
  }
}

// Aynı anda gelen kart olayları (örnek kurulumda yedi kart) tek yeniden kuruluşta toplanır
function desteTazelePlanla() {
  if (D.tazele) return;
  D.tazele = true;
  queueMicrotask(() => {
    if (!D) return;
    D.tazele = false;
    if (D.gorunum !== "deste" || D.deste?.cevap.length || D.kart?.acik) return;
    const ilk = D.ilkKart && kartBul(D.ilkKart);
    desteBaslat(ilk ? [ilk.id, ...bugunTekrar().sort(desteSirasi).map((k) => k.id).filter((id) => id !== ilk.id)] : null);
  });
}

function tus(e) {
  if (!D || !D.kok.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    if (D.fis) { e.preventDefault(); fisKapat(); return; }
    if (D.gorunum === "liste") { e.preventDefault(); desteyeDon(); }
    return;
  }
  if (D.fis || !D.kart || (D.gorunum !== "deste" && D.gorunum !== "sinav")) return;
  const hedef = e.target instanceof Element ? e.target : null;
  // Asistan paneli açıkken odak oradaysa tuşlar arkadaki karta gitmez
  if (hedef?.closest("input, textarea, select, [contenteditable='true'], .asistan")) return;
  const dugme = hedef?.closest("button, a");
  if (e.key === " " || e.code === "Space") {
    if (dugme && !dugme.disabled) return;   // odaktaki düğme kendi işini yapar
    e.preventDefault();
    cevir();
  } else if (e.key === "1") { e.preventDefault(); cevapla(false); }
  else if (e.key === "2") { e.preventDefault(); cevapla(true); }
}

// ======================================================================
// Örnek veri (§6.8): store.kartlar boşsa 7 kart
// ======================================================================
let ornekKuruldu = false;
export function ornekKartlariHazirla() {
  if (ornekKuruldu || store.kartlar.length) return;
  ornekKuruldu = true;
  const simdi = Date.now(), saat = 3600e3;
  const kal = belgeBul("kalkulus"), suc = belgeBul("sucveceza");
  const kalAd = kal?.ad || "Kalkülüs II Ders Notları", sucAd = suc?.ad || "Suç ve Ceza";
  const gecmis = (kutu, sonGun) => Array.from({ length: Math.max(0, kutu - 1) }, (_, i) => ({ zaman: simdi - (sonGun + (kutu - 1 - i) * 3) * GUN, bildi: true }));
  // bekliyor: sonraki geçmişte (bugün); değilse gün sonra
  const kart = (alanlar, kutu, gunSonra) => ({
    ...alanlar, kutu, gecmis: gecmis(kutu, Math.max(1, -gunSonra)),
    sonraki: gunSonra <= 0 ? simdi - (1 - gunSonra) * saat : simdi + gunSonra * GUN,
  });

  let kesit = [];
  try { kesit = sayfaKesitleri(); } catch (hata) { console.warn("[tekrar] örnek görüntüler üretilemedi:", hata); }
  const [k47, k52, k61] = kesit;

  // kartEkle başa ekler: sondan başa doğru eklenir ki liste bu sırada kalsın
  const liste = [
    k47 ? kart({ tur: "bant", bant: "murekkep", ...k47, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 1, 0)
        : kart({ tur: "soru", on: { metin: "Zincir kuralı: F = f ∘ g ise F′(x) = ?" }, arka: { metin: "F′(x) = f′(g(x)) · g′(x)" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 1, 0),
    k52 ? kart({ tur: "bant", bant: "hardal", ...k52, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 52 }, 1, -1)
        : kart({ tur: "soru", on: { metin: "Leibniz gösteriminde zincir kuralı" }, arka: { metin: "dy/dx = (dy/du) · (du/dx)" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 52 }, 1, -1),
    k61 ? kart({ tur: "bant", bant: "bordo", ...k61, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 61 }, 2, 0)
        : kart({ tur: "soru", on: { metin: "y = (3x² + 1)⁵ ise y′ = ?" }, arka: { metin: "y′ = 30x (3x² + 1)⁴" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 61 }, 2, 0),
    kart({ tur: "kelime", on: { metin: "melankoli" }, arka: { metin: "Sebebi belirsiz, uzun süren derin hüzün; kara sevda." }, belgeId: "sucveceza", belgeAd: sucAd, sayfa: 34 }, 3, 4),
    kart({ tur: "kelime", on: { metin: "ıstıraplı" }, arka: { metin: "Acı ve sıkıntı içinde olan; büyük acı veren." }, belgeId: "sucveceza", belgeAd: sucAd, sayfa: 112 }, 1, -2),
    kart({ tur: "kelime", on: { metin: "şükür" }, arka: { metin: "Bir iyiliğe karşı duyulan minnet; teşekkür." }, belgeId: "sucveceza", belgeAd: sucAd, sayfa: 287 }, 4, 9),
    kart({ tur: "soru", on: { metin: "Türevin geometrik anlamı nedir?" },
      arka: { metin: "Grafiğe o noktada çizilen teğet doğrusunun eğimi: f′(a) = lim h→0 (f(a + h) − f(a)) / h" },
      belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 2, -3),
  ];
  for (const alanlar of liste.reverse()) kartEkle(alanlar);
}

// PDF_PAGES[0] (Zincir Kuralı) sayfasından üç bant kesiti. Konumlar çizim sırasında fillText'ten okunur,
// böylece yazı tipi farkı kesiti kaydırmaz. Ön yüzde cevap şeridi zeminle örtülür; bant onun üstüne oturur.
function sayfaKesitleri() {
  const S = 2;
  const c = document.createElement("canvas");
  c.width = PW * S; c.height = PH * S;
  const g = c.getContext("2d");
  g.scale(S, S);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, PW, PH);
  const yazilar = [];
  const asil = g.fillText.bind(g);
  g.fillText = (t, x, y, ...r) => { yazilar.push({ t: String(t), y }); return asil(t, x, y, ...r); };
  PDF_PAGES[0].draw(g);
  const bul = (bas) => yazilar.find((y) => y.t.trim().startsWith(bas))?.y;

  const kes = (y0, y1, [g0, g1], x0 = 60, x1 = 740) => {
    const W = (x1 - x0) * S, H = (y1 - y0) * S;
    const k = document.createElement("canvas");
    k.width = W; k.height = H;
    const kg = k.getContext("2d", { willReadFrequently: true });   // piksel okunur: konsol uyarısı çıkmasın
    kg.drawImage(c, x0 * S, y0 * S, W, H, 0, 0, W, H);
    const arka = k.toDataURL("image/png");
    // Örtülecek şeridin zemin rengi: şeridin sağ ucundaki piksel
    const [r, gg, b] = kg.getImageData(W - 30 * S, ((g0 + g1) / 2 - y0) * S, 1, 1).data;
    kg.fillStyle = `rgb(${r},${gg},${b})`;
    kg.fillRect(14 * S, (g0 - y0) * S, W - 28 * S, (g1 - g0) * S);
    return { on: { gorsel: k.toDataURL("image/png") }, arka: { gorsel: arka },
      bantY: ((g0 + g1) / 2 - y0) / (y1 - y0), bantH: (g1 - g0) / (y1 - y0) };
  };

  // Konumlar metin parçalarından bulunur; kesirler üst üste dizilse de (pay ve payda ayrı satırda) şerit hepsini örter
  const teorem = bul("Teorem"), leib = bul("Leibniz"), ornek = bul("Örnek 1"), alis = bul("Alıştırma") ?? PH;
  if ([teorem, leib, ornek].some((v) => v == null)) throw new Error("sayfa düzeni beklenenden farklı");
  const arada = (a, z, suz = () => true) => yazilar.filter((y) => y.y > a && y.y < z && suz(y.t)).map((y) => y.y);
  const serit = (ys, ust = 22, alt = 8) => (ys.length ? [Math.min(...ys) - ust, Math.max(...ys) + alt] : null);
  const f1 = serit(arada(teorem, leib, (t) => /^\s*F′/.test(t)), 26, 10);    // teoremin formülü
  const f2 = serit(arada(leib + 4, ornek - 4), 26, 10);                        // Leibniz formülü (tek satır ya da üst üste)
  const cozum = arada(ornek + 4, alis - 4);
  const sonY = cozum.length ? Math.max(...cozum) : null;
  const f3 = sonY == null ? null : serit(cozum.filter((y) => y >= sonY - 24));  // çözümün son satırı (cevap)
  if (!f1 || !f2 || !f3) throw new Error("sayfa düzeni beklenenden farklı");
  return [
    kes(teorem - 40, Math.max(teorem + 120, f1[1] + 14), f1),     // Teorem 3.4 kutusu, formül örtülü
    kes(leib - 26, f2[1] + 14, f2),                              // Leibniz gösterimi
    kes(ornek - 26, f3[1] + 12, f3),                             // Örnek 1, son satır (cevap) örtülü
  ];
}
