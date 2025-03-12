import type { TrackData } from "./TrackData";

export interface PlaylistData {
  title: string;
  url: string;
  tracks: TrackData[];
  duration: number;
}
