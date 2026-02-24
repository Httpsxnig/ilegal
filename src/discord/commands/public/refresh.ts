import { createCommand } from "#base";
import { env } from "#env";
import { buildFacNoticeEditV2 } from "#functions";
import { ApplicationCommandType } from "discord.js";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

createCommand({
    name: "refresh",
    description: "Reinicia o bot com build + start",
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
                        ? "Apenas o owner configurado pode usar /refresh."
                        : "Voce precisa de Gerenciar Servidor para usar /refresh.",
                ),
            );
            return;
        }

        const projectRoot = resolveProjectRoot();
        const build = runNpmSync(["run", "build"], projectRoot);
        if (build.status !== 0) {
            const stderr = (build.stderr ?? "").trim();
            const stdout = (build.stdout ?? "").trim();
            const executionError = build.error instanceof Error
                ? `${build.error.name}: ${build.error.message}`
                : "";
            const output = [executionError, stderr, stdout].filter(Boolean).join("\n");
            const preview = output.length > 1200 ? `${output.slice(0, 1200)}...` : output;

            await interaction.editReply(
                buildFacNoticeEditV2(
                    "error",
                    "Falha no build",
                    preview || `Nao foi possivel concluir o build. (cwd: ${projectRoot})`,
                ),
            );
            return;
        }

        const child = runNpmDetached(["run", "start"], projectRoot);
        child.unref();

        await interaction.editReply(
            buildFacNoticeEditV2(
                "success",
                "Refresh iniciado",
                "Build concluido e novo processo iniciado.",
            ),
        ).catch(() => null);

        shutdownCurrentProcess(interaction.client);
    },
});

function runNpmSync(args: string[], cwd: string) {
    if (process.platform === "win32") {
        return spawnSync("cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
            cwd,
            encoding: "utf8",
            maxBuffer: 1024 * 1024 * 10,
            windowsHide: true,
        });
    }

    return spawnSync("npm", args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10,
    });
}

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
