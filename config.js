/* ============================================================================
   INGETA — configuration
   ----------------------------------------------------------------------------
   Renseignez les deux valeurs ci-dessous avec celles de votre projet Supabase :
   Dashboard → Project Settings → API Keys

   • URL du projet         :  https://xxxxxxxxxxxx.supabase.co
   • Clé « anon » / public :  sb_publishable_…  ou  eyJhbGciOi…

   ⚠️ N'utilisez JAMAIS la clé « service_role » / « secret » ici : elle donne
      un accès total à la base. Elle ne sert qu'au script de peuplement
      (supabase/seed_content.py), exécuté sur votre machine.

   Laissez les valeurs vides pour utiliser l'application en mode local
   (données stockées dans le navigateur, sans synchronisation).
   ============================================================================ */

window.INGETA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
