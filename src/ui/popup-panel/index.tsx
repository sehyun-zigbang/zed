import React from 'react';
import { Observer } from '@playcanvas/observer';
import { Container, Button, Label, TextInput } from '@playcanvas/pcui/react/unstyled';
import { SetProperty, ObserverData } from '../../types';
// @ts-ignore no type defs included
import * as pcx from 'playcanvas/build/playcanvas-extras.js';
import { addEventListenerOnClickOnly } from '../../helpers';
// @ts-ignore no type defs included
import QRious from 'qrious';

class ViewPanel extends React.Component <{ uiData: ObserverData['ui'], glbUrl: string, setProperty: SetProperty }> {
    isMobile: boolean;

    get shareUrl() {
        return `${location.origin}${location.pathname}/?load=${this.props.glbUrl}`;
    }

    constructor(props: any) {
        super(props);
        this.isMobile = (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }

    shouldComponentUpdate(nextProps: Readonly<{ uiData: ObserverData['ui']; glbUrl: string, setProperty: SetProperty; }>): boolean {
        return JSON.stringify(nextProps.uiData) !== JSON.stringify(this.props.uiData) ||
        nextProps.glbUrl !== this.props.glbUrl;
    }

    updateQRCode() {
        const canvas = document.getElementById('share-qr');
        const qr = new QRious({
            element: canvas,
            value: this.shareUrl
        });
    }

    componentDidMount() {
        if (this.props.glbUrl) {
            this.updateQRCode();
        }
    }

    componentDidUpdate(): void {
        if (this.props.glbUrl) {
            this.updateQRCode();
        }
    }

    render() {
        const props = this.props;
        return (
            <div className='popup-panel-parent'>
                <Container id='view-panel' class='popup-panel' flex hidden={props.uiData.active !== 'view'}>
                    { this.props.glbUrl && !this.isMobile ?
                        <>
                            <Label text='View and share on mobile with QR code' />
                            <div id='qr-wrapper'>
                                <canvas id='share-qr' />
                            </div>
                            <Label text='View and share on mobile with URL' />
                            <div id='share-url-wrapper'>
                                <TextInput class='secondary' value={this.shareUrl} enabled={false} />
                                <Button id='copy-button' icon='E126' onClick={() => {
                                    if (navigator.clipboard && window.isSecureContext) {
                                        navigator.clipboard.writeText(this.shareUrl);
                                    }
                                }}/>
                            </div>
                        </> : null }
                    <Button class='secondary' text='TAKE A SNAPSHOT AS PNG' onClick={() => {
                        if (window.viewer) window.viewer.downloadPngScreenshot();
                    }}/>
                </Container>
            </div>
        );
    }
}

const PopupPanelControls = (props: { observerData: ObserverData, setProperty: SetProperty }) => {
    return (<>
        <ViewPanel setProperty={props.setProperty} glbUrl={props.observerData.glbUrl} uiData={props.observerData.ui} />
    </>);
};

class PopupButtonControls extends React.Component <{ observerData: ObserverData, setProperty: SetProperty }> {
    popupPanelElement: any;
    render() {
        let removeDeselectEvents: any;
        const handleClick = (value: string) => {
            this.props.setProperty('ui.active', this.props.observerData.ui.active === value ? null : value);

            // after a popup button is set active, listen for another click outside the panel to deactivate it
            if (!this.popupPanelElement) this.popupPanelElement = document.getElementById('popup');
            // add the event listener after the current click is complete
            setTimeout(() => {
                if (removeDeselectEvents) removeDeselectEvents();
                const deactivateUi = (e: any) => {
                    if (this.popupPanelElement.contains(e.target)) {
                        return;
                    }
                    this.props.setProperty('ui.active', null);
                    removeDeselectEvents();
                    removeDeselectEvents = null;
                };
                removeDeselectEvents = addEventListenerOnClickOnly(document.body, deactivateUi, 4);
            });
        };

        const buildClass = (value: string) => {
            return (this.props.observerData.ui.active === value) ? ['popup-button', 'selected'] : 'popup-button';
        };

        return (
            <div id='popup-button'>
                <Button class={buildClass('view')} icon='E301' width={40} height={40} onClick={() => handleClick('view')} />
            </div>
        );
    }
}

const toggleCollapsed = () => {
    document.getElementById('panel-left').classList.toggle('collapsed');
    const observer: Observer = (window.observer as any);
    if (observer) observer.emit('canvasResized');
};

class PopupPanel extends React.Component <{ observerData: ObserverData, setProperty: SetProperty }> {
    link: HTMLAnchorElement;
    usdzExporter: any;

    get hasArSupport() {
        return this.props.observerData.xrSupported || this.usdzExporter;
    }

    constructor(props: any) {
        super(props);
        this.link = (document.getElementById('ar-link') as HTMLAnchorElement);
        if (this.link.relList.supports("ar")) {
            this.usdzExporter = new (pcx as any).UsdzExporter();
        }
    }

    render() {
        return (<div id='popup' className={this.props.observerData.scene.nodes === '[]' ? 'empty' : null}>
            <PopupPanelControls observerData={this.props.observerData} setProperty={this.props.setProperty} />
            <div id='floating-buttons-parent'>
                {/* <Button class='popup-button' icon='E189' hidden={!this.hasArSupport || this.props.observerData.scene.nodes === '[]'} width={40} height={40} onClick={() => {
                    if (this.usdzExporter) {
                        const sceneRoot = (window as any).pc.app.root.findByName('sceneRoot');
                        // convert the loaded entity into asdz file
                        this.usdzExporter.build(sceneRoot).then((arrayBuffer: any) => {
                            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                            this.link.href = URL.createObjectURL(blob);
                            this.link.click();
                        }).catch(console.error);
                    } else {
                        if (window.viewer) window.viewer.startXr();
                    }
                } } /> */}
                
                <PopupButtonControls observerData={this.props.observerData} setProperty={this.props.setProperty} />
            </div>
        </div>);
    }
}

export default PopupPanel;
