import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendOtpDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^(\+84)(3|5|7|8|9)[0-9]{8}$/, { message: 'Invalid phone number format' })
    @Transform(({ value }) => {
        if (!value) return value;
        let phone = value.replace(/\s+/g, '');
        if (phone.startsWith('0')) {
            phone = '+84' + phone.slice(1);
        }
        return phone;
    })
    phone: string;
}

export class VerifyOtpDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^(\+84)(3|5|7|8|9)[0-9]{8}$/, { message: 'Invalid phone number format' })
    @Transform(({ value }) => {
        if (!value) return value;
        let phone = value.replace(/\s+/g, '');
        if (phone.startsWith('0')) {
            phone = '+84' + phone.slice(1);
        }
        return phone;
    })
    phone: string;

    @IsNotEmpty()
    @IsString()
    code: string;
}
