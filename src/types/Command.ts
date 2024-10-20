import type { ApplicationCommandDataResolvable, ApplicationCommandOptionData, PermissionResolvable } from "discord.js";
import { CommandTrigger } from "../core/helpers/CommandTrigger.js";

export enum CommandConditions {
  QUEUE_EXISTS,
  IS_CONNECTED_TO_CHANNEL,
  IS_IN_SAME_CHANNEL,
  CAN_BOT_CONNECT_TO_CHANNEL,
  CAN_BOT_SPEAK,
}

type ExtendedCommandDataResolvable = (ApplicationCommandDataResolvable & {
    aliases?: string[];
    conditions?: CommandConditions[];
    permissions?: PermissionResolvable[];
  })

export abstract class Command {
  public readonly name!: string;
  public readonly description!: string;
  public readonly aliases?: string[];
  public readonly permissions?: PermissionResolvable[];
  public readonly options?: ApplicationCommandOptionData[];
  public readonly conditions?: CommandConditions[];

  constructor(data : ExtendedCommandDataResolvable) {
    Object.assign(this, data);
  }

  abstract execute(commandTrigger: CommandTrigger, args?: string[]) : any;
}
