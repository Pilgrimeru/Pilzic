import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "skipto",
  aliases: ["st"],
  description: i18n.__("skipto.description"),
  execute(message: Message, args: Array<any>) {
    if (!args.length || isNaN(args[0]))
      return message
        .reply(i18n.__mf("skipto.usageReply", { prefix: bot.prefix, name: module.exports.name }))
        .then(purning);

    if (!queueExists(message) || !canModifyQueue(message)) return;

    const player = bot.players.get(message.guild!.id)!;

    const queue = player.queue;

    if (queue.loop == "track") queue.loop = false;

    if (args[0] < 1 && args[0] > queue.songs.length - queue.index)
      return message
        .reply(i18n.__mf("skipto.errorNotValid", { length: queue.songs.length }))
        .then(purning);

    ;

    player.skipTo(queue.index + Number(args[0]));

    player.textChannel
      .send(i18n.__mf("skipto.result", { arg: args[0] }))
      .then(purning);
  }
};