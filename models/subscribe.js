var mongoose = require('mongoose');

//supports one remote user for now
var subscribeSchema = new mongoose.Schema({
	user: { type: String, required: true },
	resource: { type: String, required: false },
	created: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SubscribeUser', subscribeSchema);