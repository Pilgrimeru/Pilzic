import { EmbedBuilder, Message } from "discord.js";
import { splitBar } from "string-progressbar";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { formatTime } from "../utils/formatTime";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "nowplaying",
  aliases: ["np"],
  description: i18n.__("nowplaying.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS
  ],
  execute(message: Message) {
    
    const player = bot.players.get(message.guild!.id)!;

    const song = player.queue.currentSong!;
    const seek = player.playbackDuration;
    const left = song.duration - seek;

    let nowPlaying = new EmbedBuilder()
      .setTitle(`${player.status === "playing" ? "▶" : "⏸"} ${i18n.__("nowplaying.embedTitle")}`)
      .setDescription(`[${song.title}](${song.url})`)
      .setColor("#69adc7")
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

    return message.reply({ embeds: [nowPlaying] }).then(msg => purning(msg, true));
  }
};