/*
 * Zoomer [Formstone Library]
 * @author Ben Plum
 * @version 0.0.1
 *
 * Copyright © 2012 Ben Plum <mr@benplum.com>
 * Released under the MIT License <http://www.opensource.org/licenses/mit-license.php>
 */
 
if (jQuery) (function($) {
	
	// Default Options
	var options = {
		animationSpeed: 300,
		controls: {
			$zoomIn: $(),
			$zoomOut: $()
		},
		customClass: "",
		retina: false
	};
	
	// Internal data
	var properties = {
		animationInterval: 0.2,
		
		action: "",
		lastAction: "",
		keyDownTime: 0,
		
		// Frame 
		centerLeft: 0,
		centerTop: 0,
		frameHeight: 0,
		frameWidth: 0,
		
		// Bounds
		minHeight: 100,
		minWidth: 100,
		maxHeight: 0,
		maxWidth: 0,
		padding: (100 * 2),
		
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
		iData = {
			instances: []
		};
	
	// Public Methods
	var pub = {
		
		// Set Defaults
		defaults: function(opts) {
			options = $.extend(options, opts || {});
			return $(this);
		},
		
		// Destroy Zoomer
		destroy: function() {
			data.$target.removeClass("zoomer-element")
						.data("zoomer", null);
			data.$zoomer.remove();
			
			data.controls.$zoomIn.off(".zoomer");
			data.controls.$zoomOut.off(".zoomer");
			
			_clearAnimation();
			
			return $(this).off(".zoomer");
		},
		
		// Load new image
		load: function(source) {
			var data = $(this).data("zoomer");
			
			if (typeof data.$image != "undefined") {
				data.$image.animate({ opacity: 0 }, data.animationSpeed, function() {
					pub.unload.apply(data.$target);
					_loadImage.apply(data.$target, [ data, source ]);
				});
			} else {
				_loadImage.apply(data.$target, [ data, source ]);
			}
		},
		
		// Resize zoomer
		resize: function() {
			var data = $(this).data("zoomer");
			
			if (typeof data.$target != 'undefined') {
				data.frameWidth = data.$target.outerWidth();
				data.frameHeight = data.$target.outerHeight();
				data.centerLeft = data.frameWidth / 2;
				data.centerTop = data.frameHeight / 2;
			}
		},
		
		// Unload image
		unload: function() {
			var data = $(this).data("zoomer");
			
			if (typeof data.$target != 'undefined') {
				data.$image.remove();
			}
		}
	};
	
	// Initialize
	function _init(opts) {
		var data = $.extend({}, options, properties, opts);
		
		data.$target = $(this);
		
		// Assemble HTML
		data.$zoomer = $('<div class="zoomer" class="' + options.customClass + '"><div class="zoomer-positioner"><div class="zoomer-holder"></div></div></div>');
		data.$target.addClass("zoomer-element")
					.append(data.$zoomer);
		
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
		
		// Kick it off
		data.$target.data("zoomer", data);
		pub.resize.apply(data.$target);
		
		if (data.source) {
			pub.load.apply(data.$target, [ data.source ]);
		}
		
		_startAnimation();
		
		// Maintain chainability
		return data.$target;
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
		if (data.originalHeight > (data.frameHeight - data.padding) || data.originalWidth > (data.frameWidth - data.padding)) {
			if (data.originalHeight > data.originalWidth) {
				// Tall
				data.aspect = "tall";
				
				data.targetImageHeight = data.frameHeight - data.padding;
				data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
				
				if (data.targetImageWidth > (data.frameWidth - data.padding)) {
					data.imageRatio = imageHolder.width / imageHolder.height;
					data.targetImageWidth = data.frameWidth - data.padding;
					data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
				}
				
				data.minWidth = data.minHeight / data.imageRatioTall;
				data.step = (data.maxWidth - data.minWidth) / 100;
			} else {
				// Wide
				data.aspect = "wide";
				
				data.targetImageWidth = data.frameWidth - data.padding;
				data.targetImageHeight = data.targetImageWidth / data.imageRatioWide;
				
				if(data.targetImageHeight > (data.frameHeight - data.padding)) {
					data.targetImageHeight = data.frameHeight - data.padding;
					data.targetImageWidth = data.targetImageHeight / data.imageRatioTall;
				}
				
				data.minHeight = data.minWidth / data.imageRatioWide;
				data.step = (data.maxHeight - data.minHeight) / 100;
			}
		}
		
		
		if (data.originalWidth < data.minWidth) {
			data.minWidth = data.originalWidth;
		}
		if (data.originalHeight < data.minHeight) {
			data.minHeight = data.originalHeight;
		}
		
		_setBounds(data);
		
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
		
		data.$image.animate({ opacity: 1 }, data.animationSpeed);
	}
	
	function _render() {
		iData.$instances = $(".zoomer-element");
		for (var i = 0, count = iData.$instances.length; i < count; i++) {
			var data = iData.$instances.eq(i).data("zoomer");
			
			if (typeof data != "null") {
				data.lastAction = data.action;
				
				// Handle zoom actions
				if (data.action != "") {
					// Calculate change
					data.keyDownTime += 0.025;
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
						
						data.targetPositionerLeft += (data.positionerLeft < data.centerLeft) ? delta : -delta;
						data.targetPositionerTop += (data.positionerTop < data.centerTop) ? delta : -delta;
						
						var checkLeft = (data.positionerLeft < data.centerLeft) ? "less" : "more";
						var checkTop = (data.positionerTop < data.centerTop) ? "less" : "more";
						
						if (checkLeft == "less" && data.targetPositionerLeft > data.centerLeft) {
							data.targetPositionerLeft = data.centerLeft;
						} else if (checkLeft == "more" && data.targetPositionerLeft < data.centerLeft) {
							data.targetPositionerLeft = data.centerleft;
						}
						if (checkTop == "less" && data.targetPositionerTop > data.centerTop) {
							data.targetPositionerTop = data.centerTop;
						} else if (checkTop == "more" && data.targetPositionerTop < data.centerTop) {
							data.targetPositionerTop = data.centerTop;
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
					
					data.imageWidth += (data.targetImageWidth - data.imageWidth) * data.animationInterval;
					data.imageHeight += (data.targetImageHeight - data.imageHeight) * data.animationInterval;
					data.imageLeft += (data.targetImageLeft - data.imageLeft) * data.animationInterval;
					data.imageTop += (data.targetImageTop - data.imageTop) * data.animationInterval;
					
					if (data.action != "drag") {
						data.positionerLeft += (data.targetPositionerLeft - data.positionerLeft) * data.animationInterval;
						data.positionerTop += (data.targetPositionerTop - data.positionerTop) * data.animationInterval;
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
		
		console.log(data.boundsLeft, data.boundsRight, data.boundsTop, data.boundsBottom);
		_setBounds(data);
		console.log(data.boundsLeft, data.boundsRight, data.boundsTop, data.boundsBottom, data.centerLeft);
		console.log("---");
		
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
	
	// Set dragging bounds
	function _setBounds(data) {
		data.boundsTop = data.centerTop - (data.imageHeight / 2);
		data.boundsBottom = data.centerTop + (data.imageHeight / 2);
		data.boundsLeft = data.centerLeft - (data.imageWidth / 2);
		data.boundsRight = data.centerLeft + (data.imageWidth / 2);
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
			clearTimout(animationId);
			animationId = null;
		}
	}
	
	// Handle animation loop
	function _onAnimate() {
		// Better framerates with setTimeout!
		animationId = setTimeout(_onAnimate, 28);
		_render();
	}
	/*
	// using requestAnimationFrame - EXPERIMENTAL & BUGGY!
	// Start animation loop
	function _startAnimation() {
		if (!animationId) {
			_onAnimate();
		}
	}
	
	// Kill animation loop 
	function _clearAnimation() {
		if (animationId) {
			window.cancelAnimationFrame(animationId);
			animationId = undefined;
		}
	}
	
	// Handle animation loop
	function _onAnimate() {
		animationId = requestAnimationFrame(_onAnimate);
		_render();
	}
	*/
	
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

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
/*
(function() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
	}
	
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { 
				callback(currTime + timeToCall); 
			}, timeToCall);
			
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
*/