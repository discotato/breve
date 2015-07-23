var restful = require('node-restful');
var mongoose = restful.mongoose;

var chatSchema = new mongoose.Schema({
	user: { type: String, required: true },
	message: {type: String, required: true },
	time: { type: Date, default: Date.now }
});

module.exports = restful.model('Chats', chatSchema);