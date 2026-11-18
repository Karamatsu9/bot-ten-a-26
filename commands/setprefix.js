const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Ubah prefix perintah teks bot di server ini (Khusus Administrator)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('prefix')
                .setDescription('Prefix baru yang ingin digunakan (contoh: !, ?, ., $, ~)')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Validasi permission Administrator
        if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Hanya pengguna dengan izin **Administrator** yang dapat mengubah prefix bot.',
                ephemeral: true
            });
        }

        const newPrefix = interaction.options.getString('prefix').trim();

        if (newPrefix.length > 5) {
            return interaction.reply({
                content: '❌ Prefix terlalu panjang! Maksimal 5 karakter.',
                ephemeral: true
            });
        }

        if (newPrefix.includes(' ')) {
            return interaction.reply({
                content: '❌ Prefix tidak boleh mengandung spasi.',
                ephemeral: true
            });
        }

        storage.setGuildPrefix(interaction.guildId, newPrefix);

        return interaction.reply({
            content: `✅ **Prefix bot berhasil diubah!**\nSekarang gunakan \`${newPrefix}\` untuk memanggil perintah (contoh: \`${newPrefix}ask\`, \`${newPrefix}ping\`, \`${newPrefix}help\`).`
        });
    }
};
