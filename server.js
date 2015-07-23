var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

mongoose.connect('mongodb://localhost/breve');

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'jade');
app.set('views', './views');

app.use('/breve', require('./routes/api'));

app.get('/breve', function(req, res){
	res.render('home');
});

//app.get('/', function(req, res){
//	res.send('working');
//});

app.listen(3000);
console.log('API is running on port 3000');