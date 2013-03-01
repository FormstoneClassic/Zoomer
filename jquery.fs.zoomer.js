/*
 * Zoomer [Formstone Library]
 * @author Ben Plum
 * @version 0.1.3
 *
 * Copyright © 2012 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */
 
if (jQuery) (function($) {
	
	// Default Options
	var options = {
		controls: {
			position: "bottom",
			zoomIn: null,
			zoomOut: null
		},
		customClass: "",
		increment: 0.05, // ~speed - 0.1 = hare, 0.01 = tortoise 
		interval: 0.2, // ~smoothness - 0.1 = butter, 0.9 = sandpaper
		margin: 100,
		retina: false,
		source: null
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
	var animationId = null,
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
				
				if (typeof data.$image != "undefined") {
					data.$image.animate({ opacity: 0 }, 300, function() {
						pub.unload.apply(data.$target);
						_loadImage.apply(data.$target, [ data, source ]);
					});
				} else {
					_loadImage.apply(data.$target, [ data, source ]);
				}
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
				if (typeof data.controls.$default != 'undefined') {
					data.controls.$default.removeClass("active");
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
		
		// Assemble HTML
		data.$zoomer = $('<div class="zoomer ' + data.customClass + '"><div class="zoomer-positioner"><div class="zoomer-holder"></div></div></div>');
		data.$target.addClass("zoomer-element")
					.append(data.$zoomer);
		
		if (data.controls.zoomIn && data.controls.zoomOut) {
			data.controls.$zoomIn = $(data.controls.zoomIn);
			data.controls.$zoomOut = $(data.controls.zoomOut);
		} else {
			data.$zoomer.append('<div class="zoomer-controls zoomer-controls-' + data.controls.position + '"><span class="zoomer-zoom-out">-</span><span class="zoomer-zoom-in">+</span></div>');
			
			data.controls.$default = data.$zoomer.find(".zoomer-controls");
			data.controls.$zoomIn = data.$zoomer.find(".zoomer-zoom-in");
			data.controls.$zoomOut = data.$zoomer.find(".zoomer-zoom-out");
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
		
		data.marginReal = data.margin * 2;
		
		// Kick it off
		data.$target.data("zoomer", data);
		pub.resize.apply(data.$target);
		
		if (data.source) {
			pub.load.apply(data.$target, [ data.source ]);
		}
	}
	
	function _loadImage(data, source) {
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
		
		data.originalHeight = data.$image[0].height;
		data.originalWidth = data.$image[0].width;
		
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
		
		if (typeof data.controls.$default != 'undefined') {
			data.controls.$default.addClass("active");
		}
		
		data.$image.animate({ opacity: 1 }, 300);
	}
	
	function _render() {
		for (var i = 0, count = $instances.length; i < count; i++) {
			var data = $instances.eq(i).data("zoomer");
			
			if (typeof data != "null") {
				// Handle zoom actions
				if (data.action != "") {
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
				}
				
				// Recenting when image is too small
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
				
				// Set bounds
				data.boundsTop = data.centerTop - (data.targetImageHeight / 2);
				data.boundsBottom = data.centerTop + (data.targetImageHeight / 2);
				data.boundsLeft = data.centerLeft - (data.targetImageWidth / 2);
				data.boundsRight = data.centerLeft + (data.targetImageWidth / 2);
				
				if (data.imageWidth != data.targetImageWidth || data.positionLeft != data.targetPositionerLeft) {
					// Check if big enough to drag
					if (data.targetImageWidth < data.frameWidth) {
						data.targetPositionerLeft = data.centerLeft;
					}
					if (data.targetImageHeight < data.frameHeight) {
						data.targetPositionerTop = data.centerTop;
					}
					
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
					
					// Cache animation values 
					data.targetImageTop = -data.targetImageHeight / 2;
					data.targetImageLeft = -data.targetImageWidth / 2;
					
					data.imageWidth += (data.targetImageWidth - data.imageWidth) * data.interval;
					data.imageHeight += (data.targetImageHeight - data.imageHeight) * data.interval;
					data.imageLeft += (data.targetImageLeft - data.imageLeft) * data.interval;
					data.imageTop += (data.targetImageTop - data.imageTop) * data.interval;
					
					if (data.action != "drag") {
						data.positionerLeft += (data.targetPositionerLeft - data.positionerLeft) * data.interval;
						data.positionerTop += (data.targetPositionerTop - data.positionerTop) * data.interval;
					} else {
						data.positionerLeft = data.targetPositionerLeft;
						data.positionerTop = data.targetPositionerTop;
					}
					
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
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		data.action = "drag";
		
		data.mouseX = e.pageX;
		data.mouseY = e.pageY;
		
		$(window).on("mouseup.zoomer", data, _dragStop)
				 .on("mousemove.zoomer", data, _onDrag);
	}
	
	// Stop dragging
	function _dragStop(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		data.action = "";
		
		$(window).off(".zoomer");
	}
	
	// Handle dragging
	function _onDrag(e) {
		e.preventDefault();
		e.stopPropagation();
		
		var data = e.data;
		
		data.targetPositionerLeft -= (data.mouseX - e.pageX);
		data.targetPositionerTop -= (data.mouseY - e.pageY);
		
		data.mouseX = e.pageX;
		data.mouseY = e.pageY;
	}
	
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
	
	
	// Start animation loop
	function _startAnimation() {
		if (!animationId) {
			_onAnimate();
		}
	}
	
	// Kill animation loop 
	function _clearAnimation() {
		if (animationId) {
			clearTimeout(animationId);
			animationId = null;
		}
	}
	
	// Handle animation loop
	function _onAnimate() {
		// Better framerates with setTimeout!
		animationId = setTimeout(_onAnimate, 28);
		_render();
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