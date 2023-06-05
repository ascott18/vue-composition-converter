import ts from "typescript";
import { getImportStatement, getSetupStatements } from '../helper'
import { convertOptions } from "./options/optionsConverter";

export const convertOptionsApi = (sourceFile: ts.SourceFile) => {
  const options = convertOptions(sourceFile);
  if (!options) {
    throw new Error("invalid options");
  }

  const { setupProps, propNames, otherProps } = options;

  const newSrc = ts.factory.createSourceFile(
    [
      ...getImportStatement(setupProps),
      ...sourceFile.statements.filter((state) => !ts.isExportAssignment(state)),
      ...getSetupStatements(setupProps),
    ],
    sourceFile.endOfFileToken,
    sourceFile.flags
  );
  const printer = ts.createPrinter();
  return printer.printFile(newSrc);
};
