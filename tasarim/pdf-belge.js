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
          sonuc.push({ t: it.str, x: t[4] * s, y: t[5] * s, w: Math.abs(it.width) * gs, boyut: boy * s, eol: !!it.hasEOL,
            dx: t[0] / en, dy: t[1] / en, ux: t[2] / boy, uy: t[3] / boy });
        }
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

export async function pdfBilgi(blob) {
  const pdf = await pdfAc(blob);
  try {
    return { sayfaSayisi: pdf.sayfaSayisi, kapak: await pdf.kapak(360) };
  } finally {
    pdf.kapat();
  }
}
