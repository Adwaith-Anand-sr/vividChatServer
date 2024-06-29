const mongoose = require("mongoose");
const chatSchema = mongoose.Schema({
	sender: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
	receiver: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
	message: String,
	timestamp: { type: Date, default: Date.now },
	isrecieved: { type: Boolean, default: false },
	isreaded: { type: Boolean, default: false },
});

module.exports = mongoose.model("chat", chatSchema);
