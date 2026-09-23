import { Event } from "@custom-types/Event";
import { observe } from "@core/helpers/observe";
import { bot } from "index";

export default new Event("interactionCreate", async (interaction) => {
  if (
    interaction.isChatInputCommand() ||
    interaction.isButton() ||
    interaction.isAutocomplete()
  ) {
    observe(
      bot.commandManager.handleInteraction(interaction),
      "interaction handler",
    );
  }
});
