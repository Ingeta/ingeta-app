/* ============================================================================
   INGETA — couche de données
   ----------------------------------------------------------------------------
   Deux moteurs interchangeables, exposés par Store :

   • MODE SUPABASE (si config.js renseigné)
       – authentification réelle (auth.users, mots de passe hachés côté serveur)
       – données stockées en PostgreSQL, partagées entre appareils
       – sécurité par Row Level Security : chacun n'accède qu'à ses lignes
       – contenu éditorial lu depuis la base, filtrage et pagination côté serveur

   • MODE LOCAL (par défaut, sans configuration)
       – données d'ingeta.com chargées depuis les fichiers statiques
       – compte et bibliothèque conservés dans le navigateur

   L'interface ne connaît que Store : elle fonctionne à l'identique dans les
   deux modes, et affiche simplement un indicateur de synchronisation.
   ============================================================================ */

const SUPABASE_READY = (() => {
  const c = window.INGETA_CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey && window.supabase);
})();

const Store = {
  mode: SUPABASE_READY ? 'supabase' : 'local',
  client: null,
  user: null,          // { id, email, full_name, region, role }
  session: null,
  saved: new Set(),    // identifiants d'articles enregistrés
  liked: new Set(),
  progress: {},        // articleId -> pourcentage
  realtime: null,

  /* ------------------------------------------------------------------ */
  /*  INITIALISATION                                                    */
  /* ------------------------------------------------------------------ */
  /* Client en lecture publique : accessible sans connexion.
   * Sert le portail visiteur (articles, thématiques, podcasts, discussions). */
  publicClient() {
    if (this._pub) return this._pub;
    const cfg = window.INGETA_CONFIG || {};
    if (!cfg.supabaseUrl || !window.supabase) return null;
    this._pub = this.client || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return this._pub;
  },

  /* Le mode public ne dépend pas d'une session : il dépend de la configuration. */
  isConfigured() {
    const cfg = window.INGETA_CONFIG || {};
    return !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  },

  async init() {
    if (!SUPABASE_READY) return { mode: 'local' };
    const cfg = window.INGETA_CONFIG;
    this.client = this._pub = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data } = await this.client.auth.getSession();
    this.session = data.session || null;
    if (this.session) await this.loadProfile();
    // Récupère la session à chaque connexion / déconnexion dans un autre onglet
    this.client.auth.onAuthStateChange((event, session) => {
      this.session = session;
      if (!session) { this.user = null; this.clearCache(); }
    });
    return { mode: 'supabase', signedIn: Boolean(this.user) };
  },

  /* ------------------------------------------------------------------ */
  /*  AUTHENTIFICATION                                                  */
  /* ------------------------------------------------------------------ */
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.translateAuthError(error.message));
    this.session = data.session;
    await this.loadProfile();
    await this.hydrate();
    return this.user;
  },

  async signUp({ email, password, fullName, region }) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, region } }
    });
    if (error) throw new Error(this.translateAuthError(error.message));
    // Si la confirmation par e-mail est désactivée, la session est immédiate
    if (data.session) {
      this.session = data.session;
      await this.loadProfile();
      await this.hydrate();
      return { user: this.user, needsConfirmation: false };
    }
    return { user: null, needsConfirmation: true };
  },

  async signOut() {
    if (this.client) await this.client.auth.signOut();
    this.user = null; this.session = null; this.clearCache();
  },

  async loadProfile() {
    if (!this.session) { this.user = null; return null; }
    const uid = this.session.user.id;
    const { data, error } = await this.client
      .from('profiles').select('id, full_name, region, role, created_at')
      .eq('id', uid).maybeSingle();
    if (error) console.warn('profil:', error.message);
    this.user = {
      id: uid,
      email: this.session.user.email,
      full_name: data?.full_name || this.session.user.email.split('@')[0],
      region: data?.region || 'Afrique',
      role: data?.role || 'member',
      created_at: data?.created_at || this.session.user.created_at
    };
    return this.user;
  },

  translateAuthError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
    if (m.includes('email not confirmed')) return 'Confirmez votre adresse e-mail : un lien vous a été envoyé.';
    if (m.includes('user already registered')) return 'Un compte existe déjà avec cet e-mail.';
    if (m.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (m.includes('unable to validate email')) return 'Adresse e-mail invalide.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans une minute.';
    return msg;
  },

  async resetPassword(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split('#')[0]
    });
    if (error) throw new Error(this.translateAuthError(error.message));
  },

  async updateProfile({ fullName, region }) {
    const patch = {};
    if (fullName !== undefined) patch.full_name = fullName;
    if (region !== undefined) patch.region = region;
    const { error } = await this.client.from('profiles').update(patch).eq('id', this.user.id);
    if (error) throw new Error(error.message);
    Object.assign(this.user, patch);
  },

  /* ------------------------------------------------------------------ */
  /*  BIBLIOTHÈQUE PERSONNELLE                                          */
  /* ------------------------------------------------------------------ */
  async hydrate() {
    if (!this.user) return;
    const uid = this.user.id;
    const [s, l, p] = await Promise.all([
      this.client.from('saved_articles').select('article_id').eq('user_id', uid),
      this.client.from('liked_articles').select('article_id').eq('user_id', uid),
      this.client.from('reading_progress').select('article_id, percent').eq('user_id', uid)
    ]);
    this.saved = new Set((s.data || []).map(r => Number(r.article_id)));
    this.liked = new Set((l.data || []).map(r => Number(r.article_id)));
    this.progress = Object.fromEntries((p.data || []).map(r => [Number(r.article_id), r.percent]));
  },

  clearCache() { this.saved = new Set(); this.liked = new Set(); this.progress = {}; },

  async toggleSaved(articleId, on) {
    const uid = this.user.id;
    const id = Number(articleId);
    if (on) {
      const { error } = await this.client.from('saved_articles')
        .upsert({ user_id: uid, article_id: id }, { onConflict: 'user_id,article_id' });
      if (error) throw new Error(error.message);
      this.saved.add(id);
    } else {
      const { error } = await this.client.from('saved_articles')
        .delete().eq('user_id', uid).eq('article_id', id);
      if (error) throw new Error(error.message);
      this.saved.delete(id);
    }
  },

  async toggleLiked(articleId, on) {
    const uid = this.user.id;
    const id = Number(articleId);
    if (on) {
      const { error } = await this.client.from('liked_articles')
        .upsert({ user_id: uid, article_id: id }, { onConflict: 'user_id,article_id' });
      if (error) throw new Error(error.message);
      this.liked.add(id);
    } else {
      const { error } = await this.client.from('liked_articles')
        .delete().eq('user_id', uid).eq('article_id', id);
      if (error) throw new Error(error.message);
      this.liked.delete(id);
    }
  },

  async saveProgress(articleId, percent) {
    if (!this.user) return;
    const id = Number(articleId);
    if ((this.progress[id] || 0) >= percent) return;
    this.progress[id] = percent;
    await this.client.from('reading_progress')
      .upsert({ user_id: this.user.id, article_id: id, percent, updated_at: new Date().toISOString() },
              { onConflict: 'user_id,article_id' });
  },

  /* ------------------------------------------------------------------ */
  /*  NOTES                                                             */
  /* ------------------------------------------------------------------ */
  async listNotes() {
    const { data, error } = await this.client.from('notes')
      .select('*').eq('user_id', this.user.id).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async createNote({ title, body, articleId }) {
    const { data, error } = await this.client.from('notes')
      .insert({ user_id: this.user.id, title, body, article_id: articleId || null })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async updateNote(id, { title, body }) {
    const { data, error } = await this.client.from('notes')
      .update({ title, body }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async deleteNote(id) {
    const { error } = await this.client.from('notes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /* ------------------------------------------------------------------ */
  /*  COLLECTIONS                                                       */
  /* ------------------------------------------------------------------ */
  async listCollections() {
    const { data, error } = await this.client.from('collections')
      .select('*, collection_items(article_id, position)')
      .eq('user_id', this.user.id).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(c => ({
      id: c.id, name: c.name, description: c.description,
      postIds: (c.collection_items || [])
        .sort((a, b) => a.position - b.position).map(i => Number(i.article_id)),
      created_at: c.created_at
    }));
  },
  async createCollection({ name, description }) {
    const { data, error } = await this.client.from('collections')
      .insert({ user_id: this.user.id, name, description }).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, name: data.name, description: data.description, postIds: [] };
  },
  async updateCollection(id, { name, description }) {
    const { error } = await this.client.from('collections')
      .update({ name, description }).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteCollection(id) {
    const { error } = await this.client.from('collections').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  async addToCollection(collectionId, articleIds) {
    const rows = articleIds.map((article_id, i) => ({
      collection_id: collectionId, article_id: Number(article_id), position: i
    }));
    const { error } = await this.client.from('collection_items')
      .upsert(rows, { onConflict: 'collection_id,article_id' });
    if (error) throw new Error(error.message);
  },
  async removeFromCollection(collectionId, articleId) {
    const { error } = await this.client.from('collection_items')
      .delete().eq('collection_id', collectionId).eq('article_id', articleId);
    if (error) throw new Error(error.message);
  },

  /* ------------------------------------------------------------------ */
  /*  DISCUSSIONS                                                       */
  /* ------------------------------------------------------------------ */
  async listDiscussions() {
    const { data, error } = await this.client.from('discussions_with_meta')
      .select('*').order('created_at', { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    const ids = (data || []).map(d => d.id);
    let comments = [];
    if (ids.length) {
      const res = await this.client.from('comments')
        .select('*, profiles(full_name)').in('discussion_id', ids)
        .order('created_at', { ascending: true });
      if (res.error) console.warn(res.error.message);
      comments = res.data || [];
    }
    return (data || []).map(d => ({
      id: d.id, user_id: d.user_id, title: d.title, body: d.body,
      created_at: d.created_at, author_name: d.author_name,
      comments: comments.filter(c => c.discussion_id === d.id).map(c => ({
        id: c.id, user_id: c.user_id, body: c.body, created_at: c.created_at,
        author_name: c.profiles?.full_name || 'Membre'
      }))
    }));
  },
  async createDiscussion({ title, body }) {
    const { data, error } = await this.client.from('discussions')
      .insert({ user_id: this.user.id, title, body }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },
  async updateDiscussion(id, { title, body }) {
    const { error } = await this.client.from('discussions').update({ title, body }).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteDiscussion(id) {
    const { error } = await this.client.from('discussions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  async addComment(discussionId, body) {
    const { data, error } = await this.client.from('comments')
      .insert({ discussion_id: discussionId, user_id: this.user.id, body })
      .select('*, profiles(full_name)').single();
    if (error) throw new Error(error.message);
    return { ...data, author_name: data.profiles?.full_name || this.user.full_name };
  },

  /** Abonnement temps réel : toute nouvelle discussion ou réponse arrive sans rechargement. */
  subscribeCommunity(onChange) {
    if (!this.client) return null;
    this.realtime = this.client.channel('ingeta-community')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussions' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, onChange)
      .subscribe();
    return this.realtime;
  },
  unsubscribe() { if (this.realtime) { this.client.removeChannel(this.realtime); this.realtime = null; } },

  /* ------------------------------------------------------------------ */
  /*  ÉVÉNEMENTS                                                        */
  /* ------------------------------------------------------------------ */
  async listEvents() {
    const { data, error } = await this.client.from('events')
      .select('*, event_rsvps(user_id)').order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(e => ({
      id: e.id, title: e.title, desc: e.description, date: e.starts_at,
      time: e.time_label, place: e.place,
      rsvps: (e.event_rsvps || []).length,
      going: (e.event_rsvps || []).some(r => r.user_id === this.user?.id)
    }));
  },
  async createEvent({ title, desc, date, time, place }) {
    const { error } = await this.client.from('events')
      .insert({ title, description: desc, starts_at: date, time_label: time,
                place, created_by: this.user.id });
    if (error) throw new Error(error.message);
  },
  async updateEvent(id, { title, desc, date, time, place }) {
    const { error } = await this.client.from('events')
      .update({ title, description: desc, starts_at: date, time_label: time, place }).eq('id', id);
    if (error) throw new Error(error.message);
  },
  async deleteEvent(id) {
    const { error } = await this.client.from('events').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  async toggleRsvp(eventId, on) {
    if (on) {
      const { error } = await this.client.from('event_rsvps')
        .upsert({ event_id: eventId, user_id: this.user.id }, { onConflict: 'event_id,user_id' });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.client.from('event_rsvps')
        .delete().eq('event_id', eventId).eq('user_id', this.user.id);
      if (error) throw new Error(error.message);
    }
  },

  /* ------------------------------------------------------------------ */
  /*  CONTENU ÉDITORIAL — filtrage et pagination côté base              */
  /* ------------------------------------------------------------------ */
  async listArticles({ search = '', themeId = null, sort = 'recent', page = 1, per = 24 } = {}) {
    let q = this.client.from('articles')
      .select('id, title, excerpt, image_url, published_at, source_url, theme_ids, slug', { count: 'exact' });
    if (themeId) q = q.contains('theme_ids', [themeId]);
    if (search) {
      // Colonne calculée indexée en trigramme : recherche rapide et tolérante à la casse
      const safe = search.replace(/[%,()]/g, ' ').trim();
      if (safe) q = q.ilike('search_text', `%${safe}%`);
    }
    if (sort === 'old') q = q.order('published_at', { ascending: true });
    else if (sort === 'az') q = q.order('title', { ascending: true });
    else q = q.order('published_at', { ascending: false });
    const from = (page - 1) * per;
    q = q.range(from, from + per - 1);
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    return { posts: (data || []).map(r => ({
      id: Number(r.id), title: r.title, excerpt: r.excerpt || '',
      image: r.image_url, date: r.published_at, link: r.source_url,
      categories: r.theme_ids || [], slug: r.slug
    })), total: count || 0 };
  },

  async getArticle(id) {
    const { data, error } = await this.client.from('articles')
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async listThematics() {
    const { data, error } = await this.client.from('thematics')
      .select('*').gt('article_count', 0).order('article_count', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(t => ({ id: t.id, name: t.name, slug: t.slug, count: t.article_count }));
  },

  async listEpisodes() {
    const { data, error } = await this.client.from('episodes')
      .select('*').order('position', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(e => ({
      title: e.title, series: e.series, author: e.author, date: e.published_on,
      duration: e.duration, src: e.audio_url || '', embed: e.embed_url || '',
      featured: e.image_url, link: e.source_url || ''
    }));
  },

  /* ------------------------------------------------------------------ */
  /*  STATISTIQUES DU TABLEAU DE BORD                                   */
  /* ------------------------------------------------------------------ */
  async dashboardCounts() {
    const uid = this.user.id;
    const [notes, cols, arts] = await Promise.all([
      this.client.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      this.client.from('collections').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      this.client.from('articles').select('*', { count: 'exact', head: true })
    ]);
    return {
      notes: notes.count || 0,
      collections: cols.count || 0,
      articles: arts.count || 0,
      saved: this.saved.size,
      started: Object.keys(this.progress).length
    };
  }
};
