import "./constants.js";
import { validateEnv } from "@constatic/base";
import { z } from "zod";

export const env = await validateEnv(z.looseObject({
    BOT_TOKEN: z.string("Discord Bot Token is required").min(1),
    WEBHOOK_LOGS_URL: z.url().optional(),
    GUILD_ID: z.string().optional(),
    MONGO_URI: z.string("MongoDb URI is required").min(1),
    DATABASE_NAME: z.string().optional(),
    OWNER_DISCORD_ID: z.string().optional(),
    MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).optional(),
    MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(100).optional(),
    MONGO_MAX_IDLE_MS: z.coerce.number().int().min(1000).max(600000).optional(),
    MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).optional(),
    AUTO_RESTART_ON_MEMORY: z
        .string()
        .optional()
        .transform((value) => value?.toLowerCase() !== "false"),
    AUTO_RESTART_MAX_MEMORY_MB: z.coerce.number().min(5).max(4096).optional(),
    AUTO_RESTART_CHECK_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).optional(),
    AUTO_RESTART_MEMORY_METRIC: z.enum(["heapUsed", "rss"]).optional(),
    AUTO_RESTART_BREACH_COUNT: z.coerce.number().int().min(1).max(60).optional(),
    FAC_LITE_CLEANUP_ENABLED: z
        .string()
        .optional()
        .transform((value) => value?.toLowerCase() !== "false"),
    FAC_LITE_CLEANUP_DAYS: z.coerce.number().int().min(1).max(3650).optional(),
    FAC_LITE_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60000).max(86400000).optional(),
}));
