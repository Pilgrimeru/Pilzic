import { CommandTrigger } from '@core/helpers/CommandTrigger';
import { Command, CommandConditions } from '@custom-types/Command';
import { autoDelete } from '@utils/autoDelete';
import { ApplicationCommandOptionType } from 'discord.js';
import { i18n } from 'i18n.config';
import { bot } from 'index';

const pattern = /^[1-9]\d{0,2}(\s*,\s*[1-9]\d{0,2})*$/;

export default class RemoveCommand extends Command {

  constructor() {
    super({
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
          description: i18n.__("remove.options.position"),
          type: ApplicationCommandOptionType.String,
          required: true,
        }
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {

    if (!args.length) return await commandTrigger.reply(i18n.__("remove.usageReply", { prefix: bot.prefix })).then(autoDelete);

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const removeArgs = args.join("");

    if (pattern.test(removeArgs)) {

      const indexs = removeArgs.split(",").map((arg) => Number(arg) + player.queue.index);
      const removed = player.queue.remove(...indexs);

      if (removed.length === 0) {
        return await commandTrigger.reply(i18n.__("remove.usageReply", { prefix: bot.prefix })).then(autoDelete);
      }

      if (removed.length === 1) {
        return await commandTrigger.reply(
          i18n.__("remove.result", {
            title: removed[0].title
          })
        ).then(autoDelete);
      }

      return await commandTrigger.reply(
        i18n.__mf("remove.results", {
          titles: removed.map((track) => track.title).join(",\n")
        })
      ).then(autoDelete);

    } else {
      return await commandTrigger.reply(i18n.__("remove.usageReply", { prefix: bot.prefix })).then(autoDelete);
    }
  }
}