// Kenar Notu: örnek çizgi roman (OZELLIKLER-5 bölüm 3.6). Tarayıcıda tuvale çizilir, CBZ olarak paketlenir.
// "Kedi, Kutu ve Dalga": 1927'de bir laboratuvar, kedi Planck ve konuşan dalga fonksiyonu Psi.
// Hazır görsel ya da alıntı yok; bütün çizimler aşağıdaki yollarla yapılır.
//
// ornekCizgiRoman() -> Promise<Blob>  (application/vnd.comicbook+zip; 8 görsel, biri çift sayfa, ComicInfo.xml)
// ORNEK_CIZGI: kabuğun kitaplık kaydı için önerilen alanlar

export const ORNEK_CIZGI = {
  id: "kedi-kutu-dalga", tur: "cizgi", ad: "Kedi, Kutu ve Dalga", yazar: "Laboratuvar Defteri, Sayı 1",
  seri: "Laboratuvar Defteri", sayi: "1", sayfaSayisi: 8, yon: "ltr", dosyaAdi: "kedi-kutu-dalga.cbz",
};

const W = 1100, H = 1700, K = 48, O = 26;   // sayfa, kenar boşluğu, oluk
const TAM = Math.PI * 2;
const R = {
  kagit: "#F6EFDF", ink: "#1D1A17", bordo: "#8C2B38", hardal: "#D9A93F", lacivert: "#22385E", gece: "#18233A",
  turkuaz: "#2A9D93", isik: "#8FEADF", ten: "#F0C49C", kedi: "#E0893C", kediKoyu: "#B25E26", krem: "#FBF6EA",
  duvar: "#E7DCC2", duvar2: "#D9CBAA", tahta: "#2E3D37", ahsap: "#93603A", ahsapKoyu: "#6B4226", pembe: "#E79A9A",
  kumas: "#3A3D47", sac: "#3B2A22", balon: "#FFFFFF", altin: "#F2D27A",
};

// ---------- yazı ----------
const SANS = '"Inter", "Instrument Sans", "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Literata, Georgia, "Times New Roman", serif';
const EL = 'Caveat, "Segoe Print", "Comic Sans MS", cursive';
const harf = (boy) => `800 ${boy}px ${SANS}`;
const buyuk = (s) => s.toLocaleUpperCase("tr");

async function yaziTipleriniBekle() {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const ornek = "AaÇçĞğİıÖöŞşÜü ψΨħ∂Δ 0123456789";
  const iste = Promise.all([harf(30), `italic 600 28px ${SERIF}`, `700 80px ${SERIF}`, `600 40px ${EL}`]
    .map((f) => document.fonts.load(f, ornek).catch(() => [])));
  await Promise.race([iste, new Promise((r) => setTimeout(r, 2500))]);
}

function tuval(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  return cv;
}

// Satırlara böl: en piksel genişliğe sığacak kadar kelime
function sar(c, metin, en) {
  const satirlar = [];
  for (const parca of metin.split("\n")) {
    let satir = "";
    for (const k of parca.split(" ")) {
      const dene = satir ? satir + " " + k : k;
      if (satir && c.measureText(dene).width > en) { satirlar.push(satir); satir = k; } else satir = dene;
    }
    satirlar.push(satir);
  }
  return satirlar;
}

// ---------- temel çizimler ----------
function cizgiStil(c, kal = 4.5) {
  c.lineWidth = kal; c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = R.ink;
}
function doldurCiz(c, renk, kal) {
  c.fillStyle = renk; c.fill();
  if (kal !== 0) { if (kal) c.lineWidth = kal; c.stroke(); }
}
function elips(c, x, y, rx, ry, a = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), a, 0, TAM); }
function yuvarlak(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAM); }
function cokgen(c, noktalar, kapali = true) {
  c.beginPath();
  noktalar.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (kapali) c.closePath();
}
// Kalın dolgu çizgisi: önce mürekkep, sonra içi (kol, kuyruk, bacak)
function boru(c, noktalar, kalin, renk, kenar = 5, egri = true) {
  const yol = () => {
    c.beginPath();
    c.moveTo(noktalar[0][0], noktalar[0][1]);
    if (egri && noktalar.length === 3) c.quadraticCurveTo(noktalar[1][0], noktalar[1][1], noktalar[2][0], noktalar[2][1]);
    else if (egri && noktalar.length === 4) c.bezierCurveTo(...noktalar[1], ...noktalar[2], ...noktalar[3]);
    else for (const [x, y] of noktalar.slice(1)) c.lineTo(x, y);
  };
  c.save();
  c.lineCap = c.lineJoin = "round";
  yol(); c.strokeStyle = R.ink; c.lineWidth = kalin + kenar * 2; c.stroke();
  yol(); c.strokeStyle = renk; c.lineWidth = kalin; c.stroke();
  c.restore();
}

// Ben-Day noktaları: dönemin baskı gölgesi. r sayı ya da (x, y) -> yarıçap
function noktalar(c, x, y, w, h, renk, ara = 11, r = 2.4) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = renk;
  c.beginPath();
  let j = 0;
  for (let yy = y; yy < y + h + ara; yy += ara * 0.866, j++) {
    for (let xx = x + (j % 2 ? ara / 2 : 0); xx < x + w + ara; xx += ara) {
      const rr = typeof r === "function" ? r(xx, yy) : r;
      if (rr <= 0.2) continue;
      c.moveTo(xx + rr, yy);
      c.arc(xx, yy, rr, 0, TAM);
    }
  }
  c.fill();
  c.restore();
}

function hizCizgileri(c, x0, y0, x1, y1, adet, renk = R.ink, kal = 3) {
  c.save();
  c.strokeStyle = renk; c.lineCap = "round";
  for (let i = 0; i < adet; i++) {
    const t = (i + 0.5) / adet, oy = y0 + (y1 - y0) * t;
    const boy = 0.45 + 0.5 * Math.abs(Math.sin(i * 2.7));
    c.lineWidth = kal * (0.6 + 0.6 * Math.abs(Math.cos(i * 1.3)));
    c.beginPath(); c.moveTo(x0 + (x1 - x0) * (1 - boy), oy); c.lineTo(x1, oy); c.stroke();
  }
  c.restore();
}

function parilti(c, x, y, r, renk = "#FFFFFF") {
  c.save();
  c.fillStyle = renk;
  c.beginPath();
  c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
  c.restore();
}

// ---------- panel ----------
// İçerik panel kutusuna kırpılır, kenar 5 px mürekkep; yerel koordinat panelin sol üstü
function panel(c, x, y, w, h, ciz, { zemin = R.krem, kenar = 5 } = {}) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.translate(x, y);
  c.fillStyle = zemin; c.fillRect(0, 0, w, h);
  ciz(c, w, h);
  c.restore();
  c.save();
  c.lineWidth = kenar; c.strokeStyle = R.ink; c.lineJoin = "miter";
  c.strokeRect(x, y, w, h);
  c.restore();
}

// Konuşma balonu. x, y: balonun merkezi; kuyruk: konuşanın ağzına yakın uç (yerel)
function balon(c, { x, y, metin, en = 380, boy = 30, kuyruk = null, tur = "konus", zemin = R.balon, yazi = R.ink }) {
  c.save();
  c.font = harf(boy);
  if ("letterSpacing" in c) c.letterSpacing = "0.5px";
  const satirlar = sar(c, buyuk(metin), en);
  const lh = boy * 1.12;
  const tw = Math.max(...satirlar.map((s) => c.measureText(s).width));
  const th = satirlar.length * lh;
  const rx = tw / 2 * 1.36 + 18, ry = th / 2 * 1.42 + 16;
  cizgiStil(c, 3.5);
  const kuyrukYolu = (iceri = 0) => {
    if (!kuyruk) return null;
    const [tx, ty] = kuyruk, a = Math.atan2((ty - y) / ry, (tx - x) / rx);
    const yay = 0.22;
    const p = (t) => [x + Math.cos(a + t) * rx * (1 - iceri * 0.04), y + Math.sin(a + t) * ry * (1 - iceri * 0.06)];
    const [ax, ay] = p(-yay), [bx, by] = p(yay);
    const ucx = tx + (x - tx) * 0.03 * iceri, ucy = ty + (y - ty) * 0.03 * iceri;
    c.beginPath(); c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + ucx) / 2 + (y - ty) * 0.06, (ay + ucy) / 2, ucx, ucy);
    c.quadraticCurveTo((bx + ucx) / 2, (by + ucy) / 2 - (x - tx) * 0.04, bx, by);
    c.closePath();
    return true;
  };
  if (tur === "dusun") {
    // Düşünce bulutu: kenarda kabarcıklar, uca doğru küçülen yuvarlaklar
    const adet = 11;
    for (const asama of [0, 1]) {
      for (let i = 0; i < adet; i++) {
        const a = (i / adet) * TAM, bx = x + Math.cos(a) * rx * 0.92, by = y + Math.sin(a) * ry * 0.9;
        yuvarlak(c, bx, by, Math.min(rx, ry) * 0.42 + (i % 3) * 4);
        if (asama === 0) c.stroke(); else { c.fillStyle = zemin; c.fill(); }
      }
      elips(c, x, y, rx * 0.95, ry * 0.92);
      if (asama === 1) { c.fillStyle = zemin; c.fill(); }
    }
    if (kuyruk) {
      const [tx, ty] = kuyruk;
      [0.55, 0.75, 0.9].forEach((t, i) => {
        yuvarlak(c, x + (tx - x) * t, y + (ty - y) * t, 13 - i * 4);
        c.fillStyle = zemin; c.fill(); c.stroke();
      });
    }
  } else if (tur === "bagir") {
    const n = 18;
    c.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAM, k = i % 2 ? 1.0 : 1.22 + (i % 4 === 0 ? 0.08 : 0);
      const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = zemin; c.fill(); c.stroke();
    if (kuyrukYolu()) { c.fillStyle = zemin; c.fill(); c.stroke(); }
    elips(c, x, y, rx * 0.98, ry * 0.98); c.fillStyle = zemin; c.fill();
  } else {
    if (kuyrukYolu()) { c.fillStyle = zemin; c.fill(); c.stroke(); }
    elips(c, x, y, rx, ry); c.fillStyle = zemin; c.fill(); c.stroke();
    if (kuyrukYolu(1)) { c.fillStyle = zemin; c.fill(); }
  }
  c.fillStyle = yazi;
  c.textAlign = "center"; c.textBaseline = "middle";
  satirlar.forEach((s, i) => c.fillText(s, x, y - th / 2 + lh * (i + 0.5) + 1));
  c.restore();
  return { rx, ry };
}

// Anlatı kutusu: serifli italik, hardal kâğıt
function anlati(c, x, y, metin, { en = 420, boy = 27, zemin = R.altin, sag = false } = {}) {
  c.save();
  c.font = `italic 600 ${boy}px ${SERIF}`;
  const satirlar = sar(c, metin, en);
  const lh = boy * 1.25;
  const tw = Math.max(...satirlar.map((s) => c.measureText(s).width));
  const w = tw + 32, hh = satirlar.length * lh + 22;
  const x0 = sag ? x - w : x;
  c.fillStyle = zemin; c.fillRect(x0, y, w, hh);
  cizgiStil(c, 3.5); c.lineJoin = "miter"; c.strokeRect(x0, y, w, hh);
  c.fillStyle = R.ink; c.textBaseline = "middle";
  satirlar.forEach((s, i) => c.fillText(s, x0 + 16, y + 11 + lh * (i + 0.5)));
  c.restore();
}

// Ses yansıması: kalın, eğik, iki katmanlı
function ses(c, x, y, metin, { boy = 90, aci = -0.12, renk = R.hardal, golge = R.bordo } = {}) {
  c.save();
  c.translate(x, y); c.rotate(aci);
  c.font = `900 ${boy}px ${SANS}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineWidth = boy * 0.16; c.strokeStyle = R.ink;
  c.fillStyle = golge;
  c.strokeText(metin, 6, 7); c.fillText(metin, 6, 7);
  c.strokeText(metin, 0, 0);
  c.fillStyle = renk; c.fillText(metin, 0, 0);
  c.restore();
}

// ---------- karakterler ----------

// Kedi Planck. x, y: yere değen orta nokta; poz: otur, kos, uyu, zipla, bak; goz: acik, kapali, saskin, kivrik, yari
function kedi(c, x, y, s, { yon = 1, poz = "otur", goz = "acik", agiz = "kapali", tuy = false } = {}) {
  c.save();
  c.translate(x, y); c.scale(s * yon, s);
  const L = 4.5 / s;
  cizgiStil(c, L);
  if (poz === "otur") {
    boru(c, [[-38, -16], [-120, -6], [-128, -96], [-84, -128]], 20, R.kedi, L);
    elips(c, 0, -72, 58, 74); doldurCiz(c, R.kedi);
    // çizgiler
    c.save(); c.clip();
    c.strokeStyle = R.kediKoyu; c.lineWidth = 9;
    for (const k of [-110, -82, -54]) { c.beginPath(); c.moveTo(-64, k); c.quadraticCurveTo(-34, k - 12, -22, k + 4); c.stroke(); }
    c.restore();
    elips(c, 0, -72, 58, 74); c.stroke();
    elips(c, 22, -66, 22, 42); doldurCiz(c, R.krem, 0);
    elips(c, 8, -6, 18, 11); doldurCiz(c, R.kedi);
    elips(c, 38, -6, 18, 11); doldurCiz(c, R.kedi);
    kediKafa(c, 14, -160, goz, agiz, tuy);
  } else if (poz === "uyu") {
    boru(c, [[-86, -26], [-110, 10], [20, 14], [60, -6]], 20, R.kedi, L);
    elips(c, -6, -46, 92, 48); doldurCiz(c, R.kedi);
    c.save(); elips(c, -6, -46, 92, 48); c.clip();
    c.strokeStyle = R.kediKoyu; c.lineWidth = 10;
    for (const k of [-60, -30, 0]) { c.beginPath(); c.moveTo(k - 10, -94); c.quadraticCurveTo(k + 6, -60, k - 6, -40); c.stroke(); }
    c.restore();
    elips(c, -6, -46, 92, 48); c.stroke();
    kediKafa(c, 64, -50, "kapali", "kapali", false, 0.82, 0.25);
  } else if (poz === "kos" || poz === "zipla") {
    const egim = poz === "zipla" ? -0.35 : 0;
    c.rotate(egim);
    boru(c, [[-70, -70], [-120, -90], [-150, -150], [-120, -180]], 18, R.kedi, L);
    boru(c, [[-50, -46], [-80, -20], [-104, -6]], 18, R.kedi, L);
    boru(c, [[-30, -46], [-40, -14], [-66, 0]], 18, R.kedi, L);
    boru(c, [[50, -50], [80, -26], [112, -16]], 18, R.kedi, L);
    boru(c, [[34, -48], [50, -18], [80, -2]], 18, R.kedi, L);
    elips(c, 0, -70, 86, 40, -0.05); doldurCiz(c, R.kedi);
    c.save(); elips(c, 0, -70, 86, 40, -0.05); c.clip();
    c.strokeStyle = R.kediKoyu; c.lineWidth = 9;
    for (const k of [-46, -18, 10]) { c.beginPath(); c.moveTo(k, -112); c.quadraticCurveTo(k + 14, -84, k + 4, -60); c.stroke(); }
    c.restore();
    elips(c, 0, -70, 86, 40, -0.05); c.stroke();
    kediKafa(c, 92, -104, goz, agiz, tuy, 0.9);
  }
  c.restore();
}

function kediKafa(c, x, y, goz, agiz, tuy, o = 1, aci = 0) {
  c.save();
  c.translate(x, y); c.rotate(aci); c.scale(o, o);
  // kulaklar
  for (const [a, b, d] of [[[-44, -18], [-38, -72], [-8, -42]], [[8, -44], [40, -74], [46, -16]]]) {
    cokgen(c, [a, b, d]); doldurCiz(c, R.kedi);
  }
  cokgen(c, [[-34, -30], [-32, -58], [-16, -40]]); doldurCiz(c, R.pembe, 0);
  cokgen(c, [[18, -42], [36, -60], [36, -28]]); doldurCiz(c, R.pembe, 0);
  if (tuy) {
    // ürkmüş: kabarık tüy
    c.beginPath();
    for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI, r = i % 2 ? 54 : 62; c.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.95); }
    doldurCiz(c, R.kedi);
  }
  elips(c, 0, 0, 52, 46); doldurCiz(c, R.kedi);
  c.save(); c.strokeStyle = R.kediKoyu; c.lineWidth = 6;
  for (const dx of [-12, 0, 12]) { c.beginPath(); c.moveTo(dx, -44); c.lineTo(dx * 0.8, -28); c.stroke(); }
  c.restore();
  elips(c, 2, 18, 26, 17); doldurCiz(c, R.krem, 0);
  // gözler
  for (const gx of [-19, 21]) {
    if (goz === "kapali") { c.beginPath(); c.arc(gx, -4, 11, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
    else if (goz === "yari") {
      elips(c, gx, -4, 11, 8); doldurCiz(c, "#CFD86A");
      c.beginPath(); c.moveTo(gx - 13, -6); c.lineTo(gx + 13, -6); c.stroke();
      elips(c, gx + 1, -1, 2.5, 5); doldurCiz(c, R.ink, 0);
    } else if (goz === "saskin") {
      yuvarlak(c, gx, -6, 15); doldurCiz(c, "#FFFFFF");
      yuvarlak(c, gx + 2, -5, 4); doldurCiz(c, R.ink, 0);
    } else if (goz === "kivrik") {
      c.beginPath();
      for (let t = 0; t < 14; t += 0.3) { const r = t * 0.95; c.lineTo(gx + Math.cos(t) * r, -4 + Math.sin(t) * r); }
      c.stroke();
    } else {
      elips(c, gx, -4, 11, 13); doldurCiz(c, "#CFD86A");
      elips(c, gx + 2, -3, 3, 9); doldurCiz(c, R.ink, 0);
      yuvarlak(c, gx - 3, -9, 2.5); doldurCiz(c, "#FFFFFF", 0);
    }
  }
  // burun, ağız, bıyık
  cokgen(c, [[-5, 10], [7, 10], [1, 17]]); doldurCiz(c, R.pembe, 2);
  if (agiz === "acik") { elips(c, 1, 31, 11, 12); doldurCiz(c, "#5A1E22"); elips(c, 1, 37, 6, 4); doldurCiz(c, R.pembe, 0); }
  else { c.beginPath(); c.moveTo(1, 17); c.quadraticCurveTo(-4, 26, -12, 22); c.moveTo(1, 17); c.quadraticCurveTo(6, 26, 14, 22); c.stroke(); }
  c.save(); c.lineWidth = 2;
  for (const [a, b] of [[-1, 0], [-1, 1], [1, 0], [1, 1]]) {
    c.beginPath(); c.moveTo(a * 18, 18 + b * 6); c.lineTo(a * 58, 12 + b * 16); c.stroke();
  }
  c.restore();
  c.restore();
}

// Profesör Nur Hanım. x, y: ayakların ortası; poz: dur, tebesir, isaret, kutu, not, kapak
function profesor(c, x, y, s, { yon = 1, poz = "dur", agiz = "gulumse", ter = false } = {}) {
  c.save();
  c.translate(x, y); c.scale(s * yon, s);
  const L = 4.5 / s;
  cizgiStil(c, L);
  const kol = (pts) => {
    boru(c, pts, 30, R.krem, L, pts.length > 2);
    const [hx, hy] = pts[pts.length - 1];
    yuvarlak(c, hx, hy, 15); doldurCiz(c, R.ten);
  };
  // arka kol
  if (poz === "kutu") kol([[-62, -380], [-40, -300], [70, -270]]);
  else if (poz === "kapak") kol([[-62, -380], [-20, -330], [90, -350]]);
  else kol([[-66, -380], [-84, -290], [-82, -205]]);
  // ayaklar ve pantolon
  c.fillStyle = R.kumas;
  c.beginPath(); c.rect(-46, -150, 36, 140); c.rect(10, -150, 36, 140); c.fill(); c.stroke();
  elips(c, -30, -8, 32, 12); doldurCiz(c, R.ink, 0);
  elips(c, 32, -8, 32, 12); doldurCiz(c, R.ink, 0);
  // önlük
  c.beginPath();
  c.moveTo(-74, -392); c.lineTo(74, -392);
  c.quadraticCurveTo(92, -260, 98, -128); c.lineTo(-98, -128);
  c.quadraticCurveTo(-92, -260, -74, -392); c.closePath();
  doldurCiz(c, R.krem);
  c.beginPath(); c.moveTo(2, -330); c.lineTo(2, -128); c.stroke();
  cokgen(c, [[-32, -392], [2, -320], [36, -392]], false); c.stroke();
  for (const by of [-290, -240, -190]) { yuvarlak(c, 14, by, 4); doldurCiz(c, R.ink, 0); }
  c.beginPath(); c.rect(-70, -300, 38, 34); c.stroke();
  c.save(); c.lineWidth = 6;
  c.strokeStyle = R.lacivert; c.beginPath(); c.moveTo(-60, -300); c.lineTo(-60, -320); c.stroke();
  c.strokeStyle = R.bordo; c.beginPath(); c.moveTo(-48, -300); c.lineTo(-46, -324); c.stroke();
  c.restore();
  // boyun, papyon
  c.beginPath(); c.rect(-13, -416, 26, 26); doldurCiz(c, R.ten);
  cokgen(c, [[0, -394], [-24, -406], [-24, -382]]); doldurCiz(c, R.bordo);
  cokgen(c, [[0, -394], [24, -406], [24, -382]]); doldurCiz(c, R.bordo);
  // baş
  yuvarlak(c, -18, -520, 26); doldurCiz(c, R.sac);           // topuz
  yuvarlak(c, 0, -464, 50); doldurCiz(c, R.ten);
  c.beginPath();
  c.moveTo(-52, -458); c.bezierCurveTo(-56, -530, 50, -540, 52, -470);
  c.bezierCurveTo(30, -500, -6, -506, -20, -486);
  c.bezierCurveTo(-30, -500, -44, -490, -52, -458);
  doldurCiz(c, R.sac);
  // gözlük ve gözler
  for (const gx of [-18, 22]) {
    yuvarlak(c, gx, -460, 15); c.fillStyle = "#FFFFFF66"; c.fill(); c.stroke();
    yuvarlak(c, gx + 2, -459, 3.5); doldurCiz(c, R.ink, 0);
  }
  c.beginPath(); c.moveTo(-3, -462); c.quadraticCurveTo(2, -468, 7, -462); c.stroke();
  // ağız
  if (agiz === "acik") { elips(c, 4, -428, 9, 7); doldurCiz(c, "#5A1E22"); }
  else if (agiz === "duz") { c.beginPath(); c.moveTo(-6, -430); c.lineTo(12, -430); c.stroke(); }
  else { c.beginPath(); c.arc(4, -440, 13, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
  elips(c, -32, -440, 7, 4); c.fillStyle = "#E9967A88"; c.fill();
  elips(c, 38, -440, 7, 4); c.fill();
  if (ter) { c.beginPath(); c.moveTo(56, -500); c.quadraticCurveTo(66, -480, 58, -474); c.quadraticCurveTo(48, -480, 56, -500); doldurCiz(c, "#BFE3F2", 2.5); }
  // ön kol
  if (poz === "tebesir") {
    kol([[66, -380], [126, -420], [150, -500]]);
    c.save(); c.fillStyle = "#FFFFFF"; c.translate(160, -516); c.rotate(-0.6); c.fillRect(-4, -14, 9, 22); c.strokeRect(-4, -14, 9, 22); c.restore();
  } else if (poz === "isaret") {
    kol([[66, -380], [132, -366], [196, -378]]);
    c.beginPath(); c.moveTo(206, -380); c.lineTo(232, -384); c.lineWidth = 9 / s * 1.6; c.stroke(); c.lineWidth = L;
  } else if (poz === "kutu") kol([[66, -380], [98, -300], [96, -250]]);
  else if (poz === "kapak") kol([[66, -380], [120, -340], [150, -360]]);
  else if (poz === "not") {
    kol([[-40, -370], [-30, -300], [26, -296]]);
    c.save(); c.translate(36, -320); c.rotate(-0.15);
    c.fillStyle = R.bordo; c.fillRect(-10, -50, 74, 92); c.strokeRect(-10, -50, 74, 92);
    c.fillStyle = R.krem; c.fillRect(-4, -44, 64, 80);
    c.strokeStyle = "#8AA"; c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(2, -30 + i * 12); c.lineTo(54, -30 + i * 12); c.stroke(); }
    c.restore();
    kol([[66, -380], [104, -330], [84, -292]]);
  } else kol([[66, -380], [84, -290], [82, -205]]);
  c.restore();
}

// Psi: konuşan dalga paketi. x, y: tepe noktasının altındaki eksen
function psi(c, x, y, s, { genlik = 1, uzun = 1, goz = "acik", soluk = 1, yon = 1, isik = true, agiz = "gulumse" } = {}) {
  c.save();
  c.translate(x, y); c.scale(s * yon, s);
  c.globalAlpha = soluk;
  const yol = new Path2D();
  for (let i = 0; i <= 160; i++) {
    const t = -1 + (i / 160) * 2;
    const X = t * 140 * uzun, Y = -genlik * 56 * Math.exp(-t * t * 3.4) * Math.cos(t * 3.3 * Math.PI);
    i ? yol.lineTo(X, Y) : yol.moveTo(X, Y);
  }
  c.lineCap = c.lineJoin = "round";
  if (isik) { c.shadowColor = R.isik; c.shadowBlur = 28 * s; }
  c.strokeStyle = R.ink; c.lineWidth = 20; c.stroke(yol);
  c.shadowBlur = 0;
  c.strokeStyle = R.turkuaz; c.lineWidth = 13; c.stroke(yol);
  c.strokeStyle = "#D9FFF8"; c.lineWidth = 4; c.stroke(yol);
  // yüz: tepenin altında
  const ty = -genlik * 56;
  c.lineWidth = 3.5; c.strokeStyle = R.ink;
  for (const gx of [-13, 13]) {
    if (goz === "kirp" && gx > 0) { c.beginPath(); c.arc(gx, ty + 24, 8, 1.1 * Math.PI, 1.9 * Math.PI); c.stroke(); continue; }
    if (goz === "kapali") { c.beginPath(); c.arc(gx, ty + 20, 7, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); continue; }
    yuvarlak(c, gx, ty + 24, 9); doldurCiz(c, "#FFFFFF");
    yuvarlak(c, gx + 2, ty + 25, 4); doldurCiz(c, R.ink, 0);
  }
  if (agiz === "acik") { elips(c, 0, ty + 44, 7, 6); doldurCiz(c, "#1E4E4A"); }
  else { c.beginPath(); c.arc(0, ty + 36, 9, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  c.restore();
  if (isik) {
    parilti(c, x + 120 * s * uzun, y - 70 * s, 12 * s, "#FFFFFFCC");
    parilti(c, x - 110 * s * uzun, y - 40 * s, 8 * s, "#FFFFFFAA");
  }
}

// Ahşap kutu. kapak: "kapali" | "acik" | "yok"
function kutu(c, x, y, w, h, { kapak = "kapali", yazi = true } = {}) {
  cizgiStil(c, 4.5);
  c.beginPath(); c.rect(x, y, w, h); doldurCiz(c, R.ahsap);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = R.ahsapKoyu; c.lineWidth = 3;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x, y + (h * i) / 4); c.lineTo(x + w, y + (h * i) / 4); c.stroke(); }
  c.lineWidth = 10; c.strokeStyle = "#7A4E2E";
  c.beginPath(); c.moveTo(x + 10, y + 10); c.lineTo(x + w - 10, y + h - 10); c.stroke();
  c.restore();
  c.beginPath(); c.rect(x, y, w, h); c.stroke();
  if (yazi) {
    c.save();
    c.font = `800 ${Math.round(h * 0.17)}px ${SANS}`;
    c.fillStyle = "#F3E3C3"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("KUTU No. 1", x + w / 2, y + h * 0.36);
    c.restore();
  }
  if (kapak === "kapali") {
    c.beginPath(); c.rect(x - 12, y - 22, w + 24, 26); doldurCiz(c, R.ahsapKoyu);
  }
}
// Açık kapak: kutunun arkasında dikilen kapak; kutudan önce çizilir
function acikKapak(c, x, y, w, h) {
  cizgiStil(c, 4.5);
  cokgen(c, [[x - 8, y + 4], [x + w + 8, y + 4], [x + w - 26, y - h * 0.42], [x + 26, y - h * 0.42]]);
  doldurCiz(c, R.ahsapKoyu);
  c.save(); c.strokeStyle = "#5A3820"; c.lineWidth = 3;
  for (const t of [0.33, 0.66]) { c.beginPath(); c.moveTo(x + 10 + t * 16, y - h * 0.42 * t); c.lineTo(x + w - 10 - t * 16, y - h * 0.42 * t); c.stroke(); }
  c.restore();
  c.beginPath(); c.rect(x, y - 2, w, 16); c.fillStyle = "#2E1C0E"; c.fill();
}

function karaTahta(c, x, y, w, h, formuller = [], boy = 44) {
  cizgiStil(c, 4.5);
  c.beginPath(); c.rect(x - 14, y - 14, w + 28, h + 28); doldurCiz(c, R.ahsap);
  c.beginPath(); c.rect(x, y, w, h); doldurCiz(c, R.tahta);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  noktalar(c, x, y, w, h, "#FFFFFF0F", 9, (xx, yy) => 2.2 * (1 - (yy - y) / h));
  c.font = `600 ${boy}px ${EL}`;
  c.fillStyle = "#F4F1E6E0"; c.textBaseline = "top";
  formuller.forEach(([m, fx, fy, b]) => {
    c.save(); if (b) c.font = `600 ${b}px ${EL}`;
    c.fillText(m, x + fx, y + fy); c.restore();
  });
  c.restore();
}

function laboratuvar(c, w, h, { pencere = true, raf = true, zemin = 0.72 } = {}) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, R.duvar2); g.addColorStop(1, R.duvar);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  noktalar(c, 0, 0, w, h * zemin, "#B9A47A55", 12, (xx, yy) => 2.6 * (1 - yy / (h * zemin)));
  c.fillStyle = "#B88E5E"; c.fillRect(0, h * zemin, w, h);
  c.strokeStyle = "#8B6640"; c.lineWidth = 3;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, h * zemin + i * 30); c.lineTo(w, h * zemin + i * 30); c.stroke(); }
  cizgiStil(c, 4.5);
  c.beginPath(); c.moveTo(0, h * zemin); c.lineTo(w, h * zemin); c.stroke();
  if (pencere) {
    const px = w * 0.06, py = h * 0.1, pw = w * 0.2, ph = h * 0.36;
    c.beginPath(); c.rect(px, py, pw, ph); doldurCiz(c, R.gece);
    noktalar(c, px, py, pw, ph, "#3C5687", 10, 2.4);
    yuvarlak(c, px + pw * 0.66, py + ph * 0.3, Math.min(pw, ph) * 0.16); doldurCiz(c, "#F3E7B9", 0);
    yuvarlak(c, px + pw * 0.6, py + ph * 0.27, Math.min(pw, ph) * 0.14); doldurCiz(c, R.gece, 0);
    c.lineWidth = 6; c.beginPath(); c.moveTo(px + pw / 2, py); c.lineTo(px + pw / 2, py + ph); c.moveTo(px, py + ph / 2); c.lineTo(px + pw, py + ph / 2); c.stroke();
    c.lineWidth = 4.5; c.strokeRect(px, py, pw, ph);
  }
  if (raf) {
    const rx = w * 0.78, ry = h * 0.12, rw = w * 0.2, rh = h * 0.55;
    c.beginPath(); c.rect(rx, ry, rw, rh); doldurCiz(c, R.ahsapKoyu);
    const renkler = [R.bordo, R.lacivert, R.hardal, "#4F6B4A", "#7A5C8A", R.bordo, "#2F5E6E"];
    for (let r = 0; r < 3; r++) {
      const zy = ry + 12 + r * (rh / 3);
      let bx = rx + 10;
      for (let i = 0; bx < rx + rw - 18; i++) {
        const kw = 12 + ((i * 7 + r * 3) % 9), kh = rh / 3 - 26 - ((i * 5 + r) % 4) * 6;
        c.beginPath(); c.rect(bx, zy + (rh / 3 - 22 - kh), kw, kh); doldurCiz(c, renkler[(i + r * 2) % renkler.length], 2.5);
        bx += kw + 2;
      }
      c.beginPath(); c.rect(rx, zy + rh / 3 - 22, rw, 8); doldurCiz(c, R.ahsap, 2.5);
    }
  }
}

// İki yarık levhası: dikey koyu levha, iki boşluk
function yarikLevha(c, x, y, h, { kal = 26, bosluk = 34, ara = 0.2 } = {}) {
  cizgiStil(c, 4);
  const y1 = y + h * (0.5 - ara) - bosluk / 2, y2 = y + h * (0.5 + ara) - bosluk / 2;
  for (const [a, b] of [[y, y1], [y1 + bosluk, y2], [y2 + bosluk, y + h]]) {
    c.beginPath(); c.rect(x, a, kal, b - a); doldurCiz(c, "#4A4F5A");
  }
  return [y1 + bosluk / 2, y2 + bosluk / 2];
}

// Yarıklardan çıkan dalga cepheleri (eşmerkezli yaylar)
function dalgaCepheleri(c, x, yarikY, r0, r1, adim, renk) {
  c.save();
  c.lineWidth = 5; c.lineCap = "round";
  for (const yy of yarikY) {
    for (let r = r0; r < r1; r += adim) {
      c.strokeStyle = renk; c.globalAlpha = Math.max(0.15, 1 - (r - r0) / (r1 - r0)) * 0.9;
      c.beginPath(); c.arc(x, yy, r, -Math.PI / 2.4, Math.PI / 2.4); c.stroke();
    }
  }
  c.restore();
}

// Girişim deseni: cos² parlaklığı, dikey ekran üstünde yatay şeritler
function girisimDeseni(c, x, y, w, h, merkez = 0.5, periyot = 0.12) {
  c.fillStyle = "#0F1A26"; c.fillRect(x, y, w, h);
  for (let i = 0; i < h; i += 2) {
    const u = (i / h - merkez) / periyot;
    const zarf = Math.exp(-((i / h - merkez) ** 2) / 0.09);
    const p = Math.cos(u * Math.PI) ** 2 * zarf;
    c.fillStyle = `rgba(143, 234, 223, ${p.toFixed(3)})`;
    c.fillRect(x, y + i, w, 2);
  }
  cizgiStil(c, 4.5); c.strokeRect(x, y, w, h);
}

// ---------- sayfalar ----------

function kapakSayfasi(c) {
  // Gece mavisi zemin, yukarıdan aşağı seyrelen noktalar
  c.fillStyle = R.gece; c.fillRect(0, 0, W, H);
  noktalar(c, 0, 0, W, H, "#2B3E63", 14, (x, y) => 3.4 * (1 - y / H) + 0.6);
  // silik formüller
  c.save(); c.globalAlpha = 0.16; c.fillStyle = "#E9E1C9";
  c.font = `600 64px ${EL}`;
  [["iħ ∂ψ/∂t = Ĥψ", 70, 420], ["|ψ|²", 820, 520], ["ΔxΔp ≥ ħ/2", 600, 760], ["E = hν", 90, 900], ["λ = h/p", 760, 1010]]
    .forEach(([m, x, y]) => c.fillText(m, x, y));
  c.restore();
  // künye bandı
  c.fillStyle = R.bordo; c.fillRect(0, 0, W, 150);
  cizgiStil(c, 5); c.beginPath(); c.moveTo(0, 150); c.lineTo(W, 150); c.stroke();
  c.fillStyle = "#F3E3C3"; c.font = `700 30px ${SANS}`;
  if ("letterSpacing" in c) c.letterSpacing = "8px";
  c.textBaseline = "middle";
  c.fillText("LABORATUVAR DEFTERİ", 56, 62);
  if ("letterSpacing" in c) c.letterSpacing = "2px";
  c.font = `600 22px ${SANS}`; c.fillStyle = "#F3E3C3CC";
  c.fillText("SAYI 1   ·   KOPENHAG 1927", 56, 108);
  if ("letterSpacing" in c) c.letterSpacing = "0px";
  // fiyat yuvarlağı
  yuvarlak(c, W - 110, 82, 54); doldurCiz(c, R.altin, 4);
  c.fillStyle = R.ink; c.textAlign = "center";
  c.font = `800 34px ${SANS}`; c.fillText("5", W - 110, 66);
  c.font = `700 16px ${SANS}`; c.fillText("KURUŞ", W - 110, 102);
  c.textAlign = "left";
  // başlık
  c.save();
  c.font = `800 128px ${SERIF}`;
  c.lineJoin = "round";
  for (const [m, y] of [["Kedi, Kutu", 300], ["ve Dalga", 432]]) {
    c.lineWidth = 16; c.strokeStyle = R.ink; c.strokeText(m, 58, y + 8);
    c.fillStyle = R.bordo; c.fillText(m, 58, y + 8);
    c.strokeText(m, 50, y);
    c.fillStyle = "#F6EBD0"; c.fillText(m, 50, y);
  }
  c.restore();
  // ışık halkası ve Psi
  const g = c.createRadialGradient(560, 900, 40, 560, 900, 520);
  g.addColorStop(0, "#8FEADF55"); g.addColorStop(1, "#8FEADF00");
  c.fillStyle = g; c.fillRect(0, 380, W, 1000);
  psi(c, 560, 690, 2.0, { genlik: 1.1, uzun: 1.15 });
  // kutu ve kedi
  kutu(c, 300, 1180, 500, 330, { kapak: "kapali" });
  kedi(c, 560, 1158, 1.75, { yon: 1, goz: "saskin", agiz: "kapali" });
  // zemin gölgesi
  c.fillStyle = "#00000055"; elips(c, 550, 1520, 330, 26); c.fill();
  // alt satır
  anlati(c, 56, 1560, "Aynı anda iki yerde olabilen bir dalga, meraklı bir kedi ve kapalı bir kutu.", { en: 900, boy: 30, zemin: "#F6EBD0" });
}

function sayfa2(c) {
  const ust = 470, orta = 520, alt = H - 2 * K - ust - orta - 2 * O;
  const y2 = K + ust + O, y3 = y2 + orta + O;
  panel(c, K, K, W - 2 * K, ust, (c, w, h) => {
    laboratuvar(c, w, h, { zemin: 0.8 });
    karaTahta(c, w * 0.36, h * 0.16, w * 0.36, h * 0.42, [["iħ ∂ψ/∂t = ...", 26, 30], ["ΔxΔp ≥ ħ/2", 30, 110, 36]], 42);
    // masa ve lamba
    c.beginPath(); c.rect(w * 0.08, h * 0.66, w * 0.3, 22); doldurCiz(c, R.ahsap, 4);
    c.beginPath(); c.rect(w * 0.1, h * 0.66 + 22, 18, h * 0.3); c.rect(w * 0.35, h * 0.66 + 22, 18, h * 0.3); doldurCiz(c, R.ahsapKoyu, 4);
    const lx = w * 0.3, ly = h * 0.66;
    c.save(); const lg = c.createRadialGradient(lx, ly - 40, 10, lx, ly - 40, 200); lg.addColorStop(0, "#FFF2B866"); lg.addColorStop(1, "#FFF2B800");
    c.fillStyle = lg; c.fillRect(lx - 220, ly - 250, 440, 400); c.restore();
    cokgen(c, [[lx - 34, ly - 70], [lx + 34, ly - 70], [lx + 14, ly - 108], [lx - 14, ly - 108]]); doldurCiz(c, "#3E6B5A");
    c.beginPath(); c.moveTo(lx, ly - 70); c.lineTo(lx, ly); c.stroke();
    kedi(c, w * 0.2, h * 0.66, 0.42, { goz: "acik" });
    anlati(c, 20, 18, "Kopenhag, 1927. Enstitüde herkes evine gitmiş. Neredeyse herkes.", { en: 520 });
  });
  const solW = Math.round((W - 2 * K - O) * 0.42);
  panel(c, K, y2, solW, orta, (c, w, h) => {
    c.fillStyle = "#EFD9A8"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#D4B46E", 12, 2.8);
    // kitap yığını
    const renk = [R.lacivert, R.bordo, "#4F6B4A", R.hardal];
    for (let i = 0; i < 4; i++) { c.beginPath(); c.rect(w * 0.12 + (i % 2) * 14, h - 70 - i * 46, w * 0.72, 44); doldurCiz(c, renk[i], 4); }
    kedi(c, w * 0.5, h - 70 - 3 * 46 + 2, 1.05, { goz: "kapali", agiz: "acik" });
    ses(c, w * 0.5, h * 0.17, "MİYAAV", { boy: 66, aci: -0.08 });
  });
  panel(c, K + solW + O, y2, W - 2 * K - solW - O, orta, (c, w, h) => {
    c.fillStyle = R.duvar; c.fillRect(0, 0, w, h);
    karaTahta(c, 30, 40, w - 60, h * 0.5, [["iħ ∂ψ/∂t", 30, 40, 52], ["= Ĥψ ?", 220, 120, 52]]);
    profesor(c, w * 0.62, h + 140, 1.0, { poz: "tebesir", yon: -1, agiz: "duz" });
    balon(c, { x: w * 0.36, y: h * 0.78, metin: "Sessiz ol, Planck. Denklem bitmek üzere.", en: 270, kuyruk: [w * 0.56, h * 0.62] });
  });
  panel(c, K, y3, W - 2 * K, alt, (c, w, h) => {
    c.fillStyle = R.tahta; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#FFFFFF10", 10, 2.4);
    c.save(); c.font = `600 120px ${EL}`; c.fillStyle = "#F4F1E6E8"; c.textBaseline = "middle";
    c.fillText("iħ ∂ψ/∂t = Ĥψ", 60, h * 0.36);
    c.lineWidth = 6; c.strokeStyle = "#F4F1E6C0"; c.beginPath(); c.moveTo(60, h * 0.36 + 70); c.quadraticCurveTo(400, h * 0.36 + 84, 720, h * 0.36 + 64); c.stroke();
    c.restore();
    const g = c.createRadialGradient(w * 0.62, h * 0.38, 10, w * 0.62, h * 0.38, 240);
    g.addColorStop(0, "#8FEADF88"); g.addColorStop(1, "#8FEADF00");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    psi(c, w * 0.66, h * 0.72, 0.85, { genlik: 0.7, goz: "kapali" });
    ses(c, w * 0.2, h * 0.82, "VIZZ", { boy: 84, aci: -0.1, renk: R.isik, golge: R.turkuaz });
    // el ve tebeşir
    boru(c, [[w + 40, h * 0.9], [w - 120, h * 0.78], [w - 190, h * 0.62]], 46, R.krem, 5);
    yuvarlak(c, w - 196, h * 0.6, 24); doldurCiz(c, R.ten, 4.5);
    balon(c, { x: w * 0.66, y: h * 0.12, metin: "Ve... tamam!", en: 300, kuyruk: [w * 0.86, h * 0.5] });
  });
}

function sayfa3(c) {
  const sat = 440, alt = H - 2 * K - 2 * sat - 2 * O, yar = (W - 2 * K - O) / 2;
  const kutular = [[K, K], [K + yar + O, K], [K, K + sat + O], [K + yar + O, K + sat + O]];
  const icler = [
    (c, w, h) => {
      c.fillStyle = R.tahta; c.fillRect(0, 0, w, h);
      noktalar(c, 0, 0, w, h, "#FFFFFF12", 10, 2.4);
      const g = c.createRadialGradient(w / 2, h * 0.6, 10, w / 2, h * 0.6, 260);
      g.addColorStop(0, "#8FEADF99"); g.addColorStop(1, "#8FEADF00");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      psi(c, w * 0.5, h * 0.74, 1.15, { genlik: 1 });
      balon(c, { x: w * 0.42, y: h * 0.2, metin: "Merhaba! Ben Psi.", en: 300, kuyruk: [w * 0.5, h * 0.48] });
    },
    (c, w, h) => {
      c.fillStyle = "#F3C7A8"; c.fillRect(0, 0, w, h);
      // şaşkınlık ışınları
      c.save(); c.fillStyle = "#F8DCC6";
      for (let i = 0; i < 16; i++) { c.beginPath(); c.moveTo(w * 0.5, h * 0.7); c.arc(w * 0.5, h * 0.7, w, (i / 16) * TAM, ((i + 0.5) / 16) * TAM); c.fill(); }
      c.restore();
      kedi(c, w * 0.5, h + 40, 1.45, { goz: "saskin", agiz: "acik", tuy: true });
      balon(c, { x: w * 0.5, y: h * 0.16, metin: "!", en: 80, boy: 64, tur: "bagir", kuyruk: [w * 0.5, h * 0.36] });
    },
    (c, w, h) => {
      c.fillStyle = R.duvar; c.fillRect(0, 0, w, h);
      noktalar(c, 0, 0, w, h, "#C9B68C66", 12, 2.4);
      psi(c, w * 0.22, h * 0.56, 0.5, { soluk: 0.45 });
      psi(c, w * 0.78, h * 0.66, 0.5, { soluk: 0.45 });
      psi(c, w * 0.5, h * 0.84, 0.62, { soluk: 1, agiz: "acik" });
      balon(c, { x: w * 0.5, y: h * 0.22, metin: "Aynı anda birçok yerde dolaşırım!", en: 330, kuyruk: [w * 0.5, h * 0.62] });
    },
    (c, w, h) => {
      c.fillStyle = "#D9E4D2"; c.fillRect(0, 0, w, h);
      noktalar(c, 0, 0, w, h, "#B7CBB0", 11, 2.6);
      kedi(c, w * 0.42, h + 30, 1.2, { goz: "kivrik" });
      balon(c, { x: w * 0.66, y: h * 0.2, metin: "Hangisini yakalasam?", en: 250, tur: "dusun", kuyruk: [w * 0.48, h * 0.48] });
    },
  ];
  kutular.forEach(([x, y], i) => panel(c, x, y, yar, sat, icler[i]));
  panel(c, K, K + 2 * (sat + O), W - 2 * K, alt, (c, w, h) => {
    laboratuvar(c, w, h, { pencere: false, raf: true, zemin: 0.78 });
    psi(c, w * 0.2, h * 0.4, 0.55, { soluk: 0.25, isik: false });
    psi(c, w * 0.5, h * 0.3, 0.55, { soluk: 0.25, isik: false });
    hizCizgileri(c, w * 0.06, h * 0.48, w * 0.38, h * 0.74, 7);
    kedi(c, w * 0.46, h * 0.8, 1.15, { poz: "zipla", goz: "acik" });
    psi(c, w * 0.78, h * 0.42, 0.8, { genlik: 1.1, goz: "kirp" });
    ses(c, w * 0.28, h * 0.2, "HOP!", { boy: 96 });
    balon(c, { x: w * 0.74, y: h * 0.14, metin: "Bana bakınca tek bir yerde olurum. Kural bu!", en: 380, kuyruk: [w * 0.78, h * 0.3] });
  });
}

function sayfa4(c) {
  const ust = 380, alt = H - 2 * K - ust - O, sut = (W - 2 * K - 2 * O) / 3;
  panel(c, K, K, W - 2 * K, ust, (c, w, h) => {
    c.fillStyle = "#CFE7E3"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#A8D3CD", 12, (x) => 3 * (x / w));
    hizCizgileri(c, 0, h * 0.3, w * 0.55, h * 0.8, 9, "#2A9D9399", 4);
    psi(c, w * 0.66, h * 0.68, 0.95, { genlik: 1.1, agiz: "acik" });
    balon(c, { x: w * 0.25, y: h * 0.36, metin: "Yakala beni, Planck!", en: 340, kuyruk: [w * 0.6, h * 0.5] });
  });
  const y = K + ust + O;
  panel(c, K, y, sut, alt, (c, w, h) => {
    laboratuvar(c, w * 3, h, { pencere: false, raf: false, zemin: 0.82 });
    psi(c, w * 0.5, h * 0.3, 0.6, { yon: -1 });
    hizCizgileri(c, w * 0.1, h * 0.36, w * 0.9, h * 0.44, 4, R.turkuaz, 3);
    kedi(c, w * 0.42, h * 0.82, 0.8, { poz: "kos", goz: "acik" });
    ses(c, w * 0.5, h * 0.6, "TIP TIP", { boy: 48, aci: -0.2 });
  });
  panel(c, K + sut + O, y, sut, alt, (c, w, h) => {
    c.fillStyle = R.ahsapKoyu; c.fillRect(0, 0, w, h);
    const renk = [R.bordo, R.lacivert, R.hardal, "#4F6B4A", "#7A5C8A"];
    for (let r = 0; r < 4; r++) {
      const ry = 60 + r * (h / 4);
      for (let i = 0, bx = 10; bx < w - 20; i++) {
        const kw = 22 + ((i * 7 + r) % 3) * 6;
        c.save(); c.translate(bx, ry + 150); c.rotate(r === 2 && i > 3 ? 0.4 : 0);
        c.beginPath(); c.rect(0, -150 + ((i + r) % 3) * 12, kw, 150 - ((i + r) % 3) * 12); doldurCiz(c, renk[(i + r) % 5], 3.5);
        c.restore();
        bx += kw + 3;
      }
      c.beginPath(); c.rect(0, ry + 150, w, 14); doldurCiz(c, R.ahsap, 4);
    }
    kedi(c, w * 0.52, h * 0.5 + 150 + 60, 0.75, { poz: "otur", goz: "acik" });
    for (const [bx, by, a] of [[w * 0.2, h * 0.84, 0.6], [w * 0.62, h * 0.9, -0.5]]) {
      c.save(); c.translate(bx, by); c.rotate(a);
      c.beginPath(); c.rect(-20, -60, 40, 120); doldurCiz(c, R.bordo, 4); c.restore();
    }
    ses(c, w * 0.5, h * 0.74, "PAT!", { boy: 72, aci: 0.18 });
  });
  panel(c, K + 2 * (sut + O), y, sut, alt, (c, w, h) => {
    c.fillStyle = R.duvar; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#C9B68C66", 12, 2.4);
    profesor(c, w * 0.3, h - 30, 1.05, { poz: "isaret", agiz: "acik" });
    // elinde iki yarıklı levha
    yarikLevha(c, w * 0.3 + 196 * 1.05 - 14, h - 30 - 378 * 1.05 - 120, 240, { kal: 28, bosluk: 22, ara: 0.18 });
    balon(c, { x: w * 0.5, y: h * 0.2, metin: "Durun! Şuradan geçin: iki yarık!", en: 230, kuyruk: [w * 0.34, h * 0.42] });
  });
}

// Çift sayfa: iki yarık deneyi. Ortadaki oluk boş kalır, iki sayfa ayrı okunur.
function ciftSayfa(c) {
  const sx = W;   // sağ sayfanın başı
  const ust = 1000, alt = H - 2 * K - ust - O;
  // sol: üst büyük panel
  panel(c, K, K, W - 2 * K + 12, ust, (c, w, h) => {
    c.fillStyle = "#14212E"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#24394E", 12, 2.6);
    const lx = w * 0.42;
    const yariklar = yarikLevha(c, lx, 40, h - 80, { kal: 34, bosluk: 40, ara: 0.14 });
    dalgaCepheleri(c, lx + 34, yariklar, 40, w * 0.62, 42, R.isik);
    psi(c, w * 0.18, h * 0.5, 0.9, { genlik: 1 });
    hizCizgileri(c, 0, h * 0.44, w * 0.12, h * 0.56, 3, R.isik, 3);
    anlati(c, 24, 24, "İki yarık deneyi. Psi ikisine birden yöneldi.", { en: 360 });
  });
  panel(c, K, K + ust + O, W - 2 * K + 12, alt, (c, w, h) => {
    c.fillStyle = "#F0D9B5"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#E2BF8A", 12, 2.6);
    yarikLevha(c, w * 0.72, 20, h - 40, { kal: 30, bosluk: 34, ara: 0.18 });
    kedi(c, w * 0.36, h + 20, 1.3, { goz: "saskin" });
    balon(c, { x: w * 0.36, y: h * 0.16, metin: "Hangi yarıktan geçti?", en: 360, tur: "dusun", kuyruk: [w * 0.4, h * 0.44] });
  });
  // sağ: girişim deseni
  const ust2 = 1100, alt2 = H - 2 * K - ust2 - O;
  panel(c, sx + K - 12, K, W - 2 * K + 12, ust2, (c, w, h) => {
    c.fillStyle = "#14212E"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#24394E", 12, 2.6);
    dalgaCepheleri(c, -w * 0.08, [h * 0.42, h * 0.58], w * 0.12, w * 0.6, 42, R.isik);
    girisimDeseni(c, w * 0.66, 50, w * 0.16, h - 280, 0.5, 0.11);
    profesor(c, w * 0.34, h + 60, 1.02, { poz: "isaret", agiz: "acik", yon: 1 });
    kedi(c, w * 0.9, h - 30, 0.75, { goz: "saskin", yon: -1 });
    balon(c, { x: w * 0.3, y: h * 0.12, metin: "İkisinden birden! Bak, çizgi çizgi bir desen.", en: 380, kuyruk: [w * 0.3, h * 0.42] });
    ses(c, w * 0.6, h * 0.95, "Işık + ışık = karanlık?", { boy: 30, aci: -0.04, renk: "#F6EBD0", golge: R.lacivert });
  });
  panel(c, sx + K - 12, K + ust2 + O, W - 2 * K + 12, alt2, (c, w, h) => {
    girisimDeseni(c, 0, 0, w, h, 0.5, 0.18);
    // pati şeritlere değiyor
    boru(c, [[w * 0.2, h + 40], [w * 0.36, h * 0.7], [w * 0.5, h * 0.56]], 52, R.kedi, 5);
    elips(c, w * 0.52, h * 0.52, 36, 28); doldurCiz(c, R.kedi, 5);
    for (const [px, py] of [[-22, -18], [-4, -26], [16, -22]]) { elips(c, w * 0.52 + px, h * 0.52 + py, 9, 8); doldurCiz(c, R.pembe, 3); }
    balon(c, { x: w * 0.74, y: h * 0.34, metin: "Mrr... çizgili. Benim gibi.", en: 260, kuyruk: [w * 0.56, h * 0.5] });
  });
}

function sayfa6(c) {
  const sol = 420, sagX = K + sol + O, sagW = W - K - sagX, kh = (H - 2 * K - 2 * O) / 3;
  panel(c, K, K, sol, H - 2 * K, (c, w, h) => {
    laboratuvar(c, w * 2.4, h, { pencere: true, raf: false, zemin: 0.84 });
    profesor(c, w * 0.42, h * 0.84, 1.18, { poz: "kutu" });
    kutu(c, w * 0.42, h * 0.84 - 360, 190, 140, { kapak: "yok", yazi: false });
    anlati(c, 16, 16, "Ertesi gece. Yeni bir deney.", { en: 300 });
    balon(c, { x: w * 0.48, y: h * 0.12, metin: "Planck, bu kutuya sığar mısın?", en: 240, kuyruk: [w * 0.42, h * 0.32] });
  });
  const icler = [
    (c, w, h) => {
      c.fillStyle = "#E9D8B4"; c.fillRect(0, 0, w, h);
      kutu(c, w * 0.08, h * 0.38, w * 0.5, h * 0.5, { kapak: "yok" });
      kedi(c, w * 0.78, h * 0.94, 0.92, { yon: -1, goz: "acik" });
      balon(c, { x: w * 0.36, y: h * 0.18, metin: "?", en: 60, boy: 56, kuyruk: [w * 0.62, h * 0.42] });
    },
    (c, w, h) => {
      c.fillStyle = R.tahta; c.fillRect(0, 0, w, h);
      noktalar(c, 0, 0, w, h, "#FFFFFF12", 10, 2.4);
      psi(c, w * 0.32, h * 0.72, 0.9, { genlik: 1.2, agiz: "acik" });
      balon(c, { x: w * 0.68, y: h * 0.3, metin: "Kutu mu? Ben de geleyim!", en: 240, kuyruk: [w * 0.4, h * 0.5] });
    },
    (c, w, h) => {
      c.fillStyle = "#EFC9A4"; c.fillRect(0, 0, w, h);
      noktalar(c, 0, 0, w, h, "#E2AE82", 11, 2.6);
      kutu(c, w * 0.3, h * 0.5, w * 0.46, h * 0.44, { kapak: "yok" });
      kedi(c, w * 0.42, h * 0.56, 0.8, { poz: "zipla", goz: "kapali" });
      psi(c, w * 0.2, h * 0.32, 0.45, { genlik: 1.2 });
      ses(c, w * 0.76, h * 0.22, "HOP!", { boy: 80, aci: 0.12 });
    },
  ];
  icler.forEach((ciz, i) => panel(c, sagX, K + i * (kh + O), sagW, kh, ciz));
}

function sayfa7(c) {
  const kh = (H - 2 * K - 2 * O) / 3;
  panel(c, K, K, W - 2 * K, kh, (c, w, h) => {
    laboratuvar(c, w, h, { pencere: true, raf: true, zemin: 0.8 });
    kutu(c, w * 0.38, h * 0.42, w * 0.26, h * 0.38, { kapak: "kapali" });
    // aralıklardan sızan ışık
    c.save(); c.globalAlpha = 0.85; c.strokeStyle = R.isik; c.lineWidth = 4; c.shadowColor = R.isik; c.shadowBlur = 18;
    for (const k of [0.2, 0.45, 0.7]) { c.beginPath(); c.moveTo(w * 0.38 + w * 0.26 * k, h * 0.4); c.lineTo(w * 0.38 + w * 0.26 * k + 8, h * 0.28); c.stroke(); }
    c.restore();
    anlati(c, w - 18, 18, "Kutu kapalı. İçine kimse bakmıyor.", { en: 360, sag: true });
  });
  panel(c, K, K + kh + O, W - 2 * K, kh, (c, w, h) => {
    c.fillStyle = "#07080B"; c.fillRect(0, 0, w, h);
    psi(c, w * 0.5, h * 0.66, 1.05, { genlik: 0.8, soluk: 0.55 });
    for (const gx of [w * 0.32 - 16, w * 0.32 + 16]) { elips(c, gx, h * 0.46, 9, 11); c.fillStyle = "#CFD86A"; c.fill(); elips(c, gx + 1, h * 0.46, 2.5, 8); c.fillStyle = "#07080B"; c.fill(); }
    balon(c, { x: w * 0.68, y: h * 0.24, metin: "Şimdi kedi hem uyuyor hem uyanık. Buna üst üste binme denir.", en: 470, kuyruk: [w * 0.54, h * 0.52], zemin: "#1C2A33", yazi: "#DFFBF6" });
  }, { zemin: "#07080B" });
  panel(c, K, K + 2 * (kh + O), W - 2 * K, kh, (c, w, h) => {
    c.fillStyle = "#E7D3AE"; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#D2B583", 12, 2.6);
    kutu(c, w * 0.5, h * 0.52, w * 0.4, h * 0.6, { kapak: "kapali", yazi: false });
    profesor(c, w * 0.3, h + 380, 1.5, { poz: "kapak", agiz: "duz", ter: true });
    ses(c, w * 0.8, h * 0.42, "GICIRR", { boy: 60, aci: -0.1, renk: "#F6EBD0" });
    balon(c, { x: w * 0.6, y: h * 0.18, metin: "Ölçüm zamanı. Açıyorum.", en: 300, kuyruk: [w * 0.36, h * 0.3] });
  });
}

function sayfa8(c) {
  const ust = 1000, alt = H - 2 * K - ust - O, yar = (W - 2 * K - O) / 2;
  panel(c, K, K, W - 2 * K, ust, (c, w, h) => {
    laboratuvar(c, w, h, { pencere: true, raf: true, zemin: 0.66 });
    const g = c.createRadialGradient(w * 0.42, h * 0.62, 20, w * 0.42, h * 0.62, 340);
    g.addColorStop(0, "#8FEADF66"); g.addColorStop(1, "#8FEADF00");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    acikKapak(c, w * 0.18, h * 0.6, w * 0.48, h * 0.3);
    kedi(c, w * 0.42, h * 0.62, 1.1, { poz: "uyu" });
    psi(c, w * 0.42, h * 0.57, 0.9, { genlik: 0.45, uzun: 1.2, goz: "kapali" });
    kutu(c, w * 0.18, h * 0.6, w * 0.48, h * 0.3, { kapak: "yok" });
    ses(c, w * 0.28, h * 0.42, "Zzz", { boy: 64, aci: -0.15, renk: "#F6EBD0", golge: R.lacivert });
    profesor(c, w * 0.82, h * 0.96, 1.18, { poz: "not", yon: -1 });
    balon(c, { x: w * 0.6, y: h * 0.12, metin: "Sonuç: kedi uyuyor. Dalga mırlıyor.", en: 420, kuyruk: [w * 0.78, h * 0.38] });
  });
  panel(c, K, K + ust + O, yar, alt, (c, w, h) => {
    c.fillStyle = R.krem; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#9DB4D2"; c.lineWidth = 2;
    for (let yy = 70; yy < h; yy += 44) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
    c.strokeStyle = "#D98C8C"; c.beginPath(); c.moveTo(70, 0); c.lineTo(70, h); c.stroke();
    c.save(); c.fillStyle = "#24407A"; c.font = `600 42px ${EL}`; c.textBaseline = "alphabetic";
    [["29 Ekim, gece", 92, 108], ["Gözlem: kedi uyuyor.", 92, 196], ["Ψ mutlu. Kutu sıcak.", 92, 284]].forEach(([m, x, y]) => c.fillText(m, x, y));
    c.restore();
    // kenarda küçük kedi karalaması
    c.save(); c.strokeStyle = "#24407A"; c.lineWidth = 3; c.lineCap = "round";
    const kx = w - 110, ky = h - 120;
    c.beginPath(); c.ellipse(kx, ky, 46, 28, 0, 0, TAM); c.stroke();
    c.beginPath(); c.arc(kx + 40, ky - 20, 20, 0, TAM); c.stroke();
    c.beginPath(); c.moveTo(kx + 28, ky - 34); c.lineTo(kx + 30, ky - 48); c.lineTo(kx + 38, ky - 38); c.moveTo(kx + 46, ky - 38); c.lineTo(kx + 54, ky - 48); c.lineTo(kx + 56, ky - 32); c.stroke();
    c.beginPath(); c.moveTo(kx - 46, ky); c.quadraticCurveTo(kx - 80, ky - 10, kx - 70, ky - 44); c.stroke();
    c.restore();
  });
  panel(c, K + yar + O, K + ust + O, yar, alt, (c, w, h) => {
    c.fillStyle = R.tahta; c.fillRect(0, 0, w, h);
    noktalar(c, 0, 0, w, h, "#FFFFFF12", 10, 2.4);
    psi(c, w * 0.5, h * 0.82, 1.1, { genlik: 1.1, goz: "kirp" });
    balon(c, { x: w * 0.5, y: h * 0.22, metin: "Ölçüm yapıldı. İyi geceler!", en: 300, kuyruk: [w * 0.5, h * 0.52] });
  });
}

// Sayfanın kâğıdı: hafif sıcak gazete kâğıdı
function kagit(c, w, h) {
  c.fillStyle = R.kagit;
  c.fillRect(0, 0, w, h);
}

const SAYFALAR = [
  { ciz: kapakSayfasi, w: W, kapak: true },
  { ciz: sayfa2, w: W },
  { ciz: sayfa3, w: W },
  { ciz: sayfa4, w: W },
  { ciz: ciftSayfa, w: W * 2, cift: true },
  { ciz: sayfa6, w: W },
  { ciz: sayfa7, w: W },
  { ciz: sayfa8, w: W },
];

async function sayfaCiz({ ciz, w }) {
  const cv = tuval(w, H);
  const c = cv.getContext("2d");
  kagit(c, w, H);
  ciz(c);
  const blob = cv.convertToBlob
    ? await cv.convertToBlob({ type: "image/jpeg", quality: 0.9 })
    : await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
  cv.width = cv.height = 0;
  return blob;
}

// JSZip yüklenmemişse bir kez buradan
let zipSoz = null;
function jszip() {
  if (globalThis.JSZip) return Promise.resolve(globalThis.JSZip);
  zipSoz ||= new Promise((tamam, hata) => {
    const s = document.createElement("script");
    s.src = new URL("../lib/jszip.min.js", import.meta.url).href;
    s.onload = () => (globalThis.JSZip ? tamam(globalThis.JSZip) : hata(new Error("JSZip yüklenemedi")));
    s.onerror = () => { zipSoz = null; hata(new Error("JSZip yüklenemedi")); };
    document.head.append(s);
  });
  return zipSoz;
}

function comicInfo() {
  const sayfalar = SAYFALAR.map((s, i) => `    <Page Image="${i}" ImageWidth="${s.w}" ImageHeight="${H}"${s.kapak ? ' Type="FrontCover"' : ""}${s.cift ? ' DoublePage="True"' : ""}/>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>Kedi, Kutu ve Dalga</Title>
  <Series>Laboratuvar Defteri</Series>
  <Number>1</Number>
  <Year>1927</Year>
  <Writer>Kenar Notu</Writer>
  <Summary>Kopenhag, 1927. Kedi Planck, Profesör Nur ve aynı anda birçok yerde olabilen dalga fonksiyonu Psi bir gece laboratuvarda karşılaşır.</Summary>
  <LanguageISO>tr</LanguageISO>
  <Manga>No</Manga>
  <PageCount>${SAYFALAR.length}</PageCount>
  <Pages>
${sayfalar}
  </Pages>
</ComicInfo>
`;
}

// 8 görsel tek tek çizilir, aralarda ana iş parçacığı nefes alır
export async function ornekCizgiRoman() {
  const [JSZip] = await Promise.all([jszip(), yaziTipleriniBekle()]);
  const zip = new JSZip();
  for (let i = 0; i < SAYFALAR.length; i++) {
    const blob = await sayfaCiz(SAYFALAR[i]);
    zip.file(`kedi-kutu-dalga/${String(i + 1).padStart(3, "0")}.jpg`, blob, { compression: "STORE" });
    await new Promise((r) => setTimeout(r, 0));
  }
  zip.file("ComicInfo.xml", comicInfo());
  const veri = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new Blob([veri], { type: "application/vnd.comicbook+zip" });
}
