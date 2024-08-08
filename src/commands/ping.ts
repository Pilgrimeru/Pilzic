import { CommandTrigger } from "../components/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { Command } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class PingCommand extends Command {
  constructor() {
    super({
      name: "ping",
      description: i18n.__("ping.description")
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    commandTrigger
      .reply(i18n.__mf("ping.result", { ping: Math.round(commandTrigger.guild.client.ws.ping) }))
      .then(autoDelete);
  }
}