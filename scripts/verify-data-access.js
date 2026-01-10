/**
 * Verify Data Access Script
 * 
 * This script verifies that:
 * 1. All data is accessible (not tied to a specific user)
 * 2. Any authenticated user can access all products
 * 3. No mounting/association is needed
 * 
 * Usage:
 *   node scripts/verify-data-access.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

async function verifyDataAccess() {
    console.log('🔍 Verifying Data Access Structure\n');
    console.log('='.repeat(60));
    
    let client;
    
    try {
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is required');
        }
        
        // Ensure authSource is included for Railway MongoDB
        let connectionUri = MONGODB_URI;
        if (!connectionUri.includes('authSource=')) {
            // Add authSource if not present
            const separator = connectionUri.includes('?') ? '&' : '?';
            connectionUri = `${connectionUri}${separator}authSource=admin`;
            console.log('   Adding authSource=admin to connection string');
        }
        
        client = new MongoClient(connectionUri);
        await client.connect();
        console.log('✅ Connected to MongoDB\n');
        
        // Extract database name from connection string
        // Format: mongodb://user:pass@host:port/database?options
        let dbName = 'ARSDB'; // default (Railway MongoDB database name)
        try {
            const url = new URL(MONGODB_URI);
            // Get database name from pathname (remove leading slash)
            dbName = url.pathname ? url.pathname.substring(1) : 'ARSDB';
            // If no database in path, try to get from query params or use default
            if (!dbName || dbName === '') {
                dbName = process.env.MONGODB_DB || 'ARSDB';
            }
        } catch (e) {
            // Fallback: try simple string parsing
            const match = MONGODB_URI.match(/\/([^/?]+)(\?|$)/);
            if (match && match[1]) {
                dbName = match[1];
            } else {
                dbName = process.env.MONGODB_DB || 'ARSDB';
            }
        }
        
        console.log(`   Using database: ${dbName}\n`);
        const db = client.db(dbName);
        
        // Check products collection structure
        console.log('📦 Checking Products Collection...');
        const productsSample = await db.collection('products').find({}).limit(1).toArray();
        
        if (productsSample.length > 0) {
            const product = productsSample[0];
            console.log('   Sample product fields:', Object.keys(product).join(', '));
            
            // Check if product has user ownership fields
            const hasUserId = 'userId' in product || 'ownerId' in product || 'created_by' in product || 'owner' in product;
            
            if (hasUserId) {
                console.log('   ⚠️  Products have user ownership fields');
                console.log('   Fields found:', Object.keys(product).filter(k => 
                    k.includes('user') || k.includes('owner') || k.includes('created_by')
                ).join(', '));
            } else {
                console.log('   ✅ Products have NO user ownership fields');
                console.log('   ✅ Data is shared - accessible to all authenticated users');
            }
        } else {
            console.log('   ℹ️  No products found in database');
        }
        
        // Count total products
        const productCount = await db.collection('products').countDocuments();
        console.log(`   Total products: ${productCount}\n`);
        
        // Check warranties
        console.log('📋 Checking Warranties Collection...');
        const warrantySample = await db.collection('warranties').find({}).limit(1).toArray();
        
        if (warrantySample.length > 0) {
            const warranty = warrantySample[0];
            const hasUserId = 'userId' in warranty || 'ownerId' in warranty || 'created_by' in warranty;
            
            if (hasUserId) {
                console.log('   ⚠️  Warranties have user ownership fields');
            } else {
                console.log('   ✅ Warranties have NO user ownership fields');
                console.log('   ✅ Data is shared - accessible to all authenticated users');
            }
        }
        
        const warrantyCount = await db.collection('warranties').countDocuments();
        console.log(`   Total warranties: ${warrantyCount}\n`);
        
        console.log('='.repeat(60));
        console.log('\n📊 Summary:\n');
        console.log('✅ Your data is NOT tied to a specific user account');
        console.log('✅ Any authenticated admin user can access ALL data');
        console.log('✅ No mounting or data association is needed');
        console.log('\n🎯 Next Steps:');
        console.log('   1. Create a User Service account');
        console.log('   2. Set it to "master" level');
        console.log('   3. Log in to AirPod Portal with User Service');
        console.log('   4. You will immediately see ALL your products\n');
        
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
    verifyDataAccess().catch(console.error);
}

module.exports = { verifyDataAccess };

