// İlk kullanım rehberi (OZELLIKLER-7 §7.4, TASARIM-4 3.3): karşılamadan sonra üç kısa, atlanabilir ipucu,
// gerçek ekranın üstünde. Ayarlar > Yardım > "Rehberi yeniden göster" baştan açar.
//   rehberDavet()      kitaplıkta "Üç kısa ipucu" şeridi (Başla, Atla); kartların akışında durur, onları örtmez
//   rehberBaslat(i)    i. adımdan başlar: belgeyi açar, hedef öğeyi ışıkla işaretler
// Metinler kalem türüne göre (ortak.js kalemTuru): S Pen, Apple Pencil, kalem, parmak, fare.
// Işık pointer-events almaz: kullanıcı işaretlenen yerde gerçekten deneyebilir.

import { h, bus, belgeBul, kalemTuru, hareketAz, odakla } from "./ortak.js";
import { t } from "./dil.js";

const ADIMLAR = [
  {
    belge: "kalkulus", mod: "masa", hedef: [".duzenleyici .arac-cubugu", ".arac-cubugu", ".duzenleyici .ust-cubuk"], baslik: t("Kalemle yaz"),
    metin: {
      spen: t("S Pen ile doğrudan yaz. Yan tuşa basılıyken silersin."),
      pencil: t("Apple Pencil ile doğrudan yaz. Silgi kalem tepsisinde; iki parmakla dokunmak geri alır."),
      kalem: t("Kalemle doğrudan yaz. İki parmakla dokunmak geri alır."),
      parmak: t("Alttaki kalemlerden birine dokun, sonra parmağınla yaz. İki parmakla dokunmak geri alır."),
      fare: t("Bir kalem seç ve sürükleyerek yaz. Ctrl Z geri alır."),
    },
  },
  {
    belge: "kagit", mod: "koltuk", hedef: [".okuma-sutun", ".okuma"], baslik: t("Altını çiz, sonra bul"),
    metin: {
      spen: t("Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler."),
      pencil: t("Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler."),
      kalem: t("Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler."),
      parmak: t("Bir kelimeye uzun bas, seçimi genişlet, “Altını çiz”e dokun. İzlerim sekmesinde seni bekler."),
      fare: t("Metni seç, “Altını çiz”e tıkla. İzlerim’de seni bekler."),
    },
  },
  {
    belge: null, hedef: [".mod-anahtari", `button[aria-label="${t("Diğer")}"]`, `button[aria-label="${t("Daha")}"]`, ".daha"], baslik: t("Koltuk ve Masa"),
    metin: {
      varsayilan: t("Koltuk okumak için, Masa çalışmak için. Aynı sayfada buradan geçersin."),
      daha: t("Koltuk okumak için, Masa çalışmak için. Masa’da aç buradadır."),
      gizli: t("Koltuk okumak için, Masa çalışmak için. Sayfanın ortasına dokun; üst çubuktaki anahtarla geçersin."),
      fare: t("Koltuk okumak için, Masa çalışmak için. Aynı sayfada buradan geçersin. Her yere Ctrl K ile ulaşırsın."),
    },
  },
];

let R = null;   // açık rehber: { el, isik, adim, zaman, temizlik }

const gorunur = (el) => { const r = el?.getBoundingClientRect(); return !!r && r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
const hedefBul = (seciciler) => { for (const s of seciciler) for (const el of document.querySelectorAll(s)) if (gorunur(el)) return el; return null; };

// 7.0 (TASARIM-5 8.1 madde 6): ilerleme "1 / 3" yerine noktalar (etkin olan --vurgu-1); ekran okuyucu yazıyı duyar
function noktalar(sayac) {
  const m = /^(\d+) \/ (\d+)$/.exec(sayac || "");
  if (!m) return h("span", { class: "sayac" }, sayac || "");
  const [i, n] = [Number(m[1]), Number(m[2])];
  return h("span", { class: "sayac rehber-noktalar" },
    ...Array.from({ length: n }, (_, k) => h("i", { class: k + 1 === i ? "etkin" : null, "aria-hidden": "true" })),
    h("span", { class: "gorsel-gizli" }, t("{n} ipucundan {i}.", { n, i })));
}
// serit: kitaplıkta akışın içinde duran şerit (konumlanmaz, ışık yok)
function balon({ baslik, metin, sayac, birincil, ikincil, serit = false }) {
  const b = h("div", { class: serit ? "rehber-serit" : "rehber-balon", role: serit ? "region" : "dialog", "aria-modal": serit ? null : "false",
    "aria-labelledby": "rehberBaslik", "aria-describedby": "rehberMetin" },
    h("h3", { id: "rehberBaslik", tabindex: "-1" }, baslik),
    h("p", { id: "rehberMetin" }, metin),
    h("div", { class: "rehber-alt" },
      noktalar(sayac),
      ikincil ? h("button", { class: "metin-dugme", type: "button", onclick: ikincil.calistir }, ikincil.etiket) : null,
      h("button", { class: "birincil", type: "button", onclick: birincil.calistir }, birincil.etiket)));
  return b;
}

function kapat() {
  if (!R) return;
  clearInterval(R.zaman);
  for (const f of R.temizlik) { try { f(); } catch { /* boş */ } }
  const { el, isik, yer } = R;
  R = null;
  const sok = () => { el.remove(); isik?.remove(); if (yer && !yer.childElementCount) yer.hidden = true; };
  if (hareketAz()) sok(); else { el.classList.add("gidiyor"); isik?.classList.add("gidiyor"); setTimeout(sok, 180); }
}

function yerlestir() {
  if (!R) return;
  const { el, isik, hedefSec } = R;
  const hedef = hedefSec ? hedefBul(hedefSec) : null;
  const dar = matchMedia("(max-width: 599px)").matches;
  delete el.dataset.ok;
  if (!hedef) {
    isik.hidden = true;
    el.style.left = `${Math.round((innerWidth - el.offsetWidth) / 2)}px`;
    el.style.top = dar ? "" : `${Math.round(innerHeight * 0.5 - el.offsetHeight / 2)}px`;
    return;
  }
  // Büyük hedef (metin sütunu) ekranın ortasında bir pencereyle sınırlanır
  let r = hedef.getBoundingClientRect();
  const p = 6;
  let x = Math.max(4, r.left - p), y = Math.max(4, r.top - p), w = Math.min(innerWidth - 8, r.width + 2 * p), hY = Math.min(innerHeight - 8, r.height + 2 * p);
  if (hY > innerHeight * 0.5) { const orta = y + hY / 2; hY = Math.round(innerHeight * 0.34); y = Math.max(8, Math.min(innerHeight - hY - 8, orta - hY / 2 - innerHeight * 0.12)); }
  isik.hidden = false;
  Object.assign(isik.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(w)}px`, height: `${Math.round(hY)}px` });
  // Telefonda balon altta; hedef ekranın alt yarısındaysa (Masa'nın alt araç çubuğu) üste geçer
  el.classList.toggle("ustte", dar && y + hY / 2 > innerHeight * 0.5);
  if (dar) { el.style.left = ""; el.style.top = ""; return; }
  const bw = el.offsetWidth, bh = el.offsetHeight;
  let bx = Math.min(Math.max(16, x + w / 2 - bw / 2), innerWidth - bw - 16);
  let by = y + hY + 12;
  if (by + bh > innerHeight - 16) by = y - bh - 12;
  if (by < 16) by = Math.min(innerHeight - bh - 16, Math.max(16, y + hY / 2 - bh / 2));
  el.style.left = `${Math.round(bx)}px`;
  el.style.top = `${Math.round(by)}px`;
  // 6 px köşe oku hedefe bakar (balon hedefin altındaysa yukarı, üstündeyse aşağı); hedefin yanındaysa ok yok
  const ok = by >= y + hY ? "ust" : by + bh <= y ? "alt" : null;
  if (ok) {
    el.dataset.ok = ok;
    el.style.setProperty("--ok-x", `${Math.round(Math.min(bw - 20, Math.max(20, x + w / 2 - bx)))}px`);
  }
}

function goster(icerik, hedefSec) {
  const eski = R;
  if (eski) { clearInterval(eski.zaman); for (const f of eski.temizlik) { try { f(); } catch { /* boş */ } } eski.el.remove(); if (eski.yer) eski.yer.hidden = true; }
  const isik = eski?.isik || h("div", { class: "rehber-isik", hidden: true, "aria-hidden": "true" });
  if (!isik.isConnected) document.body.append(isik);
  document.body.append(icerik);
  const tus = (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.stopPropagation(); kapat(); } };
  document.addEventListener("keydown", tus, true);
  addEventListener("resize", yerlestir);
  R = { el: icerik, isik, hedefSec, zaman: setInterval(yerlestir, 400), temizlik: [() => document.removeEventListener("keydown", tus, true), () => removeEventListener("resize", yerlestir)] };
  yerlestir();
  odakla(icerik.querySelector("h3"));
}

export function rehberDavet() {
  if (R) return;
  if (!belgeBul("kalkulus") && !belgeBul("kagit")) return;
  // Kitaplıkta yeri varsa (app.js .rehber-yeri) ızgaranın üstünde yer kaplayan şerit olur: ilk açılışta kartlara
  // dokunulabilsin. Yer yoksa eskisi gibi ekranın üstünde balon
  const yer = document.querySelector(".ekran-kitaplik .rehber-yeri");
  const el = balon({
    baslik: t("Üç kısa ipucu"),
    metin: t("Kalemle yazmak, altını çizip bulmak, Koltuk ile Masa. Bir dakika sürer; istediğin an geçebilirsin."),
    birincil: { etiket: t("Başla"), calistir: () => rehberBaslat(0) },
    ikincil: { etiket: t("Atla"), calistir: kapat },
    serit: !!yer,
  });
  if (yer) seritGoster(el, yer); else goster(el, null);
  // Başka bir ekrana geçilirse davet kendiliğinden kalkar
  const git = () => kapat();
  R.temizlik.push(bus.on("git", git));
  addEventListener("popstate", git);
  R.temizlik.push(() => removeEventListener("popstate", git));
}

function seritGoster(el, yer) {
  yer.replaceChildren(el);
  yer.hidden = false;
  const tus = (e) => { if (e.key === "Escape" && el.contains(document.activeElement) && !document.querySelector("dialog[open]")) { e.stopPropagation(); kapat(); } };
  document.addEventListener("keydown", tus, true);
  R = { el, isik: null, yer, hedefSec: null, zaman: 0, temizlik: [() => document.removeEventListener("keydown", tus, true)] };
  odakla(el.querySelector("h3"));
}

export async function rehberBaslat(i = 0) {
  const a = ADIMLAR[i];
  if (!a) { kapat(); return; }
  const tur = kalemTuru();
  if (a.belge && belgeBul(a.belge)) bus.emit("git", { ekran: "belge", belgeId: a.belge, mod: a.mod });
  // Hedef gelene kadar (belge açılırken) en çok 6 sn beklenir; gelmezse balon ortada durur
  const bas = performance.now();
  const sinir = a.belge ? 6000 : 1500;
  while (performance.now() - bas < sinir && !hedefBul(a.hedef)) await new Promise((r) => setTimeout(r, 200));
  const hedef = hedefBul(a.hedef);
  let metin = a.metin[tur] || a.metin.varsayilan || a.metin.parmak;
  if (i === 2 && hedef && !hedef.matches(".mod-anahtari")) metin = a.metin.daha;
  if (i === 2 && !hedef) metin = a.metin.gizli;
  const son = i === ADIMLAR.length - 1;
  const el = balon({
    baslik: a.baslik, metin, sayac: `${i + 1} / ${ADIMLAR.length}`,
    birincil: { etiket: son ? t("Başla") : t("Sonraki"), calistir: () => (son ? kapat() : rehberBaslat(i + 1)) },
    ikincil: son ? null : { etiket: t("Atla"), calistir: kapat },
  });
  goster(el, a.hedef);
  // 1. adımda gerçekten bir çizgi çizilince "Sonraki" öne çıkar
  if (i === 0) {
    const cizdi = (e) => { if (e.target.closest?.(".sayfa, canvas")) el.querySelector(".birincil")?.classList.add("davet"); };
    document.addEventListener("pointerup", cizdi, true);
    R.temizlik.push(() => document.removeEventListener("pointerup", cizdi, true));
  }
}

export const rehberAcik = () => !!R;
export { kapat as rehberKapat };
