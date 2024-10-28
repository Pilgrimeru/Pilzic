import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class ResumeCommand extends Command {

  constructor() {
    super({
      name: "resume",
      aliases: ["r"],
      description: i18n.__("resume.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;
    if (player.status !== "autopaused" && player.status !== "paused") {
      return commandTrigger.reply(i18n.__mf("resume.error")).then(autoDelete);
    }

    player.resume();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__mf("resume.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__mf("resume.result")).then(autoDelete);
  }
}