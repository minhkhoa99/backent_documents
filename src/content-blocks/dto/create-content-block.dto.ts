
import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ContentBlockType } from '../entities/content-block.entity';

export class CreateContentBlockDto {
    @IsString()
    title: string;

    @IsEnum(ContentBlockType)
    type: ContentBlockType;

    @IsNumber()
    @IsOptional()
    order?: number;

    @IsBoolean()
    @IsOptional()
    isVisible?: boolean;

    @IsObject()
    @IsOptional()
    config?: any;
}
