const ChainedMap = require('./ChainedMap');
const ChainedSet = require('./ChainedSet');
const Resolve = require('./Resolve');
const ResolveLoader = require('./ResolveLoader');
const Output = require('./Output');
const DevServer = require('./DevServer');
const Plugin = require('./Plugin');
const Module = require('./Module');
const Optimization = require('./Optimization');
const Performance = require('./Performance');

module.exports = class extends ChainedMap {
  constructor() {
    super();
    this.devServer = new DevServer(this);
    this.entryPoints = new ChainedMap(this);
    this.module = new Module(this);
    this.node = new ChainedMap(this);
    this.optimization = new Optimization(this);
    this.output = new Output(this);
    this.performance = new Performance(this);
    this.plugins = new ChainedMap(this);
    this.resolve = new Resolve(this);
    this.resolveLoader = new ResolveLoader(this);
    this.extend([
      'amd',
      'bail',
      'cache',
      'context',
      'devtool',
      'externals',
      'loader',
      'mode',
      'parallelism',
      'profile',
      'recordsInputPath',
      'recordsPath',
      'recordsOutputPath',
      'stats',
      'target',
      'watch',
      'watchOptions'
    ]);
  }

  entry(name) {
    if (!this.entryPoints.has(name)) {
      this.entryPoints.set(name, new ChainedSet(this));
    }

    return this.entryPoints.get(name);
  }

  plugin(name) {
    if (!this.plugins.has(name)) {
      this.plugins.set(name, new Plugin(this, name));
    }

    return this.plugins.get(name);
  }

  toConfig() {
    const entryPoints = this.entryPoints.entries() || {};

    return this.clean(Object.assign(this.entries() || {}, {
      node: this.node.entries(),
      output: this.output.entries(),
      resolve: this.resolve.toConfig(),
      resolveLoader: this.resolveLoader.toConfig(),
      devServer: this.devServer.toConfig(),
      module: this.module.toConfig(),
      optimization: this.optimization.entries(),
      plugins: this.plugins.values().map(plugin => plugin.toConfig()),
      performance: this.performance.entries(),
      entry: Object
        .keys(entryPoints)
        .reduce((acc, key) => Object.assign(acc, { [key]: entryPoints[key].values() }), {})
    }));
  }

  toString({
    verbose = false,
    configPrefix = 'config'
  } = {}) {
    const stringify = require('javascript-stringify');

    const config = this.toConfig();

    return stringify(config, (value, indent, stringify) => {
      // improve plugin output
      if (value && value.__pluginName) {
        const prefix = `/* ${configPrefix}.plugin('${value.__pluginName}') */\n`;
        const constructorName = value.__pluginConstructorName;

        if (constructorName) {
          // get correct indentation for args by stringifying the args array and
          // discarding the square brackets.
          const args = stringify(value.__pluginArgs).slice(1, -1);
          return prefix + `new ${constructorName}(${args})`;
        } else {
          return prefix + stringify({ args: value.__pluginArgs || [] });
        }
      }

      // improve rule/use output
      if (value && value.__ruleNames) {
        const prefix = `/* ${configPrefix}.module.rule('${
          value.__ruleNames[0]
        }')${
          value.__ruleNames.slice(1).map(r => `.oneOf('${r}')`).join('')
        }${
          value.__useName ? `.use('${value.__useName}')` : ``
        } */\n`;
        return prefix + stringify(value);
      }

      // shorten long functions
      if (typeof value === 'function') {
        if (value.__expression) {
          return value.__expression;
        } else if (!verbose && value.toString().length > 100) {
          return `function () { /* omitted long function */ }`;
        }
      }

      return stringify(value);
    }, 2);
  }

  merge(obj = {}, omit = []) {
    const omissions = [
      'node',
      'output',
      'resolve',
      'resolveLoader',
      'devServer',
      'optimization',
      'performance',
      'module'
    ];

    if (!omit.includes('entry') && 'entry' in obj) {
      Object
        .keys(obj.entry)
        .forEach(name => this.entry(name).merge(obj.entry[name]));
    }

    if (!omit.includes('plugin') && 'plugin' in obj) {
      Object
        .keys(obj.plugin)
        .forEach(name => this.plugin(name).merge(obj.plugin[name]));
    }

    omissions.forEach(key => {
      if (!omit.includes(key) && key in obj) {
        this[key].merge(obj[key]);
      }
    });

    return super.merge(obj, [...omit, ...omissions, 'entry', 'plugin']);
  }
};
