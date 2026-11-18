require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] Memuat command: ${command.data.name}`);
    } else {
        console.warn(`[WARNING] File perintah di ${filePath} tidak memiliki properti "data" atau "execute" yang valid.`);
    }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || token === 'your_bot_token_here' || !clientId || clientId === 'your_client_id_here') {
    console.error('\x1b[31m[ERROR] Pastikan DISCORD_TOKEN dan CLIENT_ID sudah diisi di file .env!\x1b[0m');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`\nSedang mendaftarkan ${commands.length} slash commands...`);

        if (guildId && guildId !== 'your_guild_id_here') {
            // Bersihkan global commands agar tidak menimpa/menutupi command server
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] }
            );

            // Deploy instan ke 1 server spesifik (sangat cepat untuk testing)
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            console.log(`\x1b[32m[SUKSES] ${commands.length} Slash commands berhasil didaftarkan ke server (Guild ID: ${guildId})!\x1b[0m`);
        } else {
            // Deploy global ke semua server (bisa memakan waktu beberapa menit untuk sinkronisasi)
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            console.log(`\x1b[32m[SUKSES] ${commands.length} Slash commands berhasil didaftarkan secara Global!\x1b[0m`);
        }
    } catch (error) {
        console.error('Terjadi error saat mendaftarkan perintah:', error);
    }
})();
