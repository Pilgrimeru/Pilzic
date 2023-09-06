import { Collection, Message, PermissionResolvable, PermissionsBitField, Snowflake } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../interfaces/Command";
import { purning } from "../utils/purning";

const cooldowns = new Collection<string, Collection<Snowflake, number>>();

export default {
  event: "messageCreate",
  async run(msg: Message) {
    if (msg.author.bot || !msg.guild) return;

    let args : string[] = [];
    if (msg.content.startsWith(bot.prefix)) {
      args = msg.content.slice(bot.prefix.length).trim().split(/ +/);
    } else if (msg.content.startsWith(`<@${bot.user!.id}>`)) {
      args = msg.content.slice(`<@${bot.user!.id}>`.length).trim().split(/ +/);
    }

    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;
  
    const command = bot.commands.get(commandName) ?? bot.commands.find((cmd) => cmd.aliases?.includes(commandName));
    if (!command) return;

    try {
      if (!checkConditionsAndWarn(command, msg)) return;
      if (!checkCooldownAndWarn(command, msg)) return;
      if (!checkPermissionsAndWarn(command, msg)) return;

      command.execute(msg, args);
    } catch (error) {
      msg.reply(i18n.__("errors.command")).then(purning);
      console.error(error);
    }
  }
};

function checkPermissionsAndWarn(command: Command, message: Message): boolean {
  const member = message.member!;
  const requiredPermissions = command.permissions as PermissionResolvable[];

  const missing = member.permissions.missing(requiredPermissions);

  if (Boolean(missing.length)) {
    message.reply(`Missing permissions: ${missing.join(", ")}`).then(purning);
    return false;
  }
  return true;
}

function checkCooldownAndWarn(command: Command, message: Message) {
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection<string, number>());
  }
  const timestamps: Collection<string, number> = cooldowns.get(command.name)!;

  const now = Date.now();    
  const cooldownAmount = (command.cooldown || 1) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id)! + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      message.reply(i18n.__mf("common.cooldownmsg", { time: timeLeft.toFixed(1), name: command.name })).then(purning);
      return false;
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
  return true;
}


function checkConditionsAndWarn(command: Command, message: Message): boolean {
  if (!command.conditions) return true;
  const { channel : userChannel } = message.member!.voice;
  command.conditions.sort((a, b) => a - b);

  for (const condition of command.conditions) {

    if (CommandConditions.QUEUE_EXISTS) {
      const player = bot.players.get(message.guild!.id);
      if (!player || !player.queue.currentSong) {
        message.reply(i18n.__("errors.notQueue")).then(purning);
        return false;
      }
    }

    if (!userChannel) {
      message.reply(i18n.__("errors.notChannel")).then(purning);
      return false;
    }

    switch (condition) {
      case CommandConditions.IS_IN_SAME_CHANNEL:
        if (userChannel.id !== userChannel.guild.members.me!.voice.channelId) {
          message.reply(i18n.__("errors.notInSameChannel")).then(purning);
          return false;
        }
        break;
  
      case CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL:
        if (!userChannel.joinable) {
          message.reply(i18n.__("errors.missingPermissionConnect")).then(purning);
          return false;
        }
        break;
  
      case CommandConditions.CAN_BOT_SPEAK:
        if (!userChannel.permissionsFor(bot.user!.id, true)?.has(PermissionsBitField.Flags.Speak)) {
          message.reply(i18n.__("errors.missingPermissionSpeak")).then(purning);
          return false;
        }
        break;
    }
  }
  return true;
}


