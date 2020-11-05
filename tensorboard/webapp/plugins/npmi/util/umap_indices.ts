import {AnnotationDataListing} from '../store/npmi_types';
import {DataSet} from '../umap/data';

export function filterUmapIndices(
  filteredAnnotations: AnnotationDataListing,
  embeddingDataSet: DataSet | undefined
) {
  if (!embeddingDataSet) {
    return [];
  }
  let indices: number[] = [];
  const annotations = new Set(Object.keys(filteredAnnotations));
  for (const index of embeddingDataSet.shuffledDataIndices) {
    if (
      annotations.has(embeddingDataSet.points[index].metadata.name as string)
    ) {
      indices.push(index);
    }
  }
  return indices;
}
