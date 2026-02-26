import { Schema } from "mongoose";
import { t } from "../utils.js";

export const guildConfigSchema = new Schema(
    {
        guildId: t.string,
        panelChannelId: String,
        panelMessageId: String,
        analiseChannelId: String,
        logChannelId: String,
        facRoleIds: { type: [String], default: [] },
        verificadoRoleId: String,
        ramoRoleIds: { type: [String], default: [] },
        ramoRoleId: String,
        ramoRoleByFac: {
            type: Map,
            of: [String],
            default: {},
        },
        staffRoleIds: { type: [String], default: [] },
        facLiteAnaliseChannelId: String,
        facLiteLogChannelId: String,
        facLiteStaffRoleIds: { type: [String], default: [] },
        facLiteRoleIds: { type: [String], default: [] },
    },
    {
        timestamps: true,
        statics: {
            async get(guildId: string) {
                return this.findOneAndUpdate(
                    { guildId },
                    { $setOnInsert: { guildId } },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true,
                    },
                );
            },
        },
    },
);

guildConfigSchema.index({ guildId: 1 }, { unique: true });
