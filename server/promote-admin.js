require('dotenv').config();
const { sql } = require('./src/db');

async function main() {
  // Delete the placeholder admin
  await sql`DELETE FROM users WHERE email = 'admin@example.com'`;
  console.log('🗑️  Deleted admin@example.com');

  // Promote the existing user
  const rows = await sql`
    UPDATE users SET role = 'admin'
    WHERE id = 'ff3d8626-c918-4e17-91db-fb7f8521bb5b'
    RETURNING id, display_name, email, role
  `;

  if (rows.length === 0) {
    console.error('❌ User not found.');
    process.exit(1);
  }

  console.log('\n✅ Promoted to admin:\n');
  console.table(rows);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

