import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Cart, CartItem } from './entities/cart.entity';
import { Document } from '../documents/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Document])],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule { }
