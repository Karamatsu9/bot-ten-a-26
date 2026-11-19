const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WA_CONFIG_FILE = path.join(DATA_DIR, 'waConfig.json');
const MAX_DISCORD_FILE_SIZE = 10 * 1024 * 1024; // Batas aman upload Discord (10 MB)

const allowedAnnounceJids = new Set();
let detectedAnnounceGroups = [];
let isWhatsAppConnected = false;

function ensureConfigStorage() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WA_CONFIG_FILE)) {
        const initialConfig = {
            enabled: Boolean((process.env.WA_DISCORD_CHANNEL_ID || '').trim()),
            channelId: (process.env.WA_DISCORD_CHANNEL_ID || '').trim(),
            announcementJid: (process.env.WA_ANNOUNCEMENT_JID || '').trim()
        };
        fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf8');
    }
}

function getWaConfig() {
    ensureConfigStorage();
    try {
        const raw = fs.readFileSync(WA_CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
            channelId: (parsed.channelId || process.env.WA_DISCORD_CHANNEL_ID || '').trim(),
            announcementJid: (parsed.announcementJid || process.env.WA_ANNOUNCEMENT_JID || '').trim()
        };
    } catch {
        return {
            enabled: true,
            channelId: (process.env.WA_DISCORD_CHANNEL_ID || '').trim(),
            announcementJid: (process.env.WA_ANNOUNCEMENT_JID || '').trim()
        };
    }
}

function updateWaConfig(patch) {
    const current = getWaConfig();
    const updated = { ...current, ...patch };
    ensureConfigStorage();
    fs.writeFileSync(WA_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');

    if (updated.announcementJid) {
        allowedAnnounceJids.clear();
        allowedAnnounceJids.add(updated.announcementJid);
    }

    return updated;
}

function getWaBridgeStatus() {
    return {
        isConnected: isWhatsAppConnected,
        activeJids: [...allowedAnnounceJids],
        detectedAnnounceGroups
    };
}

function unwrapMessageContent(rawMessage) {
    let msg = rawMessage;
    while (msg) {
        if (msg.ephemeralMessage?.message) {
            msg = msg.ephemeralMessage.message;
        } else if (msg.viewOnceMessage?.message) {
            msg = msg.viewOnceMessage.message;
        } else if (msg.viewOnceMessageV2?.message) {
            msg = msg.viewOnceMessageV2.message;
        } else if (msg.documentWithCaptionMessage?.message) {
            msg = msg.documentWithCaptionMessage.message;
        } else {
            break;
        }
    }
    return msg;
}

async function syncAnnouncementGroups(sock) {
    const config = getWaConfig();
    if (config.announcementJid) {
        allowedAnnounceJids.clear();
        allowedAnnounceJids.add(config.announcementJid);
    }

    try {
        const groups = await sock.groupFetchAllParticipating();
        const announceGroups = Object.values(groups).filter(g => g.isCommunityAnnounce === true);
        detectedAnnounceGroups = announceGroups.map(g => ({ id: g.id, subject: g.subject || 'Announcements' }));

        console.log('\x1b[36m[WA BRIDGE] Daftar Channel Announcements Komunitas yang terdeteksi:\x1b[0m');
        if (announceGroups.length === 0) {
            console.log(' • Tidak ada grup Announcements komunitas yang ditemukan pada akun WA ini.');
        } else {
            for (const g of announceGroups) {
                console.log(` • \x1b[33m${g.subject}\x1b[0m -> JID: \x1b[32m${g.id}\x1b[0m`);
                if (!config.announcementJid && /ten\s*a/i.test(g.subject || '')) {
                    allowedAnnounceJids.add(g.id);
                }
            }
        }

        if (!config.announcementJid && allowedAnnounceJids.size > 0) {
            console.log(`\x1b[32m[WA BRIDGE] Auto-lock aktif ke: ${[...allowedAnnounceJids].join(', ')}\x1b[0m\n`);
        }
    } catch (err) {
        console.warn('[WA BRIDGE] Gagal mengambil daftar grup:', err.message || err);
    }
}

async function startWhatsAppBridge(discordClient) {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const {
        useMultiFileAuthState,
        downloadMediaMessage,
        DisconnectReason,
        fetchLatestBaileysVersion
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState('./wa_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['TEN A 26 Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n\x1b[33m[WA BRIDGE] Scan QR Code ini menggunakan WhatsApp nomor kedua (Perangkat Tertaut):\x1b[0m');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isWhatsAppConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.warn(`[WA BRIDGE] Koneksi terputus (kode: ${statusCode}). ${shouldReconnect ? 'Menghubungkan ulang dalam 5 detik...' : 'Sesi logout, hapus folder wa_auth untuk scan ulang.'}`);
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppBridge(discordClient), 5000);
            }
        } else if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log('\x1b[32m[WA BRIDGE] Berhasil terhubung ke WhatsApp!\x1b[0m');
            await syncAnnouncementGroups(sock);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const config = getWaConfig();
        if (!config.enabled || !config.channelId) return;

        for (const rawMsg of messages) {
            try {
                if (!rawMsg.message || rawMsg.key.fromMe) continue;

                const remoteJid = rawMsg.key.remoteJid;
                if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;

                if (allowedAnnounceJids.size === 0) {
                    await syncAnnouncementGroups(sock);
                }

                // FILTER KETAT: Hanya proses pesan dari channel Announcements yang diizinkan
                if (!allowedAnnounceJids.has(remoteJid)) continue;

                // Verifikasi ganda lewat metadata grup bahwa grup ini benar-benar Announcements komunitas
                const groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
                if (groupMeta && groupMeta.isCommunityAnnounce !== true) continue;

                const content = unwrapMessageContent(rawMsg.message);
                if (!content) continue;

                const senderName = rawMsg.pushName || 'Admin Kelas';

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
                                    : 'lampiran_kelas';

                        const fileName = mediaMsg.fileName || fallbackExt;
                        files.push(new AttachmentBuilder(buffer, { name: fileName }));
                    }
                }

                if (!textBody && files.length === 0 && !sizeWarning) continue;

                const channel = await discordClient.channels.fetch(config.channelId).catch(() => null);
                if (!channel || !channel.isTextBased()) {
                    console.error(`[WA BRIDGE] Channel Discord (${config.channelId}) tidak ditemukan.`);
                    continue;
                }

                const fullDescription = ((textBody || '*(Mengirim lampiran file)*') + sizeWarning).slice(0, 4000);
                const timestampSec = Number(rawMsg.messageTimestamp) || Math.floor(Date.now() / 1000);

                const embed = new EmbedBuilder()
                    .setColor(0x25D366)
                    .setAuthor({ name: `📢 Announcements • ${groupMeta?.subject || 'Info Tugas & Materi TEN A'}` })
                    .setDescription(fullDescription)
                    .setFooter({ text: `Dikirim oleh ${senderName} via WhatsApp` })
                    .setTimestamp(timestampSec * 1000);

                await channel.send({
                    embeds: [embed],
                    files
                });

                console.log(`[WA BRIDGE] Pengumuman dari ${senderName} berhasil diteruskan ke Discord.`);
            } catch (err) {
                console.error('[WA BRIDGE] Error saat meneruskan pesan:', err);
            }
        }
    });
}

module.exports = {
    startWhatsAppBridge,
    getWaConfig,
    updateWaConfig,
    getWaBridgeStatus
};