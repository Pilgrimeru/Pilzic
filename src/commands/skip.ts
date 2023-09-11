import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";


export default {
  name: "skip",
  aliases: ["s"],
  description: i18n.__("skip.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(commandTrigger: CommandInteraction | Message) {
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    
    player.skip();
    
    commandTrigger.reply(i18n.__mf("skip.result")).then(purning);
  }
};