// server.js

const express = require('express');
const cors = require('cors');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const port = 3000;

// Konfigurasi untuk mengizinkan front-end berkomunikasi dengan server ini
app.use(cors());
app.use(express.json());

// Inisialisasi Vertex AI
// Pastikan file credentials.json ada di folder yang sama
process.env.GOOGLE_APPLICATION_CREDENTIALS = './credentials.json';
const vertex_ai = new VertexAI({ project: 'NAMA_PROJECT_ANDA', location: 'us-central1' }); // Ganti dengan nama project & lokasi Anda

// Endpoint untuk generate video
app.post('/generate-video', async (req, res) => {
    // Ambil data dari front-end
    const { prompt, model } = req.body;

    if (!prompt || !model) {
        return res.status(400).json({ error: 'Prompt and model are required.' });
    }

    console.log(`Menerima permintaan: Model=${model}, Prompt="${prompt}"`);

    try {
        // Pilih model generatif
        const generativeModel = vertex_ai.getGenerativeModel({
            model: model, // contoh: 'veo-3.0-generate-preview'
        });

        console.log("Mengirim permintaan ke Google Cloud...");

        // Kirim prompt ke API Veo
        // CATATAN: Struktur request ini adalah contoh dan mungkin perlu disesuaikan
        // dengan dokumentasi resmi Veo saat sudah dirilis penuh.
        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        const resp = await generativeModel.generateContent(request);
        const videoData = resp.response.candidates[0].content.parts[0].fileData; // Asumsi video dikembalikan dalam format ini

        console.log("Menerima respons dari Google Cloud.");

        // Kirim hasil kembali ke front-end
        res.json({
            message: 'Video generated successfully!',
            videoUrl: `data:${videoData.mimeType};base64,${Buffer.from(videoData.data).toString('base64')}` // Mengubah data video menjadi URL
        });

    } catch (error) {
        console.error("ERROR saat memanggil Google Cloud API:", error);
        res.status(500).json({ error: 'Failed to generate video.' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
