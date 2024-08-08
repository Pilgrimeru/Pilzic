import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";
import { CommandTrigger } from "../components/CommandTrigger.js";

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
    const player = bot.players.get(commandTrigger.guild.id)!;

    if (!player.queue.canBack()) {
      return commandTrigger.reply(i18n.__mf("previous.error")).then(autoDelete);
    }
    
    if (player.queue.loop === "track") player.queue.loop = "disabled";
    player.previous();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__mf("previous.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__mf("previous.result")).then(autoDelete);
  }
}