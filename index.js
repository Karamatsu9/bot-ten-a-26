require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    ActivityType,
    EmbedBuilder,
    Events,
    PermissionFlagsBits
} = require('discord.js');
const storage = require('./utils/storage');
const { askGemini, splitMessage } = require('./utils/gemini');

// Validasi Token
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_bot_token_here') {
    console.error('\x1b[31m[ERROR] DISCORD_TOKEN belum diisi di file .env!\x1b[0m');
    console.log('Silakan buka file .env dan masukkan token bot Anda dari Discord Developer Portal.');
    process.exit(1);
}

// Inisialisasi Client Discord dengan Intents yang dibutuhkan
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Diperlukan untuk mendeteksi member baru bergabung (Welcome Message)
    ]
});

// Koleksi Slash Commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Event ketika bot berhasil login dan siap
client.once(Events.ClientReady, () => {
    console.log(`\x1b[32m[SUKSES] Bot online sebagai ${client.user.tag}!\x1b[0m`);
    
    // Tampilkan daftar server yang dimasuki bot untuk memudahkan copy GUILD_ID
    if (client.guilds.cache.size > 0) {
        console.log('\x1b[36m[INFO] Server yang terhubung dengan bot:\x1b[0m');
        client.guilds.cache.forEach(guild => {
            console.log(` • \x1b[33m${guild.name}\x1b[0m -> GUILD_ID: \x1b[32m${guild.id}\x1b[0m`);
        });
        console.log('💡 Tip: Masukkan GUILD_ID di atas ke file .env lalu jalankan "npm run deploy" agar Slash Commands muncul seketika tanpa jeda cache!\n');
    }

    // Set status aktivitas bot
    client.user.setPresence({
        activities: [{ name: 'Ketik /help atau !help', type: ActivityType.Playing }],
        status: 'online',
    });
});

// Event menangani Slash Commands (/ping, /help, /autorespond, /welcome, dll)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`Tidak ada command dengan nama ${interaction.commandName} ditemukan.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error saat menjalankan perintah /${interaction.commandName}:`, error);
        const errorMsg = { 
            content: '❌ Terjadi kesalahan saat menjalankan perintah ini.', 
            ephemeral: true 
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg);
        } else {
            await interaction.reply(errorMsg);
        }
    }
});

// Event menangani Pesan Teks (Autorespond & Prefix commands)
client.on('messageCreate', async (message) => {
    // Abaikan pesan dari bot
    if (message.author.bot) return;

    // 1. Fitur Auto-Respond dengan Embed (hanya berjalan di server/guild)
    if (message.guild) {
        const autoResponds = storage.getAutoResponds(message.guild.id);
        if (autoResponds && autoResponds.length > 0) {
            const userMsg = message.content.toLowerCase();
            
            // Cari kata pemicu yang cocok
            const matched = autoResponds.find(item => {
                const trig = item.trigger.toLowerCase();
                if (item.matchType === 'exact') {
                    return userMsg.trim() === trig;
                }
                return userMsg.includes(trig);
            });

            if (matched) {
                let embedColor = 0x5865F2; // Default warna Discord Blurple
                if (matched.color) {
                    const parsed = parseInt(matched.color.replace('#', ''), 16);
                    if (!isNaN(parsed)) embedColor = parsed;
                }

                const embed = new EmbedBuilder()
                    .setColor(embedColor);

                if (matched.title) {
                    embed.setTitle(matched.title);
                }

                const desc = matched.description || matched.response;
                if (desc) {
                    embed.setDescription(desc);
                }

                if (matched.image) {
                    try {
                        embed.setImage(matched.image);
                    } catch (err) {
                        console.error('Gagal memasang gambar embed autorespond:', err);
                    }
                }

                embed.setFooter({ 
                    text: `Auto Response • Pemicu: "${matched.trigger}"`, 
                    iconURL: client.user.displayAvatarURL() 
                });

                return message.reply({ embeds: [embed] });
            }
        }
    }

    // Dapatkan prefix server (default: '!')
    const prefix = storage.getGuildPrefix(message.guild?.id);
    const content = message.content.trim();
    const contentLower = content.toLowerCase();

    // 2. Perintah Mengubah Prefix: [prefix]setprefix <prefix_baru>
    if (content.startsWith(`${prefix}setprefix`)) {
        if (!message.member || !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ **Akses Ditolak!** Hanya pengguna dengan izin **Administrator** yang dapat mengubah prefix bot.');
        }

        const args = content.slice(prefix.length + 'setprefix'.length).trim();
        if (!args) {
            return message.reply(`⚠️ Masukkan prefix baru! Contoh: \`${prefix}setprefix ?\``);
        }

        if (args.length > 5) {
            return message.reply('❌ Prefix terlalu panjang! Maksimal 5 karakter.');
        }

        if (args.includes(' ')) {
            return message.reply('❌ Prefix tidak boleh mengandung spasi.');
        }

        storage.setGuildPrefix(message.guild.id, args);
        return message.reply(`✅ **Prefix bot berhasil diubah!** Sekarang gunakan \`${args}\` untuk perintah (contoh: \`${args}ask\`, \`${args}ping\`, \`${args}help\`).`);
    }

    // 3. Perintah Tanya Gemini AI: [prefix]ask <pertanyaan> ATAU [prefix] <pertanyaan>
    let isAskCommand = false;
    let query = '';

    if (content.startsWith(`${prefix}ask`)) {
        isAskCommand = true;
        query = content.slice(prefix.length + 'ask'.length).trim();
    } else if (content.startsWith(`${prefix} `)) {
        isAskCommand = true;
        query = content.slice(prefix.length).trim();
    }

    if (isAskCommand) {
        if (!query) {
            return message.reply(`❓ Silakan masukkan pertanyaanmu!\nContoh:\n• \`${prefix}ask Siapakah penemu komputer?\`\n• \`${prefix} Jelaskan apa itu kecerdasan buatan\``);
        }

        try {
            // Tampilkan status "bot is typing..."
            await message.channel.sendTyping();

            const answer = await askGemini(query);
            const chunks = splitMessage(answer, 1950);

            // Kirim balasan pertama dengan mention/reply
            await message.reply(chunks[0]);

            // Jika jawaban melebihi 2000 karakter, kirim bagian lanjutannya
            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]);
            }
        } catch (error) {
            console.error('[GEMINI] Error saat menjawab pertanyaan:', error);
            if (error.code === 'MISSING_API_KEY' || error.message === 'MISSING_API_KEY') {
                return message.reply('⚠️ **Gemini API Key belum dimasukkan!**\nSilakan masukkan API Key Anda di file `.env` pada variabel `GEMINI_API_KEY=...` (Bisa didapatkan secara gratis di https://aistudio.google.com/app/apikey).');
            }
            return message.reply('❌ Terjadi kesalahan saat menghubungi Gemini AI. Silakan coba beberapa saat lagi.');
        }
        return;
    }

    // 4. Respon percakapan santai bawaan
    if (contentLower === 'halo bot' || contentLower === 'halo' || contentLower === `${prefix}halo`) {
        return message.reply(`Halo <@${message.author.id}>! Ada yang bisa kubantu? Ketik \`${prefix}ask <pertanyaan>\` untuk bertanya ke AI, atau \`${prefix}help\` untuk melihat daftar perintah.`);
    }

    // 5. Perintah dengan prefix: ping
    if (content.startsWith(`${prefix}ping`)) {
        const ping = client.ws.ping;
        return message.reply(`🏓 **Pong!** Latensi bot ke Discord Gateway: \`${ping}ms\``);
    }

    // 6. Perintah dengan prefix: help
    if (content.startsWith(`${prefix}help`)) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle(`📖 Menu Bantuan (Prefix: ${prefix})`)
            .setDescription(`Prefix server ini: \`${prefix}\`\nBerikut perintah yang tersedia:`)
            .addFields(
                { name: `✨ ${prefix}ask <pertanyaan> atau ${prefix} <pertanyaan>`, value: 'Tanya apa saja langsung dijawab oleh Gemini AI!' },
                { name: `⚙️ ${prefix}setprefix <prefix_baru>`, value: 'Mengubah prefix bot (Khusus Administrator)' },
                { name: `🏓 ${prefix}ping`, value: 'Mengecek respon dan latensi bot' },
                { name: `👋 ${prefix}halo`, value: 'Menyapa bot' },
                { name: 'Slash Commands', value: 'Gunakan `/help` untuk melihat fitur lengkap termasuk pengaturan Auto-Response dan Welcome Message.' }
            )
            .setFooter({ text: `Diminta oleh ${message.author.username}` });

        return message.reply({ embeds: [helpEmbed] });
    }
});

// Event ketika ada member baru yang bergabung ke server (Welcome Message)
client.on('guildMemberAdd', async (member) => {
    try {
        const config = storage.getWelcomeConfig(member.guild.id);
        
        // Cek apakah fitur diaktifkan dan channel telah disetel
        if (!config || !config.enabled || !config.channelId) return;

        const channel = member.guild.channels.cache.get(config.channelId);
        if (!channel) {
            console.warn(`[WELCOME] Channel sambutan (${config.channelId}) tidak ditemukan di server ${member.guild.name}.`);
            return;
        }

        const chatChannelId = config.chatChannelId || config.channelId;
        const template = config.message || storage.DEFAULT_WELCOME_MESSAGE;

        // Ganti placeholder dengan data asli
        const formattedMessage = template
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{channel}/g, `<#${chatChannelId}>`)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

        await channel.send(formattedMessage);
        console.log(`[WELCOME] Pesan sambutan terkirim untuk ${member.user.tag} di ${member.guild.name}`);
    } catch (error) {
        console.error('[WELCOME] Gagal mengirim pesan sambutan:', error);
    }
});

// Jalankan Bot
client.login(process.env.DISCORD_TOKEN);
