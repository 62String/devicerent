module.exports = {
    webpack: {
      configure: (webpackConfig, { env, paths }) => {
        // Webpack Dev Server 설정 수정
        if (webpackConfig.devServer) {
          webpackConfig.devServer.setupMiddlewares = (middlewares, devServer) => {
            return middlewares;
          };
          delete webpackConfig.devServer.onBeforeSetupMiddleware;
          delete webpackConfig.devServer.onAfterSetupMiddleware;
        }
        return webpackConfig;
      }
    }
  };