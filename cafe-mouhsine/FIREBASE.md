# Connecter Café Mouhsine à Firebase

Une fois connectée, la plateforme envoie les commandes des clients directement à l'écran cuisine, sur n'importe quel appareil, en temps réel.

| | Sans Firebase (par défaut) | Avec Firebase |
|---|---|---|
| Commande client | envoyée par WhatsApp | enregistrée en ligne et visible en cuisine en direct (WhatsApp en secours si le réseau coupe) |
| Écran cuisine | voit les commandes du même appareil | voit toutes les commandes, sur tous les appareils |
| Suivi client | sur le même appareil | « Reçue → En préparation → Prête » en direct sur le téléphone du client |
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

- **Console :** Firestore → onglet **Règles** → collez le contenu de `firestore.rules` → **Publier**.
- **Ligne de commande :**
  ```bash
  npm install -g firebase-tools
  firebase login
  cd cafe-mouhsine
  firebase use --add            # choisir le projet
  firebase deploy --only firestore:rules
  ```

Ce que les règles garantissent (25 cas testés, voir `tests/`) :
- un client ne peut créer que des commandes « nouvelles », à son nom, et ne peut lire que les siennes ;
- un client ne peut ni changer un statut, ni modifier un prix, ni se déclarer membre du personnel ;
- le personnel ne peut changer que le statut d'une commande (pas son contenu ni son prix) ;
- personne ne peut supprimer une commande : l'historique est conservé.

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
- **Réservations, prix modifiés dans l'admin et points fidélité** restent pour l'instant enregistrés dans le navigateur. Ils peuvent passer sur Firebase de la même façon.
- **Coupure réseau :** si l'envoi en ligne échoue ou prend plus de 10 secondes, la commande part par WhatsApp. Elle n'est alors pas envoyée une seconde fois en ligne.

## Tester en local sans compte Google

```bash
cd cafe-mouhsine/tests
npm install
npm run test:rules        # lance l'émulateur Firestore et les 25 tests de sécurité
```
