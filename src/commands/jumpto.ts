import { ApplicationCommandOptionType } from "discord.js";
import { CommandTrigger } from "../core/helpers/CommandTrigger.js";
import { i18n } from "../i18n.config.js";
import { bot } from "../index.js";
import { Command, CommandConditions } from "../types/Command.js";
import { autoDelete } from "../utils/autoDelete.js";

export default class JumpCommand extends Command {
  constructor() {
    super({
      name: "jumpto",
      aliases: ["jump"],
      description: i18n.__("jumpto.description"),
      options: [
        {
          name: "position",
          description: i18n.__mf("jumpto.options.position"),
          type: ApplicationCommandOptionType.Number,
          required: true,
        }
      ],
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (!args.length || isNaN(Number(args[0])))
      return commandTrigger
        .reply(i18n.__mf("jumpto.usageReply", { prefix: bot.prefix }))
        .then(autoDelete);

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const queue = player.queue;
    const position = Number(args[0]);

    if (position < -queue.index || position >= queue.tracks.length - queue.index)
      return commandTrigger
        .reply(i18n.__mf("jumpto.errorNotValid"))
        .then(autoDelete);

    if (player.queue.loop === "track") player.queue.loop = "disabled";
    player.jumpTo(queue.index + position);

    return commandTrigger
      .reply(i18n.__mf("jumpto.result", { number: position }))
      .then(autoDelete);
  }
}