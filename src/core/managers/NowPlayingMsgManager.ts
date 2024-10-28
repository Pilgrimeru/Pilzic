import { Player } from '@core/Player';
import { Track } from '@core/Track';
import { config } from 'config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from "discord.js";

export class NowPlayingMsgManager {

  private msg: Promise<Message> | undefined;
  private track: Track | undefined;
  private player: Player;
  private state: "play" | "pause";

  constructor(player: Player) {
    this.player = player;
    this.state = "play";
  }

  public async send(track: Track): Promise<void> {
    if (this.msg) await this.delete();
    this.track = track;
    const embed = this.track.playingEmbed();
    this.msg = this.player.textChannel.send({
      embeds: [embed.setTitle(`▶  ${embed.data.title}`)],
      components: [this.buildButtons()]
    });
  }

  public async delete(): Promise<void> {
    if (!this.msg) return;
    try {
      const message = await this.msg;
      if (config.AUTO_DELETE) {
        message.delete().catch(() => null);
      } else {
        message.edit({ components: [] });
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.msg = undefined;
    }
  }

  public async edit(): Promise<void> {
    if (!this.msg || !(await this.msg).editable || !this.track) return;
    const playerPaused = this.player.status === "paused" || this.player.status === "autopaused";

    if (!playerPaused && this.player.status !== "playing") return;
    if (this.state === "pause" && playerPaused) return;
    if (this.state === "play" && !playerPaused) return;

    const color = playerPaused ? config.COLORS.PAUSE : config.COLORS.MAIN;
    const emoji = playerPaused ? "❚❚" : "▶";
    this.state = playerPaused ? "pause" : "play";

    const embed = this.track.playingEmbed().setColor(color);
    embed.setTitle(`${emoji}  ${embed.data.title}`);

    (await this.msg).edit({
      embeds: [embed],
      components: [this.buildButtons()]
    });
  }


  private buildButtons(): ActionRowBuilder<ButtonBuilder> {
    const isPaused = this.player.status === "paused" || this.player.status === "autopaused";

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
    return row;
  }
}