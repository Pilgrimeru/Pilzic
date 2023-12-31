import { CommandTrigger } from "../components/CommandTrigger";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { autoDelete } from "../utils/autoDelete";

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

    const player = bot.players.get(commandTrigger.guild.id)!;
    const queue = player.queue;

    queue.shuffle();

    commandTrigger.reply(i18n.__mf("shuffle.result")).then(autoDelete);
  }
}