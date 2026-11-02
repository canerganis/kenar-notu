// Tekrar ekranı: günlük deste, kutu göstergesi, sınav, kart listesi ve istatistikler (Anki ve takvim anki.js).
// İş tanımı OZELLIKLER-2 §4, görünüm TASARIM-2 §6 ve TASARIM-5 8.4 (7.0 Işıklı Kenar). Sözleşme: ac(kap), kapat().
// 7.0 (TASARIM-5 11.5): kart düzenleme ve elle kart (kartPenceresiAc), boşluk doldurma ({{c1::...}}) ve ters kart,
// deste ayarları (günlük yeni sınırı, hedef hatırlama, iki ya da dört düğme), askıya alma, istatistikler (tekrar-istatistik.js),
// Anki destesi içe aktarma (ankiDosyasiAc; okuma anki.js ankiIceOku).
// Dışarıdan: bus.emit("kart:yeni", { on, arka, tur, belgeId, belgeAd, sayfa }) ön dolu "Yeni kart" penceresini,
// bus.emit("kart:duzenle", { id }) düzenleme penceresini açar (Tekrar ekranı açık olmasa da).
import {
  h, icon, bus, store, belgeBul, hareketAz, toast, KLASORLER, BANTLAR, ayarla, yeniId, ikiDokunus,
  kutuAralikMetni, fsrsHesapla, fsrsAralik, kartEkle, kartSil, kartGuncelle, kartCevapla, bugunTekrar, gunBasi, gunFarki,
  simgeEkle, kisayolEkle, komutEkle,
} from "./ortak.js";
import { PW, PH, PDF_PAGES } from "./sayfalar.js";
import { matematikVarMi, matematikCiz } from "./matematik.js";
import { istatistikOlustur } from "./tekrar-istatistik.js";
import { ornekKitapKartlari, ornekKunye } from "./okuma-metni.js";
import { t, dil, yerel, ingilizceMi } from "./dil.js";

const ROMA = ["", "I", "II", "III", "IV", "V"];
const GUN = 24 * 3600e3;
const KART_SN = 30;                       // tahmini süre: kart başına 30 sn
const ITME_ESIGI = 80;                    // kalemle itme eşiği (px)
const TURLER = [["tumu", t("Tümü")], ["bant", t("Bant")], ["kirpinti", t("Kırpıntı")], ["kelime", t("Kelime")], ["soru", t("Soru")], ["bosluk", ingilizceMi ? "Cloze" : "Boşluk"], ["askida", t("Askıda")]];
const TUR_AD = { ...Object.fromEntries(TURLER), bosluk: t("Boşluk doldurma") };
// "Boşluk" tuşun adı da kart türü de olduğu için tek anahtara bağlanmaz; "Tekrar" düğmesi de ekranın adından ayrı
const BOSLUK_TUSU = ingilizceMi ? "Space" : "Boşluk";
const TEKRAR_DUGME = ingilizceMi ? "Again" : "Tekrar";

// ---------- 7.0 simgeleri (TASARIM-5 6.12: 24 ızgara, kapalı şekilde ikili ton) ----------
simgeEkle("istatistik", '<path d="M3.5 20.5h17"/><rect class="d" x="5" y="12" width="3.5" height="6" rx="1"/><rect class="d" x="10.25" y="5.5" width="3.5" height="12.5" rx="1"/><rect class="d" x="15.5" y="9" width="3.5" height="9" rx="1"/>');
simgeEkle("duzenle", '<path class="d" d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L9 18.4Z"/><path d="m13.8 6.8 3.4 3.4M4.5 19.5h15"/>');
simgeEkle("aski", '<rect class="d" x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M10 9.5v5M14 9.5v5"/>');
simgeEkle("bosluk", '<path d="M3.5 12h2.5M18 12h2.5"/><rect class="d" x="8" y="8" width="8" height="8" rx="2"/><path d="M10.5 12h3"/>');
simgeEkle("deste", '<rect class="d" x="6.5" y="4" width="13" height="10" rx="2"/><path d="M4.5 8v8a2 2 0 0 0 2 2h11"/><path d="M9.5 8h7M9.5 11h4"/>');

// ======================================================================
// Boşluk doldurma (R3): metinde {{c1::cevap}} ya da {{c1::cevap::ipucu}}. Her cN ayrı kart (aynı bosluk.kok).
// Gösterim kuralı (kart çizen her yer): hedef boşluk önde "[...]" (ipucu varsa "[ipucu]"), öbür boşluklar düz cevap.
// ======================================================================
const BOSLUK_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([^{}]*?))?\}\}/g;
export function boslukParcala(metin) {
  const out = [], s = String(metin ?? "");
  let i = 0;
  for (const m of s.matchAll(BOSLUK_RE)) {
    if (m.index > i) out.push({ metin: s.slice(i, m.index) });
    out.push({ n: Number(m[1]), cevap: m[2], ipucu: m[3] || "" });
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ metin: s.slice(i) });
  return out;
}
export const boslukNumaralari = (metin) => [...new Set(boslukParcala(metin).filter((p) => p.n).map((p) => p.n))].sort((a, b) => a - b);
export const boslukVarMi = (metin) => /\{\{c\d+::/.test(String(metin ?? ""));
// Düz metin: önde hedef "[...]", cevapta hedefin cevabı. Arama, Anki dışa aktarımı ve liste satırları kullanır
export function boslukMetni(metin, n, { cevap = false } = {}) {
  return boslukParcala(metin).map((p) => (p.n == null ? p.metin : p.n === n ? (cevap ? p.cevap : `[${p.ipucu || "..."}]`) : p.cevap)).join("");
}
const boslukCevabi = (metin, n) => boslukParcala(metin).filter((p) => p.n === n).map((p) => p.cevap).join(" … ");
// Kart yüzü için: hedef boşluk iki parçalı (önde [...], açılınca vurgulu cevap); yazı düğüm olarak eklenir, HTML girmez
function boslukDom(metin, n) {
  const kap = document.createDocumentFragment();
  for (const p of boslukParcala(metin)) {
    if (p.n == null) kap.append(p.metin);
    else if (p.n !== n) kap.append(p.cevap);
    else kap.append(h("span", { class: "tk-bosluk" },
      h("span", { class: "tk-bosluk-on" }, `[${p.ipucu || "..."}]`), h("mark", { class: "tk-bosluk-cevap" }, p.cevap)));
  }
  return kap;
}

// ---------- 7.0 kısayollar (R7; dinleyen tus()) ve komutlar ----------
kisayolEkle({ tus: BOSLUK_TUSU, ad: t("Cevabı göster"), alan: "tekrar" });
kisayolEkle({ tus: "1", ad: t("Bilemedim (dört düğmede Tekrar)"), alan: "tekrar" });
kisayolEkle({ tus: "2", ad: t("Bildim (dört düğmede Zor)"), alan: "tekrar" });
kisayolEkle({ tus: "3", ad: t("İyi (dört düğme)"), alan: "tekrar" });
kisayolEkle({ tus: "4", ad: t("Kolay (dört düğme)"), alan: "tekrar" });
kisayolEkle({ tus: "E", ad: t("Kartı düzenle"), alan: "tekrar" });
kisayolEkle({ tus: "N", ad: t("Yeni kart"), alan: "tekrar" });
kisayolEkle({ tus: "Esc", ad: t("Listeden ya da istatistikten desteye dön"), alan: "tekrar" });

let bekleyen = null;   // Tekrar ekranı açılınca yapılacak iş ("istatistik" | "liste-askida")
function tekrardaYap(is) {
  if (D) return is === "istatistik" ? istatistikAc() : listeyiAc({ tur: "askida" });
  bekleyen = is;
  bus.emit("git", { ekran: "tekrar" });
}
komutEkle({ id: "tekrar-yeni-kart", ad: t("Yeni kart"), es: t("kart ekle soru kelime boşluk doldurma cloze ters flashcard"), ikon: "arti", calistir: () => kartPenceresiAc() });
komutEkle({ id: "tekrar-istatistik", ad: t("Tekrar istatistikleri"), es: t("istatistik tutma oranı takvim yük grafik kart"), ikon: "istatistik", calistir: () => tekrardaYap("istatistik") });
komutEkle({ id: "tekrar-ayarlar", ad: t("Deste ayarları"), es: t("tekrar günlük yeni kart sınırı hedef hatırlama dört düğme fsrs"), ikon: "ayarlar", calistir: () => desteAyarlariAc() });
komutEkle({ id: "tekrar-askida", ad: t("Askıdaki kartlar"), es: t("askı askıya alınan kart tekrar"), ikon: "aski", calistir: () => tekrardaYap("liste-askida") });
komutEkle({ id: "tekrar-anki-ice", ad: t("Anki destesi içe aktar"), es: t("anki apkg içe aktar deste kart"), ikon: "indir", calistir: () => ankiSec() });
bus.on("kart:yeni", (alanlar) => kartPenceresiAc({ alanlar: alanlar || {} }));
bus.on("kart:duzenle", (o) => { const k = o?.id && kartBul(o.id); if (k) kartPenceresiAc({ kart: k }); });
const SURELER = [[0, t("Yok")], [10, t("{n} dk", { n: 10 })], [20, t("{n} dk", { n: 20 })], [30, t("{n} dk", { n: 30 })]];
const BANT_IDLER = new Set(BANTLAR.map(([, id]) => id));

// Kaynak satırı arayüz diliyle büyür: Türkçede "i" > "İ", İngilizcede "I"
const ust = (s) => String(s).toLocaleUpperCase(ingilizceMi ? yerel : "tr");
const kartBul = (id) => store.kartlar.find((k) => k.id === id);
const sureMetni = (ms) => { const s = Math.round(ms / 1000), d = Math.floor(s / 60); return d ? t("{d} dk {s} sn", { d, s: s % 60 }) : t("{s} sn", { s }); };
const saatMetni = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const karistir = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Kartın dersi: belgesinin klasörü. Klasörsüz kartlar "Okuma rafı"nda toplanır.
const kartKlasoru = (k) => belgeBul(k.belgeId)?.klasor || null;
function kaynakAd(k) {
  const b = belgeBul(k.belgeId), kl = b?.klasor && KLASORLER.find((x) => x.id === b.klasor);
  return kl?.ad || b?.ad || k.belgeAd || k.deste || "";
}
const dortMu = () => store.ayarlar.tekrarDegerlendirme === "dort";
function kaynakSatiri(k, { tur = true } = {}) {
  const parca = [];
  if (tur) parca.push(TUR_AD[k.tur] || t("Kart"));
  const ad = kaynakAd(k);
  if (ad) parca.push(ad);
  if (k.sayfa) parca.push(t("S. {n}", { n: k.sayfa }));
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

  const kok = h("div", { class: "tekrar", lang: dil, dataset: { gorunum: "deste" } });
  D = {
    kap, kok, gorunum: "deste", temizle: [], zamanlayicilar: new Set(),
    deste: null, sinav: null, sonuc: null, liste: { tur: "tumu", kutu: null }, fis: null,
  };

  // Üst şerit
  const geri = h("button", { class: "ikon-dugme tekrar-geri", type: "button", onclick: geriBas }, icon("geri"));
  const baslik = h("h1", {}, t("Bugünün destesi"));
  const alt = h("span", { class: "olcum tekrar-alt" });
  const gostergeKap = h("div", { class: "leitner-kap" });
  const sinavDugme = h("button", { class: "metin-dugme tekrar-sinav", type: "button", onclick: sinavDugmesi },
    icon("kronometre", "i-20"), h("span", {}, t("Sınav")));
  const listeDugme = h("button", { class: "ikon-dugme", type: "button", "aria-label": t("Kart listesi"), title: t("Kart listesi"), "aria-pressed": "false",
    onclick: () => (D.gorunum === "liste" ? desteyeDon() : listeyiAc()) }, icon("liste"));
  // 7.0: yeni kart, istatistik ve ⋯ menüsü; hepsi tek cam kapsülde (TASARIM-5 6.9)
  const yeniDugme = h("button", { class: "ikon-dugme tk-yeni-dugme", type: "button", "aria-label": t("Yeni kart"), title: t("Yeni kart (N)"),
    onclick: () => kartPenceresiAc() }, icon("arti"));
  const istatistikDugme = h("button", { class: "ikon-dugme tk-istatistik-dugme", type: "button", "aria-label": t("İstatistikler"), title: t("İstatistikler"),
    "aria-pressed": "false", onclick: () => (D.gorunum === "istatistik" ? desteyeDon() : istatistikAc()) }, icon("istatistik"));
  const menuDugme = h("button", { class: "ikon-dugme tk-menu-dugme", type: "button", "aria-label": t("Diğer"), title: t("Diğer"),
    "aria-haspopup": "menu", "aria-expanded": "false", onclick: (e) => tekrarMenusu(e.currentTarget) }, icon("daha"));
  const eylemler = h("div", { class: "tk-eylemler", role: "toolbar", "aria-label": t("Tekrar araçları") },
    yeniDugme, sinavDugme, h("i", { class: "tk-ayrac", "aria-hidden": "true" }), istatistikDugme, listeDugme, menuDugme);
  const bosluk = h("span", { class: "bosluk" });
  const ustSerit = h("header", { class: "tekrar-ust" },
    geri, h("div", { class: "tekrar-baslik" }, baslik, alt), bosluk, gostergeKap, eylemler);
  const govde = h("div", { class: "tekrar-govde" });
  kok.append(ustSerit, govde);
  Object.assign(D, { geri, baslik, alt, bosluk, gostergeKap, sinavDugme, listeDugme, istatistikDugme, menuDugme, yeniDugme, govde });

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
  // Deste ayarı değişince: değerlendirme kipi ve günlük yeni sınırı ekranda hemen görünür
  let onceki = ayarImzasi();
  D.temizle.push(bus.on("ayarlar", () => {
    const simdi = ayarImzasi();
    if (simdi === onceki || !D) return;
    onceki = simdi;
    if (D.gorunum === "deste" && !D.deste?.cevap.length && !D.deste?.ozel && !D.kart?.acik) desteBaslat();
    else if ((D.gorunum === "deste" || D.gorunum === "sinav") && D.kart && !D.kart.acik) sahneCiz();
    else if (D.gorunum === "deste" && !D.kart) sahneCiz();   // bitiş ekranı: "N kartı çalış" sayısı yeni sınırla tazelenir
    else ustGuncelle();
  }));
  const is = bekleyen;
  bekleyen = null;
  if (is === "istatistik") istatistikAc();
  else if (is === "liste-askida") listeyiAc({ tur: "askida" });
}
const ayarImzasi = () => [store.ayarlar.tekrarDegerlendirme, store.ayarlar.tekrarGunlukYeni, store.ayarlar.tekrarHedef].join("|");

export function kapat() {
  if (!D) return;
  fisKapat(true);
  sheetKapat(true);
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
  D.istatistikDugme.setAttribute("aria-pressed", String(gorunum === "istatistik"));
  for (const b of [D.listeDugme, D.istatistikDugme, D.yeniDugme]) b.hidden = sinavda;
  D.kok.querySelector(".tk-ayrac").hidden = sinavda;
  D.sinavDugme.lastChild.textContent = sinavda ? t("Bitir") : t("Sınav");
  D.sinavDugme.setAttribute("aria-label", sinavda ? t("Sınavı bitir") : t("Sınav"));
  D.geri.setAttribute("aria-label", gorunum === "deste" ? t("Kitaplığa dön") : sinavda ? t("Sınavı bırak") : t("Desteye dön"));

  if (gorunum === "liste") {
    D.baslik.textContent = D.liste.tur === "askida" ? t("Askıdaki kartlar") : t("Kart listesi");
    const n = store.kartlar.length, b = bugunTekrar().length, a = store.kartlar.filter((k) => k.askida).length;
    olcumYaz(D.alt, `${t("{n} kart", { n })} · ${t("bugün {n}", { n: b })}` + (a ? ` · ${t("askıda {n}", { n: a })}` : ""));
  } else if (gorunum === "istatistik") {
    D.baslik.textContent = t("İstatistikler");
    const otuz = gunBasi(Date.now(), -29);
    let c = 0;
    for (const k of store.kartlar) for (const g of k.gecmis || []) if (g?.zaman >= otuz) c++;
    olcumYaz(D.alt, `${t("{n} kart", { n: store.kartlar.length })} · ${t("son 30 günde {n} cevap", { n: c })}`);
  } else if (sinavda || gorunum === "sonuc") {
    const s = sinavda ? D.sinav : D.sonuc;
    D.baslik.textContent = t("{ad} · Sınav", { ad: s.ad });
    olcumYaz(D.alt, sinavda
      ? `${t("{n} kart", { n: s.ids.length })} · ${s.sinir ? t("süre sınırı {n} dk", { n: s.sinir / 60e3 }) : t("süre sınırı yok")}`
      : `${t("{n} kart", { n: s.ids.length })} · ${t("bitti")}`);
  } else {
    const d = D.deste;
    D.baslik.textContent = d?.ad || t("Bugünün destesi");
    const kalan = d ? d.ids.length - d.sira : 0, bekleyen = bugunTekrar().length;
    // Kitaplıktaki sayaçla aynı dil: bekleyen varsa sayısı, yoksa "Bugünlük bitti"
    olcumYaz(D.alt, kalan > 0
      ? t("{n} kart · yaklaşık {d} dk", { n: kalan, d: Math.max(1, Math.round((kalan * KART_SN) / 60)) })
      : bekleyen ? t("{n} kart bekliyor", { n: bekleyen }) : store.kartlar.length ? t("Bugünlük bitti") : t("Henüz kart yok"));
  }
  if (gorunum === "istatistik") D.gostergeKap.replaceChildren();
  else D.gostergeKap.replaceChildren(sinavda ? D.sinav.cam : D.leitnerEl);
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
  const cam = h("div", { class: "leitner cam", role: "group", "aria-label": t("Leitner kutuları") });
  for (let n = 1; n <= 5; n++) {
    const b = h("b", {}, "0");
    const k = h("button", { class: "kanal", type: "button", onclick: () => listeyiAc({ kutu: n }) }, h("i"), b);
    kanallar.push({ el: k, b });
    cam.append(k);
  }
  const olcek = h("div", { class: "leitner-olcek", "aria-hidden": "true" }, ...ROMA.slice(1).map((r) => h("span", {}, r)));
  D.olcek = olcek;
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
    el.setAttribute("aria-label", t("{r}. kutu, {n} kart, {aralik}", { r: ROMA[n], n: c, aralik: kutuAralikMetni(n) }));
    if (n === simdi) el.dataset.simdi = ""; else delete el.dataset.simdi;
    // Etkin kutunun Roma rakamı vurgu renginde (TASARIM-5 8.4.2)
    const r = D.olcek?.children[i];
    if (r) { if (n === simdi) r.dataset.simdi = ""; else delete r.dataset.simdi; }
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
  if (D.gorunum === "liste" || D.gorunum === "sonuc" || D.gorunum === "istatistik") {
    D.bosluk.after(D.gostergeKap);
    ustGuncelle(); gostergeGuncelle();
    return D.gorunum === "liste" ? listeCiz() : D.gorunum === "istatistik" ? istatistikCiz() : sonucCiz();
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
    // Kartın arkasında tek ışık lekesi (TASARIM-5 8.4.3): kap durağan, kart itilirken leke yerinde kalır
    sahne.append(h("div", { class: "tk-kart-kap" }, kart.el), cevap.el, ipucu);
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
  const dort = c.cevap.dort;
  c.ipucu.textContent = !c.acik ? ""
    : dort ? (klavye ? t("Sola it: Tekrar · Sağa it: İyi · Tuşlar 1 ile 4") : t("Sola it: Tekrar · Sağa it: İyi"))
    : (klavye ? t("Sola it ya da 1: Bilemedim · Sağa it ya da 2: Bildim") : t("Sola it: Bilemedim · Sağa it: Bildim"));
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
    tabindex: "0", role: "group", "aria-roledescription": ingilizceMi ? "card" : "kart",
    "aria-label": ((p) => (k.ters ? t("{tur} kartı (ters), {r}. kutu", p) : t("{tur} kartı, {r}. kutu", p)))({ tur: TUR_AD[k.tur] || t("Kart"), r: ROMA[k.kutu || 1] }),
  });
  // Kaynak satırı: düğme, belgeyi o sayfada açar. Sınavda yalnız tür yazar.
  const kaynak = sinav
    ? h("span", { class: "kart-kaynak etiket-sayfa" }, ust(TUR_AD[k.tur] || t("Kart")))
    : h("button", { class: "kart-kaynak etiket-sayfa", type: "button", "aria-label": t("Kaynağa git: {kaynak}", { kaynak: kaynakSatiri(k, { tur: false }) }),
        onclick: (e) => { e.stopPropagation(); kaynagaGit(k); } }, kaynakSatiri(k));

  const desen = BANT_IDLER.has(k.bant) ? k.bant : "murekkep";
  const bantKap = h("div", { class: "kart-bant-kap", "aria-hidden": "true" },
    h("div", { class: "kart-bant", dataset: { bant: desen } }), h("div", { class: "kart-bant-uc" }));

  let yuz;
  if (gorselli) {
    // Görsel kart: ön ve arka aynı yerde üst üste, açılınca çapraz geçer
    const on = h("img", { class: "kart-on", src: k.on.gorsel, alt: t("Ön yüz"), draggable: "false" });
    const arka = k.arka?.gorsel && !k.arka?.metin
      ? h("img", { class: "kart-cevap", src: k.arka.gorsel, alt: t("Arka yüz"), draggable: "false" })
      : yuzIcerik(k.arka, "kart-cevap");
    yuz = h("div", { class: "kart-yuz gorsel" }, on, arka, bantKap);
    for (const img of yuz.querySelectorAll("img")) img.addEventListener("load", bantYerlestir);
  } else if (k.tur === "bosluk" && k.bosluk?.n && boslukVarMi(k.on?.metin)) {
    // Boşluk doldurma: önde cümle ve [...]; açılınca boşluk vurgulu cevapla dolar, bandın altında cevap ve ek bilgi
    const n = k.bosluk.n, tum = k.on.metin;
    const m = h("div", { class: "kart-metin tk-bosluk-metin" + (boslukMetni(tum, n).length > 110 ? " uzun" : "") }, boslukDom(tum, n));
    if (matematikVarMi(tum)) matematikCiz(m).catch(() => {});
    const soru = h("div", { class: "kart-soru" }, k.on.gorsel ? h("img", { class: "kart-gorsel", src: k.on.gorsel, alt: "", draggable: "false" }) : null, m);
    const cevap = yuzIcerik({ metin: boslukCevabi(tum, n) }, "kart-cevap");
    if (k.arka?.metin || k.arka?.gorsel) {
      const ek = [...yuzIcerik(k.arka, "kart-ek").childNodes];
      for (const c of ek) c.classList.add("kart-ek");
      cevap.append(...ek);
    }
    yuz = h("div", { class: "kart-yuz metinli" }, soru, h("div", { class: "kart-cevap-alan" }, cevap, bantKap));
  } else {
    // Metin kartı: üstte soru, altta bantla örtülü cevap
    const soru = yuzIcerik(k.on, "kart-soru");
    if (k.tur === "kelime" && !k.ters) soru.querySelector(".kart-metin")?.classList.replace("kart-metin", "kart-kelime");
    const cevap = yuzIcerik(k.arka, "kart-cevap");
    yuz = h("div", { class: "kart-yuz metinli" }, soru, h("div", { class: "kart-cevap-alan" }, cevap, bantKap));
  }
  // Kart başı: solda kaynak, sağda cevap tarafında kalem ve kart menüsü (sınavda ve küçük kartta yok)
  const araclar = !sinav && !kucuk ? h("div", { class: "kart-araclar" },
    h("button", { class: "tk-kart-arac tk-kart-duzenle", type: "button", "aria-label": t("Kartı düzenle"), title: t("Düzenle (E)"),
      onclick: (e) => { e.stopPropagation(); kartPenceresiAc({ kart: k }); } }, icon("duzenle", "i-20")),
    h("button", { class: "tk-kart-arac tk-kart-menu", type: "button", "aria-label": t("Kart menüsü"), "aria-haspopup": "menu", "aria-expanded": "false",
      onclick: (e) => { e.stopPropagation(); kartMenusu(e.currentTarget, k); } }, icon("daha", "i-20"))) : null;
  el.append(h("div", { class: "kart-ust" }, kaynak, araclar), yuz);
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
    if (e.button > 0 || e.target.closest(".kart-kaynak, .kart-ust button")) return;
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
    if (Date.now() - sonSurukleme < 350 || e.target.closest(".kart-kaynak, .kart-ust button")) return;
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
  for (const b of c.cevap.dereceler) { b.inert = false; b.disabled = false; }
  if (odakGosterde) (c.cevap.dort ? c.cevap.dereceler[2] : c.cevap.bildim).focus({ preventScroll: true });
  c.el.setAttribute("aria-label", c.el.getAttribute("aria-label") + t(", açık"));
  ipucuYaz();
}

// Aralık yazısı: iki düğmede "4 gün sonra" (7.0 öncesiyle aynı), dört düğmede kısa ("4 gün", "2 ay")
function aralikMetni(g, kisa = false) {
  if (g <= 0) return kisa ? t("Bugün") : t("Bugün yeniden");
  if (g === 1) return t("Yarın");
  if (!kisa) return t("{g} gün sonra", { g });
  if (g < 45) return t("{g} gün", { g });
  if (g < 365) return t("{n} ay", { n: Math.round(g / 30) });
  const yil = (g / 365).toFixed(1);
  return t("{n} yıl", { n: ingilizceMi ? yil.replace(/\.0$/, "") : yil.replace(".", ",").replace(",0", "") });
}

// Ön yüzde tek düğme: Cevabı göster. Çevrilince yerine değerlendirme düğmeleri gelir (yalnız opaklık, 240ms).
// İki düğme (Bilemedim, Bildim) ya da dört (Tekrar, Zor, İyi, Kolay: TASARIM-5 11.5 R4). Sınav her zaman iki düğmelidir.
function cevapDugmeleri(k) {
  const sinav = D.gorunum === "sinav";
  const dort = !sinav && dortMu();
  const klavye = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const tus = (t) => (klavye ? h("kbd", { "aria-hidden": "true" }, t) : null);
  const goster = h("button", { class: "goster", type: "button", onclick: () => cevir() },
    h("span", {}, t("Cevabı göster")), klavye ? h("small", {}, BOSLUK_TUSU) : null);
  if (dort) {
    const DERECE = [["bilemedim", TEKRAR_DUGME], ["zor", t("Zor")], ["bildim", t("İyi")], ["kolay", t("Kolay")]];
    const dereceler = DERECE.map(([sinif, ad], i) => h("button", { class: `${sinif} tk-derece`, type: "button", disabled: true, inert: true,
      "aria-label": `${ad}, ${aralikMetni(fsrsHesapla(k, i + 1).aralik)}`, onclick: () => cevapla(i + 1) },
      h("span", {}, ad), h("small", {}, aralikMetni(fsrsHesapla(k, i + 1).aralik, true)), tus(String(i + 1))));
    return { el: h("div", { class: "tekrar-cevap dort" }, goster, ...dereceler), goster, dereceler, dort,
      bilemedim: dereceler[0], bildim: dereceler[2] };
  }
  // FSRS: "Bildim"in gerçek aralığı (kart değişmeden hesaplanır)
  const g = fsrsHesapla(k, true).aralik;
  const bilemedim = h("button", { class: "bilemedim", type: "button", disabled: true, inert: true, onclick: () => cevapla(false) },
    h("span", {}, t("Bilemedim")), h("small", {}, sinav ? t("Kutu I'e döner") : t("Bugün yeniden")), tus("1"));
  const bildim = h("button", { class: "bildim", type: "button", disabled: true, inert: true, onclick: () => cevapla(true) },
    h("span", {}, t("Bildim")), h("small", {}, sinav ? t("Takvim değişmez") : aralikMetni(g)), tus("2"));
  return { el: h("div", { class: "tekrar-cevap" }, goster, bilemedim, bildim), goster, bilemedim, bildim, dereceler: [bilemedim, bildim], dort: false };
}

// Deste: FSRS takvimini günceller. Sınav: yalnız bilinemeyen kart I. kutuya döner, bilinenin takvimi değişmez.
// cevap: true/false (iki düğme; ortak.js 3 ve 1 sayar, aralıklar 7.0 öncesiyle aynı) ya da 1..4 (dört düğme)
function cevapla(cevap, { itme = false } = {}) {
  const c = D?.kart;
  if (!c || !c.acik || c.kilit) return;
  c.kilit = true;
  const sinav = D.gorunum === "sinav";
  const akis = sinav ? D.sinav : D.deste;
  const eski = c.k.kutu || 1;
  const derece = cevap === true ? 3 : cevap === false ? 1 : cevap;
  const bildi = derece >= 2;
  if (!sinav || !bildi) kartCevapla(c.k.id, typeof cevap === "boolean" ? cevap : derece);
  const yeni = c.k.kutu || 1;   // FSRS aralığından türeyen kutu
  akis.cevap.push({ id: c.k.id, bildi, derece });
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
  toast(t("Kart silindi"), { etiket: t("Geri al"), calistir: () => {
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
  let baslik = kalan ? t("Bu tur bitti.") : t("Bugünlük bu kadar."), satir;
  if (oturum) satir = `${t("{n} kart", { n: d.cevap.length })} · ${t("{n} bildin", { n: bildi })} · ${yarin ? t("yarın {n}", { n: yarin }) : t("yarın boş")}`;
  else if (!store.kartlar.length) { baslik = t("Henüz kart yok."); satir = t("Masa’da bir cevabın üstüne bant koy ya da Koltuk’ta bir kelimeyi karta ekle."); }
  else {
    const en = Math.min(...store.kartlar.map((k) => k.sonraki));
    const g = Math.max(1, gunFarki(en));
    satir = yarin ? `${t("Bugün kart yok")} · ${t("yarın {n}", { n: yarin })}` : t("Sıradaki kart {g} gün sonra", { g });
  }
  const tahta = h("div", { class: "bitis" + (oturum ? " oturum" : ""), role: "status" },
    oturum ? oturumHalkasi(d.cevap.length, bildi) : h("span", { class: "tk-bos-simge", "aria-hidden": "true" }, icon(store.kartlar.length ? "tik" : "deste")),
    h("h2", {}, baslik), h("p", {}, satir));
  // Yazılıyor duygusu: örtü sağa çekilir (yalnız oturum bitince)
  if (oturum && !hareketAz()) tahta.append(h("div", { class: "ortu", "aria-hidden": "true" }));
  // Boş durum tek düğme verir (TASARIM-4 3.5): kart yoksa "Nasıl yapılır", bugünlük bittiyse "Yine de çalış"
  const kartYok = !store.kartlar.length;
  const birincil = kartYok
    ? h("button", { class: "birincil", type: "button", onclick: () => import("./rehber.js").then((m) => m.rehberBaslat(0)) }, t("Nasıl yapılır"))
    : !oturum && !kalan ? h("button", { class: "birincil", type: "button", onclick: () => desteBaslat(store.kartlar.slice().sort((a, b) => a.sonraki - b.sonraki).slice(0, 20).map((k) => k.id), t("Erken çalışma")) }, t("Yine de çalış"))
    : null;
  if (!kartYok && !oturum && !kalan) satir += t(". İstersen erken çalışabilirsin.");
  tahta.querySelector("p").textContent = satir;
  const eylem = h("div", { class: "bitis-eylem" }, birincil,
    kartYok ? h("button", { class: "metin-dugme", type: "button", onclick: () => kartPenceresiAc() }, icon("arti", "i-20"), t("Yeni kart")) : null,
    kartYok ? h("button", { class: "metin-dugme", type: "button", onclick: () => ankiSec() }, icon("indir", "i-20"), t("Anki destesi")) : null,
    kartYok ? null : h("button", { class: "metin-dugme", type: "button", onclick: () => listeyiAc() }, icon("liste", "i-20"), t("Kart listesi")),
    h("button", { class: "metin-dugme", type: "button", onclick: () => bus.emit("git", { ekran: "kitaplik" }) }, t("Kitaplığa dön")));
  // Bilinemeyenler I. kutuda, bugün yeniden bekliyor
  if (oturum && kalan) eylem.prepend(h("button", { class: "metin-dugme vurgulu", type: "button", onclick: () => desteBaslat() },
    icon("yeniden", "i-20"), d.ozel ? t("Bugünün {n} kartını çalış", { n: kalan }) : t("{n} kartı yeniden çalış", { n: kalan })));
  return [tahta, eylem];
}

// Oturum sonu (TASARIM-5 8.4.6): büyük sayı ve ilerleme halkası; halka bilinen oranı kadar dolar, ışık izi gradyanıyla
// (#vurgu-iz, index.html). Dolum ve tek ışıma 600 ms; sade harekette anında. Konfeti yok.
function oturumHalkasi(toplam, bildi) {
  const ns = "http://www.w3.org/2000/svg", R = 54, C = 2 * Math.PI * R;
  const oran = toplam ? bildi / toplam : 0;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 132 132");
  svg.setAttribute("aria-hidden", "true");
  const daire = (sinif) => {
    const c = document.createElementNS(ns, "circle");
    for (const [a, v] of Object.entries({ cx: 66, cy: 66, r: R, class: sinif })) c.setAttribute(a, v);
    return c;
  };
  // Işık izi: #vurgu-iz (index.html) userSpaceOnUse ve x2="100%"; yüzde, sprite'ın 0x0 görüntü alanından çözüldüğü için
  // Chromium'da tek renge iner. Halka kendi kutusuna göre (objectBoundingBox) aynı iki durağı taşır, renkler yine token.
  const gid = "tk-halka-iz-" + Math.random().toString(36).slice(2, 7);
  const grad = document.createElementNS(ns, "linearGradient");
  grad.id = gid;
  for (const [a, v] of Object.entries({ x1: "0", y1: "0", x2: "1", y2: "1" })) grad.setAttribute(a, v);
  for (const [o, v] of [["0", "--vurgu-1"], ["1", "--vurgu-2"]]) {
    const st = document.createElementNS(ns, "stop");
    st.setAttribute("offset", o);
    st.setAttribute("style", `stop-color: var(${v})`);
    grad.append(st);
  }
  const defs = document.createElementNS(ns, "defs");
  defs.append(grad);
  const ray = daire("tk-halka-ray"), isik = daire("tk-halka-isik"), dolum = daire("tk-halka-dolum");
  dolum.style.stroke = `url(#${gid})`;
  for (const c of [isik, dolum]) {
    c.setAttribute("stroke-dasharray", `${C.toFixed(2)} ${C.toFixed(2)}`);
    c.style.setProperty("--bos", (C * (1 - oran)).toFixed(2));
    c.style.setProperty("--tam", C.toFixed(2));
  }
  svg.append(defs, ray, isik, dolum);
  return h("div", { class: "tk-halka" + (oran >= 0.999 ? " tam" : "") }, svg,
    h("div", { class: "tk-halka-ic" }, h("b", { class: "tk-buyuk-sayi" }, String(toplam)), h("span", {}, ingilizceMi ? (toplam === 1 ? "card" : "cards") : "kart")),
    h("span", { class: "tk-halka-oran" }, t("%{n} bildin", { n: Math.round(oran * 100) })));
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
  const raf = { id: "raf", ad: t("Okuma rafı"), renk: "#5A1A22", ids: [] };
  // Belgesiz ve destesi olan kartlar (Anki'den gelen, elle "Destesiz" değil) kendi destelerinde toplanır
  const desteler = new Map();
  for (const k of store.kartlar) {
    if (!belgeBul(k.belgeId) && k.deste) {
      if (!desteler.has(k.deste)) desteler.set(k.deste, { id: "deste:" + k.deste, ad: k.deste, renk: null, deste: true, ids: [] });
      desteler.get(k.deste).ids.push(k.id);
      continue;
    }
    const g = gruplar.find((x) => x.id === kartKlasoru(k)) || raf;
    g.ids.push(k.id);
  }
  if (raf.ids.length) gruplar.push(raf);
  gruplar.push(...desteler.values());
  gruplar.push({ id: "hepsi", ad: t("Bütün kartlar"), renk: null, ids: store.kartlar.map((k) => k.id) });
  return gruplar;
}

function sinavFisiAc(dersId = null) {
  if (D.fis) return fisKapat();
  const gruplar = dersler();
  let secili = gruplar.find((g) => g.id === dersId && g.ids.length) || gruplar.find((g) => g.ids.length && g.id !== "hepsi") || gruplar[gruplar.length - 1];
  let sure = 0;
  const baslat = h("button", { class: "birincil", type: "button" }, icon("kronometre", "i-20"), t("Sınavı başlat"));
  const satirlar = gruplar.map((g) => {
    const s = h("button", { class: "fis-satir sinav-ders", type: "button", role: "radio", disabled: !g.ids.length,
      "aria-checked": String(g === secili), onclick: () => { secili = g; guncelle(); s.focus(); } },
      g.renk ? h("i", { class: "kumas-sekme", style: `--c:${g.renk}` }) : icon(g.deste ? "deste" : "tumu", "i-20"),
      h("span", {}, g.ad), h("span", { class: "t-deger-k" }, t("{n} kart", { n: g.ids.length })));
    s._g = g;
    return s;
  });
  // Görsel durum CSS'te aria-pressed'e bağlı; radyo anlamı için aria-checked de yazılır
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": t("Süre sınırı") },
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

  const dersGrup = h("div", { role: "radiogroup", "aria-label": t("Ders") }, ...satirlar);
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis", role: "dialog", "aria-modal": "true", "aria-label": t("Sınav"), tabindex: "-1" },
    h("div", { class: "fis-baslik" }, t("Hangi dersten?")),
    dersGrup,
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, t("Süre sınırı")), parcali),
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
  const cam = h("div", { class: "kronometre cam kehribar", role: "timer", "aria-label": t("Sınav süresi") });
  const gosterge = h("span", { class: "t-gosterge" }, "00:00");
  const sira = h("span", { class: "sira" });
  const son = h("span", { class: "t-daktilo son-dakika", hidden: true }, t("Son dakika"));
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
  return `<svg class="galvanometre" viewBox="0 0 220 132" role="img" aria-label="${t("Skor yüzde {n}", { n: yuzde })}">
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
  const fis = h("div", { class: "sonuc-fis nesne-acik", role: "region", "aria-label": t("{ad} sınavının sonucu", { ad: s.ad }) });
  fis.insertAdjacentHTML("beforeend", galvanometre(oran));
  fis.append(h("p", { class: "sonuc-yuzde" }, t("%{n}", { n: Math.round(oran * 100) })),
    h("p", { class: "sonuc-alt" }, `${t("{n} / {top} doğru", { n: s.bildi, top })} · ${sureMetni(s.sure)}`));
  const notlar = [];
  if (s.cevapsiz) notlar.push(s.sureDoldu ? t("Süre doldu, {n} kart cevapsız kaldı.", { n: s.cevapsiz }) : t("Erken bitirdin, {n} kart cevapsız kaldı.", { n: s.cevapsiz }));
  if (s.donen) notlar.push(t("{n} kart Kutu I'e döndü.", { n: s.donen }));
  for (const not of notlar) fis.append(h("p", { class: "sonuc-not" }, not));
  const yanlis = s.bilemedi.map(kartBul).filter(Boolean);
  if (yanlis.length) {
    // Satırın tamamı kaynağa giden tek düğme
    fis.append(h("p", { class: "etiket-sayfa sonuc-etiket" }, t("Bilemediklerin")),
      h("ul", { class: "sonuc-liste" }, ...yanlis.map((k) => h("li", {},
        h("button", { class: "sonuc-satir", type: "button", onclick: () => kaynagaGit(k), "aria-label": `${onMetni(k)}. ${t("Kaynağa git: {kaynak}", { kaynak: kaynakSatiri(k, { tur: false }) })}` },
          h("span", { class: "on" }, onMetni(k)), h("span", { class: "etiket-sayfa kaynak" }, kaynakKisa(k)), icon("sag", "i-20"))))));
  } else fis.append(h("p", { class: "sonuc-not" }, t("Hepsini bildin.")));
  const eylem = h("div", { class: "sonuc-eylem" });
  if (yanlis.length) eylem.append(h("button", { class: "birincil", type: "button",
    onclick: () => desteBaslat(yanlis.map((k) => k.id), t("Bilemediklerin")) }, icon("yeniden", "i-20"), t("Bilemediklerini tekrar et")));
  eylem.append(h("button", { class: "metin-dugme" + (yanlis.length ? "" : " vurgulu"), type: "button", onclick: () => desteBaslat() }, t("Desteye dön")));
  fis.append(eylem);
  D.govde.replaceChildren(h("div", { class: "tekrar-sahne sonuc" }, fis));
  girisOynat(fis);
}

// ======================================================================
// Kart listesi (§6.7)
// ======================================================================
function listeyiAc({ kutu = null, tur = "tumu" } = {}) {
  if (D.gorunum === "sinav") return;
  fisKapat(true);
  D.liste = { tur, kutu };
  D.gorunum = "liste";
  sahneCiz();
}

// ---------- istatistikler (R5; çizim tekrar-istatistik.js) ----------
function istatistikAc() {
  if (!D || D.gorunum === "sinav") return;
  fisKapat(true);
  D.gorunum = "istatistik";
  sahneCiz();
}
function istatistikCiz() {
  const kaydirma = D.govde.querySelector(".tk-ist-kaydir")?.scrollTop || 0;
  const kap = h("div", { class: "tk-ist-kaydir tk-kaydir" }, istatistikOlustur(store.kartlar));
  D.govde.replaceChildren(kap);
  kap.scrollTop = kaydirma;
}

function onMetni(k) {
  if (k.tur === "bosluk" && k.bosluk?.n && k.on?.metin) return boslukMetni(k.on.metin, k.bosluk.n);
  if (k.on?.metin) return k.on.metin;
  if (k.arka?.metin) return k.arka.metin;
  const ad = kaynakAd(k) || t("Belge");
  return k.tur === "kirpinti" ? t("{ad} kırpıntısı", { ad }) : t("{ad} bandı", { ad });
}
// Listedeki küçük fiş: görsel kartta ön yüz, metin kartında çizgili boş fiş
function miniOlustur(k) {
  const gorsel = k.on?.gorsel || k.arka?.gorsel;
  return gorsel ? h("img", { class: "mini", src: gorsel, alt: "", loading: "lazy" }) : h("span", { class: "mini mini-metin", "aria-hidden": "true" });
}
const kaynakKisa = (k) => [kaynakAd(k), k.sayfa ? t("s. {n}", { n: k.sayfa }) : ""].filter(Boolean).join(" · ");

function listeCiz() {
  const { tur, kutu } = D.liste;
  const tumu = store.kartlar.filter((k) => kutu == null || (k.kutu || 1) === kutu);
  const say = (id) => (id === "tumu" ? tumu.length : id === "askida" ? tumu.filter((k) => k.askida).length : tumu.filter((k) => k.tur === id).length);
  // Boşluk ve Askıda sekmeleri yalnız kartı varken (ya da seçiliyken) görünür
  const sekmeler = h("div", { class: "sekmeler tekrar-sekmeler", role: "tablist", "aria-label": t("Kart türü") },
    ...TURLER.filter(([id]) => !["bosluk", "askida"].includes(id) || id === tur || say(id)).map(([id, ad]) =>
      h("button", { class: "sekme" + (id === "askida" ? " tk-sekme-aski" : ""), type: "button", role: "tab", "aria-selected": String(id === tur),
        onclick: () => { D.liste.tur = id; ustGuncelle(); listeCiz(); } }, ad, h("span", { class: "sekme-sayi" }, String(say(id))))));
  if (kutu != null) sekmeler.append(h("button", { class: "metin-dugme kutu-suzgec", type: "button",
    "aria-label": t("{r}. kutu süzgecini kaldır", { r: ROMA[kutu] }), onclick: () => { D.liste.kutu = null; listeCiz(); } },
    h("span", { class: "cam cam-k" }, ROMA[kutu]), t("Kutu"), icon("kapat", "i-20")));

  const kartlar = tumu.filter((k) => tur === "tumu" || (tur === "askida" ? k.askida : k.tur === tur)).sort((a, b) => a.sonraki - b.sonraki);
  const simdi = Date.now();
  const liste = h("div", { class: "kart-liste", role: "tabpanel" });
  const ic = h("ul", { class: "kart-liste-ic" });
  for (const k of kartlar) {
    const mini = miniOlustur(k);
    const kalanGun = gunFarki(k.sonraki, simdi);
    // Silme anında yapılır, "Geri al" bildirimiyle geri gelir (TASARIM-4 3.6)
    const sil = h("button", { class: "ikon-dugme kart-sil", type: "button", "aria-label": t("Kartı sil") }, icon("sil", "i-20"));
    sil.addEventListener("click", (e) => { e.stopPropagation(); kartSilGeriAlinir(k); });
    const duzenle = h("button", { class: "ikon-dugme kart-duzenle", type: "button", "aria-label": t("Kartı düzenle"),
      onclick: (e) => { e.stopPropagation(); kartPenceresiAc({ kart: k }); } }, icon("duzenle", "i-20"));
    // Askıdaki kartta kutu yerine "Askıdan al"
    const sag = k.askida
      ? h("button", { class: "metin-dugme tk-askidan-al", type: "button", "aria-label": t("Askıdan al: {on}", { on: onMetni(k) }), onclick: () => askidanAl(k) }, t("Askıdan al"))
      : h("span", { class: "cam cam-k", role: "img", "aria-label": t("{r}. kutu", { r: ROMA[k.kutu || 1] }) }, ROMA[k.kutu || 1]);
    ic.append(h("li", { class: "kart-satir" + (k.askida ? " askida" : "") },
      mini,
      h("span", { class: "on-kap" }, h("span", { class: "on", title: onMetni(k) }, onMetni(k)),
        h("small", {}, [TUR_AD[k.tur] || t("Kart"), k.ters ? t("ters") : null, k.on?.metin || k.arka?.metin ? kaynakAd(k) : null,
          k.askida ? t("askıda") : kalanGun <= 0 ? t("bugün") : kalanGun === 1 ? t("yarın") : t("{g} gün sonra", { g: kalanGun })].filter(Boolean).join(" · "))),
      k.belgeId && belgeBul(k.belgeId)
        ? h("button", { class: "kaynak", type: "button", onclick: () => kaynagaGit(k), "aria-label": t("Kaynağa git: {kaynak}", { kaynak: kaynakSatiri(k, { tur: false }) }) }, k.sayfa ? t("s. {n}", { n: k.sayfa }) : t("Aç"))
        : h("span", { class: "kaynak", "aria-hidden": "true" }),
      sag, duzenle, sil));
  }
  if (!kartlar.length) ic.append(h("li", { class: "kart-liste-bos" }, tur === "askida" ? t("Askıda kart yok. Bir kartı çalışırken ⋯ menüsünden askıya alabilirsin.")
    : kutu != null ? t("{r}. kutuda bu türde kart yok.", { r: ROMA[kutu] }) : t("Bu türde kart yok.")));
  // Dışarı: Anki (listedeki ya da bütün kartlar) ve önümüzdeki 14 günün takvimi
  const eylem = store.kartlar.length ? h("div", { class: "kart-liste-eylem" },
    h("button", { class: "metin-dugme", type: "button", "aria-haspopup": "dialog", onclick: (e) => ankiFisiAc(e.currentTarget, kartlar) },
      icon("disa-aktar", "i-20"), t("Anki’ye aktar")),
    h("button", { class: "metin-dugme", type: "button", "aria-haspopup": "dialog", onclick: (e) => takvimFisiAc(e.currentTarget) },
      icon("indir", "i-20"), t("Takvime ekle"))) : null;
  liste.append(...[eylem, ic].filter(Boolean));
  const kaydirma = D.govde.querySelector(".kart-liste")?.scrollTop || 0;
  D.govde.replaceChildren(h("div", { class: "tekrar-liste" }, sekmeler, liste));
  liste.scrollTop = kaydirma;
  zeminUygula();
}

// ---------- Anki ve takvim (OZELLIKLER-8 1.2, 1.3) ----------
const BICIMLER = [["apkg", t("Anki paketi")], ["tsv", t("TSV ve görseller")]];
const BICIM_NOT = {
  apkg: t("Anki, AnkiDroid ve AnkiMobile açar. Görseller pakete girer. Takvim de gelsin diye içe aktarırken “Import any learning progress” seçeneğini aç."),
  tsv: t("Anki’de Dosya > İçe aktar. Görseller zip içinde, OKU.txt yolu anlatır."),
};

function ankiFisiAc(acan, listedekiler) {
  if (D.fis) return fisKapat();
  const hepsi = store.kartlar.slice();
  const secenekler = [];
  if (listedekiler.length && listedekiler.length !== hepsi.length) secenekler.push({ ad: t("Bu listedekiler"), ikon: "liste", kartlar: listedekiler.slice() });
  secenekler.push({ ad: t("Bütün kartlar"), ikon: "tumu", kartlar: hepsi });
  let secili = secenekler[0], bicim = "apkg";
  const aktar = h("button", { class: "birincil", type: "button" }, icon("disa-aktar", "i-20"), h("span", {}, t("Aktar")));
  const not = h("p", { class: "tekrar-fis-not" }, BICIM_NOT[bicim]);
  const satirlar = secenekler.map((o) => {
    const s = h("button", { class: "fis-satir sinav-ders", type: "button", role: "radio", "aria-checked": String(o === secili),
      tabindex: o === secili ? "0" : "-1", onclick: () => { secili = o; guncelle(); s.focus(); } },
      icon(o.ikon, "i-20"), h("span", {}, o.ad), h("span", { class: "t-deger-k" }, t("{n} kart", { n: o.kartlar.length })));
    s._o = o;
    return s;
  });
  const guncelle = () => {
    for (const s of satirlar) { s.setAttribute("aria-checked", String(s._o === secili)); s.tabIndex = s._o === secili ? 0 : -1; }
    not.textContent = BICIM_NOT[bicim];
  };
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": t("Biçim") },
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
    aktar.lastChild.textContent = t("Hazırlanıyor");
    try {
      const { ankiAktar } = await import("./anki.js");
      const sonuc = await ankiAktar(secili.kartlar, { bicim });
      fisKapat(true);
      aktarimBildir(sonuc, bicim === "tsv" ? t("Anki dosyaları indirildi") : t("Anki paketi indirildi"));
    } catch (hata) {
      console.error("[tekrar] Anki aktarımı:", hata);
      toast(t("Anki dosyası hazırlanamadı"));
      aktar.disabled = false;
      aktar.lastChild.textContent = t("Aktar");
    }
  };
  const kartGrup = h("div", { role: "radiogroup", "aria-label": t("Kartlar") }, ...satirlar);
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis tekrar-anki-fis", role: "dialog", "aria-modal": "true", "aria-label": t("Anki’ye aktar"), tabindex: "-1" },
    h("div", { class: "fis-baslik" }, t("Anki’ye aktar")),
    kartGrup,
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, t("Biçim")), parcali, not),
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
  catch (hata) { console.error("[tekrar] takvim:", hata); toast(t("Takvim dosyası hazırlanamadı")); return; }
  finally { acan.disabled = false; }
  if (D.fis || !acan.isConnected) return;
  const gunSayisi = A.takvimGunleri().filter((g) => g.sayi).length;
  let saat = takvimSaati();
  const ekle = h("button", { class: "birincil", type: "button", disabled: !gunSayisi }, icon("indir", "i-20"), h("span", {}, t("Takvime ekle")));
  const saatGir = h("input", { class: "tekrar-saat", type: "time", step: "300", value: saat, "aria-label": t("Başka saat") });
  const parcali = h("div", { class: "parcali", role: "radiogroup", "aria-label": t("Hazır saatler") },
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
      aktarimBildir(sonuc, t("Takvim dosyası indirildi. Açınca {n} güne saat {saat} hatırlatması eklenir.", { n: gunSayisi, saat }));
    } catch (hata) {
      console.error("[tekrar] takvim:", hata);
      toast(t("Takvim dosyası hazırlanamadı"));
      ekle.disabled = false;
    }
  };
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis tekrar-takvim-fis", role: "dialog", "aria-modal": "true", "aria-label": t("Takvime ekle"), tabindex: "-1" },
    h("div", { class: "fis-baslik" }, t("Takvime ekle")),
    h("p", { class: "tekrar-fis-not tekrar-takvim-ozet" }, gunSayisi
      ? t("Önümüzdeki 14 günde {n} gün tekrar var. Yalnız o günlere hatırlatma yazılır.", { n: gunSayisi })
      : t("Önümüzdeki 14 günde vakti gelen kart yok.")),
    h("div", { class: "fis-ayrac" }),
    h("div", { class: "fis-form" }, h("span", { class: "t-daktilo" }, t("Hatırlatma saati")), parcali,
      h("label", { class: "tekrar-saat-satir" }, h("span", {}, t("Başka saat")), saatGir)),
    h("div", { class: "fis-form-alt" }, ekle));
  radyoOklari(parcali);
  fisGoster(fis, acan);
  (parcali.querySelector('[tabindex="0"]') || fis).focus();
}

// paylas() sonucu: paylaşıldıysa ya da vazgeçildiyse sessiz; "bekliyor"da bildirimi paylas kendisi gösterir
function aktarimBildir(sonuc, indirildi) {
  if (sonuc === "indirildi") toast(indirildi);
  else if (sonuc === "kaydedildi") toast(t("Kaydedildi"));
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
  if (D.gorunum === "istatistik") { ustGuncelle(); istatistikCiz(); return; }
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
  if (!D || !D.kok.isConnected || e.ctrlKey || e.metaKey || e.altKey || SH) return;
  if (e.key === "Escape") {
    if (D.fis) { e.preventDefault(); fisKapat(); return; }
    if (D.gorunum === "liste" || D.gorunum === "istatistik") { e.preventDefault(); desteyeDon(); }
    return;
  }
  if (D.fis) return;
  const hedef = e.target instanceof Element ? e.target : null;
  // Asistan paneli açıkken odak oradaysa tuşlar arkadaki karta gitmez
  if (hedef?.closest("input, textarea, select, [contenteditable='true'], .asistan")) return;
  const harf = e.key.toLocaleLowerCase(yerel);
  if (harf === "n" && D.gorunum !== "sinav") { e.preventDefault(); kartPenceresiAc(); return; }
  if (!D.kart || (D.gorunum !== "deste" && D.gorunum !== "sinav")) return;
  const dugme = hedef?.closest("button, a");
  if (e.key === " " || e.code === "Space") {
    if (dugme && !dugme.disabled) return;   // odaktaki düğme kendi işini yapar
    e.preventDefault();
    cevir();
  } else if (harf === "e" && D.gorunum === "deste") { e.preventDefault(); kartPenceresiAc({ kart: D.kart.k }); }
  else if (D.kart.cevap.dort && /^[1-4]$/.test(e.key)) { e.preventDefault(); cevapla(Number(e.key)); }
  else if (e.key === "1") { e.preventDefault(); cevapla(false); }
  else if (e.key === "2") { e.preventDefault(); cevapla(true); }
}

// ======================================================================
// Menüler: ekranın ⋯ menüsü ve kartın menüsü (fiş, TASARIM-5 6.17)
// ======================================================================
function menuSatiri(ikon, ad, fn, { alt, sinif = "", tehlike = false } = {}) {
  return h("button", { class: "fis-satir tk-menu-satir " + sinif + (tehlike ? " tehlike" : ""), type: "button", role: "menuitem",
    onclick: () => { fisKapat(true); fn(); } }, icon(ikon, "i-20"), h("span", {}, ad), alt ? h("small", {}, alt) : null);
}
function menuGoster(acan, satirlar, ad) {
  if (D.fis) { const ayni = D.fis.acan === acan; fisKapat(); if (ayni) return; }
  const fis = h("div", { class: "fis fis-sabit tekrar-sinav-fis tk-menu", role: "menu", "aria-label": ad, tabindex: "-1" }, ...satirlar);
  fis.addEventListener("keydown", (e) => {
    const yon = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!yon) return;
    e.preventDefault();
    const ogeler = [...fis.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = ogeler.indexOf(document.activeElement);
    ogeler[(i + yon + ogeler.length) % ogeler.length]?.focus();
  });
  fisGoster(fis, acan);
  fis.style.width = `${Math.min(300, innerWidth - 32)}px`;
  fis.querySelector('[role="menuitem"]')?.focus();
}
function tekrarMenusu(acan) {
  const askida = store.kartlar.filter((k) => k.askida).length;
  menuGoster(acan, [
    menuSatiri("ayarlar", t("Deste ayarları"), () => desteAyarlariAc(), { sinif: "tk-ayar-dugme" }),
    menuSatiri("aski", t("Askıdaki kartlar"), () => listeyiAc({ tur: "askida" }), { alt: askida ? t("{n} kart", { n: askida }) : t("Yok") }),
    h("div", { class: "fis-ayrac", role: "separator" }),
    menuSatiri("indir", t("Anki destesi içe aktar"), () => ankiSec(), { sinif: "tk-anki-ice" }),
    store.kartlar.length ? menuSatiri("disa-aktar", t("Anki’ye aktar"), () => ankiFisiAc(D.menuDugme, D.gorunum === "liste" ? listedekiler() : store.kartlar.slice())) : null,
    store.kartlar.length ? menuSatiri("kronometre", t("Takvime ekle"), () => takvimFisiAc(D.menuDugme)) : null,
  ].filter(Boolean), t("Tekrar menüsü"));
}
const listedekiler = () => {
  const { tur, kutu } = D.liste;
  return store.kartlar.filter((k) => (kutu == null || (k.kutu || 1) === kutu) && (tur === "tumu" || (tur === "askida" ? k.askida : k.tur === tur)));
};
function kartMenusu(acan, k) {
  const b = k.belgeId && belgeBul(k.belgeId);
  menuGoster(acan, [
    menuSatiri("duzenle", t("Düzenle"), () => kartPenceresiAc({ kart: k }), { alt: "E" }),
    menuSatiri("aski", t("Askıya al"), () => askiyaAl(k), { alt: t("Bugünkü listeye girmez") }),
    b ? menuSatiri("sag", t("Kaynağa git"), () => kaynagaGit(k), { alt: b.ad }) : null,
    h("div", { class: "fis-ayrac", role: "separator" }),
    menuSatiri("sil", t("Kartı sil"), () => { kartSilGeriAlinir(k); }, { tehlike: true }),
  ].filter(Boolean), t("Kart menüsü"));
}

// ---------- askı (R4: kart bugünkü listeye girmez, geçmişi ve takvimi korunur) ----------
function askiyaAl(k) {
  kartGuncelle(k.id, { askida: true });
  if (D?.kart?.k.id === k.id && !D.kart.kilit) {
    const akis = D.gorunum === "sinav" ? D.sinav : D.deste;
    akis.ids.splice(akis.sira, 1);
    sahneCiz();
  }
  toast(t("Kart askıya alındı"), { etiket: t("Geri al"), calistir: () => askidanAl(k, { sessiz: true }) });
}
function askidanAl(k, { sessiz = false } = {}) {
  if (!kartBul(k.id)) return;
  delete k.askida;
  kartGuncelle(k.id, {});
  if (!sessiz) toast(t("Kart yeniden destede"));
}

// ======================================================================
// Sheet (TASARIM-5 6.11): tablette ortada 28 px köşeli cam pencere, telefonda alt sheet. Tekrar ekranı açık olmasa da
// çalışır (komut paletinden "Yeni kart", Koltuk'tan kart:yeni). Odak içeride döner, Esc kapatır, perdeye dokunmak kapatır.
// ======================================================================
let SH = null;
let sheetSayac = 0;
function sheetAc({ baslik, sinif = "", govde = [], alt = null, kapaninca = null, ilkOdak = null }) {
  sheetKapat(true);
  const id = "tk-sheet-" + ++sheetSayac;
  const perde = h("div", { class: "perde tekrar-perde tk-perde", onclick: () => sheetKapat() });
  const sheet = h("div", { class: "tk-sheet " + sinif, role: "dialog", "aria-modal": "true", "aria-labelledby": id, tabindex: "-1", lang: dil },
    h("header", { class: "tk-sheet-ust" }, h("h2", { id, class: "tk-sheet-baslik" }, baslik),
      h("button", { class: "ikon-dugme tk-sheet-kapat", type: "button", "aria-label": t("Kapat"), onclick: () => sheetKapat() }, icon("kapat"))),
    h("div", { class: "tk-sheet-govde tk-kaydir" }, ...govde),
    alt ? h("footer", { class: "tk-sheet-alt" }, ...alt) : null);
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sheetKapat(); return; }
    if (e.key !== "Tab") return;
    const odaklanir = [...sheet.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea, select, [tabindex='0']")]
      .filter((b) => b.tabIndex >= 0 && b.offsetParent !== null && !b.closest("[hidden]"));
    if (!odaklanir.length) return;
    const ilk = odaklanir[0], son = odaklanir[odaklanir.length - 1];
    if (e.shiftKey && (document.activeElement === ilk || document.activeElement === sheet)) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  });
  // Arka plandaki kısayollar (Kitaplık, Koltuk) sheet açıkken çalışmasın
  sheet.addEventListener("keydown", (e) => e.stopPropagation());
  const onceki = document.activeElement;
  if (D) D.kok.inert = true;
  document.body.append(perde, sheet);
  SH = { sheet, perde, onceki, kapaninca };
  (ilkOdak || sheet).focus({ preventScroll: true });
  return SH;
}
function sheetKapat(hemen = false) {
  if (!SH) return;
  const { sheet, perde, onceki, kapaninca } = SH;
  SH = null;
  if (D && !D.fis) D.kok.inert = false;
  try { kapaninca?.(); } catch (hata) { console.error("[tekrar] sheet:", hata); }
  if (hemen || hareketAz()) { sheet.remove(); perde.remove(); }
  else {
    sheet.classList.add("kapaniyor");
    perde.classList.add("gidiyor");
    setTimeout(() => { sheet.remove(); perde.remove(); }, 160);
  }
  if (!hemen && onceki?.isConnected) onceki.focus?.({ preventScroll: true });
}

// Parçalı düğme (radyo grubu): seçenekler [[değer, ad]], seçim değişince fn(değer)
function parcaliKur(ad, secenekler, secili, fn) {
  const grup = h("div", { class: "parcali tk-parcali", role: "radiogroup", "aria-label": ad });
  const isaretle = (deger) => {
    for (const b of grup.children) {
      const evet = b._deger === deger;
      b.setAttribute("aria-checked", String(evet));
      b.setAttribute("aria-pressed", String(evet));
      b.tabIndex = evet ? 0 : -1;
    }
    grup.style.setProperty("--sira", String(Math.max(0, secenekler.findIndex(([d]) => d === deger))));
  };
  // Üçüncü öğe dar ekran adıdır: ikisi de yazılır, CSS genişliğe göre birini gösterir; erişilebilir ad uzun olan
  for (const [deger, metin, kisa] of secenekler) {
    const b = h("button", { type: "button", role: "radio", "aria-label": kisa ? metin : null, onclick: () => { isaretle(deger); b.focus(); fn(deger); } },
      ...(kisa ? [h("span", { class: "tk-uzun" }, metin), h("span", { class: "tk-kisa", "aria-hidden": "true" }, kisa)] : [metin]));
    b._deger = deger;
    grup.append(b);
  }
  grup.style.setProperty("--adet", String(secenekler.length));
  isaretle(secili);
  radyoOklari(grup);
  grup.sec = isaretle;
  return grup;
}
// Açma kapama anahtarı (TASARIM-5 6.6)
function anahtarKur(ad, acik, fn) {
  const b = h("button", { class: "tk-anahtar", type: "button", role: "switch", "aria-checked": String(!!acik), "aria-label": ad,
    onclick: () => { const yeni = b.getAttribute("aria-checked") !== "true"; b.setAttribute("aria-checked", String(yeni)); fn(yeni); } },
    h("i", { "aria-hidden": "true" }));
  return b;
}

// ======================================================================
// Kart penceresi (R2, R3): düzenleme ve elle kart. Ön ve arka yüz: metin, formül önizlemesi, görsel.
// Tür: Soru, Kelime, Boşluk doldurma; deste (belge) ya da Destesiz; Soru ve Kelime'de "Ters kartı da oluştur".
// Düzenleme kartGuncelle ile yapılır: gecmis, fsrs, kutu ve sonraki dokunulmaz (kabul 1).
// ======================================================================
const TUR_SECIM = [["soru", t("Soru")], ["kelime", t("Kelime")], ["bosluk", t("Boşluk doldurma"), ingilizceMi ? "Cloze" : "Boşluk"]];
const yuzKur = (eski, metin, gorsel) => {
  const y = { ...(eski || {}) };
  if (metin) y.metin = metin; else delete y.metin;
  if (gorsel) y.gorsel = gorsel; else delete y.gorsel;
  return y;
};
function desteDegeri(x) {
  if (x?.belgeId && belgeBul(x.belgeId)) return "b:" + x.belgeId;
  if (x?.deste) return "d:" + x.deste;
  return "";
}
function desteCoz(deger) {
  if (deger.startsWith("b:")) { const b = belgeBul(deger.slice(2)); return { belgeId: b?.id || null, belgeAd: b?.ad || "", deste: undefined }; }
  if (deger.startsWith("d:")) return { belgeId: null, belgeAd: "", deste: deger.slice(2) };
  return { belgeId: null, belgeAd: "", deste: undefined };
}
function alanUygula(k, alanlar) {
  for (const [a, v] of Object.entries(alanlar)) if (v === undefined) delete k[a];
  return Object.fromEntries(Object.entries(alanlar).filter(([, v]) => v !== undefined));
}

// Boşluk yap: seçili metni (seçim yoksa imleçteki sözcüğü) {{cN::...}} içine alır; N bir sonraki numara
function boslukYap(ta) {
  const v = ta.value;
  let a = ta.selectionStart ?? v.length, b = ta.selectionEnd ?? v.length;
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  if (a === b) {
    const harf = /[\p{L}\p{N}'’-]/u;
    while (a > 0 && harf.test(v[a - 1])) a--;
    while (b < v.length && harf.test(v[b])) b++;
  }
  const n = Math.max(0, ...boslukNumaralari(v)) + 1;
  const ic = v.slice(a, b);
  ta.focus();
  ta.setRangeText(`{{c${n}::${ic}}}`, a, b, "end");
  if (!ic) { const p = a + `{{c${n}::`.length; ta.setSelectionRange(p, p); }
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

export function kartPenceresiAc({ kart = null, alanlar = {} } = {}) {
  const k = kart ? kartBul(kart.id) : null;
  const kaynak = k || alanlar || {};
  const gorselTur = !!k && (k.tur === "bant" || k.tur === "kirpinti");
  const durum = {
    tur: gorselTur ? k.tur : TUR_SECIM.some(([id]) => id === kaynak.tur) ? kaynak.tur : "soru",
    onGorsel: kaynak.on?.gorsel || null, arkaGorsel: kaynak.arka?.gorsel || null,
    deste: desteDegeri(kaynak), desteDegisti: !k, ters: false, askida: !!k?.askida,
  };
  const tersVar = !!k && store.kartlar.some((x) => x.tersKaynak === k.id);

  // ---- tür ----
  const turGrup = parcaliKur(t("Kart türü"), TUR_SECIM, durum.tur, (tur) => { durum.tur = tur; guncelle(); });
  const turSatir = h("div", { class: "tk-alan" }, h("span", { class: "tk-etiket" }, t("Tür")), turGrup);
  if (gorselTur) turSatir.hidden = true;

  // ---- yüzler ----
  const yuzAlani = (ad, metin, yer, gorselAnahtar) => {
    const id = "tk-ta-" + ++sheetSayac;
    const etiket = h("label", { class: "tk-etiket", for: id }, ad);
    const ta = h("textarea", { id, class: "tk-girdi", rows: "3", placeholder: yer, spellcheck: "true", autocapitalize: "sentences" });
    ta.value = metin || "";
    const gorselImg = h("img", { class: "tk-gorsel-on", alt: "" });
    const gorselKap = h("div", { class: "tk-gorsel" }, gorselImg);
    const dosya = h("input", { type: "file", accept: "image/*", hidden: true });
    const secDugme = h("button", { class: "tk-arac", type: "button", onclick: () => dosya.click() }, icon("gorsel", "i-20"), h("span", {}, t("Görsel ekle")));
    const kaldir = h("button", { class: "tk-arac", type: "button", onclick: () => { durum[gorselAnahtar] = null; guncelle(); } }, icon("sil", "i-20"), h("span", {}, t("Görseli kaldır")));
    dosya.addEventListener("change", async () => {
      const f = dosya.files?.[0];
      dosya.value = "";
      if (!f) return;
      try { const { gorselKucult } = await import("./anki.js"); durum[gorselAnahtar] = await gorselKucult(f); guncelle(); }
      catch (hata) { console.error("[tekrar] görsel:", hata); toast(t("Görsel okunamadı")); }
    });
    const araclar = h("div", { class: "tk-araclar" }, secDugme, kaldir, dosya);
    const onizleme = h("div", { class: "tk-onizleme", "aria-live": "polite", hidden: true });
    const kok = h("div", { class: "tk-alan" }, etiket, ta, gorselKap, araclar, onizleme);
    const gorselGuncelle = () => {
      const g = durum[gorselAnahtar];
      gorselKap.hidden = !g;
      if (g) gorselImg.src = g; else gorselImg.removeAttribute("src");
      secDugme.lastChild.textContent = g ? t("Görseli değiştir") : t("Görsel ekle");
      kaldir.hidden = !g;
    };
    return { kok, ta, etiket, araclar, onizleme, gorselGuncelle };
  };
  const on = yuzAlani(t("Ön yüz"), kaynak.on?.metin, t("Soru, sözcük ya da boşluklu cümle"), "onGorsel");
  const arka = yuzAlani(t("Arka yüz"), kaynak.arka?.metin, t("Cevap"), "arkaGorsel");
  const boslukDugme = h("button", { class: "tk-arac tk-bosluk-yap", type: "button", title: "Ctrl Shift C",
    onclick: () => { if (durum.tur !== "bosluk" && !gorselTur) { durum.tur = "bosluk"; turGrup.sec("bosluk"); } boslukYap(on.ta); } },
    icon("bosluk", "i-20"), h("span", {}, t("Boşluk yap")));
  on.araclar.prepend(boslukDugme);
  if (gorselTur) boslukDugme.hidden = true;
  const boslukBilgi = h("p", { class: "tk-bilgi", "aria-live": "polite" });
  on.kok.insertBefore(boslukBilgi, on.onizleme);
  on.ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); boslukDugme.click(); }
  });

  // ---- deste ----
  const secim = h("select", { class: "tk-secim", id: "tk-deste-" + sheetSayac });
  secim.append(h("option", { value: "" }, t("Destesiz")));
  const belgeGrup = h("optgroup", { label: t("Belgeler") }, ...store.belgeler.map((b) => h("option", { value: "b:" + b.id }, b.ad)));
  if (belgeGrup.children.length) secim.append(belgeGrup);
  const desteAdlari = [...new Set(store.kartlar.map((x) => x.deste).filter(Boolean))].sort((a, b) => a.localeCompare(b, yerel));
  if (desteAdlari.length) secim.append(h("optgroup", { label: t("Desteler") }, ...desteAdlari.map((d) => h("option", { value: "d:" + d }, d))));
  secim.value = durum.deste;
  if (secim.value !== durum.deste) { secim.append(h("option", { value: durum.deste }, kaynakAd(kaynak) || t("Bu deste"))); secim.value = durum.deste; }
  secim.addEventListener("change", () => { durum.deste = secim.value; durum.desteDegisti = true; });
  const desteSatir = h("div", { class: "tk-alan" }, h("label", { class: "tk-etiket", for: secim.id }, t("Deste")),
    h("div", { class: "tk-secim-kap" }, secim, icon("asagi", "i-20")));

  // ---- ters ----
  const tersAnahtar = anahtarKur(t("Ters kartı da oluştur"), false, (v) => { durum.ters = v; });
  const tersSatir = h("div", { class: "tk-satir-anahtar" },
    h("span", {}, h("b", {}, t("Ters kartı da oluştur")), h("small", {}, t("Arka yüz soru, ön yüz cevap olur; ikisi ayrı takvimde."))), tersAnahtar);
  const tersNot = k?.ters ? h("p", { class: "tk-bilgi" }, t("Bu bir ters kart: ön ve arka yüz asıl karta göre yer değiştirmiş.")) : null;

  const hata = h("p", { class: "tk-hata", role: "alert", hidden: true });
  const kaydetDugme = h("button", { class: "birincil tk-kaydet", type: "button", onclick: () => kaydet() }, k ? t("Kaydet") : t("Kartı ekle"));
  const vazgec = h("button", { class: "metin-dugme", type: "button", onclick: () => sheetKapat() }, t("Vazgeç"));
  const askiDugme = k ? h("button", { class: "metin-dugme tk-aski-dugme", type: "button", onclick: () => {
    durum.askida = !durum.askida;
    askiDugme.lastChild.textContent = durum.askida ? t("Askıdan al") : t("Askıya al");
    askiDugme.setAttribute("aria-pressed", String(durum.askida));
  }, "aria-pressed": String(durum.askida) }, icon("aski", "i-20"), h("span", {}, durum.askida ? t("Askıdan al") : t("Askıya al"))) : null;

  // ---- önizleme ve görünürlük ----
  let zaman = 0;
  const onizle = (alan, metin, bosluklu) => {
    const goster = bosluklu ? boslukVarMi(metin) : matematikVarMi(metin);
    alan.onizleme.hidden = !goster;
    if (!goster) return alan.onizleme.replaceChildren();
    const m = h("div", { class: "tk-onizleme-metin" });
    if (bosluklu) {
      for (const p of boslukParcala(metin)) m.append(p.n == null ? p.metin : h("mark", { class: "tk-bosluk-isaret" }, h("sup", {}, String(p.n)), p.cevap));
    } else m.textContent = metin;
    alan.onizleme.replaceChildren(h("span", { class: "tk-onizleme-etiket" }, t("Önizleme")), m);
    if (matematikVarMi(metin)) matematikCiz(m).catch(() => {});
  };
  function guncelle() {
    const bosluk = durum.tur === "bosluk";
    on.etiket.textContent = bosluk ? t("Metin") : durum.tur === "kelime" ? t("Sözcük") : t("Ön yüz");
    on.ta.placeholder = bosluk ? t("Cümleyi yaz, bir sözcüğü seçip Boşluk yap’a dokun") : durum.tur === "kelime" ? t("Sözcük") : t("Soru");
    arka.etiket.textContent = bosluk ? t("Ek bilgi (isteğe bağlı)") : durum.tur === "kelime" ? (ingilizceMi ? t("Anlamı (kart alanı)") : "Anlamı") : t("Arka yüz");
    arka.ta.placeholder = bosluk ? t("Cevabın altında görünür") : durum.tur === "kelime" ? t("Anlamı ya da çevirisi") : t("Cevap");
    tersSatir.hidden = bosluk || gorselTur || !!k?.ters || tersVar;
    on.gorselGuncelle(); arka.gorselGuncelle();
    const nums = boslukNumaralari(on.ta.value);
    boslukBilgi.hidden = !bosluk;
    boslukBilgi.textContent = nums.length ? `${t("{n} boşluk", { n: nums.length })} · ${t("{n} kart", { n: nums.length })}` + (k?.bosluk && nums.length ? t(", geçmişleri korunur") : "")
      : t("Henüz boşluk yok: bir sözcüğü seçip Boşluk yap’a dokun ya da {{c1::cevap}} yaz.");
    clearTimeout(zaman);
    zaman = setTimeout(() => { onizle(on, on.ta.value, bosluk); onizle(arka, arka.ta.value, false); }, 160);
    hata.hidden = true;
  }
  on.ta.addEventListener("input", guncelle);
  arka.ta.addEventListener("input", guncelle);
  for (const ta of [on.ta, arka.ta]) ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); kaydet(); }
  });

  function hataGoster(metin) { hata.textContent = metin; hata.hidden = false; }
  function kaydet() {
    const onMetin = on.ta.value.trim(), arkaMetin = arka.ta.value.trim();
    const onY = yuzKur(k?.on, onMetin, durum.onGorsel), arkaY = yuzKur(k?.arka, arkaMetin, durum.arkaGorsel);
    if (!onY.metin && !onY.gorsel) return hataGoster(t("Ön yüz boş olamaz."));
    const deste = durum.desteDegisti ? desteCoz(durum.deste) : {};
    const degisen = [];
    if (durum.tur === "bosluk") {
      const nums = boslukNumaralari(onMetin);
      if (!nums.length) return hataGoster(t("Metinde en az bir boşluk olmalı: bir sözcüğü seçip Boşluk yap’a dokun."));
      const kok = k?.bosluk?.kok || yeniId("b");
      const kardesler = k?.bosluk?.kok ? store.kartlar.filter((x) => x.bosluk?.kok === kok) : k ? [k] : [];
      const mevcut = new Map();
      for (const x of kardesler) if (x.bosluk?.n && !mevcut.has(x.bosluk.n)) mevcut.set(x.bosluk.n, x);
      // Türü sonradan boşluğa çevrilen kart ilk boşluğu alır, geçmişi onda kalır
      if (k && !k.bosluk?.kok && !mevcut.size) mevcut.set(nums[0], k);
      const kullanilan = new Set();
      for (const n of nums) {
        const x = mevcut.get(n);
        if (x) {
          kullanilan.add(x);
          const ortak = alanUygula(x, { tur: "bosluk", on: yuzKur(x.on, onMetin, durum.onGorsel), arka: yuzKur(x.arka, arkaMetin, durum.arkaGorsel), bosluk: { kok, n }, ...deste });
          kartGuncelle(x.id, ortak);
          degisen.push(x.id);
        }
      }
      // Yeni boşluklar: kardeşlerin destesiyle; c1 listenin üstünde kalsın diye sondan başa eklenir
      const taban = k ? { belgeId: k.belgeId ?? null, belgeAd: k.belgeAd || "", sayfa: k.sayfa, deste: k.deste, ...deste }
        : { belgeId: alanlar.belgeId ?? null, belgeAd: alanlar.belgeAd || "", sayfa: alanlar.sayfa, ...desteCoz(durum.deste) };
      const eklenecek = nums.filter((n) => !mevcut.get(n));
      for (const n of eklenecek.reverse()) {
        const yeni = kartEkle(Object.fromEntries(Object.entries({ ...taban, tur: "bosluk", on: { ...onY }, arka: { ...arkaY }, bosluk: { kok, n } }).filter(([, v]) => v !== undefined)));
        degisen.push(yeni.id);
      }
      const silinen = [...new Set(mevcut.values())].filter((x) => !kullanilan.has(x));
      for (const x of silinen) kartSil(x.id);
      if (silinen.length) toast(t("{n} boşluk kaldırıldı, kartı silindi", { n: silinen.length }));
      else if (!k) toast(nums.length === 1 ? t("Kart eklendi") : t("{n} boşluk kartı eklendi", { n: nums.length }));
      else if (eklenecek.length) toast(t("{n} yeni boşluk kartı eklendi", { n: eklenecek.length }));
    } else if (k) {
      if (k.bosluk) delete k.bosluk;
      kartGuncelle(k.id, alanUygula(k, { tur: gorselTur ? k.tur : durum.tur, on: onY, arka: arkaY, ...deste }));
      degisen.push(k.id);
      // Ters kardeş: içerik yer değiştirerek güncellenir; yeni istendiyse eklenir
      const ters = store.kartlar.find((x) => x.tersKaynak === k.id);
      if (ters) kartGuncelle(ters.id, alanUygula(ters, { tur: k.tur, on: yuzKur(ters.on, arkaY.metin, arkaY.gorsel), arka: yuzKur(ters.arka, onY.metin, onY.gorsel), ...deste }));
      else if (durum.ters && (arkaY.metin || arkaY.gorsel)) kartEkle(tersAlanlari(k));
    } else {
      const alan = Object.fromEntries(Object.entries({ belgeId: alanlar.belgeId ?? null, belgeAd: alanlar.belgeAd || "", sayfa: alanlar.sayfa, sayfaId: alanlar.sayfaId,
        ...desteCoz(durum.deste), tur: durum.tur, on: onY, arka: arkaY }).filter(([, v]) => v !== undefined));
      // Belge alanı seçimden gelir; "Destesiz" seçildiyse sayfa da düşer
      if (!alan.belgeId) { delete alan.sayfa; delete alan.sayfaId; }
      const yeni = kartEkle(alan);
      if (durum.ters && (arkaY.metin || arkaY.gorsel)) kartEkle(tersAlanlari(yeni));
      toast(durum.ters ? t("İki kart eklendi") : t("Kart eklendi"));
    }
    // Askı düğmesi (düzenlemede)
    if (k && kartBul(k.id) && durum.askida !== !!k.askida) { if (durum.askida) askiyaAl(k); else askidanAl(k, { sessiz: true }); }
    sheetKapat();
    // Gösterilen kart değiştiyse yeniden çizilir; açıktıysa açık kalır
    if (D?.kart && degisen.includes(D.kart.k.id) && !D.kart.kilit && (D.gorunum === "deste" || D.gorunum === "sinav")) {
      const acikti = D.kart.acik;
      sahneCiz();
      if (acikti) cevir();
    }
  }

  const govde = [turSatir, tersNot, on.kok, arka.kok, desteSatir, tersSatir, hata].filter(Boolean);
  if (gorselTur) govde.splice(1, 0, h("p", { class: "tk-bilgi" }, k.tur === "bant"
    ? t("Bant kartı: görseli değiştirebilir, arka yüze not yazabilirsin.") : t("Kırpıntı kartı: görseli değiştirebilir, arka yüze not yazabilirsin.")));
  sheetAc({ baslik: k ? t("Kartı düzenle") : t("Yeni kart"), sinif: "tk-kart-sheet", govde,
    alt: [askiDugme, h("span", { class: "bosluk" }), vazgec, kaydetDugme].filter(Boolean),
    ilkOdak: on.ta });
  guncelle();
  // İmleç metnin sonunda
  on.ta.setSelectionRange(on.ta.value.length, on.ta.value.length);
}
const tersAlanlari = (k) => Object.fromEntries(Object.entries({ tur: k.tur, on: { ...k.arka }, arka: { ...k.on }, ters: true, tersKaynak: k.id,
  belgeId: k.belgeId, belgeAd: k.belgeAd, sayfa: k.sayfa, deste: k.deste }).filter(([, v]) => v !== undefined && v !== null));

// ======================================================================
// Deste ayarları (R4): günlük yeni kart sınırı, hedef hatırlama, değerlendirme düğmeleri, askıdakiler
// Anahtarlar store.ayarlar.tekrarGunlukYeni (null | sayı), tekrarHedef (0,85..0,95), tekrarDegerlendirme ("iki" | "dort")
// ======================================================================
export function desteAyarlariAc() {
  const a = store.ayarlar;
  const yeniSinir = typeof a.tekrarGunlukYeni === "number" ? a.tekrarGunlukYeni : null;
  const sinirGrup = parcaliKur(t("Günlük yeni kart"), [[null, t("Sınırsız")], [10, "10"], [20, "20"], [50, "50"]],
    [null, 10, 20, 50].includes(yeniSinir) ? yeniSinir : null, (v) => { ayarla({ tekrarGunlukYeni: v }); sinirYaz(); });
  const sinirAlt = h("small", { class: "tk-ayar-alt" });
  const sinirYaz = () => {
    const bekleyen = store.kartlar.filter((k) => !k.askida && !(k.fsrs?.s > 0) && !(k.gecmis?.length) && (k.kutu || 1) <= 1).length;
    sinirAlt.textContent = `${t("{n} yeni kart bekliyor", { n: bekleyen })} · ${t("bugünkü listede {n} kart", { n: bugunTekrar().length })}`;
  };
  sinirYaz();

  const hedef = Math.round(Math.min(0.95, Math.max(0.85, Number(a.tekrarHedef ?? 0.9))) * 100);
  const aralik = h("input", { class: "tk-aralik", type: "range", min: "85", max: "95", step: "1", value: String(hedef), id: "tk-hedef",
    "aria-describedby": "tk-hedef-not", "aria-valuetext": t("yüzde {n}", { n: hedef }) });
  const deger = h("output", { class: "tk-aralik-deger", for: "tk-hedef" }, t("%{n}", { n: hedef }));
  const ornek = h("small", { class: "tk-ayar-alt" });
  const hedefYaz = () => {
    const v = Number(aralik.value);
    deger.textContent = t("%{n}", { n: v });
    aralik.style.setProperty("--dolu", `${((v - 85) / 10) * 100}%`);
    aralik.setAttribute("aria-valuetext", t("yüzde {n}", { n: v }));
    ornek.textContent = t("Bu hedefte 10 gün kararlı bir kart {g} gün sonra sorulur.", { g: fsrsAralik(10, v / 100) });
  };
  aralik.addEventListener("input", hedefYaz);
  aralik.addEventListener("change", () => ayarla({ tekrarHedef: Number(aralik.value) / 100 }));
  hedefYaz();

  const kipGrup = parcaliKur(t("Değerlendirme"), [["iki", t("İki düğme")], ["dort", t("Dört düğme")]], dortMu() ? "dort" : "iki",
    (v) => { ayarla({ tekrarDegerlendirme: v }); kipAlt.textContent = KIP_NOT[v]; });
  const KIP_NOT = { iki: t("Bilemedim ve Bildim. Kalemle sola ya da sağa itmek de olur."), dort: t("Tekrar, Zor, İyi, Kolay. Zor aralığı kısaltır, Kolay uzatır.") };
  const kipAlt = h("small", { class: "tk-ayar-alt" }, KIP_NOT[dortMu() ? "dort" : "iki"]);

  const askida = store.kartlar.filter((k) => k.askida).length;
  const askiSatir = h("button", { class: "tk-ayar-satir-dugme", type: "button", onclick: () => { sheetKapat(true); tekrardaYap("liste-askida"); } },
    icon("aski", "i-20"), h("span", {}, h("b", {}, t("Askıdaki kartlar")), h("small", {}, askida ? t("{n} kart bugünkü listeye girmiyor", { n: askida }) : t("Askıda kart yok"))), icon("sag", "i-20"));

  sheetAc({ baslik: t("Deste ayarları"), sinif: "tk-ayar-sheet", govde: [
    h("section", { class: "tk-ayar" }, h("span", { class: "tk-etiket" }, t("Günlük yeni kart")), sinirGrup, sinirAlt),
    h("section", { class: "tk-ayar" }, h("label", { class: "tk-etiket", for: "tk-hedef" }, t("Hedef hatırlama")),
      h("div", { class: "tk-aralik-satir" }, aralik, deger),
      h("p", { class: "tk-ayar-not", id: "tk-hedef-not" }, t("Yüksek hedef daha sık tekrar demek.")), ornek),
    h("section", { class: "tk-ayar" }, h("span", { class: "tk-etiket" }, t("Değerlendirme")), kipGrup, kipAlt),
    h("section", { class: "tk-ayar" }, askiSatir),
  ], ilkOdak: sinirGrup.querySelector('[tabindex="0"]') });
}

// ======================================================================
// Anki destesi içe aktarma (R6): ⋯ menüsü ya da paylaş menüsü (ankiDosyasiAc). Okuma anki.js ankiIceOku.
// ======================================================================
function ankiSec() {
  const girdi = h("input", { type: "file", accept: ".apkg,.colpkg,application/octet-stream,application/zip", hidden: true, class: "tk-anki-girdi" });
  girdi.addEventListener("change", () => { const f = girdi.files?.[0]; girdi.remove(); if (f) ankiDosyasiAc(f); });
  girdi.addEventListener("cancel", () => girdi.remove());
  document.body.append(girdi);
  girdi.click();
}

export async function ankiDosyasiAc(dosya) {
  const durum = h("div", { class: "tk-anki-durum", role: "status" }, h("span", { class: "tk-donen", "aria-hidden": "true" }), h("span", {}, t("Paket okunuyor…")));
  const ekle = h("button", { class: "birincil tk-anki-ekle", type: "button", disabled: true }, t("İçe aktar"));
  const vazgec = h("button", { class: "metin-dugme", type: "button", onclick: () => sheetKapat() }, t("Vazgeç"));
  const govde = h("div", { class: "tk-anki-govde" }, h("p", { class: "tk-anki-dosya" }, icon("deste", "i-20"), h("span", {}, dosya?.name || t("Anki paketi"))), durum);
  const sh = sheetAc({ baslik: t("Anki destesi içe aktar"), sinif: "tk-anki-sheet", govde: [govde], alt: [h("span", { class: "bosluk" }), vazgec, ekle] });
  let sonuc;
  try {
    const { ankiIceOku } = await import("./anki.js");
    const varOlan = new Set(store.kartlar.filter((k) => k.anki?.guid).map((k) => `${k.anki.guid}:${k.anki.ord}`));
    sonuc = await ankiIceOku(dosya, { varOlan });
  } catch (hata) {
    if (SH !== sh) return;
    if (!hata?.kullanici) console.error("[tekrar] Anki içe aktarma:", hata);
    durum.replaceChildren(h("p", { class: "tk-hata" }, hata?.kullanici ? hata.message : t("Paket okunamadı. Dosya bozuk olabilir.")));
    durum.setAttribute("role", "alert");
    return;
  }
  if (SH !== sh) return;
  const n = sonuc.kartlar.length;
  const satirlar = [...sonuc.desteler].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ad, c]) =>
    h("li", {}, icon("deste", "i-20"), h("span", {}, ad), h("b", {}, t("{n} kart", { n: c }))));
  const parca = [sonuc.sayilar.soru && t("{n} soru", { n: sonuc.sayilar.soru }), sonuc.sayilar.ters && t("{n} ters", { n: sonuc.sayilar.ters }),
    sonuc.sayilar.bosluk && t("{n} boşluk", { n: sonuc.sayilar.bosluk }), sonuc.sayilar.gorsel && t("{n} görselli", { n: sonuc.sayilar.gorsel })].filter(Boolean).join(" · ");
  const notlar = [];
  if (sonuc.atlanan) notlar.push(t("{n} kart zaten var, atlanacak.", { n: sonuc.atlanan }));
  if (sonuc.bos) notlar.push(t("{n} boş ya da okunamayan kart atlanacak.", { n: sonuc.bos }));
  notlar.push(t("Zamanlama sıfırdan başlar: kartlar yeni olarak gelir."));
  if (n > 50 && typeof store.ayarlar.tekrarGunlukYeni !== "number") notlar.push(t("Hepsi bugün sorulmasın diye Deste ayarlarından günlük yeni kart sınırı koyabilirsin."));
  // Büyük sayının yanındaki birim: Türkçede "kart" tekil kalır
  const birim = ingilizceMi ? (n === 1 ? "card" : "cards") : "kart";
  durum.replaceChildren(
    h("div", { class: "tk-anki-ozet" }, h("b", { class: "tk-buyuk-sayi" }, String(n)), h("span", {}, n ? `${birim} · ${parca}` : t("içe aktarılacak yeni kart yok"))),
    satirlar.length ? h("ul", { class: "tk-anki-desteler" }, ...satirlar) : null,
    ...notlar.map((not) => h("p", { class: "tk-bilgi" }, not)));
  ekle.disabled = !n;
  ekle.onclick = () => {
    const yeni = kartlariTopluEkle(sonuc.kartlar);
    sheetKapat();
    toast(t("{n} kart içe aktarıldı", { n: yeni.length }), { etiket: t("Geri al"), calistir: () => {
      const ids = new Set(yeni.map((k) => k.id));
      for (let i = store.kartlar.length - 1; i >= 0; i--) if (ids.has(store.kartlar[i].id)) store.kartlar.splice(i, 1);
      bus.emit("kartlar", { tur: "toplu" });
    } });
    if (D) { if (D.gorunum === "deste" && !D.deste?.cevap.length) desteBaslat(); else sahneCiz(); }
    else bus.emit("git", { ekran: "tekrar" });
  };
  ekle.focus();
}
// Çok kart tek olayla eklenir (kayıt bütün kartları bir kez yazar). Ters kartın _tersKaynak'ı kimliğe çevrilir.
function kartlariTopluEkle(liste) {
  const simdi = Date.now(), kimlik = new Map();
  const yeni = liste.map((a) => { const k = { id: yeniId("t"), kutu: 1, sonraki: simdi, gecmis: [], on: {}, arka: {}, ...a }; kimlik.set(a, k); return k; });
  for (const k of yeni) { if (k._tersKaynak) k.tersKaynak = kimlik.get(k._tersKaynak)?.id; delete k._tersKaynak; }
  store.kartlar.unshift(...yeni);
  bus.emit("kartlar", { tur: "toplu", kartlar: yeni });
  return yeni;
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
  const kalAd = kal?.ad || t("Kalkülüs II Ders Notları"), sucAd = suc?.ad || ornekKunye("sucveceza")?.ad || "";
  const M = ORNEK_METIN[ingilizceMi ? "en" : "tr"];
  const gecmis = (kutu, sonGun) => Array.from({ length: Math.max(0, kutu - 1) }, (_, i) => ({ zaman: simdi - (sonGun + (kutu - 1 - i) * 3) * GUN, bildi: true }));
  // bekliyor: sonraki geçmişte (bugün); değilse gün sonra
  const kart = (alanlar, kutu, gunSonra) => ({
    ...alanlar, kutu, gecmis: gecmis(kutu, Math.max(1, -gunSonra)),
    sonraki: gunSonra <= 0 ? simdi - (1 - gunSonra) * saat : simdi + gunSonra * GUN,
  });
  // Kelime kartları kitabın kendi verisinden (okuma-metni.js): sayfa, sözcüğün açılan metinde geçtiği sayfa.
  // Kutu ve gün (zamanlama) burada, sırayla
  const SUC_ZAMAN = [[3, 4], [1, -2], [4, 9]];
  const sucKartlari = ornekKitapKartlari(suc || "sucveceza").slice(0, SUC_ZAMAN.length).map((o, i) =>
    kart({ tur: "kelime", on: { metin: o.on }, arka: { metin: o.arka }, belgeId: "sucveceza", belgeAd: sucAd, sayfa: o.sayfa }, ...SUC_ZAMAN[i]));

  let kesit = [];
  try { kesit = sayfaKesitleri(); } catch (hata) { console.warn("[tekrar] örnek görüntüler üretilemedi:", hata); }
  const [k47, k52, k61] = kesit;

  // kartEkle başa ekler: sondan başa doğru eklenir ki liste bu sırada kalsın
  const liste = [
    k47 ? kart({ tur: "bant", bant: "murekkep", ...k47, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 1, 0)
        : kart({ tur: "soru", on: { metin: M.zincir }, arka: { metin: "F′(x) = f′(g(x)) · g′(x)" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 1, 0),
    k52 ? kart({ tur: "bant", bant: "hardal", ...k52, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 52 }, 1, -1)
        : kart({ tur: "soru", on: { metin: M.leibniz }, arka: { metin: "dy/dx = (dy/du) · (du/dx)" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 52 }, 1, -1),
    k61 ? kart({ tur: "bant", bant: "bordo", ...k61, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 61 }, 2, 0)
        : kart({ tur: "soru", on: { metin: M.ornek }, arka: { metin: "y′ = 30x (3x² + 1)⁴" }, belgeId: "kalkulus", belgeAd: kalAd, sayfa: 61 }, 2, 0),
    ...sucKartlari,
    kart({ tur: "soru", on: { metin: M.turevSoru }, arka: { metin: M.turevCevap },
      belgeId: "kalkulus", belgeAd: kalAd, sayfa: 47 }, 2, -3),
  ];
  for (const alanlar of liste.reverse()) kartEkle(alanlar);
}
// Örnek soru kartlarının metni, arayüz diline göre (kimlik ve zamanlama aynı)
const ORNEK_METIN = {
  tr: {
    zincir: "Zincir kuralı: F = f ∘ g ise F′(x) = ?",
    leibniz: "Leibniz gösteriminde zincir kuralı",
    ornek: "y = (3x² + 1)⁵ ise y′ = ?",
    turevSoru: "Türevin geometrik anlamı nedir?",
    turevCevap: "Grafiğe o noktada çizilen teğet doğrusunun eğimi: f′(a) = lim h→0 (f(a + h) − f(a)) / h",
  },
  en: {
    zincir: "Chain rule: if F = f ∘ g, then F′(x) = ?",
    leibniz: "The chain rule in Leibniz notation",
    ornek: "If y = (3x² + 1)⁵, then y′ = ?",
    turevSoru: "What is the geometric meaning of the derivative?",
    turevCevap: "The slope of the tangent line to the graph at that point: f′(a) = lim h→0 (f(a + h) − f(a)) / h",
  },
};

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
  // Sayfa İngilizce çizildiyse (sayfalar.js) başlıklar İngilizce gelir: her iki dilin başı aranır
  const bul = (...baslar) => yazilar.find((y) => baslar.some((bas) => y.t.trim().startsWith(bas)))?.y;

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
  const teorem = bul("Teorem", "Theorem"), leib = bul("Leibniz", "In Leibniz", "Using Leibniz"), ornek = bul("Örnek 1", "Example 1"),
    alis = bul("Alıştırma", "Exercise") ?? PH;
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
