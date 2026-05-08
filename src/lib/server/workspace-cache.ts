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
  return (await getRedisAdapter()) ?? memoryAdapter;
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
    revalidateTag(tag, { expire: 0 });
  }
}
