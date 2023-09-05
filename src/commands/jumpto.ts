import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "jumpto",
  aliases: ["jump"],
  description: i18n.__("jumpto.description"),
  execute(message: Message, args: Array<any>) {
    if (!args.length || isNaN(args[0]))
      return message
        .reply(i18n.__mf("jumpto.usageReply", { prefix: bot.prefix}))
        .then(purning);

    if (!queueExists(message) || !canModifyQueue(message)) return;

    const player = bot.players.get(message.guild!.id)!;

    const queue = player.queue;

    if (queue.loop == "track") queue.loop = false;

    if (args[0] < -queue.index || args[0] >= queue.songs.length - queue.index)
      return message
        .reply(i18n.__mf("jumpto.errorNotValid"))
        .then(purning);

    player.jumpTo(queue.index + Number(args[0]));

    player.textChannel
      .send(i18n.__mf("jumpto.result", { arg: args[0] }))
      .then(purning);
  }
};