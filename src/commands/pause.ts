import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "pause",
  description: i18n.__("pause.description"),
  execute(message: Message) {
    
    if (!queueExists(message) || !canModifyQueue(message)) return;

    const player = bot.players.get(message.guild!.id)!;

    if (player.pause()) {
      message.reply(i18n.__mf("pause.result")).then(purning);
    }
  }
};