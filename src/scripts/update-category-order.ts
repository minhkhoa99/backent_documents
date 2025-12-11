import { AppDataSource } from '../data-source';
import { Category } from '../categories/entities/category.entity';
import { IsNull } from 'typeorm';

async function updateCategoryOrder() {
    console.log("Initializing Data Source...");
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const catRepo = AppDataSource.getRepository(Category);

    console.log("Fetching root categories...");
    const roots = await catRepo.find({
        where: { parent: IsNull() },
        order: { name: 'ASC' }
    });

    console.log(`Found ${roots.length} root categories. Applying auto-increment...`);

    let rootOrder = 1;
    for (const root of roots) {
        if (root.order !== rootOrder) {
            root.order = rootOrder;
            await catRepo.save(root);
            console.log(`Updated root: ${root.name} -> Order ${root.order}`);
        }
        rootOrder++;

        await updateChildrenOrder(catRepo, root);
    }

    console.log("Category order update completed.");
    await AppDataSource.destroy();
}

async function updateChildrenOrder(catRepo: any, parent: Category) {
    const children = await catRepo.find({
        where: { parent: { id: parent.id } },
        order: { name: 'ASC' }
    });

    if (children.length > 0) {
        let childOrder = 1;
        for (const child of children) {
            if (child.order !== childOrder) {
                child.order = childOrder;
                await catRepo.save(child);
            }
            childOrder++;
            await updateChildrenOrder(catRepo, child);
        }
    }
}

updateCategoryOrder().catch((error) => {
    console.error('Error updating category order:', error);
    process.exit(1);
});
