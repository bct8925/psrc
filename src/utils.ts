/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'node:path';
import fs from 'fs-extra';
import convert from 'xml-js';
import _config = require('./config.json');
const config: any = _config;

export async function loadIncludes(this: any, includeFile: string): Promise<string[]> {
    try {
        return (await fs.readFile(includeFile))
            .toString()
            .split('\n')
            .map((item) => item.trim());
    } catch (_) {
        this.log('[Including all profiles]');
        return [];
    }
}

export function getMetadataTypes(): any {
    return config.profiles.types;
}

export function getMetadataTags(): any {
    return config.profiles.tags;
}

export function createWrapper(key: any, value: any): any {
    const data: any = {
        _declaration: {
            _attributes: {
                version: '1.0',
                encoding: 'UTF-8',
            },
        },
        Profile: {
            _attributes: {
                xmlns: 'http://soap.sforce.com/2006/04/metadata',
            },
        },
    };
    if (key != null) {
        data.Profile[key] = value;
    }
    return data;
}

export function parseNameTag(nameTag: string, metadataTag: string, ref: any): string {
    if (nameTag === '_self') {
        return metadataTag;
    } else if (Array.isArray(nameTag)) {
        let filename = '';
        for (const nameTagItem of nameTag) {
            if (ref[nameTagItem]?._text) {
                filename += (filename ? '#' : '') + ref[nameTagItem]._text;
            }
        }
        return filename;
    } else {
        return ref[nameTag]._text;
    }
}

export function folderName(filepath: string): string {
    return path.basename(filepath);
}

export async function loadFolder(filepath: string): Promise<string> {
    const folder = path.resolve(filepath);
    await fs.ensureDir(folder);
    return folder;
}

export async function loadFolders(filepath: string): Promise<string[]> {
    let dirs: string[] = [];
    for (const file of await fs.readdir(filepath)) {
        if ((await fs.stat(path.join(filepath, file))).isDirectory()) {
            dirs = [...dirs, path.join(filepath, file)];
        }
    }
    return dirs;
}

export async function loadFile(filepath: string): Promise<any> {
    return convert.xml2js((await fs.readFile(filepath)).toString(), config.jsonExport);
}

export async function loadFiles(filepath: string): Promise<string[]> {
    return fs.readdir(filepath);
}

export async function writeFile(filepath: string, file: any): Promise<void> {
    await fs.writeFile(
        filepath,
        convert.json2xml(JSON.stringify(file), config.xmlExport)
    );
}