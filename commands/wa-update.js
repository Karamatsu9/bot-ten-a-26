const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const QRCode = require('qrcode');
const {
    connectGuildWhatsApp,
    disconnectGuildWhatsApp,
    getWaConfig,
    updateWaConfig,
    getWaBridgeStatus
} = require('../utils/waBridge');

function checkBotChannelPerms(channel, botUser) {
    const perms = channel.permissionsFor(botUser);
    if (!perms) return ['View Channel', 'Send Messages', 'Embed Links', 'Attach Files'];

    const missing = [];
    if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
    if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push('Send Messages');
    if (!perms.has(PermissionFlagsBits.EmbedLinks)) missing.push('Embed Links');
    if (!perms.has(PermissionFlagsBits.AttachFiles)) missing.push('Attach Files');
    return missing;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wa-update')
        .setDescription('Pengaturan WhatsApp Announcements Bridge khusus server ini (Moderator/Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('login')
                .setDescription('Tautkan akun WhatsApp khusus untuk server ini (QR Code / Pairing Code)')
                .addStringOption(opt =>
                    opt.setName('nomor_wa')
                        .setDescription('(Opsional) Isi nomor WA (contoh: 62812xxxx) jika ingin login pakai kode 8 digit')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Atur channel Discord tujuan dan grup Announcements WhatsApp untuk server ini')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel Discord tujuan pengumuman')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('jid')
                        .setDescription('Pilih grup Announcements WA yang terdeteksi (atau ketik manual 120363xxxx@g.us)')
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Cek status koneksi WhatsApp dan daftar grup Announcements di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Kirim pesan uji coba ke channel WA update server ini')
        )
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Aktifkan kembali penerusan pengumuman WhatsApp di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Nonaktifkan sementara penerusan pengumuman WhatsApp di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('logout')
                .setDescription('Putuskan tautan akun WhatsApp dan hapus sesi login server ini')
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'jid') return;

        const status = getWaBridgeStatus(interaction.guildId);
        const query = focused.value.toLowerCase();

        const choices = status.detectedAnnounceGroups
            .filter(g => g.subject.toLowerCase().includes(query) || g.id.toLowerCase().includes(query))
            .slice(0, 25)
            .map(g => ({
                name: `${g.subject} (${g.id})`.slice(0, 100),
                value: g.id
            }));

        await interaction.respond(choices);
    },

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

        if (subcommand === 'login') {
            const nomorWa = interaction.options.getString('nomor_wa')?.trim();
            await interaction.deferReply({ ephemeral: true });

            try {
                await connectGuildWhatsApp(interaction.client, guildId, {
                    phoneNumber: nomorWa || undefined,
                    onQr: async (qrString) => {
                        const qrBuffer = await QRCode.toBuffer(qrString, { width: 320, margin: 2 });
                        const qrAttachment = new AttachmentBuilder(qrBuffer, { name: 'whatsapp-qr.png' });

                        await interaction.editReply({
                            content:
                                '📱 **Scan QR Code WhatsApp (Khusus Server Ini)**\n' +
                                '1. Buka WhatsApp di HP akun bot/cadangan\n' +
                                '2. Masuk ke **Perangkat Tertaut (*Linked Devices*) → Tautkan Perangkat**\n' +
                                '3. Scan gambar QR di bawah ini *(pesan ini hanya terlihat olehmu)*:',
                            files: [qrAttachment]
                        });
                    },
                    onPairingCode: async (code) => {
                        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                        await interaction.editReply({
                            content:
                                `🔑 **Kode Pairing WhatsApp:** \`${formattedCode}\`\n` +
                                '1. Buka WhatsApp di HP akun bot/cadangan\n' +
                                '2. Masuk ke **Perangkat Tertaut (*Linked Devices*) → Tautkan Perangkat → Tautkan dengan nomor telepon**\n' +
                                '3. Masukkan kode 8 digit di atas.'
                        });
                    },
                    onConnected: async (groups) => {
                        const groupListText = groups.length > 0
                            ? groups.map(g => `• **${g.subject}** (\`${g.id}\`)`).join('\n')
                            : '*Tidak ada grup Announcements komunitas yang terdeteksi di akun WA ini.*';

                        await interaction.followUp({
                            content:
                                '✅ **WhatsApp berhasil terhubung untuk server ini!**\n\n' +
                                `**Grup Announcements Komunitas yang terdeteksi:**\n${groupListText}\n\n` +
                                'Langkah berikutnya: Jalankan **`/wa-update set`** untuk memilih channel Discord tujuan dan grup Announcements-nya.',
                            ephemeral: true
                        });
                    }
                });
            } catch (err) {
                console.error(`[WA BRIDGE][${guildId}] Error pada /wa-update login:`, err);
                return interaction.editReply({
                    content: '❌ Gagal memulai sesi login WhatsApp. Silakan coba jalankan `/wa-update login` kembali.'
                });
            }
            return;
        }

        if (subcommand === 'set') {
            const targetChannel = interaction.options.getChannel('channel');
            const jidInput = interaction.options.getString('jid').trim();

            if (!jidInput.endsWith('@g.us')) {
                return interaction.reply({
                    content: '⚠️ Format **JID** tidak valid. Pilih dari daftar saran atau masukkan JID berakhiran `@g.us`.',
                    ephemeral: true
                });
            }

            const missingPerms = checkBotChannelPerms(targetChannel, interaction.client.user);
            const permWarning = missingPerms.length > 0
                ? `\n\n⚠️ **Perhatian Izin Bot:** Bot belum memiliki izin **${missingPerms.join(', ')}** di <#${targetChannel.id}>.`
                : '';

            const updated = updateWaConfig(guildId, {
                enabled: true,
                channelId: targetChannel.id,
                announcementJid: jidInput
            });

            return interaction.reply({
                content:
                    `✅ **Pengaturan WA Update Server Ini Disimpan!**\n` +
                    `• **Status:** 🟢 Aktif\n` +
                    `• **Channel Tujuan:** <#${updated.channelId}>\n` +
                    `• **Grup Announcements WA:** \`${updated.announcementJid}\`` +
                    permWarning,
                ephemeral: true
            });
        }

        if (subcommand === 'status') {
            const config = getWaConfig(guildId);
            const status = getWaBridgeStatus(guildId);

            const detectedList = status.detectedAnnounceGroups.length > 0
                ? status.detectedAnnounceGroups
                    .map(g => `• **${g.subject}**\n  \`${g.id}\``)
                    .join('\n')
                : '*Belum terdeteksi (jalankan `/wa-update login` terlebih dahulu)*';

            const embed = new EmbedBuilder()
                .setColor(config.enabled && status.isConnected ? 0x25D366 : 0xFFA500)
                .setTitle(`📢 Status WA Announcements Bridge • ${interaction.guild.name}`)
                .addFields(
                    {
                        name: 'Status Fitur',
                        value: config.enabled ? '🟢 Aktif' : '🔴 Nonaktif',
                        inline: true
                    },
                    {
                        name: 'Koneksi WhatsApp',
                        value: status.isConnected
                            ? '🟢 Terhubung'
                            : (status.hasSavedSession ? '🟡 Menghubungkan ulang...' : '⚪ Belum Ditautkan'),
                        inline: true
                    },
                    {
                        name: 'Channel Discord Tujuan',
                        value: config.channelId ? `<#${config.channelId}>` : '*Belum disetel (gunakan `/wa-update set`)*',
                        inline: false
                    },
                    {
                        name: 'JID Grup Announcements Terpilih',
                        value: config.announcementJid ? `\`${config.announcementJid}\`` : '*Belum dipilih*',
                        inline: false
                    },
                    {
                        name: 'Grup Announcements di Akun WA Ini',
                        value: detectedList,
                        inline: false
                    }
                )
                .setFooter({ text: 'Konfigurasi khusus untuk server ini' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'test') {
            const config = getWaConfig(guildId);
            if (!config.channelId) {
                return interaction.reply({
                    content: '⚠️ Channel tujuan belum diatur! Jalankan `/wa-update set` terlebih dahulu.',
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

            const missingPerms = checkBotChannelPerms(channel, interaction.client.user);
            if (missingPerms.length > 0) {
                return interaction.reply({
                    content: `❌ Bot kekurangan izin **${missingPerms.join(', ')}** di channel <#${config.channelId}>.`,
                    ephemeral: true
                });
            }

            const testEmbed = new EmbedBuilder()
                .setColor(0x25D366)
                .setAuthor({ name: '📢 Announcements • Uji Coba WhatsApp Bridge' })
                .setDescription('Pesan uji coba berhasil! Pengumuman dan file dari grup Announcements WhatsApp yang ditautkan akan diteruskan ke channel ini.')
                .setFooter({ text: `Diuji oleh ${interaction.user.username}` })
                .setTimestamp();

            await channel.send({ embeds: [testEmbed] });
            return interaction.reply({
                content: `✅ Pesan uji coba berhasil dikirim ke <#${config.channelId}>!`,
                ephemeral: true
            });
        }

        if (subcommand === 'enable') {
            const config = getWaConfig(guildId);
            if (!config.channelId || !config.announcementJid) {
                return interaction.reply({
                    content: '⚠️ Konfigurasi belum lengkap. Jalankan `/wa-update login` lalu `/wa-update set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            updateWaConfig(guildId, { enabled: true });
            return interaction.reply({
                content: `🟢 Penerusan pengumuman WhatsApp kembali **diaktifkan** ke channel <#${config.channelId}>.`,
                ephemeral: true
            });
        }

        if (subcommand === 'disable') {
            updateWaConfig(guildId, { enabled: false });
            return interaction.reply({
                content: '🔴 Penerusan pengumuman WhatsApp di server ini **dinonaktifkan sementara**.',
                ephemeral: true
            });
        }

        if (subcommand === 'logout') {
            await interaction.deferReply({ ephemeral: true });
            await disconnectGuildWhatsApp(guildId);
            return interaction.editReply({
                content: '🔌 Tautan akun WhatsApp untuk server ini telah diputus dan sesi loginnya dihapus.'
            });
        }
    }
};