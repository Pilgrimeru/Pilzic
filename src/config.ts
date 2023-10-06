import { config as dotenvConfig } from 'dotenv';
import { Config } from './types/Config';

dotenvConfig({ path: 'config.env' });

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  const parsedValue = parseInt(value ?? '', 10);
  return (isNaN(parsedValue) || parsedValue < 0) ? defaultValue : parsedValue;
}

function parseEnvAudioQuality(value: string | undefined, defaultValue: 0 | 1 | 2): 0 | 1 | 2 {
  const parsedValue = parseEnvInt(value, 0);
  if ([0, 1, 2].includes(parsedValue)) {
    return parsedValue as 0 | 1 | 2;
  }
  return defaultValue;
}

function parseEnvColor(value: string | undefined, defaultValue: number): number {
  if (value) {
    value = value.replace("#", "0x");
    const parsedValue = parseInt(value, 16);
    return parsedValue;
  }
  return defaultValue;
}

const config: Config = {
  TOKEN: process.env.TOKEN ?? "",
  PREFIX: process.env.PREFIX ?? "!",
  MAX_PLAYLIST_SIZE: parseEnvInt(process.env.MAX_PLAYLIST_SIZE, 10),
  AUTO_DELETE: Boolean(process.env.AUTO_DELETE),
  STAY_TIME: parseEnvInt(process.env.STAY_TIME, 30),
  AUDIO_QUALITY: parseEnvAudioQuality(process.env.AUDIO_QUALITY, 0),
  DEFAULT_VOLUME: parseEnvInt(process.env.DEFAULT_VOLUME, 100),
  LOCALE: process.env.LOCALE ?? "en",
  COLORS: {
    MAIN: parseEnvColor(process.env.MAIN_COLOR, 0x69ADC7),
    PAUSE: 0xC0C0C0
  }
};

export { config };