const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const {
    getAutoRoleConfig,
    updateAutoRoleConfig,
    validateTargetRole
} = require('../utils/autoroleManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Atur pemberian role otomatis untuk member baru (Khusus Moderator/Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Tetapkan role utama yang otomatis diberikan saat member baru masuk')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role yang akan diberikan ke member baru')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Tambahkan role tambahan ke daftar Auto-Role member baru')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role tambahan yang ingin diberikan')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Hapus salah satu role dari daftar Auto-Role')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role yang ingin dihapus')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Lihat status dan daftar Auto-Role yang aktif di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Aktifkan fitur Auto-Role di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Nonaktifkan sementara fitur Auto-Role di server ini')
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Hapus semua daftar Auto-Role dan nonaktifkan fitur')
        ),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: '⚠️ Perintah ini hanya bisa digunakan di dalam server Discord.',
                ephemeral: true
            });
        }

        const hasPerm =
            interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
            interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles);

        if (!hasPerm) {
            return interaction.reply({
                content: '❌ **Akses Ditolak!** Hanya **Moderator** atau **Administrator** yang dapat mengatur Auto-Role.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'set' || subcommand === 'add') {
            const role = interaction.options.getRole('role');
            const errorMsg = await validateTargetRole(interaction.guild, interaction.member, role);
            if (errorMsg) {
                return interaction.reply({ content: errorMsg, ephemeral: true });
            }

            const current = getAutoRoleConfig(guildId);
            const nextRoleIds = subcommand === 'set' ? [role.id] : [...current.roleIds, role.id];
            const updated = updateAutoRoleConfig(guildId, { enabled: true, roleIds: nextRoleIds });

            return interaction.reply({
                content:
                    `✅ **Auto-Role berhasil ${subcommand === 'set' ? 'diatur' : 'ditambahkan'}!**\n` +
                    `• **Status:** 🟢 Aktif\n` +
                    `• **Role Member Baru:** ${updated.roleIds.map(id => `<@&${id}>`).join(', ')}`,
                ephemeral: true
            });
        }

        if (subcommand === 'remove') {
            const role = interaction.options.getRole('role');
            const current = getAutoRoleConfig(guildId);

            if (!current.roleIds.includes(role.id)) {
                return interaction.reply({
                    content: `⚠️ Role <@&${role.id}> tidak ada dalam daftar Auto-Role server ini.`,
                    ephemeral: true
                });
            }

            const remaining = current.roleIds.filter(id => id !== role.id);
            const updated = updateAutoRoleConfig(guildId, {
                roleIds: remaining,
                enabled: remaining.length > 0 ? current.enabled : false
            });

            return interaction.reply({
                content:
                    `🗑️ Role <@&${role.id}> dihapus dari Auto-Role.\n` +
                    `• **Sisa Role Aktif:** ${updated.roleIds.length > 0 ? updated.roleIds.map(id => `<@&${id}>`).join(', ') : '*Kosong (otomatis nonaktif)*'}`,
                ephemeral: true
            });
        }

        if (subcommand === 'status') {
            const config = getAutoRoleConfig(guildId);
            const roleList = config.roleIds.length > 0
                ? config.roleIds.map((id, i) => `${i + 1}. <@&${id}> (\`${id}\`)`).join('\n')
                : '*Belum ada role yang diatur (gunakan `/autorole set`)*';

            const embed = new EmbedBuilder()
                .setColor(config.enabled ? 0x57F287 : 0xED4245)
                .setTitle(`🎭 Pengaturan Auto-Role • ${interaction.guild.name}`)
                .addFields(
                    { name: 'Status Fitur', value: config.enabled ? '🟢 Aktif' : '🔴 Nonaktif', inline: true },
                    { name: 'Jumlah Role', value: `${config.roleIds.length} role`, inline: true },
                    { name: 'Daftar Role Otomatis', value: roleList, inline: false }
                )
                .setFooter({ text: 'Setiap member baru yang bergabung akan otomatis menerima role di atas' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'enable') {
            const config = getAutoRoleConfig(guildId);
            if (config.roleIds.length === 0) {
                return interaction.reply({
                    content: '⚠️ Belum ada role yang disetel. Jalankan `/autorole set` terlebih dahulu.',
                    ephemeral: true
                });
            }

            updateAutoRoleConfig(guildId, { enabled: true });
            return interaction.reply({
                content: `🟢 **Auto-Role diaktifkan!** Member baru akan menerima: ${config.roleIds.map(id => `<@&${id}>`).join(', ')}`,
                ephemeral: true
            });
        }

        if (subcommand === 'disable') {
            updateAutoRoleConfig(guildId, { enabled: false });
            return interaction.reply({
                content: '🔴 **Auto-Role dinonaktifkan sementara.** Gunakan `/autorole enable` untuk menyalakannya kembali.',
                ephemeral: true
            });
        }

        if (subcommand === 'clear') {
            updateAutoRoleConfig(guildId, { enabled: false, roleIds: [] });
            return interaction.reply({
                content: '🧹 Seluruh daftar Auto-Role berhasil dikosongkan dan dinonaktifkan.',
                ephemeral: true
            });
        }
    }
};