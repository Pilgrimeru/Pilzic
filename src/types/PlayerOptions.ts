import type { VoiceConnection } from "@discordjs/voice";
import type { BaseGuildTextChannel } from "discord.js";

export interface PlayerOptions {
  textChannel: BaseGuildTextChannel;
  connection: VoiceConnection;
}
