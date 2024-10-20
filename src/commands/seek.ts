import { ApplicationCommandOptionType } from "discord.js";
import { yt_validate } from "play-dl";
import { CommandTrigger } from "../core/helpers/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";
import { formatTime } from "../utils/formatTime.js";

const timeRegEx = /^(?:[0-9]|[0-5]\d):[0-5]\d(:[0-5]\d)?$/;

export default class SeekCommand extends Command {
  constructor() {
    super({
      name: "seek",
      description: i18n.__("seek.description"),
      options: [
        {
          name: "time",
          description: i18n.__mf("seek.options.time"),
          type: ApplicationCommandOptionType.String,
          required: true,
        }
      ],
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    if (!args.length || (isNaN(Number(args[0])) && !args[0].match(timeRegEx)))
      return commandTrigger
        .reply(i18n.__mf("seek.usageReply", { prefix: bot.prefix }))
        .then(autoDelete);

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const currentSong = player.queue.currentSong;

    if (!currentSong || yt_validate(currentSong.url) !== "video") {
      return commandTrigger
        .reply(i18n.__mf("seek.errorSource"))
        .then(autoDelete);
    }

    let seekTime;

    if (args[0].match(timeRegEx)) {
      const [seconds, minutes, hours] = args[0].split(':').reverse();

      seekTime = Number(seconds);
      seekTime += Number(minutes) * 60;
      seekTime += Number(hours ?? 0) * 3600;
    } else {
      seekTime = Number(args[0]) + Math.floor(player.playbackDuration / 1000);
    }

    if (seekTime < 0 || seekTime * 1000 >= (currentSong?.duration ?? 0)) {
      return commandTrigger
        .reply(i18n.__mf("seek.errorNotValid", { prefix: bot.prefix, duration: Math.floor(currentSong?.duration! / 1000) }))
        .then(autoDelete);
    }

    await player.seek(seekTime);

    return commandTrigger
      .reply(i18n.__mf("seek.result", { prefix: bot.prefix, time: formatTime(seekTime * 1000) }))
      .then(autoDelete);
  }
}