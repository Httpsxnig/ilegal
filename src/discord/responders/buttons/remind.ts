import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createTextDisplay } from "@magicyan/discord";
import { time } from "discord.js";
import { z } from "zod";

const schema = z.object({
    date: z.string().transform((value) => new Date(value)),
});

createResponder({
    customId: "remind/:date",
    types: [ResponderType.Button],
    parse: schema.parse,
    cache: "cached",
    async run(interaction, { date }) {
        const container = createContainer(
            "#3b82f6",
            createTextDisplay("## Lembrete"),
            createTextDisplay(`Comando executado ${time(date, "R")}.`),
        );

        await interaction.reply({
            flags: ["Ephemeral", "IsComponentsV2"],
            components: [container],
        });
    },
});
