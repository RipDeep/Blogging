const { Router } = require("express");
const Blog = require("../models/blog");
const User = require("../models/user");
const cloudinary = require("cloudinary").v2;

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
 
  // Fetch the user whose profile we want to view
  const userDetails = await User.find({ _id: userId });

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

router.post("/update", async (req, res) => {
  try {
    const userId = req.user._id; // logged in user

    let updateData = {
      fullName: req.body.username, // from your form
    };

    // If a new profile image is uploaded
    if (req.files && req.files.profileImage) {
      const file = req.files.profileImage;

      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "profile_uploads",
      });

      updateData.profileImageURL = result.secure_url;
    }

    // Update user in DB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    // Redirect back to profile page
    return res.redirect(`/profile/view/${userId}`);
  } catch (err) {
    console.error("Error in /profile/update:", err);
    res.status(500).send("Internal Server Error");
  }
});





module.exports = router;
