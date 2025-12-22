import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterInitDto {
    @IsNotEmpty()
    @IsString()
    @Matches(/^(\+84)(3|5|7|8|9)[0-9]{8}$/, { message: 'Invalid phone number format' })
    @Transform(({ value }) => {
        if (!value) return value;
        // Remove spaces
        let phone = value.replace(/\s+/g, '');
        // Convert 0 -> +84
        if (phone.startsWith('0')) {
            phone = '+84' + phone.slice(1);
        }
        return phone;
    })
    phone: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;
}
