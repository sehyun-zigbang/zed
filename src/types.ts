export interface File {
    url: string,
    filename?: string
}

export interface Option {
    v: string | number | null,
    t: string
}

export interface HierarchyNode {
    name: string,
    path: string,
    children: Array<HierarchyNode>
}
export interface ObserverData {
    ui: {
        active?: string
    },
    render: {
        multisampleSupported: boolean,
        multisample: boolean,
        hq: boolean,
        pixelScale: number
    },
    show: {
        stats: boolean,
        wireframe: boolean,
        bounds: boolean,
        skeleton: boolean,
        axes: boolean,
        grid: boolean,
        normals: number,
        fov: number
    },
    lighting: {
        direct: number,
        env: {
            value: string,
            options: null,
            default: null,
            skyboxMip: string,
            exposure: number,
            backgroundColor: {
                r: number,
                g: number,
                b: number
            },
            rotation: number
        },
        mainLight: {
            intencity: number,
            color_r : number,
            color_g : number,
            color_b : number,
            rotation_x : number,
            rotation_y : number,
            rotation_z : number,
            shadow: boolean,
            shadowResolution : number,
            shadowIntencity : number
        },
        subLight: {
            intencity: number,
            color_r : number,
            color_g : number,
            color_b : number,
            rotation_x : number,
            rotation_y : number,
            rotation_z : number
        },
        tonemapping: string
    },
    scene: {
        nodes: string,
        selectedNode: {
            path: string,
            name?: string,
            position: {
                0: number,
                1: number,
                2: number
            },
            rotation: {
                0: number,
                1: number,
                2: number,
                3: number
            },
            scale: {
                0: number,
                1: number,
                2: number
            }
        },
        meshCount?: number,
        vertexCount?: number,
        primitiveCount?: number,
        bounds?: any,
        variant: {
            selected: number
        },
        variants: {
            list: string
        },
        loadTime?: number
    },
    scripts:{
        ssao: {
            enabled: boolean,
            radius: number,
            samples: number,
            brightness: number,
            downscale: number
        }
    },
    spinner: boolean,
    error?: string,
    xrSupported: boolean,
    xrActive: boolean,
    glbUrl?: string
}

export type SetProperty = (path: string, value: any) => void;
