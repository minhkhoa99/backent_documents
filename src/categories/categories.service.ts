import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) { }

  create(createCategoryDto: CreateCategoryDto) {
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  findAll() {
    return this.categoryRepository.find();
  }

  getTree() {
    return this.categoryRepository.find({
      where: { parent: IsNull() },
      relations: ['children'],
      order: {
        name: 'ASC', // Or add a separate 'order' column later
      }
    });
  }

  findOne(id: string) {
    return this.categoryRepository.findOne({ where: { id } });
  }

  update(id: string, updateCategoryDto: UpdateCategoryDto) {
    return this.categoryRepository.update(id, updateCategoryDto);
  }

  async seed() {
    const levels = [
      {
        name: 'Tiểu học',
        slug: 'tieu-hoc',
        children: ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'],
      },
      {
        name: 'Trung học cơ sở',
        slug: 'thcs',
        children: ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'],
      },
      {
        name: 'Trung học phổ thông',
        slug: 'thpt',
        children: ['Lớp 10', 'Lớp 11', 'Lớp 12'],
      },
      {
        name: 'Đại học',
        slug: 'dai-hoc',
        children: [],
      },
    ];

    for (const level of levels) {
      let parent = await this.categoryRepository.findOne({ where: { slug: level.slug } });
      if (!parent) {
        parent = this.categoryRepository.create({
          name: level.name,
          slug: level.slug,
          description: `Tài liệu cấp ${level.name}`,
        });
        parent = await this.categoryRepository.save(parent);
      }

      for (const childName of level.children) {
        const childSlug = this.slugify(childName);
        const existingChild = await this.categoryRepository.findOne({ where: { slug: childSlug } });
        if (!existingChild) {
          const child = this.categoryRepository.create({
            name: childName,
            slug: childSlug,
            parent: parent,
            description: `Tài liệu ${childName}`,
          });
          await this.categoryRepository.save(child);
        }
      }
    }
    return { message: 'Seeding completed' };
  }

  private slugify(text: string) {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD') // Split accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  remove(id: string) {
    return this.categoryRepository.delete(id);
  }
}
