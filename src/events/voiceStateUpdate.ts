import { VoiceState } from "discord.js";
import { config } from "../config";
import { bot } from "../index";

export default {
  event: "voiceStateUpdate",
  run(voice: VoiceState) {
    setTimeout(() => {
      let voiceChannel = voice.channel;
      let botChannel = voice.guild.members.me!.voice.channelId;
      if (voiceChannel?.id === botChannel) {
        let nbUser = voiceChannel?.members.filter(
          (member) => !member.user.bot
        );
        if (nbUser?.size === 0) {
          const player = bot.players.get(voice.guild.id);
          player?.stop();
        }
      }
    }, config.STAY_TIME);
  }
};
