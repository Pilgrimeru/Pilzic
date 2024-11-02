import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class PreviousCommand extends Command {

  constructor() {
    super({
      name: "previous",
      description: i18n.__("previous.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    if (!player.queue.canBack()) {
      return commandTrigger.reply(i18n.__("previous.error")).then(autoDelete);
    }

    if (player.queue.loop === "track") player.queue.loop = "disabled";
    player.previous();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__("previous.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__("previous.result")).then(autoDelete);
  }
}