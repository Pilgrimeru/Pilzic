import { describe, expect, test } from "bun:test";
import { Playlist } from "@core/Playlist";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import { config } from "config";
import type { User } from "discord.js";

const requester = { id: "requester" } as User;
const track = (index: number, valid = true): TrackData => ({
  url: valid ? `https://example.test/${index}` : "",
  title: `Piste ${index}`,
  duration: index * 1_000,
  thumbnail: null,
});

describe("Playlist", () => {
  test("retire les pistes sans URL et applique la limite configurée", async () => {
    const tracks = [track(0, false)];
    for (let index = 1; index <= config.MAX_PLAYLIST_SIZE + 2; index++) {
      tracks.push(track(index));
    }
    const data: PlaylistData = {
      title: "Playlist de test",
      url: "https://example.test/playlist",
      duration: 123_000,
      tracks,
    };

    const playlist = await Playlist.from(data, requester);

    expect(playlist.tracks).toHaveLength(config.MAX_PLAYLIST_SIZE);
    expect(playlist.tracks.every((item) => Boolean(item.url))).toBeTrue();
    expect(playlist.tracks[0]?.requester).toBe(requester);
    expect(playlist.title).toBe(data.title);
    expect(playlist.url).toBe(data.url);
    expect(playlist.duration).toBe(data.duration);
  });

  test("accepte une playlist vide après filtrage", async () => {
    const playlist = await Playlist.from(
      {
        title: "Vide",
        url: "https://example.test/empty",
        duration: 0,
        tracks: [track(1, false), track(2, false)],
      },
      requester,
    );

    expect(playlist.tracks).toEqual([]);
    expect(playlist.duration).toBe(0);
  });

  test("crée des pistes indépendantes en conservant toutes les métadonnées", async () => {
    const source = track(1);
    source.related = ["https://example.test/related"];
    const playlist = await Playlist.from(
      {
        title: "Métadonnées",
        url: "https://example.test/metadata",
        duration: source.duration,
        tracks: [source],
      },
      requester,
    );

    expect(playlist.tracks[0]?.data).toEqual(source);
    expect(playlist.tracks[0]?.requester).toBe(requester);
    expect(playlist.tracks[0]).not.toBe(source);
  });
});
