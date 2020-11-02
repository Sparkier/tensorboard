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

import * as d3 from '../../../../../third_party/d3';

@Component({
  selector: 'projection-graph-component',
  templateUrl: './projection_graph_component.ng.html',
  styleUrls: ['./projection_graph_component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionGraphComponent implements AfterViewInit, OnChanges {
  @Input() metricName!: string;
  @Input() width!: number;
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
  private xScale!: d3.ScalePoint<string>;
  private yScale!: d3.ScaleLinear<number, number>;
  private xScaleNum!: d3.ScaleLinear<number, number>;

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
    this.xScale = d3.scaleBand().padding(0.05);
    this.yScale = d3.scaleLinear().range([this.drawHeight, 0]);
    this.xScaleNum = d3.scaleLinear();
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

  updateAxes() {}

  // Drawing UI
  draw() {}
}
