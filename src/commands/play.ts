import { DiscordGatewayAdapterCreator, joinVoiceChannel } from "@discordjs/voice";
import { ApplicationCommandOptionType, BaseGuildTextChannel, CommandInteraction, Message, PermissionsBitField } from "discord.js";
import { ExtractionError } from "../errors/ExtractionErrors";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Player } from "../components/Player";
import { Playlist } from "../components/Playlist";
import { Song } from "../components/Song";
import { purning } from "../utils/purning";
import { validate } from "../utils/validate";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "play",
  aliases: ["p"],
  description: i18n.__("play.description"),
  options: [
    {
      name: "query",
      description: "url or search.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "playlist",
      description: "true if it's a playlist search.",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  permissions: [
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
  ],
  conditions:[
    CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL,
    CommandConditions.CAN_BOT_SPEAK
  ],
  async execute(commandTrigger: CommandInteraction | Message, args: string[]) : Promise<void> {

    const isSlashCommand = (commandTrigger instanceof CommandInteraction);

    if (!args.length && (isSlashCommand || !isSlashCommand && !(commandTrigger.attachments.size)))
      return commandTrigger.reply(i18n.__mf("insert.usageReply", { prefix: bot.prefix })).then(purning);

    let playlistResearch = false;
    if (!isSlashCommand && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      playlistResearch = true;
    } else if (isSlashCommand && args.at(-1) === "true") {
      args.slice(args.length-1);
      playlistResearch = true;
    } else if (isSlashCommand && args.at(-1) === "false") {
      args.slice(args.length-1);
    }

    const response = await commandTrigger.reply(i18n.__mf("common.loading"));

    const url = (!isSlashCommand && !args.length) ? commandTrigger!.attachments.first()?.url! : args[0];
    const type: string | false = await validate(url);
    const search = args.join(" ");

    try {
      let item : Song | Playlist;
      if (type.toString().match(/playlist|album|artist/) || (type === false && playlistResearch)) {
        response.edit(i18n.__mf("play.fetchingPlaylist")).catch(() => null);
        item = (await Playlist.from(url, search, type))
        
      } else {
        item = (await Song.from(url, search, type));
      }
      const guildMember = isSlashCommand ? commandTrigger.guild!.members.cache.get(commandTrigger.user.id): commandTrigger.member;
      const { channel } = guildMember!.voice;
      if (!channel) return;
      const player = bot.players.get(commandTrigger.guildId!) ?? new Player({
        textChannel: (commandTrigger.channel as BaseGuildTextChannel),
        connection: joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
        })
      })
      player.queue.enqueue(item);
      response.delete().catch(() => null);
      
    } catch (error) {
      if (error instanceof ExtractionError) {
        return response.edit(i18n.__(error.i18n())).then(purning);
      }
      console.error(error);
      return response.edit(i18n.__("errors.command")).then(purning);
    }
  }
};