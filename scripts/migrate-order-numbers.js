/**
 * Migrate Order Numbers - Move sales orders to correct field
 * 
 * This script moves order numbers from ebay_order_number to sales_order_number
 * for all products EXCEPT those with the purchase order "15-14031-74596"
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGOUSER = process.env.MONGOUSER || 'postgres';
const MONGOPASSWORD = process.env.MONGOPASSWORD || '';
const MONGOHOST = process.env.MONGOHOST || 'localhost:27017';
const MONGODATABASE = process.env.MONGODATABASE || 'ARSDB';

const authSource = 'admin';
const MONGODB_URI = `mongodb://${MONGOUSER}:${MONGOPASSWORD}@${MONGOHOST}/${MONGODATABASE}?authSource=${authSource}`;

console.log('🔧 Order Number Migration Script');
console.log('================================\n');

async function migrateOrderNumbers() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');
        
        const db = client.db(MONGODATABASE);
        const products = db.collection('products');
        
        // Find all products with ebay_order_number that is NOT the purchase order
        const productsToMigrate = await products.find({
            ebay_order_number: { 
                $exists: true, 
                $ne: null,
                $ne: '15-14031-74596' // Exclude the actual purchase order
            }
        }).toArray();
        
        console.log(`📊 Found ${productsToMigrate.length} products to migrate\n`);
        
        if (productsToMigrate.length === 0) {
            console.log('✅ No products need migration');
            return;
        }
        
        // Show preview of what will be migrated
        console.log('Preview of migrations:');
        console.log('----------------------');
        productsToMigrate.slice(0, 10).forEach((product, index) => {
            console.log(`${index + 1}. ${product.serial_number || 'N/A'}`);
            console.log(`   Current: ebay_order_number = "${product.ebay_order_number}"`);
            console.log(`   Will become: sales_order_number = "${product.ebay_order_number}"`);
            console.log(`   Will become: ebay_order_number = null\n`);
        });
        
        if (productsToMigrate.length > 10) {
            console.log(`... and ${productsToMigrate.length - 10} more\n`);
        }
        
        // Confirm before proceeding
        console.log('⚠️  This will update the database. Press Ctrl+C to cancel.\n');
        console.log('Starting migration in 3 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Perform migration
        let successCount = 0;
        let errorCount = 0;
        
        for (const product of productsToMigrate) {
            try {
                await products.updateOne(
                    { _id: product._id },
                    {
                        $set: {
                            sales_order_number: product.ebay_order_number,
                            ebay_order_number: null
                        }
                    }
                );
                successCount++;
                
                if (successCount % 10 === 0) {
                    console.log(`✅ Migrated ${successCount}/${productsToMigrate.length} products...`);
                }
            } catch (error) {
                console.error(`❌ Error migrating product ${product._id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n================================');
        console.log('Migration Complete!');
        console.log('================================');
        console.log(`✅ Successfully migrated: ${successCount}`);
        if (errorCount > 0) {
            console.log(`❌ Errors: ${errorCount}`);
        }
        
        // Verify results
        const purchaseOrderCount = await products.countDocuments({ 
            ebay_order_number: '15-14031-74596' 
        });
        const salesOrderCount = await products.countDocuments({ 
            sales_order_number: { $exists: true, $ne: null } 
        });
        const noPurchaseOrderCount = await products.countDocuments({ 
            $or: [
                { ebay_order_number: null },
                { ebay_order_number: { $exists: false } }
            ],
            sales_order_number: { $exists: true, $ne: null }
        });
        
        console.log('\n📊 Final Statistics:');
        console.log(`   Products with purchase order "15-14031-74596": ${purchaseOrderCount}`);
        console.log(`   Products with sales orders: ${salesOrderCount}`);
        console.log(`   Products with sales order but no purchase order: ${noPurchaseOrderCount}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n✅ Connection closed');
    }
}

// Run migration
migrateOrderNumbers()
    .then(() => {
        console.log('\n✅ Migration script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration script failed:', error);
        process.exit(1);
    });
