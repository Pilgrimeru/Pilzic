import { YouTubeSearchExtractor } from "@core/extractors/YoutubeSearchExtractor";
import type { SearchExtractor } from "@core/extractors/abstract/SearchExtractor";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import { InvalidURLError } from "@errors/ExtractionErrors";
import { ExtractorFactory } from "./ExtractorFactory";

type SearchProvider = {
  new (query: string, type: "track" | "playlist"): SearchExtractor;
  validate(query: string): Promise<boolean>;
};

export class DataFinder {
  public static SearchExtractorClass: SearchProvider = YouTubeSearchExtractor;

  public static setSearchProvider(provider: SearchProvider): void {
    this.SearchExtractorClass = provider;
  }

  public static async searchTrackData(query: string): Promise<TrackData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "track");
    return searchExtractor.extract("track");
  }

  public static async searchPlaylistData(
    query: string,
    fetch: boolean = false,
  ): Promise<PlaylistData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(
      query,
      "playlist",
    );
    return searchExtractor.searchPlaylist(fetch);
  }

  public static async searchMultipleTracksData(
    query: string,
    limit: number,
  ): Promise<TrackData[]> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "track");
    return searchExtractor.searchMultipleTracks(limit);
  }

  public static async searchMultiplePlaylistsData(
    query: string,
    limit: number,
    fetch: boolean = false,
  ): Promise<PlaylistData[]> {
    const searchExtractor = new DataFinder.SearchExtractorClass(
      query,
      "playlist",
    );
    return searchExtractor.searchMultiplePlaylists(limit, fetch);
  }

  public static async searchData(query: string, type: "track" | "playlist") {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, type);
    return searchExtractor.extract();
  }

  public static async getDataFromLink(
    url: string,
  ): Promise<TrackData | PlaylistData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (!searchExtractor) throw new InvalidURLError();
    return searchExtractor.extract();
  }

  public static async getTrackDataFromLink(url: string): Promise<TrackData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (searchExtractor?.type !== "track") throw new InvalidURLError();
    return searchExtractor.extract("track");
  }

  public static async getPlaylistDataFromLink(
    url: string,
  ): Promise<PlaylistData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (searchExtractor?.type !== "playlist") throw new InvalidURLError();
    return searchExtractor.extract("playlist");
  }
}
