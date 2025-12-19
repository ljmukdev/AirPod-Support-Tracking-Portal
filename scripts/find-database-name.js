/**
 * Find Database Name Script
 * 
 * This script helps you find the correct database name from your MongoDB connection string
 * 
 * Usage:
 *   node scripts/find-database-name.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

async function findDatabaseName() {
    console.log('🔍 Finding Database Name from MongoDB URI\n');
    console.log('='.repeat(60));
    
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI environment variable is required');
        console.log('\nPlease create a .env file with:');
        console.log('MONGODB_URI=your_connection_string_here\n');
        process.exit(1);
    }
    
    // Mask password in connection string for display
    const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connection String: ${maskedUri}\n`);
    
    let client;
    
    try {
        // Parse database name from URI
        console.log('📋 Parsing database name from URI...\n');
        
        let dbName = null;
        try {
            const url = new URL(MONGODB_URI);
            dbName = url.pathname ? url.pathname.substring(1) : null;
            if (dbName) {
                console.log(`   Found in pathname: "${dbName}"`);
            }
        } catch (e) {
            console.log('   Could not parse as URL, trying regex...');
            const match = MONGODB_URI.match(/\/([^/?]+)(\?|$)/);
            if (match && match[1]) {
                dbName = match[1];
                console.log(`   Found with regex: "${dbName}"`);
            }
        }
        
        if (!dbName || dbName === '') {
            console.log('   ⚠️  No database name found in URI');
            console.log('   Using default: "airpod_support"');
            dbName = 'airpod_support';
        }
        
        console.log(`\n📊 Attempting to connect to database: "${dbName}"\n`);
        
        // Connect and list all databases
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB\n');
        
        // List all databases
        const adminDb = client.db().admin();
        const { databases } = await adminDb.listDatabases();
        
        console.log('📚 Available databases:');
        databases.forEach(db => {
            const sizeMB = (db.sizeOnDisk / 1024 / 1024).toFixed(2);
            const marker = db.name === dbName ? ' ← Currently using' : '';
            console.log(`   - ${db.name} (${sizeMB} MB)${marker}`);
        });
        
        // Check if the database has collections
        console.log(`\n📦 Collections in "${dbName}":`);
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        
        if (collections.length === 0) {
            console.log('   ⚠️  No collections found in this database');
        } else {
            for (const coll of collections) {
                const count = await db.collection(coll.name).countDocuments();
                console.log(`   - ${coll.name}: ${count} documents`);
            }
        }
        
        // Check other likely database names
        console.log('\n🔍 Checking other likely database names...\n');
        const likelyNames = ['airpod_support', 'airpod', 'ljm', 'railway', 'production'];
        
        for (const name of likelyNames) {
            if (name === dbName) continue; // Skip already checked
            
            try {
                const testDb = client.db(name);
                const testCollections = await testDb.listCollections().toArray();
                if (testCollections.length > 0) {
                    console.log(`   ✅ Found database "${name}" with ${testCollections.length} collections:`);
                    for (const coll of testCollections) {
                        const count = await testDb.collection(coll.name).countDocuments();
                        console.log(`      - ${coll.name}: ${count} documents`);
                    }
                    console.log();
                }
            } catch (e) {
                // Database doesn't exist or can't access
            }
        }
        
        console.log('='.repeat(60));
        console.log('\n💡 If you found your data in a different database:');
        console.log('   Add this to your .env file:');
        console.log(`   MONGODB_DB=correct_database_name\n`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

if (require.main === module) {
    findDatabaseName().catch(console.error);
}

module.exports = { findDatabaseName };

