import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, Message } from "discord.js";
import { config } from "../config.js";
import { CommandTrigger } from "../core/helpers/CommandTrigger.js";
import { Track } from "../core/Track.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";

export default class QueueCommand extends Command {
  constructor() {
    super({
      name: "queue",
      aliases: ["q"],
      description: i18n.__("queue.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;
    player.queue.songs.slice(player.queue.index);

    const followingSongs = player.queue.songs.slice(player.queue.index);
    const previousSongs = player.queue.songs.slice(0, player.queue.index);

    const embeds = generateQueueEmbed(commandTrigger.guild, followingSongs, previousSongs);

    let currentPage = Math.ceil(previousSongs.length / 10);
    const wantedPage = Number(args[0]);
    if (!isNaN(wantedPage) && wantedPage > 0 && wantedPage <= embeds.length) {
      currentPage = wantedPage - 1;
    }

    let response: Message;
    try {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(

        new ButtonBuilder().setCustomId("previous").setEmoji('⬅️').setStyle(ButtonStyle.Secondary),

        new ButtonBuilder().setCustomId("next").setEmoji('➡️').setStyle(ButtonStyle.Secondary),

        new ButtonBuilder().setCustomId("close").setEmoji('❌').setStyle(ButtonStyle.Secondary),
      );

      response = await commandTrigger.reply({
        content: `**${i18n.__mf("queue.currentPage")} ${currentPage + 1}/${embeds.length}**`,
        embeds: [embeds[currentPage]],
        components: [row]
      });

    } catch (error: any) {
      console.error(error);
      return;
    }

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (q) => {
      if (q.customId === "previous") {
        if (currentPage !== 0) {
          currentPage--;
          response.edit({
            content: `**${i18n.__mf("queue.currentPage")} ${currentPage + 1}/${embeds.length}**`,
            embeds: [embeds[currentPage]]
          });
        }
      }
      if (q.customId === "next") {
        if (currentPage < embeds.length - 1) {
          currentPage++;
          response.edit({
            content: `**${i18n.__mf("queue.currentPage")} ${currentPage + 1}/${embeds.length}**`,
            embeds: [embeds[currentPage]]
          });
        }
      }
      if (q.customId === "close") {
        collector.stop();
      }

      await q.deferUpdate();
    });

    collector.on("end", async () => {
      if (config.AUTO_DELETE) {
        commandTrigger.deleteReply();
      } else {
        response.edit({ components: [] });
      }
    });
  }
}

function generateQueueEmbed(guild: Guild, followingSongs: Track[], previousSongs: Track[]): EmbedBuilder[] {
  let embeds: EmbedBuilder[] = [];

  function buildEmbed(info: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(guild.iconURL())
      .setColor(config.COLORS.MAIN)
      .setDescription(
        i18n.__mf("queue.embedCurrentSong", { title: followingSongs[0].title, url: followingSongs[0].url, info: info })
      )
      .setTimestamp();
  }

  previousSongs.reverse();
  let current: Track[];
  for (let i = 0; i < previousSongs.length; i += 10) {
    current = previousSongs.slice(i, i + 10);
    let j = -i - 1;

    const info = current.map((track) => `${j--} - [${track.title}](${track.url})`).join("\n");

    embeds.push(buildEmbed(info));
  }
  embeds.reverse();

  if (followingSongs.length === 1) {
    embeds.push(buildEmbed(i18n.__mf("queue.nothingMore")));
  }

  for (let i = 1; i < followingSongs.length; i += 10) {
    current = followingSongs.slice(i, i + 10);
    let j = i;

    const info = current.map((track) => `${j++} - [${track.title}](${track.url})`).join("\n");

    embeds.push(buildEmbed(info));
  }

  return embeds;
}