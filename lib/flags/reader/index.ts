import {
  Cluster,
  Collection,
  DocumentNotFoundError,
  GetOptions,
} from 'couchbase';

import {CouchbaseScope, CouchbaseCollection, Record} from '../';

const cbTimeoutInMilli = 3000;

// Reader class is responsible for reading flag records from the database. A
// reader has the following dependencies:
// cluster - the connection to CB
// bucket - the Couchbase bucket
export default class Reader {
  private cluster: Cluster;
  private bucket: string;
  private collection: Collection;

  constructor(cluster: Cluster, bucket: string) {
    this.validateDeps(cluster, bucket);

    this.bucket = bucket;
    this.cluster = cluster;
    this.collection = this.cluster
      .bucket(this.bucket)
      .scope(CouchbaseScope)
      .collection(CouchbaseCollection);
  }

  private validateDeps(cluster: Cluster, bucket: string): void {
    const missingDeps: string[] = [
      {
        dep: 'clusterConnection',
        chk: (): boolean => cluster !== null && cluster !== undefined,
      },
      {
        dep: 'bucket',
        chk: (): boolean => bucket !== undefined && bucket !== '',
      },
    ].reduce((acc: string[], cur: {dep: string; chk: () => boolean}) => {
      if (!cur.chk()) {
        acc.push(cur.dep);
      }
      return acc;
    }, []);

    if (missingDeps.length > 0) {
      throw new Error(
        `unable to initialize flag reader due to ${
          missingDeps.length
        } dependencies: ${missingDeps.join(',')}`
      );
    }
  }

  // get retrieves a flag record using the given id. throws
  //  DocumentNotFoundError if no record is found.
  public async get(id: string): Promise<Record> {
    const options: GetOptions = {
      timeout: cbTimeoutInMilli,
    };
    try {
      const result = await this.collection.get(id, options);
      return validateFlag(result.content);
    } catch (e) {
      if (e instanceof DocumentNotFoundError) {
        throw e;
      }
      console.error('unable to get record: %s', e);
      throw e;
    }
  }
}

function validateFlag(object: any): Record {
  if (typeof object !== 'object') {
    throw new Error('unable to unmarshal result content');
  }

  const errors: string[] = [];
  [
    {
      key: 'id',
      chk: (): boolean =>
        object['id'] !== undefined && typeof object['id'] !== 'string',
    },
    {
      key: 'name',
      chk: (): boolean =>
        object['name'] !== undefined && typeof object['name'] !== 'string',
    },
    {
      key: 'defaultValue',
      chk: (): boolean =>
        object['default'] !== undefined &&
        typeof object['default'] !== 'boolean',
    },
  ].forEach(v => {
    if (!v['chk']) {
      errors.push(v['key']);
    }
  });

  if (errors.length > 0) {
    throw new Error(
      `unable to form FlagRecord due to the following errors: ${errors.join(
        ','
      )}`
    );
  }

  return {
    id: object.id,
    name: object.name,
    defaultValue: object.defaultValue,
    ruleBlocks: object.ruleBlocks,
  };
}
