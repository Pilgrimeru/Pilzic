import { joinVoiceChannel } from "@discordjs/voice";
import { ApplicationCommandOptionType, BaseGuildTextChannel, PermissionsBitField, User } from "discord.js";
import { CommandTrigger } from "../core/CommandTrigger.js";
import { Player } from "../core/Player.js";
import { Playlist } from "../core/Playlist.js";
import { Track } from "../core/Track.js";
import { ExtractionError } from "../errors/ExtractionErrors.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";
import { type UrlType, validate } from "../utils/validate.js";

export default class InsertCommand extends Command {
  constructor() {
    super({
      name: "insert",
      description: i18n.__("insert.description"),
      options: [
        {
          name: "query",
          description: i18n.__mf("insert.options.query"),
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "playlist",
          description: i18n.__mf("insert.options.playlist"),
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
    });
  }
  async execute(commandTrigger: CommandTrigger, args: string[]) {

    if (!args.length && !(commandTrigger.attachments?.size))
      return commandTrigger.reply(i18n.__mf("insert.usageReply", { prefix: bot.prefix })).then(autoDelete);

    let searchForPlaylist = false;
    if (!commandTrigger.isInteraction && args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      searchForPlaylist = true;
    } else if (commandTrigger.isInteraction && args.at(-1) === "true") {
      args = args.slice(0, args.length - 1);
      searchForPlaylist = true;
    } else if (commandTrigger.isInteraction && args.at(-1) === "false") {
      args = args.slice(0, args.length - 1);
    }

    commandTrigger.loadingReply();

    const search = (commandTrigger.attachments && !args.length) ? commandTrigger.attachments.first()?.url! : args.join(" ");
    const type: UrlType = await validate(search);
    const requester: User = commandTrigger.member!.user;

    try {
      let item: Track | Playlist;
      if (type.toString().match(/playlist|album|artist/) || (type === "yt_search" && searchForPlaylist)) {
        commandTrigger.editReply(i18n.__mf("play.fetchingPlaylist")).catch(() => null);
        item = (await Playlist.from(search, requester, type));
      } else {
        item = (await Track.from(search, requester, type));
      }
      const guildMember = commandTrigger.member!;
      const { channel } = guildMember!.voice;
      if (!channel) return;
      const player = bot.players.get(commandTrigger.guild.id) ?? new Player({
        textChannel: (commandTrigger.channel as BaseGuildTextChannel),
        connection: joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator as any,
        })
      });
      player.queue.insert(item);
      commandTrigger.deleteReply();
    } catch (error) {
      if (error instanceof ExtractionError) {
        return commandTrigger.editReply(i18n.__(error.i18n())).then(autoDelete);
      }
      console.error(error);
      return commandTrigger.editReply(i18n.__("errors.command")).then(autoDelete);
    }
  }
}