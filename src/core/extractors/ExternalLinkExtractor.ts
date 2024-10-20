import type { PlaylistData } from '../../types/extractor/PlaylistData';
import type { TrackData } from '../../types/extractor/TrackData';
import { getExternalStreamInfo } from '../../utils/getExternalStreamInfo';
import { LinkExtractor } from './LinkExtractor';


export class ExternalLinkExtractor extends LinkExtractor {
  private static readonly AUDIO_LINK = /https?:\/\/.+\.(mp3|wav|flac|ogg)(\?.*)?$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(ExternalLinkExtractor.AUDIO_LINK)) {
      return 'track';
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    const info = await getExternalStreamInfo(this.url);

    return {
      url: this.url,
      title: info.fileName,
      duration: info.durationInMs,
      thumbnail: null,
    };
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    throw new Error('External links do not support playlists');
  }
}
