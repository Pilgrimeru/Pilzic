import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";


export default {
  name: "uptime",
  aliases: ["up"],
  description: i18n.__("uptime.description"),
  execute(commandTrigger: CommandInteraction | Message) {
    let seconds = Math.floor(bot.uptime! / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds %= 60;
    minutes %= 60;
    hours %= 24;

    return commandTrigger
      .reply(i18n.__mf("uptime.result", { days: days, hours: hours, minutes: minutes, seconds: seconds }))
      .catch(console.error);
  }
};