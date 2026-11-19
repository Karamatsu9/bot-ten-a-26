const fs = require('fs');
const path = require('path');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTOROLE_FILE = path.join(DATA_DIR, 'autoroles.json');

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(AUTOROLE_FILE)) {
        fs.writeFileSync(AUTOROLE_FILE, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
    }
}

function readAll() {
    ensureStorage();
    try {
        const parsed = JSON.parse(fs.readFileSync(AUTOROLE_FILE, 'utf8'));
        return parsed && typeof parsed.guilds === 'object' ? parsed : { guilds: {} };
    } catch {
        return { guilds: {} };
    }
}

function writeAll(data) {
    ensureStorage();
    fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getAutoRoleConfig(guildId) {
    const data = readAll();
    const cfg = data.guilds[guildId];
    if (!cfg) {
        return { enabled: false, roleIds: [] };
    }
    return {
        enabled: Boolean(cfg.enabled),
        roleIds: Array.isArray(cfg.roleIds) ? cfg.roleIds : []
    };
}

function updateAutoRoleConfig(guildId, patch) {
    const data = readAll();
    const current = getAutoRoleConfig(guildId);
    const updated = {
        enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
        roleIds: patch.roleIds !== undefined ? [...new Set(patch.roleIds)] : current.roleIds
    };
    data.guilds[guildId] = updated;
    writeAll(data);
    return updated;
}

/**
 * Validasi apakah role aman dan dapat diberikan oleh bot maupun moderator
 */
async function validateTargetRole(guild, actorMember, role) {
    if (!role) {
        return '⚠️ Role tidak ditemukan.';
    }
    if (role.id === guild.id) {
        return '⚠️ Tidak dapat menggunakan role `@everyone` sebagai Auto-Role.';
    }
    if (role.managed) {
        return `⚠️ Role **${role.name}** dikelola otomatis oleh integrasi/bot lain sehingga tidak bisa diberikan secara manual.`;
    }

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return '❌ Bot belum memiliki izin **Manage Roles** di server ini.';
    }

    if (role.position >= botMember.roles.highest.position) {
        return `❌ Posisi role **${role.name}** lebih tinggi atau sejajar dengan role tertinggi bot.\nGeser posisi role bot ke atas **${role.name}** di menu **Server Settings → Roles**.`;
    }

    if (actorMember && guild.ownerId !== actorMember.id && role.position >= actorMember.roles.highest.position) {
        return `❌ Kamu tidak bisa mengatur role **${role.name}** karena posisinya lebih tinggi atau sejajar dengan role tertinggimu.`;
    }

    return null;
}

/**
 * Mencari role berdasarkan mention (<@&id>), ID angka, atau nama role
 */
async function resolveRoleFromInput(guild, rawInput) {
    if (!rawInput) return null;
    const cleaned = rawInput.trim();

    const mentionMatch = cleaned.match(/^<@&(\d+)>$/);
    const roleId = mentionMatch ? mentionMatch[1] : (/^\d{17,20}$/.test(cleaned) ? cleaned : null);

    if (roleId) {
        return guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    }

    const lower = cleaned.toLowerCase();
    return guild.roles.cache.find(r => r.id !== guild.id && r.name.toLowerCase() === lower) || null;
}

/**
 * Handler event guildMemberAdd untuk memberikan Auto-Role secara otomatis
 */
async function applyAutoRoleOnJoin(member) {
    try {
        if (!member || !member.guild || member.user.bot) return;

        const config = getAutoRoleConfig(member.guild.id);
        if (!config.enabled || config.roleIds.length === 0) return;

        const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
        if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return;

        const validRoles = [];
        for (const roleId of config.roleIds) {
            const role = member.guild.roles.cache.get(roleId) || await member.guild.roles.fetch(roleId).catch(() => null);
            if (role && !role.managed && role.id !== member.guild.id && role.position < botMember.roles.highest.position) {
                validRoles.push(role);
            }
        }

        if (validRoles.length === 0) return;

        await member.roles.add(validRoles, 'Auto-Role member baru bergabung');
        console.log(`[AUTOROLE] Memberikan ${validRoles.length} role ke ${member.user.tag} di ${member.guild.name}`);
    } catch (err) {
        console.error(`[AUTOROLE] Gagal memberikan role ke ${member?.user?.tag}:`, err);
    }
}

/**
 * Handler command prefix: [prefix]autorole <set|add|remove|status|enable|disable|clear>
 */
async function handleAutoRolePrefix(message, prefix) {
    if (!message.guild) {
        return message.reply('⚠️ Perintah ini hanya bisa digunakan di dalam server.');
    }

    const hasPerm =
        message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
        message.member?.permissions.has(PermissionFlagsBits.ManageRoles);

    if (!hasPerm) {
        return message.reply('❌ **Akses Ditolak!** Hanya **Moderator** atau **Administrator** yang dapat mengatur Auto-Role.');
    }

    const rawArgs = message.content.trim().slice(prefix.length + 'autorole'.length).trim();
    const parts = rawArgs.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || 'status').toLowerCase();
    const roleArg = parts.slice(1).join(' ');

    if (sub === 'set' || sub === 'add') {
        if (!roleArg) {
            return message.reply(`⚠️ Masukkan role tujuan! Contoh: \`${prefix}autorole ${sub} @Member\` atau \`${prefix}autorole ${sub} NamaRole\``);
        }

        const role = await resolveRoleFromInput(message.guild, roleArg);
        const errorMsg = await validateTargetRole(message.guild, message.member, role);
        if (errorMsg) return message.reply(errorMsg);

        const current = getAutoRoleConfig(message.guild.id);
        const nextRoleIds = sub === 'set' ? [role.id] : [...current.roleIds, role.id];
        const updated = updateAutoRoleConfig(message.guild.id, { enabled: true, roleIds: nextRoleIds });

        const roleMentions = updated.roleIds.map(id => `<@&${id}>`).join(', ');
        return message.reply({
            content:
                `✅ **Auto-Role berhasil ${sub === 'set' ? 'diatur' : 'ditambahkan'}!**\n` +
                `• **Status:** 🟢 Aktif\n` +
                `• **Role Member Baru:** ${roleMentions}`,
            allowedMentions: { parse: [] }
        });
    }

    if (sub === 'remove' || sub === 'hapus') {
        if (!roleArg) {
            return message.reply(`⚠️ Masukkan role yang ingin dihapus! Contoh: \`${prefix}autorole remove @Member\``);
        }

        const role = await resolveRoleFromInput(message.guild, roleArg);
        const targetId = role ? role.id : roleArg.replace(/[<@&>]/g, '');
        const current = getAutoRoleConfig(message.guild.id);

        if (!current.roleIds.includes(targetId)) {
            return message.reply('⚠️ Role tersebut tidak ada di dalam daftar Auto-Role server ini.');
        }

        const remaining = current.roleIds.filter(id => id !== targetId);
        const updated = updateAutoRoleConfig(message.guild.id, {
            roleIds: remaining,
            enabled: remaining.length > 0 ? current.enabled : false
        });

        return message.reply({
            content:
                `🗑️ Role dihapus dari Auto-Role.\n` +
                `• **Sisa Role Aktif:** ${updated.roleIds.length > 0 ? updated.roleIds.map(id => `<@&${id}>`).join(', ') : '*Kosong (otomatis nonaktif)*'}`,
            allowedMentions: { parse: [] }
        });
    }

    if (sub === 'enable' || sub === 'on') {
        const current = getAutoRoleConfig(message.guild.id);
        if (current.roleIds.length === 0) {
            return message.reply(`⚠️ Belum ada role yang disetel. Gunakan \`${prefix}autorole set @Role\` terlebih dahulu.`);
        }

        updateAutoRoleConfig(message.guild.id, { enabled: true });
        return message.reply({
            content: `🟢 **Auto-Role diaktifkan!** Member baru akan otomatis mendapatkan: ${current.roleIds.map(id => `<@&${id}>`).join(', ')}`,
            allowedMentions: { parse: [] }
        });
    }

    if (sub === 'disable' || sub === 'off') {
        updateAutoRoleConfig(message.guild.id, { enabled: false });
        return message.reply('🔴 **Auto-Role dinonaktifkan sementara.**');
    }

    if (sub === 'clear' || sub === 'reset') {
        updateAutoRoleConfig(message.guild.id, { enabled: false, roleIds: [] });
        return message.reply('🧹 Seluruh daftar Auto-Role berhasil dihapus dan dinonaktifkan.');
    }

    if (sub === 'status' || sub === 'list') {
        const config = getAutoRoleConfig(message.guild.id);
        const roleList = config.roleIds.length > 0
            ? config.roleIds.map((id, i) => `${i + 1}. <@&${id}> (\`${id}\`)`).join('\n')
            : `*Belum ada role disetel (gunakan \`${prefix}autorole set @Role\`)*`;

        const embed = new EmbedBuilder()
            .setColor(config.enabled ? 0x57F287 : 0xED4245)
            .setTitle(`🎭 Pengaturan Auto-Role • ${message.guild.name}`)
            .addFields(
                { name: 'Status', value: config.enabled ? '🟢 Aktif' : '🔴 Nonaktif', inline: true },
                { name: 'Jumlah Role', value: `${config.roleIds.length} role`, inline: true },
                { name: 'Daftar Role Otomatis', value: roleList, inline: false },
                {
                    name: 'Panduan Perintah',
                    value:
                        `• \`${prefix}autorole set @Role\` — Tetapkan 1 role utama\n` +
                        `• \`${prefix}autorole add @Role\` — Tambah role ekstra\n` +
                        `• \`${prefix}autorole remove @Role\` — Hapus 1 role\n` +
                        `• \`${prefix}autorole enable\` / \`disable\` / \`clear\``
                }
            );

        return message.reply({ embeds: [embed] });
    }

    return message.reply(
        `⚠️ Subcommand tidak dikenal. Gunakan:\n` +
        `\`${prefix}autorole set @Role\`, \`add @Role\`, \`remove @Role\`, \`status\`, \`enable\`, \`disable\`, atau \`clear\`.`
    );
}

module.exports = {
    getAutoRoleConfig,
    updateAutoRoleConfig,
    validateTargetRole,
    applyAutoRoleOnJoin,
    handleAutoRolePrefix
};