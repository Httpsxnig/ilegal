import { env } from "#env";
import { bootstrap } from "@constatic/base";
import { GatewayIntentBits, Options, Partials } from "discord.js";

setupMemoryAutoRestart();

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
