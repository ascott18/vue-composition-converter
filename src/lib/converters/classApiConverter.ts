import ts, { isPropertyAssignment } from "typescript";
import {
  ConvertedExpression,
  getExportStatement,
  getImportStatement,
  getSetupStatements,
  lifecycleNameMap,
} from "../helper";
import { convertOptions } from "./options/optionsConverter";

export const convertClass = (
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
) => {
  const options = convertOptions(sourceFile);

  const { setupProps, propNames, otherProps } = options || {
    setupProps: [],
    propNames: [],
    otherProps: [],
  };

  const classProps = parseClassNode(classNode, sourceFile);

  const dataProps: ConvertedExpression[] = Array.from(
    classProps.dataMap.entries()
  ).map(([key, val]) => {
    const { type, initializer } = val;
    
    return {
      use: "ref",
      returnNames: [key],
      expression: `${val.comments}const ${key} = ref${
        type ? `<${type}>` : ""
      }(${initializer === undefined ? "" : initializer});`,
      order: val.order,
    };
  });

  const computedProps: ConvertedExpression[] = Array.from(
    classProps.getterMap.entries()
  ).map(([key, val]) => {
    const { typeName, block } = val;
    if (classProps.setterMap.has(key)) {
      const setter = classProps.setterMap.get(key);

      return {
        use: "computed",
        expression: `${val.comments}${setter.comments}const ${key} = computed({
            get()${typeName} ${block},
            set(${setter.parameters}) ${setter.block}
          });`,
        returnNames: [key],
        order: val.order,
      };
    }
    return {
      use: "computed",
      expression: `${val.comments}const ${key} = computed(()${typeName} => ${block});`,
      returnNames: [key],
      order: val.order,
    };
  });

  const methodsProps: ConvertedExpression[] = Array.from(
    classProps.methodsMap.entries()
  ).map(([key, val]) => {
    const { async, type, body, parameters } = val;
    
    return {
      expression: `${val.comments}${async} function ${key}(${parameters})${type} ${body} `,
      returnNames: [key],
      order: val.order,
    };
  });

  const watchProps: ConvertedExpression[] = Array.from(
    classProps.watchMap.entries()
  ).map(([key, val]) => {
    const { callback, options } = val;
    return {
      use: "watch",
      expression: `watch(${[key, callback, options]
        .filter((item) => item != null)
        .join(",")});`,
      order: val.order,
    };
  });

  const lifecycleProps: ConvertedExpression[] = Array.from(
    classProps.lifecycleMap.entries()
  ).map(([key, val]) => {
    const newLifecycleName = lifecycleNameMap.get(key);
    const { async, body, parameters, type } = val;

    const fn = `${async}(${parameters})${type} =>${body}`;
    const immediate = newLifecycleName == null ? "()" : "";

    return {
      use: newLifecycleName,
      expression: `${val.comments}${newLifecycleName ?? ""}(${fn})${immediate};`,
      order: val.order,
    };
  });
  propNames.push(...Array.from(classProps.propsMap.keys()));

  setupProps.push(
    ...[
      ...dataProps,
      ...computedProps,
      ...methodsProps,
      ...watchProps,
      ...lifecycleProps,
    ].sort((a, b) => a.order - b.order)
  );

  if (classProps.componentProps.length) {
    let defineProps = `defineProps<{${classProps.componentProps
      .map((p) => `${p.comments.trimStart()}${p.name}: ${p.tsType}`)
      .join(";\n")}}>()`;

    const defaults = classProps.componentProps.filter((p) => p.default);
    if (defaults.length) {
      defineProps = `withDefaults(${defineProps}, {${defaults
        .map((p) => `${p.name}: ${p.default}`)
        .join(",\n")}})`;
    }
    defineProps = "\nconst props = " + defineProps + "\n";

    setupProps.unshift({
      expression: defineProps,
      order: 0,
    });
  }

  const newSrc = ts.factory.createSourceFile(
    [
      // Import statement excluded, assuming use of unplugin-auto-import
      // ...getImportStatement([
      //   ...setupProps,
      //   ...Array.from(classProps.propsMap.values()).map((prop) => {
      //     return {
      //       expression: "",
      //       use: prop.use,
      //     };
      //   }),
      // ]),
      ...sourceFile.statements.filter(
        (state) =>
          !ts.isClassDeclaration(state) &&
          (!ts.isImportDeclaration(state) ||
            !ts.isStringLiteral(state.moduleSpecifier) ||
            !["vue-class-component", "vue-property-decorator"].includes(
              state.moduleSpecifier.text
            ))
      ),
    ],
    sourceFile.endOfFileToken,
    sourceFile.flags
  );
  const printer = ts.createPrinter({ removeComments: false });
  const ret = printer.printFile(newSrc);

  return (
    ret +
    getSetupStatements(
      setupProps,
      classProps.componentProps.map((p) => p.name)
    )
  );
};

const parseClassNode = (
  classNode: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
) => {
  const propsMap: Map<
    string,
    { use?: string; node: ts.ObjectLiteralExpression }
  > = new Map();
  const componentProps: {
    name: string;
    tsType?: string;
    default?: string;
    comments: string;
  }[] = [];
  const dataMap: Map<string, any> = new Map();
  const getterMap: Map<string, any> = new Map();
  const setterMap: Map<string, any> = new Map();
  const methodsMap: Map<string, any> = new Map();
  const watchMap: Map<string, any> = new Map();
  const lifecycleMap: Map<string, any> = new Map();
  const otherProps: ts.ObjectLiteralElementLike[] = [];

  let order = 0;
  classNode.members.forEach((member) => {
    order++;
    const { decorators } = member;

    // Not actually only comments - includes all leading trivia, including whitespace.
    const comments =
      sourceFile
        .getFullText()
        .slice(member.getFullStart(), member.getStart(sourceFile)) || "";

    // const comments =
    //   commentRanges
    //     ?.map((r) => sourceFile.getFullText().slice(r.pos, r.end) + "\n")
    //     .join() || "";

    if (ts.isGetAccessor(member)) {
      // computed method
      const { name: propName, body, type } = member;
      const typeName = type ? `:${type.getText(sourceFile)}` : "";
      const block = body?.getText(sourceFile) || "{}";
      const name = propName.getText(sourceFile);

      getterMap.set(name, {
        comments,
        member,
        typeName,
        block,
        order,
      });
    }
    if (ts.isSetAccessor(member)) {
      const { name: propName, body, type } = member;
      const typeName = type ? `:${type.getText(sourceFile)}` : "";
      const block = body?.getText(sourceFile) || "{}";
      const name = propName.getText(sourceFile);
      const parameters = member.parameters
        .map((param) => param.getText(sourceFile))
        .join(",");

      setterMap.set(name, {
        comments,
        parameters,
        typeName,
        block,
        order,
      });
    }
    if (ts.isMethodDeclaration(member)) {
      const name = member.name.getText(sourceFile);

      if (/^(render|data)$/.test(name)) {
        otherProps.push(member);
        return;
      }

      const async = member.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
      )
        ? "async"
        : "";

      const type = member.type ? `:${member.type.getText(sourceFile)}` : "";
      const body = member.body?.getText(sourceFile) || "{}";
      const parameters = member.parameters
        .map((param) => param.getText(sourceFile))
        .join(",");

      const obj = {
        comments,
        async,
        type,
        body,
        parameters,
        order: name == "created" ? 99999 : order,
      };

      if (lifecycleNameMap.has(name)) {
        lifecycleMap.set(name, obj);
      } else {
        methodsMap.set(name, obj);
      }

      if (decorators) {
        // watch
        const decorator = getDecoratorParams(decorators[0], sourceFile);
        if (!(decorator && decorator.decoratorName === "Watch")) return;

        const [target, options] = decorator.args;
        watchMap.set(target, { callback: name, options, order });
      }
    }
    if (ts.isPropertyDeclaration(member)) {
      const name = member.name.getText(sourceFile);
      const type = member.type?.getText(sourceFile);
      
      if (decorators) {
        // props
        const parsedPropDecorator = parsePropDecorator(decorators[0], sourceFile, type);
        if (!parsedPropDecorator) return;

        const nodeData = {
          ...parsePropDecorator(decorators[0], sourceFile, type),
          comments,
        };

        propsMap.set(name, nodeData as any);
        componentProps.push({ name, ...nodeData });

        return;
      }

      const initializer = member.initializer?.getText(sourceFile);
      if (name == initializer) {
        // This looks like just putting an export onto the class component
        // so its available in the template, which isn't needed with script setup.
        return;
      }

      dataMap.set(name, {
        comments,
        type,
        initializer,
        order,
      });
    }
  });

  return {
    otherProps,
    propsMap,
    componentProps,
    dataMap,
    getterMap,
    setterMap,
    methodsMap,
    watchMap,
    lifecycleMap,
  };
};

const tsTypeToVuePropType = (type?: string) => {
  /* vue type
  String
  Number
  Boolean
  Array
  Object
  Date
  Function
  Symbol
  */

  if (type == null) {
    return { expression: `null` };
  }

  if (/^(string|number|boolean)$/.test(type)) {
    return { expression: type.charAt(0).toUpperCase() + type.slice(1) };
  }

  if (/.+\[\]$/.test(type)) {
    return {
      use: "PropType",
      expression: `Array as Proptype<${type}>`,
    };
  }
  return {
    use: "PropType",
    expression: `Object as PropType<${type}>`,
  };
};

const parsePropDecorator = (
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile,
  tsType?: string
) => {
  if (!ts.isCallExpression(decorator.expression)) return null;

  const callExpression = decorator.expression;
  const decoratorName = callExpression.expression.getText(sourceFile);
  if (decoratorName !== "Prop") return null;

  const arg = callExpression.arguments[0];

  const vuePropType = tsTypeToVuePropType(tsType);
  if (arg != null && ts.isObjectLiteralExpression(arg)) {
    if (tsType == null) {
      return {
        node: arg,
        tsType: "unknown",
      };
    }

    const typeState = ts.createSourceFile(
      "",
      vuePropType.expression,
      ts.ScriptTarget.Latest
    ).statements[0];

    if (ts.isExpressionStatement(typeState)) {
      const options = ts.factory.createObjectLiteralExpression([
        ...arg.properties,
        ts.factory.createPropertyAssignment("type", typeState.expression),
      ]);
      return {
        use: vuePropType.use,
        node: options,
        tsType,
        default: arg.properties
          .filter(ts.isPropertyAssignment)
          .find(
            (p) => p.name && ts.isIdentifier(p.name) && p.name.text == "default"
          )
          ?.initializer?.getText(sourceFile),
      };
    }
  }

  return {
    use: vuePropType.use,
    node: ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        "type",
        ts.factory.createIdentifier(vuePropType.expression)
      ),
    ]),
    tsType,
  };
};
const getDecoratorParams = (
  decorator: ts.Decorator,
  sourceFile: ts.SourceFile
) => {
  // @Prop, @Watch
  if (!ts.isCallExpression(decorator.expression)) return null;

  const callExpression = decorator.expression;
  const decoratorName = callExpression.expression.getText(sourceFile);
  const args = callExpression.arguments.map((arg) => {
    if (ts.isStringLiteral(arg)) {
      return arg.text;
    }
    return arg.getText(sourceFile);
  });

  return {
    decoratorName,
    args,
  };
};
