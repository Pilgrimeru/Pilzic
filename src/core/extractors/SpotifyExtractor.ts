import { LinkExtractor } from './LinkExtractor';
import fetch from 'isomorphic-unfetch';
// @ts-ignore
import spotifyUrlInfo from 'spotify-url-info';
import { InvalidURLError, ServiceUnavailableError, NoDataError } from '../../errors/ExtractionErrors';
import { Bot } from '../Bot';
import type { TrackData } from '../../types/extractor/TrackData';
import type { PlaylistData } from '../../types/extractor/PlaylistData';
import { sp_validate } from 'play-dl';
import YouTube, { Video } from 'youtube-sr';
const { getPreview, getTracks } = spotifyUrlInfo(fetch);


export class SpotifyExtractor extends LinkExtractor {
  private static readonly SP_LINK = /^https?:\/\/(?:open|play)\.spotify\.com\/?.+/;
  private static readonly SP_ARTIST = /^https?:\/\/(?:open|play)\.spotify\.com\/artist\/?.+/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(SpotifyExtractor.SP_LINK)) {
      let result = sp_validate(url);
      if (result == "search") return false;
      if (result == "album") return "playlist";
      if (url.match(SpotifyExtractor.SP_ARTIST)) return "playlist";
      return result;
    }
    return false;
  }

  public static getType(url: string): 'track' | 'playlist' {
    return url.includes('/playlist/') ? 'playlist' : 'track';
  }

  protected async extractTrack(): Promise<TrackData> {
    let data;
    try {
      data = await getPreview(this.url, { headers: { 'user-agent': Bot.useragent } });
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
    if (!data.type) throw new NoDataError();
    const search = data.artist + " " + data.track;
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      let playlistPreview = await getPreview(this.url, { headers: { 'user-agent': Bot.useragent } });
      let playlistTracks = await getTracks(this.url, { headers: { 'user-agent': Bot.useragent } });

      const infos: Promise<Video>[] = playlistTracks.map((track: any) => {
        const search = track.artist + " " + track.name;
        return YouTube.searchOne(search, "video", true);
      });

      const songs = await SpotifyExtractor.getTracksDataFromYoutube(await Promise.all(infos));
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlistPreview.title, url: playlistPreview.link, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }
}
