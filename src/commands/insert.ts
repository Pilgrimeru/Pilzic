import { DiscordGatewayAdapterCreator, joinVoiceChannel } from "@discordjs/voice";
import { BaseGuildTextChannel, Message, PermissionsBitField } from "discord.js";
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
  cooldown: 3,
  description: i18n.__("insert.description"),
  permissions: [
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(message: Message, args: string[]) {

    if (!args.length && !message.attachments.size)
      return message.reply(i18n.__mf("insert.usageReply", { prefix: bot.prefix })).then(purning);

    let playlistResearch = false;
    if (args.length >= 2 && args[0].toLowerCase() === "playlist") {
      args = args.slice(1);
      playlistResearch = true;
    }

    const loadingReply = await message.reply(i18n.__mf("common.loading"));

    const url = (!args.length) ? message.attachments.first()?.url! : args[0];
    const type: string | false = await validate(url);
    const search = args.join(" ");

    try {
      let item : Song | Playlist;
      if (type.toString().match(/playlist|album|artist/) || (type === false && playlistResearch)) {
        loadingReply.edit(i18n.__mf("play.fetchingPlaylist")).catch(() => null);
        item = (await Playlist.from(url, search, type))
        
      } else {
        item = (await Song.from(url, search, type));
      }
      const { channel } = message.member!.voice;
      if (!channel) return;
      const player = bot.players.get(message.guildId!) ?? new Player({
        textChannel: (message.channel as BaseGuildTextChannel),
        connection: joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
        })
      })
      player.queue.insert(item);
      
    } catch (error) {
      if (error instanceof ExtractionError) {
        return message.reply(i18n.__(error.i18n())).then(purning);
      }
      console.error(error);
      return message.reply(i18n.__("errors.command")).then(purning);
    } finally {
      loadingReply.delete().catch(() => null);
    }
  }
};