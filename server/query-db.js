require('dotenv').config();
const { sql } = require('./src/db');

async function main() {
  const users = await sql`
    SELECT id, display_name, email, google_id IS NOT NULL AS is_google, created_at
    FROM users
    ORDER BY created_at DESC
  `;

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`\n=== Users (${users.length}) ===\n`);
  console.table(users);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});

