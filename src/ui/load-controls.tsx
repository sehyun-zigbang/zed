import React from 'react';
import { Container, Label, Button, TextInput } from '@playcanvas/pcui/react/unstyled';
import { getAssetPath } from '../helpers';

import { File, SetProperty } from '../types';

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
        var name_glTF = `${danjiId}_${roomTypeId}_${level}.gltf`;
        var name_bin = `${danjiId}_${roomTypeId}_${level}.bin`;
        var url_glTF = `${model_path}/${name_glTF}`;
        var url_bin = `${model_path}/${name_bin}`;
        
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

export default LoadControls;
