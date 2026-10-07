import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  getYouTubePlaylistInfo,
  getYouTubeVideoInfo,
  type YouTubePlaylistEntry,
} from "@core/helpers/YouTubeYtDlp";
import {
  AgeRestrictedError,
  InvalidURLError,
  NoDataError,
  NothingFoundError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import { video_basic_info, yt_validate } from "play-dl";
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

  protected override getCacheKey(): string {
    try {
      const url = new URL(this.url);
      const id =
        this.type === "playlist"
          ? url.searchParams.get("list")
          : url.hostname === "youtu.be"
            ? url.pathname.slice(1)
            : url.searchParams.get("v");
      if (id) return `${this.type}:youtube:${id}`;
    } catch {
      // Validation reports malformed URLs before extraction.
    }
    return super.getCacheKey();
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const trackInfo = await video_basic_info(this.url, {
        htmldata: false,
      }).catch(async () => {
        const video = await getYouTubeVideoInfo(this.url);
        if (!video.id || !video.title) throw new NothingFoundError();
        return {
          video_details: {
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            durationInSec: video.duration ?? 0,
            thumbnails: video.thumbnails ?? [{ url: video.thumbnail }],
          },
          // Leave related videos unresolved so autoplay can fetch them later.
          related_videos: undefined,
        };
      });

      if (!trackInfo.video_details.title || !trackInfo.video_details.url) {
        throw new NothingFoundError();
      }

      return {
        url: trackInfo.video_details.url,
        title: trackInfo.video_details.title,
        duration: trackInfo.video_details.durationInSec * 1000,
        thumbnail: trackInfo.video_details.thumbnails.at(-1)?.url ?? null,
        related: trackInfo.related_videos,
      };
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : String(error)
      ).toLowerCase();
      if (
        message.includes("confirm your age") ||
        message.includes("age-restricted")
      ) {
        throw new AgeRestrictedError();
      }
      if (message.includes("not a bot")) {
        throw new ServiceUnavailableError();
      }
      if (
        message.includes("private video") ||
        message.includes("video unavailable")
      ) {
        throw new InvalidURLError();
      }
      throw error;
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    const playlist = await getYouTubePlaylistInfo(this.url);

    const playlistTracks = await YouTubeLinkExtractor.buildTracksData(
      playlist.entries ?? [],
    );

    if (!playlistTracks.length) {
      throw new NoDataError();
    }

    if (!playlist.title) {
      throw new InvalidURLError();
    }

    const duration = playlistTracks.reduce(
      (total, track) => total + track.duration,
      0,
    );

    return {
      title: playlist.title,
      url: playlist.webpage_url ?? playlist.original_url ?? this.url,
      tracks: playlistTracks,
      duration,
    };
  }

  private static async buildTracksData(
    videos: Array<YouTubePlaylistEntry | null>,
  ): Promise<TrackData[]> {
    const validVideos = videos.filter(
      (video): video is YouTubePlaylistEntry & { id: string; title: string } =>
        Boolean(
          video?.id &&
          video.title &&
          video.title !== "Private video" &&
          video.title !== "Deleted video" &&
          video.availability !== "private",
        ),
    );

    return validVideos.slice(0, config.MAX_PLAYLIST_SIZE).map((video) => ({
      title: video.title,
      url:
        video.webpage_url ??
        (video.url?.startsWith("http") ? video.url : undefined) ??
        `https://youtube.com/watch?v=${video.id}`,
      duration: Math.round((video.duration ?? 0) * 1000),
      thumbnail: video.thumbnail ?? video.thumbnails?.at(-1)?.url ?? null,
    }));
  }
}
