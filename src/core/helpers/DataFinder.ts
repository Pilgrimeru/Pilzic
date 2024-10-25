import { InvalidURLError } from '../../errors/ExtractionErrors';
import type { PlaylistData } from '../../types/extractor/PlaylistData';
import type { TrackData } from '../../types/extractor/TrackData';
import { YouTubeSearchExtractor } from '../extractors/YoutubeSearchExtractor';
import { ExtractorFactory } from './ExtractorFactory';

export class DataFinder {

  public static readonly SearchExtractorClass = DataFinder.defineSearchSource();

  public static async searchTrackData(query: string): Promise<TrackData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "track");
    return searchExtractor.searchTrack();
  }

  public static async searchPlaylistData(query: string): Promise<PlaylistData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "playlist");
    return searchExtractor.searchPlaylist();
  }

  public static async searchMultipleTracksData(query: string, limit: number): Promise<TrackData[]> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "track");
    return searchExtractor.searchMultipleTracks(limit);
  }

  public static async searchMultiplePlaylistsData(query: string, limit: number, fetch: boolean = false ): Promise<PlaylistData[]> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "playlist");
    return searchExtractor.searchMultiplePlaylists(limit, fetch);
  }

  public static async searchData(query: string, type: "track" | "playlist") {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, type);
    return searchExtractor.extract();
  }

  public static async getDataFromLink(url: string): Promise<TrackData | PlaylistData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (!searchExtractor) throw new InvalidURLError();
    return searchExtractor.extract();
  }

  public static async getTrackDataFromLink(url: string): Promise<TrackData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (!searchExtractor || searchExtractor.type !== "track") throw new InvalidURLError();
    return searchExtractor.extract("track");
  }

  public static async getPlaylistDataFromLink(url: string): Promise<PlaylistData> {
    const searchExtractor = await ExtractorFactory.createLinkExtractor(url);
    if (!searchExtractor || searchExtractor.type !== "playlist") throw new InvalidURLError();
    return searchExtractor.extract("playlist");
  }

  private static defineSearchSource() {
    // only one search source so return youtube
    return YouTubeSearchExtractor
  }
}