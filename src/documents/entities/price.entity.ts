import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Document } from './document.entity';

@Entity('prices')
export class Price {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column({ default: 'VND' })
    currency: string;

    @OneToOne(() => Document, (document) => document.price, { onDelete: 'CASCADE' })
    @JoinColumn()
    document: Document;
}
