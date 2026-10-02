/*
 * The mini-case, played on the page by the app's own rules (src/lib/scenario/engine.ts
 * in the game): the clock is the only opponent; a drive, a walk across the same site
 * and every search cost minutes; running out of time ends the case rather than
 * blocking a move; the phone rings on its own and calls cost nothing; a name joins
 * the suspects only once something names it; a reason joins the list only once
 * something points to it; and the verdict is scored as the app scores it — the right
 * person, plus every required proof held, plus the right reason.
 *
 * The case itself is content/demo-case.json, in the app's case format, checked by the
 * game's validate-case.js and simulate-case.mjs (tools/check-demo.mjs).
 */
(function () {
  const NG = (window.NG = window.NG || {});
  const C = window.NG_DEMO;
  const root = document.getElementById('demoApp');
  if (!C || !root) return;
  const SITE = C.site;
  const esc = NG.esc;
  const KEY = 'nekri-grammi:site-demo:v2';
  const NOBODY = 'accident'; // the engine's id for «Κανείς»

  /* ---------- the engine, as the app has it ---------- */
  const loc = (id) => C.locations.find((l) => l.id === id);
  const evid = (id) => C.evidence.find((e) => e.id === id);
  const person = (id) => C.characters.find((c) => c.id === id);
  const travelKey = (a, b) => [a, b].sort().join('|');
  function travelCost(a, b) {
    if (a === b) return 0;
    const from = loc(a);
    const to = loc(b);
    if (from.site && from.site === to.site) return C.siteTravelMinutes ?? C.localTravelMinutes;
    if (from.city === to.city) return C.localTravelMinutes;
    return C.travelMinutes[travelKey(from.city, to.city)] ?? C.localTravelMinutes;
  }

  const fresh = () => ({
    phase: 'file', left: C.timeBudgetMinutes, at: C.startLocationId, searched: [], found: [],
    known: C.characters.filter((c) => c.knownFromStart).map((c) => c.id),
    fired: [], heard: [], missed: [], accused: null, motive: null,
  });
  let S = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.phase === 'play') S = Object.assign(fresh(), saved);
  } catch (e) { /* private window: start fresh */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* not kept */ } };
  const spent = () => C.timeBudgetMinutes - S.left;
  const fmt = (m) => `${Math.floor(m / 60)}ω ${String(m % 60).padStart(2, '0')}′`;
  const fmtCost = (m) => `${m}′`;

  /** Running out of time ends the case rather than blocking the player. */
  function spend(m) {
    S.left -= m;
    if (S.left <= 0) { S.left = 0; return false; }
    return true;
  }

  /** Calls whose trigger has come, in file order. */
  function due() {
    return C.calls.filter((call) => {
      if (S.fired.includes(call.id)) return false;
      const t = call.trigger;
      if (t.type === 'immediate') return true;
      if (t.type === 'onMinutesSpent') return spent() >= t.minutes;
      if (t.type === 'onEnterLocation') return S.at === t.locationId;
      if (t.type === 'onEvidenceFound') return S.found.includes(t.evidenceId);
      return false;
    });
  }

  function listPosition(optionId) {
    let hash = 0x811c9dc5;
    for (const char of `${C.id}:${optionId}`) {
      hash ^= char.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
  }
  function visibleMotives() {
    const supported = (o) => {
      const g = o.revealedBy || {};
      return (g.evidenceIds || []).some((id) => S.found.includes(id)) || (g.heardCallIds || []).some((id) => S.heard.includes(id));
    };
    return C.solution.motiveOptions
      .filter((o) => o.decoy || !o.revealedBy || supported(o))
      .sort((a, b) => listPosition(a.id) - listPosition(b.id));
  }
  const suspects = () => C.characters.filter((c) => c.standing === 'suspect' && S.known.includes(c.id));

  function outcome() {
    const sol = C.solution;
    const held = sol.requiredEvidenceIds.filter((id) => S.found.includes(id)).length;
    const right = S.accused === sol.culpritId;
    const score = right ? held + 1 + (S.motive === sol.correctMotiveId ? 1 : 0) : 0;
    const tier = [...sol.tiers].sort((a, b) => b.minScore - a.minScore).find((t) => score >= t.minScore) || sol.tiers[0];
    return { tier, held, total: sol.requiredEvidenceIds.length, score };
  }

  /* ---------- sound ---------- */
  // A quiet bed of the game's score while investigating; voices duck it.
  let bed = null;
  let music = true;
  const bedVolume = (v) => { if (bed) bed.volume = v; };
  const startBed = () => {
    if (!music) return;
    if (!bed) bed = NG.sound('media/audio/score.mp3', { loop: true, volume: 0.14 });
    bed.play().catch(() => {});
  };
  const stopBed = () => { if (bed) bed.pause(); };

  /** A full-screen layer, as the app's call screen; the page behind stays still. */
  function overlay(label) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', label);
    root.appendChild(ov);
    document.body.classList.add('overlay-open');
    const remove = ov.remove.bind(ov);
    ov.remove = () => {
      remove();
      if (root.querySelector('.overlay')) return;
      document.body.classList.remove('overlay-open');
      releaseHeld();
    };
    return ov;
  }

  /* ---------- screens ---------- */
  function render() {
    if (S.phase === 'file') return renderFile();
    renderPlay();
  }

  function renderFile() {
    stopBed();
    root.innerHTML = `<div class="demo-file">
      <div class="cover"><img src="media/img/${esc(SITE.images[C.startLocationId])}" alt="Η αποθήκη του φούρνου, νύχτα" loading="lazy"></div>
      <div class="demo-pad">
        <p class="kicker">${esc(SITE.kicker)}</p>
        <h3 class="demo-title">${esc(C.title)}</h3>
        <p class="demo-date">${esc(C.date)}</p>
        <p class="demo-text" id="demoIntro">${esc(C.briefing)}</p>
        <div class="demo-actions">
          <button class="btn btn-ghost" type="button" id="demoListen">${NG.icons.PLAY} Ακούστε τον φάκελο</button>
          <button class="btn btn-blood" type="button" id="demoStart">Έναρξη έρευνας</button>
        </div>
        <p class="demo-note">Στο ρολόι έχετε ${fmt(C.timeBudgetMinutes)}. Κάθε μετακίνηση και κάθε έρευνα κοστίζει χρόνο· οι κλήσεις δεν κοστίζουν τίποτα. Αν ο χρόνος τελειώσει πριν πείτε την απάντησή σας, η υπόθεση κλείνει.</p>
      </div></div>`;
    let voice = null;
    const listenBtn = root.querySelector('#demoListen');
    listenBtn.addEventListener('click', () => {
      if (voice) {
        voice.stop();
        voice = null;
        listenBtn.innerHTML = `${NG.icons.PLAY} Ακούστε τον φάκελο`;
        root.querySelector('#demoIntro').textContent = C.briefing;
        return;
      }
      listenBtn.textContent = 'Σταματήστε';
      voice = NG.speak(root.querySelector('#demoIntro'), SITE.audio.intro, {
        mode: 'sweep',
        onDone: () => { voice = null; listenBtn.innerHTML = `${NG.icons.PLAY} Ακούστε ξανά`; },
      });
    });
    root.querySelector('#demoStart').addEventListener('click', () => {
      if (voice) voice.stop();
      S = fresh();
      S.phase = 'play';
      save();
      startBed();
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      afterMove();
    });
  }

  function renderPlay() {
    const here = loc(S.at);
    const searched = S.searched.includes(S.at);
    const low = S.left <= 30;
    const last = (m) => (m >= S.left ? ' · ο χρόνος τελειώνει' : '');
    root.innerHTML = `<div class="demo-play">
      <div class="demo-bar">
        <div class="clock${low ? ' low' : ''}"><b>${fmt(S.left)}</b><span>απομένουν</span></div>
        <div class="clock"><b>${S.found.length}/${C.evidence.length}</b><span>στοιχεία</span></div>
        <button class="btn btn-small btn-ghost music" type="button" id="demoMusic" aria-pressed="${music}" aria-label="Μουσική">♪<span class="lbl"> Μουσική</span>${music ? ' ✓' : ''}</button>
        <i class="timebar" style="width:${(S.left / C.timeBudgetMinutes) * 100}%"></i>
      </div>
      <div class="toast" id="demoToast" role="status"></div>
      <div class="demo-main">
        <div class="place">
          <div class="place-img"><img src="media/img/${esc(SITE.images[here.id])}" alt="${esc(here.name)}"><span class="here">ΒΡΙΣΚΕΣΤΕ ΕΔΩ</span></div>
          <div class="place-body">
            <h3>${esc(here.name)}</h3>
            <p>${esc(here.description)}</p>
            ${searched
              ? '<p class="searched">✓ Το ερευνήσατε. Ό,τι βρήκατε είναι στα στοιχεία.</p>'
              : `<button class="btn btn-gold search-btn${here.searchMinutes >= S.left ? ' last' : ''}" type="button" id="demoSearch">Έρευνα · ${fmtCost(here.searchMinutes)}${last(here.searchMinutes)}</button>`}
          </div>
          <div class="go">
            <h4>Πού πάτε;</h4>
            ${mapSvg()}
            <ul class="go-list">${C.locations.filter((p) => p.id !== S.at).map((p) => {
              const m = travelCost(S.at, p.id);
              const done = S.searched.includes(p.id);
              const walk = loc(S.at).site && loc(S.at).site === p.site;
              return `<li><button class="go-item${m >= S.left ? ' last' : ''}" type="button" data-go="${p.id}">
                <span><b>${esc(p.name)}</b><small>${walk ? 'Με τα πόδια' : 'Με το αυτοκίνητο'} · ${done ? 'το ερευνήσατε' : 'δεν το έχετε ερευνήσει'}${last(m)}</small></span>
                <span class="cost">${fmtCost(m)}</span></button></li>`;
            }).join('')}</ul>
          </div>
        </div>
        <div class="side">
          <div class="ev">
            <h4>Στοιχεία</h4>
            ${S.found.length || S.fired.length ? '' : '<p class="ev-empty">Ό,τι βρείτε θα μπει εδώ. Ο φάκελος το διαβάζει δυνατά.</p>'}
            <ul class="ev-list">${C.calls.filter((c) => S.fired.includes(c.id)).map(voicemailItem).join('')}${S.found.map(evidenceItem).join('')}</ul>
            <h4 class="people-h">Πρόσωπα</h4>
            <ul class="people">${C.characters.filter((c) => S.known.includes(c.id)).map((c) => `<li class="${c.standing}"><b>${esc(c.name)}</b><small>${esc(c.role)}</small></li>`).join('')}</ul>
          </div>
          <div class="accuse-row">
            <button class="btn btn-blood btn-block" type="button" id="demoAccuse">Κατονομάστε τον ένοχο</button>
          </div>
        </div>
      </div></div>`;

    root.querySelector('#demoMusic').addEventListener('click', () => { music = !music; music ? startBed() : stopBed(); render(); });
    const sb = root.querySelector('#demoSearch');
    if (sb) sb.addEventListener('click', search);
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    root.querySelectorAll('.island-mini [data-node]').forEach((n) => n.addEventListener('click', () => { if (n.dataset.node !== S.at) go(n.dataset.node); }));
    root.querySelectorAll('[data-listen]').forEach((b) => b.addEventListener('click', () => listen(b)));
    root.querySelectorAll('[data-cctv]').forEach((b) => b.addEventListener('click', () => cctv(b.dataset.cctv)));
    root.querySelectorAll('[data-voicemail]').forEach((b) => b.addEventListener('click', () => openCall(b.dataset.voicemail, true)));
    root.querySelector('#demoAccuse').addEventListener('click', accuse);
  }

  function mapSvg() {
    const pos = SITE.map;
    const ids = C.locations.map((l) => l.id);
    const lines = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]];
        const [x1, y1] = pos[a];
        const [x2, y2] = pos[b];
        const from = a === S.at || b === S.at;
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${from ? '#C9A227' : '#3A434D'}" stroke-width="${from ? 2 : 1.5}" stroke-dasharray="${from ? '0' : '4 5'}"/>
          <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="${from ? '#C9A227' : '#5A616A'}">${travelCost(a, b)}′</text>`);
      }
    }
    const nodes = C.locations.map((p) => {
      const [x, y] = pos[p.id];
      const here = p.id === S.at;
      const done = S.searched.includes(p.id);
      return `<g data-node="${p.id}" style="cursor:${here ? 'default' : 'pointer'}" role="button" aria-label="${esc(p.name)}">
        <circle cx="${x}" cy="${y}" r="${here ? 11 : 8}" fill="${here ? '#C9A227' : done ? '#1C2229' : '#B3121D'}" stroke="${done && !here ? '#C9A227' : '#0B0D10'}" stroke-width="3"/>
        <text x="${x}" y="${y < 60 ? y - 17 : y + 27}" text-anchor="middle" font-family="Commissioner, sans-serif" font-size="13" font-weight="600" fill="${here ? '#E8E6E1' : '#8A9199'}">${esc(SITE.short[p.id] || p.name)}${done ? ' ✓' : ''}</text></g>`;
    }).join('');
    return `<svg class="island-mini" viewBox="0 0 320 170" width="100%" aria-label="Ο χάρτης της υπόθεσης">${lines.join('')}${nodes}</svg>`;
  }

  function evidenceItem(id) {
    const e = evid(id);
    const cam = SITE.cctv && SITE.cctv[id];
    return `<li class="ev-item${cam ? ' cam' : ''}"><b>${esc(e.title)}</b><p>${esc(e.text)}</p>
      <div class="ev-actions">${cam ? `<button class="listen" type="button" data-cctv="${id}">${NG.icons.PLAY} Δείτε την καταγραφή</button>` : ''}
      <button class="listen" type="button" data-listen="${SITE.audio.evidence[id]}">${NG.icons.PLAY} Ακούστε</button></div>
      <div class="progress" hidden><i></i></div></li>`;
  }

  function voicemailItem(call) {
    const missed = S.missed.includes(call.id) && !S.heard.includes(call.id);
    return `<li class="ev-item vm"><b>${missed ? '<span class="missed-dot"></span>Αναπάντητη κλήση' : 'Κλήση'} · ${esc(call.displayName)}</b>
      <p>${missed ? 'Σας άφησε μήνυμα στον τηλεφωνητή.' : 'Στον τηλεφωνητή, αν θέλετε να την ξανακούσετε.'}</p>
      <button class="listen" type="button" data-voicemail="${call.id}">${NG.icons.PLAY} ${missed ? 'Ακούστε το μήνυμα' : 'Ξανακούστε'}</button></li>`;
  }

  /* ---------- moves ---------- */
  function toast(text) {
    const t = root.querySelector('#demoToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function search() {
    const p = loc(S.at);
    S.searched.push(p.id);
    for (const id of p.evidenceIds) {
      if (!S.found.includes(id)) S.found.push(id);
      for (const c of evid(id).revealsCharacterIds || []) if (!S.known.includes(c)) S.known.push(c);
    }
    const alive = spend(p.searchMinutes);
    save();
    if (!alive) return finishTime();
    render();
    const named = p.evidenceIds.flatMap((id) => evid(id).revealsCharacterIds || []).map((c) => person(c).name);
    toast(`−${p.searchMinutes}′ · ${p.evidenceIds.length} στοιχεία${named.length ? ` · νέο πρόσωπο: ${named.join(', ')}` : ''}`);
    afterMove();
  }

  function go(id) {
    const m = travelCost(S.at, id);
    S.at = id;
    const alive = spend(m);
    save();
    if (!alive) return finishTime();
    render();
    toast(`−${m}′ · ${loc(id).name}`);
    afterMove();
  }

  function afterMove() {
    for (const call of due()) {
      S.fired.push(call.id);
      save();
      setTimeout(() => openCall(call.id, false), Math.max(1200, (call.delaySeconds || 0) * 1000));
      break; // one call at a time; the next waits for the next move
    }
  }

  // As the app does on its camera screen, a call that comes due while footage or
  // the accusation is open waits for it to close, then rings.
  let held = null;
  function releaseHeld() {
    if (!held) return;
    const id = held;
    held = null;
    setTimeout(() => openCall(id, false), 900);
  }

  let callBox = null;
  function openCall(callId, fromVoicemail) {
    if (S.phase !== 'play') return;
    if (!fromVoicemail && root.querySelector('.overlay')) { held = callId; return; }
    const call = C.calls.find((c) => c.id === callId);
    NG.stopAll();
    if (playing) playing.stop();
    bedVolume(0.03);
    const ov = overlay(`Κλήση από ${call.displayName}`);
    ov.innerHTML = '<div class="call-host"></div>';
    const close = () => { ov.remove(); callBox = null; bedVolume(0.14); render(); };
    callBox = new NG.Call(ov.firstChild, {
      name: call.displayName,
      sub: call.displaySubtitle,
      clip: call.audioKey,
      initial: call.displayName[0],
      missAfter: 30,
      onAnswer: () => { if (!S.heard.includes(call.id)) S.heard.push(call.id); save(); },
      onEnd: () => setTimeout(close, 900),
      onMissed: (timedOut) => {
        if (!S.missed.includes(call.id)) S.missed.push(call.id);
        save();
        close();
        toast(timedOut ? 'Δεν απάντησε κανείς. Σας περιμένει στον τηλεφωνητή.' : 'Απορρίψατε την κλήση. Είναι στον τηλεφωνητή.');
      },
    });
    if (fromVoicemail) callBox.answer('Τηλεφωνητής');
    else callBox.ring();
  }

  let playing = null;
  function listen(btn) {
    const li = btn.closest('.ev-item');
    const bar = li.querySelector('.progress');
    if (playing && playing.btn === btn) { playing.stop(); return; }
    if (playing) playing.stop();
    NG.stopAll();
    const a = NG.sound(`media/audio/${btn.dataset.listen}.mp3`);
    NG.setCurrent(a);
    bedVolume(0.04);
    bar.hidden = false;
    btn.classList.add('playing');
    btn.innerHTML = `${NG.icons.PLAY} Ακούγεται…`;
    const stop = () => {
      a.pause();
      bar.hidden = true;
      bar.firstChild.style.width = '0';
      btn.classList.remove('playing');
      btn.innerHTML = `${NG.icons.PLAY} Ακούστε`;
      bedVolume(0.14);
      if (playing && playing.btn === btn) playing = null;
    };
    a.addEventListener('timeupdate', () => { if (a.duration) bar.firstChild.style.width = `${(a.currentTime / a.duration) * 100}%`; });
    a.addEventListener('ended', stop);
    a.addEventListener('pause', () => { if (!a.ended) stop(); });
    a.play().catch(stop);
    playing = { btn, stop };
  }

  /** Security footage, as the app's camera screen: the camera's label, the date, a
   *  timecode that runs in real time and lands on the event as the clip ends. */
  function cctv(evidenceId) {
    const cam = SITE.cctv[evidenceId];
    const e = evid(evidenceId);
    NG.stopAll();
    if (playing) playing.stop();
    bedVolume(0.03);
    const ov = overlay(e.title);
    ov.innerHTML = `<div class="cctv">
      <div class="cctv-stage">
        <video src="${esc(cam.clip)}" poster="${esc(cam.clip.replace(/\.mp4$/, '.jpg'))}" muted playsinline preload="auto"></video>
        <div class="hud hud-top"><span class="rec"><i></i>REC</span><span>${esc(cam.camera)}</span></div>
        <div class="hud hud-bottom"><span class="tc" data-tc>&nbsp;</span><span>${esc(cam.date)}</span></div>
        <div class="cctv-event" hidden>${esc(cam.event)}</div>
      </div>
      <div class="cctv-caption">
        <p class="kicker">${esc(e.title)}</p>
        <p data-note>${esc(cam.coverage || 'Αναπαραγωγή καταγραφής…')}</p>
        <div class="demo-actions">
          <button class="btn btn-ghost" type="button" data-replay>↻ Ξανά από την αρχή</button>
          <button class="btn btn-ghost" type="button" data-close>Κλείσιμο</button>
        </div>
      </div></div>`;
    const v = ov.querySelector('video');
    const tc = ov.querySelector('[data-tc]');
    const banner = ov.querySelector('.cctv-event');
    const note = ov.querySelector('[data-note]');
    const [h, m, s] = cam.eventAt.split(':').map(Number);
    const to = h * 3600 + m * 60 + s;
    const pad = (n) => String(n).padStart(2, '0');
    const show = (sec) => { const w = Math.floor(sec); tc.textContent = `${pad(Math.floor(w / 3600))}:${pad(Math.floor(w / 60) % 60)}:${pad(w % 60)}`; };
    let raf = 0;
    const tick = () => {
      if (v.duration) show(to - (v.duration - v.currentTime));
      if (!v.paused && !v.ended) raf = requestAnimationFrame(tick);
    };
    const landed = () => { show(to); banner.hidden = false; note.textContent = e.text; };
    v.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
    v.addEventListener('loadedmetadata', () => show(to - v.duration));
    v.addEventListener('ended', landed);
    // Silent footage may start on its own anywhere; the property, not just the attribute.
    v.muted = true;
    v.playsInline = true;
    v.play().catch((err) => {
      // A play cut short (power saving, a tab coming forward) gets one more try.
      if (err && err.name === 'AbortError') setTimeout(() => v.play().catch(() => { v.controls = true; }), 400);
      else v.controls = true;
    });
    ov.querySelector('[data-replay]').addEventListener('click', () => {
      banner.hidden = true;
      note.textContent = cam.coverage || '';
      v.currentTime = 0;
      v.play().catch(() => {});
    });
    ov.querySelector('[data-close]').addEventListener('click', () => { cancelAnimationFrame(raf); v.pause(); ov.remove(); bedVolume(0.14); });
  }

  /* ---------- the answer ---------- */
  function accuse() {
    NG.stopAll();
    if (playing) playing.stop();
    const ov = overlay('Η κατηγορία');
    let who = null;
    let why = null;
    const nobody = C.solution.nobody;
    const step1 = () => {
      ov.innerHTML = `<div class="choose"><p class="kicker">Ερώτηση 1 από 2</p><h3>Ποιος το έκανε;</h3>
        <p>Διαλέξτε έναν από τους υπόπτους που γνωρίζετε.</p>
        <ul class="choices">${suspects().map((s) => `<li><button class="choice" type="button" data-who="${s.id}" aria-pressed="${who === s.id}"><b>${esc(s.name)}</b><small>${esc(s.role)}</small></button></li>`).join('')}
        ${nobody ? `<li><button class="choice" type="button" data-who="${NOBODY}" aria-pressed="${who === NOBODY}"><b>${esc(nobody.label)}</b><small>${esc(nobody.detail)}</small></button></li>` : ''}</ul>
        <div class="choose-actions"><button class="btn btn-blood" type="button" data-next ${who ? '' : 'disabled'}>${who === NOBODY ? 'Τελική απάντηση' : 'Συνέχεια'}</button>
        <button class="btn btn-ghost" type="button" data-back>Πίσω στην έρευνα</button></div>
        ${who === NOBODY ? '<p class="muted" style="margin-top:14px">Απαντάτε μία φορά. Δεν υπάρχει επιστροφή.</p>' : ''}</div>`;
      ov.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => { who = b.dataset.who; step1(); }));
      ov.querySelector('[data-next]').addEventListener('click', () => (who === NOBODY ? decide() : step2()));
      ov.querySelector('[data-back]').addEventListener('click', () => ov.remove());
    };
    const step2 = () => {
      const name = person(who).name;
      ov.innerHTML = `<div class="choose"><p class="kicker">Ερώτηση 2 από 2</p><h3>Γιατί;</h3>
        <p>Κατηγορείτε: <b>${esc(name)}</b>. Ποιος ήταν ο λόγος;</p>
        <ul class="choices">${visibleMotives().map((m) => `<li><button class="choice" type="button" data-why="${m.id}" aria-pressed="${why === m.id}"><b>${esc(m.text)}</b></button></li>`).join('')}</ul>
        <p class="muted" style="margin-bottom:16px">Απαντάτε μία φορά. Δεν υπάρχει επιστροφή.</p>
        <div class="choose-actions"><button class="btn btn-blood" type="button" data-final ${why ? '' : 'disabled'}>Τελική απάντηση</button>
        <button class="btn btn-ghost" type="button" data-prev>Αλλάξτε όνομα</button></div></div>`;
      ov.querySelectorAll('[data-why]').forEach((b) => b.addEventListener('click', () => { why = b.dataset.why; step2(); }));
      ov.querySelector('[data-prev]').addEventListener('click', step1);
      ov.querySelector('[data-final]').addEventListener('click', decide);
    };
    const decide = () => {
      S.accused = who;
      S.motive = who === NOBODY ? null : why;
      ov.remove();
      const o = outcome();
      const best = Math.max(...C.solution.tiers.map((t) => t.minScore));
      const cls = o.score >= best ? 'verdict-solved' : o.score > 0 ? 'verdict-half' : 'verdict-wrong';
      finish(o.tier.title, o.tier.text, SITE.audio.tiers[String(o.tier.minScore)], cls, o);
    };
    step1();
  }

  function finishTime() {
    finish(SITE.timeEnding.title, SITE.timeEnding.text, SITE.audio.time, 'verdict-time', null);
  }

  function finish(title, text, clip, cls, o) {
    if (callBox) callBox.destroy();
    stopBed();
    S.phase = 'end';
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing kept */ }
    if (!o) o = outcome();
    const firstCall = C.calls[0];
    const ov = overlay(title);
    ov.innerHTML = `<div class="ending"><p class="kicker">${cls === 'verdict-time' ? 'Η υπόθεση έκλεισε' : 'Η απάντησή σας'}</p>
      <h3 class="${cls}">${esc(title)}</h3>
      <div class="call-transcript" id="endText"></div>
      <div class="stats">
        <div><b>${fmt(S.left)}</b>στο ρολόι</div>
        <div><b>${o.held}/${o.total}</b>αποδείξεις</div>
        <div><b>${S.found.length}/${C.evidence.length}</b>στοιχεία</div>
        ${firstCall ? `<div><b>${S.heard.includes(firstCall.id) ? 'Ναι' : 'Όχι'}</b>ακούσατε την κλήση</div>` : ''}
      </div>
      <p class="muted" style="margin-bottom:20px">Οι υποθέσεις της εφαρμογής είναι μεγαλύτερες: δεκάδες μέρη, δεκάδες στοιχεία, κλήσεις που δεν περιμένετε, και μια ολόκληρη νύχτα.</p>
      <div class="demo-actions">
        <a class="btn btn-blood" href="#download">Κατεβάστε την εφαρμογή</a>
        <a class="btn btn-ghost" href="#cases">Οι πέντε υποθέσεις</a>
        <button class="btn btn-ghost" type="button" data-again>Παίξτε ξανά</button>
      </div></div>`;
    const box = ov.querySelector('#endText');
    box.textContent = text;
    setTimeout(() => NG.speak(box, clip), 500);
    const reset = () => { NG.stopAll(); S = fresh(); ov.remove(); render(); };
    ov.querySelector('[data-again]').addEventListener('click', () => { reset(); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    ov.querySelectorAll('a').forEach((a) => a.addEventListener('click', reset));
  }

  // The same rules, callable from the browser checks.
  NG.demoEngine = { travelCost, visibleMotives, outcome, state: () => S };

  render();
  if (S.phase === 'play') {
    // Back after a reload: the music waits for the first touch.
    window.addEventListener('pointerdown', () => S.phase === 'play' && startBed(), { once: true });
  }
})();
