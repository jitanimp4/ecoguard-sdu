/* EcoGuard SDU – main app: screens, rooms, personalisation, mascot, timers, badges. */
(function () {
  const R = window.EcoRules, W = window.EcoWeather, S = window.EcoScan;
  const KEY = 'ecoguard.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- state ---------- */
  const newRoom = (name, type = 'sdu') => ({ id: uid(), name, type, checkins: [], scans: [], fixes: {}, lastLevel: null });
  const defaults = () => ({
    lang: 'en', voice: 'auto', demo: true, senior: false, keepPhotos: false,
    profile: { done: false, name: '', home: 'sdu', people: [], appl: ['dehum'] },
    rooms: [], active: null, timer: null, away: null, badges: [], stats: { timers: 0, greens: 0 },
    dewy: { skin: 'mint', acc: 'sprout' },
  });
  let st = load();
  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { s = {}; }
    const d = defaults();
    const out = { ...d, ...s, profile: { ...d.profile, ...(s.profile || {}) }, stats: { ...d.stats, ...(s.stats || {}) }, dewy: { ...d.dewy, ...(s.dewy || {}) } };
    if (!out.rooms || !out.rooms.length) {            // migrate single-room data from the first version
      const r = newRoom(out.lang === 'zh' ? '我的房間' : 'My room');
      r.checkins = s.checkins || []; r.scans = s.scans || []; r.fixes = s.fixes || {};
      out.rooms = [r];
    }
    delete out.checkins; delete out.scans; delete out.fixes;
    if (!out.rooms.find(r => r.id === out.active)) out.active = out.rooms[0].id;
    return out;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage full or blocked */ } }
  let weather = null, view = 'home', sub = null, scanFiles = [], scanning = false, checkMode = null, answers = {};
  let obStep = 0, addingRoom = false, dewyTip = 0, enterNext = true, previewMood = null;
  const L = (en, zh) => st.lang === 'zh' ? zh : en;
  const T = () => window.I18N[st.lang];
  const room = () => st.rooms.find(r => r.id === st.active);
  const rn = r => ['My room', '我的房間'].includes(r.name) ? T().defaultRoom : ['Mum’s flat', '媽媽的家'].includes(r.name) ? (st.lang === 'zh' ? '媽媽的家' : 'Mum’s flat') : r.name;
  const sensitive = () => st.profile.people.some(p => ['elderly', 'asthma', 'kids'].includes(p));
  const hasDryer = () => st.profile.appl.some(a => a === 'dehum' || a === 'ac');

  /* ---------- icons ---------- */
  const I = {
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s2 5-2 7M14 12c4 0 7 1 7 4s-5 2-7-2M12 14c0 4-1 7-4 7s-2-5 2-7M10 12c-4 0-7-1-7-4s5-2 7 2"/>',
    ok: '<path d="M20 6L9 17l-5-5"/>',
    check: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5l2 2 3.5-4"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    plane: '<path d="M2 16l20-8-4 12-5-4-3 4v-5l9-7-11 6z"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6M12 12.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 14.8l2-.3z"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2 2 3 0-2 .5-4 1-6z"/>',
  };
  const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  /* ---------- mascot: Dewy (skins + accessories + animation) ---------- */
  const SKINS = {
    mint: { c: ['#7DF9D9', '#26CFA9'], en: 'Mint', zh: '薄荷' },
    sky: { c: ['#A6E6FF', '#4D9DFF'], en: 'Sky', zh: '天空' },
    bubblegum: { c: ['#FFC0E3', '#FF5FAE'], en: 'Bubblegum', zh: '香口膠' },
    lilac: { c: ['#DCCBFF', '#9470FF'], en: 'Lilac', zh: '紫丁香' },
    peach: { c: ['#FFD2B3', '#FF8A6E'], en: 'Peach', zh: '蜜桃' },
    sunset: { c: ['#FFE07A', '#FF6FA3'], en: 'Sunset', zh: '日落', need: 'badges3' },
    galaxy: { c: ['#8E6BFF', '#22185E'], en: 'Galaxy', zh: '銀河', need: 'badges4', stars: true },
    rainbow: { c: ['#FF8FB1', '#FFD36E', '#6FF7C8', '#7AB8FF', '#B69CFF'], en: 'Rainbow', zh: '彩虹', need: 'green' },
  };
  const ACCS = {
    none: { en: 'None', zh: '無' },
    sprout: { en: 'Eco sprout', zh: '小嫩芽' },
    shades: { en: 'Cool shades', zh: '太陽眼鏡' },
    headphones: { en: 'Headphones', zh: '耳筒' },
    bow: { en: 'Bow', zh: '蝴蝶結' },
    party: { en: 'Party hat', zh: '派對帽' },
    beanie: { en: 'Beanie', zh: '冷帽' },
    crown: { en: 'Crown', zh: '皇冠', need: 's7' },
  };
  const unlocked = need => !need ? true : need === 'badges3' ? st.badges.length >= 3 : need === 'badges4' ? st.badges.length >= 4 : st.badges.includes(need);
  const needText = need => ({ badges3: L('Earn 3 badges', '獲得 3 個徽章'), badges4: L('Earn 4 badges', '獲得 4 個徽章'), green: L('Get back to Green', '回到綠色'), s7: L('7-day streak', '連續 7 天') }[need]);
  const ACC_SVG = {
    none: '', 
    sprout: '<path d="M36 6 q0 -6 0 -8" stroke="#2E9E5B" stroke-width="2.4" stroke-linecap="round"/><path d="M36 -2 q-10 -8 -14 0 q8 4 14 0z" fill="#5BE08A"/><path d="M36 -2 q9 -10 15 -3 q-7 6 -15 3z" fill="#3CCB72"/>',
    shades: '<g><rect x="19" y="31" width="15" height="11" rx="5" fill="#1B1646"/><rect x="38" y="31" width="15" height="11" rx="5" fill="#1B1646"/><path d="M34 35 h4" stroke="#1B1646" stroke-width="2.5"/><path d="M22 33.5 l5 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><path d="M41 33.5 l5 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></g>',
    headphones: '<path d="M13 40 C13 14 59 14 59 40" stroke="#FF7AC6" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="7" y="35" width="10" height="16" rx="5" fill="#FF7AC6"/><rect x="55" y="35" width="10" height="16" rx="5" fill="#FF7AC6"/><rect x="9" y="38" width="4" height="10" rx="2" fill="#fff" opacity=".5"/>',
    bow: '<g transform="translate(47 17) rotate(25)"><path d="M0 0 L-10 -7 L-10 7z" fill="#FF5FAE"/><path d="M0 0 L10 -7 L10 7z" fill="#FF5FAE"/><circle r="3.2" fill="#FFC0E3"/></g>',
    party: '<g transform="rotate(-12 36 10)"><path d="M27 15 L36 -10 L45 15z" fill="#FFC857"/><path d="M30 7 L42 7 M28.5 11 L43.5 11 M32 2 L40 2" stroke="#FF5FAE" stroke-width="2.2"/><circle cx="36" cy="-11" r="3.5" fill="#7AD3FF"/></g>',
    beanie: '<path d="M22 20 q14 -22 28 0z" fill="#7AD3FF"/><rect x="20" y="17" width="32" height="6" rx="3" fill="#4D9DFF"/><circle cx="36" cy="5" r="4" fill="#fff"/>',
    crown: '<path d="M24 18 L25 5 L31 11 L36 2 L41 11 L47 5 L48 18z" fill="#FFD36E" stroke="#E9A23B" stroke-width="1.5" stroke-linejoin="round"/><circle cx="36" cy="13" r="2" fill="#FF6B8B"/><circle cx="29" cy="14" r="1.5" fill="#7AD3FF"/><circle cx="43" cy="14" r="1.5" fill="#4BF3A0"/>',
  };
  let dewyN = 0;
  function dewy(mood, size = 72, look = st.dewy) {
    const id = 'dg' + (++dewyN), sk = SKINS[look.skin] || SKINS.mint, ink = sk.stars ? '#FFFFFF' : '#1B1646';
    const stops = sk.c.map((c, i) => `<stop offset="${i / (sk.c.length - 1)}" stop-color="${c}"/>`).join('');
    const mouth = { happy: 'M27 45 q9 9 18 0', worried: 'M28 49 q8 -5 16 0', alarmed: 'M31 45 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0', calm: 'M29 46 q7 4 14 0' }[mood];
    const brows = mood === 'worried' ? `<path d="M22 29 l8 -3 M50 29 l-8 -3" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`
      : mood === 'alarmed' ? `<path d="M22 26 l8 3 M50 26 l-8 3" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>` : '';
    const sweat = mood === 'alarmed' || mood === 'worried' ? '<path d="M60 20 q3.5 6 0 9 q-3.5 -3 0 -9z" fill="#A6E6FF"/>' : '';
    const stars = sk.stars ? '<g fill="#fff"><circle cx="22" cy="52" r="1"/><circle cx="48" cy="58" r="1.2"/><circle cx="52" cy="44" r=".9"/><circle cx="30" cy="22" r=".8"/><circle cx="40" cy="62" r=".8"/></g>' : '';
    const shades = look.acc === 'shades';
    const eyes = shades ? '' : mood === 'happy'
      ? `<g class="d-eyes"><circle cx="28" cy="37" r="4" fill="${ink}"/><circle cx="44" cy="37" r="4" fill="${ink}"/><circle cx="29.5" cy="35.5" r="1.5" fill="${sk.stars ? '#22185E' : '#fff'}"/><circle cx="45.5" cy="35.5" r="1.5" fill="${sk.stars ? '#22185E' : '#fff'}"/></g>`
      : `<g class="d-eyes"><circle cx="28" cy="37" r="3.6" fill="${ink}"/><circle cx="44" cy="37" r="3.6" fill="${ink}"/><circle cx="29.3" cy="35.8" r="1.2" fill="${sk.stars ? '#22185E' : '#fff'}"/><circle cx="45.3" cy="35.8" r="1.2" fill="${sk.stars ? '#22185E' : '#fff'}"/></g>`;
    const behind = look.acc === 'headphones' ? ACC_SVG.headphones : '';
    const front = look.acc === 'headphones' ? '' : (ACC_SVG[look.acc] || '');
    return `<svg class="dewy dewy-${mood}" width="${size}" height="${size}" viewBox="-4 -14 80 88" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0.3" y2="1">${stops}</linearGradient></defs>
      <ellipse cx="36" cy="72" rx="18" ry="3" fill="#000" opacity=".18"/>
      <g class="d-body">${behind}
      <path d="M36 4 C36 4 12 30 12 46 a24 24 0 0 0 48 0 C60 30 36 4 36 4z" fill="url(#${id})"/>${stars}
      <ellipse cx="25" cy="30" rx="4" ry="8" fill="#fff" opacity=".45" transform="rotate(20 25 30)"/>
      ${eyes}${brows}<path d="${mouth}" stroke="${ink}" stroke-width="3" fill="${mood === 'alarmed' ? ink : mood === 'happy' ? '#FF7A93' : 'none'}" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="20" cy="45" r="4" fill="#FF6FA3" opacity=".45"/><circle cx="52" cy="45" r="4" fill="#FF6FA3" opacity=".45"/>${sweat}${front}</g></svg>`;
  }
  const moodOf = lvl => ({ green: 'happy', amber: 'worried', red: 'alarmed' }[lvl] || 'calm');

  /* ---------- derived ---------- */
  const latest = arr => arr.length ? arr[arr.length - 1] : null;
  function current(r = room()) {
    const c = latest(r.checkins), scan = latest(r.scans);
    const indoorRH = c ? c.rh : undefined;
    const idx = R.moldIndex({ indoorRH, history: r.checkins, scan, sensitive: sensitive() });
    const rainLikely = weather ? (weather.raining || ['Medium High', 'High'].includes(weather.days?.[0]?.psr)) : false;
    const act = R.ecoDry({ indoorRH, outdoorRH: weather?.rh, rainLikely, sensitive: sensitive(), hasDryer: hasDryer() });
    return { c, scan, idx, act };
  }
  function actionText(act) {
    const t = T();
    if (act.action === 'dehumidify') return t['act_dehumidify_' + act.hours];
    return t['act_' + act.action];
  }
  function fixesProgress(r, scan) {
    if (!scan) return { done: 0, total: 0 };
    let done = 0, total = 0;
    scan.issues.forEach(i => i.fixes.forEach((_, k) => { total++; if (r.fixes[i.id]?.[k]) done++; }));
    return { done, total };
  }
  const allCheckinTimes = () => st.rooms.flatMap(r => r.checkins.map(c => c.t));
  const awayState = () => {
    if (!st.away) return null;
    const until = new Date(st.away.until + 'T23:59:59').getTime();
    return Date.now() <= until ? 'away' : 'back';
  };

  /* ---------- badges ---------- */
  const BADGES = ['first', 's3', 's7', 'scan', 'fixes', 'green', 'window', 'travel'];
  function earnedBadges() {
    const sk = R.streak(allCheckinTimes());
    const any = f => st.rooms.some(f);
    return {
      first: allCheckinTimes().length > 0,
      s3: sk >= 3 || st.badges.includes('s3'),
      s7: sk >= 7 || st.badges.includes('s7'),
      scan: any(r => r.scans.length > 0),
      fixes: any(r => { const s = latest(r.scans); const p = fixesProgress(r, s); return p.total > 0 && p.done === p.total; }) || st.badges.includes('fixes'),
      green: st.stats.greens > 0,
      window: st.stats.timers > 0,
      travel: st.badges.includes('travel'),
    };
  }
  function checkBadges() {
    const e = earnedBadges(), t = T();
    BADGES.forEach(b => {
      if (e[b] && !st.badges.includes(b)) { st.badges.push(b); toast(t.newBadge(t['b_' + b][0])); }
    });
  }
  function trackLevel(r) {
    const { idx } = current(r);
    if (r.lastLevel && r.lastLevel !== 'green' && idx.level === 'green') { st.stats.greens++; celebrate(); toast(T().celebrate); }
    r.lastLevel = idx.level;
  }

  /* ---------- effects ---------- */
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function celebrate() {
    if (reduced()) return;
    const c = document.createElement('canvas'); c.className = 'confetti';
    c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
    const g = c.getContext('2d'), cols = ['#4BF3C8', '#FF7AC6', '#FFC857', '#7AD3FF', '#B69CFF'];
    const ps = Array.from({ length: 90 }, () => ({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - .5) * 12, vy: Math.random() * -12 - 2, s: 4 + Math.random() * 5, c: cols[Math.random() * cols.length | 0], r: Math.random() * 6 }));
    let f = 0;
    (function tick() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); g.restore(); });
      if (++f < 80) requestAnimationFrame(tick); else c.remove();
    })();
  }
  function beep() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [0, .25, .5].forEach(t0 => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = .15; o.connect(g); g.connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + .15); });
    } catch (e) { /* no audio */ }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  /* ---------- speech & share ---------- */
  function speak(text, btn) {
    const t = T();
    if (!('speechSynthesis' in window)) { toast(st.lang === 'zh' ? '這個瀏覽器不支援讀出功能。' : 'Read aloud is not supported on this browser.'); return; }
    const label = btn && btn.querySelector('span');
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); if (label) label.textContent = btn.dataset.label; return; }
    const pref = st.voice === 'auto' ? (st.lang === 'zh' ? 'zh-HK' : 'en-GB') : st.voice;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = pref; u.rate = st.senior ? 0.85 : 0.92;
    const v = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').toLowerCase().startsWith(pref.toLowerCase()));
    if (v) u.voice = v;
    if (label) { btn.dataset.label = label.textContent; label.textContent = t.stop; }
    u.onend = () => { if (label) label.textContent = btn.dataset.label; };
    speechSynthesis.speak(u);
  }
  async function share(text) {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast(T().copied); } catch (e) { toast(text); }
    const a = document.createElement('a');
    a.href = 'https://wa.me/?text=' + encodeURIComponent(text); a.target = '_blank'; a.rel = 'noopener'; a.click();
  }
  let toastTimer;
  function toast(msg) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  /* ---------- timer ---------- */
  function startTimer(act) {
    const ms = act.action === 'ventilate' ? act.minutes * 60e3 : act.hours * 36e5;
    st.timer = { end: Date.now() + ms, total: ms, kind: act.action, room: st.active }; save(); render();
  }
  function fmtLeft(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  }
  setInterval(() => {
    if (!st.timer) return;
    const left = st.timer.end - Date.now();
    const el = $('#timerLeft'), bar = $('#timerBar');
    if (left <= 0) {
      const kind = st.timer.kind; st.timer = null; st.stats.timers++;
      beep(); toast(kind === 'ventilate' ? T().timerDone : T().dehumDone);
      checkBadges(); save(); render(); return;
    }
    if (el) el.textContent = fmtLeft(left);
    if (bar) bar.style.width = (100 - left / st.timer.total * 100) + '%';
  }, 1000);

  /* ---------- small components ---------- */
  function ring(level) {
    const pct = { green: 0.33, amber: 0.66, red: 1 }[level];
    const C = 2 * Math.PI * 52;
    return `<div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52" fill="none" stroke-width="12"/>
      <circle class="meter" cx="60" cy="60" r="52" fill="none" stroke="var(--lvl)" stroke-width="12" stroke-linecap="round" stroke-dasharray="0 ${C}" data-to="${C * pct} ${C}"/></svg>
      <div class="ring-label"><button class="dewy-btn" data-go="more" data-sub-go="closet" aria-label="${L('Dress up Dewy', '打扮 Dewy')}">${dewy(moodOf(level), 70)}</button></div></div>`;
  }
  function roomChips() {
    const t = T();
    return `<div class="chips" role="tablist" aria-label="${t.rooms}">
      ${st.rooms.map(r => { const lvl = current(r).idx.level; return `<button class="chip lvl-${lvl}" data-room="${r.id}" aria-selected="${r.id === st.active}"><i></i>${esc(rn(r))}</button>`; }).join('')}
      <button class="chip add" id="addRoomBtn">${icon('plus')}<span>${t.addRoom}</span></button></div>
      ${addingRoom ? `<section class="card add-room"><label for="roomNameInput" class="label">${t.roomName}</label>
        <input id="roomNameInput" class="text-in" placeholder="${t.roomNamePh}" maxlength="24">
        <div class="select" style="margin-top:10px">${['sdu', 'hall', 'flat', 'other'].map(k => `<button data-newtype="${k}" aria-pressed="${k === (window._newType || 'flat')}">${t['home_' + k]}</button>`).join('')}</div>
        <div class="btns"><button class="btn primary" id="saveRoomBtn">${t.saveRoom}</button><button class="btn" id="cancelRoomBtn">${t.cancelTimer}</button></div></section>` : ''}`;
  }

  /* ---------- onboarding ---------- */
  function vOnboard() {
    const t = T(), p = st.profile;
    const steps = [
      () => `<div class="ob-hero">${dewy('happy', 120)}<h1>${t.ob_welcome}</h1><p class="lead">${t.ob_welcomeSub}</p>
        <div class="select center">${[['en', 'English'], ['zh', '繁體中文']].map(([v, l]) => `<button data-lang="${v}" aria-pressed="${st.lang === v}">${l}</button>`).join('')}</div></div>`,
      () => `<h1 class="view-title">${t.ob_name}</h1><input id="nameInput" class="text-in big" placeholder="${t.ob_namePh}" value="${esc(p.name)}" maxlength="20">`,
      () => `<h1 class="view-title">${t.ob_home}</h1><div class="opts">${['sdu', 'hall', 'flat', 'other'].map(k => `<button class="opt" data-home="${k}" aria-pressed="${p.home === k}">${t['home_' + k]}</button>`).join('')}</div>`,
      () => `<h1 class="view-title">${t.ob_people}</h1><div class="opts">${['elderly', 'kids', 'asthma', 'pets'].map(k => `<button class="opt" data-person="${k}" aria-pressed="${p.people.includes(k)}">${t['p_' + k]}</button>`).join('')}</div>
        ${sensitive() ? `<p class="note">${icon('users')}<span>${t.ob_sensitive}</span></p>` : ''}`,
      () => `<h1 class="view-title">${t.ob_appl}</h1><div class="opts">${['dehum', 'ac', 'fan', 'none'].map(k => `<button class="opt" data-appl="${k}" aria-pressed="${p.appl.includes(k)}">${t['a_' + k]}</button>`).join('')}</div>`,
      () => `<div class="ob-hero">${dewy('happy', 96)}<h1>${t.ob_senior}</h1><p class="lead">${t.ob_seniorSub}</p>
        <div class="opts"><button class="opt" data-senior="1" aria-pressed="${st.senior}">${t.ob_yesSenior}</button><button class="opt" data-senior="0" aria-pressed="${!st.senior}">${t.ob_noSenior}</button></div></div>`,
    ];
    const last = obStep === steps.length - 1;
    return `<div class="ob">
      <div class="dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('')}</div>
      ${steps[obStep]()}
      <div class="btns ob-btns">
        ${obStep > 0 ? `<button class="btn" id="obBack">${icon('left')}<span>${t.back}</span></button>` : ''}
        <button class="btn primary" id="obNext">${obStep === 0 ? t.ob_start : last ? t.ob_finish : t.ob_next}</button>
      </div>
      ${obStep === 0 ? `<button class="back center" id="obSkip">${t.ob_skip}</button>` : ''}</div>`;
  }

  /* ---------- views ---------- */
  function vHome() {
    const t = T(), r = room(), { c, scan, idx, act } = current();
    const lvl = idx.level, actTxt = actionText(act);
    const fp = fixesProgress(r, scan);
    const last7 = r.checkins.slice(-7);
    const lvlOf = rh => rh >= (sensitive() ? 75 : 80) ? 'red' : rh >= (sensitive() ? 55 : 60) ? 'amber' : 'green';
    const days = st.lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const sk = R.streak(allCheckinTimes());
    const aw = awayState();
    const tips = aw === 'away' ? t.dewy_away : c ? t['dewy_' + lvl] : t.dewy_none;
    const tip = tips[dewyTip % tips.length];
    const timerHere = st.timer && st.timer.room === st.active;
    const canTime = act.action === 'ventilate' || act.action === 'dehumidify';
    const timerBtn = canTime && !timerHere ? `<button class="btn primary" id="timerBtn">${icon(act.action === 'ventilate' ? 'window' : 'fan')}<span>${act.action === 'ventilate' ? t.startTimer(act.minutes) : t.startDehumTimer(act.hours)}</span></button>` : '';
    return `
    ${st.profile.name ? `<p class="hello">${t.hello(esc(st.profile.name))}</p>` : ''}
    ${weather ? `<span class="weather-chip">${skyMood() === 'rain' ? '🌧' : skyMood() === 'humid' ? '🫧' : skyMood() === 'dry' ? '☀️' : '✨'} ${L('Live sky', '即時天空')}: ${weather.rh}% · ${L({ rain: 'Raining', humid: 'Very humid', dry: 'Nice & dry', calm: 'Mild' }[skyMood()], { rain: '下雨', humid: '非常潮濕', dry: '乾爽', calm: '溫和' }[skyMood()])}</span>` : ''}
    ${roomChips()}
    ${aw === 'away' ? awayCard('pre') : aw === 'back' ? awayCard('post') : ''}
    ${st.senior ? `<button class="btn primary block huge" id="speakBtn">${icon('speaker')}<span>${t.hearAdvice}</span></button>` : ''}
    <section class="card lvl-${lvl}" aria-labelledby="riskTitle">
      <div class="risk">${ring(lvl)}
        <div><div class="label" id="riskTitle">${t.today} · ${esc(rn(r))}</div>
          <h2 style="margin-top:4px"><span class="pill">${t['level_' + lvl]}</span> ${t['levelSub_' + lvl]}</h2>
          ${st.senior ? '' : `<ul>${idx.reasons.map(x => `<li>${t['reason_' + x]}</li>`).join('')}</ul>`}</div>
      </div>
      <button class="bubble" id="dewyBtn" aria-label="${t.mascot}"><b>${t.mascot}:</b> ${esc(tip)}</button>
    </section>
    <section class="card action lvl-${lvl}">
      <div class="label">${t.doNow}</div>
      <div class="row" style="margin-top:8px">
        <div class="ic">${icon(act.action === 'ventilate' ? 'window' : act.action === 'dehumidify' || act.action === 'absorb' ? 'fan' : act.action === 'checkin' ? 'check' : 'ok')}</div>
        <p id="actText">${esc(actTxt)}</p>
      </div>
      ${timerHere ? `<div class="timer"><div class="timer-top"><span>${st.timer.kind === 'ventilate' ? t.timerRunning : t.a_dehum}</span><b id="timerLeft">${fmtLeft(st.timer.end - Date.now())}</b></div>
        <div class="progress"><i id="timerBar" style="width:${100 - (st.timer.end - Date.now()) / st.timer.total * 100}%"></i></div>
        <button class="back" id="cancelTimer">${t.cancelTimer}</button></div>` : ''}
      <div class="btns">
        ${act.action === 'checkin' ? `<button class="btn primary" data-go="check">${icon('check')}<span>${t.nav_check}</span></button>` : timerBtn}
        ${st.senior ? '' : `<button class="btn" id="speakBtn">${icon('speaker')}<span>${t.readAloud}</span></button>`}
        <button class="btn" id="shareBtn">${icon('share')}<span>${t.share}</span></button>
      </div>
    </section>
    <section class="card streak-card">
      <div class="flame ${sk ? 'on' : ''}">${icon('flame')}</div>
      <div><h2>${t.streak(sk)}</h2><div class="meta">${t.streakSub}</div></div>
      <button class="btn small" data-go="more" data-sub-go="badges">${icon('medal')}<span>${earnedCount()}/${BADGES.length}</span></button>
    </section>
    ${st.senior ? '' : `
    <div class="stats">
      <section class="card stat"><div class="label">${t.outdoor}</div>
        <div class="num">${weather ? weather.rh : '–'}<small>%</small></div>
        <div class="meta">${t.temp} ${weather?.temp ?? '–'}°C · ${weather?.raining ? t.rainNow : t.noRain}</div>
        <span class="tag">${weather?.sample ? t.sampleWeather : t.liveWeather}</span></section>
      <section class="card stat"><div class="label">${t.indoor}</div>
        <div class="num">${c ? c.rh : '–'}<small>%</small></div>
        <div class="meta">${c ? new Date(c.t).toLocaleString(st.lang === 'zh' ? 'zh-HK' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : t.noCheckin}</div>
        ${c?.est ? `<span class="tag">${t.estimated}</span>` : ''}</section>
    </div>
    <section class="card">
      <div class="label">${t.lastScan}</div>
      ${scan ? `<h2 style="margin-top:6px">${t.roomScore}: ${scan.score}/100</h2>
        <div class="meta" style="color:var(--ink-2);font-size:14px">${t.fixesDone(fp.done, fp.total)}</div>
        <div class="progress"><i style="width:${fp.total ? fp.done / fp.total * 100 : 0}%"></i></div>`
        : `<p class="lead">${t.noScan}</p>`}
      <div class="btns"><button class="btn block" data-go="scan">${icon('scan')}<span>${scan ? t.fixTracker : t.scanNow}</span></button></div>
    </section>
    <section class="card"><div class="label">${t.week}</div>
      ${last7.length ? `<div class="bars" role="img" aria-label="${t.week}">${last7.map(x => `<div class="bar lvl-${lvlOf(x.rh)}"><span>${x.rh}%</span><i style="height:${Math.max(4, (x.rh - 30) / 70 * 80)}%"></i><span>${days[new Date(x.t).getDay()]}</span></div>`).join('')}</div>`
        : `<p class="bars-empty">${t.noCheckin}</p>`}
    </section>`}`;
  }
  const earnedCount = () => st.badges.length;

  function awayCard(kind) {
    const t = T(), list = kind === 'pre' ? t.awayPre : t.awayPost, done = st.away[kind] || [];
    const d = new Date(st.away.until).toLocaleDateString(st.lang === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short' });
    return `<section class="card away-card">
      <div class="away-head">${icon('plane')}<div><h2>${kind === 'pre' ? t.awayBanner(d) : t.welcomeBack}</h2>${kind === 'post' ? `<div class="meta">${t.welcomeSub}</div>` : ''}</div></div>
      ${list.map((x, k) => `<label class="fix ${done[k] ? 'done' : ''}"><input type="checkbox" id="aw-${kind}-${k}" data-away="${kind}" data-k="${k}" ${done[k] ? 'checked' : ''}><span>${x}</span></label>`).join('')}
      ${kind === 'post' ? `<div class="btns"><button class="btn primary" id="endAway">${t.endAway}</button></div>` : ''}</section>`;
  }

  function issueCard(i, t, r) {
    const lvl = i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'amber' : 'green';
    return `<section class="card issue lvl-${lvl}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h3>${esc(i.title)}</h3><span class="pill">${t['sev_' + i.severity]}</span></div>
      ${i.where ? `<div class="where">${esc(i.where)}</div>` : ''}
      <p>${esc(i.why)}</p>
      <div class="conf">${t.confidence}<div class="progress"><i style="width:${Math.round((i.confidence || 0) * 100)}%"></i></div>${Math.round((i.confidence || 0) * 100)}%</div>
      <div style="margin-top:10px"><div class="label">${t.fixes}</div>
        ${i.fixes.map((f, k) => `<label class="fix ${r.fixes[i.id]?.[k] ? 'done' : ''}"><input type="checkbox" id="fx-${esc(i.id)}-${k}" data-fix="${esc(i.id)}" data-k="${k}" ${r.fixes[i.id]?.[k] ? 'checked' : ''}><span>${esc(f)}</span></label>`).join('')}
      </div></section>`;
  }

  function slider(before, after, illus) {
    const t = T();
    return `<section class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>${t.compare}</h2>${illus ? `<span class="badge">${t.illus}</span>` : ''}</div>
      <div class="compare" id="compare" style="--pos:50%">
        <img src="${after}" alt="${t.after}"><img class="before" src="${before}" alt="${t.before}">
        <span class="cmp-l">${t.before}</span><span class="cmp-r">${t.after}</span><i class="handle"></i>
        <input type="range" id="cmpRange" min="0" max="100" value="50" aria-label="${t.dragCompare}">
      </div><p class="lead" style="font-size:13px;text-align:center">${t.dragCompare}</p></section>`;
  }

  function vScan() {
    const t = T(), r = room(), scan = latest(r.scans), prev = r.scans.length > 1 ? r.scans[r.scans.length - 2] : null;
    const fp = fixesProgress(r, scan);
    return `
    <div><h1 class="view-title">${t.scanTitle}</h1><p class="lead">${t.scanIntro}</p></div>
    ${roomChips()}
    <section class="drop">
      <input type="file" id="photoInput" accept="image/*" capture="environment" multiple hidden>
      <button class="btn primary block" id="pickBtn">${icon('camera')}<span>${t.addPhoto}</span></button>
      ${scanFiles.length ? `<div class="thumbs">${scanFiles.map(f => `<img alt="" src="${f.url}">`).join('')}</div>` : ''}
      <div class="btns"><button class="btn block" id="analyseBtn" ${(scanFiles.length || st.demo) && !scanning ? '' : 'disabled'}>${icon('scan')}<span>${t.analyse}</span></button></div>
      ${scanning ? `<div class="scanning">${dewy('calm', 56)}<div class="spinner" role="status" aria-label="${t.analysing}"></div></div><p class="lead">${t.analysing}</p>` : ''}
    </section>
    <p class="note">${icon('lock')}<span>${t.privacy}</span></p>
    ${prev?.thumb && scan?.thumb ? slider(prev.thumb, scan.thumb, scan.illus) : ''}
    ${scan ? `
      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>${t.issuesFound}</h2>
        <span class="badge ${scan.source === 'ai' ? 'ai' : ''}">${scan.source === 'ai' ? t.aiBadge : t.demoBadge}</span></div>
        <div class="score-row" style="margin-top:12px">
          ${prev ? `<div><span class="label">${t.before}</span><b>${prev.score}</b></div>` : ''}
          <div><span class="label">${prev ? t.after : t.roomScore}</span><b>${scan.score}</b></div>
        </div>
        ${scan.issues.length ? `<div style="margin-top:12px;font-size:14px;color:var(--ink-2)">${t.fixTracker}: ${t.fixesDone(fp.done, fp.total)}</div>
        <div class="progress"><i style="width:${fp.total ? fp.done / fp.total * 100 : 0}%"></i></div>` : `<div class="all-clear">${dewy('happy', 56)}<b>${t.levelSub_green}</b></div>`}
      </section>
      ${scan.issues.map(i => issueCard(i, t, r)).join('')}
      ${fp.total && fp.done === fp.total ? `<p class="lead" style="font-weight:600;color:var(--ink)">${t.rescan}</p>` : ''}
      <p class="note">${icon('book')}<span>${t.disclaimer}</span></p>` : ''}`;
  }

  function vCheck() {
    const t = T(), mode = checkMode || (st.senior ? 'q' : 'meter');
    return `
    <div><h1 class="view-title">${t.checkTitle}</h1><p class="lead">${t.checkIntro}</p></div>
    ${roomChips()}
    <div class="seg" role="group">
      <button data-mode="meter" aria-pressed="${mode === 'meter'}">${t.haveMeter}</button>
      <button data-mode="q" aria-pressed="${mode === 'q'}">${t.noMeter}</button>
    </div>
    <section class="card">
      ${mode === 'meter'
        ? `<div class="field"><label for="rhInput">${t.meterLabel}</label><input type="number" id="rhInput" inputmode="numeric" min="20" max="100" placeholder="72" value="${latest(room().checkins)?.rh ?? ''}"></div>`
        : ['foggy', 'musty', 'laundry'].map(k => `<div class="q"><span>${t['q_' + k]}</span><div class="yn">
            <button data-q="${k}" data-v="1" aria-pressed="${answers[k] === true}">${t.yes}</button>
            <button data-q="${k}" data-v="0" aria-pressed="${answers[k] === false}">${t.no}</button></div></div>`).join('')}
    </section>
    <button class="btn primary block" id="saveCheck">${icon('ok')}<span>${t.save}</span></button>`;
  }

  function vPlan() {
    const t = T();
    const ranked = R.dryDays(weather?.days || []);
    const byDate = [...ranked].sort((a, b) => a.date.localeCompare(b.date));
    const fmt = ds => new Date(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8));
    const best = new Set(ranked.filter(d => d.good).slice(0, 2).map(d => d.date));
    return `
    <div><h1 class="view-title">${t.planTitle}</h1><p class="lead">${t.planIntro}</p></div>
    ${weather?.sample ? `<span class="tag" style="align-self:flex-start">${t.sampleWeather}</span>` : ''}
    ${byDate.map(d => { const dt = fmt(d.date); const lvl = d.good ? 'green' : d.score > 140 ? 'red' : 'amber';
      return `<section class="card day lvl-${lvl}">
        <div class="date"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString(st.lang === 'zh' ? 'zh-HK' : 'en-GB', { weekday: 'short' })}</span></div>
        <div class="info"><strong>${d.good ? t.goodDay : lvl === 'amber' ? t.shortAir : t.okDay}${best.has(d.date) ? ' ★' : ''}</strong>${t.humidity} ${d.minRH ?? '–'}–${d.maxRH ?? '–'}% · ${t.rain}: ${esc((st.lang === 'zh' ? { 'Low': '低', 'Medium Low': '中低', 'Medium': '中', 'Medium High': '中高', 'High': '高' }[d.psr] : d.psr) || '–')}</div>
        <span class="pill">${t['dry_' + lvl]}</span></section>`; }).join('')}`;
  }

  function vMore() {
    const t = T();
    if (sub === 'closet') {
      const d = st.dewy, mood = previewMood || 'happy';
      const sw = (kind, k, o) => { const ok = unlocked(o.need), on = d[kind] === k;
        const face = kind === 'skin' ? `<i style="background:linear-gradient(160deg, ${o.c.join(', ')})"></i>` : dewy('calm', 40, { skin: d.skin, acc: k });
        return `<button class="sw" data-${kind}="${k}" aria-pressed="${on}" ${ok ? '' : 'disabled'} title="${ok ? '' : esc(needText(o.need))}">${face}<span>${L(o.en, o.zh)}</span>${ok ? '' : `<span class="lock" aria-label="${L('Locked', '未解鎖')}">🔒</span>`}</button>`; };
      return `${backBtn()}<h1 class="view-title">${L('Dewy’s closet', 'Dewy 的衣櫃')}</h1>
      <p class="lead">${L('Dress up your little helper. Earn badges to unlock more!', '打扮你的小幫手，賺取徽章解鎖更多款式！')}</p>
      <section class="card"><div class="closet-stage">${dewy(mood, 150)}</div>
        <div class="mood-row">${[['happy', L('Green', '綠')], ['worried', L('Amber', '黃')], ['alarmed', L('Red', '紅')]].map(([m, l]) => `<button class="chip" data-mood="${m}" aria-selected="${mood === m}">${l}</button>`).join('')}</div></section>
      <section class="card"><div class="label">${L('Colour', '顏色')}</div><div class="swatches">${Object.entries(SKINS).map(([k, o]) => sw('skin', k, o)).join('')}</div></section>
      <section class="card"><div class="label">${L('Accessories', '配飾')}</div><div class="swatches">${Object.entries(ACCS).map(([k, o]) => sw('acc', k, o)).join('')}</div></section>
      <p class="note">${icon('medal')}<span>${L('Locked items: Sunset = 3 badges · Galaxy = 4 badges · Rainbow = get back to Green · Crown = 7-day streak.', '解鎖條件：日落 = 3 個徽章 · 銀河 = 4 個徽章 · 彩虹 = 回到綠色 · 皇冠 = 連續 7 天。')}</span></p>`;
    }
    if (sub === 'guide') return `${backBtn()}<h1 class="view-title">${t.guide}</h1>
      <section class="card">${t.guideSteps.map((s, n) => `<div class="step"><b class="n">${n + 1}</b><div><strong>${s[0]}</strong><p>${s[1]}</p></div></div>`).join('')}</section>
      <p class="note">${icon('book')}<span>${t.disclaimer}</span></p>`;
    if (sub === 'badges') { const e = earnedBadges();
      return `${backBtn()}<h1 class="view-title">${t.badges}</h1>
      <div class="badge-grid">${BADGES.map(b => { const on = st.badges.includes(b) || e[b]; return `<section class="card bdg ${on ? 'on' : ''}">
        <div class="medal">${icon('medal')}</div><strong>${t['b_' + b][0]}</strong><span>${on ? t['b_' + b][1] : t.badgeLocked + ' · ' + t['b_' + b][1]}</span></section>`; }).join('')}</div>`; }
    if (sub === 'away') {
      const def = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      return `${backBtn()}<h1 class="view-title">${t.awayTitle}</h1><p class="lead">${t.awayIntro}</p>
      <section class="card"><div class="field"><label for="awayDate">${t.dateLabel}</label><input type="date" id="awayDate" class="text-in" value="${st.away?.until || def}" min="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="btns"><button class="btn primary block" id="setAway">${icon('plane')}<span>${t.setAway}</span></button>
      ${st.away ? `<button class="btn block" id="endAway">${t.endAway}</button>` : ''}</div></section>
      <section class="card"><div class="label">${st.lang === 'zh' ? '出發前' : 'Before you leave'}</div>${t.awayPre.map(x => `<div class="fix"><span>• ${x}</span></div>`).join('')}</section>
      <p class="note">${icon('plug')}<span>${t.futureBanner} ${t.plugIntro}</span></p>`;
    }
    if (sub === 'plug') return `${backBtn()}<h1 class="view-title">${t.plug}</h1><div class="banner">${t.futureBanner}</div>
      <p class="lead">${t.plugIntro}</p>
      <section class="card">
        ${[['plugOn', t.plugState], ['plugAuto', t.auto], ['plugAway', t.awayMode]].map(([id, lbl], n) => `<div class="switch-row"><span>${lbl}</span><span class="switch"><input type="checkbox" id="${id}" ${n === 1 ? 'checked' : ''} aria-label="${lbl}"><i></i></span></div>`).join('')}
      </section>`;
    if (sub === 'ngo') {
      const rows = [['H-014', 'red', '2h', 'visit'], ['H-022', 'red', '1d', 'visit'], ['H-031', 'amber', '5h', 'call'], ['H-008', 'amber', '3d', 'call'], ['H-045', 'green', '1h', 'none'], ['H-019', 'green', '8h', 'none']];
      return `${backBtn()}<h1 class="view-title">${t.ngo}</h1><div class="banner">${t.ngoBanner}</div>
      <div class="stats">${['red', 'amber'].map(l => `<section class="card stat lvl-${l}"><span class="pill">${t['level_' + l]}</span><div class="num">${rows.filter(r => r[1] === l).length}</div></section>`).join('')}</div>
      <section class="card table-wrap"><table><thead><tr><th>${t.household}</th><th>${t.risk}</th><th>${t.lastCheck}</th><th>${t.followUp}</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="lvl-${r[1]}"><td>${r[0]}</td><td><span class="pill">${t['level_' + r[1]]}</span></td><td>${r[2]}</td><td>${t[r[3]]}</td></tr>`).join('')}</tbody></table></section>`;
    }
    if (sub === 'rooms') return `${backBtn()}<h1 class="view-title">${t.rooms}</h1>
      ${st.rooms.map(r => { const lvl = current(r).idx.level; return `<section class="card room-row lvl-${lvl}"><div><strong>${esc(rn(r))}</strong><div class="meta">${t['home_' + r.type] || ''}</div></div><span class="pill">${t['level_' + lvl]}</span>
        <button class="btn small" data-delroom="${r.id}">${t.deleteRoom}</button></section>`; }).join('')}
      ${roomChips()}`;
    if (sub === 'settings') return `${backBtn()}<h1 class="view-title">${t.settings}</h1>
      <section class="card">
        <div class="switch-row"><span>${t.language}</span><div class="select">${[['en', 'English'], ['zh', '繁體中文']].map(([v, l]) => `<button data-lang="${v}" aria-pressed="${st.lang === v}">${l}</button>`).join('')}</div></div>
        <div class="switch-row"><span>${t.voice}</span><div class="select">${[['auto', 'Auto'], ['en-GB', 'English'], ['zh-HK', '廣東話'], ['zh-CN', '普通話']].map(([v, l]) => `<button data-voice="${v}" aria-pressed="${st.voice === v}">${l}</button>`).join('')}</div></div>
        <div class="switch-row"><span>${t.seniorMode}<br><small>${t.seniorHint}</small></span><span class="switch"><input type="checkbox" id="seniorToggle" ${st.senior ? 'checked' : ''} aria-label="${t.seniorMode}"><i></i></span></div>
        <div class="switch-row"><span>${t.keepPhotos}<br><small>${t.keepPhotosHint}</small></span><span class="switch"><input type="checkbox" id="photoToggle" ${st.keepPhotos ? 'checked' : ''} aria-label="${t.keepPhotos}"><i></i></span></div>
        <div class="switch-row"><span>${t.demoMode}<br><small>${t.demoModeHint}</small></span><span class="switch"><input type="checkbox" id="demoToggle" ${st.demo ? 'checked' : ''} aria-label="${t.demoMode}"><i></i></span></div>
      </section>
      <div class="btns" style="margin-top:0"><button class="btn block" id="redoSetup">${t.redoSetup}</button>
      <button class="btn block" id="seedBtn">${st.lang === 'zh' ? '載入示範數據（簡報用）' : 'Load demo data (for presentation)'}</button>
      <button class="btn block" id="resetBtn">${t.resetData}</button></div>`;
    const p = st.profile;
    return `<h1 class="view-title">${t.moreTitle}</h1>
      <section class="card profile-card">${dewy('happy', 64)}<div><strong>${p.name ? esc(p.name) : t.myHome}</strong>
        <div class="meta">${[t['home_' + p.home], ...p.people.map(x => t['p_' + x])].filter(Boolean).join(' · ')}</div></div>
        <button class="btn small primary" data-sub="closet">${L('Dress up', '打扮')}</button></section>
      <div class="label">${t.personalise}</div>
      <section class="card menu">
        <button data-sub="closet">${icon('user')}<span>${L('Dewy’s closet', 'Dewy 的衣櫃')}</span>${icon('chev', 'chev')}</button>
        ${[['rooms', 'home'], ['away', 'plane'], ['badges', 'medal'], ['settings', 'gear']].map(([k, ic]) => `<button data-sub="${k}">${icon(ic)}<span>${t[k] || t.awayTitle}</span>${icon('chev', 'chev')}</button>`).join('')}
      </section>
      <section class="card menu">
        ${[['guide', 'book'], ['plug', 'plug'], ['ngo', 'users']].map(([k, ic]) => `<button data-sub="${k}">${icon(ic)}<span>${t[k]}</span>${icon('chev', 'chev')}</button>`).join('')}
      </section>
      <p class="lead" style="text-align:center">EcoGuard SDU · ${t.tagline}<br><small>Team T22 · HKU · Prototype</small></p>`;
  }
  const backBtn = () => `<button class="back" id="backBtn">${icon('left')}<span>${T().back}</span></button>`;

  /* ---------- weather-aware moving sky ---------- */
  function skyMood() {
    if (!weather) return 'calm';
    if (weather.raining) return 'rain';
    if (weather.rh >= 80) return 'humid';
    if (weather.rh < 65) return 'dry';
    return 'calm';
  }
  const sky = { mood: null, parts: [], raf: 0 };
  function updateSky() {
    const m = skyMood(), el = $('#sky'), cv = $('#skyCanvas');
    if (!el || !cv || sky.mood === m) return;
    sky.mood = m; el.dataset.mood = m;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size(); if (!sky.sized) { addEventListener('resize', () => { size(); }); sky.sized = true; }
    const W_ = () => cv.width, H_ = () => cv.height, rnd = (a, b) => a + Math.random() * (b - a);
    const n = { rain: 70, humid: 26, dry: 34, calm: 40 }[m];
    sky.parts = Array.from({ length: n }, () => ({ x: rnd(0, W_()), y: rnd(0, H_()), r: rnd(1, 3), v: rnd(.3, 1), p: rnd(0, 6.3) }));
    if (m === 'humid') sky.parts.forEach(q => { q.r = rnd(4, 14) * dpr; q.v = rnd(.25, .7) * dpr; });
    if (m === 'rain') sky.parts.forEach(q => { q.r = rnd(10, 22) * dpr; q.v = rnd(7, 12) * dpr; });
    const g = cv.getContext('2d');
    cancelAnimationFrame(sky.raf);
    const frame = t => {
      g.clearRect(0, 0, W_(), H_());
      sky.parts.forEach(q => {
        if (m === 'rain') {
          g.strokeStyle = 'rgba(166,230,255,.35)'; g.lineWidth = 1.4 * dpr; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.r * .25, q.y + q.r); g.stroke();
          q.y += q.v; q.x -= q.v * .25; if (q.y > H_()) { q.y = -q.r; q.x = rnd(0, W_() + 60); }
        } else if (m === 'humid') {
          const wob = Math.sin(t / 900 + q.p) * 8 * dpr;
          g.strokeStyle = 'rgba(200,240,255,.35)'; g.lineWidth = 1.3 * dpr; g.fillStyle = 'rgba(122,211,255,.06)';
          g.beginPath(); g.arc(q.x + wob, q.y, q.r, 0, 7); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(q.x + wob - q.r * .35, q.y - q.r * .35, q.r * .18, 0, 7); g.fill();
          q.y -= q.v; if (q.y < -q.r * 2) { q.y = H_() + q.r; q.x = rnd(0, W_()); }
        } else {
          const tw = .35 + .65 * Math.abs(Math.sin(t / 1100 + q.p));
          g.fillStyle = m === 'dry' ? `rgba(255,224,138,${.55 * tw})` : `rgba(255,255,255,${.6 * tw})`;
          g.beginPath(); g.arc(q.x, q.y, q.r * dpr * (m === 'dry' ? 1.1 : .8), 0, 7); g.fill();
          if (m === 'dry') { q.y -= q.v * .3 * dpr; q.x += Math.sin(t / 2000 + q.p) * .2 * dpr; if (q.y < 0) q.y = H_(); }
        }
      });
      if (!reduced() && !document.hidden) sky.raf = requestAnimationFrame(frame);
    };
    frame(0);
    if (!sky.vis) { document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduced()) { cancelAnimationFrame(sky.raf); const m2 = sky.mood; sky.mood = null; updateSky(); } }); sky.vis = true; }
  }

  /* ---------- render ---------- */
  function render() {
    const t = T();
    document.documentElement.lang = st.lang === 'zh' ? 'zh-HK' : 'en';
    document.documentElement.classList.toggle('senior', !!st.senior);
    $('#langBtn').textContent = st.lang === 'zh' ? 'EN' : '中文';
    $('#tagline').textContent = t.tagline;
    const onboarding = !st.profile.done;
    document.body.classList.toggle('onboarding', onboarding);
    const views = { home: vHome, scan: vScan, check: vCheck, plan: vPlan, more: vMore };
    const main = $('#main');
    main.classList.toggle('enter', enterNext && !reduced()); enterNext = false;
    main.innerHTML = onboarding ? vOnboard() : views[view]();
    updateSky();
    document.querySelectorAll('.tabs button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
      b.querySelector('span').textContent = t['nav_' + b.dataset.view];
      b.hidden = st.senior && b.dataset.view === 'plan';
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.meter').forEach(m => m.setAttribute('stroke-dasharray', m.dataset.to));
    }));
  }
  function go(v, s = null) { view = v; sub = s; addingRoom = false; enterNext = true; render(); window.scrollTo(0, 0); }

  function toggleIn(arr, v) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }

  /* ---------- events ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const t = T(), r = room();
    // onboarding
    if (b.dataset.home) { st.profile.home = b.dataset.home; return render(); }
    if (b.dataset.person) { st.profile.people = toggleIn(st.profile.people, b.dataset.person); return render(); }
    if (b.dataset.appl) {
      const v = b.dataset.appl;
      st.profile.appl = v === 'none' ? (st.profile.appl.includes('none') ? [] : ['none']) : toggleIn(st.profile.appl.filter(x => x !== 'none'), v);
      return render();
    }
    if (b.dataset.senior) { st.senior = b.dataset.senior === '1'; return render(); }
    if (b.id === 'obNext') {
      const ni = $('#nameInput'); if (ni) st.profile.name = ni.value.trim();
      if (obStep < 5) { obStep++; if (obStep === 5 && st.profile.people.includes('elderly') && !st.profile.done) st.senior = true; return render(); }
      st.profile.done = true; obStep = 0;
      if (st.rooms.length === 1 && !st.rooms[0].checkins.length) st.rooms[0].type = st.profile.home;
      save(); return go('home');
    }
    if (b.id === 'obBack') { const ni = $('#nameInput'); if (ni) st.profile.name = ni.value.trim(); obStep--; return render(); }
    if (b.id === 'obSkip') { st.profile.done = true; save(); return go('home'); }
    if (b.id === 'redoSetup') { st.profile.done = false; obStep = 0; return render(); }

    if (b.dataset.view) return go(b.dataset.view);
    if (b.dataset.go) return go(b.dataset.go, b.dataset.subGo || null);
    if (b.id === 'langBtn') { st.lang = st.lang === 'zh' ? 'en' : 'zh'; save(); render(); weather = await W.load(st.lang).catch(() => weather); return render(); }
    if (b.id === 'dewyBtn') { dewyTip++; return render(); }
    if (b.id === 'speakBtn') { const { idx, act } = current(); return speak(`${t.today}: ${t['level_' + idx.level]}. ${t['levelSub_' + idx.level]} ${actionText(act)}`, b); }
    if (b.id === 'shareBtn') { const { idx, act } = current(); return share(`${rn(r)} – ` + t.shareText(t['level_' + idx.level], actionText(act))); }
    if (b.id === 'timerBtn') { const { act } = current(); return startTimer(act); }
    if (b.id === 'cancelTimer') { st.timer = null; save(); return render(); }
    // rooms
    if (b.dataset.room) { st.active = b.dataset.room; save(); return render(); }
    if (b.id === 'addRoomBtn') { addingRoom = !addingRoom; window._newType = 'flat'; render(); const i = $('#roomNameInput'); if (i) i.focus(); return; }
    if (b.dataset.newtype) { window._newType = b.dataset.newtype; const v = $('#roomNameInput').value; render(); $('#roomNameInput').value = v; return; }
    if (b.id === 'cancelRoomBtn') { addingRoom = false; return render(); }
    if (b.id === 'saveRoomBtn') {
      const name = $('#roomNameInput').value.trim() || t.roomNamePh.replace(/^e\.g\. |^例如：/, '');
      const nr = newRoom(name, window._newType || 'flat'); st.rooms.push(nr); st.active = nr.id; addingRoom = false; save(); return render();
    }
    if (b.dataset.delroom) {
      if (st.rooms.length < 2) { toast(t.cantDelete); return; }
      st.rooms = st.rooms.filter(x => x.id !== b.dataset.delroom); if (!room()) st.active = st.rooms[0].id; save(); return render();
    }
    // scan
    if (b.id === 'pickBtn') return $('#photoInput').click();
    if (b.id === 'analyseBtn') {
      scanning = true; render();
      const prev = latest(r.scans);
      const fixedIds = prev ? prev.issues.filter(i => i.fixes.every((_, k) => r.fixes[i.id]?.[k])).map(i => i.id) : [];
      const result = await S.analyse(scanFiles.map(f => f.file), { lang: st.lang, demo: st.demo, fixedIds });
      if (st.keepPhotos && scanFiles[0]) result.thumb = await S.thumb(scanFiles[0].file);
      r.scans = [...r.scans, result].slice(-2);
      scanning = false; scanFiles.forEach(f => URL.revokeObjectURL(f.url)); scanFiles = [];
      trackLevel(r); checkBadges(); save(); return render();
    }
    // check-in
    if (b.dataset.mode) { checkMode = b.dataset.mode; return render(); }
    if (b.dataset.q) { answers[b.dataset.q] = b.dataset.v === '1'; return render(); }
    if (b.id === 'saveCheck') {
      const mode = checkMode || (st.senior ? 'q' : 'meter');
      let rh, est = false;
      if (mode === 'meter') {
        rh = parseInt($('#rhInput').value, 10);
        if (!(rh >= 20 && rh <= 100)) { toast(st.lang === 'zh' ? '請輸入 20 至 100 之間的數字。' : 'Enter a number between 20 and 100.'); return; }
      } else {
        if (Object.keys(answers).length < 3) { toast(st.lang === 'zh' ? '請回答全部三條問題。' : 'Please answer all three questions.'); return; }
        rh = R.estimateIndoorRH(answers, weather?.rh); est = true;
      }
      r.checkins = [...r.checkins, { t: Date.now(), rh, est }].slice(-60);
      answers = {}; trackLevel(r); checkBadges(); save(); toast(t.saved); return go('home');
    }
    // more
    if (b.dataset.sub) { sub = b.dataset.sub; previewMood = null; enterNext = true; render(); return window.scrollTo(0, 0); }
    if (b.dataset.skin) { st.dewy.skin = b.dataset.skin; save(); return render(); }
    if (b.dataset.acc) { st.dewy.acc = b.dataset.acc; save(); return render(); }
    if (b.dataset.mood) { previewMood = b.dataset.mood; return render(); }
    if (b.id === 'backBtn') { sub = null; enterNext = true; return render(); }
    if (b.dataset.lang) { st.lang = b.dataset.lang; save(); return render(); }
    if (b.dataset.voice) { st.voice = b.dataset.voice; save(); return render(); }
    if (b.id === 'setAway') { st.away = { until: $('#awayDate').value, pre: [], post: [] }; save(); return go('home'); }
    if (b.id === 'endAway') { st.away = null; save(); return go('home'); }
    if (b.id === 'seedBtn') {
      const now = Date.now(), rhs = [62, 66, 71, 74, 78, 82, 76];
      const r1 = room();
      r1.checkins = rhs.map((rh, n) => ({ t: now - (6 - n) * 864e5, rh, est: false }));
      const s1 = await S.analyse([], { lang: st.lang, demo: true, fixedIds: [] });
      s1.thumb = S.room(false); s1.illus = true; s1.t = now - 2 * 864e5;
      const s2 = await S.analyse([], { lang: st.lang, demo: true, fixedIds: ['i1', 'i3'] });
      s2.thumb = S.room(true); s2.illus = true;
      r1.scans = [s1, s2]; r1.fixes = { i1: [true, true], i3: [true] }; r1.lastLevel = null;
      if (st.rooms.length < 2) { const m = newRoom(st.lang === 'zh' ? '媽媽的家' : 'Mum’s flat', 'sdu'); m.checkins = [57, 55, 58, 54].map((rh, n) => ({ t: now - (3 - n) * 864e5, rh, est: false })); st.rooms.push(m); }
      st.badges = ['first', 's3', 'scan', 'window']; st.stats.timers = Math.max(1, st.stats.timers);
      st.profile = { ...st.profile, done: true, name: st.profile.name || 'Alex' };
      save(); toast(st.lang === 'zh' ? '已載入示範數據。' : 'Demo data loaded.'); return go('home');
    }
    if (b.id === 'resetBtn') { const lang = st.lang; st = defaults(); st.lang = lang; st.rooms = [newRoom(t.defaultRoom)]; st.active = st.rooms[0].id; save(); toast(t.resetDone); return render(); }
  });

  document.addEventListener('change', e => {
    const el = e.target, r = room();
    if (el.id === 'photoInput') {
      scanFiles.forEach(f => URL.revokeObjectURL(f.url));
      scanFiles = [...el.files].slice(0, 3).map(file => ({ file, url: URL.createObjectURL(file) }));
      return render();
    }
    if (el.dataset.fix) {
      const id = el.dataset.fix, k = +el.dataset.k;
      r.fixes[id] = r.fixes[id] || []; r.fixes[id][k] = el.checked; checkBadges(); save(); return render();
    }
    if (el.dataset.away) {
      const kind = el.dataset.away, k = +el.dataset.k;
      st.away[kind] = st.away[kind] || []; st.away[kind][k] = el.checked;
      const list = kind === 'pre' ? T().awayPre : T().awayPost;
      if (kind === 'pre' && list.every((_, i) => st.away.pre[i]) && !st.badges.includes('travel')) { st.badges.push('travel'); toast(T().newBadge(T().b_travel[0])); celebrate(); }
      save(); return render();
    }
    if (el.id === 'demoToggle') { st.demo = el.checked; save(); }
    if (el.id === 'seniorToggle') { st.senior = el.checked; save(); render(); }
    if (el.id === 'photoToggle') { st.keepPhotos = el.checked; save(); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'cmpRange') $('#compare').style.setProperty('--pos', e.target.value + '%');
  });

  /* ---------- start ---------- */
  async function start() {
    render();
    weather = await W.load(st.lang);
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.EcoApp = { start, _state: () => st, _dewy: dewy };
  start();
})();
