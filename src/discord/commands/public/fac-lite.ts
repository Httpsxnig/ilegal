import { createCommand } from "#base";
import { db } from "#database";
import {
    buildFacLitePanelMessageV2,
    buildFacNoticeEditV2,
    getTextChannelFast,
    hasManageGuildPermission,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "fac-lite",
    description: "Publica ou atualiza o painel de setagem FAC Lite",
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

        const config = await db.guildConfigs.get(interaction.guildId);
        const targetChannelId = config.panelChannelId ?? interaction.channelId;
        const targetChannel = await getTextChannelFast(interaction.client, interaction.guild, targetChannelId);

        if (!targetChannel || !("messages" in targetChannel)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Canal invalido", "Nao consegui acessar o canal para publicar o Setagem FAC Lite."),
            );
            return;
        }

        const panelPayload = buildFacLitePanelMessageV2(interaction.guild);
        const panelMessage = await targetChannel.send(panelPayload).catch(() => null);

        if (!panelMessage) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Falha ao publicar", "Nao consegui enviar o painel FAC Lite no canal escolhido."),
            );
            return;
        }

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Setagem FAC Lite publicado",
                `Painel enviado em <#${targetChannel.id}>.`,
            ),
        );
    },
});
