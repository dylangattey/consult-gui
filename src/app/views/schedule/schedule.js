angular.module('app.views.schedule', ['stringExtensions'])
	.controller('ScheduleCtrl', function ($scope, $rootScope, $http, StringExtensions, $q) {
		var schedLocation = 'assets/schedule/sunlab/sched.';
		$rootScope.pageTitle = 'Schedule';
		$scope.headings = [];

		// Variables for dates and times, set below
		var meta = {}, // metadata
				current = {}, // info about current week
				slots = {}, // all the slots
				shifts = {}; // shifts to their times

		// Saves raw, newline delimited data to slots
		function saveSlots(raw, location) {
			if (location === undefined) location = slots; //default
			var lines = raw.split('\n');
			var i;
			for (i = 0; i< lines.length; i++) {
				var line = lines[i];
				var spaceIndex = line.indexOf(' ');
				var slot = line.substring(0, spaceIndex).trim();
				var value = line.substring(spaceIndex).trim();
				if (slot === '' || value === '') continue;
				location[slot] = value; // last version is saved, so if exists twice, whatever
			}
		}

		// Loads in shift times to associate ids with times
		function loadShiftTimes() {
			return $q(function(resolve, reject) {
				$http.get(schedLocation+'shifttimes').success(function(raw) {
					saveSlots(raw, shifts);
					resolve(shifts);					
				}, function(error, data) {
					console.log(error, data);
					reject(error);
				});
			});
		}

		// Loads all the metadata from file to the meta object
		function loadMeta() {
			return $q(function(resolve, reject) {
				$http.get(schedLocation+'meta').success(function(raw) {
					var splits = raw.split(' ');
					meta.startDate = new Date(splits[0]);
					meta.weeks = splits[1];
					meta.weeksToReading = splits[2];
					meta.title = raw.substring(StringExtensions.nthOccurrence(raw, ' ', 3) + 1).trim();
					resolve(meta);
				}, function(error, data) {
					console.log(error, data);
					reject(error);
				});
			});
		}

		// Loads in the current perm schedule to slots
		function loadPerm() {
			return $q(function(resolve, reject) {
				$http.get(schedLocation+'perm').success(function(raw) {
					saveSlots(raw);
					resolve(slots);
				}, function(error, data) {
					console.log(error, data);
					reject(error);
				});
			});
		}

		// Loads in the current week's schedule to slots - assumes perm is loaded
		function loadWeek() {
			return $q(function(resolve, reject) {
				$http.get(schedLocation+'week.'+current.week).success(function(raw) {
					saveSlots(raw);
					resolve(slots);
				}, function(error, data){
					console.log(error, data);
					reject(error);
				});
			});
		}

		// Assumes that loadMeta has already been called - transforms that data
		function parseCurrentDate() {
			return $q(function(resolve, reject) {
				var now = new Date();
				var diff = now.getTime() - meta.startDate.getTime();

				current.week = Math.floor(diff/(3600*24*7*1000)); // week number 0-max
				current.day = (now.getDay() + 6) % 7 + 1; //1 -7 like data format

				// Check data and make sure valid
				if (current.week < 0 || current.week > meta.weeks) {
					reject('Error: invalid week requested');
				}
				else resolve(current);
			});
		}

		// Saves data to frontend to visualize
		function visualize() {
			$scope.slots = slots;
			tmpDays = {};

			// Associates shift times with days
			for (var slot in shifts) {
				// Only include r and s slots if we're in reading period
				if (slot.indexOf('r') > -1 || slot.indexOf('s') > -1) {
					if (current.week < meta.weeksToReading) continue;
				}

				var val = shifts[slot];
				var dayName = val.substring(0, val.indexOf(' '));
				var startTime = val.substring(StringExtensions.nthOccurrence(val, ' ', 1)+1, val.indexOf('-'));
				var endTime = val.substring(val.indexOf('-')+1);

				var daySlots = tmpDays[dayName] ? tmpDays[dayName].slots : {};
				daySlots[slot] = {start: startTime, end: endTime};
				tmpDays[dayName] = {title:dayName, slots:daySlots};
			}

			// Order it and save it to frontend
			$scope.days = [
				tmpDays.Mon, 
				tmpDays.Tue,
				tmpDays.Wed,
				tmpDays.Thu,
				tmpDays.Fri,
				tmpDays.Sat,
				tmpDays.Sun
			];

			// The default times on the left
			$scope.legend = [];
			var hour;
			var lastHour = current.week < meta.weeksToReading ? 26 : 28;
			for (hour = 9; hour<lastHour; hour++) {
				$scope.legend.push({start: hour+':00', end: (hour+1)+':00'});
			}
		}

		// Calculates top positioning of a time block given the time
		$scope.timeBlockStyle = function(time) {
			var splitStart = time.start.split(':');
			var splitEnd = time.end.split(':');
			var start = parseInt(splitStart[0])+(parseInt(splitStart[1])/60.0);
			var end = parseInt(splitEnd[0])+(parseInt(splitEnd[1])/60.0);
			
			var height = (end - start) * 45 - 5;
			var topOffset = (start-9) * 45;
			return {
				'height': ''+height+'px', 
				'margin-top': ''+topOffset+'px'
			};
		};
			

		/* Do all the things! 
		 * 1. Load non-changing data first - meta and perm
		 * 2. Parse the current date
		 * 3. Load the current week
		 * 4. Save to $scope the data for the current week + perm combined
		 */
		$q.all([loadMeta(), loadPerm(), loadShiftTimes()])
			.then(parseCurrentDate)
			.then(loadWeek)
			.then(visualize, function(error){
				console.log(error);
			});
	});
