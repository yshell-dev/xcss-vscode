import fs from 'fs';
import vscode from 'vscode';
import getBinPath from '../package/package';
import { ExtensionManager } from './activate';
import { WebSocket } from 'ws';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { t_JsonRPCResponse } from './types';

export class BRIDGE {

    receive = (text: string) => {
        try {
            const res = JSON.parse(text) as t_JsonRPCResponse;
            switch (res.method) {

                case "websocket-url": {
                    const url = res.result;
                    if (this.WS && this.WS.url === url && this.WS.readyState !== this.WS.CLOSED) {
                        break;
                    }
                    if (this.WS) { this.WS.close(); }
                    this.WS = new WebSocket(url);

                    this.WS.on('message', (data) => {
                        const response = data.toString();
                        this.receive(response);
                    });
                    break;
                }

                case "sandbox-url": {
                    this.Server.W_SANDBOX.url = res.result;
                    break;
                }

                case "session-port": {
                    this.SessionPort = res.result as number;
                    break;
                }

                case "server-state-list": {
                    this.Server.W_SANDBOX.States = res.result as typeof this.Server.W_SANDBOX.States;
                    break;
                }

                case "manifest-mixed": {
                    this.WSStream("sandbox-view");
                    this.Server.UpdateMixedManifest(res.result);
                    break;
                }

            }
        } catch (err) {
            const message = "VSC: " + (err instanceof Error ? err.message : String(err));
            console.error(message);
            console.log(text);
        }

        if (this.Paused) { this.OutputCh.appendLine(text); this.unpause(); }
    };

    private WS: WebSocket | null = null;
    private Server: ExtensionManager;
    private Process: ChildProcessWithoutNullStreams | null = null;
    private OutputCh: vscode.OutputChannel;

    private Paused = false;
    private dopause = () => this.Paused = true;
    private unpause = () => this.Paused = false;

    public RootBinary = "";
    public SessionPort = 0;

    public spawnAlive = () => !!this.Process && !this.Process.killed;

    constructor(core: ExtensionManager) {
        this.Server = core;
        this.RootBinary = getBinPath();
        this.OutputCh = vscode.window.createOutputChannel(this.Server.IDCAP + ' Server');
        this.periodics();
    }

    periodics = async () => {
        const preriodics = [
            "sandbox-url",
            "session-port",
            "websocket-url",
            "server-state-list"
        ];
        while (true) {
            for (const cmd of preriodics) {
                await new Promise(resolve => setTimeout(resolve, 200));
                this.StdIOCmd(cmd);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    };

    restartAwait = false;
    async start(spawnPath: string, args: string[], overide_config = false) {
        if ((this.Process && this.spawnAlive()) || !fs.existsSync(this.RootBinary)) { return; }
        if (this.restartAwait) { return; }

        this.restartAwait = true;
        setTimeout(() => { this.restartAwait = false; }, 1000);

        if (!(this.Server.config.get<boolean>("development.autostart") || overide_config)) { return; }

        this.dopause();
        this.WS?.close();
        this.WS = null;
        this.Process = spawn(this.RootBinary, args, {
            cwd: spawnPath,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
        });
        setTimeout(this.unpause, 1000);

        if (this.Process.stdout) {
            this.Process.stdout.on('data', (buffer: Buffer) => {
                const message = buffer.toString();
                this.receive(message);
            });
        }
        if (this.Process.stderr) {
            this.Process.stderr.on('data', (data: Buffer) => {
                console.log('STDERR: ' + data.toString());
                this.OutputCh.appendLine(data.toString());
            });
        }
        this.Process.on('error', (err) => {
            this.kill();
            this.OutputCh.appendLine('Spawn error: ' + err.message);
        });
    }
    kill(): void {
        if (this.Process && !this.Process.killed) {
            this.Process.kill();
            this.Process = null;
        }
        const message = "💐💐💐 RIP: Death by Ignorance!!!";
        this.OutputCh.appendLine(message);
        console.error(message);
        this.Server.reset();
        this.WS?.close();
        this.WS = null;
    }
    dispose(): void {
        this.kill();
        this.OutputCh.dispose();
    }

    interactive = async () => {
        this.dopause();
        const request = await vscode.window.showInputBox({
            prompt: this.Server.IDCAP + ': Server stream',
            placeHolder: 'iRpc:[> ...], iTerm:[$ ...], JsonRpc:[...]'
        });

        if (request !== undefined) {
            this.OutputCh.show();
            this.StdIO(request);
        }
        setTimeout(() => { this.unpause(); }, 1000);
    };

    StdIOCmd(cmd: string, ...args: string[]): void { this.StdIO(`> ${cmd} ${args.join(" ")}`); }
    private StdIO(request: string): void {
        if (this.Paused) { return; }
        request = request + "\n";
        if (this.Process && !this.Process.killed) {
            if (this.Process.stdin.destroyed) {
                this.kill();
            } else {
                const canWrite = this.Process.stdin.write(request, (err: Error | null | undefined) => {
                    if (err) {
                        this.OutputCh.appendLine(request);
                        this.OutputCh.appendLine(err.message || '- request failed');
                    }
                });
                if (!canWrite) {
                    this.OutputCh.appendLine(request);
                    this.OutputCh.appendLine('Spawn command failed');
                    this.kill();
                }
            }
        } else {
            this.OutputCh.appendLine(request);
            this.OutputCh.appendLine('- process not ready for writing');
        }
    }

    WSStream(method: string, params: object = {}, id: number = Date.now()): void {
        if (!this.WS || this.WS.readyState !== WebSocket.OPEN) {
            console.warn(`WebSocket not open. Dropping message for method: ${method}`);
            return;
        }
        try {
            const message = JSON.stringify({ jsonrpc: "2.0", method, params, id });
            this.WS.send(message);
        } catch (err) {
            console.error("Failed to send message over WebSocket:", err);
        }
    }
}