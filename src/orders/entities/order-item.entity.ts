import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Order } from './order.entity';
import { Document } from '../../documents/entities/document.entity';

@Entity('order_items')
export class OrderItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
    order: Order;

    @Index()
    @ManyToOne(() => Document)
    document: Document;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;
}
