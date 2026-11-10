/* EcoGuard SDU – Room scan.
   Phase 1: demo results (clearly labelled).
   Phase 2: photos go to /api/scan (our secure server), which asks Gemini. */
(function () {
  const WEIGHT = { high: 25, medium: 15, low: 8 };

  const DEMO = {
    en: [
      { id: 'i1', type: 'blocked_ventilation', severity: 'high', confidence: 0.86,
        title: 'Wardrobe blocking the window',
        where: 'Left side of the window',
        why: 'Furniture covers part of the only window, so damp air cannot escape.',
        fixes: ['Move the wardrobe at least 30 cm away from the window', 'Keep the window area clear of boxes and bags'] },
      { id: 'i2', type: 'damp_patch', severity: 'medium', confidence: 0.74,
        title: 'Damp patch in the wall corner',
        where: 'Top right corner, near the ceiling',
        why: 'Darker, uneven paint suggests moisture is collecting here, an early sign of mold.',
        fixes: ['Wipe the corner dry and check it again in 3 days', 'Move furniture 5–10 cm away from this wall'] },
      { id: 'i3', type: 'indoor_laundry', severity: 'medium', confidence: 0.91,
        title: 'Clothes drying indoors',
        where: 'Hanging rack in the middle of the room',
        why: 'Wet laundry adds a lot of moisture to a small room.',
        fixes: ['Dry laundry outside or near an open window on a dry day'] },
    ],
    zh: [
      { id: 'i1', type: 'blocked_ventilation', severity: 'high', confidence: 0.86,
        title: '衣櫃阻擋窗戶', where: '窗戶左邊',
        why: '傢俬遮住唯一的窗戶，潮濕空氣無法排出。',
        fixes: ['把衣櫃移離窗戶最少 30 厘米', '窗邊不要堆放紙箱和袋'] },
      { id: 'i2', type: 'damp_patch', severity: 'medium', confidence: 0.74,
        title: '牆角有潮濕痕跡', where: '右上角，近天花',
        why: '油漆顏色較深及不平均，表示濕氣在此積聚，是早期發黴跡象。',
        fixes: ['把牆角抹乾，三天後再檢查', '傢俬離開這面牆 5–10 厘米'] },
      { id: 'i3', type: 'indoor_laundry', severity: 'medium', confidence: 0.91,
        title: '在室內晒衫', where: '房間中間的晒衫架',
        why: '濕衣服會令細小房間的濕度大増。',
        fixes: ['天氣乾爽時在室外或打開的窗邊晒衫'] },
    ],
  };

  function score(issues) {
    const s = 100 - (issues || []).reduce((a, i) => a + (WEIGHT[i.severity] || 10), 0);
    return Math.max(10, s);
  }

  function resizeToJpeg(file, maxSide = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this photo')); };
      img.src = url;
    });
  }

  // Small on-phone copy for the before/after slider (only if the user opted in).
  async function thumb(file) {
    if (!file) return null;
    try { return 'data:image/jpeg;base64,' + await resizeToJpeg(file, 480, 0.7); } catch (e) { return null; }
  }

  // Demo illustrations (not real photos) for presentation screenshots.
  function room(after) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="${after ? '#EEF3F1' : '#D9DCCF'}"/>
<rect y="230" width="400" height="70" fill="${after ? '#C9B49A' : '#A8977F'}"/>
<rect x="150" y="50" width="120" height="110" fill="${after ? '#BFE6FF' : '#9FB3BF'}" stroke="#6B7A86" stroke-width="6"/>
<line x1="210" y1="50" x2="210" y2="160" stroke="#6B7A86" stroke-width="5"/>
${after ? '<path d="M210 55 L250 70 L250 150 L210 160Z" fill="#E6F7FF" stroke="#6B7A86" stroke-width="4"/><path d="M60 110 l20 -6 M70 125 l22 -4 M62 140 l20 -2" stroke="#2EC4B6" stroke-width="4" stroke-linecap="round"/>'
  : '<g fill="#5E6B56" opacity=".75"><circle cx="355" cy="40" r="22"/><circle cx="378" cy="62" r="16"/><circle cx="340" cy="70" r="12"/><circle cx="368" cy="92" r="8"/><circle cx="390" cy="28" r="10"/></g><g fill="#fff" opacity=".6"><circle cx="165" cy="70" r="3"/><circle cx="180" cy="95" r="2"/><circle cx="240" cy="80" r="3"/><circle cx="255" cy="120" r="2"/></g>'}
<rect x="${after ? 290 : 120}" y="70" width="${after ? 90 : 100}" height="165" rx="4" fill="#8B5E3C" stroke="#5A3B24" stroke-width="4"/>
<line x1="${after ? 335 : 170}" y1="75" x2="${after ? 335 : 170}" y2="230" stroke="#5A3B24" stroke-width="3"/>
${after ? '' : '<g stroke="#7B8794" stroke-width="4"><line x1="270" y1="150" x2="270" y2="235"/><line x1="340" y1="150" x2="340" y2="235"/><line x1="262" y1="150" x2="348" y2="150"/></g><rect x="278" y="152" width="22" height="40" fill="#E57373"/><rect x="305" y="152" width="26" height="48" fill="#64B5F6"/>'}
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // fixedIds: issue ids whose fixes are all ticked (used for demo re-scans)
  async function analyse(files, { lang, demo, fixedIds }) {
    if (!demo) {
      try {
        const images = await Promise.all([...files].slice(0, 3).map(f => resizeToJpeg(f)));
        const r = await fetch('api/scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images, lang }),
        });
        if (r.ok) {
          const data = await r.json();
          const issues = (data.issues || []).map((x, n) => ({ id: 'a' + n, ...x }));
          return { source: 'ai', issues, score: score(issues), t: Date.now() };
        }
      } catch (e) { console.warn('AI scan unavailable, using demo:', e.message); }
    }
    await new Promise(r => setTimeout(r, 1400)); // feel like a real scan
    const all = DEMO[lang] || DEMO.en;
    const issues = all.filter(i => !(fixedIds || []).includes(i.id));
    return { source: 'demo', issues, score: score(issues), t: Date.now() };
  }

  window.EcoScan = { analyse, score, thumb, room };
})();
