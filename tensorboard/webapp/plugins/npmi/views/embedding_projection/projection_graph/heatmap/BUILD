load("@npm_angular_bazel//:index.bzl", "ng_module")

package(default_visibility = ["//tensorboard:internal"])

ng_module(
    name = "heatmap",
    srcs = [
        "heatmap_component.ts",
        "heatmap_container.ts",
        "heatmap_module.ts",
    ],
    deps = [
        "//tensorboard/webapp:app_state",
        "//tensorboard/webapp/plugins/npmi/store",
        "//tensorboard/webapp/plugins/npmi/store:types",
        "//tensorboard/webapp/plugins/npmi/util:gaussian",
        "//tensorboard/webapp/plugins/npmi/util:metric_type",
        "//tensorboard/webapp/third_party:d3",
        "//tensorboard/webapp/third_party:tfjs",
        "@npm//@angular/core",
        "@npm//@angular/forms",
        "@npm//@types/d3",
    ],
)
