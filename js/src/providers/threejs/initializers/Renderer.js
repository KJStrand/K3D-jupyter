'use strict';

/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 */

var VRButton = {

	createButton: function ( renderer, options ) {

		if ( options && options.referenceSpaceType ) {

			renderer.xr.setReferenceSpaceType( options.referenceSpaceType );

		}

		function showEnterVR( /*device*/ ) {

			var currentSession = null;

			function onSessionStarted( session ) {

				session.addEventListener( 'end', onSessionEnded );

				renderer.xr.setSession( session );
				button.textContent = 'EXIT VR';

				currentSession = session;

			}

			function onSessionEnded( /*event*/ ) {

				currentSession.removeEventListener( 'end', onSessionEnded );

				button.textContent = 'ENTER VR';

				currentSession = null;

			}

			//

			button.style.display = '';

			button.style.cursor = 'pointer';
			button.style.left = 'calc(50% - 50px)';
			button.style.width = '100px';

			button.textContent = 'ENTER VR';

			button.onmouseenter = function () {

				button.style.opacity = '1.0';

			};

			button.onmouseleave = function () {

				button.style.opacity = '0.5';

			};

			button.onclick = function () {

				if ( currentSession === null ) {

					// WebXR's requestReferenceSpace only works if the corresponding feature
					// was requested at session creation time. For simplicity, just ask for
					// the interesting ones as optional features, but be aware that the
					// requestReferenceSpace call will fail if it turns out to be unavailable.
					// ('local' is always available for immersive sessions and doesn't need to
					// be requested separately.)

					var sessionInit = { optionalFeatures: [ 'local-floor', 'bounded-floor' ] };
					navigator.xr.requestSession( 'immersive-vr', sessionInit ).then( onSessionStarted );

				} else {

					currentSession.end();

				}

			};

		}

		function disableButton() {

			button.style.display = '';

			button.style.cursor = 'auto';
			button.style.left = 'calc(50% - 75px)';
			button.style.width = '150px';

			button.onmouseenter = null;
			button.onmouseleave = null;

			button.onclick = null;

		}

		function showWebXRNotFound() {

			disableButton();

			button.textContent = 'VR NOT SUPPORTED';

		}

		function stylizeElement( element ) {

			element.style.position = 'absolute';
			element.style.bottom = '20px';
			element.style.padding = '12px 6px';
			element.style.border = '1px solid #fff';
			element.style.borderRadius = '4px';
			element.style.background = 'rgba(0,0,0,0.1)';
			element.style.color = '#fff';
			element.style.font = 'normal 13px sans-serif';
			element.style.textAlign = 'center';
			element.style.opacity = '0.5';
			element.style.outline = 'none';
			element.style.zIndex = '999';

		}

		if ( 'xr' in navigator ) {

			var button = document.createElement( 'button' );
			button.style.display = 'none';

			stylizeElement( button );

			navigator.xr.isSessionSupported( 'immersive-vr' ).then( function ( supported ) {

				supported ? showEnterVR() : showWebXRNotFound();

			} );

			return button;

		} else {

			var message = document.createElement( 'a' );
			message.href = 'https://immersiveweb.dev/';

			if ( window.isSecureContext === false ) {

				message.innerHTML = 'WEBXR NEEDS HTTPS'; // TODO Improve message

			} else {

				message.innerHTML = 'WEBXR NOT AVAILABLE';

			}

			message.style.left = 'calc(50% - 90px)';
			message.style.width = '180px';
			message.style.textDecoration = 'none';

			stylizeElement( message );

			return message;

		}

	}

};

// export { VRButton };



var THREE = require('three'),
    getSSAAChunkedRender = require('./../helpers/SSAAChunkedRender');

/**
 * @memberof K3D.Providers.ThreeJS.Initializers
 * @inner
 * @param  {K3D.Core} K3D       Current K3D instance
 * @param  {Object} on          Internal type of listener (when its called)
 * @param  {Function} listener  Listener to be removed
 */
function handleListeners(K3D, on, listener) {

    listener.call(K3D);

    if (listener.callOnce) {
        K3D.removeFrameUpdateListener(on, listener);
    }
}

/**
 * Renderer initializer for Three.js library
 * @this K3D.Core world
 * @method Renderer
 * @memberof K3D.Providers.ThreeJS.Initializers
 * @param {Object} K3D current K3D instance
 */
module.exports = function (K3D) {

    var self = this, renderingPromise = null,
        canvas = document.createElement('canvas'),
        context = canvas.getContext('webgl2', {
            antialias: K3D.parameters.antialias > 0,
            preserveDrawingBuffer: true,
            alpha: true,
            powerPreference: 'high-performance',
			xrCompatible: true
        }),
        gl, debugInfo;

    self.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context
    });
	
	// var renderer = new THREE.WebGLRenderer( { antialias: true } );
	// renderer.setPixelRatio( window.devicePixelRatio );
	// renderer.setSize( window.innerWidth, window.innerHeight );
	// renderer.xr.enabled = true;
				
	self.renderer.xr.enabled = true;

    // self.renderer.xr.enabled = true;
    // document.getElementById("k3d-target").appendChild( VRButton.createButton( self.renderer ) );
	// document.body.appendChild( VRButton.createButton( self.renderer ) );
    


    canvas.addEventListener('webglcontextlost', function (event) {
        event.preventDefault();
        console.log(event);
    }, false);

    gl = self.renderer.context;

    debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    console.log('K3D: (UNMASKED_VENDOR_WEBGL)', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
    console.log('K3D: (UNMASKED_RENDERER_WEBGL)', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));

    function render() {
        return new Promise(function (resolve) {
            if (K3D.disabling) {
                return void(0);
            }

            var size = new THREE.Vector2(), chunk_widths = [];

            self.renderer.getSize(size);

            if (K3D.parameters.renderingSteps > 1) {
                var s = size.x / K3D.parameters.renderingSteps;

                for (var i = 0; i < K3D.parameters.renderingSteps; i++) {
                    var o1 = Math.round(i * s);
                    var o2 = Math.min(Math.round((i + 1) * s), size.x);
                    chunk_widths.push([o1, o2 - o1]);
                }
            }

            K3D.frameUpdateHandlers.before.forEach(handleListeners.bind(null, K3D, 'before'));

            K3D.refreshGrid();

            self.renderer.clippingPlanes = [];

            self.camera.updateMatrixWorld();
            self.renderer.clear();

            self.renderer.render(self.gridScene, self.camera);

            self.renderer.setViewport(size.x - self.axesHelper.width, 0, self.axesHelper.width, self.axesHelper.height);
            self.renderer.render(self.axesHelper.scene, self.axesHelper.camera);
            self.renderer.setViewport(0, 0, size.x, size.y);

            K3D.parameters.clippingPlanes.forEach(function (plane) {
                self.renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3().fromArray(plane), plane[3]));
            });

            K3D.dispatch(K3D.events.BEFORE_RENDER);

            var p = Promise.resolve();

            if (K3D.parameters.renderingSteps > 1) {
                self.controls.enabled = false;

                chunk_widths.forEach(function (c) {
                    p = p.then(function () {
                        self.renderer.setViewport(c[0], 0, c[1], size.y);
                        self.camera.setViewOffset(size.x, size.y, c[0], 0, c[1], size.y);
                        self.renderer.render(self.scene, self.camera);
                    });

                    p = p.then(function () {
                        return new Promise(function (resolve) {
                            setTimeout(resolve, 50);
                        });
                    });
                });
            } else {
                p = p.then(function () {
                    // self.renderer.render(self.scene, self.camera);
					self.renderer.setAnimationLoop( function () {
						self.renderer.render(self.scene, self.camera);
					} );
                });
            }

            p = p.then(function () {
                self.controls.enabled = true;

                self.renderer.setViewport(0, 0, size.x, size.y);
                self.camera.clearViewOffset();

                K3D.frameUpdateHandlers.after.forEach(handleListeners.bind(null, K3D, 'after'));

                K3D.dispatch(K3D.events.RENDERED);

                if (K3D.autoRendering) {
                    requestAnimationFrame(render);
					// self.renderer.setAnimationLoop( render );
                } else {
                    resolve(true);
                }
            });
        });
    }

    this.renderer.setClearColor(0, 0);
    this.renderer.autoClear = false;

    this.render = function (force) {
        if (!K3D.autoRendering || force) {
            if (renderingPromise === null) {
                renderingPromise = render().then(function () {
                    renderingPromise = null;
                });

                return renderingPromise;
            } else if (force) {
                renderingPromise = renderingPromise.then(render).then(function () {
                    renderingPromise = null;
                });
            }
        }
    };

    this.renderOffScreen = function (width, height) {
        var rt, rtAxesHelper,
            chunk_heights = [],
            chunk_count = Math.max(Math.min(128, K3D.parameters.renderingSteps), 1),
            aaLevel = Math.max(Math.min(5, K3D.parameters.antialias), 0);

        var s = height / chunk_count;

        var size = new THREE.Vector2();

        self.renderer.getSize(size);

        var scale = Math.max(width / size.x, height / size.y);

        for (var i = 0; i < chunk_count; i++) {
            var o1 = Math.round(i * s);
            var o2 = Math.min(Math.round((i + 1) * s), height);
            chunk_heights.push([o1, o2 - o1]);
        }

        rt = new THREE.WebGLRenderTarget(width, Math.ceil(height / chunk_count), {
            type: THREE.FloatType
        });

        rtAxesHelper = new THREE.WebGLRenderTarget(self.axesHelper.width * scale, self.axesHelper.height * scale, {
            type: THREE.FloatType
        });
        self.renderer.clippingPlanes = [];

        return getSSAAChunkedRender(self.renderer, self.axesHelper.scene, self.axesHelper.camera,
            rtAxesHelper, rtAxesHelper.width, rtAxesHelper.height, [[0, rtAxesHelper.height]],
            aaLevel).then(function (result) {

            var axesHelper = new Uint8ClampedArray(width * height * 4);

            for (var y = 0; y < rtAxesHelper.height; y++) {
                // fast row-copy
                axesHelper.set(
                    result.slice(y * rtAxesHelper.width * 4, (y + 1) * rtAxesHelper.width * 4),
                    (y * width + width - rtAxesHelper.width) * 4
                );
            }

            return getSSAAChunkedRender(self.renderer, self.gridScene, self.camera,
                rt, width, height, [[0, height]], aaLevel).then(function (grid) {

                K3D.parameters.clippingPlanes.forEach(function (plane) {
                    self.renderer.clippingPlanes.push(new THREE.Plane(new THREE.Vector3().fromArray(plane), plane[3]));
                });

                return getSSAAChunkedRender(self.renderer, self.scene, self.camera,
                    rt, width, height, chunk_heights, aaLevel).then(function (scene) {
                    rt.dispose();
                    return [axesHelper, grid, scene];
                });
            });

        });
    };
};
