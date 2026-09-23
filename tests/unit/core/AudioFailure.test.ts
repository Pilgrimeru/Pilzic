import { expect, test } from "bun:test";
import { classifyAudioFailure } from "@core/helpers/AudioFailure";
import { YouTubeStreamError } from "@core/helpers/YouTubeStreamConverter";

test("classe les erreurs réseau comme réessayables", () => {
  expect(
    classifyAudioFailure(
      Object.assign(new Error("reset"), { code: "ECONNRESET" }),
    ).retryable,
  ).toBeTrue();
});

test("arrête les retries lorsque YouTube demande une authentification", () => {
  const failure = classifyAudioFailure(
    new YouTubeStreamError("auth", "YOUTUBE_AUTH_REQUIRED"),
  );
  expect(failure.kind).toBe("auth");
  expect(failure.retryable).toBeFalse();
});
