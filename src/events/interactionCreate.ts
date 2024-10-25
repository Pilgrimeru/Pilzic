import { bot } from "../index.js";
import { Event } from "../types/Event.js";

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() || interaction.isButton()) {
    bot.commandManager.handleInteraction(interaction);
  }
});