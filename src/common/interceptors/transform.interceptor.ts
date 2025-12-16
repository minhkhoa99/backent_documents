import { Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    success: boolean;
    code: number;
    message: string;
    data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map(data => {
                if (data instanceof StreamableFile) {
                    return data;
                }
                return {
                    success: true,
                    code: context.switchToHttp().getResponse().statusCode,
                    message: 'Operation successful',
                    data: data,
                };
            }),
        );
    }
}
