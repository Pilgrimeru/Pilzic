import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

const pattern = /^[1-9][0-9]{0,2}(\s*,\s*[1-9][0-9]{0,2})*$/;

export default {
  name: "remove",
  aliases: ["rm"],
  description: i18n.__("remove.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  options: [
    {
      name: "position",
      description: "You can also remove multiple songs with ',' symbole",
      type: ApplicationCommandOptionType.String,
      required: true,
    }
  ],
  execute(commandTrigger: CommandInteraction | Message, args: any[]) {
    
    if (!args.length) return commandTrigger.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
    
    const player = bot.players.get(commandTrigger.guild!.id)!;
    
    const removeArgs = args.join("");
    

    if (pattern.test(removeArgs)) {

      const indexs = removeArgs.split(",").map((arg) => Number(arg) + player.queue.index);
      let removed = player.queue.remove(...indexs);

      if (removed.length === 0) {
        return commandTrigger.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
      } 

      if (removed.length === 1) {
        return commandTrigger.reply(
          i18n.__mf("remove.result", {
            title: removed[0].title
          })
        ).then(purning);
      }

      return commandTrigger.reply(
        i18n.__mf("remove.results", {
          titles: removed.map((song) => song.title).join(",\n")
        })
      ).then(purning);
        
    } else {
      return commandTrigger.reply(i18n.__mf("remove.usageReply", { prefix: bot.prefix })).then(purning);
    }
  }
};