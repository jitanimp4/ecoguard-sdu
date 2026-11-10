# EcoGuard SDU – Prototype App

**Scan once. Know your risk. Breathe easier.**
A mold & humidity helper for Hong Kong's subdivided units (SDUs). Team T22 · HKU.

This is a mobile web app (PWA). It opens in any phone browser and can be added to the home screen like a normal app.

---

## What works now (Phase 1)

| Feature | Status |
|---|---|
| Home: Green / Amber / Red **Mold Index** + one **Eco-Dry** action | Working |
| **Live Hong Kong Observatory** humidity, temperature, rain + 9-day forecast | Working once hosted online (falls back to labelled sample weather if offline) |
| **Daily check-in** (hygrometer reading or 3 yes/no questions) | Working |
| **Room Scan** with photo upload/camera, result cards, confidence, fixes | Working with **demo results** (labelled "Demo result") |
| **Fix Tracker** + re-scan with before/after score | Working |
| **Dry-Day Planner** (best days to air out / dry laundry) | Working |
| **Read aloud** in English, Cantonese (廣東話) or Mandarin (普通話) | Working (uses the phone's built-in voices) |
| **English / 繁體中文** switch | Working |
| **Family Share** (WhatsApp / share sheet) | Working |
| **Mold Help Guide** | Working |
| Smart plug control, NGO dashboard | **Demo screens only** (clearly labelled future features) |
| Real **Gemini AI** photo scan | Code ready in `api/scan.js`. Turn on in Phase 2 |

**For presentation screenshots:** More → Settings → *Load demo data (for presentation)*.

---

## Files

```
index.html            App page
css/style.css         Design (navy + mint, Green/Amber/Red risk colours, light & dark mode)
js/i18n.js            English + Traditional Chinese text
js/rules.js           Mold Index & Eco-Dry rules (simple IF/THEN logic)
js/weather.js         Hong Kong Observatory open data
js/scan.js            Room scan (demo now, AI in Phase 2)
js/app.js             Screens, check-ins, read aloud, sharing
api/scan.js           Secure server for the Gemini AI scan (Vercel)
sw.js, manifest.webmanifest, icons/   Install-to-home-screen + offline support
```

### The rules (same as our project document)

- **Red:** indoor humidity ≥ 80%, or ≥ 70% for 48 hours, or visible mold in the scan
- **Amber:** indoor humidity 60–79%, or blocked ventilation in the scan
- **Green:** below 60% with no major issues
- **Eco-Dry:** if outside is at least 10 points drier and no rain → "Open your window for 15 minutes"; otherwise → windows closed, dehumidifier / AC dry mode for 1–2 hours.

---

## Try it on your computer

Double-click `index.html`. (Live weather may need it to be hosted online. Otherwise it shows labelled sample weather.)

## Put it online for free (Phase 1: GitHub Pages)

1. Go to github.com → **New repository** → name it `ecoguard-sdu` → Public → Create.
2. Click **uploading an existing file** and drag in **everything inside this folder** (keep the folders).
3. Commit. Then **Settings → Pages → Branch: main → / (root) → Save**.
4. After about 1 minute your app is at `https://<your-username>.github.io/ecoguard-sdu/`.
5. On your phone open that link → **Share → Add to Home Screen**.

## Phase 2: turn on the real AI scan (Vercel + Gemini)

1. Get a free Gemini key: **aistudio.google.com** → *Get API key* → Create. Keep it private. Never put it in the code.
2. Go to **vercel.com** → Sign up with GitHub → **Add New Project** → import `ecoguard-sdu` → Deploy.
3. In Vercel: **Project → Settings → Environment Variables** → add `GEMINI_API_KEY` = your key → Save → **Redeploy**.
4. Open the Vercel link on your phone → More → Settings → turn **off** "Use demo scan results".
5. Scan a room. The badge now says **AI result**.

Notes: the free AI tier has daily limits, so use the AI scan for testing and the demo, and keep demo mode as a backup. Photos are resized on the phone, sent once over HTTPS, and are not stored by our server. On the free tier, Google may use data to improve its products, so a commercial version would use a paid plan that does not keep or train on images (as stated in our Ethical Aspect).

---

## Testing checklist (from our plan)

- [ ] Mold Index shows the right colour for 55%, 65%, 82% check-ins
- [ ] Eco-Dry says "open window" when outside is drier, "dehumidifier" when wetter
- [ ] Scan 10–15 photos (damp corners, blocked windows, clean rooms) in Phase 2
- [ ] 3–5 people (incl. one older adult) do a scan + check-in without help
- [ ] Home screen loads in under 3 s; scan result in about 10 s

*This is a screening tool, not a professional inspection or medical advice.*
