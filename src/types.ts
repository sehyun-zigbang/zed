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
    lighting: {
        env: {
            value: string,
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
        tonemapping: string
    },
    scene: {
        bounds?: any,
        loadTime?: number,
        name?: string
    },
    spinner: boolean,
    error?: string,
    glbUrl?: string
}

export type SetProperty = (path: string, value: any) => void;
