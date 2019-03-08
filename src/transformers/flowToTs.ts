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
  ObjectTypeSpreadProperty
} from "jscodeshift";
import { Node } from "ast-types/gen/nodes";
import { FlowTypeKind, TSTypeKind } from "ast-types/gen/kinds";
import { Collection } from "jscodeshift/src/Collection";
import { NodePath } from "recast";

const lowerCaseFirst = (s: string) => s.replace(/^(.)/, m => m.toLowerCase());

function convertPropertiesToTsProperties(
  j: JSCodeshift,
  p: ObjectTypeProperty | ObjectTypeIndexer
): TSPropertySignature | TSIndexSignature {
  if (p.type == "ObjectTypeProperty") {
    const tsType = convertToTSType(j, p.value);
    if (tsType) {
      const typeAnnotation = j.tsTypeAnnotation(tsType);

      const key = j.identifier((p.key as Identifier).name);
      return j.tsPropertySignature.from({
        key,
        typeAnnotation,
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

function convertToTSType(j: JSCodeshift, type: FlowTypeKind): TSTypeKind {
  switch (type.type) {
    case "StringTypeAnnotation":
      return j.tsStringKeyword();
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
    case "NullableTypeAnnotation":
      let innerType = convertToTSType(j, type.typeAnnotation);
      return j.tsUnionType([innerType, j.tsNullKeyword()]);
    case "GenericTypeAnnotation":
      let id = type.id;
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
          case "$REST":
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
      if (id.type === "Identifier") {
        return j.tsTypeReference(
          j.identifier(id.name),
          tsTypeArgs ? j.tsTypeParameterInstantiation(tsTypeArgs) : null
        );
      }

      throw Error("Unhandled Identifier type");
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
      const tsParams = type.params.map(t => convertFunctionTypeParam(j, t));
      const tsReturn = j.tsTypeAnnotation(convertToTSType(j, type.returnType));
      const tsFn = j.tsFunctionType(tsParams);
      tsFn.typeAnnotation = tsReturn;
      return tsFn;
  }
  throw new Error(`Unhandled case for ${type.type}`);
}

function convertTypeParameter(
  j: JSCodeshift,
  parameter: TypeParameter
): TSTypeParameter {
  return j.tsTypeParameter(
    parameter.name,
    parameter.bound && convertToTSType(j, parameter.bound.typeAnnotation)
  );
}

function convertFunctionTypeParam(
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
        let tsTypeAnnotation = j.tsTypeAnnotation(tsType);
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
    const tsTypeParams = node.typeParameters
      ? node.typeParameters.params.map(param => convertTypeParameter(j, param))
      : null;

    const typeAlias = j.tsTypeAliasDeclaration.from({
      id: node.id,
      typeAnnotation: tsTypeAnnotation,
      typeParameters: tsTypeParams && j.tsTypeParameterDeclaration(tsTypeParams)
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
    const typeParameters = path.node.typeParameters
      ? j.tsTypeParameterDeclaration(
          path.node.typeParameters.params.map(p => convertTypeParameter(j, p))
        )
      : null;

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

const transformer: Transform = function(
  file: FileInfo,
  api: API,
  options: Options
): string | null {
  const j = api.jscodeshift.withParser("flow");
  const jts = api.jscodeshift.withParser("ts");

  let transformedSource = j(file.source)
    .find(j.Identifier)
    .forEach(path => {
      if (path.node.typeAnnotation) {
        let tsType = convertToTSType(j, path.node.typeAnnotation
          .typeAnnotation as FlowTypeKind);
        if (tsType) {
          let tsTypeAnnotation = j.tsTypeAnnotation(tsType);
          path.node.typeAnnotation.typeAnnotation = tsType;
        }
      }
    })
    .toSource();

  transformedSource = transformedSource.replace(/^\/\/ @flow.*\n/, "");

  return transformedSource;
};

export default transformer;
