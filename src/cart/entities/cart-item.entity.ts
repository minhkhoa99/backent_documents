import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Cart } from './cart.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity('cart_items')
export class CartItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
    cart: Cart;

    @ManyToOne(() => Document, { eager: true }) // Eager load to see product details
    document: Document;

    @CreateDateColumn()
    createdAt: Date;
}
