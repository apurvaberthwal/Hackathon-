import bodyParser from 'body-parser';
import flash from "connect-flash"; // For displaying flash messages
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from 'dotenv'; //environment variable
import express from 'express'; // Web framework
import session from "express-session";


config();
const app = express();
app.use(cors());
app.use(cookieParser())
// Define the port number
const PORT = 8800

app.use(express.static('public'));
app.use(express.static('uploads'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Set the view engine to use EJS
app.set('view engine', 'ejs');
app.set('views', './views');
// Set up session middleware
app.use(session({
  secret: 'PixelPioneers',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week in milliseconds
}));
app.use(flash());

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: {
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
        },
    });
});



app.get("/", async function (req, res) {
  

  res.render("index.ejs");
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
