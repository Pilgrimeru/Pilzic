import type { Config } from "@custom-types/Config";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: "config.env", quiet: true });

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  const parsedValue = parseInt(value ?? "", 10);
  return isNaN(parsedValue) || parsedValue < 0 ? defaultValue : parsedValue;
}

function parseEnvColor(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value) {
    value = value.replace("#", "0x");
    const parsedValue = parseInt(value, 16);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }
  return defaultValue;
}

const config: Config = {
  TOKEN: process.env["TOKEN"] ?? "",
  PREFIX: process.env["PREFIX"] ?? "!",
  MAX_PLAYLIST_SIZE: parseEnvInt(process.env["MAX_PLAYLIST_SIZE"], 10),
  AUTO_DELETE: process.env["AUTO_DELETE"] == "true",
  STAY_TIME: parseEnvInt(process.env["STAY_TIME"], 30),
  DEFAULT_VOLUME: parseEnvInt(process.env["DEFAULT_VOLUME"], 100),
  LOCALE: process.env["LOCALE"] ?? "en",
  CACHE_SIZE: parseEnvInt(process.env["CACHE_SIZE"], 0),
  AUTOCOMPLETE: process.env["AUTOCOMPLETE"] == "true",
  USERAGENT:
    process.env["USERAGENT"] ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  YOUTUBE_COOKIES_PATH:
    process.env["YOUTUBE_COOKIES_PATH"]?.trim() || undefined,
  YOUTUBE_MAX_RETRIES: parseEnvInt(process.env["YOUTUBE_MAX_RETRIES"], 5),
  AUDIO_CACHE_MAX_FILES: parseEnvInt(process.env["AUDIO_CACHE_MAX_FILES"], 50),
  AUDIO_CACHE_MAX_MB: parseEnvInt(process.env["AUDIO_CACHE_MAX_MB"], 500),
  AUDIO_PRELOAD_COUNT: parseEnvInt(process.env["AUDIO_PRELOAD_COUNT"], 5),
  AUDIO_PRELOAD_CONCURRENCY: parseEnvInt(
    process.env["AUDIO_PRELOAD_CONCURRENCY"],
    2,
  ),
  COLORS: {
    MAIN: parseEnvColor(process.env["MAIN_COLOR"], 0x69adc7),
    PAUSE: 0xc0c0c0,
  },
};

export { config };
