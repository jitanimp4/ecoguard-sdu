/* EcoGuard SDU – Mold Index & Eco-Dry rules (simple, testable IF/THEN logic). */
(function (root) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Estimate indoor humidity when the user has no hygrometer.
  // answers: { foggy: bool, musty: bool, laundry: bool }
  function estimateIndoorRH(answers, outdoorRH) {
    const yes = ['foggy', 'musty', 'laundry'].filter(k => answers && answers[k]).length;
    let est = 56 + yes * 9;
    if (typeof outdoorRH === 'number' && outdoorRH >= 85) est += 5;
    return clamp(Math.round(est), 40, 95);
  }

  // How long indoor humidity has stayed >= 70% (hours), from check-in history.
  // history: [{ t: ms timestamp, rh: number }] in any order.
  function hoursAbove70(history, now) {
    if (!history || !history.length) return 0;
    const sorted = [...history].sort((a, b) => b.t - a.t);
    if (sorted[0].rh < 70) return 0;
    let start = sorted[0].t;
    for (const h of sorted) {
      if (h.rh >= 70) start = h.t; else break;
    }
    return Math.max(0, ((now || Date.now()) - start) / 36e5);
  }

  // scan: { issues: [{ type, severity }] } from the GenAI scan (may be null)
  function moldIndex({ indoorRH, history, scan, now, sensitive }) {
    const RED = sensitive ? 75 : 80, AMBER = sensitive ? 55 : 60;
    const reasons = [];
    const issues = (scan && scan.issues) || [];
    const visibleMold = issues.some(i => i.type === 'visible_mold');
    const blocked = issues.some(i => i.type === 'blocked_ventilation' || i.type === 'furniture_against_wall');
    const hrs = hoursAbove70(history, now);

    let level = 'green';
    if (typeof indoorRH === 'number' && indoorRH >= RED) reasons.push(sensitive ? 'rh75s' : 'rh80');
    if (hrs >= 48) reasons.push('rh70_48h');
    if (visibleMold) reasons.push('mold_seen');
    if (reasons.length) level = 'red';
    else {
      if (typeof indoorRH === 'number' && indoorRH >= AMBER) reasons.push(sensitive ? 'rh55s' : 'rh60');
      if (blocked) reasons.push('blocked');
      if (reasons.length) level = 'amber';
      else reasons.push('ok');
    }
    return { level, reasons, hoursAbove70: Math.round(hrs) };
  }

  // Decide the one Eco-Dry action.
  function ecoDry({ indoorRH, outdoorRH, rainLikely, sensitive, hasDryer = true }) {
    if (typeof indoorRH !== 'number') return { action: 'checkin' };
    if (indoorRH < (sensitive ? 55 : 60)) return { action: 'keep' };
    if (typeof outdoorRH === 'number' && outdoorRH <= indoorRH - 10 && !rainLikely) {
      return { action: 'ventilate', minutes: 15 };
    }
    if (!hasDryer) return { action: 'absorb' };
    return { action: 'dehumidify', hours: indoorRH >= (sensitive ? 75 : 80) ? 2 : 1 };
  }

  // Rank forecast days for airing out / laundry.
  // days: [{ date: 'YYYYMMDD', maxRH, minRH, psr, weather }]
  const PSR_SCORE = { 'Low': 0, 'Medium Low': 1, 'Medium': 2, 'Medium High': 3, 'High': 4 };
  function dryDays(days) {
    return (days || []).map(d => {
      const psr = PSR_SCORE[d.psr] ?? 2;
      const score = (d.maxRH || 90) + (d.minRH || 70) * 0.5 + psr * 12;
      const good = (d.maxRH || 100) <= 85 && psr <= 1;
      return { ...d, score, good };
    }).sort((a, b) => a.score - b.score);
  }

  // Consecutive days (ending today or yesterday) with at least one check-in.
  function streak(times, now) {
    const day = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const days = new Set((times || []).map(day));
    let cur = day(now || Date.now());
    if (!days.has(cur)) cur -= 864e5;
    let n = 0;
    while (days.has(cur)) { n++; cur = day(cur - 864e5 / 2); }
    return n;
  }

  const api = { estimateIndoorRH, hoursAbove70, moldIndex, ecoDry, dryDays, streak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EcoRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
