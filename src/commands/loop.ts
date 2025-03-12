import { CommandTrigger } from "@core/helpers/CommandTrigger";
import { Command, CommandConditions } from "@custom-types/Command";
import { autoDelete } from "@utils/autoDelete";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { i18n } from "i18n.config";
import { bot } from "index";

export default class LoopCommand extends Command {
  constructor() {
    super({
      name: "loop",
      aliases: ["l"],
      description: i18n.__("loop.description"),
      conditions: [
        CommandConditions.QUEUE_EXISTS,
        CommandConditions.IS_IN_SAME_CHANNEL,
      ],
      options: [
        {
          name: "mode",
          description: i18n.__("loop.options.mode"),
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: "track", value: "track" },
            { name: "queue", value: "queue" },
            { name: "disabled", value: "disabled" },
          ],
        },
      ],
    });
  }

  async execute(commandTrigger: CommandTrigger, args: string[]) {
    const player = bot.playerManager.getPlayer(commandTrigger.guild.id)!;

    if (args.length >= 1) {
      if (
        args[0] === "queue" ||
        args[0] === "track" ||
        args[0] === "disabled"
      ) {
        player.queue.loop = args[0];
        return commandTrigger
          .reply(i18n.__mf("loop.result", { loop: player.queue.loop }))
          .then(autoDelete);
      }
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("queue")
        .setEmoji("🔁")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("track")
        .setEmoji("🔂")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("disabled")
        .setEmoji("🚫")
        .setStyle(ButtonStyle.Secondary),
    );

    const response = await commandTrigger.reply({
      content: i18n.__("loop.chooseMode"),
      components: [row],
    });

    try {
      await response
        .awaitMessageComponent({ time: 30000 })
        .then(async (selectInteraction) => {
          const customId = selectInteraction.customId;
          if (
            customId === "queue" ||
            customId === "track" ||
            customId === "disabled"
          ) {
            player.queue.loop = customId;
          }
          await selectInteraction.update({
            content: i18n.__mf("loop.result", { loop: player.queue.loop }),
            components: [],
          });
          void autoDelete(response);
        });
    } catch (error) {
      void commandTrigger.deleteReply();
    }
  }
}
