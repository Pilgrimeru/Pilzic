import { GuildBasedChannel, GuildMember, PermissionsBitField } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { checkConditions } from "../utils/checkConditions";
import { checkPermissions } from "../utils/checkPermissions";
import { autoDelete } from "../utils/autoDelete";
import { Event } from "../types/Event";
import { CommandTrigger } from "../components/CommandTrigger";

function hasChannelPermissions(guildBot: GuildMember, interactionChannel: GuildBasedChannel) {
  const canView = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.ViewChannel);
  const canSendMsg = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.SendMessages);
  return canView && canSendMsg;
}

export default new Event("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() || interaction.isButton()) {

    try {

      if (!interaction.guild) return;
      const memberBot = interaction.guild.members.cache.get(bot.user!.id)!;
      
      if (interaction.isButton() && !interaction.customId.startsWith("cmd-")) return;

      const interactionChannel = interaction.guild.channels.resolve(interaction.channelId);
      if (!interactionChannel) return;

      const member = interaction.guild.members.cache.get(interaction.user.id)!;
      if (!hasChannelPermissions(memberBot, interactionChannel)) return;
      if (!hasChannelPermissions(member, interactionChannel)) return;

      const commandName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId.slice(4);
      const command = bot.commands.get(commandName);
      if (!command) return;

      
      const optionValues = interaction.isChatInputCommand() ?
        interaction.options.data.map((option) => option.value?.toString()).filter((option) => option !== undefined) as string[] : undefined;

      const checkConditionsResult = checkConditions(command, member);
      if (checkConditionsResult !== "passed") return interaction.reply(checkConditionsResult).then(autoDelete);
      const checkPermissionsResult = checkPermissions(command, member);
      if (checkPermissionsResult !== "passed") return interaction.reply(checkPermissionsResult).then(autoDelete);

      await command.execute(new CommandTrigger(interaction), optionValues);

    } catch (error) {
      interaction.reply(i18n.__("errors.command")).then(autoDelete);
      console.error(error);
    }
  }
});