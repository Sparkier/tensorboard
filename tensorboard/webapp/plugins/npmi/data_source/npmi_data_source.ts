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
import {Injectable} from '@angular/core';

import {Observable, of, forkJoin, throwError} from 'rxjs';
import {map, catchError} from 'rxjs/operators';

import {
  TBHttpClient,
  HttpErrorResponse,
} from '../../../webapp_data_source/tb_http_client';
import * as metric_type from '../util/metric_type';
import {
  MetricListing,
  AnnotationDataListing,
  ValueData,
  EmbeddingListing,
} from './../store/npmi_types';
import {DataPoint, DataSet} from '../umap/data';

/** @typehack */ import * as _typeHackRxjs from 'rxjs';

export abstract class NpmiDataSource {
  abstract fetchData(): Observable<{
    annotationData: AnnotationDataListing;
    metrics: MetricListing;
    embeddingData: EmbeddingListing;
    embeddingDataSet?: DataSet;
  }>;
}

interface AnnotationListing {
  [runId: string]: string[];
}

interface ValueListing {
  [runId: string]: number[][];
}

interface RunEmbeddingListing {
  [runId: string]: number[][];
}

@Injectable()
export class NpmiHttpServerDataSource implements NpmiDataSource {
  private readonly httpPathPrefix = 'data/plugin/npmi';

  constructor(private readonly http: TBHttpClient) {}

  fetchData() {
    return forkJoin(
      this.fetchAnnotations(),
      this.fetchMetrics(),
      this.fetchValues(),
      this.fetchEmbeddings()
    ).pipe(
      map(([annotations, metrics, values, embeddings]) => {
        const annotationData: AnnotationDataListing = {};
        const embeddingData: EmbeddingListing = {};
        const embeddingDataPoints: DataPoint[] = [];
        let index = 0;
        for (const run of Object.keys(annotations)) {
          for (const annotationIndex in annotations[run]) {
            const annotation = annotations[run][annotationIndex];
            if (Object.keys(embeddings).length) {
              if (
                embeddings[run][annotationIndex] &&
                !embeddingData[annotation] &&
                embeddings[run][annotationIndex].some((item) => item !== 0)
              ) {
                // If not already set
                embeddingData[annotation] = embeddings[run][annotationIndex];
                embeddingDataPoints.push({
                  vector: new Float32Array(embeddings[run][annotationIndex]),
                  index: index,
                  metadata: {
                    name: annotation,
                  },
                  projections: {},
                });
                index = index + 1;
              }
            }
            const metricToDataElements = new Map<string, ValueData>();
            for (const metricIndex in metrics[run]) {
              const metric = metrics[run][metricIndex];
              const metricString = metric_type.stripMetricString(metric);
              let dataElement = metricToDataElements.get(metricString);
              if (!dataElement) {
                dataElement = {
                  nPMIValue: null,
                  countValue: null,
                  annotation: annotation,
                  metric: metricString,
                  run: run,
                };
                metricToDataElements.set(metricString, dataElement);
              }
              if (metric_type.metricIsMetricCount(metric)) {
                dataElement.countValue =
                  values[run][annotationIndex][metricIndex];
              } else if (metric_type.metricIsNpmi(metric)) {
                dataElement.nPMIValue =
                  values[run][annotationIndex][metricIndex];
              }
            }
            const existing = annotationData[annotation]
              ? annotationData[annotation]
              : [];
            annotationData[annotation] = [
              ...existing,
              ...metricToDataElements.values(),
            ];
          }
        }
        const embeddingDataSet = new DataSet(embeddingDataPoints);
        return {annotationData, metrics, embeddingData, embeddingDataSet};
      }),
      catchError((error) => {
        if (
          error instanceof HttpErrorResponse &&
          400 <= error.status &&
          error.status < 500
        ) {
          return of({
            annotationData: {},
            metrics: {},
            embeddingData: {},
            embeddingDataSet: undefined,
          });
        }
        return throwError(error);
      })
    );
  }

  private fetchAnnotations() {
    return this.http.get<AnnotationListing>(
      this.httpPathPrefix + '/annotations'
    );
  }

  private fetchMetrics() {
    return this.http.get<MetricListing>(this.httpPathPrefix + '/metrics');
  }

  private fetchValues() {
    return this.http.get<ValueListing>(this.httpPathPrefix + '/values');
  }

  private fetchEmbeddings() {
    return this.http.get<RunEmbeddingListing>(
      this.httpPathPrefix + '/embeddings'
    );
  }
}
