export interface TrackData {
    url: string;
    title: string;
    duration: number;
    thumbnail: string | null;
    related?: string[];
  }