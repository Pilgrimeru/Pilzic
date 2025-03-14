import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { ExtractionError } from "@errors/ExtractionErrors";
import { autoDelete } from "@utils/autoDelete";
import {
  extractAudioItem,
  getQuery,
  handleAutocomplete,
  parseArgsAndCheckForPlaylist,
} from "@utils/MusicCommandUtils.ts";
import { config } from "config";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  BaseGuildTextChannel,
  PermissionsBitField,
} from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";

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
          autocomplete: config.AUTOCOMPLETE,
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
        PermissionsBitField.Flags.Speak,
      ],
      conditions: [
        CommandConditions.IS_CONNECTED_TO_CHANNEL,
        CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL,
        CommandConditions.CAN_BOT_SPEAK,
      ],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    await handleAutocomplete(interaction);
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (!args.length && !commandTrigger.attachments?.size) {
      return commandTrigger
        .reply(i18n.__mf("play.usageReply", { prefix: bot.prefix }))
        .then(autoDelete);
    }

    const { newArgs, searchForPlaylist } = parseArgsAndCheckForPlaylist(
      commandTrigger,
      args,
    );

    await commandTrigger.loadingReply();

    const query = getQuery(commandTrigger, newArgs);

    try {
      const item = await extractAudioItem(
        commandTrigger,
        query,
        searchForPlaylist,
      );

      const guildMember = commandTrigger.member;
      const { channel } = guildMember.voice;
      if (!channel) return;

      bot.playerManager.enqueue(
        item,
        commandTrigger.channel as BaseGuildTextChannel,
        channel,
      );

      await commandTrigger.deleteReply();
    } catch (error) {
      if (error instanceof ExtractionError) {
        return await commandTrigger
          .editReply(i18n.__(error.i18n()))
          .then(autoDelete);
      }
      throw error;
    }
  }
}
