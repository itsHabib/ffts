export {Record} from './record';
export {Reader} from './reader/reader';
export {Writer} from './writer/writer';
export {Service} from './service/service';

// CouchbaseScope represents the scope in which the flag records will live.
export const CouchbaseScope = 'users';
// CouchbaseCollection represents the collection in which the flag records will
//  live.
export const CouchbaseCollection = 'flags';
