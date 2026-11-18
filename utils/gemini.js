const { GoogleGenAI } = require('@google/genai');

/**
 * Mengirim pertanyaan ke Google Gemini API
 * @param {string} prompt Pertanyaan pengguna
 * @returns {Promise<string>} Jawaban dari Gemini
 */
async function askGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
        const error = new Error('MISSING_API_KEY');
        error.code = 'MISSING_API_KEY';
        throw error;
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    // Daftar model aktif Gemini yang didukung saat ini
    const modelsToTry = [
        process.env.GEMINI_MODEL,
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.7-flash',
        'gemini-3.1-flash-lite'
    ].filter(Boolean);

    const uniqueModels = [...new Set(modelsToTry)];
    let lastError = null;

    for (const model of uniqueModels) {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
            });

            if (response && response.text) {
                return response.text;
            }
        } catch (err) {
            lastError = err;
            console.warn(`[GEMINI] Percobaan model "${model}" gagal:`, err.message || err);
        }
    }

    throw lastError || new Error('Gagal mendapatkan balasan dari Gemini API.');
}

/**
 * Helper memecah teks jawaban panjang (> 2000 karakter) agar tidak ditolak Discord
 * @param {string} text Teks yang ingin dipecah
 * @param {number} maxLength Batas maksimal panjang per pesan (default 1950)
 * @returns {string[]} Array potongan teks
 */
function splitMessage(text, maxLength = 1950) {
    if (text.length <= maxLength) return [text];

    const chunks = [];
    let current = '';

    const lines = text.split('\n');
    for (const line of lines) {
        if ((current + '\n' + line).length > maxLength) {
            if (current.trim()) chunks.push(current.trim());
            // Jika satu baris sendiri lebih panjang dari maxLength
            if (line.length > maxLength) {
                let remaining = line;
                while (remaining.length > maxLength) {
                    chunks.push(remaining.substring(0, maxLength));
                    remaining = remaining.substring(maxLength);
                }
                current = remaining;
            } else {
                current = line;
            }
        } else {
            current = current ? current + '\n' + line : line;
        }
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
}

module.exports = {
    askGemini,
    splitMessage
};
