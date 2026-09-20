import { config } from "config";
import type { InteractionResponse, Message } from "discord.js";

export async function autoDelete(
  msg: Message | InteractionResponse,
  long?: boolean,
) {
  if (!config.AUTO_DELETE) return;
  const time = long ? 120 : 25;

  setTimeout(() => {
    msg.delete().catch(() => null);
  }, time * 1000);
}
