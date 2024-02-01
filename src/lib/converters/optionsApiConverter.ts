import ts from "typescript";
import { getImportStatement, getSetupStatements } from "../helper";
import { convertOptions } from "./options/optionsConverter";

export const convertOptionsApi = (sourceFile: ts.SourceFile) => {
  const options = convertOptions(sourceFile);
  if (!options) {
    throw new Error("invalid options");
  }

  const { setupProps, propNames, otherProps, propsObj } = options;

  if (propsObj) {
    const defineProps = `\nconst props = defineProps(${propsObj})\n\n`;

    setupProps.unshift({
      expression: defineProps,
      order: 0,
    });
  }

  const newSrc = ts.factory.createSourceFile(
    [
      ...getImportStatement(setupProps),
      ...sourceFile.statements.filter(
        (state) =>
          !ts.isExportAssignment(state) &&
          (!ts.isImportDeclaration(state) ||
            // Filter out `import Vue from "vue"`:
            state.importClause?.getText(sourceFile) != "Vue")
      ),
    ],
    sourceFile.endOfFileToken,
    sourceFile.flags
  );
  const printer = ts.createPrinter();
  return printer.printFile(newSrc) + getSetupStatements(setupProps, propNames);
};
