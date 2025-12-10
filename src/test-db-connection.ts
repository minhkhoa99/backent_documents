import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
    console.log('Testing connection with env vars:');
    console.log(`User: ${process.env.POSTGRES_USER}`);
    console.log(`DB: ${process.env.POSTGRES_DB}`);
    console.log(`Host: ${process.env.POSTGRES_HOST}`);

    const client = new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
    });

    try {
        await client.connect();
        console.log('Successfully connected to database!');
        await client.end();
    } catch (err: any) {
        console.error('Connection failed:', err.message);
        if (err.message.includes('authentication failed')) {
            console.log('Suggestion: Check if the password is correct.');
        } else if (err.message.includes('does not exist')) {
            console.log('Suggestion: The database name might be wrong or not created yet.');
        }
    }
}

testConnection();
