const TestRunner = require('./jest-runner');

class TagsRunner extends TestRunner {
  constructor(globalConfig, context) {
    super(globalConfig, context);
  }

  async runTests(tests, watcher, onStart, onResult, onFailure, options) {
    return super.runTests(
      tests,
      watcher,
      onStart,
      onResult,
      onFailure,
      options
    );
  }
}

module.exports = TagsRunner;
