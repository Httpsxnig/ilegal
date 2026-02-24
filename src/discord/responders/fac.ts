import { createResponder } from "#base";
import { db, type FacRequestSchema } from "#database";
import {
    buildAnalysisMessageV2,
    buildFacLogMessageV2,
    buildFacNickname,
    buildFacNoticeEditV2,
    buildFacNoticeUpdateV2,
    canReviewFac,
    createFacRequestModal,
    createFacRoleSelectRows,
    facPanelButtonCustomId,
    facRolePageCustomIdPrefix,
    facRoleSelectCustomId,
    generateFacRequestId,
    getGuildMemberFast,
    getMissingFacConfig,
    getTextChannelFast,
    hasAnyFacRole,
    normalizeFacForm,
    resolveRamoRolesForFac,
    type FacRank,
} from "#functions";
import { ResponderType } from "@constatic/base";
import { type Client, type GuildMember } from "discord.js";

createResponder({
    customId: facPanelButtonCustomId,
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacConfig(config);
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

        if (config.verificadoRoleId && member.roles.cache.has(config.verificadoRoleId)) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui cargo Verificado."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const pageData = createFacRoleSelectRows(interaction.guild, config.facRoleIds ?? [], 0);
        if (!pageData) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "FAC indisponivel", "Nao encontrei cargos FAC validos na configuracao."),
            );
            return;
        }

        await interaction.editReply(
            buildFacNoticeEditV2(
                "info",
                "Solicitacao FAC",
                `Selecione abaixo o cargo FAC desejado.\nPagina ${pageData.currentPage + 1}/${pageData.totalPages} (${pageData.totalItems} FACs).`,
                pageData.rows,
            ),
        );
    },
});

createResponder({
    customId: `${facRolePageCustomIdPrefix}/:page`,
    types: [ResponderType.Button],
    cache: "cached",
    parse: (params) => ({ page: Number(params.page) }),
    async run(interaction, { page }) {
        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacConfig(config);
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

        if (config.verificadoRoleId && member.roles.cache.has(config.verificadoRoleId)) {
            await interaction.update(
                buildFacNoticeUpdateV2("warning", "Solicitacao bloqueada", "Voce ja possui cargo Verificado."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.update(
                buildFacNoticeUpdateV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const pageData = createFacRoleSelectRows(interaction.guild, config.facRoleIds ?? [], page);
        if (!pageData) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "FAC indisponivel", "Nao encontrei cargos FAC validos na configuracao."),
            );
            return;
        }

        await interaction.update(
            buildFacNoticeUpdateV2(
                "info",
                "Solicitacao FAC",
                `Selecione abaixo o cargo FAC desejado.\nPagina ${pageData.currentPage + 1}/${pageData.totalPages} (${pageData.totalItems} FACs).`,
                pageData.rows,
            ),
        );
    },
});

createResponder({
    customId: facRoleSelectCustomId,
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const facRoleId = interaction.values[0];
        const config = await db.guildConfigs.get(interaction.guildId);
        if (!config.facRoleIds?.includes(facRoleId)) {
            await interaction.update(
                buildFacNoticeUpdateV2("error", "FAC invalida", "O cargo escolhido nao esta permitido na configuracao."),
            );
            return;
        }

        await interaction.showModal(
            createFacRequestModal(facRoleId),
        );
    },
});

createResponder({
    customId: "fac/request/modal/:facRoleId",
    types: [ResponderType.Modal, ResponderType.ModalComponent],
    cache: "cached",
    parse: (params) => ({ facRoleId: params.facRoleId }),
    async run(interaction, { facRoleId }) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const config = await db.guildConfigs.get(interaction.guildId);
        const missing = getMissingFacConfig(config);
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

        const ramoForFac = resolveRamoRolesForFac(config, facRoleId);
        if (!ramoForFac.length) {
            await interaction.editReply(
                buildFacNoticeEditV2(
                    "error",
                    "Ramo nao configurado",
                    "Essa FAC nao tem cargos de ramo vinculados. Configure no painel em 'Vincular ramo por FAC'.",
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

        if (config.verificadoRoleId && member.roles.cache.has(config.verificadoRoleId)) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui cargo Verificado."),
            );
            return;
        }

        if (hasAnyFacRole(member, config.facRoleIds ?? [])) {
            await interaction.editReply(
                buildFacNoticeEditV2("warning", "Solicitacao bloqueada", "Voce ja possui um cargo FAC configurado."),
            );
            return;
        }

        const selectedRank = interaction.fields.getStringSelectValues("rank")[0] ?? "";
        const parsed = normalizeFacForm(
            interaction.fields.getTextInputValue("nome"),
            interaction.fields.getTextInputValue("gameId"),
            selectedRank,
        );
        if (!parsed.ok) {
            await interaction.editReply(
                buildFacNoticeEditV2("error", "Formulario invalido", parsed.error),
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

        const request = await createPendingFacRequest({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            facRoleId,
            nome: parsed.data.nome,
            gameId: parsed.data.gameId,
            rank: parsed.data.rank,
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
                buildAnalysisMessageV2(request),
            );

            request.set("analiseMessageId", analysisMessage.id);
            request.set("analiseChannelId", analysisMessage.channelId);
            await request.save();

            await interaction.editReply(
                buildFacNoticeEditV2(
                    "success",
                    "Solicitacao enviada",
                    `Seu pedido FAC foi enviado para analise.\nRequest ID: \`${request.requestId}\``,
                ),
            );
        } catch (error) {
            await db.facRequests.findOneAndUpdate(
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
    customId: "fac/review/approve/:requestId",
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

        const locked = await db.facRequests.findOneAndUpdate(
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
        const ramoRoleIds = resolveRamoRolesForFac(config, locked.facRoleId);
        const roleApply = await applyApprovedRoles(targetMember, locked.facRoleId, config.verificadoRoleId, ramoRoleIds);
        const nickApply = await applyApprovedNickname(targetMember, locked.rank as FacRank, locked.nome, locked.gameId);

        await interaction.message.edit(
            buildAnalysisMessageV2(locked, true),
        ).catch(() => null);

        await sendFacLog(interaction.client, config.logChannelId, locked, interaction.user.id, {
            rolesApplied: roleApply.applied,
            rolesError: roleApply.error,
            nicknameApplied: nickApply.applied,
            nicknameError: nickApply.error,
        });

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Pedido aprovado",
                [
                    `Request: \`${locked.requestId}\``,
                    `Cargos: ${roleApply.applied ? "OK" : `FALHA (${roleApply.error ?? "sem detalhe"})`}`,
                    `Nickname: ${nickApply.applied ? "OK" : `FALHA (${nickApply.error ?? "sem detalhe"})`}`,
                ].join("\n"),
            ),
        );
    },
});

createResponder({
    customId: "fac/review/deny/:requestId",
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

        const locked = await db.facRequests.findOneAndUpdate(
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
            buildAnalysisMessageV2(locked, true),
        ).catch(() => null);

        await sendFacLog(interaction.client, config.logChannelId, locked, interaction.user.id);

        await interaction.editReply(
            buildFacNoticeEditV2("success", "Pedido negado", `Request \`${locked.requestId}\` foi negado.`),
        );
    },
});

async function createPendingFacRequest(data: {
    guildId: string;
    userId: string;
    facRoleId: string;
    nome: string;
    gameId: string;
    rank: FacRank;
    analiseChannelId: string;
}) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const requestId = generateFacRequestId();
        try {
            return await db.facRequests.create({
                requestId,
                guildId: data.guildId,
                userId: data.userId,
                facRoleId: data.facRoleId,
                nome: data.nome,
                gameId: data.gameId,
                rank: data.rank,
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

async function applyApprovedRoles(
    member: GuildMember | null,
    facRoleId?: string | null,
    verificadoRoleId?: string | null,
    ramoRoleIds: string[] = [],
) {
    if (!member) {
        return { applied: false, error: "Membro nao encontrado no servidor." };
    }

    const roles = [facRoleId, verificadoRoleId, ...ramoRoleIds].filter(Boolean) as string[];
    if (!roles.length) {
        return { applied: false, error: "Nenhum cargo configurado para aplicacao." };
    }

    try {
        await member.roles.add([...new Set(roles)]);
        return { applied: true, error: undefined };
    } catch (error) {
        return { applied: false, error: toErrorMessage(error) };
    }
}

async function applyApprovedNickname(member: GuildMember | null, rank: FacRank, nome: string, gameId: string) {
    if (!member) {
        return { applied: false, error: "Membro nao encontrado no servidor." };
    }

    const nickname = buildFacNickname(rank, nome, gameId);
    try {
        await member.setNickname(nickname);
        return { applied: true, error: undefined };
    } catch (error) {
        return { applied: false, error: toErrorMessage(error) };
    }
}

async function sendFacLog(
    client: Client,
    logChannelId: string | null | undefined,
    request: Pick<FacRequestSchema, "requestId" | "guildId" | "status" | "userId" | "facRoleId" | "nome" | "gameId" | "rank" | "createdAt" | "decidedAt">,
    reviewerId?: string,
    result?: {
        rolesApplied?: boolean;
        rolesError?: string;
        nicknameApplied?: boolean;
        nicknameError?: string;
    },
) {
    if (!logChannelId) return;
    const guild = client.guilds.cache.get(request.guildId);
    if (!guild) return;
    const channel = await getTextChannelFast(client, guild, logChannelId);
    if (!channel) return;

    await channel.send(
        buildFacLogMessageV2({
            request,
            reviewerId,
            rolesApplied: result?.rolesApplied,
            rolesError: result?.rolesError,
            nicknameApplied: result?.nicknameApplied,
            nicknameError: result?.nicknameError,
        }),
    ).catch((error) => {
        console.error(`[fac] falha ao enviar log (${request.requestId})`, error);
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
