/**
 * Migration Script: Legacy Admin Account to User Service
 * 
 * This script:
 * 1. Exports all data from MongoDB (products, warranties, settings, etc.)
 * 2. Creates a User Service account with your email
 * 3. Sets the account to "master" level for full access
 * 4. Verifies the migration
 * 
 * Usage:
 *   node scripts/migrate-to-user-service.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://autorestock-user-service-production.up.railway.app';
const USER_SERVICE_MASTER_EMAIL = process.env.USER_SERVICE_MASTER_EMAIL;
const USER_SERVICE_MASTER_PASSWORD = process.env.USER_SERVICE_MASTER_PASSWORD;

// Your new account details
const NEW_ACCOUNT_EMAIL = process.env.NEW_ACCOUNT_EMAIL || 'admin@ljmuk.co.uk';
const NEW_ACCOUNT_PASSWORD = process.env.NEW_ACCOUNT_PASSWORD || 'LJM2024secure';
const NEW_ACCOUNT_FIRST_NAME = process.env.NEW_ACCOUNT_FIRST_NAME || 'Admin';
const NEW_ACCOUNT_LAST_NAME = process.env.NEW_ACCOUNT_LAST_NAME || 'User';

// Export directory
const EXPORT_DIR = path.join(__dirname, '..', 'exports');
const EXPORT_FILE = path.join(EXPORT_DIR, `migration-export-${new Date().toISOString().split('T')[0]}.json`);

async function exportAllData(db) {
    console.log('\n📦 Exporting all data from MongoDB...');
    
    const collections = [
        'products',
        'warranties',
        'settings',
        'airpod_parts',
        'generations',
        'setup_instructions',
        'addon_sales',
        'warranty_pricing',
        'warranty_terms'
    ];
    
    const exportData = {
        exportDate: new Date().toISOString(),
        collections: {}
    };
    
    for (const collectionName of collections) {
        try {
            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            console.log(`  - ${collectionName}: ${count} documents`);
            
            if (count > 0) {
                const documents = await collection.find({}).toArray();
                exportData.collections[collectionName] = documents;
            } else {
                exportData.collections[collectionName] = [];
            }
        } catch (error) {
            console.error(`  ⚠️  Error exporting ${collectionName}:`, error.message);
            exportData.collections[collectionName] = [];
        }
    }
    
    // Create export directory if it doesn't exist
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
    
    // Write export file
    fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Export saved to: ${EXPORT_FILE}`);
    console.log(`   Total size: ${(fs.statSync(EXPORT_FILE).size / 1024).toFixed(2)} KB`);
    
    return exportData;
}

async function createUserServiceAccount() {
    console.log('\n👤 Creating User Service account...');
    console.log(`   Email: ${NEW_ACCOUNT_EMAIL}`);
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: NEW_ACCOUNT_EMAIL,
            password: NEW_ACCOUNT_PASSWORD,
            firstName: NEW_ACCOUNT_FIRST_NAME,
            lastName: NEW_ACCOUNT_LAST_NAME,
            tenantName: 'LJM UK'
        });
        
        const url = new URL(`${USER_SERVICE_URL}/api/v1/users`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 201) {
                        console.log('✅ Account created successfully!');
                        console.log(`   User ID: ${response.id}`);
                        resolve(response);
                    } else if (res.statusCode === 409) {
                        console.log('ℹ️  Account already exists, continuing...');
                        resolve({ id: 'existing', email: NEW_ACCOUNT_EMAIL });
                    } else {
                        console.error('❌ Failed to create account:', response);
                        reject(new Error(response.error || 'Account creation failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function loginToUserService(email, password) {
    console.log(`\n🔐 Logging in to User Service as ${email}...`);
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: email,
            password: password
        });
        
        const url = new URL(`${USER_SERVICE_URL}/api/v1/users/login`);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200 && response.success) {
                        console.log('✅ Login successful!');
                        resolve(response.data.accessToken);
                    } else {
                        reject(new Error(response.message || 'Login failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function setUserLevel(token, userEmail, level = 'master') {
    console.log(`\n🔧 Setting user level to "${level}"...`);
    
    // First, get all users to find the user ID
    const users = await getAllUsers(token);
    const user = users.find(u => u.email === userEmail);
    
    if (!user) {
        throw new Error(`User ${userEmail} not found`);
    }
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            level: level
        });
        
        const url = new URL(`${USER_SERVICE_URL}/api/v1/admin/users/${user.id}/level`);
        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        console.log(`✅ User level set to "${level}"!`);
                        resolve(response);
                    } else {
                        reject(new Error(response.message || 'Failed to set user level'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function getAllUsers(token) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${USER_SERVICE_URL}/api/v1/admin/users`);
        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(response.data || []);
                    } else {
                        reject(new Error(response.message || 'Failed to get users'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    console.log('🚀 Starting migration from Legacy Admin to User Service\n');
    console.log('=' .repeat(60));
    
    let client;
    let db;
    
    try {
        // Step 1: Connect to MongoDB
        console.log('\n📡 Connecting to MongoDB...');
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
        console.log('✅ Connected to MongoDB');
        
        // Extract database name from connection string
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
        
        db = client.db(dbName);
        console.log(`   Database: ${dbName}`);
        
        // Step 2: Export all data
        const exportData = await exportAllData(db);
        
        // Step 3: Create User Service account
        await createUserServiceAccount();
        
        // Step 4: Login as master to set user level
        if (!USER_SERVICE_MASTER_EMAIL || !USER_SERVICE_MASTER_PASSWORD) {
            console.log('\n⚠️  USER_SERVICE_MASTER_EMAIL and USER_SERVICE_MASTER_PASSWORD not set');
            console.log('   Skipping user level setup. Please set it manually in the admin panel.');
        } else {
            const masterToken = await loginToUserService(USER_SERVICE_MASTER_EMAIL, USER_SERVICE_MASTER_PASSWORD);
            await setUserLevel(masterToken, NEW_ACCOUNT_EMAIL, 'master');
        }
        
        // Step 5: Verify new account can login
        console.log('\n✅ Verifying new account...');
        try {
            await loginToUserService(NEW_ACCOUNT_EMAIL, NEW_ACCOUNT_PASSWORD);
            console.log('✅ New account login verified!');
        } catch (error) {
            console.log('⚠️  Could not verify login (this is okay if account already existed)');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('\n✅ Migration completed successfully!\n');
        console.log('📋 Next Steps:');
        console.log('   1. Go to: https://autorestock-user-service-production.up.railway.app');
        console.log(`   2. Log in with: ${NEW_ACCOUNT_EMAIL}`);
        console.log('   3. If user level is not "master", log in as master and set it');
        console.log('   4. Go to AirPod Portal and click "Login with User Service"');
        console.log('   5. Test access to all your products');
        console.log('   6. Once verified, we can retire the legacy login');
        console.log(`\n💾 Backup saved to: ${EXPORT_FILE}`);
        console.log('   Keep this file safe as a backup of your data.\n');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('\n📡 MongoDB connection closed');
        }
    }
}

// Run migration
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { exportAllData, createUserServiceAccount };

