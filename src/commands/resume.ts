import { Message } from "discord.js";
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
  execute(message: Message) {
    
    const player = bot.players.get(message.guild!.id)!;

    if (player.resume()) {
      message.reply(i18n.__mf("resume.result"))
        .then(purning);
    }
  }
};