const express = require('express');
const path = require('path');
const database = require('./config/database');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to the database
//database();

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Set up routes
routes(app);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});