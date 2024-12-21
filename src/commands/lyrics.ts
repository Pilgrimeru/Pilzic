import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { config } from 'config';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { i18n } from 'i18n.config';
import { bot } from 'index';
// @ts-ignore
import lyricsFinder from "lyrics-finder";

export default class LyricsCommand extends Command {

  constructor() {
    super({
      name: "lyrics",
      aliases: ["ly"],
      description: i18n.__("lyrics.description"),
      options: [
        {
          name: 'title',
          description: i18n.__("lyrics.options.title"),
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

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const title = args.length === 0 ? player.queue.currentTrack!.title : args.join(" ");

    void commandTrigger.loadingReply();

    try {
      const lyrics: string = await lyricsFinder(title, "");

      if (!lyrics) {
        commandTrigger.editReply(i18n.__mf("lyrics.lyricsNotFound", { title: title })).then(autoDelete);
      }

      const lyricsEmbed = new EmbedBuilder()
        .setTitle(i18n.__mf("lyrics.embedTitle", { title: title }))
        .setDescription(lyrics.length >= 4096 ? `${lyrics.slice(0, 4093)}...` : lyrics)
        .setColor(config.COLORS.MAIN)
        .setTimestamp();

      return commandTrigger.editReply({ content: "", embeds: [lyricsEmbed] }).then(msg => autoDelete(msg, true));
    } catch (error) {
      await commandTrigger.editReply(i18n.__mf("lyrics.lyricsNotFound", { title: title })).then(autoDelete);
    }
  }
}