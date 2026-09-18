import { Event } from "@custom-types/Event";
import { config } from "config";
import { VoiceState } from "discord.js";
import { bot } from "index";

const guildTimers = new Map<string, ReturnType<typeof setTimeout>>();

export default new Event("voiceStateUpdate", async (voice: VoiceState) => {
  if (config.STAY_TIME === 0) return;
  const existingTimer = guildTimers.get(voice.guild.id);
  if (existingTimer) clearTimeout(existingTimer);
  const timer = setTimeout(() => {
    guildTimers.delete(voice.guild.id);
    const clientChannel = voice.guild.members.me!.voice.channelId;
    const channel = clientChannel
      ? voice.guild.channels.cache.get(clientChannel)
      : undefined;
    if (channel?.isVoiceBased()) {
      const hasListener = channel.members.some((member) => !member.user.bot);
      if (!hasListener) {
        const player = bot.playerManager.getPlayer(voice.guild.id);
        void player?.leave();
      }
    }
  }, config.STAY_TIME * 1000);
  guildTimers.set(voice.guild.id, timer);
});
