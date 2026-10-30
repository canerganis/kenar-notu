// Asistan: yapay zekâ paneli (OZELLIKLER-2 §5, TASARIM-2 §7).
// İki yol aynı paneli kullanır: "hesap" soruyu kullanıcının açık ChatGPT/Gemini/Claude uygulamasına götürür,
// "anahtar" cevabı kullanıcının kendi anahtarıyla burada akıtır (Deneme sağlayıcısı çevrimdışı, hazır cevaplıdır).
// Anahtar hiçbir yerde loglanmaz: bu dosyada console çağrısı yok, hata metinlerine istek başlığı girmez.
import { h, icon, bus, store, toast, ayarla, kartEkle, panoyaYaz, belgeBul, YZ_UYGULAMALAR, YZ_SAGLAYICILAR } from "./ortak.js";
import * as SAYFALAR from "./sayfalar.js";

/* ================= Sabitler ================= */
const HAZIR_METIN = [
  ["acikla", "Açıkla", "Bunu açıkla."],
  ["ozetle", "Özetle", "Bunu kısaca özetle."],
  ["basitlestir", "Basitleştir", "Bunu daha basit anlat, konuya yeni başlıyormuşum gibi."],
  ["ornek", "Örnek ver", "Bununla ilgili somut bir örnek ver."],
  ["soru-uret", "Soru üret", "Bu konudan kendimi sınamam için üç soru üret, cevapları en sonda olsun."],
];
const HAZIR_GORSEL = [
  ["formul", "Bu formülü açıkla", "Bu formülü açıkla: her terim ne anlama geliyor?"],
  ["coz", "Bu soruyu çöz", "Bu soruyu çöz."],
  ["adim", "Adım adım göster", "Adım adım göster, her adımın gerekçesini yaz."],
  ["ozetle", "Özetle", "Bu bölgedekileri kısaca özetle."],
];
const HAZIR_ANLAM = ["anlam", "Anlamı", "Bu kelimenin bu bağlamdaki anlamını bir iki cümleyle ver; kökeni biliniyorsa kısaca ekle."];
const hazirBul = (id, gorsel) =>
  (gorsel ? HAZIR_GORSEL : HAZIR_METIN).find((x) => x[0] === id) ||
  [...HAZIR_METIN, ...HAZIR_GORSEL, HAZIR_ANLAM].find((x) => x[0] === id) || null;

// Uygulama adının ünlü uyumu: ChatGPT'de, Gemini'de, Claude'da
const EK = { chatgpt: "'de", gemini: "'de", claude: "'da" };
const MONOGRAM = { chatgpt: "Ch", gemini: "Ge", claude: "Cl" };
const buyuk = (s) => s.toLocaleUpperCase("tr");

const HATALAR = {
  anahtar: { lamba: "hata", metin: "Anahtar kabul edilmedi. Ayarlar'dan kontrol et.", eylem: "Ayarları aç" },
  model: { lamba: "hata", metin: "Model adını Ayarlar'dan kontrol et.", eylem: "Ayarları aç" },
  istek: { lamba: "hata", metin: "Sağlayıcı isteği kabul etmedi. Model adını ve ayarları kontrol et.", eylem: "Ayarları aç" },
  sinir: { lamba: "denenmedi", metin: "Sağlayıcının sınırına ulaşıldı. Biraz sonra yeniden dene.", eylem: "Yeniden dene" },
  sunucu: { lamba: "denenmedi", metin: "Sağlayıcı şu an cevap veremiyor. Biraz sonra yeniden dene.", eylem: "Yeniden dene" },
  ag: { lamba: "", metin: "Şu an bağlantı yok. Bağlantı gelince yeniden dene; okuma, yazma ve arama internetsiz çalışır.", eylem: "Yeniden dene" },
  ret: { lamba: null, metin: "Bu soruya cevap verilemedi.", eylem: "Soruyu değiştir" },
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
const sayiTr = (n, k = 1) => n.toLocaleString("tr-TR", { maximumFractionDigits: k, minimumFractionDigits: k });
const saatTr = (z = new Date()) => z.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const tarihTr = (z = new Date()) => z.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
const kaynakSatiri = (k) => [k.belgeAd, k.sayfa ? `s. ${k.sayfa}` : ""].filter(Boolean).join(" · ");

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
const metinIci = (t) => kacis(t)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/`([^`]+)`/g, "<code>$1</code>");
function satirIci(s) {
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+?)\$|\\\((.+?)\\\)/g;
  let son = 0, out = "", m;
  while ((m = re.exec(s))) {
    if (m[2] != null && /^\s|\s$/.test(m[2])) { re.lastIndex = m.index + 1; continue; } // "$5 ve $6" para birimi
    out += metinIci(s.slice(son, m.index)) + formul(m[1] ?? m[2] ?? m[3]);
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
  let tampon = "";
  try {
    for (;;) {
      const { value, done } = await okuyucu.read();
      if (done) break;
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
    okuyucu.cancel().catch(() => {});
  }
}

/* ================= HTTP ve hata eşleme ================= */
function httpHatasi(durum, govde) {
  if (durum === 401 || durum === 403) return new AsistanHatasi("anahtar", `${durum} · ANAHTAR`);
  if (durum === 404) return new AsistanHatasi("model", "404 · MODEL");
  if (durum === 429) return new AsistanHatasi("sinir", "429 · SINIR");
  if (durum === 400 && /API_KEY_INVALID|api[ _-]?key|authentication/i.test(govde)) return new AsistanHatasi("anahtar", "400 · ANAHTAR");
  if (durum === 400 && /model/i.test(govde) && /not found|not exist|invalid|unknown|unsupported/i.test(govde)) return new AsistanHatasi("model", "400 · MODEL");
  if (durum === 400) return new AsistanHatasi("istek", "400 · İSTEK");
  if (durum === 529 || durum === 503) return new AsistanHatasi("sunucu", `${durum} · YOĞUN`);
  return new AsistanHatasi("sunucu", `${durum} · SUNUCU`);
}
// Akış içinde gelen hata nesnesi (Claude "error" olayı, OpenAI "error" / "response.failed")
function akisHatasi(tip = "", kod = "") {
  const t = `${tip} ${kod}`;
  if (/authentication|permission|invalid_api_key/i.test(t)) return new AsistanHatasi("anahtar", "401 · ANAHTAR");
  if (/not_found|model_not_found/i.test(t)) return new AsistanHatasi("model", "404 · MODEL");
  if (/rate_limit|quota|429/i.test(t)) return new AsistanHatasi("sinir", "429 · SINIR");
  if (/overloaded|529|503/i.test(t)) return new AsistanHatasi("sunucu", "529 · YOĞUN");
  return new AsistanHatasi("sunucu", "AKIŞ · HATA");
}
async function istekAt(url, secenek) {
  if (navigator.onLine === false) throw new AsistanHatasi("ag", "AĞ YOK");
  let res;
  try { res = await fetch(url, secenek); } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new AsistanHatasi("ag", "AĞ YOK");
  }
  if (!res.ok) {
    let govde = "";
    try { govde = await res.text(); } catch { govde = ""; }
    throw httpHatasi(res.status, govde);
  }
  return res;
}

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
      if (k === "ag") throw new AsistanHatasi("ag", "AĞ YOK");
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
const KONULAR = [
  { id: "logturev", ad: "logaritmik türev", re: [/logaritmik türev/i, /ln\s*y\s*=/] },
  { id: "kapali", ad: "kapalı türev", re: [/kapalı türev|kapalı fonksiyon|kapalı olarak/i, /x(?:²|\^?2)\s*\+\s*y(?:²|\^?2)/i] },
  { id: "zincir", ad: "zincir kuralı", re: [/zincir kural/i, /bileşke fonksiyon/i, /f\s*∘\s*g|f′\s*\(\s*g\s*\(x\)\s*\)|dy\s*\/\s*du/i, /iç fonksiyon|dış fonksiyon/i] },
  { id: "difdenk", ad: "ayrılabilir diferansiyel denklemler", re: [/diferansiyel denklem|değişkenlerine ayır|ayrılabilir/i, /y′\s*=\s*\d*\s*y\b/] },
  { id: "statik", ad: "kiriş ve mesnet tepkileri", re: [sozBasi("kiriş|mesnet|moment|kesme kuvvet|serbest cisim|yayılı yük|tekil yük|statik"), /\d\s*kN\b/],
    // Örnek sayfaların hangisi: problem, örnek ya da kesme-moment bölümü
    alt: [[/problem 2\.7/i, "statik"], [/dV\s*\/\s*dx|eğilme momenti diyagram|kesit yöntemi/i, "statikVM"], [/örnek 2\.6|basit mesnetli/i, "statik26"]] },
  { id: "anatomi", ad: "üst ekstremitenin kas ve sinirleri", re: [sozBasi("pleksus|plexus|brakiyal|brachial|ekstremite|innervasyon|humerus|n\\.\\s|m\\.\\s|sinir"), /(?<!\p{L})kas(?:ı|ın|lar\p{L}*)?(?!\p{L})/iu],
    alt: [[/fossa cubitalis|dirsek çukuru/i, "anatomiFossa"], [/pleksus|plexus/i, "anatomi"], [/biceps|triceps|brachialis|coracobrachialis|kolun kasları/i, "anatomiKas"]] },
  { id: "turev", ad: "türev", re: [sozBasi("türev|limit|teğet|eğim|anlık değişim"), /f′|f'\(|dy\s*\/\s*dx/] },
];
const KONU_AD = {
  ...Object.fromEntries(KONULAR.map((x) => [x.id, x.ad])),
  statik26: "basit mesnetli kirişte mesnet tepkileri", statikVM: "kesme kuvveti ve eğilme momenti",
  anatomiKas: "kolun kasları", anatomiFossa: "fossa cubitalis",
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

// Konu tanınmadı: seçilen metnin kendisinden çalışma yönergesi
const DURAK = new Set("olarak olduğu olduğunu arasında birlikte üzerinde sonra önce kadar ancak çünkü dolayısıyla böylece şöyle bunların bunlar onların ayrıca yalnızca neredeyse herhangi".split(" "));
function anahtarlar(metin, n = 3) {
  const say = new Map();
  for (const k of String(metin).toLocaleLowerCase("tr").match(/\p{L}{6,}/gu) || []) if (!DURAK.has(k)) say.set(k, (say.get(k) || 0) + 1);
  return [...say].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map((x) => x[0]);
}
function genelCevap(hazir, k) {
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
function anlamCevabi(kelime, baglam) {
  const k = String(kelime || "").trim().toLocaleLowerCase("tr").replace(/[’'].*$/, "");
  const bul = DENEME_SOZLUK.find(([re]) => re.test(k));
  if (bul) return bul[1];
  return `«${String(kelime || "").trim()}» için deneme modunda hazır bir anlam yok.${baglam ? " Geçtiği cümleden tahmin et;" : ""} gerçek cevap için Ayarlar'dan bir sağlayıcı seç.`;
}

function denemeCevabi({ hazir, gorsel, kelime, soru = "", kaynak: k = {}, serbest = false }) {
  if (hazir === "anlam") return anlamCevabi(kelime, k.baglam);
  // Anlam kartının "Sor"u: «kelime» bu cümlede ne anlama geliyor?
  const anlamSorusu = serbest && /ne anlama gel|anlamı ne|ne demek/i.test(soru) && String(soru).match(/["“«]([^"”»]{1,40})["”»]/);
  if (anlamSorusu) return `«${anlamSorusu[1]}»: ${anlamCevabi(anlamSorusu[1], k.metin)}`;
  const konu = konuBul(k);
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
function sistemMetni(k) {
  return [
    "Sen Kenar Notu'nun çalışma asistanısın ve bir öğrenciye yardım ediyorsun.",
    "Her zaman Türkçe cevap ver. Kısa ve net ol; giriş ve kapanış cümlesi kurma.",
    "Matematikte adım adım git ve her matematiksel ifadeyi $...$ içine yaz. Liste gerekiyorsa satırı 1. ya da - ile başlat. Başlık ve tablo kullanma.",
    "Ekte görsel varsa önce görseldeki ifadeyi ya da soruyu oku, cevabı ona göre kur.",
    "Emin olmadığın yerde bunu açıkça söyle.",
    k.belgeAd ? `Bağlam: öğrenci "${k.belgeAd}" belgesinde${k.sayfa ? `, ${k.sayfa}. sayfada` : ""} çalışıyor.` : "",
  ].filter(Boolean).join("\n");
}
// İstem sırası her yolda aynı: kaynak + sayfa, alıntı, (görsel), soru. Talimatlar sistem metninde durur.
// Kementle gelen gerçek PDF'te metin tüm sayfadır: "Sayfanın metni" diye etiketlenir, hesap yolunda kısaltılır.
const kaynakBasi = (k) => (k.belgeAd ? `Kaynak: ${k.belgeAd}${k.sayfa ? `, s. ${k.sayfa}` : ""}` : "");
function istemGovdesi(k, soru, sinir = Infinity) {
  let metin = String(k.metin || "").trim();
  if (metin.length > sinir) metin = metin.slice(0, Math.max(metin.lastIndexOf(" ", sinir), sinir * 0.8)).trim() + " …";
  const p = [kaynakBasi(k)];
  if (metin) p.push(`${k.gorsel ? "Sayfanın metni" : "Alıntı"}:\n"""\n${metin}\n"""`);
  if (k.baglam && k.baglam !== k.metin) p.push(`Geçtiği cümle: "${k.baglam}"`);
  if (k.gorsel) p.push("Ekteki görsele bak: sayfadan kırptığım bölge.");
  p.push(`Soru: ${soru}`);
  return p.filter(Boolean).join("\n\n");
}
const ilkIstem = (k, soru) => istemGovdesi(k, soru);
// Hesap yolu: sistem talimatının kısa hali başa eklenir; sohbet uygulamasına tek parça gider
// Edebî alıntıda matematik satırı gürültüdür, düşer
const hesapTalimat = (k) => "Türkçe, kısa ve net cevap ver." + (konuBul(k) === "edebi" ? "" : " Matematikte adım adım git, formülleri $...$ içinde yaz.");
const hesapMetni = (soru) => `${hesapTalimat(S.kaynak)}\n\n${istemGovdesi(S.kaynak, soru, 1500)}`;
// Anlamı: kelime + geçtiği cümle; iki yol da aynı metni kullanır
function anlamIstemi({ kelime, baglam, belgeAd, sayfa }) {
  return [kaynakBasi({ belgeAd, sayfa }), `Kelime: «${String(kelime || "").trim()}»`, baglam ? `Geçtiği cümle: "${baglam}"` : "", `Soru: ${HAZIR_ANLAM[2]}`]
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
  P.baslik = h("h2", { class: "t-b2", id: "as-baslik" }, "Asistan");
  P.pulLamba = h("span", { class: "lamba" });
  P.pulAd = h("span", { class: "ad" });
  P.pulModel = h("span", { class: "model" });
  P.pul = h("span", { class: "cam cam-k as-pul" }, P.pulLamba, P.pulAd, P.pulModel);
  P.kapat = h("button", { type: "button", class: "ikon-dugme", "aria-label": "Asistanı kapat", onclick: () => kapat() }, icon("kapat"));
  P.tutamak = h("div", { class: "asistan-tutamak", role: "button", tabindex: "0", "aria-label": "Asistanı büyüt" });
  P.iz = izOlustur();
  P.izNot = P.iz.querySelector(".iz-not");
  P.kaynak = h("section", { class: "as-kaynak", "aria-label": "Kaynak" });
  P.hazir = h("div", { class: "as-hazir", role: "group", "aria-label": "Hazır sorular" });
  P.akis = h("div", { class: "as-akis" });
  P.govde = h("div", { class: "asistan-govde" }, P.kaynak, P.hazir, P.akis);

  P.soru = h("textarea", { rows: "1", enterkeyhint: "send", "aria-label": "Soru" });
  P.gonder = h("button", { type: "button", class: "ikon-dugme gonder", "aria-label": "Gönder", disabled: true }, icon("gonder"));
  P.uygulamaSec = h("div", { class: "as-uygulamalar", role: "radiogroup", "aria-label": "Uygulama" });
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
  P.tutamak.setAttribute("aria-label", P.el.dataset.durak === "tam" ? "Asistanı küçült" : "Asistanı büyüt");
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
  toast(`Cevap ${S.bekleme.uygulama.ad}${EK[S.bekleme.uygulama.id] || "'de"} bekleniyor.`,
    { etiket: "Cevabı getir", calistir: () => { ac(); cevabiGetir(); } });
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
    ad = `${u.ad} · Hesap`;
    etiket = `${u.ad}, hesabınla`;
  } else {
    const sg = saglayici();
    if (sg.id === "deneme") { lamba = "deneme"; ad = "Deneme"; etiket = "Deneme, çevrimdışı hazır cevaplar"; }
    else if (!sg.anahtar) { ad = `${sg.ad} · Anahtar yok`; etiket = `${sg.ad}, anahtar girilmemiş`; }
    else {
      const bagli = S.dogrulandi.has(sg.id) || (!S.reddedildi.has(sg.id) && yz().denemeler?.[sg.id]?.tamam);
      lamba = bagli ? "bagli" : "denenmedi";
      ad = `${sg.ad} ·`; model = sg.model;
      etiket = `${sg.ad}, ${sg.model}, ${lamba === "bagli" ? "bağlı" : "henüz denenmedi"}`;
    }
  }
  if (S.pulHata != null) lamba = S.pulHata;
  if (lamba) P.pulLamba.dataset.durum = lamba; else delete P.pulLamba.dataset.durum;
  P.pulAd.textContent = ad;
  P.pulModel.textContent = model;
  P.pulModel.hidden = !model;
  P.pul.setAttribute("aria-label", `Sağlayıcı: ${etiket}`);
  P.pul.title = etiket;
}

/* ---------- kaynak ---------- */
function kaynakYaz() {
  const k = S.kaynak;
  P.kaynak.replaceChildren();
  P.kaynak.hidden = !k.metin && !k.gorsel && !k.belgeAd;
  if (P.kaynak.hidden) return;
  const satir = kaynakSatiri(k);
  const etiket = h("button", { type: "button", class: "as-etiket" }, h("span", { class: "etiket-sayfa" }, "Kaynak"), h("span", {}, satir || "Seçim"));
  P.kaynak.append(etiket);
  if (k.metin) {
    // Formül parçası satır sonunda bölünmesin: türev işaretinden ya da harften sonra gelen parantez yapışık kalır (U+2060)
    const alinti = h("blockquote", { class: "as-alinti" }, `“${k.metin.trim().replace(/([′″\p{L}\d])(?=[(\[])/gu, "$1⁠")}”`);
    etiket.setAttribute("aria-expanded", "false");
    etiket.setAttribute("aria-label", `Kaynak: ${satir}. Alıntının tamamını göster`);
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
    const cap = h("figcaption", {}, "KIRPINTI");
    const img = h("img", { src: k.gorsel, alt: `Kırpılan bölge${satir ? ", " + satir : ""}` });
    img.addEventListener("load", () => { cap.textContent = `KIRPINTI · ${img.naturalWidth}×${img.naturalHeight}`; }, { once: true });
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
  P.soru.placeholder = hesap ? "Sorunu yaz ya da yukarıdan seç" : S.turlar.length ? "Takip sorusu yaz" : "Sorunu yaz ya da yukarıdan seç";
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
    P.hesapDugme.replaceChildren(icon(paylasir ? "paylas" : "disa-aktar"), h("span", {}, beklemede ? "Yeniden gönder" : `${u.ad}${EK[u.id] || "'de"} sor`));
  }
  altDurum();
}
function altDurum() {
  const akiyor = !!S.iptal;
  if (yol() === "hesap") { P.hesapDugme.disabled = !hesapSorusu(); return; }
  P.gonder.disabled = !akiyor && !P.soru.value.trim();
  P.gonder.setAttribute("aria-label", akiyor ? "Durdur" : "Gönder");
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
    else hataGoster(e instanceof AsistanHatasi ? e : new AsistanHatasi("sunucu", "HATA"), tur);
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
  tur.el = h("article", { class: "as-tur", "aria-label": "Cevap" },
    tur.soruGoster ? h("div", { class: "as-soru" }, h("span", { class: "t-daktilo" }, "Soru"), h("p", {}, tur.soru)) : null,
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
  const olcu = hesap ? null : h("span", { class: "cam cam-k soluk as-olcu" }, `${sayiTr(sn)} sn · ${kelimeSay(tur.cevap)} kelime`);
  const z = new Date();
  if (!durdu) {
    const damga = hesap ? `Kayıt · ${buyuk(hesap.ad)} · ${saatTr(z)}` : `Kayıt · ${tarihTr(z)} · ${saatTr(z)}`;
    tur.kayitEl.replaceChildren(h("span", { class: "damga" }, damga), olcu);
  } else if (olcu) tur.kayitEl.replaceChildren(olcu);
  if (durdu) tur.altEl.append(h("p", { class: "as-not" }, "Durduruldu."));
  else if (tur.saglayici === "deneme") tur.altEl.append(h("p", { class: "as-not" }, "Bu hazır bir örnek cevaptır."));
  if (tur.cevap.trim()) tur.altEl.append(eylemlerKur(tur));
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
    dugme("Kenara not", "kenara-not", () => {
      bus.emit("asistan:not", {
        belgeId: k.belgeId, sayfa: k.sayfa, metin: tur.cevap, soru: tur.soru,
        kaynak: tur.saglayiciAd || "Asistan", zaman: Date.now(),
      });
      damgala(k.sayfa ? `Kenara eklendi · s. ${k.sayfa}` : "Kenara eklendi");
    }, { disabled: !k.belgeId, title: k.belgeId ? null : "Bu soru bir belgeye bağlı değil" }),
    dugme("Karta çevir", "karta-cevir", (b) => {
      const alinti = k.metin ? k.metin.trim().slice(0, 220) + (k.metin.trim().length > 220 ? "…" : "") : "";
      kartEkle({
        tur: "soru",
        on: { metin: alinti ? `${tur.soru}\n“${alinti}”` : tur.soru, gorsel: tur.gorsel || k.gorsel || undefined },
        arka: { metin: tur.cevap },
        belgeId: k.belgeId, belgeAd: k.belgeAd, sayfa: k.sayfa,
      });
      b.disabled = true;
      damgala("Tekrar'a eklendi · kutu I");
    }),
    dugme("Kopyala", "kopyala", async () => {
      toast((await panoyaYaz(tur.cevap)) ? "Kopyalandı" : "Kopyalanamadı");
    }),
  );
  return kutu;
}

/* ---------- hata ve boş durum ---------- */
function hataGoster(hata, tur) {
  const t = HATALAR[hata.tur] || HATALAR.sunucu;
  tur.durum = "hata";
  if (hata.tur === "anahtar" || hata.tur === "model") { S.dogrulandi.delete(tur.saglayici); S.reddedildi.add(tur.saglayici); }
  if (hata.tur === "ret") tur.cevap = ""; // reddedilen kısmi cevap gösterilmez
  tur.cevapEl.remove();
  tur.kayitEl.remove();
  S.pulHata = t.lamba === null ? null : t.lamba;
  izAyarla("hata", "");
  const eylem = h("button", { type: "button", class: "metin-dugme vurgulu" },
    icon(t.eylem === "Yeniden dene" ? "yeniden" : t.eylem === "Ayarları aç" ? "ayarlar" : "metin"), h("span", {}, t.eylem));
  eylem.addEventListener("click", () => {
    if (t.eylem === "Ayarları aç") return ayarlarAc();
    tur.el.remove();
    S.turlar.splice(S.turlar.indexOf(tur), 1);
    if (t.eylem === "Yeniden dene") return sor(tur.soru, { hazir: tur.hazir });
    // Soruyu değiştir: soru alanına geri koy
    izAyarla("bekliyor", "");
    S.pulHata = null;
    pulYaz();
    P.soru.value = tur.soru;
    altDurum();
    P.soru.focus();
  });
  const fis = h("div", { class: "as-hata", role: "alert", dataset: { tur: hata.tur } },
    t.lamba === null ? h("span") : h("span", { class: "lamba", dataset: t.lamba ? { durum: t.lamba } : {} }),
    hata.kod ? h("span", { class: "kod" }, hata.kod) : h("span"),
    h("p", {}, t.metin), eylem);
  tur.altEl.replaceChildren(fis);
}

function anahtarsizGoster() {
  const sg = saglayici();
  S.durum = "anahtarsiz";
  durumKutulariniTemizle();
  izAyarla("bekliyor", "");
  const ayarDugme = h("button", { type: "button", class: "birincil" }, icon("ayarlar"), h("span", {}, "Ayarları aç"));
  ayarDugme.addEventListener("click", ayarlarAc);
  const deneDugme = h("button", { type: "button", class: "metin-dugme" }, "Deneme ile dene");
  // "ayarlar" dinleyicisi bekleyen soruyu kendisi sorar
  deneDugme.addEventListener("click", () => ayarla({ yz: { ...yz(), yol: "anahtar", saglayici: "deneme" } }));
  P.akis.append(h("div", { class: "as-bos" },
    h("div", { class: "tahta tahta--cerceve" }, feynman()),
    h("h3", { class: "t-b2" }, "Anahtar girilmemiş."),
    h("p", {}, `${sg.ad} için anahtar yok. Hesabınla sormak için Ayarlar'a dön.`),
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
    const d = [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find((b) => /Ayarlar/.test(b.textContent) && b.getClientRects().length);
    if (d) d.click(); else toast("Ayarlar kitaplıkta, Yapay zekâ bölümünde.");
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
      if (e?.name === "AbortError") { toast("Paylaşım iptal edildi."); return; }
    }
  }
  if (!paylasildi) {
    const q = metin.length > 1800 ? "" : metin; // uzun metin bağlantıya sığmaz, panodaki kopya yeter
    window.open(u.url(q), "_blank", "noopener");
    const ipucu = kopyalandi ? "Metin kopyalandı, açılan sohbete yapıştır." : "Metin kopyalanamadı; açılan sohbete soruyu yaz.";
    if (dosya) toast(ipucu, { etiket: "Görüntüyü indir", calistir: () => indir(dosya) });
    else toast(ipucu);
  }
  beklemeGoster(u, metin, soru);
}

function beklemeGoster(u, metin, soru) {
  durumKutulariniTemizle();
  S.durum = "bekleme";
  S.bekleme = { metin, soru, uygulama: u, vurgulandi: false, baslangic: performance.now() };
  beklemeSakla();
  izAyarla("bekliyor", buyuk(`${u.ad}${EK[u.id] || "'de"}`));
  const getir = h("button", { type: "button", class: "birincil" }, icon("yapistir"), h("span", {}, "Cevabı getir"));
  getir.addEventListener("click", cevabiGetir);
  const kopya = h("button", { type: "button", class: "metin-dugme" }, "Metni yeniden kopyala");
  kopya.addEventListener("click", async () => toast((await panoyaYaz(metin)) ? "Metin kopyalandı." : "Kopyalanamadı"));
  P.getir = getir;
  P.yapistirKap = h("div", { class: "as-yapistir-kap", hidden: true });
  const kutu = h("div", { class: "as-bekleme kareli", role: "status" },
    h("h3", {}, `Cevap ${u.ad}${EK[u.id] || "'de"}.`),
    h("p", {}, "Bitince cevabı kopyala ve buraya dön."),
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
  if (temiz) toast("Panoda hâlâ soru metni var. Cevabı kopyalayıp yeniden dene.");
  yapistirAc();
}
function yapistirAc() {
  const kap = P.yapistirKap;
  if (!kap || !kap.hidden) { kap?.querySelector("textarea")?.focus(); return; }
  const alan = h("textarea", { class: "as-yapistir", placeholder: "Cevabı buraya yapıştır", "aria-label": "Cevap" });
  const ekle = h("button", { type: "button", class: "metin-dugme vurgulu", disabled: true }, icon("tik"), h("span", {}, "Ekle"));
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
  if (S.durum === "bekleme" && S.bekleme) toast("Önceki sorunun bekleyen cevabı bırakıldı.");
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
  if (yol() === "hesap") { if (y.soru) { P.soru.value = y.soru; altDurum(); } return; }
  const soru = y.soru || (y.hazir && hazirBul(y.hazir, !!y.gorsel)?.[2]);
  if (soru) sor(soru, { hazir: y.hazir || null });
  else {
    const sg = saglayici();
    if (sg.id !== "deneme" && !sg.anahtar) anahtarsizGoster();
  }
}

function anlamHesapla(y) {
  const u = uygulama();
  const metin = `Türkçe, kısa ve net cevap ver.\n\n${anlamIstemi({ kelime: y.metin, baglam: y.baglam, belgeAd: y.belgeAd, sayfa: y.sayfa })}`;
  // Kullanıcı hareketi içinde: önce pano, sonra uygulama bağlantısı (açılır pencere engellenmesin)
  panoyaYaz(metin).then((ok) => toast(ok ? "Soru kopyalandı. Cevabı kopyalayıp buraya dön." : "Açılan sohbete soruyu yaz."));
  window.open(u.url(metin.length > 1800 ? "" : metin), "_blank", "noopener");
}

/* ================= Anlam: panelsiz akış (koltuk anlam kartı için) ================= */
// Dışa açık: koltuk.js doğrudan çağırabilir. parca(metin, toplam) her parçada çağrılır; dönen söz tam metni verir.
export async function anlamGetir({ kelime, baglam = "", belgeAd, sayfa, signal } = {}, parca) {
  const sg = saglayici();
  if (sg.id !== "deneme" && !sg.anahtar) throw new AsistanHatasi("anahtar", "ANAHTAR YOK");
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
    const hata = { tur: e?.tur || "sunucu", kod: e?.kod || "", mesaj: "Anlam getirilemedi." };
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
  if (sg.id !== saglayiciId) return { tamam: false, mesaj: "BİLİNMEYEN", tur: "istek" };
  if (sg.id === "deneme") {
    await bekle(260);
    return { tamam: true, ok: true, mesaj: "DENEME · HAZIR", tur: "deneme", ms: 0 };
  }
  if (!sg.anahtar) return { tamam: false, mesaj: "ANAHTAR YOK", tur: "anahtar-yok", durum: "anahtar-yok" };
  const denetci = new AbortController();
  const zaman = setTimeout(() => denetci.abort(), 15000);
  const t0 = performance.now();
  try {
    const [url, init] = DOGRULA[sg.id](sg.model, sg.anahtar);
    await istekAt(url, { ...init, signal: denetci.signal });
    const ms = Math.round(performance.now() - t0);
    S.dogrulandi.add(sg.id);
    S.reddedildi.delete(sg.id);
    return { tamam: true, ok: true, mesaj: `BAĞLI · ${ms} ms`, tur: "bagli", ms };
  } catch (e) {
    S.dogrulandi.delete(sg.id);
    if (e?.name === "AbortError") return { tamam: false, mesaj: "ZAMAN AŞIMI", tur: "ag", durum: "ag" };
    // durum: kabuğun cam şeridi için sayısal kod ya da "ag"
    const kod = e?.kod || "AĞ YOK";
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
