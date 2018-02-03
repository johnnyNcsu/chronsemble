//  A timeline component for d3
//  version v0.1

function timeline(domTimelineElement, domSpatioFlowElement, domInfoFlowElement) {

    //--------------------------------------------------------------------------
    //
    // chart
    //

    // global timeline variables
    var timeline = {},   // The timeline
        data = {},       // Container for the data
        components = [], // All the components of the timeline for redrawing
        bands = {},      // Registry for all the bands in the timeline
        bandY = 0,       // Y-Position of the next band
        bandNum = 0,     // Count of bands for ids
        itemsPerTrack = [];  // Array of size totalTracks where each element is
                             // a count of the entities on that track.
    var lastEvent = null;
//    var savedXbrushWidth = 0;

    var svg = d3.select(domTimelineElement).append("svg");
    var chart = svg;
    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("visibility", "visible");

    //--------------------------------------------------------------------------
    //
    // data
    //

    timeline.data = function(items) {

        var today = new Date(),
            tracks = [],
//            yearMillis = 31622400000,
            yearMillis = 31556952000,
            dayMillis = 86400,
            totalTracks = 0,
            // instantOffset determines separation between an instant event and
            //   the next event placed on the same track.
//            instantOffset = 100 * yearMillis, // 100 year gap after an instant event
            instantOffset = dayMillis, // 1 day gap after an instant event
            timeRange = [];

        data.items = items;

        function showItems(n) {
            var count = 0, n = n || 10;
            console.log("\n");
            items.forEach(function (d) {
                count++;
                if (count > n) return;
                //console.log(toYear(d.start) + " - " + toYear(d.end) + ": " + d.label);
                //console.log("Item: " + count + ":" + d.start + " - " + d.end + ": " + d.label);
                console.log("Item: " + count + ": size: ", d3.keys(d).length, ": keys: ", d3.keys(d), "data: ", d);
            })
        }

        function showJsonItems(n) {
            var count = 0, n = n || 10;
            console.log("\n");
            console.log(Object.keys(items));
            /*
            for (var prop in items) {
              if (items.hasOwnProperty(prop)) {
                count++;
                if (count > n) return;
                console.log(prop);
              }
            }
            */
          };

 //showItems();
        if (items[0].loc === undefined) spatioFlow = false;
 //("loc" in items[0]) ? console.log("SpatioFow") : spatioFlow = false;

        function compareAscending(item1, item2) {
            //compareAscending sorts events according to the following:
            // youngest sorts first; longest duration sorts first in event of tie.

            // Every item must have two fields: 'start' and 'end'.
            var result = item1.start - item2.start;
            if (result < 0) { return -1; }  // item1 starts prior to item2 and sorts earlier
            if (result > 0) { return 1; }   // item2 starts prior to item1 and sorts earlier
            // Start times are equal
            // sort longer events earlier
            result = item2.end - item1.end;
            if (result < 0) { return -1; } // item1 ends after item2 and sorts earlier
            if (result > 0) { return 1; }  // item2 ends after item1 and sorts earlier
            // identical start and end times
            return 0;
        }

        function compareDescending(item1, item2) {
            //compareDescending sorts events according to the following:
            // oldest sorts first; shortest duration sorts first in event of tie.

            // Every item must have two fields: 'start' and 'end'.
            var result = item1.start - item2.start;
            // later first
            if (result < 0) { return 1; }  // item1 starts prior to item2 and sorts later
            if (result > 0) { return -1; } // item2 starts prior to item1 and sorts later
            // shorter first
            result = item2.end - item1.end;
            if (result < 0) { return 1; }  // item1 ends after item2 and sorts later
            if (result > 0) { return -1; } // item2 ends after item1 and sorts later
            // identical start and end times
            return 0;
        }

        function setEventIntervals(items, timeRange, zoomTarget) {
          // This fcn finds the width of the event label and, sets the event
          // interval to the min ofthe label width or the duration width at the
          // target zoom scale (this is arbitrary value defined in geometry object).
          var zoom = {},
              instant = {};

          zoom.xScale = d3.time.scale()
              .domain(zoomTarget)
              .range([0, timelineGeometry.maxWidth - timelineGeometry.margin.left -
                timelineGeometry.margin.right]);

          instant.xScale = d3.time.scale()
              .domain(timeRange)
              .range([0, timelineGeometry.maxWidth - timelineGeometry.margin.left -
                timelineGeometry.margin.right]);

          var circleWidthms = instant.xScale.invert(2*timelineGeometry.instantRadius+3).getTime()

          items.forEach(function(item) {
            var labelWidth = getTextWidth(item.label, "10px sans-serif") + ((item.instant) ? 15 : 5);
            var durationWidth = zoom.xScale(item.end) - zoom.xScale(item.start);
  //          var eventInterval = (labelWidth > durationWidth) ? labelWidth : durationWidth;
            item.intervalEnd = (labelWidth > durationWidth) ?
              new Date(item.start.getTime() + zoom.xScale.invert(labelWidth).getTime() - timeRange[0].getTime()) : item.end;
  //           = zoom.xScale.invert(eventInterval);
            if (item.instant) {
              var circleWidth = new Date(item.start.getTime() + (circleWidthms - timeRange[0].getTime()));
              if (circleWidth > item.intervalEnd) item.intervalEnd = circleWidth;
            }

//            console.log("label W:", labelWidth, " duration W:", durationWidth, "item end:", item.end, " result:", item.intervalEnd);
          })
        }

        function calculateTracks(items, sortOrder, timeOrder) {
            var i, track;

            sortOrder = sortOrder || "descending"; // "ascending" or default to "descending"
            timeOrder = timeOrder || "backward";   // "forward" or default to "backward"

            function sortBackward() {
                // older items assigned to early tracks
                tracks[0] = items[0].start;
                items[0].track = 0;
                itemsPerTrack[0] = 1;
                itemsPerTrack[1] = 0;
                totalTracks = 1;
                items.slice(1).forEach(function (item) {
                    for (i = 0, track = 0; i < tracks.length; i++, track++) {
        //              if (item.end < tracks[i]) break;
                      if (item.intervalEnd < tracks[i]) break;
                    }
                    item.track = track;
                    if (track > totalTracks - 1) {
                      totalTracks++;
                      itemsPerTrack[totalTracks] = 0;
//                      console.log("track:", track, "totalTracks:", totalTracks);
                    }
                    itemsPerTrack[track]++;
                    tracks[track] = item.start;
                });
            }


            function sortForward() {
                // younger items assigned to early tracks
                tracks[0] = items[0].intervalEnd;
                items[0].track = 0;
                itemsPerTrack[0] = 1;
                itemsPerTrack[1] = 0;
                totalTracks = 1;

                items.slice(1).forEach(function (item) {
                    for (i = 0, track = 0; i < tracks.length; i++, track++) {
                        if (item.start > tracks[i]) break;
                    }
                    item.track = track;
                    if (track > totalTracks - 1) {
                      totalTracks++;
                      itemsPerTrack[totalTracks] = 0;
//                      console.log("track:", track, "totalTracks:", totalTracks);
                    }
                    itemsPerTrack[track]++;
                    tracks[track] = item.intervalEnd;
                });
            }

            if (sortOrder === "ascending")
                data.items.sort(compareAscending);
            else
                data.items.sort(compareDescending);

  //          showItems(256);

            if (timeOrder === "forward")
                sortForward();
            else
                sortBackward();
        }

        // Initialize the time range; time range is
        timeRange = [parseDate(data.items[0].start), parseDate(data.items[0].end)];
//        console.log("data.items:", data.items[0]);
// console.log("timeRange:", timeRange[0], timeRange[1]);
        // Convert yearStrings into dates
        data.items.forEach(function (item){
            item.start = parseDate(item.start);
            if (item.start < timeRange[0]) timeRange[0] = item.start;
            if (item.end == "") {
                //console.log("1 item.start: " + item.start);
                //console.log("2 item.end: " + item.end);
                item.end = new Date(item.start.getTime() + instantOffset);
                //console.log("3 item.end: " + item.end);
                item.instant = true;
            } else {
                //console.log("4 item.end: " + item.end);
                item.end = parseDate(item.end);
                item.instant = false;
            }
            // The timeline never reaches into the future.
            // This is an arbitrary decision.
            // Comment out, if dates in the future should be allowed.
            if (item.end > today) { item.end = today};
  //          item.eventInterval = null;
            if (item.end > timeRange[1]) timeRange[1] = item.end;
        });
  //   console.log("timeRange:", timeRange[0], timeRange[1]);
     // Pad the start and end of timeline by 1/2 of the fitToScale value.
     var timeRangeBuffer = (timeRange[1]-timeRange[0])*timelineGeometry.fitToScale*0.5;
     timeRange = [timeRange[0].getTime() - timeRangeBuffer, timeRange[1].getTime() + timeRangeBuffer];
     timeRange = [new Date(timeRange[0]), new Date(timeRange[1])];
  //   console.log("fitToScale Range:", timeRange[0], timeRange[1]);
     data.minDate = timeRange[0];
     data.maxDate = timeRange[1];
     timelineGeometry.brushExtent = timeRange;
     timeRangeBuffer = timeRangeBuffer * 2;
     var zoomTarget = [timeRange[0], new Date(timeRange[0].getTime() + timeRangeBuffer)];
//     console.log(zoomTarget);
     data.items.forEach(function(item) {
       //stopped here
     });

     setEventIntervals(data.items, timeRange, zoomTarget);
        // Show patterns
        //calculateTracks(data.items, "ascending", "backward");
        //calculateTracks(data.items, "descending", "forward");
        // Show real data
        // Calculate tracks in both directions to find the layout with fewest
        // tracks.
        calculateTracks(data.items, "ascending", "forward");
        console.log("Sort forward total tracks: ", totalTracks);
        timelineGeometry.totalTracks = totalTracks;
    //timelineGeometry.totalTracks = Number.MAX_SAFE_INTEGER;
        totalTracks = 0;
        tracks = [];
        calculateTracks(data.items, "descending", "backward");
        console.log("Sort backward total tracks: ", totalTracks);
        if (totalTracks <= timelineGeometry.totalTracks) {
          timelineGeometry.totalTracks = totalTracks;
          console.log("Using descending backward!");
        } else {
          console.log("Using ascending forward!");
          totalTracks = 0;
          tracks = [];
          calculateTracks(data.items, "ascending", "forward");
        }

        data.nTracks = tracks.length;
  //      data.minDate = d3.min(data.items, function (d) { return d.start; });
  //      data.maxDate = d3.max(data.items, function (d) { return d.end; });
  //      console.log(timelineGeometry);
        timelineGeometry.totalTracks = totalTracks;
        return timeline;
    };

    timeline.defineTimelinePane = function( ) {
      // Create svg element to contain all of the timeline elements
        svg.attr("class", "svg")
           .attr("id", "svg")
           .attr("width", timelineGeometry.maxWidth)
           .attr("height", timelineGeometry.margin.top + timelineGeometry.margin.bottom +
             timelineGeometry.flowHeight("timeFlow", true) +
             timelineGeometry.flowHeight("birdView", true) +
             timelineGeometry.axisHeight() * 2);

        return timeline;
    }

    timeline.defineTimeflowArea = function( ) {
       svg.append("g")
          .attr("transform", "translate(" + timelineGeometry.margin.left + "," +
            timelineGeometry.margin.top + ")")
          .append("clipPath")
          .attr("id", "timeflow-area")
          .append("rect")
          .attr("width", timelineGeometry.maxWidth - timelineGeometry.margin.left -
                  timelineGeometry.margin.right)
          .attr("height", timelineGeometry.flowHeight("timeFlow", true));

       chart = chart.select("g").append("g")
                    .attr("class", "chart")
                    .attr("clip-path", "url(#timeflow-area)" );

        return timeline;
    }

    timeline.defineBirdViewArea = function( ) {
       svg.select("g")
          .append("clipPath")
          .attr("id", "birdview-area")
          .append("rect")
          .attr("width", timelineGeometry.maxWidth - timelineGeometry.margin.left -
                  timelineGeometry.margin.right)
//          .attr("height", timelineGeometry.flowHeight("birdView"))
          .attr("height", (timelineGeometry.flowHeight("birdView", true) -
            timelineGeometry.birdView.margin.top - timelineGeometry.birdView.margin.bottom))
          .attr("transform", "translate(0," + (timelineGeometry.flowHeight("timeFlow", true) +
                  timelineGeometry.axisHeight( ) + timelineGeometry.birdView.margin.top) + ")");

       chart = svg.select("g").append("g")
                  .attr("class", "chart")
                  .attr("clip-path", "url(#birdview-area)" );

        return timeline;
    }

    //----------------------------------------------------------------------
    //
    // band
    //

    timeline.band = function (bandName) {
//      console.log("Building band:" + bandName, "Geometry:", timelineGeometry[bandName]);
      console.log("Building band:" + bandName);
//      console.log(itemsPerTrack);

        var band = {};
        band.id = "band" + bandNum;
        band.x = 0;
        band.y = bandY;
        band.w = timelineGeometry.maxWidth - timelineGeometry.margin.left -
          timelineGeometry.margin.right;
        band.h = timelineGeometry.flowHeight(bandName, true);

        //console.log("band.h", band.h);
        // trackOffset controls distance of first track from band edge and other tracks

        band.marginTop = timelineGeometry[bandName].margin.top;
        band.marginBottom = timelineGeometry[bandName].margin.Bottom;
        band.trackOffset = timelineGeometry[bandName].track.space;
        band.itemHeight = timelineGeometry[bandName].track.height;
        band.trackHeight = band.trackOffset + band.itemHeight;
        band.parts = [],
        band.instantWidth = 100; // arbitray value

        band.xScale = d3.time.scale()
            .domain([data.minDate, data.maxDate])
            .range([0, band.w]);

        band.yTrackPos = function (track) {
            return band.marginTop + track * band.trackHeight;};

        band.g = chart.append("g")
            .attr("id", band.id)
            .attr("transform", "translate(0," + band.y + ")");

        band.g.append("rect")
            .attr("class", "band")
            .attr("width", band.w)
            .attr("height", timelineGeometry.flowHeight(bandName, false));

        if (bandName === "timeFlow") {
          band.g.append("svg")
           .attr("y", "2")
           .attr("height", band.itemHeight + 2)
           .attr("class", "infoRow")
           .attr("id", "infoRow")
           .append("rect")
           .attr("width", band.w)
           .attr("height", band.itemHeight + 2);
        }

        // Items
        var items = band.g.selectAll("g")
            .data(data.items)
            .enter().append("svg")
            .attr("y", function (d) { return band.yTrackPos(d.track); })
            .attr("height", band.itemHeight)
            .attr("class", function (d) { return d.instant ? "part instant" : "part interval";});

        var intervals = d3.select("#band" + bandNum).selectAll(".interval");

        if (bandName === "timeFlow") {
          intervals.append("rect")
            .attr("fill", "#AAFFFF")
            .attr("width", "100%")
//            .attr("width", function(d) { return band.xScale(d.end) - band.xScale(d.start)})
            .attr("height", "100%");

          // Apply event labels to timeFlow (not visible on birdView)
          intervals.append("text")
            .attr("class", "eventLabel")
            .attr("x", 1)
            .attr("y", 10)
            .text(function (d) { return d.label; });
        } else if (bandName === "birdView") {
          // Draw bird's eye view tracks
          intervals.append("rect")
            .attr("fill", "#808080")
            .attr("width", "100%")
            .attr("height", "100%");
        }

        var instants = d3.select("#band" + bandNum).selectAll(".instant");
        instants.append("circle")
            .attr("cx", band.itemHeight / 2)
            .attr("cy", band.itemHeight / 2)
            .attr("r", timelineGeometry.instantRadius);

        if (bandName === "timeFlow") {
          // Apply event labels to timeFlow (not visible on birdView)
          instants.append("text")
              .attr("class", "instantLabel")
              .attr("x", 15)
              .attr("y", 10)
              .text(function (d) { return d.label; });
        };

        band.addActions = function(actions) {
            // actions - array: [[trigger, function], ...]
            actions.forEach(function (action) {
                items.on(action[0], action[1]);
            })
        };

        // Redraw sets the width of an event interval
        band.redraw = function () {
          //console.log("band.parts[1]:", band.parts[1]);
            items
                .attr("x", function (d) { return band.xScale(d.start);})
                .attr("width", function (d) {
    //              return band.xScale(d.end) - band.xScale(d.start); });
                  return band.xScale(d.intervalEnd) - band.xScale(d.start); });

            items.selectAll("rect").attr("width", function (d) {
                return band.xScale(d.end) - band.xScale(d.start); });

            band.parts.forEach(function(part) { part.redraw(); })
//scrubberValue(band.parts[1], items);
            if (band.id === "band0") scrubberValue(band);
        };

        bands[bandName] = band;
        components.push(band);
        // Adjust values for next band
//        bandY += band.h + timelineGeometry[bandName].margin.top +
        bandY += band.h + timelineGeometry.axisHeight( );
        bandNum += 1;

        return timeline;
    };

    function getViewRange_ms(min, max) {
      return (isString(min)) ? (max.getTime() - min.getTime()) : max - min;
    }

    //----------------------------------------------------------------------
    //
    // infoFlow
    //

    function scrubberValue(bandRef) {
        var scrubberWindow = [];
        var infoFlowValues = [];
        data.items.forEach(function (value) {
            var arrayObject = new Object();
            arrayObject.start = value.start;
            arrayObject.end = value.end;
            arrayObject.label = value.label;
//            console.log("loc:", value.loc);
            arrayObject.loc = value.loc;
            arrayObject.proximity = "0";
            arrayObject.track = value.track;
            infoFlowValues.push(arrayObject);
        });
        bandRef.parts[1].forEach(function (part) {
            scrubberWindow.push(part);
        });
//        console.log(scrubberWindow);
//        var scrubberWindowRange = parseInt(scrubberWindow[0][0].innerHTML);
//        var referenceValue = parseInt(scrubberWindow[0][1].innerHTML);
//        var scrubberWindowRange_ms = parseFloat(scrubberWindow[0][0].innerHTML);
//var scrubberWindowRange_ms = getViewRange_ms(data.minDate, data.maxDate);
//var scrubberWindowRange_ms = getViewRange_ms(brush.extent()[0], timeline.brush.extent()[1]);
//        console.log(data.minDate, data.maxDate, scrubberWindow[0][1].innerHTML);
//        var referenceValue = parseFloat(scrubberWindow[0][1].innerHTML);
//var fullFormat = d3.time.format("%a, %d %b %Y %H:%M:%S GMT");
//var fullFormat = "%a, %d %b %Y %H:%M:%S GMT";
//console.log(scrubberWindow[0][1].innerHTML, Date.parse(scrubberWindow[0][1].innerHTML), parseDate(scrubberWindow[0][1].innerHTML, fullFormat));
//        var referenceValueObj = (isString(scrubberWindow[0][1].innerHTML)) ? new Date(scrubberWindow[0][1].innerHTML) :
//          parseFloat(scrubberWindow[0][1].innerHTML);
//          console.log(referenceValueObj);
//          var referenceValue = referenceValueObj.getTime();
          var referenceValue = getViewRange_ms(timelineGeometry.brushExtent[0], timelineGeometry.brushExtent[1])/2 + timelineGeometry.brushExtent[0].getTime();
//          console.log((new Date(referenceValue)).toUTCString(), referenceValue);

//          generateInfoFlow(bandRef, infoFlowValues, scrubberWindowRange, referenceValue);
          generateInfoFlow2(bandRef, infoFlowValues, referenceValue);
    }

    function generateInfoFlow2(band, infoFlowValues, referenceValue) {
//        var start = referenceValue - maxProximity;
//        var end = referenceValue + maxProximity;
        var start = timelineGeometry.brushExtent[0].getTime();
        var end = timelineGeometry.brushExtent[1].getTime();
        var maxProximity = getViewRange_ms(start, end)/2;
        var currentReferenceEventGap = Number.MAX_SAFE_INTEGER;
        var eventsWithinScruber = [];
        var referenceEvent = [];
        var numValue = 1;
        var referenceBoundedByEvent = false;
        var colorGradientIndex = d3.scale.linear()
                                      .domain([0, maxProximity])
                                      .range([0,9]);

//console.log("===================================", maxProximity);
        infoFlowValues.forEach(function (value) {
//          console.log(numValue, value);
          numValue = numValue + 1;
            var startDateOfEvent = value.start.getTime();
            var endDateOfEvent = value.end.getTime();
            if ((startDateOfEvent >= start && endDateOfEvent <= end) ||
               (startDateOfEvent < start && (endDateOfEvent > start)) ||
               (startDateOfEvent >= start && startDateOfEvent < end)) {

                 var eventStartToReferenceGap = referenceValue - startDateOfEvent;
                 var eventStopToReferenceGap = endDateOfEvent - referenceValue;
                 var stuff = { label: value.label,
                              start: value.start,
                              end: value.end,
                              startOfEvent: startDateOfEvent,
                              endOfEvent: endDateOfEvent,
                              brushStart: start,
                              brushEnd: end,
                              reference: referenceValue,
                              startGap: eventStartToReferenceGap,
                              stopGap: eventStopToReferenceGap,
                              currentGap: currentReferenceEventGap
                            }

        //         console.log(value.label, value.start, value.end, startDateOfEvent, endDateOfEvent, start, end, eventStartToReferenceGap, eventStopToReferenceGap);
//console.log(stuff);
                // proximity measures distance of event from the reference line;
                // in order to have the closer proximities look darker on the
                // choropleth map, subtract the proximity to center from the
                // total range of the scrubber window. In essence, this assigns
                // larger values to events closest to the reference line.
                if (startDateOfEvent <= referenceValue && referenceValue <= endDateOfEvent) {
//                  value.proximity = (maxProximity + 2);
                  value.proximity = colorGradientIndex(maxProximity);
        //          console.log("\nBAM!!!", value.label, value.start, value.end, value.proximity);
                } else {
                  value.proximity = colorGradientIndex(Math.max(Math.max(0, (maxProximity - Math.abs(eventStartToReferenceGap))),
                  (maxProximity - Math.abs(referenceValue - endDateOfEvent))));
//                  value.proximity = Math.max(value.proximity, (scrubberWindowRange -
//                    Math.abs(referenceValue - endDateOfEvent))).toString();
                }
                // Is location unique? If not, do max hold on proximity.
                if (spatioFlow) {
                  eventsWithinScruber.forEach(function(eventItem) {
                  if (value.loc === eventItem.loc) {
                    var eventProximity = parseFloat(eventItem.proximity);
                    if (value.proximity > eventProximity) {
        // console.log("\nswapping eventItem:", eventItem.proximity, " for value:", value.proximity);
                      eventItem.proximity = value.proximity.toString();
                    } else {
        // console.log("\nretaining eventItem:", eventItem.proximity, " over value:", value.proximity);
                      value.proximity = eventProximity;
                    }
                  }
                });
              }
              value.proximity = value.proximity.toString();
              eventsWithinScruber.push(value);

// Find the tightest event bounding the reference or, if no bounding event, then
// the event closest to the reference.

              if (eventStartToReferenceGap > 0 && eventStopToReferenceGap > 0) {
                if (!referenceBoundedByEvent) {
//                  console.log("bounding:", value.label);
                  referenceBoundedByEvent = true;
                  currentReferenceEventGap = eventStartToReferenceGap + eventStopToReferenceGap;
                  referenceEvent.push(value);
                } else if (eventStartToReferenceGap + eventStopToReferenceGap < currentReferenceEventGap) {
                  currentReferenceEventGap = eventStartToReferenceGap + eventStopToReferenceGap;
                  referenceEvent.push(value);
//                  console.log(value.label, "gap:", currentReferenceEventGap);
                }
              } else if (!referenceBoundedByEvent && eventStartToReferenceGap < 0) {
                  // reference is in past relative to event
                  if (Math.abs(eventStartToReferenceGap) < currentReferenceEventGap) {
                    currentReferenceEventGap = Math.abs(eventStartToReferenceGap);
                    referenceEvent.push(value);
//                    console.log(value.label, "late gap:", currentReferenceEventGap);
                  }
              } else if (!referenceBoundedByEvent && eventStopToReferenceGap < 0) {
                  // refence is in the future relative to event
                  if (Math.abs(eventStopToReferenceGap) < currentReferenceEventGap) {
                    currentReferenceEventGap = Math.abs(eventStopToReferenceGap);
                    referenceEvent.push(value);
                  }
              }
            }
        });

        if (referenceEvent.length===0) {
          // This fixes bug where there are no timeflow events within the scrubber
          // window; however the fix is not ideal (FIXME) because the infoflow
          // pane will retain the last event regardless of proximity to reference
          // line.
//          console.log("ref.length:", referenceEvent, "lastEvent: ", lastEvent);
          referenceEvent[0] = lastEvent;
        } else {
          lastEvent = referenceEvent[0];
        }
        // Highlight the timeline row corresponding to the cards in the
        // info-flow band.
        d3.select(".infoRow")
            .attr("y", referenceEvent[referenceEvent.length-1].track * band.trackHeight + band.trackOffset - 1);

        var centre = displayInfoFlow(eventsWithinScruber, referenceEvent[referenceEvent.length-1]);
        var locations = (spatioFlow) ? updateSpatioFlow(eventsWithinScruber, maxProximity) : null;
    }

    function generateInfoFlow(band, infoFlowValues, scrubberWindowRange, referenceValue) {
        var maxProximity = scrubberWindowRange / 2;
        var start = referenceValue - maxProximity;
        var end = referenceValue + maxProximity;
        var currentReferenceEventGap = Number.MAX_SAFE_INTEGER;
        var eventsWithinScruber = [];
        var referenceEvent = [];
        var numValue = 1;
        var referenceBoundedByEvent = false;

        infoFlowValues.forEach(function (value) {
//          console.log(numValue, value);
          numValue = numValue + 1;
            var startDateOfEvent = value.start.getUTCFullYear() +
                ((value.start.getUTCMonth() + value.start.getUTCDate()/32)/12);
            var endDateOfEvent = value.end.getUTCFullYear() +
                ((value.end.getUTCMonth() + value.end.getUTCDate()/32)/12);
            if ((startDateOfEvent >= start && endDateOfEvent <= end) ||
               (startDateOfEvent < start && (endDateOfEvent > start)) ||
               (startDateOfEvent >= start && startDateOfEvent < end)) {
                 var eventStartToReferenceGap = referenceValue - startDateOfEvent;
                 var eventStopToReferenceGap = endDateOfEvent - referenceValue;
                // proximity measures distance of event from the reference line;
                // in order to have the closer proximities look darker on the
                // choropleth map, subtract the proximity to center from the
                // total range of the scrubber window. In essence, this assigns
                // larger values to events closest to the reference line.
                if (startDateOfEvent <= referenceValue && referenceValue <= endDateOfEvent) {
                  value.proximity = (maxProximity + 2);
        //          console.log("\nBAM!!!", value.label, value.start, value.end, value.proximity);
                } else {
                  value.proximity = Math.max(Math.max(0, (maxProximity - Math.abs(eventStartToReferenceGap))),
                  (maxProximity - Math.abs(referenceValue - endDateOfEvent)));
//                  value.proximity = Math.max(value.proximity, (scrubberWindowRange -
//                    Math.abs(referenceValue - endDateOfEvent))).toString();
                }
                // Is location unique? If not, do max hold on proximity.
                if (spatioFlow) {
                  eventsWithinScruber.forEach(function(eventItem) {
                  if (value.loc === eventItem.loc) {
                    var eventProximity = parseFloat(eventItem.proximity);
                    if (value.proximity > eventProximity) {
        // console.log("\nswapping eventItem:", eventItem.proximity, " for value:", value.proximity);
                      eventItem.proximity = value.proximity.toString();
                    } else {
        // console.log("\nretaining eventItem:", eventItem.proximity, " over value:", value.proximity);
                      value.proximity = eventProximity;
                    }
                  }
                });
              }
              value.proximity = value.proximity.toString();
              eventsWithinScruber.push(value);

// Find the tighest event bounding the reference or, if no bounding event, then
// the event closest to the reference.

              if (eventStartToReferenceGap > 0 && eventStopToReferenceGap > 0) {
                if (!referenceBoundedByEvent) {
                  referenceBoundedByEvent = true;
                  currentReferenceEventGap = eventStartToReferenceGap + eventStopToReferenceGap;
                  referenceEvent.push(value);
                } else if (eventStartToReferenceGap + eventStopToReferenceGap < currentReferenceEventGap) {
                  currentReferenceEventGap = eventStartToReferenceGap + eventStopToReferenceGap;
                  referenceEvent.push(value);
                }
              } else if (!referenceBoundedByEvent && eventStartToReferenceGap < 0) {
                  // reference is in past relative to event
                  if (Math.abs(eventStartToReferenceGap) < currentReferenceEventGap) {
                    currentReferenceEventGap = Math.abs(eventStartToReferenceGap);
                    referenceEvent.push(value);
                  }
              } else if (!referenceBoundedByEvent && eventStopToReferenceGap < 0) {
                  // refence is in the future relative to event
                  if (Math.abs(eventStopToReferenceGap) < currentReferenceEventGap) {
                    currentReferenceEventGap = Math.abs(eventStopToReferenceGap);
                    referenceEvent.push(value);
                  }
              }
            }
        });

        if (referenceEvent.length===0) {
          // This fixes bug where there are no timeflow events within the scrubber
          // window; however the fix is not ideal (FIXME) because the infoflow
          // pane will retain the last event regardless of proximity to reference
          // line.
//          console.log("ref.length:", referenceEvent, "lastEvent: ", lastEvent);
          referenceEvent[0] = lastEvent;
        } else {
          lastEvent = referenceEvent[0];
        }
        // Highlight the timeline row corresponding to the cards in the
        // info-flow band.
        d3.select(".infoRow")
            .attr("y", referenceEvent[referenceEvent.length-1].track * band.trackHeight + band.trackOffset - 1);

        var centre = displayInfoFlow(eventsWithinScruber, referenceEvent[referenceEvent.length-1]);
        var locations = (spatioFlow) ? updateSpatioFlow(eventsWithinScruber, maxProximity) : null;
    }

    function updateSpatioFlow(eventLocations, maxProximity) {

      var map = d3.geomap.choropleth()
                  .geofile('/d3-geomap/topojson/world/countries.json')
//                  .colors(['red','green'])
//                  .colors(['rgb(247,251,255)','rgb(222,235,247)','rgb(198,219,239)','rgb(158,202,225)','rgb(107,174,214)','rgb(66,146,198)','rgb(33,113,181)','rgb(8,81,156)','rgb(8,48,107)'])
//                  .colors(['rgb(255,255,255)','rgb(253,229,230)','rgb(251,204,206)',
//                    'rgb(249,178,181)','rgb(247,153,157)','rgb(245,127,132)',
//                    'rgb(243,102,108)','rgb(241,76,83)','rgb(239,51,59)',
//                    'rgb(237,25,34)','rgb(241,76,83)','rgb(235,0,10)'])
                  .domain([0, maxProximity + 2])
//                  .legend(true)
                  .column('proximity')
                  .unitId('loc')
                  .postUpdate(function() {

                  // Remove old maps tagged with the "base" id.

                      d3.selectAll(domSpatioFlow)
                        .select('#base').remove();

// Attach the "base" id to the newly created map - this will be removed AFTER
// the next map is draw. Delaying the removal of the prior map provides
// smooth animatation of the region shading.

                      var spatioFlowTagSvg = d3.selectAll(domSpatioFlow)
                                                .select('#map')
                                                .select('svg')
                                                .attr('id', 'base');});

      //console.log(eventLocation);
      // Map new locations - this will append a new svg section for the map.
      // Old maps are removed in the postUpdate function -
      var spatioFlowAddMap = d3.selectAll(domSpatioFlow)
                               .select('#map')
                               .datum(eventLocations)
                               .call(map.draw, map);

    }

    function displayInfoFlow(eventsWithinScruber, centreDisplayValue) {

    //  console.log(topKeys);
    /*
    // Cache of the template
    var template = document.getElementById("template-table-item");
    // Get the contents of the template
    var templateHtml = template.innerHTML;
    // Final HTML variable as empty string
    var tableHtml = "";

    // Loop through dataObject, replace placeholder tags
    // with actual data, and generate final HTML
    d3.keys(centreDisplayValue).forEach(function (d) {
        //console.log(toYear(d.start) + " - " + toYear(d.end) + ": " + d.label);
        //console.log("Item: " + count + ":" + d.start + " - " + d.end + ": " + d.label);
//        console.log("Item: " + count + ": size: ", d3.keys(d).length, ": keys: ", d3.keys(d), "data: ", d);
        tableHtml += templateHtml.replace(/{{field}}/g, d)
                                .replace(/{{value}}/g, centreDisplayValue[d]);

    })

    // Replace the HTML of #list with final HTML
    document.getElementById("table").innerHTML = tableHtml;
    */
        var infoFlowTextLabel = d3.selectAll(domInfoFlow)
          .select(".band")
          .selectAll("g")
          .select("#label")
          .attr("transform", "translate(2, 10)")
          .text(centreDisplayValue.label);

        var infoFlowTextBegin = d3.selectAll(domInfoFlow)
            .select(".band")
            .selectAll("g")
            .select("#begin")
            .attr("transform", "translate(2, 20)")
            .text(centreDisplayValue.start);

        var infoFlowTextBegin = d3.selectAll(domInfoFlow)
            .select(".band")
            .selectAll("g")
            .select("#end")
            .attr("transform", "translate(2, 30)")
            .text(centreDisplayValue.end);

        var infoFlowTextBegin = d3.selectAll(domInfoFlow)
            .select(".band")
            .selectAll("g")
            .select("#loc")
            .attr("transform", "translate(2, 40)")
            .text(centreDisplayValue.loc);

    }

    //----------------------------------------------------------------------
    //
    // labels
    //

    timeline.labels = function (bandName) {
console.log("Labeling band:" + bandName);
        var band = bands[bandName],
            labelWidth = 46,
            labelHeight = 20,
            tooltipTop = timelineGeometry.infoFlowHeight +
              timelineGeometry.margin.top + timelineGeometry.margin.bottom +
              timelineGeometry.flowHeight("timeFlow", true) +
              timelineGeometry.flowHeight("birdView", true) +
              timelineGeometry.axisHeight( ) * 2 - 10;
            y = band.y + band.h + 1,
            yText = 15;
console.log(band.y, band.h);

  // Condition on bandName used to resrict labeling the main band with only the
  // middle label - this is purely for aesthetics as the start and end labels
  // don't necessarily add much to the main band when the scrubber window is
  // active. To add the start and end labels back to the timeFlow, remove the
  // check for bandName along with the false branch.

  // labelDefs[<element id>, <element class>, <rect x position>, <text x position>,
  //           <fcn returning text value>, <tooltip text>, <tooltip x offset>,
  //           <tooltip y offset>]

        var labelDefs = (bandName === "birdView") ? [
            ["start", "bandBoundLabel", 0, labelWidth / 4,
                function(min, max) { return toYear(min); },
                "Beginning of timeline", band.x + 90, tooltipTop],
            ["end", "bandBoundLabel", band.w - labelWidth, band.w - labelWidth / 4,
                function(min, max) { return toYear(max); },
                "Ending of timeline", band.x + band.w - 160, tooltipTop],
            ["range", "bandRangeLabel", (band.w - labelWidth) / 2, band.w / 2 - labelWidth / 4,
                function(min, max) { return max.getUTCFullYear() - min.getUTCFullYear(); },
                "Range of timeline", band.x + band.w / 2 + 65, tooltipTop]] :
            // if bandName = timeFlow then only set the scrubber range and reference
            // instant label
            [["scrubWindow", "bandRangeLabel", 0, labelWidth / 3,
                function(min, max) { return max.getUTCFullYear() - min.getUTCFullYear(); },
                "Range of scrubber window", timelineGeometry.margin.left + labelWidth + 20,
              timelineGeometry.infoFlowHeight + 5],
              ["reference", "bandReferenceLabel", (band.w - labelWidth) / 2,
                 band.w / 2 - labelWidth / 3,
                 function(min, max) {
//console.log("min:", min.getTime(), "max:", max.getTime(), "ms:", (max.getTime() - min.getTime())/2 + min.getTime(), "Date:", (new Date((max.getTime() - min.getTime())/2 + min.getTime())).toString());
                   return (new Date(((max.getTime() - min.getTime())/2 + min.getTime()))).toUTCString();},
//                   return (((max.getUTCFullYear() + (max.getUTCMonth() + max.getUTCDate()/32)/12) -
//                        (min.getUTCFullYear() + (min.getUTCMonth() + min.getUTCDate()/32)/12))/2 +
//                        min.getUTCFullYear() + (min.getUTCMonth() + min.getUTCDate()/32)/12);},
                 "Reference Instant", timelineGeometry.maxWidth/2 + labelWidth,
               timelineGeometry.infoFlowHeight + 5]
            ];

        var bandLabels = chart.append("g")
            .attr("id", bandName + "Labels")

    // Check for timeFlow and if so, translate the y coordinate to place
    // timeFlow labels in the top margin and birdView labels in
    // the bottom margin.

            .attr("transform", "translate(0," + ((bandName === "timeFlow") ? "-" + timelineGeometry.margin.top :
              timelineGeometry.flowHeight("timeFlow", true) +
              timelineGeometry.flowHeight("birdView", true) +
              timelineGeometry.axisHeight( ) * 2) + ")")
            .selectAll("#" + bandName + "Labels")
            .data(labelDefs)
            .enter().append("g")
            .on("mouseover", function(d) {
                tooltip.html(d[5])
                    .style("top", d[7] + "px")
                    .style("left", d[6] + "px")
                    .style("visibility", "visible");
                })
            .on("mouseout", function(){
                tooltip.style("visibility", "hidden");
            });

        bandLabels.append("rect")
            .attr("class", "bandLabel")
            .attr("x", function(d) { return d[2];})
            .attr("width", labelWidth)
            .attr("height", labelHeight)
            .style("opacity", 1);

        var labels = bandLabels.append("text")
            .attr("class", function(d) { return d[1];})
            .attr("id", function(d) { return d[0];})
            .attr("x", function(d) { return d[3];})
            .attr("y", yText)
            .attr("text-anchor", function(d) { return d[0];});

        labels.redraw = function () {
            var min = band.xScale.domain()[0],
                max = band.xScale.domain()[1];

            labels.text(function (d) { return (isString(d[4](min, max)) ?
              d[4](min, max) : d[4](min, max).toFixed(1)); })
        };

        band.parts.push(labels);
        components.push(labels);

        //console.log("labels d:", bandName);

        return timeline;
    };

    //----------------------------------------------------------------------
    //
    // tooltips
    //

    timeline.tooltips = function (bandName) {

        var band = bands[bandName];

        band.addActions([
            // trigger, function
            ["mouseover", showTooltip],
            ["mouseout", hideTooltip]
        ]);

        function getHtml(element, d) {
            var html;
            if (element.attr("class") == "interval") {
                html = d.label + "<br>" + toYear(d.start) + " - " + toYear(d.end);
            } else {
                html = d.label + "<br>" + toYear(d.start);
            }
            return html;
        }

        function showTooltip (d) {

            var x = event.pageX < band.x + band.w / 2
                    ? event.pageX + 10
                    : event.pageX - 110,
                y = event.pageY < band.y + band.h / 2
                    ? event.pageY + 30
                    : event.pageY - 30;

            tooltip
                .html(getHtml(d3.select(this), d))
                .style("top", y + "px")
                .style("left", x + "px")
                .style("visibility", "visible");
        }

        function hideTooltip () {
            tooltip.style("visibility", "hidden");
        }

        return timeline;
    };

    //----------------------------------------------------------------------
    //
    // xAxis
    //

    timeline.xAxis = function (bandName, orientation) {

        var band = bands[bandName];

        var axis = d3.svg.axis()
            .scale(band.xScale)
            .orient(orientation || "bottom")
            .tickSize(6, 0)
            .tickFormat(function (d) { return toYear(d); });

        chart = svg.select("g");

        var xAxis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + (
              timelineGeometry.flowHeight("timeFlow", true) +
              timelineGeometry.axis.margin.top +
              ((bandName === "timeFlow") ? 0 : timelineGeometry.flowHeight("birdView", true) +
               timelineGeometry.axisHeight())) + ")");
console.log("band.y:", band.y, "band.h:", band.h);

        xAxis.redraw = function () {
            xAxis.call(axis);
        };

        band.parts.push(xAxis); // for brush.redraw
        components.push(xAxis); // for timeline.redraw

        return timeline;
    };

    //----------------------------------------------------------------------
    //
    // move
    //

//    timeline.hScroll = function () {
//      console.log("timeline.hScroll");
//      bandTF.g.attr("transform", "translate(0,-" + Math.round(brush.extent()[0]) + ")");
//                      band.g.attr("transform", "translate(" + Math.round(brush.extent()[0]) + ",0)");

//    };

    //----------------------------------------------------------------------
    //
    // brush
    //

    timeline.brush = function (bandName, targetNames) {

        var band = bands[bandName];
        var xBrushWidth = 0;
        var brush = d3.svg.brush()
            .x(band.xScale.range([0, band.w]))
            .on("brush", function() {
                var domain = brush.empty() ? band.xScale.domain() : brush.extent();
  //              console.log("extent:", brush.extent(), " domain:", domain);
                timelineGeometry.brushExtent = domain;
                targetNames.forEach(function(d) {
                    bands[d].xScale.domain(domain);
  //                  xBrushWidth = d3.select(".extent").attr("width");
  //                  if (xBrushWidth != savedXbrushWidth) {
                      bands[d].redraw();
  //                  } else {
  //                    console.log(bands[d]);
  //                    timeline.hScroll();
                //      bands[d].hScroll();
                })
              });
//            })
//            .on("brushend", function() {
//              savedXbrushWidth = xBrushWidth;
//              console.log("saved width:", savedXbrushWidth);
//              console.log("width:", d3.select(".extent").attr("width"));

// To place the brush element within the band it accompanies, swap in the following
// xBrush declaration and then remove the transform translate attribute on the
// xBrush rect selection below. We should also redefine the clip area for the
// birdview (add the top & bottom margins back) to prevent clipping the top and
// bottom brush outlines.
//      var xBrush = band.g.append("svg")
        var xBrush = svg.select("g").append("svg")
            .attr("class", "xBrush")
            .call(brush);

        xBrush.selectAll("rect")
            .attr("y", 0)
            .attr("height", timelineGeometry.flowHeight("birdView", true))
// Remove this transform when locating brush under the band element
            .attr("transform", "translate(0," + (timelineGeometry.flowHeight("timeFlow", true) +
                timelineGeometry.axisHeight( )) + ")");

        return timeline;
    };

    //----------------------------------------------------------------------
    //
    // vscroll
    //

    timeline.vScroll = function ( ) {
      if (timelineGeometry.totalTracks > timelineGeometry.timeFlow.maxTracks) {

        var bandTF = bands["timeFlow"];
        var bandBV = bands["birdView"];

        var yTFScrollScale = d3.scale.linear()
            .domain([0, timelineGeometry.flowHeight("timeFlow", false)])
            .range([0, timelineGeometry.flowHeight("timeFlow", true)]);

        var yBVRange = d3.scale.linear()
            .domain([0, (timelineGeometry.flowHeight("timeFlow", false) - timelineGeometry.flowHeight("timeFlow", true))])
            .range([0, timelineGeometry.totalTracks - timelineGeometry.birdView.maxTracks]);

  //console.log("band:", band);
        var brush = d3.svg.brush()
            .y(yTFScrollScale)
            .extent([0, timelineGeometry.flowHeight("timeFlow", true)])
            .on("brush", function() {
                bandTF.g.attr("transform", "translate(0,-" + Math.round(brush.extent()[0]) + ")");

                if (timelineGeometry.totalTracks > timelineGeometry.birdView.maxTracks) {
                  bandBV.g.attr("transform", "translate(0," +
                  (bandBV.y - Math.round(yBVRange(brush.extent()[0]))) + ")");
                }
            });

        var yBrush = svg.select("g").append("svg")
            .attr("class", "yBrush")
            .call(brush);

        yBrush.select(".background")
            .attr("style", "visibility: visible; cursor: none;")
            .attr("x", bandTF.w + timelineGeometry.vScroll.margin.left);

        yBrush.select(".extent")
            .attr("x", bandTF.w + timelineGeometry.vScroll.margin.left + 1);

        yBrush.selectAll(".resize").remove();
      };
      return timeline;
    };

// mainReference draws the center reference line on the timeline. This is the
// reference point for the center of the infoFlow.

    timeline.mainReference = function(bandName) {
      var band = bands[bandName];

      var mainReference = chart.append("g")
          .attr("class", "referenceline")
          .append("line")
          .attr("x1", band.w/2)
          .attr("y1", 0)
          .attr("x2", band.w/2)
          .attr("y2", band.h);
        return timeline;
    };

    //----------------------------------------------------------------------
    //
    // redraw
    //

    timeline.redraw = function () {
//      console.log("timeline.redraw")
        components.forEach(function (component) {
            component.redraw();
        })
    };


    //--------------------------------------------------------------------------
    //
    // Utility functions
    //

    function parseDate(dateString, aFormatString) {
        // 'dateString' must either conform to the ISO date format YYYY-MM-DD
        // or be a full year without month and day.
        // AD years may not contain letters, only digits '0'-'9'!
        // Invalid AD years: '10 AD', '1234 AD', '500 CE', '300 n.Chr.'
        // Valid AD years: '1', '99', '2013'
        // BC years must contain letters or negative numbers!
        // Valid BC years: '1 BC', '-1', '12 BCE', '10 v.Chr.', '-384'
        // A dateString of '0' will be converted to '1 BC'.
        // Because JavaScript can't define AD years between 0..99,
        // these years require a special treatment.
        var formatString = aFormatString || "%Y-%m-%d";
//        console.log(formatString);
//        var format = d3.time.format("%Y-%m-%d"),
        var format = d3.time.format(formatString),
            date,
            year;

        date = format.parse(dateString);
        if (date !== null) return date;
//console.log("date null first pass");
        // BC yearStrings are not numbers!
        if (isNaN(dateString)) { // Handle BC year
            // Remove non-digits, convert to negative number
            year = -(dateString.replace(/[^0-9]/g, ""));
        } else { // Handle AD year
            // Convert to positive number
            year = +dateString;
        }
        if (year < 0 || year > 99) { // 'Normal' dates
            date = new Date(year, 6, 1);
        } else if (year == 0) { // Year 0 is '1 BC'
            date = new Date (-1, 6, 1);
        } else { // Create arbitrary year and then set the correct year
            // For full years, I chose to set the date to mid year (1st of July).
            date = new Date(year, 6, 1);
            date.setUTCFullYear(("0000" + year).slice(-4));
        }
        // Finally create the date
        return date;
    }

    function toYear(date, bcString) {
        // bcString is the prefix or postfix for BC dates.
        // If bcString starts with '-' (minus),
        // if will be placed in front of the year.
        bcString = bcString || " BC" // With blank!
        var year = date.getUTCFullYear();
//        if (year > 0) return year.toString();
        if (year > 0) return year;
        if (bcString[0] == '-') return bcString + (-year);
        return (-year) + bcString;
    }

    return timeline;
}
