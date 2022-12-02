import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';

import { getAssetPath } from './helpers';
import { File, Option, ObserverData } from './types';
import { initMaterials } from './material';
import initializeUI from './ui';
import Viewer from './viewer';
import './style.scss';

// Permit some additional properties to be set on the window
declare global {
    interface Window {
        pc: any;
        viewer: Viewer;
    }
}

interface Skybox {
    url: string,
    label: string
}

const observerData: ObserverData = {
    lighting: {
        env: {
            value: getAssetPath('./skybox/photo_studio_broadway_hall_2k.hdr'),
            skyboxMip: '0',
            exposure: -1,
            backgroundColor: { r: 0.4, g: 0.45, b: 0.5 },
            rotation: 0
        },
        mainLight: {
            intencity: 1,
            color_r: 255,
            color_g: 255,
            color_b: 255,
            rotation_x: 30,
            rotation_y: 45,
            rotation_z: 0,
            shadow: false,
            shadowResolution: 2048,
            shadowIntencity: 1
        },
        tonemapping: 'ACES'
    },
    scene: {
        bounds: null,
        loadTime: null,
        name: null
    },
    spinner: false,
    error: null,
    glbUrl: null
};

// initialize the apps state
const observer: Observer = new Observer(observerData);

const saveOptions = (name: string) => {
    const options = observer.json();
    window.localStorage.setItem(`model-viewer-${name}`, JSON.stringify({
        render: options.render,
        show: options.show,
        lighting: options.lighting
    }));
};

const loadOptions = (name: string) => {
    const loadRec = (path: string, value:any) => {
        const filter = ['lighting.env.options'];
        if (filter.indexOf(path) !== -1) {
            return;
        }
        if (typeof value === 'object') {
            Object.keys(value).forEach((k) => {
                loadRec(path ? `${path}.${k}` : k, value[k]);
            });
        } else {
            if (observer.has(path)) {
                observer.set(path, value);
            }
        }
    };

    const options = window.localStorage.getItem(`model-viewer-${name}`);
    if (options) {
        try {
            loadRec('', JSON.parse(options));
        } catch { }
    }
};

initMaterials();
initializeUI(observer);

window.pc = pc;

pc.basisInitialize({
    glueUrl: getAssetPath('lib/basis/basis.wasm.js'),
    wasmUrl: getAssetPath('lib/basis/basis.wasm.wasm'),
    fallbackUrl: getAssetPath('lib/basis/basis.js'),
    lazyInit: true
});

// @ts-ignore
pc.WasmModule.setConfig('DracoDecoderModule', {
    glueUrl: getAssetPath('lib/draco/draco.wasm.js'),
    wasmUrl: getAssetPath('lib/draco/draco.wasm.wasm'),
    fallbackUrl: getAssetPath('lib/draco/draco.js')
});

// hide / show spinner when loading files
observer.on('spinner:set', (value: boolean) => {
    const spinner = document.getElementById('spinner');
    if (value) {
        spinner.classList.remove('pcui-hidden');
    } else {
        spinner.classList.add('pcui-hidden');
    }
});

const url = getAssetPath("asset_manifest.json");
new pc.Http().get(url, {
    cache: true,
    responseType: "text",
    retry: false
}, function (err: string, result: { skyboxes: Array<Skybox>, defaultSkybox: string }) {
    if (err) {
        console.warn(err);
    } else {
        const skyboxes = result.skyboxes;
        const skyboxOptions: Array<Option> = [{
            v: 'None', t: 'None'
        }];
        skyboxes.forEach((skybox: Skybox) => {
            skyboxOptions.push({ v: getAssetPath(skybox.url), t: skybox.label });
        });
        const skyboxData = observer.get('lighting.env');
        skyboxData.options = JSON.stringify(skyboxOptions);
        skyboxData.default = getAssetPath(result.defaultSkybox);
        observer.set('lighting.env', skyboxData);
 
        const canvas = document.getElementById("application-canvas") as HTMLCanvasElement;
        window.viewer = new Viewer(canvas, observer);

        const loadList: Array<File> = [];
        loadList.push({
            url : getAssetPath('./model/sample.glb'),
            filename : 'sample.glb'
        });
        window.viewer.loadFiles(loadList);
    }
}
);
