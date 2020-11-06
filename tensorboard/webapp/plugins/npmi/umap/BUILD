load("//tensorboard/defs:defs.bzl", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])

tf_ts_library(
    name = "umap",
    srcs = [
        "data.ts",
    ],
    strict_checks = False,
    deps = [
        "//tensorboard/plugins/projector/vz_projector",
        "@npm//umap-js",
    ],
)
