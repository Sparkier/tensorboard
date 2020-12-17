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

import {Point} from './internal_types';
import {
  CirclePaintOption,
  LinePaintOption,
  ObjectRenderer,
  TrianglePaintOption,
} from './renderer/renderer_types';

export interface PaintBrushContext<T = any> {
  renderCache: {
    getFromPreviousFrame(cacheKey: string): T;
    setToCurrentFrame(cacheKey: string, obj: T): void;
  };
}

export class PaintBrush {
  constructor(
    private readonly context: PaintBrushContext,
    private readonly renderer: ObjectRenderer
  ) {}

  setLine(cacheId: string, polyline: Float32Array, paintOpt: LinePaintOption) {
    const newCacheValue = this.renderer.createOrUpdateLineObject(
      this.context.renderCache.getFromPreviousFrame(cacheId),
      polyline,
      paintOpt
    );
    this.context.renderCache.setToCurrentFrame(cacheId, newCacheValue);
  }

  setTriangle(cacheId: string, loc: Point, paintOpt: TrianglePaintOption) {
    const newCacheValue = this.renderer.createOrUpdateTriangleObject(
      this.context.renderCache.getFromPreviousFrame(cacheId),
      loc,
      paintOpt
    );
    this.context.renderCache.setToCurrentFrame(cacheId, newCacheValue);
  }

  setCircle(cacheId: string, loc: Point, paintOpt: CirclePaintOption) {
    const newCacheValue = this.renderer.createOrUpdateCircleObject(
      this.context.renderCache.getFromPreviousFrame(cacheId),
      loc,
      paintOpt
    );
    this.context.renderCache.setToCurrentFrame(cacheId, newCacheValue);
  }
}
