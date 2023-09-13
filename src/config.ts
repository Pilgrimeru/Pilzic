import { config as dotenvConfig } from 'dotenv';
import { Config } from "./types/Config";

let config: Config;
dotenvConfig({ path: 'config.env' })

config = {
  TOKEN: process.env.TOKEN || "",
  PREFIX: process.env.PREFIX || "!",
  MAX_PLAYLIST_SIZE: (parseInt(process.env.MAX_PLAYLIST_SIZE!) > 1) ? parseInt(process.env.MAX_PLAYLIST_SIZE!) : 1 || 10,
  PRUNING: process.env.PRUNING === "true" ? true : false,
  STAY_TIME: parseInt(process.env.STAY_TIME!) || 10,
  AUDIO_QUALITY: parseInt(process.env.AUDIO_QUALITY!) >= 0 && parseInt(process.env.AUDIO_QUALITY!) <= 2 ? parseInt(process.env.AUDIO_QUALITY!) as 0 | 1 | 2 : 0,
  DEFAULT_VOLUME: parseInt(process.env.DEFAULT_VOLUME!) || 100,
  LOCALE: process.env.LOCALE || "en"
};

export { config };
