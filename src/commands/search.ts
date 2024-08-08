import { ActionRowBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import youtube, { Playlist, Video } from "youtube-sr";
import { CommandTrigger } from "../components/CommandTrigger.js";
import { config } from "../config.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class SearchCommand extends Command {
  constructor() {
    super({
      name: "search",
      aliases: ["sh"],
      description: i18n.__("search.description"),
      options: [
        {
          name: 'search',
          description: i18n.__mf("search.options.search"),
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "playlist",
          description: i18n.__mf("search.options.playlist"),
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
      conditions: [
        CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL,
        CommandConditions.CAN_BOT_SPEAK
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    if (!args.length)
      return commandTrigger
        .reply(i18n.__mf("search.usageReply", { prefix: bot.prefix, name: module.exports.name }))
        .then(autoDelete);

    const search = args.join(" ");
    const isInteraction = commandTrigger.isInteraction;

    let searchMode = "video";
    if (!isInteraction && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      searchMode = "playlist";
    } else if (isInteraction && args.at(-1) === "true") {
      args = args.slice(0, args.length - 1);
      searchMode = "playlist";
    } else if (isInteraction && args.at(-1) === "false") {
      args = args.slice(0, args.length - 1);
    }

    let results: Video[] | Playlist[] = [];

    commandTrigger.loadingReply();

    try {
      results = await youtube.search(search, { limit: 10, type: searchMode as any });
    } catch (error: any) {
      console.error(error);
      return commandTrigger.reply(i18n.__("errors.command")).then(msg => autoDelete(msg));
    }

    const options = results
      .filter((item) => item.title != undefined && item.title != "Private video" && item.title != "Deleted video")
      .map((item) => {
        return {
          label: item.title ?? "unnamed",
          value: item.url
        };
      });

    if (options.length === 0)
      return commandTrigger.reply(i18n.__("errors.command")).then(autoDelete);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-select")
        .setPlaceholder(i18n.__("search.menuNothing"))
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(options)
    );

    const response = await commandTrigger.editReply({
      content: i18n.__("search.chooseSong"),
      components: [row]
    });

    try {
      response
        .awaitMessageComponent({
          time: 30000
        })
        .then(async (selectInteraction) => {
          if ((selectInteraction instanceof StringSelectMenuInteraction)) {
            await response.edit({ content: i18n.__("search.finished"), components: [] }).catch(console.error);
            await bot.commands.get("play")!.execute(new CommandTrigger(selectInteraction), selectInteraction.values);
            config.AUTO_DELETE && autoDelete(response);
          }
        });
    } catch (error) {
      commandTrigger.deleteReply();
    }
  }
}