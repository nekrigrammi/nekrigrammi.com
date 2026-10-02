/*
 * The page: the header, the phone that rings in the hero, the island with its
 * cases, the roles and who gets which, and the links that come from config.js.
 */
(function () {
  const NG = window.NG;
  const CFG = window.NG_CONFIG || {};
  const BR = window.NG_BRANDS || {};
  const esc = NG.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept */ } },
  };
  const brand = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BR[name] || ''}"/></svg>`;

  /* ---------- header and menu ---------- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const toggle = $('#navToggle');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.querySelectorAll('#nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- things that slide in as they are reached ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  const watch = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));

  /* ---------- the line: flat, until it isn't ---------- */
  // One beat, the logo's own shape: down, up hard, down hard, back to the line.
  const BEAT = [[0, 0], [3, 5], [8, -12], [13, 13], [16, 0]];
  function pulseLine(canvas, { every = 3800, height = 0.5, follow = false } = {}) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0, on = false, t0 = performance.now();
    const extra = [];
    const size = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const sx = () => Math.max(3.2, Math.min(6, w / 260));
    const sy = () => h * height / 13;
    const draw = (now) => {
      ctx.clearRect(0, 0, w, h);
      const y0 = h / 2;
      const beatW = 16 * sx();
      const span = w + beatW * 2;
      const phase = reduced ? 0.62 : ((now - t0) % every) / every;
      const heads = [phase * span - beatW, ...extra.map((e) => e.x)];
      // the line itself
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(58,67,77,.8)';
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
      // each beat, with a fading trail behind it
      for (const x0 of heads) {
        const g = ctx.createLinearGradient(x0 - 220, 0, x0 + beatW, 0);
        g.addColorStop(0, 'rgba(179,18,29,0)');
        g.addColorStop(1, 'rgba(224,48,60,.9)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(224,48,60,.6)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x0 - 220), y0);
        for (const [bx, by] of BEAT) ctx.lineTo(x0 + bx * sx(), y0 + by * sy());
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      for (let i = extra.length - 1; i >= 0; i--) if (now - extra[i].t > 900) extra.splice(i, 1);
      if (on && !reduced) raf = requestAnimationFrame(draw);
    };
    size();
    addEventListener('resize', () => { size(); draw(performance.now()); });
    new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(draw);
    }).observe(canvas);
    if (follow) {
      let last = 0;
      canvas.parentElement.addEventListener('pointermove', (e) => {
        const now = performance.now();
        if (now - last < 650 || e.pointerType !== 'mouse') return;
        last = now;
        const r = canvas.getBoundingClientRect();
        extra.push({ x: e.clientX - r.left - 8 * sx(), t: now });
      });
    }
    draw(performance.now());
  }
  pulseLine($('#pulseLine'), { follow: true });
  pulseLine($('#pulseFinal'), { every: 2600, height: 0.7 });

  /* ---------- the phone in the hero rings ---------- */
  const phone = $('#heroPhone');
  const screen = $('#heroCall');
  const hint = $('#heroHint');
  const DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
  const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  const clockNow = () => { const d = new Date(); return [`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`]; };
  const setHint = (t) => { hint.textContent = t; };
  let rings = 0;

  const call = new NG.Call(screen, {
    name: 'Άγνωστος αριθμός',
    sub: 'Κύπρος',
    clip: 'landing-call',
    missAfter: 30,
    onRing: () => { phone.dataset.state = 'ringing'; setHint('Σας καλούν. Πατήστε «Απάντηση».'); headsUp(); },
    onAnswer: () => { phone.dataset.state = 'call'; setHint('Ακούστε.'); headsUp(); },
    onEnd: () => { ended(); headsUp(); },
    onMissed: () => { missed(); headsUp(); },
  });

  // On a phone the handset in the hero can be below the fold, or already scrolled
  // past: the call comes down from the top of the screen instead, as a real one does.
  const banner = document.createElement('div');
  banner.className = 'heads-up';
  banner.setAttribute('role', 'alertdialog');
  banner.setAttribute('aria-label', 'Εισερχόμενη κλήση');
  banner.innerHTML = `<div class="call-avatar">${NG.icons.PERSON}</div>
    <div class="hu-text"><b>Άγνωστος αριθμός</b><span>Εισερχόμενη κλήση · Νεκρή Γραμμή</span></div>
    <button class="hu-btn decline" type="button" aria-label="Απόρριψη">${NG.icons.PHONE}</button>
    <button class="hu-btn answer" type="button" aria-label="Απάντηση">${NG.icons.PHONE}</button>`;
  document.body.appendChild(banner);
  let phoneSeen = 0;
  function headsUp() {
    banner.classList.toggle('show', phone.dataset.state === 'ringing' && phoneSeen < 0.6);
  }
  new IntersectionObserver(([e]) => { phoneSeen = e.intersectionRatio; headsUp(); }, { threshold: [0, 0.3, 0.6, 0.9] }).observe(phone);
  banner.querySelector('.answer').addEventListener('click', () => {
    phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    call.answer();
  });
  banner.querySelector('.decline').addEventListener('click', () => call.decline());

  function lock(note) {
    const [time, date] = clockNow();
    screen.innerHTML = `<div class="call"><p class="lock-time">${time}</p><p class="lock-date">${date}</p>${note}</div>`;
  }
  function idle() {
    phone.dataset.state = 'idle';
    lock('<div class="lock-note"><b>ΝΕΚΡΗ ΓΡΑΜΜΗ</b>Η γραμμή είναι ανοιχτή.</div>');
  }
  function ended() {
    phone.dataset.state = 'ended';
    screen.innerHTML = `<div class="call call-ended"><p class="call-label">Η κλήση τερματίστηκε</p>
      <div class="call-avatar">${NG.icons.PERSON}</div><p class="call-name">Άγνωστος αριθμός</p>
      <p class="call-note">Θα χτυπήσει ξανά.</p>
      <div class="call-cta"><a class="btn btn-blood btn-block" href="#demo">Δοκιμάστε μια υπόθεση</a>
      <button class="btn btn-ghost btn-block" type="button" data-again>Ξανακούστε</button></div></div>`;
    $('[data-again]', screen).addEventListener('click', () => call.answer('Τηλεφωνητής'));
    setHint('');
    store.set('nekri-grammi:site-call', 'heard');
  }
  function missed() {
    phone.dataset.state = 'missed';
    lock(`<div class="call-cta"><div class="lock-note"><b><span class="missed-dot"></span>Αναπάντητη κλήση</b>Άγνωστος αριθμός · ένα νέο μήνυμα στον τηλεφωνητή</div>
      <button class="btn btn-answer btn-block" type="button" data-vm>Ακούστε το μήνυμα</button></div>`);
    $('[data-vm]', screen).addEventListener('click', () => call.answer('Τηλεφωνητής'));
    setHint('Ό,τι χάσετε, σας περιμένει στον τηλεφωνητή.');
    // It tries once more, later — if the visitor is still here.
    if (rings < 2) setTimeout(() => { if (phone.dataset.state === 'missed' && heroInView && !document.hidden) ringNow(); }, 45000);
  }
  function ringNow() { rings++; call.ring(); }

  // It rings only while the hero is on screen: a visitor who arrives further down
  // (a link, a reload in the middle of the mini-case) hears it when they come back up.
  let heroInView = false;
  let waiting = true;
  const heroEl = $('.hero');
  const onScreen = () => {
    const r = heroEl.getBoundingClientRect();
    return document.visibilityState === 'visible' && r.bottom > innerHeight * 0.35 && r.top < innerHeight * 0.65;
  };
  const maybeRing = () => {
    if (!heroInView || !waiting) return;
    waiting = false;
    setTimeout(() => {
      if (phone.dataset.state === 'idle' && heroInView && onScreen()) ringNow();
      else waiting = phone.dataset.state === 'idle';
    }, reduced ? 1200 : 2600);
  };
  new IntersectionObserver(([e]) => { heroInView = e.isIntersecting; maybeRing(); }, { threshold: 0.35 }).observe(heroEl);
  // The observer can lag in a tab that opens in the background: look again when it comes forward.
  document.addEventListener('visibilitychange', () => { if (onScreen()) { heroInView = true; maybeRing(); } });
  if (onScreen()) { heroInView = true; maybeRing(); }
  idle();
  setInterval(() => { if (phone.dataset.state === 'idle') idle(); }, 30000);

  /* ---------- the island ---------- */
  // Coastline points (longitude, latitude), clockwise from Lara on the west coast.
  const COAST = [
    [32.31, 34.95], [32.32, 34.9], [32.36, 34.85], [32.4, 34.76], [32.48, 34.72], [32.62, 34.665], [32.71, 34.655],
    [32.8, 34.66], [32.9, 34.6], [32.95, 34.565], [33.02, 34.585], [33.03, 34.64], [33.06, 34.675], [33.13, 34.705],
    [33.27, 34.71], [33.35, 34.73], [33.48, 34.79], [33.6, 34.815], [33.64, 34.9], [33.72, 34.97], [33.85, 34.975],
    [33.99, 34.985], [34.08, 34.965], [34.075, 35.02], [34.03, 35.065], [33.95, 35.12], [33.91, 35.19], [33.95, 35.3],
    [34.05, 35.37], [34.2, 35.45], [34.38, 35.55], [34.59, 35.69], [34.45, 35.66], [34.3, 35.61], [34.1, 35.52],
    [33.95, 35.44], [33.75, 35.38], [33.55, 35.36], [33.32, 35.345], [33.15, 35.36], [32.93, 35.395], [32.92, 35.3],
    [32.88, 35.21], [32.83, 35.15], [32.68, 35.18], [32.55, 35.165], [32.42, 35.05], [32.35, 35.08], [32.27, 35.1], [32.3, 35.02],
  ];
  const P = ([lon, lat]) => [(lon - 32.2) * 0.8192 * 430, (35.78 - lat) * 430];
  function smooth(pts) {
    // Catmull-Rom through the points, closed.
    const n = pts.length;
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }
  // Labels kept clear of each other: Limassol and Germasogeia are neighbours.
  const LABEL = { 'case-01': [-16, 40, 'end'], 'case-02': [18, -30, 'start'], 'case-03': [18, 8, 'start'], 'case-04': [18, 8, 'start'], 'case-05': [-16, -34, 'end'], demo: [16, 34, 'start'] };
  const cases = window.NG_CASES || [];
  const demo = window.NG_DEMO;
  const island = $('#island');
  const grid = [];
  for (let x = 0; x <= 870; x += 58) grid.push(`<line class="grid" x1="${x}" y1="0" x2="${x}" y2="545"/>`);
  for (let y = 0; y <= 545; y += 58) grid.push(`<line class="grid" x1="0" y1="${y}" x2="870" y2="${y}"/>`);
  const pin = (id, n, lon, lat, sub, cls = '') => {
    const [x, y] = P([lon, lat]);
    const [dx, dy, anchor] = LABEL[id];
    return `<g class="pin ${cls}" data-pin="${id}" tabindex="0" role="button" aria-label="${esc(n)} ${esc(sub)}">
      <circle class="halo" cx="${x}" cy="${y}" r="8"/><circle class="dot" cx="${x}" cy="${y}" r="9"/>
      <text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}">${esc(n)}</text>
      <text class="sub" x="${x + dx}" y="${y + dy + 18}" text-anchor="${anchor}">${esc(sub)}</text></g>`;
  };
  island.innerHTML = `<g>${grid.join('')}</g><path class="land" d="${smooth(COAST.map(P))}"/>
    ${cases.map((c) => pin(c.id, c.number, c.lon, c.lat, c.city)).join('')}
    ${demo ? pin('demo', 'Δ', demo.site.place.lon, demo.site.place.lat, `${demo.site.place.city} · δοκιμή`, 'demo') : ''}`;

  const dossiers = $('#dossiers');
  const mins = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  dossiers.innerHTML = cases.map((c) => `<article class="dossier reveal" id="file-${c.id}" data-case="${c.id}">
      <div class="cover"><img src="${c.cover}" alt="" loading="lazy"><span class="num">${esc(c.number)}</span>
      ${c.minAge ? `<span class="stamp">${c.minAge}+</span>` : ''}</div>
      <div class="body"><p class="where">Υπόθεση ${esc(c.number)} · ${esc(c.where)}</p>
      <h3>${esc(c.title)}</h3><p>${esc(c.teaser)}</p>
      <div class="row"><button class="play-btn" type="button" data-video="${c.id}">${NG.icons.PLAY} Εισαγωγή · ${mins(c.videoSeconds)}</button>
      <span class="chip">${c.hours} ώρες στο ρολόι</span></div></div></article>`).join('');

  const activate = (id) => {
    island.querySelectorAll('.pin').forEach((p) => p.classList.toggle('active', p.dataset.pin === id));
    dossiers.querySelectorAll('.dossier').forEach((d) => d.classList.toggle('active', d.dataset.case === id));
  };
  island.querySelectorAll('.pin').forEach((p) => {
    const go = () => {
      const id = p.dataset.pin;
      if (id === 'demo') { $('#demo').scrollIntoView({ behavior: 'smooth' }); return; }
      activate(id);
      const card = $(`#file-${id}`);
      // On a narrow screen the files sit below the map: take the visitor there.
      if (innerWidth < 960) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    p.addEventListener('click', go);
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    p.addEventListener('pointerenter', () => p.dataset.pin !== 'demo' && activate(p.dataset.pin));
  });
  dossiers.querySelectorAll('.dossier').forEach((d) => d.addEventListener('pointerenter', () => activate(d.dataset.case)));

  /* ---------- the intro films ---------- */
  const modal = $('#videoModal');
  const player = $('#videoPlayer');
  dossiers.addEventListener('click', (e) => {
    const b = e.target.closest('[data-video]');
    if (!b) return;
    const c = cases.find((x) => x.id === b.dataset.video);
    NG.stopAll();
    $('#videoKicker').textContent = `Υπόθεση ${c.number} · ${c.where}`;
    $('#videoTitle').textContent = c.title;
    const w = $('#videoWarning');
    w.hidden = !c.warning;
    w.textContent = c.warning ? `${c.minAge}+ · ${c.warning}` : '';
    player.src = c.video;
    player.poster = c.poster;
    if (modal.showModal) modal.showModal(); else modal.setAttribute('open', '');
    player.play().catch(() => {});
  });
  const closeModal = () => { player.pause(); player.removeAttribute('src'); player.load(); if (modal.open) modal.close(); };
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  modal.addEventListener('close', () => { player.pause(); });
  $('#howVideo').addEventListener('play', () => NG.stopAll());

  /* ---------- roles, and who gets which ---------- */
  const ROLES = {
    lead: { name: 'Ο ΕΠΙΚΕΦΑΛΗΣ', line: 'Κρατά τον χάρτη και λέει πού πάτε.', note: 'Ακούει τους άλλους. Αποφασίζει τελευταίος.', icon: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>' },
    file: { name: 'Ο ΦΑΚΕΛΟΣ', line: 'Διαβάζει κάθε στοιχείο δυνατά.', note: 'Κανείς δεν διαβάζει σιωπηλά. Ό,τι βρεθεί, ακούγεται.', icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8"/>' },
    line: { name: 'Η ΓΡΑΜΜΗ', line: 'Απαντά στο τηλέφωνο.', note: 'Όποιος απαντά, κρατά τη συσκευή μέχρι να κλείσει η κλήση.', icon: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>' },
    clock: { name: 'ΤΟ ΡΟΛΟΪ', line: 'Λέει δυνατά πόσος χρόνος απομένει.', note: 'Πριν από κάθε απόφαση. Κάθε φορά.', icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2.5h4"/>' },
  };
  $('#roleCards').innerHTML = Object.values(ROLES).map((r) => `<article class="role reveal">
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${r.icon}</svg>
    <h3>${r.name}</h3><p>${r.line}</p><small>${r.note}</small></article>`).join('');

  const NAMES_KEY = 'nekri-grammi:site-players';
  let names = store.get(NAMES_KEY, []).slice(0, 5);
  const chips = $('#dealerChips');
  const dealBtn = $('#dealerDeal');
  const result = $('#dealerResult');
  const input = $('#dealerName');
  const drawChips = () => {
    chips.innerHTML = names.map((n, i) => `<li>${esc(n)}<button type="button" data-rm="${i}" aria-label="Αφαίρεση ${esc(n)}">×</button></li>`).join('');
    dealBtn.disabled = names.length < 2;
    input.disabled = names.length >= 5;
    input.placeholder = names.length >= 5 ? 'Πέντε παίκτες, η παρέα είναι πλήρης' : names.length ? 'Ακόμη ένα όνομα' : 'Όνομα παίκτη';
    store.set(NAMES_KEY, names);
  };
  $('#dealerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = input.value.trim();
    if (!n || names.length >= 5) return;
    names.push(n);
    input.value = '';
    drawChips();
    input.focus();
  });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    names.splice(Number(b.dataset.rm), 1);
    result.innerHTML = '';
    drawChips();
  });
  dealBtn.addEventListener('click', () => {
    const order = [...names];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // With two or three, the file and the line come first: they are the two that count.
    const plan = {
      2: [['file', 'lead'], ['line', 'clock']],
      3: [['file'], ['line'], ['lead', 'clock']],
      4: [['lead'], ['file'], ['line'], ['clock']],
      5: [['lead'], ['file'], ['file'], ['line'], ['clock']],
    }[order.length];
    const fileReaders = order.filter((_, i) => plan[i].includes('file'));
    result.innerHTML = order.map((n, i) => {
      const roles = plan[i].map((k) => ROLES[k]);
      const shared = plan[i].includes('file') && fileReaders.length > 1;
      const partner = fileReaders.find((x) => x !== n);
      return `<li style="animation-delay:${i * 0.12}s"><span>${roles.map((r) => r.name).join(' + ')}${shared ? ` · μαζί με ${esc(partner)}` : ''}</span>
        <b>${esc(n)}</b><small>${shared ? 'Διαβάζετε τα στοιχεία με τη σειρά, ένα ο καθένας.' : roles.map((r) => r.line).join(' ')}</small></li>`;
    }).join('');
  });
  drawChips();

  /* ---------- links from config.js ---------- */
  const STORES = [
    { key: 'android', icon: 'googleplay', small: 'Διαθέσιμο στο', name: 'Google Play' },
    { key: 'ios', icon: 'apple', small: 'Κατεβάστε από το', name: 'App Store' },
  ];
  const stores = CFG.stores || {};
  $('#stores').innerHTML = STORES.map((s) => stores[s.key]
    ? `<a class="store" href="${esc(stores[s.key])}" target="_blank" rel="noopener">${brand(s.icon)}<span><small>${s.small}</small>${s.name}</span></a>`
    : `<span class="store soon">${brand(s.icon)}<span><small>Σύντομα στο</small>${s.name}</span></span>`).join('');
  if (stores.android || stores.ios) {
    $('[data-config=stores-text]').textContent = `Στο ${[stores.android && 'Google Play', stores.ios && 'App Store'].filter(Boolean).join(' και στο ')}. Τα κουμπιά είναι στο τέλος της σελίδας.`;
  }
  const SOCIAL = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['x', 'X']];
  const profiles = SOCIAL.filter(([k]) => (CFG.social || {})[k]);
  const social = profiles
    .map(([k, label]) => `<li><a href="${esc(CFG.social[k])}" target="_blank" rel="noopener" aria-label="${label}">${brand(k)}</a></li>`).join('');
  $('#socialFinal').innerHTML = social;
  $('#socialFooter').innerHTML = social;
  $('#followLabel').hidden = !profiles.length;
  // Until the app is in the stores, the answer to «Πού θα τη βρω;» is where to follow it.
  if (!stores.android && !stores.ios && profiles.length) {
    const links = profiles.map(([k, label]) => `<a href="${esc(CFG.social[k])}" target="_blank" rel="noopener">${label}</a>`);
    const list = links.length > 1 ? `${links.slice(0, -1).join(', στο ')} και στο ${links[links.length - 1]}` : links[0];
    $('[data-config=stores-text]').innerHTML = `Η εφαρμογή έρχεται σύντομα για Android και iPhone. Ακολουθήστε μας στο ${list}, για να μάθετε πρώτοι πότε.`;
  }
  if (CFG.domain) {
    $('[data-config=canonical]').href = `${CFG.domain}/`;
    $('[data-config=og-image]').content = `${CFG.domain}/media/img/og.jpg`;
  }
  if (CFG.email) $('[data-config=contact]').innerHTML = ` · <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>`;
  // «Πώς επικοινωνούμε μαζί σας;»: the address and every profile, from the same config.
  const profileLinks = profiles.map(([k, label]) => `<a href="${esc(CFG.social[k])}" target="_blank" rel="noopener">${label}</a>`);
  const either = profileLinks.length > 1 ? `${profileLinks.slice(0, -1).join(', στο ')} ή στο ${profileLinks[profileLinks.length - 1]}` : profileLinks[0];
  const ways = [
    CFG.email && `Γράψτε μας στο <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>`,
    profileLinks.length && `${CFG.email ? 'ή στείλτε' : 'Στείλτε'} μας μήνυμα στο ${either}`,
  ].filter(Boolean);
  if (ways.length) {
    $('[data-config=contact-text]').innerHTML = `${ways.join(' ')}. Διαβάζουμε όλα τα μηνύματα: ερωτήσεις, ιδέες για υποθέσεις, ό,τι δεν δούλεψε στο τραπέζι σας.`;
    $('#faqContact').hidden = false;
  }
  $('#year').textContent = new Date().getFullYear();

  watch();
})();
