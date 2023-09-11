import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";

export default {
  name: "invite",
  description: i18n.__("invite.description"),
  execute(commandTrigger: CommandInteraction | Message) {
    const isSlashCommand = (commandTrigger instanceof CommandInteraction) ;
    const guildMember = isSlashCommand ? commandTrigger.guild!.members.cache.get(commandTrigger.user.id): commandTrigger.member;
    return guildMember!.send(
        `https://discord.com/oauth2/authorize?client_id=${commandTrigger.client.user!.id}&permissions=274897914880&scope=bot`
      ).catch(console.error);
  }
};