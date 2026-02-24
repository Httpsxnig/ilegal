import { createCommand } from "#base";
import { createContainer, createSection, createSeparator, createTextDisplay } from "@magicyan/discord";
import { ApplicationCommandType, ButtonBuilder, ButtonStyle } from "discord.js";

createCommand({
    name: "ping",
    description: "Teste de resposta do bot",
    type: ApplicationCommandType.ChatInput,
    async run(interaction) {
        const now = new Date();
        const container = createContainer(
            "#22c55e",
            createTextDisplay("## Pong"),
            createSeparator(),
            createSection(
                `Latencia registrada em \`${now.toLocaleTimeString("pt-BR")}\``,
                new ButtonBuilder()
                    .setCustomId(`remind/${now.toISOString()}`)
                    .setStyle(ButtonStyle.Success)
                    .setLabel("Ping"),
            ),
        );

        await interaction.reply({
            flags: ["Ephemeral", "IsComponentsV2"],
            components: [container],
        });
    },
});
