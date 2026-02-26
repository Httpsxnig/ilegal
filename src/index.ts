import { env } from "#env";
import { db } from "#database";
import { bootstrap } from "@constatic/base";
import { GatewayIntentBits, Options, Partials } from "discord.js";

setupMemoryAutoRestart();
setupFacLiteCleanup();

await bootstrap({
    meta: import.meta,
    env,
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
    makeCache: Options.cacheWithLimits({
        MessageManager: 20,
        GuildMemberManager: 100,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        StageInstanceManager: 0,
        ThreadManager: 20,
        VoiceStateManager: 0,
    }),
});

function setupMemoryAutoRestart() {
    const enabled = env.AUTO_RESTART_ON_MEMORY ?? true;
    if (!enabled) return;

    const limitMb = env.AUTO_RESTART_MAX_MEMORY_MB ?? 120;
    const intervalMs = env.AUTO_RESTART_CHECK_INTERVAL_MS ?? 15000;
    const metric = env.AUTO_RESTART_MEMORY_METRIC ?? "heapUsed";
    const breachCount = env.AUTO_RESTART_BREACH_COUNT ?? 3;
    const limitBytes = limitMb * 1024 * 1024;
    let breaches = 0;
    let shuttingDown = false;

    const timer = setInterval(() => {
        if (shuttingDown) return;
        const usage = process.memoryUsage()[metric];
        if (usage < limitBytes) {
            breaches = 0;
            return;
        }

        breaches += 1;
        if (breaches < breachCount) return;

        shuttingDown = true;
        const usedMb = (usage / (1024 * 1024)).toFixed(2);
        console.error(`[memory-guard] ${metric} ${usedMb} MB >= ${limitMb.toFixed(1)} MB por ${breaches} checagens. Reiniciando processo.`);
        process.exit(137);
    }, intervalMs);

    timer.unref();
}

function setupFacLiteCleanup() {
    const enabled = env.FAC_LITE_CLEANUP_ENABLED ?? true;
    if (!enabled) return;

    const retentionDays = env.FAC_LITE_CLEANUP_DAYS ?? 30;
    const intervalMs = env.FAC_LITE_CLEANUP_INTERVAL_MS ?? 6 * 60 * 60 * 1000;
    let running = false;

    const runCleanup = async () => {
        if (running) return;
        running = true;

        try {
            const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const result = await db.facLiteRequests.deleteMany({
                status: { $in: ["APPROVED", "DENIED"] },
                createdAt: { $lt: cutoff },
            });

            if ((result.deletedCount ?? 0) > 0) {
                console.log(`[fac-lite-cleanup] removidos ${result.deletedCount} requests antigos.`);
            }
        } catch (error) {
            console.error("[fac-lite-cleanup] falha ao limpar requests antigos:", error);
        } finally {
            running = false;
        }
    };

    void runCleanup();
    const timer = setInterval(() => {
        void runCleanup();
    }, intervalMs);
    timer.unref();
}
