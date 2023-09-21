import { CommandInteraction, Message, ApplicationCommandDataResolvable, ApplicationCommandOptionData, PermissionResolvable, MessageComponentInteraction } from "discord.js";

export enum CommandConditions {
  IS_CONNECTED_TO_CHANNEL,
  IS_IN_SAME_CHANNEL,
  CAN_BOT_CONNECT_TO_CHANNEL,
  CAN_BOT_SPEAK,
  QUEUE_EXISTS,
}

type ExtendedCommandDataResolvable = (ApplicationCommandDataResolvable & {
    aliases?: string[];
    conditions?: CommandConditions[];
    permissions?: PermissionResolvable[];
  })

export abstract class Command {
  public readonly name: string;
  public readonly description: string;
  public readonly aliases?: string[];
  public readonly permissions?: PermissionResolvable[];
  public readonly options?: ApplicationCommandOptionData[];
  public readonly conditions?: CommandConditions[];

  constructor(data : ExtendedCommandDataResolvable) {
    Object.assign(this, data);
  }

  abstract execute(commandTrigger: CommandInteraction | Message | MessageComponentInteraction, args?: string[]) : any;
}
