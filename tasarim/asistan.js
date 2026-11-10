import{h as $,icon as w,bus as z,store as na,toast as g,ayarla as fe,kartEkle as ra,kartEklendiBildir as sa,panoyaYaz as F,belgeBul as L,simgeEkle as oa,YZ_UYGULAMALAR as S,YZ_SAGLAYICILAR as be,UYGULAMA_ADI as ee,yerelKabukMu as ge}from"./ortak.js";import{yzOnayi as xe,cevapBildir as la}from"./izin.js";import*as ae from"./sayfalar.js";import{formulleriCiz as da}from"./matematik.js";import{webAraDugmeleri as $a}from"./iz-bag.js";import{t as r,yerel as E,ingilizceMi as _}from"./dil.js";import{BAGLAM_ANAHTARI as R,soruMetniMi as ua,cevapMi as ma,baglamYap as ya,baglamUygun as ha}from"./cevap-yeri.js";import{stilYukle as ka}from"./ortak.js";await ka("asistan.css"),oa("bayrak",'<path d="M6 21V4"/><path class="d" d="M6 4.5h11.5l-2.6 4.2 2.6 4.3H6"/>');const te=[["acikla",r("Açıkla"),r("Bunu açıkla.")],["ozetle",r("Özetle"),r("Bunu kısaca özetle.")],["basitlestir",r("Basitleştir"),r("Bunu daha basit anlat, konuya yeni başlıyormuşum gibi.")],["ornek",r("Örnek ver"),r("Bununla ilgili somut bir örnek ver.")],["soru-uret",r("Soru üret"),r("Bu konudan kendimi sınamam için üç soru üret, cevapları en sonda olsun.")]],ie=[["formul",r("Bu formülü açıkla"),r("Bu formülü açıkla: her terim ne anlama geliyor?")],["coz",r("Bu soruyu çöz"),r("Bu soruyu çöz.")],["adim",r("Adım adım göster"),r("Adım adım göster, her adımın gerekçesini yaz.")],["ozetle",r("Özetle"),r("Bu bölgedekileri kısaca özetle.")]],ve=["anlam",r("Anlamı"),r("Bu kelimenin bu bağlamdaki anlamını bir iki cümleyle ver; kökeni biliniyorsa kısaca ekle.")],O=(e,a)=>(a?ie:te).find(t=>t[0]===e)||[...te,...ie,ve].find(t=>t[0]===e)||null,ca={chatgpt:"'de",gemini:"'de",claude:"'da"},Y=e=>_?e.ad:`${e.ad}${ca[e.id]||"'de"}`,pa={chatgpt:"Ch",gemini:"Ge",claude:"Cl"},we=e=>e.toLocaleUpperCase(E),ze={anahtar:{lamba:"hata",metin:r("Anahtar kabul edilmedi. Ayarlar'dan kontrol et."),eylem:"Ayarları aç"},model:{lamba:"hata",metin:r("Model adını Ayarlar'dan kontrol et."),eylem:"Ayarları aç"},istek:{lamba:"hata",metin:r("Sağlayıcı isteği kabul etmedi. Model adını ve ayarları kontrol et."),eylem:"Ayarları aç"},sinir:{lamba:"denenmedi",metin:r("Sağlayıcının sınırına ulaşıldı. Biraz sonra yeniden dene."),eylem:"Yeniden dene"},sunucu:{lamba:"denenmedi",metin:r("Sağlayıcı şu an cevap veremiyor. Biraz sonra yeniden dene."),eylem:"Yeniden dene"},ag:{lamba:"",metin:r("Şu an bağlantı yok. Bağlantı gelince yeniden dene; okuma, yazma ve arama internetsiz çalışır."),eylem:"Yeniden dene"},zaman:{lamba:"denenmedi",metin:r("Sağlayıcı 60 saniyedir cevap vermiyor. Bağlantını kontrol edip yeniden dene."),eylem:"Yeniden dene"},ret:{lamba:null,metin:r("Bu soruya cevap verilemedi."),eylem:"Soruyu değiştir"}};class k extends Error{constructor(a,t=""){super(a),this.name="AsistanHatasi",this.tur=a,this.kod=t}}const o={kuruldu:!1,acik:!1,kaynak:{},dosya:null,turlar:[],hazir:null,durum:"hazir",iptal:null,izDurum:"bekliyor",pulHata:null,bekleme:null,bekleyenSoru:null,dogrulandi:new Set,reddedildi:new Set,oncekiOdak:null};let s=null;const C=()=>na.ayarlar.yz||{},x=()=>C().yol==="anahtar"?"anahtar":"hesap",I=()=>S.find(e=>e.id===C().uygulama)||S[0];function N(e=C().saglayici){const a=be.find(i=>i.id===e)||be[0],t=String(C().modeller?.[a.id]||a.varsayilanModel).trim().replace(/^models\//,"");return{...a,model:t,anahtar:String(C().anahtarlar?.[a.id]||"").trim()}}export function izOlustur(){const e="M0 8Q12.5 2 25 8"+Array.from({length:15},(t,i)=>`T${50+i*25} 8`).join(""),a=$("div",{class:"iz","aria-hidden":"true",dataset:{durum:"bekliyor"}});return a.innerHTML=`<i><svg viewBox="0 0 400 16" preserveAspectRatio="none"><path class="iz-golge" d="${e}"/><path class="iz-cizgi" d="${e}"/></svg></i><span class="iz-not"></span>`,a}function A(e,a){o.izDurum=e,a!==void 0&&(s.izNot.textContent=a),G()}function G(){const e=o.izDurum==="akiyor"||o.izDurum==="dusunuyor";s.iz.dataset.durum=e&&(document.hidden||!o.acik)?"bekliyor":o.izDurum}const ne=(e,a)=>new Promise((t,i)=>{if(a?.aborted)return i(new DOMException("Durduruldu","AbortError"));const n=setTimeout(t,e);a?.addEventListener("abort",()=>{clearTimeout(n),i(new DOMException("Durduruldu","AbortError"))},{once:!0})}),re=e=>(String(e).match(/^data:([^;,]+)/)||[])[1]||"image/png",se=e=>String(e).slice(String(e).indexOf(",")+1);function fa(e,a="kenar-notu-kirpinti.png"){try{const t=atob(se(e)),i=new Uint8Array(t.length);for(let n=0;n<t.length;n++)i[n]=t.charCodeAt(n);return new File([i],a,{type:re(e)})}catch{return null}}function ba(e){const a=URL.createObjectURL(e);$("a",{href:a,download:e.name}).click(),setTimeout(()=>URL.revokeObjectURL(a),4e3)}const ga=e=>e.trim()?e.trim().split(/\s+/).length:0,xa=(e,a=1)=>e.toLocaleString(E,{maximumFractionDigits:a,minimumFractionDigits:a}),Ae=(e=new Date)=>e.toLocaleTimeString(E,{hour:"2-digit",minute:"2-digit"}),va=(e=new Date)=>e.toLocaleDateString(E,{day:"2-digit",month:"2-digit",year:"numeric"}),wa=e=>[e.belgeAd,e.sayfa?r("s. {n}",{n:e.sayfa}):""].filter(Boolean).join(" · "),oe=e=>e.replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a]),za={"\\cdot":"·","\\times":"×","\\div":"÷","\\pm":"±","\\mp":"∓","\\to":"→","\\rightarrow":"→","\\Rightarrow":"⇒","\\iff":"⇔","\\infty":"∞","\\leq":"≤","\\le":"≤","\\geq":"≥","\\ge":"≥","\\neq":"≠","\\ne":"≠","\\approx":"≈","\\equiv":"≡","\\pi":"π","\\alpha":"α","\\beta":"β","\\gamma":"γ","\\delta":"δ","\\Delta":"Δ","\\theta":"θ","\\lambda":"λ","\\mu":"μ","\\sigma":"σ","\\Sigma":"Σ","\\omega":"ω","\\Omega":"Ω","\\epsilon":"ε","\\varepsilon":"ε","\\rho":"ρ","\\phi":"φ","\\varphi":"φ","\\tau":"τ","\\eta":"η","\\sum":"∑","\\prod":"∏","\\int":"∫","\\oint":"∮","\\partial":"∂","\\nabla":"∇","\\in":"∈","\\notin":"∉","\\subset":"⊂","\\cup":"∪","\\cap":"∩","\\forall":"∀","\\exists":"∃","\\circ":"∘","\\degree":"°","\\cdots":"⋯","\\ldots":"…","\\dots":"…","\\prime":"′","\\lim":"lim","\\sin":"sin","\\cos":"cos","\\tan":"tan","\\cot":"cot","\\ln":"ln","\\log":"log","\\exp":"exp","\\max":"max","\\min":"min","\\left":"","\\right":"","\\quad":" ","\\qquad":"  ","\\displaystyle":""},le=e=>/^[\w.,′'√πα-ωΑ-Ω]+$/u.test(e.trim())?e.trim():`(${e.trim()})`;function Aa(e){let a=e.replace(/\\\{/g,"").replace(/\\\}/g,"");a=a.replace(/\\mathbb\{(\w)\}/g,(t,i)=>({R:"ℝ",N:"ℕ",Z:"ℤ",Q:"ℚ",C:"ℂ"})[i]||i);for(let t=0;t<4;t++)a=a.replace(/\\sqrt\{([^{}]*)\}/g,(i,n)=>`√${le(n)}`).replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,(i,n,d)=>`${le(n)}/${le(d)}`);return a=a.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g,"$1"),a=a.replace(/\\[,;:!]/g," ").replace(/\\[A-Za-z]+/g,t=>za[t]??t.slice(1)),a=oe(a.replace(/-/g,"−")),a=a.replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9+\-−′'∞])/g,(t,i,n)=>`<sup>${i??n}</sup>`),a=a.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g,(t,i,n)=>`<sub>${i??n}</sub>`),a=a.replace(/[{}]/g,"").replace(/\u0001/g,"{").replace(/\u0002/g,"}"),a=a.split(/(<[^>]+>|&[a-z]+;)/).map((t,i)=>i%2?t:t.replace(/[0-9]+(?:[.,][0-9]+)?|[()[\]=+−±∓·×÷<>≤≥≠≈→⇒∞∑∏∫√]+/g,n=>`<span class="dik">${n}</span>`)).join(""),`<i class="formul">${a}</i>`}const Ta=(e,a)=>`<span data-tex="${oe(e.trim())}"${a?" data-blok":""}>${Aa(e)}</span>`,Te=e=>oe(e).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,"<code>$1</code>");function H(e){const a=/\$\$([^$]+)\$\$|\$([^$\n]+?)\$|\\\((.+?)\\\)/g;let t=0,i="",n;for(;n=a.exec(e);){if(n[2]!=null&&/^\s|\s$/.test(n[2])){a.lastIndex=n.index+1;continue}i+=Te(e.slice(t,n.index))+Ta(n[1]??n[2]??n[3],n[1]!=null),t=a.lastIndex}return i+Te(e.slice(t))}function Sa(e){const a=e.replace(/\r/g,"").replace(/\\\[([\s\S]*?)\\\]/g,(d,l)=>"$$"+l.replace(/\n/g," ")+"$$").replace(/\$\$\s*\n([\s\S]*?)\n\s*\$\$/g,(d,l)=>"$$"+l.replace(/\n/g," ")+"$$");let t="",i=null;const n=()=>{i&&(t+=`</${i}>`,i=null)};for(const d of a.split(`
`)){const l=d.trim();if(!l){n();continue}let m;if(m=l.match(/^(\d+)[.)]\s+(.*)$/)){i!=="ol"&&(n(),t+=m[1]!=="1"?`<ol start="${+m[1]}">`:"<ol>",i="ol"),t+=`<li>${H(m[2])}</li>`;continue}if(m=l.match(/^[-*•]\s+(.*)$/)){i!=="ul"&&(n(),t+="<ul>",i="ul"),t+=`<li>${H(m[1])}</li>`;continue}n();const u=l.match(/^#{1,6}\s+(.*)$/);t+=u?`<p><b>${H(u[1])}</b></p>`:`<p>${H(l)}</p>`}return n(),t}const _a=e=>e.replace(/\$\$?|\\\(|\\\)|\*\*/g,"");function Se(e){let a="message";const t=[];for(const d of e.split(/\r?\n/)){if(!d||d.startsWith(":"))continue;const l=d.indexOf(":"),m=l<0?d:d.slice(0,l);let u=l<0?"":d.slice(l+1);u.startsWith(" ")&&(u=u.slice(1)),m==="event"?a=u:m==="data"&&t.push(u)}if(!t.length)return null;const i=t.join(`
`);if(i==="[DONE]")return{bitti:!0};let n=null;try{n=JSON.parse(i)}catch{n=null}return{olay:a,json:n}}async function*de(e){const a=e.body.pipeThrough(new TextDecoderStream).getReader(),t=Ce.get(e);let i="";try{for(;;){let d;try{d=await a.read()}catch(h){throw t?.doldu()?new k("zaman",r("60 SN · ZAMAN AŞIMI")):h}const{value:l,done:m}=d;if(m)break;t?.yenile(),i+=l;let u;for(;u=i.match(/\r?\n\r?\n/);){const h=Se(i.slice(0,u.index));if(i=i.slice(u.index+u[0].length),h?.bitti)return;h&&(yield h)}}const n=i.trim()&&Se(i);n&&!n.bitti&&(yield n)}finally{t?.birak(),a.cancel().catch(()=>{})}}function _e(e,a){return e===401||e===403?new k("anahtar",r("{d} · ANAHTAR",{d:e})):e===404?new k("model","404 · MODEL"):e===429?new k("sinir",r("429 · SINIR")):e===400&&/API_KEY_INVALID|api[ _-]?key|authentication/i.test(a)?new k("anahtar",r("400 · ANAHTAR")):e===400&&/model/i.test(a)&&/not found|not exist|invalid|unknown|unsupported/i.test(a)?new k("model","400 · MODEL"):e===400?new k("istek",r("400 · İSTEK")):e===529||e===503?new k("sunucu",r("{d} · YOĞUN",{d:e})):new k("sunucu",r("{d} · SUNUCU",{d:e}))}function j(e="",a=""){const t=`${e} ${a}`;return/authentication|permission|invalid_api_key/i.test(t)?new k("anahtar",r("401 · ANAHTAR")):/not_found|model_not_found/i.test(t)?new k("model","404 · MODEL"):/rate_limit|quota|429/i.test(t)?new k("sinir",r("429 · SINIR")):/overloaded|529|503/i.test(t)?new k("sunucu",r("529 · YOĞUN")):new k("sunucu",r("AKIŞ · HATA"))}const Ca=6e4;async function W(e,a){if(navigator.onLine===!1)throw new k("ag",r("AĞ YOK"));const t=a.signal;if(t?.aborted)throw new DOMException("Durduruldu","AbortError");const i=new AbortController;let n=!1,d=0;const l={yenile(){clearTimeout(d),d=setTimeout(()=>{n=!0,i.abort()},Ca)},birak(){clearTimeout(d)},doldu:()=>n};t?.addEventListener("abort",()=>{l.birak(),i.abort()},{once:!0}),l.yenile();let m;try{m=await fetch(e,{...a,signal:i.signal})}catch(u){throw l.birak(),n?new k("zaman",r("60 SN · ZAMAN AŞIMI")):u.name==="AbortError"?u:new k("ag",r("AĞ YOK"))}if(!m.ok){let u="";try{u=await m.text()}catch{u=""}throw l.birak(),_e(m.status,u)}return m.body?Ce.set(m,l):l.birak(),m}const Ce=new WeakMap,Ne={async gemini({sistem:e,mesajlar:a,model:t,anahtar:i,signal:n},d){const l={systemInstruction:{parts:[{text:e}]},contents:a.map(u=>({role:u.rol==="assistant"?"model":"user",parts:[{text:u.metin},...u.gorsel?[{inline_data:{mime_type:re(u.gorsel),data:se(u.gorsel)}}]:[]]}))},m=await W(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(t)}:streamGenerateContent?alt=sse`,{method:"POST",signal:n,body:JSON.stringify(l),headers:{"content-type":"application/json","x-goog-api-key":i}});for await(const{json:u}of de(m)){if(!u)continue;if(u.error)throw j(u.error.status,u.error.code);if(u.promptFeedback?.blockReason)throw new k("ret");const h=u.candidates?.[0],y=(h?.content?.parts||[]).filter(b=>b.text&&!b.thought).map(b=>b.text).join("");if(y&&d(y),/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(h?.finishReason||""))throw new k("ret")}},async claude({sistem:e,mesajlar:a,model:t,anahtar:i,signal:n},d){const l={model:t,max_tokens:16e3,stream:!0,fallbacks:"default",system:e,messages:a.map(u=>u.rol==="assistant"?{role:"assistant",content:u.metin}:{role:"user",content:[...u.gorsel?[{type:"image",source:{type:"base64",media_type:re(u.gorsel),data:se(u.gorsel)}}]:[],{type:"text",text:u.metin}]})},m=await W("https://api.anthropic.com/v1/messages",{method:"POST",signal:n,body:JSON.stringify(l),headers:{"x-api-key":i,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json","anthropic-beta":"server-side-fallback-2026-07-01"}});for await(const{olay:u,json:h}of de(m)){const y=h?.type||u;if(y==="content_block_delta"&&h.delta?.type==="text_delta")d(h.delta.text);else{if(y==="message_delta"&&h.delta?.stop_reason==="refusal")throw new k("ret");if(y==="error")throw j(h?.error?.type)}}},async openai({sistem:e,mesajlar:a,model:t,anahtar:i,signal:n},d){const l={model:t,stream:!0,instructions:e,input:a.map(u=>u.rol==="assistant"?{role:"assistant",content:u.metin}:{role:"user",content:[{type:"input_text",text:u.metin},...u.gorsel?[{type:"input_image",image_url:u.gorsel}]:[]]})},m=await W("https://api.openai.com/v1/responses",{method:"POST",signal:n,body:JSON.stringify(l),headers:{Authorization:`Bearer ${i}`,"content-type":"application/json"}});for await(const{olay:u,json:h}of de(m)){const y=h?.type||u;if(y==="response.output_text.delta")d(h.delta||"");else{if(y==="response.refusal.delta"||y==="response.refusal.done")throw new k("ret");if(y==="error")throw j(h?.code||h?.error?.type,h?.error?.code);if(y==="response.failed")throw j(h?.response?.error?.code)}}},async deneme({signal:e,hazir:a,gorsel:t,soru:i,kelime:n,kaynak:d},l){const m=String(i||"").trim().match(/^#(401|403|404|429|ag|ret|500)$/i);if(await ne(520+Math.random()*380,e),m){const y=m[1].toLowerCase();throw y==="ag"?new k("ag",r("AĞ YOK")):y==="ret"?new k("ret"):_e(+y,"")}const h=Ha({hazir:a,gorsel:t,kelime:n,soru:i,kaynak:d||{},serbest:!a}).match(/\$[^$\n]+\$\S*\s*|\S+\s*|\s+/g)||[];for(const y of h)l(y),await ne(/[.:!?]\s*$/.test(y)?110+Math.random()*90:16+Math.random()*26,e)}},$e=e=>new RegExp(`(?<!\\p{L})(?:${e})`,"iu"),Be=[{id:"logturev",ad:"logaritmik türev",re:[/logaritmik türev|logarithmic differentiation/i,/ln\s*y\s*=/]},{id:"kapali",ad:"kapalı türev",re:[/kapalı türev|kapalı fonksiyon|kapalı olarak|implicit differentiation|implicitly/i,/x(?:²|\^?2)\s*\+\s*y(?:²|\^?2)/i]},{id:"zincir",ad:"zincir kuralı",re:[/zincir kural|chain rule/i,/bileşke fonksiyon|composite function/i,/f\s*∘\s*g|f′\s*\(\s*g\s*\(x\)\s*\)|dy\s*\/\s*du/i,/iç fonksiyon|dış fonksiyon|inner function|outer function/i]},{id:"difdenk",ad:"ayrılabilir diferansiyel denklemler",re:[/diferansiyel denklem|değişkenlerine ayır|ayrılabilir|differential equation|separable|separate the variables/i,/y′\s*=\s*\d*\s*y\b/]},{id:"statik",ad:"kiriş ve mesnet tepkileri",re:[$e("kiriş|mesnet|moment|kesme kuvvet|serbest cisim|yayılı yük|tekil yük|statik|beam|shear force|free body|distributed load|point load|statics"),/\d\s*kN\b/],alt:[[/problem 2\.7/i,"statik"],[/dV\s*\/\s*dx|eğilme momenti diyagram|kesit yöntemi|bending moment diagram|method of sections/i,"statikVM"],[/örnek 2\.6|basit mesnetli|example 2\.6|simply supported/i,"statik26"]]},{id:"anatomi",ad:"üst ekstremitenin kas ve sinirleri",re:[$e("pleksus|plexus|brakiyal|brachial|ekstremite|innervasyon|humerus|n\\.\\s|m\\.\\s|sinir|upper limb|innervat|nerve"),/(?<!\p{L})kas(?:ı|ın|lar\p{L}*)?(?!\p{L})|(?<!\p{L})muscles?(?!\p{L})/iu],alt:[[/fossa cubitalis|dirsek çukuru|cubital fossa/i,"anatomiFossa"],[/pleksus|plexus/i,"anatomi"],[/biceps|triceps|brachialis|coracobrachialis|kolun kasları|muscles of the arm/i,"anatomiKas"]]},{id:"turev",ad:"türev",re:[$e("türev|limit|teğet|eğim|anlık değişim|derivative|tangent|slope|instantaneous rate"),/f′|f'\(|dy\s*\/\s*dx/]}],Na={...Object.fromEntries(Be.map(e=>[e.id,e.ad])),statik26:"basit mesnetli kirişte mesnet tepkileri",statikVM:"kesme kuvveti ve eğilme momenti",anatomiKas:"kolun kasları",anatomiFossa:"fossa cubitalis"},Ba={logturev:"logarithmic differentiation",kapali:"implicit differentiation",zincir:"the chain rule",difdenk:"separable differential equations",statik:"beams and support reactions",anatomi:"the muscles and nerves of the upper limb",turev:"the derivative",statik26:"support reactions in a simply supported beam",statikVM:"shear force and bending moment",anatomiKas:"the muscles of the arm",anatomiFossa:"the cubital fossa"};function Ma(e){const a=e.belgeId?L(e.belgeId):null,t=a?.veri;if(!a||a.dosya||!e.sayfa||!Array.isArray(t?.sayfalar))return"";const i=t.sayfalar[e.sayfa-(t.ilkNo||1)];if(!i)return"";const n=typeof ae.ornekSayfalari=="function"&&ae.ornekSayfalari(a.id)||ae.PDF_PAGES;return[i.tur==="pdf"?Ea(n?.[i.pdf]):"",...(i.metinler||[]).map(l=>l.metin||"")].filter(Boolean).join(" ")}function Ea(e){let a="";try{a=String(e?.text||"")}catch{a=""}return a.trim()||typeof e?.draw!="function"?a:(String(e.draw).match(/"(?:[^"\\\n]|\\.)*"/g)||[]).join(" ")}function Me(e){const a=e.belgeId?L(e.belgeId):null,t=[e.metin,e.gorsel||!e.metin?Ma(e):"",[e.belgeAd,a?.ad,a?.yazar].filter(Boolean).join(" ")];for(const i of t){if(!i)continue;const n=Be.find(d=>d.re.some(l=>l.test(i)));if(n)return n.alt?.find(([d])=>d.test(i))?.[1]||n.id}return e.metin&&(a?a.tur==="epub":e.kaynak==="koltuk")&&!/[=∫√∑²³]/.test(e.metin)?"edebi":"genel"}const Ee={zincir:{acikla:`Zincir kuralı, iç içe geçmiş (bileşke) bir fonksiyonun türevini katman katman alır.
1. Fonksiyonu iki katmana ayır: dış fonksiyon $f$, iç fonksiyon $g$; yani $F(x) = f(g(x))$.
2. Dış fonksiyonun türevini al ama içine dokunma: $f′(g(x))$.
3. Bunu iç fonksiyonun türeviyle çarp: $F′(x) = f′(g(x)) · g′(x)$.
Neden çarpım? $x$ biraz değişince $u = g(x)$, $g′(x)$ kat değişir; $u$ değişince $y$, $f′(u)$ kat değişir. Art arda iki büyütme oranı çarpılır.
Leibniz gösterimiyle $dy/dx = (dy/du) · (du/dx)$; $du$'lar sadeleşiyormuş gibi düşünmek kuralı hatırlatır.`,ozetle:`Üç satırda özet:
- Bileşke fonksiyon $F(x) = f(g(x))$ ise $F′(x) = f′(g(x)) · g′(x)$.
- Kısaca: dış türev (içi aynen kalır) çarpı iç türev.
- Örneğin $y = (3x^2 + 1)^5$ için $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.`,basitlestir:`Zincir kuralını birbirine geçmiş dişli çarklar gibi düşün: $x$ çarkı $u$ çarkını, $u$ çarkı da $y$ çarkını döndürüyor.
$x$ bir tur dönünce $u$ 3 tur, $u$ bir tur dönünce $y$ 2 tur dönüyorsa, $x$ bir tur dönünce $y$ $3 · 2 = 6$ tur döner.
Türevler bu "kaç kat" oranlarıdır: $dy/dx = (dy/du) · (du/dx)$.
Pratik kural: önce en dıştaki işlemin türevini al, içine dokunma; sonra içteki ifadenin türeviyle çarp.`,ornek:`Somut örnek: $y = (3x^2 + 1)^5$.
1. İç fonksiyon $u = 3x^2 + 1$, dış fonksiyon $y = u^5$.
2. Dış türev: $dy/du = 5u^4 = 5(3x^2 + 1)^4$.
3. İç türev: $du/dx = 6x$.
4. Çarp: $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.
Sağlama: $x = 0$ için $y′ = 0$ çıkıyor. Gerçekten $3x^2 + 1$ en küçük değerini $x = 0$'da alır, teğet orada yataydır.`,"soru-uret":`Kendini sınamak için üç soru:
1. $y = sin(4x)$ ise $y′$ nedir?
2. $y = ln(cos x)$ fonksiyonunun türevini bul.
3. $y = tan^2(3x)$ için $y′$ nedir? İpucu: zincir iki kez uygulanır.
**Cevaplar**
1. $y′ = cos(4x) · 4 = 4cos(4x)$.
2. $y′ = (1/cos x) · (−sin x) = −tan x$.
3. $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.`,formul:`Görüntüdeki ifade zincir kuralı: $F′(x) = f′(g(x)) · g′(x)$.
1. $F = f ∘ g$: önce $g$, sonra $f$ uygulanan bileşke fonksiyon.
2. $g′(x)$: iç fonksiyonun $x$ noktasındaki değişim hızı.
3. $f′(g(x))$: dış fonksiyonun türevi, ama $x$'te değil $g(x)$ noktasında. En sık hata burada $f′(x)$ yazmaktır.
4. Leibniz biçimi: $u = g(x)$ ise $dy/dx = (dy/du) · (du/dx)$.
Koşul: $g$, $x$ noktasında; $f$ de $g(x)$ noktasında türevlenebilir olmalı.`,coz:`Sayfadaki Örnek 1: $y = (3x^2 + 1)^5$.
1. Katmanları ayır: $u = 3x^2 + 1$ ve $y = u^5$.
2. Dış türev: $dy/du = 5u^4$.
3. İç türev: $du/dx = 6x$.
4. Zincir kuralı: $dy/dx = 5u^4 · 6x = 30x(3x^2 + 1)^4$.
Sonuç: $y′ = 30x(3x^2 + 1)^4$.`,adim:`Adım adım, sayfadaki alıştırmalardan $y = tan^2(3x)$ ile:
1. Katmanları ayır: $y = u^2$, $u = tan v$, $v = 3x$. Gerekçe: üç iç içe işlem var, her biri bir çarpan getirecek.
2. En dış katman: $dy/du = 2u = 2tan(3x)$. Gerekçe: kuvvet kuralı, içi aynen kalır.
3. Orta katman: $du/dv = sec^2 v = sec^2(3x)$. Gerekçe: $(tan v)′ = sec^2 v$.
4. İç katman: $dv/dx = 3$.
5. Çarp: $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.
Çarpan sayısı katman sayısına eşit olmalı; biri eksikse bir katman unutulmuştur.`,"ozetle-gorsel":`Bu bölgede üç parça var:
- Teorem: $F = f ∘ g$ ise $F′(x) = f′(g(x)) · g′(x)$.
- Leibniz biçimi: $dy/dx = (dy/du) · (du/dx)$.
- Örnek 1: $y = (3x^2 + 1)^5$ için $y′ = 30x(3x^2 + 1)^4$.
Kısaca bölge, bileşke fonksiyonun türevini "dış türev çarpı iç türev" diye özetliyor.`},kapali:{acikla:`Kapalı türev, $y$'yi $x$ cinsinden yalnız bırakamadığın denklemlerde türev almanın yoludur.
1. Denklemin iki tarafının da $x$'e göre türevini al.
2. $y$ içeren her terimde zincir kuralı işler: $y$, $x$'in bir fonksiyonu olduğu için $(y^2)′ = 2y · y′$ olur.
3. $y′$ içeren terimleri bir tarafa topla ve $y′$'yü çek.
Örnek: $x^2 + y^2 = 25$ ise $2x + 2y · y′ = 0$, buradan $y′ = −x/y$.
Sonuç hem $x$'e hem $y$'ye bağlıdır; eğim için noktanın iki koordinatı da gerekir.`,ozetle:`Üç satırda özet:
- Kapalı türev, $F(x, y) = c$ biçimindeki denklemlerde $y$'yi yalnız bırakmadan türev almayı sağlar.
- $y$ içeren her terim zincir kuralıyla türetilir ve sonuna $y′$ çarpanı gelir.
- Çember $x^2 + y^2 = 25$ için $y′ = −x/y$; $(3, 4)$ noktasında teğetin eğimi $−3/4$.`,basitlestir:`Bazı eğriler "$y = ...$" diye yazılamaz; çember böyledir, bir $x$ değerine iki $y$ düşer.
Kapalı türevde $y$'yi yalnız bırakmaya uğraşmazsın. Denklemi olduğu gibi türetirsin; yalnız her $y$ teriminin sonuna bir $y′$ eklersin, çünkü $x$ değişince $y$ de değişir.
Çember $x^2 + y^2 = 25$: türetince $2x + 2y · y′ = 0$, yani $y′ = −x/y$.
Sağ üstteki $(3, 4)$ noktasında eğim $−3/4$ çıkar: eğri orada aşağı iniyor, beklendiği gibi.`,ornek:`Örnek: $x^3 + y^3 = 6xy$ eğrisine (Descartes yaprağı) $(3, 3)$ noktasında teğet.
1. Nokta eğrinin üstünde mi: $27 + 27 = 54 = 6 · 3 · 3$. Evet.
2. İki tarafı türet: $3x^2 + 3y^2 y′ = 6y + 6xy′$. Sağda çarpım kuralı kullanıldı.
3. $y′$'yü topla: $y′(3y^2 − 6x) = 6y − 3x^2$, yani $y′ = (2y − x^2)/(y^2 − 2x)$.
4. $(3, 3)$ noktasında: $y′ = (6 − 9)/(9 − 6) = −1$.
5. Teğet: $y − 3 = −(x − 3)$, yani $y = −x + 6$.`,"soru-uret":`Kendini sınamak için üç soru:
1. $x^2 + y^2 = 25$ çemberine $(−3, 4)$ noktasında çizilen teğetin eğimi kaçtır?
2. $x^2 + xy + y^2 = 7$ için $y′$'yü bul.
3. $sin(x + y) = y$ için $y′$ nedir?
**Cevaplar**
1. $y′ = −x/y = 3/4$.
2. $2x + y + xy′ + 2yy′ = 0$, dolayısıyla $y′ = −(2x + y)/(x + 2y)$.
3. $cos(x + y)(1 + y′) = y′$, dolayısıyla $y′ = cos(x + y)/(1 − cos(x + y))$.`,formul:`Görüntüdeki sonuç $y′ = −x/y$: $x^2 + y^2 = 25$ çemberinin her noktasındaki teğet eğimi.
1. $x^2 + y^2 = 25$: merkezi orijinde, yarıçapı $5$ olan çember.
2. Türetince $2x + 2y · y′ = 0$ çıkar; $2y · y′$ terimi zincir kuralından gelir.
3. $−x/y$: eğim noktaya bağlıdır. $y = 0$ olan $(±5, 0)$ noktalarında teğet düşeydir, eğim tanımsızdır.
Geometrik anlam: yarıçapın eğimi $y/x$, teğetin eğimi $−x/y$; çarpımları $−1$, yani teğet yarıçapa diktir.`,coz:`Sayfadaki çember için $(3, 4)$ noktasındaki teğet:
1. Kapalı türev: $2x + 2y · y′ = 0$, dolayısıyla $y′ = −x/y$.
2. Noktada eğim: $y′ = −3/4$.
3. Nokta eğim biçimi: $y − 4 = −(3/4)(x − 3)$.
4. Düzenle: $y = −(3/4)x + 25/4$, ya da $3x + 4y = 25$.
Sağlama: $(3, 4)$ yerine konunca $9 + 16 = 25$; teğet noktadan geçiyor.`,adim:`Adım adım, $x^3 + y^3 = 6xy$ için $y′$:
1. Sol tarafı türet: $(x^3)′ = 3x^2$, $(y^3)′ = 3y^2 y′$. Gerekçe: $y$ terimi zincir kuralıyla türetilir.
2. Sağ tarafı türet: $(6xy)′ = 6y + 6xy′$. Gerekçe: $x$ ile $y$ çarpımı, çarpım kuralı.
3. Eşitle: $3x^2 + 3y^2 y′ = 6y + 6xy′$.
4. $y′$ içeren terimleri sola, diğerlerini sağa topla: $y′(3y^2 − 6x) = 6y − 3x^2$.
5. Böl ve sadeleştir: $y′ = (2y − x^2)/(y^2 − 2x)$.
Payda sıfır olduğu noktalarda teğet düşeydir.`,"ozetle-gorsel":`Bu bölgede üç şey var:
- Bir eğri: $x^2 + y^2 = 25$ çemberi ve bir noktadaki teğet doğrusu.
- Bir yöntem: iki taraf $x$'e göre türetilir, $y$ terimlerine $y′$ eklenir.
- Bir sonuç: $y′ = −x/y$; teğet her noktada yarıçapa diktir.
Kısaca bölge, $y$'yi yalnız bırakmadan eğim bulmayı gösteriyor.`},difdenk:{acikla:`Ayrılabilir diferansiyel denklemde $y$'li terimler bir tarafa, $x$'li terimler öbür tarafa toplanabilir.
1. $y′ = 2y$ yerine $dy/dx = 2y$ yaz.
2. Değişkenleri ayır: $dy/y = 2dx$.
3. İki tarafın integralini al: $ln|y| = 2x + c$.
4. Üstel al: $y = Ce^{2x}$; burada $C = ±e^c$.
5. Başlangıç koşulu sabiti belirler: $y(0) = 3$ ise $C = 3$, yani $y = 3e^{2x}$.
Anlamı: değişim hızı o anki miktarla orantılı. Nüfus, bileşik faiz ve bakteri üremesi bu kalıba uyar.`,ozetle:`Üç satırda özet:
- $y′ = ky$ biçimindeki denklem değişkenlerine ayrılarak çözülür: $dy/y = k dx$.
- Genel çözüm $y = Ce^{kx}$; $C$ başlangıç koşulundan bulunur.
- Sayfadaki örnekte $y′ = 2y$, $y(0) = 3$ için $y = 3e^{2x}$; sağlama $y′ = 6e^{2x} = 2y$.`,basitlestir:`Bir bankadaki parayı düşün: faiz, o an hesapta ne kadar para varsa ona göre işler. Para çoğaldıkça artış da hızlanır.
$y′ = 2y$ tam bunu söyler: artış hızı, o anki miktarın iki katı.
Böyle büyüyen her şeyin formülü üsteldir: $y = Ce^{2x}$. $C$ başlangıçtaki miktardır; $y(0) = 3$ ise $y = 3e^{2x}$.`,ornek:`Somut örnek: radyoaktif bozunma. Madde miktarı $y$, azalma hızı miktarla orantılı: $y′ = −0,1y$, başta $y(0) = 50$ g.
1. Ayır: $dy/y = −0,1dt$.
2. İntegral: $ln|y| = −0,1t + c$, yani $y = Ce^{−0,1t}$.
3. Koşul: $C = 50$, yani $y = 50e^{−0,1t}$.
4. Yarı ömür: $50e^{−0,1t} = 25$ ise $t = ln 2/0,1 ≈ 6,93$.
Aynı denklem, işareti değişince büyümeyi de anlatır.`,"soru-uret":`Kendini sınamak için üç soru:
1. $y′ = 3y$, $y(0) = 2$ denklemini çöz.
2. $y′ = xy$ denkleminin genel çözümünü bul.
3. $y = 3e^{2x}$ fonksiyonunun $y′ = 2y$ denklemini sağladığını göster.
**Cevaplar**
1. $y = 2e^{3x}$.
2. $dy/y = xdx$, $ln|y| = x²/2 + c$, yani $y = Ce^{x²/2}$.
3. $y′ = 6e^{2x} = 2 · 3e^{2x} = 2y$.`,formul:`Görüntüdeki sonuç $y = 3e^{2x}$, $y′ = 2y$ denkleminin çözümü.
1. $e^{2x}$: türevi kendisinin $2$ katı olan fonksiyon; denklemin istediği tam budur.
2. $3$: başlangıç değeri, $x = 0$ iken $y = 3$.
3. Üs içindeki $2$: büyüme oranı. Büyüdükçe eğri daha hızlı diklesir.
Sağlama: $y′ = 6e^{2x} = 2y$.`,coz:`Örnek: $y′ = 2y$, $y(0) = 3$.
1. Ayır: $dy/y = 2dx$.
2. İntegral: $ln|y| = 2x + c$.
3. Üstel: $y = Ce^{2x}$.
4. Koşul: $y(0) = C = 3$.
Sonuç: $y = 3e^{2x}$. Sağlama: $y′ = 6e^{2x} = 2y$.`},statik:{acikla:`Problem 2.7, basit mesnetli bir kirişin denge problemidir. Kiriş $A$'da sabit mesnetle (iki tepki: $A_x$, $A_y$), $B$'de kayıcı mesnetle (bir tepki: $B_y$) taşınıyor.
1. Serbest cisim diyagramı: mesnetleri kaldır, yerlerine tepki kuvvetlerini çiz. Yükler: $C$'de $12$ kN ve $CB$ boyunca $4$ kN/m.
2. Yayılı yükü bileşkesiyle değiştir: $4 · 2 = 8$ kN, $CB$'nin ortasında, yani $A$'dan $4$ m uzakta.
3. Denge denklemlerini yaz: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM_A = 0$. Üç bilinmeyen, üç denklem.
4. $A$'ya göre moment almak $A_x$ ve $A_y$'yi denklemden düşürür; $B_y$ doğrudan bulunur.
Kesme kuvveti ve eğilme momenti, kirişi bir noktadan kesip sol parçanın dengesine bakarak yazılır.`,ozetle:`Üç satırda özet:
- $A$ sabit mesnet ($A_x$, $A_y$), $B$ kayıcı mesnet ($B_y$); yükler $12$ kN tekil ve $4$ kN/m yayılı.
- Dengeden $A_x = 0$, $A_y = 6,4$ kN, $B_y = 13,6$ kN.
- En büyük eğilme momenti $C$'de: $M_C = 19,2$ kN·m.`,basitlestir:`Kirişi iki kişinin omzunda taşıdığı bir tahta gibi düşün. $A$ ve $B$ iki taşıyıcı, yükler de tahtanın üstüne konan ağırlıklar.
Ağırlık hangi uca yakınsa o uçtaki kişi daha çok taşır. Burada yüklerin çoğu $B$'ye yakın, bu yüzden $B_y = 13,6$ kN, $A_y = 6,4$ kN.
Toplam yük $12 + 8 = 20$ kN; iki taşıyıcının payları toplamı da $20$ kN eder.
Moment, tahtayı döndürme etkisidir: kuvvet çarpı uzaklık. Tahta dönmüyorsa iki yöne döndürme etkileri birbirini götürür.`,coz:`Problem 2.7: $AC = 3$ m, $CB = 2$ m.
1. Yatay yük yok: $A_x = 0$.
2. Yayılı yükün bileşkesi $4 · 2 = 8$ kN, $A$'dan $4$ m uzakta.
3. $ΣM_A = 0$: $B_y · 5 − 12 · 3 − 8 · 4 = 0$, buradan $B_y = 68/5 = 13,6$ kN.
4. $ΣF_y = 0$: $A_y = 12 + 8 − 13,6 = 6,4$ kN.
5. Sağlama, $B$'ye göre moment: $6,4 · 5 − 12 · 2 − 8 · 1 = 32 − 24 − 8 = 0$.
Kesme kuvveti $AC$ boyunca $6,4$ kN; $C$'de $12$ kN düşüp $−5,6$ kN olur, $B$'de $−13,6$ kN'a iner. Moment en büyük değerini kesmenin işaret değiştirdiği $C$'de alır: $M_C = 6,4 · 3 = 19,2$ kN·m.`,adim:`Adım adım kesme ve moment; tepkiler $A_y = 6,4$ kN, $B_y = 13,6$ kN:
1. $0 < x < 3$ ($A$ ile $C$ arası): kesitin solunda yalnız $A_y$ var. $V = 6,4$ kN, $M = 6,4x$. Gerekçe: sol parçanın dengesi.
2. $C$'de tekil yük: kesme $12$ kN birden düşer, $V = −5,6$ kN. Moment sürekli kalır: $M_C = 19,2$ kN·m.
3. $3 < x < 5$ ($C$ ile $B$ arası): $V = −5,6 − 4(x − 3)$, $M = 6,4x − 12(x − 3) − 2(x − 3)^2$. Gerekçe: yayılı yük kesmeyi doğrusal, momenti parabolik değiştirir.
4. $x = 5$'te $M = 32 − 24 − 8 = 0$. Kayıcı mesnette moment sıfır olmalı; sağlama tamam.
Kural: $dM/dx = V$. Kesmenin sıfırdan geçtiği yer momentin tepe noktasıdır, burada $C$.`,formul:`Kiriş problemlerindeki temel ifadeler denge denklemleridir:
1. $ΣF_x = 0$ ve $ΣF_y = 0$: kiriş ötelenmiyor, kuvvetlerin toplamı sıfır.
2. $ΣM_A = 0$: kiriş dönmüyor; bir noktaya göre momentlerin toplamı sıfır. Moment, kuvvet çarpı dik uzaklıktır, birimi kN·m.
3. Yayılı yükün bileşkesi $W = q · L$; yük alanının ağırlık merkezine etkir. Burada $W = 4 · 2 = 8$ kN.
4. Kesit büyüklükleri arasında $dV/dx = −q$ ve $dM/dx = V$ bağıntıları vardır.
İşaret kuralını baştan seç ve sonuna kadar değiştirme.`,"soru-uret":`Kendini sınamak için üç soru:
1. Sabit mesnet ve kayıcı mesnet kaçar tepki bileşeni verir?
2. $6$ m açıklıklı basit kirişin ortasına $10$ kN tekil yük konuyor. Mesnet tepkileri ve en büyük moment nedir?
3. $3$ kN/m'lik yayılı yük $4$ m boyunca etkiyor. Bileşkesi ne kadardır ve nereye etkir?
**Cevaplar**
1. Sabit mesnet iki ($A_x$, $A_y$), kayıcı mesnet bir ($B_y$).
2. Simetriden $A_y = B_y = 5$ kN; $M_{maks} = 5 · 3 = 15$ kN·m, kirişin ortasında.
3. $W = 3 · 4 = 12$ kN, yüklü bölgenin ortasında.`,"ozetle-gorsel":`Bu bölgede üç şey var:
- Bir kiriş: $A$'da sabit, $B$'de kayıcı mesnet; açıklıklar $3$ m ve $2$ m.
- Yükler: $C$'de $12$ kN tekil, $CB$ boyunca $4$ kN/m yayılı.
- İstenenler: serbest cisim diyagramı, mesnet tepkileri, kesme ve moment diyagramları.
Kısaca bölge, bir kirişin dengesini adım adım kurmayı istiyor.`},anatomi:{acikla:`Brakiyal pleksus (plexus brachialis), üst ekstremitenin motor ve duyu sinirlerini veren sinir ağıdır.
1. Kökler: C5, C6, C7, C8 ve T1 spinal sinirlerinin ön dalları.
2. Gövdeler: üst (C5, C6), orta (C7) ve alt (C8, T1).
3. Bölümler: her gövde ön ve arka bölüme ayrılır; ön bölümler fleksör, arka bölümler ekstansör kaslara gider.
4. Kordlar: lateral, posterior ve medial; adlarını a. axillaris'e göre konumlarından alırlar.
5. Uç dallar: lateral korddan n. musculocutaneus, posterior korddan n. axillaris ve n. radialis, medial korddan n. ulnaris; n. medianus lateral ve medial korddan birer kökle oluşur.
Ezber için sayılar: 5 kök, 3 gövde, 6 bölüm, 3 kord, 5 uç dal.`,ozetle:`Üç satırda özet:
- Pleksus C5 ile T1 ön dallarından kurulur: kök, gövde, bölüm, kord, uç dal.
- Beş uç dal: musculocutaneus, axillaris, radialis, medianus ve ulnaris.
- Klinikte üst gövde hasarı Erb felcine (C5, C6), alt gövde hasarı Klumpke felcine (C8, T1) yol açar.`,basitlestir:`Pleksusu bir şehrin elektrik dağıtım merkezi gibi düşün. Omurilikten beş kablo gelir (C5 ile T1 arası), merkezde birleşip karışır ve kola beş ana hat olarak çıkar.
Karışmanın faydası: bir kök zarar görse bile hiçbir kas tamamen elektriksiz kalmaz, çünkü çoğu sinir birden fazla kökten lif taşır.
Beş ana hattın kabaca işleri:
- Musculocutaneus: kolun ön yüzü, dirseği büker.
- Axillaris: kolu yana kaldıran deltoid.
- Radialis: kolun ve önkolun arka yüzü; el bileğini ve parmakları açar.
- Medianus: önkolun ön yüzünün çoğu ve başparmak kasları.
- Ulnaris: elin küçük kaslarının çoğu, ince parmak hareketleri.`,ornek:`Klinik örnek: humerus cisminin ortasından kırık.
1. N. radialis, humerusun arkasındaki sulcus nervi radialis içinde kemiğe yakın seyreder; kırıkta kolayca zedelenir.
2. Sonuç: el bileği ve parmak ekstansörleri çalışmaz, el bileği düşer (wrist drop). El sırtında, başparmakla işaret parmağı arasında duyu kaybı olur.
3. Triceps çoğunlukla korunur, çünkü dalları sinir oluğa girmeden önce ayrılır.
Aynı mantıkla collum chirurgicum humeri kırığı n. axillaris'i, medial epikondil travması n. ulnaris'i tehlikeye atar.`,adim:`Pleksusu kâğıda adım adım çiz:
1. Solda alt alta beş kök yaz: C5, C6, C7, C8, T1.
2. C5 ile C6'yı birleştir (üst gövde), C7'yi düz devam ettir (orta gövde), C8 ile T1'i birleştir (alt gövde).
3. Her gövdeyi ikiye ayır: ön bölüm ve arka bölüm.
4. Üç arka bölümü birleştir: posterior kord. Üst ve orta gövdenin ön bölümleri lateral kordu, alt gövdenin ön bölümü medial kordu yapar.
5. Dalları ekle: lateral korddan musculocutaneus, posterior korddan axillaris ve radialis, medial korddan ulnaris. Lateral ve medial korddan birer kök alıp ortada bir M çiz: medianus.
Ortadaki M şekli, kadavrada ve görüntülemede pleksusu tanımanın en kolay işaretidir.`,"soru-uret":`Kendini sınamak için üç soru:
1. Hangi kord a. axillaris'in arkasında yer alır ve hangi uç dalları verir?
2. Zor doğum sonrası bebeğin kolu iç rotasyonda, önkolu ekstansiyon ve pronasyonda duruyor. Hangi kökler etkilenmiştir?
3. Karpal tünel sendromunda hangi sinir sıkışır ve ilk hangi bulgular görülür?
**Cevaplar**
1. Posterior kord; n. axillaris ve n. radialis.
2. C5 ve C6, yani üst gövde: Erb-Duchenne felci (garson bahşiş eli).
3. N. medianus; başparmak, işaret, orta parmak ve yüzük parmağının yarısında uyuşma, ileride thenar kaslarda zayıflık ve erime.`},logturev:{acikla:`Logaritmik türev, çarpım, bölüm ve kuvvetlerle dolu bir fonksiyonu türetmeden önce sadeleştirmenin yoludur.
1. İki tarafın doğal logaritmasını al: $ln y = ln f(x)$.
2. Logaritmanın özellikleriyle çarpımı toplamaya, bölümü farka, kuvveti katsayıya çevir: $ln(ab) = ln a + ln b$, $ln(a/b) = ln a − ln b$, $ln a^n = n ln a$.
3. $x$'e göre kapalı türev al: sol taraf $y′/y$ olur.
4. $y$ ile çarp: $y′ = y · (...)$.
Taban da üs de değişkense ($x^x$ gibi) bu yol zorunludur; ne kuvvet kuralı ne üstel kural tek başına işler.`,ozetle:`Üç satırda özet:
- İki tarafın logaritması alınır, çarpım ve bölüm toplamaya çevrilir.
- Kapalı türevle $y′/y$ bulunur, sonra $y$ ile çarpılır.
- Örnek: $y = x^x$ için $ln y = x ln x$, buradan $y′ = x^x(ln x + 1)$.`,basitlestir:`Çarpımın türevi zahmetli, toplamın türevi kolaydır. Logaritma, çarpımı toplamaya çeviren bir makine gibidir.
Bu yüzden önce $ln$ alırsın: çarpımlar toplamaya, bölümler çıkarmaya, kuvvetler önlerindeki sayıya döner. Sonra her terimi ayrı ayrı türetirsin.
Sonda bir şeyi unutma: $ln y$'nin türevi $y′/y$ olduğu için cevabı $y$ ile çarparsın.`,ornek:`Örnek: $x > 0$ için $y = x^x$.
1. Logaritma al: $ln y = x ln x$.
2. Türet: solda $y′/y$, sağda çarpım kuralıyla $ln x + x · (1/x) = ln x + 1$.
3. $y$ ile çarp: $y′ = x^x(ln x + 1)$.
Sağlama: $x = 1$ için $y′ = 1$; $x^x$ eğrisinin $(1, 1)$ noktasındaki eğimi gerçekten $1$'dir.`,coz:`Sayfadaki Örnek 3: $y = x^{3/4} √(x^2 + 1)/(3x + 2)^5$.
1. Logaritma al: $ln y = (3/4)ln x + (1/2)ln(x^2 + 1) − 5ln(3x + 2)$.
2. Türet: $y′/y = 3/(4x) + x/(x^2 + 1) − 15/(3x + 2)$.
3. $y$ ile çarp: $y′ = y · (3/(4x) + x/(x^2 + 1) − 15/(3x + 2))$, burada $y$ baştaki ifadedir.
Her terim tek tek türetildi; bölüm kuralıyla aynı sonuca varmak çok daha uzun sürerdi.`,adim:`Adım adım, alıştırmalardan $y = x^{sin x}$ ile:
1. Logaritma al: $ln y = sin x · ln x$. Gerekçe: $ln a^b = b ln a$, üs öne iner.
2. Sağ tarafı çarpım kuralıyla türet: $cos x · ln x + sin x · (1/x)$.
3. Sol taraf: $(ln y)′ = y′/y$. Gerekçe: zincir kuralı.
4. $y$ ile çarp: $y′ = x^{sin x}(cos x · ln x + sin x/x)$.
Taban da üs de değişkenken tek temiz yol budur.`,formul:`Görüntüdeki zincir: $ln y = x ln x$, sonra $y′/y = ln x + 1$, sonra $y′ = x^x(ln x + 1)$.
1. $ln y = x ln x$: logaritma üssü öne indirir; artık çarpım kuralı yeterli.
2. $y′/y$: $ln y$'nin $x$'e göre türevi, zincir kuralından gelir.
3. $ln x + 1$: $x ln x$'in türevi, çarpım kuralıyla $1 · ln x + x · (1/x)$.
4. Son adımda iki taraf $y = x^x$ ile çarpılır.`,"soru-uret":`Kendini sınamak için üç soru:
1. $y = x^{√x}$ için $y′$ nedir?
2. $y = (x^2 + 1)^3(x − 2)^4$ fonksiyonunun türevini logaritmik türevle bul.
3. Logaritmik türev hangi durumda zorunludur?
**Cevaplar**
1. $ln y = √x ln x$, $y′/y = (ln x + 2)/(2√x)$, yani $y′ = x^{√x}(ln x + 2)/(2√x)$.
2. $y′ = (x^2 + 1)^3(x − 2)^4 · (6x/(x^2 + 1) + 4/(x − 2))$.
3. Taban da üs de değişkense; örneğin $x^x$ ya da $x^{sin x}$.`,"ozetle-gorsel":`Bu bölgede üç şey var:
- Yöntem: iki tarafın logaritması, sadeleştirme, kapalı türev, $y$ ile çarpma.
- Örnek 3: çarpım ve bölümlü bir ifade, logaritmayla üç terimlik bir toplama dönüşüyor.
- Örnek 4: $y = x^x$ için $y′ = x^x(ln x + 1)$.
Kısaca bölge, karmaşık ifadeleri türetmeden önce logaritmayla sadeleştirmeyi gösteriyor.`},statik26:{acikla:`Basit mesnetli kirişin bir ucu sabit mesnede (pim), öbür ucu kayıcı mesnede oturur. Sabit mesnet iki tepki ($A_x$, $A_y$), kayıcı mesnet bir tepki ($B_y$) verir.
1. Üç bilinmeyene karşı düzlemde üç denge denklemi var: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM = 0$. Bu yüzden kiriş izostatiktir, yalnız statikle çözülür.
2. Yayılı yük bileşkesiyle değiştirilir: Örnek 2.6'da $4 · 6 = 24$ kN, açıklığın ortasında, $A$'dan $3$ m uzakta.
3. $A$'ya göre moment almak $A_x$ ve $A_y$'yi denklemden düşürür, $B_y$ doğrudan bulunur.
Sonuç: $A_x = 0$, $B_y = 18$ kN, $A_y = 24$ kN.`,ozetle:`Üç satırda özet:
- Basit mesnetli kirişte sabit mesnet $A_x$ ve $A_y$, kayıcı mesnet $B_y$ verir; kiriş izostatiktir.
- Yayılı yük bileşkesiyle değiştirilir: $W = w · L$, yüklü bölgenin ortasında.
- Örnek 2.6: $A_x = 0$, $A_y = 24$ kN, $B_y = 18$ kN.`,basitlestir:`Kirişi iki kişinin omzunda taşıdığı bir tahta gibi düşün: $A$ ve $B$ iki taşıyıcı.
Toplam yük $18 + 24 = 42$ kN. Yayılı yük iki uca eşit dağılır, ama $18$ kN'luk tekil yük $A$'ya daha yakın ($2$ m). Bu yüzden $A$ daha çok taşır: $A_y = 24$ kN, $B_y = 18$ kN.
Moment, tahtayı döndürme etkisidir: kuvvet çarpı uzaklık. Tahta dönmüyorsa iki yöndeki döndürme etkileri birbirini götürür.`,coz:`Örnek 2.6: $AB = 6$ m, tüm açıklıkta $w = 4$ kN/m, $A$'dan $2$ m uzaktaki $C$'de $P = 18$ kN.
1. Yatay yük yok: $A_x = 0$.
2. Yayılı yükün bileşkesi $4 · 6 = 24$ kN, $A$'dan $3$ m uzakta.
3. $ΣM_A = 0$: $6B_y − 18 · 2 − 24 · 3 = 0$, buradan $B_y = 108/6 = 18$ kN.
4. $ΣF_y = 0$: $A_y = 18 + 24 − 18 = 24$ kN.
5. Sağlama, $B$'ye göre moment: $24 · 6 − 18 · 4 − 24 · 3 = 144 − 72 − 72 = 0$.`,adim:`Adım adım mesnet tepkileri:
1. Serbest cisim diyagramı: mesnetleri kaldır, yerlerine $A_x$, $A_y$, $B_y$ çiz. Gerekçe: dengede olan, dış kuvvetlerin toplamıdır.
2. Yayılı yükü $24$ kN'luk tek kuvvete çevir ve $x = 3$ m'ye koy. Gerekçe: bileşke, yük alanının ağırlık merkezine etkir.
3. $ΣM_A = 0$: $6B_y = 18 · 2 + 24 · 3 = 108$, yani $B_y = 18$ kN. Gerekçe: $A$'daki bilinmeyenlerin $A$'ya göre momenti sıfır.
4. $ΣF_y = 0$: $A_y = 42 − 18 = 24$ kN.
5. $ΣF_x = 0$: $A_x = 0$.
Sağlama için $B$'ye göre moment al; sıfır çıkmalı.`,"ozetle-gorsel":`Bu bölgede üç şey var:
- Tanım: basit mesnetli kiriş, sabit mesnet iki, kayıcı mesnet bir tepki verir.
- Örnek 2.6: $6$ m kiriş, tüm açıklıkta $4$ kN/m ve $C$'de $18$ kN.
- Çözüm: $ΣM_A = 0$ ile $B_y = 18$ kN, $ΣF_y = 0$ ile $A_y = 24$ kN.
Kısaca bölge, serbest cisim diyagramından tepkilere giden yolu gösteriyor.`},statikVM:{acikla:`Kesme kuvveti $V$ ve eğilme momenti $M$, kirişi bir noktadan kesip bir yandaki parçanın dengesine bakarak bulunur.
1. Yükle bağıntı: $dV/dx = −w(x)$. Yayılı yük varken $V$ doğrusal azalır, yük yoksa sabit kalır.
2. Kesmeyle bağıntı: $dM/dx = V(x)$. $V$ pozitifken $M$ artar, negatifken azalır.
3. Tekil yükün altında $V$ yük kadar sıçrar; $M$ orada kırılır ama sürekli kalır.
4. $M$ en büyük değerini $V$'nin işaret değiştirdiği yerde alır.
Örnek 2.6'da $V$, $C$'de $+16$'dan $−2$'ye atlar; $M_{maks} = 24 · 2 − 2 · 2^2 = 40$ kN·m.`,ozetle:`Üç satırda özet:
- Kesit yöntemi: $V$ ve $M$, kesitin bir yanındaki parçanın dengesinden bulunur.
- $dV/dx = −w$ ve $dM/dx = V$; tekil yükün altında $V$ sıçrar.
- Örnek 2.6'da $V$, $C$'de $+16$'dan $−2$'ye atlar ve $M_{maks} = 40$ kN·m olur.`,basitlestir:`Kesme kuvveti, kirişi bir noktadan kesince iki parçayı birbirine göre aşağı yukarı kaydırmaya çalışan kuvvettir. Moment ise o noktada kirişi bükmeye çalışan etkidir.
İkisi birbirine bağlı: moment grafiğinin eğimi kesme kuvvetidir. Kesme sıfırdan geçince moment tepe yapar; havaya atılan topun hızı sıfır olduğu anda en yüksekte olması gibi.
Örnek 2.6'da bu an $C$ noktası: $M_{maks} = 40$ kN·m.`,coz:`Örnek 2.6 (devam): $A_y = 24$ kN, $B_y = 18$ kN.
1. $0 ≤ x < 2$: $V = 24 − 4x$, $M = 24x − 2x^2$.
2. $C$'deki $18$ kN: $V$, $24 − 8 = 16$'dan $16 − 18 = −2$'ye atlar.
3. $2 < x ≤ 6$: $V = 6 − 4x$, $M = 36 + 6x − 2x^2$.
4. Uçlar: $M(0) = 0$ ve $M(6) = 36 + 36 − 72 = 0$. Mesnetlerde moment sıfır; sağlama tamam.
5. En büyük moment $V$'nin işaret değiştirdiği $x = 2$'de: $M_{maks} = 40$ kN·m.`,adim:`Adım adım kesit yöntemi (Örnek 2.6):
1. $x$ noktasından kes, sol parçayı al. Gerekçe: sol parçada daha az kuvvet var.
2. $0 ≤ x < 2$: solda $A_y = 24$ kN ve $4x$ kN yayılı yük. $ΣF_y = 0$ ile $V = 24 − 4x$.
3. Kesite göre moment: $M = 24x − 4x · (x/2) = 24x − 2x^2$. Gerekçe: yayılı yükün bileşkesi parçanın ortasında.
4. $x > 2$: $18$ kN da sola girer. $V = 6 − 4x$, $M = 24x − 2x^2 − 18(x − 2) = 36 + 6x − 2x^2$.
5. Sağlama: $dM/dx = 6 − 4x = V$. Bağıntı tutuyor.`,formul:`Görüntüdeki bağıntılar: $dV/dx = −w(x)$ ve $dM/dx = V(x)$.
1. $w(x)$: birim uzunluktaki yayılı yük, aşağı doğru pozitif.
2. $dV/dx = −w$: $V$ diyagramının eğimi yükün eksi işaretlisidir. Yük yoksa $V$ yataydır.
3. $dM/dx = V$: $M$ diyagramının eğimi kesme kuvvetidir. $V = 0$ olan yerde $M$ tepe yapar.
4. İntegral biçimi: iki kesit arasındaki $M$ farkı, aradaki $V$ diyagramının alanına eşittir.`,"soru-uret":`Kendini sınamak için üç soru:
1. Yayılı yük olmayan bir aralıkta $V$ ve $M$ diyagramları nasıl görünür?
2. Bir aralıkta $V(x) = 10 − 2x$ ise $M$ hangi $x$ değerinde en büyük olur?
3. $5$ m'lik basit kirişin ortasına $20$ kN konursa en büyük moment nedir?
**Cevaplar**
1. $V$ sabit, $M$ doğrusal.
2. $V = 0$ olan yerde: $x = 5$.
3. Tepkiler $10$'ar kN; $M_{maks} = 10 · 2,5 = 25$ kN·m, ortada.`},anatomiKas:{acikla:`Kol iki bölmeye ayrılır ve her bölmenin kendi siniri vardır; tabloyu akılda tutmanın anahtarı budur.
1. Ön (fleksör) bölme: m. biceps brachii, m. brachialis, m. coracobrachialis. Üçünü de n. musculocutaneus innerve eder.
2. Arka (ekstansör) bölme: m. triceps brachii ve m. anconeus. İnnervasyonları n. radialis.
3. Biceps hem önkolu büker hem de en güçlü supinatördür; supinasyon gücü dirsek bükülüyken en fazladır.
4. Brachialis önkol hangi pozisyonda olursa olsun dirseği büker; asıl fleksör odur.
5. Triceps'in uzun başı omuz eklemini de geçer; bu yüzden kolu ekstansiyon ve addüksiyona da getirir.`,ozetle:`Üç satırda özet:
- Ön bölme (biceps, brachialis, coracobrachialis): n. musculocutaneus.
- Arka bölme (triceps, anconeus): n. radialis.
- Biceps en güçlü supinatör, brachialis asıl dirsek fleksörü; humerus cisim kırığında n. radialis zedelenip el bileği düşer.`,basitlestir:`Kolu önde bükücüler, arkada açıcılar diye düşün.
Öndekiler dirseği büker; üçünün de siniri aynı: musculocutaneus. Arkadaki triceps dirseği açar; siniri radialis.
Biceps ayrıca avucu yukarı çevirir (supinasyon). Kavanoz kapağı açarken ya da sağ elle vida sıkarken çalışan güçlü kas odur.`,ornek:`Gündelik örnek: sağ elle tornavidayla vida sıkmak bir supinasyon hareketidir.
1. Bu hareketin en güçlü kası m. biceps brachii'dir.
2. Biceps tuberositas radii'ye yapıştığı için radiusu kendi ekseninde döndürür.
3. Supinasyon gücü dirsek yaklaşık 90 derece bükülüyken en fazladır; vidayı kol düzken değil, bükülüyken sıkmak bu yüzden kolaydır.
Klinik karşılığı: humerus cisim kırığında n. radialis zedelenirse triceps çoğunlukla korunur ama el bileği ekstansörleri çalışmaz, el bileği düşer.`,"soru-uret":`Kendini sınamak için üç soru:
1. M. brachialis nereye sokulur ve fonksiyonu nedir?
2. M. biceps brachii'nin iki başı nereden başlar?
3. Humerus cisim kırığı sonrası hasta elini bilekten kaldıramıyor. Hangi sinir, nerede zedelenmiştir?
**Cevaplar**
1. Proc. coronoideus ve tuberositas ulnae; dirsekte önkolun asıl fleksörüdür.
2. Caput longum tuberculum supraglenoidale'den, caput breve proc. coracoideus'tan.
3. N. radialis, humerusun arkasındaki sulcus n. radialis içinde.`},anatomiFossa:{acikla:`Fossa cubitalis, dirseğin önündeki üçgen biçimli çukurdur.
1. Sınırlar: üstte iki epicondylus arasındaki çizgi, lateralde m. brachioradialis, medialde m. pronator teres.
2. Taban m. brachialis ve m. supinator; tavan fascia ve aponeurosis bicipitalis.
3. İçerik, lateralden mediale: m. biceps brachii tendonu, a. brachialis, n. medianus. Kısaltma: TAN (Tendon, Arter, Nerv).
4. N. radialis lateral kenarda, m. brachioradialis'in altında kalır.
Klinikte önemi: venöz kan buradaki yüzeyel venlerden alınır; tansiyon ölçerken stetoskop a. brachialis'in üstüne konur.`,ozetle:`Üç satırda özet:
- Dirseğin önündeki üçgen çukur; lateralde m. brachioradialis, medialde m. pronator teres sınırlar.
- İçerik lateralden mediale TAN: biceps tendonu, a. brachialis, n. medianus.
- Kan alma ve tansiyon ölçümü bu bölgede yapılır.`,basitlestir:`Dirseğin iç tarafındaki çukuru düşün. İki kas bir V çizer: dışta brachioradialis, içte pronator teres.
Çukurun içinde dıştan içe üç şey yan yana durur: biceps kirişi, atardamar ve sinir. Kısaca TAN.
Kan alınan damarlar bunların üstünde, derinin hemen altındadır.`,ornek:`Klinik örnek: dirsekten kan alma.
1. İğne yüzeyel venlere, çoğunlukla v. mediana cubiti'ye girer.
2. Aponeurosis bicipitalis bu venin altında uzanır ve a. brachialis ile n. medianus'u örter; derindeki yapıları korur.
3. İğne çok derine ve mediale giderse arter ya da n. medianus zedelenebilir.
Bu yüzden ven bulunamazsa iğneyi derine ve içe doğru aramak yerine başka bir damar seçilir.`,"soru-uret":`Kendini sınamak için üç soru:
1. Fossa cubitalis'in medial ve lateral sınırları hangi kaslardır?
2. İçeriğini lateralden mediale sırala.
3. Kan alırken derindeki arter ve siniri koruyan yapı hangisidir?
**Cevaplar**
1. Medialde m. pronator teres, lateralde m. brachioradialis.
2. M. biceps brachii tendonu, a. brachialis, n. medianus.
3. Aponeurosis bicipitalis.`},turev:{acikla:`Buradaki çekirdek fikir şu: türev, bir niceliğin anlık değişim hızıdır.
1. Önce iki nokta arasındaki ortalama değişimi yaz: $(f(x+h) − f(x))/h$.
2. Sonra aralığı küçült. $h → 0$ giderken bu oran bir sayıya yaklaşıyorsa o sayı $f′(x)$ olur.
3. Geometrik anlamı: $f′(x)$, grafiğe $x$ noktasında teğet olan doğrunun eğimidir.
Örneğin $f(x) = x^2$ için oran $2x + h$ çıkar; $h → 0$ iken $f′(x) = 2x$ bulunur.`,ozetle:`Üç satırda özet:
- Türev, fonksiyonun bir noktadaki anlık değişim hızıdır: $h → 0$ iken $f′(x) = lim (f(x+h) − f(x))/h$.
- Grafikte bu sayı teğet doğrunun eğimine eşittir.
- Çarpım, bölüm ve zincir kuralları her seferinde limite dönmeden türev almayı sağlar; örneğin $(x^3)′ = 3x^2$.`,basitlestir:`Bir arabanın hız göstergesini düşün. Bir saatte 60 km gittiysen ortalama hızın 60 km/sa olur, ama gösterge o anki hızı söyler. Türev o göstergedir.
Yol $s(t)$ ise anlık hız $s′(t)$ olur. Mesela $s(t) = 5t^2$ ise $s′(t) = 10t$; 3. saniyede hız $10 · 3 = 30$ m/sn.
Kısaca: ortalama hız iki an arasına, türev tek bir ana bakar.`,ornek:`Somut bir örnek: bir balonun yarıçapı $r$ iken hacmi $V = (4/3)πr^3$.
1. Hacmin yarıçapa göre türevi $dV/dr = 4πr^2$.
2. $r = 3$ cm iken bu değer $4π · 9 ≈ 113$ cm³/cm eder.
3. Yani yarıçap 3 cm iken 1 mm daha şişirmek hacmi yaklaşık $113 · 0,1 ≈ 11,3$ cm³ artırır.
Dikkat edersen $4πr^2$ kürenin yüzey alanı: hacim, yüzeye ince bir kat eklenerek büyüyor.`,"soru-uret":`Kendini sınamak için üç soru:
1. $f(x) = 3x^2 − 4x$ ise $f′(2)$ kaçtır?
2. $g(x) = sin(x^2)$ fonksiyonunun türevini bul.
3. $y = x^3$ eğrisine $x = 1$ noktasında çizilen teğetin denklemi nedir?
**Cevaplar**
1. $f′(x) = 6x − 4$, dolayısıyla $f′(2) = 8$.
2. $g′(x) = cos(x^2) · 2x$.
3. Eğim $3$, nokta $(1, 1)$; teğet $y = 3x − 2$.`,formul:`Görüntüdeki tanım: $f′(a) = lim (f(a+h) − f(a))/h$, $h → 0$ iken.
1. $f(a+h) − f(a)$: $h$ kadar ilerleyince fonksiyondaki değişim.
2. Bölü $h$: bu değişimin birim başına oranı, yani kiriş doğrusunun eğimi.
3. $h → 0$: kiriş, noktaya teğet olan doğruya döner.
Teğetin denklemi: $y = f(a) + f′(a)(x − a)$.`,coz:`Örnek: $f(x) = x^3 − 3x$ fonksiyonunun $x = 2$ noktasındaki teğeti.
1. Türev: $f′(x) = 3x^2 − 3$.
2. Eğim: $f′(2) = 12 − 3 = 9$.
3. Nokta: $f(2) = 8 − 6 = 2$, yani $(2, 2)$.
4. Teğet: $y − 2 = 9(x − 2)$, yani $y = 9x − 16$.`,adim:`Adım adım, tanımdan $f(x) = x^2$ için türev:
1. Fark oranını yaz: $(f(x+h) − f(x))/h = ((x+h)^2 − x^2)/h$. Gerekçe: türevin tanımı.
2. Aç: $(x^2 + 2xh + h^2 − x^2)/h = (2xh + h^2)/h$.
3. Sadeleştir: $2x + h$. Gerekçe: $h ≠ 0$ iken bölme serbest.
4. Limit: $h → 0$ iken $2x + h → 2x$.
Sonuç: $f′(x) = 2x$.`,"ozetle-gorsel":`Bu bölgede üç şey var:
- Bir tanım: fonksiyonun bir noktadaki türevi, $f′(a) = lim (f(a+h) − f(a))/h$.
- Bir şekil: eğriye $a$ noktasında teğet olan doğru.
- Bir sonuç: teğetin denklemi $y = f(a) + f′(a)(x − a)$.
Kısaca bölge, türevin geometrik anlamını özetliyor.`}},Ie={zincir:{acikla:`The chain rule takes the derivative of a nested (composite) function one layer at a time.
1. Split the function into two layers: an outer function $f$ and an inner function $g$, so $F(x) = f(g(x))$.
2. Take the derivative of the outer function but leave the inside alone: $f′(g(x))$.
3. Multiply by the derivative of the inner function: $F′(x) = f′(g(x)) · g′(x)$.
Why a product? When $x$ changes a little, $u = g(x)$ changes $g′(x)$ times as much; when $u$ changes, $y$ changes $f′(u)$ times as much. Two magnifications in a row multiply.
In Leibniz notation, $dy/dx = (dy/du) · (du/dx)$; thinking of the $du$ terms as canceling helps you remember the rule.`,ozetle:`Summary in three lines:
- If $F(x) = f(g(x))$ is a composite function, then $F′(x) = f′(g(x)) · g′(x)$.
- In short: the outer derivative (inside unchanged) times the inner derivative.
- For example, for $y = (3x^2 + 1)^5$, $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.`,basitlestir:`Think of the chain rule as interlocking gears: gear $x$ turns gear $u$, and gear $u$ turns gear $y$.
If $u$ turns 3 times for each turn of $x$, and $y$ turns 2 times for each turn of $u$, then $y$ turns $3 · 2 = 6$ times for each turn of $x$.
Derivatives are these "how many times" ratios: $dy/dx = (dy/du) · (du/dx)$.
Practical rule: first take the derivative of the outermost operation without touching the inside, then multiply by the derivative of the inside expression.`,ornek:`A concrete example: $y = (3x^2 + 1)^5$.
1. Inner function $u = 3x^2 + 1$, outer function $y = u^5$.
2. Outer derivative: $dy/du = 5u^4 = 5(3x^2 + 1)^4$.
3. Inner derivative: $du/dx = 6x$.
4. Multiply: $y′ = 5(3x^2 + 1)^4 · 6x = 30x(3x^2 + 1)^4$.
Check: at $x = 0$ you get $y′ = 0$. Indeed, $3x^2 + 1$ has its smallest value at $x = 0$, and the tangent is horizontal there.`,"soru-uret":`Three questions to test yourself:
1. If $y = sin(4x)$, what is $y′$?
2. Find the derivative of $y = ln(cos x)$.
3. What is $y′$ for $y = tan^2(3x)$? Hint: the chain rule is applied twice.
**Answers**
1. $y′ = cos(4x) · 4 = 4cos(4x)$.
2. $y′ = (1/cos x) · (−sin x) = −tan x$.
3. $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.`,formul:`The expression in the image is the chain rule: $F′(x) = f′(g(x)) · g′(x)$.
1. $F = f ∘ g$: the composite function that applies $g$ first, then $f$.
2. $g′(x)$: the rate of change of the inner function at $x$.
3. $f′(g(x))$: the derivative of the outer function, evaluated at $g(x)$, not at $x$. The most common mistake is writing $f′(x)$ here.
4. Leibniz form: if $u = g(x)$, then $dy/dx = (dy/du) · (du/dx)$.
Condition: $g$ must be differentiable at $x$, and $f$ must be differentiable at $g(x)$.`,coz:`Example 1 on the page: $y = (3x^2 + 1)^5$.
1. Separate the layers: $u = 3x^2 + 1$ and $y = u^5$.
2. Outer derivative: $dy/du = 5u^4$.
3. Inner derivative: $du/dx = 6x$.
4. Chain rule: $dy/dx = 5u^4 · 6x = 30x(3x^2 + 1)^4$.
Result: $y′ = 30x(3x^2 + 1)^4$.`,adim:`Step by step, with $y = tan^2(3x)$ from the exercises on the page:
1. Separate the layers: $y = u^2$, $u = tan v$, $v = 3x$. Reason: there are three nested operations, and each one brings a factor.
2. Outermost layer: $dy/du = 2u = 2tan(3x)$. Reason: the power rule, with the inside unchanged.
3. Middle layer: $du/dv = sec^2 v = sec^2(3x)$. Reason: $(tan v)′ = sec^2 v$.
4. Inner layer: $dv/dx = 3$.
5. Multiply: $y′ = 2tan(3x) · sec^2(3x) · 3 = 6tan(3x)sec^2(3x)$.
The number of factors should equal the number of layers; if one is missing, a layer was forgotten.`,"ozetle-gorsel":`This area has three parts:
- Theorem: if $F = f ∘ g$, then $F′(x) = f′(g(x)) · g′(x)$.
- Leibniz form: $dy/dx = (dy/du) · (du/dx)$.
- Example 1: for $y = (3x^2 + 1)^5$, $y′ = 30x(3x^2 + 1)^4$.
In short, the area sums up the derivative of a composite function as "outer derivative times inner derivative".`},kapali:{acikla:`Implicit differentiation is how you take derivatives in equations where you can't isolate $y$ in terms of $x$.
1. Differentiate both sides of the equation with respect to $x$.
2. The chain rule applies to every term with $y$: since $y$ is a function of $x$, $(y^2)′ = 2y · y′$.
3. Gather the terms with $y′$ on one side and solve for $y′$.
Example: if $x^2 + y^2 = 25$, then $2x + 2y · y′ = 0$, so $y′ = −x/y$.
The result depends on both $x$ and $y$; you need both coordinates of the point to find the slope.`,ozetle:`Summary in three lines:
- Implicit differentiation lets you differentiate equations of the form $F(x, y) = c$ without isolating $y$.
- Every term with $y$ is differentiated with the chain rule and gets a factor of $y′$.
- For the circle $x^2 + y^2 = 25$, $y′ = −x/y$; at $(3, 4)$ the slope of the tangent is $−3/4$.`,basitlestir:`Some curves can't be written as "$y = ...$"; a circle is one of them, because one $x$ value gives two $y$ values.
With implicit differentiation you don't try to isolate $y$. You differentiate the equation as it is, and add a $y′$ to the end of every $y$ term, because $y$ changes when $x$ changes.
Circle $x^2 + y^2 = 25$: differentiating gives $2x + 2y · y′ = 0$, so $y′ = −x/y$.
At the upper right point $(3, 4)$ the slope is $−3/4$: the curve is going down there, as expected.`,ornek:`Example: the tangent to the curve $x^3 + y^3 = 6xy$ (folium of Descartes) at $(3, 3)$.
1. Is the point on the curve: $27 + 27 = 54 = 6 · 3 · 3$. Yes.
2. Differentiate both sides: $3x^2 + 3y^2 y′ = 6y + 6xy′$. The product rule was used on the right.
3. Collect $y′$: $y′(3y^2 − 6x) = 6y − 3x^2$, so $y′ = (2y − x^2)/(y^2 − 2x)$.
4. At $(3, 3)$: $y′ = (6 − 9)/(9 − 6) = −1$.
5. Tangent: $y − 3 = −(x − 3)$, so $y = −x + 6$.`,"soru-uret":`Three questions to test yourself:
1. What is the slope of the tangent to the circle $x^2 + y^2 = 25$ at $(−3, 4)$?
2. Find $y′$ for $x^2 + xy + y^2 = 7$.
3. What is $y′$ for $sin(x + y) = y$?
**Answers**
1. $y′ = −x/y = 3/4$.
2. $2x + y + xy′ + 2yy′ = 0$, so $y′ = −(2x + y)/(x + 2y)$.
3. $cos(x + y)(1 + y′) = y′$, so $y′ = cos(x + y)/(1 − cos(x + y))$.`,formul:`The result in the image is $y′ = −x/y$: the slope of the tangent at every point of the circle $x^2 + y^2 = 25$.
1. $x^2 + y^2 = 25$: the circle centered at the origin with radius $5$.
2. Differentiating gives $2x + 2y · y′ = 0$; the $2y · y′$ term comes from the chain rule.
3. $−x/y$: the slope depends on the point. At $(±5, 0)$, where $y = 0$, the tangent is vertical and the slope is undefined.
Geometric meaning: the slope of the radius is $y/x$ and the slope of the tangent is $−x/y$; their product is $−1$, so the tangent is perpendicular to the radius.`,coz:`The tangent to the circle on the page at $(3, 4)$:
1. Implicit derivative: $2x + 2y · y′ = 0$, so $y′ = −x/y$.
2. Slope at the point: $y′ = −3/4$.
3. Point-slope form: $y − 4 = −(3/4)(x − 3)$.
4. Rearrange: $y = −(3/4)x + 25/4$, or $3x + 4y = 25$.
Check: plugging in $(3, 4)$ gives $9 + 16 = 25$; the tangent passes through the point.`,adim:`Step by step, $y′$ for $x^3 + y^3 = 6xy$:
1. Differentiate the left side: $(x^3)′ = 3x^2$, $(y^3)′ = 3y^2 y′$. Reason: the $y$ term is differentiated with the chain rule.
2. Differentiate the right side: $(6xy)′ = 6y + 6xy′$. Reason: a product of $x$ and $y$, so the product rule.
3. Set them equal: $3x^2 + 3y^2 y′ = 6y + 6xy′$.
4. Move the $y′$ terms to the left and the rest to the right: $y′(3y^2 − 6x) = 6y − 3x^2$.
5. Divide and simplify: $y′ = (2y − x^2)/(y^2 − 2x)$.
Where the denominator is zero, the tangent is vertical.`,"ozetle-gorsel":`This area has three things:
- A curve: the circle $x^2 + y^2 = 25$ and the tangent line at one point.
- A method: both sides are differentiated with respect to $x$, and $y′$ is added to the $y$ terms.
- A result: $y′ = −x/y$; the tangent is perpendicular to the radius at every point.
In short, the area shows how to find a slope without isolating $y$.`},difdenk:{acikla:`In a separable differential equation, the $y$ terms can be gathered on one side and the $x$ terms on the other.
1. Write $dy/dx = 2y$ instead of $y′ = 2y$.
2. Separate the variables: $dy/y = 2dx$.
3. Integrate both sides: $ln|y| = 2x + c$.
4. Exponentiate: $y = Ce^{2x}$, where $C = ±e^c$.
5. The initial condition fixes the constant: if $y(0) = 3$, then $C = 3$, so $y = 3e^{2x}$.
Meaning: the rate of change is proportional to the current amount. Population, compound interest and bacterial growth all fit this pattern.`,ozetle:`Summary in three lines:
- An equation of the form $y′ = ky$ is solved by separating the variables: $dy/y = k dx$.
- The general solution is $y = Ce^{kx}$; $C$ comes from the initial condition.
- In the example on the page, $y′ = 2y$ with $y(0) = 3$ gives $y = 3e^{2x}$; check: $y′ = 6e^{2x} = 2y$.`,basitlestir:`Think of money in a bank: interest is earned on whatever is in the account at that moment. As the money grows, the growth speeds up too.
$y′ = 2y$ says exactly this: the rate of growth is twice the current amount.
Anything that grows like this follows an exponential formula: $y = Ce^{2x}$. $C$ is the starting amount; if $y(0) = 3$, then $y = 3e^{2x}$.`,ornek:`A concrete example: radioactive decay. The amount of substance is $y$, and it decreases at a rate proportional to the amount: $y′ = −0.1y$, starting at $y(0) = 50$ g.
1. Separate: $dy/y = −0.1dt$.
2. Integrate: $ln|y| = −0.1t + c$, so $y = Ce^{−0.1t}$.
3. Condition: $C = 50$, so $y = 50e^{−0.1t}$.
4. Half-life: if $50e^{−0.1t} = 25$, then $t = ln 2/0.1 ≈ 6.93$.
With the sign flipped, the same equation describes growth.`,"soru-uret":`Three questions to test yourself:
1. Solve $y′ = 3y$, $y(0) = 2$.
2. Find the general solution of $y′ = xy$.
3. Show that $y = 3e^{2x}$ satisfies $y′ = 2y$.
**Answers**
1. $y = 2e^{3x}$.
2. $dy/y = xdx$, $ln|y| = x²/2 + c$, so $y = Ce^{x²/2}$.
3. $y′ = 6e^{2x} = 2 · 3e^{2x} = 2y$.`,formul:`The result in the image, $y = 3e^{2x}$, is the solution of $y′ = 2y$.
1. $e^{2x}$: a function whose derivative is $2$ times itself; exactly what the equation asks for.
2. $3$: the initial value, $y = 3$ when $x = 0$.
3. The $2$ in the exponent: the growth rate. The larger it is, the faster the curve steepens.
Check: $y′ = 6e^{2x} = 2y$.`,coz:`Example: $y′ = 2y$, $y(0) = 3$.
1. Separate: $dy/y = 2dx$.
2. Integrate: $ln|y| = 2x + c$.
3. Exponentiate: $y = Ce^{2x}$.
4. Condition: $y(0) = C = 3$.
Result: $y = 3e^{2x}$. Check: $y′ = 6e^{2x} = 2y$.`},statik:{acikla:`Problem 2.7 is an equilibrium problem for a simply supported beam. The beam rests on a pin support at $A$ (two reactions: $A_x$, $A_y$) and a roller support at $B$ (one reaction: $B_y$).
1. Free body diagram: remove the supports and draw the reaction forces in their place. Loads: $12$ kN at $C$ and $4$ kN/m along $CB$.
2. Replace the distributed load with its resultant: $4 · 2 = 8$ kN, at the middle of $CB$, so $4$ m from $A$.
3. Write the equilibrium equations: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM_A = 0$. Three unknowns, three equations.
4. Taking moments about $A$ drops $A_x$ and $A_y$ from the equation, so $B_y$ comes out directly.
Shear force and bending moment are found by cutting the beam at a point and looking at the equilibrium of the left part.`,ozetle:`Summary in three lines:
- $A$ is a pin support ($A_x$, $A_y$) and $B$ is a roller ($B_y$); the loads are a $12$ kN point load and $4$ kN/m distributed.
- From equilibrium, $A_x = 0$, $A_y = 6.4$ kN, $B_y = 13.6$ kN.
- The largest bending moment is at $C$: $M_C = 19.2$ kN·m.`,basitlestir:`Think of the beam as a plank carried on the shoulders of two people. $A$ and $B$ are the two carriers, and the loads are weights placed on the plank.
Whoever is closer to the weight carries more. Here most of the load is near $B$, so $B_y = 13.6$ kN and $A_y = 6.4$ kN.
The total load is $12 + 8 = 20$ kN; the two carriers' shares also add up to $20$ kN.
Moment is the turning effect on the plank: force times distance. If the plank isn't turning, the turning effects in the two directions cancel out.`,coz:`Problem 2.7: $AC = 3$ m, $CB = 2$ m.
1. No horizontal load: $A_x = 0$.
2. The resultant of the distributed load is $4 · 2 = 8$ kN, $4$ m from $A$.
3. $ΣM_A = 0$: $B_y · 5 − 12 · 3 − 8 · 4 = 0$, so $B_y = 68/5 = 13.6$ kN.
4. $ΣF_y = 0$: $A_y = 12 + 8 − 13.6 = 6.4$ kN.
5. Check with moments about $B$: $6.4 · 5 − 12 · 2 − 8 · 1 = 32 − 24 − 8 = 0$.
The shear force is $6.4$ kN along $AC$; at $C$ it drops by $12$ kN to $−5.6$ kN, and falls to $−13.6$ kN at $B$. The moment is largest at $C$, where the shear changes sign: $M_C = 6.4 · 3 = 19.2$ kN·m.`,adim:`Shear and moment step by step; the reactions are $A_y = 6.4$ kN, $B_y = 13.6$ kN:
1. $0 < x < 3$ (between $A$ and $C$): only $A_y$ is to the left of the cut. $V = 6.4$ kN, $M = 6.4x$. Reason: equilibrium of the left part.
2. Point load at $C$: the shear drops suddenly by $12$ kN, $V = −5.6$ kN. The moment stays continuous: $M_C = 19.2$ kN·m.
3. $3 < x < 5$ (between $C$ and $B$): $V = −5.6 − 4(x − 3)$, $M = 6.4x − 12(x − 3) − 2(x − 3)^2$. Reason: a distributed load changes the shear linearly and the moment parabolically.
4. At $x = 5$, $M = 32 − 24 − 8 = 0$. The moment must be zero at the roller; the check works.
Rule: $dM/dx = V$. Where the shear crosses zero, the moment peaks; here that is $C$.`,formul:`The basic expressions in beam problems are the equilibrium equations:
1. $ΣF_x = 0$ and $ΣF_y = 0$: the beam isn't translating, so the forces add up to zero.
2. $ΣM_A = 0$: the beam isn't rotating; the moments about any point add up to zero. Moment is force times perpendicular distance, in kN·m.
3. The resultant of a distributed load is $W = q · L$; it acts at the centroid of the load area. Here $W = 4 · 2 = 8$ kN.
4. The internal forces are related by $dV/dx = −q$ and $dM/dx = V$.
Choose a sign convention at the start and keep it to the end.`,"soru-uret":`Three questions to test yourself:
1. How many reaction components do a pin support and a roller support give?
2. A $10$ kN point load is placed at the middle of a simply supported beam with a $6$ m span. What are the support reactions and the largest moment?
3. A $3$ kN/m distributed load acts over $4$ m. What is its resultant, and where does it act?
**Answers**
1. A pin support gives two ($A_x$, $A_y$), a roller gives one ($B_y$).
2. By symmetry $A_y = B_y = 5$ kN; $M_{max} = 5 · 3 = 15$ kN·m, at the middle of the beam.
3. $W = 3 · 4 = 12$ kN, at the middle of the loaded region.`,"ozetle-gorsel":`This area has three things:
- A beam: a pin support at $A$ and a roller at $B$; spans of $3$ m and $2$ m.
- Loads: $12$ kN at $C$ and $4$ kN/m distributed along $CB$.
- What's asked: a free body diagram, the support reactions, and the shear and moment diagrams.
In short, the area asks you to set up the equilibrium of a beam step by step.`},anatomi:{acikla:`The brachial plexus (plexus brachialis) is the network of nerves that supplies the motor and sensory nerves of the upper limb.
1. Roots: the anterior rami of spinal nerves C5, C6, C7, C8 and T1.
2. Trunks: superior (C5, C6), middle (C7) and inferior (C8, T1).
3. Divisions: each trunk splits into an anterior and a posterior division; anterior divisions go to flexors, posterior divisions to extensors.
4. Cords: lateral, posterior and medial, named for their position relative to the axillary artery.
5. Terminal branches: the musculocutaneous nerve from the lateral cord, the axillary and radial nerves from the posterior cord, the ulnar nerve from the medial cord; the median nerve forms from one root each of the lateral and medial cords.
Numbers to memorize: 5 roots, 3 trunks, 6 divisions, 3 cords, 5 terminal branches.`,ozetle:`Summary in three lines:
- The plexus forms from the anterior rami of C5 to T1: roots, trunks, divisions, cords, terminal branches.
- Five terminal branches: musculocutaneous, axillary, radial, median and ulnar.
- Clinically, upper trunk injury causes Erb palsy (C5, C6), and lower trunk injury causes Klumpke palsy (C8, T1).`,basitlestir:`Think of the plexus as a city's power distribution center. Five cables come from the spinal cord (C5 to T1), join and mix in the center, and leave for the arm as five main lines.
The benefit of mixing: even if one root is damaged, no muscle loses power completely, because most nerves carry fibers from more than one root.
Roughly what the five main lines do:
- Musculocutaneous: the front of the arm; bends the elbow.
- Axillary: the deltoid, which lifts the arm to the side.
- Radial: the back of the arm and forearm; extends the wrist and fingers.
- Median: most of the front of the forearm and the thumb muscles.
- Ulnar: most of the small muscles of the hand, fine finger movements.`,ornek:`A clinical example: a fracture of the middle of the humeral shaft.
1. The radial nerve runs close to the bone in the radial groove on the back of the humerus; it is easily injured in a fracture.
2. Result: the wrist and finger extensors stop working and the wrist drops (wrist drop). There is sensory loss on the back of the hand, between the thumb and index finger.
3. The triceps is usually spared, because its branches leave before the nerve enters the groove.
By the same logic, a surgical neck fracture of the humerus endangers the axillary nerve, and trauma to the medial epicondyle endangers the ulnar nerve.`,adim:`Draw the plexus on paper step by step:
1. On the left, write the five roots one under another: C5, C6, C7, C8, T1.
2. Join C5 and C6 (superior trunk), continue C7 straight (middle trunk), join C8 and T1 (inferior trunk).
3. Split each trunk in two: an anterior division and a posterior division.
4. Join the three posterior divisions: the posterior cord. The anterior divisions of the superior and middle trunks form the lateral cord, and the anterior division of the inferior trunk forms the medial cord.
5. Add the branches: musculocutaneous from the lateral cord, axillary and radial from the posterior cord, ulnar from the medial cord. Take one root each from the lateral and medial cords and draw an M in the middle: the median nerve.
The M shape in the middle is the easiest sign for recognizing the plexus in dissection and imaging.`,"soru-uret":`Three questions to test yourself:
1. Which cord lies behind the axillary artery, and which terminal branches does it give?
2. After a difficult birth, a baby's arm is internally rotated, with the forearm extended and pronated. Which roots are affected?
3. Which nerve is compressed in carpal tunnel syndrome, and what are the first signs?
**Answers**
1. The posterior cord; the axillary and radial nerves.
2. C5 and C6, the superior trunk: Erb-Duchenne palsy (waiter's tip hand).
3. The median nerve; numbness in the thumb, index finger, middle finger and half of the ring finger, later weakness and wasting of the thenar muscles.`},logturev:{acikla:`Logarithmic differentiation is a way to simplify a function full of products, quotients and powers before differentiating it.
1. Take the natural log of both sides: $ln y = ln f(x)$.
2. Use the log rules to turn products into sums, quotients into differences and powers into coefficients: $ln(ab) = ln a + ln b$, $ln(a/b) = ln a − ln b$, $ln a^n = n ln a$.
3. Differentiate implicitly with respect to $x$: the left side becomes $y′/y$.
4. Multiply by $y$: $y′ = y · (...)$.
When both the base and the exponent vary (like $x^x$), this is the only way; neither the power rule nor the exponential rule works alone.`,ozetle:`Summary in three lines:
- Take the log of both sides, turning products and quotients into sums.
- Implicit differentiation gives $y′/y$, which is then multiplied by $y$.
- Example: for $y = x^x$, $ln y = x ln x$, so $y′ = x^x(ln x + 1)$.`,basitlestir:`The derivative of a product is tedious; the derivative of a sum is easy. A logarithm is like a machine that turns products into sums.
So first you take $ln$: products become sums, quotients become differences, powers become the numbers in front. Then you differentiate each term separately.
Don't forget one thing at the end: since the derivative of $ln y$ is $y′/y$, you multiply the answer by $y$.`,ornek:`Example: $y = x^x$ for $x > 0$.
1. Take the log: $ln y = x ln x$.
2. Differentiate: $y′/y$ on the left, and on the right, by the product rule, $ln x + x · (1/x) = ln x + 1$.
3. Multiply by $y$: $y′ = x^x(ln x + 1)$.
Check: at $x = 1$, $y′ = 1$; the slope of $x^x$ at $(1, 1)$ really is $1$.`,coz:`Example 3 on the page: $y = x^{3/4} √(x^2 + 1)/(3x + 2)^5$.
1. Take the log: $ln y = (3/4)ln x + (1/2)ln(x^2 + 1) − 5ln(3x + 2)$.
2. Differentiate: $y′/y = 3/(4x) + x/(x^2 + 1) − 15/(3x + 2)$.
3. Multiply by $y$: $y′ = y · (3/(4x) + x/(x^2 + 1) − 15/(3x + 2))$, where $y$ is the original expression.
Each term was differentiated on its own; reaching the same result with the quotient rule would take much longer.`,adim:`Step by step, with $y = x^{sin x}$ from the exercises:
1. Take the log: $ln y = sin x · ln x$. Reason: $ln a^b = b ln a$, the exponent comes down.
2. Differentiate the right side with the product rule: $cos x · ln x + sin x · (1/x)$.
3. Left side: $(ln y)′ = y′/y$. Reason: the chain rule.
4. Multiply by $y$: $y′ = x^{sin x}(cos x · ln x + sin x/x)$.
When both the base and the exponent vary, this is the only clean way.`,formul:`The chain in the image: $ln y = x ln x$, then $y′/y = ln x + 1$, then $y′ = x^x(ln x + 1)$.
1. $ln y = x ln x$: the log brings the exponent down; now the product rule is enough.
2. $y′/y$: the derivative of $ln y$ with respect to $x$, from the chain rule.
3. $ln x + 1$: the derivative of $x ln x$ by the product rule, $1 · ln x + x · (1/x)$.
4. In the last step both sides are multiplied by $y = x^x$.`,"soru-uret":`Three questions to test yourself:
1. What is $y′$ for $y = x^{√x}$?
2. Find the derivative of $y = (x^2 + 1)^3(x − 2)^4$ with logarithmic differentiation.
3. When is logarithmic differentiation required?
**Answers**
1. $ln y = √x ln x$, $y′/y = (ln x + 2)/(2√x)$, so $y′ = x^{√x}(ln x + 2)/(2√x)$.
2. $y′ = (x^2 + 1)^3(x − 2)^4 · (6x/(x^2 + 1) + 4/(x − 2))$.
3. When both the base and the exponent vary; for example $x^x$ or $x^{sin x}$.`,"ozetle-gorsel":`This area has three things:
- The method: log of both sides, simplify, differentiate implicitly, multiply by $y$.
- Example 3: an expression with products and quotients turns into a sum of three terms with logs.
- Example 4: for $y = x^x$, $y′ = x^x(ln x + 1)$.
In short, the area shows how to simplify complicated expressions with logs before differentiating.`},statik26:{acikla:`A simply supported beam rests on a pin support at one end and a roller at the other. The pin gives two reactions ($A_x$, $A_y$), the roller gives one ($B_y$).
1. In the plane there are three equilibrium equations for the three unknowns: $ΣF_x = 0$, $ΣF_y = 0$, $ΣM = 0$. So the beam is statically determinate and can be solved with statics alone.
2. The distributed load is replaced with its resultant: in Example 2.6, $4 · 6 = 24$ kN, at the middle of the span, $3$ m from $A$.
3. Taking moments about $A$ drops $A_x$ and $A_y$, so $B_y$ comes out directly.
Result: $A_x = 0$, $B_y = 18$ kN, $A_y = 24$ kN.`,ozetle:`Summary in three lines:
- In a simply supported beam, the pin gives $A_x$ and $A_y$ and the roller gives $B_y$; the beam is statically determinate.
- The distributed load is replaced with its resultant: $W = w · L$, at the middle of the loaded region.
- Example 2.6: $A_x = 0$, $A_y = 24$ kN, $B_y = 18$ kN.`,basitlestir:`Think of the beam as a plank carried on the shoulders of two people: $A$ and $B$ are the two carriers.
The total load is $18 + 24 = 42$ kN. The distributed load is shared equally by the two ends, but the $18$ kN point load is closer to $A$ ($2$ m). So $A$ carries more: $A_y = 24$ kN, $B_y = 18$ kN.
Moment is the turning effect on the plank: force times distance. If the plank isn't turning, the turning effects in the two directions cancel out.`,coz:`Example 2.6: $AB = 6$ m, $w = 4$ kN/m over the whole span, $P = 18$ kN at $C$, $2$ m from $A$.
1. No horizontal load: $A_x = 0$.
2. The resultant of the distributed load is $4 · 6 = 24$ kN, $3$ m from $A$.
3. $ΣM_A = 0$: $6B_y − 18 · 2 − 24 · 3 = 0$, so $B_y = 108/6 = 18$ kN.
4. $ΣF_y = 0$: $A_y = 18 + 24 − 18 = 24$ kN.
5. Check with moments about $B$: $24 · 6 − 18 · 4 − 24 · 3 = 144 − 72 − 72 = 0$.`,adim:`Support reactions step by step:
1. Free body diagram: remove the supports and draw $A_x$, $A_y$, $B_y$ in their place. Reason: what is in equilibrium is the sum of the external forces.
2. Turn the distributed load into a single $24$ kN force and place it at $x = 3$ m. Reason: the resultant acts at the centroid of the load area.
3. $ΣM_A = 0$: $6B_y = 18 · 2 + 24 · 3 = 108$, so $B_y = 18$ kN. Reason: the unknowns at $A$ have no moment about $A$.
4. $ΣF_y = 0$: $A_y = 42 − 18 = 24$ kN.
5. $ΣF_x = 0$: $A_x = 0$.
To check, take moments about $B$; it should come out to zero.`,"ozetle-gorsel":`This area has three things:
- A definition: in a simply supported beam, the pin gives two reactions and the roller gives one.
- Example 2.6: a $6$ m beam, $4$ kN/m over the whole span and $18$ kN at $C$.
- The solution: $ΣM_A = 0$ gives $B_y = 18$ kN, and $ΣF_y = 0$ gives $A_y = 24$ kN.
In short, the area shows the path from the free body diagram to the reactions.`},statikVM:{acikla:`Shear force $V$ and bending moment $M$ are found by cutting the beam at a point and looking at the equilibrium of the part on one side.
1. Relation to the load: $dV/dx = −w(x)$. Under a distributed load $V$ decreases linearly; with no load it stays constant.
2. Relation to the shear: $dM/dx = V(x)$. When $V$ is positive $M$ increases; when it is negative $M$ decreases.
3. Under a point load, $V$ jumps by the size of the load; $M$ has a kink there but stays continuous.
4. $M$ is largest where $V$ changes sign.
In Example 2.6, $V$ jumps from $+16$ to $−2$ at $C$; $M_{max} = 24 · 2 − 2 · 2^2 = 40$ kN·m.`,ozetle:`Summary in three lines:
- Method of sections: $V$ and $M$ come from the equilibrium of the part on one side of the cut.
- $dV/dx = −w$ and $dM/dx = V$; under a point load, $V$ jumps.
- In Example 2.6, $V$ jumps from $+16$ to $−2$ at $C$, and $M_{max} = 40$ kN·m.`,basitlestir:`Shear force is the force that tries to slide the two parts of the beam up and down past each other when you cut it at a point. Moment is the effect that tries to bend the beam at that point.
The two are linked: the slope of the moment graph is the shear force. When the shear crosses zero, the moment peaks; just as a ball thrown in the air is highest at the moment its speed is zero.
In Example 2.6 that moment is point $C$: $M_{max} = 40$ kN·m.`,coz:`Example 2.6 (continued): $A_y = 24$ kN, $B_y = 18$ kN.
1. $0 ≤ x < 2$: $V = 24 − 4x$, $M = 24x − 2x^2$.
2. The $18$ kN at $C$: $V$ jumps from $24 − 8 = 16$ to $16 − 18 = −2$.
3. $2 < x ≤ 6$: $V = 6 − 4x$, $M = 36 + 6x − 2x^2$.
4. Ends: $M(0) = 0$ and $M(6) = 36 + 36 − 72 = 0$. The moment is zero at the supports; the check works.
5. The largest moment is at $x = 2$, where $V$ changes sign: $M_{max} = 40$ kN·m.`,adim:`The method of sections step by step (Example 2.6):
1. Cut at point $x$ and take the left part. Reason: the left part has fewer forces.
2. $0 ≤ x < 2$: on the left are $A_y = 24$ kN and a distributed load of $4x$ kN. $ΣF_y = 0$ gives $V = 24 − 4x$.
3. Moment about the cut: $M = 24x − 4x · (x/2) = 24x − 2x^2$. Reason: the resultant of the distributed load is at the middle of the part.
4. $x > 2$: the $18$ kN also enters the left part. $V = 6 − 4x$, $M = 24x − 2x^2 − 18(x − 2) = 36 + 6x − 2x^2$.
5. Check: $dM/dx = 6 − 4x = V$. The relation holds.`,formul:`The relations in the image: $dV/dx = −w(x)$ and $dM/dx = V(x)$.
1. $w(x)$: the distributed load per unit length, positive downward.
2. $dV/dx = −w$: the slope of the $V$ diagram is the negative of the load. With no load, $V$ is flat.
3. $dM/dx = V$: the slope of the $M$ diagram is the shear force. Where $V = 0$, $M$ peaks.
4. Integral form: the difference in $M$ between two sections equals the area of the $V$ diagram between them.`,"soru-uret":`Three questions to test yourself:
1. On a stretch with no distributed load, what do the $V$ and $M$ diagrams look like?
2. If $V(x) = 10 − 2x$ on a stretch, at what $x$ is $M$ largest?
3. If $20$ kN is placed at the middle of a $5$ m simple beam, what is the largest moment?
**Answers**
1. $V$ constant, $M$ linear.
2. Where $V = 0$: $x = 5$.
3. The reactions are $10$ kN each; $M_{max} = 10 · 2.5 = 25$ kN·m, at the middle.`},anatomiKas:{acikla:`The arm is divided into two compartments, and each compartment has its own nerve; that is the key to remembering the table.
1. Anterior (flexor) compartment: biceps brachii, brachialis, coracobrachialis. All three are innervated by the musculocutaneous nerve.
2. Posterior (extensor) compartment: triceps brachii and anconeus. They are innervated by the radial nerve.
3. The biceps both flexes the forearm and is the strongest supinator; supination is strongest with the elbow flexed.
4. The brachialis flexes the elbow whatever the position of the forearm; it is the main flexor.
5. The long head of the triceps also crosses the shoulder joint, so it also extends and adducts the arm.`,ozetle:`Summary in three lines:
- Anterior compartment (biceps, brachialis, coracobrachialis): musculocutaneous nerve.
- Posterior compartment (triceps, anconeus): radial nerve.
- The biceps is the strongest supinator and the brachialis the main elbow flexor; in a humeral shaft fracture the radial nerve can be injured, causing wrist drop.`,basitlestir:`Think of the arm as benders in front and straighteners in back.
The ones in front bend the elbow, and all three share one nerve: musculocutaneous. The triceps in back straightens the elbow; its nerve is the radial.
The biceps also turns the palm up (supination). It is the strong muscle working when you open a jar lid or drive a screw with your right hand.`,ornek:`An everyday example: driving a screw with a screwdriver in your right hand is a supination movement.
1. The strongest muscle for this movement is the biceps brachii.
2. Because the biceps attaches to the radial tuberosity, it rotates the radius around its own axis.
3. Supination is strongest with the elbow bent at about 90 degrees; that is why driving a screw is easier with the arm bent rather than straight.
The clinical side: if the radial nerve is injured in a humeral shaft fracture, the triceps is usually spared but the wrist extensors stop working and the wrist drops.`,"soru-uret":`Three questions to test yourself:
1. Where does the brachialis insert, and what does it do?
2. Where do the two heads of the biceps brachii originate?
3. After a humeral shaft fracture, the patient can't lift the hand at the wrist. Which nerve is injured, and where?
**Answers**
1. The coronoid process and the ulnar tuberosity; it is the main flexor of the forearm at the elbow.
2. The long head from the supraglenoid tubercle, the short head from the coracoid process.
3. The radial nerve, in the radial groove on the back of the humerus.`},anatomiFossa:{acikla:`The cubital fossa (fossa cubitalis) is the triangular hollow in front of the elbow.
1. Borders: above, the line between the two epicondyles; laterally the brachioradialis, medially the pronator teres.
2. The floor is the brachialis and supinator; the roof is fascia and the bicipital aponeurosis.
3. Contents, from lateral to medial: the biceps brachii tendon, the brachial artery, the median nerve. Mnemonic: TAN (Tendon, Artery, Nerve).
4. The radial nerve stays at the lateral edge, under the brachioradialis.
Clinical importance: venous blood is drawn from the superficial veins here, and when measuring blood pressure the stethoscope goes over the brachial artery.`,ozetle:`Summary in three lines:
- A triangular hollow in front of the elbow, bordered laterally by the brachioradialis and medially by the pronator teres.
- Contents from lateral to medial, TAN: biceps tendon, brachial artery, median nerve.
- Blood draws and blood pressure measurements are done in this area.`,basitlestir:`Think of the hollow on the inside of your elbow. Two muscles draw a V: the brachioradialis on the outside, the pronator teres on the inside.
Inside the hollow, three things lie side by side from outside to inside: the biceps tendon, the artery and the nerve. TAN for short.
The veins used for blood draws are on top of these, just under the skin.`,ornek:`A clinical example: drawing blood at the elbow.
1. The needle enters the superficial veins, most often the median cubital vein.
2. The bicipital aponeurosis lies under this vein and covers the brachial artery and median nerve, protecting the deeper structures.
3. If the needle goes too deep and too medial, the artery or the median nerve can be injured.
So if the vein can't be found, another vessel is chosen instead of probing deeper and further in.`,"soru-uret":`Three questions to test yourself:
1. Which muscles form the medial and lateral borders of the cubital fossa?
2. List its contents from lateral to medial.
3. When drawing blood, which structure protects the deeper artery and nerve?
**Answers**
1. Medially the pronator teres, laterally the brachioradialis.
2. The biceps brachii tendon, the brachial artery, the median nerve.
3. The bicipital aponeurosis.`},turev:{acikla:`The core idea here: the derivative is the instantaneous rate of change of a quantity.
1. First write the average change between two points: $(f(x+h) − f(x))/h$.
2. Then shrink the interval. If this ratio approaches a number as $h → 0$, that number is $f′(x)$.
3. Geometric meaning: $f′(x)$ is the slope of the line tangent to the graph at $x$.
For example, for $f(x) = x^2$ the ratio is $2x + h$; as $h → 0$, $f′(x) = 2x$.`,ozetle:`Summary in three lines:
- The derivative is a function's instantaneous rate of change at a point: as $h → 0$, $f′(x) = lim (f(x+h) − f(x))/h$.
- On the graph this number equals the slope of the tangent line.
- The product, quotient and chain rules let you differentiate without going back to the limit every time; for example $(x^3)′ = 3x^2$.`,basitlestir:`Think of a car's speedometer. If you drove 60 km in an hour, your average speed is 60 km/h, but the speedometer shows your speed right now. The derivative is that speedometer.
If the distance is $s(t)$, the instantaneous speed is $s′(t)$. For example, if $s(t) = 5t^2$, then $s′(t) = 10t$; at 3 seconds the speed is $10 · 3 = 30$ m/s.
In short: average speed looks at the span between two moments, the derivative looks at a single moment.`,ornek:`A concrete example: the volume of a balloon with radius $r$ is $V = (4/3)πr^3$.
1. The derivative of the volume with respect to the radius is $dV/dr = 4πr^2$.
2. At $r = 3$ cm this is $4π · 9 ≈ 113$ cm³/cm.
3. So at a radius of 3 cm, inflating it 1 mm more increases the volume by about $113 · 0.1 ≈ 11.3$ cm³.
Notice that $4πr^2$ is the surface area of the sphere: the volume grows by adding a thin layer to the surface.`,"soru-uret":`Three questions to test yourself:
1. If $f(x) = 3x^2 − 4x$, what is $f′(2)$?
2. Find the derivative of $g(x) = sin(x^2)$.
3. What is the equation of the tangent to $y = x^3$ at $x = 1$?
**Answers**
1. $f′(x) = 6x − 4$, so $f′(2) = 8$.
2. $g′(x) = cos(x^2) · 2x$.
3. Slope $3$, point $(1, 1)$; the tangent is $y = 3x − 2$.`,formul:`The definition in the image: $f′(a) = lim (f(a+h) − f(a))/h$, as $h → 0$.
1. $f(a+h) − f(a)$: the change in the function when you move forward by $h$.
2. Divided by $h$: the rate of this change per unit, that is, the slope of the secant line.
3. $h → 0$: the secant turns into the line tangent at the point.
The tangent line's equation: $y = f(a) + f′(a)(x − a)$.`,coz:`Example: the tangent to $f(x) = x^3 − 3x$ at $x = 2$.
1. Derivative: $f′(x) = 3x^2 − 3$.
2. Slope: $f′(2) = 12 − 3 = 9$.
3. Point: $f(2) = 8 − 6 = 2$, so $(2, 2)$.
4. Tangent: $y − 2 = 9(x − 2)$, so $y = 9x − 16$.`,adim:`Step by step, the derivative of $f(x) = x^2$ from the definition:
1. Write the difference quotient: $(f(x+h) − f(x))/h = ((x+h)^2 − x^2)/h$. Reason: the definition of the derivative.
2. Expand: $(x^2 + 2xh + h^2 − x^2)/h = (2xh + h^2)/h$.
3. Simplify: $2x + h$. Reason: dividing is allowed while $h ≠ 0$.
4. Limit: as $h → 0$, $2x + h → 2x$.
Result: $f′(x) = 2x$.`,"ozetle-gorsel":`This area has three things:
- A definition: the derivative of a function at a point, $f′(a) = lim (f(a+h) − f(a))/h$.
- A figure: the line tangent to the curve at $a$.
- A result: the tangent line's equation, $y = f(a) + f′(a)(x − a)$.
In short, the area sums up the geometric meaning of the derivative.`}},Le={formul:"acikla",coz:"ornek",adim:"acikla","ozetle-gorsel":"ozetle",ozetle:"acikla",ornek:"coz"},Ke={statik26:"statik",statikVM:"statik",anatomiKas:"anatomi",anatomiFossa:"anatomi"};function P(e){return(String(e).replace(/\s+/g," ").match(/[^.!?…]+(?:[.!?…]+["”»’]*|$)/g)||[]).map(a=>a.trim()).filter(a=>a.length>2)}const f=(e,a=110)=>{if(e=String(e).trim(),e.length<=a)return e;const t=e.lastIndexOf(" ",a);return e.slice(0,t>a/2?t:a).replace(/[,;:]$/,"")+"…"},Ia=[{re:/kenar|not(?:u|lar|un)|kalem|derkenar|altını çiz/i,ad:"okurun metinle kurduğu sessiz konuşma",sade:"Bir kitabın kenarına yazılan not, okurun yazara verdiği cevaptır. Yıllar sonra o notu okuyan biri, hem kitabı hem de ondan önceki okuru dinler.",ornek:"Kütüphaneden aldığın bir kitapta birinin kurşun kalemle düştüğü notu düşün. Yazanı tanımazsın, ama aynı cümlede durup düşündüğünüzü bilirsin. Metnin anlattığı duygu bu: iki yabancı arasında sayfa üstünde kurulan bir yakınlık.",dikkat:"küçük bir nesne, bir not ya da bir çizgi, büyük bir soruyu taşıyor. Okumak gerçekten yalnız yapılan bir iş mi?"},{re:/mürekkep|harf|alfabe|yazı|hattat|matbaa/i,ad:"yazının kalıcılığı ve kuşaktan kuşağa geçen bilgi",sade:"Yazı, insanın unutmaya karşı bulduğu çaredir. Kâğıda geçen şey, yazan kişiden daha uzun yaşar ve sonraki kuşaklara ulaşır.",ornek:"Ailende el yazısıyla tutulmuş bir tarif defteri varsa onu düşün. Tarifin yanına sonradan eklenmiş küçük notlar, defteri yalnız bir yemek kitabı olmaktan çıkarır; bir aile tarihine dönüştürür.",dikkat:"yazı aracının (mürekkep, harf, kâğıt) kendisi de anlatının bir kahramanı gibi ele alınıyor."},{re:/zaman|yıl|eski|sarar|hafıza|hatırla|unut|geçmiş/i,ad:"zaman ve hafıza",sade:"Zaman geçtikçe şeyler eskir, ama üstlerinde iz kalır. Metin, o izlere bakarak geçmişi yeniden düşünmeyi anlatıyor.",ornek:"Eski bir fotoğrafın arkasına yazılmış bir tarih düşün. Fotoğraftaki kişiyi tanımasan bile o tarih sana bir an, bir hayat ve kaybolmuş bir bağlam hakkında bir şey söyler.",dikkat:"anlatıcı geçmişi doğrudan anlatmıyor; nesnelerin üstünde kalan izlerden okuyor."},{re:/mektup|cevap|ses|konuş/i,ad:"gecikmiş bir iletişim",sade:"Bazen bir söz, yazıldığı anda değil yıllar sonra karşılığını bulur. Metin bu gecikmiş karşılaşmayı anlatıyor.",ornek:"Yıllar önce birine yazılmış ama hiç gönderilmemiş bir mektubu bulduğunu düşün. Sana yazılmamıştır, ama okuduğun anda bir cevap bekliyormuş gibi gelir.",dikkat:"konuşma bir kişiyle değil, zamanın öbür ucundaki bir okurla kuruluyor."}],La={ad:"okumanın insanda bıraktığı iz",sade:"Metin, bir deneyimi anlatıp okuru kendi deneyimini düşünmeye çağırıyor. Önemli olan olayların kendisi değil, bıraktıkları duygu.",ornek:"Bir kitabı yıllar sonra yeniden okuduğunu düşün. Aynı cümleler bu kez başka yerlerinden dokunur; değişen kitap değil, okurdur.",dikkat:"anlatıcı somut ayrıntılardan yola çıkıp genel bir düşünceye varıyor."};function Ka(e,a){const t=P(a),i=Ia.find(c=>c.re.test(a))||La,d=/(?<!\p{L})(?:ben|bana|beni|benim)(?!\p{L})|(?<=\p{L}{2})(?:dım|dim|dum|düm|tım|tim|tum|tüm|ıyorum|iyorum|uyorum|üyorum)(?!\p{L})/iu.test(a)?"birinci tekil şahıs anlatıcı":"anlatıcı",l=t.find(c=>/(?<!\p{L})gibi(?!\p{L})/iu.test(c)),m=t.find(c=>c!==l&&c!==t[0]&&/(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(c)&&c.split(" ").length>=5),u=t.filter(c=>/\?["”»’]*$/.test(c)).length,h=t[0]||a,y=t.length>2?t[t.length-1]:"",b=!l&&/(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(h),v=(c,p)=>f(c,p).replace(/[.!?…]+["”»’]*$/u,"");switch(e){case"ozetle":return["Kısaca:",`- Çıkış noktası: ${f(h,120)}`,y?`- Varılan yer: ${f(y,120)}`:"",`- Tema: ${i.ad}.`].filter(Boolean).join(`
`);case"basitlestir":return`Daha sade söylersek: ${i.sade}
Yazar bunu doğrudan söylemek yerine ${l?"bir benzetmeyle":"somut ayrıntılarla"} anlatıyor; duygu böyle daha kolay geçer.${l?`
Benzetmenin geçtiği yer: «${f(l,100)}»`:""}`;case"ornek":return`Metindeki fikre gündelik bir örnek:
${i.ornek}`;case"soru-uret":return["Kendini sınamak için üç soru:",`1. Anlatıcı «${v(h,70)}» derken neyi anlatmak istiyor?`,l?`2. «${v(l,70)}» cümlesinde ne neye benzetiliyor?`:"2. Parçada geçen somut bir nesneyi bul. Yazar onu hangi düşünceyi anlatmak için kullanıyor?","3. Parçanın ana teması nedir? Kendi hayatından bir örnekle açıkla.","**Cevaplar**",`1. Cümle parçanın yönünü veriyor; anlatıcı buradan ${i.ad} düşüncesine geçiyor.`,l?"2. Benzetmenin iki ucunu ayır: anlatılan şey ve «gibi»den önceki görüntü. İkisinin ortak özelliği, yazarın vurgulamak istediği şeydir.":'2. Somut nesne soyut düşünceyi taşır; nesneyi bulup "bu neyin yerine geçiyor?" diye sor.',`3. Ana tema ${i.ad}. Örnek kişisel olabilir; önemli olan temayla bağını kurman.`].join(`
`);default:{const c=l?`Benzetme: «${f(l,110)}» Soyut bir düşünce gözle görülen bir şeye bağlanıyor; okur onu zihninde canlandırabiliyor.`:b?"Kuruluş: ilk cümle kesin bir tanım gibi kurulmuş. Yazar düşüncesini kanıtlamadan bir hüküm olarak koyuyor; bu, metne deneme havası veriyor.":m?`Hüküm cümlesi: «${f(m,110)}» Yazar düşünceyi kesin bir tanım gibi koyuyor; bu, metne deneme havası veriyor.`:"Ayrıntılar: anlatıcı büyük sözler yerine küçük, somut ayrıntılarla ilerliyor; nesneler konuşuyor.",p=u?`Sorular: parçada ${u} soru cümlesi var. Anlatıcı cevap vermekten çok okuru düşünmeye çağırıyor.`:"Ton: sakin ve düşünceli; anlatıcı bir şey kanıtlamaktan çok bir deneyimi paylaşıyor.";return`Bu parçada ${d} ${i.ad} üzerine düşünüyor.
1. Çıkış noktası: «${f(h,110)}»
2. ${c}
3. ${p}
Okurken şuna dikkat et: ${i.dikkat}`}}}const Da=[{re:/margin|\bnotes?\b|pencil|underlin|marginalia/i,ad:"the quiet conversation between a reader and a text",sade:"A note written in the margin of a book is the reader's reply to the author. Someone who reads that note years later hears both the book and the reader who came before.",ornek:"Think of a note someone left in pencil in a library book. You don't know who wrote it, but you know you both stopped at the same sentence to think. That is the feeling the text describes: a closeness built on a page between two strangers.",dikkat:"a small object, a note or a line, carries a big question. Is reading really something done alone?"},{re:/\bink|alphabet|handwrit|writing|calligraph|printing|printer/i,ad:"the permanence of writing and knowledge passed down through generations",sade:"Writing is the remedy people found against forgetting. What goes onto paper outlives the person who wrote it and reaches later generations.",ornek:"If your family has a handwritten recipe notebook, think of it. The small notes added next to the recipes over the years turn it from a cookbook into a family history.",dikkat:"the writing tool itself (ink, letters, paper) is treated almost like a character in the story."},{re:/\btime\b|\byears?\b|\bold\b|yellow|memor|rememb|forget|forgot|\bpast\b/i,ad:"time and memory",sade:"As time passes, things grow old, but they keep traces. The text is about looking at those traces to think about the past again.",ornek:"Think of a date written on the back of an old photograph. Even if you don't know the person in it, that date tells you something about a moment, a life and a lost context.",dikkat:"the narrator doesn't tell the past directly; they read it from the traces left on objects."},{re:/\bletters?\b|\brepl|answer|voice|speak|talk/i,ad:"a delayed act of communication",sade:"Sometimes words find their answer not when they are written but years later. The text describes this delayed meeting.",ornek:"Imagine finding a letter written to someone years ago and never sent. It wasn't written to you, but as you read it, it feels as if it is waiting for a reply.",dikkat:"the conversation is with a reader at the other end of time, not with one person."}],Va={ad:"the mark reading leaves on a person",sade:"The text describes an experience and invites the reader to think about their own. What matters is not the events themselves but the feeling they leave.",ornek:"Think of rereading a book years later. The same sentences touch you in different places this time; the book hasn't changed, the reader has.",dikkat:"the narrator starts from concrete details and arrives at a general thought."};function qa(e,a){const t=P(a),i=Da.find(p=>p.re.test(a))||Va,d=/(?<!\p{L})(?:I|me|my|mine|myself)(?!\p{L})/u.test(a)?"a first-person narrator":"the narrator",l=t.find(p=>/(?<!\p{L})(?:like|as if|as though)(?!\p{L})/iu.test(p)),m=/(?<!\p{L})(?:is|are)(?!\p{L})/iu,u=t.find(p=>p!==l&&p!==t[0]&&m.test(p)&&!/\?["”»’]*$/.test(p)&&p.split(" ").length>=5),h=t.filter(p=>/\?["”»’]*$/.test(p)).length,y=t[0]||a,b=t.length>2?t[t.length-1]:"",v=!l&&m.test(y)&&!/\?["”»’]*$/.test(y),c=(p,X)=>f(p,X).replace(/[.!?…]+["”»’]*$/u,"");switch(e){case"ozetle":return["In short:",`- Starting point: ${f(y,120)}`,b?`- Where it ends up: ${f(b,120)}`:"",`- Theme: ${i.ad}.`].filter(Boolean).join(`
`);case"basitlestir":return`Put more simply: ${i.sade}
Rather than saying it directly, the author tells it ${l?"through a comparison":"through concrete details"}; the feeling comes across more easily that way.${l?`
Where the comparison appears: “${f(l,100)}”`:""}`;case"ornek":return`An everyday example of the idea in the text:
${i.ornek}`;case"soru-uret":return["Three questions to test yourself:",`1. What is the narrator trying to say with “${c(y,70)}”?`,l?`2. In the sentence “${c(l,70)}”, what is compared to what?`:"2. Find a concrete object in the passage. What idea does the author use it to express?","3. What is the main theme of the passage? Explain it with an example from your own life.","**Answers**",`1. The sentence sets the direction of the passage; from here the narrator moves to the idea of ${i.ad}.`,l?"2. Separate the two ends of the comparison: the thing being described and the image it is compared to. What they share is what the author wants to stress.":'2. The concrete object carries an abstract idea; find it and ask "what does this stand for?"',`3. The main theme is ${i.ad}. Your example can be personal; what matters is linking it to the theme.`].join(`
`);default:{const p=l?`Comparison: “${f(l,110)}” An abstract idea is tied to something you can see, so the reader can picture it.`:v?"Structure: the first sentence is built like a firm definition. The author states the idea as a verdict without proving it, which gives the text the feel of an essay.":u?`Verdict sentence: “${f(u,110)}” The author states the idea like a firm definition, which gives the text the feel of an essay.`:"Details: instead of big words, the narrator moves through small, concrete details; the objects do the talking.",X=h?`Questions: the passage has ${h===1?"one question":`${h} questions`}. The narrator invites the reader to think more than they give answers.`:"Tone: calm and thoughtful; the narrator shares an experience more than proving a point.";return`In this passage, ${d} reflects on ${i.ad}.
1. Starting point: “${f(y,110)}”
2. ${p}
3. ${X}
While reading, notice this: ${i.dikkat}`}}}const Fa=new Set("about after again because before between could during every first other their there these those through under where which while would should being having itself without within another however therefore although rather".split(" ")),Ra=new Set("olarak olduğu olduğunu arasında birlikte üzerinde sonra önce kadar ancak çünkü dolayısıyla böylece şöyle bunların bunlar onların ayrıca yalnızca neredeyse herhangi".split(" "));function De(e,a=3){const t=new Map,i=_?Fa:Ra;for(const n of String(e).toLocaleLowerCase(E).match(/\p{L}{6,}/gu)||[])i.has(n)||t.set(n,(t.get(n)||0)+1);return[...t].sort((n,d)=>d[1]-n[1]||d[0].length-n[0].length).slice(0,a).map(n=>n[0])}function Oa(e,a){const t="Demo mode didn't recognize this topic. For a detailed answer, choose a provider in Settings.";if(!a.metin)return`Demo mode can't read the area you clipped and didn't recognize the topic of ${a.belgeAd?`“${a.belgeAd}”`:"this page"}.
For a real answer, choose a provider in Settings, or take the question to ChatGPT, Gemini or Claude with your account.`;const i=P(a.metin),n=De(a.metin),d=n.length?n.map(l=>`“${l}”`).join(", "):"the main terms in the text";return e==="ozetle"?`In short:
- ${f(i[0]||a.metin,130)}${i.length>2?`
- ${f(i[i.length-1],130)}`:""}
- Key concepts: ${d}.
${t}`:e==="soru-uret"?`Three questions to test yourself:
1. ${n[0]?`Define “${n[0]}” in your own words.`:"Write the main idea of the passage in one sentence."}
2. ${n[1]?`How are “${n[0]}” and “${n[1]}” related?`:"What is the most important detail in the passage, and why?"}
3. How would you apply this to an example?
**Answers**
Check your answers against the text yourself. ${t}`:`The core of the part you selected: “${f(i[0]||a.metin,120)}”
1. First, pick out the key concepts: ${d}.
2. Define each one in your own words; a concept you can't define is where the gap is.
3. State how the concepts relate in one sentence.
${t}`}function Ve(e,a){if(_)return Oa(e,a);const t="Deneme modu bu konuyu tanımadı; ayrıntılı cevap için Ayarlar'dan bir sağlayıcı seç.";if(!a.metin)return`Deneme modu kırptığın bölgeyi okuyamaz ve ${a.belgeAd?`«${a.belgeAd}» belgesinin`:"bu sayfanın"} konusunu tanımadı.
Gerçek cevap için Ayarlar'dan bir sağlayıcı seç ya da Hesap yoluyla soruyu ChatGPT, Gemini veya Claude'a götür.`;const i=P(a.metin),n=De(a.metin),d=n.length?n.map(l=>`«${l}»`).join(", "):"metindeki ana terimler";return e==="ozetle"?`Kısaca:
- ${f(i[0]||a.metin,130)}${i.length>2?`
- ${f(i[i.length-1],130)}`:""}
- Öne çıkan kavramlar: ${d}.
${t}`:e==="soru-uret"?`Kendini sınamak için üç soru:
1. ${n[0]?`«${n[0]}» kavramını kendi cümlenle tanımla.`:"Parçanın ana fikrini tek cümleyle yaz."}
2. ${n[1]?`«${n[0]}» ile «${n[1]}» arasındaki ilişki nedir?`:"Parçadaki en önemli ayrıntı hangisi, neden?"}
3. Bu bilgiyi bir örnek üzerinde nasıl kullanırsın?
**Cevaplar**
Cevapları metne dönüp kendin kontrol et. ${t}`:`Seçtiğin bölümün özü: «${f(i[0]||a.metin,120)}»
1. Önce anahtar kavramları ayır: ${d}.
2. Her birini kendi cümlenle tanımla; tanımlayamadığın kavram eksik olan yerdir.
3. Kavramlar arasındaki ilişkiyi tek cümlede kur.
${t}`}const Ya=[[/^melankoli/,"Sürekli ve derin hüzün. Eski tıptaki kara safra kuramından gelir: Yunanca melas «kara» ve khole «safra»."],[/^türev/,"Bir niceliğin başka bir niceliğe göre anlık değişim hızı. Gündelik dilde «bir şeyden türeyen» anlamına da gelir."],[/^hafıza/,"Bellek; yaşananı saklama ve gerektiğinde geri çağırma yetisi. Arapça hıfz «korumak» kökünden."],[/^kâğı[dt]|^kağı[dt]/,"Bitki liflerinden yapılan, üzerine yazılan ince yaprak. Farsça kâğaz kelimesinden gelir."],[/^sahaf/,"Eski ve ikinci el kitap alıp satan kimse ya da dükkânı. Arapça sahîfe «sayfa» ile aynı kökten."],[/^dizgici/,"Matbaada harfleri ve satırları basıma hazır biçimde dizen kişi; mürettip."],[/^matbaacı/,"Matbaa işleten ya da matbaada çalışan kimse; basımcı."],[/^matbaa/,"Kitap, gazete gibi şeylerin basıldığı yer; basımevi. Arapça tab' «basma» kökünden."],[/^derkenar/,"Bir yazının kenarına düşülen not, açıklama. Farsça der «içinde» ile kenar sözünden."],[/^temellük/,"Bir şeyi sahiplenme, mülk edinme. Arapça mülk ile aynı kökten."],[/^mazı/,"Bazı meşe ağaçlarında böceklerin yol açtığı yumru. Eskiden mürekkep yapımında kullanılırdı."],[/^hattat/,"Güzel yazı sanatçısı. Arapça hat «yazı, çizgi» kökünden."],[/^mürekkep/,"Yazmak ve basmak için kullanılan renkli sıvı. Arapça kökte «birleşik, karışım» anlamı taşır."],[/^yelpaze/,"Sallanarak serinlemeye yarayan, açılıp kapanan araç. Sayfaların hızla çevrilişini anlatan bir benzetmede de kullanılır."],[/^alçakgönüllü/,"Kendini başkalarından üstün görmeyen; mütevazı."],[/^öğü[tdğ]/,"Birine iyiliği için verilen akıl, nasihat. Öz Türkçe bir kelimedir."],[/^şük[ür]r?/,"Bir iyiliğe karşı duyulan ve dile getirilen minnet. Arapça kökenli."],[/^çığ(?!lı)/,"Dağdan kopup yuvarlandıkça büyüyen kar kütlesi."],[/^tereddü[tdü]/,"Kararsızlık, duraksama. Arapça kökenli."],[/^nüsha/,"Bir kitabın ya da yazının kopyalarından her biri. Arapça kökenli."],[/^sararm|^sarard|^sarart/,"Sararmak: rengi solup sarıya dönmek. Eski kâğıt ışık ve havayla zamanla sararır."],[/^dokunaklı/,"İnsanın duygularını harekete geçiren, içe işleyen."],[/^kuşa[kğ]/,"Aynı dönemde doğup yaşamış insanların bütünü; nesil."],[/^itiraf/,"Gizlenen ya da söylenmesi zor bir şeyi açıkça söyleme. Arapça kökenli."],[/^fosforlu/,"Işık altında parlak görünen. Burada metnin üstünü boyamaya yarayan parlak renkli kalem."],[/^moment/,"Bir kuvvetin bir noktaya göre döndürme etkisi: kuvvet çarpı dik uzaklık. Gündelik dilde «an» anlamına da gelir."],[/^mesnet/,"Bir yapıyı taşıyan ve hareketini sınırlayan dayanak. Arapça «dayanılan yer» anlamındaki kökten."],[/^kiri[şs]/,"Yükü taşıyıp mesnetlere aktaran, boyu kesitine göre çok uzun yapı elemanı."],[/^ple[kx]sus/,"Sinirlerin ya da damarların birleşip yeniden dallandığı ağ. Latince «örgü»."],[/^bileşke/,"Birkaç şeyin birleşmesinden çıkan sonuç. Matematikte fonksiyonların art arda uygulanması, fizikte kuvvetlerin toplamı."],[/^teğe[tdğ]/,"Bir eğriye bir noktada dokunan ve orada eğriyle aynı yönde ilerleyen doğru."]],Ga=[[/^melanchol/,"A lasting, deep sadness. It comes from the old medical theory of black bile: Greek melas “black” and kholē “bile”."],[/^derivativ/,"The instantaneous rate at which one quantity changes with respect to another. In everyday use it also means “something that comes from something else”."],[/^memor/,"The ability to keep what you have lived through and recall it when needed. From Latin memoria, from memor “mindful”."],[/^paper/,"A thin sheet made from plant fibers, used for writing on. From Latin papyrus, the reed the Egyptians wrote on."],[/^bookseller|^bookshop|^secondhand/,"Someone who buys and sells old and secondhand books, or their shop."],[/^typesett|^compositor/,"In a print shop, the person who sets letters and lines ready for printing."],[/^printer/,"Someone who runs a print shop or works in one."],[/^printing|^press(?:es)?$/,"The printing press: the machine, or the shop, where books and newspapers are printed."],[/^marginal|^margin/,"Marginalia: notes and comments written in the margins of a text. From Latin margo “edge”."],[/^ink(?!l)/,"Colored liquid used for writing and printing. From Old French enque, from Latin encaustum, a purple ink."],[/^calligraph/,"The art of beautiful handwriting. From Greek kallos “beauty” and graphein “to write”."],[/^fan(?:s|ned|ning)?$/,"A device you wave to cool yourself, which opens and closes. Also used in an image for pages flicked through quickly."],[/^humbl/,"Not thinking of yourself as better than others; modest."],[/^advi[cs]/,"A suggestion given to someone for their own good."],[/^gratitud|^grateful/,"Thankfulness felt and expressed for a kindness. From Latin gratus “pleasing, thankful”."],[/^avalanch/,"A mass of snow that breaks loose from a mountain and grows as it rolls down."],[/^hesita/,"Indecision; a pause before acting."],[/^cop(?:y|ies)$/,"One of the reproductions of a book or text."],[/^yellow/,"Yellowed: faded to a yellow color. Old paper yellows over time with light and air."],[/^touching|^moving/,"Something that stirs the feelings and goes straight to the heart."],[/^generation/,"All the people born and living at about the same time."],[/^confess/,"Saying openly something hidden or hard to say. From Latin confiteri “to acknowledge”."],[/^highlighter/,"A bright felt-tip pen used to color over text."],[/^moment/,"The turning effect of a force about a point: force times perpendicular distance. In everyday use it also means “an instant”."],[/^support/,"In a structure, the point that carries it and restrains its movement."],[/^beam/,"A long structural member that carries loads and passes them to its supports."],[/^ple[kx]us/,"A network where nerves or vessels join and branch again. Latin for “braid”."],[/^composit/,"Made by combining several things. In math, a composite function applies functions one after another; in physics, a resultant is the sum of forces."],[/^tangent/,"A line that touches a curve at one point and runs in the same direction as the curve there."]];function ue(e,a){const t=String(e||"").trim().toLocaleLowerCase(E).replace(/[’'].*$/,""),i=(_?Ga:Ya).find(([n])=>n.test(t));return i?i[1]:_?`Demo mode has no ready meaning for “${String(e||"").trim()}”.${a?" Guess it from the sentence it appears in, or choose":" Choose"} a provider in Settings for a real answer.`:`«${String(e||"").trim()}» için deneme modunda hazır bir anlam yok.${a?" Geçtiği cümleden tahmin et;":""} gerçek cevap için Ayarlar'dan bir sağlayıcı seç.`}function Ha({hazir:e,gorsel:a,kelime:t,soru:i="",kaynak:n={},serbest:d=!1}){if(e==="anlam")return ue(t,n.baglam);const l=d&&/ne anlama gel|anlamı ne|ne demek|what does .* mean|meaning of/i.test(i)&&String(i).match(/["“«]([^"”»]{1,40})["”»]/);if(l)return _?`“${l[1]}”: ${ue(l[1],n.metin)}`:`«${l[1]}»: ${ue(l[1],n.metin)}`;const m=Me(n);if(_){const v=d?"Demo mode can't read the question you typed. ":"";if(m==="edebi")return(v&&`${v}Here is a ready explanation of the passage you selected:
`)+qa(d?"acikla":e,n.metin);if(m==="genel")return Ve(d?"acikla":e,n);const c=Ie[m];if(d)return`${v}Here is a ready explanation of ${Ba[m]||m}:
${c.acikla}`;const p=a&&e==="ozetle"?"ozetle-gorsel":e;return c[p]||c[Le[p]]||Ie[Ke[m]]?.[p]||c.acikla}const u=d?"Deneme modu yazdığın soruyu okuyamaz; ":"";if(m==="edebi")return(u&&`${u}seçtiğin parça üzerine hazır açıklama:
`)+Ka(d?"acikla":e,n.metin);if(m==="genel")return Ve(d?"acikla":e,n);const h=Ee[m],y=Na[m]||m;if(d)return`${u}${y} üzerine hazır anlatım:
${h.acikla}`;const b=a&&e==="ozetle"?"ozetle-gorsel":e;return h[b]||h[Le[b]]||Ee[Ke[m]]?.[b]||h.acikla}function qe(e){return[r("Sen {uygulama} uygulamasının çalışma asistanısın ve bir öğrenciye yardım ediyorsun.",{uygulama:ee}),r("Her zaman Türkçe cevap ver. Kısa ve net ol; giriş ve kapanış cümlesi kurma."),r("Matematikte adım adım git ve her matematiksel ifadeyi $...$ içine yaz. Liste gerekiyorsa satırı 1. ya da - ile başlat. Başlık ve tablo kullanma."),r("Ekte görsel varsa önce görseldeki ifadeyi ya da soruyu oku, cevabı ona göre kur."),r("Emin olmadığın yerde bunu açıkça söyle."),e.belgeAd?e.sayfa?r('Bağlam: öğrenci "{belge}" belgesinde, {sayfa}. sayfada çalışıyor.',{belge:e.belgeAd,sayfa:e.sayfa}):r('Bağlam: öğrenci "{belge}" belgesinde çalışıyor.',{belge:e.belgeAd}):""].filter(Boolean).join(`
`)}const Fe=e=>e.belgeAd?e.sayfa?r("Kaynak: {belge}, s. {sayfa}",{belge:e.belgeAd,sayfa:e.sayfa}):r("Kaynak: {belge}",{belge:e.belgeAd}):"";function Re(e,a,t=1/0){let i=String(e.metin||"").trim();i.length>t&&(i=i.slice(0,Math.max(i.lastIndexOf(" ",t),t*.8)).trim()+" …");const n=[Fe(e)];return i&&n.push(`${e.gorsel?r("Sayfanın metni"):r("Alıntı")}:
"""
${i}
"""`),e.baglam&&e.baglam!==e.metin&&n.push(r('Geçtiği cümle: "{cumle}"',{cumle:e.baglam})),e.gorsel&&n.push(r("Ekteki görsele bak: sayfadan kırptığım bölge.")),n.push(r("Soru: {soru}",{soru:a})),n.filter(Boolean).join(`

`)}const ja=(e,a)=>Re(e,a),Wa=e=>r("Türkçe, kısa ve net cevap ver.")+(Me(e)==="edebi"?"":" "+r("Matematikte adım adım git, formülleri $...$ içinde yaz.")),Pa=e=>`${Wa(o.kaynak)}

${Re(o.kaynak,e,1500)}`;function Oe({kelime:e,baglam:a,belgeAd:t,sayfa:i}){return[Fe({belgeAd:t,sayfa:i}),r("Kelime: «{kelime}»",{kelime:String(e||"").trim()}),a?r('Geçtiği cümle: "{cumle}"',{cumle:a}):"",r("Soru: {soru}",{soru:ve[2]})].filter(Boolean).join(`

`)}function Ye(){const e=s.soru.value.trim();return[(o.hazir&&O(o.hazir,!!o.kaynak.gorsel))?.[2],e].filter(Boolean).join(`
`)}function Ua(){s={},s.baslik=$("h2",{class:"t-b2",id:"as-baslik"},r("Asistan")),s.pulLamba=$("span",{class:"lamba"}),s.pulAd=$("span",{class:"ad"}),s.pulModel=$("span",{class:"model"}),s.pul=$("span",{class:"cam cam-k as-pul"},s.pulLamba,s.pulAd,s.pulModel),s.kapat=$("button",{type:"button",class:"ikon-dugme","aria-label":r("Asistanı kapat"),onclick:()=>Z()},w("kapat")),s.tutamak=$("div",{class:"asistan-tutamak",role:"button",tabindex:"0","aria-label":r("Asistanı büyüt")}),s.iz=izOlustur(),s.izNot=s.iz.querySelector(".iz-not"),s.kaynak=$("section",{class:"as-kaynak","aria-label":r("Kaynak")}),s.hazir=$("div",{class:"as-hazir",role:"group","aria-label":r("Hazır sorular")}),s.akis=$("div",{class:"as-akis"}),s.govde=$("div",{class:"asistan-govde"},s.kaynak,s.hazir,s.akis),s.soru=$("textarea",{rows:"1",enterkeyhint:"send","aria-label":r("Soru")}),s.gonder=$("button",{type:"button",class:"ikon-dugme gonder","aria-label":r("Gönder"),disabled:!0},w("gonder")),s.uygulamaSec=$("div",{class:"as-uygulamalar",role:"radiogroup","aria-label":r("Uygulama")}),s.hesapDugme=$("button",{type:"button",class:"birincil"}),s.hesapSatir=$("div",{class:"hesap-sor"},s.uygulamaSec,s.hesapDugme),s.alt=$("div",{class:"as-alt"},s.soru,s.gonder,s.hesapSatir),s.canli=$("div",{class:"as-sr","aria-live":"polite"}),s.el=$("aside",{class:"asistan",role:"dialog","aria-modal":"false","aria-labelledby":"as-baslik",tabindex:"-1"},s.tutamak,$("header",{class:"asistan-ust"},s.baslik,s.pul,s.kapat),s.iz,s.govde,s.alt,s.canli),s.soru.addEventListener("input",M),s.soru.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&(e.preventDefault(),He())}),s.gonder.addEventListener("click",He),s.hesapDugme.addEventListener("click",()=>aa());for(const e of S){const a=$("button",{type:"button",class:"element kucuk",role:"radio","aria-label":e.ad,dataset:{id:e.id}},$("b",{},pa[e.id]||e.ad.slice(0,2)),$("small",{},e.ad));a.addEventListener("click",()=>je(e.id)),s.uygulamaSec.append(a)}s.uygulamaSec.addEventListener("keydown",e=>{const a={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(!a)return;e.preventDefault();const t=S.findIndex(n=>n.id===I().id),i=S[(t+a+S.length)%S.length];je(i.id),s.uygulamaSec.querySelector(`[data-id="${i.id}"]`)?.focus()}),Za(),document.body.append(s.el)}function U(){o.acik||(o.acik=!0,o.oncekiOdak=document.activeElement,K(),s.el.classList.add("acik"),me(),G(),requestAnimationFrame(()=>s.el.focus({preventScroll:!0})),z.emit("asistan:acik",!0))}function Z(){o.acik&&(o.acik=!1,s.el.classList.remove("acik"),s.el.style.transform="",me(),G(),s.el.contains(document.activeElement)&&o.oncekiOdak?.focus?.({preventScroll:!0}),z.emit("asistan:acik",!1),Ge())}const J=matchMedia("(max-width: 699px), (max-width: 999px) and (orientation: portrait)");function K(e=matchMedia("(max-width: 599px)").matches?"tam":"yarim"){J.matches?s.el.dataset.durak=e:delete s.el.dataset.durak,s.tutamak.setAttribute("aria-label",s.el.dataset.durak==="tam"?r("Asistanı küçült"):r("Asistanı büyüt"))}function me(){const e=document.documentElement.style;o.acik&&!J.matches?e.setProperty("--sag-panel",`${s.el.offsetWidth||400}px`):e.removeProperty("--sag-panel")}function Ge(){o.acik||o.durum!=="bekleme"||!o.bekleme||g(r("Cevap {yer} bekleniyor.",{yer:Y(o.bekleme.uygulama)}),{etiket:r("Cevabı getir"),calistir:()=>{U(),ia()}})}function Za(){const e=()=>{K(s.el.dataset.durak==="tam"?"yarim":"tam")};s.tutamak.addEventListener("keydown",a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),e())}),s.tutamak.addEventListener("pointerdown",a=>{if(a.button>0||!J.matches)return;const t=a.clientY,i=performance.now(),n=new DOMMatrixReadOnly(getComputedStyle(s.el).transform).m42||0;let d=0,l=[[i,t]];try{s.tutamak.setPointerCapture(a.pointerId)}catch{}s.el.style.transition="none";const m=h=>{d=h.clientY-t;const y=n+d;s.el.style.transform=`translateY(${y<0?y*.35:y}px)`,l.push([performance.now(),h.clientY]),l.length>6&&l.shift()},u=()=>{s.tutamak.removeEventListener("pointermove",m),s.tutamak.removeEventListener("pointerup",u),s.tutamak.removeEventListener("pointercancel",u),s.el.style.transition="",s.el.style.transform="";const h=l.find(c=>performance.now()-c[0]<=80)||l[0],y=l[l.length-1],b=y[0]>h[0]?(y[1]-h[1])/(y[0]-h[0]):0;if(Math.abs(d)<6&&performance.now()-i<300){e();return}const v=s.el.dataset.durak==="tam";if(b>.5||d>s.el.offsetHeight*.22){v&&d<s.el.offsetHeight*.45?K("yarim"):Z();return}(b<-.5||d<-40)&&K("tam")};s.tutamak.addEventListener("pointermove",m),s.tutamak.addEventListener("pointerup",u),s.tutamak.addEventListener("pointercancel",u)})}function T(){let e="",a="",t="",i="";if(x()==="hesap"){const n=I();a=r("{ad} · Hesap",{ad:n.ad}),i=r("{ad}, hesabınla",{ad:n.ad})}else{const n=N();n.id==="deneme"?(e="deneme",a=r("Deneme"),i=r("Deneme, çevrimdışı hazır cevaplar")):n.anahtar?(e=o.dogrulandi.has(n.id)||!o.reddedildi.has(n.id)&&C().denemeler?.[n.id]?.tamam?"bagli":"denenmedi",a=`${n.ad} ·`,t=n.model,i=e==="bagli"?r("{ad}, {model}, bağlı",{ad:n.ad,model:n.model}):r("{ad}, {model}, henüz denenmedi",{ad:n.ad,model:n.model})):(a=r("{ad} · Anahtar yok",{ad:n.ad}),i=r("{ad}, anahtar girilmemiş",{ad:n.ad}))}o.pulHata!=null&&(e=o.pulHata),e?s.pulLamba.dataset.durum=e:delete s.pulLamba.dataset.durum,s.pulAd.textContent=a,s.pulModel.textContent=t,s.pulModel.hidden=!t,s.pul.setAttribute("aria-label",r("Sağlayıcı: {etiket}",{etiket:i})),s.pul.title=i}function ye(){const e=o.kaynak;if(s.kaynak.replaceChildren(),s.kaynak.hidden=!e.metin&&!e.gorsel&&!e.belgeAd,s.kaynak.hidden)return;const a=wa(e),t=$("button",{type:"button",class:"as-etiket"},$("span",{class:"etiket-sayfa"},r("Kaynak")),$("span",{},a||r("Seçim")));if(s.kaynak.append(t),e.metin){const i=$("blockquote",{class:"as-alinti"},`“${e.metin.trim().replace(/([′″\p{L}\d])(?=[(\[])/gu,"$1⁠")}”`);t.setAttribute("aria-expanded","false"),t.setAttribute("aria-label",r("Kaynak: {satir}. Alıntının tamamını göster",{satir:a})),t.addEventListener("click",()=>{const n=i.classList.toggle("tamami");t.setAttribute("aria-expanded",String(n))}),i.addEventListener("click",()=>t.click()),s.kaynak.append(i)}else t.disabled=!0;if(e.gorsel){const i=$("figcaption",{},r("KIRPINTI")),n=$("img",{src:e.gorsel,alt:a?r("Kırpılan bölge, {satir}",{satir:a}):r("Kırpılan bölge")});n.addEventListener("load",()=>{i.textContent=r("KIRPINTI · {g}×{y}",{g:n.naturalWidth,y:n.naturalHeight})},{once:!0}),s.kaynak.append($("figure",{class:"as-gorsel"},n,i))}}function D(){const e=o.kaynak.gorsel?ie:te,a=[...e];if(o.hazir&&!e.some(t=>t[0]===o.hazir)){const t=O(o.hazir);t&&a.unshift(t)}s.hazir.replaceChildren(...a.map(([t,i])=>{const n=$("button",{type:"button",class:"cip","aria-pressed":String(o.hazir===t)},i);return n.addEventListener("click",()=>Ja(t)),n}))}function Ja(e){if(x()==="hesap"){o.hazir=o.hazir===e?null:e,D(),M();return}o.hazir=e,D(),q(O(e,!!o.kaynak.gorsel)[2],{hazir:e})}function B(){const e=x()==="hesap";if(s.el.dataset.yol=e?"hesap":"anahtar",s.alt.hidden=o.durum==="anahtarsiz",s.hazir.hidden=o.durum==="anahtarsiz",s.gonder.hidden=e,s.hesapSatir.hidden=!e,s.soru.placeholder=e?r("Sorunu yaz ya da yukarıdan seç"):o.turlar.length?r("Takip sorusu yaz"):r("Sorunu yaz ya da yukarıdan seç"),e){const a=I();for(const n of s.uygulamaSec.children){const d=n.dataset.id===a.id;n.setAttribute("aria-checked",String(d)),n.tabIndex=d?0:-1}const t=!!(o.dosya&&navigator.canShare?.({files:[o.dosya]})),i=o.durum==="bekleme";s.hesapDugme.className=i?"metin-dugme":"birincil",s.hesapDugme.replaceChildren(w(t?"paylas":"disa-aktar"),$("span",{},i?r("Yeniden gönder"):r("{yer} sor",{yer:Y(a),uyg:a.ad})))}M()}function M(){const e=!!o.iptal;if(x()==="hesap"){s.hesapDugme.disabled=!Ye();return}s.gonder.disabled=!e&&!s.soru.value.trim(),s.gonder.setAttribute("aria-label",e?r("Durdur"):r("Gönder")),s.gonder.classList.toggle("durdur",e),s.gonder.replaceChildren(e?$("span",{class:"as-dur-kare","aria-hidden":"true"}):w("gonder"))}function He(){if(x()==="hesap")return aa();if(o.iptal){he();return}const e=s.soru.value.trim();e&&(s.soru.value="",q(e))}function je(e){fe({yz:{...C(),uygulama:e}})}function he(){o.iptal?.abort()}function V(){s.akis.querySelectorAll(".as-bos, .as-hata, .as-bekleme").forEach(e=>e.remove()),o.pulHata=null}async function q(e,{hazir:a=null}={}){if(x()==="hesap")return;const t=N();if(t.id!=="deneme"&&!t.anahtar)return o.bekleyenSoru={soru:e,hazir:a},Xe();if(!await xe(t.id,t.ad)){!a&&!s.soru.value.trim()&&(s.soru.value=e,M()),g(r("Gönderilmedi."));return}he(),V(),o.durum="hazir";const i=o.turlar.some(y=>y.durum==="bitti"),n={soru:e,hazir:a,cevap:"",durum:"akiyor",saglayici:t.id,saglayiciAd:t.ad,model:t.model,istem:i?e:ja(o.kaynak,e),gorsel:i?null:o.kaynak.gorsel||null,soruGoster:!(a&&o.turlar.length===0),baslangic:performance.now(),duyurulan:0},d=o.turlar.filter(y=>y.durum==="bitti").flatMap(y=>[{rol:"user",metin:y.istem,gorsel:y.gorsel},{rol:"assistant",metin:y.cevap}]);We(n);const l=[...d,{rol:"user",metin:n.istem,gorsel:n.gorsel}],m=new AbortController;o.iptal=m,A("dusunuyor",""),M(),T();let u=0;const h=()=>{clearTimeout(u),u=setTimeout(()=>{o.izDurum==="akiyor"&&A("dusunuyor")},600)};try{if(await Ne[t.id]({sistem:qe(o.kaynak),mesajlar:l,model:t.model,anahtar:t.anahtar,signal:m.signal,hazir:a,gorsel:!!o.kaynak.gorsel,soru:e,kelime:o.kaynak.metin,kaynak:o.kaynak},y=>{!y||m.signal.aborted||(n.cevap+=y,o.izDurum!=="akiyor"&&A("akiyor"),h(),Qa(n),Ue(n))}),!n.cevap.trim())throw new k("ret");n.durum="bitti",t.id!=="deneme"&&(o.dogrulandi.add(t.id),o.reddedildi.delete(t.id)),ke(n)}catch(y){y?.name==="AbortError"?(n.durum="durdu",ke(n,{durdu:!0,iz:o.iptal===m})):et(y instanceof k?y:new k("sunucu",r("HATA")),n)}finally{clearTimeout(u),o.iptal===m&&(o.iptal=null),B(),T()}}function We(e){e.cevapEl=$("div",{class:"as-cevap","aria-busy":"true"},$("span",{class:"imlec","aria-hidden":"true"})),e.kayitEl=$("div",{class:"as-kayit"}),e.altEl=$("div",{class:"as-tur-alt"}),e.el=$("article",{class:"as-tur","aria-label":r("Cevap")},e.soruGoster?$("div",{class:"as-soru"},$("span",{class:"t-daktilo"},r("Soru")),$("p",{},e.soru)):null,e.cevapEl,e.kayitEl,e.altEl),o.turlar.push(e),s.akis.append(e.el),e.el.scrollIntoView({block:"nearest"})}function Qa(e){e.cizimBekliyor||(e.cizimBekliyor=!0,requestAnimationFrame(()=>{e.cizimBekliyor=!1,Pe(e,e.durum==="akiyor")}))}function Pe(e,a){const t=s.govde,i=t.scrollHeight-t.scrollTop-t.clientHeight<48;if(e.cevapEl.innerHTML=Sa(e.cevap),da(e.cevapEl),a){let n=e.cevapEl.lastElementChild||e.cevapEl;/^(OL|UL)$/.test(n.tagName)&&(n=n.lastElementChild||n),n.append($("span",{class:"imlec","aria-hidden":"true"}))}if(i){const n=t.scrollHeight-t.clientHeight,d=t.getBoundingClientRect().top-t.scrollTop,l=h=>h.getBoundingClientRect().top-d-12,m=l(e.el);let u=n;if(n<m){const h=[0,...[s.kaynak.querySelector(".as-alinti"),s.hazir,...o.turlar.map(y=>y.el)].filter(y=>y&&!y.hidden&&y.offsetHeight).map(l)];u=Math.max(...h.filter(y=>y<=n))}u>t.scrollTop&&(t.scrollTop=u)}}function Ue(e,a=!1){const t=e.cevap,i=a?t.length:Math.max(...[". ",`.
`,"? ","! ",`:
`].map(n=>t.lastIndexOf(n)))+1;if(i>e.duyurulan){const n=_a(t.slice(e.duyurulan,i)).trim();e.duyurulan=i,n&&(s.canli.textContent=n)}}function ke(e,{durdu:a=!1,hesap:t=null,iz:i=!0}={}){Pe(e,!1),e.cevapEl.removeAttribute("aria-busy"),Ue(e,!0);const n=(performance.now()-e.baslangic)/1e3;i&&A("bitti","");const d=t?null:$("span",{class:"cam cam-k soluk as-olcu"},r("{sn} sn · {n} kelime",{sn:xa(n),n:ga(e.cevap)})),l=new Date;if(a)d&&e.kayitEl.replaceChildren(d);else{const m=t?r("Kayıt · {ad} · {saat}",{ad:we(t.ad),saat:Ae(l)}):r("Kayıt · {tarih} · {saat}",{tarih:va(l),saat:Ae(l)});e.kayitEl.replaceChildren($("span",{class:"damga"},m),d)}a?e.altEl.append($("p",{class:"as-not"},r("Durduruldu."))):e.saglayici==="deneme"&&e.altEl.append($("p",{class:"as-not"},r("Bu hazır bir örnek cevaptır."))),!a&&e.hazir==="anlam"&&e.altEl.append(...Ze()),e.cevap.trim()&&e.altEl.append(Xa(e))}function Ze(){const e=o.kaynak,a=String(e.metin||"").trim();if(!a||a.length>120)return[];const t=L(e.belgeId)?.dil||(_?"en":"tr");return[$a({metin:a,dil:t,sinif:"as-disari"})]}function Je({belgeId:e,sayfa:a,metin:t,soru:i,kaynak:n}){z.emit("asistan:not",{belgeId:e,sayfa:a,metin:t,soru:i,kaynak:n||"Asistan",zaman:Date.now()})}function Qe(e,a){const t=L(e)?.ad||"",i=t?a?r("{belge}, s. {sayfa}",{belge:t,sayfa:a}):t:a?r("s. {sayfa}",{sayfa:a}):"";g(i?r("Cevap kenar notu olarak eklendi: {yer}",{yer:i}):r("Cevap kenar notu olarak eklendi."),{etiket:r("Göster"),calistir:()=>z.emit("git",{ekran:"belge",belgeId:e})})}function Xa(e){const a=o.kaynak,t=$("div",{class:"as-eylem"}),i=l=>{t.querySelector(".damga")?.remove(),t.append($("span",{class:"damga",role:"status"},l))},n=(l,m,u,h={})=>{const y=$("button",{type:"button",class:"metin-dugme",...h},w(m),$("span",{},l));return y.addEventListener("click",()=>u(y)),y},d=n(r("Kenara not"),"kenara-not",l=>{Je({belgeId:a.belgeId,sayfa:a.sayfa,metin:e.cevap,soru:e.soru,kaynak:e.saglayiciAd}),l.disabled=!0,i(a.sayfa?r("Kenara eklendi · s. {sayfa}",{sayfa:a.sayfa}):r("Kenara eklendi"))},{disabled:!a.belgeId,title:a.belgeId?null:r("Bu soru bir belgeye bağlı değil")});if(e.kenaraBas=()=>d.disabled?!1:(d.click(),!0),t.append(d,n(r("Karta çevir"),"karta-cevir",l=>{const m=a.metin?a.metin.trim().slice(0,220)+(a.metin.trim().length>220?"…":""):"",u=ra({tur:"soru",on:{metin:m?`${e.soru}
“${m}”`:e.soru,gorsel:e.gorsel||a.gorsel||void 0},arka:{metin:e.cevap},belgeId:a.belgeId,belgeAd:a.belgeAd,sayfa:a.sayfa});l.disabled=!0,i(r("Tekrar'a eklendi · kutu I")),sa(u,{geriAl:()=>{l.disabled=!1,t.querySelector(".damga")?.remove()}})}),n(r("Kopyala"),"kopyala",async()=>{g(await F(e.cevap)?r("Kopyalandı"):r("Kopyalanamadı"))})),e.saglayici!=="deneme"&&e.kayitEl){const l=$("button",{type:"button",class:"ikon-dugme as-bildir",title:r("Bu cevabı bildir"),"aria-label":r("Bu cevabı bildir")},w("bayrak"));l.addEventListener("click",()=>{la({soru:e.soru,cevap:e.cevap,saglayici:e.saglayiciAd,model:e.saglayici==="hesap"?"":e.model,belgeAd:a.belgeAd,sayfa:a.sayfa}),i(r("E-posta hazırlandı; göndermek sana kalmış"))}),e.kayitEl.append(l)}return t}function et(e,a){const t=ze[e.tur]||ze.sunucu;a.durum="hata",(e.tur==="anahtar"||e.tur==="model")&&(o.dogrulandi.delete(a.saglayici),o.reddedildi.add(a.saglayici)),e.tur==="ret"&&(a.cevap=""),a.cevapEl.remove(),a.kayitEl.remove(),o.pulHata=t.lamba===null?null:t.lamba,A("hata","");const i=$("button",{type:"button",class:"metin-dugme vurgulu"},w(t.eylem==="Yeniden dene"?"yeniden":t.eylem==="Ayarları aç"?"ayarlar":"metin"),$("span",{},r(t.eylem)));i.addEventListener("click",()=>{if(t.eylem==="Ayarları aç")return ea();if(a.el.remove(),o.turlar.splice(o.turlar.indexOf(a),1),t.eylem==="Yeniden dene")return q(a.soru,{hazir:a.hazir});A("bekliyor",""),o.pulHata=null,T(),s.soru.value=a.soru,M(),s.soru.focus()});const n=$("div",{class:"as-hata",role:"alert",dataset:{tur:e.tur}},t.lamba===null?$("span"):$("span",{class:"lamba",dataset:t.lamba?{durum:t.lamba}:{}}),e.kod?$("span",{class:"kod"},e.kod):$("span"),$("p",{},t.metin),i);a.altEl.replaceChildren(n)}function Xe(){const e=N();o.durum="anahtarsiz",V(),A("bekliyor","");const a=$("button",{type:"button",class:"birincil"},w("ayarlar"),$("span",{},r("Ayarları aç")));a.addEventListener("click",ea);const t=$("button",{type:"button",class:"metin-dugme"},r("Deneme ile dene"));t.addEventListener("click",()=>fe({yz:{...C(),yol:"anahtar",saglayici:"deneme"}})),s.akis.append($("div",{class:"as-bos"},$("div",{class:"tahta tahta--cerceve"},at()),$("h3",{class:"t-b2"},r("Anahtar girilmemiş.")),$("p",{},r("{ad} için anahtar yok. Hesabınla sormak için Ayarlar'a dön.",{ad:e.ad})),$("div",{class:"as-bos-eylem"},a,t))),B(),T()}function at(){const a=document.createElementNS("http://www.w3.org/2000/svg","svg");return a.setAttribute("class","feynman"),a.setAttribute("viewBox","0 0 160 96"),a.setAttribute("aria-hidden","true"),a.innerHTML=`<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 10 50 48 12 86M148 10 110 48 148 86"/>
    <path d="M50 48q3.75-8 7.5 0t7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0"/>
    <path d="M28 21l3 6-6.5-.5M28 75l-3.5 5.6 6.6-.2M132 21l-3.4 5.8 6.6-.3M132 75l3.2 5.7-6.6-.2"/>
  </g><g fill="currentColor"><circle cx="50" cy="48" r="2.4"/><circle cx="110" cy="48" r="2.4"/></g>`,a}function ea(){z.emit("ayarlar:ac",{bolum:"yz"}),setTimeout(()=>{if(document.querySelector("dialog[open], .yz-pencere"))return;const e=[...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(a=>/Ayarlar|Settings/.test(a.textContent)&&a.getClientRects().length);e?e.click():g(r("Ayarlar kitaplıkta, Yapay zekâ bölümünde."))},60)}async function aa(){const e=Ye();if(!e){s.soru.focus();return}const a=I(),t=Pa(e),i=o.dosya,n=await F(t);let d=!1;if(i&&ge())try{await(await import("./yerel-android.js")).yzPaylas([i],t,a.id)&&(d=!0,g(r("Soru {ad} için gönderildi; cevabı {uygulama}'ye sürükle ya da paylaş.",{ad:a.ad,uygulama:ee})))}catch(l){console.warn("[asistan] yzPaylas",l)}if(!d&&i&&navigator.canShare?.({files:[i]}))try{await navigator.share({text:t,files:[i]}),d=!0}catch(l){if(l?.name==="AbortError"){g(r("Paylaşım iptal edildi."));return}}if(!d){const l=t.length>1800?"":t;window.open(a.url(l),"_blank","noopener");const m=ge()?r("Cevabı {uygulama}'ye sürükle ya da paylaş.",{uygulama:ee}):n?r("Metin kopyalandı, açılan sohbete yapıştır."):r("Metin kopyalanamadı; açılan sohbete soruyu yaz.");i?g(m,{etiket:r("Görüntüyü indir"),calistir:()=>ba(i)}):g(m)}ta(a,t,e)}function ta(e,a,t){V(),o.durum="bekleme",o.bekleme={metin:a,soru:t,uygulama:e,vurgulandi:!1,baslangic:performance.now()},Q(),A("bekliyor",we(_?`In ${e.ad}`:Y(e)));const i=$("button",{type:"button",class:"birincil"},w("yapistir"),$("span",{},r("Cevabı getir")));i.addEventListener("click",ia);const n=$("button",{type:"button",class:"metin-dugme"},r("Metni yeniden kopyala"));n.addEventListener("click",async()=>g(await F(a)?r("Metin kopyalandı."):r("Kopyalanamadı"))),s.getir=i,s.yapistirKap=$("div",{class:"as-yapistir-kap",hidden:!0});const d=$("div",{class:"as-bekleme kareli",role:"status"},$("h3",{},r("Cevap {yer}.",{yer:Y(e)})),$("p",{},r("Bitince cevabı kopyala ve buraya dön.")),$("div",{class:"eylemler"},i,n),s.yapistirKap);s.akis.append(d),d.scrollIntoView({block:"nearest"}),B(),T()}const ce="kn-tasarim:asistan-bekleme";function Q(){tt();try{if(!o.bekleme){sessionStorage.removeItem(ce);return}const{gorsel:e,...a}=o.kaynak||{},t=o.bekleme;sessionStorage.setItem(ce,JSON.stringify({metin:t.metin,soru:t.soru,uygulama:t.uygulama?.id,hazir:o.hazir,kaynak:a}))}catch{}}function tt(){try{const e=o.bekleme,a=e&&ya({kaynak:o.kaynak,soru:e.soru,istem:e.metin,uygulama:e.uygulama?.id});a?localStorage.setItem(R,JSON.stringify(a)):localStorage.removeItem(R)}catch{}}function it(){try{return JSON.parse(localStorage.getItem(R)||"null")}catch{return null}}function nt(){let e=null;try{e=JSON.parse(sessionStorage.getItem(ce)||"null")}catch{e=null}if(!e||typeof e.metin!="string"||x()!=="hesap")return;const a=S.find(t=>t.id===e.uygulama)||I();o.kaynak=e.kaynak&&typeof e.kaynak=="object"?e.kaynak:{},o.hazir=e.hazir||null,ye(),D(),ta(a,e.metin,e.soru),U()}async function ia(){const e=o.bekleme;if(!e)return;let a=null;try{navigator.clipboard?.readText&&(a=await navigator.clipboard.readText())}catch{a=null}const t=a?.trim();if(t&&t!==e.metin.trim())return pe(t);t&&g(r("Panoda hâlâ soru metni var. Cevabı kopyalayıp yeniden dene.")),rt()}function rt(){const e=s.yapistirKap;if(!e||!e.hidden){e?.querySelector("textarea")?.focus();return}const a=$("textarea",{class:"as-yapistir",placeholder:r("Cevabı buraya yapıştır"),"aria-label":r("Cevap")}),t=$("button",{type:"button",class:"metin-dugme vurgulu",disabled:!0},w("tik"),$("span",{},r("Ekle")));a.addEventListener("input",()=>{t.disabled=!a.value.trim()}),t.addEventListener("click",()=>a.value.trim()&&pe(a.value.trim())),e.replaceChildren(a,$("div",{class:"eylemler"},t)),e.hidden=!1,a.focus()}function pe(e,{kenara:a=!0}={}){const t=o.bekleme;s.akis.querySelector(".as-bekleme")?.remove(),o.durum="hazir",o.bekleme=null,Q(),s.getir=null;const i={soru:t.soru,hazir:o.hazir,cevap:e,durum:"bitti",saglayici:"hesap",saglayiciAd:t.uygulama.ad,istem:t.metin,gorsel:null,soruGoster:!0,baslangic:t.baslangic,duyurulan:0};We(i),ke(i,{hesap:t.uygulama}),s.soru.value="",B(),T();const n=o.kaynak||{};a&&n.belgeId&&i.hazir!=="anlam"&&i.kenaraBas?.()&&Qe(n.belgeId,n.sayfa)}function st(e={}){if(e.hazir==="anlam"&&x()==="anahtar"&&!e.panel){lt(e);return}if(e.hazir==="anlam"&&x()==="hesap"&&e.panel===!1){ot(e);return}if(he(),o.durum==="bekleme"&&o.bekleme&&g(r("Önceki sorunun bekleyen cevabı bırakıldı.")),o.kaynak={...e},o.dosya=e.gorsel?fa(e.gorsel):null,o.turlar=[],o.hazir=e.hazir||null,o.durum="hazir",o.bekleme=null,Q(),o.bekleyenSoru=null,o.pulHata=null,s.akis.replaceChildren(),s.soru.value="",A("bekliyor",""),ye(),D(),B(),T(),s.govde.scrollTop=0,U(),x()==="hesap"){e.soru&&(s.soru.value=e.soru,M()),e.hazir==="anlam"&&s.akis.append(...Ze());return}const a=e.soru||e.hazir&&O(e.hazir,!!e.gorsel)?.[2];if(a)q(a,{hazir:e.hazir||null});else{const t=N();t.id!=="deneme"&&!t.anahtar&&Xe()}}function ot(e){const a=I(),t=`${r("Türkçe, kısa ve net cevap ver.")}

${Oe({kelime:e.metin,baglam:e.baglam,belgeAd:e.belgeAd,sayfa:e.sayfa})}`;F(t).then(i=>g(i?r("Soru kopyalandı. Cevabı kopyalayıp buraya dön."):r("Açılan sohbete soruyu yaz."))),window.open(a.url(t.length>1800?"":t),"_blank","noopener")}export async function anlamGetir({kelime:e,baglam:a="",belgeAd:t,sayfa:i,signal:n}={},d){const l=N();if(l.id!=="deneme"&&!l.anahtar)throw new k("anahtar",r("ANAHTAR YOK"));if(!await xe(l.id,l.ad))throw new k("onay",r("GÖNDERİLMEDİ"));const m={belgeAd:t,sayfa:i},u=Oe({kelime:e,baglam:a,belgeAd:t,sayfa:i});let h="";return await Ne[l.id]({sistem:qe(m),mesajlar:[{rol:"user",metin:u}],model:l.model,anahtar:l.anahtar,signal:n,hazir:"anlam",kelime:e,kaynak:{belgeAd:t,sayfa:i,baglam:a}},y=>{h+=y,d?.(y,h)}),l.id!=="deneme"&&o.dogrulandi.add(l.id),h.trim()}function lt(e){const a=String(e.metin||"").trim(),t=(i,n={})=>z.emit("asistan:anlam",{kelime:a,belgeId:e.belgeId,sayfa:e.sayfa,durum:i,...n});t("dusunuyor"),anlamGetir({kelime:a,baglam:e.baglam,belgeAd:e.belgeAd,sayfa:e.sayfa,signal:e.signal},(i,n)=>{t("akiyor",{parca:i,metin:n}),e.parca?.(i,n)}).then(i=>{t("bitti",{metin:i,deneme:N().id==="deneme"}),e.bitti?.(i)}).catch(i=>{if(i?.name==="AbortError")return;const n={tur:i?.tur||"sunucu",kod:i?.kod||"",mesaj:i?.tur==="onay"?r("Gönderilmedi."):r("Anlam getirilemedi.")};t("hata",{hata:n}),e.hata?.(n)})}const dt={gemini:(e,a)=>[`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e)}`,{headers:{"x-goog-api-key":a}}],claude:(e,a)=>["https://api.anthropic.com/v1/messages/count_tokens",{method:"POST",headers:{"x-api-key":a,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model:e,messages:[{role:"user",content:"deneme"}]})}],openai:(e,a)=>[`https://api.openai.com/v1/models/${encodeURIComponent(e)}`,{headers:{Authorization:`Bearer ${a}`}}]};export async function baglantiDene(e){const a=N(e);if(a.id!==e)return{tamam:!1,mesaj:r("BİLİNMEYEN"),tur:"istek"};if(a.id==="deneme")return await ne(260),{tamam:!0,ok:!0,mesaj:r("DENEME · HAZIR"),tur:"deneme",ms:0};if(!a.anahtar)return{tamam:!1,mesaj:r("ANAHTAR YOK"),tur:"anahtar-yok",durum:"anahtar-yok"};const t=new AbortController,i=setTimeout(()=>t.abort(),15e3),n=performance.now();try{const[d,l]=dt[a.id](a.model,a.anahtar);await W(d,{...l,signal:t.signal});const m=Math.round(performance.now()-n);return o.dogrulandi.add(a.id),o.reddedildi.delete(a.id),{tamam:!0,ok:!0,mesaj:r("BAĞLI · {ms} ms",{ms:m}),tur:"bagli",ms:m}}catch(d){if(o.dogrulandi.delete(a.id),d?.name==="AbortError")return{tamam:!1,mesaj:r("ZAMAN AŞIMI"),tur:"ag",durum:"ag"};const l=d?.kod||r("AĞ YOK"),m=parseInt(l,10);return(d?.tur==="anahtar"||d?.tur==="model")&&o.reddedildi.add(a.id),{tamam:!1,mesaj:l,tur:d?.tur||"ag",durum:d?.tur==="ag"?"ag":Number.isFinite(m)?m:l}}finally{clearTimeout(i),s&&T()}}function $t(){return document.querySelector("dialog[open]")?!0:[...document.querySelectorAll(".perde, .anlam-fis, .cekmece-perde, .fis-sabit")].some(e=>e.getClientRects().length)}export function kur(){o.kuruldu||(o.kuruldu=!0,Ua(),ye(),D(),B(),T(),nt(),z.on("sor",st),z.on("asistan:kapat",Z),z.on("asistan:gelen",e=>{const a=String(e?.metin||"").trim();if(!a)return;if(o.durum==="bekleme"&&o.bekleme){if(ua(a,o.bekleme.metin))return;e.alindi=!0,pe(a),U();return}if(e.yalnizBekleyen)return;const t=ha(it(),{belgeVar:i=>!!L(i)});if(!(!t||!ma(a,t.istem))){e.alindi=!0,Je({belgeId:t.belgeId,sayfa:t.sayfa,metin:a,soru:t.soru,kaynak:S.find(i=>i.id===t.uygulama)?.ad});try{localStorage.removeItem(R)}catch{}Qe(t.belgeId,t.sayfa)}}),z.on("ayarlar",()=>{if(o.durum==="anahtarsiz"){const e=N();if(x()==="hesap"||e.id==="deneme"||e.anahtar){o.durum="hazir",V();const a=o.bekleyenSoru;o.bekleyenSoru=null,a&&x()==="anahtar"&&q(a.soru,{hazir:a.hazir})}}o.durum==="bekleme"&&x()==="anahtar"&&(V(),o.durum="hazir",o.bekleme=null,Q(),A("bekliyor","")),B(),T()}),window.addEventListener("keydown",e=>{e.key!=="Escape"||!o.acik||e.defaultPrevented||$t()||(e.preventDefault(),e.stopPropagation(),Z())},!0),J.addEventListener("change",()=>{K(),me()}),document.addEventListener("visibilitychange",()=>{G(),!document.hidden&&o.durum==="bekleme"&&o.bekleme&&!o.bekleme.vurgulandi&&s.getir&&(o.bekleme.vurgulandi=!0,s.getir.classList.add("vurgulu"),Ge())}))}
