import { VoiceState } from "discord.js";
import { config } from "../config.js";
import { bot } from "../index.js";
import { Event } from "../types/Event.js";

export default new Event("voiceStateUpdate", async (voice: VoiceState) => {
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
});

