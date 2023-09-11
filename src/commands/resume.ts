import { ButtonInteraction, ChatInputCommandInteraction, CommandInteraction, Message, RepliableInteraction } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";


export default {
  name: "resume",
  aliases: ["r"],
  description: i18n.__("resume.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(commandTrigger: ButtonInteraction | CommandInteraction | Message) {
    
    const player = bot.players.get(commandTrigger.guild!.id)!;

    player.resume()

    if (commandTrigger instanceof ButtonInteraction) {
      commandTrigger.deferUpdate();
      return player.textChannel.send(i18n.__mf("resume.result")).then(purning); 
    }

    return commandTrigger.reply(i18n.__mf("resume.result")).then(purning); 
  }
};