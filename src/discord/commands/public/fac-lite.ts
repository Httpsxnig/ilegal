import { createCommand } from "#base";
import {
    buildFacLitePanelMessageV2,
    buildFacNoticeEditV2,
    hasManageGuildPermission,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "fac-lite",
    description: "Publica ou atualiza o painel de setagem LOGS ILEGAL BAU",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        if (!hasManageGuildPermission(interaction.memberPermissions)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Apenas quem possui Gerenciar Servidor pode usar /fac-lite."),
            );
            return;
        }

        const targetChannel = interaction.channel;

        if (!targetChannel || !targetChannel.isTextBased() || !("messages" in targetChannel)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Canal invalido", "Nao consegui acessar o canal para publicar o Setagem LOGS ILEGAL BAU."),
            );
            return;
        }

        const panelPayload = buildFacLitePanelMessageV2(interaction.guild);
        const panelMessage = await targetChannel.send(panelPayload).catch(() => null);

        if (!panelMessage) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Falha ao publicar", "Nao consegui enviar o painel LOGS ILEGAL BAU no canal escolhido."),
            );
            return;
        }

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Setagem LOGS ILEGAL BAU publicado",
                `Painel enviado em <#${targetChannel.id}>.`,
            ),
        );
    },
});
