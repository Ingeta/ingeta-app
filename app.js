const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const strip = h => { const d = document.createElement('div'); d.innerHTML = h || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
const fmtShort = d => { try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* =====================================================================
   DONNÉES — contenus réels d'ingeta.com (ingeta-index.json + podcasts.json)
   ===================================================================== */
const DB_KEY = 'ingeta_app_v3';
const SESSION_KEY = 'ingeta_session_v3';
let DATA = { posts: [], categories: [], themeMap: null, userMap: {}, synced: '' };
let PODS = [];

const SERIES = [
  { name: 'DICO', desc: 'Dictionnaire pour une Insurrection des Consciences', img: 'assets/img/dico.jpg' },
  { name: 'L’Étrange guerre', desc: 'Conversations avec Jean-Pierre Mbelu', img: 'assets/img/etrange-guerre.jpg' },
  { name: 'Demain Le Congo', desc: 'Réinventer le Congo avec Jean-Pierre Mbelu', img: 'assets/img/ingeta-podcast.jpg' },
];
function themeOf(catId) {
  if (DATA.themeMap && DATA.themeMap[catId]) return DATA.themeMap[catId];
  const c = DATA.categories.find(x => x.id === catId);
  return c ? c.name : 'Analyses & commentaires';
}
function catsOf(p) { const names = (p.categories || []).map(themeOf).filter(n => n && n !== 'Non classé'); return names.length ? names : ['Analyses & commentaires']; }
function readMin(p) { const words = strip(p.excerpt || '').split(/\s+/).length + 120; return Math.max(2, Math.round(words / 180)); }
function authorOf(p) { const t = strip(p.authorName || ''); return t || 'Ingeta'; }

function defaultDB() {
  const u = { id: 'u_demo', name: 'Aline Nsimba', email: 'demo@ingeta.com', pass: hash('demo1234'), region: 'Afrique', role: 'user', created: Date.now() - 86400000 * 60 };
  const a = { id: 'u_admin', name: 'Mufoncol Tshiyoyo', email: 'admin@ingeta.com', pass: hash('admin1234'), region: 'Europe', role: 'admin', created: Date.now() - 86400000 * 400 };
  return {
    users: [u, a],
    saved: { [u.id]: [], [a.id]: [] },
    liked: { [u.id]: [], [a.id]: [] },
    progress: { [u.id]: {}, [a.id]: {} },
    notes: [
      { id: 'n1', owner: u.id, postId: null, title: 'Ce que la terre congolaise signifie', text: "La question foncière n'est pas un détail technique : c'est la souveraineté elle-même. À creuser avec les articles de la catégorie « Terre ».", created: Date.now() - 86400000 * 3 },
      { id: 'n2', owner: u.id, postId: null, title: 'Idée pour une discussion', text: "Organiser un cercle de lecture à Bruxelles sur l'article « Qui reprendra Goma et Bukavu gouvernera Kinshasa ».", created: Date.now() - 86400000 },
    ],
    collections: [
      { id: 'c1', owner: u.id, name: 'Comprendre la guerre', desc: "Les fondements, les acteurs et les modes opératoires de l'étrange guerre au Congo-Kinshasa.", postIds: [], created: Date.now() - 86400000 * 12 },
      { id: 'c2', owner: u.id, name: 'Réinventer le Congo', desc: 'Textes fondateurs du projet Ingeta : refonder, reconquérir, restaurer.', postIds: [], created: Date.now() - 86400000 * 5 },
    ],
    discussions: [
      { id: 'd1', owner: 'u_admin', title: 'Faut-il enseigner le panafricanisme dès l’école primaire ?', body: "Je pense que la bataille des idées se gagne en amont. Que faudrait-il transmettre aux enfants pour qu'ils n'aient plus peur de revendiquer leur africanité ?", comments: [{ id: 'cm1', owner: 'u_demo', text: "Oui, mais pas comme une matière abstraite : par les récits, les langues et les figures locales.", date: Date.now() - 3600000 }], date: Date.now() - 86400000 * 2 },
      { id: 'd2', owner: 'u_demo', title: 'Comment organiser un cercle de lecture dans la diaspora ?', body: 'Nous sommes quelques amis à Montréal et Bruxelles. Des retours d’expérience sur des cercles qui tiennent dans le temps ?', comments: [], date: Date.now() - 86400000 * 4 },
    ],
    events: [
      { id: 'e1', title: 'Rencontre Ingeta — Refonder l’État', desc: 'Échange avec Jean-Pierre Mbelu sur les conditions d’une refondation de l’État congolais.', date: '2026-12-05', time: '18:00 (Bruxelles)', place: 'En ligne · Zoom', rsvps: 128 },
      { id: 'e2', title: 'Cercle de lecture — L’Étrange guerre', desc: 'Discussion collective autour de la série de podcasts sur la guerre au Congo-Kinshasa.', date: '2026-12-12', time: '19:00 (Kinshasa)', place: 'IFAS Kinshasa + visio', rsvps: 74 },
    ],
    rsvped: { [u.id]: [], [a.id]: [] },
    notifs: [
      { icon: '✦', text: 'Nouvel article : « Qui reprendra Goma et Bukavu gouvernera Kinshasa »', date: Date.now() - 3600000 },
      { icon: '🎧', text: 'DICO — 11 épisodes disponibles pour décrypter les concepts clés', date: Date.now() - 86400000 },
    ],
    dark: false, source: 'ingeta.com'
  };
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i); return 'h' + (h >>> 0).toString(36); }
function loadDB() { try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) {} return defaultDB(); }
let DB = loadDB();
function saveDB() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { console.warn('stockage plein', e); } }
function session() { try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; } }
function setSession(id) { try { id ? localStorage.setItem(SESSION_KEY, id) : localStorage.removeItem(SESSION_KEY); } catch (e) {} }
function me() {
  /* En mode Supabase, l'utilisateur vient de Store ; en mode local, du stockage. */
  if (Store.mode === 'supabase') {
    const p = Store.user; if (!p) return null;
    return { id: p.id, name: p.full_name, email: p.email, region: p.region,
             role: p.role, created: p.created_at };
  }
  const id = session(); return id ? DB.users.find(u => u.id === id) : null;
}

/* =====================================================================
   CHARGEMENT DES CONTENUS RÉELS
   ===================================================================== */
async function loadContent() {
  try {
    const [idx, pods] = await Promise.all([
      fetch('ingeta-index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('podcasts.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : [])
    ]);
    const dec = s => { const d = document.createElement('textarea'); d.innerHTML = s || ''; return d.value; };
    DATA.posts = (idx.posts || []).map(p => ({ ...p, title: dec(p.title), excerpt: dec(p.excerpt) }));
    DATA.categories = (idx.categories || []).map(c => ({ id: c.id, name: strip(c.name), slug: c.slug, count: c.count })).sort((a, b) => b.count - a.count);
    DATA.synced = idx.synced_at || '';
    PODS = (pods || []).map(e => ({ ...e, title: dec(e.title || ''), series: dec(e.series || '') }));
    // auteurs réels : la signature en tête du contenu
    const STOP = /^(tandis|aujourd|aujourd’hui|hier|demain|depuis|lorsque|pourtant|cependant|néanmoins|toutefois|car|donc|or|ni|voici|voilà|on|dans|en|le|la|les|un|une|des|du|de|au|aux|il|elle|nous|vous|ils|elles|ce|cet|cette|ces|qui|que|quoi|pour|par|avec|sans|sur|sous|mais|ou|et|si|comme|quand|depuis|après|avant|alors|ainsi|toutefois|pourtant|cependant|je|tu|mon|ma|mes|notre|nos|leur|leurs|son|sa|ses|the|by|and|in|of|a|an|is|are|was|were|to|for|with|from|this|that|these|those|it|its|as|at|be|been|has|have|had|will|would|can|could|should|may|might|must|do|does|did|not|no|so|if|or|but|we|they|he|she|i|you|them|his|her|our|your|my)\b/i;
    if (Store.mode !== 'supabase') DATA.posts.forEach(p => {
      const txt = strip(p.excerpt || '');
      const m = txt.match(/^(?:Par|By)\s+([A-ZÀ-Ÿ][\w’'’-]+(?:\s+[A-ZÀ-Ÿ][\w’'’-]+){0,3})/);
      let name = m ? m[1] : 'Ingeta';
      const parts = name.split(/\s+/); const kept = [parts[0]];
      for (let i = 1; i < parts.length; i++) { if (STOP.test(parts[i])) break; kept.push(parts[i]); }
      p.authorName = kept.filter(w => !STOP.test(w)).join(' ').replace(/[,.:;]$/, '');
      if (!p.authorName || p.authorName.length < 3) p.authorName = 'Ingeta';
    });
    return true;
  } catch (e) {
    console.error('Impossible de charger les contenus', e);
    return false;
  }
}

/* =====================================================================
   CHARGEMENT DU CONTENU DEPUIS SUPABASE
   ===================================================================== */
let SB_PAGE = 1, SB_TOTAL = 0, SB_QUERY = { search: '', themeId: null, sort: 'recent' };

async function loadContentFromSupabase() {
  try {
    const [thematics, episodes, first] = await Promise.all([
      Store.listThematics(),
      Store.listEpisodes(),
      Store.listArticles({ page: 1, per: 24 })
    ]);
    DATA.categories = thematics.map(t => ({ id: t.id, name: t.name, slug: t.slug, count: t.count }));
    DATA.themeMap = Object.fromEntries(thematics.map(t => [t.id, t.name]));
    PODS = episodes;
    SB_TOTAL = first.total;
    DATA.posts = projectPosts(first.posts);
    DATA.synced = new Date().toISOString();
    SB_PAGE = 1;
    return true;
  } catch (e) {
    console.error('Supabase : chargement impossible', e);
    toast('⚠️ Connexion aux données impossible — vérifiez votre configuration');
    return false;
  }
}

/* Les lignes Supabase prennent la forme attendue par l'interface. */
function projectPosts(rows) {
  return rows.map(r => ({
    id: Number(r.id), title: r.title, excerpt: r.excerpt || '',
    image: r.image, date: r.date || r.published_at, link: r.link || r.source_url,
    categories: r.theme_ids || r.categories || [], sh: null,
    authorName: 'Ingeta'
  }));
}

/* Recharge une page d'articles depuis la base (recherche, thème, tri). */
async function loadArticlePage(page, { search, themeId, sort } = {}) {
  SB_QUERY = { search: search ?? SB_QUERY.search, themeId: themeId === undefined ? SB_QUERY.themeId : themeId, sort: sort || SB_QUERY.sort };
  const res = await Store.listArticles({ ...SB_QUERY, page, per: 24 });
  SB_TOTAL = res.total;
  SB_PAGE = page;
  DATA.posts = page === 1 ? projectPosts(res.posts) : DATA.posts.concat(projectPosts(res.posts));
  return res.total;
}

/* =====================================================================
   APPLICATION
   ===================================================================== */
const App = {
  view: 'dashboard', authTab: 'login', dark: false, notifOpen: false,
  q: '', cat: 'all', sort: 'recent', page: 1, per: 24,
  collId: null, player: null, audio: null, readerPost: null, catFilter: null,
  region: 'Afrique',

  /* ---------- INIT ---------- */
  async boot() {
    const st = await Store.init();
    Store.mode = st.mode;
    if (Store.mode === 'supabase') {
      $('#bootMsg').textContent = 'Connexion à la base de données…';
      await loadContentFromSupabase();
      if (Store.user) await Store.hydrate();
    } else {
      const ok = await loadContent();
      if (!ok) $('#bootErr').classList.remove('hidden');
    }
    this.dark = Store.mode === 'supabase' ? false : !!DB.dark;
    document.body.classList.toggle('dark', this.dark);
    this.updateModeBadge();
    this.paintAuthMode();
    const demoBtn = $('#demoBox button');
    if (Store.mode === 'supabase' && demoBtn) demoBtn.remove();
    if (Store.mode === 'supabase') {
      $('#demoBox').innerHTML = '<b>Comptes réels</b><br>Créez votre compte avec le formulaire ci-dessus. '
        + 'Une confirmation par e-mail peut être demandée selon les réglages de votre projet Supabase.';
    }
    const u = me();
    if (u && DATA.posts.length) { this.enterApp(); }
    else if (location.hash.startsWith('#article-')) {
      /* Lien profond vers un article : lecture directe, sans compte. */
      const id = Number(location.hash.replace('#article-', ''));
      $('#bootScreen').classList.add('hidden');
      await Pub.show();
      if (id) Pub.open(id);
    }
    else if (this.wantsMemberSpace()) { $('#authScreen').classList.remove('hidden'); $('#bootScreen').classList.add('hidden'); }
    else { $('#bootScreen').classList.add('hidden'); Pub.show(); }
  },

  /* L'écran d'authentification n'apparaît que si l'utilisateur le demande. */
  wantsMemberSpace() { return location.hash.startsWith('#connexion') || location.hash.startsWith('#inscription'); },

  openAuth(tab) {
    $('#publicApp').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    if (tab) this.setAuthTab(tab);
    history.replaceState(null, '', tab === 'signup' ? '#inscription' : '#connexion');
  },

  /* Retour au portail public, sans perdre la session. */
  async backToPublic() {
    $('#authScreen').classList.add('hidden');
    $('#app').classList.add('hidden');
    history.replaceState(null, '', '#accueil');
    await Pub.show();
  },

  /* Depuis le portail : ouvre l'espace personnel (ou la connexion). */
  openMemberSpace() {
    if (Store.user) { this.enterApp(); } else { this.openAuth('login'); }
  },

  /* Recherche du portail public. */
  pubSearch(e) {
    if (e) e.preventDefault();
    const q = ($('#pubSearchInput') || {}).value || '';
    Pub.query = q; Pub.view = 'recherche';
    Pub.render();
    return false;
  },

  /* Délégué vers le portail public. */
  pubGo(view) { Pub.go(view); },

  pubToggleNotifs(ev) {
    if (ev) ev.stopPropagation();
    if (!Store.user) { this.openAuth('signup'); return; }
    this.go('settings');
  },
  paintAuthMode() {
    const el = $('#authMode'); if (!el) return;
    el.innerHTML = Store.mode === 'supabase'
      ? '<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(34,197,94,.12);color:#15803d;padding:3px 9px;border-radius:99px;font-weight:800;font-size:10.5px">● Connecté à Supabase</span><br>Vos lectures, notes et collections sont synchronisées entre vos appareils.'
      : '<span style="display:inline-flex;align-items:center;gap:5px;background:var(--cream);padding:3px 9px;border-radius:99px;font-weight:800;font-size:10.5px">Mode local</span><br>Les données restent dans ce navigateur.';
  },
  updateModeBadge() {
    const el = $('#modeBadge'); if (!el) return;
    if (Store.mode === 'supabase') {
      el.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span> Synchronisé';
      el.title = 'Données stockées dans Supabase et synchronisées entre vos appareils';
      el.style.background = 'rgba(34,197,94,.14)'; el.style.color = '#15803d';
    } else {
      el.innerHTML = 'Mode local';
      el.title = 'Données stockées dans ce navigateur — ajoutez vos clés Supabase dans config.js pour synchroniser';
      el.style.background = 'rgba(255,255,255,.12)'; el.style.color = 'rgba(255,255,255,.7)';
    }
  },
  enterApp() {
    $('#authScreen').classList.add('hidden'); $('#bootScreen').classList.add('hidden');
    if (window.Pub) Pub.hide();
    $('#app').classList.remove('hidden');
    this.renderShell();
    /* Raccourcis PWA et liens directs : index.html#notes, #articles, #podcasts… */
    const dest = (location.hash || '').replace('#', '');
    const valid = ['dashboard', 'articles', 'podcasts', 'themes', 'saved', 'collections', 'notes', 'discussions', 'events', 'admin', 'settings'];
    this.go(valid.includes(dest) ? dest : 'dashboard');
    /* Temps réel : les discussions et événements se rafraîchissent seuls. */
    if (Store.mode === 'supabase' && !this._rt) {
      this._rt = Store.subscribeCommunity(() => {
        if (['discussions', 'events'].includes(this.view)) this.render();
      });
    }
  },
  async forgotPassword() {
    if (Store.mode !== 'supabase') { toast('La réinitialisation nécessite Supabase. Mode local : utilisez le compte démo.'); return; }
    const email = $('#fEmail').value.trim().toLowerCase();
    if (!email) return this.authErr('Saisissez d’abord votre adresse e-mail, puis cliquez sur « Mot de passe oublié ».');
    try {
      await Store.resetPassword(email);
      $('#authErr').innerHTML = '<div class="err" style="background:var(--blue-l);color:var(--blue);border-color:#bcdcff">✉️ Un lien de réinitialisation a été envoyé à ' + esc(email) + '.</div>';
    } catch (e) { this.authErr(e.message); }
  },
  setAuthTab(t) {
    this.authTab = t;
    $('#tabLogin').classList.toggle('active', t === 'login');
    $('#tabRegister').classList.toggle('active', t === 'register');
    $('#nameField').style.display = t === 'register' ? 'block' : 'none';
    $('#regionField').style.display = t === 'register' ? 'block' : 'none';
    $('#authTitle').textContent = t === 'login' ? 'Bon retour 👋' : 'Rejoignez Ingeta ✦';
    $('#authSub').textContent = t === 'login' ? 'Retrouvez vos lectures, notes et collections — partout dans le monde.' : 'Compte gratuit en 30 secondes. Aucune carte bancaire. Aucun paywall.';
    $('#authBtn').textContent = t === 'login' ? 'Se connecter →' : 'Créer mon compte gratuit →';
    $('#authErr').innerHTML = '';
  },
  authErr(m) { $('#authErr').innerHTML = '<div class="err">⚠️ ' + esc(m) + '</div>'; return false; },
  async submitAuth(e) {
    e.preventDefault(); $('#authErr').innerHTML = '';
    const email = $('#fEmail').value.trim().toLowerCase(), pass = $('#fPass').value;

    /* ---- Mode Supabase : authentification réelle ---- */
    if (Store.mode === 'supabase') {
      const btn = $('#authBtn'); const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Veuillez patienter…';
      try {
        if (this.authTab === 'register') {
          const name = $('#fName').value.trim(), region = $('#fRegion').value;
          if (name.length < 2) { btn.disabled = false; btn.textContent = label; return this.authErr('Veuillez saisir votre nom complet.'); }
          if (pass.length < 6) { btn.disabled = false; btn.textContent = label; return this.authErr('Le mot de passe doit contenir au moins 6 caractères.'); }
          const res = await Store.signUp({ email, password: pass, fullName: name, region });
          if (res.needsConfirmation) {
            btn.disabled = false; btn.textContent = label;
            $('#authErr').innerHTML = '<div class="err" style="background:var(--blue-l);color:var(--blue);border-color:#bcdcff">✉️ Compte créé. Vérifiez votre boîte mail : cliquez sur le lien de confirmation, puis connectez-vous.</div>';
            return false;
          }
          this.region = region; this.enterApp(); toast('🎉 Bienvenue sur Ingeta, ' + name.split(' ')[0] + ' !');
          return false;
        }
        await Store.signIn(email, pass);
        this.region = Store.user.region; this.enterApp();
        toast('👋 Bon retour, ' + Store.user.full_name.split(' ')[0] + ' !');
      } catch (err) {
        btn.disabled = false; btn.textContent = label;
        return this.authErr(err.message);
      }
      btn.disabled = false; btn.textContent = label;
      return false;
    }

    /* ---- Mode local ---- */
    if (this.authTab === 'register') {
      const name = $('#fName').value.trim(), region = $('#fRegion').value;
      if (name.length < 2) return this.authErr('Veuillez saisir votre nom complet.');
      if (pass.length < 6) return this.authErr('Le mot de passe doit contenir au moins 6 caractères.');
      if (DB.users.some(u => u.email === email)) return this.authErr('Un compte existe déjà avec cet e-mail.');
      const u = { id: uid(), name, email, pass: hash(pass), region, role: 'user', created: Date.now() };
      DB.users.push(u); DB.saved[u.id] = []; DB.liked[u.id] = []; DB.progress[u.id] = {}; DB.rsvped[u.id] = [];
      saveDB(); setSession(u.id); this.region = region; this.enterApp(); toast('🎉 Bienvenue sur Ingeta, ' + name.split(' ')[0] + ' !');
    } else {
      const u = DB.users.find(u => u.email === email && u.pass === hash(pass));
      if (!u) return this.authErr('E-mail ou mot de passe incorrect. Utilisez le compte démo ci-dessous.');
      setSession(u.id); this.region = u.region; this.enterApp(); toast('👋 Bon retour, ' + u.name.split(' ')[0] + ' !');
    }
    return false;
  },
  async demoLogin() {
    if (Store.mode === 'supabase') {
      const box = $('#demoBox');
      box.innerHTML = '<div style="font-size:12px;line-height:1.6"><b>Mode Supabase actif</b><br>Créez votre compte avec le formulaire ci-dessus. Le premier inscrit peut devenir administrateur (voir README).</div>';
      return;
    }
    const u = DB.users.find(u => u.id === 'u_demo');
    setSession(u.id); this.enterApp(); toast('👋 Connecté en démo — Aline Nsimba');
  },
  async logout() { await Store.signOut(); setSession(null); location.reload(); },

  /* ---------- SHELL ---------- */
  renderShell() {
    const u = me(); if (!u) return;
    this.region = u.region;
    $('#sideName').textContent = u.name;
    $('#sideRegion').textContent = u.region + (u.role === 'admin' ? ' · Admin' : '');
    $('#sideAvatar').textContent = initials(u.name); $('#topAvatar').textContent = initials(u.name);
    const savedN = Store.mode === 'supabase' ? Store.saved.size : (DB.saved[u.id] || []).length;
    const nav = [
      { sec: 'Découvrir' },
      { id: 'dashboard', icon: '🏠', label: 'Tableau de bord' },
      { id: 'articles', icon: '📚', label: 'Articles', badge: DATA.posts.length },
      { id: 'podcasts', icon: '🎧', label: 'Podcasts', badge: PODS.length },
      { id: 'themes', icon: '✦', label: 'Thématiques' },
      { id: 'saved', icon: '🔖', label: 'Enregistrés', badge: savedN },
      { sec: 'Ma bibliothèque' },
      { id: 'collections', icon: '🗂️', label: 'Collections', badge: DB.collections.filter(c => c.owner === u.id).length },
      { id: 'notes', icon: '📝', label: 'Mes notes', badge: DB.notes.filter(n => n.owner === u.id).length },
      { id: 'discussions', icon: '💬', label: 'Discussions' },
      { id: 'events', icon: '📅', label: 'Événements' },
      { sec: 'Compte' },
      ...(u.role === 'admin' ? [{ id: 'admin', icon: '🛠️', label: 'Gestion' }] : []),
      { id: 'settings', icon: '⚙️', label: 'Paramètres' },
    ];
    $('#sideNav').innerHTML = nav.map(n => n.sec ? '<div class="label">' + n.sec + '</div>'
      : '<button class="nav-item ' + (this.view === n.id ? 'active' : '') + '" onclick="App.go(\'' + n.id + '\')"><span class="ico">' + n.icon + '</span>' + n.label + (n.badge ? '<span class="badge">' + n.badge + '</span>' : '') + '</button>').join('');
    const bn = [['dashboard', '🏠', 'Accueil'], ['articles', '📚', 'Articles'], ['podcasts', '🎧', 'Écouter'], ['saved', '🔖', 'Enregistrés'], ['settings', '👤', 'Profil']];
    $('#bottomNav').innerHTML = bn.map(b => '<button class="' + (this.view === b[0] ? 'active' : '') + '" onclick="App.go(\'' + b[0] + '\')"><span class="ico">' + b[1] + '</span>' + b[2] + '</button>').join('');
    $('#notifPanel').innerHTML = '<h4>Notifications</h4>' + DB.notifs.map(n => '<div class="notif"><div class="n-ico">' + n.icon + '</div><div>' + esc(n.text) + '<div style="color:var(--muted);font-size:10.5px;margin-top:3px">' + fmtDate(n.date) + '</div></div></div>').join('');
  },
  openSidebar() { $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); },
  closeSidebar() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); },
  toggleNotifs(e) { e.stopPropagation(); this.notifOpen = !this.notifOpen; $('#notifPanel').classList.toggle('hidden', !this.notifOpen); },
  toggleDark() { this.dark = !this.dark; DB.dark = this.dark; saveDB(); document.body.classList.toggle('dark', this.dark); toast(this.dark ? '🌙 Mode sombre activé' : '☀️ Mode clair activé'); },
  onSearch(v) {
    this.q = v.trim().toLowerCase();
    this.page = 1; this._lastQuery = null;
    if (!['articles', 'themes'].includes(this.view)) this.go('articles', true);
    else { clearTimeout(this._searchT); this._searchT = setTimeout(() => this.render(), 320); }
  },
  go(view) {
    this.view = view; this.closeSidebar(); this.notifOpen = false; $('#notifPanel').classList.add('hidden');
    /* Le hash suit la vue : liens partageables et raccourcis d'écran d'accueil. */
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    this.renderShell(); this.render(true); window.scrollTo({ top: 0 });
  },
  render(loading) {
    const v = $('#view');
    if (loading) v.innerHTML = '<div class="grid grid-3">' + '<div class="skeleton sk-card"></div>'.repeat(3) + '</div><div class="skeleton" style="height:120px;margin-top:16px"></div>';
    setTimeout(async () => {
      const fn = { dashboard: this.vDashboard, articles: this.vArticles, podcasts: this.vPodcasts, themes: this.vThemes, saved: this.vSaved, collections: this.vCollections, notes: this.vNotes, discussions: this.vDiscussions, events: this.vEvents, admin: this.vAdmin, settings: this.vSettings }[this.view];
      if (!fn) { v.innerHTML = ''; return; }
      try {
        const out = fn.call(this);
        v.innerHTML = out && typeof out.then === 'function' ? await out : out;
      } catch (e) {
        console.error(e);
        v.innerHTML = '<div class="empty"><div class="art">⚠️</div><h4>Chargement impossible</h4><p>'
          + esc(e.message || 'Erreur inconnue') + '</p><button class="btn btn-primary" style="width:auto" onclick="App.render(true)">Réessayer</button></div>';
      }
    }, loading ? 260 : 0);
  },

  /* ---------- HELPERS ---------- */
  coverImg(p, cls) {
    if (p && p.image) return '<img loading="lazy" src="' + esc(p.image) + '" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'ph\')">';
    return '';
  },
  artCard(p) {
    const saved = this.isSaved(p.id), liked = this.isLiked(p.id), prog = this.progressOf(p.id);
    const cats = catsOf(p);
    const noImg = !p.image;
    return '<article class="card" onclick="App.openArticle(' + p.id + ')">'
      + '<div class="cover ' + (noImg ? 'ph' : '') + '">' + this.coverImg(p)
      + '<span class="free-tag">GRATUIT</span>'
      + '<span class="theme-tag">' + esc(cats[0]) + '</span>'
      + (noImg ? '<div class="ph-glyph">INGETA</div>' : '') + '</div>'
      + '<div class="card-body"><h4>' + esc(p.title) + '</h4><p>' + esc(strip(p.excerpt).slice(0, 150)) + '</p>'
      + (prog ? '<div class="progress"><i style="width:' + prog + '%"></i></div><div style="font-size:11px;color:var(--muted);margin-top:5px">Lecture à ' + prog + '%</div>' : '')
      + '<div class="meta"><span class="av" style="background:var(--blue)">' + esc(initials(p.authorName)) + '</span><span>' + esc(p.authorName) + '</span><span>·</span><span>' + fmtShort(p.date) + '</span><span>·</span><span>⏱ ' + readMin(p) + ' min</span></div>'
      + '<div class="actions"><button class="chip-btn ' + (liked ? 'on' : '') + '" onclick="event.stopPropagation();App.toggleLike(' + p.id + ')">♥ Aimer</button>'
      + '<button class="chip-btn ' + (saved ? 'on-gold' : '') + '" onclick="event.stopPropagation();App.toggleSave(' + p.id + ')">' + (saved ? '🔖 Enregistré' : '🔖 Enregistrer') + '</button></div>'
      + '</div></article>';
  },
  empty(ico, title, msg, btn, fn) {
    return '<div class="empty"><div class="art">' + ico + '</div><h4>' + title + '</h4><p>' + msg + '</p>' + (btn ? '<button class="btn btn-primary" style="width:auto" onclick="' + fn + '">' + btn + '</button>' : '') + '</div>';
  },
  postById(id) { return DATA.posts.find(p => p.id === Number(id)); },

  /* ---------- ACTIONS (optimistes) ---------- */
  async toggleLike(id) {
    const u = me();
    /* Mode Supabase : mise à jour optimiste, puis écriture en base (rollback si échec). */
    if (Store.mode === 'supabase') {
      const on = !Store.liked.has(Number(id));
      on ? Store.liked.add(Number(id)) : Store.liked.delete(Number(id));
      this.renderShell(); this.render();
      if (this.readerPost && this.readerPost.id === id) this.openArticle(id, true);
      try {
        await Store.toggleLiked(id, on);
        toast(on ? '♥ Ajouté à vos coups de cœur' : 'Retiré de vos coups de cœur');
      } catch (e) {
        on ? Store.liked.delete(Number(id)) : Store.liked.add(Number(id));
        this.renderShell(); this.render(); toast('⚠️ ' + e.message);
      }
      return;
    }
    DB.liked[u.id] = DB.liked[u.id] || []; const i = DB.liked[u.id].indexOf(id);
    if (i >= 0) DB.liked[u.id].splice(i, 1); else { DB.liked[u.id].push(id); toast('♥ Ajouté à vos coups de cœur'); }
    saveDB(); this.renderShell(); this.render();
    if (this.readerPost && this.readerPost.id === id) this.openArticle(id, true);
  },
  async toggleSave(id) {
    const u = me();
    if (Store.mode === 'supabase') {
      const on = !Store.saved.has(Number(id));
      on ? Store.saved.add(Number(id)) : Store.saved.delete(Number(id));
      this.renderShell(); this.render();
      if (this.readerPost && this.readerPost.id === id) this.openArticle(id, true);
      try {
        await Store.toggleSaved(id, on);
        toast(on ? '🔖 Enregistré — retrouvez-le dans « Enregistrés »' : '🔖 Retiré des enregistrés');
      } catch (e) {
        on ? Store.saved.delete(Number(id)) : Store.saved.add(Number(id));
        this.renderShell(); this.render(); toast('⚠️ ' + e.message);
      }
      return;
    }
    DB.saved[u.id] = DB.saved[u.id] || []; const i = DB.saved[u.id].indexOf(id);
    if (i >= 0) { DB.saved[u.id].splice(i, 1); toast('🔖 Retiré des enregistrés'); }
    else { DB.saved[u.id].push(id); toast('🔖 Enregistré — retrouvez-le dans « Enregistrés »'); }
    saveDB(); this.renderShell(); this.render();
    if (this.readerPost && this.readerPost.id === id) this.openArticle(id, true);
  },
  /* Statut d'un article, quel que soit le mode. */
  isSaved(id) { return Store.mode === 'supabase' ? Store.saved.has(Number(id)) : (DB.saved[me().id] || []).includes(id); },
  isLiked(id) { return Store.mode === 'supabase' ? Store.liked.has(Number(id)) : (DB.liked[me().id] || []).includes(id); },
  progressOf(id) { return Store.mode === 'supabase' ? (Store.progress[Number(id)] || 0) : ((DB.progress[me().id] || {})[id] || 0); },

  /* ---------- DASHBOARD ---------- */
  async vDashboard() {
    const u = me();
    let savedN, notesN, readN, colsN;
    if (Store.mode === 'supabase') {
      let counts = { saved: Store.saved.size, notes: 0, collections: 0, started: Object.keys(Store.progress).length };
      try { counts = await Store.dashboardCounts(); } catch (e) { /* compteurs secondaires */ }
      savedN = counts.saved; notesN = counts.notes; readN = counts.started; colsN = counts.collections;
    } else {
      savedN = (DB.saved[u.id] || []).length;
      notesN = DB.notes.filter(n => n.owner === u.id).length;
      readN = Object.keys(DB.progress[u.id] || {}).length;
      colsN = DB.collections.filter(c => c.owner === u.id).length;
    }
    const recent = [...DATA.posts].sort((a, b) => new Date(b.date) - new Date(a.date));
    const featured = recent.slice(0, 6);
    const topics = DATA.categories.filter(c => c.count > 30).slice(0, 6);
    const ideas = [
      ['« La grande révolution que nous devons mener est idéologique. »', 'Gagner la guerre des idées'],
      ['« La terre congolaise appartient aux Congolais. »', 'Reconquérir nos terres'],
      ['« Le devenir de l’Afrique dépend de ce que nous ferons du Congo. »', 'Panafricanisme des peuples'],
      ['« Une société qui se ment n’apprend rien. »', 'Comprendre les enjeux'],
      ['« Un peuple qui s’aime ne vend pas sa terre. »', 'Restaurer la dignité'],
    ];
    const idea = ideas[new Date().getDate() % ideas.length];
    const week = [42, 68, 35, 82, 58, 91, 74];
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const heroPost = recent[0];

    return '<div class="hero"><span class="kicker">✦ Ingeta · ' + esc(u.region) + ' · Contenus réels synchronisés</span>'
      + '<h2>Réinventer le Congo,<br>une idée à la fois.</h2>'
      + '<p>' + DATA.posts.length.toLocaleString('fr-FR') + ' articles, ' + DATA.categories.length + ' thématiques et ' + PODS.length + ' épisodes de podcast — tout le contenu d’ingeta.com, en accès libre, sans paywall.</p>'
      + '<div class="row"><button class="btn btn-gold" onclick="App.go(\'articles\')">📚 Explorer les articles</button>'
      + '<button class="btn" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)" onclick="App.go(\'podcasts\')">🎧 Écouter les podcasts</button></div>'
      + '<div class="hero-side"><div class="hero-mini"><b>' + DATA.posts.length.toLocaleString('fr-FR') + '</b><span>articles</span></div><div class="hero-mini"><b>' + PODS.length + '</b><span>épisodes</span></div></div>'
      + '</div>'
      + '<div class="stat-grid">'
      + '<div class="stat"><div class="num">' + (savedN || 0) + '</div><div class="lbl">Articles enregistrés</div><span class="delta">🔖 Votre bibliothèque</span></div>'
      + '<div class="stat"><div class="num">' + readN + '</div><div class="lbl">Articles commencés</div><span class="delta">📖 Progression suivie</span></div>'
      + '<div class="stat"><div class="num">' + notesN + '</div><div class="lbl">Notes personnelles</div><span class="delta">📝 Espace privé</span></div>'
      + '<div class="stat"><div class="num">' + colsN + '</div><div class="lbl">Collections</div><span class="delta">🗂️ Organisées</span></div>'
      + '</div>'
      + '<div class="idea"><div class="ico">💡</div><div><div class="q">' + idea[0] + '</div><div class="by">— ' + idea[1].toUpperCase() + '</div></div></div>'
      + '<div class="split"><div>'
      + '<div class="section-head"><div><h3>À la une cette semaine</h3><p>Les dernières publications d’Ingeta, en accès libre.</p></div><button class="pill" onclick="App.go(\'articles\')">Tout voir →</button></div>'
      + '<div class="grid grid-2">' + featured.slice(0, 4).map(p => this.artCard(p)).join('') + '</div>'
      + '</div><div>'
      + '<div class="panel" style="margin-bottom:14px"><h4>📊 Votre lecture</h4><div class="bars">' + week.map((w, i) => '<div class="' + (w > 60 ? 'hi' : '') + '" style="height:' + w + '%"></div>').join('') + '</div><div class="bars-lbl">' + days.map(d => '<span>' + d + '</span>').join('') + '</div><p style="font-size:11.5px;color:var(--muted);margin-top:10px">' + Math.round(week.reduce((a, b) => a + b, 0) / 7) + ' % de progression moyenne cette semaine</p></div>'
      + '<div class="panel"><h4>✦ Thématiques <button class="pill" onclick="App.go(\'themes\')">Toutes</button></h4><div class="mini-list">'
      + topics.map(c => '<div class="mini-item" style="cursor:pointer" onclick="App.openTheme(' + c.id + ')"><div style="width:36px;height:36px;border-radius:9px;background:var(--blue-l);display:grid;place-items:center;font-size:15px;flex-shrink:0">✦</div><div style="flex:1;min-width:0"><b style="display:block;font-size:12.5px">' + esc(c.name) + '</b><span>' + c.count + ' articles</span></div><span style="color:var(--muted);font-size:14px">›</span></div>').join('')
      + '</div></div></div></div>'
      + '<div class="section-head" style="margin-top:22px"><div><h3>🎧 Podcasts Ingeta</h3><p>DICO, L’Étrange guerre, Demain Le Congo — les vraies séries audio du site.</p></div><button class="pill" onclick="App.go(\'podcasts\')">Tous les épisodes →</button></div>'
      + '<div class="grid grid-3">' + this.seriesCards() + '</div>';
  },
  seriesCards() {
    return SERIES.map((x, i) => '<div class="series-card" onclick="App.setSeries(' + i + ')"><img src="' + x.img + '" alt="' + esc(x.name) + '"><div style="min-width:0"><b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span><span style="color:var(--blue);font-weight:700;margin-top:3px">' + PODS.filter(e => e.series === x.name).length + ' épisode(s) →</span></div></div>').join('');
  },

  /* ---------- ARTICLES ---------- */
  filteredPosts() {
    let list = DATA.posts;
    if (this.catFilter) list = list.filter(p => (p.categories || []).includes(this.catFilter));
    if (this.q) {
      const q = this.q;
      list = list.filter(p => (p.title || '').toLowerCase().includes(q) || strip(p.excerpt).toLowerCase().includes(q));
    }
    if (this.sort === 'recent') list = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (this.sort === 'old') list = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (this.sort === 'az') list = [...list].sort((a, b) => strip(a.title).localeCompare(strip(b.title), 'fr'));
    return list;
  },
  async vArticles() {
    /* ---- Mode Supabase : la base filtre, trie et pagine ---- */
    if (Store.mode === 'supabase') {
      let total = SB_TOTAL;
      const firstLoad = this._lastQuery !== JSON.stringify([this.q, this.catFilter, this.sort]);
      if (firstLoad) {
        try {
          total = await loadArticlePage(1, { search: this.q, themeId: this.catFilter, sort: this.sort });
          this.page = 1;
          this._lastQuery = JSON.stringify([this.q, this.catFilter, this.sort]);
        } catch (e) { toast('⚠️ ' + e.message); }
      } else {
        total = SB_TOTAL;
      }
      const shown = DATA.posts;
      const cats = DATA.categories.slice(0, 14);
      return '<div class="section-head"><div><h3>Articles</h3><p>' + total.toLocaleString('fr-FR') + ' article(s) — contenus authentiques d’ingeta.com, libres d’accès.</p></div>'
        + '<button class="pill" onclick="App.go(\'themes\')">Voir par thématique →</button></div>'
        + '<div class="filter-bar"><div class="scroll-x" style="flex:1;min-width:0">'
        + '<button class="chip ' + (!this.catFilter ? 'on' : '') + '" onclick="App.setCat(null)">Toutes</button>'
        + cats.map(c => '<button class="chip ' + (this.catFilter === c.id ? 'on' : '') + '" onclick="App.setCat(' + c.id + ')">' + esc(c.name) + ' <span style="opacity:.65">' + c.count + '</span></button>').join('')
        + '</div><select onchange="App.sort=this.value;App._lastQuery=null;App.render()"><option value="recent" ' + (this.sort === 'recent' ? 'selected' : '') + '>Plus récents</option><option value="old" ' + (this.sort === 'old' ? 'selected' : '') + '>Plus anciens</option><option value="az" ' + (this.sort === 'az' ? 'selected' : '') + '>A → Z</option></select></div>'
        + (shown.length ? '<div class="grid grid-3">' + shown.map(p => this.artCard(p)).join('') + '</div>'
          + (total > shown.length ? '<div style="text-align:center;margin-top:22px"><button class="btn btn-outline" style="width:auto" onclick="App.loadMore()" id="moreBtn">Charger plus (' + (total - shown.length).toLocaleString('fr-FR') + ' restants)</button></div>' : '')
          : this.empty('🔎', 'Aucun article trouvé', 'Essayez un autre mot-clé ou retirez les filtres actifs.', 'Réinitialiser', "App.q='';App.catFilter=null;App._lastQuery=null;App.render()"));
    }

    /* ---- Mode local ---- */
    const all = this.filteredPosts();
    const shown = all.slice(0, this.page * this.per);
    const cats = DATA.categories.filter(c => c.count > 0).slice(0, 14);
    return '<div class="section-head"><div><h3>Articles</h3><p>' + all.length.toLocaleString('fr-FR') + ' article(s) — contenus authentiques d’ingeta.com, libres d’accès.</p></div>'
      + '<button class="pill" onclick="App.go(\'themes\')">Voir par thématique →</button></div>'
      + '<div class="filter-bar"><input class="hidden"><div class="scroll-x" style="flex:1;min-width:0">'
      + '<button class="chip ' + (!this.catFilter ? 'on' : '') + '" onclick="App.setCat(null)">Toutes</button>'
      + cats.map(c => '<button class="chip ' + (this.catFilter === c.id ? 'on' : '') + '" onclick="App.setCat(' + c.id + ')">' + esc(c.name) + ' <span style="opacity:.65">' + c.count + '</span></button>').join('')
      + '</div><select onchange="App.sort=this.value;App.render()"><option value="recent" ' + (this.sort === 'recent' ? 'selected' : '') + '>Plus récents</option><option value="old" ' + (this.sort === 'old' ? 'selected' : '') + '>Plus anciens</option><option value="az" ' + (this.sort === 'az' ? 'selected' : '') + '>A → Z</option></select></div>'
      + (all.length ? '<div class="grid grid-3">' + shown.map(p => this.artCard(p)).join('') + '</div>'
        + (all.length > shown.length ? '<div style="text-align:center;margin-top:22px"><button class="btn btn-outline" style="width:auto" onclick="App.page++;App.render()">Charger plus (' + (all.length - shown.length).toLocaleString('fr-FR') + ' restants)</button></div>' : '')
        : this.empty('🔎', 'Aucun article trouvé', 'Essayez un autre mot-clé ou retirez les filtres actifs.', 'Réinitialiser', "App.q='';App.catFilter=null;App.render()"));
  },
  async loadMore() {
    const btn = $('#moreBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Chargement…'; }
    try {
      await loadArticlePage(SB_PAGE + 1);
      this.page = SB_PAGE;
      const wrap = $('#view .grid');
      const before = wrap.children.length;
      wrap.insertAdjacentHTML('beforeend', DATA.posts.slice(before).map(p => this.artCard(p)).join(''));
      const remaining = SB_TOTAL - DATA.posts.length;
      if (btn) {
        if (remaining > 0) { btn.disabled = false; btn.textContent = 'Charger plus (' + remaining.toLocaleString('fr-FR') + ' restants)'; }
        else btn.parentElement.remove();
      }
    } catch (e) { toast('⚠️ ' + e.message); if (btn) { btn.disabled = false; btn.textContent = 'Réessayer'; } }
  },
  setCat(id) { this.catFilter = id; this.page = 1; this._lastQuery = null; this.render(); },
  openTheme(id) { this.catFilter = id; this.view = 'articles'; this.page = 1; this._lastQuery = null; this.renderShell(); this.render(true); window.scrollTo({ top: 0 }); },

  /* ---------- THÈMES ---------- */
  vThemes() {
    const cats = DATA.categories.filter(c => c.count > 0);
    return '<div class="section-head"><div><h3>Thématiques</h3><p>Les ' + cats.length + ' rubriques réelles du site Ingeta.</p></div></div>'
      + '<div class="grid grid-3">' + cats.map(c => {
        const sample = DATA.posts.filter(p => (p.categories || []).includes(c.id)).slice(0, 1)[0];
        return '<article class="card" onclick="App.openTheme(' + c.id + ')">'
          + '<div class="cover ' + (sample && sample.image ? '' : 'ph') + '" style="height:110px">' + (sample ? this.coverImg(sample) : '')
          + '<div class="ph-glyph" style="font-size:22px">✦</div></div>'
          + '<div class="card-body"><h4>' + esc(c.name) + '</h4><div class="meta"><span>' + c.count + ' article(s)</span></div></div></article>';
      }).join('') + '</div>';
  },

  /* ---------- PODCASTS ---------- */
  vPodcasts() {
    const series = [...new Set(PODS.map(e => e.series))];
    const list = this.seriesFilter ? PODS.filter(e => e.series === this.seriesFilter) : PODS;
    return '<div class="section-head"><div><h3>Podcasts</h3><p>' + PODS.length + ' épisodes réels — lecture directe depuis les flux d’Ingeta.</p></div>'
      + '<a class="pill" href="https://www.ingeta.com/podcasts/" target="_blank" rel="noopener">Voir sur ingeta.com ↗</a></div>'
      + '<div class="pod-feature"><img src="assets/img/congo-lobi-lelo.jpg" alt="Congo Lobi Lelo"><div class="pf-in"><h3>Congo Lobi Lelo</h3><p>Le podcast d’Ingeta consacré aux enjeux et défis congolais et africains contemporains. Des conversations ambitieuses intellectuellement, responsables politiquement et pertinentes socialement. Pour réinventer notre avenir.</p><button class="btn btn-gold btn-sm" onclick="App.playPod(' + JSON.stringify(PODS[0] ? PODS[0].src : '').replace(/"/g, '&quot;') + ')">▶ Lire le dernier épisode</button></div></div>'
      + '<div class="filter-bar"><button class="chip ' + (!this.seriesFilter ? 'on' : '') + '" onclick="App.seriesFilter=null;App.render()">Toutes les séries</button>'
      + SERIES.map((s, i) => '<button class="chip ' + (this.seriesFilter === s.name ? 'on' : '') + '" onclick="App.setSeries(' + i + ')">' + esc(s.name) + '</button>').join('') + '</div>'
      + '<div class="series-grid">' + this.seriesCards() + '</div>'
      + '<div class="panel" style="padding:6px 0"><div class="ep" style="padding:12px 16px;background:var(--cream);border-radius:10px;margin:0 0 4px"><b style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">' + (list.length) + ' épisode(s)' + (this.seriesFilter ? ' · ' + esc(this.seriesFilter) : '') + '</b></div>'
      + list.map((e, i) => '<div class="ep"><button class="ep-play" onclick="App.playPod(' + JSON.stringify(e.src || '').replace(/"/g, '&quot;') + ',\'' + encodeURIComponent(e.title) + '\',\'' + encodeURIComponent(e.series) + '\',' + JSON.stringify(e.embed || '').replace(/"/g, '&quot;') + ')">▶</button>'
        + '<div class="ep-info"><b>' + esc(e.title) + '</b><span>' + esc(e.series) + (e.date ? ' · ' + esc(e.date) : '') + '</span></div>'
        + '<span class="ep-dur">' + esc(e.duration || '') + '</span></div>').join('') + '</div>';
  },
  openSeries(name) { this.seriesFilter = name; this.view = 'podcasts'; this.renderShell(); this.render(true); window.scrollTo({ top: 0 }); },
  setSeries(i) { this.seriesFilter = SERIES[i] ? SERIES[i].name : null; this.render(); },
  playPod(src, title, series, embed) {
    const t = title ? decodeURIComponent(title) : 'Épisode Ingeta', s = series ? decodeURIComponent(series) : 'Congo Lobi Lelo';
    if (embed && !src) { window.open(embed.replace('embed.podcasts.apple.com', 'podcasts.apple.com'), '_blank'); toast('🎧 Ouverture de l’épisode sur Apple Podcasts'); return; }
    if (!src) { toast('⚠️ Cet épisode est hébergé sur Apple Podcasts — ouverture…'); window.open(embed || 'https://www.ingeta.com/podcasts/', '_blank'); return; }
    if (!this.audio) this.audio = new Audio();
    this.audio.pause();
    this.audio.src = src;
    this.player = { title: t, series: s };
    this.audio.preload = 'auto';
    this.audio.onerror = () => toast('⚠️ Flux audio indisponible — écoutez sur ingeta.com');
    this.audio.play().then(() => toast('🎧 Lecture : ' + t)).catch(err => { console.warn(err); toast('▶ Épisode prêt — appuyez sur lecture'); });
    this.renderPlayer();
    this.audio.onloadedmetadata = () => this.renderPlayer();
    this.audio.ontimeupdate = () => this.updatePlayerBar();
    this.audio.onended = () => toast('✓ Épisode terminé');
  },
  renderPlayer() {
    if (!this.player) return;
    const img = this.player.series.includes('DICO') ? 'assets/img/dico.jpg' : this.player.series.includes('Étrange') ? 'assets/img/etrange-guerre.jpg' : 'assets/img/congo-lobi-lelo.jpg';
    let el = $('#player');
    if (!el) el = document.createElement('div');
    el.id = 'player'; el.className = 'player';
    el.innerHTML = '<img src="' + img + '" alt=""><div class="pl-info"><b>' + esc(this.player.title) + '</b><span>' + esc(this.player.series) + '</span></div>'
      + '<div class="pl-mid"><div class="pl-ctrl"><button class="pl-btn" onclick="App.seek(-15)">⏪</button><button class="pl-btn main" id="ppBtn" onclick="App.togglePlay()">' + (this.audio && !this.audio.paused ? '⏸' : '▶') + '</button><button class="pl-btn" onclick="App.seek(15)">⏩</button></div>'
      + '<div class="pl-bar" onclick="App.seekTo(event)"><i id="plFill" style="width:0%"></i></div><div class="pl-time"><span id="plCur">0:00</span><span id="plDur">0:00</span></div></div>'
      + '<div class="pl-vol">🔊<input type="range" min="0" max="1" step="0.05" value="' + (this.audio ? this.audio.volume : 1) + '" oninput="if(App.audio)App.audio.volume=this.value" style="width:70px"></div>'
      + '<button class="icon-btn" style="border:none;background:transparent" onclick="App.closePlayer()">✕</button>';
    if (!el.parentNode) document.body.appendChild(el);
    this.updatePlayerBar();
    document.querySelector('.content') && (document.querySelector('.content').style.paddingBottom = '110px');
  },
  updatePlayerBar() {
    if (!this.audio || !$('#plFill')) return;
    const d = this.audio.duration || 0, c = this.audio.currentTime || 0;
    $('#plFill').style.width = (d ? (c / d) * 100 : 0) + '%';
    $('#plCur').textContent = mmss(c); $('#plDur').textContent = d ? mmss(d) : '0:00';
    const b = $('#ppBtn'); if (b) b.textContent = this.audio.paused ? '▶' : '⏸';
  },
  togglePlay() { if (!this.audio) return; if (this.audio.paused) this.audio.play(); else this.audio.pause(); this.updatePlayerBar(); },
  seek(s) { if (this.audio) this.audio.currentTime = Math.max(0, this.audio.currentTime + s); },
  seekTo(e) { if (!this.audio || !this.audio.duration) return; const r = e.currentTarget.getBoundingClientRect(); this.audio.currentTime = ((e.clientX - r.left) / r.width) * this.audio.duration; },
  closePlayer() { if (this.audio) this.audio.pause(); if ($('#player')) $('#player').remove(); this.player = null; },

  /* ---------- ENREGISTRÉS ---------- */
  vSaved() {
    const ids = Store.mode === 'supabase' ? [...Store.saved] : (DB.saved[me().id] || []);
    const posts = ids.map(id => this.postById(id)).filter(Boolean);
    return '<div class="section-head"><div><h3>Enregistrés</h3><p>' + posts.length + ' article(s) dans votre bibliothèque personnelle.</p></div></div>'
      + (posts.length ? '<div class="grid grid-3">' + posts.map(p => this.artCard(p)).join('') + '</div>'
        : this.empty('🔖', 'Votre bibliothèque est vide', 'Enregistrez des articles pour les retrouver ici — même hors connexion. Cliquez sur « Enregistrer » sur n’importe quel article.', 'Explorer les articles', "App.go('articles')"));
  },

  /* ---------- COLLECTIONS ---------- */
  async vCollections() {
    if (Store.mode === 'supabase') {
      let cols = [];
      try { cols = await Store.listCollections(); } catch (e) { toast('⚠️ ' + e.message); }
      this._cols = cols;
      if (this.collId) return this.renderCollectionDetail(cols.find(c => c.id === this.collId));
      return this.renderCollections(cols);
    }
    const u = me(), cols = DB.collections.filter(c => c.owner === u.id);
    if (this.collId) return this.vCollectionDetail();
    return this.renderCollections(cols);
  },
  renderCollections(cols) {
    return '<div class="section-head"><div><h3>Collections</h3><p>Organisez les articles d’Ingeta en parcours de lecture.</p></div><button class="btn btn-primary btn-sm" style="width:auto" onclick="App.openCollectionForm()">+ Nouvelle collection</button></div>'
      + (cols.length ? '<div class="grid grid-3">' + cols.map(c => {
        const ps = c.postIds.map(id => this.postById(id)).filter(Boolean);
        return '<div class="coll-card" style="cursor:pointer" onclick="App.openCollection(\'' + c.id + '\')">'
          + '<div class="coll-stack">' + (ps.slice(0, 2).map(p => p.image ? '<img src="' + esc(p.image) + '" alt="">' : '<div style="width:58%;border-radius:9px;background:var(--blue-l);display:grid;place-items:center;font-size:20px">✦</div>').join('') || '<div style="width:100%;border-radius:9px;background:var(--blue-l);display:grid;place-items:center;font-size:22px">🗂️</div>') + '</div>'
          + '<b style="font-family:var(--serif);font-size:16px;display:block;line-height:1.3">' + esc(c.name) + '</b>'
          + '<p style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(c.desc || '') + '</p>'
          + '<div class="meta" style="margin-top:9px"><span class="pill">' + ps.length + ' article(s)</span><button class="pill" style="margin-left:auto" onclick="event.stopPropagation();App.openCollectionForm(\'' + c.id + '\')">✏️</button><button class="pill" style="color:var(--red)" onclick="event.stopPropagation();App.deleteCollection(\'' + c.id + '\')">🗑</button></div></div>';
      }).join('') + '</div>'
        : this.empty('🗂️', 'Aucune collection', 'Créez des parcours de lecture : « Comprendre la guerre », « Réinventer le Congo », vos propres thèmes…', '+ Créer ma première collection', 'App.openCollectionForm()'));
  },
  openCollection(id) { this.collId = id; this.render(true); window.scrollTo({ top: 0 }); },
  async vCollectionDetail() {
    if (Store.mode === 'supabase') {
      const cols = this._cols || await Store.listCollections();
      return this.renderCollectionDetail(cols.find(c => c.id === this.collId));
    }
    return this.renderCollectionDetail(DB.collections.find(x => x.id === this.collId));
  },
  renderCollectionDetail(c) {
    if (!c) { this.collId = null; return this.vCollections(); }
    const posts = c.postIds.map(id => this.postById(id)).filter(Boolean);
    return '<button class="pill" onclick="App.collId=null;App.render()">← Toutes les collections</button>'
      + '<div class="section-head" style="margin-top:14px"><div><h3>' + esc(c.name) + '</h3><p>' + esc(c.desc || '') + '</p></div>'
      + '<div style="display:flex;gap:7px"><button class="btn btn-outline btn-sm" onclick="App.openCollectionForm(\'' + c.id + '\')">✏️ Modifier</button><button class="btn btn-primary btn-sm" style="width:auto" onclick="App.openAddToCollection(null,\'' + c.id + '\')">+ Ajouter des articles</button></div></div>'
      + (posts.length ? '<div class="grid grid-3">' + posts.map(p => this.artCard(p) + '<div style="margin-top:-12px;margin-bottom:14px;text-align:right"><button class="pill" style="color:var(--red)" onclick="event.stopPropagation();App.removeFromCollection(\'' + c.id + '\',' + p.id + ')">Retirer de la collection</button></div>').join('') + '</div>'
        : this.empty('📚', 'Collection vide', 'Ajoutez des articles d’Ingeta pour construire ce parcours de lecture.', '+ Ajouter des articles', 'App.openAddToCollection(null,\'' + c.id + '\')'));
  },
  openCollectionForm(id) {
    const c = id ? DB.collections.find(x => x.id === id) : null;
    modal((c ? '✏️ Modifier la collection' : '+ Nouvelle collection'),
      '<form onsubmit="return App.saveCollection(event,' + (c ? "'" + c.id + "'" : 'null') + ')">'
      + '<div class="field"><label>Nom de la collection</label><input id="cName" required value="' + esc(c ? c.name : '') + '" placeholder="Ex. Comprendre la guerre"></div>'
      + '<div class="field"><label>Description</label><textarea id="cDesc" placeholder="De quoi parle ce parcours de lecture ?">' + esc(c ? c.desc || '' : '') + '</textarea></div>'
      + '<div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button type="submit" class="btn btn-primary">' + (c ? 'Enregistrer' : 'Créer la collection') + '</button></div></form>');
  },
  async saveCollection(e, id) {
    e.preventDefault();
    const name = $('#cName').value.trim(), desc = $('#cDesc').value.trim();
    if (Store.mode === 'supabase') {
      try {
        if (id) { await Store.updateCollection(id, { name, description: desc }); toast('✓ Collection mise à jour'); }
        else { await Store.createCollection({ name, description: desc }); toast('🗂️ Collection créée'); }
      } catch (err) { toast('⚠️ ' + err.message); return false; }
      this.closeModal(); this.renderShell(); this.render(); return false;
    }
    const u = me();
    if (id) { const c = DB.collections.find(x => x.id === id); c.name = name; c.desc = desc; toast('✓ Collection mise à jour'); }
    else { DB.collections.unshift({ id: uid(), owner: u.id, name, desc, postIds: [], created: Date.now() }); toast('🗂️ Collection créée'); }
    saveDB(); this.closeModal(); this.renderShell(); this.render(); return false;
  },
  deleteCollection(id) {
    const c = DB.collections.find(x => x.id === id);
    modal('Supprimer la collection ?', '<p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:6px">« ' + esc(c.name) + ' » sera supprimée. Les articles restent disponibles dans la bibliothèque.</p>'
      + '<div class="modal-actions"><button class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button class="btn btn-danger" onclick="App.confirmDeleteCollection(\'' + id + '\')">Supprimer</button></div>');
  },
  async confirmDeleteCollection(id) {
    if (Store.mode === 'supabase') {
      try { await Store.deleteCollection(id); } catch (e) { toast('⚠️ ' + e.message); return; }
    } else { DB.collections = DB.collections.filter(c => c.id !== id); saveDB(); }
    if (this.collId === id) this.collId = null;
    this.closeModal(); this.renderShell(); this.render(); toast('🗑 Collection supprimée');
  },

  /* ---------- NOTES ---------- */
  async vNotes() {
    if (Store.mode === 'supabase') {
      let rows = [];
      try { rows = await Store.listNotes(); } catch (e) { toast('⚠️ ' + e.message); }
      this._notes = rows;
      return this.renderNotes(rows.map(n => ({
        id: n.id, title: n.title, text: n.body, postId: n.article_id ? Number(n.article_id) : null,
        created: n.created_at
      })));
    }
    const u = me(), notes = DB.notes.filter(n => n.owner === u.id).sort((a, b) => b.created - a.created);
    return this.renderNotes(notes);
  },
  renderNotes(notes) {
    return '<div class="section-head"><div><h3>Mes notes</h3><p>' + notes.length + ' note(s) personnelle(s) — vos idées, vos citations, vos questions.</p></div><button class="btn btn-primary btn-sm" style="width:auto" onclick="App.openNoteForm()">+ Nouvelle note</button></div>'
      + (notes.length ? '<div class="grid grid-2">' + notes.map(n => {
        const p = n.postId ? this.postById(n.postId) : null;
        return '<div class="note-card"><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:7px"><b style="font-family:var(--serif);font-size:15.5px">' + esc(n.title) + '</b><span style="font-size:10.5px;color:var(--muted);flex-shrink:0">' + fmtShort(n.created) + '</span></div>'
          + (p ? '<span class="src" onclick="App.openArticle(' + p.id + ')">↳ ' + esc(strip(p.title)) + '</span>' : '')
          + '<div class="nt">' + esc(n.text) + '</div><div class="actions"><button class="chip-btn" onclick="App.openNoteForm(\'' + n.id + '\')">✏️ Modifier</button><button class="chip-btn" style="color:var(--red)" onclick="App.deleteNote(\'' + n.id + '\')">🗑 Supprimer</button></div></div>';
      }).join('') + '</div>'
        : this.empty('📝', 'Aucune note', 'Prenez des notes pendant vos lectures : idées clés, citations, questions à creuser. Vos notes restent privées.', '+ Créer ma première note', 'App.openNoteForm()'));
  },
  openNoteForm(id, postId) {
    const n = id ? DB.notes.find(x => x.id === id) : null;
    const p = postId ? this.postById(postId) : (n && n.postId ? this.postById(n.postId) : null);
    modal((n ? '✏️ Modifier la note' : '+ Nouvelle note'),
      (p ? '<div style="background:var(--blue-xl);border-radius:9px;padding:9px 12px;font-size:12px;color:var(--ink2);margin-bottom:13px">↳ Sur : <b>' + esc(strip(p.title)) + '</b></div>' : '')
      + '<form onsubmit="return App.saveNote(event,' + (n ? "'" + n.id + "'" : 'null') + ',' + (p ? p.id : 'null') + ')">'
      + '<div class="field"><label>Titre</label><input id="nTitle" required value="' + esc(n ? n.title : '') + '" placeholder="Ex. Idée forte à retenir"></div>'
      + '<div class="field"><label>Votre note</label><textarea id="nText" required style="min-height:130px" placeholder="Écrivez librement…">' + esc(n ? n.text : '') + '</textarea></div>'
      + '<div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button type="submit" class="btn btn-primary">' + (n ? 'Enregistrer' : 'Créer la note') + '</button></div></form>');
  },
  async saveNote(e, id, postId) {
    e.preventDefault();
    const title = $('#nTitle').value.trim(), text = $('#nText').value.trim();
    if (Store.mode === 'supabase') {
      try {
        if (id) { await Store.updateNote(id, { title, body: text }); toast('✓ Note mise à jour'); }
        else { await Store.createNote({ title, body: text, articleId: postId }); toast('📝 Note créée'); }
      } catch (err) { toast('⚠️ ' + err.message); return false; }
      this.closeModal(); this.renderShell(); this.render(); return false;
    }
    const u = me();
    if (id) { const n = DB.notes.find(x => x.id === id); n.title = title; n.text = text; toast('✓ Note mise à jour'); }
    else { DB.notes.unshift({ id: uid(), owner: u.id, postId, title, text, created: Date.now() }); toast('📝 Note créée'); }
    saveDB(); this.closeModal(); this.renderShell(); this.render(); return false;
  },
  async deleteNote(id) {
    if (Store.mode === 'supabase') {
      try { await Store.deleteNote(id); } catch (e) { toast('⚠️ ' + e.message); return; }
    } else { DB.notes = DB.notes.filter(n => n.id !== id); saveDB(); }
    this.renderShell(); this.render(); toast('🗑 Note supprimée');
  },

  /* ---------- DISCUSSIONS ---------- */
  async vDiscussions() {
    if (Store.mode === 'supabase') {
      let rows = [];
      try { rows = await Store.listDiscussions(); } catch (e) { toast('⚠️ ' + e.message); }
      this._discs = rows;
      return this.renderDiscussions(rows.map(d => ({
        id: d.id, owner: d.user_id, ownerName: d.author_name, title: d.title, body: d.body,
        date: d.created_at,
        comments: d.comments.map(c => ({ id: c.id, owner: c.user_id, ownerName: c.author_name,
                                          text: c.body, date: c.created_at }))
      })));
    }
    const discs = [...DB.discussions].sort((a, b) => b.date - a.date);
    return this.renderDiscussions(discs.map(d => ({
      ...d, ownerName: (DB.users.find(u => u.id === d.owner) || {}).name,
      comments: (d.comments || []).map(cm => ({ ...cm, ownerName: (DB.users.find(u => u.id === cm.owner) || {}).name }))
    })));
  },
  renderDiscussions(discs) {
    return '<div class="section-head"><div><h3>Discussions</h3><p>Débattre des idées d’Ingeta avec la communauté, partout dans le monde.'
      + (Store.mode === 'supabase' ? ' <span class="pill" style="background:rgba(34,197,94,.14);color:#15803d;border-color:#bbf7d0">● temps réel</span>' : '')
      + '</p></div><button class="btn btn-primary btn-sm" style="width:auto" onclick="App.openDiscussionForm()">+ Nouvelle discussion</button></div>'
      + (discs.length ? discs.map(d => {
        const owner = { name: d.ownerName || 'Membre' };
        const nb = (d.comments || []).length;
        return '<div class="disc"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div style="flex:1"><h4 onclick="App.openDiscussion(\'' + d.id + '\')" style="cursor:pointer">' + esc(d.title) + '</h4><p>' + esc(d.body) + '</p></div></div>'
          + '<div class="meta" style="margin-top:9px"><span class="av" style="background:var(--blue)">' + esc(initials(owner ? owner.name : '?')) + '</span><span>' + esc(owner ? owner.name : 'Membre') + '</span><span>·</span><span>' + fmtShort(d.date) + '</span><span>·</span><span>💬 ' + nb + ' réponse(s)</span></div>'
          + (nb ? '<div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--line)">' + d.comments.slice(-2).map(c => { const co = { name: c.ownerName || 'Membre' }; return '<div class="msg"><div class="m-av">' + esc(initials(co.name)) + '</div><div><b>' + esc(co.name) + '</b> <span class="t">' + fmtShort(c.date) + '</span><p>' + esc(c.text) + '</p></div></div>'; }).join('') + '</div>' : '')
          + '<form onsubmit="return App.addComment(event,\'' + d.id + '\')" style="display:flex;gap:7px;margin-top:10px"><input placeholder="Répondre…" style="flex:1;padding:9px 12px;border-radius:9px;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);font-size:13px;outline:none"><button class="btn btn-primary btn-sm" style="width:auto" type="submit">Envoyer</button></form>'
          + (me().role === 'admin' || d.owner === me().id ? '<div class="actions" style="margin-top:8px"><button class="chip-btn" onclick="App.openDiscussionForm(\'' + d.id + '\')">✏️ Modifier</button><button class="chip-btn" style="color:var(--red)" onclick="App.deleteDiscussion(\'' + d.id + '\')">🗑 Supprimer</button></div>' : '')
          + '</div>';
      }).join('')
        : this.empty('💬', 'Aucune discussion', 'Lancez le premier débat : une question, une intuition, une lecture à partager avec la communauté Ingeta.', '+ Lancer une discussion', 'App.openDiscussionForm()'));
  },
  openDiscussion(id) { this.go('discussions'); },
  openDiscussionForm(id) {
    const d = id ? DB.discussions.find(x => x.id === id) : null;
    modal((d ? '✏️ Modifier la discussion' : '+ Nouvelle discussion'),
      '<form onsubmit="return App.saveDiscussion(event,' + (d ? "'" + d.id + "'" : 'null') + ')">'
      + '<div class="field"><label>Titre</label><input id="dTitle" required value="' + esc(d ? d.title : '') + '" placeholder="Ex. Que retenir de l’étrange guerre ?"></div>'
      + '<div class="field"><label>Votre message</label><textarea id="dBody" required placeholder="Développez votre idée…">' + esc(d ? d.body : '') + '</textarea></div>'
      + '<div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button type="submit" class="btn btn-primary">' + (d ? 'Enregistrer' : 'Publier') + '</button></div></form>');
  },
  async saveDiscussion(e, id) {
    e.preventDefault();
    const title = $('#dTitle').value.trim(), body = $('#dBody').value.trim();
    if (Store.mode === 'supabase') {
      try {
        if (id) { await Store.updateDiscussion(id, { title, body }); toast('✓ Discussion mise à jour'); }
        else { await Store.createDiscussion({ title, body }); toast('💬 Discussion publiée'); }
      } catch (err) { toast('⚠️ ' + err.message); return false; }
      this.closeModal(); this.renderShell(); this.render(); return false;
    }
    if (id) { const d = DB.discussions.find(x => x.id === id); d.title = title; d.body = body; toast('✓ Discussion mise à jour'); }
    else { DB.discussions.unshift({ id: uid(), owner: me().id, title, body, comments: [], date: Date.now() }); toast('💬 Discussion publiée'); }
    saveDB(); this.closeModal(); this.renderShell(); this.render(); return false;
  },
  async deleteDiscussion(id) {
    if (Store.mode === 'supabase') {
      try { await Store.deleteDiscussion(id); } catch (e) { toast('⚠️ ' + e.message); return; }
    } else { DB.discussions = DB.discussions.filter(d => d.id !== id); saveDB(); }
    this.renderShell(); this.render(); toast('🗑 Discussion supprimée');
  },
  async addComment(e, id) {
    e.preventDefault();
    const input = e.target.querySelector('input'); const text = input.value.trim(); if (!text) return false;
    if (Store.mode === 'supabase') {
      try { await Store.addComment(id, text); } catch (err) { toast('⚠️ ' + err.message); return false; }
      input.value = ''; this.render(); toast('💬 Réponse publiée'); return false;
    }
    const d = DB.discussions.find(x => x.id === id);
    d.comments.push({ id: uid(), owner: me().id, text, date: Date.now() });
    saveDB(); this.render(); toast('💬 Réponse publiée'); return false;
  },

  /* ---------- ÉVÉNEMENTS ---------- */
  async vEvents() {
    if (Store.mode === 'supabase') {
      let rows = [];
      try { rows = await Store.listEvents(); } catch (e) { toast('⚠️ ' + e.message); }
      this._events = rows;
      return this.renderEvents(rows, true);
    }
    const u = me(), evts = [...DB.events].sort((a, b) => new Date(a.date) - new Date(b.date));
    return this.renderEvents(evts, false);
  },
  renderEvents(evts, isSupabase) {
    return '<div class="section-head"><div><h3>Événements</h3><p>Rencontres, cercles de lecture et débats Ingeta — en ligne et sur place.</p></div><button class="btn btn-primary btn-sm" style="width:auto" onclick="App.openEventForm()">+ Nouvel événement</button></div>'
      + (evts.length ? evts.map(e2 => {
        const going = isSupabase ? !!e2.going : (DB.rsvped[me().id] || []).includes(e2.id);
        const d = new Date(e2.date);
        return '<div class="disc" style="display:flex;gap:14px;flex-wrap:wrap"><div class="cal"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('fr-FR', { month: 'short' }) + '</span></div>'
          + '<div style="flex:1;min-width:200px"><h4>' + esc(e2.title) + '</h4><p>' + esc(e2.desc) + '</p><div class="meta" style="margin-top:7px"><span>🕐 ' + esc(e2.time) + '</span><span>·</span><span>📍 ' + esc(e2.place) + '</span><span>·</span><span>' + (e2.rsvps + (going ? 1 : 0)) + ' participant(s)</span></div></div>'
          + '<div style="display:flex;flex-direction:column;gap:6px"><button class="chip-btn ' + (going ? 'on-gold' : '') + '" onclick="App.toggleRsvp(\'' + e2.id + '\')">' + (going ? '✓ Je participe' : 'Je participe') + '</button>'
          + '<div class="actions" style="margin:0"><button class="chip-btn" onclick="App.openEventForm(\'' + e2.id + '\')">✏️</button><button class="chip-btn" style="color:var(--red)" onclick="App.deleteEvent(\'' + e2.id + '\')">🗑</button></div></div></div>';
      }).join('')
        : this.empty('📅', 'Aucun événement', 'Créez votre premier événement : un cercle de lecture, une rencontre avec un auteur, un débat en ligne.', '+ Créer un événement', 'App.openEventForm()'));
  },
  async toggleRsvp(id) {
    if (Store.mode === 'supabase') {
      const ev = (this._events || []).find(x => x.id === id);
      const on = !(ev && ev.going);
      try { await Store.toggleRsvp(id, on); }
      catch (e) { toast('⚠️ ' + e.message); return; }
      toast(on ? '✓ Votre place est réservée' : 'Inscription annulée');
      this.render(); return;
    }
    const u = me(); DB.rsvped[u.id] = DB.rsvped[u.id] || []; const i = DB.rsvped[u.id].indexOf(id);
    if (i >= 0) { DB.rsvped[u.id].splice(i, 1); toast('Inscription annulée'); } else { DB.rsvped[u.id].push(id); toast('✓ Votre place est réservée'); }
    saveDB(); this.render();
  },
  openEventForm(id) {
    const e2 = id ? DB.events.find(x => x.id === id) : null;
    modal((e2 ? '✏️ Modifier l’événement' : '+ Nouvel événement'),
      '<form onsubmit="return App.saveEvent(event,' + (e2 ? "'" + e2.id + "'" : 'null') + ')">'
      + '<div class="field"><label>Titre</label><input id="eTitle" required value="' + esc(e2 ? e2.title : '') + '" placeholder="Ex. Cercle de lecture — L’Étrange guerre"></div>'
      + '<div class="field"><label>Description</label><textarea id="eDesc" placeholder="Programme, intervenants…">' + esc(e2 ? e2.desc : '') + '</textarea></div>'
      + '<div class="grid grid-2" style="gap:10px"><div class="field"><label>Date</label><input id="eDate" type="date" required value="' + (e2 ? e2.date : '') + '"></div>'
      + '<div class="field"><label>Heure</label><input id="eTime" required value="' + esc(e2 ? e2.time : '18:00') + '" placeholder="18:00 (Paris)"></div></div>'
      + '<div class="field"><label>Lieu</label><input id="ePlace" required value="' + esc(e2 ? e2.place : '') + '" placeholder="En ligne · Zoom"></div>'
      + '<div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button type="submit" class="btn btn-primary">' + (e2 ? 'Enregistrer' : 'Créer') + '</button></div></form>');
  },
  async saveEvent(e, id) {
    e.preventDefault();
    const o = { title: $('#eTitle').value.trim(), desc: $('#eDesc').value.trim(),
                date: $('#eDate').value, time: $('#eTime').value.trim(), place: $('#ePlace').value.trim() };
    if (Store.mode === 'supabase') {
      try {
        if (id) { await Store.updateEvent(id, o); toast('✓ Événement mis à jour'); }
        else { await Store.createEvent(o); toast('📅 Événement créé'); }
      } catch (err) { toast('⚠️ ' + err.message); return false; }
      this.closeModal(); this.render(); return false;
    }
    if (id) { Object.assign(DB.events.find(x => x.id === id), o); toast('✓ Événement mis à jour'); }
    else { DB.events.unshift({ id: uid(), ...o, rsvps: 0 }); toast('📅 Événement créé'); }
    saveDB(); this.closeModal(); this.render(); return false;
  },
  async deleteEvent(id) {
    if (Store.mode === 'supabase') {
      try { await Store.deleteEvent(id); } catch (e) { toast('⚠️ ' + e.message); return; }
    } else { DB.events = DB.events.filter(e => e.id !== id); saveDB(); }
    this.render(); toast('🗑 Événement supprimé');
  },

  /* ---------- LECTEUR D'ARTICLE ---------- */
  async openArticle(id, refreshOnly) {
    const p = this.postById(id); if (!p) { toast('⚠️ Article indisponible'); return; }
    const saved = this.isSaved(id), liked = this.isLiked(id);
    const cats = catsOf(p);
    if (!refreshOnly) {
      this.readerPost = p;
      document.documentElement.style.overflow = 'hidden';
      $('#readerRoot').classList.remove('hidden');
      $('#readerRoot').innerHTML = '<div class="reader"><div class="reader-bar"><button class="pill" onclick="App.closeReader()">← Retour</button><div style="flex:1;min-width:0"><div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.05em;text-transform:uppercase">Ingeta · ' + esc(cats[0]) + '</div><div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(strip(p.title)) + '</div></div><div class="reader-progress" id="rdProg" style="width:0%"></div></div>'
        + '<div class="reader-inner"><div class="reader-cover">' + this.coverImg(p) + '<div class="ov"></div><div class="in"><span class="free-tag" style="position:static;display:inline-block">ACCÈS LIBRE · GRATUIT</span><h1>' + esc(strip(p.title)) + '</h1></div></div>'
        + '<div class="reader-meta"><span class="av" style="background:var(--blue);width:31px;height:31px">' + esc(initials(p.authorName)) + '</span><b style="color:var(--ink)">' + esc(p.authorName) + '</b><span>·</span><span>' + fmtDate(p.date) + '</span><span>·</span><span>⏱ ' + readMin(p) + ' min</span>' + cats.slice(1).map(c => '<span class="pill" style="font-size:10.5px">' + esc(c) + '</span>').join('') + '</div>'
        + '<div class="reader-share"><button class="chip-btn ' + (liked ? 'on' : '') + '" onclick="App.toggleLike(' + id + ')">♥ Aimer</button>'
        + '<button class="chip-btn ' + (saved ? 'on-gold' : '') + '" onclick="App.toggleSave(' + id + ')">' + (saved ? '🔖 Enregistré' : '🔖 Enregistrer') + '</button>'
        + '<button class="chip-btn" onclick="App.openNoteForm(null,' + id + ')">📝 Prendre une note</button>'
        + '<button class="chip-btn" onclick="App.openAddToCollection(' + id + ')">🗂️ Collection</button>'
        + '<button class="chip-btn" onclick="App.shareArticle(' + id + ')">↗ Partager</button></div>'
        + '<div class="reader-body" id="rdBody">' + (refreshOnly ? '' : '<p style="font-family:var(--serif);font-size:18.5px;line-height:1.7;color:var(--ink)">' + esc(strip(p.excerpt)) + '</p><div style="display:flex;gap:8px;align-items:center;color:var(--muted);font-size:12.5px;margin:18px 0"><span class="skeleton" style="width:15px;height:15px;border-radius:50%"></span>Chargement du texte intégral…</div>') + '</div>'
        + '<div class="src-note">ℹ️ <div>Article publié sur <a href="' + esc(p.link) + '" target="_blank" rel="noopener">ingeta.com</a> le ' + fmtDate(p.date) + '. Contenu authentique reproduit pour cette application de démonstration.<br><a href="' + esc(p.link) + '" target="_blank" rel="noopener">Lire la version originale ↗</a></div></div>'
        + '</div></div>';
    } else {
      // rafraîchir la barre d'actions sans recharger le contenu
      $$('#readerRoot .reader-share .chip-btn').forEach((b, i) => {
        if (i === 0) { b.classList.toggle('on', liked); }
        if (i === 1) { b.classList.toggle('on-gold', saved); b.textContent = saved ? '🔖 Enregistré' : '🔖 Enregistrer'; }
      });
      return;
    }
    // progression de lecture liée au scroll
    const rd = $('#readerRoot .reader'), bar = $('#rdProg');
    rd.onscroll = () => {
      const pct = Math.min(99, Math.round((rd.scrollTop / Math.max(1, rd.scrollHeight - rd.clientHeight)) * 100));
      bar.style.width = pct + '%';
      if (Store.mode === 'supabase') {
        if (pct > (Store.progress[id] || 0)) {
          clearTimeout(this._pgT);
          this._pgT = setTimeout(() => Store.saveProgress(id, pct), 900);
        }
        return;
      }
      DB.progress[u.id] = DB.progress[u.id] || {};
      if (pct > (DB.progress[u.id][id] || 0)) { DB.progress[u.id][id] = pct; clearTimeout(this._pgT); this._pgT = setTimeout(saveDB, 600); }
    };
    // contenu complet : chargé à la demande depuis le fichier de 22 Mo
    const fallback = '<p>' + esc(strip(p.excerpt)) + '</p><p><a href="' + esc(p.link) + '" target="_blank" rel="noopener">Lire l’article complet sur ingeta.com →</a></p>';
    try {
      let full = null;
      if (Store.mode === 'supabase') {
        const row = await Store.getArticle(id);
        full = row && row.content;
      } else {
        full = await fetchFullArticle(id);
      }
      if (this.readerPost && this.readerPost.id === id) $('#rdBody').innerHTML = full ? sanitize(full) : fallback;
    } catch (e) {
      if (this.readerPost && this.readerPost.id === id) $('#rdBody').innerHTML = fallback;
    }
  },
  closeReader() {
    this.readerPost = null; $('#readerRoot').classList.add('hidden'); $('#readerRoot').innerHTML = '';
    document.documentElement.style.overflow = '';
    this.renderShell(); this.render();
  },
  shareArticle(id) {
    const p = this.postById(id);
    const url = p.link;
    if (navigator.share) navigator.share({ title: strip(p.title), url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Lien copié dans le presse-papiers'));
    else toast('🔗 ' + url);
  },

  /* ---------- AJOUTER À UNE COLLECTION ---------- */
  openAddToCollection(postId, collId) {
    const u = me(), cols = DB.collections.filter(c => c.owner === u.id);
    if (!cols.length) {
      modal('Aucune collection', '<p style="font-size:14px;color:var(--muted);line-height:1.6">Créez d’abord une collection pour y ranger cet article.</p><div class="modal-actions"><button class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button class="btn btn-primary" onclick="App.closeModal();App.openCollectionForm()">+ Créer une collection</button></div>');
      return;
    }
    modal(collId ? '+ Ajouter des articles' : '🗂️ Ajouter à une collection',
      (collId ? '' : '') + '<form onsubmit="return App.addToCollection(event,' + (postId || 'null') + ',' + (collId ? "'" + collId + "'" : 'null') + ')">'
      + (postId ? '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Article : <b style="color:var(--ink)">' + esc(strip(this.postById(postId).title)) + '</b></p>' : '')
      + '<div class="field"><label>Collection</label><select id="acColl">' + cols.map(c => '<option value="' + c.id + '" ' + (collId === c.id ? 'selected' : '') + '>' + esc(c.name) + ' (' + c.postIds.length + ')</option>').join('') + '</select></div>'
      + (postId ? '' : '<div class="field"><label>Articles à ajouter</label><div style="max-height:260px;overflow:auto;border:1.5px solid var(--line);border-radius:10px;padding:6px">' + DATA.posts.slice(0, 60).map(p => '<label style="display:flex;gap:9px;align-items:flex-start;padding:7px;border-radius:7px;font-size:12.5px;line-height:1.4;cursor:pointer"><input type="checkbox" name="pc" value="' + p.id + '" style="margin-top:3px;flex-shrink:0">' + esc(strip(p.title)) + '</label>').join('') + '</div><p style="font-size:11px;color:var(--muted);margin-top:6px">60 articles les plus récents affichés — utilisez la recherche pour les autres.</p></div>')
      + '<div class="modal-actions"><button type="button" class="btn btn-outline" onclick="App.closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Ajouter</button></div></form>');
  },
  async addToCollection(e, postId, collId) {
    e.preventDefault();
    const cid = collId || $('#acColl').value;
    if (Store.mode === 'supabase') {
      const ids = postId ? [postId] : [...e.target.querySelectorAll('input[name=pc]:checked')].map(i => Number(i.value));
      try { await Store.addToCollection(cid, ids); }
      catch (err) { toast('⚠️ ' + err.message); return false; }
      this.closeModal(); this.renderShell(); this.render();
      toast('🗂️ ' + ids.length + ' article(s) ajouté(s)');
      return false;
    }
    const c = DB.collections.find(x => x.id === cid); if (!c) return false;
    if (postId) { if (!c.postIds.includes(postId)) c.postIds.push(postId); toast('🗂️ Ajouté à « ' + c.name + ' »'); }
    else {
      const ids = [...e.target.querySelectorAll('input[name=pc]:checked')].map(i => Number(i.value));
      ids.forEach(id => { if (!c.postIds.includes(id)) c.postIds.push(id); });
      toast('🗂️ ' + ids.length + ' article(s) ajouté(s)');
    }
    saveDB(); this.closeModal(); this.render(); return false;
  },
  async removeFromCollection(cid, postId) {
    if (Store.mode === 'supabase') {
      try { await Store.removeFromCollection(cid, postId); } catch (e) { toast('⚠️ ' + e.message); return; }
      this.render(); toast('Retiré de la collection'); return;
    }
    const c = DB.collections.find(x => x.id === cid); c.postIds = c.postIds.filter(id => id !== postId);
    saveDB(); this.render(); toast('Retiré de la collection');
  },

  /* ---------- ADMIN ---------- */
  async vAdmin() {
    const u = me();
    const hint = Store.mode === 'supabase'
      ? 'Cet espace est réservé aux administrateurs. Accordez-vous le rôle admin dans Supabase (voir README, section « Devenir administrateur »).'
      : 'Cet espace est destiné aux administrateurs. Connectez-vous avec admin@ingeta.com / admin1234.';
    if (u.role !== 'admin') return this.empty('🔒', 'Accès réservé', hint, 'Se déconnecter', 'App.logout()');
    if (Store.mode === 'supabase') {
      let c = { articles: SB_TOTAL, notes: 0, collections: 0 };
      try { c = await Store.dashboardCounts(); } catch (e) {}
      const recentSb = DATA.posts.slice(0, 40);
      return this.renderAdmin(recentSb, c.articles, c);
    }
    const recent = [...DATA.posts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
    return this.renderAdmin(recent, DATA.posts.length, { notes: 0, collections: 0 });
  },
  renderAdmin(recent, totalArticles, counts) {
    return '<div class="section-head"><div><h3>Gestion du contenu</h3><p>Contenus synchronisés depuis ingeta.com' + (DATA.synced ? ' le ' + fmtDate(DATA.synced) : '') + '.</p></div>'
      + '<button class="btn btn-primary btn-sm" style="width:auto" onclick="App.syncNotice()">🔄 Resynchroniser</button></div>'
      + '<div class="stat-grid"><div class="stat"><div class="num">' + totalArticles.toLocaleString('fr-FR') + '</div><div class="lbl">Articles</div></div>'
      + '<div class="stat"><div class="num">' + DATA.categories.length + '</div><div class="lbl">Thématiques</div></div>'
      + '<div class="stat"><div class="num">' + PODS.length + '</div><div class="lbl">Épisodes</div></div>'
      + '<div class="stat"><div class="num">' + (Store.mode === 'supabase' ? (counts.notes || 0) + (counts.collections || 0) : DB.users.length) + '</div><div class="lbl">' + (Store.mode === 'supabase' ? 'Éléments personnels' : 'Membres') + '</div></div></div>'
      + '<div class="panel" style="margin-bottom:16px"><h4>Source des contenus</h4><p style="font-size:13px;color:var(--muted);line-height:1.7">Les articles et podcasts proviennent de l’API publique WordPress d’<a href="https://www.ingeta.com" target="_blank" rel="noopener">ingeta.com</a> (wp-json). Logo, polices (Hind Siliguri, Poppins, Playfair Display) et palette (#0080FF, #D0021B, #FAB901, #740D11) sont ceux du site officiel.<br><br>'
      + (Store.mode === 'supabase'
          ? '<b style="color:var(--ink)">Base de données :</b> Supabase (PostgreSQL). Articles, thématiques, podcasts, membres et bibliothèques personnelles sont stockés côté serveur et synchronisés entre appareils. Sécurité par Row Level Security.'
          : '<b style="color:var(--ink)">Mode local :</b> les contenus éditoriaux sont des fichiers statiques ; les données personnelles restent dans ce navigateur. Renseignez <code>config.js</code> pour activer la synchronisation Supabase.')
      + '</p></div>'
      + '<div class="table-wrap"><table class="table"><thead><tr><th>Titre</th><th>Thématiques</th><th>Date</th><th>Actions</th></tr></thead><tbody>'
      + recent.map(p => '<tr><td><b style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:420px">' + esc(strip(p.title)) + '</b></td><td style="font-size:11.5px;color:var(--muted)">' + esc(catsOf(p)[0]) + '</td><td style="white-space:nowrap;font-size:12px">' + fmtShort(p.date) + '</td><td style="white-space:nowrap"><button class="pill" onclick="App.openArticle(' + p.id + ')">👁</button> <a class="pill" href="' + esc(p.link) + '" target="_blank" rel="noopener">↗</a></td></tr>').join('')
      + '</tbody></table></div><p style="font-size:12px;color:var(--muted)">Les 40 publications les plus récentes. Les ' + (DATA.posts.length - recent.length).toLocaleString('fr-FR') + ' autres sont accessibles depuis la bibliothèque.</p>';
  },
  syncNotice() { toast('🔄 Les contenus sont déjà synchronisés depuis ingeta.com'); },

  /* ---------- PARAMÈTRES ---------- */
  vSettings() {
    const u = me();
    return '<div class="section-head"><div><h3>Paramètres</h3><p>Votre profil, votre région et vos préférences.</p></div></div>'
      + '<div class="grid grid-2"><div class="card" style="padding:22px;cursor:default"><h4 style="font-family:var(--serif);font-size:19px;margin-bottom:15px">👤 Profil</h4>'
      + '<div style="display:flex;gap:13px;align-items:center;margin-bottom:16px"><div class="avatar" style="width:56px;height:56px;font-size:19px">' + esc(initials(u.name)) + '</div><div><b style="font-size:16px">' + esc(u.name) + '</b><div style="color:var(--muted);font-size:12.5px">' + esc(u.email) + ' · Membre depuis ' + fmtShort(u.created) + '</div><span class="pill" style="margin-top:5px;font-size:10.5px">✦ Compte gratuit à vie</span></div></div>'
      + '<form onsubmit="return App.saveProfile(event)"><div class="field"><label>Nom complet</label><input id="pName" value="' + esc(u.name) + '" required></div>'
      + '<div class="field"><label>Région</label><select id="pRegion">' + ['Afrique', 'Europe', 'Amériques', 'Asie'].map(r => '<option ' + (u.region === r ? 'selected' : '') + '>' + r + '</option>').join('') + '</select></div>'
      + '<button class="btn btn-primary" type="submit">Enregistrer</button></form>'
      + '<button class="btn btn-danger" style="width:100%;margin-top:9px" onclick="App.logout()">⏻ Se déconnecter</button></div>'
      + '<div><div class="card" style="padding:22px;margin-bottom:14px;cursor:default"><h4 style="font-family:var(--serif);font-size:19px;margin-bottom:12px">🌍 Votre région</h4><div class="region-grid">'
      + [['Afrique', '🌍', 'Kinshasa, Dakar…'], ['Europe', '🏰', 'Paris, Bruxelles…'], ['Amériques', '🗽', 'Montréal, New York…'], ['Asie', '🌏', 'Tokyo, Pékin…']].map(r => '<div class="region ' + (u.region === r[0] ? 'active' : '') + '" onclick="App.setRegion(\'' + r[0] + '\')"><div class="r-ico">' + r[1] + '</div><b>' + r[0] + '</b><span>' + r[2] + '</span></div>').join('')
      + '</div><p style="color:var(--muted);font-size:12px;margin-top:10px;line-height:1.5">Horaires des événements et suggestions adaptés à votre région.</p></div>'
      + '<div class="card" style="padding:22px;cursor:default"><h4 style="font-family:var(--serif);font-size:19px;margin-bottom:12px">🔔 Préférences</h4>'
      + [['Mode sombre', 'Interface sombre pour lire la nuit', this.dark, 'toggleDark'], ['Notifications', 'Nouveaux articles et podcasts', true, ''], ['Lecture automatique', 'Enchaîner les podcasts', false, '']].map(p => '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)"><div style="flex:1"><b style="font-size:13.5px">' + p[0] + '</b><div style="color:var(--muted);font-size:12px">' + p[1] + '</div></div><button class="toggle ' + (p[2] ? 'on' : '') + '" onclick="' + (p[3] ? 'App.' + p[3] + '()' : 'App.togglePref(this)') + '"></button></div>').join('')
      + '</div></div></div>'
      + installCard() + '<div class="card" style="padding:22px;margin-top:14px;cursor:default"><h4 style="font-family:var(--serif);font-size:19px;margin-bottom:9px">✦ À propos de cette application</h4><p style="color:var(--muted);line-height:1.7;font-size:13.5px">Application non officielle construite autour des contenus publics d’<a href="https://www.ingeta.com" target="_blank" rel="noopener">ingeta.com</a> — « Idées & ressources pour réinventer le Congo ». ' + DATA.posts.length.toLocaleString('fr-FR') + ' articles et ' + PODS.length + ' épisodes synchronisés. Logo, couleurs et typographies appartiennent à Ingeta. Aucun paywall : le savoir qui libère un peuple ne se vend pas.</p></div>';
  },
  togglePref(el) { el.classList.toggle('on'); toast('✓ Préférence enregistrée'); },

  /* Installation sur l'écran d'accueil, avec instructions adaptées au navigateur. */
  async installApp() {
    if (_installPrompt) {
      _installPrompt.prompt();
      const res = await _installPrompt.userChoice;
      if (res && res.outcome === 'accepted') toast('✓ Installation lancée');
      _installPrompt = null; this._installable = false;
      this.render(); return;
    }
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const firefox = /Firefox|FxiOS/i.test(ua);
    let txt;
    if (iOS) {
      txt = '<b>Sur iPhone / iPad (Safari)</b><p style="color:var(--muted);font-size:13px;line-height:1.7;margin-top:7px">'
        + '1. Touchez le bouton <b>Partager</b> (carré avec une flèche).<br>'
        + '2. Faites défiler et choisissez <b>« Sur l’écran d’accueil »</b>.<br>'
        + '3. Validez avec <b>Ajouter</b>. L’icône Ingeta apparaît comme une application.</p>';
    } else if (firefox) {
      txt = '<b>Sur Firefox Android</b><p style="color:var(--muted);font-size:13px;line-height:1.7;margin-top:7px">'
        + 'Menu <b>⋮</b> → <b>« Installer »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</p>';
    } else {
      txt = '<b>Depuis Chrome ou Edge</b><p style="color:var(--muted);font-size:13px;line-height:1.7;margin-top:7px">'
        + 'Menu <b>⋮</b> → <b>« Installer l’application »</b>, ou l’icône d’installation dans la barre d’adresse.<br>'
        + 'Sur ordinateur, la même entrée figure dans le menu du navigateur.</p>';
    }
    modal('📲 Installer Ingeta', txt
      + '<p style="color:var(--muted);font-size:12.5px;margin-top:12px;line-height:1.6;border-top:1px solid var(--line);padding-top:11px">'
      + 'Une fois installée, l’application s’ouvre en plein écran, sans barre d’adresse, et les articles déjà lus restent accessibles hors connexion.</p>'
      + '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="App.closeModal()">J’ai compris</button>');
  },

  /* Diagnostic affiché dans Paramètres : utile pour vérifier un téléphone. */
  installStatus() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone) return { label: 'Installée — mode application', ok: true };
    if (this._installable) return { label: 'Prête à installer', ok: true };
    return { label: 'Navigateur (non installée)', ok: false };
  },
  async setRegion(r) {
    if (Store.mode === 'supabase') {
      try { await Store.updateProfile({ region: r }); } catch (e) { toast('⚠️ ' + e.message); return; }
    } else { const u = me(); u.region = r; saveDB(); }
    this.renderShell(); this.render(); toast('🌍 Région : ' + r);
  },
  async saveProfile(e) {
    e.preventDefault();
    const name = $('#pName').value.trim(), region = $('#pRegion').value;
    if (Store.mode === 'supabase') {
      try { await Store.updateProfile({ fullName: name, region }); }
      catch (err) { toast('⚠️ ' + err.message); return false; }
    } else {
      const u = me(); u.name = name || u.name; u.region = region; saveDB();
    }
    this.renderShell(); this.render(); toast('✓ Profil mis à jour'); return false;
  },

  /* ---------- MODAL & TOAST ---------- */
  closeModal() { if ($('#modalRoot')) $('#modalRoot').innerHTML = ''; }
};

/* ---------- MODAL / TOAST ---------- */
function modal(title, body) {
  let r = $('#modalRoot'); if (!r) { r = document.createElement('div'); r.id = 'modalRoot'; document.body.appendChild(r); }
  r.innerHTML = '<div class="modal-bg" onclick="if(event.target===this)App.closeModal()"><div class="modal" role="dialog" aria-modal="true"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><h3>' + title + '</h3><button class="icon-btn" style="width:31px;height:31px;border:none;background:var(--cream);font-size:13px" onclick="App.closeModal()">✕</button></div>' + body + '</div></div>';
}
/* Carte d'installation affichée dans Paramètres (PWA). */
function installCard() {
  const st = App.installStatus();
  const badge = st.ok
    ? '<span class="pill" style="background:#e6f7ee;color:#0a7a48;font-size:10.5px">✓ ' + st.label + '</span>'
    : '<span class="pill" style="font-size:10.5px">' + st.label + '</span>';
  return '<div class="card" style="padding:22px;margin-top:14px;cursor:default">'
    + '<h4 style="font-family:var(--serif);font-size:19px;margin-bottom:9px">📲 Application mobile ' + badge + '</h4>'
    + '<p style="color:var(--muted);line-height:1.7;font-size:13.5px;margin-bottom:13px">'
    + 'Ingeta s’installe comme une application : icône sur l’écran d’accueil, ouverture en plein écran, '
    + 'et lecture hors connexion des articles déjà consultés. Aucun store, aucune mise à jour à télécharger.</p>'
    + '<button class="btn btn-primary" onclick="App.installApp()">📲 Installer sur cet appareil</button>'
    + '<p style="color:var(--muted);font-size:12px;margin-top:11px;line-height:1.6">'
    + 'Fonctionne sur Android, iPhone, iPad et ordinateur. Vos favoris et notes restent synchronisés '
    + (Store.mode === 'supabase' ? 'via votre compte Supabase.' : 'dans ce navigateur.') + '</p>'
    + '</div>';
}

let toastTimer;
function toast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2900);
}

/* ---------- CONTENU COMPLET (chargé par tranches de 40 fichiers, à la demande) ---------- */
const shardCache = {};
async function fetchFullArticle(id) {
  const p = App.postById(id);
  if (!p) return null;
  if (typeof p.sh !== 'number') return null;
  const key = 'shard-' + String(p.sh).padStart(2, '0');
  if (!shardCache[key]) {
    const res = await fetch('content/' + key + '.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('contenu indisponible');
    shardCache[key] = await res.json();
  }
  return shardCache[key][String(id)] || null;
}
/* Nettoyage HTML : structure éditoriale conservée, scripts et shortcodes retirés */
function sanitize(html) {
  let h = String(html || '');
  h = h.replace(/\[\/?[a-zA-Z_][^\]]*\]/g, '');
  const d = document.createElement('div');
  d.innerHTML = h;
  d.querySelectorAll('script,style,noscript,iframe,[class*="rev_slider"],[class*="vc_row"]').forEach(n => {
    if (n.tagName === 'IFRAME') { n.remove(); return; }
    n.replaceWith(...n.childNodes);
  });
  d.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  d.querySelectorAll('img').forEach(img => {
    img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    if (img.src.startsWith('http://')) img.src = img.src.replace('http://', 'https://');
  });
  d.querySelectorAll('*').forEach(n => {
    if (n.getAttribute) { n.removeAttribute('style'); n.removeAttribute('class'); n.removeAttribute('id'); n.removeAttribute('data-*'); }
  });
  return d.innerHTML;
}

/* ---------- DÉMARRAGE ---------- */
/* ---------- APPLICATION INSTALLABLE (PWA) ---------- */

/* Le hash reflète la vue courante : liens partageables et raccourcis d'écran d'accueil. */
window.addEventListener('hashchange', () => {
  const raw = (location.hash || '').replace('#', '');
  const publicViews = ['accueil', 'magazine', 'explorer', 'audio', 'bibliotheque', 'recherche'];
  /* Articles partageables : #article-<id> */
  if (raw.startsWith('article-')) { Pub.show().then(() => Pub.open(Number(raw.slice(8)))); return; }
  if (publicViews.includes(raw)) {
    if ($('#publicApp').classList.contains('hidden')) Pub.show(); else { Pub.view = raw; Pub.query = ''; Pub.theme = null; Pub.render(); }
    return;
  }
  if (raw === 'connexion' || raw === 'inscription') { if ($('#authScreen').classList.contains('hidden')) App.openAuth(raw === 'inscription' ? 'signup' : 'login'); return; }
  if (raw && raw !== App.view && $('#app') && !$('#app').classList.contains('hidden')) App.go(raw);
});

/* Android / Chrome : capture de la demande d'installation native. */
let _installPrompt = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  _installPrompt = ev;
  App._installable = true;
  if (App.view === 'settings') App.render();
});
window.addEventListener('appinstalled', () => {
  _installPrompt = null; App._installable = false;
  toast('✓ Ingeta est installé sur votre écran d’accueil');
});

/* Enregistrement du service worker : lecture hors ligne des articles déjà ouverts. */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré :', e.message));
  });
}

window.addEventListener('DOMContentLoaded', () => { App.boot(); });

/* Les gestionnaires étant désormais asynchrones, on évite les échecs silencieux. */
window.addEventListener('unhandledrejection', (ev) => {
  console.error('Promesse non gérée', ev.reason);
  toast('⚠️ ' + (ev.reason && ev.reason.message ? ev.reason.message : 'Une opération a échoué'));
  ev.preventDefault();
});
document.addEventListener('click', e => {
  if (!e.target.closest('#notifPanel') && !e.target.closest('[onclick*="toggleNotifs"]')) {
    if (App.notifOpen) { App.notifOpen = false; $('#notifPanel').classList.add('hidden'); }
  }
});
