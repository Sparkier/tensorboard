load("@npm_angular_bazel//:index.bzl", "ng_module")
load("//tensorboard/defs:defs.bzl", "tf_sass_binary")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])

tf_sass_binary(
    name = "projection_graph_component_styles",
    src = "projection_graph_component.scss",
)

ng_module(
    name = "projection_graph",
    srcs = [
        "projection_graph_component.ts",
        "projection_graph_container.ts",
        "projection_graph_module.ts",
    ],
    assets = [
        "projection_graph_component.ng.html",
        ":projection_graph_component_styles",
    ],
    deps = [
        "//tensorboard/webapp:app_state",
        "//tensorboard/webapp/angular:expect_angular_material_button",
        "//tensorboard/webapp/angular:expect_angular_material_icon",
        "//tensorboard/webapp/angular:expect_angular_material_progress_spinner",
        "//tensorboard/webapp/core/store",
        "//tensorboard/webapp/plugins/npmi/actions",
        "//tensorboard/webapp/plugins/npmi/store",
        "//tensorboard/webapp/plugins/npmi/store:types",
        "//tensorboard/webapp/plugins/npmi/umap",
        "//tensorboard/webapp/plugins/npmi/util:filter_annotations",
        "//tensorboard/webapp/plugins/npmi/util:metric_type",
        "//tensorboard/webapp/third_party:d3",
        "@npm//@angular/core",
        "@npm//@angular/forms",
        "@npm//@ngrx/store",
        "@npm//@types/d3",
        "@npm//rxjs",
    ],
)
