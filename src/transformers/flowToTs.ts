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
  RestElement
} from "jscodeshift";
import { Node } from "ast-types/gen/nodes";
import { FlowTypeKind, TSTypeKind, PatternKind } from "ast-types/gen/kinds";
import { Collection } from "jscodeshift/src/Collection";
import { NodePath } from "recast";
import { jsxClosingElement } from "@babel/types";

const lowerCaseFirst = (s: string) => s.replace(/^(.)/, m => m.toLowerCase());

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
    case "VoidTypeAnnotation":
      // return jts.tsUnionType([jts.tsNullKeyword(), jts.tsVoidKeyword()]);
      return j.tsNullKeyword();
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
            let T = convertToTSType(j, type.typeParameters.params[0]);
            return j.tsTypeReference.from({
              typeName: j.tsQualifiedName.from({
                left: id.qualification,
                right: j.identifier("ElementType")
              }),
              typeParameters: j.tsTypeParameterInstantiation.from({
                params: [T]
              })
            });
          }
        }
      }
      if (id.type === "Identifier") {
        // Handle special cases
        switch (id.name) {
          case "$Exact":
            return convertToTSType(j, type.typeParameters.params[0]);
          case "$Keys": {
            let t = convertToTSType(j, type.typeParameters.params[0]);
            return j.tsTypeOperator.from({
              typeAnnotation: t,
              operator: "keyof"
            });
          }
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
              typeName: j.identifier("ReadOnlyArray"),
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
        tsTypeArgs = typeArgs.params
          .map(t => convertToTSType(j, t))
          .filter(t => !!t);
      }
      try {
        if (id.type === "Identifier") {
          return j.tsTypeReference(
            j.identifier(id.name),
            tsTypeArgs ? j.tsTypeParameterInstantiation(tsTypeArgs) : null
          );
        }
      } catch (e) {
        throw Error(
          `Unhandled Identifier type ${type.type}, id: ${id.type}
         at ${JSON.stringify(type.loc && type.loc.start)}`
        );
      }

      if (id.type === "QualifiedTypeIdentifier") {
        return j.tsTypeReference.from({
          typeName: convertQualifiedIdentifier(j, id)
        });
      }

      throw Error(
        `Unhandled Identifier type ${type.type}, id: ${id.type}
         at ${JSON.stringify(type.loc && type.loc.start)}`
      );
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
      argument: rest.name,
      typeAnnotation: j.tsTypeAnnotation(
        convertToTSType(j, rest.typeAnnotation)
      )
    });
  }
}

function convertFunctionParam(
  j: JSCodeshift,
  typeParam: FunctionTypeParam
): Identifier {
  let argCounter = 0;
  const optional = typeParam.optional;
  const typeAnnotation = j.tsTypeAnnotation(
    convertToTSType(j, typeParam.typeAnnotation)
  );

  const paramName = typeParam.name
    ? typeParam.name.name
    : typeParam.typeAnnotation.type === "GenericTypeAnnotation" &&
      typeParam.typeAnnotation.id.type === "Identifier"
    ? lowerCaseFirst(typeParam.typeAnnotation.id.name)
    : `arg${argCounter++}`;

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
  const params: TSFParam[] = f.params.map(p => convertFunctionParam(j, p));
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

export function transformInterfaces(
  collection: Collection<any>,
  j: JSCodeshift,
  options?: Options
) {
  collection.find(j.InterfaceDeclaration).forEach(path => {
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
      kind: "var"
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
  collection.find(j.DeclareExportDeclaration).forEach(path => {
    switch (path.node.declaration.type as any) {
      case "TSDeclareFunction":
      case "VariableDeclaration":
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

const transformer: Transform = function(
  file: FileInfo,
  api: API,
  options: Options
): string | null {
  const j = api.jscodeshift.withParser("flow");
  const collection = j(file.source);

  const transformations = [
    transformDeclaration,
    transfromTypeAnnotations,
    transformFunctionTypes,
    transformIdentifiers,
    transformImports,
    transformInterfaces,
    transformTypeCastings,
    transformTypeAliases,
    transformExports,
    transformTypeParamInstantiation
  ];

  transformations.forEach(transformation => transformation(collection, j));

  let transformedSource = collection.toSource();
  transformedSource = transformedSource.replace(/^\/\/ ?@flow.*\n/, "");

  return transformedSource;
};

export default transformer;