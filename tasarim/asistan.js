// Asistan: yapay zekâ paneli (OZELLIKLER-2 §5, TASARIM-2 §7).
// İki yol aynı paneli kullanır: "hesap" soruyu kullanıcının açık ChatGPT/Gemini/Claude uygulamasına götürür,
// "anahtar" cevabı kullanıcının kendi anahtarıyla burada akıtır (Deneme sağlayıcısı çevrimdışı, hazır cevaplıdır).
// Anahtar hiçbir yerde loglanmaz: bu dosyada console çağrısı yok, hata metinlerine istek başlığı girmez.
import { h, icon, bus, store, toast, ayarla, kartEkle, panoyaYaz, belgeBul, YZ_UYGULAMALAR, YZ_SAGLAYICILAR } from "./ortak.js";
import * as SAYFALAR from "./sayfalar.js";
import { formulleriCiz } from "./matematik.js";
import { webAraDugmeleri } from "./iz-bag.js";
import { t, yerel, ingilizceMi } from "./dil.js";

/* ================= Sabitler ================= */
// Üçüncü öğe yapay zekâya giden istemdir; o da arayüz diliyle gider
const HAZIR_METIN = [
  ["acikla", t("Açıkla"), t("Bunu açıkla.")],
  ["ozetle", t("Özetle"), t("Bunu kısaca özetle.")],
  ["basitlestir", t("Basitleştir"), t("Bunu daha basit anlat, konuya yeni başlıyormuşum gibi.")],
  ["ornek", t("Örnek ver"), t("Bununla ilgili somut bir örnek ver.")],
  ["soru-uret", t("Soru üret"), t("Bu konudan kendimi sınamam için üç soru üret, cevapları en sonda olsun.")],
];
const HAZIR_GORSEL = [
  ["formul", t("Bu formülü açıkla"), t("Bu formülü açıkla: her terim ne anlama geliyor?")],
  ["coz", t("Bu soruyu çöz"), t("Bu soruyu çöz.")],
  ["adim", t("Adım adım göster"), t("Adım adım göster, her adımın gerekçesini yaz.")],
  ["ozetle", t("Özetle"), t("Bu bölgedekileri kısaca özetle.")],
];
const HAZIR_ANLAM = ["anlam", t("Anlamı"), t("Bu kelimenin bu bağlamdaki anlamını bir iki cümleyle ver; kökeni biliniyorsa kısaca ekle.")];
const hazirBul = (id, gorsel) =>
  (gorsel ? HAZIR_GORSEL : HAZIR_METIN).find((x) => x[0] === id) ||
  [...HAZIR_METIN, ...HAZIR_GORSEL, HAZIR_ANLAM].find((x) => x[0] === id) || null;

// Uygulama adının ünlü uyumu: ChatGPT'de, Gemini'de, Claude'da
const EK = { chatgpt: "'de", gemini: "'de", claude: "'da" };
// "{yer}" yer tutucusu: Türkçede "ChatGPT'de", İngilizcede yalnız ad ("in ChatGPT" cümlenin kendisinde)
const uygulamada = (u) => (ingilizceMi ? u.ad : `${u.ad}${EK[u.id] || "'de"}`);
const MONOGRAM = { chatgpt: "Ch", gemini: "Ge", claude: "Cl" };
const buyuk = (s) => s.toLocaleUpperCase(yerel);

// eylem Türkçe kimlik olarak kalır (karşılaştırma buna bakar), ekranda t() ile yazılır
const HATALAR = {
  anahtar: { lamba: "hata", metin: t("Anahtar kabul edilmedi. Ayarlar'dan kontrol et."), eylem: "Ayarları aç" },
  model: { lamba: "hata", metin: t("Model adını Ayarlar'dan kontrol et."), eylem: "Ayarları aç" },
  istek: { lamba: "hata", metin: t("Sağlayıcı isteği kabul etmedi. Model adını ve ayarları kontrol et."), eylem: "Ayarları aç" },
  sinir: { lamba: "denenmedi", metin: t("Sağlayıcının sınırına ulaşıldı. Biraz sonra yeniden dene."), eylem: "Yeniden dene" },
  sunucu: { lamba: "denenmedi", metin: t("Sağlayıcı şu an cevap veremiyor. Biraz sonra yeniden dene."), eylem: "Yeniden dene" },
  ag: { lamba: "", metin: t("Şu an bağlantı yok. Bağlantı gelince yeniden dene; okuma, yazma ve arama internetsiz çalışır."), eylem: "Yeniden dene" },
  zaman: { lamba: "denenmedi", metin: t("Sağlayıcı 60 saniyedir cevap vermiyor. Bağlantını kontrol edip yeniden dene."), eylem: "Yeniden dene" },
  ret: { lamba: null, metin: t("Bu soruya cevap verilemedi."), eylem: "Soruyu değiştir" },
};

class AsistanHatasi extends Error {
  constructor(tur, kod = "") { super(tur); this.name = "AsistanHatasi"; this.tur = tur; this.kod = kod; }
}

/* ================= Durum ================= */
const S = {
  kuruldu: false, acik: false,
  kaynak: {},          // son "sor" yükü: { metin, gorsel, belgeId, belgeAd, sayfa, kaynak }
  dosya: null,         // görselin File hali (paylaş menüsü için, önceden hazırlanır)
  turlar: [],          // { soru, istem, gorsel, hazir, cevap, durum, saglayici, model, ... }
  hazir: null,         // basılı hazır tuş
  durum: "hazir",      // "hazir" | "anahtarsiz" | "bekleme"
  iptal: null,         // akan isteğin AbortController'ı
  izDurum: "bekliyor",
  pulHata: null,       // son hatanın pul lambası
  bekleme: null,       // hesap yolu: { metin, uygulama, vurgulandi }
  bekleyenSoru: null,  // anahtar girilince sorulacak
  dogrulandi: new Set(),  // bu oturumda çalıştığı görülen sağlayıcılar
  reddedildi: new Set(),  // anahtarı ya da modeli reddedilenler (kayıtlı "bağlı" bilgisini geçersiz kılar)
  oncekiOdak: null,
};
let P = null; // panel parçaları

const yz = () => store.ayarlar.yz || {};
const yol = () => (yz().yol === "anahtar" ? "anahtar" : "hesap");
const uygulama = () => YZ_UYGULAMALAR.find((u) => u.id === yz().uygulama) || YZ_UYGULAMALAR[0];
function saglayici(id = yz().saglayici) {
  const s = YZ_SAGLAYICILAR.find((x) => x.id === id) || YZ_SAGLAYICILAR[0];
  const model = String(yz().modeller?.[s.id] || s.varsayilanModel).trim().replace(/^models\//, "");
  return { ...s, model, anahtar: String(yz().anahtarlar?.[s.id] || "").trim() };
}

/* ================= Osiloskop izi (TASARIM-2 §2.6) ================= */
export function izOlustur() {
  const tepe = "M0 8Q12.5 2 25 8" + Array.from({ length: 15 }, (_, i) => `T${50 + i * 25} 8`).join("");
  const el = h("div", { class: "iz", "aria-hidden": "true", dataset: { durum: "bekliyor" } });
  el.innerHTML = `<i><svg viewBox="0 0 400 16" preserveAspectRatio="none"><path class="iz-golge" d="${tepe}"/><path class="iz-cizgi" d="${tepe}"/></svg></i><span class="iz-not"></span>`;
  return el;
}
function izAyarla(d, not) {
  S.izDurum = d;
  if (not !== undefined) P.izNot.textContent = not;
  izCiz();
}
// Sekme gizliyken ya da panel kapalıyken iz akmaz
function izCiz() {
  const canli = S.izDurum === "akiyor" || S.izDurum === "dusunuyor";
  P.iz.dataset.durum = canli && (document.hidden || !S.acik) ? "bekliyor" : S.izDurum;
}

/* ================= Yardımcılar ================= */
const bekle = (ms, signal) => new Promise((coz, red) => {
  if (signal?.aborted) return red(new DOMException("Durduruldu", "AbortError"));
  const z = setTimeout(coz, ms);
  signal?.addEventListener("abort", () => { clearTimeout(z); red(new DOMException("Durduruldu", "AbortError")); }, { once: true });
});
const mimeOf = (url) => (String(url).match(/^data:([^;,]+)/) || [])[1] || "image/png";
const base64Of = (url) => String(url).slice(String(url).indexOf(",") + 1);
function dataUrlDosya(url, ad = "kenar-notu-kirpinti.png") {
  try {
    const ikili = atob(base64Of(url));
    const dizi = new Uint8Array(ikili.length);
    for (let i = 0; i < ikili.length; i++) dizi[i] = ikili.charCodeAt(i);
    return new File([dizi], ad, { type: mimeOf(url) });
  } catch { return null; }
}
function indir(dosya) {
  const url = URL.createObjectURL(dosya);
  h("a", { href: url, download: dosya.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const kelimeSay = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const sayiTr = (n, k = 1) => n.toLocaleString(yerel, { maximumFractionDigits: k, minimumFractionDigits: k });
const saatTr = (z = new Date()) => z.toLocaleTimeString(yerel, { hour: "2-digit", minute: "2-digit" });
const tarihTr = (z = new Date()) => z.toLocaleDateString(yerel, { day: "2-digit", month: "2-digit", year: "numeric" });
const kaynakSatiri = (k) => [k.belgeAd, k.sayfa ? t("s. {n}", { n: k.sayfa }) : ""].filter(Boolean).join(" · ");

/* ================= Cevap biçimi: paragraf, liste, $...$ ================= */
const kacis = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LATEX = {
  "\\cdot": "·", "\\times": "×", "\\div": "÷", "\\pm": "±", "\\mp": "∓", "\\to": "→", "\\rightarrow": "→", "\\Rightarrow": "⇒",
  "\\iff": "⇔", "\\infty": "∞", "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥", "\\neq": "≠", "\\ne": "≠", "\\approx": "≈",
  "\\equiv": "≡", "\\pi": "π", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\Delta": "Δ", "\\theta": "θ",
  "\\lambda": "λ", "\\mu": "μ", "\\sigma": "σ", "\\Sigma": "Σ", "\\omega": "ω", "\\Omega": "Ω", "\\epsilon": "ε", "\\varepsilon": "ε",
  "\\rho": "ρ", "\\phi": "φ", "\\varphi": "φ", "\\tau": "τ", "\\eta": "η", "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\oint": "∮",
  "\\partial": "∂", "\\nabla": "∇", "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\cup": "∪", "\\cap": "∩", "\\forall": "∀",
  "\\exists": "∃", "\\circ": "∘", "\\degree": "°", "\\cdots": "⋯", "\\ldots": "…", "\\dots": "…", "\\prime": "′",
  "\\lim": "lim", "\\sin": "sin", "\\cos": "cos", "\\tan": "tan", "\\cot": "cot", "\\ln": "ln", "\\log": "log", "\\exp": "exp",
  "\\max": "max", "\\min": "min", "\\left": "", "\\right": "", "\\quad": " ", "\\qquad": "  ", "\\displaystyle": "",
};
const paren = (x) => (/^[\w.,′'√πα-ωΑ-Ω]+$/u.test(x.trim()) ? x.trim() : `(${x.trim()})`);
function formul(ic) {
  let s = ic.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002");
  s = s.replace(/\\mathbb\{(\w)\}/g, (_, c) => ({ R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" })[c] || c);
  // İç içe ifadeler içten dışa: önce kök, sonra kesir
  for (let i = 0; i < 4; i++) {
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, a) => `√${paren(a)}`)
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => `${paren(a)}/${paren(b)}`);
  }
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\[,;:!]/g, " ").replace(/\\[A-Za-z]+/g, (m) => LATEX[m] ?? m.slice(1));
  s = kacis(s.replace(/-/g, "−")); // matematikte kısa çizgi eksidir
  s = s.replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9+\-−′'∞])/g, (_, a, b) => `<sup>${a ?? b}</sup>`);
  s = s.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_, a, b) => `<sub>${a ?? b}</sub>`);
  s = s.replace(/[{}]/g, "").replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  // Değişkenler italik kalır; rakamlar, parantezler ve işleçler dik yazılır (etiketlerin dışında)
  s = s.split(/(<[^>]+>|&[a-z]+;)/).map((p, i) => (i % 2 ? p : p.replace(/[0-9]+(?:[.,][0-9]+)?|[()[\]=+−±∓·×÷<>≤≥≠≈→⇒∞∑∏∫√]+/g, (m) => `<span class="dik">${m}</span>`))).join("");
  return `<i class="formul">${s}</i>`;
}
// Gerçek formülü matematik.js çizer (Temml, cevapCiz'den sonra); yüklenene kadar ya da TeX hatalıysa bu yedek yazı kalır
const formulYeri = (tex, blok) => `<span data-tex="${kacis(tex.trim())}"${blok ? " data-blok" : ""}>${formul(tex)}</span>`;
const metinIci = (t) => kacis(t)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/`([^`]+)`/g, "<code>$1</code>");
function satirIci(s) {
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+?)\$|\\\((.+?)\\\)/g;
  let son = 0, out = "", m;
  while ((m = re.exec(s))) {
    if (m[2] != null && /^\s|\s$/.test(m[2])) { re.lastIndex = m.index + 1; continue; } // "$5 ve $6" para birimi
    out += metinIci(s.slice(son, m.index)) + formulYeri(m[1] ?? m[2] ?? m[3], m[1] != null);
    son = re.lastIndex;
  }
  return out + metinIci(s.slice(son));
}
function cevapHtml(metin) {
  const duz = metin.replace(/\r/g, "")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, a) => "$$" + a.replace(/\n/g, " ") + "$$")
    .replace(/\$\$\s*\n([\s\S]*?)\n\s*\$\$/g, (_, a) => "$$" + a.replace(/\n/g, " ") + "$$");
  let html = "", liste = null;
  const listeKapat = () => { if (liste) { html += `</${liste}>`; liste = null; } };
  for (const ham of duz.split("\n")) {
    const s = ham.trim();
    if (!s) { listeKapat(); continue; }
    let m;
    if ((m = s.match(/^(\d+)[.)]\s+(.*)$/))) {
      if (liste !== "ol") { listeKapat(); html += m[1] !== "1" ? `<ol start="${+m[1]}">` : "<ol>"; liste = "ol"; }
      html += `<li>${satirIci(m[2])}</li>`;
      continue;
    }
    if ((m = s.match(/^[-*•]\s+(.*)$/))) {
      if (liste !== "ul") { listeKapat(); html += "<ul>"; liste = "ul"; }
      html += `<li>${satirIci(m[1])}</li>`;
      continue;
    }
    listeKapat();
    const baslik = s.match(/^#{1,6}\s+(.*)$/);
    html += baslik ? `<p><b>${satirIci(baslik[1])}</b></p>` : `<p>${satirIci(s)}</p>`;
  }
  listeKapat();
  return html;
}
const duzMetin = (t) => t.replace(/\$\$?|\\\(|\\\)|\*\*/g, "");

/* ================= Akış (SSE) ayrıştırıcı ================= */
function blokCoz(blok) {
  let olay = "message";
  const veri = [];
  for (const satir of blok.split(/\r?\n/)) {
    if (!satir || satir.startsWith(":")) continue;
    const k = satir.indexOf(":");
    const ad = k < 0 ? satir : satir.slice(0, k);
    let d = k < 0 ? "" : satir.slice(k + 1);
    if (d.startsWith(" ")) d = d.slice(1);
    if (ad === "event") olay = d;
    else if (ad === "data") veri.push(d);
  }
  if (!veri.length) return null;
  const ham = veri.join("\n");
  if (ham === "[DONE]") return { bitti: true };   // OpenAI bitiş işareti: bağlantı açık kalsa da akış biter
  let json = null;
  try { json = JSON.parse(ham); } catch { json = null; }
  return { olay, json };
}
async function* sseOku(res) {
  const okuyucu = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const sure = zamanlar.get(res);
  let tampon = "";
  try {
    for (;;) {
      let parca;
      try { parca = await okuyucu.read(); } catch (e) {
        if (sure?.doldu()) throw new AsistanHatasi("zaman", t("60 SN · ZAMAN AŞIMI"));
        throw e;
      }
      const { value, done } = parca;
      if (done) break;
      sure?.yenile();
      tampon += value;
      let m;
      while ((m = tampon.match(/\r?\n\r?\n/))) {
        const olay = blokCoz(tampon.slice(0, m.index));
        tampon = tampon.slice(m.index + m[0].length);
        if (olay?.bitti) return;
        if (olay) yield olay;
      }
    }
    const son = tampon.trim() && blokCoz(tampon);
    if (son && !son.bitti) yield son;
  } finally {
    sure?.birak();
    okuyucu.cancel().catch(() => {});
  }
}

/* ================= HTTP ve hata eşleme ================= */
function httpHatasi(durum, govde) {
  if (durum === 401 || durum === 403) return new AsistanHatasi("anahtar", t("{d} · ANAHTAR", { d: durum }));
  if (durum === 404) return new AsistanHatasi("model", "404 · MODEL");
  if (durum === 429) return new AsistanHatasi("sinir", t("429 · SINIR"));
  if (durum === 400 && /API_KEY_INVALID|api[ _-]?key|authentication/i.test(govde)) return new AsistanHatasi("anahtar", t("400 · ANAHTAR"));
  if (durum === 400 && /model/i.test(govde) && /not found|not exist|invalid|unknown|unsupported/i.test(govde)) return new AsistanHatasi("model", "400 · MODEL");
  if (durum === 400) return new AsistanHatasi("istek", t("400 · İSTEK"));
  if (durum === 529 || durum === 503) return new AsistanHatasi("sunucu", t("{d} · YOĞUN", { d: durum }));
  return new AsistanHatasi("sunucu", t("{d} · SUNUCU", { d: durum }));
}
// Akış içinde gelen hata nesnesi (Claude "error" olayı, OpenAI "error" / "response.failed")
function akisHatasi(tip = "", kod = "") {
  const s = `${tip} ${kod}`;
  if (/authentication|permission|invalid_api_key/i.test(s)) return new AsistanHatasi("anahtar", t("401 · ANAHTAR"));
  if (/not_found|model_not_found/i.test(s)) return new AsistanHatasi("model", "404 · MODEL");
  if (/rate_limit|quota|429/i.test(s)) return new AsistanHatasi("sinir", t("429 · SINIR"));
  if (/overloaded|529|503/i.test(s)) return new AsistanHatasi("sunucu", t("529 · YOĞUN"));
  return new AsistanHatasi("sunucu", t("AKIŞ · HATA"));
}
// Sağlayıcı 60 sn ses vermezse istek kesilir: cevap başlamadan önce ve akış sırasında (her parça süreyi yeniler).
// Kullanıcının durdurması (dış signal) AbortError olarak kalır ve sessizce biter; zaman aşımı kendi hatasıdır.
const ZAMAN_ASIMI = 60_000;
async function istekAt(url, secenek) {
  if (navigator.onLine === false) throw new AsistanHatasi("ag", t("AĞ YOK"));
  const dis = secenek.signal;
  if (dis?.aborted) throw new DOMException("Durduruldu", "AbortError");
  const denetci = new AbortController();
  let doldu = false, z = 0;
  const sure = { yenile() { clearTimeout(z); z = setTimeout(() => { doldu = true; denetci.abort(); }, ZAMAN_ASIMI); }, birak() { clearTimeout(z); }, doldu: () => doldu };
  dis?.addEventListener("abort", () => { sure.birak(); denetci.abort(); }, { once: true });
  sure.yenile();
  let res;
  try { res = await fetch(url, { ...secenek, signal: denetci.signal }); } catch (e) {
    sure.birak();
    if (doldu) throw new AsistanHatasi("zaman", t("60 SN · ZAMAN AŞIMI"));
    if (e.name === "AbortError") throw e;
    throw new AsistanHatasi("ag", t("AĞ YOK"));
  }
  if (!res.ok) {
    let govde = "";
    try { govde = await res.text(); } catch { govde = ""; }
    sure.birak();
    throw httpHatasi(res.status, govde);
  }
  // Akışı okuyan (sseOku) süreyi her parçada yeniler ve bitince bırakır
  if (res.body) zamanlar.set(res, sure);
  else sure.birak();
  return res;
}
const zamanlar = new WeakMap();   // Response -> süre (istekAt)

/* ================= Sağlayıcı adaptörleri =================
   Her biri: async (istek, yaz) => void. istek: { sistem, mesajlar: [{ rol, metin, gorsel? }], model, anahtar, signal, ... }
   yaz(parca) her metin parçasında çağrılır. Hata AsistanHatasi olarak fırlar; iptal AbortError olarak. */
const ADAPTORLER = {
  async gemini({ sistem, mesajlar, model, anahtar, signal }, yaz) {
    const govde = {
      systemInstruction: { parts: [{ text: sistem }] },
      contents: mesajlar.map((m) => ({
        role: m.rol === "assistant" ? "model" : "user",
        parts: [{ text: m.metin }, ...(m.gorsel ? [{ inline_data: { mime_type: mimeOf(m.gorsel), data: base64Of(m.gorsel) } }] : [])],
      })),
    };
    const res = await istekAt(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST", signal, body: JSON.stringify(govde),
      headers: { "content-type": "application/json", "x-goog-api-key": anahtar },
    });
    for await (const { json } of sseOku(res)) {
      if (!json) continue;
      if (json.error) throw akisHatasi(json.error.status, json.error.code);
      if (json.promptFeedback?.blockReason) throw new AsistanHatasi("ret");
      const aday = json.candidates?.[0];
      const parca = (aday?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
      if (parca) yaz(parca);
      if (/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(aday?.finishReason || "")) throw new AsistanHatasi("ret");
    }
  },

  async claude({ sistem, mesajlar, model, anahtar, signal }, yaz) {
    const govde = {
      model, max_tokens: 16000, stream: true, fallbacks: "default", system: sistem,
      messages: mesajlar.map((m) => m.rol === "assistant"
        ? { role: "assistant", content: m.metin }
        : { role: "user", content: [
          ...(m.gorsel ? [{ type: "image", source: { type: "base64", media_type: mimeOf(m.gorsel), data: base64Of(m.gorsel) } }] : []),
          { type: "text", text: m.metin },
        ] }),
    };
    const res = await istekAt("https://api.anthropic.com/v1/messages", {
      method: "POST", signal, body: JSON.stringify(govde),
      headers: {
        "x-api-key": anahtar, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json", "anthropic-beta": "server-side-fallback-2026-07-01",
      },
    });
    for await (const { olay, json } of sseOku(res)) {
      const tip = json?.type || olay;
      if (tip === "content_block_delta" && json.delta?.type === "text_delta") yaz(json.delta.text);
      else if (tip === "message_delta" && json.delta?.stop_reason === "refusal") throw new AsistanHatasi("ret");
      else if (tip === "error") throw akisHatasi(json?.error?.type);
    }
  },

  async openai({ sistem, mesajlar, model, anahtar, signal }, yaz) {
    const govde = {
      model, stream: true, instructions: sistem,
      input: mesajlar.map((m) => m.rol === "assistant"
        ? { role: "assistant", content: m.metin }
        : { role: "user", content: [{ type: "input_text", text: m.metin }, ...(m.gorsel ? [{ type: "input_image", image_url: m.gorsel }] : [])] }),
    };
    const res = await istekAt("https://api.openai.com/v1/responses", {
      method: "POST", signal, body: JSON.stringify(govde),
      headers: { Authorization: `Bearer ${anahtar}`, "content-type": "application/json" },
    });
    for await (const { olay, json } of sseOku(res)) {
      const tip = json?.type || olay;
      if (tip === "response.output_text.delta") yaz(json.delta || "");
      else if (tip === "response.refusal.delta" || tip === "response.refusal.done") throw new AsistanHatasi("ret");
      else if (tip === "error") throw akisHatasi(json?.code || json?.error?.type, json?.error?.code);
      else if (tip === "response.failed") throw akisHatasi(json?.response?.error?.code);
    }
  },

  // Çevrimdışı: hazır cevabı kelime kelime yazar
  async deneme({ signal, hazir, gorsel, soru, kelime, kaynak }, yaz) {
    const test = String(soru || "").trim().match(/^#(401|403|404|429|ag|ret|500)$/i);
    await bekle(520 + Math.random() * 380, signal);
    if (test) {
      const k = test[1].toLowerCase();
      if (k === "ag") throw new AsistanHatasi("ag", t("AĞ YOK"));
      if (k === "ret") throw new AsistanHatasi("ret");
      throw httpHatasi(+k, "");
    }
    const metin = denemeCevabi({ hazir, gorsel, kelime, soru, kaynak: kaynak || {}, serbest: !hazir });
    // $...$ tek parça akar: yarım formül bir an bile ham görünmesin
    const parcalar = metin.match(/\$[^$\n]+\$\S*\s*|\S+\s*|\s+/g) || [];
    for (const p of parcalar) {
      yaz(p);
      await bekle(/[.:!?]\s*$/.test(p) ? 110 + Math.random() * 90 : 16 + Math.random() * 26, signal);
    }
  },
};

/* ================= Deneme cevapları ================= */
// Çevrimdışı hazır cevaplar konuya göre seçilir: önce seçilen metin, sonra örnek sayfanın metni, en son belge adı taranır.
// Konu bilinmiyorsa matematik dışı metinde metnin kendisinden kurulan genel bir cevap gelir.
const sozBasi = (s) => new RegExp(`(?<!\\p{L})(?:${s})`, "iu");
// Her konuda İngilizce örnek sayfalar için İngilizce terimler de aranır
const KONULAR = [
  { id: "logturev", ad: "logaritmik türev", re: [/logaritmik türev|logarithmic differentiation/i, /ln\s*y\s*=/] },
  { id: "kapali", ad: "kapalı türev", re: [/kapalı türev|kapalı fonksiyon|kapalı olarak|implicit differentiation|implicitly/i, /x(?:²|\^?2)\s*\+\s*y(?:²|\^?2)/i] },
  { id: "zincir", ad: "zincir kuralı", re: [/zincir kural|chain rule/i, /bileşke fonksiyon|composite function/i, /f\s*∘\s*g|f′\s*\(\s*g\s*\(x\)\s*\)|dy\s*\/\s*du/i, /iç fonksiyon|dış fonksiyon|inner function|outer function/i] },
  { id: "difdenk", ad: "ayrılabilir diferansiyel denklemler", re: [/diferansiyel denklem|değişkenlerine ayır|ayrılabilir|differential equation|separable|separate the variables/i, /y′\s*=\s*\d*\s*y\b/] },
  { id: "statik", ad: "kiriş ve mesnet tepkileri", re: [sozBasi("kiriş|mesnet|moment|kesme kuvvet|serbest cisim|yayılı yük|tekil yük|statik|beam|shear force|free body|distributed load|point load|statics"), /\d\s*kN\b/],
    // Örnek sayfaların hangisi: problem, örnek ya da kesme-moment bölümü
    alt: [[/problem 2\.7/i, "statik"], [/dV\s*\/\s*dx|eğilme momenti diyagram|kesit yöntemi|bending moment diagram|method of sections/i, "statikVM"], [/örnek 2\.6|basit mesnetli|example 2\.6|simply supported/i, "statik26"]] },
  { id: "anatomi", ad: "üst ekstremitenin kas ve sinirleri", re: [sozBasi("pleksus|plexus|brakiyal|brachial|ekstremite|innervasyon|humerus|n\\.\\s|m\\.\\s|sinir|upper limb|innervat|nerve"), /(?<!\p{L})kas(?:ı|ın|lar\p{L}*)?(?!\p{L})|(?<!\p{L})muscles?(?!\p{L})/iu],
    alt: [[/fossa cubitalis|dirsek çukuru|cubital fossa/i, "anatomiFossa"], [/pleksus|plexus/i, "anatomi"], [/biceps|triceps|brachialis|coracobrachialis|kolun kasları|muscles of the arm/i, "anatomiKas"]] },
  { id: "turev", ad: "türev", re: [sozBasi("türev|limit|teğet|eğim|anlık değişim|derivative|tangent|slope|instantaneous rate"), /f′|f'\(|dy\s*\/\s*dx/] },
];
const KONU_AD = {
  ...Object.fromEntries(KONULAR.map((x) => [x.id, x.ad])),
  statik26: "basit mesnetli kirişte mesnet tepkileri", statikVM: "kesme kuvveti ve eğilme momenti",
  anatomiKas: "kolun kasları", anatomiFossa: "fossa cubitalis",
};
const KONU_AD_EN = {
  logturev: "logarithmic differentiation", kapali: "implicit differentiation", zincir: "the chain rule",
  difdenk: "separable differential equations", statik: "beams and support reactions",
  anatomi: "the muscles and nerves of the upper limb", turev: "the derivative",
  statik26: "support reactions in a simply supported beam", statikVM: "shear force and bending moment",
  anatomiKas: "the muscles of the arm", anatomiFossa: "the cubital fossa",
};
// Örnek belgede sayfanın metni (gerçek PDF'te sayfa metni zaten "sor" yüküyle gelir)
function ornekSayfaMetni(k) {
  const b = k.belgeId ? belgeBul(k.belgeId) : null;
  const v = b?.veri;
  if (!b || b.dosya || !k.sayfa || !Array.isArray(v?.sayfalar)) return "";
  const s = v.sayfalar[k.sayfa - (v.ilkNo || 1)];
  if (!s) return "";
  const liste = (typeof SAYFALAR.ornekSayfalari === "function" && SAYFALAR.ornekSayfalari(b.id)) || SAYFALAR.PDF_PAGES;
  const pdf = s.tur === "pdf" ? sayfaYazisi(liste?.[s.pdf]) : "";
  return [pdf, ...(s.metinler || []).map((m) => m.metin || "")].filter(Boolean).join(" ");
}
// Sayfa metni; boş gelirse (çizim tuvalsiz çalışmazsa) çizim işlevinin içindeki dizgiler yeter
function sayfaYazisi(sayfa) {
  let t = "";
  try { t = String(sayfa?.text || ""); } catch { t = ""; }
  if (t.trim() || typeof sayfa?.draw !== "function") return t;
  return (String(sayfa.draw).match(/"(?:[^"\\\n]|\\.)*"/g) || []).join(" ");
}
function konuBul(k) {
  const b = k.belgeId ? belgeBul(k.belgeId) : null;
  const kaynaklar = [k.metin, k.gorsel || !k.metin ? ornekSayfaMetni(k) : "", [k.belgeAd, b?.ad, b?.yazar].filter(Boolean).join(" ")];
  for (const t of kaynaklar) {
    if (!t) continue;
    const konu = KONULAR.find((x) => x.re.some((re) => re.test(t)));
    if (konu) return konu.alt?.find(([re]) => re.test(t))?.[1] || konu.id;
  }
  // EPUB'dan seçim: edebî açıklama; formül işaretleri varsa genel
  if (k.metin && (b ? b.tur === "epub" : k.kaynak === "koltuk") && !/[=∫√∑²³]/.test(k.metin)) return "edebi";
  return "genel";
}

const DENEME_KONU = {
  zincir: {
    acikla: `Zincir kuralı, iç içe geçmiş (bileşke) bir fonksiyonun türevini katman katman alır.
1. Fonksiyonu iki katmana ayır: dış fonksiyon $f$, iç fonksiyon $g$; yani $F(x) = f(g(x))$.
2. Dış fonksiyonun türevini al ama içine dokunma: $f′(g(x))$.
3. Bunu iç fonksiyonun türeviyle çarp: $F′(x) = f′(g(x)) · g′(x)$.
Neden çarpım? $x$ biraz değişince $u = g(x)$, $g′(x)$ kat değişir; $u$ değişince $y$, $f′(u)$ kat değişir. Art arda iki büyütme oranı çarpılır.
Leibniz gösterimiyle $dy/dx = (dy/du) · (du/dx)$; $du$'lar sadeleşiyormuş gibi düşünmek kuralı hatırlatır.`,
    ozetle: `Üç satırda özet:
- Bileşke fonksiyon $F(x) = f(g(x))$ ise $F′(x) = f′(g(x)) · g′(x)$.
- Kısaca: dış türev (içi aynen kalır) çarpı iç türev.
- Örneğin $y = (3x^2 + 1)^5$ için $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.`,
    basitlestir: `Zincir kuralını birbirine geçmiş dişli çarklar gibi düşün: $x$ çarkı $u$ çarkını, $u$ çarkı da $y$ çarkını döndürüyor.
$x$ bir tur dönünce $u$ 3 tur, $u$ bir tur dönünce $y$ 2 tur dönüyorsa, $x$ bir tur dönünce $y$ $3 · 2 = 6$ tur döner.
Türevler bu "kaç kat" oranlarıdır: $dy/dx = (dy/du) · (du/dx)$.
Pratik kural: önce en dıştaki işlemin türevini al, içine dokunma; sonra içteki ifadenin türeviyle çarp.`,
    ornek: `Somut örnek: $y = (3x^2 + 1)^5$.
1. İç fonksiyon $u = 3x^2 + 1$, dış fonksiyon $y = u^5$.
2. Dış türev: $dy/du = 5u^4 = 5(3x^2 + 1)^4$.
3. İç türev: $du/dx = 6x$.
4. Çarp: $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.
Sağlama: $x = 0$ için $y′ = 0$ çıkıyor. Gerçekten $3x^2 + 1$ en küçük değerini $x = 0$'da alır, teğet orada yataydır.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. $y = sin(4x)$ ise $y′$ nedir?
2. $y = ln(cos x)$ fonksiyonunun türevini bul.
3. $y = tan^2(3x)$ için $y′$ nedir? İpucu: zincir iki kez uygulanır.
**Cevaplar**
1. $y′ = cos(4x) · 4 = 4cos(4x)$.
2. $y′ = (1/cos x) · (−sin x) = −tan x$.
3. $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.`,
    formul: `Görüntüdeki ifade zincir kuralı: $F′(x) = f′(g(x)) · g′(x)$.
1. $F = f ∘ g$: önce $g$, sonra $f$ uygulanan bileşke fonksiyon.
2. $g′(x)$: iç fonksiyonun $x$ noktasındaki değişim hızı.
3. $f′(g(x))$: dış fonksiyonun türevi, ama $x$'te değil $g(x)$ noktasında. En sık hata burada $f′(x)$ yazmaktır.
4. Leibniz biçimi: $u = g(x)$ ise $dy/dx = (dy/du) · (du/dx)$.
Koşul: $g$, $x$ noktasında; $f$ de $g(x)$ noktasında türevlenebilir olmalı.`,
    coz: `Sayfadaki Örnek 1: $y = (3x^2 + 1)^5$.
1. Katmanları ayır: $u = 3x^2 + 1$ ve $y = u^5$.
2. Dış türev: $dy/du = 5u^4$.
3. İç türev: $du/dx = 6x$.
4. Zincir kuralı: $dy/dx = 5u^4 · 6x = 30x(3x^2 + 1)^4$.
Sonuç: $y′ = 30x(3x^2 + 1)^4$.`,
    adim: `Adım adım, sayfadaki alıştırmalardan $y = tan^2(3x)$ ile:
1. Katmanları ayır: $y = u^2$, $u = tan v$, $v = 3x$. Gerekçe: üç iç içe işlem var, her biri bir çarpan getirecek.
2. En dış katman: $dy/du = 2u = 2tan(3x)$. Gerekçe: kuvvet kuralı, içi aynen kalır.
3. Orta katman: $du/dv = sec^2 v = sec^2(3x)$. Gerekçe: $(tan v)′ = sec^2 v$.
4. İç katman: $dv/dx = 3$.
5. Çarp: $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.
Çarpan sayısı katman sayısına eşit olmalı; biri eksikse bir katman unutulmuştur.`,
    "ozetle-gorsel": `Bu bölgede üç parça var:
- Teorem: $F = f ∘ g$ ise $F′(x) = f′(g(x)) · g′(x)$.
- Leibniz biçimi: $dy/dx = (dy/du) · (du/dx)$.
- Örnek 1: $y = (3x^2 + 1)^5$ için $y′ = 30x(3x^2 + 1)^4$.
Kısaca bölge, bileşke fonksiyonun türevini "dış türev çarpı iç türev" diye özetliyor.`,
  },
  kapali: {
    acikla: `Kapalı türev, $y$'yi $x$ cinsinden yalnız bırakamadığın denklemlerde türev almanın yoludur.
1. Denklemin iki tarafının da $x$'e göre türevini al.
2. $y$ içeren her terimde zincir kuralı işler: $y$, $x$'in bir fonksiyonu olduğu için $(y^2)′ = 2y · y′$ olur.
3. $y′$ içeren terimleri bir tarafa topla ve $y′$'yü çek.
Örnek: $x^2 + y^2 = 25$ ise $2x + 2y · y′ = 0$, buradan $y′ = −x/y$.
Sonuç hem $x$'e hem $y$'ye bağlıdır; eğim için noktanın iki koordinatı da gerekir.`,
    ozetle: `Üç satırda özet:
- Kapalı türev, $F(x, y) = c$ biçimindeki denklemlerde $y$'yi yalnız bırakmadan türev almayı sağlar.
- $y$ içeren her terim zincir kuralıyla türetilir ve sonuna $y′$ çarpanı gelir.
- Çember $x^2 + y^2 = 25$ için $y′ = −x/y$; $(3, 4)$ noktasında teğetin eğimi $−3/4$.`,
    basitlestir: `Bazı eğriler "$y = ...$" diye yazılamaz; çember böyledir, bir $x$ değerine iki $y$ düşer.
Kapalı türevde $y$'yi yalnız bırakmaya uğraşmazsın. Denklemi olduğu gibi türetirsin; yalnız her $y$ teriminin sonuna bir $y′$ eklersin, çünkü $x$ değişince $y$ de değişir.
Çember $x^2 + y^2 = 25$: türetince $2x + 2y · y′ = 0$, yani $y′ = −x/y$.
Sağ üstteki $(3, 4)$ noktasında eğim $−3/4$ çıkar: eğri orada aşağı iniyor, beklendiği gibi.`,
    ornek: `Örnek: $x^3 + y^3 = 6xy$ eğrisine (Descartes yaprağı) $(3, 3)$ noktasında teğet.
1. Nokta eğrinin üstünde mi: $27 + 27 = 54 = 6 · 3 · 3$. Evet.
2. İki tarafı türet: $3x^2 + 3y^2 y′ = 6y + 6xy′$. Sağda çarpım kuralı kullanıldı.
3. $y′$'yü topla: $y′(3y^2 − 6x) = 6y − 3x^2$, yani $y′ = (2y − x^2)/(y^2 − 2x)$.
4. $(3, 3)$ noktasında: $y′ = (6 − 9)/(9 − 6) = −1$.
5. Teğet: $y − 3 = −(x − 3)$, yani $y = −x + 6$.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. $x^2 + y^2 = 25$ çemberine $(−3, 4)$ noktasında çizilen teğetin eğimi kaçtır?
2. $x^2 + xy + y^2 = 7$ için $y′$'yü bul.
3. $sin(x + y) = y$ için $y′$ nedir?
**Cevaplar**
1. $y′ = −x/y = 3/4$.
2. $2x + y + xy′ + 2yy′ = 0$, dolayısıyla $y′ = −(2x + y)/(x + 2y)$.
3. $cos(x + y)(1 + y′) = y′$, dolayısıyla $y′ = cos(x + y)/(1 − cos(x + y))$.`,
    formul: `Görüntüdeki sonuç $y′ = −x/y$: $x^2 + y^2 = 25$ çemberinin her noktasındaki teğet eğimi.
1. $x^2 + y^2 = 25$: merkezi orijinde, yarıçapı $5$ olan çember.
2. Türetince $2x + 2y · y′ = 0$ çıkar; $2y · y′$ terimi zincir kuralından gelir.
3. $−x/y$: eğim noktaya bağlıdır. $y = 0$ olan $(±5, 0)$ noktalarında teğet düşeydir, eğim tanımsızdır.
Geometrik anlam: yarıçapın eğimi $y/x$, teğetin eğimi $−x/y$; çarpımları $−1$, yani teğet yarıçapa diktir.`,
    coz: `Sayfadaki çember için $(3, 4)$ noktasındaki teğet:
1. Kapalı türev: $2x + 2y · y′ = 0$, dolayısıyla $y′ = −x/y$.
2. Noktada eğim: $y′ = −3/4$.
3. Nokta eğim biçimi: $y − 4 = −(3/4)(x − 3)$.
4. Düzenle: $y = −(3/4)x + 25/4$, ya da $3x + 4y = 25$.
Sağlama: $(3, 4)$ yerine konunca $9 + 16 = 25$; teğet noktadan geçiyor.`,
    adim: `Adım adım, $x^3 + y^3 = 6xy$ için $y′$:
1. Sol tarafı türet: $(x^3)′ = 3x^2$, $(y^3)′ = 3y^2 y′$. Gerekçe: $y$ terimi zincir kuralıyla türetilir.
2. Sağ tarafı türet: $(6xy)′ = 6y + 6xy′$. Gerekçe: $x$ ile $y$ çarpımı, çarpım kuralı.
3. Eşitle: $3x^2 + 3y^2 y′ = 6y + 6xy′$.
4. $y′$ içeren terimleri sola, diğerlerini sağa topla: $y′(3y^2 − 6x) = 6y − 3x^2$.
5. Böl ve sadeleştir: $y′ = (2y − x^2)/(y^2 − 2x)$.
Payda sıfır olduğu noktalarda teğet düşeydir.`,
    "ozetle-gorsel": `Bu bölgede üç şey var:
- Bir eğri: $x^2 + y^2 = 25$ çemberi ve bir noktadaki teğet doğrusu.
- Bir yöntem: iki taraf $x$'e göre türetilir, $y$ terimlerine $y′$ eklenir.
- Bir sonuç: $y′ = −x/y$; teğet her noktada yarıçapa diktir.
Kısaca bölge, $y$'yi yalnız bırakmadan eğim bulmayı gösteriyor.`,
  },
  difdenk: {
    acikla: `Ayrılabilir diferansiyel denklemde $y$'li terimler bir tarafa, $x$'li terimler öbür tarafa toplanabilir.
1. $y′ = 2y$ yerine $dy/dx = 2y$ yaz.
2. Değişkenleri ayır: $dy/y = 2dx$.
3. İki tarafın integralini al: $ln|y| = 2x + c$.
4. Üstel al: $y = Ce^{2x}$; burada $C = ±e^c$.
5. Başlangıç koşulu sabiti belirler: $y(0) = 3$ ise $C = 3$, yani $y = 3e^{2x}$.
Anlamı: değişim hızı o anki miktarla orantılı. Nüfus, bileşik faiz ve bakteri üremesi bu kalıba uyar.`,
    ozetle: `Üç satırda özet:
- $y′ = ky$ biçimindeki denklem değişkenlerine ayrılarak çözülür: $dy/y = k dx$.
- Genel çözüm $y = Ce^{kx}$; $C$ başlangıç koşulundan bulunur.
- Sayfadaki örnekte $y′ = 2y$, $y(0) = 3$ için $y = 3e^{2x}$; sağlama $y′ = 6e^{2x} = 2y$.`,
    basitlestir: `Bir bankadaki parayı düşün: faiz, o an hesapta ne kadar para varsa ona göre işler. Para çoğaldıkça artış da hızlanır.
$y′ = 2y$ tam bunu söyler: artış hızı, o anki miktarın iki katı.
Böyle büyüyen her şeyin formülü üsteldir: $y = Ce^{2x}$. $C$ başlangıçtaki miktardır; $y(0) = 3$ ise $y = 3e^{2x}$.`,
    ornek: `Somut örnek: radyoaktif bozunma. Madde miktarı $y$, azalma hızı miktarla orantılı: $y′ = −0,1y$, başta $y(0) = 50$ g.
1. Ayır: $dy/y = −0,1dt$.
2. İntegral: $ln|y| = −0,1t + c$, yani $y = Ce^{−0,1t}$.
3. Koşul: $C = 50$, yani $y = 50e^{−0,1t}$.
4. Yarı ömür: $50e^{−0,1t} = 25$ ise $t = ln 2/0,1 ≈ 6,93$.
Aynı denklem, işareti değişince büyümeyi de anlatır.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. $y′ = 3y$, $y(0) = 2$ denklemini çöz.
2. $y′ = xy$ denkleminin genel çözümünü bul.
3. $y = 3e^{2x}$ fonksiyonunun $y′ = 2y$ denklemini sağladığını göster.
**Cevaplar**
1. $y = 2e^{3x}$.
2. $dy/y = xdx$, $ln|y| = x²/2 + c$, yani $y = Ce^{x²/2}$.
3. $y′ = 6e^{2x} = 2 · 3e^{2x} = 2y$.`,
    formul: `Görüntüdeki sonuç $y = 3e^{2x}$, $y′ = 2y$ denkleminin çözümü.
1. $e^{2x}$: türevi kendisinin $2$ katı olan fonksiyon; denklemin istediği tam budur.
2. $3$: başlangıç değeri, $x = 0$ iken $y = 3$.
3. Üs içindeki $2$: büyüme oranı. Büyüdükçe eğri daha hızlı diklesir.
Sağlama: $y′ = 6e^{2x} = 2y$.`,
    coz: `Örnek: $y′ = 2y$, $y(0) = 3$.
1. Ayır: $dy/y = 2dx$.
2. İntegral: $ln|y| = 2x + c$.
3. Üstel: $y = Ce^{2x}$.
4. Koşul: $y(0) = C = 3$.
Sonuç: $y = 3e^{2x}$. Sağlama: $y′ = 6e^{2x} = 2y$.`,
  },
  statik: {
    acikla: `Problem 2.7, basit mesnetli bir kirişin denge problemidir. Kiriş $A$'da sabit mesnetle (iki tepki: $A_x$, $A_y$), $B$'de kayıcı mesnetle (bir tepki: $B_y$) taşınıyor.
1. Serbest cisim diyagramı: mesnetleri kaldır, yerlerine tepki kuvvetlerini çiz. Yükler: $C$'de $12$ kN ve $CB$ boyunca $4$ kN/m.
2. Yayılı yükü bileşkesiyle değiştir: $4 · 2 = 8$ kN, $CB$'nin ortasında, yani $A$'dan $4$ m uzakta.
3. Denge denklemlerini yaz: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM_A = 0$. Üç bilinmeyen, üç denklem.
4. $A$'ya göre moment almak $A_x$ ve $A_y$'yi denklemden düşürür; $B_y$ doğrudan bulunur.
Kesme kuvveti ve eğilme momenti, kirişi bir noktadan kesip sol parçanın dengesine bakarak yazılır.`,
    ozetle: `Üç satırda özet:
- $A$ sabit mesnet ($A_x$, $A_y$), $B$ kayıcı mesnet ($B_y$); yükler $12$ kN tekil ve $4$ kN/m yayılı.
- Dengeden $A_x = 0$, $A_y = 6,4$ kN, $B_y = 13,6$ kN.
- En büyük eğilme momenti $C$'de: $M_C = 19,2$ kN·m.`,
    basitlestir: `Kirişi iki kişinin omzunda taşıdığı bir tahta gibi düşün. $A$ ve $B$ iki taşıyıcı, yükler de tahtanın üstüne konan ağırlıklar.
Ağırlık hangi uca yakınsa o uçtaki kişi daha çok taşır. Burada yüklerin çoğu $B$'ye yakın, bu yüzden $B_y = 13,6$ kN, $A_y = 6,4$ kN.
Toplam yük $12 + 8 = 20$ kN; iki taşıyıcının payları toplamı da $20$ kN eder.
Moment, tahtayı döndürme etkisidir: kuvvet çarpı uzaklık. Tahta dönmüyorsa iki yöne döndürme etkileri birbirini götürür.`,
    coz: `Problem 2.7: $AC = 3$ m, $CB = 2$ m.
1. Yatay yük yok: $A_x = 0$.
2. Yayılı yükün bileşkesi $4 · 2 = 8$ kN, $A$'dan $4$ m uzakta.
3. $ΣM_A = 0$: $B_y · 5 − 12 · 3 − 8 · 4 = 0$, buradan $B_y = 68/5 = 13,6$ kN.
4. $ΣF_y = 0$: $A_y = 12 + 8 − 13,6 = 6,4$ kN.
5. Sağlama, $B$'ye göre moment: $6,4 · 5 − 12 · 2 − 8 · 1 = 32 − 24 − 8 = 0$.
Kesme kuvveti $AC$ boyunca $6,4$ kN; $C$'de $12$ kN düşüp $−5,6$ kN olur, $B$'de $−13,6$ kN'a iner. Moment en büyük değerini kesmenin işaret değiştirdiği $C$'de alır: $M_C = 6,4 · 3 = 19,2$ kN·m.`,
    adim: `Adım adım kesme ve moment; tepkiler $A_y = 6,4$ kN, $B_y = 13,6$ kN:
1. $0 < x < 3$ ($A$ ile $C$ arası): kesitin solunda yalnız $A_y$ var. $V = 6,4$ kN, $M = 6,4x$. Gerekçe: sol parçanın dengesi.
2. $C$'de tekil yük: kesme $12$ kN birden düşer, $V = −5,6$ kN. Moment sürekli kalır: $M_C = 19,2$ kN·m.
3. $3 < x < 5$ ($C$ ile $B$ arası): $V = −5,6 − 4(x − 3)$, $M = 6,4x − 12(x − 3) − 2(x − 3)^2$. Gerekçe: yayılı yük kesmeyi doğrusal, momenti parabolik değiştirir.
4. $x = 5$'te $M = 32 − 24 − 8 = 0$. Kayıcı mesnette moment sıfır olmalı; sağlama tamam.
Kural: $dM/dx = V$. Kesmenin sıfırdan geçtiği yer momentin tepe noktasıdır, burada $C$.`,
    formul: `Kiriş problemlerindeki temel ifadeler denge denklemleridir:
1. $ΣF_x = 0$ ve $ΣF_y = 0$: kiriş ötelenmiyor, kuvvetlerin toplamı sıfır.
2. $ΣM_A = 0$: kiriş dönmüyor; bir noktaya göre momentlerin toplamı sıfır. Moment, kuvvet çarpı dik uzaklıktır, birimi kN·m.
3. Yayılı yükün bileşkesi $W = q · L$; yük alanının ağırlık merkezine etkir. Burada $W = 4 · 2 = 8$ kN.
4. Kesit büyüklükleri arasında $dV/dx = −q$ ve $dM/dx = V$ bağıntıları vardır.
İşaret kuralını baştan seç ve sonuna kadar değiştirme.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. Sabit mesnet ve kayıcı mesnet kaçar tepki bileşeni verir?
2. $6$ m açıklıklı basit kirişin ortasına $10$ kN tekil yük konuyor. Mesnet tepkileri ve en büyük moment nedir?
3. $3$ kN/m'lik yayılı yük $4$ m boyunca etkiyor. Bileşkesi ne kadardır ve nereye etkir?
**Cevaplar**
1. Sabit mesnet iki ($A_x$, $A_y$), kayıcı mesnet bir ($B_y$).
2. Simetriden $A_y = B_y = 5$ kN; $M_{maks} = 5 · 3 = 15$ kN·m, kirişin ortasında.
3. $W = 3 · 4 = 12$ kN, yüklü bölgenin ortasında.`,
    "ozetle-gorsel": `Bu bölgede üç şey var:
- Bir kiriş: $A$'da sabit, $B$'de kayıcı mesnet; açıklıklar $3$ m ve $2$ m.
- Yükler: $C$'de $12$ kN tekil, $CB$ boyunca $4$ kN/m yayılı.
- İstenenler: serbest cisim diyagramı, mesnet tepkileri, kesme ve moment diyagramları.
Kısaca bölge, bir kirişin dengesini adım adım kurmayı istiyor.`,
  },
  anatomi: {
    acikla: `Brakiyal pleksus (plexus brachialis), üst ekstremitenin motor ve duyu sinirlerini veren sinir ağıdır.
1. Kökler: C5, C6, C7, C8 ve T1 spinal sinirlerinin ön dalları.
2. Gövdeler: üst (C5, C6), orta (C7) ve alt (C8, T1).
3. Bölümler: her gövde ön ve arka bölüme ayrılır; ön bölümler fleksör, arka bölümler ekstansör kaslara gider.
4. Kordlar: lateral, posterior ve medial; adlarını a. axillaris'e göre konumlarından alırlar.
5. Uç dallar: lateral korddan n. musculocutaneus, posterior korddan n. axillaris ve n. radialis, medial korddan n. ulnaris; n. medianus lateral ve medial korddan birer kökle oluşur.
Ezber için sayılar: 5 kök, 3 gövde, 6 bölüm, 3 kord, 5 uç dal.`,
    ozetle: `Üç satırda özet:
- Pleksus C5 ile T1 ön dallarından kurulur: kök, gövde, bölüm, kord, uç dal.
- Beş uç dal: musculocutaneus, axillaris, radialis, medianus ve ulnaris.
- Klinikte üst gövde hasarı Erb felcine (C5, C6), alt gövde hasarı Klumpke felcine (C8, T1) yol açar.`,
    basitlestir: `Pleksusu bir şehrin elektrik dağıtım merkezi gibi düşün. Omurilikten beş kablo gelir (C5 ile T1 arası), merkezde birleşip karışır ve kola beş ana hat olarak çıkar.
Karışmanın faydası: bir kök zarar görse bile hiçbir kas tamamen elektriksiz kalmaz, çünkü çoğu sinir birden fazla kökten lif taşır.
Beş ana hattın kabaca işleri:
- Musculocutaneus: kolun ön yüzü, dirseği büker.
- Axillaris: kolu yana kaldıran deltoid.
- Radialis: kolun ve önkolun arka yüzü; el bileğini ve parmakları açar.
- Medianus: önkolun ön yüzünün çoğu ve başparmak kasları.
- Ulnaris: elin küçük kaslarının çoğu, ince parmak hareketleri.`,
    ornek: `Klinik örnek: humerus cisminin ortasından kırık.
1. N. radialis, humerusun arkasındaki sulcus nervi radialis içinde kemiğe yakın seyreder; kırıkta kolayca zedelenir.
2. Sonuç: el bileği ve parmak ekstansörleri çalışmaz, el bileği düşer (wrist drop). El sırtında, başparmakla işaret parmağı arasında duyu kaybı olur.
3. Triceps çoğunlukla korunur, çünkü dalları sinir oluğa girmeden önce ayrılır.
Aynı mantıkla collum chirurgicum humeri kırığı n. axillaris'i, medial epikondil travması n. ulnaris'i tehlikeye atar.`,
    adim: `Pleksusu kâğıda adım adım çiz:
1. Solda alt alta beş kök yaz: C5, C6, C7, C8, T1.
2. C5 ile C6'yı birleştir (üst gövde), C7'yi düz devam ettir (orta gövde), C8 ile T1'i birleştir (alt gövde).
3. Her gövdeyi ikiye ayır: ön bölüm ve arka bölüm.
4. Üç arka bölümü birleştir: posterior kord. Üst ve orta gövdenin ön bölümleri lateral kordu, alt gövdenin ön bölümü medial kordu yapar.
5. Dalları ekle: lateral korddan musculocutaneus, posterior korddan axillaris ve radialis, medial korddan ulnaris. Lateral ve medial korddan birer kök alıp ortada bir M çiz: medianus.
Ortadaki M şekli, kadavrada ve görüntülemede pleksusu tanımanın en kolay işaretidir.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. Hangi kord a. axillaris'in arkasında yer alır ve hangi uç dalları verir?
2. Zor doğum sonrası bebeğin kolu iç rotasyonda, önkolu ekstansiyon ve pronasyonda duruyor. Hangi kökler etkilenmiştir?
3. Karpal tünel sendromunda hangi sinir sıkışır ve ilk hangi bulgular görülür?
**Cevaplar**
1. Posterior kord; n. axillaris ve n. radialis.
2. C5 ve C6, yani üst gövde: Erb-Duchenne felci (garson bahşiş eli).
3. N. medianus; başparmak, işaret, orta parmak ve yüzük parmağının yarısında uyuşma, ileride thenar kaslarda zayıflık ve erime.`,
  },
  logturev: {
    acikla: `Logaritmik türev, çarpım, bölüm ve kuvvetlerle dolu bir fonksiyonu türetmeden önce sadeleştirmenin yoludur.
1. İki tarafın doğal logaritmasını al: $ln y = ln f(x)$.
2. Logaritmanın özellikleriyle çarpımı toplamaya, bölümü farka, kuvveti katsayıya çevir: $ln(ab) = ln a + ln b$, $ln(a/b) = ln a − ln b$, $ln a^n = n ln a$.
3. $x$'e göre kapalı türev al: sol taraf $y′/y$ olur.
4. $y$ ile çarp: $y′ = y · (...)$.
Taban da üs de değişkense ($x^x$ gibi) bu yol zorunludur; ne kuvvet kuralı ne üstel kural tek başına işler.`,
    ozetle: `Üç satırda özet:
- İki tarafın logaritması alınır, çarpım ve bölüm toplamaya çevrilir.
- Kapalı türevle $y′/y$ bulunur, sonra $y$ ile çarpılır.
- Örnek: $y = x^x$ için $ln y = x ln x$, buradan $y′ = x^x(ln x + 1)$.`,
    basitlestir: `Çarpımın türevi zahmetli, toplamın türevi kolaydır. Logaritma, çarpımı toplamaya çeviren bir makine gibidir.
Bu yüzden önce $ln$ alırsın: çarpımlar toplamaya, bölümler çıkarmaya, kuvvetler önlerindeki sayıya döner. Sonra her terimi ayrı ayrı türetirsin.
Sonda bir şeyi unutma: $ln y$'nin türevi $y′/y$ olduğu için cevabı $y$ ile çarparsın.`,
    ornek: `Örnek: $x > 0$ için $y = x^x$.
1. Logaritma al: $ln y = x ln x$.
2. Türet: solda $y′/y$, sağda çarpım kuralıyla $ln x + x · (1/x) = ln x + 1$.
3. $y$ ile çarp: $y′ = x^x(ln x + 1)$.
Sağlama: $x = 1$ için $y′ = 1$; $x^x$ eğrisinin $(1, 1)$ noktasındaki eğimi gerçekten $1$'dir.`,
    coz: `Sayfadaki Örnek 3: $y = x^{3/4} √(x^2 + 1)/(3x + 2)^5$.
1. Logaritma al: $ln y = (3/4)ln x + (1/2)ln(x^2 + 1) − 5ln(3x + 2)$.
2. Türet: $y′/y = 3/(4x) + x/(x^2 + 1) − 15/(3x + 2)$.
3. $y$ ile çarp: $y′ = y · (3/(4x) + x/(x^2 + 1) − 15/(3x + 2))$, burada $y$ baştaki ifadedir.
Her terim tek tek türetildi; bölüm kuralıyla aynı sonuca varmak çok daha uzun sürerdi.`,
    adim: `Adım adım, alıştırmalardan $y = x^{sin x}$ ile:
1. Logaritma al: $ln y = sin x · ln x$. Gerekçe: $ln a^b = b ln a$, üs öne iner.
2. Sağ tarafı çarpım kuralıyla türet: $cos x · ln x + sin x · (1/x)$.
3. Sol taraf: $(ln y)′ = y′/y$. Gerekçe: zincir kuralı.
4. $y$ ile çarp: $y′ = x^{sin x}(cos x · ln x + sin x/x)$.
Taban da üs de değişkenken tek temiz yol budur.`,
    formul: `Görüntüdeki zincir: $ln y = x ln x$, sonra $y′/y = ln x + 1$, sonra $y′ = x^x(ln x + 1)$.
1. $ln y = x ln x$: logaritma üssü öne indirir; artık çarpım kuralı yeterli.
2. $y′/y$: $ln y$'nin $x$'e göre türevi, zincir kuralından gelir.
3. $ln x + 1$: $x ln x$'in türevi, çarpım kuralıyla $1 · ln x + x · (1/x)$.
4. Son adımda iki taraf $y = x^x$ ile çarpılır.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. $y = x^{√x}$ için $y′$ nedir?
2. $y = (x^2 + 1)^3(x − 2)^4$ fonksiyonunun türevini logaritmik türevle bul.
3. Logaritmik türev hangi durumda zorunludur?
**Cevaplar**
1. $ln y = √x ln x$, $y′/y = (ln x + 2)/(2√x)$, yani $y′ = x^{√x}(ln x + 2)/(2√x)$.
2. $y′ = (x^2 + 1)^3(x − 2)^4 · (6x/(x^2 + 1) + 4/(x − 2))$.
3. Taban da üs de değişkense; örneğin $x^x$ ya da $x^{sin x}$.`,
    "ozetle-gorsel": `Bu bölgede üç şey var:
- Yöntem: iki tarafın logaritması, sadeleştirme, kapalı türev, $y$ ile çarpma.
- Örnek 3: çarpım ve bölümlü bir ifade, logaritmayla üç terimlik bir toplama dönüşüyor.
- Örnek 4: $y = x^x$ için $y′ = x^x(ln x + 1)$.
Kısaca bölge, karmaşık ifadeleri türetmeden önce logaritmayla sadeleştirmeyi gösteriyor.`,
  },
  statik26: {
    acikla: `Basit mesnetli kirişin bir ucu sabit mesnede (pim), öbür ucu kayıcı mesnede oturur. Sabit mesnet iki tepki ($A_x$, $A_y$), kayıcı mesnet bir tepki ($B_y$) verir.
1. Üç bilinmeyene karşı düzlemde üç denge denklemi var: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM = 0$. Bu yüzden kiriş izostatiktir, yalnız statikle çözülür.
2. Yayılı yük bileşkesiyle değiştirilir: Örnek 2.6'da $4 · 6 = 24$ kN, açıklığın ortasında, $A$'dan $3$ m uzakta.
3. $A$'ya göre moment almak $A_x$ ve $A_y$'yi denklemden düşürür, $B_y$ doğrudan bulunur.
Sonuç: $A_x = 0$, $B_y = 18$ kN, $A_y = 24$ kN.`,
    ozetle: `Üç satırda özet:
- Basit mesnetli kirişte sabit mesnet $A_x$ ve $A_y$, kayıcı mesnet $B_y$ verir; kiriş izostatiktir.
- Yayılı yük bileşkesiyle değiştirilir: $W = w · L$, yüklü bölgenin ortasında.
- Örnek 2.6: $A_x = 0$, $A_y = 24$ kN, $B_y = 18$ kN.`,
    basitlestir: `Kirişi iki kişinin omzunda taşıdığı bir tahta gibi düşün: $A$ ve $B$ iki taşıyıcı.
Toplam yük $18 + 24 = 42$ kN. Yayılı yük iki uca eşit dağılır, ama $18$ kN'luk tekil yük $A$'ya daha yakın ($2$ m). Bu yüzden $A$ daha çok taşır: $A_y = 24$ kN, $B_y = 18$ kN.
Moment, tahtayı döndürme etkisidir: kuvvet çarpı uzaklık. Tahta dönmüyorsa iki yöndeki döndürme etkileri birbirini götürür.`,
    coz: `Örnek 2.6: $AB = 6$ m, tüm açıklıkta $w = 4$ kN/m, $A$'dan $2$ m uzaktaki $C$'de $P = 18$ kN.
1. Yatay yük yok: $A_x = 0$.
2. Yayılı yükün bileşkesi $4 · 6 = 24$ kN, $A$'dan $3$ m uzakta.
3. $ΣM_A = 0$: $6B_y − 18 · 2 − 24 · 3 = 0$, buradan $B_y = 108/6 = 18$ kN.
4. $ΣF_y = 0$: $A_y = 18 + 24 − 18 = 24$ kN.
5. Sağlama, $B$'ye göre moment: $24 · 6 − 18 · 4 − 24 · 3 = 144 − 72 − 72 = 0$.`,
    adim: `Adım adım mesnet tepkileri:
1. Serbest cisim diyagramı: mesnetleri kaldır, yerlerine $A_x$, $A_y$, $B_y$ çiz. Gerekçe: dengede olan, dış kuvvetlerin toplamıdır.
2. Yayılı yükü $24$ kN'luk tek kuvvete çevir ve $x = 3$ m'ye koy. Gerekçe: bileşke, yük alanının ağırlık merkezine etkir.
3. $ΣM_A = 0$: $6B_y = 18 · 2 + 24 · 3 = 108$, yani $B_y = 18$ kN. Gerekçe: $A$'daki bilinmeyenlerin $A$'ya göre momenti sıfır.
4. $ΣF_y = 0$: $A_y = 42 − 18 = 24$ kN.
5. $ΣF_x = 0$: $A_x = 0$.
Sağlama için $B$'ye göre moment al; sıfır çıkmalı.`,
    "ozetle-gorsel": `Bu bölgede üç şey var:
- Tanım: basit mesnetli kiriş, sabit mesnet iki, kayıcı mesnet bir tepki verir.
- Örnek 2.6: $6$ m kiriş, tüm açıklıkta $4$ kN/m ve $C$'de $18$ kN.
- Çözüm: $ΣM_A = 0$ ile $B_y = 18$ kN, $ΣF_y = 0$ ile $A_y = 24$ kN.
Kısaca bölge, serbest cisim diyagramından tepkilere giden yolu gösteriyor.`,
  },
  statikVM: {
    acikla: `Kesme kuvveti $V$ ve eğilme momenti $M$, kirişi bir noktadan kesip bir yandaki parçanın dengesine bakarak bulunur.
1. Yükle bağıntı: $dV/dx = −w(x)$. Yayılı yük varken $V$ doğrusal azalır, yük yoksa sabit kalır.
2. Kesmeyle bağıntı: $dM/dx = V(x)$. $V$ pozitifken $M$ artar, negatifken azalır.
3. Tekil yükün altında $V$ yük kadar sıçrar; $M$ orada kırılır ama sürekli kalır.
4. $M$ en büyük değerini $V$'nin işaret değiştirdiği yerde alır.
Örnek 2.6'da $V$, $C$'de $+16$'dan $−2$'ye atlar; $M_{maks} = 24 · 2 − 2 · 2^2 = 40$ kN·m.`,
    ozetle: `Üç satırda özet:
- Kesit yöntemi: $V$ ve $M$, kesitin bir yanındaki parçanın dengesinden bulunur.
- $dV/dx = −w$ ve $dM/dx = V$; tekil yükün altında $V$ sıçrar.
- Örnek 2.6'da $V$, $C$'de $+16$'dan $−2$'ye atlar ve $M_{maks} = 40$ kN·m olur.`,
    basitlestir: `Kesme kuvveti, kirişi bir noktadan kesince iki parçayı birbirine göre aşağı yukarı kaydırmaya çalışan kuvvettir. Moment ise o noktada kirişi bükmeye çalışan etkidir.
İkisi birbirine bağlı: moment grafiğinin eğimi kesme kuvvetidir. Kesme sıfırdan geçince moment tepe yapar; havaya atılan topun hızı sıfır olduğu anda en yüksekte olması gibi.
Örnek 2.6'da bu an $C$ noktası: $M_{maks} = 40$ kN·m.`,
    coz: `Örnek 2.6 (devam): $A_y = 24$ kN, $B_y = 18$ kN.
1. $0 ≤ x < 2$: $V = 24 − 4x$, $M = 24x − 2x^2$.
2. $C$'deki $18$ kN: $V$, $24 − 8 = 16$'dan $16 − 18 = −2$'ye atlar.
3. $2 < x ≤ 6$: $V = 6 − 4x$, $M = 36 + 6x − 2x^2$.
4. Uçlar: $M(0) = 0$ ve $M(6) = 36 + 36 − 72 = 0$. Mesnetlerde moment sıfır; sağlama tamam.
5. En büyük moment $V$'nin işaret değiştirdiği $x = 2$'de: $M_{maks} = 40$ kN·m.`,
    adim: `Adım adım kesit yöntemi (Örnek 2.6):
1. $x$ noktasından kes, sol parçayı al. Gerekçe: sol parçada daha az kuvvet var.
2. $0 ≤ x < 2$: solda $A_y = 24$ kN ve $4x$ kN yayılı yük. $ΣF_y = 0$ ile $V = 24 − 4x$.
3. Kesite göre moment: $M = 24x − 4x · (x/2) = 24x − 2x^2$. Gerekçe: yayılı yükün bileşkesi parçanın ortasında.
4. $x > 2$: $18$ kN da sola girer. $V = 6 − 4x$, $M = 24x − 2x^2 − 18(x − 2) = 36 + 6x − 2x^2$.
5. Sağlama: $dM/dx = 6 − 4x = V$. Bağıntı tutuyor.`,
    formul: `Görüntüdeki bağıntılar: $dV/dx = −w(x)$ ve $dM/dx = V(x)$.
1. $w(x)$: birim uzunluktaki yayılı yük, aşağı doğru pozitif.
2. $dV/dx = −w$: $V$ diyagramının eğimi yükün eksi işaretlisidir. Yük yoksa $V$ yataydır.
3. $dM/dx = V$: $M$ diyagramının eğimi kesme kuvvetidir. $V = 0$ olan yerde $M$ tepe yapar.
4. İntegral biçimi: iki kesit arasındaki $M$ farkı, aradaki $V$ diyagramının alanına eşittir.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. Yayılı yük olmayan bir aralıkta $V$ ve $M$ diyagramları nasıl görünür?
2. Bir aralıkta $V(x) = 10 − 2x$ ise $M$ hangi $x$ değerinde en büyük olur?
3. $5$ m'lik basit kirişin ortasına $20$ kN konursa en büyük moment nedir?
**Cevaplar**
1. $V$ sabit, $M$ doğrusal.
2. $V = 0$ olan yerde: $x = 5$.
3. Tepkiler $10$'ar kN; $M_{maks} = 10 · 2,5 = 25$ kN·m, ortada.`,
  },
  anatomiKas: {
    acikla: `Kol iki bölmeye ayrılır ve her bölmenin kendi siniri vardır; tabloyu akılda tutmanın anahtarı budur.
1. Ön (fleksör) bölme: m. biceps brachii, m. brachialis, m. coracobrachialis. Üçünü de n. musculocutaneus innerve eder.
2. Arka (ekstansör) bölme: m. triceps brachii ve m. anconeus. İnnervasyonları n. radialis.
3. Biceps hem önkolu büker hem de en güçlü supinatördür; supinasyon gücü dirsek bükülüyken en fazladır.
4. Brachialis önkol hangi pozisyonda olursa olsun dirseği büker; asıl fleksör odur.
5. Triceps'in uzun başı omuz eklemini de geçer; bu yüzden kolu ekstansiyon ve addüksiyona da getirir.`,
    ozetle: `Üç satırda özet:
- Ön bölme (biceps, brachialis, coracobrachialis): n. musculocutaneus.
- Arka bölme (triceps, anconeus): n. radialis.
- Biceps en güçlü supinatör, brachialis asıl dirsek fleksörü; humerus cisim kırığında n. radialis zedelenip el bileği düşer.`,
    basitlestir: `Kolu önde bükücüler, arkada açıcılar diye düşün.
Öndekiler dirseği büker; üçünün de siniri aynı: musculocutaneus. Arkadaki triceps dirseği açar; siniri radialis.
Biceps ayrıca avucu yukarı çevirir (supinasyon). Kavanoz kapağı açarken ya da sağ elle vida sıkarken çalışan güçlü kas odur.`,
    ornek: `Gündelik örnek: sağ elle tornavidayla vida sıkmak bir supinasyon hareketidir.
1. Bu hareketin en güçlü kası m. biceps brachii'dir.
2. Biceps tuberositas radii'ye yapıştığı için radiusu kendi ekseninde döndürür.
3. Supinasyon gücü dirsek yaklaşık 90 derece bükülüyken en fazladır; vidayı kol düzken değil, bükülüyken sıkmak bu yüzden kolaydır.
Klinik karşılığı: humerus cisim kırığında n. radialis zedelenirse triceps çoğunlukla korunur ama el bileği ekstansörleri çalışmaz, el bileği düşer.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. M. brachialis nereye sokulur ve fonksiyonu nedir?
2. M. biceps brachii'nin iki başı nereden başlar?
3. Humerus cisim kırığı sonrası hasta elini bilekten kaldıramıyor. Hangi sinir, nerede zedelenmiştir?
**Cevaplar**
1. Proc. coronoideus ve tuberositas ulnae; dirsekte önkolun asıl fleksörüdür.
2. Caput longum tuberculum supraglenoidale'den, caput breve proc. coracoideus'tan.
3. N. radialis, humerusun arkasındaki sulcus n. radialis içinde.`,
  },
  anatomiFossa: {
    acikla: `Fossa cubitalis, dirseğin önündeki üçgen biçimli çukurdur.
1. Sınırlar: üstte iki epicondylus arasındaki çizgi, lateralde m. brachioradialis, medialde m. pronator teres.
2. Taban m. brachialis ve m. supinator; tavan fascia ve aponeurosis bicipitalis.
3. İçerik, lateralden mediale: m. biceps brachii tendonu, a. brachialis, n. medianus. Kısaltma: TAN (Tendon, Arter, Nerv).
4. N. radialis lateral kenarda, m. brachioradialis'in altında kalır.
Klinikte önemi: venöz kan buradaki yüzeyel venlerden alınır; tansiyon ölçerken stetoskop a. brachialis'in üstüne konur.`,
    ozetle: `Üç satırda özet:
- Dirseğin önündeki üçgen çukur; lateralde m. brachioradialis, medialde m. pronator teres sınırlar.
- İçerik lateralden mediale TAN: biceps tendonu, a. brachialis, n. medianus.
- Kan alma ve tansiyon ölçümü bu bölgede yapılır.`,
    basitlestir: `Dirseğin iç tarafındaki çukuru düşün. İki kas bir V çizer: dışta brachioradialis, içte pronator teres.
Çukurun içinde dıştan içe üç şey yan yana durur: biceps kirişi, atardamar ve sinir. Kısaca TAN.
Kan alınan damarlar bunların üstünde, derinin hemen altındadır.`,
    ornek: `Klinik örnek: dirsekten kan alma.
1. İğne yüzeyel venlere, çoğunlukla v. mediana cubiti'ye girer.
2. Aponeurosis bicipitalis bu venin altında uzanır ve a. brachialis ile n. medianus'u örter; derindeki yapıları korur.
3. İğne çok derine ve mediale giderse arter ya da n. medianus zedelenebilir.
Bu yüzden ven bulunamazsa iğneyi derine ve içe doğru aramak yerine başka bir damar seçilir.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. Fossa cubitalis'in medial ve lateral sınırları hangi kaslardır?
2. İçeriğini lateralden mediale sırala.
3. Kan alırken derindeki arter ve siniri koruyan yapı hangisidir?
**Cevaplar**
1. Medialde m. pronator teres, lateralde m. brachioradialis.
2. M. biceps brachii tendonu, a. brachialis, n. medianus.
3. Aponeurosis bicipitalis.`,
  },
  turev: {
    acikla: `Buradaki çekirdek fikir şu: türev, bir niceliğin anlık değişim hızıdır.
1. Önce iki nokta arasındaki ortalama değişimi yaz: $(f(x+h) − f(x))/h$.
2. Sonra aralığı küçült. $h → 0$ giderken bu oran bir sayıya yaklaşıyorsa o sayı $f′(x)$ olur.
3. Geometrik anlamı: $f′(x)$, grafiğe $x$ noktasında teğet olan doğrunun eğimidir.
Örneğin $f(x) = x^2$ için oran $2x + h$ çıkar; $h → 0$ iken $f′(x) = 2x$ bulunur.`,
    ozetle: `Üç satırda özet:
- Türev, fonksiyonun bir noktadaki anlık değişim hızıdır: $h → 0$ iken $f′(x) = lim (f(x+h) − f(x))/h$.
- Grafikte bu sayı teğet doğrunun eğimine eşittir.
- Çarpım, bölüm ve zincir kuralları her seferinde limite dönmeden türev almayı sağlar; örneğin $(x^3)′ = 3x^2$.`,
    basitlestir: `Bir arabanın hız göstergesini düşün. Bir saatte 60 km gittiysen ortalama hızın 60 km/sa olur, ama gösterge o anki hızı söyler. Türev o göstergedir.
Yol $s(t)$ ise anlık hız $s′(t)$ olur. Mesela $s(t) = 5t^2$ ise $s′(t) = 10t$; 3. saniyede hız $10 · 3 = 30$ m/sn.
Kısaca: ortalama hız iki an arasına, türev tek bir ana bakar.`,
    ornek: `Somut bir örnek: bir balonun yarıçapı $r$ iken hacmi $V = (4/3)πr^3$.
1. Hacmin yarıçapa göre türevi $dV/dr = 4πr^2$.
2. $r = 3$ cm iken bu değer $4π · 9 ≈ 113$ cm³/cm eder.
3. Yani yarıçap 3 cm iken 1 mm daha şişirmek hacmi yaklaşık $113 · 0,1 ≈ 11,3$ cm³ artırır.
Dikkat edersen $4πr^2$ kürenin yüzey alanı: hacim, yüzeye ince bir kat eklenerek büyüyor.`,
    "soru-uret": `Kendini sınamak için üç soru:
1. $f(x) = 3x^2 − 4x$ ise $f′(2)$ kaçtır?
2. $g(x) = sin(x^2)$ fonksiyonunun türevini bul.
3. $y = x^3$ eğrisine $x = 1$ noktasında çizilen teğetin denklemi nedir?
**Cevaplar**
1. $f′(x) = 6x − 4$, dolayısıyla $f′(2) = 8$.
2. $g′(x) = cos(x^2) · 2x$.
3. Eğim $3$, nokta $(1, 1)$; teğet $y = 3x − 2$.`,
    formul: `Görüntüdeki tanım: $f′(a) = lim (f(a+h) − f(a))/h$, $h → 0$ iken.
1. $f(a+h) − f(a)$: $h$ kadar ilerleyince fonksiyondaki değişim.
2. Bölü $h$: bu değişimin birim başına oranı, yani kiriş doğrusunun eğimi.
3. $h → 0$: kiriş, noktaya teğet olan doğruya döner.
Teğetin denklemi: $y = f(a) + f′(a)(x − a)$.`,
    coz: `Örnek: $f(x) = x^3 − 3x$ fonksiyonunun $x = 2$ noktasındaki teğeti.
1. Türev: $f′(x) = 3x^2 − 3$.
2. Eğim: $f′(2) = 12 − 3 = 9$.
3. Nokta: $f(2) = 8 − 6 = 2$, yani $(2, 2)$.
4. Teğet: $y − 2 = 9(x − 2)$, yani $y = 9x − 16$.`,
    adim: `Adım adım, tanımdan $f(x) = x^2$ için türev:
1. Fark oranını yaz: $(f(x+h) − f(x))/h = ((x+h)^2 − x^2)/h$. Gerekçe: türevin tanımı.
2. Aç: $(x^2 + 2xh + h^2 − x^2)/h = (2xh + h^2)/h$.
3. Sadeleştir: $2x + h$. Gerekçe: $h ≠ 0$ iken bölme serbest.
4. Limit: $h → 0$ iken $2x + h → 2x$.
Sonuç: $f′(x) = 2x$.`,
    "ozetle-gorsel": `Bu bölgede üç şey var:
- Bir tanım: fonksiyonun bir noktadaki türevi, $f′(a) = lim (f(a+h) − f(a))/h$.
- Bir şekil: eğriye $a$ noktasında teğet olan doğru.
- Bir sonuç: teğetin denklemi $y = f(a) + f′(a)(x − a)$.
Kısaca bölge, türevin geometrik anlamını özetliyor.`,
  },
};
// İngilizce kipte aynı hazır cevaplar (aynı konu ve tuş kimlikleriyle)
const DENEME_KONU_EN = {
  zincir: {
    acikla: `The chain rule takes the derivative of a nested (composite) function one layer at a time.
1. Split the function into two layers: an outer function $f$ and an inner function $g$, so $F(x) = f(g(x))$.
2. Take the derivative of the outer function but leave the inside alone: $f′(g(x))$.
3. Multiply by the derivative of the inner function: $F′(x) = f′(g(x)) · g′(x)$.
Why a product? When $x$ changes a little, $u = g(x)$ changes $g′(x)$ times as much; when $u$ changes, $y$ changes $f′(u)$ times as much. Two magnifications in a row multiply.
In Leibniz notation, $dy/dx = (dy/du) · (du/dx)$; thinking of the $du$ terms as canceling helps you remember the rule.`,
    ozetle: `Summary in three lines:
- If $F(x) = f(g(x))$ is a composite function, then $F′(x) = f′(g(x)) · g′(x)$.
- In short: the outer derivative (inside unchanged) times the inner derivative.
- For example, for $y = (3x^2 + 1)^5$, $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.`,
    basitlestir: `Think of the chain rule as interlocking gears: gear $x$ turns gear $u$, and gear $u$ turns gear $y$.
If $u$ turns 3 times for each turn of $x$, and $y$ turns 2 times for each turn of $u$, then $y$ turns $3 · 2 = 6$ times for each turn of $x$.
Derivatives are these "how many times" ratios: $dy/dx = (dy/du) · (du/dx)$.
Practical rule: first take the derivative of the outermost operation without touching the inside, then multiply by the derivative of the inside expression.`,
    ornek: `A concrete example: $y = (3x^2 + 1)^5$.
1. Inner function $u = 3x^2 + 1$, outer function $y = u^5$.
2. Outer derivative: $dy/du = 5u^4 = 5(3x^2 + 1)^4$.
3. Inner derivative: $du/dx = 6x$.
4. Multiply: $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.
Check: at $x = 0$ you get $y′ = 0$. Indeed, $3x^2 + 1$ has its smallest value at $x = 0$, and the tangent is horizontal there.`,
    "soru-uret": `Three questions to test yourself:
1. If $y = sin(4x)$, what is $y′$?
2. Find the derivative of $y = ln(cos x)$.
3. What is $y′$ for $y = tan^2(3x)$? Hint: the chain rule is applied twice.
**Answers**
1. $y′ = cos(4x) · 4 = 4cos(4x)$.
2. $y′ = (1/cos x) · (−sin x) = −tan x$.
3. $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.`,
    formul: `The expression in the image is the chain rule: $F′(x) = f′(g(x)) · g′(x)$.
1. $F = f ∘ g$: the composite function that applies $g$ first, then $f$.
2. $g′(x)$: the rate of change of the inner function at $x$.
3. $f′(g(x))$: the derivative of the outer function, evaluated at $g(x)$, not at $x$. The most common mistake is writing $f′(x)$ here.
4. Leibniz form: if $u = g(x)$, then $dy/dx = (dy/du) · (du/dx)$.
Condition: $g$ must be differentiable at $x$, and $f$ must be differentiable at $g(x)$.`,
    coz: `Example 1 on the page: $y = (3x^2 + 1)^5$.
1. Separate the layers: $u = 3x^2 + 1$ and $y = u^5$.
2. Outer derivative: $dy/du = 5u^4$.
3. Inner derivative: $du/dx = 6x$.
4. Chain rule: $dy/dx = 5u^4 · 6x = 30x(3x^2 + 1)^4$.
Result: $y′ = 30x(3x^2 + 1)^4$.`,
    adim: `Step by step, with $y = tan^2(3x)$ from the exercises on the page:
1. Separate the layers: $y = u^2$, $u = tan v$, $v = 3x$. Reason: there are three nested operations, and each one brings a factor.
2. Outermost layer: $dy/du = 2u = 2tan(3x)$. Reason: the power rule, with the inside unchanged.
3. Middle layer: $du/dv = sec^2 v = sec^2(3x)$. Reason: $(tan v)′ = sec^2 v$.
4. Inner layer: $dv/dx = 3$.
5. Multiply: $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.
The number of factors should equal the number of layers; if one is missing, a layer was forgotten.`,
    "ozetle-gorsel": `This area has three parts:
- Theorem: if $F = f ∘ g$, then $F′(x) = f′(g(x)) · g′(x)$.
- Leibniz form: $dy/dx = (dy/du) · (du/dx)$.
- Example 1: for $y = (3x^2 + 1)^5$, $y′ = 30x(3x^2 + 1)^4$.
In short, the area sums up the derivative of a composite function as "outer derivative times inner derivative".`,
  },
  kapali: {
    acikla: `Implicit differentiation is how you take derivatives in equations where you can't isolate $y$ in terms of $x$.
1. Differentiate both sides of the equation with respect to $x$.
2. The chain rule applies to every term with $y$: since $y$ is a function of $x$, $(y^2)′ = 2y · y′$.
3. Gather the terms with $y′$ on one side and solve for $y′$.
Example: if $x^2 + y^2 = 25$, then $2x + 2y · y′ = 0$, so $y′ = −x/y$.
The result depends on both $x$ and $y$; you need both coordinates of the point to find the slope.`,
    ozetle: `Summary in three lines:
- Implicit differentiation lets you differentiate equations of the form $F(x, y) = c$ without isolating $y$.
- Every term with $y$ is differentiated with the chain rule and gets a factor of $y′$.
- For the circle $x^2 + y^2 = 25$, $y′ = −x/y$; at $(3, 4)$ the slope of the tangent is $−3/4$.`,
    basitlestir: `Some curves can't be written as "$y = ...$"; a circle is one of them, because one $x$ value gives two $y$ values.
With implicit differentiation you don't try to isolate $y$. You differentiate the equation as it is, and add a $y′$ to the end of every $y$ term, because $y$ changes when $x$ changes.
Circle $x^2 + y^2 = 25$: differentiating gives $2x + 2y · y′ = 0$, so $y′ = −x/y$.
At the upper right point $(3, 4)$ the slope is $−3/4$: the curve is going down there, as expected.`,
    ornek: `Example: the tangent to the curve $x^3 + y^3 = 6xy$ (folium of Descartes) at $(3, 3)$.
1. Is the point on the curve: $27 + 27 = 54 = 6 · 3 · 3$. Yes.
2. Differentiate both sides: $3x^2 + 3y^2 y′ = 6y + 6xy′$. The product rule was used on the right.
3. Collect $y′$: $y′(3y^2 − 6x) = 6y − 3x^2$, so $y′ = (2y − x^2)/(y^2 − 2x)$.
4. At $(3, 3)$: $y′ = (6 − 9)/(9 − 6) = −1$.
5. Tangent: $y − 3 = −(x − 3)$, so $y = −x + 6$.`,
    "soru-uret": `Three questions to test yourself:
1. What is the slope of the tangent to the circle $x^2 + y^2 = 25$ at $(−3, 4)$?
2. Find $y′$ for $x^2 + xy + y^2 = 7$.
3. What is $y′$ for $sin(x + y) = y$?
**Answers**
1. $y′ = −x/y = 3/4$.
2. $2x + y + xy′ + 2yy′ = 0$, so $y′ = −(2x + y)/(x + 2y)$.
3. $cos(x + y)(1 + y′) = y′$, so $y′ = cos(x + y)/(1 − cos(x + y))$.`,
    formul: `The result in the image is $y′ = −x/y$: the slope of the tangent at every point of the circle $x^2 + y^2 = 25$.
1. $x^2 + y^2 = 25$: the circle centered at the origin with radius $5$.
2. Differentiating gives $2x + 2y · y′ = 0$; the $2y · y′$ term comes from the chain rule.
3. $−x/y$: the slope depends on the point. At $(±5, 0)$, where $y = 0$, the tangent is vertical and the slope is undefined.
Geometric meaning: the slope of the radius is $y/x$ and the slope of the tangent is $−x/y$; their product is $−1$, so the tangent is perpendicular to the radius.`,
    coz: `The tangent to the circle on the page at $(3, 4)$:
1. Implicit derivative: $2x + 2y · y′ = 0$, so $y′ = −x/y$.
2. Slope at the point: $y′ = −3/4$.
3. Point-slope form: $y − 4 = −(3/4)(x − 3)$.
4. Rearrange: $y = −(3/4)x + 25/4$, or $3x + 4y = 25$.
Check: plugging in $(3, 4)$ gives $9 + 16 = 25$; the tangent passes through the point.`,
    adim: `Step by step, $y′$ for $x^3 + y^3 = 6xy$:
1. Differentiate the left side: $(x^3)′ = 3x^2$, $(y^3)′ = 3y^2 y′$. Reason: the $y$ term is differentiated with the chain rule.
2. Differentiate the right side: $(6xy)′ = 6y + 6xy′$. Reason: a product of $x$ and $y$, so the product rule.
3. Set them equal: $3x^2 + 3y^2 y′ = 6y + 6xy′$.
4. Move the $y′$ terms to the left and the rest to the right: $y′(3y^2 − 6x) = 6y − 3x^2$.
5. Divide and simplify: $y′ = (2y − x^2)/(y^2 − 2x)$.
Where the denominator is zero, the tangent is vertical.`,
    "ozetle-gorsel": `This area has three things:
- A curve: the circle $x^2 + y^2 = 25$ and the tangent line at one point.
- A method: both sides are differentiated with respect to $x$, and $y′$ is added to the $y$ terms.
- A result: $y′ = −x/y$; the tangent is perpendicular to the radius at every point.
In short, the area shows how to find a slope without isolating $y$.`,
  },
  difdenk: {
    acikla: `In a separable differential equation, the $y$ terms can be gathered on one side and the $x$ terms on the other.
1. Write $dy/dx = 2y$ instead of $y′ = 2y$.
2. Separate the variables: $dy/y = 2dx$.
3. Integrate both sides: $ln|y| = 2x + c$.
4. Exponentiate: $y = Ce^{2x}$, where $C = ±e^c$.
5. The initial condition fixes the constant: if $y(0) = 3$, then $C = 3$, so $y = 3e^{2x}$.
Meaning: the rate of change is proportional to the current amount. Population, compound interest and bacterial growth all fit this pattern.`,
    ozetle: `Summary in three lines:
- An equation of the form $y′ = ky$ is solved by separating the variables: $dy/y = k dx$.
- The general solution is $y = Ce^{kx}$; $C$ comes from the initial condition.
- In the example on the page, $y′ = 2y$ with $y(0) = 3$ gives $y = 3e^{2x}$; check: $y′ = 6e^{2x} = 2y$.`,
    basitlestir: `Think of money in a bank: interest is earned on whatever is in the account at that moment. As the money grows, the growth speeds up too.
$y′ = 2y$ says exactly this: the rate of growth is twice the current amount.
Anything that grows like this follows an exponential formula: $y = Ce^{2x}$. $C$ is the starting amount; if $y(0) = 3$, then $y = 3e^{2x}$.`,
    ornek: `A concrete example: radioactive decay. The amount of substance is $y$, and it decreases at a rate proportional to the amount: $y′ = −0.1y$, starting at $y(0) = 50$ g.
1. Separate: $dy/y = −0.1dt$.
2. Integrate: $ln|y| = −0.1t + c$, so $y = Ce^{−0.1t}$.
3. Condition: $C = 50$, so $y = 50e^{−0.1t}$.
4. Half-life: if $50e^{−0.1t} = 25$, then $t = ln 2/0.1 ≈ 6.93$.
With the sign flipped, the same equation describes growth.`,
    "soru-uret": `Three questions to test yourself:
1. Solve $y′ = 3y$, $y(0) = 2$.
2. Find the general solution of $y′ = xy$.
3. Show that $y = 3e^{2x}$ satisfies $y′ = 2y$.
**Answers**
1. $y = 2e^{3x}$.
2. $dy/y = xdx$, $ln|y| = x²/2 + c$, so $y = Ce^{x²/2}$.
3. $y′ = 6e^{2x} = 2 · 3e^{2x} = 2y$.`,
    formul: `The result in the image, $y = 3e^{2x}$, is the solution of $y′ = 2y$.
1. $e^{2x}$: a function whose derivative is $2$ times itself; exactly what the equation asks for.
2. $3$: the initial value, $y = 3$ when $x = 0$.
3. The $2$ in the exponent: the growth rate. The larger it is, the faster the curve steepens.
Check: $y′ = 6e^{2x} = 2y$.`,
    coz: `Example: $y′ = 2y$, $y(0) = 3$.
1. Separate: $dy/y = 2dx$.
2. Integrate: $ln|y| = 2x + c$.
3. Exponentiate: $y = Ce^{2x}$.
4. Condition: $y(0) = C = 3$.
Result: $y = 3e^{2x}$. Check: $y′ = 6e^{2x} = 2y$.`,
  },
  statik: {
    acikla: `Problem 2.7 is an equilibrium problem for a simply supported beam. The beam rests on a pin support at $A$ (two reactions: $A_x$, $A_y$) and a roller support at $B$ (one reaction: $B_y$).
1. Free body diagram: remove the supports and draw the reaction forces in their place. Loads: $12$ kN at $C$ and $4$ kN/m along $CB$.
2. Replace the distributed load with its resultant: $4 · 2 = 8$ kN, at the middle of $CB$, so $4$ m from $A$.
3. Write the equilibrium equations: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM_A = 0$. Three unknowns, three equations.
4. Taking moments about $A$ drops $A_x$ and $A_y$ from the equation, so $B_y$ comes out directly.
Shear force and bending moment are found by cutting the beam at a point and looking at the equilibrium of the left part.`,
    ozetle: `Summary in three lines:
- $A$ is a pin support ($A_x$, $A_y$) and $B$ is a roller ($B_y$); the loads are a $12$ kN point load and $4$ kN/m distributed.
- From equilibrium, $A_x = 0$, $A_y = 6.4$ kN, $B_y = 13.6$ kN.
- The largest bending moment is at $C$: $M_C = 19.2$ kN·m.`,
    basitlestir: `Think of the beam as a plank carried on the shoulders of two people. $A$ and $B$ are the two carriers, and the loads are weights placed on the plank.
Whoever is closer to the weight carries more. Here most of the load is near $B$, so $B_y = 13.6$ kN and $A_y = 6.4$ kN.
The total load is $12 + 8 = 20$ kN; the two carriers' shares also add up to $20$ kN.
Moment is the turning effect on the plank: force times distance. If the plank isn't turning, the turning effects in the two directions cancel out.`,
    coz: `Problem 2.7: $AC = 3$ m, $CB = 2$ m.
1. No horizontal load: $A_x = 0$.
2. The resultant of the distributed load is $4 · 2 = 8$ kN, $4$ m from $A$.
3. $ΣM_A = 0$: $B_y · 5 − 12 · 3 − 8 · 4 = 0$, so $B_y = 68/5 = 13.6$ kN.
4. $ΣF_y = 0$: $A_y = 12 + 8 − 13.6 = 6.4$ kN.
5. Check with moments about $B$: $6.4 · 5 − 12 · 2 − 8 · 1 = 32 − 24 − 8 = 0$.
The shear force is $6.4$ kN along $AC$; at $C$ it drops by $12$ kN to $−5.6$ kN, and falls to $−13.6$ kN at $B$. The moment is largest at $C$, where the shear changes sign: $M_C = 6.4 · 3 = 19.2$ kN·m.`,
    adim: `Shear and moment step by step; the reactions are $A_y = 6.4$ kN, $B_y = 13.6$ kN:
1. $0 < x < 3$ (between $A$ and $C$): only $A_y$ is to the left of the cut. $V = 6.4$ kN, $M = 6.4x$. Reason: equilibrium of the left part.
2. Point load at $C$: the shear drops suddenly by $12$ kN, $V = −5.6$ kN. The moment stays continuous: $M_C = 19.2$ kN·m.
3. $3 < x < 5$ (between $C$ and $B$): $V = −5.6 − 4(x − 3)$, $M = 6.4x − 12(x − 3) − 2(x − 3)^2$. Reason: a distributed load changes the shear linearly and the moment parabolically.
4. At $x = 5$, $M = 32 − 24 − 8 = 0$. The moment must be zero at the roller; the check works.
Rule: $dM/dx = V$. Where the shear crosses zero, the moment peaks; here that is $C$.`,
    formul: `The basic expressions in beam problems are the equilibrium equations:
1. $ΣF_x = 0$ and $ΣF_y = 0$: the beam isn't translating, so the forces add up to zero.
2. $ΣM_A = 0$: the beam isn't rotating; the moments about any point add up to zero. Moment is force times perpendicular distance, in kN·m.
3. The resultant of a distributed load is $W = q · L$; it acts at the centroid of the load area. Here $W = 4 · 2 = 8$ kN.
4. The internal forces are related by $dV/dx = −q$ and $dM/dx = V$.
Choose a sign convention at the start and keep it to the end.`,
    "soru-uret": `Three questions to test yourself:
1. How many reaction components do a pin support and a roller support give?
2. A $10$ kN point load is placed at the middle of a simply supported beam with a $6$ m span. What are the support reactions and the largest moment?
3. A $3$ kN/m distributed load acts over $4$ m. What is its resultant, and where does it act?
**Answers**
1. A pin support gives two ($A_x$, $A_y$), a roller gives one ($B_y$).
2. By symmetry $A_y = B_y = 5$ kN; $M_{max} = 5 · 3 = 15$ kN·m, at the middle of the beam.
3. $W = 3 · 4 = 12$ kN, at the middle of the loaded region.`,
    "ozetle-gorsel": `This area has three things:
- A beam: a pin support at $A$ and a roller at $B$; spans of $3$ m and $2$ m.
- Loads: $12$ kN at $C$ and $4$ kN/m distributed along $CB$.
- What's asked: a free body diagram, the support reactions, and the shear and moment diagrams.
In short, the area asks you to set up the equilibrium of a beam step by step.`,
  },
  anatomi: {
    acikla: `The brachial plexus (plexus brachialis) is the network of nerves that supplies the motor and sensory nerves of the upper limb.
1. Roots: the anterior rami of spinal nerves C5, C6, C7, C8 and T1.
2. Trunks: superior (C5, C6), middle (C7) and inferior (C8, T1).
3. Divisions: each trunk splits into an anterior and a posterior division; anterior divisions go to flexors, posterior divisions to extensors.
4. Cords: lateral, posterior and medial, named for their position relative to the axillary artery.
5. Terminal branches: the musculocutaneous nerve from the lateral cord, the axillary and radial nerves from the posterior cord, the ulnar nerve from the medial cord; the median nerve forms from one root each of the lateral and medial cords.
Numbers to memorize: 5 roots, 3 trunks, 6 divisions, 3 cords, 5 terminal branches.`,
    ozetle: `Summary in three lines:
- The plexus forms from the anterior rami of C5 to T1: roots, trunks, divisions, cords, terminal branches.
- Five terminal branches: musculocutaneous, axillary, radial, median and ulnar.
- Clinically, upper trunk injury causes Erb palsy (C5, C6), and lower trunk injury causes Klumpke palsy (C8, T1).`,
    basitlestir: `Think of the plexus as a city's power distribution center. Five cables come from the spinal cord (C5 to T1), join and mix in the center, and leave for the arm as five main lines.
The benefit of mixing: even if one root is damaged, no muscle loses power completely, because most nerves carry fibers from more than one root.
Roughly what the five main lines do:
- Musculocutaneous: the front of the arm; bends the elbow.
- Axillary: the deltoid, which lifts the arm to the side.
- Radial: the back of the arm and forearm; extends the wrist and fingers.
- Median: most of the front of the forearm and the thumb muscles.
- Ulnar: most of the small muscles of the hand, fine finger movements.`,
    ornek: `A clinical example: a fracture of the middle of the humeral shaft.
1. The radial nerve runs close to the bone in the radial groove on the back of the humerus; it is easily injured in a fracture.
2. Result: the wrist and finger extensors stop working and the wrist drops (wrist drop). There is sensory loss on the back of the hand, between the thumb and index finger.
3. The triceps is usually spared, because its branches leave before the nerve enters the groove.
By the same logic, a surgical neck fracture of the humerus endangers the axillary nerve, and trauma to the medial epicondyle endangers the ulnar nerve.`,
    adim: `Draw the plexus on paper step by step:
1. On the left, write the five roots one under another: C5, C6, C7, C8, T1.
2. Join C5 and C6 (superior trunk), continue C7 straight (middle trunk), join C8 and T1 (inferior trunk).
3. Split each trunk in two: an anterior division and a posterior division.
4. Join the three posterior divisions: the posterior cord. The anterior divisions of the superior and middle trunks form the lateral cord, and the anterior division of the inferior trunk forms the medial cord.
5. Add the branches: musculocutaneous from the lateral cord, axillary and radial from the posterior cord, ulnar from the medial cord. Take one root each from the lateral and medial cords and draw an M in the middle: the median nerve.
The M shape in the middle is the easiest sign for recognizing the plexus in dissection and imaging.`,
    "soru-uret": `Three questions to test yourself:
1. Which cord lies behind the axillary artery, and which terminal branches does it give?
2. After a difficult birth, a baby's arm is internally rotated, with the forearm extended and pronated. Which roots are affected?
3. Which nerve is compressed in carpal tunnel syndrome, and what are the first signs?
**Answers**
1. The posterior cord; the axillary and radial nerves.
2. C5 and C6, the superior trunk: Erb-Duchenne palsy (waiter's tip hand).
3. The median nerve; numbness in the thumb, index finger, middle finger and half of the ring finger, later weakness and wasting of the thenar muscles.`,
  },
  logturev: {
    acikla: `Logarithmic differentiation is a way to simplify a function full of products, quotients and powers before differentiating it.
1. Take the natural log of both sides: $ln y = ln f(x)$.
2. Use the log rules to turn products into sums, quotients into differences and powers into coefficients: $ln(ab) = ln a + ln b$, $ln(a/b) = ln a − ln b$, $ln a^n = n ln a$.
3. Differentiate implicitly with respect to $x$: the left side becomes $y′/y$.
4. Multiply by $y$: $y′ = y · (...)$.
When both the base and the exponent vary (like $x^x$), this is the only way; neither the power rule nor the exponential rule works alone.`,
    ozetle: `Summary in three lines:
- Take the log of both sides, turning products and quotients into sums.
- Implicit differentiation gives $y′/y$, which is then multiplied by $y$.
- Example: for $y = x^x$, $ln y = x ln x$, so $y′ = x^x(ln x + 1)$.`,
    basitlestir: `The derivative of a product is tedious; the derivative of a sum is easy. A logarithm is like a machine that turns products into sums.
So first you take $ln$: products become sums, quotients become differences, powers become the numbers in front. Then you differentiate each term separately.
Don't forget one thing at the end: since the derivative of $ln y$ is $y′/y$, you multiply the answer by $y$.`,
    ornek: `Example: $y = x^x$ for $x > 0$.
1. Take the log: $ln y = x ln x$.
2. Differentiate: $y′/y$ on the left, and on the right, by the product rule, $ln x + x · (1/x) = ln x + 1$.
3. Multiply by $y$: $y′ = x^x(ln x + 1)$.
Check: at $x = 1$, $y′ = 1$; the slope of $x^x$ at $(1, 1)$ really is $1$.`,
    coz: `Example 3 on the page: $y = x^{3/4} √(x^2 + 1)/(3x + 2)^5$.
1. Take the log: $ln y = (3/4)ln x + (1/2)ln(x^2 + 1) − 5ln(3x + 2)$.
2. Differentiate: $y′/y = 3/(4x) + x/(x^2 + 1) − 15/(3x + 2)$.
3. Multiply by $y$: $y′ = y · (3/(4x) + x/(x^2 + 1) − 15/(3x + 2))$, where $y$ is the original expression.
Each term was differentiated on its own; reaching the same result with the quotient rule would take much longer.`,
    adim: `Step by step, with $y = x^{sin x}$ from the exercises:
1. Take the log: $ln y = sin x · ln x$. Reason: $ln a^b = b ln a$, the exponent comes down.
2. Differentiate the right side with the product rule: $cos x · ln x + sin x · (1/x)$.
3. Left side: $(ln y)′ = y′/y$. Reason: the chain rule.
4. Multiply by $y$: $y′ = x^{sin x}(cos x · ln x + sin x/x)$.
When both the base and the exponent vary, this is the only clean way.`,
    formul: `The chain in the image: $ln y = x ln x$, then $y′/y = ln x + 1$, then $y′ = x^x(ln x + 1)$.
1. $ln y = x ln x$: the log brings the exponent down; now the product rule is enough.
2. $y′/y$: the derivative of $ln y$ with respect to $x$, from the chain rule.
3. $ln x + 1$: the derivative of $x ln x$ by the product rule, $1 · ln x + x · (1/x)$.
4. In the last step both sides are multiplied by $y = x^x$.`,
    "soru-uret": `Three questions to test yourself:
1. What is $y′$ for $y = x^{√x}$?
2. Find the derivative of $y = (x^2 + 1)^3(x − 2)^4$ with logarithmic differentiation.
3. When is logarithmic differentiation required?
**Answers**
1. $ln y = √x ln x$, $y′/y = (ln x + 2)/(2√x)$, so $y′ = x^{√x}(ln x + 2)/(2√x)$.
2. $y′ = (x^2 + 1)^3(x − 2)^4 · (6x/(x^2 + 1) + 4/(x − 2))$.
3. When both the base and the exponent vary; for example $x^x$ or $x^{sin x}$.`,
    "ozetle-gorsel": `This area has three things:
- The method: log of both sides, simplify, differentiate implicitly, multiply by $y$.
- Example 3: an expression with products and quotients turns into a sum of three terms with logs.
- Example 4: for $y = x^x$, $y′ = x^x(ln x + 1)$.
In short, the area shows how to simplify complicated expressions with logs before differentiating.`,
  },
  statik26: {
    acikla: `A simply supported beam rests on a pin support at one end and a roller at the other. The pin gives two reactions ($A_x$, $A_y$), the roller gives one ($B_y$).
1. In the plane there are three equilibrium equations for the three unknowns: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM = 0$. So the beam is statically determinate and can be solved with statics alone.
2. The distributed load is replaced with its resultant: in Example 2.6, $4 · 6 = 24$ kN, at the middle of the span, $3$ m from $A$.
3. Taking moments about $A$ drops $A_x$ and $A_y$, so $B_y$ comes out directly.
Result: $A_x = 0$, $B_y = 18$ kN, $A_y = 24$ kN.`,
    ozetle: `Summary in three lines:
- In a simply supported beam, the pin gives $A_x$ and $A_y$ and the roller gives $B_y$; the beam is statically determinate.
- The distributed load is replaced with its resultant: $W = w · L$, at the middle of the loaded region.
- Example 2.6: $A_x = 0$, $A_y = 24$ kN, $B_y = 18$ kN.`,
    basitlestir: `Think of the beam as a plank carried on the shoulders of two people: $A$ and $B$ are the two carriers.
The total load is $18 + 24 = 42$ kN. The distributed load is shared equally by the two ends, but the $18$ kN point load is closer to $A$ ($2$ m). So $A$ carries more: $A_y = 24$ kN, $B_y = 18$ kN.
Moment is the turning effect on the plank: force times distance. If the plank isn't turning, the turning effects in the two directions cancel out.`,
    coz: `Example 2.6: $AB = 6$ m, $w = 4$ kN/m over the whole span, $P = 18$ kN at $C$, $2$ m from $A$.
1. No horizontal load: $A_x = 0$.
2. The resultant of the distributed load is $4 · 6 = 24$ kN, $3$ m from $A$.
3. $ΣM_A = 0$: $6B_y − 18 · 2 − 24 · 3 = 0$, so $B_y = 108/6 = 18$ kN.
4. $ΣF_y = 0$: $A_y = 18 + 24 − 18 = 24$ kN.
5. Check with moments about $B$: $24 · 6 − 18 · 4 − 24 · 3 = 144 − 72 − 72 = 0$.`,
    adim: `Support reactions step by step:
1. Free body diagram: remove the supports and draw $A_x$, $A_y$, $B_y$ in their place. Reason: what is in equilibrium is the sum of the external forces.
2. Turn the distributed load into a single $24$ kN force and place it at $x = 3$ m. Reason: the resultant acts at the centroid of the load area.
3. $ΣM_A = 0$: $6B_y = 18 · 2 + 24 · 3 = 108$, so $B_y = 18$ kN. Reason: the unknowns at $A$ have no moment about $A$.
4. $ΣF_y = 0$: $A_y = 42 − 18 = 24$ kN.
5. $ΣF_x = 0$: $A_x = 0$.
To check, take moments about $B$; it should come out to zero.`,
    "ozetle-gorsel": `This area has three things:
- A definition: in a simply supported beam, the pin gives two reactions and the roller gives one.
- Example 2.6: a $6$ m beam, $4$ kN/m over the whole span and $18$ kN at $C$.
- The solution: $ΣM_A = 0$ gives $B_y = 18$ kN, and $ΣF_y = 0$ gives $A_y = 24$ kN.
In short, the area shows the path from the free body diagram to the reactions.`,
  },
  statikVM: {
    acikla: `Shear force $V$ and bending moment $M$ are found by cutting the beam at a point and looking at the equilibrium of the part on one side.
1. Relation to the load: $dV/dx = −w(x)$. Under a distributed load $V$ decreases linearly; with no load it stays constant.
2. Relation to the shear: $dM/dx = V(x)$. When $V$ is positive $M$ increases; when it is negative $M$ decreases.
3. Under a point load, $V$ jumps by the size of the load; $M$ has a kink there but stays continuous.
4. $M$ is largest where $V$ changes sign.
In Example 2.6, $V$ jumps from $+16$ to $−2$ at $C$; $M_{max} = 24 · 2 − 2 · 2^2 = 40$ kN·m.`,
    ozetle: `Summary in three lines:
- Method of sections: $V$ and $M$ come from the equilibrium of the part on one side of the cut.
- $dV/dx = −w$ and $dM/dx = V$; under a point load, $V$ jumps.
- In Example 2.6, $V$ jumps from $+16$ to $−2$ at $C$, and $M_{max} = 40$ kN·m.`,
    basitlestir: `Shear force is the force that tries to slide the two parts of the beam up and down past each other when you cut it at a point. Moment is the effect that tries to bend the beam at that point.
The two are linked: the slope of the moment graph is the shear force. When the shear crosses zero, the moment peaks; just as a ball thrown in the air is highest at the moment its speed is zero.
In Example 2.6 that moment is point $C$: $M_{max} = 40$ kN·m.`,
    coz: `Example 2.6 (continued): $A_y = 24$ kN, $B_y = 18$ kN.
1. $0 ≤ x < 2$: $V = 24 − 4x$, $M = 24x − 2x^2$.
2. The $18$ kN at $C$: $V$ jumps from $24 − 8 = 16$ to $16 − 18 = −2$.
3. $2 < x ≤ 6$: $V = 6 − 4x$, $M = 36 + 6x − 2x^2$.
4. Ends: $M(0) = 0$ and $M(6) = 36 + 36 − 72 = 0$. The moment is zero at the supports; the check works.
5. The largest moment is at $x = 2$, where $V$ changes sign: $M_{max} = 40$ kN·m.`,
    adim: `The method of sections step by step (Example 2.6):
1. Cut at point $x$ and take the left part. Reason: the left part has fewer forces.
2. $0 ≤ x < 2$: on the left are $A_y = 24$ kN and a distributed load of $4x$ kN. $ΣF_y = 0$ gives $V = 24 − 4x$.
3. Moment about the cut: $M = 24x − 4x · (x/2) = 24x − 2x^2$. Reason: the resultant of the distributed load is at the middle of the part.
4. $x > 2$: the $18$ kN also enters the left part. $V = 6 − 4x$, $M = 24x − 2x^2 − 18(x − 2) = 36 + 6x − 2x^2$.
5. Check: $dM/dx = 6 − 4x = V$. The relation holds.`,
    formul: `The relations in the image: $dV/dx = −w(x)$ and $dM/dx = V(x)$.
1. $w(x)$: the distributed load per unit length, positive downward.
2. $dV/dx = −w$: the slope of the $V$ diagram is the negative of the load. With no load, $V$ is flat.
3. $dM/dx = V$: the slope of the $M$ diagram is the shear force. Where $V = 0$, $M$ peaks.
4. Integral form: the difference in $M$ between two sections equals the area of the $V$ diagram between them.`,
    "soru-uret": `Three questions to test yourself:
1. On a stretch with no distributed load, what do the $V$ and $M$ diagrams look like?
2. If $V(x) = 10 − 2x$ on a stretch, at what $x$ is $M$ largest?
3. If $20$ kN is placed at the middle of a $5$ m simple beam, what is the largest moment?
**Answers**
1. $V$ constant, $M$ linear.
2. Where $V = 0$: $x = 5$.
3. The reactions are $10$ kN each; $M_{max} = 10 · 2.5 = 25$ kN·m, at the middle.`,
  },
  anatomiKas: {
    acikla: `The arm is divided into two compartments, and each compartment has its own nerve; that is the key to remembering the table.
1. Anterior (flexor) compartment: biceps brachii, brachialis, coracobrachialis. All three are innervated by the musculocutaneous nerve.
2. Posterior (extensor) compartment: triceps brachii and anconeus. They are innervated by the radial nerve.
3. The biceps both flexes the forearm and is the strongest supinator; supination is strongest with the elbow flexed.
4. The brachialis flexes the elbow whatever the position of the forearm; it is the main flexor.
5. The long head of the triceps also crosses the shoulder joint, so it also extends and adducts the arm.`,
    ozetle: `Summary in three lines:
- Anterior compartment (biceps, brachialis, coracobrachialis): musculocutaneous nerve.
- Posterior compartment (triceps, anconeus): radial nerve.
- The biceps is the strongest supinator and the brachialis the main elbow flexor; in a humeral shaft fracture the radial nerve can be injured, causing wrist drop.`,
    basitlestir: `Think of the arm as benders in front and straighteners in back.
The ones in front bend the elbow, and all three share one nerve: musculocutaneous. The triceps in back straightens the elbow; its nerve is the radial.
The biceps also turns the palm up (supination). It is the strong muscle working when you open a jar lid or drive a screw with your right hand.`,
    ornek: `An everyday example: driving a screw with a screwdriver in your right hand is a supination movement.
1. The strongest muscle for this movement is the biceps brachii.
2. Because the biceps attaches to the radial tuberosity, it rotates the radius around its own axis.
3. Supination is strongest with the elbow bent at about 90 degrees; that is why driving a screw is easier with the arm bent rather than straight.
The clinical side: if the radial nerve is injured in a humeral shaft fracture, the triceps is usually spared but the wrist extensors stop working and the wrist drops.`,
    "soru-uret": `Three questions to test yourself:
1. Where does the brachialis insert, and what does it do?
2. Where do the two heads of the biceps brachii originate?
3. After a humeral shaft fracture, the patient can't lift the hand at the wrist. Which nerve is injured, and where?
**Answers**
1. The coronoid process and the ulnar tuberosity; it is the main flexor of the forearm at the elbow.
2. The long head from the supraglenoid tubercle, the short head from the coracoid process.
3. The radial nerve, in the radial groove on the back of the humerus.`,
  },
  anatomiFossa: {
    acikla: `The cubital fossa (fossa cubitalis) is the triangular hollow in front of the elbow.
1. Borders: above, the line between the two epicondyles; laterally the brachioradialis, medially the pronator teres.
2. The floor is the brachialis and supinator; the roof is fascia and the bicipital aponeurosis.
3. Contents, from lateral to medial: the biceps brachii tendon, the brachial artery, the median nerve. Mnemonic: TAN (Tendon, Artery, Nerve).
4. The radial nerve stays at the lateral edge, under the brachioradialis.
Clinical importance: venous blood is drawn from the superficial veins here, and when measuring blood pressure the stethoscope goes over the brachial artery.`,
    ozetle: `Summary in three lines:
- A triangular hollow in front of the elbow, bordered laterally by the brachioradialis and medially by the pronator teres.
- Contents from lateral to medial, TAN: biceps tendon, brachial artery, median nerve.
- Blood draws and blood pressure measurements are done in this area.`,
    basitlestir: `Think of the hollow on the inside of your elbow. Two muscles draw a V: the brachioradialis on the outside, the pronator teres on the inside.
Inside the hollow, three things lie side by side from outside to inside: the biceps tendon, the artery and the nerve. TAN for short.
The veins used for blood draws are on top of these, just under the skin.`,
    ornek: `A clinical example: drawing blood at the elbow.
1. The needle enters the superficial veins, most often the median cubital vein.
2. The bicipital aponeurosis lies under this vein and covers the brachial artery and median nerve, protecting the deeper structures.
3. If the needle goes too deep and too medial, the artery or the median nerve can be injured.
So if the vein can't be found, another vessel is chosen instead of probing deeper and further in.`,
    "soru-uret": `Three questions to test yourself:
1. Which muscles form the medial and lateral borders of the cubital fossa?
2. List its contents from lateral to medial.
3. When drawing blood, which structure protects the deeper artery and nerve?
**Answers**
1. Medially the pronator teres, laterally the brachioradialis.
2. The biceps brachii tendon, the brachial artery, the median nerve.
3. The bicipital aponeurosis.`,
  },
  turev: {
    acikla: `The core idea here: the derivative is the instantaneous rate of change of a quantity.
1. First write the average change between two points: $(f(x+h) − f(x))/h$.
2. Then shrink the interval. If this ratio approaches a number as $h → 0$, that number is $f′(x)$.
3. Geometric meaning: $f′(x)$ is the slope of the line tangent to the graph at $x$.
For example, for $f(x) = x^2$ the ratio is $2x + h$; as $h → 0$, $f′(x) = 2x$.`,
    ozetle: `Summary in three lines:
- The derivative is a function's instantaneous rate of change at a point: as $h → 0$, $f′(x) = lim (f(x+h) − f(x))/h$.
- On the graph this number equals the slope of the tangent line.
- The product, quotient and chain rules let you differentiate without going back to the limit every time; for example $(x^3)′ = 3x^2$.`,
    basitlestir: `Think of a car's speedometer. If you drove 60 km in an hour, your average speed is 60 km/h, but the speedometer shows your speed right now. The derivative is that speedometer.
If the distance is $s(t)$, the instantaneous speed is $s′(t)$. For example, if $s(t) = 5t^2$, then $s′(t) = 10t$; at 3 seconds the speed is $10 · 3 = 30$ m/s.
In short: average speed looks at the span between two moments, the derivative looks at a single moment.`,
    ornek: `A concrete example: the volume of a balloon with radius $r$ is $V = (4/3)πr^3$.
1. The derivative of the volume with respect to the radius is $dV/dr = 4πr^2$.
2. At $r = 3$ cm this is $4π · 9 ≈ 113$ cm³/cm.
3. So at a radius of 3 cm, inflating it 1 mm more increases the volume by about $113 · 0.1 ≈ 11.3$ cm³.
Notice that $4πr^2$ is the surface area of the sphere: the volume grows by adding a thin layer to the surface.`,
    "soru-uret": `Three questions to test yourself:
1. If $f(x) = 3x^2 − 4x$, what is $f′(2)$?
2. Find the derivative of $g(x) = sin(x^2)$.
3. What is the equation of the tangent to $y = x^3$ at $x = 1$?
**Answers**
1. $f′(x) = 6x − 4$, so $f′(2) = 8$.
2. $g′(x) = cos(x^2) · 2x$.
3. Slope $3$, point $(1, 1)$; the tangent is $y = 3x − 2$.`,
    formul: `The definition in the image: $f′(a) = lim (f(a+h) − f(a))/h$, as $h → 0$.
1. $f(a+h) − f(a)$: the change in the function when you move forward by $h$.
2. Divided by $h$: the rate of this change per unit, that is, the slope of the secant line.
3. $h → 0$: the secant turns into the line tangent at the point.
The tangent line's equation: $y = f(a) + f′(a)(x − a)$.`,
    coz: `Example: the tangent to $f(x) = x^3 − 3x$ at $x = 2$.
1. Derivative: $f′(x) = 3x^2 − 3$.
2. Slope: $f′(2) = 12 − 3 = 9$.
3. Point: $f(2) = 8 − 6 = 2$, so $(2, 2)$.
4. Tangent: $y − 2 = 9(x − 2)$, so $y = 9x − 16$.`,
    adim: `Step by step, the derivative of $f(x) = x^2$ from the definition:
1. Write the difference quotient: $(f(x+h) − f(x))/h = ((x+h)^2 − x^2)/h$. Reason: the definition of the derivative.
2. Expand: $(x^2 + 2xh + h^2 − x^2)/h = (2xh + h^2)/h$.
3. Simplify: $2x + h$. Reason: dividing is allowed while $h ≠ 0$.
4. Limit: as $h → 0$, $2x + h → 2x$.
Result: $f′(x) = 2x$.`,
    "ozetle-gorsel": `This area has three things:
- A definition: the derivative of a function at a point, $f′(a) = lim (f(a+h) − f(a))/h$.
- A figure: the line tangent to the curve at $a$.
- A result: the tangent line's equation, $y = f(a) + f′(a)(x − a)$.
In short, the area sums up the geometric meaning of the derivative.`,
  },
};
// Görsel tuşu konuda yoksa en yakın metin cevabı
const DENEME_YEDEK = { formul: "acikla", coz: "ornek", adim: "acikla", "ozetle-gorsel": "ozetle", ozetle: "acikla", ornek: "coz" };
// Alt konuda olmayan tuş ana konudan gelir (kesme-moment sayfasında "Örnek ver" ana konunun çözümü olmasın diye önce yedek)
const ANA_KONU = { statik26: "statik", statikVM: "statik", anatomiKas: "anatomi", anatomiFossa: "anatomi" };

/* ---------- metinden kurulan cevaplar (edebî ve genel) ---------- */
function cumleler(t) {
  return (String(t).replace(/\s+/g, " ").match(/[^.!?…]+(?:[.!?…]+["”»’]*|$)/g) || []).map((s) => s.trim()).filter((s) => s.length > 2);
}
const kisalt = (s, n = 110) => {
  s = String(s).trim();
  if (s.length <= n) return s;
  const k = s.lastIndexOf(" ", n);
  return s.slice(0, k > n / 2 ? k : n).replace(/[,;:]$/, "") + "…";
};
const EDEBI_TEMALAR = [
  { re: /kenar|not(?:u|lar|un)|kalem|derkenar|altını çiz/i, ad: "okurun metinle kurduğu sessiz konuşma",
    sade: "Bir kitabın kenarına yazılan not, okurun yazara verdiği cevaptır. Yıllar sonra o notu okuyan biri, hem kitabı hem de ondan önceki okuru dinler.",
    ornek: "Kütüphaneden aldığın bir kitapta birinin kurşun kalemle düştüğü notu düşün. Yazanı tanımazsın, ama aynı cümlede durup düşündüğünüzü bilirsin. Metnin anlattığı duygu bu: iki yabancı arasında sayfa üstünde kurulan bir yakınlık.",
    dikkat: "küçük bir nesne, bir not ya da bir çizgi, büyük bir soruyu taşıyor. Okumak gerçekten yalnız yapılan bir iş mi?" },
  { re: /mürekkep|harf|alfabe|yazı|hattat|matbaa/i, ad: "yazının kalıcılığı ve kuşaktan kuşağa geçen bilgi",
    sade: "Yazı, insanın unutmaya karşı bulduğu çaredir. Kâğıda geçen şey, yazan kişiden daha uzun yaşar ve sonraki kuşaklara ulaşır.",
    ornek: "Ailende el yazısıyla tutulmuş bir tarif defteri varsa onu düşün. Tarifin yanına sonradan eklenmiş küçük notlar, defteri yalnız bir yemek kitabı olmaktan çıkarır; bir aile tarihine dönüştürür.",
    dikkat: "yazı aracının (mürekkep, harf, kâğıt) kendisi de anlatının bir kahramanı gibi ele alınıyor." },
  { re: /zaman|yıl|eski|sarar|hafıza|hatırla|unut|geçmiş/i, ad: "zaman ve hafıza",
    sade: "Zaman geçtikçe şeyler eskir, ama üstlerinde iz kalır. Metin, o izlere bakarak geçmişi yeniden düşünmeyi anlatıyor.",
    ornek: "Eski bir fotoğrafın arkasına yazılmış bir tarih düşün. Fotoğraftaki kişiyi tanımasan bile o tarih sana bir an, bir hayat ve kaybolmuş bir bağlam hakkında bir şey söyler.",
    dikkat: "anlatıcı geçmişi doğrudan anlatmıyor; nesnelerin üstünde kalan izlerden okuyor." },
  { re: /mektup|cevap|ses|konuş/i, ad: "gecikmiş bir iletişim",
    sade: "Bazen bir söz, yazıldığı anda değil yıllar sonra karşılığını bulur. Metin bu gecikmiş karşılaşmayı anlatıyor.",
    ornek: "Yıllar önce birine yazılmış ama hiç gönderilmemiş bir mektubu bulduğunu düşün. Sana yazılmamıştır, ama okuduğun anda bir cevap bekliyormuş gibi gelir.",
    dikkat: "konuşma bir kişiyle değil, zamanın öbür ucundaki bir okurla kuruluyor." },
];
const EDEBI_GENEL = { ad: "okumanın insanda bıraktığı iz",
  sade: "Metin, bir deneyimi anlatıp okuru kendi deneyimini düşünmeye çağırıyor. Önemli olan olayların kendisi değil, bıraktıkları duygu.",
  ornek: "Bir kitabı yıllar sonra yeniden okuduğunu düşün. Aynı cümleler bu kez başka yerlerinden dokunur; değişen kitap değil, okurdur.",
  dikkat: "anlatıcı somut ayrıntılardan yola çıkıp genel bir düşünceye varıyor." };

function edebiCevap(hazir, metin) {
  const c = cumleler(metin);
  const tema = EDEBI_TEMALAR.find((t) => t.re.test(metin)) || EDEBI_GENEL;
  const benBir = /(?<!\p{L})(?:ben|bana|beni|benim)(?!\p{L})|(?<=\p{L}{2})(?:dım|dim|dum|düm|tım|tim|tum|tüm|ıyorum|iyorum|uyorum|üyorum)(?!\p{L})/iu.test(metin);
  const anlatici = benBir ? "birinci tekil şahıs anlatıcı" : "anlatıcı";
  const benzetme = c.find((s) => /(?<!\p{L})gibi(?!\p{L})/iu.test(s));
  const hukum = c.find((s) => s !== benzetme && s !== c[0] && /(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(s) && s.split(" ").length >= 5);
  const sorular = c.filter((s) => /\?["”»’]*$/.test(s)).length;
  const ilk = c[0] || metin, son = c.length > 2 ? c[c.length - 1] : "";
  const ilkHukum = !benzetme && /(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(ilk);
  const tirnak = (t, n) => kisalt(t, n).replace(/[.!?…]+["”»’]*$/u, "");   // soru içinde alıntı noktasız
  switch (hazir) {
    case "ozetle":
      return [`Kısaca:`,
        `- Çıkış noktası: ${kisalt(ilk, 120)}`,
        son ? `- Varılan yer: ${kisalt(son, 120)}` : "",
        `- Tema: ${tema.ad}.`].filter(Boolean).join("\n");
    case "basitlestir":
      return `Daha sade söylersek: ${tema.sade}
Yazar bunu doğrudan söylemek yerine ${benzetme ? "bir benzetmeyle" : "somut ayrıntılarla"} anlatıyor; duygu böyle daha kolay geçer.${benzetme ? `\nBenzetmenin geçtiği yer: «${kisalt(benzetme, 100)}»` : ""}`;
    case "ornek":
      return `Metindeki fikre gündelik bir örnek:\n${tema.ornek}`;
    case "soru-uret":
      return [`Kendini sınamak için üç soru:`,
        `1. Anlatıcı «${tirnak(ilk, 70)}» derken neyi anlatmak istiyor?`,
        benzetme ? `2. «${tirnak(benzetme, 70)}» cümlesinde ne neye benzetiliyor?` : `2. Parçada geçen somut bir nesneyi bul. Yazar onu hangi düşünceyi anlatmak için kullanıyor?`,
        `3. Parçanın ana teması nedir? Kendi hayatından bir örnekle açıkla.`,
        `**Cevaplar**`,
        `1. Cümle parçanın yönünü veriyor; anlatıcı buradan ${tema.ad} düşüncesine geçiyor.`,
        benzetme ? `2. Benzetmenin iki ucunu ayır: anlatılan şey ve «gibi»den önceki görüntü. İkisinin ortak özelliği, yazarın vurgulamak istediği şeydir.` : `2. Somut nesne soyut düşünceyi taşır; nesneyi bulup "bu neyin yerine geçiyor?" diye sor.`,
        `3. Ana tema ${tema.ad}. Örnek kişisel olabilir; önemli olan temayla bağını kurman.`].join("\n");
    default: {   // açıkla ve serbest soru
      const ikinci = benzetme
        ? `Benzetme: «${kisalt(benzetme, 110)}» Soyut bir düşünce gözle görülen bir şeye bağlanıyor; okur onu zihninde canlandırabiliyor.`
        : ilkHukum
          ? "Kuruluş: ilk cümle kesin bir tanım gibi kurulmuş. Yazar düşüncesini kanıtlamadan bir hüküm olarak koyuyor; bu, metne deneme havası veriyor."
          : hukum
          ? `Hüküm cümlesi: «${kisalt(hukum, 110)}» Yazar düşünceyi kesin bir tanım gibi koyuyor; bu, metne deneme havası veriyor.`
          : "Ayrıntılar: anlatıcı büyük sözler yerine küçük, somut ayrıntılarla ilerliyor; nesneler konuşuyor.";
      const ucuncu = sorular
        ? `Sorular: parçada ${sorular} soru cümlesi var. Anlatıcı cevap vermekten çok okuru düşünmeye çağırıyor.`
        : "Ton: sakin ve düşünceli; anlatıcı bir şey kanıtlamaktan çok bir deneyimi paylaşıyor.";
      return `Bu parçada ${anlatici} ${tema.ad} üzerine düşünüyor.
1. Çıkış noktası: «${kisalt(ilk, 110)}»
2. ${ikinci}
3. ${ucuncu}
Okurken şuna dikkat et: ${tema.dikkat}`;
    }
  }
}

// İngilizce kipte edebî cevap: aynı kurgu, İngilizce metin için İngilizce ipuçları
const EDEBI_TEMALAR_EN = [
  { re: /margin|\bnotes?\b|pencil|underlin|marginalia/i, ad: "the quiet conversation between a reader and a text",
    sade: "A note written in the margin of a book is the reader's reply to the author. Someone who reads that note years later hears both the book and the reader who came before.",
    ornek: "Think of a note someone left in pencil in a library book. You don't know who wrote it, but you know you both stopped at the same sentence to think. That is the feeling the text describes: a closeness built on a page between two strangers.",
    dikkat: "a small object, a note or a line, carries a big question. Is reading really something done alone?" },
  { re: /\bink|alphabet|handwrit|writing|calligraph|printing|printer/i, ad: "the permanence of writing and knowledge passed down through generations",
    sade: "Writing is the remedy people found against forgetting. What goes onto paper outlives the person who wrote it and reaches later generations.",
    ornek: "If your family has a handwritten recipe notebook, think of it. The small notes added next to the recipes over the years turn it from a cookbook into a family history.",
    dikkat: "the writing tool itself (ink, letters, paper) is treated almost like a character in the story." },
  { re: /\btime\b|\byears?\b|\bold\b|yellow|memor|rememb|forget|forgot|\bpast\b/i, ad: "time and memory",
    sade: "As time passes, things grow old, but they keep traces. The text is about looking at those traces to think about the past again.",
    ornek: "Think of a date written on the back of an old photograph. Even if you don't know the person in it, that date tells you something about a moment, a life and a lost context.",
    dikkat: "the narrator doesn't tell the past directly; they read it from the traces left on objects." },
  { re: /\bletters?\b|\brepl|answer|voice|speak|talk/i, ad: "a delayed act of communication",
    sade: "Sometimes words find their answer not when they are written but years later. The text describes this delayed meeting.",
    ornek: "Imagine finding a letter written to someone years ago and never sent. It wasn't written to you, but as you read it, it feels as if it is waiting for a reply.",
    dikkat: "the conversation is with a reader at the other end of time, not with one person." },
];
const EDEBI_GENEL_EN = { ad: "the mark reading leaves on a person",
  sade: "The text describes an experience and invites the reader to think about their own. What matters is not the events themselves but the feeling they leave.",
  ornek: "Think of rereading a book years later. The same sentences touch you in different places this time; the book hasn't changed, the reader has.",
  dikkat: "the narrator starts from concrete details and arrives at a general thought." };

function edebiCevapEn(hazir, metin) {
  const c = cumleler(metin);
  const tema = EDEBI_TEMALAR_EN.find((x) => x.re.test(metin)) || EDEBI_GENEL_EN;
  const benBir = /(?<!\p{L})(?:I|me|my|mine|myself)(?!\p{L})/u.test(metin);
  const anlatici = benBir ? "a first-person narrator" : "the narrator";
  const benzetme = c.find((s) => /(?<!\p{L})(?:like|as if|as though)(?!\p{L})/iu.test(s));
  const hukumRe = /(?<!\p{L})(?:is|are)(?!\p{L})/iu;
  const hukum = c.find((s) => s !== benzetme && s !== c[0] && hukumRe.test(s) && !/\?["”»’]*$/.test(s) && s.split(" ").length >= 5);
  const sorular = c.filter((s) => /\?["”»’]*$/.test(s)).length;
  const ilk = c[0] || metin, son = c.length > 2 ? c[c.length - 1] : "";
  const ilkHukum = !benzetme && hukumRe.test(ilk) && !/\?["”»’]*$/.test(ilk);
  const tirnak = (s, n) => kisalt(s, n).replace(/[.!?…]+["”»’]*$/u, "");   // soru içinde alıntı noktasız
  switch (hazir) {
    case "ozetle":
      return [`In short:`,
        `- Starting point: ${kisalt(ilk, 120)}`,
        son ? `- Where it ends up: ${kisalt(son, 120)}` : "",
        `- Theme: ${tema.ad}.`].filter(Boolean).join("\n");
    case "basitlestir":
      return `Put more simply: ${tema.sade}
Rather than saying it directly, the author tells it ${benzetme ? "through a comparison" : "through concrete details"}; the feeling comes across more easily that way.${benzetme ? `\nWhere the comparison appears: “${kisalt(benzetme, 100)}”` : ""}`;
    case "ornek":
      return `An everyday example of the idea in the text:\n${tema.ornek}`;
    case "soru-uret":
      return [`Three questions to test yourself:`,
        `1. What is the narrator trying to say with “${tirnak(ilk, 70)}”?`,
        benzetme ? `2. In the sentence “${tirnak(benzetme, 70)}”, what is compared to what?` : `2. Find a concrete object in the passage. What idea does the author use it to express?`,
        `3. What is the main theme of the passage? Explain it with an example from your own life.`,
        `**Answers**`,
        `1. The sentence sets the direction of the passage; from here the narrator moves to the idea of ${tema.ad}.`,
        benzetme ? `2. Separate the two ends of the comparison: the thing being described and the image it is compared to. What they share is what the author wants to stress.` : `2. The concrete object carries an abstract idea; find it and ask "what does this stand for?"`,
        `3. The main theme is ${tema.ad}. Your example can be personal; what matters is linking it to the theme.`].join("\n");
    default: {   // açıkla ve serbest soru
      const ikinci = benzetme
        ? `Comparison: “${kisalt(benzetme, 110)}” An abstract idea is tied to something you can see, so the reader can picture it.`
        : ilkHukum
          ? "Structure: the first sentence is built like a firm definition. The author states the idea as a verdict without proving it, which gives the text the feel of an essay."
          : hukum
          ? `Verdict sentence: “${kisalt(hukum, 110)}” The author states the idea like a firm definition, which gives the text the feel of an essay.`
          : "Details: instead of big words, the narrator moves through small, concrete details; the objects do the talking.";
      const ucuncu = sorular
        ? `Questions: the passage has ${sorular === 1 ? "one question" : `${sorular} questions`}. The narrator invites the reader to think more than they give answers.`
        : "Tone: calm and thoughtful; the narrator shares an experience more than proving a point.";
      return `In this passage, ${anlatici} reflects on ${tema.ad}.
1. Starting point: “${kisalt(ilk, 110)}”
2. ${ikinci}
3. ${ucuncu}
While reading, notice this: ${tema.dikkat}`;
    }
  }
}

// Konu tanınmadı: seçilen metnin kendisinden çalışma yönergesi
const DURAK_EN = new Set("about after again because before between could during every first other their there these those through under where which while would should being having itself without within another however therefore although rather".split(" "));
const DURAK = new Set("olarak olduğu olduğunu arasında birlikte üzerinde sonra önce kadar ancak çünkü dolayısıyla böylece şöyle bunların bunlar onların ayrıca yalnızca neredeyse herhangi".split(" "));
function anahtarlar(metin, n = 3) {
  const say = new Map();
  const durak = ingilizceMi ? DURAK_EN : DURAK;
  for (const k of String(metin).toLocaleLowerCase(yerel).match(/\p{L}{6,}/gu) || []) if (!durak.has(k)) say.set(k, (say.get(k) || 0) + 1);
  return [...say].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map((x) => x[0]);
}
function genelCevapEn(hazir, k) {
  const sonNot = "Demo mode didn't recognize this topic. For a detailed answer, choose a provider in Settings.";
  if (!k.metin) {
    return `Demo mode can't read the area you clipped and didn't recognize the topic of ${k.belgeAd ? `“${k.belgeAd}”` : "this page"}.
For a real answer, choose a provider in Settings, or take the question to ChatGPT, Gemini or Claude with your account.`;
  }
  const c = cumleler(k.metin), a = anahtarlar(k.metin);
  const kavram = a.length ? a.map((x) => `“${x}”`).join(", ") : "the main terms in the text";
  if (hazir === "ozetle") return `In short:\n- ${kisalt(c[0] || k.metin, 130)}${c.length > 2 ? `\n- ${kisalt(c[c.length - 1], 130)}` : ""}\n- Key concepts: ${kavram}.\n${sonNot}`;
  if (hazir === "soru-uret") return `Three questions to test yourself:\n1. ${a[0] ? `Define “${a[0]}” in your own words.` : "Write the main idea of the passage in one sentence."}\n2. ${a[1] ? `How are “${a[0]}” and “${a[1]}” related?` : "What is the most important detail in the passage, and why?"}\n3. How would you apply this to an example?\n**Answers**\nCheck your answers against the text yourself. ${sonNot}`;
  return `The core of the part you selected: “${kisalt(c[0] || k.metin, 120)}”
1. First, pick out the key concepts: ${kavram}.
2. Define each one in your own words; a concept you can't define is where the gap is.
3. State how the concepts relate in one sentence.
${sonNot}`;
}
function genelCevap(hazir, k) {
  if (ingilizceMi) return genelCevapEn(hazir, k);
  const sonNot = "Deneme modu bu konuyu tanımadı; ayrıntılı cevap için Ayarlar'dan bir sağlayıcı seç.";
  if (!k.metin) {
    return `Deneme modu kırptığın bölgeyi okuyamaz ve ${k.belgeAd ? `«${k.belgeAd}» belgesinin` : "bu sayfanın"} konusunu tanımadı.
Gerçek cevap için Ayarlar'dan bir sağlayıcı seç ya da Hesap yoluyla soruyu ChatGPT, Gemini veya Claude'a götür.`;
  }
  const c = cumleler(k.metin), a = anahtarlar(k.metin);
  const kavram = a.length ? a.map((x) => `«${x}»`).join(", ") : "metindeki ana terimler";
  if (hazir === "ozetle") return `Kısaca:\n- ${kisalt(c[0] || k.metin, 130)}${c.length > 2 ? `\n- ${kisalt(c[c.length - 1], 130)}` : ""}\n- Öne çıkan kavramlar: ${kavram}.\n${sonNot}`;
  if (hazir === "soru-uret") return `Kendini sınamak için üç soru:\n1. ${a[0] ? `«${a[0]}» kavramını kendi cümlenle tanımla.` : "Parçanın ana fikrini tek cümleyle yaz."}\n2. ${a[1] ? `«${a[0]}» ile «${a[1]}» arasındaki ilişki nedir?` : "Parçadaki en önemli ayrıntı hangisi, neden?"}\n3. Bu bilgiyi bir örnek üzerinde nasıl kullanırsın?\n**Cevaplar**\nCevapları metne dönüp kendin kontrol et. ${sonNot}`;
  return `Seçtiğin bölümün özü: «${kisalt(c[0] || k.metin, 120)}»
1. Önce anahtar kavramları ayır: ${kavram}.
2. Her birini kendi cümlenle tanımla; tanımlayamadığın kavram eksik olan yerdir.
3. Kavramlar arasındaki ilişkiyi tek cümlede kur.
${sonNot}`;
}

/* ---------- Anlamı: kısa sözlük (kök başı eşleşir: «sahaftan» -> sahaf) ---------- */
const DENEME_SOZLUK = [
  [/^melankoli/, "Sürekli ve derin hüzün. Eski tıptaki kara safra kuramından gelir: Yunanca melas «kara» ve khole «safra»."],
  [/^türev/, "Bir niceliğin başka bir niceliğe göre anlık değişim hızı. Gündelik dilde «bir şeyden türeyen» anlamına da gelir."],
  [/^hafıza/, "Bellek; yaşananı saklama ve gerektiğinde geri çağırma yetisi. Arapça hıfz «korumak» kökünden."],
  [/^kâğı[dt]|^kağı[dt]/, "Bitki liflerinden yapılan, üzerine yazılan ince yaprak. Farsça kâğaz kelimesinden gelir."],
  [/^sahaf/, "Eski ve ikinci el kitap alıp satan kimse ya da dükkânı. Arapça sahîfe «sayfa» ile aynı kökten."],
  [/^dizgici/, "Matbaada harfleri ve satırları basıma hazır biçimde dizen kişi; mürettip."],
  [/^matbaacı/, "Matbaa işleten ya da matbaada çalışan kimse; basımcı."],
  [/^matbaa/, "Kitap, gazete gibi şeylerin basıldığı yer; basımevi. Arapça tab' «basma» kökünden."],
  [/^derkenar/, "Bir yazının kenarına düşülen not, açıklama. Farsça der «içinde» ile kenar sözünden."],
  [/^temellük/, "Bir şeyi sahiplenme, mülk edinme. Arapça mülk ile aynı kökten."],
  [/^mazı/, "Bazı meşe ağaçlarında böceklerin yol açtığı yumru. Eskiden mürekkep yapımında kullanılırdı."],
  [/^hattat/, "Güzel yazı sanatçısı. Arapça hat «yazı, çizgi» kökünden."],
  [/^mürekkep/, "Yazmak ve basmak için kullanılan renkli sıvı. Arapça kökte «birleşik, karışım» anlamı taşır."],
  [/^yelpaze/, "Sallanarak serinlemeye yarayan, açılıp kapanan araç. Sayfaların hızla çevrilişini anlatan bir benzetmede de kullanılır."],
  [/^alçakgönüllü/, "Kendini başkalarından üstün görmeyen; mütevazı."],
  [/^öğü[tdğ]/, "Birine iyiliği için verilen akıl, nasihat. Öz Türkçe bir kelimedir."],
  [/^şük[ür]r?/, "Bir iyiliğe karşı duyulan ve dile getirilen minnet. Arapça kökenli."],
  [/^çığ(?!lı)/, "Dağdan kopup yuvarlandıkça büyüyen kar kütlesi."],
  [/^tereddü[tdü]/, "Kararsızlık, duraksama. Arapça kökenli."],
  [/^nüsha/, "Bir kitabın ya da yazının kopyalarından her biri. Arapça kökenli."],
  [/^sararm|^sarard|^sarart/, "Sararmak: rengi solup sarıya dönmek. Eski kâğıt ışık ve havayla zamanla sararır."],
  [/^dokunaklı/, "İnsanın duygularını harekete geçiren, içe işleyen."],
  [/^kuşa[kğ]/, "Aynı dönemde doğup yaşamış insanların bütünü; nesil."],
  [/^itiraf/, "Gizlenen ya da söylenmesi zor bir şeyi açıkça söyleme. Arapça kökenli."],
  [/^fosforlu/, "Işık altında parlak görünen. Burada metnin üstünü boyamaya yarayan parlak renkli kalem."],
  [/^moment/, "Bir kuvvetin bir noktaya göre döndürme etkisi: kuvvet çarpı dik uzaklık. Gündelik dilde «an» anlamına da gelir."],
  [/^mesnet/, "Bir yapıyı taşıyan ve hareketini sınırlayan dayanak. Arapça «dayanılan yer» anlamındaki kökten."],
  [/^kiri[şs]/, "Yükü taşıyıp mesnetlere aktaran, boyu kesitine göre çok uzun yapı elemanı."],
  [/^ple[kx]sus/, "Sinirlerin ya da damarların birleşip yeniden dallandığı ağ. Latince «örgü»."],
  [/^bileşke/, "Birkaç şeyin birleşmesinden çıkan sonuç. Matematikte fonksiyonların art arda uygulanması, fizikte kuvvetlerin toplamı."],
  [/^teğe[tdğ]/, "Bir eğriye bir noktada dokunan ve orada eğriyle aynı yönde ilerleyen doğru."],
];
// İngilizce kipte örnek kitapların İngilizce metninden kelimeler
const DENEME_SOZLUK_EN = [
  [/^melanchol/, "A lasting, deep sadness. It comes from the old medical theory of black bile: Greek melas “black” and kholē “bile”."],
  [/^derivativ/, "The instantaneous rate at which one quantity changes with respect to another. In everyday use it also means “something that comes from something else”."],
  [/^memor/, "The ability to keep what you have lived through and recall it when needed. From Latin memoria, from memor “mindful”."],
  [/^paper/, "A thin sheet made from plant fibers, used for writing on. From Latin papyrus, the reed the Egyptians wrote on."],
  [/^bookseller|^bookshop|^secondhand/, "Someone who buys and sells old and secondhand books, or their shop."],
  [/^typesett|^compositor/, "In a print shop, the person who sets letters and lines ready for printing."],
  [/^printer/, "Someone who runs a print shop or works in one."],
  [/^printing|^press(?:es)?$/, "The printing press: the machine, or the shop, where books and newspapers are printed."],
  [/^marginal|^margin/, "Marginalia: notes and comments written in the margins of a text. From Latin margo “edge”."],
  [/^ink(?!l)/, "Colored liquid used for writing and printing. From Old French enque, from Latin encaustum, a purple ink."],
  [/^calligraph/, "The art of beautiful handwriting. From Greek kallos “beauty” and graphein “to write”."],
  [/^fan(?:s|ned|ning)?$/, "A device you wave to cool yourself, which opens and closes. Also used in an image for pages flicked through quickly."],
  [/^humbl/, "Not thinking of yourself as better than others; modest."],
  [/^advi[cs]/, "A suggestion given to someone for their own good."],
  [/^gratitud|^grateful/, "Thankfulness felt and expressed for a kindness. From Latin gratus “pleasing, thankful”."],
  [/^avalanch/, "A mass of snow that breaks loose from a mountain and grows as it rolls down."],
  [/^hesita/, "Indecision; a pause before acting."],
  [/^cop(?:y|ies)$/, "One of the reproductions of a book or text."],
  [/^yellow/, "Yellowed: faded to a yellow color. Old paper yellows over time with light and air."],
  [/^touching|^moving/, "Something that stirs the feelings and goes straight to the heart."],
  [/^generation/, "All the people born and living at about the same time."],
  [/^confess/, "Saying openly something hidden or hard to say. From Latin confiteri “to acknowledge”."],
  [/^highlighter/, "A bright felt-tip pen used to color over text."],
  [/^moment/, "The turning effect of a force about a point: force times perpendicular distance. In everyday use it also means “an instant”."],
  [/^support/, "In a structure, the point that carries it and restrains its movement."],
  [/^beam/, "A long structural member that carries loads and passes them to its supports."],
  [/^ple[kx]us/, "A network where nerves or vessels join and branch again. Latin for “braid”."],
  [/^composit/, "Made by combining several things. In math, a composite function applies functions one after another; in physics, a resultant is the sum of forces."],
  [/^tangent/, "A line that touches a curve at one point and runs in the same direction as the curve there."],
];
function anlamCevabi(kelime, baglam) {
  const k = String(kelime || "").trim().toLocaleLowerCase(yerel).replace(/[’'].*$/, "");
  const bul = (ingilizceMi ? DENEME_SOZLUK_EN : DENEME_SOZLUK).find(([re]) => re.test(k));
  if (bul) return bul[1];
  if (ingilizceMi) {
    return `Demo mode has no ready meaning for “${String(kelime || "").trim()}”.${baglam ? " Guess it from the sentence it appears in, or choose" : " Choose"} a provider in Settings for a real answer.`;
  }
  return`«${String(kelime || "").trim()}» için deneme modunda hazır bir anlam yok.${baglam ? " Geçtiği cümleden tahmin et;" : ""} gerçek cevap için Ayarlar'dan bir sağlayıcı seç.`;
}

function denemeCevabi({ hazir, gorsel, kelime, soru = "", kaynak: k = {}, serbest = false }) {
  if (hazir === "anlam") return anlamCevabi(kelime, k.baglam);
  // Anlam kartının "Sor"u: «kelime» bu cümlede ne anlama geliyor?
  const anlamSorusu = serbest && /ne anlama gel|anlamı ne|ne demek|what does .* mean|meaning of/i.test(soru) && String(soru).match(/["“«]([^"”»]{1,40})["”»]/);
  if (anlamSorusu) return ingilizceMi ? `“${anlamSorusu[1]}”: ${anlamCevabi(anlamSorusu[1], k.metin)}` : `«${anlamSorusu[1]}»: ${anlamCevabi(anlamSorusu[1], k.metin)}`;
  const konu = konuBul(k);
  if (ingilizceMi) {
    const onEkEn = serbest ? "Demo mode can't read the question you typed. " : "";
    if (konu === "edebi") return (onEkEn && `${onEkEn}Here is a ready explanation of the passage you selected:\n`) + edebiCevapEn(serbest ? "acikla" : hazir, k.metin);
    if (konu === "genel") return genelCevap(serbest ? "acikla" : hazir, k);
    const setEn = DENEME_KONU_EN[konu];
    if (serbest) return `${onEkEn}Here is a ready explanation of ${KONU_AD_EN[konu] || konu}:\n${setEn.acikla}`;
    const tusEn = gorsel && hazir === "ozetle" ? "ozetle-gorsel" : hazir;
    return setEn[tusEn] || setEn[DENEME_YEDEK[tusEn]] || DENEME_KONU_EN[ANA_KONU[konu]]?.[tusEn] || setEn.acikla;
  }
  const onEk = serbest ? "Deneme modu yazdığın soruyu okuyamaz; " : "";
  if (konu === "edebi") return (onEk && `${onEk}seçtiğin parça üzerine hazır açıklama:\n`) + edebiCevap(serbest ? "acikla" : hazir, k.metin);
  if (konu === "genel") return genelCevap(serbest ? "acikla" : hazir, k);
  const set = DENEME_KONU[konu];
  const ad = KONU_AD[konu] || konu;
  if (serbest) return `${onEk}${ad} üzerine hazır anlatım:\n${set.acikla}`;
  const tus = gorsel && hazir === "ozetle" ? "ozetle-gorsel" : hazir;
  return set[tus] || set[DENEME_YEDEK[tus]] || DENEME_KONU[ANA_KONU[konu]]?.[tus] || set.acikla;
}

/* ================= İstem metinleri ================= */
// İstemler de arayüz diliyle gider ve cevabı o dilde ister (İngilizce kipte "Always answer in English")
function sistemMetni(k) {
  return [
    t("Sen Kenar Notu'nun çalışma asistanısın ve bir öğrenciye yardım ediyorsun."),
    t("Her zaman Türkçe cevap ver. Kısa ve net ol; giriş ve kapanış cümlesi kurma."),
    t("Matematikte adım adım git ve her matematiksel ifadeyi $...$ içine yaz. Liste gerekiyorsa satırı 1. ya da - ile başlat. Başlık ve tablo kullanma."),
    t("Ekte görsel varsa önce görseldeki ifadeyi ya da soruyu oku, cevabı ona göre kur."),
    t("Emin olmadığın yerde bunu açıkça söyle."),
    k.belgeAd ? (k.sayfa
      ? t('Bağlam: öğrenci "{belge}" belgesinde, {sayfa}. sayfada çalışıyor.', { belge: k.belgeAd, sayfa: k.sayfa })
      : t('Bağlam: öğrenci "{belge}" belgesinde çalışıyor.', { belge: k.belgeAd })) : "",
  ].filter(Boolean).join("\n");
}
// İstem sırası her yolda aynı: kaynak + sayfa, alıntı, (görsel), soru. Talimatlar sistem metninde durur.
// Kementle gelen gerçek PDF'te metin tüm sayfadır: "Sayfanın metni" diye etiketlenir, hesap yolunda kısaltılır.
const kaynakBasi = (k) => (k.belgeAd
  ? (k.sayfa ? t("Kaynak: {belge}, s. {sayfa}", { belge: k.belgeAd, sayfa: k.sayfa }) : t("Kaynak: {belge}", { belge: k.belgeAd }))
  : "");
function istemGovdesi(k, soru, sinir = Infinity) {
  let metin = String(k.metin || "").trim();
  if (metin.length > sinir) metin = metin.slice(0, Math.max(metin.lastIndexOf(" ", sinir), sinir * 0.8)).trim() + " …";
  const p = [kaynakBasi(k)];
  if (metin) p.push(`${k.gorsel ? t("Sayfanın metni") : t("Alıntı")}:\n"""\n${metin}\n"""`);
  if (k.baglam && k.baglam !== k.metin) p.push(t('Geçtiği cümle: "{cumle}"', { cumle: k.baglam }));
  if (k.gorsel) p.push(t("Ekteki görsele bak: sayfadan kırptığım bölge."));
  p.push(t("Soru: {soru}", { soru }));
  return p.filter(Boolean).join("\n\n");
}
const ilkIstem = (k, soru) => istemGovdesi(k, soru);
// Hesap yolu: sistem talimatının kısa hali başa eklenir; sohbet uygulamasına tek parça gider
// Edebî alıntıda matematik satırı gürültüdür, düşer
const hesapTalimat = (k) => t("Türkçe, kısa ve net cevap ver.") + (konuBul(k) === "edebi" ? "" : " " + t("Matematikte adım adım git, formülleri $...$ içinde yaz."));
const hesapMetni = (soru) => `${hesapTalimat(S.kaynak)}\n\n${istemGovdesi(S.kaynak, soru, 1500)}`;
// Anlamı: kelime + geçtiği cümle; iki yol da aynı metni kullanır
function anlamIstemi({ kelime, baglam, belgeAd, sayfa }) {
  return [kaynakBasi({ belgeAd, sayfa }), t("Kelime: «{kelime}»", { kelime: String(kelime || "").trim() }),
    baglam ? t('Geçtiği cümle: "{cumle}"', { cumle: baglam }) : "", t("Soru: {soru}", { soru: HAZIR_ANLAM[2] })]
    .filter(Boolean).join("\n\n");
}
function hesapSorusu() {
  const serbest = P.soru.value.trim();
  const hz = S.hazir && hazirBul(S.hazir, !!S.kaynak.gorsel);
  return [hz?.[2], serbest].filter(Boolean).join("\n");
}

/* ================= Panel ================= */
function panelKur() {
  P = {};
  P.baslik = h("h2", { class: "t-b2", id: "as-baslik" }, t("Asistan"));
  P.pulLamba = h("span", { class: "lamba" });
  P.pulAd = h("span", { class: "ad" });
  P.pulModel = h("span", { class: "model" });
  P.pul = h("span", { class: "cam cam-k as-pul" }, P.pulLamba, P.pulAd, P.pulModel);
  P.kapat = h("button", { type: "button", class: "ikon-dugme", "aria-label": t("Asistanı kapat"), onclick: () => kapat() }, icon("kapat"));
  P.tutamak = h("div", { class: "asistan-tutamak", role: "button", tabindex: "0", "aria-label": t("Asistanı büyüt") });
  P.iz = izOlustur();
  P.izNot = P.iz.querySelector(".iz-not");
  P.kaynak = h("section", { class: "as-kaynak", "aria-label": t("Kaynak") });
  P.hazir = h("div", { class: "as-hazir", role: "group", "aria-label": t("Hazır sorular") });
  P.akis = h("div", { class: "as-akis" });
  P.govde = h("div", { class: "asistan-govde" }, P.kaynak, P.hazir, P.akis);

  P.soru = h("textarea", { rows: "1", enterkeyhint: "send", "aria-label": t("Soru") });
  P.gonder = h("button", { type: "button", class: "ikon-dugme gonder", "aria-label": t("Gönder"), disabled: true }, icon("gonder"));
  P.uygulamaSec = h("div", { class: "as-uygulamalar", role: "radiogroup", "aria-label": t("Uygulama") });
  P.hesapDugme = h("button", { type: "button", class: "birincil" });
  P.hesapSatir = h("div", { class: "hesap-sor" }, P.uygulamaSec, P.hesapDugme);
  P.alt = h("div", { class: "as-alt" }, P.soru, P.gonder, P.hesapSatir);
  P.canli = h("div", { class: "as-sr", "aria-live": "polite" });

  P.el = h("aside", { class: "asistan", role: "dialog", "aria-modal": "false", "aria-labelledby": "as-baslik", tabindex: "-1" },
    P.tutamak,
    h("header", { class: "asistan-ust" }, P.baslik, P.pul, P.kapat),
    P.iz, P.govde, P.alt, P.canli);

  // Alt alan
  P.soru.addEventListener("input", altDurum);
  P.soru.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); gonderBas(); }
  });
  P.gonder.addEventListener("click", gonderBas);
  P.hesapDugme.addEventListener("click", () => hesapGonder());
  for (const u of YZ_UYGULAMALAR) {
    const b = h("button", { type: "button", class: "element kucuk", role: "radio", "aria-label": u.ad, dataset: { id: u.id } },
      h("b", {}, MONOGRAM[u.id] || u.ad.slice(0, 2)), h("small", {}, u.ad));
    b.addEventListener("click", () => uygulamaSec(u.id));
    P.uygulamaSec.append(b);
  }
  P.uygulamaSec.addEventListener("keydown", (e) => {
    const yon = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!yon) return;
    e.preventDefault();
    const i = YZ_UYGULAMALAR.findIndex((u) => u.id === uygulama().id);
    const yeni = YZ_UYGULAMALAR[(i + yon + YZ_UYGULAMALAR.length) % YZ_UYGULAMALAR.length];
    uygulamaSec(yeni.id);
    P.uygulamaSec.querySelector(`[data-id="${yeni.id}"]`)?.focus();
  });

  tutamakKur();
  document.body.append(P.el);
}

function ac() {
  if (S.acik) return;
  S.acik = true;
  S.oncekiOdak = document.activeElement;
  durakYaz();
  P.el.classList.add("acik");
  sagPanelYaz();
  izCiz();
  requestAnimationFrame(() => P.el.focus({ preventScroll: true }));
  bus.emit("asistan:acik", true);
}
function kapat() {
  if (!S.acik) return;
  S.acik = false;
  P.el.classList.remove("acik");
  P.el.style.transform = "";
  sagPanelYaz();
  izCiz();
  if (P.el.contains(document.activeElement)) S.oncekiOdak?.focus?.({ preventScroll: true });
  bus.emit("asistan:acik", false);
  beklemeHatirlat();
}
// Alt çekmece olduğu yer (TASARIM-4 2.5): telefon ve dikey tablet. 1000 px ve üstü dikey (iPad 13) ve yatayda yan panel.
const ALT_MEDYA = matchMedia("(max-width: 699px), (max-width: 999px) and (orientation: portrait)");
// Çekmecenin durağı: telefonda "tam", dikey tablette "yarim" (sayfanın üst yarısı görünür kalır)
function durakYaz(ad = matchMedia("(max-width: 599px)").matches ? "tam" : "yarim") {
  if (ALT_MEDYA.matches) P.el.dataset.durak = ad; else delete P.el.dataset.durak;
  P.tutamak.setAttribute("aria-label", P.el.dataset.durak === "tam" ? t("Asistanı küçült") : t("Asistanı büyüt"));
}
// Panel açıkken yan panel olarak ne kadar yer kapladığı kökte --sag-panel'de durur (Masa araç çubuğu ona göre ortalanır).
// Dikeyde panel alttan çekmecedir, yan yer kaplamaz: 0.
function sagPanelYaz() {
  const kok = document.documentElement.style;
  const yan = S.acik && !ALT_MEDYA.matches;
  if (yan) kok.setProperty("--sag-panel", `${P.el.offsetWidth || 400}px`);
  else kok.removeProperty("--sag-panel");
}

// Hesap yolunda cevap beklenirken panel kapalıysa geri dönüş yolu: eylemli bildirim
function beklemeHatirlat() {
  if (S.acik || S.durum !== "bekleme" || !S.bekleme) return;
  toast(t("Cevap {yer} bekleniyor.", { yer: uygulamada(S.bekleme.uygulama) }),
    { etiket: t("Cevabı getir"), calistir: () => { ac(); cevabiGetir(); } });
}

// Dikeyde alt çekmece (TASARIM-4 2.5 davranışı): tutamaktan sürüklenir, yarım ve tam durakta durur,
// aşağı fırlatınca bir alt durağa iner ya da kapanır; dokununca durak değişir. Hareket yalnız transform.
function tutamakKur() {
  const durakDegistir = () => { durakYaz(P.el.dataset.durak === "tam" ? "yarim" : "tam"); };
  P.tutamak.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); durakDegistir(); } });
  P.tutamak.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || !ALT_MEDYA.matches) return;
    const y0 = e.clientY, t0 = performance.now();
    const bas = new DOMMatrixReadOnly(getComputedStyle(P.el).transform).m42 || 0;   // durağın şimdiki kayması (px)
    let dy = 0, son = [[t0, y0]];
    try { P.tutamak.setPointerCapture(e.pointerId); } catch { /* yakalama yoksa da sürer */ }
    P.el.style.transition = "none";
    const hareket = (ev) => {
      dy = ev.clientY - y0;
      const y = bas + dy;
      P.el.style.transform = `translateY(${y < 0 ? y * 0.35 : y}px)`;   // tam durağın ötesinde direnç
      son.push([performance.now(), ev.clientY]);
      if (son.length > 6) son.shift();
    };
    const birak = () => {
      P.tutamak.removeEventListener("pointermove", hareket);
      P.tutamak.removeEventListener("pointerup", birak);
      P.tutamak.removeEventListener("pointercancel", birak);
      P.el.style.transition = "";
      P.el.style.transform = "";
      const ilk = son.find((x) => performance.now() - x[0] <= 80) || son[0], s1 = son[son.length - 1];
      const hiz = s1[0] > ilk[0] ? (s1[1] - ilk[1]) / (s1[0] - ilk[0]) : 0;
      if (Math.abs(dy) < 6 && performance.now() - t0 < 300) { durakDegistir(); return; }
      const tam = P.el.dataset.durak === "tam";
      if (hiz > 0.5 || dy > P.el.offsetHeight * 0.22) { if (tam && dy < P.el.offsetHeight * 0.45) durakYaz("yarim"); else kapat(); return; }
      if (hiz < -0.5 || dy < -40) durakYaz("tam");
    };
    P.tutamak.addEventListener("pointermove", hareket);
    P.tutamak.addEventListener("pointerup", birak);
    P.tutamak.addEventListener("pointercancel", birak);
  });
}

/* ---------- pul ---------- */
function pulYaz() {
  let lamba = "", ad = "", model = "", etiket = "";
  if (yol() === "hesap") {
    const u = uygulama();
    ad = t("{ad} · Hesap", { ad: u.ad });
    etiket = t("{ad}, hesabınla", { ad: u.ad });
  } else {
    const sg = saglayici();
    if (sg.id === "deneme") { lamba = "deneme"; ad = t("Deneme"); etiket = t("Deneme, çevrimdışı hazır cevaplar"); }
    else if (!sg.anahtar) { ad = t("{ad} · Anahtar yok", { ad: sg.ad }); etiket = t("{ad}, anahtar girilmemiş", { ad: sg.ad }); }
    else {
      const bagli = S.dogrulandi.has(sg.id) || (!S.reddedildi.has(sg.id) && yz().denemeler?.[sg.id]?.tamam);
      lamba = bagli ? "bagli" : "denenmedi";
      ad = `${sg.ad} ·`; model = sg.model;
      etiket = lamba === "bagli" ? t("{ad}, {model}, bağlı", { ad: sg.ad, model: sg.model }) : t("{ad}, {model}, henüz denenmedi", { ad: sg.ad, model: sg.model });
    }
  }
  if (S.pulHata != null) lamba = S.pulHata;
  if (lamba) P.pulLamba.dataset.durum = lamba; else delete P.pulLamba.dataset.durum;
  P.pulAd.textContent = ad;
  P.pulModel.textContent = model;
  P.pulModel.hidden = !model;
  P.pul.setAttribute("aria-label", t("Sağlayıcı: {etiket}", { etiket }));
  P.pul.title = etiket;
}

/* ---------- kaynak ---------- */
function kaynakYaz() {
  const k = S.kaynak;
  P.kaynak.replaceChildren();
  P.kaynak.hidden = !k.metin && !k.gorsel && !k.belgeAd;
  if (P.kaynak.hidden) return;
  const satir = kaynakSatiri(k);
  const etiket = h("button", { type: "button", class: "as-etiket" }, h("span", { class: "etiket-sayfa" }, t("Kaynak")), h("span", {}, satir || t("Seçim")));
  P.kaynak.append(etiket);
  if (k.metin) {
    // Formül parçası satır sonunda bölünmesin: türev işaretinden ya da harften sonra gelen parantez yapışık kalır (U+2060)
    const alinti = h("blockquote", { class: "as-alinti" }, `“${k.metin.trim().replace(/([′″\p{L}\d])(?=[(\[])/gu, "$1⁠")}”`);
    etiket.setAttribute("aria-expanded", "false");
    etiket.setAttribute("aria-label", t("Kaynak: {satir}. Alıntının tamamını göster", { satir }));
    etiket.addEventListener("click", () => {
      const tam = alinti.classList.toggle("tamami");
      etiket.setAttribute("aria-expanded", String(tam));
    });
    alinti.addEventListener("click", () => etiket.click());
    P.kaynak.append(alinti);
  } else {
    etiket.disabled = true;
  }
  if (k.gorsel) {
    const cap = h("figcaption", {}, t("KIRPINTI"));
    const img = h("img", { src: k.gorsel, alt: satir ? t("Kırpılan bölge, {satir}", { satir }) : t("Kırpılan bölge") });
    img.addEventListener("load", () => { cap.textContent = t("KIRPINTI · {g}×{y}", { g: img.naturalWidth, y: img.naturalHeight }); }, { once: true });
    P.kaynak.append(h("figure", { class: "as-gorsel" }, img, cap));
  }
}

/* ---------- hazır sorular ---------- */
function hazirYaz() {
  const liste = S.kaynak.gorsel ? HAZIR_GORSEL : HAZIR_METIN;
  const tuslar = [...liste];
  if (S.hazir && !liste.some((x) => x[0] === S.hazir)) { const ek = hazirBul(S.hazir); if (ek) tuslar.unshift(ek); }
  P.hazir.replaceChildren(...tuslar.map(([id, ad]) => {
    const b = h("button", { type: "button", class: "cip", "aria-pressed": String(S.hazir === id) }, ad);
    b.addEventListener("click", () => hazirBas(id));
    return b;
  }));
}
function hazirBas(id) {
  if (yol() === "hesap") {
    S.hazir = S.hazir === id ? null : id;
    hazirYaz();
    altDurum();
    return;
  }
  S.hazir = id;
  hazirYaz();
  sor(hazirBul(id, !!S.kaynak.gorsel)[2], { hazir: id });
}

/* ---------- alt alan ---------- */
function altYaz() {
  const hesap = yol() === "hesap";
  P.el.dataset.yol = hesap ? "hesap" : "anahtar";
  P.alt.hidden = S.durum === "anahtarsiz";
  P.hazir.hidden = S.durum === "anahtarsiz";
  P.gonder.hidden = hesap;
  P.hesapSatir.hidden = !hesap;
  P.soru.placeholder = hesap ? t("Sorunu yaz ya da yukarıdan seç") : S.turlar.length ? t("Takip sorusu yaz") : t("Sorunu yaz ya da yukarıdan seç");
  if (hesap) {
    const u = uygulama();
    for (const b of P.uygulamaSec.children) {
      const sec = b.dataset.id === u.id;
      b.setAttribute("aria-checked", String(sec));
      b.tabIndex = sec ? 0 : -1;
    }
    const paylasir = !!(S.dosya && navigator.canShare?.({ files: [S.dosya] }));
    const beklemede = S.durum === "bekleme";
    P.hesapDugme.className = beklemede ? "metin-dugme" : "birincil";
    P.hesapDugme.replaceChildren(icon(paylasir ? "paylas" : "disa-aktar"), h("span", {}, beklemede ? t("Yeniden gönder") : t("{yer} sor", { yer: uygulamada(u), uyg: u.ad })));
  }
  altDurum();
}
function altDurum() {
  const akiyor = !!S.iptal;
  if (yol() === "hesap") { P.hesapDugme.disabled = !hesapSorusu(); return; }
  P.gonder.disabled = !akiyor && !P.soru.value.trim();
  P.gonder.setAttribute("aria-label", akiyor ? t("Durdur") : t("Gönder"));
  P.gonder.classList.toggle("durdur", akiyor);
  P.gonder.replaceChildren(akiyor ? h("span", { class: "as-dur-kare", "aria-hidden": "true" }) : icon("gonder"));
}
function gonderBas() {
  if (yol() === "hesap") return hesapGonder();
  if (S.iptal) { iptalEt(); return; }
  const soru = P.soru.value.trim();
  if (!soru) return;
  P.soru.value = "";
  sor(soru);
}
function uygulamaSec(id) {
  ayarla({ yz: { ...yz(), uygulama: id } });
}

/* ================= Anahtar yolu: sor ve akıt ================= */
function iptalEt() { S.iptal?.abort(); }

function durumKutulariniTemizle() {
  P.akis.querySelectorAll(".as-bos, .as-hata, .as-bekleme").forEach((x) => x.remove());
  S.pulHata = null;
}

async function sor(soruMetni, { hazir = null } = {}) {
  if (yol() === "hesap") return;
  const sg = saglayici();
  if (sg.id !== "deneme" && !sg.anahtar) { S.bekleyenSoru = { soru: soruMetni, hazir }; return anahtarsizGoster(); }
  iptalEt();
  durumKutulariniTemizle();
  S.durum = "hazir";

  const baglamVar = S.turlar.some((t) => t.durum === "bitti");
  const tur = {
    soru: soruMetni, hazir, cevap: "", durum: "akiyor", saglayici: sg.id, saglayiciAd: sg.ad, model: sg.model,
    istem: baglamVar ? soruMetni : ilkIstem(S.kaynak, soruMetni),
    gorsel: baglamVar ? null : S.kaynak.gorsel || null,
    soruGoster: !(hazir && S.turlar.length === 0),
    baslangic: performance.now(), duyurulan: 0,
  };
  const gecmis = S.turlar.filter((t) => t.durum === "bitti").flatMap((t) => [
    { rol: "user", metin: t.istem, gorsel: t.gorsel }, { rol: "assistant", metin: t.cevap },
  ]);
  turEkle(tur);
  const mesajlar = [...gecmis, { rol: "user", metin: tur.istem, gorsel: tur.gorsel }];

  const denetci = new AbortController();
  S.iptal = denetci;
  izAyarla("dusunuyor", "");
  altDurum();
  pulYaz();
  let sessiz = 0;
  const sessizKur = () => { clearTimeout(sessiz); sessiz = setTimeout(() => { if (S.izDurum === "akiyor") izAyarla("dusunuyor"); }, 600); };

  try {
    await ADAPTORLER[sg.id]({
      sistem: sistemMetni(S.kaynak), mesajlar, model: sg.model, anahtar: sg.anahtar, signal: denetci.signal,
      hazir, gorsel: !!S.kaynak.gorsel, soru: soruMetni, kelime: S.kaynak.metin, kaynak: S.kaynak,
    }, (parca) => {
      if (!parca || denetci.signal.aborted) return;
      tur.cevap += parca;
      if (S.izDurum !== "akiyor") izAyarla("akiyor");
      sessizKur();
      cevapCizPlanla(tur);
      duyur(tur);
    });
    if (!tur.cevap.trim()) throw new AsistanHatasi("ret");
    tur.durum = "bitti";
    if (sg.id !== "deneme") { S.dogrulandi.add(sg.id); S.reddedildi.delete(sg.id); }
    turBitir(tur);
  } catch (e) {
    // Yeni soru eskisini kestiyse iz şeridi artık yeni isteğindir: eski tur şeridi "bitti"ye çekmesin
    if (e?.name === "AbortError") { tur.durum = "durdu"; turBitir(tur, { durdu: true, iz: S.iptal === denetci }); }
    else hataGoster(e instanceof AsistanHatasi ? e : new AsistanHatasi("sunucu", t("HATA")), tur);
  } finally {
    clearTimeout(sessiz);
    if (S.iptal === denetci) S.iptal = null;
    altYaz();
    pulYaz();
  }
}

function turEkle(tur) {
  tur.cevapEl = h("div", { class: "as-cevap", "aria-busy": "true" }, h("span", { class: "imlec", "aria-hidden": "true" }));
  tur.kayitEl = h("div", { class: "as-kayit" });
  tur.altEl = h("div", { class: "as-tur-alt" });
  tur.el = h("article", { class: "as-tur", "aria-label": t("Cevap") },
    tur.soruGoster ? h("div", { class: "as-soru" }, h("span", { class: "t-daktilo" }, t("Soru")), h("p", {}, tur.soru)) : null,
    tur.cevapEl, tur.kayitEl, tur.altEl);
  S.turlar.push(tur);
  P.akis.append(tur.el);
  tur.el.scrollIntoView({ block: "nearest" });
}

// Akarken çizim kare başına bir kez; imleç son bloğun sonunda yanar
function cevapCizPlanla(tur) {
  if (tur.cizimBekliyor) return;
  tur.cizimBekliyor = true;
  requestAnimationFrame(() => { tur.cizimBekliyor = false; cevapCiz(tur, tur.durum === "akiyor"); });
}
function cevapCiz(tur, imlecli) {
  const g = P.govde;
  const dipte = g.scrollHeight - g.scrollTop - g.clientHeight < 48;
  tur.cevapEl.innerHTML = cevapHtml(tur.cevap);
  formulleriCiz(tur.cevapEl);
  if (imlecli) {
    let son = tur.cevapEl.lastElementChild || tur.cevapEl;
    if (/^(OL|UL)$/.test(son.tagName)) son = son.lastElementChild || son;
    son.append(h("span", { class: "imlec", "aria-hidden": "true" }));
  }
  // Akış dibi izler; ama turun başı ekranın üstüne gelene kadar kaydırma bir bloğun başına oturur
  // (kaynak, alıntı, hazır sorular, tur): üst kenarda yarım kesilmiş satır kalmaz
  if (dipte) {
    const enCok = g.scrollHeight - g.clientHeight, gt = g.getBoundingClientRect().top - g.scrollTop;
    const yer = (el) => el.getBoundingClientRect().top - gt - 12;
    const turBasi = yer(tur.el);
    let hedef = enCok;
    if (enCok < turBasi) {
      const duraklar = [0, ...[P.kaynak.querySelector(".as-alinti"), P.hazir, ...S.turlar.map((t) => t.el)].filter((el) => el && !el.hidden && el.offsetHeight).map(yer)];
      hedef = Math.max(...duraklar.filter((y) => y <= enCok));
    }
    if (hedef > g.scrollTop) g.scrollTop = hedef;
  }
}
function duyur(tur, hepsi = false) {
  const t = tur.cevap;
  const son = hepsi ? t.length : Math.max(...[". ", ".\n", "? ", "! ", ":\n"].map((x) => t.lastIndexOf(x))) + 1;
  if (son > tur.duyurulan) {
    const parca = duzMetin(t.slice(tur.duyurulan, son)).trim();
    tur.duyurulan = son;
    if (parca) P.canli.textContent = parca;
  }
}

function turBitir(tur, { durdu = false, hesap = null, iz = true } = {}) {
  cevapCiz(tur, false);
  tur.cevapEl.removeAttribute("aria-busy");
  duyur(tur, true);
  const sn = (performance.now() - tur.baslangic) / 1000;
  // Süre ve kelime sayısı izin üstünde değil, cevabın altında KAYIT damgasıyla aynı satırda
  if (iz) izAyarla("bitti", "");
  const olcu = hesap ? null : h("span", { class: "cam cam-k soluk as-olcu" }, t("{sn} sn · {n} kelime", { sn: sayiTr(sn), n: kelimeSay(tur.cevap) }));
  const z = new Date();
  if (!durdu) {
    const damga = hesap ? t("Kayıt · {ad} · {saat}", { ad: buyuk(hesap.ad), saat: saatTr(z) }) : t("Kayıt · {tarih} · {saat}", { tarih: tarihTr(z), saat: saatTr(z) });
    tur.kayitEl.replaceChildren(h("span", { class: "damga" }, damga), olcu);
  } else if (olcu) tur.kayitEl.replaceChildren(olcu);
  if (durdu) tur.altEl.append(h("p", { class: "as-not" }, t("Durduruldu.")));
  else if (tur.saglayici === "deneme") tur.altEl.append(h("p", { class: "as-not" }, t("Bu hazır bir örnek cevaptır.")));
  if (!durdu && tur.hazir === "anlam") tur.altEl.append(...anlamDisari());
  if (tur.cevap.trim()) tur.altEl.append(eylemlerKur(tur));
}
// "Anlamı" kartında Vikipedi ve web araması (TASARIM-5 11.6 Y5): yalnız dokununca, yeni sekmede; çevrimdışıyken kapalı
function anlamDisari() {
  const k = S.kaynak, kelime = String(k.metin || "").trim();
  if (!kelime || kelime.length > 120) return [];
  const dil = belgeBul(k.belgeId)?.dil || (ingilizceMi ? "en" : "tr");
  return [webAraDugmeleri({ metin: kelime, dil, sinif: "as-disari" })];
}

/* ---------- cevap eylemleri ---------- */
function eylemlerKur(tur) {
  const k = S.kaynak;
  const kutu = h("div", { class: "as-eylem" });
  const damgala = (metin) => {
    kutu.querySelector(".damga")?.remove();
    kutu.append(h("span", { class: "damga", role: "status" }, metin));
  };
  const dugme = (ad, simge, fn, ek = {}) => {
    const b = h("button", { type: "button", class: "metin-dugme", ...ek }, icon(simge), h("span", {}, ad));
    b.addEventListener("click", () => fn(b));
    return b;
  };
  kutu.append(
    dugme(t("Kenara not"), "kenara-not", () => {
      bus.emit("asistan:not", {
        belgeId: k.belgeId, sayfa: k.sayfa, metin: tur.cevap, soru: tur.soru,
        kaynak: tur.saglayiciAd || "Asistan", zaman: Date.now(),
      });
      damgala(k.sayfa ? t("Kenara eklendi · s. {sayfa}", { sayfa: k.sayfa }) : t("Kenara eklendi"));
    }, { disabled: !k.belgeId, title: k.belgeId ? null : t("Bu soru bir belgeye bağlı değil") }),
    dugme(t("Karta çevir"), "karta-cevir", (b) => {
      const alinti = k.metin ? k.metin.trim().slice(0, 220) + (k.metin.trim().length > 220 ? "…" : "") : "";
      kartEkle({
        tur: "soru",
        on: { metin: alinti ? `${tur.soru}\n“${alinti}”` : tur.soru, gorsel: tur.gorsel || k.gorsel || undefined },
        arka: { metin: tur.cevap },
        belgeId: k.belgeId, belgeAd: k.belgeAd, sayfa: k.sayfa,
      });
      b.disabled = true;
      damgala(t("Tekrar'a eklendi · kutu I"));
    }),
    dugme(t("Kopyala"), "kopyala", async () => {
      toast((await panoyaYaz(tur.cevap)) ? t("Kopyalandı") : t("Kopyalanamadı"));
    }),
  );
  return kutu;
}

/* ---------- hata ve boş durum ---------- */
function hataGoster(hata, tur) {
  const ht = HATALAR[hata.tur] || HATALAR.sunucu;
  tur.durum = "hata";
  if (hata.tur === "anahtar" || hata.tur === "model") { S.dogrulandi.delete(tur.saglayici); S.reddedildi.add(tur.saglayici); }
  if (hata.tur === "ret") tur.cevap = ""; // reddedilen kısmi cevap gösterilmez
  tur.cevapEl.remove();
  tur.kayitEl.remove();
  S.pulHata = ht.lamba === null ? null : ht.lamba;
  izAyarla("hata", "");
  const eylem = h("button", { type: "button", class: "metin-dugme vurgulu" },
    icon(ht.eylem === "Yeniden dene" ? "yeniden" : ht.eylem === "Ayarları aç" ? "ayarlar" : "metin"), h("span", {}, t(ht.eylem)));
  eylem.addEventListener("click", () => {
    if (ht.eylem === "Ayarları aç") return ayarlarAc();
    tur.el.remove();
    S.turlar.splice(S.turlar.indexOf(tur), 1);
    if (ht.eylem === "Yeniden dene") return sor(tur.soru, { hazir: tur.hazir });
    // Soruyu değiştir: soru alanına geri koy
    izAyarla("bekliyor", "");
    S.pulHata = null;
    pulYaz();
    P.soru.value = tur.soru;
    altDurum();
    P.soru.focus();
  });
  const fis = h("div", { class: "as-hata", role: "alert", dataset: { tur: hata.tur } },
    ht.lamba === null ? h("span") : h("span", { class: "lamba", dataset: ht.lamba ? { durum: ht.lamba } : {} }),
    hata.kod ? h("span", { class: "kod" }, hata.kod) : h("span"),
    h("p", {}, ht.metin), eylem);
  tur.altEl.replaceChildren(fis);
}

function anahtarsizGoster() {
  const sg = saglayici();
  S.durum = "anahtarsiz";
  durumKutulariniTemizle();
  izAyarla("bekliyor", "");
  const ayarDugme = h("button", { type: "button", class: "birincil" }, icon("ayarlar"), h("span", {}, t("Ayarları aç")));
  ayarDugme.addEventListener("click", ayarlarAc);
  const deneDugme = h("button", { type: "button", class: "metin-dugme" }, t("Deneme ile dene"));
  // "ayarlar" dinleyicisi bekleyen soruyu kendisi sorar
  deneDugme.addEventListener("click", () => ayarla({ yz: { ...yz(), yol: "anahtar", saglayici: "deneme" } }));
  P.akis.append(h("div", { class: "as-bos" },
    h("div", { class: "tahta tahta--cerceve" }, feynman()),
    h("h3", { class: "t-b2" }, t("Anahtar girilmemiş.")),
    h("p", {}, t("{ad} için anahtar yok. Hesabınla sormak için Ayarlar'a dön.", { ad: sg.ad })),
    h("div", { class: "as-bos-eylem" }, ayarDugme, deneDugme)));
  altYaz();
  pulYaz();
}
// Tebeşirle küçük bir Feynman çizimi: iki fermiyon, aralarında foton
function feynman() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "feynman");
  svg.setAttribute("viewBox", "0 0 160 96");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 10 50 48 12 86M148 10 110 48 148 86"/>
    <path d="M50 48q3.75-8 7.5 0t7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0"/>
    <path d="M28 21l3 6-6.5-.5M28 75l-3.5 5.6 6.6-.2M132 21l-3.4 5.8 6.6-.3M132 75l3.2 5.7-6.6-.2"/>
  </g><g fill="currentColor"><circle cx="50" cy="48" r="2.4"/><circle cx="110" cy="48" r="2.4"/></g>`;
  return svg;
}
function ayarlarAc() {
  bus.emit("ayarlar:ac", { bolum: "yz" });
  // Kabuk olayı dinlemiyorsa kenar çubuğundaki Ayarlar düğmesine düş
  setTimeout(() => {
    if (document.querySelector("dialog[open], .yz-pencere")) return;
    const d = [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find((b) => /Ayarlar|Settings/.test(b.textContent) && b.getClientRects().length);
    if (d) d.click(); else toast(t("Ayarlar kitaplıkta, Yapay zekâ bölümünde."));
  }, 60);
}

/* ================= Hesap yolu: götür, bekle, geri getir ================= */
async function hesapGonder() {
  const soru = hesapSorusu();
  if (!soru) { P.soru.focus(); return; }
  const u = uygulama();
  const metin = hesapMetni(soru);
  const dosya = S.dosya;
  const kopyalandi = await panoyaYaz(metin);
  let paylasildi = false;
  if (dosya && navigator.canShare?.({ files: [dosya] })) {
    try {
      await navigator.share({ text: metin, files: [dosya] });
      paylasildi = true;
    } catch (e) {
      if (e?.name === "AbortError") { toast(t("Paylaşım iptal edildi.")); return; }
    }
  }
  if (!paylasildi) {
    const q = metin.length > 1800 ? "" : metin; // uzun metin bağlantıya sığmaz, panodaki kopya yeter
    window.open(u.url(q), "_blank", "noopener");
    const ipucu = kopyalandi ? t("Metin kopyalandı, açılan sohbete yapıştır.") : t("Metin kopyalanamadı; açılan sohbete soruyu yaz.");
    if (dosya) toast(ipucu, { etiket: t("Görüntüyü indir"), calistir: () => indir(dosya) });
    else toast(ipucu);
  }
  beklemeGoster(u, metin, soru);
}

function beklemeGoster(u, metin, soru) {
  durumKutulariniTemizle();
  S.durum = "bekleme";
  S.bekleme = { metin, soru, uygulama: u, vurgulandi: false, baslangic: performance.now() };
  beklemeSakla();
  izAyarla("bekliyor", buyuk(ingilizceMi ? `In ${u.ad}` : uygulamada(u)));
  const getir = h("button", { type: "button", class: "birincil" }, icon("yapistir"), h("span", {}, t("Cevabı getir")));
  getir.addEventListener("click", cevabiGetir);
  const kopya = h("button", { type: "button", class: "metin-dugme" }, t("Metni yeniden kopyala"));
  kopya.addEventListener("click", async () => toast((await panoyaYaz(metin)) ? t("Metin kopyalandı.") : t("Kopyalanamadı")));
  P.getir = getir;
  P.yapistirKap = h("div", { class: "as-yapistir-kap", hidden: true });
  const kutu = h("div", { class: "as-bekleme kareli", role: "status" },
    h("h3", {}, t("Cevap {yer}.", { yer: uygulamada(u) })),
    h("p", {}, t("Bitince cevabı kopyala ve buraya dön.")),
    h("div", { class: "eylemler" }, getir, kopya),
    P.yapistirKap);
  P.akis.append(kutu);
  kutu.scrollIntoView({ block: "nearest" });
  altYaz();
  pulYaz();
}

// Paylaş menüsünden dönüş sayfayı yeniden yükler: bekleyen soru oturum deposunda durur, kur() geri getirir
const BEKLEME_ANAHTARI = "kn-tasarim:asistan-bekleme";
function beklemeSakla() {
  try {
    if (!S.bekleme) { sessionStorage.removeItem(BEKLEME_ANAHTARI); return; }
    const { gorsel, ...kaynak } = S.kaynak || {};   // görsel büyük olabilir, saklanmaz
    const b = S.bekleme;
    sessionStorage.setItem(BEKLEME_ANAHTARI, JSON.stringify({ metin: b.metin, soru: b.soru, uygulama: b.uygulama?.id, hazir: S.hazir, kaynak }));
  } catch { /* gizli pencere ya da dolu depo: bekleme bu sayfada kalır */ }
}
function beklemeGeriYukle() {
  let k = null;
  try { k = JSON.parse(sessionStorage.getItem(BEKLEME_ANAHTARI) || "null"); } catch { k = null; }
  if (!k || typeof k.metin !== "string" || yol() !== "hesap") return;
  const u = YZ_UYGULAMALAR.find((x) => x.id === k.uygulama) || uygulama();
  S.kaynak = k.kaynak && typeof k.kaynak === "object" ? k.kaynak : {};
  S.hazir = k.hazir || null;
  kaynakYaz();
  hazirYaz();
  beklemeGoster(u, k.metin, k.soru);
  ac();   // panel kapalı kalırsa "Cevabı getir" görünmez
}

async function cevabiGetir() {
  const b = S.bekleme;
  if (!b) return;
  let metin = null;
  try { if (navigator.clipboard?.readText) metin = await navigator.clipboard.readText(); } catch { metin = null; }
  const temiz = metin?.trim();
  if (temiz && temiz !== b.metin.trim()) return hesapCevabi(temiz);
  if (temiz) toast(t("Panoda hâlâ soru metni var. Cevabı kopyalayıp yeniden dene."));
  yapistirAc();
}
function yapistirAc() {
  const kap = P.yapistirKap;
  if (!kap || !kap.hidden) { kap?.querySelector("textarea")?.focus(); return; }
  const alan = h("textarea", { class: "as-yapistir", placeholder: t("Cevabı buraya yapıştır"), "aria-label": t("Cevap") });
  const ekle = h("button", { type: "button", class: "metin-dugme vurgulu", disabled: true }, icon("tik"), h("span", {}, t("Ekle")));
  alan.addEventListener("input", () => { ekle.disabled = !alan.value.trim(); });
  ekle.addEventListener("click", () => alan.value.trim() && hesapCevabi(alan.value.trim()));
  kap.replaceChildren(alan, h("div", { class: "eylemler" }, ekle));
  kap.hidden = false;
  alan.focus();
}
function hesapCevabi(metin) {
  const b = S.bekleme;
  P.akis.querySelector(".as-bekleme")?.remove();
  S.durum = "hazir";
  S.bekleme = null;
  beklemeSakla();
  P.getir = null;
  const tur = {
    soru: b.soru, hazir: S.hazir, cevap: metin, durum: "bitti", saglayici: "hesap", saglayiciAd: b.uygulama.ad,
    istem: b.metin, gorsel: null, soruGoster: true, baslangic: b.baslangic, duyurulan: 0,
  };
  turEkle(tur);
  turBitir(tur, { hesap: b.uygulama });
  P.soru.value = "";
  altYaz();
  pulYaz();
}

/* ================= "sor" olayı ================= */
function sorAl(y = {}) {
  // Anahtar yolunda "Anlamı" paneli açmaz; cevap anlam kartına akar
  if (y.hazir === "anlam" && yol() === "anahtar" && !y.panel) { anlamSessiz(y); return; }
  // Hesap yolunda anlam kartı kendi "Cevabı getir"ini taşır: panel açılmadan soru uygulamaya götürülür
  if (y.hazir === "anlam" && yol() === "hesap" && y.panel === false) { anlamHesapla(y); return; }
  iptalEt();
  // Bekleyen hesap cevabı yeni soruyla bırakılır: sessizce değil, haber vererek
  if (S.durum === "bekleme" && S.bekleme) toast(t("Önceki sorunun bekleyen cevabı bırakıldı."));
  S.kaynak = { ...y };
  S.dosya = y.gorsel ? dataUrlDosya(y.gorsel) : null;
  S.turlar = [];
  S.hazir = y.hazir || null;
  S.durum = "hazir";
  S.bekleme = null;
  beklemeSakla();
  S.bekleyenSoru = null;
  S.pulHata = null;
  P.akis.replaceChildren();
  P.soru.value = "";
  izAyarla("bekliyor", "");
  kaynakYaz();
  hazirYaz();
  altYaz();
  pulYaz();
  P.govde.scrollTop = 0;
  ac();
  if (yol() === "hesap") {
    if (y.soru) { P.soru.value = y.soru; altDurum(); }
    if (y.hazir === "anlam") P.akis.append(...anlamDisari());
    return;
  }
  const soru = y.soru || (y.hazir && hazirBul(y.hazir, !!y.gorsel)?.[2]);
  if (soru) sor(soru, { hazir: y.hazir || null });
  else {
    const sg = saglayici();
    if (sg.id !== "deneme" && !sg.anahtar) anahtarsizGoster();
  }
}

function anlamHesapla(y) {
  const u = uygulama();
  const metin = `${t("Türkçe, kısa ve net cevap ver.")}\n\n${anlamIstemi({ kelime: y.metin, baglam: y.baglam, belgeAd: y.belgeAd, sayfa: y.sayfa })}`;
  // Kullanıcı hareketi içinde: önce pano, sonra uygulama bağlantısı (açılır pencere engellenmesin)
  panoyaYaz(metin).then((ok) => toast(ok ? t("Soru kopyalandı. Cevabı kopyalayıp buraya dön.") : t("Açılan sohbete soruyu yaz.")));
  window.open(u.url(metin.length > 1800 ? "" : metin), "_blank", "noopener");
}

/* ================= Anlam: panelsiz akış (koltuk anlam kartı için) ================= */
// Dışa açık: koltuk.js doğrudan çağırabilir. parca(metin, toplam) her parçada çağrılır; dönen söz tam metni verir.
export async function anlamGetir({ kelime, baglam = "", belgeAd, sayfa, signal } = {}, parca) {
  const sg = saglayici();
  if (sg.id !== "deneme" && !sg.anahtar) throw new AsistanHatasi("anahtar", t("ANAHTAR YOK"));
  const k = { belgeAd, sayfa };
  const istem = anlamIstemi({ kelime, baglam, belgeAd, sayfa });
  let toplam = "";
  await ADAPTORLER[sg.id]({
    sistem: sistemMetni(k), mesajlar: [{ rol: "user", metin: istem }], model: sg.model, anahtar: sg.anahtar,
    signal, hazir: "anlam", kelime, kaynak: { belgeAd, sayfa, baglam },
  }, (p) => { toplam += p; parca?.(p, toplam); });
  if (sg.id !== "deneme") S.dogrulandi.add(sg.id);
  return toplam.trim();
}
function anlamSessiz(y) {
  const kelime = String(y.metin || "").trim();
  const yay = (durum, ek = {}) => bus.emit("asistan:anlam", { kelime, belgeId: y.belgeId, sayfa: y.sayfa, durum, ...ek });
  yay("dusunuyor");
  anlamGetir({ kelime, baglam: y.baglam, belgeAd: y.belgeAd, sayfa: y.sayfa, signal: y.signal }, (p, toplam) => {
    yay("akiyor", { parca: p, metin: toplam });
    y.parca?.(p, toplam);
  }).then((metin) => {
    yay("bitti", { metin, deneme: saglayici().id === "deneme" });
    y.bitti?.(metin);
  }).catch((e) => {
    if (e?.name === "AbortError") return;
    const hata = { tur: e?.tur || "sunucu", kod: e?.kod || "", mesaj: t("Anlam getirilemedi.") };
    yay("hata", { hata });
    y.hata?.(hata);
  });
}

/* ================= Bağlantıyı dene (Ayarlar > Yapay zekâ) ================= */
// Anahtar ve model adı birlikte doğrulanır, cevap üretilmez. Claude'un /v1/models ucu tarayıcıya
// CORS izni vermediği için orada ücretsiz count_tokens kullanılır.
const DOGRULA = {
  gemini: (m, a) => [`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}`, { headers: { "x-goog-api-key": a } }],
  claude: (m, a) => ["https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: { "x-api-key": a, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" },
    body: JSON.stringify({ model: m, messages: [{ role: "user", content: "deneme" }] }),
  }],
  openai: (m, a) => [`https://api.openai.com/v1/models/${encodeURIComponent(m)}`, { headers: { Authorization: `Bearer ${a}` } }],
};
export async function baglantiDene(saglayiciId) {
  const sg = saglayici(saglayiciId);
  if (sg.id !== saglayiciId) return { tamam: false, mesaj: t("BİLİNMEYEN"), tur: "istek" };
  if (sg.id === "deneme") {
    await bekle(260);
    return { tamam: true, ok: true, mesaj: t("DENEME · HAZIR"), tur: "deneme", ms: 0 };
  }
  if (!sg.anahtar) return { tamam: false, mesaj: t("ANAHTAR YOK"), tur: "anahtar-yok", durum: "anahtar-yok" };
  const denetci = new AbortController();
  const zaman = setTimeout(() => denetci.abort(), 15000);
  const t0 = performance.now();
  try {
    const [url, init] = DOGRULA[sg.id](sg.model, sg.anahtar);
    await istekAt(url, { ...init, signal: denetci.signal });
    const ms = Math.round(performance.now() - t0);
    S.dogrulandi.add(sg.id);
    S.reddedildi.delete(sg.id);
    return { tamam: true, ok: true, mesaj: t("BAĞLI · {ms} ms", { ms }), tur: "bagli", ms };
  } catch (e) {
    S.dogrulandi.delete(sg.id);
    if (e?.name === "AbortError") return { tamam: false, mesaj: t("ZAMAN AŞIMI"), tur: "ag", durum: "ag" };
    // durum: kabuğun cam şeridi için sayısal kod ya da "ag"
    const kod = e?.kod || t("AĞ YOK");
    const n = parseInt(kod, 10);
    if (e?.tur === "anahtar" || e?.tur === "model") S.reddedildi.add(sg.id);
    return { tamam: false, mesaj: kod, tur: e?.tur || "ag", durum: e?.tur === "ag" ? "ag" : Number.isFinite(n) ? n : kod };
  } finally {
    clearTimeout(zaman);
    if (P) pulYaz();
  }
}

/* ================= Kurulum ================= */
function overlayVar() {
  if (document.querySelector("dialog[open]")) return true;
  return [...document.querySelectorAll(".perde, .anlam-fis, .cekmece-perde, .fis-sabit")].some((x) => x.getClientRects().length);
}

export function kur() {
  if (S.kuruldu) return;
  S.kuruldu = true;
  panelKur();
  kaynakYaz();
  hazirYaz();
  altYaz();
  pulYaz();

  beklemeGeriYukle();
  bus.on("sor", sorAl);
  // Masa'da Notlar paneli aynı yanda açılınca asistan yer verir
  bus.on("asistan:kapat", kapat);
  // Paylaşımla gelen metin (paylasim.js): hesap yolunda cevap bekleniyorsa "Cevabı getir"e basılmış gibi yerleşir
  bus.on("asistan:gelen", (y) => {
    const metin = String(y?.metin || "").trim();
    if (!metin || S.durum !== "bekleme" || !S.bekleme) return;
    if (y) y.alindi = true;
    hesapCevabi(metin);
    ac();
  });
  bus.on("ayarlar", () => {
    if (S.durum === "anahtarsiz") {
      const sg = saglayici();
      if (yol() === "hesap" || sg.id === "deneme" || sg.anahtar) {
        S.durum = "hazir";
        durumKutulariniTemizle();
        const bekleyen = S.bekleyenSoru;
        S.bekleyenSoru = null;
        if (bekleyen && yol() === "anahtar") sor(bekleyen.soru, { hazir: bekleyen.hazir });
      }
    }
    if (S.durum === "bekleme" && yol() === "anahtar") { durumKutulariniTemizle(); S.durum = "hazir"; S.bekleme = null; beklemeSakla(); izAyarla("bekliyor", ""); }
    altYaz();
    pulYaz();
  });

  // Esc paneli kapatır; açık bir pencere ya da fiş varsa önce o kapanır
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !S.acik || e.defaultPrevented || overlayVar()) return;
    e.preventDefault();
    e.stopPropagation();
    kapat();
  }, true);

  // Döndürünce panel yandan alta geçer: --sag-panel tazelenir
  ALT_MEDYA.addEventListener("change", () => { durakYaz(); sagPanelYaz(); });

  document.addEventListener("visibilitychange", () => {
    izCiz();
    // Uygulamadan dönünce "Cevabı getir" bir kez vurgulanır
    if (!document.hidden && S.durum === "bekleme" && S.bekleme && !S.bekleme.vurgulandi && P.getir) {
      S.bekleme.vurgulandi = true;
      P.getir.classList.add("vurgulu");
      beklemeHatirlat();   // panel kapatıldıysa
    }
  });
}
