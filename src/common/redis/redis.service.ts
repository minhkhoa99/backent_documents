import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;

    constructor(private configService: ConfigService) {
        this.client = new Redis({
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
        });
    }

    onModuleDestroy() {
        this.client.disconnect();
    }

    async get<T>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.set(key, JSON.stringify(value), 'EX', ttl);
        } else {
            await this.client.set(key, JSON.stringify(value));
        }
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async reset(): Promise<void> {
        await this.client.flushall();
    }
}
