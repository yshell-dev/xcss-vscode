const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function clearFolder(folderPath) {
	if (!fs.existsSync(folderPath)) {
		console.error(`Folder does not exist: ${folderPath}`);
		return;
	}

	const entries = fs.readdirSync(folderPath);
	entries.forEach(entry => {
		const fullPath = path.join(folderPath, entry);
		const stats = fs.statSync(fullPath);

		if (stats.isDirectory()) {
			clearFolder(fullPath);
			fs.rmdirSync(fullPath);
		} else {
			fs.unlinkSync(fullPath);
		}
	});
}

// clearFolder('./extension');

esbuild.build({
	entryPoints: ['./typescript/activate.ts'],
	bundle: true,
	minify: false,
	outfile: './extension/activate.js',
	sourcemap: true,
	target: ['node18'],
	platform: 'node',
	format: 'cjs',
	external: ['vscode', 'vscode-css-languageservice']
})
	.then(() => {
		console.log('Js Bundling successful.');
	})
	.catch((err) => {
		console.error('Build error:', err);
		process.exit(1);
	});