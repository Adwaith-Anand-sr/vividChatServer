const mongoose = require('mongoose')
const userSchema = mongoose.Schema({
   username: String,
   fullname: String,
   password: String,
   email: String,
   groups: [{type: String}],
   chats: [{type: String}],
   recent: [{type: mongoose.Schema.Types.ObjectId, ref: 'user'}],
})

module.exports = mongoose.model('user', userSchema)