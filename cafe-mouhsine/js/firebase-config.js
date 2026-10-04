/* =========================================================
   Firebase connection for Café Mouhsine BOUAGHAZ
   ---------------------------------------------------------
   1. console.firebase.google.com → create a project
   2. Build → Firestore Database → Create database
   3. Build → Authentication → enable "Anonymous" and "Email/Password"
   4. Project settings → Your apps → Web app (</>) → copy the config
   5. Replace `null` below with that config object, e.g.

   window.CAFE_FIREBASE = window.CAFE_FIREBASE || {
     apiKey: "AIza...",
     authDomain: "cafe-mouhsine.firebaseapp.com",
     projectId: "cafe-mouhsine",
     appId: "1:123:web:abc"
   };

   Leave it null to keep the offline mode (orders via WhatsApp,
   kitchen screen limited to the same device).
   The web config is not a secret: access is enforced by
   firestore.rules, which must be deployed (see README).
   ========================================================= */
window.CAFE_FIREBASE = window.CAFE_FIREBASE || null;
