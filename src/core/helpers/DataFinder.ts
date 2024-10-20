import { InvalidURLError } from '../../errors/ExtractionErrors';
import type { PlaylistData } from '../../types/extractor/PlaylistData';
import type { TrackData } from '../../types/extractor/TrackData';
import { YouTubeSearchExtractor } from '../extractors/YoutubeSearchExtractor';
import { ExtractorFactory } from './ExtractorFactory';

export class DataFinder {

  public static readonly SearchExtractorClass = DataFinder.defineSearchSource();

  public static async searchTrackData(query: string): Promise<TrackData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "track");
    return searchExtractor.extract("track");
  }

  public static async searchPlaylistData(query: string): Promise<PlaylistData> {
    const searchExtractor = new DataFinder.SearchExtractorClass(query, "playlist");
    return searchExtractor.extract("playlist");
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
    // only a search source so return youtube
    return YouTubeSearchExtractor
  }
}