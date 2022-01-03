// CouchbaseScope represents the scope in which the flag records will live.
export const CouchbaseScope = 'users';

// CouchbaseCollection represents the collection in which the flag records will
//  live.
export const CouchbaseCollection = 'flags';

// Record represents a feature flag record in the database.
export type Record = {
  // id of the feature flag record
  id: string;
  // name of the feature flag
  name: string;
  // default value of the feature flag. This value overrides any rules. If the
  // flag is set, no rules will be parsed.
  defaultValue: boolean;
  // tags of the feature flag that are used for variation rules.
  // TODO: might not need this
  tags?: Set<string>;
  // rules of the feature flag based on the tags for the flag. The key is
  // meant to be the tag and the value being the rules associated with that
  // tag. A rule chain is used to chain two rules with an AND/OR operation.
  //  At the moment, only two tags are supported in a rule chain.
  rules?: Map<string, RuleChain[]>;
};

export type RuleChain = {
  Rules: Rule[];
  ChainOp?: RuleChainOp;
};

export type Rule = {
  tag: string;
  not: boolean;
  ruleOp: RuleOp;
  value: string;
};

export enum RuleOp {
  EQUALS,
  STARTS_WITH,
  ENDS_WITH,
  CONTAINS,
}

export enum RuleChainOp {
  AND,
  OR,
}

export type Tag = {
  name: string;
};
