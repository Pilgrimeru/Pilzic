import { Event } from "@custom-types/Event";
import { ActivityType } from "discord.js";
import { bot } from "index";

export default new Event("ready", () => {
  console.log(`${bot.user!.username} ready!`);

  bot.user!.setActivity(`${bot.prefix}help and ${bot.prefix}play`, {
    type: ActivityType.Listening,
  });
  setInterval(() => {
    bot.user!.setActivity(`${bot.prefix}help and ${bot.prefix}play`, {
      type: ActivityType.Listening,
    });
  }, 3600 * 1000);
});
