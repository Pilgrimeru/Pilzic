import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Message,
  PermissionsBitField,
  type ApplicationCommandDataResolvable,
  type GuildBasedChannel
} from "discord.js";
import { readdirSync } from 'fs';
import { i18n } from 'i18n.config';
import { bot } from 'index';
import { join } from 'path';

export class CommandManager {

  public commands = new Collection<string, Command>();

  public async loadCommands(): Promise<void> {
    const commandFolder = join(__dirname, '../../commands');
    const commandFiles = readdirSync(commandFolder).filter((file) => !file.endsWith(".map"));

    for (const file of commandFiles) {
      const filePath = join(commandFolder, file);
      const CommandClass = (await import(filePath)).default;
      const commandInstance = new CommandClass() as Command;
      this.commands.set(commandInstance.name, commandInstance);
    }

    this.registerSlashCommands();
  }

  private registerSlashCommands(): void {
    const slashCommands: ApplicationCommandDataResolvable[] = this.commands.map(command => ({
      name: command.name,
      description: command.description,
      options: command.options,
      defaultMemberPermissions: command.permissions ?? null,
    }));

    bot.once("ready", () => {
      bot.application?.commands.set(slashCommands);
    });
  }

  public async executeCommand(commandName: string, commandTrigger: CommandTrigger, args?: string[]): Promise<void> {
    const command = this.commands.get(commandName) || this.commands.find(cmd => cmd.aliases?.includes(commandName));
    if (!command) return;

    const member = commandTrigger.member;

    if (!this.hasPermissions(command, member, commandTrigger)) return;

    try {
      await command.execute(commandTrigger, args);
    } catch (error) {
      await commandTrigger.reply(i18n.__("errors.command")).then(autoDelete);
      console.error(`Error executing command ${commandName}:`, error);
    }
  }

  public async handleInteraction(interaction: ChatInputCommandInteraction | ButtonInteraction | AutocompleteInteraction): Promise<void> {
    if (!interaction.guild) return;

    if (interaction.isAutocomplete()) {
      const command = this.commands.get(interaction.commandName);
      command?.autocomplete(interaction);
      return;
    }

    if (interaction.isButton() && !interaction.customId.startsWith("cmd-")) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    const channel = interaction.channel as GuildBasedChannel;
    if (!channel || !this.hasChannelPermissions(member, channel)) return;

    const commandName = interaction.isChatInputCommand()
      ? interaction.commandName
      : interaction.customId.slice(4);

    const args = interaction.isChatInputCommand()
      ? interaction.options.data.map(opt => opt.value?.toString()).filter(Boolean) as string[]
      : undefined;

    await this.executeCommand(commandName, new CommandTrigger(interaction), args);
  }

  public async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const prefix = bot.prefix;
    let args: string[] = [];

    if (message.content.startsWith(prefix)) {
      args = message.content.slice(prefix.length).trim().split(/\s+/);
    } else if (message.content.startsWith(`<@!${bot.user?.id}>`) || message.content.startsWith(`<@${bot.user?.id}>`)) {
      args = message.content.replace(/<@!?(\d+)>/, '').trim().split(/\s+/);
    } else {
      return;
    }

    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    await this.executeCommand(commandName, new CommandTrigger(message), args);
  }

  private hasChannelPermissions(member: GuildMember, channel: GuildBasedChannel): boolean {
    const permissions = channel.permissionsFor(member);
    if (!permissions) return false;
    return permissions.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]);
  }

  private hasPermissions(command: Command, member: GuildMember, commandTrigger: CommandTrigger): boolean {
    if (command.conditions) {
      for (const condition of command.conditions) {
        const result = this.evaluateCondition(condition, member);
        if (result !== "passed") {
          commandTrigger.reply(result).then(autoDelete);
          return false;
        }
      }
    }

    if (command.permissions) {
      const missing = member.permissions.missing(command.permissions);
      if (missing.length) {
        commandTrigger.reply(`Missing permissions: ${missing.join(", ")}`).then(autoDelete);
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: CommandConditions, member: GuildMember): string {
    const voiceChannel = member.voice.channel;
    switch (condition) {
      case CommandConditions.IS_CONNECTED_TO_CHANNEL:
        if (!voiceChannel) {
          return i18n.__("errors.notChannel");
        }
        break;
      case CommandConditions.QUEUE_EXISTS: {
        const player = bot.playerManager.getPlayer(member.guild.id);
        if (!player?.queue.currentTrack) {
          return i18n.__("errors.notQueue");
        }
        break;
      }
      case CommandConditions.IS_IN_SAME_CHANNEL:
        if (!voiceChannel || voiceChannel.id !== member.guild.members.me?.voice.channelId) {
          return i18n.__("errors.notInSameChannel");
        }
        break;
      case CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL:
        if (voiceChannel && !voiceChannel.joinable) {
          return i18n.__("errors.missingPermissionConnect");
        }
        break;
      case CommandConditions.CAN_BOT_SPEAK:
        if (voiceChannel && !voiceChannel.permissionsFor(bot.user!)?.has(PermissionsBitField.Flags.Speak)) {
          return i18n.__("errors.missingPermissionSpeak");
        }
        break;
      default:
        return "passed";
    }

    return "passed";
  }
}
