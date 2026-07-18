import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";

export default createStartHandler({
  createRouter: () => {
    const { createRouter } = require("./router");
    return createRouter();
  },
  getRouterManifest,
})(defaultStreamHandler);
