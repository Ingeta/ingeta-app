# INGETA — Application mobile web

Application complète (mobile-first, responsive) construite autour de **l'intégralité des contenus publics d'[ingeta.com](https://www.ingeta.com)** — « Idées & ressources pour réinventer le Congo ».

Tous les contenus sont **réels** : ils proviennent de l'API WordPress publique du site, synchronisés le **22 novembre 2026**.

> **Démo en ligne** — une fois publié sur GitHub Pages : `https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/`

---

## Publier sur GitHub Pages (recommandé)

L'application est 100 % statique : GitHub Pages la sert telle quelle, gratuitement, en HTTPS, sur ordinateur comme sur mobile. C'est la façon la plus simple de lui donner une **adresse publique** que vous pouvez partager.

```bash
# 1. Créer un dépôt vide sur github.com (sans README ni .gitignore)
# 2. Dans le dossier de l'application :
cd ingeta-app
git init
git add .
git commit -m "Application Ingeta — contenus réels d'ingeta.com"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/ingeta-app.git
git push -u origin main
```

Puis, sur GitHub : **Settings → Pages → Build and deployment**
- *Source* : **Deploy from a branch**
- *Branch* : **main** · *Folder* : **/ (root)**
- **Save**

L'adresse `https://VOTRE-COMPTE.github.io/ingeta-app/` est active en une à deux minutes.

### Trois précautions déjà prises
- **`.nojekyll`** est présent : sans ce fichier, GitHub Pages ignorerait le dossier `content/` et les articles ne s'ouvriraient pas.
- **Tous les chemins sont relatifs** : l'application fonctionne parfaitement dans un sous-dossier (`/ingeta-app/`), ce qui est le cas de GitHub Pages. Testé.
- **`.gitignore`** exclut les fichiers systèmes et d'éditeur.

### Taille du dépôt
Environ **22 Mo** (2 677 articles en texte intégral + 2 624 images référencées + le logo). C'est sous la limite de 100 Mo par fichier et très raisonnable pour un dépôt GitHub.

> Les images de une sont **référencées** depuis ingeta.com et non recopiées : le dépôt reste léger. Si vous préférez un fonctionnement 100 % autonome (sans dépendre du site d'origine), il faudra les télécharger — comptez alors plusieurs centaines de Mo.

### Mise à jour automatique des contenus
Le fichier `.github/workflows/sync-content.yml` est déjà en place : il relance `sync_ingeta.py` **chaque lundi à 6 h UTC** et publie les nouveaux articles automatiquement. Vous pouvez aussi le lancer à la main depuis l'onglet **Actions** du dépôt (*Synchroniser les contenus Ingeta* → *Run workflow*).

Si vous ne voulez pas de cette automatisation, supprimez simplement le dossier `.github/`.

### Installer l'app sur téléphone
Une fois en ligne, ouvrez l'adresse sur votre mobile puis :
- **Android / Chrome** : menu ⋮ → *Ajouter à l'écran d'accueil*
- **iPhone / Safari** : bouton Partager → *Sur l'écran d'accueil*

L'application s'ouvre alors en plein écran, sans barre d'adresse — comme une application native.

---

## Alternative : lancer en local

L'application charge ses contenus par `fetch()` : elle doit être servie par un serveur HTTP (le double-clic sur `index.html` affichera l'écran de connexion mais sans les articles).

```bash
cd ingeta-app
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Ou avec Node : `npx serve .`

### Comptes de démonstration
| Rôle | E-mail | Mot de passe |
|---|---|---|
| Membre | `demo@ingeta.com` | `demo1234` |
| Administrateur | `admin@ingeta.com` | `admin1234` |

Un bouton **« Entrer avec le compte démo »** permet d'accéder directement à l'application.

---

## Ce qui est réellement intégré

| Élément | Quantité | Source |
|---|---|---|
| Articles (texte intégral) | **2 677** | `wp-json/wp/v2/posts` |
| Thématiques (catégories) | **80** | `wp-json/wp/v2/categories` |
| Images à la une | **2 624** | médiathèque WordPress |
| Épisodes de podcast | **20** | DICO (11), L'Étrange guerre (6), Demain Le Congo (3) |
| Logo officiel | 512 × 512 | `INGETA-512.png` |
| Polices officielles | 3 familles | Hind Siliguri, Poppins, Playfair Display |

Les articles conservent leur **lien d'origine**, leur date, leurs catégories et l'image de une.

### Couleurs relevées sur ingeta.com
| Couleur | Code | Usage sur le site |
|---|---|---|
| Bleu Ingeta | `#0080FF` | couleur primaire, fond des blocs du thème |
| Rouge | `#D0021B` | accents, drapeau congolais |
| Jaune | `#FAB901` | accents, étoile du drapeau |
| Bordeaux | `#740D11` | couleur de repli du thème |
| Sable | `#D6CCAD` | filets et séparateurs |

---

## Fonctionnalités

**Authentification** — inscription avec nom, e-mail, mot de passe et région (Afrique, Europe, Amériques, Asie) ; connexion ; session persistante ; compte administrateur.

**Navigation** — barre latérale sur ordinateur, menu coulissant + barre de navigation inférieure sur mobile (style application native).

**Tableau de bord** — statistiques personnelles, idée du jour, à la une de la semaine, progression de lecture hebdomadaire, thématiques, séries de podcasts.

**Articles** — recherche plein texte, filtres par thématique, tri (récents / anciens / A→Z), pagination « charger plus », lecteur plein écran avec **texte intégral réel** et barre de progression au défilement.

**Podcasts** — trois séries réelles, lecture directe des fichiers MP3 avec lecteur persistant (pause, ±15 s, barre de progression, volume) ; les épisodes hébergés sur Apple Podcasts s'ouvrent dans un nouvel onglet.

**Bibliothèque personnelle**
- *Enregistrés* — favoris, avec mise à jour optimiste
- *Collections* — création, modification, suppression, ajout/retrait d'articles
- *Notes* — création, modification, suppression, notes liées à un article
- *Discussions* — création, modification, suppression de sujets et publication de réponses
- *Événements* — création, modification, suppression, inscription (RSVP)

**Administration** — vue réservée au compte admin : statistiques de contenu, table des publications récentes, accès aux versions originales.

**Paramètres** — profil, région, mode sombre, préférences, déconnexion.

**États** — squelettes de chargement, états vides avec appel à l'action, notifications toast, mises à jour optimistes, mode sombre complet.

---

## Architecture des fichiers

```
ingeta-app/
├── index.html              interface (HTML + polices embarquées + styles)
├── app.js                  logique de l'application
├── app.css                 feuille de styles (source)
├── ingeta-index.json       2 677 articles — métadonnées + images (2,2 Mo / 591 Ko gzip)
├── content/
│   └── shard-00…39.json    texte intégral, chargé à l'ouverture d'un article (~470 Ko/fichier)
├── podcasts.json           20 épisodes réels
├── sync_ingeta.py          script de resynchronisation
├── .nojekyll               nécessaire pour GitHub Pages
├── .github/workflows/      resynchronisation automatique hebdomadaire
└── assets/
    ├── logo-160.png        logo officiel Ingeta
    ├── favicon-*.png       favicons du site
    ├── fonts/              Hind Siliguri, Poppins, Playfair Display (woff2, embarquées)
    └── img/                visuels des séries de podcasts
```

**Performance** : au démarrage, seuls l'index (591 Ko gzip) et les podcasts sont chargés. Le texte intégral est découpé en 40 fichiers ; celui d'un article n'est téléchargé qu'à son ouverture et reste en cache.

---

## Mettre à jour les contenus

```bash
python3 sync_ingeta.py
```

Le script récupère les nouveaux articles, catégories, images et épisodes, puis reconstruit `ingeta-index.json`, `content/` et `podcasts.json`. Aucune dépendance à installer.

---

## Persistance

Les données personnelles (compte, favoris, notes, collections, discussions, événements, progression de lecture, thème) sont stockées dans le `localStorage` du navigateur sous les clés `ingeta_app_v3` et `ingeta_session_v3`. Elles survivent à la fermeture de l'application, sur l'appareil.

---

## Mentions

Application de démonstration, non officielle. Les articles, podcasts, le logo et les typographies appartiennent à **Ingeta** et sont utilisés ici à titre de démonstration autour de leurs contenus publics. Chaque article renvoie vers sa version originale sur ingeta.com.
