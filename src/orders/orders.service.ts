import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Cart } from '../cart/entities/cart.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class OrdersService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) { }

  async getMyDocuments(userId: string) {
    const orders = await this.orderRepo.find({
      where: {
        user: { id: userId },
        status: OrderStatus.COMPLETED
      },
      relations: ['items', 'items.document', 'items.document.author', 'items.document.category'],
      order: { createdAt: 'DESC' }
    });

    // Flatten to list of unique documents (in case bought multiple times? shouldn't happen but good to map)
    const documents = orders.flatMap(order => order.items.map(item => ({
      ...item.document,
      purchaseDate: order.createdAt
    })));

    // Deduplicate by ID just in case
    const uniqueDocs = Array.from(new Map(documents.map(item => [item.id, item])).values());

    return uniqueDocs;
  }

  async checkout(userId: string) {
    return this.dataSource.transaction(async manager => {
      const cart = await manager.findOne(Cart, {
        where: { user: { id: userId } },
        relations: ['items', 'items.document', 'items.document.price', 'user', 'user.wallet'],
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      let total = 0;
      for (const item of cart.items) {
        const price = item.document.price ? Number(item.document.price.amount) : 0;
        total += price;
      }

      const wallet = cart.user.wallet;

      if (total > 0) {
        if (!wallet) throw new BadRequestException('Wallet not found');
        if (Number(wallet.balance) < total) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      const order = manager.create(Order, {
        user: { id: userId },
        totalAmount: total,
        status: OrderStatus.COMPLETED,
        items: cart.items.map(ci => ({
          document: ci.document,
          price: ci.document.price ? Number(ci.document.price.amount) : 0
        }))
      });
      const savedOrder = await manager.save(Order, order);

      if (total > 0 && wallet) {
        wallet.balance = Number(wallet.balance) - total;
        await manager.save(Wallet, wallet);

        const tx = manager.create(Transaction, {
          wallet: wallet,
          amount: -total,
          type: TransactionType.PAYMENT,
          order: savedOrder,
        });
        await manager.save(Transaction, tx);
      }

      // Clear Cart
      await manager.remove(cart.items);

      return savedOrder;
    });
  }

  findAll() { return 'This action returns all orders'; }
  findOne(id: number) { return `This action returns a #${id} order`; }
  remove(id: number) { return `This action removes a #${id} order`; }
}
