import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import { ApplicationCommandOptionType } from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class MoveCommand extends Command {
  constructor() {
    super({
      name: "move",
      aliases: ["l"],
      description: i18n.__("move.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL,
      ],
      options: [
        {
          name: "position",
          description: i18n.__("move.options.position"),
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "new_position",
          description: i18n.__("move.options.new_position"),
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    if (!args.length || isNaN(Number(args[0])) || Number(args[0]) < 1)
      return await commandTrigger
        .reply(i18n.__("move.usagesReply", { prefix: bot.prefix }))
        .then(autoDelete);

    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    const pos1 = Number(args[0]);
    let pos2 = !args[1] ? player.queue.index + 1 : Number(args[1]);
    if (isNaN(pos2)) pos2 = player.queue.index + 1;

    const track = player.queue.tracks[pos1];
    player.queue.move(pos1 + player.queue.index, pos2 + player.queue.index);

    await commandTrigger
      .reply(
        i18n.__mf("move.result", {
          title: track.title,
          index: pos2,
        }),
      )
      .then(autoDelete);
  }
}
