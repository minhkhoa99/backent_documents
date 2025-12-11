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

  async create(createCategoryDto: CreateCategoryDto) {
    if (!createCategoryDto.order) {
      const parentCondition = createCategoryDto.parent ? { id: createCategoryDto.parent.id } : IsNull();
      const lastItem = await this.categoryRepository.findOne({
        where: { parent: parentCondition },
        order: { order: 'DESC' },
      });
      createCategoryDto.order = lastItem ? lastItem.order + 1 : 1;
    }
    const category = this.categoryRepository.create(createCategoryDto);
    return this.categoryRepository.save(category);
  }

  findAll() {
    return this.categoryRepository.find({ relations: ['parent'] });
  }

  getTree() {
    return this.categoryRepository.find({
      where: { parent: IsNull() },
      relations: ['children'],
      order: {
        order: 'ASC',
        name: 'ASC',
      }
    });
  }

  findOne(id: string) {
    return this.categoryRepository.findOne({ where: { id } });
  }

  update(id: string, updateCategoryDto: UpdateCategoryDto) {
    return this.categoryRepository.update(id, updateCategoryDto);
  }

  async reorder(items: { id: string; order: number }[]) {
    await this.categoryRepository.manager.transaction(async (transactionalEntityManager) => {
      for (const item of items) {
        await transactionalEntityManager.update(Category, item.id, { order: item.order });
      }
    });
    return { success: true };
  }

  async seed() {
    const levels = [
      {
        name: 'Tiểu học',
        slug: 'tieu-hoc',
        order: 1,
        children: ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'],
      },
      {
        name: 'Trung học cơ sở',
        slug: 'thcs',
        order: 2,
        children: ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'],
      },
      {
        name: 'Trung học phổ thông',
        slug: 'thpt',
        order: 3,
        children: ['Lớp 10', 'Lớp 11', 'Lớp 12'],
      },
      {
        name: 'Đại học',
        slug: 'dai-hoc',
        order: 4,
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
          order: level.order,
        });
        parent = await this.categoryRepository.save(parent);
      } else {
        parent.order = level.order;
        await this.categoryRepository.save(parent);
      }

      let childOrder = 1;
      for (const childName of level.children) {
        const childSlug = this.slugify(childName);
        const existingChild = await this.categoryRepository.findOne({ where: { slug: childSlug } });
        if (!existingChild) {
          const child = this.categoryRepository.create({
            name: childName,
            slug: childSlug,
            parent: parent,
            description: `Tài liệu ${childName}`,
            order: childOrder,
          });
          await this.categoryRepository.save(child);
        } else {
          existingChild.order = childOrder;
          existingChild.parent = parent;
          await this.categoryRepository.save(existingChild);
        }
        childOrder++;
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

  async updateAutoIncrement() {
    const roots = await this.categoryRepository.find({
      where: { parent: IsNull() },
      order: { name: 'ASC' }
    });

    let rootOrder = 1;
    for (const root of roots) {
      root.order = rootOrder++;
      await this.categoryRepository.save(root);

      const children = await this.categoryRepository.find({
        where: { parent: { id: root.id } },
        order: { name: 'ASC' }
      });

      let childOrder = 1;
      for (const child of children) {
        child.order = childOrder++;
        await this.categoryRepository.save(child);
      }
    }
    return { message: 'Auto-increment updated' };
  }
}
