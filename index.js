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
const { sendPaginatedHelp } = require('./commands/help');
const { askGemini, splitMessage } = require('./utils/gemini');
const { 
    parseTimeWIB, 
    formatWIB, 
    addReminder, 
    getUserReminders, 
    deleteReminder, 
    startReminderLoop 
} = require('./utils/reminderManager');
const { startWhatsAppBridge } = require('./utils/waBridge');

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

// Koleksi Slash Commands (Otomatis memuat commands/remind.js, commands/ask.js, dll)
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
    
    // Jalankan pengecekan jadwal reminder (UTC+7 / Jakarta)
    startReminderLoop(client);
    startWhatsAppBridge(client);
    console.log('\x1b[36m[INFO] Sistem Reminder UTC+7 (WIB) aktif.\x1b[0m');

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

// Event menangani Slash Commands (/ping, /help, /ask, /remind, /autorespond, /welcome, dll)
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
        return message.reply(`✅ **Prefix bot berhasil diubah!** Sekarang gunakan \`${args}\` untuk perintah (contoh: \`${args}ask\`, \`${args}remind\`, \`${args}ping\`, \`${args}help\`).`);
    }

    // 3. Perintah Reminder (UTC+7 / Jakarta): [prefix]remind
    if (contentLower === `${prefix}remind` || contentLower.startsWith(`${prefix}remind `)) {
        const raw = content.slice(prefix.length + 'remind'.length).trim();

        // Lihat daftar reminder aktif: [prefix]remind list
        if (raw.toLowerCase() === 'list') {
            const list = getUserReminders(message.author.id);
            if (list.length === 0) {
                return message.reply('📭 Kamu belum memiliki pengingat aktif saat ini.');
            }

            const lines = list.map((r, idx) => {
                const unix = Math.floor(r.remindAt / 1000);
                return `${idx + 1}. **ID:** \`${r.id}\` — ${formatWIB(r.remindAt)} (<t:${unix}:R>)\n   > ${r.message}`;
            });

            return message.reply(`📋 **Daftar Pengingat Aktif Kamu:**\n\n${lines.join('\n\n')}`);
        }

        // Hapus reminder: [prefix]remind hapus <id>
        if (raw.toLowerCase().startsWith('hapus ')) {
            const id = raw.slice('hapus'.length).trim();
            if (!id) {
                return message.reply(`⚠️ Masukkan ID pengingat yang ingin dihapus! Contoh: \`${prefix}remind hapus abc123\``);
            }

            const removed = deleteReminder(id, message.author.id);
            if (!removed) {
                return message.reply(`❌ Pengingat dengan ID \`${id}\` tidak ditemukan atau bukan milikmu.`);
            }

            return message.reply(`🗑️ Pengingat dengan ID \`${id}\` berhasil dibatalkan.`);
        }

        // Buat reminder baru: [prefix]remind <waktu> | <pesan>
        const parts = raw.split('|');
        if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
            return message.reply(
                `⏰ **Cara Menggunakan Reminder (Waktu Jakarta / UTC+7):**\n` +
                `• Buat baru: \`${prefix}remind <waktu> | <pesan>\`\n` +
                `  *Contoh:* \`${prefix}remind 30m | Kumpul tugas\` atau \`${prefix}remind 19:30 | Rapat kelompok\`\n` +
                `• Lihat daftar: \`${prefix}remind list\`\n` +
                `• Batalkan: \`${prefix}remind hapus <id>\``
            );
        }

        const waktuInput = parts[0].trim();
        const pesan = parts.slice(1).join('|').trim();
        const targetMs = parseTimeWIB(waktuInput);

        if (!targetMs) {
            return message.reply(
                '⚠️ **Format waktu tidak valid atau sudah terlewat!**\n' +
                'Gunakan waktu **UTC+7 (WIB)** dengan salah satu format berikut:\n' +
                '• Durasi: `15m`, `2j`, `1j 30m`, `1d`\n' +
                '• Jam hari ini/besok: `19:30`\n' +
                '• Tanggal & jam: `20/11/2026 08:00` atau `2026-11-20 08:00`'
            );
        }

        const reminder = addReminder({
            userId: message.author.id,
            channelId: message.channel.id,
            message: pesan,
            remindAt: targetMs
        });

        const unixSeconds = Math.floor(targetMs / 1000);
        return message.reply(
            `✅ **Pengingat disimpan!** (ID: \`${reminder.id}\`)\n` +
            `• **Waktu:** ${formatWIB(targetMs)} (<t:${unixSeconds}:R>)\n` +
            `• **Pesan:** ${pesan}\n` +
            `• **Notifikasi:** Dikirim lewat **DM** *(pastikan DM dari server ini tidak dikunci)*`
        );
    }

    // 4. Perintah Tanya Bot TEN A '26: [prefix]ask <pertanyaan> ATAU [prefix] <pertanyaan> (Mendukung Lampiran File & Link Google)
    let isAskCommand = false;
    let query = '';

    if (content.startsWith(`${prefix}ask`)) {
        isAskCommand = true;
        query = content.slice(prefix.length + 'ask'.length).trim();
    } else if (content.startsWith(`${prefix} `)) {
        isAskCommand = true;
        query = content.slice(prefix.length).trim();
    } else if (content === prefix && message.attachments.size > 0) {
        isAskCommand = true;
        query = '';
    }

    if (isAskCommand) {
        // Ambil lampiran dari pesan saat ini, atau dari pesan yang di-reply jika ada
        let attachments = Array.from(message.attachments.values());
        if (attachments.length === 0 && message.reference) {
            const repliedMsg = await message.fetchReference().catch(() => null);
            if (repliedMsg && repliedMsg.attachments.size > 0) {
                attachments = Array.from(repliedMsg.attachments.values());
            }
        }

        if (!query && attachments.length === 0) {
            return message.reply(`❓ Silakan masukkan pertanyaanmu atau lampirkan file!\nContoh:\n• \`${prefix}ask Jelaskan konsep perpindahan panas konveksi\`\n• Kirim gambar/PDF lalu beri caption \`${prefix}ask tolong jelaskan isi file ini\``);
        }

        const finalQuery = query || 'Tolong baca, rangkum, dan jelaskan isi dari file yang dilampirkan ini.';

        try {
            await message.channel.sendTyping();

            const userInfo = {
                id: message.author.id,
                username: message.author.username,
                displayName: message.member?.displayName || message.author.globalName || message.author.username
            };

            const answer = await askGemini(finalQuery, attachments, userInfo);
            const chunks = splitMessage(answer, 1950);

            await message.reply(chunks[0]);

            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]);
            }
        } catch (error) {
            console.error('[GEMINI] Error saat menjawab pertanyaan:', error);
            if (error.code === 'MISSING_API_KEY' || error.message === 'MISSING_API_KEY') {
                return message.reply('⚠️ **Gemini API Key belum dimasukkan!**\nSilakan masukkan API Key Anda di file `.env` pada variabel `GEMINI_API_KEY=...` (Bisa didapatkan secara gratis di https://aistudio.google.com/app/apikey).');
            }
            if (error.code === 'FILE_TOO_LARGE' || error.code === 'UNSUPPORTED_FILE_TYPE') {
                return message.reply(`⚠️ ${error.message}\nFormat yang didukung: **PDF, gambar (PNG/JPG/WEBP), file teks/data (TXT, CSV, JSON, MD), serta audio/video** (maks. 15 MB). *(Untuk file Word/Excel/PPT, silakan export ke PDF terlebih dahulu).*`);
            }
            if (error.code === 'DRIVE_ACCESS_DENIED') {
                return message.reply(`🔒 ${error.message}`);
            }
            return message.reply('❌ Terjadi kesalahan saat memproses pertanyaan atau filemu. Silakan coba beberapa saat lagi.');
        }
        return;
    }

    // 5. Respon percakapan santai bawaan
    if (contentLower === 'halo bot' || contentLower === 'halo' || contentLower === `${prefix}halo`) {
        return message.reply(`Halo <@${message.author.id}>! Ada yang bisa kubantu? Ketik \`${prefix}ask <pertanyaan>\` untuk bertanya, atau \`${prefix}help\` untuk melihat daftar perintah.`);
    }

    // 6. Perintah dengan prefix: ping
    if (content.startsWith(`${prefix}ping`)) {
        const ping = client.ws.ping;
        return message.reply(`🏓 **Pong!** Latensi bot ke Discord Gateway: \`${ping}ms\``);
    }

    // 7. Perintah dengan prefix: help
    // 7. Perintah dengan prefix: help
    if (content.startsWith(`${prefix}help`)) {
        return sendPaginatedHelp(message, message.guild?.id, message.author, client, false);
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