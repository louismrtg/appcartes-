# Mes Cartes

Application Android de gestion de cartes de fidélité, conçue pour être simple à utiliser au quotidien en magasin : sans compte, sans publicité et sans serveur externe. Toutes les cartes restent stockées localement sur le téléphone.

<p align="left">
  <img src="public/icon.svg" alt="Icône Mes Cartes" width="76" />
</p>

## Télécharger l'application (Android)

Les fichiers `.apk` sont compilés automatiquement à chaque mise à jour via GitHub Actions :

1. Ouvrez l'onglet **[Releases](https://github.com/louismrtg/appcartes-/releases)**.
2. Téléchargez **`app-debug.apk`** sur votre téléphone Android et lancez l'installation.

Lorsque le dépôt est accessible, l'application vérifie aussi au démarrage s'il existe une nouvelle version sur GitHub Releases et propose la mise à jour directement.

## Fonctionnalités

- **Ajout rapide :** scan avec l'appareil photo, lecture depuis une image de la galerie ou saisie manuelle du numéro (EAN-13, EAN-8, Code 128, Code 39, QR Code, DataMatrix, ITF, UPC-A).
- **Logos et cache local :** base d'enseignes françaises courantes + recherche en ligne avec mise en cache locale sur le téléphone.
- **Classement libre :** une carte peut appartenir à une ou plusieurs catégories, et de nouvelles catégories peuvent être créées pendant l'ajout ou via l'appui long (sélection multiple).
- **Passage en caisse :** luminosité passée à 100 % puis restaurée à la fermeture, maintien de l'écran allumé et verrouillage optionnel en mode Paysage plein écran.
- **Sécurité :** verrouillage de l'application ou de dossiers privés par biométrie Android (empreinte / visage) et code PIN (4 ou 6 chiffres).
- **Confort visuel :** options *Texte agrandi* et *Contraste élevé*, thème clair / sombre / système, et retour tactile désactivé par défaut.
- **Widgets écran d'accueil :** widget *Accès rapide (3 cartes)* et widget *Carte favorite directe* avec code-barres affiché sur l'écran d'accueil.
- **Sauvegarde :** export et réimport complet du portefeuille au format `.json`.

## Stack technique

- **Interface :** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons
- **Android natif :** Capacitor 6 (`screen-brightness`, `screen-orientation`, `keep-awake`, `biometric-auth`, `mlkit/barcode-scanning`, `preferences`) + widgets natifs Java/ZXing
- **Stockage :** IndexedDB (Dexie.js) + Capacitor Preferences

## Développement local

```bash
npm install
npm run dev
```

Pour synchroniser le projet web avec le projet Android natif :

```bash
npm run cap:sync
```

Le workflow `.github/workflows/build-apk.yml` exécute automatiquement la compilation TypeScript/Vite, la synchronisation Capacitor et `./gradlew assembleDebug` sur `ubuntu-latest` à chaque push sur `main`.

---

Louis Martignon — [@louismrtg](https://github.com/louismrtg)
