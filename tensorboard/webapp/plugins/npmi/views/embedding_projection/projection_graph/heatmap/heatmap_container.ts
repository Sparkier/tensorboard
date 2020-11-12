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
import {Component, ChangeDetectionStrategy, Input} from '@angular/core';

import {Store, select} from '@ngrx/store';
import {map} from 'rxjs/operators';

import {State} from '../../../../../../app_state';
import {
  getEmbeddingDataSet,
  getEmbeddingsMetric,
  getEmbeddingsSidebarWidth,
  getProjection,
} from '../../../../store';
import {AnnotationDataListing} from '../../../../store/npmi_types';

/** @typehack */ import * as _typeHackRxjs from 'rxjs';

@Component({
  selector: 'npmi-heatmap',
  template: `
    <heatmap-component
      [width]="chartWidth$ | async"
      [filteredAnnotations]="filteredAnnotations"
      [umapIndices]="umapIndices"
      [embeddingDataSet]="embeddingDataSet$ | async"
      [projection]="projection$ | async"
      [metricName]="metricName$ | async"
      [margin]="margin"
      [drawMargin]="drawMargin"
    ></heatmap-component>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapContainer {
  @Input() filteredAnnotations!: AnnotationDataListing;
  @Input() umapIndices!: number[];
  @Input() margin!: {top: number; right: number; bottom: number; left: number};
  @Input() drawMargin!: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  readonly metricName$ = this.store.pipe(select(getEmbeddingsMetric));
  readonly chartWidth$ = this.store
    .pipe(select(getEmbeddingsSidebarWidth))
    .pipe(
      map((width) => {
        return Math.max(150, width);
      })
    );
  readonly embeddingDataSet$ = this.store.pipe(select(getEmbeddingDataSet));
  readonly projection$ = this.store.pipe(select(getProjection));

  constructor(private readonly store: Store<State>) {}
}
