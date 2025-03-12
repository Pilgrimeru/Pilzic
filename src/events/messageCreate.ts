import { Event } from "@custom-types/Event";
import { Message } from "discord.js";
import { bot } from "index";

export default new Event("messageCreate", async (message: Message) => {
  void bot.commandManager.handleMessage(message);
});
