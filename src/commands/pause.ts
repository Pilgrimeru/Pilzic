import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class PauseCommand extends Command {
  constructor() {
    super({
      name: "pause",
      description: i18n.__("pause.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL,
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    if (player.status === "autopaused" || player.status === "paused") {
      return await commandTrigger
        .reply(i18n.__("pause.error"))
        .then(autoDelete);
    }

    await player.pause();

    if (commandTrigger.type === "ButtonInteraction") {
      return await commandTrigger
        .send(i18n.__("pause.result"))
        .then(autoDelete);
    }

    return await commandTrigger.reply(i18n.__("pause.result")).then(autoDelete);
  }
}
