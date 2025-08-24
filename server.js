// server.js

const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Ambil API Key dari environment variable. Ini cara yang aman.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("KESALAHAN: GOOGLE_API_KEY belum diatur. Jalankan server dengan benar.");
    process.exit(1);
}

// Endpoint untuk menerjemahkan teks
app.post('/translate-text', async (req, res) => {
    const { text, sourceLang = 'id', targetLang = 'en' } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Teks tidak boleh kosong.' });
    }

    const apiUrl = `https://translation.googleapis.com/v2?key=${GOOGLE_API_KEY}`;

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

app.listen(port, () => {
    console.log(`🚀 Server penerjemah berjalan di http://localhost:${port}`);
});
