import type { GuildConfigSchema } from "#database";
import { createContainer, createSeparator, createTextDisplay } from "@magicyan/discord";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    type ApplicationCommandOptionAllowedChannelTypes,
    type Guild,
    type InteractionReplyOptions,
    type InteractionUpdateOptions,
} from "discord.js";

export const facPanelChannelKeys = ["panelChannelId", "analiseChannelId", "logChannelId"] as const;
export const facPanelRoleKeys = ["verificadoRoleId", "ramoRoleIds", "staffRoleIds", "facRoleIds"] as const;

export type FacPanelChannelKey = typeof facPanelChannelKeys[number];
export type FacPanelRoleKey = typeof facPanelRoleKeys[number];

export const facPanelChannelLabels: Record<FacPanelChannelKey, string> = {
    panelChannelId: "Canal do Setagem FAC",
    analiseChannelId: "Canal de analise FAC",
    logChannelId: "Canal de logs FAC",
};

export const facPanelRoleLabels: Record<FacPanelRoleKey, string> = {
    verificadoRoleId: "Cargo Verificado",
    ramoRoleIds: "Cargo Ramo (padrao)",
    staffRoleIds: "Cargos Staff",
    facRoleIds: "Cargos FAC",
};

const messageChannelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
] as ApplicationCommandOptionAllowedChannelTypes[];

const FAC_ROLE_IDS_CHAT_TTL_MS = 3 * 60 * 1000;
const facRoleIdsChatSessions = new Map<string, {
    guildId: string;
    channelId: string;
    expiresAt: number;
}>();

export function isFacPanelChannelKey(value: string): value is FacPanelChannelKey {
    return (facPanelChannelKeys as readonly string[]).includes(value);
}

export function isFacPanelRoleKey(value: string): value is FacPanelRoleKey {
    return (facPanelRoleKeys as readonly string[]).includes(value);
}

function formatChannel(channelId?: string | null) {
    return channelId ? `<#${channelId}>` : "`Nao definido`";
}

function formatRole(roleId?: string | null) {
    return roleId ? `<@&${roleId}>` : "`Nao definido`";
}

function formatRoleList(roleIds?: string[] | null) {
    if (!roleIds?.length) return "`Nao definido`";
    return roleIds.map((id) => `<@&${id}>`).join(", ");
}

function normalizeRamoRoleByFac(value: unknown) {
    if (!value) return {} as Record<string, string[]>;
    const normalizeEntry = (raw: unknown) => {
        if (Array.isArray(raw)) return [...new Set(raw.filter((id): id is string => typeof id === "string" && !!id.trim()))];
        if (typeof raw === "string" && raw.trim()) return [raw.trim()];
        return [] as string[];
    };

    if (value instanceof Map) {
        const mapped: Record<string, string[]> = {};
        for (const [facId, raw] of value.entries()) {
            if (typeof facId !== "string") continue;
            const ids = normalizeEntry(raw);
            if (ids.length) mapped[facId] = ids;
        }
        return mapped;
    }
    if (typeof value === "object") {
        const mapped: Record<string, string[]> = {};
        for (const [facId, raw] of Object.entries(value as Record<string, unknown>)) {
            const ids = normalizeEntry(raw);
            if (ids.length) mapped[facId] = ids;
        }
        return mapped;
    }
    return {} as Record<string, string[]>;
}

function getDefaultRamoRoles(config: Partial<GuildConfigSchema>) {
    const configured = Array.isArray(config.ramoRoleIds)
        ? [...new Set(config.ramoRoleIds.filter((id): id is string => typeof id === "string" && !!id.trim()))]
        : [];
    if (configured.length) return configured;
    // compatibilidade com dado antigo salvo como string
    if (config.ramoRoleId?.trim()) return [config.ramoRoleId.trim()];
    return [] as string[];
}

function buildFacSettingsComponents() {
    const channelSelect = new StringSelectMenuBuilder()
        .setCustomId("painel/select-channel")
        .setPlaceholder("Configurar canais FAC")
        .addOptions(
            facPanelChannelKeys.map((key) => ({
                label: facPanelChannelLabels[key],
                value: key,
                description: "Definir canal",
            })),
        );

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId("painel/select-role")
        .setPlaceholder("Configurar cargos FAC")
        .addOptions(
            facPanelRoleKeys.map((key) => ({
                label: facPanelRoleLabels[key],
                value: key,
                description: key.endsWith("Ids") ? "Permite multiplos cargos" : "Permite um cargo",
            })),
        );

    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("painel/publish-fac")
            .setStyle(ButtonStyle.Primary)
            .setLabel("Publicar Setagem FAC aqui"),
        new ButtonBuilder()
            .setCustomId("painel/edit-fac-ids")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("FAC por ID"),
        new ButtonBuilder()
            .setCustomId("painel/link-ramo")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Vincular ramo por FAC"),
        new ButtonBuilder()
            .setCustomId("painel/refresh")
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Atualizar painel"),
        new ButtonBuilder()
            .setCustomId("painel/reset-all")
            .setStyle(ButtonStyle.Danger)
            .setLabel("Resetar tudo"),
    );

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(channelSelect),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
        actions,
    ];
}

function buildFacSettingsV2PanelBase(guild: Guild, config: Partial<GuildConfigSchema>) {
    const components = buildFacSettingsComponents();
    const ramoByFac = normalizeRamoRoleByFac((config as { ramoRoleByFac?: unknown; }).ramoRoleByFac);
    const ramoByFacLines = Object.entries(ramoByFac).length
        ? Object.entries(ramoByFac).map(([facRoleId, ramoRoleIds]) => `- <@&${facRoleId}> -> ${ramoRoleIds.map((id) => `<@&${id}>`).join(", ")}`)
        : ["`Nenhum vinculo definido`"];

    return createContainer(
        "#4f46e5",
        createTextDisplay(`## Painel de configuracao FAC | ${guild.name}`),
        createSeparator(),
        createTextDisplay(
            [
                "### Canais",
                `- ${facPanelChannelLabels.panelChannelId}: ${formatChannel(config.panelChannelId)}`,
                `- ${facPanelChannelLabels.analiseChannelId}: ${formatChannel(config.analiseChannelId)}`,
                `- ${facPanelChannelLabels.logChannelId}: ${formatChannel(config.logChannelId)}`,
            ].join("\n"),
        ),
        createSeparator(),
        createTextDisplay(
            [
                "### Cargos",
                `- ${facPanelRoleLabels.verificadoRoleId}: ${formatRole(config.verificadoRoleId)}`,
                `- ${facPanelRoleLabels.ramoRoleIds}: ${formatRoleList(getDefaultRamoRoles(config))}`,
                `- ${facPanelRoleLabels.staffRoleIds}: ${formatRoleList(config.staffRoleIds)}`,
                `- ${facPanelRoleLabels.facRoleIds}: ${formatRoleList(config.facRoleIds)}`,
            ].join("\n"),
        ),
        createSeparator(),
        createTextDisplay(
            [
                "### Vinculo ramo por FAC (automatico)",
                ...ramoByFacLines,
            ].join("\n"),
        ),
        createSeparator(),
        ...components,
    );
}

export function buildFacSettingsV2PanelReply(guild: Guild, config: Partial<GuildConfigSchema>) {
    return {
        flags: ["Ephemeral", "IsComponentsV2"],
        components: [buildFacSettingsV2PanelBase(guild, config)],
    } satisfies InteractionReplyOptions;
}

export function buildFacSettingsV2PanelUpdate(guild: Guild, config: Partial<GuildConfigSchema>) {
    return {
        flags: ["IsComponentsV2"],
        components: [buildFacSettingsV2PanelBase(guild, config)],
    } satisfies InteractionUpdateOptions;
}

export function buildFacChannelPicker(key: FacPanelChannelKey) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`painel/channel/${key}`)
            .setChannelTypes(messageChannelTypes)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(`Selecione ${facPanelChannelLabels[key].toLowerCase()}`),
    );
}

export function buildFacRolePicker(key: FacPanelRoleKey) {
    const picker = new RoleSelectMenuBuilder()
        .setCustomId(`painel/role/${key}`)
        .setPlaceholder(`Selecione ${facPanelRoleLabels[key].toLowerCase()}`);

    if (key === "ramoRoleIds" || key === "staffRoleIds" || key === "facRoleIds") {
        picker.setMinValues(1).setMaxValues(25);
    } else {
        picker.setMinValues(1).setMaxValues(1);
    }

    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(picker);
}

export function buildFacRamoFacPicker(guild: Guild, facRoleIds: string[]) {
    const options = facRoleIds
        .map((roleId) => guild.roles.cache.get(roleId))
        .filter((role): role is NonNullable<typeof role> => Boolean(role))
        .slice(0, 25)
        .map((role) => ({
            label: role.name.slice(0, 100),
            value: role.id,
            description: "Escolher FAC para vincular ramo",
        }));

    if (!options.length) return null;

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("painel/link-ramo/select-fac")
            .setPlaceholder("Selecione a FAC...")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options),
    );
}

export function buildFacRamoFacPickerPage(guild: Guild, facRoleIds: string[], page = 0) {
    const roles = facRoleIds
        .map((roleId) => guild.roles.cache.get(roleId))
        .filter((role): role is NonNullable<typeof role> => Boolean(role));

    if (!roles.length) return null;

    const pageSize = 25;
    const totalPages = Math.ceil(roles.length / pageSize);
    const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 0;
    const safePage = Math.min(Math.max(0, requestedPage), totalPages - 1);
    const start = safePage * pageSize;
    const end = start + pageSize;
    const pageRoles = roles.slice(start, end);

    const picker = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("painel/link-ramo/select-fac")
            .setPlaceholder(`Selecione a FAC... (${start + 1}-${Math.min(end, roles.length)} de ${roles.length})`)
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                pageRoles.map((role) => ({
                    label: role.name.slice(0, 100),
                    value: role.id,
                    description: "Escolher FAC para vincular ramo",
                })),
            ),
    );

    const navigation = totalPages > 1
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`painel/link-ramo/page/${safePage - 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Anterior")
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId("painel/link-ramo/page-indicator")
                .setStyle(ButtonStyle.Secondary)
                .setLabel(`Pagina ${safePage + 1}/${totalPages}`)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`painel/link-ramo/page/${safePage + 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel("Proxima")
                .setDisabled(safePage >= totalPages - 1),
        )
        : null;

    return {
        picker,
        navigation,
        currentPage: safePage,
        totalPages,
        totalItems: roles.length,
    };
}

export function buildFacRamoRolePicker(facRoleId: string) {
    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId(`painel/link-ramo/set/${facRoleId}`)
            .setPlaceholder("Selecione os cargos de ramo vinculados")
            .setMinValues(1)
            .setMaxValues(25),
    );
}

export function startFacRoleIdsChatSession(userId: string, guildId: string, channelId: string) {
    facRoleIdsChatSessions.set(userId, {
        guildId,
        channelId,
        expiresAt: Date.now() + FAC_ROLE_IDS_CHAT_TTL_MS,
    });
}

export function getFacRoleIdsChatSession(userId: string) {
    const session = facRoleIdsChatSessions.get(userId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        facRoleIdsChatSessions.delete(userId);
        return null;
    }
    return session;
}

export function clearFacRoleIdsChatSession(userId: string) {
    facRoleIdsChatSessions.delete(userId);
}

export function parseRoleIdsInput(raw: string) {
    const tokens = raw
        .split(/[\s,\n\r\t;]+/g)
        .map((part) => part.trim().replace(/[<@&>#]/g, ""))
        .filter(Boolean);

    const valid: string[] = [];
    const invalid: string[] = [];
    for (const token of tokens) {
        if (/^\d{17,20}$/.test(token)) valid.push(token);
        else invalid.push(token);
    }

    return {
        roleIds: [...new Set(valid)],
        invalid: [...new Set(invalid)],
    };
}
