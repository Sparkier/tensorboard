import {AnnotationDataListing} from '../store/npmi_types';
import {EmbeddingDataSet} from './umap';

export function filterUmapIndices(
  filteredAnnotations: AnnotationDataListing,
  embeddingDataSet: EmbeddingDataSet | undefined
) {
  if (!embeddingDataSet) {
    return [];
  }
  let indices: number[] = [];
  const annotations = new Set(Object.keys(filteredAnnotations));
  for (const index of embeddingDataSet.shuffledDataIndices) {
    if (annotations.has(embeddingDataSet.pointKeys[index])) {
      indices.push(index);
    }
  }
  return indices;
}
