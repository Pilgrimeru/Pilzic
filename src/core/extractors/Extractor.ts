
import type { Video } from "youtube-sr";
import { NoDataError } from "../../errors/ExtractionErrors";
import type { PlaylistData } from "../../types/extractor/PlaylistData";
import type { TrackData } from "../../types/extractor/TrackData";
import { config } from "../../config";
import type { SoundCloudTrack } from "play-dl";

export abstract class Extractor {
    protected type: 'track' | 'playlist';
  
    constructor(type: 'track' | 'playlist') {
      this.type = type;
    }
  
    public static async validate(_url: string): Promise<'track' | 'playlist' | boolean> {
      throw new Error("Must be implemented by subclass");
    }

    public getType(): 'track' | 'playlist' {
      return this.type;
    }
  
    public abstract extract(): Promise<TrackData | PlaylistData>;
  
    protected static async getTracksDataFromYoutube(videos: Video[]): Promise<TrackData[]> {
      const validVideos = videos.filter((video) =>
        video && video.title && video.title !== "Private video" && video.title !== "Deleted video" && !video.nsfw
      );
  
      if (!validVideos.length) {
        throw new NoDataError();
      }
  
      return validVideos.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((video) => ({
        title: video.title!,
        url: `https://youtube.com/watch?v=${video.id}`,
        duration: video.duration,
        thumbnail: video.thumbnail?.url!,
      }));
    }
    protected static async getTracksDataFromSoundCloud(tracks: SoundCloudTrack[]): Promise<TrackData[]> {
      if (!tracks.length) {
        throw new NoDataError();
      }
  
      return tracks.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((track) => ({
        url: track.permalink,
        title: track.name,
        duration: track.durationInMs,
        thumbnail: track.thumbnail,
      }));
    }
}

  