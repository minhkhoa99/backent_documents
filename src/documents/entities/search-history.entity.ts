import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('search_history')
export class SearchHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  keyword: string;

  @Column({ default: 1 })
  count: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
