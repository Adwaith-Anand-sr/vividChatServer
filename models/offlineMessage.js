const mongoose = require("mongoose");
const offlineMessageSchema = mongoose.Schema({
	sender: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
	receiver: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
	message: String,
	chatId: String,
	timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("OfflineMessage", offlineMessageSchema);
