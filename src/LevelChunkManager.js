/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { ChunkManager, ChunkingUtils, logger } from '@fieldfare/core';
import { Level } from 'level';

export class LevelChunkManager extends ChunkManager {

    constructor() {
        super();
        this.completeChunks = new Level('chunk/complete', { valueEncoding: 'json' })
        this.incompleteChunks = new Level('chunk/incomplete', { valueEncoding: 'json' })
    }

    static init() {
        const newInstance = new LevelChunkManager;
        ChunkManager.addInstance(newInstance);
        setInterval(async () => {
            logger.debug(await newInstance.report());
        }, 10000);
    }

    async report() {
        var starttime = performance.now();
        const iterator = this.completeChunks.keys();
        var numEntries = 0;
        for await (const key of iterator) numEntries++;
        var endtime = performance.now();
        var deltaReport = "";
        if(this.lastNumEntries !== undefined) {
            deltaReport = ", "
            if(numEntries >= this.lastNumEntries) {
                deltaReport += (numEntries - this.lastNumEntries) + " more "
            } else {
                deltaReport += (this.lastNumEntries - numEntries) + " less "
            }
            deltaReport += "since last report";
        }
        this.lastNumEntries = numEntries;
        return "Level Resources Manager: "
            + numEntries
            + " resources stored"
            + deltaReport
            + ". (Search took "
            + (endtime - starttime)
            + " ms)";
    }

    async storeChunkContents(base64data) {
        let complete = true;
        let depth = 0;
        let size = base64data.length;
        if(size > 1024) {
            throw Error('Chunk size limit exceeded');
        }
        const childrenIdentifiers = await ChunkingUtils.getChildrenIdentifiers(base64data);
        for(const childIdentifier of childrenIdentifiers) {
            const childChunk = await this.completeChunks.get(childIdentifier);
            if(!childChunk) {
                complete = false;
                break;
            }
            size += childChunk.size;
            depth = Math.max(depth, childChunk.depth+1);
        }
        const identifier = await ChunkingUtils.generateIdentifierForData(base64data);
        if(complete) {
            await this.completeChunks.put(identifier, {base64data, depth, size});
        } else {
            await this.incompleteChunks.put(identifier, base64data);
            depth = undefined;
            size = undefined;
        }
        return {identifier, base64data, complete, depth, size};
    }

    async getChunkContents(identifier) {
        const completeChunk = await this.completeChunks.get(identifier);
		if(completeChunk) {
            return {
                base64data: completeChunk.base64data,
                complete: true,
                depth: completeChunk.depth,
                size: completeChunk.size
            };
        }
        const base64data = await this.incompleteChunks.get(identifier);
        if(!base64data) {
            const error = Error('Chunk not found');
            error.name = 'NOT_FOUND_ERROR';
            throw error;
        }
		return {base64data, complete:false};
	}

}
