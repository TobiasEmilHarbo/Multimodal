const Database = require('./Database');
const DB = new Database();

module.exports = function(app)
{
	app.get('/', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('index', {
			ACTION 			: ACTION,
			currentGesture 	: GESTURES[ORDERS[selectedOrder][currentGestureIndex]],
			order 			: ORDERS[selectedOrder]
		});
	});

	app.get('/analysis', function(HTTPRequest, HTTPResponse)
	{
		DB.find({
			collection : VIBRATION_PATTERN_COLLECTION
		}, function(patterns)
		{
			HTTPResponse.render('analysis', {
				patterns : patterns,
			});
		});
	});

	app.get('/calibrate', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('calibration', {
			ACTION : ACTION,
		});
	});

	app.get('/setup', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('setup', {
			orders : ORDERS,
			selectedOrder : selectedOrder
		});
	});

	app.get('/thanks', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('thanks');
	});
};