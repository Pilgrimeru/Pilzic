import { video_basic_info, yt_validate } from 'play-dl';
import YouTube, { Video } from 'youtube-sr';
import { config } from "../../config.js";
import { AgeRestrictedError, InvalidURLError, NoDataError, NothingFoundError, ServiceUnavailableError } from '../../errors/ExtractionErrors.js';
import type { PlaylistData } from '../../types/extractor/PlaylistData.js';
import type { TrackData } from '../../types/extractor/TrackData.js';
import { LinkExtractor } from './abstract/LinkExtractor.js';

export class YouTubeLinkExtractor extends LinkExtractor {
  private static readonly YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(YouTubeLinkExtractor.YT_LINK)) {
      let result = yt_validate(url);
      if (result == "search") return false;
      if (result == "video") return "track";
      return result;
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    let songInfo;
    try {
      songInfo = await video_basic_info(this.url);
    } catch (error: any) {
      if (error.message?.includes("confirm your age")) {
        throw new AgeRestrictedError();
      }
      if (error.message?.includes("you are a bot")) {
        throw new ServiceUnavailableError();
      }
      if (error.message?.includes("Private video") || error.message?.includes("Video unavailable")) {
        throw new InvalidURLError();
      }
      throw error;
    }
    if (!songInfo.video_details.title || !songInfo.video_details.url) {
      throw new NothingFoundError();
    }

    return {
      url: songInfo.video_details.url,
      title: songInfo.video_details.title,
      duration: songInfo.video_details.durationInSec * 1000,
      thumbnail: songInfo.video_details.thumbnails[0].url,
      related: songInfo.related_videos
    };
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    let playlist = await YouTube.getPlaylist(this.url, {
      fetchAll: true,
      limit: config.MAX_PLAYLIST_SIZE
    });

    if (!playlist || !playlist.title || !playlist.url) {
      throw new InvalidURLError();
    }

    const tracks = await YouTubeLinkExtractor.buildTracksData(playlist.videos);

    if (!tracks) {
      throw new NoDataError();
    }

    const duration = tracks.reduce((total, track) => total + track.duration, 0);

    return { title: playlist.title, url: playlist.url, tracks, duration };
  }

  private static async buildTracksData(videos: Video[]): Promise<TrackData[]> {
    const validVideos = videos.filter((video) =>
      video && video.title && video.title !== "Private video" && video.title !== "Deleted video" && !video.nsfw
    );

    return validVideos.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((video) => ({
      title: video.title!,
      url: `https://youtube.com/watch?v=${video.id}`,
      duration: video.duration,
      thumbnail: video.thumbnail?.url!,
    }));
  }
}
