import { Message } from 'discord.js';
import { bot } from 'index';
import { Event } from '@custom-types/Event';

export default new Event("messageCreate", async (message: Message) => {
  bot.commandManager.handleMessage(message);
});