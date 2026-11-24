#!/usr/bin/env python3
"""Lecture des clés Supabase depuis le tableau de bord et écriture dans config.js.

    python3 supabase/set_keys.py

Le script demande l'URL du projet et la clé publique (anon / publishable),
vérifie qu'elles répondent, puis met à jour config.js. Il n'écrit jamais
de clé secrète : celle-ci ne doit pas quitter votre machine ni figurer
dans un fichier destiné au navigateur.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / 'config.js'


def demander(question: str, defaut: str = '') -> str:
    invite = f"{question} [{defaut}] : " if defaut else f"{question} : "
    try:
        val = input(invite).strip()
    except (EOFError, KeyboardInterrupt):
        print('\nAnnulé.')
        sys.exit(1)
    return val or defaut


def verifier(url: str, cle: str) -> tuple[bool, str]:
    """Interroge l'API REST : une table inexistante renvoie une erreur claire,
    mais un rejet d'authentification prouve que l'URL et la clé sont fausses."""
    endpoint = f"{url.rstrip('/')}/rest/v1/"
    req = urllib.request.Request(endpoint, headers={
        'apikey': cle,
        'Authorization': f'Bearer {cle}',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as rep:
            return True, f"API joignable (HTTP {rep.status})"
    except urllib.error.HTTPError as e:
        corps = e.read().decode('utf-8', 'replace')[:200]
        if e.code in (400, 401, 403):
            return False, f"clé refusée (HTTP {e.code}) — {corps}"
        return True, f"API joignable (HTTP {e.code})"
    except Exception as e:
        return False, f"connexion impossible — {e}"


def main() -> None:
    print("\n═══ Configuration Supabase ═══\n")
    print("Ouvrez votre projet → Project Settings → API Keys.\n")
    url = demander("Project URL", "https://xxxxxxxx.supabase.co")
    if not re.match(r'^https://[a-z0-9-]+\.supabase\.(co|in)$', url.rstrip('/')):
        print("⚠️  Format inattendu. Exemple : https://abcdefgh.supabase.co")
        if demander("Continuer quand même ? (o/n)", "n").lower() != 'o':
            sys.exit(1)

    cle = demander("Clé publique (anon / publishable)")
    if not cle:
        print("✗ Aucune clé fournie.")
        sys.exit(1)
    if cle.startswith('sb_secret') or cle.count('.') == 2 and json.dumps(cle).find('service_role') > 0:
        print("✗ Ceci ressemble à une clé SECRÈTE. Utilisez la clé publique :")
        print("  la clé secrète contourne toutes les règles de sécurité.")
        sys.exit(1)

    print("\n→ Vérification…")
    ok, msg = verifier(url, cle)
    print(('  ✓ ' if ok else '  ✗ ') + msg)
    if not ok:
        print("\nLa configuration n'a pas été modifiée.")
        sys.exit(1)

    ancien = CONFIG.read_text(encoding='utf-8')
    nouveau = re.sub(
        r"supabaseUrl:\s*'[^']*'",
        f"supabaseUrl: '{url.rstrip('/')}'", ancien, count=1)
    nouveau = re.sub(
        r"supabaseAnonKey:\s*'[^']*'",
        f"supabaseAnonKey: '{cle}'", nouveau, count=1)
    CONFIG.write_text(nouveau, encoding='utf-8')

    print(f"\n✓ config.js mis à jour : {CONFIG}")
    print("\nProchaines étapes :")
    print("  1. schema.sql exécuté dans le SQL Editor ?")
    print("  2. SUPABASE_URL=… SUPABASE_SERVICE_KEY=… python3 supabase/seed_content.py")
    print("  3. git add config.js && git commit && git push")
    print("\nSur votre téléphone, rechargez la page : le badge « ● Synchronisé » doit apparaître.\n")


if __name__ == '__main__':
    main()
