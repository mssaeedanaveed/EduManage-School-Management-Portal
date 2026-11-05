const esbuild = require('esbuild');

module.exports = {
  process(sourceText, sourcePath) {
    const loader = sourcePath.endsWith('.tsx') ? 'tsx' : 'ts';
    return {
      code: esbuild.transformSync(sourceText, {
        loader,
        format: 'cjs',
        target: 'node20',
        sourcemap: 'inline',
      }).code,
    };
  },
};
