import {
  Builder,
  ConditionOp,
  Direction,
  FullyQualifiedName,
  Order,
  ScopeCollection,
  Update,
  Where,
} from './query';

describe('TestUpdateQueryBuilder', () => {
  const bucket = 'default';
  const sc: ScopeCollection = {
    scope: 'query',
    collection: 'tests',
  };
  const defaultUpdates: Update[] = [
    {
      field: 'foo.bar',
      value: 'bar',
    },
    {
      field: 'bizz.buzz',
      value: 'buzz',
    },
  ];
  const tests: {
    desc: string;
    updates: Update[];
    wheres?: Where[];
    limit?: number;
    exp?: [string, {[key: string]: any}];
    wantErr: boolean;
  }[] = [
    {
      desc: 'should throw an error when no updates given',
      wantErr: true,
      updates: [],
    },
    {
      desc: 'should build an update query properly with a single field',
      updates: [
        {
          field: 'foo.bar',
          value: 'bar',
        },
      ],
      wantErr: false,
      exp: [
        'UPDATE `default`.`query`.`tests` SET `foo.bar` = $qs__foo_bar',
        {qs__foo_bar: 'bar'},
      ],
    },
    {
      desc: 'should build an update query properly with multiple fields',
      updates: defaultUpdates,
      wantErr: false,
      exp: [
        'UPDATE `default`.`query`.`tests` SET `foo.bar` = $qs__foo_bar,`bizz.buzz` = $qs__bizz_buzz',
        {qs__foo_bar: 'bar', qs__bizz_buzz: 'buzz'},
      ],
    },
    {
      desc: 'should throw an error when receiving a limit < 1',
      updates: defaultUpdates,
      limit: 0,
      wantErr: true,
    },
    {
      desc: 'should build an update query with wheres, order, and limit',
      updates: defaultUpdates,
      wheres: [
        {
          field: 'test.foo',
          value: 'bar.baz',
          operation: ConditionOp.EQ,
        },
        {
          field: 'another.where',
          value: 1,
          operation: ConditionOp.LT,
        },
      ],
      limit: 10,
      wantErr: false,
      exp: [
        'UPDATE `default`.`query`.`tests` SET `foo.bar` = $qs__foo_bar,' +
          '`bizz.buzz` = $qs__bizz_buzz WHERE `test.foo` = $qw__test_foo' +
          ' AND `another.where` < $qw__another_where LIMIT 10',
        {
          qs__foo_bar: 'bar',
          qs__bizz_buzz: 'buzz',
          qw__test_foo: 'bar.baz',
          qw__another_where: 1,
        },
      ],
    },
  ];

  tests.forEach(tc => {
    test(tc.desc, () => {
      const fqn = FullyQualifiedName(bucket, sc);
      const b: Builder = new Builder();
      if (tc.wantErr) {
        expect(() =>
          b.buildUpdate(fqn, tc.updates, tc.wheres, tc.limit)
        ).toThrow();
        return;
      }

      const [query, params] = b.buildUpdate(
        fqn,
        tc.updates,
        tc.wheres,
        tc.limit
      );
      expect(query).toEqual(tc.exp![0]);
      expect(params).toEqual(tc.exp![1]);
    });
  });
});
