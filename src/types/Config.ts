export interface Config {
  TOKEN: string;
  PREFIX: string;
  MAX_PLAYLIST_SIZE: number;
  AUTO_DELETE: boolean;
  STAY_TIME: number;
  DEFAULT_VOLUME: number;
  LOCALE: string;
  AUTOCOMPLETE: boolean;
  CACHE_SIZE: number;
  USERAGENT: string;
  COLORS: {
    MAIN: number,
    PAUSE: number;
  };
}