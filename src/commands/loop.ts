import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message } from "discord.js";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { canModifyQueue, queueExists } from "../utils/canExecute";
import { purning } from "../utils/purning";

export default {
  name: "loop",
  aliases: ["l"],
  description: i18n.__("loop.description"),
  async execute(message: Message) {

    if (!queueExists(message) || !canModifyQueue(message)) return;
    const player = bot.players.get(message.guild!.id)!;

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

    const resultsMessage = await message.reply({
      content: i18n.__("loop.chooseMode"),
      components: [row]
    });

    await resultsMessage
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
      .catch(() => resultsMessage.delete().catch(() => null));

    purning(resultsMessage);
  }
};