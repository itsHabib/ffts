import {Cluster, connect as cbConnect, ConnectOptions} from 'couchbase';
import {Index} from '../lib/flags/reader/reader';
import {Record} from '../lib/flags/flags';

run()
  .then(() => {
    console.log('running');
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  })
  .catch((err: Error) => console.error('error: %s', err));

async function run(): Promise<void> {
  const bucket = 'local';
  const options: ConnectOptions = {
    username: 'Administrator',
    password: 'password',
  };

  let cluster: Cluster;
  try {
    cluster = await cbConnect('couchbase://127.0.0.1', options);
  } catch (e) {
    throw new Error(`unable to connect to couchbase: ${e}`);
  }

  const reader = new Index(cluster, bucket);
  const record: Record = await reader.get('tester');
  console.log('record: %s', record);
}
