import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { ExtractorFactory } from '@core/helpers/ExtractorFactory';
import { Command, CommandConditions } from '@custom-types/Command';
import { ExtractionError } from '@errors/ExtractionErrors';
import { autoDelete } from '@utils/autoDelete';
import { processSearchAutocomplete } from '@utils/processSearchAutocomplete';
import { config } from 'config';
import { ApplicationCommandOptionType, AutocompleteInteraction, BaseGuildTextChannel, PermissionsBitField, User } from 'discord.js';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class PlayCommand extends Command {

  constructor() {
    super({
      name: "play",
      aliases: ["p"],
      description: i18n.__("play.description"),
      options: [
        {
          name: "query",
          description: i18n.__("play.options.query"),
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: config.AUTOCOMPLETE
        },
        {
          name: "playlist",
          description: i18n.__("play.options.playlist"),
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
      permissions: [
        PermissionsBitField.Flags.Connect,
        PermissionsBitField.Flags.Speak
      ],
      conditions: [
        CommandConditions.IS_CONNECTED_TO_CHANNEL,
        CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL,
        CommandConditions.CAN_BOT_SPEAK
      ],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!config.AUTOCOMPLETE) return;
    processSearchAutocomplete(interaction);
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (!args.length && !(commandTrigger.attachments?.size)) {
      return commandTrigger.reply(i18n.__mf("play.usageReply", { prefix: bot.prefix })).then(autoDelete);
    }

    let searchForPlaylist = false;
    if (!commandTrigger.isInteraction && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      searchForPlaylist = true;
    } else if (commandTrigger.isInteraction && args.at(-1) === "true") {
      args = args.slice(0, args.length - 1);
      searchForPlaylist = true;
    } else if (commandTrigger.isInteraction && args.at(-1) === "false") {
      args = args.slice(0, args.length - 1);
    }

    commandTrigger.loadingReply();

    const query = (commandTrigger.attachments && !args.length) ? commandTrigger.attachments.first()?.url! : args.join(" ");
    const requester: User = commandTrigger.member!.user;

    try {
      const extractor = await ExtractorFactory.createExtractor(query, searchForPlaylist ? "playlist" : "track");
      if (extractor.type === "playlist") {
        commandTrigger.editReply(i18n.__("play.fetchingPlaylist")).catch(() => null);
      }
      const item = await extractor.extractAndBuild(requester);

      const guildMember = commandTrigger.member!;
      const { channel } = guildMember!.voice;
      if (!channel) return;

      bot.playerManager.enqueue(item, commandTrigger.channel as BaseGuildTextChannel, channel);

      commandTrigger.deleteReply();

    } catch (error) {
      if (error instanceof ExtractionError) {
        return commandTrigger.editReply(i18n.__(error.i18n())).then(autoDelete);
      }
      throw error;
    }
  }
}
