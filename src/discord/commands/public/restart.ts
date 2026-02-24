import { createCommand } from "#base";
import { env } from "#env";
import { buildFacNoticeEditV2 } from "#functions";
import { ApplicationCommandType } from "discord.js";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

createCommand({
    name: "restart",
    description: "Reinicia o bot sem build",
    type: ApplicationCommandType.ChatInput,
    dmPermission: false,
    async run(interaction) {
        await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => null);

        const ownerId = env.OWNER_DISCORD_ID?.trim();
        const isOwner = ownerId ? interaction.user.id === ownerId : false;
        const canManageGuild = interaction.memberPermissions?.has("ManageGuild") ?? false;
        const canRun = ownerId ? isOwner : canManageGuild;

        if (!canRun) {
            await interaction.editReply(
                buildFacNoticeEditV2(
                    "error",
                    "Sem permissao",
                    ownerId
                        ? "Apenas o owner configurado pode usar /restart."
                        : "Voce precisa de Gerenciar Servidor para usar /restart.",
                ),
            );
            return;
        }

        const projectRoot = resolveProjectRoot();
        const hasBuildOutput = existsSync(join(projectRoot, "build", "index.js"));
        if (!hasBuildOutput) {
            await interaction.editReply(
                buildFacNoticeEditV2(
                    "warning",
                    "Build ausente",
                    "Nao encontrei build pronto. Use /refresh para compilar e reiniciar.",
                ),
            );
            return;
        }

        const child = runNpmDetached(["run", "start"], projectRoot);
        child.unref();

        await interaction.editReply(
            buildFacNoticeEditV2("success", "Restart iniciado", "Reinicio rapido executado sem build."),
        ).catch(() => null);

        shutdownCurrentProcess(interaction.client);
    },
});

function runNpmDetached(args: string[], cwd: string) {
    if (process.platform === "win32") {
        return spawn("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
            cwd,
            detached: true,
            stdio: "ignore",
            windowsHide: true,
        });
    }

    return spawn("npm", args, {
        cwd,
        detached: true,
        stdio: "ignore",
    });
}

function resolveProjectRoot() {
    const fromCwd = findProjectRoot(process.cwd());
    if (fromCwd) return fromCwd;

    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const fromModuleDir = findProjectRoot(moduleDir);
    if (fromModuleDir) return fromModuleDir;

    return resolve(process.cwd());
}

function findProjectRoot(startDir: string) {
    let current = resolve(startDir);
    for (let i = 0; i < 10; i++) {
        const pkg = join(current, "package.json");
        if (existsSync(pkg)) return current;
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return null;
}

function shutdownCurrentProcess(client: { destroy: () => unknown; }) {
    const graceful = setTimeout(() => {
        try {
            void client.destroy();
        } catch {
            // ignore
        }
        process.exit(0);
    }, 500);
    graceful.unref();

    const force = setTimeout(() => {
        if (process.platform === "win32") {
            try {
                const killer = spawn("taskkill", ["/F", "/PID", String(process.pid), "/T"], {
                    detached: true,
                    stdio: "ignore",
                    windowsHide: true,
                });
                killer.unref();
            } catch {
                process.exit(1);
            }
            return;
        }

        try {
            process.kill(process.pid, "SIGKILL");
        } catch {
            process.exit(1);
        }
    }, 3000);
    force.unref();
}
