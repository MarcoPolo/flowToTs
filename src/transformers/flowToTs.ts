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
  Identifier
} from "jscodeshift";
import { Node } from "ast-types/gen/nodes";
import { FlowTypeKind, TSTypeKind } from "ast-types/gen/kinds";
import { Collection } from "jscodeshift/src/Collection";

function convertToTSType(
  jts: JSCodeshift,
  type: FlowTypeKind
): TSTypeKind | null {
  switch (type.type) {
    case "StringTypeAnnotation":
      return jts.tsStringKeyword();
    case "NumberTypeAnnotation":
      return jts.tsNumberKeyword();
    case "NumberLiteralTypeAnnotation":
      return jts.tsLiteralType(jts.numericLiteral(type.value));
    case "StringLiteralTypeAnnotation":
      return jts.tsLiteralType(jts.stringLiteral(type.value));
    case "BooleanLiteralTypeAnnotation":
      return jts.tsLiteralType(jts.booleanLiteral(type.value));
    case "MixedTypeAnnotation":
      return jts.tsUnknownKeyword();
    case "NullLiteralTypeAnnotation":
    case "VoidTypeAnnotation":
      // return jts.tsUnionType([jts.tsNullKeyword(), jts.tsVoidKeyword()]);
      return jts.tsNullKeyword();
    case "NullableTypeAnnotation":
      let innerType = convertToTSType(jts, type.typeAnnotation);
      return jts.tsUnionType([innerType, jts.tsNullKeyword()]);
    case "GenericTypeAnnotation":
      let id = type.id;
      let typeArgs = type.typeParameters;
      let tsTypeArgs = null;
      if (typeArgs && typeArgs.params.length) {
        tsTypeArgs = typeArgs.params
          .map(t => convertToTSType(jts, t))
          .filter(t => !!t);
      }
      if (id.type === "Identifier") {
        return jts.tsTypeReference(
          jts.identifier(id.name),
          tsTypeArgs ? jts.tsTypeParameterInstantiation(tsTypeArgs) : null
        );
      }

      // TODO
      return null;
    case "ObjectTypeAnnotation":
      let tsMembers = type.properties.map(p => {
        if (p.type == "ObjectTypeProperty") {
          let tsType = convertToTSType(jts, p.value);
          if (tsType) {
            let tsTypeAnnotation = jts.tsTypeAnnotation(tsType);

            let identifier = jts.identifier((p.key as Identifier).name);
            let propertySig = jts.tsPropertySignature(identifier);
            propertySig.typeAnnotation = tsTypeAnnotation;
            return propertySig;
          }
        }

        // TODO handle spread case
        return null;
      });

      return jts.tsTypeLiteral(tsMembers);
  }
  return null;
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
