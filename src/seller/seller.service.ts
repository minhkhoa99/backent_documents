
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class SellerService {
  constructor(
    @InjectRepository(Document)
    private docsRepo: Repository<Document>,
    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    @InjectQueue('documents') private documentsQueue: Queue,
  ) { }

  async getStats(sellerId: string) {
    // Optimized: Calculate stats in DB using aggregation
    const result = await this.orderItemRepo.createQueryBuilder('orderItem')
      .leftJoin('orderItem.document', 'document')
      .leftJoin('orderItem.order', 'order')
      .where('document.authorId = :sellerId', { sellerId })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .select('SUM(orderItem.price)', 'totalRevenue')
      .addSelect('COUNT(orderItem.id)', 'totalDownloads')
      .getRawOne();

    const totalRevenue = parseFloat(result.totalRevenue) || 0;
    const totalDownloads = parseInt(result.totalDownloads) || 0;

    return {
      totalRevenue,
      totalDownloads,
      totalViews: totalDownloads * 10 // Mock views logic
    };
  }

  async getDocuments(sellerId: string) {
    return this.docsRepo.find({
      where: {
        author: { id: sellerId },
        isDeleted: false
      },
      relations: ['price', 'category'],
      order: { createdAt: 'DESC' }
    });
  }

  async createDocument(sellerId: string, data: any, file: Express.Multer.File) {
    // This would reuse DocumentsService logic or be a simplified version.
    return { message: 'Use standard upload API for now with seller ID? Or implement full upload here.' };
  }

  async getOrders(sellerId: string) {
    // Optimized: Select specific fields and relations.
    // Assuming we just need basic order info.
    return this.orderItemRepo.find({
      where: {
        document: {
          author: { id: sellerId }
        }
      },
      relations: ['document', 'order', 'order.user'],
      select: {
        id: true,
        price: true,
        document: {
          id: true,
          title: true,
          fileUrl: true
        },
        order: {
          id: true,
          status: true,
          createdAt: true,
          user: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      order: {
        order: {
          createdAt: 'DESC'
        }
      }
    });
  }

  async updateDocument(sellerId: string, docId: string, updateData: any) {
    const doc = await this.docsRepo.findOne({ where: { id: docId }, relations: ['author', 'price', 'category'] });
    if (!doc) {
      throw new Error('Document not found'); // Use proper exceptions in real app
    }
    if (doc.author.id !== sellerId) {
      throw new Error('Forbidden');
    }

    doc.title = updateData.title || doc.title;
    doc.description = updateData.description || doc.description;
    doc.avatar = updateData.avatar || doc.avatar;
    if (updateData.categoryId) {
      doc.category = { id: updateData.categoryId } as any;
    }

    // Update active status
    if (updateData.isActive !== undefined) {
      doc.isActive = updateData.isActive;
    }

    if (updateData.fileUrl && updateData.fileUrl !== doc.fileUrl) {
      doc.fileUrl = updateData.fileUrl; // Update file url
      const fileKey = doc.fileUrl.split('/').pop();
      if (fileKey) {
        await this.documentsQueue.add('process-pdf', {
          documentId: doc.id,
          fileKey: fileKey
        });
      }
    }

    // Update price if provided
    if (updateData.price !== undefined) {
      if (!doc.price) {
        // Create new price if missing
      } else {
        doc.price.amount = updateData.price;
      }
    }

    if (updateData.discountPercentage !== undefined) {
      doc.discountPercentage = updateData.discountPercentage;
    }

    return this.docsRepo.save(doc);
  }

  async deleteDocument(sellerId: string, docId: string) {
    const doc = await this.docsRepo.findOne({ where: { id: docId }, relations: ['author'] });
    if (!doc) throw new Error('Document not found');
    if (doc.author.id !== sellerId) throw new Error('Forbidden');

    doc.isDeleted = true;
    return this.docsRepo.save(doc);
  }
}
