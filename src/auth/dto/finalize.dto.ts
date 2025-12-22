import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class FinalizeRegisterDto {
    @IsNotEmpty()
    @IsString()
    sign_key: string;
}

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    sign_key: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    new_password: string;
}
