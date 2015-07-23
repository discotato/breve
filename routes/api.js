//dependencies
var express = require('express');
var router = express.Router();

var Chat = require('../models/chat');

Chat.methods(['get', 'put', 'post', 'delete']);
Chat.register(router, '/chats');

//router.get('/chats', function(req, res){
//	res.send('api is working');
//});

module.exports = router;