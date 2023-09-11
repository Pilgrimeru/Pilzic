import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { yt_validate } from "play-dl";
import { formatTime } from "../utils/formatTime";
import { CommandConditions } from "../interfaces/Command";

const timeRegEx = /^(?:[0-9]|[0-5]\d):[0-5]\d(:[0-5]\d)?$/;

export default {
  name: "seek",
  description: i18n.__("seek.description"),
  options: [
    {
      name: "time",
      description: "number of seconds to skip or a time code like hh:mm:ss.",
      type: ApplicationCommandOptionType.String,
      required: true,
    }
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    if (!args.length || (isNaN(Number(args[0])) && !args[0].match(timeRegEx)))
      return commandTrigger
        .reply(i18n.__mf("seek.usageReply", { prefix: bot.prefix}))
        .then(purning);
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    
    const currentSong = player.queue.currentSong;

    if (yt_validate(currentSong?.url ?? "") ==! "video") {
      return commandTrigger
        .reply(i18n.__mf("seek.errorSource"))
        .then(purning);
    }

    let seekTime;

    if (args[0].match(timeRegEx)) {
      const [seconds, minutes, hours] = args[0].split(':').reverse();

      seekTime = Number(seconds);
      seekTime += Number(minutes) * 60;
      seekTime += Number(hours ?? 0)  * 60 * 60;
    } else {
      seekTime = Number(args[0]) + Math.floor(player.playbackDuration / 1000);
    }

    if (seekTime < 0 || seekTime * 1000 >= (currentSong?.duration ?? 0)) {
      return commandTrigger
        .reply(i18n.__mf("seek.errorNotValid", { prefix: bot.prefix, duration: Math.floor(currentSong?.duration! / 1000) }))
        .then(purning);
    }

    await player.seek(seekTime)
    
    return commandTrigger
        .reply(i18n.__mf("seek.result", { prefix: bot.prefix, time: formatTime(seekTime * 1000) }))
        .then(purning);
  }
}