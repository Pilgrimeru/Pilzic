import { EmbedBuilder, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
// @ts-ignore
import lyricsFinder from "lyrics-finder";
import { queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "lyrics",
  aliases: ["ly"],
  description: i18n.__("lyrics.description"),
  async execute(message: Message) {
    
    if (!queueExists(message)) return;

    const player = bot.players.get(message.guild!.id)!;
    
    let lyrics = null;
    const title = player.queue.songs[player.queue.index].title;
    
    const loadingReply = await message.reply(i18n.__mf("common.loading"));

    try {
      lyrics = await lyricsFinder(player.queue.songs[0].title, "");
      if (!lyrics) lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    } catch (error) {
      lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    } finally {
      loadingReply.delete().catch(() => null);
    }

    let lyricsEmbed = new EmbedBuilder()
      .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
      .setDescription(lyrics)
      .setColor("#69adc7")
      .setTimestamp();

    if (lyricsEmbed.data.description!.length >= 4096)
      lyricsEmbed.setDescription(`${lyricsEmbed.data.description!.slice(0, 4093)}...`);

    return message.reply({ embeds: [lyricsEmbed] }).then(msg => purning(msg, true));
  }
};