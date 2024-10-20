import YouTube from 'youtube-sr';
import { AgeRestrictedError, ServiceUnavailableError, InvalidURLError, NothingFoundError, YoutubeMixesError } from '../../errors/ExtractionErrors';
import { LinkExtractor } from './LinkExtractor.js';
import { yt_validate, video_basic_info } from 'play-dl';
import { config } from "../../config.js";
import type { TrackData } from '../../types/extractor/TrackData.js';
import type { PlaylistData } from '../../types/extractor/PlaylistData.js';

export class YouTubeExtractor extends LinkExtractor {
  private static readonly YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(YouTubeExtractor.YT_LINK)) {
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
    if (!songInfo.video_details.title) {
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
    try {
      let playlist = await YouTube.getPlaylist(this.url, {
        fetchAll: true,
        limit: config.MAX_PLAYLIST_SIZE
      });
      if (!playlist || !playlist.title || !playlist.url) {
        throw new InvalidURLError();
      }

      const songs = await YouTubeExtractor.getTracksDataFromYoutube(playlist.videos);
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.title, url: playlist.url, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("Mixes")) {
        throw new YoutubeMixesError();
      }
      throw error;
    }
  }
}
