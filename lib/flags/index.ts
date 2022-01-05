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
  // default value of the feature flag. This value overrides any ruleBlocks. If the
  // flag is set, no ruleBlocks will be parsed.
  defaultValue: boolean;
  // ruleBlocks of the feature flag based on the tags for the flag. The key is
  // meant to be the tag and the value being the ruleBlocks associated with that
  // tag. A rule chain is used to chain two ruleBlocks with an AND/OR operation.
  //  At the moment, only two tags are supported in a rule chain.
  ruleBlocks?: {[key: string]: RuleChain[]};
};

export type RuleChain = {
  PrimaryRule: Rule;
  SecondaryRule?: Rule;
  ChainOp?: RuleChainOp;
};

export type Rule = {
  tag: Tag;
  not?: boolean;
  ruleOp: RuleOp;
};

export enum RuleOp {
  EQUALS = 'EQUALS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  CONTAINS = 'CONTAINS',
}

export enum RuleChainOp {
  AND = 'AND',
  OR = 'OR',
}

export type Tag = {
  name: string;
  value: string;
};

export type FlagCheck = {
  PrimaryTag: Tag;
  SecondaryTag?: Tag;
};
