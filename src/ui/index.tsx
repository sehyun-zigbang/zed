// import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';
import React from 'react';
import ReactDOM from 'react-dom';
import { Container, Spinner, Label, Button, TextInput, InfoBox } from '@playcanvas/pcui/react/unstyled';

import { getAssetPath } from '../helpers';
import { File, SetProperty, ObserverData } from '../types';
import LeftPanel from './left-panel';

const LoadControls = (props: { setProperty: SetProperty }) => {

    const onLoadModel = () => {
        // @ts-ignore
        var danjiId = document.getElementById('input-danjiId').ui.value;
        // @ts-ignore
        var roomTypeId = document.getElementById('input-roomtypeId').ui.value;
        // @ts-ignore
        var level = document.getElementById('input-level').ui.value;
        
        var asset_path = "https://raw.githubusercontent.com/sehyun-zigbang/zigbang-zed-viewer/feature/playcanvas-based/assets";
        
        var model_path = `${asset_path}/glTF/${danjiId}/${roomTypeId}`;
        var model_name = `${danjiId}_${roomTypeId}_${level}`;
        var name_glTF = `${model_name}.gltf`;
        var name_bin = `${model_name}.bin`;
        var url_glTF = `${model_path}/${name_glTF}`;
        var url_bin = `${model_path}/${name_bin}`;
        props.setProperty('scene.name', name_glTF);

        const viewer = (window as any).viewer;

        const loadList: Array<File> = [];
        loadList.push({
            url : url_glTF,
            filename : name_glTF
        });
        loadList.push({
            url : url_bin,
            filename : name_bin
        });
        viewer.loadFiles(loadList);
    };

    return (
        <div id='load-controls'>
            <Container class="load-button-panel" enabled flex>
                <div className='header'>
                    <img src={getAssetPath('zigbang-logo.jpg')}/>
                    <div>
                        <Label text='ZIGBANG MODEL VIEWER' />
                    </div>
                </div>
                <TextInput class='secondary' id='input-danjiId' placeholder='input danjiID' value = '19931'/>
                <TextInput class='secondary' id='input-roomtypeId' placeholder='input roomtypeID' value = '17493'/>
                <TextInput class='secondary' id='input-level' placeholder='input level' value = '0'/>
                <Button class='secondary' id='glb-url-button' text='LOAD MODEL' onClick={onLoadModel}></Button>
            </Container>
        </div>
    );
};

const ErrorBox = (props: { observerData: ObserverData }) => {
    return <InfoBox class="pcui-error" title='Error' hidden={!props.observerData.error} text={props.observerData.error} icon='E218'/>;
};

class App extends React.Component<{ observer: Observer }> {
    state: ObserverData;
    canvasRef: any;

    constructor(props: any) {
        super(props);

        this.canvasRef = React.createRef();
        this.state = this._retrieveState();

        props.observer.on('*:set', () => {
            // update the state
            this.setState(this._retrieveState());
        });
    }

    componentDidMount(): void {
        const resizeCanvas = () => {
            window.viewer?.observer.emit('canvasResized');
        };
        new ResizeObserver(resizeCanvas).observe(this.canvasRef.current);
    }

    _retrieveState = () => {
        const state: any = {};
        (this.props.observer as any)._keys.forEach((key: string) => {
            state[key] = this.props.observer.get(key);
        });
        return state;
    };

    _setStateProperty = (path: string, value: string) => {
        this.props.observer.set(path, value);
    };

    render() {
        return <div id="application-container">
            <Container id="panel-left" class={this.state.scene.nodes === '[]' ? 'empty' : null} flex resizable='right' resizeMin={220} resizeMax={800} onResize={() => this.props.observer.emit('canvasResized')}>
                <div className="header" style={{ display: 'none' }}>
                    <div id="title">
                        <img src={getAssetPath('zigbang-logo.jpg')}/>
                        <div>ZIGBANG MODEL VIEWER</div>
                    </div>
                </div>
                <div id="panel-toggle">
                    <img src={getAssetPath('zigbang-logo.jpg')}/>
                </div>
                <LeftPanel observerData={this.state} setProperty={this._setStateProperty} />
            </Container>
            <div id='canvas-wrapper'>
                <canvas id="application-canvas" ref={this.canvasRef} />
                <LoadControls setProperty={this._setStateProperty}/>
                <ErrorBox observerData={this.state} />
                <Spinner id="spinner" size={30} hidden={true} />
            </div>
        </div>;
    }
}

export default (observer: Observer) => {
    // render out the app
    ReactDOM.render(
        <App observer={observer}/>,
        document.getElementById('app')
    );
};
