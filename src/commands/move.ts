import { ApplicationCommandOptionType, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { Command, CommandConditions } from "../types/Command";
import { purning } from "../utils/purning";

export default class MoveCommand extends Command {
  constructor() {
    super({
      name: "move",
      aliases: ["l"],
      description: i18n.__("loop.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL
      ],
      options: [
        {
          name: "mode",
          description: "the loop mode",
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: "track", value: "track" },
            { name: "queue", value: "queue" },
            { name: "disabled", value: "disabled" }
          ]
        }
      ],
    });
  }

  async execute(commandTrigger: CommandInteraction | Message, args: string[]) {

    if (!args.length || isNaN(Number(args[0])) || Number(args[0]) < 1)
      return commandTrigger.reply(i18n.__mf("move.usagesReply", { prefix: bot.prefix })).then(purning);

    const player = bot.players.get(commandTrigger.guild!.id)!;

    const pos1 = Number(args[0]);
    let pos2 = !args[1] ? player.queue.index + 1 : Number(args[1]);
    if (isNaN(pos2)) pos2 = player.queue.index + 1;

    const song = player.queue.songs[pos1];
    player.queue.move((pos1 + player.queue.index), (pos2 + player.queue.index));

    commandTrigger.reply(
      i18n.__mf("move.result", {
        title: song.title,
        index: pos2
      })
    ).then(purning);
  }
}