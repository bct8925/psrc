/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

import { createWrapper, folderName, loadFile, loadFiles, loadFolder, loadFolders, loadIncludes, writeFile } from '../../utils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('psrc', 'psrc.recompile');

export type PsrcRecompileResult = {
    result: string;
};

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

    public async run(): Promise<PsrcRecompileResult> {
        const { flags } = await this.parse(PsrcRecompile);

        const inputDir = flags.input;
        const outputDir = flags.output;
        const include = flags.include;

        try {
            await this.recompile(inputDir, outputDir, include);
        } catch (ex) {
            this.log(ex as string);
            return { result: 'fail' };
        }

        return { result: 'success' };
    }

    private async recompile(inputDir: string, outputDir: string, includeFile: string): Promise<any> {
        // Load folders
        const inputFolder = await loadFolder(inputDir);
        const outputFolder = await loadFolder(outputDir);

        // Load includes
        const profiles = await loadIncludes.bind(this)(includeFile);

        // For each profile
        for (const profileFolder of await loadFolders(inputFolder)) {
            const profileName = folderName(profileFolder);

            // If not included
            if (profiles.length && !profiles.includes(profileName + '.profile-meta.xml')) { continue; }

            this.log('Recompiling profile: ' + profileName);

            // Create profile
            const profile: any = createWrapper(null, null);

            // For each metadata type
            for (const metadataFolder of await loadFolders(profileFolder)) {
                const metadataType = folderName(metadataFolder);

                profile.Profile[metadataType] = [];

                // For each metadata file
                for (const metadataFile of await loadFiles(metadataFolder)) {
                    const metadata: any = await loadFile(metadataFolder + '/' + metadataFile);
                    if (metadata['Profile'][metadataType] === undefined) { continue; }

                    profile.Profile[metadataType] = [...profile.Profile[metadataType], metadata['Profile'][metadataType]];
                }
            }

            // Write profile to file
            await writeFile(outputFolder + '/' + profileName + '.profile-meta.xml', profile);
        }
    }
}