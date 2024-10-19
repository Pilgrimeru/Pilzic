import axios, { type AxiosResponse } from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';

ffmpeg.setFfprobePath(ffprobe.path);

type ExternalStreamInfo = {
  fileName: string;
  durationInMs: number;
}

export async function getExternalStreamInfo(url: string): Promise<ExternalStreamInfo> {
  const response = await axios.get(url, { responseType: 'stream' });
  const headers = response.headers;

  const name = extractFileName(headers);
  const durationInMs = await getStreamDuration(response)

  return {
    fileName: name,
    durationInMs: durationInMs
  }
}

function extractFileName(headers: any): string {
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

async function getStreamDuration(streamResponse: AxiosResponse<any, any>): Promise<number> {
  const { data: audioStream, headers } = streamResponse;

  const data: any = await new Promise((resolve, reject) => {
    ffmpeg(audioStream).ffprobe((err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const duration = parseFloat(data.format.duration);
  if (!isNaN(duration)) {
    return duration * 1000
  }

  const bitRate = parseInt(data.format.bit_rate);
  const fileSize = parseInt(headers['content-length']);
  

  if (!isNaN(bitRate) && !isNaN(fileSize)) {
    return (fileSize * 8 * 1000) / bitRate;
  }

  throw new Error('Could not determine the duration.');
}

