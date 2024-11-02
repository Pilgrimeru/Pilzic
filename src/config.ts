import type { Config } from '@custom-types/Config';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: 'config.env' });

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  const parsedValue = parseInt(value ?? '', 10);
  return (isNaN(parsedValue) || parsedValue < 0) ? defaultValue : parsedValue;
}

function parseEnvColor(value: string | undefined, defaultValue: number): number {
  if (value) {
    value = value.replace("#", "0x");
    const parsedValue = parseInt(value, 16);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }
  return defaultValue;
}

const config: Config = {
  TOKEN: process.env['TOKEN'] ?? "",
  PREFIX: process.env['PREFIX'] ?? "!",
  MAX_PLAYLIST_SIZE: parseEnvInt(process.env['MAX_PLAYLIST_SIZE'], 10),
  AUTO_DELETE: process.env['AUTO_DELETE'] == "true" ? true : false,
  STAY_TIME: parseEnvInt(process.env['STAY_TIME'], 30),
  DEFAULT_VOLUME: parseEnvInt(process.env['DEFAULT_VOLUME'], 100),
  LOCALE: process.env['LOCALE'] ?? "en",
  CACHE_SIZE: parseEnvInt(process.env['CACHE_SIZE'], 0),
  USERAGENT: process.env['LOCALE'] ?? "Mozilla/5.0 (Windows NT 11.0; Win64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5653.214 Safari/537.36",
  COLORS: {
    MAIN: parseEnvColor(process.env['MAIN_COLOR'], 0x69ADC7),
    PAUSE: 0xC0C0C0
  }
};

export { config };

