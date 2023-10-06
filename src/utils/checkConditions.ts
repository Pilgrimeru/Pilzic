import { GuildMember, PermissionsBitField } from "discord.js";
import { Command, CommandConditions } from "../types/Command";
import { i18n } from "../i18n.config";

import { bot } from "../index";

export function checkConditions(command: Command, guildMember: GuildMember): string {
  if (!command.conditions) return "passed";
  const { channel } = guildMember!.voice;
  command.conditions.sort((a, b) => a - b);

  for (const condition of command.conditions) {

    if (condition === CommandConditions.QUEUE_EXISTS) {
      const player = bot.players.get(guildMember.guild.id);
      if (!player || !player.queue.currentSong) {
        return i18n.__("errors.notQueue");
      }
    }

    if (!channel) {
      return i18n.__("errors.notChannel");
    }

    switch (condition) {
      case CommandConditions.IS_IN_SAME_CHANNEL:
        if (channel.id !== channel.guild.members.me!.voice.channelId) {
          return i18n.__("errors.notInSameChannel");
        }
        break;

      case CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL:
        if (!channel.joinable) {
          return i18n.__("errors.missingPermissionConnect");
        }
        break;

      case CommandConditions.CAN_BOT_SPEAK:
        if (!channel.permissionsFor(bot.user!.id, true)?.has(PermissionsBitField.Flags.Speak)) {
          return i18n.__("errors.missingPermissionSpeak");
        }
        break;

      default: break;
    }
  }
  return "passed";
}