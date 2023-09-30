import { ActionRowBuilder, ApplicationCommandOptionType, BaseInteraction, CommandInteraction, Message, StringSelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import youtube, { Playlist, Video } from "youtube-sr";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

export default class SearchCommand extends Command {
  constructor() {
    super({
      name: "search",
      aliases: ["sh"],
      description: i18n.__("search.description"),
      options: [
        {
          name: 'search',
          description: 'your youtube search.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "playlist",
          description: "true if it's a playlist search.",
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

  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    if (!args.length)
      return commandTrigger
        .reply(i18n.__mf("search.usageReply", { prefix: bot.prefix, name: module.exports.name }))
        .then(purning);

    const search = args.join(" ");
    const isSlashCommand = (commandTrigger instanceof BaseInteraction);

    let searchMode = "video";
    if (!isSlashCommand && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      searchMode = "playlist";
    } else if (isSlashCommand && args.at(-1) === "true") {
      args.slice(args.length - 1);
      searchMode = "playlist";
    } else if (isSlashCommand && args.at(-1) === "false") {
      args.slice(args.length - 1);
    }

    let results: Video[] | Playlist[] = [];

    const response = await commandTrigger.reply(i18n.__mf("common.loading"));
    
    try {
      results = await youtube.search(search, { limit: 10, type: searchMode as any });
    } catch (error: any) {
      console.error(error);
      return response.edit(i18n.__("errors.command")).then(msg => purning(msg));
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
      return response.edit(i18n.__("errors.command")).then(purning);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-select")
        .setPlaceholder(i18n.__("search.menuNothing"))
        .setMinValues(0)
        .setMaxValues(1)
        .addOptions(options)
    );

    await response.edit({
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
            await bot.commands.get("play")!.execute(selectInteraction, [selectInteraction.values[0]]);
            config.PRUNING && response.delete().catch(() => null);
          }
        });
    } catch (error) {
      response.delete().catch(() => null);
    }
  }
}