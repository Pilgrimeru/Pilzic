import axios from "axios";
import { so_validate, sp_validate, yt_validate } from "play-dl";


export type UrlType = "yt_video"| "yt_playlist" | "so_track"| 
  "so_playlist" | "sp_track" | "sp_playlist" | "sp_album" |
  "sp_artist" | "dz_track" | "dz_album" | "dz_playlist" |
  "audio" | "yt_search" | false;



export async function validate(url: string): Promise<UrlType> {
  const YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;
  const SO_LINK = /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(api\.soundcloud\.com|soundcloud\.com|snd\.sc)\/.+$/;
  const SP_LINK = /^https?:\/\/(?:open|play)\.spotify\.com\/?.+/;
  const DZ_LINK = /^https?:\/\/(?:www\.)?(?:deezer\.com|deezer\.page\.link)\/?.+/;
  const AUDIO_LINK = /^https?:\/\/.+\.(mp3|wav|flac|ogg)$/;

  if (!url.startsWith("http")) return "yt_search";
  let check;
  if (url.match(YT_LINK)) {
    check = yt_validate(url);
    return check !== false ? ('yt_' + check) as "yt_playlist" | "yt_video" | "yt_search": false;
  }
  if (url.match(SO_LINK)) {
    check = await so_validate(url);
    return check !== false ? ('so_' + check) as "so_track"| "so_playlist" : false;
  }
  if (url.match(SP_LINK)) {
    check = sp_validate(url);
    let type = check !== false ? ('sp_' + check) : false;
    if (type) return type as "sp_track" | "sp_playlist" | "sp_album";
    const SP_ARTIST = /^https?:\/\/(?:open|play)\.spotify\.com\/artist\/?.+/;
    if (url.match(SP_ARTIST)) return "sp_artist";
    return false;
  }
  if (url.match(DZ_LINK)) {
    let r = await axios.head(url).catch(() => null);
    if (!r) return false;
    let patch = r.request?.socket?._httpMessage?.path;
    if (!patch) return false;
    if (patch.match(/^\/(?:\w{2})\/track/)) return "dz_track";
    if (patch.match(/^\/(?:\w{2})\/album/)) return "dz_album";
    if (patch.match(/^\/(?:\w{2})\/playlist/)) return "dz_playlist";
    return false;
  }

  if (url.match(AUDIO_LINK)) {
    return "audio";
  }
  return false;
}