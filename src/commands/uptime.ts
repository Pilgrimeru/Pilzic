import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { MessageFlags } from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class UptimeCommand extends Command {
  constructor() {
    super({
      name: "uptime",
      aliases: ["up"],
      description: i18n.__("uptime.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    const uptimeInSeconds = Math.floor((bot.uptime ?? 0) / 1000);

    const timeUnits = {
      days: Math.floor(uptimeInSeconds / 86400),
      hours: Math.floor((uptimeInSeconds % 86400) / 3600),
      minutes: Math.floor((uptimeInSeconds % 3600) / 60),
      seconds: uptimeInSeconds % 60,
    };

    await commandTrigger
      .reply({
        content: i18n.__mf("uptime.result", timeUnits),
        flags: MessageFlags.Ephemeral,
      })
      .then(autoDelete);
  }
}
