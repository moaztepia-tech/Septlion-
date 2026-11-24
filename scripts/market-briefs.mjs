// What an experienced flour trader would tell an importer in each market: who buys, how the
// goods enter, and which approvals the cargo needs. Only well-established requirements are
// named; anything that changes often is phrased as "confirm before shipment".

export const BRIEFS = {
  'saudi-arabia': {ar: [
    'المشترون الرئيسيون: موزعو الجملة، وسلاسل المخابز، وقطاع الضيافة والتموين.',
    'المنتج يحتاج تسجيلاً لدى الهيئة العامة للغذاء والدواء (SFDA)، مع بطاقة بيانات عربية وشهادة حلال.',
    'الدخول عبر ميناء جدة الإسلامي للمنطقة الغربية، والدمام للشرقية والرياض.',
  ]},
  'united-arab-emirates': {ar: [
    'جبل علي مركز إعادة تصدير للخليج وشرق أفريقيا، فكثير من المشترين يعيدون توزيع الشحنة.',
    'البطاقة بالعربية والإنجليزية، وشهادة حلال، وتسجيل المنتج لدى البلدية قبل البيع.',
    'الطلب الأكبر على دقيق المخابز وعبوات 1 كجم لقنوات التجزئة.',
  ]},
  oman: {ar: [
    'سوق مخابز وتموين يعتمد على الاستيراد، ويُطلب فيه الالتزام بمواصفات الخليج (GSO).',
    'البطاقة العربية وشهادة الحلال وشهادة المنشأ من أساسيات التخليص.',
    'الدخول عبر صحار للشمال ومسقط، والشحن عادة بشرط CFR.',
  ]},
  qatar: {ar: [
    'استيراد شبه كامل لاحتياجات الدقيق، والمشترون موزعون ومخابز وتموين.',
    'التخليص يتطلب مطابقة مواصفات الخليج، وبطاقة عربية، وشهادة حلال.',
    'الدخول عبر ميناء حمد، وشحنات الحاويات الكاملة هي القاعدة.',
  ]},
  kuwait: {ar: [
    'المشترون موزعو جملة ومخابز وجمعيات تعاونية.',
    'مطابقة مواصفات الخليج، وبطاقة عربية، وشهادة حلال وشهادة منشأ.',
    'الدخول عبر الشويخ، والشحن عادة بشرط CFR أو CIF.',
  ]},
  bahrain: {ar: [
    'سوق صغير يعتمد على الاستيراد، والطلب على دقيق المخابز وعبوات التجزئة.',
    'مطابقة مواصفات الخليج وبطاقة عربية وشهادة حلال.',
    'الدخول عبر ميناء خليفة بن سلمان، أو براً من السعودية.',
  ]},
  jordan: {ar: [
    'المشترون مخابز ومصانع حلويات وموزعون، والطلب ثابت على دقيق المخابز.',
    'الإفراج يمر عبر المؤسسة العامة للغذاء والدواء الأردنية، مع شهادة منشأ وشهادة صحية.',
    'الدخول عبر العقبة، ومنها براً إلى عمّان والمحافظات.',
  ]},
  iraq: {ar: [
    'سوق كبير للمخابز والجملة، والطلب على الأكياس 50 كجم.',
    'الشحنات تحتاج شهادة مطابقة قبل الشحن (COC)، مع شهادة منشأ وشهادة صحية.',
    'الدخول عبر أم قصر، ثم براً إلى بغداد والمحافظات.',
  ]},
  yemen: {ar: [
    'طلب كبير من الموزعين وبرامج الإغاثة، وأكياس 50 كجم هي الأكثر.',
    'الشحن والتأمين والتفتيش تُراجع لكل شحنة، ويُفضّل تفتيش طرف ثالث قبل الشحن.',
    'الدخول عبر عدن أو الحديدة حسب الوضع وقت الشحن.',
  ]},
  sudan: {ar: [
    'الخبز غذاء أساسي، والمخابز وتجار الجملة يعتمدون على الدقيق المستورد لسد العجز.',
    'الشحنة تحتاج مطابقة مواصفات هيئة المواصفات والمقاييس السودانية، مع شهادة منشأ وشهادة صحية.',
    'طريقان: بحراً عبر بورتسودان، أو براً بالشاحنات من مصر عبر أرقين وقسطل، وهو الأسرع للشمال والخرطوم. أكياس 50 كجم هي الأكثر طلباً.',
  ]},
  egypt: {ar: [
    'أكبر سوق للخبز في المنطقة، والمشترون مخابز حرة ومصانع حلويات ومعكرونة وموزعون.',
    'الإفراج يتم عبر الهيئة القومية لسلامة الغذاء، مع شهادة منشأ وشهادة صحية.',
    'الدخول عبر الإسكندرية أو دمياط، والشحن عادة بشرط CFR.',
  ]},
  libya: {ar: [
    'سوق يعتمد على الاستيراد، والطلب من الموزعين والمخابز في الشرق والغرب.',
    'الشحنة تحتاج شهادة منشأ وشهادة صحية، ويُفضّل تفتيش طرف ثالث قبل الشحن.',
    'الشرق الليبي يُخدم براً من مصر عبر منفذ السلوم وامساعد، والغرب بحراً عبر طرابلس أو مصراتة.',
  ]},
  algeria: {
    ar: ['المخابز تنتج الخبز الفرنسي، فالطلب على دقيق مخابز قوي ومتجانس.', 'الاستيراد منظم وتتغير شروطه، لذلك نؤكد المتطلبات الحالية قبل كل شحنة.', 'الدخول عبر الجزائر العاصمة أو وهران.'],
    fr: ['Les boulangeries produisent la baguette : la demande porte sur une farine boulangère régulière et de bonne force.', "L'importation est encadrée et ses règles évoluent : nous confirmons les exigences en vigueur avant chaque expédition.", 'Entrée par Alger ou Oran.'],
  },
  morocco: {
    ar: ['المخابز والمطاعم تعتمد على دقيق المخابز للخبز الفرنسي والمعجنات.', 'الإفراج عبر المكتب الوطني للسلامة الصحية للمنتجات الغذائية (ONSSA)، مع شهادة منشأ.', 'الدخول عبر الدار البيضاء أو طنجة المتوسط.'],
    fr: ['Boulangeries et restauration utilisent une farine boulangère pour le pain et la viennoiserie.', "Le dédouanement passe par l'ONSSA, avec certificat d'origine et certificat sanitaire.", 'Entrée par Casablanca ou Tanger Med.'],
  },
  tunisia: {
    ar: ['المشترون مخابز ومصانع حلويات وموزعون.', 'الشحنة تحتاج شهادة منشأ وشهادة صحية ومطابقة المواصفات التونسية.', 'الدخول عبر ميناء رادس.'],
    fr: ['Les acheteurs sont des boulangeries, des pâtisseries industrielles et des distributeurs.', "Certificat d'origine, certificat sanitaire et conformité aux normes tunisiennes.", 'Entrée par le port de Radès.'],
  },
  mauritania: {
    ar: ['سوق يعتمد على الاستيراد، والطلب على أكياس 50 و25 كجم.', 'شهادة منشأ وشهادة صحية، ويُفضّل تفتيش طرف ثالث قبل الشحن.', 'الدخول عبر نواكشوط.'],
    fr: ["Marché importateur : la demande porte sur les sacs de 50 et 25 kg.", "Certificat d'origine et certificat sanitaire ; une inspection tierce avant embarquement est recommandée.", 'Entrée par Nouakchott.'],
  },
  senegal: {fr: [
    "La baguette domine : boulangeries et grossistes recherchent une farine boulangère régulière.",
    "Dans l'espace UEMOA, la farine de blé doit être enrichie en fer et en acide folique : à préciser dans la commande.",
    'Entrée par le port de Dakar, qui dessert aussi le Mali.',
  ]},
  'cote-divoire': {fr: [
    'Marché de boulangerie important, approvisionné par les grossistes d’Abidjan.',
    'Enrichissement en fer et acide folique exigé dans l’espace UEMOA ; certificat d’origine et certificat sanitaire.',
    "Entrée par Abidjan ou San-Pédro, avec réexpédition vers le Burkina Faso et le Mali.",
  ]},
  cameroon: {fr: [
    'Boulangeries et distributeurs de Douala et Yaoundé, demande régulière en sacs de 50 kg.',
    'Farine enrichie exigée ; certificat d’origine, certificat sanitaire et inspection avant embarquement.',
    "Entrée par Douala ou Kribi, porte d'accès aussi vers le Tchad et la Centrafrique.",
  ]},
  guinea: {fr: ['Grossistes et boulangeries de Conakry, demande en sacs de 50 kg.', "Certificat d'origine et certificat sanitaire ; inspection avant embarquement recommandée.", 'Entrée par le port de Conakry.']},
  benin: {fr: ['Cotonou est un port de transit vers le Niger et le Burkina Faso.', 'Enrichissement exigé dans l’espace UEMOA ; certificat d’origine et certificat sanitaire.', 'Entrée par Cotonou.']},
  togo: {fr: ['Lomé dessert le Togo et sert de port de transit vers le Sahel.', 'Enrichissement exigé dans l’espace UEMOA ; certificat d’origine et certificat sanitaire.', 'Entrée par Lomé.']},
  mali: {fr: ['Pays enclavé : la marchandise arrive par Dakar ou Abidjan puis par route.', 'Enrichissement exigé dans l’espace UEMOA ; les documents de transit doivent être prévus dès la cotation.', 'Livraison CFR au port, ou jusqu’à Bamako selon accord.']},
  'burkina-faso': {fr: ['Pays enclavé : arrivée par Abidjan, Lomé ou Tema puis par route.', 'Enrichissement exigé dans l’espace UEMOA ; documents de transit prévus dès la cotation.', 'Livraison CFR au port, ou jusqu’à Ouagadougou selon accord.']},
  'dr-congo': {fr: ['Grand marché importateur, approvisionné par les grossistes de Kinshasa.', "L'inspection de l'OCC (Office Congolais de Contrôle) s'applique à l'arrivée.", 'Entrée par Matadi.']},
  djibouti: {fr: ["Djibouti est la porte d'entrée de l'Éthiopie : une grande partie de la farine y transite.", "Certificat d'origine et certificat sanitaire ; les documents de transit vers l'Éthiopie se préparent en amont.", 'Entrée par Doraleh.']},
  nigeria: {en: [
    'Bakeries, confectioners and distributors in Lagos, Kano and Port Harcourt buy in 50 kg sacks.',
    'Flour must be NAFDAC-registered and fortified (vitamin A and other micronutrients); imports run through a Form M with a Nigerian bank.',
    'Entry through Lagos (Apapa or Tin Can Island) or Onne. Confirm current duties before contracting.',
  ]},
  ghana: {en: ['Bakeries and wholesalers in Accra and Kumasi; steady demand for 50 kg sacks.', 'Products need Ghana FDA registration, and wheat flour must be fortified.', 'Entry through Tema or Takoradi.']},
  liberia: {en: ['Import-dependent market supplied by Monrovia wholesalers.', 'Certificate of origin and health certificate; pre-shipment inspection is recommended.', 'Entry through Monrovia.']},
  'sierra-leone': {en: ['Import-dependent market supplied by Freetown wholesalers.', 'Certificate of origin and health certificate; pre-shipment inspection is recommended.', 'Entry through Freetown.']},
  kenya: {en: ['Millers, bakeries and distributors in Nairobi and Mombasa; Mombasa also serves Uganda and South Sudan.', 'Shipments need a KEBS Certificate of Conformity under the PVoC programme, and wheat flour must be fortified.', 'Entry through Mombasa.']},
  tanzania: {en: ['Bakeries and wholesalers in Dar es Salaam, with transit to Zambia, Malawi and the DRC.', 'Shipments need TBS pre-export verification of conformity, and wheat flour must be fortified.', 'Entry through Dar es Salaam.']},
  uganda: {en: ['Landlocked: cargo arrives through Mombasa and travels by road or rail to Kampala.', 'Shipments need UNBS pre-export verification of conformity, and wheat flour must be fortified.', 'Transit documents are planned in the quotation.']},
  ethiopia: {en: ['Large and growing bakery market; most imports pass through Djibouti.', 'Imports need EFDA clearance and usually a letter of credit from an Ethiopian bank.', 'Delivery CFR Djibouti, or onward to Addis Ababa by agreement.']},
  somalia: {en: ['Wholesalers in Mogadishu and Berbera, plus humanitarian buyers.', 'Certificate of origin and health certificate; pre-shipment inspection is recommended.', 'Entry through Mogadishu or Berbera.']},
  'south-sudan': {en: ['Landlocked: cargo arrives through Mombasa and travels by road to Juba.', 'Humanitarian programmes and wholesalers are the main buyers.', 'Transit documents and insurance are planned in the quotation.']},
};

export const BRIEF_TITLE = {ar: m => `ما يهم المستورد في ${m}`, fr: m => `Ce qui compte pour importer ${m}`, en: m => `What matters when importing into ${m}`};

// Documents and terms an importer can expect, in every market.
export const TRADE = {
  ar: {h: 'المستندات وشروط التعامل', items: [
    ['المستندات', 'فاتورة تجارية، وقائمة تعبئة، وبوليصة شحن، وشهادة منشأ، وشهادة صحية. شهادة الحلال وشهادة التحليل عند الطلب.'],
    ['التفتيش', 'تفتيش طرف ثالث قبل الشحن (مثل SGS أو Bureau Veritas) عند الطلب، على حساب يُتفق عليه في العرض.'],
    ['المواصفات', 'حدّد ما تحتاجه: البروتين، والرطوبة، والرماد، والجلوتين الرطب، ورقم السقوط، والتدعيم. تُثبَّت في العرض والعقد.'],
    ['الدفع', 'اعتماد مستندي بالاطلاع، أو مستندات مقابل الدفع، أو تحويل بنكي، حسب ما يُتفق عليه في العقد.'],
  ]},
  fr: {h: 'Documents et conditions', items: [
    ['Documents', "Facture commerciale, liste de colisage, connaissement, certificat d'origine et certificat sanitaire. Certificat halal et certificat d'analyse sur demande."],
    ['Inspection', 'Inspection tierce avant embarquement (SGS, Bureau Veritas…) sur demande, à la charge convenue dans la cotation.'],
    ['Spécifications', 'Indiquez vos exigences : protéines, humidité, cendres, gluten humide, indice de chute, enrichissement. Elles sont fixées dans la cotation et le contrat.'],
    ['Paiement', 'Crédit documentaire à vue, documents contre paiement ou virement, selon le contrat.'],
  ]},
  en: {h: 'Documents and terms', items: [
    ['Documents', 'Commercial invoice, packing list, bill of lading, certificate of origin and health certificate. Halal certificate and certificate of analysis on request.'],
    ['Inspection', 'Third-party pre-shipment inspection (SGS, Bureau Veritas or similar) on request, with the cost agreed in the quotation.'],
    ['Specification', 'State what you need: protein, moisture, ash, wet gluten, falling number and fortification. These are fixed in the quotation and contract.'],
    ['Payment', 'Letter of credit at sight, cash against documents or bank transfer, as agreed in the contract.'],
  ]},
};
