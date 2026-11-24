# INGETA — Application mobile web

Application complète (mobile-first, responsive) construite autour de **l'intégralité des contenus publics d'[ingeta.com](https://www.ingeta.com)** — « Idées & ressources pour réinventer le Congo ».

Tous les contenus sont **réels** : ils proviennent de l'API WordPress publique du site, synchronisés le **22 novembre 2026**.

> **Démo en ligne** : <https://ingeta.github.io/ingeta-app/>

---

## Deux modes, un seul code

L'application fonctionne de deux façons, sans modification du code :

| | **Mode local** (par défaut) | **Mode Supabase** |
|---|---|---|
| Configuration | aucune | 2 clés dans `config.js` |
| Authentification | simulée, stockée dans le navigateur | **réelle** (mots de passe hachés) |
| Données personnelles | dans le navigateur, un seul appareil | **synchronisées** entre appareils |
| Discussions | locales | **réelles, partagées, en temps réel** |
| Recherche et pagination | dans le navigateur | **côté serveur** (PostgreSQL) |

Le badge dans la barre latérale indique le mode actif : « Mode local » ou « ● Synchronisé ».

**Pour activer Supabase : suivez [`supabase/README.md`](supabase/README.md)** — 15 minutes, gratuit, sans carte bancaire.

## Accès libre : le portail public

L'application s'ouvre sur un **portail de lecture** — aucune inscription, aucun mot de passe. Tout le contenu éditorial est immédiatement accessible, dans l'esprit d'une grande revue :

| Onglet | Contenu |
|---|---|
| **À la une** | article du jour, file d'articles, thématiques en accès rapide |
| **Magazine** | file complète, pagination, enregistrement |
| **Explorer** | 80 thématiques, filtre par sujet |
| **Audio** | les 20 épisodes de podcast, lecture immédiate |
| **Bibliothèque** | articles enregistrés (compte requis) |

La barre de recherche interroge tout le catalogue (2 677 articles) **sans compte**, en local comme sur Supabase.

**Le compte n'est pas un péage, c'est un service.** La connexion n'apparaît que lorsqu'elle apporte quelque chose : enregistrer un article, prendre une note, créer une collection, publier une discussion, retrouver ses lectures sur un autre appareil. Un visiteur qui clique sur « Enregistrer » est invité à créer un compte — il n'est jamais bloqué en lecture.

Chaque article possède une adresse partageable : `index.html#article-18585` ouvre directement le texte intégral.

**Architecture** : le portail vit dans `public.js` (objet `Pub`), les styles dans la section *PORTAIL PUBLIC* de `app.css`. En mode Supabase, la lecture passe par `Store.publicClient()` : un client anonyme, sans session, qui s'appuie sur les politiques RLS de lecture publique.

---

## Sur téléphone

L'application est une **PWA** : elle s'installe sur l'écran d'accueil, s'ouvre en plein écran et permet de lire hors connexion les articles déjà consultés. Pas de store, pas de compte développeur.

- **Android** : ouvrir le site depuis Chrome → menu **⋮** → *Installer l'application*
- **iPhone / iPad** : depuis **Safari** → *Partager* → *Sur l'écran d'accueil*

Le détail des méthodes de test (PWA, tunnel public, réseau local) et les raisons pour lesquelles Expo Go ne s'applique pas ici sont dans **[`supabase/TESTER-SUR-TELEPHONE.md`](supabase/TESTER-SUR-TELEPHONE.md)**.

---

## PWA

| Fichier | Rôle |
|---|---|
| `manifest.webmanifest` | nom, icônes, couleurs, raccourcis d'appui long |
| `sw.js` | service worker : socle hors ligne, contenus en *stale-while-revalidate*, appels Supabase jamais mis en cache |

L'état réel est visible dans **Paramètres → 📲 Application mobile**.

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
├── manifest.webmanifest    installation sur l'écran d'accueil
├── sw.js                   service worker (hors ligne)
├── config.js               clés Supabase (vides = mode local)
├── store.js                couche de données (Supabase ou local)
├── vendor/supabase.js      client Supabase embarqué
├── supabase/
│   ├── schema.sql          tables, sécurité RLS, triggers, index
│   ├── seed_content.py     chargement des 2 677 articles dans la base
│   └── README.md           guide de déploiement pas à pas
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

**Mode local** — les données personnelles (compte, favoris, notes, collections, discussions, événements, progression de lecture, thème) sont stockées dans le `localStorage` sous les clés `ingeta_app_v3` et `ingeta_session_v3`. Elles survivent à la fermeture de l'application, sur l'appareil uniquement.

**Mode Supabase** — les données vivent en PostgreSQL et suivent l'utilisateur d'un appareil à l'autre. La session Supabase est conservée dans le stockage local du navigateur et rafraîchie automatiquement. La bibliothèque locale n'est plus utilisée, sauf si les clés sont retirées de `config.js` (retour au mode local).

---

## Sécurité

En mode Supabase, la sécurité repose sur les **politiques Row Level Security** de PostgreSQL, pas sur le code client :

- un utilisateur ne lit et ne modifie que ses propres favoris, notes, collections et progression ;
- les discussions et commentaires sont publics en lecture, modifiables par leur auteur ;
- le contenu éditorial est en lecture seule pour les membres, en écriture pour les `admin` ;
- supprimer un compte efface en cascade toutes ses données personnelles.

La clé *anon* présente dans `config.js` est **conçue pour être publique**. Ne diffusez en revanche jamais la clé *service_role*.

---

## Mentions

Application de démonstration, non officielle. Les articles, podcasts, le logo et les typographies appartiennent à **Ingeta** et sont utilisés ici à titre de démonstration autour de leurs contenus publics. Chaque article renvoie vers sa version originale sur ingeta.com.
