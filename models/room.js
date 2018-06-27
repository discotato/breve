var mongoose = require('mongoose');

//Keeps track of the live rooms. The room name is the first remote user to be selected in a conversation.
var roomSchema = new mongoose.Schema({
	createdByUser: { type: String, required: false },
	name: { type: String, required: false },
	created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', roomSchema);