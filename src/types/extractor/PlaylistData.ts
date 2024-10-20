import type { TrackData } from "./TrackData";

export interface PlaylistData {
    title: string;
    url: string;
    songs: TrackData[];
    duration: number;
}