import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
// @ts-ignore
import lyricsFinder from "lyrics-finder";
import { CommandTrigger } from "../core/CommandTrigger.js";
import { config } from "../config.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";
export default class LyricsCommand extends Command {
  constructor() {
    super({
      name: "lyrics",
      aliases: ["ly"],
      description: i18n.__("lyrics.description"),
      options: [
        {
          name: 'title',
          description: i18n.__mf("lyrics.options.title"),
          type: ApplicationCommandOptionType.String,
          required: false,
        }
      ],
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    const player = bot.players.get(commandTrigger.guild.id)!;

    const title = args.length === 0 ? player.queue.currentSong!.title : args.join(" ");

    commandTrigger.loadingReply();

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
      .setColor(config.COLORS.MAIN)
      .setTimestamp();

    if (lyricsEmbed.data.description!.length >= 4096)
      lyricsEmbed.setDescription(`${lyricsEmbed.data.description!.slice(0, 4093)}...`);

    return commandTrigger.editReply({ content: "", embeds: [lyricsEmbed] }).then(msg => autoDelete(msg, true));
  }
}