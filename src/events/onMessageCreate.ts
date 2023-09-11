import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";

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
      const checkConditionsResult = checkConditions(command, msg.member!);
      if (checkConditionsResult !== "passed") return msg.reply(checkConditionsResult);
      const checkPermissionsResult = checkPermissions(command, msg.member!);
      if (checkPermissionsResult !== "passed") return msg.reply(checkPermissionsResult);

      command.execute(msg, args);
    } catch (error) {
      msg.reply(i18n.__("errors.command")).then(purning);
      console.error(error);
    }
  }
};