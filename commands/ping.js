const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Cek respon dan latensi bot'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`🏓 **Pong!**\nLatensi Pesan: \`${latency}ms\` | WebSocket API: \`${interaction.client.ws.ping}ms\``);
    }
};
