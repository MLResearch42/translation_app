class TranslationApp {
    constructor() {
        this.apiKey = 'YOUR_OPENAI_API_KEY_HERE';
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.maxRetries = 3;
        this.requestDelay = 1000;
        this.lastRequestTime = 0;
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateCharacterCount();
    }

    initializeElements() {
        this.englishInput = document.getElementById('english-input');
        this.spanishOutput = document.getElementById('spanish-output');
        this.translateBtn = document.getElementById('translate-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.copyBtn = document.getElementById('copy-btn');
        this.characterCount = document.querySelector('.character-count');
        this.errorMessage = document.getElementById('error-message');
        this.btnText = document.querySelector('.btn-text');
        this.loadingSpinner = document.querySelector('.loading-spinner');
    }

    attachEventListeners() {
        this.translateBtn.addEventListener('click', () => this.handleTranslate());
        this.clearBtn.addEventListener('click', () => this.handleClear());
        this.copyBtn.addEventListener('click', () => this.handleCopy());
        
        this.englishInput.addEventListener('input', () => this.updateCharacterCount());
        this.englishInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleTranslate();
            }
        });

        this.spanishOutput.addEventListener('input', () => this.updateCopyButton());
    }

    updateCharacterCount() {
        const count = this.englishInput.value.length;
        this.characterCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
        
        if (count > 5000) {
            this.characterCount.style.color = '#e53e3e';
        } else if (count > 3000) {
            this.characterCount.style.color = '#ed8936';
        } else {
            this.characterCount.style.color = '#718096';
        }
    }

    updateCopyButton() {
        const hasContent = this.spanishOutput.value.trim().length > 0;
        this.copyBtn.style.display = hasContent ? 'flex' : 'none';
    }

    async handleTranslate() {
        const inputText = this.englishInput.value.trim();
        
        if (!this.validateInput(inputText)) {
            return;
        }

        if (!this.validateApiKey()) {
            this.showError('Please add your OpenAI API key to the script.js file');
            return;
        }

        await this.performTranslation(inputText);
    }

    validateInput(inputText) {
        this.hideError();

        if (!inputText) {
            this.showError('Please enter some English text to translate');
            this.englishInput.focus();
            return false;
        }

        if (inputText.length > 8000) {
            this.showError('Text is too long. Please limit to 8000 characters or less');
            return false;
        }

        if (!/[a-zA-Z]/.test(inputText)) {
            this.showError('Please enter valid English text');
            return false;
        }

        return true;
    }

    validateApiKey() {
        return this.apiKey && this.apiKey !== 'YOUR_OPENAI_API_KEY_HERE' && this.apiKey.startsWith('sk-');
    }

    async performTranslation(inputText) {
        await this.enforceRateLimit();
        
        this.setLoadingState(true);
        
        try {
            const translation = await this.translateWithRetry(inputText);
            this.displayTranslation(translation);
        } catch (error) {
            this.handleTranslationError(error);
        } finally {
            this.setLoadingState(false);
        }
    }

    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.requestDelay) {
            const waitTime = this.requestDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }

    async translateWithRetry(inputText, retryCount = 0) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional English to Spanish translator. Translate the given English text to Spanish accurately, maintaining the original meaning, tone, and style. Provide only the Spanish translation without any additional explanation or commentary.'
                        },
                        {
                            role: 'user',
                            content: `Translate this English text to Spanish: "${inputText}"`
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                if (response.status === 429 && retryCount < this.maxRetries) {
                    const waitTime = Math.pow(2, retryCount) * 2000;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.translateWithRetry(inputText, retryCount + 1);
                }
                
                const errorData = await response.json();
                throw new Error(this.getErrorMessage(response.status, errorData));
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenAI API');
            }

            return data.choices[0].message.content.trim();
        } catch (error) {
            if (retryCount < this.maxRetries && this.isRetryableError(error)) {
                const waitTime = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.translateWithRetry(inputText, retryCount + 1);
            }
            throw error;
        }
    }

    isRetryableError(error) {
        return error.name === 'TypeError' || 
               error.message.includes('network') || 
               error.message.includes('timeout') ||
               error.message.includes('rate limit');
    }

    getErrorMessage(status, errorData) {
        switch (status) {
            case 401:
                return 'Invalid API key. Please check your OpenAI API key';
            case 429:
                return 'Too many requests. Please wait a moment and try again';
            case 500:
            case 502:
            case 503:
                return 'OpenAI service is temporarily unavailable. Please try again later';
            default:
                return errorData?.error?.message || `API request failed with status ${status}`;
        }
    }

    displayTranslation(translation) {
        this.spanishOutput.value = translation;
        this.spanishOutput.classList.add('fade-in');
        this.updateCopyButton();
        
        setTimeout(() => {
            this.spanishOutput.classList.remove('fade-in');
        }, 500);
    }

    handleTranslationError(error) {
        console.error('Translation error:', error);
        this.showError(error.message || 'Translation failed. Please try again');
    }

    setLoadingState(loading) {
        this.translateBtn.disabled = loading;
        this.btnText.style.display = loading ? 'none' : 'inline';
        this.loadingSpinner.style.display = loading ? 'flex' : 'none';
    }

    handleClear() {
        this.englishInput.value = '';
        this.spanishOutput.value = '';
        this.updateCharacterCount();
        this.updateCopyButton();
        this.hideError();
        this.englishInput.focus();
    }

    async handleCopy() {
        try {
            await navigator.clipboard.writeText(this.spanishOutput.value);
            
            const originalIcon = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
            `;
            this.copyBtn.style.background = '#48bb78';
            
            setTimeout(() => {
                this.copyBtn.innerHTML = originalIcon;
                this.copyBtn.style.background = '#667eea';
            }, 2000);
        } catch (error) {
            this.showError('Failed to copy translation to clipboard');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            this.hideError();
        }, 10000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TranslationApp();
});