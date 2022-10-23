import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';
// @ts-ignore: No extras declarations
import * as pcx from 'playcanvas/build/playcanvas-extras.js';

import * as MeshoptDecoder from '../lib/meshopt_decoder.js';

import { DropHandler } from './drop-handler';
import { File, HierarchyNode } from './types';
import { OrbitCamera, OrbitCameraInputMouse, OrbitCameraInputTouch } from './orbit-camera';

import { getAssetPath } from './helpers';

// model filename extensions
const modelExtensions = ['.gltf', '.glb' ];
const defaultSceneBounds = new pc.BoundingBox(new pc.Vec3(0, 1, 0), new pc.Vec3(1, 1, 1));

class Viewer {

    app: pc.Application;
    observer: Observer;

    firstFrame : boolean;
    loadTimestamp?: number = null;

    constructor(canvas: HTMLCanvasElement, observer: Observer) {
        this.canvas = canvas;
        this.observer = observer;

        this.init_app();
        const app = this.app;
        
        this.init_camera();

        this.init_light();
        this.init_skyBox();
        this.init_dropHandler();
        this.init_object();
        this.init_stats();

        this.observer.on('canvasResized', () => {
            this.resizeCanvas();
        });
        this.resizeCanvas();

        app.start();
    }

    //-----------------------------------

    //#region App
    init_app()
    {
        const canvas = this.canvas;

        // create the application
        const app = this.app = new pc.Application(canvas, {
            mouse: new pc.Mouse(canvas),
            touch: new pc.TouchDevice(canvas),
            graphicsDeviceOptions: {
                preferWebGl2: true,
                alpha: true,
                // the following aren't needed since we're rendering to an offscreen render target
                // and would only result in extra memory usage.
                antialias: true,
                depth: true,
                //preserveDrawingBuffer: true
            }
        });
        
    }
    //#endregion

    //-----------------------------------

    //#region Camera 
    camera: pc.Entity;
    orbitCamera: OrbitCamera;
    orbitCameraInputMouse: OrbitCameraInputMouse;
    orbitCameraInputTouch: OrbitCameraInputTouch;
    cameraFocusBBox: pc.BoundingBox | null;
    cameraPosition: pc.Vec3 | null;
    init_camera()
    {
        const app = this.app;
        const observer = this.observer;

        // Create Camera Entity
        const camera = this.camera = new pc.Entity("Camera");
        camera.addComponent("camera", {
            fov: 45,
            frustumCulling: true,
            clearColor: new pc.Color(0, 0, 0, 0)
        });
        //camera.camera.requestSceneColorMap(true);
        camera.camera.requestSceneDepthMap(true);
        
        // Create OrbitCamera Component
        this.orbitCamera = new OrbitCamera(camera, 0.25);
        this.orbitCameraInputMouse = new OrbitCameraInputMouse(app, this.orbitCamera);
        this.orbitCameraInputTouch = new OrbitCameraInputTouch(app, this.orbitCamera);
        this.orbitCamera.focalPoint.snapto(new pc.Vec3(0, 1, 0));

        // Add 
        this.app.root.addChild(camera);

        // Create Post-Process Component
        const assets = {
            'bloom': new pc.Asset('bloom', 'script', { url: getAssetPath('effect/bloom.js') }),
            'brightnesscontrast': new pc.Asset('brightnesscontrast', 'script', { url: getAssetPath('effect/brightnesscontrast.js') }),
            'huesaturation': new pc.Asset('huesaturation', 'script', { url: getAssetPath('effect/huesaturation.js') }),
            'vignette': new pc.Asset('vignette', 'script', { url: getAssetPath('effect/vignette.js') }),
            'bokeh': new pc.Asset('bokeh', 'script', { url: getAssetPath('effect/bokeh.js') }),
            'ssao': new pc.Asset('ssao', 'script', { url: getAssetPath('effect/ssao.js') })
        };
    
        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            camera.addComponent("script");
            Object.keys(observer.get('scripts')).forEach((key) => {
                camera.script.create(key, {
                    attributes: observer.get(`scripts.${key}`)
                });
            });

            const controlEvents:any = {
                // bloom
                'scripts.bloom.enabled': this.setBloomEnabled.bind(this),
                'scripts.bloom.bloomIntensity': this.setBloomIntensity.bind(this),
                'scripts.bloom.bloomThreshold': this.setBloomThreshold.bind(this),
                'scripts.bloom.blurAmount': this.setBlurAmount.bind(this),
    
                // // color adjust
                'scripts.brightnesscontrast.enabled': this.setBrightnessContrastEnabled.bind(this),
                'scripts.brightnesscontrast.brightness': this.setBrightness.bind(this),
                'scripts.brightnesscontrast.contrast': this.setContrast.bind(this),
                'scripts.huesaturation.enabled': this.setHueSaturationEnabled.bind(this),
                'scripts.huesaturation.hue': this.setHue.bind(this),
                'scripts.huesaturation.saturation': this.setSaturation.bind(this),
                
                // dof
                'scripts.bokeh.enabled': this.setBokehEnabled.bind(this),
                'scripts.bokeh.maxBlur': this.setBokehMaxBlur.bind(this),
                'scripts.bokeh.aperture': this.setBokehAperture.bind(this),
    
                // // vignette
                'scripts.vignette.enabled': this.setVignetteEnabled.bind(this),
                'scripts.vignette.offset': this.setVignetteOffset.bind(this),
                'scripts.vignette.darkness': this.setVignetteDarkness.bind(this),

                //  // ssao
                'scripts.ssao.enabled': this.setSSAOEnabled.bind(this),
                'scripts.ssao.radius': this.setSSAORadius.bind(this),
                'scripts.ssao.samples': this.setSSAOSamples.bind(this),
                'scripts.ssao.brightness': this.setSSAOBrightness.bind(this),
                'scripts.ssao.downscale': this.setSSAODownscale.bind(this)
            };

            // register control events
            Object.keys(controlEvents).forEach((e) => {
                observer.on(`${e}:set`, controlEvents[e]);
                //observer.set(e, observer.get(e), false, false, true);
            });
        });

        // store app things
        this.cameraFocusBBox = null;
        this.cameraPosition = null;

        const controlEvents:any = {
            
            'show.fov': this.setFov.bind(this),
        };

        // register control events
        Object.keys(controlEvents).forEach((e) => {
            observer.on(`${e}:set`, controlEvents[e]);
            observer.set(e, this.observer.get(e), false, false, true);
        });
    }
    focusCamera() {
        const camera = this.camera.camera;
        const bbox = this.calcSceneBounds();

        if (this.cameraFocusBBox) {
            const intersection = Viewer.calcBoundingBoxIntersection(this.cameraFocusBBox, bbox);
            if (intersection) {
                const len1 = bbox.halfExtents.length();
                const len2 = this.cameraFocusBBox.halfExtents.length();
                const len3 = intersection.halfExtents.length();
                if ((Math.abs(len3 - len1) / len1 < 0.1) &&
                    (Math.abs(len3 - len2) / len2 < 0.1)) {
                    return;
                }
            }
        }

        // calculate scene bounding box
        const radius = bbox.halfExtents.length();
        const distance = (radius * 1.4) / Math.sin(0.5 * camera.fov * camera.aspectRatio * pc.math.DEG_TO_RAD);

        if (this.cameraPosition) {
            const vec = bbox.center.clone().sub(this.cameraPosition);
            this.orbitCamera.vecToAzimElevDistance(vec, vec);
            this.orbitCamera.azimElevDistance.snapto(vec);
            this.cameraPosition = null;
        } else {
            const aed = this.orbitCamera.azimElevDistance.target.clone();
            aed.x = 45;
            aed.y = -45;
            aed.z = distance;
            this.orbitCamera.azimElevDistance.snapto(aed);
        }
        this.orbitCamera.setBounds(bbox);
        this.orbitCamera.focalPoint.snapto(bbox.center);
        camera.nearClip = distance / 100;
        camera.farClip = distance * 10;

        const light = this.light;
        light.light.shadowDistance = distance * 2;

        this.cameraFocusBBox = bbox;
    }

    calcSceneBounds() {
        return this.meshInstances.length ?
            this.calcMeshBoundingBox(this.meshInstances) :
            (this.sceneRoot.children.length ?
                this.calcHierBoundingBox(this.sceneRoot) : defaultSceneBounds);
    }
    // calculate the bounding box of the given mesh
    calcMeshBoundingBox(meshInstances: Array<pc.MeshInstance>) {
        const bbox = new pc.BoundingBox();
        for (let i = 0; i < meshInstances.length; ++i) {
            if (i === 0) {
                bbox.copy(meshInstances[i].aabb);
            } else {
                bbox.add(meshInstances[i].aabb);
            }
        }
        return bbox;
    }
    // calculate the bounding box of the graph-node hierarchy
    calcHierBoundingBox(rootNode: pc.Entity) {
        const position = rootNode.getPosition();
        let min_x = position.x;
        let min_y = position.y;
        let min_z = position.z;
        let max_x = position.x;
        let max_y = position.y;
        let max_z = position.z;

        const recurse = (node: pc.GraphNode) => {
            const p = node.getPosition();
            if (p.x < min_x) min_x = p.x; else if (p.x > max_x) max_x = p.x;
            if (p.y < min_y) min_y = p.y; else if (p.y > max_y) max_y = p.y;
            if (p.z < min_z) min_z = p.z; else if (p.z > max_z) max_z = p.z;
            for (let i = 0; i < node.children.length; ++i) {
                recurse(node.children[i]);
            }
        };
        recurse(rootNode);

        const result = new pc.BoundingBox();
        result.setMinMax(new pc.Vec3(min_x, min_y, min_z), new pc.Vec3(max_x, max_y, max_z));
        return result;
    }
    //#endregion

    //-----------------------------------
    
    //#region Light
    light: pc.Entity;
    sublight: pc.Entity;
    init_light()
    {
        const app = this.app;

        // create the light
        const light = this.light = new pc.Entity();
        var lightColor = new pc.Color(1, 1, 1);
        var intensity = 1;
        var rotation = new pc.Vec3(45, 30, 0);
        light.addComponent("light", {
            type: "directional",
            color: lightColor,
            castShadows: true,
            intensity: intensity,
            shadowBias: 0.2,
            shadowDistance: 5,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(rotation);
        app.root.addChild(light);

        const sublight = this.sublight = new pc.Entity();
        sublight.addComponent("light", {
            type: "directional",
            color: lightColor,
            castShadows: false,
            intensity: intensity
        });
        sublight.setLocalEulerAngles(rotation);
        app.root.addChild(sublight);

        const controlEvents:any = {
            // main light
            'lighting.mainLight.intencity': this.setMainLightingIntencity.bind(this),
            'lighting.mainLight.color_r': this.setMainLightingColor_r.bind(this),
            'lighting.mainLight.color_g': this.setMainLightingColor_g.bind(this),
            'lighting.mainLight.color_b': this.setMainLightingColor_b.bind(this),
            'lighting.mainLight.rotation_x': this.setMainLightingRotation_x.bind(this),
            'lighting.mainLight.rotation_y': this.setMainLightingRotation_y.bind(this),
            'lighting.mainLight.rotation_z': this.setMainLightingRotation_z.bind(this),
            'lighting.mainLight.shadow': this.setMainLightShadow.bind(this),
            'lighting.mainLight.shadowResolution': this.setMainLightShadowResulution.bind(this),
            'lighting.mainLight.shadowIntencity': this.setMainLightShadowIntencity.bind(this),

            // main light
            'lighting.subLight.intencity': this.setSubLightingIntencity.bind(this),
            'lighting.subLight.color_r': this.setSubLightingColor_r.bind(this),
            'lighting.subLight.color_g': this.setSubLightingColor_g.bind(this),
            'lighting.subLight.color_b': this.setSubLightingColor_b.bind(this),
            'lighting.subLight.rotation_x': this.setSubLightingRotation_x.bind(this),
            'lighting.subLight.rotation_y': this.setSubLightingRotation_y.bind(this),
            'lighting.subLight.rotation_z': this.setSubLightingRotation_z.bind(this)
        };

        // register control events
        Object.keys(controlEvents).forEach((e) => {
            this.observer.on(`${e}:set`, controlEvents[e]);
            this.observer.set(e, this.observer.get(e), false, false, true);
        });
    }
    //#endregion

    //-----------------------------------

    //#region SkyBox
    skyboxLoaded: boolean;
    skyboxMip: number;
    init_skyBox()
    {
        const observer = this.observer;

        this.skyboxLoaded = false;
        this.setTonemapping(observer.get('lighting.tonemapping'));
        this.setBackgroundColor(observer.get('lighting.env.backgroundColor'));

        const controlEvents:any = {
            
            // tone
            'lighting.tonemapping': this.setTonemapping.bind(this),

            // env
            'lighting.env.value': (value: string) => {
                if (value && value !== 'None') {
                    this.loadFiles([{ url: value, filename: value }]);
                } else {
                    this.clearSkybox();
                }
            },
            'lighting.env.skyboxMip': this.setSkyboxMip.bind(this),
            'lighting.env.exposure': this.setEnvExposure.bind(this),
            'lighting.env.backgroundColor': this.setBackgroundColor.bind(this),
            'lighting.env.rotation': this.setEnvRotation.bind(this),
        };

        // register control events
        Object.keys(controlEvents).forEach((e) => {
            observer.on(`${e}:set`, controlEvents[e]);
            observer.set(e, observer.get(e), false, false, true);
        });
    }
    //#endregion

    //-----------------------------------
    
    //#region Drop Asset Handler
    canvas : HTMLCanvasElement
    dropHandler: DropHandler;
    init_dropHandler()
    {
        const app = this.app;
        const canvas = this.canvas;

        // monkeypatch the mouse and touch input devices to ignore touch events
        // when they don't originate from the canvas.
        const origMouseHandler = app.mouse._moveHandler;
        app.mouse.detach();
        app.mouse._moveHandler = (event: MouseEvent) => {
            if (event.target === canvas) {
                origMouseHandler(event);
            }
        };
        app.mouse.attach(canvas);

        const origTouchHandler = app.touch._moveHandler;
        app.touch.detach();
        app.touch._moveHandler = (event: MouseEvent) => {
            if (event.target === canvas) {
                origTouchHandler(event);
            }
        };
        app.touch.attach(canvas);

        // create drop handler
        this.dropHandler = new DropHandler((files: Array<File>, resetScene: boolean) => {
            this.loadFiles(files, resetScene);
            if (resetScene) {
                this.observer.set('glbUrl', '');
            }
        });

        app.on('update', this.update, this);
        app.on('frameend', this.onFrameend, this);

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        const canvasSize = this.getCanvasSize();
        app.setCanvasFillMode(pc.FILLMODE_NONE, canvasSize.width, canvasSize.height);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        window.addEventListener("resize", () => {
            this.resizeCanvas();
        });
    }
    //#endregion

    //-----------------------------------
    
    //#region Objects
    sceneRoot: pc.Entity;
    entities: Array<pc.Entity>;
    entityAssets: Array<{entity: pc.Entity, asset: pc.Asset }>;
    assets: Array<pc.Asset>;
    meshInstances: Array<pc.MeshInstance>;
    sceneBounds: pc.BoundingBox;
    selectedNode: pc.GraphNode | null;
    init_object()
    {
        const app = this.app;
        const observer = this.observer;

        // create the scene and debug root nodes
        const sceneRoot = new pc.Entity("sceneRoot", app);
        app.root.addChild(sceneRoot);
        this.sceneRoot = sceneRoot;

        this.entities = [];
        this.entityAssets = [];
        this.assets = [];
        this.meshInstances = [];
        this.sceneBounds = null;

        const controlEvents:any = {
            'scene.variant.selected': this.setSelectedVariant.bind(this)
        };

        // register control events
        Object.keys(controlEvents).forEach((e) => {
            observer.on(`${e}:set`, controlEvents[e]);
            observer.set(e, this.observer.get(e), false, false, true);
        });
    }

    // Events
    setSelectedVariant(variant: string) {
        if (variant) {
            this.entityAssets.forEach((entityAsset) => {
                if (entityAsset.asset.resource.getMaterialVariants().indexOf(variant) !== -1) {
                    entityAsset.asset.resource.applyMaterialVariant(entityAsset.entity, variant);
                }
            });
        }
    }

    //#endregion

    //-----------------------------------
    
    //#region Stats (profiling)
    miniStats: any;
    init_stats()
    {
        const app = this.app;
        const observer = this.observer;

        // construct ministats, default off
        this.miniStats = new pcx.MiniStats(app);
        this.miniStats.enabled = observer.get('show.stats');

        const controlEvents:any = {
            'show.stats': this.setStats.bind(this),
        };

        // register control events
        Object.keys(controlEvents).forEach((e) => {
            observer.on(`${e}:set`, controlEvents[e]);
            observer.set(e, this.observer.get(e), false, false, true);
        });
    }
    //#endregion

    //-----------------------------------

    //#region canvas
    getCanvasSize() {
        return {
            width: document.body.clientWidth - document.getElementById("panel-left").offsetWidth, // - document.getElementById("panel-right").offsetWidth,
            height: document.body.clientHeight
        };
    }
    resizeCanvas() {
        const device = this.app.graphicsDevice as pc.WebglGraphicsDevice;
        const canvasSize = this.getCanvasSize();

        device.maxPixelRatio = window.devicePixelRatio;
        this.app.resizeCanvas(canvasSize.width, canvasSize.height);
    }
    //#endregion
   
    //-----------------------------------

    //#region Life Cycle
    update(deltaTime: number) {
        // update the orbit camera
        this.orbitCamera.update(deltaTime);

        if(this.camera.script?.has('bokeh'))
        {
            var fPoint = this.orbitCamera.focalPoint.snaptoPoint.clone();
            var cPoint = this.orbitCamera.cameraNode.getPosition();
            var focus = -fPoint.sub(cPoint).length();
            //console.log(focus);
            this.setBokehFocus(focus);
        }
        if(this.observer.get('show.depth'))
        {
            if (this.observer.get('scripts.bokeh.enabled') || this.observer.get('scripts.ssao.enabled')) {
                // @ts-ignore engine-tsd
                this.app.drawDepthTexture(0.7, -0.7, 0.5, 0.5);
            }
        }
    }
    onFrameend() {
        if (this.firstFrame) {
            this.firstFrame = false;
            // focus camera after first frame otherwise skinned model bounding
            // boxes are incorrect
            this.focusCamera();
        }
        else if (this.loadTimestamp !== null) {
            this.observer.set('scene.loadTime', `${Date.now() - this.loadTimestamp} ms`);
            this.loadTimestamp = null;
            this.observer.set('spinner', false);
        }
    }
    //#endregion

     //-----------------------------------

    //#region SceneData
    // reset the viewer, unloading resources
    resetScene() {
        const app = this.app;

        this.entities.forEach((entity) => {
            this.sceneRoot.removeChild(entity);
            entity.destroy();
        });
        this.entities = [];
        this.entityAssets = [];

        this.assets.forEach((asset) => {
            app.assets.remove(asset);
            asset.unload();
        });
        this.assets = [];

        this.meshInstances = [];

        this.observer.set('scene.variants.list', '[]');

        this.updateSceneInfo();
    }
    updateSceneInfo() {
        let meshCount = 0;
        let vertexCount = 0;
        let primitiveCount = 0;
        let variants: string[] = [];

        // update mesh stats
        this.assets.forEach((asset) => {
            variants = variants.concat(asset.resource.getMaterialVariants());
            asset.resource.renders.forEach((renderAsset: pc.Asset) => {
                renderAsset.resource.meshes.forEach((mesh: pc.Mesh) => {
                    meshCount++;
                    vertexCount += mesh.vertexBuffer.getNumVertices();
                    primitiveCount += mesh.primitive[0].count;
                });
            });
        });

        const graph: Array<HierarchyNode> = this.entities.map((entity) => {
            return {
                name: entity.name,
                path: entity.path,
                children: []
            };
        });

        // hierarchy
        // 추후 이 부분 지우면 패널 제거 가능
        this.observer.set('scene.nodes', JSON.stringify(graph));

        // mesh stats
        this.observer.set('scene.meshCount', meshCount);
        this.observer.set('scene.vertexCount', vertexCount);
        this.observer.set('scene.primitiveCount', primitiveCount);

        // variant stats
        this.observer.set('scene.variants.list', JSON.stringify(variants));
        this.observer.set('scene.variant.selected', variants[0]);
    }
    // add a loaded asset to the scene
    // asset is a container asset with renders and/or animations
    private addToScene(err: string, asset: pc.Asset) {
        //this.observer.set('spinner', false);
        
        if (err) {
            this.observer.set('error', err);
            return;
        }

        const resource = asset.resource;
        const meshesLoaded = resource.renders && resource.renders.length > 0;
        const prevEntity : pc.Entity = this.entities.length === 0 ? null : this.entities[this.entities.length - 1];

        let entity: pc.Entity;

        // create entity
        if (!meshesLoaded && prevEntity && prevEntity.findComponent("render")) {
            entity = prevEntity;
        } else {
            entity = asset.resource.instantiateRenderEntity();
            this.entities.push(entity);
            this.entityAssets.push({ entity: entity, asset: asset });
            this.sceneRoot.addChild(entity);
        }

        // store the loaded asset
        this.assets.push(asset);

        // update
        this.updateSceneInfo();

        // construct a list of meshInstances so we can quickly access them when configuring wireframe rendering etc.
        this.updateMeshInstanceList();

        // we can't refocus the camera here because the scene hierarchy only gets updated
        // during render. we must instead set a flag, wait for a render to take place and
        // then focus the camera.
        this.firstFrame = true;
        
    }
    //#endregion

    //#region Load Model
    // load gltf model given its url and list of external urls
    private loadGltf(gltfUrl: File, externalUrls: Array<File>, finishedCallback: (err: string | null, asset: pc.Asset) => void) {

        // provide buffer view callback so we can handle models compressed with MeshOptimizer
        // https://github.com/zeux/meshoptimizer
        const processBufferView = function (gltfBuffer: any, buffers: Array<any>, continuation: (err: string, result: any) => void) {
            if (gltfBuffer.extensions && gltfBuffer.extensions.EXT_meshopt_compression) {
                const extensionDef = gltfBuffer.extensions.EXT_meshopt_compression;

                const decoder = MeshoptDecoder;

                decoder.ready.then(() => {
                    const byteOffset = extensionDef.byteOffset || 0;
                    const byteLength = extensionDef.byteLength || 0;

                    const count = extensionDef.count;
                    const stride = extensionDef.byteStride;

                    const result = new Uint8Array(count * stride);
                    const source = new Uint8Array(buffers[extensionDef.buffer].buffer,
                                                buffers[extensionDef.buffer].byteOffset + byteOffset,
                                                byteLength);

                    decoder.decodeGltfBuffer(result, count, stride, source, extensionDef.mode, extensionDef.filter);

                    continuation(null, result);
                });
            } else {
                continuation(null, null);
            }
        };

        const processImage = function (gltfImage: any, continuation: (err: string, result: any) => void) {
            const u: File = externalUrls.find((url) => {
                return url.filename === pc.path.normalize(gltfImage.uri || "");
            });
            if (u) {
                const textureAsset = new pc.Asset(u.filename, 'texture', {
                    url: u.url,
                    filename: u.filename
                });
                textureAsset.on('load', () => {
                    continuation(null, textureAsset);
                });
                this.app.assets.add(textureAsset);
                this.app.assets.load(textureAsset);
            } else {
                continuation(null, null);
            }
        };

        const postProcessImage = (gltfImage: any, textureAsset: pc.Asset) => {
            // max anisotropy on all textures
            textureAsset.resource.anisotropy = this.app.graphicsDevice.maxAnisotropy;
        };

        const processBuffer = function (gltfBuffer: any, continuation: (err: string, result: any) => void) {
            const u = externalUrls.find((url) => {
                return url.filename === pc.path.normalize(gltfBuffer.uri || "");
            });
            if (u) {
                const bufferAsset = new pc.Asset(u.filename, 'binary', {
                    url: u.url,
                    filename: u.filename
                });
                bufferAsset.on('load', () => {
                    continuation(null, new Uint8Array(bufferAsset.resource));
                });
                this.app.assets.add(bufferAsset);
                this.app.assets.load(bufferAsset);
            } else {
                continuation(null, null);
            }
        };

        const containerAsset = new pc.Asset(gltfUrl.filename, 'container', gltfUrl, null, {
            // @ts-ignore TODO no definition in pc
            bufferView: {
                processAsync: processBufferView.bind(this)
            },
            image: {
                processAsync: processImage.bind(this),
                postprocess: postProcessImage
            },
            buffer: {
                processAsync: processBuffer.bind(this)
            }
        });
        containerAsset.on('load', () => {
            finishedCallback(null, containerAsset);
        });
        containerAsset.on('error', (err : string) => {
            finishedCallback(err, containerAsset);
        });

        this.observer.set('spinner', true);
        this.observer.set('error', null);

        // clearCta
        document.querySelector('#panel-left').classList.add('no-cta');
        document.querySelector('#application-canvas').classList.add('no-cta');
        document.querySelector('.load-button-panel').classList.add('hide');

        this.app.assets.add(containerAsset);
        this.app.assets.load(containerAsset);
    }

    // returns true if the filename has one of the recognized model extensions
    isModelFilename(filename: string) {
        const filenameExt = pc.path.getExtension(filename).toLowerCase();
        return modelExtensions.indexOf(filenameExt) !== -1;
    }

    // load the list of urls.
    // urls can reference glTF files, glb files and skybox textures.
    // returns true if a model was loaded.
    loadFiles(files: Array<File>, resetScene = false) {
        // convert single url to list
        if (!Array.isArray(files)) {
            files = [files];
        }

        // check if any file is a model
        const hasModelFilename = files.reduce((p, f) => p || this.isModelFilename(f.filename), false);

        if (hasModelFilename) {
            if (resetScene) {
                this.resetScene();
            }

            const loadTimestamp = Date.now();

            // kick off simultaneous asset load
            let awaiting = 0;
            const assets: { err: string, asset: pc.Asset }[] = [];
            files.forEach((file, index) => {
                if (this.isModelFilename(file.filename)) {
                    awaiting++;
                    this.loadGltf(file, files, (err, asset) => {
                        assets[index] = { err: err, asset: asset };
                        if (--awaiting === 0) {
                            this.loadTimestamp = loadTimestamp;

                            // done loading assets, add them to the scene
                            assets.forEach((asset) => {
                                if (asset) {
                                    this.addToScene(asset.err, asset.asset);
                                }
                            });
                        }
                    });
                }
            });
        } else {
            // load skybox
            this.loadSkybox(files);
        }

        // return true if a model/scene was loaded and false otherwise
        return hasModelFilename;
    }
    //#endregion

    //#region Load Skybox
    private clearSkybox() {
        this.app.scene.envAtlas = null;
        this.app.scene.setSkybox(null);
        
        this.skyboxLoaded = false;
    }
    // initialize the faces and prefiltered lighting data from the given
    // skybox texture, which is either a cubemap or equirect texture.
    private initSkyboxFromTextureNew(env: pc.Texture) {
        const skybox = pc.EnvLighting.generateSkyboxCubemap(env);
        const lighting = pc.EnvLighting.generateLightingSource(env);
        // The second options parameter should not be necessary but the TS declarations require it for now
        const envAtlas = pc.EnvLighting.generateAtlas(lighting, {});
        lighting.destroy();

        this.app.scene.envAtlas = envAtlas;
        this.app.scene.skybox = skybox;
        
    }

    // initialize the faces and prefiltered lighting data from the given
    // skybox texture, which is either a cubemap or equirect texture.
    private initSkyboxFromTexture(skybox: pc.Texture) {
        if (pc.EnvLighting) {
            return this.initSkyboxFromTextureNew(skybox);
        }

        const app = this.app;
        const device = app.graphicsDevice;

        const createCubemap = (size: number) => {
            return new pc.Texture(device, {
                name: `skyboxFaces-${size}`,
                cubemap: true,
                width: size,
                height: size,
                type: pc.TEXTURETYPE_RGBM,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE,
                fixCubemapSeams: true,
                mipmaps: false
            });
        };

        const cubemaps = [];

        cubemaps.push(pc.EnvLighting.generateSkyboxCubemap(skybox));

        const lightingSource = pc.EnvLighting.generateLightingSource(skybox);

        // create top level
        const top = createCubemap(128);
        pc.reprojectTexture(lightingSource, top, {
            numSamples: 1
        });
        cubemaps.push(top);

        // generate prefiltered lighting data
        const sizes = [128, 64, 32, 16, 8, 4];
        const specPower = [1, 512, 128, 32, 8, 2];
        for (let i = 1; i < sizes.length; ++i) {
            const level = createCubemap(sizes[i]);
            pc.reprojectTexture(lightingSource, level, {
                numSamples: 1024,
                specularPower: specPower[i],
                distribution: 'ggx'
            });

            cubemaps.push(level);
        }

        lightingSource.destroy();

        // assign the textures to the scene
        app.scene.setSkybox(cubemaps);
        
    }

    // load the image files into the skybox. this function supports loading a single equirectangular
    // skybox image or 6 cubemap faces.
    private loadSkybox(files: Array<File>) {
        const app = this.app;

        if (files.length !== 6) {
            // load equirectangular skybox
            const textureAsset = new pc.Asset('skybox_equi', 'texture', {
                url: files[0].url,
                filename: files[0].filename
            });
            textureAsset.ready(() => {
                const texture = textureAsset.resource;
                if (texture.type === pc.TEXTURETYPE_DEFAULT && texture.format === pc.PIXELFORMAT_R8_G8_B8_A8) {
                    // assume RGBA data (pngs) are RGBM
                    texture.type = pc.TEXTURETYPE_RGBM;
                }
                this.initSkyboxFromTexture(texture);
            });
            app.assets.add(textureAsset);
            app.assets.load(textureAsset);
        } else {
            // sort files into the correct order based on filename
            const names = [
                ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'],
                ['px', 'nx', 'py', 'ny', 'pz', 'nz'],
                ['right', 'left', 'up', 'down', 'front', 'back'],
                ['right', 'left', 'top', 'bottom', 'forward', 'backward'],
                ['0', '1', '2', '3', '4', '5']
            ];

            const getOrder = (filename: string) => {
                const fn = filename.toLowerCase();
                for (let i = 0; i < names.length; ++i) {
                    const nameList = names[i];
                    for (let j = 0; j < nameList.length; ++j) {
                        if (fn.indexOf(nameList[j] + '.') !== -1) {
                            return j;
                        }
                    }
                }
                return 0;
            };

            const sortPred = (first: File, second: File) => {
                const firstOrder = getOrder(first.filename);
                const secondOrder = getOrder(second.filename);
                return firstOrder < secondOrder ? -1 : (secondOrder < firstOrder ? 1 : 0);
            };

            files.sort(sortPred);

            // construct an asset for each cubemap face
            const faceAssets = files.map((file, index) => {
                const faceAsset = new pc.Asset('skybox_face' + index, 'texture', file);
                app.assets.add(faceAsset);
                app.assets.load(faceAsset);
                return faceAsset;
            });

            // construct the cubemap asset
            const cubemapAsset = new pc.Asset('skybox_cubemap', 'cubemap', null, {
                textures: faceAssets.map(faceAsset => faceAsset.id)
            });
            cubemapAsset.loadFaces = true;
            cubemapAsset.on('load', () => {
                this.initSkyboxFromTexture(cubemapAsset.resource);
            });
            app.assets.add(cubemapAsset);
            app.assets.load(cubemapAsset);
        }
        this.skyboxLoaded = true;
    }

    //#endregion

    //#region calcBoundingBox
    // collects all mesh instances from entity hierarchy
    private collectMeshInstances(entity: pc.Entity) {
        const meshInstances: Array<pc.MeshInstance> = [];
        if (entity) {
            const components = entity.findComponents("render");
            for (let i = 0; i < components.length; i++) {
                const render = components[i] as pc.RenderComponent;
                if (render.meshInstances) {
                    for (let m = 0; m < render.meshInstances.length; m++) {
                        const meshInstance = render.meshInstances[m];
                        meshInstances.push(meshInstance);
                    }
                }
            }
        }
        return meshInstances;
    }
    private updateMeshInstanceList() {

        this.meshInstances = [];
        for (let e = 0; e < this.entities.length; e++) {
            const meshInstances = this.collectMeshInstances(this.entities[e]);
            this.meshInstances = this.meshInstances.concat(meshInstances);
        }
    }
   
    // calculate the intersection of the two bounding boxes
    private static calcBoundingBoxIntersection(bbox1: pc.BoundingBox, bbox2: pc.BoundingBox) {
        // bounds don't intersect
        if (!bbox1.intersects(bbox2)) {
            return null;
        }
        const min1 = bbox1.getMin();
        const max1 = bbox1.getMax();
        const min2 = bbox2.getMin();
        const max2 = bbox2.getMax();
        const result = new pc.BoundingBox();
        result.setMinMax(new pc.Vec3(Math.max(min1.x, min2.x), Math.max(min1.y, min2.y), Math.max(min1.z, min2.z)),
                         new pc.Vec3(Math.min(max1.x, max2.x), Math.min(max1.y, max2.y), Math.min(max1.z, max2.z)));
        return result;
    }
    
    //#endregion

    //#region Set Property
   
   
    setStats(show: boolean) {
        this.miniStats.enabled = show;
        
    }
   
    setFov(fov: number) {
        this.camera.camera.fov = fov;
        
    }
    setEnvRotation(factor: number) {
        // update skybox
        const rot = new pc.Quat();
        rot.setFromEulerAngles(0, factor, 0);
        this.app.scene.skyboxRotation = rot;
    }
    setMainLightingIntencity(factor: number) {
        this.light.light.intensity = factor;
        
    }
    setMainLightingColor_r(value: number) {
        var color = this.light.light.color;
        color.r = value / 255;
        this.light.light.color = color;
        
    }
    setMainLightingColor_g(value: number) {
        var color = this.light.light.color;
        color.g = value / 255;
        this.light.light.color = color;
        
    }
    setMainLightingColor_b(value: number) {
        var color = this.light.light.color;
        color.b = value / 255;
        this.light.light.color = color;
        
    }
    setMainLightingRotation_x(factor: number) {
        var angle = this.light.getLocalEulerAngles();
        angle.x = factor;
        this.light.setLocalEulerAngles(angle);
        
    }
    setMainLightingRotation_y(factor: number) {
        var angle = this.light.getLocalEulerAngles();
        angle.y = factor;
        this.light.setLocalEulerAngles(angle);
        
    }
    setMainLightingRotation_z(factor: number) {
        var angle = this.light.getLocalEulerAngles();
        angle.z = factor;
        this.light.setLocalEulerAngles(angle);
        
    }
    setMainLightShadow(enable: boolean) {
        this.light.light.castShadows = enable;
        
    }
    setMainLightShadowIntencity(value: number) {
        this.light.light.shadowIntensity = value;
        
    }
    setMainLightShadowResulution(value: number) {
        this.light.light.shadowResolution = value;
        
    }
    setSubLightingIntencity(factor: number) {
        this.sublight.light.intensity = factor;
        
    }
    setSubLightingColor_r(value: number) {
        var color = this.sublight.light.color;
        color.r = value / 255;
        this.sublight.light.color = color;
        
    }
    setSubLightingColor_g(value: number) {
        var color = this.sublight.light.color;
        color.g = value / 255;
        this.sublight.light.color = color;
        
    }
    setSubLightingColor_b(value: number) {
        var color = this.sublight.light.color;
        color.b = value / 255;
        this.sublight.light.color = color;
        
    }
    setSubLightingRotation_x(factor: number) {
        var angle = this.sublight.getLocalEulerAngles();
        angle.x = factor;
        this.sublight.setLocalEulerAngles(angle);
        
    }
    setSubLightingRotation_y(factor: number) {
        var angle = this.sublight.getLocalEulerAngles();
        angle.y = factor;
        this.sublight.setLocalEulerAngles(angle);
        
    }
    setSubLightingRotation_z(factor: number) {
        var angle = this.sublight.getLocalEulerAngles();
        angle.z = factor;
        this.sublight.setLocalEulerAngles(angle);
        
    }
    setEnvExposure(factor: number) {
        this.app.scene.skyboxIntensity = Math.pow(2, factor);
        
    }
    setTonemapping(tonemapping: string) {
        const mapping: Record<string, number> = {
            Linear: pc.TONEMAP_LINEAR,
            Filmic: pc.TONEMAP_FILMIC,
            Hejl: pc.TONEMAP_HEJL,
            ACES: pc.TONEMAP_ACES
        };

        this.app.scene.toneMapping = mapping.hasOwnProperty(tonemapping) ? mapping[tonemapping] : pc.TONEMAP_ACES;
        
    }
    setBackgroundColor(color: { r: number, g: number, b: number }) {
        const cnv = (value: number) => Math.max(0, Math.min(255, Math.floor(value * 255)));
        document.getElementById('canvas-wrapper').style.backgroundColor = `rgb(${cnv(color.r)}, ${cnv(color.g)}, ${cnv(color.b)})`;
    }
    setSkyboxMip(mip: number) {
        this.app.scene.layers.getLayerById(pc.LAYERID_SKYBOX).enabled = (mip !== 0);
        this.app.scene.skyboxMip = mip - 1;
    }

    setBloomEnabled(value: boolean) {
        this.camera.script.get('bloom').fire('state', value);
    }
    setBloomIntensity(value: number) {
        this.camera.script.get('bloom').fire('attr', 'bloomIntensity', value);
    }
    setBloomThreshold(value: number) {
        this.camera.script.get('bloom').fire('attr', 'bloomThreshold', value);
    }
    setBlurAmount(value: number) {
        this.camera.script.get('bloom').fire('attr', 'blurAmount', value);
    }

    setBrightnessContrastEnabled(value: boolean) {
        this.camera.script.get('brightnesscontrast').fire('state', value);
    }
    setBrightness(value: number) {
        this.camera.script.get('brightnesscontrast').fire('attr', 'brightness', value);
    }
    setContrast(value: number) {
        this.camera.script.get('brightnesscontrast').fire('attr', 'contrast', value);
    }

    setHueSaturationEnabled(value: boolean) {
        this.camera.script.get('huesaturation').fire('state', value);
    }
    setHue(value: number) {
        this.camera.script.get('huesaturation').fire('attr', 'hue', value);
    }
    setSaturation(value: number) {
        this.camera.script.get('huesaturation').fire('attr', 'saturation', value);
    }

    setVignetteEnabled(value: boolean) {
        this.camera.script.get('vignette').fire('state', value);
    }
    setVignetteOffset(value: number) {
        this.camera.script.get('vignette').fire('attr', 'offset', value);
    }
    setVignetteDarkness(value: number) {
        this.camera.script.get('vignette').fire('attr', 'darkness', value);
    }

    setBokehEnabled(value: boolean) {
        this.camera.script.get('bokeh').fire('state', value);
    }
    setBokehMaxBlur(value: number) {
        this.camera.script.get('bokeh').fire('attr', 'maxBlur', value);
    }
    setBokehAperture(value: number) {
        this.camera.script.get('bokeh').fire('attr', 'aperture', value);
    }
    setBokehFocus(value: number) {
       this.camera.script.get('bokeh').fire('attr', 'focus', value);
    }

    setSSAOEnabled(value: boolean) {
        this.camera.script.get('ssao').fire('state', value);
    }
    setSSAORadius(value: number) {
        this.camera.script.get('ssao').fire('attr', 'radius', value);
    }
    setSSAOSamples(value: number) {
        this.camera.script.get('ssao').fire('attr', 'samples', value);
    }
    setSSAOBrightness(value: number) {
        this.camera.script.get('ssao').fire('attr', 'brightness', value);
    }
    setSSAODownscale(value: number) {
        this.camera.script.get('ssao').fire('attr', 'downscale', value);
    }

    //#endregion

    //#region Util

    // extract query params. taken from https://stackoverflow.com/a/21152762
    handleUrlParams() {
        const urlParams: any = {};
        if (location.search) {
            location.search.substring(1).split("&").forEach((item) => {
                const s = item.split("="),
                    k = s[0],
                    v = s[1] && decodeURIComponent(s[1]);
                (urlParams[k] = urlParams[k] || []).push(v);
            });
        }

        // handle load url param
        const loadUrls = (urlParams.load || []).concat(urlParams.assetUrl || []);
        if (loadUrls.length > 0) {
            this.loadFiles(
                loadUrls.map((url: string) => {
                    return { url, filename: url };
                })
            );
        }
        if (loadUrls.length === 1) {
            this.observer.set('glbUrl', loadUrls[0]);
        }

        // set camera position
        if (urlParams.hasOwnProperty('cameraPosition')) {
            const pos = urlParams.cameraPosition[0].split(',').map(Number);
            if (pos.length === 3) {
                this.cameraPosition = new pc.Vec3(pos);
            }
        }
    }

    //#endregion
}

export default Viewer;
