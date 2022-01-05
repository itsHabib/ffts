# FFTS

Feature flag manager written in Typescript. Primary purpose was to help me become familiar with TS.

## Concept
A user creates a feature flag with a name and default value.
Within a feature flag are rule blocks. Each rule block holds rules that 
are unique by the combination of primary + secondary tags. Within a rule block
are rule chains that describe the various rules related to the set of tags for
the block. As an example, the below rule chain describes a rule in which
both the 'env' tag has to equal the value 'dev' and the 'org' tag must start
with 'internal'.
```
const rc: RuleChain = {
  PrimaryRule: {
    tag: {
      name: 'env',
      value: 'dev',
    },
    ruleOp: RuleOp.EQUALS,
  },
  SecondaryRule: {
    tag: {
      name: 'org',
      value: 'internal',
    },
    ruleOp: RuleOp.STARTS_WITH,
  },
  ChainOp: RuleChainOp.AND,
};
```
