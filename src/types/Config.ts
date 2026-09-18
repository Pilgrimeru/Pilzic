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
  YOUTUBE_COOKIES_PATH?: string;
  YOUTUBE_MAX_RETRIES: number;
  COLORS: {
    MAIN: number;
    PAUSE: number;
  };
}
