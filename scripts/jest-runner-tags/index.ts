import TestRunner, {
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  Test,
  TestRunnerContext,
  TestRunnerOptions,
  TestWatcher,
} from 'jest-runner';
import {Config} from '@jest/types';
import {parse} from 'jest-docblock';
import readline from 'readline';
import fs from 'fs';

const TAGS_PREGIX_LONG = '--tags';
const TAGS_PREFIX_SHORT = '-t';

export default class TagsRunner extends TestRunner {
  constructor(globalConfig: Config.GlobalConfig, context?: TestRunnerContext) {
    super(globalConfig, context);
  }

  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    onStart: OnTestStart | undefined,
    onResult: OnTestSuccess | undefined,
    onFailure: OnTestFailure | undefined,
    options: TestRunnerOptions
  ): Promise<void> {
    let argTags: Set<string> = new Set();
    for (const a in process.argv) {
      // act on the first occurrence, ignore the rest
      if (a.startsWith(TAGS_PREGIX_LONG) || a.startsWith(TAGS_PREFIX_SHORT)) {
        const parts: string[] = a.split('=');
        // if the tags value is invalid, just break out. we do not want throw
        // an error if the user is using the --tags incorrectly
        if (parts.length !== 2) {
          break;
        }

        argTags = new Set(parts[1].split(','));
        break;
      }
    }

    if (argTags.size > 0) {
      // filter tests by pragma
      tests = tests.filter((t: Test) => {
        const stream: fs.ReadStream = fs.createReadStream(t.path);
        const reader: readline.Interface = readline.createInterface({
          input: stream,
          crlfDelay: Infinity,
        });
        // for await (const line of reader) {
        // }
        // const {tags} = parse(test.context.docblock);
        // return argTags.has(tags.join(','));
      });
    }
    console.log('args: %s', process.argv);
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
