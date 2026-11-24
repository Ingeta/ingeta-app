-- ============================================================================
--  INGETA — Schéma Supabase complet
--  Authentification réelle + données synchronisées entre appareils
-- ----------------------------------------------------------------------------
--  À exécuter dans Supabase : Dashboard → SQL Editor → New query → Run.
--  Le script est idempotent : vous pouvez le relancer sans risque.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
--  1. PROFILS
--     Un profil est créé automatiquement à chaque inscription (trigger plus bas).
--     Le rôle « admin » donne accès à la gestion éditoriale.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text        not null default 'Membre',
  region      text        not null default 'Afrique'
              check (region in ('Afrique', 'Europe', 'Amériques', 'Asie')),
  role        text        not null default 'member'
              check (role in ('member', 'admin')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil public de chaque membre Ingeta.';

-- Vérifie si l'utilisateur courant est administrateur.
-- SECURITY DEFINER : évite la récursion des politiques RLS sur profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
--  2. CONTENU ÉDITORIAL (synchronisé depuis ingeta.com)
-- ---------------------------------------------------------------------------
create table if not exists public.thematics (
  id            integer primary key,
  name          text    not null,
  slug          text,
  article_count integer not null default 0
);

create table if not exists public.articles (
  id            bigint primary key,          -- identifiant du site ingeta.com
  title         text        not null,
  slug          text,
  excerpt       text,
  content       text,                        -- HTML complet (optionnel)
  image_url     text,
  source_url    text,
  published_at  timestamptz,
  theme_ids     integer[]   not null default '{}',
  synced_at     timestamptz not null default now()
);

create index if not exists articles_published_idx on public.articles (published_at desc nulls last);
create index if not exists articles_themes_idx    on public.articles using gin (theme_ids);

-- Recherche insensible à la casse (ILIKE %…%) performante.
-- search_text est une colonne calculée : un seul index trigramme sert la recherche
-- sur le titre ET l'extrait, ce qu'une clause OR sur deux colonnes ne permet pas.
create extension if not exists pg_trgm;

alter table public.articles
  add column if not exists search_text text
  generated always as (coalesce(title, '') || ' ' || coalesce(excerpt, '')) stored;

create index if not exists articles_search_trgm on public.articles using gin (search_text gin_trgm_ops);

create table if not exists public.episodes (
  id            text primary key,            -- identifiant stable (série + titre)
  series        text not null,
  title         text not null,
  author        text,
  published_on  text,
  duration      text,
  audio_url     text,
  embed_url     text,
  image_url     text,
  source_url    text,
  position      integer not null default 0
);

create index if not exists episodes_series_idx on public.episodes (series, position);

-- ---------------------------------------------------------------------------
--  3. BIBLIOTHÈQUE PERSONNELLE
-- ---------------------------------------------------------------------------
create table if not exists public.saved_articles (
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  article_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.liked_articles (
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  article_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.reading_progress (
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  article_id bigint not null,
  percent    integer not null default 0 check (percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  article_id bigint,
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes (user_id, created_at desc);

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text not null default '',
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists collections_user_idx on public.collections (user_id, created_at desc);

create table if not exists public.collection_items (
  collection_id uuid   not null references public.collections(id) on delete cascade,
  article_id    bigint not null,
  position      integer not null default 0,
  added_at      timestamptz not null default now(),
  primary key (collection_id, article_id)
);

-- ---------------------------------------------------------------------------
--  4. COMMUNAUTÉ
-- ---------------------------------------------------------------------------
create table if not exists public.discussions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists discussions_created_idx on public.discussions (created_at desc);

create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists comments_discussion_idx on public.comments (discussion_id, created_at);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  starts_at   date not null,
  time_label  text not null default '',
  place       text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists events_date_idx on public.events (starts_at);

create table if not exists public.event_rsvps (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------------------
--  5. TRIGGERS
-- ---------------------------------------------------------------------------

-- Création automatique du profil à l'inscription.
-- Le nom et la région sont lus dans les métadonnées envoyées par le client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, region)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'region', ''), 'Afrique')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mise à jour automatique de updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_notes on public.notes;
create trigger touch_notes before update on public.notes
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_collections on public.collections;
create trigger touch_collections before update on public.collections
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_discussions on public.discussions;
create trigger touch_discussions before update on public.discussions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
--  6. SÉCURITÉ — ROW LEVEL SECURITY
--     Sans ces politiques, aucune ligne n'est lisible ni modifiable.
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.thematics        enable row level security;
alter table public.articles         enable row level security;
alter table public.episodes         enable row level security;
alter table public.saved_articles   enable row level security;
alter table public.liked_articles   enable row level security;
alter table public.reading_progress enable row level security;
alter table public.notes            enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.discussions      enable row level security;
alter table public.comments         enable row level security;
alter table public.events           enable row level security;
alter table public.event_rsvps      enable row level security;

-- --- Profils : lisibles par tous (pour afficher les auteurs), modifiables par soi
drop policy if exists "profils lisibles"        on public.profiles;
drop policy if exists "profil modifiable par soi" on public.profiles;
drop policy if exists "profil créé par soi"     on public.profiles;
create policy "profils lisibles" on public.profiles
  for select using (true);
create policy "profil modifiable par soi" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profil créé par soi" on public.profiles
  for insert with check (auth.uid() = id);

-- --- Contenu éditorial : lecture publique, écriture réservée aux admins
drop policy if exists "thematiques lisibles" on public.thematics;
create policy "thematiques lisibles" on public.thematics for select using (true);
drop policy if exists "thematiques gérables" on public.thematics;
create policy "thematiques gérables" on public.thematics for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "articles lisibles" on public.articles;
create policy "articles lisibles" on public.articles for select using (true);
drop policy if exists "articles gérables" on public.articles;
create policy "articles gérables" on public.articles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "episodes lisibles" on public.episodes;
create policy "episodes lisibles" on public.episodes for select using (true);
drop policy if exists "episodes gérables" on public.episodes;
create policy "episodes gérables" on public.episodes for all
  using (public.is_admin()) with check (public.is_admin());

-- --- Bibliothèque personnelle : chacun ne voit que ses propres lignes
do $$
declare t text;
begin
  foreach t in array array['saved_articles', 'liked_articles', 'reading_progress', 'notes']
  loop
    execute format('drop policy if exists "%s sélection" on public.%I', t, t);
    execute format('drop policy if exists "%s insertion" on public.%I', t, t);
    execute format('drop policy if exists "%s mise à jour" on public.%I', t, t);
    execute format('drop policy if exists "%s suppression" on public.%I', t, t);
    execute format('create policy "%s sélection" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy "%s insertion" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s mise à jour" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy "%s suppression" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

-- --- Collections : privées par défaut, partageables si is_public
drop policy if exists "collections lisibles" on public.collections;
drop policy if exists "collections créées par soi" on public.collections;
drop policy if exists "collections modifiables par soi" on public.collections;
drop policy if exists "collections supprimables par soi" on public.collections;
create policy "collections lisibles" on public.collections
  for select using (auth.uid() = user_id or is_public);
create policy "collections créées par soi" on public.collections
  for insert with check (auth.uid() = user_id);
create policy "collections modifiables par soi" on public.collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections supprimables par soi" on public.collections
  for delete using (auth.uid() = user_id);

drop policy if exists "items lisibles" on public.collection_items;
drop policy if exists "items ajoutés par le propriétaire" on public.collection_items;
drop policy if exists "items retirés par le propriétaire" on public.collection_items;
create policy "items lisibles" on public.collection_items
  for select using (exists (
    select 1 from public.collections c
    where c.id = collection_id and (c.user_id = auth.uid() or c.is_public)
  ));
create policy "items ajoutés par le propriétaire" on public.collection_items
  for insert with check (exists (
    select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()
  ));
create policy "items retirés par le propriétaire" on public.collection_items
  for delete using (exists (
    select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()
  ));

-- --- Discussions : lecture publique, écriture authentifiée, édition par l'auteur
drop policy if exists "discussions lisibles" on public.discussions;
drop policy if exists "discussions créées par un membre" on public.discussions;
drop policy if exists "discussions modifiables par l'auteur" on public.discussions;
drop policy if exists "discussions supprimables par l'auteur ou admin" on public.discussions;
create policy "discussions lisibles" on public.discussions for select using (true);
create policy "discussions créées par un membre" on public.discussions
  for insert with check (auth.uid() = user_id);
create policy "discussions modifiables par l'auteur" on public.discussions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "discussions supprimables par l'auteur ou admin" on public.discussions
  for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists "commentaires lisibles" on public.comments;
drop policy if exists "commentaires créés par un membre" on public.comments;
drop policy if exists "commentaires modifiables par l'auteur" on public.comments;
drop policy if exists "commentaires supprimables par l'auteur ou admin" on public.comments;
create policy "commentaires lisibles" on public.comments for select using (true);
create policy "commentaires créés par un membre" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "commentaires modifiables par l'auteur" on public.comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "commentaires supprimables par l'auteur ou admin" on public.comments
  for delete using (auth.uid() = user_id or public.is_admin());

-- --- Événements : lecture publique, gestion réservée aux admins
drop policy if exists "evenements lisibles" on public.events;
drop policy if exists "evenements gérables" on public.events;
create policy "evenements lisibles" on public.events for select using (true);
create policy "evenements gérables" on public.events for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rsvp lisibles" on public.event_rsvps;
drop policy if exists "rsvp créés par soi" on public.event_rsvps;
drop policy if exists "rsvp supprimés par soi" on public.event_rsvps;
create policy "rsvp lisibles" on public.event_rsvps for select using (true);
create policy "rsvp créés par soi" on public.event_rsvps
  for insert with check (auth.uid() = user_id);
create policy "rsvp supprimés par soi" on public.event_rsvps
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
--  7. TEMPS RÉEL
--     Les discussions et commentaires se mettent à jour sans rechargement.
-- ---------------------------------------------------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.discussions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.comments';    exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.events';      exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------------
--  8. VUE PRATIQUE
--     Charge les discussions avec l'auteur et le nombre de réponses
--     en une seule requête (utilisée par l'application).
-- ---------------------------------------------------------------------------
create or replace view public.discussions_with_meta
with (security_invoker = true) as
select
  d.id,
  d.title,
  d.body,
  d.created_at,
  d.user_id,
  p.full_name  as author_name,
  p.region     as author_region,
  (select count(*) from public.comments c where c.discussion_id = d.id) as comment_count
from public.discussions d
left join public.profiles p on p.id = d.user_id;

-- ---------------------------------------------------------------------------
--  9. PREMIER ADMINISTRATEUR
-- ---------------------------------------------------------------------------
--  Après votre inscription dans l'application, exécutez ceci en remplaçant
--  l'adresse par la vôtre pour obtenir les droits d'administration :
--
--    update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'vous@exemple.com');
--
-- ---------------------------------------------------------------------------

-- === FIN DU SCRIPT ===
