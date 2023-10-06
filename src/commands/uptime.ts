import { CommandTrigger } from "../components/CommandTrigger";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command } from "../types/Command";

export default class UptimeCommand extends Command {
  constructor() {
    super({
      name: "uptime",
      aliases: ["up"],
      description: i18n.__("uptime.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    let seconds = Math.floor(bot.uptime! / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;

    return commandTrigger
      .reply({ content: i18n.__mf("uptime.result", { days: days, hours: hours, minutes: minutes, seconds: seconds }), ephemeral: true })
      .catch(console.error);
  }
}