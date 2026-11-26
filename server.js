// CST3144 - Express.js REST API
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

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


// Middleware 2: static files (lesson images)
app.use('/images', express.static(path.join(__dirname, 'images')));
// only reached when express.static did not find the file
app.use('/images', (req, res) => {
  res.status(404).json({ error: `Image not found: ${req.path}` });
});


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


// POST a new order
app.post('/orders', async (req, res) => {
  try {
    const { name, phone, items } = req.body || {};

    if (!name || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(400).json({ error: 'Name must be letters only' });
    }
    if (!phone || !/^[0-9]+$/.test(String(phone))) {
      return res.status(400).json({ error: 'Phone must be numbers only' });
    }
    if (!Array.isArray(items) || items.length === 0 ||
        !items.every((i) => /^[0-9a-fA-F]{24}$/.test(i.lessonId) && Number.isInteger(i.spaces) && i.spaces > 0)) {
      return res.status(400).json({ error: 'items must be a list of { lessonId, spaces }' });
    }

    const order = {
      name: name.trim(),
      phone: String(phone),
      lessonIDs: items.map((i) => i.lessonId),
      items: items.map((i) => ({ lessonId: i.lessonId, spaces: i.spaces })),
      totalSpaces: items.reduce((sum, i) => sum + i.spaces, 0),
      createdAt: new Date()
    };

    const result = await db.collection('order').insertOne(order);
    res.status(201).json({ message: 'Order saved', orderId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save order' });
  }
});



// PUT - update ANY attribute(s) of a lesson (e.g. set space to any number)
app.put('/lessons/:id', async (req, res) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const changes = { ...req.body };
    delete changes._id;                      // never overwrite the id
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const result = await db.collection('lesson').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: changes }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    res.json({ message: 'Lesson updated', modified: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update lesson' });
  }
});



// Challenge: search across topic, location, price and space (done in the back-end)
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json(await db.collection('lesson').find().toArray());
    }
    // escape special characters so the text is treated as plain text, not a pattern
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const textMatch = { $regex: pattern, $options: 'i' };
    const numberMatch = (field) => ({
      $expr: { $regexMatch: { input: { $toString: `$${field}` }, regex: pattern, options: 'i' } }
    });

    const results = await db.collection('lesson').find({
      $or: [
        { topic: textMatch },
        { location: textMatch },
        numberMatch('price'),
        numberMatch('space')
      ]
    }).toArray();
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});


// Challenge: list all teachers
app.get('/teachers', async (req, res) => {
  try {
    res.json(await db.collection('teacher').find().toArray());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load teachers' });
  }
});

// Challenge: all lessons taught by one teacher
app.get('/teachers/:id/lessons', async (req, res) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }
    const teacher = await db.collection('teacher').findOne({ _id: new ObjectId(req.params.id) });
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const lessons = await db.collection('lesson').find({ _id: { $in: teacher.lessonIds } }).toArray();
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load teacher lessons' });
  }
});



// Challenge: enrolment = number of spaces already purchased for a lesson
app.get('/enrolment/:lessonid', async (req, res) => {
  try {
    const id = req.params.lessonid;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }
    const lesson = await db.collection('lesson').findOne({ _id: new ObjectId(id) });
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    const totals = await db.collection('order').aggregate([
      { $unwind: '$items' },
      { $match: { 'items.lessonId': id } },
      { $group: { _id: null, enrolment: { $sum: '$items.spaces' } } }
    ]).toArray();

    res.json({
      lessonId: id,
      topic: lesson.topic,
      location: lesson.location,
      enrolment: totals.length ? totals[0].enrolment : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not calculate enrolment' });
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


