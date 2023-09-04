import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";


export default {
  name: "stop",
  description: i18n.__("stop.description"),
  execute(message: Message) {

    if (!queueExists(message) || !canModifyQueue(message)) return;

    const player = bot.players.get(message.guild!.id)!;

    player.stop();
    message.reply(i18n.__mf("stop.result")).then(purning);
  }
};