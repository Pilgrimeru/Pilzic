import { CommandTrigger } from "@core/helpers/CommandTrigger.ts";
import { DataFinder } from "@core/helpers/DataFinder.ts";
import { ExtractorFactory } from "@core/helpers/ExtractorFactory.ts";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData.ts";
import type { TrackData } from "@custom-types/extractor/TrackData.ts";
import { AutocompleteInteraction } from "discord.js";
import YouTube from "youtube-sr";
import { config } from "../config.ts";
import { i18n } from "../i18n.config.ts";

export function parseArgsAndCheckForPlaylist(
  commandTrigger: CommandTrigger,
  args: string[],
): { newArgs: string[]; searchForPlaylist: boolean } {
  let searchForPlaylist = false;

  if (
    !commandTrigger.isInteraction &&
    args.length >= 2 &&
    args[0].toLowerCase() === "playlist"
  ) {
    args = args.slice(1);
    searchForPlaylist = true;
  } else if (commandTrigger.isInteraction && args.at(-1) === "true") {
    args = args.slice(0, -1);
    searchForPlaylist = true;
  } else if (commandTrigger.isInteraction && args.at(-1) === "false") {
    args = args.slice(0, -1);
  }

  return { newArgs: args, searchForPlaylist };
}

export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!config.AUTOCOMPLETE) return;
  await processSearchAutocomplete(interaction);
}

export function getQuery(
  commandTrigger: CommandTrigger,
  args: string[],
): string {
  if (commandTrigger.attachments?.size && !args.length) {
    return commandTrigger.attachments.first()?.url ?? "";
  }
  return args.join(" ");
}

export async function extractAudioItem(
  commandTrigger: CommandTrigger,
  query: string,
  searchForPlaylist: boolean,
) {
  const type = searchForPlaylist ? "playlist" : "track";
  const extractor = await ExtractorFactory.createExtractor(query, type);

  if (extractor.type === "playlist") {
    await commandTrigger
      .editReply(i18n.__("play.fetchingPlaylist"))
      .catch(() => null);
  }

  return extractor.extractAndBuild(commandTrigger.member.user);
}

export async function processSearchAutocomplete(
  interaction: AutocompleteInteraction,
) {
  const focusedValue = interaction.options.getFocused().trim();
  if (!focusedValue) return interaction.respond([]).catch(() => null);

  if (focusedValue.length < 4 || focusedValue.startsWith("http")) {
    return interaction
      .respond([{ name: focusedValue, value: focusedValue }])
      .catch(() => null);
  }

  async function getResult(
    focusedValue: string,
    isPlaylist: boolean,
  ): Promise<PlaylistData | TrackData | undefined> {
    try {
      if (isPlaylist) {
        return await DataFinder.searchPlaylistData(focusedValue, false);
      } else {
        return await DataFinder.searchTrackData(focusedValue);
      }
    } catch {
      return undefined;
    }
  }

  const [suggestions, result] = await Promise.all([
    YouTube.getSuggestions(focusedValue),
    getResult(
      focusedValue,
      interaction.options.getBoolean("playlist") ?? false,
    ),
  ]);

  let autocomplete = (suggestions || []).map((suggestion) => ({
    name: suggestion,
    value: suggestion,
  }));

  if (result) {
    autocomplete.unshift({ name: result.title, value: result.url });
  }

  autocomplete = autocomplete.slice(0, 10);

  return interaction.respond(autocomplete).catch(() => null);
}
