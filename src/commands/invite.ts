import { CommandTrigger } from "../components/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { Command } from "../types/Command.js";

export default class InviteCommand extends Command {
  constructor() {
    super({
      name: "invite",
      description: i18n.__("invite.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    try {
      await commandTrigger.member!.send(
        `https://discord.com/oauth2/authorize?client_id=${commandTrigger.guild.client.user!.id}&permissions=274897914880&scope=bot`
      );
      commandTrigger.reply(i18n.__mf("invite.result"));
    } catch (message) {
      return console.error(message);
    }
  }
}