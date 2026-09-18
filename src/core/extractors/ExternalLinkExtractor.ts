import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import axios, { type AxiosResponse } from "axios";
import ffprobe from "ffprobe-static";
import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { LinkExtractor } from "./abstract/LinkExtractor";

type ExternalStreamInfo = {
  fileName: string;
  durationInMs: number;
};

type FfprobeData = {
  format?: {
    duration?: string;
    bit_rate?: string;
  };
};

export class ExternalLinkExtractor extends LinkExtractor {
  private static readonly AUDIO_LINK =
    /https?:\/\/.+\.(mp3|wav|flac|ogg)(\?.*)?$/;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (RegExp(ExternalLinkExtractor.AUDIO_LINK).exec(url)) {
      return "track";
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    const data = await this.getExternalStreamInfo(this.url);

    return {
      url: this.url,
      title: data.fileName,
      duration: data.durationInMs,
      thumbnail: null,
    };
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    throw new Error("External links do not support playlists");
  }

  private async getExternalStreamInfo(
    url: string,
  ): Promise<ExternalStreamInfo> {
    const response = await axios.get<Readable>(url, {
      responseType: "stream",
      timeout: 15_000,
      maxRedirects: 5,
    });
    const headers = response.headers;

    const name = this.extractFileName(headers);
    const durationInMs = await this.getStreamDuration(response);

    return {
      fileName: name,
      durationInMs: durationInMs,
    };
  }

  private extractFileName(headers: any): string {
    const contentDisposition = headers["content-disposition"];

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
      if (fileNameMatch) {
        const fileName = fileNameMatch[1].replace(/['"]/g, "");
        return fileName.startsWith("UTF-8''")
          ? decodeURIComponent(fileName.replace("UTF-8''", ""))
          : fileName;
      }
    }

    return "unknown name";
  }

  private async getStreamDuration(
    streamResponse: AxiosResponse<Readable>,
  ): Promise<number> {
    const { data: audioStream, headers } = streamResponse;

    const data = await this.probeStream(audioStream);

    const duration = Number.parseFloat(data.format?.duration ?? "");
    if (!isNaN(duration)) {
      return duration * 1000; // Convert seconds to milliseconds
    }

    const bitRate = Number.parseInt(data.format?.bit_rate ?? "", 10);
    const fileSize = Number.parseInt(
      String(headers["content-length"] ?? ""),
      10,
    );

    if (!isNaN(bitRate) && !isNaN(fileSize)) {
      return (fileSize * 8 * 1000) / bitRate;
    }

    throw new Error("Could not determine the duration."); // Proper error handling
  }

  private probeStream(audioStream: Readable): Promise<FfprobeData> {
    const probeProcess = spawn(
      ffprobe.path,
      ["-v", "error", "-print_format", "json", "-show_format", "-i", "pipe:0"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let settled = false;

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        audioStream.destroy();
        probeProcess.kill();
        reject(error);
      };

      probeProcess.stdout?.setEncoding("utf8");
      probeProcess.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      probeProcess.stderr?.setEncoding("utf8");
      probeProcess.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      probeProcess.on("error", (error) => {
        fail(new Error(`FFprobe failed: ${error.message}`));
      });
      probeProcess.on("close", (code) => {
        if (settled) return;
        if (code !== 0) {
          fail(new Error(`FFprobe exited with code ${code}: ${stderr.trim()}`));
          return;
        }

        try {
          const result = JSON.parse(stdout) as FfprobeData;
          settled = true;
          resolve(result);
        } catch (error) {
          fail(
            new Error(
              `FFprobe returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      });
      probeProcess.stdin?.on("error", (error) => {
        fail(new Error(`FFprobe input failed: ${error.message}`));
      });
      audioStream.on("error", (error) => {
        fail(new Error(`Audio stream failed: ${error.message}`));
      });
      audioStream.pipe(probeProcess.stdin!);
    });
  }
}
