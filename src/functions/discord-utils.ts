import type {
    Client,
    Guild,
    GuildMember,
    TextBasedChannel,
} from "discord.js";

type FastMessage = {
    id: string;
    channelId: string;
    edit: (...args: any[]) => Promise<unknown>;
};

export type FastTextChannel = TextBasedChannel & {
    id: string;
    send: (...args: any[]) => Promise<FastMessage>;
    messages?: {
        fetch: (id: string) => Promise<FastMessage>;
    };
};

export function hasManageGuildPermission(memberPermissions: { has(permission: unknown): boolean; } | null | undefined) {
    return memberPermissions?.has("ManageGuild") ?? false;
}

export async function getGuildMemberFast(guild: Guild, userId: string) {
    const cached = guild.members.cache.get(userId);
    if (cached) return cached;
    return guild.members.fetch(userId).catch(() => null) as Promise<GuildMember | null>;
}

export async function getTextChannelFast(client: Client, guild: Guild, channelId: string) {
    const guildCached = guild.channels.cache.get(channelId);
    if (guildCached && guildCached.isTextBased() && "send" in guildCached) {
        return guildCached as FastTextChannel;
    }

    const clientCached = client.channels.cache.get(channelId);
    if (clientCached && clientCached.isTextBased() && "send" in clientCached) {
        return clientCached as FastTextChannel;
    }

    const fetched = await client.channels.fetch(channelId).catch(() => null);
    if (fetched && fetched.isTextBased() && "send" in fetched) {
        return fetched as FastTextChannel;
    }

    return null;
}
