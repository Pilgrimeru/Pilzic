import { config as dotenvConfig } from 'dotenv';
import { Config } from './types/Config';

dotenvConfig({ path: 'config.env' });

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  const parsedValue = parseInt(value || '', 10);
  return isNaN(parsedValue) ? defaultValue : parsedValue;
}

function parseEnvAudioQuality(value: string | undefined, defaultValue: 0 | 1 | 2): 0 | 1 | 2 {
  const parsedValue = parseEnvInt(value, 0);
  if ([0, 1, 2].includes(parsedValue)) {
    return parsedValue as 0 | 1 | 2;
  }
  return defaultValue;
}

const config: Config = {
  TOKEN: process.env.TOKEN || "",
  PREFIX: process.env.PREFIX || "!",
  MAX_PLAYLIST_SIZE: parseEnvInt(process.env.MAX_PLAYLIST_SIZE, 10),
  PRUNING: Boolean(process.env.PRUNING),
  STAY_TIME: parseEnvInt(process.env.STAY_TIME, 30),
  AUDIO_QUALITY: parseEnvAudioQuality(process.env.AUDIO_QUALITY, 0),
  DEFAULT_VOLUME: parseEnvInt(process.env.DEFAULT_VOLUME, 100),
  LOCALE: process.env.LOCALE || "en"
};

export { config };