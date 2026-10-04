/* =========================================================
   Café Mouhsine BOUAGHAZ — legal texts (templates)
   Moroccan framework: loi 09-08 (données personnelles, CNDP),
   loi 31-08 (protection du consommateur), loi 53-05 (échange
   électronique de données juridiques), Code de commerce.
   {{tokens}} are filled from CAFE_CONFIG on legal.html; empty
   values are highlighted "to complete".
   These templates are not legal advice: have them reviewed.
   ========================================================= */
window.LEGAL_TEXTS = {
  /* ======================= FRANÇAIS ======================= */
  fr: {
    ui: { title: "Informations légales", mentions: "Mentions légales", cgv: "Conditions générales de vente", privacy: "Politique de confidentialité",
      updated: "Dernière mise à jour :", print: "Imprimer", back: "Retour au site", todo: "à compléter", toc: "Sommaire",
      draft: "Modèle à faire valider par un professionnel du droit avant mise en ligne. Les éléments surlignés sont à compléter dans js/data.js (CAFE_CONFIG.legal)." },
    mentions: [
      ["Éditeur du site", `<p>Le site <b>{{name}}</b> est édité par :</p>
        <ul><li>Raison sociale : {{company}}</li><li>Forme juridique : {{form}} — capital social : {{capital}}</li>
        <li>Siège : {{address}}</li><li>Registre du commerce : {{rc}}</li><li>ICE : {{ice}} — IF : {{if}} — Taxe professionnelle : {{patente}}</li>
        <li>Téléphone : {{phone}} — E-mail : {{email}}</li></ul>`],
      ["Directeur de la publication", `<p>{{director}}</p>`],
      ["Hébergement", `<p>{{host}}</p>`],
      ["Propriété intellectuelle", `<p>Le nom, le logo, les textes et la présentation du site sont la propriété de l'éditeur. Toute reproduction sans autorisation écrite est interdite. Certaines photographies proviennent de la banque d'images Unsplash et sont utilisées selon sa licence. Elles sont illustratives : la présentation réelle des produits peut varier.</p>`],
      ["Données personnelles", `<p>Le traitement des données personnelles collectées sur ce site est décrit dans la <a href="#privacy">politique de confidentialité</a>. Déclaration auprès de la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP) : {{cndp}}.</p>`],
      ["Responsabilité", `<p>L'éditeur s'efforce de tenir à jour les informations du site (menu, prix, horaires) mais ne peut garantir l'absence d'erreurs. En cas d'erreur manifeste de prix, le prix affiché en magasin prévaut. Les liens vers des services tiers (WhatsApp, Google Maps) relèvent de la responsabilité de leurs éditeurs.</p>`]
    ],
    cgv: [
      ["1. Objet et champ d'application", `<p>Les présentes conditions régissent les commandes de produits (boissons, plats, viennoiseries, café en grains, cartes cadeaux) et les réservations de services (tables, salle privée, coffee break, ateliers, coworking, abonnement) passées auprès de {{name}}, sur place, sur ce site ou par WhatsApp. Elles s'appliquent conformément à la loi n° 31-08 édictant des mesures de protection du consommateur. Passer une commande ou une réservation vaut acceptation des présentes conditions.</p>`],
      ["2. Prix", `<p>Les prix sont indiqués en dirhams marocains (DH), toutes taxes comprises. Ils peuvent être modifiés à tout moment ; le prix applicable est celui affiché au moment de la commande.</p>
        <ul><li><b>Happy hour</b> : {{hhpct}} % de remise sur les catégories indiquées sur le menu, du lundi au vendredi de {{hhfrom}} à {{hhto}}, dans la limite des produits disponibles.</li>
        <li><b>Codes promotionnels et remises fidélité</b> : un seul code par commande ; ils ne sont pas cumulables entre eux ni avec la remise du programme fidélité. La remise la plus avantageuse pour le client s'applique.</li>
        <li><b>Formules</b> : composition et conditions (horaires, carte étudiant…) indiquées sur le menu.</li></ul>`],
      ["3. Commande", `<p>La commande en ligne se fait en ajoutant des produits au panier puis en l'envoyant. Elle est transmise directement à la cuisine ou, à défaut, par WhatsApp. Le contrat est formé lorsque le café accepte la commande, c'est-à-dire quand sa préparation commence. Le café peut refuser une commande en cas d'indisponibilité d'un produit, d'adresse hors zone de livraison ou de demande anormale ; le client en est alors informé.</p>
        <p>Le suivi (« Reçue », « En préparation », « Prête ») est indicatif. Le total affiché est vérifié par le personnel au moment du service ou de la livraison.</p>`],
      ["4. Paiement", `<p>Le paiement s'effectue au café ou à la livraison, en espèces ou par carte bancaire. Les prestations sur devis (événements, coffee break) peuvent être réglées par virement. Aucun paiement n'est demandé ni enregistré sur ce site.</p>`],
      ["5. Livraison et retrait", `<ul><li>Zone de livraison : {{city}} et environs immédiats, selon disponibilité.</li>
        <li>Frais : {{fee}} DH par commande, offerts à partir de {{free}} DH d'achats (après remise).</li>
        <li>Délai indicatif : 30 à 45 minutes, susceptible de varier selon l'affluence et la météo. Le client doit rester joignable au numéro indiqué.</li>
        <li>À emporter : la commande est à retirer au comptoir avec sa référence.</li></ul>
        <p>En cas de produit manquant ou non conforme, signalez-le immédiatement au livreur ou au comptoir : il sera remplacé ou remboursé.</p>`],
      ["6. Droit de rétractation", `<p>Conformément à l'article 38 de la loi n° 31-08, le droit de rétractation ne s'applique pas aux biens qui, par leur nature, sont susceptibles de se détériorer ou de se périmer rapidement (boissons, plats, pâtisseries), ni aux prestations de services dont l'exécution a commencé avec l'accord du client. Pour le café en grains et le matériel scellés et non ouverts, le client dispose de 7 jours à compter de la réception pour se rétracter, les frais de retour restant à sa charge.</p>`],
      ["7. Réservations et annulation", `<ul><li><b>Table</b> : réservation gratuite, confirmée par le café. La table est gardée 15 minutes après l'heure prévue. Merci d'annuler au moins 2 heures à l'avance, depuis le site ou par téléphone.</li>
        <li><b>Salle privée et coffee break</b> : un devis précise le prix, l'éventuel acompte et les conditions d'annulation. La réservation est ferme après acceptation du devis.</li>
        <li><b>Atelier barista</b> : annulation gratuite jusqu'à 48 heures avant la séance (remboursement ou report). Au-delà, la place n'est pas remboursée mais peut être cédée à une autre personne.</li>
        <li><b>Coworking</b> : sans réservation obligatoire, selon les places disponibles.</li>
        <li><b>Abonnement café</b> : mensuel, sans engagement, résiliable à tout moment avant le prochain renouvellement.</li></ul>
        <p>Le café peut annuler une réservation en cas de force majeure ou de fermeture exceptionnelle ; tout acompte versé est alors intégralement remboursé.</p>`],
      ["8. Cartes cadeaux", `<p>Valables 12 mois à compter de l'achat, utilisables en une ou plusieurs fois au café. Elles ne sont ni remboursables ni échangeables contre des espèces. En cas de perte, elles ne peuvent être remplacées que si la référence peut être retrouvée.</p>`],
      ["9. Programme fidélité", `<ul><li>Le programme est gratuit. Chaque tranche de 10 DH dépensée donne 1 point, crédité lorsque la commande est servie ou livrée. Les commandes passées au comptoir ou par WhatsApp peuvent être créditées par le personnel.</li>
        <li>Niveaux : Silver dès 100 points (−10 % permanent), Gold dès 300 points (−15 % et invitations). Une boisson chaude est offerte tous les 50 points, sur présentation de la carte au comptoir.</li>
        <li>La carte est liée à l'appareil et au navigateur utilisés pour commander. Les points sont personnels, sans valeur monétaire, ni cessibles ni convertibles en espèces.</li>
        <li>Les points peuvent expirer après 24 mois sans commande. Le café peut modifier ou arrêter le programme en informant les clients sur le site au moins 30 jours à l'avance ; les avantages déjà acquis restent utilisables pendant ce délai. Toute fraude entraîne l'annulation des points.</li></ul>`],
      ["10. Allergènes et hygiène", `<p>Les principaux allergènes (lait, gluten, œufs, fruits à coque) sont indiqués sur chaque produit. Nos produits sont préparés dans une cuisine où ces allergènes sont présents : des traces sont possibles. En cas d'allergie, informez le personnel avant de commander.</p>`],
      ["11. Responsabilité", `<p>Le café n'est pas responsable des retards ou de l'inexécution dus à un cas de force majeure ou au fait du client (adresse erronée, absence lors de la livraison). Les objets personnels restent sous la garde de leur propriétaire.</p>`],
      ["12. Réclamations et litiges", `<p>Toute réclamation peut être adressée à {{email}} ou au {{phone}} ; nous nous engageons à y répondre dans les meilleurs délais. Le client peut également s'adresser à une association de protection des consommateurs. Les présentes conditions sont soumises au droit marocain. À défaut d'accord amiable, les tribunaux de {{city}} sont compétents, sous réserve des dispositions de la loi n° 31-08 permettant au consommateur de saisir le tribunal de son domicile.</p>`]
    ],
    privacy: [
      ["Responsable du traitement", `<p>{{company}} ({{name}}), {{address}} — contact : {{email}}. Traitements déclarés auprès de la CNDP conformément à la loi n° 09-08 : {{cndp}}.</p>`],
      ["Données collectées et finalités", `<ul>
        <li><b>Commandes</b> : nom (facultatif), numéro de table ou adresse de livraison, produits, note pour la cuisine, montant. <i>Finalité :</i> préparer et livrer la commande. <i>Base :</i> exécution du contrat.</li>
        <li><b>Réservations</b> : nom, téléphone, date, heure, nombre de personnes, type de prestation, remarques. <i>Finalité :</i> gérer la réservation et vous la confirmer. <i>Base :</i> exécution du contrat.</li>
        <li><b>Programme fidélité</b> : identifiant technique anonyme, solde de points, nombre de commandes. <i>Finalité :</i> calculer vos avantages. <i>Base :</i> votre consentement, en utilisant le programme.</li>
        <li><b>Préférences locales</b> (langue, thème, panier, historique sur l'appareil) : enregistrées uniquement dans votre navigateur, jamais transmises.</li></ul>
        <p>Nous ne collectons aucune donnée bancaire, ne faisons pas de publicité ciblée et ne vendons aucune donnée.</p>`],
      ["Destinataires et sous-traitants", `<ul><li>Le personnel du café habilité (cuisine, comptoir, gérance), via un compte nominatif.</li>
        <li><b>Google Firebase</b> (hébergement de la base de données et authentification anonyme) — si le service en ligne est activé.</li>
        <li><b>WhatsApp (Meta)</b> — uniquement si vous choisissez d'envoyer une commande ou une réservation par WhatsApp, ou si nous vous confirmons une réservation par ce moyen.</li>
        <li><b>Google Maps</b> — uniquement si vous cliquez sur « Afficher la carte ».</li>
        <li>Polices Google Fonts, images Unsplash et bibliothèque cdnjs : chargées depuis leurs serveurs, qui reçoivent votre adresse IP.</li></ul>
        <p>Certains de ces prestataires peuvent traiter des données hors du Maroc. Ces transferts sont encadrés conformément aux articles 43 et 44 de la loi n° 09-08.</p>`],
      ["Durées de conservation", `<ul><li>Commandes : 3 ans, puis anonymisation (les pièces comptables sont conservées 10 ans conformément au Code de commerce).</li>
        <li>Réservations : 12 mois après la date réservée.</li>
        <li>Carte fidélité : jusqu'à 24 mois sans commande.</li>
        <li>Données du navigateur : jusqu'à ce que vous les effaciez.</li></ul>`],
      ["Vos droits", `<p>Conformément aux articles 7 à 9 de la loi n° 09-08, vous disposez d'un droit d'accès, de rectification et d'opposition, pour des motifs légitimes, au traitement de vos données. Pour l'exercer, écrivez à {{email}} en indiquant la référence de votre commande, de votre réservation ou de votre carte fidélité ; nous répondons dans les meilleurs délais. Vous pouvez aussi saisir la CNDP (www.cndp.ma).</p>
        <p>Vous pouvez à tout moment effacer les données enregistrées sur votre appareil depuis les réglages de votre navigateur (cela réinitialise aussi votre carte fidélité sur cet appareil).</p>`],
      ["Cookies et stockage local", `<p>Le site n'utilise ni cookie publicitaire ni outil de mesure d'audience. Il enregistre dans votre navigateur (stockage local) les éléments nécessaires à son fonctionnement : langue, thème, panier, historique, identifiant anonyme Firebase. La carte Google Maps, qui dépose ses propres cookies, n'est chargée que si vous cliquez pour l'afficher.</p>`],
      ["Sécurité", `<p>Les échanges sont chiffrés (HTTPS). L'accès aux commandes et réservations est limité par des règles de sécurité : un client ne voit que ses propres données, et seul le personnel autorisé peut les traiter. Les points fidélité ne peuvent être attribués que par le personnel.</p>`],
      ["Mineurs", `<p>Le site ne s'adresse pas spécifiquement aux enfants. Les réservations doivent être faites par une personne majeure.</p>`]
    ],
    notice: {
      booking: `Les informations saisies servent uniquement à gérer votre réservation. Elles sont traitées par {{name}} conformément à la loi 09-08. Voir notre <a href="legal.html#privacy">politique de confidentialité</a> et nos <a href="legal.html#cgv">CGV</a>.`,
      order: `En envoyant la commande, vous acceptez les <a href="legal.html#cgv">CGV</a>. Données traitées selon notre <a href="legal.html#privacy">politique de confidentialité</a>.`
    }
  },

  /* ======================= ENGLISH ======================= */
  en: {
    ui: { title: "Legal information", mentions: "Legal notice", cgv: "Terms of sale", privacy: "Privacy policy",
      updated: "Last updated:", print: "Print", back: "Back to the site", todo: "to complete", toc: "Contents",
      draft: "Template to be reviewed by a legal professional before going live. Highlighted items must be filled in js/data.js (CAFE_CONFIG.legal). The French version prevails." },
    mentions: [
      ["Publisher", `<p>The website <b>{{name}}</b> is published by:</p>
        <ul><li>Company name: {{company}}</li><li>Legal form: {{form}} — share capital: {{capital}}</li>
        <li>Registered office: {{address}}</li><li>Trade register: {{rc}}</li><li>ICE: {{ice}} — Tax ID (IF): {{if}} — Business tax: {{patente}}</li>
        <li>Phone: {{phone}} — Email: {{email}}</li></ul>`],
      ["Publication director", `<p>{{director}}</p>`],
      ["Hosting", `<p>{{host}}</p>`],
      ["Intellectual property", `<p>The name, logo, texts and layout of the website belong to the publisher. Any reproduction without written permission is prohibited. Some photographs come from the Unsplash image library and are used under its licence. They are illustrative: actual products may look different.</p>`],
      ["Personal data", `<p>The processing of personal data collected on this website is described in the <a href="#privacy">privacy policy</a>. Declaration to the Moroccan data protection authority (CNDP): {{cndp}}.</p>`],
      ["Liability", `<p>The publisher strives to keep the information on the site (menu, prices, opening hours) up to date but cannot guarantee it is error-free. In the event of an obvious pricing error, the price displayed in the café prevails. Links to third-party services (WhatsApp, Google Maps) are the responsibility of their publishers.</p>`]
    ],
    cgv: [
      ["1. Purpose and scope", `<p>These terms govern orders for products (drinks, food, pastries, coffee beans, gift cards) and bookings of services (tables, private room, coffee breaks, workshops, coworking, subscription) placed with {{name}}, in the café, on this website or via WhatsApp. They apply in accordance with Moroccan Law No. 31-08 on consumer protection. Placing an order or a booking means accepting these terms.</p>`],
      ["2. Prices", `<p>Prices are shown in Moroccan dirhams (DH), all taxes included. They may change at any time; the applicable price is the one displayed when the order is placed.</p>
        <ul><li><b>Happy hour</b>: {{hhpct}}% off the categories shown on the menu, Monday to Friday from {{hhfrom}} to {{hhto}}, while stocks last.</li>
        <li><b>Promo codes and loyalty discounts</b>: one code per order; they cannot be combined with each other or with the loyalty discount. The discount most favourable to the customer applies.</li>
        <li><b>Set menus</b>: content and conditions (times, student card…) are shown on the menu.</li></ul>`],
      ["3. Orders", `<p>Online orders are placed by adding products to the cart and sending it. The order goes straight to the kitchen or, failing that, via WhatsApp. The contract is formed when the café accepts the order, i.e. when preparation starts. The café may refuse an order if a product is unavailable, the address is outside the delivery area or the request is abnormal; the customer is then informed.</p>
        <p>Order tracking ("Received", "Preparing", "Ready") is indicative. The total shown is checked by staff when the order is served or delivered.</p>`],
      ["4. Payment", `<p>Payment is made in the café or on delivery, in cash or by bank card. Services on quotation (events, coffee breaks) may be paid by bank transfer. No payment is requested or stored on this website.</p>`],
      ["5. Delivery and pick-up", `<ul><li>Delivery area: {{city}} and its immediate surroundings, subject to availability.</li>
        <li>Fee: {{fee}} DH per order, free from {{free}} DH (after discount).</li>
        <li>Indicative time: 30 to 45 minutes, which may vary with demand and weather. The customer must remain reachable on the number given.</li>
        <li>Takeaway: collect the order at the counter with its reference.</li></ul>
        <p>If an item is missing or not as ordered, tell the courier or the counter straight away: it will be replaced or refunded.</p>`],
      ["6. Right of withdrawal", `<p>Under Article 38 of Law No. 31-08, the right of withdrawal does not apply to goods that by nature may deteriorate or expire quickly (drinks, food, pastries), nor to services whose performance has begun with the customer's agreement. For sealed, unopened coffee beans and equipment, the customer has 7 days from receipt to withdraw, return costs being at their expense.</p>`],
      ["7. Bookings and cancellation", `<ul><li><b>Table</b>: free booking, confirmed by the café. The table is held for 15 minutes after the booked time. Please cancel at least 2 hours in advance, on the website or by phone.</li>
        <li><b>Private room and coffee breaks</b>: a quotation sets out the price, any deposit and the cancellation terms. The booking is final once the quotation is accepted.</li>
        <li><b>Barista workshop</b>: free cancellation up to 48 hours before the session (refund or rescheduling). After that, the seat is not refunded but may be transferred to someone else.</li>
        <li><b>Coworking</b>: no booking required, subject to available seats.</li>
        <li><b>Coffee subscription</b>: monthly, no commitment, cancellable at any time before the next renewal.</li></ul>
        <p>The café may cancel a booking in the event of force majeure or exceptional closure; any deposit paid is then refunded in full.</p>`],
      ["8. Gift cards", `<p>Valid for 12 months from purchase, usable in one or several visits to the café. They cannot be refunded or exchanged for cash. If lost, they can only be replaced if the reference can be traced.</p>`],
      ["9. Loyalty programme", `<ul><li>The programme is free. Every 10 DH spent earns 1 point, credited when the order is served or delivered. Orders placed at the counter or via WhatsApp may be credited by staff.</li>
        <li>Tiers: Silver from 100 points (10% off, permanently), Gold from 300 points (15% off and invitations). A hot drink is offered every 50 points, on showing the card at the counter.</li>
        <li>The card is tied to the device and browser used to order. Points are personal, have no cash value and cannot be transferred or converted into cash.</li>
        <li>Points may expire after 24 months without an order. The café may change or end the programme by informing customers on the website at least 30 days in advance; benefits already earned remain usable during that period. Any fraud cancels the points.</li></ul>`],
      ["10. Allergens and hygiene", `<p>The main allergens (milk, gluten, eggs, nuts) are shown on each product. Our products are prepared in a kitchen where these allergens are present, so traces are possible. If you have an allergy, tell the staff before ordering.</p>`],
      ["11. Liability", `<p>The café is not liable for delays or non-performance caused by force majeure or by the customer (wrong address, absence at delivery). Personal belongings remain the responsibility of their owners.</p>`],
      ["12. Complaints and disputes", `<p>Complaints can be sent to {{email}} or {{phone}}; we undertake to reply as soon as possible. Customers may also contact a consumer protection association. These terms are governed by Moroccan law. Failing an amicable settlement, the courts of {{city}} have jurisdiction, subject to the provisions of Law No. 31-08 allowing consumers to bring proceedings before the court of their place of residence.</p>`]
    ],
    privacy: [
      ["Data controller", `<p>{{company}} ({{name}}), {{address}} — contact: {{email}}. Processing declared to the CNDP in accordance with Law No. 09-08: {{cndp}}.</p>`],
      ["Data collected and purposes", `<ul>
        <li><b>Orders</b>: name (optional), table number or delivery address, products, note for the kitchen, amount. <i>Purpose:</i> preparing and delivering the order. <i>Basis:</i> performance of the contract.</li>
        <li><b>Bookings</b>: name, phone, date, time, number of guests, type of service, notes. <i>Purpose:</i> managing and confirming the booking. <i>Basis:</i> performance of the contract.</li>
        <li><b>Loyalty programme</b>: anonymous technical ID, points balance, number of orders. <i>Purpose:</i> calculating your benefits. <i>Basis:</i> your consent, by using the programme.</li>
        <li><b>Local preferences</b> (language, theme, cart, history on the device): stored only in your browser, never sent.</li></ul>
        <p>We collect no payment data, run no targeted advertising and sell no data.</p>`],
      ["Recipients and processors", `<ul><li>Authorised café staff (kitchen, counter, management), through individual accounts.</li>
        <li><b>Google Firebase</b> (database hosting and anonymous sign-in), when the online service is enabled.</li>
        <li><b>WhatsApp (Meta)</b>, only if you choose to send an order or booking via WhatsApp, or if we confirm a booking that way.</li>
        <li><b>Google Maps</b>, only if you click "Show map".</li>
        <li>Google Fonts, Unsplash images and the cdnjs library are loaded from their servers, which receive your IP address.</li></ul>
        <p>Some of these providers may process data outside Morocco. Such transfers are carried out in accordance with Articles 43 and 44 of Law No. 09-08.</p>`],
      ["Retention periods", `<ul><li>Orders: 3 years, then anonymised (accounting records are kept for 10 years under the Commercial Code).</li>
        <li>Bookings: 12 months after the booked date.</li>
        <li>Loyalty card: until 24 months without an order.</li>
        <li>Browser data: until you delete it.</li></ul>`],
      ["Your rights", `<p>Under Articles 7 to 9 of Law No. 09-08, you have the right to access and rectify your data and to object, on legitimate grounds, to its processing. To exercise these rights, email {{email}} with the reference of your order, booking or loyalty card; we will reply as soon as possible. You may also contact the CNDP (www.cndp.ma).</p>
        <p>You can delete the data stored on your device at any time from your browser settings (this also resets your loyalty card on that device).</p>`],
      ["Cookies and local storage", `<p>The website uses no advertising cookies and no audience measurement tools. It stores in your browser (local storage) what it needs to work: language, theme, cart, history and an anonymous Firebase ID. The Google Maps map, which sets its own cookies, is only loaded if you click to show it.</p>`],
      ["Security", `<p>Connections are encrypted (HTTPS). Access to orders and bookings is restricted by security rules: customers only see their own data, and only authorised staff can process it. Loyalty points can only be awarded by staff.</p>`],
      ["Minors", `<p>The website is not specifically aimed at children. Bookings must be made by an adult.</p>`]
    ],
    notice: {
      booking: `The information entered is used only to manage your booking. It is processed by {{name}} in accordance with Moroccan Law 09-08. See our <a href="legal.html#privacy">privacy policy</a> and <a href="legal.html#cgv">terms of sale</a>.`,
      order: `By sending the order you accept our <a href="legal.html#cgv">terms of sale</a>. Data processed under our <a href="legal.html#privacy">privacy policy</a>.`
    }
  },

  /* ======================= العربية ======================= */
  ar: {
    ui: { title: "المعلومات القانونية", mentions: "البيانات القانونية", cgv: "الشروط العامة للبيع", privacy: "سياسة الخصوصية",
      updated: "آخر تحديث:", print: "طباعة", back: "العودة إلى الموقع", todo: "يُستكمل", toc: "المحتويات",
      draft: "نموذج يجب أن يراجعه مختص قانوني قبل النشر. العناصر المظللة تُستكمل في js/data.js ‏(CAFE_CONFIG.legal). تعتمد النسخة الفرنسية عند الاختلاف." },
    mentions: [
      ["ناشر الموقع", `<p>يُنشر موقع <b>{{name}}</b> من طرف:</p>
        <ul><li>الاسم التجاري: {{company}}</li><li>الشكل القانوني: {{form}} — رأس المال: {{capital}}</li>
        <li>المقر: {{address}}</li><li>السجل التجاري: {{rc}}</li><li>التعريف الموحد للمقاولة (ICE): {{ice}} — التعريف الضريبي: {{if}} — الرسم المهني: {{patente}}</li>
        <li>الهاتف: {{phone}} — البريد الإلكتروني: {{email}}</li></ul>`],
      ["مدير النشر", `<p>{{director}}</p>`],
      ["الاستضافة", `<p>{{host}}</p>`],
      ["الملكية الفكرية", `<p>الاسم والشعار والنصوص وتصميم الموقع ملك للناشر، ويُمنع أي استنساخ دون إذن كتابي. بعض الصور مأخوذة من مكتبة Unsplash وتُستعمل وفق ترخيصها، وهي للتوضيح فقط وقد يختلف شكل المنتوجات الفعلي.</p>`],
      ["المعطيات الشخصية", `<p>تصف <a href="#privacy">سياسة الخصوصية</a> معالجة المعطيات الشخصية المجمّعة عبر هذا الموقع. التصريح لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي (CNDP): {{cndp}}.</p>`],
      ["المسؤولية", `<p>يحرص الناشر على تحيين معلومات الموقع (القائمة، الأسعار، أوقات العمل) دون أن يضمن خلوها من الأخطاء. في حال وجود خطأ واضح في السعر، يُعتمد السعر المعروض في المقهى. الروابط نحو خدمات خارجية (واتساب، خرائط Google) تقع تحت مسؤولية ناشريها.</p>`]
    ],
    cgv: [
      ["1. الموضوع ومجال التطبيق", `<p>تنظم هذه الشروط طلبات المنتوجات (المشروبات، الأطباق، المخبوزات، البن، بطاقات الهدايا) وحجوزات الخدمات (الطاولات، القاعة الخاصة، الكوفي بريك، الورشات، فضاء العمل، الاشتراك) لدى {{name}}، سواء في المقهى أو عبر هذا الموقع أو عبر واتساب، وتُطبق وفقاً للقانون رقم 31.08 القاضي بتحديد تدابير لحماية المستهلك. يُعد تقديم طلب أو حجز قبولاً لهذه الشروط.</p>`],
      ["2. الأسعار", `<p>الأسعار معروضة بالدرهم المغربي وتشمل جميع الضرائب، ويمكن تغييرها في أي وقت. السعر المعتمد هو المعروض لحظة الطلب.</p>
        <ul><li><b>ساعة السعادة</b>: خصم {{hhpct}}٪ على الفئات المبينة في القائمة، من الإثنين إلى الجمعة من {{hhfrom}} إلى {{hhto}}، في حدود المتوفر.</li>
        <li><b>أكواد الخصم وخصم الولاء</b>: كود واحد لكل طلب، ولا تُجمع الأكواد فيما بينها ولا مع خصم برنامج الولاء؛ يُطبق الخصم الأنفع للزبون.</li>
        <li><b>العروض</b>: مكوناتها وشروطها (التوقيت، بطاقة الطالب…) مبينة في القائمة.</li></ul>`],
      ["3. الطلب", `<p>يتم الطلب عبر الإنترنت بإضافة المنتوجات إلى السلة ثم إرسالها، فيصل الطلب مباشرة إلى المطبخ أو عبر واتساب عند الاقتضاء. ينعقد العقد عند قبول المقهى للطلب، أي عند بدء تحضيره. يحق للمقهى رفض طلب في حال نفاد منتوج أو وقوع العنوان خارج منطقة التوصيل أو وجود طلب غير عادي، مع إخبار الزبون بذلك.</p>
        <p>تتبع الطلب («مستلم»، «قيد التحضير»، «جاهز») إرشادي، ويتحقق الموظفون من المبلغ الإجمالي عند التقديم أو التوصيل.</p>`],
      ["4. الأداء", `<p>يتم الأداء في المقهى أو عند التوصيل، نقداً أو بالبطاقة البنكية. يمكن أداء الخدمات حسب عرض السعر (المناسبات، الكوفي بريك) بتحويل بنكي. لا يُطلب ولا يُسجل أي أداء على هذا الموقع.</p>`],
      ["5. التوصيل والاستلام", `<ul><li>منطقة التوصيل: {{city}} وضواحيها القريبة، حسب الإمكان.</li>
        <li>الرسوم: {{fee}} درهم لكل طلب، ومجاناً ابتداءً من {{free}} درهم (بعد الخصم).</li>
        <li>المدة التقريبية: من 30 إلى 45 دقيقة، وقد تتغير حسب الإقبال والطقس. على الزبون أن يبقى متاحاً على الرقم المقدم.</li>
        <li>الطلب السفري: يُستلم من الكونتوار بذكر مرجعه.</li></ul>
        <p>في حال نقص منتوج أو عدم مطابقته، يُرجى إخبار عامل التوصيل أو الكونتوار فوراً ليتم تعويضه أو استرجاع ثمنه.</p>`],
      ["6. حق التراجع", `<p>طبقاً للمادة 38 من القانون رقم 31.08، لا يُطبق حق التراجع على السلع التي قد تفسد أو تنتهي صلاحيتها بسرعة بحكم طبيعتها (المشروبات، الأطباق، الحلويات)، ولا على الخدمات التي بدأ تنفيذها بموافقة الزبون. بالنسبة للبن والمعدات المغلفة وغير المفتوحة، يتوفر الزبون على أجل 7 أيام من تاريخ الاستلام للتراجع، وتكون مصاريف الإرجاع على عاتقه.</p>`],
      ["7. الحجوزات والإلغاء", `<ul><li><b>الطاولة</b>: حجز مجاني يؤكده المقهى، وتُحفظ الطاولة 15 دقيقة بعد الموعد. يُرجى الإلغاء قبل ساعتين على الأقل عبر الموقع أو الهاتف.</li>
        <li><b>القاعة الخاصة والكوفي بريك</b>: يحدد عرض السعر الثمن والعربون المحتمل وشروط الإلغاء، ويصبح الحجز نهائياً بعد قبول العرض.</li>
        <li><b>ورشة الباريستا</b>: إلغاء مجاني حتى 48 ساعة قبل الحصة (استرجاع المبلغ أو التأجيل)، وبعد ذلك لا يُسترجع المبلغ لكن يمكن تفويت المقعد لشخص آخر.</li>
        <li><b>فضاء العمل</b>: دون حجز إلزامي، حسب الأماكن المتاحة.</li>
        <li><b>اشتراك البن</b>: شهري، دون التزام، ويمكن إنهاؤه في أي وقت قبل التجديد الموالي.</li></ul>
        <p>يمكن للمقهى إلغاء حجز في حالة القوة القاهرة أو الإغلاق الاستثنائي، مع إرجاع أي عربون مدفوع كاملاً.</p>`],
      ["8. بطاقات الهدايا", `<p>صالحة 12 شهراً من تاريخ الشراء، وتُستعمل مرة واحدة أو عدة مرات في المقهى. لا يُسترجع ثمنها ولا تُستبدل نقداً، ولا يمكن تعويضها عند الضياع إلا إذا أمكن العثور على مرجعها.</p>`],
      ["9. برنامج الولاء", `<ul><li>البرنامج مجاني. كل 10 دراهم تمنح نقطة واحدة تُضاف عند تقديم الطلب أو توصيله، ويمكن للموظفين إضافة نقاط الطلبات المقدمة في الكونتوار أو عبر واتساب.</li>
        <li>المستويات: Silver ابتداءً من 100 نقطة (خصم دائم 10٪)، وGold ابتداءً من 300 نقطة (خصم 15٪ ودعوات). مشروب ساخن مجاني كل 50 نقطة عند الإدلاء بالبطاقة في الكونتوار.</li>
        <li>البطاقة مرتبطة بالجهاز والمتصفح المستعملين للطلب. النقاط شخصية، دون قيمة نقدية، ولا تُفوت ولا تُحول إلى نقود.</li>
        <li>يمكن أن تنتهي صلاحية النقاط بعد 24 شهراً دون أي طلب. يمكن للمقهى تعديل البرنامج أو إيقافه بعد إخبار الزبناء عبر الموقع قبل 30 يوماً على الأقل، وتبقى المزايا المكتسبة قابلة للاستعمال خلال هذا الأجل. كل غش يؤدي إلى إلغاء النقاط.</li></ul>`],
      ["10. مسببات الحساسية والنظافة", `<p>نبين مسببات الحساسية الرئيسية (الحليب، الغلوتين، البيض، المكسرات) لكل منتوج. تُحضر منتوجاتنا في مطبخ توجد فيه هذه المواد، لذا قد توجد آثار منها. في حال الحساسية، يُرجى إخبار الموظفين قبل الطلب.</p>`],
      ["11. المسؤولية", `<p>لا يتحمل المقهى مسؤولية التأخير أو عدم التنفيذ الناتج عن قوة قاهرة أو عن فعل الزبون (عنوان خاطئ، غياب عند التوصيل). تبقى الأغراض الشخصية تحت مسؤولية أصحابها.</p>`],
      ["12. الشكايات والنزاعات", `<p>يمكن توجيه أي شكاية إلى {{email}} أو الاتصال بالرقم {{phone}}، ونلتزم بالرد في أقرب الآجال. يمكن للزبون أيضاً اللجوء إلى جمعية لحماية المستهلك. تخضع هذه الشروط للقانون المغربي، وعند تعذر الحل الودي تختص محاكم {{city}}، مع مراعاة مقتضيات القانون رقم 31.08 التي تخول للمستهلك رفع الدعوى أمام محكمة موطنه.</p>`]
    ],
    privacy: [
      ["المسؤول عن المعالجة", `<p>{{company}} ‏({{name}})، {{address}} — للتواصل: {{email}}. المعالجات مصرح بها لدى اللجنة الوطنية (CNDP) طبقاً للقانون رقم 09.08: {{cndp}}.</p>`],
      ["المعطيات المجمّعة والغايات", `<ul>
        <li><b>الطلبات</b>: الاسم (اختياري)، رقم الطاولة أو عنوان التوصيل، المنتوجات، ملاحظة للمطبخ، المبلغ. <i>الغاية:</i> تحضير الطلب وتوصيله. <i>الأساس:</i> تنفيذ العقد.</li>
        <li><b>الحجوزات</b>: الاسم، الهاتف، التاريخ، الساعة، عدد الأشخاص، نوع الخدمة، الملاحظات. <i>الغاية:</i> تدبير الحجز وتأكيده. <i>الأساس:</i> تنفيذ العقد.</li>
        <li><b>برنامج الولاء</b>: معرّف تقني مجهول، رصيد النقاط، عدد الطلبات. <i>الغاية:</i> احتساب مزاياك. <i>الأساس:</i> موافقتك عبر استعمال البرنامج.</li>
        <li><b>التفضيلات المحلية</b> (اللغة، المظهر، السلة، السجل على الجهاز): تُحفظ في متصفحك فقط ولا تُرسل.</li></ul>
        <p>لا نجمع أي معطيات بنكية، ولا نقوم بإشهار موجه، ولا نبيع أي معطيات.</p>`],
      ["المستفيدون والمتعاقدون من الباطن", `<ul><li>موظفو المقهى المؤهلون (المطبخ، الكونتوار، التسيير) عبر حسابات شخصية.</li>
        <li><b>Google Firebase</b> (استضافة قاعدة البيانات وتسجيل الدخول المجهول) عند تفعيل الخدمة عبر الإنترنت.</li>
        <li><b>واتساب (Meta)</b> فقط إذا اخترت إرسال طلب أو حجز عبره، أو إذا أكدنا لك حجزاً بواسطته.</li>
        <li><b>خرائط Google</b> فقط إذا نقرت على «عرض الخريطة».</li>
        <li>خطوط Google Fonts وصور Unsplash ومكتبة cdnjs تُحمَّل من خوادمها التي تتلقى عنوان IP الخاص بك.</li></ul>
        <p>قد يعالج بعض هؤلاء المتعاقدين المعطيات خارج المغرب، وتتم هذه التحويلات وفق المادتين 43 و44 من القانون رقم 09.08.</p>`],
      ["مدة الاحتفاظ", `<ul><li>الطلبات: 3 سنوات ثم إخفاء الهوية (تُحفظ الوثائق المحاسبية 10 سنوات وفق مدونة التجارة).</li>
        <li>الحجوزات: 12 شهراً بعد تاريخ الحجز.</li>
        <li>بطاقة الولاء: إلى غاية 24 شهراً دون طلب.</li>
        <li>معطيات المتصفح: إلى أن تحذفها.</li></ul>`],
      ["حقوقك", `<p>طبقاً للمواد من 7 إلى 9 من القانون رقم 09.08، لك الحق في الولوج إلى معطياتك وتصحيحها والتعرض على معالجتها لأسباب مشروعة. لممارسة هذه الحقوق، راسلنا على {{email}} مع ذكر مرجع طلبك أو حجزك أو بطاقة الولاء، وسنرد في أقرب الآجال. يمكنك أيضاً اللجوء إلى اللجنة الوطنية (www.cndp.ma).</p>
        <p>يمكنك في أي وقت حذف المعطيات المحفوظة على جهازك من إعدادات المتصفح (ويؤدي ذلك أيضاً إلى إعادة تعيين بطاقة الولاء على هذا الجهاز).</p>`],
      ["ملفات تعريف الارتباط والتخزين المحلي", `<p>لا يستعمل الموقع ملفات ارتباط إشهارية ولا أدوات لقياس الزيارات. يحفظ في متصفحك (التخزين المحلي) ما يلزم لعمله فقط: اللغة، المظهر، السلة، السجل، ومعرّف Firebase المجهول. لا تُحمَّل خريطة Google، التي تضع ملفاتها الخاصة، إلا إذا نقرت لعرضها.</p>`],
      ["الأمان", `<p>الاتصالات مشفرة (HTTPS). الولوج إلى الطلبات والحجوزات محدود بقواعد أمان: لا يرى الزبون إلا معطياته، ولا يعالجها إلا الموظفون المؤهلون. لا يمنح نقاط الولاء إلا الموظفون.</p>`],
      ["القاصرون", `<p>الموقع غير موجه خصيصاً للأطفال، ويجب أن يقوم بالحجز شخص راشد.</p>`]
    ],
    notice: {
      booking: `تُستعمل المعلومات المدخلة فقط لتدبير حجزك، ويعالجها {{name}} وفق القانون 09.08. اطلع على <a href="legal.html#privacy">سياسة الخصوصية</a> و<a href="legal.html#cgv">الشروط العامة للبيع</a>.`,
      order: `بإرسال الطلب فإنك تقبل <a href="legal.html#cgv">الشروط العامة للبيع</a>. تُعالج المعطيات وفق <a href="legal.html#privacy">سياسة الخصوصية</a>.`
    }
  }
};
