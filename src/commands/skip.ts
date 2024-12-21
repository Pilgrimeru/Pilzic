import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class SkipCommand extends Command {

  constructor() {
    super({
      name: "skip",
      aliases: ["s"],
      description: i18n.__("skip.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    if (player.queue.loop === "track") player.queue.loop = "disabled";
    await player.skip();

    if (commandTrigger.type === "ButtonInteraction") {
      return await commandTrigger.send(i18n.__("skip.result")).then(autoDelete);
    }

    return await commandTrigger.reply(i18n.__("skip.result")).then(autoDelete);
  }
}