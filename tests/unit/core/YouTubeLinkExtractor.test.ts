import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as playDl from "play-dl";
import * as ytDlpJson from "@core/helpers/YtDlpJson";
import {
  getYouTubePlaylistInfo,
  getYouTubePlaylistUrl,
  getYouTubeVideoInfo,
} from "@core/helpers/YouTubeYtDlp";
import { YouTubeLinkExtractor } from "@core/extractors/YouTubeLinkExtractor";
import {
  AgeRestrictedError,
  InvalidURLError,
  NothingFoundError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";

class TestExtractor extends YouTubeLinkExtractor {
  public track() {
    return this.extractTrack();
  }
  public playlist() {
    return this.extractPlaylist();
  }
}

afterEach(() => mock.restore());

test("conserve la vidéo des Mix YouTube dans les liens watch, music et courts", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=nPmKtcQBGVo&list=RDnPmKtcQBGVo&start_radio=1",
    "https://music.youtube.com/watch?v=nPmKtcQBGVo&list=RDnPmKtcQBGVo",
    "https://youtu.be/nPmKtcQBGVo?list=RDnPmKtcQBGVo",
    "https://www.youtube.com/playlist?list=RDnPmKtcQBGVo",
  ]) {
    expect(getYouTubePlaylistUrl(url)).toBe(
      "https://www.youtube.com/watch?v=nPmKtcQBGVo&list=RDnPmKtcQBGVo",
    );
  }
  expect(
    getYouTubePlaylistUrl(
      "https://youtube.com/watch?v=nPmKtcQBGVo&list=RDMM&index=3",
    ),
  ).toBe("https://www.youtube.com/watch?v=nPmKtcQBGVo&list=RDMM");
  expect(getYouTubePlaylistUrl("https://youtube.com/playlist?list=RDMM")).toBe(
    "https://youtube.com/playlist?list=RDMM",
  );
});

test("normalise toujours les playlists ordinaires", () => {
  expect(
    getYouTubePlaylistUrl(
      "https://youtube.com/watch?v=nPmKtcQBGVo&list=PLtest&index=3",
    ),
  ).toBe("https://www.youtube.com/playlist?list=PLtest");
});

test("extrait le Mix entier avec une limite, sans perdre la vidéo de départ", async () => {
  const run = spyOn(ytDlpJson, "runYtDlpJson").mockImplementation(
    async <T>() =>
      ({
        title: "Mix",
        entries: [
          { id: "nPmKtcQBGVo", title: "Track", duration: 42 },
          { id: "private", title: "Private video" },
        ],
      }) as T,
  );
  const url = "https://youtube.com/watch?v=nPmKtcQBGVo&list=RDnPmKtcQBGVo";
  const result = await new TestExtractor(url, "playlist").playlist();
  expect(result.tracks).toHaveLength(1);
  expect(result.duration).toBe(42_000);
  const args = run.mock.calls[0][0];
  expect(args[0]).toBe(
    "https://www.youtube.com/watch?v=nPmKtcQBGVo&list=RDnPmKtcQBGVo",
  );
  expect(args).toContain("--yes-playlist");
  expect(args).toContain("--flat-playlist");
  expect(args[args.indexOf("--playlist-end") + 1]).toBe(
    String(config.MAX_PLAYLIST_SIZE),
  );
});

test("récupère les métadonnées via yt-dlp quand play-dl ne lit plus la page", async () => {
  spyOn(playDl, "video_basic_info").mockRejectedValue(
    new Error("Initial Response Data is undefined."),
  );
  const run = spyOn(ytDlpJson, "runYtDlpJson").mockImplementation(
    async <T>() => ({ id: "nPmKtcQBGVo", title: "Track", duration: 42 }) as T,
  );
  const result = await new TestExtractor(
    "https://youtube.com/watch?v=nPmKtcQBGVo",
    "track",
  ).track();
  expect(result).toEqual({
    title: "Track",
    url: "https://www.youtube.com/watch?v=nPmKtcQBGVo",
    duration: 42_000,
    thumbnail: null,
    related: undefined,
  });
  expect(run.mock.calls[0][0]).toContain("--no-playlist");
  expect(run.mock.calls[0][0]).toContain("--skip-download");
});

test("garde les métadonnées et vidéos liées de play-dl quand il fonctionne", async () => {
  const info = {
    video_details: {
      title: "Track",
      url: "https://youtube.com/watch?v=nPmKtcQBGVo",
      durationInSec: 42,
      thumbnails: [{ url: "https://example.test/thumbnail.jpg" }],
    },
    related_videos: ["https://youtube.com/watch?v=aqz-KE-bpKQ"],
  } as Awaited<ReturnType<typeof playDl.video_basic_info>>;
  spyOn(playDl, "video_basic_info").mockResolvedValue(info);
  const run = spyOn(ytDlpJson, "runYtDlpJson");
  const result = await new TestExtractor(
    info.video_details.url,
    "track",
  ).track();
  expect(result.related).toEqual(info.related_videos);
  expect(result.thumbnail).toBe("https://example.test/thumbnail.jpg");
  expect(run).not.toHaveBeenCalled();
});

test("traduit les refus YouTube du recours yt-dlp en erreurs utilisateur", async () => {
  spyOn(playDl, "video_basic_info").mockRejectedValue(new Error("Broken page"));
  const run = spyOn(ytDlpJson, "runYtDlpJson");
  for (const [message, errorType] of [
    ["Sign in to confirm your age", AgeRestrictedError],
    ["This video is age-restricted", AgeRestrictedError],
    ["Private video", InvalidURLError],
    ["Video unavailable", InvalidURLError],
    ["Sign in to confirm you're not a bot", ServiceUnavailableError],
  ] as const) {
    run.mockRejectedValueOnce(new Error(message));
    await expect(
      new TestExtractor(
        "https://youtube.com/watch?v=nPmKtcQBGVo",
        "track",
      ).track(),
    ).rejects.toBeInstanceOf(errorType);
  }
});

test("refuse un recours yt-dlp dépourvu de titre", async () => {
  spyOn(playDl, "video_basic_info").mockRejectedValue(new Error("Broken page"));
  spyOn(ytDlpJson, "runYtDlpJson").mockImplementation(
    async <T>() => ({ id: "nPmKtcQBGVo" }) as T,
  );
  await expect(
    new TestExtractor(
      "https://youtube.com/watch?v=nPmKtcQBGVo",
      "track",
    ).track(),
  ).rejects.toBeInstanceOf(NothingFoundError);
});

test("partage les options YouTube entre les métadonnées vidéo et playlist", async () => {
  const run = spyOn(ytDlpJson, "runYtDlpJson").mockImplementation(
    async <T>() => ({}) as T,
  );
  await getYouTubeVideoInfo("https://youtube.com/watch?v=nPmKtcQBGVo");
  await getYouTubePlaylistInfo("https://youtube.com/playlist?list=PLtest");
  for (const [args] of run.mock.calls) {
    expect(args[args.indexOf("--js-runtimes") + 1]).toBe(
      `bun:${process.execPath}`,
    );
    if (config.YOUTUBE_COOKIES_PATH)
      expect(args[args.indexOf("--cookies") + 1]).toBe(
        config.YOUTUBE_COOKIES_PATH,
      );
  }
});
