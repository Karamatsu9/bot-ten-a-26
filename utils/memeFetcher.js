const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const X_ACCOUNTS_FILE = path.join(__dirname, '..', 'config', 'xMemeAccounts.json');

const DEFAULT_X_ACCOUNTS = [
    { username: 'HumansNoContext', note: 'Meme & kejadian acak tanpa konteks' },
    { username: 'NoContextHumans', note: 'Klip & gambar lucu tanpa konteks' },
    { username: 'EverythingOOC', note: 'Everything Out Of Context' },
    { username: 'FAFO_TV', note: 'Klip video viral & momen FAFO' },
    { username: 'Fun_Viral_Vids', note: 'Klip video lucu & viral' }
];

const DEFAULT_SUBREDDITS = [
    'memes',
    'dankmemes',
    'me_irl',
    'wholesomememes',
    'ProgrammerHumor',
    'engineeringmemes',
    'physicsmemes',
    'indowibu',
    'indonesia',
    'shitposting',
    'funny',
    'Animemes'
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

const REDDIT_SORTS = [
    { sort: 'new', query: 'limit=80' },
    { sort: 'rising', query: 'limit=50' },
    { sort: 'top', query: 't=day&limit=80' },
    { sort: 'top', query: 't=week&limit=80' },
    { sort: 'hot', query: 'limit=80' }
];

// Riwayat ID postingan agar meme tidak berulang (dibatasi 250 item agar hemat RAM)
const MAX_SEEN_POSTS = 250;
const seenPostIds = new Set();

// Cache timeline akun X selama 5 menit agar hemat request & RAM
const X_CACHE_TTL_MS = 5 * 60 * 1000;
const xTimelineCache = new Map();

function markPostAsSeen(postKey) {
    if (!postKey) return;
    if (seenPostIds.has(postKey)) {
        seenPostIds.delete(postKey);
    }
    seenPostIds.add(postKey);
    while (seenPostIds.size > MAX_SEEN_POSTS) {
        const oldestKey = seenPostIds.values().next().value;
        seenPostIds.delete(oldestKey);
    }
}

function pickUnseenOrFallback(items, getKey) {
    if (!items || items.length === 0) return null;
    const unseen = items.filter(item => !seenPostIds.has(getKey(item)));
    const pool = unseen.length > 0 ? unseen : items;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    markPostAsSeen(getKey(chosen));
    return chosen;
}

function normalizeXUsername(raw) {
    if (!raw) return '';
    return String(raw)
        .trim()
        .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '')
        .replace(/^@+/, '')
        .split(/[/?#]/)[0]
        .replace(/[^a-zA-Z0-9_]/g, '');
}

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
 * Membaca daftar akun X dari config/xMemeAccounts.json (otomatis dibuat jika belum ada)
 */
function getConfiguredXAccounts() {
    try {
        const dir = path.dirname(X_ACCOUNTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(X_ACCOUNTS_FILE)) {
            fs.writeFileSync(X_ACCOUNTS_FILE, JSON.stringify(DEFAULT_X_ACCOUNTS, null, 2), 'utf8');
        }

        const raw = JSON.parse(fs.readFileSync(X_ACCOUNTS_FILE, 'utf8'));
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.accounts) ? raw.accounts : []);

        const parsed = list
            .map(entry => {
                if (typeof entry === 'string') {
                    const username = normalizeXUsername(entry);
                    return username ? { username, note: '' } : null;
                }
                if (entry && typeof entry === 'object') {
                    const username = normalizeXUsername(entry.username || entry.handle || entry.url);
                    return username ? { username, note: entry.note || entry.description || '' } : null;
                }
                return null;
            })
            .filter(Boolean);

        return parsed.length > 0 ? parsed : DEFAULT_X_ACCOUNTS;
    } catch (err) {
        console.warn('[MEME] Gagal membaca config/xMemeAccounts.json, memakai daftar bawaan:', err.message);
        return DEFAULT_X_ACCOUNTS;
    }
}

/**
 * Mengambil postingan bermedia dari timeline publik akun X
 */
async function fetchTimelineFromX(username) {
    const cleanUser = normalizeXUsername(username);
    if (!cleanUser) return [];

    const cacheKey = cleanUser.toLowerCase();
    const cached = xTimelineCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < X_CACHE_TTL_MS && cached.items.length > 0) {
        return cached.items;
    }

    try {
        const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(cleanUser)}`;
        const res = await fetch(syndicationUrl, {
            signal: AbortSignal.timeout(8000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!res.ok) return [];

        const html = await res.text();
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (!match) return [];

        const nextData = JSON.parse(match[1]);
        const entries = nextData?.props?.pageProps?.timeline?.entries || [];

        const extracted = [];
        for (const entry of entries) {
            const rawTweet = entry?.content?.tweet;
            if (!rawTweet) continue;

            const tweet = rawTweet.retweeted_status || rawTweet;
            if (tweet.possibly_sensitive) continue;

            const mediaList = tweet.extended_entities?.media || tweet.entities?.media || [];
            if (!Array.isArray(mediaList) || mediaList.length === 0) continue;

            const primaryMedia = mediaList[0];
            const mediaType = primaryMedia?.type;
            if (mediaType !== 'photo' && mediaType !== 'video' && mediaType !== 'animated_gif') continue;

            const tweetId = String(tweet.id_str || tweet.rest_id || '').trim();
            if (!tweetId) continue;

            const authorHandle = tweet.user?.screen_name || cleanUser;
            const authorName = tweet.user?.name || authorHandle;
            const authorAvatar = tweet.user?.profile_image_url_https || null;

            // Bersihkan URL t.co di akhir caption agar tampilan rapi
            const cleanCaption = String(tweet.full_text || tweet.text || '')
                .replace(/https:\/\/t\.co\/\w+/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            const isVideo = mediaType === 'video' || mediaType === 'animated_gif';
            const postLink = `https://x.com/${authorHandle}/status/${tweetId}`;
            const embedVideoUrl = `https://fxtwitter.com/${authorHandle}/status/${tweetId}`;

            extracted.push({
                source: 'x',
                id: tweetId,
                username: authorHandle,
                displayName: authorName,
                avatarUrl: authorAvatar,
                caption: cleanCaption,
                isVideo,
                imageUrl: primaryMedia.media_url_https || '',
                postLink,
                embedVideoUrl,
                likes: Number(tweet.favorite_count) || 0
            });
        }

        const limited = extracted.slice(0, 25);
        if (limited.length > 0) {
            if (xTimelineCache.size >= 15) {
                const oldestCacheKey = xTimelineCache.keys().next().value;
                xTimelineCache.delete(oldestCacheKey);
            }
            xTimelineCache.set(cacheKey, { fetchedAt: Date.now(), items: limited });
        }

        return limited;
    } catch (err) {
        console.warn(`[MEME][X] Gagal mengambil timeline @${cleanUser}:`, err.message);
        return [];
    }
}

/**
 * Mengambil 1 meme dari akun X tertentu atau acak dari daftar config/xMemeAccounts.json
 */
async function fetchMemeFromX(specificUsername = '') {
    const cleanSpecific = normalizeXUsername(specificUsername);
    const configured = getConfiguredXAccounts();

    // Susun urutan kandidat akun yang akan dicoba
    let candidates = [];
    if (cleanSpecific) {
        candidates = [cleanSpecific];
    } else {
        candidates = [...configured.map(a => a.username)].sort(() => Math.random() - 0.5);
    }

    for (const username of candidates) {
        const posts = await fetchTimelineFromX(username);
        if (posts.length === 0) continue;

        const picked = pickUnseenOrFallback(posts, p => `x:${p.id}`);
        if (picked) return picked;
    }

    return null;
}

/**
 * Mengambil meme segar dari Reddit JSON API (acak sort & anti-duplikat) dengan fallback meme-api.com
 */
async function fetchMemeFromSubreddit(subreddit) {
    const chosenSort = REDDIT_SORTS[Math.floor(Math.random() * REDDIT_SORTS.length)];

    // 1. Endpoint JSON publik Reddit dengan mode acak (new / rising / top / hot)
    try {
        const redditUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${chosenSort.sort}.json?${chosenSort.query}&raw_json=1`;
        const res = await fetch(redditUrl, {
            signal: AbortSignal.timeout(8000),
            headers: {
                'User-Agent': 'DiscordBot:ten-a-bot-discord:v1.1.0 (by /u/discord_bot)'
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
                const picked = pickUnseenOrFallback(validPosts, p => `reddit:${p.id || p.permalink}`);
                return {
                    source: 'reddit',
                    id: picked.id || picked.permalink,
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

    // 2. Fallback ke meme-api.com (mengambil batch 15 postingan agar bisa disaring duplikatnya)
    try {
        const fallbackRes = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(subreddit)}/15`, {
            signal: AbortSignal.timeout(8000)
        });
        if (!fallbackRes.ok) return null;

        const data = await fallbackRes.json();
        const memesList = Array.isArray(data?.memes) ? data.memes : (data?.url ? [data] : []);
        const validFallback = memesList.filter(m => m && !m.nsfw && m.url && isDirectImageUrl(m.url));

        if (validFallback.length === 0) return null;

        const picked = pickUnseenOrFallback(validFallback, m => `reddit:${m.postLink || m.url}`);
        return {
            source: 'reddit',
            id: picked.postLink || picked.url,
            title: picked.title || `Meme dari r/${subreddit}`,
            imageUrl: picked.url,
            postLink: picked.postLink || `https://www.reddit.com/r/${subreddit}`,
            subreddit: picked.subreddit || subreddit,
            author: picked.author || 'unknown',
            ups: picked.ups ?? 0
        };
    } catch {
        return null;
    }
}

/**
 * Membangun payload pesan Discord (mendukung Embed Gambar maupun Autoplay Video X)
 */
function buildMemeMessagePayload(meme, disabled = false) {
    const row = buildNextRow(disabled);

    // Format khusus post X berbentuk Video/GIF agar autoplay di dalam embed Discord
    if (meme.source === 'x' && meme.isVideo) {
        const captionLine = meme.caption
            ? `> ${meme.caption.slice(0, 350)}\n`
            : '';

        const textContent =
            `🎬 **@${meme.username}** • \`*video\` *(klik **Meme Berikutnya** jika koneksi lambat untuk mengganti)*\n` +
            `${captionLine}` +
            `🔗 **Sumber:** <${meme.postLink}> • [Putar Video](${meme.embedVideoUrl})`;

        return {
            content: textContent,
            embeds: [],
            components: [row]
        };
    }

    // Format post X berbentuk Gambar
    if (meme.source === 'x') {
        const embed = new EmbedBuilder()
            .setColor(0x1DA1F2)
            .setAuthor({
                name: `${meme.displayName} (@${meme.username})`,
                url: `https://x.com/${meme.username}`,
                iconURL: meme.avatarUrl || undefined
            })
            .setTitle('Lihat Postingan Asli di X ↗')
            .setURL(meme.postLink)
            .setImage(meme.imageUrl)
            .setFooter({
                text: `X (Twitter) • ❤️ ${meme.likes.toLocaleString('id-ID')} • @${meme.username}`
            });

        if (meme.caption) {
            embed.setDescription(meme.caption.slice(0, 1000));
        }

        return {
            content: '',
            embeds: [embed],
            components: [row]
        };
    }

    // Format post Reddit
    const embed = new EmbedBuilder()
        .setColor(0xFF4500)
        .setTitle(String(meme.title).slice(0, 256))
        .setURL(meme.postLink)
        .setImage(meme.imageUrl)
        .setFooter({
            text: `r/${meme.subreddit} • 👍 ${meme.ups.toLocaleString('id-ID')} • u/${meme.author}`
        });

    return {
        content: '',
        embeds: [embed],
        components: [row]
    };
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
 * Mengurai argumen dari prefix (!meme ...) atau slash command (/meme)
 */
function resolveMemeRequest(input) {
    if (input && typeof input === 'object') {
        const source = input.source || 'random';
        const subreddit = sanitizeSubreddit(input.subreddit || '');
        const xAccount = normalizeXUsername(input.xAccount || '');

        if (xAccount) return { mode: 'x', target: xAccount };
        if (subreddit) return { mode: 'reddit', target: subreddit };
        return { mode: source, target: '' };
    }

    const raw = String(input || '').trim();
    if (!raw) return { mode: 'random', target: '' };

    const lower = raw.toLowerCase();
    if (lower === 'x' || lower === 'twitter') {
        return { mode: 'x', target: '' };
    }
    if (lower === 'reddit') {
        return { mode: 'reddit', target: '' };
    }

    // Deteksi format @username, x/username, twitter/username, atau link x.com/username
    if (
        raw.startsWith('@') ||
        /^x\//i.test(raw) ||
        /^twitter\//i.test(raw) ||
        /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(raw)
    ) {
        const cleanedX = normalizeXUsername(raw.replace(/^(x|twitter)\//i, ''));
        return { mode: 'x', target: cleanedX, invalid: !cleanedX };
    }

    // Selain itu anggap nama subreddit Reddit
    const cleanedSub = sanitizeSubreddit(raw);
    const isInvalid = !cleanedSub || cleanedSub.length < 2 || cleanedSub.length > 21;
    return { mode: 'reddit', target: cleanedSub, invalid: isInvalid };
}

/**
 * Mengambil 1 meme sesuai mode (random / x / reddit) dengan fallback otomatis
 */
async function fetchNextMeme(request) {
    const pickRandomSubreddit = () =>
        request.target || DEFAULT_SUBREDDITS[Math.floor(Math.random() * DEFAULT_SUBREDDITS.length)];

    if (request.mode === 'x') {
        return fetchMemeFromX(request.target);
    }

    if (request.mode === 'reddit') {
        return fetchMemeFromSubreddit(pickRandomSubreddit());
    }

    // Mode Acak: 50% X, 50% Reddit (dengan fallback ke sumber lain jika salah satu gagal)
    const tryXFirst = Math.random() < 0.5;
    if (tryXFirst) {
        const xMeme = await fetchMemeFromX('');
        if (xMeme) return xMeme;
        return fetchMemeFromSubreddit(pickRandomSubreddit());
    } else {
        const redditMeme = await fetchMemeFromSubreddit(pickRandomSubreddit());
        if (redditMeme) return redditMeme;
        return fetchMemeFromX('');
    }
}

/**
 * Mengirim meme beserta tombol interaktif untuk Slash maupun Prefix command
 */
async function sendMemeReply(target, rawArg, userId, isSlash = false) {
    const request = resolveMemeRequest(rawArg);

    if (request.invalid) {
        const invalidMsg =
            '⚠️ Target sumber meme tidak valid.\n' +
            '• **Reddit:** `!meme memes` atau `!meme ProgrammerHumor`\n' +
            '• **Akun X:** `!meme x` atau `!meme @HumansNoContext`';
        return isSlash ? target.reply({ content: invalidMsg, ephemeral: true }) : target.reply(invalidMsg);
    }

    if (isSlash) {
        await target.deferReply();
    } else {
        await target.channel.sendTyping();
    }

    const meme = await fetchNextMeme(request);

    if (!meme) {
        const notFoundMsg = request.mode === 'x'
            ? `❌ Tidak dapat mengambil meme dari akun X ${request.target ? `**@${request.target}**` : 'yang terdaftar'} saat ini. Pastikan akun bersifat publik dan memiliki postingan foto/video.`
            : `❌ Tidak dapat menemukan gambar meme (SFW) dari **r/${request.target || 'memes'}**. Pastikan nama subreddit benar dan bersifat publik.`;
        return isSlash ? target.editReply({ content: notFoundMsg }) : target.reply(notFoundMsg);
    }

    const payload = buildMemeMessagePayload(meme, false);

    const replyMsg = isSlash
        ? await target.editReply(payload)
        : await target.reply(payload);

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

        const nextMeme = await fetchNextMeme(request);
        if (!nextMeme) return;

        await btnInteraction.editReply(buildMemeMessagePayload(nextMeme, false));
    });

    collector.on('end', () => {
        replyMsg.edit({ components: [buildNextRow(true)] }).catch(() => {});
    });
}

module.exports = {
    POPULAR_SUBREDDITS,
    getConfiguredXAccounts,
    sendMemeReply
};