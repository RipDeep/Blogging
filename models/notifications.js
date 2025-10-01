const { Schema, model } = require("mongoose");

const notificationSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: "user",
  }, 
  type: {
    type: String,
    enum: ["like", "comment", "follow", "post"],
    required: true,
  },
  blog: {
    type: Schema.Types.ObjectId,
    ref: "blog",
  }, 
  message: String,
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = model("notification", notificationSchema);

module.exports = Notification;
