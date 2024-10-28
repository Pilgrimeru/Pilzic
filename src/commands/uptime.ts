import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command } from '@custom-types/Command';
import { i18n } from 'i18n.config';
import { bot } from 'index';

export default class UptimeCommand extends Command {

  constructor() {
    super({
      name: "uptime",
      aliases: ["up"],
      description: i18n.__("uptime.description"),
    });
  }

  async execute(commandTrigger: CommandTrigger) {
    const totalSeconds = Math.floor(bot.uptime ?? 0 / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return commandTrigger
      .reply({ content: i18n.__mf("uptime.result", { days: days, hours: hours, minutes: minutes, seconds: seconds }), ephemeral: true })
      .catch(console.error);
  }
}