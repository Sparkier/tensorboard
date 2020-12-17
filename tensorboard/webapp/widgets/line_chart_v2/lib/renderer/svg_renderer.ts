/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {Point, Polyline, Rect} from '../internal_types';
import {arePolylinesEqual} from '../utils';
import {
  CirclePaintOption,
  LinePaintOption,
  ObjectRenderer,
  TrianglePaintOption,
} from './renderer_types';

interface PathCacheValue {
  data: Polyline;
  dom: SVGPathElement;
}

interface CircleCacheValue {
  dom: SVGCircleElement;
  data: Point;
}

type CacheValue = PathCacheValue | CircleCacheValue;

function createOrUpdateObject<T extends SVGPathElement | SVGCircleElement>(
  prevDom: T | undefined,
  creator: () => T,
  updater: (el: T) => T,
  paintOpt: {visible: boolean; color: string; opacity?: number}
): T | null {
  const {color, visible, opacity} = paintOpt;
  let dom: T | undefined = prevDom;

  if (!dom) {
    // Skip if prevDom does not exist and Object is invisible
    if (!visible) return null;

    dom = creator();
  } else if (!visible) {
    dom.style.display = 'none';
    return dom;
  }

  dom = updater(dom);
  dom.style.display = '';
  dom.style.stroke = color;
  dom.style.opacity = String(opacity ?? 1);
  return dom;
}

export class SvgRenderer implements ObjectRenderer<CacheValue> {
  constructor(private readonly svg: SVGElement) {}

  flush() {
    // Svg can update the DOM right away when creating the object. No need to flush.
  }

  onResize(domRect: Rect): void {
    // Svg viewBox does not need to change with the container size.
  }

  destroyObject(cachedValue: CacheValue): void {
    this.svg.removeChild(cachedValue.dom);
  }

  private createPathDString(polyline: Polyline): string {
    if (!polyline.length) {
      return '';
    }

    const dBuilder: string[] = new Array(polyline.length / 2);
    dBuilder[0] = `M${polyline[0]},${polyline[1]}`;
    for (let index = 1; index < polyline.length / 2; index++) {
      dBuilder[index] = `L${polyline[index * 2]},${polyline[index * 2 + 1]}`;
    }
    return dBuilder.join('');
  }

  createOrUpdateLineObject(
    cachedLine: PathCacheValue | null,
    polyline: Polyline,
    paintOpt: LinePaintOption
  ): PathCacheValue | null {
    const svgPath = createOrUpdateObject(
      cachedLine?.dom,
      () => {
        const dom = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path'
        );
        dom.style.fill = 'none';
        const data = this.createPathDString(polyline);
        dom.setAttribute('d', data);
        this.svg.appendChild(dom);
        return dom;
      },
      (dom) => {
        if (
          !cachedLine?.data ||
          !arePolylinesEqual(polyline, cachedLine?.data)
        ) {
          const data = this.createPathDString(polyline);
          dom.setAttribute('d', data);
        }
        return dom;
      },
      paintOpt
    );

    if (svgPath === null) return null;

    svgPath.style.strokeWidth = String(paintOpt.width);
    return {dom: svgPath, data: polyline};
  }

  createOrUpdateTriangleObject(
    cached: PathCacheValue | null,
    loc: Point,
    paintOpt: TrianglePaintOption
  ): PathCacheValue | null {
    const {size, color} = paintOpt;
    const altitude = (size * Math.sqrt(3)) / 2;
    const vertices = new Float32Array([
      loc.x - size / 2,
      loc.y + altitude / 3,
      loc.x + size / 2,
      loc.y + altitude / 3,
      loc.x,
      loc.y - (altitude * 2) / 3,
    ]);

    const svgPath = createOrUpdateObject(
      cached?.dom,
      () => {
        const dom = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path'
        );

        dom.classList.add('triangle');
        dom.style.fill = 'none';
        const data = this.createPathDString(vertices);
        dom.setAttribute('d', data + 'Z');
        this.svg.appendChild(dom);
        return dom;
      },
      (dom) => {
        // Modifying/overwriting three vertices is cheap enough. Update always.
        const data = this.createPathDString(vertices);
        dom.setAttribute('d', data + 'Z');
        return dom;
      },
      paintOpt
    );

    if (svgPath === null) return null;

    svgPath.style.fill = color;
    return {
      dom: svgPath,
      data: vertices,
    };
  }

  createOrUpdateCircleObject(
    cached: CircleCacheValue | null,
    loc: Point,
    paintOpt: CirclePaintOption
  ): CircleCacheValue | null {
    const {color, radius} = paintOpt;

    const svgCircle = createOrUpdateObject(
      cached?.dom,
      () => {
        const dom = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'circle'
        );
        dom.style.fill = color;
        dom.setAttribute('cx', String(loc.x));
        dom.setAttribute('cy', String(loc.y));
        dom.setAttribute('r', String(radius));
        this.svg.appendChild(dom);
        return dom;
      },
      (dom) => {
        // Modifying/overwriting x, y, and r is cheap enough. Update always.
        dom.style.fill = color;
        dom.setAttribute('cx', String(loc.x));
        dom.setAttribute('cy', String(loc.y));
        dom.setAttribute('r', String(radius));
        return dom;
      },
      paintOpt
    );

    return svgCircle === null
      ? null
      : {
          dom: svgCircle,
          data: loc,
        };
  }
}
