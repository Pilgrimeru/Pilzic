import { Event } from "@custom-types/Event";
import { config } from "config";
import { VoiceState } from "discord.js";
import { bot } from "index";

export default new Event("voiceStateUpdate", async (voice: VoiceState) => {
  if (config.STAY_TIME === 0) return;
  setTimeout(() => {
    const clientChannel = voice.guild.members.me!.voice.channelId;
    if (voice.channel?.id === clientChannel) {
      const nbUser = voice.channel.members.filter((member) => !member.user.bot);
      if (nbUser?.size === 0) {
        const player = bot.playerManager.getPlayer(voice.guild.id);
        player?.leave();
      }
    }
  }, config.STAY_TIME * 1000);
});
