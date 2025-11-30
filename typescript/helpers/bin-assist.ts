import { spawnSync } from 'child_process';
import fs from 'fs';

const BinLocatorBin = ['darwin', 'linux'].includes(process.platform) ? 'which' : 'where';

export function BinLocator(bin: string): { path: string | null; error: Error | null; status: number | null } {
    const result = spawnSync(BinLocatorBin, [bin], { encoding: 'utf-8' });

    return {
        path: result.status === 0 ? result.stdout.trim() : null,
        error: result.error || null,
        status: result.status !== null ? result.status : null,
    };
}

export function ReadCmdReturn(cmd: string, ...args: string[]): string {
    const result = spawnSync(cmd, args, { encoding: 'utf-8' });

    if (result.error) {
        console.error(`Error executing command '${cmd}':`, result.error);
        return '';
    }

    if (result.status !== 0) {
        console.error(`Command '${cmd}' exited with code ${result.status}:`, result.stderr);
        return '';
    }

    return result.stdout.trim();
}

export function binaryExists(binpath: string): boolean {
    try {
        const stats = fs.statSync(binpath);
        return stats.isFile() && (stats.mode & 0o111) !== 0; // Check execute permission bits
    } catch {
        return false;
    }
}