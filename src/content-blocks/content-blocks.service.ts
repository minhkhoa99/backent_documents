
import { Injectable } from '@nestjs/common';
import { CreateContentBlockDto } from './dto/create-content-block.dto';
import { UpdateContentBlockDto } from './dto/update-content-block.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ContentBlock } from './entities/content-block.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ContentBlocksService {
  constructor(
    @InjectRepository(ContentBlock)
    private contentBlocksRepository: Repository<ContentBlock>,
  ) { }

  create(createContentBlockDto: CreateContentBlockDto) {
    const block = this.contentBlocksRepository.create(createContentBlockDto);
    return this.contentBlocksRepository.save(block);
  }

  findAll() {
    return this.contentBlocksRepository.find({
      order: {
        order: 'ASC',
        createdAt: 'DESC',
      },
    });
  }

  findAllActive() {
    return this.contentBlocksRepository.find({
      where: { isVisible: true },
      order: {
        order: 'ASC',
      },
    });
  }

  findOne(id: string) {
    return this.contentBlocksRepository.findOneBy({ id });
  }

  async update(id: string, updateContentBlockDto: UpdateContentBlockDto) {
    await this.contentBlocksRepository.update(id, updateContentBlockDto);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.contentBlocksRepository.delete(id);
  }
}
