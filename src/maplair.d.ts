/**
 * The parts of Maplair used by DinoData: maplair 4.3.0 on npm lacks its
 * `dist/types`, although its package.json declares them. Remove this file
 * once a release ships them.
 */
declare module "maplair" {
  type LatLngExpression = [number, number] | { lat: number; lng: number };
  type LatLngBoundsExpression = [LatLngExpression, LatLngExpression];

  interface LatLng {
    lat: number;
    lng: number;
  }

  interface LatLngBounds {
    contains(latlng: LatLngExpression): boolean;
  }

  interface PathOptions {
    color?: string;
    weight?: number;
    fillOpacity?: number;
    interactive?: boolean;
  }

  class Layer {
    addTo(map: MaplairMap | LayerGroup): this;
    remove(): this;
  }

  export class LayerGroup extends Layer {
    clearLayers(): this;
  }

  export class TileLayer extends Layer {
    constructor(
      url: string,
      options?: { maxZoom?: number; attribution?: string },
    );
  }

  export class Polyline extends Layer {
    constructor(latlngs: LatLngExpression[], options?: PathOptions);
  }

  export class Rectangle extends Layer {
    constructor(bounds: LatLngBoundsExpression, options?: PathOptions);
  }

  export class CircleMarker extends Layer {
    constructor(
      latlng: LatLngExpression,
      options?: PathOptions & { radius?: number },
    );
  }

  export class Circle extends Layer {
    constructor(
      latlng: LatLngExpression,
      options?: PathOptions & { radius: number },
    );
  }

  export interface MapMouseEvent {
    latlng: LatLng;
  }

  export class MaplairMap {
    constructor(element: HTMLElement | string, options?: object);
    setView(center: LatLngExpression, zoom?: number): this;
    getCenter(): LatLng;
    getZoom(): number;
    getBounds(): LatLngBounds;
    wrapLatLng(latlng: LatLngExpression): LatLng;
    on(type: "click", fn: (event: MapMouseEvent) => void): this;
    on(type: string, fn: () => void): this;
    remove(): this;
  }
}

declare module "maplair/styles.css";
