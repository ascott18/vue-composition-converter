import ts from "typescript";

// export const SetupPropType = {
//   ref: 'ref',
//   computed: 'computed',
//   reactive: 'reactive',
//   method: 'method',
//   watch: 'watch',
//   lifecycle: 'lifecycle',
// } as const

export type ConvertedExpression = {
  expression: string;
  returnNames?: string[];
  use?: string;
  order: number;
};

export const lifecycleNameMap: Map<string, string | undefined> = new Map([
  ["beforeCreate", undefined],
  ["created", undefined],
  ["beforeMount", "onBeforeMount"],
  ["mounted", "onMounted"],
  ["beforeUpdate", "onBeforeUpdate"],
  ["updated", "onUpdated"],
  ["beforeUnmount", "onBeforeUnmount"],
  ["beforeDestroy", "onBeforeUnmount"],
  ["destroyed", "onUnmounted"],
  ["errorCaptured", "onErrorCaptured"],
  ["renderTracked", "onRenderTracked"],
  ["renderTriggered", "onRenderTriggered"],
]);

export const nonNull = <T>(item: T): item is NonNullable<T> => item != null;

export const getNodeByKind = (
  node: ts.Node,
  kind: ts.SyntaxKind
): ts.Node | undefined => {
  const find = (node: ts.Node): ts.Node | undefined => {
    return ts.forEachChild(node, (child) => {
      if (child.kind === kind) {
        return child;
      }
      return find(child);
    });
  };
  return find(node);
};

export const getInitializerProps = (
  node: ts.Node
): ts.ObjectLiteralElementLike[] => {
  if (!ts.isPropertyAssignment(node)) return [];
  if (!ts.isObjectLiteralExpression(node.initializer)) return [];
  return [...node.initializer.properties];
};

export const storePath = `this.$store`;

export const getMethodExpression = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): ConvertedExpression[] => {
  if (ts.isMethodDeclaration(node)) {
    const async = node.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
    )
      ? "async "
      : "";

    const name = node.name.getText(sourceFile);
    const type = node.type ? `:${node.type.getText(sourceFile)}` : "";
    const body = node.body?.getText(sourceFile) || "{}";
    const parameters = node.parameters
      .map((param) => param.getText(sourceFile))
      .join(",");

    if (lifecycleNameMap.has(name)) {
      const newLifecycleName = lifecycleNameMap.get(name);
      const immediate = newLifecycleName == null ? "()" : "";
      return [
        {
          use: newLifecycleName,
          expression: `${
            newLifecycleName ?? ""
          }(${async}(${parameters})${type} =>${body})${immediate}`,
        },
      ];
    }
    return [
      {
        returnNames: [name],
        expression: `${async}function ${name} (${parameters})${type} ${body}`,
      },
    ];
  } else if (ts.isSpreadAssignment(node)) {
    // mapActions
    if (!ts.isCallExpression(node.expression)) return [];
    const { arguments: args, expression } = node.expression;
    if (!ts.isIdentifier(expression)) return [];
    const mapName = expression.text;
    const [namespace, mapArray] = args;
    if (!ts.isStringLiteral(namespace)) return [];
    if (!ts.isArrayLiteralExpression(mapArray)) return [];

    const namespaceText = namespace.text;
    const names = mapArray.elements as ts.NodeArray<ts.StringLiteral>;

    if (mapName === "mapActions") {
      return names.map(({ text: name }) => {
        return {
          expression: `const ${name} = () => ${storePath}.dispatch('${namespaceText}/${name}')`,
          returnNames: [name],
        };
      });
    }
  }
  return [];
};

const contextProps = [
  "attrs",
  "slots",
  "parent",
  "root",
  "listeners",
  "refs",
  "emit",
];

export const replaceThisContext = (
  str: string,
  refNameMap: Map<string, true>,
  componentPropNames?: string[]
) => {
  return str
    .replace(/this\.\$(\w+)/g, (_, p1) => {
      if (contextProps.includes(p1)) return `ctx.${p1}`;
      return `ctx.root.$${p1}`;
    })
    .replace(/this\.([\w-]+)/g, (_, p1) => {
      return refNameMap.has(p1)
        ? `${p1}.value`
        : componentPropNames?.includes(p1)
        ? `props.${p1}`
        : p1;
    });
};

export const getImportStatement = (setupProps: ConvertedExpression[]) => {
  const usedFunctions = [
    ...new Set(setupProps.map(({ use }) => use).filter(nonNull)),
  ];
  return ts.createSourceFile(
    "",
    `import { ${usedFunctions.join(",")} } from 'vue'`,
    ts.ScriptTarget.Latest
  ).statements;
};

export const getExportStatement = (
  setupProps: ConvertedExpression[],
  propNames: string[],
  otherProps: ts.ObjectLiteralElementLike[]
) => {
  const propsArg = propNames.length === 0 ? "_props" : `props`;

  const setupArgs = [propsArg, "ctx"].map((name) =>
    ts.factory.createParameterDeclaration(undefined, undefined, undefined, name)
  );

  const setupMethod = ts.factory.createMethodDeclaration(
    undefined,
    undefined,
    undefined,
    "setup",
    undefined,
    undefined,
    setupArgs,
    undefined,
    ts.factory.createBlock(
      ts.createSourceFile(
        "",
        getSetupStatements(setupProps),
        ts.ScriptTarget.Latest
      ).statements
    )
  );

  return ts.factory.createExportAssignment(
    undefined,
    undefined,
    undefined,
    ts.factory.createCallExpression(
      ts.factory.createIdentifier("defineComponent"),
      undefined,
      [ts.factory.createObjectLiteralExpression([...otherProps, setupMethod])]
    )
  );
};

export const getSetupStatements = (
  setupProps: ConvertedExpression[],
  componentPropNames?: string[]
) => {
  // this.prop => prop.valueにする対象
  const refNameMap: Map<string, true> = new Map();
  setupProps.forEach(({ use, returnNames }) => {
    if (
      returnNames != null &&
      use != null &&
      /^(toRefs|ref|computed)$/.test(use)
    ) {
      returnNames.forEach((returnName) => {
        refNameMap.set(returnName, true);
      });
    }
  });

  return setupProps
    .map(
      (p) =>
        replaceThisContext(p.expression, refNameMap, componentPropNames)
    )
    .join("");
};
