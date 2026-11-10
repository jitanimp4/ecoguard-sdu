/* EcoGuard SDU – Hong Kong Observatory open data (free, no key needed). */
(function () {
  const BASE = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';

  function sample() {
    const days = [];
    const now = new Date();
    const psr = ['Low', 'Medium Low', 'Medium', 'Low', 'High', 'Medium High', 'Low', 'Medium Low', 'Low'];
    const maxRH = [80, 85, 90, 75, 95, 95, 80, 85, 75];
    for (let i = 0; i < 9; i++) {
      const d = new Date(now.getTime() + (i + 1) * 864e5);
      const ds = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      days.push({ date: ds, maxRH: maxRH[i], minRH: maxRH[i] - 20, psr: psr[i], maxT: 25, minT: 20, weather: '' });
    }
    return { sample: true, rh: 68, temp: 24, raining: false, updated: null, days };
  }

  async function getJSON(type, lang) {
    const r = await fetch(`${BASE}?dataType=${type}&lang=${lang}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HKO ' + r.status);
    return r.json();
  }

  async function load(lang) {
    const hkoLang = lang === 'zh' ? 'tc' : 'en';
    try {
      const [now, fnd] = await Promise.all([getJSON('rhrread', hkoLang), getJSON('fnd', 'en')]); // English so rain-chance labels (PSR) match our rules
      const rh = now?.humidity?.data?.[0]?.value;
      const temps = now?.temperature?.data || [];
      const hko = temps.find(t => /Observatory|天文台/.test(t.place)) || temps[0];
      const raining = (now?.rainfall?.data || []).some(x => (x.max || 0) > 0);
      const days = (fnd?.weatherForecast || []).map(d => ({
        date: d.forecastDate,
        maxRH: d.forecastMaxrh?.value, minRH: d.forecastMinrh?.value,
        maxT: d.forecastMaxtemp?.value, minT: d.forecastMintemp?.value,
        psr: d.PSR, weather: d.forecastWeather || '',
      }));
      if (typeof rh !== 'number') throw new Error('no humidity');
      return { sample: false, rh, temp: hko?.value, raining, updated: now.updateTime || null, days };
    } catch (e) {
      console.warn('Using sample weather:', e.message);
      return sample();
    }
  }

  window.EcoWeather = { load, sample };
})();
