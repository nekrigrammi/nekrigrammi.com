# Νεκρή Γραμμή — the website

A static site (plain HTML, CSS and JavaScript, no build step) for the game. It works
on phones and desktops and has no server code, so any static host will do.

What is on it:

- **The site rings.** A phone in the hero gets a call from an unknown number. Answer
  it and you hear a voice (Picsart, Nikos), with the words appearing as they are
  spoken. Decline it and it goes to voicemail, then rings once more later. On a phone
  the call also slides down from the top of the screen, like a real one.
- **A playable mini-case**, «Ο Φούρνος της Γωνίας». It plays by the app's own rules:
  - a two-hour clock, with drives, walks and searches that cost minutes;
  - running out of time closes the case;
  - a call that rings partway through, and goes to voicemail if declined;
  - a suspect who appears only once found, and a reason that appears only once earned;
  - clues read aloud by the narrator (Theos), plus the kiosk's CCTV clip with its camera overlay;
  - a verdict scored exactly as the app scores it.
- **The five cases** on a map of Cyprus, each with its file and its intro film.
- **The roles**, plus a dealer that hands them out to the group's names.
- How to play (with the how-to-play film), the app's features, a FAQ, and the store
  and social links.

## Before it goes live: `js/config.js`

The domain (nekrigrammi.com) and the Instagram, Facebook and TikTok profiles are
set (02/10/2026). Still to come: the store links. Anything left empty stays hidden,
and until a store link is set its button reads «Σύντομα».

```js
domain: 'https://your-domain',        // no trailing slash
stores: { android: '…', ios: '…' },
social: { instagram: '…', tiktok: '…', facebook: '…', youtube: '…', x: '…' },
email: '',
```

Link previews on Facebook, WhatsApp and Instagram do not run JavaScript, so the share
tags in `index.html` (canonical, og:url, og:image, twitter:image) carry the domain
written out, as do `sitemap.xml` and `robots.txt`. If the domain ever changes, change
it there too.

## Deploying

Upload everything **except** `tools/`, `src-img/`, `src-audio/` and `content/`. Those
are working files: the page reads its data from `js/data.js`. Any static host works,
for example Netlify, Cloudflare Pages, GitHub Pages or plain web hosting. Point the
domain at it and turn on HTTPS. The page is about 17 MB, mostly the films, and only
the hero loads up front; the rest loads as the visitor gets to it.

To preview locally:

```bash
node tools/serve.cjs 8090
```

## Changing things

| To change | Edit | Then run |
|---|---|---|
| A case's title, teaser or age note | the game's `assets/scenario/case-0N.json` | `python tools/build_data.py` |
| The mini-case (anything) | `content/demo-case.json` (the app's own case format) | `python tools/build_data.py`, then `node tools/check-demo.mjs` |
| A line that is spoken | the text, then a new take on Picsart (`python tools/voice_script.py <take>` puts the prompt on file) | `tools/cut_site.py <take> <mp3>` |

`node tools/check-demo.mjs` runs the game's own checks, `validate-case.js` and
`simulate-case.mjs`, on the mini-case, then checks the site's media. A spoken line
whose text has changed since it was recorded fails that check, until it is recorded
again.

## Credits

- Pictures of the mini-case, the hero image, all voices and the CCTV clip were made
  for the game on Picsart.
- Case covers come from the game's own pictures (the owned ones only, so no
  attribution is needed).
- Brand icons are from Simple Icons (CC0).
- Fonts: Commissioner and JetBrains Mono (Google Fonts, OFL).
