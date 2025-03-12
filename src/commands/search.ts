import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { DataFinder } from "@core/helpers/DataFinder";
import { Command, CommandConditions } from "@custom-types/Command";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import { autoDelete } from "@utils/autoDelete";
import { parseArgsAndCheckForPlaylist } from "@utils/MusicCommandUtils.ts";
import { config } from "config";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  StringSelectMenuBuilder,
} from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class SearchCommand extends Command {
  constructor() {
    super({
      name: "search",
      aliases: ["sh"],
      description: i18n.__("search.description"),
      options: [
        {
          name: "search",
          description: i18n.__("search.options.search"),
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "playlist",
          description: i18n.__("search.options.playlist"),
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
      conditions: [
        CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL,
        CommandConditions.CAN_BOT_SPEAK,
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (!args.length)
      return await commandTrigger
        .reply(i18n.__("search.usageReply", { prefix: bot.prefix }))
        .then(autoDelete);

    const { newArgs, searchForPlaylist } = parseArgsAndCheckForPlaylist(
      commandTrigger,
      args,
    );

    const search = newArgs.join(" ");

    void commandTrigger.loadingReply();
    let results: PlaylistData[] | TrackData[];
    try {
      if (searchForPlaylist) {
        results = await DataFinder.searchMultiplePlaylistsData(search, 10);
      } else {
        results = await DataFinder.searchMultipleTracksData(search, 10);
      }
    } catch (error: any) {
      throw error;
    }

    const options = results.map((item) => {
      return {
        label: item.title ?? "unnamed",
        value: item.url,
      };
    });

    if (options.length === 0)
      return await commandTrigger
        .reply(i18n.__("errors.nothingFound"))
        .then(autoDelete);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-select")
        .setPlaceholder(i18n.__("search.menuNothing"))
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(options),
    );

    const response = await commandTrigger.editReply({
      content: i18n.__("search.chooseTrack"),
      components: [row],
    });

    await response
      .awaitMessageComponent({
        time: 30000,
      })
      .then(async (selectInteraction) => {
        if (selectInteraction.isStringSelectMenu()) {
          await response
            .edit({ content: i18n.__("search.finished"), components: [] })
            .catch(console.error);
          await bot.commandManager.executeCommand(
            "play",
            new CommandTrigger(selectInteraction),
            selectInteraction.values,
          );
          config.AUTO_DELETE && void autoDelete(response);
        }
      })
      .catch(() => commandTrigger.deleteReply());
  }
}
