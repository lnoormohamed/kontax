
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Contact
 * 
 */
export type Contact = $Result.DefaultSelection<Prisma.$ContactPayload>
/**
 * Model SubscriptionCustomer
 * 
 */
export type SubscriptionCustomer = $Result.DefaultSelection<Prisma.$SubscriptionCustomerPayload>
/**
 * Model Subscription
 * 
 */
export type Subscription = $Result.DefaultSelection<Prisma.$SubscriptionPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const AccountLifecycleState: {
  ACTIVE: 'ACTIVE',
  TRIALING: 'TRIALING',
  GRACE: 'GRACE',
  CANCELED: 'CANCELED',
  LOCKED: 'LOCKED'
};

export type AccountLifecycleState = (typeof AccountLifecycleState)[keyof typeof AccountLifecycleState]


export const BillingProvider: {
  STRIPE: 'STRIPE'
};

export type BillingProvider = (typeof BillingProvider)[keyof typeof BillingProvider]


export const SubscriptionPlan: {
  FREE: 'FREE',
  PLUS: 'PLUS',
  PRO: 'PRO'
};

export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan]


export const SubscriptionStatus: {
  INCOMPLETE: 'INCOMPLETE',
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED'
};

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]


export const SubscriptionInterval: {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY'
};

export type SubscriptionInterval = (typeof SubscriptionInterval)[keyof typeof SubscriptionInterval]

}

export type AccountLifecycleState = $Enums.AccountLifecycleState

export const AccountLifecycleState: typeof $Enums.AccountLifecycleState

export type BillingProvider = $Enums.BillingProvider

export const BillingProvider: typeof $Enums.BillingProvider

export type SubscriptionPlan = $Enums.SubscriptionPlan

export const SubscriptionPlan: typeof $Enums.SubscriptionPlan

export type SubscriptionStatus = $Enums.SubscriptionStatus

export const SubscriptionStatus: typeof $Enums.SubscriptionStatus

export type SubscriptionInterval = $Enums.SubscriptionInterval

export const SubscriptionInterval: typeof $Enums.SubscriptionInterval

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.contact`: Exposes CRUD operations for the **Contact** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Contacts
    * const contacts = await prisma.contact.findMany()
    * ```
    */
  get contact(): Prisma.ContactDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.subscriptionCustomer`: Exposes CRUD operations for the **SubscriptionCustomer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SubscriptionCustomers
    * const subscriptionCustomers = await prisma.subscriptionCustomer.findMany()
    * ```
    */
  get subscriptionCustomer(): Prisma.SubscriptionCustomerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.subscription`: Exposes CRUD operations for the **Subscription** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Subscriptions
    * const subscriptions = await prisma.subscription.findMany()
    * ```
    */
  get subscription(): Prisma.SubscriptionDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Contact: 'Contact',
    SubscriptionCustomer: 'SubscriptionCustomer',
    Subscription: 'Subscription'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "contact" | "subscriptionCustomer" | "subscription"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Contact: {
        payload: Prisma.$ContactPayload<ExtArgs>
        fields: Prisma.ContactFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ContactFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ContactFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          findFirst: {
            args: Prisma.ContactFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ContactFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          findMany: {
            args: Prisma.ContactFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>[]
          }
          create: {
            args: Prisma.ContactCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          createMany: {
            args: Prisma.ContactCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ContactCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>[]
          }
          delete: {
            args: Prisma.ContactDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          update: {
            args: Prisma.ContactUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          deleteMany: {
            args: Prisma.ContactDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ContactUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ContactUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>[]
          }
          upsert: {
            args: Prisma.ContactUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ContactPayload>
          }
          aggregate: {
            args: Prisma.ContactAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateContact>
          }
          groupBy: {
            args: Prisma.ContactGroupByArgs<ExtArgs>
            result: $Utils.Optional<ContactGroupByOutputType>[]
          }
          count: {
            args: Prisma.ContactCountArgs<ExtArgs>
            result: $Utils.Optional<ContactCountAggregateOutputType> | number
          }
        }
      }
      SubscriptionCustomer: {
        payload: Prisma.$SubscriptionCustomerPayload<ExtArgs>
        fields: Prisma.SubscriptionCustomerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SubscriptionCustomerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SubscriptionCustomerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          findFirst: {
            args: Prisma.SubscriptionCustomerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SubscriptionCustomerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          findMany: {
            args: Prisma.SubscriptionCustomerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>[]
          }
          create: {
            args: Prisma.SubscriptionCustomerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          createMany: {
            args: Prisma.SubscriptionCustomerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SubscriptionCustomerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>[]
          }
          delete: {
            args: Prisma.SubscriptionCustomerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          update: {
            args: Prisma.SubscriptionCustomerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          deleteMany: {
            args: Prisma.SubscriptionCustomerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SubscriptionCustomerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SubscriptionCustomerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>[]
          }
          upsert: {
            args: Prisma.SubscriptionCustomerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionCustomerPayload>
          }
          aggregate: {
            args: Prisma.SubscriptionCustomerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSubscriptionCustomer>
          }
          groupBy: {
            args: Prisma.SubscriptionCustomerGroupByArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionCustomerGroupByOutputType>[]
          }
          count: {
            args: Prisma.SubscriptionCustomerCountArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionCustomerCountAggregateOutputType> | number
          }
        }
      }
      Subscription: {
        payload: Prisma.$SubscriptionPayload<ExtArgs>
        fields: Prisma.SubscriptionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SubscriptionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SubscriptionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          findFirst: {
            args: Prisma.SubscriptionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SubscriptionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          findMany: {
            args: Prisma.SubscriptionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>[]
          }
          create: {
            args: Prisma.SubscriptionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          createMany: {
            args: Prisma.SubscriptionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SubscriptionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>[]
          }
          delete: {
            args: Prisma.SubscriptionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          update: {
            args: Prisma.SubscriptionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          deleteMany: {
            args: Prisma.SubscriptionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SubscriptionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SubscriptionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>[]
          }
          upsert: {
            args: Prisma.SubscriptionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SubscriptionPayload>
          }
          aggregate: {
            args: Prisma.SubscriptionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSubscription>
          }
          groupBy: {
            args: Prisma.SubscriptionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SubscriptionCountArgs<ExtArgs>
            result: $Utils.Optional<SubscriptionCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    contact?: ContactOmit
    subscriptionCustomer?: SubscriptionCustomerOmit
    subscription?: SubscriptionOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    contacts: number
    subscriptions: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    contacts?: boolean | UserCountOutputTypeCountContactsArgs
    subscriptions?: boolean | UserCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountContactsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ContactWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionWhereInput
  }


  /**
   * Count Type SubscriptionCustomerCountOutputType
   */

  export type SubscriptionCustomerCountOutputType = {
    subscriptions: number
  }

  export type SubscriptionCustomerCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    subscriptions?: boolean | SubscriptionCustomerCountOutputTypeCountSubscriptionsArgs
  }

  // Custom InputTypes
  /**
   * SubscriptionCustomerCountOutputType without action
   */
  export type SubscriptionCustomerCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomerCountOutputType
     */
    select?: SubscriptionCustomerCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * SubscriptionCustomerCountOutputType without action
   */
  export type SubscriptionCustomerCountOutputTypeCountSubscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    lifecycleState: $Enums.AccountLifecycleState | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    name: string | null
    email: string | null
    password: string | null
    lifecycleState: $Enums.AccountLifecycleState | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    name: number
    email: number
    password: number
    lifecycleState: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    lifecycleState?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    lifecycleState?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    name?: true
    email?: true
    password?: true
    lifecycleState?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    name: string | null
    email: string
    password: string
    lifecycleState: $Enums.AccountLifecycleState
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    lifecycleState?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    contacts?: boolean | User$contactsArgs<ExtArgs>
    subscriptionCustomer?: boolean | User$subscriptionCustomerArgs<ExtArgs>
    subscriptions?: boolean | User$subscriptionsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    lifecycleState?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    lifecycleState?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    name?: boolean
    email?: boolean
    password?: boolean
    lifecycleState?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "email" | "password" | "lifecycleState" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    contacts?: boolean | User$contactsArgs<ExtArgs>
    subscriptionCustomer?: boolean | User$subscriptionCustomerArgs<ExtArgs>
    subscriptions?: boolean | User$subscriptionsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      contacts: Prisma.$ContactPayload<ExtArgs>[]
      subscriptionCustomer: Prisma.$SubscriptionCustomerPayload<ExtArgs> | null
      subscriptions: Prisma.$SubscriptionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string | null
      email: string
      password: string
      lifecycleState: $Enums.AccountLifecycleState
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    contacts<T extends User$contactsArgs<ExtArgs> = {}>(args?: Subset<T, User$contactsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    subscriptionCustomer<T extends User$subscriptionCustomerArgs<ExtArgs> = {}>(args?: Subset<T, User$subscriptionCustomerArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    subscriptions<T extends User$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, User$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly lifecycleState: FieldRef<"User", 'AccountLifecycleState'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.contacts
   */
  export type User$contactsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    where?: ContactWhereInput
    orderBy?: ContactOrderByWithRelationInput | ContactOrderByWithRelationInput[]
    cursor?: ContactWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ContactScalarFieldEnum | ContactScalarFieldEnum[]
  }

  /**
   * User.subscriptionCustomer
   */
  export type User$subscriptionCustomerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    where?: SubscriptionCustomerWhereInput
  }

  /**
   * User.subscriptions
   */
  export type User$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    where?: SubscriptionWhereInput
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    cursor?: SubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SubscriptionScalarFieldEnum | SubscriptionScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Contact
   */

  export type AggregateContact = {
    _count: ContactCountAggregateOutputType | null
    _min: ContactMinAggregateOutputType | null
    _max: ContactMaxAggregateOutputType | null
  }

  export type ContactMinAggregateOutputType = {
    id: string | null
    userId: string | null
    fullName: string | null
    email: string | null
    phone: string | null
    company: string | null
    notes: string | null
    archivedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ContactMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    fullName: string | null
    email: string | null
    phone: string | null
    company: string | null
    notes: string | null
    archivedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ContactCountAggregateOutputType = {
    id: number
    userId: number
    fullName: number
    email: number
    phone: number
    company: number
    notes: number
    archivedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ContactMinAggregateInputType = {
    id?: true
    userId?: true
    fullName?: true
    email?: true
    phone?: true
    company?: true
    notes?: true
    archivedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ContactMaxAggregateInputType = {
    id?: true
    userId?: true
    fullName?: true
    email?: true
    phone?: true
    company?: true
    notes?: true
    archivedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ContactCountAggregateInputType = {
    id?: true
    userId?: true
    fullName?: true
    email?: true
    phone?: true
    company?: true
    notes?: true
    archivedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ContactAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Contact to aggregate.
     */
    where?: ContactWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contacts to fetch.
     */
    orderBy?: ContactOrderByWithRelationInput | ContactOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ContactWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contacts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contacts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Contacts
    **/
    _count?: true | ContactCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ContactMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ContactMaxAggregateInputType
  }

  export type GetContactAggregateType<T extends ContactAggregateArgs> = {
        [P in keyof T & keyof AggregateContact]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateContact[P]>
      : GetScalarType<T[P], AggregateContact[P]>
  }




  export type ContactGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ContactWhereInput
    orderBy?: ContactOrderByWithAggregationInput | ContactOrderByWithAggregationInput[]
    by: ContactScalarFieldEnum[] | ContactScalarFieldEnum
    having?: ContactScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ContactCountAggregateInputType | true
    _min?: ContactMinAggregateInputType
    _max?: ContactMaxAggregateInputType
  }

  export type ContactGroupByOutputType = {
    id: string
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    company: string | null
    notes: string | null
    archivedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: ContactCountAggregateOutputType | null
    _min: ContactMinAggregateOutputType | null
    _max: ContactMaxAggregateOutputType | null
  }

  type GetContactGroupByPayload<T extends ContactGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ContactGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ContactGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ContactGroupByOutputType[P]>
            : GetScalarType<T[P], ContactGroupByOutputType[P]>
        }
      >
    >


  export type ContactSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    fullName?: boolean
    email?: boolean
    phone?: boolean
    company?: boolean
    notes?: boolean
    archivedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["contact"]>

  export type ContactSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    fullName?: boolean
    email?: boolean
    phone?: boolean
    company?: boolean
    notes?: boolean
    archivedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["contact"]>

  export type ContactSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    fullName?: boolean
    email?: boolean
    phone?: boolean
    company?: boolean
    notes?: boolean
    archivedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["contact"]>

  export type ContactSelectScalar = {
    id?: boolean
    userId?: boolean
    fullName?: boolean
    email?: boolean
    phone?: boolean
    company?: boolean
    notes?: boolean
    archivedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ContactOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "fullName" | "email" | "phone" | "company" | "notes" | "archivedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["contact"]>
  export type ContactInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ContactIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ContactIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ContactPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Contact"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      fullName: string
      email: string | null
      phone: string | null
      company: string | null
      notes: string | null
      archivedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["contact"]>
    composites: {}
  }

  type ContactGetPayload<S extends boolean | null | undefined | ContactDefaultArgs> = $Result.GetResult<Prisma.$ContactPayload, S>

  type ContactCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ContactFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ContactCountAggregateInputType | true
    }

  export interface ContactDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Contact'], meta: { name: 'Contact' } }
    /**
     * Find zero or one Contact that matches the filter.
     * @param {ContactFindUniqueArgs} args - Arguments to find a Contact
     * @example
     * // Get one Contact
     * const contact = await prisma.contact.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ContactFindUniqueArgs>(args: SelectSubset<T, ContactFindUniqueArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Contact that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ContactFindUniqueOrThrowArgs} args - Arguments to find a Contact
     * @example
     * // Get one Contact
     * const contact = await prisma.contact.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ContactFindUniqueOrThrowArgs>(args: SelectSubset<T, ContactFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Contact that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactFindFirstArgs} args - Arguments to find a Contact
     * @example
     * // Get one Contact
     * const contact = await prisma.contact.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ContactFindFirstArgs>(args?: SelectSubset<T, ContactFindFirstArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Contact that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactFindFirstOrThrowArgs} args - Arguments to find a Contact
     * @example
     * // Get one Contact
     * const contact = await prisma.contact.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ContactFindFirstOrThrowArgs>(args?: SelectSubset<T, ContactFindFirstOrThrowArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Contacts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Contacts
     * const contacts = await prisma.contact.findMany()
     * 
     * // Get first 10 Contacts
     * const contacts = await prisma.contact.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const contactWithIdOnly = await prisma.contact.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ContactFindManyArgs>(args?: SelectSubset<T, ContactFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Contact.
     * @param {ContactCreateArgs} args - Arguments to create a Contact.
     * @example
     * // Create one Contact
     * const Contact = await prisma.contact.create({
     *   data: {
     *     // ... data to create a Contact
     *   }
     * })
     * 
     */
    create<T extends ContactCreateArgs>(args: SelectSubset<T, ContactCreateArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Contacts.
     * @param {ContactCreateManyArgs} args - Arguments to create many Contacts.
     * @example
     * // Create many Contacts
     * const contact = await prisma.contact.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ContactCreateManyArgs>(args?: SelectSubset<T, ContactCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Contacts and returns the data saved in the database.
     * @param {ContactCreateManyAndReturnArgs} args - Arguments to create many Contacts.
     * @example
     * // Create many Contacts
     * const contact = await prisma.contact.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Contacts and only return the `id`
     * const contactWithIdOnly = await prisma.contact.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ContactCreateManyAndReturnArgs>(args?: SelectSubset<T, ContactCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Contact.
     * @param {ContactDeleteArgs} args - Arguments to delete one Contact.
     * @example
     * // Delete one Contact
     * const Contact = await prisma.contact.delete({
     *   where: {
     *     // ... filter to delete one Contact
     *   }
     * })
     * 
     */
    delete<T extends ContactDeleteArgs>(args: SelectSubset<T, ContactDeleteArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Contact.
     * @param {ContactUpdateArgs} args - Arguments to update one Contact.
     * @example
     * // Update one Contact
     * const contact = await prisma.contact.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ContactUpdateArgs>(args: SelectSubset<T, ContactUpdateArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Contacts.
     * @param {ContactDeleteManyArgs} args - Arguments to filter Contacts to delete.
     * @example
     * // Delete a few Contacts
     * const { count } = await prisma.contact.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ContactDeleteManyArgs>(args?: SelectSubset<T, ContactDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Contacts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Contacts
     * const contact = await prisma.contact.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ContactUpdateManyArgs>(args: SelectSubset<T, ContactUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Contacts and returns the data updated in the database.
     * @param {ContactUpdateManyAndReturnArgs} args - Arguments to update many Contacts.
     * @example
     * // Update many Contacts
     * const contact = await prisma.contact.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Contacts and only return the `id`
     * const contactWithIdOnly = await prisma.contact.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ContactUpdateManyAndReturnArgs>(args: SelectSubset<T, ContactUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Contact.
     * @param {ContactUpsertArgs} args - Arguments to update or create a Contact.
     * @example
     * // Update or create a Contact
     * const contact = await prisma.contact.upsert({
     *   create: {
     *     // ... data to create a Contact
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Contact we want to update
     *   }
     * })
     */
    upsert<T extends ContactUpsertArgs>(args: SelectSubset<T, ContactUpsertArgs<ExtArgs>>): Prisma__ContactClient<$Result.GetResult<Prisma.$ContactPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Contacts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactCountArgs} args - Arguments to filter Contacts to count.
     * @example
     * // Count the number of Contacts
     * const count = await prisma.contact.count({
     *   where: {
     *     // ... the filter for the Contacts we want to count
     *   }
     * })
    **/
    count<T extends ContactCountArgs>(
      args?: Subset<T, ContactCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ContactCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Contact.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ContactAggregateArgs>(args: Subset<T, ContactAggregateArgs>): Prisma.PrismaPromise<GetContactAggregateType<T>>

    /**
     * Group by Contact.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ContactGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ContactGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ContactGroupByArgs['orderBy'] }
        : { orderBy?: ContactGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ContactGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetContactGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Contact model
   */
  readonly fields: ContactFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Contact.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ContactClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Contact model
   */
  interface ContactFieldRefs {
    readonly id: FieldRef<"Contact", 'String'>
    readonly userId: FieldRef<"Contact", 'String'>
    readonly fullName: FieldRef<"Contact", 'String'>
    readonly email: FieldRef<"Contact", 'String'>
    readonly phone: FieldRef<"Contact", 'String'>
    readonly company: FieldRef<"Contact", 'String'>
    readonly notes: FieldRef<"Contact", 'String'>
    readonly archivedAt: FieldRef<"Contact", 'DateTime'>
    readonly createdAt: FieldRef<"Contact", 'DateTime'>
    readonly updatedAt: FieldRef<"Contact", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Contact findUnique
   */
  export type ContactFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter, which Contact to fetch.
     */
    where: ContactWhereUniqueInput
  }

  /**
   * Contact findUniqueOrThrow
   */
  export type ContactFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter, which Contact to fetch.
     */
    where: ContactWhereUniqueInput
  }

  /**
   * Contact findFirst
   */
  export type ContactFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter, which Contact to fetch.
     */
    where?: ContactWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contacts to fetch.
     */
    orderBy?: ContactOrderByWithRelationInput | ContactOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Contacts.
     */
    cursor?: ContactWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contacts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contacts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Contacts.
     */
    distinct?: ContactScalarFieldEnum | ContactScalarFieldEnum[]
  }

  /**
   * Contact findFirstOrThrow
   */
  export type ContactFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter, which Contact to fetch.
     */
    where?: ContactWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contacts to fetch.
     */
    orderBy?: ContactOrderByWithRelationInput | ContactOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Contacts.
     */
    cursor?: ContactWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contacts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contacts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Contacts.
     */
    distinct?: ContactScalarFieldEnum | ContactScalarFieldEnum[]
  }

  /**
   * Contact findMany
   */
  export type ContactFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter, which Contacts to fetch.
     */
    where?: ContactWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Contacts to fetch.
     */
    orderBy?: ContactOrderByWithRelationInput | ContactOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Contacts.
     */
    cursor?: ContactWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Contacts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Contacts.
     */
    skip?: number
    distinct?: ContactScalarFieldEnum | ContactScalarFieldEnum[]
  }

  /**
   * Contact create
   */
  export type ContactCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * The data needed to create a Contact.
     */
    data: XOR<ContactCreateInput, ContactUncheckedCreateInput>
  }

  /**
   * Contact createMany
   */
  export type ContactCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Contacts.
     */
    data: ContactCreateManyInput | ContactCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Contact createManyAndReturn
   */
  export type ContactCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * The data used to create many Contacts.
     */
    data: ContactCreateManyInput | ContactCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Contact update
   */
  export type ContactUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * The data needed to update a Contact.
     */
    data: XOR<ContactUpdateInput, ContactUncheckedUpdateInput>
    /**
     * Choose, which Contact to update.
     */
    where: ContactWhereUniqueInput
  }

  /**
   * Contact updateMany
   */
  export type ContactUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Contacts.
     */
    data: XOR<ContactUpdateManyMutationInput, ContactUncheckedUpdateManyInput>
    /**
     * Filter which Contacts to update
     */
    where?: ContactWhereInput
    /**
     * Limit how many Contacts to update.
     */
    limit?: number
  }

  /**
   * Contact updateManyAndReturn
   */
  export type ContactUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * The data used to update Contacts.
     */
    data: XOR<ContactUpdateManyMutationInput, ContactUncheckedUpdateManyInput>
    /**
     * Filter which Contacts to update
     */
    where?: ContactWhereInput
    /**
     * Limit how many Contacts to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Contact upsert
   */
  export type ContactUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * The filter to search for the Contact to update in case it exists.
     */
    where: ContactWhereUniqueInput
    /**
     * In case the Contact found by the `where` argument doesn't exist, create a new Contact with this data.
     */
    create: XOR<ContactCreateInput, ContactUncheckedCreateInput>
    /**
     * In case the Contact was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ContactUpdateInput, ContactUncheckedUpdateInput>
  }

  /**
   * Contact delete
   */
  export type ContactDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
    /**
     * Filter which Contact to delete.
     */
    where: ContactWhereUniqueInput
  }

  /**
   * Contact deleteMany
   */
  export type ContactDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Contacts to delete
     */
    where?: ContactWhereInput
    /**
     * Limit how many Contacts to delete.
     */
    limit?: number
  }

  /**
   * Contact without action
   */
  export type ContactDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Contact
     */
    select?: ContactSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Contact
     */
    omit?: ContactOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ContactInclude<ExtArgs> | null
  }


  /**
   * Model SubscriptionCustomer
   */

  export type AggregateSubscriptionCustomer = {
    _count: SubscriptionCustomerCountAggregateOutputType | null
    _min: SubscriptionCustomerMinAggregateOutputType | null
    _max: SubscriptionCustomerMaxAggregateOutputType | null
  }

  export type SubscriptionCustomerMinAggregateOutputType = {
    id: string | null
    userId: string | null
    provider: $Enums.BillingProvider | null
    providerCustomerId: string | null
    billingEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SubscriptionCustomerMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    provider: $Enums.BillingProvider | null
    providerCustomerId: string | null
    billingEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SubscriptionCustomerCountAggregateOutputType = {
    id: number
    userId: number
    provider: number
    providerCustomerId: number
    billingEmail: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SubscriptionCustomerMinAggregateInputType = {
    id?: true
    userId?: true
    provider?: true
    providerCustomerId?: true
    billingEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SubscriptionCustomerMaxAggregateInputType = {
    id?: true
    userId?: true
    provider?: true
    providerCustomerId?: true
    billingEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SubscriptionCustomerCountAggregateInputType = {
    id?: true
    userId?: true
    provider?: true
    providerCustomerId?: true
    billingEmail?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SubscriptionCustomerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionCustomer to aggregate.
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionCustomers to fetch.
     */
    orderBy?: SubscriptionCustomerOrderByWithRelationInput | SubscriptionCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SubscriptionCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SubscriptionCustomers
    **/
    _count?: true | SubscriptionCustomerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SubscriptionCustomerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SubscriptionCustomerMaxAggregateInputType
  }

  export type GetSubscriptionCustomerAggregateType<T extends SubscriptionCustomerAggregateArgs> = {
        [P in keyof T & keyof AggregateSubscriptionCustomer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSubscriptionCustomer[P]>
      : GetScalarType<T[P], AggregateSubscriptionCustomer[P]>
  }




  export type SubscriptionCustomerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionCustomerWhereInput
    orderBy?: SubscriptionCustomerOrderByWithAggregationInput | SubscriptionCustomerOrderByWithAggregationInput[]
    by: SubscriptionCustomerScalarFieldEnum[] | SubscriptionCustomerScalarFieldEnum
    having?: SubscriptionCustomerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SubscriptionCustomerCountAggregateInputType | true
    _min?: SubscriptionCustomerMinAggregateInputType
    _max?: SubscriptionCustomerMaxAggregateInputType
  }

  export type SubscriptionCustomerGroupByOutputType = {
    id: string
    userId: string
    provider: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail: string | null
    createdAt: Date
    updatedAt: Date
    _count: SubscriptionCustomerCountAggregateOutputType | null
    _min: SubscriptionCustomerMinAggregateOutputType | null
    _max: SubscriptionCustomerMaxAggregateOutputType | null
  }

  type GetSubscriptionCustomerGroupByPayload<T extends SubscriptionCustomerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SubscriptionCustomerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SubscriptionCustomerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SubscriptionCustomerGroupByOutputType[P]>
            : GetScalarType<T[P], SubscriptionCustomerGroupByOutputType[P]>
        }
      >
    >


  export type SubscriptionCustomerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    provider?: boolean
    providerCustomerId?: boolean
    billingEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptions?: boolean | SubscriptionCustomer$subscriptionsArgs<ExtArgs>
    _count?: boolean | SubscriptionCustomerCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscriptionCustomer"]>

  export type SubscriptionCustomerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    provider?: boolean
    providerCustomerId?: boolean
    billingEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscriptionCustomer"]>

  export type SubscriptionCustomerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    provider?: boolean
    providerCustomerId?: boolean
    billingEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscriptionCustomer"]>

  export type SubscriptionCustomerSelectScalar = {
    id?: boolean
    userId?: boolean
    provider?: boolean
    providerCustomerId?: boolean
    billingEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SubscriptionCustomerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "provider" | "providerCustomerId" | "billingEmail" | "createdAt" | "updatedAt", ExtArgs["result"]["subscriptionCustomer"]>
  export type SubscriptionCustomerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptions?: boolean | SubscriptionCustomer$subscriptionsArgs<ExtArgs>
    _count?: boolean | SubscriptionCustomerCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type SubscriptionCustomerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SubscriptionCustomerIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SubscriptionCustomerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SubscriptionCustomer"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      subscriptions: Prisma.$SubscriptionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      provider: $Enums.BillingProvider
      providerCustomerId: string
      billingEmail: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["subscriptionCustomer"]>
    composites: {}
  }

  type SubscriptionCustomerGetPayload<S extends boolean | null | undefined | SubscriptionCustomerDefaultArgs> = $Result.GetResult<Prisma.$SubscriptionCustomerPayload, S>

  type SubscriptionCustomerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SubscriptionCustomerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SubscriptionCustomerCountAggregateInputType | true
    }

  export interface SubscriptionCustomerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SubscriptionCustomer'], meta: { name: 'SubscriptionCustomer' } }
    /**
     * Find zero or one SubscriptionCustomer that matches the filter.
     * @param {SubscriptionCustomerFindUniqueArgs} args - Arguments to find a SubscriptionCustomer
     * @example
     * // Get one SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SubscriptionCustomerFindUniqueArgs>(args: SelectSubset<T, SubscriptionCustomerFindUniqueArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SubscriptionCustomer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SubscriptionCustomerFindUniqueOrThrowArgs} args - Arguments to find a SubscriptionCustomer
     * @example
     * // Get one SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SubscriptionCustomerFindUniqueOrThrowArgs>(args: SelectSubset<T, SubscriptionCustomerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionCustomer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerFindFirstArgs} args - Arguments to find a SubscriptionCustomer
     * @example
     * // Get one SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SubscriptionCustomerFindFirstArgs>(args?: SelectSubset<T, SubscriptionCustomerFindFirstArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SubscriptionCustomer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerFindFirstOrThrowArgs} args - Arguments to find a SubscriptionCustomer
     * @example
     * // Get one SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SubscriptionCustomerFindFirstOrThrowArgs>(args?: SelectSubset<T, SubscriptionCustomerFindFirstOrThrowArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SubscriptionCustomers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SubscriptionCustomers
     * const subscriptionCustomers = await prisma.subscriptionCustomer.findMany()
     * 
     * // Get first 10 SubscriptionCustomers
     * const subscriptionCustomers = await prisma.subscriptionCustomer.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const subscriptionCustomerWithIdOnly = await prisma.subscriptionCustomer.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SubscriptionCustomerFindManyArgs>(args?: SelectSubset<T, SubscriptionCustomerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SubscriptionCustomer.
     * @param {SubscriptionCustomerCreateArgs} args - Arguments to create a SubscriptionCustomer.
     * @example
     * // Create one SubscriptionCustomer
     * const SubscriptionCustomer = await prisma.subscriptionCustomer.create({
     *   data: {
     *     // ... data to create a SubscriptionCustomer
     *   }
     * })
     * 
     */
    create<T extends SubscriptionCustomerCreateArgs>(args: SelectSubset<T, SubscriptionCustomerCreateArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SubscriptionCustomers.
     * @param {SubscriptionCustomerCreateManyArgs} args - Arguments to create many SubscriptionCustomers.
     * @example
     * // Create many SubscriptionCustomers
     * const subscriptionCustomer = await prisma.subscriptionCustomer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SubscriptionCustomerCreateManyArgs>(args?: SelectSubset<T, SubscriptionCustomerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SubscriptionCustomers and returns the data saved in the database.
     * @param {SubscriptionCustomerCreateManyAndReturnArgs} args - Arguments to create many SubscriptionCustomers.
     * @example
     * // Create many SubscriptionCustomers
     * const subscriptionCustomer = await prisma.subscriptionCustomer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SubscriptionCustomers and only return the `id`
     * const subscriptionCustomerWithIdOnly = await prisma.subscriptionCustomer.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SubscriptionCustomerCreateManyAndReturnArgs>(args?: SelectSubset<T, SubscriptionCustomerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SubscriptionCustomer.
     * @param {SubscriptionCustomerDeleteArgs} args - Arguments to delete one SubscriptionCustomer.
     * @example
     * // Delete one SubscriptionCustomer
     * const SubscriptionCustomer = await prisma.subscriptionCustomer.delete({
     *   where: {
     *     // ... filter to delete one SubscriptionCustomer
     *   }
     * })
     * 
     */
    delete<T extends SubscriptionCustomerDeleteArgs>(args: SelectSubset<T, SubscriptionCustomerDeleteArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SubscriptionCustomer.
     * @param {SubscriptionCustomerUpdateArgs} args - Arguments to update one SubscriptionCustomer.
     * @example
     * // Update one SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SubscriptionCustomerUpdateArgs>(args: SelectSubset<T, SubscriptionCustomerUpdateArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SubscriptionCustomers.
     * @param {SubscriptionCustomerDeleteManyArgs} args - Arguments to filter SubscriptionCustomers to delete.
     * @example
     * // Delete a few SubscriptionCustomers
     * const { count } = await prisma.subscriptionCustomer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SubscriptionCustomerDeleteManyArgs>(args?: SelectSubset<T, SubscriptionCustomerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SubscriptionCustomers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SubscriptionCustomers
     * const subscriptionCustomer = await prisma.subscriptionCustomer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SubscriptionCustomerUpdateManyArgs>(args: SelectSubset<T, SubscriptionCustomerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SubscriptionCustomers and returns the data updated in the database.
     * @param {SubscriptionCustomerUpdateManyAndReturnArgs} args - Arguments to update many SubscriptionCustomers.
     * @example
     * // Update many SubscriptionCustomers
     * const subscriptionCustomer = await prisma.subscriptionCustomer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SubscriptionCustomers and only return the `id`
     * const subscriptionCustomerWithIdOnly = await prisma.subscriptionCustomer.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SubscriptionCustomerUpdateManyAndReturnArgs>(args: SelectSubset<T, SubscriptionCustomerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SubscriptionCustomer.
     * @param {SubscriptionCustomerUpsertArgs} args - Arguments to update or create a SubscriptionCustomer.
     * @example
     * // Update or create a SubscriptionCustomer
     * const subscriptionCustomer = await prisma.subscriptionCustomer.upsert({
     *   create: {
     *     // ... data to create a SubscriptionCustomer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SubscriptionCustomer we want to update
     *   }
     * })
     */
    upsert<T extends SubscriptionCustomerUpsertArgs>(args: SelectSubset<T, SubscriptionCustomerUpsertArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SubscriptionCustomers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerCountArgs} args - Arguments to filter SubscriptionCustomers to count.
     * @example
     * // Count the number of SubscriptionCustomers
     * const count = await prisma.subscriptionCustomer.count({
     *   where: {
     *     // ... the filter for the SubscriptionCustomers we want to count
     *   }
     * })
    **/
    count<T extends SubscriptionCustomerCountArgs>(
      args?: Subset<T, SubscriptionCustomerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SubscriptionCustomerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SubscriptionCustomer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SubscriptionCustomerAggregateArgs>(args: Subset<T, SubscriptionCustomerAggregateArgs>): Prisma.PrismaPromise<GetSubscriptionCustomerAggregateType<T>>

    /**
     * Group by SubscriptionCustomer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCustomerGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SubscriptionCustomerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SubscriptionCustomerGroupByArgs['orderBy'] }
        : { orderBy?: SubscriptionCustomerGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SubscriptionCustomerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSubscriptionCustomerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SubscriptionCustomer model
   */
  readonly fields: SubscriptionCustomerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SubscriptionCustomer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SubscriptionCustomerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptions<T extends SubscriptionCustomer$subscriptionsArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionCustomer$subscriptionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SubscriptionCustomer model
   */
  interface SubscriptionCustomerFieldRefs {
    readonly id: FieldRef<"SubscriptionCustomer", 'String'>
    readonly userId: FieldRef<"SubscriptionCustomer", 'String'>
    readonly provider: FieldRef<"SubscriptionCustomer", 'BillingProvider'>
    readonly providerCustomerId: FieldRef<"SubscriptionCustomer", 'String'>
    readonly billingEmail: FieldRef<"SubscriptionCustomer", 'String'>
    readonly createdAt: FieldRef<"SubscriptionCustomer", 'DateTime'>
    readonly updatedAt: FieldRef<"SubscriptionCustomer", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SubscriptionCustomer findUnique
   */
  export type SubscriptionCustomerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionCustomer to fetch.
     */
    where: SubscriptionCustomerWhereUniqueInput
  }

  /**
   * SubscriptionCustomer findUniqueOrThrow
   */
  export type SubscriptionCustomerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionCustomer to fetch.
     */
    where: SubscriptionCustomerWhereUniqueInput
  }

  /**
   * SubscriptionCustomer findFirst
   */
  export type SubscriptionCustomerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionCustomer to fetch.
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionCustomers to fetch.
     */
    orderBy?: SubscriptionCustomerOrderByWithRelationInput | SubscriptionCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionCustomers.
     */
    cursor?: SubscriptionCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionCustomers.
     */
    distinct?: SubscriptionCustomerScalarFieldEnum | SubscriptionCustomerScalarFieldEnum[]
  }

  /**
   * SubscriptionCustomer findFirstOrThrow
   */
  export type SubscriptionCustomerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionCustomer to fetch.
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionCustomers to fetch.
     */
    orderBy?: SubscriptionCustomerOrderByWithRelationInput | SubscriptionCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SubscriptionCustomers.
     */
    cursor?: SubscriptionCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionCustomers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SubscriptionCustomers.
     */
    distinct?: SubscriptionCustomerScalarFieldEnum | SubscriptionCustomerScalarFieldEnum[]
  }

  /**
   * SubscriptionCustomer findMany
   */
  export type SubscriptionCustomerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter, which SubscriptionCustomers to fetch.
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SubscriptionCustomers to fetch.
     */
    orderBy?: SubscriptionCustomerOrderByWithRelationInput | SubscriptionCustomerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SubscriptionCustomers.
     */
    cursor?: SubscriptionCustomerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SubscriptionCustomers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SubscriptionCustomers.
     */
    skip?: number
    distinct?: SubscriptionCustomerScalarFieldEnum | SubscriptionCustomerScalarFieldEnum[]
  }

  /**
   * SubscriptionCustomer create
   */
  export type SubscriptionCustomerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * The data needed to create a SubscriptionCustomer.
     */
    data: XOR<SubscriptionCustomerCreateInput, SubscriptionCustomerUncheckedCreateInput>
  }

  /**
   * SubscriptionCustomer createMany
   */
  export type SubscriptionCustomerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SubscriptionCustomers.
     */
    data: SubscriptionCustomerCreateManyInput | SubscriptionCustomerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SubscriptionCustomer createManyAndReturn
   */
  export type SubscriptionCustomerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * The data used to create many SubscriptionCustomers.
     */
    data: SubscriptionCustomerCreateManyInput | SubscriptionCustomerCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SubscriptionCustomer update
   */
  export type SubscriptionCustomerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * The data needed to update a SubscriptionCustomer.
     */
    data: XOR<SubscriptionCustomerUpdateInput, SubscriptionCustomerUncheckedUpdateInput>
    /**
     * Choose, which SubscriptionCustomer to update.
     */
    where: SubscriptionCustomerWhereUniqueInput
  }

  /**
   * SubscriptionCustomer updateMany
   */
  export type SubscriptionCustomerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SubscriptionCustomers.
     */
    data: XOR<SubscriptionCustomerUpdateManyMutationInput, SubscriptionCustomerUncheckedUpdateManyInput>
    /**
     * Filter which SubscriptionCustomers to update
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * Limit how many SubscriptionCustomers to update.
     */
    limit?: number
  }

  /**
   * SubscriptionCustomer updateManyAndReturn
   */
  export type SubscriptionCustomerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * The data used to update SubscriptionCustomers.
     */
    data: XOR<SubscriptionCustomerUpdateManyMutationInput, SubscriptionCustomerUncheckedUpdateManyInput>
    /**
     * Filter which SubscriptionCustomers to update
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * Limit how many SubscriptionCustomers to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SubscriptionCustomer upsert
   */
  export type SubscriptionCustomerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * The filter to search for the SubscriptionCustomer to update in case it exists.
     */
    where: SubscriptionCustomerWhereUniqueInput
    /**
     * In case the SubscriptionCustomer found by the `where` argument doesn't exist, create a new SubscriptionCustomer with this data.
     */
    create: XOR<SubscriptionCustomerCreateInput, SubscriptionCustomerUncheckedCreateInput>
    /**
     * In case the SubscriptionCustomer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SubscriptionCustomerUpdateInput, SubscriptionCustomerUncheckedUpdateInput>
  }

  /**
   * SubscriptionCustomer delete
   */
  export type SubscriptionCustomerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
    /**
     * Filter which SubscriptionCustomer to delete.
     */
    where: SubscriptionCustomerWhereUniqueInput
  }

  /**
   * SubscriptionCustomer deleteMany
   */
  export type SubscriptionCustomerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SubscriptionCustomers to delete
     */
    where?: SubscriptionCustomerWhereInput
    /**
     * Limit how many SubscriptionCustomers to delete.
     */
    limit?: number
  }

  /**
   * SubscriptionCustomer.subscriptions
   */
  export type SubscriptionCustomer$subscriptionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    where?: SubscriptionWhereInput
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    cursor?: SubscriptionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SubscriptionScalarFieldEnum | SubscriptionScalarFieldEnum[]
  }

  /**
   * SubscriptionCustomer without action
   */
  export type SubscriptionCustomerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SubscriptionCustomer
     */
    select?: SubscriptionCustomerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SubscriptionCustomer
     */
    omit?: SubscriptionCustomerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionCustomerInclude<ExtArgs> | null
  }


  /**
   * Model Subscription
   */

  export type AggregateSubscription = {
    _count: SubscriptionCountAggregateOutputType | null
    _avg: SubscriptionAvgAggregateOutputType | null
    _sum: SubscriptionSumAggregateOutputType | null
    _min: SubscriptionMinAggregateOutputType | null
    _max: SubscriptionMaxAggregateOutputType | null
  }

  export type SubscriptionAvgAggregateOutputType = {
    contactsLimit: number | null
    monthlyImportLimit: number | null
    syncAccountsLimit: number | null
  }

  export type SubscriptionSumAggregateOutputType = {
    contactsLimit: number | null
    monthlyImportLimit: number | null
    syncAccountsLimit: number | null
  }

  export type SubscriptionMinAggregateOutputType = {
    id: string | null
    userId: string | null
    subscriptionCustomerId: string | null
    provider: $Enums.BillingProvider | null
    providerSubscriptionId: string | null
    plan: $Enums.SubscriptionPlan | null
    status: $Enums.SubscriptionStatus | null
    interval: $Enums.SubscriptionInterval | null
    contactsLimit: number | null
    monthlyImportLimit: number | null
    syncAccountsLimit: number | null
    advancedMergeEnabled: boolean | null
    premiumExportEnabled: boolean | null
    cardDavSyncEnabled: boolean | null
    startedAt: Date | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    trialEndsAt: Date | null
    graceEndsAt: Date | null
    cancelAtPeriodEnd: boolean | null
    canceledAt: Date | null
    endedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SubscriptionMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    subscriptionCustomerId: string | null
    provider: $Enums.BillingProvider | null
    providerSubscriptionId: string | null
    plan: $Enums.SubscriptionPlan | null
    status: $Enums.SubscriptionStatus | null
    interval: $Enums.SubscriptionInterval | null
    contactsLimit: number | null
    monthlyImportLimit: number | null
    syncAccountsLimit: number | null
    advancedMergeEnabled: boolean | null
    premiumExportEnabled: boolean | null
    cardDavSyncEnabled: boolean | null
    startedAt: Date | null
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    trialEndsAt: Date | null
    graceEndsAt: Date | null
    cancelAtPeriodEnd: boolean | null
    canceledAt: Date | null
    endedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SubscriptionCountAggregateOutputType = {
    id: number
    userId: number
    subscriptionCustomerId: number
    provider: number
    providerSubscriptionId: number
    plan: number
    status: number
    interval: number
    contactsLimit: number
    monthlyImportLimit: number
    syncAccountsLimit: number
    advancedMergeEnabled: number
    premiumExportEnabled: number
    cardDavSyncEnabled: number
    startedAt: number
    currentPeriodStart: number
    currentPeriodEnd: number
    trialEndsAt: number
    graceEndsAt: number
    cancelAtPeriodEnd: number
    canceledAt: number
    endedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SubscriptionAvgAggregateInputType = {
    contactsLimit?: true
    monthlyImportLimit?: true
    syncAccountsLimit?: true
  }

  export type SubscriptionSumAggregateInputType = {
    contactsLimit?: true
    monthlyImportLimit?: true
    syncAccountsLimit?: true
  }

  export type SubscriptionMinAggregateInputType = {
    id?: true
    userId?: true
    subscriptionCustomerId?: true
    provider?: true
    providerSubscriptionId?: true
    plan?: true
    status?: true
    interval?: true
    contactsLimit?: true
    monthlyImportLimit?: true
    syncAccountsLimit?: true
    advancedMergeEnabled?: true
    premiumExportEnabled?: true
    cardDavSyncEnabled?: true
    startedAt?: true
    currentPeriodStart?: true
    currentPeriodEnd?: true
    trialEndsAt?: true
    graceEndsAt?: true
    cancelAtPeriodEnd?: true
    canceledAt?: true
    endedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SubscriptionMaxAggregateInputType = {
    id?: true
    userId?: true
    subscriptionCustomerId?: true
    provider?: true
    providerSubscriptionId?: true
    plan?: true
    status?: true
    interval?: true
    contactsLimit?: true
    monthlyImportLimit?: true
    syncAccountsLimit?: true
    advancedMergeEnabled?: true
    premiumExportEnabled?: true
    cardDavSyncEnabled?: true
    startedAt?: true
    currentPeriodStart?: true
    currentPeriodEnd?: true
    trialEndsAt?: true
    graceEndsAt?: true
    cancelAtPeriodEnd?: true
    canceledAt?: true
    endedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SubscriptionCountAggregateInputType = {
    id?: true
    userId?: true
    subscriptionCustomerId?: true
    provider?: true
    providerSubscriptionId?: true
    plan?: true
    status?: true
    interval?: true
    contactsLimit?: true
    monthlyImportLimit?: true
    syncAccountsLimit?: true
    advancedMergeEnabled?: true
    premiumExportEnabled?: true
    cardDavSyncEnabled?: true
    startedAt?: true
    currentPeriodStart?: true
    currentPeriodEnd?: true
    trialEndsAt?: true
    graceEndsAt?: true
    cancelAtPeriodEnd?: true
    canceledAt?: true
    endedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SubscriptionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Subscription to aggregate.
     */
    where?: SubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Subscriptions to fetch.
     */
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Subscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Subscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Subscriptions
    **/
    _count?: true | SubscriptionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SubscriptionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SubscriptionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SubscriptionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SubscriptionMaxAggregateInputType
  }

  export type GetSubscriptionAggregateType<T extends SubscriptionAggregateArgs> = {
        [P in keyof T & keyof AggregateSubscription]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSubscription[P]>
      : GetScalarType<T[P], AggregateSubscription[P]>
  }




  export type SubscriptionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SubscriptionWhereInput
    orderBy?: SubscriptionOrderByWithAggregationInput | SubscriptionOrderByWithAggregationInput[]
    by: SubscriptionScalarFieldEnum[] | SubscriptionScalarFieldEnum
    having?: SubscriptionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SubscriptionCountAggregateInputType | true
    _avg?: SubscriptionAvgAggregateInputType
    _sum?: SubscriptionSumAggregateInputType
    _min?: SubscriptionMinAggregateInputType
    _max?: SubscriptionMaxAggregateInputType
  }

  export type SubscriptionGroupByOutputType = {
    id: string
    userId: string
    subscriptionCustomerId: string
    provider: $Enums.BillingProvider
    providerSubscriptionId: string
    plan: $Enums.SubscriptionPlan
    status: $Enums.SubscriptionStatus
    interval: $Enums.SubscriptionInterval
    contactsLimit: number | null
    monthlyImportLimit: number | null
    syncAccountsLimit: number | null
    advancedMergeEnabled: boolean
    premiumExportEnabled: boolean
    cardDavSyncEnabled: boolean
    startedAt: Date
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    trialEndsAt: Date | null
    graceEndsAt: Date | null
    cancelAtPeriodEnd: boolean
    canceledAt: Date | null
    endedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: SubscriptionCountAggregateOutputType | null
    _avg: SubscriptionAvgAggregateOutputType | null
    _sum: SubscriptionSumAggregateOutputType | null
    _min: SubscriptionMinAggregateOutputType | null
    _max: SubscriptionMaxAggregateOutputType | null
  }

  type GetSubscriptionGroupByPayload<T extends SubscriptionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SubscriptionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SubscriptionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SubscriptionGroupByOutputType[P]>
            : GetScalarType<T[P], SubscriptionGroupByOutputType[P]>
        }
      >
    >


  export type SubscriptionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    subscriptionCustomerId?: boolean
    provider?: boolean
    providerSubscriptionId?: boolean
    plan?: boolean
    status?: boolean
    interval?: boolean
    contactsLimit?: boolean
    monthlyImportLimit?: boolean
    syncAccountsLimit?: boolean
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: boolean
    currentPeriodStart?: boolean
    currentPeriodEnd?: boolean
    trialEndsAt?: boolean
    graceEndsAt?: boolean
    cancelAtPeriodEnd?: boolean
    canceledAt?: boolean
    endedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscription"]>

  export type SubscriptionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    subscriptionCustomerId?: boolean
    provider?: boolean
    providerSubscriptionId?: boolean
    plan?: boolean
    status?: boolean
    interval?: boolean
    contactsLimit?: boolean
    monthlyImportLimit?: boolean
    syncAccountsLimit?: boolean
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: boolean
    currentPeriodStart?: boolean
    currentPeriodEnd?: boolean
    trialEndsAt?: boolean
    graceEndsAt?: boolean
    cancelAtPeriodEnd?: boolean
    canceledAt?: boolean
    endedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscription"]>

  export type SubscriptionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    subscriptionCustomerId?: boolean
    provider?: boolean
    providerSubscriptionId?: boolean
    plan?: boolean
    status?: boolean
    interval?: boolean
    contactsLimit?: boolean
    monthlyImportLimit?: boolean
    syncAccountsLimit?: boolean
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: boolean
    currentPeriodStart?: boolean
    currentPeriodEnd?: boolean
    trialEndsAt?: boolean
    graceEndsAt?: boolean
    cancelAtPeriodEnd?: boolean
    canceledAt?: boolean
    endedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["subscription"]>

  export type SubscriptionSelectScalar = {
    id?: boolean
    userId?: boolean
    subscriptionCustomerId?: boolean
    provider?: boolean
    providerSubscriptionId?: boolean
    plan?: boolean
    status?: boolean
    interval?: boolean
    contactsLimit?: boolean
    monthlyImportLimit?: boolean
    syncAccountsLimit?: boolean
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: boolean
    currentPeriodStart?: boolean
    currentPeriodEnd?: boolean
    trialEndsAt?: boolean
    graceEndsAt?: boolean
    cancelAtPeriodEnd?: boolean
    canceledAt?: boolean
    endedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SubscriptionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "subscriptionCustomerId" | "provider" | "providerSubscriptionId" | "plan" | "status" | "interval" | "contactsLimit" | "monthlyImportLimit" | "syncAccountsLimit" | "advancedMergeEnabled" | "premiumExportEnabled" | "cardDavSyncEnabled" | "startedAt" | "currentPeriodStart" | "currentPeriodEnd" | "trialEndsAt" | "graceEndsAt" | "cancelAtPeriodEnd" | "canceledAt" | "endedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["subscription"]>
  export type SubscriptionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }
  export type SubscriptionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }
  export type SubscriptionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    subscriptionCustomer?: boolean | SubscriptionCustomerDefaultArgs<ExtArgs>
  }

  export type $SubscriptionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Subscription"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      subscriptionCustomer: Prisma.$SubscriptionCustomerPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      subscriptionCustomerId: string
      provider: $Enums.BillingProvider
      providerSubscriptionId: string
      plan: $Enums.SubscriptionPlan
      status: $Enums.SubscriptionStatus
      interval: $Enums.SubscriptionInterval
      contactsLimit: number | null
      monthlyImportLimit: number | null
      syncAccountsLimit: number | null
      advancedMergeEnabled: boolean
      premiumExportEnabled: boolean
      cardDavSyncEnabled: boolean
      startedAt: Date
      currentPeriodStart: Date | null
      currentPeriodEnd: Date | null
      trialEndsAt: Date | null
      graceEndsAt: Date | null
      cancelAtPeriodEnd: boolean
      canceledAt: Date | null
      endedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["subscription"]>
    composites: {}
  }

  type SubscriptionGetPayload<S extends boolean | null | undefined | SubscriptionDefaultArgs> = $Result.GetResult<Prisma.$SubscriptionPayload, S>

  type SubscriptionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SubscriptionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SubscriptionCountAggregateInputType | true
    }

  export interface SubscriptionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Subscription'], meta: { name: 'Subscription' } }
    /**
     * Find zero or one Subscription that matches the filter.
     * @param {SubscriptionFindUniqueArgs} args - Arguments to find a Subscription
     * @example
     * // Get one Subscription
     * const subscription = await prisma.subscription.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SubscriptionFindUniqueArgs>(args: SelectSubset<T, SubscriptionFindUniqueArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Subscription that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SubscriptionFindUniqueOrThrowArgs} args - Arguments to find a Subscription
     * @example
     * // Get one Subscription
     * const subscription = await prisma.subscription.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SubscriptionFindUniqueOrThrowArgs>(args: SelectSubset<T, SubscriptionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Subscription that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionFindFirstArgs} args - Arguments to find a Subscription
     * @example
     * // Get one Subscription
     * const subscription = await prisma.subscription.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SubscriptionFindFirstArgs>(args?: SelectSubset<T, SubscriptionFindFirstArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Subscription that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionFindFirstOrThrowArgs} args - Arguments to find a Subscription
     * @example
     * // Get one Subscription
     * const subscription = await prisma.subscription.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SubscriptionFindFirstOrThrowArgs>(args?: SelectSubset<T, SubscriptionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Subscriptions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Subscriptions
     * const subscriptions = await prisma.subscription.findMany()
     * 
     * // Get first 10 Subscriptions
     * const subscriptions = await prisma.subscription.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const subscriptionWithIdOnly = await prisma.subscription.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SubscriptionFindManyArgs>(args?: SelectSubset<T, SubscriptionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Subscription.
     * @param {SubscriptionCreateArgs} args - Arguments to create a Subscription.
     * @example
     * // Create one Subscription
     * const Subscription = await prisma.subscription.create({
     *   data: {
     *     // ... data to create a Subscription
     *   }
     * })
     * 
     */
    create<T extends SubscriptionCreateArgs>(args: SelectSubset<T, SubscriptionCreateArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Subscriptions.
     * @param {SubscriptionCreateManyArgs} args - Arguments to create many Subscriptions.
     * @example
     * // Create many Subscriptions
     * const subscription = await prisma.subscription.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SubscriptionCreateManyArgs>(args?: SelectSubset<T, SubscriptionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Subscriptions and returns the data saved in the database.
     * @param {SubscriptionCreateManyAndReturnArgs} args - Arguments to create many Subscriptions.
     * @example
     * // Create many Subscriptions
     * const subscription = await prisma.subscription.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Subscriptions and only return the `id`
     * const subscriptionWithIdOnly = await prisma.subscription.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SubscriptionCreateManyAndReturnArgs>(args?: SelectSubset<T, SubscriptionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Subscription.
     * @param {SubscriptionDeleteArgs} args - Arguments to delete one Subscription.
     * @example
     * // Delete one Subscription
     * const Subscription = await prisma.subscription.delete({
     *   where: {
     *     // ... filter to delete one Subscription
     *   }
     * })
     * 
     */
    delete<T extends SubscriptionDeleteArgs>(args: SelectSubset<T, SubscriptionDeleteArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Subscription.
     * @param {SubscriptionUpdateArgs} args - Arguments to update one Subscription.
     * @example
     * // Update one Subscription
     * const subscription = await prisma.subscription.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SubscriptionUpdateArgs>(args: SelectSubset<T, SubscriptionUpdateArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Subscriptions.
     * @param {SubscriptionDeleteManyArgs} args - Arguments to filter Subscriptions to delete.
     * @example
     * // Delete a few Subscriptions
     * const { count } = await prisma.subscription.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SubscriptionDeleteManyArgs>(args?: SelectSubset<T, SubscriptionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Subscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Subscriptions
     * const subscription = await prisma.subscription.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SubscriptionUpdateManyArgs>(args: SelectSubset<T, SubscriptionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Subscriptions and returns the data updated in the database.
     * @param {SubscriptionUpdateManyAndReturnArgs} args - Arguments to update many Subscriptions.
     * @example
     * // Update many Subscriptions
     * const subscription = await prisma.subscription.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Subscriptions and only return the `id`
     * const subscriptionWithIdOnly = await prisma.subscription.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SubscriptionUpdateManyAndReturnArgs>(args: SelectSubset<T, SubscriptionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Subscription.
     * @param {SubscriptionUpsertArgs} args - Arguments to update or create a Subscription.
     * @example
     * // Update or create a Subscription
     * const subscription = await prisma.subscription.upsert({
     *   create: {
     *     // ... data to create a Subscription
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Subscription we want to update
     *   }
     * })
     */
    upsert<T extends SubscriptionUpsertArgs>(args: SelectSubset<T, SubscriptionUpsertArgs<ExtArgs>>): Prisma__SubscriptionClient<$Result.GetResult<Prisma.$SubscriptionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Subscriptions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionCountArgs} args - Arguments to filter Subscriptions to count.
     * @example
     * // Count the number of Subscriptions
     * const count = await prisma.subscription.count({
     *   where: {
     *     // ... the filter for the Subscriptions we want to count
     *   }
     * })
    **/
    count<T extends SubscriptionCountArgs>(
      args?: Subset<T, SubscriptionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SubscriptionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Subscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SubscriptionAggregateArgs>(args: Subset<T, SubscriptionAggregateArgs>): Prisma.PrismaPromise<GetSubscriptionAggregateType<T>>

    /**
     * Group by Subscription.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SubscriptionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SubscriptionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SubscriptionGroupByArgs['orderBy'] }
        : { orderBy?: SubscriptionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SubscriptionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSubscriptionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Subscription model
   */
  readonly fields: SubscriptionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Subscription.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SubscriptionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    subscriptionCustomer<T extends SubscriptionCustomerDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SubscriptionCustomerDefaultArgs<ExtArgs>>): Prisma__SubscriptionCustomerClient<$Result.GetResult<Prisma.$SubscriptionCustomerPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Subscription model
   */
  interface SubscriptionFieldRefs {
    readonly id: FieldRef<"Subscription", 'String'>
    readonly userId: FieldRef<"Subscription", 'String'>
    readonly subscriptionCustomerId: FieldRef<"Subscription", 'String'>
    readonly provider: FieldRef<"Subscription", 'BillingProvider'>
    readonly providerSubscriptionId: FieldRef<"Subscription", 'String'>
    readonly plan: FieldRef<"Subscription", 'SubscriptionPlan'>
    readonly status: FieldRef<"Subscription", 'SubscriptionStatus'>
    readonly interval: FieldRef<"Subscription", 'SubscriptionInterval'>
    readonly contactsLimit: FieldRef<"Subscription", 'Int'>
    readonly monthlyImportLimit: FieldRef<"Subscription", 'Int'>
    readonly syncAccountsLimit: FieldRef<"Subscription", 'Int'>
    readonly advancedMergeEnabled: FieldRef<"Subscription", 'Boolean'>
    readonly premiumExportEnabled: FieldRef<"Subscription", 'Boolean'>
    readonly cardDavSyncEnabled: FieldRef<"Subscription", 'Boolean'>
    readonly startedAt: FieldRef<"Subscription", 'DateTime'>
    readonly currentPeriodStart: FieldRef<"Subscription", 'DateTime'>
    readonly currentPeriodEnd: FieldRef<"Subscription", 'DateTime'>
    readonly trialEndsAt: FieldRef<"Subscription", 'DateTime'>
    readonly graceEndsAt: FieldRef<"Subscription", 'DateTime'>
    readonly cancelAtPeriodEnd: FieldRef<"Subscription", 'Boolean'>
    readonly canceledAt: FieldRef<"Subscription", 'DateTime'>
    readonly endedAt: FieldRef<"Subscription", 'DateTime'>
    readonly createdAt: FieldRef<"Subscription", 'DateTime'>
    readonly updatedAt: FieldRef<"Subscription", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Subscription findUnique
   */
  export type SubscriptionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which Subscription to fetch.
     */
    where: SubscriptionWhereUniqueInput
  }

  /**
   * Subscription findUniqueOrThrow
   */
  export type SubscriptionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which Subscription to fetch.
     */
    where: SubscriptionWhereUniqueInput
  }

  /**
   * Subscription findFirst
   */
  export type SubscriptionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which Subscription to fetch.
     */
    where?: SubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Subscriptions to fetch.
     */
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Subscriptions.
     */
    cursor?: SubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Subscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Subscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Subscriptions.
     */
    distinct?: SubscriptionScalarFieldEnum | SubscriptionScalarFieldEnum[]
  }

  /**
   * Subscription findFirstOrThrow
   */
  export type SubscriptionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which Subscription to fetch.
     */
    where?: SubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Subscriptions to fetch.
     */
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Subscriptions.
     */
    cursor?: SubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Subscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Subscriptions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Subscriptions.
     */
    distinct?: SubscriptionScalarFieldEnum | SubscriptionScalarFieldEnum[]
  }

  /**
   * Subscription findMany
   */
  export type SubscriptionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter, which Subscriptions to fetch.
     */
    where?: SubscriptionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Subscriptions to fetch.
     */
    orderBy?: SubscriptionOrderByWithRelationInput | SubscriptionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Subscriptions.
     */
    cursor?: SubscriptionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Subscriptions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Subscriptions.
     */
    skip?: number
    distinct?: SubscriptionScalarFieldEnum | SubscriptionScalarFieldEnum[]
  }

  /**
   * Subscription create
   */
  export type SubscriptionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to create a Subscription.
     */
    data: XOR<SubscriptionCreateInput, SubscriptionUncheckedCreateInput>
  }

  /**
   * Subscription createMany
   */
  export type SubscriptionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Subscriptions.
     */
    data: SubscriptionCreateManyInput | SubscriptionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Subscription createManyAndReturn
   */
  export type SubscriptionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * The data used to create many Subscriptions.
     */
    data: SubscriptionCreateManyInput | SubscriptionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Subscription update
   */
  export type SubscriptionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * The data needed to update a Subscription.
     */
    data: XOR<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput>
    /**
     * Choose, which Subscription to update.
     */
    where: SubscriptionWhereUniqueInput
  }

  /**
   * Subscription updateMany
   */
  export type SubscriptionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Subscriptions.
     */
    data: XOR<SubscriptionUpdateManyMutationInput, SubscriptionUncheckedUpdateManyInput>
    /**
     * Filter which Subscriptions to update
     */
    where?: SubscriptionWhereInput
    /**
     * Limit how many Subscriptions to update.
     */
    limit?: number
  }

  /**
   * Subscription updateManyAndReturn
   */
  export type SubscriptionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * The data used to update Subscriptions.
     */
    data: XOR<SubscriptionUpdateManyMutationInput, SubscriptionUncheckedUpdateManyInput>
    /**
     * Filter which Subscriptions to update
     */
    where?: SubscriptionWhereInput
    /**
     * Limit how many Subscriptions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Subscription upsert
   */
  export type SubscriptionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * The filter to search for the Subscription to update in case it exists.
     */
    where: SubscriptionWhereUniqueInput
    /**
     * In case the Subscription found by the `where` argument doesn't exist, create a new Subscription with this data.
     */
    create: XOR<SubscriptionCreateInput, SubscriptionUncheckedCreateInput>
    /**
     * In case the Subscription was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput>
  }

  /**
   * Subscription delete
   */
  export type SubscriptionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
    /**
     * Filter which Subscription to delete.
     */
    where: SubscriptionWhereUniqueInput
  }

  /**
   * Subscription deleteMany
   */
  export type SubscriptionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Subscriptions to delete
     */
    where?: SubscriptionWhereInput
    /**
     * Limit how many Subscriptions to delete.
     */
    limit?: number
  }

  /**
   * Subscription without action
   */
  export type SubscriptionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Subscription
     */
    select?: SubscriptionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Subscription
     */
    omit?: SubscriptionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SubscriptionInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    name: 'name',
    email: 'email',
    password: 'password',
    lifecycleState: 'lifecycleState',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const ContactScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    fullName: 'fullName',
    email: 'email',
    phone: 'phone',
    company: 'company',
    notes: 'notes',
    archivedAt: 'archivedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ContactScalarFieldEnum = (typeof ContactScalarFieldEnum)[keyof typeof ContactScalarFieldEnum]


  export const SubscriptionCustomerScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    provider: 'provider',
    providerCustomerId: 'providerCustomerId',
    billingEmail: 'billingEmail',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SubscriptionCustomerScalarFieldEnum = (typeof SubscriptionCustomerScalarFieldEnum)[keyof typeof SubscriptionCustomerScalarFieldEnum]


  export const SubscriptionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    subscriptionCustomerId: 'subscriptionCustomerId',
    provider: 'provider',
    providerSubscriptionId: 'providerSubscriptionId',
    plan: 'plan',
    status: 'status',
    interval: 'interval',
    contactsLimit: 'contactsLimit',
    monthlyImportLimit: 'monthlyImportLimit',
    syncAccountsLimit: 'syncAccountsLimit',
    advancedMergeEnabled: 'advancedMergeEnabled',
    premiumExportEnabled: 'premiumExportEnabled',
    cardDavSyncEnabled: 'cardDavSyncEnabled',
    startedAt: 'startedAt',
    currentPeriodStart: 'currentPeriodStart',
    currentPeriodEnd: 'currentPeriodEnd',
    trialEndsAt: 'trialEndsAt',
    graceEndsAt: 'graceEndsAt',
    cancelAtPeriodEnd: 'cancelAtPeriodEnd',
    canceledAt: 'canceledAt',
    endedAt: 'endedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SubscriptionScalarFieldEnum = (typeof SubscriptionScalarFieldEnum)[keyof typeof SubscriptionScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'AccountLifecycleState'
   */
  export type EnumAccountLifecycleStateFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountLifecycleState'>
    


  /**
   * Reference to a field of type 'AccountLifecycleState[]'
   */
  export type ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountLifecycleState[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'BillingProvider'
   */
  export type EnumBillingProviderFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BillingProvider'>
    


  /**
   * Reference to a field of type 'BillingProvider[]'
   */
  export type ListEnumBillingProviderFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BillingProvider[]'>
    


  /**
   * Reference to a field of type 'SubscriptionPlan'
   */
  export type EnumSubscriptionPlanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionPlan'>
    


  /**
   * Reference to a field of type 'SubscriptionPlan[]'
   */
  export type ListEnumSubscriptionPlanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionPlan[]'>
    


  /**
   * Reference to a field of type 'SubscriptionStatus'
   */
  export type EnumSubscriptionStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionStatus'>
    


  /**
   * Reference to a field of type 'SubscriptionStatus[]'
   */
  export type ListEnumSubscriptionStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionStatus[]'>
    


  /**
   * Reference to a field of type 'SubscriptionInterval'
   */
  export type EnumSubscriptionIntervalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionInterval'>
    


  /**
   * Reference to a field of type 'SubscriptionInterval[]'
   */
  export type ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SubscriptionInterval[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    email?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    lifecycleState?: EnumAccountLifecycleStateFilter<"User"> | $Enums.AccountLifecycleState
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    contacts?: ContactListRelationFilter
    subscriptionCustomer?: XOR<SubscriptionCustomerNullableScalarRelationFilter, SubscriptionCustomerWhereInput> | null
    subscriptions?: SubscriptionListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    email?: SortOrder
    password?: SortOrder
    lifecycleState?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    contacts?: ContactOrderByRelationAggregateInput
    subscriptionCustomer?: SubscriptionCustomerOrderByWithRelationInput
    subscriptions?: SubscriptionOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    password?: StringFilter<"User"> | string
    lifecycleState?: EnumAccountLifecycleStateFilter<"User"> | $Enums.AccountLifecycleState
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    contacts?: ContactListRelationFilter
    subscriptionCustomer?: XOR<SubscriptionCustomerNullableScalarRelationFilter, SubscriptionCustomerWhereInput> | null
    subscriptions?: SubscriptionListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrderInput | SortOrder
    email?: SortOrder
    password?: SortOrder
    lifecycleState?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    email?: StringWithAggregatesFilter<"User"> | string
    password?: StringWithAggregatesFilter<"User"> | string
    lifecycleState?: EnumAccountLifecycleStateWithAggregatesFilter<"User"> | $Enums.AccountLifecycleState
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type ContactWhereInput = {
    AND?: ContactWhereInput | ContactWhereInput[]
    OR?: ContactWhereInput[]
    NOT?: ContactWhereInput | ContactWhereInput[]
    id?: StringFilter<"Contact"> | string
    userId?: StringFilter<"Contact"> | string
    fullName?: StringFilter<"Contact"> | string
    email?: StringNullableFilter<"Contact"> | string | null
    phone?: StringNullableFilter<"Contact"> | string | null
    company?: StringNullableFilter<"Contact"> | string | null
    notes?: StringNullableFilter<"Contact"> | string | null
    archivedAt?: DateTimeNullableFilter<"Contact"> | Date | string | null
    createdAt?: DateTimeFilter<"Contact"> | Date | string
    updatedAt?: DateTimeFilter<"Contact"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type ContactOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    fullName?: SortOrder
    email?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    company?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    archivedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type ContactWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ContactWhereInput | ContactWhereInput[]
    OR?: ContactWhereInput[]
    NOT?: ContactWhereInput | ContactWhereInput[]
    userId?: StringFilter<"Contact"> | string
    fullName?: StringFilter<"Contact"> | string
    email?: StringNullableFilter<"Contact"> | string | null
    phone?: StringNullableFilter<"Contact"> | string | null
    company?: StringNullableFilter<"Contact"> | string | null
    notes?: StringNullableFilter<"Contact"> | string | null
    archivedAt?: DateTimeNullableFilter<"Contact"> | Date | string | null
    createdAt?: DateTimeFilter<"Contact"> | Date | string
    updatedAt?: DateTimeFilter<"Contact"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type ContactOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    fullName?: SortOrder
    email?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    company?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    archivedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ContactCountOrderByAggregateInput
    _max?: ContactMaxOrderByAggregateInput
    _min?: ContactMinOrderByAggregateInput
  }

  export type ContactScalarWhereWithAggregatesInput = {
    AND?: ContactScalarWhereWithAggregatesInput | ContactScalarWhereWithAggregatesInput[]
    OR?: ContactScalarWhereWithAggregatesInput[]
    NOT?: ContactScalarWhereWithAggregatesInput | ContactScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Contact"> | string
    userId?: StringWithAggregatesFilter<"Contact"> | string
    fullName?: StringWithAggregatesFilter<"Contact"> | string
    email?: StringNullableWithAggregatesFilter<"Contact"> | string | null
    phone?: StringNullableWithAggregatesFilter<"Contact"> | string | null
    company?: StringNullableWithAggregatesFilter<"Contact"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Contact"> | string | null
    archivedAt?: DateTimeNullableWithAggregatesFilter<"Contact"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Contact"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Contact"> | Date | string
  }

  export type SubscriptionCustomerWhereInput = {
    AND?: SubscriptionCustomerWhereInput | SubscriptionCustomerWhereInput[]
    OR?: SubscriptionCustomerWhereInput[]
    NOT?: SubscriptionCustomerWhereInput | SubscriptionCustomerWhereInput[]
    id?: StringFilter<"SubscriptionCustomer"> | string
    userId?: StringFilter<"SubscriptionCustomer"> | string
    provider?: EnumBillingProviderFilter<"SubscriptionCustomer"> | $Enums.BillingProvider
    providerCustomerId?: StringFilter<"SubscriptionCustomer"> | string
    billingEmail?: StringNullableFilter<"SubscriptionCustomer"> | string | null
    createdAt?: DateTimeFilter<"SubscriptionCustomer"> | Date | string
    updatedAt?: DateTimeFilter<"SubscriptionCustomer"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    subscriptions?: SubscriptionListRelationFilter
  }

  export type SubscriptionCustomerOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    provider?: SortOrder
    providerCustomerId?: SortOrder
    billingEmail?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    subscriptions?: SubscriptionOrderByRelationAggregateInput
  }

  export type SubscriptionCustomerWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    provider_providerCustomerId?: SubscriptionCustomerProviderProviderCustomerIdCompoundUniqueInput
    AND?: SubscriptionCustomerWhereInput | SubscriptionCustomerWhereInput[]
    OR?: SubscriptionCustomerWhereInput[]
    NOT?: SubscriptionCustomerWhereInput | SubscriptionCustomerWhereInput[]
    provider?: EnumBillingProviderFilter<"SubscriptionCustomer"> | $Enums.BillingProvider
    providerCustomerId?: StringFilter<"SubscriptionCustomer"> | string
    billingEmail?: StringNullableFilter<"SubscriptionCustomer"> | string | null
    createdAt?: DateTimeFilter<"SubscriptionCustomer"> | Date | string
    updatedAt?: DateTimeFilter<"SubscriptionCustomer"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    subscriptions?: SubscriptionListRelationFilter
  }, "id" | "userId" | "provider_providerCustomerId">

  export type SubscriptionCustomerOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    provider?: SortOrder
    providerCustomerId?: SortOrder
    billingEmail?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SubscriptionCustomerCountOrderByAggregateInput
    _max?: SubscriptionCustomerMaxOrderByAggregateInput
    _min?: SubscriptionCustomerMinOrderByAggregateInput
  }

  export type SubscriptionCustomerScalarWhereWithAggregatesInput = {
    AND?: SubscriptionCustomerScalarWhereWithAggregatesInput | SubscriptionCustomerScalarWhereWithAggregatesInput[]
    OR?: SubscriptionCustomerScalarWhereWithAggregatesInput[]
    NOT?: SubscriptionCustomerScalarWhereWithAggregatesInput | SubscriptionCustomerScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SubscriptionCustomer"> | string
    userId?: StringWithAggregatesFilter<"SubscriptionCustomer"> | string
    provider?: EnumBillingProviderWithAggregatesFilter<"SubscriptionCustomer"> | $Enums.BillingProvider
    providerCustomerId?: StringWithAggregatesFilter<"SubscriptionCustomer"> | string
    billingEmail?: StringNullableWithAggregatesFilter<"SubscriptionCustomer"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"SubscriptionCustomer"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SubscriptionCustomer"> | Date | string
  }

  export type SubscriptionWhereInput = {
    AND?: SubscriptionWhereInput | SubscriptionWhereInput[]
    OR?: SubscriptionWhereInput[]
    NOT?: SubscriptionWhereInput | SubscriptionWhereInput[]
    id?: StringFilter<"Subscription"> | string
    userId?: StringFilter<"Subscription"> | string
    subscriptionCustomerId?: StringFilter<"Subscription"> | string
    provider?: EnumBillingProviderFilter<"Subscription"> | $Enums.BillingProvider
    providerSubscriptionId?: StringFilter<"Subscription"> | string
    plan?: EnumSubscriptionPlanFilter<"Subscription"> | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFilter<"Subscription"> | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFilter<"Subscription"> | $Enums.SubscriptionInterval
    contactsLimit?: IntNullableFilter<"Subscription"> | number | null
    monthlyImportLimit?: IntNullableFilter<"Subscription"> | number | null
    syncAccountsLimit?: IntNullableFilter<"Subscription"> | number | null
    advancedMergeEnabled?: BoolFilter<"Subscription"> | boolean
    premiumExportEnabled?: BoolFilter<"Subscription"> | boolean
    cardDavSyncEnabled?: BoolFilter<"Subscription"> | boolean
    startedAt?: DateTimeFilter<"Subscription"> | Date | string
    currentPeriodStart?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    currentPeriodEnd?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    trialEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    graceEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    cancelAtPeriodEnd?: BoolFilter<"Subscription"> | boolean
    canceledAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    endedAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    createdAt?: DateTimeFilter<"Subscription"> | Date | string
    updatedAt?: DateTimeFilter<"Subscription"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    subscriptionCustomer?: XOR<SubscriptionCustomerScalarRelationFilter, SubscriptionCustomerWhereInput>
  }

  export type SubscriptionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    subscriptionCustomerId?: SortOrder
    provider?: SortOrder
    providerSubscriptionId?: SortOrder
    plan?: SortOrder
    status?: SortOrder
    interval?: SortOrder
    contactsLimit?: SortOrderInput | SortOrder
    monthlyImportLimit?: SortOrderInput | SortOrder
    syncAccountsLimit?: SortOrderInput | SortOrder
    advancedMergeEnabled?: SortOrder
    premiumExportEnabled?: SortOrder
    cardDavSyncEnabled?: SortOrder
    startedAt?: SortOrder
    currentPeriodStart?: SortOrderInput | SortOrder
    currentPeriodEnd?: SortOrderInput | SortOrder
    trialEndsAt?: SortOrderInput | SortOrder
    graceEndsAt?: SortOrderInput | SortOrder
    cancelAtPeriodEnd?: SortOrder
    canceledAt?: SortOrderInput | SortOrder
    endedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    subscriptionCustomer?: SubscriptionCustomerOrderByWithRelationInput
  }

  export type SubscriptionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    provider_providerSubscriptionId?: SubscriptionProviderProviderSubscriptionIdCompoundUniqueInput
    AND?: SubscriptionWhereInput | SubscriptionWhereInput[]
    OR?: SubscriptionWhereInput[]
    NOT?: SubscriptionWhereInput | SubscriptionWhereInput[]
    userId?: StringFilter<"Subscription"> | string
    subscriptionCustomerId?: StringFilter<"Subscription"> | string
    provider?: EnumBillingProviderFilter<"Subscription"> | $Enums.BillingProvider
    providerSubscriptionId?: StringFilter<"Subscription"> | string
    plan?: EnumSubscriptionPlanFilter<"Subscription"> | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFilter<"Subscription"> | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFilter<"Subscription"> | $Enums.SubscriptionInterval
    contactsLimit?: IntNullableFilter<"Subscription"> | number | null
    monthlyImportLimit?: IntNullableFilter<"Subscription"> | number | null
    syncAccountsLimit?: IntNullableFilter<"Subscription"> | number | null
    advancedMergeEnabled?: BoolFilter<"Subscription"> | boolean
    premiumExportEnabled?: BoolFilter<"Subscription"> | boolean
    cardDavSyncEnabled?: BoolFilter<"Subscription"> | boolean
    startedAt?: DateTimeFilter<"Subscription"> | Date | string
    currentPeriodStart?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    currentPeriodEnd?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    trialEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    graceEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    cancelAtPeriodEnd?: BoolFilter<"Subscription"> | boolean
    canceledAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    endedAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    createdAt?: DateTimeFilter<"Subscription"> | Date | string
    updatedAt?: DateTimeFilter<"Subscription"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    subscriptionCustomer?: XOR<SubscriptionCustomerScalarRelationFilter, SubscriptionCustomerWhereInput>
  }, "id" | "provider_providerSubscriptionId">

  export type SubscriptionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    subscriptionCustomerId?: SortOrder
    provider?: SortOrder
    providerSubscriptionId?: SortOrder
    plan?: SortOrder
    status?: SortOrder
    interval?: SortOrder
    contactsLimit?: SortOrderInput | SortOrder
    monthlyImportLimit?: SortOrderInput | SortOrder
    syncAccountsLimit?: SortOrderInput | SortOrder
    advancedMergeEnabled?: SortOrder
    premiumExportEnabled?: SortOrder
    cardDavSyncEnabled?: SortOrder
    startedAt?: SortOrder
    currentPeriodStart?: SortOrderInput | SortOrder
    currentPeriodEnd?: SortOrderInput | SortOrder
    trialEndsAt?: SortOrderInput | SortOrder
    graceEndsAt?: SortOrderInput | SortOrder
    cancelAtPeriodEnd?: SortOrder
    canceledAt?: SortOrderInput | SortOrder
    endedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SubscriptionCountOrderByAggregateInput
    _avg?: SubscriptionAvgOrderByAggregateInput
    _max?: SubscriptionMaxOrderByAggregateInput
    _min?: SubscriptionMinOrderByAggregateInput
    _sum?: SubscriptionSumOrderByAggregateInput
  }

  export type SubscriptionScalarWhereWithAggregatesInput = {
    AND?: SubscriptionScalarWhereWithAggregatesInput | SubscriptionScalarWhereWithAggregatesInput[]
    OR?: SubscriptionScalarWhereWithAggregatesInput[]
    NOT?: SubscriptionScalarWhereWithAggregatesInput | SubscriptionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Subscription"> | string
    userId?: StringWithAggregatesFilter<"Subscription"> | string
    subscriptionCustomerId?: StringWithAggregatesFilter<"Subscription"> | string
    provider?: EnumBillingProviderWithAggregatesFilter<"Subscription"> | $Enums.BillingProvider
    providerSubscriptionId?: StringWithAggregatesFilter<"Subscription"> | string
    plan?: EnumSubscriptionPlanWithAggregatesFilter<"Subscription"> | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusWithAggregatesFilter<"Subscription"> | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalWithAggregatesFilter<"Subscription"> | $Enums.SubscriptionInterval
    contactsLimit?: IntNullableWithAggregatesFilter<"Subscription"> | number | null
    monthlyImportLimit?: IntNullableWithAggregatesFilter<"Subscription"> | number | null
    syncAccountsLimit?: IntNullableWithAggregatesFilter<"Subscription"> | number | null
    advancedMergeEnabled?: BoolWithAggregatesFilter<"Subscription"> | boolean
    premiumExportEnabled?: BoolWithAggregatesFilter<"Subscription"> | boolean
    cardDavSyncEnabled?: BoolWithAggregatesFilter<"Subscription"> | boolean
    startedAt?: DateTimeWithAggregatesFilter<"Subscription"> | Date | string
    currentPeriodStart?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    currentPeriodEnd?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    trialEndsAt?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    graceEndsAt?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    cancelAtPeriodEnd?: BoolWithAggregatesFilter<"Subscription"> | boolean
    canceledAt?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    endedAt?: DateTimeNullableWithAggregatesFilter<"Subscription"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Subscription"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Subscription"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactCreateNestedManyWithoutUserInput
    subscriptionCustomer?: SubscriptionCustomerCreateNestedOneWithoutUserInput
    subscriptions?: SubscriptionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactUncheckedCreateNestedManyWithoutUserInput
    subscriptionCustomer?: SubscriptionCustomerUncheckedCreateNestedOneWithoutUserInput
    subscriptions?: SubscriptionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUpdateManyWithoutUserNestedInput
    subscriptionCustomer?: SubscriptionCustomerUpdateOneWithoutUserNestedInput
    subscriptions?: SubscriptionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUncheckedUpdateManyWithoutUserNestedInput
    subscriptionCustomer?: SubscriptionCustomerUncheckedUpdateOneWithoutUserNestedInput
    subscriptions?: SubscriptionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactCreateInput = {
    id?: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutContactsInput
  }

  export type ContactUncheckedCreateInput = {
    id?: string
    userId: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ContactUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutContactsNestedInput
  }

  export type ContactUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactCreateManyInput = {
    id?: string
    userId: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ContactUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionCustomerCreateInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSubscriptionCustomerInput
    subscriptions?: SubscriptionCreateNestedManyWithoutSubscriptionCustomerInput
  }

  export type SubscriptionCustomerUncheckedCreateInput = {
    id?: string
    userId: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: SubscriptionUncheckedCreateNestedManyWithoutSubscriptionCustomerInput
  }

  export type SubscriptionCustomerUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSubscriptionCustomerNestedInput
    subscriptions?: SubscriptionUpdateManyWithoutSubscriptionCustomerNestedInput
  }

  export type SubscriptionCustomerUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: SubscriptionUncheckedUpdateManyWithoutSubscriptionCustomerNestedInput
  }

  export type SubscriptionCustomerCreateManyInput = {
    id?: string
    userId: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionCustomerUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionCustomerUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionCreateInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSubscriptionsInput
    subscriptionCustomer: SubscriptionCustomerCreateNestedOneWithoutSubscriptionsInput
  }

  export type SubscriptionUncheckedCreateInput = {
    id?: string
    userId: string
    subscriptionCustomerId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSubscriptionsNestedInput
    subscriptionCustomer?: SubscriptionCustomerUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type SubscriptionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    subscriptionCustomerId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionCreateManyInput = {
    id?: string
    userId: string
    subscriptionCustomerId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    subscriptionCustomerId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumAccountLifecycleStateFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountLifecycleState | EnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    in?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountLifecycleStateFilter<$PrismaModel> | $Enums.AccountLifecycleState
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ContactListRelationFilter = {
    every?: ContactWhereInput
    some?: ContactWhereInput
    none?: ContactWhereInput
  }

  export type SubscriptionCustomerNullableScalarRelationFilter = {
    is?: SubscriptionCustomerWhereInput | null
    isNot?: SubscriptionCustomerWhereInput | null
  }

  export type SubscriptionListRelationFilter = {
    every?: SubscriptionWhereInput
    some?: SubscriptionWhereInput
    none?: SubscriptionWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ContactOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SubscriptionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    lifecycleState?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    lifecycleState?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    email?: SortOrder
    password?: SortOrder
    lifecycleState?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumAccountLifecycleStateWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountLifecycleState | EnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    in?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountLifecycleStateWithAggregatesFilter<$PrismaModel> | $Enums.AccountLifecycleState
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountLifecycleStateFilter<$PrismaModel>
    _max?: NestedEnumAccountLifecycleStateFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type ContactCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    fullName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    company?: SortOrder
    notes?: SortOrder
    archivedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ContactMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    fullName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    company?: SortOrder
    notes?: SortOrder
    archivedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ContactMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    fullName?: SortOrder
    email?: SortOrder
    phone?: SortOrder
    company?: SortOrder
    notes?: SortOrder
    archivedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumBillingProviderFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingProvider | EnumBillingProviderFieldRefInput<$PrismaModel>
    in?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingProviderFilter<$PrismaModel> | $Enums.BillingProvider
  }

  export type SubscriptionCustomerProviderProviderCustomerIdCompoundUniqueInput = {
    provider: $Enums.BillingProvider
    providerCustomerId: string
  }

  export type SubscriptionCustomerCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    provider?: SortOrder
    providerCustomerId?: SortOrder
    billingEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SubscriptionCustomerMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    provider?: SortOrder
    providerCustomerId?: SortOrder
    billingEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SubscriptionCustomerMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    provider?: SortOrder
    providerCustomerId?: SortOrder
    billingEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumBillingProviderWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingProvider | EnumBillingProviderFieldRefInput<$PrismaModel>
    in?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingProviderWithAggregatesFilter<$PrismaModel> | $Enums.BillingProvider
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBillingProviderFilter<$PrismaModel>
    _max?: NestedEnumBillingProviderFilter<$PrismaModel>
  }

  export type EnumSubscriptionPlanFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionPlan | EnumSubscriptionPlanFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionPlanFilter<$PrismaModel> | $Enums.SubscriptionPlan
  }

  export type EnumSubscriptionStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionStatus | EnumSubscriptionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionStatusFilter<$PrismaModel> | $Enums.SubscriptionStatus
  }

  export type EnumSubscriptionIntervalFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionInterval | EnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionIntervalFilter<$PrismaModel> | $Enums.SubscriptionInterval
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type SubscriptionCustomerScalarRelationFilter = {
    is?: SubscriptionCustomerWhereInput
    isNot?: SubscriptionCustomerWhereInput
  }

  export type SubscriptionProviderProviderSubscriptionIdCompoundUniqueInput = {
    provider: $Enums.BillingProvider
    providerSubscriptionId: string
  }

  export type SubscriptionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    subscriptionCustomerId?: SortOrder
    provider?: SortOrder
    providerSubscriptionId?: SortOrder
    plan?: SortOrder
    status?: SortOrder
    interval?: SortOrder
    contactsLimit?: SortOrder
    monthlyImportLimit?: SortOrder
    syncAccountsLimit?: SortOrder
    advancedMergeEnabled?: SortOrder
    premiumExportEnabled?: SortOrder
    cardDavSyncEnabled?: SortOrder
    startedAt?: SortOrder
    currentPeriodStart?: SortOrder
    currentPeriodEnd?: SortOrder
    trialEndsAt?: SortOrder
    graceEndsAt?: SortOrder
    cancelAtPeriodEnd?: SortOrder
    canceledAt?: SortOrder
    endedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SubscriptionAvgOrderByAggregateInput = {
    contactsLimit?: SortOrder
    monthlyImportLimit?: SortOrder
    syncAccountsLimit?: SortOrder
  }

  export type SubscriptionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    subscriptionCustomerId?: SortOrder
    provider?: SortOrder
    providerSubscriptionId?: SortOrder
    plan?: SortOrder
    status?: SortOrder
    interval?: SortOrder
    contactsLimit?: SortOrder
    monthlyImportLimit?: SortOrder
    syncAccountsLimit?: SortOrder
    advancedMergeEnabled?: SortOrder
    premiumExportEnabled?: SortOrder
    cardDavSyncEnabled?: SortOrder
    startedAt?: SortOrder
    currentPeriodStart?: SortOrder
    currentPeriodEnd?: SortOrder
    trialEndsAt?: SortOrder
    graceEndsAt?: SortOrder
    cancelAtPeriodEnd?: SortOrder
    canceledAt?: SortOrder
    endedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SubscriptionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    subscriptionCustomerId?: SortOrder
    provider?: SortOrder
    providerSubscriptionId?: SortOrder
    plan?: SortOrder
    status?: SortOrder
    interval?: SortOrder
    contactsLimit?: SortOrder
    monthlyImportLimit?: SortOrder
    syncAccountsLimit?: SortOrder
    advancedMergeEnabled?: SortOrder
    premiumExportEnabled?: SortOrder
    cardDavSyncEnabled?: SortOrder
    startedAt?: SortOrder
    currentPeriodStart?: SortOrder
    currentPeriodEnd?: SortOrder
    trialEndsAt?: SortOrder
    graceEndsAt?: SortOrder
    cancelAtPeriodEnd?: SortOrder
    canceledAt?: SortOrder
    endedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SubscriptionSumOrderByAggregateInput = {
    contactsLimit?: SortOrder
    monthlyImportLimit?: SortOrder
    syncAccountsLimit?: SortOrder
  }

  export type EnumSubscriptionPlanWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionPlan | EnumSubscriptionPlanFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionPlanWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionPlan
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionPlanFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionPlanFilter<$PrismaModel>
  }

  export type EnumSubscriptionStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionStatus | EnumSubscriptionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionStatusWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionStatusFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionStatusFilter<$PrismaModel>
  }

  export type EnumSubscriptionIntervalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionInterval | EnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionIntervalWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionInterval
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionIntervalFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionIntervalFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type ContactCreateNestedManyWithoutUserInput = {
    create?: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput> | ContactCreateWithoutUserInput[] | ContactUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContactCreateOrConnectWithoutUserInput | ContactCreateOrConnectWithoutUserInput[]
    createMany?: ContactCreateManyUserInputEnvelope
    connect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
  }

  export type SubscriptionCustomerCreateNestedOneWithoutUserInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutUserInput
    connect?: SubscriptionCustomerWhereUniqueInput
  }

  export type SubscriptionCreateNestedManyWithoutUserInput = {
    create?: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput> | SubscriptionCreateWithoutUserInput[] | SubscriptionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutUserInput | SubscriptionCreateOrConnectWithoutUserInput[]
    createMany?: SubscriptionCreateManyUserInputEnvelope
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
  }

  export type ContactUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput> | ContactCreateWithoutUserInput[] | ContactUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContactCreateOrConnectWithoutUserInput | ContactCreateOrConnectWithoutUserInput[]
    createMany?: ContactCreateManyUserInputEnvelope
    connect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
  }

  export type SubscriptionCustomerUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutUserInput
    connect?: SubscriptionCustomerWhereUniqueInput
  }

  export type SubscriptionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput> | SubscriptionCreateWithoutUserInput[] | SubscriptionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutUserInput | SubscriptionCreateOrConnectWithoutUserInput[]
    createMany?: SubscriptionCreateManyUserInputEnvelope
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumAccountLifecycleStateFieldUpdateOperationsInput = {
    set?: $Enums.AccountLifecycleState
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ContactUpdateManyWithoutUserNestedInput = {
    create?: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput> | ContactCreateWithoutUserInput[] | ContactUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContactCreateOrConnectWithoutUserInput | ContactCreateOrConnectWithoutUserInput[]
    upsert?: ContactUpsertWithWhereUniqueWithoutUserInput | ContactUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ContactCreateManyUserInputEnvelope
    set?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    disconnect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    delete?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    connect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    update?: ContactUpdateWithWhereUniqueWithoutUserInput | ContactUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ContactUpdateManyWithWhereWithoutUserInput | ContactUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ContactScalarWhereInput | ContactScalarWhereInput[]
  }

  export type SubscriptionCustomerUpdateOneWithoutUserNestedInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutUserInput
    upsert?: SubscriptionCustomerUpsertWithoutUserInput
    disconnect?: SubscriptionCustomerWhereInput | boolean
    delete?: SubscriptionCustomerWhereInput | boolean
    connect?: SubscriptionCustomerWhereUniqueInput
    update?: XOR<XOR<SubscriptionCustomerUpdateToOneWithWhereWithoutUserInput, SubscriptionCustomerUpdateWithoutUserInput>, SubscriptionCustomerUncheckedUpdateWithoutUserInput>
  }

  export type SubscriptionUpdateManyWithoutUserNestedInput = {
    create?: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput> | SubscriptionCreateWithoutUserInput[] | SubscriptionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutUserInput | SubscriptionCreateOrConnectWithoutUserInput[]
    upsert?: SubscriptionUpsertWithWhereUniqueWithoutUserInput | SubscriptionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SubscriptionCreateManyUserInputEnvelope
    set?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    disconnect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    delete?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    update?: SubscriptionUpdateWithWhereUniqueWithoutUserInput | SubscriptionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SubscriptionUpdateManyWithWhereWithoutUserInput | SubscriptionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
  }

  export type ContactUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput> | ContactCreateWithoutUserInput[] | ContactUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ContactCreateOrConnectWithoutUserInput | ContactCreateOrConnectWithoutUserInput[]
    upsert?: ContactUpsertWithWhereUniqueWithoutUserInput | ContactUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ContactCreateManyUserInputEnvelope
    set?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    disconnect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    delete?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    connect?: ContactWhereUniqueInput | ContactWhereUniqueInput[]
    update?: ContactUpdateWithWhereUniqueWithoutUserInput | ContactUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ContactUpdateManyWithWhereWithoutUserInput | ContactUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ContactScalarWhereInput | ContactScalarWhereInput[]
  }

  export type SubscriptionCustomerUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutUserInput
    upsert?: SubscriptionCustomerUpsertWithoutUserInput
    disconnect?: SubscriptionCustomerWhereInput | boolean
    delete?: SubscriptionCustomerWhereInput | boolean
    connect?: SubscriptionCustomerWhereUniqueInput
    update?: XOR<XOR<SubscriptionCustomerUpdateToOneWithWhereWithoutUserInput, SubscriptionCustomerUpdateWithoutUserInput>, SubscriptionCustomerUncheckedUpdateWithoutUserInput>
  }

  export type SubscriptionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput> | SubscriptionCreateWithoutUserInput[] | SubscriptionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutUserInput | SubscriptionCreateOrConnectWithoutUserInput[]
    upsert?: SubscriptionUpsertWithWhereUniqueWithoutUserInput | SubscriptionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SubscriptionCreateManyUserInputEnvelope
    set?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    disconnect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    delete?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    update?: SubscriptionUpdateWithWhereUniqueWithoutUserInput | SubscriptionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SubscriptionUpdateManyWithWhereWithoutUserInput | SubscriptionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutContactsInput = {
    create?: XOR<UserCreateWithoutContactsInput, UserUncheckedCreateWithoutContactsInput>
    connectOrCreate?: UserCreateOrConnectWithoutContactsInput
    connect?: UserWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type UserUpdateOneRequiredWithoutContactsNestedInput = {
    create?: XOR<UserCreateWithoutContactsInput, UserUncheckedCreateWithoutContactsInput>
    connectOrCreate?: UserCreateOrConnectWithoutContactsInput
    upsert?: UserUpsertWithoutContactsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutContactsInput, UserUpdateWithoutContactsInput>, UserUncheckedUpdateWithoutContactsInput>
  }

  export type UserCreateNestedOneWithoutSubscriptionCustomerInput = {
    create?: XOR<UserCreateWithoutSubscriptionCustomerInput, UserUncheckedCreateWithoutSubscriptionCustomerInput>
    connectOrCreate?: UserCreateOrConnectWithoutSubscriptionCustomerInput
    connect?: UserWhereUniqueInput
  }

  export type SubscriptionCreateNestedManyWithoutSubscriptionCustomerInput = {
    create?: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput> | SubscriptionCreateWithoutSubscriptionCustomerInput[] | SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput | SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput[]
    createMany?: SubscriptionCreateManySubscriptionCustomerInputEnvelope
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
  }

  export type SubscriptionUncheckedCreateNestedManyWithoutSubscriptionCustomerInput = {
    create?: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput> | SubscriptionCreateWithoutSubscriptionCustomerInput[] | SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput | SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput[]
    createMany?: SubscriptionCreateManySubscriptionCustomerInputEnvelope
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
  }

  export type EnumBillingProviderFieldUpdateOperationsInput = {
    set?: $Enums.BillingProvider
  }

  export type UserUpdateOneRequiredWithoutSubscriptionCustomerNestedInput = {
    create?: XOR<UserCreateWithoutSubscriptionCustomerInput, UserUncheckedCreateWithoutSubscriptionCustomerInput>
    connectOrCreate?: UserCreateOrConnectWithoutSubscriptionCustomerInput
    upsert?: UserUpsertWithoutSubscriptionCustomerInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSubscriptionCustomerInput, UserUpdateWithoutSubscriptionCustomerInput>, UserUncheckedUpdateWithoutSubscriptionCustomerInput>
  }

  export type SubscriptionUpdateManyWithoutSubscriptionCustomerNestedInput = {
    create?: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput> | SubscriptionCreateWithoutSubscriptionCustomerInput[] | SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput | SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput[]
    upsert?: SubscriptionUpsertWithWhereUniqueWithoutSubscriptionCustomerInput | SubscriptionUpsertWithWhereUniqueWithoutSubscriptionCustomerInput[]
    createMany?: SubscriptionCreateManySubscriptionCustomerInputEnvelope
    set?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    disconnect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    delete?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    update?: SubscriptionUpdateWithWhereUniqueWithoutSubscriptionCustomerInput | SubscriptionUpdateWithWhereUniqueWithoutSubscriptionCustomerInput[]
    updateMany?: SubscriptionUpdateManyWithWhereWithoutSubscriptionCustomerInput | SubscriptionUpdateManyWithWhereWithoutSubscriptionCustomerInput[]
    deleteMany?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
  }

  export type SubscriptionUncheckedUpdateManyWithoutSubscriptionCustomerNestedInput = {
    create?: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput> | SubscriptionCreateWithoutSubscriptionCustomerInput[] | SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput[]
    connectOrCreate?: SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput | SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput[]
    upsert?: SubscriptionUpsertWithWhereUniqueWithoutSubscriptionCustomerInput | SubscriptionUpsertWithWhereUniqueWithoutSubscriptionCustomerInput[]
    createMany?: SubscriptionCreateManySubscriptionCustomerInputEnvelope
    set?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    disconnect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    delete?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    connect?: SubscriptionWhereUniqueInput | SubscriptionWhereUniqueInput[]
    update?: SubscriptionUpdateWithWhereUniqueWithoutSubscriptionCustomerInput | SubscriptionUpdateWithWhereUniqueWithoutSubscriptionCustomerInput[]
    updateMany?: SubscriptionUpdateManyWithWhereWithoutSubscriptionCustomerInput | SubscriptionUpdateManyWithWhereWithoutSubscriptionCustomerInput[]
    deleteMany?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<UserCreateWithoutSubscriptionsInput, UserUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSubscriptionsInput
    connect?: UserWhereUniqueInput
  }

  export type SubscriptionCustomerCreateNestedOneWithoutSubscriptionsInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutSubscriptionsInput
    connect?: SubscriptionCustomerWhereUniqueInput
  }

  export type EnumSubscriptionPlanFieldUpdateOperationsInput = {
    set?: $Enums.SubscriptionPlan
  }

  export type EnumSubscriptionStatusFieldUpdateOperationsInput = {
    set?: $Enums.SubscriptionStatus
  }

  export type EnumSubscriptionIntervalFieldUpdateOperationsInput = {
    set?: $Enums.SubscriptionInterval
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type UserUpdateOneRequiredWithoutSubscriptionsNestedInput = {
    create?: XOR<UserCreateWithoutSubscriptionsInput, UserUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSubscriptionsInput
    upsert?: UserUpsertWithoutSubscriptionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSubscriptionsInput, UserUpdateWithoutSubscriptionsInput>, UserUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type SubscriptionCustomerUpdateOneRequiredWithoutSubscriptionsNestedInput = {
    create?: XOR<SubscriptionCustomerCreateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedCreateWithoutSubscriptionsInput>
    connectOrCreate?: SubscriptionCustomerCreateOrConnectWithoutSubscriptionsInput
    upsert?: SubscriptionCustomerUpsertWithoutSubscriptionsInput
    connect?: SubscriptionCustomerWhereUniqueInput
    update?: XOR<XOR<SubscriptionCustomerUpdateToOneWithWhereWithoutSubscriptionsInput, SubscriptionCustomerUpdateWithoutSubscriptionsInput>, SubscriptionCustomerUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumAccountLifecycleStateFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountLifecycleState | EnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    in?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountLifecycleStateFilter<$PrismaModel> | $Enums.AccountLifecycleState
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumAccountLifecycleStateWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountLifecycleState | EnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    in?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountLifecycleState[] | ListEnumAccountLifecycleStateFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountLifecycleStateWithAggregatesFilter<$PrismaModel> | $Enums.AccountLifecycleState
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountLifecycleStateFilter<$PrismaModel>
    _max?: NestedEnumAccountLifecycleStateFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumBillingProviderFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingProvider | EnumBillingProviderFieldRefInput<$PrismaModel>
    in?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingProviderFilter<$PrismaModel> | $Enums.BillingProvider
  }

  export type NestedEnumBillingProviderWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingProvider | EnumBillingProviderFieldRefInput<$PrismaModel>
    in?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingProvider[] | ListEnumBillingProviderFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingProviderWithAggregatesFilter<$PrismaModel> | $Enums.BillingProvider
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBillingProviderFilter<$PrismaModel>
    _max?: NestedEnumBillingProviderFilter<$PrismaModel>
  }

  export type NestedEnumSubscriptionPlanFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionPlan | EnumSubscriptionPlanFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionPlanFilter<$PrismaModel> | $Enums.SubscriptionPlan
  }

  export type NestedEnumSubscriptionStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionStatus | EnumSubscriptionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionStatusFilter<$PrismaModel> | $Enums.SubscriptionStatus
  }

  export type NestedEnumSubscriptionIntervalFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionInterval | EnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionIntervalFilter<$PrismaModel> | $Enums.SubscriptionInterval
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedEnumSubscriptionPlanWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionPlan | EnumSubscriptionPlanFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionPlan[] | ListEnumSubscriptionPlanFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionPlanWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionPlan
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionPlanFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionPlanFilter<$PrismaModel>
  }

  export type NestedEnumSubscriptionStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionStatus | EnumSubscriptionStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionStatus[] | ListEnumSubscriptionStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionStatusWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionStatusFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionStatusFilter<$PrismaModel>
  }

  export type NestedEnumSubscriptionIntervalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SubscriptionInterval | EnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    in?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    notIn?: $Enums.SubscriptionInterval[] | ListEnumSubscriptionIntervalFieldRefInput<$PrismaModel>
    not?: NestedEnumSubscriptionIntervalWithAggregatesFilter<$PrismaModel> | $Enums.SubscriptionInterval
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSubscriptionIntervalFilter<$PrismaModel>
    _max?: NestedEnumSubscriptionIntervalFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type ContactCreateWithoutUserInput = {
    id?: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ContactUncheckedCreateWithoutUserInput = {
    id?: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ContactCreateOrConnectWithoutUserInput = {
    where: ContactWhereUniqueInput
    create: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput>
  }

  export type ContactCreateManyUserInputEnvelope = {
    data: ContactCreateManyUserInput | ContactCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type SubscriptionCustomerCreateWithoutUserInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: SubscriptionCreateNestedManyWithoutSubscriptionCustomerInput
  }

  export type SubscriptionCustomerUncheckedCreateWithoutUserInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptions?: SubscriptionUncheckedCreateNestedManyWithoutSubscriptionCustomerInput
  }

  export type SubscriptionCustomerCreateOrConnectWithoutUserInput = {
    where: SubscriptionCustomerWhereUniqueInput
    create: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
  }

  export type SubscriptionCreateWithoutUserInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptionCustomer: SubscriptionCustomerCreateNestedOneWithoutSubscriptionsInput
  }

  export type SubscriptionUncheckedCreateWithoutUserInput = {
    id?: string
    subscriptionCustomerId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionCreateOrConnectWithoutUserInput = {
    where: SubscriptionWhereUniqueInput
    create: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput>
  }

  export type SubscriptionCreateManyUserInputEnvelope = {
    data: SubscriptionCreateManyUserInput | SubscriptionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ContactUpsertWithWhereUniqueWithoutUserInput = {
    where: ContactWhereUniqueInput
    update: XOR<ContactUpdateWithoutUserInput, ContactUncheckedUpdateWithoutUserInput>
    create: XOR<ContactCreateWithoutUserInput, ContactUncheckedCreateWithoutUserInput>
  }

  export type ContactUpdateWithWhereUniqueWithoutUserInput = {
    where: ContactWhereUniqueInput
    data: XOR<ContactUpdateWithoutUserInput, ContactUncheckedUpdateWithoutUserInput>
  }

  export type ContactUpdateManyWithWhereWithoutUserInput = {
    where: ContactScalarWhereInput
    data: XOR<ContactUpdateManyMutationInput, ContactUncheckedUpdateManyWithoutUserInput>
  }

  export type ContactScalarWhereInput = {
    AND?: ContactScalarWhereInput | ContactScalarWhereInput[]
    OR?: ContactScalarWhereInput[]
    NOT?: ContactScalarWhereInput | ContactScalarWhereInput[]
    id?: StringFilter<"Contact"> | string
    userId?: StringFilter<"Contact"> | string
    fullName?: StringFilter<"Contact"> | string
    email?: StringNullableFilter<"Contact"> | string | null
    phone?: StringNullableFilter<"Contact"> | string | null
    company?: StringNullableFilter<"Contact"> | string | null
    notes?: StringNullableFilter<"Contact"> | string | null
    archivedAt?: DateTimeNullableFilter<"Contact"> | Date | string | null
    createdAt?: DateTimeFilter<"Contact"> | Date | string
    updatedAt?: DateTimeFilter<"Contact"> | Date | string
  }

  export type SubscriptionCustomerUpsertWithoutUserInput = {
    update: XOR<SubscriptionCustomerUpdateWithoutUserInput, SubscriptionCustomerUncheckedUpdateWithoutUserInput>
    create: XOR<SubscriptionCustomerCreateWithoutUserInput, SubscriptionCustomerUncheckedCreateWithoutUserInput>
    where?: SubscriptionCustomerWhereInput
  }

  export type SubscriptionCustomerUpdateToOneWithWhereWithoutUserInput = {
    where?: SubscriptionCustomerWhereInput
    data: XOR<SubscriptionCustomerUpdateWithoutUserInput, SubscriptionCustomerUncheckedUpdateWithoutUserInput>
  }

  export type SubscriptionCustomerUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: SubscriptionUpdateManyWithoutSubscriptionCustomerNestedInput
  }

  export type SubscriptionCustomerUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptions?: SubscriptionUncheckedUpdateManyWithoutSubscriptionCustomerNestedInput
  }

  export type SubscriptionUpsertWithWhereUniqueWithoutUserInput = {
    where: SubscriptionWhereUniqueInput
    update: XOR<SubscriptionUpdateWithoutUserInput, SubscriptionUncheckedUpdateWithoutUserInput>
    create: XOR<SubscriptionCreateWithoutUserInput, SubscriptionUncheckedCreateWithoutUserInput>
  }

  export type SubscriptionUpdateWithWhereUniqueWithoutUserInput = {
    where: SubscriptionWhereUniqueInput
    data: XOR<SubscriptionUpdateWithoutUserInput, SubscriptionUncheckedUpdateWithoutUserInput>
  }

  export type SubscriptionUpdateManyWithWhereWithoutUserInput = {
    where: SubscriptionScalarWhereInput
    data: XOR<SubscriptionUpdateManyMutationInput, SubscriptionUncheckedUpdateManyWithoutUserInput>
  }

  export type SubscriptionScalarWhereInput = {
    AND?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
    OR?: SubscriptionScalarWhereInput[]
    NOT?: SubscriptionScalarWhereInput | SubscriptionScalarWhereInput[]
    id?: StringFilter<"Subscription"> | string
    userId?: StringFilter<"Subscription"> | string
    subscriptionCustomerId?: StringFilter<"Subscription"> | string
    provider?: EnumBillingProviderFilter<"Subscription"> | $Enums.BillingProvider
    providerSubscriptionId?: StringFilter<"Subscription"> | string
    plan?: EnumSubscriptionPlanFilter<"Subscription"> | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFilter<"Subscription"> | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFilter<"Subscription"> | $Enums.SubscriptionInterval
    contactsLimit?: IntNullableFilter<"Subscription"> | number | null
    monthlyImportLimit?: IntNullableFilter<"Subscription"> | number | null
    syncAccountsLimit?: IntNullableFilter<"Subscription"> | number | null
    advancedMergeEnabled?: BoolFilter<"Subscription"> | boolean
    premiumExportEnabled?: BoolFilter<"Subscription"> | boolean
    cardDavSyncEnabled?: BoolFilter<"Subscription"> | boolean
    startedAt?: DateTimeFilter<"Subscription"> | Date | string
    currentPeriodStart?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    currentPeriodEnd?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    trialEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    graceEndsAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    cancelAtPeriodEnd?: BoolFilter<"Subscription"> | boolean
    canceledAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    endedAt?: DateTimeNullableFilter<"Subscription"> | Date | string | null
    createdAt?: DateTimeFilter<"Subscription"> | Date | string
    updatedAt?: DateTimeFilter<"Subscription"> | Date | string
  }

  export type UserCreateWithoutContactsInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptionCustomer?: SubscriptionCustomerCreateNestedOneWithoutUserInput
    subscriptions?: SubscriptionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutContactsInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    subscriptionCustomer?: SubscriptionCustomerUncheckedCreateNestedOneWithoutUserInput
    subscriptions?: SubscriptionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutContactsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutContactsInput, UserUncheckedCreateWithoutContactsInput>
  }

  export type UserUpsertWithoutContactsInput = {
    update: XOR<UserUpdateWithoutContactsInput, UserUncheckedUpdateWithoutContactsInput>
    create: XOR<UserCreateWithoutContactsInput, UserUncheckedCreateWithoutContactsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutContactsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutContactsInput, UserUncheckedUpdateWithoutContactsInput>
  }

  export type UserUpdateWithoutContactsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionCustomer?: SubscriptionCustomerUpdateOneWithoutUserNestedInput
    subscriptions?: SubscriptionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutContactsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionCustomer?: SubscriptionCustomerUncheckedUpdateOneWithoutUserNestedInput
    subscriptions?: SubscriptionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutSubscriptionCustomerInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactCreateNestedManyWithoutUserInput
    subscriptions?: SubscriptionCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSubscriptionCustomerInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactUncheckedCreateNestedManyWithoutUserInput
    subscriptions?: SubscriptionUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSubscriptionCustomerInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSubscriptionCustomerInput, UserUncheckedCreateWithoutSubscriptionCustomerInput>
  }

  export type SubscriptionCreateWithoutSubscriptionCustomerInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSubscriptionsInput
  }

  export type SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput = {
    id?: string
    userId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionCreateOrConnectWithoutSubscriptionCustomerInput = {
    where: SubscriptionWhereUniqueInput
    create: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput>
  }

  export type SubscriptionCreateManySubscriptionCustomerInputEnvelope = {
    data: SubscriptionCreateManySubscriptionCustomerInput | SubscriptionCreateManySubscriptionCustomerInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutSubscriptionCustomerInput = {
    update: XOR<UserUpdateWithoutSubscriptionCustomerInput, UserUncheckedUpdateWithoutSubscriptionCustomerInput>
    create: XOR<UserCreateWithoutSubscriptionCustomerInput, UserUncheckedCreateWithoutSubscriptionCustomerInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSubscriptionCustomerInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSubscriptionCustomerInput, UserUncheckedUpdateWithoutSubscriptionCustomerInput>
  }

  export type UserUpdateWithoutSubscriptionCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUpdateManyWithoutUserNestedInput
    subscriptions?: SubscriptionUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSubscriptionCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUncheckedUpdateManyWithoutUserNestedInput
    subscriptions?: SubscriptionUncheckedUpdateManyWithoutUserNestedInput
  }

  export type SubscriptionUpsertWithWhereUniqueWithoutSubscriptionCustomerInput = {
    where: SubscriptionWhereUniqueInput
    update: XOR<SubscriptionUpdateWithoutSubscriptionCustomerInput, SubscriptionUncheckedUpdateWithoutSubscriptionCustomerInput>
    create: XOR<SubscriptionCreateWithoutSubscriptionCustomerInput, SubscriptionUncheckedCreateWithoutSubscriptionCustomerInput>
  }

  export type SubscriptionUpdateWithWhereUniqueWithoutSubscriptionCustomerInput = {
    where: SubscriptionWhereUniqueInput
    data: XOR<SubscriptionUpdateWithoutSubscriptionCustomerInput, SubscriptionUncheckedUpdateWithoutSubscriptionCustomerInput>
  }

  export type SubscriptionUpdateManyWithWhereWithoutSubscriptionCustomerInput = {
    where: SubscriptionScalarWhereInput
    data: XOR<SubscriptionUpdateManyMutationInput, SubscriptionUncheckedUpdateManyWithoutSubscriptionCustomerInput>
  }

  export type UserCreateWithoutSubscriptionsInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactCreateNestedManyWithoutUserInput
    subscriptionCustomer?: SubscriptionCustomerCreateNestedOneWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSubscriptionsInput = {
    id?: string
    name?: string | null
    email: string
    password: string
    lifecycleState?: $Enums.AccountLifecycleState
    createdAt?: Date | string
    updatedAt?: Date | string
    contacts?: ContactUncheckedCreateNestedManyWithoutUserInput
    subscriptionCustomer?: SubscriptionCustomerUncheckedCreateNestedOneWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSubscriptionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSubscriptionsInput, UserUncheckedCreateWithoutSubscriptionsInput>
  }

  export type SubscriptionCustomerCreateWithoutSubscriptionsInput = {
    id?: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSubscriptionCustomerInput
  }

  export type SubscriptionCustomerUncheckedCreateWithoutSubscriptionsInput = {
    id?: string
    userId: string
    provider?: $Enums.BillingProvider
    providerCustomerId: string
    billingEmail?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionCustomerCreateOrConnectWithoutSubscriptionsInput = {
    where: SubscriptionCustomerWhereUniqueInput
    create: XOR<SubscriptionCustomerCreateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedCreateWithoutSubscriptionsInput>
  }

  export type UserUpsertWithoutSubscriptionsInput = {
    update: XOR<UserUpdateWithoutSubscriptionsInput, UserUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<UserCreateWithoutSubscriptionsInput, UserUncheckedCreateWithoutSubscriptionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSubscriptionsInput, UserUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type UserUpdateWithoutSubscriptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUpdateManyWithoutUserNestedInput
    subscriptionCustomer?: SubscriptionCustomerUpdateOneWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSubscriptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    lifecycleState?: EnumAccountLifecycleStateFieldUpdateOperationsInput | $Enums.AccountLifecycleState
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    contacts?: ContactUncheckedUpdateManyWithoutUserNestedInput
    subscriptionCustomer?: SubscriptionCustomerUncheckedUpdateOneWithoutUserNestedInput
  }

  export type SubscriptionCustomerUpsertWithoutSubscriptionsInput = {
    update: XOR<SubscriptionCustomerUpdateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedUpdateWithoutSubscriptionsInput>
    create: XOR<SubscriptionCustomerCreateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedCreateWithoutSubscriptionsInput>
    where?: SubscriptionCustomerWhereInput
  }

  export type SubscriptionCustomerUpdateToOneWithWhereWithoutSubscriptionsInput = {
    where?: SubscriptionCustomerWhereInput
    data: XOR<SubscriptionCustomerUpdateWithoutSubscriptionsInput, SubscriptionCustomerUncheckedUpdateWithoutSubscriptionsInput>
  }

  export type SubscriptionCustomerUpdateWithoutSubscriptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSubscriptionCustomerNestedInput
  }

  export type SubscriptionCustomerUncheckedUpdateWithoutSubscriptionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerCustomerId?: StringFieldUpdateOperationsInput | string
    billingEmail?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactCreateManyUserInput = {
    id?: string
    fullName: string
    email?: string | null
    phone?: string | null
    company?: string | null
    notes?: string | null
    archivedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionCreateManyUserInput = {
    id?: string
    subscriptionCustomerId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ContactUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ContactUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    fullName?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    company?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    archivedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    subscriptionCustomer?: SubscriptionCustomerUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type SubscriptionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    subscriptionCustomerId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    subscriptionCustomerId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionCreateManySubscriptionCustomerInput = {
    id?: string
    userId: string
    provider?: $Enums.BillingProvider
    providerSubscriptionId: string
    plan?: $Enums.SubscriptionPlan
    status?: $Enums.SubscriptionStatus
    interval?: $Enums.SubscriptionInterval
    contactsLimit?: number | null
    monthlyImportLimit?: number | null
    syncAccountsLimit?: number | null
    advancedMergeEnabled?: boolean
    premiumExportEnabled?: boolean
    cardDavSyncEnabled?: boolean
    startedAt?: Date | string
    currentPeriodStart?: Date | string | null
    currentPeriodEnd?: Date | string | null
    trialEndsAt?: Date | string | null
    graceEndsAt?: Date | string | null
    cancelAtPeriodEnd?: boolean
    canceledAt?: Date | string | null
    endedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SubscriptionUpdateWithoutSubscriptionCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSubscriptionsNestedInput
  }

  export type SubscriptionUncheckedUpdateWithoutSubscriptionCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SubscriptionUncheckedUpdateManyWithoutSubscriptionCustomerInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    provider?: EnumBillingProviderFieldUpdateOperationsInput | $Enums.BillingProvider
    providerSubscriptionId?: StringFieldUpdateOperationsInput | string
    plan?: EnumSubscriptionPlanFieldUpdateOperationsInput | $Enums.SubscriptionPlan
    status?: EnumSubscriptionStatusFieldUpdateOperationsInput | $Enums.SubscriptionStatus
    interval?: EnumSubscriptionIntervalFieldUpdateOperationsInput | $Enums.SubscriptionInterval
    contactsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    monthlyImportLimit?: NullableIntFieldUpdateOperationsInput | number | null
    syncAccountsLimit?: NullableIntFieldUpdateOperationsInput | number | null
    advancedMergeEnabled?: BoolFieldUpdateOperationsInput | boolean
    premiumExportEnabled?: BoolFieldUpdateOperationsInput | boolean
    cardDavSyncEnabled?: BoolFieldUpdateOperationsInput | boolean
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    currentPeriodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    currentPeriodEnd?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trialEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    graceEndsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelAtPeriodEnd?: BoolFieldUpdateOperationsInput | boolean
    canceledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    endedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}