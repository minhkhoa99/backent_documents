import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Document } from '../documents/entities/document.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private cartRepo: Repository<Cart>,
    @InjectRepository(CartItem) private cartItemRepo: Repository<CartItem>,
    @InjectRepository(Document) private docRepo: Repository<Document>,
  ) { }

  async getCart(userId: string) {
    let cart = await this.cartRepo.findOne({
      where: { user: { id: userId } },
      relations: ['items', 'items.document', 'items.document.price'],
    });

    if (!cart) {
      cart = this.cartRepo.create({ user: { id: userId }, items: [] });
      await this.cartRepo.save(cart);
    }
    return cart;
  }

  async addToCart(userId: string, documentId: string) {
    const cart = await this.getCart(userId);
    const doc = await this.docRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    // Check if item exists
    const exists = cart.items.find(item => item.document.id === documentId);
    if (exists) return cart;

    const item = this.cartItemRepo.create({
      cart,
      document: doc,
    });
    await this.cartItemRepo.save(item);

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string) {
    const cart = await this.getCart(userId);
    await this.cartItemRepo.delete({ id: itemId, cart: { id: cart.id } });
    return this.getCart(userId);
  }
}
