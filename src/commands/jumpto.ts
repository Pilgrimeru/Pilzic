import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

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

  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {
    if (!args.length || isNaN(Number(args[0])))
      return commandTrigger
        .reply(i18n.__mf("jumpto.usageReply", { prefix: bot.prefix }))
        .then(purning);

    const player = bot.players.get(commandTrigger.guild!.id)!;

    const queue = player.queue;
    const position = Number(args[0]);

    if (position < -queue.index || position >= queue.songs.length - queue.index)
      return commandTrigger
        .reply(i18n.__mf("jumpto.errorNotValid"))
        .then(purning);

    player.jumpTo(queue.index + position);

    return commandTrigger
      .reply(i18n.__mf("jumpto.result", { number: position }))
      .then(purning);
  }
}