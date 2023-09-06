import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "move",
  aliases: ["mv"],
  cooldown: 2,
  description: i18n.__("move.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  execute(message: Message, args: number[]) {

    if (!args.length || isNaN(args[0]) || args[0] < 1)
      return message.reply(i18n.__mf("move.usagesReply", { prefix: bot.prefix })).then(purning);

    const player = bot.players.get(message.guild!.id)!;

    if (!args[1]) args[1] = player.queue.index + 1;

    const song = player.queue.songs[args[0]];
    player.queue.move((Number(args[0]) + player.queue.index), (Number(args[1]) + player.queue.index));

    player.textChannel.send(
      i18n.__mf("move.result", {
        title: song.title,
        index: args[1]
      })
    ).then(purning);
  }
};