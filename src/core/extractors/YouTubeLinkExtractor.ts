import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  AgeRestrictedError,
  InvalidURLError,
  NoDataError,
  NothingFoundError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import { video_basic_info, yt_validate } from "play-dl";
import YouTube, { Video } from "youtube-sr";
import { LinkExtractor } from "./abstract/LinkExtractor";

export class YouTubeLinkExtractor extends LinkExtractor {
  private static readonly YT_LINK =
    /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?(youtube\.com|youtu.be)\/.+$/;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (RegExp(YouTubeLinkExtractor.YT_LINK).exec(url)) {
      const result = yt_validate(url);
      if (result == "search") return false;
      if (result == "video") return "track";
      return result;
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const trackInfo = await video_basic_info(this.url, { htmldata: false });

      if (!trackInfo.video_details.title || !trackInfo.video_details.url) {
        throw new NothingFoundError();
      }

      return {
        url: trackInfo.video_details.url,
        title: trackInfo.video_details.title,
        duration: trackInfo.video_details.durationInSec * 1000,
        thumbnail: trackInfo.video_details.thumbnails[0].url,
        related: trackInfo.related_videos,
      };
    } catch (error: any) {
      if (error.message?.includes("confirm your age")) {
        throw new AgeRestrictedError();
      }
      if (error.message?.includes("not a bot")) {
        throw new ServiceUnavailableError();
      }
      if (
        error.message?.includes("Private video") ||
        error.message?.includes("Video unavailable")
      ) {
        throw new InvalidURLError();
      }
      throw error;
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    const playlist = await YouTube.getPlaylist(this.url, {
      fetchAll: true,
      limit: config.MAX_PLAYLIST_SIZE,
    });

    if (!playlist?.title || !playlist.url) {
      throw new InvalidURLError();
    }

    const playlistTracks = await YouTubeLinkExtractor.buildTracksData(
      playlist.videos,
    );

    if (!playlistTracks) {
      throw new NoDataError();
    }

    const duration = playlistTracks.reduce(
      (total, track) => total + track.duration,
      0,
    );

    return {
      title: playlist.title,
      url: playlist.url,
      tracks: playlistTracks,
      duration,
    };
  }

  private static async buildTracksData(videos: Video[]): Promise<TrackData[]> {
    const validVideos = videos.filter(
      (video) =>
        video?.title &&
        video.title !== "Private video" &&
        video.title !== "Deleted video" &&
        !video.nsfw,
    );

    return validVideos.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((video) => ({
      title: video.title!,
      url: `https://youtube.com/watch?v=${video.id}`,
      duration: video.duration,
      thumbnail: video.thumbnail?.url!,
    }));
  }
}
