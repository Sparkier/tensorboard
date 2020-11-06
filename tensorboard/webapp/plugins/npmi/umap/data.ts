import {UMAP} from 'umap-js';
import * as util from '../../../../plugins/projector/vz_projector/util';
import {DataPoint} from '../../../../plugins/projector/vz_projector/data';

export {DataPoint};
const UMAP_SAMPLE_SIZE = 20000;

/**
 * Dataset contains a DataPoints array that should be treated as immutable. This
 * acts as a working subset of the original data, with cached properties
 * from computationally expensive operations. Because creating a subset
 * requires normalizing and shifting the vector space, we make a copy of the
 * data so we can still always create new subsets based on the original data.
 */
export class DataSet {
  points: DataPoint[];
  shuffledDataIndices: number[] = [];
  /**
   * This keeps a list of all current projections so you can easily test to see
   * if it's been calculated already.
   */
  projections: {
    [projection: string]: boolean;
  } = {};
  // UMAP
  hasUmapRun = false;
  private umap: UMAP;

  /** Creates a new Dataset */
  constructor(points: DataPoint[]) {
    this.points = points;
    this.shuffledDataIndices = util.shuffle(util.range(this.points.length));
  }

  /** Runs UMAP on the data. */
  async projectUmap(
    nComponents: number,
    nNeighbors: number,
    minDist: number,
    umapIndices: number[],
    messageCallback: (message: string) => void,
    datasetCallback: (dataset: DataSet) => void
  ) {
    this.hasUmapRun = true;
    const epochStepSize = 10;
    const sampledIndices = umapIndices.slice(0, UMAP_SAMPLE_SIZE);
    const sampledData = sampledIndices.map((i) => this.points[i]);
    const X = sampledData.map((x) => Array.from(x.vector));
    messageCallback('Calculating UMAP');
    this.umap = new UMAP({nComponents, nNeighbors, minDist});
    const epochs = this.umap.initializeFit(X);
    await this.umap.fitAsync(X, (epochNumber) => {
      if (epochNumber === epochs) {
        const result = this.umap.getEmbedding();
        this.projections['umap'] = true;
        this.hasUmapRun = true;
        sampledIndices.forEach((index, i) => {
          const dataPoint = this.points[index];
          dataPoint.projections['umap-0'] = result[i][0];
          dataPoint.projections['umap-1'] = result[i][1];
        });
        datasetCallback(this);
        return false;
      }
      if (epochNumber % epochStepSize === 0) {
        messageCallback(`Epoch ${epochNumber}`);
      }
    });
  }
}
