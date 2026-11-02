// Kenar Notu 7.0: PDF sayfa eşlemesi (TASARIM-5 11.4 M5). Masa paketinin dosyası.
//
// Özgün PDF dosyası hiç değişmez. Sayfa işlemleri belge.veri.sayfalar dizisinde tutulur; her PDF sayfası:
//   { tur: "pdf", pdf: <kaynak dosyadaki sıra, 0'dan>, don?: 0 | 90 | 180 | 270, kaynak?: "ek:<ad>" }
//   - Sıra: dizinin sırası (sürükleyip sıralama, silme dizide olur; silinen sayfa diziden çıkar).
//   - don: kullanıcının saat yönünde döndürmesi (sayfanın kendi /Rotate değerine eklenir). Çizgiler sayfayla döner:
//     koordinatlar her zaman ekranda görünen (döndürülmüş) sayfanın biriminde (genişlik 800, y aşağı).
//   - kaynak: başka bir PDF'ten birleştirilmiş sayfa. Dosyası belgenin ek dosyasıdır: kayit.js ekDosyaGetir(belgeId, ad).
//     kaynak yoksa belgenin kendi dosyası (kayit.js dosyaGetir(belgeId)).
// Arama, dışa aktarma ve küçük resim bu eşlemeyi okur: sayfanın görünen sırası = veri.sayfalar içindeki sıra
// (araya eklenen defter sayfaları { tur: "kagit" } da sayılır).
//
// pdfYonlendirici(ana, belgeId): duzenleyici'nin bütün PDF işlerini sayfa verisiyle (v) yapan sarmalayıcı.
// Ek kaynaklar yüklenmeden önce ilgili sayfa ana belgenin ilk sayfa boyutuyla yer tutar.

import { pdfAc, parolaAl } from "./pdf-belge.js";

export const donus = (v) => ((Math.round((+v?.don || 0) / 90) * 90) % 360 + 360) % 360;
export const ekKaynakAdi = (v) => (typeof v?.kaynak === "string" && v.kaynak.startsWith("ek:") ? v.kaynak.slice(3) : null);

// Döndürme: sayfa birimindeki nokta, eski (W=800, H) sayfadan saat yönünde 90 derece döndürülmüş sayfaya.
// Yeni sayfanın genişliği eski yükseklik; 800 birime ölçeklenir (s = 800 / H). Kalınlıklar da s ile ölçeklenir.
export function noktaDondur90(q, H) {
  const s = 800 / H;
  return [Math.round((H - q[1]) * s * 100) / 100, Math.round(q[0] * s * 100) / 100, ...q.slice(2)];
}

export function pdfYonlendirici(ana, belgeId) {
  const kaynaklar = new Map();   // ad -> pdf (yüklenen) | Promise
  const al = (v) => { const ad = ekKaynakAdi(v); if (!ad) return ana; const k = kaynaklar.get(ad); return k && !(k instanceof Promise) ? k : null; };
  const P = {
    ana,
    al,
    hazirMi: (v) => !!al(v),
    // Ek kaynak PDF'leri yükler (açılışta ve birleştirmeden sonra). Yüklenemeyen kaynak boş sayfa olarak kalır.
    async kaynaklariYukle(sayfalar) {
      const adlar = [...new Set((sayfalar || []).map(ekKaynakAdi).filter(Boolean))].filter((a) => !kaynaklar.has(a));
      if (!adlar.length) return false;
      const { ekDosyaGetir } = await import("./kayit.js");
      await Promise.all(adlar.map((ad) => {
        const soz = (async () => {
          const blob = await ekDosyaGetir(belgeId, ad);
          if (!blob) throw new Error("ek PDF yok: " + ad);
          const pdf = await pdfAc(blob, { parola: parolaAl(belgeId + "|" + ad) });
          await pdf.boyutlarHazir;
          kaynaklar.set(ad, pdf);
        })().catch((e) => { console.warn("[pdf-sayfa] kaynak:", e); kaynaklar.delete(ad); });
        kaynaklar.set(ad, soz);
        return soz;
      }));
      return true;
    },
    kaynakEkle(ad, pdf) { kaynaklar.set(ad, pdf); },
    boyut(v) {
      const p = al(v);
      if (!p) { const b = ana.boyut(0); return donus(v) % 180 ? { w: b.h, h: b.w } : b; }
      return p.boyut(v.pdf, donus(v));
    },
    ciz(v, canvas, olcek, o = {}) { const p = al(v); return p ? p.ciz(v.pdf, canvas, olcek, { ...o, don: donus(v) }) : Promise.resolve(false); },
    iptal(canvas) { ana.iptal(canvas); for (const k of kaynaklar.values()) if (!(k instanceof Promise)) k.iptal(canvas); },
    birak(v) { al(v)?.birak(v.pdf); },
    satirlar(v) { const p = al(v); return p ? p.satirlar(v.pdf, donus(v)) : Promise.resolve([]); },
    metin(v) { const p = al(v); return p ? p.metin(v.pdf) : Promise.resolve(""); },
    metinKutulari(v, o = {}) { const p = al(v); return p ? p.metinKutulari(v.pdf, { ...o, don: donus(v) }) : Promise.resolve([]); },
    baglantilar(v) { const p = al(v); return p && typeof p.baglantilar === "function" ? p.baglantilar(v.pdf, donus(v)) : Promise.resolve([]); },
    notlar(v) { const p = al(v); return p && typeof p.notlar === "function" ? p.notlar(v.pdf, donus(v)) : Promise.resolve([]); },
    kapat() { for (const k of kaynaklar.values()) if (!(k instanceof Promise)) { try { k.kapat(); } catch { /* boş */ } } kaynaklar.clear(); },
  };
  return P;
}
