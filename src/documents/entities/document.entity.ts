import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, Index } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { User } from '../../users/entities/user.entity';
import { Price } from './price.entity';

export enum DocumentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Entity('documents')
@Index(['isDeleted', 'isActive', 'status'])
export class Document {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column()
    fileUrl: string;

    @Column({ nullable: true })
    previewUrl: string;

    @Column({ nullable: true })
    avatar: string;

    @Column('int', { default: 0 })
    totalPage: number;

    @Column({
        type: 'enum',
        enum: DocumentStatus,
        default: DocumentStatus.PENDING,
    })
    status: DocumentStatus;

    @Column({ default: false })
    isDeleted: boolean;

    @Column({ default: true })
    isActive: boolean;

    @Index()
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Index()
    @Column({ default: 0 })
    views: number;

    @ManyToOne(() => Category, (category) => category.documents)
    category: Category;

    @ManyToOne(() => User, { nullable: true })
    author: User;

    @OneToOne(() => Price, (price) => price.document, { cascade: true })
    price: Price;

    @Index()
    @Column({ default: 0 })
    discountPercentage: number;
}
