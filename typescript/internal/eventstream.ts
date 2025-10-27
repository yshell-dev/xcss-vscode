// import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { SERVER } from '../server';
import * as fs from 'fs';
import { t_JsonRPCResponse, t_FileManifest, t_StyleManifest } from '../types';
import vscode from 'vscode';
import { WebSocket } from 'ws';
import getBinPath from '../../core/execute';

export class EVENTSTREAM {
    private Server: SERVER;
    private Paused: boolean;
    private OutputChannel: vscode.OutputChannel;
    private Process: ChildProcessWithoutNullStreams | null = null;
    private WS: WebSocket | null = null;
    public RootBinary: string;

    get Spawn_IsAlive(): boolean {
        return !!this.Process && !this.Process.killed;
    }

    constructor(core: SERVER) {
        this.Server = core;
        this.Paused = false;
        this.RootBinary = getBinPath(core.DevMode);
        this.OutputChannel = vscode.window.createOutputChannel(this.Server.Ed_IdCap + ' Server');
    }

    showDeathMessage = () => {
        const message = "💐💐💐 RIP: Process Died!!!";
        this.OutputChannel.appendLine(message);
        console.error(message);

    };

    receive = (text: string) => {

        if (text == "0") {
            this.Kill();

        } else if (text[0] == "{") {
            try {
                const res = JSON.parse(text) as t_JsonRPCResponse;
                if (typeof res == 'object' && res.result) {
                    switch (res.method) {

                        case "fileManifest": {
                            const r = res.result as t_FileManifest;
                            this.Server.UpdateFileManifest(r);
                            if (!this.WS) {
                                this.WS = new WebSocket(r.webviewurl + "/ws");
                                this.WS.on("message", (data) => {
                                    const str = data.toString();
                                    this.receive(str);
                                });
                            }
                            break;
                        }

                        case "styleManifest": {
                            this.Server.UpdateStyleManifest(res.result as t_StyleManifest);
                            break;
                        }

                    }
                } else {
                    this.OutputChannel.appendLine(text);
                }
            } catch (err) {
                const message = "VSC: " + (err instanceof Error ? err.message : String(err));
                console.error(message);
                console.log(text);
            }
        }

        if (this.Paused) {
            this.OutputChannel.appendLine(text);
            this.unpause();
        }
    };

    private transmit(request: string): void {
        request = request + "\n";

        if (this.Process && !this.Process.killed) {
            if (this.Process.stdin.destroyed) {
                this.Kill();
            } else {
                const canWrite = this.Process.stdin.write(request, (err: Error | null | undefined) => {
                    if (err) {
                        this.OutputChannel.appendLine(request);
                        this.OutputChannel.appendLine(err.message || '- request failed');
                    }
                });
                if (!canWrite) {
                    this.OutputChannel.appendLine(request);
                    this.OutputChannel.appendLine('Spawn command failed');
                    this.Kill();
                }
            }
        } else {
            this.OutputChannel.appendLine(request);
            this.OutputChannel.appendLine('- process not ready for writing');
        }
    }

    Interactive = async () => {
        this.dopause();

        const request = await vscode.window.showInputBox({
            prompt: this.Server.Ed_IdCap + ': Server stream',
            placeHolder: 'iRpc:[> ...], iTerm:[$ ...], JsonRpc:[...]'
        });

        if (request !== undefined) {
            this.OutputChannel.show();
            this.transmit(request);
        }

        setTimeout(() => { this.unpause(); }, 1000);
    };

    debounce = false;
    async Start(spawnPath: string, args: string[], overide_config = false) {
        if ((this.Process && this.Spawn_IsAlive) || !fs.existsSync(this.RootBinary) || !this.debounce) { return; }

        this.debounce = true;
        setTimeout(() => this.debounce = false, 1000);

        const autostartflag = this.Server.config.get<boolean>("development.autostart");
        if (!(autostartflag || overide_config)) { return; }

        this.dopause();
        this.WS?.close();
        this.WS = null;
        this.Process = spawn(this.RootBinary, args, {
            cwd: spawnPath,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
        });
        setTimeout(this.unpause, 100);

        if (this.Process.stdout) {
            this.Process.stdout.on('data', (buffer: Buffer) => {
                this.receive(buffer.toString());
            });
        }

        if (this.Process.stderr) {
            this.Process.stderr.on('data', (data: Buffer) => {
                console.log('STDERR: ' + data.toString());
                this.OutputChannel.appendLine(data.toString());
            });
        }

        this.Process.on('error', (err) => {
            this.showDeathMessage();
            this.OutputChannel.appendLine('Spawn error: ' + err.message);
        });
    }

    Kill(): void {
        this.showDeathMessage();
        if (this.Process && !this.Process.killed) {
            if (!this.Process.stdin.destroyed) {
                this.StdIoRpc("$ exit");
            }
            this.Process.kill();
            this.Process = null;
        }
        this.Server.reset();
    }

    JsonRpc(method: string, params: object = {}, id: number = Date.now()): void {
        if (this.Paused) { return; }
        const request = { jsonrpc: "2.0", method, params, id };
        this.transmit(JSON.stringify(request));
    }

    StdIoRpc(cmd: string, ...args: string[]): void {
        if (this.Paused) { return; }
        const request = `> ${cmd} ${args.join(" ")}`;
        this.transmit(request);
    }

    dispose(): void {
        this.Kill();
        this.OutputChannel.dispose();
    }

    private dopause = async () => {
        this.Paused = true;
    };

    private unpause = async () => {
        this.Paused = false;
    };
}
