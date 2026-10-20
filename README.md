# Tempo — Pointage des heures (V1)

Application web installable (PWA) dédiée aux heures de travail. **Aucune fonction de notes de frais** : Notilus reste utilisé séparément.

## Fonctions

- Pointage en 4 étapes : arrivée, début de repas, reprise et départ.
- Départ direct sans pause, si nécessaire.
- Correction manuelle des horaires et saisie d'une pause en minutes.
- Calendrier avec saisie par journée.
- Congés, RTT, école, jours fériés, maladie et autre absence.
- Saisie groupée d'une période d'absence (jours du lundi au vendredi).
- Résumés des heures par semaine et par mois, et solde **indicatif**.
- Heures de référence configurables (39 h / semaine par défaut).
- Prise en compte paramétrable des jours d'école et de maladie ; congés, RTT et fériés assimilés dans le solde indicatif.
- Export **Excel .xlsx réel, sans dépendance Internet**, pour le mois sélectionné (Pointages, Semaines, Synthèse).
- Sauvegarde et restauration en fichier JSON.
- PWA utilisable hors ligne après première ouverture sur HTTPS.

## Installation sur GitHub Pages

1. Extraire l'archive ZIP.
2. Déposer le contenu du dossier à la **racine** d'un nouveau dépôt GitHub (ou un dossier Pages dédié). Ne pas copier le dossier englobant lui-même.
3. Sous GitHub : `Settings > Pages > Build and deployment > Deploy from a branch`, puis `main` et `/ (root)`.
4. Ouvrir le lien GitHub Pages sur iPhone **dans Safari**.
5. Safari > Partager > **Sur l'écran d'accueil**.

### Important : sauvegardes et limitations

- Les données sont conservées **localement dans le navigateur ou l'application installée**, pas sur GitHub. Elles ne se synchronisent pas automatiquement entre téléphone et ordinateur.
- Installer l'application depuis Safari peut isoler son stockage de celui du navigateur selon iOS. Sauvegarder ses données dans un fichier JSON **avant** toute désinstallation, effacement de données ou changement d'appareil.
- L'application suppose une journée de travail sur une seule date (pas de travail de nuit franchissant minuit).
- Le calcul d'une semaine répartit la durée hebdomadaire sur 5 jours ouvrés ; la référence du mois en cours ne porte que sur les jours déjà écoulés. Les valeurs sont indicatives, pas un décompte juridique des heures supplémentaires ou des droits à congés.
- La V1 gère une seule pause déjeuner par jour. Pour d'autres pauses, on peut saisir un nombre total de minutes dans le formulaire manuel.
- Les congés et RTT sont comptés par journées complètes, sans demi-journée pour l'instant.
- Pour la première mise en cache, ouvrir l'application avec une connexion Internet ; l'export Excel fonctionne ensuite hors ligne.
- Un ancien pointage de la V1 « Frais & Temps » peut être récupéré automatiquement si les deux applis sont publiées sous **la même origine**, que la nouvelle appli est vide et que l'ancien navigateur expose la base de données.

## Contenu

- `index.html` : écran et formulaires.
- `style.css` : design responsive.
- `app.js` : pointage, stockage, calendrier, sauvegarde.
- `xlsx-lite.js` : génération Excel autonome, sans CDN.
- `manifest.webmanifest` et `icons/` : installation mobile.
- `sw.js` : cache hors ligne.

Aucune clé API n'est nécessaire. Toutes les données restent sur l'appareil, sauf si l'utilisateur exporte et transmet volontairement ses fichiers.
