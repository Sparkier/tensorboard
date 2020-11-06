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
import {Component, ChangeDetectionStrategy} from '@angular/core';

import {Store, select} from '@ngrx/store';
import {map} from 'rxjs/operators';
import {combineLatest} from 'rxjs';

import {State} from '../../../../../app_state';
import {
  getEmbeddingDataSet,
  getEmbeddingsMetric,
  getEmbeddingsSidebarWidth,
  getEmbeddingStatusMessage,
  getAnnotationData,
  getHiddenAnnotations,
  getShowHiddenAnnotations,
  getMetricArithmetic,
  getMetricFilters,
  getAnnotationsRegex,
  getRunToMetrics,
  getEmbeddingFilter,
  getProjection,
} from '../../../store';
import {getRunSelection} from '../../../../../core/store/core_selectors';
import {
  filterAnnotations,
  removeHiddenAnnotations,
} from '../../../util/filter_annotations';
import {metricIsNpmiAndNotDiff} from '../../../util/metric_type';
import * as npmiActions from '../../../actions';
import {DataSet} from '../../../umap/data';

/** @typehack */ import * as _typeHackRxjs from 'rxjs';
import {filterUmapIndices} from '../../../util/umap_indices';

@Component({
  selector: 'npmi-projection-graph',
  template: `
    <projection-graph-component
      [metricName]="metricName$ | async"
      [width]="chartWidth$ | async"
      [embeddingDataSet]="embeddingDataSet$ | async"
      [embeddingStatusMessage]="embeddingStatusMessage$ | async"
      [filteredAnnotations]="filteredAnnotations$ | async"
      [embeddingFilter]="embeddingFilter$ | async"
      [umapIndices]="umapIndices$ | async"
      [projection]="projection$ | async"
      (onChangeStatusMessage)="changeStatusMessage($event)"
      (onChangeEmbeddingDataSet)="changeEmbeddingDataSet($event)"
      (onChangeEmbeddingFilter)="changeEmbeddingFilter($event)"
    ></projection-graph-component>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionGraphContainer {
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
  readonly embeddingStatusMessage$ = this.store.pipe(
    select(getEmbeddingStatusMessage)
  );
  readonly activeRuns$ = this.store.pipe(select(getRunSelection)).pipe(
    map((runSelection) => {
      if (!runSelection) return [];
      return Array.from(runSelection.entries())
        .filter((run) => run[1])
        .map((run) => run[0]);
    })
  );
  readonly activeMetrics$ = combineLatest([
    this.store.select(getRunToMetrics),
    this.activeRuns$,
    this.store.select(getMetricFilters),
  ]).pipe(
    map(([runToMetrics, activeRuns, metricFilters]) => {
      let metrics: string[] = [];
      for (const run of activeRuns) {
        if (runToMetrics[run]) {
          metrics = metrics.concat(
            runToMetrics[run].filter((key) => metricIsNpmiAndNotDiff(key))
          );
        }
      }
      metrics = [...new Set([...Object.keys(metricFilters), ...metrics])];
      return metrics;
    })
  );
  readonly visibleAnnotations$ = combineLatest([
    this.store.select(getAnnotationData),
    this.store.select(getHiddenAnnotations),
    this.store.select(getShowHiddenAnnotations),
  ]).pipe(
    map(([annotationData, hiddenAnnotations, showHiddenAnnotations]) => {
      return removeHiddenAnnotations(
        annotationData,
        hiddenAnnotations,
        showHiddenAnnotations
      );
    })
  );
  readonly filteredAnnotations$ = combineLatest([
    this.visibleAnnotations$,
    this.store.select(getMetricArithmetic),
    this.store.select(getMetricFilters),
    this.activeRuns$,
    this.activeMetrics$,
    this.store.select(getAnnotationsRegex),
  ]).pipe(
    map(
      ([
        visibleAnnotations,
        metricArithmetic,
        metricFilters,
        activeRuns,
        activeMetrics,
        annotationsRegex,
      ]) => {
        return filterAnnotations(
          visibleAnnotations,
          activeRuns,
          metricArithmetic,
          metricFilters,
          activeMetrics,
          annotationsRegex
        );
      }
    )
  );
  readonly umapIndices$ = combineLatest([
    this.filteredAnnotations$,
    this.embeddingDataSet$,
  ]).pipe(
    map(([filteredAnnotations, embeddingDataSet]) => {
      return filterUmapIndices(filteredAnnotations, embeddingDataSet);
    })
  );
  readonly embeddingFilter$ = this.store.pipe(select(getEmbeddingFilter));

  constructor(private readonly store: Store<State>) {}

  changeStatusMessage(message: string) {
    this.store.dispatch(
      npmiActions.changeEmbeddingStatusMessage({message: message})
    );
  }

  changeEmbeddingDataSet(dataSet: DataSet) {
    this.store.dispatch(npmiActions.changeEmbeddingDataSet({dataSet: dataSet}));
  }

  changeEmbeddingFilter(extent: number[][]) {
    this.store.dispatch(npmiActions.changeEmbeddingFilter({extent}));
  }
}
