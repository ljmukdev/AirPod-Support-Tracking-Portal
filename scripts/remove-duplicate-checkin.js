/**
 * Remove Duplicate Check-in
 *
 * This script removes the duplicate check-in for tracking H05QTA0162066623
 * The one with 4 items checked at 11:38 on 10 Jan 2026 should be removed.
 * The one with 3 items checked at 12:19 should be kept.
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

async function removeDuplicateCheckIn() {
    console.log('🔍 Finding and removing duplicate check-in\n');
    console.log('='.repeat(60));

    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI environment variable is required');
        console.log('\nUsage: MONGODB_URI="your-connection-string" node scripts/remove-duplicate-checkin.js');
        process.exit(1);
    }

    let client;
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db('ARSDB');

        // Find all check-ins for this tracking number
        const trackingNumber = 'H05QTA0162066623';
        const checkIns = await db.collection('check_ins')
            .find({ tracking_number: trackingNumber })
            .sort({ checked_in_at: -1 })
            .toArray();

        console.log(`Found ${checkIns.length} check-ins for tracking ${trackingNumber}:\n`);

        checkIns.forEach((checkIn, index) => {
            const itemCount = checkIn.items ? checkIn.items.length : 0;
            const date = checkIn.checked_in_at ? new Date(checkIn.checked_in_at).toLocaleString() : 'unknown';
            console.log(`${index + 1}. ID: ${checkIn._id}`);
            console.log(`   Items: ${itemCount}`);
            console.log(`   Date: ${date}`);
            console.log(`   Split into products: ${checkIn.split_into_products || false}`);
            console.log('');
        });

        // Find the one to delete: 4 items, around 11:38 on 10 Jan 2026
        // We'll identify it by the item count of 4
        const toDelete = checkIns.find(c => {
            const itemCount = c.items ? c.items.length : 0;
            return itemCount === 4;
        });

        if (!toDelete) {
            console.log('❌ Could not find the check-in with 4 items to delete.');
            console.log('   The duplicate may have already been removed.');
            await client.close();
            return;
        }

        console.log('='.repeat(60));
        console.log('🗑️  Will delete check-in:');
        console.log(`   ID: ${toDelete._id}`);
        console.log(`   Items: ${toDelete.items ? toDelete.items.length : 0}`);
        console.log(`   Date: ${new Date(toDelete.checked_in_at).toLocaleString()}`);
        console.log('');

        // Check for related tasks that need to be cleaned up
        const relatedTasks = await db.collection('tasks')
            .find({ check_in_id: toDelete._id.toString() })
            .toArray();

        if (relatedTasks.length > 0) {
            console.log(`📋 Found ${relatedTasks.length} related task(s) to clean up:`);
            relatedTasks.forEach(task => {
                console.log(`   - ${task.type || task.title || 'Unknown task'}`);
            });
            console.log('');
        }

        // Delete the check-in
        const deleteResult = await db.collection('check_ins').deleteOne({ _id: toDelete._id });

        if (deleteResult.deletedCount === 1) {
            console.log('✅ Successfully deleted the duplicate check-in!');

            // Also delete any related tasks (like the split task)
            if (relatedTasks.length > 0) {
                const taskDeleteResult = await db.collection('tasks').deleteMany({
                    check_in_id: toDelete._id.toString()
                });
                console.log(`✅ Deleted ${taskDeleteResult.deletedCount} related task(s)`);
            }
        } else {
            console.log('❌ Failed to delete the check-in');
        }

        // Verify remaining check-ins
        const remaining = await db.collection('check_ins')
            .find({ tracking_number: trackingNumber })
            .toArray();

        console.log(`\n📊 Remaining check-ins for ${trackingNumber}: ${remaining.length}`);
        remaining.forEach((checkIn, index) => {
            const itemCount = checkIn.items ? checkIn.items.length : 0;
            const date = checkIn.checked_in_at ? new Date(checkIn.checked_in_at).toLocaleString() : 'unknown';
            console.log(`   ${index + 1}. ${itemCount} items - ${date}`);
        });

        await client.close();
        console.log('\n✅ Done!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (client) {
            await client.close();
        }
        process.exit(1);
    }
}

if (require.main === module) {
    removeDuplicateCheckIn().catch(console.error);
}

module.exports = { removeDuplicateCheckIn };
