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
import { Player } from "./Player";
import { Song } from "./Song";
import { bot } from "../index";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";


export class nowPlayingMsg {

  private msg : Message;
  private song : Song;
  private collector : InteractionCollector<any>;
  private player : Player;


  constructor(player : Player) {
    this.player = player;
  }


  public async send(song: Song) : Promise<void> {
    this.song = song;
    const embed = this.song.playingEmbed();
    this.msg = await this.player.textChannel.send({
      embeds: [embed.setTitle(`▶  ${embed.data.title}`)],
      components: [this.buildButtons()]
    });
    await this.createCollector();
  }

  public stop() : void {
    try {
      this.collector.stop();
    } catch (error) {
      console.error(error);
    }
  }


  private edit() {
    if (!this.msg) return;

    let color = 0x69adc7;
    let emoji = "▶";
    if (this.player.status === "paused" || this.player.status === "autopaused") {
      color = 0xd13939;
      emoji = "❚❚"
    }

    const embed = this.song.playingEmbed().setColor(color);
    embed.setTitle(`${emoji}  ${embed.data.title}`);

    this.msg.edit({
      embeds: [embed],
      components: [this.buildButtons()]
    });
  }

  private buildButtons() : ActionRowBuilder<ButtonBuilder> {
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

  private async createCollector() : Promise<void>{
    const channel = this.player.textChannel;
    this.collector =  this.msg.createMessageComponentCollector();

    this.collector.on("collect", async (b : ButtonInteraction) => {
      const interactUser = await channel.guild.members.fetch(b.user);
      const command = bot.commands.get(b.customId);
      if (!command) return;

      const canWrite = channel.permissionsFor(interactUser).has(PermissionsBitField.Flags.SendMessages, true);
      if (!canWrite) b.reply(i18n.__("nowplayingMsg.errorWritePermission"));
      const checkConditionsResult = checkConditions(command, interactUser);
      if (checkConditionsResult !== "passed") b.reply(checkConditionsResult);
      const checkPermissionsResult = checkPermissions(command, interactUser);
      if (checkPermissionsResult !== "passed")  b.reply(checkPermissionsResult);

      if (b.replied) return;

      command.execute(b);
      if (b.customId === "pause" || b.customId === "resume") this.edit();

    });

    this.collector.on("end", () => {

      if (config.PRUNING) {
        this.msg.delete().catch(() => null);
      } else {
        this.msg.edit({ components: [] });
      }
    });
  }
}