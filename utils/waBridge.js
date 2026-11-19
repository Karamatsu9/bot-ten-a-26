const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const MAX_DISCORD_FILE_SIZE = 10 * 1024 * 1024; // Batas aman upload Discord (10 MB)
const allowedAnnounceJids = new Set();

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
    const configuredJid = (process.env.WA_ANNOUNCEMENT_JID || '').trim();
    if (configuredJid) {
        allowedAnnounceJids.clear();
        allowedAnnounceJids.add(configuredJid);
    }

    try {
        const groups = await sock.groupFetchAllParticipating();
        const announceGroups = Object.values(groups).filter(g => g.isCommunityAnnounce === true);

        console.log('\x1b[36m[WA BRIDGE] Daftar Channel Announcements Komunitas yang terdeteksi:\x1b[0m');
        if (announceGroups.length === 0) {
            console.log(' • Tidak ada grup Announcements komunitas yang ditemukan pada akun WA ini.');
        } else {
            for (const g of announceGroups) {
                console.log(` • \x1b[33m${g.subject}\x1b[0m -> WA_ANNOUNCEMENT_JID=\x1b[32m${g.id}\x1b[0m`);
                // Jika WA_ANNOUNCEMENT_JID belum diisi di .env, otomatis pilih Announcements milik TEN A
                if (!configuredJid && /ten\s*a/i.test(g.subject || '')) {
                    allowedAnnounceJids.add(g.id);
                }
            }
        }

        if (!configuredJid && allowedAnnounceJids.size > 0) {
            console.log(`\x1b[32m[WA BRIDGE] Auto-lock aktif ke: ${[...allowedAnnounceJids].join(', ')}\x1b[0m`);
            console.log('💡 Tip: Salin WA_ANNOUNCEMENT_JID di atas ke file .env agar terkunci permanen.\n');
        }
    } catch (err) {
        console.warn('[WA BRIDGE] Gagal mengambil daftar grup:', err.message || err);
    }
}

async function startWhatsAppBridge(discordClient) {
    const targetChannelId = (process.env.WA_DISCORD_CHANNEL_ID || '').trim();
    if (!targetChannelId) {
        console.warn('\x1b[33m[WA BRIDGE] WA_DISCORD_CHANNEL_ID belum diisi di .env. Bridge WhatsApp dilewati.\x1b[0m');
        return;
    }

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
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.warn(`[WA BRIDGE] Koneksi terputus (kode: ${statusCode}). ${shouldReconnect ? 'Menghubungkan ulang dalam 5 detik...' : 'Sesi logout, hapus folder wa_auth untuk scan ulang.'}`);
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppBridge(discordClient), 5000);
            }
        } else if (connection === 'open') {
            console.log('\x1b[32m[WA BRIDGE] Berhasil terhubung ke WhatsApp!\x1b[0m');
            await syncAnnouncementGroups(sock);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const rawMsg of messages) {
            try {
                if (!rawMsg.message || rawMsg.key.fromMe) continue;

                const remoteJid = rawMsg.key.remoteJid;
                if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;

                // Pastikan daftar JID announcements sudah terisi
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

                // Ambil isi teks atau caption dari dokumen/gambar/video
                const textBody =
                    content.conversation ||
                    content.extendedTextMessage?.text ||
                    content.imageMessage?.caption ||
                    content.documentMessage?.caption ||
                    content.videoMessage?.caption ||
                    '';

                // Cek keberadaan lampiran file/media
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

                const channel = await discordClient.channels.fetch(targetChannelId).catch(() => null);
                if (!channel || !channel.isTextBased()) {
                    console.error(`[WA BRIDGE] Channel Discord (${targetChannelId}) tidak ditemukan.`);
                    continue;
                }

                const fullDescription = ((textBody || '*(Mengirim lampiran file)*') + sizeWarning).slice(0, 4000);
                const timestampSec = Number(rawMsg.messageTimestamp) || Math.floor(Date.now() / 1000);

                const embed = new EmbedBuilder()
                    .setColor(0x25D366) // Hijau WhatsApp
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

module.exports = { startWhatsAppBridge };