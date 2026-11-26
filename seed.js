// Usage:  MONGODB_URI="mongodb+srv://..." node seed.js
const fs = require('fs');
const path = require('path');
const { MongoClient, BSON } = require('mongodb');
const { EJSON } = BSON;

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('Set MONGODB_URI first'); process.exit(1); }

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'afterschool');
  for (const name of ['lesson', 'teacher', 'order']) {
    const docs = EJSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${name}.json`), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`${name}: ${docs.length} documents loaded`);
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });