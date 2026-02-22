# Clinical Assistance AI - Voice to Text Doctor's Assistant

A web-based voice-to-text clinical assistant tool that helps doctors during checkups by transcribing conversations and generating patient-friendly summaries of medical consultations.

## Features

- 🎤 **Real-time Voice Transcription**: Uses browser-based speech recognition to capture doctor-patient conversations
- 🤖 **AI-Powered Summarization**: Converts medical terminology into patient-friendly language
- 🆓 **FREE Options Available**: Use Ollama (completely free) or Hugging Face (free tier)
- 📝 **Clear Documentation**: Generates structured summaries with key findings, recommendations, and next steps
- 💻 **Modern Web Interface**: Clean, intuitive UI designed for clinical use
- 🔒 **Privacy-Focused**: All processing happens server-side (or locally with Ollama)

## 🆓 Want to Use It FREE?

**See [FREE_SETUP_GUIDE.md](FREE_SETUP_GUIDE.md) for step-by-step instructions!**

Quick answer: Use **Ollama** - it's 100% free, no API key needed, and runs locally on your computer!

## Prerequisites

- Python 3.8 or higher
- Modern web browser with speech recognition support (Chrome, Edge, or Safari)
- **AI Provider** (choose one):
  - **Ollama** (FREE, recommended) - No API key needed!
  - **Hugging Face** (FREE tier) - Free API key available
  - **OpenAI** (Paid, but $5 free trial) - Optional

## Installation

1. **Clone or navigate to the project directory**

2. **Create a virtual environment (recommended)**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Choose and configure your AI provider**

   Create a `.env` file in the project root. Choose ONE of the following options:

   ### Option 1: Ollama (FREE - Recommended! No API key needed)
   ```env
   AI_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama2
   PORT=5000
   ```
   
   **Setup Ollama:**
   1. Download from https://ollama.ai
   2. Install and run Ollama
   3. Download a model: `ollama pull llama2` (or `ollama pull mistral` for better quality)
   4. That's it! No API key needed.

   ### Option 2: Hugging Face (FREE tier available)
   ```env
   AI_PROVIDER=huggingface
   HUGGINGFACE_API_KEY=your_free_api_key_here
   HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
   PORT=5000
   ```
   
   **Get free Hugging Face API key:**
   1. Sign up at https://huggingface.co (free)
   2. Go to https://huggingface.co/settings/tokens
   3. Create a new token (free tier allows many requests)

   ### Option 3: OpenAI (Paid, but $5 free trial)
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-3.5-turbo
   PORT=5000
   ```
   
   **Get OpenAI API key:**
   1. Sign up at https://platform.openai.com
   2. Get $5 in free credits (expires in 3 months)
   3. Create API key at https://platform.openai.com/api-keys

## Usage

1. **Start the Flask server**
   ```bash
   python app.py
   ```

2. **Open your browser**
   
   Navigate to `http://localhost:5000`

3. **Use the application**
   - Click "Start Recording" to begin voice transcription
   - Speak clearly during the checkup
   - Click "Stop Recording" when finished
   - Click "Generate Summary" to create a patient-friendly summary
   - Use "Clear" to reset and start a new session

## How It Works

1. **Voice Capture**: The browser's Web Speech API captures audio and converts it to text in real-time
2. **Transcription**: The transcribed text is displayed as you speak
3. **AI Processing**: When you generate a summary, the transcription is sent to OpenAI's GPT-4 model
4. **Translation**: The AI converts medical jargon into patient-friendly language
5. **Summary Display**: A clear, structured summary is displayed for easy sharing with patients

**📖 For developers:** See [DOCUMENTATION.md](DOCUMENTATION.md) for API reference, architecture, and technical details.

## Project Structure

```
Clinical_Assistance_AI/
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── .gitignore            # Git ignore file
├── README.md             # This file
└── static/
    ├── index.html        # Main HTML interface
    ├── styles.css        # Styling
    └── app.js            # Frontend JavaScript
```

## API Endpoints

- `GET /` - Serves the main web interface
- `POST /api/summarize` - Generates patient-friendly summary from transcription
- `GET /api/health` - Health check endpoint

## Configuration

### OpenAI Model

By default, the application uses GPT-4. You can modify the model in `app.py`:
```python
response = client.chat.completions.create(
    model="gpt-4",  # Change to "gpt-3.5-turbo" for faster/cheaper option
    ...
)
```

### Server Port

Change the port by setting the `PORT` environment variable or modifying the default in `app.py`.

## Security Notes

- Never commit your `.env` file to version control
- Keep your OpenAI API key secure
- Consider implementing authentication for production use
- Be aware of HIPAA compliance requirements for clinical data

## Troubleshooting

**Speech recognition not working:**
- Ensure you're using a supported browser (Chrome, Edge, or Safari)
- Check microphone permissions in your browser settings
- Use HTTPS in production (required for some browsers)

**OpenAI API errors:**
- Verify your API key is correct in the `.env` file
- Check your OpenAI account has sufficient credits
- Ensure you have access to the GPT-4 model

**Port already in use:**
- Change the `PORT` in your `.env` file
- Or kill the process using the port

## License

This project is provided as-is for clinical use. Please ensure compliance with all relevant healthcare regulations (HIPAA, etc.) before using in production.

## Contributing

Feel free to submit issues or pull requests to improve this tool!