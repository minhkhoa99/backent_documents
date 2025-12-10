import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { Order } from '../../orders/entities/order.entity';

export enum TransactionType {
    DEPOSIT = 'deposit',
    WITHDRAW = 'withdraw',
    PAYMENT = 'payment',
    COMMISSION = 'commission',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: TransactionType,
    })
    type: TransactionType;

    @Column('decimal', { precision: 15, scale: 2 })
    amount: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Wallet, { nullable: false })
    wallet: Wallet;

    @ManyToOne(() => Order, { nullable: true })
    order: Order;
}
