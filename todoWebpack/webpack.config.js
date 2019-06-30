const path = require('path');

class P {
  apply(compiler) {
    console.log('start');
    compiler.hooks.emit.tap('emit', function() {
      console.log('emit');
    })
  }
}

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [{
      test: /\.less$/,
      use: [
        path.resolve(__dirname, 'loader', 'style-loader'),
        path.resolve(__dirname, 'loader', 'less-loader')
      ]
    }]
  },
  plugins: [
    new P(),
  ]
};