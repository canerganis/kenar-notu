// Kenar Notu: gerçek PDF dosyası (PDF.js 6.4.299, ../lib içinde yerel).
// Sözleşme OZELLIKLER-3 "pdf-belge.js": pdfAc(blob) ve pdfBilgi(blob).
// Boyutlar PDF puntosu, sayfa sırası 0'dan. Döndürülmüş sayfalarda boyut döndürülmüş hâlidir.

import * as pdfjsLib from "../lib/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../lib/pdf.worker.min.mjs", import.meta.url).href;

const IPTAL = "RenderingCancelledException";

export async function pdfAc(blob) {
  const veri = new Uint8Array(await blob.arrayBuffer());
  const gorev = pdfjsLib.getDocument({ data: veri, isEvalSupported: false, enableXfa: false });
  const doc = await gorev.promise;
  const n = doc.numPages;

  // Sayfa nesneleri tembel alınır; ilk sayfanın boyutu hemen, kalanlar arka planda
  const sayfalar = new Map();
  const sayfa = (i) => {
    if (!sayfalar.has(i)) sayfalar.set(i, doc.getPage(i + 1).catch((e) => { sayfalar.delete(i); throw e; }));
    return sayfalar.get(i);
  };
  const boyutlar = new Array(n).fill(null);
  const olc = (p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; };
  boyutlar[0] = olc(await sayfa(0));
  let kapali = false;

  // Kalan boyutlar: sekizerli gruplar halinde; bitince boyutlarHazir çözülür
  const boyutlarHazir = (async () => {
    for (let i = 1; i < n && !kapali; i += 8) {
      const grup = [];
      for (let j = i; j < Math.min(n, i + 8); j++) grup.push(sayfa(j).then((p) => { boyutlar[j] = olc(p); }, () => {}));
      await Promise.all(grup);
    }
    return !kapali;
  })();

  const gorevler = new WeakMap();   // canvas -> { no, task }
  const metinler = new Map();       // i -> Promise<satırlar>

  // Sayfanın metin parçaları sayfa biriminde (genişlik 800, y aşağı, y taban çizgisi).
  // dx, dy: metnin ilerleme yönü; ux, uy: harfin yukarı yönü (birim vektör; döndürülmüş sayfada dikeydir)
  function satirlar(i) {
    if (!metinler.has(i)) {
      metinler.set(i, (async () => {
        const p = await sayfa(i);
        // it.width sayfa biriminde; viewport ise /UserUnit ile büyür, genişlik de o çarpanı almalı
        const vp = p.getViewport({ scale: 1 }), s = 800 / vp.width, gs = s * (vp.userUnit || 1);
        const tc = await p.getTextContent();
        const sonuc = [];
        for (const it of tc.items) {
          if (!it.str) { if (it.hasEOL && sonuc.length) sonuc[sonuc.length - 1].eol = true; continue; }
          const t = pdfjsLib.Util.transform(vp.transform, it.transform);
          const boy = Math.hypot(t[2], t[3]) || 1, en = Math.hypot(t[0], t[1]) || 1;
          // asc: yazı tipinin taban üstü payı (PDF.js metin katmanıyla aynı kural); metinKutulari için
          const st = tc.styles?.[it.fontName] || {};
          const asc = st.ascent ? st.ascent : st.descent ? 1 + st.descent : 0.8;
          sonuc.push({ t: it.str, x: t[4] * s, y: t[5] * s, w: Math.abs(it.width) * gs, boyut: boy * s, eol: !!it.hasEOL,
            dx: t[0] / en, dy: t[1] / en, ux: t[2] / boy, uy: t[3] / boy, asc });
        }
        sonuc.oran = vp.height / vp.width;
        return sonuc;
      })().catch((e) => { metinler.delete(i); throw e; }));
    }
    return metinler.get(i);
  }

  const pdf = {
    sayfaSayisi: n,
    boyutlarHazir,
    // Bilinmeyen boyut: ilk sayfanınki (çoğu belgede hepsi aynı)
    boyut: (i) => boyutlar[i] || boyutlar[0],

    // olcek: PDF puntosu başına piksel. Tuval bu boyuta getirilir ve beyaz zemine çizilir.
    // Aynı tuval için yeni çağrı öncekini iptal eder. Bitince true, iptalde false döner.
    // arka: ekranda olmayan iş (kapak). PDF.js "print" amacıyla requestAnimationFrame beklemez; sekme arkadayken de biter.
    // bekle(): true döndükçe süren çizim dilimler arasında durur (kalem yazarken ana iş parçacığı boş kalsın)
    async ciz(i, canvas, olcek, { arka = false, bekle = null } = {}) {
      const eski = gorevler.get(canvas);
      const kayit = { no: (eski?.no || 0) + 1, task: null };
      eski?.task?.cancel();
      gorevler.set(canvas, kayit);
      let p;
      try { p = await sayfa(i); } catch { return false; }
      if (gorevler.get(canvas) !== kayit || kapali) return false;
      const vp = p.getViewport({ scale: olcek });
      const w = Math.max(1, Math.round(vp.width)), hh = Math.max(1, Math.round(vp.height));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== hh) canvas.height = hh;
      const ctx = canvas.getContext("2d", { alpha: false });
      // Yuvarlama payı: viewport tuvali tam doldursun
      const donusum = [w / vp.width, 0, 0, hh / vp.height, 0, 0];
      kayit.task = p.render({ canvas, canvasContext: ctx, viewport: vp, transform: donusum, background: "#ffffff", ...(arka ? { intent: "print" } : {}) });
      if (bekle) {
        kayit.task.onContinue = (devam) => {
          if (!bekle()) return devam();
          const bak = () => (gorevler.get(canvas) !== kayit ? devam() : bekle() ? setTimeout(bak, 80) : devam());
          setTimeout(bak, 80);
        };
      }
      try {
        await kayit.task.promise;
        return gorevler.get(canvas) === kayit;
      } catch (e) {
        if (e?.name === IPTAL) return false;
        console.warn("[pdf-belge] çizim:", e);
        return false;
      } finally {
        if (gorevler.get(canvas) === kayit) gorevler.delete(canvas);
      }
    },
    // Süren çizimi bırakır (sayfa ekrandan çıktı)
    iptal(canvas) {
      const g = gorevler.get(canvas);
      if (g) { g.task?.cancel(); gorevler.delete(canvas); }
    },
    // Uzaktaki sayfanın PDF.js önbelleğini boşaltır (bellek)
    birak(i) {
      const s = sayfalar.get(i);
      if (s) s.then((p) => { try { p.cleanup(); } catch { /* çizim sürüyorsa kalır */ } }, () => {});
    },

    async metin(i) {
      try {
        const r = await satirlar(i);
        // PDF.js kelimeyi yazı tipi değişiminde böler ("Ke" + "nar"): aynı satırda bitişen parçalar boşluksuz birleşir
        let m = "";
        r.forEach((x, k) => {
          m += x.t;
          if (x.eol) { m += "\n"; return; }
          const y = r[k + 1];
          if (!y || /\s$/.test(x.t) || /^\s/.test(y.t)) return;
          const bx = x.x + x.w * x.dx, by = x.y + x.w * x.dy;
          const ileri = (y.x - bx) * x.dx + (y.y - by) * x.dy, yan = (y.x - bx) * x.ux + (y.y - by) * x.uy;
          const bitisik = Math.abs(yan) < x.boyut * 0.5 && ileri > -x.boyut * 0.3 && ileri < x.boyut * 0.12;
          if (!bitisik) m += " ";
        });
        return m.replace(/[ \t]+\n/g, "\n").trim();
      } catch { return ""; }
    },
    satirlar,

    // Metin parçalarının kutuları: [{ str, x, y, w, h }], sayfaya göre 0..1 oransal, y aşağı (OZELLIKLER-5).
    // Kutu PDF.js metin katmanı gibi: tabandan asc kadar yukarı, yazı boyu kadar yüksek; döndürülmüş metinde
    // eksene hizalı dış kutu. kelime: true ise parçalar kelimelere bölünür (genişlik harf ölçüsüyle orantılanır).
    async metinKutulari(i, { kelime = false } = {}) {
      let r;
      try { r = await satirlar(i); } catch { return []; }
      const W = 800, H = 800 * (r.oran || 1);
      const kutu = (x, y, w, boyut, it) => {
        const ax = it.ux * boyut * it.asc, ay = it.uy * boyut * it.asc;              // tabandan üste
        const bx = -it.ux * boyut * (1 - it.asc), by = -it.uy * boyut * (1 - it.asc); // tabandan alta
        const ex = it.dx * w, ey = it.dy * w;
        const xs = [x + ax, x + bx, x + ax + ex, x + bx + ex], ys = [y + ay, y + by, y + ay + ey, y + by + ey];
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        return { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H };
      };
      const sonuc = [];
      for (const it of r) {
        if (!it.t.trim()) continue;
        if (!kelime || !/\s/.test(it.t.trim())) { sonuc.push({ str: it.t, ...kutu(it.x, it.y, it.w, it.boyut, it) }); continue; }
        // Kelimelere bölme: her kelimenin başı, önündeki metnin ölçülen eniyle orantılı
        const olc = metinOlcer(), tum = olc(it.t) || it.t.length;
        let bas = 0;
        for (const p of it.t.split(/(\s+)/)) {
          if (p && !/^\s+$/.test(p)) {
            const o0 = (olc(it.t.slice(0, bas)) / tum) * it.w, o1 = (olc(it.t.slice(0, bas + p.length)) / tum) * it.w;
            sonuc.push({ str: p, ...kutu(it.x + it.dx * o0, it.y + it.dy * o0, o1 - o0, it.boyut, it) });
          }
          bas += p.length;
        }
      }
      return sonuc;
    },

    async kapak(genislik = 360) {
      const b = boyutlar[0], cv = document.createElement("canvas");
      const tamam = await pdf.ciz(0, cv, genislik / b.w, { arka: true });
      if (!tamam) return null;
      const url = cv.toDataURL("image/jpeg", 0.84);
      cv.width = cv.height = 0;
      return url;
    },

    kapat() {
      if (kapali) return;
      kapali = true;
      try { doc.destroy(); } catch { /* boş */ }
    },
  };
  return pdf;
}

// Kelime genişliği oranı için ölçer (yazı tipi bilinmez; düz sans-serif oranları yeter)
let olcerBaglam = null;
function metinOlcer() {
  if (!olcerBaglam) {
    const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    olcerBaglam = cv.getContext("2d");
    olcerBaglam.font = "100px sans-serif";
  }
  return (m) => (m ? olcerBaglam.measureText(m).width : 0);
}

export async function pdfBilgi(blob) {
  const pdf = await pdfAc(blob);
  try {
    return { sayfaSayisi: pdf.sayfaSayisi, kapak: await pdf.kapak(360) };
  } finally {
    pdf.kapat();
  }
}
