import { InvalidURLError } from "@errors/ExtractionErrors";
import type { Extractor } from "../extractors/abstract/Extractor";
import type { LinkExtractor } from "../extractors/abstract/LinkExtractor";
import { LRUCache } from "lru-cache";
import { DeezerLinkExtractor } from "../extractors/DeezerLinkExtractor";
import { ExternalLinkExtractor } from "../extractors/ExternalLinkExtractor";
import { SoundCloudLinkExtractor } from "../extractors/SoundCloudLinkExtractor";
import { SpotifyLinkExtractor } from "../extractors/SpotifyLinkExtractor";
import { YouTubeLinkExtractor } from "../extractors/YouTubeLinkExtractor";
import { normalizeUrl } from "./normalizeInput";
import { DataFinder } from "./DataFinder";

export class ExtractorFactory {
  private static readonly linkExtractors = [
    YouTubeLinkExtractor,
    SoundCloudLinkExtractor,
    SpotifyLinkExtractor,
    DeezerLinkExtractor,
    ExternalLinkExtractor,
  ];
  private static readonly validationCache = new LRUCache<
    string,
    { extractorIndex: number; type: "track" | "playlist" }
  >({ max: 500, ttl: 5 * 60 * 1000 });

  public static async createExtractor(
    query: string,
    defaultSearchType: "track" | "playlist" = "track",
  ): Promise<Extractor> {
    const url = query.split(" ")[0];

    const extractor = await ExtractorFactory.createLinkExtractor(url);
    if (extractor) return extractor;

    if (await DataFinder.SearchExtractorClass.validate(query)) {
      return new DataFinder.SearchExtractorClass(query, defaultSearchType);
    }

    throw new InvalidURLError();
  }

  public static async createLinkExtractor(
    url: string,
  ): Promise<LinkExtractor | null> {
    const key = normalizeUrl(url);
    const cached = this.validationCache.get(key);
    if (cached) {
      const LinkExtractorClass = this.linkExtractors[cached.extractorIndex];
      return new LinkExtractorClass(url, cached.type);
    }

    for (const [
      extractorIndex,
      LinkExtractorClass,
    ] of this.linkExtractors.entries()) {
      const type = await LinkExtractorClass.validate(url);
      if (type) {
        this.validationCache.set(key, { extractorIndex, type });
        return new LinkExtractorClass(url, type);
      }
    }
    return null;
  }
}
