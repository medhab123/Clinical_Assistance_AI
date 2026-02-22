# Clinical Assistance AI — Documentation

Quick reference and developer guide for the Clinical Assistance AI / MedScribe project.

---

## Overview

A voice-to-text clinical assistant that helps during medical checkups by:

- **Transcribing** doctor–patient conversations (browser Web Speech API)
- **Generating** patient-friendly summaries with plain-language explanations
- **Extracting** symptoms, medications, and recommendations (Wikipedia + internal data)
- **Finding** nearby pharmacies (Overpass/OpenStreetMap) and medication price links (GoodRx)

---

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────────────────────────────┐
│  Web Browser    │◄──────────────────►│  Flask Backend (app.py)                   │
│  (index.html,   │                    │  - /api/summarize                         │
│   medscribe.*)  │                    │  - /api/pharmacy-finder                   │
│                 │                    │  - /api/health, /api/test-ai               │
└─────────────────┘                    └──────────────────────────────────────────┘
        │                                                   │
        │ Web Speech API                                    │
        ▼                                                   ▼
┌─────────────────┐                    ┌──────────────────────────────────────────┐
│  Speech → Text  │                    │  AI Provider (Groq / Ollama / HF / OpenAI)│
└─────────────────┘                    │  + Wikipedia API + recommendations.json   │
                                       └──────────────────────────────────────────┘
```

---

## Project Structure

```
Clinical_Assistance_AI/
├── app.py                    # Flask backend, AI providers, summarization logic
├── requirements.txt          # Python dependencies
├── .env                      # Config (not in git) — copy from env.template
├── env.template              # Example environment variables
│
├── data/
│   └── recommendations.json  # Medications & home remedies by symptom (fallback)
│
├── static/
│   ├── index.html            # Simple landing / basic recording UI
│   ├── medscribe.html        # Full MedScribe patient portal (main UI)
│   ├── medscribe.js          # MedScribe logic: recording, summary, pharmacy finder, profile, reports
│   ├── app.js                # Basic recording UI logic
│   ├── styles.css            # Shared styles
│   ├── test-mic.html         # Microphone / speech recognition test page
│   └── favicon.svg           # App icon
│
├── README.md                 # User-facing setup & usage
├── FREE_SETUP_GUIDE.md       # Free AI provider setup (Ollama, Hugging Face, etc.)
├── DOCUMENTATION.md          # This file
├── setup.bat / run.bat       # Windows helpers
└── start_server.bat          # Start server script
```

---

## Routes & Pages

| Path | Description |
|------|-------------|
| `/` | Serves `index.html` — basic voice recording + summary |
| `/medscribe` | MedScribe patient portal — full UI with reports, pharmacy finder, profile |
| `/test` | Test page for microphone and speech recognition |
| `/api/summarize` | `POST` — generate patient-friendly summary from transcription |
| `/api/pharmacy-finder` | `GET` — find nearby pharmacies by lat/lon |
| `/api/health` | `GET` — health check + AI provider status |
| `/api/test-ai` | `GET` — quick AI provider connectivity test |

---

## API Reference

### POST `/api/summarize`

**Request:**

```json
{ "transcription": "Doctor: You have hypertension. Take lisinopril..." }
```

**Response (success):**

```json
{
  "summary": "**Summary of Visit**\n...",
  "timestamp": "2025-02-21T...",
  "medications": ["Lisinopril", "Ibuprofen"],
  "medication_price_links": [
    { "name": "Lisinopril", "goodrx_url": "https://www.goodrx.com/search?q=Lisinopril" }
  ]
}
```

**Error:** `{ "error": "..." }` with 500 status.

---

### GET `/api/pharmacy-finder`

**Query params:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `lat` | float | ✓ | — | Latitude |
| `lon` | float | ✓ | — | Longitude |
| `radius` | int | no | 5000 | Search radius in meters (500–25000) |
| `medications` | string | no | — | Comma-separated med names (for GoodRx links) |

**Example:** `?lat=40.7128&lon=-74.0060&radius=5000`

**Response:**

```json
{
  "pharmacies": [
    { "name": "CVS", "lat": 40.71, "lon": -74.00, "address": "123 Main St", "distance_km": 0.5 }
  ],
  "medication_price_links": [...],
  "location": { "lat": 40.7128, "lon": -74.006 },
  "radius_km": 5.0
}
```

---

## AI Providers

Configure via `AI_PROVIDER` in `.env`:

| Provider | `.env` key | Notes |
|----------|------------|-------|
| **Groq** | `AI_PROVIDER=groq` | Default, free tier. Needs `GROQ_API_KEY`. |
| **Ollama** | `AI_PROVIDER=ollama` | Fully local, no API key. Uses `OLLAMA_URL`, `OLLAMA_MODEL`. |
| **Hugging Face** | `AI_PROVIDER=huggingface` | Free tier. Needs `HUGGINGFACE_API_KEY`. |
| **OpenAI** | `AI_PROVIDER=openai` | Paid. Uses `OPENAI_API_KEY`. |

If `AI_PROVIDER=openai` is set, the app overrides it to `groq` to avoid accidental paid usage.

---

## Data Sources

| Source | Purpose |
|--------|---------|
| **Wikipedia API** | Medical condition info, treatment excerpts |
| **recommendations.json** | Fallback medications & home remedies by symptom |
| **Overpass API** (OSM) | Nearby pharmacies (no API key) |
| **GoodRx** | Links for medication price lookup (no API) |

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | `groq` / `ollama` / `huggingface` / `openai` | `groq` |
| `GROQ_API_KEY` | Groq API key | — |
| `GROQ_MODEL` | Groq model name | `llama-3.3-70b-versatile` |
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model | `llama2` |
| `HUGGINGFACE_API_KEY` | Hugging Face token | — |
| `HUGGINGFACE_MODEL` | HF model | `mistralai/Mistral-7B-Instruct-v0.2` |
| `OPENAI_API_KEY` | OpenAI key | — |
| `OPENAI_MODEL` | OpenAI model | `gpt-3.5-turbo` |
| `PORT` | Server port | `5000` |

---

## MedScribe UI (Patient Portal)

Main features in `medscribe.js`:

- **Recording** — Start/stop transcription via Web Speech API
- **Summary** — Calls `/api/summarize`, shows report with terms explained
- **Pharmacy finder** — Geolocation + `/api/pharmacy-finder`, GoodRx links
- **Reports** — LocalStorage-backed list of past summaries
- **Profile** — Name, initials, contact (saved in LocalStorage)
- **Preferences** — Theme (light/dark), font size, reduced motion
- **Checklist** — Pre-visit form (reason, symptoms, meds, allergies)

---

## Quick Start

```bash
# 1. Create venv
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# 2. Install
pip install -r requirements.txt

# 3. Configure (copy env.template to .env, set AI_PROVIDER and keys)
cp env.template .env

# 4. Run
python app.py
# → http://localhost:5000
# → http://localhost:5000/medscribe  (full patient portal)
```

---

## Security & Compliance

- Do not commit `.env` — it is gitignored.
- This tool processes clinical data; consider HIPAA and local regulations before production use.
- Add authentication and secure deployment if used in a clinical environment.

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Speech recognition fails | Use Chrome/Edge/Safari; HTTPS may be required in production |
| AI errors | Verify `GROQ_API_KEY` / `OLLAMA_URL` / etc. in `.env`; test with `/api/test-ai` |
| Port in use | Change `PORT` in `.env` or stop the process using that port |
| No pharmacies | Ensure valid lat/lon; Overpass API can have regional coverage limits |
