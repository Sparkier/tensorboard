load("//tensorboard/defs:defs.bzl", "tf_ng_module", "tf_sass_binary")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])

tf_sass_binary(
    name = "embedding_projection_component_styles",
    src = "embedding_projection_component.scss",
)

tf_ng_module(
    name = "embedding_projection",
    srcs = [
        "embedding_projection_component.ts",
        "embedding_projection_container.ts",
        "embedding_projection_module.ts",
    ],
    assets = [
        ":embedding_projection_component_styles",
        "embedding_projection_component.ng.html",
    ],
    deps = [
        "//tensorboard/webapp:app_state",
        "//tensorboard/webapp/angular:expect_angular_material_button",
        "//tensorboard/webapp/angular:expect_angular_material_icon",
        "//tensorboard/webapp/plugins/npmi/actions",
        "//tensorboard/webapp/plugins/npmi/store",
        "//tensorboard/webapp/plugins/npmi/store:types",
        "//tensorboard/webapp/plugins/npmi/views/embedding_projection/projection_graph",
        "@npm//@angular/common",
        "@npm//@angular/core",
        "@npm//@angular/forms",
        "@npm//@ngrx/store",
        "@npm//rxjs",
    ],
)
