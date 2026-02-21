class ClinicalAssistant {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.transcription = '';
        this.finalTranscript = '';
        this.shouldAutoRestart = false;
        
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.attachEventListeners();
    }

    initializeElements() {
        this.recordButton = document.getElementById('recordButton');
        this.stopButton = document.getElementById('stopButton');
        this.clearButton = document.getElementById('clearButton');
        this.generateSummaryButton = document.getElementById('generateSummaryButton');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.statusDot = document.querySelector('.status-dot');
        this.transcriptionBox = document.getElementById('transcription');
        this.summaryBox = document.getElementById('summary');
    }

    initializeSpeechRecognition() {
        // Check browser support - do NOT request mic permission here (browsers block it without user click)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            this.recognition = null;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.isRecording = true;
            this.updateUI('recording');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            this.finalTranscript += finalTranscript;
            this.transcription = this.finalTranscript + interimTranscript;
            this.updateTranscription();
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isRecording = false;
            
            let errorMessage = 'Unknown error occurred';
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please speak clearly.';
                    // Auto-restart if no speech detected
                    if (this.isRecording) {
                        setTimeout(() => {
                            if (this.isRecording) {
                                try {
                                    this.recognition.start();
                                } catch (e) {
                                    console.log('Could not restart:', e);
                                }
                            }
                        }, 1000);
                    }
                    break;
                case 'audio-capture':
                    errorMessage = 'No microphone found. Please check your microphone.';
                    this.updateUI('error');
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied. Please allow access and refresh.';
                    this.updateUI('error');
                    break;
                case 'network':
                    errorMessage = 'Network error. Please check your connection.';
                    this.updateUI('error');
                    break;
                case 'aborted':
                    // User stopped, don't show error
                    return;
                default:
                    errorMessage = `Speech recognition error: ${event.error}`;
                    this.updateUI('error');
            }
            
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                this.showError(errorMessage);
            }
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.isRecording = false;
            
            // Auto-restart if we were recording (continuous mode)
            if (this.shouldAutoRestart) {
                setTimeout(() => {
                    if (this.shouldAutoRestart && !this.isRecording) {
                        try {
                            this.recognition.start();
                        } catch (e) {
                            console.log('Could not auto-restart:', e);
                            this.shouldAutoRestart = false;
                            this.updateUI('stopped');
                        }
                    }
                }, 100);
            } else {
                if (this.finalTranscript.trim()) {
                    this.updateUI('stopped');
                } else {
                    this.updateUI('ready');
                }
            }
        };
    }

    attachEventListeners() {
        if (!this.recordButton) {
            console.error('Record button not found!');
            return;
        }
        this.recordButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.stopButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        this.clearButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearAll();
        });
        this.generateSummaryButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.generateSummary();
        });
    }

    async startRecording() {
        // Immediate feedback so user knows the click worked
        this.statusText.textContent = 'Requesting microphone...';
        this.recordButton.disabled = true;

        if (!this.recognition) {
            this.recordButton.disabled = false;
            this.showError('Speech recognition is not supported. Please use Chrome, Edge, or Safari.');
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.recordButton.disabled = false;
            this.showError('Microphone access is not available. Use Chrome or Edge and ensure you are on https:// or localhost.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            this.recordButton.disabled = false;
            this.updateUI('ready');
            const msg = err.name === 'NotAllowedError' 
                ? 'Microphone permission denied. Please click Allow when prompted, or check your browser settings.'
                : 'Microphone error: ' + (err.message || err.name || 'Unknown error');
            this.showError(msg);
            return;
        }

        this.finalTranscript = '';
        this.transcription = '';
        this.updateTranscription();
        this.shouldAutoRestart = true;
        
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Error starting recognition:', e);
            this.recordButton.disabled = false;
            this.updateUI('ready');
            if (e.message && e.message.includes('already started')) {
                this.isRecording = true;
                this.updateUI('recording');
            } else {
                this.showError('Failed to start recording: ' + (e.message || 'Please try again.'));
            }
        }
    }

    stopRecording() {
        this.shouldAutoRestart = false;
        if (this.recognition && this.isRecording) {
            try {
                this.recognition.stop();
            } catch (e) {
                console.error('Error stopping recognition:', e);
            }
        }
        this.isRecording = false;
        this.updateUI('stopped');
    }

    clearAll() {
        this.finalTranscript = '';
        this.transcription = '';
        this.updateTranscription();
        this.summaryBox.innerHTML = '<p class="placeholder">Summary will be generated after you stop recording...</p>';
        this.generateSummaryButton.disabled = true;
        this.updateUI('ready');
    }

    updateUI(state) {
        switch (state) {
            case 'recording':
                this.statusText.textContent = 'Recording...';
                this.statusDot.classList.add('recording');
                this.recordButton.disabled = true;
                this.stopButton.disabled = false;
                this.generateSummaryButton.disabled = true;
                break;
            case 'stopped':
                this.statusText.textContent = 'Recording stopped';
                this.statusDot.classList.remove('recording');
                this.recordButton.disabled = false;
                this.stopButton.disabled = true;
                this.generateSummaryButton.disabled = !this.finalTranscript.trim();
                break;
            case 'ready':
                this.statusText.textContent = 'Ready to record';
                this.statusDot.classList.remove('recording');
                this.recordButton.disabled = false;
                this.stopButton.disabled = true;
                this.generateSummaryButton.disabled = true;
                break;
            case 'error':
                this.statusText.textContent = 'Error occurred';
                this.statusDot.classList.remove('recording');
                this.recordButton.disabled = false;
                this.stopButton.disabled = true;
                break;
        }
    }

    updateTranscription() {
        if (this.transcription.trim()) {
            // Escape HTML to prevent XSS
            const escaped = this.transcription
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            this.transcriptionBox.innerHTML = `<p>${escaped}</p>`;
        } else {
            this.transcriptionBox.innerHTML = '<p class="placeholder">Your transcription will appear here...</p>';
        }
    }

    showError(message) {
        // Show error in status
        this.statusText.textContent = 'Error: ' + message;
        this.statusText.style.color = '#f44336';
        setTimeout(() => {
            if (!this.isRecording) {
                this.statusText.style.color = '';
                this.statusText.textContent = 'Ready to record';
            }
        }, 5000);
        
        // Also show alert for important errors
        alert(message);
    }

    async generateSummary() {
        if (!this.finalTranscript.trim()) {
            alert('No transcription available to summarize.');
            return;
        }

        this.generateSummaryButton.disabled = true;
        this.summaryBox.innerHTML = '<p class="placeholder">Generating summary... <span class="loading"></span></p>';

        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcription: this.finalTranscript
                })
            });

            const data = await response.json();

            if (response.ok && data.summary) {
                // Format the summary with line breaks
                const formattedSummary = data.summary.replace(/\n/g, '<br>');
                this.summaryBox.innerHTML = `<p>${formattedSummary}</p>`;
            } else {
                this.summaryBox.innerHTML = `<p style="color: #f44336;">Error: ${data.error || 'Failed to generate summary'}</p>`;
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            this.summaryBox.innerHTML = `<p style="color: #f44336;">Error: ${error.message}</p>`;
        } finally {
            this.generateSummaryButton.disabled = false;
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        const assistant = new ClinicalAssistant();
        window.clinicalAssistant = assistant; // for debugging in console
        
        console.log('Clinical Assistant loaded. Speech Recognition:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
        
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            assistant.showError('For microphone access, use https:// or open via localhost');
        }
    } catch (err) {
        console.error('Failed to initialize Clinical Assistant:', err);
        alert('Failed to load: ' + (err.message || err));
    }
});

