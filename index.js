const app = require('express')();
const shortid = require('shortid');
const Database = require('./Database');
const Datastore = require('nedb');
const jsonReader = require('jsonfile');

global.VIBRATION_PATTERN_COLLECTION = 'vibration_patterns';
global.DB = new Datastore({ filename: './datastore/db.js', autoload: true });

require('console.table');
const fs = require('fs');

const DTW = require('dtw');

app.set('view engine', 'pug');

var SerialPort = require('serialport');

const http = require('http').Server(app);

const USBPort = process.argv[2] || 'COM12';
const port = process.argv[3] || '8000'

const io = require('socket.io')(http);

require('./routes')(app);

const sp = new SerialPort(USBPort, {
	baudRate: 9600,
	autoOpen: false
});

sp.open(function (err)
{
	if (err)
	{
		console.log('Error connecting to device: ', err.message);
	}
});

const Readline = SerialPort.parsers.Readline;
const parser = sp.pipe(new Readline({ delimiter: '\r\n' }));

global.ACTION = {
	RESET 				: '0',
	RECORD 				: '1',
	STOP_RECORDING 		: '2',
	PLAYBACK 			: '3',
	STOP_PLAYBACK 		: '4',
	SUBMIT 				: '5',
	CALIBRATE 			: '6',
	STOP_CALIBRATION	: '7',
	NEXT_GESTURE 		: '8',
	SET_ORDER 			: '9',
	DONE				: '10',
	CREATE_DATA_FILES	: '11',
	ANALYTIC_PLAYBACK	: '12',
	GENERATE_DTW_TABLE	: '13',
	DISPLAY_DTW_TABLE 	: '14'
};

global.GESTURES = [
	{id : 'cGCFyLX7cLo', alias : 'beckoning'},
	{id : 'yjX5V7oiPhk', alias : 'highlighting'},
	{id : 'nMceTIUaZzU', alias : 'reverse'}
];

global.ORDERS = [
	[0, 1, 2],
	[0, 2, 1],
	[1, 0, 2],
	[1, 2, 0],
	[2, 0, 1],
	[2, 1, 0],
];

const orderDelim = ' - ';
const timePeriod = 80;

global.selectedOrder = 0;
var orderIndexAdaptor = ORDERS[selectedOrder];

global.currentGestureIndex = 0;

global.dataRecordings = [];
global.calibrationId = null;

var playbackInterval;

http.listen(port, () =>
{
	console.log('Server is up and running. Go to http://localhost:' + port + '/');
});

parser.on('data', (response) =>
{
	let res = JSON.parse(response);
	dataRecordings.push(res.data);

	console.log(res.data);
});

io.on('connection', (socket) =>
{
	socket.on(ACTION.RECORD, () =>
	{
		dataRecordings.length = 0; //reset

		let request = createRequest({
				action : ACTION.RECORD,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.STOP_RECORDING, () =>
	{
		let request = createRequest({
				action : ACTION.STOP_RECORDING,
		});

		sendDataToArduino(request);

		trimDataRecording();

		console.log(dataRecordings);
	});

	socket.on(ACTION.PLAYBACK, (data) =>
	{
		io.emit(ACTION.STOP_RECORDING);

		playback(dataRecordings);
	});

	socket.on(ACTION.STOP_PLAYBACK, (data) =>
	{
		clearInterval(playbackInterval);

		let request = createRequest({
				action : ACTION.STOP_PLAYBACK,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.CALIBRATE, (data) =>
	{
		let request = createRequest({
				action : ACTION.CALIBRATE,
		});

		sendDataToArduino(request);
	});

	socket.on(ACTION.STOP_CALIBRATION, (data) =>
	{
		let request = createRequest({
				action : ACTION.STOP_CALIBRATION,
		});

		dataRecordings.length = 0; //reset
		calibrationId = shortid.generate();

		console.log('Calibration ID: '+ calibrationId);

		sendDataToArduino(request);
	});

	socket.on(ACTION.SUBMIT, (data) =>
	{
		if(dataRecordings.length < 1) return;

		var doc = [{
			gesture_id 		: GESTURES[ORDERS[selectedOrder][currentGestureIndex]].id,
			order 			: ORDERS[selectedOrder],
			calibration_id 	: calibrationId,
			period 			: timePeriod,
			amplitudes 		: dataRecordings,
			collection 		: VIBRATION_PATTERN_COLLECTION
		}];

		DB.insert(doc, function(err, doc)
		{
			console.log(doc);

			currentGestureIndex++;

			if(!GESTURES[ORDERS[selectedOrder][currentGestureIndex]])
			{
				reset();
				io.emit(ACTION.DONE);
				return;
			}

			io.emit(ACTION.NEXT_GESTURE, {
				gesture : GESTURES[ORDERS[selectedOrder][currentGestureIndex]].id
			});
		});
	});

	socket.on(ACTION.SET_ORDER, (data) =>
	{
		selectedOrder = data.order;
		orderIndexAdaptor = ORDERS[selectedOrder];
	});

	socket.on(ACTION.RESET, (data) =>
	{
		reset();
	});

	socket.on(ACTION.CREATE_DATA_FILES, (data) =>
	{
		createFiles(0);
	});

	socket.on(ACTION.ANALYTIC_PLAYBACK, (data) =>
	{
		playback(data.recording);
	});

	socket.on(ACTION.GENERATE_DTW_TABLE, (data) =>
	{
		var file = 'data/dtw/' + data.gesture + '.json';

		var header = [];
		var paths = [];
		var table = [];

		jsonReader.readFile(file, function(err, amplitudes)
		{
			for (gesture in amplitudes)
			{
				header.push(gesture);
				table.push(amplitudes[gesture]);
			}

			io.emit(ACTION.DISPLAY_DTW_TABLE, {
				header : header,
				table : table,
				paths : paths
			});
		});

		// var dtw = new DTW({
			// distanceMetric: 'manhattan',
            // distanceFunction: function (x, y) { return x + y; }
		// });

		// var header = ['rJ6QhWmlG', 'BJdHbjzef', 'SkWJSeQlf', 'Hyw5N1mgM', 'By7oz84xG', 'rJ8BPeQxG', 'B1DA5bQez', 'HktHigXgM', 'SJlJLiMlz', 'HJuXr3Mlz', 'Skx5Zl7gM', 'Hy0Q7lXgz', 'r1WEkhzgz', 'r1WoJxmgG', 'BJpmFx7xG', 'HJ5nUZQxz', 'HJT8c1mgM', 'SySxTyXgz'];
		
		//Raw
		// var table = [
		// 			[0,1240,939,1438,1149,907,1358,1627,1475,763,783,1407,690,956,851,629,1176,1083],
		// 			[1240,0,497,634,1009,285,946,1603,1795,778,894,1289,997,913,1274,1066,1236,978],
		// 			[939,497,0,356,1206,307,715,2007,1759,1126,1263,1426,1354,865,1406,1144,708,867],
		// 			[1438,634,356,0,1406,430,413,1749,1851,1078,1015,1721,1393,979,1642,1463,931,1118],
		// 			[1149,1009,1206,1406,0,824,1022,1062,767,385,761,1526,784,1690,976,1075,2007,1877],
		// 			[907,285,307,430,824,0,602,1504,1394,483,493,1411,468,313,652,434,767,941],
		// 			[1358,946,715,413,1022,602,0,1148,1273,768,651,848,936,747,882,794,548,1061],
		// 			[1627,1603,2007,1749,1062,1504,1148,0,1147,983,982,979,1056,1328,1015,1086,1483,1325],
		// 			[1475,1795,1759,1851,767,1394,1273,1147,0,1029,1132,1112,964,1542,571,925,1681,1796],
		// 			[763,778,1126,1078,385,483,768,983,1029,0,216,665,261,660,354,216,882,711],
		// 			[783,894,1263,1015,761,493,651,982,1132,216,0,493,382,433,410,227,719,436],
		// 			[1407,1289,1426,1721,1526,1411,848,979,1112,665,493,0,915,949,476,640,849,733],
		// 			[690,997,1354,1393,784,468,936,1056,964,261,382,915,0,528,325,129,739,700],
		// 			[956,913,865,979,1690,313,747,1328,1542,660,433,949,528,0,635,459,460,281],
		// 			[851,1274,1406,1642,976,652,882,1015,571,354,410,476,325,635,0,315,836,704],
		// 			[629,1066,1144,1463,1075,434,794,1086,925,216,227,640,129,459,315,0,613,477],
		// 			[1176,1236,708,931,2007,767,548,1483,1681,882,719,849,739,460,836,613,0,413],
		// 			[1083,978,867,1118,1877,941,1061,1325,1796,711,436,733,700,281,704,477,413,0]
				// ];

		//Normalized
		// table = [
		// 			[0,1801,1382,1902,1201,989,1802,1733,1335,1098,1073,1785,925,1144,1059,928,1652,1548],
		// 			[1801,0,947,1280,668,576,1578,1308,910,769,1121,1933,1260,1889,1596,1542,2532,2019],
		// 			[1382,947,0,733,603,586,930,1781,999,1471,2008,1856,2131,1614,1688,1835,1328,1577],
		// 			[1902,1280,733,0,886,688,465,1108,983,1079,1219,1355,1961,2160,1811,2255,1824,2175],
		// 			[1201,668,603,886,0,302,1041,1124,604,341,749,1850,756,1582,1089,1098,2238,1951],
		// 			[989,576,586,688,302,0,928,1142,493,332,407,1203,394,592,356,367,1263,1723],
		// 			[1802,1578,930,465,1041,928,0,1101,946,1233,1053,994,1264,1121,892,1214,692,1815],
		// 			[1733,1308,1781,1108,1124,1142,1101,0,1038,912,868,1054,1070,1128,1111,1121,1406,1251],
		// 			[1335,910,999,983,604,493,946,1038,0,346,497,778,539,718,380,424,1314,1451],
		// 			[1098,769,1471,1079,341,332,1233,912,346,0,301,751,381,495,338,299,1319,850],
		// 			[1073,1121,2008,1219,749,407,1053,868,497,301,0,441,449,413,224,266,1128,567],
		// 			[1785,1933,1856,1355,1850,1203,994,1054,778,751,441,0,1058,574,493,720,1030,690],
		// 			[925,1260,2131,1961,756,394,1264,1070,539,381,449,1058,0,504,296,138,1029,969],
		// 			[1144,1889,1614,2160,1582,592,1121,1128,718,495,413,574,504,0,401,366,761,486],
		// 			[1059,1596,1688,1811,1089,356,892,1111,380,338,224,493,296,401,0,308,858,596],
		// 			[928,1542,1835,2255,1098,367,1214,1121,424,299,266,720,138,366,308,0,864,600],
		// 			[1652,2532,1328,1824,2238,1263,692,1406,1314,1319,1128,1030,1029,761,858,864,0,712],
		// 			[1548,2019,1577,2175,1951,1723,1815,1251,1451,850,567,690,969,486,596,600,712,0]
		// 		];

		// Normalized w/o zeros
		// table = [
		// 			[0,1238,1105,1475,962,971,1260,542,1657,1463,1534,2000,905,1808,1791,1567,1767,2296],
		// 			[1238,0,724,1009,587,509,1332,948,767,643,495,999,393,545,566,395,1653,1037],
		// 			[1105,724,0,753,460,432,743,880,552,635,656,1176,625,789,542,620,1218,1644],
		// 			[1475,1009,753,0,744,542,405,878,872,858,580,528,848,623,585,753,909,771],
		// 			[962,587,460,744,0,302,879,815,550,312,304,1138,428,529,361,437,1080,987],
		// 			[971,509,432,542,302,0,699,772,429,295,341,888,389,423,321,341,985,877],
		// 			[1260,1332,743,405,879,699,0,946,898,1165,861,763,996,892,702,962,507,858],
		// 			[542,948,880,878,815,772,946,0,856,877,731,855,877,908,881,845,1188,927],
		// 			[1657,767,552,872,550,429,898,856,0,257,449,663,383,574,336,313,1164,1018],
		// 			[1463,643,635,858,312,295,1165,877,257,0,330,604,359,446,313,317,1256,741],
		// 			[1534,495,656,580,304,341,861,731,449,330,0,427,311,402,255,258,1016,531],
		// 			[2000,999,1176,528,1138,888,763,855,663,604,427,0,854,407,420,608,681,470],
		// 			[905,393,625,848,428,389,996,877,383,359,311,854,0,456,271,138,872,815],
		// 			[1808,545,789,623,529,423,892,908,574,446,402,407,456,0,410,362,716,469],
		// 			[1791,566,542,585,361,321,702,881,336,313,255,420,271,410,0,328,829,607],
		// 			[1567,395,620,753,437,341,962,845,313,317,258,608,138,362,328,0,769,555],
		// 			[1767,1653,1218,909,1080,985,507,1188,1164,1256,1016,681,872,716,829,769,0,681],
		// 			[2296,1037,1644,771,987,877,858,927,1018,741,531,470,815,469,607,555,681,0]
		// 		];

		// not normalized w/o zeros
	/*	table = [
					[0,1005,803,1120,833,820,929,693,2032,1010,1087,1626,673,1139,1532,1064,1247,1455],
					[1005,0,396,494,917,256,800,1234,1645,657,514,1402,636,255,787,555,924,563],
					[803,396,0,377,933,223,512,1418,1277,613,572,1393,659,427,712,594,749,928],
					[1120,494,377,0,1242,315,376,1415,1630,931,673,1270,961,282,1024,818,459,550],
					[833,917,933,1242,0,715,895,772,714,369,516,896,458,938,326,434,1050,976],
					[820,256,223,315,715,0,506,1145,1254,389,314,1163,402,228,492,368,571,499],
					[929,800,512,376,895,506,0,1001,1093,703,490,672,708,511,722,597,432,563],
					[693,1234,1418,1415,772,1145,1001,0,940,858,808,809,822,1127,833,779,1268,1036],
					[2032,1645,1277,1630,714,1254,1093,940,0,994,1074,993,866,1407,527,864,1502,1414],
					[1010,657,613,931,369,389,703,858,994,0,230,505,241,581,338,237,831,595],
					[1087,514,572,673,516,314,490,808,1074,230,0,422,307,346,410,218,648,384],
					[1626,1402,1393,1270,896,1163,672,809,993,505,422,0,746,799,413,533,626,629],
					[673,636,659,961,458,402,708,822,866,241,307,746,0,487,301,129,644,621],
					[1139,255,427,282,938,228,511,1127,1407,581,346,799,487,0,588,397,409,243],
					[1532,787,712,1024,326,492,722,833,527,338,410,413,301,588,0,324,795,680],
					[1064,555,594,818,434,368,597,779,864,237,218,533,129,397,324,0,547,447],
					[1247,924,749,459,1050,571,432,1268,1502,831,648,626,644,409,795,547,0,386],
					[1455,563,928,550,976,499,563,1036,1414,595,384,629,621,243,680,447,386,0]
				];*/

		// var paths = [];

		// DB.find({
		// 	collection : VIBRATION_PATTERN_COLLECTION,
		// 	gesture_id : data.gesture
		// }).sort({
		// 	calibration_id : 1
		// }).exec(
		// (err, patterns) =>
		// {
		// 	for (var i = patterns.length - 1; i >= 0; i--)
		// 	{
		// 		table[i] = [];
		// 		paths[i] = [];

		// 		var series1 = patterns[i].amplitudes;

		// 		header[i] = patterns[i].calibration_id;

		// 		for (var j = 0; j < patterns.length; j++)
		// 		{
		// 			var series2 = patterns[j].amplitudes;

		// 			var dist = dtw.compute(series1, series2);
					
		// 			var path = [];
		// 			dtw.path().forEach((elm, i) => {
		// 				path.push(elm[1]);
		// 			});

		// 			paths[i][j] = path;
		// 			table[i][j] = dist;
		// 		}
		// 	}
	
			// console.log(header);
			// console.table(table);

			// io.emit(ACTION.DISPLAY_DTW_TABLE, {
			// 	header : header,
			// 	table : table,
			// 	paths : paths
			// });
		// });
	});
});

function playback(recordings)
{
	var i = 0;

	clearInterval(playbackInterval);

	playbackInterval = setInterval(function()
	{
		let data = recordings[i];

		if(data != undefined)
		{			
			let request = createRequest({
					action : ACTION.PLAYBACK,
					data : data
			});

			sendDataToArduino(request);
			
			i++;
		}
		else
		{
			clearInterval(playbackInterval);

			let request = createRequest({
					action : ACTION.STOP_PLAYBACK,
			});

			sendDataToArduino(request);

			io.emit(ACTION.STOP_PLAYBACK);
		}

	}, timePeriod);
}

function sendDataToArduino(data)
{
	for(var i = 0; i < data.length; i++)
	{
		sp.write(new Buffer(data[i], 'ascii'));
	}

	sp.write(new Buffer('\n', 'ascii'));
}

function createRequest(data)
{
	return JSON.stringify(data);
}

function reset()
{
	currentGestureIndex = 0;
	dataRecordings.length = 0; //reset
	calibrationId = null;

	let request = createRequest({
			action : ACTION.RESET,
	});

	sendDataToArduino(request);
}

function trimDataRecording()
{
	var spliceCount = 0;

	for (var i = 0; i < dataRecordings.length; i++)
	{
		if(dataRecordings[i] == 0) spliceCount++;
		else break;
	}

	dataRecordings.splice(0, spliceCount);

	for (var i = dataRecordings.length - 1; i >= 0; i--)
	{
		if(dataRecordings[i] == 0) dataRecordings.pop();
		else break;
	}
}

function createFiles(gestureCount)
{
	var gesture = GESTURES[gestureCount];

	DB.find({
		collection : VIBRATION_PATTERN_COLLECTION,
		gesture_id : gesture.id
	},
	(err, patterns) =>
	{
		var csvStream = fs.createWriteStream('data/' + gesture.alias + '.csv');
		var datStream = fs.createWriteStream('data/' + gesture.alias + '' + '.dat');
		var normDatStream = fs.createWriteStream('data/' + 'NORM_' + gesture.alias + '.dat');

		patterns.sort(function(a,b)
		{
			if(a.amplitudes.length > b.amplitudes.length) return -1;
			if(a.amplitudes.length < b.amplitudes.length) return 1;
			return 0;
		});

		var patternMaxLength = patterns[0].amplitudes.length;

		csvStream.once('open', function(fd)
		{
			var header = 'gesture_id,calibration_id';

			for (var i = 0; i < patternMaxLength; i++)
			{
				header += ',' + (patterns[0].period*i);
			}

			csvStream.write(header + "\n");

			for (var i = 0; i < patterns.length; i++)
			{
				let pattern = patterns[i];
				let amps = pattern.amplitudes;

				let tail = (amps[amps.length-1] != 0) ? ',0' : '';

				csvStream.write(pattern.gesture_id + ',' + pattern.calibration_id + ',' + amps.join() + tail + "\n");
			}

			csvStream.end();
		});

		datStream.once('open', function(fd)
		{
			var header = '';
		
			// patterns.length = 2

			for (var i = 0; i < patterns.length; i++)
			{
				var pattern = patterns[i];

				header += pattern.calibration_id + '	';
			}
		
			datStream.write(header.trim() + "\n");

			for (var i = 0; i < patternMaxLength+1; i++)
			{
				var row = '';

				for (var j = 0; j < patterns.length; j++)
				{
					var pattern = patterns[j];
		
					if(pattern.amplitudes[i] != undefined)
						row += pattern.amplitudes[i] + '	';

					// else if(i < pattern.amplitudes.length+1 && pattern.amplitudes[i-1] != 0)
					// else
						// row += '0	';
				}

				datStream.write(row.trim() + "\n");
			}

			datStream.end();
		});

		normDatStream.once('open', function(fd)
		{
			var header = '';
		
			// patterns.length = 2

			var localExtremes = [];

			for (var i = 0; i < patterns.length; i++)
			{
				var pattern = patterns[i];
				var amp 	= pattern.amplitudes;

				header += pattern.calibration_id + '	';

				var max = -Infinity;
				var min = Infinity;

				for (var j = amp.length - 1; j >= 0; j--)
				{
					var value = amp[j];
					max = (value > max) ? value : max;
					min = (value < min) ? value : min;
				}

				localExtremes[i] = {max : max, min : min};
			}

			normDatStream.write(header.trim() + "\n");

			for (var i = 0; i < patternMaxLength+1; i++)
			{
				var row = '';

				for (var j = 0; j < patterns.length; j++)
				{
					var pattern = patterns[j];
		
					if(pattern.amplitudes[i] != undefined)
						row += pattern.amplitudes[i].map(localExtremes[j].min, localExtremes[j].max, 0, 127).toFixed() + '	';

					// else if(i < pattern.amplitudes.length+1 && pattern.amplitudes[i-1] != 0)
					// else
						// row += '0	';
				}

				normDatStream.write(row.trim() + "\n");
			}

			normDatStream.end();
		});

		//recursive call
		if(GESTURES.length-1 > gestureCount) createFiles(gestureCount+1);
	});
}

Number.prototype.map = function (in_min, in_max, out_min, out_max)
{
	return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}