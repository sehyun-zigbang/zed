import React from 'react';
import { Container, BooleanInput, Label, SliderInput, VectorInput, SelectInput } from '@playcanvas/pcui/react/unstyled';
import { Option } from '../../types';

export const Detail = (props: { label: string, value:string|number}) => {
    return <Container class='panel-option'>
        <Label class='panel-label' text={props.label} />
        <Label class='panel-value' text={props.value}/>
    </Container>;
};

export const Vector = (props: { label: string, value:any, dimensions: 2 | 3 | 4, enabled?: boolean}) => {
    return <Container class='panel-option'>
        <Label class='panel-label' text={props.label} />
        <VectorInput class='panel-value' dimensions={props.dimensions} enabled={props.enabled} value={props.value} />
    </Container>;
};

export const Toggle = (props: { label: string, enabled?: boolean, setProperty: (value: boolean) => void, value: boolean }) => {
    return <Container class='panel-option'>
        <Label class='panel-label' text={props.label} />
        <BooleanInput class='panel-value-boolean' type='toggle' enabled={props.enabled} value={props.value} onChange={(value: boolean) => props.setProperty(value)} />
    </Container>;
};
Toggle.defaultProps = { enabled: true };

export const Slider = (props: { label: string, value: number, setProperty: (value: number) => void, precision: number, min: number, max: number, enabled?: boolean }) => {
    return <Container class='panel-option'>
        <Label class='panel-label' text={props.label} />
        <SliderInput class='panel-value' min={props.min} max={props.max} sliderMin={props.min} sliderMax={props.max} precision={props.precision} step={0.01} enabled={props.enabled}
            onChange={(value: any) => {
                props.setProperty(value);
            }}
            value={props.value}
        />
    </Container>;
};
Slider.defaultProps = { enabled: true };

export const Select = (props: { label: string, value:any, setProperty: (value: any) => void, type: string, options: Array<Option>, enabled?: boolean }) => {
    return <Container class='panel-option'>
        <Label class='panel-label' text={props.label} />
        <SelectInput class='panel-value' type={props.type} options={props.options} enabled={props.enabled} value={props.value}
            onChange={(value: any) => {
                props.setProperty(value);
            }}
        />
    </Container>;
};
Select.defaultProps = { enabled: true };

