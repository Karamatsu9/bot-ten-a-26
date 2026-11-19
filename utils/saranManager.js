const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SARAN_CONFIG_FILE = path.join(DATA_DIR, 'saranConfig.json');

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SARAN_CONFIG_FILE)) {
        fs.writeFileSync(SARAN_CONFIG_FILE, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
    }
}

function readAll() {
    ensureStorage();
    try {
        const parsed = JSON.parse(fs.readFileSync(SARAN_CONFIG_FILE, 'utf8'));
        return parsed && typeof parsed.guilds === 'object' ? parsed : { guilds: {} };
    } catch {
        return { guilds: {} };
    }
}

function writeAll(data) {
    ensureStorage();
    fs.writeFileSync(SARAN_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getSaranConfig(guildId) {
    const data = readAll();
    const cfg = data.guilds[guildId];
    if (!cfg) {
        return {
            enabled: false,
            channelId: '',
            allowAnonymous: true,
            count: 0
        };
    }
    return {
        enabled: Boolean(cfg.enabled),
        channelId: cfg.channelId || '',
        allowAnonymous: cfg.allowAnonymous !== undefined ? Boolean(cfg.allowAnonymous) : true,
        count: Number(cfg.count) || 0
    };
}

function updateSaranConfig(guildId, patch) {
    const data = readAll();
    const current = getSaranConfig(guildId);
    const updated = {
        enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
        channelId: patch.channelId !== undefined ? patch.channelId : current.channelId,
        allowAnonymous: patch.allowAnonymous !== undefined ? Boolean(patch.allowAnonymous) : current.allowAnonymous,
        count: patch.count !== undefined ? Number(patch.count) : current.count
    };
    data.guilds[guildId] = updated;
    writeAll(data);
    return updated;
}

function incrementSaranCount(guildId) {
    const current = getSaranConfig(guildId);
    const nextCount = current.count + 1;
    updateSaranConfig(guildId, { count: nextCount });
    return nextCount;
}

function checkSaranChannelPerms(channel, botUser, needAttach = false) {
    const perms = channel.permissionsFor(botUser);
    if (!perms) {
        return ['View Channel', 'Send Messages', 'Embed Links'];
    }

    const missing = [];
    if (!perms.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
    if (!perms.has(PermissionFlagsBits.SendMessages)) missing.push('Send Messages');
    if (!perms.has(PermissionFlagsBits.EmbedLinks)) missing.push('Embed Links');
    if (needAttach && !perms.has(PermissionFlagsBits.AttachFiles)) missing.push('Attach Files');
    return missing;
}

module.exports = {
    getSaranConfig,
    updateSaranConfig,
    incrementSaranCount,
    checkSaranChannelPerms
};