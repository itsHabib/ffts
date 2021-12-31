// Record represents a feature flag record in the database.
export type Record = {
  // id of the feature flag record
  id: string;
  // name of the feature flag
  name: string;
  // default value of the feature flag. This value overrides any rules. If the
  // flag is set, no rules will be parsed.
  defaultValue: boolean;
  // tags of the feature flag that are used for variation rules. For example,
  // an environment tag that could be used to control feature flags in certain
  // environments.
  tags?: {};
  // TODO figure out what this looks like
  rules?: any[];
};
