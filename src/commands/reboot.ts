import { ActivityType, Message, PermissionsBitField } from "discord.js";
import { bot } from "../index";
import { purning } from "../utils/purning";

export default {
  name: "reboot",
  description: "arrete le bot",

  execute(message: Message) {
    if (message.member?.id === "432533102850605057" || message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      bot.user!.setActivity(`redémarre`, { type: ActivityType.Listening });
      bot.user!.setStatus('dnd');
      setTimeout(() => {
        process.exit();
      }, 5);
    } else {
      message.reply("Seulement certaines personnes sont autorisées à utiliser cette commande.").then(purning);
    }
  }
};
