import { ActivityType } from "discord.js";
import { bot } from "../index.js";
import { Event } from "../types/Event.js";


export default new Event("ready", () => {
  
  console.log(`${bot.user!.username} ready!`);

  bot.user!.setActivity(`${bot.prefix}help and ${bot.prefix}play`, { type: ActivityType.Listening });
  setInterval(() => {
    bot.user!.setActivity(`${bot.prefix}help and ${bot.prefix}play`, { type: ActivityType.Listening });
  }, 1 * 3600 * 1000);
});