#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const chokidar = require('chokidar');
const program = require('commander');

let WATCH_DIRNAME,
	WATCH_DIR,
	OUT_DIRNAME,
	OUT_DIR;

program
	.version('1.0.0', '-v, --version')
	.option('-o, --out [dest]', 'The destination folder')
	.option('-w, --watch', 'Watch source for any file changes')
	.command('phpconv <src>');

program.parse(process.argv);

function stripPathAttrib(str) {
	return path.resolve(str).split('/').pop();
}

/**
 * Any operation that is triggered will wait till the current one
 * is done. This flag helps to know is there is any pending.
 *
 * First operation is a wide transpilation. Subsequent ones transpile
 * the dirty files only.
 *
 * .html files trigger a wide transpilation because they may be required by 
 * .php files.
 */
let pendingOp = false;
let running = false;
let runID = -1;
let firstRun = true;

WATCH_DIRNAME = stripPathAttrib(program.args[0]);
WATCH_DIR = path.resolve(__dirname, WATCH_DIRNAME);
OUT_DIRNAME = stripPathAttrib(program.out);
OUT_DIR = path.resolve(__dirname, OUT_DIRNAME);

if (program.watch) {
	const watcher = chokidar.watch('file, dir', {
		ignored: /(^|[\/\\])\../,
		persistent: true
	});

	run();

	watcher.on('change', path => {
		if (running) {
			pendingOp = true;
		} else {
			const func = (firstRun || filename.includes('.html')) ? run : runSingle.bind(null, filename);
			
			clearTimeout(runID);
			runID = setTimeout(func, 500);
		}
	});

	watcher.add(WATCH_DIR);
} else {
	getStat(WATCH_DIR)
		.then(stat => [stat.isDirectory(), stat.isFile()])
		.then(([isDir, isFile]) => {
			if (isDir)
				run();
			else if (isFile) {
				if (!path.extname(OUT_DIR))
					OUT_DIR += '.html';
				OUT_DIRNAME = OUT_DIR;
				execCli(`echo random >> ${OUT_DIR}`)
					.then(() => runSingle(WATCH_DIRNAME));
			}
		});
}

function run() {
	running = true;

	const time = Date.now();

	transpile()
		.then(() => {
			console.log(`Transpiled code in ${(Date.now() - time)/1000}s`);
			firstRun = false;

			if (pendingOp) {
				pendingOp = false;
				run();
			} else {
				running = false;
			}
		});
}

function runSingle(filename, customOut) {
	const time = Date.now();

	transpileSingle(filename, true, customOut)
		.then(() => {
			console.log(`Transpiled ${filename} in ${(Date.now() - time)/1000}s`);
		});
}

function transpile() {
	return execTranspile();

	function execTranspile() {
		let dir = WATCH_DIR;

		return execCli(`rm -rf ${OUT_DIR}`)
			.then(probeFolders)
			.then(createFiles)
			.catch(error => {
				console.error('An error occurred while transpiling');
				console.error(error);
			});


		function probeFolders() {
			const folders = [path.resolve(__dirname, dir)];
			const files = [];
			
			return next()
				.then(() => files);

			function next() {
				const folder = folders.shift();
				return readdir(folder)
					.then(content => grabChildren(folder, content, folders, files))
					.then(() => mkdir(folder.replace(WATCH_DIRNAME, OUT_DIRNAME)))
					.then(() => folders.length ? next() : null);
			}
		}

		function grabChildren(folder, content, folders, files) {
			const promises = content.map(ct => {
				const relDir = path.resolve(folder, ct);
				return getStat(relDir)
					.then(stat => queueChild(relDir, stat));
			});

			return Promise.all(promises);

			function queueChild(relDir, stat) {
				if (stat.isDirectory()) {
					folders.push(relDir);
				} else if (stat.isFile()) {
					files.push(relDir);
				}
			}
		}

		function createFiles(files) {
			const promises = files.map(file => {
				return transpileSingle(file, false);
			});

			return Promise.all(promises);
		}
	}
}

function transpileSingle(file, alreadyExists, customOut) {
	const fullPath = alreadyExists ? path.resolve(WATCH_DIR, file) : file;
	const newPath = fullPath.replace(WATCH_DIRNAME, OUT_DIRNAME);
	const inHtml = customOut || newPath.replace('.php', '.html');

	if (fullPath.indexOf('.php') !== -1) {
		if (alreadyExists)
			return execCli(`rm ${inHtml} && php-cgi -f ${fullPath} >> ${inHtml}`);
		else
			return execCli(`php-cgi -f ${fullPath} >> ${inHtml}`);
	} else {
		return readFile(fullPath, 'utf-8')
			.then(ct => writeFile(newPath, ct.replace('.php', '.html')));
	}
}

function readdir(dir) {
	return new Promise((res, rej) => {
		fs.readdir(dir, (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}

function mkdir(dir) {
	return new Promise((res, rej) => {
		fs.mkdir(dir, (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}

function readFile(file) {
	return new Promise((res, rej) => {
		fs.readFile(file, 'utf-8', (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}

function writeFile(file, ct) {
	return new Promise((res, rej) => {
		fs.writeFile(file, ct, (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}

function execCli(cmd) {
	return new Promise((res, rej) => {
		exec(cmd, (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}

function getStat(dir) {
	return new Promise((res, rej) => {
		fs.stat(dir, (err, data) => {
			if (err) rej(err);
			else res(data);
		});
	});
}