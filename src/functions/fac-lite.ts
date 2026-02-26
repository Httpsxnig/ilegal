import type { FacLiteRequestSchema, GuildConfigSchema } from "#database";
import { createContainer, createSeparator, createTextDisplay } from "@magicyan/discord";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    LabelBuilder,
    ModalBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ApplicationCommandOptionAllowedChannelTypes,
    type Guild,
    type GuildMember,
    type InteractionReplyOptions,
    type InteractionUpdateOptions,
} from "discord.js";

export type FacLiteRank = "LIDER" | "SUB";
export type FacLiteStatus = "PENDING" | "APPROVED" | "DENIED";

export const facLitePanelButtonCustomId = "faclite/request/start";
export const facLiteRoleSelectCustomId = "faclite/request/select-role";
export const facLiteRolePageCustomIdPrefix = "faclite/request/page";
export const facLiteSettingsPageCustomIdPrefix = "faclite/painel/page";

export const facLiteSettingsChannelKeys = ["facLiteAnaliseChannelId", "facLiteLogChannelId"] as const;
export const facLiteSettingsRoleKeys = ["facLiteStaffRoleIds", "facLiteRoleIds"] as const;

export type FacLiteSettingsChannelKey = typeof facLiteSettingsChannelKeys[number];
export type FacLiteSettingsRoleKey = typeof facLiteSettingsRoleKeys[number];

export const facLiteSettingsChannelLabels: Record<FacLiteSettingsChannelKey, string> = {
    facLiteAnaliseChannelId: "Canal de analise LOGS ILEGAL BAU",
    facLiteLogChannelId: "Canal de logs LOGS ILEGAL BAU",
};

export const facLiteSettingsRoleLabels: Record<FacLiteSettingsRoleKey, string> = {
    facLiteStaffRoleIds: "Cargos Staff LOGS ILEGAL BAU",
    facLiteRoleIds: "Cargos LOGS ILEGAL BAU",
};

const DISCORD_LABEL_MAX = 100;
const DISCORD_DESCRIPTION_MAX = 100;
const DISCORD_PLACEHOLDER_MAX = 150;
const COMPONENT_TEXT_MAX = 1000;
const FAC_LITE_SETTINGS_PAGE_SIZE = 8;

function clampText(text: string, max: number) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
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

const messageChannelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
] as ApplicationCommandOptionAllowedChannelTypes[];

const FAC_LITE_ROLE_IDS_CHAT_TTL_MS = 3 * 60 * 1000;
const facLiteRoleIdsChatSessions = new Map<string, {
    guildId: string;
    channelId: string;
    expiresAt: number;
}>();

const FAC_LITE_ROLE_IDS_CHAT_SWEEP_MS = 60 * 1000;
const facLiteRoleIdsSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [userId, session] of facLiteRoleIdsChatSessions.entries()) {
        if (session.expiresAt <= now) {
            facLiteRoleIdsChatSessions.delete(userId);
        }
    }
}, FAC_LITE_ROLE_IDS_CHAT_SWEEP_MS);
facLiteRoleIdsSweepTimer.unref();

export function isFacLiteSettingsChannelKey(value: string): value is FacLiteSettingsChannelKey {
    return (facLiteSettingsChannelKeys as readonly string[]).includes(value);
}

export function isFacLiteSettingsRoleKey(value: string): value is FacLiteSettingsRoleKey {
    return (facLiteSettingsRoleKeys as readonly string[]).includes(value);
}

export function startFacLiteRoleIdsChatSession(userId: string, guildId: string, channelId: string) {
    facLiteRoleIdsChatSessions.set(userId, {
        guildId,
        channelId,
        expiresAt: Date.now() + FAC_LITE_ROLE_IDS_CHAT_TTL_MS,
    });
}

export function getFacLiteRoleIdsChatSession(userId: string) {
    const session = facLiteRoleIdsChatSessions.get(userId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        facLiteRoleIdsChatSessions.delete(userId);
        return null;
    }
    return session;
}

export function clearFacLiteRoleIdsChatSession(userId: string) {
    facLiteRoleIdsChatSessions.delete(userId);
}

function formatChannel(channelId?: string | null) {
    return channelId ? `<#${channelId}>` : "`Não definido`";
}

export function formatFacLiteDate(date: Date | number = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    return value.toLocaleString("pt-BR");
}

export function getMissingFacLiteConfig(config: Partial<GuildConfigSchema>) {
    const missing: string[] = [];
    if (!config.facLiteAnaliseChannelId) missing.push("facLiteAnaliseChannelId");
    if (!config.facLiteLogChannelId) missing.push("facLiteLogChannelId");
    if (!config.facLiteStaffRoleIds?.length) missing.push("facLiteStaffRoleIds");
    if (!config.facLiteRoleIds?.length) missing.push("facLiteRoleIds");
    return missing;
}

export function canReviewFacLite(member: GuildMember, config: Partial<GuildConfigSchema>) {
    if (member.permissions.has("ManageGuild")) return true;
    if (!config.facLiteStaffRoleIds?.length) return false;
    return config.facLiteStaffRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

export function generateFacLiteRequestId() {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `FLITE-${Date.now().toString(36).toUpperCase()}-${random}`;
}

export function normalizeFacLiteForm(nomeRaw: string, gameIdRaw: string, rankRaw: string) {
    const nome = normalizeName(nomeRaw);
    if (!nome) {
        return { ok: false as const, error: "Nome invalido. Evite mencoes e links." };
    }

    const gameId = gameIdRaw.trim();
    if (!/^\d{1,20}$/.test(gameId)) {
        return { ok: false as const, error: "ID invalido. Use apenas numeros." };
    }

    const rank = normalizeRank(rankRaw);
    if (!rank) {
        return { ok: false as const, error: "Rank invalido. Use LIDER ou SUB." };
    }

    return {
        ok: true as const,
        data: { nome, gameId, rank },
    };
}

export function buildFacLiteNickname(rank: FacLiteRank, nome: string, gameId: string) {
    const prefix = rank === "LIDER" ? "[01]" : "[02]";
    const suffix = ` | ${gameId}`;
    const base = `${prefix} `;
    let maxName = 32 - (base.length + suffix.length);
    if (maxName < 1) maxName = 1;
    const safeName = nome.slice(0, maxName).trimEnd() || nome.slice(0, 1);
    return `${base}${safeName}${suffix}`.slice(0, 32);
}

export function createFacLitePanelRow() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(facLitePanelButtonCustomId)
            .setLabel(clampLabel("Solicitar Setagem LOGS ILEGAL BAU"))
            .setStyle(ButtonStyle.Primary),
    );
}

export function buildFacLitePanelMessageV2(guild: Guild) {
    const container = createContainer(
        "#0ea5e9",
        createTextDisplay(clampComponentText(`## Setagem LOGS ILEGAL BAU | ${guild.name}`)),
        createSeparator(),
        createTextDisplay(
            clampComponentText(
                [
                    "> Sistema LOGS ILEGAL BAU: seta apenas o cargo FAC escolhido.",
                    "> Clique no botao abaixo para enviar sua Solicitação.",
                    "> Nao aplica cargo de ramo nem verificado.",
                ].join("\n"),
            ),
        ),
        createSeparator(),
        createFacLitePanelRow(),
        createSeparator(),
        createTextDisplay("-# (©) Direitos reservados da Lotus Group"),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

function buildFacLiteSettingsActionRows() {
    const channelSelect = new StringSelectMenuBuilder()
        .setCustomId("faclite/painel/select-channel")
        .setPlaceholder(clampPlaceholder("Configurar canais LOGS ILEGAL BAU"))
        .addOptions(
            facLiteSettingsChannelKeys.map((key) => ({
                label: clampLabel(facLiteSettingsChannelLabels[key]),
                value: key,
                description: clampDescription("Definir canal"),
            })),
        );

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId("faclite/painel/select-role")
        .setPlaceholder(clampPlaceholder("Configurar cargos LOGS ILEGAL BAU"))
        .addOptions(
            facLiteSettingsRoleKeys.map((key) => ({
                label: clampLabel(facLiteSettingsRoleLabels[key]),
                value: key,
                description: clampDescription("Selecionar cargos"),
            })),
        );

    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("faclite/painel/refresh")
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Atualizar painel")),
        new ButtonBuilder()
            .setCustomId("faclite/painel/reset-all")
            .setStyle(ButtonStyle.Danger)
            .setLabel(clampLabel("Resetar tudo")),
    );

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(channelSelect),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
        actions,
    ];
}

function buildFacLiteSettingsPageRow(page: number, totalPages: number) {
    if (totalPages <= 1) return null;

    const safePage = Math.min(Math.max(0, Math.trunc(page)), totalPages - 1);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${facLiteSettingsPageCustomIdPrefix}/${safePage - 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Anterior"))
            .setDisabled(safePage <= 0),
        new ButtonBuilder()
            .setCustomId(`${facLiteSettingsPageCustomIdPrefix}/indicator`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel(`Pagina ${safePage + 1}/${totalPages}`))
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`${facLiteSettingsPageCustomIdPrefix}/${safePage + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(clampLabel("Proxima"))
            .setDisabled(safePage >= totalPages - 1),
    );
}

function buildFacLiteSettingsPanelBase(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    const staffRoleIds = config.facLiteStaffRoleIds ?? [];
    const facRoleIds = config.facLiteRoleIds ?? [];
    const totalPages = Math.max(
        1,
        Math.ceil(staffRoleIds.length / FAC_LITE_SETTINGS_PAGE_SIZE),
        Math.ceil(facRoleIds.length / FAC_LITE_SETTINGS_PAGE_SIZE),
    );
    const safePage = Math.min(Math.max(0, Math.trunc(page)), totalPages - 1);
    const start = safePage * FAC_LITE_SETTINGS_PAGE_SIZE;
    const end = start + FAC_LITE_SETTINGS_PAGE_SIZE;

    const staffSlice = staffRoleIds.slice(start, end);
    const facSlice = facRoleIds.slice(start, end);
    const staffLine = staffSlice.length ? staffSlice.map((id) => `<@&${id}>`).join(", ") : "`Nenhum cargo nesta pagina`";
    const facLine = facSlice.length ? facSlice.map((id) => `<@&${id}>`).join(", ") : "`Nenhum cargo nesta pagina`";

    const pageRow = buildFacLiteSettingsPageRow(safePage, totalPages);
    const actions = buildFacLiteSettingsActionRows();
    const dynamicRows = pageRow ? [...actions, pageRow] : actions;

    return createContainer(
        "#0ea5e9",
        createTextDisplay(clampComponentText(`## Painel LOGS ILEGAL BAU | ${guild.name}`)),
        createSeparator(),
        createTextDisplay(
            clampComponentText(
                [
                    "### Canais",
                    `- ${facLiteSettingsChannelLabels.facLiteAnaliseChannelId}: ${formatChannel(config.facLiteAnaliseChannelId)}`,
                    `- ${facLiteSettingsChannelLabels.facLiteLogChannelId}: ${formatChannel(config.facLiteLogChannelId)}`,
                ].join("\n"),
            ),
        ),
        createSeparator(),
        createTextDisplay(
            clampComponentText(
                [
                    "### Cargos",
                    `- ${facLiteSettingsRoleLabels.facLiteStaffRoleIds} (pagina ${safePage + 1}/${totalPages}, total ${staffRoleIds.length}): ${staffLine}`,
                    `- ${facLiteSettingsRoleLabels.facLiteRoleIds} (pagina ${safePage + 1}/${totalPages}, total ${facRoleIds.length}): ${facLine}`,
                ].join("\n"),
            ),
        ),
        createSeparator(),
        ...dynamicRows,
    );
}

export function buildFacLiteSettingsPanelReply(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    return {
        flags: ["Ephemeral", "IsComponentsV2"],
        components: [buildFacLiteSettingsPanelBase(guild, config, page)],
    } satisfies InteractionReplyOptions;
}

export function buildFacLiteSettingsPanelUpdate(guild: Guild, config: Partial<GuildConfigSchema>, page = 0) {
    return {
        flags: ["IsComponentsV2"],
        components: [buildFacLiteSettingsPanelBase(guild, config, page)],
    } satisfies InteractionUpdateOptions;
}

export function buildFacLiteChannelPicker(key: FacLiteSettingsChannelKey) {
    return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`faclite/painel/channel/${key}`)
            .setChannelTypes(messageChannelTypes)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(clampPlaceholder(`Selecione ${facLiteSettingsChannelLabels[key].toLowerCase()}`)),
    );
}

export function buildFacLiteRolePicker(key: FacLiteSettingsRoleKey) {
    const picker = new RoleSelectMenuBuilder()
        .setCustomId(`faclite/painel/role/${key}`)
        .setPlaceholder(clampPlaceholder(`Selecione ${facLiteSettingsRoleLabels[key].toLowerCase()}`));

    picker.setMinValues(1).setMaxValues(25);
    return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(picker);
}

export function createFacLiteRoleSelectRows(guild: Guild, facRoleIds: string[], page = 0) {
    const roles = facRoleIds
        .map((id) => guild.roles.cache.get(id))
        .filter((role): role is NonNullable<typeof role> => Boolean(role));

    if (!roles.length) return null;

    const pageSize = 25;
    const totalPages = Math.ceil(roles.length / pageSize);
    const safePage = Math.min(Math.max(0, Math.trunc(page)), totalPages - 1);
    const start = safePage * pageSize;
    const end = start + pageSize;

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(facLiteRoleSelectCustomId)
            .setPlaceholder(clampPlaceholder(`Selecione o cargo FAC... (${start + 1}-${Math.min(end, roles.length)} de ${roles.length})`))
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                roles.slice(start, end).map((role) => ({
                    label: clampLabel(role.name),
                    value: role.id,
                    description: clampDescription(`Solicitar ${role.name}`),
                })),
            ),
    );

    const navigation = totalPages > 1
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`${facLiteRolePageCustomIdPrefix}/${safePage - 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel("Anterior"))
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`${facLiteRolePageCustomIdPrefix}/indicator`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel(`Pagina ${safePage + 1}/${totalPages}`))
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${facLiteRolePageCustomIdPrefix}/${safePage + 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel("Proxima"))
                .setDisabled(safePage >= totalPages - 1),
        )
        : null;

    return {
        rows: navigation ? [selectRow, navigation] : [selectRow],
        currentPage: safePage,
        totalPages,
        totalItems: roles.length,
    };
}

export function createFacLiteRequestModal(facRoleId: string) {
    return new ModalBuilder()
        .setCustomId(`faclite/request/modal/${facRoleId}`)
        .setTitle(clampLabel("Solicitação LOGS ILEGAL BAU"))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(clampLabel("Nome"))
                .setDescription(clampDescription("Informe o nome para setagem."))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("nome")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(40),
                ),
            new LabelBuilder()
                .setLabel(clampLabel("ID"))
                .setDescription(clampDescription("Informe apenas numeros."))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("gameId")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(1)
                        .setMaxLength(20),
                ),
            new LabelBuilder()
                .setLabel(clampLabel("Rank"))
                .setDescription(clampDescription("Escolha o rank desejado."))
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId("rank")
                        .setPlaceholder(clampPlaceholder("Selecione o rank..."))
                        .setRequired(true)
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(
                            {
                                label: clampLabel("Lider"),
                                value: "LIDER",
                                description: clampDescription("Prefixo [01]"),
                            },
                            {
                                label: clampLabel("Sub"),
                                value: "SUB",
                                description: clampDescription("Prefixo [02]"),
                            },
                        ),
                ),
        );
}

export function createFacLiteAnalysisButtons(requestId: string, disabled = false) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`faclite/review/approve/${requestId}`)
            .setLabel(clampLabel("Aprovar"))
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`faclite/review/deny/${requestId}`)
            .setLabel(clampLabel("Negar"))
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

export function buildFacLiteAnalysisMessageV2(
    request: Pick<
    FacLiteRequestSchema,
    "requestId" | "userId" | "facRoleId" | "nome" | "gameId" | "rank" | "status" | "createdAt" | "decidedBy" | "decidedAt"
    >,
    disableButtons = false,
) {
    const color = request.status === "APPROVED" ? "#22c55e" : request.status === "DENIED" ? "#ef4444" : "#f59e0b";
    const statusText = request.status === "PENDING"
        ? "PENDENTE"
        : request.status === "APPROVED"
            ? `APROVADO por <@${request.decidedBy}> em ${formatFacLiteDate(request.decidedAt ?? new Date())}`
            : `NEGADO por <@${request.decidedBy}> em ${formatFacLiteDate(request.decidedAt ?? new Date())}`;

    const details = clampComponentText(
        [
            `- Request ID: \`${request.requestId}\``,
            `- Status: **${statusText}**`,
            `- Usuario: <@${request.userId}> (\`${request.userId}\`)`,
            `- Cargo FAC: <@&${request.facRoleId}>`,
            `- Nome: ${request.nome}`,
            `- ID: ${request.gameId}`,
            `- **Rank:** ${request.rank}`,
            `- Data: ${formatFacLiteDate(request.createdAt)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay("## Analise de Setagem LOGS ILEGAL BAU"),
        createSeparator(),
        createTextDisplay(details),
        createSeparator(),
        createFacLiteAnalysisButtons(request.requestId, disableButtons),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

export function buildFacLiteLogMessageV2(params: {
    request: Pick<FacLiteRequestSchema, "requestId" | "status" | "userId" | "facRoleId" | "nome" | "gameId" | "rank" | "createdAt" | "decidedAt">;
    reviewerId?: string | null;
    roleApplied?: boolean;
    roleError?: string;
    nicknameApplied?: boolean;
    nicknameError?: string;
}) {
    const { request, reviewerId } = params;
    const color = request.status === "APPROVED" ? "#22c55e" : "#ef4444";
    const roleStatus = request.status === "APPROVED"
        ? (params.roleApplied ? "OK" : `FALHA${params.roleError ? ` (${params.roleError})` : ""}`)
        : "NAO APLICADO";
    const nickStatus = request.status === "APPROVED"
        ? (params.nicknameApplied ? "OK" : `FALHA${params.nicknameError ? ` (${params.nicknameError})` : ""}`)
        : "NAO APLICADO";

    const details = clampComponentText(
        [
            `- Request ID: \`${request.requestId}\``,
            `- Status: **${request.status === "APPROVED" ? "APROVADO" : "NEGADO"}**`,
            `- Usuario: <@${request.userId}> (\`${request.userId}\`)`,
            `- Cargo FAC: <@&${request.facRoleId}>`,
            `- Nome/ID: ${request.nome} | ${request.gameId}`,
            `- **Rank:** ${request.rank}`,
            `- Staff: ${reviewerId ? `<@${reviewerId}>` : "`Não definido`"}`,
            `- Criado em: ${formatFacLiteDate(request.createdAt)}`,
            `- Decidido em: ${formatFacLiteDate(request.decidedAt ?? new Date())}`,
            `- Aplicacao do cargo: ${clampText(roleStatus, 120)}`,
            `- Nickname: ${clampText(nickStatus, 120)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay("## Log Final LOGS ILEGAL BAU"),
        createSeparator(),
        createTextDisplay(details),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

function normalizeName(value: string) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return null;
    const hasMention = /<@!?&?\d+>|@everyone|@here|<#\d+>/i.test(cleaned);
    const hasLink = /(https?:\/\/|www\.|discord\.gg\/)/i.test(cleaned);
    if (hasMention || hasLink) return null;
    return cleaned;
}

function normalizeRank(value: string): FacLiteRank | null {
    const cleaned = value
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (cleaned === "LIDER") return "LIDER";
    if (cleaned === "SUB") return "SUB";
    return null;
}
