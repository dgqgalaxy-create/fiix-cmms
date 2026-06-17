const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const users = await client.query('SELECT count(*) FROM "User"');
  const workOrders = await client.query('SELECT count(*) FROM "WorkOrder"');
  const zones = await client.query('SELECT count(*) FROM "Zone"');
  const assets = await client.query('SELECT count(*) FROM "Asset"');
  
  console.log(`Users: ${users.rows[0].count}`);
  console.log(`Work Orders: ${workOrders.rows[0].count}`);
  console.log(`Zones: ${zones.rows[0].count}`);
  console.log(`Assets: ${assets.rows[0].count}`);
  
  if (parseInt(workOrders.rows[0].count) > 0) {
    const latestWO = await client.query('SELECT * FROM "WorkOrder" ORDER BY created_at DESC LIMIT 1');
    console.log('Latest WO:', latestWO.rows[0]);
  }
}

main().catch(console.error).finally(() => client.end());
