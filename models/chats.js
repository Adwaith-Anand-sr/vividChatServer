const mongoose = require("mongoose");
const chatSchema = mongoose.Schema({
	chatId: String,
	participants: {
		user1: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
		user2: { type: mongoose.Schema.Types.ObjectId, ref: "user" }
	},
	messages: [
		{
			sender: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
			receiver: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
			message: String,
			status: {
				type: String,
				enum: ["sent", "delivered", "read"],
				default: "sent"
			},
			timestamp: { type: Date, default: Date.now }
		}
	]
});

module.exports = mongoose.model("chat", chatSchema);
