import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";


export default {
  name: "volume",
  aliases: ["v"],
  description: i18n.__("volume.description"),
  options: [
    {
      name: "level",
      description: "volume level of the player [0;100].",
      type: ApplicationCommandOptionType.String,
      required: true,
    }
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

    if (!args[0])
      return commandTrigger.reply(i18n.__mf("volume.currentVolume", { volume: player.volume })).then(purning);

    const level = Number(args[0]);

    if (isNaN(level))
      return commandTrigger.reply(i18n.__("volume.errorNotNumber")).then(purning);

    if (level > 100 || level < 0)
      return commandTrigger.reply(i18n.__("volume.intervalError")).then(purning);

    player.volume = level;
    
    return commandTrigger.reply(i18n.__mf("volume.result", { arg: args[0] })).then(purning);
  }
};