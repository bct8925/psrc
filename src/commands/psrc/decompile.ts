/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-await-in-loop */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

import { createWrapper, getMetadataTags, getMetadataTypes, loadFile, loadFiles, loadFolder, loadIncludes, parseNameTag, writeFile } from '../../utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('psrc', 'psrc.decompile');

export type PsrcDecompileResult = {
    result: string;
};

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

    public async run(): Promise<PsrcDecompileResult> {
        const { flags } = await this.parse(PsrcDecompile);

        const inputDir = flags.input;
        const outputDir = flags.output;
        const include = flags.include;

        try {
            await this.decompile(inputDir, outputDir, include);
        } catch (ex) {
            this.log(ex as string);
            return { result: 'fail', };
        }

        return { result: 'success', };
    }

    private async decompile(inputDir: string, outputDir: string, includeFile: string): Promise<void> {
        // Load folders
        const inputFolder = await loadFolder(inputDir);
        const outputFolder = await loadFolder(outputDir);

        // Load includes
        const profiles: string[] = await loadIncludes.bind(this)(includeFile);

        // For each profile
        for (const profileName of await loadFiles(inputFolder)) {
            if (!profileName.includes('.profile-meta.xml') || (profiles.length && !profiles.includes(profileName))) { continue; }

            this.log('Decompiling profile: ' + profileName);

            // Create profile folder
            const profileFolder = await loadFolder(outputFolder + '/' + profileName.replace('.profile-meta.xml', ''));

            // Load profile
            const profile: any = await loadFile(inputFolder + '/' + profileName);

            // Handle config metadata types
            const metadataTypes = getMetadataTypes();
            for (const metadataType of Object.keys(metadataTypes)) {
                const metadataTypeFolder = await loadFolder(profileFolder + '/' + metadataType);

                if (profile['Profile'][metadataType] === undefined) {
                    continue;
                }

                const nameTag = metadataTypes[metadataType].nameTag;
                const metadataTypeItems = !Array.isArray(profile['Profile'][metadataType]) ? [profile['Profile'][metadataType]] : profile['Profile'][metadataType];
                for (const item of metadataTypeItems) {
                    const filename = parseNameTag(nameTag, metadataType, item);
                    const file = createWrapper(metadataType, [item]);
                    await writeFile(metadataTypeFolder + '/' + filename + '-meta.xml', file);
                }
            }

            // Handle config metadata tags
            const metadataTags: string[] = Object.values(getMetadataTags);
            for (const metadataTagName of metadataTags) {
                if (profile['Profile'][metadataTagName] === undefined) { continue; }

                const metadataTagFolder = await loadFolder(profileFolder + '/' + metadataTagName);
                const file = createWrapper(metadataTagName, profile['Profile'][metadataTagName]);
                await writeFile(metadataTagFolder + '/' + metadataTagName + '-meta.xml', file);
            }
        }
    }
}