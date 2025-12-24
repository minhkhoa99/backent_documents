
import { Injectable } from '@nestjs/common';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ContentBlock } from './entities/content-block.entity';
import { Repository } from 'typeorm';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class ContentBlocksService {
  private readonly CACHE_KEY_ACTIVE = 'content_blocks:active';
  private readonly CACHE_KEY_ALL = 'content_blocks:all';

  constructor(
    @InjectRepository(ContentBlock)
    private contentBlocksRepository: Repository<ContentBlock>,
    private redisService: RedisService,
  ) { }

  async create(createContentBlockDto: CreateContentBlockDto) {
    const block = this.contentBlocksRepository.create(createContentBlockDto);
    const result = await this.contentBlocksRepository.save(block);
    await this.invalidateCache();
    return result;
  }

  async findAll() {
    const cached = await this.redisService.get(this.CACHE_KEY_ALL);
    if (cached) return cached;

    const result = await this.contentBlocksRepository.find({
      order: {
        order: 'ASC',
        createdAt: 'DESC',
      },
    });
    await this.redisService.set(this.CACHE_KEY_ALL, result, 3600);
    return result;
  }

  async findAllActive() {
    const cached = await this.redisService.get(this.CACHE_KEY_ACTIVE);
    if (cached) return cached;

    const result = await this.contentBlocksRepository.find({
      where: { isVisible: true },
      order: {
        order: 'ASC',
      },
    });
    await this.redisService.set(this.CACHE_KEY_ACTIVE, result, 3600);
    return result;
  }

  findOne(id: string) {
    return this.contentBlocksRepository.findOneBy({ id });
  }

  async update(id: string, updateContentBlockDto: UpdateContentBlockDto) {
    await this.contentBlocksRepository.update(id, updateContentBlockDto);
    await this.invalidateCache();
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.contentBlocksRepository.delete(id);
    await this.invalidateCache();
    return result;
  }

  private async invalidateCache() {
    await this.redisService.del(this.CACHE_KEY_ACTIVE);
    await this.redisService.del(this.CACHE_KEY_ALL);
  }
}
