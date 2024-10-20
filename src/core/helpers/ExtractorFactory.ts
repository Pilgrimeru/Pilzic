import { InvalidURLError } from '../../errors/ExtractionErrors';
import type { Extractor } from '../extractors/abstract/Extractor';
import type { LinkExtractor } from '../extractors/abstract/LinkExtractor';
import { DeezerLinkExtractor } from '../extractors/DeezerLinkExtractor';
import { ExternalLinkExtractor } from '../extractors/ExternalLinkExtractor';
import { SoundCloudLinkExtractor } from '../extractors/SoundCloudLinkExtractor';
import { SpotifyLinkExtractor } from '../extractors/SpotifyLinkExtractor';
import { YouTubeLinkExtractor } from '../extractors/YouTubeLinkExtractor';
import { DataFinder } from './DataFinder';

export class ExtractorFactory {
  private static linkExtractors = [
    YouTubeLinkExtractor,
    SoundCloudLinkExtractor,
    SpotifyLinkExtractor,
    DeezerLinkExtractor,
    ExternalLinkExtractor,
  ];

  public static async createExtractor(
    query: string, 
    defaultSearchType: "track" | "playlist" = "track"
  ): Promise<Extractor> {
    const url = query.split(" ")[0];

    const extractor = await ExtractorFactory.createLinkExtractor(url);
    if (extractor) return extractor;


    if (await DataFinder.SearchExtractorClass.validate(query)) {
      return new DataFinder.SearchExtractorClass(query, defaultSearchType);
    }

    throw new InvalidURLError();
  }

  public static async createLinkExtractor(url: string): Promise<LinkExtractor | null> {
    for (const LinkExtractorClass of this.linkExtractors) {
      const type = await LinkExtractorClass.validate(url);
      if (type) {
        return new LinkExtractorClass(url, type);
      }
    }
    return null;
  }
}