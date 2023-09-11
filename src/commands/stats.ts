import { CommandInteraction, EmbedBuilder, Message } from "discord.js";
import { memoryUsage, pid } from "node:process";
import si from "systeminformation";
import { bot } from "../index";
import { purning } from "../utils/purning";


export default {
  name: "stats",
  description: "Get information about the performance of the bot.",
  async execute(commandTrigger: CommandInteraction | Message) {
    let memory = await si.mem();
    let process = (await si.processes()).list.find(p => p.pid === pid);

    let nodeCpuPer = process ? Math.round(process.cpu * 100) / 100 : "";
    let sysCpuPer = Math.round((await si.fullLoad()) * 100) / 100;
    let usedRamPer = Math.round(((memory.active) / (memory.total)) * 10000) / 100;
    let freeRam = Math.round((memory.total - memory.active) / 1024 / 1024);
    let nodeRamUsage = Math.round(memoryUsage().heapTotal / 1024 / 1024);

    let embed = new EmbedBuilder()
      .setTitle("Stats of " + bot.user?.username)
      .setFields(
        {
          name: `**System**`,
          value: `CPU: ${sysCpuPer}%
                  Memory: ${usedRamPer}% (free : ${freeRam}Mo)`,
          inline: false,
        },
        {
          name: `**Bot**`,
          value: `CPU: ${nodeCpuPer}% 
                  Memory: ${nodeRamUsage}Mo`,
          inline: false,
        }
      )
      .setThumbnail(bot.user ? bot.user.avatarURL() : null);
      commandTrigger.reply({ embeds: [embed] }).then(purning);
  }
};