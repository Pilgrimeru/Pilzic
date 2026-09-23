import type { Player } from "@core/Player";
import type { Track } from "@core/Track";
import { config } from "config";
import type { Message } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { i18n } from "i18n.config";

export class NowPlayingMsgManager {
  private msg: Message | undefined;
  private track: Track | undefined;
  private readonly player: Player;
  private state: "play" | "pause";
  private revision = 0;
  private updateTask: Promise<void> = Promise.resolve();

  constructor(player: Player) {
    this.player = player;
    this.state = "play";
  }

  public async send(track: Track): Promise<void> {
    const revision = ++this.revision;
    const previous = this.msg;
    this.msg = undefined;
    if (previous) {
      await this.updateTask;
      await this.retire(previous);
    }
    if (revision !== this.revision) return;
    this.track = track;
    this.state = this.getPlayerState();

    const embed = this.buildPlayingEmbed(track, "▶");
    const sent = await this.player.textChannel.send({
      embeds: [embed],
      components: [this.buildButtons()],
    });
    if (revision !== this.revision) {
      await sent.edit({ components: [] }).catch(() => undefined);
      return;
    }
    this.msg = sent;
  }

  public async update(): Promise<void> {
    const message = this.msg;
    const track = this.track;
    if (!message || !message.editable || !track) return;
    const currentState = this.getPlayerState();
    if (this.state === currentState) return;
    this.state = currentState;
    const task = this.updateTask.then(async () => {
      if (this.msg !== message) return;
      const embed = this.buildPlayingEmbed(
        track,
        currentState === "pause" ? "❚❚" : "▶",
      );
      await message.edit({
        embeds: [embed],
        components: [this.buildButtons()],
      });
    });
    this.updateTask = task.catch(console.error);
    return task;
  }

  public async clear(): Promise<void> {
    this.revision++;
    const message = this.msg;
    this.msg = undefined;
    this.track = undefined;
    if (message) {
      await this.updateTask;
      await this.retire(message);
    }
  }

  private async retire(message: Message): Promise<void> {
    try {
      if (config.AUTO_DELETE) {
        await message.delete().catch(() => null);
      } else {
        await message.edit({ components: [] });
      }
    } catch (error) {
      console.error(error);
    }
  }

  private getPlayerState(): "play" | "pause" {
    const isPaused =
      this.player.status === "paused" || this.player.status === "autopaused";
    return isPaused ? "pause" : "play";
  }

  private buildPlayingEmbed(track: Track, emoji: string): EmbedBuilder {
    return new EmbedBuilder({
      title: `${emoji}  ${i18n.__("nowplayingMsg.startedPlaying")}`,
      description: `[${track.title}](${track.url})\n${i18n.__mf("nowplayingMsg.duration", { duration: track.formatedTime() })}`,
      thumbnail: {
        url: track.thumbnail,
      },
      color: this.state === "pause" ? config.COLORS.PAUSE : config.COLORS.MAIN,
      footer: {
        text: i18n.__mf("nowplayingMsg.requestedBy", {
          name: track.requester?.displayName ?? "unknown",
        }),
        icon_url: track.requester?.avatarURL() ?? undefined,
      },
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
        .setEmoji(isPaused ? "▶️" : "⏸️")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cmd-skip")
        .setEmoji("⏭")
        .setStyle(ButtonStyle.Secondary),
    );
  }
}
