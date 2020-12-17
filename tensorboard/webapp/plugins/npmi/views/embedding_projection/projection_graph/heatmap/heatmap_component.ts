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
  ChangeDetectionStrategy,
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';

import {
  AnnotationDataListing,
  EmbeddingDataSet,
} from '../../../../store/npmi_types';
import * as tf from '../../../../../../../webapp/third_party/tfjs';
import * as d3 from '../../../../../../third_party/d3';
import {stripMetricString} from '../../../../util/metric_type';
import {getGaussian} from '../../../../util/gaussian';

@Component({
  selector: 'heatmap-component',
  template: ` <canvas #canvas> </canvas> `,
  styles: ['canvas { width: 100%; height: 100%; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapComponent implements AfterViewInit, OnChanges {
  @Input() metricName!: string;
  @Input() width!: number;
  @Input() embeddingDataSet!: EmbeddingDataSet;
  @Input() filteredAnnotations!: AnnotationDataListing;
  @Input() umapIndices!: number[];
  @Input() projection!: string;
  @Input() margin!: {top: number; right: number; bottom: number; left: number};
  @Input() drawMargin!: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  @ViewChild('canvas', {static: true, read: ElementRef})
  private readonly heatmapCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private height: number = 0;
  private xScale!: d3.ScaleLinear<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;
  private kernel!: tf.Tensor4D;
  private chartWidth: number = 0;
  private chartHeight: number = 0;
  private drawHeight: number = 0;
  private drawWidth: number = 0;

  ngAfterViewInit(): void {
    const c = this.heatmapCanvas.nativeElement;
    this.ctx = c.getContext('2d')!;
    this.xScale = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    this.kernel = tf.tensor4d(getGaussian(), [25, 25, 1, 1]);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.ctx !== undefined) {
      this.updateDimensions();
      this.updateAxes();
      this.redraw();
    }
  }

  private updateDimensions() {
    this.height = this.width;
    this.ctx.canvas.width = this.width;
    this.ctx.canvas.height = this.height;
    this.chartWidth = this.width - this.margin.left - this.margin.right;
    this.drawWidth =
      this.chartWidth - this.drawMargin.left - this.drawMargin.right;
    this.chartHeight = this.height - this.margin.top - this.margin.bottom;
    this.drawHeight =
      this.chartHeight - this.drawMargin.top - this.drawMargin.bottom;
  }

  private updateAxes() {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    if (this.embeddingDataSet.projections[this.projection]) {
      this.embeddingDataSet.pointKeys.forEach((key) => {
        if (
          this.filteredAnnotations[key] &&
          this.embeddingDataSet.points[key].projections[`${this.projection}-0`]
        ) {
          minX = Math.min(
            minX,
            this.embeddingDataSet.points[key].projections[
              `${this.projection}-0`
            ]
          );
          maxX = Math.max(
            maxX,
            this.embeddingDataSet.points[key].projections[
              `${this.projection}-0`
            ]
          );
          minY = Math.min(
            minY,
            this.embeddingDataSet.points[key].projections[
              `${this.projection}-1`
            ]
          );
          maxY = Math.max(
            maxY,
            this.embeddingDataSet.points[key].projections[
              `${this.projection}-1`
            ]
          );
        }
      });
    }
    this.xScale.range([99, 0]).domain([maxX, minX]);
    this.yScale.range([99, 0]).domain([maxY, minY]);
  }

  private redraw() {
    this.ctx.clearRect(
      0,
      0,
      this.heatmapCanvas.nativeElement.width,
      this.heatmapCanvas.nativeElement.height
    );
    if (this.embeddingDataSet.projections[this.projection]) {
      this.constructHeatmapData();
    }
  }

  private constructHeatmapData() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.canvas.width = 100;
    context.canvas.height = 100;
    const dataBuffer = tf.buffer([100, 100]);
    const keys = this.embeddingDataSet.pointKeys.filter(
      (key) =>
        this.filteredAnnotations[key] &&
        this.embeddingDataSet.points[key].projections[`${this.projection}-0`]
    );
    for (const key of keys) {
      let data = this.filteredAnnotations[key];
      data = data.filter(
        (element) => element.metric === stripMetricString(this.metricName)
      );
      let npmiValue: number = 0;
      let normalizationNumber = 0;
      for (const valueDataElement of data) {
        if (valueDataElement.nPMIValue !== null) {
          npmiValue = npmiValue + valueDataElement.nPMIValue;
          normalizationNumber = normalizationNumber + 1;
        }
      }
      if (normalizationNumber) {
        npmiValue = npmiValue / normalizationNumber;
        const projectionX = this.embeddingDataSet.points[key].projections[
          `${this.projection}-0`
        ];
        const projectionY = this.embeddingDataSet.points[key].projections[
          `${this.projection}-1`
        ];
        const xPos = Math.round(this.xScale(projectionX));
        const yPos = Math.round(this.yScale(projectionY));
        const newValue = npmiValue + dataBuffer.get(yPos, xPos);
        dataBuffer.set(newValue, yPos, xPos);
      }
    }
    let dataTensor = dataBuffer.toTensor();
    dataTensor = dataTensor.reshape([100, 100, 1]);
    const out = tf
      .conv2d(dataTensor as tf.Tensor3D, this.kernel, 1, 'same')
      .clipByValue(-1, 1);
    const result: Float32Array = out.dataSync() as Float32Array;
    const imageData = this.ctx.createImageData(100, 100);
    result.forEach((element, elementIndex) => {
      let color = '';
      if (element < 0) {
        color = d3.interpolateReds(Math.abs(element));
      } else if (element > 0) {
        color = d3.interpolateBlues(element);
      } else {
        color = '(255, 255, 255)';
      }
      const colorArray = color.split('(')[1].split(')')[0].split(', ');
      colorArray.forEach((channel, channelIndex) => {
        imageData.data[elementIndex * 4 + channelIndex] = +channel;
      });
      imageData.data[elementIndex * 4 + 3] = 128;
    });
    context.putImageData(imageData, 0, 0);
    this.ctx.filter = 'blur(10px)';
    this.ctx.drawImage(
      canvas,
      this.margin.left + this.drawMargin.left,
      this.margin.top + this.drawMargin.top,
      this.drawWidth,
      this.drawHeight
    );
  }
}
