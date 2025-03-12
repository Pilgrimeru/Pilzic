import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { i18n } from "i18n.config";

export default class PingCommand extends Command {
  constructor() {
    super({
      name: "ping",
      description: i18n.__("ping.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    await commandTrigger
      .reply(
        i18n.__mf("ping.result", {
          ping: Math.round(commandTrigger.guild.client.ws.ping),
        }),
      )
      .then(autoDelete);
  }
}
