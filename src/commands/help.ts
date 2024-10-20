import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { CommandTrigger } from "../core/CommandTrigger.js";
import { config } from "../config.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command } from "../types/Command.js";

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

  async execute(commandTrigger: CommandTrigger) {

    let commands = Array.from(bot.commands.values());
    const commandsPerPage = 15;

    let page = 1;
    const totalPages = Math.ceil(commands.length / commandsPerPage);

    function createHelpPage(page: number): EmbedBuilder {
      const startIndex = (page - 1) * commandsPerPage;
      const endIndex = startIndex + commandsPerPage;

      const helpEmbed = new EmbedBuilder()
        .setTitle(i18n.__mf('help.embedTitle', { botname: commandTrigger.guild.client.user!.username }))
        .setDescription(`${i18n.__('help.embedDescription')} (${page}/${totalPages})`)
        .setColor(config.COLORS.MAIN);

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

    commandTrigger.reply({ embeds: [createHelpPage(page)], ephemeral: true });
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

    const response = await commandTrigger.editReply({ components: [createHelpButtons(page)] });

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'previous' && page > 1) {
        page--;
      } else if (interaction.customId === 'next' && page < totalPages) {
        page++;
      }

      commandTrigger.editReply({ embeds: [createHelpPage(page)], components: [createHelpButtons(page)] });
      interaction.deferUpdate();
    });

    collector.on('end', () => {
      if (config.AUTO_DELETE) {
        commandTrigger.deleteReply();
      } else {
        commandTrigger.editReply({ components: [] });
      }
    });
  }
}