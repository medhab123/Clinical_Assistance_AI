# 🆓 Free Setup Guide - No Payment Required!

This guide shows you how to use this tool **completely FREE** without paying for any API services.

## 🥇 Best Option: Ollama (100% Free, No API Key Needed!)

### Why Ollama?
- ✅ **Completely free** - No API keys, no limits
- ✅ **Runs locally** - Your data stays on your computer (privacy!)
- ✅ **No internet required** after setup
- ✅ **No credit card needed**

### Quick Setup (5 minutes):

1. **Download Ollama**
   - Windows: https://ollama.ai/download/windows
   - Mac: https://ollama.ai/download/mac
   - Linux: https://ollama.ai/download/linux

2. **Install and run Ollama**
   - Just double-click the installer
   - Ollama will start automatically

3. **Download a free AI model** (choose one):
   ```bash
   # Option A: Llama 2 (smaller, faster)
   ollama pull llama2
   
   # Option B: Mistral (better quality, recommended)
   ollama pull mistral
   
   # Option C: Llama 2 13B (best quality, needs more RAM)
   ollama pull llama2:13b
   ```

4. **Create your `.env` file**:
   ```env
   AI_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama2
   PORT=5000
   ```
   (Use `mistral` instead of `llama2` if you downloaded Mistral)

5. **Run the app**:
   ```bash
   python app.py
   ```

**That's it!** No API keys, no payments, no limits! 🎉

---

## 🥈 Alternative: Hugging Face (Free Tier)

### Why Hugging Face?
- ✅ **Free tier** with generous limits
- ✅ **No credit card required**
- ✅ **Cloud-based** (no local setup)

### Setup:

1. **Sign up for free** at https://huggingface.co
2. **Get your free API token**:
   - Go to https://huggingface.co/settings/tokens
   - Click "New token"
   - Name it (e.g., "clinical-assistant")
   - Copy the token

3. **Create your `.env` file**:
   ```env
   AI_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=your_token_here
   HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
   PORT=5000
   ```

4. **Run the app**:
   ```bash
   python app.py
   ```

---

## 🥉 Last Resort: OpenAI Free Trial

If you want to try OpenAI (not recommended for long-term free use):

1. **Sign up** at https://platform.openai.com
2. **Get $5 free credits** (expires in 3 months)
3. **Create API key** at https://platform.openai.com/api-keys
4. **Create your `.env` file**:
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_key_here
   OPENAI_MODEL=gpt-3.5-turbo
   PORT=5000
   ```

⚠️ **Note**: After $5 runs out, you'll need to pay. Use Ollama instead for truly free usage!

---

## 💡 Recommendation

**Use Ollama** - It's the easiest, most private, and completely free option. Once set up, you never need to worry about API keys or payments again!

## ❓ Troubleshooting

### Ollama not connecting?
- Make sure Ollama is running (check system tray/taskbar)
- Try: `ollama serve` in terminal
- Check if port 11434 is available

### Model not found?
- Make sure you downloaded the model: `ollama pull llama2`
- Check your `.env` file matches the model name

### Need help?
- Ollama docs: https://github.com/ollama/ollama
- Check the main README.md for more details

