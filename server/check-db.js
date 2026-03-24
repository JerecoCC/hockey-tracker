require('dotenv').config();
const { initSchema, sql } = require('./src/db');

initSchema()
  .then(async () => {
    const rows = await sql`SELECT NOW() AS db_time`;
    console.log('✅ Database connected!  Server time:', rows[0].db_time);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Database connection FAILED:', err.message);
    process.exit(1);
  });

