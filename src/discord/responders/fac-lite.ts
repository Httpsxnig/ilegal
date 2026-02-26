import { createResponder } from "#base";
import { db, type FacLiteRequestSchema } from "#database";
import {
    buildFacLiteAnalysisMessageV2,
    buildFacLiteLogMessageV2,
    buildFacNoticeEditV2,
    buildFacNoticeUpdateV2,
    canReviewFac,
    createFacLiteRoleSelectRows,
    facLitePanelButtonCustomId,
    facLiteRolePageCustomIdPrefix,
    facLiteRoleSelectCustomId,
    generateFacLiteRequestId,
    getGuildMemberFast,
    getMissingFacLiteConfig,
    getTextChannelFast,
    hasAnyFacRole,
} from "#functions";
import { ResponderType } from "@constatic/base";
import { type Client, type GuildMember } from "discord.js";

createResponder({
    customId: facLitePanelButtonCustomId,
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacLiteConfig(config);
        if (missing.length) {
            await interaction.editReply(
                buildFacNoticeEditV2(
                    "error",
                    "Configuracao incompleta",
                    `Faltam campos obrigatorios:\n${missing.map((item) => `- \`${item}\``).join("\n")}`,
                ),
            );
            return;
        }

        const member = await getGuildMemberFast(interaction.guild, interaction.user.id);
        if (!member) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Membro indisponivel", "Nao consegui validar seu perfil no servidor."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const pageData = createFacLiteRoleSelectRows(interaction.guild, config.facRoleIds ?? [], 0);
        if (!pageData) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "FAC indisponivel", "Nao encontrei cargos FAC validos na configuracao."),
            );
            return;
        }

        await interaction.editReply(
            buildFacNoticeEditV2(
                "info",
                "Solicitacao FAC Lite",
                `Selecione abaixo o cargo FAC desejado.\nPagina ${pageData.currentPage + 1}/${pageData.totalPages} (${pageData.totalItems} FACs).`,
                pageData.rows,
            ),
        );
    },
});

createResponder({
    customId: `${facLiteRolePageCustomIdPrefix}/:page`,
    types: [ResponderType.Button],
    cache: "cached",
    parse: (params) => ({ page: Number(params.page) }),
    async run(interaction, { page }) {
        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacLiteConfig(config);
        if (missing.length) {
            await interaction.update(
                buildFacNoticeUpdateV2(
                    "error",
                    "Configuracao incompleta",
                    `Faltam campos obrigatorios:\n${missing.map((item) => `- \`${item}\``).join("\n")}`,
                ),
            );
            return;
        }

        const member = await getGuildMemberFast(interaction.guild, interaction.user.id);
        if (!member) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "Membro indisponivel", "Nao consegui validar seu perfil no servidor."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.update(
                buildFacNoticeUpdateV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const pageData = createFacLiteRoleSelectRows(interaction.guild, config.facRoleIds ?? [], page);
        if (!pageData) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "FAC indisponivel", "Nao encontrei cargos FAC validos na configuracao."),
            );
            return;
        }

        await interaction.update(
            buildFacNoticeUpdateV2(
                "info",
                "Solicitacao FAC Lite",
                `Selecione abaixo o cargo FAC desejado.\nPagina ${pageData.currentPage + 1}/${pageData.totalPages} (${pageData.totalItems} FACs).`,
                pageData.rows,
            ),
        );
    },
});

createResponder({
    customId: facLiteRoleSelectCustomId,
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const facRoleId = interaction.values[0];
        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacLiteConfig(config);
        if (missing.length) {
            await interaction.editReply(
                buildFacNoticeEditV2(
                    "error",
                    "Configuracao incompleta",
                    `Faltam campos obrigatorios:\n${missing.map((item) => `- \`${item}\``).join("\n")}`,
                ),
            );
            return;
        }

        if (!config.facRoleIds?.includes(facRoleId)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "FAC invalida", "O cargo escolhido nao esta permitido na configuracao."),
            );
            return;
        }

        const member = await getGuildMemberFast(interaction.guild, interaction.user.id);
        if (!member) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Membro indisponivel", "Nao consegui validar seu perfil no servidor."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const analysisChannel = await getTextChannelFast(interaction.client, interaction.guild, config.analiseChannelId!);
        if (!analysisChannel) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Canal invalido", "Nao consegui acessar o canal de analise configurado."),
            );
            return;
        }

        const request = await createPendingFacLiteRequest({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            facRoleId,
            analiseChannelId: analysisChannel.id,
        });

        if (!request) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Falha interna", "Nao consegui gerar um requestId unico."),
            );
            return;
        }

        try {
            const analysisMessage = await analysisChannel.send(
                buildFacLiteAnalysisMessageV2(request),
            );

            request.set("analiseMessageId", analysisMessage.id);
            request.set("analiseChannelId", analysisMessage.channelId);
            await request.save();

            await interaction.editReply(
                buildFacNoticeEditV2(
                    "success",
                    "Solicitacao enviada",
                    `Seu pedido FAC Lite foi enviado para analise.\nRequest ID: \`${request.requestId}\``,
                ),
            );
        } catch (error) {
            await db.facLiteRequests.findOneAndUpdate(
                { requestId: request.requestId, status: "PENDING" },
                { $set: { status: "DENIED", decidedAt: new Date(), decidedBy: interaction.client.user.id } },
            );

            await interaction.editReply(
                buildFacNoticeEditV2("error", "Falha ao enviar", `Erro: ${toErrorMessage(error)}`),
            );
        }
    },
});

createResponder({
    customId: "faclite/review/approve/:requestId",
    types: [ResponderType.Button],
    cache: "cached",
    parse: (params) => ({ requestId: params.requestId }),
    async run(interaction, { requestId }) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const config = await db.guildConfigs.get(interaction.guildId);
        const reviewer = await getGuildMemberFast(interaction.guild, interaction.user.id);
        if (!reviewer || !canReviewFac(reviewer, config)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Apenas staff configurado pode aprovar ou negar."),
            );
            return;
        }

        const locked = await db.facLiteRequests.findOneAndUpdate(
            { requestId, status: "PENDING" },
            {
                $set: {
                    status: "APPROVED",
                    decidedBy: interaction.user.id,
                    decidedAt: new Date(),
                },
            },
            { new: true },
        );

        if (!locked) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Pedido indisponivel", "Esse pedido ja foi decidido ou nao existe."),
            );
            return;
        }

        const targetMember = await getGuildMemberFast(interaction.guild, locked.userId);
        const roleApply = await applyFacLiteRole(targetMember, locked.facRoleId);

        await interaction.message.edit(
            buildFacLiteAnalysisMessageV2(locked, true),
        ).catch(() => null);

        await sendFacLiteLog(interaction.client, config.logChannelId, locked, interaction.user.id, roleApply);

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Pedido aprovado",
                [
                    `Request: \`${locked.requestId}\``,
                    `Aplicacao do cargo: ${roleApply.applied ? "OK" : `FALHA (${roleApply.error ?? "sem detalhe"})`}`,
                ].join("\n"),
            ),
        );
    },
});

createResponder({
    customId: "faclite/review/deny/:requestId",
    types: [ResponderType.Button],
    cache: "cached",
    parse: (params) => ({ requestId: params.requestId }),
    async run(interaction, { requestId }) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const config = await db.guildConfigs.get(interaction.guildId);
        const reviewer = await getGuildMemberFast(interaction.guild, interaction.user.id);
        if (!reviewer || !canReviewFac(reviewer, config)) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Sem permissao", "Apenas staff configurado pode aprovar ou negar."),
            );
            return;
        }

        const locked = await db.facLiteRequests.findOneAndUpdate(
            { requestId, status: "PENDING" },
            {
                $set: {
                    status: "DENIED",
                    decidedBy: interaction.user.id,
                    decidedAt: new Date(),
                },
            },
            { new: true },
        );

        if (!locked) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Pedido indisponivel", "Esse pedido ja foi decidido ou nao existe."),
            );
            return;
        }

        await interaction.message.edit(
            buildFacLiteAnalysisMessageV2(locked, true),
        ).catch(() => null);

        await sendFacLiteLog(interaction.client, config.logChannelId, locked, interaction.user.id);

        await interaction.editReply(
            buildFacNoticeEditV2("success", "Pedido negado", `Request \`${locked.requestId}\` foi negado.`),
        );
    },
});

async function createPendingFacLiteRequest(data: {
    guildId: string;
    userId: string;
    facRoleId: string;
    analiseChannelId: string;
}) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const requestId = generateFacLiteRequestId();
        try {
            return await db.facLiteRequests.create({
                requestId,
                guildId: data.guildId,
                userId: data.userId,
                facRoleId: data.facRoleId,
                status: "PENDING",
                createdAt: new Date(),
                analiseChannelId: data.analiseChannelId,
            });
        } catch (error) {
            if (!isDuplicateError(error)) throw error;
        }
    }
    return null;
}

async function applyFacLiteRole(member: GuildMember | null, facRoleId?: string | null) {
    if (!member) {
        return { applied: false, error: "Membro nao encontrado no servidor." };
    }

    if (!facRoleId) {
        return { applied: false, error: "Cargo FAC nao configurado." };
    }

    try {
        await member.roles.add(facRoleId);
        return { applied: true, error: undefined };
    } catch (error) {
        return { applied: false, error: toErrorMessage(error) };
    }
}

async function sendFacLiteLog(
    client: Client,
    logChannelId: string | null | undefined,
    request: Pick<FacLiteRequestSchema, "requestId" | "guildId" | "status" | "userId" | "facRoleId" | "createdAt" | "decidedAt">,
    reviewerId?: string,
    roleResult?: {
        applied?: boolean;
        error?: string;
    },
) {
    if (!logChannelId) return;
    const guild = client.guilds.cache.get(request.guildId);
    if (!guild) return;
    const channel = await getTextChannelFast(client, guild, logChannelId);
    if (!channel) return;

    await channel.send(
        buildFacLiteLogMessageV2({
            request,
            reviewerId,
            roleApplied: roleResult?.applied,
            roleError: roleResult?.error,
        }),
    ).catch((error) => {
        console.error(`[fac-lite] falha ao enviar log (${request.requestId})`, error);
    });
}

function isDuplicateError(error: unknown) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && Number((error as { code?: unknown; }).code) === 11000;
}

function toErrorMessage(error: unknown) {
    if (error instanceof Error) {
        if (/Missing Permissions/i.test(error.message)) {
            return "Missing Permissions - ajuste a hierarquia de cargos e permissoes do bot.";
        }
        return error.message;
    }
    return String(error);
}
