import { createResponder } from "#base";
import { db } from "#database";
import {
    buildFacChannelPicker,
    buildFacNoticeReplyV2,
    buildFacNoticeUpdateV2,
    buildFacPanelMessageV2,
    buildFacRamoFacPicker,
    buildFacRamoRolePicker,
    buildFacRolePicker,
    buildFacSettingsV2PanelUpdate,
    clearFacRoleIdsChatSession,
    facPanelChannelLabels,
    facPanelRoleLabels,
    getRamoRoleByFacMap,
    isFacPanelChannelKey,
    isFacPanelRoleKey,
    startFacRoleIdsChatSession,
} from "#functions";
import { ResponderType } from "@constatic/base";

async function ensurePanelPermission(interaction: {
    guildId: string | null;
    user: { id: string; };
    memberPermissions: { has(permission: unknown): boolean; } | null;
    reply: (options: Record<string, unknown>) => Promise<unknown>;
}) {
    if (!interaction.guildId) return false;

    if (interaction.memberPermissions?.has("ManageGuild")) return true;
    await interaction.reply(
        buildFacNoticeReplyV2("error", "Sem permissao", "Voce precisa de Gerenciar Servidor para alterar configuracoes.", [], true),
    );
    return false;
}

createResponder({
    customId: "painel/select-channel",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;

        const key = interaction.values[0];
        if (!isFacPanelChannelKey(key)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Canal invalido", "A chave do canal selecionado nao existe."),
            );
            return;
        }

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "Selecionar canal",
                `Selecione o novo valor para ${facPanelChannelLabels[key].toLowerCase()}.`,
                [buildFacChannelPicker(key)],
            ),
        );
    },
});

createResponder({
    customId: "painel/edit-fac-ids",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;
        clearFacRoleIdsChatSession(interaction.user.id);
        startFacRoleIdsChatSession(interaction.user.id, interaction.guildId, interaction.channelId);

        const config = await db.guildConfigs.get(interaction.guildId);
        const currentIds = config.facRoleIds?.length ? config.facRoleIds.join(", ") : "nenhum";

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "FAC por chat ativado",
                [
                    "Envie nesta sala os IDs dos cargos FAC (virgula, espaco, linha ou mencao).",
                    "Exemplo: `123456789012345678, 234567890123456789`",
                    "Digite `cancelar` para sair.",
                    "Tempo limite: 3 minutos.",
                    "",
                    `Atual: ${currentIds}`,
                ].join("\n"),
            ),
        );
    },
});

createResponder({
    customId: "painel/link-ramo",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;
        const config = await db.guildConfigs.get(interaction.guildId);
        const picker = buildFacRamoFacPicker(interaction.guild, config.facRoleIds ?? []);
        if (!picker) {
            await interaction.reply(
                buildFacNoticeReplyV2("warning", "FAC nao configurada", "Defina primeiro os cargos FAC no painel."),
            );
            return;
        }

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "Vincular ramo por FAC",
                "Selecione a FAC que recebera cargos de ramo automaticos na aprovacao.",
                [picker],
            ),
        );
    },
});

createResponder({
    customId: "painel/link-ramo/select-fac",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;
        const config = await db.guildConfigs.get(interaction.guildId);
        const facRoleId = interaction.values[0];
        if (!config.facRoleIds?.includes(facRoleId)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "FAC invalida", "Essa FAC nao esta na lista configurada."),
            );
            return;
        }

        await interaction.update(
            buildFacNoticeUpdateV2(
                "info",
                "Selecionar cargos de ramo",
                `Agora selecione os cargos de ramo vinculados para <@&${facRoleId}>.`,
                [buildFacRamoRolePicker(facRoleId)],
            ),
        );
    },
});

createResponder({
    customId: "painel/link-ramo/set/:facRoleId",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    parse: (params) => ({ facRoleId: params.facRoleId }),
    async run(interaction, { facRoleId }) {
        if (!await ensurePanelPermission(interaction)) return;

        const roleIds = [...new Set(interaction.values)];
        if (!roleIds.length) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Cargo invalido", "Selecione ao menos um cargo de ramo valido."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        if (!config.facRoleIds?.includes(facRoleId)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "FAC invalida", "Essa FAC nao esta na lista configurada."),
            );
            return;
        }

        const current = getRamoRoleByFacMap(config);
        current[facRoleId] = roleIds;
        config.set("ramoRoleByFac", current);
        await config.save();

        await interaction.update(
            buildFacNoticeUpdateV2(
                "success",
                "Vinculo salvo",
                `Agora <@&${facRoleId}> seta automaticamente: ${roleIds.map((id) => `<@&${id}>`).join(", ")}.`,
            ),
        );
    },
});

createResponder({
    customId: "painel/channel/:key",
    types: [ResponderType.ChannelSelect],
    cache: "cached",
    parse: (params) => ({ key: params.key }),
    async run(interaction, { key }) {
        if (!await ensurePanelPermission(interaction)) return;

        if (!isFacPanelChannelKey(key)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Canal invalido", "A chave do canal selecionado nao existe."),
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
                "Canal atualizado",
                `${facPanelChannelLabels[key]} atualizado para <#${channelId}>.`,
            ),
        );
    },
});

createResponder({
    customId: "painel/select-role",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;

        const key = interaction.values[0];
        if (!isFacPanelRoleKey(key)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Cargo invalido", "A chave do cargo selecionado nao existe."),
            );
            return;
        }

        await interaction.reply(
            buildFacNoticeReplyV2(
                "info",
                "Selecionar cargo",
                `Selecione o novo valor para ${facPanelRoleLabels[key].toLowerCase()}.`,
                [buildFacRolePicker(key)],
            ),
        );
    },
});

createResponder({
    customId: "painel/role/:key",
    types: [ResponderType.RoleSelect],
    cache: "cached",
    parse: (params) => ({ key: params.key }),
    async run(interaction, { key }) {
        if (!await ensurePanelPermission(interaction)) return;

        if (!isFacPanelRoleKey(key)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Cargo invalido", "A chave do cargo selecionado nao existe."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        const roleIds = [...new Set(interaction.values)];

        if (key === "ramoRoleIds" || key === "staffRoleIds" || key === "facRoleIds") {
            config.set(key, roleIds);
            await config.save();
            await interaction.update(
                buildFacNoticeUpdateV2(
                    "success",
                    "Cargos atualizados",
                    `${facPanelRoleLabels[key]} atualizados para: ${roleIds.map((id) => `<@&${id}>`).join(", ")}.`,
                ),
            );
            return;
        }

        const roleId = roleIds[0];
        if (!roleId) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Cargo invalido", "Selecione um cargo valido."),
            );
            return;
        }

        config.set(key, roleId);
        await config.save();
        await interaction.update(
            buildFacNoticeUpdateV2(
                "success",
                "Cargo atualizado",
                `${facPanelRoleLabels[key]} atualizado para <@&${roleId}>.`,
            ),
        );
    },
});

createResponder({
    customId: "painel/reset-all",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;

        const config = await db.guildConfigs.get(interaction.guildId);

        if (config.panelChannelId && config.panelMessageId) {
            const panelChannel = await interaction.guild.channels.fetch(config.panelChannelId).catch(() => null);
            if (panelChannel?.isTextBased() && "messages" in panelChannel) {
                const panelMessage = await panelChannel.messages.fetch(config.panelMessageId).catch(() => null);
                if (panelMessage) {
                    await panelMessage.delete().catch(() => null);
                }
            }
        }

        await db.guildConfigs.updateOne(
            { guildId: interaction.guildId },
            {
                $set: {
                    facRoleIds: [],
                    staffRoleIds: [],
                    ramoRoleIds: [],
                    ramoRoleByFac: {},
                },
                $unset: {
                    panelChannelId: 1,
                    panelMessageId: 1,
                    analiseChannelId: 1,
                    logChannelId: 1,
                    verificadoRoleId: 1,
                    ramoRoleId: 1,
                },
            },
        );

        const updatedConfig = await db.guildConfigs.get(interaction.guildId);
        await interaction.update(
            buildFacSettingsV2PanelUpdate(interaction.guild, updatedConfig),
        );
    },
});

createResponder({
    customId: "painel/refresh",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;
        const config = await db.guildConfigs.get(interaction.guildId);
        await interaction.update(
            buildFacSettingsV2PanelUpdate(interaction.guild, config),
        );
    },
});

createResponder({
    customId: "painel/publish-fac",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        if (!await ensurePanelPermission(interaction)) return;

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || !("send" in channel) || !("messages" in channel)) {
            await interaction.reply(
                buildFacNoticeReplyV2("error", "Canal invalido", "Este canal nao aceita mensagens de texto."),
            );
            return;
        }

        const config = await db.guildConfigs.get(interaction.guildId);
        const payload = buildFacPanelMessageV2(interaction.guild);

        let panelMessage = null;
        if (config.panelMessageId && config.panelChannelId === channel.id) {
            panelMessage = await channel.messages.fetch(config.panelMessageId).catch(() => null);
        }

        if (panelMessage) {
            await panelMessage.edit(payload).catch(() => null);
        } else {
            panelMessage = await channel.send(payload);
        }

        config.set("panelChannelId", channel.id);
        config.set("panelMessageId", panelMessage.id);
        await config.save();

        await interaction.reply(
            buildFacNoticeReplyV2("success", "Painel FAC publicado", `Painel enviado em <#${channel.id}>.`),
        );
    },
});
