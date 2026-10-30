// İlk kullanım rehberi (OZELLIKLER-7 §7.4, TASARIM-4 3.3): karşılamadan sonra üç kısa, atlanabilir ipucu,
// gerçek ekranın üstünde. Ayarlar > Yardım > "Rehberi yeniden göster" baştan açar.
//   rehberDavet()      kitaplıkta "Üç kısa ipucu" balonu (Başla, Atla)
//   rehberBaslat(i)    i. adımdan başlar: belgeyi açar, hedef öğeyi ışıkla işaretler
// Metinler kalem türüne göre (ortak.js kalemTuru): S Pen, Apple Pencil, kalem, parmak, fare.
// Işık pointer-events almaz: kullanıcı işaretlenen yerde gerçekten deneyebilir.

import { h, bus, belgeBul, kalemTuru, hareketAz, odakla } from "./ortak.js";

const ADIMLAR = [
  {
    belge: "kalkulus", mod: "masa", hedef: [".duzenleyici .arac-cubugu", ".arac-cubugu", ".duzenleyici .ust-cubuk"], baslik: "Kalemle yaz",
    metin: {
      spen: "S Pen ile doğrudan yaz. Yan tuşa basılıyken silersin.",
      pencil: "Apple Pencil ile doğrudan yaz. Silgi kalem tepsisinde; iki parmakla dokunmak geri alır.",
      kalem: "Kalemle doğrudan yaz. İki parmakla dokunmak geri alır.",
      parmak: "Alttaki kalemlerden birine dokun, sonra parmağınla yaz. İki parmakla dokunmak geri alır.",
      fare: "Bir kalem seç ve sürükleyerek yaz. Ctrl Z geri alır.",
    },
  },
  {
    belge: "kagit", mod: "koltuk", hedef: [".okuma-sutun", ".okuma"], baslik: "Altını çiz, sonra bul",
    metin: {
      spen: "Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler.",
      pencil: "Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler.",
      kalem: "Bir satırın altını çiz ya da etrafını daire içine al. İzlerim’de seni bekler.",
      parmak: "Bir kelimeye uzun bas, seçimi genişlet, “Altını çiz”e dokun. İzlerim sekmesinde seni bekler.",
      fare: "Metni seç, “Altını çiz”e tıkla. İzlerim’de seni bekler.",
    },
  },
  {
    belge: null, hedef: [".mod-anahtari", 'button[aria-label="Diğer"]', 'button[aria-label="Daha"]', ".daha"], baslik: "Koltuk ve Masa",
    metin: {
      varsayilan: "Koltuk okumak için, Masa çalışmak için. Aynı sayfada buradan geçersin.",
      daha: "Koltuk okumak için, Masa çalışmak için. Masa’da aç buradadır.",
      gizli: "Koltuk okumak için, Masa çalışmak için. Sayfanın ortasına dokun; üst çubuktaki anahtarla geçersin.",
      fare: "Koltuk okumak için, Masa çalışmak için. Aynı sayfada buradan geçersin. Her yere Ctrl K ile ulaşırsın.",
    },
  },
];

let R = null;   // açık rehber: { el, isik, adim, zaman, temizlik }

const gorunur = (el) => { const r = el?.getBoundingClientRect(); return !!r && r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
const hedefBul = (seciciler) => { for (const s of seciciler) for (const el of document.querySelectorAll(s)) if (gorunur(el)) return el; return null; };

function balon({ baslik, metin, sayac, birincil, ikincil }) {
  const b = h("div", { class: "rehber-balon", role: "dialog", "aria-modal": "false", "aria-labelledby": "rehberBaslik", "aria-describedby": "rehberMetin" },
    h("h3", { id: "rehberBaslik", tabindex: "-1" }, baslik),
    h("p", { id: "rehberMetin" }, metin),
    h("div", { class: "rehber-alt" },
      sayac ? h("span", { class: "sayac" }, sayac) : h("span", { class: "sayac" }),
      ikincil ? h("button", { class: "metin-dugme", type: "button", onclick: ikincil.calistir }, ikincil.etiket) : null,
      h("button", { class: "birincil", type: "button", onclick: birincil.calistir }, birincil.etiket)));
  return b;
}

function kapat() {
  if (!R) return;
  clearInterval(R.zaman);
  for (const f of R.temizlik) { try { f(); } catch { /* boş */ } }
  const { el, isik } = R;
  R = null;
  const sok = () => { el.remove(); isik?.remove(); };
  if (hareketAz()) sok(); else { el.classList.add("gidiyor"); isik?.classList.add("gidiyor"); setTimeout(sok, 180); }
}

function yerlestir() {
  if (!R) return;
  const { el, isik, hedefSec } = R;
  const hedef = hedefSec ? hedefBul(hedefSec) : null;
  const dar = matchMedia("(max-width: 599px)").matches;
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
}

function goster(icerik, hedefSec) {
  const eski = R;
  if (eski) { clearInterval(eski.zaman); for (const f of eski.temizlik) { try { f(); } catch { /* boş */ } } eski.el.remove(); }
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
  goster(balon({
    baslik: "Üç kısa ipucu",
    metin: "Kalemle yazmak, altını çizip bulmak, Koltuk ile Masa. Bir dakika sürer; istediğin an geçebilirsin.",
    birincil: { etiket: "Başla", calistir: () => rehberBaslat(0) },
    ikincil: { etiket: "Atla", calistir: kapat },
  }), null);
  // Başka bir ekrana geçilirse davet kendiliğinden kalkar
  const git = () => kapat();
  R.temizlik.push(bus.on("git", git));
  addEventListener("popstate", git);
  R.temizlik.push(() => removeEventListener("popstate", git));
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
    birincil: { etiket: son ? "Başla" : "Sonraki", calistir: () => (son ? kapat() : rehberBaslat(i + 1)) },
    ikincil: son ? null : { etiket: "Atla", calistir: kapat },
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
