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
  name: "insert",
  description: i18n.__("insert.description"),
  options: [
    {
      name: "query",
      description: "url or search.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "playlist",
      description: "if is a playlist search",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  permissions: [
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    const isSlashCommand = (commandTrigger instanceof CommandInteraction);

    if (!args.length && (isSlashCommand || !isSlashCommand && !(commandTrigger.attachments.size)))
      return commandTrigger.reply(i18n.__mf("insert.usageReply", { prefix: bot.prefix })).then(purning);

    let playlistResearch = false;
    if (!isSlashCommand && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      playlistResearch = true;
    } else if (isSlashCommand && args.at(-1)?.toString() === "true") {
      args.slice(args.length-1);
      playlistResearch = true;
    } else if (isSlashCommand && args.at(-1)?.toString() === "false") {
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
      player.queue.insert(item);
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