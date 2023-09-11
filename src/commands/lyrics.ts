import { EmbedBuilder, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
// @ts-ignore
import lyricsFinder from "lyrics-finder";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "lyrics",
  aliases: ["ly"],
  description: i18n.__("lyrics.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(message: Message) {
    
    const player = bot.players.get(message.guild!.id)!;
    
    let lyrics = null;
    const title = player.queue.currentSong!.title;
    
    const loadingReply = await message.reply(i18n.__mf("common.loading"));

    try {
      lyrics = await lyricsFinder(title, "");
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