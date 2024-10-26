import { VoiceConnection } from '@discordjs/voice';
import { BaseGuildTextChannel } from 'discord.js';

export interface PlayerOptions {
  textChannel: BaseGuildTextChannel;
  connection: VoiceConnection;
}
