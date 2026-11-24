/* ============================================================================
   PORTAIL PUBLIC — lecture sans compte
   ----------------------------------------------------------------------------
   Les visiteurs accèdent librement aux articles, podcasts, thématiques et
   discussions. Tout ce qui est personnel (favoris, notes, collections,
   progression) demande un compte : il n'est plus un péage, c'est un service.
   ============================================================================ */

const Pub = {
  view: 'accueil',        // onglet courant
  query: '',
  theme: null,
  cache: {},              // articles déjà chargés par vue

  /* ---------- DONNÉES ---------- */

  /* Récupère une page d'articles, en local ou depuis Supabase — sans session. */
  async fetchArticles({ search = '', themeId = null, limit = 12, offset = 0 }) {
    if (Store.mode === 'supabase') {
      const c = Store.publicClient();
      if (!c) throw new Error('Client public indisponible');
      let q = c.from('articles')
        .select('id, title, excerpt, image_url, published_at, source_url, theme_ids, slug', { count: 'exact' })
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (search) {
        const safe = search.replace(/[%,()]/g, ' ').trim();
        if (safe) q = q.ilike('search_text', `%${safe}%`);
      }
      if (themeId != null) q = q.contains('theme_ids', [themeId]);
      const { data, error, count } = await q;
      if (error) throw error;
      return { posts: projectPosts(data || []), total: count == null ? (data || []).length : count };
    }
    /* Mode local : filtrage en mémoire sur le jeu déjà chargé. */
    let rows = DATA.posts;
    if (themeId != null) rows = rows.filter(p => (p.themes || []).includes(themeId) || (p.theme_ids || []).includes(themeId));
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(p => (p.title || '').toLowerCase().includes(s) || (p.excerpt || '').toLowerCase().includes(s));
    }
    return { posts: rows.slice(offset, offset + limit), total: rows.length };
  },

  /* Article complet : exactement le même chemin que le lecteur membre.
   * En local la tranche renvoie du HTML brut ; en Supabase, row.content. */
  async fetchArticle(id) {
    if (Store.mode === 'supabase') {
      const row = await Store.getArticle(id);
      if (!row) return null;
      return { ...row, html: row.content || '' };
    }
    const p = App.postById(id);
    if (!p) return null;
    const full = await fetchFullArticle(id);
    /* fetchFullArticle renvoie directement la chaîne HTML (comme pour le lecteur membre). */
    const html = typeof full === 'string' ? full : (full && (full.content || full.html)) || '';
    return { ...p, html };
  },

  /* ---------- RENDU ---------- */

  dateLabel() {
    const d = new Date();
    const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return jour.charAt(0).toUpperCase() + jour.slice(1);
  },

  cover(post) {
    const src = post.image_url || post.image || '';
    return src
      ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : '';
  },

  /* Carte à la une. */
  leadCard(p) {
    const rub = (typeof catsOf === 'function' && catsOf(p)[0]) || 'Ingeta';
    return '<article class="pub-lead" onclick="Pub.open(' + p.id + ')">'
      + '<div class="ph">' + this.cover(p) + '<span class="tag">À la une</span></div>'
      + '<div class="bd"><div class="rub">' + esc(rub) + '</div>'
      + '<h2>' + esc(strip(p.title)) + '</h2>'
      + '<p>' + esc(strip(p.excerpt || '').slice(0, 190)) + (strip(p.excerpt || '').length > 190 ? '…' : '') + '</p>'
      + '<div class="ft"><span>⏱ ' + readMin(p) + ' min de lecture</span><span>·</span><span>' + fmtDate(p.published_at || p.date) + '</span></div>'
      + '</div></article>';
  },

  /* Ligne de la file d'articles. */
  itemRow(p) {
    const rub = (typeof catsOf === 'function' && catsOf(p)[0]) || 'Ingeta';
    const saved = Store.saved.has(Number(p.id));
    return '<article class="pub-item" onclick="Pub.open(' + p.id + ')">'
      + '<div class="txt"><div class="rub">' + esc(rub) + '</div>'
      + '<h3>' + esc(strip(p.title)) + '</h3>'
      + '<div class="meta"><span>⏱ ' + readMin(p) + ' min</span><span class="sep">·</span><span>' + fmtDate(p.published_at || p.date) + '</span>'
      + '<span class="sep">·</span><span>' + esc(strip(p.authorName || 'Ingeta')) + '</span></div></div>'
      + '<button class="save' + (saved ? ' on' : '') + '" title="Enregistrer" onclick="event.stopPropagation();Pub.save(' + p.id + ')">'
      + (saved ? '🔖' : '🏷️') + '</button>'
      + (p.image_url || p.image ? '<img class="thumb" src="' + esc(p.image_url || p.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '')
      + '</article>';
  },

  /* ---------- VUES ---------- */

  async vAccueil() {
    const { posts } = await this.fetchArticles({ limit: 11 });
    if (!posts.length) return this.empty('📭', 'Aucun contenu disponible', 'Vérifiez que les contenus sont chargés.');
    const [lead, ...rest] = posts;
    const themes = (DATA.categories || []).slice(0, 6);
    return '<div class="pub-date">' + this.dateLabel() + '<small>Édition du jour</small></div>'
      + this.leadCard(lead)
      + '<div class="pub-sec-head"><h3>À lire aujourd’hui</h3><span class="rule"></span><button class="more" onclick="App.pubGo(\'magazine\')">Tout voir →</button></div>'
      + '<div class="pub-list">' + rest.slice(0, 4).map(p => this.itemRow(p)).join('') + '</div>'
      + (themes.length ? '<div class="pub-sec-head"><h3>Explorer par thématique</h3><span class="rule"></span><button class="more" onclick="App.pubGo(\'explorer\')">Toutes →</button></div>'
        + '<div class="pub-themes">' + themes.map(t => '<button class="pub-theme" onclick="Pub.openTheme(' + t.id + ')"><b>' + esc(t.name) + '</b><span>' + (t.count || 0).toLocaleString('fr-FR') + ' articles</span></button>').join('') + '</div>' : '')
      + this.joinBanner()
      + '<div class="pub-sec-head"><h3>Continuer la lecture</h3><span class="rule"></span></div>'
      + '<div class="pub-list">' + rest.slice(4, 8).map(p => this.itemRow(p)).join('') + '</div>';
  },

  async vMagazine() {
    const { posts, total } = await this.fetchArticles({ limit: 20 });
    return '<div class="pub-date">Magazine<small>' + total.toLocaleString('fr-FR') + ' articles</small></div>'
      + '<div class="pub-list">' + posts.map(p => this.itemRow(p)).join('') + '</div>'
      + (total > posts.length
        ? '<div style="text-align:center;margin:18px 0"><button class="btn btn-primary" onclick="Pub.loadMore(this)">Voir plus d’articles</button></div>'
        : '')
      + this.joinBanner();
  },

  async vExplorer() {
    const themes = DATA.categories || [];
    if (this.theme != null) {
      const th = themes.find(t => t.id === this.theme) || { name: 'Thématique', count: 0 };
      const { posts, total } = await this.fetchArticles({ themeId: this.theme, limit: 20 });
      return '<div class="pub-date" style="cursor:pointer" onclick="App.pubGo(\'explorer\')">‹ ' + esc(th.name)
        + '<small>' + total.toLocaleString('fr-FR') + ' articles</small></div>'
        + '<div class="pub-list">' + posts.map(p => this.itemRow(p)).join('') + '</div>';
    }
    return '<div class="pub-date">Explorer<small>' + themes.length + ' thématiques</small></div>'
      + '<div class="pub-themes">' + themes.map(t =>
        '<button class="pub-theme" onclick="Pub.openTheme(' + t.id + ')"><b>' + esc(t.name) + '</b><span>'
        + (t.count || 0).toLocaleString('fr-FR') + ' articles</span></button>').join('') + '</div>'
      + this.joinBanner();
  },

  async vAudio() {
    const pods = typeof PODS !== 'undefined' ? PODS : [];
    if (!pods.length) return this.empty('🎧', 'Podcasts bientôt disponibles', 'Les épisodes se chargent depuis ingeta.com.');
    return '<div class="pub-date">Audio<small>' + pods.length + ' épisodes</small></div>'
      + '<div class="pub-list">' + pods.map((e, i) => {
        const series = esc(e.series || 'Ingeta');
        return '<article class="pub-item" onclick="App.playPodByIndex(' + i + ')">'
          + '<div class="txt"><div class="rub">' + series + '</div><h3>' + esc(e.title) + '</h3>'
          + '<div class="meta"><span>▶ Écouter</span><span>·</span><span>' + (e.duration || '—') + '</span></div></div>'
          + '<span class="thumb" style="display:grid;place-items:center;font-size:26px;color:#fff">▶</span></article>';
      }).join('') + '</div>';
  },

  async vBibliotheque() {
    const saved = [...Store.saved];
    if (!saved.length) {
      return this.empty('🔖', 'Votre bibliothèque est vide',
        'Enregistrez un article pour le retrouver ici, sur tous vos appareils.') + this.joinBanner();
    }
    const rows = [];
    for (const id of saved.slice(0, 40)) {
      const p = App.postById(id);
      if (p) rows.push(p);
    }
    return '<div class="pub-date">Bibliothèque<small>' + rows.length + ' article(s)</small></div>'
      + '<div class="pub-list">' + rows.map(p => this.itemRow(p)).join('') + '</div>';
  },

  /* Invitation à créer un compte : jamais un péage, toujours un plus. */
  joinBanner() {
    if (Store.user) return '';
    return '<div class="pub-join"><h3>Vos lectures, partout avec vous</h3>'
      + '<p>Un compte gratuit synchronise vos favoris, vos notes et votre progression de lecture entre téléphone, tablette et ordinateur.</p>'
      + '<button class="btn" onclick="App.openAuth(\'signup\')">Créer un compte gratuit</button>'
      + '<button class="lnk" onclick="App.openAuth(\'login\')">J’ai déjà un compte — se connecter</button></div>';
  },

  empty(ic, titre, txt) {
    return '<div class="pub-empty"><div class="ic">' + ic + '</div><h3>' + esc(titre) + '</h3><p>' + esc(txt) + '</p></div>';
  },

  /* ---------- NAVIGATION ---------- */

  async render() {
    const v = $('#pubView');
    if (!v) return;
    $$('.pub-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === this.view));
    v.innerHTML = '<div class="skeleton" style="height:220px;border-radius:16px;margin-bottom:14px"></div>'
      + '<div class="skeleton" style="height:86px;border-radius:14px;margin-bottom:10px"></div>'
      + '<div class="skeleton" style="height:86px;border-radius:14px"></div>';
    try {
      const fn = {
        accueil: this.vAccueil, magazine: this.vMagazine, explorer: this.vExplorer,
        audio: this.vAudio, bibliotheque: this.vBibliotheque, recherche: this.vRecherche
      }[this.view] || this.vAccueil;
      v.innerHTML = await fn.call(this);
      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error(e);
      v.innerHTML = '<div class="pub-empty"><div class="ic">⚠️</div><h3>Chargement impossible</h3><p>'
        + esc(e.message) + '</p><button class="btn btn-primary" style="margin-top:14px" onclick="Pub.render()">Réessayer</button></div>';
    }
  },

  async vRecherche() {
    const q = this.query.trim();
    if (!q) return this.vAccueil.call(this);
    const { posts, total } = await this.fetchArticles({ search: q, limit: 20 });
    if (!posts.length) {
      return '<div class="pub-date">Recherche<small>« ' + esc(q) + ' »</small></div>'
        + this.empty('🔍', 'Aucun résultat', 'Essayez un autre mot-clé — un nom propre, un thème, une expression.');
    }
    return '<div class="pub-date">Recherche<small>' + total.toLocaleString('fr-FR') + ' résultat(s) pour « ' + esc(q) + ' »</small></div>'
      + '<div class="pub-list">' + posts.map(p => this.itemRow(p)).join('') + '</div>';
  },

  pubGo(view) { this.go(view); },

  go(view) {
    this.view = view;
    if (view !== 'explorer') this.theme = null;
    if (view !== 'recherche') this.query = '';
    const inp = $('#pubSearchInput'); if (inp && view !== 'recherche') inp.value = '';
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    this.render();
  },

  openTheme(id) { this.view = 'explorer'; this.theme = id; this.render(); },

  /* ---------- ACTIONS ---------- */

  async open(id) {
    /* Sans compte on lit quand même ; seul l'enregistrement demande une session. */
    const p = App.postById(id) || null;
    const root = $('#readerRoot');
    root.classList.remove('hidden');
    document.documentElement.style.overflow = 'hidden';
    root.innerHTML = '<div class="reader"><div class="pub-reader-back">'
      + '<button class="pill" onclick="Pub.close()">← Retour</button>'
      + '<div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'
      + esc(strip((p && p.title) || 'Article')) + '</div>'
      + '<div class="reader-progress" id="rdProg" style="width:0%"></div></div>'
      + '<div class="reader-inner"><div id="rdBody" class="reader-body">'
      + '<div class="skeleton" style="height:24px;width:70%;margin-bottom:12px"></div>'
      + '<div class="skeleton" style="height:16px;width:92%;margin-bottom:8px"></div>'
      + '<div class="skeleton" style="height:16px;width:88%"></div></div></div></div>';
    try {
      const full = await this.fetchArticle(id);
      if (!full) throw new Error('Article introuvable');
      this._current = full;
      const cats = (typeof catsOf === 'function' && catsOf(full)) || ['Ingeta'];
      const saved = Store.saved.has(Number(id));
      root.innerHTML = '<div class="reader"><div class="pub-reader-back">'
        + '<button class="pill" onclick="Pub.close()">← Retour</button>'
        + '<div style="flex:1;min-width:0"><div style="font-size:10.5px;color:var(--muted);font-weight:800;letter-spacing:.05em;text-transform:uppercase">'
        + esc(cats[0]) + '</div><div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + esc(strip(full.title)) + '</div></div>'
        + '<div class="reader-progress" id="rdProg" style="width:0%"></div></div>'
        + '<div class="reader-inner">'
        + '<div class="reader-cover">' + this.cover(full) + '<div class="ov"></div><div class="in">'
        + '<span class="free-tag" style="position:static;display:inline-block">ACCÈS LIBRE · GRATUIT</span>'
        + '<h1>' + esc(strip(full.title)) + '</h1></div></div>'
        + '<div class="reader-meta"><span>' + esc(strip(full.authorName || 'Ingeta')) + '</span><span>·</span>'
        + '<span>' + fmtDate(full.published_at || full.date) + '</span><span>·</span><span>⏱ ' + readMin(full) + ' min</span></div>'
        + '<div class="reader-share">'
        + '<button class="chip-btn ' + (saved ? 'on-gold' : '') + '" onclick="Pub.save(' + id + ', true)">'
        + (saved ? '🔖 Enregistré' : '🔖 Enregistrer') + '</button>'
        + '<button class="chip-btn" onclick="Pub.needAccount(\'prendre des notes\')">📝 Prendre une note</button>'
        + '<button class="chip-btn" onclick="Pub.share(' + id + ')">↗ Partager</button>'
        + '</div>'
        + '<div class="reader-body" id="rdBody">' + (full.html ? sanitize(full.html) : this.fallback(full)) + '</div>'
        + '<div class="src-note">ℹ️ <div>Article publié sur <a href="' + esc(full.source_url || full.link || 'https://www.ingeta.com') + '" target="_blank" rel="noopener">ingeta.com</a> le '
        + fmtDate(full.published_at || full.date) + '.<br><a href="' + esc(full.source_url || full.link || 'https://www.ingeta.com') + '" target="_blank" rel="noopener">Lire la version originale ↗</a></div></div>'
        + '</div></div>';
      const rd = root.querySelector('.reader'), bar = $('#rdProg');
      rd.onscroll = () => {
        const pct = Math.min(99, Math.round((rd.scrollTop / Math.max(1, rd.scrollHeight - rd.clientHeight)) * 100));
        if (bar) bar.style.width = pct + '%';
        /* La progression n'est enregistrée que pour un lecteur connecté. */
        if (Store.user && Store.mode === 'supabase' && pct > (Store.progress[id] || 0)) {
          clearTimeout(App._pgT);
          App._pgT = setTimeout(() => Store.saveProgress(id, pct), 900);
        }
      };
    } catch (e) {
      root.innerHTML = '<div class="reader"><div class="pub-reader-back"><button class="pill" onclick="Pub.close()">← Retour</button></div>'
        + '<div class="reader-inner">' + this.empty('⚠️', 'Article indisponible', e.message) + '</div></div>';
    }
  },

  /* Repli quand le texte intégral n'est pas disponible : l'extrait et le lien source. */
  fallback(p) {
    const lien = p.source_url || p.link || 'https://www.ingeta.com';
    return '<p>' + esc(strip(p.excerpt || '')) + '</p>'
      + '<p><a href="' + esc(lien) + '" target="_blank" rel="noopener">Lire l’article complet sur ingeta.com →</a></p>';
  },

  close() {
    $('#readerRoot').classList.add('hidden');
    $('#readerRoot').innerHTML = '';
    document.documentElement.style.overflow = '';
    if (location.hash.startsWith('#article-')) history.replaceState(null, '', '#' + this.view);
  },

  /* Enregistrer sans compte : on invite, on ne bloque pas la lecture. */
  save(id, fromReader) {
    if (!Store.user) {
      this.close();
      App.openAuth('signup');
      setTimeout(() => toast('🔖 Créez un compte gratuit pour conserver cet article'), 250);
      return;
    }
    App.toggleSave(id, fromReader);
  },

  needAccount(quoi) {
    App.openAuth('signup');
    setTimeout(() => toast('📝 Un compte gratuit est nécessaire pour ' + quoi), 200);
  },

  share(id) {
    const p = this._current || App.postById(id) || {};
    const url = p.source_url || p.link || location.href;
    if (navigator.share) {
      navigator.share({ title: strip(p.title || 'Ingeta'), url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast('✓ Lien copié'));
    } else { toast(url); }
  },

  /* Pagination simple de l'onglet Magazine. */
  async loadMore(btn) {
    const shown = $$('#pubView .pub-item').length;
    btn.disabled = true; btn.textContent = 'Chargement…';
    const { posts } = await this.fetchArticles({ limit: 20, offset: shown });
    if (posts.length) {
      const list = $('#pubView .pub-list');
      list.insertAdjacentHTML('beforeend', posts.map(p => this.itemRow(p)).join(''));
      btn.disabled = false; btn.textContent = 'Voir plus d’articles';
    } else {
      btn.textContent = 'Tout est chargé';
      btn.disabled = true;
    }
  },

  /* Barre du haut : bouton de connexion ou accès à l'espace personnel. */
  refreshHead() {
    const cta = $('#pubCta');
    if (!cta) return;
    if (Store.user) {
      cta.textContent = 'Mon espace';
      cta.onclick = () => App.openMemberSpace();
    } else {
      cta.textContent = 'Se connecter';
      cta.onclick = () => App.openAuth('login');
    }
  },

  async show() {
    $('#publicApp').classList.remove('hidden');
    $('#bootScreen').classList.add('hidden');
    $('#authScreen').classList.add('hidden');
    $('#app').classList.add('hidden');
    this.refreshHead();
    const h = (location.hash || '').replace('#', '');
    if (['accueil', 'magazine', 'explorer', 'audio', 'bibliotheque', 'recherche'].includes(h)) this.view = h;
    /* Un lien profond #article-… laisse la vue courante : seul le lecteur s'ouvre. */
    await this.render();
  },

  hide() { $('#publicApp').classList.add('hidden'); }
};

window.Pub = Pub;
