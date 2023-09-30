import { ButtonInteraction, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

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

  async execute(commandTrigger: CommandInteraction | ButtonInteraction | Message) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

    if (player.status === "autopaused" || player.status === "paused") {
      if (commandTrigger instanceof ButtonInteraction) {
        return commandTrigger.reply(i18n.__mf("pause.error")).then(purning);
      }
      return commandTrigger.reply(i18n.__mf("pause.error")).then(purning);
    }

    player.pause();

    if (commandTrigger instanceof ButtonInteraction) {
      commandTrigger.deferUpdate();
      return player.textChannel.send(i18n.__mf("pause.result")).then(purning);
    }

    return commandTrigger.reply(i18n.__mf("pause.result")).then(purning);
  }
}