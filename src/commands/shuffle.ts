import { CommandTrigger } from "../core/helpers/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

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
    const queue = player.queue;

    queue.shuffle();

    commandTrigger.reply(i18n.__mf("shuffle.result")).then(autoDelete);
  }
}