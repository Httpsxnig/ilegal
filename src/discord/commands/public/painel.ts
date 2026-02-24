import { createCommand } from "#base";
import { db } from "#database";
import {
    buildFacNoticeEditV2,
    buildFacSettingsV2PanelUpdate,
    hasManageGuildPermission,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "painel",
    description: "Abre o painel de configuracao FAC",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        if (!hasManageGuildPermission(interaction.memberPermissions)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Voce precisa de Gerenciar Servidor para usar /painel."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.editReply(
            buildFacSettingsV2PanelUpdate(interaction.guild, config),
        );
    },
});
