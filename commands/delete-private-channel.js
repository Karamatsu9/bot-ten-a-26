const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const storage = require('../utils/storage');

// Melacak channel yang sedang dalam hitung mundur penghapusan agar tidak ganda
const pendingDeletions = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-private-channel')
        .setDescription('Hapus private room ini beserta role privatnya'),

    async execute(interaction) {
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!guild || !channel) {
            return interaction.reply({
                content: 'Perintah ini hanya bisa dijalankan di dalam server.',
                ephemeral: true
            });
        }

        // Cek apakah channel ini terdaftar sebagai private room di database
        const roomData = storage.getPrivateRoomByChannel(guild.id, channel.id);
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

        // Validasi izin pengguna: Pembuat room, pemilik role private, atau Administrator/ManageChannels
        const hasRoomPermission = (member) => {
            if (!member) return false;
            const hasRole = member.roles.cache.has(targetRoleId);
            const isCreator = roomData && roomData.creatorId === member.id;
            const isAdmin =
                member.permissions.has(PermissionFlagsBits.Administrator) ||
                member.permissions.has(PermissionFlagsBits.ManageChannels);
            return hasRole || isCreator || isAdmin;
        };

        if (!hasRoomPermission(interaction.member)) {
            return interaction.reply({
                content: '❌ Kamu tidak memiliki izin untuk menghapus private room ini.',
                ephemeral: true
            });
        }

        if (pendingDeletions.has(channel.id)) {
            return interaction.reply({
                content: '⏳ Penghapusan private room ini sudah dijadwalkan. Tekan tombol **Batalkan Penghapusan** pada pesan konfirmasi di atas jika ingin membatalkannya.',
                ephemeral: true
            });
        }

        pendingDeletions.add(channel.id);

        const buildCancelRow = (disabled = false) =>
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('cancel_delete_private_channel')
                    .setLabel('Batalkan Penghapusan')
                    .setEmoji('✖️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );

        const deleteTimestamp = Math.floor((Date.now() + 10_000) / 1000);

        await interaction.reply({
            content:
                `⚠️ **Konfirmasi Penghapusan Private Room**\n` +
                `Channel ini beserta role privatnya **akan dihapus dalam 10 detik** (<t:${deleteTimestamp}:R>).\n` +
                `> 📝 *Catatan: Tekan tombol **Batalkan Penghapusan** di bawah sebelum 10 detik berakhir jika tidak jadi menghapus room ini.*`,
            components: [buildCancelRow(false)]
        });

        const replyMsg = await interaction.fetchReply();

        const collector = replyMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10_000
        });

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId !== 'cancel_delete_private_channel') return;

            if (!hasRoomPermission(btnInteraction.member)) {
                return btnInteraction.reply({
                    content: '❌ Kamu tidak memiliki izin untuk membatalkan penghapusan private room ini.',
                    ephemeral: true
                });
            }

            pendingDeletions.delete(channel.id);
            collector.stop('cancelled');

            await btnInteraction.update({
                content: `✅ **Penghapusan dibatalkan** oleh <@${btnInteraction.user.id}>. Private room ini tetap aktif.`,
                components: [buildCancelRow(true)]
            });
        });

        collector.on('end', async (_collected, reason) => {
            pendingDeletions.delete(channel.id);

            if (reason === 'cancelled') return;

            try {
                await replyMsg.edit({
                    content: '🗑️ **Waktu habis (10 detik)!** Sedang menghapus private room dan role...',
                    components: [buildCancelRow(true)]
                }).catch(() => {});

                // Hapus role private jika masih ada
                const role = guild.roles.cache.get(targetRoleId) || await guild.roles.fetch(targetRoleId).catch(() => null);
                if (role) {
                    await role.delete(`Private room dihapus oleh ${interaction.user.tag}`);
                }

                // Hapus dari data storage
                storage.removePrivateRoom(guild.id, channel.id);

                // Hapus channel
                await channel.delete(`Private room dihapus oleh ${interaction.user.tag}`);
            } catch (error) {
                console.error('Error saat menghapus private room:', error);
                await channel.send(`❌ Gagal menghapus private room: ${error.message}`).catch(() => {});
            }
        });
    }
};