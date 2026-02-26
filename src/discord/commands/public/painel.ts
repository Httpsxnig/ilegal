import { createCommand } from "#base";
import { db } from "#database";
import {
    buildFacNoticeEditV2,
    buildFacSettingsV2PanelUpdate,
    hasManageGuildPermission,
    isComponentDisplayableTextOverflowError,
} from "#functions";
import { ApplicationCommandType } from "discord.js";

createCommand({
    name: "painel",
    description: "Abre o painel de configuração FAC",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        if (!hasManageGuildPermission(interaction.memberPermissions)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissão", "Voce precisa de Gerenciar Servidor para usar /painel."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        try {
            await interaction.editReply(
                buildFacSettingsV2PanelUpdate(interaction.guild, config),
            );
        } catch (error) {
            if (isComponentDisplayableTextOverflowError(error)) {
                await interaction.editReply(
                    buildFacNoticeEditV2(
                        "warning",
                        "Painel em modo seguro",
                        "O painel ficou grande demais para o Discord. Use os botõees para configurar e depois clique em Atualizar painel.",
                    ),
                ).catch(() => null);
                return;
            }

            await interaction.editReply(
                buildFacNoticeEditV2("error", "Falha ao abrir painel", "Não consegui abrir o painel agora. Tente novamente."),
            ).catch(() => null);
        }
    },
});
