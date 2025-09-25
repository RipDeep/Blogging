const { Schema, model } = require("mongoose");

const likeSchema = new Schema({
  blogId: {
    type: Schema.Types.ObjectId,
    ref: "blog",
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
}, {timestamps: true});

const Like = model("like", likeSchema);

module.exports = Like;
