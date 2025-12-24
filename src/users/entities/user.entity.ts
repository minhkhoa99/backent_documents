import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, Index } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';

export enum UserRole {
    ADMIN = 'admin',
    VENDOR = 'vendor',
    BUYER = 'buyer',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column() // Hashed password
    password?: string;

    @Index()
    @Column()
    fullName: string;

    @Index()
    @Column({ nullable: true })
    phone: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.BUYER,
    })
    role: UserRole;

    @Column({ default: true })
    isActive: boolean;

    @Column({ name: 'is_verify', default: false })
    isVerified: boolean;

    @Column({ name: 'otp_code', nullable: true })
    otpCode: string;

    @Column({ name: 'otp_exp', type: 'timestamp', nullable: true })
    otpExp: Date;

    @Column({ name: 'otp_retry', default: 0 })
    otpRetry: number;



    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(() => Wallet, (wallet) => wallet.user)
    wallet: Wallet;
}
