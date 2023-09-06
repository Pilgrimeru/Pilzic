import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";


export default {
  name: "volume",
  aliases: ["v"],
  description: i18n.__("volume.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(message: Message, args: Array<any>) {

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