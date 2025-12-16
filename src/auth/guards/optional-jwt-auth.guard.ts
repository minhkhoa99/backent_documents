import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err, user, info) {
        // No error is thrown if no user is found
        // We just return user if valid, or null/undefined
        return user || null;
    }
}
