import { Schema } from "mongoose";
import { t } from "../utils.js";

export const facLiteRequestSchema = new Schema(
    {
        requestId: t.string,
        guildId: t.string,
        userId: t.string,
        facRoleId: t.string,
        nome: t.string,
        gameId: t.string,
        rank: {
            type: String,
            enum: ["LIDER", "SUB"],
            required: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "DENIED"],
            default: "PENDING",
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
        decidedBy: String,
        decidedAt: Date,
        analiseMessageId: String,
        analiseChannelId: String,
    },
    {
        timestamps: false,
    },
);

facLiteRequestSchema.index({ requestId: 1 }, { unique: true });
facLiteRequestSchema.index({ guildId: 1, status: 1, createdAt: 1 });
