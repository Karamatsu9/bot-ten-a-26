const { 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits,
    EmbedBuilder 
} = require('discord.js');
const storage = require('../utils/storage');

/**
 * Mencari angka terkecil yang belum digunakan untuk penamaan role private-room-[number]
 * @param {import('discord.js').Guild} guild 
 * @returns {number}
 */
function getLowestAvailableRoomNumber(guild) {
    const usedNumbers = new Set();
    guild.roles.cache.forEach(role => {
        const match = role.name.match(/^private-room-(\d+)$/i);
        if (match) {
            usedNumbers.add(parseInt(match[1], 10));
        }
    });

    let num = 1;
    while (usedNumbers.has(num)) {
        num++;
    }
    return num;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-private-channel')
        .setDescription('Buat channel private dan undang member lain ke dalam room')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Nama kustom untuk channel (opsional, default: private-room-[nomor])')
                .setRequired(false)
        )
        .addUserOption(opt =>
            opt.setName('user1')
                .setDescription('User pertama yang ingin diundang')
                .setRequired(false)
        )
        .addUserOption(opt =>
            opt.setName('user2')
                .setDescription('User kedua yang ingin diundang')
                .setRequired(false)
        )
        .addUserOption(opt =>
            opt.setName('user3')
                .setDescription('User ketiga yang ingin diundang')
                .setRequired(false)
        ),

    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            return interaction.reply({ content: 'Perintah ini hanya bisa digunakan di dalam server.', ephemeral: true });
        }

        // Cek permission bot untuk membuat role dan channel
        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ Bot memerlukan izin **Manage Roles** dan **Manage Channels** untuk membuat private room!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Dapatkan angka role terkecil yang belum terpakai
            const roomNumber = getLowestAvailableRoomNumber(guild);
            const roleName = `private-room-${roomNumber}`;

            // 2. Buat role baru untuk private room ini
            const role = await guild.roles.create({
                name: roleName,
                color: 0x5865F2,
                mentionable: true,
                reason: `Private room role created by ${interaction.user.tag}`
            });

            // 3. Tambahkan role ke pembuat channel
            await interaction.member.roles.add(role);

            // 4. Kumpulkan user yang diundang dan tambahkan rolenya
            const invitedUsers = [
                interaction.options.getUser('user1'),
                interaction.options.getUser('user2'),
                interaction.options.getUser('user3')
            ].filter(Boolean);

            const addedMembers = [interaction.user];

            for (const user of invitedUsers) {
                if (user.id === interaction.user.id) continue;
                try {
                    const member = await guild.members.fetch(user.id);
                    if (member) {
                        await member.roles.add(role);
                        addedMembers.push(user);
                    }
                } catch (err) {
                    console.error(`Gagal menambahkan role private ke user ${user.tag}:`, err);
                }
            }

            // 5. Tentukan nama channel & kategori
            const customName = interaction.options.getString('name');
            const cleanChannelName = (customName || roleName)
                .toLowerCase()
                .replace(/[^a-zA-Z0-9-_]/g, '-')
                .replace(/-+/g, '-');

            const categoryId = storage.getPrivateCategory(guild.id);

            // 6. Buat text channel private dengan permission overwrites
            const channel = await guild.channels.create({
                name: cleanChannelName,
                type: ChannelType.GuildText,
                parent: categoryId || undefined,
                permissionOverwrites: [
                    {
                        // Sembunyikan channel dari semua member biasa
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        // Izinkan role private-room-[number] untuk melihat dan mengirim pesan
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        // Pastikan bot tetap memiliki akses penuh
                        id: interaction.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageRoles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ],
                reason: `Private room dibuat oleh ${interaction.user.tag}`
            });

            // 7. Simpan data private room ke database/storage
            storage.addPrivateRoom(guild.id, {
                channelId: channel.id,
                roleId: role.id,
                roleName: roleName,
                roomNumber: roomNumber,
                creatorId: interaction.user.id
            });

            // 8. Kirim notifikasi sambutan di dalam private channel baru dan tag rolenya
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🔒 Private Room: ${channel.name}`)
                .setDescription(
                    `Halo <@&${role.id}>! Private channel berhasil dibuat.\n` +
                    `Channel ini hanya dapat dilihat oleh member yang memiliki role **${roleName}**.\n\n` +
                    `👥 **Anggota Room Saat Ini:**\n${addedMembers.map(u => `• <@${u.id}>`).join('\n')}\n\n` +
                    `⚠️ **Peringatan Penting:**\nJika urusan sudah selesai, silakan hapus room ini menggunakan command:\n` +
                    `\`/delete-private-channel\`\n` +
                    `agar channel beserta role privatnya dibersihkan otomatis.`
                )
                .setFooter({ text: 'Ten A Private Room System' });

            await channel.send({
                content: `🔔 <@&${role.id}> Channel private kalian sudah siap di sini!`,
                embeds: [welcomeEmbed]
            });

            // 9. Beri balasan ke interaction user
            return interaction.editReply({
                content: `✅ **Private room berhasil dibuat!**\n• **Channel:** <#${channel.id}>\n• **Role Akses:** <@&${role.id}> (\`${roleName}\`)\n• **Anggota:** ${addedMembers.map(u => `<@${u.id}>`).join(', ')}`
            });
        } catch (error) {
            console.error('Error saat membuat private channel:', error);
            return interaction.editReply({
                content: `❌ Gagal membuat private channel: ${error.message}`
            });
        }
    }
};
