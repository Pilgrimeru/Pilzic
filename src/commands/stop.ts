import { CommandTrigger } from "../components/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class StopCommand extends Command {
  constructor() {
    super({
      name: "stop",
      description: i18n.__("stop.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

    player.stop();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__mf("stop.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__mf("stop.result")).then(autoDelete);
  }
}