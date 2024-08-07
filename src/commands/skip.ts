import { CommandTrigger } from "../components/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";


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

    const player = bot.players.get(commandTrigger.guild!.id)!;

    if (player.queue.loop === "track") player.queue.loop = "disabled";
    player.skip();

    if (commandTrigger.type === "ButtonInteraction") {
      return commandTrigger.send(i18n.__mf("skip.result")).then(autoDelete);
    }

    return commandTrigger.reply(i18n.__mf("skip.result")).then(autoDelete);
  }
}