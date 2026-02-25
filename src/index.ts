import { env } from "#env";
import { bootstrap } from "@constatic/base";

setupMemoryAutoRestart();

await bootstrap({ meta: import.meta, env });

function setupMemoryAutoRestart() {
    const enabled = env.AUTO_RESTART_ON_MEMORY ?? true;
    if (!enabled) return;

    const limitMb = env.AUTO_RESTART_MAX_MEMORY_MB ?? 40.1;
    const intervalMs = env.AUTO_RESTART_CHECK_INTERVAL_MS ?? 15000;
    const limitBytes = limitMb * 1024 * 1024;
    let shuttingDown = false;

    const timer = setInterval(() => {
        if (shuttingDown) return;
        const rss = process.memoryUsage().rss;
        if (rss < limitBytes) return;

        shuttingDown = true;
        const rssMb = (rss / (1024 * 1024)).toFixed(2);
        console.error(`[memory-guard] RSS ${rssMb} MB >= ${limitMb.toFixed(1)} MB. Reiniciando processo.`);
        process.exit(137);
    }, intervalMs);

    timer.unref();
}
