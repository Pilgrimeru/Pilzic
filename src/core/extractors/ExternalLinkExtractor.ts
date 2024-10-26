import axios, { type AxiosResponse } from 'axios';
import ffprobe from 'ffprobe-static';
import ffmpeg from 'fluent-ffmpeg';
import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { LinkExtractor } from './abstract/LinkExtractor';

ffmpeg.setFfprobePath(ffprobe.path);

type ExternalStreamInfo = {
  fileName: string;
  durationInMs: number;
};

export class ExternalLinkExtractor extends LinkExtractor {
  
  private static readonly AUDIO_LINK = /https?:\/\/.+\.(mp3|wav|flac|ogg)(\?.*)?$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(ExternalLinkExtractor.AUDIO_LINK)) {
      return 'track';
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    const info = await this.getExternalStreamInfo(this.url);

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

  private async getExternalStreamInfo(url: string): Promise<ExternalStreamInfo> {
    const response = await axios.get(url, { responseType: 'stream' });
    const headers = response.headers;

    const name = this.extractFileName(headers);
    const durationInMs = await this.getStreamDuration(response);

    return {
      fileName: name,
      durationInMs: durationInMs
    };
  }

  private extractFileName(headers: any): string {
    const contentDisposition = headers['content-disposition'];

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
      if (fileNameMatch) {
        const fileName = fileNameMatch[1].replace(/['"]/g, '');
        return fileName.startsWith("UTF-8''")
          ? decodeURIComponent(fileName.replace("UTF-8''", ''))
          : fileName;
      }
    }

    return 'unknown name';
  }

  private async getStreamDuration(streamResponse: AxiosResponse<any, any>): Promise<number> {
    const { data: audioStream, headers } = streamResponse;

    const data: any = await new Promise((resolve, reject) => {
      ffmpeg(audioStream).ffprobe((err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const duration = parseFloat(data.format.duration);
    if (!isNaN(duration)) {
      return duration * 1000;
    }

    const bitRate = parseInt(data.format.bit_rate);
    const fileSize = parseInt(headers['content-length']);


    if (!isNaN(bitRate) && !isNaN(fileSize)) {
      return (fileSize * 8 * 1000) / bitRate;
    }

    throw new Error('Could not determine the duration.');
  }
}
