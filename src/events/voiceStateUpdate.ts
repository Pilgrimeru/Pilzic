import { VoiceState } from "discord.js";
import { config } from "../config";
import { bot } from "../index";

export default {
  event: "voiceStateUpdate",
  run(voice: VoiceState) {
    setTimeout(() => {
      const clientChannel = voice.guild.members.me!.voice.channelId;
      if (voice.channel?.id === clientChannel) {
        let nbUser = voice.channel.members.filter(
          (member) => !member.user.bot
        );
        if (nbUser?.size === 0) {
          const player = bot.players.get(voice.guild.id);
          player?.leave();
        }
      }
    }, config.STAY_TIME * 1000);
  }
};
