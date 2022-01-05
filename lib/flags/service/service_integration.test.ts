import {Cluster, connect, DocumentNotFoundError} from 'couchbase';
import {Record, RuleChain, RuleChainOp, RuleOp} from '../';
import Writer from '../writer';
import Reader from '../reader';
import Service from '../service';

let s: Service;
let cfg: config;
let cluster: Cluster;

beforeAll(async () => {
  cfg = getConfig();
  cluster = await connect('couchbase://' + cfg.host, {
    username: cfg.username,
    password: cfg.password,
  });
});

afterAll(async () => {
  if (cluster !== undefined) {
    await cluster.close();
  }
});

beforeEach(() => {
  s = getService(cluster, cfg);
});

describe('ServiceFlagIntegration', () => {
  jest.setTimeout(10000000);

  let id: string;
  test('Service should be able create flag records', async () => {
    // new flag
    const record = await s.newFlag('fancy-feature', false);
    id = record.id;

    // pause for potential db delay
    await new Promise(resolve => setTimeout(resolve, 100));

    await s.reader.get(record.id);
  });

  test('Service should be able to create a rule chain', async () => {
    const rc: RuleChain = {
      PrimaryRule: {
        tag: {
          name: 'env',
          value: 'dev',
        },
        ruleOp: RuleOp.EQUALS,
      },
    };
    await s.addRuleChain(id, rc);
  });

  test('Service should be able to check flag rules', async () => {
    const value = await s.checkFlagRule(id, [
      {
        name: 'env',
        value: 'dev',
      },
    ]);
    expect(value).toEqual(true);

    const falseChk = await s.checkFlagRule(id, [
      {
        name: 'env',
        value: 'prod',
      },
    ]);
    expect(falseChk).toEqual(false);
  });

  test('Service should be able to create compound rule chains', async () => {
    const rc: RuleChain = {
      PrimaryRule: {
        tag: {
          name: 'env',
          value: 'dev',
        },
        ruleOp: RuleOp.EQUALS,
      },
      SecondaryRule: {
        tag: {
          name: 'org',
          value: 'internal',
        },
        ruleOp: RuleOp.STARTS_WITH,
      },
      ChainOp: RuleChainOp.AND,
    };
    await s.addRuleChain(id, rc);

    // pause for potential db delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const record = await s.reader.get(id);
    expect(record.ruleBlocks).toBeDefined();
    expect(Object.keys(record.ruleBlocks!)).toHaveLength(2);
    expect(record.ruleBlocks!['env']).toBeDefined();
    expect(record.ruleBlocks!['env+org']).toBeDefined();
  });

  test('Service should be able to check against compound flag rules', async () => {
    const value = await s.checkFlagRule(id, [
      {
        name: 'env',
        value: 'dev',
      },
      {
        name: 'org',
        value: 'internal-se',
      },
    ]);
    expect(value).toEqual(true);

    const falseChk = await s.checkFlagRule(id, [
      {
        name: 'env',
        value: 'prod',
      },
      {
        name: 'org',
        value: 'non-internal',
      },
    ]);
    expect(falseChk).toEqual(false);
  });

  test('Service should be able to delete flag records', async () => {
    // delete record check
    await s.writer.delete(id);

    // ensure get returns an error now
    await expect(s.reader.get(id)).rejects.toThrowError(DocumentNotFoundError);
  });
});

describe('ServiceCouchbaseDBIntegration', () => {
  jest.setTimeout(10000);

  const record: Record = {
    id: 'test' + Math.random(),
    name: 'ff',
    defaultValue: true,
  };

  test('Service should be able create flag records', async () => {
    // create
    await s.writer.create(record);
  });

  test('Service should be able to get flag records', async () => {
    // get check
    const r: Record = await s.reader.get(record.id);
    expect(r).toEqual(record);
  });

  test('Service should be able to update the flag records default value', async () => {
    await s.setDefaultFlagValue(record.id, false);
    // just to make sure it is updated b4 the read
    await new Promise(r => setTimeout(r, 200));

    // ensure the value was updated
    const r: Record = await s.reader.get(record.id);
    expect(r.defaultValue).toEqual(false);
  });

  test('Service should be able to delete flag records', async () => {
    // delete record check
    await s.writer.delete(record.id);

    // ensure get returns an error now
    await expect(s.reader.get(record.id)).rejects.toThrowError(
      DocumentNotFoundError
    );
  });
});

type config = {
  host: string;
  bucket: string;
  username: string;
  password: string;
};

function getConfig(): config {
  const missingEnvVars: string[] = [];
  const cfg: config = {
    host: (function (): string {
      if (process.env.COUCHBASE_HOST === undefined) {
        missingEnvVars.push('COUCHBASE_HOST');
        return '';
      }

      return process.env.COUCHBASE_HOST!;
    })(),
    bucket: (function (): string {
      if (process.env.COUCHBASE_BUCKET === undefined) {
        missingEnvVars.push('COUCHBASE_BUCKET');
        return '';
      }

      return process.env.COUCHBASE_BUCKET!;
    })(),
    username: (function (): string {
      if (process.env.COUCHBASE_USERNAME === undefined) {
        missingEnvVars.push('COUCHBASE_USERNAME');
        return '';
      }

      return process.env.COUCHBASE_USERNAME!;
    })(),
    password: (function (): string {
      if (process.env.COUCHBASE_PASSWORD === undefined) {
        missingEnvVars.push('COUCHBASE_PASSWORD');
        return '';
      }

      return process.env.COUCHBASE_PASSWORD!;
    })(),
  };

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingEnvVars.join(', ')}`
    );
  }

  return cfg;
}

function getService(cluster: Cluster, cfg: config): Service {
  return new Service(
    new Reader(cluster, cfg.bucket),
    new Writer(cluster, cfg.bucket)
  );
}
