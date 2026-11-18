const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder 
} = require('discord.js');
const storage = require('../utils/storage');

// Helper validasi URL
function isValidHttpUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Helper membuat embed konsisten
function createResponseEmbed(item, clientUser) {
    const embed = new EmbedBuilder();
    
    if (item.title) embed.setTitle(item.title);
    if (item.description || item.response) embed.setDescription(item.description || item.response);
    if (item.image) {
        try {
            embed.setImage(item.image);
        } catch (e) {
            console.error('Invalid image URL:', e);
        }
    }

    let embedColor = 0x5865F2;
    if (item.color) {
        const parsed = parseInt(item.color.replace('#', ''), 16);
        if (!isNaN(parsed)) embedColor = parsed;
    }
    embed.setColor(embedColor);

    embed.setFooter({ 
        text: `Auto Response • Pemicu: "${item.trigger}"`, 
        iconURL: clientUser ? clientUser.displayAvatarURL() : undefined 
    });

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorespond')
        .setDescription('Pengaturan fitur auto-response embed (Khusus Administrator)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Tambah auto-response embed baru')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('Kata atau kalimat pemicu')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Isi pesan / deskripsi embed')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Judul embed (opsional)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Link URL gambar embed (opsional, contoh: https://.../gambar.png)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('color')
                        .setDescription('Kode HEX warna embed, misal: #5865F2 atau #FF0000 (opsional)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('match_type')
                        .setDescription('Tipe pencocokan pemicu')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Mengandung kata/kalimat (Default)', value: 'contains' },
                            { name: 'Sama persis (Exact Match)', value: 'exact' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit auto-response yang sudah ada')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('Kata pemicu dari auto-response yang ingin diedit')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Deskripsi baru untuk embed (opsional)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Judul baru (opsional, ketik "hapus" untuk menghilangkan judul)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Link gambar baru (opsional, ketik "hapus" untuk menghilangkan gambar)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('color')
                        .setDescription('Kode warna HEX baru (opsional)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('match_type')
                        .setDescription('Tipe pencocokan pemicu baru')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Mengandung kata/kalimat', value: 'contains' },
                            { name: 'Sama persis (Exact Match)', value: 'exact' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Hapus auto-response berdasarkan kata pemicu')
                .addStringOption(opt =>
                    opt.setName('trigger')
                        .setDescription('Kata pemicu yang ingin dihapus')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Tampilkan semua daftar auto-response aktif di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Hapus SEMUA auto-response di server ini')
        ),

    async execute(interaction) {
        // Validasi permission Administrator
        if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Hanya pengguna dengan izin **Administrator** yang dapat menggunakan perintah ini.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'add') {
            const trigger = interaction.options.getString('trigger');
            const description = interaction.options.getString('description');
            const title = interaction.options.getString('title');
            const image = interaction.options.getString('image');
            const color = interaction.options.getString('color');
            const matchType = interaction.options.getString('match_type') || 'contains';

            // Validasi format HEX color jika diberikan
            if (color && !/^#?[0-9A-Fa-f]{6}$/.test(color)) {
                return interaction.reply({
                    content: '❌ Format warna tidak valid! Gunakan kode HEX 6 digit (contoh: `#5865F2` atau `FF5733`).',
                    ephemeral: true
                });
            }

            // Validasi format link gambar jika diberikan
            if (image && !isValidHttpUrl(image)) {
                return interaction.reply({
                    content: '❌ Link gambar tidak valid! Pastikan diawali dengan `http://` atau `https://`.',
                    ephemeral: true
                });
            }

            const { isUpdate, item } = storage.addAutoRespond(guildId, {
                trigger,
                description,
                title,
                image,
                color,
                matchType
            });

            const previewEmbed = createResponseEmbed(item, interaction.client.user);

            return interaction.reply({
                content: `✅ Auto-response berhasil **${isUpdate ? 'diperbarui' : 'ditambahkan'}**!\n` +
                    `• **Trigger:** \`${item.trigger}\`\n` +
                    `• **Tipe Match:** \`${item.matchType === 'exact' ? 'Sama Persis' : 'Mengandung Kata'}\`\n` +
                    (item.title ? `• **Judul:** ${item.title}\n` : '') +
                    (item.image ? `• **Gambar:** [Lihat Gambar](${item.image})\n` : '') +
                    `\n**Preview Embed:**`,
                embeds: [previewEmbed],
                ephemeral: true
            });
        }

        if (subcommand === 'edit') {
            const trigger = interaction.options.getString('trigger');
            const description = interaction.options.getString('description');
            const title = interaction.options.getString('title');
            const image = interaction.options.getString('image');
            const color = interaction.options.getString('color');
            const matchType = interaction.options.getString('match_type');

            if (!description && !title && !image && !color && !matchType) {
                return interaction.reply({
                    content: '⚠️ Silakan isi setidaknya satu bagian yang ingin diubah (`description`, `title`, `image`, `color`, atau `match_type`).',
                    ephemeral: true
                });
            }

            if (color && !['hapus', 'none'].includes(color.toLowerCase()) && !/^#?[0-9A-Fa-f]{6}$/.test(color)) {
                return interaction.reply({
                    content: '❌ Format warna tidak valid! Gunakan kode HEX 6 digit (contoh: `#5865F2` atau `FF5733`).',
                    ephemeral: true
                });
            }

            if (image && !['hapus', 'none'].includes(image.toLowerCase()) && !isValidHttpUrl(image)) {
                return interaction.reply({
                    content: '❌ Link gambar tidak valid! Pastikan diawali dengan `http://` atau `https://`.',
                    ephemeral: true
                });
            }

            const updatedItem = storage.editAutoRespond(guildId, {
                trigger,
                description,
                title,
                image,
                color,
                matchType
            });

            if (!updatedItem) {
                return interaction.reply({
                    content: `⚠️ Tidak ditemukan auto-response dengan kata pemicu \`${trigger}\`. Gunakan \`/autorespond list\` untuk melihat daftar yang ada.`,
                    ephemeral: true
                });
            }

            const previewEmbed = createResponseEmbed(updatedItem, interaction.client.user);

            return interaction.reply({
                content: `✅ Auto-response untuk \`${trigger}\` berhasil **diperbarui**!\n` +
                    `• **Trigger:** \`${updatedItem.trigger}\`\n` +
                    `• **Tipe Match:** \`${updatedItem.matchType === 'exact' ? 'Sama Persis' : 'Mengandung Kata'}\`\n` +
                    (updatedItem.title ? `• **Judul:** ${updatedItem.title}\n` : '• **Judul:** *(Tidak ada)*\n') +
                    (updatedItem.image ? `• **Gambar:** [Lihat Gambar](${updatedItem.image})\n` : '• **Gambar:** *(Tidak ada)*\n') +
                    `\n**Preview Embed Baru:**`,
                embeds: [previewEmbed],
                ephemeral: true
            });
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger');
            const removed = storage.removeAutoRespond(guildId, trigger);

            if (removed) {
                return interaction.reply({
                    content: `✅ Auto-response dengan pemicu \`${trigger}\` berhasil dihapus!`,
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: `⚠️ Tidak ditemukan auto-response dengan kata pemicu \`${trigger}\`.`,
                    ephemeral: true
                });
            }
        }

        if (subcommand === 'list') {
            const list = storage.getAutoResponds(guildId);

            if (!list || list.length === 0) {
                return interaction.reply({
                    content: 'ℹ️ Belum ada auto-response yang terdaftar di server ini. Gunakan `/autorespond add` untuk menambahkan.',
                    ephemeral: true
                });
            }

            const listEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📋 Daftar Auto-Response (${list.length})`)
                .setDescription('Daftar kata pemicu dan respon embed yang aktif di server:')
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

            list.slice(0, 25).forEach((item, index) => {
                const titlePart = item.title ? ` | Judul: "${item.title}"` : '';
                const imagePart = item.image ? ' 🖼️[Gambar]' : '';
                const matchTypePart = item.matchType === 'exact' ? 'Exact' : 'Contains';
                const desc = item.description || item.response || '';
                const preview = desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
                
                listEmbed.addFields({
                    name: `${index + 1}. \`${item.trigger}\` (${matchTypePart})${titlePart}${imagePart}`,
                    value: `Deskripsi: "${preview}"`
                });
            });

            if (list.length > 25) {
                listEmbed.setFooter({ text: `Menampilkan 25 dari total ${list.length} data.` });
            }

            return interaction.reply({ embeds: [listEmbed], ephemeral: true });
        }

        if (subcommand === 'clear') {
            storage.clearAutoResponds(guildId);
            return interaction.reply({
                content: '🧹 Semua auto-response di server ini telah berhasil dibersihkan!',
                ephemeral: true
            });
        }
    }
};
