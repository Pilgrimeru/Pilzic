import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { config } from "../config";

export default {
  name: "help",
  aliases: ["h"],
  description: i18n.__("help.description"),
  async execute(message: Message) {
    
    let commands = Array.from(bot.commands.values());
    const commandsPerPage = 15;

    let page = 1;
    const totalPages = Math.ceil(commands.length / commandsPerPage);

    function createHelpPage(page : number) : EmbedBuilder {
      const startIndex = (page - 1) * commandsPerPage;
      const endIndex = startIndex + commandsPerPage;

      const helpEmbed = new EmbedBuilder()
        .setTitle(i18n.__mf('help.embedTitle', { botname: message.client.user!.username }))
        .setDescription(`${i18n.__('help.embedDescription')} (${page}/${totalPages})`)
        .setColor('#69adc7');

      commands.slice(startIndex, endIndex).forEach((cmd) => {
        helpEmbed.addFields({
          name: `**${bot.prefix}${cmd.name} ${cmd.aliases ? `(${cmd.aliases})` : ''}**`,
          value: `${cmd.description}`,
          inline: true,
        });
      });
      helpEmbed.setTimestamp();

      return helpEmbed;
    }

    function createHelpButtons(page : number) : ActionRowBuilder<ButtonBuilder> {
      const row = new ActionRowBuilder<ButtonBuilder>();
      if (totalPages > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setEmoji('⬅')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId('next')
            .setEmoji('➡')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages)
        );
      }

      return row;
    }

    const helpMsg = await message.reply({ embeds: [createHelpPage(page)], components: [createHelpButtons(page)] });
    
    const collector = helpMsg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'previous' && page > 1) {
        page--;
      } else if (interaction.customId === 'next' && page < totalPages) {
        page++;
      }

      await helpMsg.edit({ embeds: [createHelpPage(page)], components: [createHelpButtons(page)] });
      interaction.deferUpdate();
    });

    collector.on('end', () => {
      if (config.PRUNING) {
        helpMsg.delete().catch(() => null);
      } else {
        helpMsg.edit({
          content: helpMsg.content,
          embeds: helpMsg.embeds,
          components: []
        });
      }
    });
  }
};