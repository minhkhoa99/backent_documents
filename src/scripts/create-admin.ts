import { AppDataSource } from '../data-source';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

async function seedAdmin() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);

    const adminEmail = 'admin@edumarket.com';
    const adminPassword = '123456a@'; // adminpassword123

    const existingAdmin = await userRepo.findOne({ where: { email: adminEmail } });
    if (existingAdmin) {
        console.log('Admin user already exists.');

        // Ensure role is admin
        if (existingAdmin.role !== UserRole.ADMIN) {
            existingAdmin.role = UserRole.ADMIN;
            await userRepo.save(existingAdmin);
            console.log('Updated existing user to ADMIN role.');
        }

    } else {
        console.log('Creating new admin user...');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const newAdmin = userRepo.create({
            email: adminEmail,
            password: hashedPassword,
            fullName: 'System Administrator',
            role: UserRole.ADMIN,
            isActive: true,
        });

        await userRepo.save(newAdmin);
        console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);
    }

    await AppDataSource.destroy();
}

seedAdmin().catch((error) => {
    console.error('Error seeding admin:', error);
    process.exit(1);
});
