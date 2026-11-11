// EcoGuard SDU – secure scan server (Vercel serverless function, Phase 2).
// Keeps the Gemini API key secret. Set GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables.
// Photos are only passed through to the AI and are never stored here.

const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean);
const MAX_IMAGES = 3;
const MAX_BYTES = 1.5 * 1024 * 1024; // per image (base64 length check below)

const PROMPT = (lang) => `You are EcoGuard SDU, a home humidity and mold screening assistant for small Hong Kong flats (subdivided units).
Look at the room photo(s) and find ONLY issues you can actually see from this list:
- blocked_ventilation: windows or vents blocked by furniture or objects
- furniture_against_wall: large furniture pressed against an outer wall
- damp_patch: damp stains, water marks, peeling or bubbling paint
- visible_mold: black, green or grey spots or fuzzy growth that look like mold
- indoor_laundry: clothes drying indoors
- condensation: water droplets or fog on windows or walls
- clutter: piles that block airflow in a small space
Rules:
- Do not guess. If nothing is visible, return an empty list.
- Give 1 to 3 simple, low-cost, safe fixes for each issue. Never suggest dangerous chemicals or mixing cleaners.
- For visible_mold covering a large area, include the fix "Contact a professional".
- Use short, friendly, plain language. No scary wording.
- Write title, where, why and fixes in ${lang === 'zh' ? 'Traditional Chinese (Hong Kong, Cantonese style)' : 'English'}.
Return JSON only.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    issues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['blocked_ventilation', 'furniture_against_wall', 'damp_patch', 'visible_mold', 'indoor_laundry', 'condensation', 'clutter'] },
          severity: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'NUMBER' },
          title: { type: 'STRING' },
          where: { type: 'STRING' },
          why: { type: 'STRING' },
          fixes: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['type', 'severity', 'confidence', 'title', 'why', 'fixes'],
      },
    },
  },
  required: ['issues'],
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI scan is not set up yet' });

  try {
    const { images, lang } = req.body || {};
    if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: 'Add at least one photo' });
    const imgs = images.slice(0, MAX_IMAGES).filter(b => typeof b === 'string' && b.length < MAX_BYTES * 1.4);
    if (!imgs.length) return res.status(413).json({ error: 'Photo is too large' });

    const body = {
      contents: [{ role: 'user', parts: [
        { text: PROMPT(lang) },
        ...imgs.map(data => ({ inline_data: { mime_type: 'image/jpeg', data } })),
      ] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
    };

    let model = MODELS[0];
    const call = b => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
      body: JSON.stringify(b),
    });
    // Try each model name until one exists (Google retires old model names).
    for (const m of MODELS) { model = m; const probe = await call(body); if (probe.status !== 404) { body._first = probe; break; } }
    let r = body._first; delete body._first;
    if (r.status === 400) {
      // Retry once without the strict schema (some models/versions reject it).
      const simple = { ...body, generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } };
      simple.contents[0].parts[0].text += '\nReturn exactly: {"issues":[{"type","severity","confidence","title","where","why","fixes"}]}';
      r = await call(simple);
    }
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json())?.error?.message || ''; } catch (e) { /* ignore */ }
      return res.status(502).json({ error: 'AI service error', status: r.status, detail: detail.slice(0, 300) });
    }
    const data = await r.json();
    let text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{"issues":[]}';
    text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(text);
    return res.status(200).json({ issues: (parsed.issues || []).slice(0, 6) });
  } catch (e) {
    return res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
};
