/*
 * Zoomer [Formstone Library]
 * @author Ben Plum
 * @version 0.2.0
 *
 * Copyright © 2013 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */
 
if (jQuery) (function($) {
	
	// Default Options
	var options = {
		controls: {
			position: "bottom",
			zoomIn: null,
			zoomOut: null,
			next: null,
			previous: null
		},
		customClass: "",
		enertia: 0.2, // ~smoothness - 0.1 = butter, 0.9 = sandpaper
		increment: 0.02, // ~speed - 0.1 = hare, 0.01 = tortoise 
		margin: 100,
		retina: false
	};
	
	// Internal data
	var properties = {
		action: "",
		lastAction: "",
		keyDownTime: 0,
		
		// Frame 
		centerLeft: 0,
		centerTop: 0,
		frameHeight: 0,
		frameWidth: 0,
		
		// Bounds
		minHeight: null,
		minWidth: null,
		maxHeight: 0,
		maxWidth: 0,
		marginReal: 0,
		
		// Original image
		originalHeight: 0,
		originalWidth: 0,
		imageRatioWide: 0,
		imageRatioTall: 0,
		
		// Tagrget image
		targetImageWidth: 0, 
		targetImageHeight: 0,
		targetImageLeft: 0,
		targetImageTop: 0,
		
		// Cached image
		imageWidth: 0, 
		imageHeight: 0,
		imageLeft: 0,
		imageTop: 0,
		
		// Tagrget positioner
		targetPositionerLeft: 0,
		targetPositionerTop: 0,
		
		// Cached positioner
		positionerLeft: 0,
		positionerTop: 0,
		
		// Bounds
		boundsTop: 0,
		boundsBottom: 0,
		boundsLeft: 0,
		boundsRight: 0
	};
	
	// Internal Data
	var animating = false,
		$instances;
	
	// Public Methods
	var pub = {
		
		// Set Defaults
		defaults: function(opts) {
			options = $.extend(options, opts || {});
			return $(this);
		},
		
		// Destroy Zoomer
		destroy: function() {
			$(this).each(function() {
				var data = $(this).data("zoomer");
				
				data.$target.removeClass("zoomer-element")
							.data("zoomer", null);
				data.$holder.off(".zoomer");
				data.$zoomer.remove();
				
				data.controls.$zoomIn.off(".zoomer");
				data.controls.$zoomOut.off(".zoomer");
			});
			
			$instances = $(".zoomer-element");
			if ($instances.length < 1) {
				_clearAnimation();
			}
			
			return $(this);
		},
		
		// Load new image
		load: function(source) {
			return $(this).each(function() {
				var data = $(this).data("zoomer");
				
				if (typeof source == "string") {
					data.images = [source];
				} else {
					data.images = source;
				}
				data.index = 0;
				
				_load(data);
			});
		},
		
		// Resize zoomer
		resize: function() {
			return $(this).each(function() {
				var data = $(this).data("zoomer");
				
				if (typeof data != 'undefined') {
					data.frameWidth = data.$target.outerWidth();
					data.frameHeight = data.$target.outerHeight();
					data.centerLeft = data.frameWidth / 2;
					data.centerTop = data.frameHeight / 2;
					
					_setMinimums(data);
				}
			});
		},
		
		// Unload image
		unload: function() {
			return $(this).each(function() {
				var data = $(this).data("zoomer");
				
				if (typeof data.$image != 'undefined') {
					data.$image.remove();
				}
			});
		}
	};
	
	// Initialize
	function _init(opts) {
		var data = $.extend({}, options, properties, opts);
		
		var $targets = $(this);
		for (var i = 0, count = $targets.length; i < count; i++) {
			_build.apply($targets.eq(i), [ $.extend({}, data) ]);
		}
		
		// kick it off
		$instances = $(".zoomer-element");
		_startAnimation();
		
		// Maintain chainability
		return $targets;
	}
	
	function _build(data) {
		data.$target = $(this);
		
		data.marginReal = data.margin * 2;
		data.index = 0;
		data.images = [];
		data.$target.find("img").each(function() {
			data.images.push($(this).attr("src"));
		});
		
		// Assemble HTML
		var html = '<div class="zoomer ' + data.customClass;
		if (data.images.length > 1) {
			html += ' zoomer-gallery';
		}
		html += '">';
		html += '<div class="zoomer-positioner">';
		html += '<div class="zoomer-holder">';
		html += '</div>';
		html += '</div>';
		html += '</div>';
		
		data.$zoomer = $(html);
		data.$target.addClass("zoomer-element")
					.html(data.$zoomer);
		
		if (data.controls.zoomIn || data.controls.zoomOut || data.controls.next || data.controls.previous) {
			data.controls.$zoomIn = $(data.controls.zoomIn);
			data.controls.$zoomOut = $(data.controls.zoomOut);
			data.controls.$next = $(data.controls.next);
			data.controls.$previous = $(data.controls.previous);
		} else {
			
			html = '<div class="zoomer-controls zoomer-controls-' + data.controls.position + '">';
			if (data.images.length > 1) {
				html += '<span class="zoomer-previous">&lsaquo;</span>';
			}
			html += '<span class="zoomer-zoom-out">-</span>';
			html += '<span class="zoomer-zoom-in">+</span>';
			if (data.images.length > 1) {
				html += '<span class="zoomer-next">&rsaquo;</span>';
			}
			html += '</div>';
			
			data.$zoomer.append(html);
			
			data.controls.$default = data.$zoomer.find(".zoomer-controls");
			data.controls.$zoomIn = data.$zoomer.find(".zoomer-zoom-in");
			data.controls.$zoomOut = data.$zoomer.find(".zoomer-zoom-out");
			data.controls.$next = data.$zoomer.find(".zoomer-next");
			data.controls.$previous = data.$zoomer.find(".zoomer-previous");
		}
		
		// Cache jquery objects
		data.$positioner = data.$zoomer.find(".zoomer-positioner");
		data.$holder = data.$zoomer.find(".zoomer-holder");
		
		// Bind events
		//$(window).on("resize.zoomer", _onResize);
				 //.on("keydown.zoomer", _keypress);
		
		data.controls.$zoomIn.on("mousedown.zoomer", data, _zoomIn)
							 .on("mouseup.zoomer", data, _clearZoom);
		data.controls.$zoomOut.on("mousedown.zoomer", data, _zoomOut)
							  .on("mouseup.zoomer", data, _clearZoom);
		data.controls.$next.on("click", data, _nextImage);
		data.controls.$previous.on("click", data, _previousImage);
		data.$zoomer.on("touchstart.zoomer MSPointerDown.zoomer", ":not(.zoomer-controls)", data, _onTouch);
		
		// Kick it off
		data.$target.data("zoomer", data);
		pub.resize.apply(data.$target);
		
		if (data.images.length > 0) {
			_loadImage.apply(data.$target, [ data, data.images[0] ]);
		}
	}
	
	function _nextImage(e) {
		var data = e.data;
		
		if (!data.loading && data.index+1 < data.images.length) {
			data.index++;
			_load.apply(data.$target, [ data ]);
		}
	}
	function _previousImage(e) {
		var data = e.data;
		
		if (!data.loading && data.index-1 >= 0) {
			data.index--;
			_load.apply(data.$target, [ data ]);
		}
	}
	
	function _load(data) {
		if (typeof data.$image != "undefined") {
			data.$image.animate({ opacity: 0 }, 300, function() {
				pub.unload.apply(data.$target);
				_loadImage.apply(data.$target, [ data, data.images[data.index] ]);
			});
		} else {
			_loadImage.apply(data.$target, [ data, data.images[data.index] ]);
		}
	}
	
	function _loadImage(data, source) {
		data.loading = false;
		
		// Cache current image
		data.$image = $('<img style="opacity: 0;" />');
		
		data.$image.one("load.zoomer", data, _onImageLoad)
				   .attr("src", source)
				   .addClass("zoomer-image");
		
		// If image has already loaded into cache, trigger load event
		if (data.$image[0].complete) {
			data.$image.trigger("load");
		}
	}
	
	// Handle image load
	function _onImageLoad(e) {
		var data = e.data;
		
		data.originalHeight = data.$image[0].naturalHeight;
		data.originalWidth = data.$image[0].naturalWidth;
		
		if (data.retina) {
			data.originalHeight /= 2;
			data.originalWidth /= 2;
		}
		
		data.targetImageHeight = data.originalHeight;
		data.targetImageWidth = data.originalWidth;
		
		data.maxHeight = data.originalHeight;
		data.maxWidth = data.originalWidth;
		
		data.imageRatioWide = data.originalWidth / data.originalHeight;
		data.imageRatioTall = data.originalHeight / data.originalWidth;
		
		// Initial sizing to fit screen
		if (data.originalHeight > (data.frameHeight - data.marginReal) || data.originalWidth > (data.frameWidth - data.marginReal)) {
			_setMinimums(data);
			data.targetImageHeight = data.minHeight;
			data.targetImageWidth = data.minWidth;
		}
		
		data.positionerLeft = data.targetPositionerLeft = data.centerLeft;
		data.positionerTop = data.targetPositionerTop = data.centerTop;
		
		data.imageLeft = -data.targetImageWidth / 2;
		data.imageTop = -data.targetImageHeight / 2;
		data.imageHeight = data.targetImageHeight;
		data.imageWidth = data.targetImageWidth;
		
		data.$positioner.css({ 
			left: data.positionerLeft,
			top: data.positionerTop
		});
		
		data.$holder.css({
			left: data.imageLeft,
			top: data.imageTop,
			height: data.imageHeight,
			width: data.imageWidth
		}).append(data.$image)
		  .on("mousedown.zoomer", data, _dragStart);
		
		data.$image.animate({ opacity: 1 }, 300);
		
		data.loading = false;
	}
	
	// Set minimum values
	function _setMinimums(data) {
		if (data.originalHeight > data.originalWidth) {
			// Tall
			data.aspect = "tall";
			
			data.minHeight = data.frameHeight - data.marginReal;
			data.minWidth = data.minHeight / data.imageRatioTall;
			
			if (data.minWidth > (data.frameWidth - data.marginReal)) {
				data.minWidth = data.frameWidth - data.marginReal;
				data.minHeight = data.minWidth / data.imageRatioWide;
			}
			
			data.step = (data.maxWidth - data.minWidth) / 100;
		} else {
			// Wide
			data.aspect = "wide";
			
			data.minWidth = data.frameWidth - data.marginReal;
			data.minHeight = data.minWidth / data.imageRatioWide;
			
			if (data.minHeight > (data.frameHeight - data.marginReal)) {
				data.minHeight = data.frameHeight - data.marginReal;
				data.minWidth = data.minHeight / data.imageRatioTall;
			}
			
			data.step = (data.maxHeight - data.minHeight) / 100;
		}
	}
	
	
	// Handle animation rendering
	function _render() {
		for (var i = 0, count = $instances.length; i < count; i++) {
			var data = $instances.eq(i).data("zoomer");
			
			if (typeof data != "null") {
				// Handle mouse actions
				if (data.action != "") {
					data = _updateAction(data);
				}
				data = _checkMaxMin(data);
				data = _checkBounds(data);
				
				if (data.imageWidth != data.targetImageWidth || data.positionLeft != data.targetPositionerLeft) {
					// Cache animation values 
					data = _calculateDimensions(data);
					
					// Update animation values
					data.$positioner.css({
						left: data.positionerLeft,
						top: data.positionerTop
					});
					
					data.$holder.css({
						left: data.imageLeft,
						top: data.imageTop,
						height: data.imageHeight,
						width: data.imageWidth
					});
				}
				
				data.lastAction = data.action;
			}
		}
	}
	
	// Update values based on current action 
	function _updateAction(data) {
		// Calculate change
		data.keyDownTime += data.increment;
		var delta = (data.imageWidth * data.keyDownTime) - data.imageWidth;
		
		if (data.action == "zoom_in") {
			// IN
			if (data.aspect == "tall") {
				data.targetImageHeight += delta;
				data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
			} else {
				data.targetImageWidth += delta;
				data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
			}
		} else if (data.action == "zoom_out") {
			// OUT
			if (data.aspect == "tall") {
				data.targetImageHeight -= delta;
				data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
			} else {
				data.targetImageWidth -= delta;
				data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
			}
		}
		
		return data;
	}
	
	// Check Max and Min image values; recenter if too small
	function _checkMaxMin(data) {
		// Check min and max 
		if (data.aspect == "tall") {
			if (data.targetImageHeight < data.minHeight) {
				data.targetImageHeight = data.minHeight;
				data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
			} else if (data.targetImageHeight > data.maxHeight) {
				data.targetImageHeight = data.maxHeight;
				data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
			}
		} else {
			if (data.targetImageWidth < data.minWidth) {
				data.targetImageWidth = data.minWidth;
				data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
			} else if (data.targetImageWidth > data.maxWidth)  {
				data.targetImageWidth = data.maxWidth;
				data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
			}
		}
		
		// Recenerting when image is too small
		if (data.action == "zoom_out" || data.lastAction == "zoom_out") {
			data.targetPositionerLeft += (data.positionerLeft < data.centerLeft) ? 5 : -5;
			data.targetPositionerTop += (data.positionerTop < data.centerTop) ? 5 : -5;
			
			var checkLeft = (data.positionerLeft < data.centerLeft) ? "less" : "more";
			var checkTop = (data.positionerTop < data.centerTop) ? "less" : "more";
			
			if ( (checkLeft == "less" && data.targetPositionerLeft > data.centerLeft) ||
				 (checkLeft == "more" && data.targetPositionerLeft < data.centerLeft) ) {
				data.targetPositionerLeft = data.centerLeft;
				data.targetPositionerLeft = data.centerleft;
			}
			if ( (checkTop == "less" && data.targetPositionerTop > data.centerTop) || 
				 (checkTop == "more" && data.targetPositionerTop < data.centerTop) ) {
				data.targetPositionerTop = data.centerTop;
			}
		}
		
		return data;
	}
	
	// Check bounds of current position and if big enough to drag
	function _checkBounds(data) {
		// Set bounds
		data.boundsTop = data.frameHeight - (data.targetImageHeight * 0.5) - options.margin;
		data.boundsBottom = (data.targetImageHeight * 0.5) + options.margin;
		data.boundsLeft = data.frameWidth - (data.targetImageWidth * 0.5) - options.margin;
		data.boundsRight = (data.targetImageWidth * 0.5) + options.margin;
		
		// Check dragging bounds 
		if (data.targetPositionerLeft < data.boundsLeft) {
			data.targetPositionerLeft = data.boundsLeft;
		}
		if (data.targetPositionerLeft > data.boundsRight) {
			data.targetPositionerLeft = data.boundsRight;
		}
		if (data.targetPositionerTop < data.boundsTop) {
			data.targetPositionerTop = data.boundsTop;
		}
		if (data.targetPositionerTop > data.boundsBottom) {
			data.targetPositionerTop = data.boundsBottom;
		}
		
		// Check if big enough to actually drag
		if (data.targetImageWidth < data.frameWidth) {
			data.targetPositionerLeft = data.centerLeft;
		}
		if (data.targetImageHeight < data.frameHeight) {
			data.targetPositionerTop = data.centerTop;
		}
		
		return data;
	}
	
	// Calculate new values
	function _calculateDimensions(data) {
		data.targetImageTop = -data.targetImageHeight / 2;
		data.targetImageLeft = -data.targetImageWidth / 2;
		
		var enertia = (data.action == "pinch" || data.action == "touch") ? 0.5 : data.enertia;
		
		/* if (data.action != "pinch") { */
			data.imageWidth += (data.targetImageWidth - data.imageWidth) * enertia;
			data.imageHeight += (data.targetImageHeight - data.imageHeight) * enertia;
			data.imageLeft += (data.targetImageLeft - data.imageLeft) * enertia;
			data.imageTop += (data.targetImageTop - data.imageTop) * enertia;
		/*
		} else {
			data.imageWidth = data.targetImageWidth;
			data.imageHeight = data.targetImageHeight;
			data.imageLeft = data.targetImageLeft;
			data.imageTop = data.targetImageTop;
		}
		*/
		
		if (data.action != "drag" && data.action != "pinch") {
			data.positionerLeft += (data.targetPositionerLeft - data.positionerLeft) * enertia;
			data.positionerTop += (data.targetPositionerTop - data.positionerTop) * enertia;
		} else {
			data.positionerLeft = data.targetPositionerLeft;
			data.positionerTop = data.targetPositionerTop;
		}
		
		return data;
	}
	
	// Zoom click
	function _zoomIn(e) {
		var data = e.data;
		data.keyDownTime = 1;
		data.action = "zoom_in";
	}
	
	// Zoom click
	function _zoomOut(e) {
		var data = e.data;
		data.keyDownTime = 1;
		data.action = "zoom_out";
	}
	
	// Kill zoom
	function _clearZoom(e) {
		var data = e.data;
		data.keyDownTime = 0;
		data.action = "";
	}
	
	// Start dragging
	function _dragStart(e) {
		if (e.preventDefault) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		var data = e.data;
		data.action = "drag";
		
		data.mouseX = e.pageX;
		data.mouseY = e.pageY;
		
		$(window).on("mousemove.zoomer", data, _onDrag)
				 .on("mouseup.zoomer", data, _dragStop);
	}
	
	// Handle dragging
	function _onDrag(e) {
		if (e.preventDefault) {
			e.preventDefault();
			e.stopPropagation();
		}
		
		var data = e.data;
		
		data.targetPositionerLeft -= (data.mouseX - e.pageX);
		data.targetPositionerTop -= (data.mouseY - e.pageY);
		
		data.mouseX = e.pageX;
		data.mouseY = e.pageY;
	}
	
	// Stop dragging
	function _dragStop(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		data.action = "";
		
		$(window).off(".zoomer");
	}
	
	// Normalize touch events then delegate action
	function _onTouch(e) {
		if ($(e.target).parent(".zoomer-controls").length > 0) {
			return;
		}
		
		// Stop ms panning and zooming
		if (e.preventManipulation) {
			e.preventManipulation();
		}
		e.preventDefault();
		
		var data = e.data,
			oe = e.originalEvent;
		
		// Check for existing touches
		data.touches = (data.touches) ? data.touches : [];
		
		// Handle touch ends
		if (oe.type.match(/(up|end)$/i)) {
			_onTouchEnd(data);
			return;
		}
		
		if (oe.pointerId) {
			// Normalize MS pointer events back to standard touches
			var activeTouch = false
			for (var i in data.touches) {
				if (data.touches[i].identifier == oe.pointerId) {
					activeTouch = true;
					data.touches[i].pageX = oe.clientX;
					data.touches[i].pageY = oe.clientY;
				}
			}
			if (!activeTouch) {
				data.touches.push({
					identifier: oe.pointerId,
					pageX: oe.clientX,
					pageY: oe.clientY
				});
			}
		} else {
			// Alias normal touches
			data.touches = oe.touches;
		}
		
		// Delegate touch actions
		if (oe.type.match(/(down|start)$/i)) {
			_onTouchStart(data);
		} else if (oe.type.match(/move$/i)) {
			_onTouchMove(data);
		}
	}
	
	// Handle touch start
	function _onTouchStart(data) {
		// Touch events
		$(window).on("touchmove.zoomer MSPointerMove.zoomer", data, _onTouch)
				 .on("touchend.zoomer MSPointerUp.zoomer", data, _onTouch);
		
		data.action = "";
		data.currentContinuousZoom = 1;
		
		if (data.touches.length == 1) {
			// Single touch - drag
			_dragStart({
				data: data,
				pageX: data.touches[0].pageX,
				pageY: data.touches[0].pageY
			});
			data.action = "touch";
		} else if (data.touches.length >= 2) {
			// Double touch - zoom
			data.startX0 = data.touches[0].pageX;
			data.startY0 = data.touches[0].pageY;
			data.startX1 = data.touches[1].pageX;
			data.startY1 = data.touches[1].pageY;
			
			data.centerPointStartX = ((data.startX0 + data.startX1) / 2);
			data.centerPointStartY = ((data.startY0 + data.startY1) / 2);
			data.percentageOfImageAtPinchPointX = (data.centerPointStartX - data.positionerLeft) / data.imageWidth;
			data.percentageOfImageAtPinchPointY = (data.centerPointStartY - data.positionerTop) / data.imageHeight;
			data.startPinchDistance = Math.sqrt(Math.pow((data.startX1 - data.startX0), 2) + Math.pow((data.startY1 - data.startY0), 2));
		}
	}
	
	// Handle touch move
	function _onTouchMove(data) { 
		if (data.touches.length == 1) {
			// Single touch - drag
			_onDrag({
				data: data,
				pageX: data.touches[0].pageX,
				pageY: data.touches[0].pageY
			});
		} else if (data.touches.length >= 2) {
			// Double touch - zoom
			// Only if we've actually move our touches
			data.action = "pinch";
			if (data.endX0 != data.touches[0].pageX && data.endY0 != data.touches[0].pageY && data.endX1 != data.touches[1].pageX && data.endY1 != data.touches[1].pageY) {
				data.endX0 = data.touches[0].pageX;
				data.endY0 = data.touches[0].pageY;
				data.endX1 = data.touches[1].pageX;
				data.endY1 = data.touches[1].pageY;
				
				data.endPinchDistance = Math.sqrt(Math.pow((data.endX1 - data.endX0), 2) + Math.pow((data.endY1 - data.endY0), 2));
				data.newContinuousZoom = (data.endPinchDistance / data.startPinchDistance) * data.currentContinuousZoom;
				data.targetImageWidth = data.imageWidth * data.newContinuousZoom;
				data.targetImageHeight = data.imageHeight * data.newContinuousZoom;
				
				data = _checkMinMax(data);
				
				data.centerPointEndX = ((data.endX0 + data.endX1) / 2);
				data.centerPointEndY = ((data.endY0 + data.endY1) / 2);
				
				data.translateFromZoomingX = (data.imageWidth - data.targetImageWidth) * data.percentageOfImageAtPinchPointX;
				data.translateFromZoomingY = (data.imageHeight - data.targetImageHeight) * data.percentageOfImageAtPinchPointY;
				
				data.translateFromTranslatingX = 0; //data.centerPointEndX - data.centerPointStartX;
				data.translateFromTranslatingY = 0; //data.centerPointEndY - data.centerPointStartY;
				
				data.translateTotalX = data.translateFromZoomingX + data.translateFromTranslatingX;
				data.translateTotalY = data.translateFromZoomingY + data.translateFromTranslatingY;
				
				data.targetPositionerLeft = data.positionerLeft + data.translateTotalX;
				data.targetPositionerTop = data.positionerTop + data.translateTotalY;
			}
		}
    }
    
    // Hanlde touch end
	function _onTouchEnd(data) {
		data.touches = [];
		data.currentContinuousZoom = data.newContinuousZoom;
		
		// Clear touch events
		$(window).off(".zoomer");
	}
	
	// Start animation loop
	function _startAnimation() {
		if (!animating) {
			animating = true;
			_onAnimate();
		}
	}
	
	// Kill animation loop 
	function _clearAnimation() {
		animating = false;
	}
	
	// Handle animation loop
	function _onAnimate() {
		if (animating) {
			window.requestAnimationFrame(_onAnimate);
			_render();
		}
	}
	
	// Define Plugin
	$.fn.zoomer = function(method) {
		if (pub[method]) {
			return pub[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return _init.apply(this, arguments);
		}
		return this;	
	};
})(jQuery);


// Request Animation Frame Polyfill 
// Paul Irish <https://gist.github.com/paulirish/1579671>
(function() {
	var lastTime = 0;
	var vendors = ['webkit', 'moz'];
	for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
	}
	
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	}
	
	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
	}
}());