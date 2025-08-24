const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/translate-text', async (req, res) => {
    const { text, sourceLang = 'id', targetLang = 'en', apiKey } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Key wajib disertakan.' });
    }
    if (!text) {
        return res.status(400).json({ error: 'Teks tidak boleh kosong.' });
    }

    const apiUrl = `https://translation.googleapis.com/v2?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text,
                source: sourceLang,
                target: targetLang
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google API Error: ${errorData.error.message}`);
        }

        const result = await response.json();
        const translatedText = result.data.translations[0].translatedText;
        
        res.json({ translatedText: translatedText });
    } catch (error) {
        console.error("Error saat menerjemahkan:", error.message);
        res.status(500).json({ error: 'Gagal menerjemahkan teks.' });
    }
});

module.exports = app;
