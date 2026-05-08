import { revalidateTag } from "next/cache";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  tags: string[];
};

type CacheAdapter = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number, tags: string[]): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTags(tags: string[]): Promise<void>;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>) {
  return entry.expiresAt <= Date.now();
}

const memoryAdapter: CacheAdapter = {
  async get<T>(key: string) {
    const entry = memoryCache.get(key);
    if (!entry || isExpired(entry)) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  },
  async set<T>(key: string, value: T, ttlSeconds: number, tags: string[]) {
    memoryCache.set(key, {
      value,
      tags,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },
  async delete(key: string) {
    memoryCache.delete(key);
  },
  async deleteByTags(tags: string[]) {
    const tagSet = new Set(tags);
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.tags.some((tag) => tagSet.has(tag))) {
        memoryCache.delete(key);
      }
    }
  },
};

let redisAdapterPromise: Promise<CacheAdapter | null> | null = null;
let upstashAdapterPromise: Promise<CacheAdapter | null> | null = null;

type UpstashResponse<T = unknown> = {
  result?: T;
  error?: string;
};

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

async function upstashCommand<T>(
  config: { url: string; token: string },
  command: Array<string | number>,
) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash cache request failed with status ${response.status}.`);
  }

  const [result] = (await response.json()) as Array<UpstashResponse<T>>;
  if (result?.error) {
    throw new Error(result.error);
  }

  return result?.result ?? null;
}

async function upstashPipeline(
  config: { url: string; token: string },
  commands: Array<Array<string | number>>,
) {
  if (commands.length === 0) {
    return [];
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash cache pipeline failed with status ${response.status}.`);
  }

  const results = (await response.json()) as Array<UpstashResponse>;
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error(failed.error);
  }

  return results;
}

async function getUpstashAdapter(): Promise<CacheAdapter | null> {
  const config = getUpstashConfig();
  if (!config) {
    return null;
  }

  if (!upstashAdapterPromise) {
    upstashAdapterPromise = Promise.resolve({
      async get<T>(key: string) {
        const raw = await upstashCommand<string>(config, ["GET", key]);
        return raw ? (JSON.parse(raw) as T) : null;
      },
      async set<T>(key: string, value: T, ttlSeconds: number, tags: string[]) {
        const commands: Array<Array<string | number>> = [
          ["SET", key, JSON.stringify(value), "EX", ttlSeconds],
        ];

        for (const tag of tags) {
          commands.push(["SADD", `tag:${tag}`, key]);
          commands.push(["EXPIRE", `tag:${tag}`, Math.max(ttlSeconds, 60 * 60)]);
        }

        await upstashPipeline(config, commands);
      },
      async delete(key: string) {
        await upstashCommand(config, ["DEL", key]);
      },
      async deleteByTags(tags: string[]) {
        for (const tag of tags) {
          const tagKey = `tag:${tag}`;
          const keys = await upstashCommand<string[]>(config, ["SMEMBERS", tagKey]);
          await upstashPipeline(config, [
            ...(keys && keys.length > 0 ? [["DEL", ...keys] as Array<string | number>] : []),
            ["DEL", tagKey],
          ]);
        }
      },
    } satisfies CacheAdapter);
  }

  return upstashAdapterPromise;
}

async function getRedisAdapter(): Promise<CacheAdapter | null> {
  if (process.env.CACHE_DRIVER !== "redis" && !process.env.REDIS_URL) {
    return null;
  }
  if (!redisAdapterPromise) {
    redisAdapterPromise = (async () => {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      client.on("error", (error) => {
        console.error("Redis cache error", error);
      });
      await client.connect();

      return {
        async get<T>(key: string) {
          const raw = await client.get(key);
          return raw ? (JSON.parse(raw) as T) : null;
        },
        async set<T>(key: string, value: T, ttlSeconds: number, tags: string[]) {
          await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
          if (tags.length > 0) {
            await Promise.all(tags.map((tag) => client.sAdd(`tag:${tag}`, key)));
          }
        },
        async delete(key: string) {
          await client.del(key);
        },
        async deleteByTags(tags: string[]) {
          for (const tag of tags) {
            const tagKey = `tag:${tag}`;
            const keys = await client.sMembers(tagKey);
            if (keys.length > 0) {
              await client.del(keys);
            }
            await client.del(tagKey);
          }
        },
      } satisfies CacheAdapter;
    })().catch((error) => {
      console.error("Falling back to in-memory cache.", error);
      return null;
    });
  }
  return redisAdapterPromise;
}

async function getAdapter() {
  return (await getUpstashAdapter()) ?? (await getRedisAdapter()) ?? memoryAdapter;
}

export async function getOrSetWorkspaceCache<T>(
  key: string,
  tags: string[],
  ttlSeconds: number,
  loader: () => Promise<T>,
) {
  const adapter = await getAdapter();
  const cached = await adapter.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await loader();
  await adapter.set(key, value, ttlSeconds, tags);
  return value;
}

export async function invalidateWorkspaceCache(tags: string[]) {
  const uniqueTags = [...new Set(tags)];
  await (await getAdapter()).deleteByTags(uniqueTags);
  for (const tag of uniqueTags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("static generation store missing")
      ) {
        continue;
      }

      throw error;
    }
  }
}
