const { SlashCommandBuilder } = require('discord.js');
const {
    parseTimeWIB,
    formatWIB,
    addReminder,
    getUserReminders,
    deleteReminder
} = require('../utils/reminderManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Atur pengingat otomatis (Waktu Jakarta / UTC+7)')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Buat pengingat baru')
                .addStringOption(opt =>
                    opt.setName('waktu')
                        .setDescription('Contoh: 30m, 2j, 19:30, atau 20/11/2026 08:00 (WIB)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('pesan')
                        .setDescription('Hal yang ingin diingatkan')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lihat daftar pengingat aktif milikmu')
        )
        .addSubcommand(sub =>
            sub.setName('hapus')
                .setDescription('Batalkan pengingat berdasarkan ID')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('ID pengingat (lihat lewat /remind list)')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const waktuInput = interaction.options.getString('waktu');
            const pesan = interaction.options.getString('pesan');
            const targetMs = parseTimeWIB(waktuInput);

            if (!targetMs) {
                return interaction.reply({
                    content: '⚠️ **Format waktu tidak valid atau sudah terlewat!**\nGunakan waktu **UTC+7 (WIB)** dengan salah satu format berikut:\n• Durasi: `15m`, `2j`, `1j 30m`, `1d`\n• Jam hari ini/besok: `19:30`\n• Tanggal & jam: `20/11/2026 08:00` atau `2026-11-20 08:00`',
                    ephemeral: true
                });
            }

            const reminder = addReminder({
                userId: interaction.user.id,
                channelId: interaction.channelId,
                message: pesan,
                remindAt: targetMs
            });

            const unixSeconds = Math.floor(targetMs / 1000);
            return interaction.reply({
                content: `✅ **Pengingat disimpan!** (ID: \`${reminder.id}\`)\n• **Waktu:** ${formatWIB(targetMs)} (<t:${unixSeconds}:R>)\n• **Pesan:** ${pesan}`
            });
        }

        if (subcommand === 'list') {
            const list = getUserReminders(interaction.user.id);
            if (list.length === 0) {
                return interaction.reply({
                    content: '📭 Kamu belum memiliki pengingat aktif saat ini.',
                    ephemeral: true
                });
            }

            const lines = list.map((r, idx) => {
                const unix = Math.floor(r.remindAt / 1000);
                return `${idx + 1}. **ID:** \`${r.id}\` — ${formatWIB(r.remindAt)} (<t:${unix}:R>)\n   > ${r.message}`;
            });

            return interaction.reply({
                content: `📋 **Daftar Pengingat Aktif Kamu:**\n\n${lines.join('\n\n')}`,
                ephemeral: true
            });
        }

        if (subcommand === 'hapus') {
            const id = interaction.options.getString('id').trim();
            const removed = deleteReminder(id, interaction.user.id);

            if (!removed) {
                return interaction.reply({
                    content: `❌ Pengingat dengan ID \`${id}\` tidak ditemukan atau bukan milikmu.`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: `🗑️ Pengingat dengan ID \`${id}\` berhasil dibatalkan.`,
                ephemeral: true
            });
        }
    }
};