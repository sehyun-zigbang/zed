import React, { useRef, useState } from 'react';
import { Container, Label, Button, TextInput } from '@playcanvas/pcui/react/unstyled';
import { getAssetPath } from '../helpers';

import { File, SetProperty } from '../types';

const LoadControls = (props: { setProperty: SetProperty }) => {
    const [urlInputValid, setUrlInputValid] = useState(false);
    const inputFile = useRef(null);

    const onLoadButtonClick = () => {
        // `current` points to the mounted file input element
        inputFile.current.click();
    };

    const onFileSelected = (event: React.ChangeEvent<any>) => {
        // `event` points to the selected file
        const viewer = (window as any).viewer;
        const files = event.target.files;
        if (viewer && files.length) {
            const loadList: Array<File> = [];
            for (let i = 0; i < files.length; ++i) {
                const file = files[i];
                loadList.push({
                    url: URL.createObjectURL(file),
                    filename: file.name
                });
            }
            viewer.loadFiles(loadList);
        }
    };

    const onUrlSelected = () => {
        const viewer = (window as any).viewer;
        // @ts-ignore
        const url = document.getElementById('glb-url-input').ui.value;
        const loadList: Array<File> = [];
        let filename = url.split('/').pop();
        if (filename.indexOf('.glb') === -1) {
            if (filename.indexOf('?') === -1) {
                filename += '.glb';
            } else {
                filename = filename.split('?')[0] + '.glb';
            }
        }
        loadList.push({
            url,
            filename
        });
        viewer.loadFiles(loadList);
        props.setProperty('glbUrl', url);
    };

    const onLoadModel = () => {
        // @ts-ignore
        var danjiId = document.getElementById('input-danjiId').ui.value;
        // @ts-ignore
        var roomTypeId = document.getElementById('input-roomtypeId').ui.value;
        // @ts-ignore
        var level = document.getElementById('input-level').ui.value;
        
        var asset_path = "https://raw.githubusercontent.com/sehyun-zigbang/zigbang-zed-viewer/feature/playcanvas-based/assets";
        
        var model_path = `${asset_path}/glTF/${danjiId}/${roomTypeId}`;

        var name_glTF = `${danjiId}_${roomTypeId}_${level}.gltf`;
        var name_bin = `${danjiId}_${roomTypeId}_${level}.bin`;
        var url_glTF = `${model_path}/${name_glTF}`;
        var url_bin = `${model_path}/${name_bin}`;
        // var url_textures = `${asset_path}/textures`;

        // console.log(`danjiId : ${danjiId} / roomTypeId : ${roomTypeId} / level : ${level}`);
        // console.log(url_glTF);
        // console.log(url_bin);
        // console.log(url_textures);
        // console.log(name_glTF);
        // console.log(name_bin);

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
                {/* <div className='header'>
                    <img src={getAssetPath('zigbang-logo.jpg')}/>
                    <div>
                        <Label text='ZIGBANG MODEL VIEWER' />
                    </div>
                    <Button onClick={() => {
                        window.open('https://github.com/playcanvas/model-viewer', '_blank').focus();
                    }} icon='E259'/>
                </div>
                <input type='file' id='file' multiple onChange={onFileSelected} ref={inputFile} style={{ display: 'none' }} />
                <div id="drag-drop" onClick={onLoadButtonClick}>
                    <Button id="drag-drop-search-icon" icon='E129' />
                    <Label class='desktop' text="Drag & drop your files or click to open files" />
                    <Label class='mobile' text="Click to open files" />
                </div>
                <Label id='or-text' text="OR" class="centered-label" />
                <TextInput class='secondary' id='glb-url-input' placeholder='enter url' keyChange onValidate={(value: string) => {
                    const urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
                    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
                    '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
                    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
                    '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
                    '(\\#[-a-z\\d_]*)?$', 'i'); // validate fragment locator
                    const isValid = !!urlPattern.test(value);
                    setUrlInputValid(isValid);
                    return isValid;
                }}/>
                <Button class='secondary' id='glb-url-button' text='LOAD MODEL FROM URL' onClick={onUrlSelected} enabled={urlInputValid}></Button> */}
                
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

export default LoadControls;
