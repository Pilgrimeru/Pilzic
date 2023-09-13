import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, InteractionResponse, Message } from "discord.js";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Song } from "../components/Song";
import { Command, CommandConditions } from "../types/Command";

export default class QueueCommand extends Command {
  constructor() {
    super({
      name: "queue",
      aliases: ["q"],
      description: i18n.__("queue.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS
      ],
    })
  }
  
  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    const player = bot.players.get(commandTrigger.guild!.id)!;
    player.queue.songs.slice(player.queue.index)

    const followingSongs = player.queue.songs.slice(player.queue.index);
    const previousSongs = player.queue.songs.slice(0, player.queue.index);

    const embeds = generateQueueEmbed(commandTrigger, followingSongs, previousSongs);

    let currentPage = Math.ceil(previousSongs.length / 10);
    const wantedPage = Number(args[0]);
    if (!isNaN(wantedPage) && wantedPage > 0 && wantedPage <= embeds.length) {
      currentPage = wantedPage - 1;
    }

    let response: Message | InteractionResponse;

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
      commandTrigger.reply(error).catch(console.error);
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
      if (config.PRUNING) {
        response.delete().catch(() => null);
      } else {
        response.edit({ components: [] });
      }
    });
  }
};

function generateQueueEmbed(commandTrigger: CommandInteraction | Message, followingSongs: Song[], previousSongs: Song[]) : EmbedBuilder[] {
  let embeds: EmbedBuilder[] = [];

  previousSongs.reverse();
  for (let i = 0; i < previousSongs.length; i += 10) {
    const current = previousSongs.slice(i, i + 10);
    let j = -i - 1;

    const info = current.map((track) => `${j--} - [${track.title}](${track.url})`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(commandTrigger.guild?.iconURL()!)
      .setColor("#69adc7")
      .setDescription(
        i18n.__mf("queue.embedCurrentSong", { title: followingSongs[0].title, url: followingSongs[0].url, info: info })
      )
      .setTimestamp();
    embeds.push(embed);
  }
  embeds.reverse();

  if (followingSongs.length === 1) {
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(commandTrigger.guild?.iconURL()!)
      .setColor("#69adc7")
      .setDescription(
        i18n.__mf("queue.embedCurrentSong", { title: followingSongs[0].title, url: followingSongs[0].url, info: i18n.__mf("queue.nothingMore") })
      )
      .setTimestamp();
    embeds.push(embed);
  }

  for (let i = 1; i < followingSongs.length; i += 10) {
    const current = followingSongs.slice(i, i + 10);
    let j = i;

    const info = current.map((track) => `${j++} - [${track.title}](${track.url})`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(commandTrigger.guild?.iconURL()!)
      .setColor("#69adc7")
      .setDescription(
        i18n.__mf("queue.embedCurrentSong", { title: followingSongs[0].title, url: followingSongs[0].url, info: info })
      )
      .setTimestamp();
    embeds.push(embed);
  }

  return embeds;
};