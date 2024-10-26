import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { i18n } from 'i18n.config';
import { Command } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';

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