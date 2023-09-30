import { BaseInteraction, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { Command } from "../types/Command";

export default class InviteCommand extends Command {
  constructor() {
    super({
      name: "invite",
      description: i18n.__("invite.description"),
    });
  }

  async execute(commandTrigger: CommandInteraction | Message) {
    const isInteraction = (commandTrigger instanceof BaseInteraction);
    const guildMember = isInteraction ? commandTrigger.guild!.members.cache.get(commandTrigger.user.id) : commandTrigger.member;
    try {
      return await guildMember!.send(
        `https://discord.com/oauth2/authorize?client_id=${commandTrigger.client.user!.id}&permissions=274897914880&scope=bot`
      );
    } catch (message) {
      return console.error(message);
    }
  }
}