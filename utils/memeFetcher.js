const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const DEFAULT_SUBREDDITS = [
    'memes',
    'dankmemes',
    'me_irl',
    'wholesomememes',
    'ProgrammerHumor'
];

const POPULAR_SUBREDDITS = [
    { name: 'r/memes (Meme Umum)', value: 'memes' },
    { name: 'r/dankmemes (Dank Memes)', value: 'dankmemes' },
    { name: 'r/me_irl (Relatable)', value: 'me_irl' },
    { name: 'r/wholesomememes (Wholesome)', value: 'wholesomememes' },
    { name: 'r/ProgrammerHumor (Coding & IT)', value: 'ProgrammerHumor' },
    { name: 'r/engineeringmemes (Teknik & Engineering)', value: 'engineeringmemes' },
    { name: 'r/physicsmemes (Fisika & Sains)', value: 'physicsmemes' },
    { name: 'r/Animemes (Anime Memes)', value: 'Animemes' },
    { name: 'r/indowibu (Meme Wibu Indo)', value: 'indowibu' },
    { name: 'r/indonesia (Komunitas Indonesia)', value: 'indonesia' }
];

function sanitizeSubreddit(rawInput) {
    if (!rawInput) return '';
    return String(rawInput)
        .trim()
        .replace(/^\/?r\//i, '')
        .replace(/[^a-zA-Z0-9_]/g, '');
}

function isDirectImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
}

/**
 * Mengambil meme dari Reddit JSON API (utama) atau meme-api.com (cadangan)
 */
async function fetchMemeFromSubreddit(subreddit) {
    // 1. Coba ambil langsung dari endpoint JSON publik Reddit
    try {
        const redditUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=75&raw_json=1`;
        const res = await fetch(redditUrl, {
            headers: {
                'User-Agent': 'DiscordBot:ten-a-bot-discord:v1.0.0 (by /u/discord_bot)'
            }
        });

        if (res.ok) {
            const json = await res.json();
            const children = json?.data?.children || [];

            const validPosts = children
                .map(c => c?.data)
                .filter(post => {
                    if (!post || post.over_18 || post.stickied || post.is_video) return false;
                    const imgUrl = post.url_overridden_by_dest || post.url || '';
                    return isDirectImageUrl(imgUrl) || post.post_hint === 'image';
                });

            if (validPosts.length > 0) {
                const picked = validPosts[Math.floor(Math.random() * validPosts.length)];
                return {
                    title: picked.title || `Meme dari r/${subreddit}`,
                    imageUrl: picked.url_overridden_by_dest || picked.url,
                    postLink: picked.permalink ? `https://www.reddit.com${picked.permalink}` : `https://www.reddit.com/r/${subreddit}`,
                    subreddit: picked.subreddit || subreddit,
                    author: picked.author || 'unknown',
                    ups: picked.ups ?? 0
                };
            }
        }
    } catch {
        // Lanjut ke fallback API jika Reddit membatasi request
    }

    // 2. Fallback ke meme-api.com
    const fallbackRes = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(subreddit)}`);
    if (!fallbackRes.ok) {
        return null;
    }

    const data = await fallbackRes.json();
    if (!data || data.nsfw || !data.url || !isDirectImageUrl(data.url)) {
        return null;
    }

    return {
        title: data.title || `Meme dari r/${subreddit}`,
        imageUrl: data.url,
        postLink: data.postLink || `https://www.reddit.com/r/${subreddit}`,
        subreddit: data.subreddit || subreddit,
        author: data.author || 'unknown',
        ups: data.ups ?? 0
    };
}

function buildMemeEmbed(meme) {
    return new EmbedBuilder()
        .setColor(0xFF4500)
        .setTitle(String(meme.title).slice(0, 256))
        .setURL(meme.postLink)
        .setImage(meme.imageUrl)
        .setFooter({
            text: `r/${meme.subreddit} • 👍 ${meme.ups.toLocaleString('id-ID')} • u/${meme.author}`
        });
}

function buildNextRow(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('meme_next_btn')
            .setLabel('Meme Berikutnya')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

/**
 * Mengirim embed meme beserta tombol interaktif untuk Slash maupun Prefix command
 */
async function sendMemeReply(target, rawSubreddit, userId, isSlash = false) {
    const cleaned = sanitizeSubreddit(rawSubreddit);

    if (rawSubreddit && (!cleaned || cleaned.length < 2 || cleaned.length > 21)) {
        const invalidMsg = '⚠️ Nama subreddit tidak valid. Gunakan huruf, angka, atau underscore (contoh: `memes`, `ProgrammerHumor`, `indowibu`).';
        return isSlash ? target.reply({ content: invalidMsg, ephemeral: true }) : target.reply(invalidMsg);
    }

    const pickTargetSubreddit = () =>
        cleaned || DEFAULT_SUBREDDITS[Math.floor(Math.random() * DEFAULT_SUBREDDITS.length)];

    if (isSlash) {
        await target.deferReply();
    } else {
        await target.channel.sendTyping();
    }

    const initialSub = pickTargetSubreddit();
    const meme = await fetchMemeFromSubreddit(initialSub);

    if (!meme) {
        const notFoundMsg = `❌ Tidak dapat menemukan gambar meme (SFW) dari **r/${initialSub}**. Pastikan nama subreddit benar, bersifat publik, dan memiliki postingan gambar.`;
        return isSlash ? target.editReply({ content: notFoundMsg }) : target.reply(notFoundMsg);
    }

    const embed = buildMemeEmbed(meme);
    const row = buildNextRow(false);

    const replyMsg = isSlash
        ? await target.editReply({ embeds: [embed], components: [row] })
        : await target.reply({ embeds: [embed], components: [row] });

    const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000
    });

    collector.on('collect', async (btnInteraction) => {
        if (btnInteraction.customId !== 'meme_next_btn') return;

        if (btnInteraction.user.id !== userId) {
            return btnInteraction.reply({
                content: '⚠️ Hanya pengguna yang memanggil perintah ini yang bisa mengganti meme. Ketik `/meme` atau `!meme` untuk memunculkan milikmu!',
                ephemeral: true
            });
        }

        await btnInteraction.deferUpdate();

        const nextSub = pickTargetSubreddit();
        const nextMeme = await fetchMemeFromSubreddit(nextSub);
        if (!nextMeme) return;

        await btnInteraction.editReply({
            embeds: [buildMemeEmbed(nextMeme)],
            components: [buildNextRow(false)]
        });
    });

    collector.on('end', () => {
        replyMsg.edit({ components: [buildNextRow(true)] }).catch(() => {});
    });
}

module.exports = {
    POPULAR_SUBREDDITS,
    sendMemeReply
};