const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const { server, app, io } = require("../server.js");
const mongodbConfig = require("../config/mongoose.js");
//const redisClient = require("../config/redis.js");
const userModel = require("../models/users.js");
const chatModel = require("../models/chats.js");
const offlineModel = require("../models/offlineMessage.js");
const {
	sendPushNotification
} = require("../controller/sendPushNotification.js");

const { Expo } = require("expo-server-sdk");
const expo = new Expo();

let users = [];

io.on("connection", socket => {
	socket.on("join", async userId => {
		const existingUserIndex = users.findIndex(user => user.userId === userId);
		if (existingUserIndex !== -1) {
			users.splice(existingUserIndex, 1);
		}
		users.push({ id: socket.id, userId });
		io.emit("userOfflineStatusUpdate", userId);
		const offlineMessages = await offlineModel.find({ receiver: userId });
		if (offlineMessages.length > 0) {
			offlineMessages.forEach(async msg => {
				socket.emit("receiveMessage", msg.message);
				await chatModel.updateOne(
					{ chatId: msg.chatId, "messages.message": msg.message },
					{ $set: { "messages.$.status": "delivered" } }
				);
			});
			await offlineModel.deleteMany({ receiver: userId });
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

	socket.on("getUserChatList", async ( userId ) => {
		const pageNumber = parseInt(page, 10) || 1;
		const pageSize = parseInt(limit, 10) || 10;
		try {
			const chats = await chatModel
				.find({
					$or: [
						{ "participants.user1": userId },
						{ "participants.user2": userId }
					]
				})
				.populate("participants.user1")
				.populate("participants.user2")
				.select({
					messages: { $slice: -1 }
				})
				.sort({ "messages.timestamp": -1 })
				.exec();

			socket.emit("getUserChatListRes", chats);
		} catch (err) {
			console.log(err);
			socket.emit("getUserChatListRes", []);
		}
	});

	socket.on("getUser", async userId => {
		try {
			const user = await userModel.findById(userId);
			socket.emit("getUserRes", user);
		} catch (err) {
			socket.emit("getUserRes", []);
		}
	});

	socket.on("getChatMessages", async ({ chatId, page, limit }) => {
		try {
			const chat = await chatModel.findOne({ chatId });
			if (!chat) {
				return socket.emit("getChatMessagesResponse", []);
			}
			const totalMessages = chat.messages.length;
			const startIndex = Math.max(totalMessages - page * limit, 0);
			const endIndex = totalMessages - (page - 1) * limit;
			const limitedMessages = chat.messages.slice(startIndex, endIndex);
			return socket.emit("getChatMessagesResponse", limitedMessages);
		} catch (error) {
			console.error("Error fetching chat messages:", error);
			socket.emit("getChatMessagesResponse", []);
		}
	});

   socket.on('readMesaages', async chatId =>{
      
   })

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
				const receiver = await userModel.findById(participants.receiver);
				const sender = await userModel.findById(participants.sender);
				await sendPushNotification(
					receiver.pushToken,
					message,
					sender.username
				);
				if (receiverSocket) {
					socket.emit("sendMessageRes", message);
					io.to(receiverSocket.id).emit(
						"receiveMessage",
						chat.messages[chat.messages.length - 1]
					);
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

	socket.on("checkOnlineStatus", id => {
		const user = users.find(user => user.userId.toString() === id.toString());
		if (user) socket.emit("checkOnlineStatusRes", true);
		else socket.emit("checkOnlineStatusRes", false);
	});

	socket.on("typing", async ({ userId, chatPartnerId }) => {
		try {
			const receiverSocket = users.find(
				user => user.userId.toString() === chatPartnerId.toString()
			);
			console.log("userId", userId);
			console.log("chatPartnerId", chatPartnerId);
			console.log("receiverSocket", receiverSocket);
			if (receiverSocket) {
				io.to(receiverSocket.id).emit("typing", chatPartnerId);
			}
		} catch (err) {
			console.error("Error fetching typing status:", err);
		}
	});

	socket.on("typingStoped", async ({ userId, chatPartnerId }) => {
		try {
			const receiverSocket = users.find(
				user => user.userId.toString() === chatPartnerId.toString()
			);
			if (receiverSocket) {
				io.to(receiverSocket.id).emit("typingStoped", chatPartnerId);
			}
		} catch (err) {
			console.error("Error fetching typing status:", err);
		}
	});

	socket.on("disconnect", () => {
		user = users.find(user => user.id === socket.id);
		if (user && user.userId) io.emit("userOfflineStatusUpdate", user.userId);
		users = users.filter(user => user.id !== socket.id);
	});
});

app.get("/health", (req, res) => {
	res.status(200).json({ status: "ok" });
});

app.post("/register-push-token", (req, res) => {
	try {
		const { userId, pushToken } = req.body;
		userModel
			.findByIdAndUpdate(userId, { pushToken }, { new: true })
			.then(updatedUser => {
				if (updatedUser) {
					res.sendStatus(200);
				} else {
					res.sendStatus(404);
				}
			})
			.catch(error => {
				console.error("Error updating pushToken:", error);
				res.sendStatus(500);
			});
	} catch (err) {
		console.log(err);
		res.sendStatus(500);
	}
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}.`);
});
