/*
 * Everything that changes per launch lives here — fill it in and the page follows.
 * Empty values stay hidden (no dead links): a store button appears once its link
 * is set, a social icon once its profile is set.
 */
window.NG_CONFIG = {
  // The bought domain, with https:// and no trailing slash, e.g. 'https://example.cy'.
  // Used for the canonical link and the share image (social previews need full URLs).
  domain: 'https://nekrigrammi.com',

  // Store pages. Until one is set the page says «σύντομα».
  stores: {
    android: '', // https://play.google.com/store/apps/details?id=...
    ios: '',     // https://apps.apple.com/...
  },

  // Profile links. Any left empty is not shown.
  social: {
    instagram: 'https://www.instagram.com/nekrigrammi/',
    tiktok: 'https://www.tiktok.com/@nekrigrammi',
    facebook: 'https://www.facebook.com/profile.php?id=61595094895651',
    youtube: '',
    x: '',
  },

  // The contact address shown on the page (footer and FAQ). Mail to it is forwarded
  // to the team's Gmail, which is never shown on the page.
  email: 'info@nekrigrammi.com',
};
