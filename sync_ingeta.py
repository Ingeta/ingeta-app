#!/usr/bin/env python3
"""
SYNCHRONISATION INGETA
======================
Récupère l'intégralité des contenus publics d'ingeta.com via son API WordPress
et reconstruit les fichiers utilisés par l'application.

    python3 sync_ingeta.py

Ce qui est récupéré :
  • tous les articles publiés (titre, date, extrait, contenu HTML complet,
    image à la une, catégories, lien d'origine)
  • toutes les catégories (thématiques) avec leur nombre d'articles
  • les pages du site (podcasts, manifeste, librairie, journal, enjeux…)
  • les épisodes de podcast DICO, L'Étrange guerre, Demain Le Congo
    (titres, dates, durées, URLs MP3 / iframes Apple Podcasts)
  • le logo officiel, les favicons et les visuels des séries

Fichiers produits :
  ingeta-index.json       index léger (titres, images, catégories) — chargé au démarrage
  content/shard-XX.json   contenu complet découpé en 40 tranches — chargé à l'ouverture d'un article
  podcasts.json           épisodes de podcast
  assets/                 logo, favicons, visuels

Aucune dépendance externe : uniquement la bibliothèque standard Python 3.
"""
import json
import os
import re
import html
import math
import time
import urllib.request

BASE = "https://www.ingeta.com/wp-json/wp/v2"
SITE = "https://www.ingeta.com"
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_INDEX = os.path.join(ROOT, "ingeta-index.json")
OUT_PODS = os.path.join(ROOT, "podcasts.json")
OUT_CONTENT = os.path.join(ROOT, "content")
ASSETS = os.path.join(ROOT, "assets")
HEADERS = {"User-Agent": "IngetaApp/1.0 (synchronisation des contenus)"}


def get(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:
            if attempt == tries - 1:
                raise
            print(f"   ↻ nouvelle tentative ({exc})")
            time.sleep(2)


def download(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print("   ↓", os.path.relpath(path, ROOT))


def clean_text(h):
    t = re.sub(r"<[^>]+>", " ", h or "")
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


# --------------------------------------------------------------------------
# 1. ARTICLES
# --------------------------------------------------------------------------
def fetch_posts():
    posts, page = [], 1
    while True:
        batch = get(f"{BASE}/posts?per_page=100&page={page}"
                    "&_fields=id,date,slug,link,title,excerpt,content,categories,"
                    "tags,featured_media")
        if not batch:
            break
        posts.extend(batch)
        print(f"   page {page}: {len(posts)} articles")
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.2)
    return posts


def fetch_media_map(posts):
    ids = sorted({p["featured_media"] for p in posts if p.get("featured_media")})
    print(f"   {len(ids)} images à la une à résoudre")
    mapping = {}
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        media = get(f"{BASE}/media?include={','.join(map(str, chunk))}&per_page=100"
                    "&_fields=id,source_url,media_details")
        for m in media:
            sizes = m.get("media_details", {}).get("sizes", {})
            url = ((sizes.get("large") or {}).get("source_url")
                   or (sizes.get("medium_large") or {}).get("source_url")
                   or m.get("source_url"))
            if url:
                mapping[m["id"]] = url
        print(f"     {min(i + 100, len(ids))}/{len(ids)}")
    return mapping


# --------------------------------------------------------------------------
# 2. PODCASTS
# --------------------------------------------------------------------------
def parse_ppsdata(content):
    """Les lecteurs du site exposent leurs épisodes dans data-ppsdata (JSON)."""
    out = []
    for raw in re.findall(r'data-ppsdata="([^"]+)"', content or ""):
        try:
            data = json.loads(html.unescape(raw))
        except Exception:
            continue
        for _, ep in data.items():
            if ep.get("title") and ep.get("src"):
                out.append({k: ep.get(k) for k in
                            ("title", "author", "date", "link", "src", "featured", "duration")})
    return out


def fetch_podcasts():
    episodes = []

    # DICO — page dédiée avec lecteur complet
    pages = get(f"{BASE}/pages?slug=dico&_fields=id,slug,content")
    if pages:
        for ep in parse_ppsdata(pages[0]["content"]["rendered"]):
            ep["series"] = "DICO"
            episodes.append(ep)

    # L'Étrange guerre — la page /pub/leg/ est un « portfolio » non exposé en REST
    try:
        req = urllib.request.Request(f"{SITE}/pub/leg/", headers=HEADERS)
        page_html = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "ignore")
        found = parse_ppsdata(page_html)
        if found:
            for ep in found:
                ep["series"] = "L’Étrange guerre"
                episodes.append(ep)
        else:
            # repli : titres et MP3 présents dans la page
            titles = re.findall(r'title="([^"]{8,120})"\s+data-src', page_html)
            mp3 = []
            for u in re.findall(r'https?://anchor\.fm/[^"\'\\\s<>]+\.mp3', page_html):
                u = html.unescape(u).replace("\\/", "/")
                if u not in mp3:
                    mp3.append(u)
            for t, u in zip(titles, mp3):
                episodes.append({"title": html.unescape(t), "author": "Congo Lobi Lelo",
                                 "src": u, "series": "L’Étrange guerre",
                                 "featured": "assets/img/etrange-guerre.jpg",
                                 "duration": "", "date": "", "link": ""})
    except Exception as exc:
        print("   ⚠️ L’Étrange guerre :", exc)

    # Demain Le Congo — épisodes publiés comme articles, lecteur Apple Podcasts
    for slug in ("dlc1", "dlc2",
                 "demain-le-congo-episode-3-transformer-le-savoir-en-pouvoir"):
        try:
            post = get(f"{BASE}/posts?slug={slug}&_fields=title,content,date")[0]
            c = post["content"]["rendered"]
            mp3 = re.findall(r'https?://[^"\'\\\s<>]+\.mp3', c)
            embed = re.search(r'<iframe[^>]+src="([^"]+)"', c)
            title = clean_text(post["title"]["rendered"]).split(":", 1)[-1].strip()
            episodes.append({
                "title": title, "author": "Congo Lobi Lelo",
                "date": post["date"][:10], "src": mp3[0] if mp3 else "",
                "embed": html.unescape(embed.group(1)) if embed else "",
                "series": "Demain Le Congo", "featured": "assets/img/ingeta-podcast.jpg",
                "duration": "", "link": f"{SITE}/{slug}/",
            })
        except Exception as exc:
            print(f"   ⚠️ {slug} :", exc)

    return episodes


# --------------------------------------------------------------------------
# 3. IMAGES DE MARQUE
# --------------------------------------------------------------------------
BRAND = {
    "assets/logo-160.png": f"{SITE}/wp-content/uploads/2024/11/INGETA-512.png",
    "assets/favicon-192.png": f"{SITE}/wp-content/uploads/2024/11/cropped-INGETA-512-192x192.png",
    "assets/favicon-180.png": f"{SITE}/wp-content/uploads/2024/11/cropped-INGETA-512-180x180.png",
    "assets/favicon-32.png": f"{SITE}/wp-content/uploads/2024/11/cropped-INGETA-512-32x32.png",
    "assets/img/dico.jpg": f"{SITE}/wp-content/uploads/2025/10/DICO-Presentation-900x675.jpg",
    "assets/img/etrange-guerre.jpg": f"{SITE}/wp-content/uploads/2025/01/Serie-Letrange-guerre-900x675.jpg",
    "assets/img/congo-lobi-lelo.jpg": f"{SITE}/wp-content/uploads/2025/01/Congo-Lobi-Lelo-Podcast-1.jpg",
    "assets/img/ingeta-podcast.jpg": f"{SITE}/wp-content/uploads/2025/01/42911520-1737800904160-ebbd8cd42e9eb-560x420.jpg",
}


# --------------------------------------------------------------------------
# MAIN
# --------------------------------------------------------------------------
def main():
    print("→ Catégories")
    categories = get(f"{BASE}/categories?per_page=100&_fields=id,name,slug,count")

    print("→ Articles (peut prendre 1 à 2 minutes)")
    posts = fetch_posts()
    print(f"   {len(posts)} articles récupérés")

    print("→ Images à la une")
    media = fetch_media_map(posts)

    print("→ Découpage du contenu complet")
    ordered = sorted(posts, key=lambda p: p["date"], reverse=True)
    shards = 40
    per = math.ceil(len(ordered) / shards)
    os.makedirs(OUT_CONTENT, exist_ok=True)
    buckets = {}
    shard_of = {}
    for i, p in enumerate(ordered):
        sh = i // per
        shard_of[p["id"]] = sh
        buckets.setdefault(sh, {})[str(p["id"])] = p["content"]["rendered"]
    for sh, data in buckets.items():
        with open(os.path.join(OUT_CONTENT, f"shard-{sh:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    print(f"   {len(buckets)} fichiers dans content/")

    print("→ Index")
    index = {
        "source": SITE,
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_posts": len(posts),
        "categories": categories,
        "posts": [{
            "id": p["id"], "date": p["date"], "slug": p["slug"], "link": p["link"],
            "title": p["title"]["rendered"], "excerpt": p["excerpt"]["rendered"],
            "categories": p["categories"], "image": media.get(p["featured_media"]),
            "sh": shard_of[p["id"]],
        } for p in ordered],
    }
    with open(OUT_INDEX, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    print(f"   {os.path.getsize(OUT_INDEX) / 1024 / 1024:.2f} Mo")

    print("→ Podcasts")
    episodes = fetch_podcasts()
    with open(OUT_PODS, "w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False, indent=0)
    print(f"   {len(episodes)} épisodes")

    print("→ Logo et visuels")
    for path, url in BRAND.items():
        try:
            download(url, os.path.join(ROOT, path))
        except Exception as exc:
            print("   ⚠️", path, exc)

    print("\n✓ Synchronisation terminée.")
    print(f"  {len(posts)} articles · {len(categories)} thématiques · {len(episodes)} épisodes")


if __name__ == "__main__":
    main()
