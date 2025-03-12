import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class StopCommand extends Command {
  constructor() {
    super({
      name: "stop",
      description: i18n.__("stop.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL,
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    player.stop();

    if (commandTrigger.type === "ButtonInteraction") {
      return await commandTrigger.send(i18n.__("stop.result")).then(autoDelete);
    }

    return await commandTrigger.reply(i18n.__("stop.result")).then(autoDelete);
  }
}
