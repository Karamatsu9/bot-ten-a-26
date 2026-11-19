const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

function ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REMINDERS_FILE)) {
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
}

function loadReminders() {
    ensureStorage();
    try {
        const raw = fs.readFileSync(REMINDERS_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function saveReminders(reminders) {
    ensureStorage();
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2), 'utf8');
}

/**
 * Mengurai string waktu user menjadi timestamp (ms) berbasis UTC+7 (Jakarta).
 * Format yang didukung:
 * - Relatif: "10m", "2j", "1j 30m", "1d", "30s"
 * - Jam WIB hari ini/besok: "19:30" atau "19.30"
 * - Tanggal & jam WIB: "20/11/2026 08:00" atau "2026-11-20 08:00"
 */
function parseTimeWIB(input) {
    const text = input.trim();
    const nowMs = Date.now();

    // 1. Cek format durasi relatif (contoh: "10m", "2j 30m", "1d")
    const tokenRegex = /(\d+)\s*(s|detik|m|menit|h|j|jam|d|hari)/gi;
    const stripped = text.replace(tokenRegex, '').trim();
    const matches = [...text.matchAll(tokenRegex)];

    if (matches.length > 0 && stripped === '') {
        let totalMs = 0;
        for (const match of matches) {
            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            if (unit === 's' || unit === 'detik') totalMs += value * 1000;
            else if (unit === 'm' || unit === 'menit') totalMs += value * 60 * 1000;
            else if (unit === 'h' || unit === 'j' || unit === 'jam') totalMs += value * 60 * 60 * 1000;
            else if (unit === 'd' || unit === 'hari') totalMs += value * 24 * 60 * 60 * 1000;
        }
        return totalMs > 0 ? nowMs + totalMs : null;
    }

    // 2. Cek format jam saja "HH:MM" atau "HH.MM" (WIB)
    const timeOnlyMatch = text.match(/^(\d{1,2})[:.](\d{2})$/);
    if (timeOnlyMatch) {
        const hour = parseInt(timeOnlyMatch[1], 10);
        const minute = parseInt(timeOnlyMatch[2], 10);
        if (hour > 23 || minute > 59) return null;

        // Ambil tanggal hari ini menurut kalender Jakarta (UTC+7)
        const nowWib = new Date(nowMs + WIB_OFFSET_MS);
        const year = nowWib.getUTCFullYear();
        const month = String(nowWib.getUTCMonth() + 1).padStart(2, '0');
        const day = String(nowWib.getUTCDate()).padStart(2, '0');
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');

        let targetMs = new Date(`${year}-${month}-${day}T${hh}:${mm}:00+07:00`).getTime();

        // Jika jam tersebut sudah lewat hari ini di WIB, otomatis jadwalkan untuk besok
        if (targetMs <= nowMs) {
            targetMs += 24 * 60 * 60 * 1000;
        }
        return targetMs;
    }

    // 3. Cek format "DD/MM/YYYY HH:MM" atau "DD-MM-YYYY HH:MM" (WIB)
    const dmyMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2})[:.](\d{2})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        const hour = dmyMatch[4].padStart(2, '0');
        const minute = dmyMatch[5];

        const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`).getTime();
        return !isNaN(parsed) && parsed > nowMs ? parsed : null;
    }

    // 4. Cek format "YYYY-MM-DD HH:MM" (WIB)
    const ymdMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2})[:.](\d{2})$/);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        const hour = ymdMatch[4].padStart(2, '0');
        const minute = ymdMatch[5];

        const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`).getTime();
        return !isNaN(parsed) && parsed > nowMs ? parsed : null;
    }

    return null;
}

function formatWIB(timestampMs) {
    const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(timestampMs));

    return `${formatted} WIB (UTC+7)`;
}

function addReminder({ userId, channelId, message, remindAt }) {
    const reminders = loadReminders();
    const newReminder = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        userId,
        channelId,
        message,
        remindAt,
        createdAt: Date.now()
    };
    reminders.push(newReminder);
    saveReminders(reminders);
    return newReminder;
}

function getUserReminders(userId) {
    return loadReminders()
        .filter(r => r.userId === userId)
        .sort((a, b) => a.remindAt - b.remindAt);
}

function deleteReminder(id, userId) {
    const reminders = loadReminders();
    const index = reminders.findIndex(r => r.id === id && r.userId === userId);
    if (index === -1) return false;

    reminders.splice(index, 1);
    saveReminders(reminders);
    return true;
}

function startReminderLoop(client) {
    setInterval(async () => {
        const reminders = loadReminders();
        if (reminders.length === 0) return;

        const now = Date.now();
        const due = reminders.filter(r => r.remindAt <= now);
        if (due.length === 0) return;

        // Simpan sisa reminder terlebih dahulu agar tidak terkirim ganda
        const remaining = reminders.filter(r => r.remindAt > now);
        saveReminders(remaining);

        for (const item of due) {
            try {
                const channel = await client.channels.fetch(item.channelId).catch(() => null);
                const payload = `⏰ **Pengingat untuk <@${item.userId}>!**\n> ${item.message}`;

                if (channel && channel.isTextBased()) {
                    await channel.send(payload);
                } else {
                    // Fallback ke DM jika channel sudah dihapus
                    const user = await client.users.fetch(item.userId).catch(() => null);
                    if (user) await user.send(payload);
                }
            } catch (err) {
                console.error(`[REMINDER] Gagal mengirim pengingat ${item.id}:`, err);
            }
        }
    }, 5000);
}

module.exports = {
    parseTimeWIB,
    formatWIB,
    addReminder,
    getUserReminders,
    deleteReminder,
    startReminderLoop
};