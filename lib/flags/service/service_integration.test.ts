import {Cluster, connect, DocumentNotFoundError} from 'couchbase';
import {Reader, Record, Writer, Service} from '../flags';

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

describe('ServiceCouchbaseDBIntegration', () => {
  const record: Record = {
    id: 'test' + Math.random(),
    name: 'ff',
    defaultValue: true,
  };
  jest.setTimeout(100000);

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
