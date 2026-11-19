const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Menampilkan menu bantuan dan daftar perintah bot TEN A \'26'),
    async execute(interaction) {
        const prefix = storage.getGuildPrefix(interaction.guildId);

        const helpEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Daftar Perintah Bot TEN A \'26')
            .setDescription(
                `Prefix bot saat ini di server ini: \`${prefix}\`\n` +
                `Gunakan channel <#1572664316811812875> untuk memakai command bot agar channel diskusi tetap rapi.\n\n` +
                `Berikut daftar fitur dan perintah yang tersedia:`
            )
            .addFields(
                { 
                    name: '💬 Tanya Jawab & Diskusi', 
                    value: 
                        `\`/ask question:<pertanyaan>\` — Tanya apa saja ke bot TEN A '26\n` +
                        `\`${prefix}ask <pertanyaan>\` atau \`${prefix} <pertanyaan>\` — Versi prefix untuk bertanya`
                },
                { 
                    name: '⏰ Reminder Otomatis (WIB / UTC+7)', 
                    value: 
                        `\`/remind set waktu:<waktu> pesan:<pesan>\` — Buat pengingat baru\n` +
                        `\`/remind list\` — Lihat daftar pengingat aktif milikmu\n` +
                        `\`/remind hapus id:<id>\` — Batalkan pengingat berdasarkan ID\n` +
                        `\`${prefix}remind <waktu> | <pesan>\` — Buat pengingat via prefix *(contoh: \`${prefix}remind 30m | Kumpul tugas\` atau \`${prefix}remind 19:30 | Rapat\`)*\n` +
                        `\`${prefix}remind list\` / \`${prefix}remind hapus <id>\` — Cek & hapus via prefix`
                },
                { 
                    name: '📌 Kata Kunci Cepat & Utilitas', 
                    value: 
                        `Ketik \`jadwal\` atau \`pj\` langsung di chat untuk melihat info kuliah\n` +
                        `\`/ping\` atau \`${prefix}ping\` — Cek kecepatan respon bot\n` +
                        `\`${prefix}halo\` — Sapa bot\n` +
                        `\`/help\` atau \`${prefix}help\` — Menampilkan menu bantuan ini`
                },
                { 
                    name: '🔒 Private Room System', 
                    value: 
                        '`/create-private-channel` — Buat private text channel & undang member lain\n' +
                        '`/delete-private-channel` — Hapus private room beserta rolenya setelah selesai\n' +
                        '`/set-private-category` — Atur kategori Discord tempat private channel dibuat *(Moderator/Admin)*' 
                },
                { 
                    name: '⚙️ Pengaturan Admin (Khusus Administrator)', 
                    value: 
                        `\`/setprefix\` atau \`${prefix}setprefix <prefix_baru>\` — Ubah prefix bot\n` +
                        `\`/autorespond add/edit/list/remove/clear\` — Kelola auto-response embed & gambar\n` +
                        `\`/welcome set/test/status/disable\` — Kelola pesan sambutan member baru` 
                }
            )
            .setFooter({ text: 'Bot Khusus Server TEN A \'26', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [helpEmbed] });
    }
};