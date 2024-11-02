import { DataFinder } from "@core/helpers/DataFinder";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import type { AutocompleteInteraction } from "discord.js";
import YouTube from "youtube-sr";

export async function processSearchAutocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().trim();
  if (!focusedValue) return interaction.respond([]).catch(() => null);

  if (focusedValue.length < 4 || focusedValue.startsWith("http")) {
    return interaction.respond([{ name: focusedValue, value: focusedValue }]);
  }

  const [suggestions, result] = await Promise.all([
    YouTube.getSuggestions(focusedValue),
    getResult(focusedValue, interaction.options.getBoolean("playlist") ?? false)
  ]);

  let autocomplete = (suggestions || []).map(suggestion => ({
    name: suggestion,
    value: suggestion
  }));

  if (result) {
    autocomplete.unshift({ name: result.title, value: result.url });
  }

  autocomplete = autocomplete.slice(0, 10);

  return interaction.respond(autocomplete).catch(() => null);
}

async function getResult(focusedValue: string, isPlaylist: boolean): Promise<PlaylistData | TrackData | undefined> {
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
