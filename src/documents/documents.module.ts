import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Document } from './entities/document.entity';
import { Price } from './entities/price.entity';
import { StorageModule } from '../storage/storage.module';
import { DocumentsProcessor } from './documents.processor';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Price, Order]),
    BullModule.registerQueue({
      name: 'documents',
    }),
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsProcessor],
})
export class DocumentsModule { }
