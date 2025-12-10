import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'edumarket');

        // MinIO Configuration
        this.s3Client = new S3Client({
            region: this.configService.get<string>('MINIO_REGION', 'us-east-1'),
            endpoint: this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000'),
            forcePathStyle: true, // Required for MinIO
            credentials: {
                accessKeyId: this.configService.get<string>('MINIO_ROOT_USER', 'admin'),
                secretAccessKey: this.configService.get<string>('MINIO_ROOT_PASSWORD', 'password'),
            },
        });
    }

    async uploadFile(file: Express.Multer.File): Promise<string> {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExtension}`;
        return this.uploadBuffer(file.buffer, fileName, file.mimetype);
    }

    async uploadBuffer(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
        try {
            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: fileName,
                    Body: buffer,
                    ContentType: contentType,
                }),
            );
            return fileName;
        } catch (error) {
            console.error('Error uploading file to MinIO:', error);
            throw new InternalServerErrorException('Could not upload file');
        }
    }

    async getFile(fileName: string): Promise<Buffer> {
        try {
            const response = await this.s3Client.send(
                new GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: fileName,
                }),
            );

            // Convert stream to buffer
            const stream = response.Body as any; // NodeJS.ReadableStream
            const chunks: Uint8Array[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            console.error('Error getting file from MinIO:', error);
            throw new InternalServerErrorException('Could not get file');
        }
    }

    getPublicUrl(fileName: string): string {
        const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
        return `${endpoint}/${this.bucketName}/${fileName}`;
    }
}
