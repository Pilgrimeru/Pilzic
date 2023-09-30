import { ButtonInteraction, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

export default class ResumeCommand extends Command {
  constructor() {
    super({
      name: "resume",
      aliases: ["r"],
      description: i18n.__("resume.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: ButtonInteraction | CommandInteraction | Message) {

    const player = bot.players.get(commandTrigger.guild!.id)!;
    if (player.status !== "autopaused" && player.status !== "paused") {
      if (commandTrigger instanceof ButtonInteraction) {
        return commandTrigger.reply(i18n.__mf("resume.error")).then(purning);
      }
      return commandTrigger.reply(i18n.__mf("resume.error")).then(purning);
    }

    player.resume();

    if (commandTrigger instanceof ButtonInteraction) {
      commandTrigger.deferUpdate();
      return player.textChannel.send(i18n.__mf("resume.result")).then(purning);
    }

    return commandTrigger.reply(i18n.__mf("resume.result")).then(purning);
  }
}