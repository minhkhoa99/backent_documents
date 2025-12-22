import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const { method, url, body, query, params, ip } = request;
        const userAgent = request.get('user-agent') || '';

        const now = Date.now();

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const delay = Date.now() - now;
                    this.logger.log(
                        `[${method}] ${url} ${response.statusCode} - ${delay}ms - IP: ${ip} - User: ${request.user?.id || 'Guest'}`,
                    );
                },
                error: (error) => {
                    const delay = Date.now() - now;
                    const status = error.status || 500;
                    this.logger.error(
                        `[${method}] ${url} ${status} - ${delay}ms - IP: ${ip} - User: ${request.user?.id || 'Guest'} - Error: ${error.message}`,
                        error.stack,
                    );
                },
            }),
        );
    }
}
