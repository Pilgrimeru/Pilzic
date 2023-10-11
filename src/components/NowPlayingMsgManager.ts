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
import { autoDelete } from "../utils/autoDelete";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";
import { CommandTrigger } from "./CommandTrigger";
import { Player } from "./Player";
import { Song } from "./Song";


export class NowPlayingMsgManager {

  private msg: Promise<Message> | undefined;
  private song: Song;
  private collector: InteractionCollector<any>;
  private player: Player;
  private state: "play" | "pause";


  constructor(player: Player) {
    this.player = player;
    this.state = "play";
  }


  public async send(song: Song): Promise<void> {
    if (this.msg) await this.delete();
    this.song = song;
    const embed = this.song.playingEmbed();
    this.msg = this.player.textChannel.send({
      embeds: [embed.setTitle(`▶  ${embed.data.title}`)],
      components: [this.buildButtons()]
    });
    await this.createCollector();
  }

  public async delete(): Promise<void> {
    if (!this.msg) return;
    try {
      await this.msg;
      this.collector?.stop();
    } catch (error) {
      console.error(error);
    } finally {
      this.msg = undefined;
    }
  }

  public async edit(): Promise<void> {
    if (!this.msg || !(await this.msg).editable) return;
    const playerPaused = this.player.status === "paused" || this.player.status === "autopaused";

    if (!playerPaused && this.player.status !== "playing") return;
    if (this.state === "pause" && playerPaused) return;
    if (this.state === "play" && !playerPaused) return;

    const color = playerPaused ? config.COLORS.PAUSE : config.COLORS.MAIN;
    const emoji = playerPaused ? "❚❚" : "▶";
    this.state = playerPaused ? "pause" : "play";

    const embed = this.song.playingEmbed().setColor(color);
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
    const message = await this.msg;
    const channel = this.player.textChannel;
    this.collector = message.createMessageComponentCollector();

    this.collector.on("collect", async (b: ButtonInteraction) => {
      const command = bot.commands.get(b.customId);
      if (!command) return;
      const interactUser = await channel.guild.members.fetch(b.user);

      const canWrite = channel.permissionsFor(interactUser).has(PermissionsBitField.Flags.SendMessages, true);
      const checkConditionsResult = checkConditions(command, interactUser);
      const checkPermissionsResult = checkPermissions(command, interactUser);

      if (!canWrite) await b.reply(i18n.__("nowplayingMsg.errorWritePermission"));
      else if (checkConditionsResult !== "passed") await b.reply(checkConditionsResult).then(autoDelete);
      else if (checkPermissionsResult !== "passed") await b.reply(checkPermissionsResult).then(autoDelete);

      if (b.replied) return;

      command.execute(new CommandTrigger(b));
    });

    this.collector.on("end", () => {

      if (config.AUTO_DELETE) {
        message.delete().catch(() => null);
      } else {
        message.edit({ components: [] });
      }
    });
  }
}