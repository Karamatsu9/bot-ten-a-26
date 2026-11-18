const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTORESPOND_FILE = path.join(DATA_DIR, 'autoresponds.json');
const WELCOME_FILE = path.join(DATA_DIR, 'welcome.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PRIVATE_ROOMS_FILE = path.join(DATA_DIR, 'private_rooms.json');

const DEFAULT_PREFIX = '!';

// Pastikan direktori data ada
function ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// Helper membaca file JSON dengan aman
function readJSON(filePath, defaultData = {}) {
    ensureDirectory();
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
        return defaultData;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultData;
    }
}

// Helper menulis file JSON
function writeJSON(filePath, data) {
    ensureDirectory();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ==================== AUTO RESPOND ====================

function getAutoResponds(guildId) {
    const data = readJSON(AUTORESPOND_FILE, {});
    return data[guildId] || [];
}

function addAutoRespond(guildId, { trigger, description, response, title, image, color, matchType = 'contains' }) {
    const data = readJSON(AUTORESPOND_FILE, {});
    if (!data[guildId]) {
        data[guildId] = [];
    }

    const descText = (description || response || '').trim();

    // Cek apakah trigger sudah ada (case-insensitive)
    const existingIndex = data[guildId].findIndex(
        item => item.trigger.toLowerCase() === trigger.toLowerCase().trim()
    );

    const newItem = {
        trigger: trigger.trim(),
        description: descText,
        response: descText, // kompatibilitas
        title: title ? title.trim() : null,
        image: image ? image.trim() : null,
        color: color ? color.trim() : null,
        matchType: matchType || 'contains',
        updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        data[guildId][existingIndex] = newItem;
    } else {
        data[guildId].push(newItem);
    }

    writeJSON(AUTORESPOND_FILE, data);
    return { isUpdate: existingIndex >= 0, item: newItem };
}

function editAutoRespond(guildId, { trigger, description, title, image, color, matchType }) {
    const data = readJSON(AUTORESPOND_FILE, {});
    if (!data[guildId]) return null;

    const index = data[guildId].findIndex(
        item => item.trigger.toLowerCase() === trigger.toLowerCase().trim()
    );
    if (index === -1) return null;

    const item = data[guildId][index];
    if (description !== undefined && description !== null) {
        item.description = description.trim();
        item.response = item.description;
    }
    if (title !== undefined && title !== null) {
        item.title = ['hapus', 'none', 'null'].includes(title.toLowerCase().trim()) ? null : title.trim();
    }
    if (image !== undefined && image !== null) {
        item.image = ['hapus', 'none', 'null'].includes(image.toLowerCase().trim()) ? null : image.trim();
    }
    if (color !== undefined && color !== null) {
        item.color = ['hapus', 'none', 'null'].includes(color.toLowerCase().trim()) ? null : color.trim();
    }
    if (matchType !== undefined && matchType !== null) {
        item.matchType = matchType;
    }
    item.updatedAt = new Date().toISOString();

    writeJSON(AUTORESPOND_FILE, data);
    return item;
}

function removeAutoRespond(guildId, trigger) {
    const data = readJSON(AUTORESPOND_FILE, {});
    if (!data[guildId]) return false;

    const initialLength = data[guildId].length;
    data[guildId] = data[guildId].filter(
        item => item.trigger.toLowerCase() !== trigger.toLowerCase().trim()
    );

    if (data[guildId].length < initialLength) {
        writeJSON(AUTORESPOND_FILE, data);
        return true;
    }
    return false;
}

function clearAutoResponds(guildId) {
    const data = readJSON(AUTORESPOND_FILE, {});
    if (data[guildId]) {
        delete data[guildId];
        writeJSON(AUTORESPOND_FILE, data);
        return true;
    }
    return false;
}

// ==================== WELCOME MESSAGE ====================

const DEFAULT_WELCOME_MESSAGE = 'Selamat datang {user} di {server}. Silahkan lihat-lihat dulu ada apa aja dan lanjut berunding di {channel}';

function getWelcomeConfig(guildId) {
    const data = readJSON(WELCOME_FILE, {});
    return data[guildId] || null;
}

function setWelcomeConfig(guildId, { channelId, chatChannelId, message, enabled = true }) {
    const data = readJSON(WELCOME_FILE, {});
    data[guildId] = {
        enabled,
        channelId,
        chatChannelId: chatChannelId || channelId,
        message: message && message.trim() ? message.trim() : DEFAULT_WELCOME_MESSAGE,
        updatedAt: new Date().toISOString()
    };
    writeJSON(WELCOME_FILE, data);
    return data[guildId];
}

function disableWelcome(guildId) {
    const data = readJSON(WELCOME_FILE, {});
    if (data[guildId]) {
        data[guildId].enabled = false;
        writeJSON(WELCOME_FILE, data);
        return true;
    }
    return false;
}

// ==================== GUILD SETTINGS (PREFIX, KATEGORI, DLL) ====================

function getGuildPrefix(guildId) {
    if (!guildId) return DEFAULT_PREFIX;
    const data = readJSON(SETTINGS_FILE, {});
    return data[guildId]?.prefix || DEFAULT_PREFIX;
}

function setGuildPrefix(guildId, newPrefix) {
    if (!guildId) return DEFAULT_PREFIX;
    const data = readJSON(SETTINGS_FILE, {});
    if (!data[guildId]) data[guildId] = {};
    const cleanPrefix = newPrefix.trim();
    data[guildId].prefix = cleanPrefix;
    data[guildId].updatedAt = new Date().toISOString();
    writeJSON(SETTINGS_FILE, data);
    return cleanPrefix;
}

function getPrivateCategory(guildId) {
    if (!guildId) return null;
    const data = readJSON(SETTINGS_FILE, {});
    return data[guildId]?.privateCategoryId || null;
}

function setPrivateCategory(guildId, categoryId) {
    if (!guildId) return null;
    const data = readJSON(SETTINGS_FILE, {});
    if (!data[guildId]) data[guildId] = {};
    data[guildId].privateCategoryId = categoryId;
    data[guildId].updatedAt = new Date().toISOString();
    writeJSON(SETTINGS_FILE, data);
    return categoryId;
}

// ==================== PRIVATE ROOMS ====================

function getPrivateRooms(guildId) {
    if (!guildId) return [];
    const data = readJSON(PRIVATE_ROOMS_FILE, {});
    return data[guildId] || [];
}

function addPrivateRoom(guildId, roomData) {
    if (!guildId) return null;
    const data = readJSON(PRIVATE_ROOMS_FILE, {});
    if (!data[guildId]) data[guildId] = [];

    data[guildId].push({
        ...roomData,
        createdAt: new Date().toISOString()
    });

    writeJSON(PRIVATE_ROOMS_FILE, data);
    return roomData;
}

function removePrivateRoom(guildId, channelId) {
    if (!guildId) return null;
    const data = readJSON(PRIVATE_ROOMS_FILE, {});
    if (!data[guildId]) return null;

    const roomIndex = data[guildId].findIndex(r => r.channelId === channelId);
    if (roomIndex === -1) return null;

    const [removed] = data[guildId].splice(roomIndex, 1);
    writeJSON(PRIVATE_ROOMS_FILE, data);
    return removed;
}

function getPrivateRoomByChannel(guildId, channelId) {
    if (!guildId) return null;
    const rooms = getPrivateRooms(guildId);
    return rooms.find(r => r.channelId === channelId) || null;
}

module.exports = {
    DEFAULT_PREFIX,
    DEFAULT_WELCOME_MESSAGE,
    getAutoResponds,
    addAutoRespond,
    editAutoRespond,
    removeAutoRespond,
    clearAutoResponds,
    getWelcomeConfig,
    setWelcomeConfig,
    disableWelcome,
    getGuildPrefix,
    setGuildPrefix,
    getPrivateCategory,
    setPrivateCategory,
    getPrivateRooms,
    addPrivateRoom,
    removePrivateRoom,
    getPrivateRoomByChannel
};
