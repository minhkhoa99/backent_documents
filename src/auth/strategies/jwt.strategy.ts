import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private authService: AuthService
    ) {
        const publicKeyPath = path.join(__dirname, '..', 'settings', 'public_key.pem');
        let secretOrKey: string;
        try {
            secretOrKey = fs.readFileSync(publicKeyPath, 'utf8');
        } catch (e) {
            console.warn("Public Key not found, checking for secret...");
            secretOrKey = configService.get<string>('JWT_SECRET') || 'defaultSecret';
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: any) => {
                    return request?.cookies?.Authentication;
                },
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: secretOrKey,
            algorithms: ['RS256'], // Enforce RS256 for Public Key verification
        });
    }

    async validate(payload: any) {
        console.log("payload: ", payload);

        const isValid = await this.authService.isTokenValid(payload.jti);
        if (!isValid) {
            throw new UnauthorizedException('Token revoked or expired');
        }
        return { userId: payload.sub, email: payload.email, role: payload.role, id: payload.sub }; // Ensure 'id' is mapped to user payload
    }
}
