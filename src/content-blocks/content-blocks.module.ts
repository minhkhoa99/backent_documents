import { Module } from '@nestjs/common';
import { ContentBlocksService } from './content-blocks.service';
import { ContentBlocksController } from './content-blocks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentBlock } from './entities/content-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContentBlock])],
  controllers: [ContentBlocksController],
  providers: [ContentBlocksService],
})
export class ContentBlocksModule { }
