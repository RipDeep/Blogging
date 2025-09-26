const { Router } = require("express");
const Blog = require("../models/blog");
const User = require("../models/user");

const router = Router();

// Profile page
router.get("/", async (req, res) => {
  try {
    // Make sure user is logged in
    if (!req.user) {
      return res.redirect("/login"); // redirect to login if not authenticated
    }

    // Fetch user's posts
    const userPosts = await Blog.find({ createdBy: req.user._id });
    const userDetails = await User.find({ _id: req.user._id });

    console.log("Username is", userDetails);

    console.log("Logged in user:", req.user);

    return res.render("profile", {
      userDetails,
      user: req.user,
      userPosts, // pass user's blogs to template
      totalPosts: userPosts.length, // optional
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    return res.status(500).send("Internal Server Error");
  }
});

router.get("/view/:id", async (req, res) => {
  const userId = req.params.id;
  console.log("User ID to view:", userId);

  // Fetch the user whose profile we want to view
  const userDetails = await User.find({ _id: userId });
  console.log("userDetails:", userDetails);

  if (!userDetails) return res.status(404).send("User not found");

  // Fetch that user's posts
  const userPosts = await Blog.find({ createdBy: userId });

  res.render("profile", {
    userDetails, // the profile being viewed
    user: req.user, // currently logged-in user
    userPosts,
    totalPosts: userPosts.length,
  });
});

// Follow/Unfollow a user
router.post("/follow/:id", async (req, res) => {
  try {
    const targetUserId = req.params.id; // user to follow/unfollow
    const currentUserId = req.user._id; // logged-in user

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).send("You cannot follow yourself.");
    }

    // Fetch the target user to check if exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).send("User not found");

    // Check if already following
    const isFollowing = targetUser.followers
      .map(id => id.toString())
      .includes(currentUserId.toString());

    if (isFollowing) {
      // Unfollow: remove currentUserId from followers
      await User.findByIdAndUpdate(
        targetUserId,
        { $pull: { followers: currentUserId } }
      );
    } else {
      // Follow: add currentUserId to followers if not exists
      await User.findByIdAndUpdate(
        targetUserId,
        { $addToSet: { followers: currentUserId } }
      );
    }

    return res.redirect(`/profile/view/${targetUserId}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});


module.exports = router;
