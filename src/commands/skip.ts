import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";


export default {
  name: "skip",
  aliases: ["s"],
  cooldown: 2,
  description: i18n.__("skip.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(message: Message) {
    
    const player = bot.players.get(message.guild!.id)!;
    
    player.skip();
    
    player.textChannel.send(i18n.__mf("skip.result")).then(purning);
  }
};