// File: api/translate.js (Versi Definitif Tanpa Express)

export default async function handler(request, response) {
  // Hanya izinkan metode POST
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).end('Method Not Allowed');
  }

  try {
    // Ambil data dari body request
    const { text, sourceLang = 'id', targetLang = 'en', apiKey } = request.body;

    if (!apiKey) {
      return response.status(400).json({ error: 'API Key wajib disertakan.' });
    }
    if (!text) {
      return response.status(400).json({ error: 'Teks tidak boleh kosong.' });
    }

    const apiUrl = `https://translation.googleapis.com/v2?key=${apiKey}`;

    // Lakukan panggilan ke Google Translate API
    const googleApiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
      }),
    });

    // Tangani jika Google API mengembalikan error
    if (!googleApiResponse.ok) {
      const errorData = await googleApiResponse.json();
      throw new Error(`Google API Error: ${errorData.error.message}`);
    }

    const result = await googleApiResponse.json();
    const translatedText = result.data.translations[0].translatedText;

    // Kirim respons sukses kembali ke frontend
    return response.status(200).json({ translatedText: translatedText });

  } catch (error) {
    // Tangani error internal
    console.error("Error di serverless function:", error.message);
    return response.status(500).json({ error: 'Gagal menerjemahkan teks.' });
  }
}
