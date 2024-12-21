import { Event } from '@custom-types/Event';
import { bot } from 'index';

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isAutocomplete()) {
    void bot.commandManager.handleInteraction(interaction);
  }
});