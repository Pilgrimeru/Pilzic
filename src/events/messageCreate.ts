import { Message } from "discord.js";
import { bot } from "../index.js";
import { Event } from "../types/Event.js";

export default new Event("messageCreate", async (message: Message) => {
  bot.commandManager.handleMessage(message);
});