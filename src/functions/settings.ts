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

const DISCORD_LABEL_MAX = 100;
const DISCORD_DESCRIPTION_MAX = 100;
const DISCORD_PLACEHOLDER_MAX = 150;
const COMPONENT_TEXT_MAX = 1000;
const PANEL_TEXT_BUDGET = 2600;
const PANEL_LIST_PAGE_SIZE = 8;

export const facPanelPageCustomIdPrefix = "painel/page";

export function clampText(text: string, max: number): string {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

export function isComponentDisplayableTextOverflowError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const parsed = error as {
        code?: unknown;
        message?: unknown;
        rawError?: { message?: unknown; };
    };

    if (parsed.code !== 50035) return false;
    const message = [
        typeof parsed.message === "string" ? parsed.message : "",
        typeof parsed.rawError?.message === "string" ? parsed.rawError.message : "",
    ].join(" ");

    return /COMPONENT_DISPLAYABLE_TEXT_SIZE_EXCEEDED|displayable text size exceeds maximum size of 4000/i.test(message);
}

function clampLabel(text: string) {
    return clampText(text, DISCORD_LABEL_MAX);
}

function clampDescription(text: string) {
    return clampText(text, DISCORD_DESCRIPTION_MAX);
}

function clampPlaceholder(text: string) {
    return clampText(text, DISCORD_PLACEHOLDER_MAX);
}

function clampComponentText(text: string) {
    return clampText(text, COMPONENT_TEXT_MAX);
}

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

const FAC_ROLE_IDS_CHAT_SWEEP_MS = 60 * 1000;
const facRoleIdsSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of facRoleIdsChatSessions.entries()) {
        if (session.expiresAt <= now) {
            facRoleIdsChatSessions.delete(userId);
        }
    }
}, FAC_ROLE_IDS_CHAT_SWEEP_MS);
facRoleIdsSweepTimer.unref();

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
    return clampComponentText(roleIds.map((id) => `<@&${id}>`).join(", "));
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
        .setPlaceholder(clampPlaceholder("Configurar canais FAC"))
        .addOptions(
            facPanelChannelKeys.map((key) => ({
                label: clampLabel(facPanelChannelLabels[key]),
                value: key,
                description: clampDescription("Definir canal"),
            })),
        );

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId("painel/select-role")
        .setPlaceholder(clampPlaceholder("Configurar cargos FAC"))
        .addOptions(
            facPanelRoleKeys.map((key) => ({
                label: clampLabel(facPanelRoleLabels[key]),
                value: key,
                description: clampDescription(key.endsWith("Ids") ? "Permite multiplos cargos" : "Permite um cargo"),
            })),
        );

    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("painel/publish-fac")
            .setStyle(ButtonStyle.Primary)
            .setLabel(clampLabel("Publicar Setagem FAC aqui")),
        new ButtonBuilder()
            .setCustomId("painel/edit-fac-ids")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("FAC por ID")),
        new ButtonBuilder()
            .setCustomId("painel/link-ramo")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Vincular ramo por FAC")),
        new ButtonBuilder()
            .setCustomId("painel/refresh")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Atualizar painel")),
        new ButtonBuilder()
            .setCustomId("painel/reset-all")
            .setStyle(ButtonStyle.Danger)
            .setLabel(clampLabel("Resetar tudo")),
    );

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(channelSelect),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
        actions,
    ];
}

function buildFacPanelPageRow(page: number, totalPages: number) {
    if (totalPages <= 1) return null;
    const safePage = Math.min(Math.max(0, Math.trunc(page)), totalPages - 1);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${facPanelPageCustomIdPrefix}/${safePage - 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Anterior"))
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`${facPanelPageCustomIdPrefix}/indicator`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel(`Pagina ${safePage + 1}/${totalPages}`))
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${facPanelPageCustomIdPrefix}/${safePage + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Proxima"))
            .setDisabled(safePage >= totalPages - 1),
    );
}

function buildFacSettingsV2PanelBase(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    const components = buildFacSettingsComponents();
    const ramoByFac = normalizeRamoRoleByFac((config as { ramoRoleByFac?: unknown; }).ramoRoleByFac);
    const facRoleIds = config.facRoleIds ?? [];
    const ramoEntries = Object.entries(ramoByFac);
    const totalPages = Math.max(
        1,
        Math.ceil(facRoleIds.length / PANEL_LIST_PAGE_SIZE),
        Math.ceil(ramoEntries.length / PANEL_LIST_PAGE_SIZE),
    );
    const safePage = Math.min(Math.max(0, Math.trunc(page)), totalPages - 1);
    const rangeStart = safePage * PANEL_LIST_PAGE_SIZE;
    const rangeEnd = rangeStart + PANEL_LIST_PAGE_SIZE;

    const facRoleSlice = facRoleIds.slice(rangeStart, rangeEnd);
    const facRoleLine = facRoleSlice.length
        ? facRoleSlice.map((id) => `<@&${id}>`).join(", ")
        : "`Nenhum cargo nesta pagina`";

    const ramoByFacLines = ramoEntries.length
        ? ramoEntries
            .slice(rangeStart, rangeEnd)
            .map(([facRoleId, ramoRoleIds]) => `- <@&${facRoleId}> -> ${ramoRoleIds.map((id) => `<@&${id}>`).join(", ")}`)
        : ["`Nenhum vinculo definido`"];

    let channelsText = clampComponentText(
        [
            "### Canais",
            `- ${facPanelChannelLabels.panelChannelId}: ${formatChannel(config.panelChannelId)}`,
            `- ${facPanelChannelLabels.analiseChannelId}: ${formatChannel(config.analiseChannelId)}`,
            `- ${facPanelChannelLabels.logChannelId}: ${formatChannel(config.logChannelId)}`,
        ].join("\n"),
    );

    let cargosText = clampComponentText(
        [
            "### Cargos",
            `- ${facPanelRoleLabels.verificadoRoleId}: ${formatRole(config.verificadoRoleId)}`,
            `- ${facPanelRoleLabels.ramoRoleIds}: ${formatRoleList(getDefaultRamoRoles(config))}`,
            `- ${facPanelRoleLabels.staffRoleIds}: ${formatRoleList(config.staffRoleIds)}`,
            `- ${facPanelRoleLabels.facRoleIds} (pagina ${safePage + 1}/${totalPages}, total ${facRoleIds.length}): ${facRoleLine}`,
        ].join("\n"),
    );

    let ramoText = clampComponentText(
        [
            "### Vinculo ramo por FAC (automatico)",
            `- Pagina ${safePage + 1}/${totalPages}, total ${ramoEntries.length}`,
            ...ramoByFacLines,
        ].join("\n"),
    );

    // Preventive global budget guard for displayable text in components.
    let displayTotal = channelsText.length + cargosText.length + ramoText.length;
    if (displayTotal > PANEL_TEXT_BUDGET) {
        const overflow = displayTotal - PANEL_TEXT_BUDGET;
        ramoText = clampText(ramoText, Math.max(220, ramoText.length - overflow));
        displayTotal = channelsText.length + cargosText.length + ramoText.length;
    }
    if (displayTotal > PANEL_TEXT_BUDGET) {
        const overflow = displayTotal - PANEL_TEXT_BUDGET;
        cargosText = clampText(cargosText, Math.max(260, cargosText.length - overflow));
    }

    const pageRow = buildFacPanelPageRow(safePage, totalPages);
    const dynamicComponents = pageRow ? [...components, pageRow] : components;

    return createContainer(
        "#4f46e5",
        createTextDisplay(clampComponentText(`## Painel de configuracao FAC | ${guild.name}`)),
        createSeparator(),
        createTextDisplay(channelsText),
        createSeparator(),
        createTextDisplay(cargosText),
        createSeparator(),
        createTextDisplay(ramoText),
        createSeparator(),
        ...dynamicComponents,
    );
}

export function buildFacSettingsV2PanelReply(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    return {
        flags: ["Ephemeral", "IsComponentsV2"],
        components: [buildFacSettingsV2PanelBase(guild, config, page)],
    } satisfies InteractionReplyOptions;
}

export function buildFacSettingsV2PanelUpdate(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    return {
        flags: ["IsComponentsV2"],
        components: [buildFacSettingsV2PanelBase(guild, config, page)],
    } satisfies InteractionUpdateOptions;
}

export function buildFacChannelPicker(key: FacPanelChannelKey) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`painel/channel/${key}`)
            .setChannelTypes(messageChannelTypes)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(clampPlaceholder(`Selecione ${facPanelChannelLabels[key].toLowerCase()}`)),
    );
}

export function buildFacRolePicker(key: FacPanelRoleKey) {
    const picker = new RoleSelectMenuBuilder()
        .setCustomId(`painel/role/${key}`)
        .setPlaceholder(clampPlaceholder(`Selecione ${facPanelRoleLabels[key].toLowerCase()}`));

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
            description: clampDescription("Escolher FAC para vincular ramo"),
        }));

    if (!options.length) return null;

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("painel/link-ramo/select-fac")
            .setPlaceholder(clampPlaceholder("Selecione a FAC..."))
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
            .setPlaceholder(clampPlaceholder(`Selecione a FAC... (${start + 1}-${Math.min(end, roles.length)} de ${roles.length})`))
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                pageRoles.map((role) => ({
                    label: role.name.slice(0, 100),
                    value: role.id,
                    description: clampDescription("Escolher FAC para vincular ramo"),
                })),
            ),
    );

    const navigation = totalPages > 1
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`painel/link-ramo/page/${safePage - 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel("Anterior"))
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId("painel/link-ramo/page-indicator")
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel(`Pagina ${safePage + 1}/${totalPages}`))
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`painel/link-ramo/page/${safePage + 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel("Proxima"))
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
            .setPlaceholder(clampPlaceholder("Selecione os cargos de ramo vinculados"))
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

