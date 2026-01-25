/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Circular dependencies create maintenance issues",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans",
      comment:
        "Orphan modules (not imported by any other module) may indicate dead code",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "^index\\.ts$",
          "^types\\.d\\.ts$",
          "^src/types\\.ts$",
          "\\.test\\.ts$",
          "^src/examples/",
        ],
      },
      to: {},
    },
    // Disabled: Commands can import state modules in this small plugin
    // {
    //   name: "commands-no-state",
    //   comment:
    //     "Commands should not directly import state modules - use dependency injection",
    //   severity: "warn",
    //   from: {
    //     path: "^src/commands/",
    //   },
    //   to: {
    //     path: "^src/state/",
    //     pathNot: ["index\\.ts$"],
    //   },
    // },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
      },
    },
  },
};
