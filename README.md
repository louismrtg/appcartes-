# Mes Cartes — Portefeuille & Coffre-fort Android

Application Android native (Capacitor 6, React 18, TypeScript, Tailwind CSS, Framer Motion), **100 % gratuite, sans serveur externe et utilisable hors-ligne en magasin**.

**© Louis Martignon (`@louismrtg`)**

---

## Fonctionnalités principales

- **Design minimaliste & fluide :** Interface épurée (mode Clair, Sombre ou Système dans les Paramètres), cartes au format bancaire (`1.586:1`) avec dégradés harmonisés, transition partagée Framer Motion et recherche instantanée.
- **Catalogue massif (126+ enseignes françaises) & logos officiels :** E.Leclerc, Carrefour, Intermarché, Coopérative U, Auchan, Lidl, Leroy Merlin, Castorama, Decathlon, Fnac, Boulanger, Kiabi, Sephora, Norauto, TotalEnergies, etc., plus recherche en ligne via Clearbit Autocomplete avec mise en cache locale des logos (IndexedDB / Base64) pour un affichage hors-ligne.
- **Ajout en 3 étapes avec 3 méthodes de capture :**
  - Caméra native (`@capacitor-mlkit/barcode-scanning` avec fallback `html5-qrcode`)
  - Importation d’une photo ou capture d’écran depuis la galerie
  - Saisie manuelle avec détection automatique du format (EAN-13, EAN-8, Code 128, Code 39, QR Code, DataMatrix, ITF, UPC-A)
- **Mode Caisse natif :** Passage automatique de la luminosité matérielle à 100 %, maintien de l’écran allumé (`KeepAwake`), bascule automatique en Paysage (optionnelle), code-barres `#000000` sur fond blanc pur `#FFFFFF`, et restauration à la fermeture.
- **Sécurité biométrique & Code PIN :** Déverrouillage à l’ouverture et après 30 s en arrière-plan via le dialogue système Android (`BiometricPrompt` avec empreinte, visage ou code/schéma appareil) + code PIN personnel 4 ou 6 chiffres (SHA-256 salé).
- **Widgets natifs Android (compatibles Launcher Motorola) :**
  - **Accès Rapide (3 Cartes)** (`MesCartesQuickWidgetProvider`) : accès direct en un appui vers 3 cartes via `mescartes://card/<id>`.
  - **Carte Favorite Directe** (`MesCartesBarcodeWidgetProvider`) : affiche directement le code-barres de la carte principale (rendu natif ZXing) sur l’écran d’accueil.
- **Tiroir latéral & Sauvegarde :** Gestion complète des dossiers personnalisés (créer, renommer, réorganiser, couleur, icône, dossier privé, supprimer) et export/import `.json`.

---

## Compilation automatique de l’APK (GitHub Actions)

Sur chaque `push` sur `main` ou `master` (ou via `workflow_dispatch`), `.github/workflows/build-apk.yml` exécute `npm install`, `npm run build`, `npx cap sync android`, `node scripts/configure-android.js` et `./gradlew assembleDebug` pour publier `app-debug.apk` en tant qu’Artifact (`MesCartes-Android-APK`) et GitHub Release.
