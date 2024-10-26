import { bot } from 'index';
import { Event } from '@custom-types/Event';

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() || interaction.isButton()) {
    bot.commandManager.handleInteraction(interaction);
  }
});