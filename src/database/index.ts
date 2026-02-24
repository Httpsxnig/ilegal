import mongoose, { InferSchemaType, model } from "mongoose";
import { guildSchema } from "./schemas/guild.js";
import { memberSchema } from "./schemas/member.js";
import { guildConfigSchema } from "./schemas/guild-config.js";
import { facRequestSchema } from "./schemas/fac-request.js";
import { env } from "#env";
import chalk from "chalk";

try {
   console.log(chalk.blue("Connecting to MongoDB..."));
   await mongoose.connect(env.MONGO_URI, { 
      dbName: env.DATABASE_NAME || "database" 
   });
   console.log(chalk.green("MongoDB connected"));
} catch(err){
   console.error(err);
   process.exit(1);
}

export const db = {
   guilds: model("guild", guildSchema, "guilds"),
   members: model("member", memberSchema, "members"),
   guildConfigs: model("guild-config", guildConfigSchema, "guild_config"),
   facRequests: model("fac-request", facRequestSchema, "fac_requests"),
};

export type GuildSchema = InferSchemaType<typeof guildSchema>;
export type MemberSchema = InferSchemaType<typeof memberSchema>;
export type GuildConfigSchema = InferSchemaType<typeof guildConfigSchema>;
export type FacRequestSchema = InferSchemaType<typeof facRequestSchema>;
