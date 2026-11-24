# Backend Supabase — guide de déploiement

Ce dossier contient tout ce qu'il faut pour donner à l'application une **authentification réelle** et des **données synchronisées entre appareils**.

Temps total : environ **15 minutes**, sans carte bancaire.

| Fichier | Rôle |
|---|---|
| `schema.sql` | Crée les 14 tables, les politiques de sécurité, les triggers et la vue des discussions |
| `seed_content.py` | Pousse les 2 677 articles, 80 thématiques et 20 podcasts dans la base |

---

## 1. Créer le projet

1. **<https://supabase.com>** → *Start your project* → connexion GitHub.
2. *New project* :
   - **Name** : `ingeta`
   - **Database Password** : conservez-la (elle ne sert qu'à l'administration).
   - **Region** : `West EU (Paris)` ou `Europe (Frankfurt)` — le plus proche de vos utilisateurs européens et africains.
3. Patientez 1 à 2 minutes pendant le provisionnement.

## 2. Créer le schéma

1. Dans le tableau de bord : **SQL Editor** → *New query*.
2. Copiez **tout** le contenu de `schema.sql`.
3. *Run* (ou `Ctrl` + `Entrée`).

Le script est **idempotent** : vous pouvez le relancer sans risque, il ne détruit aucune donnée. Il crée :

- **14 tables** : profils, contenus (articles, thématiques, épisodes) et données personnelles (favoris, notes, collections, discussions, commentaires, événements, inscriptions)
- **46 politiques Row Level Security** — chacun n'accède qu'à ses propres lignes
- **5 triggers** : création automatique du profil à l'inscription, mise à jour de `updated_at`
- **1 vue** `discussions_with_meta` : auteur et nombre de réponses en une requête
- **1 index trigramme** sur `articles.search_text` pour la recherche rapide

## 3. Renseigner les clés dans l'application

**Project Settings → API Keys** :

| Champ dans `config.js` | Valeur à copier |
|---|---|
| `supabaseUrl` | *Project URL* — `https://xxxxxxxx.supabase.co` |
| `supabaseAnonKey` | *anon* / *publishable* — commence par `sb_publishable_` ou `eyJ…` |

```js
window.INGETA_CONFIG = {
  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseAnonKey: 'sb_publishable_…'
};
```

> ⚠️ **Ne mettez jamais la clé `service_role` / `secret` dans `config.js`.**
> Elle contourne toutes les politiques de sécurité et donne un accès total à la base.
> Elle ne sert qu'au script de peuplement, exécuté sur votre machine.

Une fois les clés renseignées, l'application bascule automatiquement en mode Supabase : le badge « Synchronisé » apparaît dans la barre latérale et l'écran de connexion affiche « Connecté à Supabase ».

## 4. Charger les contenus

Sur votre machine, dans le dossier de l'application :

```bash
export SUPABASE_URL="https://xxxxxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="sb_secret_…"     # clé secrète, jamais dans le navigateur

python3 supabase/seed_content.py
```

Résultat attendu :

```
→ Thématiques
  thematics: 80/80
→ Articles (métadonnées + texte intégral)
  articles: 200/2677 … 2677/2677
→ Podcasts
  episodes: 20/20

✓ Terminé : 80 thématiques · 2677 articles · 20 épisodes
```

Le script envoie les données par lots de 200 (14 requêtes, ~10 secondes) et peut être relancé pour resynchroniser. Pour récupérer d'abord les derniers articles d'ingeta.com, lancez `python3 sync_ingeta.py` juste avant.

## 5. Créer votre compte et devenir administrateur

1. Ouvrez l'application, onglet **Inscription**, créez votre compte.
2. Dans Supabase, **SQL Editor**, exécutez en remplaçant l'adresse :

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'vous@exemple.com');
```

3. Rechargez la page : l'entrée **Gestion** apparaît dans la barre latérale.

Le rôle administrateur permet de publier des articles et des podcasts, de modérer les discussions et de gérer les événements — les politiques RLS s'en chargent côté base.

## 6. Régler l'authentification

**Authentication → Providers → Email** :

- *Enable Email provider* : activé
- *Confirm email* : **désactivé** pendant la mise au point (connexion immédiate), **réactivé** en production
- *Minimum password length* : 6 (valeur par défaut)

**Authentication → URL Configuration** — indispensable pour GitHub Pages :

| Champ | Valeur |
|---|---|
| *Site URL* | `https://ingeta.github.io/ingeta-app/` |
| *Redirect URLs* | `https://ingeta.github.io/ingeta-app/` |

Sans cela, les liens de confirmation d'inscription et de réinitialisation de mot de passe ne fonctionneront pas.

## 7. Publier

```bash
git add .
git commit -m "Backend Supabase : authentification réelle et données synchronisées"
git push
```

GitHub Pages redéploie automatiquement. **Attention** : `config.js` contient vos clés publiques — c'est normal et sans danger (la clé *anon* est faite pour être exposée, la sécurité repose sur les politiques RLS). En revanche, ne commitez jamais `.env` ni la clé secrète.

---

## Ce qui change pour les utilisateurs

| Avant (mode local) | Après (Supabase) |
|---|---|
| Comptes stockés dans le navigateur | Vrais comptes, mots de passe hachés par Supabase (bcrypt) |
| Données perdues au changement d'appareil | Synchronisation entre téléphone, ordinateur et tablette |
| Favoris et notes strictement locaux | Accessibles partout, après connexion |
| Discussions simulées | Discussions réelles, partagées entre tous les membres, **en temps réel** |
| Aucune modération | Rôles `member` / `admin` appliqués par la base |

Le contenu éditorial (articles, podcasts) reste identique : il est simplement servi par PostgreSQL au lieu de fichiers statiques, ce qui permet la recherche et la pagination côté serveur — beaucoup plus rapide sur mobile.

## Vérifications déjà effectuées

Le schéma a été exécuté sur un **PostgreSQL 17 réel**, pas seulement relu :

- 14 tables, 1 vue, 46 politiques, 5 triggers créés sans erreur
- Script relancé deux fois de suite : idempotence confirmée
- **Isolation testée** : un utilisateur ne voit ni les notes, ni les favoris d'un autre
- **Écriture éditoriale bloquée** pour un membre, autorisée pour un admin
- **Cascade testée** : supprimer un compte efface ses notes, favoris et discussions
- **2 677 articles insérés** (18,2 Mo de texte) : recherche « Lumumba » → 132 résultats
- Index trigramme utilisé (`Bitmap Index Scan`) sur la colonne de recherche

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| « Connexion aux données impossible » | URL ou clé incorrecte dans `config.js`, ou schéma non exécuté |
| « new row violates row-level security policy » | Vous tentez d'écrire une ligne qui ne vous appartient pas — comportement normal |
| Articles absents après connexion | Le peuplement n'a pas été lancé (`seed_content.py`) |
| Lien de confirmation qui renvoie une erreur | *Site URL* non renseignée dans Authentication → URL Configuration |
| Pas d'accès à « Gestion » | Le rôle `admin` n'a pas été accordé à votre profil |

Pour repartir de zéro : *Project Settings → General → Reset database*, puis relancez `schema.sql` et le peuplement.
