const { Expo } = require("expo-server-sdk");

let expo = new Expo();

async function sendPushNotification(pushToken, message, title) {
	let messages = [];
	if (!Expo.isExpoPushToken(pushToken)) {
		console.error(`Push token ${pushToken} is not a valid Expo push token`);
		return;
	}

	messages.push({
		to: pushToken,
		title: title || "message",
		sound: "default",
		body: message,
		data: { withSome: "data" },
		android: {
			channelId: "default"
		}
	});

	let chunks = expo.chunkPushNotifications(messages);
	let tickets = [];
	for (let chunk of chunks) {
		try {
			let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
			tickets.push(...ticketChunk);
		} catch (error) {
			console.error(error);
		}
	}
}

module.exports = {
	sendPushNotification
};
