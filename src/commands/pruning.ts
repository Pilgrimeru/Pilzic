import { Message, TextChannel } from "discord.js";
import { writeFile } from "fs";
import { i18n } from "../i18n.config";
import { Config } from "../interfaces/Config";
import { purning } from "../utils/purning";

export default {
  name: "pruning",
  description: i18n.__("pruning.description"),
  async execute(message: Message) {
    
    let config: Config | undefined;

    try {
      config = require("../config.json");
    } catch (error) {
      config = undefined;
      console.error(error);
    }

    if (config) {
      config.PRUNING = !config.PRUNING;

      writeFile("./config.json", JSON.stringify(config, null, 2), (err) => {
        if (err) {
          console.log(err);
          return (message.channel as TextChannel).send(i18n.__("pruning.errorWritingFile")).then(purning);
        }

        return (message.channel as TextChannel)
          .send(
            i18n.__mf("pruning.result", {
              result: config!.PRUNING ? i18n.__("common.enabled") : i18n.__("common.disabled")
            })
          )
          .then(purning);
      });
    }
  }
};