import { DataFinder } from '@core/helpers/DataFinder';
import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { InvalidURLError, NoDataError, ServiceUnavailableError } from '@errors/ExtractionErrors';
import { config } from 'config';
import fetch from 'isomorphic-unfetch';
import { sp_validate } from 'play-dl';
import { LinkExtractor } from './abstract/LinkExtractor';
// @ts-ignore
import spotifyUrlInfo from 'spotify-url-info';

const { getPreview, getTracks } = spotifyUrlInfo(fetch);


export class SpotifyLinkExtractor extends LinkExtractor {

  private static readonly SP_LINK = /^https?:\/\/(?:open|play)\.spotify\.com\/?.+/;
  private static readonly SP_ARTIST = /^https?:\/\/(?:open|play)\.spotify\.com\/artist\/?.+/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(SpotifyLinkExtractor.SP_LINK)) {
      const result = sp_validate(url);
      if (result == "search") return false;
      if (result == "album") return "playlist";
      if (url.match(SpotifyLinkExtractor.SP_ARTIST)) return "playlist";
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
      data = await getPreview(this.url, { headers: { 'user-agent': config.USERAGENT } });
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
    if (!data.type) throw new NoDataError();
    const search = data.artist + " " + data.track;
    return DataFinder.searchTrackData(search);
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      const playlist = await getPreview(this.url, { headers: { 'user-agent': config.USERAGENT } });
      if (!playlist) {
        throw new NoDataError();
      }
      const playlistTracks = await getTracks(this.url, { headers: { 'user-agent': config.USERAGENT } });

      const promiseTracksData: Promise<TrackData>[] = playlistTracks.map((track: any) => {
        const search = track.artist + " " + track.name;
        return DataFinder.searchTrackData(search);
      });

      const tracks = await Promise.all(promiseTracksData);
      const duration = tracks.reduce((total, track) => total + track.duration, 0);

      return { title: playlist.title, url: playlist.link, tracks: tracks, duration };
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }
}
