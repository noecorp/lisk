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

const Promise = require('bluebird');
const fixtures = require('../fixtures');

let accounts = [];
let blocks = [];

class DatabaseSeed {
	static seedAccounts(db) {
		for (let i = 0; i < 5; i++) {
			accounts.push(fixtures.accounts.Account());
		}
		return db
			.task('db:seed:accounts', t => {
				return t.accounts.insert(accounts);
			})
			.then(() => accounts);
	}

	static seedBlocks(db, accounts) {
		let block;

		accounts.forEach((account, index) => {
			if (index === 0) {
				block = fixtures.blocks.GenesisBlock({
					generatorPublicKey: account.publicKey,
				});
			} else {
				block = fixtures.blocks.Block({
					id: account.blockId,
					generatorPublicKey: account.publicKey,
					previousBlock: block ? block.id : null,
					height: blocks.length + 1,
				});
			}

			blocks.push(block);
		});

		return db
			.task('db:seed:blocks', t => {
				return Promise.mapSeries(blocks, block => {
					return t.blocks.save(block);
				});
			})
			.then(() => blocks);
	}

	static seedDapps(db, count = 1) {
		const trs = [];

		for (let i = 0; i < count; i++) {
			trs.push(
				fixtures.transactions.Transaction({ blockId: blocks[0].id, type: 5 })
			);
		}

		return db.tx('db:seed:dapps', t => {
			return t.transactions.save(trs).then(() => trs);
		});
	}

	static seedOutTransfer(db, dapp, inTransfer, count = 1) {
		const trs = [];

		for (let i = 0; i < count; i++) {
			trs.push(
				fixtures.transactions.Transaction({
					blockId: blocks[0].id,
					type: 7,
					dapp,
					inTransfer,
				})
			);
		}

		return db.tx('db:seed:outtransfer', t => {
			return t.transactions.save(trs).then(() => trs);
		});
	}

	static seedInTransfer(db, dapp, count = 1) {
		const trs = [];

		for (let i = 0; i < count; i++) {
			trs.push(
				fixtures.transactions.Transaction({
					blockId: blocks[0].id,
					type: 6,
					dapp,
				})
			);
		}

		return db.tx('db:seed:intransfer', t => {
			return t.transactions.save(trs).then(() => trs);
		});
	}

	static seed(db) {
		return this.seedAccounts(db).then(accounts =>
			this.seedBlocks(db, accounts)
		);
	}

	static reset(db) {
		const tables = [
			'mem_accounts',
			'blocks',
			'forks_stat',
			'dapps',
			'intransfer',
			'outtransfer',
		];
		const promises = [];

		tables.forEach(table => {
			promises.push(db.query(`TRUNCATE TABLE "${table}" CASCADE`));
		});

		return db
			.task('db:seed:reset', t => {
				return t.batch(promises);
			})
			.then(() => {
				accounts = [];
				blocks = [];
			});
	}
}

module.exports = DatabaseSeed;
