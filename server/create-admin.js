/**
 * Usage:
 *   node create-admin.js <name> <email> <password>
 *
 * Example:
 *   node create-admin.js "Admin User" admin@example.com secret123
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initSchema, sql } = require('./src/db');

async function main() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error('Usage: node create-admin.js <name> <email> <password>');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  await initSchema();

  const existing = await sql`SELECT id, role FROM users WHERE email = ${email}`;

  if (existing.length > 0) {
    // User exists — just promote to admin
    await sql`UPDATE users SET role = 'admin' WHERE email = ${email}`;
    console.log(`✅ Existing user "${email}" promoted to admin.`);
    return;
  }

  // Create brand-new admin user
  const hash = await bcrypt.hash(password, 12);
  const rows = await sql`
    INSERT INTO users (display_name, email, password, role)
    VALUES (${name}, ${email}, ${hash}, 'admin')
    RETURNING id, display_name, email, role, created_at
  `;

  const user = rows[0];
  console.log('\n✅ Admin user created:\n');
  console.table([user]);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

