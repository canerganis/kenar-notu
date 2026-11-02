// İngilizce sözlük: Türkçe kaynak metin -> İngilizce. Her modülün kendi parçası var (dil/en-<parça>.js),
// böylece modüller birbirinin dosyasına dokunmadan çevrilir. Aynı anahtar iki parçada varsa sonraki geçerli.
import p_app_1 from "./en-app-1.js";
import p_app_2 from "./en-app-2.js";
import p_app_3 from "./en-app-3.js";
import p_duzenleyici_1 from "./en-duzenleyici-1.js";
import p_duzenleyici_2 from "./en-duzenleyici-2.js";
import p_okuma_1 from "./en-okuma-1.js";
import p_okuma_2 from "./en-okuma-2.js";
import p_asistan from "./en-asistan.js";
import p_tekrar from "./en-tekrar.js";
import p_izler from "./en-izler.js";
import p_kayit_arama from "./en-kayit-arama.js";
import p_ortak from "./en-ortak.js";
import p_araclar from "./en-araclar.js";
import p_cizgi from "./en-cizgi.js";
import p_ornek from "./en-ornek.js";
// p_ornek başta: örnek sayfa etiketleriyle ("Boş" gibi) çakışan bir arayüz anahtarı varsa arayüzünki geçerli
export const EN = Object.assign({}, p_ornek, p_app_1, p_app_2, p_app_3, p_duzenleyici_1, p_duzenleyici_2, p_okuma_1, p_okuma_2, p_asistan, p_tekrar, p_izler, p_kayit_arama, p_ortak, p_araclar, p_cizgi);
