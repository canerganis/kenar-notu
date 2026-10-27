// Dışa aktarma (OZELLIKLER-3 §5): notlu PDF, EPUB vurguları Markdown, paylaş menüsü ya da indirme.
// Sözleşme: pdfDisaAktar(belge, { sayfalar }), paylas(blob, dosyaAdi), epubNotlariDisaAktar(belge).
//
// Koordinat: uygulama birimi (sayfa genişliği 800, y aşağı). Her sayfada tek bir "cm" uygulama birimini
// PDF puntosuna çevirir (y yukarı, sayfanın kendi kırpma kutusu, döndürülmüş sayfalar). Böylece çizgiler,
// şekiller ve görüntüler doğrudan uygulama biriminde yazılır.
// Çizgiler vektör: kalem izi kalem.js'teki dış hat algoritmasının aynısıyla dolgu poligonu, fosforlu yarı
// saydam çarpma karışımlı çizgi. Yazılar (yapışkan not, metin kutusu, asistan notu, Cornell başlıkları)
// Türkçe karakterler standart PDF yazı tiplerinde olmadığı için yüksek çözünürlüklü görüntü olarak basılır;
// kare, çerçeve ve bant çizgileri yine vektör.

import { PDFDocument, PDFHexString } from "../lib/pdf-lib.esm.min.js";
import { genislik } from "./kalem.js";
import { PW, PH, PDF_PAGES, drawTemplate } from "./sayfalar.js";
import * as SAYFALAR from "./sayfalar.js";
import { toast } from "./ortak.js";

const KW = 272, TW = PW + KW;          // kenar alanı (duzenleyici.js ile aynı)
const A4_W = 595.28;                   // örnek ve defter sayfaları A4 genişliğinde
const YAZI_Z = 4;                      // yazı görüntüsü: uygulama birimi başına piksel (A4'te ~390 dpi)
const SAYFA_Z = 2.5;                   // örnek PDF sayfası görüntüsü (2000 px genişlik)
const NOT_W = 200;
const ASISTAN_NOT_W = 224;
const BANT_RENGI = { murekkep: "#34507E", bordo: "#84323F", hardal: "#C9A048", adacayi: "#87A08A" };
const TAM = Math.PI * 2;

const YAZI = {
  el: (px) => `500 ${px}px Caveat, "Segoe Print", cursive`,
  okuma: (px, italik = false) => `${italik ? "italic " : ""}400 ${px}px Literata, Georgia, serif`,
  olcu: (px) => `500 ${px}px "IBM Plex Mono", ui-monospace, Consolas, monospace`,
};

// ---------- sayı, renk ----------

// Uygulama biriminde 0,1 hassasiyet: A4'te 0,07 punto, gözle görülmez; dosya küçük kalır
const f = (v) => { const r = Math.round(v * 10) / 10; return r === 0 ? "0" : String(r); };
const f3 = (v) => String(Math.round(v * 1000) / 1000);
const sinirla = (v, a, b) => (v < a ? a : v > b ? b : v);

function renkCoz(renk) {
  let s = String(renk || "#1B1B1F").trim().replace("#", "");
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join("");
  const n = parseInt(s.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s) || Number.isNaN(n)) return { r: 0.106, g: 0.106, b: 0.122, a: 1 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: s.length === 8 ? parseInt(s.slice(6), 16) / 255 : 1 };
}
const rgb = (c) => `${f3(c.r)} ${f3(c.g)} ${f3(c.b)}`;

// ---------- PDF yol yazıcı (Path2D'nin kalem.js'te kullanılan alt kümesi) ----------

const KAPPA = 0.5523;
class Yol {
  constructor() { this.o = []; this.x = 0; this.y = 0; }
  moveTo(x, y) { this.o.push(`${f(x)} ${f(y)} m`); this.x = x; this.y = y; }
  lineTo(x, y) { this.o.push(`${f(x)} ${f(y)} l`); this.x = x; this.y = y; }
  bezierCurveTo(ax, ay, bx, by, x, y) { this.o.push(`${f(ax)} ${f(ay)} ${f(bx)} ${f(by)} ${f(x)} ${f(y)} c`); this.x = x; this.y = y; }
  quadraticCurveTo(cx, cy, x, y) {   // PDF'te ikinci derece eğri yok: kübiğe çevrilir
    const x0 = this.x, y0 = this.y;
    this.bezierCurveTo(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
  }
  closePath() { this.o.push("h"); }
  // Tam daire ya da elips, açı 0'dan artan yönde (Canvas arc ile aynı dolaşma yönü)
  elips(cx, cy, rx, ry, tasi = true) {
    if (tasi) this.moveTo(cx + rx, cy);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, b = a + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      this.bezierCurveTo(cx + rx * (ca - KAPPA * sa), cy + ry * (sa + KAPPA * ca), cx + rx * (cb + KAPPA * sb), cy + ry * (sb - KAPPA * cb), cx + rx * cb, cy + ry * sb);
    }
  }
  arc(x, y, r) { this.elips(x, y, r, r, false); }   // kalem.js daire(): önce moveTo(x + r, y) yapar
  rect(x, y, w, h) { this.o.push(`${f(x)} ${f(y)} ${f(w)} ${f(h)} re`); }
  toString() { return this.o.join(" "); }
}

// ---------- kalem izi (kalem.js ile aynı mantık; orada dışa açık değil) ----------

const SEYREK = 0.45, ADIM = 2, ACI_ADIM = 0.12, EN_INCE = 0.3, YON_UST = 1.08, YON_ORTA = YON_UST - 0.18, NOKTA_BASINC = 0.55;
const YAPISMA = Math.tan((3 * Math.PI) / 180);
const UC_X = Math.SQRT1_2, UC_Y = -Math.SQRT1_2;
const basincOku = (q) => (Number.isFinite(q[2]) ? sinirla(q[2], 0, 1) : 0.5);
const kalinlik = (c) => (c.w > 0 ? c.w : c.tur === "fosforlu" ? 22 : 3);

function duzUclar(p) {
  const a = p[0], b = p[p.length - 1];
  let x = b[0], y = b[1];
  const dx = x - a[0], dy = y - a[1];
  if (Math.abs(dy) <= Math.abs(dx) * YAPISMA) y = a[1];
  else if (Math.abs(dx) <= Math.abs(dy) * YAPISMA) x = a[0];
  return [a, [x, y, b[2]]];
}
const noktalar = (c) => (c.duz && c.tur !== "sekil" && c.p.length > 1 ? duzUclar(c.p) : c.p);

function seyrelt(p) {
  const X = [], Y = [], B = [], s2 = SEYREK * SEYREK, n = p.length;
  for (let i = 0; i < n; i++) {
    const q = p[i], x = q[0], y = q[1], m = X.length;
    if (m) {
      const dx = x - X[m - 1], dy = y - Y[m - 1];
      if (dx * dx + dy * dy < s2) {
        if (i === n - 1 && m > 1) { X[m - 1] = x; Y[m - 1] = y; B[m - 1] = basincOku(q); }
        continue;
      }
    }
    X.push(x); Y.push(y); B.push(basincOku(q));
  }
  return { X, Y, B, n: X.length };
}

function noktaMi(X, Y, n) {
  if (n > 4) return false;
  let x0 = X[0], x1 = X[0], y0 = Y[0], y1 = Y[0];
  for (let i = 1; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); }
  return Math.hypot(x1 - x0, y1 - y0) < 1;
}

function hamYon(X, Y, n, i) {
  const a = i > 2 ? i - 3 : 0, b = i < n - 3 ? i + 3 : n - 1;
  const dx = X[b] - X[a], dy = Y[b] - Y[a], L = Math.hypot(dx, dy);
  if (L <= 0.5) return YON_ORTA;
  const c = (dx * UC_X + dy * UC_Y) / L;
  return YON_UST - 0.36 * c * c;
}

function genislikler(c, D) {
  const { X, Y, B, n } = D, w = kalinlik(c), son = n - 1;
  const taban = noktaMi(X, Y, n) ? NOKTA_BASINC : 0;
  const F = c.tur === "dolma" && n > 1 ? Float64Array.from({ length: n }, (_, i) => hamYon(X, Y, n, i)) : null;
  const W = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = i > 1 ? i - 2 : 0, b = i > 0 ? i - 1 : 0, d = i < son ? i + 1 : son, e = i < son - 1 ? i + 2 : son;
    const bas = (B[a] + 4 * B[b] + 6 * B[i] + 4 * B[d] + B[e]) / 16;
    let g = genislik(c.tur, w, bas > taban ? bas : taban);
    if (F) g *= (F[a] + 4 * F[b] + 6 * F[i] + 4 * F[d] + F[e]) / 16;
    W[i] = g > EN_INCE ? g : EN_INCE;
  }
  return W;
}

function ornekle(D, W) {
  const { X, Y, n } = D, son = n - 1, ox = [], oy = [], or = [];
  const ekle = (x, y, r) => {
    const m = ox.length;
    if (m && Math.abs(x - ox[m - 1]) < 1e-3 && Math.abs(y - oy[m - 1]) < 1e-3) { if (r > or[m - 1]) or[m - 1] = r; return; }
    ox.push(x); oy.push(y); or.push(r);
  };
  let sx = X[0], sy = Y[0], sw = W[0];
  ekle(sx, sy, sw / 2);
  for (let j = 1; j <= son; j++) {
    if (j === son) { ekle(X[son], Y[son], W[son] / 2); break; }
    const cx = X[j], cy = Y[j], cw = W[j];
    const ex = (cx + X[j + 1]) / 2, ey = (cy + Y[j + 1]) / 2, ew = (cw + W[j + 1]) / 2;
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

function daire(yol, x, y, r) { yol.moveTo(x + r, y); yol.arc(x, y, r); yol.closePath(); }

// Kenar hattını sadeleştirir (Ramer-Douglas-Peucker): ekranda örnekleme sık, PDF'te gereksiz.
// SADE birimlik sapma A4'te ~0,04 punto; görünmez, dosya birkaç kat küçülür.
const SADE = 0.06;
function sadelestir(a) {
  const n = a.length / 2;
  if (n < 3) return a.slice();   // kopya: serit() ham diziyi hemen boşaltır
  const tut = new Uint8Array(n);
  tut[0] = tut[n - 1] = 1;
  const yigin = [0, n - 1], e2 = SADE * SADE;
  while (yigin.length) {
    const z = yigin.pop(), b = yigin.pop();
    const ax = a[b * 2], ay = a[b * 2 + 1], dx = a[z * 2] - ax, dy = a[z * 2 + 1] - ay, L2 = dx * dx + dy * dy || 1e-12;
    let en = -1, enD = e2;
    for (let i = b + 1; i < z; i++) {
      const px = a[i * 2] - ax, py = a[i * 2 + 1] - ay, c = px * dy - py * dx, d = (c * c) / L2;
      if (d > enD) { enD = d; en = i; }
    }
    if (en > 0) { tut[en] = 1; yigin.push(b, en, en, z); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (tut[i]) out.push(a[i * 2], a[i * 2 + 1]);
  return out;
}

function serit(yol, solHam, sagHam) {
  const sol = sadelestir(solHam), sag = sadelestir(sagHam);
  solHam.length = 0; sagHam.length = 0;
  if (sag.length >= 4 && sol.length >= 4) {
    yol.moveTo(sag[0], sag[1]);
    for (let k = 2; k < sag.length; k += 2) yol.lineTo(sag[k], sag[k + 1]);
    for (let k = sol.length - 2; k >= 0; k -= 2) yol.lineTo(sol[k], sol[k + 1]);
    yol.closePath();
  }
}

// Şeritler ve daireler aynı yönde: "nonzero" dolgu (PDF "f") birleşimi tek seferde boyar
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
    const mx = ax + bx, my = ay + by, ml = Math.hypot(mx, my), yc = ml / 2;
    const tanYarim = yc > 1e-6 ? Math.sqrt(Math.max(0, 1 - yc * yc)) / yc : Infinity;
    if (ax * bx + ay * by > 0.5 && r * tanYarim < 0.5 * Math.min(L[i - 1], L[i])) {
      const s = r / (ml * yc);
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

function ortaYol(c, D) {
  const yol = new Yol(), { X, Y, n } = D;
  if (n === 1) { const h = kalinlik(c) * 0.2; yol.moveTo(X[0] - h, Y[0]); yol.lineTo(X[0] + h, Y[0]); return yol; }
  yol.moveTo(X[0], Y[0]);
  for (let i = 1; i < n - 1; i++) yol.quadraticCurveTo(X[i], Y[i], (X[i] + X[i + 1]) / 2, (Y[i] + Y[i + 1]) / 2);
  yol.lineTo(X[n - 1], Y[n - 1]);
  return yol;
}

function okBasi(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 0.5) return null;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const H = Math.min(L * 0.5, 8 + w * 3), yari = H * 0.4;
  const kx = b[0] - ux * H, ky = b[1] - uy * H;
  const sol = [kx + nx * yari, ky + ny * yari], sag = [kx - nx * yari, ky - ny * yari], ic = yari * 0.12;
  return {
    sol, sag,
    sirt: [b[0] - ux * H * 0.7, b[1] - uy * H * 0.7],
    govdeSonu: [b[0] - ux * H * 0.55, b[1] - uy * H * 0.55],
    k1: [(b[0] + sol[0]) / 2 - nx * ic, (b[1] + sol[1]) / 2 - ny * ic],
    k2: [(b[0] + sag[0]) / 2 + nx * ic, (b[1] + sag[1]) / 2 + ny * ic],
  };
}

function sekilYaz(Y, c) {
  const a = c.p[0], b = c.p[c.p.length - 1], w = kalinlik(c), r = renkCoz(c.renk);
  Y.push("q", Y.gs(r.a), `${rgb(r)} RG ${rgb(r)} rg ${f(w)} w 1 J 1 j`);
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), gw = Math.abs(b[0] - a[0]), gh = Math.abs(b[1] - a[1]);
  const yol = new Yol();
  if (gw < 0.5 && gh < 0.5) { yol.elips(a[0], a[1], w / 2, w / 2); Y.push(`${yol} f Q`); return; }
  if (c.sekil === "dikdortgen") { yol.rect(x0, y0, gw, gh); Y.push(`${yol} S`); }
  else if (c.sekil === "elips") { yol.elips(x0 + gw / 2, y0 + gh / 2, gw / 2, gh / 2); yol.closePath(); Y.push(`${yol} S`); }
  else if (c.sekil === "ok") {
    const u = okBasi(a, b, w);
    if (u) {
      yol.moveTo(a[0], a[1]); yol.lineTo(u.govdeSonu[0], u.govdeSonu[1]);
      const bas = new Yol();
      bas.moveTo(b[0], b[1]);
      bas.quadraticCurveTo(u.k1[0], u.k1[1], u.sol[0], u.sol[1]);
      bas.lineTo(u.sirt[0], u.sirt[1]);
      bas.lineTo(u.sag[0], u.sag[1]);
      bas.quadraticCurveTo(u.k2[0], u.k2[1], b[0], b[1]);
      bas.closePath();
      Y.push(`${yol} S ${f(Math.min(w, 2) * 0.6)} w ${bas} B`);   // B: doldur ve çiz (sivri köşeler hafif yuvarlanır)
    }
  } else { yol.moveTo(a[0], a[1]); yol.lineTo(b[0], b[1]); Y.push(`${yol} S`); }
  Y.push("Q");
}

function cizgiYaz(Y, c) {
  if (!c || !Array.isArray(c.p) || !c.p.length) return;
  if (c.tur === "sekil") { sekilYaz(Y, c); return; }
  const D = seyrelt(noktalar(c));
  if (!D.n) return;
  const r = renkCoz(c.renk);
  if (c.tur === "fosforlu") {   // uygulamadaki gibi: %35, çarpma karışımı, alttaki yazıyı örtmez
    Y.push("q", Y.gs(0.35 * r.a, "Multiply"), `${rgb(r)} RG ${f(kalinlik(c))} w 0 J 1 j`, `${ortaYol(c, D)} S`, "Q");
    return;
  }
  // kurşun kalem: uygulamadaki %80 örtücülük + gren; PDF'te gren yerine biraz daha açık düz renk
  const yol = birlesim(ornekle(D, genislikler(c, D)), new Yol());
  Y.push("q", Y.gs((c.tur === "kursun" ? 0.72 : 1) * r.a), `${rgb(r)} rg`, `${yol} f`, "Q");
}

// ---------- yazı görüntüleri ----------

// HTML tuvali tercih edilir: toDataURL senkron kodlar. OffscreenCanvas.convertToBlob Chrome'da
// boşta dilim bekler, boyuttan bağımsız ~1 sn tutar (Kalkülüs dışa aktarımının yavaşlığı buydu).
function tuval(w, h) {
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width: w, height: h });
  return new OffscreenCanvas(w, h);
}
let olcer = null;
const olcCtx = () => (olcer ||= tuval(8, 8).getContext("2d"));

async function tuvalBaytlari(cv, tur = "image/png", kalite) {
  if (cv.toDataURL) {
    const url = cv.toDataURL(tur, kalite), ikili = atob(url.slice(url.indexOf(",") + 1));
    const b = new Uint8Array(ikili.length);
    for (let i = 0; i < ikili.length; i++) b[i] = ikili.charCodeAt(i);
    return b;
  }
  return new Uint8Array(await (await cv.convertToBlob({ type: tur, quality: kalite })).arrayBuffer());
}
const pngBaytlari = (cv) => tuvalBaytlari(cv, "image/png");

// Metni genişliğe göre satırlara böler (pre-wrap + overflow-wrap: anywhere)
function satirla(ctx, metin, maxW) {
  const out = [], olc = (s) => ctx.measureText(s).width;
  for (const para of String(metin ?? "").split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let satir = "";
    for (const parca of para.match(/\S+\s*|\s+/g) || []) {
      if (olc((satir + parca).trimEnd()) <= maxW) { satir += parca; continue; }
      if (satir.trim()) { out.push(satir.trimEnd()); satir = ""; }
      if (olc(parca.trimEnd()) <= maxW) { satir = parca; continue; }
      for (const ch of parca) {   // tek kelime sığmıyor: harf harf böl
        if (satir && olc(satir + ch) > maxW) { out.push(satir.trimEnd()); satir = ch.trim() ? ch : ""; }
        else satir += ch;
      }
    }
    out.push(satir.trimEnd());
  }
  return out;
}

// Satırın taban çizgisi: CSS satır kutusunda yazı dikey ortalanır
function tabanOfseti(ctx, satirH) {
  const m = ctx.measureText("Hgğİ");
  const a = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, d = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  return (satirH - (a + d)) / 2 + a;
}

// Satırları saydam zeminli görüntüye basar. bloklar: [{ font, renk, satirlar, satirH, harfAraligi? }]
async function yaziGorseli(Y, w, bloklar) {
  const h = bloklar.reduce((t, b) => t + b.satirlar.length * b.satirH + (b.alt || 0), 0);
  if (w <= 0 || h <= 0) return null;
  const cv = tuval(Math.ceil(w * YAZI_Z), Math.ceil(h * YAZI_Z)), ctx = cv.getContext("2d");
  ctx.scale(YAZI_Z, YAZI_Z);
  let y = 0;
  for (const b of bloklar) {
    ctx.font = b.font; ctx.fillStyle = b.renk; ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = b.harfAraligi || "0px";
    const taban = tabanOfseti(ctx, b.satirH);
    for (const s of b.satirlar) { if (s) ctx.fillText(s, 0, y + taban); y += b.satirH; }
    y += b.alt || 0;
  }
  return { ref: await Y.png(await pngBaytlari(cv)), w, h };
}

// Görüntüyü uygulama birimindeki kutuya yerleştirir (y aşağı eksen için dikey çevirme dahil)
function gorselKoy(Y, g, x, y) {
  if (g) Y.push(`q ${f(g.w)} 0 0 ${f(-g.h)} ${f(x)} ${f(y + g.h)} cm ${Y.xobje(g.ref)} Do Q`);
}

// cx, cy çevresinde döndürülmüş blok (CSS rotate gibi, derece, saat yönü)
function donuk(Y, cx, cy, aci, fn) {
  const r = ((aci || 0) * Math.PI) / 180;
  if (!r) return fn();
  const c = Math.cos(r), s = Math.sin(r);
  Y.push(`q 1 0 0 1 ${f(cx)} ${f(cy)} cm ${f3(c)} ${f3(s)} ${f3(-s)} ${f3(c)} 0 0 cm 1 0 0 1 ${f(-cx)} ${f(-cy)} cm`);
  return Promise.resolve(fn()).then(() => Y.push("Q"));
}

// ---------- nesneler: yapışkan not, metin kutusu, asistan notu, bant ----------

const ilkHarf = (s) => (s || "").trim().charAt(0).toLocaleUpperCase("tr") || "·";

async function notYaz(Y, n) {
  const zemin = renkCoz(n.renk || "#F8E7A1");
  if (n.kucuk) {   // küçültülmüş not: kare + baş harf; tam metin PDF yorumu olarak eklenir
    const k = 40;
    Y.push("q", `${rgb(zemin)} rg ${f(n.x)} ${f(n.y)} ${f(k)} ${f(k)} re f`, "Q");
    const ctx = olcCtx(); ctx.font = YAZI.el(22);
    const harf = ilkHarf(n.metin), hw = Math.max(1, ctx.measureText(harf).width);
    const g = await yaziGorseli(Y, hw + 2, [{ font: YAZI.el(22), renk: "#2A2520", satirlar: [harf], satirH: 26 }]);
    gorselKoy(Y, g, n.x + (k - hw) / 2 - 1, n.y + (k - 26) / 2);
    if (n.metin && n.metin.trim()) Y.yorum(n.x, n.y, k, k, n.metin, zemin);
    return;
  }
  const ctx = olcCtx(); ctx.font = YAZI.el(22);
  const satirH = 22 * 1.18, ic = NOT_W - 32;
  const satirlar = n.metin && n.metin.trim() ? satirla(ctx, n.metin, ic) : [];
  const h = Math.max(NOT_W, 34 + satirlar.length * satirH + 14);
  await donuk(Y, n.x + NOT_W / 2, n.y + h / 2, n.aci, async () => {
    Y.push("q", `${rgb(zemin)} rg ${f(n.x)} ${f(n.y)} ${f(NOT_W)} ${f(h)} re f`, "0 0 0 rg");
    for (let i = 0; i < 6; i++) Y.push(Y.gs(0.012 * (6 - i)), `${f(n.x)} ${f(n.y + i * 5)} ${f(NOT_W)} 5 re f`);   // tutkallı şerit, kademeli
    Y.push("Q");
    if (satirlar.length) gorselKoy(Y, await yaziGorseli(Y, ic, [{ font: YAZI.el(22), renk: "#2A2520", satirlar, satirH }]), n.x + 16, n.y + 34);
  });
}

async function metinYaz(Y, m, sinir) {
  if (!m.metin || !m.metin.trim()) return;
  // El yazısı metin (m.el, örnek defter) Caveat ile ve 1,2 satır aralığıyla, ekrandaki gibi
  const fs = m.fs || 18, yazi = m.el ? YAZI.el(fs) : YAZI.okuma(fs), ctx = olcCtx(); ctx.font = yazi;
  const maxW = Math.max(m.el ? 1 : 120, sinir - m.x);
  const satirlar = satirla(ctx, m.metin, maxW);
  const w = Math.min(maxW, Math.max(...satirlar.map((s) => ctx.measureText(s).width), 1) + 2);
  gorselKoy(Y, await yaziGorseli(Y, w, [{ font: yazi, renk: m.renk || "#1B1B1F", satirlar, satirH: fs * (m.el ? 1.2 : 1.4) }]), m.x, m.y);
}

async function asistanYaz(Y, m) {
  const w = m.w || ASISTAN_NOT_W, ic = w - 20, damga = renkCoz("#5B3F86");
  const t = new Date(m.zaman || Date.now()), iki = (n) => String(n).padStart(2, "0");
  const etiket = ["Asistan", m.kaynak, `${iki(t.getDate())}.${iki(t.getMonth() + 1)}`].filter(Boolean).join(" · ").toLocaleUpperCase("tr");
  const ctx = olcCtx(); ctx.font = YAZI.olcu(11);
  let et = etiket;
  while (et.length > 1 && ctx.measureText(et).width + et.length * 0.88 > ic) et = et.slice(0, -2) + "…";
  ctx.font = YAZI.okuma(15);
  const satirlar = satirla(ctx, String(m.metin || "").replace(/\$([^$\n]+)\$/g, "$1"), ic);
  const bloklar = [
    { font: YAZI.olcu(11), renk: "#5B3F86", satirlar: [et], satirH: 11 * 1.3, alt: 4, harfAraligi: "0.88px" },
    { font: YAZI.okuma(15), renk: "#22201D", satirlar, satirH: 15 * 1.47 },
  ];
  const g = await yaziGorseli(Y, ic, bloklar);
  const h = (g ? g.h : 0) + 16;
  Y.push("q", Y.gs(0.55), `${rgb(damga)} RG 1.5 w ${f(m.x + 0.75)} ${f(m.y)} m ${f(m.x + 0.75)} ${f(m.y + h)} l S`, "Q");
  gorselKoy(Y, g, m.x + 10, m.y + 8);
}

// Bant açık hâliyle: soluk renkli dolgu + kesikli renkli çerçeve (TASARIM 3.19 .bant.acik)
function bantYaz(Y, b) {
  const r = renkCoz(BANT_RENGI[b.desen] || BANT_RENGI.murekkep);
  return donuk(Y, b.x + b.w / 2, b.y + b.h / 2, b.aci, () => {
    Y.push("q", Y.gs(0.16), `${rgb(r)} rg ${f(b.x + 3)} ${f(b.y)} ${f(Math.max(0, b.w - 6))} ${f(b.h)} re f`, "Q");
    Y.push("q", Y.gs(0.7), `${rgb(r)} RG 1.5 w [4.5 3] 0 d ${f(b.x + 5.75)} ${f(b.y + 1.75)} ${f(Math.max(0, b.w - 11.5))} ${f(Math.max(0, b.h - 3.5))} re S`, "Q");
  });
}

// ---------- defter şablonu: sayfalar.js drawTemplate vektöre çevrilir ----------

// drawTemplate'in kullandığı Canvas alt kümesini PDF işlemlerine yazan sahte bağlam.
// fillText (Cornell başlıkları) Türkçe harf içerdiği için görüntü olarak toplanır.
function sablonBaglami(Y, yazilar) {
  let yol = new Yol();
  return {
    lineWidth: 1, strokeStyle: "#000", fillStyle: "#000", font: "10px sans-serif", textAlign: "start",
    beginPath() { yol = new Yol(); },
    moveTo(x, y) { yol.moveTo(x, y); }, lineTo(x, y) { yol.lineTo(x, y); },
    arc(x, y, r) { yol.moveTo(x + r, y); yol.arc(x, y, r); yol.closePath(); },
    rect(x, y, w, h) { yol.rect(x, y, w, h); }, closePath() { yol.closePath(); },
    stroke() { Y.push(`${rgb(renkCoz(this.strokeStyle))} RG ${f(this.lineWidth)} w ${yol} S`); },
    fill() { Y.push(`${rgb(renkCoz(this.fillStyle))} rg ${yol} f`); },
    fillRect(x, y, w, h) { Y.push(`${rgb(renkCoz(this.fillStyle))} rg ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`); },
    fillText(t, x, y) { yazilar.push({ t: String(t), x, y, font: this.font, renk: this.fillStyle }); },
    measureText(t) { const c = olcCtx(); c.font = this.font; return c.measureText(t); },
    save() {}, restore() {}, setLineDash() {},
  };
}

async function sablonYaz(Y, kagit) {
  const yazilar = [];
  Y.push("q 1 J 0 j");
  try { drawTemplate(sablonBaglami(Y, yazilar), kagit); } catch (e) { console.warn(e); }
  Y.push("Q");
  for (const y of yazilar) {
    const ctx = olcCtx(); ctx.font = y.font;
    const m = ctx.measureText(y.t), a = m.fontBoundingBoxAscent ?? 12, d = m.fontBoundingBoxDescent ?? 4;
    const g = await yaziGorseli(Y, m.width + 2, [{ font: y.font, renk: y.renk, satirlar: [y.t], satirH: a + d }]);
    gorselKoy(Y, g, y.x, y.y - a - (g ? (g.h - a - d) / 2 : 0));
  }
}

// Örnek PDF sayfası (sayfalar.js çizimi): yüksek çözünürlüklü görüntü
// Zemin opak olduğu için JPEG: embedPng'nin JS içinde açıp yeniden sıkıştırması (sayfa başına ~350 ms) kalkar.
// Baytlar sayfa numarasına göre modülde saklanır, sonraki dışa aktarımlar yeniden çizmez.
// Her örnek belgenin kendi sayfa listesi var (sayfalar.js ornekSayfalari): anahtar belge ve sıra numarası.
const ornekBayt = new Map(), ornekRef = new WeakMap();
const ornekListe = (belgeId) => (typeof SAYFALAR.ornekSayfalari === "function" && SAYFALAR.ornekSayfalari(belgeId)) || PDF_PAGES;
async function ornekSayfaYaz(Y, no, belgeId) {
  const sayfa = ornekListe(belgeId)[no];
  if (!sayfa) return;
  const anahtar = `${belgeId || ""}|${no}`;
  let b = ornekBayt.get(anahtar);
  if (!b) {
    const cv = tuval(Math.round(PW * SAYFA_Z), Math.round(PH * SAYFA_Z)), ctx = cv.getContext("2d");
    ctx.scale(SAYFA_Z, SAYFA_Z);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, PW, PH);
    try { sayfa.draw(ctx); } catch (e) { console.warn(e); }
    b = await tuvalBaytlari(cv, "image/jpeg", 0.9);
    cv.width = cv.height = 0;   // 22 MB'lık piksel tamponu hemen bırakılsın
    if (ornekBayt.size >= 8) ornekBayt.delete(ornekBayt.keys().next().value);
    ornekBayt.set(anahtar, b);
  }
  // aynı örnek sayfa belgede birden çok geçerse tek nesne gömülür
  let refler = ornekRef.get(Y.doc);
  if (!refler) ornekRef.set(Y.doc, (refler = new Map()));
  if (!refler.has(anahtar)) refler.set(anahtar, Y.doc.embedJpg(b).then((g) => g.ref));
  gorselKoy(Y, { ref: await refler.get(anahtar), w: PW, h: PH }, 0, 0);
}

// Masa görseli (sayfa.gorseller): ek dosyadan ya da yedek dataURL'den, belge başına bir kez gömülür.
// Çoğaltılan sayfalar aynı dosyayı paylaşır (ad aynı), PDF'te de tek nesne olur.
async function gorselBaytlari(g, belgeId) {
  if (g.ad && belgeId) {
    const { ekDosyaGetir } = await import("./kayit.js");
    const blob = await ekDosyaGetir(belgeId, g.ad);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
  }
  if (g.src) return new Uint8Array(await (await fetch(g.src)).arrayBuffer());
  return null;
}
async function gorselYaz(Y, g, ortak) {
  if (!(g.w > 0 && g.h > 0)) return;
  const anahtar = g.ad || g.src || g.id;
  let soz = ortak.gorsel.get(anahtar);
  if (!soz) {
    soz = (async () => {
      const b = await gorselBaytlari(g, ortak.belgeId);
      if (!b) return null;
      const png = b[0] === 0x89 && b[1] === 0x50;   // tür alanı yerine dosyanın imzası
      return (png ? await Y.doc.embedPng(b) : await Y.doc.embedJpg(b)).ref;
    })().catch((hata) => { console.warn("[disa-aktar] görsel gömülemedi:", g.ad || g.id, hata); return null; });
    ortak.gorsel.set(anahtar, soz);
  }
  const ref = await soz;
  if (ref) gorselKoy(Y, { ref, w: g.w, h: g.h }, g.x, g.y);
}

// ---------- sayfa yazıcı: tek içerik akışı, kaynak adları, önbellek ----------

function yaziciKur(doc, page, ortak) {
  const ops = [], gsAd = new Map(), xAd = new Map();
  const Y = {
    M: null,
    doc,
    push: (...a) => { for (const x of a) if (x) ops.push(x); },
    // Saydamlık / karışım durumu (ExtGState), belge başına bir kez kaydedilir
    gs(a = 1, bm = "Normal") {
      a = Math.round(sinirla(a, 0, 1) * 1000) / 1000;
      if (a === 1 && bm === "Normal") return "";
      const anahtar = a + "|" + bm;
      let ref = ortak.gs.get(anahtar);
      if (!ref) ortak.gs.set(anahtar, (ref = doc.context.register(doc.context.obj({ Type: "ExtGState", ca: a, CA: a, BM: bm }))));
      if (!gsAd.has(anahtar)) gsAd.set(anahtar, page.node.newExtGState("GS", ref));
      return `${gsAd.get(anahtar)} gs`;
    },
    async png(bayt) { return (await doc.embedPng(bayt)).ref; },
    xobje(ref) {
      if (!xAd.has(ref)) xAd.set(ref, page.node.newXObject("Im", ref));
      return String(xAd.get(ref));
    },
    // Küçültülmüş not için PDF yorumu (metin Unicode, yazı tipi gerekmez)
    yorum(x, y, w, h, metin, renk) {
      const a = noktaPdf(Y.M, x, y), b = noktaPdf(Y.M, x + w, y + h);
      const annot = doc.context.obj({
        Type: "Annot", Subtype: "Text", Name: "Comment", F: 4, Open: false,
        Rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])],
        Contents: PDFHexString.fromText(metin), T: PDFHexString.fromText("Kenar Notu"), C: [renk.r, renk.g, renk.b],
      });
      page.node.addAnnot(doc.context.register(annot));
    },
    bitir() {
      if (!ops.length) return;
      page.node.addContentStream(doc.context.register(doc.context.flateStream(ops.join("\n"))));
    },
  };
  return Y;
}

// Görünen kutu pdf.js'teki gibi CropBox ile MediaBox'ın kesişimi (ters yazılmış kutular düzeltilir)
function gorunurKutu(page) {
  const duz = ({ x, y, width: w, height: h }) => [Math.min(x, x + w), Math.min(y, y + h), Math.max(x, x + w), Math.max(y, y + h)];
  const m = duz(page.getMediaBox()), c = duz(page.getCropBox());
  const x0 = Math.max(m[0], c[0]), y0 = Math.max(m[1], c[1]), x1 = Math.min(m[2], c[2]), y1 = Math.min(m[3], c[3]);
  const [a0, b0, a1, b1] = x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : m;
  return { x: a0, y: b0, width: a1 - a0, height: b1 - b0 };
}

// Uygulama birimi -> PDF puntosu. kutu: sayfanın görünen kutusu (gorunurKutu), aci: /Rotate.
// Döndürülmüş sayfada uygulamanın "görünen" sayfası esas alınır (pdf.js viewport ile aynı).
function matris(kutu, aci, s) {
  const { x, y, width: w, height: h } = kutu;
  switch (((aci % 360) + 360) % 360) {
    case 90: return [0, s, s, 0, x, y];
    case 180: return [-s, 0, 0, s, x + w, y];
    case 270: return [0, -s, -s, 0, x + w, y + h];
    default: return [s, 0, 0, -s, x, y + h];
  }
}
const noktaPdf = (M, u, v) => [M[0] * u + M[2] * v + M[4], M[1] * u + M[3] * v + M[5]];

const kenardaIcerik = (v) =>
  (v.cizgiler || []).some((c) => c.p?.some((q) => q[0] > PW + 2)) || (v.notlar || []).some((n) => n.x > PW - 40) ||
  (v.metinler || []).some((m) => m.x > PW - 20) || (v.bantlar || []).some((b) => b.x + b.w > PW + 20) ||
  (v.gorseller || []).some((g) => g.x + g.w > PW + 20);

// Sayfanın notlarını (ve gerekirse arka planını) yazar. arka: async (Y) => {} sayfa zemini.
async function sayfaYaz(doc, page, v, { s, hBirim, ortak, arka }) {
  const kutu = gorunurKutu(page), aci = page.getRotation().angle || 0;
  const M = matris(kutu, aci, s);
  const genis = !!(v.kenar || kenardaIcerik(v));
  if (genis) {   // kenar alanı sayfanın sağına eklenir (görünen yönde)
    const k = [[0, 0], [TW, 0], [0, hBirim], [TW, hBirim]].map(([u, w]) => noktaPdf(M, u, w));
    const xs = k.map((p) => p[0]), ys = k.map((p) => p[1]);
    const bx0 = Math.min(kutu.x, ...xs), by0 = Math.min(kutu.y, ...ys), bx1 = Math.max(kutu.x + kutu.width, ...xs), by1 = Math.max(kutu.y + kutu.height, ...ys);
    const mb = page.getMediaBox();
    page.setMediaBox(Math.min(mb.x, bx0), Math.min(mb.y, by0), Math.max(mb.x + mb.width, bx1) - Math.min(mb.x, bx0), Math.max(mb.y + mb.height, by1) - Math.min(mb.y, by0));
    page.setCropBox(bx0, by0, bx1 - bx0, by1 - by0);
  }
  page.node.normalize();   // var olan içerik q/Q ile sarılır: grafik durumu bize temiz gelir
  const Y = yaziciKur(doc, page, ortak);
  Y.M = M;
  Y.push(`q ${M.map(f3).join(" ")} cm`);
  if (arka) await arka(Y);
  if (genis) {
    Y.push(`1 1 1 rg ${f(PW)} 0 ${f(KW)} ${f(hBirim)} re f`);
    Y.push(`0.86 0.84 0.8 RG 0.75 w ${f(PW)} 0 m ${f(PW)} ${f(hBirim)} l S`);
  }
  for (const g of v.gorseller || []) await gorselYaz(Y, g, ortak);   // uygulamadaki gibi mürekkebin altında
  for (const c of v.cizgiler || []) cizgiYaz(Y, c);
  const sinir = v.kenar ? TW : PW;   // metin kutusunun en geniş hâli, uygulamadaki gibi
  for (const m of v.metinler || []) await (m.tur === "asistan" ? asistanYaz(Y, m) : metinYaz(Y, m, sinir));
  for (const b of v.bantlar || []) await bantYaz(Y, b);
  for (const n of v.notlar || []) await notYaz(Y, n);
  Y.push("Q");
  Y.bitir();
}

// ---------- yazı tipleri ----------

async function yaziTipleriHazir(sayfalar) {
  if (typeof document === "undefined" || !document.fonts) return;
  // Örnek sayfaların dizgisi (Literata, Inter): sayfalar.js modül yüklenirken ister, burada beklenir
  const ornek = sayfalar.some((s) => s.tur === "pdf") ? Promise.resolve(SAYFALAR.yaziTipleri) : null;
  const metin = (dizi, al) => dizi.map(al).join(" ").slice(0, 4000) || "a";
  const notlar = metin([...sayfalar.flatMap((s) => s.notlar || []), ...sayfalar.flatMap((s) => (s.metinler || []).filter((m) => m.el))], (n) => n.metin || "");
  const metinler = metin(sayfalar.flatMap((s) => s.metinler || []), (m) => m.metin || "");
  const istekler = ornek ? [ornek] : [];
  if (notlar.trim()) istekler.push(document.fonts.load(YAZI.el(22), notlar));
  if (metinler.trim()) istekler.push(document.fonts.load(YAZI.okuma(18), metinler), document.fonts.load(YAZI.olcu(11), "ASİSTAN ·0123456789"));
  try { await Promise.race([Promise.all(istekler), new Promise((r) => setTimeout(r, 3000))]); } catch { /* yerel yedek yazı tipi kullanılır */ }
}

// ---------- notlu PDF ----------

const bosSayfa = (o) => ({ cizgiler: [], notlar: [], metinler: [], bantlar: [], ...o });

// Sayfanın kaynak PDF'teki sırası (0'dan). duzenleyici.js gerçek PDF'te sayfayı { tur: "pdf", pdf: i } tutar;
// başka adla tutulursa da bulunur, yoksa araya eklenmiş defter sayfaları atlanarak sıradan çıkarılır.
function kaynakNo(s, j, sayfalar) {
  for (const a of ["pdf", "kaynak", "no", "i"]) if (Number.isInteger(s[a])) return s[a];
  return j - sayfalar.slice(0, j).filter((x) => x.tur === "kagit").length;
}

// sayfalar: belge.veri.sayfalar sıra numaraları (0'dan), ör. "Bu sayfa" için [i]. Yoksa bütün sayfalar.
export async function pdfDisaAktar(belge, { sayfalar } = {}) {
  const veri = belge?.veri && Array.isArray(belge.veri.sayfalar) ? belge.veri : null;
  let kaynak = null;
  if (belge?.dosya) {
    const { dosyaGetir } = await import("./kayit.js");
    const blob = await dosyaGetir(belge.id);
    if (!blob) throw new Error("Belgenin dosyası bulunamadı");
    kaynak = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  }

  // Sayfa listesi: veri yoksa (belge hiç açılmamış) dosyanın ya da şablonun çıplak sayfaları
  const tum = veri ? veri.sayfalar
    : kaynak ? kaynak.getPages().map((_, i) => bosSayfa({ tur: "pdf", pdf: i }))
    : belge?.tur === "defter" ? Array.from({ length: Math.max(1, belge.sayfaSayisi || 3) }, () => bosSayfa({ tur: "kagit", kagit: belge.kagit || "lined" }))
    : ornekListe(belge?.id).map((_, i) => bosSayfa({ tur: "pdf", pdf: i }));
  const secim = (Array.isArray(sayfalar) ? sayfalar : Number.isInteger(sayfalar) ? [sayfalar] : tum.map((_, i) => i))
    .filter((i) => Number.isInteger(i) && i >= 0 && i < tum.length);
  if (!secim.length) throw new Error("Dışa aktarılacak sayfa yok");
  await yaziTipleriHazir(secim.map((i) => tum[i]));

  const ortak = { gs: new Map(), gorsel: new Map(), belgeId: belge?.id };
  let doc;
  if (kaynak) {
    const n = kaynak.getPageCount();
    const nolar = secim.map((i) => (tum[i].tur === "kagit" ? -1 : sinirla(kaynakNo(tum[i], i, tum), 0, n - 1)));
    // Bütün sayfalar sırasıyla ve araya defter sayfası yoksa orijinal belge yerinde işlenir
    // (yer imleri, bağlantılar, form alanları korunur); değilse sayfalar yeni belgeye kopyalanır.
    const ayni = secim.length === n && nolar.every((k, i) => k === i);
    doc = ayni ? kaynak : await PDFDocument.create();
    const kopyalar = ayni ? kaynak.getPages() : await doc.copyPages(kaynak, nolar.map((k) => (k < 0 ? 0 : k)));
    let sonW = A4_W;
    for (let j = 0; j < secim.length; j++) {
      const v = tum[secim[j]];
      if (nolar[j] < 0) {   // PDF'e eklenmiş defter sayfası: komşu sayfanın genişliğinde
        const page = ayni ? null : doc.addPage([sonW, (sonW * PH) / PW]);
        if (page) await sayfaYaz(doc, page, v, { s: sonW / PW, hBirim: PH, ortak, arka: (Y) => sablonYaz(Y, v.kagit) });
        continue;
      }
      const page = ayni ? kopyalar[j] : doc.addPage(kopyalar[j]);
      const k = gorunurKutu(page), a = ((page.getRotation().angle % 360) + 360) % 360;
      const gw = a === 90 || a === 270 ? k.height : k.width, gh = a === 90 || a === 270 ? k.width : k.height;
      sonW = gw;
      await sayfaYaz(doc, page, v, { s: gw / PW, hBirim: (gh * PW) / gw, ortak });
    }
  } else {
    doc = await PDFDocument.create();
    const s = A4_W / PW, H = PH * s;
    for (const i of secim) {
      const v = tum[i];
      const page = doc.addPage([A4_W, H]);
      const arka = v.tur === "pdf" ? (Y) => ornekSayfaYaz(Y, v.pdf || 0, belge?.id) : (Y) => sablonYaz(Y, v.kagit || "blank");
      await sayfaYaz(doc, page, v, { s, hBirim: PH, ortak, arka });
    }
  }
  if (doc !== kaynak) {
    doc.setTitle(belge?.ad || "Kenar Notu");
    doc.setLanguage("tr-TR");
  }
  doc.setCreator("Kenar Notu");
  doc.setModificationDate(new Date());
  const bayt = await doc.save({ useObjectStreams: true });
  return new Blob([bayt], { type: "application/pdf" });
}

// Samsung Notes'a giden yolun dosya adı: belge adı + " (notlu).pdf"
export const notluPdfAdi = (belge) => `${belge?.ad || "Belge"} (notlu).pdf`;
export const notlarMdAdi = (belge) => `${belge?.ad || "Kitap"} (notlar).md`;

// ---------- paylaş ya da indir ----------

const guvenliAd = (ad) => String(ad || "Kenar Notu").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || "Kenar Notu";
const turBul = (ad) => (/\.pdf$/i.test(ad) ? "application/pdf" : /\.md$/i.test(ad) ? "text/markdown" : /\.kenar$/i.test(ad) ? "application/zip" : "application/octet-stream");

function indir(blob, ad) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: ad, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "indirildi";
}

// navigator.canShare({ files }) varsa paylaş menüsü (Samsung Notes burada), yoksa indirir.
// Döner: "paylasildi" | "iptal" | "indirildi" | "bekliyor" (dokunuş süresi doldu, bildirimdeki Paylaş ile sürer)
export async function paylas(blob, dosyaAdi) {
  const ad = guvenliAd(dosyaAdi);
  const dosya = new File([blob], ad, { type: blob.type || turBul(ad) });
  const veri = { files: [dosya], title: ad.replace(/\.[^.]+$/, "") };
  let olur = false;
  try { olur = !!navigator.canShare?.({ files: [dosya] }); } catch { olur = false; }
  if (!olur) return indir(dosya, ad);
  try {
    await navigator.share(veri);
    return "paylasildi";
  } catch (e) {
    if (e?.name === "AbortError") return "iptal";
    // Uzun hazırlıktan sonra tarayıcı paylaşımı dokunuşsuz saymaz: bildirimdeki düğme yeni dokunuş sağlar
    if (e?.name === "NotAllowedError") {
      toast("Dosya hazır", { etiket: "Paylaş", calistir: () => navigator.share(veri).catch((h) => { if (h?.name !== "AbortError") indir(dosya, ad); }) });
      return "bekliyor";
    }
    return indir(dosya, ad);
  }
}

// ---------- EPUB vurguları ve notları: Markdown ----------

const VURGU_ADI = { limon: "Limon", pembe: "Pembe", nane: "Nane", gok: "Gök" };
const SIRA = ["Birinci", "İkinci", "Üçüncü", "Dördüncü", "Beşinci", "Altıncı", "Yedinci", "Sekizinci", "Dokuzuncu", "Onuncu"];
const SAYFADA = 250;   // okuma.js sanal sayfası
const kelimeSay = (s) => (String(s).match(/\S+/g) || []).length;
const alinti = (s) => String(s).trim().split("\n").map((x) => "> " + x.trim()).join("\n");
const tarihYaz = (t) => new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

// Paragraf modeli okuma.js ile aynı: sahne ayraçları ("***") sayılmaz, p = paragraf sırası
// Gerçek EPUB'da paragraf okuyucudaki gibi bicimCoz ile düz metne çözülür: vurgu ofsetleri ona göredir.
// Boş paragraflar ve paragrafsız bölümler okuma.js modeliKur'daki gibi atlanır.
async function kitapModeli(belge) {
  let kitap = null, kapat = () => {}, coz = (ham) => ham;
  if (belge?.dosya) {
    const [{ dosyaGetir }, { epubAc, bicimCoz, epubSurumu }] = await Promise.all([import("./kayit.js"), import("./epub-belge.js")]);
    const blob = await dosyaGetir(belge.id);
    if (!blob) throw new Error("Kitabın dosyası bulunamadı");
    // Vurgu ofsetleri kitabın ilk açıldığı çözümleyici sürümüne göredir
    kitap = await epubAc(blob, { surum: epubSurumu(belge), kapak: false });
    coz = (ham) => bicimCoz(ham).metin;
    kapat = () => kitap.gorseller?.forEach?.((u) => URL.revokeObjectURL(u));
  } else kitap = (await import("./okuma-metni.js")).default;
  const P = [], bolumler = [];
  let toplam = 0;
  for (const b of kitap.bolumler || []) {
    const bi = bolumler.length, ilk = P.length;
    for (const ham of b.paragraflar || []) {
      if (ham === "***") continue;
      const metin = coz(String(ham));
      if (!metin.trim()) continue;
      P.push({ b: bi, metin, onceki: toplam });
      toplam += kelimeSay(metin);
    }
    if (P.length > ilk) bolumler.push({ ad: `${SIRA[bi] || bi + 1 + "."} Bölüm`, baslik: b.baslik || "" });
  }
  kapat();
  // Kitaplıktaki ad önce gelir (prototipte örnek EPUB'ların hepsi aynı metni gösterir)
  return { baslik: belge?.ad || kitap.baslik || "Kitap", yazar: belge?.yazar || kitap.yazar || "", P, bolumler };
}

// Vurgulanan metin: paragraf sınırlarını geçebilir (P düz metindir, işaretleme yok)
function vurguMetni(P, v) {
  const parca = [];
  for (let p = v.bas.p; p <= v.son.p && p < P.length; p++) {
    const m = P[p].metin, a = p === v.bas.p ? v.bas.o : 0, z = p === v.son.p ? v.son.o : m.length;
    parca.push(m.slice(Math.max(0, a), Math.max(0, z)).trim());
  }
  return parca.filter(Boolean).join("\n\n");
}

export async function epubNotlariDisaAktar(belge) {
  const { baslik, yazar, P, bolumler } = await kitapModeli(belge);
  const veri = belge?.veri || {};
  const ogeler = [];
  for (const v of veri.vurgular || []) {
    if (!v?.bas || !v?.son || !P[v.bas.p]) continue;
    ogeler.push({ p: v.bas.p, o: v.bas.o || 0, tur: "vurgu", v });
  }
  for (const n of veri.asistanNotlari || []) {
    // Kitap kapalıyken düşen notun paragrafı yalnız sayfasıyla bilinir
    const p = P[n.p] ? n.p : n.sayfa ? Math.max(0, P.findIndex((x) => x.onceki + kelimeSay(x.metin) > (n.sayfa - 1) * SAYFADA)) : -1;
    if (P[p]) ogeler.push({ p, o: Infinity, tur: "asistan", n });
  }
  // Active Canvas: el yazısı boşluğu görüntü olarak aktarılmaz, yerinde bir satırla anılır
  for (const t of veri.tuvaller || []) {
    if (!t?.cizgiler?.length || !P[t.p]) continue;
    ogeler.push({ p: t.p, o: (Number(t.oran) || 0) * P[t.p].metin.length, tur: "tuval" });
  }
  ogeler.sort((a, b) => a.p - b.p || a.o - b.o);

  const vurguSay = ogeler.filter((x) => x.tur === "vurgu").length;
  const notSay = ogeler.filter((x) => (x.tur === "vurgu" && x.v.not?.trim()) || x.tur === "asistan").length;
  const elSay = ogeler.filter((x) => x.tur === "tuval").length;
  const satir = [`# ${baslik}`];
  if (yazar) satir.push("", yazar);
  satir.push("", `Kenar Notu, ${tarihYaz(Date.now())}. ${vurguSay} vurgu, ${notSay} not${elSay ? `, ${elSay} el yazısı` : ""}.`);
  if (!ogeler.length) satir.push("", "Bu kitapta henüz vurgu ya da not yok.");

  let bolum = -1;
  for (const x of ogeler) {
    const p = P[x.p], sayfa = Math.floor(p.onceki / SAYFADA) + 1;
    if (p.b !== bolum) {
      bolum = p.b;
      const b = bolumler[bolum];
      satir.push("", `## ${b.ad}${b.baslik ? ": " + b.baslik : ""}`);
    }
    if (x.tur === "vurgu") {
      const metin = String(x.v.metin || "").trim() || vurguMetni(P, x.v);   // okuma.js dışa aktarmadan önce v.metin yazar
      if (!metin) continue;
      satir.push("", alinti(metin));
      if (x.v.not?.trim()) satir.push("", `Not: ${x.v.not.trim()}`);
      satir.push("", `*${VURGU_ADI[x.v.renk] || "Vurgu"} · s. ${sayfa}*`);
    } else if (x.tur === "tuval") {
      satir.push("", "(el yazısı not)", "", `*s. ${sayfa}*`);
    } else {
      const bas = p.metin.length > 140 ? p.metin.slice(0, 140).replace(/\s+\S*$/, "") + "…" : p.metin;
      satir.push("", alinti(bas), "", `Asistan${x.n.kaynak ? " (" + x.n.kaynak + ")" : ""}: ${String(x.n.metin || "").trim()}`, "", `*s. ${sayfa}*`);
    }
  }
  const kalem = (veri.cizgiler || []).length;
  if (kalem) satir.push("", "---", "", `Kalemle yapılan ${kalem} çizim bu metne aktarılmadı.`);
  return new Blob([satir.join("\n") + "\n"], { type: "text/markdown;charset=utf-8" });
}
