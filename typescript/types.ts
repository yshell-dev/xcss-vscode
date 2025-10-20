/* eslint-disable @typescript-eslint/no-explicit-any */
import vscode from 'vscode';

export interface t_FileCursor {
    marker: number;
    rowMarker: number;
    colMarker: number;
}

export enum t_SnippetType {
    null,
    property,
    value,
    pseudo,
    selector,
    rule,
    assign,
    attach,
    constant,
    variable,
    varfetch,
};

export interface t_CursorSnippet {
    property: string;
    type: t_SnippetType;
    fragment: string;
}

export interface t_TagCache {
    hashrules: t_TrackRange[];
    valuefrags: t_TrackRange[];
    watchtracks: t_TrackRange[];
    composes: t_TrackRange[];
    comments: t_TrackRange[];
}

export interface t_TagRange {
    range: vscode.Range;
    variables: Record<string, string>;
    cache: t_TagCache
}

export interface t_Diagnostic {
    range: vscode.Range;
    origin: string;
    message: string
}

export interface t_TrackRange {
    kind: vscode.FoldingRangeKind;
    blockRange: vscode.Range;
    attr: string;
    attrStart: number;
    attrEnd: number;
    attrRange: vscode.Range;
    val: string;
    valStart: number;
    valEnd: number;
    valRange: vscode.Range;
    multiLine: boolean;
    fragments?: string[];
    variableSet?: Set<string>
}


// Types of manifest

export interface m_Diagnostic {
    message: string,
    sources: string[]
}

export interface m_Metadata {
    info?: string[],
    skeleton?: Record<string, object>,
    variables?: Record<string, string>,
    declarations?: string[],
    summon?: string,
    markdown?: string
}

export interface t_FileManifest {
    webviewport: number,
    webviewurl: string,
    environment: string,
    attributes: string[],
    customtags: string[],
    switchmap: Record<string, string>,
    hashrules: Record<string, string>,
    constants: Record<string, string>,
    assistfile: boolean,
    watchfiles: string[],
    livecursor: boolean,
}

export interface t_StyleManifest {
    locales: string[],
    assignable: string[],
    symclasses: Record<string, number>,
    symclassData: Record<number, m_Metadata>,
    diagnostics: m_Diagnostic[],
}

export interface t_JsonRPCRequest {
    jsonrpc: string,
    id: any,
    method: string,
    params: any,
}
export interface t_JsonRPCResponse {
    jsonrpc: string,
    id: any,
    method: string,
    result: any,
    error: any,
}
