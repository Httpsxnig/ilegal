import { createCommand } from "#base";
import { db } from "#database";
import {
    buildFacLiteSettingsPanelUpdate,
    buildFacNoticeEditV2,
    hasManageGuildPermission,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "painel-fac-lite",
    description: "Abre o painel de configuração do LOGS ILEGAL BAU",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        if (!hasManageGuildPermission(interaction.memberPermissions)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Voce precisa de Gerenciar Servidor para usar /painel-fac-lite."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.editReply(
            buildFacLiteSettingsPanelUpdate(interaction.guild, config),
        );
    },
});
