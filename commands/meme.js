const { SlashCommandBuilder } = require('discord.js');
const { POPULAR_SUBREDDITS, sendMemeReply } = require('../utils/memeFetcher');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Ambil meme acak dari subreddit Reddit')
        .addStringOption(opt =>
            opt.setName('subreddit')
                .setDescription('Nama subreddit (opsional, contoh: memes, ProgrammerHumor, engineeringmemes)')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase().replace(/^r\//, '');
        const filtered = POPULAR_SUBREDDITS
            .filter(item =>
                item.value.toLowerCase().includes(focused) ||
                item.name.toLowerCase().includes(focused)
            )
            .slice(0, 25);

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const subreddit = interaction.options.getString('subreddit') || '';
        await sendMemeReply(interaction, subreddit, interaction.user.id, true);
    }
};