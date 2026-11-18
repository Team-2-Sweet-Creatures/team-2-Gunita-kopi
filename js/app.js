/* Gunita Kopi POS — app shell: login, RBAC, top bar, routing,
   Dashboard + Orders screens, shared UI helpers (window.GKApp).
   POS screens live in js/pos.js; admin modules in js/admin.js. */
(function () {
  'use strict';
  var G = window.GKStore;
  var $ = G.$, $$ = G.$$, peso = G.peso, esc = G.esc, ICONS = G.ICONS;
  var S = function () { return G.state(); };

  /* ================= session / auth ================= */
  /* Each HTML page sets window.GK_ROLE ('Barista' or 'Owner') before this file loads. */
  var ROLE = window.GK_ROLE || 'Owner';
  var HOME = ROLE === 'Owner' ? 'dashboard' : 'pos';
  var OTHER = ROLE === 'Owner'
    ? { page: 'barista.html', label: 'Barista page' }
    : { page: 'owner.html', label: 'Owner page' };
  var failCount = 0, lockUntil = 0;
  function currentUser() { var u = G.currentUser(); return u && u.role === ROLE ? u : null; }
  function isAdmin() { var u = currentUser(); return u && u.role === 'Owner'; }

  var idleTimer = null, warnTimer = null;
  function resetIdle() {
    if (!currentUser()) return;
    clearTimeout(idleTimer); clearInterval(warnTimer);
    var min = S().settings.autoLogoutMin || 5;
    idleTimer = setTimeout(showIdleWarn, min * 60000);
  }
  function showIdleWarn() {
    var left = 30;
    G.openModal(
      '<h2>Still there?</h2><p>You\'ll be signed out in <strong class="num" id="idle-count">' + left + '</strong> s.</p>' +
      '<div class="modal-actions"><button class="btn" id="idle-out">Sign out now</button>' +
      '<button class="btn btn-primary" id="idle-stay">Stay signed in</button></div>',
      { label: 'Inactivity warning', sticky: true });
    $('#idle-stay').addEventListener('click', function () { clearInterval(warnTimer); G.closeModal(); resetIdle(); });
    $('#idle-out').addEventListener('click', function () { clearInterval(warnTimer); doLogout(); });
    warnTimer = setInterval(function () {
      left--;
      var c = $('#idle-count');
      if (!c) { clearInterval(warnTimer); return; }
      c.textContent = left;
      if (left <= 0) { clearInterval(warnTimer); doLogout('Signed out due to inactivity.'); }
    }, 1000);
  }
  function doLogout(msg) {
    G.logout();
    document.body.classList.remove('pos-mode', 'wide-mode', 'fill-mode');
    renderLogin();
    if (msg) G.toast(msg, true);
  }
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, resetIdle, { passive: true });
  });

  /* ================= login screen ================= */
  function renderLogin() {
    document.body.classList.add('auth-mode');
    $('#screen').innerHTML =
      '<div class="login-wrap">' +
      '<div class="login-card card">' +
      '<div class="login-brand"><span class="login-baybayin" lang="tl-Tglg" aria-hidden="true">ᜄᜓᜈᜒᜆ ᜃᜓᜉᜒ</span>' +
      '<span class="brand-word">Gunita Kopi</span><span class="brand-sub">' + ROLE + ' Sign-in</span></div>' +
      '<label class="field">Username<input type="text" id="lg-user" autocomplete="username"></label>' +
      '<label class="field">Password<span class="pw-wrap"><input type="password" id="lg-pass" autocomplete="current-password">' +
      '<button type="button" class="pw-eye" id="lg-eye" aria-label="Show password">' + ICONS.eye + '</button></span></label>' +
      '<div class="field-err" id="lg-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" id="lg-btn">Sign in</button>' +
      (ROLE === 'Owner'
        ? '<div class="login-links"><button type="button" class="link-btn" id="lg-forgot">Forgot password?</button>' +
          (ownerSetupDone() ? '' : '<button type="button" class="link-btn" id="lg-create">Create account</button>') + '</div>'
        : '') +
      '</div></div>';
    if (ROLE === 'Owner') {
      $('#lg-forgot').addEventListener('click', renderForgot);
      if ($('#lg-create')) $('#lg-create').addEventListener('click', renderSignup);
    }
    $('#lg-eye').addEventListener('click', function () {
      var p = $('#lg-pass');
      p.type = p.type === 'password' ? 'text' : 'password';
      this.innerHTML = p.type === 'password' ? ICONS.eye : ICONS.eyeOff;
      this.setAttribute('aria-label', p.type === 'password' ? 'Show password' : 'Hide password');
    });
    function tryLogin() {
      var now = Date.now();
      if (now < lockUntil) {
        $('#lg-err').textContent = 'Too many attempts — try again in ' + Math.ceil((lockUntil - now) / 1000) + ' s.';
        return;
      }
      var un = $('#lg-user').value.trim(), pw = $('#lg-pass').value;
      var u = S().users.filter(function (x) { return x.username === un; })[0];
      if (!u || u.password !== pw) {
        failCount++;
        $('#lg-err').textContent = 'Incorrect username or password.';
        if (failCount >= 5) { lockUntil = Date.now() + 30000; failCount = 0; $('#lg-err').textContent = 'Too many attempts — locked for 30 s.'; }
        return;
      }
      if (u.role !== ROLE) {
        $('#lg-err').textContent = 'This is the ' + ROLE + ' page. Please use the ' + OTHER.label + ' for this account.';
        return;
      }
      if (u.status !== 'Active') { $('#lg-err').textContent = 'This account is inactive. Contact the administrator.'; return; }
      failCount = 0;
      G.login(u);
      document.body.classList.remove('auth-mode');
      location.hash = '#' + HOME;
      render();
      G.toast('Welcome, ' + u.full_name.split(' ')[0] + '!');
      resetIdle();
    }
    $('#lg-btn').addEventListener('click', tryLogin);
    $('#lg-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    $('#lg-user').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#lg-pass').focus(); });
    $('#lg-user').focus();
  }

  /* ================= owner: forgot password / create account ================= */
  /* NOTE: no email server yet (data is localStorage). The recovery code is shown on screen as a demo;
     replace sendRecoveryEmail() with the real email/Supabase call later. */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function ownerSetupDone() {
    return S().users.some(function (x) { return x.role === 'Owner' && x.email; });
  }
  function findOwnerByEmail(email) {
    email = (email || '').trim().toLowerCase();
    return S().users.filter(function (x) { return x.role === 'Owner' && x.email && x.email.toLowerCase() === email; })[0];
  }
  function authShell(title, sub, body, cls) {
    document.body.classList.add('auth-mode');
    $('#screen').innerHTML =
      '<div class="login-wrap"><div class="login-card card' + (cls ? ' ' + cls : '') + '">' +
      '<div class="login-brand"><span class="login-baybayin" lang="tl-Tglg" aria-hidden="true">ᜄᜓᜈᜒᜆ ᜃᜓᜉᜒ</span>' +
      '<span class="brand-word">Gunita Kopi</span><span class="brand-sub">' + title + '</span></div>' +
      (sub ? '<p class="muted auth-sub" style="font-size:.85rem;margin:0">' + sub + '</p>' : '') +
      body +
      '<div class="login-links"><button type="button" class="link-btn" id="au-back">&larr; Back to sign in</button></div>' +
      '</div></div>';
    $('#au-back').addEventListener('click', renderLogin);
  }
  function pwField(id, label) {
    return '<label class="field">' + label + '<span class="pw-wrap"><input type="password" id="' + id + '" autocomplete="new-password">' +
      '<button type="button" class="pw-eye" data-for="' + id + '" aria-label="Show password">' + ICONS.eye + '</button></span></label>';
  }
  function wireEyes() {
    $$('.pw-eye[data-for]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = $('#' + b.getAttribute('data-for'));
        p.type = p.type === 'password' ? 'text' : 'password';
        b.innerHTML = p.type === 'password' ? ICONS.eye : ICONS.eyeOff;
        b.setAttribute('aria-label', p.type === 'password' ? 'Show password' : 'Hide password');
      });
    });
  }
  function sendRecoveryEmail(user) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    S().recovery = { user_id: user.user_id, code: code, expires: Date.now() + 15 * 60000, tries: 0 };
    G.save();
    return code; /* a real backend would email this instead of returning it */
  }

  /* Step 1 — enter the Owner's email */
  function renderForgot() {
    authShell('Forgot password', 'Enter the email address associated with your Owner account.',
      '<label class="field">Email address<input type="email" id="fp-email" autocomplete="email"></label>' +
      '<div class="field-err" id="fp-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" id="fp-btn">Send recovery link</button>');
    function submit() {
      var email = $('#fp-email').value.trim();
      if (!EMAIL_RE.test(email)) { $('#fp-err').textContent = 'Enter a valid email address.'; return; }
      var u = findOwnerByEmail(email);
      var demoCode = u && u.status === 'Active' ? sendRecoveryEmail(u) : null;
      renderCheckEmail(email, demoCode);
    }
    $('#fp-btn').addEventListener('click', submit);
    $('#fp-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('#fp-email').focus();
  }

  /* Step 2 — "check your email" + enter the code */
  function renderCheckEmail(email, demoCode) {
    authShell('Check your email',
      'If <strong>' + esc(email) + '</strong> belongs to an Owner account, a recovery code has been sent. It expires in 15 minutes.',
      (demoCode ? '<div class="demo-box"><strong>Demo mode</strong><span>No email service is connected yet. Your code: <span class="num">' + demoCode + '</span></span></div>' : '') +
      '<label class="field">Recovery code<input type="text" id="ce-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>' +
      '<div class="field-err" id="ce-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" id="ce-btn">Continue</button>');
    function submit() {
      var r = S().recovery, code = $('#ce-code').value.trim(), err = $('#ce-err');
      if (!r || Date.now() > r.expires) { err.textContent = 'Code expired or not found. Go back and request a new one.'; return; }
      if (r.tries >= 5) { err.textContent = 'Too many wrong attempts. Request a new code.'; return; }
      if (code !== r.code) { r.tries++; G.save(); err.textContent = 'Incorrect code.'; return; }
      renderNewPassword(r.user_id);
    }
    $('#ce-btn').addEventListener('click', submit);
    $('#ce-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('#ce-code').focus();
  }

  /* Step 3 — create new password */
  function renderNewPassword(userId) {
    authShell('Create new password', '',
      pwField('np-pass', 'New password (min 6 chars)') +
      pwField('np-pass2', 'Confirm new password') +
      '<div class="field-err" id="np-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" id="np-btn">Update password</button>');
    wireEyes();
    function submit() {
      var pw = $('#np-pass').value, pw2 = $('#np-pass2').value, err = $('#np-err');
      var u = S().users.filter(function (x) { return x.user_id === userId; })[0];
      if (!u) { err.textContent = 'Account not found.'; return; }
      if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
      if (pw !== pw2) { err.textContent = 'Passwords do not match.'; return; }
      u.password = pw;
      delete S().recovery;
      G.save();
      failCount = 0; lockUntil = 0;
      renderLogin();
      G.toast('Password successfully changed. Sign in with your username and new password.');
    }
    $('#np-btn').addEventListener('click', submit);
    $('#np-pass2').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('#np-pass').focus();
  }

  /* Create Owner account — initial setup only */
  function renderSignup() {
    if (ownerSetupDone()) { renderLogin(); return; }
    authShell('Create Owner account', 'Set up your administrative account.',
      '<div class="su-grid">' +
      '<label class="field">Full name<input type="text" id="su-name" autocomplete="name"></label>' +
      '<label class="field">Email address<input type="email" id="su-email" autocomplete="email"></label>' +
      '<label class="field su-full">Username<input type="text" id="su-user" autocomplete="username"></label>' +
      pwField('su-pass', 'Password (min 6 chars)') +
      pwField('su-pass2', 'Confirm password') +
      '</div>' +
      '<div class="field-err" id="su-err" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" id="su-btn">Create account</button>' +
      '<p class="muted su-note">Initial Owner registration only. Registration closes after setup.</p>',
      'login-card-wide');
    wireEyes();
    function submit() {
      var name = $('#su-name').value.trim(), email = $('#su-email').value.trim(), un = $('#su-user').value.trim();
      var pw = $('#su-pass').value, pw2 = $('#su-pass2').value, err = $('#su-err');
      if (!name) { err.textContent = 'Full name is required.'; return; }
      if (!EMAIL_RE.test(email)) { err.textContent = 'Enter a valid email address.'; return; }
      if (!un) { err.textContent = 'Username is required.'; return; }
      if (S().users.some(function (x) { return x.username.toLowerCase() === un.toLowerCase(); })) { err.textContent = 'Username already taken.'; return; }
      if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
      if (pw !== pw2) { err.textContent = 'Passwords do not match.'; return; }
      S().users.push({ user_id: G.uid('u'), username: un, email: email, password: pw, full_name: name,
        role: 'Owner', status: 'Active', date_created: Date.now() });
      G.save();
      renderLogin();
      G.toast('Owner account created. You can sign in now.');
    }
    $('#su-btn').addEventListener('click', submit);
    $('#su-pass2').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('#su-name').focus();
  }

  /* ================= shell / routing ================= */
  var NAV = [
    { route: 'dashboard', label: 'Dashboard', short: 'Home', roles: ['Owner'], icon: ICONS.home },
    { route: 'pos', label: 'POS', short: 'POS', roles: ['Barista'], icon: ICONS.cart },
    { route: 'orders', label: 'Orders', short: 'Orders', roles: ['Owner', 'Barista'], icon: ICONS.receipt },
    { route: 'products', label: 'Products', short: 'Menu', roles: ['Owner'], icon: ICONS.cup },
    { route: 'inventory', label: 'Inventory', short: 'Stock', roles: ['Owner', 'Barista'], icon: ICONS.box },
    { route: 'suppliers', label: 'Suppliers', short: 'Suppliers', roles: ['Owner'], icon: ICONS.truck },
    { route: 'reports', label: 'Reports', short: 'Reports', roles: ['Owner'], icon: ICONS.chart },
    { route: 'users', label: 'Users', short: 'Users', roles: ['Owner'], icon: ICONS.users }
  ];
  var ROUTES = ['dashboard', 'pos', 'orders', 'products', 'inventory', 'costing', 'suppliers', 'reports', 'users'];
  var TITLES = {
    dashboard: 'Dashboard', pos: 'POS — Menu & Cart', orders: 'Orders', products: 'Products',
    inventory: 'Inventory', suppliers: 'Suppliers', reports: 'Reports', users: 'Users'
  };
  function navFor(u) { return NAV.filter(function (n) { return n.roles.indexOf(u.role) >= 0; }); }
  function baseRoute(hash) { return (hash || '').split('/')[0].split('?')[0]; }

  function render() {
    var u = currentUser();
    if (!u) return renderLogin();
    document.body.classList.remove('auth-mode');
    var hash = (location.hash || '#' + HOME).replace(/^#/, '');
    var base = baseRoute(hash) || HOME;
    if (ROUTES.indexOf(base) < 0) { location.hash = '#' + HOME; return; }
    if (base === 'dashboard' && HOME !== 'dashboard') { location.hash = '#' + HOME; return; }
    if (!navFor(u).some(function (n) { return n.route === base; })) return renderRestricted(u, base);
    document.body.classList.toggle('pos-mode', base === 'pos');
    var firstSub = (hash.split('/')[1] || '').split('?')[0];
    var wide = (base === 'orders' && !firstSub) || (base === 'inventory' && firstSub !== 'stock');
    document.body.classList.toggle('wide-mode', wide);
    document.body.classList.toggle('fill-mode', ROLE === 'Barista');
    renderShell(u, base, TITLES[base]);
    var parts = hash.split('/');
    var sub = parts.slice(1).join('/');
    switch (base) {
      case 'dashboard': return scrDashboard($('#screen'));
      case 'pos': return window.GKPos.screen($('#screen'));
      case 'orders': return sub ? scrOrderDetail($('#screen'), decodeURIComponent(sub)) : scrOrders($('#screen'));
      case 'products': return window.GKAdmin.products($('#screen'), sub);
      case 'inventory': return window.GKAdmin.inventory($('#screen'), sub);
      case 'costing': location.hash = '#products/recipe'; return;
      case 'suppliers': return window.GKAdmin.suppliers($('#screen'), sub);
      case 'reports': return window.GKAdmin.reports($('#screen'), sub || 'daily');
      case 'users': return window.GKAdmin.users($('#screen'), sub);
    }
  }
  function renderRestricted(u, route) {
    document.body.classList.remove('pos-mode', 'wide-mode');
    renderShell(u, null, TITLES[route] || 'Restricted');
    $('#screen').innerHTML = '<div class="restricted card">' + ICONS.alert +
      '<h2>Access restricted</h2><p class="muted">This section is only available on the Owner page.</p>' +
      '<a class="btn" href="#' + HOME + '">Go back</a></div>';
  }

  var SB_LS = 'gk-sidebar-collapsed';
  var SB_SVG_HEAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>';
  var SB_ICON_CLOSE = SB_SVG_HEAD + '<path d="m16 15-3-3 3-3"/></svg>';  /* panel-left-close */
  var SB_ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';  /* hamburger, shown while collapsed */
  function applySidebarState() {
    var collapsed = localStorage.getItem(SB_LS) === '1';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    var btn = $('#sb-toggle');
    if (btn) {
      btn.innerHTML = collapsed ? SB_ICON_OPEN : SB_ICON_CLOSE;
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
  }
  function renderShell(u, active, pageTitle) {
    var nav = navFor(u);
    $('#sidebar').innerHTML =
      '<button class="sb-toggle" id="sb-toggle" type="button" aria-label="Collapse sidebar" aria-expanded="true" aria-controls="sidebar">' + SB_ICON_CLOSE + '</button>' +
      '<div class="brand"><span class="brand-baybayin" lang="tl-Tglg" aria-hidden="true">ᜄᜓᜈᜒᜆ ᜃᜓᜉᜒ</span>' +
      '<span class="brand-word">Gunita Kopi</span><span class="brand-sub">POS System</span></div>' +
      '<nav class="role-nav" aria-label="Main navigation">' +
      nav.map(function (n) {
        return '<a href="#' + n.route + '" class="role-link' + (active === n.route ? ' active' : '') + '" title="' + esc(n.label) + '"' + (active === n.route ? ' aria-current="page"' : '') + '>' +
          n.icon + '<span class="lbl-l">' + n.label + '</span><span class="lbl-s">' + n.short + '</span></a>';
      }).join('') + '</nav>';
    $('#topbar').innerHTML =
      '<span class="tb-title">' + esc(pageTitle || '') + '</span>' +
      '<span class="tb-user">' + ICONS.user + '<span><strong>' + esc(u.full_name) + '</strong> ' +
      '<span class="muted">' + esc(u.role) + '</span></span></span>' +
      '<button class="btn btn-sm" id="tb-logout" aria-label="Log out">' + ICONS.logout + '<span class="tb-logout-lbl">Log out</span></button>';
    $('#tb-logout').addEventListener('click', function () { doLogout('Signed out.'); });
    applySidebarState();
    $('#sb-toggle').addEventListener('click', function () {
      var collapsed = !document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem(SB_LS, collapsed ? '1' : '0');
      applySidebarState();
    });
    // Mobile bottom nav: first 4 + More sheet
    var bnav = $('#bottomnav');
    var first = nav.slice(0, 4), rest = nav.slice(4);
    bnav.innerHTML = first.map(function (n) {
      return '<a href="#' + n.route + '" class="role-link' + (active === n.route ? ' active' : '') + '">' + n.icon + '<span>' + n.short + '</span></a>';
    }).join('') +
      (rest.length ? '<button class="role-link" id="more-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg><span>More</span></button>' : '');
    var mb = $('#more-btn');
    if (mb) mb.addEventListener('click', function () {
      G.openModal(G.modalTitle('Menu') + '<div class="more-sheet">' +
        rest.map(function (n) { return '<a href="#' + n.route + '" class="role-link">' + n.icon + '<span>' + n.label + '</span></a>'; }).join('') +
        '<button class="role-link" id="m-logout">' + ICONS.logout + '<span>Log out</span></button></div>' +
        '<div class="modal-actions"><button class="btn" data-close>Close</button></div>', { label: 'Menu' });
      $$('.more-sheet a').forEach(function (a) { a.addEventListener('click', G.closeModal); });
      $('#m-logout').addEventListener('click', function () { G.closeModal(); doLogout('Signed out.'); });
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', function (e) {
    if (e.key === G.LS_KEY) { G.reloadFromStorage(); if (currentUser()) render(); }
  });

  /* ---------- shared screen helpers ---------- */
  function head(kickBay, kickLatin, title, actionsHtml) {
    return '<div class="screen-head"><div>' +
      '<h1>' + esc(title) + '</h1></div>' +
      '<div class="head-actions">' + (actionsHtml || '') + '</div></div>';
  }
  function chipStatus(k, label) {
    return '<span class="chip chip-' + k + '">' + (k === 'ok' ? ICONS.check : ICONS.alert) + label + '</span>';
  }
  function statusChip(status) {
    var k = { Pending: 'low', Preparing: 'coffee', Completed: 'ok', Cancelled: 'out' }[status] || '';
    return '<span class="chip ' + (k ? 'chip-' + k : '') + '">' + esc(status) + '</span>';
  }
  function subtabs(tabs, active) {
    return '<div class="subtabs" role="tablist">' + tabs.map(function (t) {
      return '<a class="subtab-link' + (t[0] === active ? ' on' : '') + '" href="#' + t[1] + '" role="tab" aria-selected="' + (t[0] === active) + '">' + esc(t[2] || t[0]) + '</a>';
    }).join('') + '</div>';
  }
  function barChart(vals, labels) {
    var w = 900, h = 220, pad = 56;
    var n = vals.length;
    var max = Math.max.apply(null, vals.concat([1])) * 1.15;
    var plotW = w - pad - 8;
    var slot = plotW / n;
    var bw = Math.min(34, slot * 0.6);
    var labelEvery = n > 10 ? Math.ceil(n / 10) : 1;
    var showVals = n <= 10;
    var bars = vals.map(function (v, i) {
      var bh = Math.max(2, (v / max) * (h - pad - 30));
      var x = pad + i * slot + (slot - bw) / 2, y = h - 30 - bh;
      var tip = '<title>' + esc(labels[i]) + ' — ' + peso(v) + '</title>';
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="' + Math.min(6, bw / 3) + '" fill="var(--moss)" opacity="' + (0.55 + 0.45 * v / max).toFixed(2) + '">' + tip + '</rect>' +
        (i % labelEvery === 0 ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 12) + '" text-anchor="middle" fill="var(--fg-muted)" font-size="11">' + esc(labels[i]) + '</text>' : '') +
        (showVals ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" fill="var(--leaf)" font-size="10" font-family="var(--font-num)">' + (v / 1000).toFixed(1) + 'k</text>' : '');
    }).join('');
    var grid = [0.33, 0.66, 1].map(function (f) {
      var y = h - 30 - f * (h - pad - 30);
      return '<line x1="' + pad + '" y1="' + y.toFixed(1) + '" x2="' + (w - 8) + '" y2="' + y.toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="3 5"/>' +
        '<text x="' + (pad - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="var(--fg-muted)" font-size="10" font-family="var(--font-num)">₱' + (max * f / 1000).toFixed(1) + 'k</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Sales chart"><title>Sales chart</title>' + grid + bars + '</svg>' +
      '<div class="legend"><span><i class="sw" style="background:var(--moss)"></i>Gross sales (₱)</span></div>';
  }
  function hbarChart(rows, valFmt) {
    var w = 440, rh = 34, h = rows.length * rh + 10 || 40;
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    var bars = rows.map(function (r, i) {
      var bw = Math.max(4, (r.v / max) * (w - 190));
      var y = i * rh + 6;
      return '<text x="0" y="' + (y + 15) + '" fill="var(--fg)" font-size="11">' + esc(r.name.length > 20 ? r.name.slice(0, 19) + '…' : r.name) + '</text>' +
        '<rect x="155" y="' + y + '" width="' + bw.toFixed(1) + '" height="20" rx="6" fill="var(--coffee)"/>' +
        '<text x="' + (161 + bw).toFixed(1) + '" y="' + (y + 15) + '" fill="var(--fg-muted)" font-size="10" font-family="var(--font-num)">' + (valFmt ? valFmt(r.v) : r.v) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Best selling products"><title>Best sellers</title>' + bars + '</svg>' +
      '<div class="legend"><span><i class="sw" style="background:var(--coffee)"></i>Units sold</span></div>';
  }
  function exportCSV(name, head, rows) {
    var csv = [head].concat(rows).map(function (row) {
      return row.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    G.toast('CSV exported');
  }
  /* Receipt popup (shared by POS and Order Details). */
  function receiptModal(orderId, opts) {
    opts = opts || {};
    var rows = G.orderRows(orderId);
    if (!rows.length) return;
    var g = rows[0];
    var pay = G.paymentFor(orderId);
    var total = G.orderTotal(orderId);
    var lines = G.v_order_lines(orderId);
    var cashier = G.userById(pay ? pay.received_by : g.user_id);
    var html = '<div class="print-area"><div class="slip"><div class="bay-head" lang="tl-Tglg" aria-hidden="true">ᜃᜓᜉᜒ</div>' +
      '<h3 style="text-align:center;margin:.2rem 0">' + esc(S().settings.shopName) + '</h3>' +
      '<div class="queue-num" style="text-align:center">' + esc(queueDisplay(orderId)) + '</div>' +
      '<p class="muted" style="text-align:center;margin:0 0 .5rem">' + esc(g.order_type) + ' · ' + G.fmtDateTime(g.order_date) + '</p>' +
      '<table>' + lines.map(function (l) {
        var sub = l.addons.map(function (a) {
          return '<br><span class="muted addon-line">+ ' + esc(a.addon_label) + ' <span class="num">' + peso(a.unit_price * a.quantity) + '</span></span>';
        }).join('');
        var cust = l.row.customization ? '<br><span class="muted" style="font-size:.78rem">' + esc(l.row.customization) + '</span>' : '';
        var instr = l.row.special_instructions ? '<br><span class="muted" style="font-size:.78rem">Note: ' + esc(l.row.special_instructions) + '</span>' : '';
        return '<tr><td>' + l.row.quantity + '× ' + esc(l.product_name) + sub + cust + instr + '</td><td class="r">' + peso(l.total) + '</td></tr>';
      }).join('') +
      '<tr class="tot"><td><strong>Total</strong></td><td class="r"><strong>' + peso(total) + '</strong></td></tr>' +
      (pay ? '<tr><td class="muted">' + esc(pay.payment_method) + '</td><td class="r muted">' + peso(pay.amount_paid) + '</td></tr>' +
        '<tr><td class="muted">Change</td><td class="r muted">' + peso(pay.change_amount) + '</td></tr>' : '<tr><td class="muted">Payment</td><td class="r muted">Unpaid</td></tr>') +
      '</table>' +
      '<p class="muted" style="font-size:.78rem;margin:.5rem 0 0">Served by ' + esc(cashier ? cashier.full_name : '—') + '</p>' +
      '<p class="muted" style="text-align:center;font-size:.78rem;margin:.3rem 0 0">' + esc(S().settings.receiptFooter) + '</p></div></div>' +
      '<div class="modal-actions"><button class="btn" data-close>' + (opts.newOrder ? 'Close' : 'Close') + '</button>' +
      '<button class="btn" onclick="window.print()">' + ICONS.printer + 'Print</button>' +
      (opts.newOrder ? '<button class="btn btn-primary" id="rc-new">New order</button>' : '') + '</div>';
    G.openModal(G.modalTitle('Receipt — ' + queueDisplay(orderId)) + html, { label: 'Receipt ' + queueDisplay(orderId) });
    var nb = $('#rc-new');
    if (nb) nb.addEventListener('click', function () { G.closeModal(); opts.newOrder(); });
  }

  /* ================= DASHBOARD ================= */
  function scrDashboard(el) {
    var today = G.dayKey(Date.now());
    var groups = G.orderGroups().filter(function (g) { return G.dayKey(g.order_date) === today; });
    if (!groups.length) {
      var latest = G.orderGroups().sort(function (a, b) { return b.order_date - a.order_date; })[0];
      if (latest) today = G.dayKey(latest.order_date);
      groups = G.orderGroups().filter(function (g) { return G.dayKey(g.order_date) === today; });
    }
    var todaySalesList = G.v_sales().filter(function (g) { return G.dayKey(g.order_date) === today; });
    var todayTotal = todaySalesList.reduce(function (a, g) { return a + g.total; }, 0);
    var pendingN = G.orderGroups().filter(function (g) { return g.status === 'Pending' || g.status === 'Preparing'; }).length;
    var top = G.v_best_sellers(today, today).slice(0, 5).map(function (r) { return { name: r.product, v: r.qty }; });
    var low = G.lowStockItems();
    var recent = G.orderGroups().sort(function (a, b) { return b.order_date - a.order_date; }).slice(0, 6);
    var admin = isAdmin();
    var completedToday = groups.filter(function (g) { return g.status === 'Completed'; }).length;
    el.innerHTML = head('ᜄᜓᜈᜒᜆ ᜃᜓᜉᜒ', 'gunita kopi · overview', 'Dashboard') +
      '<div class="kpis stagger">' +
      (admin
        ? '<div class="kpi"><div class="lbl">Today’s sales</div><div class="val">' + peso(todayTotal) + '</div></div>'
        : '<div class="kpi"><div class="lbl">Completed today</div><div class="val">' + completedToday + '</div></div>') +
      '<div class="kpi"><div class="lbl">Orders today</div><div class="val coffee">' + groups.length + '</div></div>' +
      '<div class="kpi"><div class="lbl">Pending / preparing</div><div class="val warn">' + pendingN + '</div></div></div>' +
      '<div class="charts">' +
      (admin ? '<div class="chart-card"><h3>Top products today</h3>' +
      (top.length ? hbarChart(top) : '<p class="muted">No sales yet today.</p>') + '</div>' : '') +
      '<div class="card"><h3>Low stock alerts</h3>' +
      (low.length ? low.map(function (i) {
        var act = isAdmin() ? ' <a class="btn btn-sm" href="#inventory/stock?ing=' + i.ingredient_id + '">Restock</a>' : '';
        return '<div class="duty-row">' + chipStatus(i.k, i.status) +
          '<span style="margin-left:.4rem;flex:1">' + esc(i.ingredient) + ' <span class="muted num" style="font-size:.78rem">' + i.current_stock + ' ' + i.unit + '</span></span>' + act + '</div>';
      }).join('') : '<p class="muted">All stock levels OK.</p>') + '</div></div>' +
      '<div class="card" style="margin-top:.9rem"><h3>Recent orders</h3>' +
      (recent.length ? '<div class="tbl-wrap" style="border:0;background:transparent"><table class="tbl" style="min-width:0"><tbody>' +
        recent.map(function (g) {
          var pay = G.paymentFor(g.order_id);
          return '<tr class="cost-row" data-oid="' + esc(g.order_id) + '"><td class="num">' + esc(G.queueNo(g.order_id)) + '</td>' +
            '<td>' + G.fmtTime(g.order_date) + '</td><td>' + esc(g.order_type) + '</td>' +
            '<td class="status-cell">' + statusChip(g.status) + '</td><td class="num">' + peso(g.total) + '</td>' +
            '<td>' + (pay ? esc(pay.payment_method) : '<span class="muted">Unpaid</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No orders yet.</p>') + '</div>';
    $$('[data-oid]').forEach(function (r) {
      r.addEventListener('click', function () { location.hash = '#orders/' + encodeURIComponent(r.dataset.oid); });
    });
  }

  /* ================= ORDERS ================= */
  var ordFilter = { q: '', status: 'all', date: '' };
  function queueDisplay(orderId) {
    var parts = String(orderId || '').split('-');
    var last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) return last.padStart(3, '0');
    return G.queueNo(orderId);
  }

  function scrOrders(el) {
    var ordersList = (G.state().orders || []).slice().sort(function (a, b) {
      if (a.order_id === b.order_id) {
        return (a.line_no || 0) - (b.line_no || 0);
      }
      return b.order_date - a.order_date;
    });

    var rows = ordersList.filter(function (r) {
      if (ordFilter.status !== 'all' && r.status !== ordFilter.status) return false;
      if (ordFilter.date && G.dayKey(r.order_date) !== ordFilter.date) return false;
      if (ordFilter.q) {
        var q = ordFilter.q.trim().toLowerCase();
        var qDisplay = queueDisplay(r.order_id).toLowerCase();
        var qFull = G.queueNo(r.order_id).toLowerCase();
        var prod = G.prodById(r.product_id);
        var prodName = (prod ? prod.product_name : (r.product_name || r.product_id || '')).toLowerCase();
        var user = G.userById(r.user_id);
        var cashier = (user ? user.full_name : '').toLowerCase();
        var lineStr = String(r.line_no != null ? r.line_no : (r.order_line_id || '')).toLowerCase();
        if (qDisplay.indexOf(q) < 0 && qFull.indexOf(q) < 0 && prodName.indexOf(q) < 0 && cashier.indexOf(q) < 0 && lineStr.indexOf(q) < 0) return false;
      }
      return true;
    });

    el.innerHTML = head('ᜄᜓᜈᜒᜆ', 'gunita · order board', 'Orders') +
      '<div class="report-controls">' +
      '<label class="field">Search<input type="text" id="o-q" placeholder="Queue no. e.g. 012" value="' + esc(ordFilter.q) + '"></label>' +
      '<label class="field">Status<select id="o-f"><option value="all">All</option>' +
      ['Pending', 'Preparing', 'Completed', 'Cancelled'].map(function (s) {
        return '<option' + (ordFilter.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field">Date<input type="date" id="o-d" value="' + esc(ordFilter.date) + '"></label>' +
      '<button class="btn btn-sm" id="o-clr">Clear date</button></div>' +
      '<div class="tbl-wrap"><table class="tbl tbl-orders"><thead><tr>' +
      '<th>LINE</th>' +
      '<th>QUEUE</th>' +
      '<th>CASHIER</th>' +
      '<th>TYPE</th>' +
      '<th>DATE &amp; TIME</th>' +
      '<th class="status-cell">STATUS</th>' +
      '<th>PRODUCT</th>' +
      '<th>INGREDIENT</th>' +
      '<th>ADD-ON</th>' +
      '<th>QTY</th>' +
      '<th>UNIT PRICE</th>' +
      '<th>CUSTOMIZATION</th>' +
      '<th>SPECIAL INSTRUCTIONS</th>' +
      '</tr></thead><tbody>' +
      (rows.map(function (r) {
        var prod = G.prodById(r.product_id);
        var prodName = prod ? prod.product_name : (r.product_name || r.product_id);
        var user = G.userById(r.user_id);
        var cashierName = user ? user.full_name : (r.cashier_name || 'Juan Dela Cruz');
        var ing = r.ingredient_id ? G.ingById(r.ingredient_id) : null;
        var ingName = r.is_addon ? (ing ? ing.ingredient_name : (r.ingredient_name || '-')) : '-';
        var addonText = r.is_addon ? 'Yes' : 'No';
        var custText = r.customization || '-';
        var noteText = r.special_instructions || '-';
        var lineNum = r.line_no != null ? r.line_no : (r.order_line_id || '');

        return '<tr class="cost-row" data-oid="' + esc(r.order_id) + '">' +
          '<td class="mono">' + esc(lineNum) + '</td>' +
          '<td class="mono">' + esc(queueDisplay(r.order_id)) + '</td>' +
          '<td>' + esc(cashierName) + '</td>' +
          '<td>' + esc(r.order_type) + '</td>' +
          '<td>' + G.fmtDate(r.order_date) + '<br>' + G.fmtTime(r.order_date) + '</td>' +
          '<td class="status-cell">' + statusChip(r.status) + '</td>' +
          '<td>' + esc(prodName) + '</td>' +
          '<td>' + esc(ingName) + '</td>' +
          '<td>' + esc(addonText) + '</td>' +
          '<td class="mono">' + esc(r.quantity) + '</td>' +
          '<td class="mono">' + peso(r.unit_price) + '</td>' +
          '<td>' + esc(custText) + '</td>' +
          '<td>' + esc(noteText) + '</td>' +
          '</tr>';
      }).join('') || '<tr><td colspan="13" class="muted">No orders match.</td></tr>') +
      '</tbody></table></div>';

    $('#o-q').addEventListener('input', function () { ordFilter.q = this.value.toLowerCase(); render(); var i = $('#o-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    $('#o-f').addEventListener('change', function () { ordFilter.status = this.value; render(); });
    $('#o-d').addEventListener('change', function () { ordFilter.date = this.value; render(); });
    var clr = $('#o-clr');
    if (clr) clr.addEventListener('click', function () { ordFilter.date = ''; render(); });
    $$('[data-oid]').forEach(function (r) {
      r.addEventListener('click', function () { location.hash = '#orders/' + encodeURIComponent(r.dataset.oid); });
    });
  }

  function scrOrderDetail(el, orderId) {
    var rows = G.orderRows(orderId);
    if (!rows.length) {
      el.innerHTML = '<div class="restricted card">' + ICONS.alert + '<h2>Order not found</h2><a class="btn" href="#orders">Back to Orders</a></div>';
      return;
    }
    var g = rows[0];
    var pay = G.paymentFor(orderId);
    var total = G.orderTotal(orderId);
    var lines = G.v_order_lines(orderId);
    var taker = G.userById(g.user_id);
    var receiver = pay ? G.userById(pay.received_by) : null;
    var next = { Pending: 'Preparing', Preparing: 'Completed' }[g.status];
    el.innerHTML = head('ᜄᜓᜈᜒᜆ', 'gunita · order', 'Order ' + G.queueNo(orderId),
      '<a class="btn btn-sm" href="#orders">' + ICONS.back + 'Back</a>' +
      '<button class="btn btn-sm" id="od-print">' + ICONS.printer + 'Receipt</button>' +
      (next ? '<button class="btn btn-sm btn-primary" id="od-next">' + esc(g.status) + ' → ' + esc(next) + '</button>' : '') +
      (g.status === 'Pending' || g.status === 'Preparing' ? '<button class="btn btn-sm btn-danger" id="od-cancel">Cancel order</button>' : '')) +
      '<div class="od-grid">' +
      '<div class="card"><h3>Items</h3><div class="tbl-wrap" style="border:0;background:transparent"><table class="tbl" style="min-width:0"><tbody>' +
      lines.map(function (l) {
        var addons = l.addons.map(function (a) {
          return '<div class="addon-line">+ ' + esc(a.addon_label) + ' ×' + a.quantity + ' <span class="num">' + peso(a.unit_price * a.quantity) + '</span></div>';
        }).join('');
        var cust = l.row.customization ? '<div class="muted" style="font-size:.78rem">' + esc(l.row.customization) + '</div>' : '';
        var instr = l.row.special_instructions ? '<div class="muted" style="font-size:.78rem">Note: ' + esc(l.row.special_instructions) + '</div>' : '';
        return '<tr><td><strong>' + l.row.quantity + '× ' + esc(l.product_name) + '</strong>' + addons + cust + instr + '</td>' +
          '<td class="num">' + peso(l.total) + '</td></tr>';
      }).join('') +
      '<tr><td><strong>Total</strong></td><td class="num"><strong>' + peso(total) + '</strong></td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="card"><h3>Details</h3>' +
      '<div class="cost-summary" style="border:0;padding-top:0">' +
      '<div class="row"><span>Queue number</span><span class="num">' + esc(G.queueNo(orderId)) + '</span></div>' +
      '<div class="row"><span>Date &amp; time</span><span>' + G.fmtDateTime(g.order_date) + '</span></div>' +
      '<div class="row"><span>Order type</span><span>' + esc(g.order_type) + '</span></div>' +
      '<div class="row"><span>Status</span><span>' + statusChip(g.status) + '</span></div>' +
      '<div class="row"><span>Taken by</span><span>' + esc(taker ? taker.full_name : '—') + '</span></div>' +
      '</div><h3 style="margin-top:1rem">Payment</h3>' +
      (pay ? '<div class="cost-summary" style="border:0;padding-top:0">' +
        '<div class="row"><span>Method</span><span>' + esc(pay.payment_method) + '</span></div>' +
        '<div class="row"><span>Amount paid</span><span class="num">' + peso(pay.amount_paid) + '</span></div>' +
        '<div class="row"><span>Change</span><span class="num">' + peso(pay.change_amount) + '</span></div>' +
        '<div class="row"><span>Date</span><span>' + G.fmtDateTime(pay.date_time) + '</span></div>' +
        '<div class="row"><span>Received by</span><span>' + esc(receiver ? receiver.full_name : '—') + '</span></div></div>'
        : '<p class="muted">No payment recorded.</p>') +
      '</div></div>';
    $('#od-print').addEventListener('click', function () { receiptModal(orderId); });
    var nb = $('#od-next');
    if (nb) nb.addEventListener('click', function () {
      G.setOrderStatus(orderId, next); render();
      G.toast(G.queueNo(orderId) + ' → ' + next);
    });
    var cb = $('#od-cancel');
    if (cb) cb.addEventListener('click', function () {
      G.confirmDialog({
        title: 'Cancel order ' + G.queueNo(orderId),
        body: 'Cancel this order? Ingredients used will be returned to stock.', okLabel: 'Cancel order', danger: true
      }).then(function (yes) {
        if (!yes) return;
        G.cancelOrder(orderId, currentUser().user_id);
        render();
        G.toast(G.queueNo(orderId) + ' cancelled — stock restored', true);
      });
    });
  }

  /* ================= shared exports / boot ================= */
  window.GKApp = {
    render: render, head: head, chipStatus: chipStatus, statusChip: statusChip, subtabs: subtabs,
    barChart: barChart, hbarChart: hbarChart, exportCSV: exportCSV, receiptModal: receiptModal,
    currentUser: currentUser, isAdmin: isAdmin
  };
  document.addEventListener('DOMContentLoaded', function () {
    G.offlineBanner();
    render();
  });
})();
