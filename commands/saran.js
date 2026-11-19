const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const {
    getSaranConfig,
    incrementSaranCount,
    checkSaranChannelPerms
} = require('../utils/saranManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saran')
        .setDescription('Kirim saran atau masukan secara privat ke kotak saran server')
        .addStringOption(opt =>
            opt.setName('isi')
                .setDescription('Tulis saran, kritik, atau masukanmu di sini')
                .setMinLength(5)
                .setMaxLength(3500)
                .setRequired(true)
        )
        .addBooleanOption(opt =>
            opt.setName('anonim')
                .setDescription('Kirim sebagai Anonim tanpa menampilkan namamu? (Default: Tidak)')
                .setRequired(false)
        )
        .addAttachmentOption(opt =>
            opt.setName('lampiran')
                .setDescription('(Opsional) Gambar atau file pendukung saran')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: '⚠️ Perintah ini hanya bisa digunakan di dalam server Discord.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guildId;
        const config = getSaranConfig(guildId);

        if (!config.enabled || !config.channelId) {
            return interaction.editReply({
                content: '⚠️ **Kotak Saran belum aktif di server ini.** Hubungi Moderator atau Administrator untuk mengaturnya lewat `/kotak-saran set`.'
            });
        }

        const isiSaran = interaction.options.getString('isi').trim();
        const isAnonim = interaction.options.getBoolean('anonim') ?? false;
        const lampiran = interaction.options.getAttachment('lampiran');

        if (isAnonim && !config.allowAnonymous) {
            return interaction.editReply({
                content: '⚠️ Mode **Anonim** sedang dinonaktifkan oleh Moderator/Admin di server ini. Kirim ulang tanpa mengaktifkan opsi `anonim`.'
            });
        }

        const targetChannel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
        if (!targetChannel || !targetChannel.isTextBased() || targetChannel.guildId !== guildId) {
            return interaction.editReply({
                content: '❌ Channel Kotak Saran yang terdaftar tidak ditemukan atau tidak bisa diakses oleh bot. Laporkan ke Moderator/Admin.'
            });
        }

        const missingPerms = checkSaranChannelPerms(targetChannel, interaction.client.user, Boolean(lampiran));
        if (missingPerms.length > 0) {
            return interaction.editReply({
                content: `❌ Bot belum memiliki izin **${missingPerms.join(', ')}** di channel tujuan kotak saran. Hubungi Moderator/Admin.`
            });
        }

        const nomorUrut = incrementSaranCount(guildId);
        const nomorLabel = `#${String(nomorUrut).padStart(3, '0')}`;
        const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`💡 Kotak Saran ${nomorLabel}`)
            .setDescription(isiSaran)
            .setFooter({ text: `Kotak Saran • ${interaction.guild.name}` })
            .setTimestamp();

        if (isAnonim) {
            embed.setAuthor({ name: 'Pengirim: Anonim 🕵️' });
        } else {
            embed.setAuthor({
                name: `Dari: ${displayName} (@${interaction.user.username})`,
                iconURL: interaction.user.displayAvatarURL()
            });
        }

        const files = [];
        if (lampiran) {
            const safeName = lampiran.name || 'lampiran_saran';
            files.push(new AttachmentBuilder(lampiran.url, { name: safeName }));
            if (lampiran.contentType?.startsWith('image/')) {
                embed.setImage(`attachment://${safeName}`);
            }
        }

        try {
            const sentMsg = await targetChannel.send({ embeds: [embed], files });
            // Tambahkan reaksi voting otomatis (abaikan jika bot tidak punya izin Add Reactions)
            await sentMsg.react('👍').catch(() => {});
            await sentMsg.react('👎').catch(() => {});

            return interaction.editReply({
                content:
                    `✅ **Saranmu (${nomorLabel}) berhasil dikirim secara privat!**\n` +
                    `• **Tujuan:** <#${targetChannel.id}>\n` +
                    `• **Identitas:** ${isAnonim ? 'Anonim 🕵️' : `${displayName}`}`
            });
        } catch (err) {
            console.error(`[SARAN][${guildId}] Gagal mengirim saran:`, err);
            return interaction.editReply({
                content: '❌ Terjadi kesalahan saat mengirim saran ke channel tujuan. Silakan coba beberapa saat lagi.'
            });
        }
    }
};