const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType,
    EmbedBuilder 
} = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-private-category')
        .setDescription('Atur kategori tempat private channel akan dibuat (Khusus Moderator/Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Tentukan kategori untuk private channel')
                .addChannelOption(opt =>
                    opt.setName('category')
                        .setDescription('Kategori tujuan')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Lihat kategori private channel saat ini')
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Hapus pengaturan kategori (private channel akan dibuat di root)')
        ),

    async execute(interaction) {
        // Validasi permission ManageChannels atau Administrator
        if (!interaction.memberPermissions || 
            (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels) && 
             !interaction.memberPermissions.has(PermissionFlagsBits.Administrator))) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Kamu memerlukan izin **Manage Channels** atau **Administrator** untuk mengatur kategori private channel.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'set') {
            const category = interaction.options.getChannel('category');
            storage.setPrivateCategory(guildId, category.id);

            return interaction.reply({
                content: `✅ **Kategori Private Channel Berhasil Diatur!**\nSekarang semua private room baru akan otomatis dibuat di bawah kategori **${category.name}** (<#${category.id}>).`
            });
        }

        if (subcommand === 'status') {
            const categoryId = storage.getPrivateCategory(guildId);
            if (!categoryId) {
                return interaction.reply({
                    content: 'ℹ️ Belum ada kategori yang diatur untuk private channel. Gunakan `/set-private-category set` untuk menentukan kategorinya.',
                    ephemeral: true
                });
            }

            const category = interaction.guild.channels.cache.get(categoryId);
            return interaction.reply({
                content: `📁 Kategori private channel saat ini: ${category ? `**${category.name}** (<#${categoryId}>)` : `\`${categoryId}\` (Kategori tidak ditemukan)`}`,
                ephemeral: true
            });
        }

        if (subcommand === 'remove') {
            storage.setPrivateCategory(guildId, null);
            return interaction.reply({
                content: '🧹 Pengaturan kategori private channel telah dihapus. Private room baru akan dibuat tanpa kategori khusus.',
                ephemeral: true
            });
        }
    }
};
