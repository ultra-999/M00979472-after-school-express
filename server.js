// CST3144 - Express.js REST API
const express = require('express');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;   // never hard-code this
const DB_NAME = process.env.DB_NAME || 'afterschool';

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is missing.');
  process.exit(1);
}

const app = express();
let db;

//Middleware 1: logger (prints every request to console)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ` +
      `${Date.now() - start}ms from ${req.ip}`
    );
  });
  next();
});

//CORS (front-end on GitHub Pages calls this server on render.com)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Parse JSON request bodies into req.body
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'After School API is running' });
});


// GET all lessons
app.get('/lessons', async (req, res) => {
  try {
    const lessons = await db.collection('lesson').find().toArray();
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load lessons' });
  }
});


// Connect to Atlas, then start the server
const client = new MongoClient(MONGODB_URI);
client.connect()
  .then(() => {
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB Atlas, database:', DB_NAME);
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB Atlas:', err.message);
    process.exit(1);
  });


