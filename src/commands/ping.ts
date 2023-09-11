import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { purning } from "../utils/purning";

export default {
  name: "ping",
  description: i18n.__("ping.description"),
  execute(commandTrigger: CommandInteraction | Message) {
    
    commandTrigger
      .reply(i18n.__mf("ping.result", { ping: Math.round(commandTrigger.client.ws.ping) }))
      .then(purning);
  }
};