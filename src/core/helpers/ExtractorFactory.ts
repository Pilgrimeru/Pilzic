import { LinkExtractor } from '../extractors/LinkExtractor';
import { YouTubeExtractor } from '../extractors/YouTubeExtractor';
import { SoundCloudExtractor } from '../extractors/SoundCloudExtractor';
import { SpotifyExtractor } from '../extractors/SpotifyExtractor';
import { DeezerExtractor } from '../extractors/DeezerExtractor';
import { ExternalLinkExtractor } from '../extractors/ExternalLinkExtractor';

export class ExtractorFactory {
  private static extractors = [
    YouTubeExtractor,
    SoundCloudExtractor,
    SpotifyExtractor,
    DeezerExtractor,
    ExternalLinkExtractor,
  ];

  public static getExtractor(url: string): LinkExtractor {
    for (const ExtractorClass of this.extractors) {
      if (ExtractorClass.canExtract(url)) {
        const type = ExtractorClass.getType(url); // Détermine si c'est une playlist ou un track
        return new ExtractorClass(url, type);
      }
    }
    throw new Error(`No extractor found for URL: ${url}`);
  }
}
