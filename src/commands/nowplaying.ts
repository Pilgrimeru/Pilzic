import { EmbedBuilder } from 'discord.js';
import { splitBar } from 'string-progressbar';
import { config } from 'config';
import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { i18n } from 'i18n.config';
import { bot } from 'index';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { formatTime } from '@utils/formatTime';

export default class NowPlayingCommand extends Command {
  constructor() {
    super({
      name: "nowplaying",
      aliases: ["np"],
      description: i18n.__("nowplaying.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const track = player.queue.currentTrack!;
    const seek = player.playbackDuration;
    const left = track.duration - seek;

    let nowPlaying = new EmbedBuilder()
      .setTitle(`${player.status === "playing" ? "▶" : "⏸"} ${i18n.__("nowplaying.embedTitle")}`)
      .setDescription(`[${track.title}](${track.url})`)
      .setColor(config.COLORS.MAIN)
      .setThumbnail(track.thumbnail);

    nowPlaying.addFields(
      {
        name: "\u200b",
        value: formatTime(seek) +
          " [" +
          splitBar((track.duration == 0 ? seek : track.duration), seek, 15)[0] +
          "] " +
          (track.duration == 0 ? i18n.__mf("nowplaying.live") : formatTime(track.duration)),
        inline: false
      }
    );

    if (track.duration >= 1000) {
      nowPlaying.setFooter({
        text: i18n.__mf("nowplaying.timeRemaining", {
          time: formatTime(left)
        })
      });
    }

    return commandTrigger.reply({ embeds: [nowPlaying] }).then(msg => autoDelete(msg, true));
  }
}