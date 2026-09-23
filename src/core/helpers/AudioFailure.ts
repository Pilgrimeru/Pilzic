import { YouTubeStreamError } from "./YouTubeStreamConverter";

export type AudioFailure = {
  kind: "auth" | "unavailable" | "transient" | "unknown";
  retryable: boolean;
  cause: unknown;
};

export function classifyAudioFailure(cause: unknown): AudioFailure {
  if (cause instanceof YouTubeStreamError) {
    const kind =
      cause.code === "YOUTUBE_AUTH_REQUIRED"
        ? "auth"
        : cause.code === "YOUTUBE_UNAVAILABLE" ||
            cause.code === "YOUTUBE_AGE_RESTRICTED"
          ? "unavailable"
          : cause.code === "YOUTUBE_TRANSIENT"
            ? "transient"
            : "unknown";
    return { kind, retryable: kind === "transient", cause };
  }
  const error = cause as { code?: string; message?: string } | null;
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  const transient =
    /^(?:ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNABORTED)$/.test(code) ||
    /socket hang up|timed out|premature|broken pipe|http error 50[0234]/i.test(
      message,
    );
  return {
    kind: transient ? "transient" : "unknown",
    retryable: transient,
    cause,
  };
}
