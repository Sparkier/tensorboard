load("//tensorboard/defs:defs.bzl", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])

tf_ts_library(
    name = "umap",
    srcs = [
        "async.ts",
        "data.ts",
        "knn.ts",
    ],
    strict_checks = False,
    deps = [
        "//tensorboard/plugins/projector/vz_projector",
        "//tensorboard/plugins/projector/vz_projector:heap",
        "//tensorboard/webapp/third_party:tfjs",
        "@npm//umap-js",
    ],
)
