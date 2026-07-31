declare module 'dom-to-image-more' {
    export interface DomToImageOptions {
        filter?: (node: Node) => boolean;
        bgcolor?: string;
        width?: number;
        height?: number;
        style?: Record<string, string>;
        quality?: number;
        imagePlaceholder?: string;
        cacheBust?: boolean;
    }

    export function toSvg(node: Node, options?: DomToImageOptions): Promise<string>;
    export function toPng(node: Node, options?: DomToImageOptions): Promise<string>;
    export function toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
    export function toBlob(node: Node, options?: DomToImageOptions): Promise<Blob>;
    export function toPixelData(node: Node, options?: DomToImageOptions): Promise<Uint8Array>;

    const domtoimage: {
        toSvg: typeof toSvg;
        toPng: typeof toPng;
        toJpeg: typeof toJpeg;
        toBlob: typeof toBlob;
        toPixelData: typeof toPixelData;
    };

    export default domtoimage;
}
