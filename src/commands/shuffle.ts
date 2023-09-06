import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "shuffle",
  cooldown: 2,
  description: i18n.__("shuffle.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(message: Message) {
    
    const player = bot.players.get(message.guild!.id)!;
    const queue = player.queue;

    queue.shuffle();

    player.textChannel.send(i18n.__mf("shuffle.result")).then(purning);
  }
};