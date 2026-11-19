const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const storage = require('../utils/storage');

function buildHelpPages(prefix) {
    return [
        {
            title: '💬 Tanya Jawab & Analisis File',
            shortLabel: 'Tanya Jawab & Analisis File',
            emoji: '💬',
            summary: 'Asisten akademik, baca PDF/gambar/media, & link YouTube/Drive',
            fields: [
                {
                    name: 'Perintah Utama',
                    value:
                        `• \`/ask question:<pertanyaan> file:<lampiran>\`\n` +
                        `  Tanya materi kuliah, baca & rangkum file *(PDF, gambar, TXT, CSV, JSON, audio/video maks. 15 MB)*, atau analisis link YouTube & Google Drive.\n` +
                        `• \`${prefix}ask <pertanyaan>\` atau \`${prefix} <pertanyaan>\`\n` +
                        `  Versi prefix *(bisa langsung lampirkan file, tempel link, atau reply pesan yang berisi file)*.`
                },
                {
                    name: '💡 Tips Penggunaan',
                    value:
                        '• Untuk link **Google Drive / Docs / Sheets / Slides**, pastikan akses berbagi diset ke *"Anyone with the link"*.\n' +
                        '• Untuk file lokal Word/Excel/PowerPoint, export ke **PDF** terlebih dahulu agar dapat dibaca.'
                }
            ]
        },
        {
            title: '⏰ Reminder Otomatis (DM • WIB / UTC+7)',
            shortLabel: 'Reminder Otomatis (WIB)',
            emoji: '⏰',
            summary: 'Pengingat pribadi via DM dengan zona waktu Jakarta (UTC+7)',
            fields: [
                {
                    name: 'Slash Commands',
                    value:
                        '• `/remind set waktu:<waktu> pesan:<pesan>` — Buat pengingat baru *(notifikasi dikirim lewat DM)*\n' +
                        '• `/remind list` — Lihat daftar pengingat aktif milikmu\n' +
                        '• `/remind hapus id:<id>` — Batalkan pengingat berdasarkan ID'
                },
                {
                    name: 'Prefix Commands',
                    value:
                        `• \`${prefix}remind <waktu> | <pesan>\` — Contoh: \`${prefix}remind 30m | Kumpul tugas\` atau \`${prefix}remind 19:30 | Rapat\`\n` +
                        `• \`${prefix}remind list\` — Lihat daftar pengingat aktif\n` +
                        `• \`${prefix}remind hapus <id>\` — Batalkan pengingat`
                },
                {
                    name: '🕒 Format Waktu yang Didukung',
                    value:
                        '• **Durasi:** `30s`, `15m`, `2j`, `1j 30m`, `1d`\n' +
                        '• **Jam spesifik:** `19:30` *(otomatis dijadwalkan besok jika sudah lewat hari ini)*\n' +
                        '• **Tanggal & jam:** `20/11/2026 08:00` atau `2026-11-20 08:00`'
                }
            ]
        },
        {
            title: '📌 Kata Kunci Cepat, Meme & Utilitas',
            shortLabel: 'Kata Kunci, Meme & Utilitas',
            emoji: '📌',
            summary: 'Info jadwal, daftar PJ, meme Reddit, ping, & perintah dasar',
            fields: [
                {
                    name: 'Kata Kunci Tanpa Prefix (Ketik Langsung di Chat)',
                    value:
                        '• `jadwal` — Memunculkan jadwal kuliah kelas\n' +
                        '• `pj` — Melihat daftar PJ mata kuliah'
                },
                {
                    name: 'Hiburan & Perintah Utilitas',
                    value:
                        `• \`/meme [subreddit]\` atau \`${prefix}meme [subreddit]\` — Ambil meme acak dari subreddit Reddit *(contoh: \`memes\`, \`ProgrammerHumor\`, \`engineeringmemes\`)*\n` +
                        `• \`/ping\` atau \`${prefix}ping\` — Cek latensi dan kecepatan respon bot\n` +
                        `• \`${prefix}halo\` — Sapa bot *(juga merespons sapaan \`halo\` atau \`halo bot\`)*\n` +
                        `• \`/help\` atau \`${prefix}help\` — Menampilkan menu bantuan interaktif ini`
                }
            ]
        },
        {
            title: '🔒 Private Room System',
            shortLabel: 'Private Room System',
            emoji: '🔒',
            summary: 'Buat ruang diskusi teks privat sementara beserta role khusus',
            fields: [
                {
                    name: 'Daftar Perintah',
                    value:
                        '• `/create-private-channel` — Buat private text channel baru & undang member yang dipilih\n' +
                        '• `/delete-private-channel` — Hapus private room beserta role-nya setelah selesai *(dijalankan di dalam channel room)*\n' +
                        '• `/set-private-category` — Atur kategori Discord tempat private channel dibuat *(Moderator/Admin)*'
                }
            ]
        },
        {
            title: '⚙️ Pengaturan Moderator & Admin',
            shortLabel: 'Pengaturan Moderator & Admin',
            emoji: '⚙️',
            summary: 'Konfigurasi WA update, autorole, prefix, auto-respond, & welcome',
            fields: [
                {
                    name: 'Moderator & Administrator',
                    value:
                        '• `/wa-update login/set/status/test/enable/disable/logout` — Atur penerus pengumuman WhatsApp server ini\n' +
                        `• \`/autorole\` atau \`${prefix}autorole set/add/remove/status/enable/disable/clear\` — Atur pemberian role otomatis untuk member baru`
                },
                {
                    name: 'Khusus Administrator',
                    value:
                        `• \`/setprefix\` atau \`${prefix}setprefix <prefix_baru>\` — Ubah prefix perintah teks bot\n` +
                        '• `/autorespond add/edit/list/remove/clear` — Kelola balasan otomatis berbentuk Embed & gambar\n' +
                        '• `/welcome set/test/status/disable` — Kelola pesan sambutan dinamis untuk member baru'
                }
            ]
        }
    ];
}

async function sendPaginatedHelp(target, guildId, user, client, isInteraction = true) {
    const prefix = storage.getGuildPrefix(guildId);
    const pages = buildHelpPages(prefix);
    let currentPage = 0;

    const buildEmbed = (pageIndex) => {
        const activePage = pages[pageIndex];

        // Daftar kategori yang selalu tampil di awal setiap halaman
        const categoryOverview = pages
            .map((p, idx) =>
                idx === pageIndex
                    ? `▶️ **${idx + 1}. ${p.title}** *(Halaman aktif)*`
                    : `▫️ ${idx + 1}. ${p.title}`
            )
            .join('\n');

        return new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📖 Menu Bantuan Bot TEN A '26 • Halaman ${pageIndex + 1}/${pages.length}`)
            .setDescription(
                `Prefix saat ini: \`${prefix}\`\n\n` +
                `**📑 Daftar Kategori Halaman:**\n${categoryOverview}`
            )
            .addFields(activePage.fields)
            .setFooter({
                text: `Kategori: ${activePage.shortLabel} • Halaman ${pageIndex + 1} dari ${pages.length}`,
                iconURL: client.user.displayAvatarURL()
            });
    };

    const buildComponents = (pageIndex, disabled = false) => {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Pilih kategori halaman...')
            .setDisabled(disabled)
            .addOptions(
                pages.map((p, idx) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${idx + 1}. ${p.shortLabel}`)
                        .setDescription(p.summary)
                        .setValue(String(idx))
                        .setEmoji(p.emoji)
                        .setDefault(idx === pageIndex)
                )
            );

        const prevBtn = new ButtonBuilder()
            .setCustomId('help_prev')
            .setLabel('Sebelumnya')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || pageIndex === 0);

        const indicatorBtn = new ButtonBuilder()
            .setCustomId('help_indicator')
            .setLabel(`Halaman ${pageIndex + 1} / ${pages.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const nextBtn = new ButtonBuilder()
            .setCustomId('help_next')
            .setLabel('Selanjutnya')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || pageIndex === pages.length - 1);

        return [
            new ActionRowBuilder().addComponents(selectMenu),
            new ActionRowBuilder().addComponents(prevBtn, indicatorBtn, nextBtn)
        ];
    };

    const payload = {
        embeds: [buildEmbed(currentPage)],
        components: buildComponents(currentPage)
    };

    let replyMsg;
    if (isInteraction) {
        await target.reply(payload);
        replyMsg = await target.fetchReply();
    } else {
        replyMsg = await target.reply(payload);
    }

    const collector = replyMsg.createMessageComponentCollector({
        idle: 180_000 // Otomatis nonaktif setelah 3 menit tidak ada interaksi
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== user.id) {
            return i.reply({
                content: '⚠️ Hanya pengguna yang memanggil perintah `/help` yang dapat mengganti halaman ini. Ketik `/help` untuk membuka menumu sendiri.',
                ephemeral: true
            });
        }

        if (i.isStringSelectMenu()) {
            currentPage = parseInt(i.values[0], 10) || 0;
        } else if (i.isButton()) {
            if (i.customId === 'help_prev' && currentPage > 0) {
                currentPage--;
            } else if (i.customId === 'help_next' && currentPage < pages.length - 1) {
                currentPage++;
            }
        }

        await i.update({
            embeds: [buildEmbed(currentPage)],
            components: buildComponents(currentPage)
        });
    });

    collector.on('end', async () => {
        try {
            await replyMsg.edit({
                components: buildComponents(currentPage, true)
            });
        } catch {
            // Abaikan jika pesan sudah dihapus
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Menampilkan menu bantuan dan daftar perintah bot TEN A \'26'),
    async execute(interaction) {
        await sendPaginatedHelp(
            interaction,
            interaction.guildId,
            interaction.user,
            interaction.client,
            true
        );
    },
    sendPaginatedHelp
};