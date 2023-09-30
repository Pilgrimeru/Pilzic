import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { Command } from "../types/Command";
import { purning } from "../utils/purning";

export default class PingCommand extends Command {
  constructor() {
    super({
      name: "ping",
      description: i18n.__("ping.description")
    });
  }

  async execute(commandTrigger: CommandInteraction | Message): Promise<void> {

    commandTrigger
      .reply(i18n.__mf("ping.result", { ping: Math.round(commandTrigger.client.ws.ping) }))
      .then(purning);
  }
}