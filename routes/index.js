const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const { server, app, io } = require("../server.js");
const mongodbConfig = require("../config/mongoose.js");

const userModel = require("../models/users.js");
const chatModel = require("../models/chats.js");
const offlineModel = require("../models/offlineMessage.js");

let users = [];

io.on("connection", socket => {
	socket.on("join", async userId => {
		const existingUserIndex = users.findIndex(user => user.userId === userId);
		if (existingUserIndex !== -1) {
			users.splice(existingUserIndex, 1);
		}
		users.push({ id: socket.id, userId });
		
		const offlineMessages = await offlineModel.find({ receiver: userId });
		if (offlineMessages.length > 0) {
			offlineMessages.forEach(async msg => {
				socket.emit("receiveMessage", msg.message);
				await Chat.updateOne(
					{ chatId: msg.chatId, "messages.message": msg.message },
					{ $set: { "messages.$.status": "delivered" } }
				);
			});
			await OfflineMessage.deleteMany({ receiver: userId });
		}
	});

	socket.on("getAllUsers", async ({ page = 1, limit = 10 }) => {
		const pageNumber = parseInt(page, 10) || 1;
		const pageSize = parseInt(limit, 10) || 10;
		try {
			const allUsers = await userModel
				.find({})
				.sort({ timestamp: -1 })
				.skip((pageNumber - 1) * pageSize)
				.limit(pageSize);
			socket.emit("getAllUsersRes", allUsers);
		} catch (err) {
			socket.emit("getAllUsersRes", []);
		}
	});

	socket.on("getUser", async userId => {
		try {
			const user = await userModel.findById(userId);
			socket.emit("getUserRef", user);
		} catch (err) {
			socket.emit("getAllUsersRes", []);
		}
	});

	socket.on("sendMessage", async dets => {
		const { participants, message, chatId } = dets;
		try {
			let chat = await chatModel.findOne({ chatId: chatId });
			if (chat) {
				chat.messages.push({
					sender: participants.sender,
					receiver: participants.receiver,
					message,
					status: "sent"
				});
				await chat.save();
				const receiverSocket = users.find(
					user =>
						user.userId.toString() === participants.receiver.toString()
				);
				console.log(receiverSocket);
				if (receiverSocket) {
					io.to(receiverSocket.id).emit("receiveMessage", message);
					chat.messages[chat.messages.length - 1].status = "delivered";
					await chat.save();
				} else {
					await offlineModel.create({
						sender: participants.sender,
						receiver: participants.receiver,
						message,
						chatId
					});
				}
			} else {
				chat = await chatModel.create({
					chatId,
					participants: {
						user1: participants.sender,
						user2: participants.receiver
					},
					messages: [
						{
							sender: participants.sender,
							receiver: participants.receiver,
							message
						}
					]
				});
			}
		} catch (err) {
			console.error("Error creating chat:", err);
		}
	});

	socket.on("disconnect", () => {
		users = users.filter(user => user.id !== socket.id);
	});
});

app.get("/health", (req, res) => {
	res.status(200).json({ status: "ok" });
});

app.post("/signup", async (req, res) => {
	try {
		let { password, username, email } = req.body;
		let existUser = await userModel.findOne({ username });
		if (existUser) {
			res.status(400).json({
				success: false,
				message: "USERNAME_EXISTS",
				data: { username, email }
			});
			return;
		}
		bcrypt.genSalt(10, (err, salt) => {
			bcrypt.hash(password, salt, async (err, hash) => {
				const user = await userModel.create({
					username,
					password: hash,
					email
				});
				let token = jwt.sign({ username, email }, "WTF", {
					expiresIn: "30d"
				});
				res.cookie("token", token);
				req.user = user;
				res.status(200).json({
					success: true,
					message: "User signed up successfully",
					data: { username, email, token, userId: user._id }
				});
			});
		});
	} catch (err) {
		return res.status(400).json({
			success: false,
			message: err
		});
	}
});

app.post("/signin", async (req, res) => {
	let { password, username } = req.body;
	const user = await userModel.findOne({ username });

	if (!user) {
		return res.status(400).json({
			success: false,
			message: "INVALID_USERNAME"
		});
	}
	bcrypt.compare(password, user.password, (err, result) => {
		if (result) {
			let token = jwt.sign({ email: user.email, username }, "WTF", {
				expiresIn: "30d"
			});
			res.cookie("token", token);
			req.user = user;
			res.status(200).json({
				success: true,
				message: "User signed in successfully.",
				token,
				userId: user._id
			});
		} else {
			return res.status(400).json({
				success: false,
				message: "INVALID_PASSWORD"
			});
		}
	});
});

app.post("/getMassages", async (req, res) => {
	const { userId, oppId } = req.body;
	let messages = await chatModel.find({
		$or: [
			{ sender: userId, receiver: oppId },
			{ sender: oppId, receiver: userId }
		]
	});
	res.status(200).json({
		success: true,
		messages
	});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}.`);
});
