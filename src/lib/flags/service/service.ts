import {Reader, Writer} from '../flags';

export class Service {
  reader: Reader;
  writer: Writer;

  constructor(reader: Reader, writer: Writer) {
    this.reader = reader;
    this.writer = writer;

    this.validate();
  }

  validate(): void {
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
}
