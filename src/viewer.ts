import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';
import * as MeshoptDecoder from '../lib/meshopt_decoder.js';

import { File } from './types';
import { OrbitCamera, OrbitCameraInputMouse, OrbitCameraInputTouch } from './orbit-camera';
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
        this.init_skyBox();
        this.init_object();
        this.init_camera();
        this.init_light();

        const canvasSize = this.getCanvasSize();
        this.app.setCanvasFillMode(pc.FILLMODE_NONE, canvasSize.width, canvasSize.height);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        observer.on('canvasResized', () => {
            this.resizeCanvas();
        });
        window.addEventListener("resize", () => {
            this.resizeCanvas();
        });
        this.resizeCanvas();

        this.app.on('frameend', this.onFrameend, this);
        this.app.start();
    }

    //-----------------------------------

    //#region App
    prevCameraMat: pc.Mat4;
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
                antialias: true,
                depth: false,
                preserveDrawingBuffer: false
            }
        });
        app.autoRender = false;
        this.prevCameraMat = new pc.Mat4();
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
        
        // Create OrbitCamera Component
        this.orbitCamera = new OrbitCamera(camera, 0.25);
        this.orbitCameraInputMouse = new OrbitCameraInputMouse(app, this.orbitCamera);
        this.orbitCameraInputTouch = new OrbitCameraInputTouch(app, this.orbitCamera);
        this.orbitCamera.focalPoint.snapto(new pc.Vec3(0, 1, 0));

        // Add 
        this.app.root.addChild(camera);

        // store app things
        this.cameraFocusBBox = null;
        this.cameraPosition = null;
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
                    this.renderNextFrame();
                    return;
                }
            }
        }

        // calculate scene bounding box
        const radius = bbox.halfExtents.length();
       
        //const distance = (radius * 1.4) / Math.sin(0.5 * camera.fov * camera.aspectRatio  * pc.math.DEG_TO_RAD);
        const distance = (radius * 1.1) / Math.sin(0.5 * camera.fov * pc.math.DEG_TO_RAD) / camera.aspectRatio;
        
        if (this.cameraPosition) {
            const vec = bbox.center.clone().sub(this.cameraPosition);
            this.orbitCamera.vecToAzimElevDistance(vec, vec);
            this.orbitCamera.azimElevDistance.snapto(vec);
            this.cameraPosition = null;
        } else {
            const aed = this.orbitCamera.azimElevDistance.target.clone();
            aed.x = 0;
            aed.y = -30;
            aed.z = distance;
            this.orbitCamera.azimElevDistance.snapto(aed);
        }
        this.sceneBounds = bbox;
        const v = new pc.Vec3(
            Math.round((this.sceneBounds.halfExtents.x * 2) * 100)/100,
            Math.round((this.sceneBounds.halfExtents.y * 2) * 100)/100,
            Math.round((this.sceneBounds.halfExtents.z * 2) * 100)/100
        );
        this.observer.set('scene.bounds', v.toString());
        this.orbitCamera.init(bbox, distance * 1.3);
        this.orbitCamera.focalPoint.snapto(pc.Vec3.ZERO);
        camera.nearClip = distance / 100;
        camera.farClip = distance * 2;

        const light = this.light;
        light.light.shadowDistance = distance * 2;

        this.cameraFocusBBox = bbox;
        this.prevCameraMat.copy(this.camera.getWorldTransform());
        this.resizeCanvas();
        this.app.on('update', this.update, this);
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
        var lightColor = new pc.Color(
            this.observer.get('lighting.mainLight.color_r')/ 255, 
            this.observer.get('lighting.mainLight.color_g')/ 255, 
            this.observer.get('lighting.mainLight.color_b')/ 255);
        light.addComponent("light", {
            type: "directional",
            color: lightColor,
            castShadows: this.observer.get('lighting.mainLight.shadow'),
            intensity: this.observer.get('lighting.mainLight.intencity'),
            shadowBias: 0.2,
            shadowDistance: 5,
            shadowIntensity: this.observer.get('lighting.mainLight.shadowIntencity'),
            normalOffsetBias: 0.05,
            shadowResolution: this.observer.get('lighting.mainLight.shadowResolution')
        });

        var rotation = new pc.Vec3(
            this.observer.get('lighting.mainLight.rotation_x'),
            this.observer.get('lighting.mainLight.rotation_y'),
            this.observer.get('lighting.mainLight.rotation_z'));
        light.setLocalEulerAngles(rotation);
        app.root.addChild(light);
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

        const tonemapping = observer.get('lighting.tonemapping');
        const mapping: Record<string, number> = {
            Linear: pc.TONEMAP_LINEAR,
            Filmic: pc.TONEMAP_FILMIC,
            Hejl: pc.TONEMAP_HEJL,
            ACES: pc.TONEMAP_ACES
        };
        this.app.scene.toneMapping = mapping.hasOwnProperty(tonemapping) ? mapping[tonemapping] : pc.TONEMAP_ACES;

        const hdr = observer.get('lighting.env.value');
        this.loadFiles([{ url: hdr, filename: hdr }]);

        const backgroundColor = observer.get('lighting.env.backgroundColor');
        const cnv = (value: number) => Math.max(0, Math.min(255, Math.floor(value * 255)));
        document.getElementById('canvas-wrapper').style.backgroundColor = `rgb(${cnv(backgroundColor.r)}, ${cnv(backgroundColor.g)}, ${cnv(backgroundColor.b)})`;

        const mip = observer.get('lighting.env.skyboxMip');
        this.app.scene.layers.getLayerById(pc.LAYERID_SKYBOX).enabled = (mip !== 0);
        this.app.scene.skyboxMip = mip - 1;
        this.app.scene.skyboxIntensity = Math.pow(2, observer.get('lighting.env.exposure'));

        const rot = new pc.Quat();
        rot.setFromEulerAngles(0, observer.get('lighting.env.rotation'), 0);
        this.app.scene.skyboxRotation = rot;

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
            this.renderNextFrame();
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
        this.renderNextFrame();
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

    //-----------------------------------
    
    //#region Drop Asset Handler
    canvas : HTMLCanvasElement
   
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

        // create the scene and debug root nodes
        const sceneRoot = new pc.Entity("sceneRoot", app);
        app.root.addChild(sceneRoot);
        this.sceneRoot = sceneRoot;

        this.entities = [];
        this.entityAssets = [];
        this.assets = [];
        this.meshInstances = [];
        this.sceneBounds = null;
    }

    //#endregion

    //-----------------------------------

    //#region canvas
    getCanvasSize() {
        return {
            width: document.body.clientWidth, 
            height: document.body.clientHeight
        };
    }
    resizeCanvas() {
        const device = this.app.graphicsDevice as pc.WebglGraphicsDevice;
        const canvasSize = this.getCanvasSize();

        device.maxPixelRatio = window.devicePixelRatio;
        this.app.resizeCanvas(canvasSize.width, canvasSize.height);
        this.renderNextFrame();
    }
    //#endregion
   
    //-----------------------------------

    //#region Life Cycle
    moved: boolean;
    update(deltaTime: number) {
        // update the orbit camera
        this.orbitCamera.update(deltaTime);

        const maxdiff = (a: pc.Mat4, b: pc.Mat4) => {
            let result = 0;
            for (let i = 0; i < 16; ++i) {
                result = Math.max(result, Math.abs(a.data[i] - b.data[i]));
            }
            return result;
        };
        
        // if the camera has moved since the last render
        const cameraWorldTransform = this.camera.getWorldTransform();
        if (maxdiff(cameraWorldTransform, this.prevCameraMat) > 1e-04) {
            this.prevCameraMat.copy(cameraWorldTransform);

            //const current = this.app.graphicsDevice.maxPixelRatio;
            this.app.graphicsDevice.maxPixelRatio = 1;
            this.moved = true;
            this.renderOnlyNextFrame();
        }
        else
        {
            var maxRatio = window.devicePixelRatio;
            const current = this.app.graphicsDevice.maxPixelRatio;
            const per = (maxRatio - 1) / 5;
            if(current != maxRatio && this.moved)
            {   
                this.app.graphicsDevice.maxPixelRatio = Math.min(maxRatio, current + per);
                this.renderOnlyNextFrame();
            }
            else
            {
                this.moved = false;
                this.app.graphicsDevice.maxPixelRatio = maxRatio;
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
        document.querySelector('#application-canvas').classList.add('no-cta');

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

    //#region calcBoundingBox
    // collects all mesh instances from entity hierarchy
    private collectMeshInstances(entity: pc.Entity) {
        const meshInstances: Array<pc.MeshInstance> = [];
        if (entity) {
            const components = entity.findComponents("render");
            for (let i = 0; i < components.length; i++) {
                const render = components[i] as pc.RenderComponent;
                const name = components[i].entity.name.toLowerCase();
                if(name.includes('wall'))
                {
                    if(name.includes('deleted'))
                    {
                        render.enabled = false;
                    }
                    render.castShadows = true;
                }
                else if(name.includes('roof') || name.includes('window')|| name.includes('edge'))
                {
                    render.castShadows = true;
                }
                else
                {
                    render.castShadows = false;
                }
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

    renderNextFrame() {
        this.app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        this.app.renderNextFrame = true;
    }
    renderOnlyNextFrame() {
        this.app.renderNextFrame = true;
    }
}

export default Viewer;
