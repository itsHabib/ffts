import Writer from '../writer';
import Reader from '../reader';
import Service from './';
import {Cluster} from 'couchbase';
import {RuleChain, RuleOp} from '../';

jest.mock('../writer');
jest.mock('../reader');
// jest.mock('couchbase');

describe('Test_Service_newRuleChain', () => {
  let c: Cluster;
  let r: Reader;
  let w: Writer;
  let s: Service;

  beforeEach(() => {
    Reader.mockClear();
    Writer.mockClear();

    c = new Cluster('', {});
    r = new Reader(c, 'bucket');
    w = new Writer(c, 'bucket');
    s = new Service(r, w);
  });

  test('should throw an error when the flag record could not be retrieved', async () => {
    jest.mock('../reader', () => {
      return jest.fn().mockImplementation(() => {
        return {
          get: () => {
            throw new Error('random');
          },
        };
      });
    });

    // TODO: fix
    // await expect(() => s.addRuleChain('id', {Rules: []})).rejects.toThrow();
  });

  // TODO: fix
  // test('should throw an error when the rule chain to be added is invalid.', async () => {
  //   mockReaderGet();
  //   const rc: RuleChain = {
  //     Rules: [
  //       {
  //         tag: 'tag',
  //         ruleOp: RuleOp.EQUALS,
  //         value: 'value',
  //       },
  //       {
  //         tag: 'tag2',
  //         ruleOp: RuleOp.EQUALS,
  //         value: 'value2',
  //       },
  //     ],
  //   };
  //
  //   await expect(() => s.addRuleChain('id', rc)).rejects.toThrow();
  // });

  // TODO: do the rest
});

function mockReaderGet() {
  jest.mock('../reader', () => {
    return jest.fn().mockImplementation(() => {
      return {
        get: () => {
          return {
            id: 'id',
            rules: [],
          };
        },
      };
    });
  });
}
