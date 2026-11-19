const { SlashCommandBuilder } = require('discord.js');
const { askGemini, splitMessage } = require('../utils/gemini');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Tanyakan apa saja ke bot TEN A \'26')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Pertanyaan yang ingin kamu tanyakan')
                .setRequired(true)
        ),

    async execute(interaction) {
        const question = interaction.options.getString('question');

        await interaction.deferReply();

        try {
            const answer = await askGemini(question);
            const chunks = splitMessage(answer, 1950);

            await interaction.editReply({
                content: `> 💬 **Pertanyaan:** ${question.length > 250 ? question.substring(0, 247) + '...' : question}\n\n${chunks[0]}`
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

            return interaction.editReply({
                content: '❌ Terjadi kesalahan saat memproses pertanyaanmu. Silakan coba lagi beberapa saat lagi.'
            });
        }
    }
};