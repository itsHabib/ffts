import {v4 as uuidv4} from 'uuid';
import {
  FlagCheck,
  Record,
  Rule,
  RuleChain,
  RuleChainOp,
  RuleOp,
  Tag,
} from '../';
import Reader from '../reader';
import Writer from '../writer';
import {Update} from '../../couchbase/query/query';

/// arbitrary limits

const MAX_TAGS_IN_CHECK = 2;
// rule blocks describe a unique set of tags and its ruleBlocks
const MAX_RULE_BLOCKS = 10;
const MAX_RULES_IN_BLOCK = 10;

// Service is responsible for managing feature flags for users. It has the
// following dependencies:
//
// reader - flag record reader
// writer - flag record writer
export default class Service {
  reader: Reader;
  writer: Writer;

  constructor(reader: Reader, writer: Writer) {
    this.reader = reader;
    this.writer = writer;

    this.validate();
  }

  // newFlag creates a new flag record in the database in a managed environment,
  //  the amount of tags can be controlled by the plan a user is on.
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

  // addRuleChain creates a new rule block or adds the new rule chain to an
  //  existing rule block.
  public async addRuleChain(id: string, rc: RuleChain): Promise<void> {
    let rec: Record;
    try {
      rec = await this.reader.get(id);
    } catch (e) {
      console.error('unable to find flag with id: %s', id);
      throw e;
    }

    if (rec.ruleBlocks === undefined) {
      rec.ruleBlocks = {};
    }

    // make sure the rule chain is valid and can be added to the ruleBlocks
    try {
      this.processNewRuleChain(rec.ruleBlocks, rc);
    } catch (e) {
      console.error('unable to process new rule chain: %s', e);
      throw e;
    }

    try {
      await this.writer.updateFields(rec.id, {
        field: 'ruleBlocks',
        value: rec.ruleBlocks,
      });
    } catch (e) {
      console.error('unable to update flag with new rule chain: %s', e);
      throw e;
    }
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

  public async checkFlagRule(id: string, tags: Tag[]): Promise<boolean> {
    let rec: Record;
    try {
      rec = await this.reader.get(id);
    } catch (e) {
      console.error('unable to get flag record from id(%s): %s', id, e);
      throw e;
    }

    if (rec.defaultValue) {
      return true;
    }

    if (rec.ruleBlocks === undefined) {
      return false;
    }

    return this.checkBlocks(rec.ruleBlocks, tags);
  }

  public checkBlocks(
    ruleBlocks: {[key: string]: RuleChain[]},
    tags: Tag[]
  ): boolean {
    if (tags.length > MAX_TAGS_IN_CHECK) {
      throw new Error('unable to check flag rule, too many tags');
    }

    // get rule block key from tags given
    const flagCheck: FlagCheck = formFlagCheck(tags);
    const key = getKeyFromFlagCheck(flagCheck);
    const ruleBlock = ruleBlocks[key];
    if (ruleBlock === undefined) {
      return false;
    }

    return this.checkRuleBlock(ruleBlock, flagCheck);
  }

  private checkRuleBlock(rc: RuleChain[], fc: FlagCheck): boolean {
    // go through each rule and try to find a true statement.
    for (let i = 0; i < rc.length; i++) {
      if (this.checkRuleChain(rc[i], fc)) {
        return true;
      }
    }

    return false;
  }

  private checkRuleChain(rc: RuleChain, fc: FlagCheck): boolean {
    const left = this.checkRule(rc.PrimaryRule, fc.PrimaryTag);

    // account for no second rule and short-circuiting from the chain
    if (
      rc.SecondaryRule === undefined ||
      fc.SecondaryTag === undefined ||
      (left && rc.ChainOp === RuleChainOp.OR) ||
      (!left && rc.ChainOp === RuleChainOp.AND)
    ) {
      return left;
    }

    const right = this.checkRule(rc.SecondaryRule, fc.SecondaryTag);

    switch (rc.ChainOp) {
      case RuleChainOp.AND:
        return and(left, right);
      case RuleChainOp.OR:
        return or(left, right);
      default:
        // shouldn't happen since we validate
        throw new Error('unable to check rule chain, invalid rule chain op');
    }
  }

  private checkRule(rule: Rule, tag: Tag): boolean {
    let test: boolean;
    switch (rule.ruleOp) {
      case RuleOp.CONTAINS:
        test = tag.value.includes(rule.tag.value);
        if (rule.not !== undefined && rule.not) {
          test = !test;
        }
        return test;
      case RuleOp.ENDS_WITH:
        test = tag.value.endsWith(rule.tag.value);
        if (rule.not) {
          test = !test;
        }
        return test;
      case RuleOp.EQUALS:
        test = rule.tag.value === tag.value;
        if (rule.not) {
          test = !test;
        }
        return test;
      case RuleOp.STARTS_WITH:
        test = tag.value.startsWith(rule.tag.value);
        if (rule.not) {
          test = !test;
        }
        return test;
      default:
        throw new Error('unable to form rule check');
    }
  }

  // processNewRuleChain validates that the rule chain can be added to the
  // passed in ruleBlocks map. If the rule chain is valid, it is added to the ruleBlocks
  // map.
  private processNewRuleChain(
    rules: {[key: string]: RuleChain[]},
    rc: RuleChain
  ): void {
    this.validateNewRuleChain(rules, rc);

    const rcKey = getKeyFromRuleChain(rc);
    const chains: RuleChain[] = rules[rcKey] || [];

    for (const c of chains) {
      if (equalChains(c, rc)) {
        throw new Error(
          `unable to process new rule chain due to duplicate rule chain: ${JSON.stringify(
            c
          )}`
        );
      }
    }

    chains.push(rc);
    rules[rcKey] = chains;
  }

  private validateNewRuleChain(
    rules: {[key: string]: RuleChain[]},
    rc: RuleChain
  ): void {
    // ensure tags are valid
    if (
      rc.PrimaryRule.tag.name === '' ||
      (rc.SecondaryRule !== undefined && rc.SecondaryRule.tag.name === '')
    ) {
      throw new Error('unable to process new rule chain due to empty tag(s)');
    }

    // ensure values are valid
    if (
      rc.PrimaryRule.tag.value === '' ||
      (rc.SecondaryRule !== undefined && rc.SecondaryRule.tag.value === '')
    ) {
      throw new Error(
        'unable to process new rule chain due to empty tag value(s)'
      );
    }

    // ensure rule ops are valid
    if (
      !validRuleOp(rc.PrimaryRule.ruleOp) ||
      (rc.SecondaryRule !== undefined && !validRuleOp(rc.SecondaryRule.ruleOp))
    ) {
      throw new Error(
        'unable to process new rule chain due to invalid rule op(s)'
      );
    }

    // ensure there is a chain op if we have more than one rule in the chain
    if (
      rc.SecondaryRule !== undefined &&
      (rc.ChainOp === undefined ||
        (rc.ChainOp !== RuleChainOp.AND && rc.ChainOp !== RuleChainOp.OR))
    ) {
      throw new Error(
        'unable to process new rule chain due to missing chain op'
      );
    }

    const rcKey = getKeyFromRuleChain(rc);
    const chains: RuleChain[] | undefined = rules[rcKey];
    if (chains === undefined && Object.keys(rules).length === MAX_RULE_BLOCKS) {
      throw new Error(
        `unable to process new rule chain due to too many rule blocks: ${MAX_RULE_BLOCKS}`
      );
    } else if (chains === undefined) {
      return;
    }

    if (chains.length + 1 > MAX_RULES_IN_BLOCK) {
      throw new Error(
        `unable to process new rule chain due to too many rules in block: ${chains.length}`
      );
    }
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
}

function formFlagCheck(tags: Tag[]): FlagCheck {
  tags.sort((a, b) => a.name.localeCompare(b.name));

  const fc: FlagCheck = {
    PrimaryTag: tags[0],
  };

  if (tags.length < MAX_TAGS_IN_CHECK) {
    return fc;
  }
  fc.SecondaryTag = tags[1];

  return fc;
}

function getKeyFromRuleChain(rc: RuleChain): string {
  if (rc.PrimaryRule.tag.name === '') {
    return '';
  }

  if (rc.SecondaryRule === undefined) {
    return rc.PrimaryRule.tag.name.toLowerCase();
  }

  let key = rc.PrimaryRule.tag.name.toLowerCase();
  if (rc.PrimaryRule.tag.name < rc.SecondaryRule.tag.name) {
    key += '+' + rc.SecondaryRule.tag.name.toLowerCase();
  } else {
    key = rc.SecondaryRule.tag.name.toLowerCase() + '+' + key;
  }

  return key;
}

function getKeyFromFlagCheck(fc: FlagCheck): string {
  if (fc.SecondaryTag === undefined || fc.SecondaryTag.name === '') {
    return fc.PrimaryTag.name.toLowerCase();
  }

  return (
    fc.PrimaryTag.name.toLowerCase() + '+' + fc.SecondaryTag.name.toLowerCase()
  );
}

function equalChains(a: RuleChain, b: RuleChain): boolean {
  return (
    a.PrimaryRule === b.PrimaryRule &&
    a.SecondaryRule === b.SecondaryRule &&
    a.ChainOp === b.ChainOp
  );
}

function validRuleOp(ruleOp: RuleOp): boolean {
  switch (ruleOp) {
    case RuleOp.CONTAINS:
      return true;
    case RuleOp.ENDS_WITH:
      return true;
    case RuleOp.EQUALS:
      return true;
    case RuleOp.STARTS_WITH:
      return true;
    default:
      return false;
  }
}

function and(a: boolean, b: boolean): boolean {
  return a && b;
}

function or(a: boolean, b: boolean): boolean {
  return a || b;
}
