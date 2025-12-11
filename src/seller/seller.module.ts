
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { Document } from '../documents/entities/document.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, OrderItem]),
  ],
  controllers: [SellerController],
  providers: [SellerService],
})
export class SellerModule { }
