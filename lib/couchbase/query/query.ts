// FullyQualifiedName returns a fully qualified name for a given bucket, scope,
//  and collection that can be used in a query statement.
export function FullyQualifiedName(
  bucket: string,
  sc: ScopeCollection
): string {
  return `\`${bucket}\`.\`${sc.scope}\`.\`${sc.collection}\``;
}

// ScopeCollection represents an object grouping that contains the scope and
// collection names
export type ScopeCollection = {
  scope: string;
  collection: string;
};

// FieldUpdate represents the object used to construct the update/set parameters
// in a N1QL query statement
export type Update = {
  field: string;
  value: any;
};

export type Where = {
  field: string;
  value: any;
  operation: ConditionOp;
};

export enum ConditionOp {
  EQ = '=',
  NEQ = '!=',
  LT = '<',
  LTE = '<=',
  GT = '>',
  GTE = '>=',
  IS = 'IS',
  IS_NOT = 'IS NOT',
}

export enum Direction {
  ASC = 'ASC',
  DESC = 'DESC',
}

export type Order = {
  by: string;
  direction?: Direction;
};

// TODO: prob don't need this class and can just expose these methods
// Builder is used to build a N1QL query statement. Currently only an update
// is supported.
export class Builder {
  constructor() {}

  public buildUpdate(
    fqn: string,
    updates: Update[],
    wheres?: Where[],
    limit?: number
  ): [string, {[key: string]: any}] {
    if (updates.length === 0) {
      throw new Error('no updates given');
    }

    let base = `UPDATE ${fqn} SET `;
    let params: {[key: string]: any} = {};
    updates.forEach((u: Update, i: number) => {
      const queryParam: string = getQueryParamName(u.field, ParamContext.SET);
      base += `\`${u.field}\`` + ' = ' + queryParam;
      if (i !== updates.length - 1) {
        base += ',';
      }
      // without the '$'
      params[queryParam.slice(1)] = u.value;
    });

    // only supporting AND chaining for now
    if (wheres !== undefined && wheres.length > 0) {
      try {
        const [whereQuery, whereParams] = this.buildWhereClause(wheres);
        base += whereQuery;
        params = {...params, ...whereParams};
      } catch (e) {
        console.error('unable to build where clause: %s', e);
        throw e;
      }
    }

    if (limit !== undefined) {
      try {
        base += this.buildLimitClause(limit);
      } catch (e) {
        console.error('unable to build limit clause: %s', e);
        throw e;
      }
    }

    return [base, params];
  }

  private buildWhereClause(wheres: Where[]): [string, {[key: string]: any}] {
    if (wheres.length === 0) {
      throw new Error('no wheres given');
    }

    let base = ' WHERE ';
    const params: {[key: string]: any} = {};
    wheres.forEach((w: Where, i: number) => {
      const queryParam: string = getQueryParamName(w.field, ParamContext.WHERE);
      base += `\`${w.field}\` ${w.operation} ${queryParam}`;
      if (i !== wheres.length - 1) {
        base += ' AND ';
      }
      // without the '$'
      params[queryParam.slice(1)] = w.value;
    });

    return [base, params];
  }

  private buildOrderClause(order: Order): string {
    let base = '';
    if (order !== undefined) {
      base += ` ORDER BY \`${order.by}\``;
      if (order.direction !== undefined) {
        base += ` ${order.direction}`;
      }
    }

    return base;
  }

  private buildLimitClause(limit: number): string {
    let base = '';
    if (limit !== undefined) {
      if (limit <= 0) {
        throw new Error('limit must be > 0');
      }
      base += ` LIMIT ${limit}`;
    }

    return base;
  }
}

enum ParamContext {
  SET = 's',
  WHERE = 'w',
}

function getQueryParamName(name: string, context: ParamContext): string {
  return `$q${context}__${name.replace('.', '_')}`;
}
