/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {
    LocalHost, NVD, cryptoManager, Environment,
    Collection, ChunkList, ChunkSet, ChunkMap, logger
} from '@fieldfare/core'
import { LevelChunkManager } from './LevelChunkManager.js';
import { LevelNVD } from './LevelNVD.js';
import { WebServerTransceiver } from './WebServerTransceiver.js';
import { UDPTransceiver } from './UDPTransceiver.js';
import { NodeCryptoManager } from './NodeCryptoManager.js';

export  {LevelChunkManager, LevelNVD, WebServerTransceiver, UDPTransceiver, NodeCryptoManager };

export async function setEnvironmentUUID(uuid) {
	await NVD.save('envUUID', uuid);
}

export async function setupEnvironment() {
	const envUUID = await NVD.load('envUUID');
    if(!envUUID) {
        throw Error('Environment UUID not defined, please check your setup');
    }
    const envClassPath = await NVD.load('envClassPath');
    let env;
    if(!envClassPath) {
        logger.warn('Environment class path not defined, using basic environment');
        env =  new Environment(envUUID);
    } else {
        const {EnvironmentClass} = await import('file:' + envClassPath);
        env =  new EnvironmentClass(envUUID);
    }
    await env.init();
    return env;
}

export function terminate() {
    LocalHost.terminate();
}

function setupBasicCollectionTypes() {
    Collection.registerType('list', ChunkList);
    Collection.registerType('set', ChunkSet);
    Collection.registerType('map', ChunkMap);
}

export async function getBootWebports() {
    const webportsJSON = await NVD.load('bootWebports');
    var bootWebports;
    if(webportsJSON === null
    || webportsJSON === undefined) {
        bootWebports = [];
    } else {
        bootWebports = JSON.parse(webportsJSON);
    }
    return bootWebports;
}

export async function init() {
    LevelNVD.init();
    LevelChunkManager.init();
    await NodeCryptoManager.init();
    setupBasicCollectionTypes();
    const localKeypair = await cryptoManager.getLocalKeypair();
    await LocalHost.init(localKeypair);
    LocalHost.assignWebportTransceiver('ws', new WebServerTransceiver);
    LocalHost.assignWebportTransceiver('udp', new UDPTransceiver);
    const bootWebports = await getBootWebports();
    for(const webport of bootWebports) {
        LocalHost.connectWebport(webport);
    }
}
