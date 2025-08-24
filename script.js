// script.js

document.addEventListener('DOMContentLoaded', () => {
    const sourceTextArea = document.getElementById('source-text');
    const translatedTextArea = document.getElementById('translated-text');
    const translateBtn = document.getElementById('translate-btn');

    translateBtn.addEventListener('click', async () => {
        const textToTranslate = sourceTextArea.value;

        if (!textToTranslate.trim()) {
            alert('Teks tidak boleh kosong!');
            return;
        }

        // Menonaktifkan tombol selama proses
        translateBtn.disabled = true;
        translatedTextArea.value = 'Menerjemahkan...';

        try {
            const response = await fetch('http://localhost:3000/translate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: textToTranslate })
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
            // Mengaktifkan kembali tombol
            translateBtn.disabled = false;
        }
    });
});
