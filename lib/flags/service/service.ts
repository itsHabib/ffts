import {v4 as uuidv4} from 'uuid';
import {Reader, Record, Writer} from '../flags';
import {Update} from '../../couchbase/query/query';

// Service is responsible for managing feature flags for users. It has the
// following dependencies:
//
// reader - flag record reader
// writer - flag record writer
export class Service {
  reader: Reader;
  writer: Writer;

  constructor(reader: Reader, writer: Writer) {
    this.reader = reader;
    this.writer = writer;

    this.validate();
  }

  private validate(): void {
    const missingDeps: string[] = [
      {
        dep: 'flags reader',
        chk: (): boolean => this.reader !== null,
      },
      {
        dep: 'flags writer',
        chk: (): boolean => this.writer !== null,
      },
    ].reduce(
      (acc: string[], cur: {dep: string; chk: () => boolean}): string[] => {
        if (!cur.chk()) {
          acc.push(cur.dep);
        }
        return acc;
      },
      []
    );

    if (missingDeps.length > 0) {
      throw new Error(
        `unable to initialize flags service due to (%d) missing dependencies: ${missingDeps.join(
          ','
        )}`
      );
    }
  }

  // newFlag creates a new flag record in the database
  public async newFlag(name: string, defaultValue: boolean): Promise<Record> {
    const rec: Record = {
      id: uuidv4(),
      name: name,
      defaultValue: defaultValue,
    };

    await this.writer.create(rec);
    console.log('created new flag with id: %s', rec.id);

    return rec;
  }

  // setDefaultFlagValue updates the default value field of a flag record with
  // using the given parameter.
  public async setDefaultFlagValue(
    id: string,
    defaultValue: boolean
  ): Promise<void> {
    const update: Update = {
      field: 'defaultValue',
      value: defaultValue,
    };
    try {
      await this.writer.updateFields(id, update);
      console.log('updated flag with id: %s', id);
    } catch (e) {
      console.error('unable to update record: %s', e);
      throw e;
    }
  }
}
