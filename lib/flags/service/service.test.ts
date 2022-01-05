import Writer from '../writer';
import Reader from '../reader';
import Service from './';
import {Cluster} from 'couchbase';
import {Rule, RuleChain, RuleOp} from '../';

jest.mock('../writer');
jest.mock('../reader');

describe('Test_Service_newRuleChain', () => {
  let c: Cluster;
  let r: Reader;
  let w: Writer;
  let s: Service;

  beforeEach(() => {
    jest.clearAllMocks();

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

    const rc: RuleChain = {
      PrimaryRule: {
        ruleOp: RuleOp.EQUALS,
        tag: {
          name: 'name',
          value: 'value',
        },
      },
    };
    await expect(() => s.addRuleChain('id', rc)).rejects.toThrow();
  });

  test('should throw an error when the rule chain to be added is invalid.', async () => {
    mockReaderGet();
    const rc: RuleChain = {
      PrimaryRule: {
        tag: {
          name: 'test',
          value: 'value',
        },
        ruleOp: RuleOp.EQUALS,
      },
      SecondaryRule: {
        tag: {
          name: 'tag2',
          value: 'value2',
        },
        ruleOp: RuleOp.EQUALS,
      },
    };

    await expect(() => s.addRuleChain('id', rc)).rejects.toThrow();
  });

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
