export enum CommandConditions {
  QUEUE_EXISTS,
  IS_CONNECTED_TO_CHANNEL,
  IS_IN_SAME_CHANNEL,
  CAN_BOT_CONNECT_TO_CHANNEL,
  CAN_BOT_SPEAK,
}
export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  permissions?: string[];
  conditions?: CommandConditions[];
  cooldown?: number;
  execute(...args: any): any;
}
