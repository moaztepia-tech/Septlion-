// Evergreen market pages for the countries SEPTLION targets in Africa and the Middle East.
// One page per country at /markets/<slug>/ in the language buyers there search in (Arabic,
// French or English); the Maghreb also gets a French page at /markets/<slug>/fr/.
// The pages state only what is true for every market: the ZOLLANA range, the minimum order,
// how quoting works and what to send. They make no claim of past shipments or live demand.

import {SITE, esc, englishProduct} from './customer-seo.mjs';
import {themeCss, ICON_WA, productVisual} from './seo-theme.mjs';
import {BRIEFS, BRIEF_TITLE, TRADE} from './market-briefs.mjs';

const WHATSAPP = '201070088181', EMAIL = 'info@septlion.com';
const ld = v => JSON.stringify(v).replace(/</g, '\\u003c');

// slug, languages (first is the main page), region, names {ar,fr,en}, ports {ar,fr,en}
export const MARKETS = [
  // Middle East
  ['saudi-arabia', ['ar'], 'me', {ar: 'السعودية', en: 'Saudi Arabia'}, {ar: 'جدة أو الدمام', en: 'Jeddah or Dammam'}],
  ['united-arab-emirates', ['ar'], 'me', {ar: 'الإمارات', en: 'United Arab Emirates'}, {ar: 'جبل علي', en: 'Jebel Ali'}],
  ['oman', ['ar'], 'me', {ar: 'عُمان', en: 'Oman'}, {ar: 'صحار أو مسقط', en: 'Sohar or Muscat'}],
  ['qatar', ['ar'], 'me', {ar: 'قطر', en: 'Qatar'}, {ar: 'ميناء حمد', en: 'Hamad Port'}],
  ['kuwait', ['ar'], 'me', {ar: 'الكويت', en: 'Kuwait'}, {ar: 'الشويخ', en: 'Shuwaikh'}],
  ['bahrain', ['ar'], 'me', {ar: 'البحرين', en: 'Bahrain'}, {ar: 'ميناء خليفة بن سلمان', en: 'Khalifa Bin Salman Port'}],
  ['jordan', ['ar'], 'me', {ar: 'الأردن', en: 'Jordan'}, {ar: 'العقبة', en: 'Aqaba'}],
  ['iraq', ['ar'], 'me', {ar: 'العراق', en: 'Iraq'}, {ar: 'أم قصر', en: 'Umm Qasr'}],
  ['yemen', ['ar'], 'me', {ar: 'اليمن', en: 'Yemen'}, {ar: 'عدن أو الحديدة', en: 'Aden or Hodeidah'}],
  // North Africa
  ['sudan', ['ar'], 'na', {ar: 'السودان', en: 'Sudan'}, {ar: 'بورتسودان', en: 'Port Sudan'}],
  ['egypt', ['ar'], 'na', {ar: 'مصر', en: 'Egypt'}, {ar: 'الإسكندرية أو دمياط', en: 'Alexandria or Damietta'}],
  ['libya', ['ar'], 'na', {ar: 'ليبيا', en: 'Libya'}, {ar: 'طرابلس أو بنغازي أو مصراتة', en: 'Tripoli, Benghazi or Misrata'}],
  ['algeria', ['ar', 'fr'], 'na', {ar: 'الجزائر', fr: 'Algérie', en: 'Algeria'}, {ar: 'الجزائر العاصمة أو وهران', fr: 'Alger ou Oran', en: 'Algiers or Oran'}],
  ['morocco', ['ar', 'fr'], 'na', {ar: 'المغرب', fr: 'Maroc', en: 'Morocco'}, {ar: 'الدار البيضاء أو طنجة المتوسط', fr: 'Casablanca ou Tanger Med', en: 'Casablanca or Tanger Med'}],
  ['tunisia', ['ar', 'fr'], 'na', {ar: 'تونس', fr: 'Tunisie', en: 'Tunisia'}, {ar: 'رادس', fr: 'Radès', en: 'Rades'}],
  ['mauritania', ['ar', 'fr'], 'na', {ar: 'موريتانيا', fr: 'Mauritanie', en: 'Mauritania'}, {ar: 'نواكشوط', fr: 'Nouakchott', en: 'Nouakchott'}],
  // West and Central Africa (French)
  ['senegal', ['fr'], 'wa', {fr: 'Sénégal', en: 'Senegal'}, {fr: 'Dakar', en: 'Dakar'}],
  ['cote-divoire', ['fr'], 'wa', {fr: "Côte d'Ivoire", en: "Côte d'Ivoire"}, {fr: 'Abidjan ou San-Pédro', en: 'Abidjan or San-Pédro'}],
  ['cameroon', ['fr'], 'wa', {fr: 'Cameroun', en: 'Cameroon'}, {fr: 'Douala ou Kribi', en: 'Douala or Kribi'}],
  ['guinea', ['fr'], 'wa', {fr: 'Guinée', en: 'Guinea'}, {fr: 'Conakry', en: 'Conakry'}],
  ['benin', ['fr'], 'wa', {fr: 'Bénin', en: 'Benin'}, {fr: 'Cotonou', en: 'Cotonou'}],
  ['togo', ['fr'], 'wa', {fr: 'Togo', en: 'Togo'}, {fr: 'Lomé', en: 'Lomé'}],
  ['mali', ['fr'], 'wa', {fr: 'Mali', en: 'Mali'}, {fr: 'Dakar ou Abidjan, puis transport terrestre', en: 'Dakar or Abidjan, then overland'}],
  ['burkina-faso', ['fr'], 'wa', {fr: 'Burkina Faso', en: 'Burkina Faso'}, {fr: 'Abidjan ou Lomé, puis transport terrestre', en: 'Abidjan or Lomé, then overland'}],
  ['dr-congo', ['fr'], 'wa', {fr: 'RD Congo', en: 'DR Congo'}, {fr: 'Matadi', en: 'Matadi'}],
  ['djibouti', ['fr'], 'ea', {fr: 'Djibouti', en: 'Djibouti'}, {fr: 'Port de Djibouti (Doraleh)', en: 'Djibouti (Doraleh)'}],
  // West and East Africa (English)
  ['nigeria', ['en'], 'wa', {en: 'Nigeria'}, {en: 'Lagos Apapa or Tin Can Island'}],
  ['ghana', ['en'], 'wa', {en: 'Ghana'}, {en: 'Tema'}],
  ['liberia', ['en'], 'wa', {en: 'Liberia'}, {en: 'Monrovia'}],
  ['sierra-leone', ['en'], 'wa', {en: 'Sierra Leone'}, {en: 'Freetown'}],
  ['kenya', ['en'], 'ea', {en: 'Kenya'}, {en: 'Mombasa'}],
  ['tanzania', ['en'], 'ea', {en: 'Tanzania'}, {en: 'Dar es Salaam'}],
  ['uganda', ['en'], 'ea', {en: 'Uganda'}, {en: 'Mombasa, then overland'}],
  ['ethiopia', ['en'], 'ea', {en: 'Ethiopia'}, {en: 'Djibouti, then overland'}],
  ['somalia', ['en'], 'ea', {en: 'Somalia'}, {en: 'Mogadishu or Berbera'}],
  ['south-sudan', ['en'], 'ea', {en: 'South Sudan'}, {en: 'Mombasa, then overland'}],
].map(([slug, langs, region, names, ports]) => ({slug, langs, region, names, ports}));

const REGIONS = {
  me: {ar: 'الشرق الأوسط', fr: 'Moyen-Orient', en: 'Middle East'},
  na: {ar: 'شمال أفريقيا', fr: 'Afrique du Nord', en: 'North Africa'},
  wa: {ar: 'غرب ووسط أفريقيا', fr: "Afrique de l'Ouest et centrale", en: 'West and Central Africa'},
  ea: {ar: 'شرق أفريقيا', fr: "Afrique de l'Est", en: 'East Africa'},
};

export const marketUrl = (m, lang) => `${SITE}/markets/${m.slug}/${lang === m.langs[0] ? '' : lang + '/'}`;

// French product wording, built from the English mapping so the facts stay identical.
function frenchProduct(e) {
  const type = {'All-purpose wheat flour': 'Farine de blé tout usage', 'Bakery wheat flour': 'Farine de blé boulangère', 'Whole wheat flour': 'Farine de blé complète'}[e.type] || e.type;
  const use = {'Cooking and baking': 'Cuisine et pâtisserie', 'Bread and bakery products': 'Pain et viennoiserie', 'Whole-grain bread': 'Pain complet'}[e.use] || e.use;
  const pack = e.pack.startsWith('Paper') ? 'Sachets papier, packs filmés de 10 × 1 kg' : e.pack === 'Woven PP sack' ? 'Sac en polypropylène tissé' : e.pack;
  const n = e.perContainer.match(/About ([\d,]+) (sacks|shrink packs|units)/);
  const unit = n && {sacks: 'sacs', 'shrink packs': 'packs filmés', units: 'unités'}[n[2]];
  return {...e, type, use, pack, moq: 'Un conteneur de 20 pieds',
    perContainer: n ? `Environ ${n[1].replace(/,/g, ' ')} ${unit} par conteneur de 20 pieds` : 'Confirmé dans la cotation'};
}
const field = (p, label) => (p.fields || []).find(f => f.l === label)?.v || '';
function arabicProduct(p) {
  const e = englishProduct(p);
  return {image: e.image, brand: 'زولانا', name: p.name, size: p.size, type: p.type, use: field(p, 'الاستخدام'),
    pack: p.pack, moq: field(p, 'أقل طلب') || 'حاوية واحدة 20 قدماً', perContainer: field(p, 'كمية الحاوية') || 'تُحدَّد في عرض السعر'};
}
const productIn = (p, lang) => lang === 'ar' ? arabicProduct(p) : lang === 'fr' ? frenchProduct(englishProduct(p)) : englishProduct(p);

const T = {
  ar: {
    dir: 'rtl', locale: 'ar_AR', home: '/', homeLabel: 'الرئيسية', all: 'كل الأسواق',
    title: m => `توريد دقيق القمح إلى ${m} بالجملة | زولانا من SEPTLION`,
    desc: (m, port) => `دقيق قمح زولانا بالجملة للمستوردين والمطاحن والمخابز وتجار الجملة في ${m}. أقل طلب حاوية 20 قدماً، والتسليم إلى ${port} أو الميناء الذي تختاره. اطلب عرض سعر واحداً واضحاً من SEPTLION.`,
    kicker: r => `${r} · توريد تجاري بين الشركات`,
    h1: m => `توريد دقيق القمح إلى ${m}`,
    lead: (m, port) => `دقيق قمح زولانا للمستوردين والمخابز وتجار الجملة في ${m}. أرسل الصنف والكمية والتعبئة وميناء الوصول (مثل ${port})، ويصلك عرض سعر واحد واضح يشمل المواصفات وشروط الشحن والدفع.`,
    wa: 'اطلب عرض سعر على واتساب', waText: m => `مرحباً، أريد عرض سعر لدقيق قمح زولانا إلى ${m}.`, mail: 'راسلنا بالبريد',
    prodH: 'أصناف زولانا', prodSub: 'أقل طلب حاوية 20 قدماً. السعر يُحدَّد في عرض السعر حسب الوجهة والكمية والشروط.',
    labels: ['التعبئة', 'أقل طلب', 'كمية الحاوية', 'الاستخدام'],
    howH: 'كيف يتم الطلب', steps: [['أرسل احتياجك', 'الصنف، والكمية بالحاويات، والتعبئة، وميناء الوصول.'], ['استلم عرضاً واحداً', 'المواصفات والكمية والميناء وشرط الشحن (FOB أو CFR أو CIF) وشروط الدفع في عرض واحد.'], ['تابع التنفيذ', 'بعد الاتفاق تنسّق SEPTLION التوريد والتصنيع والمستندات والشحن حتى التسليم.']],
    sendH: 'ماذا ترسل لنا؟', send: ['الصنف ووزن العبوة (50 أو 25 أو 10 أو 1 كجم)', 'الكمية بعدد الحاويات وتكرار الطلب', 'ميناء الوصول أو مدينة التسليم', 'شرط الشحن المفضل: FOB أو CFR أو CIF', 'أي مواصفات أو شهادات مطلوبة في بلدك'],
    faqH: 'أسئلة شائعة',
    faq: (m, port) => [[`هل تورّدون دقيق القمح إلى ${m}؟`, `نعم، نجهّز عرض سعر لأي مشترٍ تجاري في ${m}، والتسليم إلى ${port} أو الميناء الذي تحدده.`], ['ما أقل كمية؟', 'حاوية واحدة 20 قدماً من أي صنف.'], ['ما التعبئة المتاحة؟', 'أكياس 50 و25 كجم، وأكياس 10 كجم، وعبوات 1 كجم مجمّعة.'], ['هل السعر ثابت؟', 'لا. السعر يُبنى على الكمية والتعبئة والوجهة وشرط الشحن، ويصلك في عرض السعر.'], ['من هي SEPTLION؟', 'شركة تجارة بين الشركات مسجلة في الولايات المتحدة، تحوّل طلب المشتري إلى عرض سعر واحد وتنسّق التوريد والشحن حتى التسليم.']],
    others: 'أسواق أخرى', footer: 'SEPTLION LLC · مسجلة في الولايات المتحدة',
    idxTitle: 'توريد دقيق القمح إلى أفريقيا والشرق الأوسط | SEPTLION', idxH1: 'أسواقنا في أفريقيا والشرق الأوسط', idxLead: 'اختر بلدك لترى أصناف زولانا وطريقة طلب عرض السعر والتسليم إلى أقرب ميناء.',
  },
  fr: {
    dir: 'ltr', locale: 'fr_FR', home: '/en/', homeLabel: 'Accueil', all: 'Tous les marchés',
    title: m => `Farine de blé en gros ${m} | ZOLLANA par SEPTLION`,
    desc: (m, port) => `Farine de blé ZOLLANA en gros pour importateurs, boulangeries et grossistes ${m}. Commande minimum : un conteneur de 20 pieds, livraison à ${port} ou au port de votre choix. Demandez une cotation claire à SEPTLION.`,
    kicker: r => `${r} · Fourniture B2B`,
    h1: m => `Farine de blé en gros ${m}`,
    lead: (m, port) => `Farine de blé ZOLLANA pour importateurs, boulangeries et grossistes ${m}. Indiquez le produit, la quantité, l'emballage et le port de destination (par exemple ${port}) : vous recevez une seule cotation claire avec spécifications, Incoterm et conditions de paiement.`,
    wa: 'Demander une cotation sur WhatsApp', waText: m => `Bonjour, je souhaite une cotation pour la farine de blé ZOLLANA ${m}.`, mail: 'Écrire par e-mail',
    prodH: 'La gamme ZOLLANA', prodSub: 'Commande minimum : un conteneur de 20 pieds. Le prix est donné dans la cotation selon la destination, le volume et les conditions.',
    labels: ['Emballage', 'Commande minimum', 'Par conteneur', 'Usage'],
    howH: 'Comment commander', steps: [['Envoyez votre besoin', 'Produit, nombre de conteneurs, emballage et port de destination.'], ['Recevez une cotation unique', 'Spécifications, quantité, port, Incoterm (FOB, CFR ou CIF) et paiement dans une seule offre.'], ["Suivez l'exécution", "Après accord, SEPTLION coordonne l'approvisionnement, la fabrication, les documents et le transport jusqu'à la livraison."]],
    sendH: 'Que nous envoyer ?', send: ["Le produit et le poids du sac (50, 25, 10 ou 1 kg)", 'La quantité en conteneurs et la fréquence', 'Le port ou la ville de livraison', "L'Incoterm souhaité : FOB, CFR ou CIF", 'Les normes ou certificats exigés dans votre pays'],
    faqH: 'Questions fréquentes',
    faq: (m, port) => [[`Livrez-vous de la farine de blé ${m} ?`, `Oui. Nous établissons une cotation pour tout acheteur professionnel ${m}, avec livraison à ${port} ou au port que vous indiquez.`], ['Quelle est la commande minimum ?', "Un conteneur de 20 pieds, quel que soit le produit."], ['Quels emballages ?', 'Sacs de 50 et 25 kg, sacs de 10 kg et sachets de 1 kg en packs filmés.'], ['Le prix est-il fixe ?', "Non. Le prix dépend du volume, de l'emballage, de la destination et de l'Incoterm ; il figure dans la cotation."], ['Qui est SEPTLION ?', "Une société de négoce B2B enregistrée aux États-Unis : elle transforme le besoin de l'acheteur en une cotation unique et coordonne l'approvisionnement et le transport jusqu'à la livraison."]],
    others: 'Autres marchés', footer: 'SEPTLION LLC · Société enregistrée aux États-Unis',
    idxTitle: 'Farine de blé en gros pour l’Afrique et le Moyen-Orient | SEPTLION', idxH1: "Nos marchés en Afrique et au Moyen-Orient", idxLead: 'Choisissez votre pays pour voir la gamme ZOLLANA, la demande de cotation et la livraison au port le plus proche.',
  },
  en: {
    dir: 'ltr', locale: 'en_US', home: '/en/', homeLabel: 'Home', all: 'All markets',
    title: m => `Wholesale Wheat Flour Supply to ${m} | ZOLLANA by SEPTLION`,
    desc: (m, port) => `ZOLLANA wheat flour in bulk for importers, bakeries and wholesalers in ${m}. Minimum order one 20 ft container, delivered to ${port} or your chosen port. Request one clear quotation from SEPTLION.`,
    kicker: r => `${r} · B2B supply`,
    h1: m => `Wheat flour supply to ${m}`,
    lead: (m, port) => `ZOLLANA wheat flour for importers, bakeries and wholesalers in ${m}. Send the product, quantity, packing and destination port (for example ${port}) and receive one clear quotation with specification, Incoterm and payment terms.`,
    wa: 'Request a quotation on WhatsApp', waText: m => `Hello, I would like a quotation for ZOLLANA wheat flour to ${m}.`, mail: 'Email us',
    prodH: 'ZOLLANA flour range', prodSub: 'Minimum order is one 20 ft container. Prices are given in the quotation for your destination, volume and terms.',
    labels: ['Packing', 'Minimum order', 'Per container', 'Use'],
    howH: 'How to order', steps: [['Send your requirement', 'Product, number of containers, packing and destination port.'], ['Receive one quotation', 'Specification, quantity, port, Incoterm (FOB, CFR or CIF) and payment terms in a single offer.'], ['Follow execution', 'After agreement, SEPTLION coordinates supply, manufacturing, documents and logistics to delivery.']],
    sendH: 'What to send us', send: ['Product and bag size (50, 25, 10 or 1 kg)', 'Quantity in containers and how often', 'Destination port or delivery city', 'Preferred Incoterm: FOB, CFR or CIF', 'Any standards or certificates required in your country'],
    faqH: 'Frequently asked questions',
    faq: (m, port) => [[`Do you supply wheat flour to ${m}?`, `Yes. We prepare a quotation for any commercial buyer in ${m}, delivered to ${port} or the port you name.`], ['What is the minimum order?', 'One 20 ft container of any product.'], ['Which packing is available?', '50 kg and 25 kg sacks, 10 kg bags and 1 kg packs, shrink-wrapped.'], ['Is the price fixed?', 'No. The price depends on volume, packing, destination and Incoterm, and is given in the quotation.'], ['Who is SEPTLION?', 'A US-registered B2B managed-trade company that turns a buyer requirement into one quotation and coordinates supply and shipping through to delivery.']],
    others: 'Other markets', footer: 'SEPTLION LLC · Registered in the United States',
    idxTitle: 'Wholesale Wheat Flour Supply to Africa and the Middle East | SEPTLION', idxH1: 'Our markets in Africa and the Middle East', idxLead: 'Choose your country to see the ZOLLANA range, how to request a quotation and delivery to your nearest port.',
  },
};

// Interface words that are not part of the market copy.
const U = {
  ar: {products: 'المنتجات', how: 'طريقة الطلب', markets: 'الأسواق', quote: 'اطلب عرض سعر', facts: ['أقل طلب', 'شروط الشحن', 'ميناء الوصول', 'التعبئة'],
    factVals: ['حاوية 20 قدماً', 'FOB · CFR · CIF', null, 'من 1 إلى 50 كجم'], msgLabel: 'رسالة جاهزة يمكنك إرسالها كما هي:',
    msg: m => `مرحباً SEPTLION،\nأحتاج عرض سعر لدقيق قمح زولانا إلى ${m}.\nالصنف والوزن: …\nالكمية (عدد الحاويات): …\nميناء الوصول: …\nشرط الشحن: CFR / CIF / FOB`,
    bandH: 'جاهز لطلب عرض السعر؟', bandP: 'أرسل احتياجك على واتساب، ويصلك عرض واحد واضح.', email: 'البريد الإلكتروني', foot: ['الرئيسية', 'كل الأسواق', 'مسارات الطلب'], allH: 'كل الأسواق'},
  fr: {products: 'Produits', how: 'Commander', markets: 'Marchés', quote: 'Demander une cotation', facts: ['Commande minimum', 'Incoterms', 'Port de destination', 'Emballage'],
    factVals: ['1 conteneur 20 pieds', 'FOB · CFR · CIF', null, 'De 1 à 50 kg'], msgLabel: 'Message prêt à envoyer :',
    msg: m => `Bonjour SEPTLION,\nJe souhaite une cotation pour la farine de blé ZOLLANA ${m}.\nProduit et poids : …\nQuantité (conteneurs) : …\nPort de destination : …\nIncoterm : CFR / CIF / FOB`,
    bandH: 'Prêt à demander une cotation ?', bandP: 'Envoyez votre besoin sur WhatsApp et recevez une offre claire.', email: 'E-mail', foot: ['Accueil', 'Tous les marchés', 'Routes de demande'], allH: 'Tous les marchés'},
  en: {products: 'Products', how: 'How to order', markets: 'Markets', quote: 'Request a quotation', facts: ['Minimum order', 'Incoterms', 'Destination port', 'Packing'],
    factVals: ['One 20 ft container', 'FOB · CFR · CIF', null, '1 kg to 50 kg'], msgLabel: 'A ready message you can send as it is:',
    msg: m => `Hello SEPTLION,\nI need a quotation for ZOLLANA wheat flour to ${m}.\nProduct and bag size: …\nQuantity (containers): …\nDestination port: …\nIncoterm: CFR / CIF / FOB`,
    bandH: 'Ready for a quotation?', bandP: 'Send your requirement on WhatsApp and receive one clear offer.', email: 'Email', foot: ['Home', 'All markets', 'Demand routes'], allH: 'All markets'},
};

// Markets served by road. Filled in from the team's answer; each entry is
// {mode: 'land' | 'both', route: {ar, fr, en}} and switches the page's facts,
// wording and Incoterms from sea freight to trucks and border crossings.
export const LAND = {};
const LAND_UI = {
  ar: {route: 'طريق الشحن', terms: {land: 'DAP · FCA · CPT', both: 'بحراً: CFR · CIF — براً: DAP'}, moq: 'حاوية أو شاحنة كاملة', note: r => `الشحن براً ${r}، بالشاحنات حتى مستودعك أو نقطة التسليم المتفق عليها.`},
  fr: {route: 'Acheminement', terms: {land: 'DAP · FCA · CPT', both: 'Mer : CFR · CIF — Route : DAP'}, moq: 'Un conteneur ou un camion complet', note: r => `Livraison par route ${r}, en camion jusqu'à votre entrepôt ou au point convenu.`},
  en: {route: 'Route', terms: {land: 'DAP · FCA · CPT', both: 'Sea: CFR · CIF — Road: DAP'}, moq: 'One container or full truck', note: r => `Delivered by road ${r}, by truck to your warehouse or the agreed delivery point.`},
};
const nameIn = (m, lang) => m.names[lang] || m.names.en;
// French needs the country with its preposition: "au Sénégal", "en Côte d'Ivoire".
const FR_IN = {algeria: 'en Algérie', morocco: 'au Maroc', tunisia: 'en Tunisie', mauritania: 'en Mauritanie', senegal: 'au Sénégal', 'cote-divoire': "en Côte d'Ivoire", cameroon: 'au Cameroun', guinea: 'en Guinée', benin: 'au Bénin', togo: 'au Togo', mali: 'au Mali', 'burkina-faso': 'au Burkina Faso', 'dr-congo': 'en RD Congo', djibouti: 'à Djibouti'};
const phraseIn = (m, lang) => lang === 'fr' ? FR_IN[m.slug] || 'pour ' + nameIn(m, 'fr') : nameIn(m, lang);
const portIn = (m, lang) => m.ports[lang] || m.ports.en;
const waLink = text => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

export function pageHead({lang, title, desc, url, alternates = [], jsonld = []}) {
  const t = T[lang];
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${alternates.map(a => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}">`).join('')}
<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="#051945">
<meta property="og:type" content="website"><meta property="og:site_name" content="SEPTLION"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${SITE}/new-app/icons/og-image.png"><meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/new-app/favicon.ico"><link rel="preload" href="/new-app/fonts/cairo-${lang === 'ar' ? 'arabic' : 'latin'}-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${themeCss}</style>
${jsonld.map(j => `<script type="application/ld+json">${ld(j)}</script>`).join('\n')}
</head><body>`;
}

export function topBar(lang, {home, alt = [], wa, anchors = true}) {
  const u = U[lang];
  return `<header class="top"><div class="wrap"><a class="logo" href="${home}" aria-label="SEPTLION"><img src="/brand/septlion-wordmark-white.svg" alt="SEPTLION" width="124" height="44"></a>
<nav aria-label="SEPTLION">${anchors ? `<a class="hide-s" href="#products">${u.products}</a><a class="hide-s" href="#how">${u.how}</a>` : ''}<a href="/markets/">${u.markets}</a>${alt.map(a => `<a class="lang" href="${a.href}" hreflang="${a.lang}" lang="${a.lang}">${a.label}</a>`).join('')}</nav>
<a class="btn pri" href="${esc(wa)}">${ICON_WA}${u.quote}</a></div></header>`;
}

export function footer(lang, home) {
  const u = U[lang], t = T[lang];
  return `<footer class="foot"><div class="wrap"><img src="/brand/septlion-wordmark-white.svg" alt="SEPTLION" width="110" height="40"><nav><a href="${home}">${u.foot[0]}</a><a href="/markets/">${u.foot[1]}</a><a href="/demand/">${u.foot[2]}</a><a href="mailto:${EMAIL}">${EMAIL}</a></nav><span>${esc(t.footer)}</span></div></footer>`;
}

export const dock = (lang, wa) => `<div class="dock"><a class="btn pri" href="${esc(wa)}">${ICON_WA}${U[lang].quote}</a></div>`;

export function productGrid(products, lang) {
  const t = T[lang];
  return `<div class="products">${products.map(p => productIn(p, lang)).map(e => `<article class="pcard">${productVisual({image: e.image && esc(e.image), alt: esc(`${e.name} ${e.size} — ${e.brand}`), name: esc(e.name), size: esc(e.size)})}
<div class="pbody"><span class="ptype">${esc(e.brand)} · ${esc(e.type)}</span><h3 class="pname">${esc(e.name)}</h3><dl class="pfacts"><div><dt>${t.labels[0]}</dt><dd>${esc(e.pack)}</dd></div><div><dt>${t.labels[1]}</dt><dd>${esc(e.moq)}</dd></div><div><dt>${t.labels[2]}</dt><dd>${esc(e.perContainer)}</dd></div>${e.use ? `<div><dt>${t.labels[3]}</dt><dd>${esc(e.use)}</dd></div>` : ''}</dl></div></article>`).join('')}</div>`;
}

export const stepsList = lang => `<ol class="steps">${T[lang].steps.map(([a, b]) => `<li><b>${esc(a)}</b><p>${esc(b)}</p></li>`).join('')}</ol>`;
export const tradeBlock = lang => `<div class="tgrid">${TRADE[lang].items.map(([k, v]) => `<div class="panel"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}</div>`;
export const faqList = items => `<div class="faq">${items.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;

export function marketPage(m, lang, products) {
  const t = T[lang], u = U[lang], name = nameIn(m, lang), say = phraseIn(m, lang), port = portIn(m, lang), url = marketUrl(m, lang);
  const alternates = m.langs.length > 1 ? [...m.langs.map(l => ({lang: l, href: marketUrl(m, l)})), {lang: 'x-default', href: marketUrl(m, m.langs[0])}] : [];
  const title = t.title(say), desc = t.desc(say, port), faq = t.faq(say, port);
  const wa = waLink(u.msg(say));
  const alt = m.langs.filter(l => l !== lang).map(l => ({lang: l, href: marketUrl(m, l), label: l === 'ar' ? 'العربية' : 'Français'}));
  const same = MARKETS.filter(x => x !== m && x.langs.includes(lang)).map(x => `<li><a href="${marketUrl(x, lang)}">${esc(nameIn(x, lang))}</a></li>`).join('');
  const land = LAND[m.slug], lu = LAND_UI[lang], route = land && (land.route[lang] || land.route.en);
  const factVals = u.factVals.map(v => v ?? port);
  const factNames = [...u.facts];
  if (land) {
    factVals[1] = lu.terms[land.mode];
    if (land.mode === 'land') { factNames[2] = lu.route; factVals[2] = route; factVals[0] = lu.moq; }
  }
  const landNote = land ? `<p class="lead" style="margin-top:12px">${esc(lu.note(route))}</p>` : '';
  const jsonld = [
    {'@context': 'https://schema.org', '@type': 'Service', name: t.h1(say), inLanguage: lang, serviceType: 'B2B wheat flour supply', url,
      areaServed: {'@type': 'Country', name: m.names.en}, provider: {'@type': 'Organization', '@id': SITE + '/#organization', name: 'SEPTLION', url: SITE + '/'},
      brand: {'@type': 'Brand', name: 'ZOLLANA'}, description: desc},
    {'@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang, mainEntity: faq.map(([q, a]) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))},
    {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{'@type': 'ListItem', position: 1, name: 'SEPTLION', item: SITE + '/'}, {'@type': 'ListItem', position: 2, name: t.all, item: SITE + '/markets/'}, {'@type': 'ListItem', position: 3, name, item: url}]},
  ];
  return pageHead({lang, title, desc, url, alternates, jsonld}) + topBar(lang, {home: t.home, alt, wa}) + `
<main>
<section class="hero wrap"><span class="eyebrow">${esc(t.kicker(REGIONS[m.region][lang]))}</span><h1>${esc(t.h1(say))}</h1><p class="lead">${esc(t.lead(say, port))}</p>
<div class="cta"><a class="btn pri" href="${esc(wa)}">${ICON_WA}${esc(t.wa)}</a><a class="btn" href="mailto:${EMAIL}">${esc(t.mail)}</a></div>
${landNote}<div class="facts">${factNames.map((f, i) => `<div><span>${esc(f)}</span><b>${esc(factVals[i])}</b></div>`).join('')}</div></section>
${(BRIEFS[m.slug]?.[lang] || []).length ? `<section class="block wrap" aria-labelledby="bH"><div class="brief"><div><span class="eyebrow">${esc(REGIONS[m.region][lang])}</span><h2 id="bH">${esc(BRIEF_TITLE[lang](lang === 'fr' ? phraseIn(m, 'fr').replace(/^(au|en|à|pour) /, (x) => ({'au ': 'au ', 'en ': 'en ', 'à ': 'à ', 'pour ': 'vers '})[x]) : name))}</h2></div><ol class="points">${BRIEFS[m.slug][lang].map(b => `<li>${esc(b)}</li>`).join('')}</ol></div></section>` : ''}
<section class="block wrap" id="products" aria-labelledby="pH"><div class="head"><div><span class="eyebrow">ZOLLANA</span><h2 id="pH">${esc(t.prodH)}</h2><p class="sub">${esc(t.prodSub)}</p></div></div>${productGrid(products, lang)}</section>
<section class="block wrap" id="how" aria-labelledby="hH"><div class="head"><div><span class="eyebrow">SEPTLION</span><h2 id="hH">${esc(t.howH)}</h2></div></div>${stepsList(lang)}</section>
<section class="block wrap" aria-labelledby="tH"><div class="head"><div><span class="eyebrow">SEPTLION</span><h2 id="tH">${esc(TRADE[lang].h)}</h2></div></div>${tradeBlock(lang)}</section>
<section class="block wrap" aria-labelledby="sH"><div class="split"><div class="panel"><h2 id="sH" style="font-size:26px;margin:0 0 18px">${esc(t.sendH)}</h2><ul class="checks">${t.send.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
<div class="panel"><p class="sub" style="margin:0 0 12px">${esc(u.msgLabel)}</p><p class="msg">${esc(u.msg(say))}</p><a class="btn pri" style="width:100%" href="${esc(wa)}">${ICON_WA}${esc(t.wa)}</a></div></div></section>
<section class="block wrap" aria-labelledby="fH"><div class="head"><h2 id="fH">${esc(t.faqH)}</h2></div>${faqList(faq)}</section>
<section class="wrap"><div class="band"><div><h2>${esc(u.bandH)}</h2><p>${esc(u.bandP)}</p></div><div class="cta"><a class="btn pri" href="${esc(wa)}">${ICON_WA}${esc(t.wa)}</a><a class="btn" href="mailto:${EMAIL}">${esc(u.email)}</a></div></div></section>
${same ? `<section class="block wrap" aria-labelledby="oH"><div class="head"><h2 id="oH" style="font-size:24px">${esc(t.others)}</h2></div><ul class="chips">${same}</ul></section>` : ''}
</main>
${footer(lang, t.home)}${dock(lang, wa)}
</body></html>
`;
}

export function marketsIndex() {
  const lang = 'en', t = T.en, url = SITE + '/markets/';
  const wa = waLink(U.en.msg('my country'));
  const groups = Object.entries(REGIONS).map(([r, label]) => {
    const items = MARKETS.filter(m => m.region === r).map(m => `<li><a href="${marketUrl(m, m.langs[0])}" lang="${m.langs[0]}">${esc(nameIn(m, m.langs[0]))}${m.langs[0] !== 'en' ? ` · ${esc(m.names.en)}` : ''}</a></li>`).join('');
    return `<div class="panel"><h3>${esc(label.en)} <span class="sub" style="font-size:14px">· ${esc(label.ar)} · ${esc(label.fr)}</span></h3><ul class="chips">${items}</ul></div>`;
  }).join('');
  const jsonld = [{'@context': 'https://schema.org', '@type': 'CollectionPage', name: t.idxTitle, url,
    hasPart: MARKETS.map(m => ({'@type': 'WebPage', name: T[m.langs[0]].h1(phraseIn(m, m.langs[0])), url: marketUrl(m, m.langs[0]), inLanguage: m.langs[0]}))}];
  return pageHead({lang, title: t.idxTitle, desc: t.idxLead, url, jsonld}) + topBar(lang, {home: t.home, wa, anchors: false}) + `
<main><section class="hero wrap"><span class="eyebrow">ZOLLANA · SEPTLION</span><h1>${esc(t.idxH1)}</h1><p class="lead">${esc(t.idxLead)}</p><p class="lead" lang="ar" dir="rtl" style="margin-top:10px">${esc(T.ar.idxLead)}</p><p class="lead" lang="fr" style="margin-top:10px">${esc(T.fr.idxLead)}</p></section>
<section class="block wrap"><div class="regions">${groups}</div></section></main>
${footer(lang, t.home)}${dock(lang, wa)}</body></html>
`;
}

/** Every market page as {path, html, url, lang, alternates} for writing and for the sitemap. */
export function allMarketPages(products) {
  const pages = [{path: 'markets/index.html', html: marketsIndex(), url: SITE + '/markets/', lang: 'en', alternates: []}];
  for (const m of MARKETS) for (const lang of m.langs) {
    const url = marketUrl(m, lang);
    pages.push({path: 'markets/' + m.slug + '/' + (lang === m.langs[0] ? '' : lang + '/') + 'index.html', html: marketPage(m, lang, products), url, lang, market: m.names.en,
      alternates: m.langs.length > 1 ? [...m.langs.map(l => ({lang: l, href: marketUrl(m, l)})), {lang: 'x-default', href: marketUrl(m, m.langs[0])}] : []});
  }
  return pages;
}
