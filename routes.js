const Database = require('./Database');
const DB = new Database();

module.exports = function(app)
{
	app.get('/', function(HTTPRequest, HTTPResponse)
	{
		HTTPResponse.render('index', {
			ACTION 			: ACTION,
			currentGesture 	: GESTURES[ORDERS[selectedOrder][currentGestureIndex]],
			order 			: ORDERS[selectedOrder],
			recording 		: (dataRecordings.length > 0),
			calibrated		: (calibrationId != null)
		});
	});

	app.get('/analysis', function(HTTPRequest, HTTPResponse)
	{
		DB.find({
			collection : VIBRATION_PATTERN_COLLECTION,
		},
		function(collections)
		{
			HTTPResponse.render('analysis', {
				ACTION 		: ACTION,
				collections : collections,
				GESTURES 	: GESTURES
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