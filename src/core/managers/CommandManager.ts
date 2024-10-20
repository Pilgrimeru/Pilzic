import { ButtonInteraction, ChatInputCommandInteraction, Collection, GuildMember, Message, PermissionsBitField, type ApplicationCommandDataResolvable, type GuildBasedChannel, type PermissionResolvable } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { bot } from "../..";
import { CommandConditions, type Command } from "../../types/Command";
import { autoDelete } from "../../utils/autoDelete";
import { CommandTrigger } from "../helpers/CommandTrigger";

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

  public async registerSlashCommands(): Promise<void> {
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

  private async checkConditionsAndPermissions(command: Command, member: GuildMember, trigger: CommandTrigger): Promise<boolean> {
    const checkConditionsResult = this.checkConditions(command, member);
    if (checkConditionsResult !== "passed") {
      await trigger.reply(checkConditionsResult).then(autoDelete);
      return false;
    }

    const checkPermissionsResult = this.checkPermissions(command, member);
    if (checkPermissionsResult !== "passed") {
      await trigger.reply(checkPermissionsResult).then(autoDelete);
      return false;
    }

    return true;
  }

  private hasChannelPermissions(guildBot: GuildMember, interactionChannel: GuildBasedChannel) {
    const canView = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.ViewChannel);
    const canSendMsg = interactionChannel.permissionsFor(guildBot).has(PermissionsBitField.Flags.SendMessages);
    return canView && canSendMsg;
  }

  public async handleIntercation(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    try {
      if (!interaction.guild) return;
      const memberBot = interaction.guild.members.cache.get(bot.user!.id)!;

      if (interaction.isButton() && !interaction.customId.startsWith("cmd-")) return;

      const interactionChannel = interaction.guild.channels.resolve(interaction.channelId);
      if (!interactionChannel) return;

      const member = interaction.guild.members.cache.get(interaction.user.id)!;
      if (!this.hasChannelPermissions(memberBot, interactionChannel)) return;
      if (!this.hasChannelPermissions(member, interactionChannel)) return;

      const commandName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId.slice(4);

      await this.executeCommand(commandName, new CommandTrigger(interaction));

    } catch (error) {
      console.error(error);
    }
  }

  public async handleMessage(message: Message) {
    try {
      if (message.author.bot || !message.guild) return;

      let args: string[] = [];
      if (message.content.startsWith(bot.prefix)) {
        args = message.content.slice(bot.prefix.length).trim().split(/ +/);
      } else if (message.content.startsWith(`<@${bot.user!.id}>`)) {
        args = message.content.slice(`<@${bot.user!.id}>`.length).trim().split(/ +/);
      }
    
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;
    
      await this.executeCommand(commandName, new CommandTrigger(message), args);

    } catch (error) {
      console.error(error);
    }
  }

  public async executeCommand(commandName: string, trigger: CommandTrigger, args?: string[]): Promise<void> {
    const command = this.commands.get(commandName) ?? this.commands.find(cmd => cmd.aliases?.includes(commandName));
    if (!command) return;

    const member = trigger.member;

    const canExecute = await this.checkConditionsAndPermissions(command, member, trigger);
    if (!canExecute) return;

    try {
      await command.execute(trigger, args);
    } catch (error) {
      await trigger.reply(i18n.__("errors.command")).then(autoDelete);
      console.error(error);
    }
  }

  private checkConditions(command: Command, guildMember: GuildMember): string {
    if (!command.conditions) return "passed";
    const { channel } = guildMember!.voice;
    command.conditions.sort((a, b) => a - b);

    for (const condition of command.conditions) {

      if (condition === CommandConditions.QUEUE_EXISTS) {
        const player = bot.playerManager.getPlayer(guildMember.guild.id);
        if (!player || !player.queue.currentSong) {
          return i18n.__("errors.notQueue");
        }
      }

      if (!channel) {
        return i18n.__("errors.notChannel");
      }

      switch (condition) {
        case CommandConditions.IS_IN_SAME_CHANNEL:
          if (channel.id !== channel.guild.members.me!.voice.channelId) {
            return i18n.__("errors.notInSameChannel");
          }
          break;

        case CommandConditions.CAN_BOT_CONNECT_TO_CHANNEL:
          if (!channel.joinable) {
            return i18n.__("errors.missingPermissionConnect");
          }
          break;

        case CommandConditions.CAN_BOT_SPEAK:
          if (!channel.permissionsFor(bot.user!.id, true)?.has(PermissionsBitField.Flags.Speak)) {
            return i18n.__("errors.missingPermissionSpeak");
          }
          break;

        default: break;
      }
    }
    return "passed";
  }

  private checkPermissions(command: Command, guildMember: GuildMember): string {
    const requiredPermissions = command.permissions as PermissionResolvable[];

    const missing = guildMember.permissions.missing(requiredPermissions);

    if (Boolean(missing.length)) {
      return `Missing permissions: ${missing.join(", ")}`;
    }
    return "passed";
  }
}
