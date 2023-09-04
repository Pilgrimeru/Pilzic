import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";


export default {
  name: "volume",
  aliases: ["v"],
  description: i18n.__("volume.description"),
  execute(message: Message, args: Array<any>) {

    if (!queueExists(message) || !canModifyQueue(message)) return;

    const player = bot.players.get(message.guild!.id)!;
    
    if (!args[0])
      return message.reply(i18n.__mf("volume.currentVolume", { volume: player.volume })).then(purning);

    if (isNaN(args[0])) return message.reply(i18n.__("volume.errorNotNumber")).then(purning);

    if (Number(args[0]) > 100 || Number(args[0]) < 0)
      return message.reply(i18n.__("volume.intervalError")).then(purning);

    player.volume = args[0];
    
    return message.reply(i18n.__mf("volume.result", { arg: args[0] })).then(purning);
  }
};