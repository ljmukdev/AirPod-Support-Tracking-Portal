/**
 * Remove Duplicate Check-in
 *
 * This script removes the duplicate check-in for tracking H05QTA0162066623
 * Specifically targets ID: 69623a51809ea3d5b78fb68f (4 items at 11:38)
 * The one with 3 items checked at 12:19 should be kept.
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;

// Specific ID of the duplicate check-in to delete
const CHECK_IN_ID_TO_DELETE = '69623a51809ea3d5b78fb68f';

async function removeDuplicateCheckIn() {
    console.log('🔍 Removing duplicate check-in\n');
    console.log('='.repeat(60));
    console.log(`Target ID: ${CHECK_IN_ID_TO_DELETE}\n`);

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

        // Find the specific check-in to delete
        const toDelete = await db.collection('check_ins').findOne({
            _id: new ObjectId(CHECK_IN_ID_TO_DELETE)
        });

        if (!toDelete) {
            console.log('❌ Check-in not found. It may have already been deleted.');
            await client.close();
            return;
        }

        const itemCount = toDelete.items ? toDelete.items.length : 0;
        const date = toDelete.checked_in_at ? new Date(toDelete.checked_in_at).toLocaleString() : 'unknown';

        console.log('Found check-in to delete:');
        console.log(`   ID: ${toDelete._id}`);
        console.log(`   Tracking: ${toDelete.tracking_number}`);
        console.log(`   Items: ${itemCount}`);
        console.log(`   Date: ${date}`);
        console.log(`   Split into products: ${toDelete.split_into_products || false}`);
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
