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
  eritrea: {en: ['A small, import-dependent market supplied through Massawa.', 'Certificate of origin and health certificate; terms and payment route are confirmed per contract.', 'Entry through Massawa.']},
  rwanda: {
    en: ['Landlocked: cargo arrives through Mombasa or Dar es Salaam and travels by road to Kigali.', 'East African Community standards apply; Rwanda Standards Board conformity is confirmed before shipment.', 'Transit documents are planned in the quotation.'],
    fr: ['Pays enclavé : arrivée par Mombasa ou Dar es Salaam puis par route jusqu’à Kigali.', 'Les normes de la Communauté d’Afrique de l’Est s’appliquent ; la conformité RSB est confirmée avant expédition.', 'Les documents de transit sont prévus dès la cotation.'],
  },
  burundi: {fr: ['Pays enclavé : arrivée par Dar es Salaam puis par route ou par le lac Tanganyika.', 'Normes de la Communauté d’Afrique de l’Est ; certificat d’origine et certificat sanitaire.', 'Livraison CFR Dar es Salaam, ou jusqu’à Bujumbura selon accord.']},
  lebanon: {ar: ['المخابز ومصانع الحلويات والموزعون يعتمدون على الاستيراد بعد تراجع طاقة الصوامع المحلية.', 'شهادة منشأ وشهادة صحية وتحليل مخبري عند الوصول.', 'الدخول عبر مرفأ بيروت.']},
  syria: {ar: ['طلب كبير من المخابز والموزعين لسد الفجوة في الإنتاج المحلي.', 'نراجع وضع العقوبات والقيود المصرفية قبل كل عقد، ويُتفق على طريق الدفع مسبقاً.', 'الدخول عبر اللاذقية أو طرطوس.']},
  palestine: {ar: ['المخابز والموزعون وبرامج الإغاثة هم المشترون الرئيسيون.', 'طريق الدخول والتصاريح يُحدَّد لكل شحنة حسب الوضع وقت الشحن.', 'التسليم عادة عبر الأردن أو الموانئ المجاورة.']},
  chad: {
    fr: ['Pays enclavé : arrivée par Douala puis par route jusqu’à N’Djamena (environ 1 800 km).', 'Les délais et coûts de transit pèsent dans le prix rendu : à prévoir dès la cotation.', 'Livraison CFR Douala, ou jusqu’à N’Djamena selon accord.'],
    ar: ['دولة حبيسة: تصل الشحنة إلى دوالا ثم براً إلى أنجامينا.', 'زمن النقل البري وتكلفته جزء أساسي من السعر النهائي، ويُحسب في العرض.', 'التسليم CFR دوالا، أو حتى أنجامينا حسب الاتفاق.'],
  },
  niger: {fr: ['Pays enclavé : arrivée par Cotonou ou Lomé puis par route jusqu’à Niamey.', 'Enrichissement exigé dans l’espace UEMOA ; documents de transit prévus dès la cotation.', 'Livraison CFR au port, ou jusqu’à Niamey selon accord.']},
  'central-african-republic': {fr: ['Pays enclavé : arrivée par Douala puis par route jusqu’à Bangui.', 'Inspection avant embarquement recommandée ; documents de transit prévus dès la cotation.', 'Livraison CFR Douala, ou jusqu’à Bangui selon accord.']},
  gabon: {fr: ['Marché importateur concentré sur Libreville et Port-Gentil.', "Certificat d'origine et certificat sanitaire.", 'Entrée par Owendo.']},
  congo: {fr: ['Boulangeries et grossistes de Brazzaville et Pointe-Noire.', "Certificat d'origine et certificat sanitaire ; inspection avant embarquement recommandée.", 'Entrée par Pointe-Noire.']},
  'equatorial-guinea': {fr: ['Petit marché importateur approvisionné par Malabo et Bata.', "Certificat d'origine et certificat sanitaire.", 'Entrée par Malabo ou Bata.']},
  gambia: {en: ['Banjul wholesalers also re-export into Senegal and Guinea-Bissau.', 'Certificate of origin and health certificate.', 'Entry through Banjul.']},
  'guinea-bissau': {pt: ['Mercado importador abastecido pelos grossistas de Bissau.', 'Espaço UEMOA: a farinha de trigo deve ser enriquecida com ferro e ácido fólico.', 'Entrada pelo porto de Bissau.']},
  'cape-verde': {pt: ['Arquipélago importador: padarias e distribuidores em Santiago e São Vicente.', 'Certificado de origem e certificado sanitário.', 'Entrada pela Praia ou pelo Mindelo; cargas mistas com pacotes de 1 kg são comuns.']},
  'sao-tome': {pt: ['Mercado pequeno, abastecido por distribuidores locais.', 'Certificado de origem e certificado sanitário.', 'Entrada pelo porto de São Tomé.']},
  angola: {pt: ['Grande mercado importador: padarias e distribuidores de Luanda, Benguela e Lobito.', 'Certificado de origem e certificado sanitário; análises laboratoriais à chegada são habituais.', 'Entrada por Luanda ou Lobito.']},
  mozambique: {pt: ['Padarias e grossistas de Maputo, Beira e Nampula; a Beira e Nacala servem também o Zimbabué, o Malawi e a Zâmbia.', 'A farinha de trigo deve ser fortificada.', 'Entrada por Maputo, Beira ou Nacala.']},
  'south-africa': {en: ['Local milling dominates; imported flour wins on specification, packing and reliable supply.', 'Wheat flour must be fortified, and SACU duties apply.', 'Entry through Durban or Cape Town.']},
  namibia: {en: ['Walvis Bay also serves Botswana, Zambia and southern Angola.', 'SACU member: customs duties are set at SACU level.', 'Entry through Walvis Bay.']},
  botswana: {en: ['Landlocked: cargo arrives through Durban or Walvis Bay and travels by road.', 'SACU member: customs duties are set at SACU level.', 'Transit documents are planned in the quotation.']},
  zambia: {en: ['Landlocked: cargo arrives through Dar es Salaam, Durban or Walvis Bay.', 'Certificate of origin and health certificate; transit bonds are arranged for the road leg.', 'Delivery CFR port, or to Lusaka by agreement.']},
  zimbabwe: {en: ['Landlocked: cargo arrives through Beira or Durban and travels by road.', 'Certificate of origin and health certificate; payment route is agreed in the contract.', 'Delivery CFR port, or to Harare by agreement.']},
  malawi: {en: ['Landlocked: cargo arrives through Nacala or Beira and travels by road or rail.', 'Certificate of origin and health certificate.', 'Delivery CFR port, or to Lilongwe or Blantyre by agreement.']},
  lesotho: {en: ['Supplied through South Africa: cargo lands at Durban and travels by road to Maseru.', 'SACU member: customs duties are set at SACU level.', 'Transit documents are planned in the quotation.']},
  eswatini: {en: ['Supplied through Durban or Maputo by road.', 'SACU member: customs duties are set at SACU level.', 'Transit documents are planned in the quotation.']},
  madagascar: {fr: ['Boulangeries et grossistes d’Antananarivo, approvisionnés par Toamasina.', "Certificat d'origine et certificat sanitaire.", 'Entrée par Toamasina.']},
  mauritius: {en: ['Bakeries, hotels and retailers; demand for both sacks and 1 kg packs.', 'Certificate of origin and health certificate; labelling rules apply to retail packs.', 'Entry through Port Louis.']},
  seychelles: {en: ['Small market led by hotels and retailers; mixed loads with 1 kg packs are common.', 'Certificate of origin and health certificate.', 'Entry through Port Victoria.']},
  comoros: {
    fr: ['Marché insulaire importateur ; les chargements mixtes sacs et paquets de 1 kg sont courants.', "Certificat d'origine et certificat sanitaire.", 'Entrée par Moroni.'],
    ar: ['سوق جزيرة يعتمد على الاستيراد، والشحنات المختلطة بين الأكياس وعبوات 1 كجم شائعة.', 'شهادة منشأ وشهادة صحية.', 'الدخول عبر موروني.'],
  },
};

export const BRIEF_TITLE = {ar: m => `ما يهم المستورد في ${m}`, fr: m => `Ce qui compte pour importer ${m}`, en: m => `What matters when importing into ${m}`, pt: m => `O que conta para importar ${m}`};

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
  pt: {h: 'Documentos e condições', items: [
    ['Documentos', 'Fatura comercial, lista de embalagem, conhecimento de embarque, certificado de origem e certificado sanitário. Certificado halal e certificado de análise a pedido.'],
    ['Inspeção', 'Inspeção independente antes do embarque (SGS, Bureau Veritas…) a pedido, com o custo acordado na cotação.'],
    ['Especificação', 'Indique o que precisa: proteína, humidade, cinzas, glúten húmido, falling number e fortificação. Ficam fixados na cotação e no contrato.'],
    ['Pagamento', 'Carta de crédito à vista, documentos contra pagamento ou transferência bancária, conforme o contrato.'],
  ]},
};
