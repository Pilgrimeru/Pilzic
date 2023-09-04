import { GuildMember, Message, PermissionsBitField } from "discord.js";
import { bot } from "..";
import { i18n } from "../i18n.config";
import { purning } from "./purning";

export function queueExists(message: Message) : boolean {
  const player = bot.players.get(message.guild!.id);
  if (!player || !player.queue.currentSong) {
    message.reply(i18n.__("errors.notQueue")).then(purning);
    return false;
  }
  return true;
}

export function isConnectedToChannel(message: Message) : boolean {
  const { channel } = message.member!.voice;
  if (channel == null) {
    message.reply(i18n.__("errors.notChannel")).then(purning);
    return false
  }
  return true;
}

export function canModifyQueue(message: Message) : boolean {
  if( message.member!.voice.channelId !== message.member!.guild.members.me!.voice.channelId ) {
    message.reply(i18n.__("errors.notInSameChannel")).then(purning);
    return false;
  }
  return true;
}

export function canModifyQueueI(member: GuildMember) : boolean {
  return member.voice.channelId === member.guild.members.me!.voice.channelId;
}

export function canBotConnectToChannel(message: Message) : boolean { 
  const { channel } = message.member!.voice;
  if (!channel) return false;
  if (!channel.joinable) {
    message.reply(i18n.__("errors.missingPermissionConnect")).then(purning);
    return false
  }
  return true;
}

export function canBotSpeak(message: Message) : boolean {
  const { channel } = message.member!.voice;
  if (!channel) return false;
  if (!channel.permissionsFor(bot.user!.id, true)?.has(PermissionsBitField.Flags.Speak)) {
    message.reply(i18n.__("errors.missingPermissionSpeak")).then(purning);
    return false
  }
  return true;
}

