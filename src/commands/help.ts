import { EmbedBuilder, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";

export default {
  name: "help",
  aliases: ["h"],
  description: i18n.__("help.description"),
  execute(message: Message) {
    
    let commands = bot.commands;

    let helpEmbed = new EmbedBuilder()
      .setTitle(i18n.__mf("help.embedTitle", { botname: message.client.user!.username }))
      .setDescription(i18n.__("help.embedDescription"))
      .setColor("#69adc7");

    commands.forEach((cmd) => {
      helpEmbed.addFields(
        {
          name: `**${bot.prefix}${cmd.name} ${cmd.aliases ? `(${cmd.aliases})` : ""}**`,
          value: `${cmd.description}`,
          inline: true
        }
      );
    });

    helpEmbed.setTimestamp();

    return message.reply({ embeds: [helpEmbed] }).then(msg => purning(msg, true));
  }
};