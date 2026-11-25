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