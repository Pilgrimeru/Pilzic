import { Player } from "@core/Player";
import type { Playlist } from "@core/Playlist";
import type { Track } from "@core/Track";
import { joinVoiceChannel, VoiceConnection } from "@discordjs/voice";
import { autoDelete } from "@utils/autoDelete";
import {
  BaseGuildTextChannel,
  Collection,
  type VoiceBasedChannel,
} from "discord.js";
import { i18n } from "i18n.config";

export class PlayerManager {
  private readonly players: Collection<string, Player> = new Collection();

  public enqueue(
    item: Track | Playlist,
    textChannel: BaseGuildTextChannel,
    voiceChannel: VoiceBasedChannel,
  ): void {
    const player = this.getOrCreatePlayer(textChannel, voiceChannel);
    if (!player) return;
    player.queue.enqueue(item);
  }

  public insert(
    item: Track | Playlist,
    textChannel: BaseGuildTextChannel,
    voiceChannel: VoiceBasedChannel,
  ): void {
    const player = this.getOrCreatePlayer(textChannel, voiceChannel);
    if (!player) return;
    player.queue.insert(item);
  }

  private getOrCreatePlayer(
    textChannel: BaseGuildTextChannel,
    voiceChannel: VoiceBasedChannel,
  ): Player | null {
    let player = this.players.get(textChannel.guildId);

    if (!player) {
      let connection: VoiceConnection | undefined;

      try {
        connection = this.connectToVoiceChannel(voiceChannel);
      } catch (error) {
        console.error("Exception while joining voice channel:", error);
        textChannel.send(i18n.__("errors.notChannel")).then(autoDelete)
        return null;
      }

      player = new Player({
        textChannel,
        connection,
      });
      this.players.set(textChannel.guildId, player);
    }

    return player;
  }

  private connectToVoiceChannel(
    voiceChannel: VoiceBasedChannel,
  ): VoiceConnection {
    return joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
    });
  }

  public removePlayer(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      this.players.delete(guildId);
    }
  }

  public getPlayer(guildId: string): Player | null {
    return this.players.get(guildId) ?? null;
  }
}
