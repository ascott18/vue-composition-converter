import ts from "typescript";
import { parse } from "vue/compiler-sfc";
import { getNodeByKind } from "./helper";
import { convertClass } from "./converters/classApiConverter";
import { convertOptionsApi } from "./converters/optionsApiConverter";
import prettier from "prettier";
import parserTypeScript from "prettier/parser-typescript";

export const convertSrc = (input: string): string => {
  const parsed = parse(input);
  const {
    descriptor: { script },
  } = parsed;
  const scriptContent = script?.content || "";

  const sourceFile = ts.createSourceFile(
    "src.ts",
    scriptContent,
    ts.ScriptTarget.Latest
  );

  let newScript = (() => {
    const exportAssignNode = getNodeByKind(
      sourceFile,
      ts.SyntaxKind.ExportAssignment
    );
    if (exportAssignNode) {
      // optionsAPI
      return convertOptionsApi(sourceFile);
    }

    const classNode = getNodeByKind(sourceFile, ts.SyntaxKind.ClassDeclaration);
    if (classNode && ts.isClassDeclaration(classNode)) {
      // classAPI
      return convertClass(classNode, sourceFile);
    }
  })();

  if (!newScript) {
    throw new Error("unable to parse input");
  }

  try {
    newScript = prettier.format(newScript, {
      parser: "typescript",
      plugins: [parserTypeScript],
    });
  } catch (e) {
    console.error("Prettier failed on script", e);
  }

  return `
  ${input.substring(0, script!.loc.start.offset)}
  ${newScript}
  ${input.substring(script!.loc.end.offset)}`.replace(
    "<script ",
    "<script setup "
  );
};
