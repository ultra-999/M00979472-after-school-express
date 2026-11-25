// CST3144 - Express.js REST API
const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();

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

app.get('/', (req, res) => {
  res.json({ message: 'After School API is running' });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));


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