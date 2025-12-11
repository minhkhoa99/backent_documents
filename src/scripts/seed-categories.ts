import { AppDataSource } from '../data-source';
import { Category } from '../categories/entities/category.entity';

async function seed() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const categoryRepo = AppDataSource.getRepository(Category);

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
        let parent = await categoryRepo.findOne({ where: { slug: level.slug } });
        if (!parent) {
            console.log(`Creating parent category: ${level.name}`);
            parent = categoryRepo.create({
                name: level.name,
                slug: level.slug,
                description: `Tài liệu cấp ${level.name}`,
            });
            await categoryRepo.save(parent);
        }

        for (const childName of level.children) {
            const childSlug = slugify(childName);
            const existingChild = await categoryRepo.findOne({ where: { slug: childSlug } });
            if (!existingChild) {
                console.log(`  Creating child category: ${childName}`);
                const child = categoryRepo.create({
                    name: childName,
                    slug: childSlug,
                    parent: parent,
                    description: `Tài liệu ${childName}`,
                });
                await categoryRepo.save(child);
            }
        }
    }

    console.log('Seeding completed!');
    await AppDataSource.destroy();
}

function slugify(text: string) {
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

seed().catch((error) => {
    console.error('Error seeding data:', error);
    process.exit(1);
});
