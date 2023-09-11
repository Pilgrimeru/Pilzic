import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "move",
  aliases: ["mv"],
  description: i18n.__("move.description"),
  options: [
    {
      name: "current_position",
      description: "the number of the song in the queue to move",
      type: ApplicationCommandOptionType.Number,
      required: true,
    }, {
      name: "new_position",
      description: "the new position in the queue",
      type: ApplicationCommandOptionType.Number,
      required: false,
    }
  ],
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(commandTrigger: CommandInteraction | Message, args: number[]) {

    if (!args.length || isNaN(args[0]) || args[0] < 1)
      return commandTrigger.reply(i18n.__mf("move.usagesReply", { prefix: bot.prefix })).then(purning);

    const player = bot.players.get(commandTrigger.guild!.id)!;

    if (!args[1]) args[1] = player.queue.index + 1;

    const song = player.queue.songs[args[0]];
    player.queue.move((Number(args[0]) + player.queue.index), (Number(args[1]) + player.queue.index));

    commandTrigger.reply(
      i18n.__mf("move.result", {
        title: song.title,
        index: args[1]
      })
    ).then(purning);
  }
};