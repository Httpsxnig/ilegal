import { createResponder } from "#base";
import { db } from "#database";
import {
    buildFacLiteChannelPicker,
    buildFacLiteRolePicker,
    buildFacLiteSettingsPanelUpdate,
    clearFacLiteRoleIdsChatSession,
    buildFacNoticeReplyV2,
    buildFacNoticeUpdateV2,
    facLiteSettingsPageCustomIdPrefix,
    facLiteSettingsChannelLabels,
    facLiteSettingsRoleLabels,
    startFacLiteRoleIdsChatSession,
    isFacLiteSettingsChannelKey,
    isFacLiteSettingsRoleKey,
} from "#functions";
import { ResponderType } from "@constatic/base";

async function ensureFacLitePanelPermission(interaction: {
    guildId: string | null;
    memberPermissions: { has(permission: unknown): boolean; } | null;
    reply: (options: Record<string, unknown>) => Promise<unknown>;
}) {
    if (!interaction.guildId) return false;
    if (interaction.memberPermissions?.has("ManageGuild")) return true;

    await interaction.reply(
        buildFacNoticeReplyV2("error", "Sem permissao", "Voce precisa de Gerenciar Servidor para alterar o LOGS ILEGAL BAU."),
    );
    return false;
}

createResponder({
    customId: "faclite/painel/select-channel",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        const key = interaction.values[0];
        if (!isFacLiteSettingsChannelKey(key)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Canal invalido", "A chave do canal selecionado nao existe no LOGS ILEGAL BAU."),
            );
            return;
        }

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "Selecionar canal LOGS ILEGAL BAU",
                `Selecione o novo valor para ${facLiteSettingsChannelLabels[key].toLowerCase()}.`,
                [buildFacLiteChannelPicker(key)],
            ),
        );
    },
});

createResponder({
    customId: "faclite/painel/channel/:key",
    types: [ResponderType.ChannelSelect],
    cache: "cached",
    parse: (params) => ({ key: params.key }),
    async run(interaction, { key }) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        if (!isFacLiteSettingsChannelKey(key)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Canal invalido", "A chave do canal selecionado nao existe no LOGS ILEGAL BAU."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        const channelId = interaction.values[0];
        config.set(key, channelId);
        await config.save();

        await interaction.update(
            buildFacNoticeUpdateV2(
                "success",
                "Canal LOGS ILEGAL BAU atualizado",
                `${facLiteSettingsChannelLabels[key]} atualizado para <#${channelId}>.`,
            ),
        );
    },
});

createResponder({
    customId: "faclite/painel/select-role",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        const key = interaction.values[0];
        if (!isFacLiteSettingsRoleKey(key)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Cargo invalido", "A chave do cargo selecionado nao existe no LOGS ILEGAL BAU."),
            );
            return;
        }

        if (key === "facLiteRoleIds") {
            clearFacLiteRoleIdsChatSession(interaction.user.id);
            startFacLiteRoleIdsChatSession(interaction.user.id, interaction.guildId, interaction.channelId);

            const config = await db.guildConfigs.get(interaction.guildId);
            const currentIds = config.facLiteRoleIds?.length ? config.facLiteRoleIds.join(", ") : "nenhum";

            await interaction.reply(
                buildFacNoticeReplyV2(
                    "info",
                    "Cargos LOGS ILEGAL BAU por ID",
                    [
                        "Envie nesta sala os IDs dos cargos LOGS ILEGAL BAU (virgula, espaco, linha ou mencao).",
                        "Exemplo: `123456789012345678, 234567890123456789`",
                        "Digite `cancelar` para sair.",
                        "Tempo limite: 3 minutos.",
                        "",
                        `Atual: ${currentIds}`,
                    ].join("\n"),
                ),
            );
            return;
        }

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "Selecionar cargo LOGS ILEGAL BAU",
                `Selecione os novos cargos para ${facLiteSettingsRoleLabels[key].toLowerCase()}.`,
                [buildFacLiteRolePicker(key)],
            ),
        );
    },
});

createResponder({
    customId: "faclite/painel/role/:key",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    parse: (params) => ({ key: params.key }),
    async run(interaction, { key }) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        if (!isFacLiteSettingsRoleKey(key)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Cargo invalido", "A chave do cargo selecionado nao existe no LOGS ILEGAL BAU."),
            );
            return;
        }

        const roleIds = [...new Set(interaction.values)];
        if (!roleIds.length) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Cargo invalido", "Selecione ao menos um cargo valido."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        config.set(key, roleIds);
        await config.save();

        await interaction.update(
            buildFacNoticeUpdateV2(
                "success",
                "Cargos LOGS ILEGAL BAU atualizados",
                `${facLiteSettingsRoleLabels[key]} atualizados para: ${roleIds.map((id) => `<@&${id}>`).join(", ")}.`,
            ),
        );
    },
});

createResponder({
    customId: "faclite/painel/refresh",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.update(
            buildFacLiteSettingsPanelUpdate(interaction.guild, config),
        );
    },
});

createResponder({
    customId: `${facLiteSettingsPageCustomIdPrefix}/:page`,
    types: [ResponderType.Button],
    cache: "cached",
    parse: (params) => ({ page: Number(params.page) }),
    async run(interaction, { page }) {
        if (!await ensureFacLitePanelPermission(interaction)) return;
        if (!Number.isFinite(page)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Pagina invalida", "Nao consegui abrir essa pagina do painel."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.update(
            buildFacLiteSettingsPanelUpdate(interaction.guild, config, page),
        );
    },
});

createResponder({
    customId: "faclite/painel/reset-all",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensureFacLitePanelPermission(interaction)) return;

        await db.guildConfigs.updateOne(
            { guildId: interaction.guildId },
            {
                $set: {
                    facLiteStaffRoleIds: [],
                    facLiteRoleIds: [],
                },
                $unset: {
                    facLiteAnaliseChannelId: 1,
                    facLiteLogChannelId: 1,
                },
            },
        );

        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.update(
            buildFacLiteSettingsPanelUpdate(interaction.guild, config),
        );
    },
});
