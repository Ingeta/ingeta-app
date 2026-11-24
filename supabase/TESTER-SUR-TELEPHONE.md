# Tester Ingeta sur votre téléphone

## D'abord : Expo Go ne convient pas

Expo Go exécute des applications **React Native** — du JavaScript qui dessine des composants natifs Android/iOS. Ingeta est une **application web** (HTML, CSS, JavaScript), exactement comme le site d'ingeta.com.

Il n'y a pas de code JavaScript natif à charger pour Expo : le fichier d'entrée est `index.html`. Expo Go afficherait une erreur avant même de démarrer.

La bonne nouvelle : vous n'avez **pas besoin** d'Expo pour tester sur téléphone, et pas besoin non plus de compte Google ou Apple. Une application web peut s'installer sur l'écran d'accueil et se comporter comme une vraie application — c'est ce qu'on appelle une **PWA** (Progressive Web App). C'est d'ailleurs ainsi que fonctionnent Gmail, Twitter/X ou Spotify sur mobile.

Ingeta est désormais configurée pour cela.

---

## Les trois façons de tester

| Méthode | Effort | Idéal pour |
|---|---|---|
| **1. PWA depuis GitHub Pages** | 2 minutes, aucun logiciel | Tester comme un utilisateur réel |
| **2. Vrai lien public (Cloudflare Tunnel)** | 5 minutes | Faire tester à d'autres personnes |
| **3. Expo / React Native** | plusieurs semaines | Seulement si vous visez les stores |

---

## Méthode 1 — Installer la PWA (recommandée)

### Préparation, une seule fois

```bash
git add index.html app.js manifest.webmanifest sw.js
git commit -m "Application installable (PWA)"
git push
```

GitHub Pages redéploie en une à deux minutes.

### Sur Android (Chrome, Edge, Samsung Internet)

1. Ouvrez `https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/`
2. Une bannière **« Installer l'application »** peut apparaître en bas. Sinon : menu **⋮** → *Installer l'application* (ou *Ajouter à l'écran d'accueil*).
3. L'icône Ingeta apparaît sur l'écran d'accueil. Ouvrez-la : **plein écran, sans barre d'adresse.**

### Sur iPhone / iPad (Safari obligatoire)

1. Ouvrez le site dans **Safari** (pas Chrome : sur iOS, seul Safari peut installer une PWA).
2. Bouton **Partager** (carré avec une flèche vers le haut).
3. Faites défiler → **« Sur l'écran d'accueil »** → **Ajouter**.
4. L'icône Ingeta est créée. Ouvrez-la : plein écran, sans barre d'adresse.

> L'application propose elle-même ces instructions : **Paramètres → 📲 Application mobile → Installer sur cet appareil**. Les étapes s'adaptent automatiquement à l'appareil détecté.

### Ce que vous obtenez

- Icône officielle Ingeta sur l'écran d'accueil
- Ouverture en plein écran, sans barre d'adresse
- **Lecture hors connexion** des articles déjà consultés
- Raccourcis d'appui long : Articles, Podcasts, Mes notes
- Mises à jour automatiques, sans store ni validation

---

## Méthode 2 — Un vrai lien public, sans déployer

Utile pour montrer l'application à quelqu'un ou tester sur un téléphone qui n'est pas sur votre réseau Wi-Fi.

```bash
# installer cloudflared une fois : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cd ingeta-app
python3 -m http.server 8080
# dans une seconde fenêtre :
cloudflared tunnel --url http://localhost:8080
```

Cloudflare affiche une adresse du type `https://xxx-yyy-zzz.trycloudflare.com`. Ouvrez-la sur votre téléphone : l'application est accessible depuis n'importe où, en HTTPS (donc installable).

Alternative sans rien installer : `ngrok http 8080`.

> Limite : votre ordinateur doit rester allumé. Pour un test de quelques jours, préférez GitHub Pages.

### Tester sur le réseau local (le plus rapide)

1. Ordinateur et téléphone sur le **même Wi-Fi**.
2. `python3 -m http.server 8080 --bind 0.0.0.0`
3. Sur le téléphone : `http://IP-DE-VOTRE-ORDINATEUR:8080`

> ⚠️ En HTTP simple (sans HTTPS), l'installation PWA est bloquée par le navigateur. Le site fonctionne, mais sans icône ni mode hors ligne. Utilisez GitHub Pages ou un tunnel pour tester l'installation.

---

## Méthode 3 — Expo et les stores : ce qu'il faudrait

À savoir avant de vous engager, car c'est un autre projet.

**Trois options existent :**

| Option | Ce qu'il faut | Délai réaliste |
|---|---|---|
| Restaurer l'interface dans **index.html** dans une WebView Expo (`react-native-webview`) | Compte Expo (gratuit), EAS Build | Quelques jours |
| Réécrire l'interface en **React Native** (vrai natif) | Tout réécrire : 1 100 lignes de `app.js` + 640 lignes de `app.css` | Plusieurs semaines |
| **Apache Capacitor** : empaquette le site existant en app Android/iOS | Android Studio, compte Apple à 99 $/an pour iOS | 1 à 2 jours |

**Naturellement, la WebView et Capacitor reviennent au même : afficher le site dans un conteneur natif.** Le code de l'application reste identique — on gagne surtout la présence sur les stores.

**Les coûts réels à anticiper :**

- **Google Play** : 25 $ une fois, compte développeur à vérifier (pièce d'identité).
- **App Store** : 99 $ **par an**, et une revue qui applique la règle 4.2 d'Apple : une application qui n'est qu'un site web encapsulé est souvent **refusée**. Il faut apporter du natif (notifications, mode hors ligne, partage intégré) pour justifier la présence sur le store.
- Pour tester sur un iPhone physique, un simple compte Apple gratuit suffit (l'app expire au bout de 7 jours et doit être reconstruite).

**Mon conseil** : testez d'abord la PWA. Elle couvre déjà l'usage réel — installation, plein écran, hors ligne — pour zéro euro et zéro validation. Si le projet décolle et que la visibilité sur les stores devient un vrai besoin, Capacitor sera la suite logique, avec le même code.

---

## Installer les contenus pour un test réel

En mode local, l'application fonctionne sans configuration, mais les comptes restent dans le navigateur du téléphone. Pour tester l'**authentification réelle** depuis votre téléphone, Supabase doit être configuré côté serveur.

```bash
python3 supabase/set_keys.py
```

Le script vous demande l'URL du projet et la clé publique, **vérifie qu'elles répondent**, puis écrit `config.js` à votre place. Il refuse toute clé secrète. Ensuite : `git add config.js && git commit && git push`.

Sur le téléphone, l'écran de connexion affiche alors **« Connecté à Supabase »**, et le badge **« ● Synchronisé »** apparaît dans la barre latérale.

> Supabase : pour tester vite, désactivez *Authentication → Providers → Email → Confirm email*. Sans cela, chaque inscription exige un clic dans votre boîte mail avant de pouvoir se connecter.

---

## Vérifier que tout fonctionne

Ouvrez **Paramètres** : la carte *📲 Application mobile* indique l'état réel.

| Affichage | Signification |
|---|---|
| **Installée — mode application** | Vous utilisez la PWA installée, plein écran |
| **Prête à installer** | Le navigateur propose l'installation (bouton natif) |
| **Navigateur (non installée)** | Normal avant installation, ou en HTTP simple |

Autre vérification : coupez les données mobiles, ouvrez un article déjà lu — le texte doit s'afficher.

---

## Questions fréquentes

**L'application est-elle dans les stores ?** Non, et ce n'est pas nécessaire pour tester. Depuis l'écran d'accueil, l'expérience est quasi identique.

**Les notifications push fonctionnent-elles ?** Sur Android oui, sur iOS uniquement si la PWA est installée (iOS 16.4+). Ce n'est pas encore branché dans Ingeta, mais le socle est prêt.

**Et si je change d'iPhone pour Android ?** Avec Supabase configuré, vos favoris et notes suivent votre compte. Sans Supabase, ils restent dans le navigateur d'origine.

**Puis-je partager le lien ?** Oui, le site est public. Pour un test privé entre proches, le tunnel Cloudflare de la méthode 2 est plus discret.

**Faut-il regénérer l'archive après ces changements ?** Oui : `ingeta-app.zip` doit contenir `manifest.webmanifest` et `sw.js` pour que l'installation fonctionne ailleurs.
