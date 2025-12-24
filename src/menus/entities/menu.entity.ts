import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('menus')
export class Menu {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    label: string;

    @Column({ nullable: true })
    link: string;

    @Column({ nullable: true })
    icon: string;

    @Index()
    @Column({ default: 0 })
    order: number;

    @Column({ default: true })
    isActive: boolean;

    @ManyToOne(() => Menu, (menu) => menu.children, { nullable: true, onDelete: 'CASCADE' })
    parent: Menu;

    @OneToMany(() => Menu, (menu) => menu.parent)
    children: Menu[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
