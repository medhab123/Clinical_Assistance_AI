from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Configuration - Use Groq (FREE). Never use OpenAI (paid).
AI_PROVIDER_RAW = (os.getenv('AI_PROVIDER') or 'groq').strip().lower()
# Force groq if openai was set (openai is not free)
AI_PROVIDER = 'groq' if AI_PROVIDER_RAW == 'openai' else AI_PROVIDER_RAW

# Initialize providers based on configuration
openai_client = None
groq_client = None

def get_groq_client():
    """Lazy init for Groq (FREE tier - sign up at console.groq.com)"""
    global groq_client
    if groq_client is None and AI_PROVIDER == 'groq':
        try:
            from groq import Groq
            api_key = (os.getenv('GROQ_API_KEY') or '').strip()
            if api_key:
                groq_client = Groq(api_key=api_key)
        except ImportError:
            print("Warning: groq package not installed. Run: pip install groq")
        except Exception as e:
            print(f"Warning: Error initializing Groq client: {e}")
    return groq_client

def get_openai_client():
    """Lazy initialization of OpenAI client to avoid errors at startup"""
    global openai_client
    if openai_client is None and AI_PROVIDER == 'openai':
        try:
            from openai import OpenAI
            api_key = (os.getenv('OPENAI_API_KEY') or '').strip()
            if api_key:
                openai_client = OpenAI(api_key=api_key)
            else:
                print("Warning: OPENAI_API_KEY not set or empty in environment variables")
        except ImportError:
            print("Warning: OpenAI package not installed. Install with: pip install openai")
        except Exception as e:
            print(f"Warning: Error initializing OpenAI client: {e}")
    return openai_client

def fetch_medical_info_from_api(topic):
    """
    Fetch medical/treatment info from Wikipedia API (free, no API key).
    Returns plain-text excerpt about the condition including treatment when available.
    """
    try:
        import urllib.parse
        title = topic.strip().replace(' ', '_').title()
        url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&titles={urllib.parse.quote(title)}"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        pages = data.get('query', {}).get('pages', {})
        for pid, page in pages.items():
            if pid != '-1' and page.get('extract'):
                return page['extract'][:2000]
        return None
    except Exception:
        return None

_RECOMMENDATIONS_CACHE = None

def _load_recommendations():
    """Load medications and home remedies from JSON file (no APIs needed)."""
    global _RECOMMENDATIONS_CACHE
    if _RECOMMENDATIONS_CACHE is not None:
        return _RECOMMENDATIONS_CACHE
    try:
        p = os.path.join(os.path.dirname(__file__), 'data', 'recommendations.json')
        with open(p, 'r', encoding='utf-8') as f:
            _RECOMMENDATIONS_CACHE = json.load(f)
        return _RECOMMENDATIONS_CACHE
    except Exception:
        _RECOMMENDATIONS_CACHE = {}
        return {}

def _lookup_recommendations(symptom):
    """Look up medications and home remedies for a symptom from JSON. Handles plurals and aliases."""
    data = _load_recommendations()
    s = symptom.strip().lower()
    # Exact match
    if s in data:
        return data[s]
    # Try without trailing 's' (headaches -> headache)
    if s.endswith('s') and s[:-1] in data:
        return data[s[:-1]]
    # Try without trailing 'es' (rashes -> rash)
    if s.endswith('es') and s[:-2] in data:
        return data[s[:-2]]
    # Substring match (sore throat contains throat)
    for key in data:
        if key in s or s in key:
            return data[key]
    return None

def extract_symptoms_from_transcript(transcription):
    """Use LLM to extract only symptoms/conditions mentioned in transcript."""
    client = None
    if AI_PROVIDER == 'groq':
        client = get_groq_client()
    elif AI_PROVIDER == 'ollama':
        pass  # will use requests
    elif AI_PROVIDER == 'openai':
        client = get_openai_client()
    elif AI_PROVIDER == 'huggingface':
        pass

    if not client and AI_PROVIDER not in ('ollama', 'huggingface'):
        return []

    prompt = f"""From this medical visit transcript, list ONLY the symptoms or medical conditions explicitly mentioned.
Return a JSON array of strings, nothing else. Example: ["headache", "cough"]
If no symptoms or conditions are mentioned, return: []

Transcript:
{transcription[:1500]}"""

    try:
        if AI_PROVIDER == 'groq' and client:
            r = client.chat.completions.create(
                model=os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150
            )
            text = r.choices[0].message.content or "[]"
        elif AI_PROVIDER == 'openai' and client:
            r = client.chat.completions.create(
                model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150
            )
            text = r.choices[0].message.content or "[]"
        else:
            return []

        import re
        match = re.search(r'\[[\s\S]*?\]', text)
        if match:
            arr = json.loads(match.group())
            return [str(s).strip().lower() for s in arr if s][:8]
        return []
    except Exception:
        return []

# Common medications for fallback extraction when LLM misses them
MEDICATION_KEYWORDS = [
    "ibuprofen", "acetaminophen", "paracetamol", "aspirin", "amoxicillin",
    "lisinopril", "metformin", "omeprazole", "losartan", "amlodipine",
    "gabapentin", "metoprolol", "atenolol", "hydrochlorothiazide", "sertraline",
    "levothyroxine", "prednisone", "simvastatin", "atorvastatin", "omeprazole",
    "pantoprazole", "azithromycin", "ciprofloxacin", "albuterol", "tramadol",
]

def _fallback_medication_extract(text):
    """Extract medication names from text using keyword matching (when LLM returns empty)."""
    import re
    text_lower = text.lower()
    found = []
    for kw in MEDICATION_KEYWORDS:
        if kw in text_lower:
            found.append(kw.title())
    return list(dict.fromkeys(found))  # dedupe, preserve order

def extract_medications_from_transcript(transcription):
    """Use LLM to extract prescribed/recommended medications from transcript."""
    import re
    client = None
    if AI_PROVIDER == 'groq':
        client = get_groq_client()
    elif AI_PROVIDER == 'openai':
        client = get_openai_client()

    meds_from_llm = []
    if client:
        prompt = f"""From this medical visit transcript, extract ALL medication names mentioned in ANY context.
Include: prescribed, recommended, suggested, or simply said (e.g. "get ibuprofen", "take aspirin", "I need amoxicillin").
Return a JSON array of strings only. Example: ["Ibuprofen", "Amoxicillin"]
If no medications appear, return: []

Transcript:
{transcription[:2000]}"""

        try:
            if AI_PROVIDER == 'groq' and client:
                r = client.chat.completions.create(
                    model=os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=200
                )
                text = r.choices[0].message.content or "[]"
            elif AI_PROVIDER == 'openai' and client:
                r = client.chat.completions.create(
                    model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=200
                )
                text = r.choices[0].message.content or "[]"
            else:
                text = "[]"
            match = re.search(r'\[[\s\S]*?\]', text)
            if match:
                arr = json.loads(match.group())
                meds_from_llm = [str(s).strip() for s in arr if s][:10]
        except Exception:
            pass

    # Fallback: if LLM found nothing, use keyword matching
    if not meds_from_llm:
        meds_from_llm = _fallback_medication_extract(transcription)
    return meds_from_llm

def fetch_nearby_pharmacies(lat, lon, radius_meters=5000):
    """
    Fetch nearby pharmacies using Overpass API (OpenStreetMap) - FREE, no API key.
    Returns list of {name, lat, lon, address, distance_km}.
    """
    try:
        import urllib.parse
        query = f"""[out:json][timeout:15];
(
  node["amenity"="pharmacy"](around:{radius_meters},{lat},{lon});
  way["amenity"="pharmacy"](around:{radius_meters},{lat},{lon});
);
out body center;
"""
        url = "https://overpass-api.de/api/interpreter"
        r = requests.post(url, data={"data": query}, timeout=15)
        r.raise_for_status()
        data = r.json()
        results = []
        seen = set()
        for el in data.get("elements", []):
            lat_el = el.get("lat") or (el.get("center", {}) or {}).get("lat")
            lon_el = el.get("lon") or (el.get("center", {}) or {}).get("lon")
            if lat_el is None or lon_el is None:
                continue
            tags = el.get("tags") or {}
            name = tags.get("name") or tags.get("brand") or "Pharmacy"
            addr = tags.get("addr:street") or tags.get("address") or ""
            if tags.get("addr:city"):
                addr = f"{addr}, {tags['addr:city']}".strip(", ")
            if tags.get("addr:postcode"):
                addr = f"{addr} {tags['addr:postcode']}".strip()
            key = (round(lat_el, 4), round(lon_el, 4), name[:50])
            if key in seen:
                continue
            seen.add(key)
            # Approx distance in km
            import math
            d = math.sqrt((lat - lat_el)**2 + (lon - lon_el)**2) * 111  # ~111km per degree
            results.append({
                "name": name,
                "lat": lat_el,
                "lon": lon_el,
                "address": addr or None,
                "distance_km": round(d, 2),
            })
        results.sort(key=lambda x: x["distance_km"])
        return results[:3]
    except Exception:
        return []

def get_goodrx_search_url(medication):
    """Return GoodRx search URL for a medication (free - user checks prices on GoodRx)."""
    import urllib.parse
    q = medication.split()[0] if medication else ""  # Use generic/first word
    return f"https://www.goodrx.com/search?q={urllib.parse.quote(q)}"

def translate_medical_to_patient_friendly(transcription):
    """
    Converts medical transcription into a patient-friendly summary report.
    Uses Wikipedia API first; falls back to internal JSON file when API fails or returns nothing.
    """
    recommendations_text = ""
    symptoms = extract_symptoms_from_transcript(transcription)
    seen = set()
    for s in symptoms:
        if s and s not in seen and len(s) > 2:
            seen.add(s)
            info = None
            # Try Wikipedia API first
            api_info = fetch_medical_info_from_api(s)
            if api_info and ('treatment' in api_info.lower() or 'medication' in api_info.lower() or 'medicine' in api_info.lower()):
                info = f"--- From Wikipedia for '{s}' ---\n{api_info}"
            else:
                # Fallback: try "X treatment" on Wikipedia
                if not api_info or len((api_info or '').strip()) < 100:
                    extra = fetch_medical_info_from_api(f"{s} treatment")
                    if extra:
                        info = f"--- From Wikipedia for '{s}' ---\n{(api_info or '')}\n{extra}"
                    elif api_info:
                        info = f"--- From Wikipedia for '{s}' ---\n{api_info}"
            # Fallback to JSON if API gave nothing useful
            if not info or len((info or '').strip()) < 50:
                rec = _lookup_recommendations(s)
                if rec:
                    meds = rec.get("medications", [])
                    remedies = rec.get("home_remedies", [])
                    if meds or remedies:
                        info = f"--- Internal fallback for '{s}' ---\n"
                        if meds:
                            info += f"Medications: {', '.join(meds)}\n"
                        if remedies:
                            info += f"Home remedies: {', '.join(remedies)}"
            if info:
                recommendations_text += f"\n\n{info}"

    prompt = f"""You are a medical assistant creating a patient-friendly summary of a clinical visit for a patient with no medical background.

CRITICAL RULES:
- Define every medical term, diagnosis, medication, or procedure in plain language.
- For each medical term you use, add a brief explanation of what it means and what it means for the patient (e.g. "hypertension (high blood pressure)" or "Ibuprofen — a pain reliever you can buy over the counter").
- Use simple everyday language. Avoid jargon without explanation.
- If the doctor used a medical term, translate it AND explain what it means for the patient's health or next steps.

TRANSCRIPTION (what was said during the visit):
{transcription}
"""

    if recommendations_text:
        prompt += f"""

EXTERNAL/INTERNAL MEDICAL INFORMATION (Wikipedia API + fallback data - use for recommendations):
{recommendations_text}

IMPORTANT: You MUST use the data above to provide recommendations. Extract and list:
- **Pharmacy/Medical:** OTC medications, prescriptions, or treatments (e.g. ibuprofen, acetaminophen)
- **Home Remedies:** Self-care, at-home tips (e.g. rest, hydration, heat/cold)
Do NOT say "nothing was discussed" - pull recommendations FROM the data above."""

    prompt += """

Provide a report with:

**Summary of Visit**
Summarize what was ACTUALLY discussed. For EVERY medical term, diagnosis, medication, or procedure mentioned, include its plain-language definition and what it means for the patient (e.g. "The doctor noted hypertension (high blood pressure — when blood pushes too hard against artery walls). This means you may need to watch your salt intake and check your blood pressure regularly."). If only greetings/small talk, say: Mainly greetings and checking in.

**Terms Explained** (REQUIRED when medical discussion occurred)
List each medical term from the visit with: 1) Plain-language definition 2) What it means for the patient. Example:
- Hypertension = High blood pressure; you may need lifestyle changes or medication.
- Ibuprofen = Over-the-counter pain reliever; take with food to protect your stomach.
If no medical terms were used, you may write: No medical terms requiring explanation."""

    if recommendations_text:
        prompt += """

**Recommendations**
You MUST include this section with pharmacy/medical options and home remedies from the data above. List specific suggestions - never say "nothing was discussed" when data is provided."""
    else:
        prompt += """

**Recommendations**
Only include if symptoms were discussed. If the doctor mentioned any medications or advice, include those. If no medical discussion occurred, omit or say "No specific recommendations from this visit." """

    system_prompt = "You create patient-friendly visit summaries for patients with no medical background. You MUST: 1) Define every medical term in plain language 2) Explain what each term means for the patient 3) Include a 'Terms Explained' section listing medical terms with definitions when relevant 4) When medical data is provided, extract pharmacy/medical and home remedy recommendations. Never use medical jargon without explaining it. Never say 'nothing was discussed' when data exists."

    try:
        if AI_PROVIDER == 'groq':
            return use_groq(system_prompt, prompt)
        elif AI_PROVIDER == 'ollama':
            return use_ollama(system_prompt, prompt)
        elif AI_PROVIDER == 'huggingface':
            return use_huggingface(system_prompt, prompt)
        elif AI_PROVIDER == 'openai':
            return use_openai(system_prompt, prompt)
        else:
            return {"error": f"Unknown AI provider: {AI_PROVIDER}. Use 'groq', 'ollama', 'huggingface', or 'openai'"}
    except Exception as e:
        return {"error": f"Error generating summary: {str(e)}"}

def use_groq(system_prompt, user_prompt):
    """Use Groq API - FREE tier, no credit card. Get key at https://console.groq.com"""
    client = get_groq_client()
    api_key = (os.getenv('GROQ_API_KEY') or '').strip()
    
    if not client or not api_key:
        return {
            "error": "Groq API key not set. Get a FREE key at https://console.groq.com (no credit card needed)"
        }
    
    model = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        if not response.choices:
            return {"error": "Groq returned no response. Try again."}
        summary = response.choices[0].message.content
        if not summary or not str(summary).strip():
            return {"error": "Groq returned empty content. Try again."}
        return {"summary": str(summary).strip(), "timestamp": datetime.now().isoformat()}
    except Exception as e:
        err_msg = str(e).lower()
        if 'rate' in err_msg or 'quota' in err_msg or '429' in err_msg:
            return {"error": "Groq rate limit. Wait a minute or try Ollama (fully free, no limits)."}
        if 'auth' in err_msg or 'invalid' in err_msg or '401' in err_msg:
            return {"error": "Invalid Groq API key. Get a free key at https://console.groq.com"}
        return {"error": f"Groq error: {str(e)}"}

def use_ollama(system_prompt, user_prompt):
    """Use Ollama (FREE, runs locally) - No API key needed!"""
    ollama_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    model = os.getenv('OLLAMA_MODEL', 'llama2')  # or 'mistral', 'llama2', etc.
    
    try:
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": model,
                "prompt": f"{system_prompt}\n\n{user_prompt}",
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        result = response.json()
        summary = result.get('response', '')
        return {"summary": summary, "timestamp": datetime.now().isoformat()}
    except requests.exceptions.ConnectionError:
        return {
            "error": "Cannot connect to Ollama. Make sure Ollama is installed and running.\n"
                     "Install from: https://ollama.ai\n"
                     "Then run: ollama pull llama2"
        }
    except Exception as e:
        return {"error": f"Ollama error: {str(e)}"}

def use_huggingface(system_prompt, user_prompt):
    """Use Hugging Face Inference API (FREE tier available)"""
    api_key = os.getenv('HUGGINGFACE_API_KEY')
    model = os.getenv('HUGGINGFACE_MODEL', 'mistralai/Mistral-7B-Instruct-v0.2')
    
    if not api_key:
        return {
            "error": "Hugging Face API key not configured. Get a free key from: https://huggingface.co/settings/tokens"
        }
    
    try:
        headers = {"Authorization": f"Bearer {api_key}"}
        response = requests.post(
            f"https://api-inference.huggingface.co/models/{model}",
            headers=headers,
            json={
                "inputs": f"{system_prompt}\n\n{user_prompt}",
                "parameters": {
                    "max_new_tokens": 1000,
                    "temperature": 0.7
                }
            },
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        
        # Handle different response formats
        if isinstance(result, list) and len(result) > 0:
            summary = result[0].get('generated_text', '')
        elif isinstance(result, dict):
            summary = result.get('generated_text', '')
        else:
            summary = str(result)
        
        return {"summary": summary, "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return {"error": f"Hugging Face error: {str(e)}"}

def use_openai(system_prompt, user_prompt):
    """Use OpenAI API (requires API key, has $5 free trial)"""
    client = get_openai_client()
    
    api_key = (os.getenv('OPENAI_API_KEY') or '').strip()
    if not client:
        if not api_key:
            return {
                "error": "OpenAI API key not configured. Add OPENAI_API_KEY to your .env file. Get a key at: https://platform.openai.com/api-keys"
            }
        return {
            "error": "OpenAI client not initialized. Check that OPENAI_API_KEY is set and pip install openai"
        }
    
    model = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        if not response.choices:
            return {"error": "OpenAI returned no response. Try again."}
        
        summary = response.choices[0].message.content
        if summary is None or (isinstance(summary, str) and not summary.strip()):
            return {"error": "OpenAI returned empty content. Try again or use a different model."}
        
        return {"summary": summary.strip(), "timestamp": datetime.now().isoformat()}
    
    except Exception as e:
        err_msg = str(e).lower()
        if 'authentication' in err_msg or 'invalid_api_key' in err_msg or 'incorrect api key' in err_msg:
            return {"error": "Invalid OpenAI API key. Check your OPENAI_API_KEY in .env"}
        if 'rate' in err_msg or 'quota' in err_msg or 'insufficient' in err_msg:
            return {"error": "OpenAI rate limit or quota exceeded. Check your usage at platform.openai.com"}
        if 'model' in err_msg and ('not found' in err_msg or 'does not exist' in err_msg):
            return {"error": f"OpenAI model '{model}' not found. Try gpt-3.5-turbo or gpt-4 in .env as OPENAI_MODEL"}
        return {"error": f"OpenAI error: {str(e)}"}

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/medscribe')
def medscribe():
    """MedScribe Patient Portal - integrated voice recording + patient-friendly summaries"""
    return send_from_directory('static', 'medscribe.html')

@app.route('/test')
def test():
    """Test page for debugging microphone and speech recognition"""
    return send_from_directory('static', 'test-mic.html')

@app.route('/api/summarize', methods=['POST'])
def summarize():
    """
    Endpoint to receive transcription and return patient-friendly summary
    """
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Invalid JSON. Send {\"transcription\": \"your text here\"}"}), 400
        
        transcription = (data.get('transcription') or '').strip()
        
        if not transcription:
            return jsonify({"error": "No transcription provided. Send {\"transcription\": \"your text here\"}"}), 400
        
        result = translate_medical_to_patient_friendly(transcription)
        
        if "error" in result:
            return jsonify(result), 500

        # Extract medications for pharmacy finder feature
        medications = extract_medications_from_transcript(transcription)
        result["medications"] = medications
        result["medication_price_links"] = [
            {"name": m, "goodrx_url": get_goodrx_search_url(m)}
            for m in medications
        ]

        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/pharmacy-finder', methods=['GET'])
def pharmacy_finder():
    """
    Find nearby pharmacies. Uses Overpass API (free, no key).
    Params: lat, lon, radius (meters, default 5000), medications (optional, comma-separated)
    Returns: pharmacies (with name, address, distance), plus GoodRx links per medication.
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', 5000, type=int)
        meds_str = request.args.get('medications', '')

        if lat is None or lon is None:
            return jsonify({
                "error": "Latitude and longitude required. Example: ?lat=40.7128&lon=-74.0060"
            }), 400

        if radius < 500 or radius > 25000:
            radius = 5000

        medications = [m.strip() for m in meds_str.split(',') if m.strip()]

        pharmacies, fetch_error = fetch_nearby_pharmacies(lat, lon, radius)
        medication_links = [
            {"name": m, "goodrx_url": get_goodrx_search_url(m)}
            for m in medications
        ]

        payload = {
            "pharmacies": pharmacies,
            "medication_price_links": medication_links,
            "location": {"lat": lat, "lon": lon},
            "radius_km": round(radius / 1000, 1),
        }
        if fetch_error and not pharmacies:
            payload["error"] = fetch_error
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/test-openai', methods=['GET'])
def test_openai():
    """Legacy: Test OpenAI. Use /api/test-ai to test current provider."""
    return test_ai_provider()

@app.route('/api/test-ai', methods=['GET'])
def test_ai_provider():
    """Quick test of the configured AI provider."""
    try:
        if AI_PROVIDER == 'groq':
            client = get_groq_client()
            if not client:
                return jsonify({"ok": False, "error": "Get a FREE key at https://console.groq.com and set GROQ_API_KEY in .env"}), 200
            r = client.chat.completions.create(
                model=os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                messages=[{"role": "user", "content": "Reply only: OK"}],
                max_tokens=5
            )
            return jsonify({"ok": True, "message": "Groq API is working"}), 200
        elif AI_PROVIDER == 'openai':
            client = get_openai_client()
            if not client:
                return jsonify({"ok": False, "error": "Set OPENAI_API_KEY in .env"}), 200
            client.chat.completions.create(
                model=os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo'),
                messages=[{"role": "user", "content": "Reply only: OK"}],
                max_tokens=5
            )
            return jsonify({"ok": True, "message": "OpenAI API is working"}), 200
        else:
            result = translate_medical_to_patient_friendly("Test")
            if "error" in result:
                return jsonify({"ok": False, "error": result["error"]}), 200
            return jsonify({"ok": True, "message": f"{AI_PROVIDER} is working"}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 200

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    config_status = {
        "ai_provider": AI_PROVIDER,
        "status": "healthy"
    }
    
    if AI_PROVIDER == 'groq':
        config_status["groq_configured"] = bool(os.getenv('GROQ_API_KEY'))
    elif AI_PROVIDER == 'ollama':
        config_status["ollama_configured"] = True
        config_status["ollama_url"] = os.getenv('OLLAMA_URL', 'http://localhost:11434')
    elif AI_PROVIDER == 'huggingface':
        config_status["huggingface_configured"] = bool(os.getenv('HUGGINGFACE_API_KEY'))
    elif AI_PROVIDER == 'openai':
        config_status["openai_configured"] = bool(os.getenv('OPENAI_API_KEY'))
    
    return jsonify(config_status), 200

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"\n{'='*60}")
    print(f"Clinical Assistant AI Server Starting...")
    print(f"{'='*60}")
    print(f"Server running at: http://localhost:{port}")
    print(f"AI Provider: {AI_PROVIDER}")
    print(f"{'='*60}\n")
    try:
        app.run(debug=True, host='0.0.0.0', port=port)
    except OSError as e:
        if "Address already in use" in str(e) or "address is already in use" in str(e).lower():
            print(f"\nERROR: Port {port} is already in use!")
            print(f"Solutions:")
            print(f"   1. Stop the process using port {port}")
            print(f"   2. Or change PORT in your .env file to a different number (e.g., 5001)")
            print(f"   3. Or run: netstat -ano | findstr :{port} to find the process\n")
        raise

