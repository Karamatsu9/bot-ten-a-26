const { SlashCommandBuilder } = require('discord.js');
const {
    POPULAR_SUBREDDITS,
    getConfiguredXAccounts,
    sendMemeReply
} = require('../utils/memeFetcher');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Ambil meme acak dari Reddit atau akun X pilihan')
        .addStringOption(opt =>
            opt.setName('sumber')
                .setDescription('Pilih sumber meme (Default: Acak antara Reddit & X)')
                .addChoices(
                    { name: '🎲 Acak (Reddit & X)', value: 'random' },
                    { name: '𝕏 Akun X Pilihan', value: 'x' },
                    { name: '🟠 Reddit', value: 'reddit' }
                )
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('subreddit')
                .setDescription('Nama subreddit Reddit (opsional, contoh: memes, ProgrammerHumor)')
                .setAutocomplete(true)
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('akun_x')
                .setDescription('Pilih akun X dari daftar atau ketik username X (opsional)')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'subreddit') {
            const focused = focusedOption.value.toLowerCase().replace(/^r\//, '');
            const filtered = POPULAR_SUBREDDITS
                .filter(item =>
                    item.value.toLowerCase().includes(focused) ||
                    item.name.toLowerCase().includes(focused)
                )
                .slice(0, 25);

            return interaction.respond(filtered);
        }

        if (focusedOption.name === 'akun_x') {
            const focused = focusedOption.value.toLowerCase().replace(/^@/, '');
            const accounts = getConfiguredXAccounts();
            const filtered = accounts
                .filter(acc =>
                    acc.username.toLowerCase().includes(focused) ||
                    (acc.note && acc.note.toLowerCase().includes(focused))
                )
                .slice(0, 25)
                .map(acc => ({
                    name: acc.note ? `@${acc.username} — ${acc.note}`.slice(0, 100) : `@${acc.username}`,
                    value: acc.username
                }));

            return interaction.respond(filtered);
        }
    },

    async execute(interaction) {
        const source = interaction.options.getString('sumber') || 'random';
        const subreddit = interaction.options.getString('subreddit') || '';
        const xAccount = interaction.options.getString('akun_x') || '';

        await sendMemeReply(
            interaction,
            { source, subreddit, xAccount },
            interaction.user.id,
            true
        );
    }
};