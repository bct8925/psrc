/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import path from 'node:path';
import fs from 'fs-extra';

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

import _ from 'lodash';
import convert from 'xml-js';
import _config = require('./config.json');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('psrc', 'psrc.recompile');

export type PsrcRecompileResult = {
  result: string;
};

function createModel(): any {
  const data = {
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

  return data;
}

async function getDirs(location: any): Promise<any> {
  let dirs: any[] = [];
  for (const file of await fs.readdir(location)) {
    if ((await fs.stat(path.join(location, file))).isDirectory()) {
      dirs = [...dirs, path.join(location, file)];
    }
  }
  return dirs;
}

export default class PsrcRecompile extends SfCommand<PsrcRecompileResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    input: Flags.string({
      summary: messages.getMessage('flags.input.summary'),
      description: messages.getMessage('flags.input.description'),
      name: 'input',
      default: 'force-app/main/default/profiles',
    }),
    output: Flags.string({
      summary: messages.getMessage('flags.output.summary'),
      description: messages.getMessage('flags.output.description'),
      name: 'output',
      default: 'force-app/main/default/profiles',
    }),
    include: Flags.string({
      summary: messages.getMessage('flags.include.summary'),
      description: messages.getMessage('flags.include.description'),
      name: 'include',
      default: '.psrc-include'
    }),
  };

  public async merge(inputDir: string, outputDir: string, includeFile: string): Promise<any> {
    const config: any = _config;
    try {
      const root = path.resolve(inputDir);

      const location = path.resolve(outputDir);
      await fs.ensureDir(location);

      let profiles: string[] = [];
      try {
        profiles = (await fs.readFile(includeFile))
          .toString()
          .split('\n')
          .map((item) => item.trim());
      } catch (_) {
        this.log('Including all profiles');
      }

      const rootDirs = await getDirs(root);
      for (const rootDir of rootDirs) {
        const profile = path.basename(rootDir);
        if (profiles.length && !profiles.includes(profile + '.profile-meta.xml')) {
          continue;
        }
        this.log('Recompiling profile: ' + profile);

        const model: any = createModel();
        const metaDirs = await getDirs(rootDir);
        for (const metaDir of metaDirs) {
          const metadataType = path.basename(metaDir);
          model.Profile[metadataType] = [];

          const fileNames = await fs.readdir(metaDir);
          for (const fileName of fileNames) {
            const filePath = metaDir + '/' + fileName;
            const file = await fs.readFile(filePath);
            const stream: any = convert.xml2js(file.toString(), config.jsonExport);

            // Is this needed here??
            if (stream['Profile'][metadataType] === undefined) {
              continue;
            }

            model.Profile[metadataType] = [...model.Profile[metadataType], stream['Profile'][metadataType]];
          }
          model.Profile[metadataType] = _.flatten(model.Profile[metadataType]);
        }

        await fs.writeFile(
          location + '/' + profile + '.profile-meta.xml',
          convert.json2xml(JSON.stringify(model), config.xmlExport)
        );
      }
    } catch (ex: any) {
      this.log(ex);
      return 1;
    }

    return 0;
  }

  public async run(): Promise<PsrcRecompileResult> {
    const { flags } = await this.parse(PsrcRecompile);

    const inputDir = flags.input;
    const outputDir = flags.output;
    const include = flags.include;

    await this.merge(inputDir, outputDir, include);

    return {
      result: 'src/commands/psrc/recompile.ts',
    };
  }
}
