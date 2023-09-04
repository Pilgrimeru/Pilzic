import { Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

const pattern = /^[1-9][0-9]{0,2}(\s*,\s*[1-9][0-9]{0,2})*$/;

export default {
  name: "remove",
  aliases: ["rm"],
  description: i18n.__("remove.description"),
  execute(message: Message, args: any[]) {
    
    if (!queueExists(message) || !canModifyQueue(message)) return;

    if (!args.length) return message.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
    
    const player = bot.players.get(message.guild!.id)!;
    
    const removeArgs = args.join("");
    

    if (pattern.test(removeArgs)) {

      const indexs = removeArgs.split(",").map((arg) => Number(arg) + player.queue.index);
      let removed = player.queue.remove(...indexs);

      if (removed.length === 0) {
        return message.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
      } 

      if (removed.length === 1) {
        return player.textChannel.send(
          i18n.__mf("remove.result", {
            title: removed[0].title
          })
        ).then(purning);
      }

      return player.textChannel.send(
        i18n.__mf("remove.results", {
          titles: removed.map((song) => song.title).join(",\n")
        })
      ).then(purning);
        
    } else {
      return message.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
    }
  }
};