/**
 * Test MongoDB Connection
 * 
 * Simple script to test MongoDB connection and diagnose issues
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

async function testConnection() {
    console.log('🔍 Testing MongoDB Connection\n');
    console.log('='.repeat(60));
    
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI environment variable is required');
        process.exit(1);
    }
    
    // Mask password for display
    const maskedUri = MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connection String: ${maskedUri}\n`);
    
    // Test different connection string variations
    const variations = [
        {
            name: 'Original (as provided)',
            uri: MONGODB_URI
        },
        {
            name: 'With authSource=admin',
            uri: MONGODB_URI.includes('?') 
                ? `${MONGODB_URI}&authSource=admin`
                : `${MONGODB_URI}?authSource=admin`
        },
        {
            name: 'With /ARSDB and authSource=admin',
            uri: (() => {
                let uri = MONGODB_URI;
                // Remove existing database if present
                uri = uri.replace(/\/[^/?]+(\?|$)/, '/ARSDB$1');
                // Add authSource
                if (!uri.includes('authSource=')) {
                    uri = uri.includes('?') ? `${uri}&authSource=admin` : `${uri}?authSource=admin`;
                }
                return uri;
            })()
        }
    ];
    
    for (const variation of variations) {
        console.log(`\n📡 Testing: ${variation.name}`);
        console.log(`   URI: ${variation.uri.replace(/:([^:@]+)@/, ':****@')}`);
        
        let client;
        try {
            client = new MongoClient(variation.uri);
            await client.connect();
            console.log('   ✅ Connection successful!');
            
            // Try to list databases
            const adminDb = client.db().admin();
            const { databases } = await adminDb.listDatabases();
            console.log(`   ✅ Found ${databases.length} databases`);
            
            // Try to access ARSDB
            const db = client.db('ARSDB');
            const collections = await db.listCollections().toArray();
            console.log(`   ✅ Found ${collections.length} collections in ARSDB`);
            
            if (collections.length > 0) {
                console.log('   Collections:');
                for (const coll of collections.slice(0, 5)) {
                    const count = await db.collection(coll.name).countDocuments();
                    console.log(`      - ${coll.name}: ${count} documents`);
                }
            }
            
            await client.close();
            console.log('\n✅ SUCCESS! This connection string works:');
            console.log(`   ${variation.uri.replace(/:([^:@]+)@/, ':****@')}`);
            console.log('\n💡 Update your .env file with this connection string.\n');
            return;
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
            if (client) {
                try {
                    await client.close();
                } catch (e) {
                    // Ignore close errors
                }
            }
        }
    }
    
    console.log('\n❌ All connection attempts failed.');
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify the password in Railway Variables');
    console.log('   2. Make sure you copied MONGO_PUBLIC_URL (not MONGO_URL)');
    console.log('   3. Check that the password has no extra spaces or characters');
    console.log('   4. Try copying the password again from Railway\n');
}

if (require.main === module) {
    testConnection().catch(console.error);
}

module.exports = { testConnection };

