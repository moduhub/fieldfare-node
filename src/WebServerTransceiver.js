/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Transceiver, logger } from '@fieldfare/core';
import { server as WebSocketServer } from 'websocket';
import http from 'http';

export class WebServerTransceiver extends Transceiver {

	constructor() {
		super();

		this.server = http.createServer((request, response) => {
			this.treatHttpRequest(request, response);
		});

		this.wsServer = new WebSocketServer({
			httpServer: this.server,
			// You should not use autoAcceptConnections for production
			// applications, as it defeats all standard cross-origin protection
			// facilities built into the protocol and the browser.  You should
			// *always* verify the connection's origin and decide whether or not
			// to accept it.
			autoAcceptConnections: false
		});

		this.wsServer.on('request', (request) => {

			logger.log('info', "wsServer onRequest");

			this.treatWsRequest(request);
		});
	}

	serve(address, port) {
		if(this.port) {
			throw Error('Cannot serve more than one WS port');
		}
		this.port = port;
		logger.info('Opening WS server port: ' + port)
		this.server.listen(this.port, () => {
			logger.log('info', (new Date()) + ' WS Server is listening on port ' + this.port);
		});
	}

	treatHttpRequest(request, response) {

		logger.log('info', (new Date()) + ' Received request for ' + request.url);
		response.writeHead(404);
		response.end();

	}

	originIsAllowed(origin) {
		return true;
	}

	treatWsRequest(request) {

		logger.log('info', "Entered treatWsRequest");

		if (!this.originIsAllowed(request.origin)) {
			// Make sure we only accept requests from an allowed origin
			request.reject();
			logger.log('info', (new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
			return;
		}

		//Create new channel for this destination
		try {

			var connection = request.accept('mhnet', request.origin);
			logger.log('info', (new Date()) + ' Connection from ' + request.origin + 'accepted.');

			var newChannel = {
				type: 'wsServer',
				send: (message) => {
					var stringifiedMessage = JSON.stringify(message, message.jsonReplacer);
					connection.send(stringifiedMessage);
				},
				active: () => {return true;},
				info: {
					origin: request.origin,
					connection: connection
				}
			};

			newChannel.onMessageReceived = (message) => {
				logger.log('info', "WS connection callback undefined. Message droped: " + message);
			}

			connection.on('message', (message) => {

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

					throw 'invalide message format';

				}

			});

			connection.on('close', function(reasonCode, description) {
				logger.log('info', (new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
			});

			if(this.onNewChannel) {
				this.onNewChannel(newChannel);
			}

		} catch (error) {

			logger.log('info', "Failed to accept connection: " + error);

		}
	}
};
