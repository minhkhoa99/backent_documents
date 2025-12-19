import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';

@Injectable()
export class StorageService {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY');
        const awsSecretKey = this.configService.get<string>('AWS_SECRET_KEY');
        const awsBucket = this.configService.get<string>('AWS_S3_BUCKET');
        const awsRegion = this.configService.get<string>('AWS_S3_REGION');

        if (awsAccessKey && awsSecretKey && awsBucket && awsRegion) {
            this.bucketName = awsBucket;
            this.s3Client = new S3Client({
                region: awsRegion,
                credentials: {
                    accessKeyId: awsAccessKey,
                    secretAccessKey: awsSecretKey,
                },
            });
        } else {
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
    }

    async uploadFile(file: Express.Multer.File, configThumString?: string): Promise<string> {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const baseName = uuidv4();
        const fileName = `${baseName}${fileExtension}`;

        // Always upload original
        const originalPath = await this.uploadBuffer(file.buffer, fileName, file.mimetype);

        // Process resizing if config is present and file is an image
        if (configThumString && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExtension.replace('.', ''))) {
            try {
                // Parse config: e.g., [{"width": 800, "height": 600}, ...]
                // The user mentioned just sending config, so we expect similar structure.
                // Or maybe the user sends JSON string directly.
                let configs: { width: number; height: number }[] = [];
                try {
                    configs = JSON.parse(configThumString);
                    // Ensure it's an array
                    if (!Array.isArray(configs)) configs = [configs];
                } catch (e) {
                    console.error('Invalid thumb config JSON', e);
                }

                if (configs.length > 0) {
                    await Promise.all(configs.map(async (conf) => {
                        if (conf.width && conf.height) {
                            try {
                                const resizedBuffer = await sharp(file.buffer)
                                    .resize(conf.width, conf.height, {
                                        fit: 'cover', // crop to cover aspect ratio
                                    })
                                    .toBuffer();

                                // Folder structure: {width}x{height}/{filename}
                                const sizeFolder = `${conf.width}x${conf.height}`;
                                const resizedKey = `${sizeFolder}/${fileName}`;

                                await this.uploadBuffer(resizedBuffer, resizedKey, file.mimetype);
                                console.log(`Uploaded resized image: ${resizedKey}`);
                            } catch (err) {
                                console.error(`Error resizing to ${conf.width}x${conf.height}`, err);
                            }
                        }
                    }));
                }
            } catch (err) {
                console.error('Error processing image thumbnails', err);
            }
        }

        return originalPath;
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
            console.error('Error uploading file to storage:', error);
            throw new InternalServerErrorException('Could not upload file');
        }
    }

    async getFile(fileName: string): Promise<Buffer> {
        console.log('StorageService: getFile requesting', fileName);
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
            const buffer = Buffer.concat(chunks);
            console.log('StorageService: getFile success. Size:', buffer.length);
            return buffer;
        } catch (error) {
            console.error('Error getting file from storage:', error);
            throw new InternalServerErrorException('Could not get file');
        }
    }

    async getFileStream(fileName: string): Promise<Readable> {
        const fs = require('fs');
        const logPath = 'e:/web_documents/storage_debug.log';
        const info = `[${new Date().toISOString()}] Requesting file stream. Bucket: ${this.bucketName}, Key: ${fileName}\n`;
        try {
            fs.appendFileSync(logPath, info);
        } catch (e) { }

        console.log('StorageService: requesting file stream', { bucket: this.bucketName, key: fileName });
        try {
            const response = await this.s3Client.send(
                new GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: fileName,
                }),
            );
            return response.Body as Readable;
        } catch (error) {
            const errInfo = `[${new Date().toISOString()}] Error getting file stream: ${error.message} \nStack: ${error.stack}\n`;
            try {
                fs.appendFileSync(logPath, errInfo);
            } catch (e) { }

            console.error('Error getting file stream:', error);
            throw new InternalServerErrorException(`Could not get file stream: ${error.message}`);
        }
    }

    getPublicUrl(fileName: string): string {
        const awsRegion = this.configService.get<string>('AWS_S3_REGION');
        if (awsRegion && this.configService.get<string>('AWS_S3_BUCKET')) {
            return `https://${this.bucketName}.s3.${awsRegion}.amazonaws.com/${fileName}`;
        }

        const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
        return `${endpoint}/${this.bucketName}/${fileName}`;
    }

    async getPresignedUrl(fileName: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
            });
            return getSignedUrl(this.s3Client, command, { expiresIn: 300 }); // 5 minutes
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw new InternalServerErrorException('Could not generate download URL');
        }
    }
}
