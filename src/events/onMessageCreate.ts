import { Collection, Message, PermissionResolvable, Snowflake } from "discord.js";
import { MissingPermissionsException } from "../exceptions/MissingPermissionsException";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command } from "../interfaces/Command";
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
  
    const command = bot.commands.get(commandName!) ?? bot.commands.find((cmd) => cmd.aliases?.includes(commandName));
    if (!command) return;
  
    if (!cooldowns.has(command.name)) {
      cooldowns.set(command.name, new Collection());
    }
    const timestamps: Collection<string, number> = cooldowns.get(command.name)!;

    const now = Date.now();    
    const cooldownAmount = (command.cooldown || 1) * 1000;
  
    if (timestamps.has(msg.author.id)) {
      const expirationTime = timestamps.get(msg.author.id)! + cooldownAmount;
  
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return msg.reply(i18n.__mf("common.cooldownmsg", { time: timeLeft.toFixed(1), name: command.name })).then(purning);
      }
    }
  
    timestamps.set(msg.author.id, now);
    setTimeout(() => timestamps.delete(msg.author.id), cooldownAmount);
  
    try {
      const permissionsCheck: PermissionResult = await checkPermissions(command, msg);
  
      if (permissionsCheck.result) {
        command.execute(msg, args);
      } else {
        throw new MissingPermissionsException(permissionsCheck.missing);
      }
    } catch (error) {
      if (error instanceof MissingPermissionsException) {
        msg.reply(error.toString()).then(purning);
      } else {
        msg.reply(i18n.__("errors.command")).then(purning);
        console.error(error);
      }
    }
  }
};

interface PermissionResult {
  result: boolean;
  missing: string[];
}

async function checkPermissions(command: Command, message: Message): Promise<PermissionResult> {
  const member = message.member!;
  const requiredPermissions = command.permissions as PermissionResolvable[];

  if (!command.permissions) return { result: true, missing: [] };

  const missing = member.permissions.missing(requiredPermissions);

  return { result: !Boolean(missing.length), missing };
}


