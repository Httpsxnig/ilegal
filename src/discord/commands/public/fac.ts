import { createCommand } from "#base";
import { db } from "#database";
import {
    buildFacNoticeEditV2,
    buildFacPanelMessageV2,
    getTextChannelFast,
    hasManageGuildPermission,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "fac",
    description: "Publica ou atualiza o painel de setagem FAC",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        if (!hasManageGuildPermission(interaction.memberPermissions)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Apenas quem possui Gerenciar Servidor pode usar /fac."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        const targetChannelId = config.panelChannelId ?? interaction.channelId;
        const targetChannel = await getTextChannelFast(interaction.client, interaction.guild, targetChannelId);

        if (!targetChannel || !("messages" in targetChannel)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Canal invalido", "Nao consegui acessar o canal para publicar o Setagem FAC."),
            );
            return;
        }

        const panelPayload = buildFacPanelMessageV2(interaction.guild);

        let panelMessage = null;
        if (config.panelMessageId && config.panelChannelId === targetChannel.id) {
            panelMessage = await targetChannel.messages.fetch(config.panelMessageId).catch(() => null);
        }

        if (panelMessage) {
            await panelMessage.edit(panelPayload).catch(() => null);
        } else {
            panelMessage = await targetChannel.send(panelPayload);
        }

        config.set("panelChannelId", targetChannel.id);
        config.set("panelMessageId", panelMessage.id);
        await config.save();

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Setagem FAC publicado",
                `Painel enviado em <#${targetChannel.id}>.`,
            ),
        );
    },
});
