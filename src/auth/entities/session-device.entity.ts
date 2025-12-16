import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('session_devices')
export class SessionDevice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    jti: string;

    @Column({ nullable: true })
    jti_rf: string; // Refresh Token JTI

    @Column({ type: 'bigint' })
    exp: string; // Expiration timestamp (store as string to be safe with BigInt)

    @Column()
    user_agent: string;

    @Column({ default: false })
    revoked: boolean;

    @Column({ nullable: true })
    device_token: string;

    @Column({ nullable: true })
    device_name: string;

    @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
