

import { Interaction, PermissionsBitField } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";
import { purning } from "../utils/purning";

export default {
  event: "interactionCreate",
  async run(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      const guildBot = interaction.guild!.members.cache.get(bot.user!.id)!;
      const interactionChannel = interaction.guild!.channels.resolve(interaction.channelId);
      if (!interactionChannel) return;
      const canView = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.ViewChannel);
      const canSendMsg = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.SendMessages);
      if (!canView || !canSendMsg) return;
      
      interaction.commandName;
      const command = bot.commands.get(interaction.commandName);
      if (!command) return;
      const optionsData = interaction.options.data;
      const optionValues = optionsData.map((option) => option.value?.toString()).filter((option) => option !== undefined) as string[];

      const user = interaction.guild!.members.cache.get(interaction.user.id)!;

      try {
        const checkConditionsResult = checkConditions(command, user);
        if (checkConditionsResult !== "passed") return interaction.reply(checkConditionsResult).then(purning);
        const checkPermissionsResult = checkPermissions(command, user);
        if (checkPermissionsResult !== "passed") return interaction.reply(checkPermissionsResult).then(purning);

        command.execute(interaction, optionValues);
      } catch (error) {
        interaction.reply(i18n.__("errors.command")).then(purning);
        console.error(error);
      }
    }
  }
};