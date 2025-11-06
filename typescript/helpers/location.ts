import * as vscode from "vscode";

export default function AnalyzeLocation(filepathlocation: string)  {

    const match = filepathlocation.match(/(.*):(\d+):(\d+)::(\d+):(\d+)$/);
    if (!match) { return; }

    const filepath = match[1];
    const startrow = Number(match[2]) || 0;
    const startcol = Number(match[3]) || 0;
    const endrow = Number(match[4]) || startrow;
    const endcol = Number(match[5]) || startcol;

    const startPosition = new vscode.Position(startrow, startcol);
    const endPosition = new vscode.Position(endrow, endcol);
    const definitionRange = new vscode.Range(startPosition, endPosition);

    return { filepath, definitionRange };
}