/*
 * The call, as the app has it: it rings on its own, «Απάντηση» or «Απόρριψη», the
 * words come up as they are said, and a call nobody answers goes to the voicemail.
 * Used by the phone in the hero and by the mini-case.
 */
(function () {
  const NG = (window.NG = window.NG || {});
  const PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>';
  const PERSON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z"/></svg>';
  NG.icons = { PHONE, PERSON, PLAY: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>' };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  NG.esc = esc;

  // One sound at a time: a new voice stops whatever was speaking.
  let current = null;
  NG.stopAll = () => {
    if (current) { current.pause(); current = null; }
  };
  NG.setCurrent = (a) => { current = a; };
  NG.sound = (src, { loop = false, volume = 1 } = {}) => {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = volume;
    a.preload = 'auto';
    return a;
  };

  /** Words of a timed clip, revealed (or lit) as they are spoken. */
  NG.karaoke = function (box, key, audio, { mode = 'reveal', onDone } = {}) {
    const t = (window.NG_TIMINGS || {})[key];
    const words = t ? t.words : [];
    box.classList.toggle('sweep', mode === 'sweep');
    box.innerHTML = words.map(([w], i) => `<span class="w" data-i="${i}">${esc(w)}</span>`).join(' ');
    const spans = [...box.querySelectorAll('.w')];
    let raf = 0;
    let shown = -1;
    const tick = () => {
      const now = audio.currentTime + 0.08;
      let n = shown;
      while (n + 1 < words.length && words[n + 1][1] <= now) n++;
      if (n !== shown) {
        for (let i = shown + 1; i <= n; i++) spans[i].classList.add('on');
        shown = n;
        const last = spans[n];
        if (last && box.scrollHeight > box.clientHeight) {
          const target = last.offsetTop - box.clientHeight * 0.55;
          box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        }
      }
      if (!audio.paused && !audio.ended) raf = requestAnimationFrame(tick);
    };
    const all = () => spans.forEach((s) => s.classList.add('on'));
    const reset = () => { spans.forEach((s) => s.classList.remove('on')); shown = -1; box.scrollTop = 0; };
    audio.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
    audio.addEventListener('ended', () => { all(); if (onDone) onDone(); });
    return {
      showAll: all,
      reset,
      stop() { cancelAnimationFrame(raf); },
    };
  };

  /**
   * Plays a timed clip. A browser that refuses sound until the page is touched gets
   * the whole text at once and a button that starts the voice from the beginning.
   */
  NG.speak = function (box, key, { mode = 'reveal', onDone } = {}) {
    NG.stopAll();
    const audio = NG.sound(`media/audio/${key}.mp3`);
    current = audio;
    const k = NG.karaoke(box, key, audio, { mode, onDone });
    audio.play().catch(() => {
      k.showAll();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'listen unmute';
      b.innerHTML = `${NG.icons.PLAY} Ακούστε`;
      box.prepend(b);
      b.addEventListener('click', () => {
        b.remove();
        k.reset();
        current = audio;
        audio.currentTime = 0;
        audio.play().catch(() => k.showAll());
      });
    });
    return { audio, stop() { audio.pause(); k.stop(); if (current === audio) current = null; } };
  };

  let ringer = null;
  const vibrate = (on) => {
    // Browsers refuse (and log) a vibration before the visitor has touched the page.
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    try { if (navigator.vibrate && touched) navigator.vibrate(on ? [500, 300, 500, 300, 500] : 0); } catch (e) { /* not on this device */ }
  };

  /**
   * new NG.Call(root, { name, sub, clip, label, voicemail, onEnd, onMissed, missAfter })
   * root is emptied and filled with the call screen.
   */
  NG.Call = class {
    constructor(root, opts) {
      this.root = root;
      this.o = Object.assign({ label: 'Εισερχόμενη κλήση', missAfter: 30, sound: true }, opts);
      this.state = 'idle';
      this.timer = 0;
    }

    head(label, extra = '') {
      const o = this.o;
      return `<p class="call-label">${esc(label)}</p>
        <div class="call-avatar">${o.initial ? esc(o.initial) : PERSON}</div>
        <p class="call-name">${esc(o.name)}</p>
        ${o.sub ? `<p class="call-sub">${esc(o.sub)}</p>` : ''}${extra}`;
    }

    ring() {
      this.state = 'ringing';
      const r = this.root;
      r.innerHTML = `<div class="call ringing">${this.head(this.o.label)}
        <div class="call-spacer"></div>
        <div class="call-actions">
          <button class="call-btn decline" type="button" data-act="decline"><i>${PHONE}</i>Απόρριψη</button>
          <button class="call-btn answer wiggle" type="button" data-act="answer"><i>${PHONE}</i>Απάντηση</button>
        </div></div>`;
      r.querySelector('[data-act=answer]').addEventListener('click', () => this.answer());
      r.querySelector('[data-act=decline]').addEventListener('click', () => this.decline());
      if (this.o.sound) {
        NG.stopAll();
        if (ringer) ringer.pause();
        ringer = NG.sound('media/audio/ringtone.mp3', { loop: true, volume: 0.6 });
        ringer.play().catch(() => {
          // No sound before the visitor has touched the page: the first touch starts it.
          const late = () => { if (this.state === 'ringing' && ringer) ringer.play().catch(() => {}); };
          window.addEventListener('pointerdown', late, { once: true, capture: true });
        });
      }
      vibrate(true);
      clearTimeout(this.miss);
      if (this.o.missAfter) this.miss = setTimeout(() => this.state === 'ringing' && this.decline(true), this.o.missAfter * 1000);
      if (this.o.onRing) this.o.onRing();
    }

    silence() {
      clearTimeout(this.miss);
      if (ringer) { ringer.pause(); ringer = null; }
      vibrate(false);
    }

    answer(label = 'Σε κλήση') {
      this.silence();
      this.state = 'call';
      const r = this.root;
      r.innerHTML = `<div class="call in-call">${this.head(label, '<p class="call-timer" data-timer>00:00</p>')}
        <div class="call-transcript" aria-live="polite"></div>
        <div class="call-actions"><button class="call-btn hangup" type="button" data-act="hangup"><i>${PHONE}</i>Τερματισμός</button></div></div>`;
      const t0 = Date.now();
      const clock = r.querySelector('[data-timer]');
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 500);
      r.querySelector('[data-act=hangup]').addEventListener('click', () => this.hangup());
      this.voice = NG.speak(r.querySelector('.call-transcript'), this.o.clip, {
        onDone: () => setTimeout(() => this.state === 'call' && this.hangup(true), 1200),
      });
      if (this.o.onAnswer) this.o.onAnswer();
    }

    hangup(finished = false) {
      clearInterval(this.timer);
      if (this.voice) this.voice.stop();
      this.state = 'ended';
      NG.sound('media/audio/hangup.mp3', { volume: 0.7 }).play().catch(() => {});
      if (this.o.onEnd) this.o.onEnd(finished);
    }

    decline(timedOut = false) {
      this.silence();
      this.state = 'missed';
      if (this.o.onMissed) this.o.onMissed(timedOut);
    }

    destroy() {
      this.silence();
      clearInterval(this.timer);
      if (this.voice) this.voice.stop();
    }
  };
})();
