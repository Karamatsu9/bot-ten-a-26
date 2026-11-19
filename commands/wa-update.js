const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const {
    getWaConfig,
    updateWaConfig,
    getWaBridgeStatus
} = require('../utils/waBridge');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wa-update')
        .setDescription('Pengaturan channel penerus pengumuman WhatsApp (Khusus Moderator/Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Atur channel Discord tujuan untuk update dari Announcements WhatsApp')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel Discord tujuan pengumuman')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('jid')
                        .setDescription('(Opsional) JID grup Announcements WA, contoh: 120363xxxx@g.us')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Cek status koneksi WhatsApp dan channel tujuan saat ini')
        )
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Kirim pesan uji coba ke channel WA update yang sudah disetel')
        )
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Aktifkan kembali penerusan pengumuman WhatsApp')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Nonaktifkan sementara penerusan pengumuman WhatsApp')
        ),

    async execute(interaction) {
        // Validasi tambahan izin Moderator / Administrator
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Command ini hanya bisa digunakan oleh **Moderator** atau **Administrator**.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const targetChannel = interaction.options.getChannel('channel');
            const jidInput = interaction.options.getString('jid')?.trim();

            if (jidInput && !jidInput.endsWith('@g.us')) {
                return interaction.reply({
                    content: '⚠️ Format **JID** tidak valid. JID grup WhatsApp harus berakhiran `@g.us` (contoh: `1203630482910xxxx@g.us`).',
                    ephemeral: true
                });
            }

            const patch = {
                enabled: true,
                channelId: targetChannel.id
            };
            if (jidInput) {
                patch.announcementJid = jidInput;
            }

            const updated = updateWaConfig(patch);

            return interaction.reply({
                content:
                    `✅ **Channel WA Update berhasil diatur!**\n` +
                    `• **Status:** Aktif\n` +
                    `• **Channel Tujuan:** <#${updated.channelId}>\n` +
                    `• **Target JID WA:** \`${updated.announcementJid || 'Auto-detect Announcements TEN A'}\``,
                ephemeral: true
            });
        }

        if (subcommand === 'status') {
            const config = getWaConfig();
            const status = getWaBridgeStatus();

            const detectedList = status.detectedAnnounceGroups.length > 0
                ? status.detectedAnnounceGroups
                    .map(g => `• **${g.subject}**\n  \`${g.id}\``)
                    .join('\n')
                : '*Belum terdeteksi (pastikan WhatsApp sudah terhubung)*';

            const embed = new EmbedBuilder()
                .setColor(config.enabled && status.isConnected ? 0x25D366 : 0xFFA500)
                .setTitle('📢 Status WhatsApp Announcements Bridge')
                .addFields(
                    {
                        name: 'Fitur Penerus',
                        value: config.enabled ? '🟢 Aktif' : '🔴 Nonaktif',
                        inline: true
                    },
                    {
                        name: 'Koneksi WhatsApp',
                        value: status.isConnected ? '🟢 Terhubung' : '🟡 Terputus / Menunggu Scan QR',
                        inline: true
                    },
                    {
                        name: 'Channel Discord Tujuan',
                        value: config.channelId ? `<#${config.channelId}>` : '*Belum disetel (gunakan `/wa-update set`)*',
                        inline: false
                    },
                    {
                        name: 'JID Terkunci Saat Ini',
                        value: config.announcementJid
                            ? `\`${config.announcementJid}\``
                            : (status.activeJids.length > 0
                                ? status.activeJids.map(id => `\`${id}\` *(auto)*`).join(', ')
                                : '*Belum ada*'),
                        inline: false
                    },
                    {
                        name: 'Grup Announcements WA yang Terdeteksi',
                        value: detectedList,
                        inline: false
                    }
                )
                .setFooter({ text: 'Bot Khusus Server TEN A \'26' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'test') {
            const config = getWaConfig();
            if (!config.channelId) {
                return interaction.reply({
                    content: '⚠️ Channel tujuan belum diatur! Jalankan `/wa-update set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                return interaction.reply({
                    content: `❌ Channel <#${config.channelId}> tidak ditemukan atau bot tidak memiliki akses ke channel tersebut.`,
                    ephemeral: true
                });
            }

            const testEmbed = new EmbedBuilder()
                .setColor(0x25D366)
                .setAuthor({ name: '📢 Announcements • Info Tugas & Materi TEN A (Uji Coba)' })
                .setDescription('Ini adalah pesan uji coba dari fitur **WhatsApp Community Announcements Bridge**. Pengumuman dan file dari grup kelas akan muncul di channel ini.')
                .setFooter({ text: `Diuji oleh ${interaction.user.username}` })
                .setTimestamp();

            try {
                await channel.send({ embeds: [testEmbed] });
                return interaction.reply({
                    content: `✅ Pesan uji coba berhasil dikirim ke <#${config.channelId}>!`,
                    ephemeral: true
                });
            } catch (err) {
                console.error('[WA BRIDGE] Gagal mengirim pesan test:', err);
                return interaction.reply({
                    content: `❌ Bot gagal mengirim pesan ke <#${config.channelId}>. Pastikan bot memiliki izin **Send Messages** dan **Embed Links** di channel tersebut.`,
                    ephemeral: true
                });
            }
        }

        if (subcommand === 'enable') {
            const config = getWaConfig();
            if (!config.channelId) {
                return interaction.reply({
                    content: '⚠️ Channel tujuan belum pernah disetel. Gunakan `/wa-update set` untuk menentukan channel terlebih dahulu.',
                    ephemeral: true
                });
            }

            updateWaConfig({ enabled: true });
            return interaction.reply({
                content: `🟢 Penerusan pengumuman WhatsApp kembali **diaktifkan** ke channel <#${config.channelId}>.`,
                ephemeral: true
            });
        }

        if (subcommand === 'disable') {
            updateWaConfig({ enabled: false });
            return interaction.reply({
                content: '🔴 Penerusan pengumuman WhatsApp **dinonaktifkan sementara**. Gunakan `/wa-update enable` kapan saja untuk menyalakannya lagi.',
                ephemeral: true
            });
        }
    }
};