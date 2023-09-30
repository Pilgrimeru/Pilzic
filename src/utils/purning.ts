import { InteractionResponse, Message } from "discord.js";
import { config } from "../config";

export async function purning(msg: Message | InteractionResponse, long?: boolean) {

  if (!config.PRUNING) return;
  let time = long ? 120 : 25;

  setTimeout(() => {
    msg.delete().catch(() => null);
  }, time * 1000);
}