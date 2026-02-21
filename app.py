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

# Configuration - Choose your AI provider
# groq = FREE tier, no credit card. Sign up at https://console.groq.com
AI_PROVIDER = os.getenv('AI_PROVIDER', 'groq').lower()  # Options: 'groq', 'ollama', 'huggingface', 'openai'

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

def translate_medical_to_patient_friendly(transcription):
    """
    Converts medical transcription to patient-friendly summary
    Uses the configured AI provider (Ollama, Hugging Face, or OpenAI)
    """
    prompt = f"""You are a medical assistant helping to translate clinical notes into patient-friendly language. 
    
Convert the following clinical transcription into a clear, easy-to-understand summary for the patient. 
Use simple language, avoid medical jargon, and organize the information in a friendly, reassuring manner.

Clinical Transcription:
{transcription}

Please provide:
1. A brief overview of what was discussed
2. Key findings or observations
3. Recommendations or next steps
4. Any important notes or reminders

Format the response in a clear, structured way that a patient can easily understand."""

    system_prompt = "You are a helpful medical assistant that translates clinical language into patient-friendly summaries."

    try:
        if AI_PROVIDER == 'ollama':
            return use_ollama(system_prompt, prompt)
        elif AI_PROVIDER == 'huggingface':
            return use_huggingface(system_prompt, prompt)
        elif AI_PROVIDER == 'openai':
            return use_openai(system_prompt, prompt)
        else:
            return {"error": f"Unknown AI provider: {AI_PROVIDER}. Use 'ollama', 'huggingface', or 'openai'"}
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
        
        return jsonify(result), 200
    
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

