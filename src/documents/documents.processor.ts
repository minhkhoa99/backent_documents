import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from './entities/document.entity';
import { StorageService } from '../storage/storage.service';
import { PDFDocument, degrees } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';

@Processor('documents')
export class DocumentsProcessor {
    constructor(
        @InjectRepository(Document)
        private documentRepository: Repository<Document>,
        private storageService: StorageService,
    ) { }

    @Process('process-pdf')
    async handleProcessPdf(job: Job<{ documentId: string; fileKey: string }>) {
        const { documentId, fileKey } = job.data;
        console.log(`Processing PDF for document ${documentId}...`);

        try {
            // 1. Download file
            const fileBuffer = await this.storageService.getFile(fileKey);

            // Check if file is PDF
            if (!fileKey.toLowerCase().endsWith('.pdf')) {
                console.log(`Document ${documentId} is not a PDF. Approving without preview.`);
                await this.documentRepository.update(documentId, {
                    status: DocumentStatus.APPROVED,
                });
                return;
            }

            // 2. Load PDF
            const pdfDoc = await PDFDocument.load(fileBuffer);
            const totalPage = pdfDoc.getPageCount();

            // 3. Create Preview (First 5 pages or less)
            const previewDoc = await PDFDocument.create();
            const pagesToCopy = Math.min(totalPage, 5);
            const copiedPages = await previewDoc.copyPages(pdfDoc, Array.from({ length: pagesToCopy }, (_, i) => i));

            copiedPages.forEach((page) => {
                // Add watermark
                const { width, height } = page.getSize();
                page.drawText('EduMarket Preview', {
                    x: width / 2 - 100,
                    y: height / 2,
                    size: 50,
                    opacity: 0.2,
                    rotate: degrees(45),
                });
                previewDoc.addPage(page);
            });

            const previewPdfBytes = await previewDoc.save();
            const previewBuffer = Buffer.from(previewPdfBytes);

            // 4. Upload Preview
            const previewFileName = `preview-${uuidv4()}.pdf`;
            const previewKey = await this.storageService.uploadBuffer(
                previewBuffer,
                previewFileName,
                'application/pdf'
            );
            const previewUrl = this.storageService.getPublicUrl(previewKey);

            // 5. Update Document
            await this.documentRepository.update(documentId, {
                previewUrl: previewUrl,
                totalPage: totalPage,
                status: DocumentStatus.APPROVED,
            });

            console.log(`Finished processing document ${documentId}. Preview: ${previewUrl}`);
        } catch (error) {
            console.error(`Failed to process document ${documentId}`, error);
            await this.documentRepository.update(documentId, {
                status: DocumentStatus.REJECTED,
            });
        }
    }
}
