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

export interface FeatureFlags {
  // experimental plugins to manually enable.
  enabledExperimentalPlugins: string[];
  // Whether the TensorBoard is being run inside Colab output cell.
  inColab: boolean;
  // Whether to enable our experimental GPU line chart.
  enableGpuChart: boolean;
  // Maximum number of runs to include in a request to get scalar data.
  // `undefined` indicates that we should rely on defaults defined in the
  // dashboards code.
  //
  // See: https://github.com/tensorflow/tensorboard/blob/master/tensorboard/plugins/scalar/tf_scalar_dashboard/tf-scalar-card.ts
  scalarsBatchSize: number | undefined;
}
