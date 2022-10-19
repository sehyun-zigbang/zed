import React from 'react';
import { Panel, Container } from '@playcanvas/pcui/react/unstyled';
import { SetProperty, ObserverData } from '../../types';

import { Vector, Detail, Select, Slider, Toggle } from '../components';

const toggleCollapsed = () => {
    const leftPanel = document.getElementById('panel-left');
    if (leftPanel) {
        leftPanel.classList.toggle('collapsed');
    }
};

let leftPanel: any;
const openPanel = () => {
    if (!leftPanel) {
        leftPanel = document.getElementById('panel-left');
    }
    if (leftPanel && leftPanel.classList.contains('collapsed')) {
        leftPanel.classList.remove('collapsed');
    }
};

class ScenePanel extends React.Component <{ sceneData: ObserverData['scene'], setProperty: SetProperty }> {
    shouldComponentUpdate(nextProps: Readonly<{ sceneData: ObserverData['scene']; setProperty: SetProperty; }>): boolean {
        return (
            nextProps.sceneData.loadTime !== this.props.sceneData.loadTime ||
            nextProps.sceneData.meshCount !== this.props.sceneData.meshCount ||
            nextProps.sceneData.vertexCount !== this.props.sceneData.vertexCount ||
            nextProps.sceneData.primitiveCount !== this.props.sceneData.primitiveCount ||
            nextProps.sceneData.bounds !== this.props.sceneData.bounds ||
            nextProps.sceneData.variant.selected !== this.props.sceneData.variant.selected ||
            nextProps.sceneData.variants.list !== this.props.sceneData.variants.list
        );
    }

    render() {
        const scene = this.props.sceneData;
        const variantListOptions: Array<{ v:string, t:string }> = JSON.parse(scene.variants.list).map((variant: string) => ({ v: variant, t: variant }));
        return (
            <Panel headerText='SCENE' id='scene-panel' flexShrink={0} flexGrow={0} collapsible={false} >
                <Detail label='Load time' value={scene.loadTime} />
                <Detail label='Meshes' value={scene.meshCount} />
                <Detail label='Verts' value={scene.vertexCount} />
                <Detail label='Primitives' value={scene.primitiveCount} />
                <Vector label='Bounds' dimensions={3} value={scene.bounds} enabled={false}/>
                <Select label='Variant' type='string' options={variantListOptions} value={scene.variant.selected}
                    setProperty={(value: string) => {
                        this.props.setProperty('scene.variant.selected', value);
                    }}
                    enabled={ variantListOptions.length > 0 }
                />
            </Panel>
        );
    }
}
class CameraPanel extends React.Component <{ observerData: ObserverData, setProperty: SetProperty }> {
    shouldComponentUpdate(nextProps: Readonly<{ observerData: ObserverData; setProperty: SetProperty; }>): boolean {
        return JSON.stringify(nextProps.observerData) !== JSON.stringify(this.props.observerData);
    }

    render() {
        const props = this.props;
        return (
            <Panel headerText='CAMERA' id='scene-panel' flexShrink={0} flexGrow={0} collapsible={false} >
                <Slider label='Fov' precision={0} min={35} max={150} value={props.observerData.show.fov} setProperty={(value: number) => props.setProperty('show.fov', value)} />
                <Select label='Tonemap' type='string' options={['Linear', 'Filmic', 'Hejl', 'ACES'].map(v => ({ v, t: v }))} value={props.observerData.lighting.tonemapping} setProperty={(value: number) => props.setProperty('lighting.tonemapping', value)} />
                <Select label='Pixel Scale' value={props.observerData.render.pixelScale} type='number' options={[1, 2, 4, 8, 16].map(v => ({ v: v, t: Number(v).toString() }))} setProperty={(value: number) => props.setProperty('render.pixelScale', value)} />
                <Toggle label='Multisample' value={props.observerData.render.multisample} enabled={props.observerData.render.multisampleSupported}
                    setProperty={(value: boolean) => props.setProperty('render.multisample', value)}
                />
                <Toggle label='High Quality' value={props.observerData.render.hq} enabled={!props.observerData.animation.playing && !props.observerData.show.stats}
                    setProperty={(value: boolean) => props.setProperty('render.hq', value)}
                />
                <Toggle label='Stats' value={props.observerData.show.stats}
                    setProperty={(value: boolean) => props.setProperty('show.stats', value)}
                />
            </Panel>
        );
    }
}
class LightingPanel extends React.Component <{ lightingData: ObserverData['lighting'], uiData: ObserverData['ui'], setProperty: SetProperty }> {
    shouldComponentUpdate(nextProps: Readonly<{ lightingData: ObserverData['lighting']; uiData: ObserverData['ui']; setProperty: SetProperty; }>): boolean {
        return JSON.stringify(nextProps.lightingData) !== JSON.stringify(this.props.lightingData) || JSON.stringify(nextProps.uiData) !== JSON.stringify(this.props.uiData);
    }

    render() {
        const props = this.props;
        return (
            <Panel headerText='LIGHTING' id='scene-panel' flexShrink={0} flexGrow={0} collapsible={false} >
                    <Select label='Environment' type='string' options={JSON.parse(props.lightingData.env.options)} value={props.lightingData.env.value} setProperty={(value: string) => props.setProperty('lighting.env.value', value)} />
                    <Select label='Skybox Level' type='number' options={[0, 1, 2, 3, 4, 5, 6].map(v => ({ v: v, t: v === 0 ? 'Disable' : Number(v - 1).toString() }))} value={props.lightingData.env.skyboxMip} setProperty={(value: number) => props.setProperty('lighting.env.skyboxMip', value)} />
                    <Slider label='Exposure' precision={2} min={-6} max={6} value={props.lightingData.env.exposure} setProperty={(value: number) => props.setProperty('lighting.env.exposure', value)} />
                    <Slider label='Rotation' precision={0} min={-180} max={180} value={props.lightingData.rotation} setProperty={(value: number) => props.setProperty('lighting.rotation', value)} />
                    <Slider label='Direct' precision={2} min={0} max={6} value={props.lightingData.direct} setProperty={(value: number) => props.setProperty('lighting.direct', value)} />
                    <Toggle label='Shadow' value={props.lightingData.shadow} setProperty={(value: boolean) => props.setProperty('lighting.shadow', value)} />
            </Panel>
        );
    }
}
class ShowPanel extends React.Component <{ showData: ObserverData['show'], uiData: ObserverData['ui'], setProperty: SetProperty }> {
    shouldComponentUpdate(nextProps: Readonly<{ showData: ObserverData['show']; uiData: ObserverData['ui']; setProperty: SetProperty; }>): boolean {
        return JSON.stringify(nextProps.showData) !== JSON.stringify(this.props.showData) || JSON.stringify(nextProps.uiData) !== JSON.stringify(this.props.uiData);
    }

    render() {
        const props = this.props;
        return (
            <Panel headerText='DEBUG' id='scene-panel' flexShrink={0} flexGrow={0} collapsible={false} >
                    <Toggle label='Grid' value={props.showData.grid} setProperty={(value: boolean) => props.setProperty('show.grid', value)}/>
                    <Toggle label='Wireframe' value={props.showData.wireframe} setProperty={(value: boolean) => props.setProperty('show.wireframe', value)} />
                    <Toggle label='Axes' value={props.showData.axes} setProperty={(value: boolean) => props.setProperty('show.axes', value)} />
                    <Toggle label='Skeleton' value={props.showData.skeleton} setProperty={(value: boolean) => props.setProperty('show.skeleton', value)} />
                    <Toggle label='Bounds' value={props.showData.bounds} setProperty={(value: boolean) => props.setProperty('show.bounds', value)} />
                    <Slider label='Normals' precision={2} min={0} max={1} setProperty={(value: number) => props.setProperty('show.normals', value)} value={props.showData.normals} />
            </Panel>
        );
    }
}

class LeftPanel extends React.Component <{ observerData: ObserverData, setProperty: SetProperty }> {
    isMobile: boolean;
    constructor(props: any) {
        super(props);
        this.isMobile = (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }

    shouldComponentUpdate(nextProps: Readonly<{ observerData: ObserverData; setProperty: SetProperty; }>): boolean {
        return JSON.stringify(nextProps.observerData.scene) !== JSON.stringify(this.props.observerData.scene);
    }

    componentDidMount(): void {
        // set up the control panel toggle button
        // @ts-ignore
        document.getElementById('panel-toggle').addEventListener('click', function () {
            toggleCollapsed();
        });
        // @ts-ignore
        document.getElementById('title').addEventListener('click', function () {
            toggleCollapsed();
        });
        // we require this setTimeout because panel isn't yet created and so fails
        // otherwise.
        setTimeout(() => toggleCollapsed());
    }

    componentDidUpdate(prevProps: Readonly<{ observerData: ObserverData; setProperty: SetProperty; }>): void {
        if (!this.isMobile && prevProps.observerData.scene.nodes === '[]' && this.props.observerData.scene.nodes !== '[]') {
            openPanel();
        }
    }

    render() {
        const scene = this.props.observerData.scene;
        return (
            <Container id='scene-container' flex>
                <div id='scene-scrolly-bits'>
                    <ScenePanel sceneData={scene} setProperty={this.props.setProperty} />
                    <CameraPanel setProperty={this.props.setProperty} observerData={this.props.observerData} />
                    <LightingPanel setProperty={this.props.setProperty} lightingData={this.props.observerData.lighting} uiData={this.props.observerData.ui} />
                    <ShowPanel setProperty={this.props.setProperty} showData={this.props.observerData.show} uiData={this.props.observerData.ui} />    
                </div>
            </Container>
        );
    }
}

export default LeftPanel;
