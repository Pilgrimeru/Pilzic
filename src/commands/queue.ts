import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Track } from '@core/Track';
import { Command, CommandConditions } from '@custom-types/Command';
import { config } from 'config';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, Message } from 'discord.js';
import { i18n } from 'i18n.config';
import { bot } from 'index';

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
    player.queue.tracks.slice(player.queue.index);

    const followingTracks = player.queue.tracks.slice(player.queue.index);
    const previousTracks = player.queue.tracks.slice(0, player.queue.index);

    const embeds = generateQueueEmbed(commandTrigger.guild, followingTracks, previousTracks);

    let currentPage = Math.ceil(previousTracks.length / 10);
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

function generateQueueEmbed(guild: Guild, followingTracks: Track[], previousTracks: Track[]): EmbedBuilder[] {
  let embeds: EmbedBuilder[] = [];

  function buildEmbed(info: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(guild.iconURL())
      .setColor(config.COLORS.MAIN)
      .setDescription(
        i18n.__mf("queue.embedCurrentTrack", { title: followingTracks[0].title, url: followingTracks[0].url, info: info })
      )
      .setTimestamp();
  }

  previousTracks.reverse();
  let current: Track[];
  for (let i = 0; i < previousTracks.length; i += 10) {
    current = previousTracks.slice(i, i + 10);
    let j = -i - 1;

    const info = current.map((track) => `${j--} - [${track.title}](${track.url})`).join("\n");

    embeds.push(buildEmbed(info));
  }
  embeds.reverse();

  if (followingTracks.length === 1) {
    embeds.push(buildEmbed(i18n.__mf("queue.nothingMore")));
  }

  for (let i = 1; i < followingTracks.length; i += 10) {
    current = followingTracks.slice(i, i + 10);
    let j = i;

    const info = current.map((track) => `${j++} - [${track.title}](${track.url})`).join("\n");

    embeds.push(buildEmbed(info));
  }

  return embeds;
}