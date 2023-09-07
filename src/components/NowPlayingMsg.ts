import { AudioPlayerStatus } from "@discordjs/voice";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionCollector,
  Message,
  PermissionsBitField
} from "discord.js";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { purning } from "../utils/purning";
import { Player } from "./Player";
import { Song } from "./Song";


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
    let pauseEmoji = '⏸️';
    if (this.player.status === "paused" || this.player.status === "autopaused") {
      pauseEmoji = '▶️';
    }

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
        .setCustomId("pause")
        .setEmoji(pauseEmoji)
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

    this.collector.on("collect", async (b) => {
      const interactUser = await channel.guild.members.fetch(b.user);
      const canWrite = channel.permissionsFor(interactUser).has(PermissionsBitField.Flags.SendMessages, true);

      if (interactUser.voice.channelId === interactUser.guild.members.me!.voice.channelId) {
        if (b.customId === "stop" && canWrite) {
          this.player.stop();
          channel.send(i18n.__("stop.result")).then(purning);
        }
        else if (b.customId === "skip" && canWrite) {
          this.player.skip();
        }
        if (b.customId === "previous" && canWrite) {
          this.player.previous();
        }
        if (b.customId === "pause" && canWrite) {
          if (this.player.status == AudioPlayerStatus.Playing) {
            this.player.pause();
            this.edit();
            channel.send(i18n.__mf("pause.result")).then(purning);
          } else {
            this.player.resume();
            this.edit();
            channel.send(i18n.__mf("resume.result")).then(purning);
          }
        }
      } else {
        channel.send(i18n.__("errors.notInSameChannel"))
          .then(purning);
      }
      await b.deferUpdate();
    });

    this.collector.on("end", () => {

      if (config.PRUNING) {
        this.msg.delete().catch(() => null);
      } else {
        this.msg.edit({
          embeds: [{
            description: this.msg.embeds[0].description!,
            thumbnail: this.msg.embeds[0].thumbnail!,
            color: 0x69adc7
          }],
          components: []
        });
      }
    });
  }
}