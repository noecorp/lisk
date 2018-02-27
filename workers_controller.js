/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

'use strict';

var SCWorker = require('socketcluster/scworker');
var async = require('async');
var SlaveWAMPServer = require('wamp-socket-cluster/SlaveWAMPServer');
var Peer = require('./logic/peer');
var System = require('./modules/system');
var Handshake = require('./helpers/ws_api').middleware.Handshake;
var extractHeaders = require('./helpers/ws_api').extractHeaders;
var PeersUpdateRules = require('./api/ws/workers/peers_update_rules');
var Rules = require('./api/ws/workers/rules');
var failureCodes = require('./api/ws/rpc/failure_codes');
var Logger = require('./logger');
var config = require('./config.json');

/**
 * Instantiate the SocketCluster SCWorker instance with custom logic
 * inside the run function. The run function is invoked when the worker process
 * is ready to accept requests/connections.
 */
SCWorker.create({
	run() {
		var self = this;
		var scServer = this.getSCServer();

		async.auto(
			{
				logger(cb) {
					cb(
						null,
						new Logger({
							echo: config.consoleLogLevel,
							errorLevel: config.fileLogLevel,
							filename: config.logFileName,
						})
					);
				},

				slaveWAMPServer: [
					'logger',
					function(scope, cb) {
						new SlaveWAMPServer(self, 20e3, cb);
					},
				],

				config: [
					'slaveWAMPServer',
					function(scope, cb) {
						cb(null, scope.slaveWAMPServer.config);
					},
				],

				peersUpdateRules: [
					'slaveWAMPServer',
					function(scope, cb) {
						cb(null, new PeersUpdateRules(scope.slaveWAMPServer));
					},
				],

				registerRPCSlaveEndpoints: [
					'peersUpdateRules',
					function(scope, cb) {
						scope.slaveWAMPServer.reassignRPCSlaveEndpoints({
							updateMyself: scope.peersUpdateRules.external.update,
						});
						cb();
					},
				],

				system: [
					'config',
					function(scope, cb) {
						new System(cb, { config: scope.config });
					},
				],

				handshake: [
					'system',
					function(scope, cb) {
						return cb(null, Handshake(scope.system));
					},
				],
			},
			(err, scope) => {
				scServer.addMiddleware(scServer.MIDDLEWARE_HANDSHAKE, (req, next) => {
					scope.handshake(extractHeaders(req), (err, peer) => {
						if (err) {
							// Set a custom property on the HTTP request object; we will check this property and handle
							// this issue later.
							// Because of WebSocket protocol handshake restrictions, we can't call next(err) here because the
							// error will not be passed to the client. So we can attach the error to the request and disconnect later during the SC 'handshake' event.
							req.failedHeadersValidationError = err;
						} else {
							req.peerObject = peer.object();
						}
						// Pass through the WebSocket MIDDLEWARE_HANDSHAKE successfully, but
						// we will handle the req.failedQueryValidation error later inside scServer.on('handshake', handler);
						next();
					});
				});

				scServer.on('handshake', socket => {
					// We can access the HTTP request (which instantiated the WebSocket connection) using socket.request
					// so we can access our custom socket.request.failedQueryValidation property here.
					// If the property exists then we disconnect the connection.
					if (socket.request.failedHeadersValidationError) {
						return socket.disconnect(
							socket.request.failedHeadersValidationError.code,
							socket.request.failedHeadersValidationError.description
						);
					}
					updatePeerConnection(
						Rules.UPDATES.INSERT,
						socket,
						socket.request.peerObject,
						onUpdateError => {
							if (onUpdateError) {
								socket.disconnect(
									onUpdateError.code,
									onUpdateError.description
								);
							}
						}
					);
				});

				scServer.on('connection', socket => {
					scope.slaveWAMPServer.upgradeToWAMP(socket);
					socket.on('disconnect', removePeerConnection.bind(null, socket));
					socket.on('error', err => {
						socket.disconnect(err.code, err.message);
					});
				});

				function removePeerConnection(socket, code) {
					if (failureCodes.errorMessages[code]) {
						return;
					}
					var headers = extractHeaders(socket.request);
					scope.slaveWAMPServer.onSocketDisconnect(socket);
					updatePeerConnection(
						Rules.UPDATES.REMOVE,
						socket,
						new Peer(headers).object(),
						() => {}
					);
				}

				function updatePeerConnection(updateType, socket, peer, cb) {
					scope.peersUpdateRules.internal.update(
						updateType,
						peer,
						socket.id,
						onUpdateError => {
							var actionName = Object.keys(Rules.UPDATES)[updateType];
							if (onUpdateError) {
								scope.logger.warn(
									`Peer ${actionName} error: code: ${
										onUpdateError.code
									}, message: ${
										failureCodes.errorMessages[onUpdateError.code]
									}, description: ${onUpdateError.description}`
								);
							} else {
								scope.logger.info(
									`${actionName} peer - ${peer.ip}:${peer.wsPort} success`
								);
							}
							return setImmediate(cb, onUpdateError);
						}
					);
				}
			}
		);
	},
});
