import type { FacRequestSchema, GuildConfigSchema } from "#database";
import { createContainer, createSeparator, createTextDisplay } from "@magicyan/discord";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    type Guild,
    type GuildMember,
    type InteractionReplyOptions,
    type InteractionUpdateOptions,
} from "discord.js";

export type FacRank = "LIDER" | "SUB";
export type FacStatus = "PENDING" | "APPROVED" | "DENIED";
type NoticeTone = "info" | "success" | "warning" | "error";

export const facPanelButtonCustomId = "fac/request/start";
export const facRoleSelectCustomId = "fac/request/select-role";
export const facRolePageCustomIdPrefix = "fac/request/page";

const toneMap: Record<NoticeTone, { color: `#${string}`; prefix: string; }> = {
    info: { color: "#3b82f6", prefix: "INFO" },
    success: { color: "#22c55e", prefix: "OK" },
    warning: { color: "#f59e0b", prefix: "ALERTA" },
    error: { color: "#ef4444", prefix: "ERRO" },
};

const DISCORD_LABEL_MAX = 100;
const DISCORD_DESCRIPTION_MAX = 100;
const DISCORD_PLACEHOLDER_MAX = 150;
const COMPONENT_TEXT_MAX = 1000;

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

export function formatFacDate(date: Date | number = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    return value.toLocaleString("pt-BR");
}

export function buildFacNoticeReplyV2(
    tone: NoticeTone,
    title: string,
    description: string,
    rows: ActionRowBuilder<any>[] = [],
    ephemeral = true,
) {
    const container = createFacNoticeContainer(tone, title, description, rows);

    const flags: ("Ephemeral" | "IsComponentsV2")[] = ["IsComponentsV2"];
    if (ephemeral) flags.unshift("Ephemeral");

    return {
        flags,
        components: [container],
    } satisfies InteractionReplyOptions;
}

export function buildFacNoticeUpdateV2(
    tone: NoticeTone,
    title: string,
    description: string,
    rows: ActionRowBuilder<any>[] = [],
) {
    const container = createFacNoticeContainer(tone, title, description, rows);

    return {
        flags: ["IsComponentsV2"],
        components: [container],
    } satisfies InteractionUpdateOptions;
}

export function buildFacNoticeEditV2(
    tone: NoticeTone,
    title: string,
    description: string,
    rows: ActionRowBuilder<any>[] = [],
) {
    return buildFacNoticeUpdateV2(tone, title, description, rows) satisfies InteractionReplyOptions;
}

export function buildFacNoticeMessageV2(
    tone: NoticeTone,
    title: string,
    description: string,
    rows: ActionRowBuilder<any>[] = [],
) {
    return {
        flags: ["IsComponentsV2"] as const,
        components: [createFacNoticeContainer(tone, title, description, rows)],
    };
}

export function createFacPanelRow() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(facPanelButtonCustomId)
            .setLabel(clampLabel("Solicitar Setagem FAC"))
            .setStyle(ButtonStyle.Primary),
    );
}

export function buildFacPanelMessageV2(guild: Guild) {
    const container = createContainer(
        "#3b82f6",
        createTextDisplay(clampComponentText(`## Setagem FAC | ${guild.name}`)),
        createSeparator(),
        createTextDisplay(
            clampComponentText(
            [
                "> Sistema de solicitacao de setagem FAC.",
                "> Clique no botao abaixo para abrir seu formulario.",
                "> A equipe staff vai analisar e aprovar ou negar seu pedido.",
            ].join("\n"),
            ),
        ),
        createSeparator(),
        createFacPanelRow(),
        createSeparator(),
        createTextDisplay("-# (c) Direitos reservados da Lotus Group"),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

export function createFacRoleSelectRow(guild: Guild, facRoleIds: string[]) {
    const options = facRoleIds
        .map((id) => guild.roles.cache.get(id))
        .filter((role): role is NonNullable<typeof role> => Boolean(role))
        .slice(0, 25)
        .map((role) => ({
            label: clampLabel(role.name),
            value: role.id,
            description: clampDescription(`Solicitar ${role.name}`),
        }));

    if (!options.length) return null;

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(facRoleSelectCustomId)
            .setPlaceholder(clampPlaceholder("Selecione o cargo FAC..."))
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options),
    );
}

export function createFacRoleSelectRows(guild: Guild, facRoleIds: string[], page = 0) {
    const roles = facRoleIds
        .map((id) => guild.roles.cache.get(id))
        .filter((role): role is NonNullable<typeof role> => Boolean(role));

    if (!roles.length) return null;

    const pageSize = 25;
    const totalPages = Math.ceil(roles.length / pageSize);
    const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 0;
    const safePage = Math.min(Math.max(0, requestedPage), totalPages - 1);
    const start = safePage * pageSize;
    const end = start + pageSize;

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(facRoleSelectCustomId)
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
                .setCustomId(`${facRolePageCustomIdPrefix}/${safePage - 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel("Anterior"))
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`${facRolePageCustomIdPrefix}/indicator`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(clampLabel(`Pagina ${safePage + 1}/${totalPages}`))
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${facRolePageCustomIdPrefix}/${safePage + 1}`)
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

export function createFacRequestModal(facRoleId: string) {
    return new ModalBuilder()
        .setCustomId(`fac/request/modal/${facRoleId}`)
        .setTitle(clampLabel("Solicitacao FAC"))
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

export function createAnalysisButtons(requestId: string, disabled = false) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`fac/review/approve/${requestId}`)
            .setLabel(clampLabel("Aprovar"))
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`fac/review/deny/${requestId}`)
            .setLabel(clampLabel("Negar"))
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
    );
}

export function buildAnalysisMessageV2(
    request: Pick<
    FacRequestSchema,
    "requestId" | "userId" | "facRoleId" | "nome" | "gameId" | "rank" | "status" | "createdAt" | "decidedBy" | "decidedAt"
    >,
    disableButtons = false,
) {
    const color = request.status === "APPROVED" ? "#22c55e" : request.status === "DENIED" ? "#ef4444" : "#f59e0b";
    const statusText = request.status === "PENDING"
        ? "PENDENTE"
        : request.status === "APPROVED"
            ? `APROVADO por <@${request.decidedBy}> em ${formatFacDate(request.decidedAt ?? new Date())}`
            : `NEGADO por <@${request.decidedBy}> em ${formatFacDate(request.decidedAt ?? new Date())}`;

    const details = clampComponentText(
        [
            `- Request ID: \`${request.requestId}\``,
            `- Status: **${statusText}**`,
            `- Usuario: <@${request.userId}> (\`${request.userId}\`)`,
            `- Cargo FAC: <@&${request.facRoleId}>`,
            `- Nome: ${request.nome}`,
            `- ID: ${request.gameId}`,
            `- **Rank:** ${request.rank}`,
            `- Data: ${formatFacDate(request.createdAt)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay(clampComponentText("## Analise de Setagem FAC")),
        createSeparator(),
        createTextDisplay(details),
        createSeparator(),
        createAnalysisButtons(request.requestId, disableButtons),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

export function buildFacLogMessageV2(params: {
    request: Pick<FacRequestSchema, "requestId" | "status" | "userId" | "facRoleId" | "nome" | "gameId" | "rank" | "createdAt" | "decidedAt">;
    reviewerId?: string | null;
    rolesApplied?: boolean;
    rolesError?: string;
    nicknameApplied?: boolean;
    nicknameError?: string;
}) {
    const { request, reviewerId } = params;
    const color = request.status === "APPROVED" ? "#22c55e" : "#ef4444";
    const roleStatus = request.status === "APPROVED"
        ? (params.rolesApplied ? "OK" : `FALHA${params.rolesError ? ` (${params.rolesError})` : ""}`)
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
            `- Staff: ${reviewerId ? `<@${reviewerId}>` : "`Nao definido`"}`,
            `- Criado em: ${formatFacDate(request.createdAt)}`,
            `- Decidido em: ${formatFacDate(request.decidedAt ?? new Date())}`,
            `- Cargos: ${clampText(roleStatus, 120)}`,
            `- Nickname: ${clampText(nickStatus, 120)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay(clampComponentText("## Log Final FAC")),
        createSeparator(),
        createTextDisplay(details),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}

export function normalizeFacForm(nomeRaw: string, gameIdRaw: string, rankRaw: string) {
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

export function buildFacNickname(rank: FacRank, nome: string, gameId: string) {
    const prefix = rank === "LIDER" ? "[01]" : "[02]";
    const suffix = ` | ${gameId}`;
    const base = `${prefix} `;
    let maxName = 32 - (base.length + suffix.length);
    if (maxName < 1) maxName = 1;
    const safeName = nome.slice(0, maxName).trimEnd() || nome.slice(0, 1);
    return `${base}${safeName}${suffix}`.slice(0, 32);
}

export function generateFacRequestId() {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `FAC-${Date.now().toString(36).toUpperCase()}-${random}`;
}

export function getMissingFacConfig(config: Partial<GuildConfigSchema>) {
    const missing: string[] = [];
    const ramoByFac = getRamoRoleByFacMap(config);
    const hasRamoLinked = Object.values(ramoByFac).some((roles) => roles.length > 0);
    const hasDefaultRamo = getDefaultRamoRoles(config).length > 0;

    if (!config.analiseChannelId) missing.push("analiseChannelId");
    if (!config.logChannelId) missing.push("logChannelId");
    if (!config.verificadoRoleId) missing.push("verificadoRoleId");
    if (!hasDefaultRamo && !hasRamoLinked) missing.push("ramoRoleIds/ramoRoleByFac");
    if (!config.staffRoleIds?.length) missing.push("staffRoleIds");
    if (!config.facRoleIds?.length) missing.push("facRoleIds");
    return missing;
}

export function hasAnyFacRole(member: GuildMember, facRoleIds: string[] = []) {
    return facRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

export function canReviewFac(member: GuildMember, config: Partial<GuildConfigSchema>) {
    if (member.permissions.has("ManageGuild")) return true;
    if (!config.staffRoleIds?.length) return false;
    return config.staffRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

export function getRamoRoleByFacMap(config: Partial<GuildConfigSchema>) {
    const value = (config as { ramoRoleByFac?: unknown; }).ramoRoleByFac;
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

export function resolveRamoRolesForFac(config: Partial<GuildConfigSchema>, facRoleId: string) {
    const byFac = getRamoRoleByFacMap(config);
    const linked = byFac[facRoleId] ?? [];
    if (linked.length) return linked;
    return getDefaultRamoRoles(config);
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

function normalizeName(value: string) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return null;
    const hasMention = /<@!?&?\d+>|@everyone|@here|<#\d+>/i.test(cleaned);
    const hasLink = /(https?:\/\/|www\.|discord\.gg\/)/i.test(cleaned);
    if (hasMention || hasLink) return null;
    return cleaned;
}

function normalizeRank(value: string): FacRank | null {
    const cleaned = value
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (cleaned === "LIDER") return "LIDER";
    if (cleaned === "SUB") return "SUB";
    return null;
}

function createFacNoticeContainer(
    tone: NoticeTone,
    title: string,
    description: string,
    rows: ActionRowBuilder<any>[] = [],
) {
    const palette = toneMap[tone];
    return createContainer(
        palette.color,
        createTextDisplay(clampComponentText(`## ${palette.prefix} | ${title}`)),
        createTextDisplay(clampComponentText(description)),
        ...(rows.length ? [createSeparator(), ...rows] : []),
    );
}
