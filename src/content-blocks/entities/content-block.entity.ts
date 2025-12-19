
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ContentBlockType {
    LATEST = 'LATEST',
    POPULAR = 'POPULAR',
    FEATURED = 'FEATURED',
    CATEGORY = 'CATEGORY',
}

@Entity('content_blocks')
export class ContentBlock {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({
        type: 'enum',
        enum: ContentBlockType,
        default: ContentBlockType.LATEST
    })
    type: ContentBlockType;

    @Column('int', { default: 0 })
    order: number;

    @Column({ default: true })
    isVisible: boolean;

    @Column({ type: 'json', nullable: true })
    config: any;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
