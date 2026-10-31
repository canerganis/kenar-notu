// Kenar Notu çizim motoru.
// Saf veri, çizim ve ölçüm modülü: DOM'a, düğmelere ve olay dinleyicilere dokunmaz.
// Bütün koordinatlar sayfa birimindedir (sayfa 800 birim genişlik). Kalemde w = mm × 5.
//
// Çizgi: { id, tur: "dolma" | "tukenmez" | "kursun" | "fosforlu" | "sekil", renk: "#hex", w,
//          p: [[x, y, basinc], ...], sekil?: "cizgi" | "ok" | "dikdortgen" | "elips", duz?: true }
//
// Önbellek: çizgi başına yol ve sınır kutusu saklanır, p dizisi ya da uzunluğu değişince yenilenir.
// Noktaları yerinde değiştirme; p'ye yeni dizi ata (tasi() böyle yapar).

import { KOYU_SAYFA_ESLEME, hareketAz } from "./ortak.js";

const TAM = Math.PI * 2;
const SAYFA_GENISLIK = 800;
const SAYFA_MAVI = "#1F3A68";

const SEYREK = 0.45;        // bundan yakın ardışık noktalar atlanır (birim)
const ADIM = 2;             // eğri örnekleme adımı (birim)
const ACI_ADIM = 0.12;      // iki örnek arası en fazla dönüş (radyan)
const EN_INCE = 0.3;        // en ince kalem izi (birim)
const YON_UST = 1.08;       // dolma kalem yön çarpanının üst sınırı
const YON_ORTA = YON_UST - 0.18;   // yönü belirsiz yerde (kalem yerinde dönerken) orta değer
const NOKTA_BASINC = 0.55;  // tek dokunuşta en az bu basınçla çizilir
const BOS = [];
const YAPISMA = Math.tan((3 * Math.PI) / 180);   // düz çizgi 3 dereceden yakınsa yataya ya da dikeye oturur
const UC_X = Math.SQRT1_2, UC_Y = -Math.SQRT1_2;  // dolma kalem ucunun ekseni: sağ üste bakar
const ISLAK_SURE = 600;

const sinirla = (v, a, b) => (v < a ? a : v > b ? b : v);
const basincOku = (q) => (Number.isFinite(q[2]) ? sinirla(q[2], 0, 1) : 0.5);
const kalinlik = (c) => (c.w > 0 ? c.w : c.tur === "fosforlu" ? 22 : 3);
const koyuRenk = (renk) => KOYU_SAYFA_ESLEME[String(renk).toUpperCase()] || renk;

function tuval(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// ---------- genişlik ----------

// O noktadaki çizgi genişliği (birim). Basınç 0..1, bilinmiyorsa 0,5.
export function genislik(tur, w, basinc = 0.5) {
  const p = Number.isFinite(basinc) ? sinirla(basinc, 0, 1) : 0.5;
  if (tur === "tukenmez") return w * (0.7 + 0.6 * p);
  if (tur === "dolma") return w * (0.3 + 1.4 * p);
  if (tur === "kursun") return w * (0.5 + 0.8 * p);
  return w;   // fosforlu ve şekil sabit kalınlıkta
}

// ---------- nokta hazırlığı ----------

// Düz çizginin uçları; neredeyse yatay ya da dikeyse oturtulur.
function duzUclar(p) {
  const a = p[0], b = p[p.length - 1];
  let x = b[0], y = b[1];
  const dx = x - a[0], dy = y - a[1];
  if (Math.abs(dy) <= Math.abs(dx) * YAPISMA) y = a[1];
  else if (Math.abs(dx) <= Math.abs(dy) * YAPISMA) x = a[0];
  return [a, [x, y, b[2]]];
}

// Çizimde ve ölçümde kullanılan noktalar
const noktalar = (c) => (c.duz && c.tur !== "sekil" && c.p.length > 1 ? duzUclar(c.p) : c.p);

// Çok yakın noktaları atar; son nokta her zaman korunur.
// ek: canlı çizimde sona eklenen tahmin noktaları. ana: p'den gelen tutulan nokta sayısı.
function seyrelt(p, ek = BOS) {
  const X = [], Y = [], B = [], s2 = SEYREK * SEYREK, n1 = p.length, n = n1 + ek.length;
  let ana = 0;
  for (let i = 0; i < n; i++) {
    if (i === n1) ana = X.length;
    const q = i < n1 ? p[i] : ek[i - n1], x = q[0], y = q[1], m = X.length;
    if (m) {
      const dx = x - X[m - 1], dy = y - Y[m - 1];
      if (dx * dx + dy * dy < s2) {
        if (i === n - 1 && m > 1) { X[m - 1] = x; Y[m - 1] = y; B[m - 1] = basincOku(q); }
        continue;
      }
    }
    X.push(x); Y.push(y); B.push(basincOku(q));
  }
  if (n === n1) ana = X.length;
  return { X, Y, B, n: X.length, ana };
}

// seyrelt'in tek adımı (canlı çizimde artımlı kullanım). son: dizinin son noktası, yakınsa öncekinin yerine geçer
function seyrekEkle(X, Y, B, q, son) {
  const x = q[0], y = q[1], m = X.length;
  if (m) {
    const dx = x - X[m - 1], dy = y - Y[m - 1];
    if (dx * dx + dy * dy < SEYREK * SEYREK) {
      if (son && m > 1) { X[m - 1] = x; Y[m - 1] = y; B[m - 1] = basincOku(q); }
      return;
    }
  }
  X.push(x); Y.push(y); B.push(basincOku(q));
}

// Tek dokunuş (i'nin noktası, nokta işareti): basınç ne olursa olsun görünür kalsın
function noktaMi(X, Y, n) {
  if (n > 4) return false;
  let x0 = X[0], x1 = X[0], y0 = Y[0], y1 = Y[0];
  for (let i = 1; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); }
  return Math.hypot(x1 - x0, y1 - y0) < 1;
}

// Dolma kalem: uç eksenine paralel giden çizgi incelir, dik giden kalınlaşır (hafif kaligrafi).
// Yalnız ±3 komşuya bakar.
function hamYon(X, Y, n, i) {
  const a = i > 2 ? i - 3 : 0, b = i < n - 3 ? i + 3 : n - 1;
  const dx = X[b] - X[a], dy = Y[b] - Y[a], L = Math.hypot(dx, dy);
  if (L <= 0.5) return YON_ORTA;
  const c = (dx * UC_X + dy * UC_Y) / L;
  return YON_UST - 0.36 * c * c;
}

// lo..hi seyrek noktalarının genişlikleri; dönen dizide W[i - lo].
// Basınç ve yön komşulara 1-4-6-4-1 ağırlıkla yumuşatılır (ani kalınlık sıçraması olmaz).
// Pencereler yereldir (basınç ±2, yön ±5): canlı çizimde kuyruk tek başına hesaplanabilir.
function genislikler(c, D, lo = 0, hi = D.n - 1) {
  const { X, Y, B, n } = D, w = kalinlik(c), son = n - 1;
  const taban = noktaMi(X, Y, n) ? NOKTA_BASINC : 0;
  let F = null, flo = 0;
  if (c.tur === "dolma" && n > 1) {
    flo = Math.max(0, lo - 2);
    const fhi = Math.min(son, hi + 2);
    F = new Float64Array(fhi - flo + 1);
    for (let i = flo; i <= fhi; i++) F[i - flo] = hamYon(X, Y, n, i);
  }
  const W = new Float64Array(hi - lo + 1);
  for (let i = lo; i <= hi; i++) {
    const a = i > 1 ? i - 2 : 0, b = i > 0 ? i - 1 : 0, d = i < son ? i + 1 : son, e = i < son - 1 ? i + 2 : son;
    const bas = (B[a] + 4 * B[b] + 6 * B[i] + 4 * B[d] + B[e]) / 16;
    let g = genislik(c.tur, w, bas > taban ? bas : taban);
    if (F) g *= (F[a - flo] + 4 * F[b - flo] + 6 * F[i - flo] + 4 * F[d - flo] + F[e - flo]) / 16;
    W[i - lo] = g > EN_INCE ? g : EN_INCE;
  }
  return W;
}

// Orta noktalar arası quadratic eğriyi örnekler; genişlik de aynı eğriyle değişir.
// Düğümler: K0 ilk nokta, Kj = (Pj + Pj+1) / 2, K(n-1) son nokta. j. parça K(j-1)'den Kj'ye
// Pj denetimli eğridir, son parça düzdür. a. düğümden b. düğüme örnekler; W[i - wlo] i. noktanın genişliği.
function ornekle(D, W, wlo = 0, a = 0, b = D.n - 1) {
  const { X, Y, n } = D, son = n - 1, ox = [], oy = [], or = [];
  const ekle = (x, y, r) => {
    const m = ox.length;
    if (m && Math.abs(x - ox[m - 1]) < 1e-3 && Math.abs(y - oy[m - 1]) < 1e-3) { if (r > or[m - 1]) or[m - 1] = r; return; }
    ox.push(x); oy.push(y); or.push(r);
  };
  let sx, sy, sw;
  if (a === 0 || a === son) { sx = X[a]; sy = Y[a]; sw = W[a - wlo]; }
  else { sx = (X[a] + X[a + 1]) / 2; sy = (Y[a] + Y[a + 1]) / 2; sw = (W[a - wlo] + W[a + 1 - wlo]) / 2; }
  ekle(sx, sy, sw / 2);
  for (let j = a + 1; j <= b; j++) {
    if (j === son) { ekle(X[son], Y[son], W[son - wlo] / 2); break; }
    const cx = X[j], cy = Y[j], cw = W[j - wlo];
    const ex = (cx + X[j + 1]) / 2, ey = (cy + Y[j + 1]) / 2, ew = (cw + W[j + 1 - wlo]) / 2;
    const ax = cx - sx, ay = cy - sy, bx = ex - cx, by = ey - cy;
    const L = Math.hypot(ax, ay) + Math.hypot(bx, by);
    const donus = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    const m = Math.min(16, Math.max(1, Math.ceil(L / ADIM), Math.ceil(donus / ACI_ADIM)));
    for (let k = 1; k <= m; k++) {
      const t = k / m, u = 1 - t, k0 = u * u, k1 = 2 * u * t, k2 = t * t;
      ekle(k0 * sx + k1 * cx + k2 * ex, k0 * sy + k1 * cy + k2 * ey, (k0 * sw + k1 * cw + k2 * ew) / 2);
    }
    sx = ex; sy = ey; sw = ew;
  }
  return { X: ox, Y: oy, R: or };
}

// ---------- kalem izinin dış hattı ----------
// Şeritler ve daireler aynı yönde dolaşılır; "nonzero" dolgu birleşimi tek seferde boyar.
// Böylece kurşun kalemin yarı saydamlığı düğümlerde koyulaşmaz, kendini kesen çizgide delik açılmaz.
// Dar dönüşte şerit kesilir ve araya daire konur (iç kenar katlanmasın diye).

// closePath yok: dolgu (fill, clip) açık alt yolu kendiliğinden kapatır, sonuç aynı. Ağır sayfada yol kurmanın
// en pahalı çağrısıydı (5000 çizgide toplam sürenin beşte biri).
function daire(yol, x, y, r) {
  yol.moveTo(x + r, y);
  yol.arc(x, y, r, 0, TAM);
}

function serit(yol, sol, sag) {
  const n = sag.length;
  if (n >= 4) {
    yol.moveTo(sag[0], sag[1]);
    for (let k = 2; k < n; k += 2) yol.lineTo(sag[k], sag[k + 1]);
    for (let k = n - 2; k >= 0; k -= 2) yol.lineTo(sol[k], sol[k + 1]);
    yol.closePath();
  }
  sol.length = 0; sag.length = 0;
}

function birlesim({ X, Y, R }, yol) {
  const n = X.length;
  daire(yol, X[0], Y[0], R[0]);
  if (n === 1) return yol;
  const NX = new Float64Array(n - 1), NY = new Float64Array(n - 1), L = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], l = Math.hypot(dx, dy) || 1e-6;
    NX[i] = -dy / l; NY[i] = dx / l; L[i] = l;
  }
  const sol = [], sag = [];
  const kenar = (x, y, nx, ny, r) => { sol.push(x + nx * r, y + ny * r); sag.push(x - nx * r, y - ny * r); };
  kenar(X[0], Y[0], NX[0], NY[0], R[0]);
  for (let i = 1; i < n - 1; i++) {
    const ax = NX[i - 1], ay = NY[i - 1], bx = NX[i], by = NY[i], r = R[i];
    const mx = ax + bx, my = ay + by, ml = Math.hypot(mx, my), yc = ml / 2;   // yc: yarım açının kosinüsü
    const tanYarim = yc > 1e-6 ? Math.sqrt(Math.max(0, 1 - yc * yc)) / yc : Infinity;
    if (ax * bx + ay * by > 0.5 && r * tanYarim < 0.5 * Math.min(L[i - 1], L[i])) {
      const s = r / (ml * yc);   // gönye: açıortay yönünde r / cos(θ/2)
      sol.push(X[i] + mx * s, Y[i] + my * s);
      sag.push(X[i] - mx * s, Y[i] - my * s);
    } else {
      kenar(X[i], Y[i], ax, ay, r);
      serit(yol, sol, sag);
      daire(yol, X[i], Y[i], r);
      kenar(X[i], Y[i], bx, by, r);
    }
  }
  kenar(X[n - 1], Y[n - 1], NX[n - 2], NY[n - 2], R[n - 1]);
  serit(yol, sol, sag);
  daire(yol, X[n - 1], Y[n - 1], R[n - 1]);
  return yol;
}

// carpan: genişlik çarpanı (ıslak parlaklık aynı izin ince bir kopyasıdır)
function kalemYolu(c, carpan = 1, D = seyrelt(noktalar(c))) {
  const yol = new Path2D();
  if (!D.n) return yol;
  const W = genislikler(c, D);
  if (carpan !== 1) for (let i = 0; i < W.length; i++) W[i] *= carpan;
  return birlesim(ornekle(D, W), yol);
}

// a. düğümden b. düğüme kadar dış hat parçası ve sınır kutusu (canlı çizimin donmuş parçaları)
function parcaYolu(c, D, a, b, yol = new Path2D()) {
  const W = genislikler(c, D, a, Math.min(b + 1, D.n - 1));
  const S = ornekle(D, W, a, a, b);
  birlesim(S, yol);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < S.X.length; i++) {
    const r = S.R[i] * 1.16 + 0.5;   // gönye köşesi yarıçapın en fazla 1,16 katı uzanır
    if (S.X[i] - r < x0) x0 = S.X[i] - r; if (S.X[i] + r > x1) x1 = S.X[i] + r;
    if (S.Y[i] - r < y0) y0 = S.Y[i] - r; if (S.Y[i] + r > y1) y1 = S.Y[i] + r;
  }
  return { yol, kutu: { x0, y0, x1, y1 } };
}

// Orta noktalar arası quadratic eğrilerle tek parça orta çizgi (fosforlu)
function ortaYol(c, D = seyrelt(noktalar(c))) {
  const yol = new Path2D(), { X, Y, n } = D;
  if (!n) return yol;
  if (n === 1) {   // tek dokunuş: keski ucun kısa izi
    const h = c.tur === "fosforlu" ? kalinlik(c) * 0.2 : 0.01;
    yol.moveTo(X[0] - h, Y[0]); yol.lineTo(X[0] + h, Y[0]);
    return yol;
  }
  yol.moveTo(X[0], Y[0]);
  for (let i = 1; i < n - 1; i++) yol.quadraticCurveTo(X[i], Y[i], (X[i] + X[i + 1]) / 2, (Y[i] + Y[i + 1]) / 2);
  yol.lineTo(X[n - 1], Y[n - 1]);
  return yol;
}

// ---------- önbellek ----------

const onbellek = new WeakMap();
function kayit(c) {
  let k = onbellek.get(c);
  if (!k || k.p !== c.p || k.n !== c.p.length || k.w !== c.w || k.tur !== c.tur || k.duz !== c.duz || k.sekil !== c.sekil) {
    k = { p: c.p, n: c.p.length, w: c.w, tur: c.tur, duz: c.duz, sekil: c.sekil, yol: null, kutu: null, ornek: null };
    onbellek.set(c, k);
  }
  return k;
}
const kutu = (c) => { const k = kayit(c); return k.kutu || (k.kutu = kutuHesapla(c)); };

// ---------- kurşun kalem greni ----------
// 96 piksellik döşeme bir kez üretilir, renk başına bir kez boyanır; her karede yalnız desen kurulur.

let grenMaskesi = null;
const grenTuvalleri = new Map();

function grenMaske() {
  if (grenMaskesi) return grenMaskesi;
  const N = 96, H = 12, c = tuval(N, N), g = c.getContext("2d"), img = g.createImageData(N, N), d = img.data;
  let s = 0x2545f491;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const iri = Float32Array.from({ length: H * H }, rnd);   // kâğıt dişi: yumuşak lekeler
  const hucre = N / H;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const gx = x / hucre, gy = y / hucre, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
      const v = (i, j) => iri[((j % H) * H) + (i % H)];
      const leke = (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy;
      const t = 0.62 * rnd() + 0.38 * leke;
      d[(y * N + x) * 4 + 3] = Math.round(255 * (1 - 0.55 * t * t));
    }
  }
  g.putImageData(img, 0, 0);
  return (grenMaskesi = c);
}

function grenDeseni(ctx, renk) {
  let t = grenTuvalleri.get(renk);
  if (!t) {
    const m = grenMaske();
    t = tuval(m.width, m.height);
    const g = t.getContext("2d");
    g.fillStyle = renk; g.fillRect(0, 0, t.width, t.height);
    g.globalCompositeOperation = "destination-in"; g.drawImage(m, 0, 0);
    grenTuvalleri.set(renk, t);
  }
  const desen = ctx.createPattern(t, "repeat");
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b) || 1;
  const tane = (globalThis.devicePixelRatio || 1) >= 2 ? 1.25 : 1;   // gren cihaz pikselinde sabit
  desen.setTransform(new DOMMatrix([tane / s, 0, 0, tane / s, 0, 0]));
  return desen;
}

// ---------- çizim ----------

function kalemCiz(ctx, c, renk, yol) {
  // soluk: silgi ucu kurşunu bir geçişte yarıya indirir (TASARIM-3 nüans 3)
  if (c.tur === "kursun") { ctx.globalAlpha = c.soluk ? 0.38 : 0.8; ctx.fillStyle = grenDeseni(ctx, renk); }
  else ctx.fillStyle = renk;
  ctx.fill(yol);
}

function fosforluCiz(ctx, c, renk, koyuSayfa, yol) {
  ctx.globalAlpha = koyuSayfa ? 0.45 : 0.35;   // koyu sayfada (screen karışımı) %35 zeytin tonunda kalıyordu
  if (!koyuSayfa) ctx.globalCompositeOperation = "multiply";   // alttaki mürekkebi örtmez
  ctx.strokeStyle = renk;
  ctx.lineWidth = kalinlik(c);
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.stroke(yol);
}

// Ok ucu: ince, sırtı içe çekik, yanları hafif kavisli
function okBasi(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 0.5) return null;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const H = Math.min(L * 0.5, 8 + w * 3), yari = H * 0.4;
  const kx = b[0] - ux * H, ky = b[1] - uy * H;
  const sol = [kx + nx * yari, ky + ny * yari], sag = [kx - nx * yari, ky - ny * yari];
  const ic = yari * 0.12;
  return {
    H, yari, sol, sag,
    sirt: [b[0] - ux * H * 0.7, b[1] - uy * H * 0.7],
    govdeSonu: [b[0] - ux * H * 0.55, b[1] - uy * H * 0.55],
    k1: [(b[0] + sol[0]) / 2 - nx * ic, (b[1] + sol[1]) / 2 - ny * ic],
    k2: [(b[0] + sag[0]) / 2 + nx * ic, (b[1] + sag[1]) / 2 + ny * ic],
  };
}

function sekilCiz(ctx, c, renk) {
  const a = c.p[0], b = c.p[c.p.length - 1], w = kalinlik(c);
  ctx.strokeStyle = renk; ctx.fillStyle = renk;
  ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), gw = Math.abs(b[0] - a[0]), gh = Math.abs(b[1] - a[1]);
  ctx.beginPath();
  if (gw < 0.5 && gh < 0.5) { ctx.arc(a[0], a[1], w / 2, 0, TAM); ctx.fill(); return; }
  if (c.sekil === "dikdortgen") ctx.rect(x0, y0, gw, gh);
  else if (c.sekil === "elips") ctx.ellipse(x0 + gw / 2, y0 + gh / 2, gw / 2, gh / 2, 0, 0, TAM);
  else if (c.sekil === "ok") {
    const u = okBasi(a, b, w);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(u.govdeSonu[0], u.govdeSonu[1]); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.quadraticCurveTo(u.k1[0], u.k1[1], u.sol[0], u.sol[1]);
    ctx.lineTo(u.sirt[0], u.sirt[1]);
    ctx.lineTo(u.sag[0], u.sag[1]);
    ctx.quadraticCurveTo(u.k2[0], u.k2[1], b[0], b[1]);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.min(w, 2) * 0.6;   // sivri köşeleri hafif yuvarlar
    ctx.stroke();
    return;
  } else { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  ctx.stroke();
}

// onbellekli: kalıcı katman için yol saklanır; canlı çizgi her karede değiştiği için saklanmaz
function cizgiyiCiz(ctx, c, koyuSayfa, onbellekli) {
  if (!c || !c.p || !c.p.length) return;
  const renk = koyuSayfa ? koyuRenk(c.renk || "#1B1B1F") : c.renk || "#1B1B1F";
  ctx.save();
  if (c.tur === "sekil") sekilCiz(ctx, c, renk);
  else {
    const fos = c.tur === "fosforlu";
    let yol;
    if (onbellekli) { const k = kayit(c); yol = k.yol || (k.yol = fos ? ortaYol(c) : kalemYolu(c)); }
    else yol = fos ? ortaYol(c) : kalemYolu(c);
    if (fos) fosforluCiz(ctx, c, renk, koyuSayfa, yol);
    else kalemCiz(ctx, c, renk, yol);
  }
  ctx.restore();
}

// ctx sayfa birimine ölçekli olmalı
export function cizgiCiz(ctx, cizgi, { koyuSayfa = false } = {}) {
  cizgiyiCiz(ctx, cizgi, koyuSayfa, true);
}

// olcek = k × dpr. Tuvali temizler ve bütün çizgileri sırayla çizer.
export function hepsiniCiz(ctx, cizgiler, olcek, { koyuSayfa = false } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(olcek, 0, 0, olcek, 0, 0);
  for (const c of cizgiler) cizgiyiCiz(ctx, c, koyuSayfa, true);
}

// Yalnız bir bölgeyi (sayfa birimi) siler ve oraya değen çizgileri sırayla yeniden çizer.
// Bölge aygıt pikseline yuvarlanır: kırpma kenarında yarım piksel izi kalmaz, sonuç hepsiniCiz ile aynı.
export function bolgeyiCiz(ctx, cizgiler, olcek, b, { koyuSayfa = false } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const px0 = Math.max(0, Math.floor(b.x0 * olcek) - 1), py0 = Math.max(0, Math.floor(b.y0 * olcek) - 1);
  const px1 = Math.min(W, Math.ceil(b.x1 * olcek) + 1), py1 = Math.min(H, Math.ceil(b.y1 * olcek) + 1);
  if (px1 <= px0 || py1 <= py0) return;
  const x0 = px0 / olcek, y0 = py0 / olcek, x1 = px1 / olcek, y1 = py1 / olcek;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(px0, py0, px1 - px0, py1 - py0);
  ctx.beginPath();
  ctx.rect(px0, py0, px1 - px0, py1 - py0);
  ctx.clip();
  ctx.setTransform(olcek, 0, 0, olcek, 0, 0);
  for (const c of cizgiler) {
    if (!c || !c.p || !c.p.length) continue;
    const k = kutu(c);
    if (k.x1 < x0 || k.x0 > x1 || k.y1 < y0 || k.y0 > y1) continue;
    cizgiyiCiz(ctx, c, koyuSayfa, true);
  }
  ctx.restore();
}

// Ağır sayfada parça parça çizim: cizgiler[i]'den sırayla çizer, performance.now() bitis'i geçince durur ve
// kaldığı indeksi döner (hepsi bittiyse cizgiler.length). ic verilirse yalnız o kutuya değenler çizilir.
// kes() true dönerse de durur. Kırpma ve ölçek çağıranın işi.
export function sirayla(ctx, cizgiler, i, bitis, { koyuSayfa = false, ic = null, kes = null } = {}) {
  const n = cizgiler.length;
  for (let j = 0; i < n; i++, j++) {
    if (performance.now() > bitis || (kes && (j & 3) === 3 && kes())) return i;
    const c = cizgiler[i];
    if (!c || !c.p || !c.p.length) continue;
    if (ic) {
      const k = kutu(c);
      if (k.x1 < ic.x0 || k.x0 > ic.x1 || k.y1 < ic.y0 || k.y0 > ic.y1) continue;
    }
    cizgiyiCiz(ctx, c, koyuSayfa, true);
  }
  return n;
}

// Yolu henüz kurulmamış çizgi sayısı (en çok sinir kadar sayar): ilk çizimin bedeli asıl buradadır,
// kurulu yolu boyamak çok daha ucuz
export function kurulmamis(cizgiler, sinir = Infinity) {
  let n = 0;
  for (const c of cizgiler) {
    if (!c || !c.p || !c.p.length || c.tur === "sekil") continue;
    const k = onbellek.get(c);
    if (!k || !k.yol || k.p !== c.p || k.n !== c.p.length || k.w !== c.w || k.tur !== c.tur || k.duz !== c.duz) { if (++n >= sinir) break; }
  }
  return n;
}

// Çizgilerin kalınlık payı dahil birleşik kutusu; boşsa null
export function cizgilerKutusu(cizgiler) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cizgiler) {
    if (!c || !c.p || !c.p.length) continue;
    const k = kutu(c);
    if (k.x0 < x0) x0 = k.x0; if (k.y0 < y0) y0 = k.y0;
    if (k.x1 > x1) x1 = k.x1; if (k.y1 > y1) y1 = k.y1;
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

// ---------- canlı katman ----------
// Kalem değerken çizilen çizgi, kement yolu ve sürükleme dikdörtgenleri.
// Her çağrı yalnız bir önceki çağrının boyadığı bölgeyi siler (kirli dikdörtgen).

const BANT_RENGI = { murekkep: "#34507E", bordo: "#84323F", hardal: "#C9A048", adacayi: "#87A08A" };
const bantDosemeleri = new Map();

// Bandın deseni, TASARIM 3.19 ile aynı; CSS pikselinin iki katı çözünürlükte
function bantDosemesi(desen) {
  if (bantDosemeleri.has(desen)) return bantDosemeleri.get(desen);
  const boy = { murekkep: 34, bordo: 20, hardal: 18, adacayi: 18 }[desen] || 34;
  const t = tuval(boy, boy), g = t.getContext("2d");
  if (desen === "bordo") {
    g.fillStyle = "#F6E7D8"; g.beginPath(); g.arc(boy / 2, boy / 2, 2.8, 0, TAM); g.fill();
  } else if (desen === "hardal") {
    g.fillStyle = "#FFFFFF33"; g.fillRect(0, 0, 6, boy);
  } else if (desen === "adacayi") {
    g.fillStyle = "#FFFFFF30"; g.fillRect(0, 0, boy, 2); g.fillRect(0, 0, 2, boy);
  } else {
    g.strokeStyle = "#FFFFFF2E"; g.lineWidth = 10; g.beginPath();
    for (const o of [-boy, 0, boy]) { g.moveTo(o, 0); g.lineTo(o + boy, boy); }
    g.stroke();
  }
  bantDosemeleri.set(desen, t);
  return t;
}

let bekleyen = null;   // ıslak mürekkebi kuruyan dolma kalem çizgisi (aynı anda bir tane)

// Bekleyen ıslak çizgiyi hemen kalıcı katmana aktarır. Aktarılacak bir şey varsa true döner.
export function islakAktar() {
  const b = bekleyen;
  if (!b) return false;
  bekleyen = null;
  cancelAnimationFrame(b.raf);
  clearTimeout(b.yedek);
  b.aktar(b.cizgi);
  b.canli._sil();
  return true;
}

export class CanliKatman {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { desynchronized: true });
    this.olcek = 1;
    this.dpr = 1;
    this.k = 1;               // CSS pikseli başına birim tersi: 1 birim = k CSS pikseli
    this.koyuSayfa = false;   // koyu sayfada mürekkep açık karşılığıyla, kırpma işaretleri açık renkle çizilir
    this.kirli = null;        // son boyanan bölge, cihaz pikseli [x, y, w, h]
    this.karinca = 0;         // kement kesik çizgisinin kayması
    this._iz = null;          // artımlı çizim için o anki çizginin durumu
  }

  // olcek = k × dpr. Tuval genişliği cssGenislik × dpr olur; dpr verilmezse
  // devicePixelRatio kullanılır, genişlik 4096 cihaz pikselini geçmeyecek şekilde düşürülür.
  boyutla(cssGenislik, cssYukseklik, olcek, { dpr, koyuSayfa } = {}) {
    if (bekleyen && bekleyen.canli === this) islakAktar();
    const d = dpr || Math.min(globalThis.devicePixelRatio || 1, 4096 / Math.max(1, cssGenislik));
    const W = Math.max(1, Math.round(cssGenislik * d)), H = Math.max(1, Math.round(cssYukseklik * d));
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    this.olcek = olcek;
    this.dpr = d;
    this.k = olcek / d;
    if (koyuSayfa !== undefined) this.koyuSayfa = koyuSayfa;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, W, H);
    this.kirli = null;
    this._iz = null;
  }

  // Her pointermove'da: çizginin tamamı ve sonuna eklenen tahmin noktaları.
  // Aynı çizgi uzadıkça yalnız değişen kuyruk bölgesi silinip kırpılarak yeniden boyanır.
  // Dış hattın oturmuş baş kısmı PARCA düğümlük donmuş parçalarda saklanır; her karede yalnız
  // kuyruk hesaplanır ve bölgeye değen parçalar eklenir. Kare süresi çizginin boyundan bağımsızdır.
  ciz(cizgi, tahminNoktalari = []) {
    if (bekleyen && bekleyen.cizgi !== cizgi) islakAktar();
    const p = cizgi.p;
    if (!p || !p.length) { this._sil(); return; }
    const kalem = cizgi.tur !== "sekil";
    const tahmin = kalem && tahminNoktalari && tahminNoktalari.length ? tahminNoktalari : BOS;
    const iz = this._iz;
    if (kalem && !cizgi.duz && iz && iz.cizgi === cizgi && iz.n <= p.length && iz.x === p[0][0] && iz.y === p[0][1]
      && iz.w === cizgi.w && iz.tur === cizgi.tur && iz.renk === cizgi.renk && this.kirli) {
      this._kuyruk(cizgi, tahmin, iz);
      return;
    }
    const c = tahmin.length ? { ...cizgi, p: p.concat(tahmin) } : cizgi;
    this._sil();
    this.ctx.setTransform(this.olcek, 0, 0, this.olcek, 0, 0);
    cizgiyiCiz(this.ctx, c, this.koyuSayfa, false);
    this._isaretle(kutuHesapla(c));
    if (kalem && !cizgi.duz) {
      const D = seyrelt(p, tahmin);
      this._iz = { cizgi, n: p.length, x: p[0][0], y: p[0][1], w: cizgi.w, tur: cizgi.tur, renk: cizgi.renk,
        tutulan: D.ana, kuyruk: this._cihaz(kuyrukKutusu(c, D, D.ana - KUYRUK)), donmus: 0, parcalar: [] };
    }
  }

  // seyrelt'in artımlı karşılığı, sonucu aynı. p'nin son noktası dışındakiler artık değişmez (son noktanın
  // basıncı güncellenebilir); onların seyrek hâli izde birikir, her karede yalnız son nokta ve tahminler eklenir.
  // Dönen diziler bir sonraki karede kırpılır: yalnız bu kare içinde kullanılır.
  _seyrek(iz, p, tahmin) {
    let s = iz.sey;
    if (!s || s.p !== p) s = iz.sey = { p, X: [], Y: [], B: [], i: 0, n: 0, son: null };
    const { X, Y, B } = s, sabit = p.length - 1;
    X.length = Y.length = B.length = s.n;
    if (s.son) { X[s.n - 1] = s.son[0]; Y[s.n - 1] = s.son[1]; B[s.n - 1] = s.son[2]; }   // son nokta kuralının ezdiği
    for (; s.i < sabit; s.i++) seyrekEkle(X, Y, B, p[s.i], false);
    s.n = X.length;
    s.son = s.n ? [X[s.n - 1], Y[s.n - 1], B[s.n - 1]] : null;
    seyrekEkle(X, Y, B, p[sabit], !tahmin.length);
    const ana = X.length;
    for (let i = 0; i < tahmin.length; i++) seyrekEkle(X, Y, B, tahmin[i], i === tahmin.length - 1);
    return { X, Y, B, n: X.length, ana };
  }

  _kuyruk(cizgi, tahmin, iz) {
    const ctx = this.ctx, o = this.olcek, fos = cizgi.tur === "fosforlu";
    const D = this._seyrek(iz, cizgi.p, tahmin), tutulan = D.ana;
    const yeni = this._cihaz(kuyrukKutusu(cizgi, D, Math.min(iz.tutulan, tutulan) - KUYRUK));
    const bolge = dikBirlesim(iz.kuyruk, yeni);
    // Yumuşatma pencereleri yüzünden son KUYRUK noktadan öncesi artık değişmez: dondur
    const sinir = tutulan - KUYRUK;
    if (!fos && sinir - iz.donmus >= PARCA) {
      const pr = parcaYolu(cizgi, D, iz.donmus, sinir);
      iz.parcalar.push({ yol: pr.yol, kutu: this._cihaz(pr.kutu) });
      iz.donmus = sinir;
    }
    if (bolge) {
      let yol;
      if (fos) yol = ortaYol(cizgi, D);
      else {
        // Tek yol: kurşun kalemin yarı saydamlığı parça eklerinde koyulaşmaz
        yol = new Path2D();
        for (const pr of iz.parcalar) if (pr.kutu && kesisir(pr.kutu, bolge)) yol.addPath(pr.yol);
        parcaYolu(cizgi, D, iz.donmus, D.n - 1, yol);
      }
      const renk = this.koyuSayfa ? koyuRenk(cizgi.renk || "#1B1B1F") : cizgi.renk || "#1B1B1F";
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(...bolge);
      ctx.beginPath(); ctx.rect(...bolge); ctx.clip();
      ctx.setTransform(o, 0, 0, o, 0, 0);
      if (fos) fosforluCiz(ctx, cizgi, renk, this.koyuSayfa, yol);
      else kalemCiz(ctx, cizgi, renk, yol);
      ctx.restore();
    }
    this.kirli = dikBirlesim(this.kirli, yeni);
    iz.n = cizgi.p.length; iz.tutulan = tutulan; iz.kuyruk = yeni;
  }

  // Serbest kement yolu: beyaz alt çizgi üstünde sayfa mavisi yürüyen karınca.
  // Uç başlangıca yaklaşınca (ya da kapali: true) yol kapanır ve içi dolar.
  kement(cokgen, { kapali } = {}) {
    if (bekleyen) islakAktar();
    this._sil();
    if (!cokgen || cokgen.length < 2) return;
    const ctx = this.ctx, k = this.k, n = cokgen.length;
    const a = cokgen[0], z = cokgen[n - 1];
    const kapandi = kapali ?? (n > 8 && Math.hypot(z[0] - a[0], z[1] - a[1]) < 24 / k);
    const yol = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const [x, y] = cokgen[i];
      if (i) yol.lineTo(x, y); else yol.moveTo(x, y);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (kapandi) yol.closePath();
    ctx.save();
    ctx.setTransform(this.olcek, 0, 0, this.olcek, 0, 0);
    if (kapandi) { ctx.fillStyle = "#1F3A6814"; ctx.fill(yol); }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3 / k; ctx.stroke(yol);
    if (!hareketAz()) this.karinca -= 0.5;
    ctx.setLineDash([6 / k, 5 / k]); ctx.lineDashOffset = this.karinca / k;
    ctx.lineCap = "butt"; ctx.strokeStyle = SAYFA_MAVI; ctx.lineWidth = 1.5 / k; ctx.stroke(yol);
    ctx.restore();
    const pay = 3 / k;
    this._isaretle({ x0: x0 - pay, y0: y0 - pay, x1: x1 + pay, y1: y1 + pay });
  }

  // tur "kirp": matbaa kırpma işaretleri ve dışarıda hafif karartma (TASARIM 3.20).
  // tur "bant": bandın renginde %85 opak dikdörtgen; secenek.desen ya da secenek.renk.
  // tur "sekil": iki renkli kesik çerçeve (şekil ya da serbest seçim kılavuzu).
  dikdortgen(x0, y0, x1, y1, tur = "sekil", secenek = {}) {
    if (bekleyen) islakAktar();
    this._sil();
    const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
    const ctx = this.ctx, o = this.olcek, k = this.k;
    ctx.save();
    if (tur === "kirp") {
      const W = this.canvas.width, H = this.canvas.height, d = this.dpr;
      const X0 = Math.round(ax * o), Y0 = Math.round(ay * o), X1 = Math.round(bx * o), Y1 = Math.round(by * o);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.koyuSayfa ? "#00000040" : "#221E1914";
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.fill("evenodd");
      const kal = Math.max(1, Math.round(d)), yarim = kal % 2 ? 0.5 : 0, bos = Math.round(6 * d), boy = Math.round(18 * d);
      ctx.strokeStyle = this.koyuSayfa ? "#F4EADA" : "#1B1B1F";
      ctx.lineWidth = kal;
      ctx.beginPath();
      for (const [cx, cy, sx, sy] of [[X0, Y0, -1, -1], [X1, Y0, 1, -1], [X0, Y1, -1, 1], [X1, Y1, 1, 1]]) {
        ctx.moveTo(cx + sx * bos, cy + yarim); ctx.lineTo(cx + sx * (bos + boy), cy + yarim);
        ctx.moveTo(cx + yarim, cy + sy * bos); ctx.lineTo(cx + yarim, cy + sy * (bos + boy));
      }
      ctx.stroke();
      ctx.restore();
      this.kirli = [0, 0, W, H];
      return;
    }
    ctx.setTransform(o, 0, 0, o, 0, 0);
    let pay = 3 / k;
    if (tur === "bant") {
      const desen = BANT_RENGI[secenek.desen] ? secenek.desen : "murekkep";
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = secenek.renk || BANT_RENGI[desen];
      ctx.fillRect(ax, ay, bx - ax, by - ay);
      if (!secenek.renk) {
        const dsn = ctx.createPattern(bantDosemesi(desen), "repeat");
        dsn.setTransform(new DOMMatrix([1 / (2 * k), 0, 0, 1 / (2 * k), 0, 0]));
        ctx.fillStyle = dsn;
        ctx.fillRect(ax, ay, bx - ax, by - ay);
      }
      pay = 1;
    } else {
      ctx.fillStyle = "#1F3A680A";
      ctx.fillRect(ax, ay, bx - ax, by - ay);
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3 / k; ctx.strokeRect(ax, ay, bx - ax, by - ay);
      ctx.setLineDash([6 / k, 5 / k]);
      ctx.strokeStyle = SAYFA_MAVI; ctx.lineWidth = 1.5 / k; ctx.strokeRect(ax, ay, bx - ax, by - ay);
    }
    ctx.restore();
    this._isaretle({ x0: ax - pay, y0: ay - pay, x1: bx + pay, y1: by + pay });
  }

  temizle() {
    if (bekleyen && bekleyen.canli === this) islakAktar();
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    this.kirli = null;
    this._iz = null;
  }

  _sil() {
    this._iz = null;
    if (!this.kirli) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(...this.kirli);
    ctx.restore();
    this.kirli = null;
  }

  // Birim cinsinden kutu: cihaz pikselinde tam sayı dikdörtgen [x, y, w, h], tuvale kırpılmış
  _cihaz(b) {
    const o = this.olcek, W = this.canvas.width, H = this.canvas.height;
    const X0 = Math.max(0, Math.floor(b.x0 * o) - 2), Y0 = Math.max(0, Math.floor(b.y0 * o) - 2);
    const X1 = Math.min(W, Math.ceil(b.x1 * o) + 2), Y1 = Math.min(H, Math.ceil(b.y1 * o) + 2);
    return X1 > X0 && Y1 > Y0 ? [X0, Y0, X1 - X0, Y1 - Y0] : null;
  }

  _isaretle(b) {
    this.kirli = this._cihaz(b);
  }
}

const KUYRUK = 10;   // kuyruk: yumuşatma pencereleri yüzünden son 10 seyrek nokta her karede değişebilir
const PARCA = 24;    // donmuş dış hat parçası başına düğüm sayısı

const kesisir = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

// Seyrek noktaların bas indeksinden sonrasının kutusu, en kalın iz payıyla
function kuyrukKutusu(c, D, bas) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = Math.max(0, bas); i < D.n; i++) {
    const x = D.X[i], y = D.Y[i];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = kalinlik(c);
  // gönye köşesi yarıçapın en fazla 1,16 katı uzanır
  const pay = (c.tur === "fosforlu" ? w / 2 : (Math.max(EN_INCE, genislik(c.tur, w, 1) * YON_UST) / 2) * 1.16) + 1;
  return { x0: x0 - pay, y0: y0 - pay, x1: x1 + pay, y1: y1 + pay };
}

function dikBirlesim(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]);
  return [x0, y0, Math.max(a[0] + a[2], b[0] + b[2]) - x0, Math.max(a[1] + a[3], b[1] + b[3]) - y0];
}

// Kalem kalkınca: dolma kalemde çizgi 600 ms canlı katmanda ıslak parlar ve kurur (TASARIM 6.2),
// sonra kaliciyaAktar(cizgi) çağrılır. Diğer kalemlerde ve sade harekette hemen aktarılır.
// Yeni bir çizgi başlarsa (canli.ciz, kement, dikdortgen) bekleyen çizgi hemen aktarılır.
export function islakBitir(canli, cizgi, kaliciyaAktar) {
  islakAktar();
  if (cizgi.tur !== "dolma" || hareketAz() || !cizgi.p || !cizgi.p.length) {
    kaliciyaAktar(cizgi);
    canli._sil();
    return;
  }
  const ctx = canli.ctx, o = canli.olcek;
  // Parlaklık: aynı izin %30 kalınlıkta kopyası, ışığa (sol üste) kaydırılmış; ince yerde incelir.
  // Yol önbelleğe yazılır, kalıcı katmana aktarırken yeniden hesaplanmaz.
  const kb = kayit(cizgi), D = seyrelt(noktalar(cizgi));
  const yol = kb.yol || (kb.yol = kalemYolu(cizgi, 1, D)), parlak = kalemYolu(cizgi, 0.3, D), sinir = kutu(cizgi);
  const renk = canli.koyuSayfa ? koyuRenk(cizgi.renk) : cizgi.renk;
  const kayma = -(0.4 + kalinlik(cizgi) * 0.05);
  const is = { canli, cizgi, aktar: kaliciyaAktar, raf: 0, yedek: 0 };
  const bas = performance.now();
  bekleyen = is;
  // rAF durursa (sekme arkada) çizgi canlı katmanda takılı kalmasın
  is.yedek = setTimeout(() => { if (bekleyen === is) islakAktar(); }, ISLAK_SURE + 150);
  const kare = (t) => {
    if (bekleyen !== is) return;
    const p = sinirla((t - bas) / ISLAK_SURE, 0, 1);
    canli._sil();
    ctx.save();
    ctx.setTransform(o, 0, 0, o, 0, 0);
    ctx.fillStyle = renk;
    ctx.fill(yol);
    const a = 0.35 * Math.pow(1 - p, 1.4);
    if (a > 0.004) {   // mürekkebin içinde kalır
      ctx.clip(yol);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#FFFFFF";
      ctx.translate(kayma, kayma);
      ctx.fill(parlak);
    }
    ctx.restore();
    canli._isaretle(sinir);
    if (p < 1) is.raf = requestAnimationFrame(kare);
    else islakAktar();
  };
  kare(bas);
}

// ---------- ölçüm ----------

function kutuHesapla(c) {
  const P = c.tur === "sekil" ? [c.p[0], c.p[c.p.length - 1]] : noktalar(c);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, bmax = 0;
  for (const q of P) {
    if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    const b = basincOku(q);
    if (b > bmax) bmax = b;
  }
  const w = kalinlik(c);
  let pay;
  if (c.tur === "fosforlu") pay = w / 2;
  else if (c.tur === "sekil") pay = w / 2 + (c.sekil === "ok" ? (8 + w * 3) * 0.4 + 1 : 0);
  else {
    if (x1 - x0 < 1 && y1 - y0 < 1) bmax = Math.max(bmax, NOKTA_BASINC);
    // gönye köşesi yarıçapın en fazla 1,16 katı uzanır
    pay = (Math.max(EN_INCE, genislik(c.tur, w, bmax) * (c.tur === "dolma" ? YON_UST : 1)) / 2) * 1.16;
  }
  pay += 0.5;
  return { x0: x0 - pay, y0: y0 - pay, x1: x1 + pay, y1: y1 + pay };
}

function segMesafe2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return x * x + y * y;
}

function ucgenIcinde(px, py, a, b, c) {
  const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]);
  const d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]);
  const d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function elipsNoktalari(a, b, n) {
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * TAM), cy + ry * Math.sin((i / n) * TAM)]);
}
function dikdortgenKoseleri(a, b) {
  return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
}

// Kapalı ya da açık çoklu çizgiye uzaklık sınaması
function cokluCizgiyeYakin(P, kapali, x, y, t) {
  const t2 = t * t, n = P.length;
  for (let i = 0; i < (kapali ? n : n - 1); i++) {
    const a = P[i], b = P[(i + 1) % n];
    if (segMesafe2(x, y, a[0], a[1], b[0], b[1]) <= t2) return true;
  }
  return false;
}

export function cizgiyeDokunuyor(cizgi, x, y, r) {
  if (!cizgi || !cizgi.p || !cizgi.p.length) return false;
  const k = kutu(cizgi);
  if (x + r < k.x0 || x - r > k.x1 || y + r < k.y0 || y - r > k.y1) return false;
  const w = kalinlik(cizgi);
  if (cizgi.tur === "sekil") {
    const a = cizgi.p[0], b = cizgi.p[cizgi.p.length - 1], t = r + w / 2;
    if (cizgi.sekil === "dikdortgen") return cokluCizgiyeYakin(dikdortgenKoseleri(a, b), true, x, y, t);
    if (cizgi.sekil === "elips") return cokluCizgiyeYakin(elipsNoktalari(a, b, 48), true, x, y, t);
    if (segMesafe2(x, y, a[0], a[1], b[0], b[1]) <= t * t) return true;
    if (cizgi.sekil === "ok") {
      const u = okBasi(a, b, w);
      return !!u && (ucgenIcinde(x, y, b, u.sol, u.sag) || cokluCizgiyeYakin([b, u.sol, u.sag], true, x, y, r));
    }
    return false;
  }
  // Ekranda görünen yumuşatılmış orta çizgiye ve gerçek yarıçapa göre
  const { X, Y, R } = ornekler(cizgi), n = X.length;
  if (n === 1) { const t = r + R[0]; return (x - X[0]) ** 2 + (y - Y[0]) ** 2 <= t * t; }
  for (let i = 0; i < n - 1; i++) {
    const t = r + Math.max(R[i], R[i + 1]);
    if (segMesafe2(x, y, X[i], Y[i], X[i + 1], Y[i + 1]) <= t * t) return true;
  }
  return false;
}

// Çizginin örneklenmiş orta çizgisi ve yarıçapları (önbellekli)
function ornekler(c) {
  const k = kayit(c);
  if (!k.ornek) {
    const D = seyrelt(noktalar(c));
    const W = c.tur === "fosforlu" ? new Array(D.n).fill(kalinlik(c)) : D.n ? genislikler(c, D) : [];
    k.ornek = D.n ? ornekle(D, W) : { X: [], Y: [], R: [] };
  }
  return k.ornek;
}

// Dokunduğu çizgileri bütün olarak siler; dizi yerinde değişir, silinenler döner.
// onceki: [x, y] verilirse silginin iki konum arasındaki yolu da sınanır (hızlı harekette boşluk kalmaz).
// yarilanan: Set verilirse kurşun kalem iki geçişte silinir: ilk geçişte yerine soluk kopyası konur
// (aynı id, yeni nesne: geçmişteki eski nesne bozulmaz), kopyanın id'si Set'e yazılır ve aynı silme
// hareketinde bir daha dokunulmaz. Soluklaşan çizginin eski nesnesi de dönen listeye girer (yeniden çizim bölgesi için).
export function silgi(cizgiler, x, y, r, { sadeceFosforlu = false, onceki = null, yarilanan = null } = {}) {
  const konumlar = [[x, y]];
  if (onceki) {
    const L = Math.hypot(x - onceki[0], y - onceki[1]), adim = Math.max(0.5, r * 0.75);
    for (let s = adim; s < L; s += adim) konumlar.push([onceki[0] + ((x - onceki[0]) * s) / L, onceki[1] + ((y - onceki[1]) * s) / L]);
  }
  // Silgi yolunun kutusu: uzaktaki çizgiler her konum için ayrı ayrı sınanmaz (ağır sayfada kareyi yiyordu)
  let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
  for (const [px, py] of konumlar) { if (px < sx0) sx0 = px; if (px > sx1) sx1 = px; if (py < sy0) sy0 = py; if (py > sy1) sy1 = py; }
  sx0 -= r; sy0 -= r; sx1 += r; sy1 += r;
  const silinen = [];
  for (let i = cizgiler.length - 1; i >= 0; i--) {
    const c = cizgiler[i];
    if (sadeceFosforlu && c.tur !== "fosforlu") continue;
    if (!c || !c.p || !c.p.length) continue;
    const k = kutu(c);
    if (sx1 < k.x0 || sx0 > k.x1 || sy1 < k.y0 || sy0 > k.y1) continue;
    if (yarilanan && c.id != null && yarilanan.has(c.id)) continue;
    if (!konumlar.some(([px, py]) => cizgiyeDokunuyor(c, px, py, r))) continue;
    if (yarilanan && c.tur === "kursun" && !c.soluk) {
      cizgiler[i] = { ...c, soluk: true };
      if (c.id != null) yarilanan.add(c.id);
      silinen.unshift(c);
    } else silinen.unshift(cizgiler.splice(i, 1)[0]);
  }
  return silinen;
}

// Kement için çizgiyi temsil eden noktalar: iki noktalı çizgi ve şekiller örneklenir
function temsilNoktalari(c) {
  if (c.tur === "sekil") {
    const a = c.p[0], b = c.p[c.p.length - 1];
    if (c.sekil === "elips") return elipsNoktalari(a, b, 16);
    if (c.sekil === "dikdortgen") {
      const K = dikdortgenKoseleri(a, b);
      return K.flatMap((q, i) => { const s = K[(i + 1) % 4]; return [0, 0.25, 0.5, 0.75].map((t) => [q[0] + (s[0] - q[0]) * t, q[1] + (s[1] - q[1]) * t]); });
    }
  }
  const P = c.tur === "sekil" ? [c.p[0], c.p[c.p.length - 1]] : noktalar(c);
  if (P.length !== 2) return P;
  const [a, b] = P;
  return Array.from({ length: 9 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8]);
}

function icinde(x, y, P) {
  let ic = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic;
  }
  return ic;
}

// Noktalarının yarısından fazlası kementin içinde kalan çizgilerin indeksleri (artan sırada)
export function kementSec(cizgiler, cokgen) {
  if (!cokgen || cokgen.length < 3) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of cokgen) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const secilen = [];
  cizgiler.forEach((c, i) => {
    if (!c.p || !c.p.length) return;
    const k = kutu(c);
    if (k.x1 < x0 || k.x0 > x1 || k.y1 < y0 || k.y0 > y1) return;
    const N = temsilNoktalari(c);
    let ic = 0;
    for (const q of N) if (icinde(q[0], q[1], cokgen)) ic++;
    if (ic * 2 > N.length) secilen.push(i);
  });
  return secilen;
}

// Seçili çizgilerin kalınlık payı dahil sınır kutusu; seçim boşsa null
export function sinirKutusu(cizgiler, indeksler) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of indeksler) {
    const c = cizgiler[i];
    if (!c || !c.p || !c.p.length) continue;
    const k = kutu(c);
    if (k.x0 < x0) x0 = k.x0; if (k.y0 < y0) y0 = k.y0;
    if (k.x1 > x1) x1 = k.x1; if (k.y1 > y1) y1 = k.y1;
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

// Seçimi taşır ve (ox, oy) çevresinde orantılı büyütür. asil: seçim başındaki derin kopya
// (bütün dizinin ya da yalnız seçilenlerin kopyası olabilir; id ile eşleşir). Kalınlık da ölçeklenir.
// Çizgi nesneleri yerinde kalır, p yeni dizi olur. Yeni sınır kutusunu döner.
export function tasi(cizgiler, indeksler, asil, { dx = 0, dy = 0, olcek = 1, ox = 0, oy = 0 } = {}) {
  const s = Math.max(0.05, olcek);
  const kimlikle = new Map();
  for (const a of asil) if (a && a.id != null) kimlikle.set(a.id, a);
  indeksler.forEach((i, j) => {
    const c = cizgiler[i];
    if (!c) return;
    const a = (c.id != null && kimlikle.get(c.id)) || (asil.length === indeksler.length ? asil[j] : asil[i]);
    if (!a) return;
    c.p = a.p.map((q) => {
      const y = [ox + (q[0] - ox) * s + dx, oy + (q[1] - oy) * s + dy];
      if (q.length > 2) y.push(q[2]);
      return y;
    });
    c.w = a.w * s;
  });
  return sinirKutusu(cizgiler, indeksler);
}

// "Kalemi basılı tut, düzelt": ilk ve son nokta arası düz çizgi (yeni nesne).
// Basınç uçlar hariç ortalamadır, böylece düz çizgi düzgün kalınlıkta olur.
export function duzlestir(cizgi) {
  const p = cizgi.p || [];
  if (!p.length) return { ...cizgi, p: [], duz: true };
  const atla = p.length > 6 ? 2 : 0;
  let top = 0, say = 0;
  for (let i = atla; i < p.length - atla; i++) { top += basincOku(p[i]); say++; }
  const b = say ? top / say : 0.5;
  const [a, z] = duzUclar(p);
  return { ...cizgi, p: [[a[0], a[1], b], [z[0], z[1], b]], duz: true };
}

// ---------- şekil tanıma (Samsung Notes gibi: çiz, kalemi tut, düzelsin) ----------
// Elle çizilmiş çizgiyi düz çizgiye, oka, elipse (daireye), dikdörtgene ya da üçgene çevirir.
// Tanınırsa yeni çizgi nesnesi döner: aynı tür, renk ve kalınlık; noktalar ideal şeklin üstünde, basınç sabit.
// Sonuç sıradan bir kalem çizgisidir (silgi, kement, dışa aktarma ayrıca bir şey bilmez); sekilDuz yalnız bilgi.
// Düz çizgide duzlestir() sonucu döner (duz: true). Tanınmazsa null. Kalem dururken bir kez çağrılır.
const SEKIL_ESIK = 0.055;   // ortalama sapma / şekil boyu: bundan büyükse şekil sayılmaz
const SEKIL_ADIM = 2.5;     // ideal şeklin nokta aralığı (birim)
const uzak = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function yolBoyu(P) { let L = 0; for (let i = 1; i < P.length; i++) L += uzak(P[i - 1], P[i]); return L; }
// Yay uzunluğuna göre n eşit aralıklı nokta: sık çizilmiş yerler ağırlık kazanmasın
function yenidenOrnekle(P, n) {
  const L = yolBoyu(P), adim = L / (n - 1), S = [P[0]];
  let kalan = adim, i = 1, onceki = P[0];
  while (i < P.length && S.length < n - 1) {
    const d = uzak(onceki, P[i]);
    if (d >= kalan && d > 0) {
      const t = kalan / d, q = [onceki[0] + (P[i][0] - onceki[0]) * t, onceki[1] + (P[i][1] - onceki[1]) * t];
      S.push(q); onceki = q; kalan = adim;
    } else { kalan -= d; onceki = P[i]; i++; }
  }
  S.push(P[P.length - 1]);
  return S;
}
// Noktadan düz çizgiye (a-b doğrusu) uzaklık
function dogruyaUzak(q, a, b) {
  const L = uzak(a, b) || 1;
  return Math.abs((b[0] - a[0]) * (a[1] - q[1]) - (a[0] - q[0]) * (b[1] - a[1])) / L;
}
// Köşeler arası sık noktalı kapalı ya da açık çoklu çizgi
function sikla(K, kapali) {
  const P = [];
  const n = kapali ? K.length : K.length - 1;
  for (let i = 0; i < n; i++) {
    const a = K[i], b = K[(i + 1) % K.length], adim = Math.max(1, Math.ceil(uzak(a, b) / SEKIL_ADIM));
    for (let s = 0; s < adim; s++) P.push([a[0] + ((b[0] - a[0]) * s) / adim, a[1] + ((b[1] - a[1]) * s) / adim]);
  }
  P.push(kapali ? [K[0][0], K[0][1]] : [K[K.length - 1][0], K[K.length - 1][1]]);
  return P;
}
const segUzak = (q, a, b) => Math.sqrt(segMesafe2(q[0], q[1], a[0], a[1], b[0], b[1]));

export function sekilTani(cizgi) {
  const p = cizgi && cizgi.p;
  if (!p || p.length < 6 || cizgi.tur === "sekil" || cizgi.tur === "fosforlu") return null;
  const H = p.map((q) => [q[0], q[1]]);
  const L = yolBoyu(H);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y] of H) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const bw = bx1 - bx0, bh = by1 - by0;
  if (Math.max(bw, bh) < 14 || L < 24) return null;
  const atla = p.length > 6 ? 2 : 0;
  let top = 0, say = 0;
  for (let i = atla; i < p.length - atla; i++) { top += basincOku(p[i]); say++; }
  const b = say ? top / say : 0.5;
  const sonuc = (K, kapali, ad) => ({ ...cizgi, p: sikla(K, kapali).map((q) => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100, b]), duz: undefined, sekilDuz: ad });
  const R = yenidenOrnekle(H, 72), a = R[0], z = R[R.length - 1];

  // Açık çizgi: düz çizgi ya da ok
  if (uzak(a, z) > 0.3 * L) {
    const chord = uzak(a, z);
    let enSap = 0, topSap = 0;
    for (const q of R) { const d = dogruyaUzak(q, a, z); topSap += d; if (d > enSap) enSap = d; }
    if (topSap / R.length < 0.035 * chord && enSap < 0.1 * chord) return { ...duzlestir(cizgi), sekilDuz: "cizgi" };
    // Ok: başlangıçtan en uzak nokta uçtur; ona kadar düz, sonrası ucun çevresinde kısa bir kanat
    // Kanat çizilirken uca geri dönülür: en uzak noktaya ilk kez neredeyse varılan yer uçtur
    let enUzak = 0;
    for (const q of R) enUzak = Math.max(enUzak, uzak(a, q));
    const ti = R.findIndex((q) => uzak(a, q) >= enUzak * 0.97), uc = R[ti], tu = uzak(a, uc), kuyruk = R.slice(ti);
    if (ti < R.length * 0.45 || ti > R.length - 4 || tu < 30) return null;
    let govdeSap = 0;
    for (let i = 0; i <= ti; i++) govdeSap = Math.max(govdeSap, dogruyaUzak(R[i], a, uc));
    const kuyrukBoy = yolBoyu(kuyruk);
    let kanat = 0;
    for (const q of kuyruk) kanat = Math.max(kanat, uzak(q, uc));
    if (govdeSap > 0.1 * tu || kuyrukBoy < 0.12 * tu || kanat > 0.6 * tu || kanat < 6) return null;
    const ux = (uc[0] - a[0]) / tu, uy = (uc[1] - a[1]) / tu, kb = Math.min(Math.max(kanat, 0.1 * tu, 10), 0.35 * tu);
    const aci = (28 * Math.PI) / 180, c = Math.cos(aci), s = Math.sin(aci);
    const sol = [uc[0] - kb * (ux * c - uy * s), uc[1] - kb * (uy * c + ux * s)];
    const sag = [uc[0] - kb * (ux * c + uy * s), uc[1] - kb * (uy * c - ux * s)];
    const govde = sikla([a, uc], false), k1 = sikla([uc, sol], false), k2 = sikla([sol, uc, sag], false);
    const P = [...govde, ...k1.slice(1), ...k2.slice(1)];
    return { ...cizgi, p: P.map((q) => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100, b]), duz: undefined, sekilDuz: "ok" };
  }

  // Kapalı çizgi: elips, dikdörtgen, üçgen. Hepsine uydurulur, en az sapan seçilir.
  const C = R.slice(0, -1), n = C.length, olcu = (bw + bh) / 2;
  let cx = 0, cy = 0;
  for (const q of C) { cx += q[0]; cy += q[1]; }
  cx /= n; cy /= n;
  const dondur = (q, t) => { const dx = q[0] - cx, dy = q[1] - cy, c = Math.cos(t), s = Math.sin(t); return [dx * c + dy * s, -dx * s + dy * c]; };
  const geri = (u, v, t) => { const c = Math.cos(t), s = Math.sin(t); return [cx + u * c - v * s, cy + u * s + v * c]; };
  const eksen = (t) => (Math.abs(t) < (9 * Math.PI) / 180 ? 0 : t);   // eksene yakınsa oturur

  // Elips: ana eksenler kovaryanstan, yarıçaplar döndürülmüş kutudan
  let sxx = 0, syy = 0, sxy = 0;
  for (const q of C) { const dx = q[0] - cx, dy = q[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  let te = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const q of C) { const [u, v] = dondur(q, te); if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
  let rx = (u1 - u0) / 2, ry = (v1 - v0) / 2;
  const eu = (u0 + u1) / 2, ev = (v0 + v1) / 2;
  let hataE = 0;
  for (const q of C) {
    const [u0_, v0_] = dondur(q, te), u = u0_ - eu, v = v0_ - ev, r = Math.hypot(u / (rx || 1), v / (ry || 1)) || 1;
    hataE += Math.hypot(u, v) * Math.abs(1 - 1 / r);
  }
  hataE /= n * olcu;

  // Dikdörtgen: kenar yönleri 90 derece katlanarak ortalanır (4θ hilesi)
  let s4 = 0, c4 = 0;
  for (let i = 0; i < n; i++) {
    const q = C[i], r = C[(i + 1) % n], d = uzak(q, r), f = Math.atan2(r[1] - q[1], r[0] - q[0]);
    s4 += d * Math.sin(4 * f); c4 += d * Math.cos(4 * f);
  }
  const tr = eksen(Math.atan2(s4, c4) / 4);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const q of C) { const [u, v] = dondur(q, tr); if (u < a0) a0 = u; if (u > a1) a1 = u; if (v < b0) b0 = v; if (v > b1) b1 = v; }
  const hx = (a1 - a0) / 2, hy = (b1 - b0) / 2, ru = (a0 + a1) / 2, rv = (b0 + b1) / 2;
  let hataR = 0;
  for (const q of C) {
    const [u_, v_] = dondur(q, tr), u = Math.abs(u_ - ru), v = Math.abs(v_ - rv);
    hataR += u <= hx && v <= hy ? Math.min(hx - u, hy - v) : Math.hypot(Math.max(u - hx, 0), Math.max(v - hy, 0));
  }
  hataR /= n * olcu;

  // Üçgen: en uzak iki nokta ve o doğruya en uzak üçüncü nokta
  let A = C[0], B = C[0], enAB = 0;
  for (let i = 0; i < n; i += 2) for (let j = i + 1; j < n; j += 2) { const d = uzak(C[i], C[j]); if (d > enAB) { enAB = d; A = C[i]; B = C[j]; } }
  let K3 = C[0], enC = 0;
  for (const q of C) { const d = dogruyaUzak(q, A, B); if (d > enC) { enC = d; K3 = q; } }
  let hataT = 0;
  for (const q of C) hataT += Math.min(segUzak(q, A, B), segUzak(q, B, K3), segUzak(q, K3, A));
  hataT /= n * olcu;
  if (enC < 0.2 * enAB) hataT = Infinity;   // yassı üçgen değil, çizgidir

  const en = Math.min(hataE, hataR, hataT);
  if (!(en < SEKIL_ESIK)) return null;
  if (en === hataE) {
    const [mx, my] = geri(eu, ev, te);
    if (Math.min(rx, ry) / Math.max(rx, ry) > 0.86) rx = ry = (rx + ry) / 2;   // daireye oturur
    te = rx === ry ? 0 : eksen(te);
    const cevre = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const N = Math.min(240, Math.max(48, Math.round(cevre / SEKIL_ADIM)));
    const K = [];
    for (let i = 0; i < N; i++) {
      const f = -Math.PI / 2 + (i / N) * Math.PI * 2, u = rx * Math.cos(f), v = ry * Math.sin(f), c = Math.cos(te), s = Math.sin(te);
      K.push([mx + u * c - v * s, my + u * s + v * c]);
    }
    const P = [...K, K[0]];
    return { ...cizgi, p: P.map((q) => [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100, b]), duz: undefined, sekilDuz: "elips" };
  }
  if (en === hataR) {
    let ex = hx, ey = hy;
    if (Math.abs(ex - ey) / Math.max(ex, ey) < 0.08) ex = ey = (ex + ey) / 2;   // kareye oturur
    // Dikiş görünmesin diye üst kenarın ortasından başlar
    const K = [[0, -ey], [ex, -ey], [ex, ey], [-ex, ey], [-ex, -ey]].map(([u, v]) => geri(ru + u, rv + v, tr));
    return sonuc(K, true, "dikdortgen");
  }
  const orta = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  return sonuc([orta, B, K3, A], true, "ucgen");
}

// ---------- izler: kalemin değdiği yer metne bağlanır (OZELLIKLER-5, İzler sözleşmesi) ----------
// Saf ölçüm: kalem kalkınca boşta bir kez çağrılır, çizgileri değiştirmez.
// kelimeler: [{ str, x, y, w, h }] sayfa biriminde (y aşağı, kutunun üstü). Boşsa (defter) yalnız biçime bakılır.
// Dönen: { tur: "alt" | "daire" | "kenar" | "isaret" | "serbest", metin, kutu: { x0, y0, x1, y1 } }
const IZ_METIN = 280;
const IZ_KUCUK = 56;    // işaret sayılan en büyük boy (birim): yıldız, ünlem, soru, onay
const IZ_SUTUN_PAY = 4;

// Kelimeler satır parçalarına toplanır: dikey ortası yakın ve aralarında sütun boşluğu olmayanlar bir parça
export function satirlaraTopla(kelimeler) {
  const K = (kelimeler || []).filter((k) => k && k.str && k.w > 0 && k.h > 0)
    .sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const satirlar = [];
  for (const k of K) {
    const cy = k.y + k.h / 2;
    let s = null;
    for (let i = satirlar.length - 1; i >= Math.max(0, satirlar.length - 4); i--) {
      const t = satirlar[i];
      if (Math.abs(cy - t.cy) < Math.min(k.h, t.h) * 0.5) { s = t; break; }
    }
    if (!s) { s = { kelimeler: [], cy, h: k.h, top: 0 }; satirlar.push(s); }
    s.kelimeler.push(k);
    s.top += cy;
    s.cy = s.top / s.kelimeler.length;
    s.h = Math.max(s.h, k.h);
  }
  const parcalar = [];
  for (const s of satirlar) {
    s.kelimeler.sort((a, b) => a.x - b.x);
    let p = null;
    for (const k of s.kelimeler) {
      // İki sütunlu sayfada aynı yükseklikteki iki satır ayrı parça olur
      if (!p || k.x - p.x1 > Math.max(3 * s.h, 30)) { p = { kelimeler: [], x0: k.x, x1: k.x + k.w, y0: k.y, y1: k.y + k.h }; parcalar.push(p); }
      p.kelimeler.push(k);
      p.x0 = Math.min(p.x0, k.x); p.x1 = Math.max(p.x1, k.x + k.w);
      p.y0 = Math.min(p.y0, k.y); p.y1 = Math.max(p.y1, k.y + k.h);
    }
  }
  for (const p of parcalar) { p.h = p.y1 - p.y0; p.cy = (p.y0 + p.y1) / 2; }
  return parcalar.sort((a, b) => a.cy - b.cy || a.x0 - b.x0);
}

const sirala = (a, p) => { const d = a.slice().sort((x, y) => x - y); return d[Math.min(d.length - 1, Math.max(0, Math.floor(p * d.length)))]; };
function metinBirles(kelimeler) {
  let s = kelimeler.map((k) => k.str).join(" ").replace(/\s+/g, " ").trim();
  if (s.length > IZ_METIN) s = s.slice(0, IZ_METIN - 1).trimEnd() + "…";
  return s;
}
// Parçaların sırayla metni (satır sonu boşlukla)
const parcaMetni = (P) => metinBirles(P.flatMap((p) => p.kelimeler));
const ortakX = (k, x0, x1) => Math.max(0, Math.min(k.x + k.w, x1) - Math.max(k.x, x0));

// Kapalı halka mı: uç başlangıca (ya da başlangıç uca) yakın döner ve yol kutunun çevresi kadar uzun
function halkaMi(P, L, bw, bh) {
  const m = Math.max(bw, bh);
  if (Math.min(bw, bh) < 6 || L < 2.2 * m || P.length < 6) return false;
  const esik = Math.max(0.28 * m, 10), n = P.length, ceyrek = Math.max(2, Math.floor(n * 0.2));
  const a = P[0], z = P[n - 1];
  for (let i = 0; i < ceyrek; i++) if (Math.hypot(P[i][0] - z[0], P[i][1] - z[1]) < esik) return true;
  for (let i = n - ceyrek; i < n; i++) if (Math.hypot(P[i][0] - a[0], P[i][1] - a[1]) < esik) return true;
  return false;
}

export function izSinifla(cizgiler, { kelimeler = [], W = SAYFA_GENISLIK } = {}) {
  const C = (cizgiler || []).filter((c) => c && c.p && c.p.length);
  const kutu = cizgilerKutusu(C) || { x0: 0, y0: 0, x1: 0, y1: 0 };
  if (!C.length) return { tur: "serbest", metin: "", kutu };
  // Çizgi başına biçim: yalnız noktalar (kalınlık payı yok)
  const bicim = C.map((c) => {
    const P = c.tur === "sekil" ? [c.p[0], c.p[c.p.length - 1]] : noktalar(c);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, L = 0, ty = 0;
    for (let i = 0; i < P.length; i++) {
      const [x, y] = P[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (i) L += Math.hypot(x - P[i - 1][0], y - P[i - 1][1]);
      ty += y;
    }
    const bw = x1 - x0, bh = y1 - y0;
    const sekilHalka = c.sekilDuz === "elips" || c.sekilDuz === "dikdortgen" || c.sekilDuz === "ucgen" || (c.tur === "sekil" && (c.sekil === "elips" || c.sekil === "dikdortgen"));
    return { P, x0, y0, x1, y1, bw, bh, L, ortaY: ty / P.length,
      halka: sekilHalka || halkaMi(P, L, bw, bh),
      yatay: bw >= 16 && bw >= 3 * bh, dikey: bh >= 24 && bh >= 3 * bw };
  });
  const bx0 = Math.min(...bicim.map((b) => b.x0)), bx1 = Math.max(...bicim.map((b) => b.x1));
  const by0 = Math.min(...bicim.map((b) => b.y0)), by1 = Math.max(...bicim.map((b) => b.y1));
  const bw = bx1 - bx0, bh = by1 - by0, cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const fosforlu = C.some((c) => c.tur === "fosforlu");

  const parcalar = satirlaraTopla(kelimeler), metinVar = parcalar.length > 0;
  // Metin sütunu: parçaların uçlarından (kenardaki sayfa numarası gibi tekil parçalar sayılmaz)
  const sx0 = metinVar ? sirala(parcalar.map((p) => p.x0), 0.1) : W * 0.1;
  const sx1 = metinVar ? sirala(parcalar.map((p) => p.x1), 0.9) : W * 0.9;
  const sutunla = Math.max(0, Math.min(bx1, sx1) - Math.max(bx0, sx0));
  const kenarda = (cx < sx0 - IZ_SUTUN_PAY || cx > sx1 + IZ_SUTUN_PAY) && sutunla < Math.max(0.35 * bw, 2);
  const kucuk = Math.max(bw, bh) <= IZ_KUCUK;

  // Yandaki satırlar: dikey aralığa değen, işarete en yakın sütundaki parçalar
  const yandakiler = (y0, y1, enCok = Infinity) => {
    const ust = parcalar.filter((p) => Math.min(p.y1, y1) - Math.max(p.y0, y0) > p.h * 0.4);
    if (!ust.length) return [];
    const uzak = (p) => (cx < p.x0 ? p.x0 - cx : cx > p.x1 ? cx - p.x1 : 0);
    const en = Math.min(...ust.map(uzak));
    return ust.filter((p) => uzak(p) <= en + 40).slice(0, enCok);
  };
  const kutudaki = (x0, y0, x1, y1) => parcalar.flatMap((p) => p.kelimeler)
    .filter((k) => { const kx = k.x + k.w / 2, ky = k.y + k.h / 2; return kx >= x0 && kx <= x1 && ky >= y0 && ky <= y1; });

  let tur = "serbest", metin = "";
  if (fosforlu) {
    // Fosforlu kalem satırın üstünden geçer: bandın değdiği kelimeler
    const pay = Math.max(...C.map((c) => (c.tur === "fosforlu" ? kalinlik(c) / 2 : 0)));
    metin = metinBirles(parcalar.filter((p) => p.cy >= by0 - pay && p.cy <= by1 + pay)
      .flatMap((p) => p.kelimeler.filter((k) => ortakX(k, bx0, bx1) >= k.w * 0.5)));
  } else if (C.length === 1 && bicim[0].halka) {
    if (kucuk && kenarda) { tur = "isaret"; metin = parcaMetni(yandakiler(cy - 12, cy + 12, 1)); }
    else {
      tur = "daire";
      const P = bicim[0].P;
      let ic = parcalar.flatMap((p) => p.kelimeler).filter((k) => icinde(k.x + k.w / 2, k.y + k.h / 2, P));
      if (!ic.length) ic = kutudaki(bx0 - 2, by0 - 2, bx1 + 2, by1 + 2);
      metin = metinBirles(ic);
    }
  } else if (bicim.every((b) => b.yatay) && !kenarda) {
    // Satırın altında mı: çizgi kelimenin ortasından aşağıda, bir satır boyundan az altta
    const y = Math.min(...bicim.map((b) => b.ortaY));
    const aday = parcalar.filter((p) => y >= p.y0 + p.h * 0.5 && y <= p.y1 + p.h * 0.8 && p.x1 > bx0 && p.x0 < bx1)
      .sort((a, b) => Math.abs(y - a.y1) - Math.abs(y - b.y1));
    if (aday.length) {
      tur = "alt";
      const s = aday[0];
      metin = metinBirles(s.kelimeler.filter((k) => ortakX(k, bx0 - 2, bx1 + 2) >= k.w * 0.4));
    } else if (!metinVar) tur = "alt";
    else metin = metinBirles(kutudaki(bx0, by0 - 14, bx1, by1 + 14));   // satırın ortasından geçen çizgi: üstü çizili
  } else if (kucuk && kenarda) {
    tur = "isaret";
    metin = parcaMetni(yandakiler(cy - Math.max(12, bh / 2), cy + Math.max(12, bh / 2), 1));
  } else if (bicim.every((b) => b.dikey) && (kenarda || (!metinVar && (cx < W * 0.15 || cx > W * 0.85)))) {
    tur = "kenar";
    metin = parcaMetni(yandakiler(by0, by1));
  } else if (kenarda) {
    // Kenara yazılmış not: yanındaki satırlara bağlanır
    metin = parcaMetni(yandakiler(by0, by1));
  } else metin = metinBirles(kutudaki(bx0 - 2, by0 - 2, bx1 + 2, by1 + 2));
  return { tur, metin, kutu };
}

// ---------- geri al / yinele ----------

export class Gecmis {
  constructor(sinir = 200) {
    this.sinir = sinir;
    this.kayitlar = [];
    this.konum = 0;
  }
  // { sayfa, once, sonra } ve istenen ek alanlar; kayıt nesnesini döner
  kaydet({ sayfa, once, sonra, ...ek }) {
    this.kayitlar.length = this.konum;
    const kayit = { ...ek, sayfa, once, sonra };
    this.kayitlar.push(kayit);
    if (this.kayitlar.length > this.sinir) this.kayitlar.splice(0, this.kayitlar.length - this.sinir);
    this.konum = this.kayitlar.length;
    return kayit;
  }
  // Uygulanacak durum: geriAl() sonrası kayit.once, yinele() sonrası kayit.sonra
  geriAl() { return this.konum > 0 ? this.kayitlar[--this.konum] : null; }
  yinele() { return this.konum < this.kayitlar.length ? this.kayitlar[this.konum++] : null; }
  get geriAlinabilir() { return this.konum > 0; }
  get yinelenebilir() { return this.konum < this.kayitlar.length; }
  temizle() { this.kayitlar = []; this.konum = 0; }
}

export const anlik = (durum) => structuredClone(durum);

// ---------- bölge yakalama (kırpma) ----------
// Sayfa ve mürekkep tuvallerinden birim başına 2 piksellik PNG. Sayfa dışı (kenar alanı) zeminle dolar.
// Mürekkep ekrandaki gibi karışır: açık sayfada multiply, koyuSayfa'da screen.
export function bolgeYakala({ sayfaCanvas, murekkepCanvas, olcek, x0, y0, x1, y1, zemin = "#fff", koyuSayfa = false }) {
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
  const W = Math.max(1, Math.round((bx - ax) * 2)), H = Math.max(1, Math.round((by - ay) * 2));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = zemin;
  g.fillRect(0, 0, W, H);
  g.imageSmoothingQuality = "high";
  g.setTransform(W / (bx - ax || 1), 0, 0, H / (by - ay || 1), -ax * (W / (bx - ax || 1)), -ay * (H / (by - ay || 1)));
  const parca = (kaynak, s, mod) => {
    if (!kaynak || !kaynak.width || !kaynak.height || !(s > 0)) return;
    const ix0 = Math.max(ax, 0), iy0 = Math.max(ay, 0), ix1 = Math.min(bx, kaynak.width / s), iy1 = Math.min(by, kaynak.height / s);
    if (ix1 <= ix0 || iy1 <= iy0) return;
    g.globalCompositeOperation = mod;
    g.drawImage(kaynak, ix0 * s, iy0 * s, (ix1 - ix0) * s, (iy1 - iy0) * s, ix0, iy0, ix1 - ix0, iy1 - iy0);
  };
  parca(sayfaCanvas, sayfaCanvas ? sayfaCanvas.width / SAYFA_GENISLIK : 0, "source-over");
  parca(murekkepCanvas, olcek, koyuSayfa ? "screen" : "multiply");   // ekrandaki CSS karışımıyla aynı
  return c.toDataURL("image/png");
}

// ---------- ayar balonundaki örnek dalga ----------
// Kalemin gerçek motoruyla, %100 ölçekte (1 birim = 1 CSS pikseli) kısa bir dalga.
export function ornekDalga(canvas, { tur = "dolma", renk = "#1F3A68", w = 3 } = {}) {
  const cw = canvas.clientWidth || 72, ch = canvas.clientHeight || 32;
  const d = Math.min(3, globalThis.devicePixelRatio || 1);
  const W = Math.round(cw * d), H = Math.round(ch * d);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const fos = tur === "fosforlu";
  const gw = fos ? Math.min(w, ch * 0.6) : w;
  const enKalin = fos ? gw : genislik(tur, gw, 0.85) * YON_UST;
  const genlik = fos ? 1.2 : sinirla((ch - enKalin) / 2 - 3, 1.5, 7);
  const kenar = 6 + Math.min(enKalin / 2, 8), N = 56, p = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    p.push([kenar + (cw - 2 * kenar) * t, ch / 2 - genlik * Math.sin(TAM * 1.15 * t + 0.35), 0.28 + 0.57 * Math.pow(Math.sin(Math.PI * t), 0.8)]);
  }
  cizgiyiCiz(ctx, { tur, renk, w: gw, p }, false, false);
}
