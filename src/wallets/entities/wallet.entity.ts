import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    balance: number;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(() => User, (user) => user.wallet)
    @JoinColumn()
    user: User;
}
