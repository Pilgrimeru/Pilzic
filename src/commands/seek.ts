import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { formatTime } from "@utils/formatTime";
import { ApplicationCommandOptionType } from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";
import { yt_validate } from "play-dl";

const timeRegEx = /^(?:\d|[0-5]\d):[0-5]\d(:[0-5]\d)?$/;

export default class SeekCommand extends Command {
  constructor() {
    super({
      name: "seek",
      description: i18n.__("seek.description"),
      options: [
        {
          name: "time",
          description: i18n.__("seek.options.time"),
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL,
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (
      !args.length ||
      (isNaN(Number(args[0])) && !RegExp(timeRegEx).exec(args[0]))
    )
      return await commandTrigger
        .reply(i18n.__("seek.usageReply", { prefix: bot.prefix }))
        .then(autoDelete);

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const currentTrack = player.queue.currentTrack;

    if (!currentTrack || yt_validate(currentTrack.url) !== "video") {
      return await commandTrigger
        .reply(i18n.__("seek.errorSource"))
        .then(autoDelete);
    }

    let seekTime;

    if (RegExp(timeRegEx).exec(args[0])) {
      const [seconds, minutes, hours] = args[0].split(":").reverse();

      seekTime = Number(seconds);
      seekTime += Number(minutes) * 60;
      seekTime += Number(hours ?? 0) * 3600;
    } else {
      seekTime = Number(args[0]) + Math.floor(player.playbackDuration / 1000);
    }

    if (seekTime < 0 || seekTime * 1000 >= (currentTrack?.duration ?? 0)) {
      return await commandTrigger
        .reply(
          i18n.__mf("seek.errorNotValid", {
            prefix: bot.prefix,
            duration: Math.floor(currentTrack?.duration / 1000),
          }),
        )
        .then(autoDelete);
    }

    await player.seek(seekTime);

    return await commandTrigger
      .reply(
        i18n.__mf("seek.result", {
          prefix: bot.prefix,
          time: formatTime(seekTime * 1000),
        }),
      )
      .then(autoDelete);
  }
}
