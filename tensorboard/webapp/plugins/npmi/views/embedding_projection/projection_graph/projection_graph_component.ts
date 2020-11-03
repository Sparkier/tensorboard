import {changeEmbeddingStatusMessage} from './../../../actions/npmi_actions';
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
  Output,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';

import * as d3 from '../../../../../third_party/d3';
import {DataSet} from '../../../umap/data';

@Component({
  selector: 'projection-graph-component',
  templateUrl: './projection_graph_component.ng.html',
  styleUrls: ['./projection_graph_component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionGraphComponent implements AfterViewInit, OnChanges {
  @Input() metricName!: string;
  @Input() width!: number;
  @Input() embeddingDataSet!: DataSet;
  @Input() embeddingStatusMessage!: string;
  @Output() onChangeStatusMessage = new EventEmitter<string>();
  @Output() onChangeEmbeddingDataSet = new EventEmitter<DataSet>();
  @ViewChild('chart', {static: true, read: ElementRef})
  private readonly chartContainer!: ElementRef<HTMLDivElement>;
  private height: number = 0;
  private chartWidth: number = 0;
  private chartHeight: number = 0;
  private drawHeight: number = 0;
  private drawWidth: number = 0;
  private readonly margin = {top: 20, right: 10, bottom: 20, left: 10};
  private readonly drawMargin = {top: 0, right: 0, bottom: 20, left: 20};
  // Drawing containers
  private svg!: d3.Selection<
    SVGElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  private mainContainer!: d3.Selection<
    SVGGElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  private drawContainer!: d3.Selection<
    SVGGElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  // Containers for axis and dots
  private dotsGroup!: d3.Selection<
    SVGGElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  private miscGroup!: d3.Selection<
    SVGGElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  // Scales and axis
  private xScale!: d3.ScaleLinear<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;
  private xScaleNum!: d3.ScaleLinear<number, number>;
  private graphBox!: d3.Selection<
    SVGRectElement,
    unknown,
    HTMLElement | null,
    undefined
  >;

  ngAfterViewInit(): void {
    this.svg = d3.select(this.chartContainer.nativeElement).select('svg');
    this.updateDimensions();
    this.mainContainer = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    this.drawContainer = this.mainContainer
      .append('g')
      .attr(
        'transform',
        `translate(${this.drawMargin.left}, ${this.drawMargin.top})`
      );
    this.dotsGroup = this.drawContainer.append('g').attr('class', 'dotsGroup');
    this.miscGroup = this.drawContainer.append('g');
    this.xScale = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    this.xScaleNum = d3.scaleLinear();
    if (
      !this.embeddingDataSet.hasUmapRun &&
      this.embeddingStatusMessage === ''
    ) {
      this.runUMAP();
    }
    this.drawBox();
    this.redraw();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.svg) {
      this.redraw();
    }
  }

  redraw() {
    this.updateDimensions();
    this.updateAxes();
    this.draw();
  }

  // Initializing/Updating the visualization props
  private updateDimensions() {
    this.height = this.width;
    this.svg.style('height', this.height);
    this.chartWidth = this.width - this.margin.left - this.margin.right;
    this.drawWidth =
      this.chartWidth - this.drawMargin.left - this.drawMargin.right;
    this.chartHeight = this.height - this.margin.top - this.margin.bottom;
    this.drawHeight =
      this.chartHeight - this.drawMargin.top - this.drawMargin.bottom;
  }

  private runUMAP() {
    let dataset = this.embeddingDataSet;
    dataset.projectUmap(
      2,
      20,
      (message: string) => {
        this.onChangeStatusMessage.emit(message);
      },
      () => {
        this.onChangeEmbeddingDataSet.emit(dataset);
      }
    );
  }

  private updateAxes() {
    this.xScale.range([0, this.drawWidth]).domain([0, 1]);
    this.yScale.range([0, this.drawHeight]).domain([0, 1]);
  }

  // Drawing UI
  draw() {
    this.refreshBox();
    if (
      this.embeddingStatusMessage === '' &&
      this.embeddingDataSet.hasUmapRun === true
    ) {
      console.log('draw plot');
      console.log(this.embeddingDataSet);
    }
  }

  private drawBox() {
    this.graphBox = this.mainContainer
      .append('rect')
      .style('stroke', 'black')
      .style('fill', 'none')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.chartWidth)
      .attr('height', this.chartHeight);
  }

  private refreshBox() {
    this.graphBox
      .attr('width', this.chartWidth)
      .attr('height', this.chartHeight);
  }
}
