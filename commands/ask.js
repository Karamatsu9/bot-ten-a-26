const { SlashCommandBuilder } = require('discord.js');
const { askGemini, splitMessage } = require('../utils/gemini');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Tanyakan apa saja atau analisis file ke bot TEN A \'26')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Pertanyaan atau instruksi untuk file yang dilampirkan')
                .setRequired(false)
        )
        .addAttachmentOption(opt =>
            opt.setName('file')
                .setDescription('Lampiran file (PDF, gambar, TXT, CSV, JSON, dll.)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const rawQuestion = interaction.options.getString('question');
        const attachment = interaction.options.getAttachment('file');

        if (!rawQuestion && !attachment) {
            return interaction.reply({
                content: '⚠️ Masukkan pertanyaan pada opsi `question` atau lampirkan file pada opsi `file`!',
                ephemeral: true
            });
        }

        const question = rawQuestion || 'Tolong baca, rangkum, dan jelaskan isi dari file yang dilampirkan ini.';
        const attachments = attachment ? [attachment] : [];

        await interaction.deferReply();

        try {
            const answer = await askGemini(question, attachments);
            const chunks = splitMessage(answer, 1950);

            const fileBadge = attachment ? `\n> 📎 **Lampiran:** \`${attachment.name}\`` : '';
            const shortQuestion = question.length > 250 ? question.substring(0, 247) + '...' : question;

            await interaction.editReply({
                content: `> 💬 **Pertanyaan:** ${shortQuestion}${fileBadge}\n\n${chunks[0]}`
            });

            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp({ content: chunks[i] });
            }
        } catch (error) {
            console.error('Error pada /ask command:', error);
            if (error.code === 'MISSING_API_KEY' || error.message === 'MISSING_API_KEY') {
                return interaction.editReply({
                    content: '⚠️ **Gemini API Key belum dimasukkan!**\nSilakan buka file `.env` dan masukkan API Key Anda pada `GEMINI_API_KEY=...` (Bisa didapatkan gratis di [Google AI Studio](https://aistudio.google.com/app/apikey)).'
                });
            }
            if (error.code === 'FILE_TOO_LARGE' || error.code === 'UNSUPPORTED_FILE_TYPE') {
                return interaction.editReply({
                    content: `⚠️ ${error.message}\nFormat yang didukung: **PDF, gambar (PNG/JPG/WEBP), file teks/data (TXT, CSV, JSON, MD), serta audio/video** (maks. 15 MB). *(Untuk file Word/Excel/PPT, silakan export ke PDF terlebih dahulu).*`
                });
            }

            return interaction.editReply({
                content: '❌ Terjadi kesalahan saat memproses pertanyaan atau filemu. Silakan coba lagi beberapa saat lagi.'
            });
        }
    }
};