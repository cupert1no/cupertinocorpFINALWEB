/* Cupertino Corp — global radio engine.
   A single shared <audio> element + state, persisted to localStorage so playback
   resumes as the visitor moves between pages. Idempotent: safe to load on every page.

   The library is organised into RELEASES (the rolling radio + a set of EPs). Each
   release owns its own ordered list of tracks. The engine keeps a current release
   index + a current track index inside it; next/prev wrap inside the active release. */
(function () {
  if (window.__ccRadio) return;

  var A = 'assets/audio/';
  // Placeholder audio: the three real files are reused as stand-in sources so the
  // EP placeholders are genuinely playable while you preview how a release behaves.
  var S1 = A + 'purelink-first-iota.mp3';
  var S2 = A + '33-new-adhd.mp3';
  var S3 = A + 'boards-of-canada-age-of-capricorn.mp3';

  // Fallback catalog. The live catalog is loaded from content/audio.json (editable
  // with the CMS) and hot-swaps this list once fetched — see the fetch() at the end.
  var RELEASES = [
    {
      id: 'radio', type: 'RADIO', title: 'Cupertino Radio · Vol. 001', year: '2026',
      art: 'assets/img/device/dscf0594.jpg',
      tracks: [
        { title: 'First Iota',       artist: 'Purelink',         src: S1 },
        { title: 'New ADHD',         artist: '33',               src: S2 },
        { title: 'Age of Capricorn', artist: 'Boards of Canada', src: S3 },
      ]
    },
    {
      id: 'costa-sur', type: 'EP', title: 'Costa Sur', year: '2026',
      art: 'assets/img/device/dscf0920.jpg',
      tracks: [
        { title: 'Costa Sur',           artist: 'Cupertino Corp', src: S1 },
        { title: 'Neón en la Niebla',   artist: 'Cupertino Corp', src: S2 },
        { title: 'Hora Azul',           artist: 'Cupertino Corp', src: S3 },
        { title: 'Reflejo',             artist: 'Cupertino Corp', src: S1 },
        { title: 'Costa Sur (Reprise)', artist: 'Cupertino Corp', src: S2 },
      ]
    },
    {
      id: 'noche-interior', type: 'EP', title: 'Noche Interior', year: '2025',
      art: 'assets/img/device/dscf0533.jpg',
      tracks: [
        { title: 'Noche Interior', artist: 'Cupertino Corp', src: S3 },
        { title: 'Luz de Sodio',   artist: 'Cupertino Corp', src: S1 },
        { title: 'Periférico',     artist: 'Cupertino Corp', src: S2 },
        { title: 'Madrugada',      artist: 'Cupertino Corp', src: S3 },
      ]
    },
  ];

  var ACCENTS = { 'Silver': '#d0d0d2', 'Nothing red': '#ff3b30', 'None': 'rgba(255,255,255,0.88)' };
  var KEY = 'cc-radio-v2';

  function noop() {}

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}

  var relIdx = Math.min(RELEASES.length - 1, Math.max(0, saved.relIdx | 0));
  var idx    = Math.min(RELEASES[relIdx].tracks.length - 1, Math.max(0, saved.idx | 0));
  var vol    = typeof saved.vol === 'number' ? saved.vol : 0.8;
  var accent = ACCENTS[saved.accent] ? saved.accent : 'Silver';
  var durs   = {};               // "relIdx:idx" -> duration seconds (filled as tracks load)
  var pendingSeek = saved.pos || 0;
  var openReq = 0;               // bumps whenever a release is picked (UI opens the sheet)

  function tracks() { return RELEASES[relIdx].tracks; }
  function cur() { return tracks()[idx]; }
  function durKey() { return relIdx + ':' + idx; }

  var audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = vol;
  audio.src = cur().src;

  var listeners = new Set();
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var lastSave = 0;
  function persist(force) {
    var now = Date.now();
    if (!force && now - lastSave < 1200) return;
    lastSave = now;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        relIdx: relIdx, idx: idx, pos: audio.currentTime || 0,
        vol: vol, accent: accent, playing: !audio.paused
      }));
    } catch (e) {}
  }

  audio.addEventListener('loadedmetadata', function () {
    durs[durKey()] = audio.duration || 0;
    if (pendingSeek && pendingSeek < (audio.duration || 0)) {
      try { audio.currentTime = pendingSeek; } catch (e) {}
    }
    pendingSeek = 0;
    emit();
  });
  audio.addEventListener('timeupdate', function () { persist(false); emit(); });
  audio.addEventListener('play',  function () { persist(true); emit(); });
  audio.addEventListener('pause', function () { persist(true); emit(); });
  audio.addEventListener('ended', function () { loadIdx(idx + 1, true); });
  window.addEventListener('pagehide', function () { persist(true); });
  window.addEventListener('beforeunload', function () { persist(true); });

  function loadIdx(i, play) {
    var t = tracks();
    idx = (i % t.length + t.length) % t.length;
    pendingSeek = 0;
    audio.src = t[idx].src;
    persist(true);
    if (play) audio.play().catch(noop);
    emit();
  }

  function selectRelease(ri, play) {
    ri = (ri % RELEASES.length + RELEASES.length) % RELEASES.length;
    openReq++;                       // signal the UI to surface the player
    if (ri === relIdx) {
      if (play) audio.play().catch(noop);
      emit();
      return;
    }
    relIdx = ri;
    idx = 0;
    pendingSeek = 0;
    audio.src = cur().src;
    persist(true);
    if (play !== false) audio.play().catch(noop);
    emit();
  }

  // current-release durations keyed by local track index, for UI
  function localDurs() {
    var out = {};
    var t = tracks();
    for (var i = 0; i < t.length; i++) {
      var d = durs[relIdx + ':' + i];
      if (d) out[i] = d;
    }
    return out;
  }

  function relMeta(r) {
    return { id: r.id, type: r.type, title: r.title, year: r.year, art: r.art, count: r.tracks.length };
  }

  var api = {
    accents: Object.keys(ACCENTS),
    accentHexOf: function (name) { return ACCENTS[name] || ACCENTS.Silver; },
    accentHex: function () { return ACCENTS[accent] || ACCENTS.Silver; },
    get releases() { return RELEASES.map(relMeta); },
    get catalog() { return tracks(); },          // tracks of the active release
    get relIdx() { return relIdx; },
    getState: function () {
      var t = cur();
      return {
        relIdx: relIdx, release: relMeta(RELEASES[relIdx]),
        idx: idx, track: { title: t.title, artist: t.artist, art: t.art || RELEASES[relIdx].art },
        playing: !audio.paused,
        pos: audio.currentTime || 0, dur: audio.duration || durs[durKey()] || 0,
        vol: vol, accent: accent, durs: localDurs(), openReq: openReq
      };
    },
    subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
    getAudioEl: function () { return audio; },
    play:   function () { audio.play().catch(noop); },
    pause:  function () { audio.pause(); },
    toggle: function () { if (audio.paused) audio.play().catch(noop); else audio.pause(); },
    select: function (i, play) { if (i === idx) { api.toggle(); } else { loadIdx(i, play !== false); } },
    selectRelease: selectRelease,
    next:   function (play) { loadIdx(idx + 1, play !== false); },
    prev:   function (play) { loadIdx(idx - 1, play !== false); },
    seekFraction: function (f) {
      var d = audio.duration || 0;
      if (d) { audio.currentTime = Math.max(0, Math.min(1, f)) * d; persist(true); emit(); }
    },
    setVol: function (v) { vol = Math.max(0, Math.min(1, v)); audio.volume = vol; persist(true); emit(); },
    setAccent: function (a) { if (ACCENTS[a]) { accent = a; persist(true); emit(); } }
  };

  // Best-effort resume: if the visitor was playing on the previous page, try to keep going.
  // Browsers may block autoplay until the first interaction on this page — then it resumes on play().
  if (saved.playing) { audio.play().catch(noop); }

  window.__ccRadio = api;

  // Load the editable catalog and hot-swap it in. Falls back silently to the
  // built-in RELEASES above if the file is missing or malformed.
  fetch('content/audio.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !Array.isArray(d.releases) || !d.releases.length) return;
      var next = d.releases.map(function (r) {
        return {
          id: r.id, type: r.type, title: r.title, year: String(r.year || ''), art: r.art,
          tracks: (r.tracks || []).map(function (t) { return { title: t.title, artist: t.artist, src: t.src }; })
        };
      }).filter(function (r) { return r.tracks.length; });
      if (!next.length) return;
      RELEASES = next;
      relIdx = Math.min(RELEASES.length - 1, Math.max(0, relIdx));
      idx = Math.min(RELEASES[relIdx].tracks.length - 1, Math.max(0, idx));
      // Only realign the source if playback hasn't started yet, to avoid interrupting audio.
      if (audio.paused && (audio.currentTime || 0) === 0) {
        try { audio.src = cur().src; } catch (e) {}
      }
      emit();
    })
    .catch(function () {});
})();
