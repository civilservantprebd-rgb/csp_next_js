const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:260826Trs%40%40260826@db.braytjbujysjydxbuqhv.supabase.co:5432/postgres" });
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type, character_maximum_length, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);
  let schema = {};
  for (const row of res.rows) {
    if (!schema[row.table_name]) schema[row.table_name] = [];
    schema[row.table_name].push(row);
  }
  console.log(JSON.stringify(schema, null, 2));
  await client.end();
}
run().catch(console.error);
