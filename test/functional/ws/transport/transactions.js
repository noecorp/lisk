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

require('../../functional.js');
const lisk = require('lisk-js');
const WAMPServer = require('wamp-socket-cluster/WAMPServer');
const phases = require('../../common/phases');
const randomUtil = require('../../../common/utils/random');
const normalizeTransactionObject = require('../../../common/helpers/api')
	.normalizeTransactionObject;
const wsRPC = require('../../../../api/ws/rpc/ws_rpc').wsRPC;
const WsTestClient = require('../../../common/ws/client');

describe('Posting transaction (type 0)', () => {
	let transaction;
	const goodTransactions = [];
	const badTransactions = [];
	const account = randomUtil.account();
	let wsTestClient;

	function postTransaction(transaction, cb) {
		transaction = normalizeTransactionObject(transaction);
		wsTestClient.client.rpc.postTransactions(
			{
				peer: wsTestClient.headers,
				transactions: [transaction],
			},
			cb
		);
	}

	before('establish client WS connection to server', done => {
		// Setup stub for post transactions endpoint
		const wampServer = new WAMPServer();
		wampServer.registerRPCEndpoints({
			postTransactions: () => {},
		});
		wsRPC.setServer(wampServer);
		// Register client
		wsTestClient = new WsTestClient();
		wsTestClient.start();
		done();
	});

	beforeEach(done => {
		transaction = randomUtil.transaction();
		done();
	});

	describe('transaction processing', () => {
		it('when sender has no funds should fail', done => {
			var transaction = lisk.transaction.createTransaction(
				'1L',
				1,
				account.password
			);

			postTransaction(transaction, err => {
				expect(err).to.equal('RPC response timeout exceeded');
				done();
			});
			badTransactions.push(transaction);
		});

		it('when sender has funds should be ok', done => {
			postTransaction(transaction, (err, res) => {
				expect(err).to.be.null;
				expect(res).to.have.property('success').to.be.ok;
				expect(res)
					.to.have.property('transactionId')
					.to.equal(transaction.id);
				goodTransactions.push(transaction);
				done();
			});
		});
	});

	describe('confirmation', () => {
		phases.confirmation(goodTransactions, badTransactions);
	});
});
