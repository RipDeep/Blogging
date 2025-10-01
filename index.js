require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const fileuplod = require("express-fileupload");

const Blog = require("./models/blog");
const Notification = require("./models/notifications");
const User = require("./models/user");      


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
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;  // make currentUser global
  next();
});

app.use(express.static(path.resolve("./public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(
  fileuplod({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.use(async (req, res, next) => {
  if (req.user) {
    try {
      // fetch notifications for logged in user
      const notifications = await Notification.find({ user: req.user._id })
        .populate("sender blog")
        .sort({ createdAt: -1 })
        .lean();

      const unreadCount = notifications.filter(n => !n.read).length;

      // store globally
      res.locals.user = req.user;              // current logged-in user
      res.locals.notifications = notifications; // notifications list
      res.locals.unreadCount = unreadCount;     // unread badge count
    } catch (err) {
      console.error("Error fetching notifications:", err);
      res.locals.notifications = [];
      res.locals.unreadCount = 0;
    }
  } else {
    res.locals.user = null;
    res.locals.notifications = [];
    res.locals.unreadCount = 0;
  }
  next();
});

app.get("/", async (req, res) => {
  const allBlog = await Blog.find({});

  let notifications = [];
  let unreadCount = 0;
  

  if (req.user) {
      // Fetch notifications for the logged-in user
      notifications = await Notification.find({ user: req.user._id })
        .populate("sender blog")
        .sort({ createdAt: -1 })
        .lean();

      unreadCount = notifications.filter(n => !n.read).length;
    }
  res.render("home", {
    user: req.user,
    blogs: allBlog,
    notifications,
    unreadCount
  });
});

app.use("/user", userRoute);
app.use("/blog", blogRoute);
app.use("/profile", profileRoute);

app.listen(PORT, () => {
  console.log("Server started at ", PORT);
});
