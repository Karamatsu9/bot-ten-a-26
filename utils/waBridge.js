const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pino = require('pino');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WA_CONFIG_FILE = path.join(DATA_DIR, 'waConfig.json');
const WA_AUTH_BASE_DIR = path.join(__dirname, '..', 'wa_auth');
const MAX_DISCORD_FILE_SIZE = 10 * 1024 * 1024; // Batas upload Discord (10 MB)

// Menyimpan instance koneksi WhatsApp aktif per server: Map<guildId, SessionState>
const sessions = new Map();

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WA_AUTH_BASE_DIR)) {
        fs.mkdirSync(WA_AUTH_BASE_DIR, { recursive: true });
    }
    if (!fs.existsSync(WA_CONFIG_FILE)) {
        fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
    }
}

function readAllConfigs() {
    ensureDirs();
    try {
        const parsed = JSON.parse(fs.readFileSync(WA_CONFIG_FILE, 'utf8'));
        return parsed && typeof parsed.guilds === 'object' ? parsed : { guilds: {} };
    } catch {
        return { guilds: {} };
    }
}

function writeAllConfigs(data) {
    ensureDirs();
    fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getWaConfig(guildId) {
    const data = readAllConfigs();
    if (guildId && data.guilds[guildId]) {
        return {
            enabled: Boolean(data.guilds[guildId].enabled),
            channelId: data.guilds[guildId].channelId || '',
            announcementJid: data.guilds[guildId].announcementJid || ''
        };
    }
    return {
        enabled: false,
        channelId: '',
        announcementJid: ''
    };
}

function updateWaConfig(guildId, patch) {
    const data = readAllConfigs();
    const current = getWaConfig(guildId);
    const updated = {
        enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
        channelId: patch.channelId !== undefined ? patch.channelId : current.channelId,
        announcementJid: patch.announcementJid !== undefined ? patch.announcementJid : current.announcementJid
    };

    data.guilds[guildId] = updated;
    writeAllConfigs(data);
    return updated;
}

function getWaBridgeStatus(guildId) {
    const session = sessions.get(guildId);
    const authDir = path.join(WA_AUTH_BASE_DIR, guildId);
    const hasSavedSession = fs.existsSync(path.join(authDir, 'creds.json'));

    return {
        isConnected: Boolean(session?.isConnected),
        hasSavedSession,
        detectedAnnounceGroups: session?.detectedAnnounceGroups || []
    };
}

function unwrapMessageContent(rawMessage) {
    let msg = rawMessage;
    while (msg) {
        if (msg.ephemeralMessage?.message) msg = msg.ephemeralMessage.message;
        else if (msg.viewOnceMessage?.message) msg = msg.viewOnceMessage.message;
        else if (msg.viewOnceMessageV2?.message) msg = msg.viewOnceMessageV2.message;
        else if (msg.documentWithCaptionMessage?.message) msg = msg.documentWithCaptionMessage.message;
        else break;
    }
    return msg;
}

async function syncAnnouncementGroups(guildId, sock) {
    try {
        const groups = await sock.groupFetchAllParticipating();
        const announceGroups = Object.values(groups)
            .filter(g => g.isCommunityAnnounce === true)
            .map(g => ({
                id: g.id,
                subject: g.subject || 'Announcements Komunitas'
            }));

        const session = sessions.get(guildId);
        if (session) {
            session.detectedAnnounceGroups = announceGroups;
        }

        // Jika server belum memilih JID dan hanya ada 1 grup Announcements di akun WA tersebut, pilih otomatis
        const cfg = getWaConfig(guildId);
        if (!cfg.announcementJid && announceGroups.length === 1) {
            updateWaConfig(guildId, { announcementJid: announceGroups[0].id });
        }

        return announceGroups;
    } catch (err) {
        console.warn(`[WA BRIDGE][${guildId}] Gagal mengambil daftar grup:`, err.message || err);
        return [];
    }
}

/**
 * Memulai atau menghubungkan sesi WhatsApp khusus untuk satu server Discord (guildId)
 */
async function connectGuildWhatsApp(discordClient, guildId, options = {}) {
    const { onQr, onPairingCode, onConnected, phoneNumber } = options;

    // Jika sedang login ulang dengan QR/Pairing baru, tutup socket lama terlebih dahulu
    const existing = sessions.get(guildId);
    if (existing?.sock && (onQr || onPairingCode)) {
        try {
            existing.manualClose = true;
            existing.sock.end(undefined);
        } catch {
            // Abaikan error saat menutup socket lama
        }
        sessions.delete(guildId);
    } else if (existing?.starting) {
        return;
    }

    const authDir = path.join(WA_AUTH_BASE_DIR, guildId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const {
        useMultiFileAuthState,
        downloadMediaMessage,
        DisconnectReason,
        fetchLatestBaileysVersion
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sessionState = {
        sock: null,
        isConnected: false,
        detectedAnnounceGroups: existing?.detectedAnnounceGroups || [],
        starting: true,
        manualClose: false
    };
    sessions.set(guildId, sessionState);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Discord WA Bridge', 'Chrome', '1.0.0']
    });

    sessionState.sock = sock;

    // Jika login menggunakan nomor HP (Pairing Code)
    if (phoneNumber && !state.creds.registered) {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(cleanPhone);
                if (onPairingCode) await onPairingCode(code);
            } catch (err) {
                console.error(`[WA BRIDGE][${guildId}] Gagal meminta pairing code:`, err.message || err);
            }
        }, 2500);
    }

    sock.ev.on('creds.update', saveCreds);

    let qrHandled = false;
    let connectedCallbackFired = false;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && onQr && !qrHandled && !phoneNumber) {
            qrHandled = true;
            try {
                await onQr(qr);
            } catch (err) {
                console.error(`[WA BRIDGE][${guildId}] Gagal mengirim QR:`, err);
            }
        }

        if (connection === 'close') {
            sessionState.isConnected = false;
            sessionState.starting = false;

            if (sessionState.manualClose) return;

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            if (isLoggedOut) {
                console.log(`[WA BRIDGE][${guildId}] Sesi WhatsApp logout. Menghapus kredensial lokal.`);
                sessions.delete(guildId);
                fs.rmSync(authDir, { recursive: true, force: true });
            } else {
                console.warn(`[WA BRIDGE][${guildId}] Koneksi terputus (kode: ${statusCode}). Reconnect dalam 5 detik...`);
                setTimeout(() => {
                    if (fs.existsSync(path.join(authDir, 'creds.json'))) {
                        connectGuildWhatsApp(discordClient, guildId);
                    }
                }, 5000);
            }
        } else if (connection === 'open') {
            sessionState.isConnected = true;
            sessionState.starting = false;
            console.log(`\x1b[32m[WA BRIDGE][${guildId}] Berhasil terhubung ke WhatsApp!\x1b[0m`);

            const groups = await syncAnnouncementGroups(guildId, sock);

            if (onConnected && !connectedCallbackFired) {
                connectedCallbackFired = true;
                try {
                    await onConnected(groups);
                } catch (err) {
                    console.error(`[WA BRIDGE][${guildId}] Error callback onConnected:`, err);
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const config = getWaConfig(guildId);
        if (!config.enabled || !config.channelId || !config.announcementJid) return;

        for (const rawMsg of messages) {
            try {
                if (!rawMsg.message || rawMsg.key.fromMe) continue;

                const remoteJid = rawMsg.key.remoteJid;
                if (!remoteJid || remoteJid !== config.announcementJid) continue;

                // Verifikasi bahwa grup asal benar-benar channel Announcements komunitas
                const groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
                if (!groupMeta || groupMeta.isCommunityAnnounce !== true) continue;

                const content = unwrapMessageContent(rawMsg.message);
                if (!content) continue;

                const senderName = rawMsg.pushName || 'Admin';
                const textBody =
                    content.conversation ||
                    content.extendedTextMessage?.text ||
                    content.imageMessage?.caption ||
                    content.documentMessage?.caption ||
                    content.videoMessage?.caption ||
                    '';

                const mediaMsg =
                    content.documentMessage ||
                    content.imageMessage ||
                    content.videoMessage ||
                    content.audioMessage;

                const files = [];
                let sizeWarning = '';

                if (mediaMsg) {
                    const fileSize = Number(mediaMsg.fileLength || 0);
                    if (fileSize > MAX_DISCORD_FILE_SIZE) {
                        const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
                        sizeWarning = `\n\n⚠️ *Lampiran \`${mediaMsg.fileName || 'file'}\` (${sizeMb} MB) tidak ikut terunggah karena melebihi batas Discord (10 MB). Silakan unduh langsung di WhatsApp.*`;
                    } else {
                        const buffer = await downloadMediaMessage(
                            rawMsg,
                            'buffer',
                            {},
                            { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                        );
                        const fallbackExt = content.imageMessage
                            ? 'gambar_info.jpg'
                            : content.videoMessage
                                ? 'video_info.mp4'
                                : content.audioMessage
                                    ? 'audio_info.ogg'
                                    : 'lampiran';
                        const fileName = mediaMsg.fileName || fallbackExt;
                        files.push(new AttachmentBuilder(buffer, { name: fileName }));
                    }
                }

                if (!textBody && files.length === 0 && !sizeWarning) continue;

                const channel = await discordClient.channels.fetch(config.channelId).catch(() => null);
                // Pastikan channel tujuan benar-benar milik server (guildId) ini
                if (!channel || !channel.isTextBased() || channel.guildId !== guildId) continue;

                const fullDescription = ((textBody || '*(Mengirim lampiran file)*') + sizeWarning).slice(0, 4000);
                const timestampSec = Number(rawMsg.messageTimestamp) || Math.floor(Date.now() / 1000);

                const embed = new EmbedBuilder()
                    .setColor(0x25D366)
                    .setAuthor({ name: `📢 Announcements • ${groupMeta.subject || 'Info Komunitas'}` })
                    .setDescription(fullDescription)
                    .setFooter({ text: `Dikirim oleh ${senderName} via WhatsApp` })
                    .setTimestamp(timestampSec * 1000);

                await channel.send({ embeds: [embed], files });
            } catch (err) {
                console.error(`[WA BRIDGE][${guildId}] Error saat meneruskan pesan:`, err);
            }
        }
    });
}

/**
 * Memutus tautan WhatsApp dan menghapus sesi login untuk server tertentu
 */
async function disconnectGuildWhatsApp(guildId) {
    const session = sessions.get(guildId);
    if (session?.sock) {
        session.manualClose = true;
        try {
            await session.sock.logout();
        } catch {
            try {
                session.sock.end(undefined);
            } catch {
                // Abaikan
            }
        }
    }
    sessions.delete(guildId);

    const authDir = path.join(WA_AUTH_BASE_DIR, guildId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }

    updateWaConfig(guildId, { enabled: false, announcementJid: '' });
}

/**
 * Otomatis menghubungkan kembali seluruh server yang sudah memiliki sesi WA tersimpan saat bot menyala
 */
async function startWhatsAppBridge(discordClient) {
    ensureDirs();
    const entries = fs.readdirSync(WA_AUTH_BASE_DIR, { withFileTypes: true });
    const guildDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (guildDirs.length === 0) {
        console.log('\x1b[36m[WA BRIDGE] Siap (multi-server). Gunakan /wa-update login di server untuk menautkan WhatsApp.\x1b[0m');
        return;
    }

    console.log(`\x1b[36m[WA BRIDGE] Memulihkan ${guildDirs.length} sesi WhatsApp per-server...\x1b[0m`);
    for (const guildId of guildDirs) {
        if (fs.existsSync(path.join(WA_AUTH_BASE_DIR, guildId, 'creds.json'))) {
            connectGuildWhatsApp(discordClient, guildId).catch(err => {
                console.error(`[WA BRIDGE][${guildId}] Gagal memulihkan sesi:`, err);
            });
        }
    }
}

module.exports = {
    startWhatsAppBridge,
    connectGuildWhatsApp,
    disconnectGuildWhatsApp,
    getWaConfig,
    updateWaConfig,
    getWaBridgeStatus
};