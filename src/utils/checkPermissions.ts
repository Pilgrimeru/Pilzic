import { GuildMember, PermissionResolvable } from "discord.js";
import { Command } from "../types/Command";

export function checkPermissions(command: Command, guildMember: GuildMember): string {
  const requiredPermissions = command.permissions as PermissionResolvable[];

  const missing = guildMember.permissions.missing(requiredPermissions);

  if (Boolean(missing.length)) {
    return `Missing permissions: ${missing.join(", ")}`;
  }
  return "passed";
}