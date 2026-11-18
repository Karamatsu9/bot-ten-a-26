const { 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-private-channel')
        .setDescription('Hapus private room ini beserta role privatnya'),

    async execute(interaction) {
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!guild || !channel) {
            return interaction.reply({ content: 'Perintah ini hanya bisa dijalankan di dalam server.', ephemeral: true });
        }

        // Cek apakah channel ini terdaftar sebagai private room di database
        let roomData = storage.getPrivateRoomByChannel(guild.id, channel.id);
        let targetRoleId = roomData ? roomData.roleId : null;

        // Fallback: Jika data belum tercatat di JSON, cari role di permission overwrites channel yang berawalan private-room-
        if (!targetRoleId) {
            const privateRoleOverwrite = channel.permissionOverwrites.cache.find(overwrite => {
                if (overwrite.type !== 0) return false; // 0 = Role
                const role = guild.roles.cache.get(overwrite.id);
                return role && /^private-room-\d+$/i.test(role.name);
            });

            if (privateRoleOverwrite) {
                targetRoleId = privateRoleOverwrite.id;
            }
        }

        // Jika bukan private room
        if (!targetRoleId) {
            return interaction.reply({
                content: '❌ Perintah ini hanya bisa digunakan di dalam **Private Room** yang dibuat oleh bot!',
                ephemeral: true
            });
        }

        // Validasi izin pengguna: Pembuat room, pemilik role private, atau Administrator
        const isMemberWithRole = interaction.member.roles.cache.has(targetRoleId);
        const isCreator = roomData && roomData.creatorId === interaction.user.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isMemberWithRole && !isCreator && !isAdmin) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menghapus private room ini.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: '🗑️ **Menghapus private room dan role...** Room ini akan ditutup dalam beberapa detik.'
        });

        try {
            // Hapus role private jika masih ada
            const role = guild.roles.cache.get(targetRoleId);
            if (role) {
                await role.delete(`Private room dihapus oleh ${interaction.user.tag}`);
            }

            // Hapus dari data storage
            storage.removePrivateRoom(guild.id, channel.id);

            // Tunggu 2 detik lalu hapus channel
            setTimeout(async () => {
                try {
                    await channel.delete(`Private room dihapus oleh ${interaction.user.tag}`);
                } catch (err) {
                    console.error('Gagal menghapus channel:', err);
                }
            }, 2000);
        } catch (error) {
            console.error('Error saat menghapus private room:', error);
            return interaction.followUp({
                content: `❌ Gagal menghapus private room: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
