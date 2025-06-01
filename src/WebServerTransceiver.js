/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Transceiver, logger } from '@fieldfare/core';
import { WebSocketServer } from 'ws';

export class WebServerTransceiver extends Transceiver {

	constructor() {
		super();
	}

	serve(address, port) {
		if(this.port) {
			throw Error('Cannot serve more than one WS port');
		}
		this.port = port;
		const server = new WebSocketServer({ 
  			port: port
		});
		server.on('connection', (socket) => {
    		console.log('Client connected');
			try {
				var newChannel = {
					type: 'wsServer',
					send: (message) => {
						var stringifiedMessage = JSON.stringify(message, message.jsonReplacer);
						socket.send(stringifiedMessage);
					},
					active: () => {
						return connection.connected;
					},
					info: {
						origin: request.origin,
						connection: connection
					}
				};
				newChannel.onMessageReceived = (message) => {
					logger.log('info', "WS connection callback undefined. Message droped: " + message);
				}
				socket.on('message', (message) => {
					if (message.type === 'utf8') {
						if(newChannel.onMessageReceived) {
							try {
								//logger.log('info', 'WS: Message from client: ' + message.utf8Data);
								var messageObject = JSON.parse(message.utf8Data);
								newChannel.onMessageReceived(messageObject);
							} catch (error) {
								logger.log('info', "Failed to treat WS message: " + error);
							}
						}
					} else {
						throw 'invalid message format';
					}
				});
				socket.on('close', () => {
					logger.log('info', (new Date()) + ' Peer ' + socket.remoteAddress + ' disconnected.');
				});
				if(this.onNewChannel) {
					this.onNewChannel(newChannel);
				}
			} catch (error) {
				logger.log('info', "Failed to accept connection: " + error);
			}
		});
		logger.log('info', (new Date()) + ' WS Server is listening on port ' + this.port);
	}
};
