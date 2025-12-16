import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionDevice } from './entities/session-device.entity';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    TypeOrmModule.forFeature([SessionDevice]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const privateKeyPath = path.join(__dirname, 'settings', 'private_key.pem');
        const publicKeyPath = path.join(__dirname, 'settings', 'public_key.pem');
        let privateKey: string;
        let publicKey: string;
        try {
          // Try reading from the specified path
          privateKey = fs.readFileSync(privateKeyPath, 'utf8');
          publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        } catch (e) {
          console.warn('Keys not found at ' + privateKeyPath + ', falling back to config secret');
          return {
            secret: configService.get<string>('JWT_SECRET') || 'defaultSecret',
            signOptions: { expiresIn: '1d' },
          };
        }
        return {
          privateKey: privateKey,
          // For now, let's just load it as privateKey and use algorithm: 'RS256' if possible.
          // However, verification needs Public Key. The user didn't provide public_key.pem.
          // We can derive public key from private key if needed, or maybe it's just a secret string in a .pem file?
          // Let's assume RS256.
          signOptions: { expiresIn: '1d', algorithm: 'RS256' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        });
      },
      inject: [ConfigService],
    }
  ],
  exports: [AuthService, 'REDIS_CLIENT'], // Export REDIS_CLIENT if needed elsewhere
})
export class AuthModule { }
