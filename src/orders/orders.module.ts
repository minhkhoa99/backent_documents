import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderItem } from './entities/order.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Cart, CartItem } from '../cart/entities/cart.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Transaction, Wallet, Cart, CartItem])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule { }
