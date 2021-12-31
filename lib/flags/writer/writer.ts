import {
  Cluster,
  Collection,
  DocumentNotFoundError,
  DurabilityLevel,
  InsertOptions,
  QueryOptions,
  QueryScanConsistency,
  RemoveOptions,
} from 'couchbase';
import {CouchbaseCollection, CouchbaseScope, Record} from '../flags';
import {
  Builder,
  ConditionOp,
  FullyQualifiedName,
  Update,
  Where,
} from '../../couchbase/query/query';

const cbTimeoutInMilli = 5000;

// Writer class is responsible for creating and manipulating flag records
// in the database. A writer has the following dependencies:
// cluster - the connection to CB
// bucket - the Couchbase bucket
export class Writer {
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
        `unable to initialize flag writer due to ${
          missingDeps.length
        } dependencies: ${missingDeps.join(',')}`
      );
    }
  }

  // create will create a new flag record in the database
  public async create(record: Record): Promise<void> {
    const options: InsertOptions = {
      timeout: cbTimeoutInMilli,
      durabilityLevel: DurabilityLevel.None,
    };

    try {
      await this.collection.insert(record.id, record, options);
    } catch (e) {
      console.error('unable to create record: %s', e);
      throw e;
    }
  }

  // delete will delete a flag record with the given id. If no record is found
  // no error is thrown.
  public async delete(id: string): Promise<void> {
    const options: RemoveOptions = {
      timeout: cbTimeoutInMilli,
    };

    try {
      await this.collection.remove(id, options);
    } catch (e) {
      // if nothing is found we don't have to throw an error;
      if (e instanceof DocumentNotFoundError) {
        return;
      }
      console.error('unable to delete record: %s', e);
      // TODO: create own error types
      throw e;
    }
  }

  // updateFields attempts to update only the specific fields in the record.
  public async updateFields(id: string, ...updates: Update[]): Promise<void> {
    const where: Where = {
      field: 'id',
      value: id,
      operation: ConditionOp.EQ,
    };
    const fqn = FullyQualifiedName(this.bucket, {
      scope: CouchbaseScope,
      collection: CouchbaseCollection,
    });

    const qb: Builder = new Builder();
    let query: string;
    let params: {[key: string]: any};

    try {
      [query, params] = qb.buildUpdate(fqn, updates, [where], 1);
    } catch (e) {
      console.error('unable to build update query: %s', e);
      throw e;
    }

    try {
      const queryOptions: QueryOptions = {
        timeout: cbTimeoutInMilli,
        // TODO: if time allows check it this adds too much of a time cost
        scanConsistency: QueryScanConsistency.RequestPlus,
        parameters: params,
      };
      console.log('query: %s', query);
      console.log('params: %s', params);
      await this.cluster.query(query, queryOptions);
    } catch (e) {
      console.error('unable to update record: %s', e);
      throw e;
    }
  }
}
