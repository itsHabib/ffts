import {v4 as uuidv4} from 'uuid';
import {Record} from '../';
import Reader from '../reader';
import Writer from '../writer';
import {Update} from '../../couchbase/query/query';
import {Rule, RuleChain, Tag} from '../';

/// arbitrary limits

const MAX_RULES_IN_CHAIN = 2;
// rule blocks describe a unique set of tags and its rules
const MAX_RULE_BLOCKS = 10;
const MAX_RULES_IN_BLOCK = 25;

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

  // newFlag creates a new flag record in the database in a managed environment,
  //  the amount of tags can be controlled by the plan a user is on.
  public async newFlag(
    name: string,
    defaultValue: boolean,
    ...tags: string[]
  ): Promise<Record> {
    const rec: Record = {
      id: uuidv4(),
      name: name,
      defaultValue: defaultValue,
    };

    if (tags.length > 0) {
      rec.tags = new Set(tags);
    }

    await this.writer.create(rec);
    console.log('created new flag with id: %s', rec.id);

    return rec;
  }

  // newRuleChain creates a new rule block or add the new rule chain to an
  //  existing rule block.
  public async newRuleChain(id: string, rc: RuleChain): Promise<void> {
    let rec: Record;
    try {
      rec = await this.reader.get(id);
    } catch (e) {
      console.error('unable to find flag with id: %s', id);
      throw e;
    }

    if (rec.rules === undefined) {
      rec.rules = new Map<string, RuleChain[]>();
    }

    // make sure the rule chain is valid and can be added to the rules
    try {
      this.processNewRuleChain(rec.rules, rc);
    } catch (e) {
      console.error('unable to process new rule chain: %s', e);
      throw e;
    }

    try {
      await this.writer.updateFields(rec.id, {
        field: 'rules',
        value: rec.rules,
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

  // processNewRuleChain validates that the rule chain can be added to the
  // passed in rules map. The rule chain can only contain a maximum of 2 rules
  //  and there can not already be an existing rule chain already present. If
  // the rule chain is valid, it is added to the rules map.
  private processNewRuleChain(
    rules: Map<string, RuleChain[]>,
    rc: RuleChain
  ): void {
    this.validateNewRuleChain(rules, rc);

    const rcKey = getRuleChainKey(rc);
    const chains: RuleChain[] = rules.get(rcKey) || [];

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
    rules.set(rcKey, chains);
  }

  private validateNewRuleChain(
    rules: Map<string, RuleChain[]>,
    rc: RuleChain
  ): void {
    if (rc.Rules.length > MAX_RULES_IN_CHAIN) {
      throw new Error(
        `unable to process new rule chain due to too many rules in chain: ${rc.Rules.length}`
      );
    }

    // ensure there is a chain op if we have more than one rule in the chain
    if (rc.Rules.length > 1 && rc.ChainOp === undefined) {
      throw new Error(
        'unable to process new rule chain due to missing chain op'
      );
    }

    const rcKey = getRuleChainKey(rc);
    const chains: RuleChain[] | undefined = rules.get(rcKey);
    if (chains === undefined && rules.size === MAX_RULE_BLOCKS) {
      throw new Error(
        `unable to process new rule chain due to too many rule blocks: ${rules.size}`
      );
    } else if (chains === undefined) {
      return;
    }

    if (chains.length + rc.Rules.length > MAX_RULES_IN_BLOCK) {
      throw new Error(
        `unable to process new rule chain due to too many rules in block: ${
          chains.length + rc.Rules.length
        }`
      );
    }
  }
}

function getRuleChainKey(rc: RuleChain): string {
  if (rc.Rules.length === 0) {
    return '';
  }

  return rc.Rules.reduce(
    (acc: string, cur: Rule): string => acc + '+' + cur.tag,
    ''
  );
}

function equalChains(a: RuleChain, b: RuleChain): boolean {
  if (a.Rules.length !== b.Rules.length || a.ChainOp !== b.ChainOp) {
    return false;
  }

  a.Rules.sort((a, b) => a.value.length - b.value.length);
  b.Rules.sort((a, b) => a.value.length - b.value.length);

  for (let i = 0; i < a.Rules.length; i++) {
    if (a.Rules[i] !== b.Rules[i]) {
      return false;
    }
  }

  return true;
}
