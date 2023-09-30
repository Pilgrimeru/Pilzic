import { ButtonInteraction, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

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

  async execute(commandTrigger: CommandInteraction | ButtonInteraction | Message) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

    player.stop();

    if (commandTrigger instanceof ButtonInteraction) {
      commandTrigger.deferUpdate();
      return player.textChannel.send(i18n.__mf("stop.result")).then(purning);
    }

    return commandTrigger.reply(i18n.__mf("stop.result")).then(purning);
  }
}