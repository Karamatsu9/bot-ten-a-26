const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Menampilkan menu bantuan dan daftar perintah bot'),
    async execute(interaction) {
        const prefix = storage.getGuildPrefix(interaction.guildId);

        const helpEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Daftar Perintah Bot')
            .setDescription(`Prefix bot saat ini di server ini adalah: \`${prefix}\`\nBerikut perintah yang bisa kamu gunakan:`)
            .addFields(
                { 
                    name: '🔒 Private Room System', 
                    value: '`/create-private-channel` - Buat private text channel & undang member lain\n`/delete-private-channel` - Hapus private room beserta rolenya saat urusan selesai\n`/set-private-category` - Atur kategori Discord tempat private channel dibuat (Moderator/Admin)' 
                },
                { 
                    name: '✨ Gemini AI', 
                    value: `\`${prefix}ask <pertanyaan>\` atau \`${prefix} <pertanyaan>\` - Tanya apa saja ke Gemini AI\n\`/ask\` - Versi Slash Command untuk bertanya ke AI` 
                },
                { 
                    name: '🤖 Perintah Umum (Semua Member)', 
                    value: `\`${prefix}ping\` atau \`/ping\` - Cek kecepatan respon bot\n\`${prefix}halo\` - Sapa bot\n\`${prefix}help\` atau \`/help\` - Menampilkan menu bantuan ini` 
                },
                { 
                    name: '⚙️ Pengaturan Admin (Hanya Administrator)', 
                    value: `\`${prefix}setprefix <prefix_baru>\` atau \`/setprefix\` - Mengubah prefix perintah bot\n\`/autorespond add\` - Tambah trigger kata, embed, & gambar\n\`/autorespond edit\` - Edit auto-response embed\n\`/autorespond list\` - Lihat daftar auto-response aktif\n\`/autorespond remove\` - Hapus auto-response\n\`/welcome set\` - Atur channel dan pesan sambutan member baru\n\`/welcome test\` - Uji coba kirim pesan sambutan\n\`/welcome status\` - Cek konfigurasi welcome\n\`/welcome disable\` - Nonaktifkan welcome message` 
                }
            )
            .setFooter({ text: 'Ten A Bot Discord', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [helpEmbed] });
    }
};
