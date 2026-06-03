import express from "express";
import session from "express-session";
import path from "path";
import staticRoute from "./routes/staticRouter.js";
import apiRoute from "./routes/apiRouter.js";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

app.use("/", staticRoute);
app.use("/api", apiRoute);

app.use((req, res) => {
  res.status(404).render("pages/error", { status: 404, message: "Page Not Found" });
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
