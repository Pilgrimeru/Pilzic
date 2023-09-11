import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { purning } from "../utils/purning";
import { CommandConditions } from "../interfaces/Command";

export default {
  name: "loop",
  aliases: ["l"],
  description: i18n.__("loop.description"),
  conditions: [
    CommandConditions.QUEUE_EXISTS,
    CommandConditions.IS_IN_SAME_CHANNEL
  ],
  async execute(commandTrigger: CommandInteraction | Message) {

    const player = bot.players.get(commandTrigger.guild!.id)!;

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
        .setCustomId("false")
        .setEmoji("🚫")
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await commandTrigger.reply({
      content: i18n.__("loop.chooseMode"),
      components: [row]
    });

    try {
      await response
      .awaitMessageComponent({
        time: 30000
      })
      .then(async (selectInteraction) => {
        if ((selectInteraction instanceof ButtonInteraction)) {
          if (selectInteraction.customId === "queue") {
            player.queue.loop = "queue"
          } else if (selectInteraction.customId === "track") {
            player.queue.loop = "track"
          } else {
            player.queue.loop = false;
          }
        }
        selectInteraction.update({content: i18n.__mf("loop.result", { loop: player.queue.loop}), components: []});
      })
    } catch (error) {
      response.delete().catch(() => null);
    }

    purning(response);
  }
};