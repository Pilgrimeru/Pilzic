import { Message } from "discord.js";
import { i18n } from "../i18n.config";

export default {
  name: "invite",
  description: i18n.__("invite.description"),
  execute(message: Message) {
    
    return message
      .member!.send(
        `https://discord.com/oauth2/authorize?client_id=${message.client.user!.id}&permissions=274897914880&scope=bot`
      ).catch(console.error);
  }
};