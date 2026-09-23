import type { AudioResource } from "@discordjs/voice";
import { createAudioResource } from "@discordjs/voice";
import type { Track } from "./Track";
import type { SourceAdapter } from "./sources/SourceAdapter";
import { YouTubeSourceAdapter } from "./sources/YouTubeSourceAdapter";
import { SoundCloudSourceAdapter } from "./sources/SoundCloudSourceAdapter";
import { CatalogSourceAdapter } from "./sources/CatalogSourceAdapter";
import { ExternalSourceAdapter } from "./sources/ExternalSourceAdapter";
import { coreMetrics } from "./helpers/CoreMetrics";

function defaultSources(): SourceAdapter[] {
  const youtube = new YouTubeSourceAdapter();
  return [
    new SoundCloudSourceAdapter(),
    youtube,
    new CatalogSourceAdapter(youtube),
    new ExternalSourceAdapter(),
  ];
}

export class AudioResourceFactory {
  constructor(private readonly sources: SourceAdapter[] = defaultSources()) {}

  public async createResource(
    track: Track,
    seek?: number,
    signal?: AbortSignal,
    volume = 100,
  ): Promise<AudioResource<Track>> {
    const adapter = this.sources.find((source) => source.canHandle(track));
    if (!adapter) throw new Error("No audio source available");
    const startedAt = performance.now();
    const source = await adapter.open(track, seek, signal).finally(() => {
      coreMetrics.recordPhase("source_open", performance.now() - startedAt);
    });
    if (signal?.aborted) {
      source.close();
      throw signal.reason;
    }
    try {
      const resource = createAudioResource(source.stream, {
        metadata: track,
        inputType: source.inputType,
        inlineVolume: volume !== 100 || !source.format.seekable,
      });
      resource.playStream.once("close", () => source.close());
      return resource;
    } catch (error) {
      source.close();
      throw error;
    }
  }

  public preload(track: Track, signal?: AbortSignal): Promise<string | null> {
    const adapter = this.sources.find((source) => source.canHandle(track));
    return adapter?.preload?.(track, signal) ?? Promise.resolve(null);
  }
}

export const audioResourceFactory = new AudioResourceFactory();
