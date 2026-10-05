/* =========================================================
   Café Mouhsine BOUAGHAZ — catalogue data
   Edit prices, products and services here (or from admin.html).
   Prices are in Moroccan dirhams (DH).
   ========================================================= */

const IMG = (id, w = 640) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

window.CAFE_CONFIG = {
  name: "Café Mouhsine BOUAGHAZ",
  phone: "+212646103161",          // WhatsApp number used for orders & bookings
  phoneDisplay: "+212 6 46 10 31 61",
  email: "bghz.mouhsine@gmail.com",
  address: { ar: "شارع محمد الخامس، مكناس، المغرب", fr: "Avenue Mohammed V, Meknès, Maroc", en: "Mohammed V Avenue, Meknes, Morocco" },
  mapQuery: "Meknes, Morocco",
  currency: "DH",
  deliveryFee: 15,
  freeDeliveryFrom: 150,
  serviceRate: 0,                   // e.g. 0.10 for 10% service charge on dine-in
  // 0 = Sunday ... 6 = Saturday — [open, close] in 24h, close may pass midnight
  hours: {
    0: ["08:00", "00:00"], 1: ["07:00", "23:30"], 2: ["07:00", "23:30"], 3: ["07:00", "23:30"],
    4: ["07:00", "23:30"], 5: ["07:00", "00:30"], 6: ["08:00", "00:30"]
  },
  socials: { instagram: "#", facebook: "#", tiktok: "#" },
  // legal identity shown on legal.html — fill in the empty values ("" = highlighted as "to complete")
  legal: {
    company: "",            // raison sociale, e.g. "Café Mouhsine SARL AU"
    form: "",               // SARL, SARL AU, entreprise individuelle…
    capital: "",            // e.g. "100 000 DH"
    rc: "",                 // registre du commerce, e.g. "RC 12345 – Meknès"
    ice: "",                // identifiant commun de l'entreprise (15 chiffres)
    if: "",                 // identifiant fiscal
    patente: "",            // taxe professionnelle
    director: "Mouhsine BOUAGHAZ",   // directeur de la publication
    host: "",               // hébergeur du site: name + address (e.g. Firebase Hosting / Netlify)
    cndp: "",               // n° de récépissé de déclaration CNDP (loi 09-08)
    city: { ar: "مكناس", fr: "Meknès", en: "Meknes" },   // tribunal compétent, zone de livraison
    updated: "2026-10-04"
  },
  // automatic discount: days (0 = Sunday), time window, categories, percentage
  happyHour: { days: [1, 2, 3, 4, 5], from: "15:00", to: "17:00", cats: ["cold", "juice"], pct: 20 }
};

window.CAFE_CATEGORIES = [
  { id: "all",       icon: "✦",  ar: "الكل",            fr: "Tout",              en: "All" },
  { id: "offers",    icon: "🎁", ar: "العروض",          fr: "Formules",          en: "Set menus" },
  { id: "hot",       icon: "☕", ar: "قهوة ساخنة",      fr: "Cafés chauds",      en: "Hot coffee" },
  { id: "cold",      icon: "🧊", ar: "مشروبات باردة",   fr: "Boissons glacées",  en: "Iced drinks" },
  { id: "tea",       icon: "🍃", ar: "شاي وأعشاب",      fr: "Thés & infusions",  en: "Tea & infusions" },
  { id: "juice",     icon: "🍊", ar: "عصائر وسموذي",    fr: "Jus & smoothies",   en: "Juices & smoothies" },
  { id: "breakfast", icon: "🍳", ar: "فطور",            fr: "Petit-déjeuner",    en: "Breakfast" },
  { id: "pastry",    icon: "🥐", ar: "مخبوزات",         fr: "Viennoiseries",     en: "Bakery" },
  { id: "dessert",   icon: "🍰", ar: "حلويات",          fr: "Desserts",          en: "Desserts" },
  { id: "shop",      icon: "🛍", ar: "متجر البن",       fr: "Boutique café",     en: "Coffee shop" }
];

window.CAFE_PRODUCTS = [
  /* ---------------- SET MENUS (was = price if bought separately) ---------------- */
  { id: "combo-morning", cat: "offers", price: 35, was: 42, img: IMG("photo-1555507036-ab1f4038808a"), tags: ["best"], kcal: 0,
    ar: ["فطور سريع", "نص نص أو قهوة + كرواسون بالزبدة + عصير برتقال طبيعي. إلى غاية 11:00."],
    fr: ["Formule Matin", "Nos-Nos ou café + croissant pur beurre + jus d'orange pressé. Jusqu'à 11 h."],
    en: ["Morning set", "Nos-Nos or coffee + butter croissant + fresh orange juice. Until 11 am."] },
  { id: "combo-student", cat: "offers", price: 22, was: 26, img: IMG("photo-1558961363-fa8fdf82db35"), tags: ["new"], kcal: 0,
    ar: ["عرض الطالب", "نص نص + كوكيز + ساعتان من الويفي. بتقديم بطاقة الطالب."],
    fr: ["Formule Étudiant", "Nos-Nos + cookie + 2 h de Wi-Fi. Sur présentation de la carte étudiant."],
    en: ["Student deal", "Nos-Nos + cookie + 2 h of Wi-Fi. Student card required."] },
  { id: "combo-duo", cat: "offers", price: 99, was: 104, img: IMG("photo-1495474472287-4d71bcdd2085"), tags: [], kcal: 0,
    ar: ["عرض الثنائي", "2 كابتشينو + 2 حلويات من اختياركم."],
    fr: ["Formule Duo", "2 cappuccinos + 2 desserts au choix."],
    en: ["Duo deal", "2 cappuccinos + 2 desserts of your choice."] },
  { id: "combo-brunch", cat: "offers", price: 99, was: 125, img: IMG("photo-1567620905732-2d1ec7ab7445"), tags: ["local"], kcal: 0,
    ar: ["برانش بلدي لشخصين", "2 فطور بلدي + براد أتاي بالنعناع. السبت والأحد."],
    fr: ["Brunch Beldi pour 2", "2 petits-déj Beldi + une théière de thé à la menthe. Samedi et dimanche."],
    en: ["Beldi brunch for 2", "2 Beldi breakfasts + a pot of mint tea. Saturday & Sunday."] },
  { id: "combo-office", cat: "offers", price: 149, was: 180, img: IMG("photo-1497515114629-f71d768fd07c"), tags: ["signature"], kcal: 0,
    ar: ["علبة المكتب", "6 مشروبات قهوة + 6 مخبوزات، توصل لمكتبكم ساخنة."],
    fr: ["Box Bureau", "6 cafés + 6 viennoiseries, livrés chauds à votre bureau."],
    en: ["Office box", "6 coffees + 6 pastries, delivered hot to your office."] },

  /* ---------------- HOT COFFEE ---------------- */
  { id: "espresso", cat: "hot", price: 12, img: IMG("photo-1610889556528-9a770e32642f"), tags: ["best"], kcal: 5,
    sizes: [["S", 0], ["Double", 6]],
    ar: ["إسبريسو", "جرعة مركزة من خلطة البيت المحمصة يومياً، كريما ذهبية."],
    fr: ["Espresso", "Extraction serrée de notre mélange maison torréfié chaque jour, crema dorée."],
    en: ["Espresso", "A tight shot of our house blend, roasted daily, with golden crema."] },
  { id: "americano", cat: "hot", price: 15, img: IMG("photo-1514432324607-a09d9b4aefdd"), tags: [], kcal: 10,
    sizes: [["M", 0], ["L", 4]],
    ar: ["أمريكانو", "إسبريسو مع ماء ساخن، طعم نظيف ومتوازن."],
    fr: ["Americano", "Espresso allongé à l'eau chaude, goût net et équilibré."],
    en: ["Americano", "Espresso lengthened with hot water — clean and balanced."] },
  { id: "noss-noss", cat: "hot", price: 14, img: IMG("photo-1544787219-7f47ccb76574"), tags: ["local", "best"], kcal: 90,
    sizes: [["M", 0], ["L", 4]],
    ar: ["نص نص", "الكلاسيكية المغربية: نصف قهوة ونصف حليب في كأس زجاجي."],
    fr: ["Nos-Nos", "Le classique marocain : moitié café, moitié lait, servi en verre."],
    en: ["Nos-Nos", "The Moroccan classic: half coffee, half milk, served in a glass."] },
  { id: "cappuccino", cat: "hot", price: 20, img: IMG("photo-1572442388796-11668a67e53d"), tags: ["best"], kcal: 120,
    sizes: [["M", 0], ["L", 5]],
    ar: ["كابتشينو", "إسبريسو، حليب مبخر ورغوة حريرية كثيفة."],
    fr: ["Cappuccino", "Espresso, lait vapeur et mousse soyeuse généreuse."],
    en: ["Cappuccino", "Espresso, steamed milk and a generous silky foam."] },
  { id: "latte", cat: "hot", price: 22, img: IMG("photo-1541167760496-1628856ab772"), tags: [], kcal: 150,
    sizes: [["M", 0], ["L", 5]],
    ar: ["لاتيه", "قهوة ناعمة بالحليب مع رسم لاتيه آرت."],
    fr: ["Café latte", "Café doux au lait, décoré d'un latte art."],
    en: ["Caffè latte", "Smooth milky coffee finished with latte art."] },
  { id: "flat-white", cat: "hot", price: 24, img: IMG("photo-1485808191679-5f86510681a2"), tags: [], kcal: 110,
    ar: ["فلات وايت", "جرعتا ريستريتو مع حليب مخملي رقيق."],
    fr: ["Flat white", "Double ristretto et micro-mousse de lait veloutée."],
    en: ["Flat white", "Double ristretto with velvety micro-foam."] },
  { id: "spanish-latte", cat: "hot", price: 26, img: IMG("photo-1534778101976-62847782c213"), tags: ["new"], kcal: 210,
    ar: ["سبانيش لاتيه", "إسبريسو مع الحليب المكثف المحلى، غني وكريمي."],
    fr: ["Spanish latte", "Espresso et lait concentré sucré, riche et crémeux."],
    en: ["Spanish latte", "Espresso with sweetened condensed milk — rich and creamy."] },
  { id: "pour-over", cat: "hot", price: 32, img: IMG("photo-1442512595331-e89e73853f31"), tags: ["signature"], kcal: 5,
    ar: ["قهوة مختصة V60", "بن أحادي المصدر (إثيوبيا / كولومبيا) يُحضّر يدوياً أمامك."],
    fr: ["Café de spécialité V60", "Origine unique (Éthiopie / Colombie) préparé à la main devant vous."],
    en: ["Specialty V60 pour-over", "Single origin (Ethiopia / Colombia) hand-brewed in front of you."] },

  /* ---------------- ICED ---------------- */
  { id: "iced-latte", cat: "cold", price: 25, img: IMG("photo-1517701604599-bb29b565090c"), tags: ["best"], kcal: 140,
    sizes: [["M", 0], ["L", 5]],
    ar: ["آيس لاتيه", "إسبريسو مع حليب بارد ومكعبات ثلج."],
    fr: ["Iced latte", "Espresso, lait froid et glaçons."],
    en: ["Iced latte", "Espresso over cold milk and ice."] },
  { id: "cold-brew", cat: "cold", price: 28, img: IMG("photo-1461023058943-07fcbe16d735"), tags: ["signature"], kcal: 15,
    ar: ["كولد برو", "منقوع 18 ساعة على البارد، منخفض الحموضة."],
    fr: ["Cold brew", "Infusé à froid 18 heures, faible acidité."],
    en: ["Cold brew", "Steeped cold for 18 hours, low acidity."] },
  { id: "bubble-coffee", cat: "cold", price: 32, img: IMG("photo-1525803377221-4f6ccdaa5133"), tags: ["new"], kcal: 260,
    ar: ["قهوة بالبابل", "قهوة بالحليب مع لؤلؤ التابيوكا بالكراميل."],
    fr: ["Bubble coffee", "Café au lait et perles de tapioca caramel."],
    en: ["Bubble coffee", "Milk coffee with caramel tapioca pearls."] },
  { id: "iced-tea", cat: "cold", price: 22, img: IMG("photo-1556679343-c7306c1976bc"), tags: [], kcal: 90,
    ar: ["آيس تي بالخوخ", "شاي أسود مبرد مع الخوخ والليمون."],
    fr: ["Thé glacé pêche", "Thé noir infusé à froid, pêche et citron."],
    en: ["Peach iced tea", "Cold-brewed black tea with peach and lemon."] },

  /* ---------------- TEA ---------------- */
  { id: "atay", cat: "tea", price: 15, img: IMG("photo-1594631252845-29fc4cc8cde9"), tags: ["local", "best"], kcal: 60,
    sizes: [["Verre", 0], ["Théière", 20]],
    ar: ["أتاي بالنعناع", "الشاي المغربي الأصيل بالنعناع الطري — كأس أو براد."],
    fr: ["Thé à la menthe", "L'authentique thé marocain à la menthe fraîche — verre ou théière."],
    en: ["Moroccan mint tea", "Authentic Moroccan tea with fresh mint — glass or teapot."] },
  { id: "herbal", cat: "tea", price: 18, img: IMG("photo-1576092768241-dec231879fc3"), tags: [], kcal: 0,
    ar: ["منقوع الأعشاب", "لويزة، زعتر، بابونج أو شيبة حسب الاختيار."],
    fr: ["Infusion", "Verveine, thym, camomille ou absinthe au choix."],
    en: ["Herbal infusion", "Verbena, thyme, chamomile or wormwood — your pick."] },
  { id: "chai", cat: "tea", price: 24, img: IMG("photo-1517487881594-2787fef5ebf7"), tags: [], kcal: 160,
    ar: ["شاي لاتيه بالتوابل", "شاي أسود بالقرفة والهيل والزنجبيل مع الحليب."],
    fr: ["Chai latte", "Thé noir épicé cannelle, cardamome, gingembre et lait."],
    en: ["Chai latte", "Black tea spiced with cinnamon, cardamom, ginger and milk."] },

  /* ---------------- JUICES ---------------- */
  { id: "orange", cat: "juice", price: 18, img: IMG("photo-1600271886742-f049cd451bba"), tags: ["best"], kcal: 110,
    ar: ["عصير برتقال طبيعي", "برتقال مغربي معصور عند الطلب."],
    fr: ["Jus d'orange pressé", "Oranges marocaines pressées minute."],
    en: ["Fresh orange juice", "Moroccan oranges squeezed to order."] },
  { id: "lemonade", cat: "juice", price: 20, img: IMG("photo-1621263764928-df1444c5e859"), tags: [], kcal: 95,
    ar: ["ليموناضة بالنعناع", "ليمون، نعناع طري وقليل من العسل."],
    fr: ["Citronnade menthe", "Citron, menthe fraîche et une touche de miel."],
    en: ["Mint lemonade", "Lemon, fresh mint and a touch of honey."] },
  { id: "mojito", cat: "juice", price: 25, img: IMG("photo-1556881286-fc6915169721"), tags: [], kcal: 120,
    ar: ["موخيتو بدون كحول", "ليم، نعناع، صودا وثلج مجروش."],
    fr: ["Virgin mojito", "Citron vert, menthe, soda et glace pilée."],
    en: ["Virgin mojito", "Lime, mint, soda and crushed ice."] },
  { id: "avocado", cat: "juice", price: 28, img: IMG("photo-1622597467836-f3285f2131b8"), tags: ["local"], kcal: 340,
    ar: ["عصير أفوكادو باللوز", "أفوكادو، حليب، لوز وتمر — كوكتيل مغربي شهير."],
    fr: ["Jus d'avocat aux amandes", "Avocat, lait, amandes et dattes — le cocktail marocain."],
    en: ["Avocado almond shake", "Avocado, milk, almonds and dates — a Moroccan favourite."] },
  { id: "detox", cat: "juice", price: 26, img: IMG("photo-1505252585461-04db1eb84625"), tags: ["new"], kcal: 150,
    ar: ["سموذي الفواكه الحمراء", "فراولة، توت، موز وزبادي."],
    fr: ["Smoothie fruits rouges", "Fraise, myrtille, banane et yaourt."],
    en: ["Berry smoothie", "Strawberry, blueberry, banana and yogurt."] },

  /* ---------------- BREAKFAST ---------------- */
  { id: "beldi", cat: "breakfast", price: 45, img: IMG("photo-1567620905732-2d1ec7ab7445"), tags: ["local", "best"], kcal: 720,
    ar: ["فطور بلدي", "بيض بلدي، مسمن، بغرير، زيت زيتون، أملو، عسل + مشروب ساخن + عصير."],
    fr: ["Petit-déj Beldi", "Œufs beldi, msemen, baghrir, huile d'olive, amlou, miel + boisson chaude + jus."],
    en: ["Beldi breakfast", "Free-range eggs, msemen, baghrir, olive oil, amlou, honey + hot drink + juice."] },
  { id: "avo-toast", cat: "breakfast", price: 38, img: IMG("photo-1525351484163-7529414344d8"), tags: [], kcal: 480,
    ar: ["توست الأفوكادو", "خبز العجين المخمر، أفوكادو مهروس، بيضة مقلية وبذور."],
    fr: ["Avocado toast", "Pain au levain, avocat écrasé, œuf au plat et graines."],
    en: ["Avocado toast", "Sourdough, smashed avocado, fried egg and seeds."] },
  { id: "pancakes", cat: "breakfast", price: 35, img: IMG("photo-1528207776546-365bb710ee93"), tags: [], kcal: 610,
    ar: ["بان كيك", "ثلاث طبقات مع موز، توت وشراب القيقب."],
    fr: ["Pancakes", "Trois pancakes, banane, myrtilles et sirop d'érable."],
    en: ["Pancakes", "A stack of three with banana, blueberries and maple syrup."] },
  { id: "french-toast", cat: "breakfast", price: 36, img: IMG("photo-1484723091739-30a097e8f929"), tags: ["new"], kcal: 590,
    ar: ["فرنش توست", "بريوش مكرمل مع فواكه طازجة وكريمة."],
    fr: ["Pain perdu", "Brioche caramélisée, fruits frais et crème."],
    en: ["French toast", "Caramelised brioche, fresh fruit and cream."] },

  /* ---------------- PASTRY ---------------- */
  { id: "croissant", cat: "pastry", price: 10, img: IMG("photo-1555507036-ab1f4038808a"), tags: ["best"], kcal: 270,
    ar: ["كرواسون بالزبدة", "مخبوز كل صباح بالزبدة الطبيعية."],
    fr: ["Croissant pur beurre", "Cuit chaque matin, pur beurre."],
    en: ["Butter croissant", "Baked every morning with real butter."] },
  { id: "cookies", cat: "pastry", price: 12, img: IMG("photo-1558961363-fa8fdf82db35"), tags: [], kcal: 210,
    ar: ["كوكيز الشوكولاتة", "مقرمش من الخارج وطري من الداخل."],
    fr: ["Cookie chocolat", "Croustillant dehors, fondant dedans."],
    en: ["Chocolate cookie", "Crisp outside, gooey inside."] },
  { id: "sourdough", cat: "pastry", price: 25, img: IMG("photo-1586444248902-2f64eddc13df"), tags: ["signature"], kcal: 0,
    ar: ["خبز العجين المخمر", "رغيف حرفي 48 ساعة تخمير — للأخذ."],
    fr: ["Pain au levain", "Miche artisanale, 48 h de fermentation — à emporter."],
    en: ["Sourdough loaf", "Artisan loaf, 48-hour fermentation — to take home."] },

  /* ---------------- DESSERTS ---------------- */
  { id: "tiramisu", cat: "dessert", price: 32, img: IMG("photo-1571877227200-a0d98ea607e9"), tags: ["best"], kcal: 420,
    ar: ["تيراميسو", "ماسكاربوني، بسكويت مشبع بإسبريسو البيت وكاكاو."],
    fr: ["Tiramisu", "Mascarpone, biscuits imbibés d'espresso maison, cacao."],
    en: ["Tiramisu", "Mascarpone, ladyfingers soaked in house espresso, cocoa."] },
  { id: "choco-cake", cat: "dessert", price: 30, img: IMG("photo-1578985545062-69928b1d9587"), tags: [], kcal: 480,
    ar: ["كيكة الشوكولاتة", "شوكولاتة داكنة 70٪ مع غاناش لامع."],
    fr: ["Gâteau chocolat", "Chocolat noir 70 % et ganache brillante."],
    en: ["Chocolate cake", "70% dark chocolate with glossy ganache."] },
  { id: "raspberry", cat: "dessert", price: 34, img: IMG("photo-1565958011703-44f9829ba187"), tags: ["new"], kcal: 390,
    ar: ["كيكة الفستق والتوت", "إسفنج الفستق، كريمة خفيفة وتوت العليق."],
    fr: ["Pistache-framboise", "Biscuit pistache, crème légère et framboises."],
    en: ["Pistachio raspberry", "Pistachio sponge, light cream and raspberries."] },
  { id: "brownie", cat: "dessert", price: 22, img: IMG("photo-1606313564200-e75d5e30476c"), tags: [], kcal: 360,
    ar: ["براوني", "براوني طري بالجوز، يقدم دافئاً."],
    fr: ["Brownie", "Brownie fondant aux noix, servi tiède."],
    en: ["Brownie", "Fudgy walnut brownie, served warm."] },
  { id: "panna", cat: "dessert", price: 26, img: IMG("photo-1488477181946-6428a0291777"), tags: [], kcal: 300,
    ar: ["بانا كوتا", "كريمة الفانيليا مع صلصة الفراولة."],
    fr: ["Panna cotta", "Crème vanille et coulis de fraise."],
    en: ["Panna cotta", "Vanilla cream with strawberry coulis."] },

  /* ---------------- SHOP ---------------- */
  { id: "beans-250", cat: "shop", price: 95, img: IMG("photo-1559056199-641a0ac8b55e"), tags: ["signature"], kcal: 0,
    sizes: [["250g", 0], ["500g", 80], ["1kg", 170]],
    ar: ["بن البيت — حبوب", "خلطة Mouhsine المحمصة: شوكولاتة، كراميل وبندق."],
    fr: ["Café maison — grains", "Mélange Mouhsine torréfié : chocolat, caramel, noisette."],
    en: ["House blend — beans", "Mouhsine roast: chocolate, caramel and hazelnut notes."] },
  { id: "kit", cat: "shop", price: 390, img: IMG("photo-1611854779393-1b2da9d400fe"), tags: ["new"], kcal: 0,
    ar: ["عدة التحضير المنزلي", "مطحنة يدوية + كوب حراري + 250غ من البن."],
    fr: ["Kit barista maison", "Moulin manuel + mug isotherme + 250 g de café."],
    en: ["Home barista kit", "Hand grinder + insulated mug + 250 g of coffee."] },
  { id: "gift", cat: "shop", price: 200, img: IMG("photo-1495474472287-4d71bcdd2085"), tags: [], kcal: 0,
    sizes: [["200", 0], ["500", 300], ["1000", 800]],
    ar: ["بطاقة هدية", "بطاقة رقمية ترسل عبر واتساب، صالحة 12 شهراً."],
    fr: ["Carte cadeau", "Carte digitale envoyée par WhatsApp, valable 12 mois."],
    en: ["Gift card", "Digital card sent via WhatsApp, valid for 12 months."] }
];

window.CAFE_SERVICES = [
  { id: "delivery", icon: "🛵", price: 15, unit: { ar: "للطلب", fr: "/ commande", en: "/ order" },
    img: IMG("photo-1509042239860-f550ce710b93"),
    ar: ["التوصيل للمنازل", "توصيل خلال 30-45 دقيقة داخل المدينة. مجاني ابتداءً من 150 درهم."],
    fr: ["Livraison à domicile", "Livraison en 30-45 min en ville. Offerte dès 150 DH."],
    en: ["Home delivery", "30–45 min delivery in town. Free from 150 DH."] },
  { id: "cowork", icon: "💻", price: 30, unit: { ar: "/ ساعتين", fr: "/ 2 h", en: "/ 2 h" },
    img: IMG("photo-1521017432531-fbd92d768814"),
    ar: ["فضاء العمل", "ويفي ألياف بصرية، مقابس كهربائية ومشروب مجاني. باقة يومية 90 درهم."],
    fr: ["Espace coworking", "Wi-Fi fibre, prises et boisson offerte. Pass journée 90 DH."],
    en: ["Coworking pass", "Fibre Wi-Fi, power outlets and a free drink. Day pass 90 DH."] },
  { id: "events", icon: "🎉", price: 1500, unit: { ar: "/ سهرة", fr: "/ soirée", en: "/ evening" },
    img: IMG("photo-1600093463592-8e36ae95ef56"),
    ar: ["كراء القاعة الخاصة", "حتى 40 شخصاً: أعياد ميلاد، اجتماعات، حفلات خطوبة. يشمل التزيين."],
    fr: ["Privatisation salle", "Jusqu'à 40 pers. : anniversaires, réunions, fiançailles. Déco incluse."],
    en: ["Private room hire", "Up to 40 guests: birthdays, meetings, engagements. Decor included."] },
  { id: "catering", icon: "🍽", price: 65, unit: { ar: "/ شخص", fr: "/ pers.", en: "/ guest" },
    img: IMG("photo-1612203985729-70726954388c"),
    ar: ["كوفي بريك وتموين", "للشركات والمؤتمرات: قهوة، شاي، عصير، مملحات وحلويات."],
    fr: ["Coffee break & traiteur", "Entreprises & séminaires : café, thé, jus, salé et sucré."],
    en: ["Coffee break & catering", "Corporate & conferences: coffee, tea, juice, savoury & sweet."] },
  { id: "workshop", icon: "🎓", price: 450, unit: { ar: "/ مشارك", fr: "/ participant", en: "/ person" },
    img: IMG("photo-1511920170033-f8396924c348"),
    ar: ["ورشة الباريستا", "3 ساعات تطبيقية: الإسبريسو، رغوة الحليب واللاتيه آرت + شهادة."],
    fr: ["Atelier barista", "3 h de pratique : espresso, mousse de lait, latte art + certificat."],
    en: ["Barista workshop", "3 hands-on hours: espresso, milk texturing, latte art + certificate."] },
  { id: "subscription", icon: "📦", price: 180, unit: { ar: "/ شهر", fr: "/ mois", en: "/ month" },
    img: IMG("photo-1447933601403-0c6688de566e"),
    ar: ["اشتراك البن الشهري", "500غ من البن الطازج كل شهر مع التوصيل المجاني."],
    fr: ["Abonnement café", "500 g de café frais chaque mois, livraison offerte."],
    en: ["Coffee subscription", "500 g of fresh coffee every month, free delivery."] }
];

window.CAFE_GALLERY = [
  IMG("photo-1554118811-1e0d58224f24", 900),
  IMG("photo-1453614512568-c4024d13c247", 900),
  IMG("photo-1495474472287-4d71bcdd2085", 900),
  IMG("photo-1501339847302-ac426a4a7cbb", 900),
  IMG("photo-1559925393-8be0ec4767c8", 900),
  IMG("photo-1497935586351-b67a49e012bf", 900)
];

/* ---------- drink customisation (price added per unit) ---------- */
window.CAFE_EXTRAS = {
  milk: { multi: false, ar: "نوع الحليب", fr: "Lait", en: "Milk", options: [
    ["whole", 0, { ar: "حليب عادي", fr: "Lait entier", en: "Whole milk" }],
    ["lactose", 3, { ar: "بدون لاكتوز", fr: "Sans lactose", en: "Lactose-free" }],
    ["oat", 5, { ar: "حليب الشوفان", fr: "Lait d'avoine", en: "Oat milk" }],
    ["almond", 5, { ar: "حليب اللوز", fr: "Lait d'amande", en: "Almond milk" }]] },
  shot: { multi: true, ar: "إضافات", fr: "Suppléments", en: "Add-ons", options: [
    ["shot", 6, { ar: "جرعة إسبريسو إضافية", fr: "Shot d'espresso", en: "Extra espresso shot" }],
    ["cream", 4, { ar: "كريمة مخفوقة", fr: "Chantilly", en: "Whipped cream" }]] },
  syrup: { multi: false, ar: "النكهة", fr: "Sirop", en: "Syrup", options: [
    ["none", 0, { ar: "بدون", fr: "Aucun", en: "None" }],
    ["vanilla", 4, { ar: "فانيليا", fr: "Vanille", en: "Vanilla" }],
    ["caramel", 4, { ar: "كراميل", fr: "Caramel", en: "Caramel" }],
    ["hazelnut", 4, { ar: "بندق", fr: "Noisette", en: "Hazelnut" }]] },
  sugar: { multi: false, ar: "السكر", fr: "Sucre", en: "Sugar", options: [
    ["normal", 0, { ar: "عادي", fr: "Normal", en: "Regular" }],
    ["less", 0, { ar: "قليل", fr: "Peu sucré", en: "Less sugar" }],
    ["none", 0, { ar: "بدون سكر", fr: "Sans sucre", en: "No sugar" }]] }
};

/* ---------- per-product extras, diet labels & allergens ----------
   diet: veg (vegetarian), vegan, gf (gluten-free)
   allergens: milk, gluten, egg, nuts */
(() => {
  const M = "milk", G = "gluten", E = "egg", N = "nuts";
  const FULL = ["milk", "shot", "syrup", "sugar"];
  const META = {
    "espresso":      { extras: ["shot", "sugar"], diet: ["vegan", "gf"] },
    "americano":     { extras: ["shot", "syrup", "sugar"], diet: ["vegan", "gf"] },
    "noss-noss":     { extras: ["milk", "sugar"], diet: ["veg", "gf"], allergens: [M] },
    "cappuccino":    { extras: FULL, diet: ["veg", "gf"], allergens: [M] },
    "latte":         { extras: FULL, diet: ["veg", "gf"], allergens: [M] },
    "flat-white":    { extras: FULL, diet: ["veg", "gf"], allergens: [M] },
    "spanish-latte": { extras: ["milk", "shot"], diet: ["veg", "gf"], allergens: [M] },
    "pour-over":     { extras: ["sugar"], diet: ["vegan", "gf"] },
    "iced-latte":    { extras: FULL, diet: ["veg", "gf"], allergens: [M] },
    "cold-brew":     { extras: ["milk", "syrup", "sugar"], diet: ["vegan", "gf"] },
    "bubble-coffee": { extras: ["milk", "sugar"], diet: ["veg", "gf"], allergens: [M] },
    "iced-tea":      { extras: ["sugar"], diet: ["vegan", "gf"] },
    "atay":          { extras: ["sugar"], diet: ["vegan", "gf"] },
    "herbal":        { extras: ["sugar"], diet: ["vegan", "gf"] },
    "chai":          { extras: ["milk", "sugar"], diet: ["veg", "gf"], allergens: [M] },
    "orange":        { diet: ["vegan", "gf"] },
    "lemonade":      { diet: ["veg", "gf"] },
    "mojito":        { diet: ["vegan", "gf"] },
    "avocado":       { diet: ["veg", "gf"], allergens: [M, N] },
    "detox":         { diet: ["veg", "gf"], allergens: [M] },
    "beldi":         { diet: ["veg"], allergens: [G, E, M, N] },
    "avo-toast":     { diet: ["veg"], allergens: [G, E] },
    "pancakes":      { diet: ["veg"], allergens: [G, E, M] },
    "french-toast":  { diet: ["veg"], allergens: [G, E, M] },
    "croissant":     { diet: ["veg"], allergens: [G, M, E] },
    "cookies":       { diet: ["veg"], allergens: [G, M, E] },
    "sourdough":     { diet: ["vegan"], allergens: [G] },
    "tiramisu":      { diet: ["veg"], allergens: [G, E, M] },
    "choco-cake":    { diet: ["veg"], allergens: [G, E, M] },
    "raspberry":     { diet: ["veg"], allergens: [G, E, M, N] },
    "brownie":       { diet: ["veg"], allergens: [G, E, M, N] },
    "panna":         { diet: ["veg", "gf"], allergens: [M] },
    "beans-250":     { diet: ["vegan", "gf"] },
    "combo-morning": { diet: ["veg"], allergens: [G, M, E] },
    "combo-student": { diet: ["veg"], allergens: [G, M, E] },
    "combo-duo":     { diet: ["veg"], allergens: [G, M, E] },
    "combo-brunch":  { diet: ["veg"], allergens: [G, E, M, N] },
    "combo-office":  { diet: ["veg"], allergens: [G, M, E] }
  };
  window.CAFE_PRODUCTS.forEach(p => Object.assign(p, { extras: [], diet: [], allergens: [] }, META[p.id] || {}));
})();
