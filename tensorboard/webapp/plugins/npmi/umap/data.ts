import {UMAP} from 'umap-js';
import * as vector from '../../../../plugins/projector/vz_projector/vector';
import * as util from '../../../../plugins/projector/vz_projector/util';
import * as knn from './knn';
import {DataPoint} from '../../../../plugins/projector/vz_projector/data';
import {runAsyncTask} from './async';

export {DataPoint};
const IS_FIREFOX = navigator.userAgent.toLowerCase().indexOf('firefox') >= 0;
const UMAP_SAMPLE_SIZE = 200; // 20000;

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
  nearest: knn.NearestEntry[][];
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
    messageCallback: (message: string) => void,
    datasetCallback: (dataset: DataSet) => void
  ) {
    this.hasUmapRun = true;
    datasetCallback(this);
    this.umap = new UMAP({nComponents, nNeighbors, minDist});
    let currentEpoch = 0;
    const epochStepSize = 10;
    const sampledIndices = this.shuffledDataIndices.slice(0, UMAP_SAMPLE_SIZE);
    const sampledData = sampledIndices.map((i) => this.points[i]);
    // TODO: Switch to a Float32-based UMAP internal
    const X = sampledData.map((x) => Array.from(x.vector));
    const nearest = await this.computeKnn(
      sampledData,
      nNeighbors,
      messageCallback
    );
    const nEpochs = await runAsyncTask(() => {
      const knnIndices = nearest.map((row) => row.map((entry) => entry.index));
      const knnDistances = nearest.map((row) => row.map((entry) => entry.dist));
      // Initialize UMAP and return the number of epochs.
      this.umap.setPrecomputedKNN(knnIndices, knnDistances);
      return this.umap.initializeFit(X);
    });
    // Now, iterate through all epoch batches of the UMAP optimization, updating
    // the modal window with the progress rather than animating each step since
    // the UMAP animation is not nearly as informative as t-SNE.
    return new Promise((resolve, reject) => {
      const step = () => {
        // Compute a batch of epochs since we don't want to update the UI
        // on every epoch.
        const epochsBatch = Math.min(epochStepSize, nEpochs - currentEpoch);
        for (let i = 0; i < epochsBatch; i++) {
          currentEpoch = this.umap.step();
        }
        const progressMsg = `Optimizing UMAP (epoch ${currentEpoch} of ${nEpochs})`;
        // Wrap the logic in a util.runAsyncTask in order to correctly update
        // the modal with the progress of the optimization.
        runAsyncTask(() => {
          if (currentEpoch < nEpochs) {
            messageCallback(progressMsg);
            requestAnimationFrame(step);
          } else {
            const result = this.umap.getEmbedding();
            sampledIndices.forEach((index, i) => {
              const dataPoint = this.points[index];
              dataPoint.projections['umap-0'] = result[i][0];
              dataPoint.projections['umap-1'] = result[i][1];
              if (nComponents === 3) {
                dataPoint.projections['umap-2'] = result[i][2];
              }
            });
            this.projections['umap'] = true;
            this.hasUmapRun = true;
            datasetCallback(this);
            resolve();
          }
        }, 0).catch((error) => {
          reject(error);
        });
      };
      requestAnimationFrame(step);
    });
  }
  /** Computes KNN to provide to the UMAP and t-SNE algorithms. */
  private async computeKnn(
    data: DataPoint[],
    nNeighbors: number,
    messageCallback: (message: string) => void
  ): Promise<knn.NearestEntry[][]> {
    // Handle the case where we've previously found the nearest neighbors.
    const previouslyComputedNNeighbors =
      this.nearest && this.nearest.length ? this.nearest[0].length : 0;
    if (this.nearest != null && previouslyComputedNNeighbors >= nNeighbors) {
      return Promise.resolve(
        this.nearest.map((neighbors) => neighbors.slice(0, nNeighbors))
      );
    } else {
      const knnGpuEnabled = (await util.hasWebGLSupport()) && !IS_FIREFOX;
      const result = await (knnGpuEnabled
        ? knn.findKNNGPUCosine(
            data,
            nNeighbors,
            (d) => d.vector,
            messageCallback
          )
        : knn.findKNN(
            data,
            nNeighbors,
            (d) => d.vector,
            (a, b) => vector.cosDistNorm(a, b),
            messageCallback
          ));
      this.nearest = result;
      return Promise.resolve(result);
    }
  }
  /**
   * Search the dataset based on a metadata field.
   */
  query(query: string, inRegexMode: boolean, fieldName: string): number[] {
    let predicate = util.getSearchPredicate(query, inRegexMode, fieldName);
    let matches: number[] = [];
    this.points.forEach((point, id) => {
      if (predicate(point)) {
        matches.push(id);
      }
    });
    return matches;
  }
}
