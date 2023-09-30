import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  InteractionCollector,
  Message,
  PermissionsBitField
} from "discord.js";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";
import { Player } from "./Player";
import { Song } from "./Song";


export class NowPlayingMsgManager {

  private msg: Message | undefined;
  private song: Song;
  private collector: InteractionCollector<any>;
  private player: Player;
  private state: "play" | "pause" = "play";


  constructor(player: Player) {
    this.player = player;
  }


  public async send(song: Song): Promise<void> {
    if (this.msg) await this.delete();
    this.song = song;
    const embed = this.song.playingEmbed();
    this.msg = await this.player.textChannel.send({
      embeds: [embed.setTitle(`▶  ${embed.data.title}`)],
      components: [this.buildButtons()]
    });
    await this.createCollector();
  }

  public async delete(): Promise<void> {
    if (!this.msg) return;
    try {
      this.collector.stop();
    } catch (error) {
      console.error(error);
    } finally {
      this.msg = undefined;
    }
  }

  public edit(): void {
    if (!this.msg || !this.msg.editable) return;
    const playerPaused = this.player.status === "paused" || this.player.status === "autopaused";

    if (!playerPaused && this.player.status !== "playing") return;
    if (this.state === "pause" && playerPaused) return;
    if (this.state === "play" && !playerPaused) return;

    const color = playerPaused ? 0xd13939 : 0x69adc7;
    const emoji = playerPaused ? "❚❚" : "▶";
    this.state = playerPaused ? "pause" : "play";

    const embed = this.song.playingEmbed().setColor(color);
    embed.setTitle(`${emoji}  ${embed.data.title}`);

    this.msg.edit({
      embeds: [embed],
      components: [this.buildButtons()]
    });
  }


  private buildButtons(): ActionRowBuilder<ButtonBuilder> {
    const isPaused = this.player.status === "paused" || this.player.status === "autopaused";

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("stop")
        .setEmoji("⏹")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("previous")
        .setEmoji("⏮")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!this.player.queue.canBack()),

      new ButtonBuilder()
        .setCustomId(isPaused ? "resume" : "pause")
        .setEmoji(isPaused ? '▶️' : '⏸️')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("skip")
        .setEmoji("⏭")
        .setStyle(ButtonStyle.Secondary)
    );
    return row;
  }

  private async createCollector(): Promise<void> {
    if (!this.msg) return;
    const channel = this.player.textChannel;
    this.collector = this.msg.createMessageComponentCollector();

    this.collector.on("collect", async (b: ButtonInteraction) => {
      const interactUser = await channel.guild.members.fetch(b.user);
      const command = bot.commands.get(b.customId);
      if (!command) return;

      const canWrite = channel.permissionsFor(interactUser).has(PermissionsBitField.Flags.SendMessages, true);
      const checkConditionsResult = checkConditions(command, interactUser);
      const checkPermissionsResult = checkPermissions(command, interactUser);

      if (!canWrite) await b.reply(i18n.__("nowplayingMsg.errorWritePermission"));
      else if (checkConditionsResult !== "passed") await b.reply(checkConditionsResult);
      else if (checkPermissionsResult !== "passed") await b.reply(checkPermissionsResult);

      if (b.replied) return;

      command.execute(b);
    });

    this.collector.on("end", () => {

      if (config.PRUNING) {
        this.msg?.delete().catch(() => null);
      } else {
        this.msg?.edit({ components: [] });
      }
    });
  }
}