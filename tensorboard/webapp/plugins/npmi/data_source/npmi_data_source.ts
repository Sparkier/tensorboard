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
  MetricCountListing,
  AnnotationDataListing,
  ValueData,
  EmbeddingListing,
  EmbeddingDataSet,
} from './../store/npmi_types';

/** @typehack */ import * as _typeHackRxjs from 'rxjs';

export abstract class NpmiDataSource {
  abstract fetchData(
    experimentIds: string[]
  ): Observable<{
    annotationData: AnnotationDataListing;
    metrics: MetricListing;
    embeddingDataSet?: EmbeddingDataSet;
    metricCounts: MetricCountListing;
  }>;
}

function runToRunId(run: string, experimentId: string) {
  return `${experimentId}/${run}`;
}

function buildAnnotationData(
  backendAnnotations: AnnotationListing,
  experimentId: string
): AnnotationListing {
  return Object.fromEntries(
    Object.entries(backendAnnotations).map(([key, value]) => [
      runToRunId(key, experimentId),
      value,
    ])
  );
}

function buildMetricData(
  backendMetrics: MetricListing,
  experimentId: string
): MetricListing {
  return Object.fromEntries(
    Object.entries(backendMetrics).map(([key, value]) => [
      runToRunId(key, experimentId),
      value,
    ])
  );
}

function buildValueData(
  backendValues: ValueListing,
  experimentId: string
): ValueListing {
  return Object.fromEntries(
    Object.entries(backendValues).map(([key, value]) => [
      runToRunId(key, experimentId),
      value,
    ])
  );
}

function buildEmbeddingData(
  backendEmbeddings: RunEmbeddingListing,
  experimentId: string
): RunEmbeddingListing {
  return Object.fromEntries(
    Object.entries(backendEmbeddings).map(([key, value]) => [
      runToRunId(key, experimentId),
      value,
    ])
  );
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

  fetchData(experimentIds: string[]) {
    return forkJoin(
      this.fetchAnnotations(experimentIds),
      this.fetchMetrics(experimentIds),
      this.fetchValues(experimentIds),
      this.fetchEmbeddings(experimentIds)
    ).pipe(
      map(([annotations, metrics, values, embeddings]) => {
        const annotationData: AnnotationDataListing = {};
        const metricCounts: MetricCountListing = {};
        const embeddingDataPoints: EmbeddingListing = {};
        let embeddingDataSet: EmbeddingDataSet | undefined = undefined;
        let index = 0;

        for (const run of Object.keys(annotations)) {
          let labelStats: (number | null)[] = [];
          for (const annotationIndex in annotations[run]) {
            const annotation = annotations[run][annotationIndex];
            // This is a special field that captures stats about the metric
            if (annotation === 'Comparison Label Stats') {
              labelStats = values[run][annotationIndex];
            } else {
              if (Object.keys(embeddings).length) {
                if (
                  embeddings[run][annotationIndex] &&
                  !embeddingDataPoints[annotation] &&
                  embeddings[run][annotationIndex].some((item) => item !== 0)
                ) {
                  // If not already set
                  embeddingDataPoints[annotation] = {
                    vector: embeddings[run][annotationIndex],
                    index: index,
                    name: annotation,
                    projections: {},
                  };
                  index = index + 1;
                }
              }
              const metricToDataElements = new Map<string, ValueData>();
              let count = null;
              for (const metricIndex in metrics[run]) {
                const metric = metrics[run][metricIndex];
                if (metric_type.metricIsCount(metric)) {
                  // Set count value
                  count = values[run][annotationIndex][metricIndex];
                } else {
                  // Create ValueData for annotation, run, metric combination
                  const metricString = metric_type.stripMetricString(metric);
                  if (metricString !== undefined) {
                    let dataElement = metricToDataElements.get(metricString);
                    if (!dataElement) {
                      dataElement = {
                        nPMIValue: null,
                        countValue: null,
                        annotationCountValue: count,
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
          for (const metricIndex in metrics[run]) {
            if (metric_type.metricIsMetricCount(metrics[run][metricIndex])) {
              const existing = metricCounts[run] ? metricCounts[run] : [];
              const count = {
                metric: metric_type.stripMetricString(
                  metrics[run][metricIndex]
                ),
                count: labelStats[metricIndex],
              };
              metricCounts[run] = [...existing, count];
            }
          }
        }
        if (Object.keys(embeddingDataPoints).length) {
          embeddingDataSet = new EmbeddingDataSet(embeddingDataPoints);
        }

        return {annotationData, metrics, embeddingDataSet, metricCounts};
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
            embeddingDataSet: undefined,
            metricCounts: {},
          });
        }
        return throwError(error);
      })
    );
  }

  private fetchAnnotations(experimentIds: string[]) {
    const fetches = experimentIds.map((experimentId) => {
      const url = `/experiment/${experimentId}/${this.httpPathPrefix}/annotations`;
      return this.http.get<AnnotationListing>(url).pipe(
        map((annotations) => {
          return buildAnnotationData(annotations, experimentId);
        })
      );
    });
    return forkJoin(fetches).pipe(
      map((results) => {
        let annotationData: AnnotationListing = {};
        for (const result of results) {
          annotationData = {...annotationData, ...result};
        }
        return annotationData;
      })
    );
  }

  private fetchMetrics(experimentIds: string[]) {
    const fetches = experimentIds.map((experimentId) => {
      const url = `/experiment/${experimentId}/${this.httpPathPrefix}/metrics`;
      return this.http.get<MetricListing>(url).pipe(
        map((metrics) => {
          return buildMetricData(metrics, experimentId);
        })
      );
    });
    return forkJoin(fetches).pipe(
      map((results) => {
        let metricData: MetricListing = {};
        for (const result of results) {
          metricData = {...metricData, ...result};
        }
        return metricData;
      })
    );
  }

  private fetchValues(experimentIds: string[]) {
    const fetches = experimentIds.map((experimentId) => {
      const url = `/experiment/${experimentId}/${this.httpPathPrefix}/values`;
      return this.http.get<ValueListing>(url).pipe(
        map((values) => {
          return buildValueData(values, experimentId);
        })
      );
    });
    return forkJoin(fetches).pipe(
      map((results) => {
        let valueData: ValueListing = {};
        for (const result of results) {
          valueData = {...valueData, ...result};
        }
        return valueData;
      })
    );
  }

  private fetchEmbeddings(experimentIds: string[]) {
    const fetches = experimentIds.map((experimentId) => {
      const url = `/experiment/${experimentId}/${this.httpPathPrefix}/embeddings`;
      return this.http.get<RunEmbeddingListing>(url).pipe(
        map((embeddings) => {
          return buildEmbeddingData(embeddings, experimentId);
        })
      );
    });
    return forkJoin(fetches).pipe(
      map((results) => {
        let embeddingData: RunEmbeddingListing = {};
        for (const result of results) {
          embeddingData = {...embeddingData, ...result};
        }
        return embeddingData;
      })
    );
  }
}
