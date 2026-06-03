import express from "express";
import cors from "cors";
import session from "express-session"; 

import staticRoute from "./routes/staticRouter.js";
import apiRoute from "./routes/apiRouter.js";
import path from 'path';


const app = express();
app.use(cors());
app.use(express.json());


app.set("view engine", "ejs");
app.set("views", path.resolve("./views"))
app.use(express.urlencoded({extended: false}));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || "keyboard cat",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour for interview sessions
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});


app.use('/', staticRoute);
app.use('/api', apiRoute);

app.use((req, res, next) => {
  res.status(404).render("pages/error", {status:404, message:"Page Not Found"})
})

app.listen(3001, () =>
  console.log("Server running on http://localhost:3001")
);
