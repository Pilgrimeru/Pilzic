import { Player } from '@core/Player';
import { Track } from '@core/Track';
import { config } from 'config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
} from "discord.js";
import { i18n } from 'i18n.config';

export class NowPlayingMsgManager {

  private msg: Message | undefined;
  private track: Track | undefined;
  private readonly player: Player;
  private state: "play" | "pause";

  constructor(player: Player) {
    this.player = player;
    this.state = "play";
  }

  public async send(track: Track): Promise<void> {
    if (this.msg) await this.clear();
    this.track = track;

    const embed = this.buildPlayingEmbed(track, "▶");
    this.msg = await this.player.textChannel.send({
      embeds: [embed],
      components: [this.buildButtons()]
    });
  }

  public async update(): Promise<void> {
    if (!this.msg || !this.msg.editable || !this.track) return;

    const currentState = this.getPlayerState();
    if (this.state === currentState) return;

    this.state = currentState;

    const embed = this.buildPlayingEmbed(this.track, currentState === "pause" ? "❚❚" : "▶");
    await this.msg.edit({
      embeds: [embed],
      components: [this.buildButtons()]
    });
  }

  public async clear(): Promise<void> {
    if (!this.msg) return;
    try {
      if (config.AUTO_DELETE) {
        await this.msg.delete().catch(() => null);
      } else {
        await this.msg.edit({ components: [] });
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.msg = undefined;
    }
  }
  

  private getPlayerState(): "play" | "pause" {
    const isPaused = this.player.status === "paused" || this.player.status === "autopaused";
    return isPaused ? "pause" : "play";
  }

  private buildPlayingEmbed(track: Track, emoji: string): EmbedBuilder {
    return new EmbedBuilder({
      title: `${emoji}  ${i18n.__("nowplayingMsg.startedPlaying")}`,
      description: `[${track.title}](${track.url})\n${i18n.__mf("nowplayingMsg.duration", { duration: track.formatedTime() })}`,
      thumbnail: {
        url: track.thumbnail
      },
      color: this.state === "pause" ? config.COLORS.PAUSE : config.COLORS.MAIN,
      footer: {
        text: i18n.__mf("nowplayingMsg.requestedBy", { name: track.requester?.displayName ?? "unknown" }),
        icon_url: track.requester?.avatarURL() ?? undefined
      }
    });
  }

  private buildButtons(): ActionRowBuilder<ButtonBuilder> {
    const isPaused = this.getPlayerState() === "pause";

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("cmd-stop")
        .setEmoji("⏹")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cmd-previous")
        .setEmoji("⏮")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!this.player.queue.canBack()),

      new ButtonBuilder()
        .setCustomId(isPaused ? "cmd-resume" : "cmd-pause")
        .setEmoji(isPaused ? '▶️' : '⏸️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cmd-skip")
        .setEmoji("⏭")
        .setStyle(ButtonStyle.Secondary)
    );
  }
}