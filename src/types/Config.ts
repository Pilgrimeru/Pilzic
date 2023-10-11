export interface Config {
  TOKEN: string;
  PREFIX: string;
  MAX_PLAYLIST_SIZE: number;
  AUTO_DELETE: boolean;
  STAY_TIME: number;
  AUDIO_QUALITY: 0 | 1 | 2,
  DEFAULT_VOLUME: number;
  LOCALE: string;
  COLORS: {
    MAIN: number,
    PAUSE: number;
  };
}