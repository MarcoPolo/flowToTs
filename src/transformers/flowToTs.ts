// From:
// ?type
// To:
// type | null | undefined

import {
  FileInfo,
  API,
  Options,
  Transform,
  JSCodeshift,
  TSType,
  TSTypeAnnotation,
  Identifier,
  FunctionTypeParam,
  TSTypeParameter,
  TypeParameter,
  TSPropertySignature,
  TSIndexSignature,
  TypeAlias,
  OpaqueType,
  ObjectTypeProperty,
  ObjectTypeIndexer,
  ObjectTypeSpreadProperty,
  QualifiedTypeIdentifier,
  GenericTypeAnnotation,
  TypeAnnotation,
  TypeParameterDeclaration,
  TSTypeParameterDeclaration,
  FunctionTypeAnnotation,
  RestElement,
  TSMappedType,
  TSQualifiedName,
  MemberExpression,
  OptionalMemberExpression,
  LogicalExpression
} from "jscodeshift";
import { Node } from "ast-types/gen/nodes";
import {
  FlowTypeKind,
  TSTypeKind,
  PatternKind,
  QualifiedTypeIdentifierKind,
  ExpressionKind,
  MemberExpressionKind
} from "ast-types/gen/kinds";
import { Collection } from "jscodeshift/src/Collection";
import { NodePath } from "recast";
import { jsxClosingElement, memberExpression } from "@babel/types";
import pathPlugin from "ast-types/lib/path";

const lowerCaseFirst = (s: string) => s.replace(/^(.)/, m => m.toLowerCase());

function convertIndexedToMappedType(
  j: JSCodeshift,
  t: ObjectTypeIndexer
): TSMappedType {
  const constraint = convertToTSType(j, t.key);
  const typeParameter = j.tsTypeParameter.from({
    constraint,
    name: "K"
  });
  return j.tsMappedType.from({
    typeParameter,
    typeAnnotation: convertToTSType(j, t.value)
  });
}

function convertPropertiesToTsProperties(
  j: JSCodeshift,
  p: ObjectTypeProperty | ObjectTypeIndexer
): TSPropertySignature | TSIndexSignature {
  if (p.type == "ObjectTypeProperty") {
    const tsType = convertToTSType(j, p.value);
    if (tsType) {
      const typeAnnotation = j.tsTypeAnnotation(tsType);
      return j.tsPropertySignature.from({
        key: p.key,
        typeAnnotation,
        optional: p.optional,
        readonly: !!p.variance && (p.variance as any).kind === "plus"
      });
    }
  } else {
    let name: string;
    if (p.id) {
      name = p.id.name;
    } else if (
      p.key.type === "GenericTypeAnnotation" &&
      p.key.id &&
      p.key.id.type === "Identifier"
    ) {
      name = lowerCaseFirst(p.key.id.name);
    } else if (p.key.type === "NumberTypeAnnotation") {
      name = "n";
    } else {
      name = "key";
    }
    const typeAnnotation = j.tsTypeAnnotation(convertToTSType(j, p.key));
    const value = j.tsTypeAnnotation(convertToTSType(j, p.value));

    return j.tsIndexSignature.from({
      parameters: [j.identifier.from({ name, typeAnnotation })],
      typeAnnotation: value
    });
  }
}

function convertQualifiedIdentifier(
  j: JSCodeshift,
  qid: QualifiedTypeIdentifier
) {
  const left =
    qid.qualification.type === "QualifiedTypeIdentifier"
      ? convertQualifiedIdentifier(j, qid.qualification)
      : qid.qualification;
  return j.tsQualifiedName.from({
    right: qid.id,
    left,
    comments: qid.comments || null
  });
}

function convertQualifiedToMember(
  j: JSCodeshift,
  qid: QualifiedTypeIdentifier
): MemberExpression {
  return j.memberExpression.from({
    comments: qid.comments || null,
    object:
      qid.qualification.type === "QualifiedTypeIdentifier"
        ? convertQualifiedToMember(j, qid.qualification)
        : qid.qualification,
    property: qid.id
  });
}

function convertToTSType(j: JSCodeshift, type: FlowTypeKind): TSTypeKind {
  if ((type as TSType).type.startsWith("TS")) {
    return type as any;
  }
  switch (type.type) {
    case "StringTypeAnnotation":
      return j.tsStringKeyword();
    case "BooleanTypeAnnotation":
      return j.tsBooleanKeyword();
    case "NumberTypeAnnotation":
      return j.tsNumberKeyword();
    case "NumberLiteralTypeAnnotation":
      return j.tsLiteralType(j.numericLiteral(type.value));
    case "StringLiteralTypeAnnotation":
      return j.tsLiteralType(j.stringLiteral(type.value));
    case "BooleanLiteralTypeAnnotation":
      return j.tsLiteralType(j.booleanLiteral(type.value));
    case "MixedTypeAnnotation":
      return j.tsUnknownKeyword();
    case "NullLiteralTypeAnnotation":
      return j.tsNullKeyword();
    case "VoidTypeAnnotation":
      return j.tsVoidKeyword();
    case "ArrayTypeAnnotation":
      return j.tsArrayType(convertToTSType(j, type.elementType));
    case "EmptyTypeAnnotation":
      return j.tsNeverKeyword();
    case "ExistsTypeAnnotation":
      return j.tsUnknownKeyword();
    case "TypeofTypeAnnotation":
      if (type.argument.type === "GenericTypeAnnotation") {
        const id = type.argument.id;
        if (id.type === "QualifiedTypeIdentifier") {
          return j.tsTypeQuery(convertQualifiedIdentifier(j, id));
        } else {
          return j.tsTypeQuery(id);
        }
      }
      console.warn(
        `Converting flow typeof. Expected Generic type. Got something else. dropping the typeof`,
        `got type ${type.argument.type} with keys: ${Object.keys(
          type.argument
        )}`
      );
      return convertToTSType(j, type.argument);
    case "TupleTypeAnnotation":
      return j.tsTupleType(type.types.map(t => convertToTSType(j, t)));
    case "NullableTypeAnnotation":
      let innerType = convertToTSType(j, type.typeAnnotation);
      return j.tsUnionType([innerType, j.tsNullKeyword()]);
    case "GenericTypeAnnotation":
      let id = type.id;
      if (id.type === "QualifiedTypeIdentifier") {
        if (
          id.qualification.type === "Identifier" &&
          id.qualification.name === "React"
        ) {
          if (id.id.name === "Node") {
            let T = null;
            if (type.typeParameters && type.typeParameters.params) {
              T = convertToTSType(j, type.typeParameters.params[0]);
            }

            return j.tsTypeReference.from({
              typeName: j.tsQualifiedName.from({
                left: id.qualification,
                right: j.identifier("ReactNode")
              }),
              typeParameters: T
                ? j.tsTypeParameterInstantiation.from({
                    params: [T]
                  })
                : null
            });
          }
        }
      }
      if (id.type === "Identifier") {
        // Handle special cases
        switch (id.name) {
          case "TimeoutID":
          case "IntervalID":
            return j.tsNumberKeyword();
          case "$Exact":
            return convertToTSType(j, type.typeParameters.params[0]);
          case "$Keys": {
            let t = convertToTSType(j, type.typeParameters.params[0]);
            return j.tsTypeOperator.from({
              typeAnnotation: t,
              operator: "keyof"
            });
          }
          case "SyntheticEvent": {
            return j.tsTypeReference.from({
              typeName: j.tsQualifiedName(
                j.identifier("React"),
                j.identifier("SyntheticEvent")
              )
            });
          }
          case "SyntheticMouseEvent":
          case "SyntheticKeyboardEvent":
            return j.tsTypeReference.from({
              typeName: j.tsQualifiedName(
                j.identifier("React"),
                j.identifier(id.name.replace("Synthetic", ""))
              )
            });
          case "$PropertyType":
          case "$ElementType": {
            let obj = convertToTSType(j, type.typeParameters.params[0]);
            let index = convertToTSType(j, type.typeParameters.params[1]);
            return j.tsIndexedAccessType.from({
              indexType: index,
              objectType: obj
            });
          }
          case "$Rest":
          case "$Diff": {
            let T = convertToTSType(j, type.typeParameters.params[0]);
            let U = convertToTSType(j, type.typeParameters.params[1]);
            return j.tsTypeReference.from({
              typeName: j.identifier("Exclude"),
              typeParameters: j.tsTypeParameterInstantiation.from({
                params: [T, U]
              })
            });
          }
          case "$ReadOnlyArray": {
            let T = convertToTSType(j, type.typeParameters.params[0]);
            return j.tsTypeReference.from({
              typeName: j.identifier("ReadonlyArray"),
              typeParameters: j.tsTypeParameterInstantiation.from({
                params: [T]
              })
            });
          }
          case "$Values": {
            let t = convertToTSType(j, type.typeParameters.params[0]);
            let tsKeyOf = j.tsTypeOperator.from({
              typeAnnotation: t,
              operator: "keyof"
            });
            return j.tsIndexedAccessType.from({
              indexType: tsKeyOf,
              objectType: t
            });
          }
          case "$ReadOnly": {
            let t = convertToTSType(j, type.typeParameters.params[0]);
            if (t.type === "TSTypeLiteral") {
              t.members
                .filter(m => "TSPropertySignature")
                .forEach((m: TSPropertySignature) => {
                  m.readonly = true;
                });
            }

            return t;
          }
          case "$Call": {
            const t = convertToTSType(j, type.typeParameters.params[0]);
            return j.tsTypeReference.from({
              typeName: j.identifier("ReturnType"),
              typeParameters: j.tsTypeParameterInstantiation.from({
                params: [t]
              })
            });
          }
        }
      }
      let typeArgs = type.typeParameters;
      let tsTypeArgs = null;
      if (typeArgs && typeArgs.params.length) {
        tsTypeArgs = j.tsTypeParameterInstantiation(
          typeArgs.params.map(t => convertToTSType(j, t)).filter(t => !!t)
        );
      }
      let newId =
        id.type === "QualifiedTypeIdentifier"
          ? convertQualifiedIdentifier(j, id)
          : id;
      return j.tsTypeReference.from({
        comments: type.comments || null,
        typeName: newId,
        typeParameters: tsTypeArgs
      });
    case "UnionTypeAnnotation": {
      let types = type.types.map(t => convertToTSType(j, t));
      return j.tsUnionType(types);
    }
    case "IntersectionTypeAnnotation": {
      let types = type.types.map(t => convertToTSType(j, t));
      return j.tsIntersectionType(types);
    }
    case "AnyTypeAnnotation": {
      return j.tsAnyKeyword();
    }
    case "ObjectTypeAnnotation":
      if (type.indexers && type.indexers.length) {
        if (type.indexers.length > 1) {
          console.warn("Not handling more than 1 indexer in mapped type");
        }
        return convertIndexedToMappedType(j, type.indexers[0]);
      }

      const spreads = type.properties
        .filter(p => p.type === "ObjectTypeSpreadProperty")
        .map((p: ObjectTypeSpreadProperty) => convertToTSType(j, p.argument));

      const tsMembers: Array<TSPropertySignature | TSIndexSignature> = [];
      tsMembers.push(
        ...type.properties
          .filter(p => p.type === "ObjectTypeProperty")
          .map(p => convertPropertiesToTsProperties(j, p as ObjectTypeProperty))
      );

      tsMembers.push(
        ...type.indexers.map(i => convertPropertiesToTsProperties(j, i))
      );

      const tsType = j.tsTypeLiteral(tsMembers);
      if (spreads.length) {
        return j.tsIntersectionType([tsType, ...spreads]);
      }

      return tsType;
    case "FunctionTypeAnnotation":
      const parameters = convertFunctionParams(j, type);
      const tsReturn = j.tsTypeAnnotation(convertToTSType(j, type.returnType));
      const typeParameters = convertTypeParameters(j, type.typeParameters);

      return j.tsFunctionType.from({
        parameters,
        typeAnnotation: tsReturn,
        typeParameters
      });
  }
  throw new Error(
    `Unhandled case for ${type.type} at ${JSON.stringify(
      type.loc && type.loc.start
    )}`
  );
}

function convertTypeAnnotation(
  j: JSCodeshift,
  t: TypeAnnotation
): TSTypeAnnotation {
  return j.tsTypeAnnotation.from({
    typeAnnotation: convertToTSType(j, t.typeAnnotation)
  });
}

function convertTypeParameter(
  j: JSCodeshift,
  parameter: TypeParameter
): TSTypeParameter {
  return j.tsTypeParameter.from({
    name: parameter.name,
    default: (parameter as any).default
      ? convertToTSType(j, (parameter as any).default)
      : null,
    constraint: parameter.bound
      ? convertToTSType(j, parameter.bound.typeAnnotation)
      : null
  });
}

function convertTypeParameters(
  j: JSCodeshift,
  typeParams: TypeParameterDeclaration
): TSTypeParameterDeclaration | null {
  const params =
    typeParams && typeParams.params.map(p => convertTypeParameter(j, p));
  return params ? j.tsTypeParameterDeclaration.from({ params }) : null;
}

function convertRestParams(j: JSCodeshift, rest: FunctionTypeParam | null) {
  if (rest) {
    return j.restElement.from({
      argument: rest.name || j.tsTypeParameter("args"),
      typeAnnotation: j.tsTypeAnnotation(
        convertToTSType(j, rest.typeAnnotation)
      )
    });
  }
}

function convertFunctionParam(
  j: JSCodeshift,
  typeParam: FunctionTypeParam,
  index: number
): Identifier {
  const optional = typeParam.optional;
  const typeAnnotation = j.tsTypeAnnotation(
    convertToTSType(j, typeParam.typeAnnotation)
  );

  const paramName = typeParam.name
    ? typeParam.name.name
    : typeParam.typeAnnotation.type === "GenericTypeAnnotation" &&
      typeParam.typeAnnotation.id.type === "Identifier"
    ? lowerCaseFirst(typeParam.typeAnnotation.id.name)
    : `arg${index}`;

  let tsParam = j.identifier(paramName);
  tsParam.typeAnnotation = typeAnnotation;
  tsParam.optional = optional;
  return tsParam;
}

type TSFParam = Identifier | RestElement;
function convertFunctionParams(
  j: JSCodeshift,
  f: FunctionTypeAnnotation
): TSFParam[] {
  const params: TSFParam[] = f.params.map((p, i) =>
    convertFunctionParam(j, p, i)
  );
  if (f.rest) {
    params.push(convertRestParams(j, f.rest));
  }
  return params;
}

// Mutates collection
export function transformIdentifiers(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.Identifier).forEach(path => {
    if (path.node.typeAnnotation) {
      let tsType = convertToTSType(j, path.node.typeAnnotation
        .typeAnnotation as FlowTypeKind);
      if (tsType) {
        path.node.typeAnnotation.typeAnnotation = tsType;
      }
    }
  });
}

export function transformImports(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.ImportDeclaration).forEach(path => {
    if (path.node.importKind === "type") {
      path.node.importKind = null;
    }
  });

  collection.find(j.ImportSpecifier).forEach(path => {
    // Issue with type
    let node = path.node as any;
    if (node.importKind === "type") {
      path.parentPath.node.importKind = null;
    }
  });
}

export function transformExports(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.ExportNamedDeclaration).forEach(path => {
    if ((path.node as any).exportKind === "type") {
      (path.node as any).exportKind = null;
    }
  });
}

export function transfromTypeAnnotations(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.TypeAnnotation).forEach(path => {
    j(path).replaceWith(convertTypeAnnotation(j, path.node));
  });
}

export function transformFunctionTypes(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.FunctionTypeAnnotation).forEach(path => {
    j(path).replaceWith(convertToTSType(j, path.node));
  });
}

export function transformTypeAliases(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  const visitor = (
    path: NodePath<TypeAlias | OpaqueType, TypeAlias | OpaqueType>
  ) => {
    const node = path.node;
    const flowType = node.type === "TypeAlias" ? node.right : node.impltype;
    const tsTypeAnnotation = convertToTSType(j, flowType);
    const typeParameters = convertTypeParameters(j, node.typeParameters);

    const typeAlias = j.tsTypeAliasDeclaration.from({
      id: node.id,
      typeAnnotation: tsTypeAnnotation,
      typeParameters
    });

    j(path).replaceWith(typeAlias);
  };

  collection.find(j.TypeAlias).forEach(visitor);
  collection.find(j.OpaqueType).forEach(visitor);
}

const stripLoc = (o: any) =>
  o && typeof o === "object"
    ? Object.keys(o).reduce(
        (acc, k) => (k === "loc" ? acc : { ...acc, [k]: stripLoc(o[k]) }),
        {}
      )
    : o;

export function transformInterfaces(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.InterfaceDeclaration).forEach(path => {
    // Bug in this find??
    if ((path.node as any).type === "DeclareClass") {
      return;
    }
    const body = j.tsInterfaceBody(
      path.node.body.properties.map(p =>
        convertPropertiesToTsProperties(j, p as ObjectTypeProperty)
      )
    );
    const id = path.node.id;
    const typeParameters = convertTypeParameters(j, path.node.typeParameters);

    const tsInterface = j.tsInterfaceDeclaration.from({
      id,
      typeParameters,
      body
    });

    j(path).replaceWith(tsInterface);
  });
}

export function transformTypeCastings(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.TypeCastExpression).forEach(path => {
    const asExp = j.tsAsExpression.from({
      expression: path.node.expression,
      typeAnnotation: convertToTSType(
        j,
        path.node.typeAnnotation.typeAnnotation
      )
    });

    j(path).replaceWith(asExp);
  });
}

export function transformDeclaration(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.DeclareVariable).forEach(path => {
    const id = path.node.id;
    const declaration = j.variableDeclaration.from({
      declarations: [
        j.variableDeclarator.from({
          id,
          init: null
        })
      ],
      kind: "const"
    });

    // TODO bug with recast type
    (declaration as any).declare = true;
    j(path).replaceWith(declaration);
  });
  collection.find(j.DeclareFunction).forEach(path => {
    if (
      path.node.id.typeAnnotation.typeAnnotation.type !==
      "FunctionTypeAnnotation"
    ) {
      throw Error(
        `Unhandled declaration ${path.node.type} at ${JSON.stringify(
          path.node.loc.start
        )}`
      );
    }
    const dNode = path.node;
    const functionName = dNode.id.name;
    const flowFunctionType: FunctionTypeAnnotation = dNode.id.typeAnnotation
      .typeAnnotation as FunctionTypeAnnotation;
    const typeParameters = convertTypeParameters(
      j,
      flowFunctionType.typeParameters
    );
    const params: PatternKind[] = convertFunctionParams(j, flowFunctionType);

    const returnType = convertToTSType(j, flowFunctionType.returnType);

    const declaration = j.tsDeclareFunction.from({
      declare: true,
      id: j.identifier(functionName),
      params,
      returnType: returnType ? j.tsTypeAnnotation(returnType) : null,
      typeParameters
    });
    j(path).replaceWith(declaration);
  });
  collection.find(j.DeclareClass).forEach(path => {
    const id = path.node.id;
    let superClass = null;
    let superTypeParameters = null;
    if (path.node.extends && path.node.extends.length) {
      if (path.node.extends.length > 1) {
        console.warn(
          "TS doesn't support multiple super types for extensions",
          JSON.stringify(path.node.loc && path.node.loc.start)
        );
      }

      const _superId = path.node.extends[0].id;
      superClass =
        (_superId.type as any) === "QualifiedTypeIdentifier"
          ? convertQualifiedToMember(j, _superId as any)
          : _superId;
      superTypeParameters = path.node.extends[0].typeParameters;
    }
    let typeParameters =
      path.node.typeParameters &&
      path.node.typeParameters.type === "TypeParameterDeclaration"
        ? convertTypeParameters(j, path.node.typeParameters)
        : path.node.typeParameters || null;

    const declaration = j.classDeclaration.from({
      id,
      body: j.classBody([]),
      superClass,
      superTypeParameters,
      typeParameters
    });

    // TODO bug with recast type
    (declaration as any).declare = true;
    j(path).replaceWith(declaration);
  });
  collection.find(j.DeclareExportDeclaration).forEach(path => {
    // Check if this is a default export
    if (path.node.default) {
      if (path.node.declaration.hasOwnProperty("id")) {
        // @ts-ignore
        path.insertAfter(j.exportDefaultDeclaration(path.node.declaration.id));
        path.replace(path.node.declaration);
        return;
      }
    }

    switch (path.node.declaration.type as any) {
      case "TSDeclareFunction":
      case "VariableDeclaration":
        j(path).replaceWith(
          j.exportNamedDeclaration.from({
            declaration: path.node.declaration as any
          })
        );
        return;
      case "ClassDeclaration":
        j(path).replaceWith(
          j.exportNamedDeclaration.from({
            declaration: path.node.declaration as any
          })
        );
        return;
      default:
        throw Error(
          `Unhandled declaration ${
            path.node.declaration.type
          } at ${JSON.stringify(path.node.loc && path.node.loc.start)}`
        );
    }
  });
}

export function transformTypeParamInstantiation(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.TypeParameterInstantiation).forEach(path => {
    j(path).replaceWith(path => {
      const params = path.node.params.map(t => convertToTSType(j, t));
      return j.tsTypeParameterInstantiation(params);
    });
  });
}

export function transformNullCoalescing(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  const visitor = (node: ExpressionKind, firstTime: boolean) => {
    if (!node || node.type !== "LogicalExpression" || node.operator !== "??") {
      return node;
    }

    let { left, right } = node;
    left = visitor(left, false);
    right = visitor(right, false);
    const nullCheck = j.binaryExpression.from({
      operator: "!==",
      left,
      right: j.literal(null)
    });
    const undefinedCheck = j.binaryExpression.from({
      operator: "!==",
      left,
      right: j.identifier("undefined")
    });
    const bothChecks = j.logicalExpression.from({
      operator: "&&",
      left: nullCheck,
      right: undefinedCheck
    });

    const ternary = j.conditionalExpression.from({
      comments: firstTime
        ? [j.commentLine(" Auto generated from flowToTs. Please clean me!")]
        : null,
      test: bothChecks,
      consequent: left,
      alternate: right
    });

    return ternary;
  };

  const visitorOptionalMember = (node: ExpressionKind, firstTime: boolean) => {
    if (node.type !== "OptionalMemberExpression") {
      return node;
    }

    let left = node.object;
    let right = node.property;
    left = visitorOptionalMember(left, false);
    right = visitorOptionalMember(right, false);
    const nullCheck = j.binaryExpression.from({
      operator: "===",
      left,
      right: j.literal(null)
    });
    const undefinedCheck = j.binaryExpression.from({
      operator: "===",
      left,
      right: j.identifier("undefined")
    });
    const bothChecks = j.logicalExpression.from({
      operator: "||",
      left: nullCheck,
      right: undefinedCheck
    });

    const ternary = j.conditionalExpression.from({
      comments: firstTime
        ? [j.commentLine(" Auto generated from flowToTs. Please clean me!")]
        : null,
      test: bothChecks,
      consequent: j.identifier("undefined"),
      alternate: j.memberExpression(left, right)
    });

    return ternary;
  };

  collection.find(j.LogicalExpression).replaceWith(p => visitor(p.node, true));
  collection
    .find(j.OptionalMemberExpression)
    .replaceWith(p => visitorOptionalMember(p.node, true));
}

export function transformTypeParameters(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection
    .find(j.TypeParameterDeclaration)
    .replaceWith(p => convertTypeParameters(j, p.node));
}

export const allTransformations = [
  transformNullCoalescing,
  transformDeclaration,
  transfromTypeAnnotations,
  transformFunctionTypes,
  transformIdentifiers,
  transformImports,
  transformInterfaces,
  transformTypeCastings,
  transformTypeAliases,
  transformExports,
  transformTypeParamInstantiation,
  transformTypeParameters
];

const transformer: Transform = function(
  file: FileInfo,
  api: API,
  options: Options
): string | null {
  const j = api.jscodeshift.withParser("flow");
  const collection = j(file.source);

  allTransformations.forEach(transformation => transformation(collection, j));

  let transformedSource = collection.toSource();
  transformedSource = transformedSource.replace(/^\/\/ ?@flow.*\n/, "");

  return transformedSource;
};

export default transformer;
