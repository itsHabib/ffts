import Writer from '../writer';
import Reader from '../reader';
import Service from './';
import {Cluster} from 'couchbase';
import {RuleChainOp, Tag} from '../';

jest.mock('../writer');
jest.mock('../reader');
// jest.mock('couchbase');

beforeEach(() => {
  Reader.mockClear();
  Writer.mockClear();
});

describe('Test_Service_newTag', () => {
  const tag: Tag = {
    name: 'tagName',
  };

  let c: Cluster;
  let r: Reader;
  let w: Writer;
  let s: Service;

  beforeEach(() => {
    c = new Cluster('', {});
    r = new Reader(c, 'bucket');
    w = new Writer(c, 'bucket');
    s = new Service(r, w);
  });

  test('should return an error when the flag record could not be retrieved', async () => {
    jest.mock('../reader', () => {
      return jest.fn().mockImplementation(() => {
        return {
          get: () => {
            throw new Error('random');
          },
        };
      });
    });

    await expect(() => s.newRuleChain('id', {Rules: []})).rejects.toThrow();
  });
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
