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

import convert from 'xml-js';
import _config = require('./config.json');

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('psrc', 'psrc.recompile');

export type PsrcRecompileResult = {
  result: string;
};

function createWrapper(): any {
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

async function getFolders(location: any): Promise<any> {
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

  public async recompile(inputDir: string, outputDir: string, includeFile: string): Promise<any> {
    const config: any = _config;
    try {
      const inputFolder = path.resolve(inputDir);
      const outputFolder = path.resolve(outputDir);
      await fs.ensureDir(outputFolder);

      // Load includes
      let profiles: string[] = [];
      try {
        profiles = (await fs.readFile(includeFile))
          .toString()
          .split('\n')
          .map((item) => item.trim());
      } catch (_ex) {
        this.log('Including all profiles');
      }

      // For each profile
      for (const profileFolder of await getFolders(inputFolder)) {
        const profileName = path.basename(profileFolder);
        
        // If not included
        if (profiles.length && !profiles.includes(profileName + '.profile-meta.xml')) { continue; }
        
        this.log('Recompiling profile: ' + profileName);

        // Create profile wrapper
        const profile: any = createWrapper();

        // For each metadata type
        for (const metadataFolder of await getFolders(profileFolder)) {
          const metadataType = path.basename(metadataFolder);

          profile.Profile[metadataType] = [];

          // For each individual metadata file for this type
          for (const metadataFile of await fs.readdir(metadataFolder)) {
            const metadata: any = convert.xml2js((await fs.readFile(metadataFolder + '/' + metadataFile)).toString(), config.jsonExport);
            if (metadata['Profile'][metadataType] === undefined) { continue; }

            profile.Profile[metadataType] = [...profile.Profile[metadataType], metadata['Profile'][metadataType]];
          }
        }

        // Write profile to file
        await fs.writeFile(
          outputFolder + '/' + profileName + '.profile-meta.xml',
          convert.json2xml(JSON.stringify(profile), config.xmlExport)
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

    await this.recompile(inputDir, outputDir, include);

    return {
      result: 'success',
    };
  }
}
