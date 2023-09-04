import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "shuffle",
  description: i18n.__("shuffle.description"),
  execute(message: Message) {

    if (!queueExists(message) || !canModifyQueue(message)) return;
    
    const player = bot.players.get(message.guild!.id)!;
    const queue = player.queue;

    queue.shuffle();

    player.textChannel.send(i18n.__mf("shuffle.result")).then(purning);
  }
};