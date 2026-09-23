import { expect, mock, test } from "bun:test";
import { NowPlayingMsgManager } from "@core/managers/NowPlayingMsgManager";
import { Track } from "@core/Track";
import type { Player } from "@core/Player";
import type { User, Message } from "discord.js";

test("une ancienne réponse Discord ne réactive pas ses boutons après clear", async () => {
  let resolveSend!: (message: Message) => void;
  const deferred = new Promise<Message>((resolve) => {
    resolveSend = resolve;
  });
  const edit = mock(async () => undefined);
  const message = { edit, editable: true } as unknown as Message;
  const player = {
    textChannel: { send: () => deferred },
    status: "playing",
    queue: { canBack: () => false },
  } as unknown as Player;
  const manager = new NowPlayingMsgManager(player);
  const track = Track.from(
    {
      url: "https://youtube.com/watch?v=test",
      title: "Test",
      duration: 1000,
      thumbnail: "https://example.test/cover.jpg",
    },
    { displayName: "Test", avatarURL: () => null } as unknown as User,
  );

  const sending = manager.send(track);
  await manager.clear();
  resolveSend(message);
  await sending;
  expect(edit).toHaveBeenCalledWith({ components: [] });
});
