import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "previous",
  description: i18n.__("previous.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(commandTrigger: CommandInteraction | Message) {
    const player = bot.players.get(commandTrigger.guild!.id)!;

    player.previous();
  
    commandTrigger.reply(i18n.__mf("previous.result")).then(purning);
  }
};