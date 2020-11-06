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
import {DataPoint, DataSet} from '../../../umap/data';
import {AnnotationDataListing} from '../../../store/npmi_types';
import {stripMetricString} from '../../../util/metric_type';

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
  @Input() filteredAnnotations!: AnnotationDataListing;
  @Input() embeddingFilter!: number[][];
  @Input() umapIndices!: number[];
  @Input() projection!: string;
  @Output() onChangeStatusMessage = new EventEmitter<string>();
  @Output() onChangeEmbeddingDataSet = new EventEmitter<DataSet>();
  @Output() onChangeEmbeddingFilter = new EventEmitter<number[][]>();
  @ViewChild('chart', {static: true, read: ElementRef})
  private readonly chartContainer!: ElementRef<HTMLDivElement>;
  private projectionDims = 2;
  private numNeighbors = 20;
  private minDist = 0.1;
  private height: number = 0;
  private chartWidth: number = 0;
  private chartHeight: number = 0;
  private drawHeight: number = 0;
  private drawWidth: number = 0;
  // private projection = 'umap'
  private readonly margin = {top: 10, right: 10, bottom: 10, left: 10};
  private readonly drawMargin = {top: 10, right: 10, bottom: 10, left: 10};
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
  // Scales and axis
  private xScale!: d3.ScaleLinear<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;
  private graphBox!: d3.Selection<
    SVGRectElement,
    unknown,
    HTMLElement | null,
    undefined
  >;
  // Brush
  private readonly brush: d3.BrushBehavior<unknown> = d3.brush();

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
    this.xScale = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    this.runUMAP();
    this.drawBox();
    this.initializeBrush();
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
    this.embeddingDataSet.projectUmap(
      this.projectionDims,
      this.numNeighbors,
      this.minDist,
      this.umapIndices,
      (message: string) => {
        this.onChangeStatusMessage.emit(message);
      },
      (dataset: DataSet) => {
        this.onChangeEmbeddingDataSet.emit(dataset);
      }
    );
  }

  private updateAxes() {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    if (this.embeddingDataSet.projections[this.projection]) {
      this.embeddingDataSet.points.map((point) => {
        if (point.projections[`${this.projection}-0`]) {
          minX = Math.min(minX, point.projections[`${this.projection}-0`]);
          maxX = Math.max(maxX, point.projections[`${this.projection}-0`]);
          minY = Math.min(minY, point.projections[`${this.projection}-1`]);
          maxY = Math.max(maxY, point.projections[`${this.projection}-1`]);
        }
      });
    }
    this.xScale.range([0, this.drawWidth]).domain([minX, maxX]);
    this.yScale.range([0, this.drawHeight]).domain([minY, maxY]);
  }

  // Drawing UI
  draw() {
    this.refreshBox();
    if (this.embeddingDataSet.projections[this.projection]) {
      this.drawPlot();
      this.refreshBrush();
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

  private drawPlot() {
    const points = this.embeddingDataSet.points.filter(
      (point) =>
        this.filteredAnnotations[point.metadata.name] &&
        point.projections[`${this.projection}-0`]
    );
    const dots = this.dotsGroup.selectAll('.projection-dots').data(points);

    dots
      .enter()
      .append('circle')
      .attr('class', 'projection-dots')
      .attr(
        'cx',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          return this.xScale(d.projections[`${this.projection}-0`]);
        }.bind(this)
      )
      .attr(
        'cy',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          return this.yScale(d.projections[`${this.projection}-1`]);
        }.bind(this)
      )
      .attr(
        'r',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          if (this.embeddingFilter.length) {
            if (
              d.projections[`${this.projection}-0`] >=
                this.embeddingFilter[0][0] &&
              d.projections[`${this.projection}-0`] <=
                this.embeddingFilter[1][0] &&
              d.projections[`${this.projection}-1`] >=
                this.embeddingFilter[0][1] &&
              d.projections[`${this.projection}-1`] <=
                this.embeddingFilter[1][1]
            ) {
              return 5;
            }
          }
          return 2;
        }.bind(this)
      )
      .attr(
        'fill',
        function (this: ProjectionGraphComponent, d: DataPoint): string {
          // Calculate Average nPMI value for this Annotation
          let valueData = this.filteredAnnotations[d.metadata.name];
          valueData = valueData.filter(
            (element) => element.metric === stripMetricString(this.metricName)
          );
          let npmiValue: number | null = 0;
          let normalizationNumber = 0;
          for (const valueDataElement of valueData) {
            if (valueDataElement.nPMIValue !== null) {
              npmiValue = npmiValue + valueDataElement.nPMIValue;
              normalizationNumber = normalizationNumber + 1;
            }
          }
          if (normalizationNumber) {
            npmiValue = npmiValue / normalizationNumber;
          } else {
            npmiValue = null;
          }
          // Set the color according to the average nPMI value
          if (npmiValue === null) {
            return 'rgba(0, 0, 0, 0.3)';
          } else if (npmiValue >= 0) {
            return d3.interpolateBlues(npmiValue);
          } else {
            return d3.interpolateReds(npmiValue * -1);
          }
        }.bind(this)
      );

    dots
      .attr(
        'r',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          if (this.embeddingFilter.length) {
            if (
              d.projections[`${this.projection}-0`] >=
                this.embeddingFilter[0][0] &&
              d.projections[`${this.projection}-0`] <=
                this.embeddingFilter[1][0] &&
              d.projections[`${this.projection}-1`] >=
                this.embeddingFilter[0][1] &&
              d.projections[`${this.projection}-1`] <=
                this.embeddingFilter[1][1]
            ) {
              return 5;
            }
          }
          return 2;
        }.bind(this)
      )
      .attr(
        'cx',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          return this.xScale(d.projections[`${this.projection}-0`]);
        }.bind(this)
      )
      .attr(
        'cy',
        function (this: ProjectionGraphComponent, d: DataPoint): number {
          return this.yScale(d.projections[`${this.projection}-1`]);
        }.bind(this)
      );

    dots.exit().remove();
  }

  private initializeBrush() {
    this.brush.on('end', this.brushMoved.bind(this));
  }

  private refreshBrush() {
    this.brush.extent([
      [-this.drawMargin.left, -this.drawMargin.top],
      [
        this.drawWidth + this.drawMargin.right,
        this.drawHeight + this.drawMargin.bottom,
      ],
    ]);
    this.drawContainer.call(this.brush);
  }

  // Called on Interaction
  private brushMoved() {
    if (!d3.event) return;
    if (!d3.event.sourceEvent) return;
    const extent = d3.event.selection;
    if (extent) {
      const extentInverted = extent.map((element: number[]) => {
        return [this.xScale.invert(element[0]), this.yScale.invert(element[1])];
      });
      this.onChangeEmbeddingFilter.emit(extentInverted);
    } else {
      this.onChangeEmbeddingFilter.emit([]);
    }
  }
}
