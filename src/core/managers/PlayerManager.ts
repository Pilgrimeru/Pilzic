import { joinVoiceChannel, VoiceConnection } from "@discordjs/voice";
import { BaseGuildTextChannel, Collection, type VoiceBasedChannel } from "discord.js";
import { Player } from "../Player";
import type { Playlist } from "../Playlist";
import type { Track } from "../Track";

export class PlayerManager {
  private players: Collection<string, Player> = new Collection();

  public enqueue(item: Track | Playlist, textChannel: BaseGuildTextChannel, voiceChannel: VoiceBasedChannel): void {
    const player = this.getOrCreatePlayer(textChannel, voiceChannel);
    player.queue.enqueue(item);
}

public insert(item: Track | Playlist, textChannel: BaseGuildTextChannel, voiceChannel: VoiceBasedChannel): void {
    const player = this.getOrCreatePlayer(textChannel, voiceChannel);
    player.queue.insert(item);
}

private getOrCreatePlayer(textChannel: BaseGuildTextChannel, voiceChannel: VoiceBasedChannel): Player {
    let player = this.players.get(textChannel.guildId);

    if (!player) {
        const connection = this.connectToVoiceChannel(voiceChannel);
        player = new Player({
            textChannel,
            connection,
        });
        this.players.set(textChannel.guildId, player);
    }

    return player;
}

private connectToVoiceChannel(voiceChannel: VoiceBasedChannel): VoiceConnection {
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
