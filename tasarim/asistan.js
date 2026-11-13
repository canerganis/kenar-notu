import{h as u,icon as w,bus as v,store as G,toast as A,ayarla as X,kartEkle as Wa,kartEklendiBildir as Ua,panoyaYaz as ee,belgeBul as B,simgeEkle as Za,YZ_UYGULAMALAR as E,YZ_SAGLAYICILAR as Fe,UYGULAMA_ADI as ge,yerelKabukMu as xe,yeniId as Ye,ikiDokunus as He}from"./ortak.js";import{yzOnayi as je,cevapBildir as Ja}from"./izin.js";import*as ve from"./sayfalar.js";import{formulleriCiz as Pe}from"./matematik.js";import{webAraDugmeleri as Qa}from"./iz-bag.js";import{t as o,yerel as I,ingilizceMi as T}from"./dil.js";import{cevapDiliKisa as Xa,ceviriGerekli as et,alintiKisalt as at}from"./cevap-dili.js";import{istemKur as tt,anlamKur as We,tekSoru as H,dilCumlesiKur as it,sistemKur as nt}from"./istem-kur.js";import{BAGLAM_ANAHTARI as ae,soruMetniMi as Ue,yalnizAdresMi as rt,cevapMi as st,baglamYap as ot,baglamUygun as lt,akisTamamMi as dt,sohbetGovdesi as ut}from"./cevap-yeri.js";import{KAPSAMLAR as Ze,sayfaMetni as mt,notlarMetni as $t,kapsamOnizleme as ct,kapsamUygula as kt}from"./asistan-kapsam.js";import{gecmisKaydi as yt,gecmiseEkle as ht,gecmisDuzelt as ze,gecmistenSil as pt,gecmisAcikMi as we}from"./asistan-gecmis.js";import{TUS_SINIR as ft,AD_SINIR as Je,ISTEM_SINIR as Qe,ON_EK as bt,kisiselMi as te,tusDogrula as gt,tuslariDuzelt as xt,tusEkle as vt,tusGuncelle as zt,tusSil as wt}from"./asistan-tuslar.js";import{stilYukle as At}from"./ortak.js";await At("asistan.css"),Za("bayrak",'<path d="M6 21V4"/><path class="d" d="M6 4.5h11.5l-2.6 4.2 2.6 4.3H6"/>');const Ae=[["acikla",o("Açıkla"),o("basitçe açıklar mısın?")],["ozetle",o("Özetle"),o("birkaç cümleyle özetler misin?")],["basitlestir",o("Basitleştir"),o("çok daha basit, günlük dille anlatır mısın?")],["ornek",o("Örnek ver"),o("gerçek hayattan bir örnek verir misin?")],["soru-uret",o("Beni sına"),o("Bu konuda beni sınamak için 3 soru sorar mısın? Cevapları en sonda ver."),"soru"]],ie=[["formul",o("Bunu açıkla"),o("görüntüdeki bu bölümü açıklar mısın?")],["coz",o("Bu soruyu çöz"),o("adım adım çözer misin?")],["adim",o("Adım adım göster"),o("adım adım, her adımın nedenini de yazarak gösterir misin?")],["ozetle",o("Özetle"),o("birkaç cümleyle özetler misin?")]],St=["anlam",o("Anlamı"),o("Bu kelime burada ne demek?"),"soru"],Xe=["cevir",o("Türkçeye çevir"),o("Türkçeye çevirir misin?")],j=()=>xt(G.ayarlar?.asistanTuslari),O=(e,a)=>{if(te(e)){const t=j().find(n=>n.id===e);return t?[t.id,t.ad,t.istem]:null}return(a?ie:Ae).find(t=>t[0]===e)||[...Ae,...ie,St,Xe].find(t=>t[0]===e)||null},Tt={chatgpt:"'de",gemini:"'de",claude:"'da",grok:"'ta"},ne=e=>T?e.ad:`${e.ad}${Tt[e.id]||"'de"}`,ea=e=>e.toLocaleUpperCase(I),aa={anahtar:{lamba:"hata",metin:o("Anahtar kabul edilmedi. Ayarlar'dan kontrol et."),eylem:"Ayarları aç"},model:{lamba:"hata",metin:o("Model adını Ayarlar'dan kontrol et."),eylem:"Ayarları aç"},istek:{lamba:"hata",metin:o("Sağlayıcı isteği kabul etmedi. Model adını ve ayarları kontrol et."),eylem:"Ayarları aç"},sinir:{lamba:"denenmedi",metin:o("Sağlayıcının sınırına ulaşıldı. Biraz sonra yeniden dene."),eylem:"Yeniden dene"},sunucu:{lamba:"denenmedi",metin:o("Sağlayıcı şu an cevap veremiyor. Biraz sonra yeniden dene."),eylem:"Yeniden dene"},ag:{lamba:"",metin:o("Şu an bağlantı yok. Bağlantı gelince yeniden dene; okuma, yazma ve arama internetsiz çalışır."),eylem:"Yeniden dene"},zaman:{lamba:"denenmedi",metin:o("Sağlayıcı 60 saniyedir cevap vermiyor. Bağlantını kontrol edip yeniden dene."),eylem:"Yeniden dene"},ret:{lamba:null,metin:o("Bu soruya cevap verilemedi."),eylem:"Soruyu değiştir"}};class p extends Error{constructor(a,t=""){super(a),this.name="AsistanHatasi",this.tur=a,this.kod=t}}const i={kuruldu:!1,acik:!1,kaynak:{},dosya:null,turlar:[],hazir:null,durum:"hazir",iptal:null,izDurum:"bekliyor",pulHata:null,bekleme:null,kapsam:"secim",kapsamVeri:null,kapsamSoz:null,kapsamSayac:0,gecmisAcik:!1,gecmisAyar:null,gecmisGoster:30,gecmisAcikKayit:new Set,gecmisTam:new Map,tusDuzenAcik:!1,tusDuzenleId:null,bekleyenSoru:null,dogrulandi:new Set,reddedildi:new Set,oncekiOdak:null};let r=null;const K=()=>G.ayarlar.yz||{},z=()=>K().yol==="anahtar"?"anahtar":"hesap",R=()=>E.find(e=>e.id===K().uygulama)||E[0];function D(e=K().saglayici){const a=Fe.find(n=>n.id===e)||Fe[0],t=String(K().modeller?.[a.id]||a.varsayilanModel).trim().replace(/^models\//,"");return{...a,model:t,anahtar:String(K().anahtarlar?.[a.id]||"").trim()}}export function izOlustur(){const e="M0 8Q12.5 2 25 8"+Array.from({length:15},(t,n)=>`T${50+n*25} 8`).join(""),a=u("div",{class:"iz","aria-hidden":"true",dataset:{durum:"bekliyor"}});return a.innerHTML=`<i><svg class="iz-dalga" viewBox="0 0 400 16" preserveAspectRatio="none"><path class="iz-golge" d="${e}"/><path class="iz-cizgi" d="${e}"/></svg></i><span class="iz-not"></span>`,a}function C(e,a){i.izDurum=e,a!==void 0&&(r.izNot.textContent=a),re()}function re(){const e=i.izDurum==="akiyor"||i.izDurum==="dusunuyor";r.iz.dataset.durum=e&&(document.hidden||!i.acik)?"bekliyor":i.izDurum}const Se=(e,a)=>new Promise((t,n)=>{if(a?.aborted)return n(new DOMException("Durduruldu","AbortError"));const s=setTimeout(t,e);a?.addEventListener("abort",()=>{clearTimeout(s),n(new DOMException("Durduruldu","AbortError"))},{once:!0})}),Te=e=>(String(e).match(/^data:([^;,]+)/)||[])[1]||"image/png",Ce=e=>String(e).slice(String(e).indexOf(",")+1);function ta(e,a="kenar-notu-kirpinti.png"){try{const t=atob(Ce(e)),n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);return new File([n],a,{type:Te(e)})}catch{return null}}function Ct(e){const a=URL.createObjectURL(e);u("a",{href:a,download:e.name}).click(),setTimeout(()=>URL.revokeObjectURL(a),4e3)}const _t=e=>e.trim()?e.trim().split(/\s+/).length:0,Nt=(e,a=1)=>e.toLocaleString(I,{maximumFractionDigits:a,minimumFractionDigits:a}),ia=(e=new Date)=>e.toLocaleTimeString(I,{hour:"2-digit",minute:"2-digit"}),Et=(e=new Date)=>e.toLocaleDateString(I,{day:"2-digit",month:"2-digit",year:"numeric"}),Mt=e=>[e.belgeAd,e.sayfa?o("s. {n}",{n:e.sayfa}):""].filter(Boolean).join(" · "),_e=e=>e.replace(/[&<>"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[a]),Bt={"\\cdot":"·","\\times":"×","\\div":"÷","\\pm":"±","\\mp":"∓","\\to":"→","\\rightarrow":"→","\\Rightarrow":"⇒","\\iff":"⇔","\\infty":"∞","\\leq":"≤","\\le":"≤","\\geq":"≥","\\ge":"≥","\\neq":"≠","\\ne":"≠","\\approx":"≈","\\equiv":"≡","\\pi":"π","\\alpha":"α","\\beta":"β","\\gamma":"γ","\\delta":"δ","\\Delta":"Δ","\\theta":"θ","\\lambda":"λ","\\mu":"μ","\\sigma":"σ","\\Sigma":"Σ","\\omega":"ω","\\Omega":"Ω","\\epsilon":"ε","\\varepsilon":"ε","\\rho":"ρ","\\phi":"φ","\\varphi":"φ","\\tau":"τ","\\eta":"η","\\sum":"∑","\\prod":"∏","\\int":"∫","\\oint":"∮","\\partial":"∂","\\nabla":"∇","\\in":"∈","\\notin":"∉","\\subset":"⊂","\\cup":"∪","\\cap":"∩","\\forall":"∀","\\exists":"∃","\\circ":"∘","\\degree":"°","\\cdots":"⋯","\\ldots":"…","\\dots":"…","\\prime":"′","\\lim":"lim","\\sin":"sin","\\cos":"cos","\\tan":"tan","\\cot":"cot","\\ln":"ln","\\log":"log","\\exp":"exp","\\max":"max","\\min":"min","\\left":"","\\right":"","\\quad":" ","\\qquad":"  ","\\displaystyle":""},Ne=e=>/^[\w.,′'√πα-ωΑ-Ω]+$/u.test(e.trim())?e.trim():`(${e.trim()})`;function It(e){let a=e.replace(/\\\{/g,"").replace(/\\\}/g,"");a=a.replace(/\\mathbb\{(\w)\}/g,(t,n)=>({R:"ℝ",N:"ℕ",Z:"ℤ",Q:"ℚ",C:"ℂ"})[n]||n);for(let t=0;t<4;t++)a=a.replace(/\\sqrt\{([^{}]*)\}/g,(n,s)=>`√${Ne(s)}`).replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,(n,s,d)=>`${Ne(s)}/${Ne(d)}`);return a=a.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g,"$1"),a=a.replace(/\\[,;:!]/g," ").replace(/\\[A-Za-z]+/g,t=>Bt[t]??t.slice(1)),a=_e(a.replace(/-/g,"−")),a=a.replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9+\-−′'∞])/g,(t,n,s)=>`<sup>${n??s}</sup>`),a=a.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g,(t,n,s)=>`<sub>${n??s}</sub>`),a=a.replace(/[{}]/g,"").replace(/\u0001/g,"{").replace(/\u0002/g,"}"),a=a.split(/(<[^>]+>|&[a-z]+;)/).map((t,n)=>n%2?t:t.replace(/[0-9]+(?:[.,][0-9]+)?|[()[\]=+−±∓·×÷<>≤≥≠≈→⇒∞∑∏∫√]+/g,s=>`<span class="dik">${s}</span>`)).join(""),`<i class="formul">${a}</i>`}const Kt=(e,a)=>`<span data-tex="${_e(e.trim())}"${a?" data-blok":""}>${It(e)}</span>`,na=e=>_e(e).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,"<code>$1</code>");function se(e){const a=/\$\$([^$]+)\$\$|\$([^$\n]+?)\$|\\\((.+?)\\\)/g;let t=0,n="",s;for(;s=a.exec(e);){if(s[2]!=null&&/^\s|\s$/.test(s[2])){a.lastIndex=s.index+1;continue}n+=na(e.slice(t,s.index))+Kt(s[1]??s[2]??s[3],s[1]!=null),t=a.lastIndex}return n+na(e.slice(t))}function ra(e){const a=e.replace(/\r/g,"").replace(/\\\[([\s\S]*?)\\\]/g,(d,l)=>"$$"+l.replace(/\n/g," ")+"$$").replace(/\$\$\s*\n([\s\S]*?)\n\s*\$\$/g,(d,l)=>"$$"+l.replace(/\n/g," ")+"$$");let t="",n=null;const s=()=>{n&&(t+=`</${n}>`,n=null)};for(const d of a.split(`
`)){const l=d.trim();if(!l){s();continue}let m;if(m=l.match(/^(\d+)[.)]\s+(.*)$/)){n!=="ol"&&(s(),t+=m[1]!=="1"?`<ol start="${+m[1]}">`:"<ol>",n="ol"),t+=`<li>${se(m[2])}</li>`;continue}if(m=l.match(/^[-*•]\s+(.*)$/)){n!=="ul"&&(s(),t+="<ul>",n="ul"),t+=`<li>${se(m[1])}</li>`;continue}s();const $=l.match(/^#{1,6}\s+(.*)$/);t+=$?`<p><b>${se($[1])}</b></p>`:`<p>${se(l)}</p>`}return s(),t}const Dt=e=>e.replace(/\$\$?|\\\(|\\\)|\*\*/g,"");function sa(e){let a="message";const t=[];for(const d of e.split(/\r?\n/)){if(!d||d.startsWith(":"))continue;const l=d.indexOf(":"),m=l<0?d:d.slice(0,l);let $=l<0?"":d.slice(l+1);$.startsWith(" ")&&($=$.slice(1)),m==="event"?a=$:m==="data"&&t.push($)}if(!t.length)return null;const n=t.join(`
`);if(n==="[DONE]")return{bitti:!0};let s=null;try{s=JSON.parse(n)}catch{s=null}return{olay:a,json:s}}async function*oe(e){const a=e.body.pipeThrough(new TextDecoderStream).getReader(),t=la.get(e);let n="";try{for(;;){let d;try{d=await a.read()}catch(c){throw t?.doldu()?new p("zaman",o("60 SN · ZAMAN AŞIMI")):c?.name==="AbortError"||c instanceof p?c:new p("ag",o("AĞ YOK"))}const{value:l,done:m}=d;if(m)break;t?.yenile(),n+=l;let $;for(;$=n.match(/\r?\n\r?\n/);){const c=sa(n.slice(0,$.index));if(n=n.slice($.index+$[0].length),c?.bitti)return;c&&(yield c)}}const s=n.trim()&&sa(n);s&&!s.bitti&&(yield s)}finally{t?.birak(),a.cancel().catch(()=>{})}}function oa(e,a){return e===401||e===403?new p("anahtar",o("{d} · ANAHTAR",{d:e})):e===404?new p("model","404 · MODEL"):e===429?new p("sinir",o("429 · SINIR")):e===400&&/API_KEY_INVALID|api[ _-]?key|authentication/i.test(a)?new p("anahtar",o("400 · ANAHTAR")):e===400&&/model/i.test(a)&&/not found|not exist|invalid|unknown|unsupported/i.test(a)?new p("model","400 · MODEL"):e===400?new p("istek",o("400 · İSTEK")):e===529||e===503?new p("sunucu",o("{d} · YOĞUN",{d:e})):new p("sunucu",o("{d} · SUNUCU",{d:e}))}function P(e="",a=""){const t=`${e} ${a}`;return/authentication|permission|invalid_api_key/i.test(t)?new p("anahtar",o("401 · ANAHTAR")):/not_found|model_not_found/i.test(t)?new p("model","404 · MODEL"):/rate_limit|quota|429/i.test(t)?new p("sinir",o("429 · SINIR")):/overloaded|529|503/i.test(t)?new p("sunucu",o("529 · YOĞUN")):new p("sunucu",o("AKIŞ · HATA"))}const Lt=6e4;async function W(e,a){if(navigator.onLine===!1)throw new p("ag",o("AĞ YOK"));const t=a.signal;if(t?.aborted)throw new DOMException("Durduruldu","AbortError");const n=new AbortController;let s=!1,d=0;const l={yenile(){clearTimeout(d),d=setTimeout(()=>{s=!0,n.abort()},Lt)},birak(){clearTimeout(d)},doldu:()=>s};t?.addEventListener("abort",()=>{l.birak(),n.abort()},{once:!0}),l.yenile();let m;try{m=await fetch(e,{...a,signal:n.signal})}catch($){throw l.birak(),s?new p("zaman",o("60 SN · ZAMAN AŞIMI")):$.name==="AbortError"?$:new p("ag",o("AĞ YOK"))}if(!m.ok){let $="";try{$=await m.text()}catch{$=""}throw l.birak(),oa(m.status,$)}return m.body?la.set(m,l):l.birak(),m}const la=new WeakMap;function le(e,a){if(!dt(e,a))throw new p("sunucu",o("AKIŞ · KESİLDİ"))}const da={async gemini({sistem:e,mesajlar:a,model:t,anahtar:n,signal:s},d){const l={systemInstruction:{parts:[{text:e}]},contents:a.map(c=>({role:c.rol==="assistant"?"model":"user",parts:[{text:c.metin},...c.gorsel?[{inline_data:{mime_type:Te(c.gorsel),data:Ce(c.gorsel)}}]:[]]}))},m=await W(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(t)}:streamGenerateContent?alt=sse`,{method:"POST",signal:s,body:JSON.stringify(l),headers:{"content-type":"application/json","x-goog-api-key":n}}),$=new Set;for await(const{json:c}of oe(m)){if(!c)continue;if(c.error)throw P(c.error.status,c.error.code);if(c.promptFeedback?.blockReason)throw new p("ret");const k=c.candidates?.[0],h=(k?.content?.parts||[]).filter(f=>f.text&&!f.thought).map(f=>f.text).join("");if(h&&d(h),k?.finishReason&&$.add("finish"),k?.finishReason==="MAX_TOKENS"&&$.add("kesik"),/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(k?.finishReason||""))throw new p("ret")}le("gemini",$)},async claude({sistem:e,mesajlar:a,model:t,anahtar:n,signal:s},d){const l={model:t,max_tokens:16e3,stream:!0,fallbacks:"default",system:e,messages:a.map(c=>c.rol==="assistant"?{role:"assistant",content:c.metin}:{role:"user",content:[...c.gorsel?[{type:"image",source:{type:"base64",media_type:Te(c.gorsel),data:Ce(c.gorsel)}}]:[],{type:"text",text:c.metin}]})},m=await W("https://api.anthropic.com/v1/messages",{method:"POST",signal:s,body:JSON.stringify(l),headers:{"x-api-key":n,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json","anthropic-beta":"server-side-fallback-2026-07-01"}}),$=new Set;for await(const{olay:c,json:k}of oe(m)){const h=k?.type||c;if($.add(h),h==="content_block_delta"&&k.delta?.type==="text_delta")d(k.delta.text);else{if(h==="message_delta"&&k.delta?.stop_reason==="refusal")throw new p("ret");if(h==="message_delta"&&k.delta?.stop_reason==="max_tokens")$.add("kesik");else if(h==="error")throw P(k?.error?.type)}}le("claude",$)},async openai({sistem:e,mesajlar:a,model:t,anahtar:n,signal:s},d){const l={model:t,stream:!0,instructions:e,input:a.map(c=>c.rol==="assistant"?{role:"assistant",content:c.metin}:{role:"user",content:[{type:"input_text",text:c.metin},...c.gorsel?[{type:"input_image",image_url:c.gorsel}]:[]]})},m=await W("https://api.openai.com/v1/responses",{method:"POST",signal:s,body:JSON.stringify(l),headers:{Authorization:`Bearer ${n}`,"content-type":"application/json"}}),$=new Set;for await(const{olay:c,json:k}of oe(m)){const h=k?.type||c;if($.add(h),h==="response.output_text.delta")d(k.delta||"");else{if(h==="response.refusal.delta"||h==="response.refusal.done")throw new p("ret");if(h==="error")throw P(k?.code||k?.error?.type,k?.error?.code);if(h==="response.incomplete")$.add("kesik");else if(h==="response.failed")throw P(k?.response?.error?.code)}}le("openai",$)},async grok({sistem:e,mesajlar:a,model:t,anahtar:n,signal:s},d){const l=await W("https://api.x.ai/v1/chat/completions",{method:"POST",signal:s,body:JSON.stringify(ut({sistem:e,mesajlar:a,model:t})),headers:{Authorization:`Bearer ${n}`,"content-type":"application/json"}}),m=new Set;for await(const{json:$}of oe(l)){if(!$)continue;if($.error)throw P($.error.type,$.error.code);const c=$.choices?.[0],k=c?.delta?.content;if(k&&d(k),c?.finish_reason&&m.add("finish"),c?.finish_reason==="length"&&m.add("kesik"),c?.finish_reason==="content_filter")throw new p("ret")}le("grok",m)},async deneme({signal:e,hazir:a,gorsel:t,soru:n,kelime:s,kaynak:d},l){const m=String(n||"").trim().match(/^#(401|403|404|429|ag|ret|500)$/i);if(await Se(520+Math.random()*380,e),m){const k=m[1].toLowerCase();throw k==="ag"?new p("ag",o("AĞ YOK")):k==="ret"?new p("ret"):oa(+k,"")}const c=Xt({hazir:te(a)?"acikla":a,gorsel:t,kelime:s,soru:n,kaynak:d||{},serbest:!a}).match(/\$[^$\n]+\$\S*\s*|\S+\s*|\s+/g)||[];for(const k of c)l(k),await Se(/[.:!?]\s*$/.test(k)?110+Math.random()*90:16+Math.random()*26,e)}},Ee=e=>new RegExp(`(?<!\\p{L})(?:${e})`,"iu"),ua=[{id:"logturev",ad:"logaritmik türev",re:[/logaritmik türev|logarithmic differentiation/i,/ln\s*y\s*=/]},{id:"kapali",ad:"kapalı türev",re:[/kapalı türev|kapalı fonksiyon|kapalı olarak|implicit differentiation|implicitly/i,/x(?:²|\^?2)\s*\+\s*y(?:²|\^?2)/i]},{id:"zincir",ad:"zincir kuralı",re:[/zincir kural|chain rule/i,/bileşke fonksiyon|composite function/i,/f\s*∘\s*g|f′\s*\(\s*g\s*\(x\)\s*\)|dy\s*\/\s*du/i,/iç fonksiyon|dış fonksiyon|inner function|outer function/i]},{id:"difdenk",ad:"ayrılabilir diferansiyel denklemler",re:[/diferansiyel denklem|değişkenlerine ayır|ayrılabilir|differential equation|separable|separate the variables/i,/y′\s*=\s*\d*\s*y\b/]},{id:"statik",ad:"kiriş ve mesnet tepkileri",re:[Ee("kiriş|mesnet|moment|kesme kuvvet|serbest cisim|yayılı yük|tekil yük|statik|beam|shear force|free body|distributed load|point load|statics"),/\d\s*kN\b/],alt:[[/problem 2\.7/i,"statik"],[/dV\s*\/\s*dx|eğilme momenti diyagram|kesit yöntemi|bending moment diagram|method of sections/i,"statikVM"],[/örnek 2\.6|basit mesnetli|example 2\.6|simply supported/i,"statik26"]]},{id:"anatomi",ad:"üst ekstremitenin kas ve sinirleri",re:[Ee("pleksus|plexus|brakiyal|brachial|ekstremite|innervasyon|humerus|n\\.\\s|m\\.\\s|sinir|upper limb|innervat|nerve"),/(?<!\p{L})kas(?:ı|ın|lar\p{L}*)?(?!\p{L})|(?<!\p{L})muscles?(?!\p{L})/iu],alt:[[/fossa cubitalis|dirsek çukuru|cubital fossa/i,"anatomiFossa"],[/pleksus|plexus/i,"anatomi"],[/biceps|triceps|brachialis|coracobrachialis|kolun kasları|muscles of the arm/i,"anatomiKas"]]},{id:"turev",ad:"türev",re:[Ee("türev|limit|teğet|eğim|anlık değişim|derivative|tangent|slope|instantaneous rate"),/f′|f'\(|dy\s*\/\s*dx/]}],Vt={...Object.fromEntries(ua.map(e=>[e.id,e.ad])),statik26:"basit mesnetli kirişte mesnet tepkileri",statikVM:"kesme kuvveti ve eğilme momenti",anatomiKas:"kolun kasları",anatomiFossa:"fossa cubitalis"},qt={logturev:"logarithmic differentiation",kapali:"implicit differentiation",zincir:"the chain rule",difdenk:"separable differential equations",statik:"beams and support reactions",anatomi:"the muscles and nerves of the upper limb",turev:"the derivative",statik26:"support reactions in a simply supported beam",statikVM:"shear force and bending moment",anatomiKas:"the muscles of the arm",anatomiFossa:"the cubital fossa"};function Gt(e){const a=e.belgeId?B(e.belgeId):null,t=a?.veri;if(!a||a.dosya||!e.sayfa||!Array.isArray(t?.sayfalar))return"";const n=t.sayfalar[e.sayfa-(t.ilkNo||1)];if(!n)return"";const s=typeof ve.ornekSayfalari=="function"&&ve.ornekSayfalari(a.id)||ve.PDF_PAGES;return[n.tur==="pdf"?Ot(s?.[n.pdf]):"",...(n.metinler||[]).map(l=>l.metin||"")].filter(Boolean).join(" ")}function Ot(e){let a="";try{a=String(e?.text||"")}catch{a=""}return a.trim()||typeof e?.draw!="function"?a:(String(e.draw).match(/"(?:[^"\\\n]|\\.)*"/g)||[]).join(" ")}function ma(e){const a=e.belgeId?B(e.belgeId):null,t=[e.metin,e.gorsel||!e.metin?Gt(e):"",[e.belgeAd,a?.ad,a?.yazar].filter(Boolean).join(" ")];for(const n of t){if(!n)continue;const s=ua.find(d=>d.re.some(l=>l.test(n)));if(s)return s.alt?.find(([d])=>d.test(n))?.[1]||s.id}return e.metin&&(a?a.tur==="epub":e.kaynak==="koltuk")&&!/[=∫√∑²³]/.test(e.metin)?"edebi":"genel"}const $a={zincir:{acikla:`Zincir kuralı, iç içe geçmiş (bileşke) bir fonksiyonun türevini katman katman alır.
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
Kısaca bölge, türevin geometrik anlamını özetliyor.`}},ca={zincir:{acikla:`The chain rule takes the derivative of a nested (composite) function one layer at a time.
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
In short, the area sums up the geometric meaning of the derivative.`}},ka={formul:"acikla",coz:"ornek",adim:"acikla","ozetle-gorsel":"ozetle",ozetle:"acikla",ornek:"coz"},ya={statik26:"statik",statikVM:"statik",anatomiKas:"anatomi",anatomiFossa:"anatomi"};function de(e){return(String(e).replace(/\s+/g," ").match(/[^.!?…]+(?:[.!?…]+["”»’]*|$)/g)||[]).map(a=>a.trim()).filter(a=>a.length>2)}const x=(e,a=110)=>{if(e=String(e).trim(),e.length<=a)return e;const t=e.lastIndexOf(" ",a);return e.slice(0,t>a/2?t:a).replace(/[,;:]$/,"")+"…"},Rt=[{re:/kenar|not(?:u|lar|un)|kalem|derkenar|altını çiz/i,ad:"okurun metinle kurduğu sessiz konuşma",sade:"Bir kitabın kenarına yazılan not, okurun yazara verdiği cevaptır. Yıllar sonra o notu okuyan biri, hem kitabı hem de ondan önceki okuru dinler.",ornek:"Kütüphaneden aldığın bir kitapta birinin kurşun kalemle düştüğü notu düşün. Yazanı tanımazsın, ama aynı cümlede durup düşündüğünüzü bilirsin. Metnin anlattığı duygu bu: iki yabancı arasında sayfa üstünde kurulan bir yakınlık.",dikkat:"küçük bir nesne, bir not ya da bir çizgi, büyük bir soruyu taşıyor. Okumak gerçekten yalnız yapılan bir iş mi?"},{re:/mürekkep|harf|alfabe|yazı|hattat|matbaa/i,ad:"yazının kalıcılığı ve kuşaktan kuşağa geçen bilgi",sade:"Yazı, insanın unutmaya karşı bulduğu çaredir. Kâğıda geçen şey, yazan kişiden daha uzun yaşar ve sonraki kuşaklara ulaşır.",ornek:"Ailende el yazısıyla tutulmuş bir tarif defteri varsa onu düşün. Tarifin yanına sonradan eklenmiş küçük notlar, defteri yalnız bir yemek kitabı olmaktan çıkarır; bir aile tarihine dönüştürür.",dikkat:"yazı aracının (mürekkep, harf, kâğıt) kendisi de anlatının bir kahramanı gibi ele alınıyor."},{re:/zaman|yıl|eski|sarar|hafıza|hatırla|unut|geçmiş/i,ad:"zaman ve hafıza",sade:"Zaman geçtikçe şeyler eskir, ama üstlerinde iz kalır. Metin, o izlere bakarak geçmişi yeniden düşünmeyi anlatıyor.",ornek:"Eski bir fotoğrafın arkasına yazılmış bir tarih düşün. Fotoğraftaki kişiyi tanımasan bile o tarih sana bir an, bir hayat ve kaybolmuş bir bağlam hakkında bir şey söyler.",dikkat:"anlatıcı geçmişi doğrudan anlatmıyor; nesnelerin üstünde kalan izlerden okuyor."},{re:/mektup|cevap|ses|konuş/i,ad:"gecikmiş bir iletişim",sade:"Bazen bir söz, yazıldığı anda değil yıllar sonra karşılığını bulur. Metin bu gecikmiş karşılaşmayı anlatıyor.",ornek:"Yıllar önce birine yazılmış ama hiç gönderilmemiş bir mektubu bulduğunu düşün. Sana yazılmamıştır, ama okuduğun anda bir cevap bekliyormuş gibi gelir.",dikkat:"konuşma bir kişiyle değil, zamanın öbür ucundaki bir okurla kuruluyor."}],Ft={ad:"okumanın insanda bıraktığı iz",sade:"Metin, bir deneyimi anlatıp okuru kendi deneyimini düşünmeye çağırıyor. Önemli olan olayların kendisi değil, bıraktıkları duygu.",ornek:"Bir kitabı yıllar sonra yeniden okuduğunu düşün. Aynı cümleler bu kez başka yerlerinden dokunur; değişen kitap değil, okurdur.",dikkat:"anlatıcı somut ayrıntılardan yola çıkıp genel bir düşünceye varıyor."};function Yt(e,a){const t=de(a),n=Rt.find(y=>y.re.test(a))||Ft,d=/(?<!\p{L})(?:ben|bana|beni|benim)(?!\p{L})|(?<=\p{L}{2})(?:dım|dim|dum|düm|tım|tim|tum|tüm|ıyorum|iyorum|uyorum|üyorum)(?!\p{L})/iu.test(a)?"birinci tekil şahıs anlatıcı":"anlatıcı",l=t.find(y=>/(?<!\p{L})gibi(?!\p{L})/iu.test(y)),m=t.find(y=>y!==l&&y!==t[0]&&/(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(y)&&y.split(" ").length>=5),$=t.filter(y=>/\?["”»’]*$/.test(y)).length,c=t[0]||a,k=t.length>2?t[t.length-1]:"",h=!l&&/(?:dır|dir|dur|dür|tır|tir|tur|tür)[.!]?["”»’]*$/u.test(c),f=(y,b)=>x(y,b).replace(/[.!?…]+["”»’]*$/u,"");switch(e){case"ozetle":return["Kısaca:",`- Çıkış noktası: ${x(c,120)}`,k?`- Varılan yer: ${x(k,120)}`:"",`- Tema: ${n.ad}.`].filter(Boolean).join(`
`);case"basitlestir":return`Daha sade söylersek: ${n.sade}
Yazar bunu doğrudan söylemek yerine ${l?"bir benzetmeyle":"somut ayrıntılarla"} anlatıyor; duygu böyle daha kolay geçer.${l?`
Benzetmenin geçtiği yer: «${x(l,100)}»`:""}`;case"ornek":return`Metindeki fikre gündelik bir örnek:
${n.ornek}`;case"soru-uret":return["Kendini sınamak için üç soru:",`1. Anlatıcı «${f(c,70)}» derken neyi anlatmak istiyor?`,l?`2. «${f(l,70)}» cümlesinde ne neye benzetiliyor?`:"2. Parçada geçen somut bir nesneyi bul. Yazar onu hangi düşünceyi anlatmak için kullanıyor?","3. Parçanın ana teması nedir? Kendi hayatından bir örnekle açıkla.","**Cevaplar**",`1. Cümle parçanın yönünü veriyor; anlatıcı buradan ${n.ad} düşüncesine geçiyor.`,l?"2. Benzetmenin iki ucunu ayır: anlatılan şey ve «gibi»den önceki görüntü. İkisinin ortak özelliği, yazarın vurgulamak istediği şeydir.":'2. Somut nesne soyut düşünceyi taşır; nesneyi bulup "bu neyin yerine geçiyor?" diye sor.',`3. Ana tema ${n.ad}. Örnek kişisel olabilir; önemli olan temayla bağını kurman.`].join(`
`);default:{const y=l?`Benzetme: «${x(l,110)}» Soyut bir düşünce gözle görülen bir şeye bağlanıyor; okur onu zihninde canlandırabiliyor.`:h?"Kuruluş: ilk cümle kesin bir tanım gibi kurulmuş. Yazar düşüncesini kanıtlamadan bir hüküm olarak koyuyor; bu, metne deneme havası veriyor.":m?`Hüküm cümlesi: «${x(m,110)}» Yazar düşünceyi kesin bir tanım gibi koyuyor; bu, metne deneme havası veriyor.`:"Ayrıntılar: anlatıcı büyük sözler yerine küçük, somut ayrıntılarla ilerliyor; nesneler konuşuyor.",b=$?`Sorular: parçada ${$} soru cümlesi var. Anlatıcı cevap vermekten çok okuru düşünmeye çağırıyor.`:"Ton: sakin ve düşünceli; anlatıcı bir şey kanıtlamaktan çok bir deneyimi paylaşıyor.";return`Bu parçada ${d} ${n.ad} üzerine düşünüyor.
1. Çıkış noktası: «${x(c,110)}»
2. ${y}
3. ${b}
Okurken şuna dikkat et: ${n.dikkat}`}}}const Ht=[{re:/margin|\bnotes?\b|pencil|underlin|marginalia/i,ad:"the quiet conversation between a reader and a text",sade:"A note written in the margin of a book is the reader's reply to the author. Someone who reads that note years later hears both the book and the reader who came before.",ornek:"Think of a note someone left in pencil in a library book. You don't know who wrote it, but you know you both stopped at the same sentence to think. That is the feeling the text describes: a closeness built on a page between two strangers.",dikkat:"a small object, a note or a line, carries a big question. Is reading really something done alone?"},{re:/\bink|alphabet|handwrit|writing|calligraph|printing|printer/i,ad:"the permanence of writing and knowledge passed down through generations",sade:"Writing is the remedy people found against forgetting. What goes onto paper outlives the person who wrote it and reaches later generations.",ornek:"If your family has a handwritten recipe notebook, think of it. The small notes added next to the recipes over the years turn it from a cookbook into a family history.",dikkat:"the writing tool itself (ink, letters, paper) is treated almost like a character in the story."},{re:/\btime\b|\byears?\b|\bold\b|yellow|memor|rememb|forget|forgot|\bpast\b/i,ad:"time and memory",sade:"As time passes, things grow old, but they keep traces. The text is about looking at those traces to think about the past again.",ornek:"Think of a date written on the back of an old photograph. Even if you don't know the person in it, that date tells you something about a moment, a life and a lost context.",dikkat:"the narrator doesn't tell the past directly; they read it from the traces left on objects."},{re:/\bletters?\b|\brepl|answer|voice|speak|talk/i,ad:"a delayed act of communication",sade:"Sometimes words find their answer not when they are written but years later. The text describes this delayed meeting.",ornek:"Imagine finding a letter written to someone years ago and never sent. It wasn't written to you, but as you read it, it feels as if it is waiting for a reply.",dikkat:"the conversation is with a reader at the other end of time, not with one person."}],jt={ad:"the mark reading leaves on a person",sade:"The text describes an experience and invites the reader to think about their own. What matters is not the events themselves but the feeling they leave.",ornek:"Think of rereading a book years later. The same sentences touch you in different places this time; the book hasn't changed, the reader has.",dikkat:"the narrator starts from concrete details and arrives at a general thought."};function Pt(e,a){const t=de(a),n=Ht.find(b=>b.re.test(a))||jt,d=/(?<!\p{L})(?:I|me|my|mine|myself)(?!\p{L})/u.test(a)?"a first-person narrator":"the narrator",l=t.find(b=>/(?<!\p{L})(?:like|as if|as though)(?!\p{L})/iu.test(b)),m=/(?<!\p{L})(?:is|are)(?!\p{L})/iu,$=t.find(b=>b!==l&&b!==t[0]&&m.test(b)&&!/\?["”»’]*$/.test(b)&&b.split(" ").length>=5),c=t.filter(b=>/\?["”»’]*$/.test(b)).length,k=t[0]||a,h=t.length>2?t[t.length-1]:"",f=!l&&m.test(k)&&!/\?["”»’]*$/.test(k),y=(b,be)=>x(b,be).replace(/[.!?…]+["”»’]*$/u,"");switch(e){case"ozetle":return["In short:",`- Starting point: ${x(k,120)}`,h?`- Where it ends up: ${x(h,120)}`:"",`- Theme: ${n.ad}.`].filter(Boolean).join(`
`);case"basitlestir":return`Put more simply: ${n.sade}
Rather than saying it directly, the author tells it ${l?"through a comparison":"through concrete details"}; the feeling comes across more easily that way.${l?`
Where the comparison appears: “${x(l,100)}”`:""}`;case"ornek":return`An everyday example of the idea in the text:
${n.ornek}`;case"soru-uret":return["Three questions to test yourself:",`1. What is the narrator trying to say with “${y(k,70)}”?`,l?`2. In the sentence “${y(l,70)}”, what is compared to what?`:"2. Find a concrete object in the passage. What idea does the author use it to express?","3. What is the main theme of the passage? Explain it with an example from your own life.","**Answers**",`1. The sentence sets the direction of the passage; from here the narrator moves to the idea of ${n.ad}.`,l?"2. Separate the two ends of the comparison: the thing being described and the image it is compared to. What they share is what the author wants to stress.":'2. The concrete object carries an abstract idea; find it and ask "what does this stand for?"',`3. The main theme is ${n.ad}. Your example can be personal; what matters is linking it to the theme.`].join(`
`);default:{const b=l?`Comparison: “${x(l,110)}” An abstract idea is tied to something you can see, so the reader can picture it.`:f?"Structure: the first sentence is built like a firm definition. The author states the idea as a verdict without proving it, which gives the text the feel of an essay.":$?`Verdict sentence: “${x($,110)}” The author states the idea like a firm definition, which gives the text the feel of an essay.`:"Details: instead of big words, the narrator moves through small, concrete details; the objects do the talking.",be=c?`Questions: the passage has ${c===1?"one question":`${c} questions`}. The narrator invites the reader to think more than they give answers.`:"Tone: calm and thoughtful; the narrator shares an experience more than proving a point.";return`In this passage, ${d} reflects on ${n.ad}.
1. Starting point: “${x(k,110)}”
2. ${b}
3. ${be}
While reading, notice this: ${n.dikkat}`}}}const Wt=new Set("about after again because before between could during every first other their there these those through under where which while would should being having itself without within another however therefore although rather".split(" ")),Ut=new Set("olarak olduğu olduğunu arasında birlikte üzerinde sonra önce kadar ancak çünkü dolayısıyla böylece şöyle bunların bunlar onların ayrıca yalnızca neredeyse herhangi".split(" "));function ha(e,a=3){const t=new Map,n=T?Wt:Ut;for(const s of String(e).toLocaleLowerCase(I).match(/\p{L}{6,}/gu)||[])n.has(s)||t.set(s,(t.get(s)||0)+1);return[...t].sort((s,d)=>d[1]-s[1]||d[0].length-s[0].length).slice(0,a).map(s=>s[0])}function Zt(e,a){const t="Demo mode didn't recognize this topic. For a detailed answer, choose a provider in Settings.";if(!a.metin)return`Demo mode can't read the area you clipped and didn't recognize the topic of ${a.belgeAd?`“${a.belgeAd}”`:"this page"}.
For a real answer, choose a provider in Settings, or take the question to ChatGPT, Gemini, Claude or Grok with your account.`;const n=de(a.metin),s=ha(a.metin),d=s.length?s.map(l=>`“${l}”`).join(", "):"the main terms in the text";return e==="ozetle"?`In short:
- ${x(n[0]||a.metin,130)}${n.length>2?`
- ${x(n[n.length-1],130)}`:""}
- Key concepts: ${d}.
${t}`:e==="soru-uret"?`Three questions to test yourself:
1. ${s[0]?`Define “${s[0]}” in your own words.`:"Write the main idea of the passage in one sentence."}
2. ${s[1]?`How are “${s[0]}” and “${s[1]}” related?`:"What is the most important detail in the passage, and why?"}
3. How would you apply this to an example?
**Answers**
Check your answers against the text yourself. ${t}`:`The core of the part you selected: “${x(n[0]||a.metin,120)}”
1. First, pick out the key concepts: ${d}.
2. Define each one in your own words; a concept you can't define is where the gap is.
3. State how the concepts relate in one sentence.
${t}`}function pa(e,a){if(T)return Zt(e,a);const t="Deneme modu bu konuyu tanımadı; ayrıntılı cevap için Ayarlar'dan bir sağlayıcı seç.";if(!a.metin)return`Deneme modu kırptığın bölgeyi okuyamaz ve ${a.belgeAd?`«${a.belgeAd}» belgesinin`:"bu sayfanın"} konusunu tanımadı.
Gerçek cevap için Ayarlar'dan bir sağlayıcı seç ya da Hesap yoluyla soruyu ChatGPT, Gemini, Claude veya Grok'a götür.`;const n=de(a.metin),s=ha(a.metin),d=s.length?s.map(l=>`«${l}»`).join(", "):"metindeki ana terimler";return e==="ozetle"?`Kısaca:
- ${x(n[0]||a.metin,130)}${n.length>2?`
- ${x(n[n.length-1],130)}`:""}
- Öne çıkan kavramlar: ${d}.
${t}`:e==="soru-uret"?`Kendini sınamak için üç soru:
1. ${s[0]?`«${s[0]}» kavramını kendi cümlenle tanımla.`:"Parçanın ana fikrini tek cümleyle yaz."}
2. ${s[1]?`«${s[0]}» ile «${s[1]}» arasındaki ilişki nedir?`:"Parçadaki en önemli ayrıntı hangisi, neden?"}
3. Bu bilgiyi bir örnek üzerinde nasıl kullanırsın?
**Cevaplar**
Cevapları metne dönüp kendin kontrol et. ${t}`:`Seçtiğin bölümün özü: «${x(n[0]||a.metin,120)}»
1. Önce anahtar kavramları ayır: ${d}.
2. Her birini kendi cümlenle tanımla; tanımlayamadığın kavram eksik olan yerdir.
3. Kavramlar arasındaki ilişkiyi tek cümlede kur.
${t}`}const Jt=[[/^melankoli/,"Sürekli ve derin hüzün. Eski tıptaki kara safra kuramından gelir: Yunanca melas «kara» ve khole «safra»."],[/^türev/,"Bir niceliğin başka bir niceliğe göre anlık değişim hızı. Gündelik dilde «bir şeyden türeyen» anlamına da gelir."],[/^hafıza/,"Bellek; yaşananı saklama ve gerektiğinde geri çağırma yetisi. Arapça hıfz «korumak» kökünden."],[/^kâğı[dt]|^kağı[dt]/,"Bitki liflerinden yapılan, üzerine yazılan ince yaprak. Farsça kâğaz kelimesinden gelir."],[/^sahaf/,"Eski ve ikinci el kitap alıp satan kimse ya da dükkânı. Arapça sahîfe «sayfa» ile aynı kökten."],[/^dizgici/,"Matbaada harfleri ve satırları basıma hazır biçimde dizen kişi; mürettip."],[/^matbaacı/,"Matbaa işleten ya da matbaada çalışan kimse; basımcı."],[/^matbaa/,"Kitap, gazete gibi şeylerin basıldığı yer; basımevi. Arapça tab' «basma» kökünden."],[/^derkenar/,"Bir yazının kenarına düşülen not, açıklama. Farsça der «içinde» ile kenar sözünden."],[/^temellük/,"Bir şeyi sahiplenme, mülk edinme. Arapça mülk ile aynı kökten."],[/^mazı/,"Bazı meşe ağaçlarında böceklerin yol açtığı yumru. Eskiden mürekkep yapımında kullanılırdı."],[/^hattat/,"Güzel yazı sanatçısı. Arapça hat «yazı, çizgi» kökünden."],[/^mürekkep/,"Yazmak ve basmak için kullanılan renkli sıvı. Arapça kökte «birleşik, karışım» anlamı taşır."],[/^yelpaze/,"Sallanarak serinlemeye yarayan, açılıp kapanan araç. Sayfaların hızla çevrilişini anlatan bir benzetmede de kullanılır."],[/^alçakgönüllü/,"Kendini başkalarından üstün görmeyen; mütevazı."],[/^öğü[tdğ]/,"Birine iyiliği için verilen akıl, nasihat. Öz Türkçe bir kelimedir."],[/^şük[ür]r?/,"Bir iyiliğe karşı duyulan ve dile getirilen minnet. Arapça kökenli."],[/^çığ(?!lı)/,"Dağdan kopup yuvarlandıkça büyüyen kar kütlesi."],[/^tereddü[tdü]/,"Kararsızlık, duraksama. Arapça kökenli."],[/^nüsha/,"Bir kitabın ya da yazının kopyalarından her biri. Arapça kökenli."],[/^sararm|^sarard|^sarart/,"Sararmak: rengi solup sarıya dönmek. Eski kâğıt ışık ve havayla zamanla sararır."],[/^dokunaklı/,"İnsanın duygularını harekete geçiren, içe işleyen."],[/^kuşa[kğ]/,"Aynı dönemde doğup yaşamış insanların bütünü; nesil."],[/^itiraf/,"Gizlenen ya da söylenmesi zor bir şeyi açıkça söyleme. Arapça kökenli."],[/^fosforlu/,"Işık altında parlak görünen. Burada metnin üstünü boyamaya yarayan parlak renkli kalem."],[/^moment/,"Bir kuvvetin bir noktaya göre döndürme etkisi: kuvvet çarpı dik uzaklık. Gündelik dilde «an» anlamına da gelir."],[/^mesnet/,"Bir yapıyı taşıyan ve hareketini sınırlayan dayanak. Arapça «dayanılan yer» anlamındaki kökten."],[/^kiri[şs]/,"Yükü taşıyıp mesnetlere aktaran, boyu kesitine göre çok uzun yapı elemanı."],[/^ple[kx]sus/,"Sinirlerin ya da damarların birleşip yeniden dallandığı ağ. Latince «örgü»."],[/^bileşke/,"Birkaç şeyin birleşmesinden çıkan sonuç. Matematikte fonksiyonların art arda uygulanması, fizikte kuvvetlerin toplamı."],[/^teğe[tdğ]/,"Bir eğriye bir noktada dokunan ve orada eğriyle aynı yönde ilerleyen doğru."]],Qt=[[/^melanchol/,"A lasting, deep sadness. It comes from the old medical theory of black bile: Greek melas “black” and kholē “bile”."],[/^derivativ/,"The instantaneous rate at which one quantity changes with respect to another. In everyday use it also means “something that comes from something else”."],[/^memor/,"The ability to keep what you have lived through and recall it when needed. From Latin memoria, from memor “mindful”."],[/^paper/,"A thin sheet made from plant fibers, used for writing on. From Latin papyrus, the reed the Egyptians wrote on."],[/^bookseller|^bookshop|^secondhand/,"Someone who buys and sells old and secondhand books, or their shop."],[/^typesett|^compositor/,"In a print shop, the person who sets letters and lines ready for printing."],[/^printer/,"Someone who runs a print shop or works in one."],[/^printing|^press(?:es)?$/,"The printing press: the machine, or the shop, where books and newspapers are printed."],[/^marginal|^margin/,"Marginalia: notes and comments written in the margins of a text. From Latin margo “edge”."],[/^ink(?!l)/,"Colored liquid used for writing and printing. From Old French enque, from Latin encaustum, a purple ink."],[/^calligraph/,"The art of beautiful handwriting. From Greek kallos “beauty” and graphein “to write”."],[/^fan(?:s|ned|ning)?$/,"A device you wave to cool yourself, which opens and closes. Also used in an image for pages flicked through quickly."],[/^humbl/,"Not thinking of yourself as better than others; modest."],[/^advi[cs]/,"A suggestion given to someone for their own good."],[/^gratitud|^grateful/,"Thankfulness felt and expressed for a kindness. From Latin gratus “pleasing, thankful”."],[/^avalanch/,"A mass of snow that breaks loose from a mountain and grows as it rolls down."],[/^hesita/,"Indecision; a pause before acting."],[/^cop(?:y|ies)$/,"One of the reproductions of a book or text."],[/^yellow/,"Yellowed: faded to a yellow color. Old paper yellows over time with light and air."],[/^touching|^moving/,"Something that stirs the feelings and goes straight to the heart."],[/^generation/,"All the people born and living at about the same time."],[/^confess/,"Saying openly something hidden or hard to say. From Latin confiteri “to acknowledge”."],[/^highlighter/,"A bright felt-tip pen used to color over text."],[/^moment/,"The turning effect of a force about a point: force times perpendicular distance. In everyday use it also means “an instant”."],[/^support/,"In a structure, the point that carries it and restrains its movement."],[/^beam/,"A long structural member that carries loads and passes them to its supports."],[/^ple[kx]us/,"A network where nerves or vessels join and branch again. Latin for “braid”."],[/^composit/,"Made by combining several things. In math, a composite function applies functions one after another; in physics, a resultant is the sum of forces."],[/^tangent/,"A line that touches a curve at one point and runs in the same direction as the curve there."]];function Me(e,a){const t=String(e||"").trim().toLocaleLowerCase(I).replace(/[’'].*$/,""),n=(T?Qt:Jt).find(([s])=>s.test(t));return n?n[1]:T?`Demo mode has no ready meaning for “${String(e||"").trim()}”.${a?" Guess it from the sentence it appears in, or choose":" Choose"} a provider in Settings for a real answer.`:`«${String(e||"").trim()}» için deneme modunda hazır bir anlam yok.${a?" Geçtiği cümleden tahmin et;":""} gerçek cevap için Ayarlar'dan bir sağlayıcı seç.`}function Xt({hazir:e,gorsel:a,kelime:t,soru:n="",kaynak:s={},serbest:d=!1}){if(e==="anlam")return Me(t,s.baglam);const l=d&&/ne anlama gel|anlamı ne|ne demek|what does .* mean|meaning of/i.test(n)&&String(n).match(/["“«]([^"”»]{1,40})["”»]/);if(l)return T?`“${l[1]}”: ${Me(l[1],s.metin)}`:`«${l[1]}»: ${Me(l[1],s.metin)}`;const m=ma(s);if(T){const f=d?"Demo mode can't read the question you typed. ":"";if(m==="edebi")return(f&&`${f}Here is a ready explanation of the passage you selected:
`)+Pt(d?"acikla":e,s.metin);if(m==="genel")return pa(d?"acikla":e,s);const y=ca[m];if(d)return`${f}Here is a ready explanation of ${qt[m]||m}:
${y.acikla}`;const b=a&&e==="ozetle"?"ozetle-gorsel":e;return y[b]||y[ka[b]]||ca[ya[m]]?.[b]||y.acikla}const $=d?"Deneme modu yazdığın soruyu okuyamaz; ":"";if(m==="edebi")return($&&`${$}seçtiğin parça üzerine hazır açıklama:
`)+Yt(d?"acikla":e,s.metin);if(m==="genel")return pa(d?"acikla":e,s);const c=$a[m],k=Vt[m]||m;if(d)return`${$}${k} üzerine hazır anlatım:
${c.acikla}`;const h=a&&e==="ozetle"?"ozetle-gorsel":e;return c[h]||c[ka[h]]||$a[ya[m]]?.[h]||c.acikla}const _=()=>T?"en":"tr",ei=e=>!!e&&!e.gorsel&&e.hazir!=="anlam"&&et(e.metin,_()),ai=()=>Xa({ayar:G.ayarlar?.cevapDili,arayuz:_()}),ti=()=>it(ai(),o),ii=e=>{const a=ma(e);return a!=="edebi"&&a!=="genel"};function fa(e){return nt({uygulama:ge,belgeAd:e.belgeAd,sayfa:e.sayfa,matematik:ii(e),dilCumlesi:ti(),t:o})}function ni(e,a,t){const n=a&&O(a,t);if(!n)return{eylem:"",tur:"kisim",soru:String(e||"").trim()};const s=H(e,_())===H(n[2],_());return{eylem:n[2],tur:n[3]||"kisim",soru:s?"":String(e||"").trim()}}const ba=(e,a,t)=>e.hazir==="anlam"&&e.metin?We({kelime:e.metin,baglam:e.baglam,soru:a.soru,sinir:t,dil:_(),t:o}):tt({k:e,eylem:a.eylem,soru:a.soru,sinir:t,dil:_(),t:o}),ri=(e,a,t)=>ba({...e,hazir:t||e.hazir},ni(a,t,!!e.gorsel),1/0);function si(){const e=r.soru.value.trim(),a=i.hazir&&O(i.hazir,!!i.kaynak.gorsel);return{eylem:a?.[2]||"",tur:a?.[3]||"kisim",soru:e}}const ue=()=>kt(i.kaynak,i.kapsam,i.kapsamVeri&&!i.kapsamVeri.yukleniyor?i.kapsamVeri.metin:"");function oi(e){const a=ue();return ba({...a,hazir:i.hazir||i.kaynak.hazir},e,a===i.kaynak?1500:1/0)}function ga({kelime:e,baglam:a}){return We({kelime:e,baglam:a,dil:_(),t:o})}function li(){r={},r.baslik=u("h2",{class:"t-b2",id:"as-baslik"},o("Asistan")),r.pulLamba=u("span",{class:"lamba"}),r.pulAd=u("span",{class:"ad"}),r.pulModel=u("span",{class:"model"}),r.pul=u("span",{class:"cam cam-k as-pul"},r.pulLamba,r.pulAd,r.pulModel),r.kapat=u("button",{type:"button",class:"ikon-dugme","aria-label":o("Asistanı kapat"),onclick:()=>$e()},w("kapat")),r.tutamak=u("div",{class:"asistan-tutamak",role:"button",tabindex:"0","aria-label":o("Asistanı büyüt")}),r.iz=izOlustur(),r.izNot=r.iz.querySelector(".iz-not"),r.kaynak=u("section",{class:"as-kaynak","aria-label":o("Kaynak")}),r.kapsamKap=u("div",{class:"as-kapsam-kap",hidden:!0}),r.gecmis=u("section",{class:"as-gecmis",id:"as-gecmis","aria-label":o("Bu belgede sorduklarım"),hidden:!0}),r.hazir=u("div",{class:"as-hazir",role:"group","aria-label":o("Hazır sorular")}),r.tusDuzen=u("section",{class:"as-tus-duzen",id:"as-tus-duzen","aria-labelledby":"as-tus-baslik",hidden:!0}),r.akis=u("div",{class:"as-akis"}),Ba(!1),r.govde=u("div",{class:"asistan-govde"},r.kaynak,r.gecmis,r.hazir,r.tusDuzen,r.akis),r.soru=u("textarea",{rows:"1",enterkeyhint:"send","aria-label":o("Soru")}),r.gonder=u("button",{type:"button",class:"ikon-dugme gonder","aria-label":o("Gönder"),disabled:!0},w("gonder")),r.uygulamaSec=u("div",{class:"as-uygulamalar",role:"radiogroup","aria-label":o("Uygulama")}),r.hesapDugme=u("button",{type:"button",class:"birincil"}),r.hesapSatir=u("div",{class:"hesap-sor"},r.uygulamaSec,r.hesapDugme),r.alt=u("div",{class:"as-alt"},r.soru,r.gonder,r.hesapSatir),r.canli=u("div",{class:"as-sr","aria-live":"polite"}),r.el=u("aside",{class:"asistan",role:"dialog","aria-modal":"false","aria-labelledby":"as-baslik",tabindex:"-1"},r.tutamak,u("header",{class:"asistan-ust"},r.baslik,r.pul,r.kapat),r.iz,r.govde,r.alt,r.canli),r.soru.addEventListener("input",S),r.soru.addEventListener("keydown",e=>{e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&(e.preventDefault(),Ia())}),r.gonder.addEventListener("click",Ia),r.hesapDugme.addEventListener("click",()=>Ya());for(const e of E){const a=u("button",{type:"button",class:"element kucuk",role:"radio","aria-label":e.ad,dataset:{id:e.id}},u("b",{},e.ad));a.addEventListener("click",()=>Ka(e.id)),r.uygulamaSec.append(a)}r.uygulamaSec.addEventListener("keydown",e=>{const a={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(!a)return;e.preventDefault();const t=E.findIndex(s=>s.id===R().id),n=E[(t+a+E.length)%E.length];Ka(n.id),r.uygulamaSec.querySelector(`[data-id="${n.id}"]`)?.focus()}),pi(),mi(),document.body.append(r.el)}const Be={capture:!0,passive:!0};function di(e){return e.pointerType!=="pen"?!1:!!(e.buttons&2||e.buttons&32||e.buttons===1&&!e.pressure)}function ui(e){const a=e.type==="pointerleave"||e.type==="pointerup"||e.type==="pointercancel"?!1:di(e);if(r.el.classList.contains("kalem-tuslu")!==a&&(r.el.classList.toggle("kalem-tuslu",a),!!a))try{const t=getSelection();t&&t.rangeCount&&!t.isCollapsed&&r.el.contains(t.anchorNode)&&t.removeAllRanges()}catch{}}function mi(){for(const e of["pointerdown","pointermove","pointerup","pointercancel","pointerleave"])r.el.addEventListener(e,ui,Be)}const xa=60,va=["pointerdown","pointermove","pointerup","pointercancel","selectstart","contextmenu"];let me=-1;function za(e){try{if(e.pointerType&&e.pointerType!=="pen")return;if(e.type==="pointermove"){if(e.buttons===me)return;me=e.buttons}else e.type!=="selectstart"&&e.type!=="contextmenu"&&(me=e.buttons);const a=(window.__knTani||={}).panel||=[],t=e.target?.nodeType===1?e.target:e.target?.parentElement,n=t?.closest?.(".asistan")?"asistan":t?.closest?.(".okuma-kaydir, .okuma-sutun")?"okuma":String(t?.tagName||"?").toLowerCase();a.push({t:Math.round(performance.now()),tur:e.type,buttons:e.buttons??null,basinc:e.pressure??null,hedef:n,x:Math.round(e.clientX??0),y:Math.round(e.clientY??0)}),a.length>xa&&a.splice(0,a.length-xa)}catch{}}function $i(){me=-1;for(const e of va)document.addEventListener(e,za,Be)}function ci(){for(const e of va)document.removeEventListener(e,za,Be);r.el?.classList.remove("kalem-tuslu")}function F(){i.acik||(i.acik=!0,V(),i.oncekiOdak=document.activeElement,$i(),U(),r.el.classList.add("acik"),Ie(),re(),requestAnimationFrame(()=>r.el.focus({preventScroll:!0})),v.emit("asistan:acik",!0))}function $e(){i.acik&&(i.acik=!1,ci(),r.el.classList.remove("acik"),r.el.style.transform="",Ie(),re(),r.el.contains(document.activeElement)&&i.oncekiOdak?.focus?.({preventScroll:!0}),v.emit("asistan:acik",!1),ki())}const ce=matchMedia("(max-width: 699px), (max-width: 999px) and (orientation: portrait)");function U(e=matchMedia("(max-width: 599px)").matches?"tam":"yarim"){ce.matches?r.el.dataset.durak=e:delete r.el.dataset.durak,r.tutamak.setAttribute("aria-label",r.el.dataset.durak==="tam"?o("Asistanı küçült"):o("Asistanı büyüt"))}function Ie(){const e=document.documentElement.style;i.acik&&!ce.matches?e.setProperty("--sag-panel",`${r.el.offsetWidth||400}px`):e.removeProperty("--sag-panel")}function ki(){wa()}let g=null;function yi(){return g||(g={},g.ileti=u("span",{class:"as-donus-ileti","aria-live":"polite"}),g.ekle=u("button",{type:"button",class:"birincil"},w("yapistir"),u("span",{},o("Cevabı ekle"))),g.kapat=u("button",{type:"button",class:"ikon-dugme","aria-label":o("Kartı kapat")},w("kapat")),g.el=u("div",{class:"as-donus",role:"group","aria-label":o("Bekleyen cevap"),hidden:!0},g.ileti,g.ekle,g.kapat),g.ekle.addEventListener("click",hi),g.kapat.addEventListener("click",()=>{i.bekleme&&(i.bekleme.kartKapandi=!0),V({odakGeri:!0})}),document.body.append(g.el),g)}function wa(){if(z()!=="hesap"||i.durum!=="bekleme"||!i.bekleme||i.acik||i.bekleme.kartKapandi)return;const e=yi();if(!e.el.hidden)return;const a=document.activeElement;e.oncekiOdak=a&&a!==document.body?a:null,e.el.hidden=!1,Ke(o("Cevap {yer} bekleniyor.",{yer:ne(i.bekleme.uygulama)}))}function Ke(e){g.ileti.textContent="",requestAnimationFrame(()=>{g.el.hidden||(g.ileti.textContent=e)})}function V({odakGeri:e=!1}={}){if(!g||g.el.hidden)return;const a=g.el.contains(document.activeElement);if(g.el.hidden=!0,g.ileti.textContent="",e&&a){const t=g.oncekiOdak;t?.isConnected&&t!==document.body?t.focus?.({preventScroll:!0}):document.activeElement?.blur?.()}g.oncekiOdak=null}async function hi(){if(!i.bekleme){V();return}const e=await ja();if(!i.bekleme){V();return}if(e.tur==="cevap"){V(),fe(e.metin),F();return}if(e.tur==="soru"){Ke(o("Panoda hâlâ soru metni var. Cevabı kopyalayıp yeniden dene."));return}if(e.tur==="adres"){Ke(o("Panoda yalnız bir bağlantı var. Cevabı kopyalayıp yeniden dene."));return}V(),F(),requestAnimationFrame(()=>Pa())}function pi(){const e=()=>{U(r.el.dataset.durak==="tam"?"yarim":"tam")};r.tutamak.addEventListener("keydown",a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),e())}),r.tutamak.addEventListener("pointerdown",a=>{if(a.button>0||!ce.matches)return;const t=a.clientY,n=performance.now(),s=new DOMMatrixReadOnly(getComputedStyle(r.el).transform).m42||0;let d=0,l=[[n,t]];try{r.tutamak.setPointerCapture(a.pointerId)}catch{}r.el.style.transition="none";const m=c=>{d=c.clientY-t;const k=s+d;r.el.style.transform=`translateY(${k<0?k*.35:k}px)`,l.push([performance.now(),c.clientY]),l.length>6&&l.shift()},$=()=>{r.tutamak.removeEventListener("pointermove",m),r.tutamak.removeEventListener("pointerup",$),r.tutamak.removeEventListener("pointercancel",$),r.el.style.transition="",r.el.style.transform="";const c=l.find(y=>performance.now()-y[0]<=80)||l[0],k=l[l.length-1],h=k[0]>c[0]?(k[1]-c[1])/(k[0]-c[0]):0;if(Math.abs(d)<6&&performance.now()-n<300){e();return}const f=r.el.dataset.durak==="tam";if(h>.5||d>r.el.offsetHeight*.22){f&&d<r.el.offsetHeight*.45?U("yarim"):$e();return}(h<-.5||d<-40)&&U("tam")};r.tutamak.addEventListener("pointermove",m),r.tutamak.addEventListener("pointerup",$),r.tutamak.addEventListener("pointercancel",$)})}function N(){let e="",a="",t="",n="",s="";if(z()==="hesap"){const d=R();a=o("{ad} · hesabınla",{ad:d.ad}),s=o("Hesabınla sorulur, anahtar gerekmez"),n=o("{ad}, hesabınla",{ad:d.ad})}else{const d=D();d.id==="deneme"?(e="deneme",a=o("Deneme"),n=o("Deneme, çevrimdışı hazır cevaplar")):d.anahtar?(e=i.dogrulandi.has(d.id)||!i.reddedildi.has(d.id)&&K().denemeler?.[d.id]?.tamam?"bagli":"denenmedi",a=`${d.ad} ·`,t=d.model,n=e==="bagli"?o("{ad}, {model}, bağlı",{ad:d.ad,model:d.model}):o("{ad}, {model}, henüz denenmedi",{ad:d.ad,model:d.model})):(a=o("{ad} · Anahtar yok",{ad:d.ad}),n=o("{ad}, anahtar girilmemiş",{ad:d.ad}))}i.pulHata!=null&&(e=i.pulHata),e?r.pulLamba.dataset.durum=e:delete r.pulLamba.dataset.durum,r.pulAd.textContent=a,r.pulModel.textContent=t,r.pulModel.hidden=!t,r.pul.setAttribute("aria-label",o("Sağlayıcı: {etiket}",{etiket:n})),r.pul.title=n,s?r.pul.setAttribute("aria-description",s):r.pul.removeAttribute("aria-description")}function ke(){const e=i.kaynak;if(r.kaynak.replaceChildren(),r.kaynak.hidden=!e.metin&&!e.gorsel&&!e.belgeAd,r.kaynak.hidden){L();return}const a=Mt(e),t=u("button",{type:"button",class:"as-etiket"},u("span",{class:"etiket-sayfa"},o("Kaynak")),u("span",{},a||o("Seçim")));if(r.gecmisDugme=u("button",{type:"button",class:"metin-dugme as-gecmis-ac","aria-controls":"as-gecmis","aria-expanded":"false",hidden:!0},u("span",{})),r.gecmisDugme.addEventListener("click",()=>{i.gecmisAcik=!i.gecmisAcik,L()}),r.kaynak.append(u("div",{class:"as-kaynak-ust"},t,r.gecmisDugme)),e.metin){const n=e.metin.trim(),s=$=>`“${$.replace(/([′″\p{L}\d])(?=[(\[])/gu,"$1⁠")}”`,d=at(n),l=d.length<n.length,m=u("blockquote",{class:"as-alinti"},s(d));t.setAttribute("aria-expanded","false"),t.setAttribute("aria-label",o("Kaynak: {satir}. Alıntının tamamını göster",{satir:a})),t.addEventListener("click",()=>{const $=m.classList.toggle("tamami");l&&(m.textContent=s($?n:d)),t.setAttribute("aria-expanded",String($))}),m.addEventListener("click",()=>t.click()),r.kaynak.append(m)}else t.disabled=!0;if(r.kapsamGrup=null,r.kaynak.append(r.kapsamKap),Aa(),L(),e.gorsel){const n=u("figcaption",{},o("KIRPINTI")),s=u("img",{src:e.gorsel,alt:a?o("Kırpılan bölge, {satir}",{satir:a}):o("Kırpılan bölge")});s.addEventListener("load",()=>{n.textContent=o("KIRPINTI · {g}×{y}",{g:s.naturalWidth,y:s.naturalHeight})},{once:!0}),r.kaynak.append(u("figure",{class:"as-gorsel"},s,n))}}const ye=e=>e==="secim"||typeof i.kaynak?.kapsam?.[e]=="function";function fi(){const e=i.kaynak||{};return!e.kapsam||!ye("sayfa")&&!ye("notlar")?!1:(!!String(e.metin||"").trim()||!!e.gorsel)&&e.hazir!=="anlam"&&i.hazir!=="anlam"&&(z()==="hesap"||!i.turlar.some(a=>a.durum==="bitti"))}function De(){i.kapsam="secim",i.kapsamVeri=null,i.kapsamSoz=null,i.kapsamSayac++}const Le=e=>e==="sayfa"&&i.kaynak?.kapsam?.sayfaBos===!0,bi=e=>({secim:o("Seçim"),sayfa:o("Sayfa"),notlar:o("Notlarım")})[e];function Aa(){if(r?.kapsamKap){if(!fi()){i.kapsam!=="secim"&&De(),r.kapsamKap.hidden=!0,r.kapsamKap.replaceChildren(),r.kapsamGrup=null;return}if(r.kapsamKap.hidden=!1,!r.kapsamGrup||r.kapsamGrupKaynak!==i.kaynak){const e=Ze.filter(ye),a=e.filter(d=>!Le(d)),t=a.length<e.length,n=u("div",{class:"as-kapsam",role:"radiogroup","aria-label":o("Bağlam"),...t?{"aria-describedby":"as-kapsam-not"}:{}});for(const d of e){const l=u("button",{type:"button",class:"cip",role:"radio",dataset:{id:d},...Le(d)?{disabled:!0,"aria-disabled":"true","aria-describedby":"as-kapsam-not"}:{}},u("span",{class:"cip-ad"},bi(d)));l.addEventListener("click",()=>Ta(d)),n.append(l)}n.addEventListener("keydown",d=>{const l={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[d.key];if(!l)return;d.preventDefault();const m=a.indexOf(i.kapsam),$=a[(Math.max(m,0)+l+a.length)%a.length];Ta($),n.querySelector(`[data-id="${$}"]`)?.focus()}),r.kapsamParagraf=u("p",{class:"as-kapsam-metin"}),r.kapsamOlcu=u("p",{class:"as-kapsam-olcu","aria-live":"polite"}),r.kapsamOnizleme=u("div",{class:"as-kapsam-onizleme",hidden:!0},r.kapsamParagraf,r.kapsamOlcu),r.kapsamGrup=n,r.kapsamGrupKaynak=i.kaynak;const s=t?u("p",{class:"as-kapsam-not",id:"as-kapsam-not"},o("Bu sayfada okunabilir metin yok.")):null;r.kapsamKap.replaceChildren(...[n,s,r.kapsamOnizleme].filter(Boolean))}Sa(),Ve()}}function Sa(){if(r.kapsamGrup)for(const e of r.kapsamGrup.children){const a=e.dataset.id===i.kapsam;e.setAttribute("aria-checked",String(a)),e.tabIndex=a?0:-1}}const he=e=>Number(e||0).toLocaleString(I);function Ve(){const e=r.kapsamOnizleme;if(!e)return;const a=i.kapsamVeri;if(i.kapsam==="secim"||!a){e.hidden=!0,r.kapsamParagraf.textContent="",r.kapsamOlcu.textContent="",r.kapsamOlcuSon="";return}let t="",n="";if(a.yukleniyor)n=o("Hazırlanıyor…");else if(a.bos)t=a.tur==="sayfa"?o("Bu sayfada metin bulunamadı."):o("Bu belgede henüz vurgu ya da not yok."),n=i.kaynak?.gorsel?o("Görüntü gidecek."):o("Seçim gidecek.");else{t=ct(a.metin);const d=he(a.metin.length);n=a.tur==="sayfa"?[o("Gidecek metin: {n} karakter",{n:d}),a.kesildi?o("(kısaltıldı)"):""].filter(Boolean).join(" "):[o("{adet} not · {n} karakter gidecek",{adet:he(a.adet),n:d}),a.toplam>a.adet?o("Son {adet} not gider.",{adet:he(a.adet)}):""].filter(Boolean).join(" ")}const s=e.hidden;e.hidden=!1,e.dataset.bos=a.bos?"1":"",r.kapsamParagraf.textContent=t,r.kapsamParagraf.hidden=!t,r.kapsamOlcuSon=n,s?(r.kapsamOlcu.textContent="",requestAnimationFrame(()=>{e.hidden||(r.kapsamOlcu.textContent=r.kapsamOlcuSon)})):r.kapsamOlcu.textContent=n}function Ta(e){if(Le(e)||e===i.kapsam||!ye(e))return;i.kapsam=e;const a=++i.kapsamSayac;if(Sa(),e==="secim")i.kapsamVeri=null,i.kapsamSoz=null;else{i.kapsamVeri={tur:e,metin:"",adet:0,toplam:0,kesildi:!1,yukleniyor:!0,bos:!1};const t=i.kaynak.kapsam;i.kapsamSoz=(async()=>{let n=null;try{n=await Promise.resolve().then(()=>t[e]())}catch{n=null}if(a!==i.kapsamSayac)return;const s=e==="sayfa"?{...mt(typeof n=="string"?n:""),adet:0,toplam:0}:{...$t(Array.isArray(n)?n:[],{t:o}),kesildi:!1};i.kapsamVeri={tur:e,metin:s.metin,adet:s.adet,toplam:s.toplam,kesildi:s.kesildi,yukleniyor:!1,bos:!s.metin.trim()},Ve(),S()})()}Ve(),S()}const Ca=30,gi=50,xi=e=>ze(B(e)?.veri?.asistanGecmisi),_a=e=>!!e&&!!e.veri&&typeof e.veri=="object"&&!Array.isArray(e.veri);function qe({belgeId:e,soru:a,sayfa:t,cevap:n,uygulama:s,alinti:d,kapsam:l,gorsel:m}){if(!we(G.ayarlar))return null;const $=e?B(e):null;if(!_a($))return null;const c=yt({id:Ye("sg"),soru:a,sayfa:t,cevap:n,uygulama:s,alinti:d,kapsam:l,gorsel:m,zaman:Date.now()});return c?($.veri.asistanGecmisi=ht(ze($.veri.asistanGecmisi),c),i.gecmisTam.set(c.id,String(n).trim()),i.gecmisTam.size>gi&&i.gecmisTam.delete(i.gecmisTam.keys().next().value),v.emit("belge:degisti",{belgeId:$.id}),$.id===i.kaynak?.belgeId&&L(),c):null}function Na(){i.gecmisAcik=!1,i.gecmisGoster=Ca,i.gecmisAcikKayit.clear()}const vi=e=>{try{return new Date(e).toLocaleDateString(I,{day:"numeric",month:"short"})}catch{return""}};function L(){if(!r?.gecmis)return;const e=i.kaynak?.belgeId,a=e&&we(G.ayarlar)?xi(e):[],t=r.gecmisDugme?.isConnected?r.gecmisDugme:null;(!t||!a.length)&&(i.gecmisAcik=!1),t&&(t.hidden=!a.length,t.firstChild.textContent=o("Bu belgede sorduklarım ({n})",{n:he(a.length)}),t.setAttribute("aria-expanded",String(i.gecmisAcik)));const n=r.gecmis.contains(document.activeElement);if(r.gecmis.hidden=!i.gecmisAcik,!i.gecmisAcik){r.gecmis.replaceChildren(),n&&(t&&!t.hidden?t:r.el).focus({preventScroll:!0});return}const s=u("ul",{class:"as-gecmis-liste"});for(const l of a.slice(0,i.gecmisGoster))s.append(zi(e,l));const d=[s];if(a.length>i.gecmisGoster){const l=u("button",{type:"button",class:"metin-dugme as-gecmis-daha"},o("Daha fazla göster"));l.addEventListener("click",()=>{const m=i.gecmisGoster;i.gecmisGoster+=Ca,L(),r.gecmis.querySelectorAll(".as-gecmis-ana")[m]?.focus({preventScroll:!0})}),d.push(l)}r.gecmis.replaceChildren(...d)}function zi(e,a){const t=i.gecmisAcikKayit.has(a.id),n=`as-gecmis-c-${a.id}`,s=[a.sayfa?o("s. {sayfa}",{sayfa:a.sayfa}):"",a.uygulama,vi(a.zaman)].filter(Boolean).join(" · "),d=a.alinti?`“${a.alinti}”`:a.gorsel?o("Kırpıntı"):"",l=u("button",{type:"button",class:"as-gecmis-ana","aria-expanded":String(t),"aria-controls":n},u("span",{class:"as-gecmis-soru"},a.soru||o("Soru")),s?u("span",{class:"as-gecmis-meta"},s):null,d?u("span",{class:"as-gecmis-alinti"},d):null),m=u("div",{class:"as-gecmis-cevap",id:n,hidden:!t}),$=u("span",{class:"as-gecmis-sil-yazi"},o("Bu kaydı sil")),c=u("button",{type:"button",class:"ikon-dugme as-gecmis-sil"},w("sil"),$),k=u("li",{class:"as-gecmis-kayit",dataset:{id:a.id}},u("div",{class:"as-gecmis-satir"},l,c),m),h=()=>{const f=i.gecmisTam.get(a.id),y=u("div",{class:"as-cevap"});y.innerHTML=ra(f||a.cevap),Pe(y),m.replaceChildren(y,...!f&&!a.tam?[u("p",{class:"as-not"},o("Cevabın yalnız başı saklanır."))]:[])};return t&&h(),l.addEventListener("click",()=>{const f=!i.gecmisAcikKayit.has(a.id);f?(i.gecmisAcikKayit.add(a.id),h()):i.gecmisAcikKayit.delete(a.id),m.hidden=!f,l.setAttribute("aria-expanded",String(f)),f&&a.sayfa&&v.emit("git",{ekran:"belge",belgeId:e,sayfa:a.sayfa})}),He(c,null,()=>{const f=B(e);if(!_a(f))return;const y=k.nextElementSibling?.dataset.id||k.previousElementSibling?.dataset.id||null;f.veri.asistanGecmisi=pt(ze(f.veri.asistanGecmisi),a.id),i.gecmisTam.delete(a.id),i.gecmisAcikKayit.delete(a.id),v.emit("belge:degisti",{belgeId:e}),L(),y&&i.gecmisAcik&&r.gecmis.querySelector(`[data-id="${CSS.escape(y)}"] .as-gecmis-ana`)?.focus({preventScroll:!0})},{etiket:$}),k}function M(){const e=i.kaynak.gorsel?ie:Ae,a=[...ei(i.kaynak)&&i.hazir!=="anlam"?[Xe]:[],...e];if(i.hazir&&!te(i.hazir)&&!a.some(t=>t[0]===i.hazir)){const t=O(i.hazir);t&&a.unshift(t)}r.hazir.replaceChildren(...a.map(([t,n])=>{const s=u("button",{type:"button",class:"cip",title:n,"aria-pressed":String(i.hazir===t)},u("span",{class:"cip-ad"},n));return s.addEventListener("click",()=>Ma(t)),s})),Ai()}const wi=()=>i.hazir!=="anlam"&&i.kaynak?.hazir!=="anlam";function Ai(){if(r.tusArti=null,!wi()){i.tusDuzenAcik&&Y({odak:!1});return}const e=j();for(const a of e){const t=u("button",{type:"button",class:"cip cip-kisi",title:a.istem,"aria-pressed":String(i.hazir===a.id),dataset:{id:a.id}},u("span",{class:"cip-ad"},a.ad));t.addEventListener("click",()=>Ma(a.id)),r.hazir.append(t)}r.tusArti=u("button",{type:"button",class:"cip cip-arti","aria-label":e.length?o("Kendi sorularını düzenle"):o("Kendi sorunu ekle"),"aria-expanded":String(!!i.tusDuzenAcik),"aria-controls":"as-tus-duzen"},w("arti")),r.tusArti.addEventListener("click",()=>i.tusDuzenAcik?Y():Si()),r.hazir.append(r.tusArti)}function Si(){i.tusDuzenAcik=!0,i.tusDuzenleId=null,r.tusArti?.setAttribute("aria-expanded","true"),Z(),(r.tusDuzen.querySelector(".as-tus-satir .metin-dugme")||r.tusDuzen.querySelector("#as-tus-ad"))?.focus()}function Y({odak:e=!0}={}){i.tusDuzenAcik&&(i.tusDuzenAcik=!1,i.tusDuzenleId=null,r.tusArti?.setAttribute("aria-expanded","false"),Z(),e&&r.tusArti?.focus({preventScroll:!0}))}const Ea={"ad-bos":()=>o("Bir ad yaz."),"istem-bos":()=>o("Soruyu yaz."),"ad-uzun":()=>o("Ad en çok {n} karakter olabilir.",{n:Je}),"istem-uzun":()=>o("Soru en çok {n} karakter olabilir.",{n:Qe}),dolu:()=>o("En çok 8 kendi sorun olabilir.")};function Z(){const e=r.tusDuzen;if(!i.tusDuzenAcik){e.hidden=!0,e.replaceChildren();return}e.hidden=!1;const a=j(),t=u("ul",{class:"as-tus-liste"});for(const l of a){const m=u("button",{type:"button",class:"metin-dugme"},o("Düzenle"));m.addEventListener("click",()=>{i.tusDuzenleId=l.id,Z(),r.tusDuzen.querySelector("#as-tus-ad")?.focus()});const $=u("span",{class:"as-gecmis-sil-yazi"},o("{ad} sorusunu sil",{ad:l.ad})),c=u("button",{type:"button",class:"ikon-dugme as-gecmis-sil"},w("sil"),$);He(c,null,()=>Ci(l.id),{etiket:$}),t.append(u("li",{class:"as-tus-satir",dataset:{id:l.id}},u("span",{class:"as-tus-ad",title:l.istem},l.ad),m,c))}const n=u("p",{class:"as-tus-durum",id:"as-tus-durum","aria-live":"polite"}),s=i.tusDuzenleId?a.find(l=>l.id===i.tusDuzenleId):null;let d;if(!s&&a.length>=ft)d=u("p",{class:"as-tus-dolu"},o("En çok 8 kendi sorun olabilir."));else{const l=u("input",{id:"as-tus-ad",type:"text",maxlength:String(Je),autocomplete:"off",enterkeyhint:"next","aria-describedby":"as-tus-durum"}),m=u("textarea",{id:"as-tus-istem",maxlength:String(Qe),rows:"3",placeholder:o("ör. Bu maddeyi riskler açısından değerlendirir misin?"),"aria-describedby":"as-tus-durum"});l.value=s?.ad||"",m.value=s?.istem||"";const $=u("button",{type:"button",class:"metin-dugme"},o("Vazgeç"));$.addEventListener("click",()=>Y()),d=u("form",{class:"as-tus-form",novalidate:!0},u("label",{for:"as-tus-ad"},o("Ad")),l,u("label",{for:"as-tus-istem"},o("Soru")),m,u("div",{class:"eylemler"},$,u("button",{type:"submit",class:"birincil"},o("Kaydet")))),d.addEventListener("submit",c=>{c.preventDefault(),Ti({ad:l.value,istem:m.value},n,{ad:l,istem:m})})}e.replaceChildren(u("h3",{class:"as-tus-baslik",id:"as-tus-baslik"},o("Kendi sorularım")),...a.length?[t]:[],d,n)}function Ti(e,a,t){const n=gt(e);if(!n.tamam){a.textContent=Ea[n.hata]?.()||o("Kaydedilemedi."),(n.hata==="ad-bos"||n.hata==="ad-uzun"?t.ad:t.istem).focus();return}const s=j(),d=i.tusDuzenleId||bt+Ye("t"),l=i.tusDuzenleId?zt(s,d,n):vt(s,{id:d,...n});if(!l.tamam){a.textContent=Ea[l.hata]?.()||o("Kaydedilemedi.");return}X({asistanTuslari:l.liste}),i.tusDuzenAcik=!1,i.tusDuzenleId=null,Z(),M(),S(),(r.hazir.querySelector(`.cip-kisi[data-id="${CSS.escape(d)}"]`)||r.tusArti)?.focus({preventScroll:!0})}function Ci(e){const a=wt(j(),e);i.hazir===e&&(i.hazir=null,i.hazirOtomatik=!1),i.tusDuzenleId===e&&(i.tusDuzenleId=null),X({asistanTuslari:a}),M(),Z(),S(),(r.tusDuzen.querySelector(".as-tus-satir .metin-dugme, input")||r.tusArti)?.focus({preventScroll:!0})}function Ma(e){if(i.hazirOtomatik=!1,z()==="hesap"){i.hazir=i.hazir===e?null:e,M(),S();return}i.hazir=e,M(),Q(O(e,!!i.kaynak.gorsel)[2],{hazir:e})}function Ba(e){r?.akis&&(r.akis.dataset.bos=o("Yukarıdan bir tuş seç ya da aşağıya yaz.")+`
`+(e?o("Soru uygulamada açılır. Cevabı kopyala, buraya dön, sonra Cevabı getir düğmesine bas."):o("Cevap bu sayfaya yazılır.")))}function q(){const e=z()==="hesap";if(r.el.dataset.yol=e?"hesap":"anahtar",Ba(e),r.alt.hidden=i.durum==="anahtarsiz",r.hazir.hidden=i.durum==="anahtarsiz",i.durum==="anahtarsiz"&&Y({odak:!1}),r.gonder.hidden=e,r.hesapSatir.hidden=!e,r.soru.placeholder=e?o("Sorunu yaz ya da yukarıdan seç"):i.turlar.length?o("Takip sorusu yaz"):o("Sorunu yaz ya da yukarıdan seç"),e){const a=R();for(const s of r.uygulamaSec.children){const d=s.dataset.id===a.id;s.setAttribute("aria-checked",String(d)),s.tabIndex=d?0:-1}const t=!!(i.dosya&&navigator.canShare?.({files:[i.dosya]})),n=i.durum==="bekleme";r.hesapDugme.className=n?"metin-dugme":"birincil",r.hesapDugme.replaceChildren(w(t?"paylas":"disa-aktar"),u("span",{},n?o("Yeniden gönder"):o("{yer} sor",{yer:ne(a),uyg:a.ad})))}Aa(),S()}function S(){const e=!!i.iptal;if(z()==="hesap"){i.hazirOtomatik&&r.soru.value.trim()&&(i.hazir=null,i.hazirOtomatik=!1,M()),r.hesapDugme.disabled=!(i.hazir||r.soru.value.trim())||!!i.kapsamVeri?.yukleniyor;return}r.gonder.disabled=!e&&!r.soru.value.trim(),r.gonder.setAttribute("aria-label",e?o("Durdur"):o("Gönder")),r.gonder.classList.toggle("durdur",e),r.gonder.replaceChildren(e?u("span",{class:"as-dur-kare","aria-hidden":"true"}):w("gonder"))}function Ia(){if(z()==="hesap")return Ya();if(i.iptal){Ge();return}const e=r.soru.value.trim();e&&(r.soru.value="",Q(e))}function Ka(e){X({yz:{...K(),uygulama:e}})}function Ge(){i.iptal?.abort()}function J(){r.akis.querySelectorAll(".as-bos, .as-hata, .as-bekleme").forEach(e=>e.remove()),i.pulHata=null}async function Q(e,{hazir:a=null}={}){if(z()==="hesap")return;const t=D();if(t.id!=="deneme"&&!t.anahtar)return i.bekleyenSoru={soru:e,hazir:a},Ra();const n=i.kaynak,s=()=>i.kaynak===n||n?.cerceveId&&i.kaynak?.cerceveId===n.cerceveId?!1:(!a&&!r.soru.value.trim()&&(r.soru.value=e,S()),!0);if(!await je(t.id,t.ad)){!a&&!r.soru.value.trim()&&(r.soru.value=e,S()),A(o("Gönderilmedi."));return}if(s())return;let d=!1;for(;!i.turlar.some(y=>y.durum==="bitti")&&i.kaynak===n&&i.kapsamVeri?.yukleniyor&&i.kapsamSoz;){const y=i.kapsamSoz;if(await y,i.kapsamSoz===y&&i.kapsamVeri?.yukleniyor){d=!0;break}}if(s())return;d&&A(o("Seçilen bağlam hazırlanamadı, yalnız seçim gönderildi.")),Ge(),J(),i.durum="hazir",v.emit("sor:gonderildi",{cerceveId:i.kaynak?.cerceveId||null});const l=i.turlar.some(y=>y.durum==="bitti"),m={soru:a?H(e,_()):e,hazir:a,cevap:"",durum:"akiyor",saglayici:t.id,saglayiciAd:t.ad,model:t.model,istem:l?a?H(e,_()):e:ri(ue(),e,a),gorsel:l?null:i.kaynak.gorsel||null,soruGoster:!(a&&i.turlar.length===0),baslangic:performance.now(),duyurulan:0,kapsam:!l&&ue()!==i.kaynak?i.kapsam:"secim"},$=i.turlar.filter(y=>y.durum==="bitti").flatMap(y=>[{rol:"user",metin:y.istem,gorsel:y.gorsel},{rol:"assistant",metin:y.cevap}]);Da(m);const c=[...$,{rol:"user",metin:m.istem,gorsel:m.gorsel}],k=new AbortController;i.iptal=k,C("dusunuyor",""),S(),N();let h=0;const f=()=>{clearTimeout(h),h=setTimeout(()=>{i.izDurum==="akiyor"&&C("dusunuyor")},600)};try{if(await da[t.id]({sistem:fa(i.kaynak),mesajlar:c,model:t.model,anahtar:t.anahtar,signal:k.signal,hazir:a,gorsel:!!i.kaynak.gorsel,soru:e,kelime:i.kaynak.metin,kaynak:i.kaynak},b=>{!b||k.signal.aborted||(m.cevap+=b,i.izDurum!=="akiyor"&&C("akiyor"),f(),_i(m),Va(m))}),!m.cevap.trim())throw new p("ret");m.durum="bitti",t.id!=="deneme"&&(i.dogrulandi.add(t.id),i.reddedildi.delete(t.id)),Oe(m);const y=i.kaynak||{};if(t.id!=="deneme"&&y.belgeId&&m.hazir!=="anlam"&&y.hazir!=="anlam")try{qe({belgeId:y.belgeId,soru:m.soru,sayfa:y.sayfa,cevap:m.cevap,uygulama:t.ad,alinti:y.metin,kapsam:m.kapsam,gorsel:!!m.gorsel||!!y.gorsel})}catch{}}catch(y){y?.name==="AbortError"?(m.durum="durdu",Oe(m,{durdu:!0,iz:i.iptal===k})):Ei(y instanceof p?y:new p("sunucu",o("HATA")),m)}finally{clearTimeout(h),i.iptal===k&&(i.iptal=null),q(),N()}}function Da(e){e.cevapEl=u("div",{class:"as-cevap","aria-busy":"true"},u("span",{class:"imlec","aria-hidden":"true"})),e.kayitEl=u("div",{class:"as-kayit"}),e.altEl=u("div",{class:"as-tur-alt"}),e.el=u("article",{class:"as-tur","aria-label":o("Cevap")},e.soruGoster?u("div",{class:"as-soru"},u("span",{class:"t-daktilo"},o("Soru")),u("p",{},e.soru)):null,e.cevapEl,e.kayitEl,e.altEl),i.turlar.push(e),r.akis.append(e.el),e.el.scrollIntoView({block:"nearest"})}function _i(e){e.cizimBekliyor||(e.cizimBekliyor=!0,requestAnimationFrame(()=>{e.cizimBekliyor=!1,La(e,e.durum==="akiyor")}))}function La(e,a){const t=r.govde,n=t.scrollHeight-t.scrollTop-t.clientHeight<48;if(e.cevapEl.innerHTML=ra(e.cevap),Pe(e.cevapEl),a){let s=e.cevapEl.lastElementChild||e.cevapEl;/^(OL|UL)$/.test(s.tagName)&&(s=s.lastElementChild||s),s.append(u("span",{class:"imlec","aria-hidden":"true"}))}if(n){const s=t.scrollHeight-t.clientHeight,d=t.getBoundingClientRect().top-t.scrollTop,l=c=>c.getBoundingClientRect().top-d-12,m=l(e.el);let $=s;if(s<m){const c=[0,...[r.kaynak.querySelector(".as-alinti"),r.hazir,...i.turlar.map(k=>k.el)].filter(k=>k&&!k.hidden&&k.offsetHeight).map(l)];$=Math.max(...c.filter(k=>k<=s))}$>t.scrollTop&&(t.scrollTop=$)}}function Va(e,a=!1){const t=e.cevap,n=a?t.length:Math.max(...[". ",`.
`,"? ","! ",`:
`].map(s=>t.lastIndexOf(s)))+1;if(n>e.duyurulan){const s=Dt(t.slice(e.duyurulan,n)).trim();e.duyurulan=n,s&&(r.canli.textContent=s)}}function Oe(e,{durdu:a=!1,hesap:t=null,iz:n=!0}={}){La(e,!1),e.cevapEl.removeAttribute("aria-busy"),Va(e,!0);const s=(performance.now()-e.baslangic)/1e3;n&&C("bitti","");const d=t?null:u("span",{class:"cam cam-k soluk as-olcu"},o("{sn} sn · {n} kelime",{sn:Nt(s),n:_t(e.cevap)})),l=new Date;if(a)d&&e.kayitEl.replaceChildren(d);else{const m=t?o("Kayıt · {ad} · {saat}",{ad:ea(t.ad),saat:ia(l)}):o("Kayıt · {tarih} · {saat}",{tarih:Et(l),saat:ia(l)});e.kayitEl.replaceChildren(u("span",{class:"damga"},m),d)}a?e.altEl.append(u("p",{class:"as-not"},o("Durduruldu."))):e.saglayici==="deneme"&&e.altEl.append(u("p",{class:"as-not"},o("Bu hazır bir örnek cevaptır."))),!a&&e.hazir==="anlam"&&e.altEl.append(...qa()),e.cevap.trim()&&e.altEl.append(Ni(e))}function qa(){const e=i.kaynak,a=String(e.metin||"").trim();if(!a||a.length>120)return[];const t=B(e.belgeId)?.dil||(T?"en":"tr");return[Qa({metin:a,dil:t,sinif:"as-disari"})]}function Ga({belgeId:e,sayfa:a,metin:t,soru:n,kaynak:s}){v.emit("asistan:not",{belgeId:e,sayfa:a,metin:t,soru:n,kaynak:s||"Asistan",zaman:Date.now()})}function Oa(e,a){const t=B(e)?.ad||"",n=t?a?o("{belge}, s. {sayfa}",{belge:t,sayfa:a}):t:a?o("s. {sayfa}",{sayfa:a}):"";A(n?o("Cevap kenar notu olarak eklendi: {yer}",{yer:n}):o("Cevap kenar notu olarak eklendi."),{etiket:o("Göster"),calistir:()=>v.emit("git",{ekran:"belge",belgeId:e})})}function Ni(e){const a=i.kaynak,t=u("div",{class:"as-eylem"}),n=l=>{t.querySelector(".damga")?.remove(),t.append(u("span",{class:"damga",role:"status"},l))},s=(l,m,$,c={})=>{const k=u("button",{type:"button",class:"metin-dugme",...c},w(m),u("span",{},l));return k.addEventListener("click",()=>$(k)),k},d=s(o("Kenara not"),"kenara-not",l=>{Ga({belgeId:a.belgeId,sayfa:a.sayfa,metin:e.cevap,soru:e.soru,kaynak:e.saglayiciAd}),l.disabled=!0,n(a.sayfa?o("Kenara eklendi · s. {sayfa}",{sayfa:a.sayfa}):o("Kenara eklendi"))},{disabled:!a.belgeId,title:a.belgeId?null:o("Bu soru bir belgeye bağlı değil")});if(e.kenaraBas=()=>d.disabled?!1:(d.click(),!0),t.append(d,s(o("Karta çevir"),"karta-cevir",l=>{const m=a.metin?a.metin.trim().slice(0,220)+(a.metin.trim().length>220?"…":""):"",$=Wa({tur:"soru",on:{metin:m?`${e.soru}
“${m}”`:e.soru,gorsel:e.gorsel||a.gorsel||void 0},arka:{metin:e.cevap},belgeId:a.belgeId,belgeAd:a.belgeAd,sayfa:a.sayfa});l.disabled=!0,n(o("Tekrar'a eklendi · kutu I")),Ua($,{geriAl:()=>{l.disabled=!1,t.querySelector(".damga")?.remove()}})}),s(o("Kopyala"),"kopyala",async()=>{A(await ee(e.cevap)?o("Kopyalandı"):o("Kopyalanamadı"))})),e.saglayici!=="deneme"&&e.kayitEl){const l=u("button",{type:"button",class:"ikon-dugme as-bildir",title:o("Bu cevabı bildir"),"aria-label":o("Bu cevabı bildir")},w("bayrak"));l.addEventListener("click",()=>{Ja({soru:e.soru,cevap:e.cevap,saglayici:e.saglayiciAd,model:e.saglayici==="hesap"?"":e.model,belgeAd:a.belgeAd,sayfa:a.sayfa}),n(o("E-posta hazırlandı; göndermek sana kalmış"))}),e.kayitEl.append(l)}return t}function Ei(e,a){const t=aa[e.tur]||aa.sunucu;a.durum="hata",(e.tur==="anahtar"||e.tur==="model")&&(i.dogrulandi.delete(a.saglayici),i.reddedildi.add(a.saglayici)),e.tur==="ret"&&(a.cevap=""),a.cevapEl.remove(),a.kayitEl.remove(),i.pulHata=t.lamba===null?null:t.lamba,C("hata","");const n=u("button",{type:"button",class:"metin-dugme vurgulu"},w(t.eylem==="Yeniden dene"?"yeniden":t.eylem==="Ayarları aç"?"ayarlar":"metin"),u("span",{},o(t.eylem)));n.addEventListener("click",()=>{if(t.eylem==="Ayarları aç")return Fa();if(a.el.remove(),i.turlar.splice(i.turlar.indexOf(a),1),t.eylem==="Yeniden dene")return Q(a.soru,{hazir:a.hazir});C("bekliyor",""),i.pulHata=null,N(),r.soru.value=a.soru,S(),r.soru.focus()});const s=u("div",{class:"as-hata",role:"alert",dataset:{tur:e.tur}},t.lamba===null?u("span"):u("span",{class:"lamba",dataset:t.lamba?{durum:t.lamba}:{}}),e.kod?u("span",{class:"kod"},e.kod):u("span"),u("p",{},t.metin),n);a.altEl.replaceChildren(s)}function Ra(){const e=D();i.durum="anahtarsiz",J(),C("bekliyor","");const a=u("button",{type:"button",class:"birincil"},w("ayarlar"),u("span",{},o("Ayarları aç")));a.addEventListener("click",Fa);const t=u("button",{type:"button",class:"metin-dugme"},o("Deneme ile dene"));t.addEventListener("click",()=>X({yz:{...K(),yol:"anahtar",saglayici:"deneme"}})),r.akis.append(u("div",{class:"as-bos"},u("div",{class:"tahta tahta--cerceve"},Mi()),u("h3",{class:"t-b2"},o("Anahtar girilmemiş.")),u("p",{},o("{ad} için anahtar yok. Hesabınla sormak için Ayarlar'a dön.",{ad:e.ad})),u("div",{class:"as-bos-eylem"},a,t))),q(),N()}function Mi(){const a=document.createElementNS("http://www.w3.org/2000/svg","svg");return a.setAttribute("class","feynman"),a.setAttribute("viewBox","0 0 160 96"),a.setAttribute("aria-hidden","true"),a.innerHTML=`<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 10 50 48 12 86M148 10 110 48 148 86"/>
    <path d="M50 48q3.75-8 7.5 0t7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0 7.5 0"/>
    <path d="M28 21l3 6-6.5-.5M28 75l-3.5 5.6 6.6-.2M132 21l-3.4 5.8 6.6-.3M132 75l3.2 5.7-6.6-.2"/>
  </g><g fill="currentColor"><circle cx="50" cy="48" r="2.4"/><circle cx="110" cy="48" r="2.4"/></g>`,a}function Fa(){v.emit("ayarlar:ac",{bolum:"yz"}),setTimeout(()=>{if(document.querySelector("dialog[open], .yz-pencere"))return;const e=[...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(a=>/Ayarlar|Settings/.test(a.textContent)&&a.getClientRects().length);e?e.click():A(o("Ayarlar kitaplıkta, Yapay zekâ bölümünde."))},60)}async function Ya(){const e=si();if(!e.eylem&&!e.soru){r.soru.focus();return}const a=R(),t=oi(e),n=i.dosya,s=await ee(t);let d=!1;if(n&&xe())try{await(await import("./yerel-android.js")).yzPaylas([n],t,a.id)&&(d=!0,A(o("Soru {ad} için gönderildi; cevabı {uygulama}'ye sürükle ya da paylaş.",{ad:a.ad,uygulama:ge})))}catch(m){console.warn("[asistan] yzPaylas",m)}if(!d&&n&&navigator.canShare?.({files:[n]}))try{await navigator.share({text:t,files:[n]}),d=!0}catch(m){if(m?.name==="AbortError"){A(o("Paylaşım iptal edildi."));return}}let l=!1;if(!d){const m=t.length>1800?"":t;l=!m,window.open(a.url(m),"_blank","noopener");const $=xe()?o("Cevabı {uygulama}'ye sürükle ya da paylaş.",{uygulama:ge}):s?m?o("Metin kopyalandı. Sohbette görünmezse yapıştır."):o("Metin uzun, bağlantıya sığmadı. Kopyalandı; açılan sohbete yapıştır."):o("Metin kopyalanamadı; açılan sohbete soruyu yaz.");n?A($,{etiket:o("Görüntüyü indir"),calistir:()=>Ct(n)}):A($)}Ha(a,t,[e.eylem&&H(e.eylem,_()),e.soru].filter(Boolean).join(" "),{ipucu:l&&!xe()?o("Soru bağlantıya sığmadı; sohbete yapıştır."):"",kapsam:ue()===i.kaynak?"secim":i.kapsam})}function Ha(e,a,t,{ipucu:n="",kapsam:s=i.kapsam}={}){v.emit("sor:gonderildi",{cerceveId:i.kaynak?.cerceveId||null}),J(),i.durum="bekleme",i.bekleme={metin:a,soru:t,uygulama:e,vurgulandi:!1,baslangic:performance.now(),kapsam:Ze.includes(s)?s:"secim"},pe(),C("bekliyor",ea(T?`In ${e.ad}`:ne(e)));const d=u("button",{type:"button",class:"birincil"},w("yapistir"),u("span",{},o("Cevabı getir")));d.addEventListener("click",Di);const l=u("button",{type:"button",class:"metin-dugme"},o("Metni yeniden kopyala"));l.addEventListener("click",async()=>A(await ee(a)?o("Metin kopyalandı."):o("Kopyalanamadı"))),r.getir=d,r.yapistirKap=u("div",{class:"as-yapistir-kap",hidden:!0});const m=u("div",{class:"as-bekleme kareli",role:"status"},u("h3",{},o("Cevap {yer}.",{yer:ne(e)})),n?u("p",{class:"as-bekleme-ipucu"},n):null,u("p",{},o("Bitince cevabı kopyala ve buraya dön.")),u("div",{class:"eylemler"},d,l),r.yapistirKap);r.akis.append(m),m.scrollIntoView({block:"nearest"}),q(),N()}const Re="kn-tasarim:asistan-bekleme";function pe(){i.bekleme||V(),Bi();try{if(!i.bekleme){sessionStorage.removeItem(Re);return}const{gorsel:e,kapsam:a,...t}=i.kaynak||{},n=i.bekleme;sessionStorage.setItem(Re,JSON.stringify({metin:n.metin,soru:n.soru,uygulama:n.uygulama?.id,hazir:i.hazir,kaynak:t,kapsam:n.kapsam}))}catch{}}function Bi(){try{const e=i.bekleme,a=e&&ot({kaynak:i.kaynak,soru:e.soru,istem:e.metin,uygulama:e.uygulama?.id});a?localStorage.setItem(ae,JSON.stringify(a)):localStorage.removeItem(ae)}catch{}}function Ii(){try{return JSON.parse(localStorage.getItem(ae)||"null")}catch{return null}}function Ki(){let e=null;try{e=JSON.parse(sessionStorage.getItem(Re)||"null")}catch{e=null}if(!e||typeof e.metin!="string"||z()!=="hesap")return;const a=E.find(t=>t.id===e.uygulama)||R();i.kaynak=e.kaynak&&typeof e.kaynak=="object"?e.kaynak:{},i.hazir=e.hazir||null,ke(),M(),Ha(a,e.metin,e.soru,{kapsam:e.kapsam}),F()}async function ja(){let e=null;try{navigator.clipboard?.readText&&(e=await navigator.clipboard.readText())}catch{e=null}const a=String(e||"").trim();return a?i.bekleme&&Ue(a,i.bekleme.metin)?{tur:"soru"}:rt(a)?{tur:"adres"}:{tur:"cevap",metin:a}:{tur:"yok"}}async function Di(){if(!i.bekleme)return;const e=await ja();if(i.bekleme){if(e.tur==="cevap")return fe(e.metin);e.tur==="soru"?A(o("Panoda hâlâ soru metni var. Cevabı kopyalayıp yeniden dene.")):e.tur==="adres"&&A(o("Panoda yalnız bir bağlantı var. Cevabı kopyalayıp yeniden dene.")),Pa()}}function Pa(){const e=r.yapistirKap;if(!e||!e.hidden){e?.querySelector("textarea")?.focus();return}const a=u("textarea",{class:"as-yapistir",placeholder:o("Cevabı buraya yapıştır"),"aria-label":o("Cevap")}),t=u("button",{type:"button",class:"metin-dugme vurgulu",disabled:!0},w("tik"),u("span",{},o("Ekle")));a.addEventListener("input",()=>{t.disabled=!a.value.trim()}),t.addEventListener("click",()=>a.value.trim()&&fe(a.value.trim())),e.replaceChildren(a,u("div",{class:"eylemler"},t)),e.hidden=!1,a.focus()}function fe(e,{kenara:a=!0}={}){const t=i.bekleme;r.akis.querySelector(".as-bekleme")?.remove(),i.durum="hazir",i.bekleme=null,pe(),r.getir=null;const n={soru:t.soru,hazir:i.hazir,cevap:e,durum:"bitti",saglayici:"hesap",saglayiciAd:t.uygulama.ad,istem:t.metin,gorsel:null,soruGoster:!0,baslangic:t.baslangic,duyurulan:0};Da(n),Oe(n,{hesap:t.uygulama}),r.soru.value="",De(),q(),N();const s=i.kaynak||{};if(a&&s.belgeId&&n.hazir!=="anlam"&&n.kenaraBas?.()&&Oa(s.belgeId,s.sayfa),s.belgeId&&n.hazir!=="anlam"&&s.hazir!=="anlam")try{qe({belgeId:s.belgeId,soru:t.soru,sayfa:s.sayfa,cevap:e,uygulama:t.uygulama?.ad,alinti:s.metin,kapsam:t.kapsam,gorsel:!!s.gorsel})}catch{}}function Li(e){const a=i.kaynak||{};if(!e.cerceveId||a.cerceveId!==e.cerceveId||!e.gorsel||!["hazir","anahtarsiz"].includes(i.durum)||i.turlar.length||i.iptal)return;i.kaynak={...a,gorsel:e.gorsel},r?.kapsamGrupKaynak===a&&(r.kapsamGrupKaynak=i.kaynak),i.dosya=ta(e.gorsel);const t=r.kaynak.querySelector(".as-gorsel img");if(!t){ke();return}const n=r.kaynak.querySelector(".as-gorsel figcaption");t.addEventListener("load",()=>{n&&(n.textContent=o("KIRPINTI · {g}×{y}",{g:t.naturalWidth,y:t.naturalHeight}))},{once:!0}),t.src=e.gorsel}function Vi(e={}){if(e.yenile){Li(e);return}if(e.hazir==="anlam"&&z()==="anahtar"&&!e.panel){Gi(e);return}if(e.hazir==="anlam"&&z()==="hesap"&&e.panel===!1){qi(e);return}if(Ge(),i.durum==="bekleme"&&i.bekleme&&A(o("Önceki sorunun bekleyen cevabı bırakıldı.")),i.kaynak={...e},De(),Na(),Y({odak:!1}),i.dosya=e.gorsel?ta(e.gorsel):null,i.turlar=[],i.hazir=e.hazir||null,i.hazirOtomatik=!1,z()==="hesap"&&e.gorsel&&!e.hazir&&!String(e.soru||"").trim()&&(i.hazir=ie[0][0],i.hazirOtomatik=!0),i.durum="hazir",i.bekleme=null,pe(),i.bekleyenSoru=null,i.pulHata=null,r.akis.replaceChildren(),r.soru.value="",C("bekliyor",""),ke(),M(),q(),N(),r.govde.scrollTop=0,F(),z()==="hesap"){e.soru&&(r.soru.value=e.soru,S()),e.hazir==="anlam"&&r.akis.append(...qa());return}const a=e.soru||e.hazir&&O(e.hazir,!!e.gorsel)?.[2];if(a)Q(a,{hazir:e.hazir||null});else{const t=D();t.id!=="deneme"&&!t.anahtar&&Ra()}}function qi(e){const a=R(),t=ga({kelime:e.metin,baglam:e.baglam});ee(t).then(n=>A(n?o("Soru kopyalandı. Cevabı kopyalayıp buraya dön."):o("Açılan sohbete soruyu yaz."))),window.open(a.url(t.length>1800?"":t),"_blank","noopener")}export async function anlamGetir({kelime:e,baglam:a="",belgeAd:t,sayfa:n,signal:s}={},d){const l=D();if(l.id!=="deneme"&&!l.anahtar)throw new p("anahtar",o("ANAHTAR YOK"));if(!await je(l.id,l.ad))throw new p("onay",o("GÖNDERİLMEDİ"));const m={belgeAd:t,sayfa:n},$=ga({kelime:e,baglam:a,belgeAd:t,sayfa:n});let c="";return await da[l.id]({sistem:fa(m),mesajlar:[{rol:"user",metin:$}],model:l.model,anahtar:l.anahtar,signal:s,hazir:"anlam",kelime:e,kaynak:{belgeAd:t,sayfa:n,baglam:a}},k=>{c+=k,d?.(k,c)}),l.id!=="deneme"&&i.dogrulandi.add(l.id),c.trim()}function Gi(e){const a=String(e.metin||"").trim(),t=(n,s={})=>v.emit("asistan:anlam",{kelime:a,belgeId:e.belgeId,sayfa:e.sayfa,durum:n,...s});t("dusunuyor"),anlamGetir({kelime:a,baglam:e.baglam,belgeAd:e.belgeAd,sayfa:e.sayfa,signal:e.signal},(n,s)=>{t("akiyor",{parca:n,metin:s}),e.parca?.(n,s)}).then(n=>{t("bitti",{metin:n,deneme:D().id==="deneme"}),e.bitti?.(n)}).catch(n=>{if(n?.name==="AbortError")return;const s={tur:n?.tur||"sunucu",kod:n?.kod||"",mesaj:n?.tur==="onay"?o("Gönderilmedi."):o("Anlam getirilemedi.")};t("hata",{hata:s}),e.hata?.(s)})}const Oi={gemini:(e,a)=>[`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e)}`,{headers:{"x-goog-api-key":a}}],claude:(e,a)=>["https://api.anthropic.com/v1/messages/count_tokens",{method:"POST",headers:{"x-api-key":a,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","content-type":"application/json"},body:JSON.stringify({model:e,messages:[{role:"user",content:"deneme"}]})}],openai:(e,a)=>[`https://api.openai.com/v1/models/${encodeURIComponent(e)}`,{headers:{Authorization:`Bearer ${a}`}}],grok:(e,a)=>[`https://api.x.ai/v1/models/${encodeURIComponent(e)}`,{headers:{Authorization:`Bearer ${a}`}}]};export async function baglantiDene(e){const a=D(e);if(a.id!==e)return{tamam:!1,mesaj:o("BİLİNMEYEN"),tur:"istek"};if(a.id==="deneme")return await Se(260),{tamam:!0,ok:!0,mesaj:o("DENEME · HAZIR"),tur:"deneme",ms:0};if(!a.anahtar)return{tamam:!1,mesaj:o("ANAHTAR YOK"),tur:"anahtar-yok",durum:"anahtar-yok"};const t=new AbortController,n=setTimeout(()=>t.abort(),15e3),s=performance.now();try{const[d,l]=Oi[a.id](a.model,a.anahtar);await W(d,{...l,signal:t.signal});const m=Math.round(performance.now()-s);return i.dogrulandi.add(a.id),i.reddedildi.delete(a.id),{tamam:!0,ok:!0,mesaj:o("BAĞLI · {ms} ms",{ms:m}),tur:"bagli",ms:m}}catch(d){if(i.dogrulandi.delete(a.id),d?.name==="AbortError")return{tamam:!1,mesaj:o("ZAMAN AŞIMI"),tur:"ag",durum:"ag"};const l=d?.kod||o("AĞ YOK"),m=parseInt(l,10);return(d?.tur==="anahtar"||d?.tur==="model")&&i.reddedildi.add(a.id),{tamam:!1,mesaj:l,tur:d?.tur||"ag",durum:d?.tur==="ag"?"ag":Number.isFinite(m)?m:l}}finally{clearTimeout(n),r&&N()}}function Ri(){return document.querySelector("dialog[open]")?!0:[...document.querySelectorAll(".perde, .anlam-fis, .cekmece-perde, .fis-sabit")].some(e=>e.getClientRects().length)}export function kur(){i.kuruldu||(i.kuruldu=!0,li(),ke(),M(),q(),N(),Ki(),v.on("sor",Vi),v.on("asistan:one",()=>{F(),r.el.focus({preventScroll:!0})}),v.on("asistan:kapat",$e),v.on("asistan:gelen",e=>{const a=String(e?.metin||"").trim();if(!a)return;if(i.durum==="bekleme"&&i.bekleme){if(Ue(a,i.bekleme.metin))return;e.alindi=!0,fe(a),F();return}if(e.yalnizBekleyen)return;const t=lt(Ii(),{belgeVar:s=>!!B(s)});if(!t||!st(a,t.istem))return;e.alindi=!0;const n=E.find(s=>s.id===t.uygulama)?.ad;Ga({belgeId:t.belgeId,sayfa:t.sayfa,metin:a,soru:t.soru,kaynak:n});try{localStorage.removeItem(ae)}catch{}Oa(t.belgeId,t.sayfa);try{qe({belgeId:t.belgeId,soru:t.soru,sayfa:t.sayfa,cevap:a,uygulama:n})}catch{}}),v.on("ayarlar",()=>{if(i.durum==="anahtarsiz"){const a=D();if(z()==="hesap"||a.id==="deneme"||a.anahtar){i.durum="hazir",J();const t=i.bekleyenSoru;i.bekleyenSoru=null,t&&z()==="anahtar"&&Q(t.soru,{hazir:t.hazir})}}i.durum==="bekleme"&&z()==="anahtar"&&(J(),i.durum="hazir",i.bekleme=null,pe(),C("bekliyor","")),te(i.hazir)&&!O(i.hazir)&&(i.hazir=null,i.hazirOtomatik=!1),M(),q(),N();const e=we(G.ayarlar);e!==i.gecmisAyar&&(i.gecmisAyar=e,L())}),v.on("asistan:gecmis",()=>{i.gecmisTam.clear(),Na(),L()}),window.addEventListener("keydown",e=>{if(!(e.key!=="Escape"||!i.acik||e.defaultPrevented||Ri())){if(e.preventDefault(),e.stopPropagation(),i.tusDuzenAcik){Y();return}$e()}},!0),ce.addEventListener("change",()=>{U(),Ie()}),document.addEventListener("visibilitychange",()=>{if(re(),!(document.hidden||i.durum!=="bekleme"||!i.bekleme)){if(!i.acik){wa();return}!i.bekleme.vurgulandi&&r.getir&&(i.bekleme.vurgulandi=!0,r.getir.classList.add("vurgulu"))}}))}
