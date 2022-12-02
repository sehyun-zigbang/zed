// import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';
import React from 'react';
import ReactDOM from 'react-dom';
import { Spinner, InfoBox } from '@playcanvas/pcui/react/unstyled';
import { ObserverData } from '../types';

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
            <div id='canvas-wrapper'>
                <canvas id="application-canvas" ref={this.canvasRef} />
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
