# Connecter Café Mouhsine à Firebase

Une fois connectée, la plateforme enregistre en ligne les **commandes**, les **réservations** et les **points fidélité**. Tout est partagé en temps réel entre les téléphones des clients, l'écran cuisine et l'administration.

| | Sans Firebase (par défaut) | Avec Firebase |
|---|---|---|
| Commande client | envoyée par WhatsApp | enregistrée en ligne et visible en cuisine en direct (WhatsApp en secours si le réseau coupe) |
| Écran cuisine | voit les commandes du même appareil | voit toutes les commandes, sur tous les appareils |
| Suivi client | sur le même appareil | « Reçue → En préparation → Prête » en direct sur le téléphone du client |
| Réservations | envoyées par WhatsApp | enregistrées en ligne ; le client voit « En attente → Confirmée » et peut annuler ; le gérant confirme en un clic dans l'admin (avec message WhatsApp prêt pour le client) |
| Points fidélité | comptés sur le téléphone du client (modifiables par lui) | crédités par le personnel au moment où la commande est servie, impossibles à falsifier, visibles dans l'admin (meilleurs clients, ajustement manuel) |
| Avis clients | visibles sur l'appareil uniquement | enregistrés en ligne, relus par le personnel avant publication, visibles par tous ; badge « Commande vérifiée » quand l'avis est lié à une commande du client |
| Accès cuisine / admin | code PIN | compte e-mail + mot de passe du personnel |

Le plan gratuit de Firebase (« Spark ») suffit largement pour un café.

## 1. Créer le projet (5 min)

1. Ouvrez <https://console.firebase.google.com> et cliquez sur **Créer un projet** (par exemple `cafe-mouhsine`). Google Analytics n'est pas nécessaire.
2. **Build → Firestore Database → Créer une base de données**. Choisissez la région `europe-west1` (Belgique), la plus proche du Maroc, puis le **mode production**.
3. **Build → Authentication → Commencer**, puis activez **Anonyme** (pour les clients) et **Adresse e-mail/Mot de passe** (pour le personnel).

## 2. Brancher le site

1. **Paramètres du projet** (⚙) → **Vos applications** → icône **Web `</>`** → donnez un nom → **Enregistrer**.
2. Copiez l'objet `firebaseConfig` affiché.
3. Dans `js/firebase-config.js`, remplacez `null` par cet objet :

```js
window.CAFE_FIREBASE = window.CAFE_FIREBASE || {
  apiKey: "AIza…",
  authDomain: "cafe-mouhsine.firebaseapp.com",
  projectId: "cafe-mouhsine",
  appId: "1:…:web:…"
};
```

Ces valeurs ne sont pas secrètes : c'est le fichier `firestore.rules` qui protège les données.

## 3. Publier les règles de sécurité (obligatoire)

Sans cette étape, la base refuse tout en mode production. Deux façons de faire :

- **Console :** Firestore → onglet **Règles** → collez le contenu de `firestore.rules` → **Publier**. Créez aussi l'index des avis : Firestore → **Index** → **Index composite** → collection `reviews`, champs `status` (croissant) puis `createdAt` (décroissant). Sinon, la liste publique des avis reste vide ; la console du navigateur affiche alors un lien direct pour créer l'index.
- **Ligne de commande :**
  ```bash
  npm install -g firebase-tools
  firebase login
  cd cafe-mouhsine
  firebase use --add            # choisir le projet
  firebase deploy --only firestore      # règles + index des avis
  ```

Ce que les règles garantissent (86 cas testés, voir `tests/`) :
- un client ne peut créer que des commandes « nouvelles » et des réservations « en attente », à son nom, et ne lit que les siennes ;
- un client ne peut ni changer un statut, ni modifier un prix, ni confirmer ou modifier une réservation (il peut seulement l'annuler), ni se déclarer membre du personnel ;
- **les points fidélité ne sont écrits que par le personnel** : un client ne peut ni s'en ajouter ni lire ceux des autres ; une commande ne rapporte des points qu'une seule fois ;
- le personnel ne peut changer que le statut d'une commande ou d'une réservation (pas son contenu ni son prix) ;
- **avis :** un seul par client, invisible tant qu'il n'est pas approuvé ; le client ne peut ni l'approuver ni le modifier après envoi ; le badge « Commande vérifiée » n'est accepté que si la commande lui appartient ; le personnel peut publier, refuser, répondre ou supprimer, mais jamais changer la note ou le texte ;
- personne ne peut supprimer une commande, une réservation ou une carte fidélité : l'historique est conservé.

## 4. Créer les comptes du personnel

1. **Authentication → Utilisateurs → Ajouter un utilisateur** : e-mail et mot de passe du barista ou du gérant.
2. Copiez son **UID** (colonne « UID utilisateur »).
3. **Firestore → Commencer une collection** → identifiant de collection : `staff` → identifiant du document : **l'UID copié** → ajoutez un champ `name` (texte), par exemple `Barista`.

Sans document `staff/{UID}`, le compte est refusé : « Ce compte n'est pas dans la liste du personnel ». Pour retirer un accès, supprimez ce document.

## 5. Mettre en ligne

Le site est statique. Il peut être hébergé n'importe où (Netlify, GitHub Pages…) ou chez Firebase :

```bash
firebase deploy --only hosting
```

L'adresse sera `https://<projet>.web.app`. Pensez à réimprimer les chevalets QR depuis `menu-print.html` à cette nouvelle adresse.

## Bon à savoir

- **Prix :** le total est calculé sur le téléphone du client. Un client malveillant pourrait envoyer un faux total. Le personnel le voit au service, et les règles empêchent de le modifier ensuite. Pour une garantie totale, il faudrait recalculer le prix côté serveur avec une Cloud Function (plan payant « Blaze »).
- **Carte fidélité :** elle est liée au navigateur du client (compte anonyme Firebase). Si le client efface les données de son navigateur ou change de téléphone, il repart d'une nouvelle carte. Le gérant peut alors transférer ses points avec l'ajustement manuel de l'admin, en notant l'ancien numéro de carte. Pour une carte qui suit le client partout, il faudrait une connexion par numéro de téléphone (SMS Firebase, payant au-delà d'un quota).
- **Points :** 10 DH = 1 point, crédités quand la cuisine clique sur « Servie ». Les commandes saisies au comptoir et celles parties par WhatsApp (secours) ne rapportent pas de points automatiquement : utilisez l'ajustement manuel.
- **Prix modifiés dans l'admin** : ils restent enregistrés dans le navigateur de l'admin. Pour les publier à tous, mettez à jour `js/data.js`.
- **Coupure réseau :** si l'envoi en ligne échoue ou prend plus de 10 secondes, la commande part par WhatsApp. Elle n'est alors pas envoyée une seconde fois en ligne.

## Données personnelles (loi 09-08)

- La politique de confidentialité (`legal.html#privacy`) annonce des durées de conservation : commandes 3 ans, réservations 12 mois, cartes fidélité 24 mois sans commande. Pour protéger l'historique, l'application ne peut rien supprimer. Ces durées s'appliquent donc à la main depuis la console Firebase (Firestore → sélectionner les documents → Supprimer), par exemple une fois par trimestre.
- Une demande d'accès ou de suppression envoyée par e-mail se traite de la même façon : retrouvez le document grâce à la référence de commande (`CMD-…`), de réservation (`RSV-…`) ou au numéro de carte fidélité (les 8 premiers caractères de l'identifiant du document `loyalty`).
- Pensez à déclarer les traitements à la CNDP (www.cndp.ma) et à reporter le numéro de récépissé dans `js/data.js` (`CAFE_CONFIG.legal.cndp`).

## Tester en local sans compte Google

```bash
cd cafe-mouhsine/tests
npm install
npm run test:rules        # lance l'émulateur Firestore et les 86 tests de sécurité
```
