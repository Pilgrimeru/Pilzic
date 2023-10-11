import { EmbedBuilder } from "discord.js";
import { splitBar } from "string-progressbar";
import { CommandTrigger } from "../components/CommandTrigger";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { autoDelete } from "../utils/autoDelete";
import { formatTime } from "../utils/formatTime";

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

    const player = bot.players.get(commandTrigger.guild.id)!;

    const song = player.queue.currentSong!;
    const seek = player.playbackDuration;
    const left = song.duration - seek;

    let nowPlaying = new EmbedBuilder()
      .setTitle(`${player.status === "playing" ? "▶" : "⏸"} ${i18n.__("nowplaying.embedTitle")}`)
      .setDescription(`[${song.title}](${song.url})`)
      .setColor(config.COLORS.MAIN)
      .setThumbnail(song.thumbnail);

    nowPlaying.addFields(
      {
        name: "\u200b",
        value: formatTime(seek) +
          " [" +
          splitBar((song.duration == 0 ? seek : song.duration), seek, 15)[0] +
          "] " +
          (song.duration == 0 ? i18n.__mf("nowplaying.live") : formatTime(song.duration)),
        inline: false
      }
    );

    if (song.duration >= 1000) {
      nowPlaying.setFooter({
        text: i18n.__mf("nowplaying.timeRemaining", {
          time: formatTime(left)
        })
      });
    }

    return commandTrigger.reply({ embeds: [nowPlaying] }).then(msg => autoDelete(msg, true));
  }
}