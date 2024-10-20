import { CommandTrigger } from "../core/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class PauseCommand extends Command {
  constructor() {
    super({
      name: "pause",
      description: i18n.__("pause.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.players.get(commandTrigger.guild.id)!;

    if (player.status === "autopaused" || player.status === "paused") {
      return commandTrigger.reply(i18n.__mf("pause.error")).then(autoDelete);
    }

    await player.pause();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__mf("pause.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__mf("pause.result")).then(autoDelete);
  }
}