import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { i18n } from 'i18n.config';
import { bot } from 'index';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';

export default class AutoplayCommand extends Command {
  
  constructor() {
    super({
      name: "autoplay",
      description: i18n.__("autoplay.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;
    commandTrigger.loadingReply();
    const autoqueueStatus = await player.queue.toggleAutoqueue();

    const mode = autoqueueStatus ? i18n.__mf("common.enabled") : i18n.__mf("common.disabled");
    return commandTrigger.editReply(i18n.__mf("autoplay.result", { mode: mode })).then(autoDelete);
  }
}