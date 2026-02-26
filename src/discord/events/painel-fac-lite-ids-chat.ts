import { createEvent } from "#base";
import { db } from "#database";
import {
    buildFacNoticeMessageV2,
    clearFacLiteRoleIdsChatSession,
    getFacLiteRoleIdsChatSession,
    parseRoleIdsInput,
} from "#functions";

createEvent({
    name: "Setagem FAC Lite por ID via chat",
    event: "messageCreate",
    async run(message) {
        if (message.author.bot || !message.guildId) return;

        const session = getFacLiteRoleIdsChatSession(message.author.id);
        if (!session) return;
        if (session.guildId !== message.guildId || session.channelId !== message.channelId) return;

        const content = message.content.trim();
        const lower = content.toLowerCase();
        if (["cancelar", "cancel", "sair"].includes(lower)) {
            clearFacLiteRoleIdsChatSession(message.author.id);
            await message.reply(
                buildFacNoticeMessageV2("warning", "Configuracao cancelada", "Captura de IDs LOGS ILEGAL BAU cancelada."),
            ).catch(() => null);
            return;
        }

        if (!message.member?.permissions.has("ManageGuild")) {
            clearFacLiteRoleIdsChatSession(message.author.id);
            await message.reply(
                buildFacNoticeMessageV2("error", "Sem permissao", "Voce nao tem permissao para configurar o painel."),
            ).catch(() => null);
            return;
        }

        const parsed = parseRoleIdsInput(content);
        if (!parsed.roleIds.length) {
            await message.reply(
                buildFacNoticeMessageV2(
                    "error",
                    "IDs invalidos",
                    "Nao encontrei nenhum ID valido. Envie IDs numericos separados por virgula, espaco ou linha.",
                ),
            ).catch(() => null);
            return;
        }

        const validRoleIds = parsed.roleIds.filter((roleId) => message.guild?.roles.cache.has(roleId));
        const notFoundRoleIds = parsed.roleIds.filter((roleId) => !message.guild?.roles.cache.has(roleId));

        if (!validRoleIds.length) {
            await message.reply(
                buildFacNoticeMessageV2(
                    "error",
                    "Cargos nao encontrados",
                    "Nenhum ID enviado existe neste servidor. Verifique e tente novamente.",
                ),
            ).catch(() => null);
            return;
        }

        const config = await db.guildConfigs.get(message.guildId);
        config.set("facLiteRoleIds", validRoleIds);
        await config.save();
        clearFacLiteRoleIdsChatSession(message.author.id);

        const lines = [
            `Salvei ${validRoleIds.length} cargo(s) LOGS ILEGAL BAU.`,
            "",
            `Cargos: ${validRoleIds.map((id) => `<@&${id}>`).join(", ")}`,
        ];
        if (notFoundRoleIds.length) {
            lines.push("", `Nao encontrados: ${notFoundRoleIds.slice(0, 10).join(", ")}${notFoundRoleIds.length > 10 ? "..." : ""}`);
        }
        if (parsed.invalid.length) {
            lines.push("", `Ignorados: ${parsed.invalid.slice(0, 10).join(", ")}${parsed.invalid.length > 10 ? "..." : ""}`);
        }

        await message.reply(
            buildFacNoticeMessageV2("success", "Cargos LOGS ILEGAL BAU atualizados", lines.join("\n")),
        ).catch(() => null);
    },
});
