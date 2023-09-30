import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command } from "../types/Command";

export default class HelpCommand extends Command {

  constructor() {
    super(
      {
        name: "help",
        description: i18n.__("help.description"),
        aliases: ["h"],
      }
    );
  }

  async execute(commandTrigger: CommandInteraction | Message) {

    let commands = Array.from(bot.commands.values());
    const commandsPerPage = 15;

    let page = 1;
    const totalPages = Math.ceil(commands.length / commandsPerPage);

    function createHelpPage(page: number): EmbedBuilder {
      const startIndex = (page - 1) * commandsPerPage;
      const endIndex = startIndex + commandsPerPage;

      const helpEmbed = new EmbedBuilder()
        .setTitle(i18n.__mf('help.embedTitle', { botname: commandTrigger.client.user!.username }))
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

    const response = await commandTrigger.reply({ embeds: [createHelpPage(page)] });
    if (totalPages === 1) return;

    function createHelpButtons(page: number): ActionRowBuilder<ButtonBuilder> {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
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

    response.edit({ components: [createHelpButtons(page)] });

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'previous' && page > 1) {
        page--;
      } else if (interaction.customId === 'next' && page < totalPages) {
        page++;
      }

      await response.edit({ embeds: [createHelpPage(page)], components: [createHelpButtons(page)] });
      interaction.deferUpdate();
    });

    collector.on('end', () => {
      if (config.PRUNING) {
        response.delete().catch(() => null);
      } else {
        response.edit({ components: [] });
      }
    });
  }
}