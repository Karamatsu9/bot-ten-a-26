const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder 
} = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Pengaturan fitur pesan sambutan / welcome message (Khusus Administrator)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Atur channel dan format pesan sambutan member baru')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel tempat pesan sambutan akan dikirim')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt.setName('chat_channel')
                        .setDescription('Channel obrolan untuk placeholder {channel} (contoh: #general-chat)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('Template pesan (Variabel: {user}, {server}, {channel}, {username}, {memberCount})')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Kirim simulasi pesan sambutan untuk melihat hasilnya')
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Lihat konfigurasi welcome message saat ini')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Nonaktifkan fitur welcome message')
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
        const guild = interaction.guild;
        const guildId = guild.id;

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            const chatChannel = interaction.options.getChannel('chat_channel');
            const message = interaction.options.getString('message');

            const savedConfig = storage.setWelcomeConfig(guildId, {
                channelId: channel.id,
                chatChannelId: chatChannel ? chatChannel.id : channel.id,
                message: message,
                enabled: true
            });

            // Format contoh preview
            const previewMsg = savedConfig.message
                .replace(/{user}/g, `<@${interaction.user.id}>`)
                .replace(/{username}/g, interaction.user.username)
                .replace(/{server}/g, guild.name)
                .replace(/{channel}/g, `<#${savedConfig.chatChannelId}>`)
                .replace(/{memberCount}/g, guild.memberCount.toString());

            return interaction.reply({
                content: `✅ **Pengaturan Welcome Message Berhasil Disimpan!**\n\n` +
                    `• **Channel Kirim:** <#${channel.id}>\n` +
                    `• **Channel Obrolan ({channel}):** <#${savedConfig.chatChannelId}>\n` +
                    `• **Status:** \`Aktif\`\n\n` +
                    `**Format Pesan:**\n\`${savedConfig.message}\`\n\n` +
                    `**Hasil Tampilan (Preview):**\n${previewMsg}\n\n` +
                    `*Gunakan \`/welcome test\` untuk menguji pengiriman ke channel tersebut.*`,
                ephemeral: true
            });
        }

        if (subcommand === 'test') {
            const config = storage.getWelcomeConfig(guildId);
            if (!config || !config.channelId) {
                return interaction.reply({
                    content: '⚠️ Fitur welcome message belum dikonfigurasi. Silakan jalankan `/welcome set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            const targetChannel = guild.channels.cache.get(config.channelId);
            if (!targetChannel) {
                return interaction.reply({
                    content: '❌ Channel tujuan welcome tidak ditemukan atau bot tidak memiliki akses ke channel tersebut.',
                    ephemeral: true
                });
            }

            const formattedMessage = (config.message || storage.DEFAULT_WELCOME_MESSAGE)
                .replace(/{user}/g, `<@${interaction.user.id}>`)
                .replace(/{username}/g, interaction.user.username)
                .replace(/{server}/g, guild.name)
                .replace(/{channel}/g, `<#${config.chatChannelId || config.channelId}>`)
                .replace(/{memberCount}/g, guild.memberCount.toString());

            try {
                await targetChannel.send(formattedMessage);
                return interaction.reply({
                    content: `✅ Pesan uji coba berhasil dikirim ke channel <#${targetChannel.id}>!`,
                    ephemeral: true
                });
            } catch (err) {
                console.error('Error saat mengirim welcome test:', err);
                return interaction.reply({
                    content: `❌ Gagal mengirim pesan ke <#${targetChannel.id}>. Pastikan bot memiliki izin **Send Messages** di channel tersebut.`,
                    ephemeral: true
                });
            }
        }

        if (subcommand === 'status') {
            const config = storage.getWelcomeConfig(guildId);
            if (!config) {
                return interaction.reply({
                    content: 'ℹ️ Belum ada konfigurasi welcome message di server ini. Atur dengan `/welcome set`.',
                    ephemeral: true
                });
            }

            const statusEmbed = new EmbedBuilder()
                .setColor(config.enabled ? 0x57F287 : 0xED4245)
                .setTitle('⚙️ Status Welcome Message')
                .addFields(
                    { name: 'Status', value: config.enabled ? '🟢 **Aktif**' : '🔴 **Nonaktif**', inline: true },
                    { name: 'Channel Kirim', value: config.channelId ? `<#${config.channelId}>` : 'Belum diatur', inline: true },
                    { name: 'Channel Obrolan', value: config.chatChannelId ? `<#${config.chatChannelId}>` : 'Sama dengan channel kirim', inline: true },
                    { name: 'Template Pesan', value: `\`\`\`${config.message}\`\`\`` }
                )
                .setFooter({ text: guild.name, iconURL: guild.iconURL() });

            return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
        }

        if (subcommand === 'disable') {
            const success = storage.disableWelcome(guildId);
            if (success) {
                return interaction.reply({
                    content: '⏹️ Fitur welcome message telah **dinonaktifkan**. Jalankan `/welcome set` untuk mengaktifkannya kembali.',
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: 'ℹ️ Fitur welcome message memang belum aktif di server ini.',
                    ephemeral: true
                });
            }
        }
    }
};
