const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const {
    getSaranConfig,
    updateSaranConfig,
    checkSaranChannelPerms
} = require('../utils/saranManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kotak-saran')
        .setDescription('Pengaturan channel tujuan Kotak Saran (Khusus Moderator/Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Atur channel Discord tujuan untuk menampung saran dari member')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel tujuan kotak saran (disarankan channel khusus moderator/forum saran)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addBooleanOption(opt =>
                    opt.setName('izinkan_anonim')
                        .setDescription('Izinkan member mengirim saran secara anonim? (Default: Ya)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Cek status dan channel Kotak Saran server ini saat ini')
        )
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Kirim pesan uji coba ke channel Kotak Saran yang sudah disetel')
        )
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Aktifkan kembali fitur Kotak Saran di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Nonaktifkan sementara fitur Kotak Saran di server ini')
        ),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: '⚠️ Perintah ini hanya bisa digunakan di dalam server Discord.',
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Command ini hanya bisa digunakan oleh **Moderator** atau **Administrator**.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'set') {
            const targetChannel = interaction.options.getChannel('channel');
            const allowAnon = interaction.options.getBoolean('izinkan_anonim');

            const missingPerms = checkSaranChannelPerms(targetChannel, interaction.client.user, true);
            const permWarning = missingPerms.length > 0
                ? `\n\n⚠️ **Perhatian Izin Bot:** Bot belum memiliki izin **${missingPerms.join(', ')}** di <#${targetChannel.id}>. Tambahkan izin tersebut agar saran bisa terkirim.`
                : '';

            const patch = {
                enabled: true,
                channelId: targetChannel.id
            };
            if (allowAnon !== null) {
                patch.allowAnonymous = allowAnon;
            }

            const updated = updateSaranConfig(guildId, patch);

            return interaction.reply({
                content:
                    `✅ **Channel Kotak Saran berhasil diatur!**\n` +
                    `• **Status:** 🟢 Aktif\n` +
                    `• **Channel Tujuan:** <#${updated.channelId}>\n` +
                    `• **Mode Anonim:** ${updated.allowAnonymous ? 'Diizinkan' : 'Dinonaktifkan'}\n` +
                    `• Member kini dapat mengirim saran secara privat menggunakan \`/saran\`.` +
                    permWarning,
                ephemeral: true
            });
        }

        if (subcommand === 'status') {
            const config = getSaranConfig(guildId);

            const embed = new EmbedBuilder()
                .setColor(config.enabled ? 0x57F287 : 0xED4245)
                .setTitle(`💡 Status Kotak Saran • ${interaction.guild.name}`)
                .addFields(
                    {
                        name: 'Status Fitur',
                        value: config.enabled ? '🟢 Aktif' : '🔴 Nonaktif',
                        inline: true
                    },
                    {
                        name: 'Mode Anonim',
                        value: config.allowAnonymous ? '✅ Diizinkan' : '🚫 Dinonaktifkan',
                        inline: true
                    },
                    {
                        name: 'Total Saran Masuk',
                        value: `${config.count} saran`,
                        inline: true
                    },
                    {
                        name: 'Channel Tujuan Saran',
                        value: config.channelId ? `<#${config.channelId}>` : '*Belum disetel (gunakan `/kotak-saran set`)*',
                        inline: false
                    }
                )
                .setFooter({ text: 'Member mengirim saran secara tersembunyi melalui /saran' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'test') {
            const config = getSaranConfig(guildId);
            if (!config.channelId) {
                return interaction.reply({
                    content: '⚠️ Channel tujuan belum diatur! Jalankan `/kotak-saran set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
            if (!channel || !channel.isTextBased() || channel.guildId !== guildId) {
                return interaction.reply({
                    content: `❌ Channel <#${config.channelId}> tidak ditemukan di server ini atau bot tidak memiliki akses.`,
                    ephemeral: true
                });
            }

            const missingPerms = checkSaranChannelPerms(channel, interaction.client.user, false);
            if (missingPerms.length > 0) {
                return interaction.reply({
                    content: `❌ Bot kekurangan izin **${missingPerms.join(', ')}** di channel <#${config.channelId}>.`,
                    ephemeral: true
                });
            }

            const testEmbed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setAuthor({
                    name: `Uji Coba oleh ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTitle('💡 Kotak Saran #000 (Uji Coba)')
                .setDescription('Ini adalah pesan uji coba fitur **Kotak Saran**. Setiap saran yang dikirim member lewat `/saran` akan muncul rapi di channel ini.')
                .setFooter({ text: `Kotak Saran • ${interaction.guild.name}` })
                .setTimestamp();

            const sentMsg = await channel.send({ embeds: [testEmbed] });
            await sentMsg.react('👍').catch(() => {});
            await sentMsg.react('👎').catch(() => {});

            return interaction.reply({
                content: `✅ Pesan uji coba kotak saran berhasil dikirim ke <#${config.channelId}>!`,
                ephemeral: true
            });
        }

        if (subcommand === 'enable') {
            const config = getSaranConfig(guildId);
            if (!config.channelId) {
                return interaction.reply({
                    content: '⚠️ Channel tujuan belum pernah disetel. Gunakan `/kotak-saran set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            updateSaranConfig(guildId, { enabled: true });
            return interaction.reply({
                content: `🟢 Fitur **Kotak Saran** kembali diaktifkan ke channel <#${config.channelId}>.`,
                ephemeral: true
            });
        }

        if (subcommand === 'disable') {
            updateSaranConfig(guildId, { enabled: false });
            return interaction.reply({
                content: '🔴 Fitur **Kotak Saran** dinonaktifkan sementara. Gunakan `/kotak-saran enable` untuk menyalakannya lagi.',
                ephemeral: true
            });
        }
    }
};