// Prototip sayfa içerikleri.
// Gerçek uygulamada PDF sayfalarını PDF.js çizecek; burada aynı işi elle yapıyoruz ki
// arayüz gerçek bir ders kitabı sayfası üstünde denenebilsin.
// Tüm ölçüler "sayfa birimi": sayfa genişliği 800 birim, yüksekliği 1131 (A4 oranı).
//
// Dizgi: başlık ve gövde Literata. Formüller küçük bir dizgi motoruyla kurulur (değişken italik,
// rakam ve işleç dik, kesir üst üste). Görünen parçalar kaydedilmeden çizilir; her satır için bir kez
// saydam "kayıt" metni yazılır. fillText'i dinleyen modüller (arama, tanıtım süsleri, Tekrar kesitleri)
// böylece parça parça değil, satırın tamamını gerçek konumu ve genişliğiyle görür.

export const PW = 800;
export const PH = 1131;

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, "Segoe UI", Roboto, sans-serif';
const C = {
  ink: "#1f252d", muted: "#5f6b78", accent: "#2f5d8a", rule: "#d5dbe2", box: "#f2f5f8",
  red: "#b5452f", bordo: "#8a2433", kemik: "#f5efe2", kas: "rgba(158, 59, 74, .16)", kasCizgi: "#9e3b4a",
};

function font(ctx, size, { weight = 400, italic = false, family = SERIF } = {}) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
}

// ---------- yazı tipleri ----------

// TASARIM-3: başlık da Literata (tek kitap sesi), etiket Inter
const AILE = { baslik: "Literata, Georgia, serif", govde: "Literata, Georgia, serif", etiket: '"Inter", system-ui, sans-serif' };
const yazi = (boy, { aile = "govde", w = 400, i = false } = {}) => `${i ? "italic " : ""}${w} ${boy}px ${AILE[aile]}`;

// Sayfalar eşzamanlı çizilir; yazı tipleri modül yüklenirken istenir. Çizen taraf ilk çizimden önce
// yaziTipleri'ni bekleyebilir. Yüklenemezse font yığını kendiliğinden Georgia'ya düşer.
const ORNEK = "AaÇçĞğİıÖöŞşÜü 0123456789 ′−·∘√";
export const yaziTipleri = (() => {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve(false);
  const iste = () => Promise.all([yazi(30, { aile: "baslik", w: 600 }), yazi(17), yazi(17, { i: true }), yazi(17, { w: 600 }), yazi(11, { aile: "etiket", w: 600 })]
    .map((f) => document.fonts.load(f, ORNEK).catch(() => [])));
  // Yazı tipi tablosu henüz gelmediyse (boş sonuç) sayfa yüklenince bir kez daha istenir
  return iste()
    .then((r) => (r.every((x) => x.length) || document.readyState === "complete" ? r
      : new Promise((ok) => addEventListener("load", ok, { once: true })).then(iste)))
    .then((r) => r.every((x) => x.length), () => false);
})();

// Görünen parça: tuvalin kendi fillText'i, örnek üstüne konmuş dinleyiciler atlanır
function ham(ctx, t, x, y) {
  (Object.getPrototypeOf(ctx)?.fillText || ctx.fillText).call(ctx, t, x, y);
}
// Kayıt metni: saydam, verilen genişliğe yazı boyutuyla oturtulur (dinleyici measureText ile ölçer)
function kaydet(ctx, t, x, y, gen, boy, { aile = "govde", w = 400 } = {}) {
  // Dinleyici örneğin kendi fillText'idir; yoksa (görünen tuval) saydam yazı boşa ölçülüp çizilmez
  if (!Object.prototype.hasOwnProperty.call(ctx, "fillText")) return;
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = yazi(boy, { aile, w });
  const m = t ? ctx.measureText(t).width : 0;
  if (m > 0 && gen > 0) ctx.font = yazi(+(boy * gen / m).toFixed(2), { aile, w });
  ctx.fillStyle = "rgba(0, 0, 0, 0)";
  ctx.fillText(t, x, y);
  ctx.restore();
}

// ---------- formül dizgisi ----------
// Kaynak: x^{2}, A_{y}, \f{pay}{payda}, \r{kök}, \p{büyük parantez}, \t{dik metin}, boşluk \, \; \q \Q.
// Boşluklar yok sayılır; harfler italik, sayı ve işleçler dik, sin/cos/ln dik.

const FONK = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "ln", "log", "exp", "lim"]);
const ILISKI = "=<>≤≥≈≠⟹⟺⇒→";
const IKILI = "+−·×∘±";
const DIK_YUNAN = "ΣΔΠΩΓΘΛΦΨ";

function mCoz(src) {
  let i = 0;
  const grup = () => {
    if (src[i] === "{") { i++; const r = dizi("}"); i++; return r; }
    return mCoz(src[i++] ?? "");
  };
  const duz = () => {
    if (src[i] !== "{") return src[i++] ?? "";
    const j = src.indexOf("}", i), s = src.slice(i + 1, j);
    i = j + 1;
    return s;
  };
  function dizi(son) {
    const out = [];
    const ekle = (t, s) => {
      // Başta, ilişkiden, işlemden, açılan parantezden ya da virgülden sonra gelen işaret tekli (−x)
      if (t === "islem" && (!out.length || ["iliski", "islem", "tekli", "ac", "nokta"].includes(out[out.length - 1].t))) t = "tekli";
      out.push({ t, s });
    };
    while (i < src.length && src[i] !== son) {
      const c = src[i];
      if (c === " ") { i++; continue; }
      if (c === "\\") {
        const k = src[i + 1];
        i += 2;
        if (k === "f") { const a = grup(), b = grup(); out.push({ t: "kesir", a, b }); }
        else if (k === "r") out.push({ t: "kok", a: grup() });
        else if (k === "p") out.push({ t: "par", a: grup() });
        else if (k === "t") out.push({ t: "dik", s: duz() });
        else out.push({ t: "bos", em: { ",": 0.17, ";": 0.28, q: 1, Q: 2 }[k] ?? 0.17 });
        continue;
      }
      if (c === "^" || c === "_") { i++; out.push({ t: c === "^" ? "ust" : "alt", a: grup() }); continue; }
      if (DIK_YUNAN.includes(c)) { i++; out.push({ t: "dik", s: c }); continue; }
      if (/\p{L}/u.test(c)) {
        let j = i;
        while (j < src.length && /\p{L}/u.test(src[j]) && !DIK_YUNAN.includes(src[j])) j++;
        const s = src.slice(i, j);
        i = j;
        out.push({ t: FONK.has(s) ? "fonk" : "harf", s });
        continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i + 1;
        while (j < src.length && (/[0-9]/.test(src[j]) || (",.".includes(src[j]) && /[0-9]/.test(src[j + 1] || "")))) j++;
        out.push({ t: "sayi", s: src.slice(i, j) });
        i = j;
        continue;
      }
      i++;
      ekle(ILISKI.includes(c) ? "iliski" : IKILI.includes(c) ? "islem" : "([".includes(c) ? "ac" : ")]".includes(c) ? "kapa"
        : c === "′" ? "us" : ",;:".includes(c) ? "nokta" : "sembol", c);
    }
    return out;
  }
  return dizi(undefined);
}

const bosKutu = (w) => ({ w, a: 0, d: 0, ciz() {} });
// egikBuyuk: Literata'nın italik büyük harfleri neredeyse dik; formülde V, M, F dikten ayrılsın diye eğilir
function kosu(ctx, s, f, boy, egikBuyuk = false) {
  ctx.font = f;
  const m = ctx.measureText(s);
  if (!egikBuyuk || !/\p{Lu}/u.test(s)) {
    return { w: m.width, a: m.actualBoundingBoxAscent ?? boy * 0.7, d: m.actualBoundingBoxDescent ?? 0,
      ciz(c, x, y) { c.font = f; ham(c, s, x, y); } };
  }
  let ox = 0;
  const parca = s.match(/\p{Lu}+|[^\p{Lu}]+/gu).map((p) => { const o = { p, x: ox, buyuk: /\p{Lu}/u.test(p) }; ox += ctx.measureText(p).width; return o; });
  const son = parca[parca.length - 1].buyuk ? boy * 0.04 : 0;
  return { w: m.width + son, a: m.actualBoundingBoxAscent ?? boy * 0.7, d: m.actualBoundingBoxDescent ?? 0,
    ciz(c, x, y) {
      c.font = f;
      for (const o of parca) {
        if (!o.buyuk) { ham(c, o.p, x + o.x, y); continue; }
        c.save();
        c.translate(x + o.x, y);
        c.transform(1, 0, -0.2, 1, 0, 0);
        ham(c, o.p, 0, 0);
        c.restore();
      }
    } };
}
// Kesir çizgisi ve eksi işareti aynı yükseklikte: ekseni "+" glifinden ölç
function eksen(ctx, boy) {
  ctx.font = yazi(boy);
  const m = ctx.measureText("+");
  const e = ((m.actualBoundingBoxAscent ?? 0) - (m.actualBoundingBoxDescent ?? 0)) / 2;
  return e > 0 ? e : boy * 0.26;
}

function mDiz(ctx, liste, boy) {
  const R = yazi(boy), I = yazi(boy, { i: true });
  const og = [];
  for (const n of liste) {
    if (n.t === "ust" || n.t === "alt") {
      const taban = og.pop() || { t: "bos", k: bosKutu(0), sol: 0, sag: 0 };
      og.push({ ...taban, t: taban.t === "fonk" ? "fonk" : "betik", k: betik(ctx, taban, n, boy) });
      continue;
    }
    const o = { t: n.t, s: n.s, sol: 0, sag: 0 };
    o.k = n.t === "harf" ? kosu(ctx, n.s, I, boy, true)
      : n.t === "kesir" ? kesir(ctx, n, boy)
      : n.t === "kok" ? kok(ctx, n, boy)
      : n.t === "par" ? parantez(ctx, n, boy)
      : n.t === "bos" ? bosKutu(n.em * boy)
      : kosu(ctx, n.s, R, boy);
    if (n.t === "iliski") o.sol = o.sag = 0.27 * boy;
    if (n.t === "islem") o.sol = o.sag = (n.s === "·" ? 0.17 : 0.22) * boy;
    if (n.t === "nokta") o.sag = 0.17 * boy;
    og.push(o);
  }
  let x = 0, a = 0, d = 0;
  const yer = og.map((o, j) => {
    const p = og[j - 1];
    if (p) x += Math.max(p.sag, o.sol) + aralik(p, o, boy);
    const bu = x;
    x += o.k.w;
    a = Math.max(a, o.k.a);
    d = Math.max(d, o.k.d);
    return bu;
  });
  return { w: x, a, d, ciz(c, x0, y, satir) { og.forEach((o, j) => o.k.ciz(c, x0 + yer[j], y, satir)); } };
}
function aralik(p, o, boy) {
  if (p.t === "harf" && o.t === "us") return (/[f\p{Lu}]$/u.test(p.s) ? 0.08 : 0.015) * boy;   // f′, F′: italik düzeltmesi
  if (p.t === "harf" && ["ac", "kapa", "sayi", "par"].includes(o.t)) return 0.04 * boy;
  if (p.t === "fonk" && !["ac", "us", "iliski", "islem", "nokta", "par"].includes(o.t)) return 0.17 * boy;   // sin x
  if (o.t === "fonk" && ["harf", "betik", "sayi", "kapa", "kesir", "dik"].includes(p.t)) return 0.17 * boy; // x ln x, ¾ ln x
  if (p.t === "dik" && ["harf", "sayi", "betik"].includes(o.t) && p.k.w > boy * 0.9) return 0.17 * boy;     // 18 kN gibi birimler
  return 0;
}
function betik(ctx, taban, n, boy) {
  const ks = Math.max(boy * 0.7, 9), b = mDiz(ctx, n.a, ks), k = taban.k, ust = n.t === "ust";
  const ara = ust && taban.t === "harf" ? 0.05 * boy : 0.02 * boy;
  const kay = ust ? Math.max(0.4 * boy, k.a - 0.3 * boy) : -0.2 * boy;   // pozitif: yukarı
  return { w: k.w + ara + b.w, a: Math.max(k.a, kay + b.a), d: Math.max(k.d, b.d - kay),
    ciz(c, x, y, satir) { k.ciz(c, x, y, satir); b.ciz(c, x + k.w + ara, y - kay, satir); } };
}
// Pay ve payda gövdenin %80'i; çizgi eşittirin ekseninde. Pay ve paydanın taban çizgileri kayda girer.
function kesir(ctx, n, boy) {
  const ks = Math.max(boy * 0.8, 10), u = mDiz(ctx, n.a, ks), l = mDiz(ctx, n.b, ks);
  const e = eksen(ctx, boy), t = Math.max(1, boy * 0.048), bos = boy * 0.15, pay = boy * 0.1;
  const w = Math.max(u.w, l.w) + 2 * pay;
  const uB = e + t / 2 + bos + u.d, lB = l.a + bos + t / 2 - e;
  return { w, a: uB + u.a, d: lB + l.d, ciz(c, x, y, satir) {
    u.ciz(c, x + (w - u.w) / 2, y - uB, satir);
    l.ciz(c, x + (w - l.w) / 2, y + lB, satir);
    c.fillRect(x + pay * 0.3, y - e - t / 2, w - pay * 0.6, t);
    satir?.push(y - uB, y + lB);
  } };
}
function kok(ctx, n, boy) {
  const ic = mDiz(ctx, n.a, boy), t = Math.max(1, boy * 0.048), bos = boy * 0.16, rw = boy * 0.62;
  const ust = Math.max(ic.a, boy * 0.68) + bos, alt = Math.max(ic.d, boy * 0.08);
  return { w: rw + ic.w + boy * 0.08, a: ust + t, d: alt + t, ciz(c, x, y, satir) {
    ic.ciz(c, x + rw, y, satir);
    c.save();
    c.strokeStyle = c.fillStyle;
    c.lineJoin = c.lineCap = "round";
    c.lineWidth = t;
    c.beginPath();
    c.moveTo(x + boy * 0.04, y + alt - boy * 0.38);
    c.lineTo(x + boy * 0.15, y + alt - boy * 0.44);
    c.stroke();
    c.lineWidth = t * 1.9;                    // inen kol kalın, matbaa kökü gibi
    c.beginPath();
    c.moveTo(x + boy * 0.15, y + alt - boy * 0.44);
    c.lineTo(x + boy * 0.31, y + alt);
    c.stroke();
    c.lineWidth = t;
    c.beginPath();
    c.moveTo(x + boy * 0.31, y + alt);
    c.lineTo(x + rw - boy * 0.04, y - ust);
    c.lineTo(x + rw + ic.w + boy * 0.06, y - ust);
    c.stroke();
    c.restore();
  } };
}
// İçerik bir satırdan yüksekse parantez hilal biçiminde çizilir, değilse glif kullanılır
function parantez(ctx, n, boy) {
  const ic = mDiz(ctx, n.a, boy), R = yazi(boy);
  if (ic.a + ic.d < boy * 1.15) {
    const s = kosu(ctx, "(", R, boy), z = kosu(ctx, ")", R, boy);
    return { w: s.w + ic.w + z.w, a: Math.max(ic.a, s.a), d: Math.max(ic.d, s.d), ciz(c, x, y, satir) {
      s.ciz(c, x, y); ic.ciz(c, x + s.w, y, satir); z.ciz(c, x + s.w + ic.w, y);
    } };
  }
  const pw = boy * 0.38, ust = ic.a + boy * 0.06, alt = ic.d + boy * 0.06, ara = boy * 0.04;
  const hilal = (c, x, y, sol) => {
    const uc = sol ? x + pw * 0.9 : x + pw * 0.1, dis = sol ? x - pw * 0.25 : x + pw * 1.25, ic2 = sol ? x + pw * 0.5 : x + pw * 0.5;
    const orta = y + (alt - ust) / 2;
    c.beginPath();
    c.moveTo(uc, y - ust);
    c.quadraticCurveTo(dis, orta, uc, y + alt);
    c.quadraticCurveTo(ic2, orta, uc, y - ust);
    c.fill();
  };
  return { w: 2 * pw + ic.w + 2 * ara, a: ust, d: alt, ciz(c, x, y, satir) {
    hilal(c, x, y, true);
    ic.ciz(c, x + pw + ara, y, satir);
    hilal(c, x + pw + ic.w + 2 * ara, y, false);
  } };
}

// Aramaya giden düz metin: x², dy/dx, √x, F′(x) = f′(g(x)) · g′(x)
const UST = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "−": "⁻", n: "ⁿ", x: "ˣ" };
const ALT = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
function mDuz(liste) {
  let s = "";
  const sar = (t) => (/[ +−·/]/.test(t) ? `(${t})` : t);
  let onceki = null;
  for (const n of liste) {
    // sin x, sin²x, ln(x): fonksiyon adından sonraki boşluk üs ve paranteze kaymaz
    const fonkBos = onceki === "fonk" && s.endsWith(" ");
    if (fonkBos && ["ust", "alt", "ac", "par"].includes(n.t)) s = s.slice(0, -1);
    onceki = n.t === "ust" || n.t === "alt" ? onceki : n.t;
    if (n.t === "kesir") s += sar(mDuz(n.a)) + "/" + sar(mDuz(n.b));
    else if (n.t === "kok") { const a = mDuz(n.a); s += "√" + (a.length > 1 ? `(${a})` : a); }
    else if (n.t === "par") s += `(${mDuz(n.a)})`;
    else if (n.t === "ust") { const a = [...mDuz(n.a)]; s += (a.every((c) => UST[c]) ? a.map((c) => UST[c]).join("") : `^(${a.join("")})`) + (fonkBos ? " " : ""); }
    else if (n.t === "alt") { const a = [...mDuz(n.a)]; s += (a.every((c) => ALT[c]) ? a.map((c) => ALT[c]).join("") : a.join("")) + (fonkBos ? " " : ""); }
    else if (n.t === "bos") s += " ";
    else if (n.t === "iliski" || n.t === "islem") s += ` ${n.s} `;
    else if (n.t === "nokta") s += n.s + " ";
    else if (n.t === "fonk") s += (s && !/[\s(]$/.test(s) ? " " : "") + n.s + " ";
    else s += n.s;
  }
  return s.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")").replace(/ ([,;:])/g, "$1").trim();
}

function matKutu(ctx, src, boy) {
  const l = mCoz(src);
  return { ...mDiz(ctx, l, boy), duz: mDuz(l), boy };
}
// Formülü x0 (sol), y (taban çizgisi) noktasına çizer; önce kayıt, sonra kesir satırları
function matCiz(ctx, k, x0, y, renk = C.ink) {
  kaydet(ctx, k.duz, x0, y, k.w, k.boy);
  ctx.fillStyle = renk;
  ctx.textAlign = "left";
  const satir = [];
  k.ciz(ctx, x0, y, satir);
  for (const sy of satir) kaydet(ctx, "", x0, sy, 0, k.boy);
  return k;
}
function matYaz(ctx, src, x, y, boy, { hiza = "sol", renk = C.ink } = {}) {
  const k = matKutu(ctx, src, boy);
  return matCiz(ctx, k, hiza === "orta" ? x - k.w / 2 : hiza === "sag" ? x - k.w : x, y, renk);
}
// Ortalanmış formül bloğu: ust kutunun tepesi; dönüş kutunun altı. no: sağda denklem numarası
function formul(ctx, src, ust, { boy = 21, x = 400, hiza = "orta", no = null } = {}) {
  const k = matKutu(ctx, src, boy), y = ust + k.a;
  matCiz(ctx, k, hiza === "orta" ? x - k.w / 2 : x, y);
  if (no) {
    ctx.font = yazi(16);
    ctx.fillStyle = C.muted;
    ctx.textAlign = "right";
    ctx.fillText(`(${no})`, 720, y);
    ctx.textAlign = "left";
  }
  return y + k.d;
}

// ---------- paragraf ----------
// Kaynakta $...$ satır içi formül, *...* italik. Kelimeler açgözlü dizilir, satırlar iki yana yaslanır
// (boşluk çok açılacaksa sola dayalı kalır). Bölünmemesi gereken yerde bölünmez boşluk (\u00a0).

function kelimeler(src) {
  // "n. medianus", "m. biceps" gibi kısaltmalar satır sonunda kopmasın
  src = src.replace(/(^|[\s(])([nmaNM])\. (?=[a-zçğıöşü])/g, "$1$2. ");
  const out = [];
  let kelime = [], tampon = "", mat = false, egik = false;
  const bitir = () => { if (tampon) { kelime.push({ tur: egik ? "e" : "y", s: tampon }); tampon = ""; } };
  for (const c of src) {
    if (mat) { if (c === "$") { kelime.push({ tur: "m", s: tampon }); tampon = ""; mat = false; } else tampon += c; continue; }
    if (c === "$") { bitir(); mat = true; continue; }
    if (c === "*") { bitir(); egik = !egik; continue; }
    if (c === " ") { bitir(); if (kelime.length) out.push(kelime); kelime = []; continue; }
    tampon += c;
  }
  bitir();
  if (kelime.length) out.push(kelime);
  return out;
}

// Türkçe heceleme: her ünlüden önceki tek ünsüz yeni heceyi başlatır, iki ünlü yan yanaysa araları bölünür.
// Dönüş: bölünebilecek konumlar (önde en az 2, arkada en az 3 karakter kalır)
const UNLU = /[aeıioöuüâîûAEIİOÖUÜ]/;
function heceler(s) {
  const n = [];
  for (let i = 1; i < s.length; i++) {
    if (!UNLU.test(s[i])) continue;
    let k = i - 1;
    while (k >= 0 && /\p{L}/u.test(s[k]) && !UNLU.test(s[k])) k--;
    if (k < 0 || !UNLU.test(s[k])) continue;
    const p = k === i - 1 ? i : i - 1;
    if (p >= 2 && s.length - p >= 3 && /\p{L}/u.test(s[p - 1]) && /\p{L}/u.test(s[p])) n.push(p);
  }
  return n;
}

// y: ilk satırın taban çizgisi; dönüş: sıradaki satırın taban çizgisi
function paragraf(ctx, src, y, { x = 80, w = 640, boy = 17, sat = 27, renk = C.ink, agirlik = 400, egik = false, hiza = "iki" } = {}) {
  const R = yazi(boy, { w: agirlik, i: egik }), E = yazi(boy, { w: agirlik, i: !egik });
  ctx.font = R;
  const bosluk = ctx.measureText(" ").width;
  const kelime = (par) => ({ par, w: par.reduce((t, p) => t + p.k.w, 0), duz: par.map((p) => p.duz).join("") });
  const yaziParca = (t, f) => ({ k: kosu(ctx, t, f, boy), duz: t, f });
  const ks = kelimeler(src).map((k) => kelime(k.map((p) => (p.tur === "m" ? (() => { const m = matKutu(ctx, p.s, boy); return { k: m, duz: m.duz }; })()
    : yaziParca(p.s, p.tur === "e" ? E : R)))));
  // Tek parçalı düz kelimeyi kalan genişliğe sığan en uzun heceden böler: [önü + "-", arkası] ya da null
  const bol = (k, kalan) => {
    const p = k.par[0];
    if (k.par.length !== 1 || !p.f) return null;
    for (const i of heceler(p.duz).reverse()) {
      const on = yaziParca(p.duz.slice(0, i) + "-", p.f);
      if (on.k.w <= kalan) return [kelime([on]), kelime([yaziParca(p.duz.slice(i), p.f)])];
    }
    return null;
  };
  // Kelime boşluklar %18 daralınca sığıyorsa bu satırda kalır; sığmıyor ve satır çok açılacaksa hecesinden bölünür
  const satirlar = [];
  let s = [], kel = 0;
  for (let k of ks) {
    for (;;) {
      if (!s.length || kel + k.w + bosluk * 0.82 * s.length <= w) { s.push(k); kel += k.w; break; }
      const parca = hiza === "iki" && (w - kel) / Math.max(1, s.length - 1) > bosluk * 1.45 ? bol(k, w - kel - bosluk * 0.9 * s.length) : null;
      if (parca) s.push(parca[0]);
      satirlar.push(s);
      s = [];
      kel = 0;
      if (parca) k = parca[1];
    }
  }
  if (s.length) satirlar.push(s);
  satirlar.forEach((sk, j) => {
    const dogal = sk.reduce((t, k) => t + k.w, 0), n = sk.length - 1;
    const a = n > 0 ? (w - dogal) / n : bosluk;
    let ara = Math.min(bosluk, a);
    if (hiza === "iki" && j < satirlar.length - 1 && a < bosluk * 2.6) ara = a;
    const gercek = dogal + ara * n;
    let xx = hiza === "orta" ? x + (w - gercek) / 2 : x;
    kaydet(ctx, sk.map((k) => k.duz).join(" "), xx, y, gercek, boy, { w: agirlik });
    ctx.fillStyle = renk;
    ctx.textAlign = "left";
    for (const k of sk) {
      let px = xx;
      for (const p of k.par) { p.k.ciz(ctx, px, y); px += p.k.w; }
      xx += k.w + ara;
    }
    y += sat;
  });
  return y;
}

// ---------- sayfa parçaları ----------

function ust(ctx, sol, no) {
  ctx.fillStyle = C.muted;
  ctx.font = yazi(11, { aile: "etiket", w: 600 });
  ctx.letterSpacing = "1.4px";
  ham(ctx, sol.toLocaleUpperCase("tr"), 80, 62);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = C.ink;
  ctx.font = yazi(15, { aile: "baslik", w: 600 });
  ham(ctx, String(no), 720 - ctx.measureText(String(no)).width, 63);
  ctx.fillStyle = C.rule;
  ctx.fillRect(80, 76, 640, 1);
}

// Bölüm numarası mavi, adı mürekkep; tek kayıt "3.4  Zincir Kuralı" olarak girer
function baslik(ctx, no, ad, y) {
  const f = yazi(30, { aile: "baslik", w: 600 });
  ctx.font = f;
  const nw = no ? ctx.measureText(no).width + 16 : 0, aw = ctx.measureText(ad).width;
  kaydet(ctx, no ? `${no}  ${ad}` : ad, 80, y, nw + aw, 30, { aile: "baslik", w: 600 });
  ctx.font = f;
  if (no) { ctx.fillStyle = C.accent; ham(ctx, no, 80, y); }
  ctx.fillStyle = C.ink;
  ham(ctx, ad, 80 + nw, y);
}

function araBaslik(ctx, metin, y, { renk = C.accent, boy = 20 } = {}) {
  ctx.fillStyle = renk;
  ctx.font = yazi(boy, { aile: "baslik", w: 600 });
  ctx.fillText(metin, 80, y);
  const w = ctx.measureText(metin).width;
  ctx.fillStyle = C.rule;
  ctx.fillRect(80 + w + 14, y - boy * 0.3, 640 - w - 14, 1);
}

// Örnek / Çözüm etiketi: solda asılı, metin 160'tan başlar
function etiket(ctx, metin, y, { renk = C.accent, egik = false } = {}) {
  ctx.fillStyle = renk;
  ctx.font = yazi(17, { w: 600, i: egik });
  ctx.fillText(metin, 80, y);
}

function kutu(ctx, y, h, { zemin = C.box, serit = C.accent } = {}) {
  ctx.fillStyle = zemin;
  ctx.beginPath();
  ctx.roundRect(70, y, 660, h, 3);
  ctx.fill();
  ctx.fillStyle = serit;
  ctx.fillRect(70, y, 3, h);
}

function sekilYazisi(ctx, no, metin, y) {
  // Açıklama italik, şekil numarası dik; tek satırda ortalanır
  return paragraf(ctx, `*${no}* ${metin}`, y, { boy: 13.5, sat: 20, renk: C.muted, egik: true, hiza: "orta", x: 120, w: 560 });
}

function arrow(ctx, x1, y1, x2, y2, head = 10) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.38), y2 - head * Math.sin(a - 0.38));
  ctx.lineTo(x2 - head * Math.cos(a + 0.38), y2 - head * Math.sin(a + 0.38));
  ctx.closePath();
  ctx.fill();
}
function cizgi(ctx, pts, { renk = C.ink, w = 1.2, kesik = null } = {}) {
  ctx.strokeStyle = renk;
  ctx.lineWidth = w;
  if (kesik) ctx.setLineDash(kesik);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  if (kesik) ctx.setLineDash([]);
}

// Alıştırma satırı: numara dik, ifade formül
function alistirmalar(ctx, liste, y, { sutunlar = [96, 420], sat = 40, boy = 18 } = {}) {
  liste.forEach(([no, src], i) => {
    const x = sutunlar[i % sutunlar.length], yy = y + Math.floor(i / sutunlar.length) * sat;
    ctx.fillStyle = C.muted;
    ctx.font = yazi(16, { w: 600 });
    ctx.fillText(no + ".", x, yy);
    matYaz(ctx, src, x + 30, yy, boy);
  });
  return y + Math.ceil(liste.length / sutunlar.length) * sat;
}

// ---------- Kalkülüs II ----------

function kalkulus1(ctx) {
  ust(ctx, "Bölüm 3 · Türev ve uygulamaları", 47);
  baslik(ctx, "3.4", "Zincir Kuralı", 140);
  let y = paragraf(ctx, "Bileşke fonksiyonların türevini almak için *zincir kuralını* kullanırız. Bir fonksiyon başka bir fonksiyonun içine yerleştirildiğinde, dış fonksiyonun türevi iç fonksiyonda hesaplanır ve iç fonksiyonun türeviyle çarpılır.", 186);

  const kt = y - 2;
  kutu(ctx, kt, 168);
  ctx.fillStyle = C.accent;
  ctx.font = yazi(17, { aile: "baslik", w: 600 });
  ctx.fillText("Teorem 3.4", 96, kt + 34);
  const tw = ctx.measureText("Teorem 3.4").width;
  ctx.font = yazi(16, { i: true });
  ctx.fillStyle = C.ink;
  ctx.fillText("(Zincir Kuralı)", 96 + tw + 8, kt + 34);
  paragraf(ctx, "$g$ fonksiyonu $x$ noktasında, $f$ fonksiyonu da $g(x)$ noktasında türevlenebilir ise $F = f ∘ g$ bileşkesi de $x$ noktasında türevlenebilirdir ve", kt + 62, { x: 96, w: 610, boy: 16, sat: 25 });
  formul(ctx, "F′(x) = f′(g(x)) · g′(x)", kt + 114, { boy: 22, no: "3.6" });
  y = kt + 168 + 40;

  y = paragraf(ctx, "Leibniz gösterimiyle, $y = f(u)$ ve $u = g(x)$ için kural şöyle yazılır:", y);
  y = formul(ctx, "\\f{dy}{dx} = \\f{dy}{du} · \\f{du}{dx}", y - 6, { boy: 23, no: "3.7" }) + 44;

  etiket(ctx, "Örnek 1.", y);
  y = paragraf(ctx, "$y = (3x^2 + 1)^5$ fonksiyonunun türevini bulunuz.", y, { x: 160, w: 560 }) + 8;
  etiket(ctx, "Çözüm.", y, { renk: C.ink, egik: true });
  y = paragraf(ctx, "İç fonksiyon $u = 3x^2 + 1$, dış fonksiyon $y = u^5$ olsun. Buna göre", y, { x: 160, w: 560 });
  y = formul(ctx, "\\f{dy}{du} = 5u^4, \\Q \\f{du}{dx} = 6x", y - 4, { boy: 20 }) + 14;
  y = formul(ctx, "\\f{dy}{dx} = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4", y, { boy: 20 }) + 50;

  araBaslik(ctx, "Alıştırmalar", y);
  alistirmalar(ctx, [
    [1, "y = sin 4x"], [2, "y = \\r{1 + x^3}"],
    [3, "y = e^{x^2}"], [4, "y = ln(cos x)"],
    [5, "y = (2x − 1)^3(x + 4)^2"], [6, "y = tan^2 3x"],
  ], y + 42);
}

function kalkulus2(ctx) {
  ust(ctx, "Bölüm 3 · Türev ve uygulamaları", 48);
  baslik(ctx, "3.5", "Kapalı Türev", 140);
  let y = paragraf(ctx, "Bazı eğriler $y = f(x)$ biçiminde açıkça yazılamaz; $x^2 + y^2 = 25$ çemberi buna bir örnektir. Bu durumda denklemin iki tarafının $x$’e göre türevini alır, $y$’yi $x$’in bir fonksiyonu gibi düşünürüz. $y$ içeren her terimde zincir kuralı gerekir.", 186);

  // Şekil: çember, yarıçap ve teğet. Teğet yarıçapa diktir.
  const cx = 400, cy = y + 196, s = 24;
  ctx.strokeStyle = "#8d99a6";
  ctx.fillStyle = "#8d99a6";
  ctx.lineWidth = 1;
  arrow(ctx, cx - 178, cy, cx + 186, cy, 8);
  arrow(ctx, cx, cy + 156, cx, cy - 172, 8);
  ctx.font = yazi(12);
  ctx.textAlign = "center";
  for (let k = -5; k <= 5; k++) {
    if (!k) continue;
    ctx.fillRect(cx + k * s - 0.5, cy - 3, 1, 6);
    ctx.fillRect(cx - 3, cy - k * s - 0.5, 6, 1);
  }
  ctx.fillStyle = C.muted;
  ctx.fillText("5", cx + 5 * s + 7, cy + 17);
  ctx.fillText("−5", cx - 5 * s - 9, cy + 17);
  ctx.textAlign = "right";
  ctx.fillText("5", cx - 8, cy - 5 * s - 5);
  ctx.textAlign = "left";
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2); ctx.stroke();
  const px = cx + 3 * s, py = cy - 4 * s;
  cizgi(ctx, [[cx, cy], [px, py]], { renk: C.accent, w: 1.2, kesik: [5, 4] });
  // Dik açı işareti
  const ux = 3 / 5, uy = -4 / 5, tx = 4 / 5, ty = 3 / 5, m = 9;
  cizgi(ctx, [[px - ux * m, py - uy * m], [px - ux * m + tx * m, py - uy * m + ty * m], [px + tx * m, py + ty * m]], { renk: C.red, w: 1 });
  cizgi(ctx, [[px - 4 * s, py - 3 * s], [px + 3.4 * s, py + 2.55 * s]], { renk: C.red, w: 1.8 });
  ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
  matYaz(ctx, "(3, 4)", px + 12, py - 10, 16);
  matYaz(ctx, "x", cx + 190, cy + 20, 16);
  matYaz(ctx, "y", cx + 10, cy - 166, 16);
  matYaz(ctx, "x^2 + y^2 = 25", cx - 5 * s * 0.71 - 104, cy - 5 * s * 0.71 - 8, 15, { renk: C.accent });
  y = sekilYazisi(ctx, "Şekil 3.9", "$x^2 + y^2 = 25$ çemberi ve $(3, 4)$ noktasındaki teğet doğrusu.", cy + 186) + 22;

  etiket(ctx, "Örnek 2.", y);
  y = paragraf(ctx, "Çemberin $(3, 4)$ noktasındaki teğet doğrusunun denklemini bulunuz.", y, { x: 160, w: 560 }) + 8;
  etiket(ctx, "Çözüm.", y, { renk: C.ink, egik: true });
  y = paragraf(ctx, "İki tarafın $x$’e göre türevi alınır; $y^2$ teriminde zincir kuralı $2y\\,y′$ verir:", y, { x: 160, w: 560 });
  y = formul(ctx, "2x + 2y\\,y′ = 0 \\q ⟹ \\qy′ = −\\f{x}{y}", y - 4, { boy: 20 }) + 30;
  y = paragraf(ctx, "$(3, 4)$ noktasında eğim $m = −3/4$ olduğundan teğet doğrusu", y, { x: 160, w: 560 });
  y = formul(ctx, "y − 4 = −\\f{3}{4}(x − 3) \\q ⟺ \\q3x + 4y = 25", y - 4, { boy: 20 }) + 48;

  araBaslik(ctx, "Alıştırmalar", y);
  alistirmalar(ctx, [[7, "x^3 + y^3 = 6xy"], [8, "sin(x + y) = y^2 cos x"], [9, "\\r{x} + \\r{y} = 4"]], y + 42, { sutunlar: [96, 300, 540] });
}

function kalkulus3(ctx) {
  ust(ctx, "Bölüm 3 · Türev ve uygulamaları", 49);
  baslik(ctx, "3.6", "Logaritmik Türev", 140);
  let y = paragraf(ctx, "Çarpım, bölüm ve kuvvetlerden oluşan bir fonksiyonun türevini doğrudan almak uzun sürer. İki tarafın doğal logaritmasını alıp ifadeyi logaritmanın özellikleriyle toplamaya çevirmek, sonra kapalı türev almak işi kısaltır.", 186);

  const kt = y - 2;
  kutu(ctx, kt, 132);
  ctx.fillStyle = C.accent;
  ctx.font = yazi(17, { aile: "baslik", w: 600 });
  ctx.fillText("Yöntem", 96, kt + 34);
  let yy = kt + 62;
  for (const [no, metin] of [["1.", "$y = f(x)$ denkleminin iki tarafının doğal logaritmasını alın ve sadeleştirin."], ["2.", "$x$’e göre kapalı türev alın."], ["3.", "Çıkan denklemi $y′$ için çözün."]]) {
    ctx.fillStyle = C.accent;
    ctx.font = yazi(16, { w: 600 });
    ctx.fillText(no, 96, yy);
    yy = paragraf(ctx, metin, yy, { x: 122, w: 584, boy: 16, sat: 24 });
  }
  y = kt + 132 + 40;

  etiket(ctx, "Örnek 3.", y);
  y = paragraf(ctx, "Aşağıdaki fonksiyonun türevini bulunuz.", y, { x: 160, w: 560 });
  y = formul(ctx, "y = \\f{x^{3/4}\\r{x^2 + 1}}{(3x + 2)^5}", y - 2, { boy: 21 }) + 30;
  etiket(ctx, "Çözüm.", y, { renk: C.ink, egik: true });
  y = paragraf(ctx, "İki tarafın logaritması alınırsa", y, { x: 160, w: 560 });
  y = formul(ctx, "ln y = \\f{3}{4} ln x + \\f{1}{2} ln(x^2 + 1) − 5 ln(3x + 2)", y - 4, { boy: 19 }) + 26;
  y = paragraf(ctx, "olur. $x$’e göre türev alınır ve $y$ ile çarpılırsa", y, { x: 160, w: 560 });
  y = formul(ctx, "y′ = \\f{x^{3/4}\\r{x^2 + 1}}{(3x + 2)^5}\\,\\p{\\f{3}{4x} + \\f{x}{x^2 + 1} − \\f{15}{3x + 2}}", y - 2, { boy: 19 }) + 40;

  etiket(ctx, "Örnek 4.", y);
  y = paragraf(ctx, "$x > 0$ için $y = x^x$ fonksiyonunun türevini bulunuz. Ne kuvvet kuralı ne üstel kural uygulanır; taban da üs de değişkendir.", y, { x: 160, w: 560 });
  y = formul(ctx, "ln y = x ln x \\q ⟹ \\q\\f{y′}{y} = ln x + 1 \\q ⟹ \\qy′ = x^x(ln x + 1)", y - 2, { boy: 19 }) + 48;

  araBaslik(ctx, "Alıştırmalar", y);
  alistirmalar(ctx, [
    [10, "y = x^{sin x}"], [11, "y = (ln x)^{cos x}"],
    [12, "y = \\r{\\f{x − 1}{x^4 + 1}}"], [13, "y = \\f{e^{−x} cos^2 x}{x^2 + x + 1}"],
  ], y + 46, { sat: 56 });
}

// ---------- Statik ----------

const KIRIS = { L: 150, R: 650 };
// Kiriş, mesnetler ve yükler. yukler: { tur: "tekil", x, etiket } | { tur: "yayili", x0, x1, etiket }
function kirisCiz(ctx, ustY, { yukler = [], olculer = [], noktalar = [], mesnet = true } = {}) {
  const { L, R } = KIRIS, h = 16;
  for (const y of yukler) {
    if (y.tur !== "yayili") continue;
    ctx.strokeStyle = C.accent;
    ctx.fillStyle = C.accent;
    ctx.lineWidth = 1.2;
    const t = ustY - 38, n = Math.max(2, Math.round((y.x1 - y.x0) / 26));
    cizgi(ctx, [[y.x0, t], [y.x1, t]], { renk: C.accent, w: 1.4 });
    ctx.strokeStyle = C.accent;
    for (let i = 0; i <= n; i++) { const x = y.x0 + ((y.x1 - y.x0) * i) / n; arrow(ctx, x, t, x, ustY - 2, 6); }
    matYaz(ctx, y.etiket, y.etx ?? y.x1, t - 10, 15, { hiza: y.etx ? "sol" : "sag", renk: C.accent });
  }
  ctx.fillStyle = "#e9edf1";
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.fillRect(L, ustY, R - L, h);
  ctx.strokeRect(L, ustY, R - L, h);
  if (mesnet) {
    const zemin = (x, y) => {
      cizgi(ctx, [[x - 28, y], [x + 28, y]], { w: 1.4 });
      for (let i = -26; i < 28; i += 7) cizgi(ctx, [[x + i, y + 9], [x + i + 7, y]], { w: 0.9 });
    };
    // A: sabit mesnet (pim)
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(L, ustY + h); ctx.lineTo(L - 18, ustY + h + 30); ctx.lineTo(L + 18, ustY + h + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(L, ustY + h + 2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    zemin(L, ustY + h + 30);
    // B: kayıcı mesnet
    ctx.beginPath(); ctx.moveTo(R, ustY + h); ctx.lineTo(R - 16, ustY + h + 22); ctx.lineTo(R + 16, ustY + h + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const dx of [-9, 9]) { ctx.beginPath(); ctx.arc(R + dx, ustY + h + 26.5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    zemin(R, ustY + h + 31);
  }
  for (const y of yukler) {
    if (y.tur !== "tekil") continue;
    ctx.fillStyle = C.red;
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2.2;
    arrow(ctx, y.x, ustY - 84, y.x, ustY - 2, 12);
    matYaz(ctx, y.etiket, y.x - 10, ustY - 66, 15, { hiza: "sag", renk: C.red });
  }
  ctx.fillStyle = C.ink;
  ctx.font = yazi(15, { aile: "etiket", w: 600 });
  for (const [ad, x, dy = 62] of noktalar) { ctx.textAlign = "center"; ctx.fillText(ad, x, ustY + dy); }
  ctx.textAlign = "left";
  const oy = ustY + 92;
  for (const [a, b, t] of olculer) {
    ctx.strokeStyle = C.muted;
    ctx.fillStyle = C.muted;
    ctx.lineWidth = 0.9;
    arrow(ctx, (a + b) / 2, oy, a + 0.5, oy, 7);
    arrow(ctx, (a + b) / 2, oy, b - 0.5, oy, 7);
    for (const x of [a, b]) cizgi(ctx, [[x, oy - 10], [x, oy + 10]], { renk: C.muted, w: 0.9 });
    ctx.font = yazi(14);
    const w = ctx.measureText(t).width;
    ctx.fillStyle = "#fff";
    ctx.fillRect((a + b) / 2 - w / 2 - 6, oy - 10, w + 12, 20);
    ctx.fillStyle = C.muted;
    matYaz(ctx, t, (a + b) / 2, oy + 5, 14, { hiza: "orta", renk: C.muted });
  }
}

const mX = (m) => KIRIS.L + (m * (KIRIS.R - KIRIS.L)) / 6;

function statik1(ctx) {
  ust(ctx, "Bölüm 2 · Kirişler", 23);
  baslik(ctx, "2.5", "Basit Mesnetli Kirişler", 140);
  let y = paragraf(ctx, "Bir ucu sabit mesnede (pim), öbür ucu kayıcı mesnede oturan kirişe *basit mesnetli kiriş* denir. Sabit mesnet iki tepki kuvveti ($A_x$, $A_y$), kayıcı mesnet ise yüzeye dik tek bir tepki ($B_y$) verir. Üç bilinmeyen düzlemdeki üç denge denklemiyle bulunur; kiriş izostatiktir.", 186) + 12;

  etiket(ctx, "Örnek 2.6", y);
  y = paragraf(ctx, "6\u00a0m uzunluğundaki AB kirişinin tamamına $w = 4\\,\\t{kN/m}$ yayılı yük, A’dan 2\u00a0m uzaktaki C noktasına $P = 18\\,\\t{kN}$ tekil yük etkimektedir. Mesnet tepkilerini bulunuz.", y, { x: 170, w: 550 });

  const t1 = y + 92;
  kirisCiz(ctx, t1, {
    yukler: [{ tur: "yayili", x0: KIRIS.L, x1: KIRIS.R, etiket: "w = 4\\,\\t{kN/m}" }, { tur: "tekil", x: mX(2), etiket: "P = 18\\,\\t{kN}" }],
    olculer: [[KIRIS.L, mX(2), "2\\,\\t{m}"], [mX(2), KIRIS.R, "4\\,\\t{m}"]],
    noktalar: [["A", KIRIS.L - 34, 40], ["B", KIRIS.R + 34, 40], ["C", mX(2), 36]],
  });
  y = sekilYazisi(ctx, "Şekil 2.11", "Yükleme ve mesnetler.", t1 + 136) + 26;

  // Serbest cisim diyagramı: mesnetler yerine tepkiler, yayılı yük yerine bileşkesi
  const t2 = y + 96, { L, R } = KIRIS;
  ctx.fillStyle = "#e9edf1";
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.fillRect(L, t2, R - L, 16);
  ctx.strokeRect(L, t2, R - L, 16);
  ctx.fillStyle = C.red;
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 2.2;
  arrow(ctx, mX(2), t2 - 80, mX(2), t2 - 2, 12);
  matYaz(ctx, "18\\,\\t{kN}", mX(2) - 10, t2 - 60, 15, { hiza: "sag", renk: C.red });
  ctx.setLineDash([6, 4]);
  arrow(ctx, mX(3), t2 - 80, mX(3), t2 - 2, 12);
  ctx.setLineDash([]);
  matYaz(ctx, "24\\,\\t{kN}", mX(3) + 10, t2 - 60, 15, { renk: C.red });
  ctx.fillStyle = C.accent;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2.2;
  arrow(ctx, L - 74, t2 + 8, L - 3, t2 + 8, 12);
  arrow(ctx, L, t2 + 88, L, t2 + 19, 12);
  arrow(ctx, R, t2 + 88, R, t2 + 19, 12);
  matYaz(ctx, "A_x", L - 70, t2 - 4, 16, { renk: C.accent });
  matYaz(ctx, "A_y", L + 10, t2 + 80, 16, { renk: C.accent });
  matYaz(ctx, "B_y", R + 10, t2 + 80, 16, { renk: C.accent });
  // Bileşkenin yeri ve eksen takımı
  cizgi(ctx, [[L, t2 - 26], [mX(3), t2 - 26]], { renk: C.muted, w: 0.8, kesik: [2, 3] });
  matYaz(ctx, "3\\,\\t{m}", (L + mX(3)) / 2, t2 - 32, 13, { hiza: "orta", renk: C.muted });
  ctx.strokeStyle = C.muted;
  ctx.fillStyle = C.muted;
  ctx.lineWidth = 1;
  arrow(ctx, R + 40, t2 - 30, R + 72, t2 - 30, 6);
  arrow(ctx, R + 40, t2 - 30, R + 40, t2 - 62, 6);
  matYaz(ctx, "x", R + 76, t2 - 26, 13, { renk: C.muted });
  matYaz(ctx, "y", R + 44, t2 - 64, 13, { renk: C.muted });
  y = sekilYazisi(ctx, "Şekil 2.12", "Serbest cisim diyagramı. Yayılı yük, bileşkesiyle (24 kN, açıklığın ortasında) gösterilmiştir.", t2 + 122) + 34;

  // Denge denklemleri: koşullar solda, eşitlikler hizalı
  const satirlar = [
    ["ΣF_x = 0:", "A_x = 0"],
    ["ΣM_A = 0:", "6B_y − 18(2) − 24(3) = 0 \\q ⟹ \\qB_y = 18\\,\\t{kN}"],
    ["ΣF_y = 0:", "A_y + 18 − 18 − 24 = 0 \\q ⟹ \\qA_y = 24\\,\\t{kN}"],
  ];
  for (const [kosul, esitlik] of satirlar) {
    matYaz(ctx, kosul, 120, y, 19);
    matYaz(ctx, esitlik, 252, y, 19);
    y += 42;
  }
}

function statik2(ctx) {
  ust(ctx, "Bölüm 2 · Kirişler", 24);
  baslik(ctx, "2.6", "Kesme Kuvveti ve Eğilme Momenti", 140);
  let y = paragraf(ctx, "Kesitteki iç kuvvetler, kesitin bir yanında kalan parçanın dengesinden bulunur. Yayılı yük $w$ aşağı doğru ise kesme kuvveti $V$ ve eğilme momenti $M$ için", 186);
  y = formul(ctx, "\\f{dV}{dx} = −w(x), \\Q \\f{dM}{dx} = V(x)", y - 6, { boy: 21, no: "2.9" }) + 30;
  y = paragraf(ctx, "Tekil yükün altında $V$ yük kadar sıçrar; $M$, kesme kuvvetinin işaret değiştirdiği yerde en büyük değerini alır.", y) + 10;

  etiket(ctx, "Örnek 2.6", y);
  y = paragraf(ctx, "(devam) $A_y = 24\\,\\t{kN}$, $B_y = 18\\,\\t{kN}$ bulunmuştu. Kesit yöntemiyle ($x$ m, $V$ kN, $M$ kN·m):", y, { x: 170, w: 550 }) + 8;
  for (const [kosul, ifade] of [["0 ≤ x < 2:", "V = 24 − 4x, \\q M = 24x − 2x^2"], ["2 < x ≤ 6:", "V = 6 − 4x, \\q M = 36 + 6x − 2x^2"]]) {
    matYaz(ctx, kosul, 170, y, 18);
    matYaz(ctx, ifade, 290, y, 18);
    y += 34;
  }

  // Kiriş ve iki diyagram aynı x ekseninde
  const { L, R } = KIRIS;
  const t = y + 80;
  kirisCiz(ctx, t, {
    yukler: [{ tur: "yayili", x0: L, x1: R, etiket: "4\\,\\t{kN/m}" }, { tur: "tekil", x: mX(2), etiket: "18\\,\\t{kN}" }],
    noktalar: [["A", L - 30, 36], ["B", R + 30, 36]],
  });
  const vY = t + 136, vK = 2.1;      // V ekseni, kN başına birim
  const mY = vY + 160, mK = 1.7;     // M ekseni, kN·m başına birim
  const V = [[0, 24], [2, 16], [2, -2], [6, -18]];
  const parca = (pts, renk) => {
    ctx.fillStyle = renk;
    ctx.beginPath();
    pts.forEach(([x, v], i) => (i ? ctx.lineTo(mX(x), vY - v * vK) : ctx.moveTo(mX(x), vY - v * vK)));
    ctx.closePath();
    ctx.fill();
  };
  parca([[0, 0], [0, 24], [2, 16], [2, 0]], "rgba(47, 93, 138, .14)");
  parca([[2, 0], [2, -2], [6, -18], [6, 0]], "rgba(181, 69, 47, .12)");
  cizgi(ctx, [[mX(0), vY], ...V.map(([x, v]) => [mX(x), vY - v * vK]), [mX(6), vY]], { w: 1.8 });
  const Mx = (x) => (x <= 2 ? 24 * x - 2 * x * x : 36 + 6 * x - 2 * x * x);
  const mp = [];
  for (let i = 0; i <= 60; i++) mp.push([mX(i / 10), mY - Mx(i / 10) * mK]);
  ctx.fillStyle = "rgba(47, 93, 138, .14)";
  ctx.beginPath();
  mp.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
  ctx.closePath();
  ctx.fill();
  cizgi(ctx, mp, { w: 1.8 });
  for (const ey of [vY, mY]) cizgi(ctx, [[L - 10, ey], [R + 14, ey]], { renk: C.muted, w: 1 });
  cizgi(ctx, [[mX(2), t + 40], [mX(2), mY + 24]], { renk: C.muted, w: 0.8, kesik: [3, 4] });
  matYaz(ctx, "V\\;(\\t{kN})", L - 20, vY + 5, 15, { hiza: "sag" });
  matYaz(ctx, "M\\;(\\t{kN·m})", L - 20, mY + 5, 15, { hiza: "sag" });
  matYaz(ctx, "24", mX(0) + 6, vY - 24 * vK - 8, 14);
  matYaz(ctx, "16", mX(2) - 8, vY - 16 * vK - 8, 14, { hiza: "sag" });
  matYaz(ctx, "−2", mX(2) + 6, vY + 2 * vK + 16, 14);
  matYaz(ctx, "−18", mX(6) + 8, vY + 18 * vK + 4, 14);
  matYaz(ctx, "M_{\\t{maks}} = 40", mX(2) + 8, mY - 40 * mK - 8, 14);
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(mX(2), mY - 40 * mK, 3, 0, Math.PI * 2); ctx.fill();
  matYaz(ctx, "x = 2\\,\\t{m}", mX(2), mY + 38, 13, { hiza: "orta", renk: C.muted });
  y = sekilYazisi(ctx, "Şekil 2.13", "Kesme kuvveti ve eğilme momenti diyagramları.", mY + 64) + 24;

  kutu(ctx, y - 6, 74, { zemin: "#f7f3ea", serit: "#b8871b" });
  paragraf(ctx, "*Not.* $V$, C noktasında $+16$’dan $−2$’ye atlayarak işaret değiştirir; en büyük moment buradadır: $M_{\\t{maks}} = 24(2) − 2(2)^2 = 40\\,\\t{kN·m}$.", y + 22, { x: 96, w: 610, boy: 16, sat: 24 });
}

function statik3(ctx) {
  ust(ctx, "Bölüm 2 · Kirişler", 25);
  baslik(ctx, "", "Problem 2.7", 140);
  let y = paragraf(ctx, "Şekildeki AB kirişi A noktasında sabit mesnet, B noktasında kayıcı mesnet ile taşınmaktadır. C noktasına $12\\,\\t{kN}$’luk tekil yük, CB aralığına $4\\,\\t{kN/m}$’lik yayılı yük etkimektedir.", 186);
  const t = y + 118, Cx = KIRIS.L + 300;
  kirisCiz(ctx, t, {
    yukler: [{ tur: "yayili", x0: Cx, x1: KIRIS.R, etiket: "4\\,\\t{kN/m}" }, { tur: "tekil", x: Cx, etiket: "12\\,\\t{kN}" }],
    olculer: [[KIRIS.L, Cx, "3\\,\\t{m}"], [Cx, KIRIS.R, "2\\,\\t{m}"]],
    noktalar: [["A", KIRIS.L - 34, 40], ["B", KIRIS.R + 34, 40], ["C", Cx, 36]],
  });
  y = sekilYazisi(ctx, "Şekil P2.7", "", t + 136) + 28;
  for (const [h, q] of [["a)", "Serbest cisim diyagramını çiziniz."], ["b)", "A ve B mesnet tepkilerini bulunuz."], ["c)", "Kesme kuvveti ve eğilme momenti diyagramlarını çiziniz; en büyük momentin yerini ve değerini belirtiniz."]]) {
    ctx.fillStyle = C.accent;
    ctx.font = yazi(17, { w: 600 });
    ctx.fillText(h, 96, y);
    y = paragraf(ctx, q, y, { x: 126, w: 594 }) + 4;
  }
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6]);
  ctx.beginPath(); ctx.moveTo(80, y + 6); ctx.lineTo(720, y + 6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#a8b2bd";
  ctx.font = yazi(11, { aile: "etiket", w: 600 });
  ctx.letterSpacing = "1.4px";
  ctx.fillText("ÇÖZÜM", 80, y + 32);
  ctx.letterSpacing = "0px";
  // Cevap anahtarı sayfanın dibinde, küçük
  ctx.fillStyle = C.rule;
  ctx.fillRect(80, 1030, 120, 1);
  paragraf(ctx, "*Cevaplar.* $A_x = 0$, $A_y = 6,4\\,\\t{kN}$, $B_y = 13,6\\,\\t{kN}$; $M_{\\t{maks}} = 19,2\\,\\t{kN·m}$ (C noktasında).", 1054, { boy: 13.5, sat: 20, renk: C.muted, hiza: "sol" });
}

// ---------- Üst Ekstremite Anatomisi ----------

const ON = C.bordo, ARKA = C.accent;

function anatomi1(ctx) {
  ust(ctx, "Bölüm 4 · Üst ekstremite", 61);
  baslik(ctx, "4.2", "Plexus Brachialis", 140);
  let y = paragraf(ctx, "Üst ekstremitenin duyu ve motor innervasyonunun neredeyse tamamı *plexus brachialis*’ten gelir. Ağ, C5-T1 spinal sinirlerinin ön dallarından (rami anteriores) oluşur; m. scalenus anterior ile m. scalenus medius arasından çıkar, klavikulanın arkasından geçerek aksillaya ulaşır.", 186);

  // Şema: kökler, trunkuslar, bölümler, kordlar, terminal dallar
  const Y = y + 84;
  const kokY = [0, 44, 88, 132, 176].map((v) => Y + v);
  const tr = { ust: Y + 22, orta: Y + 88, alt: Y + 154 };
  const kord = { lat: Y + 30, arka: Y + 100, med: Y + 168 };
  const dal = { mc: Y - 4, ax: Y + 50, rad: Y + 94, med: Y + 140, uln: Y + 188 };
  const xK = 130, xT = 222, xB = 290, xC = 404, xD = 462, xE = 566, xM = 518;
  ctx.sekil = "Şekil 4.3";   // şema etiketleri aramada düzyazıdan sonra, kendi adıyla gelir (metinCikar)
  ctx.fillStyle = C.muted;
  ctx.font = yazi(10.5, { aile: "etiket", w: 600 });
  ctx.letterSpacing = "1.2px";
  ctx.textAlign = "center";
  for (const [t, x] of [["KÖKLER", 116], ["TRUNKUSLAR", 256], ["BÖLÜMLER", 347], ["KORDLAR", 433], ["DALLAR", 620]]) ctx.fillText(t, x, Y - 40);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  const yol = (pts, renk, w, halo = false) => {
    ctx.lineCap = ctx.lineJoin = "round";
    if (halo) cizgi(ctx, pts, { renk: "#fff", w: w + 5 });
    cizgi(ctx, pts, { renk, w });
  };
  const egri = (x0, y0, x1, y1) => {
    const p = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, s = t * t * (3 - 2 * t); p.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * s]); }
    return p;
  };
  // Arka bölümler ve dalları altta, ön bölümler üstte (kesişimde beyaz pay)
  for (const ty of [tr.ust, tr.orta, tr.alt]) yol(egri(xB, ty, xC, kord.arka), ARKA, 2.4);
  yol([[xC, kord.arka], [xD, kord.arka]], ARKA, 3.2);
  yol(egri(xD, kord.arka, xE, dal.ax), ARKA, 2.4);
  yol(egri(xD, kord.arka, xE, dal.rad), ARKA, 2.4);
  yol(egri(xB, tr.ust, xC, kord.lat), ON, 2.4, true);
  yol(egri(xB, tr.orta, xC, kord.lat), ON, 2.4, true);
  yol(egri(xB, tr.alt, xC, kord.med), ON, 2.4, true);
  yol([[xC, kord.lat], [xD, kord.lat]], ON, 3.2);
  yol([[xC, kord.med], [xD, kord.med]], ON, 3.2);
  yol(egri(xD, kord.lat, xE, dal.mc), ON, 2.4);
  yol(egri(xD, kord.lat, xM, dal.med), ON, 2.4, true);
  yol(egri(xD, kord.med, xM, dal.med), ON, 2.4, true);
  yol([[xM, dal.med], [xE, dal.med]], ON, 2.6);
  yol(egri(xD, kord.med, xE, dal.uln), ON, 2.4);
  // Kökler ve trunkuslar
  kokY.forEach((ky, i) => yol(egri(xK, ky, xT, i < 2 ? tr.ust : i === 2 ? tr.orta : tr.alt), C.ink, 3));
  for (const ty of Object.values(tr)) yol([[xT, ty], [xB, ty]], C.ink, 3.4);
  ctx.fillStyle = C.ink;
  for (const [x, yy] of [[xT, tr.ust], [xT, tr.orta], [xT, tr.alt], [xB, tr.ust], [xB, tr.orta], [xB, tr.alt]]) { ctx.beginPath(); ctx.arc(x, yy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.font = yazi(15, { w: 600 });
  ctx.textAlign = "right";
  ["C5", "C6", "C7", "C8", "T1"].forEach((t, i) => ctx.fillText(t, xK - 10, kokY[i] + 5));
  ctx.textAlign = "center";
  ctx.font = yazi(12.5, { i: true });
  ctx.fillStyle = C.muted;
  for (const [t, yy] of [["üst", tr.ust], ["orta", tr.orta], ["alt", tr.alt]]) ctx.fillText(t, (xT + xB) / 2, yy - 8);
  for (const [t, yy, r] of [["lateral", kord.lat, ON], ["posterior", kord.arka, ARKA], ["medial", kord.med, ON]]) { ctx.fillStyle = r; ctx.fillText(t, (xC + xD) / 2, yy - 8); }
  ctx.textAlign = "left";
  for (const [ad, kok, yy, r] of [["N. musculocutaneus", "C5-C7", dal.mc, ON], ["N. axillaris", "C5-C6", dal.ax, ARKA], ["N. radialis", "C5-T1", dal.rad, ARKA], ["N. medianus", "C6-T1", dal.med, ON], ["N. ulnaris", "C8-T1", dal.uln, ON]]) {
    ctx.fillStyle = r;
    ctx.beginPath(); ctx.arc(xE, yy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = yazi(14, { w: 600 });
    ctx.fillText(ad, xE + 10, yy + 5);
    ctx.font = yazi(12);
    ctx.fillStyle = C.muted;
    ctx.fillText(kok, xE + 10, yy + 21);
  }
  // Açıklama
  const ay = Y + 226;
  cizgi(ctx, [[180, ay], [208, ay]], { renk: ON, w: 2.6 });
  cizgi(ctx, [[420, ay], [448, ay]], { renk: ARKA, w: 2.6 });
  ctx.font = yazi(13);
  ctx.fillStyle = C.ink;
  ctx.fillText("Ön bölümler ve dalları", 216, ay + 4);
  ctx.fillText("Arka bölümler ve dalları", 456, ay + 4);
  ctx.sekil = null;
  y = sekilYazisi(ctx, "Şekil 4.3", "Plexus brachialis şeması (sağ taraf). Kordlar a. axillaris’e göre konumlarıyla adlandırılır.", ay + 40) + 20;

  y = paragraf(ctx, "Üç trunkusun her biri ön ve arka bölüme ayrılır. Üst ve orta trunkusun ön bölümleri lateral kordu, alt trunkusun ön bölümü medial kordu, üç arka bölüm birlikte posterior kordu yapar. N. medianus lateral ve medial kordlardan gelen iki kökün birleşmesiyle oluşur.", y) + 14;

  const kt = y - 4;
  kutu(ctx, kt, 154, { zemin: "#f8f1f1", serit: ON });
  ctx.fillStyle = ON;
  ctx.font = yazi(17, { aile: "baslik", w: 600 });
  ctx.fillText("Klinik not", 96, kt + 32);
  let yy = paragraf(ctx, "*Üst trunkus yaralanması* (Erb-Duchenne, C5-C6): kol addüksiyon ve iç rotasyonda, önkol ekstansiyon ve pronasyonda kalır; “bahşiş bekleyen garson” duruşu.", kt + 58, { x: 96, w: 610, boy: 15.5, sat: 23 });
  paragraf(ctx, "*Alt trunkus yaralanması* (Klumpke, C8-T1): elin küçük kasları tutulur, pençe el gelişir.", yy + 4, { x: 96, w: 610, boy: 15.5, sat: 23 });
}

// Tablo: sütunlar [{ ad, w }], satırlar ya hücre dizisi ya { grup }
function tablo(ctx, y, sutunlar, satirlar, { boy = 13, sat = 18.5 } = {}) {
  const x0 = 80, W = sutunlar.reduce((t, s) => t + s.w, 0), pad = 7;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x0, y, W, 1.4);
  ctx.font = yazi(10.5, { aile: "etiket", w: 600 });
  ctx.letterSpacing = "1px";
  ctx.fillStyle = C.muted;
  let x = x0;
  for (const s of sutunlar) { ctx.fillText(s.ad.toLocaleUpperCase("tr"), x + pad, y + 22); x += s.w; }
  ctx.letterSpacing = "0px";
  y += 32;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x0, y, W, 0.8);
  for (const r of satirlar) {
    if (r.grup) {
      ctx.fillStyle = "#f8f1f1";
      ctx.fillRect(x0, y + 0.8, W, 28);
      ctx.fillStyle = ON;
      ctx.font = yazi(14, { i: true, w: 600 });
      ctx.fillText(r.grup, x0 + pad, y + 19.5);
      y += 29;
      continue;
    }
    // Hücreleri satırlara böl; satır yüksekliği en uzun hücre
    const hucre = r.map((t, i) => {
      ctx.font = i === 0 ? yazi(boy + 0.5, { w: 600, i: true }) : yazi(boy);
      const satir = [];
      let s = "";
      for (const k of t.split(" ")) {
        const d = s ? s + " " + k : k;
        if (ctx.measureText(d).width > sutunlar[i].w - 2 * pad && s) { satir.push(s); s = k; } else s = d;
      }
      if (s) satir.push(s);
      return { satir, f: ctx.font };
    });
    const h = Math.max(...hucre.map((c) => c.satir.length)) * sat + 16;
    x = x0;
    hucre.forEach((c, i) => {
      ctx.font = c.f;
      ctx.fillStyle = i === 0 ? C.ink : i === 3 ? C.accent : C.ink;
      c.satir.forEach((s, j) => ctx.fillText(s, x + pad, y + 21 + j * sat));
      x += sutunlar[i].w;
    });
    y += h;
    ctx.fillStyle = C.rule;
    ctx.fillRect(x0, y, W, 0.8);
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(x0, y, W, 1.4);
  return y;
}

function anatomi2(ctx) {
  ust(ctx, "Bölüm 4 · Üst ekstremite", 62);
  baslik(ctx, "4.3", "Kolun Kasları", 140);
  let y = paragraf(ctx, "Kol, septa intermuscularia ile ön (fleksör) ve arka (ekstansör) iki bölmeye ayrılır. Ön bölmenin üç kasını n. musculocutaneus, arka bölmenin kaslarını n. radialis innerve eder.", 186) + 10;
  ctx.fillStyle = C.muted;
  ctx.font = yazi(13.5, { w: 600 });
  ctx.fillText("Tablo 4.2", 80, y);
  const tw = ctx.measureText("Tablo 4.2").width;
  ctx.font = yazi(13.5, { i: true });
  ctx.fillText("Kolun kasları: köken, sokulma, innervasyon ve fonksiyon.", 80 + tw + 10, y);
  y = tablo(ctx, y + 14, [{ ad: "Kas", w: 108 }, { ad: "Köken", w: 156 }, { ad: "Sokulma", w: 116 }, { ad: "İnnervasyon", w: 134 }, { ad: "Fonksiyon", w: 126 }], [
    { grup: "Ön bölme" },
    ["M. biceps brachii", "Caput longum: tuberculum supraglenoidale; caput breve: proc. coracoideus", "Tuberositas radii; aponeurosis bicipitalis", "N. musculocutaneus (C5-C6)", "Önkolun supinasyonu ve fleksiyonu; kolun zayıf fleksiyonu"],
    ["M. brachialis", "Humerus ön yüzünün distal yarısı", "Proc. coronoideus ve tuberositas ulnae", "N. musculocutaneus (C5-C6); lateral kısmına n. radialis", "Dirsekte önkolun asıl fleksörü"],
    ["M. coracobrachialis", "Proc. coracoideus", "Humerus cisminin medial yüzü, orta üçte bir", "N. musculocutaneus (C5-C7)", "Kolun fleksiyonu ve addüksiyonu"],
    { grup: "Arka bölme" },
    ["M. triceps brachii", "Caput longum: tuberculum infraglenoidale; caput laterale ve mediale: humerusun arka yüzü", "Olecranon", "N. radialis (C6-C8)", "Önkolun ekstansiyonu; caput longum omuzda ekstansiyon ve addüksiyon"],
    ["M. anconeus", "Epicondylus lateralis humeri", "Olecranonun lateral yüzü, ulnanın arka yüzü", "N. radialis (C7-C8)", "Dirsek ekstansiyonuna yardım"],
  ], { boy: 12.5, sat: 17 }) + 44;

  araBaslik(ctx, "Akılda tutun", y, { renk: ON, boy: 19 });
  y += 36;
  for (const m of [
    "M. biceps brachii önkolun en güçlü supinatörüdür; supinasyon gücü dirsek fleksiyondayken en fazladır.",
    "M. brachialis önkol hangi pozisyonda olursa olsun dirseği büker; asıl fleksör odur.",
    "N. radialis, sulcus n. radialis içinde humerusa yaslanarak ilerler. Humerus cismi kırıklarında yaralanabilir; sonuç düşük el (el bileği düşmesi) olur.",
  ]) {
    ctx.fillStyle = ON;
    ctx.beginPath(); ctx.arc(90, y - 5, 2.6, 0, Math.PI * 2); ctx.fill();
    y = paragraf(ctx, m, y, { x: 104, w: 616, boy: 16, sat: 25 }) + 6;
  }
}

// Sağ dirsek, önden: kemikler krem, kaslar gül tonlarında ve opak (önde olan arkadakini örter).
// Yerel koordinat: x 400 ekseni, y 0 (kesit) ile 640 arası; çağıran ölçekler. Lateral izleyicinin solunda.
function dirsekCiz(ctx) {
  const P = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? (p.length === 4 ? ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]) : ctx.lineTo(p[0], p[1])) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };
  const boya = (zemin, renk = C.kasCizgi, w = 1.3) => { ctx.fillStyle = zemin; ctx.fill(); ctx.strokeStyle = renk; ctx.lineWidth = w; ctx.stroke(); };
  ctx.lineJoin = ctx.lineCap = "round";
  // Kemikler
  P([[388, 0], [388, 250], [386, 312, 356, 340], [344, 352, 352, 366], [362, 380], [376, 398, 394, 386], [402, 380, 410, 392], [424, 402, 438, 388], [446, 374], [468, 362, 460, 346], [422, 318, 414, 250], [414, 0]]);
  boya(C.kemik, C.ink);
  P([[406, 398], [414, 386, 426, 390], [444, 392, 448, 380], [454, 396, 442, 424], [436, 520], [432, 640], [418, 640], [416, 520], [412, 450], [402, 424, 406, 398]]);
  boya(C.kemik, C.ink);
  P([[364, 396], [378, 392, 392, 396], [392, 410], [386, 424], [394, 440, 386, 458], [378, 540], [372, 640], [344, 640], [354, 540], [368, 444], [366, 424], [362, 410]]);
  boya(C.kemik, C.ink);
  // M. brachialis: humerus ön yüzü -> tuberositas ulnae (derinde)
  P([[382, 150], [364, 250, 374, 330], [384, 382, 404, 414], [420, 404], [438, 340, 432, 250], [424, 150]]);
  boya("#d8a6ac");
  // M. brachioradialis: lateral suprakondiler kenar -> radiusun alt ucu (fossanın lateral sınırı)
  P([[386, 210], [380, 280, 372, 330], [364, 420, 360, 520], [356, 640], [342, 640], [326, 520, 330, 440], [334, 330, 386, 210]]);
  boya("#ecd2d4");
  // M. pronator teres: epicondylus medialis -> radius cisminin ortası (fossanın medial sınırı)
  P([[444, 338], [468, 354], [454, 440, 382, 508], [366, 506], [394, 418, 444, 338]]);
  boya("#ecd2d4");
  // M. biceps brachii: karın (üstte kesik), tendon ve aponeurosis bicipitalis
  P([[376, 40], [362, 130, 370, 220], [380, 290, 394, 334], [406, 334], [426, 288, 434, 220], [444, 120, 430, 40]]);
  boya("#e6c1c5");
  ctx.strokeStyle = "rgba(138, 36, 51, .28)";
  ctx.lineWidth = 0.8;
  for (const dx of [-16, -6, 4, 14]) { ctx.beginPath(); ctx.moveTo(403 + dx * 1.2, 50); ctx.quadraticCurveTo(402 + dx * 1.5, 170, 400 + dx * 0.25, 322); ctx.stroke(); }
  P([[394, 334], [392, 400, 384, 438], [392, 442], [400, 400, 406, 334]]);
  boya("#f3ebe1");
  // Aponeurosis: tendondan mediale açılan yelpaze, altındaki pronator teres seçilir
  P([[402, 344], [448, 360], [456, 376], [446, 396], [400, 372]]);
  boya("rgba(243, 235, 225, .78)", C.kasCizgi, 0.9);
  ctx.strokeStyle = "rgba(138, 36, 51, .25)";
  ctx.lineWidth = 0.7;
  for (const [x1, y1] of [[452, 370], [452, 382], [446, 392]]) { ctx.beginPath(); ctx.moveTo(404, 356); ctx.lineTo(x1, y1); ctx.stroke(); }
  // Fossa cubitalis üst sınırı: iki epicondylus arası
  cizgi(ctx, [[348, 356], [464, 352]], { renk: C.ink, w: 1, kesik: [2, 3] });
}

function anatomi3(ctx) {
  ust(ctx, "Bölüm 4 · Üst ekstremite", 63);
  baslik(ctx, "4.4", "Fossa Cubitalis", 140);
  let y = paragraf(ctx, "Dirseğin önündeki üçgen biçimli çukurdur. Kolu önkola bağlayan damar ve sinirler buradan geçer; venöz kan alma ve tansiyon ölçümünde stetoskop bu bölgeye konur.", 186);

  const k = 0.7, oy = y + 20;
  const T = (px, py) => [400 + (px - 400) * k, oy + py * k];
  ctx.save();
  ctx.translate(400, oy);
  ctx.scale(k, k);
  ctx.translate(-400, 0);
  dirsekCiz(ctx);
  ctx.restore();
  // Etiketler: solda sağa, sağda sola dayalı; ince kılavuz çizgisi ve uçta nokta
  ctx.sekil = "Şekil 4.5";
  const etiketle = (metin, sag, ty, px, py) => {
    const [x, yy] = T(px, py), tx = sag ? 512 : 288, ey = oy + ty * k;
    cizgi(ctx, [[sag ? tx - 6 : tx + 6, ey - 4], [x, yy]], { renk: C.muted, w: 0.8 });
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(x, yy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.font = yazi(13.5);
    ctx.textAlign = sag ? "left" : "right";
    ctx.fillText(metin, tx, ey);
    ctx.textAlign = "left";
  };
  for (const [m, ty, px, py] of [["M. biceps brachii", 130, 380, 130], ["Caput radii", 372, 382, 403], ["Tuberositas radii", 422, 388, 446], ["M. brachioradialis", 486, 342, 470], ["Radius", 600, 362, 600]]) etiketle(m, false, ty, px, py);
  for (const [m, ty, px, py] of [["Humerus", 22, 401, 20], ["M. brachialis", 262, 432, 262], ["Epicondylus medialis", 326, 462, 350], ["Aponeurosis bicipitalis", 372, 440, 380], ["M. pronator teres", 440, 418, 440], ["Ulna", 600, 425, 600]]) etiketle(m, true, ty, px, py);
  ctx.sekil = null;
  y = sekilYazisi(ctx, "Şekil 4.5", "Sağ dirsek, önden görünüş. Noktalı çizgi iki epicondylus arasındaki üst sınırdır.", oy + 640 * k + 30) + 20;

  y = paragraf(ctx, "*Sınırlar.* Üstte iki epicondylus arasındaki çizgi, lateralde m. brachioradialis, medialde m. pronator teres. Tabanını m. brachialis ile m. supinator, tavanını fascia ve aponeurosis bicipitalis oluşturur.", y) + 4;
  y = paragraf(ctx, "*İçerik* (lateralden mediale): m. biceps brachii tendonu, a. brachialis ve n. medianus. N. radialis lateral kenarda, m. brachioradialis’in altında kalır.", y) + 16;

  kutu(ctx, y - 4, 50, { zemin: "#f8f1f1", serit: ON });
  paragraf(ctx, "*Akılda tutun:* lateralden mediale TAN, yani Tendon, Arter, Nerv.", y + 25, { x: 96, w: 610, boy: 16, sat: 24 });
}

// ---------- sayfa tablosu ----------
// Her örnek belgenin kendi üç sayfası; belge verisindeki pdf numarası bu listedeki sıradır.
// text: sayfadaki kayıt metinleri, aramaya giden düz metin (çizimden üretilir, elle yazılmaz).

function metinCikar(draw) {
  try {
    const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(4, 4) : document.createElement("canvas");
    const ctx = cv.getContext("2d"), parca = [], sekiller = new Map();
    // Şekil etiketleri (ctx.sekil açıkken) düzyazının ardına "Şekil 4.3: a · b" diye eklenir:
    // arama özeti önce düzyazıdaki eşleşmeyi bulur, etiket yığını cümle gibi görünmez
    ctx.fillText = (t) => {
      t = String(t).trim();
      if (!t) return;
      if (ctx.sekil) { if (!sekiller.has(ctx.sekil)) sekiller.set(ctx.sekil, []); sekiller.get(ctx.sekil).push(t); }
      else parca.push(t);
    };
    draw(ctx);
    const metin = parca.join(" ").replace(/(\p{L})- (\p{Ll})/gu, "$1$2");   // satır sonu hecelemesi birleşir
    return [metin, ...[...sekiller].map(([ad, l]) => `${ad}: ${l.join(" · ")}.`)].join(" ");
  } catch { return ""; }
}
// Satır kırılımları yazı tipine bağlı: yazı tipleri gelince metin bir kez daha çıkarılır
let yaziSurumu = 0;
yaziTipleri.then(() => { yaziSurumu++; });
const sayfa = (draw) => {
  let m = null, surum = -1;
  return { draw, get text() { if (surum !== yaziSurumu) { m = metinCikar(draw); surum = yaziSurumu; } return m; } };
};
const GRUPLAR = {
  kalkulus: [kalkulus1, kalkulus2, kalkulus3].map(sayfa),
  statik: [statik1, statik2, statik3].map(sayfa),
  anatomi: [anatomi1, anatomi2, anatomi3].map(sayfa),
};

// Belgenin örnek sayfaları sırasıyla; her öğe { draw, text }. Tanınmayan belge Kalkülüs'ü alır.
export function ornekSayfalari(belgeId) {
  return GRUPLAR[belgeId] || GRUPLAR.kalkulus;
}

// Geriye uyum: ilk sürümün üç sayfası (Kalkülüs 47, 48 ve Statik Problem 2.7). Kapak, kırpıntı ve
// Tekrar örnekleri bu sıralarla çizer; belge sayfaları ornekSayfalari(belgeId) ile kurulur.
export const PDF_PAGES = [GRUPLAR.kalkulus[0], GRUPLAR.kalkulus[1], GRUPLAR.statik[2]];

// ---------- defter kâğıtları ----------

export const TEMPLATES = [
  { id: "blank", label: "Boş" },
  { id: "lined", label: "Çizgili" },
  { id: "grid", label: "Kareli" },
  { id: "dotted", label: "Noktalı" },
  { id: "cornell", label: "Cornell" },
];

export function drawTemplate(ctx, kind) {
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  ctx.lineWidth = 1;
  if (kind === "lined" || kind === "cornell") {
    ctx.strokeStyle = "rgba(40, 90, 150, .23)";     // beyazda #cdd9e7; saydam: koyu temadaki krem kâğıtta da görünür
    for (let y = 110; y < PH - 40; y += 34) line(kind === "cornell" ? 0 : 0, y, PW, y);
    if (kind === "lined") { ctx.strokeStyle = "rgba(190, 40, 40, .31)"; line(90, 0, 90, PH); }
  }
  if (kind === "grid") {
    ctx.strokeStyle = "rgba(70, 110, 160, .16)";    // beyazda #e0e7ef ile aynı ton
    for (let x = 25; x < PW; x += 25) line(x, 0, x, PH);
    for (let y = 25; y < PH; y += 25) line(0, y, PW, y);
  }
  if (kind === "dotted") {
    ctx.fillStyle = "rgba(50, 80, 115, .35)";
    for (let x = 25; x < PW; x += 25) for (let y = 25; y < PH; y += 25) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
  }
  if (kind === "cornell") {
    ctx.strokeStyle = "#9fb3c8";
    ctx.lineWidth = 1.6;
    line(230, 76, 230, 920);
    line(0, 920, PW, 920);
    line(0, 76, PW, 76);
    ctx.fillStyle = "#8a99a8";
    font(ctx, 12, { weight: 600, family: SANS });
    ctx.fillText("ANAHTAR KELİMELER", 24, 60);
    ctx.fillText("NOTLAR", 254, 60);
    ctx.fillText("ÖZET", 24, 948);
  }
}
