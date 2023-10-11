import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";
import { autoDelete } from "../utils/autoDelete";
import { Event } from "../types/Event";
import { CommandTrigger } from "../components/CommandTrigger";

export default new Event("messageCreate", async (message: Message) => {
  
  if (message.author.bot || !message.guild) return;

  let args : string[] = [];
  if (message.content.startsWith(bot.prefix)) {
    args = message.content.slice(bot.prefix.length).trim().split(/ +/);
  } else if (message.content.startsWith(`<@${bot.user!.id}>`)) {
    args = message.content.slice(`<@${bot.user!.id}>`.length).trim().split(/ +/);
  }

  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = bot.commands.get(commandName) ?? bot.commands.find((cmd) => cmd.aliases?.includes(commandName));
  if (!command) return;

  try {
    const checkConditionsResult = checkConditions(command, message.member!);
    if (checkConditionsResult !== "passed") return message.reply(checkConditionsResult).then(autoDelete);
    const checkPermissionsResult = checkPermissions(command, message.member!);
    if (checkPermissionsResult !== "passed") return message.reply(checkPermissionsResult).then(autoDelete);

    command.execute(new CommandTrigger(message), args);
  } catch (error) {
    message.reply(i18n.__("errors.command")).then(autoDelete);
    console.error(error);
  }
});