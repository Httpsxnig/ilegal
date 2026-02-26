import type { FacLiteRequestSchema, GuildConfigSchema } from "#database";
import { createContainer, createSeparator, createTextDisplay } from "@magicyan/discord";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    type Guild,
} from "discord.js";

export type FacLiteStatus = "PENDING" | "APPROVED" | "DENIED";

export const facLitePanelButtonCustomId = "faclite/request/start";
export const facLiteRoleSelectCustomId = "faclite/request/select-role";
export const facLiteRolePageCustomIdPrefix = "faclite/request/page";

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

export function formatFacLiteDate(date: Date | number = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    return value.toLocaleString("pt-BR");
}

export function getMissingFacLiteConfig(config: Partial<GuildConfigSchema>) {
    const missing: string[] = [];
    if (!config.analiseChannelId) missing.push("analiseChannelId");
    if (!config.logChannelId) missing.push("logChannelId");
    if (!config.staffRoleIds?.length) missing.push("staffRoleIds");
    if (!config.facRoleIds?.length) missing.push("facRoleIds");
    return missing;
}

export function generateFacLiteRequestId() {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `FLITE-${Date.now().toString(36).toUpperCase()}-${random}`;
}

export function createFacLitePanelRow() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(facLitePanelButtonCustomId)
            .setLabel(clampLabel("Solicitar Setagem FAC Lite"))
            .setStyle(ButtonStyle.Primary),
    );
}

export function buildFacLitePanelMessageV2(guild: Guild) {
    const container = createContainer(
        "#0ea5e9",
        createTextDisplay(clampComponentText(`## Setagem FAC Lite | ${guild.name}`)),
        createSeparator(),
        createTextDisplay(
            clampComponentText(
                [
                    "> Sistema FAC Lite: seta apenas o cargo FAC escolhido.",
                    "> Clique no botao abaixo para enviar sua solicitacao.",
                    "> Nao aplica cargo de ramo nem verificado.",
                ].join("\n"),
            ),
        ),
        createSeparator(),
        createFacLitePanelRow(),
        createSeparator(),
        createTextDisplay("-# (c) Direitos reservados da Lotus Group"),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
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
    "requestId" | "userId" | "facRoleId" | "status" | "createdAt" | "decidedBy" | "decidedAt"
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
            `- Data: ${formatFacLiteDate(request.createdAt)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay("## Analise de Setagem FAC Lite"),
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
    request: Pick<FacLiteRequestSchema, "requestId" | "status" | "userId" | "facRoleId" | "createdAt" | "decidedAt">;
    reviewerId?: string | null;
    roleApplied?: boolean;
    roleError?: string;
}) {
    const { request, reviewerId } = params;
    const color = request.status === "APPROVED" ? "#22c55e" : "#ef4444";
    const roleStatus = request.status === "APPROVED"
        ? (params.roleApplied ? "OK" : `FALHA${params.roleError ? ` (${params.roleError})` : ""}`)
        : "NAO APLICADO";

    const details = clampComponentText(
        [
            `- Request ID: \`${request.requestId}\``,
            `- Status: **${request.status === "APPROVED" ? "APROVADO" : "NEGADO"}**`,
            `- Usuario: <@${request.userId}> (\`${request.userId}\`)`,
            `- Cargo FAC: <@&${request.facRoleId}>`,
            `- Staff: ${reviewerId ? `<@${reviewerId}>` : "`Nao definido`"}`,
            `- Criado em: ${formatFacLiteDate(request.createdAt)}`,
            `- Decidido em: ${formatFacLiteDate(request.decidedAt ?? new Date())}`,
            `- Aplicacao do cargo: ${clampText(roleStatus, 120)}`,
        ].join("\n"),
    );

    const container = createContainer(
        color,
        createTextDisplay("## Log Final FAC Lite"),
        createSeparator(),
        createTextDisplay(details),
    );

    return {
        flags: ["IsComponentsV2"] as const,
        components: [container],
    };
}
