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

import {
  DataSeries,
  DataSeriesMetadata,
  DataSeriesMetadataMap,
  Point,
} from '../../../widgets/line_chart_v2/types';

export enum SeriesType {
  ORIGINAL,
  DERIVED,
}

// Smoothed series is derived from a data serie. The additional information on the
// metadata allows us to render smoothed value and its original value in the tooltip.
export interface SmoothedSeriesMetadata extends DataSeriesMetadata {
  type: SeriesType.DERIVED;
  aux: false;
  originalSeriesId: string;
}

export interface OriginalSeriesMetadata extends DataSeriesMetadata {
  type: SeriesType.ORIGINAL;
}

export type ScalarCardSeriesMetadata =
  | SmoothedSeriesMetadata
  | OriginalSeriesMetadata;

export type ScalarCardSeriesMetadataMap = DataSeriesMetadataMap<
  ScalarCardSeriesMetadata
>;

export interface ScalarCardPoint extends Point {
  wallTime: number;
  value: number;
  step: number;
}

export type ScalarCardDataSeries = DataSeries<ScalarCardPoint>;
