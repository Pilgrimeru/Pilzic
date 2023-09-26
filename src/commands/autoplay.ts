import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { Command, CommandConditions } from "../types/Command";


export default class AutoplayCommand extends Command {
  constructor() {
    super({
      name: "autoplay",
      description: i18n.__("autoplay.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    })
  }
  
  async execute(commandTrigger: CommandInteraction | Message) {
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    const response = await commandTrigger.reply(i18n.__mf("common.loading"));
    const isAutoqueue = player.queue.getAutoqueue();
    await player.queue.setAutoqueue(!isAutoqueue);

    const mode = !isAutoqueue ? i18n.__mf("common.enabled") : i18n.__mf("common.disabled");
    return response.edit(i18n.__mf("autoplay.result", {mode : mode})).then(purning); 
  }
}