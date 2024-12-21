import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class ShuffleCommand extends Command {

  constructor() {
    super({
      name: "shuffle",
      description: i18n.__("shuffle.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;
    
    player.queue.shuffle();

    await commandTrigger.reply(i18n.__("shuffle.result")).then(autoDelete);
  }
}