#!/usr/bin/env python3
"""
Pousse les contenus réels d'ingeta.com dans Supabase.

    export SUPABASE_URL="https://xxxx.supabase.co"
    export SUPABASE_SERVICE_KEY="sb_secret_..."   # clé service_role (jamais côté client)
    python3 supabase/seed_content.py

Le script est idempotent : il peut être relancé pour resynchroniser.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not URL or not KEY:
    sys.exit("Définissez SUPABASE_URL et SUPABASE_SERVICE_KEY dans l'environnement.")

HEAD = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}


def push(table, rows, batch=200):
    """Insertion par lots avec upsert.

    PostgREST lit du JSON : aucun échappement SQL n'est nécessaire, les
    apostrophes, guillemets et retours à la ligne passent tels quels.
    La colonne calculée articles.search_text est remplie automatiquement
    par PostgreSQL — inutile de l'envoyer.
    """
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        req = urllib.request.Request(
            f"{URL}/rest/v1/{table}",
            data=json.dumps(chunk).encode(),
            headers=HEAD,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                r.read()
            total += len(chunk)
            print(f"  {table}: {total}/{len(rows)}")
        except urllib.error.HTTPError as e:
            print(f"  ✗ {table} — {e.code} {e.read().decode()[:400]}")
            raise
    return total


def main():
    index = json.loads((ROOT / "ingeta-index.json").read_text())
    shards = {}
    for p in index["posts"]:
        sh = p["sh"]
        if sh not in shards:
            shards[sh] = json.loads((ROOT / "content" / f"shard-{sh:02d}.json").read_text())

    print("→ Thématiques")
    thematics = [{"id": c["id"], "name": c["name"], "slug": c.get("slug"),
                  "article_count": c.get("count", 0)} for c in index["categories"]]
    push("thematics", thematics)

    print("→ Articles (métadonnées + texte intégral)")
    import re, html
    articles = []
    for p in index["posts"]:
        body = shards.get(p["sh"], {}).get(str(p["id"]), "")
        articles.append({
            "id": p["id"],
            "title": html.unescape(re.sub("<[^>]+>", "", p["title"])),
            "slug": p.get("slug"),
            "excerpt": html.unescape(re.sub("<[^>]+>", " ", p.get("excerpt") or "")).strip(),
            "content": body,
            "image_url": p.get("image"),
            "source_url": p.get("link"),
            "published_at": p.get("date"),
            "theme_ids": p.get("categories") or [],
        })
    push("articles", articles)

    print("→ Podcasts")
    pods = json.loads((ROOT / "podcasts.json").read_text())
    episodes = []
    for i, e in enumerate(pods):
        episodes.append({
            "id": f"{e.get('series','serie')}-{i}".lower().replace(" ", "-")[:120],
            "series": e.get("series"),
            "title": e.get("title"),
            "author": e.get("author"),
            "published_on": e.get("date"),
            "duration": e.get("duration"),
            "audio_url": e.get("src") or None,
            "embed_url": e.get("embed") or None,
            "image_url": e.get("featured"),
            "source_url": e.get("link") or None,
            "position": i,
        })
    push("episodes", episodes)

    print(f"\n✓ Terminé : {len(thematics)} thématiques · {len(articles)} articles · {len(episodes)} épisodes")


if __name__ == "__main__":
    main()
