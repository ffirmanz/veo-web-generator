document.addEventListener('DOMContentLoaded', () => {
    const sourceTextArea = document.getElementById('source-text');
    const translatedTextArea = document.getElementById('translated-text');
    const translateBtn = document.getElementById('translate-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    translateBtn.addEventListener('click', async () => {
        const textToTranslate = sourceTextArea.value;
        const userApiKey = apiKeyInput.value;

        if (!userApiKey.trim()) {
            alert('API Key tidak boleh kosong!');
            return;
        }

        if (!textToTranslate.trim()) {
            alert('Teks untuk diterjemahkan tidak boleh kosong!');
            return;
        }

        translateBtn.disabled = true;
        translatedTextArea.value = 'Menerjemahkan...';

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: textToTranslate,
                    apiKey: userApiKey
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan di server.');
            }

            translatedTextArea.value = result.translatedText;

        } catch (error) {
            console.error('Error:', error);
            translatedTextArea.value = `Gagal: ${error.message}`;
        } finally {
            translateBtn.disabled = false;
        }
    });
});
