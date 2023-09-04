import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { purning } from "../utils/purning";

export default {
  name: "ping",
  cooldown: 2,
  description: i18n.__("ping.description"),
  execute(message: Message) {
    
    message
      .reply(i18n.__mf("ping.result", { ping: Math.round(message.client.ws.ping) }))
      .then(purning);
  }
};