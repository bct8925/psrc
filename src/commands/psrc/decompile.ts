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
const messages = Messages.loadMessages('psrc', 'psrc.decompile');

export type PsrcDecompileResult = {
  result: string;
};

function createModel(key: any, value: any): any {
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

  data.Profile[key] = value;
  return data;
}

export default class PsrcDecompile extends SfCommand<PsrcDecompileResult> {
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

  public async split(inputDir: string, outputDir: string, includeFile: string | undefined): Promise<any> {
    const config: any = _config;
    try {
      const root = path.resolve(inputDir);

      const location = path.resolve(outputDir);
      await fs.ensureDir(location);

      const fileNames = await fs.readdir(root);
      let profiles: string[] = [];
      if (includeFile) {
        profiles = (await fs.readFile(includeFile))
          .toString()
          .split('\n')
          .map((item) => item.trim());
      }

      for (const fileName of fileNames) {
        if (fileName.includes('.profile') && (!profiles.length || profiles.includes(fileName))) {
          this.log('Splitting profile: ' + fileName);
          // Update on the meta profiles fetched through sfdx metadata API
          const dirRoot = location + '/' + fileName.replace('.profile-meta.xml', '');
          await fs.ensureDir(dirRoot);

          const xml = await fs.readFile(root + '/' + fileName);
          const stream: any = convert.xml2js(xml.toString(), config.jsonExport);

          const metaTags: string[] = Object.values(config.profiles.metaTags);
          for (const metatag of metaTags) {
            if (stream['Profile'][metatag] === undefined) {
              continue;
            }

            const model = createModel(metatag, stream['Profile'][metatag]);
            const itemRoot = dirRoot + '/' + metatag;
            await fs.ensureDir(itemRoot);

            await fs.writeFile(
              itemRoot + '/' + metatag + '-meta.xml',
              convert.json2xml(JSON.stringify(model), config.xmlExport)
            );
          }

          for (const metadata of Object.keys(config.profiles.tags)) {
            const itemRoot = dirRoot + '/' + metadata;
            await fs.ensureDir(itemRoot);

            const targetName = config.profiles.tags[metadata].nameTag;

            if (stream['Profile'][metadata] === undefined) {
              continue;
            }

            if (Array.isArray(stream['Profile'][metadata])) {
              if (targetName === '_self') {
                const model = createModel(metadata, stream['Profile'][metadata]);

                await fs.writeFile(
                  itemRoot + '/' + metadata + '-meta.xml',
                  convert.json2xml(JSON.stringify(model), config.xmlExport)
                );
              } else {
                for (const item of stream['Profile'][metadata]) {
                  const model = createModel(metadata, [item]);

                  let _filename = '';
                  if (Array.isArray(targetName)) {
                    for (const targetNameItem of targetName) {
                      if (item[targetNameItem]?._text) {
                        _filename += (_filename ? '#' : '') + item[targetNameItem]._text;
                      }
                    }
                  } else {
                    _filename = item[targetName]._text;
                  }

                  await fs.writeFile(
                    itemRoot + '/' + _filename + '-meta.xml',
                    convert.json2xml(JSON.stringify(model), config.xmlExport)
                  );
                }
              }
            } else {
              const item = stream['Profile'][metadata];
              const model = createModel(metadata, item);
              let newFileName = '';

              if (targetName === '_self') {
                newFileName = metadata;
              } else if (Array.isArray(targetName)) {
                for (const targetNameItem of targetName) {
                  if (stream['Profile'][metadata][targetNameItem]?._text) {
                    newFileName += (newFileName ? '#' : '') + stream['Profile'][metadata][targetNameItem]._text;
                  }
                }
              } else {
                newFileName = stream['Profile'][metadata][targetName]._text;
              }

              await fs.writeFile(
                itemRoot + '/' + newFileName + '-meta.xml',
                convert.json2xml(JSON.stringify(model), config.xmlExport)
              );
            }
          }
        }
      }
    } catch (ex: any) {
      this.log(ex);
      return 1;
    }

    return 0;
  }

  public async run(): Promise<PsrcDecompileResult> {
    const { flags } = await this.parse(PsrcDecompile);

    const inputDir = flags.input;
    const outputDir = flags.output;
    const include = flags.include;

    await this.split(inputDir, outputDir, include);

    return {
      result: 'src/commands/psrc/decompile.ts',
    };
  }
}
