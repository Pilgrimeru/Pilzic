import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, Message } from "discord.js";
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
  options: [
    {
      name: 'name',
      description: 'the name of the song.',
      type: ApplicationCommandOptionType.String,
      required: false,
    }
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    
    const title = args.length === 0 ? player.queue.currentSong!.title : args.join(" ");
    
    const response = await commandTrigger.reply(i18n.__mf("common.loading"));

    let lyrics = null;
    try {
      lyrics = await lyricsFinder(title, "");
      if (!lyrics) lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    } catch (error) {
      lyrics = i18n.__mf("lyrics.lyricsNotFound", { title: title });
    }

    let lyricsEmbed = new EmbedBuilder()
      .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
      .setDescription(lyrics)
      .setColor("#69adc7")
      .setTimestamp();

    if (lyricsEmbed.data.description!.length >= 4096)
      lyricsEmbed.setDescription(`${lyricsEmbed.data.description!.slice(0, 4093)}...`);

    return response.edit({ content : "", embeds: [lyricsEmbed] }).then(msg => purning(msg, true));
  }
};