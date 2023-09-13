import { CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { Command, CommandConditions } from "../types/Command";

export default class ShuffleCommand extends Command {
  constructor() {
    super({
      name: "shuffle",
      description: i18n.__("shuffle.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    })
  }
  
  async execute(commandTrigger: CommandInteraction | Message) {
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    const queue = player.queue;

    queue.shuffle();

    commandTrigger.reply(i18n.__mf("shuffle.result")).then(purning);
  }
};