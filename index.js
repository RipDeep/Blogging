require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const fileuplod = require("express-fileupload");

const Blog = require("./models/blog");

const userRoute = require("./routes/user");
const blogRoute = require("./routes/blog");
const profileRoute = require("./routes/profile");

const {
  checkForAuthenticationCookie,
} = require("./middlewares/authentication");

const app = express();
const PORT = process.env.PORT || 8000;

mongoose
  .connect(process.env.MONGO_URL)
  .then((e) => {
    console.log("MongoDB is connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1); // fails fast, visible in logs
  });

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(checkForAuthenticationCookie("token"));
// app.use((req, res, next) => {
//   res.locals.user = req.user; // now home page and navbar can access user
//   next();
// });
app.use(express.static(path.resolve("./public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(
  fileuplod({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.get("/", async (req, res) => {
  const allBlog = await Blog.find({});
  res.render("home", {
    user: req.user,
    blogs: allBlog,
  });
});

app.use("/user", userRoute);
app.use("/blog", blogRoute);
app.use("/profile", profileRoute);

app.listen(PORT, () => {
  console.log("Server started at ", PORT);
});
